// Builds the game into a static folder, APP-02 and APP-03: index.html and sw.js, the only names
// with no hash, and every other file under assets/ with its content hash. Every URL is relative,
// so the folder works from any sub-folder of any static host. Checks FirstLoad.
// Run: bun tools/build.ts [out-dir], default dist.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { PARAMS } from "../src/content/generated.ts";
import { lookVars } from "../src/draw/style.ts";
import { nameArt } from "../src/name-art.ts";
import { SAVE_KEY } from "../src/shell/storage.ts";
import { synthesize } from "./synth.ts";

const ROOT = resolve(import.meta.dir, "..");
const FONT = join(ROOT, "node_modules/@fontsource-variable/jost/files/jost-latin-wght-normal.woff2");
const out = resolve(process.argv[2] ?? join(ROOT, "dist"));

const rel = relative(ROOT, out);
if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`out-dir must be inside ${ROOT}: ${out}`);
if (existsSync(out) && readdirSync(out).length && !existsSync(join(out, "sw.js"))) throw new Error(`out-dir holds files but no earlier build: ${out}`);
// MEAS-03: the count service's address, https only; unset, the counts wait in the save.
const COUNTS = process.env.TC_COUNTS_ADDRESS ?? "";
if (COUNTS && URL.parse(COUNTS)?.protocol !== "https:") throw new Error(`TC_COUNTS_ADDRESS must be an https address: ${COUNTS}`);
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "assets"), { recursive: true });

const hash = (b: Uint8Array | string) => new Bun.CryptoHasher("sha256").update(b).digest("hex").slice(0, 8);
async function bundle(config: Parameters<typeof Bun.build>[0]) {
  const r = await Bun.build(config);
  if (!r.success) throw new AggregateError(r.logs, `bundle failed: ${config.entrypoints.join(", ")}`);
  return r;
}
function put(name: string, bytes: Uint8Array) {
  writeFileSync(join(out, name), bytes);
  return name;
}

const font = readFileSync(FONT);
const assets = {
  font: put(`assets/jost-${hash(font)}.woff2`, font),
  sounds: Object.fromEntries(synthesize().map((s) => [s.name, put(`assets/${s.name}-${hash(s.wav)}.wav`, s.wav)])),
};

const main = await bundle({
  entrypoints: [join(ROOT, "src/main.ts")],
  outdir: join(out, "assets"),
  naming: { entry: "[name]-[hash].[ext]", chunk: "[name]-[hash].[ext]", asset: "[name]-[hash].[ext]" },
  minify: true,
  target: "browser",
  format: "esm",
  define: { __ASSETS__: JSON.stringify(assets), __COUNTS__: JSON.stringify(COUNTS) },
});
const built = main.outputs.map((o) => relative(out, o.path));
const script = main.outputs.filter((o) => o.kind === "entry-point").map((o) => relative(out, o.path));
if (script.length !== 1) throw new Error(`expected one script, got: ${built.join(", ")}`);

const look = PARAMS.LookStart.value;
if (look !== "light" && look !== "dark") throw new Error(`LookStart: ${look}`);
const colors = (["light", "dark"] as const)
  .map((l) => `:root[data-look=${l}]{color-scheme:${l};${lookVars(l)}}`)
  .join("\n");
const fill: Record<string, string> = {
  SAVE_KEY,
  LOOK_START: look,
  COLORS: colors,
  NAME_ART: nameArt(),
  STYLES: built.filter((f) => f.endsWith(".css")).map((f) => `<link rel="stylesheet" href="${f}">`).join("\n"),
  SCRIPT: script[0],
};
const used = new Set<string>();
const page = readFileSync(join(ROOT, "src/index.html"), "utf8").replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
  if (!(k in fill)) throw new Error(`src/index.html: no value for {{${k}}}`);
  used.add(k);
  return fill[k];
});
for (const k of Object.keys(fill)) if (!used.has(k)) throw new Error(`src/index.html: no {{${k}}}`);
put("index.html", new TextEncoder().encode(page));

// The version changes whenever any file does: the page by its content, the rest by their hashed names.
const files = ["index.html", ...[assets.font, ...Object.values(assets.sounds), ...built].sort()];
const version = hash(page + "\n" + files.join("\n"));
await bundle({
  entrypoints: [join(ROOT, "src/sw.ts")],
  outdir: out,
  naming: "sw.js",
  minify: true,
  target: "browser",
  format: "esm",
  define: { __VERSION__: JSON.stringify(version), __FILES__: JSON.stringify(files) },
});

// APP-02: everything but the sounds and music arrives before the first level, within FirstLoad.
const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`.padStart(9);
let total = 0;
for (const f of ["index.html", "sw.js", ...files.slice(1)]) {
  const bytes = readFileSync(join(out, f));
  const gz = Bun.gzipSync(bytes).length;
  if (!f.endsWith(".wav")) total += gz;
  console.log(`${kb(statSync(join(out, f)).size)} ${kb(gz)} gzip  ${f}`);
}
const limit = Number(PARAMS.FirstLoad.value) * 1000;
console.log(`FirstLoad: ${kb(total).trim()} gzip, all but the sounds and music; limit ${limit / 1000} kB. Version ${version}.`);
if (total > limit) {
  console.error(`FirstLoad passed: ${total} > ${limit} bytes`);
  process.exit(1);
}
