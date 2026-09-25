'use strict';
/* 💰 班費收支（總務登記、大家看）＋ 🧧 發紅包（幹部發起、4 人連署後發給全班） */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;

  const roles = () => (A.isTeacher() ? [] : A.jobsOf(A.me() || '').roles);
  const canFund = () => A.isTeacher() || roles().some(r => /^總務/.test(r));
  const isCadre = () => !A.isTeacher() && !A.isStudent() && roles().length > 0;
  const money = n => (Math.round(n * 100) / 100).toLocaleString('zh-TW');

  // 金額可以打算式：50*44、1200-350、(30+20)*2 …（只允許數字和 + − × ÷ 括號）
  function calc(expr) {
    const s = String(expr || '').normalize('NFKC').replace(/[×xX]/g, '*').replace(/[÷]/g, '/').replace(/[,，\s]/g, '');
    if (!s || !/^[\d.+\-*/()]+$/.test(s)) return NaN;
    let i = 0;
    const num = () => { const m = s.slice(i).match(/^\d+(\.\d+)?/); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); };
    const factor = () => {
      if (s[i] === '-') { i++; return -factor(); }
      if (s[i] === '(') { i++; const v = expr2(); if (s[i] !== ')') throw 0; i++; return v; }
      return num();
    };
    const term = () => { let v = factor(); while (s[i] === '*' || s[i] === '/') { const o = s[i++]; const w = factor(); v = o === '*' ? v * w : v / w; } return v; };
    const expr2 = () => { let v = term(); while (s[i] === '+' || s[i] === '-') { const o = s[i++]; const w = term(); v = o === '+' ? v + w : v - w; } return v; };
    try { const v = expr2(); return i === s.length && isFinite(v) ? Math.round(v * 100) / 100 : NaN; } catch { return NaN; }
  }

  // ── 班費 ──
  let F = null;
  async function loadFund() {
    try { F = await A.api('getFund'); } catch (e) { toast('班費讀取失敗：' + e.message); }
    renderFund();
  }
  function renderFund() {
    const root = $('#fundRoot');
    if (!F) { root.innerHTML = `<div class="panel"><p class="muted">讀取中…</p></div>`; return; }
    let h = `<div class="panel fund-sum"><div><span class="muted small">收入</span><b class="plus">${money(F.income)}</b></div>
      <div><span class="muted small">支出</span><b class="minus">${money(F.expense)}</b></div>
      <div><span class="muted small">結餘</span><b>${money(F.balance)}</b></div></div>`;
    if (canFund()) {
      const today = A.fmtDate(new Date()).replace(/\//g, '-');
      h += `<div class="panel fund-form"><h3>登記一筆</h3>
        <div class="seg fund-type" role="group"><button type="button" data-ft="收入" aria-pressed="true">＋ 收入</button><button type="button" data-ft="支出" aria-pressed="false">－ 支出</button></div>
        <div class="fund-grid">
          <label>日期<input type="date" id="fDate" value="${today}"></label>
          <label>品項<input type="text" id="fItem" maxlength="40" placeholder="例如：班費、影印費"></label>
          <label>金額<input type="text" id="fAmt" inputmode="decimal" placeholder="可以打算式：50*44"></label>
          <label>補充說明<input type="text" id="fNote" maxlength="100" placeholder="（可不填）"></label>
        </div>
        <p class="muted small" id="fCalc">金額可以直接打算式，例如 50*44、1200-350、(30+20)*2。</p>
        <div class="actions"><button type="button" class="btn btn--primary wide" data-f="add">登記</button></div></div>`;
    } else {
      h += `<p class="muted small center">班費由總務登記，這裡只能檢視。</p>`;
    }
    h += `<div class="panel"><h3>收支明細</h3>`;
    if (!F.rows.length) h += `<p class="muted small">還沒有紀錄。</p>`;
    else {
      h += `<div class="admin-wrap"><table class="admin fund-table"><thead><tr><th>日期</th><th>品項</th><th>收入</th><th>支出</th><th>結餘</th><th>說明</th>${canFund() ? '<th></th>' : ''}</tr></thead><tbody>`;
      F.rows.forEach(r => {
        const out = r.type === '支出';
        h += `<tr><td>${esc(r.date.slice(5))}</td><td>${esc(r.item)}</td><td class="plus">${out ? '' : money(r.amount)}</td><td class="minus">${out ? money(r.amount) : ''}</td><td><b>${money(r.balance)}</b></td>
          <td class="small">${esc(r.note)}${r.by ? `<div class="muted">${esc(r.by)}</div>` : ''}</td>${canFund() ? `<td><button type="button" class="pt-del" data-f="del" data-id="${esc(r.id)}" aria-label="刪除">✕</button></td>` : ''}</tr>`;
      });
      h += `</tbody></table></div>`;
    }
    root.innerHTML = h + `</div>`;
  }
  let fType = '收入';
  $('#fundRoot').addEventListener('click', async e => {
    const t = e.target.closest('[data-ft]');
    if (t) { fType = t.dataset.ft; document.querySelectorAll('[data-ft]').forEach(x => x.setAttribute('aria-pressed', x === t)); return; }
    const b = e.target.closest('[data-f]');
    if (!b || b.disabled) return;
    if (b.dataset.f === 'add') {
      const amount = calc($('#fAmt').value), item = $('#fItem').value.trim();
      if (!item) return toast('請填品項');
      if (!(amount > 0)) return toast('金額要是正的數字或算式');
      const row = { date: $('#fDate').value.replace(/-/g, '/'), item, amount, type: fType, note: $('#fNote').value.trim() };
      if (!await A.ask(`登記 ${fType} ${money(amount)} 元\n${row.date}｜${item}${row.note ? '｜' + row.note : ''}`, '登記')) return;
      b.disabled = true;
      try { F = await A.api('addFund', { row }); toast('✓ 已登記'); } catch (err) { toast(err.message); b.disabled = false; return; }
      renderFund();
    } else if (b.dataset.f === 'del') {
      const r = F.rows.find(x => x.id === b.dataset.id);
      if (!r || !await A.ask(`刪除這筆？\n${r.date} ${r.item} ${r.type} ${money(r.amount)} 元\n（試算表會保留紀錄）`, '刪除', true)) return;
      try { F = await A.api('delFund', { id: r.id }); toast('已刪除'); } catch (err) { toast(err.message); }
      renderFund();
    }
  });
  $('#fundRoot').addEventListener('input', e => {
    if (e.target.id !== 'fAmt') return;
    const v = calc(e.target.value);
    $('#fCalc').textContent = e.target.value && /[+\-*/×÷()]/.test(e.target.value) ? (isNaN(v) ? '算式看不懂' : `＝ ${money(v)} 元`) : '金額可以直接打算式，例如 50*44、1200-350、(30+20)*2。';
  });
  A.tabHooks.fund = () => { renderFund(); loadFund(); };

  // ── 發紅包（放在「加扣分」頁最下面）──
  let packs = [];
  async function loadPacks() {
    try { const r = await A.api('getPacks'); packs = r.packs || []; } catch { /* 讀不到 */ }
    renderPacks();
  }
  function renderPacks() {
    const root = $('#packRoot');
    if (!root) return;
    const me = A.me();
    let h = `<div class="panel pack"><h3>🧧 發紅包</h3>
      <p class="muted small">幹部發起，要有<b>班長、副班長，再加上另外兩位幹部</b>（共 4 人）連署同意，才會發給全班每一位同學（加到商店點數，不影響扣分統計和班名次）。紀錄會留在試算表「紅包」。</p>`;
    if (isCadre()) {
      h += `<div class="pack-new"><input type="text" id="pkReason" maxlength="60" placeholder="發紅包的原因（例如：整潔比賽第一名）">
        <label class="pk-pts">每人<input type="number" id="pkPts" min="1" max="20" value="2" inputmode="numeric">點</label>
        <button type="button" class="btn btn--primary" data-pk2="start">🧧 發起</button></div>`;
    }
    const list = packs;
    if (!list.length) h += `<p class="muted small">最近 30 天沒有紅包活動。</p>`;
    list.forEach(p => {
      const n = p.need || {};
      const signed = p.signs.includes(me);
      const st = p.status === '連署中' ? `連署中（${p.signs.length} 人）` : p.status;
      h += `<div class="pack-card ${p.status === '已發放' ? 'done' : p.status === '連署中' ? '' : 'off'}">
        <div class="pk-head"><b>🧧 每人 ${p.points} 點</b><span class="muted small">${esc(p.time)}｜發起：${esc(p.by)}</span></div>
        <div>${esc(p.reason)}</div>
        <div class="small">連署：${p.signs.map(esc).join('、')}</div>
        ${p.status === '連署中' ? `<div class="small muted">還需要：${[!n.hasHead && '班長', !n.hasVice && '副班長', n.others < 2 && `其他幹部 ${2 - (n.others || 0)} 位`].filter(Boolean).join('、') || '—'}</div>` : ''}
        <div class="pk-foot"><span class="tag">${esc(st)}</span>
          ${p.status === '連署中' && isCadre() && !signed ? `<button type="button" class="btn btn--primary" data-pk2="sign" data-id="${esc(p.id)}">✍ 同意連署</button>` : ''}
          ${p.status === '連署中' && (A.isTeacher() || p.by === me) ? `<button type="button" class="link-btn" data-pk2="cancel" data-id="${esc(p.id)}">取消活動</button>` : ''}</div></div>`;
    });
    root.innerHTML = h + `</div>`;
  }
  $('#packRoot').addEventListener('click', async e => {
    const b = e.target.closest('[data-pk2]');
    if (!b || b.disabled) return;
    const act = b.dataset.pk2;
    try {
      if (act === 'start') {
        const reason = $('#pkReason').value.trim(), points = +$('#pkPts').value;
        if (!reason) return toast('請寫發紅包的原因');
        if (!(points >= 1 && points <= 20)) return toast('每人點數要在 1～20 點之間');
        if (!await A.ask(`發起紅包活動：每人 ${points} 點\n原因：${reason}\n\n需要班長、副班長和另外兩位幹部連署（你自己也算一位）。`, '發起')) return;
        b.disabled = true;
        packs = (await A.api('startPack', { reason, points })).packs; toast('🧧 已發起，等其他幹部連署');
      } else if (act === 'sign') {
        const p = packs.find(x => x.id === b.dataset.id);
        if (!await A.ask(`同意這個紅包活動？\n每人 ${p.points} 點：${p.reason}\n（連署會留下紀錄）`, '同意連署')) return;
        b.disabled = true;
        packs = (await A.api('signPack', { id: p.id })).packs;
        const now = packs.find(x => x.id === p.id);
        toast(now?.status === '已發放' ? '🧧 連署完成，紅包已經發給全班！' : '✍ 已連署');
      } else if (act === 'cancel') {
        if (!await A.ask('取消這個紅包活動？', '取消活動', true)) return;
        packs = (await A.api('cancelPack', { id: b.dataset.id })).packs; toast('已取消');
      }
    } catch (err) { toast(err.message); b.disabled = false; }
    renderPacks();
  });
  const prevPointsHook = A.tabHooks.points;
  A.tabHooks.points = () => { prevPointsHook?.(); renderPacks(); loadPacks(); };

  // ── 測試模式：存在這台裝置 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    const FK = 'indoor.fund.v1.test', PK = 'indoor.packs.v1.test';
    const fund = () => {
      const rows = store.get(FK, []).slice().sort((a, b) => a.date.localeCompare(b.date));
      let bal = 0; rows.forEach(r => { bal += r.type === '支出' ? -r.amount : r.amount; r.balance = bal; });
      const inc = rows.filter(r => r.type !== '支出').reduce((t, r) => t + r.amount, 0), out = rows.filter(r => r.type === '支出').reduce((t, r) => t + r.amount, 0);
      return { ok: true, rows: rows.reverse(), income: inc, expense: out, balance: inc - out };
    };
    if (action === 'getFund') return fund();
    if (action === 'addFund') { store.set(FK, [...store.get(FK, []), { ...p.row, by: A.isTeacher() ? '導師' : A.me(), id: Math.random().toString(36).slice(2, 10) }]); return fund(); }
    if (action === 'delFund') { store.set(FK, store.get(FK, []).filter(r => r.id !== p.id)); return fund(); }
    const R = k => A.jobsOf(k).roles;
    const need = signs => { const head = signs.some(k => R(k).includes('班長')), vice = signs.some(k => R(k).includes('副班長')); const others = signs.filter(k => !R(k).includes('班長') && !R(k).includes('副班長') && R(k).length).length; return { ok: head && vice && others >= 2, hasHead: head, hasVice: vice, others }; };
    const list = () => store.get(PK, []).map(x => ({ ...x, need: need(x.signs) })).reverse();
    if (action === 'getPacks') return { ok: true, packs: list() };
    if (action === 'startPack') { const t = new Date(); store.set(PK, [...store.get(PK, []), { id: Math.random().toString(36).slice(2, 10), time: `${A.pad2(t.getMonth() + 1)}/${A.pad2(t.getDate())} ${A.fmtTime(t)}`, by: A.me(), reason: p.reason, points: p.points, signs: [A.me()], status: '連署中' }]); return { ok: true, packs: list() }; }
    if (action === 'signPack') { const all = store.get(PK, []), x = all.find(y => y.id === p.id); if (x.signs.includes(A.me())) throw new Error('你已經連署過了'); x.signs.push(A.me()); if (need(x.signs).ok) x.status = '已發放'; store.set(PK, all); return { ok: true, packs: list() }; }
    if (action === 'cancelPack') { const all = store.get(PK, []), x = all.find(y => y.id === p.id); x.status = '已取消'; store.set(PK, all); return { ok: true, packs: list() }; }
    return prevTest ? prevTest(action, p) : null;
  };
})();
