'use strict';
/* 📊 加扣分紀錄（最右邊的分頁）：每位同學的加分、扣分、合計；點數字看每一筆的原因、時間、登記人。
   導師看得到全班；同學（和幹部）只看得到自己的。包含掃地檢查的扣分（不好、未出席）。 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  let P = null, pAt = 0, range = 'all', sort = 'seat';
  const DEPT_ORDER = { 料: 0, 多: 1 };
  const rankOf = k => { const m = (A.parseKey(k).code || '').match(/^(\D*)(\d+)/); return m ? [DEPT_ORDER[m[1].charAt(0)] ?? 2, Number(m[2])] : [3, 0]; };
  const byKey = (a, b) => { const x = rankOf(a), y = rankOf(b); return x[0] - y[0] || x[1] - y[1]; };
  const nm = k => { const p = A.parseKey(k); return p.code ? `${p.code} ${p.name}` : k; };
  const num = v => (Math.round(v * 100) / 100).toString();
  const sign = v => (v > 0 ? '+' : '') + num(v);
  const RANGE = { all: ['全部', 0], d30: ['最近 30 天', 30], d7: ['最近 7 天', 7] };

  async function load(quiet) {
    try { P = await A.api('pointsBoard'); pAt = Date.now(); } catch (e) { if (!quiet) toast('加扣分紀錄讀取失敗：' + e.message); }
    if (!quiet || A.currentTab() === 'pboard') render();
  }
  const rowsIn = () => { const d = RANGE[range][1]; return d ? P.rows.filter(r => r.t >= Date.now() - d * 86400e3) : P.rows; };
  function totals() {
    const T = {};
    P.students.forEach(k => { T[k] = { plus: 0, minus: 0, np: 0, nm: 0 }; });
    rowsIn().forEach(r => { const t = T[r.key] ||= { plus: 0, minus: 0, np: 0, nm: 0 }; if (r.p > 0) { t.plus += r.p; t.np++; } else { t.minus += r.p; t.nm++; } });
    return T;
  }
  function render() {
    const root = $('#pboardRoot');
    if (!root) return;
    if (!P) { root.innerHTML = `<div class="panel"><p class="muted">讀取中…</p></div>`; return; }
    const T = totals();
    let keys = Object.keys(T).sort(byKey);
    if (sort === 'plus') keys.sort((a, b) => T[b].plus - T[a].plus || byKey(a, b));
    if (sort === 'minus') keys.sort((a, b) => T[a].minus - T[b].minus || byKey(a, b));
    if (sort === 'total') keys.sort((a, b) => (T[b].plus + T[b].minus) - (T[a].plus + T[a].minus) || byKey(a, b));
    const seg = (name, cur, opts) => `<div class="lv-views pb-seg">${opts.map(([v, t]) => `<button type="button" data-pb="${name}" data-v="${v}" aria-pressed="${cur === v}">${t}</button>`).join('')}</div>`;
    let h = `<div class="panel"><h3>📊 加扣分紀錄${P.all ? `（${keys.length} 人）` : ''}</h3>
      <p class="muted small">${P.all ? '全班每個人的加分、扣分。' : '這裡是你自己的加扣分。'}點數字可以看每一筆的原因、時間、是誰登記的。包含掃地檢查的扣分（不好、未出席）。${P.since ? `從 ${P.since}（重置扣分統計）之後開始算。` : ''}</p>
      ${seg('range', range, Object.entries(RANGE).map(([v, x]) => [v, x[0]]))}
      ${P.all ? seg('sort', sort, [['seat', '依座號'], ['plus', '加分多'], ['minus', '扣分多'], ['total', '合計']]) : ''}
      <div class="pb-wrap"><table class="pb"><thead><tr><th>同學</th><th>加分</th><th>扣分</th><th>合計</th></tr></thead><tbody>`;
    let sp = 0, sm = 0;
    keys.forEach(k => {
      const t = T[k], tot = t.plus + t.minus; sp += t.plus; sm += t.minus;
      h += `<tr><td><button type="button" class="pb-name" data-pb="list" data-k="${esc(k)}" data-f="all">${esc(nm(k))}</button></td>
        <td>${t.np ? `<button type="button" class="pb-n plus" data-pb="list" data-k="${esc(k)}" data-f="plus">+${num(t.plus)}<small>${t.np} 筆</small></button>` : '<span class="muted">—</span>'}</td>
        <td>${t.nm ? `<button type="button" class="pb-n minus" data-pb="list" data-k="${esc(k)}" data-f="minus">${num(t.minus)}<small>${t.nm} 筆</small></button>` : '<span class="muted">—</span>'}</td>
        <td><b class="${tot > 0 ? 'pb-plus' : tot < 0 ? 'pb-minus' : ''}">${t.np || t.nm ? sign(tot) : '0'}</b></td></tr>`;
    });
    h += `</tbody>${P.all ? `<tfoot><tr><td><b>全班</b></td><td class="pb-plus">+${num(sp)}</td><td class="pb-minus">${num(sm)}</td><td><b>${sign(sp + sm)}</b></td></tr></tfoot>` : ''}</table></div></div>`;
    // 同學自己：直接列出每一筆
    if (!P.all) h += `<div class="panel"><h3>每一筆</h3>${listHtml(rowsIn())}</div>`;
    root.innerHTML = h;
  }
  function listHtml(rows) {
    if (!rows.length) return '<p class="muted small">沒有紀錄。</p>';
    return `<ul class="pb-list">${rows.map(r => `<li><span class="pb-p ${r.p > 0 ? 'pb-plus' : 'pb-minus'}">${sign(r.p)}</span>
      <div><b>${esc(r.reason || '（沒有寫原因）')}</b><div class="muted small">${esc(r.cat || '')}${r.cat ? '・' : ''}${esc(r.time || r.day)}・${r.check ? '檢查人' : '登記人'}：${esc(r.by === (A.D.teacherLabel || '導師') ? '導師' : nm(r.by || '—'))}</div></div></li>`).join('')}</ul>`;
  }
  function openList(k, f) {
    const rows = rowsIn().filter(r => r.key === k && (f === 'all' || (f === 'plus' ? r.p > 0 : r.p < 0)));
    const s = rows.reduce((t, r) => t + r.p, 0);
    const title = f === 'plus' ? '加分' : f === 'minus' ? '扣分' : '加扣分';
    A.openSheet({ kind: 'pboard' }, A.sheetHead(`${esc(nm(k))}｜${title}`, `${RANGE[range][0]}・共 ${rows.length} 筆・${sign(s)}`) + listHtml(rows));
  }
  $('#pboardRoot').addEventListener('click', e => {
    const b = e.target.closest('[data-pb]');
    if (!b) return;
    if (b.dataset.pb === 'range') { range = b.dataset.v; render(); return; }
    if (b.dataset.pb === 'sort') { sort = b.dataset.v; render(); return; }
    if (b.dataset.pb === 'list') openList(b.dataset.k, b.dataset.f);
  });
  A.tabHooks.pboard = () => { render(); if (Date.now() - pAt > 30e3) load(); };
  A.addPrefetch('pboard', () => (A.isGuest() ? null : load(true)));

  // ── 測試模式：用這台裝置的加扣分測試資料 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    if (action !== 'pointsBoard') return prevTest ? prevTest(action, p) : null;
    const me = A.isTeacher() ? '' : A.me(), all = A.isTeacher();
    let rows = store.get('indoor.pboard.v1.test', null);
    if (!rows) {   // 第一次：隨機產生一些紀錄
      const S = A.students(), R = ['上課認真回答', '幫忙搬作業', '遲到', '上課講話', '服裝不整', '主動打掃', '作業遲交'];
      rows = Array.from({ length: 60 }, (_, i) => { const pp = [2, 1, 1, -1, -2, 3, -1][i % 7]; const t = Date.now() - Math.random() * 40 * 86400e3; return { key: S[Math.floor(Math.random() * S.length)], p: pp, cat: pp > 0 ? '其他' : i % 2 ? '秩序' : '整潔', reason: R[i % 7], by: '導師', t, time: `${A.pad2(new Date(t).getMonth() + 1)}/${A.pad2(new Date(t).getDate())} 08:10`, day: '' }; });
      store.set('indoor.pboard.v1.test', rows);
    }
    rows = rows.filter(r => all || r.key === me).sort((a, b) => b.t - a.t);
    return { ok: true, rows, all, students: all ? A.students() : [me], since: '' };
  };
})();
