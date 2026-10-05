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
    return { L, R, T, B, w: R - L, h: B - T, per: 2 * (R - L + B - T), board: board && board.width ? { x: board.left + board.width / 2 - hr.left, y: board.top + board.height * 0.62 - hr.top } : { x: (L + R) / 2, y: T - 30 }, hr,
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
    if (force || ly.dataset.sig !== alive.map(x => x.id + (x.imgId || '')).join() + '|' + eggs.length) {
      ly.dataset.sig = alive.map(x => x.id + (x.imgId || '')).join() + '|' + eggs.length;
      ly.innerHTML = eh + alive.map(x => `<button type="button" class="pet" data-pet="${esc(x.id)}" title="${esc(petName(x))}"><span class="pet-body">${look(x)}</span><i class="pet-shadow"></i><span class="pet-zz" aria-hidden="true">💤</span></button>`).join('');
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
    const free = Object.entries(pets).filter(([, p]) => p.mode === 'path' && p.x != null);
    if (free.length < 2) { nextParty = Date.now() + 20000; return; }
    const k = Math.min(free.length, forceK || 2 + Math.floor(Math.random() * (Math.min(6, free.length) - 1)));
    forceK = 0;
    const pick = free.sort(() => Math.random() - 0.5).slice(0, k);
    // 集合地點：上面或下面的邊（橫的才排得開、疊得起來），靠近第一隻、離轉角遠一點
    const p0 = pick[0][1], x = Math.max(geo.L + 80, Math.min(geo.R - 80, p0.x));
    const s0 = p0.y < (geo.T + geo.B) / 2 ? (x - geo.L) / geo.per : (geo.w + geo.h + (geo.R - x)) / geo.per;
    party = { ids: pick.map(([id]) => id), s: s0, phase: 'gather', until: Date.now() + 9000 };
    pick.forEach(([, p], i) => { p.party = i + 1; p.mode = 'party'; });
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
    q.ids.forEach(id => { const pp = pets[id]; if (!pp) return; delete pp.party; pp.mode = 'back'; pp.s = nearestS(pp); pp.to = along(geo, pp.s); });
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
        } else if (p.mode === 'path') {
          // 走一段、停一下；偶爾去餵過牠的同學旁邊睡覺（這週餵越多次，越常去）
          if (Date.now() > p.until) {
            const spot = maybeSleep(p);
            if (spot) { p.mode = 'go'; p.to = spot.pos; p.seat = spot.seat; p.walk = true; }
            else { p.walk = Math.random() < 0.72; p.until = Date.now() + (p.walk ? 3000 + Math.random() * 5000 : 1200 + Math.random() * 2200); if (p.walk && Math.random() < 0.25) p.dir *= -1; }
          }
          if (p.mode === 'path') {
            const a = along(geo, p.s);
            if (p.walk) p.s += p.dir * 28 * dt / geo.per;
            b = along(geo, p.s);
            if (Math.abs(b.x - a.x) > 0.01) p.face = b.x > a.x ? 1 : -1;
          }
        }
        if (!inParty && p.mode !== 'path') {
          if (p.mode === 'sleep') {
            const s2 = seatSpot(p.seat);   // 座位表重畫、縮放時跟著座位
            if (s2) p.to = s2;
            b = p.to;
            if (Date.now() > p.until) { p.mode = 'back'; p.s = nearestS(p.to); p.to = along(geo, p.s); }
          } else {
            const step = 34 * dt, dx = p.to.x - p.x, dy = p.to.y - p.y, d = Math.hypot(dx, dy);
            if (Math.abs(dx) > 0.5) p.face = dx > 0 ? 1 : -1;
            if (d <= step) { b = { ...p.to }; if (p.mode === 'go') { p.mode = 'sleep'; p.until = Date.now() + 9000 + Math.random() * 9000; } else { p.mode = 'path'; p.until = 0; } }
            else b = { x: p.x + dx / d * step, y: p.y + dy / d * step };
          }
        }
        p.x = b.x; p.y = b.y;
        el.style.transform = `translate(${b.x - 17}px, ${b.y - 30}px)`;
        el.classList.toggle('walk', inParty ? moving : p.mode === 'go' || p.mode === 'back' || (p.mode === 'path' && p.walk));
        el.classList.toggle('sleep', p.mode === 'sleep');
        el.style.setProperty('--face', p.face);
      });
    }
    raf = requestAnimationFrame(tick);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
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
  async function playGone(x, at) {
    const { g, what, act } = goneText(x);
    const help = goneHelp(x.gone);
    const el = fx(`<span class="g-egg">${EGG}</span>${help ? `<span class="g-help h-${g[1]}">${help}</span>` : ''}${g[1] === 'ufo' ? '<span class="g-beam"></span>' : ''}<span class="g-actor a-${g[1]}">${goneArt(x.gone)}</span><span class="g-say">${esc(what)}<br>${esc(act)}</span>`, 'gone-fx', at.x, at.y);
    banner(`🥚 <b>${esc(nm(x.owner))}</b> 的寵物蛋孵化了……竟然是<b>${esc(what)}</b>！<br>${esc(act)}。<span class="muted small">（只有約 1/10 的蛋會孵出真正的寵物）</span>`, 4200);
    await wait(4400); el.remove();
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
        const e = fx(`<span class="hatch-egg">${EGG}</span><span class="hatch-pet">${look(x)}</span>`, 'egg-hatch', to.x, to.y);
        banner(`🎉 太幸運了！<b>${esc(nm(x.owner))}</b> 的寵物蛋<b>真的孵出寵物</b>了（只有約 1/10 的機會）！${x.owner === A.me() ? '<br><span class="muted small">到「🐾 寵物」可以上傳牠的外觀、取名字。</span>' : ''}`, 5000);
        await wait(2400); e.remove();
        markSeen('hatch', x.id);
      } else {
        // 飽足度 0：揹著空碗跑出去自己覓食
        const e = fx(`<span class="g-help h-runR">🍚</span><span class="g-actor a-runR">${look(x)}</span><span class="g-say">${esc(petName(x))}<br>肚子餓了，跑出去自己覓食了</span>`, 'gone-fx forage', to.x, to.y);
        banner(`🍚 <b>${esc(petName(x))}</b>（${esc(nm(x.owner))} 的寵物）太久沒吃到罐罐，肚子餓了，<b>跑出去自己覓食</b>了…`, 3500);
        await wait(4400); e.remove();
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
        : x.status === '蛋' ? `<span class="small">🥚 在講台上孵化中，還有 ${left(x.hatch - Date.now())}・上限 ${capOf(x)} 🍚</span>${hpBar(x)}`
        : x.status === '覓食' ? '<span class="small muted">肚子餓了，跑出去自己覓食了，謝謝牠陪伴大家。</span>' : hpBar(x)}
      ${x.fed && x.status === '寵物' ? `<span class="muted small">最近餵食：${esc(x.fed)}</span>` : ''}</div></div>
      ${x.status === '寵物' ? `<div class="pet-feeders"><b>🥫 最近一週餵牠的人</b>${(x.feeders || []).length ? `<div>${x.feeders.map(f => `<span class="pet-fd">${esc(nm(f.key))}<b>×${f.n}</b></span>`).join('')}</div><span class="muted small">餵越多次，牠越常跑去你的座位旁邊睡覺 💤</span>` : '<span class="muted small">這週還沒有人餵牠。</span>'}</div>` : ''}`;
    if (x.status === '寵物' && !A.isGuest()) h += `<div class="actions"><button type="button" class="btn btn--primary wide" data-act="petFeed" data-id="${esc(x.id)}"${full(x) ? ' disabled' : ''}>🥫 餵罐罐（${P.food} 點，+1 🍚）${full(x) ? '・吃飽了' : ''}</button></div>`;
    if (x.status === '待孵' && (x.owner === A.me() || A.isTeacher())) h += `<div class="actions"><button type="button" class="btn btn--primary wide" data-act="petIncubate" data-id="${esc(x.id)}">🐣 孵化（放到講台上）</button></div>`;
    if (A.isTeacher() && x.status !== '覓食') h += `<div class="actions"><button type="button" class="btn btn--danger wide" data-act="petDel" data-id="${esc(x.id)}">🗑 移除這${isEgg ? '顆蛋' : '隻寵物'}（導師）</button></div>`;
    if (mine && x.status !== '覓食') h += `<details class="pet-edit"${x.status === '寵物' && !x.imgId && x.owner === A.me() ? ' open' : ''}><summary>✏️ 主人專屬：取名字、上傳外觀</summary>
      <label class="lv-f"><span>名字</span><input type="text" id="petNm" maxlength="12" value="${esc(x.name || '')}" placeholder="幫牠取個名字"></label>
      <label class="lv-f"><span>外觀圖片（建議 PNG 去背；沒上傳就是貓咪）</span><input type="file" id="petImg" accept="image/png,image/webp,image/gif,image/jpeg"></label>
      <div class="actions"><button type="button" class="btn wide" data-act="petSave" data-id="${esc(x.id)}">儲存</button></div></details>`;
    return h;
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
    if (!['getPets', 'feedPet', 'petLook', 'petImage', 'petAllot', 'petDelete', 'petIncubate'].includes(action)) return prevTest ? prevTest(action, p) : null;
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
    if (action === 'petImage') { const x = all.find(y => y.id === p.id); return { ok: true, img: store.get('indoor.petimgdata.test', {})[x?.imgId] || '' }; }
    store.set(KEY, all);
    const feeders = x => { const m = {}; (x.feedLog || []).filter(f => f.t > now - 7 * 864e5).forEach(f => { m[f.who] = (m[f.who] || 0) + 1; }); return Object.entries(m).map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n); };
    return { ok: true, pets: all.map(x => ({ ...x, img: x.imgId ? 1 : 0, feeders: feeders(x) })), gone: goneAll.filter(x => now - x.hatch < 7 * 864e5), me, now, food: 1, max: 10 };
  };
})();
