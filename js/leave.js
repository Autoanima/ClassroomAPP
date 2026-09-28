'use strict';
/* 📝 請假：同學登記（假別、日期、第幾節到第幾節），跑完假卡流程後上傳簽好章的假卡；
   導師看總表（篩選、統計）、看假卡照片、確認或退回，也可以幫同學登記（LINE、口頭、家長告知的）。
   同學只看得到自己的；總表只有導師看得到。請假規則由導師在這裡編輯（預設收起來）。 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  const TYPES = ['事假', '病假', '公假', '喪假', '生理假', '身心調適假'];
  const TYPE_CLS = { 事假: 't-a', 病假: 't-b', 公假: 't-c', 喪假: 't-d', 生理假: 't-e', 身心調適假: 't-f' };
  const PERIODS = [0, 1, 2, 3, 4, 5, 6, 7];   // 早自習、第 1～7 節（這個班沒有第 8 節）
  const pName = p => (Number(p) === 0 ? '早自習' : `第${p}節`);
  const STEP = ['已登記', '已上傳假卡', '已確認'];
  let L = null, lAt = 0, view = 'todo', rulesEdit = false;
  const nm = k => { const p = A.parseKey(k); return p.code ? `${p.code.replace(/(\d+)$/, ' $1')} ${p.name}` : k; };
  const today = () => A.fmtDate(new Date());
  const isT = () => A.isTeacher();

  async function load(quiet) {
    try { L = await A.api('getLeave'); lAt = Date.now(); } catch (e) { if (!quiet) toast('請假資料讀取失敗：' + e.message); }
    if (!quiet || A.currentTab() === 'leave') render();
  }
  const when = x => `${x.from.slice(5)} ${pName(x.fromP)}${x.from === x.to ? (x.fromP === x.toP ? '' : `～${pName(x.toP)}`) : ` ～ ${x.to.slice(5)} ${pName(x.toP)}`}`;
  // 節數：每天第 1～7 節（早自習不算），跨天的中間每天 7 節
  function periods(x) {
    const d0 = new Date(x.from.replace(/\//g, '-') + 'T12:00'), d1 = new Date(x.to.replace(/\//g, '-') + 'T12:00');
    const days = Math.round((d1 - d0) / 86400e3);
    const one = (a, b) => Math.max(0, Math.min(b, 7) - Math.max(a, 1) + 1);
    if (days <= 0) return one(x.fromP, x.toP);
    return one(x.fromP, 7) + one(1, x.toP) + Math.max(0, days - 1) * 7;
  }

  function render() {
    const root = $('#leaveRoot');
    if (!root) return;
    if (!L) { root.innerHTML = `<div class="panel"><p class="muted">讀取中…</p></div>`; return; }
    let h = rulesHtml();
    h += formHtml();
    // 導師：總表（可以確認、退回）；班長、副班長：自己的請假＋唯讀的總表；其他同學：自己的請假
    h += isT() ? teacherHtml() : L.monitor ? mineHtml() + teacherHtml(true) : mineHtml();
    root.innerHTML = h;
  }
  // 請假規則：預設收起來；導師可以編輯
  function rulesHtml() {
    const txt = L.rules || '';
    let body = rulesEdit
      ? `<textarea id="lvRules" rows="8" maxlength="5000" placeholder="例如：\n1. 事假要事先請，病假回校後 3 天內補請…\n2. 假卡流程：家長簽名 → 導師簽名 → 教官室…">${esc(txt)}</textarea>
         <div class="actions"><button type="button" class="btn btn--primary" data-lv="rulesSave">儲存</button><button type="button" class="btn" data-lv="rulesCancel">取消</button></div>`
      : `<div class="lv-rules-text">${txt ? esc(txt).replace(/\n/g, '<br>') : '<span class="muted">（導師還沒填寫請假規則）</span>'}</div>${isT() ? '<button type="button" class="link-btn" data-lv="rulesEdit">✏️ 編輯請假規則</button>' : ''}`;
    return `<details class="panel lv-rules"${rulesEdit ? ' open' : ''}><summary><b>📜 請假規則</b></summary>${body}</details>`;
  }
  function formHtml() {
    const pOpt = sel => PERIODS.map(p => `<option value="${p}"${p === sel ? ' selected' : ''}>${pName(p)}</option>`).join('');
    const who = isT() ? `<label class="lv-f"><span>同學</span><select id="lvKey"><option value="">— 選擇同學 —</option>${A.students().map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}</select></label>` : '';
    return `<details class="panel lv-new"${isT() ? '' : ' open'}><summary><b>${isT() ? '➕ 幫同學登記請假' : '📝 我要請假'}</b></summary>
      ${who}
      <div class="lv-types">${TYPES.map((t, i) => `<button type="button" data-lv="type" data-v="${t}" aria-pressed="${i === 0}">${t}</button>`).join('')}</div>
      <div class="lv-grid">
        <label class="lv-f"><span>從</span><input type="date" id="lvFrom" value="${today().replace(/\//g, '-')}"></label>
        <label class="lv-f"><span>&nbsp;</span><select id="lvFromP">${pOpt(1)}</select></label>
        <label class="lv-f"><span>到</span><input type="date" id="lvTo" value="${today().replace(/\//g, '-')}"></label>
        <label class="lv-f"><span>&nbsp;</span><select id="lvToP">${pOpt(7)}</select></label>
      </div>
      <label class="lv-f"><span>說明（可不填）</span><input type="text" id="lvNote" maxlength="200" placeholder="例如：看醫生、家裡有事"></label>
      <p class="muted small">假卡流程：家長簽名 → 導師簽名 → 教官室（特殊情形再送學務處、校長室）。全部簽完後，在下面按「📷 上傳假卡」。</p>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-lv="add">送出請假登記</button></div></details>`;
  }
  // 一筆請假：進度（已登記 → 已上傳假卡 → 已確認）＋動作
  function itemHtml(x, teacher, ro) {
    const back = x.status === '退回', idx = back ? 0 : STEP.indexOf(x.status);
    const steps = back ? `<span class="lv-back">↩ 退回${x.reply && !x.other ? `：${esc(x.reply)}` : ''}</span>`
      : STEP.map((s, i) => `<span class="lv-step${i <= idx ? ' on' : ''}">${i === 1 ? '假卡' : i === 2 ? '導師確認' : '登記'}</span>`).join('<i>›</i>');
    // 班長、副班長看別人的：只看得到誰、哪天、假別、進度（沒有按鈕、說明、假卡照片）
    if (ro && x.other) {
      return `<div class="lv-item${x.status === '已確認' ? ' done' : ''}">
        <div class="lv-top"><span class="lv-type ${TYPE_CLS[x.type] || ''}">${esc(x.type)}</span><b>${esc(when(x))}</b><span class="lv-who">${esc(nm(x.key))}</span></div>
        <div class="lv-steps">${steps}</div>
        <div class="muted small">${periods(x)} 節${x.nCards ? `・已上傳假卡 ${x.nCards} 張` : ''}</div></div>`;
    }
    const btns = [];
    if (x.cards.length) btns.push(`<button type="button" class="btn" data-lv="cards" data-id="${esc(x.id)}">🖼 假卡 ${x.cards.length}</button>`);
    if (x.status !== '已確認') btns.push(`<button type="button" class="btn${!teacher && !x.cards.length ? ' btn--primary' : ''}" data-lv="upload" data-id="${esc(x.id)}">📷 上傳假卡</button>`);
    if (teacher && x.status !== '已確認') btns.push(`<button type="button" class="btn btn--primary" data-lv="ok" data-id="${esc(x.id)}">✓ 確認</button>`);
    if (teacher && x.status !== '退回' && x.status !== '已確認') btns.push(`<button type="button" class="btn" data-lv="back" data-id="${esc(x.id)}">↩ 退回</button>`);
    if (x.status !== '已確認' || teacher) btns.push(`<button type="button" class="link-btn" data-lv="cancel" data-id="${esc(x.id)}">取消這筆</button>`);
    return `<div class="lv-item${x.status === '已確認' ? ' done' : ''}">
      <div class="lv-top"><span class="lv-type ${TYPE_CLS[x.type] || ''}">${esc(x.type)}</span><b>${esc(when(x))}</b>${teacher ? `<span class="lv-who">${esc(nm(x.key))}</span>` : ''}</div>
      ${x.note ? `<div class="small">${esc(x.note)}</div>` : ''}
      <div class="lv-steps">${steps}</div>
      ${x.reply && !back ? `<div class="small muted">導師：${esc(x.reply)}</div>` : ''}
      <div class="lv-btns">${btns.join('')}</div>
      <div class="muted small">${esc(x.time)} 由 ${esc(x.by === x.key ? '本人' : x.by)} 登記・${periods(x)} 節</div></div>`;
  }
  function mineHtml() {
    const rows = L.rows.filter(x => !x.other && (!L.me || x.key === L.me));
    return `<div class="panel"><h3>我的請假</h3>${rows.length ? rows.map(x => itemHtml(x, false)).join('') : '<p class="muted small">還沒有請假紀錄。</p>'}</div>`;
  }
  // 導師總表：篩選（待處理／本月／全部）＋每個人的統計
  function teacherHtml(ro) {
    const month = today().slice(0, 7);
    const pick = { todo: x => x.status !== '已確認', month: x => x.from.slice(0, 7) === month || x.to.slice(0, 7) === month, all: () => true };
    const list = L.rows.filter(pick[view]);
    const tab = (v, t, n) => `<button type="button" data-lv="view" data-v="${v}" aria-pressed="${view === v}">${t}${n != null ? ` <span class="lv-n">${n}</span>` : ''}</button>`;
    let h = `<div class="panel"><h3>📋 請假總表${ro ? ' <span class="muted small">（班長、副班長可以看；說明和假卡只有導師看得到）</span>' : ''}</h3>
      <div class="lv-views">${tab('todo', '待處理', L.rows.filter(pick.todo).length)}${tab('month', '本月')}${tab('all', '全部')}</div>
      ${list.length ? list.map(x => itemHtml(x, !ro, ro)).join('') : `<p class="muted small">${view === 'todo' ? '沒有待處理的請假 🎉' : '沒有紀錄。'}</p>`}</div>`;
    // 統計：每位同學各假別的節數（已取消的不算）
    const stat = {};
    L.rows.forEach(x => { const s = (stat[x.key] ||= {}); s[x.type] = (s[x.type] || 0) + periods(x); });
    const keys = Object.keys(stat).sort();
    if (keys.length) {
      h += `<details class="panel"><summary><b>📊 請假統計（節數）</b></summary><div class="admin-wrap"><table class="admin lv-stat"><thead><tr><th>同學</th>${TYPES.map(t => `<th>${t}</th>`).join('')}<th>合計</th></tr></thead><tbody>
        ${keys.map(k => `<tr><td>${esc(nm(k))}</td>${TYPES.map(t => `<td>${stat[k][t] || ''}</td>`).join('')}<td><b>${Object.values(stat[k]).reduce((a, b) => a + b, 0)}</b></td></tr>`).join('')}
        </tbody></table></div><p class="muted small">節數以第 1～7 節計算（早自習不算），跨天的中間每天算 7 節。</p></details>`;
    }
    return h;
  }

  // ── 假卡照片：壓縮後上傳（長邊最多 1600，字看得清楚）──
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('讀不到這張圖片')); i.src = url; });
      for (let max = 1600, q = 0.82; max >= 700; max = Math.round(max * 0.85), q = Math.max(0.62, q - 0.04)) {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
        const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
        const d = cv.toDataURL('image/jpeg', q);
        if (d.length < 620000) return d;
      }
      throw new Error('照片太大，請換一張');
    } finally { URL.revokeObjectURL(url); }
  }
  let upId = null;
  const fileInput = () => {
    let inp = $('#lvFile');
    if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.id = 'lvFile'; inp.hidden = true; document.body.appendChild(inp); inp.addEventListener('change', onFiles); }
    return inp;
  };
  async function onFiles(e) {
    const files = [...e.target.files]; e.target.value = '';
    const id = upId; upId = null;
    if (!files.length || !id) return;
    const done = A.waitFor?.('', { msg: '請稍等，正在上傳假卡', work: true });
    try { for (const f of files.slice(0, 3)) L = await A.api('leaveCard', { id, data: await shrink(f) }); toast('✓ 假卡已上傳，等導師確認'); } catch (err) { toast(err.message); }
    done?.();
    render();
  }
  const cardCache = {};
  async function openCards(x) {
    let h = A.sheetHead('🖼 假卡', `${nm(x.key)}｜${x.type}｜${when(x)}`);
    h += `<div class="rcpt-view">${x.cards.map(fid => `<figure data-fid="${esc(fid)}">${cardCache[fid] ? `<img src="${cardCache[fid]}" alt="假卡">` : '<p class="muted">讀取中…</p>'}</figure>`).join('')}</div>`;
    A.openSheet({ kind: 'leaveCards' }, h);
    for (const fid of x.cards) {
      if (!cardCache[fid]) { try { cardCache[fid] = (await A.api('getLeaveCard', { fid })).d; } catch (err) { cardCache[fid] = ''; toast(err.message); } }
      const fig = document.querySelector(`.rcpt-view [data-fid="${CSS.escape(fid)}"]`);
      if (fig) fig.innerHTML = cardCache[fid] ? `<img src="${cardCache[fid]}" alt="假卡">` : '<p class="muted">讀不到這張假卡</p>';
    }
  }

  let lvType = TYPES[0];
  $('#leaveRoot').addEventListener('click', async e => {
    const b = e.target.closest('[data-lv]');
    if (!b || b.disabled) return;
    const act = b.dataset.lv, x = L?.rows.find(r => r.id === b.dataset.id);
    if (act === 'type') { lvType = b.dataset.v; b.parentElement.querySelectorAll('button').forEach(y => y.setAttribute('aria-pressed', y === b)); return; }
    if (act === 'view') { view = b.dataset.v; render(); return; }
    if (act === 'rulesEdit') { rulesEdit = true; render(); return; }
    if (act === 'rulesCancel') { rulesEdit = false; render(); return; }
    if (act === 'rulesSave') {
      b.disabled = true;
      try { L = await A.api('setLeaveRules', { text: $('#lvRules').value }); rulesEdit = false; toast('✓ 已儲存請假規則'); } catch (err) { toast(err.message); b.disabled = false; return; }
      render(); return;
    }
    if (act === 'add') {
      const row = { type: lvType, from: $('#lvFrom').value.replace(/-/g, '/'), fromP: Number($('#lvFromP').value), to: $('#lvTo').value.replace(/-/g, '/'), toP: Number($('#lvToP').value), note: $('#lvNote').value.trim() };
      if (isT()) { row.key = $('#lvKey').value; if (!row.key) return toast('請選擇同學'); }
      if (!row.from || !row.to) return toast('請選擇日期');
      if (row.to < row.from || (row.to === row.from && row.toP < row.fromP)) return toast('結束的時間要在開始之後');
      const text = `${isT() ? nm(row.key) + '\n' : ''}${row.type}：${when(row)}${row.note ? '\n' + row.note : ''}`;
      if (!await A.ask(`送出請假登記？\n${text}`, '送出')) return;
      b.disabled = true;
      try { L = await A.api('addLeave', { row }); toast(isT() ? '✓ 已幫同學登記，也通知他了' : '✓ 已登記，也通知導師了。記得跑完假卡流程後上傳假卡'); } catch (err) { toast(err.message); b.disabled = false; return; }
      render(); return;
    }
    if (!x) return;
    if (act === 'cards') return openCards(x);
    if (act === 'upload') { upId = x.id; fileInput().click(); return; }
    if (act === 'ok' || act === 'back') {
      let reply = '';
      if (act === 'back') { reply = prompt('退回的原因（同學會收到飛鴿傳書）', '假卡還沒有教官室簽章') ?? null; if (reply === null) return; }
      else if (!x.cards.length && !await A.ask(`${nm(x.key)} 還沒有上傳假卡。\n確定要直接確認嗎？`, '確認')) return;
      b.disabled = true;
      try { L = await A.api('setLeaveStatus', { id: x.id, status: act === 'ok' ? '已確認' : '退回', reply }); toast(act === 'ok' ? '✓ 已確認' : '已退回，並通知同學'); } catch (err) { toast(err.message); }
      render(); return;
    }
    if (act === 'cancel') {
      if (!await A.ask(`取消這筆請假？\n${x.type}：${when(x)}`, '取消這筆', true)) return;
      try { L = await A.api('cancelLeave', { id: x.id }); toast('已取消'); } catch (err) { toast(err.message); }
      render();
    }
  });

  A.tabHooks.leave = () => { render(); if (Date.now() - lAt > 30e3) load(); };
  A.addPrefetch('leave', () => (A.isGuest() ? null : load(true)));

  // ── 測試模式：存在這台手機 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    const KEY = 'indoor.leave.v1.test', RK = 'indoor.leaverules.v1.test', CK = 'indoor.leavecard.v1.test';
    if (!['getLeave', 'addLeave', 'leaveCard', 'getLeaveCard', 'setLeaveStatus', 'cancelLeave', 'setLeaveRules'].includes(action)) return prevTest ? prevTest(action, p) : null;
    const me = A.isTeacher() ? '導師' : A.me();
    const all = store.get(KEY, []);
    const find = id => all.find(x => x.id === id);
    const t = new Date(), time = `${A.pad2(t.getMonth() + 1)}/${A.pad2(t.getDate())} ${A.fmtTime(t)}`;
    if (action === 'addLeave') { const r = p.row; all.push({ id: 'lv' + Date.now(), time, key: A.isTeacher() ? r.key : me, type: r.type, from: r.from, fromP: r.fromP, to: r.to, toP: r.toP, note: r.note || '', status: '已登記', cards: [], reply: '', by: me }); }
    if (action === 'leaveCard') { const x = find(p.id), cid = 'c' + Date.now(); store.set(CK, { ...store.get(CK, {}), [cid]: p.data }); x.cards.push(cid); x.status = '已上傳假卡'; }
    if (action === 'getLeaveCard') { const d = store.get(CK, {})[p.fid]; if (!d) throw new Error('找不到這張假卡'); return { ok: true, d }; }
    if (action === 'setLeaveStatus') { const x = find(p.id); x.status = p.status; x.reply = p.reply || ''; }
    if (action === 'cancelLeave') { const x = find(p.id); x.status = '已取消'; }
    if (action === 'setLeaveRules') store.set(RK, p.text || '');
    store.set(KEY, all);
    const monitor = !A.isTeacher() && A.jobsOf(me || '').roles.some(r => /^副?班長$/.test(String(r).trim()));
    const rows = all.filter(x => x.status !== '已取消' && (A.isTeacher() || monitor || x.key === me)).sort((a, b) => (b.from + b.fromP).localeCompare(a.from + a.fromP))
      .map(x => (monitor && x.key !== me ? { ...x, note: '', cards: [], nCards: x.cards.length, other: true } : x));
    return { ok: true, rows, me: A.isTeacher() ? '' : me, types: TYPES, rules: store.get(RK, ''), teacher: A.isTeacher(), monitor };
  };
})();
