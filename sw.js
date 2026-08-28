// Service worker do "Filhotes da Fedó".
// Objetivo: deixar o site instalável como app e funcionar minimamente offline
// (abre o app mesmo sem internet), sem nunca cachear dados do Firebase —
// os dados de verdade sempre vêm da rede, em tempo real.

const CACHE_VERSION = 'filhotes-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só cuidamos de requisições GET dentro do próprio site.
  // Firebase, Firestore, fontes externas, CDN etc. seguem direto pra rede,
  // sem passar pelo cache — é essencial pros dados chegarem sempre atualizados.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Página principal: tenta a rede primeiro (site sempre atualizado);
  // se estiver offline, cai pro que estiver salvo em cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Demais arquivos do próprio site (ícones, manifest): cache primeiro,
  // com atualização em segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
