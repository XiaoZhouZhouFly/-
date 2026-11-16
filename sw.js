/* 離線快取：網路優先，讀不到網路時用上次的快取。
   words.json / progress.json 有更新時，連線狀態下一定會拿到最新版。 */
const CACHE = 'vocab-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'favicon.svg', 'favicon-32.png',
               'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
               'words.json', 'progress.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, {cache: 'reload'})).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(handle(req, url));
});

async function handle(req, url) {
  const cache = await caches.open(CACHE);
  const key = new Request(url.origin + url.pathname);       // 忽略 ?v=時間戳
  const hit = await cache.match(key);
  const net = fetch(req).then(res => {
    if (res.ok) { cache.put(key, res.clone()); return res; }
    return hit || res;
  });
  if (!hit) {
    try { return await net; }
    catch (err) {
      if (req.mode === 'navigate') { const idx = await cache.match('index.html'); if (idx) return idx; }
      throw err;
    }
  }
  // 有快取：網路 3 秒內沒回應就先用快取，網路回來後仍會更新快取
  return Promise.race([net, new Promise(r => setTimeout(() => r(hit), 3000))]).catch(() => hit);
}
