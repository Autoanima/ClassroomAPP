'use strict';
/* 💬 LINE 圖片：自己的大頭照（含配件）＋文字（思源柔黑體粗體），做好直接傳到 LINE 群組 */
(() => {
  const A = window.App;
  const { $, esc, toast, store } = A;
  const LSK = 'indoor.linemsg.v1';
  const st = Object.assign({ text: '', color: '#ffffff', size: 90, pos: 'bottom', stroke: true, who: '' }, store.get(LSK, {}));
  const save = () => store.set(LSK, st);
  const W = 720, H = 960;             // 3:4，和座位上的大頭照一樣
  const COLORS = ['#ffffff', '#1f2328', '#ff3b30', '#ffcc00', '#ff6fb5', '#2f80ed', '#27ae60', '#8b5cf6'];

  // 思源柔黑體（Gen Jyuu Gothic，SIL OFL 開源授權）；依文字自動只下載用到的字
  const FONT = 'GenJyuuGothic';
  let fontCss = null;
  function loadFontCss() {
    if (fontCss) return fontCss;
    fontCss = new Promise(res => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://cdn.jsdelivr.net/gh/shogo82148/genjyuugothic-subsets@gh-pages/GenJyuuGothic-Bold/GenJyuuGothic-Bold.css';
      l.onload = res; l.onerror = res;
      document.head.appendChild(l);
    });
    return fontCss;
  }

  const who = () => (A.isStudent() || !A.isTeacher() ? A.me() : st.who || A.students()[0] || '');
  const imgCache = new Map();
  function img(src) {
    if (!src) return Promise.resolve(null);
    if (!imgCache.has(src)) {
      imgCache.set(src, new Promise(res => {
        const im = new Image();
        im.onload = () => res(im); im.onerror = () => res(null);
        im.src = src;
      }));
    }
    return imgCache.get(src);
  }

  // 把文字切成一行一行（手動換行＋太長自動換行）
  // 標點符號不放在行首（例如「！」不會單獨一行）
  const PUNCT = /[，。！？、；：」』）…～!?,.;:)\]]/;
  function wrap(g, text, maxW) {
    const out = [];
    text.split('\n').forEach(par => {
      let line = '';
      [...par].forEach(ch => {
        if (g.measureText(line + ch).width > maxW && line && !PUNCT.test(ch)) { out.push(line); line = ch; } else line += ch;
      });
      out.push(line);
    });
    return out;
  }

  let drawing = 0;
  async function draw() {
    const cv = $('#lineCanvas');
    if (!cv) return;
    const my = ++drawing;
    const k = who();
    const g = cv.getContext('2d');
    // 底圖：大頭照（和座位一樣，偏上裁切）；沒有照片就用姓氏
    const base = await img(A.faceSrc(k));
    const layers = A.decoOf(k);
    const accImgs = await Promise.all(layers.map(l => img(A.accUrl(l.acc))));
    await loadFontCss();
    try { await document.fonts.load(`700 ${st.size}px ${FONT}`, st.text || '字'); } catch { /* 字型載入失敗就用系統字 */ }
    if (my !== drawing) return;
    g.clearRect(0, 0, W, H);
    if (base) {
      const s = Math.max(W / base.width, H / base.height);
      const sw = W / s, sh = H / s;
      g.drawImage(base, (base.width - sw) / 2, (base.height - sh) * 0.25, sw, sh, 0, 0, W, H);
    } else {
      g.fillStyle = `hsl(${A.faceHue(k)} 40% 58%)`; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff'; g.font = `700 300px ${FONT}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(A.parseKey(k).name.slice(0, 1) || '?', W / 2, H * 0.42);
    }
    // 配件（和畫面上一樣：寬度＝s×大頭照寬，正方形框內等比例）
    layers.forEach((l, i) => {
      const im = accImgs[i];
      if (!im) return;
      const box = l.s * W, f = Math.min(box / im.width, box / im.height);
      g.save();
      g.translate(l.x * W, l.y * H);
      g.rotate(l.r * Math.PI / 180);
      g.drawImage(im, -im.width * f / 2, -im.height * f / 2, im.width * f, im.height * f);
      g.restore();
    });
    // 文字
    if (st.text.trim()) {
      // 太長的行先把字縮小（最小到原本的 55%），還放不下才換行
      const setFont = px => { g.font = `700 ${px}px ${FONT}, "PingFang TC", "Microsoft JhengHei", sans-serif`; };
      setFont(st.size);
      const longest = Math.max(...st.text.trim().split('\n').map(t => g.measureText(t).width));
      const size = Math.max(st.size * 0.55, Math.min(st.size, st.size * (W * 0.92) / Math.max(1, longest)));
      setFont(size);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      const lines = wrap(g, st.text.trim(), W * 0.92);
      const lh = size * 1.18, total = lh * lines.length;
      const top = st.pos === 'top' ? size * 0.8 : st.pos === 'middle' ? (H - total) / 2 + lh / 2 : H - total - size * 0.35 + lh / 2;
      lines.forEach((t, i) => {
        const y = top + i * lh;
        if (st.stroke) {
          g.lineWidth = Math.max(6, size * 0.2);
          g.strokeStyle = isLight(st.color) ? 'rgba(20,20,30,.9)' : 'rgba(255,255,255,.95)';
          g.strokeText(t, W / 2, y);
        }
        g.fillStyle = st.color;
        g.fillText(t, W / 2, y);
      });
    }
  }
  const isLight = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) > 150; };

  function render() {
    const root = $('#lineRoot');
    const teacher = A.isTeacher();
    let h = `<div class="panel line-maker">
      <p class="muted small" style="margin-top:0">用${teacher ? '同學' : '自己'}的大頭照（含配件）加上文字，做成圖片傳到 LINE 群組。字型：思源柔黑體 粗體。</p>`;
    if (teacher) h += `<div class="field"><label for="lineWho">大頭照</label><select id="lineWho">${A.students().map(k => `<option value="${esc(k)}"${k === who() ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select></div>`;
    h += `<div class="line-canvas-wrap"><canvas id="lineCanvas" width="${W}" height="${H}" aria-label="圖片預覽"></canvas></div>
      <div class="field"><label for="lineText">訊息</label><textarea id="lineText" maxlength="60" placeholder="輸入想說的話，例如：今天打掃辛苦了！">${esc(st.text)}</textarea></div>
      <div class="line-row"><span class="pt-lbl">顏色</span><div class="swatches">${COLORS.map(c => `<button type="button" class="sw-c${c === st.color ? ' on' : ''}" data-color="${c}" style="background:${c}" aria-label="顏色 ${c}"></button>`).join('')}
        <label class="sw-c custom" title="自訂顏色"><input type="color" id="lineColor" value="${st.color}"></label></div></div>
      <div class="line-row"><span class="pt-lbl">大小</span><input type="range" id="lineSize" min="40" max="160" value="${st.size}"></div>
      <div class="line-row"><span class="pt-lbl">位置</span><div class="subsw small-sw">${[['top', '上'], ['middle', '中'], ['bottom', '下']].map(([v, t]) => `<button type="button" data-pos="${v}" aria-selected="${st.pos === v}">${t}</button>`).join('')}</div>
        <label class="switch-row small" style="margin-left:auto"><span class="switch"><input type="checkbox" id="lineStroke"${st.stroke ? ' checked' : ''}><span></span></span>外框</label></div>
      <div class="actions"><button type="button" class="btn btn--line wide" id="lineShare">📤 傳到 LINE</button>
        <button type="button" class="btn wide" id="lineSave">💾 存成圖片</button></div>
      <p class="muted small">按「傳到 LINE」會打開手機的分享選單，選 LINE → 班級群組。電腦上會改成下載圖片。</p>
    </div>`;
    root.innerHTML = h;
    draw();
  }

  async function toFile() {
    await draw();
    const cv = $('#lineCanvas');
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    return new File([blob], `訊息_${A.parseKey(who()).code || 'me'}.png`, { type: 'image/png' });
  }
  function download(file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  $('#lineRoot').addEventListener('input', e => {
    if (e.target.id === 'lineText') { st.text = e.target.value; save(); draw(); }
    if (e.target.id === 'lineSize') { st.size = +e.target.value; save(); draw(); }
    if (e.target.id === 'lineColor') { st.color = e.target.value; save(); document.querySelectorAll('.sw-c').forEach(b => b.classList.remove('on')); draw(); }
  });
  $('#lineRoot').addEventListener('change', e => {
    if (e.target.id === 'lineStroke') { st.stroke = e.target.checked; save(); draw(); }
    if (e.target.id === 'lineWho') { st.who = e.target.value; save(); draw(); }
  });
  $('#lineRoot').addEventListener('click', async e => {
    const c = e.target.closest('[data-color]');
    if (c) { st.color = c.dataset.color; save(); document.querySelectorAll('.sw-c').forEach(b => b.classList.toggle('on', b === c)); $('#lineColor').value = st.color; return draw(); }
    const p = e.target.closest('[data-pos]');
    if (p) { st.pos = p.dataset.pos; save(); document.querySelectorAll('[data-pos]').forEach(b => b.setAttribute('aria-selected', b === p)); return draw(); }
    if (e.target.closest('#lineShare')) {
      const file = await toFile();
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); } catch (err) { if (err.name !== 'AbortError') toast('無法分享：' + err.message); }
      } else { download(file); toast('這台裝置不能直接分享，已下載圖片，請自己傳到 LINE'); }
    }
    if (e.target.closest('#lineSave')) { download(await toFile()); toast('✓ 已存成圖片'); }
  });

  A.tabHooks.line = () => { render(); A.ensureFaces?.(); if (A.isTeacher() && !A.students().length) A.loadStudents().then(render).catch(() => {}); };
  A.on('faces', () => { if (A.currentTab() === 'line') draw(); });
})();
