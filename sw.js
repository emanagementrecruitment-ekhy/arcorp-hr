// AR Corp HR — service worker.
// Shell di-cache agar aplikasi tetap terbuka tanpa internet;
// panggilan ke Supabase selalu lewat jaringan (network-first, tanpa cache).

const CACHE = 'arcorp-hr-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })))))
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
  // Data Supabase: jangan pernah di-cache.
  if (url.hostname.endsWith('.supabase.co')) return;

  // Navigasi: coba jaringan, jatuh ke shell tersimpan bila offline.
  if (req.mode === 'navigate'){
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Aset: pakai cache dulu, isi ulang di belakang.
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok && url.origin === self.location.origin){
          caches.open(CACHE).then(c => c.put(req, res.clone()));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
