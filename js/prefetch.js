'use strict';
/* ⚡ 自動預先載入：打開 App 後，依照功能表的順序（重要、常用的在前面），一次一個、趁空閒時偷偷把各分頁的資料先載好。
   分頁按鈕下面的細長條＝載入進度：跑動中＝正在載入，滿格淡紫色＝已經載好（點進去不會卡）。
   上方的 ⚡ 按鈕可以開關這個功能（記在這支手機）。各模組用 A.addPrefetch(分頁, 函式) 登記要預先載入的東西。 */
(() => {
  const A = window.App;
  const { $, toast, store } = A;
  const KEY = 'indoor.prefetch.v1';
  let on = store.get(KEY, true);
  let runId = 0, lastRun = 0, done = 0, total = 0;
  const st = {};   // 分頁 → 'wait' | 'loading' | 'done'

  const tabs = () => [...document.querySelectorAll('.tabs [data-tab]')].filter(b => !b.hidden).map(b => b.dataset.tab);
  function paint() {
    document.querySelectorAll('.tabs [data-tab]').forEach(b => {
      const s = on ? st[b.dataset.tab] : '';
      b.classList.toggle('pf-wait', s === 'wait');
      b.classList.toggle('pf-loading', s === 'loading');
      b.classList.toggle('pf-done', s === 'done');
      b.title = s === 'done' ? '已經預先載入好了' : s === 'loading' ? '正在預先載入…' : s === 'wait' ? '等一下會預先載入' : '';
    });
    const btn = $('#pfBtn');
    if (btn) {
      btn.setAttribute('aria-pressed', on);
      btn.classList.toggle('busy', on && Object.values(st).includes('loading'));
      btn.setAttribute('aria-label', on ? `自動預先載入：開（${done}/${total}）` : '自動預先載入：關');
    }
    A.emit('prefetch', { on, done, total });
  }
  A.prefetchInfo = () => ({ on, done, total, st: { ...st } });

  const idle = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, 300)));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function whileHidden(id) { while (document.hidden && id === runId) await wait(1000); }

  async function run() {
    if (!on || !A.started()) return;
    const id = ++runId;
    lastRun = Date.now();
    const list = tabs();
    list.forEach(t => { st[t] = 'wait'; });
    done = 0; total = list.length;
    paint();
    await wait(2500);                                  // 先讓畫面、目前的分頁載好
    for (const t of list) {
      if (id !== runId || !on) return;
      await whileHidden(id);
      await idle();
      if (st[t] === 'done') continue;                  // 使用者已經點進去過了
      const fns = A.prefetch[t] || [];
      if (t !== A.currentTab() && fns.length) {       // 目前的分頁自己會載入；沒有要載的（本機資料）直接算好
        st[t] = 'loading'; paint();
        await Promise.race([Promise.allSettled(fns.map(f => { try { return f(); } catch (e) { return null; } })), wait(25000)]);
        if (id !== runId) return;
      }
      st[t] = 'done'; done++; paint();
      await wait(500);                                 // 一個一個來，不要一次塞爆網路
    }
  }

  // 打開 App 時開始；離開超過 15 分鐘再回來，重新預先載入一次（資料可能變了）
  A.on('start', () => { paint(); run(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && on && A.started() && Date.now() - lastRun > 15 * 60e3) run();
  });
  // 點進某個分頁：那一頁自己會載入，標成完成
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => {
    if (on && st[b.dataset.tab] && st[b.dataset.tab] !== 'done') { st[b.dataset.tab] = 'done'; done = Math.min(total, done + 1); paint(); }
  }));

  // ⚡ 開關（原本「雲端燈號」的位置；同步有問題時旁邊會出現小紅點）
  $('#pfBtn')?.addEventListener('click', () => {
    on = !on;
    store.set(KEY, on);
    if (on) { toast('⚡ 自動預先載入：開（背景依序載入各分頁）'); run(); }
    else { runId++; toast('自動預先載入：關（打開分頁時才載入，比較省流量）'); }
    paint();
  });
  paint();
})();
