'use strict';
/* 📅 課表：導師貼雲端試算表的網址（知道連結的人可以檢視）或上傳 Excel／CSV；全班都看得到。
   一份試算表可以有好幾個分頁（例如學生課表、導師課表），App 上可以切換。
   讀網址時用試算表的網頁版：合併儲存格（連堂、整週的早讀／午休）和底色都照試算表。
   顏色：一般的課是中性灰；分組上課（資料／多媒分開）用試算表的底色（洋紅、藍）。 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  let T = null, tAt = 0, busy = false, H = {}, POSTS = [];   // H：導師設定的小老師；POSTS：課程公告
  let view = store.get('indoor.tt.view', '');

  async function load(quiet) {
    try { apply(await A.api('getTimetable')); tAt = Date.now(); } catch (e) { if (!quiet) toast('課表讀取失敗：' + e.message); }
    if (A.currentTab() === 'tt') render();
  }
  function apply(r) { T = r.tt; H = r.helpers || {}; POSTS = r.posts || []; }
  // 存的格式：{ sheets: [{ name, grid, bg }], src, t }（舊的只有 grid）
  const sheetsOf = t => (t?.sheets?.length ? t.sheets : t?.grid ? [{ name: '課表', grid: t.grid }] : []);

  // ── 讀表格 ──
  // 合併儲存格：被合併掉的格子記成「接左邊」或「接上面」
  const CL = '\u0001L', CU = '\u0001U';
  const isM = c => c === CL || c === CU;
  const txt = c => (isM(c) ? '' : c);
  const norm = s => String(s ?? '').replace(/\r/g, '').trim();
  function parse(grid, bgGrid) {
    const rows = grid.map(r => r.map(c => (isM(c) ? c : norm(c))));
    const marks = rows.some(r => r.some(isM));
    const h = rows.findIndex(r => r.some(c => /^(星期|週)[一二三四五六日]/.test(c)));
    if (h < 0) throw new Error('找不到「星期一」那一列，請確認是課表');
    const head = rows[h];
    const title = rows.slice(0, h).map(r => r.map(txt).filter(Boolean).join(' ')).filter(Boolean).join('　');
    const pc = Math.max(0, head.findIndex(c => /節/.test(c))), tc = head.findIndex(c => /時間/.test(c));
    const dayCols = head.map((c, i) => (/^(星期|週)[一二三四五六日]/.test(c) ? i : -1)).filter(i => i >= 0);
    const days = dayCols.map((c, k) => {
      const next = k + 1 < dayCols.length ? dayCols[k + 1] : head.length;
      let w = 1;   // 這一天佔幾欄（標題合併過去的、或標題空白但下面有字的）
      while (c + w < next && (head[c + w] === CL || (!txt(head[c + w]) && rows.slice(h + 1).some(r => txt(r[c + w]))))) w++;
      return { name: head[c].replace(/^(星期|週)/, '').slice(0, 1), c, w };
    });
    const list = [];
    rows.slice(h + 1).forEach((r, k) => {
      const label = txt(r[pc] || ''), time = tc >= 0 ? txt(r[tc] || '') : '';
      const cells = days.map(d => r.slice(d.c, d.c + d.w));
      const flat = cells.flat();
      if (!label && !time && flat.every(v => !v)) return;
      // 早讀、升旗、午休：整週合併成一格，或整列都沒有課
      const across = txt(flat[0] || '') && flat.slice(1).every(v => v === CL) ? txt(flat[0]) : '';
      const lesson = !across && (/^\d+$/.test(label) || flat.some(v => txt(v) || v === CU));
      list.push({ label: label || across, time, cells, lesson, src: h + 1 + k });
    });
    const color = (ri, c) => (bgGrid?.[list[ri].src]?.[c] || '');
    const blocks = [];
    days.forEach((d, di) => {
      let cur = null;
      list.forEach((r, ri) => {
        if (!r.lesson) { cur = null; return; }
        const cs = r.cells[di];
        const items = cs.map((v, j) => ({ t: txt(v), bg: color(ri, d.c + j), j })).filter(x => x.t);
        if (items.length) {
          const same = cur && cur.to === ri - 1 && cur.items.map(x => x.t).join('|') === items.map(x => x.t).join('|');
          if (same) cur.to = ri; else { cur = { day: di, from: ri, to: ri, items }; blocks.push(cur); }
        } else if (cs.some(v => v === CU) && cur) cur.to = ri;            // 合併儲存格：同一堂連下去
        else if (!marks && cur && cs.every(v => !v)) cur.to = ri;          // 沒有合併資訊（CSV）：空白當作接上一堂
        else cur = null;                                                   // 空堂
      });
    });
    return { title, days, rows: list, blocks };
  }

  // ── 時間：現在第幾節 ──
  const mins = s => { const m = String(s).match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
  const range = t => { const p = String(t).split(/[–~\-～至]/); return [mins(p[0]), mins(p[1])]; };
  // 分組上課的底色：照試算表；試算表沒顏色（白色）時，左邊（資料）洋紅、右邊（多媒）藍
  const SPLIT = ['#fbe0f1', '#dfedff'];
  const isWhite = c => !c || /^#?f{3}(f{3})?$/i.test(c.replace(/\s/g, '')) || /^(white|transparent)$/i.test(c);
  function cellHtml(x, split) {
    const [course = '', teacher = '', ...rest] = x.t.split('\n').map(y => y.trim()).filter(Boolean);
    const bg = split ? (isWhite(x.bg) ? SPLIT[x.j] || SPLIT[0] : x.bg) : '';
    return `<div class="tt-c${bg ? ' tint' : ''}${POSTS.some(q => q.course === ckey(course)) ? ' has-post' : ''}" data-tt="course" data-c="${esc(course)}" data-info="${esc([teacher, ...rest].join('・'))}" role="button" tabindex="0"${bg ? ` style="--tint:${esc(bg)}"` : ''}><b class="tt-course">${esc(course)}</b>${teacher ? `<span class="tt-teacher">${esc(teacher)}</span>` : ''}${rest.length ? `<span class="tt-room">${esc(rest.join(' '))}</span>` : ''}</div>`;
  }

  function gridHtml(P) {
    const now = new Date(), dow = now.getDay(), m = now.getHours() * 60 + now.getMinutes();
    const today = P.days.findIndex(d => '日一二三四五六'.indexOf(d.name) === dow);
    const nowRow = P.rows.findIndex(r => { const [a, b] = range(r.time); return a != null && b != null && m >= a && m < b; });
    // 有分組上課（左右並排）的那幾天，欄寬一點
    const cols = P.days.map((d, i) => (P.blocks.some(b => b.day === i && b.items.length > 1) ? 'minmax(0, 1.45fr)' : 'minmax(0, 1fr)')).join(' ');
    let h = `<div class="tt-grid" style="--days:${P.days.length};grid-template-columns:var(--tt-label, 2.35em) ${cols}">`;
    h += `<div class="tt-h tt-corner"></div>${P.days.map((d, i) => `<div class="tt-h${i === today ? ' today' : ''}" style="grid-column:${i + 2}">${esc(d.name)}</div>`).join('')}`;
    P.rows.forEach((r, ri) => {
      const row = ri + 2;
      // 早讀、升旗、午休：一條橫跨整週的細條；上課的節：節次＋上下兩行的時間
      if (!r.lesson) { h += `<div class="tt-brk${today >= 0 && ri === nowRow ? ' now' : ''}" style="grid-row:${row};grid-column:1/-1"><b>${esc(r.label)}</b>${r.time ? `<small>${esc(r.time)}</small>` : ''}</div>`; return; }
      const [t1, t2] = r.time.split(/\s*[–~\-～至]\s*/);
      h += `<div class="tt-p${today >= 0 && ri === nowRow ? ' now' : ''}" style="grid-row:${row}"><b>${esc(r.label)}</b>${t1 ? `<small>${esc(t1)}${t2 ? `<br>${esc(t2)}` : ''}</small>` : ''}</div>`;
    });
    P.blocks.forEach(b => {
      const live = b.day === today && nowRow >= b.from && nowRow <= b.to, split = b.items.length > 1;
      h += `<div class="tt-b${split ? ' split' : ''}${b.day === today ? ' today' : ''}${live ? ' live' : ''}" style="grid-column:${b.day + 2};grid-row:${b.from + 2}/${b.to + 3}">${b.items.map(x => cellHtml(x, split)).join('')}</div>`;
    });
    return h + '</div>';
  }
  // 今天：現在這一節、下一節
  function nowHtml(P) {
    const now = new Date(), dow = now.getDay(), m = now.getHours() * 60 + now.getMinutes();
    const di = P.days.findIndex(d => '日一二三四五六'.indexOf(d.name) === dow);
    if (di < 0) return '';
    const bl = P.blocks.filter(b => b.day === di).sort((a, b) => a.from - b.from);
    const start = b => range(P.rows[b.from].time)[0], end = b => range(P.rows[b.to].time)[1];
    const cur = bl.find(b => start(b) != null && m >= start(b) && m < end(b)), next = bl.find(b => start(b) != null && start(b) > m);
    const one = b => b.items.map(x => { const [c, tch, ...rm] = x.t.split('\n').map(y => y.trim()).filter(Boolean); return `<b>${esc(c)}</b>${tch ? `<span class="tt-teacher">${esc(tch)}${rm.length ? '・' + esc(rm.join(' ')) : ''}</span>` : ''}`; }).join('<span class="muted"> ／ </span>');
    if (!cur && !next) return '';
    return `<div class="panel tt-now">${cur ? `<div><span class="tt-tag live">現在</span>${one(cur)}</div>` : ''}${next ? `<div><span class="tt-tag">下一節 ${esc(P.rows[next.from].time.split(/[–~\-～]/)[0])}</span>${one(next)}</div>` : ''}</div>`;
  }

  const tabName = s => (/導師|老師|教師/.test(s.name) ? '🧑‍🏫 導師課表' : '🎒 學生課表');
  function render() {
    const root = $('#ttRoot');
    if (!root) return;
    const list = sheetsOf(T);
    let h = '';
    if (list.length) {
      let i = list.findIndex(s => s.name === view);
      if (i < 0) i = Math.max(0, list.findIndex(s => !/導師|老師|教師/.test(s.name)));   // 預設學生課表；切換過就停在上次選的（記在這台裝置）
      if (list.length > 1) {
        const names = list.map(tabName), dup = n => names.filter(x => x === n).length > 1;
        h += `<div class="subsw tt-sw">${list.map((s, k) => `<button type="button" data-tt="view" data-v="${esc(s.name)}" aria-selected="${k === i}">${dup(names[k]) ? esc(s.name) : names[k]}</button>`).join('')}</div>`;
      }
      try {
        const P = parse(list[i].grid, list[i].bg);
        h += nowHtml(P);
        h += `<div class="panel tt-panel">${P.title ? `<p class="muted small tt-title">${esc(P.title)}</p>` : ''}${gridHtml(P)}</div>`;
      } catch (e) { h += `<div class="panel"><p class="lock-msg">「${esc(list[i].name)}」格式讀不懂：${esc(e.message)}</p></div>`; }
    } else h += `<div class="panel"><p class="muted">${!tAt ? '讀取中…' : '導師還沒有設定課表。'}</p></div>`;
    if (A.isTeacher()) h += adminHtml();
    root.innerHTML = h;
  }

  // ── 導師：用網址或檔案更新課表 ──
  function adminHtml() {
    const has = sheetsOf(T).length;
    return `<details class="panel tt-admin"${has ? '' : ' open'}><summary><b>⚙️ 更新課表（導師）</b></summary>
      <label class="lv-f"><span>雲端試算表網址（共用設定要是「知道連結的人可以檢視」）</span><input type="url" id="ttUrl" placeholder="https://docs.google.com/spreadsheets/d/…" value="${esc(T?.src && /^https?:/.test(T.src) ? T.src : '')}"></label>
      <div class="actions"><button type="button" class="btn btn--primary" data-tt="url"${busy ? ' disabled' : ''}>${busy ? '讀取中…' : '📥 從網址讀取'}</button>
        <label class="btn file-btn">📄 上傳 Excel／CSV<input type="file" id="ttFile" accept=".xlsx,.xls,.csv" hidden></label></div>
      <p class="muted small">試算表的每個分頁都會讀進來（例如學生課表、導師課表），App 上可以切換。格式：一列「節次｜時間｜星期一｜…｜星期五」，下面每節一列，每格寫「課名、老師（或班級）、教室」（換行分開）。一天可以佔兩欄（分組上課，底色照試算表）；連堂用合併儲存格。改了試算表之後，回來按「從網址讀取」就會更新。</p>
      ${T?.t ? `<p class="muted small">上次更新：${esc(new Date(T.t).toLocaleString('zh-TW', { hour12: false }))}</p>` : ''}</details>`;
  }
  // CSV（包含引號裡的換行）
  function csv(text) {
    const out = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell || row.length) { row.push(cell); out.push(row); }
    return out;
  }
  // 試算表網頁版的 <table> → 表格（合併儲存格記成 CL／CU）＋每格的底色
  function htmlGrid(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tb = doc.querySelector('table.waffle') || doc.querySelector('table');
    if (!tb) return null;
    const css = [...doc.querySelectorAll('style')].map(s => s.textContent).join('\n'), bgOf = {};
    for (const m of css.matchAll(/\.(s\d+)\s*\{([^}]*)\}/g)) { const b = m[2].match(/background-color:\s*([^;]+)/); if (b) bgOf[m[1]] = b[1].trim(); }
    const grid = [], bg = [];
    [...tb.rows].forEach((tr, ri) => {
      grid[ri] ||= []; bg[ri] ||= [];
      let c = 0;
      [...tr.cells].forEach(td => {
        if (td.tagName === 'TH' || td.classList.contains('freezebar-cell')) return;
        while (grid[ri][c] !== undefined) c++;
        const rs = Math.max(1, td.rowSpan || 1), cs = Math.max(1, td.colSpan || 1);
        td.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
        const t = td.textContent.replace(/ /g, ' ').trim(), color = bgOf[[...td.classList].find(k => bgOf[k])] || '';
        for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) {
          (grid[ri + i] ||= [])[c + j] = i === 0 && j === 0 ? t : i === 0 ? CL : CU;
          (bg[ri + i] ||= [])[c + j] = isWhite(color) ? '' : color;
        }
        c += cs;
      });
    });
    const w = Math.max(...grid.map(r => r.length));
    return { grid: grid.map(r => Array.from({ length: w }, (_, i) => r[i] ?? '')), bg: bg.map(r => Array.from({ length: w }, (_, i) => r[i] ?? '')) };
  }
  // 去掉後面空白的列和欄（存起來比較小）
  function trim(s) {
    let g = s.grid.map(r => r.map(c => (isM(c) ? c : norm(c)))), b = s.bg;
    while (g.length && g[g.length - 1].every(c => !c)) g.pop();
    const w = Math.max(0, ...g.map(r => { let n = r.length; while (n && !r[n - 1]) n--; return n; }));
    g = g.map(r => { const x = r.slice(0, w); while (x.length < w) x.push(''); return x; });
    b = b && b.some(r => r.some(Boolean)) ? g.map((_, i) => Array.from({ length: w }, (_, j) => b[i]?.[j] || '')) : undefined;
    return { name: s.name, grid: g, ...(b ? { bg: b } : {}) };
  }
  let xlsxP;
  const loadXlsx = () => xlsxP ||= new Promise((res, rej) => {
    if (window.XLSX) return res(window.XLSX);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => res(window.XLSX);
    s.onerror = () => { xlsxP = null; rej(new Error('無法載入 Excel 讀取工具，請確認網路，或改存成 CSV')); };
    document.head.appendChild(s);
  });
  // Excel：每個工作表＋合併儲存格
  function xlsxSheets(X, wb) {
    return wb.SheetNames.map(name => {
      const ws = wb.Sheets[name];
      if (!ws['!ref']) return null;
      const grid = X.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }), o = X.utils.decode_range(ws['!ref']).s;
      (ws['!merges'] || []).forEach(m => {
        for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) {
          if (r === m.s.r && c === m.s.c) continue;
          (grid[r - o.r] ||= [])[c - o.c] = r === m.s.r ? CL : CU;
        }
      });
      return { name, grid: grid.map(r => Array.from(r, v => v ?? '')) };
    }).filter(Boolean);
  }
  async function save(raw, src) {
    const ok = [];
    raw.forEach(s => { try { const t = trim(s), P = parse(t.grid, t.bg); if (P.blocks.length) ok.push({ t, P }); } catch { /* 不是課表的分頁 */ } });
    if (!ok.length) throw new Error('沒有讀到課表（要有「星期一」那一列）');
    const lines = ok.map(({ t, P }) => `・${t.name}：${P.days.length} 天、${P.rows.filter(r => r.lesson).length} 節、${P.blocks.length} 堂課`).join('\n');
    if (!await A.ask(`讀到 ${ok.length} 個課表：\n${lines}\n\n儲存並公布給全班？`, '儲存')) return false;
    apply(await A.api('setTimetable', { tt: { sheets: ok.map(x => x.t), src } }));
    toast('✓ 課表已更新');
    return true;
  }
  async function fromUrl(url) {
    const m = url.match(/\/spreadsheets\/d\/([\w-]+)/);
    if (!m) throw new Error('請貼上 Google 試算表的網址');
    const base = `https://docs.google.com/spreadsheets/d/${m[1]}`, list = [];
    // 1) 網頁版：每個分頁、合併儲存格、底色
    try {
      const html = await (await fetch(`${base}/htmlview`)).text();
      const tabs = [...html.matchAll(/items\.push\(\{name: "((?:[^"\\]|\\.)*)",[^}]*?gid: "(-?\d+)"/g)].map(x => ({ name: JSON.parse(`"${x[1]}"`), gid: x[2] }));
      for (const tb of tabs) {
        const g = htmlGrid(await (await fetch(`${base}/htmlview/sheet?headers=false&gid=${tb.gid}`)).text());
        if (g?.grid.length) list.push({ name: tb.name, ...g });
      }
    } catch { /* 改用 CSV */ }
    // 2) 讀不到網頁版：只讀網址上那一個分頁的 CSV（沒有合併、底色）
    if (!list.length) {
      const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
      const res = await fetch(`${base}/gviz/tq?tqx=out:csv&headers=0${gid ? '&gid=' + gid : ''}`), text = await res.text();
      if (!res.ok || /^\s*</.test(text)) throw new Error('讀不到：請把試算表的共用設定改成「知道連結的任何人都能檢視」');
      list.push({ name: '課表', grid: csv(text) });
    }
    return list;
  }
  $('#ttRoot').addEventListener('click', async e => {
    const b = e.target.closest('[data-tt]');
    if (!b || b.disabled) return;
    if (b.dataset.tt === 'course') return openCourse(b.dataset.c, b.dataset.info);
    if (b.dataset.tt === 'view') { view = b.dataset.v; store.set('indoor.tt.view', view); return render(); }
    if (b.dataset.tt === 'url') {
      const url = ($('#ttUrl').value || '').trim();
      busy = true; render();
      try { await save(await fromUrl(url), url); } catch (err) { toast(err.message); }
      busy = false; render();
    }
  });
  $('#ttRoot').addEventListener('change', async e => {
    if (e.target.id !== 'ttFile') return;
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      let list;
      if (/\.xlsx?$/i.test(f.name)) { const X = await loadXlsx(); list = xlsxSheets(X, X.read(await f.arrayBuffer(), { type: 'array' })); }
      else { const buf = await f.arrayBuffer(); let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { text = new TextDecoder('big5').decode(buf); } list = [{ name: f.name.replace(/\.\w+$/, ''), grid: csv(text.replace(/^﻿/, '')) }]; }
      await save(list, f.name);
    } catch (err) { toast('課表讀取失敗：' + err.message); }
    render();
  });

  // ── 📚 點課程：小老師是誰、小老師的公告 ──
  const ckey = c => String(c || '').replace(/\s+/g, '').slice(0, 30);
  const sub = (a, b) => { let i = 0; for (const ch of b) if (ch === a[i]) i++; return i === a.length; };
  const nm = k => { if (k === (A.D.teacherLabel || '導師')) return '導師'; const p = A.parseKey(k); return p.code ? `${p.code.replace(/(\d+)$/, ' $1')} ${p.name}` : k; };
  // 導師設定的優先；沒有就看幹部名單裡「○○小老師」（國文小老師 → 國語文）
  function helpersOf(c) {
    const k = ckey(c);
    if (H[k]) return H[k];
    // 體育課的小老師＝體育股長、康樂股長
    const rule = r => /體育/.test(k) && /^(體育|康樂)(股長)?$/.test(String(r).trim());
    return A.students().filter(s => (A.jobsOf?.(s)?.roles || []).some(r => { const m = String(r).match(/^(.+?)小老師/); return (m && sub(m[1], k)) || rule(r); }));
  }
  let openC = null;
  function openCourse(c, info) {
    openC = { c, info };
    const k = ckey(c), hs = helpersOf(c), me = A.isTeacher() ? (A.D.teacherLabel || '導師') : A.me();
    const canPost = A.isTeacher() || hs.includes(me), posts = POSTS.filter(q => q.course === k).sort((a, b) => b.t - a.t);
    let h = A.sheetHead(`📚 ${esc(c)}`, info ? esc(info) : '課程');
    h += `<div class="ttc-sec"><b>🙋 小老師</b>${hs.length ? `<div class="ttc-hs">${hs.map(x => `<span class="ttc-h${x === me ? ' me' : ''}">${esc(nm(x))}</span>`).join('')}</div>` : '<p class="muted small">還沒有小老師。</p>'}
      ${!H[k] && hs.length ? `<p class="muted small">（從幹部名單${/體育/.test(k) ? '的體育股長、康樂股長' : '的「小老師」職位'}自動帶入）</p>` : ''}</div>`;
    if (A.isTeacher()) h += `<details class="ttc-set"><summary class="small"><b>✏️ 設定這門課的小老師</b></summary>
      <div class="lv-pick">${A.students().map(x => `<label><input type="checkbox" value="${esc(x)}" data-ttch${hs.includes(x) ? ' checked' : ''}> ${esc(nm(x))}</label>`).join('')}</div>
      <p class="muted small">都不勾＝改回看幹部名單裡「${esc(c.slice(0, 2))}小老師」的職位。</p>
      <div class="actions"><button type="button" class="btn wide" data-act="ttcHelpers">儲存小老師</button></div></details>`;
    h += `<div class="ttc-sec"><b>📢 小老師公告</b>${posts.length ? posts.map(q => `<div class="ttc-post"><div class="ttc-ph"><span class="muted small">${esc(q.time)}・${esc(nm(q.by))}</span>${A.isTeacher() || q.by === me ? `<button type="button" class="link-btn" data-act="ttcDel" data-id="${esc(q.id)}">刪除</button>` : ''}</div><div class="ttc-pt">${esc(q.text).replace(/\n/g, '<br>')}</div></div>`).join('') : '<p class="muted small">還沒有公告。</p>'}</div>`;
    if (canPost) h += `<div class="ttc-sec"><textarea id="ttcText" rows="3" maxlength="500" placeholder="例如：明天要帶課本第 3 冊、週五小考第 2 課…"></textarea>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="ttcPost">📢 發公告</button></div></div>`;
    else if (!A.isGuest()) h += `<p class="muted small">只有這門課的小老師（和導師）可以發公告。</p>`;
    A.openSheet({ kind: 'ttc' }, h);
  }
  A.sheetHandlers.ttc = async (act, b) => {
    if (!openC) return;
    const k = ckey(openC.c);
    b.disabled = true;
    try {
      if (act === 'ttcPost') {
        const text = ($('#ttcText')?.value || '').trim();
        if (!text) { b.disabled = false; $('#ttcText')?.focus(); return toast('請寫公告內容'); }
        apply(await A.api('postCourse', { course: k, text })); toast('📢 已發公告');
      } else if (act === 'ttcDel') {
        if (!await A.ask('刪除這則公告？', '刪除', true)) { b.disabled = false; return; }
        apply(await A.api('delCoursePost', { id: b.dataset.id })); toast('已刪除');
      } else if (act === 'ttcHelpers') {
        const keys = [...document.querySelectorAll('[data-ttch]:checked')].map(x => x.value);
        apply(await A.api('setCourseHelpers', { course: k, keys })); toast('✓ 已設定小老師');
      } else { b.disabled = false; return; }
      openCourse(openC.c, openC.info); render();
    } catch (err) { toast(err.message); b.disabled = false; }
  };

  A.tabHooks.tt = () => { render(); if (Date.now() - tAt > 5 * 60e3) load(); };
  A.addPrefetch('tt', () => load(true));
  setInterval(() => { if (A.currentTab() === 'tt' && !document.hidden && T) render(); }, 60e3);   // 「現在第幾節」跟著時間走

  // ── 測試模式：存在這台裝置 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    const KT = 'indoor.tt.v1.test', KH = 'indoor.tthelp.v1.test', KP = 'indoor.ttpost.v1.test';
    const out = () => ({ ok: true, tt: store.get(KT, null), helpers: store.get(KH, {}), posts: store.get(KP, []) });
    const me = A.isTeacher() ? (A.D.teacherLabel || '導師') : A.me();
    if (action === 'getTimetable') return out();
    if (action === 'setTimetable') { store.set(KT, { ...p.tt, t: Date.now() }); return out(); }
    if (action === 'setCourseHelpers') { const h = store.get(KH, {}); if (p.keys.length) h[p.course] = p.keys; else delete h[p.course]; store.set(KH, h); return out(); }
    if (action === 'postCourse') { const d = new Date(); store.set(KP, [...store.get(KP, []), { id: 'c' + Date.now(), course: p.course, text: p.text, by: me, t: Date.now(), time: `${A.fmtDate(d).slice(5)} ${A.fmtTime(d)}` }]); return out(); }
    if (action === 'delCoursePost') { store.set(KP, store.get(KP, []).filter(q => q.id !== p.id)); return out(); }
    return prevTest ? prevTest(action, p) : null;
  };
})();
