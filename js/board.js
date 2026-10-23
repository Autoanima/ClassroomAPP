'use strict';
/* 📌 公布欄：導師和幹部可以留言（例如今天的作業），每次打開 App 會先看到；關掉後可以從上方「📌 公布欄」再打開 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  const KEEP_DAYS = 14;           // 顯示最近幾天的留言
  const TEST_KEY = 'indoor.board.v1.test';
  let posts = [];
  let loaded = false;
  let hidden = new Set(), autoView = false;
  async function loadPrefs() {
    try { const r = await A.api('boardPrefs'); hidden = new Set(r.hidden || []); } catch { hidden = new Set(); }
  }

  const canPost = () => A.isStaff();   // 導師＋幹部（用自己的身分證字號登入）
  const myName = () => (A.isTeacher() ? A.D.teacherLabel : A.me());

  async function load() {
    try { const r = await A.api('getBoard'); posts = r.posts || []; loaded = true; } catch { /* 讀不到就先不顯示 */ }
    paintBtn();
    return posts;
  }
  function paintBtn() {
    const b = $('#boardBtn');
    if (!b) return;
    b.hidden = !A.started();
    b.innerHTML = `📌 公布欄${posts.length ? `<span class="bb-n">${posts.length}</span>` : ''}`;
  }

  function html() {
    let h = A.sheetHead('📌 公布欄', `最近 ${KEEP_DAYS} 天的留言${canPost() ? '・你可以發布' : ''}`);
    // 發布的地方放在留言的下面
    const compose = canPost() ? `<div class="board-new"><h3 class="board-day">✏️ 發布新的留言</h3><textarea id="boardText" rows="3" maxlength="300" placeholder="例如：國文習作 P.12–15，明天交"></textarea>
        <div class="actions"><button type="button" class="btn btn--primary wide" data-act="boardPost">📌 發布</button></div></div>` : '';
    if (!posts.length) return h + `<p class="muted center">目前沒有留言。</p>` + compose;
    let day = '';
    h += `<div class="board-list">`;
    posts.filter(p => !autoView || !hidden.has(p.id)).forEach(p => {
      if (p.date !== day) { day = p.date; h += `<h3 class="board-day">${esc(dayLabel(p.date))}</h3>`; }
      const mine = A.isTeacher() || p.by === myName();
      h += `<div class="board-post"><div class="bp-text">${esc(p.text)}</div>
        <div class="bp-meta muted small">${esc(p.by)}・${esc(p.time.slice(-5))}${mine ? `<button type="button" class="link-btn" data-act="boardEdit" data-id="${esc(p.id)}">修改</button><button type="button" class="link-btn" data-act="boardDel" data-id="${esc(p.id)}">刪除</button>` : ''}</div><div class="board-pref small"><label><input type="checkbox" data-act="boardPref" data-id="${esc(p.id)}"${hidden.has(p.id) ? ' checked' : ''}> 這週不再自動顯示</label><span class="muted">${hidden.has(p.id) ? '週一恢復顯示；仍可手動查看' : '持續顯示'}</span></div></div>`;
    });
    return h + `</div>` + compose;
  }
  function dayLabel(d) {
    const today = A.fmtDate(new Date());
    const y = new Date(); y.setDate(y.getDate() - 1);
    const w = '日一二三四五六'[new Date(d.replace(/\//g, '-') + 'T12:00:00').getDay()];
    return d === today ? `今天（${w}）` : d === A.fmtDate(y) ? `昨天（${w}）` : `${d.slice(5)}（${w}）`;
  }
  function open(auto = false) {
    autoView = auto;
    A.openSheet({ kind: 'board' }, html());
  }
  A.sheetHandlers.board = async (act, b) => {
    if (act === 'boardPost') {
      const text = ($('#boardText').value || '').trim();
      if (!text) { $('#boardText').focus(); return toast('請寫下要公布的內容'); }
      b.disabled = true;
      try { const r = await A.api('addPost', { text }); posts = r.posts || posts; toast('✓ 已發布'); } catch (err) { toast(err.message); }
      b.disabled = false;
      paintBtn(); A.sheetBody.innerHTML = html();
    } else if (act === 'boardEdit') {
      // 把那一則換成可以編輯的框框
      const p = posts.find(x => x.id === b.dataset.id);
      const box = b.closest('.board-post');
      box.innerHTML = `<textarea class="bp-edit" rows="3" maxlength="300">${esc(p.text)}</textarea>
        <div class="bp-meta"><button type="button" class="btn btn--primary" data-act="boardSave" data-id="${esc(p.id)}">儲存</button><button type="button" class="btn" data-act="boardCancel">取消</button></div>`;
      box.querySelector('textarea').focus();
    } else if (act === 'boardCancel') {
      A.sheetBody.innerHTML = html();
    } else if (act === 'boardSave') {
      const text = b.closest('.board-post').querySelector('textarea').value.trim();
      if (!text) return toast('內容不能是空的（不要的話請按刪除）');
      b.disabled = true;
      try { const r = await A.api('editPost', { id: b.dataset.id, text }); posts = r.posts || posts; toast('✓ 已修改'); } catch (err) { toast(err.message); b.disabled = false; return; }
      A.sheetBody.innerHTML = html();
    } else if (act === 'boardDel') {
      const p = posts.find(x => x.id === b.dataset.id);
      if (!p || !await A.ask(`刪除這則留言？\n\n${p.text}`, '刪除', true)) return;
      try { const r = await A.api('delPost', { id: p.id }); posts = r.posts || posts.filter(x => x.id !== p.id); toast('已刪除'); } catch (err) { toast(err.message); }
      paintBtn(); A.sheetBody.innerHTML = html();
    }
  };

  A.sheetBody.addEventListener('change', async e => {
    const b = e.target;
    if (b.dataset.act !== 'boardPref') return;
    b.disabled = true;
    try { const r = await A.api('setBoardPref', { id: b.dataset.id, hidden: b.checked }); hidden = new Set(r.hidden || []); const note = b.closest('.board-pref')?.querySelector('.muted'); if (note) note.textContent = b.checked ? '週一恢復顯示；仍可手動查看' : '持續顯示'; toast(b.checked ? '本週不再自動顯示這則公告' : '這則公告將持續顯示'); } catch (err) { b.checked = !b.checked; toast(err.message); }
    b.disabled = false;
  });
  $('#boardBtn').addEventListener('click', async () => { if (!loaded) await load(); await loadPrefs(); open(); });
  // 打開 App：有留言就先顯示公布欄（每次打開一次）
  A.on('start', async () => {
    paintBtn();
    await load();
    await loadPrefs();
    let shown = false;
    try { shown = sessionStorage.getItem('indoor.boardShown') === '1'; } catch { /* ignore */ }
    if (shown || !posts.some(p => !hidden.has(p.id)) || A.isGuest()) return; // 任課老師預設不打開（可以自己按）
    // 先等飛鴿傳書看完、畫面上沒有別的視窗，再打開公布欄
    await Promise.race([A.mailDone || Promise.resolve(), new Promise(r => setTimeout(r, 5 * 60e3))]);
    for (let i = 0; i < 120 && A.sheetMode(); i++) await new Promise(r => setTimeout(r, 500));
    if (A.sheetMode()) return;
    try { sessionStorage.setItem('indoor.boardShown', '1'); } catch { /* ignore */ }
    open(true);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && A.started()) load(); });

  // ── 測試模式：留言只存在這台裝置 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    const list = () => store.get(TEST_KEY, []).filter(x => Date.now() - x.t < KEEP_DAYS * 86400e3).sort((a, b) => b.t - a.t);
    if (action === 'boardPrefs' || action === 'setBoardPref') {
      const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); const week = A.fmtDate(d);
      const key = 'indoor.boardPrefs.test.' + myName(); let pref = store.get(key, {});
      if (pref.week !== week) pref = { week, hidden: [] };
      if (action === 'setBoardPref') { pref.hidden = pref.hidden.filter(id => id !== p.id); if (p.hidden) pref.hidden.push(p.id); store.set(key, pref); }
      return { ok: true, ...pref };
    }
    if (action === 'getBoard') return { ok: true, posts: list() };
    if (action === 'addPost') {
      const t = new Date();
      store.set(TEST_KEY, [...store.get(TEST_KEY, []), { id: Math.random().toString(36).slice(2, 10), t: t.getTime(), date: A.fmtDate(t), time: `${A.fmtDate(t)} ${A.fmtTime(t)}`, text: String(p.text).slice(0, 300), by: myName() }]);
      return { ok: true, posts: list() };
    }
    if (action === 'editPost') { store.set(TEST_KEY, store.get(TEST_KEY, []).map(x => (x.id === p.id ? { ...x, text: String(p.text).slice(0, 300) } : x))); return { ok: true, posts: list() }; }
    if (action === 'delPost') { store.set(TEST_KEY, store.get(TEST_KEY, []).filter(x => x.id !== p.id)); return { ok: true, posts: list() }; }
    return prevTest ? prevTest(action, p) : null;
  };
})();
