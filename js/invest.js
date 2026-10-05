'use strict';
/* 📈 投資競賽：每月一季、每人 1,000 枚投資幣，連動真實台股收盤價（2330、0050、0056、反一、正二）。
   前十名、穩健獎、參與獎換商店點數；月底在教室後方公告前十名，前三名座位放鞭炮。
   計算規則在 js/invest-engine.js（和 Apps Script 同一份）。 */
(() => {
  const A = window.App, E = window.InvestEngine;
  const { $, esc, toast, store } = A;
  let S = null, loading = null, loadedAt = 0;
  const ui = Object.assign({ view: 'me' }, store.get('indoor.investui.v1', {}));
  const saveUi = () => store.set('indoor.investui.v1', ui);
  const STOCK = Object.fromEntries(E.STOCKS.map(s => [s.code, s]));
  const KIND = { '0056': ['高股息 ETF', 'k-etf'], '00632R': ['反向 ETF', 'k-inv'], '00631L': ['槓桿 ETF', 'k-lev'] };
  const kindOf = s => (s.type === 'stock' ? ['個股', 'k-stock'] : KIND[s.code] || ['ETF', 'k-etf']);
  const GROUPS = [...new Set(E.STOCKS.map(s => s.group))];
  ui.groups ||= { ETF: true, 半導體: true };
  const WD = '日一二三四五六';

  // ── 顯示格式（台灣習慣：紅漲綠跌）──
  const pct = x => `${x > 0 ? '+' : ''}${(x * 100).toFixed(2)}%`;
  const updn = x => (x > 1e-9 ? 'up' : x < -1e-9 ? 'down' : 'flat');
  const coin = x => Number(x || 0).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const unit = x => Number(x || 0).toLocaleString('zh-TW', { maximumFractionDigits: 4 });
  const md = d => { const dt = E.parse(d); return `${dt.getMonth() + 1}/${dt.getDate()}（${WD[dt.getDay()]}）`; };
  const month = s => Number(String(s).slice(5, 7));
  const codeOf = k => A.parseKey(k).code || k;
  function spark(vals, w = 120, h = 34) {
    if (vals.length < 2) return '';
    const lo = Math.min(...vals), hi = Math.max(...vals), rg = hi - lo || 1;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - 3 - (v - lo) / rg * (h - 6)).toFixed(1)}`).join(' ');
    const cls = updn(vals[vals.length - 1] - vals[0]);
    return `<svg class="spark ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  }

  async function load(quiet) {
    return loading ||= (async () => {
      try { S = await A.api('investState'); loadedAt = Date.now(); } catch (e) { if (!quiet) toast('投資資料讀取失敗：' + e.message); }
      loading = null;
      if (A.currentTab() === 'invest') render();
      if (A.currentTab() === 'seats') paintBoard();
      return S;
    })();
  }

  // ── 分頁 ──
  function render() {
    const root = $('#investRoot');
    if (!root) return;
    if (!S) { root.innerHTML = `<div class="panel"><p class="muted">📈 讀取投資資料中…</p></div>`; return; }
    const tab = (v, t) => `<button type="button" data-iv="view" data-v="${v}" aria-pressed="${ui.view === v}">${t}</button>`;
    let h = `<div class="inv-nav">${tab('me', '💼 我的投資')}${tab('rank', '🏆 排行榜')}${tab('learn', '📖 投資教學')}${tab('rules', '📜 規則')}</div>`;
    h += ui.view === 'rank' ? rankHtml() : ui.view === 'learn' ? learnHtml() : ui.view === 'rules' ? rulesHtml() : meHtml();
    root.innerHTML = h;
  }

  function timingText() {
    const t = S.next === S.today ? '今天' : md(S.next);
    return `現在下單 → 以<b>${t}</b>的收盤價成交（每天 13:30 收盤）`;
  }
  function meHtml() {
    const M = S.me, R = S.rules;
    const mine = S.standings.find(x => x.me);
    let h = `<div class="banner ok"><div class="bn-main">📈 ${month(S.season)} 月投資競賽（投資組合不歸零）</div>
      <div class="bn-sub">${timingText()}</div></div>`;
    if (S.teacher) h += `<p class="muted small inv-tnote">導師和同學一樣從 ${coin(R.START)} 枚開始、一起排名，但不領獎，也不佔同學的得獎名額。</p>`;
    // 總覽
    h += `<div class="panel inv-sum">
      <div class="inv-total"><span class="muted small">總值（現金＋股票）</span><b>${coin(M.value)}</b>
        <span class="inv-rets"><span>本季 <b class="${updn(M.ret)}">${pct(M.ret)}</b></span><span>累計 <b class="${updn(M.total)}">${pct(M.total)}</b></span></span></div>
      ${spark([R.START, ...M.snaps.map(s => s.v)], 140, 44)}
      <div class="inv-facts">
        <span>💰 可用現金 <b>${coin(M.avail)}</b></span>
        <span>✍️ 投資日記 <b>${M.diary}</b> 筆${M.eligible ? ' ✅' : ''}</span>
        <span>🏆 名次 <b>${mine?.rank ? `第 ${mine.rank} 名` : '—'}</b></span>
      </div>
      ${M.eligible ? '' : `<p class="muted small">完成第一筆交易（要寫理由）就會加入排行、有領獎資格。</p>`}
      <p class="muted small">本季報酬率：從 ${month(S.season)} 月初的 ${coin(M.start)} 算起；累計報酬率：從一開始的 ${coin(R.START)} 算起。</p>
    </div>`;
    // 股票
    // 依產業分組，可以收合（有持股的組別自動打開）
    h += `<div class="inv-gtools"><button type="button" class="link-btn" data-iv="gall" data-v="1">全部展開</button>｜<button type="button" class="link-btn" data-iv="gall" data-v="0">全部收合</button></div>`;
    h += GROUPS.map(g => {
      const list = S.stocks.filter(s => s.group === g), held = list.filter(s => M.holdings.some(x => x.code === s.code));
      const open = ui.groups[g] ?? held.length > 0;
      const best = list.map(s => (s.prev ? s.close / s.prev - 1 : 0));
      return `<details class="inv-group" data-g="${esc(g)}"${open ? ' open' : ''}><summary><b>${esc(g)}</b>
        <span class="muted small">${list.map(s => esc(s.short)).join('・')}</span>
        ${held.length ? `<span class="tag">持有 ${held.length} 檔</span>` : ''}<span class="ig-chg ${updn(best.reduce((a, b) => a + b, 0))}">${pct(best.reduce((a, b) => a + b, 0) / (best.length || 1))}</span></summary>
        <div class="inv-stocks">${list.map(stockCard).join('')}</div></details>`;
    }).join('');
    // 還沒成交
    const pend = S.trades.filter(t => t.status === '待成交');
    if (pend.length) h += `<div class="panel"><h3>⏳ 等待成交</h3>${pend.map(t => `<div class="inv-trade">
      <div><b class="${t.side === '買' ? 'up' : 'down'}">${t.side}</b> ${esc(STOCK[t.code]?.short || t.code)}　${t.side === '買' ? `${coin(t.amount)} 枚` : `${unit(t.units)} 單位`}
      <div class="muted small">${esc(t.time)} 下單・「${esc(t.reason)}」</div></div>
      <button type="button" class="btn" data-iv="cancel" data-id="${esc(t.id)}">取消</button></div>`).join('')}</div>`;
    // 投資日記
    const done = S.trades.filter(t => t.status !== '待成交');
    h += `<div class="panel"><h3>✍️ 我的投資日記</h3>${done.length ? done.map(t => `<div class="inv-trade">
      <div><b class="${t.side === '買' ? 'up' : 'down'}">${t.side}</b> ${esc(STOCK[t.code]?.short || t.code)}
        ${t.fill ? `　${unit(t.fill.units)} 單位 × ${coin(t.fill.price)}（${md(t.fill.d)}）${t.side === '賣' && t.fill.profit != null ? `・損益 <span class="${updn(t.fill.profit)}">${t.fill.profit > 0 ? '+' : ''}${coin(t.fill.profit)}</span>` : ''}` : `　<span class="muted">${esc(t.status)}</span>`}
        <div class="muted small">「${esc(t.reason)}」</div></div></div>`).join('') : '<p class="muted small">還沒有成交的交易。買進或賣出時寫下的理由，會記在這裡。</p>'}
      ${M.divs.length ? `<h3>💵 領到的股利</h3>${M.divs.map(d => `<p class="small">${md(d.d)} ${esc(STOCK[d.code]?.short || d.code)}：${unit(d.units)} 單位 × ${d.per} 元＝<b>${coin(d.amount)}</b> 枚</p>`).join('')}` : ''}
    </div>`;
    return h;
  }
  function stockCard(s) {
    const M = S.me, hd = M.holdings.find(x => x.code === s.code), k = kindOf(s);
    const chg = s.prev ? s.close / s.prev - 1 : 0;
    const can = M.sellable[s.code] || 0;
    return `<div class="panel inv-stock">
      <div class="is-head"><div><b>${esc(s.short)}</b> <span class="muted small">${s.short === s.code ? '' : esc(s.code) + ' '}${esc(s.name)}</span> <span class="inv-kind ${k[1]}">${k[0]}</span></div>
        <div class="is-price"><b>${s.close ? coin(s.close) : '—'}</b><span class="${updn(chg)}">${s.prev ? pct(chg) : ''}</span></div></div>
      <div class="is-mid">${spark(s.hist.map(x => x[1]))}<span class="muted small">${s.date ? md(s.date) + ' 收盤' : '還沒有股價'}${s.divs.length ? `<br>最近除息：${md(s.divs[s.divs.length - 1][0])} 配 ${s.divs[s.divs.length - 1][1]} 元` : ''}</span></div>
      ${hd ? `<div class="is-hold">持有 <b>${unit(hd.units)}</b> 單位・市值 <b>${coin(hd.value)}</b>・<span class="${updn(hd.value - hd.cost)}">${hd.cost ? pct(hd.value / hd.cost - 1) : ''}</span><br><span class="muted small">可以賣：${unit(can)} 單位（買進滿 ${S.rules.HOLD} 個交易日）</span></div>` : ''}
      <div class="is-btns"><button type="button" class="btn btn--primary" data-iv="buy" data-code="${esc(s.code)}"${s.close && M.avail >= 1 ? '' : ' disabled'}>買進</button>
        <button type="button" class="btn" data-iv="sell" data-code="${esc(s.code)}"${can > 0 ? '' : ' disabled'}>賣出</button>
        <a class="btn is-chart" href="${chartUrl(s.code)}" target="_blank" rel="noopener" title="在 Yahoo 奇摩股市看日、週、月 K 線">📈 走勢圖</a></div>
    </div>`;
  }
  // 外部走勢圖：Yahoo 奇摩股市「技術分析」（可以切換日、週、月 K 線；29 檔都是上市股票，代號加 .TW）
  const chartUrl = code => `https://tw.stock.yahoo.com/quote/${encodeURIComponent(code)}.TW/technical-analysis`;

  // 排行榜上的名字：點了看投資組合
  const nameOf = x => (x.name && x.name !== x.code ? A.parseKey(x.name).name || x.name : '');
  const whoBtn = x => { const n = nameOf(x), t = `${esc(x.code)}${n ? ` <span class="muted small">${esc(n)}</span>` : ''}`;
    return x.pf ? `<button type="button" class="ir-pf" data-iv="pf" data-c="${esc(x.code)}" title="看投資組合">${t}</button>` : t; };
  function openPf(code) {
    const x = (S.standings || []).find(y => y.code === code && y.pf) || (S.total || []).find(y => y.code === code && y.pf);
    if (!x) return;
    const P = x.pf, tot = P.cash + P.hold.reduce((t, h) => t + h.v, 0) || 1, n = nameOf(x) || (A.students().find(k => codeOf(k) === code) && A.parseKey(A.students().find(k => codeOf(k) === code)).name) || '';
    const rows = P.hold.slice().sort((a, b) => b.v - a.v).map(h => { const s = STOCK[h.c] || { short: h.c, name: '' }, k = kindOf(s), w = h.v / tot;
      return `<div class="pf-row"><div class="pf-top"><b>${esc(s.short)}</b> <span class="inv-kind ${k[1]}">${k[0]}</span><span class="pf-w">${(w * 100).toFixed(1)}%</span></div>
        <div class="pf-bar"><i style="width:${(w * 100).toFixed(1)}%"></i></div>
        <div class="muted small">${unit(h.u)} 單位・市值 ${coin(h.v)} 枚${h.k ? `・<span class="${updn(h.v - h.k)}">${pct(h.v / h.k - 1)}</span>` : ''}</div></div>`; }).join('');
    A.openSheet({ kind: 'invpf' }, `<h3>💼 ${esc(code)}${n ? ' ' + esc(n) : ''} 的投資組合</h3>
      <p class="pf-sum">總值 <b>${coin(tot)}</b> 枚${x.ret != null ? `・本季 <span class="${updn(x.ret)}">${pct(x.ret)}</span>` : ''}${x.total != null ? `・累計 <span class="${updn(x.total)}">${pct(x.total)}</span>` : ''}</p>
      ${rows || '<p class="muted small">目前沒有持股，全部都是現金。</p>'}
      <div class="pf-row"><div class="pf-top"><b>💵 現金</b><span class="pf-w">${(P.cash / tot * 100).toFixed(1)}%</span></div><div class="pf-bar cash"><i style="width:${Math.max(0, P.cash / tot * 100).toFixed(1)}%"></i></div><div class="muted small">${coin(P.cash)} 枚</div></div>
      <p class="muted small">以最近一次收盤價計算。看看別人怎麼分配，想想自己為什麼這樣配。</p>
      <button type="button" class="btn wide" data-act="close">關閉</button>`);
  }
  function rankHtml() {
    const L = S.standings, R = S.rules;
    const el = L.filter(x => x.eligible), no = L.filter(x => !x.eligible);
    const row = x => `<div class="inv-row${x.me ? ' me' : ''}">
      <span class="ir-rank">${x.rank ? (x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank) : ''}</span>
      <span class="ir-who">${whoBtn(x)}${x.me ? ' <span class="tag">我</span>' : ''}${x.teacher ? ' <span class="muted small">（不領獎）</span>' : ''}${x.prize || x.steady || !x.eligible ? `<span class="ir-tag">${x.prize ? `🏆+${x.prize}` : ''}${x.steady ? ' 🐢穩健' : ''}${x.eligible ? '' : '尚未交易'}</span>` : ''}</span>
      <span class="ir-ret ${updn(x.ret)}">${pct(x.ret)}</span>
      <span class="ir-val">${coin(x.value)}</span></div>`;
    const seg = (v, t) => `<button type="button" data-iv="rk" data-v="${v}" aria-pressed="${(ui.rk || 'season') === v}">${t}</button>`;
    let h = `<div class="inv-nav inv-rk">${seg('season', `🏆 ${month(S.season)} 月（本季）`)}${seg('total', '📈 累計（長期）')}</div>`;
    if (ui.rk === 'total') {
      return h + `<div class="panel"><h3>📈 累計報酬率排行 <span class="muted small">（從一開始到現在，不發獎，看長期表現）</span></h3>
        <div class="inv-row head"><span class="ir-rank">#</span><span class="ir-who">座號</span><span class="ir-ret">累計</span><span class="ir-val">投資幣</span></div>
        ${(S.total || []).map((x, i) => `<div class="inv-row${x.me ? ' me' : ''}"><span class="ir-rank">${i + 1}</span>
          <span class="ir-who">${whoBtn(x)}${x.me ? ' <span class="tag">我</span>' : ''}</span>
          <span class="ir-ret ${updn(x.total)}">${pct(x.total)}</span><span class="ir-val">${coin(x.value)}</span></div>`).join('') || '<p class="muted small">還沒有人開始投資。</p>'}
        <p class="muted small">長期來看，穩定成長、少犯大錯的人通常會慢慢爬上來。</p></div>`;
    }
    h += `<div class="panel"><h3>🏆 ${month(S.season)} 月排行榜 <span class="muted small">${S.final ? '（已結算）' : '（每天收盤後更新）'}</span></h3>
      <div class="inv-row head"><span class="ir-rank">名次</span><span class="ir-who">座號</span><span class="ir-ret">報酬率</span><span class="ir-val">投資幣</span></div>
      ${el.length ? el.map(row).join('') : '<p class="muted small">還沒有人有交易紀錄。</p>'}
      ${no.length ? `<h3 class="inv-sub">還沒有交易紀錄</h3>${no.map(row).join('')}` : ''}
      <p class="muted small">名次看「這一季」的報酬率（月初總值 → 月底總值），報酬率一樣的並列。🐢 穩健獎：報酬率是正的、平均至少一半的錢放在股票裡，每天漲跌起伏最小的人。</p></div>`;
    if (S.past?.length) h += `<div class="panel"><h3>📚 歷屆結果</h3>${S.past.map(p => `<details class="inv-past"><summary>${esc(p.season)}（${month(p.season)} 月）${p.mine ? `・我：${pct(p.mine.ret)}${p.mine.points ? `，得到 ${p.mine.points} 點` : ''}` : ''}</summary>
      ${boardList(p)}</details>`).join('')}</div>`;
    return h;
  }
  // 座號 → 「座號 名字」（名單裡找得到才加名字）
  const withName = code => { const k = A.students().find(y => codeOf(y) === code), n = k && A.parseKey(k).name; return n ? `${esc(code)} <span class="ib-nm">${esc(n)}</span>` : esc(code); };
  function boardList(b) {
    return `<ol class="inv-board-list">${b.top.map(x => `<li><span class="ib-r">${x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank}</span><b>${withName(x.code)}</b><span class="${updn(x.ret)}">${pct(x.ret)}</span></li>`).join('') || '<li class="muted">沒有人得獎</li>'}</ol>
      ${b.steady ? `<p class="ib-steady">🐢 穩健獎：<b>${withName(b.steady.code)}</b> <span class="${updn(b.steady.ret)}">${pct(b.steady.ret)}</span></p>` : ''}`;
  }

  function rulesHtml() {
    const R = S.rules, P = R.PRIZE;
    return `<div class="panel inv-text"><h3>📜 競賽規則</h3><ol>
      <li><b>投資幣不歸零</b>：第一次參加時拿到 <b>${coin(R.START)}</b> 枚投資幣，之後一直延續下去（股票可以長期持有，學習長期投資）。</li>
      <li><b>每個月是一季</b>：每季的名次看「這一季的報酬率」＝月底總值 ÷ 月初總值 − 1。所以就算之前賠了，每一季都有機會拿獎。另外有「累計報酬率」排行看長期表現。</li>
      <li><b>投資標的</b>：${E.STOCKS.length} 檔，依產業分組——${GROUPS.map(g => `${esc(g)}（${E.STOCKS.filter(s => s.group === g).map(s => esc(s.short)).join('、')}）`).join('；')}。股價就是台灣股市真實的收盤價。</li>
      <li><b>成交價</b>：下單後以「收盤價」成交。13:30 以前下單＝當天收盤價；13:30 以後或假日下單＝下一個交易日的收盤價。成交前都可以取消。</li>
      <li><b>零碎單位</b>：可以只買一點點（例如 0.25 單位的台積電），投入多少投資幣就買多少。</li>
      <li><b>手續費</b>：買、賣都收 ${(R.FEE * 100).toFixed(4)}%；<b>賣出</b>另收交易稅：股票 ${R.TAX_STOCK * 100}%、ETF ${R.TAX_ETF * 100}%。</li>
      <li><b>至少持有 ${R.HOLD} 個交易日</b>才能賣（先買的先賣）。</li>
      <li><b>股利</b>：持有的股票除息時，現金股利會自動發到你的現金。</li>
      <li><b>投資日記</b>：每次買賣都要寫理由。只要有<b>成交紀錄</b>（1 筆就可以），就加入排行、有領獎資格（之後一直有效，長期持有不用一直買賣）。導師也在排行榜上，但不參加頒獎。</li>
      <li><b>報酬率一樣就並列</b>。</li>
      <li><b>導師也一起比賽</b>：和大家一樣從 ${coin(R.START)} 枚開始、一起排名，但不領獎，也不佔同學的得獎名額（例如導師第 1 名，同學的第 2 名一樣拿第 1 名的 ${P[0]} 點）。</li>
    </ol>
    <h3>🎁 商店點數獎勵（每季，依同學之間的名次）</h3>
    <table class="inv-prize"><tr><th>第 1 名</th><td>${P[0]} 點</td></tr><tr><th>第 2～3 名</th><td>${P[1]} 點</td></tr><tr><th>第 4～10 名</th><td>${P[3]} 點</td></tr>
      <tr><th>🐢 穩健獎（1 名）</th><td>${R.STEADY} 點</td></tr><tr><th>參與獎（有資格的人）</th><td>${R.JOIN} 點</td></tr></table>
    <p class="muted small">穩健獎：有資格、這一季報酬率是正的、平均至少 ${R.MIN_INV * 100}% 的錢放在股票裡，每天總值漲跌起伏（波動度）最小的人。<br>
    月底最後一個上課日，教室後方會出現 📊 公告，顯示前十名和穩健獎；結算後，前三名的座位會放一次鞭炮 🧨。</p>
    <p class="muted small">⚠️ 這個競賽只用虛擬的投資幣練習，不是真的買賣股票，也不是投資建議。</p></div>`;
  }

  function learnHtml() {
    const sec = (t, body, open) => `<details class="inv-learn"${open ? ' open' : ''}><summary>${t}</summary><div class="inv-text">${body}</div></details>`;
    return `<div class="panel"><h3>📖 投資教學</h3>
    ${sec('1. 股票是什麼？', `<p>買一家公司的<b>股票</b>，就是變成這家公司的一小部分老闆（股東）。公司賺錢、大家看好它，股價通常會漲；公司表現不好，股價就會跌。</p>
      <p>例如 <b>2330 台積電</b>：全世界最大的晶圓代工廠，幫蘋果、輝達等公司做晶片。只買一家公司叫做「個股」，漲跌可能比較大。</p>`, true)}
    ${sec('2. ETF 是什麼？0050 和 0056 有什麼不同？', `<p><b>ETF</b> 像一個「股票組合包」，一次幫你買很多家公司。</p>
      <ul><li><b>0050 元大台灣50</b>：一次買台灣市值最大的 50 家公司，跟著台灣整體股市（大盤）漲跌。</li>
      <li><b>0056 元大高股息</b>：挑選預期會發比較多現金股利的公司，股價通常比較穩，但也會隨大盤漲跌。</li></ul>
      <p>買很多家公司＝<b>分散風險</b>：就算其中一家出問題，影響也比較小。</p>`)}
    ${sec('3. 反一、正二是什麼？（要特別小心！）', `<ul><li><b>00632R 反一</b>：台灣50「每天」跌 1%，它大約漲 1%；大盤漲它就跌。用來「看跌」或避險。</li>
      <li><b>00631L 正二</b>：台灣50「每天」漲 1%，它大約漲 2%；跌的時候也是 2 倍。</li></ul>
      <p>它們是「<b>每天</b>」追蹤，所以長期抱著會有<b>耗損</b>。例子：大盤第一天 +10%、第二天 −10%：</p>
      <table class="inv-prize"><tr><th></th><th>第 0 天</th><th>第 1 天</th><th>第 2 天</th></tr>
        <tr><th>大盤</th><td>100</td><td>110</td><td>99（−1%）</td></tr>
        <tr><th>正二</th><td>100</td><td>120</td><td>96（−4%）</td></tr>
        <tr><th>反一</th><td>100</td><td>90</td><td>99（−1%）</td></tr></table>
      <p>大盤只跌 1%，正二卻跌了 4%！漲跌來回越多次，耗損越大。</p>`)}
    ${sec('4. 報酬率怎麼算？紅漲綠跌', `<p><b>報酬率</b>＝（現在的總值 − 本金）÷ 本金。例如 1,000 變成 1,050，報酬率＝ +5%。</p>
      <p>台灣股市的習慣是<b class="up">紅色＝漲</b>、<b class="down">綠色＝跌</b>（和美國相反）。</p>`)}
    ${sec('5. 手續費和交易稅', `<p>真實買賣股票要付給券商<b>手續費 0.1425%</b>，賣出時還要付政府<b>證券交易稅</b>（股票 0.3%、ETF 0.1%）。</p>
      <p>例子：用 1,000 元買台積電，手續費約 1.43 元；之後用 1,100 元賣出，手續費約 1.57 元、交易稅 3.3 元。<br>
      所以<b>買賣越頻繁，被扣的費用越多</b>，這也是為什麼「短線進進出出」不一定划算。</p>`)}
    ${sec('6. 股利和除息', `<p>公司賺錢後會把一部分利潤發給股東，叫做<b>現金股利</b>。發股利的那天叫做<b>除息日</b>：股價會先扣掉股利的金額，但你會拿到同樣多的現金，所以總值不會因此變少。</p>
      <p>例如 0056 配 1 元：股價 56 → 55，但每一單位你會領到 1 元。在這個競賽裡，股利會自動發到你的現金。</p>`)}
    ${sec('7. 風險和報酬、分散投資', `<p>想要比較高的報酬，通常要承擔比較大的漲跌（風險）。正二可能賺很多，也可能賠很多；0056 比較平穩，但通常漲得比較慢。</p>
      <p><b>波動度</b>：每天總值上上下下的程度。穩健獎就是看誰「賺錢又穩」。</p>
      <p>把錢分散在不同的標的，可以讓總值不會因為一檔大跌就大受影響。</p>`)}
    ${sec('8. 長期投資與複利', `<p>這個競賽的投資幣<b>不會歸零</b>，就是要練習長期投資。</p>
      <p><b>複利</b>：賺到的錢繼續投資，會「利上滾利」。例如每年賺 7%：1,000 → 10 年後約 1,967 → 20 年後約 3,870。時間越長，效果越明顯。</p>
      <p>長期投資的重點：選自己看得懂的公司或 ETF、分散投資、不要因為短期漲跌就慌張買賣。股利也可以再投入，讓錢繼續滾。</p>`)}
    ${sec('9. 新手常犯的錯', `<ul><li><b>追高殺低</b>：看到大漲才衝進去、一跌就害怕賣掉。</li>
      <li><b>全部押在一檔</b>：押對了很開心，押錯了就一次賠很多。</li>
      <li><b>聽消息就買</b>：先想清楚「為什麼買」，這就是投資日記的目的。</li>
      <li><b>頻繁交易</b>：手續費和稅會慢慢吃掉獲利。</li></ul>`)}
    ${sec('10. 真實世界', `<p>在台灣，滿 18 歲才可以自己開證券帳戶；未滿 18 歲需要父母（法定代理人）同意。<br>
      投資一定有風險，可能賺也可能賠。先用這個競賽練習「做功課、寫理由、控制風險」的好習慣吧！</p>
      <p class="muted small">⚠️ 這裡的內容是一般觀念教學，不是投資建議。</p>`)}
    </div>`;
  }

  // ── 下單 ──
  let ord = null;
  function openOrder(side, code) {
    const s = S.stocks.find(x => x.code === code);
    if (!s) return;
    ord = { side, code };
    const M = S.me, can = M.sellable[code] || 0;
    let h = A.sheetHead(`${side === '買' ? '📈 買進' : '📉 賣出'} ${s.short}（${s.code}）`, `最近收盤價 ${coin(s.close)}（${s.date ? md(s.date) : ''}）`);
    h += `<p class="small">${timingText()}；成交價可能和現在的價格不一樣。</p>`;
    if (side === '買') {
      h += `<label class="field"><span>投入多少投資幣？（可用 ${coin(M.avail)} 枚）</span><input type="number" id="invAmt" min="1" max="${M.avail}" step="1" inputmode="decimal" placeholder="例如 300"></label>
        <div class="inv-quick">${[0.25, 0.5, 1].map(k => `<button type="button" class="btn" data-act="q" data-k="${k}" aria-pressed="false">${k === 1 ? '全部' : k * 100 + '%'}</button>`).join('')}</div>`;
    } else {
      h += `<label class="field"><span>賣出幾單位？（可以賣 ${unit(can)} 單位）</span><input type="number" id="invAmt" min="0" max="${can}" step="any" inputmode="decimal" placeholder="單位"></label>
        <div class="inv-quick">${[0.5, 1].map(k => `<button type="button" class="btn" data-act="q" data-k="${k}" aria-pressed="false">${k === 1 ? '全部可賣' : '一半'}</button>`).join('')}</div>`;
    }
    h += `<p id="invEst" class="muted small"></p>
      <label class="field"><span>✍️ 為什麼要${side === '買' ? '買' : '賣'}？（投資日記，一定要寫）</span>
      <textarea id="invWhy" rows="2" maxlength="200" placeholder="${side === '買' ? '例如：覺得 AI 需求會讓台積電繼續成長／0056 快要除息，想領股利' : '例如：已經賺了 5%，先把獲利收進口袋／覺得大盤要回檔'}"></textarea></label>
      <div class="actions"><button type="button" class="btn btn--primary wide" data-act="ok">送出${side === '買' ? '買進' : '賣出'}委託</button></div>`;
    A.openSheet({ kind: 'invest' }, h);
    estimate();
  }
  function estimate() {
    const el = $('#invEst');
    if (!el || !ord) return;
    const s = S.stocks.find(x => x.code === ord.code), v = Number($('#invAmt').value) || 0, R = S.rules;
    if (!v) { el.textContent = ''; return; }
    if (ord.side === '買') {
      const fee = v * R.FEE;
      el.textContent = `預估：手續費 ${coin(fee)} 枚，約可買 ${unit((v - fee) / s.close)} 單位（照最近收盤價估算）`;
    } else {
      const g = v * s.close, fee = g * R.FEE, tax = g * (STOCK[ord.code].type === 'stock' ? R.TAX_STOCK : R.TAX_ETF);
      el.textContent = `預估：賣得 ${coin(g)}，扣手續費 ${coin(fee)}、交易稅 ${coin(tax)}，約拿回 ${coin(g - fee - tax)} 枚`;
    }
  }
  A.sheetBody.addEventListener('input', e => {
    if (e.target.id !== 'invAmt' || A.sheetMode()?.kind !== 'invest') return;
    A.sheetBody.querySelectorAll('.inv-quick [aria-pressed]').forEach(x => x.setAttribute('aria-pressed', 'false')); // 自己輸入數字就取消比例
    estimate();
  });
  A.sheetHandlers.invest = async (act, b) => {
    if (!ord) return;
    const M = S.me;
    if (act === 'q') {
      const k = Number(b.dataset.k);
      $('#invAmt').value = ord.side === '買' ? Math.floor(M.avail * k) : Math.floor((M.sellable[ord.code] || 0) * k * 1e4) / 1e4;
      // 按下去的比例按鈕要看得出來
      b.parentElement.querySelectorAll('[data-act="q"]').forEach(x => x.setAttribute('aria-pressed', x === b));
      estimate();
      return;
    }
    if (act !== 'ok') return;
    const v = Number($('#invAmt').value), why = $('#invWhy').value.trim();
    if (!(v > 0)) return toast(ord.side === '買' ? '請輸入要投入多少投資幣' : '請輸入要賣幾單位');
    if (why.length < 4) return toast('請寫下理由（至少 4 個字），這是你的投資日記');
    b.disabled = true; b.textContent = '送出中…';
    try {
      S = await A.api('investOrder', { order: { side: ord.side, code: ord.code, amount: ord.side === '買' ? v : '', units: ord.side === '賣' ? v : '', reason: why } });
      loadedAt = Date.now();
      A.closeSheet();
      toast(`✓ 已送出委託，將在${S.next === S.today ? '今天' : md(S.next)}收盤後成交`);
      render();
    } catch (err) { toast(err.message); b.disabled = false; b.textContent = '再試一次'; }
  };

  $('#investRoot').addEventListener('click', async e => {
    const b = e.target.closest('[data-iv]');
    if (!b || b.disabled) return;
    const act = b.dataset.iv;
    if (act === 'view') { ui.view = b.dataset.v; saveUi(); render(); window.scrollTo({ top: 0 }); return; }
    if (act === 'pf') return openPf(b.dataset.c);
    if (act === 'rk') { ui.rk = b.dataset.v; saveUi(); render(); return; }
    if (act === 'gall') { GROUPS.forEach(g => { ui.groups[g] = b.dataset.v === '1'; }); saveUi(); render(); return; }
    if (act === 'buy') return openOrder('買', b.dataset.code);
    if (act === 'sell') return openOrder('賣', b.dataset.code);
    if (act === 'cancel') {
      if (!await A.ask('取消這筆委託？', '取消委託')) return;
      b.disabled = true;
      try { S = await A.api('investCancel', { id: b.dataset.id }); toast('已取消'); } catch (err) { toast(err.message); }
      render();
    }
  });

  // 記住哪些產業是打開的
  $('#investRoot').addEventListener('toggle', e => {
    const d = e.target.closest?.('details.inv-group');
    if (!d) return;
    ui.groups[d.dataset.g] = d.open; saveUi();
  }, true);
  A.addPrefetch('invest', () => load(true));
  A.tabHooks.invest = () => {
    render();
    if (!S || Date.now() - loadedAt > 60e3) load();
  };

  // ── 教室後方的 📊 公告：月底最後一個平日～下個月 7 號 ──
  const boardWindow = () => {
    if (A.TEST) return true;
    const today = A.fmtDate(new Date()), cur = today.slice(0, 7);
    return today >= E.lastWeekday(cur) || Number(today.slice(8)) <= 7;
  };
  let boardOpen = false;
  function paintBoard() {
    const wrap = document.querySelector('#tab-seats .map-wrap');
    if (!wrap) return;
    const host = wrap.parentElement;
    let btn = $('#invBoardBtn'), pan = $('#invBoardPanel');
    const B = S?.board;
    if (!B || !B.top) { if (btn) btn.hidden = true; if (pan) pan.hidden = true; return; }
    host.style.position = 'relative';
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button'; btn.id = 'invBoardBtn'; btn.className = 'inv-board-btn';
      btn.addEventListener('click', e => { e.stopPropagation(); boardOpen = !boardOpen; paintBoard(); });
      host.appendChild(btn);
      pan = document.createElement('div');
      pan.id = 'invBoardPanel'; pan.className = 'inv-board';
      pan.addEventListener('click', e => { e.stopPropagation(); if (e.target.closest('[data-ib="close"]')) { boardOpen = false; paintBoard(); } });
      host.appendChild(pan);
    }
    // 位置：教室後方（離黑板最遠的那一邊，最後一排座位的後面）
    const seats = [...wrap.querySelectorAll('[data-seat]')].map(x => x.getBoundingClientRect()).filter(r => r.width);
    const hr = host.getBoundingClientRect(), br = wrap.querySelector('[data-tch]')?.getBoundingClientRect();
    if (seats.length) {
      const top = Math.min(...seats.map(r => r.top)), bot = Math.max(...seats.map(r => r.bottom));
      const left = Math.min(...seats.map(r => r.left)), right = Math.max(...seats.map(r => r.right));
      const boardAbove = br ? br.top + br.height / 2 < (top + bot) / 2 : true;
      const cx = ((left + right) / 2 - hr.left) + 'px';
      // 教室後方在下面（學生視角）：放在最後一排下面的正中間；
      // 在上面（老師視角）：靠左放，才不會壓到右邊的縮放按鈕
      btn.style.left = boardAbove ? cx : (left - hr.left) + 'px';
      btn.style.top = (boardAbove ? bot - hr.top + 6 : top - hr.top - 6) + 'px';
      btn.classList.toggle('above', !boardAbove);
      // 公告打開時貼在按鈕旁邊（往教室裡面展開）
      pan.style.left = cx;
      pan.style.top = btn.style.top;
      pan.classList.toggle('from-top', !boardAbove);
    }
    btn.hidden = false;
    btn.innerHTML = `📊 <span>${month(B.season)} 月投資競賽${B.final ? '結果' : '（暫定）'}</span>`;
    const bk = `${B.season}${B.final ? 'F' : 'P'}`, seenB = store.get('indoor.invboard.first', {});
    if (!seenB[bk]) { seenB[bk] = Date.now(); store.set('indoor.invboard.first', Object.fromEntries(Object.entries(seenB).slice(-6))); }
    btn.classList.toggle('quiet', Date.now() - seenB[bk] > 3 * 864e5 && !boardOpen);
    btn.setAttribute('aria-expanded', boardOpen);
    pan.hidden = !boardOpen;
    if (boardOpen) {
      pan.innerHTML = `<div class="ib-head"><b>📈 ${month(B.season)} 月投資競賽 ${B.final ? '前十名' : '目前前十名（暫定）'}</b><button type="button" class="ww-x" data-ib="close" aria-label="關閉">✕</button></div>
        ${boardList(B)}<p class="muted small">${B.final ? '恭喜得獎的同學！商店點數已經發放。' : '最後一個交易日收盤後結算。'}</p>`;
    }
  }
  const prevSeats = A.tabHooks.seats;
  A.tabHooks.seats = () => {
    prevSeats?.();
    if (A.isGuest() || !boardWindow()) return;
    if (S && Date.now() - loadedAt < 5 * 60e3) setTimeout(paintBoard, 60); else load(true);
  };
  window.addEventListener('resize', () => { if (A.currentTab() === 'seats' && S?.board) paintBoard(); });
  A.on('faces', () => { if (A.currentTab() === 'seats' && S?.board) setTimeout(paintBoard, 80); });
  // 除錯：在前三名座位放鞭炮
  A.investFxTest = () => A.emit('fireworks', (S?.standings || []).filter(x => x.rank && x.rank <= 3 && !x.teacher).map(x => ({
    id: 'invtest-' + Date.now() + x.code, by: '📈 投資競賽', to: x.key || A.students().find(k => codeOf(k) === x.code), label: `🧨 投資競賽第 ${x.rank} 名！`, kind: 'firecracker',
  })));

  // ── 測試模式：假的股價、假的同學交易，都存在這台手機 ──
  const prevTest = A.testSeatApi;
  const TK = 'indoor.invest.v1.test';
  let TP = null;
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hmNow = () => { const d = new Date(); return A.pad2(d.getHours()) + ':' + A.pad2(d.getMinutes()); };
  function testPrices() {
    const today = A.fmtDate(new Date());
    if (TP?.day === today) return TP.P;
    let end = E.isWeekday(today) && hmNow() >= '14:00' ? today : E.addDays(today, -1);
    while (!E.isWeekday(end)) end = E.addDays(end, -1);
    const ds = [end];
    while (ds.length < 70) { let d = E.addDays(ds[0], -1); while (!E.isWeekday(d)) d = E.addDays(d, -1); ds.unshift(d); }
    const r = rng(20260901), P = {}, px = { '2330': 2300, '0050': 105, '0056': 55, '00632R': 10.2, '00631L': 34, '2454': 5000, '2303': 150, '3711': 650, '2317': 240, '2382': 320,
      '3231': 170, '2357': 900, '2308': 1800, '2345': 1800, '2881': 145, '2882': 105, '2891': 66, '2886': 48, '2412': 142, '1216': 73, '2912': 210, '1301': 60, '2002': 19, '2603': 230, '3443': 8000, '2408': 480, '2344': 160, '6515': 5500, '3037': 1100 };
    const hot = { '3443': 2.2, '2408': 2.6, '2344': 2.5, '6515': 2.2, '3037': 2.3 };
    const beta = Object.fromEntries(E.STOCKS.map((s, i) => [s.code, hot[s.code] || 0.4 + ((i * 37) % 11) / 8]));
    E.STOCKS.forEach(s => { P[s.code] = {}; });
    const cur = today.slice(0, 7), divDay = ds.filter(d => d.slice(0, 7) === cur)[2];
    ds.forEach(d => {
      const g = () => (r() + r() + r() - 1.5) * 0.02, m = 0.0006 + g();
      px['0050'] *= 1 + m + g() * 0.1; px['2330'] *= 1 + m * 1.3 + g() * 0.4; px['0056'] *= 1 + m * 0.6 + g() * 0.25;
      px['00631L'] *= 1 + m * 2; px['00632R'] *= 1 - m;
      E.STOCKS.filter(s => s.type === 'stock' && s.code !== '2330').forEach(s => { px[s.code] *= 1 + m * beta[s.code] + g() * 0.5; });
      let div = 0;
      if (d === divDay) { div = 0.8; px['0056'] -= 0.8; }
      E.STOCKS.forEach(s => { P[s.code][d] = { c: Math.round(px[s.code] * 100) / 100, div: s.code === '0056' ? div : 0 }; });
    });
    TP = { day: today, P };
    return P;
  }
  function testTrades(me) {
    const own = store.get(TK, []);
    const P = testPrices(), days = E.tradingDays(P), sd = days.slice(-45);   // 最近兩個月左右（跨季）
    const r = rng(777), out = [];
    const why = ['覺得 AI 會帶動台積電成長', '想領 0056 的股利', '大盤好像要跌，買反一避險', '分散投資，買 0050 比較穩', '最近漲很多，先賣掉一半', '想試試看正二'];
    A.students().filter(k => k !== me).slice(0, 18).forEach((k, i) => {
      const n = 1 + Math.floor(r() * 4);
      for (let j = 0; j < n && sd.length; j++) {
        const d = sd[Math.floor(r() * sd.length)], s = E.STOCKS[Math.floor(r() * E.STOCKS.length)];
        out.push({ id: `f${i}-${j}`, who: k, t: E.parse(d).getTime() + 36e6 + j, ymd: d, hm: '10:00', season: d.slice(0, 7), side: '買', code: s.code, amount: 150 + Math.floor(r() * 250), units: 0, reason: why[Math.floor(r() * why.length)], status: '待成交' });
      }
    });
    return out.concat(own);
  }
  function testState(me) {
    const P = testPrices(), days = E.tradingDays(P), today = A.fmtDate(new Date()), hm = hmNow();
    const next = E.orderDay(today, hm), season = today.slice(0, 7), all = testTrades(me);
    const by = {};
    all.forEach(t => { (by[t.who] ||= []).push(t); });
    const books = Object.fromEntries(Object.keys(by).map(k => [k, E.book(by[k], P, days)]));
    const b = books[me] || E.book([], P, days), ms = E.seasonStats(b, season);
    const T = A.D.teacherLabel || '導師';
    const st = E.standings(Object.keys(books).map(k => ({ key: k, noPrize: k === T, ...E.seasonStats(books[k], season) })).filter(x => x.active));
    const mine = (by[me] || []).slice().sort((x, y) => y.t - x.t).map(t => {
      const f = b.fills[t.id];
      return { id: t.id, time: `${t.ymd.slice(5)} ${t.hm}`, side: t.side, code: t.code, amount: t.amount, units: t.units, reason: t.reason,
        status: t.status === '已取消' ? '已取消' : f ? (f.fail ? '已取消（' + f.fail + '）' : '已成交') : '待成交', fill: f && !f.fail ? f : null };
    });
    const pendSell = {};
    mine.filter(t => t.status === '待成交' && t.side === '賣').forEach(t => { pendSell[t.code] = (pendSell[t.code] || 0) + t.units; });
    const sellable = Object.fromEntries(b.holdings.map(h => [h.code, E.sellable(b, h.code, days, next, pendSell[h.code])]));
    const pf = k => { const bk = books[k]; return bk ? { cash: bk.cash, hold: bk.holdings.map(h => ({ c: h.code, u: h.units, v: h.value, k: h.cost })) } : null; };
    const pub = x => ({ pf: pf(x.key), code: x.key === T ? T : codeOf(x.key), key: x.key, teacher: x.key === T, name: A.isTeacher() ? x.key : '', me: x.key === me, ret: x.ret, total: x.total, value: x.value, rank: x.rank, eligible: x.eligible, diary: x.diary, prize: x.prize, steady: x.steady });
    const stocks = E.STOCKS.map(s => {
      const ds = Object.keys(P[s.code]).sort(), l = ds.length;
      return { ...s, date: ds[l - 1], close: P[s.code][ds[l - 1]].c, prev: P[s.code][ds[l - 2]].c, hist: ds.slice(-40).map(d => [d, P[s.code][d].c]), divs: ds.filter(d => P[s.code][d].div > 0).map(d => [d, P[s.code][d].div]) };
    });
    return {
      ok: true, season, next, today, hm, final: false, rules: E.RULES, stocks, teacher: A.isTeacher(),
      me: { cash: b.cash, avail: b.avail, value: b.value, total: b.total, ret: ms.ret, start: ms.start, diary: b.diary, eligible: b.eligible, holdings: b.holdings, divs: b.divs, snaps: b.snaps.slice(-60), sellable },
      trades: mine, standings: st.list.map(pub),
      total: Object.keys(books).filter(k => books[k].diary > 0).sort((x, y) => books[y].total - books[x].total)
        .map(k => ({ pf: pf(k), code: k === T ? T : codeOf(k), name: A.isTeacher() ? k : '', me: k === me, total: books[k].total, value: books[k].value })),
      board: { season, final: false, top: st.list.filter(x => x.rank && (x.rank <= 10 || x.prize)).map(x => ({ rank: x.rank, code: x.key === T ? T : codeOf(x.key), ret: x.ret, value: x.value })), steady: st.steady ? { code: codeOf(st.steady.key), ret: st.steady.ret } : null },
      past: [], fetched: Date.now(),
    };
  }
  A.testSeatApi = async (action, p = {}) => {
    const me = A.isTeacher() ? A.D.teacherLabel || '導師' : A.me();
    if (action === 'investState') return testState(me);
    if (action === 'investOrder') {
      const o = p.order, st = testState(me), today = A.fmtDate(new Date()), hm = hmNow();
      if (o.side === '買') { if (!(o.amount >= 1)) throw new Error('至少要投入 1 枚投資幣'); if (o.amount > st.me.avail) throw new Error(`投資幣不夠（現在可用 ${st.me.avail} 枚）`); }
      else if (!(o.units > 0) || o.units > (st.me.sellable[o.code] || 0) + 1e-6) throw new Error('這檔還沒有滿 3 個交易日的持股，或超過可以賣的單位');
      store.set(TK, [...store.get(TK, []), { id: 't' + Date.now(), who: me, t: Date.now(), ymd: today, hm, season: E.seasonOf(E.orderDay(today, hm)), side: o.side, code: o.code, amount: Number(o.amount) || 0, units: Number(o.units) || 0, reason: o.reason, status: '待成交' }]);
      return testState(me);
    }
    if (action === 'investCancel') {
      store.set(TK, store.get(TK, []).map(t => (t.id === p.id ? { ...t, status: '已取消' } : t)));
      return testState(me);
    }
    return prevTest ? prevTest(action, p) : null;
  };
})();
