/* ── 選位引擎 ───────────────────────────────────────────────
 * 這一段和 gas/Code.gs 最下方的 SelEngine 是同一份程式，修改時兩邊要一起改。
 * （網頁的測試模式在手機上模擬；正式選位由 Google Apps Script 執行）
 *
 * 規則：
 *   1. 依段考名次排出順序（order）。
 *   2. 輪到某位同學時，如果他預選的志願還有空位，立刻自動分配第一個還空著的志願。
 *   3. 沒有志願（或志願都被選走）就等他自己點，限時 perTurn 秒。
 *   4. 超過時間：第一次移到最後面，第二次由系統隨機分配。
 * 狀態 status：idle 沒有選位 → ready 可預選志願 → open 選位中 ⇄ paused 暫停 → done 結束
 */
var SelEngine = (function () {
  function taken(S) {
    var t = {};
    Object.keys(S.picks).forEach(function (k) { t[S.picks[k]] = k; });
    return t;
  }
  function isFree(S, seat, t) { return S.seats.indexOf(seat) >= 0 && S.blocked.indexOf(seat) < 0 && !t[seat]; }
  function freeSeats(S) { var t = taken(S); return S.seats.filter(function (x) { return isFree(S, x, t); }); }
  function setWaiting(S, k, now) {
    if (S.waiting === k) return;
    S.waiting = k;
    S.turnAt = now;
    S.deadline = S.perTurn > 0 ? now + S.perTurn * 1000 : 0;
  }
  function moveToEnd(S, i) { var k = S.order.splice(i, 1)[0]; S.order.push(k); }

  function create(o) {
    return {
      v: o.v || 0, status: 'ready', source: o.source || '', loadedAt: o.now,
      seats: o.seats, perTurn: o.perTurn, maxWishes: o.maxWishes,
      order: o.order, ranks: o.ranks || {}, noRank: o.noRank || [], noId: o.noId || [],
      picks: {}, how: {}, wishes: {}, blocked: (o.blocked || []).filter(function (x) { return o.seats.indexOf(x) >= 0; }),
      deferred: {}, turn: 0, waiting: '', turnAt: 0, deadline: 0, remain: 0, applied: false,
    };
  }

  // 往下處理：已有座位的跳過、有志願的自動分配，直到需要等某位同學自己選
  function advance(S, now) {
    if (S.status !== 'open') return;
    var t = taken(S);
    while (S.turn < S.order.length) {
      var k = S.order[S.turn];
      if (S.picks[k]) { S.turn++; continue; }
      var ws = S.wishes[k] || [], w = '';
      for (var i = 0; i < ws.length; i++) if (isFree(S, ws[i], t)) { w = ws[i]; break; }
      if (w) { S.picks[k] = w; S.how[k] = 'wish'; t[w] = k; S.turn++; continue; }
      if (!S.seats.some(function (x) { return isFree(S, x, t); })) break; // 沒有空位了
      setWaiting(S, k, now);
      return;
    }
    S.status = 'done'; S.waiting = ''; S.deadline = 0;
  }

  // 時間到：第一次移到最後，第二次隨機分配
  function tick(S, now) {
    if (S.status !== 'open' || !S.deadline || now < S.deadline) return false;
    var k = S.order[S.turn];
    if (!S.deferred[k]) {
      S.deferred[k] = 1;
      moveToEnd(S, S.turn);
    } else {
      var f = freeSeats(S);
      if (f.length) { S.picks[k] = f[Math.floor(Math.random() * f.length)]; S.how[k] = 'auto'; }
      S.turn++;
    }
    S.waiting = '';
    advance(S, now);
    return true;
  }

  function pick(S, k, seat, now) {
    if (S.status !== 'open') throw new Error(S.status === 'paused' ? '選位暫停中，請稍候' : '現在不能選位');
    if (S.picks[k]) throw new Error('你已經有座位了');
    if (S.waiting !== k) throw new Error('還沒輪到你');
    if (!isFree(S, seat, taken(S))) throw new Error('這個座位已經被選走了');
    S.picks[k] = seat; S.how[k] = 'self';
    S.turn++; S.waiting = '';
    advance(S, now);
  }

  function setWishes(S, k, list) {
    if (['ready', 'open', 'paused'].indexOf(S.status) < 0) throw new Error('現在不能填志願');
    if (S.order.indexOf(k) < 0) throw new Error('你不在這次的選位名單中');
    if (S.picks[k]) throw new Error('你已經有座位了');
    var out = [];
    (list || []).forEach(function (x) {
      x = String(x);
      if (out.length < S.maxWishes && S.seats.indexOf(x) >= 0 && S.blocked.indexOf(x) < 0 && out.indexOf(x) < 0) out.push(x);
    });
    S.wishes[k] = out;
  }

  // 老師指定座位（seat 空白＝取消這位同學的座位，選位中會讓他馬上重選）
  function assign(S, k, seat, now) {
    if (S.order.indexOf(k) < 0) throw new Error('名單中沒有這位同學');
    if (seat) {
      var t = taken(S);
      if (S.seats.indexOf(seat) < 0) throw new Error('沒有這個座位');
      if (t[seat] && t[seat] !== k) throw new Error('這個座位已經有人了');
      S.blocked = S.blocked.filter(function (x) { return x !== seat; });
      S.picks[k] = seat; S.how[k] = 'teacher';
      if (S.waiting === k) { S.turn++; S.waiting = ''; }
    } else {
      delete S.picks[k]; delete S.how[k];
      var i = S.order.indexOf(k);
      if ((S.status === 'open' || S.status === 'paused') && i < S.turn) {
        S.order.splice(i, 1); S.turn--;
        S.order.splice(S.turn, 0, k);
        S.waiting = '';
        S.remain = S.perTurn * 1000;
      }
    }
    advance(S, now);
  }

  // 座位「不開放」切換
  function block(S, seat) {
    if (S.seats.indexOf(seat) < 0) return;
    if (taken(S)[seat]) throw new Error('這個座位已經有人了');
    var i = S.blocked.indexOf(seat);
    if (i >= 0) { S.blocked.splice(i, 1); return; }
    S.blocked.push(seat);
    Object.keys(S.wishes).forEach(function (k) { S.wishes[k] = S.wishes[k].filter(function (x) { return x !== seat; }); });
  }

  function command(S, c, now) {
    if (c === 'open') {
      if (S.status !== 'ready') throw new Error('選位已經開始了');
      S.status = 'open'; S.turn = 0; S.waiting = '';
      advance(S, now);
    } else if (c === 'pause') {
      if (S.status !== 'open') return;
      S.status = 'paused';
      S.remain = S.deadline ? Math.max(0, S.deadline - now) : 0;
      S.deadline = 0;
    } else if (c === 'resume') {
      if (S.status !== 'paused') return;
      S.status = 'open';
      if (S.waiting && S.perTurn > 0) S.deadline = now + Math.max(S.remain, 10000);
      advance(S, now);
    } else if (c === 'skip') {
      if ((S.status !== 'open' && S.status !== 'paused') || S.turn >= S.order.length) return;
      moveToEnd(S, S.turn);
      S.waiting = ''; S.remain = S.perTurn * 1000;
      advance(S, now);
    } else if (c === 'end') {
      S.status = 'done'; S.waiting = ''; S.deadline = 0;
    } else {
      throw new Error('未知的指令：' + c);
    }
  }

  // 給學生看的資料：不包含其他人的名次與順序
  function view(S, k, now) {
    if (!S || !S.status || S.status === 'idle') return { v: S ? S.v || 0 : 0, status: 'idle', now: now };
    var my = S.order.indexOf(k);
    return {
      v: S.v, status: S.status, now: now, applied: !!S.applied,
      total: S.order.length, turnPos: S.turn + 1, picked: Object.keys(S.picks).length,
      myPos: my + 1, ahead: my >= 0 ? Math.max(0, my - S.turn) : 0,
      myTurn: S.status === 'open' && S.waiting === k,
      deadline: S.waiting === k ? S.deadline : 0,
      remain: S.waiting === k ? S.remain : 0,
      deferred: !!S.deferred[k],
      taken: taken(S), blocked: S.blocked, seats: S.seats,
      myWishes: S.wishes[k] || [], myPick: S.picks[k] || '', myHow: S.how[k] || '',
      maxWishes: S.maxWishes, perTurn: S.perTurn,
    };
  }

  return { create: create, advance: advance, tick: tick, pick: pick, setWishes: setWishes, assign: assign, block: block, command: command, view: view, taken: taken, freeSeats: freeSeats };
})();
