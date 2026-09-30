'use strict';
/* 🕊 飛鴿傳書：在商店免費拿信紙，寫信給同學（或導師）；收件人下次打開 App 會先看到，三天後自動消失 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  const KEEP_DAYS = 3;
  const SEEN = 'indoor.mailseen.v1' + A.SFX;   // 這台裝置看過的信
  const TEST_KEY = 'indoor.mail.v1.test';
  let mails = [];

  const me = () => (A.isTeacher() ? A.D.teacherLabel : A.me());
  const canMail = () => A.isStudent() || A.isStaff();

  async function load() {
    if (!canMail()) return mails;
    try { const r = await A.api('getMail'); mails = r.mails || []; } catch { /* 讀不到就先不顯示 */ }
    paintBtn();
    return mails;
  }
  const unseen = () => { const s = new Set(store.get(SEEN, [])); return mails.filter(m => !s.has(m.id)); };
  function paintBtn() {
    const b = $('#mailBtn');
    if (!b) return;
    b.hidden = !canMail() || !mails.length;
    const n = unseen().length;
    b.innerHTML = `🕊${n ? `<span class="bb-n">${n}</span>` : `<span class="bb-c">${mails.length}</span>`}`;
    b.classList.toggle('new', n > 0);
  }

  // ── 收信 ──
  function openInbox() {
    let h = A.sheetHead('🕊 飛鴿傳書', `寄給你的信（${KEEP_DAYS} 天後自動消失）`);
    if (!mails.length) h += `<p class="muted center">目前沒有信。</p>`;
    const seen = new Set(store.get(SEEN, []));
    mails.forEach(m => {
      h += `<div class="mail-card${seen.has(m.id) ? '' : ' new'}"><div class="mail-head"><b>來自 ${esc(m.from)}</b><span class="muted small">${esc(m.time)}</span></div>
        ${mailBody(m.text)}
        <div class="mail-foot muted small">${esc(leftText(m.t))}${(A.students().includes(m.from) || m.from === A.D.teacherLabel) && canMail() ? `<button type="button" class="link-btn" data-act="mailReply" data-to="${esc(m.from)}">↩ 回信</button>` : `<button type="button" class="link-btn" data-act="mailCopy" data-id="${esc(m.id)}">📋 複製</button>`}</div></div>`;
    });
    h += `<div class="actions"><button type="button" class="btn wide" data-act="mailNew">✉️ 寫一封信</button></div>`;
    A.openSheet({ kind: 'mail' }, h);
    store.set(SEEN, [...new Set([...store.get(SEEN, []), ...mails.map(m => m.id)])].slice(-300));
    paintBtn();
  }
  // 信件內容：App 的分頁連結（…#tab=lunch）變成「前往」按鈕，其他網址可以點
  const GO = { leave: '📝 前往請假', clean: '🧹 前往掃地檢查', hw: '📥 前往繳交', lunch: '🍱 前往訂便當', shop: '🛍 前往商店', invest: '📈 前往投資', arena: '⚔️ 前往擂台', fund: '💰 前往班費', draw: '🎲 前往抽籤', seats: '🪑 前往座位' };
  function mailBody(text) {
    const go = [];
    const rest = String(text).split('\n').filter(line => {
      const m = line.match(/https?:\/\/\S+#tab=(\w+)/);
      if (m && GO[m[1]]) { go.push(m[1]); return false; }
      return true;
    }).join('\n').trim();
    const html = esc(rest).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
    return `<div class="mail-text">${html}</div>${go.map(t => `<button type="button" class="btn btn--primary wide mail-go" data-act="mailGo" data-tab="${t}">${GO[t]}</button>`).join('')}`;
  }
  const leftText = t => {
    const h = Math.max(0, Math.ceil((t + KEEP_DAYS * 86400e3 - Date.now()) / 3600e3));
    return h > 24 ? `還會保留 ${Math.ceil(h / 24)} 天` : `還會保留 ${h} 小時`;
  };

  // ── 寫信（信紙免費）──
  async function openCompose(to = '') {
    if (!canMail()) return toast('登入後才能寫信');
    if (!A.students().length) { try { await A.loadStudents(); } catch (e) { return toast('無法讀取名單：' + e.message); } }
    const list = [A.D.teacherLabel, ...A.students()].filter(k => k !== me());
    let h = A.sheetHead('🕊 飛鴿傳書', '信紙免費；收件人下次打開 App 就會看到，3 天後自動消失');
    h += `<div class="field"><label for="mailTo">收件人</label><select id="mailTo"><option value="">— 請選擇 —</option>${list.map(k => `<option value="${esc(k)}"${k === to ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select></div>
      <div class="field"><label for="mailText">內容</label><textarea id="mailText" rows="4" maxlength="200" placeholder="想對他說的話…"></textarea></div>
      <p class="muted small">信會顯示寄件人的名字，導師也看得到所有信件的紀錄，請友善使用。每人每天最多寄 10 封。</p>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="mailSend">🕊 寄出</button></div>`;
    A.openSheet({ kind: 'mail' }, h);
  }
  A.openMailCompose = openCompose;
  A.sheetHandlers.mail = async (act, b) => {
    if (act === 'mailGo') { A.closeSheet(); A.showTab(b.dataset.tab); return; }
    if (act === 'mailNew') return openCompose();
    if (act === 'mailReply') return openCompose(b.dataset.to);
    if (act === 'mailCopy') { const m = mails.find(x => x.id === b.dataset.id); toast(m && await A.copyText(m.text.replace(/^[^\n]*\n\n/, '')) ? '✓ 已複製，可以貼到 LINE 群組' : '複製失敗'); return; }
    if (act !== 'mailSend') return;
    const to = $('#mailTo').value, text = ($('#mailText').value || '').trim();
    if (!to) return toast('請選擇收件人');
    if (!text) { $('#mailText').focus(); return toast('請寫下內容'); }
    b.disabled = true;
    try { await A.api('sendMail', { to, text }); A.closeSheet(); toast(`🕊 信已經飛向 ${to} 了！`); } catch (err) { toast(err.message); b.disabled = false; }
  };

  $('#mailBtn').addEventListener('click', openInbox);
  // 從外面的連結打開（例如貼到 LINE 的 …#tab=lunch）：登入後直接到那個分頁
  function hashTab() {
    const m = location.hash.match(/tab=(\w+)/);
    if (!m || !A.started()) return;
    history.replaceState(null, '', location.pathname + location.search);
    A.showTab(m[1]);
  }
  A.on('start', () => setTimeout(hashTab, 0));
  window.addEventListener('hashchange', hashTab);
  // 打開 App：有沒看過的信就顯示（公布欄開著的話，等它關掉再顯示）
  // 打開 App 的順序：先飛鴿傳書，關掉之後才輪到公布欄（A.mailDone 讓公布欄等）
  let mailDone;
  A.mailDone = new Promise(r => { mailDone = r; });
  A.on('start', async () => {
    try {
      await load();
      if (!unseen().length) return;
      for (let i = 0; i < 60 && A.sheetMode(); i++) await new Promise(r => setTimeout(r, 1000));
      if (A.sheetMode()) return;
      openInbox();
      while (A.sheetMode()) await new Promise(r => setTimeout(r, 500)); // 等信件關掉
    } finally { mailDone(); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && A.started()) load(); });

  // ── 測試模式：信只存在這台裝置 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    const all = () => store.get(TEST_KEY, []).filter(x => Date.now() - x.t < KEEP_DAYS * 86400e3);
    if (action === 'getMail') return { ok: true, mails: all().filter(x => x.to === me()).sort((a, b) => b.t - a.t) };
    if (action === 'sendMail') {
      const t = new Date();
      store.set(TEST_KEY, [...all(), { id: Math.random().toString(36).slice(2, 10), t: t.getTime(), time: `${A.pad2(t.getMonth() + 1)}/${A.pad2(t.getDate())} ${A.fmtTime(t)}`, from: me(), to: p.to, text: String(p.text).slice(0, 200) }]);
      return { ok: true };
    }
    return prevTest ? prevTest(action, p) : null;
  };
})();
