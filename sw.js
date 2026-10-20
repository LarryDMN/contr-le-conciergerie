/* Le service worker conserve uniquement les fichiers de l'application.
 * Les contrôles et les photos restent dans IndexedDB, séparément de ce cache.
 * Incrémenter la version du cache lors d'une publication de nouveaux fichiers.
 */
const CACHE_PREFIX = "controles-conciergerie-";
const CACHE_NAME = `${CACHE_PREFIX}v11`;
const INDEX_URL = new URL("index.html", self.registration.scope).href;
const ASSET_URLS = ["index.html", "style.css?v=11", "app.js?v=11", "config.js?v=11", "data/conciergeries.js", "data/bureaux.js?v=11", "office-model.js?v=11", "people.js?v=11", "insights.js?v=11", "transfer.js?v=11",
  "logo-horizontal.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "manifest.json", "vendor/jspdf.umd.min.js", "vendor/jspdf.plugin.autotable.min.js", "pdf.js?v=11", "lists.js?v=11", "anomalies.js?v=11"]
  .map((path) => new URL(path, self.registration.scope).href);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Une installation incomplète ne doit pas remplacer le cache fonctionnel.
    await cache.addAll(ASSET_URLS.map((url) => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(INDEX_URL, response.clone());
          return response;
        }
        // Un hébergeur momentanément indisponible ne doit pas empêcher le contrôle.
        const saved = await cache.match(INDEX_URL);
        return saved || response;
      } catch (error) {
        const saved = await cache.match(INDEX_URL);
        if (saved) return saved;
        throw error;
      }
    })());
    return;
  }

  // Les ressources sont locales et versionnées par la version du cache.
  // Ne pas mettre en cache les exports ni des données provenant d'autres chemins.
  if (!ASSET_URLS.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const saved = await cache.match(request);
    if (saved) return saved;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
