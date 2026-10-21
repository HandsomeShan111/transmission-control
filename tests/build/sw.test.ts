// The service worker, APP-03 and APP-04, built as tools/build.ts builds it and run against stand-ins
// for its scope, CacheStorage and the network.
import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";

const SCOPE = "https://game.test/tc/";
const FILES = ["index.html", "assets/main-aaaaaaaa.js", "assets/main-bbbbbbbb.css", "assets/win-cccccccc.wav"];

let code = "";
beforeAll(async () => {
  const r = await Bun.build({
    entrypoints: [join(import.meta.dir, "../../src/sw.ts")],
    target: "browser",
    format: "esm",
    define: { __VERSION__: JSON.stringify("v2"), __FILES__: JSON.stringify(FILES) },
  });
  if (!r.success) throw new AggregateError(r.logs, "sw.ts failed to build");
  code = await r.outputs[0].text();
});

type Handler = (e: unknown) => void;

/** One worker of version v2 over `caches`, with `host` as the network: path to body; `moved` paths answer as redirected. */
function worker(caches = new Map<string, Map<string, Response>>(), host: Record<string, string> = {}, moved: string[] = []) {
  const on: Record<string, Handler> = {};
  const asked: Request[] = [];
  let claims = 0;
  const self = { registration: { scope: SCOPE }, clients: { claim: async () => void claims++ }, addEventListener: (t: string, fn: Handler) => (on[t] = fn) };
  const fetch = async (r: Request) => {
    asked.push(r);
    const path = new URL(r.url).pathname;
    const body = host[path];
    const res = body === undefined ? new Response("no", { status: 404 }) : new Response(body);
    return moved.includes(path) ? Object.defineProperty(res, "redirected", { value: true }) : res;
  };
  const open = async (name: string) => {
    if (!caches.has(name)) caches.set(name, new Map());
    const m = caches.get(name)!;
    return {
      match: async (k: string) => m.get(k)?.clone(),
      put: async (k: string, r: Response) => void m.set(k, r),
    };
  };
  const match = async (k: string) => [...caches.values()].find((m) => m.has(k))?.get(k)?.clone();
  const store = { open, match, keys: async () => [...caches.keys()], delete: async (k: string) => caches.delete(k) };
  new Function("self", "caches", "fetch", code)(self, store, fetch);

  /** Runs one lifecycle event to its end. */
  const life = async (type: string) => {
    const waits: Promise<unknown>[] = [];
    on[type]({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  /** A request to the worker: its answer, or null when it leaves the request to the network. */
  const request = async (url: string, method = "GET") => {
    const answers: Promise<Response>[] = [];
    const waits: Promise<unknown>[] = [];
    on.fetch({ request: new Request(url, { method }), respondWith: (p: Promise<Response>) => answers.push(p), waitUntil: (p: Promise<unknown>) => waits.push(p) });
    const res = answers.length ? await answers[0] : null;
    await Promise.all(waits);
    return res;
  };
  return { caches, asked, life, request, claims: () => claims };
}

const NAME = "transmission-control /tc/ v2";
const host = { "/tc/index.html": "page 2", "/tc/assets/main-aaaaaaaa.js": "js 2", "/tc/assets/main-bbbbbbbb.css": "css 2", "/tc/assets/win-cccccccc.wav": "win" };

describe("Service worker", () => {
  test("APP-02: install keeps the core files, not the sounds and music, past the HTTP cache", async () => {
    const w = worker(undefined, host);
    await w.life("install");
    expect([...w.caches.get(NAME)!.keys()].sort()).toEqual([
      "https://game.test/tc/assets/main-aaaaaaaa.js",
      "https://game.test/tc/assets/main-bbbbbbbb.css",
      "https://game.test/tc/index.html",
    ]);
    for (const r of w.asked) expect(r.cache).toBe("no-cache");
  });

  test("APP-04: the first version takes the open page; a later one deletes the old caches of its scope only", async () => {
    const first = worker();
    await first.life("activate");
    expect(first.claims()).toBe(1);

    const caches = new Map([
      ["transmission-control /tc/ v1", new Map()],
      ["transmission-control /other/ v1", new Map()],
      [NAME, new Map()],
    ]);
    const later = worker(caches);
    await later.life("activate");
    expect([...caches.keys()].sort()).toEqual(["transmission-control /other/ v1", NAME]);
    expect(later.claims()).toBe(0);
  });

  test("APP-03: sounds that arrived before a version took over are kept for it", async () => {
    const WIN = "https://game.test/tc/assets/win-cccccccc.wav";
    // The first version: the page that installed it fetched the sound.
    const first = worker(undefined, host);
    await first.life("activate");
    expect(await first.caches.get(NAME)!.get(WIN)!.text()).toBe("win");
    expect(first.asked.map((r) => [r.url, r.cache])).toEqual([[WIN, "force-cache"]]);
    // A later version: from the version before, with no network.
    const caches = new Map([["transmission-control /tc/ v1", new Map([[WIN, new Response("win 1")]])]]);
    const later = worker(caches);
    await later.life("activate");
    expect([...caches.keys()]).toEqual([NAME]);
    expect(await caches.get(NAME)!.get(WIN)!.text()).toBe("win 1");
    expect(later.asked).toHaveLength(0);
  });

  test("APP-03: a file of this version comes from its cache; the scope itself is index.html", async () => {
    const w = worker(undefined, host);
    await w.life("install");
    w.asked.length = 0;
    expect(await (await w.request("https://game.test/tc/assets/main-aaaaaaaa.js"))!.text()).toBe("js 2");
    expect(await (await w.request("https://game.test/tc/"))!.text()).toBe("page 2");
    expect(await (await w.request("https://game.test/tc/?from=link"))!.text()).toBe("page 2");
    expect(w.asked).toHaveLength(0);
  });

  test("A host that sends index.html on to the scope: the page is kept as a plain answer", async () => {
    const w = worker(undefined, host, ["/tc/index.html"]);
    await w.life("install");
    const kept = w.caches.get(NAME)!.get("https://game.test/tc/index.html")!;
    expect([kept.redirected, await kept.clone().text()]).toEqual([false, "page 2"]);
  });

  test("Install fails when a core file is missing", async () => {
    const w = worker(undefined, { "/tc/index.html": "page 2" });
    await expect(w.life("install")).rejects.toThrow("HTTP 404");
  });

  test("A sound is fetched the first time and kept; a missing file is not kept", async () => {
    const w = worker(undefined, { "/tc/index.html": "page 2" });
    expect((await w.request("https://game.test/tc/assets/win-cccccccc.wav"))!.status).toBe(404);
    expect(w.caches.get(NAME)!.has("https://game.test/tc/assets/win-cccccccc.wav")).toBe(false);

    const v = worker(undefined, host);
    expect(await (await v.request("https://game.test/tc/assets/win-cccccccc.wav"))!.text()).toBe("win");
    expect(await (await v.request("https://game.test/tc/assets/win-cccccccc.wav"))!.text()).toBe("win");
    expect(v.asked).toHaveLength(1);
  });

  test("Other requests are left to the network", async () => {
    const w = worker(undefined, host);
    await w.life("install");
    for (const url of [
      "https://counts.test/count?p=campaign_finish&e=true",
      "https://game.test/other/index.html",
      "https://game.test/tc/assets/main-old00000.js",
      "https://game.test/tc/sw.js",
    ])
      expect(await w.request(url)).toBeNull();
    expect(await w.request("https://game.test/tc/index.html", "POST")).toBeNull();
  });
});
