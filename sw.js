const CACHE_PREFIX = "book-forge-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles/main.css",
  "./assets/fonts/GeostarFill-Regular.ttf",
  "./app.js",
  "./manifest.webmanifest",
  "./sw.js",
  "./assets/icons/tabler-sprite.svg",
  "./assets/vendor/pdfjs/pdf.min.mjs",
  "./assets/vendor/pdfjs/pdf.worker.min.mjs",
  "./assets/vendor/pdfjs/LICENSE",
  "./core/document.js",
  "./core/bookSettingsDraft.js",
  "./core/pageManager.js",
  "./core/eventBus.js",
  "./core/history.js",
  "./core/store.js",
  "./layout/spreadEngine.js",
  "./layout/marginOverlay.js",
  "./layout/backgroundReferenceLayer.js",
  "./layout/frameEngine.js",
  "./layout/pageRenderer.js",
  "./layout/pages.js",
  "./layout/sections.js",
  "./layout/masters.js",
  "./typography/styles.js",
  "./ui/iconMap.js",
  "./ui/icons.js",
  "./ui/bookSettings.js",
  "./ui/pageList.js",
  "./ui/pageContextMenu.js",
  "./ui/deletePageDialog.js",
  "./ui/printPreview.js",
  "./ui/exportChecklist.js",
  "./ui/panels.js",
  "./importers/multiPageImporter.js",
  "./importers/pdfImporter.js",
  "./importers/docxImporter.js",
  "./exporters/pdf.js"
];
const APP_ASSET_URLS = new Set(
  APP_ASSETS.map((asset) => new URL(asset, self.location.href).href)
);

function isAppAssetRequest(request) {
  return APP_ASSET_URLS.has(new URL(request.url).href);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all([
        ...keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
        caches.open(CACHE_NAME).then((cache) =>
          cache.keys().then((requests) =>
            Promise.all(
              requests
                .filter((request) => !isAppAssetRequest(request))
                .map((request) => cache.delete(request))
            )
          )
        )
      ])
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (!isAppAssetRequest(event.request)) {
    if (event.request.mode === "navigate") {
      event.respondWith(
        fetch(event.request).catch(() => caches.match("./index.html"))
      );
    }
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
