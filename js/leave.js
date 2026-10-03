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
  let L = null, lAt = 0, view = 'todo', rulesEdit = false, totalOpen = false;
  let lvSort = store.get('indoor.leavesort', 'seat');   // 總表排序（記住在這台裝置）
  const nm = k => { const p = A.parseKey(k); return p.code ? `${p.code.replace(/(\d+)$/, ' $1')} ${p.name}` : k; };
  const today = () => A.fmtDate(new Date());
  const isT = () => A.isTeacher();
  // 排序：資料科在前、多媒科在後，同一科座號小的在前（同一個人維持原本的順序）
  const DEPT_ORDER = { 料: 0, 多: 1 };
  const rankOf = k => { const c = A.parseKey(k).code || '', m = c.match(/^(\D*)(\d+)/); return m ? [DEPT_ORDER[m[1].charAt(0)] ?? 2, Number(m[2])] : [3, 0]; };
  const byKey = (a, b) => { const x = rankOf(a), y = rankOf(b); return x[0] - y[0] || x[1] - y[1]; };

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
    L.rows.sort((a, b) => byKey(a.key, b.key));
    let h = rulesHtml();
    if (!isT()) h += formHtml();
    // 導師：總表（可以確認、退回）；班長、副班長：自己的請假＋唯讀的總表；其他同學：自己的請假
    if (!isT()) h += mineHtml();
    h += calendarHtml();
    if (isT()) h += formHtml();
    if (isT() || L.monitor) h += teacherHtml(!isT());
    h += `<div id="calZoomHost">${addD ? addHtml() : zoomHtml()}</div>`;
    root.innerHTML = h;
  }
  // 請假規則：預設收起來；導師可以編輯
  // 預設的請假規則（學校的「學生請假注意事項」）；導師在 App 裡改過就用改過的
  const DEFAULT_RULES = `學生請假注意事項

（一）學生如因病或重要事故不能上課或不能參加各種集會活動時，均須請假。
（二）學生假分事假、病假、喪假、公假、生理假等假別。
（三）本證辦理流程：註明請假時間及假別 → 家長簽章 → 導師簽章（適時檢核相關證明）→ 生輔組（學務組）簽章核准（依請假日數由學務主任或校長簽章核准）。
（四）學生應於請假日前完成請假程序，因臨時之事（病）假未能到校，須由家長（監護人）來電向導師或學務處請假，並應於返校 3 日內完成請假手續，逾期不予辦理。
（五）請假 3 日（含）以下必經導師及生活輔導組長（學務組長）核准，4 日（含）以上 7 日（含）以下必經學務主任核准，8 日以上者須經校長核准。
（六）連續病假 2 天以上時，須檢附就醫證明始得請假。
（七）公假應於請假日前完成請假手續，如有特殊原因可由師長代辦補請假事宜。
（八）校外公務以學生請假證辦理，校內公務以學生公差單辦理；另半天以內校外公務且有師長陪同可以學生公差單辦理。
（九）學生到校後，因臨時之事（病）假而必須請假者，須經班導師及生活輔導組長（學務組長）核准及辦理臨時外出單後方得離校，返校後仍須補辦請假手續。
（十）請假理由及檢附證明文件或家長簽章如有虛構偽造等情事，除缺席之時數視同曠課外，並依本校獎懲規定懲處。
（十一）學生除公假外，全學期缺課節數達修習總節數二分之一，或曠課累積達四十二節者，經提學生事務相關會議後，應依法令規定進行適性輔導及適性教育處置。
（十二）學生請假事宜以本校學生請假管制實施要點為主要依據。

註：
（一）本證為辦理請假及據以銷缺曠課時適用，銷缺曠課時請持本證至學務處辦理，註明逾期則視同未完成請假程序。
（二）本證為重要請假憑據請妥善保管，若遺失、毀損或汙損而造成相關權益受損請自行負責。
（三）請假證於上課時間及午休時間不予辦理。`;
  function rulesHtml() {
    const txt = L.rules || DEFAULT_RULES;
    let body = rulesEdit
      ? `<textarea id="lvRules" rows="8" maxlength="5000" placeholder="例如：\n1. 事假要事先請，病假回校後 3 天內補請…\n2. 假卡流程：家長簽名 → 導師簽名 → 教官室…">${esc(txt)}</textarea>
         <div class="actions"><button type="button" class="btn btn--primary" data-lv="rulesSave">儲存</button><button type="button" class="btn" data-lv="rulesCancel">取消</button></div>`
      : `<div class="lv-rules-text">${txt ? esc(txt).replace(/\n/g, '<br>') : '<span class="muted">（導師還沒填寫請假規則）</span>'}</div>${isT() ? '<button type="button" class="link-btn" data-lv="rulesEdit">✏️ 編輯請假規則</button>' : ''}`;
    return `<details class="panel lv-rules"${rulesEdit ? ' open' : ''}><summary><b>📜 請假規則</b></summary>${body}</details>`;
  }
  // pre：欄位 id 的開頭（頁面上的是 lv，浮動視窗的是 pop）；d：預設的日期（起訖都是這一天）
  function formBody(pre, d) {
    const pOpt = sel => PERIODS.map(p => `<option value="${p}"${p === sel ? ' selected' : ''}>${pName(p)}</option>`).join('');
    const day = (d || today()).replace(/\//g, '-');
    const who = isT() ? `<label class="lv-f" id="${pre}One"${lvType === '公假' ? ' hidden' : ''}><span>同學</span><select id="${pre}Key"><option value="">— 選擇同學 —</option>${A.students().slice().sort(byKey).map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}</select></label>
      <div class="lv-f lv-multi" id="${pre}Multi"${lvType === '公假' ? '' : ' hidden'}><span>同學（公假可以一次選很多位）<b id="${pre}MultiN"></b></span>
        <div class="lv-pick">${A.students().slice().sort(byKey).map(k => `<label><input type="checkbox" value="${esc(k)}" data-lvm="${pre}"> ${esc(nm(k))}</label>`).join('')}</div></div>` : '';
    return `<div class="lv-types">${TYPES.map(t => `<button type="button" data-lv="type" data-pre="${pre}" data-v="${t}" aria-pressed="${t === lvType}">${t}</button>`).join('')}</div>
      ${who}
      <div class="lv-grid">
        <label class="lv-f"><span>從</span><input type="date" id="${pre}From" value="${day}"></label>
        <label class="lv-f"><span>&nbsp;</span><select id="${pre}FromP">${pOpt(1)}</select></label>
        <label class="lv-f"><span>到</span><input type="date" id="${pre}To" value="${day}" min="${day}"></label>
        <label class="lv-f"><span>&nbsp;</span><select id="${pre}ToP">${pOpt(7)}</select></label>
      </div>
      <label class="lv-f"><span>說明（可不填）</span><input type="text" id="${pre}Note" maxlength="200" placeholder="例如：看醫生、家裡有事"></label>
      <p class="muted small">假卡流程：家長簽名 → 導師簽名 → 教官室（特殊情形再送學務處、校長室）。全部簽完後，按「📷 學生上傳假卡」。<br><b>公假</b>：填寫公差單 → 導師簽名 → 教官簽名，完成後由導師確認；公差單照片可以選擇上傳（選填）。</p>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-lv="add" data-pre="${pre}">送出請假登記</button></div>`;
  }
  // 頁面上的登記表：導師的「幫同學登記請假」放在日曆下面、預設收起來（備用；平常用日曆的 ＋）
  function formHtml() {
    return `<details class="panel lv-new"${isT() ? '' : ' open'}><summary><b>${isT() ? '➕ 幫同學登記請假' : '📝 我要請假'}</b>${isT() ? ' <span class="muted small">（備用；也可以在日曆上點日期或 ＋）</span>' : ''}</summary>
      ${formBody('lv')}</details>`;
  }
  // 浮動視窗：從日曆點某一天或 ＋ 打開
  let addD = null;
  function addHtml() {
    const title = `${Number(addD.slice(5, 7))}/${Number(addD.slice(8))}（週${wdName(addD)}）`;
    return `<div class="cal-zoom pop" data-lv="addClose"><div class="cz-box lv-addbox" data-lv="zoomBox" role="dialog" aria-label="登記 ${title} 的請假">
      <div class="cz-head"><b>📝 ${title}・${isT() ? '幫同學登記請假' : '我要請假'}</b><button type="button" class="close-btn" data-lv="addClose" aria-label="關閉">✕</button></div>
      ${formBody('pop', addD)}</div></div>`;
  }
  // 公假：線下流程不一樣（公差單），文字跟著換
  const isGong = x => x?.type === '公假';
  const docOf = x => (isGong(x) ? '公差單' : '假卡');
  const FLOW = { normal: ['APP 登記', '假卡家長簽名', '導師簽名', '其他處室簽名'], gong: ['APP 登記', '填寫公差單', '導師簽名', '教官簽名'] };
  const flowText = x => (isGong(x) ? '填寫公差單 → 導師簽名 → 教官簽名' : '家長簽名 → 導師簽名 → 教官室等處室簽核');
  // 一筆請假：進度（已登記 → 已上傳假卡 → 已確認）＋動作
  function itemHtml(x, teacher, ro) {
    // 四個步驟：APP 登記 → 家長簽名 → 導師簽名 → 其他處室簽名；上傳假卡＝紙本全部簽完（四步都完成）
    const back = x.status === '退回', idx = back || x.status === '已登記' ? 0 : 3;
    const flow = `<ol class="lv-flow">${FLOW[isGong(x) ? 'gong' : 'normal'].map((t, i) => `<li class="${i <= idx ? 'done' : i === idx + 1 ? 'next' : ''}"><span class="n">${i <= idx ? '✓' : i + 1}</span><span class="t">${t}</span></li>`).join('')}</ol>`;
    const after = x.status === '已確認' ? `<div class="lv-flow-after ok">✅ ${isGong(x) && !x.cards?.length && !x.nCards ? '導師已在 App 確認' : `${docOf(x)}已上傳，導師已在 App 確認`}</div>`
      : x.status === '已上傳假卡' ? `<div class="lv-flow-after">📷 ${docOf(x)}已上傳，等導師在 App 確認</div>`
      : isGong(x) && !back ? '<div class="lv-flow-after">公差單簽完後由導師確認；公差單照片可以選擇上傳（選填）</div>' : '';
    const steps = (back ? `<div class="lv-back">↩ 導師退回${x.reply && !x.other ? `：${esc(x.reply)}` : ''}</div>` : '') + flow + after;
    // 班長、副班長看別人的：只看得到誰、哪天、假別、進度（沒有按鈕、說明、假卡照片）
    if (ro && x.other) {
      return `<div class="lv-item${x.status === '已確認' ? ' done' : ''}${x.status === '已確認' || x.status === '已上傳假卡' ? ' filed' : ''}">
        <div class="lv-top"><span class="lv-type ${TYPE_CLS[x.type] || ''}">${esc(x.type)}</span><b>${esc(when(x))}</b><span class="lv-who">${esc(nm(x.key))}</span></div>
        <div class="lv-steps">${steps}</div>
        <div class="muted small">${periods(x)} 節${x.nCards ? `・已上傳${docOf(x)} ${x.nCards} 張` : ''}</div></div>`;
    }
    const btns = [];
    if (x.cards.length) btns.push(`<button type="button" class="btn" data-lv="cards" data-id="${esc(x.id)}">🖼 ${docOf(x)} ${x.cards.length}</button>`);
    // 順序：確認 → 上傳假卡 → 退回 → 取消 → 編輯
    if (teacher && x.status !== '已確認') btns.push(`<button type="button" class="btn btn--primary" data-lv="ok" data-id="${esc(x.id)}">✓ 導師確認</button>`);
    if (x.status !== '已確認') btns.push(`<button type="button" class="btn lv-up${!teacher && !x.cards.length && !isGong(x) ? ' btn--primary' : ''}" data-lv="upload" data-id="${esc(x.id)}">📷 ${isGong(x) ? '上傳公差單（選填）' : '學生上傳假卡'}</button>`);
    if (teacher && x.status !== '退回' && x.status !== '已確認') btns.push(`<button type="button" class="btn" data-lv="back" data-id="${esc(x.id)}">↩ 導師退回</button>`);
    if (teacher && x.status !== '已確認' && !isGong(x)) btns.push(`<button type="button" class="btn" data-lv="remind" data-id="${esc(x.id)}">📨 提醒上傳${docOf(x)}</button>`);
    if (x.status !== '已確認' || teacher) {
      btns.push(`<button type="button" class="link-btn" data-lv="cancel" data-id="${esc(x.id)}">取消</button>`);
      btns.push(`<button type="button" class="link-btn" data-lv="edit" data-id="${esc(x.id)}">✏️ 編輯</button>`);
    }
    return `<div class="lv-item${x.status === '已確認' ? ' done' : ''}${x.status === '已確認' || x.status === '已上傳假卡' ? ' filed' : ''}${isLate(x) ? ' late' : ''}">
      <div class="lv-top"><span class="lv-type ${TYPE_CLS[x.type] || ''}">${esc(x.type)}</span><b>${esc(when(x))}</b>${isLate(x) ? '<span class="lv-late-tag">⚠️ 已逾期</span>' : ''}${teacher ? `<span class="lv-who">${esc(nm(x.key))}</span>` : ''}</div>
      ${x.note ? `<div class="small">${esc(x.note)}</div>` : ''}
      <div class="lv-steps">${steps}</div>
      ${x.reply && !back ? `<div class="small muted">導師：${esc(x.reply)}</div>` : ''}
      ${btns.length ? `<div class="lv-acts"><div class="lv-acts-h">可以做的事</div><div class="lv-btns">${btns.join('')}</div></div>` : ''}
      <div class="muted small">${esc(x.time)} 由 ${esc(x.by === x.key ? '本人' : x.by)} 登記・${periods(x)} 節</div>${timerText(x)}</div>`;
  }
  // ── 公假：同一天、同一個時段（從第幾節到第幾節都一樣）的合併成一張卡片 ──
  function groupGong(list) {
    const out = [], at = {};
    list.forEach(x => {
      if (!isGong(x)) return out.push([x]);
      const k = `${x.from}|${x.fromP}|${x.to}|${x.toP}`;
      if (at[k] != null) out[at[k]].push(x); else { at[k] = out.length; out.push([x]); }
    });
    out.forEach(g => g.sort((a, b) => byKey(a.key, b.key)));
    return out;
  }
  function groupHtml(xs, teacher, ro) {
    const x0 = xs[0], ids = xs.map(x => x.id).join(','), allOk = xs.every(x => x.status === '已確認');
    const left = xs.filter(x => x.status !== '已確認');
    const mark = x => (x.status === '已確認' ? '✓ ' : x.status === '已上傳假卡' ? '📷 ' : x.status === '退回' ? '↩ ' : '');
    const notes = [...new Set(xs.map(x => x.note).filter(Boolean))];
    const flow = `<ol class="lv-flow">${FLOW.gong.map((t, i) => `<li class="${allOk || i === 0 ? 'done' : i === 1 ? 'next' : ''}"><span class="n">${allOk || i === 0 ? '✓' : i + 1}</span><span class="t">${t}</span></li>`).join('')}</ol>`;
    const nCard = xs.reduce((t, x) => t + (x.cards?.length || x.nCards || 0), 0);
    let btns = '';
    if (teacher && left.length) btns = `<div class="lv-acts"><div class="lv-acts-h">可以做的事</div><div class="lv-btns">
      <button type="button" class="btn btn--primary" data-lv="gOk" data-ids="${esc(left.map(x => x.id).join(','))}">✓ 導師確認（${left.length === xs.length ? '全部 ' : ''}${left.length} 人）</button>
      <button type="button" class="link-btn" data-lv="gCancel" data-ids="${esc(ids)}">取消全部</button></div></div>`;
    return `<div class="lv-item lv-group${allOk ? ' done filed' : ''}">
      <div class="lv-top"><span class="lv-type ${TYPE_CLS[x0.type] || ''}">${esc(x0.type)}</span><b>${esc(when(x0))}</b><span class="lv-who">${xs.length} 位同學</span></div>
      ${!ro && notes.length ? `<div class="small">${notes.map(esc).join('／')}</div>` : ''}
      <div class="lv-gnames">${xs.map(x => `<span class="lv-gn${x.status === '已確認' ? ' ok' : ''}">${mark(x)}${esc(nm(x.key))}</span>`).join('')}</div>
      <div class="lv-steps">${flow}<div class="lv-flow-after${allOk ? ' ok' : ''}">${allOk ? '✅ 導師已在 App 確認' : `已確認 ${xs.length - left.length}／${xs.length} 人・公差單照片選填${nCard ? `（已上傳 ${nCard} 張）` : ''}`}</div></div>
      ${btns}
      <details class="lv-gdet"><summary class="small">個別處理（上傳公差單、退回或取消其中一位）</summary>${xs.map(x => itemHtml(x, teacher, ro)).join('')}</details>
      <div class="muted small">${esc(x0.time)} 由 ${esc(x0.by === x0.key ? '本人' : x0.by)} 登記・每人 ${periods(x0)} 節</div></div>`;
  }
  // ── 計時：從登記請假到上傳假卡，總共花了幾天 ──
  const took = x => (x.cardT && x.t ? x.cardT - x.t : null);
  const durText = ms => (ms < 86400e3 ? `不到 1 天（${Math.max(1, Math.round(ms / 3600e3))} 小時）` : `${(ms / 86400e3).toFixed(1)} 天`);
  const LATE_DAYS = 3, LATE_PER = 0.1;
  const pending = x => x.t && !x.cardT && !isGong(x) && (x.status === '已登記' || x.status === '退回');   // 公假的公差單是選填，不計時、不扣分
  const isLate = x => pending(x) && Date.now() - x.t >= LATE_DAYS * 864e5;
  // 逾期天數（登記滿 3 天之後，每一天、不滿一天算一天；上傳假卡就停止）
  const lateDays = x => { const stop = x.cardT || (pending(x) ? Date.now() : 0); return stop ? Math.max(0, Math.ceil((stop - x.t - LATE_DAYS * 864e5) / 864e5)) : 0; };
  const lateMinus = d => Math.round(d * LATE_PER * 100) / 100;
  function timerText(x) {
    const d = x.t ? lateDays(x) : 0;
    if (took(x) != null) return `<div class="lv-took${took(x) >= 3 * 86400e3 ? ' slow' : ''}">⏱ 登記到上傳${docOf(x)}花了 ${durText(took(x))}${d ? `（超過 ${LATE_DAYS} 天，扣 ${lateMinus(d)} 分）` : ''}</div>`;
    if (isLate(x)) return `<div class="lv-took slow">⚠️ 已逾期！登記後已經過了 ${durText(Date.now() - x.t)}，還沒上傳${docOf(x)}（逾期 ${d} 天，已扣 ${lateMinus(d)} 分，上傳就停止）</div>`;
    if (pending(x)) return `<div class="lv-took">⏱ 登記後已經過了 ${durText(Date.now() - x.t)}，還沒上傳${docOf(x)}（滿 ${LATE_DAYS} 天開始每天扣 ${LATE_PER} 分）</div>`;
    return '';
  }
  // 這位同學上一次（不算 exceptId 這一筆）從登記到上傳假卡花了多久
  const lastTook = (key, exceptId) => (L?.rows || []).filter(x => x.key === key && x.id !== exceptId && took(x) != null).sort((a, b) => b.cardT - a.cardT)[0];
  // 警示畫面：上一次花了多久，請注意
  function warn(prev, intro, okText, cancel) {
    return new Promise(res => {
      const w = document.createElement('div');
      w.className = 'lv-warn';
      w.innerHTML = `<div class="lv-warn-card" role="alertdialog"><div class="lv-warn-ico">⚠️</div><h3>請注意請假手續的時間</h3>
        <p>${intro}</p><p>你上一次請假（${esc(prev.type)}，${esc(when(prev))}）<br>從登記到上傳${docOf(prev)}，總共花了 <b>${durText(took(prev))}</b>。</p>
        <p class="muted small">請盡快完成：家長簽名 → 導師簽名 → 教官室等處室簽核 → 在 App 上傳假卡照片。</p>
        <div class="actions">${cancel ? '<button type="button" class="btn" data-w="no">取消</button>' : ''}<button type="button" class="btn btn--primary wide" data-w="ok">${okText}</button></div></div>`;
      document.body.appendChild(w);
      w.addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (!b) return; w.remove(); res(b.dataset.w === 'ok'); });
    });
  }
  // 打開 App：導師（或別人）幫我登記了請假，而我上一次有花多久的紀錄 → 顯示警示畫面（每筆只提醒一次）
  A.on('start', async () => {
    if (A.isGuest() || A.isTeacher() || !A.me()) return;
    await Promise.race([A.mailDone || Promise.resolve(), new Promise(r => setTimeout(r, 60e3))]);
    await new Promise(r => setTimeout(r, 1500));
    if (!L) await load(true);
    const me = A.me(), seen = store.get('indoor.leave.warned', []);
    const x = (L?.rows || []).find(r => r.key === me && r.by !== me && (r.status === '已登記' || r.status === '退回') && !seen.includes(r.id));
    const prev = x && lastTook(me, x.id);
    if (!prev) return;
    for (let i = 0; i < 40 && (A.sheetMode() || !($('#giftFx')?.hidden ?? true) || !($('#waitWin')?.hidden ?? true)); i++) await new Promise(r => setTimeout(r, 1000));
    store.set('indoor.leave.warned', [...seen, x.id].slice(-50));
    await warn(prev, `${esc(x.by === (A.D.teacherLabel || '導師') ? '導師' : nm(x.by))} 幫你登記了請假：${esc(x.type)} ${esc(when(x))}。`, '我知道了');
  });
  function mineHtml() {
    const rows = L.rows.filter(x => !x.other && (!L.me || x.key === L.me));
    return `<div class="panel"><h3>我的請假</h3>${rows.length ? rows.map(x => itemHtml(x, false)).join('') : '<p class="muted small">還沒有請假紀錄。</p>'}</div>`;
  }

  // ── 月曆：這個月每一天誰請了什麼假（點名字看那天是第幾節到第幾節）──
  let calMonth = '';
  const ymdStr = d => `${d.getFullYear()}/${A.pad2(d.getMonth() + 1)}/${A.pad2(d.getDate())}`;
  // 某一筆請假在某一天請的節次
  function dayRange(x, d) {
    if (d < x.from || d > x.to) return null;
    const a = d === x.from ? x.fromP : 1, b = d === x.to ? x.toP : 7;
    return { a, b, all: a <= 1 && b >= 7 };
  }
  // 第 1～7 節橫向切成 7 格，請假的節塗滿（早自習算在第 1 節前面，不另外畫）
  const ppBar = r => `<span class="cal-pp" aria-label="${rangeText(r)}">${[1, 2, 3, 4, 5, 6, 7].map(p => `<i class="${p >= Math.max(1, r.a) && p <= r.b ? 'on' : ''}"></i>`).join('')}</span>`;
  const ppBig = r => `<span class="cz-pp" aria-label="${rangeText(r)}">${[1, 2, 3, 4, 5, 6, 7].map(p => `<i class="${p >= Math.max(1, r.a) && p <= r.b ? 'on' : ''}">${p}</i>`).join('')}</span>`;
  const rangeText = r => (r.all ? '全天' : r.a === r.b ? pName(r.a) : `${pName(r.a)}～${pName(r.b)}`);
  const canAdd = () => !A.isGuest() && (isT() || !!A.me());
  // 從行事曆登記：打開「幫同學登記請假／我要請假」，起訖日期都預設那一天
  function addOn(d) {
    zoom = null; addD = d; paintZoom();
    setTimeout(() => (isT() && lvType !== '公假' ? $('#popKey') : null)?.focus(), 50);
  }
  function calendarHtml() {
    calMonth ||= today().slice(0, 7);
    const [y, m] = calMonth.split('/').map(Number);
    const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate(), lead = first.getDay();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="cal-cell empty"></div>');
    const td = today();
    for (let dd = 1; dd <= days; dd++) {
      const d = ymdStr(new Date(y, m - 1, dd)), wd = new Date(y, m - 1, dd).getDay();
      const on = L.rows.filter(x => dayRange(x, d));
      cells.push(`<div class="cal-cell${d === td ? ' today' : ''}${wd % 6 === 0 ? ' wkend' : ''}${on.length ? ' has' : canAdd() ? ' addable' : ''}"${on.length ? ` data-lv="calDay" data-d="${d}" role="button" tabindex="0" aria-label="${m}月${dd}日 ${on.length} 人請假"` : canAdd() ? ` data-lv="calAdd" data-d="${d}" role="button" tabindex="0" aria-label="登記 ${m}月${dd}日 的請假"` : ''}><span class="cal-d">${dd}</span>
        ${on.map(x => `<span class="cal-nm ${deptCls(x.key)} ${TYPE_CLS[x.type] || ''}">${esc(A.parseKey(x.key).name || x.key)}${ppBar(dayRange(x, d))}</span>`).join('')}</div>`);
    }
    return `<div class="panel lv-cal"><div class="cal-head"><button type="button" class="btn" data-lv="calPrev" aria-label="上個月">‹</button>
        <b>📅 ${y} 年 ${m} 月</b><button type="button" class="btn" data-lv="calNext" aria-label="下個月">›</button></div>
      <div class="cal-grid">${'日一二三四五六'.split('').map(w => `<div class="cal-w">${w}</div>`).join('')}${cells.join('')}</div>
      <div class="cal-legend"><span class="cal-nm dp-data">資料科</span><span class="cal-nm dp-mm">多媒科</span><span class="muted small">名字下方 7 格＝第 1～7 節（亮的是請假的節）；左邊色條＝假別：</span>${TYPES.map(t => `<span class="cal-tl ${TYPE_CLS[t]}">${t}</span>`).join('')}</div>
      <p class="muted small">點一下日期，會放大那一天，再點名字看詳細。</p></div>`;
  }
  // 科別底色：料＝資料科（洋紅）、多＝多媒科（深藍）
  const deptCls = k => ({ 料: 'dp-data', 多: 'dp-mm' }[(A.parseKey(k).code || '').charAt(0)] || '');
  // ── 放大的一天（畫面中間）：大大的名字，點名字看詳細 ──
  let zoom = null;   // { d, id }
  const wdName = d => '日一二三四五六'[new Date(d.replace(/\//g, '-') + 'T12:00').getDay()];
  function zoomHtml() {
    if (!zoom || !L) return '';
    const d = zoom.d, on = L.rows.filter(x => dayRange(x, d));
    const x = zoom.id && on.find(r => r.id === zoom.id);
    const title = `${Number(d.slice(5, 7))}/${Number(d.slice(8))}（週${wdName(d)}）`;
    let body;
    if (x) {
      const r = dayRange(x, d);
      const full = isT() ? itemHtml(x, true) : L.monitor ? itemHtml(x, false, true) : itemHtml(x, false);
      body = `<div class="cz-who ${deptCls(x.key)} ${TYPE_CLS[x.type] || ''}"><b>${esc(nm(x.key))}</b><span>${esc(x.type)}・這一天 ${rangeText(r)}</span>${ppBig(r)}</div>${full}`;
    } else {
      body = on.length ? `<div class="cz-list">${on.map(y => `<button type="button" class="cz-nm ${deptCls(y.key)} ${TYPE_CLS[y.type] || ''}" data-lv="zoomItem" data-id="${esc(y.id)}">
          <b>${esc(A.parseKey(y.key).name || y.key)}</b><span>${esc(A.parseKey(y.key).code || '')}・${esc(y.type)}・${rangeText(dayRange(y, d))}</span>${ppBig(dayRange(y, d))}</button>`).join('')}</div>`
        : '<p class="muted">這一天沒有人請假。</p>';
    }
    return `<div class="cal-zoom${zoom.pop ? ' pop' : ''}" data-lv="zoomClose"><div class="cz-box" data-lv="zoomBox" role="dialog" aria-label="${title} 請假">
      <div class="cz-head">${x ? '<button type="button" class="btn" data-lv="zoomBack" aria-label="回到名單">‹</button>' : ''}<b>📅 ${title}${x ? '' : `・${on.length} 人請假`}</b>${canAdd() ? `<button type="button" class="cz-add" data-lv="calAdd" data-d="${d}" aria-label="登記 ${title} 的請假" title="登記這一天的請假">＋</button>` : ''}<button type="button" class="close-btn" data-lv="zoomClose" aria-label="關閉">✕</button></div>
      ${body}</div></div>`;
  }
  function paintZoom() {
    const host = $('#calZoomHost');
    if (host) host.innerHTML = addD ? addHtml() : zoomHtml();
    document.body.style.overflow = zoom || addD ? 'hidden' : '';
  }
  // ── 編輯（假別、日期、節次、說明）──
  function openEdit(x) {
    const pOpt = sel => PERIODS.map(p => `<option value="${p}"${p === sel ? ' selected' : ''}>${pName(p)}</option>`).join('');
    let h = A.sheetHead('✏️ 修改請假', isT() ? nm(x.key) : '');
    h += `<div class="lv-types" id="edTypes">${TYPES.map(t => `<button type="button" data-act="edType" data-v="${t}" aria-pressed="${t === x.type}">${t}</button>`).join('')}</div>
      <div class="lv-grid">
        <label class="lv-f"><span>從</span><input type="date" id="edFrom" value="${x.from.replace(/\//g, '-')}"></label>
        <label class="lv-f"><span>&nbsp;</span><select id="edFromP">${pOpt(x.fromP)}</select></label>
        <label class="lv-f"><span>到</span><input type="date" id="edTo" value="${x.to.replace(/\//g, '-')}" min="${x.from.replace(/\//g, '-')}"></label>
        <label class="lv-f"><span>&nbsp;</span><select id="edToP">${pOpt(x.toP)}</select></label>
      </div>
      <label class="lv-f"><span>說明</span><input type="text" id="edNote" maxlength="200" value="${esc(x.note || '')}"></label>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="edSave" data-id="${esc(x.id)}">儲存修改</button></div>`;
    A.openSheet({ kind: 'leaveEdit' }, h);
  }
  A.sheetHandlers.leaveEdit = async (act, b) => {
    if (act === 'edType') { b.parentElement.querySelectorAll('button').forEach(y => y.setAttribute('aria-pressed', y === b)); return; }
    if (act !== 'edSave') return;
    const row = { type: $('#edTypes [aria-pressed="true"]')?.dataset.v, from: $('#edFrom').value.replace(/-/g, '/'), fromP: Number($('#edFromP').value), to: $('#edTo').value.replace(/-/g, '/'), toP: Number($('#edToP').value), note: $('#edNote').value.trim() };
    if (!row.from || !row.to) return toast('請選擇日期');
    if (row.to < row.from || (row.to === row.from && row.toP < row.fromP)) return toast('結束的時間要在開始之後');
    b.disabled = true;
    try { L = await A.api('editLeave', { id: b.dataset.id, row }); A.closeSheet(); toast('✓ 已修改'); render(); } catch (err) { toast(err.message); b.disabled = false; }
  };
  // 導師總表：篩選（待處理／本月／全部）＋每個人的統計
  function teacherHtml(ro) {
    const month = today().slice(0, 7);
    const pick = { todo: x => x.status !== '已確認', late: x => isLate(x), month: x => x.from.slice(0, 7) === month || x.to.slice(0, 7) === month, all: () => true };
    const list = L.rows.filter(pick[view]);
    // 排序：依座號（預設，資料科在前）／依請假的日期（新→舊、舊→新）
    const when0 = x => `${x.from}${x.fromP}`;
    if (lvSort === 'new') list.sort((a, b) => when0(b).localeCompare(when0(a)) || byKey(a.key, b.key));
    if (lvSort === 'old') list.sort((a, b) => when0(a).localeCompare(when0(b)) || byKey(a.key, b.key));
    const tab = (v, t, n) => `<button type="button" data-lv="view" data-v="${v}" aria-pressed="${view === v}">${t}${n != null ? ` <span class="lv-n">${n}</span>` : ''}</button>`;
    const sortBtns = `<div class="lv-sort"><span class="muted small">排序</span>${[['seat', '依座號'], ['new', '時間：新→舊'], ['old', '時間：舊→新']].map(([v, t]) => `<button type="button" data-lv="sort" data-v="${v}" aria-pressed="${lvSort === v}">${t}</button>`).join('')}</div>`;
    const todo = L.rows.filter(pick.todo).length;
    let h = `<details class="panel lv-total"${totalOpen ? ' open' : ''}><summary><b>📋 請假總表</b>${todo ? ` <span class="lv-n">待處理 ${todo}</span>` : ''}</summary>
      ${ro ? '<p class="muted small">班長、副班長可以看；說明和假卡只有導師看得到。</p>' : ''}
      <div class="lv-views">${tab('todo', '待處理', todo)}${L.rows.some(isLate) ? tab('late', '⚠️ 逾期未交假卡', L.rows.filter(isLate).length) : ''}${tab('month', '本月')}${tab('all', '全部')}</div>
      ${sortBtns}
      ${list.length ? groupGong(list).map(g => (g.length > 1 ? groupHtml(g, !ro, ro) : itemHtml(g[0], !ro, ro))).join('') : `<p class="muted small">${view === 'todo' ? '沒有待處理的請假 🎉' : '沒有紀錄。'}</p>`}</details>`;
    // 統計：每位同學各假別的節數（已取消的不算）
    const stat = {};
    L.rows.forEach(x => { const s = (stat[x.key] ||= {}); s[x.type] = (s[x.type] || 0) + periods(x); });
    const keys = Object.keys(stat).sort(byKey);
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
    const doc = docOf(L.rows.find(r => r.id === id));
    const done = A.waitFor?.('', { msg: `請稍等，正在上傳${doc}`, work: true });
    try { for (const f of files.slice(0, 3)) L = await A.api('leaveCard', { id, data: await shrink(f) }); toast(`✓ ${doc}已上傳，等導師確認`); } catch (err) { toast(err.message); }
    done?.();
    render();
  }
  const cardCache = {};
  // 可以刪假卡：導師隨時；同學在導師確認前可以刪自己的
  const canDelCard = x => isT() || (x.key === L.me && x.status !== '已確認');
  async function openCards(x) {
    let h = A.sheetHead(`🖼 ${docOf(x)}`, `${nm(x.key)}｜${x.type}｜${when(x)}`);
    const del = fid => (canDelCard(x) ? `<button type="button" class="btn btn--danger lv-delcard" data-act="lvDelCard" data-id="${esc(x.id)}" data-fid="${esc(fid)}">🗑 刪除這張</button>` : '');
    h += `<div class="rcpt-view">${x.cards.map((fid, i) => `<div class="lv-card-box"><figure data-fid="${esc(fid)}">${cardCache[fid] ? `<img src="${cardCache[fid]}" alt="假卡">` : '<p class="muted">讀取中…</p>'}</figure><div class="lv-card-bar"><span class="muted small">第 ${i + 1} 張</span>${del(fid)}</div></div>`).join('')}</div>`;
    if (canDelCard(x)) h += `<p class="muted small">傳錯了可以刪掉，再按「📷 學生上傳${docOf(x)}」重新上傳（刪掉的照片還會留在導師的雲端硬碟裡）。</p>`;
    A.openSheet({ kind: 'leaveCards' }, h);
    for (const fid of x.cards) {
      if (!cardCache[fid]) { try { cardCache[fid] = (await A.api('getLeaveCard', { fid })).d; } catch (err) { cardCache[fid] = ''; toast(err.message); } }
      const fig = document.querySelector(`.rcpt-view [data-fid="${CSS.escape(fid)}"]`);
      if (fig) fig.innerHTML = cardCache[fid] ? `<img src="${cardCache[fid]}" alt="假卡">` : '<p class="muted">讀不到這張假卡</p>';
    }
  }

  A.sheetHandlers.leaveCards = async (act, b) => {
    if (act !== 'lvDelCard') return;
    if (!await A.ask('刪除這張假卡照片？\n刪掉之後可以再重新上傳。', '刪除', true)) return;
    b.disabled = true;
    try {
      L = await A.api('delLeaveCard', { id: b.dataset.id, fid: b.dataset.fid });
      toast('已刪除這張假卡');
      const x = L.rows.find(r => r.id === b.dataset.id);
      if (x?.cards.length) openCards(x); else A.closeSheet();
    } catch (err) { toast(err.message); b.disabled = false; }
    render();
  };
  let lvType = TYPES[0];
  $('#leaveRoot').addEventListener('click', async e => {
    const b = e.target.closest('[data-lv]');
    if (!b || b.disabled) return;
    const act = b.dataset.lv, x = L?.rows.find(r => r.id === b.dataset.id);
    if (act === 'zoomBox') return;
    if (act === 'gOk' || act === 'gCancel') {   // 合併的公假：一次確認／取消全部
      const ids = b.dataset.ids.split(',').filter(Boolean), who = ids.map(id => nm(L.rows.find(r => r.id === id)?.key || '')).join('、');
      if (!await A.ask(act === 'gOk' ? `確認這 ${ids.length} 位同學的公假？\n${who}\n（每位同學會收到飛鴿傳書）` : `取消這 ${ids.length} 位同學的公假？\n${who}`, act === 'gOk' ? '全部確認' : '全部取消', act === 'gCancel')) return;
      b.disabled = true;
      try { L = await A.api(act === 'gOk' ? 'setLeaveStatus' : 'cancelLeave', { ids, status: '已確認', reply: '' }); toast(act === 'gOk' ? `✓ 已確認 ${ids.length} 位` : `已取消 ${ids.length} 位`); } catch (err) { toast(err.message); b.disabled = false; return; }
      render(); return;
    }
    if (act === 'calAdd') { e.stopPropagation(); return addOn(b.dataset.d); }
    if (act === 'addClose') { addD = null; paintZoom(); return; }
    if (act === 'calDay') { zoom = { d: b.dataset.d, id: null, pop: true }; paintZoom(); zoom.pop = false; return; }
    if (act === 'zoomClose') { zoom = null; paintZoom(); return; }
    if (act === 'zoomBack') { zoom.id = null; paintZoom(); return; }
    if (act === 'zoomItem') { zoom.id = b.dataset.id; paintZoom(); return; }
    if (act === 'type') {
      lvType = b.dataset.v; b.parentElement.querySelectorAll('button').forEach(y => y.setAttribute('aria-pressed', y === b));
      const pre = b.dataset.pre || 'lv';
      if ($(`#${pre}One`)) { $(`#${pre}One`).hidden = lvType === '公假'; $(`#${pre}Multi`).hidden = lvType !== '公假'; }   // 公假：可以一次選很多位同學
      return;
    }
    if (act === 'view') { view = b.dataset.v; render(); return; }
    if (act === 'sort') { lvSort = b.dataset.v; store.set('indoor.leavesort', lvSort); render(); return; }
    if (act === 'calPrev' || act === 'calNext') {
      const [y, m] = calMonth.split('/').map(Number), d = new Date(y, m - 1 + (act === 'calNext' ? 1 : -1), 1);
      calMonth = `${d.getFullYear()}/${A.pad2(d.getMonth() + 1)}`; render(); return;
    }
    if (act === 'rulesEdit') { rulesEdit = true; render(); return; }
    if (act === 'rulesCancel') { rulesEdit = false; render(); return; }
    if (act === 'rulesSave') {
      b.disabled = true;
      try { L = await A.api('setLeaveRules', { text: $('#lvRules').value }); rulesEdit = false; toast('✓ 已儲存請假規則'); } catch (err) { toast(err.message); b.disabled = false; return; }
      render(); return;
    }
    if (act === 'add') {
      const pre = b.dataset.pre || 'lv', f = id => $(`#${pre}${id}`);
      const row = { type: lvType, from: f('From').value.replace(/-/g, '/'), fromP: Number(f('FromP').value), to: f('To').value.replace(/-/g, '/'), toP: Number(f('ToP').value), note: f('Note').value.trim() };
      if (isT() && lvType === '公假') { row.keys = [...document.querySelectorAll(`[data-lvm="${pre}"]:checked`)].map(c => c.value); if (!row.keys.length) return toast('請勾選同學'); }
      else if (isT()) { row.key = f('Key').value; if (!row.key) return toast('請選擇同學'); }
      if (!row.from || !row.to) return toast('請選擇日期');
      if (row.to < row.from || (row.to === row.from && row.toP < row.fromP)) return toast('結束的時間要在開始之後');
      const text = `${row.keys ? `${row.keys.length} 位同學：${row.keys.map(nm).join('、')}\n` : isT() ? nm(row.key) + '\n' : ''}${row.type}：${when(row)}${row.note ? '\n' + row.note : ''}`;
      // 同學自己登記：上一次手續花了多久，先跳出警示畫面
      const prev = !isT() && lastTook(L.me);
      if (prev && !await warn(prev, '送出這次的請假登記前，先看一下：', '我知道了，繼續登記', true)) return;
      if (!await A.ask(`送出請假登記？\n${text}`, '送出')) return;
      b.disabled = true;
      try { L = await A.api('addLeave', { row }); toast(row.keys ? `✓ 已幫 ${row.keys.length} 位同學登記公假，也通知他們了` : isT() ? '✓ 已幫同學登記，也通知他了' : row.type === '公假' ? '✓ 已登記，也通知導師了。記得填寫公差單、請導師和教官簽名（公差單照片可以選擇上傳）' : '✓ 已登記，也通知導師了。記得跑完假卡流程後上傳假卡'); } catch (err) { toast(err.message); b.disabled = false; return; }
      if (pre === 'pop') { addD = null; document.body.style.overflow = ''; }
      render(); return;
    }
    if (!x) return;
    if (act === 'cards') return openCards(x);
    if (act === 'edit') return openEdit(x);
    if (act === 'upload') { upId = x.id; fileInput().click(); return; }
    if (act === 'remind') {
      if (!await A.ask(`發飛鴿傳書提醒 ${nm(x.key)}：\n${flowText(x)}之後，上傳簽好的${docOf(x)}照片？`, '發送提醒')) return;
      b.disabled = true;
      try { await A.api('remindLeaveCard', { id: x.id }); toast(`📨 已提醒 ${nm(x.key)} 上傳${docOf(x)}`); } catch (err) { toast(err.message); }
      b.disabled = false; return;
    }
    if (act === 'ok' || act === 'back') {
      let reply = '';
      if (act === 'back') { reply = prompt('退回的原因（同學會收到飛鴿傳書）', isGong(x) ? '公差單還沒有教官簽名' : '假卡還沒有教官室簽章') ?? null; if (reply === null) return; }
      else if (!x.cards.length && !isGong(x) && !await A.ask(`${nm(x.key)} 還沒有上傳${docOf(x)}。\n確定要直接確認嗎？`, '確認')) return;
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

  $('#leaveRoot').addEventListener('toggle', e => { if (e.target.classList?.contains('lv-total')) totalOpen = e.target.open; }, true);
  $('#leaveRoot').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.lv === 'calDay') { e.preventDefault(); e.target.click(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && zoom) { zoom = null; paintZoom(); } });
  // 選了「從」的日期：「到」至少要從同一天開始（早於的話自動改成同一天）
  document.addEventListener('change', e => {
    if (e.target.matches?.('[data-lvm]')) { const pre = e.target.dataset.lvm, n = document.querySelectorAll(`[data-lvm="${pre}"]:checked`).length; const o = $(`#${pre}MultiN`); if (o) o.textContent = n ? `已選 ${n} 位` : ''; }
    const to = { lvFrom: 'lvTo', popFrom: 'popTo', edFrom: 'edTo' }[e.target.id];
    if (!to || !e.target.value) return;
    const t = document.getElementById(to);
    if (!t) return;
    t.min = e.target.value;
    if (!t.value || t.value < e.target.value) t.value = e.target.value;
  });
  A.tabHooks.leave = () => { render(); if (Date.now() - lAt > 30e3) load(); };
  A.addPrefetch('leave', () => (A.isGuest() ? null : load(true)));

  // ── 測試模式：存在這台手機 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    const KEY = 'indoor.leave.v1.test', RK = 'indoor.leaverules.v1.test', CK = 'indoor.leavecard.v1.test';
    if (!['getLeave', 'addLeave', 'editLeave', 'leaveCard', 'getLeaveCard', 'delLeaveCard', 'setLeaveStatus', 'cancelLeave', 'setLeaveRules'].includes(action)) return prevTest ? prevTest(action, p) : null;
    const me = A.isTeacher() ? '導師' : A.me();
    const all = store.get(KEY, []);
    const find = id => all.find(x => x.id === id);
    const t = new Date(), time = `${A.pad2(t.getMonth() + 1)}/${A.pad2(t.getDate())} ${A.fmtTime(t)}`;
    if (action === 'addLeave') { const r = p.row; (A.isTeacher() && r.keys ? r.keys : [A.isTeacher() ? r.key : me]).forEach((k, i) => all.push({ id: 'lv' + Date.now() + i, time, t: Date.now(), cardT: 0, key: k, type: r.type, from: r.from, fromP: r.fromP, to: r.to, toP: r.toP, note: r.note || '', status: '已登記', cards: [], reply: '', by: me })); }
    if (action === 'leaveCard') { const x = find(p.id), cid = 'c' + Date.now(); store.set(CK, { ...store.get(CK, {}), [cid]: p.data }); x.cards.push(cid); x.status = '已上傳假卡'; x.cardT ||= Date.now(); }
    if (action === 'getLeaveCard') { const d = store.get(CK, {})[p.fid]; if (!d) throw new Error('找不到這張假卡'); return { ok: true, d }; }
    if (action === 'setLeaveStatus') (p.ids || [p.id]).forEach(id => { const x = find(id); x.status = p.status; x.reply = p.reply || ''; });
    if (action === 'delLeaveCard') { const x = find(p.id); x.cards = x.cards.filter(c => c !== p.fid); if (!x.cards.length && x.status === '已上傳假卡') x.status = '已登記'; }
    if (action === 'cancelLeave') (p.ids || [p.id]).forEach(id => { find(id).status = '已取消'; });
    if (action === 'editLeave') { const x = find(p.id); Object.assign(x, { type: p.row.type, from: p.row.from, fromP: p.row.fromP, to: p.row.to, toP: p.row.toP, note: p.row.note || '' }); }
    if (action === 'setLeaveRules') store.set(RK, p.text || '');
    store.set(KEY, all);
    const monitor = !A.isTeacher() && A.jobsOf(me || '').roles.some(r => /^副?班長$/.test(String(r).trim()));
    const rows = all.filter(x => x.status !== '已取消' && (A.isTeacher() || monitor || x.key === me)).sort((a, b) => (b.from + b.fromP).localeCompare(a.from + a.fromP))
      .map(x => (monitor && x.key !== me ? { ...x, note: '', cards: [], nCards: x.cards.length, other: true } : x));
    return { ok: true, rows, me: A.isTeacher() ? '' : me, types: TYPES, rules: store.get(RK, ''), teacher: A.isTeacher(), monitor };
  };
})();
