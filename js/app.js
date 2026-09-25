'use strict';
(() => {
  const D = window.MAP_DATA;
  const CFG = window.APP_CONFIG || {};
  const RESET_MS = (Number(CFG.resetHours) || 20) * 3600e3;
  const STATUSES = ['好', '不好', '未出席'];
  const ST_CLASS = { '好': 'good', '不好': 'bad', '未出席': 'absent' };
  const BADGE = { good: '✓', bad: '✕', absent: '缺', partial: '…' };
  // 測試模式：密碼輸入 test。使用示範名單，資料另外存放，不會寫入雲端
  const LS_MODE = 'indoor.mode.v1';
  const TEST = (() => { try { return localStorage.getItem(LS_MODE) === 'test'; } catch { return false; } })();
  const SFX = TEST ? '.test' : '';
  const LS = {
    state: 'indoor.state.v1' + SFX, settings: 'indoor.settings.v1' + SFX, queue: 'indoor.queue.v1' + SFX,
    roster: 'indoor.roster.v1' + SFX, students: 'indoor.students.v1' + SFX, ui: 'indoor.ui.v1',
  };
  // 測試模式用的名單：姓名中間以○遮住（去識別化），GitHub 上不會出現完整姓名
  const DEMO_STUDENTS = ["多01杜○昊", "多02林○廷", "多03邱○家", "多04陳○方", "多05曾○瑄", "多06謝○翰", "多07呂○晏", "多08羅○倚", "多09林○岳", "多10柯○伶", "多11張○珮", "多12張○讌", "多13陳○頎", "多14廖○涵", "多15趙○昀", "多16歐○晴", "多17歐○曦", "多18賴○瞳", "料01方○聖", "料02吳○祐", "料03張○愷", "料04許○皓", "料05鄒○軒", "料06朱○潔", "料07李○慧", "料08李○萱", "料09林○廷", "料10張○寧", "料11張○葳", "料12張○敏", "料13陳○靚", "料14陳○芊", "料15陳○琳", "料16陳○微", "料17陳○婷", "料18陳○澖", "料19彭○晴", "料20葉○芸", "料21趙○釩", "料22劉○琪", "料23蔡○芳", "料24繆○恬", "料25蘇○妮", "料26蘇○莙"];
  const DEMO_ROSTER = { inspectors: {
    I1: '料01方○聖', C1: '多08羅○倚', C2: '料07李○慧', C3: '多03邱○家', C4: '料04許○皓', C5: '多07呂○晏', C6: '多17歐○曦',
    C7: '多09林○岳', C8: '料25蘇○妮', C9: '多07呂○晏', C10: '料22劉○琪',
  }, jobs: {
    J01: ['多14廖○涵', '料02吳○祐'], J02: ['料20葉○芸', '料09林○廷'], J03: ['多02林○廷', '多16歐○晴'],
    J04: ['多03邱○家', '多15趙○昀'], J05: ['多06謝○翰', '多05曾○瑄'], J06: ['料05鄒○軒', '料08李○萱'],
    J07: ['料07李○慧', '多08羅○倚'], J08: ['料06朱○潔', '多12張○讌'], J09: ['料13陳○靚', '料22劉○琪'],
    J10: ['料11張○葳', '料16陳○微'], J11: ['料17陳○婷'], J12: ['多13陳○頎'], J13: ['多11張○珮'],
    J14: ['多10柯○伶', '多09林○岳'], J15: ['多04陳○方'], J16: ['料25蘇○妮'], CLASS: ['商一甲'],
  }, outdoor: { name: '外掃檢查紀錄（測試）', labels: {}, inspectors: { I1: '料26蘇○莙', I2: '料10張○寧' }, jobs: {
    J01: ['料15陳○琳'], J02: ['料18陳○澖'], J03: ['料04許○皓'], J04: ['料21趙○釩'], J05: ['料03張○愷'], J06: ['料19彭○晴', '料14陳○芊'],
    J07: ['多18賴○瞳'], J08: ['料24繆○恬'], J09: ['多17歐○曦'], J10: ['多07呂○晏'], J11: ['料23蔡○芳'], J12: ['多01杜○昊', '料12張○敏'],
  } } };
  // 測試模式：修改的名單只存在這台裝置
  const LS_DEMO_ROSTER = 'indoor.demoroster.v1.test';
  const demoRoster = () => (TEST && store.get(LS_DEMO_ROSTER, null)) || DEMO_ROSTER;

  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = n => String(n).padStart(2, '0');
  const WEEK = '日一二三四五六';
  const fmtDate = d => `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
  const fmtDateW = d => `${fmtDate(d)}（${WEEK[d.getDay()]}）`;
  const fmtTime = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const fmtStamp = d => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;

  // ── 儲存 ──
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };
  const idb = (() => {
    let dbp;
    const open = () => dbp ||= new Promise((res, rej) => {
      const r = indexedDB.open('indoormap' + SFX, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = async (mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction('photos', mode);
        const req = fn(t.objectStore('photos'));
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
      });
    };
    return {
      put: (k, v) => tx('readwrite', s => s.put(v, k)),
      get: k => tx('readonly', s => s.get(k)),
      del: k => tx('readwrite', s => s.delete(k)),
      clear: () => tx('readwrite', s => s.clear()),
    };
  })();

  // role：staff（老師、環保股長，用密碼）／student（學生，用身分證字號登入選位）
  let settings = Object.assign({ gasUrl: '', token: '', inspector: '', role: '', sid: '', me: '' }, store.get(LS.settings, {}));
  settings.gasUrl ||= CFG.gasUrl || '';
  const saveSettings = () => store.set(LS.settings, settings);
  const ui = Object.assign({ view: 'student', tab: 'clean', area: 'in', zoom: {} }, store.get(LS.ui, {}));
  const saveUi = () => store.set(LS.ui, ui);
  // role：staff＝導師（統一密碼）／cadre＝幹部（自己的身分證字號）／student＝學生（身分證字號，只能選位）
  const isStudent = () => settings.role === 'student';
  const isCadre = () => settings.role === 'cadre';
  const isGuest = () => settings.role === 'guest'; // 任課老師：只能抽籤、看座位表
  const isStaff = () => settings.role === 'staff' || isCadre();
  const isTeacher = () => settings.role === 'staff';
  const usesSid = () => isStudent() || isCadre() || isGuest();

  let roster = store.get(LS.roster, null);
  const emptyState = () => ({ sessionId: null, startedAt: null, records: {} });
  let state = Object.assign(emptyState(), store.get(LS.state, {}));
  let queue = store.get(LS.queue, []);

  function save() {
    if (!store.set(LS.state, state)) toast('手機儲存空間不足，請先同步後清空紀錄');
  }
  // parts：分組的單位裡，哪些地方有狀況（{ 物件代號: true }）
  const rec = id => state.records[id] ||= { status: {}, issue: false, parts: {}, note: '', photos: [], updatedAt: 0 };
  function ensureSession() {
    if (state.startedAt) return;
    const now = new Date();
    state.startedAt = now.getTime();
    state.sessionId = 'S' + fmtStamp(now) + '-' + Math.random().toString(36).slice(2, 6);
  }

  // ── 物件名稱（同名的自動編號，由上到下）──
  const jobById = Object.fromEntries(D.jobs.map(j => [j.id, j]));
  const itemById = {};
  (() => {
    const groups = {};
    D.items.forEach(it => {
      it.owners = [];
      (groups[it.name] ||= []).push(it);
      itemById[it.id] = it;
    });
    Object.values(groups).forEach(arr => {
      arr.sort((a, b) => a.y - b.y || a.x - b.x);
      arr.forEach((it, i) => {
        it.no = arr.length > 1 ? i + 1 : '';
        it.title = it.no ? `${it.name} ${it.no}` : it.name;
        it.full = it.title;
        it.where = jobById[it.job]?.title || '';
        it.area = 'in';
      });
    });
  })();
  // 外掃區的物件（代號前面加 O:，和內掃的分開）
  const OUT_ITEMS = D.outdoor.items.map(o => ({
    ...o, id: 'O:' + o.id, oid: o.id, area: 'out', owners: [],
    title: `${o.name} ${o.no}`, full: `外掃 ${o.name} ${o.no}`, where: `外掃・${D.outdoor.zones[o.zone]}`,
  }));
  OUT_ITEMS.forEach(it => { itemById[it.id] = it; });
  const ALL_ITEMS = [...D.items, ...OUT_ITEMS];
  // ── 檢查單位：同一個工作分成好幾個地方（花圃 1～5、玻璃 A～H…）時合成一組，一次記錄 ──
  // 清潔程度整組只記一次（扣分也只算一次），各個地方可以分別勾「有狀況」。外掃依南區／北區分開。
  const UNITS = [], unitOf = {};
  (() => {
    const groups = {};
    ALL_ITEMS.forEach(it => { (groups[`${it.area}:${it.job}:${it.zone || ''}`] ||= []).push(it); });
    Object.entries(groups).forEach(([k, its]) => {
      if (its.length === 1) { const it = its[0]; it.items = its; UNITS.push(it); unitOf[it.id] = it; return; }
      const a = its[0];
      const u = {
        id: 'G:' + k, group: true, items: its, area: a.area, job: a.job, zone: a.zone, where: a.where,
        get owners() { return a.owners; },
        get title() { return a.area === 'in' ? jobById[a.job].title : its.map(i => i.title).join('、'); },
        get full() { return (a.area === 'out' ? '外掃 ' : '') + this.title; },
      };
      UNITS.push(u);
      itemById[u.id] = u;
      its.forEach(i => { unitOf[i.id] = u; });
    });
  })();
  D.seats = [];
  D.seatCols.forEach((c, ci) => {
    for (let r = 0; r < c.n; r++) D.seats.push({ id: `${ci + 1}-${r + 1}`, col: ci + 1, row: r + 1, x: c.x, y: D.seatRows[r], w: D.seatW, h: D.seatH });
  });

  const jobItems = id => D.items.filter(it => it.job === id);
  const inspectorName = slotId => roster?.inspectors?.[slotId] || '';
  const className = () => roster?.jobs?.CLASS?.[0] || '';
  const withClass = name => (name && className() ? `${className()} ${name}` : name);
  // 環保股長＋其他幹部，依 cadreOrder 排列（沒列到的放最後）
  const ALL_SLOTS = (() => {
    const all = [...D.inspectorSlots, ...(D.cadreSlots || [])];
    const rank = id => { const i = (D.cadreOrder || []).indexOf(id); return i < 0 ? 999 : i; };
    return all.sort((a, b) => rank(a.id) - rank(b.id));
  })();
  // 使用人：導師＋環保股長＋其他幹部（同一人兼好幾個職位只列一次）
  const userList = () => {
    const out = [{ value: D.teacherLabel, text: D.teacherLabel }];
    ALL_SLOTS.forEach(s => {
      const v = inspectorName(s.id);
      if (!v) return;
      const had = out.find(o => o.value === v);
      if (had) had.text += '、' + (s.short || s.label);
      else out.push({ value: v, text: `${s.short || s.label}：${v}` });
    });
    D.outdoor.inspectors.forEach(s => {
      const v = roster?.outdoor?.inspectors?.[s.id];
      if (!v) return;
      const had = out.find(o => o.value === v);
      if (had) had.text += '、' + s.label; else out.push({ value: v, text: `${s.label}：${v}` });
    });
    return out;
  };
  const jobOwners = id => jobById[id]?.fixed ? [...jobById[id].fixed] : (roster?.jobs?.[id] || []).filter(Boolean);
  // 誰可以檢查哪裡：導師＝全部；環保股長＝內掃；外掃監督A／B＝外掃南區／北區
  const outZone = () => {
    if (isTeacher()) return '';
    const O = roster?.outdoor;
    const s = O && D.outdoor.inspectors.find(p => O.inspectors[p.id] && O.inspectors[p.id] === settings.me);
    return s ? s.zone : null;
  };
  const canCheckIn = () => isTeacher() || (isCadre() && D.inspectorSlots.some(s => inspectorName(s.id) === settings.me));
  const canCheckOut = () => !!roster?.outdoor && outZone() != null;
  const isChecker = () => canCheckIn() || canCheckOut();
  const canPoints = () => isTeacher() || (isCadre() && (ALL_SLOTS.some(s => inspectorName(s.id) === settings.me) || !!roster?.cadres?.[settings.me]));
  const checkable = it => (it.area === 'in' ? canCheckIn() : canCheckOut() && (!outZone() || it.zone === outZone()));
  const scopeUnits = () => UNITS.filter(u => checkable(u.items[0]));
  // 某位同學的掃地工作與幹部職位
  function jobsOf(k) {
    const O = roster?.outdoor;
    return {
      jobs: [
        ...D.jobs.filter(j => !j.fixed && (roster?.jobs?.[j.id] || []).includes(k)).map(j => j.title),
        ...(O ? D.outdoor.jobs.filter(j => (O.jobs[j.id] || []).includes(k)).map(j => '外掃：' + outdoorTitle(j.id)) : []),
        ...(O ? D.outdoor.inspectors.filter(s => O.inspectors[s.id] === k).map(s => '外掃：' + s.label) : []),
      ],
      roles: roster?.cadres ? roster.cadres[k] || [] : ALL_SLOTS.filter(s => inspectorName(s.id) === k).map(s => s.short || s.label),
    };
  }
  // 外掃工作的名稱以外掃試算表裡的為準
  const outdoorTitle = id => roster?.outdoor?.labels?.[id] || D.outdoor.jobs.find(j => j.id === id)?.title || id;

  // 試算表「幹部名單」：同學 → 職位；依職位名稱排入幹部欄位（風紀、學藝各兩位；衛生＝環保股長）
  function slotsFromCadres(cadres) {
    const out = {}, used = {};
    ALL_SLOTS.forEach(s => {
      const label = s.short || s.label;
      const match = role => (label === '環保' ? /衛生|環保/.test(role) : role === label || role === label + '股長');
      const u = used[label] ||= new Set();
      const hit = Object.entries(cadres).find(([k, roles]) => !u.has(k) && roles.some(match));
      if (hit) { out[s.id] = hit[0]; u.add(hit[0]); }
    });
    return out;
  }
  const cadresFromSheet = () => !!roster?.cadres;
  function applyRoster(r) {
    // outdoor：外掃區的工作分配（沒連結時 null）
    const next = { jobs: r?.jobs || {}, inspectors: r?.inspectors || {}, labels: r?.labels || {}, outdoor: r && 'outdoor' in r ? r.outdoor : roster?.outdoor ?? null };
    if (r?.cadres) { next.cadres = r.cadres; next.inspectors = { ...next.inspectors, ...slotsFromCadres(r.cadres) }; }
    const changed = JSON.stringify(next) !== JSON.stringify(roster);
    roster = next;
    store.set(LS.roster, roster);
    // 工作內容以試算表「工作分配」裡寫的為準（沒寫就用內建的）
    D.jobs.forEach(j => { j.defTitle ??= j.title; j.title = roster.labels?.[j.id] || j.defTitle; });
    D.items.forEach(it => { it.owners = jobOwners(it.job); if (it.area === 'in') it.where = jobById[it.job]?.title || ''; });
    OUT_ITEMS.forEach(it => { it.owners = (roster.outdoor?.jobs?.[it.job] || []).filter(Boolean); });
    return changed;
  }

  // 單位的狀態（整組一起）
  function unitSummary(u) {
    const r = state.records[u.id];
    if (!r) return { st: 'none', issue: false, photos: [] };
    const vals = u.owners.map(o => r.status[o]).filter(Boolean);
    let st = 'none';
    if (vals.length) {
      if (vals.includes('不好')) st = 'bad';
      else if (vals.includes('未出席')) st = 'absent';
      else if (vals.length === u.owners.length) st = 'good';
      else st = 'partial';
    }
    const issue = u.group ? Object.values(r.parts || {}).some(Boolean) : !!r.issue;
    return { st, issue, photos: r.photos || [] };
  }
  // 地圖上單一物件的狀態：清潔程度跟著整組；有狀況、照片看這個地方自己的
  function summary(item) {
    const u = unitOf[item.id] || item;
    const s = unitSummary(u);
    if (!u.group) return s;
    const r = state.records[u.id];
    return { st: s.st, issue: !!r?.parts?.[item.id], photos: s.photos.filter(p => p.part === item.id) };
  }
  const issueParts = u => (u.group ? u.items.filter(i => state.records[u.id]?.parts?.[i.id]) : []);

  // ── 地圖繪製 ──
  // 老師視角＝整張圖轉 180 度：位置對調，但文字保持正向
  const flipOn = () => ui.view === 'teacher';

  // ── 緊縮排列：物件寬度不變，只把物件之間橫向的空隙縮到 GAP，讓整間教室塞進手機寬度 ──
  // 座位、玻璃、花圃等「實體」物件會擋住壓縮；地板、走廊、黑板（stretch）跟著縮窄；
  // float 物件（講桌、下方垃圾桶…）寬度不變、依中心點移動，彼此不重疊。
  const GAP = 12;
  const ORIGINAL = { deco: D.deco, items: D.items, seats: D.seats, cols: D.seatCols, box: D.box, seatBox: D.seatBox };
  let compactCache = null;
  function compactLayout() {
    if (compactCache) return compactCache;
    const elastic = s => s.floor || s.stretch || (s.cls && !s.id && s.cls !== 'winbg'); // 裝飾（除了窗戶底色）也跟著縮
    const solid = s => !elastic(s) && !s.float;
    // 實體物件佔用的橫向區間，合併重疊的
    const spans = [...D.deco, ...D.items, ...D.seats].filter(solid).map(s => [s.x, s.x + s.w]).sort((a, b) => a[0] - b[0]);
    const merged = [];
    spans.forEach(([a, b]) => {
      const last = merged[merged.length - 1];
      if (last && a <= last[1]) last[1] = Math.max(last[1], b); else merged.push([a, b]);
    });
    // 每個區間的新起點：和前一個區間只留 GAP（原本比 GAP 小就不動）
    const x0 = D.box.x0;
    let pos = x0;
    const map = merged.map(([a, b], i) => {
      const prevEnd = i ? merged[i - 1][1] : x0;
      const na = pos + Math.min(a - prevEnd, GAP);
      pos = na + (b - a);
      return { a, b, na };
    });
    const lastEnd = merged[merged.length - 1][1];
    const nx1 = pos + Math.min(D.box.x1 - lastEnd, GAP);
    // 原座標 → 新座標（區間內平移，空隙內線性壓縮）
    const X = x => {
      let prevA = x0, prevNA = x0;
      for (const m of map) {
        if (x < m.a) return prevNA + (x - prevA) * ((m.na - prevNA) / Math.max(1e-6, m.a - prevA));
        if (x <= m.b) return m.na + (x - m.a);
        prevA = m.b; prevNA = m.na + (m.b - m.a);
      }
      return prevNA + (x - prevA) * ((nx1 - prevNA) / Math.max(1e-6, D.box.x1 - prevA));
    };
    const shiftPts = (pts, dx) => pts && pts.map(([px, py]) => [px + dx, py]);
    const move = s => {
      if (elastic(s)) {
        const nx = X(s.x);
        return { ...s, x: nx, w: X(s.x + s.w) - nx, poly: s.poly && s.poly.map(([px, py]) => [X(px), py]), labelAt: s.labelAt && [X(s.labelAt[0]), s.labelAt[1]] };
      }
      const nx = s.float ? X(s.x + s.w / 2) - s.w / 2 : X(s.x);
      return { ...s, x: nx, poly: shiftPts(s.poly, nx - s.x), labelAt: s.labelAt && [s.labelAt[0] + nx - s.x, s.labelAt[1]] };
    };
    const items = D.items.map(move);
    // float 物件如果和同一高度的其他 float 重疊，就往右推開
    // float 物件：同一高度的排成一列，彼此不重疊、不超過右邊的障礙物（黑板、牆）
    const sameRow = (p, s) => p.y < s.y + s.h && s.y < p.y + p.h;
    const wallR = X(1430);
    const floats = items.filter(s => s.float).sort((a, b) => a.x - b.x);
    const rows = [];
    floats.forEach(s => { const r = rows.find(g => g.some(p => sameRow(p, s))); if (r) r.push(s); else rows.push([s]); });
    rows.forEach(g => {
      g.sort((a, b) => a.x - b.x);
      const L = g[0].x;
      const R = items.filter(o => !o.float && !o.floor && g.some(s => sameRow(o, s)) && o.x > L).reduce((m, o) => Math.min(m, o.x - 6), wallR);
      const sum = g.reduce((t, s) => t + s.w, 0), need = sum + 6 * (g.length - 1);
      if (need > R - L) {
        // 真的放不下才等比例縮小（垃圾桶維持圓形）
        const f = Math.max(0.5, (R - L - 6 * (g.length - 1)) / sum);
        let x = L;
        g.forEach(s => { s.y += (s.h - s.h * f) / 2; s.w *= f; s.h *= f; s.x = x; x += s.w + 6; });
        return;
      }
      g.forEach((s, i) => { if (i && s.x < g[i - 1].x + g[i - 1].w + 6) s.x = g[i - 1].x + g[i - 1].w + 6; });
      // 超出右邊界就整排往左收
      let right = R;
      [...g].reverse().forEach(s => { if (s.x + s.w > right) s.x = right - s.w; right = s.x - 6; });
    });
    // 座位放大、間距收窄：左右空隙 GAP→4、前後空隙 24→8（只有緊縮排列時）
    const seats = D.seats.map(move).map(s => ({ ...s, x: s.x - (GAP - 4) / 2, w: s.w + GAP - 4, y: s.y - 8, h: s.h + 16 }));
    compactCache = {
      deco: D.deco.map(move), items, seats, colLabelY: D.colLabelY - 10,
      cols: D.seatCols.map(c => ({ ...c, x: X(c.x) })),
      box: { ...D.box, x1: nx1 }, seatBox: { ...D.seatBox, x0: X(D.seatBox.x0), x1: Math.min(nx1, X(D.seatBox.x1)) },
    };
    return compactCache;
  }
  // 座位圖一律緊縮排列（沒有開關）；其他地圖依「緊縮」按鈕
  const isCompact = mode => mode === 'seats' || !!ui.compact;
  const layout = mode => (isCompact(mode) ? compactLayout() : ORIGINAL);
  const boxOf = mode => (mode === 'seats' ? layout(mode).seatBox : layout(mode).box);
  const pc = f => (f * 100).toFixed(3) + '%';
  function rectStyle(s, box) {
    const W = box.x1 - box.x0, H = box.y1 - box.y0;
    let x = s.x, y = s.y;
    if (flipOn()) { x = box.x0 + box.x1 - s.x - s.w; y = box.y0 + box.y1 - s.y - s.h; }
    return `left:${pc((x - box.x0) / W)};top:${pc((y - box.y0) / H)};width:${pc(s.w / W)};height:${pc(s.h / H)};`;
  }
  function relPt(s, [px, py]) {
    let fx = (px - s.x) / s.w, fy = (py - s.y) / s.h;
    if (flipOn()) { fx = 1 - fx; fy = 1 - fy; }
    return [fx, fy];
  }
  const clipStyle = s => (s.poly ? `clip-path:polygon(${s.poly.map(p => relPt(s, p).map(pc).join(' ')).join(',')});` : '');
  const inBox = (s, b) => s.x < b.x1 && s.x + s.w > b.x0 && s.y < b.y1 && s.y + s.h > b.y0;
  const vert = s => s.h > s.w * 1.3;
  const atStyle = (s, p) => { const [fx, fy] = relPt(s, p); return `left:${pc(fx)};top:${pc(fy)}`; };

  function mapHtml(mode, opts = {}) {
    const box = boxOf(mode);
    const L = layout(mode);
    const live = mode !== 'seats';
    let h = '';
    // 座位圖只畫教室牆壁和黑板溝，不畫掃地用的東西
    L.deco.forEach(s => {
      if (!inBox(s, box) || (!live && !['room', 'ledge'].includes(s.cls))) return;
      const r = !live && s.cls === 'room' ? { ...s, h: box.y1 - s.y - 2 } : s; // 座位圖：後牆畫在範圍底部
      h += `<div class="d d--${s.cls}" style="${rectStyle(r, box)}"></div>`;
    });
    L.items.forEach(it => {
      if (!inBox(it, box)) return;
      if (!live && !it.seatShow) return; // 座位圖：只留黑板、講桌、前後門
      const cls = `it it--${it.cls}${it.floor ? ' floor' : ''}${it.bin ? (it.square ? ' bin sq' : ' bin') : ''}${!live ? ' clear' : ''}`;
      const label = (!live && it.seatLabel) || it.short || (it.no && !it.bin ? it.name + it.no : it.name);
      let inner;
      if (it.floor) {
        inner = `<span class="floor-chip" style="${atStyle(it, it.labelAt)}">${live ? '🧹 ' : ''}${esc(label)}${live ? '<span class="badge"></span>' : ''}</span>`;
      } else if (it.bin) {
        inner = '';
      } else if (it.labelAt) {
        inner = `<span class="lbl at${vert(it) ? ' v' : ''}" style="${atStyle(it, it.labelAt)}">${esc(label)}</span>`;
      } else {
        inner = `<span class="lbl${vert(it) ? ' v' : ''}">${esc(label)}</span>`;
      }
      const style = rectStyle(it, box) + clipStyle(it);
      if (live) {
        h += `<button type="button" class="${cls}" data-id="${it.id}" aria-label="${esc(it.full)}" style="${style}">${inner}${it.floor ? '' : '<span class="badge"></span>'}<span class="mk"></span></button>`;
      } else {
        h += `<div class="${cls} deco"${['desk', 'board'].includes(it.id) ? ' data-tch="1"' : ''} style="${style}">${inner}</div>`;
      }
      if (it.bin && live) {
        h += `<div class="binlbl" style="${rectStyle({ x: it.x - 8, y: it.y + it.h + 10, w: it.w + 16, h: 118 }, box)}"><span>${esc(it.name)}</span></div>`;
      }
    });
    L.cols.forEach((c, i) => {
      h += `<div class="collbl" style="${rectStyle({ x: c.x - 10, y: L.colLabelY ?? D.colLabelY, w: D.seatW + 20, h: 28 }, box)}">第${i + 1}排</div>`;
    });
    L.seats.forEach(s => {
      if (mode === 'seats') {
        h += `<button type="button" class="seat ${opts.seatClass ? opts.seatClass(s) : ''}" data-seat="${s.id}" aria-label="第${s.col}排第${s.row}個" style="${rectStyle(s, box)}">${opts.seatHtml ? opts.seatHtml(s) : ''}</button>`;
      } else {
        h += `<div class="seat ghost" style="${rectStyle(s, box)}"><span>第${s.row}個</span></div>`;
      }
    });
    return h;
  }

  // 每個地圖：縮放（--u＝每單位幾 px）與重畫
  const maps = {};
  const MIN_U = { clean: 0.46, jobs: 0.46, seats: 0.78 };
  function mountMap(name, mode, opts = {}) {
    const wrap = $(`[data-map="${name}"]`);
    maps[name] = { name, mode, opts, wrap, el: wrap.querySelector('.map') };
    wrap.parentElement.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => zoomMap(name, +b.dataset.zoom)));
    return maps[name];
  }
  function renderMap(name) {
    const m = maps[name];
    if (!m) return;
    m.el.innerHTML = mapHtml(m.mode, m.opts);
    m.el.classList.toggle('compact', isCompact(m.mode));
    sizeMap(name);
    if (name === 'clean') { if (ui.area === 'out') renderOutClean(); refresh(); }
    m.opts.after?.();
  }
  function levels(m) {
    const box = boxOf(m.mode), W = box.x1 - box.x0;
    const fit = m.wrap.clientWidth / W;
    return { fit, list: [...new Set([fit, 0.46, 0.62, 0.78, 1, 1.25].filter(v => v >= fit - 1e-6))].sort((a, b) => a - b) };
  }
  function sizeMap(name) {
    const m = maps[name];
    if (!m || !m.wrap.clientWidth) return;
    const box = boxOf(m.mode), W = box.x1 - box.x0, H = box.y1 - box.y0;
    const { fit } = levels(m);
    // 緊縮排列時預設「剛好塞進畫面寬度」
    const want = ui.zoom[name] ?? (isCompact(m.mode) ? fit : Math.max(fit, MIN_U[name] || fit));
    const u = Math.max(fit, want);
    m.u = u;
    m.el.style.width = Math.floor(W * u) + 'px';
    m.el.style.height = Math.floor(H * u) + 'px';
    m.el.style.setProperty('--u', u.toFixed(4));
    const zo = m.wrap.parentElement.querySelector('.zoom-val');
    if (zo) zo.textContent = Math.round(u / fit * 100) + '%';
  }
  function zoomMap(name, dir) {
    const m = maps[name];
    const { list } = levels(m);
    let i = list.findIndex(v => v >= m.u - 1e-6);
    if (i < 0) i = list.length - 1;
    const next = list[Math.max(0, Math.min(list.length - 1, i + dir))];
    const cx = (m.wrap.scrollLeft + m.wrap.clientWidth / 2) / m.el.offsetWidth;
    ui.zoom[name] = next; saveUi();
    sizeMap(name);
    m.wrap.scrollLeft = cx * m.el.offsetWidth - m.wrap.clientWidth / 2;
  }
  window.addEventListener('resize', () => Object.keys(maps).forEach(sizeMap));

  // ── 學生視角／老師視角 ──
  function paintView() {
    const t = flipOn();
    $('#viewBtn').setAttribute('aria-pressed', t);
    $('#viewBtn').setAttribute('aria-label', t ? '目前是老師視角，按一下切換為學生視角' : '目前是學生視角，按一下切換為老師視角');
    document.querySelectorAll('.orient').forEach(el => { el.textContent = t ? '⬇ 黑板在下' : '⬆ 黑板在上'; el.title = t ? '老師視角：從講台往學生看' : '學生視角：學生面向黑板'; });
  }
  $('#viewBtn').addEventListener('click', () => {
    ui.view = flipOn() ? 'student' : 'teacher';
    saveUi();
    paintView();
    Object.values(maps).forEach(m => {
      const w = m.wrap, maxX = w.scrollWidth - w.clientWidth, sx = w.scrollLeft;
      renderMap(m.name);
      w.scrollLeft = maxX - sx; // 轉 180 度後，原本看的位置在另一邊
    });
    toast(flipOn() ? '老師視角：黑板在下方' : '學生視角：黑板在上方');
  });

  // ── 除霧模式（只有導師）：暫時隱藏大家大頭照上的配件，只影響這台裝置，不影響同學看到的樣子 ──
  function paintDefog() {
    const on = isTeacher() && !!ui.defog;
    $('#defogBtn').hidden = !isTeacher();
    $('#defogBtn').setAttribute('aria-pressed', on);
    document.body.classList.toggle('defog', on);
  }
  $('#defogBtn').addEventListener('click', () => {
    ui.defog = !ui.defog; saveUi(); paintDefog();
    toast(ui.defog ? '🌫️ 除霧模式：已暫時拿掉大家的配件（只有你看得到）' : '已恢復顯示配件');
  });

  // ── 夜間模式：按月亮／太陽切換，記在這台裝置；沒選過就跟著手機設定 ──
  const darkNow = () => document.documentElement.dataset.theme === 'dark';
  function paintTheme() {
    $('#themeBtn').textContent = darkNow() ? '☀️' : '🌙';
    $('#themeBtn').setAttribute('aria-label', darkNow() ? '切換成白天模式' : '切換成夜間模式');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', darkNow() ? '#1f2127' : '#ffffff');
  }
  $('#themeBtn').addEventListener('click', () => {
    ui.theme = darkNow() ? 'light' : 'dark';
    document.documentElement.dataset.theme = ui.theme;
    saveUi();
    paintTheme();
    toast(darkNow() ? '🌙 夜間模式' : '☀️ 白天模式');
  });
  paintTheme();

  // ── 緊縮排列開關（手機第一次打開時預設開啟）──
  if (ui.compact == null) ui.compact = window.innerWidth < 600;
  function paintCompact() {
    document.querySelectorAll('[data-compact]').forEach(b => {
      b.setAttribute('aria-pressed', !!ui.compact);
      b.textContent = ui.compact ? '↔ 緊縮：開' : '↔ 緊縮';
    });
  }
  document.querySelectorAll('[data-compact]').forEach(b => b.addEventListener('click', () => {
    ui.compact = !ui.compact;
    ui.zoom = {}; // 換成新的寬度，縮放重新以「塞進畫面」為準
    saveUi();
    paintCompact();
    Object.values(maps).forEach(m => { renderMap(m.name); m.wrap.scrollLeft = 0; });
    toast(ui.compact ? '緊縮排列：已去掉多餘的空隙' : '已恢復原本的比例');
  }));
  paintCompact();

  // ── 分頁 ──
  const TABS = ['clean', 'points', 'seats', 'draw', 'shop', 'line', 'jobs'];
  const tabHooks = {};
  const allowedTabs = () => (isGuest() ? ['draw', 'seats'] : isStudent() ? ['seats', 'shop', 'line', 'jobs']
    : TABS.filter(t => (t === 'clean' ? isChecker() : t === 'points' ? canPoints() : true)));
  function showTab(name) {
    if (!allowedTabs().includes(name)) name = allowedTabs()[0];
    ui.tab = name; saveUi();
    TABS.forEach(t => {
      $(`#tab-${t}`).hidden = t !== name;
      const b = $(`.tabs [data-tab="${t}"]`);
      b.hidden = !allowedTabs().includes(t);
      b.setAttribute('aria-selected', t === name);
    });
    document.body.dataset.tab = name;
    Object.values(maps).forEach(m => sizeMap(m.name));
    tabHooks[name]?.();
  }
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ── 掃地檢查地圖 ──
  function refresh() {
    const root = $('#tab-clean');
    if (!maps.clean?.el) return;
    // 進度以「檢查單位」計算（花圃 1～5 算一項）；有狀況以地方計算
    const mine = scopeUnits().filter(u => u.area === ui.area);
    const checked = mine.filter(u => ['good', 'bad', 'absent'].includes(unitSummary(u).st)).length;
    let issues = 0;
    ALL_ITEMS.forEach(it => {
      const s = summary(it);
      if (checkable(it) && s.issue) issues++;
      const el = root.querySelector(`[data-id="${it.id}"]`);
      if (!el) return;
      el.classList.toggle('out-scope', !checkable(it));
      el.classList.remove('st-good', 'st-bad', 'st-absent', 'st-partial');
      if (s.st !== 'none') el.classList.add('st-' + s.st);
      el.classList.toggle('is-issue', s.issue);
      const b = el.querySelector('.badge');
      if (b) b.textContent = BADGE[s.st] || '';
      const mk = el.querySelector('.mk');
      if (mk) {
        mk.innerHTML = (s.issue ? '<span class="flag">!</span>' : '')
          + (s.photos.length ? `<span class="phc" data-lb="${(unitOf[it.id] || it).id}" data-i="${(state.records[(unitOf[it.id] || it).id]?.photos || []).indexOf(s.photos[0])}" role="button" aria-label="查看照片">📷${s.photos.length > 1 ? s.photos.length : ''}</span>` : '');
      }
    });
    const zoneName = ui.area === 'out' && outZone() ? D.outdoor.zones[outZone()] : '';
    $('#progress').textContent = `${ui.area === 'out' ? '外掃' + zoneName : '內掃'} 已檢查 ${checked} / ${mine.length}`;
    const chip = $('#issueChip');
    chip.hidden = !issues;
    chip.textContent = `⚠ ${issues} 處有狀況`;
    const d = state.startedAt ? new Date(state.startedAt) : new Date();
    $('#dateLabel').textContent = `${d.getMonth() + 1}/${d.getDate()}(${WEEK[d.getDay()]})`; // 短一點，放在身分標籤右邊
    updateResetInfo();
  }

  function updateResetInfo() {
    const el = $('#resetInfo');
    if (!state.startedAt) { el.textContent = '尚未開始'; return; }
    const end = new Date(state.startedAt + RESET_MS);
    el.textContent = `${end.getMonth() + 1}/${end.getDate()} ${fmtTime(end)} 自動清空`;
  }

  function onCleanClick(e) {
    const t = e.target.closest('[data-lb]');
    if (t) { e.stopPropagation(); openLightbox(t.dataset.lb, Math.max(0, +t.dataset.i || 0)); return; }
    const o = e.target.closest('[data-id]');
    if (!o) return;
    const it = itemById[o.dataset.id];
    if (!checkable(it)) return toast(it.area === 'out' && outZone() ? `這裡不在你的檢查範圍（你負責外掃${D.outdoor.zones[outZone()]}）` : '這裡不在你的檢查範圍');
    openItem(it.id);
  }

  // ── 內掃區／外掃區切換 ──
  function renderArea() {
    const both = canCheckIn() && canCheckOut();
    if (!canCheckIn() && canCheckOut()) ui.area = 'out';
    if (!canCheckOut() && !isTeacher()) ui.area = 'in';
    $('#areaSw').hidden = !both && !isTeacher();
    document.querySelectorAll('#areaSw [data-area]').forEach(b => b.setAttribute('aria-selected', b.dataset.area === ui.area));
    $('#cleanIn').hidden = ui.area !== 'in';
    $('#cleanOut').hidden = ui.area !== 'out';
    if (ui.area === 'out') renderOutClean();
    else sizeMap('clean');
    refresh();
  }
  function renderOutClean() {
    const O = roster?.outdoor;
    $('#outMap').innerHTML = O
      ? `<p class="muted small center">上下滑動看整條走廊，點物件就能記錄（點了才會顯示負責的同學）${outZone() ? `｜你負責${D.outdoor.zones[outZone()]}` : ''}</p>${outdoorDiagram(O, 'check')}`
      : `<div class="panel"><p>還沒有連結外掃區。${isTeacher() ? '請到「👥 工作分配 → 🌳 外掃區工作分配」貼上外掃試算表的網址。' : '請導師先連結外掃區。'}</p></div>`;
  }
  $('#areaSw').addEventListener('click', e => {
    const b = e.target.closest('[data-area]');
    if (!b) return;
    ui.area = b.dataset.area; saveUi();
    renderArea();
  });

  let issueCursor = -1;
  $('#issueChip').addEventListener('click', () => {
    showTab('clean');
    const list = ALL_ITEMS.filter(it => checkable(it) && summary(it).issue);
    if (!list.length) return;
    issueCursor = (issueCursor + 1) % list.length;
    flashItems([list[issueCursor].id], 'clean');
  });
  function flashItems(ids, mapName) {
    // 分組單位 → 展開成有狀況的地方（沒有就全部）
    ids = ids.flatMap(id => { const u = itemById[id]; return u?.group ? (issueParts(u).length ? issueParts(u) : u.items).map(i => i.id) : [id]; });
    if (mapName === 'clean') {
      const a = itemById[ids[0]]?.area;
      if (a && a !== ui.area) { ui.area = a; saveUi(); renderArea(); }
    }
    const el = mapName === 'clean' ? $('#tab-clean') : maps[mapName].el;
    const nodes = ids.map(id => el.querySelector(`[data-id="${id}"]`)).filter(Boolean);
    if (!nodes.length) return;
    nodes[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    nodes.forEach(n => { n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); });
    setTimeout(() => nodes.forEach(n => n.classList.remove('flash')), 2200);
  }

  // ── 底部面板 ──
  const sheet = $('#sheet'), sheetBody = $('#sheetBody'), backdrop = $('#backdrop');
  let sheetMode = null;
  const sheetHandlers = {};   // kind → (act, button, event)
  const changeHandlers = {};  // kind → (event)

  function openSheet(mode, html) {
    if (sheetMode?.kind === 'item') commitNote();
    sheetMode = mode;
    sheetBody.innerHTML = html;
    sheet.hidden = false; backdrop.hidden = false;
    sheetBody.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    if (sheetMode?.kind === 'item') commitNote();
    const k = sheetMode?.kind;
    if (k === 'item') markSelected([]);
    sheet.hidden = true; backdrop.hidden = true; sheetMode = null;
    document.body.style.overflow = '';
    if (k) sheetHandlers[k + ':close']?.();
  }
  backdrop.addEventListener('click', closeSheet);
  // 視窗透明度：調低就看得到底下的地圖（記住在這台裝置）
  function applyAlpha() {
    const a = Math.max(25, Math.min(100, +ui.sheetAlpha || 100));
    sheet.style.setProperty('--sheet-a', a / 100);
    backdrop.style.opacity = a < 100 ? Math.max(0, (a - 25) / 75) * 0.6 : '';
    $('#sheetAlpha').value = a;
    $('#sheetAlphaVal').textContent = a < 100 ? `${100 - a}% 透明` : '不透明';
    sheet.classList.toggle('see-through', a < 100);
  }
  $('#sheetAlpha').addEventListener('input', e => { ui.sheetAlpha = +e.target.value; applyAlpha(); });
  $('#sheetAlpha').addEventListener('change', saveUi);
  applyAlpha();
  const closeBtn = `<button type="button" class="close-btn" data-act="close" aria-label="關閉">✕</button>`;
  const sheetHead = (title, eyebrow = '') => `<div class="sheet-head"><div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h2 id="sheetTitle">${title}</h2></div>${closeBtn}</div>`;

  sheetBody.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    if (b.dataset.act === 'close') return closeSheet();
    const fn = sheetMode && sheetHandlers[sheetMode.kind];
    if (fn) fn(b.dataset.act, b, e);
  });
  sheetBody.addEventListener('change', e => {
    const fn = sheetMode && changeHandlers[sheetMode.kind];
    if (fn) fn(e);
  });

  // ── 物件檢查面板 ──
  function itemHtml(item, focus) {
    const r = state.records[item.id] || { status: {}, issue: false, parts: {}, note: '', photos: [] };
    const fItem = focus && itemById[focus];
    let h = sheetHead(esc(item.title), esc(item.group ? `${item.area === 'in' ? '' : item.where + '・'}共 ${item.items.length} 個地方，整組一起記錄` : item.where));
    h += `<h3>清潔程度</h3><div class="owners">`;
    if (!item.owners.length) h += `<p class="empty">尚未指定負責同學。請導師到「工作分配」分頁設定。</p>`;
    item.owners.forEach(o => {
      h += `<div class="owner-row"><div class="owner-name">${esc(o)}</div><div class="seg" role="group" aria-label="${esc(o)} 清潔程度">`;
      STATUSES.forEach(s => {
        h += `<button type="button" class="${ST_CLASS[s]}" data-act="status" data-owner="${esc(o)}" data-st="${s}" aria-pressed="${r.status[o] === s}">${s}</button>`;
      });
      h += `</div></div>`;
    });
    h += `</div>`;
    if (item.group) {
      // 分成好幾個地方：直接勾哪些地方有狀況
      const anyIssue = item.items.some(i => r.parts?.[i.id]);
      h += `<div class="issue-box${anyIssue ? ' on' : ''}" id="issueBox"><div class="switch-row">哪些地方有狀況？</div><div class="parts">`;
      item.items.forEach(i => {
        h += `<label class="part${i.id === focus ? ' focus' : ''}"><input type="checkbox" data-part="${i.id}"${r.parts?.[i.id] ? ' checked' : ''}><span>${esc(i.short ? i.name : i.title)}</span></label>`;
      });
      h += `</div><textarea id="noteInput" placeholder="說明狀況（勾選的地方共用），例如：花圃有垃圾、玻璃有手印…">${esc(r.note)}</textarea></div>`;
    } else {
      h += `<div class="issue-box${r.issue ? ' on' : ''}" id="issueBox">
        <label class="switch-row"><span class="switch"><input type="checkbox" id="issueToggle"${r.issue ? ' checked' : ''}><span></span></span>這裡有狀況</label>
        <textarea id="noteInput" placeholder="說明狀況，例如：玻璃破裂、垃圾桶沒倒、桌椅沒排整齊…">${esc(r.note)}</textarea>
      </div>`;
    }
    const photos = r.photos.map((p, i) => ({ p, i }));
    h += `<div class="photos-head"><h3>照片${item.group && fItem ? `<span class="muted small">（新照片會標在「${esc(fItem.short ? fItem.name : fItem.title)}」）</span>` : ''}</h3><button type="button" class="btn btn--primary" data-act="photo">📷 拍照／上傳</button></div>`;
    if (photos.length) {
      h += `<div class="photo-grid">`;
      photos.forEach(({ p, i }) => {
        let st = '';
        if (p.st === 'uploading') st = `<span class="st">上傳中…</span>`;
        else if (p.st === 'error') st = `<button type="button" class="st err" data-act="retry" data-pid="${p.id}">重試上傳</button>`;
        else if (p.st === 'local') st = `<span class="st">僅存手機</span>`;
        else if (p.st === 'test') st = `<span class="st">測試・未上傳</span>`;
        const tag = item.group && p.part && itemById[p.part] ? `<span class="ptag">${esc(itemById[p.part].short || itemById[p.part].title)}</span>` : '';
        h += `<div class="photo-cell"><button type="button" class="open" data-act="view" data-i="${i}" aria-label="放大照片"><img src="${p.thumb}" alt=""></button>${tag}${st}<button type="button" class="del" data-act="delphoto" data-pid="${p.id}" aria-label="移除照片">✕</button></div>`;
      });
      h += `</div>`;
    } else {
      h += `<p class="empty">尚無照片。${settings.gasUrl ? '照片會壓縮後上傳到你的 Google 雲端硬碟。' : '尚未設定雲端，照片只會存在這支手機。'}</p>`;
    }
    return h;
  }
  // id 可以是地圖上的物件或整組單位；focus＝使用者點的那個地方（地圖上會標出來）
  function openItem(id) {
    const it = itemById[id];
    if (!it) return;
    const u = unitOf[id] || it;
    const focus = it.group ? it.items[0].id : id;
    openSheet({ kind: 'item', id: u.id, focus }, itemHtml(u, focus));
    markSelected(u.group ? u.items.map(i => i.id) : [u.id], focus);
  }
  // 面板打開時，在地圖上標出這一組的位置
  function markSelected(ids, focus) {
    document.querySelectorAll('#tab-clean .sel, #tab-clean .sel-focus').forEach(n => n.classList.remove('sel', 'sel-focus'));
    ids.forEach(id => $('#tab-clean')?.querySelector(`[data-id="${id}"]`)?.classList.add(id === focus ? 'sel-focus' : 'sel'));
  }
  function rerenderItem(id) {
    if (sheetMode?.kind !== 'item' || sheetMode.id !== id) return;
    const scroll = sheetBody.scrollTop;
    const note = $('#noteInput')?.value;
    sheetBody.innerHTML = itemHtml(itemById[id], sheetMode.focus);
    if (note != null) $('#noteInput').value = note;
    sheetBody.scrollTop = scroll;
  }
  function touch(item) {
    rec(item.id).updatedAt = Date.now();
    save();
    enqueue(rowsFor(item));
    refresh();
  }
  let noteTimer;
  function commitNote() {
    clearTimeout(noteTimer);
    const ta = $('#noteInput');
    if (!ta || sheetMode?.kind !== 'item') return;
    const item = itemById[sheetMode.id];
    if (ta.value === (state.records[item.id]?.note || '')) return;
    ensureSession();
    rec(item.id).note = ta.value;
    touch(item);
  }
  sheetBody.addEventListener('input', e => {
    if (e.target.id === 'noteInput') { clearTimeout(noteTimer); noteTimer = setTimeout(commitNote, 800); }
  });
  changeHandlers.item = e => {
    const item = itemById[sheetMode.id];
    const part = e.target.dataset?.part;
    if (e.target.id !== 'issueToggle' && !part) return;
    ensureSession();
    const r = rec(item.id);
    if (part) {
      (r.parts ||= {})[part] = e.target.checked;
      r.issue = item.items.some(i => r.parts[i.id]);
      sheetMode.focus = part;
      markSelected(item.items.map(i => i.id), part);
    } else {
      r.issue = e.target.checked;
    }
    $('#issueBox').classList.toggle('on', r.issue);
    commitNote();
    touch(item);
  };
  sheetHandlers.item = async (act, b) => {
    const item = itemById[sheetMode.id];
    if (act === 'status') {
      ensureSession();
      const r = rec(item.id);
      const o = b.dataset.owner;
      r.status[o] = r.status[o] === b.dataset.st ? '' : b.dataset.st;
      b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', r.status[o] === x.dataset.st));
      touch(item);
      // 只有一位負責人且標「好」時自動關閉；「不好」通常還要拍照，所以不關
      if (item.owners.length === 1 && r.status[o] === '好' && !r.issue) setTimeout(() => { if (sheetMode?.id === item.id) closeSheet(); }, 350);
    } else if (act === 'photo') {
      fileTarget = { id: item.id, part: item.group ? sheetMode.focus : '' };
      $('#fileInput').click();
    } else if (act === 'view') {
      openLightbox(item.id, +b.dataset.i);
    } else if (act === 'retry') {
      uploadPhoto(item.id, b.dataset.pid);
    } else if (act === 'delphoto') {
      if (!await ask('要從這次紀錄中移除這張照片嗎？\n（已上傳到雲端硬碟的檔案會保留）', '移除', true)) return;
      const r = rec(item.id);
      r.photos = r.photos.filter(p => p.id !== b.dataset.pid);
      idb.del(b.dataset.pid).catch(() => {});
      touch(item);
      rerenderItem(item.id);
    }
  };

  // ── 照片：壓縮、存手機、上傳雲端 ──
  let fileTarget = null;
  $('#fileInput').addEventListener('change', async e => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length || !fileTarget) return;
    const { id, part } = fileTarget;
    for (const f of files) await addPhoto(id, f, part);
  });

  async function loadImage(file) {
    if ('createImageBitmap' in window) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
    }
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('無法讀取圖片'));
      img.src = URL.createObjectURL(file);
    });
  }
  function drawTo(img, max) {
    const w = img.width, h = img.height, s = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  const toBlob = (c, q) => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('壓縮失敗')), 'image/jpeg', q));
  const blobToBase64 = b => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1]);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(b);
  });

  async function addPhoto(itemId, file, part = '') {
    const item = itemById[itemId];
    try {
      toast('照片壓縮中…');
      const img = await loadImage(file);
      const full = await toBlob(drawTo(img, 1600), 0.72);
      const thumb = drawTo(img, 200).toDataURL('image/jpeg', 0.6);
      img.close?.();
      const pid = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      try { await idb.put(pid, full); } catch { /* 無 IndexedDB 時只保留小圖 */ }
      ensureSession();
      rec(itemId).photos.push({ id: pid, thumb, part, st: TEST ? 'test' : settings.gasUrl ? 'uploading' : 'local' });
      touch(item);
      rerenderItem(itemId);
      toast(`已壓縮為 ${Math.round(full.size / 1024)} KB`);
      if (settings.gasUrl && !TEST) uploadPhoto(itemId, pid, full);
    } catch (err) {
      toast('照片處理失敗：' + err.message);
    }
  }

  const inflight = new Set();
  async function uploadPhoto(itemId, pid, blob) {
    const item = itemById[itemId];
    const find = () => state.records[itemId]?.photos.find(p => p.id === pid);
    let ph = find();
    if (!ph || inflight.has(pid) || !settings.gasUrl || TEST) return;
    inflight.add(pid);
    ph.st = 'uploading'; save(); refresh(); rerenderItem(itemId);
    try {
      blob ||= await idb.get(pid);
      if (!blob) throw new Error('手機上找不到原圖');
      const data = await blobToBase64(blob);
      const res = await api('uploadPhoto', {
        date: fmtDate(new Date(state.startedAt)),
        filename: `${fmtStamp(new Date())}_${item.full.replace(/[\s、，]+/g, '_')}_${pid.slice(-4)}.jpg`,
        description: `${item.full}｜${item.owners.join('、')}`,
        mimeType: 'image/jpeg', data,
      });
      ph = find();
      if (ph) { ph.st = 'done'; ph.driveId = res.id; ph.url = res.url; }
    } catch (err) {
      ph = find();
      if (ph) ph.st = 'error';
      toast('照片上傳失敗：' + err.message);
    } finally {
      inflight.delete(pid);
    }
    if (find()) touch(item);
    rerenderItem(itemId);
  }
  function retryPhotos() {
    if (TEST || !isStaff() || !settings.gasUrl || !navigator.onLine) return;
    UNITS.forEach(u => (state.records[u.id]?.photos || []).forEach(p => {
      if (p.st !== 'done') uploadPhoto(u.id, p.id);
    }));
  }

  // ── 全螢幕照片 ──
  const lb = { el: $('#lightbox'), img: $('#lbImg'), photos: [], i: 0, item: null, url: null };
  function openLightbox(itemId, i) {
    lb.item = itemById[itemId];
    lb.photos = state.records[itemId]?.photos || [];
    if (!lb.photos.length) return;
    lb.i = Math.max(0, Math.min(i, lb.photos.length - 1));
    lb.el.hidden = false;
    showLb();
  }
  async function showLb() {
    const p = lb.photos[lb.i], i = lb.i;
    lb.img.src = p.thumb;
    $('#lbCaption').textContent = `${lb.item.full}（${i + 1}/${lb.photos.length}）`;
    $('#lbPrev').hidden = $('#lbNext').hidden = lb.photos.length < 2;
    const dl = $('#lbDrive');
    dl.hidden = !p.url; if (p.url) dl.href = p.url;
    if (lb.url) { URL.revokeObjectURL(lb.url); lb.url = null; }
    let src = null;
    try { const b = await idb.get(p.id); if (b) src = lb.url = URL.createObjectURL(b); } catch { /* ignore */ }
    if (!src && p.driveId) src = `https://drive.google.com/thumbnail?id=${encodeURIComponent(p.driveId)}&sz=w2000`;
    if (src) {
      const im = new Image();
      im.onload = () => { if (lb.i === i && !lb.el.hidden) lb.img.src = src; };
      im.src = src;
    }
  }
  const lbStep = d => { lb.i = (lb.i + d + lb.photos.length) % lb.photos.length; showLb(); };
  function closeLb() { lb.el.hidden = true; if (lb.url) { URL.revokeObjectURL(lb.url); lb.url = null; } }
  $('#lbClose').addEventListener('click', closeLb);
  $('#lbPrev').addEventListener('click', e => { e.stopPropagation(); lbStep(-1); });
  $('#lbNext').addEventListener('click', e => { e.stopPropagation(); lbStep(1); });
  lb.el.addEventListener('click', e => { if (e.target === lb.el) closeLb(); });
  let tx0 = null;
  lb.el.addEventListener('touchstart', e => { tx0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  lb.el.addEventListener('touchend', e => {
    if (tx0 == null || lb.photos.length < 2) return;
    const dx = e.changedTouches[0].clientX - tx0;
    if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1);
    tx0 = null;
  });
  document.addEventListener('keydown', e => {
    if (!lb.el.hidden) {
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft') lbStep(-1);
      if (e.key === 'ArrowRight') lbStep(1);
    } else if (!sheet.hidden && e.key === 'Escape') closeSheet();
  });

  // ── 雲端（Google Apps Script）──
  async function testApi(action, payload) {
    await new Promise(r => setTimeout(r, 250));
    if (action === 'getStudents') return { ok: true, source: '商一甲名單（測試・去識別化）', className: '商一甲', students: DEMO_STUDENTS };
    if (action === 'getRoster') return { ok: true, roster: demoRoster() };
    if (action === 'saveRoster') {
      const r = payload.roster, old = demoRoster();
      const next = { jobs: r.jobs, inspectors: r.inspectors, outdoor: r.outdoor ? { ...old.outdoor, jobs: r.outdoor.jobs, inspectors: r.outdoor.inspectors } : old.outdoor };
      store.set(LS_DEMO_ROSTER, next);
      return { ok: true, roster: next };
    }
    if (action === 'setOutdoorSheet') throw new Error('測試模式不會連結外掃試算表');
    if (action === 'uploadPhoto') throw new Error('測試模式不會上傳照片');
    if (App.testSeatApi) {
      const r = await App.testSeatApi(action, payload);
      if (r) return r;
    }
    return { ok: true, sheetName: '（測試模式）', sheetUrl: '' };
  }
  async function api(action, payload = {}) {
    if (TEST) return testApi(action, payload);
    if (!settings.gasUrl) throw new Error('尚未設定雲端網址');
    const auth = /Login$/.test(action) ? {} : usesSid() ? { sid: settings.sid } : { token: settings.token };
    let res;
    try {
      res = await fetch(settings.gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 避免 CORS 預檢
        body: JSON.stringify({ action, ...auth, ...payload }),
      });
    } catch { throw new Error('連不上網路，請確認網路後再試'); }
    let j;
    try { j = await res.json(); } catch { throw new Error('雲端回應格式錯誤，請確認部署權限為「所有人」'); }
    if (!j.ok) {
      const err = new Error(/未知的動作/.test(j.error) ? '雲端程式還是舊版，請重新部署 Code.gs' : j.error || '雲端處理失敗');
      err.code = j.code;
      if (j.code === 'session' && usesSid()) relogin('登入已過期，請重新輸入身分證字號');
      if (j.code === 'token' && isTeacher() && action !== 'staffLogin') relogin('密碼已變更，請重新登入');
      throw err;
    }
    return j;
  }
  function relogin(msg) {
    settings.sid = ''; settings.token = '';
    saveSettings();
    try { sessionStorage.setItem('indoor.relogin', msg); } catch { /* ignore */ }
    location.reload();
  }

  function rowsFor(item) {
    const r = state.records[item.id];
    if (!r || !state.sessionId) return [];
    const photos = (r.photos || []).filter(p => p.url).map(p => p.url).join('\n');
    return item.owners.map(owner => ({
      key: `${state.sessionId}|${item.id}|${owner}`,
      session: state.sessionId,
      date: fmtDate(new Date(state.startedAt)),
      section: item.where,
      item: item.full,
      owner,
      status: r.status[owner] || '',
      issue: !!r.issue,
      // 分組：把有狀況的地方寫在說明前面，例如【花圃 2、花圃 4】
      note: (item.group && issueParts(item).length ? `【${issueParts(item).map(i => i.short ? i.name : i.title).join('、')}】` : '') + (r.note || ''),
      photos,
      inspector: settings.inspector || '',
      updatedAt: r.updatedAt,
    }));
  }

  function enqueue(rows) {
    rows.forEach(r => {
      const i = queue.findIndex(q => q.key === r.key);
      if (i >= 0) queue[i] = r; else queue.push(r);
    });
    store.set(LS.queue, queue);
    scheduleFlush();
    updateSync();
  }
  let flushTimer, flushing = false, syncError = null;
  function scheduleFlush(ms = 1500) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, ms); }
  async function flush() {
    if (flushing || !queue.length || !settings.gasUrl || !isStaff() || !navigator.onLine) { updateSync(); return; }
    flushing = true; updateSync();
    const batch = queue.slice(0, 60);
    try {
      await api('saveRecords', { rows: batch });
      const sent = new Map(batch.map(r => [r.key, r.updatedAt]));
      queue = queue.filter(q => sent.get(q.key) !== q.updatedAt);
      store.set(LS.queue, queue);
      syncError = null;
    } catch (err) {
      syncError = err.message;
    }
    flushing = false;
    updateSync();
    if (queue.length && !syncError) scheduleFlush(300);
  }
  function updateSync() {
    const dot = $('#syncDot');
    dot.className = 'sync-dot';
    if (!settings.gasUrl || TEST) return;
    if (flushing) dot.classList.add('busy');
    else if (syncError) dot.classList.add('err');
    else if (queue.length) dot.classList.add('pending');
    else dot.classList.add('ok');
  }
  $('#syncBtn').addEventListener('click', () => {
    if (TEST) return toast('測試模式：資料不會寫入雲端');
    if (!settings.gasUrl) return toast('尚未設定雲端，紀錄只存在這支手機。');
    if (isStudent()) return toast('已連線到雲端');
    if (syncError) toast('同步失敗：' + syncError + '（重試中）');
    else if (queue.length) toast(`還有 ${queue.length} 筆等待寫入試算表…`);
    else toast('✓ 所有紀錄都已寫入試算表');
    flush(); retryPhotos();
  });
  window.addEventListener('online', () => { flush(); retryPhotos(); });

  // ── 每 20 小時自動清空掃地紀錄 ──
  async function resetSession(auto) {
    flush();
    state = emptyState();
    save();
    try { await idb.clear(); } catch { /* ignore */ }
    if (sheetMode?.kind === 'item') closeSheet();
    closeLb();
    refresh();
    toast(auto ? '已超過 20 小時，紀錄已清空，開始新一輪檢查' : '已清空本次紀錄');
  }
  function checkExpiry() {
    if (state.startedAt && Date.now() - state.startedAt >= RESET_MS) resetSession(true);
    else updateResetInfo();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && isStaff()) { checkExpiry(); flush(); } });
  setInterval(() => { if (!isStaff()) return; checkExpiry(); if (syncError || queue.length) flush(); }, 60e3);

  // ── 今日值日生：大家都看得到；班長、副班長（和導師）可以登記 ──
  let duty = null;
  // 修改工作分配：導師、班長、副班長、環保股長（衛生股長）
  const canRoster = () => isTeacher() || (isCadre() && jobsOf(settings.me || '').roles.some(r => /^(副?班長|環保|衛生)/.test(r)));
  const canDuty = () => isTeacher() || jobsOf(settings.me || '').roles.some(r => /^副?班長$/.test(r));
  const shortName = k => parseKeyLite(k).name || k;
  function parseKeyLite(k) { const m = String(k || '').match(/^(\D*?)(\d+)(.*)$/); return m ? { name: m[3] } : { name: String(k || '') }; }
  // 科別：多→多媒科、料→資料科（其他就用名單上的字）
  const DEPT_NAME = { 多: '多媒', 料: '資料' };
  const deptOf = k => (String(k).match(/^\D*/) || [''])[0];
  const dutyDepts = () => {
    const ds = [...new Set(students().map(deptOf).filter(Boolean))];
    return ds.sort((a, b) => (a === '料' ? -1 : b === '料' ? 1 : a.localeCompare(b))); // 資料科在前
  };
  const hasDuty = () => duty && duty.date === fmtDate(new Date()) && duty.list?.length;
  function paintDuty() {
    const b = $('#dutyChip');
    const has = hasDuty();
    $('.duty-row').hidden = !has && !canDuty();
    if (has) {
      const by = {};
      duty.list.forEach(k => { (by[deptOf(k)] ||= []).push(shortName(k)); });
      b.textContent = '🧹 今日值日生｜' + Object.keys(by).sort((x, y) => (x === '料' ? -1 : y === '料' ? 1 : 0)).map(d => `${DEPT_NAME[d] || d}：${by[d].join('、')}`).join('　');
    } else b.textContent = '＋ 登記今日值日生';
    b.classList.toggle('empty', !has);
  }
  async function loadDuty() {
    if (!started) return;
    try { const r = await api('getDuty'); duty = r.duty; } catch { /* 讀不到就先不顯示 */ }
    paintDuty();
  }
  $('#dutyChip').addEventListener('click', () => {
    const has = hasDuty();
    if (!canDuty()) return toast(has ? `今日值日生：${duty.list.join('、')}` : '今天還沒有登記值日生');
    if (!students().length) { loadStudents().catch(() => {}); return toast('讀取名單中，請再按一次'); }
    const cur = has ? duty.list : [];
    let h = sheetHead('🧹 今日值日生', `${fmtDateW(new Date())}｜每科 2 位，班長、副班長登記`);
    dutyDepts().forEach(d => {
      const mine = students().filter(k => deptOf(k) === d);
      const picked = cur.filter(k => deptOf(k) === d);
      h += `<h3>${esc(DEPT_NAME[d] || d)}科</h3><div class="duty-pick">`;
      [0, 1].forEach(i => {
        h += `<select data-duty="${esc(d)}" aria-label="${esc(DEPT_NAME[d] || d)}科值日生 ${i + 1}"><option value="">— 值日生 ${i + 1} —</option>${mine.map(k => `<option value="${esc(k)}"${k === picked[i] ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select>`;
      });
      h += `</div>`;
    });
    h += `${has && duty.by ? `<p class="muted small">目前由 ${esc(duty.by)} 登記</p>` : ''}
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="dutyOk">儲存</button></div>`;
    openSheet({ kind: 'duty' }, h);
  });
  sheetHandlers.duty = async (act, b) => {
    if (act !== 'dutyOk') return;
    const list = [...document.querySelectorAll('[data-duty]')].map(s => s.value).filter(Boolean);
    if (!list.length) return toast('請選擇值日生');
    if (new Set(list).size !== list.length) return toast('同一個人不能選兩次');
    const missing = dutyDepts().filter(d => !list.some(k => deptOf(k) === d)).map(d => DEPT_NAME[d] || d);
    if (missing.length && !await ask(`${missing.join('、')}科還沒有選值日生，確定要儲存嗎？`, '儲存')) return;
    b.disabled = true;
    try { const r = await api('setDuty', { list }); duty = r.duty; closeSheet(); toast('✓ 今日值日生已更新'); } catch (err) { toast(err.message); b.disabled = false; }
    paintDuty();
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadDuty(); });
  setInterval(loadDuty, 5 * 60e3);

  // ── 報表 ──
  function buildReport() {
    const cnt = { '好': 0, '不好': 0, '未出席': 0 };
    const problems = new Map();
    const issues = [];
    const items = scopeUnits().filter(u => u.area === ui.area); // 報表只包含目前這一區（內掃區、外掃區分開傳）
    items.forEach(it => {
      const r = state.records[it.id];
      it.owners.forEach(o => {
        const st = r?.status[o];
        if (!st) return;
        cnt[st]++;
        if (st !== '好') {
          if (!problems.has(o)) problems.set(o, []);
          problems.get(o).push({ item: it, st });
        }
      });
      if (unitSummary(it).issue) {
        const where = it.group ? issueParts(it).map(i => i.short ? i.name : i.title).join('、') : '';
        issues.push({ item: it, where, note: r.note, photos: (r.photos || []).filter(p => p.url).map(p => p.url) });
      }
    });
    const checked = items.filter(it => ['good', 'bad', 'absent'].includes(unitSummary(it).st)).length;
    const d = state.startedAt ? new Date(state.startedAt) : new Date();
    const L = [];
    const areaName = ui.area === 'out' ? '外掃區' + (outZone() ? D.outdoor.zones[outZone()] : '') : '內掃區';
    L.push(`【${areaName}檢查】${fmtDateW(d)}`);
    L.push(`檢查 ${checked}/${items.length} 項｜好 ${cnt['好']}・不好 ${cnt['不好']}・未出席 ${cnt['未出席']}`);
    if (problems.size) {
      L.push('', '❌ 需要改進的同學：');
      problems.forEach((arr, o) => L.push(`・${o}：${arr.map(x => `${x.item.full}（${x.st}）`).join('、')}`));
    } else {
      L.push('', '✅ 今天大家都做得很好！');
    }
    if (issues.length) {
      L.push('', `⚠ 有狀況 ${issues.length} 處：`);
      issues.forEach(x => {
        L.push(`・${x.item.full}${x.where ? `【${x.where}】` : ''}（${x.item.owners.join('、')}）${x.note ? '：' + x.note.replace(/\s+/g, ' ') : ''}`);
        x.photos.forEach(u => L.push(`  照片 ${u}`));
      });
    }
    if (settings.inspector) L.push('', `檢查人：${settings.inspector}`);
    return { d, areaName, total: items.length, cnt, problems, issues, checked, message: L.join('\n') };
  }

  function openReport() {
    commitNote();
    const R = buildReport();
    let h = sheetHead(`${R.areaName}檢查報表`, fmtDateW(R.d));
    h += `<div class="tiles">
      <div class="tile good"><b>${R.cnt['好']}</b><span>好</span></div>
      <div class="tile bad"><b>${R.cnt['不好']}</b><span>不好</span></div>
      <div class="tile absent"><b>${R.cnt['未出席']}</b><span>未出席</span></div>
      <div class="tile issue"><b>${R.issues.length}</b><span>有狀況</span></div></div>`;
    h += `<p class="muted small" style="margin:4px 0 0">已檢查 ${R.checked} / ${R.total} 處</p>`;
    h += `<h3>需要改進的同學</h3>`;
    if (R.problems.size) {
      h += `<ul class="rlist">`;
      R.problems.forEach((arr, o) => {
        h += `<li><span class="who">${esc(o)}</span><div class="what">${arr.map(x =>
          `<button type="button" class="link-btn" data-act="goto" data-id="${x.item.id}">${esc(x.item.full)}</button><span class="tag ${ST_CLASS[x.st]}">${x.st}</span>`).join('<br>')}</div></li>`;
      });
      h += `</ul>`;
    } else h += `<p class="empty">沒有 👍</p>`;
    if (R.issues.length) {
      h += `<h3>有狀況的地方</h3><ul class="rlist">`;
      R.issues.forEach(x => {
        h += `<li><button type="button" class="link-btn" data-act="goto" data-id="${x.item.id}">${esc(x.item.full)}</button><span class="tag issue">!</span><div class="what">${esc(x.item.owners.join('、'))}${x.note ? '｜' + esc(x.note) : ''}</div></li>`;
      });
      h += `</ul>`;
    }
    h += `<h3>通知訊息（可修改）</h3><textarea id="msgText">${esc(R.message)}</textarea>`;
    h += `<div class="actions">
      <button type="button" class="btn btn--line wide" data-act="share"${TEST ? ' disabled' : ''}>${TEST ? '🧪 測試模式不能傳送 LINE 通知' : '傳送 LINE 通知'}</button>
      <button type="button" class="btn wide" data-act="copy">📋 複製訊息</button>
    </div>
    <p id="saveStatus" class="muted small">${TEST ? '測試模式：訊息只能預覽，不會送出，也不會寫入試算表。' : '按下「傳送 LINE 通知」時，會同時把「不好」的紀錄寫入 Google 試算表。'}</p>`;
    openSheet({ kind: 'report', R }, h);
    flush();
  }
  $('#compassBtn').addEventListener('click', openReport);

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch {
      const ta = document.createElement('textarea');
      ta.value = t; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    }
  }
  sheetHandlers.report = async (act, b) => {
    const R = sheetMode.R;
    const msg = $('#msgText')?.value || R.message;
    if (act === 'goto') {
      closeSheet();
      flashItems([b.dataset.id], 'clean');
      setTimeout(() => openItem(b.dataset.id), 450);
    } else if (act === 'share') {
      if (TEST) return toast('測試模式不能傳送 LINE 通知');
      const saving = saveReportToSheet();
      if (navigator.share) {
        navigator.share({ text: msg }).catch(e => { if (e.name !== 'AbortError') toast('無法分享：' + e.message); });
      } else if (await copyText(msg)) toast('已複製，請貼到 LINE 群組');
      await saving;
    } else if (act === 'copy') {
      toast(await copyText(msg) ? '已複製訊息' : '複製失敗，請手動選取');
    }
  };
  async function saveReportToSheet() {
    const st = $('#saveStatus');
    const say = t => { if (st) st.textContent = t; };
    if (!settings.gasUrl) { say('尚未設定雲端，沒有寫入試算表。'); return; }
    say('寫入 Google 試算表中…');
    try {
      UNITS.forEach(it => { if (state.records[it.id]) enqueue(rowsFor(it)); });
      clearTimeout(flushTimer);
      for (let n = 0; n < 20 && queue.length; n++) {
        if (flushing) { await new Promise(r => setTimeout(r, 300)); continue; }
        await flush();
        if (syncError) break;
      }
      if (queue.length) throw new Error(syncError || '仍有紀錄未寫入，請稍後再試');
      say('✓ 「不好」的紀錄都已寫入 Google 試算表');
    } catch (e) {
      say('✕ 寫入試算表失敗：' + e.message);
      toast('寫入試算表失敗：' + e.message);
    }
  }

  // ── 工作分配分頁：地圖＋清單 ──
  function renderJobs() {
    const root = $('#jobsList');
    let h = '';
    h += `<div class="jobs-head"><h2>工作分配</h2>${canRoster()
      ? `<button type="button" class="btn btn--primary" id="editRoster">✏️ 修改負責人員</button>`
      : `<span class="muted small">${isStudent() ? '點地圖可以看到負責的同學' : '只有導師、班長、副班長、環保股長可以修改'}</span>`}</div>`;
    // 導師：還沒有任何掃地工作的同學（外掃區連結後才算得準）
    if (canRoster() && students().length) {
      const free = students().filter(k => !jobsOf(k).jobs.length && k !== inspectorName('I1'));
      if (!roster?.outdoor) h += `<div class="banner warn"><div class="bn-sub">⚠ 外掃區還沒有連結，外掃的同學會顯示「沒有指定」。</div></div>`;
      else if (free.length) h += `<div class="banner warn"><div class="bn-main">還沒有掃地工作：${free.length} 人</div><div class="bn-sub">${free.map(esc).join('、')}</div></div>`;
    }
    // 清單預設收起來（點地圖就能看到負責的人）
    h += `<details class="jobs-fold"${ui.jobsOpen ? ' open' : ''}><summary>📋 全部工作與負責同學</summary>`;
    h += `<div class="job-card sup"><div class="jt">環保股長（監督各掃區掃地工作）</div><div class="jn">${nameChips([inspectorName('I1')])}</div></div>`;
    D.jobGroups.forEach(g => {
      h += `<h3>${esc(g.label)}</h3><div class="job-grid">`;
      g.jobs.forEach(id => {
        const j = jobById[id];
        h += `<button type="button" class="job-card" data-job="${id}"><span class="jt">${esc(j.title)}</span><span class="jn">${nameChips(jobOwners(id), j.fixed)}</span></button>`;
      });
      h += `</div>`;
    });
    h += `</details>`;
    // 外掃區：工作分配存在這個 App 的試算表（以這裡為主）
    const O = roster?.outdoor;
    h += `<details class="jobs-fold"${ui.outdoorOpen ? ' open' : ''} data-fold="outdoor"><summary>🌳 ${esc(D.outdoor.label)}工作分配</summary>`;
    if (O) {
      h += `<p class="muted small">${canRoster() ? '<b>點名字就可以換人</b>。' : ''}存在試算表的「外掃工作分配」工作表（以這個 App 為主）。</p>`;
      h += outdoorDiagram(O);
    } else if (isTeacher()) {
      h += `<p class="small">還沒有連結外掃區。貼上「外掃區檢查」App 使用的 Google 試算表網址，兩邊的工作分配就會同步。</p>
        <input type="url" id="outdoorUrl" placeholder="https://docs.google.com/spreadsheets/d/…" autocomplete="off">
        <div class="actions"><button type="button" class="btn btn--primary wide" id="outdoorLink">連結外掃區</button></div>`;
    } else {
      h += `<p class="muted small">導師還沒有連結外掃區。</p>`;
    }
    h += `</details>`;
    // 幹部名單：也預設收起來；幹部用自己的身分證字號登入，可以登記加扣分
    if (D.cadreSlots?.length) {
      h += `<details class="jobs-fold"${ui.cadreOpen ? ' open' : ''} data-fold="cadre"><summary>🎖 幹部名單</summary>
        <p class="muted small">幹部用自己的身分證字號登入（「老師／幹部」），可以對全班同學登記加扣分。</p>
        <div class="cadre-grid">`;
      if (roster?.cadres) {
        // 依職位分組：先照幹部順序（班長、副班長、風紀…），其他（小老師等）排在後面
        const byRole = {};
        Object.entries(roster.cadres).forEach(([k, roles]) => roles.forEach(r => { (byRole[r] ||= []).push(k); }));
        const order = ALL_SLOTS.map(s => (s.short === '環保' ? '衛生' : s.short || s.label));
        const rank = r => { const i = order.indexOf(r); return i < 0 ? 100 : i; };
        Object.keys(byRole).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).forEach(r => {
          h += `<div class="cadre-row"><span class="jt">${esc(r)}</span><span class="jn">${nameChips(byRole[r])}</span></div>`;
        });
      } else {
        ALL_SLOTS.forEach(s => {
          h += `<div class="cadre-row"><span class="jt">${esc(s.short || s.label)}</span><span class="jn">${nameChips([inspectorName(s.id)])}</span></div>`;
        });
      }
      h += `</div>${roster?.cadres ? `<p class="muted small">名單存在試算表「${esc(roster.cadreSource || '幹部名單')}」工作表。</p>` : ''}
        ${isTeacher() ? `<div class="actions"><button type="button" class="btn btn--primary wide" id="editCadres">✏️ 修改幹部名單</button></div>` : '<p class="muted small">只有導師可以修改幹部名單。</p>'}</details>`;
    }
    root.innerHTML = h;
    $('#editRoster')?.addEventListener('click', openRosterEditor);
    $('#editCadres')?.addEventListener('click', openCadreEditor);
    root.querySelectorAll('.jobs-fold').forEach(d => d.addEventListener('toggle', () => {
      ui[{ cadre: 'cadreOpen', outdoor: 'outdoorOpen' }[d.dataset.fold] || 'jobsOpen'] = d.open;
      saveUi();
    }));
    $('#outdoorLink')?.addEventListener('click', async e => {
      const url = $('#outdoorUrl').value.trim();
      if (!url) return toast('請貼上外掃區試算表的網址');
      e.target.disabled = true; e.target.textContent = '連結中…';
      try {
        const r = await api('setOutdoorSheet', { url });
        applyRoster(r.roster);
        renderJobs();
        toast(`✓ 已連結「${r.name}」，兩邊的工作分配會同步`);
      } catch (err) { toast(err.message); e.target.disabled = false; e.target.textContent = '連結外掃區'; }
    });
  }

  // ── 外掃區圖表（直式）：原圖順時針轉 90 度 ──
  // 上＝南、下＝北、右＝西側（警衛室）、左＝東側（司令台）。沿走廊方向 1:1，走廊寬度放大 OV.k 倍方便手指點。
  // mode：'jobs'＝工作分配（名牌在走廊兩側，導師點名字換人）／'check'＝掃地檢查（只有走廊，點了才看負責人）
  const OV = { k: 2.1, wallE: 185, wallY: 375, dy: 40, H: 1230, W: 575, cardW: 130, rightX: 445, gapY: 10 };
  const ovRect = ([x, y, w, h]) => [OV.wallE + (OV.wallY - (y + h)) * OV.k, x - OV.dy, h * OV.k, w];
  const ovMid = r => [r[0] + r[2] / 2, r[1] + r[3] / 2];
  // 名牌：放在工作物件那一側（原圖上方＝西側＝右邊），高度對齊物件，重疊就往下推
  function outdoorCards() {
    const cards = [];
    D.outdoor.jobs.forEach(j => {
      const its = OUT_ITEMS.filter(it => it.job === j.id);
      const main = its.filter(it => !it.floor && !it.strip);
      const h = j.slots > 1 ? 92 : 58;
      const side = main.length ? (main[0].hit[1] + main[0].hit[3] / 2 < 330 ? 'W' : 'E') : 'E';
      const cy = main.length ? main.reduce((t, it) => t + ovMid(ovRect(it.hit))[1], 0) / main.length : (its[0].zone === 'S' ? 520 : 1100);
      cards.push({ job: j, its, side, y: cy - h / 2, h });
    });
    D.outdoor.inspectors.forEach(p => cards.push({ insp: p, its: [], side: p.zone === 'S' ? 'E' : 'W', y: p.zone === 'S' ? 20 : 590, h: 58 }));
    ['E', 'W'].forEach(sd => {
      let bottom = -Infinity;
      cards.filter(c => c.side === sd).sort((a, b) => a.y - b.y).forEach(c => { if (c.y < bottom + OV.gapY) c.y = bottom + OV.gapY; bottom = c.y + c.h; });
    });
    cards.forEach(c => { c.x = c.side === 'E' ? 0 : OV.rightX; c.w = OV.cardW; });
    return cards;
  }
  function outdoorDiagram(O, mode = 'jobs') {
    const G = D.outdoor, check = mode === 'check';
    // 檢查時只看走廊（畫面比較大）；工作分配時連兩側名牌一起
    const vx = check ? 95 : 0, vw = check ? 375 : OV.W, H = OV.H;
    const pct = (v, t) => (v / t * 100).toFixed(3) + '%';
    const R = (r, attrs) => { const [x, y, w, h] = ovRect(r); return `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" ${attrs}/>`; };
    let s = `<svg class="od-svg" viewBox="${vx} 0 ${vw} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><marker id="odArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1 L8 5 L1 9" fill="none" stroke="#aab4bd" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
      ${R([74, 287, 574, 85], 'fill="#f7dcdc" stroke="#333" stroke-width="1"')}${R([648, 287, 575, 85], 'fill="#daefe1" stroke="#333" stroke-width="1"')}
      ${R([74, 280, 1151, 7], 'fill="#8b5cf6"')}${R([74, 369, 1151, 6], 'fill="#8b5cf6"')}
      <text x="285" y="22" class="od-dir" text-anchor="middle">▲ 南</text><text x="285" y="1222" class="od-dir" text-anchor="middle">▼ 北</text>
      <text x="${check ? 440 : 480}" y="1165" class="od-lm" text-anchor="middle">警衛室</text><text x="140" y="614" class="od-lm" text-anchor="middle">司令台</text>
      <text x="${check ? 110 : 150}" y="60" class="od-side" text-anchor="middle">東側</text><text x="${check ? 455 : 420}" y="60" class="od-side" text-anchor="middle">西側</text>`;
    G.shapes.forEach(x => {
      const [rx, ry, rw, rh] = ovRect([x.x, x.y, x.w, x.h]);
      if (x.t === 'glass' || x.t === 'glass2') {
        s += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="#bdbcc2" stroke="#6b6a72" stroke-width="1"/>`;
        for (let gy = ry + 14.5; gy < ry + rh - 2; gy += 14.5) s += `<line x1="${rx}" y1="${gy}" x2="${rx + rw}" y2="${gy}" stroke="#6b6a72" stroke-width="1"/>`;
        if (x.t === 'glass2') s += `<line x1="${rx + rw / 2}" y1="${ry}" x2="${rx + rw / 2}" y2="${ry + rh}" stroke="#6b6a72" stroke-width="1"/>`;
      } else if (x.t === 'fountain') {
        s += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="#6ec3e0" stroke="#333" stroke-width="1"/><line x1="${rx}" y1="${ry + rh / 2}" x2="${rx + rw}" y2="${ry + rh / 2}" stroke="#333" stroke-width="1"/>`;
      } else if (x.t === 'sink') {
        s += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="#2aa05a" stroke="#333" stroke-width="1"/>`;
      }
    });
    s += `<line x1="${OV.wallE}" y1="608" x2="${OV.wallE + 95 * OV.k}" y2="608" stroke="rgba(0,0,0,.3)" stroke-width="2" stroke-dasharray="8 6"/>`;
    const cards = check ? [] : outdoorCards();
    // 箭頭：名牌 → 物件（地板、水泥平台直接水平指過去）
    cards.forEach(c => c.its.forEach(it => {
      const r = ovRect(it.hit), E = c.side === 'E';
      const ex = E ? c.x + c.w : c.x, cy = c.y + c.h / 2;
      const tx = E ? r[0] : r[0] + r[2];
      const pts = (it.floor || it.strip) ? [[ex, cy], [tx, cy]]
        : [[ex, cy], [ex + (E ? 16 : -16), cy], [ex + (E ? 16 : -16), ovMid(r)[1]], [tx, ovMid(r)[1]]];
      s += `<polyline points="${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#aab4bd" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" marker-end="url(#odArrow)"/>`;
    }));
    s += `</svg>`;
    const edit = !check && canRoster();
    const nameBtn = (key, name, sub) => `<button type="button" class="od-nm${name ? '' : ' empty'}${name && name === settings.me ? ' me' : ''}"${edit ? ` data-od="${key}"` : ' tabindex="-1"'}><b>${esc(name || '未設定')}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
    const box = ([x, y, w, h]) => `left:${pct(x - vx, vw)};top:${pct(y, H)};width:${pct(w, vw)};height:${pct(h, H)}`;
    let c = '';
    if (check) {
      OUT_ITEMS.forEach(it => {
        const r = ovRect(it.hit);
        const lbl = it.floor ? `🧹 ${it.title}` : it.strip ? `${it.name}${it.no}` : `${it.name.replace('公佈欄', '')}${it.no}`;
        c += `<button type="button" class="it oit${it.floor ? ' ofloor' : ''}${it.strip ? ' ostrip' : ''}" data-id="${it.id}" aria-label="${esc(it.full)}" style="${box(r)}">`
          + `<span class="olbl${r[3] > r[2] * 1.2 ? ' v' : ''}">${esc(lbl)}</span><span class="badge"></span><span class="mk"></span></button>`;
      });
    }
    cards.forEach(cd => {
      const r = [cd.x, cd.y, cd.w, cd.h];
      if (cd.insp) {
        c += `<div class="od-card zone-${cd.insp.zone} sup" style="${box(r)}"><span class="od-role">${esc(cd.insp.label)}</span>${nameBtn(cd.insp.id, O.inspectors[cd.insp.id], '')}</div>`;
        return;
      }
      const j = cd.job, names = O.jobs[j.id] || [];
      c += `<div class="od-card zone-${j.zone}${j.slots > 1 ? ' two' : ''}" style="${box(r)}" title="${esc(outdoorTitle(j.id))}">`;
      for (let i = 0; i < j.slots; i++) c += nameBtn(`${j.id}:${i}`, names[i], i === j.slots - 1 ? j.short : '');
      c += `</div>`;
    });
    return `<div class="od-wrap"><div class="od${edit ? ' editable' : ''}${check ? ' checking' : ''}" style="aspect-ratio:${vw}/${H}">${s}${c}</div></div>`;
  }
  $('#jobsList').addEventListener('click', e => {
    const b = e.target.closest('[data-od]');
    if (b && canRoster()) openOutdoorSlot(b.dataset.od);
  });

  // 名單中已經有工作的人（室內＋外掃，含環保股長），選人時自動排除
  function assignedNames() {
    const O = roster?.outdoor;
    return new Set([
      ...D.jobs.filter(j => !j.fixed).flatMap(j => roster?.jobs?.[j.id] || []),
      ...D.inspectorSlots.map(s => inspectorName(s.id)),
      ...(O ? Object.values(O.jobs).flat() : []),
      ...(O ? Object.values(O.inspectors) : []),
    ].filter(Boolean));
  }
  function rosterPayload(outdoor) {
    const r = { jobs: {}, inspectors: {}, labels: {} };
    D.jobs.forEach(j => { if (!j.fixed) { r.labels[j.id] = j.title; r.jobs[j.id] = [...(roster?.jobs?.[j.id] || [])]; } });
    r.labels.CLASS = '班級';
    r.jobs.CLASS = [className() || studentList?.className || ''];
    ALL_SLOTS.forEach(s => { r.labels[s.id] = s.label; r.inspectors[s.id] = inspectorName(s.id); });
    if (outdoor) r.outdoor = outdoor;
    return r;
  }
  async function openOutdoorSlot(key) {
    if (!students().length) { try { await loadStudents(); } catch (e) { return toast('無法讀取名單：' + e.message); } }
    const O = roster.outdoor;
    const [id, i] = key.split(':');
    const isInsp = i == null;
    const cur = isInsp ? O.inspectors[id] || '' : (O.jobs[id] || [])[+i] || '';
    const title = isInsp ? D.outdoor.inspectors.find(p => p.id === id).label : outdoorTitle(id);
    const taken = assignedNames();
    let h = sheetHead(esc(title), '外掃區工作分配');
    h += `<div class="field"><label for="odSel">負責同學</label><select id="odSel"><option value="">— 未設定 —</option>`;
    students().forEach(n => { if (n === cur || !taken.has(n)) h += `<option value="${esc(n)}"${n === cur ? ' selected' : ''}>${esc(n)}</option>`; });
    h += `</select><p class="muted small">已經有室內或外掃工作的同學不會出現在選單裡。</p></div>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="odSave">儲存（外掃 App 也會同步）</button></div>`;
    openSheet({ kind: 'odslot', id, i }, h);
  }
  sheetHandlers.odslot = async (act, b) => {
    if (act !== 'odSave') return;
    const { id, i } = sheetMode;
    const O = JSON.parse(JSON.stringify(roster.outdoor));
    const v = $('#odSel').value;
    if (i == null) O.inspectors[id] = v;
    else {
      const j = D.outdoor.jobs.find(x => x.id === id);
      const arr = Array.from({ length: j.slots }, (_, k) => (O.jobs[id] || [])[k] || '');
      arr[+i] = v;
      O.jobs[id] = arr;
    }
    // 新增的列才需要工作名稱；已經存在的列會保留外掃 App 原本的名稱
    O.labels = Object.fromEntries([...D.outdoor.jobs.map(j => [j.id, outdoorTitle(j.id)]), ...D.outdoor.inspectors.map(p => [p.id, O.labels?.[p.id] || p.label])]);
    b.disabled = true; b.textContent = '儲存中…';
    try {
      const res = await api('saveRoster', { roster: rosterPayload({ jobs: O.jobs, inspectors: O.inspectors, labels: O.labels }) });
      applyRoster(res.roster);
      renderJobs();
      closeSheet();
      toast('✓ 已儲存，外掃 App 會同步更新');
    } catch (e) { toast('儲存失敗：' + e.message); b.disabled = false; b.textContent = '儲存（外掃 App 也會同步）'; }
  };

  // ── 幹部名單（試算表模式）：一列一個「職位＋同學」，存回「學生/幹部名單」的職位欄 ──
  const CADRE_ORDER = ['班長', '副班長', '風紀', '衛生', '學藝', '總務', '資訊', '節能', '體育'];
  async function openSheetCadreEditor() {
    if (!students().length) { try { await loadStudents(); } catch (e) { return toast('無法讀取名單：' + e.message); } }
    const pairs = [];
    Object.entries(roster.cadres || {}).forEach(([k, roles]) => roles.forEach(r => pairs.push([r, k])));
    const rank = r => { const i = CADRE_ORDER.findIndex(x => r.startsWith(x)); return i < 0 ? 100 : i; };
    pairs.sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    const roleList = [...new Set([...CADRE_ORDER, ...pairs.map(p => p[0])])];
    let h = sheetHead('🎖 修改幹部名單', '一列一個職位；同一人可以兼好幾個職位');
    h += `<datalist id="cadreRoles">${roleList.map(r => `<option value="${esc(r)}">`).join('')}</datalist><div id="cadreRows">${pairs.map(p => cadreRowHtml(p[0], p[1])).join('')}</div>
      <div class="actions"><button type="button" class="btn wide" data-act="cadreAdd">＋ 新增一列</button></div>
      <p class="muted small">儲存後會寫回試算表「${esc(roster.cadreSource || '學生/幹部名單')}」的職位欄（身分證字號等其他欄位不會動）。</p>
      <div class="save-bar"><button type="button" class="btn btn--primary" data-act="cadreSave">儲存</button></div>`;
    openSheet({ kind: 'sheetCadres' }, h);
  }
  const cadreRowHtml = (role = '', k = '') => `<div class="cadre-edit"><input type="text" list="cadreRoles" value="${esc(role)}" placeholder="職位" maxlength="12" aria-label="職位">
    <select aria-label="同學"><option value="">— 同學 —</option>${students().map(s => `<option value="${esc(s)}"${s === k ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
    <button type="button" class="btn" data-act="cadreDel" aria-label="刪除這一列">✕</button></div>`;
  sheetHandlers.sheetCadres = async (act, b) => {
    if (act === 'cadreAdd') { $('#cadreRows').insertAdjacentHTML('beforeend', cadreRowHtml()); $('#cadreRows').lastElementChild.querySelector('input').focus(); return; }
    if (act === 'cadreDel') { b.closest('.cadre-edit').remove(); return; }
    if (act !== 'cadreSave') return;
    const pairs = [...document.querySelectorAll('#cadreRows .cadre-edit')].map(r => [r.querySelector('select').value, r.querySelector('input').value.trim()]).filter(p => p[0] && p[1]);
    if (!await ask(`儲存幹部名單（共 ${pairs.length} 個職位）？\n會寫回試算表。`, '儲存')) return;
    b.disabled = true; b.textContent = '儲存中…';
    try {
      const r = await api('saveCadres', { pairs });
      applyRoster(r.roster); renderJobs(); closeSheet();
      toast('✓ 幹部名單已更新');
    } catch (err) { toast('儲存失敗：' + err.message); b.disabled = false; b.textContent = '儲存'; }
  };

  // ── 幹部名單編輯（同一人可以兼任）──
  async function openCadreEditor() {
    if (!isTeacher()) return;
    if (cadresFromSheet()) return openSheetCadreEditor();
    if (!students().length) {
      openSheet({ kind: 'cadres' }, sheetHead('修改幹部名單') + '<p class="muted">讀取學生名單中…</p>');
      try { await loadStudents(); } catch (e) { sheetBody.innerHTML = sheetHead('修改幹部名單') + `<p class="lock-msg">無法讀取名單：${esc(e.message)}</p>`; return; }
    }
    const byCode = Object.fromEntries(students().map(k => [(k.match(/^(\D*?)(\d+)/) || []).slice(1).map((x, i) => (i ? pad2(+x) : x)).join(''), k]));
    const anySet = ALL_SLOTS.some(s => inspectorName(s.id));
    let h = sheetHead('修改幹部名單', anySet ? '' : '還沒有設定過，先帶入預設名單');
    h += `<div class="rs-selects two">`;
    ALL_SLOTS.forEach(s => {
      const cur = inspectorName(s.id) || (!anySet && s.def ? byCode[s.def] || '' : '');
      h += `<label class="rs-cadre"><span class="rs-label">${esc(s.short || s.label)}</span><select data-cadre="${s.id}"><option value="">— 沒有 —</option>${students().map(n => `<option value="${esc(n)}"${n === cur ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
    });
    h += `</div><div class="actions"><button type="button" class="btn wide" data-act="cadreDefault">↺ 恢復預設幹部名單</button></div>`;
    h += `<div class="save-bar"><button type="button" class="btn btn--primary" data-act="cadreSave">${TEST ? '儲存（測試模式只存在這台裝置）' : '儲存到雲端'}</button></div>`;
    openSheet({ kind: 'cadres', byCode }, h);
  }
  sheetHandlers.cadres = async (act, b) => {
    if (act === 'cadreDefault') {
      const { byCode } = sheetMode;
      ALL_SLOTS.forEach(s => { const el = sheetBody.querySelector(`[data-cadre="${s.id}"]`); if (el) el.value = (s.def && byCode[s.def]) || ''; });
      return toast('已帶入預設名單，記得按「儲存到雲端」');
    }
    if (act !== 'cadreSave') return;
    const r = { jobs: {}, inspectors: {}, labels: {} };
    D.jobs.forEach(j => { if (!j.fixed) { r.labels[j.id] = j.title; r.jobs[j.id] = [...(roster?.jobs?.[j.id] || [])]; } });
    r.labels.CLASS = '班級';
    r.jobs.CLASS = [className() || studentList?.className || ''];
    ALL_SLOTS.forEach(s => { r.labels[s.id] = s.label; r.inspectors[s.id] = sheetBody.querySelector(`[data-cadre="${s.id}"]`)?.value || ''; });
    b.disabled = true; b.textContent = '儲存中…';
    try {
      const res = await api('saveRoster', { roster: r });
      applyRoster(res.roster);
      renderMap('clean'); renderJobs();
      toast('✓ 幹部名單已儲存');
      closeSheet();
    } catch (e) {
      toast('儲存失敗：' + e.message);
      b.disabled = false; b.textContent = '儲存到雲端';
    }
  };
  function nameChips(names, fixed) {
    const list = names.filter(Boolean);
    if (!list.length) return `<span class="nm empty">未設定</span>`;
    return list.map(n => `<span class="nm${fixed ? ' fixed' : ''}${n === settings.me ? ' me' : ''}">${esc(n)}</span>`).join('');
  }
  $('#jobsList').addEventListener('click', e => {
    const c = e.target.closest('[data-job]');
    if (!c) return;
    const ids = jobItems(c.dataset.job).map(it => it.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => flashItems(ids, 'jobs'), 250);
  });
  function onJobsMapClick(e) {
    const o = e.target.closest('[data-id]');
    if (!o) return;
    const it = itemById[o.dataset.id], j = jobById[it.job];
    const same = jobItems(it.job).filter(x => x !== it).map(x => x.full);
    let h = sheetHead(esc(it.full), '工作分配');
    h += `<div class="job-card big"><div class="jt">${esc(j.title)}</div><div class="jn">${nameChips(jobOwners(it.job), j.fixed)}</div></div>`;
    if (same.length) h += `<p class="muted small">同一個工作還包括：${esc(same.join('、'))}</p>`;
    openSheet({ kind: 'jobinfo' }, h);
  }

  // ── 設定 ──
  function openSettings() {
    let h = sheetHead('設定', `使用人：${esc(isStudent() ? settings.me : settings.inspector || '未選擇')}`);
    if (isStaff()) {
      if (canRoster()) h += `<div class="actions"><button type="button" class="btn btn--primary wide" data-act="roster">👥 修改負責人員（工作分配、幹部）</button></div>`;
      if (TEST) h += `<div class="actions"><button type="button" class="btn wide" data-act="who">👤 切換使用人（測試模式）</button></div>`;
      h += `<h3>本次掃地檢查紀錄</h3><p class="muted small" style="margin:0">${state.startedAt
        ? `開始於 ${fmtDateW(new Date(state.startedAt))} ${fmtTime(new Date(state.startedAt))}，將於 ${Math.round(RESET_MS / 3600e3)} 小時後自動清空。`
        : '尚未開始。第一次標記時開始計時。'}<br>等待寫入試算表：${queue.length} 筆</p>`;
      h += `<div class="actions"><button type="button" class="btn btn--danger wide" data-act="reset">立即清空本次紀錄</button></div>`;
    }
    h += `<h3>登入</h3><p class="muted small" style="margin:0">${usesSid() ? '借別人的手機登入時，用完請一定要登出。登入後 30 天內不用再輸入身分證字號。' : '這支手機已記住密碼。借別人用或換手機時可以登出。'}</p>`;
    h += `<div class="actions"><button type="button" class="btn wide" data-act="lock">🔒 登出</button></div>`;
    if (isStaff()) {
      h += `<details class="field"><summary class="muted small">進階：雲端網址</summary>
        <input type="url" id="setUrl" value="${esc(settings.gasUrl)}" autocomplete="off" style="margin-top:8px">
        <div class="actions"><button type="button" class="btn wide" data-act="ping">🔌 測試雲端連線</button></div>
        <p id="pingResult" class="muted small"></p></details>`;
    }
    openSheet({ kind: 'settings' }, h);
  }
  $('#settingsBtn').addEventListener('click', openSettings);
  sheetHandlers.settings = async act => {
    if (act === 'ping') {
      settings.gasUrl = $('#setUrl').value.trim() || CFG.gasUrl || '';
      saveSettings();
      const out = $('#pingResult');
      out.textContent = '連線中…';
      try {
        const r = await api('ping');
        out.innerHTML = r.sheetUrl ? `✓ 連線成功：<a href="${esc(r.sheetUrl)}" target="_blank" rel="noopener">${esc(r.sheetName)}</a>` : `✓ ${esc(r.sheetName)}`;
        flush(); retryPhotos();
      } catch (e) { out.textContent = '✕ ' + e.message; }
      updateSync();
    } else if (act === 'roster') {
      openRosterEditor();
    } else if (act === 'who') {
      openWho();
    } else if (act === 'lock') {
      logout();
    } else if (act === 'reset') {
      const pendingPhotos = UNITS.reduce((n, it) => n + (state.records[it.id]?.photos || []).filter(p => p.st !== 'done').length, 0);
      const warn = pendingPhotos ? `\n\n⚠ 還有 ${pendingPhotos} 張照片沒有上傳到雲端，清空後會遺失。` : '';
      if (await ask('確定要清空本次所有紀錄嗎？（已寫入試算表的資料不受影響）' + warn, '清空', true)) resetSession(false);
    }
  };
  function logout() {
    settings.token = ''; settings.inspector = ''; settings.role = ''; settings.sid = ''; settings.me = '';
    saveSettings();
    location.reload();
  }

  // ── 切換使用人 ──
  const whoOptions = cur => userList().map(o => `<option value="${esc(o.value)}"${o.value === cur ? ' selected' : ''}>${esc(o.text)}</option>`).join('');
  function openWho() {
    let h = sheetHead('使用人是誰？');
    h += `<select id="whoSheetSel" aria-label="使用人">${whoOptions(settings.inspector)}</select>`;
    h += `<div class="actions"><button type="button" class="btn btn--primary wide" data-act="whoOk">確定</button></div>`;
    openSheet({ kind: 'who' }, h);
  }
  sheetHandlers.who = act => {
    if (act !== 'whoOk') return;
    setUser($('#whoSheetSel').value);
    closeSheet();
    toast('使用人：' + settings.inspector);
    location.reload(); // 權限（導師／股長）不同，重新整理最單純
  };
  // 只有測試模式可以直接選使用人；正式使用時幹部要用自己的身分證字號登入
  function setUser(name) {
    if (name === D.teacherLabel) Object.assign(settings, { role: 'staff', inspector: name, me: '', sid: '' });
    else Object.assign(settings, { role: 'cadre', inspector: name, me: name, sid: 'test' });
    saveSettings();
  }
  $('#userChip').addEventListener('click', () => (TEST && isStaff() ? openWho() : openSettings()));

  // ── 學生名單（雲端硬碟裡的名單試算表）──
  let studentList = store.get(LS.students, null); // { source, className, students }
  let studentsLoading = null;
  function loadStudents() {
    return studentsLoading ||= api('getStudents').then(r => {
      const next = { source: r.source, className: r.className || '', students: r.students };
      const changed = JSON.stringify(next) !== JSON.stringify(studentList);
      studentList = next;
      store.set(LS.students, studentList);
      if (changed) App.emit('students');
      return changed;
    }).finally(() => { studentsLoading = null; });
  }
  const students = () => studentList?.students || [];

  // ── 修改負責人員：下拉選單，已選的人會從其他選單中剔除 ──
  let rosterClass = '';
  const rosterHead = extra => sheetHead('修改負責人員', extra || '');
  async function openRosterEditor() {
    if (!canRoster()) return toast('只有導師、班長、副班長、環保股長可以修改負責人員');
    if (studentList) {
      renderRosterEditor();
      loadStudents().then(changed => {
        if (!changed || sheetMode?.kind !== 'roster') return;
        renderRosterOptions();
        const eb = sheetBody.querySelector('.eyebrow');
        if (eb) eb.textContent = `名單來源：${studentList.source}（${students().length} 人）`;
        toast('學生名單已更新');
      }).catch(() => { /* 用手機上的名單即可 */ });
      return;
    }
    openSheet({ kind: 'roster' }, rosterHead() + `<p class="muted">第一次讀取雲端硬碟裡的學生名單中…<br>Google 雲端久未使用時需要 10–30 秒，請稍候。之後就會很快。</p>`);
    try {
      await loadStudents();
    } catch (e) {
      if (sheetMode?.kind === 'roster') sheetBody.innerHTML = rosterHead() + `<p class="lock-msg">無法讀取名單：${esc(e.message)}</p>`;
      return;
    }
    if (sheetMode?.kind === 'roster') renderRosterEditor();
  }
  function renderRosterEditor() {
    rosterClass = studentList.className || String(studentList.source).replace(/名單.*$/, '').trim();
    if (sheetMode?.kind !== 'roster') openSheet({ kind: 'roster' }, '');
    // grp：同一組裡選過的人會從其他選單移除（幹部另外一組，因為幹部也有掃地工作）
    const sel = (key, val, grp = 'job') => `<select data-rs="${key}" data-grp="${grp}" data-val="${esc(val || '')}" aria-label="選擇同學"></select>`;
    let h = rosterHead(`名單來源：${esc(studentList.source)}（${students().length} 人）`);
    h += `<p class="muted small" style="margin:0">每選一位同學，他就會從其他選單中移除。</p>`;
    if (!cadresFromSheet() && isTeacher()) h += `<h3>環保股長</h3>`;
    if (!cadresFromSheet() && isTeacher()) D.inspectorSlots.forEach(s => {
      h += `<div class="rs-row"><div class="rs-label">${esc(s.label)}</div><div class="rs-selects">${sel(s.id, inspectorName(s.id))}</div></div>`;
    });
    D.jobGroups.forEach(g => {
      h += `<h3>${esc(g.label)}</h3>`;
      g.jobs.forEach(id => {
        const j = jobById[id];
        const cur = roster?.jobs?.[id] || [];
        h += `<div class="rs-row"><div class="rs-label">${esc(j.title)}</div>`;
        if (j.fixed) h += `<div class="muted small">${esc(j.fixed.join('、'))}（固定，不用選）</div></div>`;
        else {
          h += `<div class="rs-selects${j.slots > 1 ? ' two' : ''}">`;
          for (let i = 0; i < j.slots; i++) h += sel(`${id}:${i}`, cur[i]);
          h += `</div></div>`;
        }
      });
    });
    if (D.cadreSlots?.length && !cadresFromSheet() && isTeacher()) {
      h += `<h3>幹部（可以登入登記加扣分）</h3><div class="rs-selects two">`;
      // 同一人可以兼任（例如學藝兼節能），所以幹部選單不互相移除
      D.cadreSlots.forEach(s => { h += `<label class="rs-cadre"><span class="rs-label">${esc(s.label)}</span>${sel(s.id, inspectorName(s.id), 'c-' + s.id)}</label>`; });
      h += `</div>`;
    }
    h += `<div class="save-bar"><button type="button" class="btn btn--primary" data-act="rosterSave">${TEST ? '儲存（測試模式只存在這台裝置）' : '儲存到雲端'}</button></div>`;
    sheetBody.innerHTML = h;
    renderRosterOptions();
  }
  function renderRosterOptions() {
    const sels = [...sheetBody.querySelectorAll('select[data-rs]')];
    sels.forEach(s => {
      const own = s.dataset.val;
      const taken = new Set(sels.filter(x => x.dataset.grp === s.dataset.grp).map(x => x.dataset.val).filter(Boolean));
      // 已經有外掃工作的人也排除
      const O = roster?.outdoor;
      if (s.dataset.grp === 'job' && O) [...Object.values(O.jobs).flat(), ...Object.values(O.inspectors)].forEach(n => n && taken.add(n));
      let o = `<option value="">— 請選擇 —</option>`;
      if (own && !students().includes(own)) o += `<option value="${esc(own)}" selected>${esc(own)}（不在名單中）</option>`;
      students().forEach(n => {
        if (taken.has(n) && n !== own) return;
        o += `<option value="${esc(n)}"${n === own ? ' selected' : ''}>${esc(n)}</option>`;
      });
      s.innerHTML = o;
    });
  }
  changeHandlers.roster = e => {
    const s = e.target.closest('select[data-rs]');
    if (!s) return;
    s.dataset.val = s.value;
    renderRosterOptions();
  };
  sheetHandlers.roster = async (act, b) => {
    if (act !== 'rosterSave') return;
    const r = { jobs: {}, inspectors: {}, labels: {} };
    ALL_SLOTS.forEach(s => { r.labels[s.id] = s.label; r.inspectors[s.id] = ''; });
    D.jobs.forEach(j => { if (!j.fixed) { r.labels[j.id] = j.title; r.jobs[j.id] = Array(j.slots).fill(''); } });
    r.labels.CLASS = '班級';
    r.jobs.CLASS = [rosterClass || className()];
    const sels = [...sheetBody.querySelectorAll('select[data-rs]')];
    sels.forEach(s => {
      const [id, i] = s.dataset.rs.split(':');
      if (i == null) r.inspectors[id] = s.value;
      else r.jobs[id][+i] = s.value;
    });
    const empty = sels.filter(s => !s.value).length;
    if (empty && !await ask(`還有 ${empty} 個空位沒有選人，確定要儲存嗎？`, '儲存')) return;
    b.disabled = true; b.textContent = '儲存中…';
    try {
      const res = await api('saveRoster', { roster: r });
      applyRoster(res.roster);
      renderMap('clean'); renderJobs();
      toast('✓ 負責人員已儲存');
      closeSheet();
    } catch (e) {
      toast('儲存失敗：' + e.message);
      b.disabled = false; b.textContent = '儲存到雲端';
    }
  };

  // ── 自動更新：切回 App 或每 10 分鐘檢查 GitHub 上的檔案有沒有變 ──
  const WATCH = ['index.html', 'sw.js','config.js', 'js/map-data.js', 'js/sel-engine.js', 'js/app.js', 'js/seats.js', 'js/points.js', 'js/draw.js', 'js/shop.js', 'js/line.js', 'css/style.css'];
  async function fingerprint() {
    try {
      const tags = await Promise.all(WATCH.map(async u => {
        const r = await fetch(u, { method: 'HEAD', cache: 'no-store' });
        if (!r.ok) throw new Error(r.status);
        return r.headers.get('etag') || r.headers.get('last-modified') || '';
      }));
      return tags.join('|');
    } catch { return null; }
  }
  let fp0 = null, lastCheck = 0;
  fingerprint().then(f => { fp0 = f; lastCheck = Date.now(); });
  async function checkUpdate() {
    if (!fp0 || !navigator.onLine || Date.now() - lastCheck < 30e3) return;
    lastCheck = Date.now();
    const f = await fingerprint();
    if (!f || f === fp0) return;
    if (!sheet.hidden || !lb.el.hidden || App.busy?.()) return; // 正在操作時先不打斷
    commitNote();
    try { sessionStorage.setItem('indoor.updated', '1'); } catch { /* ignore */ }
    location.reload();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
  window.addEventListener('pageshow', e => { if (e.persisted) checkUpdate(); });
  setInterval(() => { if (!document.hidden && Date.now() - lastCheck > 10 * 60e3) checkUpdate(); }, 60e3);

  // ── 人員設定同步：導師儲存後，其他手機切回 App 或每 2 分鐘自動更新 ──
  let rosterSyncing = false, lastRosterSync = 0;
  async function syncRoster(announce) {
    if (rosterSyncing || !navigator.onLine || !started) return;
    rosterSyncing = true; lastRosterSync = Date.now();
    try {
      const r = await api('getRoster');
      if (applyRoster(r.roster)) {
        renderMap('clean'); renderJobs();
        if (sheetMode?.kind === 'item') rerenderItem(sheetMode.id);
        if (announce) toast('工作分配已更新');
        if (isCadre() && !TEST && !canPoints() && !canCheckOut()) {
          relogin('你已經不在幹部名單中，請用「學生選位」登入');
        }
      }
    } catch { /* 下次再試 */ } finally { rosterSyncing = false; }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && started) syncRoster(true); });
  setInterval(() => { if (!document.hidden && started && Date.now() - lastRosterSync > 2 * 60e3) syncRoster(true); }, 30e3);

  // ── 確認視窗（不用瀏覽器的 confirm()：有些 App 內建瀏覽器會擋掉）──
  let askResolve = null;
  function ask(msg, yes = '確定', danger = false) {
    if (askResolve) askResolve(false);
    $('#askMsg').textContent = msg;
    const y = $('#askYes');
    y.textContent = yes;
    y.className = 'btn ' + (danger ? 'btn--dangerfill' : 'btn--primary');
    $('#ask').hidden = false;
    setTimeout(() => y.focus(), 30);
    return new Promise(res => { askResolve = res; });
  }
  function askDone(v) { $('#ask').hidden = true; const r = askResolve; askResolve = null; r?.(v); }
  $('#askYes').addEventListener('click', () => askDone(true));
  $('#askNo').addEventListener('click', () => askDone(false));
  $('#ask').addEventListener('click', e => { if (e.target.id === 'ask') askDone(false); });
  document.addEventListener('keydown', e => { if (!$('#ask').hidden && e.key === 'Escape') { e.stopPropagation(); askDone(false); } }, true);

  // ── Toast ──
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ── 登入：老師／幹部用密碼；學生用身分證字號（選位）──
  let started = false;
  function start() {
    document.body.classList.remove('locked');
    document.body.classList.toggle('role-student', isStudent());
    document.body.classList.toggle('role-guest', isGuest());
    document.body.classList.toggle('role-teacher', isTeacher());
    paintDefog();
    setTimeout(loadDuty, 300);
    $('#userChip').innerHTML = '<span class="uc-ico">👤 </span>' + esc(isStudent() ? settings.me : settings.inspector);
    paintView();
    renderMap('clean'); renderMap('jobs');
    renderJobs();
    showTab(ui.tab);
    if (isStaff()) { checkExpiry(); refresh(); }
    updateSync();
    if (started) return;
    started = true;
    App.emit('start');
    if (isStaff()) {
      flush();
      retryPhotos();
      setTimeout(() => loadStudents().catch(() => {}), 1500); // 背景先抓名單
    }
    try {
      if (sessionStorage.getItem('indoor.updated')) {
        sessionStorage.removeItem('indoor.updated');
        setTimeout(() => toast('✓ 已更新到最新版本'), 800);
      }
    } catch { /* ignore */ }
  }

  let lockMode = 'staff';
  function setLockMode(m) {
    lockMode = m;
    document.querySelectorAll('.lock-tabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lk === m));
    $('#lockMsg').textContent = '';
    $('#stepId').hidden = m !== 'student';
    $('#stepGuest').hidden = m !== 'guest';
    if (m === 'guest') {
      $('#stepPw').hidden = true; $('#stepWho').hidden = true;
      $('#lockBtn').textContent = '任課老師登入';
      $('#lockTitle').textContent = '任課老師';
    } else if (m === 'student') {
      $('#stepPw').hidden = true; $('#stepWho').hidden = true;
      $('#lockBtn').textContent = '登入選位';
      $('#lockTitle').textContent = '座位選位';
      setTimeout(() => $('#lockId').focus(), 30);
    } else if (TEST) {
      showWhoStep();
    } else {
      $('#stepPw').hidden = false; $('#stepWho').hidden = true;
      $('#lockBtn').textContent = '登入';
      $('#lockTitle').textContent = TEST ? '內掃區檢查（測試模式）' : '內掃區檢查';
      setTimeout(() => $('#lockPw').focus(), 30);
    }
  }
  document.querySelectorAll('.lock-tabs button').forEach(b => b.addEventListener('click', () => setLockMode(b.dataset.lk)));

  function showWhoStep() {
    $('#stepPw').hidden = true;
    $('#stepId').hidden = true;
    $('#stepWho').hidden = false;
    $('#whoSel').innerHTML = whoOptions(settings.inspector);
    $('#lockBtn').textContent = '開始使用';
    $('#lockTitle').textContent = TEST ? '內掃區檢查（測試模式）' : '內掃區檢查';
    $('#whoSel').focus();
  }
  function lockError(msg) {
    $('#lockMsg').textContent = msg;
    const card = $('.lock-card');
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  }
  // 全形轉半形、去空白
  const normInput = s => String(s).normalize('NFKC').replace(/\s+/g, '');

  $('#lock').addEventListener('submit', async e => {
    e.preventDefault();
    $('#lockMsg').textContent = '';
    const btn = $('#lockBtn');
    if (lockMode === 'staff' && !$('#stepWho').hidden) {
      setUser($('#whoSel').value);
      start();
      return;
    }
    if (lockMode === 'guest') {
      btn.disabled = true; btn.textContent = '登入中…';
      try {
        const r = TEST ? { sid: 'test', className: '商一甲' } : await api('guestLogin', { code: normInput($('#guestCode').value) });
        Object.assign(settings, { role: 'guest', sid: r.sid, me: '', token: '', inspector: '任課老師' });
        saveSettings();
        ui.tab = 'draw'; saveUi();
        start();
        syncRoster();
      } catch (err) {
        if (err.code === 'guestcode' || /登入碼/.test(err.message)) { $('#guestCode').hidden = false; $('#guestCode').focus(); }
        lockError(err.message);
      }
      btn.disabled = false; btn.textContent = '任課老師登入';
      return;
    }
    if (lockMode === 'student') {
      const idno = normInput($('#lockId').value).toUpperCase();
      if (!/^[A-Z][A-Z0-9]\d{8}$/.test(idno)) return lockError('身分證字號格式不正確（1 個英文字母＋9 個數字）');
      btn.disabled = true; btn.textContent = '確認中…';
      const slow = setTimeout(() => { $('#lockMsg').innerHTML = '<span class="muted">Google 雲端啟動中，可能需要 10–30 秒…</span>'; }, 4000);
      try {
        const r = await api('stuLogin', { idno });
        $('#lockId').value = '';
        settings.role = 'student'; settings.sid = r.sid; settings.me = r.me; settings.token = ''; settings.inspector = '';
        if (r.className) applyRoster(Object.assign({}, roster, { jobs: Object.assign({}, roster?.jobs, { CLASS: [r.className] }) }));
        saveSettings();
        ui.tab = 'seats'; saveUi();
        clearTimeout(slow);
        start();
        syncRoster();
      } catch (err) {
        clearTimeout(slow);
        lockError(err.message);
        $('#lockId').select();
      }
      btn.disabled = false; btn.textContent = '登入選位';
      return;
    }
    const pw = normInput($('#lockPw').value);
    if (!pw) return lockError('請輸入密碼');
    if (pw.toLowerCase() === 'test') {
      try { localStorage.setItem(LS_MODE, 'test'); } catch { /* ignore */ }
      location.reload();
      return;
    }
    btn.disabled = true; btn.textContent = '確認中…';
    const slow = setTimeout(() => { $('#lockMsg').innerHTML = '<span class="muted">Google 雲端啟動中，第一次可能需要 10–30 秒…</span>'; }, 4000);
    try {
      // 導師：統一密碼；幹部：自己的身分證字號（首字母大小寫都可以）
      const r = await api('staffLogin', { pw });
      if (r.role === 'teacher') Object.assign(settings, { role: 'staff', token: pw, inspector: D.teacherLabel, sid: '', me: '' });
      else Object.assign(settings, { role: 'cadre', token: '', sid: r.sid, me: r.me, inspector: r.me });
      applyRoster(r.roster);
      saveSettings();
      $('#lockPw').value = '';
      clearTimeout(slow);
      if (!allowedTabs().includes(ui.tab)) ui.tab = isTeacher() ? 'clean' : isChecker() ? 'clean' : 'points';
      start();
      toast(isTeacher() ? '導師，歡迎！' : `${r.me}（${r.roles.join('、')}）登入成功`);
    } catch (err) {
      settings.token = ''; settings.role = '';
      lockError(err.message);
      $('#lockPw').select();
    }
    clearTimeout(slow);
    btn.disabled = false; btn.textContent = '登入';
  });

  // ── 測試模式 ──
  function exitTest() {
    try {
      localStorage.removeItem(LS_MODE);
      Object.keys(localStorage).filter(k => k.endsWith('.test')).forEach(k => localStorage.removeItem(k));
      indexedDB.deleteDatabase('indoormap.test');
    } catch { /* ignore */ }
    location.reload();
  }
  if (TEST) {
    document.body.classList.add('test-mode');
    const bar = document.createElement('div');
    bar.className = 'test-banner';
    bar.innerHTML = '<span>🧪 測試模式：姓名已去識別化，資料不會送出</span><button type="button">結束測試</button>';
    bar.querySelector('button').addEventListener('click', async () => { if (await ask('結束測試模式？測試時的紀錄會全部清除。', '結束測試', true)) exitTest(); });
    document.body.prepend(bar);
    $('#stuHint').textContent = '測試模式：輸入任何格式正確的身分證字號（例如 A123456789），會以示範同學登入。';
  }

  // ── 給其他模組（座位、抽籤）使用 ──
  const listeners = {};
  const App = window.App = {
    D, TEST, SFX, $, esc, pad2, toast, ask, store, api, copyText, fmtDate, fmtTime, fmtDateW,
    loadImage, drawTo, toBlob, blobToBase64,
    isStudent, isStaff, isTeacher, isGuest, isChecker, jobsOf, roster: () => roster, me: () => settings.me, userName: () => settings.inspector,
    students, loadStudents, studentList: () => studentList, className: () => className() || studentList?.className || '',
    DEMO_STUDENTS,
    mountMap, renderMap, sizeMap, maps, flipOn,
    openSheet, closeSheet, sheetHead, sheetHandlers, changeHandlers, sheetMode: () => sheetMode, sheetBody,
    tabHooks, showTab, currentTab: () => ui.tab, started: () => started,
    on(ev, fn) { (listeners[ev] ||= []).push(fn); },
    emit(ev, ...a) { (listeners[ev] || []).forEach(fn => fn(...a)); },
  };

  // 等所有模組載入後再開始
  App.boot = () => {
    mountMap('clean', 'clean').el.addEventListener('click', onCleanClick);
    $('#outMap').addEventListener('click', onCleanClick);
    tabHooks.clean = renderArea;
    mountMap('jobs', 'jobs').el.addEventListener('click', onJobsMapClick);
    tabHooks.jobs = () => renderJobs();
    paintView();
    let msg = '';
    try { msg = sessionStorage.getItem('indoor.relogin') || ''; sessionStorage.removeItem('indoor.relogin'); } catch { /* ignore */ }
    if ((isStudent() && settings.sid && settings.me) || (isGuest() && settings.sid)) {
      if (roster) applyRoster(roster);
      start();
      syncRoster();
      return;
    }
    const ready = TEST ? !!settings.inspector : isTeacher() ? !!settings.token : isCadre() && !!settings.sid && !!settings.me;
    if (isStaff() && ready && (roster || TEST)) {
      if (TEST) applyRoster(demoRoster()); else applyRoster(roster);
      start();
      if (!TEST) syncRoster();
      return;
    }
    if (TEST) applyRoster(demoRoster());
    setLockMode(settings.role === 'student' || /stu|seat/i.test(location.hash) ? 'student' : 'staff');
    if (msg) $('#lockMsg').textContent = msg;
  };
})();
