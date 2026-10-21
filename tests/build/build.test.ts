// The build, APP-01 to APP-03 and ART-12, and the static server: two builds into a scratch folder.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { serveDir } from "../../tools/serve.ts";

const ROOT = join(import.meta.dir, "../..");
const A = join(ROOT, "dist-test/a");
const B = join(ROOT, "dist-test/b");
const WIDGET =
  '<!-- The board\'s bug report widget, on tailnet test sites only. --><script>if(location.hostname.endsWith(".ts.net"))document.head.append(Object.assign(document.createElement("script"),{src:"https://pane-server.tail9feca9.ts.net:8446/widget.js",defer:true}))</script>';

const listAll = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)))
    .sort();

let printed = "";
let page = "";
let worker = "";

beforeAll(() => {
  for (const out of [A, B]) {
    const r = Bun.spawnSync([process.execPath, "tools/build.ts", out], { cwd: ROOT, env: { ...process.env, TC_COUNTS_ADDRESS: "" } });
    if (r.exitCode !== 0) throw new Error(`build failed: ${r.stderr.toString()}`);
    printed = r.stdout.toString();
  }
  page = readFileSync(join(A, "index.html"), "utf8");
  worker = readFileSync(join(A, "sw.js"), "utf8");
}, 60_000);

afterAll(() => rmSync(join(ROOT, "dist-test"), { recursive: true, force: true }));

describe("Build", () => {
  test("APP-02: index.html uses only relative URLs, and each one's file exists", () => {
    const urls = [...page.matchAll(/\b(?:src|href)="([^"]*)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThanOrEqual(2);
    for (const u of urls) {
      expect(u).not.toMatch(/^(\/|[a-z]+:)/i);
      expect(readFileSync(join(A, u)).length).toBeGreaterThan(0);
    }
    expect(page).toMatch(/<script type="module" src="assets\/main-\w+\.js"><\/script>/);
    expect(page).toMatch(/<link rel="stylesheet" href="assets\/main-\w+\.css">/);
  });

  test("The bug report widget's tag closes the head", () => {
    expect(page).toContain(`${WIDGET}\n</head>`);
  });

  test("APP-01: the look is set before any paint, and both looks' colours are in the page", () => {
    const look = page.indexOf('document.documentElement.dataset.look=l==="light"||l==="dark"?l:"light"');
    expect(look).toBeGreaterThan(0);
    expect(look).toBeLessThan(page.indexOf("<style>"));
    expect(page).toContain(":root[data-look=light]{color-scheme:light;--ground:#EFEBE1;");
    expect(page).toContain(":root[data-look=dark]{color-scheme:dark;--ground:#0F1113;");
    expect(page).toContain('content="width=device-width, initial-scale=1, viewport-fit=cover"');
    expect(page).toContain("<title>Transmission Control</title>");
    expect(page).not.toContain("{{");
  });

  test("ART-12: the game name is drawn in shapes in the page, with no text and no font", () => {
    const art = page.match(/<div id="opening">(<svg[^]*?<\/svg>)<\/div>/)?.[1] ?? "";
    expect(art).toContain('aria-label="Transmission Control"');
    expect(art).not.toMatch(/<text|<tspan|font/i);
    expect([...art.matchAll(/<(path|circle)\b/g)].length).toBeGreaterThan(40);
    expect(page).not.toMatch(/font-face|<text\b/i);
    expect(page.indexOf('<div id="opening">')).toBeLessThan(page.indexOf('<div id="app"></div>'));
  });

  test("APP-03: sw.js holds the version and every file but itself", () => {
    const files = JSON.parse(worker.match(/\["index\.html"[^\]]*\]/)![0]) as string[];
    expect(files.sort()).toEqual(listAll(A).filter((f) => f !== "sw.js"));
    const version = printed.match(/Version (\w+)\./)![1];
    expect(worker).toContain(`"${version}"`);
    expect(worker).toContain("transmission-control ");
    for (const f of files.filter((f) => f !== "index.html")) expect(f).toMatch(/^assets\/[a-z]+-\w{8}\.\w+$/);
    expect(files.filter((f) => f.endsWith(".wav"))).toHaveLength(10);
  });

  test("APP-02: everything but the sounds and music is within FirstLoad, 300 kB compressed", () => {
    const total = listAll(A)
      .filter((f) => !f.endsWith(".wav"))
      .reduce((n, f) => n + Bun.gzipSync(readFileSync(join(A, f))).length, 0);
    expect(total).toBeLessThan(300_000);
    expect(printed).toContain("FirstLoad:");
  });

  test("Two builds of the same source are byte-identical", () => {
    expect(listAll(B)).toEqual(listAll(A));
    for (const f of listAll(A)) expect(Bun.hash(readFileSync(join(B, f)))).toBe(Bun.hash(readFileSync(join(A, f))));
  });

  // Only folders whose loss costs nothing: a broken guard deletes the out-dir.
  test("The out-dir must be inside the worktree, and not a folder of other files", () => {
    const outside = join(tmpdir(), `tc-build-guard-${process.pid}`);
    const mixed = join(ROOT, "dist-test/mixed");
    mkdirSync(mixed, { recursive: true });
    writeFileSync(join(mixed, "keep.txt"), "kept");
    for (const [out, says] of [
      [outside, "out-dir must be inside"],
      [mixed, "out-dir holds files but no earlier build"],
    ]) {
      const r = Bun.spawnSync([process.execPath, "tools/build.ts", out], { cwd: ROOT });
      expect(r.exitCode).not.toBe(0);
      expect(r.stderr.toString()).toContain(says);
    }
    expect(existsSync(outside)).toBe(false);
    expect(readFileSync(join(mixed, "keep.txt"), "utf8")).toBe("kept");
  });
});

describe("GitHub Pages", () => {
  test("One workflow publishes: on staging, built by tools/build.ts, dist/ as the site", async () => {
    const dir = join(ROOT, ".github/workflows");
    const deploying = readdirSync(dir).filter((f) => readFileSync(join(dir, f), "utf8").includes("actions/deploy-pages"));
    expect(deploying).toEqual(["pages.yml"]);
    const w = Bun.YAML.parse(readFileSync(join(dir, "pages.yml"), "utf8")) as {
      on: { push: { branches: string[] } };
      permissions: Record<string, string>;
      jobs: {
        build: { steps: { run?: string; uses?: string; with?: { path?: string } }[] };
        deploy: { needs: string; environment: { name: string } };
      };
    };
    expect(w.on.push.branches).toEqual(["staging"]);
    expect(w.permissions).toMatchObject({ pages: "write", "id-token": "write" });
    const runs = w.jobs.build.steps.map((s) => s.run);
    expect(runs.indexOf("bun tools/build.ts")).toBeGreaterThan(runs.indexOf("bun install --frozen-lockfile"));
    expect(runs.indexOf("bun install --frozen-lockfile")).toBeGreaterThanOrEqual(0);
    expect(w.jobs.build.steps.find((s) => s.uses?.startsWith("actions/upload-pages-artifact"))?.with?.path).toBe("dist");
    expect([w.jobs.deploy.needs, w.jobs.deploy.environment.name]).toEqual(["build", "github-pages"]);
  });
});

describe("Static server", () => {
  const get = (path: string) => serveDir(A)(new Request(`http://127.0.0.1${path}`));

  test("/ answers index.html, never kept stale", async () => {
    const r = get("/");
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(r.headers.get("Cache-Control")).toBe("no-cache");
    expect(await r.text()).toBe(page);
  });

  test("Each file with its type; only index.html and sw.js are no-cache", () => {
    const types: Record<string, string> = {
      "index.html": "text/html; charset=utf-8",
      js: "text/javascript; charset=utf-8",
      css: "text/css; charset=utf-8",
      woff2: "font/woff2",
      wav: "audio/wav",
    };
    for (const f of listAll(A)) {
      const r = get(`/${f}`);
      expect(r.status).toBe(200);
      expect(r.headers.get("Content-Type")).toBe(types[f === "index.html" ? f : f.split(".").pop()!]);
      expect(r.headers.get("Cache-Control")).toBe(f === "index.html" || f === "sw.js" ? "no-cache" : null);
    }
  });

  test("Under a path, as on GitHub Pages: the folder without its slash goes on to it; index.html and sw.js no-cache", async () => {
    const sub = (path: string) => serveDir(join(ROOT, "dist-test"))(new Request(`http://127.0.0.1${path}`));
    const moved = sub("/a?x=1");
    expect([moved.status, moved.headers.get("Location")]).toEqual([301, "/a/?x=1"]);
    expect(sub("//a").headers.get("Location")).toBe("/a/");
    const r = sub("/a/");
    expect([r.status, r.headers.get("Cache-Control")]).toEqual([200, "no-cache"]);
    expect(await r.text()).toBe(page);
    expect(sub("/a/sw.js").headers.get("Cache-Control")).toBe("no-cache");
  });

  test("No such file: 404; a path outside the folder: refused", () => {
    expect(get("/nope.js").status).toBe(404);
    expect(get("/assets/").status).toBe(404);
    expect(get("/%2e%2e%2fb%2findex.html").status).toBe(403);
    expect(get("/..%2fb%2findex.html").status).toBe(403);
  });
});
