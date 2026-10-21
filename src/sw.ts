// The service worker, APP-03 and APP-04: one cache per version; a visit's files all come from the
// version it opened with. tools/build.ts fills __VERSION__ and __FILES__, paths relative to the scope.
declare const __VERSION__: string;
declare const __FILES__: string[];

export {};
const sw = self as unknown as ServiceWorkerGlobalScope;
const FILES = __FILES__;
const scope = new URL(sw.registration.scope);
/** Caches of this game at this scope; another copy at another path keeps its own. */
const PREFIX = `transmission-control ${scope.pathname} `;
const NAME = PREFIX + __VERSION__;
const PAGE = "index.html";

/**
 * Keeps one answer. A host that sends index.html on to the scope marks its answer redirected, which
 * the browser refuses for a page opening; it is kept as a plain copy.
 */
const keep = async (c: Cache, key: string, res: Response) =>
  c.put(key, res.redirected ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers }) : res);

// APP-02: the core files; sounds and tracks are kept as play fetches them. No skipWaiting: the
// new version waits until every page of the visit has closed, APP-04.
sw.addEventListener("install", (e) => {
  const core = FILES.filter((f) => !f.endsWith(".wav"));
  e.waitUntil(
    (async () => {
      const c = await caches.open(NAME);
      const got = await Promise.all(core.map((f) => fetch(new Request(new URL(f, scope), { cache: "no-cache" }))));
      const bad = got.find((r) => !r.ok);
      if (bad) throw new Error(`${bad.url}: HTTP ${bad.status}`);
      await Promise.all(got.map((r, i) => keep(c, new URL(core[i], scope).href, r)));
    })(),
  );
});

// The first version takes control of the page that installed it; a later one waits for the next visit.
// APP-03: sounds and music that arrived before this version took over, on a first visit or kept by
// the version before, are kept for it too; one not arrived is fetched on the next play.
sw.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(NAME);
      const old = (await caches.keys()).filter((k) => k.startsWith(PREFIX) && k !== NAME);
      await Promise.all(
        FILES.filter((f) => f.endsWith(".wav")).map(async (f) => {
          const key = new URL(f, scope).href;
          if (await cache.match(key)) return;
          // A later version: from the version before. The first: the page that installed it fetched it, so the browser's cache has it.
          const res = old.length ? await caches.match(key) : await fetch(new Request(key, { cache: "force-cache" })).catch(() => null);
          if (res?.status === 200) await keep(cache, key, res);
        }),
      );
      await Promise.all(old.map((k) => caches.delete(k)));
      if (!old.length) await sw.clients.claim();
    })(),
  );
});

// APP-03: this version's files from its cache, else from the network, kept once they arrive.
// A file of this version gone from the host answers as the network does, never from another version.
sw.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const file = url.pathname.slice(scope.pathname.length) || PAGE;
  if (!FILES.includes(file)) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(NAME);
      const key = new URL(file, scope).href;
      const hit = await cache.match(key);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.status === 200) e.waitUntil(keep(cache, key, res.clone()));
      return res;
    })(),
  );
});
