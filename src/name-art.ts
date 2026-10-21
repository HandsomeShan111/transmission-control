// The game name artwork, ART-12 and APP-01: TRANSMISSION CONTROL in capitals, its letters
// drawn as straight lines, circles and arcs, ART-01; no text element and no font. The build
// puts it in the page itself, APP-02; the page's style strokes it in Ink.
import { num as n } from "./draw/style.ts";

/** Cap height, line width, letter gap and line gap, in the artwork's own units. */
const H = 60;
const S = 8;
const GAP = 12;
const LEAD = 24;
/** Stems run this far past the cap band, which is clipped, so their ends sit flush. */
const E = 6;

/** A polyline, a circle [cx, cy, r], or an arc [cx, cy, r, from, to] in degrees, clockwise from 3 o'clock. */
type Shape = { p: number[] } | { c: [number, number, number] } | { a: [number, number, number, number, number] };

const stem = (x: number): Shape => ({ p: [x, -E, x, H + E] });
/** A straight line through two points, run E further at the second, and at the first too when `both`. */
function through(x1: number, y1: number, x2: number, y2: number, both = true): Shape {
  const t = E / Math.abs(y2 - y1);
  const [dx, dy] = [(x2 - x1) * t, (y2 - y1) * t];
  return { p: both ? [x1 - dx, y1 - dy, x2 + dx, y2 + dy] : [x1, y1, x2 + dx, y2 + dy] };
}

const GLYPHS: Record<string, { w: number; s: Shape[] }> = {
  T: { w: 44, s: [{ p: [0, S / 2, 44, S / 2] }, stem(22)] },
  R: { w: 42, s: [stem(4), { p: [0, 4, 18, 4] }, { a: [18, 17, 13, -90, 90] }, { p: [18, 30, 4, 30] }, through(18, 30, 36, 60, false)] },
  A: { w: 48, s: [through(4, 60, 24, 0), through(44, 60, 24, 0), { p: [10, 42, 38, 42] }] },
  N: { w: 44, s: [stem(4), stem(40), through(4, 0, 40, 60)] },
  S: { w: 34, s: [{ a: [17, 17, 13, 90, 360] }, { a: [17, 43, 13, -90, 180] }] },
  M: { w: 56, s: [stem(4), stem(52), { p: [4 - (24 / 44) * E, -E, 28, 44, 52 + (24 / 44) * E, -E] }] },
  I: { w: 8, s: [stem(4)] },
  O: { w: 60, s: [{ c: [30, 30, 26] }] },
  C: { w: 52, s: [{ a: [30, 30, 26, 45, 315] }] },
  L: { w: 34, s: [stem(4), { p: [0, 56, 34, 56] }] },
};

const LINES = ["TRANSMISSION", "CONTROL"];

const lineWidth = (word: string) => [...word].reduce((w, ch) => w + GLYPHS[ch].w, 0) + GAP * (word.length - 1);

function shape(sh: Shape, dx: number, dy: number): string {
  if ("p" in sh) {
    const pts = sh.p.map((v, i) => n(v + (i % 2 ? dy : dx)));
    return `<path d="M${pts.slice(0, 2).join(" ")}L${pts.slice(2).join(" ")}"/>`;
  }
  if ("c" in sh) return `<circle cx="${n(sh.c[0] + dx)}" cy="${n(sh.c[1] + dy)}" r="${n(sh.c[2])}"/>`;
  const [cx, cy, r, from, to] = sh.a;
  const at = (deg: number) => `${n(cx + dx + r * Math.cos((deg * Math.PI) / 180))} ${n(cy + dy + r * Math.sin((deg * Math.PI) / 180))}`;
  return `<path d="M${at(from)}A${n(r)} ${n(r)} 0 ${to - from > 180 ? 1 : 0} 1 ${at(to)}"/>`;
}

/** The artwork as inline SVG; it scales to the width it is given. */
export function nameArt(): string {
  const width = Math.max(...LINES.map(lineWidth));
  const height = LINES.length * H + (LINES.length - 1) * LEAD;
  let body = "";
  let clip = "";
  LINES.forEach((word, i) => {
    const y = i * (H + LEAD);
    let x = (width - lineWidth(word)) / 2;
    clip += `<rect x="0" y="${y}" width="${width}" height="${H}"/>`;
    for (const ch of word) {
      body += GLYPHS[ch].s.map((sh) => shape(sh, x, y)).join("");
      x += GLYPHS[ch].w + GAP;
    }
  });
  return (
    `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Transmission Control">` +
    `<clipPath id="name-band">${clip}</clipPath>` +
    `<g clip-path="url(#name-band)" fill="none" stroke-width="${S}">${body}</g></svg>`
  );
}
