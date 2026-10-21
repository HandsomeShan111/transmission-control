// The share picture, REPORT-07, as Share picture's Layout says: one standalone SVG, and the PNG made from it.
import type { LevelModel } from "../core/level.ts";
import type { Report } from "../core/report.ts";
import type { RunResult } from "../core/run.ts";
import { wireList, type Wiring } from "../core/wiring.ts";
import { layout } from "./layout.ts";
import { drawCards, drawTokens, drawWires, IDLE, restsOf } from "./level.ts";
import { lookVars, num, svgCss } from "./style.ts";
import { line, lineHeight, lines, wrap, type Measure } from "./text.ts";

const W = 1600;
const H = 900;
/** Margins, 4 Units; the level's box; the report column, 4 Units right of the box. */
const M = 32;
const BOX = { w: 1000, h: 773 };
const COL = 504;

export function sharePicture(o: {
  m: LevelModel;
  wiring: Wiring;
  result: RunResult;
  report: Report;
  look: "light" | "dark";
  address: string;
  measure: Measure;
  /** An @font-face rule with the font as a data URL. */
  fontCss: string;
}): string {
  const label = lineHeight("label");
  const top = M + label + 16;
  const L = layout(o.m, "pointer", false);
  const k = Math.min(1, BOX.w / L.width, BOX.h / L.height);
  const x = M + (BOX.w - L.width * k) / 2;
  const y = top + (BOX.h - L.height * k) / 2;
  const level =
    drawCards(L, o.measure, IDLE) + drawWires(L, wireList(o.wiring)) + drawTokens(L, [], restsOf(o.m, o.result), o.measure);
  const cx = M + BOX.w + M;
  let row = top + label + 8;
  const report = o.report.lines.map((l) => {
    const ls = wrap(l, "body", COL, o.measure);
    const s = lines(ls, "body", cx, row);
    row += ls.length * lineHeight("body");
    return s;
  });
  // The foot line is in Label, and Label is in capitals, so the address shows in capitals too.
  const address = o.address.toUpperCase();
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<style>${o.fontCss}svg{${lookVars(o.look)}}${svgCss()}</style>` +
    `<rect width="${W}" height="${H}" style="fill:var(--ground)"/>` +
    line(`LEVEL ${o.m.level.id}`, "label", M, M) +
    `<g transform="translate(${num(x)} ${num(y)})${k < 1 ? ` scale(${+k.toFixed(4)})` : ""}">${level}</g>` +
    line("REPORT", "label", cx, top) +
    report.join("") +
    line(address, "label", W - M - o.measure(address, "label"), H - M - label) +
    `</svg>`
  );
}

/** The picture as a PNG: the SVG loaded into an image, decoded, then drawn on a 1600 × 900 canvas. */
export async function toPng(svg: string, deps: { createImage: () => HTMLImageElement; createCanvas: (w: number, h: number) => HTMLCanvasElement }): Promise<Blob> {
  const img = deps.createImage();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = deps.createCanvas(W, H);
  const g = canvas.getContext("2d");
  if (!g) throw new Error("no 2d canvas for the share picture");
  g.drawImage(img, 0, 0, W, H);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("the canvas made no PNG"))), "image/png"));
}
