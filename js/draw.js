'use strict';
/* 隨機抽籤：上課時抽同學回答問題 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  const LSK = 'indoor.draw.v1' + A.SFX;
  const st = Object.assign({ n: 1, scope: '', noRepeat: true, drawn: [], absent: [], history: [] }, store.get(LSK, {}));
  const saveSt = () => store.set(LSK, st);
  let rolling = false;
  let last = [];

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
    let h = `<div class="draw">
      <div class="stage" id="stage">${last.length ? last.map(k => card(k)).join('') : `<div class="stage-empty">🎲<br>按下「抽籤」</div>`}</div>
      <div class="draw-ctrl">
        <div class="stepper" aria-label="抽幾人"><span>抽</span><button type="button" class="btn" data-d="n-" aria-label="少一人">－</button><b>${st.n}</b><button type="button" class="btn" data-d="n+" aria-label="多一人">＋</button><span>人</span></div>
        <div class="subsw small-sw">${['', ...depts()].map(d => `<button type="button" data-scope="${esc(d)}" aria-selected="${st.scope === d}">${d ? esc(d) : '全班'}</button>`).join('')}</div>
        <label class="switch-row small"><span class="switch"><input type="checkbox" id="noRepeat"${st.noRepeat ? ' checked' : ''}><span></span></span>抽過的不再抽</label>
        <button type="button" class="btn btn--primary go" data-d="go"${rolling ? ' disabled' : ''}>🎲 抽籤</button>
        <div class="draw-meta small muted">可抽 ${p.length} 人${st.noRepeat ? `｜已抽過 ${st.drawn.filter(inScope).length} 人` : ''}
          <button type="button" class="link-btn" data-d="reset">全部重來</button>
          ${last.length ? `<button type="button" class="link-btn" data-d="seat">在座位表上看</button>` : ''}
          <button type="button" class="link-btn" data-d="full">全螢幕</button></div>
      </div>`;
    h += `<details class="draw-roster"><summary>名單（點名字設為缺席，不會被抽到${st.absent.length ? `｜缺席 ${st.absent.length} 人` : ''}）</summary><div class="chips">`;
    all().filter(inScope).forEach(k => {
      const cls = st.absent.includes(k) ? 'absent' : st.drawn.includes(k) ? 'drawn' : '';
      h += `<button type="button" class="nm ${cls}" data-abs="${esc(k)}">${esc(k)}</button>`;
    });
    h += `</div></details>`;
    if (st.history.length) {
      h += `<h3>抽籤紀錄</h3><ol class="hist">${st.history.slice(0, 30).map(x => `<li><span class="muted small">${esc(x.t)}</span> ${x.k.map(esc).join('、')}</li>`).join('')}</ol>`;
    }
    root.innerHTML = h + `</div>`;
  }

  async function go() {
    const p = pool();
    if (!p.length) return toast(st.noRepeat ? '大家都抽過了！按「全部重來」可以重新開始' : '沒有可以抽的同學');
    const n = Math.min(st.n, p.length);
    if (n < st.n) toast(`只剩 ${p.length} 人可以抽`);
    const result = pickN(p, n);
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
    last = result;
    st.drawn.push(...result.filter(k => !st.drawn.includes(k)));
    st.history.unshift({ t: A.fmtTime(new Date()), k: result });
    st.history = st.history.slice(0, 50);
    saveSt();
    rolling = false;
    render();
    $('#stage').classList.add('reveal');
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
        st.drawn = []; st.absent = []; st.history = []; last = [];
        saveSt(); render();
      });
      return;
    }
    else if (d === 'seat') return A.highlightSeats(last);
    else if (d === 'full') {
      const el = $('#drawRoot .draw');
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
      return;
    }
    saveSt();
    render();
  });
  $('#drawRoot').addEventListener('change', e => {
    if (e.target.id === 'noRepeat') { st.noRepeat = e.target.checked; saveSt(); render(); }
  });
  // 空白鍵／Enter 也可以抽（接投影機、用簡報筆時方便）
  document.addEventListener('keydown', e => {
    if (A.currentTab() !== 'draw' || !$('#sheet').hidden || e.target.closest('input,select,textarea,button')) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') { e.preventDefault(); if (!rolling) go(); }
  });

  A.tabHooks.draw = () => { render(); A.ensureFaces?.(); };
  const rerender = () => { if (A.currentTab() === 'draw' && !rolling) render(); };
  A.on('students', rerender);
  A.on('faces', rerender);
})();
