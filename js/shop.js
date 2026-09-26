'use strict';
/* 🛍 商店：同學用「加分」得到的點數買大頭照配件，可以自己用或送人；配件有效 10 個上課日 */
(() => {
  const A = window.App, D = A.D;
  const { $, esc, toast, store } = A;
  const K = { inv: 'indoor.shopinv.v1.test', deco: 'indoor.shopdeco.v1.test', spend: 'indoor.shopspend.v1.test', seenFx: 'indoor.fxseen.v1' + A.SFX };
  let S = null;          // 雲端回傳的商店狀態
  let loading = false;
  let loadedAt = 0;      // 上次從雲端讀取的時間

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
      loadedAt = Date.now();
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
    // 最上面：重新整理（同學剛上架的商品、剛收到的點數，按一下就看得到）
    let h = `<div class="shop-top"><span class="muted small">${loadedAt ? `更新於 ${A.fmtTime(new Date(loadedAt))}` : ''}</span>
      <button type="button" class="btn shop-refresh" data-s="refresh"${loading ? ' disabled' : ''}>${loading ? '讀取中…' : '🔄 重新整理'}</button></div>`;
    h += (S.stolen || []).map(x => `<div class="banner warn"><div class="bn-sub">⚠ 你的「${esc(x.name)}」被 ${esc(x.thief)} 用竊盜卡奪走了（${esc(x.time)}）</div></div>`).join('');
    const banned = S.swapBan != null && S.minus > S.swapBan;
    const heldList = Object.entries(S.held || {});
    if (heldList.length) h += `<div class="banner ok"><div class="bn-main">🎁 你手上有：${heldList.map(([n, c]) => `${esc(n)} ×${c}`).join('、')}</div><div class="bn-sub">${esc((S.rankCards || []).map(x => x.from).join('、'))}｜使用時不會扣點數</div></div>`;
    h += (S.swapped || []).map(x => `<div class="banner warn"><div class="bn-sub">🔀 ${esc(x.by)} 用交換位置卡和你對調了座位（${esc(x.time)}）</div></div>`).join('');
    h += `<div class="panel shop-me">
      <div class="shop-face"><span class="photo">${A.faceHtml(me)}</span></div>
      <div class="shop-wallet"><div class="coins">💰 <b>${coinTxt}</b> 點</div>
        <div class="muted small">${S.unlimited ? '導師點數無限，可以試用所有商品' : `加分累計 ${S.earned} 點${S.income ? `（含作品收入 ${S.income} 點）` : ''}・已使用 ${S.spent} 點${S.penalty ? `・扣分扣掉 ${S.penalty} 點` : ''}`}</div>
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
    const md = S.myDraw || {};
    if (md.transfer || md.sure?.length) {
      h += `<div class="panel"><h3>我的抽籤卡</h3><ul class="inv">`;
      if (md.transfer) h += `<li><span class="sp-ico">🔄</span><div class="inv-what"><b>抽籤轉移卡生效中</b><div class="muted small">替身：${esc(md.transfer.to)}｜到 ${esc(md.transfer.until)}</div></div></li>`;
      (md.sure || []).forEach(x => { h += `<li><span class="sp-ico">🎯</span><div class="inv-what"><b>抽籤必中卡（等待發動）</b><div class="muted small">指定：${esc(x.target)}</div></div></li>`; });
      h += `</ul></div>`;
    }
    if (S.sales?.items.length) {
      h += `<div class="panel"><h3>我創造的商品</h3><p class="muted small">已經賣出 ${S.sales.n} 次，收入 ${S.sales.income} 點（已算進你的點數）。</p><ul class="inv">${S.sales.items.map(a =>
        `<li><span class="acc-thumb" style="${accImgStyle(a.id)}"></span><div class="inv-what"><b>${esc(a.name)}</b>${a.delisted ? ' <span class="tag">已下架</span>' : ''}<div class="muted small">售價 ${a.price} 點・賣出 ${a.sold} 次${a.delisted ? '｜已經買的人可以用到到期' : ''}</div></div>
          ${a.delisted ? '' : `<button type="button" class="btn btn--danger" data-s="delAcc" data-acc="${esc(a.id)}" data-name="${esc(a.name)}">下架</button>`}</li>`).join('')}</ul></div>`;
    }
    h += `<div class="panel"><h3>商店</h3><p class="muted small">每個配件買了之後有效 10 個上課日（週六、週日不算），可以自己用，也可以送給同學。</p><div class="shop-grid">`;
    S.catalog.filter(a => !a.delisted).forEach(a => {
      const can = S.coins >= a.price;
      h += `<div class="shop-item"><span class="acc-thumb big" style="${accImgStyle(a.id)}"></span><b>${esc(a.name)}</b>${a.creator ? `<span class="muted small">🎨 ${esc(a.creator)}</span>` : ''}
        ${S.admin && a.creator ? `<span class="shop-admin"><button type="button" class="mini-btn" data-s="delAcc" data-acc="${esc(a.id)}" data-name="${esc(a.name)}">下架</button><button type="button" class="mini-btn danger" data-s="removeAcc" data-acc="${esc(a.id)}" data-name="${esc(a.name)}">移除退點</button></span>` : ''}
        <button type="button" class="btn${can ? ' btn--primary' : ''}" data-s="buy" data-acc="${esc(a.id)}"${can ? '' : ' disabled'}>💰 ${a.price} 點</button></div>`;
    });
    h += `</div></div>`;
    if (S.plus?.length) {
      h += `<details class="panel"><summary><b>我的加分紀錄</b></summary><ul class="pt-list">${S.plus.map(p =>
        `<li><span class="pt-v plus">+${p.points}</span><div class="pt-what">${esc(p.reason)}<div class="muted small">${esc(p.date)}</div></div></li>`).join('')}</ul></details>`;
    }
    // 特殊道具放在商店最下面；可以送人的道具多一個「🎁 送人」按鈕；手上有卡（別人送的、段考獎勵）就免費用
    const held = S.held || {};
    const sp = (key, card, cls, ico, title, desc, price, can, extra = '') => {
      const n = held[card] || 0;
      const priceTxt = n ? `🎟 你有 ${n} 張` : price;
      const giftable = (S.giftable || []).includes(card);
      return `<div class="sp-cell"><button type="button" class="special ${cls}" data-s="${key}"${n || can ? '' : ' disabled'}${extra}><span class="sp-ico">${ico}</span><b>${title}</b><span class="muted small">${desc}</span><span class="sp-price">${priceTxt}</span></button>
        ${giftable ? `<button type="button" class="sp-gift" data-s="giftCard" data-card="${esc(card)}" data-ico="${ico}"${S.coins >= (S.giftPrice?.[card] ?? 0) ? '' : ''}>🎁 送人</button>` : ''}</div>`;
    };
    const swapFree = held['交換位置卡'] || 0;
    const specialsHtml = `<div class="panel"><h3>特殊道具</h3><p class="muted small">有 🎁 的道具可以買來送給同學，對方可以免費使用。</p><div class="specials">
      ${sp('firework', '煙火', '', '🎆', '煙火', '放在同學的座位上，大家下次打開 App 時都會看到', `💰 ${S.fireworkPrice} 點`, S.coins >= S.fireworkPrice)}
      ${sp('swap', '交換位置卡', 'swap', '🔀', '交換位置卡', banned ? `你被扣了 ${S.minus} 分（超過 ${S.swapBan} 分），不能使用` : S.unlimited ? '和另一位同學強制對調座位（導師請按「送人」）' : '和另一位同學強制對調座位', `💰 ${S.swapPrice || 20} 點`, !banned && (swapFree || S.coins >= (S.swapPrice || 20)))}
      ${sp('steal', '竊盜卡', 'steal', '🦹', '竊盜卡', `把別人的一個配件變成你的（到期日不變）${othersN ? '' : '｜目前沒有人有配件'}`, `💰 ${S.stealPrice} 點`, S.coins >= S.stealPrice && othersN)}
      ${sp('sun', '小太陽卡', 'wx', '☀️', '小太陽卡', `放在一位同學的座位上方，維持 ${S.weatherDays || 10} 個上課日`, `💰 ${S.weatherPrice || 5} 點`, S.coins >= (S.weatherPrice || 5))}
      ${sp('rain', '小雨傘卡', 'wx', '☂️', '小雨傘卡', `放在一位同學的座位上方，維持 ${S.weatherDays || 10} 個上課日`, `💰 ${S.weatherPrice || 5} 點`, S.coins >= (S.weatherPrice || 5))}
      ${sp('transfer', '抽籤轉移卡', 'drawc', '🔄', '抽籤轉移卡', `設定一位替身：${S.transferDays || 10} 天內抽籤抽到你，會立刻換成替身上場（次數不限）`, `💰 ${S.transferPrice || 20} 點`, S.coins >= (S.transferPrice || 20))}
      ${sp('sure', '抽籤必中卡', 'drawc', '🎯', '抽籤必中卡', '指定一位同學：下一次抽籤，第一位一定會變成他（只有一次）', `💰 ${S.surePrice || 30} 點`, S.coins >= (S.surePrice || 30))}
      ${A.isGiftBoxMaker?.() ? sp('giftbox', '禮物盒', 'gbox', '🎁', '禮物盒（導師、班長、副班長專屬）', '每週一次：上傳一張圖片變成驚喜盒，放在教室正中間；大家打開會隨機得到煙火、小太陽卡或小雨傘卡', '每週 1 個', true) : ''}
      ${sp('mail', '信紙', 'mail', '🕊', '信紙（飛鴿傳書）', '寫一封信給同學或導師，對方下次打開 App 就會看到，3 天後自動消失', '免費', true)}
      ${sp('create', '創造卡', 'create', '🎨', '創造卡', '上傳自己畫的 PNG 變成新商品；別人買了，點數算給你', '免費建立', true)}
    </div></div>`;
    h += specialsHtml;
    h += `<div class="panel penalty-note"><h3>⚠️ 扣分會減少點數</h3>
      <p class="small">每被扣 <b>${S.penaltyPer || 2} 分</b>，商店點數就減少 <b>1 點</b>，最少扣到 0 點（不會變成負的）。${S.penaltyFrom ? `${esc(S.penaltyFrom)} 以後的扣分才算。` : ''}</p>
      <p class="small muted">被扣分的同學，接下來的 3 次抽籤也比較容易被抽到（詳情看「抽籤」頁）。</p></div>`;
    if (S.admin) h += adminHtml();
    root.innerHTML = h;
  }

  // 導師：新增配件的方法、全班點數（放在最下面，預設收起來）
  // 特殊道具的小圖示＋數量（滑過去看全名）
  const ITEM_ICON = { 免費交換位置卡: '🎟', 交換位置卡: '🔀', 抽籤必中卡: '🎯', 抽籤轉移卡: '🔄', 小太陽卡: '☀️', 小雨傘卡: '☂️', 煙火: '🎆', 竊盜卡: '🦹' };
  const itemChips = m => Object.entries(m || {}).filter(([, c]) => c > 0).map(([n, c]) => {
    const card = n.replace(/^🎟/, ''), mark = n !== card ? '🎟' : '';
    return `<span class="it-chip" title="${esc(mark ? '手上的' + card : n)}">${mark}${ITEM_ICON[card] || '•'}${c > 1 ? '×' + c : ''}</span>`;
  }).join('') || '';
  function adminHtml() {
    let h = '';
    h += `<details class="panel"><summary><b>成員點數</b> <span class="muted small">（${S.admin.length} 人）</span></summary>
      <p class="muted small">點數＝加分累計＋作品收入＋紅包 − 用掉的 − 扣分扣點（每扣 2 分減 1 點，最少到 0）。</p>
      <p class="muted small">「持有道具」＝還沒用或還在生效的特殊道具；「用過」＝用過幾次。</p>
      <div class="admin-wrap"><table class="admin"><thead><tr><th>同學</th><th>加分</th><th>已用</th><th>扣分扣點</th><th>剩餘</th><th>配件</th><th>持有道具</th><th>用過</th></tr></thead><tbody>`;
    S.admin.forEach(r => {
      h += `<tr><td>${esc(r.key)}</td><td>${r.earned}${r.income ? `<div class="muted small">作品 ${r.income}</div>` : ''}</td><td>${r.spent}</td><td>${r.penalty ? '−' + r.penalty : ''}</td><td><b>${r.coins}</b></td><td>${r.active || ''}</td>
        <td class="items">${itemChips(r.held)}</td><td class="items muted">${itemChips(r.used)}</td></tr>`;
    });
    // 全班合計
    const sum = key => { const t = {}; S.admin.forEach(r => Object.entries(r[key] || {}).forEach(([n, c]) => { t[n] = (t[n] || 0) + c; })); return t; };
    h += `</tbody><tfoot><tr><td colspan="6"><b>全班合計</b></td><td class="items">${itemChips(sum('held'))}</td><td class="items muted">${itemChips(sum('used'))}</td></tr></tfoot>`;
    return h + `</table></div></details>`;
  }

  $('#shopRoot').addEventListener('click', async e => {
    const b = e.target.closest('[data-s]');
    if (!b || b.disabled) return;
    const act = b.dataset.s;
    if (act === 'refresh') {
      b.disabled = true; b.textContent = '讀取中…';
      await Promise.all([load(), A.loadAccImages?.().catch(() => {})]);
      A.ensureFaces?.(true); // 大家的大頭照裝飾也一起更新
      toast('✓ 已更新');
      return;
    }
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
    } else if (act === 'giftbox') {
      A.openGiftBoxMaker?.();
    } else if (act === 'giftCard') {
      openCardGift(b.dataset.card, b.dataset.ico);
    } else if (act === 'mail') {
      A.openMailCompose?.();
    } else if (act === 'sun' || act === 'rain') {
      openWeather(act);
    } else if (act === 'transfer' || act === 'sure') {
      openDrawCard(act);
    } else if (act === 'delAcc') {
      if (!await A.ask(`下架「${b.dataset.name}」？\n下架後不能再買；已經買的人可以繼續用到到期，大頭照上的裝扮不會消失。`, '下架', true)) return;
      b.disabled = true;
      try { S = await A.api('delAcc', { acc: b.dataset.acc }); toast('已下架（已經買的人可以用到到期）'); } catch (err) { toast(err.message); }
      render();
    } else if (act === 'removeAcc') {
      if (!await A.ask(`立刻移除「${b.dataset.name}」？\n內容不適當時才用：圖片會馬上拿掉（大家的大頭照上也會消失），並把點數退還給每一位買的人。`, '移除並退點', true)) return;
      b.disabled = true;
      try { S = await A.api('delAcc', { acc: b.dataset.acc, mode: 'remove' }); toast('已移除，點數已退還'); A.ensureFaces?.(true); } catch (err) { toast(err.message); }
      render();
    }
  });

  // ── 買特殊道具送人 ──
  const CARD_PRICE = () => ({ 交換位置卡: S.swapPrice || 20, 竊盜卡: S.stealPrice || 10, 抽籤必中卡: S.surePrice || 30, 煙火: S.fireworkPrice || 1, 小太陽卡: S.weatherPrice || 5, 小雨傘卡: S.weatherPrice || 5 });
  function openCardGift(card, ico) {
    const price = CARD_PRICE()[card];
    let h = A.sheetHead(`🎁 送一張${card}`, `花 ${price} 點買給同學，對方可以免費使用`);
    h += `<div class="field"><label for="gcTo">送給</label><select id="gcTo"><option value="">— 請選擇同學 —</option>${S.classmates.filter(k => k !== S.me).map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}</select></div>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="gcOk"${S.coins >= price ? '' : ' disabled'}>${ico} 送出（${S.unlimited ? '導師免費' : price + ' 點'}）</button></div>
      ${S.coins >= price ? '' : `<p class="muted small">點數不夠（你有 ${S.coins} 點）</p>`}`;
    A.openSheet({ kind: 'giftcard', card }, h);
  }
  A.sheetHandlers.giftcard = async (act, b) => {
    if (act !== 'gcOk') return;
    const { card } = A.sheetMode();
    const to = $('#gcTo').value;
    if (!to) return toast('請選擇同學');
    if (!await A.ask(`送一張「${card}」給 ${to}？\n（${S.unlimited ? '導師不扣點數' : `花 ${CARD_PRICE()[card]} 點`}）`, '送出')) return;
    b.disabled = true;
    try { S = await A.api('giftCard', { card, to }); A.closeSheet(); toast(`🎁 已送出${card}給 ${to}`); } catch (err) { toast(err.message); b.disabled = false; }
    render();
  };

  // ── 小太陽卡／小雨傘卡：選一位同學 ──
  function openWeather(kind) {
    const sun = kind === 'sun';
    let h = A.sheetHead(`${sun ? '☀️ 小太陽卡' : '☂️ 小雨傘卡'}（${S.weatherPrice || 5} 點）`, `放在誰的座位上方？維持 ${S.weatherDays || 10} 個上課日`);
    const list = [S.me, ...S.classmates].filter(k => k && k !== A.D.teacherLabel);
    h += `<div class="field"><select id="wxTo"><option value="">— 請選擇同學 —</option>${list.map(k => `<option value="${esc(k)}">${esc(k)}${k === S.me ? '（自己）' : ''}</option>`).join('')}</select></div>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="wxOk">${sun ? '☀️ 放小太陽' : '☂️ 放小雨傘'}</button></div>`;
    A.openSheet({ kind: 'weather', card: kind }, h);
  }
  A.sheetHandlers.weather = async (act, b) => {
    if (act !== 'wxOk') return;
    const { card } = A.sheetMode();
    const to = $('#wxTo').value;
    if (!to) return toast('請選擇同學');
    b.disabled = true;
    try {
      S = await A.api('buyWeather', { kind: card, to });
      A.closeSheet();
      toast(`${card === 'sun' ? '☀️ 小太陽' : '☂️ 小雨傘'}放在 ${to} 的座位上了！`);
      A.ensureFaces?.(true);
    } catch (err) { toast(err.message); b.disabled = false; }
    render();
  };

  // ── 抽籤轉移卡／抽籤必中卡：選一位同學 ──
  function openDrawCard(kind) {
    const tr = kind === 'transfer';
    const price = tr ? S.transferPrice || 20 : S.surePrice || 30;
    let h = A.sheetHead(tr ? `🔄 抽籤轉移卡（${price} 點）` : `🎯 抽籤必中卡（${price} 點）`,
      tr ? `${S.transferDays || 10} 天內，抽籤抽到你時會立刻換成替身（次數不限）` : '下一次抽籤，第一位一定會切換成你指定的同學（只有一次）');
    const list = tr ? S.classmates : [S.me, ...S.classmates].filter(k => k && k !== A.D.teacherLabel);
    h += `<div class="field"><label for="dcTo">${tr ? '替身' : '指定同學'}</label><select id="dcTo"><option value="">— 請選擇同學 —</option>${list.map(k => `<option value="${esc(k)}">${esc(k)}${k === S.me ? '（自己）' : ''}</option>`).join('')}</select></div>
      ${tr && S.myDraw?.transfer ? `<p class="muted small">你已經有一張生效中的轉移卡（替身 ${esc(S.myDraw.transfer.to)}），買新的會改用新的替身、重新算 ${S.transferDays || 10} 天。</p>` : ''}
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="dcOk">${tr ? '🔄 設定替身' : '🎯 使用必中卡'}</button></div>`;
    A.openSheet({ kind: 'drawcard', card: kind }, h);
  }
  A.sheetHandlers.drawcard = async (act, b) => {
    if (act !== 'dcOk') return;
    const { card } = A.sheetMode();
    const to = $('#dcTo').value;
    if (!to) return toast('請選擇同學');
    const tr = card === 'transfer';
    if (!await A.ask(tr ? `花 ${S.transferPrice || 20} 點，設定 ${to} 當你的替身？` : `花 ${S.surePrice || 30} 點，下一次抽籤第一位一定是 ${to}？`, tr ? '設定' : '使用')) return;
    b.disabled = true;
    try {
      S = await A.api('buyDrawCard', { kind: card, to });
      A.closeSheet();
      toast(tr ? `🔄 替身設定好了：${to}` : `🎯 必中卡已設定：${to}`);
    } catch (err) { toast(err.message); b.disabled = false; }
    render();
  };

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
      <p class="muted small" id="mkInfo">建議尺寸：<b>正方形 256×256 像素</b>、去背（透明背景）的 PNG，圖案盡量填滿畫面、四周不要留太多空白。比較大的圖會自動縮小到 256 像素以內；不是正方形也可以，會等比例放進正方形裡。同學買了之後，點數會加到你的帳戶（每人每天最多 3 個）。不適當的商品，導師可以按「下架」；你也可以下架自己做的商品。</p>
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
    if (S.unlimited) return openCardGift('交換位置卡', '🔀'); // 導師沒有座位：直接送人
    if (!A.useSwapCard) return openSwapList();
    if (!A.seatOf?.(S.me)) return toast('你還沒有座位，不能用交換位置卡');
    A.useSwapCard((S.held?.['交換位置卡'] || S.freeSwap) ? 0 : S.swapPrice || 20);
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
  // 一次只放一支：正在放的時候又有新的，就排在後面依序放
  let playing = false;
  async function playPending() {
    if (playing || !pendingFx.length || A.currentTab() !== 'seats' || document.hidden) return;
    playing = true;
    try {
      while (pendingFx.length && A.currentTab() === 'seats' && !document.hidden) {
        const f = pendingFx.shift();
        store.set(K.seenFx, [...store.get(K.seenFx, []), f.id].slice(-300));
        await burst(f);
        await new Promise(r => setTimeout(r, 250));
      }
    } finally { playing = false; }
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
        // 文字框：字太長就縮小；位置夾在畫面內（不被上方標題列擋住、不超出左右）
        const top = (document.querySelector('.topbar, header')?.getBoundingClientRect().bottom || 0) + 8;
        let fs = 16;
        g.font = `700 ${fs}px system-ui, sans-serif`;
        while (fs > 11 && g.measureText(label).width + 20 > innerWidth - 16) { fs--; g.font = `700 ${fs}px system-ui, sans-serif`; }
        const bw = Math.min(innerWidth - 16, g.measureText(label).width + 20), bh = fs + 12;
        const bx = Math.max(8, Math.min(innerWidth - 8 - bw, cx - bw / 2));
        let by = cy - r.height / 2 - bh - 14;                       // 預設在座位上方
        if (by < top) by = cy + r.height / 2 + 14;                   // 上面放不下就放下面
        by = Math.max(top, Math.min(innerHeight - bh - 8, by));
        // 文字「誰送給誰」顯示 3 秒；煙火延遲 0.5 秒才開始放
        const LABEL_MS = 3000, FX_DELAY = 500, t0 = performance.now();
        let t = 0; // 煙火已經放了幾格
        const step = () => {
          const e = performance.now() - t0;
          g.clearRect(0, 0, innerWidth, innerHeight);
          if (e >= FX_DELAY) {
            parts.forEach(p => {
              if (t < p.delay || t > p.delay + p.life) return;
              p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.985; p.vy *= 0.985;
              g.globalAlpha = Math.max(0, 1 - (t - p.delay) / p.life);
              g.fillStyle = p.c;
              g.beginPath(); g.arc(p.x, p.y, 2.6, 0, Math.PI * 2); g.fill();
            });
            t++;
          }
          g.globalAlpha = Math.min(1, e / 150) * Math.max(0, Math.min(1, (LABEL_MS - e) / 250));
          g.font = `700 ${fs}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = 'rgba(25,25,35,.88)';
          g.beginPath(); g.roundRect ? g.roundRect(bx, by, bw, bh, 8) : g.rect(bx, by, bw, bh); g.fill();
          g.fillStyle = '#fff'; g.fillText(label, bx + bw / 2, by + bh / 2, bw - 12);
          if (e < LABEL_MS || t < 130) requestAnimationFrame(step); else { cv.hidden = true; done(); }
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
      const sp = store.get(K.spend, []).filter(x => x.who === k), used = {};
      sp.forEach(x => { used[x.use] = (used[x.use] || 0) + 1; });
      const held = {};
      sp.filter(x => x.use === '抽籤必中卡' && !/^已使用/.test(x.note)).forEach(() => { held.抽籤必中卡 = (held.抽籤必中卡 || 0) + 1; });
      sp.filter(x => (x.use === '小太陽卡' || x.use === '小雨傘卡') && x.note >= today).forEach(x => { held[x.use] = (held[x.use] || 0) + 1; });
      return { key: k, earned: e, spent: s, coins: e - s, active: inv.filter(x => x.owner === k && x.exp >= today).length, held, used };
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
      ok: true, me, today, ...(() => { const minus = pts.filter(r => r.student === me && r.points < 0).reduce((t, r) => t - r.points, 0); const pen = Math.min(Math.max(0, earned - spent2), Math.floor(minus / 2)); return { coins: earned - spent2 - pen, penalty: pen, penaltyPer: 2, penaltyFrom: '2026/09/26' }; })(), earned, spent: spent2, catalog: list, stealPrice: 10, fireworkPrice: 1, others,
      stolen: spend.filter(x => x.use === '竊盜卡' && x.target === me).map(x => ({ time: x.time, thief: x.who, name: x.note })),
      minus: pts.filter(r => r.student === me && r.points < 0).reduce((t, r) => t - r.points, 0), swapBan: 10,
      transferPrice: 20, surePrice: 30, transferDays: 10, weatherPrice: 5, weatherDays: 10,
      giftable: ['交換位置卡', '竊盜卡', '抽籤必中卡', '煙火', '小太陽卡', '小雨傘卡'],
      held: (() => { const h = {}; store.get('indoor.testcards.v1.test', []).filter(x => x.who === me).forEach(x => { h[x.card] = (h[x.card] || 0) + x.n; }); spend.filter(x => x.who === me && x.points === 0 && h[x.use]).forEach(x => { h[x.use]--; }); Object.keys(h).forEach(k => { if (h[k] <= 0) delete h[k]; }); return h; })(),
      rankCards: store.get('indoor.testcards.v1.test', []).filter(x => x.who === me).slice(-5).reverse(),
      myDraw: (() => {
        const sp = spend, since = Date.now() - 10 * 86400e3;
        const trs = sp.filter(x => x.use === '抽籤轉移卡' && x.who === me && x.t >= since);
        const t = trs.pop();
        return { transfer: t ? { to: t.target, until: ymd(new Date(t.t + 10 * 86400e3)) } : null, sure: sp.filter(x => x.use === '抽籤必中卡' && x.who === me && !/^已使用/.test(x.note)).map(x => ({ target: x.target })) };
      })(),
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
    const testFx = () => {
      const sp = store.get(K.spend, []), since = Date.now() - 10 * 86400e3;
      // 加權：每扣 1 分 +10%，持續接下來的 3 次抽籤
      const draws = store.get('indoor.drawlog.v1.test', []).map(x => x.ts);
      const weights = {};
      store.get('indoor.points.v1.test', []).filter(r => r.points < 0).forEach(r => {
        const t = r.ts || Date.now();
        const used = draws.filter(d => d > t).length;
        if (used >= 3) return;
        const o = weights[r.student] || (weights[r.student] = { pts: 0, left: 0 });
        o.pts += -r.points; o.left = Math.max(o.left, 3 - used); o.w = Math.round((1 + o.pts * 0.1) * 100) / 100;
      });
      return {
        weights, boost: 0.1, boostTimes: 3,
        transfers: sp.filter(x => x.use === '抽籤轉移卡' && x.t >= since).map(x => ({ id: x.id, from: x.who, to: x.target, until: ymd(new Date(x.t + 10 * 86400e3)), t: x.t })),
        sure: sp.filter(x => x.use === '抽籤必中卡' && !/^已使用/.test(x.note)).map(x => ({ id: x.id, by: x.who, target: x.target, t: x.t })),
      };
    };
    if (action === 'getDrawFx') return { ok: true, ...testFx() };
    if (action === 'drawUsed') {
      const sp = store.get(K.spend, []), x = sp.find(y => y.id === p.id);
      if (!x || /^已使用/.test(x.note)) return { ok: false };
      x.note = '已使用'; store.set(K.spend, sp); return { ok: true };
    }
    if (action === 'giftCard') {
      const st = await testState();
      const price = { 交換位置卡: 20, 竊盜卡: 10, 抽籤必中卡: 30, 煙火: 1, 小太陽卡: 5, 小雨傘卡: 5 }[p.card];
      if (!A.isTeacher() && st.coins < price) throw new Error('點數不夠');
      const t = new Date();
      store.set(K.spend, [...store.get(K.spend, []), { id: Math.random().toString(36).slice(2, 10), who: me, points: A.isTeacher() ? 0 : price, use: '送禮', target: p.to, note: p.card, time: '', t: Date.now() }]);
      store.set('indoor.testcards.v1.test', [...store.get('indoor.testcards.v1.test', []), { who: p.to, card: p.card, n: 1, from: me + ' 送的', t: t.getTime() }]);
      return testState();
    }
    if (action === 'buyWeather') {
      const st = await testState();
      if (st.coins < 5) throw new Error('點數不夠');
      const t = new Date();
      store.set(K.spend, [...store.get(K.spend, []), { id: Math.random().toString(36).slice(2, 10), who: me, points: 5, use: p.kind === 'sun' ? '小太陽卡' : '小雨傘卡', target: p.to, note: schoolDaysLater(10), time: `${A.pad2(t.getMonth() + 1)}/${A.pad2(t.getDate())} ${A.fmtTime(t)}`, t: Date.now() }]);
      return testState();
    }
    if (action === 'buyDrawCard') {
      const st = await testState();
      const tr = p.kind === 'transfer', price = tr ? 20 : 30;
      if (tr && p.to === me) throw new Error('替身不能是自己');
      if (st.coins < price) throw new Error('點數不夠');
      const t = new Date();
      store.set(K.spend, [...store.get(K.spend, []), { id: Math.random().toString(36).slice(2, 10), who: me, points: price, use: tr ? '抽籤轉移卡' : '抽籤必中卡', target: p.to, note: '', time: `${A.pad2(t.getMonth() + 1)}/${A.pad2(t.getDate())} ${A.fmtTime(t)}`, t: Date.now() }]);
      return testState();
    }
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
      if (st.minus > 10) throw new Error(`你被扣的分數已經 ${st.minus} 分（超過 10 分），不能使用交換位置卡`);
      const freeCard = (st.held?.['交換位置卡'] || 0) > 0;
      if (!freeCard && st.coins < 20) throw new Error(`點數不夠（交換位置卡要 20 點，你有 ${st.coins} 點）`);
      const chart = store.get('indoor.testchart.v1.test', {});
      const mine = Object.keys(chart).find(id => chart[id] === me), theirs = Object.keys(chart).find(id => chart[id] === p.to);
      if (!mine || !theirs) throw new Error('兩個人都要有座位才能交換');
      chart[mine] = p.to; chart[theirs] = me;
      store.set('indoor.testchart.v1.test', chart);
      const t = new Date();
      store.set(K.spend, [...store.get(K.spend, []), { id: Math.random().toString(36).slice(2, 10), who: me, points: freeCard ? 0 : 20, use: '交換位置卡', target: p.to, note: `${mine} ⇄ ${theirs}`, time: `${A.pad2(t.getMonth() + 1)}/${A.pad2(t.getDate())} ${A.fmtTime(t)}`, t: Date.now() }]);
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
      r.weather = store.get(K.spend, []).filter(x => (x.use === '小太陽卡' || x.use === '小雨傘卡') && x.note >= today).map(x => ({ kind: x.use === '小太陽卡' ? 'sun' : 'rain', to: x.target, by: x.who, exp: x.note }));
      r.fireworks = store.get(K.spend, []).filter(x => x.use === '煙火' && x.t > Date.now() - 3 * 86400e3).map(x => ({ id: x.id, by: x.who, to: x.target, time: x.time }));
    }
    return r;
  };
})();
