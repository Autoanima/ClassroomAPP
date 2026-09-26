'use strict';
/* 🍱 訂便當：每週一～週五中午 12 點登記「下週」要不要訂；總務勾選繳費；大家都看得到名單 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  let L = null;

  const canChoose = () => !A.isTeacher() && !A.isGuest() && !!A.me();
  const nm = k => { const p = A.parseKey(k); return `${p.code.replace(/(\d+)$/, ' $1')} ${p.name}`; };

  async function load() {
    try { L = await A.api('getLunch'); } catch (e) { toast('便當資料讀取失敗：' + e.message); }
    render();
  }
  function render() {
    const root = $('#lunchRoot');
    if (!L) { root.innerHTML = `<div class="panel"><p class="muted">讀取中…</p></div>`; return; }
    const yes = L.rows.filter(r => r.choice === '要'), no = L.rows.filter(r => r.choice === '不要'), none = L.rows.filter(r => !r.choice);
    const mine = L.rows.find(r => r.key === L.me);
    let h = `<div class="banner ${L.locked ? 'warn' : 'ok'}"><div class="bn-main">${L.locked ? '🔒 本週登記已截止' : '🍱 登記中：下週（' + esc(L.meal) + '）的便當'}</div>
      <div class="bn-sub">${L.locked ? `下週（${esc(L.meal)}）的名單已經確定，不能再改；下週一會開放新的登記。` : '每週一～週五中午 12:00 前登記；週四下午 5 點會提醒還沒登記的同學。'}</div></div>`;
    if (canChoose()) {
      h += `<div class="panel lunch-me"><h3>我要訂便當嗎？</h3><div class="lunch-pick">
        <button type="button" class="btn${mine?.choice === '要' ? ' btn--primary' : ''}" data-l="要"${L.locked ? ' disabled' : ''}>🍱 要訂</button>
        <button type="button" class="btn${mine?.choice === '不要' ? ' btn--primary' : ''}" data-l="不要"${L.locked ? ' disabled' : ''}>🙅 不訂</button></div>
        <p class="muted small">${mine?.choice ? `你登記的是「${esc(mine.choice)}」（${esc(mine.time)}）${mine.choice === '要' ? (mine.paid ? '｜💰 已繳費' : '｜還沒繳費：週五放學前交給總務，逾時未交會取消訂餐') : ''}` : '你還沒登記。'}</p></div>`;
    }
    if (L.first) h += `<p class="muted small center">週四 ${esc(L.first.time)} 第一次統計：要 ${L.first.yes} 人・不要 ${L.first.no} 人・未登記 ${L.first.none} 人</p>`;
    // 名單：要訂（總務可以勾繳費）、不訂、未登記
    h += `<div class="panel"><div class="pt-head"><b>✅ 要訂 ${yes.length} 人</b><span class="muted small">💰 已繳 ${yes.filter(r => r.paid).length}／${yes.length}</span></div>`;
    h += yes.length ? `<ul class="lunch-list">${yes.map(r => `<li>${L.canPay
      ? `<label class="lunch-paid"><input type="checkbox" data-paid="${esc(r.key)}"${r.paid ? ' checked' : ''}> ${esc(nm(r.key))}</label>`
      : `<span>${esc(nm(r.key))}</span>${r.paid ? '<span class="tag good">已繳費</span>' : ''}`}</li>`).join('')}</ul>` : '<p class="muted small">還沒有人。</p>';
    if (L.canPay) h += `<p class="muted small">勾選＝已經繳餐費（總務股長、導師可以勾）。</p>`;
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
  A.tabHooks.lunch = () => { render(); load(); };

  // ── 測試模式：存在這台裝置；時間規則和正式版一樣 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    if (!['getLunch', 'setLunch', 'setLunchPaid'].includes(action)) return prevTest ? prevTest(action, p) : null;
    const KEY = 'indoor.lunch.v1.test';
    const now = new Date(), dow = now.getDay() || 7, hm = now.getHours() * 100 + now.getMinutes();
    const mon = new Date(now); mon.setDate(now.getDate() - (dow - 1));
    const week = A.fmtDate(mon), m1 = new Date(mon); m1.setDate(mon.getDate() + 7); const m5 = new Date(mon); m5.setDate(mon.getDate() + 11);
    const meal = `${m1.getMonth() + 1}/${m1.getDate()}～${m5.getMonth() + 1}/${m5.getDate()}`;
    const locked = dow > 5 || (dow === 5 && hm >= 1200);
    const all = store.get(KEY, {}), rows = all[week] || (all[week] = {});
    const me = A.me();
    if (action === 'setLunch') { if (locked) throw new Error('本週登記已經在週五中午 12 點截止了，下週一再開放'); rows[me] = { choice: p.choice, time: A.fmtTime(now), paid: rows[me]?.paid || false }; }
    if (action === 'setLunchPaid') { if (!rows[p.key] || rows[p.key].choice !== '要') throw new Error('這位同學沒有訂便當'); rows[p.key].paid = p.paid; }
    store.set(KEY, all);
    const students = A.students();
    const yes = students.filter(k => rows[k]?.choice === '要');
    const report = [`🍱 商一甲 便當登記（${meal}）`, `✅ 要訂 ${yes.length} 人${yes.length ? '：\n' + yes.join('、') : ''}`, `❌ 不訂 ${students.filter(k => rows[k]?.choice === '不要').length} 人`, `⚠️ 未登記 ${students.filter(k => !rows[k]).length} 人`].join('\n');
    return { ok: true, week, meal, locked, first: null, rows: students.map(k => ({ key: k, choice: rows[k]?.choice || '', paid: !!rows[k]?.paid, time: rows[k]?.time || '' })), me: A.isTeacher() ? '' : me, canPay: A.isTeacher() || A.jobsOf(me || '').roles.some(r => /^總務/.test(r)), report };
  };
})();
