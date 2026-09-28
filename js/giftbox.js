'use strict';
/* 🎁 禮物盒：導師、班長、副班長每週可以放一個驚喜盒（上傳一張圖片）；
   大家打開「座位」時，禮物盒從天而降，一秒後爆開顯示圖片；點圖片關閉，隨機得到煙火／小太陽卡／小雨傘卡 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  let boxes = [], canMake = false, playing = false, loadedAt = 0;
  const ICON = { 煙火: '🎆', 小太陽卡: '☀️', 小雨傘卡: '☂️', 裝扮配件: '🎀' };

  // ── 轉盤：各獎品的機率（和 Apps Script 的 BOX_ODDS 一樣）──
  const ODDS = [['煙火', 55], ['小太陽卡', 17.5], ['小雨傘卡', 17.5], ['裝扮配件', 10]];
  const COLOR = { 煙火: '#f59f00', 小太陽卡: '#ff8787', 小雨傘卡: '#4dabf7', 裝扮配件: '#b197fc' };
  function slices(odds) {
    const total = odds.reduce((t, x) => t + x[1], 0);
    let a = 0;
    return odds.map(([k, w]) => { const s = a, e = a + w / total * 360; a = e; return { k, w: w / total * 100, s, e }; });
  }
  function wheelHtml(odds, hint) {
    const sl = slices(odds);
    const bg = `conic-gradient(${sl.map(x => `${COLOR[x.k] || '#adb5bd'} ${x.s}deg ${x.e}deg`).join(', ')})`;
    const labels = sl.map(x => { const m = (x.s + x.e) / 2; return `<span class="gbw-lbl" style="transform:translate(-50%,-50%) rotate(${m}deg) translateY(-58px) rotate(${-m}deg)">${ICON[x.k] || '🎁'}</span>`; }).join('');
    return `<div class="gbw"><div class="gbw-wrap"><div class="gbw-ptr">▼</div><div class="gbw-wheel" style="background:${bg}">${labels}</div></div>
      <ul class="gbw-odds">${sl.map(x => `<li><i style="background:${COLOR[x.k] || '#adb5bd'}"></i>${ICON[x.k] || ''} ${x.k === '裝扮配件' ? '裝扮配件（預設的配件）' : x.k}<b>${+x.w.toFixed(1)}%</b></li>`).join('')}</ul>
      <p class="gbw-hint muted small">${hint}</p>
      <button type="button" class="btn btn--primary wide gbw-spin">🎡 轉轉看！</button></div>`;
  }
  // 轉到指定的獎品（沒指定就照機率隨機，轉著玩）
  function spinTo(card, odds, kind) {
    const sl = slices(odds);
    if (!kind) { let r = Math.random() * 100; kind = (sl.find(x => (r -= x.w) < 0) || sl[0]).k; }
    const x = sl.find(y => y.k === kind) || sl[0];
    const a = x.s + (x.e - x.s) * (0.2 + Math.random() * 0.6);     // 停在那一格裡面（不要剛好在邊線上）
    const wheel = card.querySelector('.gbw-wheel');
    const cur = Number(wheel.dataset.r || 0);
    const next = cur - (cur % 360) + 360 * 5 + (360 - a);
    wheel.dataset.r = next;
    wheel.style.transform = `rotate(${next}deg)`;
    return new Promise(res => setTimeout(() => res(kind), 3700));
  }

  const isMaker = () => A.isTeacher() || A.jobsOf(A.me() || '').roles.some(r => /^副?班長$/.test(r));
  async function load() {
    try { const r = await A.api('getGiftBoxes'); boxes = r.boxes || []; canMake = !!r.canMake; loadedAt = Date.now(); } catch { /* 讀不到就先不顯示 */ }
    paintDock();
    return boxes;
  }

  // 教室正中間的禮物盒（還沒打開的會跳動；打開過的可以再看圖片）
  function dockAt(id, el, host, list, cls) {
    let dock = document.getElementById(id);
    if (!dock) { dock = document.createElement('div'); dock.id = id; dock.className = 'box-dock ' + cls; host.appendChild(dock); }
    const r = el.getBoundingClientRect(), pr = host.getBoundingClientRect();
    dock.style.top = (r.top - pr.top + r.height / 2) + 'px';
    dock.style.left = (r.left - pr.left + r.width / 2) + 'px';
    dock.innerHTML = list.map(b => `<button type="button" class="box-icon${b.opened ? ' opened' : ''}" data-box="${esc(b.id)}" title="${esc(b.by)} 的禮物盒${b.opened ? '（點一下再看一次）' : ''}">🎁</button>`).join('');
    dock.hidden = !list.length;
  }
  function paintDock() {
    // 任課老師不用看到禮物盒
    if (A.isGuest()) { ['boxDock', 'boxDesk'].forEach(id => { const d = document.getElementById(id); if (d) d.hidden = true; }); return; }
    const wrap = document.querySelector('#tab-seats .map-wrap');
    if (!wrap) return;
    const host = wrap.parentElement;
    host.style.position = 'relative';
    dockAt('boxDock', wrap, host, boxes.filter(b => !b.opened), 'center');
    // 打開過的：放在講桌上，只放一天（從放禮物盒的時間算起；找不到講桌就放正中間）
    const desk = wrap.querySelector('.it.desk') || wrap;
    dockAt('boxDesk', desk, host, boxes.filter(b => b.opened && (!b.t || Date.now() - b.t < 86400e3)), 'desk');
  }
  $('#tab-seats').addEventListener('click', e => {
    const b = e.target.closest('[data-box]');
    if (!b) return;
    e.stopPropagation();
    const box = boxes.find(x => x.id === b.dataset.box);
    if (!box?.opened) return play(box);
    showAgain(box);   // 已經打開過：直接再看一次圖片
  }, true);

  // ── 打開過的禮物盒：直接顯示圖片；點外面或按 ✕ 關閉 ──
  const imgCache = {};
  async function showAgain(box) {
    if (playing) return;
    let fx = $('#giftFx');
    if (!fx) { fx = document.createElement('div'); fx.id = 'giftFx'; document.body.appendChild(fx); }
    const paint = img => {
      fx.innerHTML = `<div class="gb-card gb-spin-card"><button type="button" class="gb-x" aria-label="關閉">✕</button>
        ${img ? `<img src="${img}" alt="禮物盒的圖片">` : `<div class="gb-noimg">${img === '' ? '（圖片不見了）' : '讀取中…'}</div>`}
        <div class="gb-note">來自 ${esc(box.by)} 的禮物${box.got && box.got !== '已打開' && box.got !== '看過' ? `・你抽到了「${esc(box.got)}」` : ''}</div>
        ${wheelHtml(ODDS, '已經打開過了，轉盤可以轉著玩，不會再得到道具')}</div>`;
    };
    paint(imgCache[box.id]);
    fx.className = 'show again'; fx.hidden = false;
    const close = async e => {
      const spin = e.target.closest('.gbw-spin');
      if (spin) {                                                        // 轉著玩
        spin.disabled = true;
        const k = await spinTo(fx.querySelector('.gb-card'), ODDS);
        const h = fx.querySelector('.gbw-hint');
        if (h) h.textContent = `轉到了「${k}」！（已經打開過，只是轉著玩）`;
        spin.disabled = false; spin.textContent = '🎡 再轉一次';
        return;
      }
      if (e.target.closest('.gb-card') && !e.target.closest('.gb-x')) return;   // 點圖片本身不關
      fx.hidden = true; fx.removeEventListener('click', close);
    };
    fx.addEventListener('click', close);
    if (imgCache[box.id] === undefined) {
      await loadImg(box.id);
      if (!fx.hidden) paint(imgCache[box.id]);
    }
  }
  // 只讀圖片（不會打開禮物盒、不會抽獎）
  async function loadImg(id) {
    if (imgCache[id] !== undefined) return;
    try { const r = await A.api('giftBoxImage', { id }); imgCache[id] = r.img || ''; } catch { /* 下次再試 */ }
  }
  // 所有分頁都預先載入完之後，再偷偷把禮物盒的圖片也載好（打開禮物盒時就不用等）
  let imgPreloaded = false;
  A.on('prefetch', async info => {
    if (imgPreloaded || !info.on || !info.total || info.done < info.total || A.isGuest()) return;
    imgPreloaded = true;
    if (!loadedAt) await load();
    for (const b of boxes) await loadImg(b.id);
  });

  // ── 動畫：從天而降 → 一秒後爆開 → 圖片 → 點一下關閉 → 得到道具 ──
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function play(box, again) {
    if (!box || playing) return;
    playing = true;
    let fx = $('#giftFx');
    if (!fx) { fx = document.createElement('div'); fx.id = 'giftFx'; document.body.appendChild(fx); }
    fx.innerHTML = `<div class="gb-from">🎁 ${esc(box.by)} 送來一個禮物盒</div><div class="gb-box">🎁</div>`;
    fx.hidden = false; fx.className = 'falling';
    // 圖片已經預先載好的話，就不用再請伺服器傳一次（打開比較快）
    const opening = A.api('openGiftBox', { id: box.id, noImg: imgCache[box.id] ? 1 : 0 }).catch(err => ({ error: err.message }));
    await wait(420);                 // 落地（動畫縮短一半以上）
    fx.className = 'landed';
    await wait(450);                 // 抖一下就爆開
    const r = await opening;
    fx.className = 'burst';
    const bits = ['✨', '🎉', '⭐', '💥', '🎊', '✨', '⭐', '🎉'];
    fx.insertAdjacentHTML('beforeend', bits.map((b, i) => `<span class="gb-bit" style="--a:${i * 45}deg">${b}</span>`).join(''));
    await wait(220);
    if (r.error) { fx.hidden = true; playing = false; return toast('禮物盒打不開：' + r.error); }
    if (r.img) imgCache[box.id] = r.img;
    const img = imgCache[box.id] || '';
    const odds = r.odds || ODDS;
    // 圖片下面是轉盤：學生按「轉轉看」揭曉抽到什麼（結果由伺服器決定）；導師、打開過的只能轉著玩
    const kind = r.kind || (r.got ? (ICON[r.got] ? r.got : '裝扮配件') : '');
    fx.innerHTML = `<div class="gb-card gb-spin-card">${img ? `<img src="${img}" alt="禮物盒的圖片">` : '<div class="gb-noimg">（圖片不見了）</div>'}
      <div class="gb-note">來自 ${esc(r.by)} 的禮物</div>
      ${wheelHtml(odds, kind ? '轉轉看，你抽到了什麼？' : '導師不會得到道具，轉盤可以轉著玩')}</div>`;
    fx.className = 'show';
    const card = fx.querySelector('.gb-card');
    box.opened = true;
    if (kind) {
      const btn = card.querySelector('.gbw-spin');
      await new Promise(res => btn.addEventListener('click', res, { once: true }));
      btn.disabled = true; btn.textContent = '轉呀轉…';
      await spinTo(card, odds, kind);
      const acc = kind === '裝扮配件';
      box.got = r.got;
      card.querySelector('.gbw').insertAdjacentHTML('beforeend', `<div class="gb-reward-in"><div class="gb-big">${ICON[kind] || '🎁'}</div>
        <b>你得到${acc ? `裝扮配件「${esc(r.accName || '')}」` : `一張「${esc(kind)}」`}！</b>
        <p class="muted small">${acc ? `已經放進「商店 → 我的配件」，有效 10 天，按「裝扮大頭照」就可以戴上。` : '已經放進你的道具，在「商店 → 特殊道具」可以免費使用。'}</p>
        <button type="button" class="btn btn--primary wide gb-ok">太好了！</button></div>`);
      btn.remove();
      card.querySelector('.gb-reward-in').scrollIntoView({ block: 'nearest' });
      await new Promise(res => card.querySelector('.gb-ok').addEventListener('click', res, { once: true }));
      if (acc) A.ensureFaces?.(true);
    } else {
      // 沒有獎品：轉著玩，點外面或 ✕ 關閉
      card.insertAdjacentHTML('afterbegin', '<button type="button" class="gb-x" aria-label="關閉">✕</button>');
      await new Promise(res => {
        const h = async e => {
          const spin = e.target.closest('.gbw-spin');
          if (spin) { spin.disabled = true; const k = await spinTo(card, odds); card.querySelector('.gbw-hint').textContent = `轉到了「${k}」！（只是轉著玩）`; spin.disabled = false; spin.textContent = '🎡 再轉一次'; return; }
          if (e.target.closest('.gb-card') && !e.target.closest('.gb-x')) return;
          fx.removeEventListener('click', h); res();
        };
        fx.addEventListener('click', h);
      });
    }
    fx.hidden = true; playing = false;
    paintDock();
    const next = boxes.find(b => !b.opened);
    if (next && A.currentTab() === 'seats') { await wait(200); play(next); }
  }

  // 打開「座位」：有還沒打開的禮物盒就自動播放
  const prevHook = A.tabHooks.seats;
  A.tabHooks.seats = () => {
    prevHook?.();
    if (A.isGuest()) { paintDock(); return; }   // 任課老師：不讀取、不播放禮物盒
    if (Date.now() - loadedAt < 20e3) { paintDock(); return; }
    load().then(list => { const first = list.find(b => !b.opened); if (first && A.currentTab() === 'seats') setTimeout(() => play(first), 300); });
  };
  window.addEventListener('resize', () => { if (A.currentTab() === 'seats') paintDock(); });
  A.addPrefetch('seats', () => (A.isGuest() ? null : load()));
  A.on('faces', () => { if (A.currentTab() === 'seats') setTimeout(paintDock, 50); });

  // ── 商店：放禮物盒（上傳圖片，自動壓縮）──
  let made = null;
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('讀不到這張圖片')); i.src = url; });
      for (let max = 1000, q = 0.82; max >= 320; max = Math.round(max * 0.85), q = Math.max(0.6, q - 0.05)) {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
        const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
        const d = cv.toDataURL('image/jpeg', q);
        if (d.length < 480000) return d;   // 約 350KB 以內
      }
      throw new Error('圖片太大，請換一張');
    } finally { URL.revokeObjectURL(url); }
  }
  A.openGiftBoxMaker = async () => {
    await load();
    if (!canMake) return toast(isMaker() ? '你這週已經放過禮物盒了，下週再來' : '只有導師、班長、副班長可以放禮物盒');
    made = null;
    let h = A.sheetHead('🎁 放一個禮物盒', '每週一次；大家打開「座位」時會看到它從天而降、爆開，並隨機得到一張道具卡');
    h += `<label class="create-pick gb-pick"><input type="file" id="gbFile" accept="image/*" hidden><span id="gbPrev" class="create-prev">＋<br><span class="small">選一張圖片</span></span></label>
      <p class="muted small" id="gbInfo">圖片會自動壓縮，方便網路傳送。</p>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="gbOk">🎁 放到教室正中間</button></div>`;
    A.openSheet({ kind: 'giftbox' }, h);
  };
  A.sheetBody.addEventListener('change', async e => {
    if (e.target.id !== 'gbFile' || A.sheetMode()?.kind !== 'giftbox') return;
    const f = e.target.files[0];
    if (!f) return;
    try { made = await shrink(f); $('#gbPrev').innerHTML = `<img src="${made}" alt="">`; $('#gbInfo').textContent = `壓縮後約 ${Math.round(made.length * 0.75 / 1024)} KB。`; } catch (err) { made = null; toast(err.message); }
  });
  A.sheetHandlers.giftbox = async (act, b) => {
    if (act !== 'gbOk') return;
    if (!made) return toast('請先選一張圖片');
    if (!await A.ask('把這個禮物盒放到教室正中間？\n（這週就不能再放了）', '放禮物盒')) return;
    b.disabled = true; b.textContent = '上傳中…';
    try { const r = await A.api('createGiftBox', { data: made }); boxes = r.boxes || boxes; canMake = false; A.closeSheet(); toast('🎁 禮物盒已經放到教室了！'); } catch (err) { toast(err.message); b.disabled = false; b.textContent = '🎁 放到教室正中間'; }
  };
  A.isGiftBoxMaker = isMaker;

  // ── 測試模式 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    const KEY = 'indoor.boxes.v1.test', OK = 'indoor.boxopen.v1.test';
    const me = A.isTeacher() ? '導師' : A.isGuest() ? '任課老師' : A.me();
    const list = () => store.get(KEY, []).filter(b => Date.now() - b.t < 7 * 86400e3);
    const opened = () => store.get(OK, {});
    if (action === 'getGiftBoxes') return { ok: true, boxes: list().map(b => ({ id: b.id, by: b.by, time: '', t: b.t, opened: !!opened()[me + '|' + b.id], got: opened()[me + '|' + b.id] || '' })), canMake: isMaker() && !list().some(b => b.by === me) };
    if (action === 'createGiftBox') { store.set(KEY, [...store.get(KEY, []), { id: Math.random().toString(36).slice(2, 10), by: me, img: p.data, t: Date.now() }]); return { ok: true, boxes: list().map(b => ({ id: b.id, by: b.by, opened: false })) }; }
    if (action === 'openGiftBox') {
      const b = list().find(x => x.id === p.id), o = opened();
      let got = '', kind = '', accName = '';
      if (!o[me + '|' + p.id]) {
        if (!A.isTeacher() && !A.isGuest()) {                           // 照機率抽（和正式版一樣）
          let r = Math.random() * 100;
          kind = (ODDS.find(x => (r -= x[1]) < 0) || ODDS[0])[0];
        }
        if (kind === '裝扮配件') {
          const list = (await A.builtinCatalog()).filter(a => !a.creator);
          const a = list[Math.floor(Math.random() * list.length)];
          const d = new Date(); d.setDate(d.getDate() + 9);
          store.set('indoor.shopinv.v1.test', [...store.get('indoor.shopinv.v1.test', []), { id: 'gb' + Date.now(), owner: me, acc: a.id, name: a.name, price: 0, buyer: '禮物盒', exp: `${d.getFullYear()}/${A.pad2(d.getMonth() + 1)}/${A.pad2(d.getDate())}`, note: '禮物盒' }]);
          accName = a.name; got = `裝扮配件「${a.name}」`;
        } else if (kind) {
          got = kind;
          store.set('indoor.testcards.v1.test', [...store.get('indoor.testcards.v1.test', []), { who: me, card: got, n: 1, from: '禮物盒', t: Date.now() }]);
        }
        o[me + '|' + p.id] = got || '看過'; store.set(OK, o);
      }
      return { ok: true, img: p.noImg ? '' : b?.img || '', by: b?.by || '', got, kind, accName, odds: ODDS };
    }
    if (action === 'giftBoxImage') {
      const b = list().find(x => x.id === p.id);
      return { ok: true, img: b?.img || '' };
    }
    return prevTest ? prevTest(action, p) : null;
  };
})();
