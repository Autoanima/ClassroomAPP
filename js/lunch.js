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
      <div class="lc-exact">🪙 請繳交<b>剛好的金額</b>給總務，不要讓總務還要想辦法準備零錢找你，大家要貼心減輕幹部工作量。</div>
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
  // ── 💸 零錢帳（總務、導師）：還欠誰多少、還錢；名單上的 💸 打開找錢畫面 ──
  function changeHtml() {
    if (!L.canChange) return '';
    const bal = L.change?.bal || {}, list = Object.keys(bal).sort((a, b) => bal[b] - bal[a]);
    const total = list.reduce((t, k) => t + bal[k], 0);
    const all = [...A.students(), A.D.teacherLabel || '導師'];
    return `<div class="panel chg-panel"><div class="pt-head"><b>💸 零錢帳：還欠同學 ${total} 元</b><span class="muted small">${list.length} 人</span></div>
      ${list.length ? `<ul class="chg-list">${list.map(k => `<li><span>${esc(nm(k))}</span><b>${bal[k]} 元</b>${L.canPay ? `<button type="button" class="btn" data-l="chg" data-k="${esc(k)}">還錢</button>` : ''}</li>`).join('')}</ul>` : '<p class="muted small">目前沒有欠任何人零錢 👍</p>'}
      ${L.canPay ? `<div class="chg-pick"><select id="chgWho"><option value="">— 其他同學（這週沒訂便當也可以）—</option>${all.map(k => `<option value="${esc(k)}">${esc(nm(k))}</option>`).join('')}</select><button type="button" class="btn" data-l="chgPick">💸 記一筆</button></div>` : ''}
      ${(L.change?.log || []).length ? `<details class="chg-log"><summary class="small">最近的紀錄</summary><ul>${L.change.log.map(x => `<li class="small"><span class="muted">${esc(x.time)}</span> ${esc(nm(x.key))}：${x.kind === '欠' ? `欠 <b>${x.amt}</b> 元` : `還 <b>${x.amt}</b> 元`}${x.note ? `（${esc(x.note)}）` : ''}</li>`).join('')}</ul></details>` : ''}
    </div>`;
  }
  const DUE = 'indoor.lunchdue.v1';
  function openChange(k) {
    const bal = L.change?.bal?.[k] || 0, row = L.rows.find(r => r.key === k);
    const log = (L.change?.log || []).filter(x => x.key === k);
    let h = A.sheetHead(`💸 ${esc(nm(k))}`, '便當零錢帳');
    h += `<p class="chg-now">目前欠他：<b>${bal} 元</b></p>
      <div class="chg-box"><b>① 收錢時來不及找零</b>
        <div class="chg-calc"><label>應繳 <input type="number" id="chgDue" inputmode="numeric" min="0" value="${esc(String(store.get(DUE, '') || ''))}" placeholder="便當費"> 元</label>
          <label>收了 <input type="number" id="chgGot" inputmode="numeric" min="0" placeholder="他給的錢"> 元</label></div>
        <div class="chips">${[100, 200, 300, 500, 1000].map(v => `<button type="button" class="nm soft" data-act="chgGot" data-v="${v}">收 ${v}</button>`).join('')}</div>
        <label class="chg-amt">要找他 <input type="number" id="chgAmt" inputmode="numeric" min="1" placeholder="0"> 元</label>
        <div class="chips">${[5, 10, 15, 20, 25, 30, 40, 50].map(v => `<button type="button" class="nm soft" data-act="chgAmt" data-v="${v}">${v}</button>`).join('')}</div>
        ${row?.choice === '要' && !row.paid ? `<label class="chg-paid"><input type="checkbox" id="chgPaid" checked> 同時勾「已繳費」</label>` : ''}
        <div class="actions"><button type="button" class="btn btn--primary wide" data-act="chgOwe" data-k="${esc(k)}">📝 記下：先欠他 <span id="chgOweN">?</span> 元</button></div></div>`;
    if (bal) h += `<div class="chg-box"><b>② 還錢給他</b>
        <div class="actions"><button type="button" class="btn btn--primary wide" data-act="chgRepay" data-k="${esc(k)}" data-v="${bal}">💰 全部還清 ${bal} 元</button></div>
        <div class="chg-part"><label>只還一部分 <input type="number" id="chgPart" inputmode="numeric" min="1" max="${bal}"> 元</label><button type="button" class="btn" data-act="chgRepay" data-k="${esc(k)}">還這些</button></div></div>`;
    if (log.length) h += `<p class="muted small">紀錄：${log.map(x => `${esc(x.time)} ${x.kind} ${x.amt} 元`).join('・')}</p>`;
    h += `<p class="muted small">每記一筆，同學會收到飛鴿傳書通知。紀錄在試算表「便當零錢帳」。</p>`;
    A.openSheet({ kind: 'lunchchg' }, h);
    calcOwe();
  }
  // 應繳、收了 → 自動算要找多少
  function calcOwe(fromAmt) {
    const due = +($('#chgDue')?.value || 0), got = +($('#chgGot')?.value || 0), amt = $('#chgAmt');
    if (!amt) return;
    if (!fromAmt && due > 0 && got > due) amt.value = got - due;
    const n = Math.round(+amt.value || 0);
    $('#chgOweN').textContent = n > 0 ? n : '?';
  }
  A.sheetBody.addEventListener('input', e => {
    if (A.sheetMode()?.kind !== 'lunchchg') return;
    if (e.target.id === 'chgDue' || e.target.id === 'chgGot') calcOwe();
    if (e.target.id === 'chgAmt') calcOwe(true);
  });
  A.sheetHandlers.lunchchg = async (act, b) => {
    if (act === 'chgGot') { $('#chgGot').value = b.dataset.v; return calcOwe(); }
    if (act === 'chgAmt') { $('#chgAmt').value = b.dataset.v; return calcOwe(true); }
    const k = b.dataset.k;
    if (act === 'chgOwe') {
      const amt = Math.round(+($('#chgAmt').value || 0));
      if (!(amt > 0)) { $('#chgAmt').focus(); return toast('請填要找他多少元'); }
      if (+$('#chgDue').value > 0) store.set(DUE, +$('#chgDue').value);   // 下次自動帶入便當費
      b.disabled = true;
      try { L = await A.api('lunchChange', { key: k, amount: amt, kind: 'owe', paid: !!$('#chgPaid')?.checked }); toast(`📝 已記下：欠 ${nm(k)} ${amt} 元`); A.closeSheet(); render(); }
      catch (err) { toast(err.message); b.disabled = false; }
      return;
    }
    if (act === 'chgRepay') {
      const amt = Math.round(+(b.dataset.v || $('#chgPart')?.value || 0));
      if (!(amt > 0)) { $('#chgPart')?.focus(); return toast('請填要還多少元'); }
      b.disabled = true;
      try { L = await A.api('lunchChange', { key: k, amount: amt, kind: 'repay' }); toast(`💰 已還 ${nm(k)} ${amt} 元`); A.closeSheet(); render(); }
      catch (err) { toast(err.message); b.disabled = false; }
    }
  };
  let adjOpen = false;
  $('#lunchRoot').addEventListener('toggle', e => { if (e.target.classList?.contains('lunch-adj')) adjOpen = e.target.open; }, true);
  function render() {
    const root = $('#lunchRoot');
    if (!L) { root.innerHTML = `<div class="panel"><p class="muted">讀取中…</p></div>`; return; }
    const yes = L.rows.filter(r => r.choice === '要'), no = L.rows.filter(r => r.choice === '不要'), none = L.rows.filter(r => !r.choice);
    const mine = L.rows.find(r => r.key === L.me);
    // 一張卡片：標題＋狀態、時間軸、我的狀態＋要訂／不訂
    let h = timeline(mine) + adjHtml();
    const myOwe = !L.canChange && L.change?.bal?.[L.me];
    if (myOwe) h += `<div class="panel chg-mine">💸 總務還欠你 <b>${myOwe} 元</b>零錢，之後會還你。</div>`;
    if (L.first) h += `<p class="muted small center">週四 ${esc(L.first.time)} 第一次統計：要 ${L.first.yes} 人・不要 ${L.first.no} 人・未登記 ${L.first.none} 人</p>`;
    // 名單：要訂（總務可以勾繳費）、不訂、未登記
    h += `<div class="panel"><div class="pt-head"><b>✅ 要訂 ${yes.length} 人</b><span class="muted small">💰 已繳 ${yes.filter(r => r.paid).length}／${yes.length}</span></div>`;
    const bal = L.change?.bal || {};
    const oweTag = k => (bal[k] ? `<span class="tag owe" title="總務還欠他的零錢">欠 ${bal[k]}</span>` : '');
    h += yes.length ? `<ul class="lunch-list">${yes.map(r => `<li>${L.canPay
      ? `<label class="lunch-paid"><input type="checkbox" data-paid="${esc(r.key)}"${r.paid ? ' checked' : ''}> ${esc(nm(r.key))}</label>${oweTag(r.key)}<button type="button" class="chg-btn" data-l="chg" data-k="${esc(r.key)}" aria-label="${esc(nm(r.key))} 找零錢" title="找零錢／欠錢">💸</button>`
      : `<span>${esc(nm(r.key))}</span>${r.paid ? '<span class="tag good">已繳費</span>' : ''}${L.canChange ? oweTag(r.key) : ''}`}</li>`).join('')}</ul>` : '<p class="muted small">還沒有人。</p>';
    if (L.canPay) h += `<p class="muted small">勾選＝已經繳餐費（只有總務股長可以勾）。來不及找零錢就按名字旁邊的 💸，記下先欠他多少。</p>`;
    h += `</div><div class="panel"><b>❌ 不訂 ${no.length} 人</b><p class="small lunch-names">${no.map(r => esc(nm(r.key))).join('、') || '—'}</p></div>
      <div class="panel"><b>⚠️ 未登記 ${none.length} 人</b><p class="small lunch-names">${none.map(r => esc(nm(r.key))).join('、') || '—'}</p></div>
      ${changeHtml()}
      <div class="panel"><h3>📋 統計報表</h3><pre class="lunch-report">${esc(L.report)}</pre>
        <div class="actions"><button type="button" class="btn btn--primary wide" data-l="copy">📋 複製報表（傳到 LINE 群組）</button></div></div>`;
    root.innerHTML = h;
  }
  $('#lunchRoot').addEventListener('click', async e => {
    const b = e.target.closest('[data-l]');
    if (!b || b.disabled) return;
    const act = b.dataset.l;
    if (act === 'chg') return openChange(b.dataset.k);
    if (act === 'chgPick') { const k = $('#chgWho').value; return k ? openChange(k) : toast('請先選一位同學'); }
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
    if (!['getLunch', 'setLunch', 'setLunchPaid', 'setLunchAdj', 'lunchChange'].includes(action)) return prevTest ? prevTest(action, p) : null;
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
    const CK = 'indoor.lunchchg.v1.test', chg = store.get(CK, []);
    const balOf = () => { const b = {}; chg.forEach(x => { b[x.key] = (b[x.key] || 0) + (x.kind === '還' ? -x.amt : x.amt); }); Object.keys(b).forEach(k => { if (b[k] <= 0) delete b[k]; }); return b; };
    const canChange = A.isTeacher() || A.jobsOf(me || '').roles.some(r => /^總務/.test(r));
    if (action === 'lunchChange') {
      if (!canChange) throw new Error('只有總務股長可以記零錢帳');
      const amt = Math.round(+p.amount);
      if (!(amt >= 1 && amt <= 2000)) throw new Error('金額要在 1～2000 元之間');
      if (p.kind === 'repay' && amt > (balOf()[p.key] || 0)) throw new Error(`目前只欠他 ${balOf()[p.key] || 0} 元`);
      chg.push({ key: p.key, amt, kind: p.kind === 'owe' ? '欠' : '還', time: `${A.fmtDate(now).slice(5)} ${A.fmtTime(now)}`, by: me, note: '' });
      store.set(CK, chg);
      if (p.paid && rows[p.key]?.choice === '要') rows[p.key].paid = true;
    }
    store.set(KEY, all);
    const students = [...A.students(), T];
    const eff = k => rows[k] || (k === T ? { choice: '要', time: '', paid: false, auto: true } : null);
    const yes = students.filter(k => eff(k)?.choice === '要');
    const report = [`🍱 商一甲 便當登記（${meal}）`, `✅ 要訂 ${yes.length} 人${yes.length ? '：\n' + yes.join('、') : ''}`, `❌ 不訂 ${students.filter(k => eff(k)?.choice === '不要').length} 人`, `⚠️ 未登記 ${students.filter(k => !eff(k)).length} 人`].join('\n');
    const canAdj = A.isTeacher() || A.jobsOf(me || '').roles.some(r => /^(總務|副?班長$)/.test(r));
    return { ok: true, week, meal, locked, first: null, early, cut, cutText: `${['', '週一', '週二', '週三', '週四', '週五'][cut]} 12:00`, days, defDays, overlap, skip: !days, start: A.fmtDate(st), adjBy: adj.by || '', adjTime: adj.time || '', canAdj, maxDays: 10, rows: students.map(k => ({ key: k, choice: eff(k)?.choice || '', paid: !!eff(k)?.paid, time: eff(k)?.time || '', auto: !!eff(k)?.auto })), me, canPay: !A.isTeacher() && A.jobsOf(me || '').roles.some(r => /^總務/.test(r)), report,
      canChange, change: canChange ? { bal: balOf(), log: chg.slice(-30).reverse() } : { bal: balOf()[me] ? { [me]: balOf()[me] } : {}, log: [] } };
  };
})();
