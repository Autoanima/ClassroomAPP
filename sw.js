/*
 * 每次打開都拿最新版本（加到手機主畫面後也一樣）：
 *   有網路 → 一律向伺服器拿最新的檔案（不使用瀏覽器快取），順便存一份
 *   沒網路 → 用上次存的那份，App 仍然打得開
 * 只處理這個網站自己的檔案；Google Apps Script、雲端硬碟等外部連線不經過這裡。
 */
const CACHE = 'indoor-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-store' });
      if (res.ok) {
        const copy = res.clone();
        // 去掉 ?v=… 再存，離線時才找得到
        const key = url.origin + url.pathname;
        caches.open(CACHE).then(c => c.put(key, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(url.origin + url.pathname) || (req.mode === 'navigate' && await caches.match(new URL('./', self.location).href));
      if (hit) return hit;
      throw err;
    }
  })());
});
