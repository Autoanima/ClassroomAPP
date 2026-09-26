'use strict';
/* 🎁 禮物盒：導師、班長、副班長每週可以放一個驚喜盒（上傳一張圖片）；
   大家打開「座位」時，禮物盒從天而降，一秒後爆開顯示圖片；點圖片關閉，隨機得到煙火／小太陽卡／小雨傘卡 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  let boxes = [], canMake = false, playing = false, loadedAt = 0;
  const ICON = { 煙火: '🎆', 小太陽卡: '☀️', 小雨傘卡: '☂️' };

  const isMaker = () => A.isTeacher() || A.jobsOf(A.me() || '').roles.some(r => /^副?班長$/.test(r));
  async function load() {
    try { const r = await A.api('getGiftBoxes'); boxes = r.boxes || []; canMake = !!r.canMake; loadedAt = Date.now(); } catch { /* 讀不到就先不顯示 */ }
    paintDock();
    return boxes;
  }

  // 教室正中間的禮物盒（還沒打開的會跳動；打開過的可以再看圖片）
  function paintDock() {
    const wrap = document.querySelector('#tab-seats .map-wrap');
    if (!wrap) return;
    let dock = $('#boxDock');
    if (!dock) { dock = document.createElement('div'); dock.id = 'boxDock'; wrap.parentElement.style.position = 'relative'; wrap.parentElement.appendChild(dock); }
    const r = wrap.getBoundingClientRect(), pr = wrap.parentElement.getBoundingClientRect();
    dock.style.top = (r.top - pr.top + r.height / 2) + 'px';
    dock.style.left = (r.left - pr.left + r.width / 2) + 'px';
    dock.innerHTML = boxes.map(b => `<button type="button" class="box-icon${b.opened ? ' opened' : ''}" data-box="${esc(b.id)}" title="${esc(b.by)} 的禮物盒">🎁</button>`).join('');
    dock.hidden = !boxes.length;
  }
  $('#tab-seats').addEventListener('click', e => {
    const b = e.target.closest('[data-box]');
    if (b) { e.stopPropagation(); play(boxes.find(x => x.id === b.dataset.box)); }
  }, true);

  // ── 動畫：從天而降 → 一秒後爆開 → 圖片 → 點一下關閉 → 得到道具 ──
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function play(box) {
    if (!box || playing) return;
    playing = true;
    let fx = $('#giftFx');
    if (!fx) { fx = document.createElement('div'); fx.id = 'giftFx'; document.body.appendChild(fx); }
    fx.innerHTML = `<div class="gb-from">🎁 ${esc(box.by)} 送來一個禮物盒</div><div class="gb-box">🎁</div>`;
    fx.hidden = false; fx.className = 'falling';
    const opening = A.api('openGiftBox', { id: box.id }).catch(err => ({ error: err.message }));
    await wait(900);                 // 落地
    fx.className = 'landed';
    await wait(1000);                // 一秒後爆開
    const r = await opening;
    fx.className = 'burst';
    const bits = ['✨', '🎉', '⭐', '💥', '🎊', '✨', '⭐', '🎉'];
    fx.insertAdjacentHTML('beforeend', bits.map((b, i) => `<span class="gb-bit" style="--a:${i * 45}deg">${b}</span>`).join(''));
    await wait(450);
    if (r.error) { fx.hidden = true; playing = false; return toast('禮物盒打不開：' + r.error); }
    fx.innerHTML = `<div class="gb-card">${r.img ? `<img src="${r.img}" alt="禮物盒的圖片">` : '<div class="gb-noimg">（圖片不見了）</div>'}
      <div class="gb-note">來自 ${esc(r.by)} 的禮物・點一下關閉</div></div>`;
    fx.className = 'show';
    await new Promise(res => fx.addEventListener('click', res, { once: true }));
    box.opened = true;
    if (r.got) {
      fx.innerHTML = `<div class="gb-card gb-reward"><div class="gb-big">${ICON[r.got] || '🎁'}</div><b>你得到一張「${esc(r.got)}」！</b>
        <p class="muted small">已經放進你的道具，在「商店 → 特殊道具」可以免費使用。</p><button type="button" class="btn btn--primary wide">太好了！</button></div>`;
      await new Promise(res => fx.querySelector('button').addEventListener('click', res, { once: true }));
    }
    fx.hidden = true; playing = false;
    paintDock();
    const next = boxes.find(b => !b.opened);
    if (next && A.currentTab() === 'seats') { await wait(400); play(next); }
  }

  // 打開「座位」：有還沒打開的禮物盒就自動播放
  const prevHook = A.tabHooks.seats;
  A.tabHooks.seats = () => {
    prevHook?.();
    if (Date.now() - loadedAt < 20e3) { paintDock(); return; }
    load().then(list => { const first = list.find(b => !b.opened); if (first && A.currentTab() === 'seats') setTimeout(() => play(first), 600); });
  };
  window.addEventListener('resize', () => { if (A.currentTab() === 'seats') paintDock(); });
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
    if (action === 'getGiftBoxes') return { ok: true, boxes: list().map(b => ({ id: b.id, by: b.by, time: '', opened: !!opened()[me + '|' + b.id] })), canMake: isMaker() && !list().some(b => b.by === me) };
    if (action === 'createGiftBox') { store.set(KEY, [...store.get(KEY, []), { id: Math.random().toString(36).slice(2, 10), by: me, img: p.data, t: Date.now() }]); return { ok: true, boxes: list().map(b => ({ id: b.id, by: b.by, opened: false })) }; }
    if (action === 'openGiftBox') {
      const b = list().find(x => x.id === p.id), o = opened();
      let got = '';
      if (!o[me + '|' + p.id]) {
        got = !A.isTeacher() && !A.isGuest() ? ['煙火', '小太陽卡', '小雨傘卡'][Math.floor(Math.random() * 3)] : '';
        o[me + '|' + p.id] = got || '看過'; store.set(OK, o);
        if (got) store.set('indoor.testcards.v1.test', [...store.get('indoor.testcards.v1.test', []), { who: me, card: got, n: 1, from: '禮物盒', t: Date.now() }]);
      }
      return { ok: true, img: b?.img || '', by: b?.by || '', got };
    }
    return prevTest ? prevTest(action, p) : null;
  };
})();
