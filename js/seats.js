'use strict';
/* 座位：座位表（座號、姓名、大頭照）＋ 線上選位（依段考名次） */
(() => {
  const A = window.App, D = A.D;
  const { $, esc, toast, store } = A;
  const K = {
    chart: 'indoor.chart.v1' + A.SFX, faces: 'indoor.faces.v1' + A.SFX, sub: 'indoor.seatsub.v1',
    testSel: 'indoor.testsel.v1.test', testChart: 'indoor.testchart.v1.test', bots: 'indoor.bots.v1.test',
    live: 'indoor.live.v1' + A.SFX, backup: 'indoor.chartbak.v1' + A.SFX, defaulted: 'indoor.defaulted.v1' + A.SFX,
    decos: 'indoor.decos.v1' + A.SFX, acc: 'indoor.accimg.v1' + A.SFX,
  };
  const HOW = { wish: '志願', self: '自選', teacher: '老師指定', auto: '系統分配' };
  const STATUS = { idle: '沒有進行選位', ready: '準備中（可預選志願）', open: '選位中', paused: '暫停中', done: '選位結束' };

  let chart = store.get(K.chart, {});   // 座位代號 → 同學
  let faces = store.get(K.faces, {});   // 座號（料05）→ { t, d }
  let sel = null, selSkew = 0;          // 選位狀態（老師：完整；學生：只含自己的資料）
  let sub = store.get(K.sub, 'chart');  // 老師看「座位表」「現場選位」或「線上選位」
  let live = store.get(K.live, null);   // 現場選位：{ source, order, idx, hist, started, miss, absent }
  let picked = null;                    // 座位表點選：{ seat } 或 { key }（還沒有座位的同學）
  let highlight = new Set(), popSeats = new Set();
  let savingWishes = false;

  const selLive = () => !!sel && ['ready', 'open', 'paused'].includes(sel.status);
  const inSel = () => (A.isStudent() ? !!sel && (selLive() || (sel.status === 'done' && !sel.applied)) : sub === 'sel' && !!sel && sel.status !== 'idle');
  const takenOf = () => (!sel || sel.status === 'idle' ? {} : sel.taken || SelEngine.taken(sel));
  const seatById = Object.fromEntries(D.seats.map(s => [s.id, s]));
  const seatName = id => (seatById[id] ? `第${seatById[id].col}排第${seatById[id].row}個` : id);
  const seatOf = k => Object.keys(chart).find(id => chart[id] === k) || '';
  const fmtSec = s => `${Math.floor(s / 60)}:${A.pad2(s % 60)}`;

  function parseKey(k) {
    const m = String(k || '').match(/^(\D*?)(\d+)(.*)$/);
    return m ? { code: m[1] + A.pad2(+m[2]), name: m[3] } : { code: '', name: String(k || '') };
  }
  const hue = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  // 大頭照底圖（雲端硬碟）；沒有照片時顯示姓氏
  function faceBase(k) {
    const { code, name } = parseKey(k);
    const f = faces[code];
    if (f?.d) return `<img src="${f.d}" alt="">`;
    return `<span class="ava" style="background:hsl(${hue(k)} 40% 58%)">${esc((name || code).slice(0, 1))}</span>`;
  }
  // 大頭照＝底圖＋同學買的配件（位置、大小、角度都是相對於大頭照的比例）
  let decos = store.get(K.decos, {});   // 座號 → [{ acc, x, y, s, r }]
  let accImg = store.get(K.acc, {});    // 雲端硬碟配件 id → { t, d }
  let builtin = {};                     // 內建配件 id → 圖片網址
  const accUrl = id => (id?.startsWith('d:') ? accImg[id]?.d : builtin[id]) || '';
  const layerHtml = (l, i) => {
    const u = accUrl(l.acc);
    return u ? `<span class="acc" data-l="${i ?? ''}" style="left:${(l.x * 100).toFixed(2)}%;top:${(l.y * 100).toFixed(2)}%;width:${(l.s * 100).toFixed(2)}%;transform:translate(-50%,-50%) rotate(${l.r}deg);background-image:url('${u}')"></span>` : '';
  };
  function faceHtml(k) {
    const layers = decos[parseKey(k).code] || [];
    return `<span class="av">${faceBase(k)}${layers.map(l => layerHtml(l)).join('')}</span>`;
  }
  A.faceBase = faceBase;
  // 給 LINE 圖片製作用：底圖（data URL，沒有照片時為空）、裝飾、底色
  A.faceSrc = k => faces[parseKey(k).code]?.d || '';
  A.decoOf = k => decos[parseKey(k).code] || [];
  A.faceHue = k => hue(k);
  A.layerHtml = layerHtml;
  A.accUrl = accUrl;
  A.setDeco = (k, layers) => { decos[parseKey(k).code] = layers; store.set(K.decos, decos); A.emit('faces'); };
  // 內建配件清單（網站上的 assets/acc/catalog.json）
  const catalogP = fetch('assets/acc/catalog.json').then(r => r.json()).then(list => {
    list.forEach(a => { builtin[a.id] = a.src; });
    return list;
  }).catch(() => []);
  A.builtinCatalog = () => catalogP;
  catalogP.then(() => { if (Object.keys(decos).length) A.emit('faces'); });
  A.on('faces', () => renderAll());
  // 雲端硬碟配件圖片（有更新才下載）
  A.loadAccImages = async () => {
    const have = Object.fromEntries(Object.entries(accImg).map(([id, x]) => [id, x.t]));
    const r = await A.api('accImages', { have });
    let changed = false;
    Object.entries(r.images || {}).forEach(([id, x]) => { accImg[id] = x; changed = true; });
    Object.keys(accImg).forEach(id => { if (r.ids && !r.ids.includes(id)) { delete accImg[id]; changed = true; } });
    if (changed) store.set(K.acc, accImg);
    return changed;
  };
  A.parseKey = parseKey;
  A.faceHtml = faceHtml;
  A.seatOf = seatOf;
  A.busy = () => savingWishes || (inSel() && selLive());

  // ── 座位格內容 ──
  function seatHtml(s) {
    let k, extra = '';
    if (inSel()) {
      k = takenOf()[s.id];
      if (!k && sel.blocked.includes(s.id)) return `<span class="sid">${s.id}</span><span class="blk">不開放</span>`;
      if (A.isStudent()) {
        const w = sel.myWishes.indexOf(s.id);
        if (w >= 0) extra = `<span class="wish">${w + 1}</span>`;
      } else if (k && sel.how?.[k]) {
        extra = `<span class="how">${HOW[sel.how[k]]}</span>`;
      }
    } else k = chart[s.id];
    if (!k) return `<span class="sid">${s.id}</span>${extra}`;
    const { code, name } = parseKey(k);
    // 大頭照滿版，底下兩行小字：組別 座號／姓名
    return `<span class="photo">${faceHtml(k)}</span><span class="sn"><b>${esc(code.replace(/(\d+)$/, ' $1'))}</b><span>${esc(name)}</span></span>${extra}`;
  }
  function seatClass(s) {
    const c = [];
    let k;
    if (inSel()) {
      k = takenOf()[s.id];
      const blocked = !k && sel.blocked.includes(s.id);
      if (blocked) c.push('blocked');
      if (A.isStudent() && sel.myTurn && !k && !blocked) c.push('free');
      if (A.isStudent() && sel.myWishes.includes(s.id)) c.push('wished');
    } else {
      k = chart[s.id];
      if (liveRunning() && !k) c.push('free');
    }
    if (sub === 'swap' && picked?.seat === s.id) c.push('picked');
    if (k) c.push('has');
    if (k && k === A.me()) c.push('me');
    if (k && highlight.has(k)) c.push('hl');
    if (popSeats.has(s.id)) c.push('pop');
    return c.join(' ');
  }
  const map = A.mountMap('seats', 'seats', { seatHtml, seatClass });
  map.el.addEventListener('click', onSeatClick);

  function renderAll() {
    if (A.currentTab() !== 'seats') return;
    renderTop();
    A.renderMap('seats');
    renderPanel();
    renderBar();
    popSeats.clear();
  }
  function liveRunning() { return sub === 'live' && !!live?.started && live.idx < live.order.length; }

  // ── 上方：切換與狀態列 ──
  function renderTop() {
    const root = $('#seatTop');
    let h = '';
    if (!A.isStudent()) {
      if ((sub === 'live' || sub === 'swap') && !A.isTeacher()) sub = 'chart';
      h += `<div class="subsw" role="tablist">
        <button type="button" data-sub="chart" aria-selected="${sub === 'chart'}">📋 座位表</button>
        ${A.isTeacher() ? `<button type="button" data-sub="live" aria-selected="${sub === 'live'}">🎯 現場選位${live?.started && live.idx < live.order.length ? '<span class="live-dot"></span>' : ''}</button>` : ''}
        <button type="button" data-sub="sel" aria-selected="${sub === 'sel'}">🗳 線上選位${selLive() ? '<span class="live-dot" title="選位進行中"></span>' : ''}</button>
        ${A.isTeacher() ? `<button type="button" data-sub="swap" aria-selected="${sub === 'swap'}">🔁 交換位置</button>` : ''}
      </div>`;
      if (sub === 'swap') h += `<p class="muted small tip">💡 點一個座位、再點另一個座位，兩人就互換；點空位就是搬過去。</p>`;
      if (sub === 'chart') h += `<p class="muted small tip">點同學的大頭照可以放大，再點一次關閉。</p>`;
      if (sub === 'sel' && sel && sel.status !== 'idle') h += teacherBanner();
    } else {
      h += studentBanner();
    }
    root.innerHTML = h;
  }

  function teacherBanner() {
    const S = sel;
    const picked = Object.keys(S.picks).length;
    let h = `<div class="banner st-${S.status}"><div class="bn-main"><b>${STATUS[S.status]}</b>　已選 ${picked} / ${S.order.length} 人</div>`;
    if ((S.status === 'open' || S.status === 'paused') && S.waiting) {
      const dl = S.status === 'open' ? S.deadline : 0;
      h += `<div class="bn-now">目前輪到第 ${S.turn + 1} 位：<b>${esc(S.waiting)}</b>${S.deferred[S.waiting] ? '（第二次）' : ''}
        ${dl ? `<span class="cd" data-dl="${dl}"></span>` : S.status === 'paused' ? '<span class="muted">（暫停）</span>' : ''}</div>`;
    }
    return h + `</div>`;
  }

  function studentBanner() {
    const me = A.me();
    if (!inSel()) {
      const mine = seatOf(me);
      return `<div class="banner"><div class="bn-main">${sel?.status === 'done' && sel.applied ? '🎉 新座位表已公布' : '目前沒有進行選位'}</div>
        <div class="bn-sub">${mine ? `你的座位：<b>${seatName(mine)}</b>` : '下面是目前的座位表。'}</div></div>`;
    }
    const S = sel;
    if (!S.myPos) return `<div class="banner warn"><div class="bn-main">你不在這次的選位名單中</div><div class="bn-sub">請告訴導師。</div></div>`;
    let h = '';
    if (S.myPick) {
      h += `<div class="banner ok"><div class="bn-main">✅ 你的座位：${seatName(S.myPick)}</div><div class="bn-sub">${S.myHow === 'wish' ? '依你的志願自動分配' : HOW[S.myHow] || ''}${S.status === 'done' ? '｜選位已結束' : `｜目前已選 ${S.picked} / ${S.total} 人`}</div></div>`;
      return h;
    }
    if (S.myTurn) {
      h += `<div class="banner myturn"><div class="bn-main">輪到你了！請點一個空位</div>
        <div class="bn-sub">${S.deadline ? `剩下 <span class="cd big" data-dl="${S.deadline}"></span>` : '不限時間'}${S.deferred ? '（最後一次機會，時間到會由系統隨機分配）' : ''}</div></div>`;
      return h;
    }
    const where = S.status === 'ready' ? '選位還沒開始' : S.status === 'paused' ? '選位暫停中' : S.status === 'done' ? '選位已結束' : `目前輪到第 ${S.turnPos} 位`;
    h += `<div class="banner"><div class="bn-main">${where}｜你是第 <b>${S.myPos}</b> 位（共 ${S.total} 位）</div>`;
    if (S.status === 'open' && S.ahead > 0) h += `<div class="bn-sub">前面還有 ${S.ahead} 位。輪到你時手機會提醒，請留在這個畫面。</div>`;
    if (S.deferred) h += `<div class="bn-sub warn-text">你剛才超過時間，已經移到最後面，等一下會再輪到你。</div>`;
    h += `</div>`;
    if (S.maxWishes > 0 && S.status !== 'done') {
      h += `<div class="wishes"><div class="bn-sub">先點座位排志願（最多 ${S.maxWishes} 個）：輪到你時，系統會自動幫你選第一個還空著的志願。再點一次可以取消。</div><div class="wish-list">`;
      h += S.myWishes.length
        ? S.myWishes.map((w, i) => `<button type="button" class="wchip${S.taken[w] ? ' gone' : ''}" data-unwish="${w}">${i + 1}. ${seatName(w)}${S.taken[w] ? '（已被選）' : ''} ✕</button>`).join('')
        : '<span class="muted small">還沒有志願</span>';
      h += `</div></div>`;
    }
    return h;
  }

  $('#seatTop').addEventListener('click', e => {
    const s = e.target.closest('[data-sub]');
    if (s) {
      sub = s.dataset.sub; store.set(K.sub, sub);
      picked = null;
      renderAll();
      if (sub === 'sel') loadSel(true).then(renderAll).catch(err => toast(err.message)).finally(schedulePoll);
      return;
    }
    const w = e.target.closest('[data-unwish]');
    if (w) toggleWish(w.dataset.unwish);
  });

  // ── 下方面板 ──
  function renderPanel() {
    const root = $('#seatPanel');
    if (A.isStudent()) { root.innerHTML = legendHtml(); return; }
    if (sub === 'chart') { root.innerHTML = chartViewPanel(); return; }
    if (sub === 'swap') { root.innerHTML = chartPanel(); return; }
    if (sub === 'live') { root.innerHTML = livePanel(); return; }
    root.innerHTML = selPanel();
  }
  function legendHtml() {
    if (!inSel()) return `<p class="muted small center">可以按上方的「學生視角／老師視角」切換方向。</p>`;
    return `<ul class="legend seat-legend">
      <li><span class="sw sw-free"></span>空位</li><li><span class="sw sw-has"></span>已被選</li>
      <li><span class="sw sw-me"></span>我的座位</li><li><span class="sw sw-wish">1</span>我的志願</li><li><span class="sw sw-blk"></span>不開放</li></ul>`;
  }

  // 座位表（只看）：人數與還沒有座位的同學
  function chartViewPanel() {
    const list = A.students();
    const seated = new Set(Object.values(chart));
    const none = list.filter(n => !seated.has(n));
    return `<div class="panel"><div class="panel-row"><b>${seated.size} 人</b>${list.length ? `／全班 ${list.length} 人` : ''}${A.isTeacher() ? '　<span class="muted small">要換位置請到「🔁 交換位置」</span>' : ''}</div>
      ${none.length && A.isTeacher() ? `<div class="panel-row small">還沒有座位：${none.map(esc).join('、')}</div>` : ''}</div>`;
  }
  // 交換位置（導師）：點兩下互換、恢復預設、清空、大頭照資料夾
  function chartPanel() {
    const list = A.students();
    const seated = new Set(Object.values(chart));
    const none = list.filter(n => !seated.has(n));
    let h = `<div class="panel"><div class="panel-row"><b>已安排 ${seated.size} 人</b>${list.length ? `／全班 ${list.length} 人` : ''}</div>`;
    if (none.length) {
      h += `<div class="panel-row small">還沒有座位${A.isTeacher() ? '（點名字，再點座位放進去）' : ''}：<div class="chips">${none.map(n =>
        `<button type="button" class="nm${picked?.key === n ? ' on' : ''}" data-place="${esc(n)}"${A.isTeacher() ? '' : ' disabled'}>${esc(n)}</button>`).join('')}</div></div>`;
    }
    if (A.isTeacher()) {
      const bak = store.get(K.backup, null);
      h += `<div class="actions">
        <button type="button" class="btn" data-sa="default">↺ 恢復預設座位</button>
        <button type="button" class="btn btn--danger" data-sa="clear">清空座位表</button>
        ${bak ? `<button type="button" class="btn wide" data-sa="restore">↶ 還原到現場選位前的座位表</button>` : ''}</div>
        <details class="field"><summary><b>📁 大頭照資料夾</b></summary>
          <p class="small">貼上 Google 雲端硬碟資料夾的連結。照片檔名用「組別座號姓名」，例如 <code>料 24 王小明.jpg</code>、<code>多 11 陳小華.jpg</code>，會自動放到對應同學的座位。</p>
          <input type="url" id="faceUrl" placeholder="https://drive.google.com/drive/folders/…" autocomplete="off">
          <div class="actions"><button type="button" class="btn btn--primary wide" data-sa="faceFolder">連結並讀取大頭照</button></div>
          <p id="faceMsg" class="small muted">目前有照片的同學：${list.filter(k => faces[parseKey(k).code]).length} / ${list.length} 人</p>
        </details>`;
    }
    return h + `</div>`;
  }

  // ── 下方浮動列：座位表點選中／現場選位輪到誰 ──
  function renderBar() {
    const bar = $('#swapBar');
    let h = '';
    if (A.isTeacher() && sub === 'swap' && picked) {
      const k = picked.key || chart[picked.seat];
      const what = picked.key ? `${esc(k)}（還沒有座位）` : `${picked.seat}　${k ? esc(k) : '空位'}`;
      const job = k ? A.jobsOf(k).jobs.join('、') : '';
      h = `${k ? `<span class="face">${faceHtml(k)}</span>` : ''}<div class="sb-text"><b>已選：${what}</b>${job ? `<span class="sb-job">🧹 ${esc(job)}</span>` : ''}<span>${picked.key ? '點一個座位放進去' : '再點另一個座位 → 互換；點空位 → 搬過去'}</span></div>
        ${picked.seat && k ? `<button type="button" class="btn" data-pk="info">詳細</button>` : ''}${picked.seat ? `<button type="button" class="btn" data-pk="edit">✏️</button>` : ''}<button type="button" class="btn" data-pk="cancel">取消</button>`;
    } else if (liveRunning()) {
      const k = live.order[live.idx];
      h = `<span class="face">${faceHtml(k)}</span><div class="sb-text"><span>第 ${live.idx + 1} / ${live.order.length} 位</span><b class="big">${esc(k)}</b><span>請點一個空位</span></div>
        <button type="button" class="btn" data-lv="undo"${live.hist.length ? '' : ' disabled'}>↶ 復原</button><button type="button" class="btn" data-lv="skip">⏭ 跳過</button>`;
    }
    bar.innerHTML = h;
    bar.hidden = !h || A.currentTab() !== 'seats';
  }
  $('#swapBar').addEventListener('click', e => {
    const b = e.target.closest('[data-pk],[data-lv]');
    if (!b || b.disabled) return;
    if (b.dataset.lv) return liveAction(b.dataset.lv);
    if (b.dataset.pk === 'cancel') { picked = null; renderAll(); return; }
    if (b.dataset.pk === 'edit') { const id = picked.seat; picked = null; renderAll(); editSeat(id); }
    if (b.dataset.pk === 'info') { const id = picked.seat; picked = null; renderAll(); showSeatInfo(id); }
  });

  // 座位表：點一下選起來，再點另一個座位就互換
  function chartTap(id) {
    if (!picked) { picked = { seat: id }; renderAll(); return; }
    if (picked.seat === id) { picked = null; renderAll(); return; }
    if (picked.key) {
      const k = picked.key, old = chart[id];
      const at = seatOf(k);
      if (at) { if (old) chart[at] = old; else delete chart[at]; } else if (old) toast(`${old} 移到「還沒有座位」`);
      chart[id] = k;
      popSeats.add(id);
    } else {
      const a = picked.seat, ka = chart[a], kb = chart[id];
      if (!ka && !kb) { picked = { seat: id }; renderAll(); return; }
      if (kb) chart[a] = kb; else delete chart[a];
      if (ka) chart[id] = ka; else delete chart[id];
      popSeats.add(a); popSeats.add(id);
    }
    picked = null;
    saveChart(true);
  }

  // 預設座位（只存座號，用名單換成姓名）
  function defaultChart() {
    const list = A.students();
    const byCode = Object.fromEntries(list.map(k => [parseKey(k).code, k]));
    const out = {};
    Object.entries(D.defaultSeats || {}).forEach(([col, codes]) => codes.forEach((c, i) => {
      const k = byCode[parseKey(c).code];
      if (k && seatById[`${col}-${i + 1}`]) out[`${col}-${i + 1}`] = k;
    }));
    return out;
  }
  async function applyDefault(ask) {
    if (!A.students().length) { try { await A.loadStudents(); } catch (e) { return toast('無法讀取名單：' + e.message); } }
    if (ask && Object.keys(chart).length && !await A.ask('恢復成預設座位？目前的座位表會被取代。', '恢復預設')) return;
    chart = defaultChart();
    store.set(K.defaulted, true);
    saveChart(!ask);
  }

  // ── 🎯 現場選位：依上傳名單的順序，一位一位點座位 ──
  function livePanel() {
    let h = `<div class="panel">`;
    const L = live;
    if (!L || !L.order?.length) {
      h += `<h3>🎯 依名單順序現場選位</h3>
        <p class="small">上傳名單（Excel、CSV 或文字檔）。開始後會先清空所有座位，第 1 位先點任何一個座位，接著第 2 位、第 3 位…直到全部選完。<br>
        名單有「名次」或「排名」欄就依名次排序，沒有就照名單由上到下的順序。名單只在這台裝置上讀取，不會上傳。</p>
        <div class="actions"><label class="btn btn--primary wide file-btn">📄 選擇名單檔案<input type="file" id="liveFile" accept=".xlsx,.xls,.csv,.txt,text/csv,text/plain" hidden></label></div>
        <details class="field"><summary class="small"><b>或直接貼上名單</b></summary>
          <textarea id="livePaste" placeholder="一行一位，例如：&#10;料 24 王小明&#10;多 11 陳小華"></textarea>
          <div class="actions"><button type="button" class="btn wide" data-lv="paste">使用貼上的名單</button></div></details>
        ${A.TEST ? `<div class="actions"><button type="button" class="btn wide" data-lv="demo">🧪 用示範名單（隨機順序）試試</button></div>` : ''}`;
      return h + `</div>`;
    }
    const done = L.started && L.idx >= L.order.length;
    h += `<div class="panel-row small muted">名單：${esc(L.source)}｜共 ${L.order.length} 人</div>`;
    if (L.miss?.length) h += `<div class="panel-row small warn-text">⚠ 名單中對不到同學的列：${L.miss.map(esc).join('、')}</div>`;
    if (L.absent?.length) h += `<div class="panel-row small warn-text">⚠ 不在名單中的同學（最後請在座位表手動安排）：${L.absent.map(esc).join('、')}</div>`;
    if (!L.started) {
      h += `<div class="actions"><button type="button" class="btn btn--primary wide big" data-lv="start">▶ 開始（清空所有座位）</button>
        <button type="button" class="btn wide" data-lv="reset">重新選擇名單</button></div>`;
    } else if (!done) {
      h += `<div class="panel-row"><b>進行中：第 ${L.idx + 1} / ${L.order.length} 位</b>（下方浮動列顯示輪到誰）</div>
        <div class="actions"><button type="button" class="btn" data-lv="undo"${L.hist.length ? '' : ' disabled'}>↶ 復原上一位</button>
        <button type="button" class="btn" data-lv="skip">⏭ 跳過（移到最後）</button>
        <button type="button" class="btn btn--danger wide" data-lv="stop">結束現場選位</button></div>`;
    } else {
      h += `<div class="banner ok"><div class="bn-main">🎉 全部選完了！座位表已儲存</div></div>
        <div class="actions"><button type="button" class="btn" data-lv="undo">↶ 復原上一位</button><button type="button" class="btn btn--primary" data-lv="finish">回到座位表</button></div>`;
    }
    h += `<details class="order-box"${L.started ? '' : ' open'}><summary>順序名單</summary><ol class="order">`;
    L.order.forEach((k, i) => {
      const seat = L.started ? seatOf(k) : '';
      const cur = L.started && i === L.idx;
      h += `<li class="${cur ? 'cur' : ''}${seat ? ' done' : ''}"><span class="pos">${i + 1}</span><span class="who">${esc(k)}</span><span></span><span class="st">${seat || (cur ? '⏳ 選位中' : '')}</span></li>`;
    });
    return h + `</ol></details></div>`;
  }

  const saveLive = () => store.set(K.live, live);
  function liveSeat(id) {
    if (!liveRunning()) return live?.started ? showSeatInfo(id) : toast('請先在下方選擇名單並按「開始」');
    if (chart[id]) return toast(`${seatName(id)} 已經是 ${chart[id]} 的座位`);
    const k = live.order[live.idx];
    chart[id] = k;
    live.hist.push({ k, seat: id });
    live.idx++;
    popSeats.add(id);
    saveLive();
    if (live.idx >= live.order.length) toast('🎉 全部選完了！');
    saveChart(true);
  }
  async function liveAction(act) {
    if (act === 'undo') {
      const last = live.hist.pop();
      if (!last) return;
      delete chart[last.seat];
      live.idx--;
      saveLive(); saveChart(true);
    } else if (act === 'skip') {
      live.order.push(live.order.splice(live.idx, 1)[0]);
      saveLive(); renderAll();
      toast(`${live.order[live.order.length - 1]} 移到最後`);
    } else if (act === 'start') {
      if (!await A.ask(`開始現場選位？\n會先清空所有座位（目前的座位表會備份，可以還原）。\n第 1 位：${live.order[0]}`, '開始')) return;
      store.set(K.backup, chart);
      chart = {};
      Object.assign(live, { started: true, idx: 0, hist: [] });
      saveLive(); saveChart(true);
    } else if (act === 'stop') {
      if (!await A.ask('結束現場選位？已選好的座位會保留。', '結束')) return;
      live = null; store.del(K.live); sub = 'chart'; store.set(K.sub, sub); renderAll();
    } else if (act === 'finish') {
      live = null; store.del(K.live); sub = 'chart'; store.set(K.sub, sub); renderAll();
    } else if (act === 'reset') {
      live = null; store.del(K.live); renderAll();
    } else if (act === 'paste') {
      const rows = ($('#livePaste').value || '').split(/\r?\n/).map(l => l.split(/[,\t]/));
      useList(rows, '貼上的名單');
    } else if (act === 'demo') {
      useList([...A.students()].sort(() => Math.random() - 0.5).map(k => [k]), '示範名單（隨機）');
    }
  }

  async function useList(rows, source) {
    if (!A.students().length) { try { await A.loadStudents(); } catch (e) { return toast('無法讀取學生名單：' + e.message); } }
    const r = parseOrder(rows);
    if (!r.order.length) return toast('名單裡找不到任何同學，請確認有「組別座號姓名」或「姓名」');
    live = { source, order: r.order, miss: r.miss, absent: r.absent, idx: 0, hist: [], started: false };
    saveLive(); renderAll();
    toast(`✓ 讀到 ${r.order.length} 位同學`);
  }

  // 名單比對：「料 24 王小明」「料24王小明」、分欄的 科別／座號／姓名、只有姓名 都可以
  function parseOrder(rows) {
    const norm = s => String(s ?? '').normalize('NFKC').replace(/\s+/g, '');
    const RANK = /^(名次|排名|班排名|班級名次|班排)$/;
    const people = A.students().map(k => ({ k, ...parseKey(k) }));
    let rankCol = -1, start = 0;
    const hi = rows.slice(0, 10).findIndex(r => r.some(c => RANK.test(norm(c)) || /^(姓名|座號)$/.test(norm(c))));
    if (hi >= 0) { rankCol = rows[hi].findIndex(c => RANK.test(norm(c))); start = hi + 1; }
    const found = [], miss = [], seen = new Set();
    rows.slice(start).forEach((r, i) => {
      const cells = r.map(norm);
      const text = cells.join('').replace(/(\D)(\d)(?!\d)/g, '$10$2'); // 料5 → 料05
      if (!text) return;
      let m = people.find(p => text.includes(p.k));
      if (!m) { const s = people.filter(p => p.name && text.includes(p.name)); if (s.length === 1) m = s[0]; }
      if (!m) { const s = people.filter(p => p.code && text.includes(p.code)); if (s.length === 1) m = s[0]; }
      if (!m) { if (/[一-鿿]/.test(text)) miss.push(r.filter(c => String(c).trim()).join(' ').slice(0, 20)); return; }
      if (seen.has(m.k)) return;
      seen.add(m.k);
      found.push({ k: m.k, rank: rankCol >= 0 ? parseFloat(cells[rankCol]) : NaN, i });
    });
    if (rankCol >= 0) found.sort((a, b) => (isNaN(a.rank) ? 1e9 : a.rank) - (isNaN(b.rank) ? 1e9 : b.rank) || a.i - b.i);
    return { order: found.map(x => x.k), miss: miss.slice(0, 20), absent: A.students().filter(k => !seen.has(k)) };
  }

  // 讀檔：Excel 用 SheetJS（需要時才載入）；CSV／文字檔自動判斷 UTF-8 或 Big5（Excel 存的 CSV）
  let xlsxP;
  const loadXlsx = () => xlsxP ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => res(window.XLSX);
    s.onerror = () => { xlsxP = null; rej(new Error('無法載入 Excel 讀取工具，請確認網路，或改存成 CSV')); };
    document.head.appendChild(s);
  });
  async function readListFile(f) {
    const buf = await f.arrayBuffer();
    if (/\.xlsx?$/i.test(f.name)) {
      const XLSX = await loadXlsx();
      const wb = XLSX.read(buf, { type: 'array' });
      return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
    }
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { text = new TextDecoder('big5').decode(buf); }
    return text.replace(/^﻿/, '').split(/\r?\n/).map(l => l.split(/[,\t]/).map(c => c.replace(/^"|"$/g, '')));
  }
  $('#seatPanel').addEventListener('change', async e => {
    if (e.target.id !== 'liveFile') return;
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { toast('讀取名單中…'); await useList(await readListFile(f), f.name); } catch (err) { toast('名單讀取失敗：' + err.message); }
  });

  function selPanel() {
    const S = sel;
    if (!A.isTeacher()) {
      if (!S || S.status === 'idle') return `<div class="panel"><p class="muted">目前沒有進行選位。</p></div>`;
      return `<div class="panel">${orderHtml(false)}</div>`;
    }
    let h = `<div class="panel">`;
    if (!S || S.status === 'idle') {
      h += `<h3>線上選位</h3>
        <p class="small">依段考名次排順序，同學用自己的身分證字號登入後選位。學生登入網址：<br><code class="url">${esc(studentUrl())}</code>
        <button type="button" class="link-btn" data-sa="copyUrl">複製</button></p>
        <div class="form-row"><label>每人時間<select id="perTurn">${[30, 45, 60, 90, 120, 0].map(v => `<option value="${v}"${v === 60 ? ' selected' : ''}>${v ? v + ' 秒' : '不限時'}</option>`).join('')}</select></label>
        <label>預選志願<select id="maxWishes">${[0, 3, 5, 8].map(v => `<option value="${v}"${v === 5 ? ' selected' : ''}>${v ? v + ' 個' : '不用'}</option>`).join('')}</select></label></div>
        <div class="actions"><button type="button" class="btn btn--primary wide" data-sa="load">📥 讀取段考排名，準備選位</button></div>
        <p class="muted small">排名檔：放在雲端硬碟「內掃檢查」資料夾，檔名含「排名」或「成績」的 Google 試算表（有好幾份時用最新修改的那份）。
        需要「名次」欄，以及「科別、座號、姓名」。「身分證字號」欄可以放在排名檔或名單裡。</p>`;
      return h + `</div>`;
    }
    const picked = Object.keys(S.picks).length;
    h += `<div class="panel-row small muted">排名來源：${esc(S.source)}｜每人 ${S.perTurn ? S.perTurn + ' 秒' : '不限時'}｜志願 ${S.maxWishes} 個</div>`;
    if (S.noRank?.length) h += `<div class="panel-row small warn-text">⚠ 排名檔裡找不到（排在最後）：${S.noRank.map(esc).join('、')}</div>`;
    if (S.noId?.length) h += `<div class="panel-row small warn-text">⚠ 沒有身分證字號、無法登入（請老師代選）：${S.noId.map(esc).join('、')}</div>`;
    if (S.status === 'ready') {
      const wished = Object.values(S.wishes).filter(w => w.length).length;
      h += `<div class="panel-row">現在同學可以登入預選志願（已填 ${wished} 人）。<br><span class="small muted">點座位可以設為「不開放」，或先指定給某位同學。</span></div>
        <div class="actions"><button type="button" class="btn btn--primary wide" data-sa="open">▶ 開始選位</button>
        <button type="button" class="btn" data-sa="load">🔄 重新讀取排名</button><button type="button" class="btn btn--danger" data-sa="reset">取消選位</button></div>`;
    } else if (S.status === 'open' || S.status === 'paused') {
      h += `<div class="actions">${S.status === 'open'
        ? `<button type="button" class="btn" data-sa="pause">⏸ 暫停</button>`
        : `<button type="button" class="btn btn--primary" data-sa="resume">▶ 繼續</button>`}
        <button type="button" class="btn" data-sa="skip">⏭ 跳過（移到最後）</button>
        <button type="button" class="btn btn--danger wide" data-sa="end">結束選位</button></div>
        <p class="muted small">輪到的同學不在時可以「跳過」；也可以直接點空位，指定給目前輪到的同學。</p>`;
    } else if (S.status === 'done') {
      const miss = S.order.filter(k => !S.picks[k]);
      h += `<div class="panel-row">選位結束：已選 ${picked} / ${S.order.length} 人${miss.length ? `，還沒有座位：${miss.map(esc).join('、')}（點空位可以指定）` : ''}</div>
        <div class="actions"><button type="button" class="btn btn--primary wide" data-sa="apply">${S.applied ? '✅ 已套用，再套用一次' : '✅ 套用到座位表'}</button>
        <button type="button" class="btn btn--danger wide" data-sa="reset">清除這次選位</button></div>`;
    }
    if (A.TEST) h += `<label class="switch-row small" style="margin-top:10px"><span class="switch"><input type="checkbox" id="botsToggle"${botsOn() ? ' checked' : ''}><span></span></span>🤖 模擬其他同學自動選位（示範同學「料05鄒○軒」留給你用學生身分試用）</label>`;
    h += orderHtml(true);
    return h + `</div>`;
  }

  // 順序名單（依名次）：投影時可能會被看到，預設收起來
  function orderHtml(showRank) {
    const S = sel;
    let h = `<details class="order-box"><summary>順序名單（${S.order.length} 人，依名次）</summary><ol class="order">`;
    S.order.forEach((k, i) => {
      const seat = S.picks[k], cur = S.waiting === k;
      const w = (S.wishes[k] || []);
      h += `<li class="${cur ? 'cur' : ''}${seat ? ' done' : ''}"><span class="pos">${i + 1}</span><span class="who">${esc(k)}</span>`
        + (showRank ? `<span class="rk">${S.ranks[k] ? '第' + S.ranks[k] + '名' : '無名次'}</span>` : '')
        + `<span class="st">${seat ? `${seat}<em>${HOW[S.how[k]] || ''}</em>` : cur ? '⏳ 選位中' : w.length ? `志願 ${w.join('、')}` : ''}</span></li>`;
    });
    return h + `</ol></details>`;
  }

  const studentUrl = () => location.href.replace(/[#?].*$/, '') + '#seat';

  $('#seatPanel').addEventListener('change', e => {
    if (e.target.id === 'botsToggle') { store.set(K.bots, e.target.checked); toast(e.target.checked ? '同學會自動選位' : '已停止模擬'); }
  });
  $('#seatPanel').addEventListener('click', async e => {
    const pl = e.target.closest('[data-place]');
    if (pl && !pl.disabled) {
      picked = picked?.key === pl.dataset.place ? null : { key: pl.dataset.place };
      renderAll();
      return;
    }
    const lv = e.target.closest('[data-lv]');
    if (lv && !lv.disabled) return liveAction(lv.dataset.lv);
    const b = e.target.closest('[data-sa]');
    if (!b || b.disabled) return;
    const act = b.dataset.sa;
    if (act === 'copyUrl') { toast(await A.copyText(studentUrl()) ? '已複製學生登入網址' : '複製失敗'); return; }
    if (act === 'default') return applyDefault(true);
    if (act === 'clear') {
      if (!await A.ask('確定要清空整張座位表嗎？\n（清空前的座位表會備份，可以還原）', '清空', true)) return;
      store.set(K.backup, chart);
      chart = {}; picked = null;
      store.set(K.defaulted, true); // 清空後不要自動填回預設
      saveChart(); return;
    }
    if (act === 'restore') {
      if (!await A.ask('還原成備份的座位表？目前的座位表會被取代。', '還原')) return;
      chart = store.get(K.backup, {}); store.del(K.backup);
      saveChart(); return;
    }
    if (act === 'faceFolder') {
      const url = $('#faceUrl').value.trim();
      if (!url) return toast('請貼上雲端硬碟資料夾的連結');
      const msg = $('#faceMsg');
      b.disabled = true; msg.textContent = '連結中，讀取照片可能需要 10–30 秒…';
      try {
        const r = await A.api('setFaceFolder', { url });
        facesLoaded = 0;
        await loadFaces();
        facesLoaded = Date.now();
        const list = A.students();
        const n = list.filter(k => faces[parseKey(k).code]).length;
        renderAll();
        toast(`✓ 已連結「${r.name}」：${r.count} 張照片，對應到 ${n} 位同學`);
      } catch (err) { msg.textContent = '✕ ' + err.message; b.disabled = false; }
      return;
    }
    const ask = {
      load: sel && sel.status !== 'idle' ? '重新讀取排名會清除目前的選位進度（志願、已選的座位），確定嗎？' : '',
      open: '開始選位？\n開始後會依名次輪流，有預選志願的同學會立刻自動分配。',
      end: '確定要結束選位嗎？還沒選的同學要由老師指定。',
      reset: '確定要清除這次的選位嗎？（已套用的座位表不受影響）',
      apply: '把選位結果套用到座位表？\n原本的座位表會被取代。',
    }[act];
    if (ask && !await A.ask(ask, { load: '重新讀取', open: '開始選位', end: '結束選位', reset: '清除', apply: '套用' }[act], act === 'reset')) return;
    b.disabled = true;
    try {
      let r;
      if (act === 'load') {
        toast('讀取段考排名中…');
        r = await A.api('selLoad', { seats: D.seats.map(s => s.id), perTurn: +($('#perTurn')?.value ?? sel?.perTurn ?? 60), maxWishes: +($('#maxWishes')?.value ?? sel?.maxWishes ?? 5) });
      } else {
        r = await A.api('selCmd', { cmd: act });
      }
      applySel(r);
      if (act === 'apply' && r.seats) {
        chart = r.seats; store.set(K.chart, chart);
        sub = 'chart'; store.set(K.sub, sub);
        toast('✓ 已套用到座位表');
      } else if (act === 'load') toast(`✓ 已讀取「${sel.source}」，共 ${sel.order.length} 人`);
      renderAll();
    } catch (err) {
      toast(err.message);
      b.disabled = false;
    }
    schedulePoll();
  });

  // ── 點座位 ──
  function onSeatClick(e) {
    const b = e.target.closest('[data-seat]');
    if (!b) return;
    const id = b.dataset.seat;
    if (A.isStudent()) return studentSeat(id);
    if (sub === 'live' && A.isTeacher()) return liveSeat(id);
    if (inSel()) return A.isTeacher() ? teacherSelSeat(id) : showSeatInfo(id);
    if (sub === 'swap' && A.isTeacher()) return chartTap(id);
    return zoomFace(id);
  }

  function showSeatInfo(id) {
    const k = inSel() ? takenOf()[id] : chart[id];
    if (!k) return toast(`${seatName(id)}：空位`);
    let h = A.sheetHead(esc(k), seatName(id));
    h += `<div class="seat-big"><span class="face">${faceHtml(k)}</span><div>${dutyHtml(k)}</div></div>`;
    if (A.isStaff()) h += `<div class="actions"><button type="button" class="btn wide" data-act="points" data-key="${esc(k)}">⚖️ 幫 ${esc(k)} 登記加扣分</button></div>`;
    A.openSheet({ kind: 'seatinfo' }, h);
  }
  A.sheetHandlers.seatinfo = (act, b) => { if (act === 'points') { A.closeSheet(); A.openPoints?.([b.dataset.key]); } };
  // 掃地工作與幹部職位
  function dutyHtml(k) {
    const { jobs, roles } = A.jobsOf(k);
    return `<div class="duty"><span class="muted small">🧹 掃地工作</span><b>${jobs.length ? jobs.map(esc).join('<br>') : '（沒有指定）'}</b>
      ${roles.length ? `<span class="muted small">🎖 幹部</span><b>${roles.map(esc).join('、')}</b>` : ''}</div>`;
  }
  A.dutyHtml = dutyHtml;

  // 學生：點空位＝排志願；輪到自己時＝選位
  function studentSeat(id) {
    if (!inSel() || sel.status === 'done') return showSeatInfo(id);
    const S = sel;
    const t = S.taken[id];
    if (t) return toast(t === A.me() ? '這是你的座位' : `${seatName(id)} 已經是 ${t} 的座位`);
    if (S.blocked.includes(id)) return toast('這個座位不開放選擇');
    if (S.myPick) return toast(`你已經選好座位：${seatName(S.myPick)}`);
    if (!S.myPos) return toast('你不在這次的選位名單中');
    if (S.myTurn) {
      let h = A.sheetHead(`選 ${seatName(id)}？`, '選位');
      h += `<p>確定後就不能再改了。</p><div class="actions"><button type="button" class="btn btn--primary wide big" data-act="pickOk" data-seat="${id}">✅ 確定選這個座位</button>
        <button type="button" class="btn wide" data-act="close">再想想</button></div>`;
      A.openSheet({ kind: 'pick' }, h);
      return;
    }
    toggleWish(id);
  }
  A.sheetHandlers.pick = async (act, b) => {
    if (act !== 'pickOk') return;
    b.disabled = true; b.textContent = '送出中…';
    try {
      const r = await A.api('stuPick', { seat: b.dataset.seat });
      applySel(r);
      A.closeSheet();
      toast(`✅ 選好了！你的座位是 ${seatName(sel.myPick)}`);
    } catch (err) {
      toast(err.message);
      A.closeSheet();
      await loadSel(true).catch(() => {});
    }
    renderAll();
  };

  let wishTimer;
  function toggleWish(id) {
    const S = sel;
    if (!S || !inSel()) return;
    if (!S.maxWishes) return toast('這次選位不用填志願，輪到你時直接點座位');
    const list = [...S.myWishes];
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else if (list.length >= S.maxWishes) return toast(`志願最多 ${S.maxWishes} 個，先點掉一個再加`);
    else list.push(id);
    S.myWishes = list;
    savingWishes = true;
    renderAll();
    clearTimeout(wishTimer);
    wishTimer = setTimeout(async () => {
      try {
        const r = await A.api('stuWish', { wishes: sel.myWishes });
        savingWishes = false;
        applySel(r);
        toast('✓ 志願已儲存');
      } catch (err) {
        savingWishes = false;
        toast('志願儲存失敗：' + err.message);
        await loadSel(true).catch(() => {});
      }
      renderAll();
    }, 700);
  }

  // 老師（選位中）：點座位＝不開放／指定／取消
  function teacherSelSeat(id) {
    const S = sel, k = takenOf()[id];
    let h = A.sheetHead(`座位 ${id}`, seatName(id));
    if (k) {
      h += `<div class="seat-big"><span class="face">${faceHtml(k)}</span><div><b>${esc(k)}</b><br><span class="muted small">${HOW[S.how[k]] || ''}</span></div></div>`;
      h += `<div class="actions"><button type="button" class="btn btn--danger wide" data-act="unassign" data-key="${esc(k)}">取消這個座位${S.status === 'open' || S.status === 'paused' ? '（讓他馬上重選）' : ''}</button></div>`;
    } else {
      if ((S.status === 'open' || S.status === 'paused') && S.waiting) {
        h += `<div class="actions"><button type="button" class="btn btn--primary wide" data-act="assign" data-key="${esc(S.waiting)}">指定給目前輪到的 ${esc(S.waiting)}</button></div>`;
      }
      const free = S.order.filter(x => !S.picks[x]);
      if (free.length) {
        h += `<h3>指定給…</h3><select id="assignSel">${free.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select>
          <div class="actions"><button type="button" class="btn wide" data-act="assign">指定</button></div>`;
      }
      if (S.status !== 'done') {
        const blocked = S.blocked.includes(id);
        h += `<h3>開放選擇</h3><div class="actions"><button type="button" class="btn wide" data-act="block">${blocked ? '✅ 改為開放' : '🚫 設為不開放（沒有人能選）'}</button></div>`;
      }
    }
    A.openSheet({ kind: 'selseat', id }, h);
  }
  A.sheetHandlers.selseat = async (act, b) => {
    const id = A.sheetMode().id;
    b.disabled = true;
    try {
      let r;
      if (act === 'assign') r = await A.api('selAssign', { key: b.dataset.key || $('#assignSel').value, seat: id });
      else if (act === 'unassign') r = await A.api('selAssign', { key: b.dataset.key, seat: '' });
      else if (act === 'block') r = await A.api('selBlock', { seat: id });
      else return;
      applySel(r);
      A.closeSheet();
      renderAll();
    } catch (err) { toast(err.message); b.disabled = false; }
  };

  // 老師（座位表）：換人、上傳大頭照
  async function editSeat(id) {
    if (!A.students().length) {
      toast('讀取學生名單中…');
      try { await A.loadStudents(); } catch (e) { return toast('無法讀取名單：' + e.message); }
    }
    const k = chart[id];
    let h = A.sheetHead(`座位 ${id}`, seatName(id));
    if (k) h += `<div class="seat-big"><span class="face">${faceHtml(k)}</span><div><b>${esc(k)}</b></div></div>`;
    h += `<div class="field"><label for="seatStu">坐在這裡的同學</label><select id="seatStu"><option value="">— 空位 —</option>`;
    A.students().forEach(n => {
      const at = seatOf(n);
      h += `<option value="${esc(n)}"${n === k ? ' selected' : ''}>${esc(n)}${at && at !== id ? `（目前在 ${at}，會互換）` : ''}</option>`;
    });
    h += `</select></div><div class="actions"><button type="button" class="btn btn--primary wide" data-act="seatOk">確定</button>`;
    if (k) h += `<button type="button" class="btn wide" data-act="face">📷 上傳／更換 ${esc(k)} 的大頭照</button>`;
    h += `</div>`;
    A.openSheet({ kind: 'seatedit', id }, h);
  }
  A.sheetHandlers.seatedit = (act) => {
    const id = A.sheetMode().id;
    if (act === 'seatOk') {
      const nk = $('#seatStu').value, old = chart[id];
      if (nk !== (old || '')) {
        if (nk) {
          const at = seatOf(nk);
          if (at) { if (old) chart[at] = old; else delete chart[at]; }
          chart[id] = nk;
        } else delete chart[id];
        saveChart();
      }
      A.closeSheet();
    } else if (act === 'face') {
      faceTarget = chart[id];
      $('#faceInput').click();
    }
  };

  // 連續換位時合併成一次上傳；quiet＝不顯示「已儲存」
  let chartTimer = null, chartQuiet = true;
  function saveChart(quiet = false) {
    store.set(K.chart, chart);
    renderAll();
    chartQuiet = chartQuiet && quiet;
    clearTimeout(chartTimer);
    chartTimer = setTimeout(async () => {
      const q = chartQuiet;
      chartQuiet = true; chartTimer = null;
      try {
        await A.api('saveSeats', { seats: chart });
        if (!q && !chartTimer) toast('✓ 座位表已儲存');
      } catch (err) { toast('座位表儲存失敗：' + err.message); }
    }, 900);
  }

  // ── 大頭照：裁成正方形 256px 後上傳 ──
  let faceTarget = null;
  $('#faceInput').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f || !faceTarget) return;
    const k = faceTarget, { code } = parseKey(k);
    try {
      toast('處理照片中…');
      const img = await A.loadImage(f);
      // 裁成 3:4 直式（和座位格一樣），臉通常在上方，所以偏上裁
      const W = 240, H = 320;
      const sc = Math.max(W / img.width, H / img.height);
      const sw = W / sc, sh = H / sc;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      c.getContext('2d').drawImage(img, (img.width - sw) / 2, Math.max(0, (img.height - sh) * 0.3), sw, sh, 0, 0, W, H);
      img.close?.();
      const d = c.toDataURL('image/jpeg', 0.8);
      const r = await A.api('uploadFace', { code, data: d.split(',')[1] });
      faces[code] = { t: r.t, d };
      saveFaces();
      A.closeSheet();
      renderAll();
      toast(`✓ 已更新 ${k} 的大頭照`);
    } catch (err) { toast('大頭照上傳失敗：' + err.message); }
  });
  function saveFaces() { store.set(K.faces, faces); /* 空間不足時只留在記憶體 */ }

  // ── 讀取雲端 ──
  function applySel(r) {
    if (!r || r.same) { if (r?.now) selSkew = r.now - Date.now(); return false; }
    const before = sel ? takenOf() : null;
    sel = r.sel;
    selSkew = (r.now || Date.now()) - Date.now();
    if (before) Object.keys(takenOf()).forEach(id => { if (!before[id]) popSeats.add(id); });
    if (A.isStudent() && sel?.myTurn && !wasMyTurn) notifyTurn();
    wasMyTurn = !!sel?.myTurn;
    return true;
  }
  let wasMyTurn = false;
  function notifyTurn() {
    try { navigator.vibrate?.([200, 100, 200, 100, 300]); } catch { /* ignore */ }
    toast('🔔 輪到你了！請選座位');
  }

  async function loadSel(force) {
    const r = await A.api(A.isStudent() ? 'stuState' : 'selState', { v: force ? 0 : sel?.v || 0 });
    if (savingWishes) return false; // 志願還在儲存，先不要蓋掉
    return applySel(r);
  }
  async function loadChart() {
    const r = await A.api('getSeats');
    const next = r.seats || {};
    if (JSON.stringify(next) === JSON.stringify(chart)) return false;
    chart = next; store.set(K.chart, chart);
    return true;
  }
  async function loadFaces() {
    const have = Object.fromEntries(Object.entries(faces).map(([c, f]) => [c, f.t]));
    const r = await A.api('getFaces', { have });
    let changed = false;
    Object.entries(r.faces || {}).forEach(([c, f]) => { faces[c] = f; changed = true; });
    if (r.codes) Object.keys(faces).forEach(c => { if (!r.codes.includes(c)) { delete faces[c]; changed = true; } });
    if (changed) saveFaces();
    // 裝飾：用到雲端硬碟的配件就一起下載圖片
    if (r.deco && JSON.stringify(r.deco) !== JSON.stringify(decos)) {
      decos = r.deco; store.set(K.decos, decos); changed = true;
      if (Object.values(decos).flat().some(l => l.acc.startsWith('d:') && !accImg[l.acc])) await A.loadAccImages().catch(() => {});
    }
    if (r.fireworks?.length) A.emit('fireworks', r.fireworks);
    await catalogP;
    return changed;
  }
  let facesLoaded = 0;
  A.ensureFaces = force => {
    if (!force && Date.now() - facesLoaded < 10 * 60e3) return;
    facesLoaded = Date.now();
    Promise.all([loadFaces(), loadChart()]).then(c => { if (c.some(Boolean)) A.emit('faces'); }).catch(() => { facesLoaded = 0; });
  };
  async function refreshData() {
    try {
      const jobs = [loadChart(), loadSel(true)];
      if (Date.now() - facesLoaded > 10 * 60e3) jobs.push(loadFaces().then(c => { facesLoaded = Date.now(); return c; }).catch(() => false));
      const res = await Promise.all(jobs);
      // 第一次使用、座位表還是空的：自動套用預設座位
      if (A.isTeacher() && !Object.keys(chart).length && !store.get(K.defaulted, false) && !live?.started) {
        await applyDefault(false);
        toast('已套用預設座位');
      } else if (res.some(Boolean)) renderAll();
    } catch (err) { toast('座位資料讀取失敗：' + err.message); }
    schedulePoll();
  }

  // 選位進行中：老師每 3 秒、學生每 4 秒更新；平常每 20 秒
  let pollTimer;
  function schedulePoll() {
    clearTimeout(pollTimer);
    if (!A.started() || A.currentTab() !== 'seats' || document.hidden) return;
    const fast = selLive() && (A.isStudent() || sub === 'sel');
    pollTimer = setTimeout(async () => {
      try { if (await loadSel()) renderAll(); } catch { /* 下次再試 */ }
      schedulePoll();
    }, fast ? (A.isStudent() ? 4000 : 3000) : 20000);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && A.started() && A.currentTab() === 'seats') refreshData(); });

  // 倒數計時
  let tickPolled = false;
  setInterval(() => {
    const els = document.querySelectorAll('#tab-seats .cd');
    els.forEach(el => {
      const left = Math.max(0, Math.ceil((+el.dataset.dl - (Date.now() + selSkew)) / 1000));
      el.textContent = fmtSec(left);
      el.classList.toggle('urgent', left <= 10);
      if (left === 0 && !tickPolled) {
        tickPolled = true;
        setTimeout(() => loadSel().then(c => c && renderAll()).catch(() => {}).finally(() => { tickPolled = false; }), 1200);
      }
    });
  }, 500);

  A.tabHooks.seats = () => {
    if (A.isStudent() || A.isTeacher() || A.isStaff()) renderAll();
    refreshData();
  };
  A.on('students', () => { if (A.currentTab() === 'seats' && (sub === 'chart' || sub === 'swap')) renderPanel(); });

  // ── 點大頭照放大，再點一次（或點任何地方）關閉 ──
  function zoomFace(id) {
    const z = $('#faceZoom');
    const k = inSel() ? takenOf()[id] : chart[id];
    if (!z.hidden && z.dataset.seat === id) { z.hidden = true; return; }
    if (!k) { z.hidden = true; return toast(`${seatName(id)}：空位`); }
    const { code, name } = parseKey(k);
    z.dataset.seat = id;
    z.innerHTML = `<div class="fz-card"><span class="fz-face">${faceHtml(k)}</span><div class="fz-name"><b>${esc(code.replace(/(\d+)$/, ' $1'))}</b> ${esc(name)}</div><div class="muted small">${seatName(id)}</div></div>`;
    z.hidden = false;
  }
  $('#faceZoom').addEventListener('click', () => { $('#faceZoom').hidden = true; });

  // 抽籤後在座位表上標示
  let hlTimer;
  A.highlightSeats = keys => {
    highlight = new Set(keys);
    if (!keys.some(k => seatOf(k))) toast('座位表上還沒有這些同學');
    sub = 'chart'; store.set(K.sub, sub);
    A.showTab('seats');
    setTimeout(() => map.el.querySelector('.seat.hl')?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }), 150);
    clearTimeout(hlTimer);
    hlTimer = setTimeout(() => { highlight.clear(); if (A.currentTab() === 'seats') A.renderMap('seats'); }, 20000);
  };

  // ── 測試模式：在手機上模擬雲端的選位（使用示範名單） ──
  const TEST_ME = '料05鄒○軒';
  const botsOn = () => store.get(K.bots, true);
  function runBots(S, now) {
    if (!botsOn()) return;
    for (let n = 0; n < 60 && S.status === 'open' && S.waiting && S.waiting !== TEST_ME && now - S.turnAt >= 1500; n++) {
      const f = SelEngine.freeSeats(S);
      if (!f.length) break;
      SelEngine.pick(S, S.waiting, f[Math.floor(Math.random() * f.length)], S.turnAt + 1500);
    }
  }
  function demoLoad(old, p, now) {
    const order = [...A.DEMO_STUDENTS].sort(() => Math.random() - 0.5);
    const ranks = Object.fromEntries(order.map((k, i) => [k, i + 1]));
    const S = SelEngine.create({ v: old.v, now, seats: p.seats, perTurn: p.perTurn, maxWishes: p.maxWishes, order, ranks, blocked: old.blocked, source: '第一次段考排名（測試・隨機產生）' });
    // 一半的示範同學先填好志願，示範自動分配
    order.forEach((k, i) => {
      if (k === TEST_ME || i % 2 || !S.maxWishes) return;
      S.wishes[k] = [...p.seats].sort(() => Math.random() - 0.5).slice(0, Math.min(3, S.maxWishes));
    });
    return S;
  }
  A.testSeatApi = async (action, p = {}) => {
    const now = Date.now();
    let S = store.get(K.testSel, null) || { v: 0, status: 'idle' };
    const before = JSON.stringify(S);
    if (S.status && S.status !== 'idle') { SelEngine.tick(S, now); runBots(S, now); SelEngine.tick(S, now); }
    const me = A.isStudent() ? A.me() : '';
    let extra = {};
    switch (action) {
      case 'stuLogin': return { ok: true, sid: 'test', me: TEST_ME, className: '商一甲' };
      case 'getSeats': return { ok: true, seats: store.get(K.testChart, {}) };
      case 'saveSeats': store.set(K.testChart, p.seats); return { ok: true, seats: p.seats };
      case 'getFaces': return { ok: true, faces: {}, codes: Object.keys(faces) };
      case 'uploadFace': return { ok: true, t: now };
      case 'setFaceFolder': throw new Error('測試模式不會連結雲端硬碟；正式使用時才會讀取資料夾裡的照片');
      case 'selState': case 'stuState': break;
      case 'selLoad': S = demoLoad(S, p, now); break;
      case 'selCmd':
        if (p.cmd === 'reset') S = { v: S.v, status: 'idle' };
        else if (p.cmd === 'apply') {
          const seats = {};
          Object.keys(S.picks).forEach(k => { seats[S.picks[k]] = k; });
          store.set(K.testChart, seats);
          S.applied = true;
          extra = { seats };
        } else SelEngine.command(S, p.cmd, now);
        break;
      case 'selAssign': SelEngine.assign(S, p.key, p.seat, now); break;
      case 'selBlock': SelEngine.block(S, p.seat); break;
      case 'stuWish': SelEngine.setWishes(S, me, p.wishes); break;
      case 'stuPick': SelEngine.pick(S, me, p.seat, now); break;
      default: return null;
    }
    if (JSON.stringify(S) !== before) { S.v = (S.v || 0) + 1; store.set(K.testSel, S); }
    if (p.v && p.v === S.v) return { ok: true, same: true, now };
    return { ok: true, now, sel: A.isStudent() ? SelEngine.view(S, me, now) : S, ...extra };
  };
})();
