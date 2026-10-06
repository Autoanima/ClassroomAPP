'use strict';
/* 座位：座位表（座號、姓名、大頭照）＋ 線上選位（依段考名次） */
(() => {
  const A = window.App, D = A.D;
  const { $, esc, toast, store } = A;
  const K = {
    chart: 'indoor.chart.v1' + A.SFX, faces: 'indoor.faces.v1' + A.SFX, sub: 'indoor.seatsub.v1',
    testSel: 'indoor.testsel.v1.test', testChart: 'indoor.testchart.v1.test', bots: 'indoor.bots.v1.test',
    live: 'indoor.live.v1' + A.SFX, backup: 'indoor.chartbak.v1' + A.SFX, defaulted: 'indoor.defaulted.v1' + A.SFX,
    decos: 'indoor.decos.v1' + A.SFX, acc: 'indoor.accimg.v1' + A.SFX, wx: 'indoor.weather.v1' + A.SFX, def: 'indoor.defseats.v1' + A.SFX,
  };
  const HOW = { wish: '志願', self: '自選', teacher: '老師指定', auto: '系統分配' };
  const STATUS = { idle: '沒有進行選位', ready: '準備中（可預選志願）', open: '選位中', paused: '暫停中', done: '選位結束' };

  let chart = store.get(K.chart, {});   // 座位代號 → 同學（畫面上的，可能是還沒存的草稿）
  // 已儲存的座位表：導師改座位只是「草稿」，變動的座位變紅色；按「把目前座位存成預設」才會存，切換畫面就恢復
  let saved = { ...chart };
  const sameSeats = (a, b) => { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); return [...ks].every(k => (a[k] || '') === (b[k] || '')); };
  const dirty = () => !sameSeats(chart, saved);
  let faces = store.get(K.faces, {});   // 座號（料05）→ { t, d }
  let sel = null, selSkew = 0;          // 選位狀態（老師：完整；學生：只含自己的資料）
  let sub = store.get(K.sub, 'chart');  // 老師看「座位表」「現場選位」或「線上選位」
  let live = store.get(K.live, null);   // 現場選位：{ source, order, idx, hist, started, miss, absent }
  let picked = null;                    // 座位表點選：{ seat } 或 { key }（還沒有座位的同學）
  let highlight = new Set(), popSeats = new Set();
  let savingWishes = false;

  // 非導師的「交換位置」：只有用了交換位置卡（card）時，才能把「自己」和一位同學對調
  let card = 0;
  const trialOn = () => sub === 'swap' && !A.isTeacher();
  const cur = () => chart;
  const canLive = () => A.isTeacher() || (!A.isStudent() && A.jobsOf(A.me() || '').roles.some(r => /^副?班長$/.test(r)));
  const selLive = () => !!sel && ['ready', 'open', 'paused'].includes(sel.status);
  const inSel = () => trialOn() ? false : (A.isStudent() ? !!sel && (selLive() || (sel.status === 'done' && !sel.applied)) : sub === 'sel' && !!sel && sel.status !== 'idle');
  const takenOf = () => (!sel || sel.status === 'idle' ? {} : sel.taken || SelEngine.taken(sel));
  const seatById = Object.fromEntries(D.seats.map(s => [s.id, s]));
  const seatName = id => (seatById[id] ? `第${seatById[id].col}排第${seatById[id].row}個` : id);
  const seatOf = k => Object.keys(chart).find(id => chart[id] === k) || '';
  const fmtSec = s => `${Math.floor(s / 60)}:${A.pad2(s % 60)}`;

  function parseKey(k) {
    const m = String(k || '').match(/^(\D*?)(\d+)(.*)$/);
    if (m) return { code: m[1] + A.pad2(+m[2]), name: m[3] };
    return k ? { code: 'T00', name: String(k) } : { code: '', name: '' }; // 沒有座號的只有導師
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
  let weather = store.get(K.wx, []);     // 小太陽卡／小雨傘卡：[{ kind, to, by, exp }]
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
  // want：只下載這幾張（每次 4 張，下載好一批就先顯示，失敗的再試一次）
  A.loadAccImages = async (want, onBatch) => {
    if (want?.length) {
      let changed = false;
      for (let i = 0; i < want.length; i += 4) {
        const part = want.slice(i, i + 4), have = Object.fromEntries(Object.entries(accImg).map(([id, x]) => [id, x.t]));
        let r = null;
        for (let k = 0; k < 2 && !r; k++) { try { r = await A.api('accImages', { have, want: part }); } catch { /* 再試一次 */ } }
        if (!r) continue;
        Object.entries(r.images || {}).forEach(([id, x]) => { accImg[id] = x; changed = true; });
        if (changed) { store.set(K.acc, accImg); onBatch?.(); }
      }
      return changed;
    }
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
    } else k = cur()[s.id];
    if (!k) return `<span class="sid">${s.id}</span>${extra}`;
    const { code, name } = parseKey(k);
    // 小太陽（左上角）、小雨傘（右上角）：放在這位同學座位的上方，不會蓋到別人
    const today = A.fmtDate(new Date());
    const wx = weather.filter(w => w.to === k && w.exp >= today);
    const wxHtml = ['sun', 'rain'].filter(t => wx.some(w => w.kind === t)).map(t => `<span class="wx wx-${t}" title="${esc(wx.filter(w => w.kind === t).map(w => w.by).join('、'))}">${t === 'sun' ? '☀️' : '☂️'}</span>`).join('');
    // 大頭照滿版，底下兩行小字：組別 座號／姓名
    // 擂台賽：皇冠／昏頭放在名字右邊（不蓋到大頭照；一天）
    return `<span class="photo${A.arenaLost?.(k) ? ' ar-lost' : ''}">${faceHtml(k)}</span>${wxHtml}<span class="sn"><b>${esc(code.replace(/(\d+)$/, ' $1'))}</b><span class="sn-name">${esc(name)}${A.arenaBadges?.(k) || ''}</span></span>${extra}`;
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
      k = cur()[s.id];
      if (liveRunning() && !k) c.push('free');
    }
    if (sub === 'swap' && picked?.seat === s.id) c.push('picked');
    if (!inSel() && (chart[s.id] || '') !== (saved[s.id] || '')) c.push('changed');
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
    if (A.isStudent()) {
      if (!['chart', 'swap'].includes(sub)) sub = 'chart';
      h += `<div class="subsw" role="tablist">
        <button type="button" data-sub="chart" aria-selected="${sub === 'chart'}">📋 座位表${selLive() ? '<span class="live-dot" title="選位進行中"></span>' : ''}</button>
        <button type="button" data-sub="swap" aria-selected="${sub === 'swap'}">🔁 交換位置</button>
      </div>`;
      h += sub === 'swap' ? swapBanner() : studentBanner();
    } else {
      if (sub === 'live' && !canLive()) sub = 'chart';
      if (A.isGuest()) sub = 'chart'; // 任課老師：只看座位表
      if (!A.isGuest()) h += `<div class="subsw" role="tablist">
        <button type="button" data-sub="chart" aria-selected="${sub === 'chart'}">📋 座位表</button>
        ${canLive() ? `<button type="button" data-sub="live" aria-selected="${sub === 'live'}">🎯 現場選位${live?.started && live.idx < live.order.length ? '<span class="live-dot"></span>' : ''}</button>` : ''}
        <button type="button" data-sub="sel" aria-selected="${sub === 'sel'}">🗳 線上選位${selLive() ? '<span class="live-dot" title="選位進行中"></span>' : ''}</button>
        <button type="button" data-sub="swap" aria-selected="${sub === 'swap'}">🔁 交換位置</button>
      </div>`;
      if (sub === 'swap') h += A.isTeacher() ? `<p class="muted small tip">💡 點一個座位、再點另一個座位，兩人就互換；點空位就是搬過去。</p>` : swapBanner();
      if (sub === 'sel' && sel && sel.status !== 'idle') h += teacherBanner();
      if (canLive() && dirty()) {
        const n = Object.keys({ ...chart, ...saved }).filter(k => (chart[k] || '') !== (saved[k] || '')).length;
        h += `<div class="banner draft"><div class="bn-main">⚠ 有 ${n} 個座位變動（紅色）還沒儲存</div>
          <div class="bn-sub">切換畫面就會恢復原本的座位。<span class="draft-btns"><button type="button" class="btn btn--primary" data-tr="commit">💾 存成預設</button><button type="button" class="btn" data-tr="discard">↺ 取消變動</button></span></div></div>`;
      }
    }
    root.innerHTML = h;
  }
  // 非導師的交換位置：試用提示，或交換位置卡
  function swapBanner() {
    if (card) {
      return `<div class="banner myturn"><div class="bn-main">🔀 交換位置卡：點一位同學的座位，和你對調</div>
        <div class="bn-sub">${card === 'free' ? '使用 1 張你手上的交換位置卡（別人送的或段考獎勵），不扣點數' : `對調後會扣 ${card} 點`}，並且真的儲存。<button type="button" class="link-btn" data-tr="cancelCard">取消</button></div></div>`;
    }
    return `<div class="banner warn"><div class="bn-main">🔒 要使用「交換位置卡」才能換座位</div>
      <div class="bn-sub">交換位置卡可以讓你和一位同學對調座位（只能是你自己和別人對調）。
        <button type="button" class="link-btn" data-tr="shop">🛍 到商店</button></div></div>`;
  }
  // 商店按「交換位置卡」→ 到這裡點同學的座位
  A.useSwapCard = price => {
    card = price === 0 ? 'free' : price || 20;
    sub = 'swap'; store.set(K.sub, sub);
    picked = null;
    A.showTab('seats');
    toast('🔀 點一位同學的座位，和你對調');
  };
  async function cardTap(id) {
    const me = A.me(), k = chart[id], mine = seatOf(me);
    if (!mine) { card = 0; renderAll(); return toast('你還沒有座位，不能用交換位置卡'); }
    if (!k || k === me) return toast('請點另一位同學的座位');
    if (!await A.ask(`${card === 'free' ? '用 1 張免費交換位置卡' : `花 ${card} 點`}，和 ${k} 對調座位？\n（${seatName(mine)} ⇄ ${seatName(id)}）`, '對調！', true)) return;
    try {
      await A.api('swapSeatCard', { to: k });
      card = 0;
      popSeats.add(id); popSeats.add(mine);
      await loadChart();
      toast(`🔀 已和 ${k} 對調座位！`);
    } catch (err) { toast(err.message); }
    renderAll();
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

  // 切換畫面時：沒有存成預設的變動全部取消，恢復成已儲存的座位
  function discardDraft(quiet) {
    if (!dirty()) return false;
    chart = { ...saved }; picked = null;
    if (live?.started) { Object.assign(live, { started: false, idx: 0, hist: [] }); saveLive(); }
    if (!quiet) toast('座位的變動沒有存成預設，已恢復原本的座位');
    return true;
  }
  A.discardSeatDraft = discardDraft;
  async function commitDraft(b) {
    const n = Object.keys(chart).length;
    if (!n) return toast('座位表是空的，沒有東西可以存');
    if (!await A.ask(`把目前的座位表（${n} 人）存起來，並設為預設座位？\n紅色的座位變動會正式生效。`, '存成預設')) return;
    const seats = Object.fromEntries(Object.entries(chart).map(([id, k]) => [id, parseKey(k).code]));
    if (b) b.disabled = true;
    try {
      await A.api('saveSeats', { seats: chart });
      const r = await A.api('saveDefaultSeats', { seats });
      savedDef = r.defaults || seats; store.set(K.def, savedDef);
      saved = { ...chart }; store.set(K.chart, chart);
      toast(`✓ 已儲存座位（${n} 人）並設為預設`);
    } catch (err) { toast('儲存失敗：' + err.message); }
    if (b) b.disabled = false;
    renderAll();
  }
  $('#seatTop').addEventListener('click', e => {
    const tr = e.target.closest('[data-tr]');
    if (tr) {
      if (tr.dataset.tr === 'shop') return A.showTab('shop');
      if (tr.dataset.tr === 'commit') return commitDraft(tr);
      if (tr.dataset.tr === 'discard') { discardDraft(true); toast('已取消變動'); renderAll(); return; }
      if (tr.dataset.tr === 'cancelCard') card = 0;
      picked = null; renderAll(); return;
    }
    const s = e.target.closest('[data-sub]');
    if (s) {
      if (s.dataset.sub !== sub) discardDraft();
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
    if (sub === 'swap' && !A.isTeacher()) { root.innerHTML = ''; return; }
    if (A.isStudent()) { root.innerHTML = legendHtml() + (inSel() ? '' : rankExplainHtml()); return; }
    if (sub === 'chart') { root.innerHTML = chartViewPanel() + rankExplainHtml(); return; }
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

  // ── 班名次怎麼算：放在座位表下方，全班都看得到 ──
  let rankInfo = null, rankInfoAt = 0;
  function loadRankInfo() {
    if (Date.now() - rankInfoAt < 5 * 60e3) return;
    rankInfoAt = Date.now();
    A.api('rankInfo').then(r => { rankInfo = r; if (A.currentTab() === 'seats') renderPanel(); }).catch(() => { rankInfoAt = 0; });
  }
  function rankExplainHtml() {
    loadRankInfo();
    const w = rankInfo?.weight ?? 1;
    return `<details class="panel rank-explain"${store.get('indoor.rankopen', false) ? ' open' : ''}><summary><b>📊 班名次是怎麼算的？</b></summary>
      <ol class="small">
        <li><b>科內排名</b>：每次段考，多媒科只和多媒科比、資料科只和資料科比（兩科考的科目不一樣）。</li>
        <li><b>換成百分比</b>：百分比＝科內名次 ÷ 該科人數，越小越前面。例如 18 人中第 3 名＝16.7%。</li>
        <li><b>加上這段期間的加扣分</b>：綜合分數＝（100 − 百分比）＋ 加扣分 × ${esc(String(w))}。<br>加分 1 分≈往前 ${esc(String(w))} 個百分點；被扣分就往後。</li>
        <li><b>依綜合分數排出班名次</b>（高的在前面）。</li>
      </ol>
      <p class="small"><b>期間怎麼分？</b>第一次段考的班名次算「開學～第一次段考排名公布」這段時間的加扣分；公布之後的加扣分，算到第二次段考；第二次公布後，再算到第三次。</p>
      <p class="small"><b>用在哪裡？</b>線上選位、現場選位的順序，以及前五名的免費交換位置卡。</p>
      ${rankInfo?.url ? `<div class="actions"><a class="btn wide" href="${esc(rankInfo.url)}" target="_blank" rel="noopener">📄 查看班名次試算表（唯讀）</a></div>` : '<p class="muted small">班名次試算表會在導師公布段考排名後出現。</p>'}
    </details>`;
  }
  $('#seatPanel').addEventListener('toggle', e => { if (e.target.classList?.contains('rank-explain')) store.set('indoor.rankopen', e.target.open); }, true);

  // 座位表（只看）：人數與還沒有座位的同學
  function chartViewPanel() {
    const list = A.students();
    const seated = new Set(Object.values(chart));
    const none = list.filter(n => !seated.has(n));
    return `<div class="panel"><div class="panel-row"><b>${seated.size} 人</b>${list.length ? `／全班 ${list.length} 人` : ''}${A.isTeacher() ? '　<span class="muted small">要換位置請到「🔁 交換位置」</span>' : ''}</div>
      ${none.length && A.isTeacher() ? `<div class="panel-row small">還沒有座位：${none.map(esc).join('、')}</div>` : ''}
      ${A.isTeacher() ? `<div class="actions"><button type="button" class="btn wide" data-sa="pdf">🖨 輸出白底座位表 PDF</button></div>` : ''}</div>`;
  }

  // ── 🖨 白底座位表 PDF：只留教室配置、大頭照、座號、姓名、講台、講桌（不含裝扮、寵物）；下方列出班級幹部（小老師除外）──
  const ROLE_ORDER = ['班長', '副班長', '風紀', '學藝', '總務', '衛生', '環保', '康樂', '體育', '資訊', '輔導', '節能', '服務', '事務'];
  // 班級幹部（小老師除外）：直接用「幹部名單」；沒有的話用每位同學的職位、再沒有就用工作分配裡的幹部欄位
  const DEPT_FULL = { 料: '資料科', 多: '多媒科' };
  function cadreRows() {
    const R = A.roster() || {}, pairs = [];
    if (R.cadres) Object.entries(R.cadres).forEach(([k, roles]) => (roles || []).forEach(r => pairs.push([String(r).trim(), k])));
    if (!pairs.length) A.students().forEach(k => (A.jobsOf(k).roles || []).forEach(r => pairs.push([String(r).trim(), k])));
    if (!pairs.length) [...(D.inspectorSlots || []), ...(D.cadreSlots || [])].forEach(sl => { const k = R.inspectors?.[sl.id]; if (k) pairs.push([sl.short === '環保' ? '衛生股長' : sl.short || sl.label, k]); });
    const seen = new Set(), rank = r => { const i = ROLE_ORDER.findIndex(x => r.startsWith(x)); return i < 0 ? 99 : i; };
    return pairs.filter(([r, k]) => r && k && !/小老師/.test(r) && !seen.has(r + '|' + k) && seen.add(r + '|' + k))
      .sort((x, y) => rank(x[0]) - rank(y[0]) || x[0].localeCompare(y[0]) || parseKey(x[1]).code.localeCompare(parseKey(y[1]).code))
      .map(([role, k]) => { const p = parseKey(k), m = p.code.match(/^(\D*)(\d+)$/) || ['', p.code, '']; return { role, dept: DEPT_FULL[m[1]] || m[1], no: m[2], name: p.name }; });
  }
  let jspdfP = null;
  const loadJsPdf = () => jspdfP ||= new Promise((res, rej) => {
    if (window.jspdf) return res(window.jspdf);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => (window.jspdf ? res(window.jspdf) : rej(new Error('PDF 元件載入失敗')));
    s.onerror = () => { jspdfP = null; rej(new Error('PDF 元件載入失敗，請檢查網路')); };
    document.head.appendChild(s);
  });
  const loadImg = src => new Promise(res => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  async function seatPdf(b) {
    const mapEl = map.el;
    if (!mapEl?.children.length) return toast('座位表還沒有顯示出來');
    b.disabled = true; const old = b.textContent; b.textContent = '產生中…';
    try {
      const FONT = "'Noto Sans TC','Microsoft JhengHei','PingFang TC','Heiti TC',sans-serif";
      const W = 2100, H = 2970, M = 110;   // A4 直式
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      g.textBaseline = 'middle';
      // 不放標題；地圖只畫有座位的範圍（講台拿掉），下面空出來放班級幹部
      const cls = A.roster()?.jobs?.CLASS?.[0] || '';
      const cad = cadreRows(), TC = cad.length > 6 ? 2 : 1, perCol = Math.ceil(cad.length / TC), RH = 58;
      const cadH = cad.length ? 90 + (perCol + 1) * RH : 0;
      const kids = [...mapEl.children], pct = v => parseFloat(v) / 100;
      const isStage = el => el.classList.contains('it') && el.querySelector('.lbl')?.textContent.trim() === '講台';
      const keepEl = el => !isStage(el) && !el.classList.contains('d');   // 教室外框、黑板邊另外畫
      const ys = kids.filter(keepEl).map(el => [pct(el.style.top), pct(el.style.top) + pct(el.style.height)]);
      const cy0 = Math.max(0, Math.min(...ys.map(y => y[0])) - 0.012), cy1 = Math.min(1, Math.max(...ys.map(y => y[1])) + 0.012);
      const mw = mapEl.offsetWidth, mh = mapEl.offsetHeight * (cy1 - cy0);
      const top = M, maxW = W - 2 * M, maxH = H - top - cadH - M - 30;
      const sc = Math.min(maxW / mw, maxH / mh), bw = mw * sc, bh = mh * sc, bx = (W - bw) / 2, by = top;
      const fullH = mapEl.offsetHeight * sc;
      const box = el => { const st = el.style; return { x: bx + pct(st.left) * bw, y: by + (pct(st.top) - cy0) * fullH, w: pct(st.width) * bw, h: pct(st.height) * fullH }; };
      const rrect = (r, rad) => { g.beginPath(); g.roundRect ? g.roundRect(r.x, r.y, r.w, r.h, rad) : g.rect(r.x, r.y, r.w, r.h); };
      // 教室外框（只畫裁切後的範圍）
      const room = kids.find(el => el.classList.contains('d--room'));
      if (room) { const r = box(room), y0 = Math.max(r.y, by), y1 = Math.min(r.y + r.h, by + bh); g.strokeStyle = '#555'; g.lineWidth = 4; g.strokeRect(r.x, y0, r.w, y1 - y0); }
      // 講桌、前後門（講台不畫）
      kids.filter(el => el.classList.contains('it') && !isStage(el)).forEach(el => {
        const r = box(el), lbl = el.querySelector('.lbl')?.textContent.trim() || '';
        const door = /door/.test(el.className), desk = el.classList.contains('desk');
        g.fillStyle = door ? '#f2f2f2' : '#fff'; g.strokeStyle = door ? '#999' : '#444'; g.lineWidth = desk ? 4 : 3;
        rrect(r, 8); g.fill(); g.stroke();
        g.fillStyle = '#222'; g.textAlign = 'center';
        if (el.querySelector('.lbl.v') || r.h > r.w * 1.6) {   // 直排（前門、後門）
          const fs = Math.min(r.w * 0.55, 34); g.font = `700 ${fs}px ${FONT}`;
          [...lbl].forEach((ch, i, a) => g.fillText(ch, r.x + r.w / 2, r.y + r.h / 2 + (i - (a.length - 1) / 2) * fs * 1.15));
        } else {
          g.font = `700 ${Math.min(r.h * 0.5, 44)}px ${FONT}`;
          g.fillText(lbl, r.x + r.w / 2, r.y + r.h / 2);
        }
      });
      kids.filter(el => el.classList.contains('collbl')).forEach(el => {
        const r = box(el); g.fillStyle = '#777'; g.textAlign = 'center'; g.font = `500 ${Math.min(r.h * 0.75, 30)}px ${FONT}`;
        g.fillText(el.textContent.trim(), r.x + r.w / 2, r.y + r.h / 2);
      });
      // 座位：大頭照＋座號＋姓名
      const seats = kids.filter(el => el.classList.contains('seat'));
      const imgs = await Promise.all(seats.map(el => { const k = cur()[el.dataset.seat]; return loadImg(k ? faces[parseKey(k).code]?.d : ''); }));
      seats.forEach((el, i) => {
        const r = box(el), k = cur()[el.dataset.seat];
        g.lineWidth = 2; g.strokeStyle = '#999'; rrect(r, 10); g.fillStyle = '#fff'; g.fill(); g.stroke();
        g.textAlign = 'center';
        if (!k) { g.fillStyle = '#bbb'; g.font = `400 ${r.w * 0.16}px ${FONT}`; g.fillText(el.dataset.seat, r.x + r.w / 2, r.y + r.h / 2); return; }
        const { code, name } = parseKey(k), pad = r.w * 0.06, txtH = r.h * 0.27;
        const ph = { x: r.x + pad, y: r.y + pad, w: r.w - 2 * pad, h: r.h - txtH - pad };
        const im = imgs[i];
        g.save(); rrect(ph, 8); g.clip();
        if (im) {   // 置中裁切（cover）
          const s2 = Math.max(ph.w / im.width, ph.h / im.height), dw = im.width * s2, dh = im.height * s2;
          g.drawImage(im, ph.x + (ph.w - dw) / 2, ph.y + (ph.h - dh) * 0.25, dw, dh);
        } else {
          g.fillStyle = '#eee'; g.fillRect(ph.x, ph.y, ph.w, ph.h);
          g.fillStyle = '#999'; g.font = `700 ${ph.w * 0.4}px ${FONT}`; g.fillText((name || code).slice(0, 1), ph.x + ph.w / 2, ph.y + ph.h / 2);
        }
        g.restore();
        const fit = (t, fs, wt) => { g.font = `${wt} ${fs}px ${FONT}`; while (fs > 10 && g.measureText(t).width > r.w - 2 * pad) { fs -= 1; g.font = `${wt} ${fs}px ${FONT}`; } };
        g.fillStyle = '#111'; fit(code.replace(/(\d+)$/, ' $1'), r.w * 0.17, 700); g.fillText(code.replace(/(\d+)$/, ' $1'), r.x + r.w / 2, r.y + r.h - txtH * 0.68);
        g.fillStyle = '#333'; fit(name, r.w * 0.17, 500); g.fillText(name, r.x + r.w / 2, r.y + r.h - txtH * 0.25);
      });
      // 班級幹部表：職稱｜組別｜座號｜姓名（人多就分左右兩欄）
      if (cad.length) {
        let y = by + bh + 60;
        g.textAlign = 'left'; g.fillStyle = '#111'; g.font = `700 40px ${FONT}`; g.fillText('班級幹部', M, y);
        y += 46;
        const gap = 50, tw = (W - 2 * M - gap * (TC - 1)) / TC, cols = [['職稱', 0.34], ['組別', 0.24], ['座號', 0.16], ['姓名', 0.26]];
        for (let c = 0; c < TC; c++) {
          const x0 = M + c * (tw + gap), list = cad.slice(c * perCol, (c + 1) * perCol);
          const row = (vals, yy, head) => {
            if (head) { g.fillStyle = '#f1f3f5'; g.fillRect(x0, yy, tw, RH); }
            let x = x0;
            vals.forEach((v, i) => {
              const w = cols[i][1] * tw; g.fillStyle = head ? '#555' : '#111'; g.textAlign = 'left';
              let fs = head ? 28 : 32; g.font = `${head || i === 0 ? 700 : 500} ${fs}px ${FONT}`;
              while (fs > 16 && g.measureText(v).width > w - 24) { fs--; g.font = `${head || i === 0 ? 700 : 500} ${fs}px ${FONT}`; }
              g.fillText(v, x + 12, yy + RH / 2); x += w;
            });
            g.strokeStyle = '#ccc'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, yy + RH); g.lineTo(x0 + tw, yy + RH); g.stroke();
          };
          row(cols.map(x => x[0]), y, true);
          list.forEach((r, i) => row([r.role, r.dept, r.no, r.name], y + (i + 1) * RH));
        }
      }
      const { jsPDF } = await loadJsPdf();
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
      pdf.save(`${cls || '班級'}座位表_${A.fmtDate(new Date()).replace(/\//g, '')}.pdf`);
      toast('✓ 已輸出座位表 PDF');
    } catch (err) { toast('PDF 產生失敗：' + err.message); }
    b.disabled = false; b.textContent = old;
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
        <button type="button" class="btn${dirty() ? ' btn--primary' : ''}" data-sa="saveDefault">💾 把目前座位存成預設</button>
        <button type="button" class="btn btn--danger" data-sa="clear">清空座位表</button>
        ${bak ? `<button type="button" class="btn wide" data-sa="restore">↶ 還原到現場選位前的座位表</button>` : ''}</div>
        <details class="field"><summary><b>📁 大頭照資料夾</b></summary>
          <p class="small">貼上 Google 雲端硬碟資料夾的連結。照片檔名用「組別座號姓名」，例如 <code>料 24 王小明.jpg</code>、<code>多 11 陳小華.jpg</code>，會自動放到對應同學的座位。</p>
          <input type="url" id="faceUrl" placeholder="https://drive.google.com/drive/folders/…" autocomplete="off">
          <div class="actions"><button type="button" class="btn btn--primary wide" data-sa="faceFolder">連結並讀取大頭照</button>
            <button type="button" class="btn wide" data-sa="faceCheck">🔍 檢查大頭照（重新從雲端讀取）</button></div>
          <p id="faceMsg" class="small muted">目前有照片的同學：${list.filter(k => faces[parseKey(k).code]).length} / ${list.length} 人</p>
        </details>`;
    }
    return h + `</div>`;
  }

  // ── 下方浮動列：座位表點選中／現場選位輪到誰 ──
  function renderBar() {
    const bar = $('#swapBar');
    let h = '';
    if (sub === 'swap' && picked && A.isTeacher()) {
      const k = picked.key || cur()[picked.seat];
      const what = picked.key ? `${esc(k)}（還沒有座位）` : `${picked.seat}　${k ? esc(k) : '空位'}`;
      const job = k ? A.jobsOf(k).jobs.join('、') : '';
      h = `${k ? `<span class="face">${faceHtml(k)}</span>` : ''}<div class="sb-text"><b>已選：${what}</b>${job ? `<span class="sb-job">🧹 ${esc(job)}</span>` : ''}<span>${picked.key ? '點一個座位放進去' : '再點另一個座位 → 互換；點空位 → 搬過去'}</span></div>
        ${A.isTeacher() && picked.seat && k ? `<button type="button" class="btn" data-pk="info">詳細</button>` : ''}${A.isTeacher() && picked.seat ? `<button type="button" class="btn" data-pk="edit">✏️</button>` : ''}<button type="button" class="btn" data-pk="cancel">取消</button>`;
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
    const C = cur();
    if (picked.key) {
      const k = picked.key, old = C[id];
      const at = Object.keys(C).find(x => C[x] === k);
      if (at) { if (old) C[at] = old; else delete C[at]; } else if (old) toast(`${old} 移到「還沒有座位」`);
      C[id] = k;
      popSeats.add(id);
    } else {
      const a = picked.seat, ka = C[a], kb = C[id];
      if (!ka && !kb) { picked = { seat: id }; renderAll(); return; }
      if (kb) C[a] = kb; else delete C[a];
      if (ka) C[id] = ka; else delete C[id];
      popSeats.add(a); popSeats.add(id);
    }
    picked = null;
    saveChart(true);
  }

  // 預設座位（只存座號，用名單換成姓名）
  // 導師存過的預設座位（座位 → 座號）；沒有存過就用網站內建的
  let savedDef = store.get(K.def, null);
  function defaultChart() {
    const list = A.students();
    const byCode = Object.fromEntries(list.map(k => [parseKey(k).code, k]));
    const out = {};
    if (savedDef && Object.keys(savedDef).length) {
      Object.entries(savedDef).forEach(([id, c]) => { const k = byCode[parseKey(c).code]; if (k && seatById[id]) out[id] = k; });
      return out;
    }
    Object.entries(D.defaultSeats || {}).forEach(([col, codes]) => codes.forEach((c, i) => {
      const k = byCode[parseKey(c).code];
      if (k && seatById[`${col}-${i + 1}`]) out[`${col}-${i + 1}`] = k;
    }));
    return out;
  }
  // 還沒有座位的同學，如果他的預設座位是空的，就自動放回去（例如座號改過：羅偲倚改為多08）
  function healChart() {
    if (!A.students().length || !Object.keys(chart).length) return false;
    const seated = new Set(Object.values(chart));
    const def = defaultChart();
    let n = 0;
    Object.entries(def).forEach(([id, k]) => { if (!chart[id] && !seated.has(k)) { chart[id] = k; seated.add(k); n++; } });
    if (n) saveChart(true, true);
    return n > 0;
  }
  async function applyDefault(ask) {
    // 先抓最新的名單（座號可能改過，例如羅偲倚改為多08），抓不到才用手機上的
    try { await A.loadStudents(); } catch (e) { if (!A.students().length) return toast('無法讀取名單：' + e.message); }
    if (ask && Object.keys(chart).length && !await A.ask('恢復成預設座位？目前的座位表會被取代。', '恢復預設')) return;
    chart = defaultChart();
    store.set(K.defaulted, true);
    saveChart(!ask, !ask); // 按按鈕恢復預設＝草稿；第一次自動套用＝直接存
  }

  // ── 🎯 現場選位：依上傳名單的順序，一位一位點座位 ──
  function livePanel() {
    let h = `<div class="panel">`;
    const L = live;
    if (!L || !L.order?.length) {
      h += `<h3>🎯 依段考班名次現場選位</h3>
        <p class="small">依「段考排名」的班名次（段考表現＋那段期間的加扣分）排順序，第 1 名先選。</p>
        ${A.isTeacher() ? rankUpHtml() : ''}
        <div class="rank-pick">${['第一次', '第二次', '第三次'].map((n, i) => `<button type="button" class="btn${rankInfo?.has?.[i] ? ' btn--primary' : ''}" data-lv="rank" data-exam="${i}">${n}段考班名次</button>`).join('')}</div>
        <details class="field"><summary class="small"><b>或用其他名單</b></summary>
        <h3>依名單順序現場選位</h3>
        <p class="small">上傳名單（Excel、CSV 或文字檔）。開始後會先清空所有座位，第 1 位先點任何一個座位，接著第 2 位、第 3 位…直到全部選完。<br>
        名單有「名次」或「排名」欄就依名次排序，沒有就照名單由上到下的順序。名單只在這台裝置上讀取，不會上傳。</p>
        <div class="actions"><label class="btn btn--primary wide file-btn">📄 選擇名單檔案<input type="file" id="liveFile" accept=".xlsx,.xls,.csv,.txt,text/csv,text/plain" hidden></label></div>
        <details class="field"><summary class="small"><b>或直接貼上名單</b></summary>
          <textarea id="livePaste" placeholder="一行一位，例如：&#10;料 24 王小明&#10;多 11 陳小華"></textarea>
          <div class="actions"><button type="button" class="btn wide" data-lv="paste">使用貼上的名單</button></div></details>
        ${A.TEST ? `<div class="actions"><button type="button" class="btn wide" data-lv="demo">🧪 用示範名單（隨機順序）試試</button></div>` : ''}</details>`;
      loadRankInfo();
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
      const d = L.detail?.[k];
      h += `<li class="${cur ? 'cur' : ''}${seat ? ' done' : ''}"><span class="pos">${i + 1}</span><span class="who">${esc(k)}${d ? `<small class="rk-why">科排 ${d.dr}（${d.pct}%）${d.bonus ? `・加扣分 ${d.bonus > 0 ? '+' : ''}${d.bonus}` : ''}</small>` : ''}</span><span></span><span class="st">${seat || (cur ? '⏳ 選位中' : '')}</span></li>`;
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
  async function liveAction(act, el) {
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
    } else if (act === 'rank') {
      return useRank(+(el?.dataset.exam || 0));
    } else if (act === 'upExam') {
      upExam = +el.dataset.exam; store.set('indoor.rankup.exam', upExam); renderAll();
    } else if (act === 'demo') {
      useList([...A.students()].sort(() => Math.random() - 0.5).map(k => [k]), '示範名單（隨機）');
    }
  }

  async function useRank(exam) {
    try {
      toast('讀取班名次中…');
      const r = await A.api('rankOrder', { exam });
      await useList(r.order.map(k => [k]), r.label + (r.noRank?.length ? `（${r.noRank.length} 人沒有成績，排在最後）` : ''));
      if (live && r.detail) { live.detail = r.detail; saveLive(); renderAll(); }
      if (r.url) { rankInfo = { ...(rankInfo || {}), url: r.url }; }
    } catch (err) { toast(err.message); }
  }
  async function useList(rows, source) {
    if (!A.students().length) { try { await A.loadStudents(); } catch (e) { return toast('無法讀取學生名單：' + e.message); } }
    const r = parseOrder(rows);
    if (!r.order.length) return toast('名單裡找不到任何同學，請確認有「組別座號姓名」或「姓名」');
    live = { source, order: r.order, miss: r.miss, absent: r.absent, idx: 0, hist: [], started: false };
    saveLive(); renderAll();
    toast(`✓ 讀到 ${r.order.length} 位同學`);
  }

  // ── 📤 導師上傳兩科的段考科排名（多媒科、資料科各一個檔案）──
  let upExam = store.get('indoor.rankup.exam', 0);
  const DEPTS = [['多', '多媒科'], ['料', '資料科']];
  function rankUpHtml() {
    const up = rankInfo?.up?.[upExam] || {}, cut = rankInfo?.cuts?.[upExam];
    const when = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${A.fmtTime(d)}`; };
    const periodTxt = ['開學～這次排名上傳', '第一次段考排名上傳後～這次排名上傳', '第二次段考排名上傳後～這次排名上傳'][upExam];
    return `<div class="rank-up"><b>📤 上傳段考排名（兩科各一個檔案）</b>
      <div class="subsw small-sw">${['第一次', '第二次', '第三次'].map((n, i) => `<button type="button" data-lv="upExam" data-exam="${i}" aria-selected="${upExam === i}">${n}段考</button>`).join('')}</div>
      ${DEPTS.map(([d, name]) => `<div class="ru-row"><span class="ru-name">${name}</span><span class="ru-st">${up[d] ? `✅ ${up[d].n} 人・${when(up[d].t)}${up[d].file ? `<br><span class="muted">${esc(up[d].file)}</span>` : ''}` : '<span class="muted">還沒上傳</span>'}</span>
        <label class="btn file-btn${up[d] ? '' : ' btn--primary'}">📄 ${up[d] ? '重新上傳' : '選擇檔案'}<input type="file" data-updept="${d}" accept=".xlsx,.xls,.csv,.txt,text/csv,text/plain" hidden></label></div>`).join('')}
      <p class="muted small">檔案（Excel 或 CSV）要有姓名或座號，以及「科排名／名次」欄；沒有名次欄的話，會用「總分／平均」由高到低排。
        兩科都上傳後，系統把科內名次換成百分比，加上這段期間（${periodTxt}${cut ? `，到 ${when(cut)} 為止` : ''}）的加扣分，排出最後的班名次，按下面的按鈕就能開始現場選位。</p></div>`;
  }
  // 讀一科的成績檔：找出每位同學的科內名次
  function parseExam(rows, dept) {
    const norm = s => String(s ?? '').normalize('NFKC').replace(/\s+/g, '');
    const people = A.students().filter(k => k.startsWith(dept)).map(k => ({ k, ...parseKey(k) }));
    const hi = rows.slice(0, 12).findIndex(r => r.some(c => /^(姓名|座號|學號|科排名?|科名次|名次|排名|班排名?|總分|平均)/.test(norm(c))));
    const head = hi >= 0 ? rows[hi].map(norm) : [];
    const find = re => head.findIndex(c => re.test(c));
    let rankCol = find(/^科(排名?|名次)/);
    if (rankCol < 0) rankCol = find(/(名次|排名|班排)/);
    let scoreCol = rankCol < 0 ? find(/^總分/) : -1;
    if (rankCol < 0 && scoreCol < 0) scoreCol = find(/平均/);
    const got = [], miss = [], seen = new Set();
    rows.slice(hi + 1).forEach((r, i) => {
      const cells = r.map(norm), text = cells.join('').replace(/(\D)(\d)(?!\d)/g, '$10$2');
      if (!text) return;
      let m = people.find(p => text.includes(p.k));
      if (!m) { const s = people.filter(p => p.name && text.includes(p.name)); if (s.length === 1) m = s[0]; }
      if (!m) { if (/[一-鿿]/.test(text) && !/^(合計|平均|總計)/.test(text)) miss.push(r.filter(c => String(c).trim()).slice(0, 3).join(' ').slice(0, 16)); return; }
      if (seen.has(m.k)) return;
      seen.add(m.k);
      got.push({ k: m.k, v: parseFloat(cells[rankCol >= 0 ? rankCol : scoreCol]), i });
    });
    let by;
    if (rankCol >= 0) by = `「${head[rankCol]}」欄`;
    else if (scoreCol >= 0) {   // 只有分數：由高到低排，同分同名次
      by = `「${head[scoreCol]}」由高到低`;
      const s = got.filter(x => !isNaN(x.v)).sort((a, b) => b.v - a.v);
      s.forEach((x, j) => { x.rank = j && s[j - 1].v === x.v ? s[j - 1].rank : j + 1; });
    } else { by = '檔案由上到下的順序'; got.forEach((x, j) => { x.rank = j + 1; }); }
    if (rankCol >= 0) got.forEach(x => { x.rank = x.v; });
    const list = got.filter(x => x.rank >= 1).sort((a, b) => a.rank - b.rank);
    return { list, by, miss: miss.slice(0, 12), absent: people.filter(p => !list.some(x => x.k === p.k)).map(p => p.k) };
  }
  async function uploadExam(f, dept) {
    if (!A.students().length) { try { await A.loadStudents(); } catch (e) { return toast('無法讀取學生名單：' + e.message); } }
    const name = DEPTS.find(x => x[0] === dept)[1];
    let r;
    try { toast('讀取中…'); r = parseExam(await readListFile(f), dept); } catch (err) { return toast('檔案讀取失敗：' + err.message); }
    if (!r.list.length) return toast(`檔案裡找不到${name}的同學，請確認選對檔案`);
    const top = r.list.slice(0, 5).map(x => `第 ${x.rank} 名 ${x.k}`).join('\n');
    const ok = await A.ask(`${['第一次', '第二次', '第三次'][upExam]}段考・${name}\n讀到 ${r.list.length} 人（依${r.by}）\n\n${top}${r.list.length > 5 ? '\n…' : ''}`
      + (r.absent.length ? `\n\n⚠ 檔案裡沒有（會排在最後）：${r.absent.join('、')}` : '')
      + (r.miss.length ? `\n⚠ 對不到同學的列：${r.miss.join('、')}` : ''), '上傳');
    if (!ok) return;
    try {
      const res = await A.api('examUpload', { exam: upExam, dept, rows: r.list.map(x => ({ key: x.k, rank: x.rank })), file: f.name });
      rankInfo = { ...(rankInfo || {}), up: res.up, cuts: res.cuts };
      rankInfoAt = 0; loadRankInfo();
      toast(res.both ? `✓ ${name}已上傳，兩科都齊了！可以開始現場選位` : `✓ ${name}已上傳 ${res.n} 人，再上傳另一科`);
      renderAll();
    } catch (err) { toast(err.message); }
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
    if (e.target.dataset?.updept) { const f = e.target.files[0], d = e.target.dataset.updept; e.target.value = ''; if (f) uploadExam(f, d); return; }
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
    if (lv && !lv.disabled) return liveAction(lv.dataset.lv, lv);
    const b = e.target.closest('[data-sa]');
    if (!b || b.disabled) return;
    const act = b.dataset.sa;
    if (act === 'copyUrl') { toast(await A.copyText(studentUrl()) ? '已複製學生登入網址' : '複製失敗'); return; }
    if (act === 'default') return applyDefault(true);
    if (act === 'pdf') return seatPdf(b);
    if (act === 'saveDefault') return commitDraft(b);
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
    if (act === 'faceCheck') {
      const msg = $('#faceMsg');
      b.disabled = true; msg.textContent = '從雲端重新讀取大頭照中，可能需要 10–30 秒…';
      try {
        faces = {}; // 全部重新下載
        const r = await A.api('getFaces', { have: {} });
        const got = Object.keys(r.faces || {}).length, files = (r.codes || []).length;
        Object.entries(r.faces || {}).forEach(([c, f]) => { faces[c] = f; });
        saveFaces();
        facesLoaded = Date.now();
        const list = A.students();
        const missing = list.filter(k => !faces[parseKey(k).code]);
        renderAll();
        $('#faceMsg').textContent = `雲端找到 ${files} 位同學的照片，下載了 ${got} 張。`
          + (missing.length ? `還沒有照片：${missing.join('、')}` : '全班都有照片了 🎉')
          + (files && !got ? '（照片可能太大或讀取失敗）' : '');
      } catch (err) { msg.textContent = '✕ 讀取失敗：' + err.message; }
      b.disabled = false;
      return;
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
    if (e.target.closest('[data-tch]')) return zoomTeacher();
    const b = e.target.closest('[data-seat]');
    if (!b) return;
    const id = b.dataset.seat;
    if (trialOn()) return card ? cardTap(id) : zoomFace(id); // 沒有用交換位置卡：只能看，不能換
    if (A.isStudent()) return studentSeat(id);
    if (sub === 'live' && canLive()) return liveSeat(id);
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
    const none = A.roster()?.outdoor ? '（沒有指定）' : '（內掃區沒有指定；外掃區還沒有連結，看不到外掃工作）';
    return `<div class="duty"><span class="muted small">🧹 掃地工作</span><b>${jobs.length ? jobs.map(esc).join('<br>') : none}</b>
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
  function saveChart(quiet = false, commit = false) {
    if (!commit) { renderAll(); return; } // 草稿：只改畫面
    saved = { ...chart };
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
    if (A.isGuest()) return false; // 任課老師只看座位表
    const r = await A.api(A.isStudent() ? 'stuState' : 'selState', { v: force ? 0 : sel?.v || 0 });
    if (savingWishes) return false; // 志願還在儲存，先不要蓋掉
    return applySel(r);
  }
  async function loadChart() {
    const r = await A.api('getSeats');
    if (r.defaults) { savedDef = r.defaults; store.set(K.def, savedDef); }
    const next = r.seats || {};
    const wasDirty = dirty();
    const changed = !sameSeats(next, saved);
    saved = { ...next }; store.set(K.chart, next);
    if (wasDirty) return changed; // 有草稿：畫面保留，只更新紅色標示
    if (sameSeats(next, chart)) return changed;
    chart = { ...next };
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
    if (r.weather && JSON.stringify(r.weather) !== JSON.stringify(weather)) { weather = r.weather; store.set(K.wx, weather); changed = true; }
    await catalogP;
    if (r.decoT) setTimeout(() => A.emit('decoNews', r.decoT), 400);
    return changed;
  }
  let facesLoaded = 0;
  A.ensureFaces = force => {
    if (!force && Date.now() - facesLoaded < 10 * 60e3) return;
    facesLoaded = Date.now();
    Promise.all([loadFaces(), loadChart()]).then(c => { if (c.some(Boolean)) A.emit('faces'); }).catch(err => { facesLoaded = 0; if (A.isTeacher() && !A.TEST) toast('大頭照讀取失敗：' + err.message); });
  };
  async function refreshData() {
    try {
      const jobs = [loadChart(), loadSel(true)];
      if (Date.now() - facesLoaded > 10 * 60e3) jobs.push(loadFaces().then(c => { facesLoaded = Date.now(); return c; }).catch(err => { if (A.isTeacher()) toast('大頭照讀取失敗：' + err.message); return false; }));
      const res = await Promise.all(jobs);
      // 第一次使用、座位表還是空的：自動套用預設座位
      if (A.isTeacher() && !Object.keys(chart).length && !store.get(K.defaulted, false) && !live?.started) {
        await applyDefault(false);
        toast('已套用預設座位');
      } else if (A.isTeacher() && !live?.started && healChart()) {
        toast('已把還沒有座位的同學放回預設座位');
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

  // 預先載入：座位表＋大頭照（最花時間的部分）
  A.addPrefetch('seats', async () => {
    const res = await Promise.all([loadChart().catch(() => false), Date.now() - facesLoaded > 10 * 60e3 ? loadFaces().then(c => { facesLoaded = Date.now(); return c; }).catch(() => false) : false]);
    if (res.some(Boolean)) A.emit('faces');
  });
  A.tabHooks.seats = () => {
    discardDraft();
    renderAll();
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
    loadHD(code, id);
  }
  // 放大時換成高畫質的照片（第一次放大才下載，之後記在這支手機）
  const hd = new Map();
  async function loadHD(code, id) {
    if (!faces[code]?.d || A.TEST) return;
    let src = hd.get(code);
    if (src === undefined) {
      try { src = (await A.api('getFaceHD', { code })).d || ''; } catch { src = ''; }
      hd.set(code, src);
    }
    const z = $('#faceZoom'), img = z.querySelector('.fz-face .av > img');
    if (src && img && !z.hidden && z.dataset.seat === id) img.src = src;
  }
  // 點講桌／講台：顯示導師的大頭照（平常不顯示）
  function zoomTeacher() {
    const z = $('#faceZoom');
    if (!z.hidden && z.dataset.seat === 'T') { z.hidden = true; return; }
    if (!faces.T00?.d) return toast('講台');
    z.dataset.seat = 'T';
    z.innerHTML = `<div class="fz-card"><span class="fz-face">${faceHtml(D.teacherLabel)}</span><div class="fz-name"><b>${esc(D.teacherLabel)}</b></div></div>`;
    z.hidden = false;
    loadHD('T00', 'T');
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
      case 'getSeats': return { ok: true, seats: store.get(K.testChart, {}), defaults: store.get('indoor.testdef.v1.test', {}) };
      case 'getDuty': { const d = store.get('indoor.testduty.v1.test', null); return { ok: true, duty: d && d.date === A.fmtDate(new Date()) && d.list ? d : { date: A.fmtDate(new Date()), list: [] } }; }
      case 'setDuty': { const d = { date: A.fmtDate(new Date()), list: p.list, by: A.isTeacher() ? '導師' : A.me() }; store.set('indoor.testduty.v1.test', d); return { ok: true, duty: d }; }
      case 'rankInfo': return { ok: true, url: '', weight: 1, has: [true, false, false], up: store.get('indoor.rankup.v1.test', [{}, {}, {}]), cuts: [0, 0, 0] };
      case 'examUpload': {
        const all = store.get('indoor.rankup.v1.test', [{}, {}, {}]);
        all[p.exam][p.dept] = { n: p.rows.length, t: Date.now(), file: p.file || '' };
        store.set('indoor.rankup.v1.test', all);
        return { ok: true, n: p.rows.length, both: !!(all[p.exam]['多'] && all[p.exam]['料']), up: all, cuts: [0, 0, 0] };
      }
      case 'rankOrder': return { ok: true, order: [...A.students()].sort(() => Math.random() - 0.5), noRank: [], label: `（測試）第${'一二三'[p.exam || 0]}次段考班名次` };
      case 'saveDefaultSeats': store.set('indoor.testdef.v1.test', p.seats); return { ok: true, defaults: p.seats };
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
