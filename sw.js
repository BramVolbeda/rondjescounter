// Rondje! service worker
// Verhoog CACHE_VERSION bij elke deploy zodat oude bestanden opgeruimd worden.
const CACHE_VERSION = 'rondje-v1';

// De "app shell": alles wat nodig is om de app te starten zonder netwerk.
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

// Verzoeken naar deze hosts NOOIT cachen: dit is live data.
const NETWORK_ONLY = [
  'firebaseio.com',
  'firebasedatabase.app',
  'googleapis.com',
  'firebaseapp.com',
  'gstatic.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      // addAll faalt volledig als één bestand mist; per stuk toevoegen is veiliger.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Alleen GET cachen. POST/PUT (Firebase-writes) altijd rechtstreeks door.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Live data: nooit uit cache serveren.
  if (NETWORK_ONLY.some((host) => url.hostname.includes(host))) return;

  // Navigatie (het openen van de app): network-first, zodat je altijd de
  // nieuwste index.html krijgt. Valt terug op de cache als je offline bent.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() =>
          caches
            .match('./index.html')
            .then((hit) => hit || caches.match('./'))
        )
    );
    return;
  }

  // Statische assets: cache-first, maar op de achtergrond verversen.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});

// Laat de pagina de wachtende service worker meteen activeren.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Tik op de melding → app naar de voorgrond halen (of openen).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('./');
    })
  );
});
