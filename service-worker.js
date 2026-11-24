const CACHE_NAME = "moj-majatek-v14";
const APP_FILES = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.json", "./icon.png", "./supabase-config.js"];
const STATIC_PATHS = new Set(["", "index.html", "styles.css", "app.js", "manifest.json", "icon.png", "supabase-config.js"]);

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  const scopePath = new URL(self.registration.scope).pathname;
  const appPath = requestUrl.pathname.startsWith(scopePath)
    ? requestUrl.pathname.slice(scopePath.length)
    : null;
  if (requestUrl.origin !== self.location.origin || appPath === null || !STATIC_PATHS.has(appPath)) return;

  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw new Error("Aplikacja nie jest dostępna offline.");
    })
  );
});
