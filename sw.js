const CACHE_NAME = "book-forge-v1";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles/main.css",
  "./assets/fonts/GeostarFill-Regular.ttf",
  "./app.js",
  "./manifest.webmanifest",
  "./sw.js",
  "./assets/icons/tabler-sprite.svg",
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
  "./ui/deletePageDialog.js",
  "./ui/printPreview.js",
  "./ui/exportChecklist.js",
  "./ui/panels.js",
  "./importers/multiPageImporter.js",
  "./importers/pdfImporter.js",
  "./importers/docxImporter.js",
  "./exporters/pdf.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
