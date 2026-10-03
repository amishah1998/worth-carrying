// Shell is cached so the app opens instantly in a shop with weak roaming data.
// Lookups always go to the network; a cached price would defeat the point.
const SHELL = "worth-carrying-shell-v2";
const FILES = ["./", "./app.css", "./app.js", "./config.js", "./manifest.json", "./icon.svg", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("worth-carrying-shell-") && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/")) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      if (res.ok) caches.open(SHELL).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then(async (hit) => hit || (e.request.mode === "navigate" ? await caches.match(new URL("./", self.location.href).href) : null) || Response.error()))
  );
});
