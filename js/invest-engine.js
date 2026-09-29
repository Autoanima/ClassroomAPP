/* ── 投資競賽引擎 ───────────────────────────────────────────────
 * 這一段和 gas/Code.gs 最下方的 InvestEngine 是同一份程式，修改時兩邊要一起改。
 * （網頁的測試模式在手機上模擬；正式的由 Google Apps Script 計算）
 *
 * 規則：
 *   1. 第一次參加時拿到 1,000 枚投資幣；之後「不歸零」，投資組合一直延續（學習長期投資）。
 *   2. 每個月是一季：每季的名次看「這一季的報酬率」＝季末總值 ÷ 季初總值 − 1。另外有「累計報酬率」排行。
 *   3. 下單後以「當天收盤價」成交（13:30 以後下單＝下一個交易日的收盤價）。可以買零碎的單位。
 *   4. 買進、賣出都收手續費 0.1425%；賣出另收交易稅（股票 0.3%、ETF 0.1%）。
 *   5. 買進後至少要持有 3 個交易日才能賣（先買的先賣）。
 *   6. 持有的股票除息時，現金股利會自動發到現金。
 *   7. 只要有成交紀錄（至少 1 筆，每筆都寫了理由＝投資日記）就加入排行、有領獎資格；報酬率一樣就並列。
 *   8. 穩健獎：有資格、這一季報酬率是正的、平均至少一半的錢放在股票裡，每天漲跌起伏（波動度）最小的人。
 *   9. noPrize（導師）：一起排名，但不領獎、不佔同學的得獎名額、不參加穩健獎。
 * 日期一律用 'yyyy/MM/dd' 字串；季＝'yyyy/MM'。
 */
var InvestEngine = (function () {
  var RULES = {
    START: 1000, FEE: 0.001425, TAX_STOCK: 0.003, TAX_ETF: 0.001, HOLD: 3, DIARY: 1,
    PRIZE: [15, 10, 10, 5, 5, 5, 5, 5, 5, 5], STEADY: 5, JOIN: 1, MIN_INV: 0.5, CLOSE: '13:30',
  };
  // group：畫面上依產業分組（可以收合）
  var STOCKS = [
    { code: '0050', name: '元大台灣50', type: 'etf', short: '0050', group: 'ETF' },
    { code: '0056', name: '元大高股息', type: 'etf', short: '高股息', group: 'ETF' },
    { code: '00632R', name: '元大台灣50反1', type: 'etf', short: '反一', group: 'ETF' },
    { code: '00631L', name: '元大台灣50正2', type: 'etf', short: '正二', group: 'ETF' },
    { code: '2330', name: '台積電', type: 'stock', short: '台積電', group: '半導體' },
    { code: '2454', name: '聯發科', type: 'stock', short: '聯發科', group: '半導體' },
    { code: '2303', name: '聯電', type: 'stock', short: '聯電', group: '半導體' },
    { code: '3711', name: '日月光投控', type: 'stock', short: '日月光', group: '半導體' },
    { code: '3443', name: '創意', type: 'stock', short: '創意', group: '半導體' },
    { code: '2408', name: '南亞科', type: 'stock', short: '南亞科', group: '半導體' },
    { code: '2344', name: '華邦電', type: 'stock', short: '華邦電', group: '半導體' },
    { code: '6515', name: '穎崴', type: 'stock', short: '穎崴', group: '半導體' },
    { code: '2317', name: '鴻海', type: 'stock', short: '鴻海', group: '電子製造／AI 伺服器' },
    { code: '2382', name: '廣達', type: 'stock', short: '廣達', group: '電子製造／AI 伺服器' },
    { code: '3231', name: '緯創', type: 'stock', short: '緯創', group: '電子製造／AI 伺服器' },
    { code: '2357', name: '華碩', type: 'stock', short: '華碩', group: '電子製造／AI 伺服器' },
    { code: '2308', name: '台達電', type: 'stock', short: '台達電', group: '電子零組件' },
    { code: '2345', name: '智邦', type: 'stock', short: '智邦', group: '電子零組件' },
    { code: '3037', name: '欣興', type: 'stock', short: '欣興', group: '電子零組件' },
    { code: '2881', name: '富邦金', type: 'stock', short: '富邦金', group: '金融' },
    { code: '2882', name: '國泰金', type: 'stock', short: '國泰金', group: '金融' },
    { code: '2891', name: '中信金', type: 'stock', short: '中信金', group: '金融' },
    { code: '2886', name: '兆豐金', type: 'stock', short: '兆豐金', group: '金融' },
    { code: '2412', name: '中華電', type: 'stock', short: '中華電', group: '電信' },
    { code: '1216', name: '統一', type: 'stock', short: '統一', group: '食品／零售' },
    { code: '2912', name: '統一超', type: 'stock', short: '統一超', group: '食品／零售' },
    { code: '1301', name: '台塑', type: 'stock', short: '台塑', group: '傳統產業' },
    { code: '2002', name: '中鋼', type: 'stock', short: '中鋼', group: '傳統產業' },
    { code: '2603', name: '長榮', type: 'stock', short: '長榮', group: '航運' },
  ];
  var TYPE = {};
  STOCKS.forEach(function (s) { TYPE[s.code] = s.type; });

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parse(s) { var a = String(s).split('/'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function fmt(d) { return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return fmt(d); }
  function isWeekday(s) { var w = parse(s).getDay(); return w > 0 && w < 6; }
  function nextWeekday(s) { do { s = addDays(s, 1); } while (!isWeekday(s)); return s; }
  function seasonOf(s) { return String(s).slice(0, 7); }
  function nextSeason(s) { var a = s.split('/'), d = new Date(+a[0], +a[1], 1); return d.getFullYear() + '/' + pad(d.getMonth() + 1); }
  /** 這一季（月）最後一個週一～週五 */
  function lastWeekday(season) {
    var a = season.split('/'), d = new Date(+a[0], +a[1], 0);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    return fmt(d);
  }
  /** 下單後預計哪一天的收盤價成交（13:30 以前＝今天；以後或假日＝下一個平日） */
  function orderDay(ymd, hm) { return isWeekday(ymd) && hm < RULES.CLOSE ? ymd : nextWeekday(ymd); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r6(x) { return Math.round(x * 1e6) / 1e6; }

  /** prices：{ 代號: { 日期: { c: 收盤價, div: 現金股利 } } } → 所有交易日（排序好） */
  function tradingDays(prices) {
    var set = {};
    Object.keys(prices).forEach(function (c) { Object.keys(prices[c]).forEach(function (d) { if (prices[c][d].c > 0) set[d] = 1; }); });
    return Object.keys(set).sort();
  }

  /**
   * 重算一個人從第一次下單到現在的帳本（不分季、不歸零）。
   * trades：[{ id, ymd, hm, t, side: '買'|'賣', code, amount(買的投資幣), units(賣的單位), status }]
   *   status：'已取消' 的不算；其他（待成交、已成交）都照規則重新計算。
   * days：所有交易日（tradingDays 的結果）
   */
  function book(trades, prices, days) {
    var idx = {};
    days.forEach(function (d, i) { idx[d] = i; });
    var cash = RULES.START, lots = {}, last = {}, fills = {}, divs = [], snaps = [];
    STOCKS.forEach(function (s) { lots[s.code] = []; });
    var pend = trades.filter(function (t) { return t.status !== '已取消'; })
      .map(function (t) { return { tr: t, eff: orderDay(t.ymd, t.hm) }; })
      .sort(function (a, b) { return a.tr.t - b.tr.t; });
    var start = pend.length ? pend.reduce(function (m, o) { return o.eff < m ? o.eff : m; }, '9999') : '9999';
    var held = function (code) { return (lots[code] || []).reduce(function (s, l) { return s + l.u; }, 0); };
    var between = function (a, d) { return (idx[d] === undefined ? days.length : idx[d]) - idx[a]; };
    days.forEach(function (D) {
      STOCKS.forEach(function (s) { var p = prices[s.code] && prices[s.code][D]; if (p && p.c > 0) last[s.code] = p.c; });
      if (D < start) return;                             // 還沒開始投資
      // 1. 除息：前一天收盤時持有的人領現金股利
      STOCKS.forEach(function (s) {
        var p = prices[s.code] && prices[s.code][D];
        if (!p || !(p.div > 0)) return;
        var u = held(s.code);
        if (u > 1e-9) { var amt = r2(u * p.div); cash = r2(cash + amt); divs.push({ d: D, code: s.code, units: r6(u), per: p.div, amount: amt }); }
      });
      // 2. 成交
      pend.forEach(function (o) {
        if (fills[o.tr.id] || o.eff > D) return;
        var tr = o.tr, p = prices[tr.code] && prices[tr.code][D];
        if (!p || !(p.c > 0)) return;
        if (tr.side === '買') {
          var fee = r2(tr.amount * RULES.FEE), u = r6((tr.amount - fee) / p.c);
          cash = r2(cash - tr.amount);
          lots[tr.code].push({ d: D, u: u, cost: tr.amount });
          fills[tr.id] = { d: D, price: p.c, units: u, amount: tr.amount, fee: fee, tax: 0, net: -tr.amount };
        } else {
          var have = held(tr.code), want = Math.min(tr.units, have);
          if (want <= 1e-6) { fills[tr.id] = { d: D, fail: '已經沒有持股' }; return; }
          var ok = lots[tr.code].filter(function (l) { return between(l.d, D) >= RULES.HOLD; }).reduce(function (s, l) { return s + l.u; }, 0);
          if (ok < want - 1e-6) return;                 // 還沒滿 3 個交易日：等下一天
          var left = want, cost = 0;
          while (left > 1e-9 && lots[tr.code].length) {  // 先買的先賣
            var l = lots[tr.code][0], take = Math.min(l.u, left), part = l.cost * take / l.u;
            cost += part; l.cost -= part; l.u = r6(l.u - take); left = r6(left - take);
            if (l.u <= 1e-9) lots[tr.code].shift();
          }
          var gross = want * p.c, f2 = r2(gross * RULES.FEE), tax = r2(gross * (TYPE[tr.code] === 'stock' ? RULES.TAX_STOCK : RULES.TAX_ETF));
          var net = r2(gross - f2 - tax);
          cash = r2(cash + net);
          fills[tr.id] = { d: D, price: p.c, units: r6(want), amount: r2(gross), fee: f2, tax: tax, net: net, profit: r2(net - cost) };
        }
      });
      // 3. 收盤後的總值
      var inv = 0;
      STOCKS.forEach(function (s) { inv += held(s.code) * (last[s.code] || 0); });
      snaps.push({ d: D, v: r2(cash + inv), inv: cash + inv > 0 ? inv / (cash + inv) : 0 });
    });
    var holdings = STOCKS.map(function (s) {
      var u = held(s.code), cost = lots[s.code].reduce(function (t, l) { return t + l.cost; }, 0);
      return { code: s.code, units: r6(u), cost: r2(cost), price: last[s.code] || 0, value: r2(u * (last[s.code] || 0)), lots: lots[s.code].map(function (l) { return { d: l.d, u: l.u }; }) };
    }).filter(function (h) { return h.units > 1e-9; });
    var pending = pend.filter(function (o) { return !fills[o.tr.id]; }).map(function (o) { return o.tr.id; });
    var reserved = pend.filter(function (o) { return !fills[o.tr.id] && o.tr.side === '買'; }).reduce(function (s, o) { return s + o.tr.amount; }, 0);
    var value = snaps.length ? snaps[snaps.length - 1].v : RULES.START;
    var fillDays = Object.keys(fills).filter(function (id) { return !fills[id].fail; }).map(function (id) { return fills[id].d; });
    return {
      cash: r2(cash), avail: r2(cash - reserved), value: value, total: value / RULES.START - 1,
      holdings: holdings, fills: fills, divs: divs, snaps: snaps, pending: pending, fillDays: fillDays,
      diary: fillDays.length, eligible: fillDays.length >= RULES.DIARY,
    };
  }

  /** 某一季的成績：季初總值（上一季最後一天收盤，第一次參加＝1,000）→ 季末（或到目前為止）總值 */
  function seasonStats(b, season) {
    var inS = b.snaps.filter(function (s) { return seasonOf(s.d) === season; });
    var before = b.snaps.filter(function (s) { return seasonOf(s.d) < season; });
    var v0 = before.length ? before[before.length - 1].v : RULES.START;
    var v1 = inS.length ? inS[inS.length - 1].v : v0;
    var diary = b.fillDays.filter(function (d) { return seasonOf(d) <= season; }).length;
    var series = [v0].concat(inS.map(function (s) { return s.v; })), rets = [];
    for (var i = 1; i < series.length; i++) rets.push(series[i] / series[i - 1] - 1);
    var mean = rets.reduce(function (s, x) { return s + x; }, 0) / (rets.length || 1);
    var vol = rets.length ? Math.sqrt(rets.reduce(function (s, x) { return s + (x - mean) * (x - mean); }, 0) / rets.length) : 0;
    return {
      start: v0, value: v1, ret: v1 / v0 - 1, total: v1 / RULES.START - 1, diary: diary, eligible: diary >= RULES.DIARY, active: diary > 0,
      seasonTrades: b.fillDays.filter(function (d) { return seasonOf(d) === season; }).length,
      vol: vol, days: rets.length, avgInv: inS.length ? inS.reduce(function (s, x) { return s + x.inv; }, 0) / inS.length : 0,
    };
  }

  /** 現在還能賣多少單位（已經滿 3 個交易日、扣掉已經掛單要賣的） */
  function sellable(b, code, days, sellDay, pendingSellUnits) {
    var h = b.holdings.find(function (x) { return x.code === code; });
    if (!h) return 0;
    var idx = {};
    days.forEach(function (d, i) { idx[d] = i; });
    var at = idx[sellDay] !== undefined ? idx[sellDay] : days.length;  // 還沒到的日子＝下一個交易日
    var ok = h.lots.filter(function (l) { return at - idx[l.d] >= RULES.HOLD; }).reduce(function (s, l) { return s + l.u; }, 0);
    return Math.max(0, r6(ok - (pendingSellUnits || 0)));
  }

  /** 排名：只有符合資格的人有名次（報酬率到 0.01% 一樣就並列）；另外算穩健獎、獎勵點數。
      noPrize（導師）：一起排名，但不領獎、不佔同學的得獎名額、不參加穩健獎 */
  function standings(list) {
    var rk = function (x) { return Math.round(x.ret * 1e4); };
    var el = list.filter(function (x) { return x.eligible; }).sort(function (a, b) { return b.ret - a.ret; });
    var rank = 0;
    el.forEach(function (x, i) { if (i === 0 || rk(x) !== rk(el[i - 1])) rank = i + 1; x.rank = rank; });
    var stu = el.filter(function (x) { return !x.noPrize; }), pr = 0;
    stu.forEach(function (x, i) { if (i === 0 || rk(x) !== rk(stu[i - 1])) pr = i + 1; x.prank = pr; x.prize = RULES.PRIZE[pr - 1] || 0; });
    el.forEach(function (x) { if (x.noPrize) { x.prank = null; x.prize = 0; } });
    var cand = stu.filter(function (x) { return x.ret > 0 && x.avgInv >= RULES.MIN_INV && x.days >= 2; })
      .sort(function (a, b) { return a.vol - b.vol || b.ret - a.ret; });
    var steady = cand[0] || null;
    list.forEach(function (x) { if (!x.eligible) { x.rank = null; x.prize = 0; } x.steady = x === steady; });
    var rest = list.filter(function (x) { return !x.eligible; }).sort(function (a, b) { return b.ret - a.ret; });
    return { list: el.concat(rest), steady: steady };
  }

  return {
    RULES: RULES, STOCKS: STOCKS, parse: parse, fmt: fmt, addDays: addDays, isWeekday: isWeekday, nextWeekday: nextWeekday,
    seasonOf: seasonOf, nextSeason: nextSeason, lastWeekday: lastWeekday, orderDay: orderDay, tradingDays: tradingDays,
    book: book, seasonStats: seasonStats, sellable: sellable, standings: standings,
  };
})();
if (typeof window !== 'undefined') window.InvestEngine = InvestEngine;
