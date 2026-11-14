/* راكان المالية · عامل الخدمة: يحفظ ملفات التطبيق ليفتح بسرعة وبلا إنترنت (البيانات نفسها محفوظة في IndexedDB) */
var VERSION = 'rakan-fin-v6';
var SHELL = ['./', 'index.html', 'style.css', 'app.js', 'install.js', 'fin.js', 'core.js', 'config.js', 'logo.png', 'icon-192.png', 'icon-512.png',
  'manifest.webmanifest', 'xlsx.style.min.js', 'fonts/Tajawal-Regular.ttf', 'fonts/Tajawal-Bold.ttf', 'fonts/Tajawal-ExtraBold.ttf'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return fetch(new Request(u, { cache: 'reload' })).then(function (r) { if (!r.ok) throw new Error(u); return c.put(u, r); });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// من الشبكة أولاً، ومن الذاكرة عند انقطاع الإنترنت
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  var key = e.request.mode === 'navigate' ? 'index.html' : u.pathname.replace(/^.*\/rakan-finance\//, '').replace(/^\//, '') || 'index.html';
  e.respondWith(caches.open(VERSION).then(function (c) {
    var net = fetch(e.request.url, { cache: 'no-cache' }).then(function (r) {
      if (r && r.ok && SHELL.indexOf(key) >= 0) c.put(key, r.clone());
      return r;
    });
    var timeout = new Promise(function (res) { setTimeout(res, 6000); });
    return Promise.race([net, timeout.then(function () { return c.match(key); })]).then(function (r) { return r || net; })
      .catch(function () { return c.match(key).then(function (hit) { return hit || c.match('index.html'); }); });
  }));
});
