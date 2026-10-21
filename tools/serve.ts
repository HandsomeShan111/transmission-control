// Serves the built game as a static host would, for test sites: index.html and sw.js never kept
// stale, APP-04. Run: PORT=<port> [HOST=<host>] bun tools/serve.ts [dir], default dist. Built into
// dir/transmission-control, the game opens under that path, as on GitHub Pages.
import { statSync } from "node:fs";
import { basename, extname, join, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".wav": "audio/wav",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};

const isDir = (p: string) => statSync(p, { throwIfNoEntry: false })?.isDirectory() ?? false;
const isFile = (p: string) => statSync(p, { throwIfNoEntry: false })?.isFile() ?? false;
const notFound = () => new Response("Not found", { status: 404 });

/** Answers a request from the files under `dir`: 403 for a path outside it, 404 for no such file. */
export function serveDir(dir: string) {
  const root = resolve(dir);
  return (req: Request): Response => {
    let file: string;
    try {
      const { pathname: path, search } = new URL(req.url);
      file = resolve(root, "." + decodeURIComponent(path));
      if (file !== root && !file.startsWith(root + sep)) return new Response("Forbidden", { status: 403 });
      // A folder without its slash goes on to it, as GitHub Pages does, so relative URLs resolve inside it.
      // One leading slash only: "//name" would send the browser to another host.
      if (isDir(file) && !path.endsWith("/")) return new Response(null, { status: 301, headers: { Location: path.replace(/^\/+/, "/") + "/" + search } });
      if (isDir(file)) file = join(file, "index.html");
      if (!isFile(file)) return notFound();
    } catch {
      // A malformed or impossible path.
      return notFound();
    }
    const headers: Record<string, string> = { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" };
    if (["index.html", "sw.js"].includes(basename(file))) headers["Cache-Control"] = "no-cache";
    return new Response(Bun.file(file), { headers });
  };
}

if (import.meta.main) {
  const port = process.env.PORT;
  if (!port) {
    console.error("PORT is not set");
    process.exit(1);
  }
  const dir = resolve(process.argv[2] ?? join(import.meta.dir, "../dist"));
  if (!isDir(dir)) {
    console.error(`no such folder: ${dir}`);
    process.exit(1);
  }
  const server = Bun.serve({ port: Number(port), hostname: process.env.HOST || "127.0.0.1", fetch: serveDir(dir) });
  console.log(`serving ${dir} at ${server.url}`);
}
