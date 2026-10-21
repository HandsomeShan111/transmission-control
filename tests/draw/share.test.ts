// The share picture: REPORT-07, Share picture's Layout.
import { expect, test } from "bun:test";
import { report } from "../../src/core/report.ts";
import { run } from "../../src/core/run.ts";
import { layout } from "../../src/draw/layout.ts";
import { sharePicture, toPng } from "../../src/draw/share.ts";
import { esc, stubMeasure } from "../../src/draw/text.ts";
import { fromChecks } from "../core/helpers.ts";

function picture(id: number, which: string, look: "light" | "dark" = "light") {
  const { m, w } = fromChecks(id, which);
  const result = run(m, w);
  const rep = report(m, result);
  const svg = sharePicture({ m, wiring: w, result, report: rep, look, address: "transmission.example/play", measure: stubMeasure, fontCss: "@font-face{font-family:Jost}" });
  return { m, rep, svg };
}

test("1600 × 900 on Ground, the level's name, the report's words, the address", () => {
  const { rep, svg } = picture(16, "Dropped");
  expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">');
  expect(svg).toContain('<rect width="1600" height="900" style="fill:var(--ground)"/>');
  expect(svg).toContain(">LEVEL 16</text>");
  expect(svg).toContain(">REPORT</text>");
  expect(rep.lines.length).toBeGreaterThan(1);
  const words = [...svg.matchAll(/<text class="t-body"[^>]*>([^<]*)<\/text>/g)].map((x) => x[1]).join(" ");
  for (const l of rep.lines) for (const word of l.split(" ").filter(Boolean)) expect(words).toContain(esc(word));
  expect(svg).toContain(">TRANSMISSION.EXAMPLE/PLAY</text>");
  expect(svg).toEndWith("</svg>");
});

test("standalone: the font, the look's colours and the text classes in its own style", () => {
  const light = picture(16, "solution").svg;
  expect(light).toContain("<style>@font-face{font-family:Jost}svg{--ground:#EFEBE1;");
  expect(light).toContain(".t-label{font-family:Jost");
  expect(picture(16, "solution", "dark").svg).toContain("--red:#E04A2F;");
  // Colour literals only in the look's variables.
  expect(light.replace(/svg\{[^}]*\}/, "")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
});

test("level 16 at pointer size fits the box unscaled, centred in it", () => {
  const { m, svg } = picture(16, "Dropped");
  const L = layout(m, "pointer", false);
  expect([L.width, L.height]).toEqual([974, 460]);
  // Box: 1000 × 773 from (32, 32 + 15.6 + 16).
  expect(svg).toContain('<g transform="translate(45 220.1)">');
  expect(svg).not.toContain("scale(");
});

test("the run's rests drawn, no copy moving, no card working", () => {
  const { svg } = picture(16, "Dropped");
  expect(svg).toContain('class="token"');
  expect(svg).not.toContain("fill:var(--face);stroke:var(--ink)");
  expect(svg).not.toContain(" / 200<");
});

test("the address at the right margin, its line on the bottom margin", () => {
  const { svg } = picture(16, "Dropped");
  const a = "TRANSMISSION.EXAMPLE/PLAY";
  const [, x, y] = svg.match(new RegExp(`<text class="t-label" x="([\\d.]+)" y="([\\d.]+)">${a}</text>`))!;
  expect(+x + stubMeasure(a, "label")).toBeCloseTo(1568);
  expect(+y).toBeCloseTo(900 - 32 - 15.6 + (15.6 + 9.1) / 2);
});

test("toPng: the SVG as a data URL, decoded, drawn at 1600 × 900, made a PNG", async () => {
  const calls: string[] = [];
  const img = { src: "", decode: async () => void calls.push("decode") } as unknown as HTMLImageElement;
  const png = new Blob(["png"], { type: "image/png" });
  const canvas = {
    getContext: (k: string) => (calls.push(`ctx ${k}`), { drawImage: (_: unknown, x: number, y: number, w: number, h: number) => void calls.push(`draw ${x} ${y} ${w} ${h}`) }),
    toBlob: (cb: (b: Blob | null) => void, type: string) => (calls.push(`blob ${type}`), cb(png)),
  } as unknown as HTMLCanvasElement;
  const out = await toPng("<svg>#</svg>", { createImage: () => img, createCanvas: (w, h) => (calls.push(`canvas ${w} ${h}`), canvas) });
  expect(out).toBe(png);
  expect(img.src).toBe("data:image/svg+xml;charset=utf-8,%3Csvg%3E%23%3C%2Fsvg%3E");
  expect(calls).toEqual(["decode", "canvas 1600 900", "ctx 2d", "draw 0 0 1600 900", "blob image/png"]);
  const none = { toBlob: (cb: (b: Blob | null) => void) => cb(null), getContext: () => ({ drawImage() {} }) } as unknown as HTMLCanvasElement;
  expect(toPng("<svg/>", { createImage: () => img, createCanvas: () => none })).rejects.toThrow("no PNG");
});
