'use strict';
/* 隨機抽籤：上課時抽同學回答問題 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  const LSK = 'indoor.draw.v1' + A.SFX;
  const st = Object.assign({ n: 1, scope: '', noRepeat: true, drawn: [], absent: [], history: [] }, store.get(LSK, {}));
  const saveSt = () => store.set(LSK, st);
  // 抽籤紀錄只保留最近 30 天（每次打開、每次抽籤時清掉太舊的）
  const KEEP_DAYS = 30;
  function pruneHistory() {
    const since = Date.now() - KEEP_DAYS * 86400e3;
    st.history = st.history.filter(x => (x.ts || Date.now()) >= since).slice(0, 500);
    saveSt();
  }
  st.history.forEach(x => { x.ts ||= Date.now(); }); // 舊紀錄沒有時間戳：從現在開始算 30 天
  pruneHistory();
  let rolling = false;
  let last = [];
  // 全班共用的抽籤紀錄（雲端）；學生只能看
  const canDraw = () => !A.isStudent();
  let log = [], logTop = '', lastBy = '', lastTime = '';
  async function loadLog(reveal) {
    try {
      const r = await A.api('getDrawLog');
      log = r.log || [];
      const top = log[0];
      const isNew = top && top.id !== logTop;
      logTop = top?.id || '';
      if (top && (isNew || !last.length) && !rolling) { last = top.k; lastBy = top.by; lastTime = top.t; }
      if (A.currentTab() === 'draw' && !rolling) { render(); if (isNew && reveal) $('#stage')?.classList.add('reveal'); }
    } catch { /* 讀不到就先用手機上的 */ }
  }
  let pollT = null;
  function poll() {
    clearTimeout(pollT);
    if (A.currentTab() !== 'draw' || document.hidden) return;
    pollT = setTimeout(async () => { await loadLog(true); poll(); }, 15000);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && A.currentTab() === 'draw') { loadLog(true); poll(); } });
  // 同學在商店買的抽籤卡：轉移卡（替身）、必中卡（指定第一位）
  let fx = { transfers: [], sure: [] }, fxAt = 0;
  async function loadFx(force) {
    if (A.isStudent() || (!force && Date.now() - fxAt < 60e3)) return;
    try { const r = await A.api('getDrawFx'); fx = { transfers: r.transfers || [], sure: r.sure || [] }; fxAt = Date.now(); } catch { /* 讀不到就照一般抽籤 */ }
  }
  /** 套用抽籤卡：先必中卡（第一位換成指定的人），再轉移卡（抽到的人換成替身）；回傳要播的動畫 */
  function applyFx(result) {
    const evs = [];
    // 抽籤卡只在這次抽的範圍裡生效（例如只抽多媒時，指定資料科同學的必中卡先不發動）
    const ok = k => all().includes(k) && inScope(k) && !st.absent.includes(k);
    const sure = fx.sure.find(c => ok(c.target));
    if (sure && result.length && result[0] !== sure.target) {
      const from = result[0], j = result.indexOf(sure.target);
      if (j > 0) result[j] = from;
      result[0] = sure.target;
      evs.push({ i: 0, kind: 'sure', from, to: sure.target, by: sure.by });
      fx.sure = fx.sure.filter(c => c !== sure);
      A.api('drawUsed', { id: sure.id }).catch(() => {});
    }
    const now = Date.now();
    result.forEach((k, i) => {
      const tr = fx.transfers.filter(x => x.from === k && now - x.t < 10 * 86400e3).sort((a, b) => a.t - b.t).pop();
      if (tr && ok(tr.to) && !result.includes(tr.to)) { result[i] = tr.to; evs.push({ i, kind: 'transfer', from: k, to: tr.to, by: k }); }
    });
    return evs;
  }
  // 華麗的切換動畫：光環旋轉、閃光、翻牌換人
  async function playFx(ev, shown) {
    const stage = $('#stage');
    const el = stage?.children[ev.i];
    if (!el) return;
    const sure = ev.kind === 'sure';
    const banner = document.createElement('div');
    banner.className = 'fx-banner ' + ev.kind;
    banner.innerHTML = sure ? '✨ 抽籤必中卡發動！✨' : `🔄 抽籤轉移卡：${esc(ev.from)} 的替身上場！`;
    stage.append(banner);
    el.classList.add('fx-charge', ev.kind);
    await new Promise(r => setTimeout(r, sure ? 1300 : 900));
    el.classList.add('fx-flip');
    await new Promise(r => setTimeout(r, 300));
    shown[ev.i] = ev.to;
    const n = document.createElement('div');
    n.innerHTML = card(ev.to);
    const nc = n.firstElementChild;
    nc.classList.add('fx-land', ev.kind);
    el.replaceWith(nc);
    await new Promise(r => setTimeout(r, sure ? 1500 : 1100));
    banner.remove();
    nc.classList.remove('fx-land');
  }

  const all = () => A.students();
  const depts = () => [...new Set(all().map(k => A.parseKey(k).code.replace(/\d+$/, '')).filter(Boolean))];
  const inScope = k => !st.scope || A.parseKey(k).code.startsWith(st.scope);
  const pool = () => all().filter(k => inScope(k) && !st.absent.includes(k) && !(st.noRepeat && st.drawn.includes(k)));

  // 用加密等級的亂數，公平
  function randInt(n) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  }
  function pickN(list, n) {
    const a = [...list], out = [];
    while (out.length < n && a.length) out.push(a.splice(randInt(a.length), 1)[0]);
    return out;
  }

  function card(k, cls = '') {
    const { code, name } = A.parseKey(k);
    const seat = A.seatOf?.(k);
    return `<div class="dcard ${cls}"><span class="face">${A.faceHtml(k)}</span><div class="dname"><b>${esc(code)}</b>${esc(name)}</div>${seat && !cls ? `<div class="dseat">座位 ${seat}</div>` : ''}</div>`;
  }

  function render() {
    const root = $('#drawRoot');
    if (!all().length) {
      root.innerHTML = `<div class="panel"><p class="muted">讀取學生名單中…</p></div>`;
      A.loadStudents().then(render).catch(e => { root.innerHTML = `<div class="panel"><p class="lock-msg">無法讀取名單：${esc(e.message)}</p></div>`; });
      return;
    }
    const p = pool();
    const who = lastBy ? `<p class="muted small center draw-who">最近一次：${esc(lastTime)}｜${esc(lastBy)} 抽的</p>` : '';
    if (!canDraw()) {
      root.innerHTML = `<div class="draw"><div class="stage" id="stage">${last.length ? last.map(k => card(k)).join('') : `<div class="stage-empty">🎲<br>還沒有抽籤</div>`}</div>${who}${histHtml()}</div>`;
      return;
    }
    let h = `<div class="draw">
      <div class="stage" id="stage">${last.length ? last.map(k => card(k)).join('') : `<div class="stage-empty">🎲<br>按下「抽籤」</div>`}</div>${who}
      <div class="draw-ctrl">
        <div class="stepper" aria-label="抽幾人"><span>抽</span><button type="button" class="btn" data-d="n-" aria-label="少一人">－</button><b>${st.n}</b><button type="button" class="btn" data-d="n+" aria-label="多一人">＋</button><span>人</span></div>
        <div class="subsw small-sw">${['', ...depts()].map(d => `<button type="button" data-scope="${esc(d)}" aria-selected="${st.scope === d}">${d ? esc(d) : '全班'}</button>`).join('')}</div>
        <label class="switch-row small"><span class="switch"><input type="checkbox" id="noRepeat"${st.noRepeat ? ' checked' : ''}><span></span></span>抽過的不再抽</label>
        <button type="button" class="btn btn--primary go" data-d="go"${rolling ? ' disabled' : ''}>🎲 抽籤</button>
        <div class="draw-meta small muted">可抽 ${p.length} 人${st.noRepeat ? `｜已抽過 ${st.drawn.filter(inScope).length} 人` : ''}
          <button type="button" class="link-btn" data-d="reset">全部重來</button>
          ${last.length ? `<button type="button" class="link-btn" data-d="seat">在座位表上看</button>` : ''}
          <button type="button" class="link-btn" data-d="full">${$('#drawRoot').classList.contains('present') ? '✕ 離開全螢幕' : '⛶ 全螢幕（投影用）'}</button></div>
      </div>`;
    h += `<details class="draw-roster"><summary>名單（點名字設為缺席，不會被抽到${st.absent.length ? `｜缺席 ${st.absent.length} 人` : ''}）</summary><div class="chips">`;
    all().filter(inScope).forEach(k => {
      const cls = st.absent.includes(k) ? 'absent' : st.drawn.includes(k) ? 'drawn' : '';
      h += `<button type="button" class="nm ${cls}" data-abs="${esc(k)}">${esc(k)}</button>`;
    });
    h += `</div></details>`;
    h += histHtml();
    root.innerHTML = h + `</div>`;
  }
  // 抽籤紀錄（全班共用）：時間、誰抽的、結果、抽籤卡事件
  function histHtml() {
    if (!log.length) return '';
    return `<div class="hist-head"><h3>抽籤紀錄</h3><span class="muted small">全班都看得到・保留 ${KEEP_DAYS} 天</span>${A.isTeacher() ? '<button type="button" class="link-btn" data-d="clearHist">清空紀錄</button>' : ''}</div>
      <ol class="hist">${log.map(x => `<li><span class="muted small">${esc(x.t)}・${esc(x.by)}</span> ${x.k.map(esc).join('、')}${x.fx?.length ? `<div class="hist-fx">${x.fx.map(f => `<div>${esc(f)}</div>`).join('')}</div>` : ''}</li>`).join('')}</ol>`;
  }

  async function go() {
    const p = pool();
    if (!p.length) return toast(st.noRepeat ? '大家都抽過了！按「全部重來」可以重新開始' : '沒有可以抽的同學');
    const n = Math.min(st.n, p.length);
    if (n < st.n) toast(`只剩 ${p.length} 人可以抽`);
    // 抽之前先讀最新的抽籤卡（避免兩台裝置同時抽、同一張必中卡發動兩次）；網路慢就用手機上的
    await Promise.race([loadFx(true), new Promise(r => setTimeout(r, 3000))]);
    const result = pickN(p, n);
    const shown = [...result];              // 先顯示原本抽到的人，再播抽籤卡的動畫
    const evs = applyFx(result);
    rolling = true;
    render();
    const stage = $('#stage');
    // 名字快速跳動，慢慢停下來
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = reduce ? 1 : 16;
    for (let i = 0; i < steps; i++) {
      stage.innerHTML = pickN(p, n).map(k => card(k, 'spin')).join('');
      await new Promise(r => setTimeout(r, 40 + i * i * 1.4));
    }
    if (evs.length) {
      stage.innerHTML = shown.map(k => card(k)).join('');
      stage.classList.add('reveal');
      await new Promise(r => setTimeout(r, 700));
      for (const ev of evs) await playFx(ev, shown);
    }
    last = result;
    lastBy = A.isTeacher() ? A.D.teacherLabel : A.isGuest() ? '任課老師' : A.me(); lastTime = A.fmtTime(new Date());
    st.drawn.push(...result.filter(k => !st.drawn.includes(k)));
    // 抽籤紀錄：時間、結果、被抽籤卡改掉的事件（誰用了什麼卡、原本抽到誰、換成誰）
    const now = new Date();
    st.history.unshift({ ts: now.getTime(), t: `${A.pad2(now.getMonth() + 1)}/${A.pad2(now.getDate())} ${A.fmtTime(now)}`, k: result,
      fx: evs.map(e => (e.kind === 'sure' ? `🎯 抽籤必中卡（${e.by} 使用）：原本抽到 ${e.from} → 換成 ${e.to}` : `🔄 抽籤轉移卡（${e.by} 使用）：抽到 ${e.from} → 由替身 ${e.to} 上場`)) });
    pruneHistory();
    saveSt();
    rolling = false;
    try {
      const r = await A.api('addDrawLog', { k: result, fx: st.history[0].fx });
      log = r.log || log; logTop = log[0]?.id || logTop;
    } catch (err) { toast('抽籤紀錄沒有存到雲端：' + err.message); }
    render();
    if (!evs.length) $('#stage').classList.add('reveal');
    loadFx(true);
  }

  $('#drawRoot').addEventListener('click', e => {
    const b = e.target.closest('[data-d],[data-scope],[data-abs]');
    if (!b || rolling) return;
    if (b.dataset.scope != null) { st.scope = b.dataset.scope; saveSt(); return render(); }
    if (b.dataset.abs) {
      const k = b.dataset.abs, i = st.absent.indexOf(k);
      if (i >= 0) st.absent.splice(i, 1); else st.absent.push(k);
      saveSt();
      const open = $('.draw-roster')?.open;
      render();
      if (open) $('.draw-roster').open = true;
      return;
    }
    const d = b.dataset.d;
    if (d === 'n-') st.n = Math.max(1, st.n - 1);
    else if (d === 'n+') st.n = Math.min(10, st.n + 1);
    else if (d === 'go') return go();
    else if (d === 'reset') {
      A.ask('清除「抽過」與缺席紀錄，全部重來？', '全部重來', true).then(ok => {
        if (!ok) return;
        st.drawn = []; st.absent = []; last = []; // 抽籤紀錄另外用「清空紀錄」清
        saveSt(); render();
      });
      return;
    }
    else if (d === 'seat') return A.highlightSeats(last);
    else if (d === 'clearHist') {
      A.ask('清空全班的抽籤紀錄？\n（App 上會清掉；試算表「抽籤紀錄」仍然保留）', '清空', true).then(async ok => {
        if (!ok) return;
        try { await A.api('clearDrawLog'); log = []; st.history = []; saveSt(); render(); toast('已清空抽籤紀錄'); } catch (err) { toast(err.message); }
      });
      return;
    }
    else if (d === 'full') return present(!$('#drawRoot').classList.contains('present'));
    saveSt();
    render();
  });
  $('#drawRoot').addEventListener('change', e => {
    if (e.target.id === 'noRepeat') { st.noRepeat = e.target.checked; saveSt(); render(); }
  });
  // 空白鍵／Enter 也可以抽（接投影機、用簡報筆時方便）
  // 全螢幕（投影用）：iPhone 不能讓網頁全螢幕，所以用 App 自己的全畫面；電腦和 Android 會再加上瀏覽器的全螢幕
  function present(on) {
    $('#drawRoot').classList.toggle('present', on);
    document.body.classList.toggle('presenting', on);
    try {
      if (on) document.documentElement.requestFullscreen?.().then(() => { nativeFs = true; }).catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    } catch { /* 不支援就只用 App 的全畫面 */ }
    if (!on) nativeFs = false;
    render();
  }
  let nativeFs = false;
  // 使用者用瀏覽器的方式離開全螢幕時，App 的全畫面也一起關掉
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && nativeFs && $('#drawRoot').classList.contains('present')) present(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#drawRoot').classList.contains('present')) return present(false);
    if (A.currentTab() !== 'draw' || !$('#sheet').hidden || e.target.closest('input,select,textarea,button')) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') { e.preventDefault(); if (!rolling) go(); }
  });

  A.tabHooks.draw = () => { render(); A.ensureFaces?.(); if (canDraw()) loadFx(true); loadLog(false); poll(); };

  // ── 測試模式：紀錄存在這台裝置 ──
  const prevTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    const KEY = 'indoor.drawlog.v1.test';
    if (action === 'getDrawLog') return { ok: true, log: store.get(KEY, []) };
    if (action === 'addDrawLog') {
      const t = new Date();
      const row = { id: Math.random().toString(36).slice(2, 10), ts: t.getTime(), t: `${A.pad2(t.getMonth() + 1)}/${A.pad2(t.getDate())} ${A.fmtTime(t)}`, by: A.isTeacher() ? '導師' : A.isGuest() ? '任課老師' : A.me(), k: p.k, fx: p.fx || [] };
      store.set(KEY, [row, ...store.get(KEY, [])].slice(0, 300));
      return { ok: true, log: store.get(KEY, []) };
    }
    if (action === 'clearDrawLog') { store.set(KEY, []); return { ok: true, log: [] }; }
    return prevTest ? prevTest(action, p) : null;
  };
  const rerender = () => { if (A.currentTab() === 'draw' && !rolling) render(); };
  A.on('students', rerender);
  A.on('faces', rerender);
})();
