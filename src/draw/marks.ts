// Item marks, port marks, emblems and lamps, drawn from shapes: ART-01 to ART-07, UI style's Lamp.
import type { PortKind } from "../content/types.ts";
import { C, num } from "./style.ts";

export const KIND_COLOR: Record<PortKind, string> = { data: C.blue, positive: C.yellow, negative: C.red };
/** ART-03: data solid, positive dashed, negative dotted: 2 px dashes at Line width read as square dots. */
export const KIND_DASH: Record<PortKind, string | null> = { data: null, positive: "8 5", negative: "2 4" };

type P = [number, number];
/** A part of a filled path, in the mark's own units; a hole cuts the parts under it. */
type Shape = ["poly", P[], boolean] | ["circle", number, number, number, boolean];

const poly = (...p: P[]): Shape => ["poly", p, false];
const rect = (x: number, y: number, w: number, h: number) => poly([x, y], [x + w, y], [x + w, y + h], [x, y + h]);
const circle = (cx: number, cy: number, r: number): Shape => ["circle", cx, cy, r, false];
const hole = (s: Shape): Shape => (s[0] === "poly" ? ["poly", s[1], true] : ["circle", s[1], s[2], s[3], true]);
/** Rings: the shape and its hole a Line in. */
const ring = (cx: number, cy: number, r: number) => [circle(cx, cy, r), hole(circle(cx, cy, r - 2))];
const box = (x: number, y: number, s: number) => [rect(x, y, s, s), hole(rect(x + 2, y + 2, s - 4, s - 4))];

/** A triangle ring: the hole is the triangle scaled about its incentre. */
function tri(a: P, b: P, c: P): Shape[] {
  const side = (p: P, q: P) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const [la, lb, lc] = [side(b, c), side(c, a), side(a, b)];
  const per = la + lb + lc;
  const inc: P = [(la * a[0] + lb * b[0] + lc * c[0]) / per, (la * a[1] + lb * b[1] + lc * c[1]) / per];
  const r = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / per;
  const k = (r - 2) / r;
  const s = (p: P): P => [inc[0] + (p[0] - inc[0]) * k, inc[1] + (p[1] - inc[1]) * k];
  return [poly(a, b, c), hole(poly(s(a), s(b), s(c)))];
}

/** Parts wound one way and holes the other, so the nonzero rule joins parts and cuts holes. */
function path(shapes: Shape[], x: number, y: number, k: number): string {
  const X = (v: number) => num(x + v * k);
  const Y = (v: number) => num(y + v * k);
  return shapes
    .map((s) => {
      if (s[0] === "circle") {
        const [, cx, cy, rr, h] = s;
        const r = num(rr * k);
        const sweep = h ? 0 : 1;
        return `M${X(cx - rr)} ${Y(cy)}A${r} ${r} 0 1 ${sweep} ${X(cx + rr)} ${Y(cy)}A${r} ${r} 0 1 ${sweep} ${X(cx - rr)} ${Y(cy)}Z`;
      }
      const [, ps, h] = s;
      const area = ps.reduce((sum, p, i) => sum + p[0] * ps[(i + 1) % ps.length][1] - ps[(i + 1) % ps.length][0] * p[1], 0);
      const ordered = area > 0 === !h ? ps : ps.slice().reverse();
      return `M${ordered.map((p) => `${X(p[0])} ${Y(p[1])}`).join("L")}Z`;
    })
    .join("");
}

const fill = (shapes: Shape[], x: number, y: number, k: number, color: string, attrs = "") => `<path${attrs} d="${path(shapes, x, y, k)}" style="fill:${color}"/>`;

/**
 * ART-05: one mark per value, by property then value, in a 10 unit square.
 * Length: a bar, short to long. Tone: solid shapes, sharp to round. Format:
 * three rows, text, list and bars. Language: rings, round, boxed and odd.
 * The densest marks, text, list and chart, are three 2 px lines with 2 px between.
 */
const ITEM: Shape[][][] = [
  [[rect(0, 4, 4, 2)], [rect(0, 4, 7, 2)], [rect(0, 4, 10, 2)]],
  [[poly([0, 0], [10, 0], [5, 10])], [rect(1, 1, 8, 8)], [circle(5, 5, 5)]],
  [
    [rect(0, 0, 10, 2), rect(0, 4, 10, 2), rect(0, 8, 6, 2)],
    [0, 4, 8].flatMap((y) => [rect(0, y, 2, 2), rect(4, y, 6, 2)]),
    [rect(0, 6, 2, 4), rect(4, 3, 2, 7), rect(8, 0, 2, 10)],
  ],
  [ring(5, 5, 5), box(0, 0, 10), tri([5, 0], [10, 10], [0, 10])],
];

/** An item mark, top-left at (x, y), MarkSize unless `size` says. */
export const itemMark = (prop: number, v: number, x: number, y: number, size = 10) => fill(ITEM[prop][v], x, y, size / 10, C.ink);

/** ART-03: the kind's shape, PortMarkSize, solid in its colour, centred on (cx, cy). */
export function portMark(kind: PortKind, cx: number, cy: number): string {
  const h = 7 * Math.sqrt(3);
  const s = kind === "data" ? [circle(7, 7, 7)] : kind === "positive" ? [poly([7, 7 - h / 2], [14, 7 + h / 2], [0, 7 + h / 2])] : [rect(0, 0, 14, 14)];
  return fill(s, cx - 7, cy - 7, 1, KIND_COLOR[kind], ` class="port"`);
}

/** ART-07: each kind's emblem in a 24 px square: its parts in Ink, and in Muted or Dim. */
const EMBLEM: Record<string, [Shape[], Shape[]?, string?]> = {
  // Squeezed in from both sides.
  Summarizer: [[poly([0, 4], [9, 12], [0, 20]), poly([24, 4], [15, 12], [24, 20]), rect(11, 4, 2, 16)]],
  // Pushed out to both sides.
  Padder: [[poly([9, 4], [0, 12], [9, 20]), poly([15, 4], [24, 12], [15, 20]), rect(11, 4, 2, 16)]],
  // A flag of truce.
  Diplomat: [[rect(3, 1, 2, 23), ...box(5, 1, 12)]],
  // A loudspeaker.
  "Straight Talker": [[rect(0, 8, 6, 8), poly([2, 12], [15, 2], [15, 22]), rect(18, 5, 6, 2), rect(18, 11, 6, 2), rect(18, 17, 6, 2)]],
  // A chart of squares, rising.
  Analyst: [[rect(0, 18, 6, 6), rect(9, 18, 6, 6), rect(9, 10, 6, 6), rect(18, 18, 6, 6), rect(18, 10, 6, 6), rect(18, 2, 6, 6)]],
  // Lines of verse.
  Poet: [[rect(2, 3, 20, 2), rect(6, 9, 12, 2), rect(2, 15, 20, 2), rect(6, 21, 12, 2)]],
  // Scales.
  Lawyer: [[rect(1, 4, 22, 2), rect(11, 2, 2, 19), rect(6, 21, 12, 2), rect(3, 6, 2, 7), rect(19, 6, 2, 7), poly([0, 13], [8, 13], [4, 18]), poly([16, 13], [24, 13], [20, 18])]],
  // The alien ring to the English one.
  Translator: [[poly([9, 13], [13, 13], [13, 9]), ...ring(18, 18, 6)], tri([5.5, 0], [11, 10], [0, 10]), C.muted],
  // An eye.
  Inspector: [[...ring(12, 12, 7), circle(12, 12, 2.5), rect(0, 11, 4, 2), rect(20, 11, 4, 2)]],
  // A stamp over its print.
  "Rubber Stamp": [[circle(12, 4, 3), rect(11, 7, 2, 5), rect(4, 12, 16, 2), rect(2, 15, 20, 2)], [rect(4, 21, 16, 2)], C.dim],
  // Work handed down.
  Manager: [[rect(8, 0, 8, 8), rect(11, 8, 2, 4), rect(2, 12, 20, 2), rect(2, 14, 2, 4), rect(11, 14, 2, 4), rect(20, 14, 2, 4), rect(0, 18, 6, 6), rect(9, 18, 6, 6), rect(18, 18, 6, 6)]],
  // A sheet into a slot, and strips out.
  Shredder: [[...box(7, 0, 10), rect(0, 11, 24, 2)], [rect(7, 15, 2, 9), rect(11, 15, 2, 9), rect(15, 15, 2, 9)], C.muted],
};

export function emblem(kind: string, x: number, y: number): string {
  const e = EMBLEM[kind];
  if (!e) throw new Error(`no emblem for ${kind}`);
  return fill(e[0], x, y, 1, C.ink) + (e[1] ? fill(e[1], x, y, 1, e[2]!) : "");
}

/** UI style's Lamp: a MarkSize circle with a Line frame. */
export function lamp(state: "lit" | "unlit" | "unlocked" | "locked", cx: number, cy: number): string {
  const frame = state === "lit" || state === "unlocked" ? C.ink : C.dim;
  const c = `<circle cx="${num(cx)}" cy="${num(cy)}" r="4" stroke-width="2" style="fill:${state === "lit" ? C.ink : "none"};stroke:${frame}"/>`;
  if (state !== "locked") return c;
  return c + `<line x1="${num(cx - 4.3)}" y1="${num(cy + 4.3)}" x2="${num(cx + 4.3)}" y2="${num(cy - 4.3)}" stroke-width="2" style="stroke:${C.dim}"/>`;
}
