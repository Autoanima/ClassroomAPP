'use strict';
/* 加扣分：導師與幹部對同學登記加分／扣分（一定要寫理由），試算表「扣分統計」會和整潔扣分合併計算 */
(() => {
  const A = window.App, D = A.D;
  const { $, esc, toast, store } = A;
  const K = { test: 'indoor.points.v1.test', form: 'indoor.pointform.v1' };
  const form = Object.assign({ sign: -1, pts: 1, cat: D.pointCats[0], reason: '' }, store.get(K.form, {}));
  const saveForm = () => store.set(K.form, form);
  let chosen = new Set();
  let scope = '';
  let recent = [];
  let busy = false;

  const depts = () => [...new Set(A.students().map(k => A.parseKey(k).code.replace(/\d+$/, '')).filter(Boolean))];
  const fmtPts = n => (n > 0 ? '+' + n : String(n));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function render() {
    const root = $('#pointsRoot');
    if (!A.students().length) {
      root.innerHTML = `<div class="panel"><p class="muted">讀取學生名單中…</p></div>`;
      A.loadStudents().then(render).catch(e => { root.innerHTML = `<div class="panel"><p class="lock-msg">無法讀取名單：${esc(e.message)}</p></div>`; });
      return;
    }
    const reasons = D.pointReasons[form.sign < 0 ? 'minus' : 'plus'] || [];
    let h = `<div class="panel pt-form">
      <div class="pt-sign" role="group" aria-label="加分或扣分">
        <button type="button" data-sign="-1" aria-pressed="${form.sign < 0}">➖ 扣分</button>
        <button type="button" data-sign="1" aria-pressed="${form.sign > 0}">➕ 加分</button>
      </div>
      <div class="pt-row"><span class="pt-lbl">分數</span><div class="chips">${[1, 2, 3, 5].map(n =>
        `<button type="button" class="nm${form.pts === n ? ' on' : ''}" data-pts="${n}">${n}</button>`).join('')}
        <input type="number" id="ptCustom" min="1" max="100" inputmode="numeric" placeholder="其他" value="${[1, 2, 3, 5].includes(form.pts) ? '' : form.pts}"></div></div>
      <div class="pt-row"><span class="pt-lbl">類別</span><div class="chips">${D.pointCats.map(c =>
        `<button type="button" class="nm${form.cat === c ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>
      <div class="pt-row"><span class="pt-lbl">理由</span><div class="pt-reason">
        <input type="text" id="ptReason" maxlength="60" placeholder="一定要寫理由" value="${esc(form.reason)}">
        <div class="chips">${reasons.map(r => `<button type="button" class="nm soft" data-reason="${esc(r)}">${esc(r)}</button>`).join('')}</div></div></div>
    </div>`;
    h += `<div class="panel"><div class="pt-head"><b>選擇同學</b><span class="muted small">已選 ${chosen.size} 人</span>
        ${chosen.size ? `<button type="button" class="link-btn" data-p="clear">全部取消</button>` : ''}</div>
      <div class="subsw small-sw">${['', ...depts()].map(d => `<button type="button" data-scope="${esc(d)}" aria-selected="${scope === d}">${d ? esc(d) : '全班'}</button>`).join('')}</div>
      <div class="pt-grid">`;
    A.students().filter(k => !scope || A.parseKey(k).code.startsWith(scope)).forEach(k => {
      const { code, name } = A.parseKey(k);
      h += `<button type="button" class="pt-stu${chosen.has(k) ? ' on' : ''}" data-stu="${esc(k)}" aria-pressed="${chosen.has(k)}">
        <span class="photo">${A.faceHtml(k)}</span><span class="sn"><b>${esc(code.replace(/(\d+)$/, ' $1'))}</b><span>${esc(name)}</span></span></button>`;
    });
    h += `</div></div>`;
    const label = `${form.sign < 0 ? '扣' : '加'} ${form.pts} 分${chosen.size ? ` × ${chosen.size} 人` : ''}`;
    h += `<div class="pt-submit"><button type="button" class="btn ${form.sign < 0 ? 'btn--dangerfill' : 'btn--primary'} big" data-p="submit"${busy ? ' disabled' : ''}>送出：${label}</button></div>`;
    h += `<div class="panel"><div class="pt-head"><b>${A.isTeacher() ? '最近的加扣分紀錄（全班）' : '我登記的紀錄'}</b><button type="button" class="link-btn" data-p="reload">重新整理</button></div>`;
    if (!recent.length) h += `<p class="muted small">最近兩週沒有紀錄。</p>`;
    else {
      h += `<ul class="pt-list">`;
      recent.forEach(r => {
        const canDel = A.isTeacher() || r.by === A.me();
        h += `<li><span class="pt-v ${r.points < 0 ? 'minus' : 'plus'}">${fmtPts(r.points)}</span>
          <div class="pt-what"><b>${esc(r.student)}</b> <span class="tagc">${esc(r.cat)}</span> ${esc(r.reason)}
          <div class="muted small">${esc(r.time)}${A.isTeacher() ? '｜' + esc(r.by) : ''}</div></div>
          ${canDel ? `<button type="button" class="pt-del" data-del="${esc(r.id)}" aria-label="刪除這筆">✕</button>` : ''}</li>`;
      });
      h += `</ul>`;
    }
    h += `<p class="muted small">${A.isTeacher() ? '試算表「扣分統計」按「計算」後，會把這裡的加扣分和掃地「不好」的扣分合在一起。' : '登記錯了可以按 ✕ 刪除（只能刪自己登記的）。'}</p></div>`;
    root.innerHTML = h;
  }

  async function loadRecent() {
    try {
      const r = await A.api('getPoints', { days: 14 });
      recent = r.rows || [];
    } catch (e) { toast('紀錄讀取失敗：' + e.message); }
    if (A.currentTab() === 'points') render();
  }

  async function submit() {
    const reason = ($('#ptReason')?.value || '').trim();
    form.reason = reason; saveForm();
    if (!chosen.size) return toast('請先點選同學');
    if (!reason) { $('#ptReason')?.focus(); return toast('請寫理由'); }
    const pts = form.sign * form.pts;
    const names = [...chosen];
    const ok = await A.ask(`${form.sign < 0 ? '扣' : '加'} ${form.pts} 分（${form.cat}）\n理由：${reason}\n\n${names.join('、')}`, '送出', form.sign < 0);
    if (!ok) return;
    busy = true; render();
    try {
      const now = new Date();
      const rows = names.map(k => ({ id: uid(), date: A.fmtDate(now), student: k, points: pts, cat: form.cat, reason }));
      const r = await A.api('addPoints', { rows });
      recent = r.rows || recent;
      chosen.clear();
      form.reason = ''; saveForm();
      toast(`✓ 已登記 ${rows.length} 位同學`);
    } catch (e) { toast('登記失敗：' + e.message); }
    busy = false;
    render();
  }

  $('#pointsRoot').addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.stu) { chosen.has(d.stu) ? chosen.delete(d.stu) : chosen.add(d.stu); return keepReason(render); }
    if (d.sign) { form.sign = +d.sign; saveForm(); return keepReason(render); }
    if (d.pts) { form.pts = +d.pts; saveForm(); return keepReason(render); }
    if (d.cat) { form.cat = d.cat; saveForm(); return keepReason(render); }
    if (d.scope != null) { scope = d.scope; return keepReason(render); }
    if (d.reason) { const i = $('#ptReason'); i.value = d.reason; form.reason = d.reason; saveForm(); return; }
    if (d.p === 'clear') { chosen.clear(); return keepReason(render); }
    if (d.p === 'reload') return loadRecent();
    if (d.p === 'submit') return submit();
    if (d.del) {
      const r = recent.find(x => x.id === d.del);
      if (!r || !await A.ask(`刪除這筆紀錄？\n${r.student} ${fmtPts(r.points)}（${r.cat}）${r.reason}`, '刪除', true)) return;
      try { const res = await A.api('delPoints', { id: d.del }); recent = res.rows || recent.filter(x => x.id !== d.del); toast('已刪除'); } catch (err) { toast('刪除失敗：' + err.message); }
      render();
    }
  });
  // 重畫時保留還沒送出的理由
  function keepReason(fn) { const i = $('#ptReason'); if (i) { form.reason = i.value; saveForm(); } fn(); }
  $('#pointsRoot').addEventListener('input', e => {
    if (e.target.id === 'ptCustom') { const n = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 0)); if (n) { form.pts = n; saveForm(); updateSubmit(); } }
    if (e.target.id === 'ptReason') { form.reason = e.target.value; saveForm(); }
  });
  function updateSubmit() {
    const b = $('#pointsRoot [data-p="submit"]');
    if (b) b.textContent = `送出：${form.sign < 0 ? '扣' : '加'} ${form.pts} 分${chosen.size ? ` × ${chosen.size} 人` : ''}`;
    document.querySelectorAll('#pointsRoot [data-pts]').forEach(x => x.classList.toggle('on', +x.dataset.pts === form.pts));
  }

  // 從座位表點同學 →「幫他登記加扣分」
  A.openPoints = keys => {
    chosen = new Set(keys);
    A.showTab('points');
  };
  A.tabHooks.points = () => { render(); loadRecent(); A.ensureFaces?.(); };
  A.on('students', () => { if (A.currentTab() === 'points') keepReason(render); });
  A.on('faces', () => { if (A.currentTab() === 'points') keepReason(render); });

  // ── 測試模式：紀錄只存在這台裝置 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    const list = () => {
      const all = store.get(K.test, []);
      return (A.isTeacher() ? all : all.filter(r => r.by === A.me())).slice(-50).reverse();
    };
    if (action === 'getPoints') return { ok: true, rows: list() };
    if (action === 'addPoints') {
      const now = new Date();
      const t = `${A.fmtDate(now).slice(5)} ${A.fmtTime(now)}`;
      store.set(K.test, [...store.get(K.test, []), ...p.rows.map(r => ({ ...r, time: t, by: A.isTeacher() ? D.teacherLabel : A.me() }))]);
      return { ok: true, rows: list() };
    }
    if (action === 'delPoints') {
      store.set(K.test, store.get(K.test, []).filter(r => r.id !== p.id || (!A.isTeacher() && r.by !== A.me())));
      return { ok: true, rows: list() };
    }
    return prevTest ? prevTest(action, p) : null;
  };
})();
