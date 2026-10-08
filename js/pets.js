'use strict';
/* 🐾 班級寵物：同學被加分 → 從座位蹦出寵物蛋，跳到講台；1 天後孵化；寵物沿著教室四邊走來走去（不遮住大頭照）。
   點寵物：愛心或音符＋叫聲、看飽足度（🍚）、餵罐罐（1 點，+1 🍚）。每天餓掉 1 🍚，0 🍚 就跑出去自己覓食。
   外觀由主人（被加分的同學）上傳 PNG 去背；沒上傳就是貓咪。這是最不重要的功能：等其他分頁都載入完才讀。 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  let P = null, pAt = 0, loading = null;
  const nm = k => { if (k === (A.D.teacherLabel || '導師')) return '導師'; const p = A.parseKey(k); return p.code ? `${p.code} ${p.name}` : k; };
  const petName = x => x.name || `${nm(x.owner).replace(/^\S+\s/, '')}的寵物`;

  // 沒上傳外觀：貓咪
  const CAT = `<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke-linecap="round" stroke-linejoin="round">
    <path d="M48 50q13-2 11-17" stroke="#f0a35e" stroke-width="5" fill="none"/>
    <ellipse cx="32" cy="50" rx="16" ry="11" fill="#f0a35e"/><ellipse cx="32" cy="53" rx="9" ry="7" fill="#fbe3c8"/>
    <path d="M13 24 17 6 28 17Z" fill="#f0a35e"/><path d="M51 24 47 6 36 17Z" fill="#f0a35e"/>
    <path d="M17 19 18.5 11 24 16Z" fill="#f7b6c2"/><path d="M47 19 45.5 11 40 16Z" fill="#f7b6c2"/>
    <ellipse cx="32" cy="29" rx="20" ry="16" fill="#f0a35e"/>
    <path d="M26 15q2 3 0 6M32 14v6M38 15q-2 3 0 6" stroke="#d98a45" stroke-width="2" fill="none"/>
    <ellipse cx="24.5" cy="29" rx="2.8" ry="3.6" fill="#2b2b2b"/><ellipse cx="39.5" cy="29" rx="2.8" ry="3.6" fill="#2b2b2b"/>
    <circle cx="25.4" cy="27.8" r="1" fill="#fff"/><circle cx="40.4" cy="27.8" r="1" fill="#fff"/>
    <ellipse cx="19" cy="35" rx="3" ry="1.8" fill="#f7b6c2" opacity=".8"/><ellipse cx="45" cy="35" rx="3" ry="1.8" fill="#f7b6c2" opacity=".8"/>
    <path d="M30.5 33.5h3l-1.5 2Z" fill="#e5737a"/><path d="M32 35.5q-1.5 3-4 1.2M32 35.5q1.5 3 4 1.2" stroke="#7a4a2a" stroke-width="1.2" fill="none"/>
    <path d="M14 31h7M14 34.5l7-1M50 31h-7M50 34.5l-7-1" stroke="#7a4a2a" stroke-width=".9"/></g></svg>`;
  const EGG = `<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M20 2C10 2 3 18 3 29a17 17 0 0 0 34 0C37 18 30 2 20 2Z" fill="#fff8e7" stroke="#e8c37a" stroke-width="2"/><circle cx="13" cy="24" r="3" fill="#f6c453"/><circle cx="26" cy="15" r="2.4" fill="#8fd3f4"/><circle cx="27" cy="33" r="3.4" fill="#f7a8b8"/><circle cx="14" cy="37" r="2" fill="#8fd3f4"/></svg>`;
  // ── 🚗 寵物的交通工具（比寵物大，寵物坐上去，不縮小）：back＝在寵物後面、front＝擋住寵物下半身 ──
  //    box：交通工具的大小與位置（相對於 34×34 的寵物，left／bottom 是 px）；lift：寵物往上抬多少才坐得上去
  const RIDES = {
    car: { name: '汽車', ico: '🚗', w: 66, h: 38, left: -16, bottom: -11, lift: 9,
      desc: '繞著教室開車兜風，開得比走路快，不會停下來',
      routes: [['cw', '順時針繞教室'], ['ccw', '逆時針繞教室']],
      back: '<path d="M14 18q0-11 9-11h4v13z" fill="#a61e2e"/>',
      front: `<path d="M3 30q-1-9 7-11l9-3h20l9 4h7q8 0 8 9v3z" fill="#e03131"/><path d="M40 16l5-7h3l-4 8z" fill="#bfe3f5" stroke="#555" stroke-width="1"/>
        <path d="M5 25h55" stroke="#b02424" stroke-width="1.4"/><circle cx="61" cy="23" r="2.4" fill="#ffe066"/><rect x="2" y="21" width="3" height="4" rx="1" fill="#ff8787"/>
        <circle cx="17" cy="31" r="6.5" fill="#2b2b2b"/><circle cx="17" cy="31" r="2.6" fill="#ced4da"/><circle cx="50" cy="31" r="6.5" fill="#2b2b2b"/><circle cx="50" cy="31" r="2.6" fill="#ced4da"/>` },
    ring: { name: '游泳圈', ico: '🛟', w: 62, h: 30, left: -14, bottom: -10, lift: 2,
      desc: '慢慢漂著，一邊沿著教室邊邊前進、一邊轉小圈圈（像漩渦一樣）',
      routes: [['cw', '順時針轉圈漂流'], ['ccw', '逆時針轉圈漂流']],
      back: `<ellipse cx="31" cy="23" rx="30" ry="6" fill="#a5d8ff" opacity=".7"/><ellipse cx="31" cy="16" rx="27" ry="11" fill="#ff6b6b"/>
        <path d="M10 10l7 5M45 6l-4 7" stroke="#fff" stroke-width="5"/><ellipse cx="31" cy="15" rx="13" ry="4.5" fill="#1c7ed6" opacity=".55"/>`,
      front: `<path d="M4 16q1 11 27 11t27-11q-4 5-27 5T4 16z" fill="#ff6b6b"/><path d="M4 16q1 11 27 11t27-11" fill="none" stroke="#c92a2a" stroke-width="1"/>
        <path d="M14 21l-2 5M48 21l2 5M31 22v5" stroke="#fff" stroke-width="5"/>` },
    boat: { name: '船', ico: '⛵', w: 72, h: 54, left: -19, bottom: -12, lift: 8,
      desc: '在教室前面、後面（或左右兩側）來回航行，到岸會掉頭',
      routes: [['h', '左右來回航行（教室前面、後面）'], ['v', '前後來回航行（教室兩側）']],
      back: `<path d="M57 2v34" stroke="#6b4423" stroke-width="2.4"/><path d="M58 5q15 13 1 28h-1z" fill="#fff" stroke="#adb5bd" stroke-width="1"/><path d="M57 2l9 3-9 3z" fill="#f03e3e"/>`,
      front: `<path d="M2 34h68l-9 13H12z" fill="#8d5a2b"/><path d="M4 36h64" stroke="#5e3a17" stroke-width="2"/><circle cx="22" cy="40" r="2" fill="#ffd43b"/><circle cx="36" cy="40" r="2" fill="#ffd43b"/><circle cx="50" cy="40" r="2" fill="#ffd43b"/>
        <path d="M0 50q6-4 12 0t12 0 12 0 12 0 12 0 12 0" fill="none" stroke="#4dabf7" stroke-width="2.4"/>` },
    ufo: { name: '飛碟', ico: '🛸', w: 76, h: 44, left: -21, bottom: -12, lift: 9,
      desc: '鋸齒形飛來飛去，或在一個地方盤旋一下就「咻」地消失、在別的地方出現',
      routes: [['cw', '順時針鋸齒飛行'], ['ccw', '逆時針鋸齒飛行'], ['warp', '瞬間移動（消失、在別的地方出現）']],
      back: `<path d="M16 34l-8 10h60l-8-10z" fill="#fff3bf" opacity=".35"/>`,
      front: `<path d="M20 27q0-21 18-21t18 21z" fill="#a5d8ff" opacity=".38" stroke="#74c0fc" stroke-width="1.4"/><path d="M27 12q4-4 9-4" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/>
        <ellipse cx="38" cy="30" rx="37" ry="9" fill="#868e96"/><ellipse cx="38" cy="27" rx="37" ry="7" fill="#ced4da"/><ellipse cx="38" cy="36" rx="14" ry="3.5" fill="#495057"/>
        <circle class="ufo-l" cx="12" cy="29" r="2.4" fill="#ffd43b"/><circle class="ufo-l" cx="25" cy="31" r="2.4" fill="#ff6b6b"/><circle class="ufo-l" cx="38" cy="32" r="2.4" fill="#69db7c"/><circle class="ufo-l" cx="51" cy="31" r="2.4" fill="#ff6b6b"/><circle class="ufo-l" cx="64" cy="29" r="2.4" fill="#ffd43b"/>` },
    worm: { name: '巨大毛毛蟲', ico: '🐛', w: 100, h: 38, left: -44, bottom: -9, lift: 10,
      desc: '一伸一縮慢慢爬，在座位之間的走道上下穿梭，一排一排蛇行過去（只有毛毛蟲會走走道）',
      routes: [['lr', '從左邊的走道開始，往右一路蛇行'], ['rl', '從右邊的走道開始，往左一路蛇行']],
      back: `<g class="wm-body"><circle class="wm-s" cx="11" cy="25" r="8.5" fill="#94d82d"/><circle class="wm-s" cx="25" cy="24" r="9.5" fill="#82c91e"/><circle class="wm-s" cx="40" cy="23" r="10" fill="#94d82d"/>
        <circle class="wm-s" cx="55" cy="23" r="10" fill="#82c91e"/><circle class="wm-s" cx="70" cy="23" r="10" fill="#94d82d"/></g>
        <g fill="#5c940d"><circle cx="11" cy="33" r="2"/><circle cx="25" cy="33" r="2"/><circle cx="40" cy="33" r="2"/><circle cx="55" cy="33" r="2"/><circle cx="70" cy="33" r="2"/></g>
        <circle cx="86" cy="20" r="11.5" fill="#a9e34b"/><path d="M82 9q-2-6-6-7M90 9q2-6 6-7" stroke="#5c940d" stroke-width="1.8" fill="none"/><circle cx="76" cy="2" r="2.2" fill="#f03e3e"/><circle cx="96" cy="2" r="2.2" fill="#f03e3e"/>
        <circle cx="88" cy="18" r="2.6" fill="#2b2b2b"/><circle cx="88.8" cy="17.2" r=".9" fill="#fff"/><path d="M86 25q4 3 8 0" stroke="#2b2b2b" stroke-width="1.4" fill="none"/><ellipse cx="93" cy="23" rx="2.2" ry="1.4" fill="#ffa8a8"/>`,
      front: '' },
    rocket: { name: '火箭', ico: '🚀', w: 80, h: 36, left: -22, bottom: -10, lift: 7,
      desc: '咻～飛越教室，車頭會朝著飛的方向轉',
      routes: [['x', '斜斜飛越教室（弧線）'], ['v', '直直往前、往後飛（直線）']],
      back: `<g class="rk-flame"><path d="M12 22q-12-6-14 0 2 6 14 0z" fill="#ff922b"/><path d="M12 22q-7-3-9 0 2 3 9 0z" fill="#ffe066"/></g>
        <path d="M14 13h46q14 0 19 9-5 9-19 9H14z" fill="#e9ecef" stroke="#868e96" stroke-width="1.2"/><path d="M66 13.5q10 2 13 8.5-3 6.5-13 8.5z" fill="#f03e3e"/>
        <path d="M18 13l-6-11h9l9 11z" fill="#f03e3e"/><path d="M18 31l-6 5h9l9-5z" fill="#c92a2a"/><circle cx="52" cy="22" r="4.2" fill="#74c0fc" stroke="#495057" stroke-width="1.4"/>`,
      front: '' },
  };
  const rideSvg = (k, part) => `<svg viewBox="0 0 ${RIDES[k].w} ${RIDES[k].h}" aria-hidden="true">${RIDES[k][part]}</svg>`;
  A.petRides = RIDES;
  A.petRideArt = k => (RIDES[k] ? `<svg viewBox="0 0 ${RIDES[k].w} ${RIDES[k].h}" aria-hidden="true">${RIDES[k].back}${RIDES[k].front}</svg>` : '');
  // 每種交通工具只能走自己的路線（舊的「照平常走路」等不屬於牠的，換成牠的第一條路線）
  const rideOf = id => { const r = P?.rides?.[id]; if (!r || !RIDES[r.v]) return null; return RIDES[r.v].routes.some(x => x[0] === r.route) ? r : { ...r, route: RIDES[r.v].routes[0][0] }; };
  // 主人上傳的外觀：整張圖放在寵物後面（同樣的大小），寵物坐在圖的上半部
  const rideImgs = store.get('indoor.rideimg', {});   // 雲端檔案 id → data URL
  const customOf = (owner, v) => { const id = P?.rideImgs?.[owner + '|' + v]; return id && rideImgs[id] ? rideImgs[id] : ''; };
  const rideLift = (owner, v) => { const D = RIDES[v]; return customOf(owner, v) ? Math.round(34 - (34 - D.bottom - D.h) - D.h * 0.42) : D.lift; };
  function rideParts(owner, v) {
    const D = RIDES[v], st = `width:${D.w}px;height:${D.h}px;left:${D.left}px;bottom:${D.bottom}px`, img = customOf(owner, v);
    if (img) return { back: `<span class="rv rv-back rv-img" style="${st}"><img src="${img}" alt=""></span>`, front: '' };
    return { back: `<span class="rv rv-back" style="${st}">${rideSvg(v, 'back')}</span>`, front: D.front ? `<span class="rv rv-front" style="${st}">${rideSvg(v, 'front')}</span>` : '' };
  }
  const rideWrap = (x, inner) => {
    const r = rideOf(x.id);
    if (!r || r.show === false) return inner;
    const pp = rideParts(x.owner, r.v);
    return pp.back + inner + pp.front;
  };
  async function loadRideImgs() {
    const want = Object.values(P?.rideImgs || {});
    Object.keys(rideImgs).forEach(id => { if (!want.includes(id)) delete rideImgs[id]; });
    for (const id of want.filter(id => !rideImgs[id])) {
      try { const r = await A.api('rideImage', { id }); if (r.img) { rideImgs[id] = r.img; paintMap(true); if (A.currentTab() === 'pet') render(); } } catch { /* 下次再試 */ }
    }
    try { store.set('indoor.rideimg', rideImgs); } catch { /* 空間不夠就只留在記憶體 */ }
  }
  const imgs = store.get('indoor.petimg', {});   // 圖片 id → data URL（存在這台裝置，有換才重新下載）
  const look = x => (x.imgId && imgs[x.imgId] ? `<img src="${imgs[x.imgId]}" alt="">` : CAT);
  async function loadImgs() {
    for (const x of (P?.pets || []).filter(y => y.imgId && !imgs[y.imgId] && y.status !== '覓食')) {
      try { const r = await A.api('petImage', { id: x.id }); if (r.img) { imgs[x.imgId] = r.img; store.set('indoor.petimg', imgs); paintMap(true); if (A.currentTab() === 'pet') render(); } } catch { /* 下次再試 */ }
    }
  }

  async function load() {
    if (loading) return loading;
    loading = (async () => {
      try { P = await A.api('getPets'); pAt = Date.now(); } catch (e) { if (A.currentTab() === 'pet') toast('寵物讀取失敗：' + e.message); }
      loading = null;
      if (A.currentTab() === 'pet') render();
      paintMap(true);
      events();
      loadImgs();
      loadRideImgs();
      return P;
    })();
    return loading;
  }

  // ── 座位地圖上的寵物層 ──
  let layer = null, pets = {}, raf = 0, geo = null, geoAt = 0;
  function host() { const w = document.querySelector('#tab-seats .map-wrap'); return w ? { wrap: w, host: w.parentElement } : null; }
  // 寵物走的路：所有座位外面一圈（四個邊），不會蓋到大頭照
  function geometry() {
    const h = host();
    if (!h) return null;
    const hr = h.host.getBoundingClientRect(), seats = [...h.wrap.querySelectorAll('.seat')].map(s => s.getBoundingClientRect()).filter(r => r.width);
    if (!seats.length) return null;
    const wr = h.wrap.getBoundingClientRect(), pad = 17;
    const L = Math.max(wr.left + 14, Math.min(...seats.map(r => r.left)) - pad) - hr.left, R = Math.min(wr.right - 14, Math.max(...seats.map(r => r.right)) + pad) - hr.left;
    const T = Math.max(wr.top + 14, Math.min(...seats.map(r => r.top)) - pad) - hr.top, B = Math.min(wr.bottom - 14, Math.max(...seats.map(r => r.bottom)) + pad) - hr.top;
    const board = (h.wrap.querySelector('[data-tch]') || h.wrap.querySelector('[data-id="board"]'))?.getBoundingClientRect();
    // 走道：兩排座位中間（毛毛蟲用）
    const cols = [...new Map(seats.map(r => [Math.round(r.left), r])).values()].sort((a, b) => a.left - b.left);
    const lanes = [L].concat(cols.slice(1).map((c, i) => (cols[i].right + c.left) / 2 - hr.left).filter((x, i, a) => !i || x - a[i - 1] > 8), [R]);
    return { lanes, L, R, T, B, w: R - L, h: B - T, per: 2 * (R - L + B - T), board: board && board.width ? { x: board.left + board.width / 2 - hr.left, y: board.top + board.height * 0.62 - hr.top } : { x: (L + R) / 2, y: T - 30 }, hr,
      stage: board && board.width ? { left: board.left - hr.left, top: board.top - hr.top, w: board.width, h: board.height } : { left: (L + R) / 2 - 90, top: T - 70, w: 180, h: 56 } };
  }
  // 周長上的位置 s（0～1）→ 座標
  function along(g, s) {
    let d = ((s % 1) + 1) % 1 * g.per;
    if (d < g.w) return { x: g.L + d, y: g.T };
    d -= g.w; if (d < g.h) return { x: g.R, y: g.T + d };
    d -= g.h; if (d < g.w) return { x: g.R - d, y: g.B };
    d -= g.w; return { x: g.L, y: g.B - d };
  }
  function ensureLayer() {
    const h = host();
    if (!h) return null;
    h.host.style.position = 'relative';
    if (!layer || !h.host.contains(layer)) { layer = document.createElement('div'); layer.id = 'petLayer'; h.host.appendChild(layer); }
    return layer;
  }
  function paintMap(force) {
    if (A.currentTab() !== 'seats' || !P) { stop(); return; }
    const ly = ensureLayer();
    if (!ly) return;
    const alive = P.pets.filter(x => x.status === '寵物'), eggs = P.pets.filter(x => x.status === '蛋');
    // 蛋：排在講台上
    // 蛋：照生出來的順序，一顆一顆排在講台上（排不下就換一行），下面寫座號
    let eh = `<div class="pet-eggs">${eggs.slice().sort((a, b) => a.born - b.born).map(x => `<button type="button" class="pet-egg" data-pet="${esc(x.id)}" title="${esc(nm(x.owner))} 的寵物蛋">${EGG}<small>${esc(A.parseKey(x.owner).code || '')}</small></button>`).join('')}</div>`;
    // 寵物：保留走到哪裡
    const keep = {};
    alive.forEach(x => { keep[x.id] = Object.assign(pets[x.id] || { s: Math.random(), dir: Math.random() < 0.5 ? 1 : -1, walk: true, until: 0, face: 1, mode: 'path' }, { feeders: x.feeders || [] }); });
    pets = keep;
    geo = geometry(); geoAt = Date.now();
    if (geo) Object.entries(pets).forEach(([id, p]) => syncRide(p, id));
    if (force || ly.dataset.sig !== alive.map(x => x.id + (x.imgId || '') + JSON.stringify(rideOf(x.id) || '') + (rideOf(x.id) ? customOf(x.owner, rideOf(x.id).v).length : '')).join() + '|' + eggs.length) {
      ly.dataset.sig = alive.map(x => x.id + (x.imgId || '') + JSON.stringify(rideOf(x.id) || '') + (rideOf(x.id) ? customOf(x.owner, rideOf(x.id).v).length : '')).join() + '|' + eggs.length;
      ly.innerHTML = eh + alive.map(x => { const r = rideOf(x.id); return `<button type="button" class="pet${r && r.show !== false ? ' riding ride-' + r.v : ''}" data-pet="${esc(x.id)}" title="${esc(petName(x))}${r ? `（搭${RIDES[r.v].name}）` : ''}"${r && r.show !== false ? ` style="--lift:${rideLift(x.owner, r.v)}px"` : ''}><span class="pet-rig">${rideWrap(x, `<span class="pet-body">${look(x)}</span>`)}</span><i class="pet-shadow"></i><span class="pet-zz" aria-hidden="true">💤</span></button>`; }).join('');
    }
    geo = geometry(); geoAt = Date.now();
    placeEggs();
    if (party?.phase === 'play') party.ids.forEach((id, i) => { const el = layer.querySelector(`.pet[data-pet="${CSS.escape(id)}"]`); if (el) { el.classList.add('party', PARTY[party.ids.length].cls); el.classList.toggle('lead', i === 0); el.style.setProperty('--i', i); } });
    stop(); raf = requestAnimationFrame(tick);   // 每次都重新開始（之前在背景時排的那一次可能一直沒跑）
  }
  function placeEggs() {
    const box = layer?.querySelector('.pet-eggs');
    if (!box || !geo) return;
    Object.assign(box.style, { left: geo.stage.left + 'px', top: geo.stage.top + 'px', width: geo.stage.w + 'px', height: geo.stage.h + 'px' });
    // 蛋太多、講台太小：整排一起縮小，全部都放得進講台（最小縮到一半）
    const n = box.children.length, W = geo.stage.w - 12, H = geo.stage.h - 8;
    let k = 1;
    for (; k > 0.3; k -= 0.05) { const per = Math.max(1, Math.floor(W / (30 * k))); if (Math.ceil(n / per) * 44 * k <= H) break; }
    box.style.setProperty("--es", Math.max(0.3, k).toFixed(2));
    box.classList.toggle("tiny", k < 0.6);   // 很小的時候不寫座號，免得字疊在一起
  }
  // ── 🎉 寵物之間的互動：兩隻以上時偶爾（30～70 秒一次）聚在一起；2～6 隻，每種隻數的互動都不一樣，平常還是各走各的 ──
  const PARTY = {
    2: { name: '💕 碰碰鼻子', cls: 'pa-nuzzle', ms: 4200, gap: 26 },
    3: { name: '🎶 圍在一起跳舞', cls: 'pa-dance', ms: 5200, gap: 30 },
    4: { name: '🚂 排隊開火車，嘟嘟！', cls: 'pa-train', ms: 6500, gap: 27 },
    5: { name: '📸 拍團體照，笑一個！', cls: 'pa-photo', ms: 5200, gap: 30 },
    6: { name: '🤸 疊羅漢！小心…', cls: 'pa-stack', ms: 6200, gap: 28 },
  };
  let party = null, nextParty = Date.now() + 15000 + Math.random() * 20000, forceK = 0;
  if (A.TEST) A.testPetParty = k => { forceK = k; nextParty = 0; };   // 測試模式：馬上來一場 k 隻的聚會
  // 每一隻要站的位置（沿著教室的邊邊排；疊羅漢往上疊；火車沿著邊邊一起走）
  function partySlots(q) {
    const k = q.ids.length, g = PARTY[k].gap;
    if (k === 4 && q.phase === 'play') return q.ids.map((_, i) => along(geo, q.s - i * g / geo.per));
    const P0 = along(geo, q.s), P1 = along(geo, q.s + 3 / geo.per), tl = Math.hypot(P1.x - P0.x, P1.y - P0.y) || 1, tx = (P1.x - P0.x) / tl, ty = (P1.y - P0.y) / tl;
    if (k === 6) return [[-1, 0], [0, 0], [1, 0], [-0.5, 1], [0.5, 1], [0, 2]].map(([u, v]) => ({ x: P0.x + tx * u * g, y: P0.y + ty * u * g - v * 21 }));
    return q.ids.map((_, i) => ({ x: P0.x + tx * (i - (k - 1) / 2) * g, y: P0.y + ty * (i - (k - 1) / 2) * g }));
  }
  function startParty() {
    const free = Object.entries(pets).filter(([, p]) => (p.mode === 'path' || p.mode === 'ride') && p.x != null && !(p.fly && p.fly.k < 1) && !(p.warp && p.warp !== 'hover'));   // 搭交通工具的也會來（火箭在空中時等牠降落）
    if (free.length < 2) { nextParty = Date.now() + 20000; return; }
    const k = Math.min(free.length, forceK || 2 + Math.floor(Math.random() * (Math.min(6, free.length) - 1)));
    forceK = 0;
    const pick = free.sort(() => Math.random() - 0.5).slice(0, k);
    // 集合地點：上面或下面的邊（橫的才排得開、疊得起來），靠近第一隻、離轉角遠一點
    const p0 = pick[0][1], x = Math.max(geo.L + 80, Math.min(geo.R - 80, p0.x));
    const s0 = p0.y < (geo.T + geo.B) / 2 ? (x - geo.L) / geo.per : (geo.w + geo.h + (geo.R - x)) / geo.per;
    party = { ids: pick.map(([id]) => id), s: s0, phase: 'gather', until: Date.now() + 9000 };
    pick.forEach(([, p], i) => { if (p.hasV) dismount(p); p.party = i + 1; p.mode = 'party'; p.ang = 0; });
  }
  function playParty() {
    const q = party, k = q.ids.length, def = PARTY[k];
    q.phase = 'play'; q.until = Date.now() + def.ms;
    const slots = partySlots(q), cx = slots.reduce((t, a) => t + a.x, 0) / k, cy = Math.min(...slots.map(a => a.y));
    q.ids.forEach((id, i) => { const pp = pets[id]; if (pp) pp.face = k === 2 ? (i === 0 ? 1 : -1) : (slots[i].x <= cx ? 1 : -1); });
    layer.querySelectorAll('.pet').forEach(el => {
      const i = q.ids.indexOf(el.dataset.pet);
      if (i < 0) return;
      el.classList.add('party', def.cls); el.classList.toggle('lead', i === 0); el.style.setProperty('--i', i);
    });
    const deco = {
      2: '<span class="pf-up">💕</span><span class="pf-up d2">❤️</span><span class="pf-up d3">💗</span>',
      3: '<span class="pf-up">🎵</span><span class="pf-up d2">🎶</span><span class="pf-up d3">♪</span><span class="pf-disco">🪩</span>',
      4: '<span class="pf-toot">💨</span>',
      5: '<span class="pf-cam">📸</span><span class="pf-flash"></span>',
      6: '<span class="pf-boom">🎉</span><span class="pf-boom d2">🎊</span><span class="pf-boom d3">✨</span>',
    }[k];
    q.fx = fx(`${deco}<span class="pf-say">${def.name}</span>`, 'party-fx pk' + k, cx, cy - 36);
  }
  function endParty() {
    const q = party; party = null;
    q.fx?.remove();
    layer?.querySelectorAll('.pet.party').forEach(el => el.classList.remove('party', 'lead', ...Object.values(PARTY).map(d => d.cls)));
    q.ids.forEach(id => { const pp = pets[id]; if (!pp) return; delete pp.party; pp.mode = 'back'; if (pp.park) pp.to = { x: pp.park.x, y: pp.park.y }; else { pp.s = nearestS(pp); pp.to = along(geo, pp.s); } });
    nextParty = Date.now() + 30000 + Math.random() * 40000;
  }
  let last = 0;
  function tick(t) {
    raf = 0;
    if (A.currentTab() !== 'seats' || document.hidden || !layer) return;
    const dt = Math.min(0.1, (t - (last || t)) / 1000); last = t;
    if (Date.now() - geoAt > 1500) { geo = geometry(); geoAt = Date.now(); placeEggs(); }
    if (geo) {
      // 聚會：時間到就找幾隻來；走到定位就開始；時間到就散會
      if (!party && !playing && Date.now() > nextParty && Object.keys(pets).length >= 2) startParty();
      let slots = null;
      if (party) {
        if (party.ids.some(id => !pets[id])) endParty();
        else {
          if (party.phase === 'play' && party.ids.length === 4) party.s += 30 * dt / geo.per;   // 火車往前開
          slots = partySlots(party);
          const there = party.ids.every((id, i) => Math.hypot(pets[id].x - slots[i].x, pets[id].y - slots[i].y) < 1.5);
          if (party.phase === 'gather' && (there || Date.now() > party.until)) { playParty(); slots = partySlots(party); }
          else if (party.phase === 'play' && Date.now() > party.until) { endParty(); slots = null; }
          if (party?.phase === 'play' && party.ids.length === 4 && party.fx) { party.fx.style.left = slots[0].x + 'px'; party.fx.style.top = (slots[0].y - 36) + 'px'; }
        }
      }
      Object.entries(pets).forEach(([id, p]) => {
        const el = layer.querySelector(`.pet[data-pet="${CSS.escape(id)}"]`);
        if (!el) return;
        if (p.x == null || isNaN(p.x)) { const q = along(geo, p.s); p.x = q.x; p.y = q.y; }
        let b;
        const inParty = !!(p.party && party && slots);
        let moving = false;
        if (inParty) {
          const to = slots[p.party - 1];
          if (party.phase === 'gather') {
            const step = 46 * dt, dx = to.x - p.x, dy = to.y - p.y, d = Math.hypot(dx, dy);
            if (Math.abs(dx) > 0.5) p.face = dx > 0 ? 1 : -1;
            b = d <= step ? { ...to } : { x: p.x + dx / d * step, y: p.y + dy / d * step };
            moving = d > step;
          } else {
            if (party.ids.length === 4 && Math.abs(to.x - p.x) > 0.01) p.face = to.x > p.x ? 1 : -1;   // 火車：面向前進的方向
            b = to; moving = party.ids.length === 4;
          }
        } else if (p.mode === 'ride' && !napCheck(p)) {
          b = rideStep(p, dt);
          moving = true;
        } else if (p.mode === 'path') {
          // 走一段、停一下；偶爾去餵過牠的同學旁邊睡覺（這週餵越多次，越常去）
          if (Date.now() > p.until) {
            const spot = maybeSleep(p);
            if (spot) { if (p.hasV) dismount(p); p.mode = 'go'; p.to = spot.pos; p.seat = spot.seat; p.walk = true; }
            else { p.walk = Math.random() < 0.72; p.until = Date.now() + (p.walk ? 3000 + Math.random() * 5000 : 1200 + Math.random() * 2200); if (p.walk && Math.random() < 0.25) p.dir *= -1; }
          }
          if (p.mode === 'path') {
            const a = along(geo, p.s);
            if (p.walk) p.s += p.dir * 28 * dt / geo.per;
            b = along(geo, p.s);
            if (Math.abs(b.x - a.x) > 0.01) p.face = b.x > a.x ? 1 : -1;
          }
        }
        if (!inParty && p.mode !== 'path' && p.mode !== 'ride') {
          if (p.mode === 'sleep') {
            const s2 = seatSpot(p.seat);   // 座位表重畫、縮放時跟著座位
            if (s2) p.to = s2;
            b = p.to;
            if (Date.now() > p.until) { p.mode = 'back'; if (p.park) p.to = { x: p.park.x, y: p.park.y }; else { p.s = nearestS(p.to); p.to = along(geo, p.s); } }
          } else {
            const step = 34 * dt, dx = p.to.x - p.x, dy = p.to.y - p.y, d = Math.hypot(dx, dy);
            if (Math.abs(dx) > 0.5) p.face = dx > 0 ? 1 : -1;
            if (d <= step) { b = { ...p.to }; if (p.mode === 'go2ride') { p.mode = 'ride'; } else if (p.mode === 'go') { p.mode = 'sleep'; p.until = Date.now() + 9000 + Math.random() * 9000; } else if (p.park) { remount(p, id); b = { x: p.x, y: p.y }; } else { p.mode = 'path'; p.until = 0; if (p.ride || p.resync) { p.x = b.x; p.y = b.y; p.ride = null; p.resync = false; syncRide(p, id); } } }
            else b = { x: p.x + dx / d * step, y: p.y + dy / d * step };
          }
        }
        p.x = b.x; p.y = b.y;
        el.style.transform = `translate(${b.x - 17}px, ${b.y - 30}px)`;
        el.classList.toggle('walk', inParty ? moving : p.mode === 'go' || p.mode === 'go2ride' || p.mode === 'back' || p.mode === 'ride' || (p.mode === 'path' && p.walk));
        const ang = (!inParty && p.mode === 'ride' && p.ang) || 0;
        el.style.setProperty('--ang', ang.toFixed(1) + 'deg');
        el.classList.toggle('tilt', Math.abs(ang) > 30);   // 直立的時候不畫影子
        el.classList.toggle('warp-out', p.mode === 'ride' && p.warp === 'out');
        el.classList.toggle('warp-in', p.mode === 'ride' && p.warp === 'in');
        el.classList.toggle('sleep', p.mode === 'sleep');
        el.classList.toggle('off', !!p.park);
        paintPark(id, p);
        el.style.setProperty('--face', p.face);
      });
    }
    raf = requestAnimationFrame(tick);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
  // ── 🚗 搭交通工具的走法（每種都不一樣）──
  function rideStep(p, dt) {
    const r = p.ride, g = geo, now = Date.now();
    if (r.v === 'worm') {   // 走道蛇行：一伸一縮（速度忽快忽慢），轉彎時身體慢慢轉過去
      const W = wormPath(r.route), t = now / 1000;
      if (!W) return { x: p.x, y: p.y };
      p.wd ??= 0;
      const prev = wormAt(W, p.wd);
      p.wd = (p.wd + 26 * Math.pow(Math.max(0, Math.sin(t * 3.2)), 2) * 2 * dt) % W.len;
      const q = wormAt(W, p.wd), vx = q.x - prev.x, vy = q.y - prev.y;
      if (Math.abs(vx) > 0.05 && Math.abs(vx) > Math.abs(vy)) p.face = vx > 0 ? 1 : -1;
      if (Math.hypot(vx, vy) > 0.01) {
        const target = Math.abs(vx) >= Math.abs(vy) ? 0 : (vy > 0 ? 90 : -90) * p.face;   // 往下爬：頭朝下；往上爬：頭朝上
        p.ang = (p.ang || 0) + (target - (p.ang || 0)) * Math.min(1, dt * 5);
      }
      return q;
    }
    if (r.v === 'ufo') {
      p.ang = 0;
      if (r.route === 'warp') {   // 盤旋 → 咻地消失 → 在教室邊邊另一個地方出現
        const W = p.wz ||= { ph: 'hover', until: now + 3000 + Math.random() * 3000, at: { x: p.x, y: p.y } };
        if (now > W.until) {
          if (W.ph === 'hover') { W.ph = 'out'; W.until = now + 650; }
          else if (W.ph === 'out') { W.ph = 'in'; W.until = now + 650; p.s = Math.random(); W.at = along(g, p.s); p.face = Math.random() < 0.5 ? 1 : -1; }
          else { W.ph = 'hover'; W.until = now + 3000 + Math.random() * 3000; }
        }
        p.warp = W.ph;
        const t = now / 1000;
        return { x: W.at.x + Math.sin(t * 1.7) * 6, y: W.at.y + Math.sin(t * 2.3) * 3 };
      }
      p.warp = '';
      const a = along(g, p.s);   // 鋸齒形：沿著邊前進，一邊左右（或上下）來回
      p.s += (r.route === 'ccw' ? -1 : 1) * 46 * dt / g.per;
      const q = along(g, p.s), tl = Math.hypot(q.x - a.x, q.y - a.y) || 1, nx = -(q.y - a.y) / tl, ny = (q.x - a.x) / tl;
      if (Math.abs(q.x - a.x) > 0.01) p.face = q.x > a.x ? 1 : -1;
      const ph = (now / 650) % 2, tri = (ph < 1 ? ph : 2 - ph) * 2 - 1;
      return { x: q.x + nx * tri * 11, y: q.y + ny * tri * 11 };
    }
    if (r.v === 'car' || r.v === 'ring') {
      const a = along(g, p.s);
      p.s += (r.route === 'ccw' ? -1 : 1) * (r.v === 'car' ? 72 : 12) * dt / g.per;
      const q = along(g, p.s);
      if (Math.abs(q.x - a.x) > 0.01) p.face = q.x > a.x ? 1 : -1;
      p.ang = 0;
      if (r.v === 'ring') { const t = now / 1000, sp = r.route === 'ccw' ? -1 : 1; return { x: q.x + Math.cos(t * 1.4 * sp) * 16, y: q.y + Math.sin(t * 1.4 * sp) * 11 }; }   // 轉小圈圈
      return q;
    }
    if (r.v === 'boat') {   // 一條直線來回；到岸停一下、掉頭
      const H = r.route !== 'v', len = H ? g.w : g.h;
      p.bt ??= Math.random(); p.bd ??= 1; p.edge ??= 0;
      if (now < (p.wait || 0)) return boatAt(H, p.bt, p.edge);
      p.bt += p.bd * 30 * dt / len;
      if (p.bt >= 1 || p.bt <= 0) { p.bt = Math.max(0, Math.min(1, p.bt)); p.bd *= -1; p.wait = now + 1200 + Math.random() * 1500; }
      if (H) p.face = p.bd; p.ang = 0;
      return boatAt(H, p.bt, p.edge);
    }
    // 火箭：從教室一邊飛到另一邊（弧線或直線），落地休息一下再飛
    if (!p.fly || p.fly.k >= 1) {
      if (p.fly && !p.fly.rest) { p.fly.rest = now + 900 + Math.random() * 1600; }
      if (p.fly && now < p.fly.rest) return { x: p.x, y: p.y };
      const from = { x: p.x, y: p.y };
      let to;
      if (r.route === 'v') {   // 前後直飛：上邊 ↔ 下邊，x 隨機
        const top = Math.abs(p.y - g.T) < Math.abs(p.y - g.B);
        to = { x: Math.max(g.L, Math.min(g.R, p.x + (Math.random() - 0.5) * 70)), y: top ? g.B : g.T };   // 幾乎直直的，只稍微偏一點
      } else {                 // 斜斜飛到對面的邊
        const s0 = nearestS(from), s1 = s0 + 0.35 + Math.random() * 0.3;
        to = along(g, s1);
      }
      const d = Math.hypot(to.x - from.x, to.y - from.y) || 1, bend = r.route === 'v' ? 0 : (Math.random() < 0.5 ? -1 : 1) * Math.min(160, d * 0.45);
      p.fly = { from, to, c: { x: (from.x + to.x) / 2 + (-(to.y - from.y) / d) * bend, y: (from.y + to.y) / 2 + ((to.x - from.x) / d) * bend }, k: 0, len: d * (bend ? 1.15 : 1) };
    }
    const F = p.fly, k0 = F.k;
    F.k = Math.min(1, F.k + 130 * dt / F.len);
    const bz = k => ({ x: (1 - k) * (1 - k) * F.from.x + 2 * (1 - k) * k * F.c.x + k * k * F.to.x, y: (1 - k) * (1 - k) * F.from.y + 2 * (1 - k) * k * F.c.y + k * k * F.to.y });
    const q = bz(F.k), q0 = bz(k0), vx = q.x - q0.x, vy = q.y - q0.y;
    if (Math.hypot(vx, vy) > 0.01) {
      if (Math.abs(vx) > Math.hypot(vx, vy) * 0.25) p.face = vx >= 0 ? 1 : -1;   // 幾乎垂直時不換方向（不然每一格都左右翻、看起來在閃）
      p.ang = Math.max(-80, Math.min(80, (p.face > 0 ? Math.atan2(vy, vx) : -Math.atan2(vy, -vx)) * 180 / Math.PI));
    }
    if (F.k >= 1) { p.ang = 0; if (r.route !== 'v') p.s = nearestS(F.to); }
    return q;
  }
  // 船的航線：左右來回＝走離牠最近的上邊或下邊；前後來回＝最近的左邊或右邊（edge：0 上／左、1 下／右）
  // ── 下車／停車／上車：去聚會或去睡覺前先下交通工具（交通工具停在原地），回來再坐上去繼續原本的走法 ──
  function dismount(p) { p.park = { x: p.x, y: p.y, face: p.face, v: p.vk }; p.ang = 0; }
  function remount(p, id) {
    p.x = p.park.x; p.y = p.park.y; p.face = p.park.face; delete p.park; p.napAt = 0; delete p.wz; p.warp = '';
    if (p.resync) { p.resync = false; p.ride = null; p.mode = 'path'; p.until = 0; p.s = nearestS({ x: p.x, y: p.y }); syncRide(p, id); return; }   // 玩的時候主人改了設定：照新的設定
    p.s = nearestS({ x: p.x, y: p.y });
    p.mode = p.ride ? 'ride' : 'path'; p.until = 0;
  }
  // 搭車中偶爾（6～12 秒看一次）想去餵牠的人旁邊睡覺：火箭要先降落、船靠岸時也可以
  function napCheck(p) {
    const now = Date.now();
    if (!p.napAt) { p.napAt = now + 6000 + Math.random() * 6000; return false; }
    if (now < p.napAt || (p.fly && p.fly.k < 1) || (p.warp && p.warp !== 'hover')) return false;   // 火箭在空中、飛碟正在消失時不下車
    p.napAt = 0;
    const spot = maybeSleep(p);
    if (!spot) return false;
    dismount(p); p.mode = 'go'; p.to = spot.pos; p.seat = spot.seat; p.walk = true;
    return true;
  }
  function paintPark(id, p) {
    let pk = layer.querySelector(`.ride-park[data-for="${CSS.escape(id)}"]`);
    const r = rideOf(id);
    if (!p.park || !r || r.show === false) { pk?.remove(); return; }
    const owner = P.pets.find(y => y.id === id)?.owner || '', sig = r.v + customOf(owner, r.v).length;
    if (!pk || pk.dataset.v !== sig) {
      pk?.remove();
      pk = document.createElement('span');
      pk.className = `pet ride-park riding ride-${r.v}`; pk.dataset.for = id; pk.dataset.v = sig;
      const pp = rideParts(owner, r.v);
      pk.innerHTML = `<span class="pet-rig">${pp.back}${pp.front}</span><i class="pet-shadow"></i>`;
      layer.prepend(pk);   // 放在最下面，寵物走過去會在前面
    }
    pk.style.transform = `translate(${p.park.x - 17}px, ${p.park.y - 30}px)`;
    pk.style.setProperty('--face', p.park.face || 1);
  }
  // 毛毛蟲的路線：教室左邊 → 每一條走道（兩排座位中間）上下蛇行 → 右邊，再沿著上面爬回起點（rl 反過來）
  let wormCache = null;
  function wormPath(route) {
    if (!geo?.lanes) return null;
    const key = route + '|' + geoAt;
    if (wormCache?.key === key) return wormCache;
    const lanes = route === 'rl' ? geo.lanes.slice().reverse() : geo.lanes.slice();
    const pts = [{ x: lanes[0], y: geo.T }];
    lanes.forEach((x, i) => {
      const down = i % 2 === 0, end = down ? geo.B : geo.T;
      if (i) pts.push({ x, y: pts[pts.length - 1].y });
      pts.push({ x, y: end });
    });
    if (pts[pts.length - 1].y !== geo.T) pts.push({ x: lanes[lanes.length - 1], y: geo.T });
    pts.push({ x: lanes[0], y: geo.T });
    const seg = []; let len = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push([len, d, pts[i - 1], pts[i]]); len += d; }
    return wormCache = { key, seg, len, pts };
  }
  function wormAt(W, d) {
    d = ((d % W.len) + W.len) % W.len;
    const s = W.seg.find(x => d <= x[0] + x[1]) || W.seg[W.seg.length - 1], k = s[1] ? (d - s[0]) / s[1] : 0;
    return { x: s[2].x + (s[3].x - s[2].x) * k, y: s[2].y + (s[3].y - s[2].y) * k };
  }
  function wormNearest(W, pt) {
    let best = 0, bd = Infinity;
    for (let d = 0; d < W.len; d += 6) { const q = wormAt(W, d), e = Math.hypot(q.x - pt.x, q.y - pt.y); if (e < bd) { bd = e; best = d; } }
    return best;
  }
  const boatAt = (H, t, e) => (H ? { x: geo.L + t * geo.w, y: e ? geo.B : geo.T } : { x: e ? geo.R : geo.L, y: geo.T + t * geo.h });
  // 寵物設定改了：開始搭／換一種走法／下車走回邊邊
  function syncRide(p, id) {
    const r = rideOf(id), want = r ? r.v + ':' + r.route : '';
    p.hasV = !!r; p.vk = r?.v || '';
    if (p.park && (!r || p.park.v !== r.v)) delete p.park;   // 換了交通工具：停著的那台收起來
    if ((p.ride ? p.ride.v + ':' + p.ride.route : '') === want) return;
    if (p.party || p.park || p.mode === 'go' || p.mode === 'sleep') { p.ride = want ? { v: r.v, route: r.route } : null; p.resync = true; return; }   // 正在玩／睡覺：回來再換
    p.ride = want ? { v: r.v, route: r.route } : null;
    if (p.x == null || isNaN(p.x)) { const q = along(geo, p.s); p.x = q.x; p.y = q.y; }   // 剛出現：先放在邊邊上的位置
    delete p.fly; delete p.bt; delete p.bd; delete p.wait; delete p.edge; delete p.wz; delete p.wd; p.warp = ''; p.ang = 0;
    if (p.ride?.v === 'worm') { const W = wormPath(p.ride.route); if (W) { p.wd = wormNearest(W, { x: p.x, y: p.y }); p.mode = 'go2ride'; p.to = wormAt(W, p.wd); return; } }   // 先走到最近的走道
    if (p.ride && (p.ride.v === 'boat' || p.ride.v === 'rocket')) {   // 先走到出發的地方
      if (p.ride.v === 'boat') {
        const H = p.ride.route !== 'v', x = p.x ?? geo.L, y = p.y ?? geo.B;
        p.edge = H ? (Math.abs(y - geo.B) < Math.abs(y - geo.T) ? 1 : 0) : (Math.abs(x - geo.R) < Math.abs(x - geo.L) ? 1 : 0);
        p.bt = Math.max(0, Math.min(1, H ? (x - geo.L) / geo.w : (y - geo.T) / geo.h)); p.bd = Math.random() < 0.5 ? 1 : -1;
        p.mode = 'go2ride'; p.to = boatAt(H, p.bt, p.edge);
      }
      else p.mode = 'ride';
    } else if (p.ride) { p.mode = 'ride'; if (p.x != null) p.s = nearestS({ x: p.x, y: p.y }); }
    else if (p.mode === 'ride' || p.mode === 'go2ride') { p.mode = 'back'; p.s = nearestS({ x: p.x ?? 0, y: p.y ?? 0 }); p.to = along(geo, p.s); }
  }
  // 睡覺的位置：餵過牠的同學座位的右下角（大部分在名字那條上，不太遮到大頭照）
  function seatSpot(k) {
    const h = host(), id = A.seatOf?.(k), el = id && h?.wrap.querySelector(`[data-seat="${CSS.escape(id)}"]`);
    if (!el || !geo) return null;
    const r = el.getBoundingClientRect();
    return { x: r.right - geo.hr.left - 6, y: r.bottom - geo.hr.top + 2 };
  }
  function maybeSleep(p) {
    const total = p.feeders.reduce((t, f) => t + f.n, 0);
    if (!total || Math.random() > Math.min(0.45, total * 0.08)) return null;
    let r = Math.random() * total;
    const f = p.feeders.find(y => (r -= y.n) < 0) || p.feeders[0];
    const pos = seatSpot(f.key);
    return pos ? { pos, seat: f.key } : null;
  }
  // 睡醒：走回最近的邊邊
  function nearestS(pt) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < 200; i++) { const q = along(geo, i / 200), d = Math.hypot(q.x - pt.x, q.y - pt.y); if (d < bd) { bd = d; best = i / 200; } }
    return best;
  }
  window.addEventListener('resize', () => { geoAt = 0; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && A.currentTab() === 'seats') paintMap(); });

  // ── 動畫：得到蛋、按孵化（從座位跳到講台）、孵化、跑出去覓食 ──
  const seen = Object.assign({ egg: [], hatch: [], dead: [], gone: [], got: [] }, store.get('indoor.pets.seen', {}));
  // ── 孵化失敗（約 9/10）：孵出奇怪的東西然後離開。[圖示, 動畫, 配角, 是什麼, 做了什麼]（id 要和 Code.gs 的 PET_GONE 一樣）──
  const GONE = {
    bird: ['🐦', 'fly', '', '一隻小鳥', '拍拍翅膀，直接飛走了'],
    butterfly: ['🦋', 'zigzag', '', '一隻蝴蝶', '翩翩飛出窗外了'],
    mary: ['🙏', 'rise', '✨', '聖母瑪利亞', '帶著聖光，緩緩升空了'],
    jesus: ['✝️', 'rise', '✨', '耶穌', '發出溫暖的光，緩緩升空了'],
    buddha: ['🧘', 'lotus', '🪷', '佛祖', '坐在蓮花上，緩緩升空了'],
    oldman: ['👴', 'runR', '💼', '一位趕著上班的老伯', '大喊「要遲到了！」就衝出教室'],
    bento: ['🍱', 'trash', '🗑️', '一個中午沒人吃的便當', '被值日生拿去丟掉了'],
    ferrari: ['🏎️', 'tow', '🚚', '一台法拉利跑車', '因為沒有停車位，被拖吊車拖走了'],
    balloon: ['🎈', 'pop', '💥', '一顆氣球', '飄到天花板，「啵」一聲破掉了'],
    chicken: ['🐔', 'runL', '', '一隻雞', '咕咕叫著衝去操場了'],
    duck: ['🦆', 'waddle', '', '一隻鴨子', '搖搖擺擺去游泳池了'],
    rocket: ['🚀', 'rocket', '🔥', '一艘火箭', '倒數 3、2、1，發射到外太空了'],
    exam: ['📝', 'flutter', '💨', '一張 0 分的考卷', '被風吹出窗外，主人鬆了一口氣'],
    ghost: ['👻', 'fade', '', '一隻小幽靈', '說「抱歉，走錯棟了」就穿牆離開'],
    turtle: ['🐢', 'crawl', '', '一隻烏龜', '說要去上下一節課，慢慢爬走了'],
    unicorn: ['🦄', 'rainbow', '🌈', '一隻獨角獸', '踩著彩虹離開了'],
    alien: ['👽', 'ufo', '🛸', '一個外星人', '被飛碟光束吸回母艦了'],
    fish: ['🐟', 'flop', '💦', '一條魚', '在講台上彈了兩下，跳回大海了'],
    parcel: ['📦', 'deliver', '🛵', '一個快遞包裹', '地址寫錯，被外送員載走退回了'],
    ninja: ['🥷', 'poof', '💨', '一位忍者', '「咻」一聲變成煙霧消失了'],
    dino: ['🦖', 'fade', '', '一隻小恐龍', '發現自己早就絕種了，默默消失'],
    phone: ['📱', 'confiscate', '👮', '一支手機', '上課時間被教官沒收了'],
    bee: ['🐝', 'zigzag', '', '一隻蜜蜂', '嗡嗡嗡飛去找花了'],
    volcano: ['🌋', 'volcano', '💨', '一座迷你火山', '「噗」一聲噴完煙就不見了'],
    cash: ['💵', 'runR', '', '一張千元大鈔', '被總務收去當班費了'],
    pizza: ['🍕', 'runR', '', '一片披薩', '被隔壁班聞香拿走了'],
    snowman: ['⛄', 'melt', '', '一個雪人', '在台灣的天氣下融化了'],
    penguin: ['🐧', 'waddle', '', '一隻企鵝', '熱到受不了，走去找冷氣了'],
    dragon: ['🐉', 'fly', '', '一條龍', '說要去參加龍舟賽，飛走了'],
    santa: ['🎅', 'sleigh', '🦌', '聖誕老公公', '發現走錯季節，坐雪橇飛走了'],
    kite: ['🪁', 'zigzag', '', '一只風箏', '被風吹到天上去了'],
    robot: ['🤖', 'runR', '', '一台掃地機器人', '自己跑去掃走廊了'],
    cat: ['🐈', 'hop', '', '一隻野貓', '伸了個懶腰，跳窗出去曬太陽了'],
    frog: ['🐸', 'hop', '', '一隻青蛙', '呱呱兩聲，跳去荷花池了'],
    kangaroo: ['🦘', 'hop', '', '一隻袋鼠', '蹦蹦蹦跳回澳洲了'],
    tiger: ['🐯', 'runL', '', '一隻老虎', '被動物園園長追回去了'],
    boba: ['🧋', 'confiscate', '🧑‍🏫', '一杯珍珠奶茶', '被路過的老師拿走喝掉了'],
    icecream: ['🍦', 'melt', '', '一支冰淇淋', '還來不及吃就融化了'],
    octopus: ['🐙', 'poof', '💨', '一隻章魚', '噴了一團墨汁，溜回海裡了'],
    bat: ['🦇', 'zigzag', '', '一隻蝙蝠', '嫌教室太亮，飛去找山洞了'],
    bus: ['🚌', 'runL', '', '一台公車', '叭叭兩聲，載著空位開走了'],
    riceball: ['🍙', 'melt', '', '一顆飯糰', '被肚子餓的值日生一口吃掉了'],
    sock: ['🧦', 'flutter', '💨', '一隻臭襪子', '臭到自己飄出窗外了'],
    lightning: ['⚡', 'poof', '💥', '一道閃電', '「轟」一聲劈下來就不見了'],
    coffee: ['☕', 'confiscate', '🧑‍🏫', '一杯咖啡', '被熬夜改考卷的老師拿走了'],
    sheep: ['🐑', 'fade', '💤', '一隻綿羊', '數到第 100 隻就睡著，被夢帶走了'],
    hamster: ['🐹', 'runR', '', '一隻倉鼠', '跳上滾輪，跑去追夢了'],
    star: ['⭐', 'rise', '✨', '一顆星星', '回到夜空上班了'],
    tornado: ['🌪️', 'spin', '', '一陣小龍捲風', '轉啊轉的捲出教室了'],
    snail: ['🐌', 'crawl', '', '一隻蝸牛', '說要去上課，爬了一整天才到門口']
  };
  const goneText = x => { const g = GONE[x.gone] || ['❓', 'fade', '', '一個神秘的東西', '一溜煙就不見了']; return { g, what: g[3], act: g[4] }; };
  // 圖案：自己畫的 SVG（js/pet-art.js），沒有的才用 emoji
  const goneArt = id => window.PET_ART?.art?.[id] || GONE[id]?.[0] || '❓';
  const goneHelp = id => window.PET_ART?.help?.[id] || GONE[id]?.[2] || '';
  // 自己還有沒按孵化的蛋：打開座位時提醒一次
  let waitTold = false;
  function remindWait() {
    if (waitTold || A.isTeacher() || !A.me()) return;
    const n = P.pets.filter(x => x.status === '待孵' && x.owner === A.me()).length;
    if (!n) return;
    waitTold = true;
    banner(`🥚 你有 <b>${n} 顆寵物蛋</b>還沒孵化！<br><span class="muted small">到「🐾 寵物」按「🐣 孵化」，蛋才會放到講台上。</span>`, 4000);
  }
  // 播放：蛋裂開 → 孵出來的東西做牠的動畫離開，頭上的對話框（約 3 秒）
  // 訊息視窗：圖＋說明，按「確定」才繼續（動畫在按下之後才開始播）
  function notice(pic, html, btn = '確定') {
    return new Promise(res => {
      const w = document.createElement('div');
      w.className = 'pet-notice';
      w.innerHTML = `<div class="pn-card" role="alertdialog" aria-modal="true"><div class="pn-pic">${pic}</div><div class="pn-text">${html}</div>
        <button type="button" class="btn btn--primary wide">${btn}</button></div>`;
      document.body.appendChild(w);
      const b = w.querySelector('button');
      b.focus();
      b.addEventListener('click', async () => {
        w.remove();
        // 按確定後：把講台捲到畫面中間，再開始播動畫（不然可能在畫面外面）
        const st = host()?.wrap.querySelector('[data-tch]');
        if (st) { const r = st.getBoundingClientRect(); if (r.top < 120 || r.bottom > innerHeight - 40) { st.scrollIntoView({ behavior: 'smooth', block: 'center' }); await wait(650); } }
        res();
      });
    });
  }
  async function playGone(x, at) {
    const { g, what, act } = goneText(x);
    await notice(goneArt(x.gone), `<h3>🥚 ${esc(nm(x.owner))} 的寵物蛋孵化了！</h3><p>竟然是<b>${esc(what)}</b>！</p><p class="muted small">只有約 1/10 的蛋會孵出真正的寵物，其他會孵出奇怪的東西，然後離開教室。</p>`, '真的假的?!!!?');
    if (A.currentTab() !== 'seats') return;
    geo = geometry(); if (geo) at = geo.board;
    const help = goneHelp(x.gone);
    const el = fx(`<span class="g-egg">${EGG}</span>${help ? `<span class="g-help h-${g[1]}">${help}</span>` : ''}${g[1] === 'ufo' ? '<span class="g-beam"></span>' : ''}<span class="g-actor a-${g[1]}">${goneArt(x.gone)}</span><span class="g-say">${esc(what)}<br>${esc(act)}</span>`, 'gone-fx', at.x, at.y);
    banner(`🥚 <b>${esc(nm(x.owner))}</b> 的寵物蛋孵化了……竟然是<b>${esc(what)}</b>！<br>${esc(act)}。<span class="muted small">（只有約 1/10 的蛋會孵出真正的寵物）</span>`, 7400);
    await wait(7800); el.remove();
  }
  const markSeen = (k, id) => { seen[k] = [...seen[k].filter(x => x !== id), id].slice(-100); store.set('indoor.pets.seen', seen); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let playing = false;
  function banner(html, ms = 3500) {
    let el = $('#petMsg');
    if (!el) { el = document.createElement('div'); el.id = 'petMsg'; document.body.appendChild(el); el.addEventListener('click', () => el.classList.remove('show')); }
    el.innerHTML = html; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
  }
  function seatCenter(k) {
    const h = host(), id = A.seatOf?.(k), el = id && h?.wrap.querySelector(`[data-seat="${CSS.escape(id)}"]`);
    if (!el || !geo) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - geo.hr.left, y: r.top + r.height / 2 - geo.hr.top };
  }
  function fx(html, cls, x, y) {
    const el = document.createElement('div');
    el.className = 'pet-fx ' + cls; el.innerHTML = html;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    layer.appendChild(el);
    return el;
  }
  async function events() {
    if (playing || !P || A.currentTab() !== 'seats' || A.isGuest()) return;
    if (!ensureLayer()) return;
    geo = geometry(); if (!geo) return;
    const recent = t => Date.now() - t < 2 * 864e5;   // 換手機時，太久以前的就不重播
    const todo = [
      ...P.pets.filter(x => x.status === '待孵' && !seen.got.includes(x.id) && recent(x.born)).map(x => ['got', x]),
      ...P.pets.filter(x => x.status === '蛋' && !seen.egg.includes(x.id) && recent(x.hatch - 864e5)).map(x => ['egg', x]),
      ...P.pets.filter(x => (x.status === '寵物' || x.status === '覓食') && !seen.hatch.includes(x.id) && recent(x.hatch)).map(x => ['hatch', x]),
      ...P.pets.filter(x => x.status === '覓食' && !seen.dead.includes(x.id) && recent(x.died)).map(x => ['dead', x]),
      ...(P.gone || []).filter(x => !seen.gone.includes(x.id) && recent(x.hatch)).map(x => ['gone', x]),
    ];
    if (!todo.length) { P.pets.forEach(x => { if (x.status === '待孵' && !seen.got.includes(x.id)) markSeen('got', x.id); if (x.status !== '待孵' && !seen.egg.includes(x.id)) markSeen('egg', x.id); if (x.status !== '蛋' && x.status !== '待孵' && !seen.hatch.includes(x.id)) markSeen('hatch', x.id); if (x.status === '覓食' && !seen.dead.includes(x.id)) markSeen('dead', x.id); }); remindWait(); (P.gone || []).forEach(x => { if (!seen.gone.includes(x.id)) markSeen('gone', x.id); }); return; }
    playing = true;
    for (const [kind, x] of todo) {
      if (A.currentTab() !== 'seats') break;
      geo = geometry();
      const to = geo.board;
      if (kind === 'got') {   // 得到一顆蛋：從座位蹦出來又落回座位（還沒按孵化）
        const from = seatCenter(x.owner) || { x: to.x, y: geo.T + 40 };
        const e = fx(EGG, 'egg-got', from.x, from.y);
        banner(`🥚 <b>${esc(nm(x.owner))}</b> 被加分${x.reason ? `（${esc(x.reason)}）` : ''}，得到一顆<b>寵物蛋</b>！<br><span class="muted small">${x.owner === A.me() ? '到「🐾 寵物」按「🐣 孵化」，蛋才會放到講台上。' : '主人按「孵化」之後，蛋才會放到講台上。'}</span>`, 3500);
        await wait(1600); e.remove();
        markSeen('got', x.id);
      } else if (kind === 'egg') {
        const slot = layer.querySelector(`.pet-egg[data-pet="${CSS.escape(x.id)}"]`);
        let dest = to;
        if (slot) { const r = slot.getBoundingClientRect(); dest = { x: r.left + r.width / 2 - geo.hr.left, y: r.top + r.height * 0.4 - geo.hr.top }; slot.style.visibility = 'hidden'; }
        const from = seatCenter(x.owner) || { x: dest.x, y: geo.T + 40 };
        const e = fx(EGG, 'egg-fly', from.x, from.y);
        e.style.setProperty('--dx', (dest.x - from.x) + 'px'); e.style.setProperty('--dy', (dest.y - from.y) + 'px');
        banner(`🐣 <b>${esc(nm(x.owner))}</b> 按了「孵化」，寵物蛋跳到講台上了！<br><span class="muted small">一天後揭曉：只有約 1/10 會孵出真正的寵物。</span>`, 3500);
        await wait(1500); e.remove();
        if (slot) slot.style.visibility = '';
        markSeen('egg', x.id);
      } else if (kind === 'gone') {
        await playGone(x, to);
        markSeen('gone', x.id); markSeen('egg', x.id);
      } else if (kind === 'hatch') {
        await notice(look(x), `<h3>🎉 太幸運了！</h3><p><b>${esc(nm(x.owner))}</b> 的寵物蛋<b>真的孵出寵物</b>了！</p><p class="muted small">只有約 1/10 的機會。${x.owner === A.me() ? '到「🐾 寵物」可以幫牠取名字、上傳外觀。' : ''}</p>`, '確定，看牠出來');
        const e = fx(`<span class="hatch-egg">${EGG}</span><span class="hatch-pet">${look(x)}</span>`, 'egg-hatch', to.x, to.y);
        banner(`🎉 太幸運了！<b>${esc(nm(x.owner))}</b> 的寵物蛋<b>真的孵出寵物</b>了（只有約 1/10 的機會）！${x.owner === A.me() ? '<br><span class="muted small">到「🐾 寵物」可以上傳牠的外觀、取名字。</span>' : ''}`, 5000);
        await wait(2400); e.remove();
        markSeen('hatch', x.id);
      } else {
        // 飽足度 0：揹著空碗跑出去自己覓食
        await notice(look(x), `<h3>🍚 ${esc(petName(x))} 肚子餓了</h3><p>${esc(nm(x.owner))} 的寵物太久沒吃到罐罐，<b>要跑出去自己覓食</b>了…</p><p class="muted small">在商店或寵物卡買罐罐餵寵物，牠們就不會跑走。</p>`, '確定');
        const e = fx(`<span class="g-help h-runR">🍚</span><span class="g-actor a-runR">${look(x)}</span><span class="g-say">${esc(petName(x))}<br>肚子餓了，跑出去自己覓食了</span>`, 'gone-fx forage', to.x, to.y);
        banner(`🍚 <b>${esc(petName(x))}</b>（${esc(nm(x.owner))} 的寵物）太久沒吃到罐罐，肚子餓了，<b>跑出去自己覓食</b>了…`, 7400);
        await wait(7800); e.remove();
        markSeen('dead', x.id);
      }
      paintMap(true);
    }
    playing = false;
  }

  // ── 點寵物：愛心或音符＋叫聲，打開寵物卡 ──
  let ac = null;
  function chirp() {
    try {
      ac ||= new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime;
      [[880, 0], [1175, 0.11], [988, 0.22]].forEach(([f, d]) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(f, t + d); o.frequency.exponentialRampToValueAtTime(f * 1.25, t + d + 0.08);
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
        o.connect(g).connect(ac.destination); o.start(t + d); o.stop(t + d + 0.14);
      });
    } catch { /* 不支援就安靜 */ }
  }
  function burst(el) {
    const r = el.getBoundingClientRect(), hr = host().host.getBoundingClientRect();
    const notes = Math.random() < 0.5, set = notes ? ['🎵', '🎶', '♪'] : ['💗', '💕', '❤️'];
    if (notes) chirp();
    for (let i = 0; i < 6; i++) {
      const f = fx(set[i % set.length], 'pet-heart', r.left + r.width / 2 - hr.left, r.top - hr.top);
      f.style.setProperty('--hx', (Math.random() * 60 - 30) + 'px'); f.style.animationDelay = i * 70 + 'ms';
      setTimeout(() => f.remove(), 1400);
    }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('#petLayer [data-pet]');
    if (!b) return;
    e.stopPropagation(); e.preventDefault();
    const x = P?.pets.find(y => y.id === b.dataset.pet);
    if (!x) return;
    if (x.status === '寵物') { burst(b); setTimeout(() => openCard(x.id), 500); }
    else openCard(x.id);
  }, true);

  // 🍚 條：格數＝這隻自己的上限；紅色＝現在的飽足度；空格＝還能餵的 🍚
  const capOf = x => x.cap || P.max;
  const hpBar = x => {
    const sib = P.pets.filter(y => y.owner === x.owner && y.status !== '覓食' && y.id !== x.id), caps = capOf(x) + sib.reduce((s, y) => s + capOf(y), 0);
    const room = Math.max(0, capOf(x) - x.hp);
    return `<span class="pet-hp" title="飽足度">${Array.from({ length: capOf(x) }, (_, i) => `<i class="${i < x.hp ? 'on' : ''}">🍚</i>`).join('')}<b>${x.hp}/${capOf(x)}</b></span>
      <span class="muted small">${room ? `${x.status !== '寵物' ? '孵化後' : ''}還可以再餵 ${room} 🍚` : '吃飽了（到牠的上限）'}${sib.length ? `・主人的 ${sib.length + 1} 隻上限加起來 ${caps}/${P.max} 🍚` : ''}</span>`;
  };
  const full = x => x.hp >= capOf(x);
  const left = ms => { const m = Math.max(0, Math.round(ms / 60e3)); return m >= 60 ? `${Math.floor(m / 60)} 小時 ${m % 60} 分` : `${m} 分鐘`; };
  function cardHtml(x) {
    const mine = x.owner === A.me() || A.isTeacher();
    const isEgg = x.status === '蛋' || x.status === '待孵';
    let h = `<div class="pet-card${x.status === '覓食' ? ' dead' : ''}"><div class="pet-pic">${isEgg ? EGG : look(x)}</div><div class="pet-info">
      <b class="pet-nm">${isEgg ? '寵物蛋' : esc(petName(x))}${x.status === '覓食' ? ' 🍚' : ''}</b>
      <span class="muted small">主人：${esc(nm(x.owner))}${x.reason ? `・因為「${esc(x.reason)}」被加分` : ''}</span>
      ${x.status === '待孵' ? `<span class="small">🥚 還沒開始孵化：主人按「🐣 孵化」，蛋才會放到講台上，一天後孵化</span>${hpBar(x)}`
        : x.status === '蛋' ? `<span class="small pet-line" title="在講台上孵化中">🥚 孵化中・剩 ${left(x.hatch - Date.now())}・上限 ${capOf(x)}🍚</span>${hpBar(x)}`
        : x.status === '覓食' ? '<span class="small muted">肚子餓了，跑出去自己覓食了，謝謝牠陪伴大家。</span>' : hpBar(x)}
      ${x.fed && x.status === '寵物' ? `<span class="muted small">最近餵食：${esc(x.fed)}</span>` : ''}</div></div>
      ${x.status === '寵物' ? `<div class="pet-feeders"><b>🥫 最近一週餵牠的人</b>${(x.feeders || []).length ? `<div>${x.feeders.map(f => `<span class="pet-fd">${esc(nm(f.key))}<b>×${f.n}</b></span>`).join('')}</div><span class="muted small">餵越多次，牠越常跑去你的座位旁邊睡覺 💤</span>` : '<span class="muted small">這週還沒有人餵牠。</span>'}</div>` : ''}`;
    if (x.status === '寵物' && !A.isGuest()) h += `<div class="actions"><button type="button" class="btn btn--primary wide" data-act="petFeed" data-id="${esc(x.id)}"${full(x) ? ' disabled' : ''}>🥫 餵罐罐（${P.food} 點，+1 🍚）${full(x) ? '・吃飽了' : ''}</button></div>`;
    if (x.status === '待孵' && (x.owner === A.me() || A.isTeacher())) h += `<div class="actions"><button type="button" class="btn btn--primary wide" data-act="petIncubate" data-id="${esc(x.id)}">🐣 孵化（放到講台上）</button></div>`;
    if (A.isTeacher() && x.status !== '覓食') h += `<div class="actions"><button type="button" class="btn btn--danger wide" data-act="petDel" data-id="${esc(x.id)}">🗑 移除這${isEgg ? '顆蛋' : '隻寵物'}（導師）</button></div>`;
    h += rideBox(x);
    if (mine && x.status !== '覓食') h += `<details class="pet-edit"${x.status === '寵物' && !x.imgId && x.owner === A.me() ? ' open' : ''}><summary>✏️ 主人專屬：取名字、上傳外觀</summary>
      <label class="lv-f"><span>名字</span><input type="text" id="petNm" maxlength="12" value="${esc(x.name || '')}" placeholder="幫牠取個名字"></label>
      <label class="lv-f"><span>外觀圖片（建議 PNG 去背；沒上傳就是貓咪）</span><input type="file" id="petImg" accept="image/png,image/webp,image/gif,image/jpeg"></label>
      <div class="actions"><button type="button" class="btn wide" data-act="petSave" data-id="${esc(x.id)}">儲存</button></div></details>`;
    return h;
  }
  // ── 🚗 主人設定：搭哪一種、要不要顯示、怎麼走 ──
  function rideFormHtml(x, cur) {
    const owned = A.isTeacher() ? Object.keys(RIDES) : (P.owned?.[x.owner] || []);
    if (!owned.length) return `<p class="muted small">還沒有交通工具。到 🛒 商店的「🚗 寵物的交通工具」購買（每種 ${P.ridePrice || 10} 點，永久保存）。</p>`;
    const v = cur.v || '', D = RIDES[v];
    let h = `<div class="ride-pick">${[['', '🚶', '不搭']].concat(owned.filter(k => RIDES[k]).map(k => [k, RIDES[k].ico, RIDES[k].name])).map(([k, ico, n]) =>
      `<button type="button" data-act="rideV" data-v="${k}" aria-pressed="${v === k}">${k ? `<span class="ride-ico">${A.petRideArt(k)}</span>` : `<span class="ride-ico">${ico}</span>`}${n}</button>`).join('')}</div>`;
    if (D) {
      h += `<p class="muted small">${esc(D.desc)}</p><p class="small ride-only">🛣 ${D.name}專屬的路線（只能選方向，路線不會變成別的交通工具的）</p><div class="ride-routes">${D.routes.map(([k, t]) =>
        `<button type="button" data-act="rideR" data-r="${k}" aria-pressed="${(cur.route || D.routes[0][0]) === k}">${esc(t)}</button>`).join('')}</div>
        <label class="ride-show"><input type="checkbox" class="ride-showcb"${cur.show === false ? '' : ' checked'}> 在座位表上顯示${D.name}的樣子</label>`;
      const own = (P.owned?.[x.owner] || []).includes(v), img = customOf(x.owner, v);
      if (own && (x.owner === A.me() || A.isTeacher())) {
        h += `<div class="ride-look"><span class="ride-look-pic">${img ? `<img src="${img}" alt="">` : A.petRideArt(v)}</span><div>
          <b class="small">${D.name}的外觀${img ? '（自訂）' : '（預設）'}</b>
          ${x.owner === A.me() ? `<label class="lv-f"><span class="small">上傳自己畫的${D.name}（建議 PNG 去背、橫的；寵物會坐在圖的上半部）</span><input type="file" class="ride-file" accept="image/png,image/webp,image/gif,image/jpeg"></label>
          <div class="actions"><button type="button" class="btn" data-act="rideLook">上傳外觀</button>${img ? '<button type="button" class="btn" data-act="rideLookDel">恢復預設外觀</button>' : ''}</div>` : ''}
          ${A.isTeacher() ? `<div class="actions">${img ? '<button type="button" class="btn btn--danger" data-act="rideLookDel">🗑 刪除自訂外觀（導師）</button>' : ''}<button type="button" class="btn btn--danger" data-act="rideRemove">🗑 移除這個${D.name}（導師）</button></div>` : ''}</div></div>`;
      }
    }
    return h;
  }
  function rideBox(x) {
    if (x.status !== '寵物' || !(x.owner === A.me() || A.isTeacher())) return '';
    const cur = rideOf(x.id) || { v: '', show: true, route: '' };
    return `<details class="pet-edit pet-ride" data-id="${esc(x.id)}" data-cfg="${esc(JSON.stringify(cur))}"><summary>🚗 交通工具${cur.v ? `：${RIDES[cur.v].name}` : ''}</summary>
      <div class="ride-form">${rideFormHtml(x, cur)}</div>
      <div class="actions"><button type="button" class="btn wide" data-act="petRide" data-id="${esc(x.id)}">儲存交通工具設定</button></div></details>`;
  }
  async function rideAct(act, b) {
    const box = b.closest('.pet-ride');
    if (!box) return;
    const x = P.pets.find(y => y.id === box.dataset.id), cur = JSON.parse(box.dataset.cfg || '{}');
    const sh = box.querySelector('.ride-showcb'); if (sh) cur.show = sh.checked;
    if (act === 'rideV') { cur.v = b.dataset.v; cur.route = ''; }
    if (act === 'rideR') cur.route = b.dataset.r;
    if (act === 'rideLook' || act === 'rideLookDel' || act === 'rideRemove') {
      const D = RIDES[cur.v], who = nm(x.owner);
      if (!D) return;
      let data = null;
      if (act === 'rideLook') { const f = box.querySelector('.ride-file')?.files?.[0]; if (!f) return toast('請先選一張圖片'); data = await shrink(f).catch(e => { toast(e.message); return undefined; }); if (data === undefined) return; }
      if (act === 'rideLookDel' && !await A.ask(`刪除${A.isTeacher() && x.owner !== A.me() ? who + ' 的' : ''}${D.name}自訂外觀，恢復成預設的樣子？`, '刪除', true)) return;
      if (act === 'rideRemove' && !await A.ask(`移除 ${who} 的${D.name}？\n正在搭的寵物會下車，自訂外觀也會刪除；不會退回點數（之後可以再買）。`, '移除', true)) return;
      b.disabled = true;
      try {
        P = act === 'rideRemove' ? await A.api('rideRemove', { owner: x.owner, kind: cur.v }) : await A.api('rideLook', { kind: cur.v, data, owner: x.owner });
        const fid = P.rideImgs?.[x.owner + '|' + cur.v];
        if (data && fid) { rideImgs[fid] = data; try { store.set('indoor.rideimg', rideImgs); } catch { /* 空間不夠 */ } }
        toast(act === 'rideLook' ? `✓ 已換上新的${D.name}外觀` : act === 'rideLookDel' ? '✓ 已恢復預設外觀' : `✓ 已移除 ${who} 的${D.name}`);
        paintMap(true); if (A.sheetMode()?.kind === 'pet') openCard(x.id); if (A.currentTab() === 'pet') render();
      } catch (err) { toast(err.message); b.disabled = false; }
      return;
    }
    if (act !== 'petRide') { box.dataset.cfg = JSON.stringify(cur); box.querySelector('.ride-form').innerHTML = rideFormHtml(x, cur); return; }
    b.disabled = true; b.textContent = '儲存中…';
    try {
      P = await A.api('petRide', { id: x.id, ride: { v: cur.v || '', show: cur.show !== false, route: cur.route || (cur.v ? RIDES[cur.v].routes[0][0] : '') } });
      toast(cur.v ? `✓ ${petName(x)} 坐上${RIDES[cur.v].name}了` : '✓ 已經下車');
      paintMap(true); if (A.sheetMode()?.kind === 'pet') openCard(x.id); if (A.currentTab() === 'pet') render();
    } catch (err) { toast(err.message); b.disabled = false; b.textContent = '儲存交通工具設定'; }
  }
  function openCard(id) {
    const x = P.pets.find(y => y.id === id);
    if (!x) return;
    A.openSheet({ kind: 'pet', id }, A.sheetHead(x.status === '蛋' || x.status === '待孵' ? '🥚 寵物蛋' : `🐾 ${esc(petName(x))}`, '班級寵物') + cardHtml(x));
  }
  // 縮小外觀圖片（保留透明背景）
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('讀不到這張圖片')); i.src = url; });
      for (const max of [360, 280, 200]) {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        const d = cv.toDataURL('image/png');
        if (d.length < 500000) return d;
      }
      throw new Error('圖片太大，請換一張');
    } finally { URL.revokeObjectURL(url); }
  }
  async function feed(id, b) {
    const x = P.pets.find(y => y.id === id);
    if (!x) return;
    if (!await A.ask(`花 ${P.food} 點買一個罐罐，餵「${petName(x)}」？\n（+1 🍚，最多到牠的上限 ${capOf(x)} 🍚）`, '餵食')) return;
    if (b) b.disabled = true;
    try { P = await A.api('feedPet', { id }); toast('🥫 牠吃得好開心！+1 🍚'); paintMap(true); if (A.sheetMode()?.kind === 'pet') openCard(id); if (A.currentTab() === 'pet') render(); A.emit('coins'); }
    catch (err) { toast(err.message); if (b) b.disabled = false; }
  }
  async function incubate(ids, b) {
    if (b) b.disabled = true;
    try {
      P = await A.api('petIncubate', { ids }); pAt = Date.now();
      toast(`🐣 ${ids.length > 1 ? `${ids.length} 顆蛋` : '蛋'}已經放到講台上，一天後孵化！`);
      if (A.sheetMode()?.kind === 'pet') A.closeSheet();
      if (A.currentTab() === 'pet') render();
      paintMap(true);
      if (A.currentTab() !== 'seats') toast('🐣 到「座位」可以看到蛋跳到講台上！');
    } catch (err) { toast(err.message); if (b) b.disabled = false; }
  }
  A.sheetHandlers.pet = async (act, b) => {
    if (['rideV', 'rideR', 'petRide', 'rideLook', 'rideLookDel', 'rideRemove'].includes(act)) return rideAct(act, b);
    if (act === 'petFeed') return feed(b.dataset.id, b);
    if (act === 'petIncubate') return incubate([b.dataset.id], b);
    if (act === 'petDel') {
      const x = P.pets.find(y => y.id === b.dataset.id);
      if (!x || !await A.ask(`移除${nm(x.owner)}的這${x.status === '蛋' ? '顆寵物蛋' : '隻寵物'}？${x.reason ? `\n（原因：${x.reason}）` : ''}\n移除後不會再顯示，牠的 🍚 會平均分給同一位主人其他的蛋／寵物。`, '移除', true)) return;
      b.disabled = true;
      try { P = await A.api('petDelete', { id: x.id }); toast('已移除'); A.closeSheet?.(); paintMap(true); if (A.currentTab() === 'pet') render(); }
      catch (err) { toast(err.message); b.disabled = false; }
      return;
    }
    if (act !== 'petSave') return;
    // 欄位找按鈕旁邊的（🐾 分頁裡有好幾張卡片，id 會重複）
    const box = b.closest('.pet-edit') || document;
    const f = box.querySelector('#petImg')?.files?.[0];
    b.disabled = true; b.textContent = '儲存中…';
    try {
      const data = f ? await shrink(f) : null;
      P = await A.api('petLook', { id: b.dataset.id, name: box.querySelector('#petNm').value, data });
      const x = P.pets.find(y => y.id === b.dataset.id);
      if (data && x?.imgId) { imgs[x.imgId] = data; store.set('indoor.petimg', imgs); }
      toast('✓ 已儲存'); paintMap(true); if (A.sheetMode()?.kind === 'pet') openCard(b.dataset.id); if (A.currentTab() === 'pet') render();
    } catch (err) { toast(err.message); b.disabled = false; b.textContent = '儲存'; }
  };
  // ── 主人分配 🍚：同一位主人的蛋和寵物共用 10 🍚，可以互相移動（每隻至少 1 🍚，總數不能變多）──
  let allot = null;   // { owner, plan: { id: hp } }
  function allotHtml(owner) {
    const list = P.pets.filter(x => x.owner === owner && x.status !== '覓食').sort((a, b) => a.born - b.born);
    if (list.length < 2) return '';
    if (!allot || allot.owner !== owner) allot = { owner, plan: Object.fromEntries(list.map(x => [x.id, capOf(x)])) };
    const total = list.reduce((s, x) => s + capOf(x), 0), now = Object.values(allot.plan).reduce((s, v) => s + v, 0);
    return `<div class="panel pet-allot"><h3>⚖️ 分配 🍚 上限（${esc(nm(owner))}的 ${list.length} 隻）</h3>
      <p class="muted small">每一隻都有自己的 🍚 上限，你的蛋和寵物的上限加起來最多 ${P.max} 🍚。可以互相移動上限（飽足度也會跟著移過去）：每隻至少 1 🍚，加起來要剛好 ${total} 🍚。</p>
      ${list.map((x, i) => `<div class="pa-row"><span class="pa-pic">${x.status === '蛋' ? EGG : look(x)}</span><b>${x.status === '蛋' ? `寵物蛋 ${i + 1}` : esc(petName(x))}</b>
        <button type="button" class="btn" data-pa="-" data-id="${esc(x.id)}"${allot.plan[x.id] <= 1 ? ' disabled' : ''}>−</button><b class="pa-hp">上限 ${allot.plan[x.id]} 🍚</b><button type="button" class="btn" data-pa="+" data-id="${esc(x.id)}"${now >= total ? ' disabled' : ''}>＋</button></div>`).join('')}
      <div class="pa-sum ${now === total ? 'ok' : 'bad'}">加起來 ${now}／${total} 🍚${now < total ? `（還有 ${total - now} 🍚 沒分配）` : ''}</div>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-pa="save"${now === total ? '' : ' disabled'}>儲存分配</button></div></div>`;
  }
  // 商店：買罐罐 → 選一隻寵物餵
  A.openPetFeeder = async () => {
    if (!P) await load();
    const alive = (P?.pets || []).filter(x => x.status === '寵物');
    if (!alive.length) return toast('現在還沒有孵化的寵物');
    A.openSheet({ kind: 'pet' }, A.sheetHead('🥫 買罐罐餵寵物', `一個罐罐 ${P.food} 點，+1 🍚`) + alive.map(cardHtml).join('<hr class="pet-hr">'));
  };

  // ── 🐾 寵物分頁 ──
  function render() {
    const root = $('#petRoot');
    if (!root) return;
    if (!P) { root.innerHTML = `<div class="panel"><p class="muted">讀取中…</p></div>`; return; }
    const by = s => P.pets.filter(x => x.status === s);
    let h = `<details class="panel"><summary><b>📜 班級寵物怎麼玩？</b></summary><ol class="ar-ol">
      <li>同學被<b>加幾分，就得到幾顆寵物蛋</b>。蛋先放在自己身上，<b>主人按「🐣 孵化」</b>，蛋才會從座位跳到講台上開始孵化。</li>
      <li>每一隻蛋／寵物都有<b>自己的 🍚 上限</b>（例如 3 🍚、4 🍚）；同一位主人全部的蛋和寵物，<b>上限加起來最多 ${P.max} 🍚</b>。</li>
      <li>第一顆蛋上限 ${P.max} 🍚；之後每多一顆新蛋，<b>上限最大的那隻會自動分 1 🍚 給新蛋</b>。主人可以自己互相移動上限（例如 8／1／1，每隻至少 1 🍚），所以最多同時有 ${P.max} 隻。</li>
      <li>寵物跑出去覓食後，牠的上限<b>不會</b>分回給其他隻。</li>
      <li>蛋放到講台上 <b>1 天</b>後孵化，但<b>只有約 1/10 的機會孵出真正的寵物</b>；其他會孵出各種奇怪的東西（小鳥、法拉利、趕上班的老伯…共 ${Object.keys(GONE).length} 種），然後就離開教室了。孵失敗的蛋，牠的 🍚 會平均分給同一位主人其他的蛋和寵物。</li>
      <li>寵物的主人（被加分的同學）可以上傳牠的外觀（建議 PNG 去背），沒上傳就是<b>貓咪</b>。</li>
      <li>寵物會在座位表的教室四邊走來走去；點牠會有愛心或音符，也可以看到牠的<b>飽足度 🍚</b>。</li>
      <li>寵物孵化後<b>每天會餓掉 1 🍚</b>。在商店或寵物卡買<b>罐罐（${P.food} 點）</b>餵牠，<b>+1 🍚</b>（最多補到牠自己的上限）。</li>
      <li>有兩隻以上的寵物時，牠們偶爾會聚在一起玩：<b>2 隻碰碰鼻子、3 隻跳舞、4 隻開火車、5 隻拍團體照、6 隻疊羅漢</b> 🎉</li>
      <li>寵物會記得這一週誰餵牠：<b>餵越多次，牠越常跑去你的座位旁邊睡覺</b> 💤。</li>
      <li>🚗 在商店買<b>寵物的交通工具</b>（汽車、游泳圈、火箭、船、飛碟、巨大毛毛蟲，每種 ${P.ridePrice || 10} 點，<b>永久保存</b>）。主人可以讓寵物坐上去、選要不要顯示、選方向；<b>每種交通工具都有自己專屬的路線</b>，上傳自己畫的外觀也不會改變路線。</li>
      <li>飽足度變成 <b>0 🍚</b>，寵物就會肚子餓、<b>跑出去自己覓食</b>，不回來了。大家一起照顧牠吧！</li></ol></details>`;
    const sec = (title, list) => (list.length ? `<div class="panel"><h3>${title}</h3><div class="pet-list">${list.map(x => `<div class="pet-row" data-petcard="${esc(x.id)}" role="button" tabindex="0">${cardHtml(x)}</div>`).join('')}</div></div>` : '');
    const meK = A.isTeacher() ? '' : A.me();
    const waiting = by('待孵'), mineWait = waiting.filter(x => x.owner === meK);
    if (mineWait.length) h += `<div class="panel pet-wait"><h3>🥚 你有 ${mineWait.length} 顆寵物蛋還沒孵化</h3>
      <p class="small">按「🐣 孵化」，蛋才會放到講台上，一天後揭曉（只有約 1/10 會孵出真正的寵物，其他會孵出奇怪的東西跑掉）。</p>
      <div class="pet-wait-eggs">${mineWait.map(() => EGG).join('')}</div>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="petIncubate" data-ids="${esc(mineWait.map(x => x.id).join(','))}">🐣 孵化${mineWait.length > 1 ? `（全部 ${mineWait.length} 顆）` : ''}</button></div></div>`;
    if (meK) h += allotHtml(meK);
    h += sec(`🐾 寵物（${by('寵物').length}）`, by('寵物').sort((a, b) => a.hp - b.hp));
    h += sec(`🥚 講台上孵化中的蛋（${by('蛋').length}）`, by('蛋'));
    h += sec(`🧺 還沒按孵化的蛋（${waiting.length}）`, waiting);
    h += sec('🍚 最近跑出去覓食的寵物', by('覓食'));
    const gone = (P.gone || []).slice().sort((a, b) => b.hatch - a.hatch);
    if (gone.length) h += `<details class="panel"><summary><b>🥚 這週孵出的奇怪東西（${gone.length}）</b></summary><ul class="gone-list">${gone.map(x => { const { g, what, act } = goneText(x); const d = new Date(x.hatch);
      return `<li><span class="gl-ico">${goneArt(x.gone)}</span><span><b>${esc(nm(x.owner))}</b> 的蛋孵出${esc(what)}，${esc(act)}。<span class="muted small">${d.getMonth() + 1}/${d.getDate()}</span></span></li>`; }).join('')}</ul></details>`;
    if (!P.pets.length) h += `<div class="panel"><p class="muted">還沒有寵物。同學被加分時就會得到寵物蛋！</p></div>`;
    root.innerHTML = h;
  }
  $('#petRoot')?.addEventListener('click', async e => {
    const pa = e.target.closest('[data-pa]');
    if (pa && allot) {
      const v = pa.dataset.pa;
      if (v === '+' || v === '-') { allot.plan[pa.dataset.id] += v === '+' ? 1 : -1; render(); return; }
      if (v === 'save') {
        pa.disabled = true;
        try { P = await A.api('petAllot', { owner: allot.owner, plan: allot.plan }); allot = null; toast('✓ 已重新分配 🍚 上限'); render(); paintMap(true); } catch (err) { toast(err.message); pa.disabled = false; }
        return;
      }
    }
    const b = e.target.closest('[data-act]');
    if (b?.dataset.act === 'petFeed') { e.stopPropagation(); return feed(b.dataset.id, b); }
    if (b?.dataset.act === 'petIncubate') { e.stopPropagation(); return incubate(b.dataset.ids ? b.dataset.ids.split(',') : [b.dataset.id], b); }
    if (['rideV', 'rideR', 'petRide', 'rideLook', 'rideLookDel', 'rideRemove'].includes(b?.dataset.act)) { e.stopPropagation(); return rideAct(b.dataset.act, b); }
    if (b?.dataset.act === 'petSave' || b?.dataset.act === 'petDel') { e.stopPropagation(); return A.sheetHandlers.pet(b.dataset.act, b); }   // 🐾 分頁裡的卡片：儲存外觀、導師移除
    if (e.target.closest('details, input, button')) return;
    const r = e.target.closest('[data-petcard]');
    if (r) openCard(r.dataset.petcard);
  });

  // ── 什麼時候讀：最不重要，等其他分頁都預先載入完才讀；打開座位、寵物分頁時也會讀 ──
  A.on('prefetch', info => { if (!pAt && info.on && info.total && info.done >= info.total) load(); });
  setTimeout(() => { if (!pAt) load(); }, 20e3);
  A.tabHooks.pet = () => { render(); if (Date.now() - pAt > 30e3) load(); };
  const prevSeats = A.tabHooks.seats;
  A.tabHooks.seats = () => {
    prevSeats?.();
    setTimeout(() => { paintMap(true); if (!P || Date.now() - pAt > 60e3) load(); else events(); }, 400);
  };
  A.on('faces', () => { if (A.currentTab() === 'seats') setTimeout(() => paintMap(true), 80); });
  setInterval(() => { if (A.currentTab() === 'seats' && P && !document.hidden) { const due = P.pets.some(x => x.status === '蛋' && Date.now() >= x.hatch); if (due) load(); } }, 60e3);

  // 有人被加分：寵物馬上重新讀取（新的蛋直接從座位蹦出來）
  A.on('pointsAdded', () => { pAt = 0; setTimeout(load, 600); });
  A.on('petsReload', () => { pAt = 0; load(); });

  // ── 測試模式：存在這台裝置（規則和正式版一樣）──
  const tSpread = (list, n, order) => { const k = list.length, base = Math.floor(n / k), ord = (order || list.map((_, i) => i).sort(() => Math.random() - 0.5)).slice(0, n % k); return list.map((_, i) => base + (ord.includes(i) ? 1 : 0)); };
  const tFix = all => [...new Set(all.filter(x => x.status !== '覓食').map(x => x.owner))].forEach(o => {
    const list = all.filter(x => x.owner === o && x.status !== '覓食'), fresh = list.every(x => !x.cap);
    list.forEach(x => { if (!x.cap) x.cap = Math.max(1, x.hp); });
    if (fresh) { const room = 10 - list.reduce((s, x) => s + x.cap, 0); if (room > 0) { const a = tSpread(list, room); list.forEach((x, i) => { x.cap += a[i]; }); } }
    if (list.reduce((s, x) => s + x.cap, 0) > 10) { const c = tSpread(list, 10); list.forEach((x, i) => { x.cap = Math.max(1, c[i]); }); }
    list.forEach(x => { x.hp = Math.max(1, Math.min(x.hp, x.cap)); });
  });
  A.testLayEggs = rows => {
    const KEY = 'indoor.pets.v1.test', all = store.get(KEY, null) || [], now = Date.now();
    tFix(all);
    rows.forEach(r => {
      const live = all.filter(x => x.owner === r.student && x.status !== '覓食'), k = Math.max(0, Math.min(r.points || 1, 10 - live.length));
      for (let i = 0; i < k; i++) {   // 第一顆上限 10 🍚；之後上限最大的那隻分 1 🍚 給新蛋
        const big = all.filter(x => x.owner === r.student && x.status !== '覓食').sort((a, b) => b.cap - a.cap || a.born - b.born)[0];
        let cap = 10;
        if (big) { if (big.cap > 1) { big.cap--; if (big.hp > 1) big.hp--; big.hp = Math.min(big.hp, big.cap); } cap = 1; }
        all.push({ id: 'p' + now.toString(36) + Math.random().toString(36).slice(2, 6), owner: r.student, reason: r.reason || '', born: now + i, hatch: 0, name: '', imgId: '', hp: cap, cap, decay: '', status: '待孵', died: 0, fed: '' });
      }
    });
    store.set(KEY, all);
  };
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    if (action === 'giftRide') {
      const SK = 'indoor.shopspend.v1.test', sp = store.get(SK, []), who = A.isTeacher() ? (A.D.teacherLabel || '導師') : A.me();
      if (!RIDES[p.kind]) throw new Error('沒有這種交通工具');
      if (p.to === who || !A.DEMO_STUDENTS.includes(p.to)) throw new Error('請選擇要送的同學');
      const rv = store.get('indoor.riderevoked.v1.test', {});
      if (sp.some(x => x.who === p.to && x.use === '寵物交通工具' && x.target === p.kind && x.t > (rv[p.to + '|' + p.kind] || 0))) throw new Error('對方已經有這種交通工具了，不能重複贈送');
      const st = await prevTest('shopState'), price = A.isTeacher() ? 0 : 10;
      if (!st.unlimited && st.coins < price) throw new Error('點數不夠（需要 ' + price + ' 點）');
      const now = Date.now(), row = (owner, points, use, target, note) => ({ id: Math.random().toString(36).slice(2, 10), who: owner, points, use, target, note, time: '', t: now });
      store.set(SK, [...sp, row(who, price, '送禮', p.to, '寵物交通工具：' + RIDES[p.kind].name), row(p.to, 0, '寵物交通工具', p.kind, who + ' 送的')]);
      return prevTest('shopState');
    }
    if (action === 'buyRide') {
      const SK = 'indoor.shopspend.v1.test', sp = store.get(SK, []), who = A.isTeacher() ? (A.D.teacherLabel || '導師') : A.me();
      if (!RIDES[p.kind]) throw new Error('沒有這種交通工具');
      if (sp.some(x => x.who === who && x.use === '寵物交通工具' && x.target === p.kind)) throw new Error(`你已經有${RIDES[p.kind].name}了（永久保存，不用再買）`);
      const st = await prevTest('shopState');
      if (!st.unlimited && st.coins < 10) throw new Error(`點數不夠（${RIDES[p.kind].name}要 10 點，你有 ${st.coins} 點）`);
      store.set(SK, [...sp, { id: Math.random().toString(36).slice(2, 10), who, points: A.isTeacher() ? 0 : 10, use: '寵物交通工具', target: p.kind, note: '', time: '', t: Date.now() }]);
      return prevTest('shopState');
    }
    if (!['getPets', 'feedPet', 'petLook', 'petImage', 'petAllot', 'petDelete', 'petIncubate', 'petRide', 'rideLook', 'rideImage', 'rideRemove'].includes(action)) return prevTest ? prevTest(action, p) : null;
    const KEY = 'indoor.pets.v1.test', all = store.get(KEY, null) || [], me = A.isTeacher() ? (A.D.teacherLabel || '導師') : A.me(), now = Date.now();
    if (!store.get(KEY, null)) {   // 第一次：補一顆蛋（最近被加分的同學）
      const k = A.students()[4] || A.students()[0];
      if (k) all.push({ id: 'p' + now.toString(36), owner: k, reason: '上課認真回答', born: now, hatch: now + 864e5, name: '', imgId: '', hp: 10, cap: 10, decay: '', status: '蛋', died: 0, fed: '' });
    }
    const day = t => Math.floor((t + 8 * 3600e3) / 864e5);
    all.forEach(x => {
      if (x.status === '蛋' && now >= x.hatch) {
        if (Math.random() >= 0.1) { x.status = '飛走'; x.gone = Object.keys(GONE)[Math.floor(Math.random() * Object.keys(GONE).length)]; return; }
        x.status = '寵物'; x.hp = Math.max(1, x.hp || 1); x.decay = day(x.hatch);
      }
      if (x.status === '寵物' && day(now) > x.decay) { x.hp -= day(now) - x.decay; x.decay = day(now); if (x.hp <= 0) { x.hp = 0; x.status = '覓食'; x.died = now; } }
    });
    // 孵失敗的：從清單拿出來，🍚 分給同一位主人其他的
    const GK = 'indoor.petsgone.v1.test', goneAll = store.get(GK, []);
    for (let i = all.length - 1; i >= 0; i--) {
      const x = all[i];
      if (x.status !== '飛走') continue;
      all.splice(i, 1); goneAll.push(x);
      const rest = all.filter(y => y.owner === x.owner && y.status !== '覓食');
      if (rest.length) { const o = rest.map((_, j) => j).sort(() => Math.random() - 0.5), ac = tSpread(rest, x.cap || 0, o), ah = tSpread(rest, x.hp || 0, o); rest.forEach((y, j) => { y.cap += ac[j]; y.hp = Math.min(y.cap, y.hp + ah[j]); }); }
    }
    store.set(GK, goneAll);
    tFix(all);
    if (action === 'feedPet') { const x = all.find(y => y.id === p.id); if (!x || x.status !== '寵物') throw new Error('這隻寵物現在不能餵'); if (x.hp >= x.cap) throw new Error(`牠已經吃飽了（牠的上限是 ${x.cap} 🍚）`); x.hp++; x.fed = `${me} ${A.fmtTime(new Date())}`; (x.feedLog ||= []).push({ who: me, t: now }); }
    if (action === 'petLook') { const x = all.find(y => y.id === p.id); if (p.name != null) x.name = String(p.name).slice(0, 12); if (p.data) { x.imgId = 'i' + now.toString(36); store.set('indoor.petimgdata.test', { ...store.get('indoor.petimgdata.test', {}), [x.imgId]: p.data }); } }
    if (action === 'petAllot') {
      const list = all.filter(x => x.owner === (A.isTeacher() ? p.owner : me) && x.status !== '覓食'), total = list.reduce((s, x) => s + x.cap, 0), sum = list.reduce((s, x) => s + (p.plan[x.id] || 0), 0);
      if (list.some(x => !(p.plan[x.id] >= 1))) throw new Error('每一隻的上限至少要 1 🍚');
      if (sum !== total) throw new Error(`上限加起來要剛好 ${total} 🍚`);
      list.forEach(x => { const c = p.plan[x.id]; x.hp = Math.max(1, Math.min(c, x.hp + c - x.cap)); x.cap = c; });
    }
    if (action === 'petIncubate') all.forEach(x => { if ((p.ids || []).includes(x.id) && x.status === '待孵' && (A.isTeacher() || x.owner === me)) { x.status = '蛋'; x.hatch = now + 864e5; } });
    if (action === 'petDelete') {
      const i = all.findIndex(y => y.id === p.id), x = all[i];
      if (i >= 0) {
        all.splice(i, 1);
        const rest = all.filter(y => y.owner === x.owner && y.status !== '覓食');
        if (rest.length && x.status !== '覓食') { const o = rest.map((_, i) => i).sort(() => Math.random() - 0.5), ac = tSpread(rest, x.cap, o), ah = tSpread(rest, x.hp, o); rest.forEach((y, j) => { y.cap += ac[j]; y.hp = Math.min(y.cap, y.hp + ah[j]); }); }
      }
    }
    const RK = 'indoor.petride.v1.test', rm = store.get(RK, {});
    const IK = 'indoor.rideimg.v1.test', VK = 'indoor.riderevoked.v1.test', im = store.get(IK, {}), rv = store.get(VK, {});
    if (action === 'rideImage') return { ok: true, img: Object.values(im).find(y => y.id === p.id)?.data || '' };
    if (action === 'rideLook') { const o = A.isTeacher() ? p.owner : me, k = o + '|' + p.kind; if (p.data) im[k] = { id: 'r' + now.toString(36), data: p.data }; else delete im[k]; store.set(IK, im); }
    if (action === 'rideRemove') {
      if (!A.isTeacher()) throw new Error('只有導師可以移除交通工具');
      const k = p.owner + '|' + p.kind; rv[k] = now; delete im[k]; store.set(VK, rv); store.set(IK, im);
      const rm0 = store.get('indoor.petride.v1.test', {}); all.filter(x => x.owner === p.owner).forEach(x => { if (rm0[x.id]?.v === p.kind) delete rm0[x.id]; }); store.set('indoor.petride.v1.test', rm0);
    }
    if (action === 'petRide') {
      const x = all.find(y => y.id === p.id), v = p.ride?.v || '';
      if (!x || x.status !== '寵物') throw new Error('孵化成寵物以後才能搭交通工具');
      if (!v) delete rm[x.id]; else rm[x.id] = { v, show: p.ride.show !== false, route: p.ride.route || RIDES[v].routes[0][0] };
      store.set(RK, rm);
    }
    if (action === 'petImage') { const x = all.find(y => y.id === p.id); return { ok: true, img: store.get('indoor.petimgdata.test', {})[x?.imgId] || '' }; }
    store.set(KEY, all);
    const feeders = x => { const m = {}; (x.feedLog || []).filter(f => f.t > now - 7 * 864e5).forEach(f => { m[f.who] = (m[f.who] || 0) + 1; }); return Object.entries(m).map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n); };
    const spAll = store.get('indoor.shopspend.v1.test', []), ownedOf = k => [...new Set(spAll.filter(y => y.who === k && y.use === '寵物交通工具' && y.t > (rv[k + '|' + y.target] || 0)).map(y => y.target))];
    const owned = {}; all.forEach(x => { owned[x.owner] ||= ownedOf(x.owner); }); owned[me] ||= ownedOf(me);
    const rideImgs = {}; Object.entries(im).forEach(([k, y]) => { const [o, v] = k.split('|'); if ((owned[o] || []).includes(v)) rideImgs[k] = y.id; });
    return { ok: true, rides: rm, owned, rideImgs, ridePrice: 10, pets: all.map(x => ({ ...x, img: x.imgId ? 1 : 0, feeders: feeders(x) })), gone: goneAll.filter(x => now - x.hatch < 7 * 864e5), me, now, food: 1, max: 10 };
  };
})();
