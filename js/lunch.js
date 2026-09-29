'use strict';
/* 🍱 訂便當：每週一～週五中午 12 點登記「下週」要不要訂；總務勾選繳費；大家都看得到名單 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  let L = null;

  const canChoose = () => !A.isGuest() && (A.isTeacher() || !!A.me());   // 導師也可以訂（預設「要」）
  const nm = k => { if (k === (A.D.teacherLabel || '導師')) return k; const p = A.parseKey(k); return `${p.code.replace(/(\d+)$/, ' $1')} ${p.name}`; };

  let lAt = 0;
  async function load(quiet) {
    try { L = await A.api('getLunch'); lAt = Date.now(); } catch (e) { if (!quiet) toast('便當資料讀取失敗：' + e.message); }
    if (!quiet || A.currentTab() === 'lunch') render();
  }
  // ── 便當卡片：一週裡現在在哪個階段（開放登記 → 週五 12:00 截止 → 放學前繳費 → 已截止）＋我的登記 ──
  function timeline(mine) {
    const now = new Date(), dow = now.getDay() || 7;
    const x = (dow - 1) + (now.getHours() + now.getMinutes() / 60) / 24;   // 週一 0:00＝0，週日 24:00＝7
    const P = v => (v / 7 * 100).toFixed(2) + '%';
    const cd = (L.cut || 5) - 1;                                           // 截止那天（週五，或提前）
    const CUT = cd + 12 / 24, PAY = cd + 17 / 24;                         // 中午 12:00 截止、17:00 放學
    const stage = L.skip ? 'lock' : !L.locked ? 'open' : x < PAY ? 'pay' : 'lock';
    const left = CUT - x, lh = Math.max(0, Math.floor(left * 24));
    const leftTxt = lh >= 24 ? `還有 ${Math.floor(lh / 24)} 天 ${lh % 24} 小時` : `還有 ${lh} 小時`;
    const choice = mine?.choice;
    const tag = { open: ['開放登記中', 'ok'], pay: ['繳費時間', 'pay'], lock: ['已截止', 'lock'] }[stage];
    const sub = L.skip ? '這次不訂便當・下週一 00:00 開放新的登記' : stage === 'open' ? `${L.cutText || '週五 12:00'} 截止・${leftTxt}` : stage === 'pay' ? '名單已確定・今天放學前繳費' : '名單已確定・下週一 00:00 開放新的登記';
    // 我的狀態＋要訂／不訂（導師不用登記）
    let me = '';
    if (canChoose() && !L.skip) {
      const st = choice ? `<b class="${choice === '要' ? 'ok-t' : ''}">${choice === '要' ? '要訂' : '不訂'}</b>${mine.auto ? '<span class="muted small">（預設）</span>' : mine.time ? `<span class="muted small">（${esc(mine.time)}）</span>` : ''}`
        : '<b class="no-t">還沒登記</b>';
      const paid = choice === '要' ? (mine.paid ? '<span class="tag good">已繳費</span>' : '<span class="tag">還沒繳費</span>') : '';
      me = `<div class="lc-me">你：${st} ${paid}</div>
        <div class="lunch-pick">
          <button type="button" class="btn${choice === '要' ? ' btn--primary' : ''}" data-l="要"${L.locked ? ' disabled' : ''}>🍱 要訂</button>
          <button type="button" class="btn${choice === '不要' ? ' btn--primary' : ''}" data-l="不要"${L.locked ? ' disabled' : ''}>🙅 不訂</button></div>`;
    }
    return `<div class="panel lunch-card">
      <div class="lc-head"><b>🍱 ${esc(L.meal)} 便當</b><span class="lc-tag ${tag[1]}">${L.skip ? '這次不訂' : tag[0]}</span></div>
      <div class="muted small lc-sub">${sub}</div>
      <div class="lt-bar">
        <span class="lt-seg open" style="left:0;width:${P(CUT)}"></span>
        <span class="lt-seg pay" style="left:${P(CUT)};width:${P(PAY - CUT)}"></span>
        <span class="lt-seg lock" style="left:${P(PAY)};width:${P(7 - PAY)}"></span>
        <span class="lt-now" style="left:${P(Math.min(7, Math.max(0, x)))}" title="現在"></span>
      </div>
      <div class="lc-legend"><span style="width:${P(CUT)}">登記（週一～${(L.cutText || '週五 12:00').slice(1)}）</span><span class="pay-t">繳費</span><span class="lc-end">截止</span></div>
      ${me ? `<div class="lc-line"></div>${me}` : ''}
      <div class="muted small lc-foot">有訂的人：${(L.cutText || '週五').slice(0, 2)}放學前把便當費交給總務，逾時未交會取消訂餐。</div>
    </div>`;
  }
  // ── 彈性調整（導師、總務、班長、副班長）：提前結束登記、訂幾天（超過 5 天＝連下下週一起訂）──
  const CUT_NAME = ['週五', '週四', '週三', '週二', '週一'];
  function nthDay(ymd, n) {   // 從 ymd 開始第 n 個上課日
    const d = new Date(ymd.replace(/\//g, '-') + 'T12:00');
    for (let c = 0, i = 0; i < 40; i++, d.setDate(d.getDate() + 1)) if (d.getDay() % 6 && ++c >= n) break;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  function adjHtml() {
    if (!L.canAdj || !L.start) return '';
    const s = nthDay(L.start, 1);
    const eOpt = [0, 1, 2, 3, 4].map(e => `<option value="${e}"${e === L.early ? ' selected' : ''}>${e ? `提前 ${e} 天（${CUT_NAME[e]} 12:00 截止）` : '不提前（週五 12:00 截止）'}</option>`).join('');
    const dOpt = Array.from({ length: (L.maxDays || 10) + 1 }, (_, n) => `<option value="${n}"${n === L.days ? ' selected' : ''}>${n === 0 ? '這次不訂便當' : `${n} 天（${s}${n > 1 ? '～' + nthDay(L.start, n) : ''}）`}${n === L.defDays ? '・預設' : ''}${n > L.defDays && n > 0 ? '・連下下週' : ''}</option>`).join('');
    return `<details class="panel lunch-adj"${adjOpen ? ' open' : ''}><summary><b>⚙️ 調整便當時間</b>${L.early || L.days !== L.defDays ? ' <span class="tag">已調整</span>' : ''} <span class="muted small">導師、總務、班長、副班長</span></summary>
      <p class="muted small">遇到放假時可以提前結束登記，或多訂幾天（例如連下下週一起訂）。${L.overlap ? `上次已經多訂到這一週，所以這次從 ${s} 開始。` : ''}</p>
      <label class="lv-f"><span>什麼時候結束登記？</span><select id="lcEarly">${eOpt}</select></label>
      <label class="lv-f"><span>要訂幾天？（從 ${s} 開始算上課日）</span><select id="lcDays">${dOpt}</select></label>
      ${L.adjBy ? `<p class="muted small">上次調整：${esc(nm(L.adjBy))}（${esc(L.adjTime)}）</p>` : ''}
      <div class="actions"><button type="button" class="btn btn--primary wide" data-l="adj">儲存調整（會通知全班）</button></div></details>`;
  }
  let adjOpen = false;
  $('#lunchRoot').addEventListener('toggle', e => { if (e.target.classList?.contains('lunch-adj')) adjOpen = e.target.open; }, true);
  function render() {
    const root = $('#lunchRoot');
    if (!L) { root.innerHTML = `<div class="panel"><p class="muted">讀取中…</p></div>`; return; }
    const yes = L.rows.filter(r => r.choice === '要'), no = L.rows.filter(r => r.choice === '不要'), none = L.rows.filter(r => !r.choice);
    const mine = L.rows.find(r => r.key === L.me);
    // 一張卡片：標題＋狀態、時間軸、我的狀態＋要訂／不訂
    let h = timeline(mine) + adjHtml();
    if (L.first) h += `<p class="muted small center">週四 ${esc(L.first.time)} 第一次統計：要 ${L.first.yes} 人・不要 ${L.first.no} 人・未登記 ${L.first.none} 人</p>`;
    // 名單：要訂（總務可以勾繳費）、不訂、未登記
    h += `<div class="panel"><div class="pt-head"><b>✅ 要訂 ${yes.length} 人</b><span class="muted small">💰 已繳 ${yes.filter(r => r.paid).length}／${yes.length}</span></div>`;
    h += yes.length ? `<ul class="lunch-list">${yes.map(r => `<li>${L.canPay
      ? `<label class="lunch-paid"><input type="checkbox" data-paid="${esc(r.key)}"${r.paid ? ' checked' : ''}> ${esc(nm(r.key))}</label>`
      : `<span>${esc(nm(r.key))}</span>${r.paid ? '<span class="tag good">已繳費</span>' : ''}`}</li>`).join('')}</ul>` : '<p class="muted small">還沒有人。</p>';
    if (L.canPay) h += `<p class="muted small">勾選＝已經繳餐費（只有總務股長可以勾）。</p>`;
    h += `</div><div class="panel"><b>❌ 不訂 ${no.length} 人</b><p class="small lunch-names">${no.map(r => esc(nm(r.key))).join('、') || '—'}</p></div>
      <div class="panel"><b>⚠️ 未登記 ${none.length} 人</b><p class="small lunch-names">${none.map(r => esc(nm(r.key))).join('、') || '—'}</p></div>
      <div class="panel"><h3>📋 統計報表</h3><pre class="lunch-report">${esc(L.report)}</pre>
        <div class="actions"><button type="button" class="btn btn--primary wide" data-l="copy">📋 複製報表（傳到 LINE 群組）</button></div></div>`;
    root.innerHTML = h;
  }
  $('#lunchRoot').addEventListener('click', async e => {
    const b = e.target.closest('[data-l]');
    if (!b || b.disabled) return;
    const act = b.dataset.l;
    if (act === 'copy') { toast(await A.copyText(L.report) ? '✓ 已複製，貼到 LINE 群組就可以了' : '複製失敗'); return; }
    if (act === 'adj') {
      const early = Number($('#lcEarly').value), days = Number($('#lcDays').value);
      if (early === L.early && days === L.days) return toast('沒有改變');
      const txt = days === 0 ? '這次不訂便當' : `訂 ${days} 天，${CUT_NAME[early]} 12:00 結束登記`;
      if (!await A.ask(`調整便當時間：${txt}？\n全班會收到飛鴿傳書通知。`, '儲存調整')) return;
      b.disabled = true;
      try { L = await A.api('setLunchAdj', { early, days }); toast('✓ 已調整，也通知全班了'); } catch (err) { toast(err.message); }
      render(); return;
    }
    b.disabled = true;
    try { L = await A.api('setLunch', { choice: act }); toast(act === '要' ? '🍱 已登記：要訂便當' : '已登記：不訂'); } catch (err) { toast(err.message); }
    render();
  });
  $('#lunchRoot').addEventListener('change', async e => {
    const k = e.target.dataset?.paid;
    if (!k) return;
    e.target.disabled = true;
    try { L = await A.api('setLunchPaid', { key: k, paid: e.target.checked }); toast(e.target.checked ? `💰 ${nm(k)} 已繳費` : `已取消 ${nm(k)} 的繳費`); } catch (err) { toast(err.message); e.target.checked = !e.target.checked; }
    render();
  });
  A.tabHooks.lunch = () => { render(); if (Date.now() - lAt > 30e3) load(); };   // 剛預先載入過就不用再載
  A.addPrefetch('lunch', () => load(true));
  setInterval(() => { if (A.currentTab() === 'lunch' && L && !document.hidden) render(); }, 60e3);

  // ── 測試模式：存在這台裝置；時間規則和正式版一樣 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    if (!['getLunch', 'setLunch', 'setLunchPaid', 'setLunchAdj'].includes(action)) return prevTest ? prevTest(action, p) : null;
    const KEY = 'indoor.lunch.v1.test';
    const now = new Date(), dow = now.getDay() || 7, hm = now.getHours() * 100 + now.getMinutes();
    const mon = new Date(now); mon.setDate(now.getDate() - (dow - 1));
    const week = A.fmtDate(mon), m1 = new Date(mon); m1.setDate(mon.getDate() + 7); const m5 = new Date(mon); m5.setDate(mon.getDate() + 11);
    const AK = 'indoor.lunchadj.v1.test', adjAll = store.get(AK, {});
    if (action === 'setLunchAdj') { adjAll[week] = { early: p.early, days: p.days, by: A.isTeacher() ? (A.D.teacherLabel || '導師') : A.me(), time: A.fmtTime(now) }; store.set(AK, adjAll); }
    const prevMon = new Date(mon); prevMon.setDate(mon.getDate() - 7);
    const adj = adjAll[week] || {}, prevAdj = adjAll[A.fmtDate(prevMon)] || {};
    const overlap = Math.max(0, Math.min(5, (prevAdj.days ?? 5) - 5)), defDays = 5 - overlap, days = adj.days ?? defDays, early = adj.early || 0, cut = 5 - early;
    const nth = n => { const d = new Date(m1); for (let c = 0, i = 0; i < 40; i++, d.setDate(d.getDate() + 1)) if (d.getDay() % 6 && ++c >= n) break; return d; };
    const st = nth(overlap + 1), en = nth(overlap + Math.max(1, days)), md = d => `${d.getMonth() + 1}/${d.getDate()}`;
    const meal = days ? `${md(st)}${days > 1 ? '～' + md(en) : ''}${days !== 5 ? `（${days} 天）` : ''}` : '（不訂）';
    const locked = !days || dow > cut || (dow === cut && hm >= 1200);
    void m5;
    const all = store.get(KEY, {}), rows = all[week] || (all[week] = {});
    const T = A.D.teacherLabel || '導師', me = A.isTeacher() ? T : A.me();
    if (action === 'setLunch') { if (locked) throw new Error('本週登記已經在週五中午 12 點截止了，下週一再開放'); rows[me] = { choice: p.choice, time: A.fmtTime(now), paid: rows[me]?.paid || false }; }
    if (action === 'setLunchPaid') { if (!rows[p.key] && p.key === T) rows[T] = { choice: '要', time: '', paid: false }; if (!rows[p.key] || rows[p.key].choice !== '要') throw new Error('這位同學沒有訂便當'); rows[p.key].paid = p.paid; }
    store.set(KEY, all);
    const students = [...A.students(), T];
    const eff = k => rows[k] || (k === T ? { choice: '要', time: '', paid: false, auto: true } : null);
    const yes = students.filter(k => eff(k)?.choice === '要');
    const report = [`🍱 商一甲 便當登記（${meal}）`, `✅ 要訂 ${yes.length} 人${yes.length ? '：\n' + yes.join('、') : ''}`, `❌ 不訂 ${students.filter(k => eff(k)?.choice === '不要').length} 人`, `⚠️ 未登記 ${students.filter(k => !eff(k)).length} 人`].join('\n');
    const canAdj = A.isTeacher() || A.jobsOf(me || '').roles.some(r => /^(總務|副?班長$)/.test(r));
    return { ok: true, week, meal, locked, first: null, early, cut, cutText: `${['', '週一', '週二', '週三', '週四', '週五'][cut]} 12:00`, days, defDays, overlap, skip: !days, start: A.fmtDate(st), adjBy: adj.by || '', adjTime: adj.time || '', canAdj, maxDays: 10, rows: students.map(k => ({ key: k, choice: eff(k)?.choice || '', paid: !!eff(k)?.paid, time: eff(k)?.time || '', auto: !!eff(k)?.auto })), me, canPay: !A.isTeacher() && A.jobsOf(me || '').roles.some(r => /^總務/.test(r)), report };
  };
})();
