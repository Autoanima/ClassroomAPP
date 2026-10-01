'use strict';
/* ⚔️ 擂台賽：同學互相挑戰英文單字（高中職 4000 字）或日文五十音發音。
   發起挑戰 → 對方接受 → 兩個人都按「我準備好了」→ 一起倒數開始；同一組題目、每題 5 秒，先答錯（或超時）就停，
   答對多的贏（一樣多比總作答時間）。贏的人得到商店點數 1 點，座位上名字旁邊出現皇冠；輸的人出現昏頭的圖示（都顯示一天）。
   同一對同學每天只能比 1 場。 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  const SEC = 5, MAX_Q = 50;
  const SUBJ = { en: '英文', jp: '日文' };
  let S = null, sAt = 0, off = 0, subj = 'en', game = null, loading = null;
  const canPlay = () => !A.isGuest() && !A.isTeacher() && !!A.me();
  const nm = k => { const p = A.parseKey(k); return p.code ? `${p.code} ${p.name}` : k; };
  const code = k => A.parseKey(k).code || k;
  // 同一場比賽：皇冠和昏頭用同一種顏色
  const HUES = ['#ff6b6b', '#4dabf7', '#51cf66', '#da77f2', '#ffa94d', '#3bc9db', '#f783ac', '#9775fa'];   // 亮一點：在名字的深色底上也看得清楚
  const colorOf = id => HUES[[...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length];
  const serverNow = () => Date.now() + off;

  async function load() {
    if (A.isGuest() && !A.TEST) return S;
    if (loading) return loading;
    loading = (async () => {
      const t0 = Date.now();
      try {
        S = await A.api('arenaState'); sAt = Date.now();
        off = S.now - (t0 + sAt) / 2;
        after();
      } catch (e) { if (A.currentTab() === 'arena') toast('擂台賽讀取失敗：' + e.message); }
      loading = null;
      return S;
    })();
    return loading;
  }
  // 讀到新狀態之後：畫面、座位上的皇冠和昏頭、有沒有要開始的比賽、新的挑戰通知
  let seenInv = new Set(store.get('indoor.arena.seen', [])), badgeKey = '';
  function after() {
    if (A.currentTab() === 'arena') render();
    const bk = (S.recent || []).map(x => x.id).join(',');
    if (bk !== badgeKey) { badgeKey = bk; if (A.currentTab() === 'seats') A.renderMap('seats'); }
    const me = S.me;
    (S.mine || []).forEach(x => {
      if (x.status === '邀請' && x.b === me && !seenInv.has(x.id)) {
        seenInv.add(x.id); store.set('indoor.arena.seen', [...seenInv].slice(-50));
        if (A.currentTab() !== 'arena') toast(`⚔️ ${nm(x.a)} 向你發起${SUBJ[x.subj]}擂台賽挑戰！到「⚔️ 擂台」接受`, { top: true });
      }
      if (x.status === '進行中' && x.seed && (!game || game.id !== x.id) && !doneIds.has(x.id)) startGame(x);
    });
    if (game) { const x = (S.mine || []).find(y => y.id === game.id); if (x) gameUpdate(x); }
    schedule();
  }
  // 輪詢：比賽中每 2 秒；等對方回覆或準備時每 3 秒；在擂台分頁每 15 秒；其他時候每 60 秒（看有沒有人挑戰我）
  let pollT = null;
  function schedule() {
    clearTimeout(pollT);
    if (!canPlay() && A.currentTab() !== 'arena') return;
    const act = (S?.mine || []).some(x => ['邀請', '接受', '進行中'].includes(x.status));
    const ms = game ? 2000 : act && A.currentTab() === 'arena' ? 3000 : A.currentTab() === 'arena' ? 15000 : 60000;
    pollT = setTimeout(() => { if (document.hidden) schedule(); else load(); }, ms);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S && (game || A.currentTab() === 'arena')) load(); });

  // ── 擂台分頁 ──
  let rulesOpen = !store.get('indoor.arena.rulesSeen', false);
  function rulesHtml() {
    return `<details class="panel ar-rules"${rulesOpen ? ' open' : ''}><summary><b>📜 擂台賽規則</b></summary>
      <ol class="ar-ol">
        <li><b>發起挑戰</b>：選一位同學，再選要比 <b>英文</b>（高中職 4000 字，看單字選中文意思）或 <b>日文</b>（看五十音假名，選正確的發音）。</li>
        <li><b>對方接受</b>：對方會收到飛鴿傳書，${30} 分鐘內到這裡按「接受」。接受就代表同意比這個科目。</li>
        <li><b>一起開始</b>：兩個人都按「⚔️ 我準備好了」，倒數 3 秒後同時開始，兩個人的題目完全一樣。</li>
        <li><b>作答</b>：每題四選一、限時 <b>${SEC} 秒</b>。<b>答錯或超時就停止</b>，最多 ${MAX_Q} 題。</li>
        <li><b>勝負</b>：答對題數多的人獲勝；一樣多的話，<b>總作答時間比較短</b>的人獲勝。<b>兩個人都沒有答對 3 題以上，這場不算數</b>（沒有點數，今天可以再比一次）。</li>
        <li><b>獎勵</b>：獲勝的人得到 <b>商店點數 1 點</b>，座位表上名字旁邊出現 <b>👑 皇冠</b>；輸的人出現 <b>😵 昏頭</b>的圖示。都顯示一天，同一場比賽的皇冠和昏頭是同一種顏色，點一下可以再看一次比賽結果。</li>
        <li><b>限制</b>：同一對同學<b>每天只能比 1 場</b>（誰挑戰誰都算）。比賽中請不要離開 App，離開也不會暫停計時。</li>
      </ol></details>`;
  }
  function render() {
    const root = $('#arenaRoot');
    if (!root) return;
    if (!S) { root.innerHTML = `${rulesHtml()}<div class="panel"><p class="muted">讀取中…</p></div>`; return; }
    let h = rulesHtml();
    const me = S.me, mine = S.mine || [];
    if (canPlay()) {
      const inv = mine.filter(x => x.status === '邀請' && x.b === me), out = mine.filter(x => x.status === '邀請' && x.a === me);
      const acc = mine.filter(x => x.status === '接受' || x.status === '進行中');
      acc.forEach(x => {
        const opp = x.a === me ? x.b : x.a, meReady = x.a === me ? x.readyA : x.readyB, oppReady = x.a === me ? x.readyB : x.readyA;
        h += `<div class="panel ar-match" style="--ac:${colorOf(x.id)}"><div class="ar-vs"><b>${esc(nm(me))}</b><span>⚔️</span><b>${esc(nm(opp))}</b></div>
          <div class="center muted small">${SUBJ[x.subj]}擂台賽</div>
          <div class="ar-ready"><span class="${meReady ? 'on' : ''}">${meReady ? '✅ 你準備好了' : '⏳ 你還沒準備'}</span><span class="${oppReady ? 'on' : ''}">${oppReady ? '✅ 對方準備好了' : '⏳ 等對方準備'}</span></div>
          ${x.status === '進行中' ? '<p class="center"><b>比賽進行中…</b></p>' : `<div class="actions"><button type="button" class="btn btn--primary wide big" data-ar="ready" data-id="${esc(x.id)}"${meReady ? ' disabled' : ''}>⚔️ 我準備好了</button></div>
          <button type="button" class="link-btn" data-ar="cancel" data-id="${esc(x.id)}">取消這場比賽</button>`}</div>`;
      });
      inv.forEach(x => {
        h += `<div class="panel ar-inv" style="--ac:${colorOf(x.id)}"><p class="ar-big">⚔️ <b>${esc(nm(x.a))}</b> 向你發起 <b>${SUBJ[x.subj]}擂台賽</b> 挑戰！</p>
          <div class="actions"><button type="button" class="btn btn--primary" data-ar="yes" data-id="${esc(x.id)}">接受挑戰</button><button type="button" class="btn" data-ar="no" data-id="${esc(x.id)}">這次不要</button></div></div>`;
      });
      out.forEach(x => {
        h += `<div class="panel ar-out"><p>⏳ 等 <b>${esc(nm(x.b))}</b> 回覆你的 ${SUBJ[x.subj]}擂台賽挑戰…</p><button type="button" class="link-btn" data-ar="cancel" data-id="${esc(x.id)}">取消挑戰</button></div>`;
      });
      const played = new Set(S.played || []);
      const opts = A.students().filter(k => k !== me).map(k => `<option value="${esc(k)}"${played.has(k) ? ' disabled' : ''}>${esc(nm(k))}${played.has(k) ? '（今天比過了）' : ''}</option>`).join('');
      h += `<div class="panel"><h3>⚔️ 發起挑戰</h3>
        <label class="lv-f"><span>挑戰誰？</span><select id="arTo"><option value="">— 選一位同學 —</option>${opts}</select></label>
        <div class="ar-subj">${['en', 'jp'].map(s => `<button type="button" data-ar="subj" data-v="${s}" aria-pressed="${subj === s}">${s === 'en' ? '🔤 英文單字' : '🗾 日文五十音'}</button>`).join('')}</div>
        <div class="actions"><button type="button" class="btn btn--primary wide" data-ar="challenge">送出挑戰</button></div>
        <p class="muted small">我的戰績：👑 勝 ${S.wins || 0} 場・😵 敗 ${S.losses || 0} 場</p></div>`;
    } else if (A.isTeacher()) {
      h += `<div class="panel"><p class="muted small">導師可以看比賽結果；擂台賽只有同學可以參加。</p></div>`;
    }
    const rec = (S.recent || []).slice().sort((a, b) => b.end - a.end);
    h += `<div class="panel"><h3>🏆 最近 24 小時的比賽</h3>${rec.length ? `<ul class="ar-list">${rec.map(x => `<li style="--ac:${colorOf(x.id)}"><i></i>${resultText(x)}</li>`).join('')}</ul>` : '<p class="muted small">還沒有比賽。</p>'}</div>`;
    root.innerHTML = h;
  }
  const resultText = x => {
    const t = new Date(x.end), hm = `${A.pad2(t.getHours())}:${A.pad2(t.getMinutes())}`;
    if (x.win === '平手') return `🤝 ${esc(nm(x.a))} 和 ${esc(nm(x.b))} 的${SUBJ[x.subj]}擂台賽平手（${x.na}：${x.nb}）<span class="muted small">${hm}</span>`;
    if (x.win === '不算數') return `⚪ ${esc(nm(x.a))} 和 ${esc(nm(x.b))} 的${SUBJ[x.subj]}擂台賽不算數（${x.na}：${x.nb}，都沒答對 3 題以上）<span class="muted small">${hm}</span>`;
    const lose = x.win === x.a ? x.b : x.a, wn = x.win === x.a ? x.na : x.nb, ln = x.win === x.a ? x.nb : x.na;
    return `👑 <b>${esc(nm(x.win))}</b> 在${SUBJ[x.subj]}擂台賽打敗了 ${esc(nm(lose))}（${wn}：${ln}）<span class="muted small">${hm}</span>`;
  };

  $('#arenaRoot').addEventListener('toggle', e => { if (e.target.classList?.contains('ar-rules')) { rulesOpen = e.target.open; if (!rulesOpen) store.set('indoor.arena.rulesSeen', true); } }, true);
  $('#arenaRoot').addEventListener('click', async e => {
    const b = e.target.closest('[data-ar]');
    if (!b || b.disabled) return;
    const act = b.dataset.ar, id = b.dataset.id;
    if (act === 'subj') { subj = b.dataset.v; b.parentElement.querySelectorAll('button').forEach(y => y.setAttribute('aria-pressed', y === b)); return; }
    let call = null;
    if (act === 'challenge') {
      const to = $('#arTo').value;
      if (!to) return toast('請先選一位同學');
      if (!await A.ask(`向 ${nm(to)} 發起「${SUBJ[subj]}擂台賽」挑戰？\n對方接受後，兩個人都按「我準備好了」就開始。`, '送出挑戰')) return;
      call = ['arenaChallenge', { to, subj }, `⚔️ 已經向 ${nm(to)} 發出挑戰，等對方接受`];
    }
    if (act === 'yes') call = ['arenaRespond', { id, act: 'yes' }, '已接受！按「⚔️ 我準備好了」就可以開始'];
    if (act === 'no') call = ['arenaRespond', { id, act: 'no' }, '已婉拒這次挑戰'];
    if (act === 'cancel') { if (!await A.ask('取消這場擂台賽？', '取消比賽', true)) return; call = ['arenaRespond', { id, act: 'cancel' }, '已取消']; }
    if (act === 'ready') { A.vocabWarm?.(); call = ['arenaReady', { id }, '準備好了！等對方也準備好就開始']; }
    if (!call) return;
    b.disabled = true;
    try { const t0 = Date.now(); S = await A.api(call[0], call[1]); off = S.now - (t0 + Date.now()) / 2; toast(call[2]); after(); } catch (err) { toast(err.message); b.disabled = false; }
  });

  // ── 題目：用伺服器給的種子產生，兩個人的題目一模一樣 ──
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  async function makeQuestions(s, seed) {
    const r = rng(seed), pick = a => a[Math.floor(r() * a.length)];
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const out = [], used = new Set();
    if (s === 'en') {
      const list = await A.vocabAll();
      for (let i = 0; i < MAX_Q; i++) {
        let ans = pick(list);
        for (let k = 0; used.has(ans.w) && k < 20; k++) ans = pick(list);
        used.add(ans.w);
        const same = list.filter(x => x.p === ans.p), opts = new Set([ans.zh]);
        for (let j = 0; opts.size < 4 && j < 80; j++) opts.add(pick(j < 50 && same.length > 8 ? same : list).zh);
        out.push({ q: ans.w, hint: ans.p, a: ans.zh, opts: shuffle([...opts]), en: true });
      }
    } else {
      const list = [...A.kanaAll(false), ...A.kanaAll(true)];
      for (let i = 0; i < MAX_Q; i++) {
        let ans = pick(list);
        for (let k = 0; used.has(ans[0]) && k < 20; k++) ans = pick(list);
        used.add(ans[0]);
        const opts = new Set([ans[1]]);
        for (let j = 0; opts.size < 4 && j < 80; j++) opts.add(pick(list)[1]);
        out.push({ q: ans[0], hint: '', a: ans[1], opts: shuffle([...opts]), en: false });
      }
    }
    return out;
  }

  // ── 比賽畫面 ──
  const doneIds = new Set();
  let box = null;
  function ensureBox() {
    if (box) return box;
    box = document.createElement('div');
    box.id = 'arenaGame'; box.hidden = true;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    document.body.appendChild(box);
    box.addEventListener('click', onGameClick);
    return box;
  }
  async function startGame(x) {
    const me = S.me, opp = x.a === me ? x.b : x.a;
    game = { id: x.id, subj: x.subj, opp, start: x.start, qs: null, i: 0, n: 0, ms: 0, over: false, oppP: null, phase: 'count', t0: 0, sent: '', sending: false };
    ensureBox().hidden = false;
    document.body.classList.add('ww-open');
    paintGame();
    try { game.qs = await makeQuestions(x.subj, x.seed); } catch { toast('題目讀取失敗，請確認網路'); game.qs = []; }
    countdown();
  }
  function countdown() {
    if (!game) return;
    const left = game.start - serverNow();
    if (left > 0) { game.cd = Math.ceil(left / 1000); paintGame(); setTimeout(countdown, Math.min(250, left)); return; }
    game.phase = 'play';
    nextQ();
  }
  let qTimer = null, barRaf = null;
  function nextQ() {
    if (!game || game.over) return;
    if (game.i >= Math.min(MAX_Q, game.qs.length)) return finish('全部答完了！');
    game.chose = ''; game.t0 = performance.now();
    paintGame();
    clearTimeout(qTimer);
    qTimer = setTimeout(() => answer(null), SEC * 1000);
    const bar = box.querySelector('.ag-bar i');
    if (bar) { bar.style.transition = 'none'; bar.style.width = '100%'; requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${SEC}s linear`; bar.style.width = '0%'; })); }
  }
  function answer(v) {
    if (!game || game.over || game.phase !== 'play' || game.chose) return;
    clearTimeout(qTimer);
    const q = game.qs[game.i], dt = Math.min(SEC * 1000, Math.round(performance.now() - game.t0));
    game.chose = v ?? '⏰';
    if (v === q.a) {
      game.n++; game.ms += dt;
      send(false);
      paintGame(true);
      setTimeout(() => { if (game && !game.over) { game.i++; nextQ(); } }, 350);
    } else {
      paintGame(true);
      setTimeout(() => finish(v == null ? '時間到了！' : '答錯了！'), 1200);
    }
  }
  function finish(why) {
    if (!game || game.over) return;
    game.over = true; game.phase = 'wait'; game.why = why;
    clearTimeout(qTimer);
    send(true);
    paintGame();
  }
  // 送進度：一次只送一個；送出去的期間有新的就等一下再送最新的
  async function send(done) {
    if (!game) return;
    game.want = { n: game.n, ms: game.ms, done: done || game.want?.done || false };
    if (game.sending) return;
    game.sending = true;
    while (game && game.want && JSON.stringify(game.want) !== game.sent) {
      const w = game.want, g = game;
      try { const r = await A.api('arenaProgress', { id: g.id, ...w }); g.sent = JSON.stringify(w); if (g === game) { S = r; after(); } }
      catch { await new Promise(r => setTimeout(r, 1500)); }
    }
    if (game) game.sending = false;
  }
  function gameUpdate(x) {
    if (!game) return;
    game.oppP = x.opp || game.oppP;
    if (x.status === '完成') { game.result = x; game.phase = 'result'; doneIds.add(x.id); clearTimeout(qTimer); A.emit('arenaDone'); }
    if (game.phase !== 'play') paintGame(); else paintScore();
  }
  function scoreHtml() {
    const o = game.oppP;
    return `<div class="ag-score" style="--ac:${colorOf(game.id)}"><span><b>你</b> ${game.n}</span><span class="ag-subj">${SUBJ[game.subj]}擂台賽</span><span>${esc(code(game.opp))} ${o ? o.n : 0}${o?.done ? ' 🏁' : ''}</span></div>`;
  }
  function paintScore() { const el = box?.querySelector('.ag-score'); if (el) el.outerHTML = scoreHtml(); }
  function paintGame(showAns) {
    if (!game || !box) return;
    let body = '';
    if (game.phase === 'count') {
      body = `<div class="ag-vs"><b>${esc(nm(S.me))}</b><span>⚔️</span><b>${esc(nm(game.opp))}</b></div><div class="ag-cd">${game.cd > 3 ? '準備…' : game.cd || '…'}</div><p class="muted center">每題 ${SEC} 秒，答錯就停止</p>`;
    } else if (game.phase === 'play') {
      const shownQ = game.qs[game.i];
      body = `<div class="ag-bar"><i></i></div><div class="ag-no">第 ${game.i + 1} 題</div>
        <div class="ag-q${shownQ.en ? '' : ' kana'}">${esc(shownQ.q)}</div><div class="muted small center">${esc(shownQ.hint)}${shownQ.en ? '' : '　這個假名怎麼唸？'}</div>
        <div class="ag-opts">${shownQ.opts.map(o => {
          let cls = '';
          if (showAns && game.chose) cls = o === shownQ.a ? ' right' : o === game.chose ? ' wrong' : ' dim';
          return `<button type="button" class="ag-opt${cls}" data-v="${esc(o)}"${game.chose ? ' disabled' : ''}>${esc(o)}</button>`;
        }).join('')}</div>`;
    } else if (game.phase === 'wait') {
      body = `<div class="ag-end">${esc(game.why || '')}</div><p class="center">你答對 <b>${game.n}</b> 題</p><p class="muted center">⏳ 等 ${esc(nm(game.opp))} 比完…（對方目前 ${game.oppP?.n || 0} 題）</p>`;
    } else if (game.phase === 'result') {
      const x = game.result, me = S.me, mine = x.a === me ? x.ra : x.rb, theirs = x.a === me ? x.rb : x.ra;
      const win = x.win === me, tie = x.win === '平手', none = x.win === '不算數';
      body = `<div class="ag-res ${tie || none ? 'tie' : win ? 'win' : 'lose'}">${none ? '⚪' : tie ? '🤝' : win ? '👑' : '😵'}</div>
        <h2 class="center">${none ? '這場不算數' : tie ? '平手！' : win ? '你贏了！' : '輸了，再接再厲！'}</h2>
        ${none ? '<p class="center muted">兩個人都沒有答對 3 題以上，這場不算數（沒有點數、座位上也不顯示）。今天可以再比一次！</p>' : ''}
        <p class="center">你 <b>${mine?.n ?? game.n}</b> 題（${((mine?.ms ?? game.ms) / 1000).toFixed(1)} 秒）・${esc(nm(game.opp))} <b>${theirs?.n ?? 0}</b> 題（${((theirs?.ms || 0) / 1000).toFixed(1)} 秒）</p>
        ${none ? '' : win ? '<p class="center">獲得 <b>商店點數 1 點</b>，座位上名字旁邊出現了皇冠 👑</p>' : tie ? '' : '<p class="center muted">座位上名字旁邊出現昏頭的圖示 😵（顯示一天）。多用「📚 小練習」練習，明天再來！</p>'}
        <div class="actions"><button type="button" class="btn btn--primary wide" data-ag="close">好</button></div>`;
    }
    box.innerHTML = `<div class="ag-card">${game.phase === 'count' ? '' : scoreHtml()}${body}</div>`;
  }
  function onGameClick(e) {
    const c = e.target.closest('[data-ag="close"]');
    if (c) { box.hidden = true; document.body.classList.remove('ww-open'); game = null; render(); schedule(); return; }
    const b = e.target.closest('.ag-opt');
    if (b && !b.disabled) answer(b.dataset.v);
  }

  // ── 座位表：名字右邊的小圖示（一天）——贏的人皇冠、輸的人昏頭；同一場比賽同一個顏色；點一下再看比賽結果 ──
  const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 4.6 7.5 9.4 12 12 5l2.6 7 4.8-4.5L21 18Z" fill="currentColor"/><rect x="3" y="19.2" width="18" height="2.6" rx="1.2" fill="currentColor"/></svg>';
  const DIZZY = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.6"/><path d="m7.2 8 3 3m0-3-3 3m6.6-3 3 3m0-3-3 3M7.6 16.2q1.1-1.6 2.2 0t2.2 0 2.2 0 2.2 0"/></svg>';
  A.arenaBadges = k => {
    if (!S?.recent?.length) return '';
    const w = S.recent.filter(x => x.win === k).sort((a, b) => b.end - a.end)[0];
    const l = S.recent.filter(x => x.win && x.win !== '平手' && x.win !== '不算數' && x.win !== k && (x.a === k || x.b === k)).sort((a, b) => b.end - a.end)[0];
    let h = '';
    if (w) h += `<span class="ar-ico" data-arena="${esc(w.id)}" style="color:${colorOf(w.id)}" title="擂台賽獲勝" role="button">${CROWN}</span>`;
    if (l) h += `<span class="ar-ico" data-arena="${esc(l.id)}" style="color:${colorOf(l.id)}" title="擂台賽落敗" role="button">${DIZZY}</span>`;
    return h;
  };
  A.arenaLost = k => !!S?.recent?.some(x => x.win && x.win !== '平手' && x.win !== '不算數' && x.win !== k && (x.a === k || x.b === k));
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-arena]');
    if (!t) return;
    e.stopPropagation(); e.preventDefault();
    const x = S?.recent?.find(y => y.id === t.dataset.arena);
    if (x) flash([x], 2500);
  }, true);

  // ── 上方的比賽消息：打開 App 時出現約 1 秒後自動消失；點皇冠或昏頭可以再看 ──
  let msgT = null;
  function flash(list, ms) {
    let el = $('#arenaMsg');
    if (!el) { el = document.createElement('div'); el.id = 'arenaMsg'; document.body.appendChild(el); el.addEventListener('click', () => { el.classList.remove('show'); }); }
    const top = list.slice(0, 4);
    el.innerHTML = `${top.map(x => `<div style="--ac:${colorOf(x.id)}"><i></i>${resultText(x)}</div>`).join('')}${list.length > 4 ? `<div class="muted small">還有 ${list.length - 4} 場，到「⚔️ 擂台」看全部</div>` : ''}`;
    el.classList.add('show');
    clearTimeout(msgT);
    msgT = setTimeout(() => el.classList.remove('show'), ms);
  }
  A.on('start', async () => {
    if (A.isGuest()) return;
    await new Promise(r => setTimeout(r, 1200));
    await load();
    const rec = (S?.recent || []).slice().sort((a, b) => b.end - a.end);
    if (rec.length) flash(rec, rec.length > 2 ? 1800 : 1200);
  });
  A.tabHooks.arena = () => { render(); if (!S || Date.now() - sAt > 5000) load(); else schedule(); };
  A.addPrefetch('arena', () => (A.isGuest() ? null : load()));

  // ── 測試模式：存在這台裝置；對手是電腦（2 秒後自動接受、自動準備、隨機答對幾題）──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    if (!/^arena/.test(action)) return prevTest ? prevTest(action, p) : null;
    const KEY = 'indoor.arena.v1.test', all = store.get(KEY, []), now = Date.now();
    const me = A.me() || (A.students()[0] || '');
    const find = id => all.find(x => x.id === id);
    const botP = x => { const n = Math.min(x.botN, Math.max(0, Math.floor((now - x.start) / 1800))); return { n, ms: n * 1800, done: n >= x.botN && now - x.start > x.botN * 1800 + 1500 }; };
    if (action === 'arenaChallenge') {
      if (all.some(x => x.b === p.to && x.a === me && x.day === A.fmtDate(new Date()) && x.status !== '拒絕' && x.status !== '取消')) throw new Error('你們今天已經比過了，明天再來挑戰！');
      all.push({ id: 't' + now.toString(36), a: me, b: p.to, subj: p.subj, status: '邀請', t: now, day: A.fmtDate(new Date()), botN: 2 + Math.floor(Math.random() * 10) });
    }
    if (action === 'arenaRespond') { const x = find(p.id); x.status = p.act === 'yes' ? '接受' : p.act === 'no' ? '拒絕' : '取消'; }
    if (action === 'arenaReady') { const x = find(p.id); x.readyMe = true; if (x.status === '接受') { x.status = '進行中'; x.seed = 1 + Math.floor(Math.random() * 2e9); x.start = now + 4000; } }
    if (action === 'arenaProgress') { const x = find(p.id); if (x) x.mineP = { n: p.n, ms: p.ms, done: !!p.done }; }
    all.forEach(x => {
      if (x.status === '邀請' && now - x.t > 2000) x.status = '接受';
      if (x.status === '進行中' && x.mineP?.done && botP(x).done) {
        const m = x.mineP, o = botP(x);
        x.status = '完成'; x.end = now; x.ra = m; x.rb = o;
        x.win = Math.max(m.n, o.n) < 3 ? '不算數' : m.n !== o.n ? (m.n > o.n ? x.a : x.b) : m.ms !== o.ms ? (m.ms < o.ms ? x.a : x.b) : '平手';
      }
    });
    store.set(KEY, all);
    const mine = all.filter(x => ['邀請', '接受', '進行中'].includes(x.status) || (x.status === '完成' && now - x.end < 600e3))
      .map(x => ({ id: x.id, a: x.a, b: x.b, subj: x.subj, status: x.status, start: x.start || 0, seed: x.status === '進行中' ? x.seed : 0, readyA: !!x.readyMe, readyB: x.status !== '邀請', opp: x.status === '完成' ? x.rb : x.start ? botP(x) : null, win: x.win || '', ra: x.ra || null, rb: x.rb || null }));
    const recent = all.filter(x => x.status === '完成' && now - x.end < 864e5).map(x => ({ id: x.id, a: x.a, b: x.b, subj: x.subj, win: x.win, na: x.ra.n, nb: x.rb.n, end: x.end }));
    return { ok: true, me, now, mine, recent, wins: recent.filter(x => x.win === me).length, losses: recent.filter(x => x.win !== me && x.win !== '平手' && x.win !== '不算數').length, played: all.filter(x => x.day === A.fmtDate(new Date()) && x.status !== '拒絕' && x.status !== '取消').map(x => x.b) };
  };
})();
