'use strict';
/* 📥 各項作業與繳交資料追蹤：導師、幹部（小老師）設定繳交項目（名稱、開始～截止、對象），
   時間軸看每一項走到哪裡、還有多久截止；勾選誰交了；逾期沒交的標紅色；
   複製 LINE 報表、發站內信提醒還沒交的同學。同學只看得到自己交了沒。 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  const TARGET = { all: '全班', data: '資料科', mm: '多媒科' };
  let H = null, hAt = 0;
  const DEPT_ORDER = { 料: 0, 多: 1 };
  const rankOf = k => { const m = (A.parseKey(k).code || '').match(/^(\D*)(\d+)/); return m ? [DEPT_ORDER[m[1].charAt(0)] ?? 2, Number(m[2])] : [3, 0]; };
  const byKey = (a, b) => { const x = rankOf(a), y = rankOf(b); return x[0] - y[0] || x[1] - y[1]; };
  const nm = k => { const p = A.parseKey(k); return p.code ? `${p.code} ${p.name}` : k; };
  const who = k => (k === (A.D.teacherLabel || '導師') ? '導師' : nm(k));
  const WK = '日一二三四五六';
  const fmt = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}（${WK[d.getDay()]}）${A.pad2(d.getHours())}:${A.pad2(d.getMinutes())}`; };
  const left = ms => { const m = Math.round(Math.abs(ms) / 60e3), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60); return d ? `${d} 天 ${h} 小時` : h ? `${h} 小時 ${m % 60} 分` : `${m % 60} 分鐘`; };
  const stage = x => (Date.now() < x.start ? 'wait' : Date.now() <= x.end ? 'open' : 'late');
  const STAGE = { wait: ['尚未開始', 'wait'], open: ['收件中', 'open'], late: ['已截止', 'late'] };
  const remain = x => (stage(x) === 'wait' ? `${left(x.start - Date.now())}後開始收` : stage(x) === 'open' ? `還有 ${left(x.end - Date.now())}` : `已截止 ${left(Date.now() - x.end)}`);

  async function load(quiet) {
    try { H = await A.api('getHomework'); hAt = Date.now(); } catch (e) { if (!quiet) toast('繳交資料讀取失敗：' + e.message); }
    if (!quiet || A.currentTab() === 'hw') render();
  }

  // ── 時間軸：每一項一條，從開始到截止；直線＝現在；條裡面的深色＝已交的比例 ──
  function timelineHtml(items) {
    const now = Date.now();
    const list = items.filter(x => x.end > now - 7 * 86400e3);
    if (!list.length) return '';
    let t0 = Math.min(now, ...list.map(x => x.start)), t1 = Math.max(now, ...list.map(x => x.end));
    const pad = Math.max(3600e3 * 6, (t1 - t0) * 0.04); t0 -= pad; t1 += pad;
    const P = t => ((t - t0) / (t1 - t0) * 100).toFixed(2) + '%';
    // 刻度：每天（超過三週改成每週）
    const step = (t1 - t0) > 21 * 86400e3 ? 7 : 1, ticks = [];
    const d = new Date(t0); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1);
    for (; d.getTime() < t1; d.setDate(d.getDate() + step)) ticks.push(d.getTime());
    const every = Math.ceil(ticks.length / 5);
    for (let i = ticks.length - 1; i >= 0; i--) if (i % every) ticks.splice(i, 1);
    const rows = list.map(x => {
      const st = stage(x), frac = x.total ? x.n / x.total : 0, miss = x.forMe ? (x.myDone ? 0 : 1) : x.total - x.n;
      const tail = x.forMe ? (x.myDone ? '✅ 你交了' : st === 'late' ? '⚠️ 你逾期未交' : '⏳ 你還沒交') : `${x.n}/${x.total}${st === 'late' && miss ? `・<b class="hw-red">${miss} 人逾期</b>` : ''}`;
      return `<div class="hwt-row" data-hw="open" data-id="${esc(x.id)}" role="button" tabindex="0">
        <div class="hwt-name"><b>${esc(x.name)}</b><span class="${st === 'late' && miss ? 'hw-red' : 'muted'}">${remain(x)}</span></div>
        <div class="hwt-track"><span class="hwt-bar ${st}${st === 'late' && miss ? ' miss' : ''}" style="left:${P(x.start)};width:calc(${P(x.end)} - ${P(x.start)})"><i style="width:${(x.forMe ? (x.myDone ? 1 : 0) : frac) * 100}%"></i></span></div>
        <div class="hwt-tail small">${tail}</div></div>`;
    }).join('');
    return `<div class="panel hwt"><h3>🗓 時間軸</h3>
      <div class="hwt-axis">${ticks.map(t => `<span style="left:${P(t)}">${new Date(t).getMonth() + 1}/${new Date(t).getDate()}</span>`).join('')}</div>
      <div class="hwt-body">${rows}<span class="hwt-now" style="left:${P(now)}"><em>現在</em></span></div>
      <p class="muted small">長條＝開始收～截止；深色＝已交的比例；紅色＝已截止但還有人沒交。點一項可以看名單。</p></div>`;
  }
  function cardHtml(x) {
    const st = stage(x), tag = STAGE[st], miss = x.total - x.n;
    let h = `<div class="panel hw-card" data-st="${st}"><div class="hw-head"><b>${esc(x.name)}</b><span class="hw-tag ${tag[1]}">${tag[0]}</span></div>
      <div class="muted small">${esc(who(x.by))} 建立・${TARGET[x.target] || '全班'}・${fmt(x.start)} ～ <b>${fmt(x.end)}</b></div>
      ${x.note ? `<div class="small hw-note">${esc(x.note)}</div>` : ''}
      <div class="hw-remain ${st === 'late' && (x.forMe ? !x.myDone : miss) ? 'hw-red' : ''}">⏰ ${remain(x)}</div>`;
    if (x.forMe) {
      h += `<div class="hw-me ${x.myDone ? 'ok' : st === 'late' ? 'late' : ''}">${x.myDone ? `✅ 你交了（${fmt(x.myDone)}${x.myDone > x.end ? '・遲交' : ''}）` : st === 'late' ? '⚠️ 你已經逾期還沒交，請盡快補交！' : '⏳ 你還沒交'}</div>`;
    } else {
      h += `<div class="hw-prog"><span style="width:${x.total ? x.n / x.total * 100 : 0}%"></span></div>
        <div class="small">已交 <b>${x.n}</b>／${x.total} 人${miss ? `・${st === 'late' ? `<b class="hw-red">逾期未交 ${miss} 人</b>` : `還沒交 ${miss} 人`}` : '・🎉 全部交齊了'}</div>
        <div class="hw-btns"><button type="button" class="btn btn--primary" data-hw="open" data-id="${esc(x.id)}">✅ 勾選名單</button>
          <button type="button" class="btn" data-hw="line" data-id="${esc(x.id)}">📋 LINE 報表</button>
          <button type="button" class="btn" data-hw="remind" data-id="${esc(x.id)}"${miss ? '' : ' disabled'}>📨 提醒沒交的人</button>
          ${x.mine ? `<button type="button" class="link-btn" data-hw="edit" data-id="${esc(x.id)}">✏️ 編輯</button><button type="button" class="link-btn" data-hw="del" data-id="${esc(x.id)}">刪除</button>` : ''}</div>`;
    }
    return h + '</div>';
  }
  function render() {
    const root = $('#hwRoot');
    if (!root) return;
    if (!H) { root.innerHTML = `<div class="panel"><p class="muted">讀取中…</p></div>`; return; }
    let h = `<div class="panel hw-top"><div><b>📥 各項作業與繳交資料追蹤</b><div class="muted small">${H.manager ? '設定繳交項目、勾選誰交了、把還沒交的名單傳到 LINE 或發站內信提醒。' : '這裡可以看到要交的東西和你交了沒。'}</div></div>
      ${H.manager ? '<button type="button" class="btn btn--primary" data-hw="new">＋ 新增繳交項目</button>' : ''}</div>`;
    const items = H.items || [];
    if (!items.length) { root.innerHTML = h + `<div class="panel"><p class="muted">目前沒有繳交項目。</p></div>`; return; }
    h += timelineHtml(items);
    const now = Date.now(), active = items.filter(x => x.end >= now - 7 * 86400e3), old = items.filter(x => x.end < now - 7 * 86400e3);
    h += active.map(cardHtml).join('');
    if (old.length) h += `<details class="panel"><summary><b>截止超過一週的項目（${old.length}）</b></summary>${old.map(cardHtml).join('')}</details>`;
    root.innerHTML = h;
  }

  // ── 新增／編輯 ──
  const dtVal = t => { const d = new Date(t); return `${d.getFullYear()}-${A.pad2(d.getMonth() + 1)}-${A.pad2(d.getDate())}T${A.pad2(d.getHours())}:${A.pad2(d.getMinutes())}`; };
  function openEdit(x) {
    const now = new Date(), end = new Date(); end.setDate(end.getDate() + 2); end.setHours(17, 0, 0, 0);
    const v = x || { name: '', start: now.getTime(), end: end.getTime(), target: 'all', note: '' };
    let h = A.sheetHead(x ? '✏️ 修改繳交項目' : '＋ 新增繳交項目');
    h += `<label class="lv-f"><span>名稱</span><input type="text" id="hwName" maxlength="40" value="${esc(v.name)}" placeholder="例如：國文作業第 3 課、校外教學回條"></label>
      <div class="lv-grid hw-dt"><label class="lv-f"><span>開始收</span><input type="datetime-local" id="hwStart" value="${dtVal(v.start)}"></label>
      <label class="lv-f"><span>截止</span><input type="datetime-local" id="hwEnd" value="${dtVal(v.end)}" min="${dtVal(v.start)}"></label></div>
      <div class="lv-f"><span>要交的人</span><div class="lv-types" id="hwTarget">${Object.entries(TARGET).map(([k, t]) => `<button type="button" data-act="hwT" data-v="${k}" aria-pressed="${v.target === k}">${t}</button>`).join('')}</div></div>
      <label class="lv-f"><span>說明（可不填）</span><input type="text" id="hwNote" maxlength="200" value="${esc(v.note || '')}" placeholder="例如：交到講桌上的籃子"></label>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="hwSave" data-id="${esc(x?.id || '')}">${x ? '儲存修改' : '建立'}</button></div>`;
    A.openSheet({ kind: 'hwEdit' }, h);
  }
  // 選了開始時間：截止至少要在開始之後（早於的話自動改成開始當天的同一個時間，再加 1 小時）
  document.addEventListener('change', e => {
    if (e.target.id !== 'hwStart' || !e.target.value) return;
    const end = $('#hwEnd');
    end.min = e.target.value;
    if (!end.value || end.value <= e.target.value) end.value = dtVal(new Date(e.target.value).getTime() + 3600e3);
  });
  A.sheetHandlers.hwEdit = async (act, b) => {
    if (act === 'hwT') { b.parentElement.querySelectorAll('button').forEach(y => y.setAttribute('aria-pressed', y === b)); return; }
    if (act !== 'hwSave') return;
    const it = { id: b.dataset.id, name: $('#hwName').value.trim(), start: new Date($('#hwStart').value).getTime(), end: new Date($('#hwEnd').value).getTime(), target: $('#hwTarget [aria-pressed="true"]')?.dataset.v || 'all', note: $('#hwNote').value.trim() };
    if (!it.name) return toast('請輸入名稱');
    if (!(it.end > it.start)) return toast('截止時間要在開始時間之後');
    b.disabled = true;
    try { H = await A.api('saveHomework', { item: it }); A.closeSheet(); toast(it.id ? '✓ 已修改' : '✓ 已建立'); render(); } catch (err) { toast(err.message); b.disabled = false; }
  };

  // ── 勾選名單：點名字就切換交了／沒交（自動儲存）；逾期沒交的標紅色 ──
  let tick = null;   // { id, filter, pending: {}, timer }
  function tickHtml() {
    const x = H.items.find(y => y.id === tick.id);
    if (!x) return '';
    const st = stage(x), people = x.people.slice().sort(byKey);
    const isDone = k => (k in tick.pending ? tick.pending[k] : !!x.done[k]);
    const n = people.filter(isDone).length, f = tick.filter;
    const show = people.filter(k => f === 'all' || (f === 'no' ? !isDone(k) : isDone(k)));
    let h = A.sheetHead(`✅ ${esc(x.name)}`, `截止 ${fmt(x.end)}・${remain(x)}`);
    h += `<div class="hw-tickbar"><b>已交 ${n}／${people.length}</b>${st === 'late' && n < people.length ? `<b class="hw-red">逾期未交 ${people.length - n} 人</b>` : ''}</div>
      <div class="lv-views">${[['all', '全部'], ['no', '還沒交'], ['yes', '已交']].map(([k, t]) => `<button type="button" data-act="hwF" data-v="${k}" aria-pressed="${f === k}">${t}</button>`).join('')}</div>
      <div class="hw-grid">${show.map(k => {
        const d = isDone(k), t = x.done[k], late = !d && st === 'late', lateDone = d && t && t > x.end;
        return `<button type="button" class="hw-nm${d ? ' done' : ''}${late ? ' late' : ''}" data-act="hwTog" data-k="${esc(k)}"><b>${esc(A.parseKey(k).name || k)}</b><span>${esc(A.parseKey(k).code || '')}${d ? (lateDone ? '・遲交' : '・✓') : late ? '・逾期' : ''}</span></button>`;
      }).join('') || '<p class="muted small">沒有人。</p>'}</div>
      <p class="muted small">點名字就可以切換「交了／沒交」，會自動儲存。</p>`;
    return h;
  }
  function openTick(id, filter = 'all') {
    tick = { id, filter, pending: {}, timer: null };
    A.openSheet({ kind: 'hwTick' }, tickHtml());
  }
  const repaintTick = () => { const sc = A.sheetBody.scrollTop; A.sheetBody.innerHTML = tickHtml(); A.sheetBody.scrollTop = sc; };
  async function flushTick() {
    if (!tick || !Object.keys(tick.pending).length) return;
    const t = tick, changes = t.pending;
    t.pending = {};
    try { H = await A.api('markHomework', { id: t.id, changes }); } catch (err) { toast('儲存失敗：' + err.message); Object.assign(t.pending, changes); }
    if (A.sheetMode()?.kind === 'hwTick' && tick === t) repaintTick();
    render();
  }
  A.sheetHandlers.hwTick = (act, b) => {
    if (act === 'hwF') { tick.filter = b.dataset.v; repaintTick(); return; }
    if (act !== 'hwTog') return;
    const x = H.items.find(y => y.id === tick.id), k = b.dataset.k;
    tick.pending[k] = !(k in tick.pending ? tick.pending[k] : !!x.done[k]);
    repaintTick();
    clearTimeout(tick.timer);
    tick.timer = setTimeout(flushTick, 900);
  };
  A.sheetHandlers['hwTick:close'] = () => { clearTimeout(tick?.timer); flushTick(); };

  // ── LINE 報表 ──
  function lineText(x) {
    const st = stage(x), people = x.people.slice().sort(byKey), miss = people.filter(k => !x.done[k]);
    const short = k => { const p = A.parseKey(k); return p.code ? `${p.code} ${p.name}` : k; };
    return [`📥【${x.name}】繳交${st === 'late' ? '逾期' : ''}提醒`,
      `⏰ 截止：${fmt(x.end)}（${remain(x)}）`,
      `✅ 已交 ${people.length - miss.length}／${people.length} 人`,
      miss.length ? `${st === 'late' ? '⚠️ 逾期未交' : '❌ 還沒交'} ${miss.length} 人：\n${miss.map(short).join('、')}` : '🎉 全部交齊了！',
      x.note ? `📌 ${x.note}` : '',
      miss.length ? `請還沒交的同學盡快交給 ${who(x.by)}！` : ''].filter(Boolean).join('\n');
  }

  $('#hwRoot').addEventListener('click', async e => {
    const b = e.target.closest('[data-hw]');
    if (!b || b.disabled) return;
    const act = b.dataset.hw, x = H?.items.find(y => y.id === b.dataset.id);
    if (act === 'new') return openEdit(null);
    if (!x) return;
    if (act === 'open') { if (x.people) openTick(x.id, stage(x) === 'late' ? 'no' : 'all'); return; }
    if (act === 'edit') return openEdit(x);
    if (act === 'line') { const txt = lineText(x); toast(await A.copyText(txt) ? '✓ 已複製，貼到 LINE 群組就可以了' : '複製失敗'); return; }
    if (act === 'del') {
      if (!await A.ask(`刪除「${x.name}」？\n勾選紀錄也會一起不見。`, '刪除', true)) return;
      try { H = await A.api('delHomework', { id: x.id }); toast('已刪除'); render(); } catch (err) { toast(err.message); }
      return;
    }
    if (act === 'remind') {
      const miss = x.total - x.n;
      if (!await A.ask(`發站內信（飛鴿傳書）提醒還沒交「${x.name}」的 ${miss} 位同學？`, '發送提醒')) return;
      b.disabled = true;
      try { const r = await A.api('remindHomework', { id: x.id }); toast(`📨 已提醒 ${r.sent} 位同學`); } catch (err) { toast(err.message); }
      b.disabled = false;
    }
  });
  $('#hwRoot').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.hw === 'open') { e.preventDefault(); e.target.click(); } });
  A.tabHooks.hw = () => { render(); if (Date.now() - hAt > 30e3) load(); };
  A.addPrefetch('hw', () => (A.isGuest() ? null : load(true)));
  setInterval(() => { if (A.currentTab() === 'hw' && H && !document.hidden && !A.sheetMode()) render(); }, 60e3);   // 「還有多久」每分鐘更新

  // ── 測試模式：存在這台裝置 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    if (!['getHomework', 'saveHomework', 'delHomework', 'markHomework', 'remindHomework'].includes(action)) return prevTest ? prevTest(action, p) : null;
    const KEY = 'indoor.hw.v1.test', all = store.get(KEY, []);
    const T = A.D.teacherLabel || '導師', me = A.isTeacher() ? T : A.me();
    const mgr = A.isTeacher() || A.isStaff() || A.jobsOf(me || '').roles.length > 0;
    const find = id => all.find(x => x.id === id);
    const targets = t => A.students().filter(k => (t === 'data' ? /^料/.test(k) : t === 'mm' ? /^多/.test(k) : true));
    if (action === 'saveHomework') {
      const it = p.item;
      if (it.id) Object.assign(find(it.id), { name: it.name, start: it.start, end: it.end, target: it.target, note: it.note });
      else all.push({ id: 'h' + Date.now().toString(36), name: it.name, by: me, start: it.start, end: it.end, target: it.target, note: it.note, done: {} });
    }
    if (action === 'delHomework') all.splice(all.indexOf(find(p.id)), 1);
    if (action === 'markHomework') { const x = find(p.id); Object.entries(p.changes).forEach(([k, v]) => { if (v) x.done[k] ||= Date.now(); else delete x.done[k]; }); }
    if (action === 'remindHomework') { const x = find(p.id); return { ok: true, sent: targets(x.target).filter(k => !x.done[k]).length }; }
    store.set(KEY, all);
    const items = all.map(x => {
      const people = targets(x.target), base = { ...x, total: people.length, n: people.filter(k => x.done[k]).length, mine: x.by === me || A.isTeacher() };
      if (mgr) return { ...base, people };
      if (!people.includes(me)) return null;
      const { done, ...rest } = base; return { ...rest, forMe: true, myDone: done[me] || 0 };
    }).filter(Boolean).sort((a, b) => a.end - b.end);
    return { ok: true, items, manager: mgr, me, now: Date.now() };
  };
})();
