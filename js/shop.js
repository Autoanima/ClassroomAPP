'use strict';
/* 🛍 商店：同學用「加分」得到的點數買大頭照配件，可以自己用或送人；配件有效 10 個上課日 */
(() => {
  const A = window.App, D = A.D;
  const { $, esc, toast, store } = A;
  const K = { inv: 'indoor.shopinv.v1.test', deco: 'indoor.shopdeco.v1.test', spend: 'indoor.shopspend.v1.test', seenFx: 'indoor.fxseen.v1' + A.SFX };
  let S = null;          // 雲端回傳的商店狀態
  let loading = false;

  const code = k => A.parseKey(k).code;
  const accImgStyle = id => `background-image:url('${A.accUrl(id)}')`;
  // 今天到到期日還剩幾個上課日（含今天）
  function schoolDaysLeft(exp) {
    const end = new Date(exp.replace(/\//g, '-') + 'T12:00:00');
    const d = new Date(); d.setHours(12, 0, 0, 0);
    let n = 0;
    for (let i = 0; i < 60 && d <= end; i++) { if (d.getDay() % 6) n++; d.setDate(d.getDate() + 1); }
    return n;
  }

  async function load() {
    if (loading) return;
    loading = true;
    try {
      const [r] = await Promise.all([A.api('shopState'), A.builtinCatalog()]);
      S = r;
      if (S.catalog.some(a => a.id.startsWith('d:') && !A.accUrl(a.id))) await A.loadAccImages().catch(() => {});
    } catch (e) { toast('商店讀取失敗：' + e.message); }
    loading = false;
    render();
  }

  function render() {
    const root = $('#shopRoot');
    if (!S) { root.innerHTML = `<div class="panel"><p class="muted">商店載入中…</p></div>`; return; }
    const me = S.me || A.me();
    const coinTxt = S.unlimited ? '∞' : S.coins;
    const active = S.inv.filter(x => !x.expired);
    const used = new Set((S.deco || []).map(l => l.inv));
    let h = (S.stolen || []).map(x => `<div class="banner warn"><div class="bn-sub">⚠ 你的「${esc(x.name)}」被 ${esc(x.thief)} 用竊盜卡奪走了（${esc(x.time)}）</div></div>`).join('');
    h += (S.swapped || []).map(x => `<div class="banner warn"><div class="bn-sub">🔀 ${esc(x.by)} 用交換位置卡和你對調了座位（${esc(x.time)}）</div></div>`).join('');
    h += `<div class="panel shop-me">
      <div class="shop-face"><span class="photo">${A.faceHtml(me)}</span></div>
      <div class="shop-wallet"><div class="coins">💰 <b>${coinTxt}</b> 點</div>
        <div class="muted small">${S.unlimited ? '導師點數無限，可以試用所有商品' : `加分累計 ${S.earned} 點${S.income ? `（含作品收入 ${S.income} 點）` : ''}・已使用 ${S.spent} 點`}</div>
        <button type="button" class="btn btn--primary" data-s="edit"${active.length ? '' : ' disabled'}>🎨 裝扮大頭照</button>
        ${active.length ? '' : '<div class="muted small">先在下面的商店買配件</div>'}</div>
    </div>`;
    h += `<div class="panel"><h3>我的配件</h3>`;
    if (!active.length) h += `<p class="muted small">還沒有配件。</p>`;
    else {
      h += `<ul class="inv">`;
      active.forEach(x => {
        const left = schoolDaysLeft(x.exp);
        h += `<li><span class="acc-thumb" style="${accImgStyle(x.acc)}"></span><div class="inv-what"><b>${esc(x.name)}</b>${used.has(x.id) ? ' <span class="tag good">使用中</span>' : ''}
          <div class="muted small">到 ${esc(x.exp)}（還有 ${left} 個上課日）${x.note ? '｜' + esc(x.note) : ''}</div></div>
          <button type="button" class="btn" data-s="gift" data-inv="${esc(x.id)}">🎁 送人</button></li>`;
      });
      h += `</ul>`;
    }
    const expired = S.inv.filter(x => x.expired);
    if (expired.length) h += `<details class="small muted"><summary>已過期（${expired.length}）</summary>${expired.map(x => `${esc(x.name)}（${esc(x.exp)} 到期）`).join('、')}</details>`;
    h += `</div>`;
    const othersN = Object.values(S.others || {}).flat().length;
    h += `<div class="panel"><h3>特殊道具</h3><div class="specials">
      <button type="button" class="special" data-s="firework"${S.coins >= S.fireworkPrice ? '' : ' disabled'}><span class="sp-ico">🎆</span><b>煙火</b><span class="muted small">放在同學的座位上，大家下次打開 App 時都會看到</span><span class="sp-price">💰 ${S.fireworkPrice} 點</span></button>
      <button type="button" class="special swap" data-s="swap"${S.coins >= (S.swapPrice || 20) ? '' : ' disabled'}><span class="sp-ico">🔀</span><b>交換位置卡</b><span class="muted small">和另一位同學強制對調座位</span><span class="sp-price">💰 ${S.swapPrice || 20} 點</span></button>
      <button type="button" class="special steal" data-s="steal"${S.coins >= S.stealPrice && othersN ? '' : ' disabled'}><span class="sp-ico">🦹</span><b>竊盜卡</b><span class="muted small">把別人的一個配件變成你的（到期日不變）${othersN ? '' : '｜目前沒有人有配件'}</span><span class="sp-price">💰 ${S.stealPrice} 點</span></button>
      <button type="button" class="special create" data-s="create"><span class="sp-ico">🎨</span><b>創造卡</b><span class="muted small">上傳自己畫的 PNG 變成新商品；別人買了，點數算給你</span><span class="sp-price">免費建立</span></button>
    </div></div>`;
    if (S.sales?.items.length) {
      h += `<div class="panel"><h3>我創造的商品</h3><p class="muted small">已經賣出 ${S.sales.n} 次，收入 ${S.sales.income} 點（已算進你的點數）。</p><ul class="inv">${S.sales.items.map(a =>
        `<li><span class="acc-thumb" style="${accImgStyle(a.id)}"></span><div class="inv-what"><b>${esc(a.name)}</b><div class="muted small">售價 ${a.price} 點・賣出 ${a.sold} 次</div></div>
          <button type="button" class="btn btn--danger" data-s="delAcc" data-acc="${esc(a.id)}" data-name="${esc(a.name)}">下架</button></li>`).join('')}</ul></div>`;
    }
    h += `<div class="panel"><h3>商店</h3><p class="muted small">每個配件買了之後有效 10 個上課日（週六、週日不算），可以自己用，也可以送給同學。</p><div class="shop-grid">`;
    S.catalog.forEach(a => {
      const can = S.coins >= a.price;
      h += `<div class="shop-item"><span class="acc-thumb big" style="${accImgStyle(a.id)}"></span><b>${esc(a.name)}</b>${a.creator ? `<span class="muted small">🎨 ${esc(a.creator)}</span>` : ''}
        ${S.admin && a.creator ? `<button type="button" class="link-btn" data-s="delAcc" data-acc="${esc(a.id)}" data-name="${esc(a.name)}">下架</button>` : ''}
        <button type="button" class="btn${can ? ' btn--primary' : ''}" data-s="buy" data-acc="${esc(a.id)}"${can ? '' : ' disabled'}>💰 ${a.price} 點</button></div>`;
    });
    h += `</div></div>`;
    if (S.plus?.length) {
      h += `<details class="panel"><summary><b>我的加分紀錄</b></summary><ul class="pt-list">${S.plus.map(p =>
        `<li><span class="pt-v plus">+${p.points}</span><div class="pt-what">${esc(p.reason)}<div class="muted small">${esc(p.date)}</div></div></li>`).join('')}</ul></details>`;
    }
    if (S.admin) h += adminHtml();
    root.innerHTML = h;
  }

  // 導師：新增配件的方法、全班點數（放在最下面，預設收起來）
  function adminHtml() {
    let h = `<p class="muted small">要加新配件：把去背的 PNG 放到雲端硬碟「${esc(A.className() || '')} APP 專用／配件」資料夾，檔名寫「名稱_價格.png」（例如「墨鏡_3.png」）。10 分鐘內會出現在商店。同學用創造卡做的商品，導師可以按「下架」。</p>`;
    h += `<details class="panel"><summary><b>成員點數</b> <span class="muted small">（${S.admin.length} 人）</span></summary>
      <p class="muted small">點數＝加分累計＋作品收入 − 用掉的（配件、竊盜卡、煙火、交換位置卡）。扣分不會減少點數。</p>
      <table class="admin"><thead><tr><th>同學</th><th>加分</th><th>已用</th><th>剩餘</th><th>配件</th></tr></thead><tbody>`;
    S.admin.forEach(r => { h += `<tr><td>${esc(r.key)}</td><td>${r.earned}${r.income ? `<div class="muted small">作品 ${r.income}</div>` : ''}</td><td>${r.spent}</td><td><b>${r.coins}</b></td><td>${r.active || ''}</td></tr>`; });
    return h + `</tbody></table></details>`;
  }

  $('#shopRoot').addEventListener('click', async e => {
    const b = e.target.closest('[data-s]');
    if (!b || b.disabled) return;
    const act = b.dataset.s;
    if (act === 'buy') {
      const a = S.catalog.find(x => x.id === b.dataset.acc);
      if (!await A.ask(`用 ${a.price} 點買「${a.name}」？\n買了之後有效 10 個上課日。`, '購買')) return;
      b.disabled = true;
      try { S = await A.api('buyAcc', { acc: a.id }); toast(`✓ 買到「${a.name}」了！按「裝扮大頭照」戴上它`); } catch (err) { toast(err.message); }
      render();
    } else if (act === 'gift') {
      openGift(b.dataset.inv);
    } else if (act === 'edit') {
      openEditor();
    } else if (act === 'steal') {
      openSteal();
    } else if (act === 'firework') {
      openFirework();
    } else if (act === 'swap') {
      openSwap();
    } else if (act === 'create') {
      openCreate();
    } else if (act === 'delAcc') {
      if (!await A.ask(`下架「${b.dataset.name}」？\n已經買的人不會退點數。`, '下架', true)) return;
      b.disabled = true;
      try { S = await A.api('delAcc', { acc: b.dataset.acc }); toast('已下架'); } catch (err) { toast(err.message); }
      render();
    }
  });

  // ── 創造卡：上傳 PNG（自動縮小壓縮），取名字、訂價格 ──
  let made = null; // 壓縮後的 data URL
  function openCreate() {
    made = null;
    let h = A.sheetHead('🎨 創造卡', '上傳一張 PNG（最好是去背的），變成商店裡的新商品');
    h += `<div class="create-box">
        <label class="create-pick"><input type="file" id="mkFile" accept="image/png,image/*" hidden><span id="mkPrev" class="create-prev">＋<br><span class="small">選擇圖片</span></span></label>
        <div class="create-f">
          <div class="field"><label for="mkName">商品名稱</label><input type="text" id="mkName" maxlength="12" placeholder="例如：星星髮夾"></div>
          <div class="field"><label for="mkPrice">售價（點）</label><input type="number" id="mkPrice" min="1" max="100" inputmode="numeric" value="${S.createPrice || 20}"></div>
        </div></div>
      <p class="muted small" id="mkInfo">圖片會自動縮小到 256 像素以內。同學買了之後，點數會加到你的帳戶（每人每天最多 3 個）。</p>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="mkOk">🎨 上架</button></div>`;
    A.openSheet({ kind: 'create' }, h);
  }
  // 縮小到 256 以內；還是太大就再縮
  async function shrinkPng(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('讀不到這張圖片')); i.src = url; });
      for (let max = 256; max >= 96; max = Math.round(max * 0.8)) {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        const d = cv.toDataURL('image/png');
        if (d.length < 200000) return d;
      }
      throw new Error('圖片太複雜，壓縮後還是太大，請換一張');
    } finally { URL.revokeObjectURL(url); }
  }
  A.sheetBody.addEventListener('change', async e => {
    if (e.target.id !== 'mkFile' || A.sheetMode()?.kind !== 'create') return;
    const f = e.target.files[0];
    if (!f) return;
    try {
      made = await shrinkPng(f);
      $('#mkPrev').innerHTML = `<img src="${made}" alt="">`;
      $('#mkInfo').textContent = `壓縮後 ${Math.round(made.length * 0.75 / 1024)} KB。`;
      if (!$('#mkName').value) $('#mkName').value = f.name.replace(/\.[^.]+$/, '').slice(0, 12);
    } catch (err) { made = null; toast(err.message); }
  });
  A.sheetHandlers.create = async (act, b) => {
    if (act !== 'mkOk') return;
    const name = $('#mkName').value.trim(), price = +$('#mkPrice').value || 20;
    if (!made) return toast('請先選擇圖片');
    if (!name) return toast('請幫商品取個名字');
    if (price < 1 || price > 100) return toast('售價要在 1–100 點之間');
    if (!await A.ask(`上架「${name}」，售價 ${price} 點？`, '上架')) return;
    b.disabled = true; b.textContent = '上傳中…';
    try {
      S = await A.api('createAcc', { name, price, data: made });
      await A.loadAccImages().catch(() => {});
      A.closeSheet();
      toast(`🎨「${name}」已經上架了！`);
    } catch (err) { toast(err.message); b.disabled = false; b.textContent = '🎨 上架'; }
    render();
  };

  // ── 送人 ──
  function openGift(invId) {
    const x = S.inv.find(i => i.id === invId);
    let h = A.sheetHead(`送出「${esc(x.name)}」`, `到期日 ${esc(x.exp)}（送出後到期日不變）`);
    h += `<div class="field"><label for="giftTo">送給</label><select id="giftTo"><option value="">— 請選擇同學 —</option>${S.classmates.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}</select></div>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="giftOk">🎁 送出</button></div>`;
    A.openSheet({ kind: 'gift', inv: invId, name: x.name }, h);
  }
  A.sheetHandlers.gift = async (act, b) => {
    if (act !== 'giftOk') return;
    const to = $('#giftTo').value;
    if (!to) return toast('請選擇同學');
    const { inv, name } = A.sheetMode();
    if (!await A.ask(`把「${name}」送給 ${to}？送出後就不能收回。`, '送出')) return;
    b.disabled = true;
    try {
      S = await A.api('giftAcc', { inv, to });
      A.closeSheet();
      toast(`✓ 已送給 ${to}`);
      A.setDeco(S.me || A.me(), decoFromState());
    } catch (err) { toast(err.message); b.disabled = false; }
    render();
  };

  // ── 竊盜卡：選一位同學的一個配件 ──
  function openSteal() {
    let h = A.sheetHead(`🦹 竊盜卡（${S.stealPrice} 點）`, '選一個要奪取的配件；到期日不變，對方會收到通知');
    Object.entries(S.others).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, items]) => {
      h += `<div class="steal-row"><span class="steal-face"><span class="photo">${A.faceHtml(k)}</span></span><div class="steal-who"><b>${esc(k)}</b><div class="chips">${items.map(x =>
        `<button type="button" class="nm deco-add" data-act="steal" data-inv="${esc(x.id)}" data-name="${esc(x.name)}" data-owner="${esc(k)}"><span class="acc-thumb" style="${accImgStyle(x.acc)}"></span>${esc(x.name)}</button>`).join('')}</div></div></div>`;
    });
    A.openSheet({ kind: 'steal' }, h);
  }
  A.sheetHandlers.steal = async (act, b) => {
    if (act !== 'steal') return;
    if (!await A.ask(`花 ${S.stealPrice} 點，把 ${b.dataset.owner} 的「${b.dataset.name}」奪過來？`, '奪取！', true)) return;
    b.disabled = true;
    try {
      S = await A.api('stealAcc', { inv: b.dataset.inv });
      A.closeSheet();
      toast(`🦹 成功奪取「${b.dataset.name}」！`);
      A.ensureFaces?.(true);
    } catch (err) { toast(err.message); b.disabled = false; }
    render();
  };

  // ── 交換位置卡：到「座位 → 交換位置」點一位同學的座位，和他對調（這時候才會扣點數） ──
  function openSwap() {
    if (!A.useSwapCard) return openSwapList();
    if (!A.seatOf?.(S.me)) return toast('你還沒有座位，不能用交換位置卡');
    A.useSwapCard(S.swapPrice || 20);
  }
  function openSwapList() {
    const mine = A.seatOf?.(S.me);
    let h = A.sheetHead(`🔀 交換位置卡（${S.swapPrice || 20} 點）`, mine ? `你現在坐在 ${mine}` : '你還沒有座位，不能交換');
    h += `<div class="field"><select id="swapTo"><option value="">— 要和誰對調？ —</option>${S.classmates.map(k => {
      const at = A.seatOf?.(k);
      return `<option value="${esc(k)}"${at ? '' : ' disabled'}>${esc(k)}${at ? `（${at}）` : '（沒有座位）'}</option>`;
    }).join('')}</select></div>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="swapOk"${mine ? '' : ' disabled'}>🔀 對調座位</button></div>
      <p class="muted small">對方打開商店時會看到通知。</p>`;
    A.openSheet({ kind: 'swapcard' }, h);
  }
  A.sheetHandlers.swapcard = async (act, b) => {
    if (act !== 'swapOk') return;
    const to = $('#swapTo').value;
    if (!to) return toast('請選擇同學');
    if (!await A.ask(`花 ${S.swapPrice || 20} 點，和 ${to} 對調座位？\n（${A.seatOf?.(S.me)} ⇄ ${A.seatOf?.(to)}）`, '對調！', true)) return;
    b.disabled = true;
    try {
      S = await A.api('swapSeatCard', { to });
      A.closeSheet();
      toast(`🔀 已和 ${to} 對調座位！`);
      A.ensureFaces?.(true); // 重新讀座位表
    } catch (err) { toast(err.message); b.disabled = false; }
    render();
  };

  // ── 煙火：選一位同學的座位 ──
  function openFirework() {
    let h = A.sheetHead(`🎆 煙火（${S.fireworkPrice} 點）`, '放在誰的座位上？大家下次打開 App 時都會看到一次');
    h += `<div class="field"><select id="fwTo"><option value="">— 請選擇同學 —</option>${[S.me, ...S.classmates].map(k => `<option value="${esc(k)}">${esc(k)}${k === S.me ? '（自己）' : ''}</option>`).join('')}</select></div>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="fwOk">🎆 放煙火</button></div>`;
    A.openSheet({ kind: 'firework' }, h);
  }
  A.sheetHandlers.firework = async (act, b) => {
    if (act !== 'fwOk') return;
    const to = $('#fwTo').value;
    if (!to) return toast('請選擇同學');
    b.disabled = true;
    try {
      S = await A.api('buyFirework', { to });
      A.closeSheet();
      toast(`🎆 煙火放在 ${to} 的座位上了！`);
      A.ensureFaces?.(true); // 自己馬上看得到
    } catch (err) { toast(err.message); b.disabled = false; }
    render();
  };

  // ── 煙火動畫：在那位同學的座位上放一次（每台裝置每支煙火只放一次） ──
  let pendingFx = [];
  A.on('fireworks', list => {
    const seen = new Set(store.get(K.seenFx, []));
    const fresh = list.filter(f => !seen.has(f.id) && !pendingFx.some(p => p.id === f.id));
    if (!fresh.length) return;
    pendingFx.push(...fresh);
    if (A.currentTab() === 'seats') setTimeout(playPending, 500);
    else toast(`🎆 有 ${pendingFx.length} 支煙火！打開「座位」看看`);
  });
  const origSeatsHook = A.tabHooks.seats;
  A.tabHooks.seats = () => { origSeatsHook?.(); setTimeout(playPending, 700); };
  async function playPending() {
    if (!pendingFx.length || A.currentTab() !== 'seats' || document.hidden) return;
    const list = pendingFx.splice(0);
    store.set(K.seenFx, [...store.get(K.seenFx, []), ...list.map(f => f.id)].slice(-300));
    for (const f of list) await burst(f);
  }
  function burst(f) {
    return new Promise(done => {
      const seat = A.seatOf?.(f.to);
      const el = seat && document.querySelector(`.seats-map [data-seat="${seat}"]`);
      el?.scrollIntoView({ block: 'center', inline: 'center' });
      setTimeout(() => {
        const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const cv = $('#fxCanvas'), dpr = devicePixelRatio || 1;
        cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cv.hidden = false;
        const g = cv.getContext('2d');
        g.scale(dpr, dpr);
        const colors = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c'];
        const parts = [];
        // 三發：中間一發大的，兩邊小的
        [[cx, cy, 1], [cx - 40, cy - 30, .7], [cx + 40, cy - 20, .7]].forEach(([x, y, k], n) => {
          for (let i = 0; i < 46 * k; i++) {
            const a = Math.random() * Math.PI * 2, v = (2 + Math.random() * 4.5) * k;
            parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: colors[(i + n) % colors.length], life: 60 + Math.random() * 30, delay: n * 14 });
          }
        });
        const label = `🎆 ${f.by} 送給 ${f.to}`;
        let t = 0;
        const step = () => {
          g.clearRect(0, 0, innerWidth, innerHeight);
          parts.forEach(p => {
            if (t < p.delay || t > p.delay + p.life) return;
            p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.985; p.vy *= 0.985;
            g.globalAlpha = Math.max(0, 1 - (t - p.delay) / p.life);
            g.fillStyle = p.c;
            g.beginPath(); g.arc(p.x, p.y, 2.6, 0, Math.PI * 2); g.fill();
          });
          g.globalAlpha = Math.min(1, t / 10) * (t > 110 ? Math.max(0, 1 - (t - 110) / 20) : 1);
          g.font = '700 16px system-ui, sans-serif'; g.textAlign = 'center';
          const w = g.measureText(label).width + 20;
          g.fillStyle = 'rgba(25,25,35,.85)'; g.fillRect(cx - w / 2, cy - r.height / 2 - 44, w, 28);
          g.fillStyle = '#fff'; g.fillText(label, cx, cy - r.height / 2 - 24);
          if (++t < 130) requestAnimationFrame(step); else { cv.hidden = true; done(); }
        };
        step();
      }, 350);
    });
  }

  // 目前的裝飾（只留還有效、還是自己的配件），轉成顯示用的格式
  function decoFromState() {
    const inv = Object.fromEntries(S.inv.filter(x => !x.expired).map(x => [x.id, x]));
    return (S.deco || []).filter(l => inv[l.inv]).map(l => ({ acc: inv[l.inv].acc, x: l.x, y: l.y, s: l.s, r: l.r }));
  }

  // ── 裝扮大頭照：拖曳移動，兩指縮放旋轉，或用滑桿調整 ──
  let ed = null; // { layers: [{inv, acc, x, y, s, r}], sel }
  function openEditor() {
    const inv = Object.fromEntries(S.inv.filter(x => !x.expired).map(x => [x.id, x]));
    ed = { layers: (S.deco || []).filter(l => inv[l.inv]).map(l => ({ ...l, acc: inv[l.inv].acc })), sel: -1 };
    ed.sel = ed.layers.length - 1;
    A.openSheet({ kind: 'deco' }, editorHtml());
    bindStage();
  }
  function editorHtml() {
    const me = S.me || A.me();
    const inv = S.inv.filter(x => !x.expired);
    const usedIds = new Set(ed.layers.map(l => l.inv));
    const L = ed.layers[ed.sel];
    let h = A.sheetHead('裝扮大頭照', '拖曳配件移動；兩指可以縮放、旋轉');
    h += `<div class="deco-wrap"><div class="deco-stage" id="decoStage"><span class="av">${A.faceBase(me)}${ed.layers.map((l, i) => A.layerHtml(l, i)).join('')}</span></div></div>`;
    if (L) {
      h += `<div class="deco-ctl">
        <label>大小<input type="range" id="decoS" min="10" max="200" value="${Math.round(L.s * 100)}"></label>
        <label>角度<input type="range" id="decoR" min="-180" max="180" value="${Math.round(L.r)}"></label>
        <div class="deco-btns"><button type="button" class="btn" data-act="up">⬆ 往前</button><button type="button" class="btn" data-act="down">⬇ 往後</button><button type="button" class="btn btn--danger" data-act="remove">拿掉</button></div></div>`;
    } else if (ed.layers.length) h += `<p class="muted small center">點一個配件來調整</p>`;
    h += `<h3>戴上配件</h3><div class="chips">`;
    const free = inv.filter(x => !usedIds.has(x.id));
    h += free.length ? free.map(x => `<button type="button" class="nm deco-add" data-act="add" data-inv="${esc(x.id)}"><span class="acc-thumb" style="${accImgStyle(x.acc)}"></span>${esc(x.name)}</button>`).join('')
      : '<span class="muted small">配件都戴上了</span>';
    h += `</div><div class="save-bar"><button type="button" class="btn btn--primary" data-act="decoSave">儲存</button></div>`;
    return h;
  }
  function rerender() {
    const scroll = A.sheetBody.scrollTop;
    A.sheetBody.innerHTML = editorHtml();
    A.sheetBody.scrollTop = scroll;
    bindStage();
  }
  function paint(i) {
    const el = $(`#decoStage .acc[data-l="${i}"]`), l = ed.layers[i];
    if (!el) return;
    el.style.left = (l.x * 100) + '%'; el.style.top = (l.y * 100) + '%'; el.style.width = (l.s * 100) + '%';
    el.style.transform = `translate(-50%,-50%) rotate(${l.r}deg)`;
  }
  function markSel() {
    document.querySelectorAll('#decoStage .acc').forEach(el => el.classList.toggle('sel', +el.dataset.l === ed.sel));
  }
  function bindStage() {
    const stage = $('#decoStage');
    if (!stage) return;
    markSel();
    const pts = new Map();
    let start = null;
    const snapshot = () => {
      const l = ed.layers[ed.sel];
      const p = [...pts.values()];
      start = { l: { ...l }, p: p.map(q => ({ ...q })) };
    };
    stage.addEventListener('pointerdown', e => {
      const el = e.target.closest('.acc');
      if (el && pts.size === 0) { ed.sel = +el.dataset.l; rerenderControls(); markSel(); }
      if (ed.sel < 0) return;
      stage.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      snapshot();
      e.preventDefault();
    });
    stage.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId) || !start) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = stage.getBoundingClientRect(), l = ed.layers[ed.sel];
      const p = [...pts.values()];
      if (p.length === 1 && start.p.length === 1) {
        l.x = start.l.x + (p[0].x - start.p[0].x) / r.width;
        l.y = start.l.y + (p[0].y - start.p[0].y) / r.height;
      } else if (p.length >= 2 && start.p.length >= 2) {
        const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        l.s = Math.max(0.1, Math.min(2, start.l.s * d(p[0], p[1]) / Math.max(1, d(start.p[0], start.p[1]))));
        l.r = ((start.l.r + ang(p[0], p[1]) - ang(start.p[0], start.p[1]) + 540) % 360) - 180;
        const mid = q => ({ x: (q[0].x + q[1].x) / 2, y: (q[0].y + q[1].y) / 2 });
        l.x = start.l.x + (mid(p).x - mid(start.p).x) / r.width;
        l.y = start.l.y + (mid(p).y - mid(start.p).y) / r.height;
      }
      l.x = Math.max(-0.3, Math.min(1.3, l.x)); l.y = Math.max(-0.3, Math.min(1.3, l.y));
      paint(ed.sel);
      syncSliders();
    });
    const end = e => { pts.delete(e.pointerId); if (pts.size) snapshot(); else start = null; };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }
  function syncSliders() {
    const l = ed.layers[ed.sel];
    if (!l) return;
    if ($('#decoS')) $('#decoS').value = Math.round(l.s * 100);
    if ($('#decoR')) $('#decoR').value = Math.round(l.r);
  }
  // 換選取的配件時，只重畫下面的控制（不要打斷拖曳）
  function rerenderControls() { setTimeout(() => { if (!document.querySelector('#decoStage .acc.sel') || !$('#decoS')) rerender(); else syncSliders(); }, 0); }
  A.sheetBody.addEventListener('input', e => {
    if (A.sheetMode()?.kind !== 'deco' || !ed) return;
    const l = ed.layers[ed.sel];
    if (!l) return;
    if (e.target.id === 'decoS') l.s = e.target.value / 100;
    if (e.target.id === 'decoR') l.r = +e.target.value;
    paint(ed.sel);
  });
  A.sheetHandlers.deco = async (act, b) => {
    if (act === 'add') {
      const x = S.inv.find(i => i.id === b.dataset.inv);
      ed.layers.push({ inv: x.id, acc: x.acc, x: 0.5, y: 0.35, s: 0.6, r: 0 });
      ed.sel = ed.layers.length - 1;
      return rerender();
    }
    if (act === 'remove') { ed.layers.splice(ed.sel, 1); ed.sel = ed.layers.length - 1; return rerender(); }
    if (act === 'up' || act === 'down') {
      const j = ed.sel + (act === 'up' ? 1 : -1);
      if (j < 0 || j >= ed.layers.length) return;
      [ed.layers[ed.sel], ed.layers[j]] = [ed.layers[j], ed.layers[ed.sel]];
      ed.sel = j;
      return rerender();
    }
    if (act === 'decoSave') {
      b.disabled = true; b.textContent = '儲存中…';
      try {
        S = await A.api('saveDeco', { layers: ed.layers.map(({ inv, x, y, s, r }) => ({ inv, x, y, s, r })) });
        A.setDeco(S.me || A.me(), decoFromState());
        A.closeSheet();
        toast('✓ 大頭照已更新，大家都看得到');
      } catch (err) { toast('儲存失敗：' + err.message); b.disabled = false; b.textContent = '儲存'; }
      render();
    }
  };

  // ── 換了新造型的同學：每週第一次打開 App 時，大頭照快速閃過＋震動 ──
  const FLASH = 'indoor.decoflash.v1' + A.SFX;
  const weekOf = d => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - (m.getDay() + 6) % 7); return A.fmtDate(m); }; // 這週的星期一
  A.on('decoNews', decoT => {
    const st = store.get(FLASH, {}), today = weekOf(new Date());
    if (st.day === today) return;
    const since = st.since || Date.now() - 7 * 86400e3;
    const byCode = Object.fromEntries(A.students().map(k => [code(k), k]));
    const keys = Object.entries(decoT || {}).filter(([c, t]) => t > since && byCode[c] && A.decoOf(byCode[c]).length).sort((a, b) => b[1] - a[1]).map(([c]) => byCode[c]);
    if (!keys.length) return;
    store.set(FLASH, { day: today, since: Date.now() });
    playFlash(keys.slice(0, 12));
  });
  function playFlash(keys) {
    let el = $('#decoFlash');
    if (!el) { el = document.createElement('div'); el.id = 'decoFlash'; document.body.append(el); el.addEventListener('click', () => { el.hidden = true; }); }
    el.innerHTML = `<div class="df-title">✨ 新造型</div><div class="df-face"></div>`;
    el.hidden = false;
    const box = el.querySelector('.df-face');
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = still ? 600 : 100;                               // 每張 0.1 秒
    const total = Math.max(1000, keys.length * step) + (still ? 0 : 300); // 至少震動 1 秒
    box.classList.toggle('shake', !still);
    let i = 0;
    const show = () => { const k = keys[i++ % keys.length]; box.innerHTML = `${A.faceHtml(k)}<span class="df-nm">${esc(k)}</span>`; };
    show();
    const t = setInterval(show, step);
    setTimeout(() => { clearInterval(t); el.classList.add('out'); setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 250); }, total);
  }
  A.flashTest = () => playFlash(A.students().filter(k => A.decoOf(k).length).slice(0, 12)); // 除錯用

  A.tabHooks.shop = () => { render(); load(); };
  A.on('start', () => setTimeout(() => A.ensureFaces?.(true), 1200));
  A.on('faces', () => { if (A.currentTab() === 'shop') render(); });

  // ── 測試模式：點數、配件、裝飾都只存在這台裝置（測試時先送 10 點） ──
  const prevTest = A.testSeatApi;
  const ymd = d => `${d.getFullYear()}/${A.pad2(d.getMonth() + 1)}/${A.pad2(d.getDate())}`;
  function schoolDaysLater(n) {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    let c = 0;
    for (let i = 0; i < 40; i++) { if (d.getDay() % 6 && ++c >= n) break; d.setDate(d.getDate() + 1); }
    return ymd(d);
  }
  async function testState() {
    const me = A.me(), today = ymd(new Date());
    const list = await A.builtinCatalog();
    const inv = store.get(K.inv, []);
    const pts = store.get('indoor.points.v1.test', []);
    const plus = pts.filter(r => r.student === me && r.points > 0);
    const earned = 10 + plus.reduce((t, r) => t + r.points, 0);
    const spent = inv.filter(x => x.buyer === me).reduce((t, x) => t + x.price, 0);
    const admin = A.isTeacher() ? A.DEMO_STUDENTS.map(k => {
      const e = 10 + pts.filter(r => r.student === k && r.points > 0).reduce((t, r) => t + r.points, 0);
      const s = inv.filter(x => x.buyer === k).reduce((t, x) => t + x.price, 0);
      return { key: k, earned: e, spent: s, coins: e - s, active: inv.filter(x => x.owner === k && x.exp >= today).length };
    }) : null;
    if (A.isTeacher()) {
      const st = await studentState(D.teacherLabel);
      return { ...st, coins: 999999, unlimited: true, admin, classmates: A.DEMO_STUDENTS };
    }
    return studentState(me);
  }
  async function studentState(me) {
    const today = ymd(new Date());
    const list = await A.builtinCatalog();
    const inv = store.get(K.inv, []);
    const pts = store.get('indoor.points.v1.test', []);
    const plus = pts.filter(r => r.student === me && r.points > 0);
    const earned = 10 + plus.reduce((t, r) => t + r.points, 0);
    const spent = inv.filter(x => x.buyer === me).reduce((t, x) => t + x.price, 0);
    // 示範：幾位同學先有配件，才能試竊盜卡
    if (!store.get('indoor.shopdemo.v1.test', false) && list.length) {
      store.set('indoor.shopdemo.v1.test', true);
      store.set(K.inv, [...store.get(K.inv, []), ...['多12張○讌', '料15陳○琳', '多17歐○曦'].map((k, i) => ({ id: 'demo' + i, owner: k, acc: list[i * 2].id, name: list[i * 2].name, price: 0, buyer: 'demo', exp: schoolDaysLater(10), note: '' }))]);
    }
    const inv2 = store.get(K.inv, []);
    const spend = store.get(K.spend, []);
    const spent2 = spent + spend.filter(x => x.who === me).reduce((t, x) => t + x.points, 0);
    const others = {};
    inv2.filter(x => x.owner !== me && x.exp >= today).forEach(x => { (others[x.owner] ||= []).push(x); });
    return {
      ok: true, me, today, coins: earned - spent2, earned, spent: spent2, catalog: list, stealPrice: 10, fireworkPrice: 1, others,
      stolen: spend.filter(x => x.use === '竊盜卡' && x.target === me).map(x => ({ time: x.time, thief: x.who, name: x.note })),
      swapPrice: 20, swapped: spend.filter(x => x.use === '交換位置卡' && x.target === me).map(x => ({ time: x.time, by: x.who, note: x.note })),
      plus: [{ date: today, points: 10, reason: '🧪 測試模式送的點數' }, ...plus.map(r => ({ date: r.date, points: r.points, reason: r.reason }))],
      classmates: A.DEMO_STUDENTS.filter(k => k !== me),
      inv: inv2.filter(x => x.owner === me).map(x => ({ ...x, expired: x.exp < today })),
      deco: store.get(K.deco, {})[me] || [],
    };
  }
  A.testSeatApi = async (action, p = {}) => {
    const me = A.isTeacher() ? D.teacherLabel : A.me(), today = ymd(new Date());
    if (action === 'createAcc' || action === 'delAcc') throw new Error('測試模式不能創造商品，請用正式登入試用');
    if (action === 'shopState') return testState();
    if (action === 'accImages') return { ok: true, images: {}, ids: [] };
    if (action === 'buyAcc') {
      const st = await testState();
      const a = st.catalog.find(x => x.id === p.acc);
      if (!a) throw new Error('沒有這個配件');
      if (st.coins < a.price) throw new Error(`點數不夠（需要 ${a.price} 點，你有 ${st.coins} 點）`);
      store.set(K.inv, [...store.get(K.inv, []), { id: Math.random().toString(36).slice(2, 10), owner: me, acc: a.id, name: a.name, price: a.price, buyer: me, exp: schoolDaysLater(10), note: '' }]);
      return testState();
    }
    if (action === 'giftAcc') {
      const inv = store.get(K.inv, []), x = inv.find(i => i.id === p.inv);
      if (!x || x.owner !== me) throw new Error('這個配件不是你的');
      x.owner = p.to; x.note = '由 ' + me + ' 贈送';
      store.set(K.inv, inv);
      return testState();
    }
    if (action === 'swapSeatCard') {
      const st = await testState();
      if (st.coins < 20) throw new Error(`點數不夠（交換位置卡要 20 點，你有 ${st.coins} 點）`);
      const chart = store.get('indoor.testchart.v1.test', {});
      const mine = Object.keys(chart).find(id => chart[id] === me), theirs = Object.keys(chart).find(id => chart[id] === p.to);
      if (!mine || !theirs) throw new Error('兩個人都要有座位才能交換');
      chart[mine] = p.to; chart[theirs] = me;
      store.set('indoor.testchart.v1.test', chart);
      const t = new Date();
      store.set(K.spend, [...store.get(K.spend, []), { id: Math.random().toString(36).slice(2, 10), who: me, points: 20, use: '交換位置卡', target: p.to, note: `${mine} ⇄ ${theirs}`, time: `${A.pad2(t.getMonth() + 1)}/${A.pad2(t.getDate())} ${A.fmtTime(t)}`, t: Date.now() }]);
      return testState();
    }
    if (action === 'stealAcc' || action === 'buyFirework') {
      const st = await testState();
      const price = action === 'stealAcc' ? 10 : 1;
      if (st.coins < price) throw new Error('點數不夠');
      const spend = store.get(K.spend, []), t = new Date();
      const time = `${A.pad2(t.getMonth() + 1)}/${A.pad2(t.getDate())} ${A.fmtTime(t)}`;
      if (action === 'stealAcc') {
        const inv = store.get(K.inv, []), x = inv.find(i => i.id === p.inv);
        if (!x || x.owner === me) throw new Error('找不到這個配件');
        spend.push({ id: Math.random().toString(36).slice(2, 10), who: me, points: price, use: '竊盜卡', target: x.owner, note: x.name, time, t: Date.now() });
        x.owner = me; x.note = '用竊盜卡奪來';
        store.set(K.inv, inv);
      } else {
        spend.push({ id: Math.random().toString(36).slice(2, 10), who: me, points: price, use: '煙火', target: p.to, note: '', time, t: Date.now() });
      }
      store.set(K.spend, spend);
      return testState();
    }
    if (action === 'saveDeco') {
      const all = store.get(K.deco, {});
      all[me] = p.layers;
      store.set(K.deco, all);
      return testState();
    }
    const r = prevTest ? await prevTest(action, p) : null;
    if (action === 'getFaces' && r) {
      // 大家的裝飾（只留仍然擁有、沒過期的）
      const inv = Object.fromEntries(store.get(K.inv, []).map(x => [x.id, x]));
      const deco = {};
      Object.entries(store.get(K.deco, {})).forEach(([k, ls]) => {
        const ok = ls.filter(l => inv[l.inv] && inv[l.inv].owner === k && inv[l.inv].exp >= today).map(l => ({ acc: inv[l.inv].acc, x: l.x, y: l.y, s: l.s, r: l.r }));
        if (ok.length) deco[code(k)] = ok;
      });
      r.deco = deco;
      r.fireworks = store.get(K.spend, []).filter(x => x.use === '煙火' && x.t > Date.now() - 3 * 86400e3).map(x => ({ id: x.id, by: x.who, to: x.target, time: x.time }));
    }
    return r;
  };
})();
