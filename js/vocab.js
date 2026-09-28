'use strict';
/* ⏳ 等待視窗＋背單字：商店等比較慢的地方載入時，跳出「目前正在載入中，請稍後」，
   等待的時候可以練習 英文單字（高中職常用 4000 字，分 4 級）或 日文五十音（點一下就會發音）。
   在視窗裡直接切換英文／日文，也可以在「設定」裡選擇等待時要練習哪一種。 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  const KEY = 'indoor.vocab.v1';   // 這台裝置的偏好（不用上雲端）
  const pref = Object.assign({ mode: 'en', lvl: 'all', kana: 'hira', jp: 'table', wrong: [], day: '', n: 0, streak: 0, onOpen: false }, store.get(KEY, {}));
  const save = () => store.set(KEY, pref);
  const LVL = { 1: '基礎', 2: '初級', 3: '中級', 4: '進階' };

  // ── 發音 ──
  const tts = window.speechSynthesis;
  function speak(text, lang) {
    if (!tts) return toast('這個瀏覽器不支援發音');
    tts.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = lang === 'ja-JP' ? 0.8 : 0.9;
    const v = tts.getVoices().find(x => x.lang.replace('_', '-').startsWith(lang.slice(0, 2)));
    if (v) u.voice = v;
    else if (lang === 'ja-JP' && tts.getVoices().length) toast('這支手機可能沒有日文語音：可到手機設定 →「文字轉語音」下載日文');
    tts.speak(u);
  }
  tts?.getVoices(); // 先叫一次，語音清單才會載入

  // ── 英文單字（第一次用到才下載）──
  const words = {};
  async function loadLevel(n) {
    if (words[n]) return words[n];
    const txt = await fetch(`data/en${n}.txt`).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
    return words[n] = txt.split(/\r?\n/).filter(Boolean).map(l => { const [w, p, zh] = l.split('\t'); return { w, p, zh, lv: n }; });
  }
  async function pool() {
    const lv = pref.lvl === 'all' ? [1, 2, 3, 4] : [+pref.lvl];
    return (await Promise.all(lv.map(loadLevel))).flat();
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ── 日文五十音 ──
  const ROWS = [
    ['あいうえお', 'アイウエオ', 'a i u e o'], ['かきくけこ', 'カキクケコ', 'ka ki ku ke ko'], ['さしすせそ', 'サシスセソ', 'sa shi su se so'],
    ['たちつてと', 'タチツテト', 'ta chi tsu te to'], ['なにぬねの', 'ナニヌネノ', 'na ni nu ne no'], ['はひふへほ', 'ハヒフヘホ', 'ha hi fu he ho'],
    ['まみむめも', 'マミムメモ', 'ma mi mu me mo'], ['や・ゆ・よ', 'ヤ・ユ・ヨ', 'ya - yu - yo'], ['らりるれろ', 'ラリルレロ', 'ra ri ru re ro'],
    ['わ・・・を', 'ワ・・・ヲ', 'wa - - - wo'], ['ん・・・・', 'ン・・・・', 'n - - - -'],
  ];
  const DAKU = [
    ['がぎぐげご', 'ガギグゲゴ', 'ga gi gu ge go'], ['ざじずぜぞ', 'ザジズゼゾ', 'za ji zu ze zo'], ['だぢづでど', 'ダヂヅデド', 'da ji zu de do'],
    ['ばびぶべぼ', 'バビブベボ', 'ba bi bu be bo'], ['ぱぴぷぺぽ', 'パピプペポ', 'pa pi pu pe po'],
  ];
  const YOON = [
    ['きゃ きゅ きょ', 'キャ キュ キョ', 'kya kyu kyo'], ['しゃ しゅ しょ', 'シャ シュ ショ', 'sha shu sho'], ['ちゃ ちゅ ちょ', 'チャ チュ チョ', 'cha chu cho'],
    ['にゃ にゅ にょ', 'ニャ ニュ ニョ', 'nya nyu nyo'], ['ひゃ ひゅ ひょ', 'ヒャ ヒュ ヒョ', 'hya hyu hyo'], ['みゃ みゅ みょ', 'ミャ ミュ ミョ', 'mya myu myo'],
    ['りゃ りゅ りょ', 'リャ リュ リョ', 'rya ryu ryo'], ['ぎゃ ぎゅ ぎょ', 'ギャ ギュ ギョ', 'gya gyu gyo'], ['じゃ じゅ じょ', 'ジャ ジュ ジョ', 'ja ju jo'],
    ['びゃ びゅ びょ', 'ビャ ビュ ビョ', 'bya byu byo'], ['ぴゃ ぴゅ ぴょ', 'ピャ ピュ ピョ', 'pya pyu pyo'],
  ];
  // 一列拆成 [假名, 羅馬拼音]；「・」「-」是空格
  const cells = (row, kata) => {
    const ks = row[kata ? 1 : 0].includes(' ') ? row[kata ? 1 : 0].split(' ') : [...row[kata ? 1 : 0]];
    const rs = row[2].split(' ');
    return ks.map((k, i) => [k === '・' ? '' : k, rs[i] === '-' ? '' : rs[i]]);
  };
  const allKana = kata => [...ROWS, ...DAKU, ...YOON].flatMap(r => cells(r, kata)).filter(c => c[0]);

  // ── 視窗 ──
  let win = null, st = null;   // st: { loading, done, standalone, onDone, touched }
  function ensure() {
    if (win) return win;
    win = document.createElement('div');
    win.id = 'waitWin'; win.hidden = true;
    win.setAttribute('role', 'dialog'); win.setAttribute('aria-modal', 'true');
    document.body.appendChild(win);
    win.addEventListener('click', onClick);
    return win;
  }
  function headHtml() {
    if (st.standalone) return `<div class="ww-head"><b>📚 ${st.onOpen ? '開始前先練習一下' : '背單字'}</b><span class="ww-pf muted small">${pfText()}</span><button type="button" class="ww-x" data-w="close" aria-label="關閉">✕</button></div>`;
    if (st.done) return `<div class="ww-head ok"><b>✓ ${esc(st.what)}載入完成</b><button type="button" class="btn btn--primary" data-w="close">進入${esc(st.what)} →</button></div>`;
    return `<div class="ww-head"><span class="ww-spin" aria-hidden="true"></span><b>目前正在載入中，請稍後</b><button type="button" class="ww-x" data-w="close" aria-label="先關閉">✕</button></div>`;
  }
  function switchHtml() {
    const b = (m, t) => `<button type="button" data-w="mode" data-m="${m}" aria-pressed="${pref.mode === m}">${t}</button>`;
    return `<div class="ww-switch">${b('en', '🔤 英文單字')}${b('jp', 'あ 日文五十音')}${b('off', '休息')}</div>`;
  }
  async function paint() {
    if (!win || win.hidden) return;
    let body = '';
    if (pref.mode === 'en') body = await enHtml();
    else if (pref.mode === 'jp') body = jpHtml();
    else body = `<p class="muted center ww-rest">☕ 休息一下，${st.standalone ? '想練習時再切換上面的按鈕。' : '馬上就好。'}</p>`;
    win.innerHTML = `<div class="ww-card">${headHtml()}${switchHtml()}<div class="ww-body">${body}</div></div>`;
  }

  // 英文：看單字選中文（四選一）
  let q = null;
  async function newQ() {
    const list = await pool();
    // 答錯過的字，三成機會再出現
    const wrong = pref.wrong.map(w => list.find(x => x.w === w)).filter(Boolean);
    const ans = wrong.length && Math.random() < 0.3 ? pick(wrong) : pick(list);
    // 其他選項盡量用同詞性的字（比較像，不會一眼看出答案）
    const same = list.filter(x => x.p === ans.p);
    const opts = new Set([ans.zh]);
    for (let i = 0; opts.size < 4 && i < 60; i++) opts.add(pick(i < 40 && same.length > 8 ? same : list).zh);
    q = { ans, opts: shuffle([...opts]), chose: '' };
  }
  const today = () => A.fmtDate(new Date());
  async function enHtml() {
    let q0;
    try { if (!q) await newQ(); q0 = q; } catch { return `<p class="muted center">單字表讀取失敗，請確認網路。</p>`; }
    if (pref.day !== today()) { pref.day = today(); pref.n = 0; save(); }
    const lv = ['all', 1, 2, 3, 4].map(v => `<option value="${v}"${String(pref.lvl) === String(v) ? ' selected' : ''}>${v === 'all' ? '全部（約 4300 字）' : `第 ${v} 級・${LVL[v]}`}</option>`).join('');
    const opt = q0.opts.map(o => {
      let cls = '';
      if (q0.chose) cls = o === q0.ans.zh ? ' right' : o === q0.chose ? ' wrong' : ' dim';
      return `<button type="button" class="ww-opt${cls}" data-w="en" data-v="${esc(o)}"${q0.chose ? ' disabled' : ''}>${esc(o)}</button>`;
    }).join('');
    return `<div class="ww-tools"><select data-w="lvl" aria-label="程度">${lv}</select><span class="muted small">今天答對 ${pref.n} 題・連對 ${pref.streak}</span></div>
      <div class="ww-word"><span class="ww-w">${esc(q0.ans.w)}</span><button type="button" class="ww-say" data-w="say" data-t="${esc(q0.ans.w)}" data-l="en-US" aria-label="發音">🔊</button></div>
      <div class="muted small center">${esc(q0.ans.p)}${q0.chose ? `・第 ${q0.ans.lv} 級` : ''}</div>
      <div class="ww-opts">${opt}</div>
      ${q0.chose ? `<div class="actions"><button type="button" class="btn wide" data-w="next">下一個 →</button></div>` : '<p class="muted small center">選出正確的中文意思</p>'}`;
  }

  // 日文：五十音表（點一下發音）／練習（看假名選拼音）
  let jq = null, lastKana = null;
  function newJQ() {
    const all = allKana(pref.kana === 'kata');
    const ans = pick(all);
    const opts = new Set([ans[1]]);
    while (opts.size < 4) opts.add(pick(all)[1]);
    jq = { ans, opts: shuffle([...opts]), chose: '' };
  }
  function jpHtml() {
    const tg = (k, v, t, cur) => `<button type="button" data-w="${k}" data-v="${v}" aria-pressed="${cur === v}">${t}</button>`;
    let h = `<div class="ww-tools"><div class="ww-seg">${tg('kana', 'hira', '平假名', pref.kana)}${tg('kana', 'kata', '片假名', pref.kana)}</div>
      <div class="ww-seg">${tg('jpv', 'table', '📋 五十音表', pref.jp)}${tg('jpv', 'quiz', '✏️ 練習', pref.jp)}</div></div>`;
    const kata = pref.kana === 'kata';
    if (pref.jp === 'table') {
      const grid = rows => `<div class="kana-grid${rows[0][0].includes(' ') ? ' k3' : ''}">${rows.flatMap(r => cells(r, kata)).map(([k, r]) =>
        k ? `<button type="button" class="kana${lastKana === k ? ' on' : ''}" data-w="kana-say" data-t="${esc(k)}"><b>${esc(k)}</b><span>${esc(r)}</span></button>` : '<span class="kana empty"></span>').join('')}</div>`;
      h += `<p class="muted small center">點一下假名就會發音</p>${grid(ROWS)}
        <details class="ww-more"><summary>濁音・半濁音</summary>${grid(DAKU)}</details>
        <details class="ww-more"><summary>拗音</summary>${grid(YOON)}</details>`;
    } else {
      if (!jq || (jq.kata !== kata)) { newJQ(); jq.kata = kata; }
      const opt = jq.opts.map(o => {
        let cls = '';
        if (jq.chose) cls = o === jq.ans[1] ? ' right' : o === jq.chose ? ' wrong' : ' dim';
        return `<button type="button" class="ww-opt${cls}" data-w="jp" data-v="${esc(o)}"${jq.chose ? ' disabled' : ''}>${esc(o)}</button>`;
      }).join('');
      h += `<div class="ww-word"><span class="ww-w ww-kana">${esc(jq.ans[0])}</span><button type="button" class="ww-say" data-w="say" data-t="${esc(jq.ans[0])}" data-l="ja-JP" aria-label="發音">🔊</button></div>
        <div class="ww-opts">${opt}</div>
        ${jq.chose ? `<div class="actions"><button type="button" class="btn wide" data-w="jnext">下一個 →</button></div>` : '<p class="muted small center">這個假名怎麼唸？</p>'}`;
    }
    return h;
  }

  async function onClick(e) {
    const b = e.target.closest('[data-w]');
    if (!b || !st) return;
    st.touched = Date.now();
    const w = b.dataset.w;
    if (w === 'close') return close();
    if (w === 'say') return speak(b.dataset.t, b.dataset.l);
    if (w === 'kana-say') { lastKana = b.dataset.t; speak(b.dataset.t, 'ja-JP'); win.querySelectorAll('.kana.on').forEach(x => x.classList.remove('on')); b.classList.add('on'); return; }
    if (w === 'mode') { pref.mode = b.dataset.m; save(); }
    else if (w === 'kana') { pref.kana = b.dataset.v; save(); jq = null; }
    else if (w === 'jpv') { pref.jp = b.dataset.v; save(); }
    else if (w === 'en' && q && !q.chose) {
      q.chose = b.dataset.v;
      const ok = q.chose === q.ans.zh;
      if (ok) { pref.n++; pref.streak++; pref.wrong = pref.wrong.filter(x => x !== q.ans.w); }
      else { pref.streak = 0; pref.wrong = [q.ans.w, ...pref.wrong.filter(x => x !== q.ans.w)].slice(0, 200); }
      save();
      speak(q.ans.w, 'en-US');
    } else if (w === 'next') { q = null; }
    else if (w === 'jp' && jq && !jq.chose) { jq.chose = b.dataset.v; speak(jq.ans[0], 'ja-JP'); }
    else if (w === 'jnext') { jq = null; }
    else return;
    paint();
  }
  // 程度下拉選單
  document.addEventListener('change', e => {
    if (e.target.dataset?.w !== 'lvl' || !win?.contains(e.target) || !st) return;
    pref.lvl = e.target.value; save(); q = null; st.touched = Date.now(); paint();
  });

  function open(opts) {
    ensure();
    st = Object.assign({ touched: 0 }, opts);
    win.hidden = false;
    document.body.classList.add('ww-open');
    paint();
  }
  function close() {
    if (!win) return;
    win.hidden = true;
    document.body.classList.remove('ww-open');
    tts?.cancel();
    st = null;
  }

  /** 開始一個可能比較久的載入：超過 0.4 秒才跳出等待視窗。回傳 done()，載入完呼叫它。 */
  A.waitFor = (what = '') => {
    let shown = false, finished = false;
    const t = setTimeout(() => { if (!finished) { shown = true; open({ what }); } }, 400);
    return () => {
      finished = true; clearTimeout(t);
      if (!shown || !st || st.standalone) return;
      // 正在作答就不要突然關掉，改成顯示「進入商店」
      if (st.touched && Date.now() - st.touched < 8000) { st.done = true; paint(); } else close();
    };
  };
  A.openVocab = extra => open(Object.assign({ standalone: true }, extra));
  // 背景預先載入的進度（顯示在小練習的標題旁邊）
  const pfText = () => { const i = A.prefetchInfo?.(); return i?.on && i.total && i.done < i.total ? `⚡ 背景載入中 ${i.done}/${i.total}` : i?.on && i.total ? '⚡ 都載好了' : ''; };
  A.on('prefetch', () => { const el = win?.querySelector('.ww-pf'); if (el) el.textContent = pfText(); });
  // 打開 App 時先出現小練習（設定裡可以開關）：等飛鴿傳書、公布欄、禮物盒都看完再出現
  A.on('start', async () => {
    if (!pref.onOpen || A.isGuest()) return;
    await Promise.race([A.mailDone || Promise.resolve(), new Promise(r => setTimeout(r, 60e3))]);
    await new Promise(r => setTimeout(r, 2500));
    for (let i = 0; i < 40; i++) {
      const busy = A.sheetMode() || !($('#giftFx')?.hidden ?? true) || !($('#waitWin')?.hidden ?? true);
      if (!busy) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!win || win.hidden) A.openVocab({ onOpen: true });
  });

  // ── 設定頁：等待時練習哪一種 ──
  A.vocabSettingsHtml = () => {
    const b = (m, t) => `<button type="button" class="btn" data-act="vocabMode" data-m="${m}" aria-pressed="${pref.mode === m}">${t}</button>`;
    return `<h3>等待時的小練習</h3><p class="muted small" style="margin:0">商店載入比較久時，會跳出視窗讓你背單字（視窗裡也可以直接切換）。</p>
      <div class="ww-set">${b('en', '🔤 英文')}${b('jp', 'あ 日文')}${b('off', '不練習')}</div>
      <p class="muted small" style="margin:10px 0 0">每次打開 App 時，要不要先出現小練習？</p>
      <div class="ww-set"><button type="button" class="btn" data-act="vocabOnOpen" data-v="1" aria-pressed="${pref.onOpen}">✅ 要，打開就練習</button><button type="button" class="btn" data-act="vocabOnOpen" data-v="0" aria-pressed="${!pref.onOpen}">不要</button></div>
      <div class="actions"><button type="button" class="btn wide" data-act="vocabOpen">📚 現在就練習</button></div>`;
  };
  A.vocabSettingsAct = (act, b) => {
    if (act === 'vocabMode') {
      pref.mode = b.dataset.m; save();
      b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      toast(pref.mode === 'en' ? '等待時練習英文單字' : pref.mode === 'jp' ? '等待時練習日文五十音' : '等待時不練習');
      return true;
    }
    if (act === 'vocabOpen') { A.closeSheet(); A.openVocab(); return true; }
    if (act === 'vocabOnOpen') {
      pref.onOpen = b.dataset.v === '1'; save();
      b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      toast(pref.onOpen ? '下次打開 App 時會先出現小練習' : '打開 App 時不會出現小練習');
      return true;
    }
    return false;
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && win && !win.hidden) close(); });
})();
