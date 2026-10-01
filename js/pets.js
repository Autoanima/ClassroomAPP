'use strict';
/* 🐾 班級寵物：同學被加分 → 從座位蹦出寵物蛋，跳到講台；1 天後孵化；寵物沿著教室四邊走來走去（不遮住大頭照）。
   點寵物：愛心或音符＋叫聲、看血量、餵罐罐（1 點，+1 HP）。每天扣 1 HP，0 HP 就升天（幽靈飄走）。
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
    for (const x of (P?.pets || []).filter(y => y.imgId && !imgs[y.imgId] && y.status !== '死亡')) {
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
    stop(); raf = requestAnimationFrame(tick);   // 每次都重新開始（之前在背景時排的那一次可能一直沒跑）
  }
  function placeEggs() {
    const box = layer?.querySelector('.pet-eggs');
    if (!box || !geo) return;
    Object.assign(box.style, { left: geo.stage.left + 'px', top: geo.stage.top + 'px', width: geo.stage.w + 'px', height: geo.stage.h + 'px' });
    // 蛋太多、講台太小：整排一起縮小，全部都放得進講台（最小縮到一半）
    const n = box.children.length, W = geo.stage.w - 12, H = geo.stage.h - 8;
    let k = 1;
    for (; k > 0.5; k -= 0.05) { const per = Math.max(1, Math.floor(W / (30 * k))); if (Math.ceil(n / per) * 44 * k <= H) break; }
    box.style.setProperty('--es', Math.max(0.5, k).toFixed(2));
  }
  let last = 0;
  function tick(t) {
    raf = 0;
    if (A.currentTab() !== 'seats' || document.hidden || !layer) return;
    const dt = Math.min(0.1, (t - (last || t)) / 1000); last = t;
    if (Date.now() - geoAt > 1500) { geo = geometry(); geoAt = Date.now(); placeEggs(); }
    if (geo) {
      Object.entries(pets).forEach(([id, p]) => {
        const el = layer.querySelector(`.pet[data-pet="${CSS.escape(id)}"]`);
        if (!el) return;
        if (p.x == null || isNaN(p.x)) { const q = along(geo, p.s); p.x = q.x; p.y = q.y; }
        let b;
        if (p.mode === 'path') {
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
        if (p.mode !== 'path') {
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
        el.classList.toggle('walk', p.mode === 'go' || p.mode === 'back' || (p.mode === 'path' && p.walk));
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

  // ── 動畫：生蛋（從座位蹦到講台）、孵化、升天 ──
  const seen = Object.assign({ egg: [], hatch: [], dead: [] }, store.get('indoor.pets.seen', {}));
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
      ...P.pets.filter(x => !seen.egg.includes(x.id) && recent(x.born)).map(x => ['egg', x]),
      ...P.pets.filter(x => x.status !== '蛋' && !seen.hatch.includes(x.id) && recent(x.hatch)).map(x => ['hatch', x]),
      ...P.pets.filter(x => x.status === '死亡' && !seen.dead.includes(x.id) && recent(x.died)).map(x => ['dead', x]),
    ];
    if (!todo.length) { P.pets.forEach(x => { if (!seen.egg.includes(x.id)) markSeen('egg', x.id); if (x.status !== '蛋' && !seen.hatch.includes(x.id)) markSeen('hatch', x.id); if (x.status === '死亡' && !seen.dead.includes(x.id)) markSeen('dead', x.id); }); return; }
    playing = true;
    for (const [kind, x] of todo) {
      if (A.currentTab() !== 'seats') break;
      geo = geometry();
      const to = geo.board;
      if (kind === 'egg') {
        const slot = layer.querySelector(`.pet-egg[data-pet="${CSS.escape(x.id)}"]`);
        let dest = to;
        if (slot) { const r = slot.getBoundingClientRect(); dest = { x: r.left + r.width / 2 - geo.hr.left, y: r.top + r.height * 0.4 - geo.hr.top }; slot.style.visibility = 'hidden'; }
        const from = seatCenter(x.owner) || { x: dest.x, y: geo.T + 40 };
        const e = fx(EGG, 'egg-fly', from.x, from.y);
        e.style.setProperty('--dx', (dest.x - from.x) + 'px'); e.style.setProperty('--dy', (dest.y - from.y) + 'px');
        banner(`🥚 <b>${esc(nm(x.owner))}</b> 被加分${x.reason ? `（${esc(x.reason)}）` : ''}，從座位蹦出了一顆<b>寵物蛋</b>！<br><span class="muted small">牠會跳到講台上，${x.status === '蛋' ? '一天後孵化' : '已經孵化了'}。</span>`, 5000);
        await wait(1500); e.remove();
        if (slot) slot.style.visibility = '';
        markSeen('egg', x.id);
      } else if (kind === 'hatch') {
        const e = fx(`<span class="hatch-egg">${EGG}</span><span class="hatch-pet">${look(x)}</span>`, 'egg-hatch', to.x, to.y);
        banner(`🐣 <b>${esc(nm(x.owner))}</b> 的寵物蛋孵化了！${x.owner === A.me() ? '<br><span class="muted small">到「🐾 寵物」可以上傳牠的外觀、取名字。</span>' : ''}`, 5000);
        await wait(2400); e.remove();
        markSeen('hatch', x.id);
      } else {
        const e = fx(`<span class="ghost-pet">${look(x)}</span><span class="ghost">👻</span><span class="halo">😇</span>`, 'pet-ghost', to.x, to.y - 10);
        banner(`👻 <b>${esc(petName(x))}</b>（${esc(nm(x.owner))} 的寵物）沒有吃到罐罐，升天了…`, 5000);
        await wait(3200); e.remove();
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

  const hpBar = x => `<span class="pet-hp">${Array.from({ length: P.max }, (_, i) => `<i class="${i < x.hp ? 'on' : ''}"></i>`).join('')}<b>${x.hp}/${P.max} HP</b></span>`;
  const left = ms => { const m = Math.max(0, Math.round(ms / 60e3)); return m >= 60 ? `${Math.floor(m / 60)} 小時 ${m % 60} 分` : `${m} 分鐘`; };
  function cardHtml(x) {
    const mine = x.owner === A.me() || A.isTeacher();
    let h = `<div class="pet-card${x.status === '死亡' ? ' dead' : ''}"><div class="pet-pic">${x.status === '蛋' ? EGG : look(x)}</div><div class="pet-info">
      <b class="pet-nm">${x.status === '蛋' ? '寵物蛋' : esc(petName(x))}${x.status === '死亡' ? ' 😇' : ''}</b>
      <span class="muted small">主人：${esc(nm(x.owner))}${x.reason ? `・因為「${esc(x.reason)}」被加分` : ''}</span>
      ${x.status === '蛋' ? `<span class="small">🥚 還有 ${left(x.hatch - Date.now())} 孵化</span>` : x.status === '死亡' ? '<span class="small muted">已經升天了，謝謝牠陪伴大家。</span>' : hpBar(x)}
      ${x.fed && x.status === '寵物' ? `<span class="muted small">最近餵食：${esc(x.fed)}</span>` : ''}</div></div>
      ${x.status === '寵物' ? `<div class="pet-feeders"><b>🥫 最近一週餵牠的人</b>${(x.feeders || []).length ? `<div>${x.feeders.map(f => `<span class="pet-fd">${esc(nm(f.key))}<b>×${f.n}</b></span>`).join('')}</div><span class="muted small">餵越多次，牠越常跑去你的座位旁邊睡覺 💤</span>` : '<span class="muted small">這週還沒有人餵牠。</span>'}</div>` : ''}`;
    if (x.status === '寵物' && !A.isGuest()) h += `<div class="actions"><button type="button" class="btn btn--primary wide" data-act="petFeed" data-id="${esc(x.id)}"${x.hp >= P.max ? ' disabled' : ''}>🥫 餵罐罐（${P.food} 點，+1 HP）${x.hp >= P.max ? '・吃飽了' : ''}</button></div>`;
    if (mine && x.status !== '死亡') h += `<details class="pet-edit"${x.status === '寵物' && !x.imgId && x.owner === A.me() ? ' open' : ''}><summary>✏️ 主人專屬：取名字、上傳外觀</summary>
      <label class="lv-f"><span>名字</span><input type="text" id="petNm" maxlength="12" value="${esc(x.name || '')}" placeholder="幫牠取個名字"></label>
      <label class="lv-f"><span>外觀圖片（建議 PNG 去背；沒上傳就是貓咪）</span><input type="file" id="petImg" accept="image/png,image/webp,image/gif,image/jpeg"></label>
      <div class="actions"><button type="button" class="btn wide" data-act="petSave" data-id="${esc(x.id)}">儲存</button></div></details>`;
    return h;
  }
  function openCard(id) {
    const x = P.pets.find(y => y.id === id);
    if (!x) return;
    A.openSheet({ kind: 'pet', id }, A.sheetHead(x.status === '蛋' ? '🥚 寵物蛋' : `🐾 ${esc(petName(x))}`, '班級寵物') + cardHtml(x));
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
    if (!await A.ask(`花 ${P.food} 點買一個罐罐，餵「${petName(x)}」？\n（+1 HP，最多 ${P.max} HP）`, '餵食')) return;
    if (b) b.disabled = true;
    try { P = await A.api('feedPet', { id }); toast('🥫 牠吃得好開心！+1 HP'); paintMap(true); if (A.sheetMode()?.kind === 'pet') openCard(id); if (A.currentTab() === 'pet') render(); A.emit('coins'); }
    catch (err) { toast(err.message); if (b) b.disabled = false; }
  }
  A.sheetHandlers.pet = async (act, b) => {
    if (act === 'petFeed') return feed(b.dataset.id, b);
    if (act !== 'petSave') return;
    const f = $('#petImg')?.files?.[0];
    b.disabled = true; b.textContent = '儲存中…';
    try {
      const data = f ? await shrink(f) : null;
      P = await A.api('petLook', { id: b.dataset.id, name: $('#petNm').value, data });
      const x = P.pets.find(y => y.id === b.dataset.id);
      if (data && x?.imgId) { imgs[x.imgId] = data; store.set('indoor.petimg', imgs); }
      toast('✓ 已儲存'); paintMap(true); openCard(b.dataset.id); if (A.currentTab() === 'pet') render();
    } catch (err) { toast(err.message); b.disabled = false; b.textContent = '儲存'; }
  };
  // 商店：買罐罐 → 選一隻寵物餵
  A.openPetFeeder = async () => {
    if (!P) await load();
    const alive = (P?.pets || []).filter(x => x.status === '寵物');
    if (!alive.length) return toast('現在還沒有孵化的寵物');
    A.openSheet({ kind: 'pet' }, A.sheetHead('🥫 買罐罐餵寵物', `一個罐罐 ${P.food} 點，+1 HP`) + alive.map(cardHtml).join('<hr class="pet-hr">'));
  };

  // ── 🐾 寵物分頁 ──
  function render() {
    const root = $('#petRoot');
    if (!root) return;
    if (!P) { root.innerHTML = `<div class="panel"><p class="muted">讀取中…</p></div>`; return; }
    const by = s => P.pets.filter(x => x.status === s);
    let h = `<details class="panel"><summary><b>📜 班級寵物怎麼玩？</b></summary><ol class="ar-ol">
      <li>同學被<b>加分</b>時，會從他的座位蹦出一顆<b>寵物蛋</b>，跳到講台上（每人每天最多一顆）。</li>
      <li>蛋放 <b>1 天</b>後孵化。寵物的主人（被加分的同學）可以上傳牠的外觀（建議 PNG 去背），沒上傳就是<b>貓咪</b>。</li>
      <li>寵物會在座位表的教室四邊走來走去；點牠會有愛心或音符，也可以看到<b>血量</b>。</li>
      <li>寵物一出生是 <b>${P.max} HP</b>，<b>每天扣 1 HP</b>。在商店或寵物卡買<b>罐罐（${P.food} 點）</b>餵牠，<b>+1 HP</b>。</li>
      <li>寵物會記得這一週誰餵牠：<b>餵越多次，牠越常跑去你的座位旁邊睡覺</b> 💤。</li>
      <li>血量變成 <b>0 HP</b>，寵物就會升天 👻。大家一起照顧牠吧！</li></ol></details>`;
    const sec = (title, list) => (list.length ? `<div class="panel"><h3>${title}</h3><div class="pet-list">${list.map(x => `<div class="pet-row" data-petcard="${esc(x.id)}" role="button" tabindex="0">${cardHtml(x)}</div>`).join('')}</div></div>` : '');
    h += sec(`🐾 寵物（${by('寵物').length}）`, by('寵物').sort((a, b) => a.hp - b.hp));
    h += sec(`🥚 寵物蛋（${by('蛋').length}）`, by('蛋'));
    h += sec('😇 最近升天的寵物', by('死亡'));
    if (!P.pets.length) h += `<div class="panel"><p class="muted">還沒有寵物。同學被加分時就會生出寵物蛋！</p></div>`;
    root.innerHTML = h;
  }
  $('#petRoot')?.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b?.dataset.act === 'petFeed') { e.stopPropagation(); return feed(b.dataset.id, b); }
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

  // ── 測試模式：存在這台裝置 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    if (!['getPets', 'feedPet', 'petLook', 'petImage'].includes(action)) return prevTest ? prevTest(action, p) : null;
    const KEY = 'indoor.pets.v1.test', all = store.get(KEY, null) || [], me = A.isTeacher() ? (A.D.teacherLabel || '導師') : A.me(), now = Date.now();
    if (!store.get(KEY, null)) {   // 第一次：補一顆蛋（最近被加分的同學）
      const k = A.students()[4] || A.students()[0];
      if (k) all.push({ id: 'p' + now.toString(36), owner: k, reason: '上課認真回答', born: now, hatch: now + 864e5, name: '', imgId: '', hp: 10, decay: '', status: '蛋', died: 0, fed: '' });
    }
    const day = t => Math.floor((t + 8 * 3600e3) / 864e5);
    all.forEach(x => {
      if (x.status === '蛋' && now >= x.hatch) { x.status = '寵物'; x.hp = 10; x.decay = day(x.hatch); }
      if (x.status === '寵物' && day(now) > x.decay) { x.hp -= day(now) - x.decay; x.decay = day(now); if (x.hp <= 0) { x.hp = 0; x.status = '死亡'; x.died = now; } }
    });
    if (action === 'feedPet') { const x = all.find(y => y.id === p.id); if (!x || x.status !== '寵物') throw new Error('這隻寵物現在不能餵'); if (x.hp >= 10) throw new Error('牠已經吃飽了'); x.hp++; x.fed = `${me} ${A.fmtTime(new Date())}`; (x.feedLog ||= []).push({ who: me, t: now }); }
    if (action === 'petLook') { const x = all.find(y => y.id === p.id); if (p.name != null) x.name = String(p.name).slice(0, 12); if (p.data) { x.imgId = 'i' + now.toString(36); store.set('indoor.petimgdata.test', { ...store.get('indoor.petimgdata.test', {}), [x.imgId]: p.data }); } }
    if (action === 'petImage') { const x = all.find(y => y.id === p.id); return { ok: true, img: store.get('indoor.petimgdata.test', {})[x?.imgId] || '' }; }
    store.set(KEY, all);
    const feeders = x => { const m = {}; (x.feedLog || []).filter(f => f.t > now - 7 * 864e5).forEach(f => { m[f.who] = (m[f.who] || 0) + 1; }); return Object.entries(m).map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n); };
    return { ok: true, pets: all.map(x => ({ ...x, img: x.imgId ? 1 : 0, feeders: feeders(x) })), me, now, food: 1, max: 10 };
  };
})();
