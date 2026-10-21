// Where a level's places, ports and wires sit at full size: Play's Layout, VIEW-01, VIEW-07, ART-08.
import { inPort, outPort, param, type InRef, type LevelModel, type OutRef, type Port } from "../core/level.ts";

/** The input of the last press, VIEW-01. */
export type InputKind = "touch" | "pointer";

export interface Point {
  x: number;
  y: number;
}

export interface Box extends Point {
  w: number;
  h: number;
}

export type Edge = "left" | "right" | "top" | "bottom";

/** A port's centre, on its card's edge. */
export interface Spot extends Point {
  edge: Edge;
}

export const PLACE_W = 150;
export const PLACE_H = 132;
/** Room between places, across and down, Play's Layout. */
export const GAPS: Record<InputKind, { x: number; y: number }> = { pointer: { x: 56, y: 32 }, touch: { x: 40, y: 24 } };

export interface Layout {
  m: LevelModel;
  input: InputKind;
  /** VIEW-07: the level's column c and row r shown in row c and column r. */
  turned: boolean;
  /** The level's size at full size. */
  width: number;
  height: number;
  /** A port target's side, PortTouch or PortPointer. */
  target: number;
  /** Each node's place, by node index. */
  boxes: Box[];
}

export function layout(m: LevelModel, input: InputKind, turned: boolean): Layout {
  const g = GAPS[input];
  const across = turned ? m.rows : m.cols;
  const down = turned ? m.cols : m.rows;
  const boxes = m.nodes.map((n) => {
    const c = turned ? n.row : n.col;
    const r = turned ? n.col : n.row;
    return { x: c * (PLACE_W + g.x), y: r * (PLACE_H + g.y), w: PLACE_W, h: PLACE_H };
  });
  return {
    m,
    input,
    turned,
    width: across * PLACE_W + (across - 1) * g.x,
    height: down * PLACE_H + (down - 1) * g.y,
    target: param(input === "touch" ? "PortTouch" : "PortPointer"),
    boxes,
  };
}

/** A port's centre: the i-th of n on its edge at (i − ½) / n of the edge's length. */
export function spot(L: Layout, p: Port): Spot {
  const b = L.boxes[p.node];
  const n = L.m.nodes[p.node];
  const f = (p.i + 0.5) / (p.out ? n.outputs : n.inputs).length;
  if (L.turned) return { x: b.x + f * b.w, y: p.out ? b.y + b.h : b.y, edge: p.out ? "bottom" : "top" };
  return { x: p.out ? b.x + b.w : b.x, y: b.y + f * b.h, edge: p.out ? "right" : "left" };
}

export const inSpot = (L: Layout, r: InRef) => spot(L, inPort(r));
export const outSpot = (L: Layout, r: OutRef) => spot(L, outPort(r));

/** Every port of the level, input ports first. */
export function ports(L: Layout): Port[] {
  return L.m.nodes.flatMap((n, node) => [
    ...n.inputs.map((_, i) => ({ node, out: false, i })),
    ...n.outputs.map((_, i) => ({ node, out: true, i })),
  ]);
}

const NORMAL: Record<Edge, Point> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };

/** A cubic curve: start, two controls, end. */
export type Cubic = [Point, Point, Point, Point];
/** Cubics joined end to start: the start, then two controls and an end for each. */
export type Curve = Point[];

/** Least reach of a wire's controls, so a short wire still leaves square. */
const REACH = 24;
/** How far a loop runs out across, for ports facing away and less than REACH apart across, so the wire never folds flat on itself. */
const LOOP = 2 * REACH;

/**
 * ART-08: one smooth curve, leaving the output port and entering the input
 * port square to their edges. Ports facing away loop out from both edges.
 */
export function wireCurve(L: Layout, from: OutRef, to: InRef): Curve {
  const a = outSpot(L, from);
  const b = inSpot(L, to);
  const na = NORMAL[a.edge];
  const nb = NORMAL[b.edge];
  const span = L.turned ? b.y - a.y : b.x - a.x;
  if (span < 0 && Math.abs(L.turned ? b.x - a.x : b.y - a.y) < REACH) return loop(L, a, b, na);
  const d = Math.max(Math.abs(span) / 2, REACH);
  return [a, { x: a.x + na.x * d, y: a.y + na.y * d }, { x: b.x + nb.x * d, y: b.y + nb.y * d }, b];
}

/** Out of a, round to a run back past b, round into b: on the side toward the level's middle. */
function loop(L: Layout, a: Point, b: Point, u: Point): Curve {
  const across = L.turned ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const side = (L.turned ? a.x < L.width / 2 : a.y < L.height / 2) ? 1 : -1;
  const v = { x: across.x * side, y: across.y * side };
  const at = (p: Point, s: number, t: number) => ({ x: p.x + u.x * s + v.x * t, y: p.y + u.y * s + v.y * t });
  const off = (b.x - a.x) * v.x + (b.y - a.y) * v.y;
  const ra = LOOP + Math.max(off, 0);
  const rb = LOOP + Math.max(-off, 0);
  const line = (p: Point, q: Point) => [{ x: p.x + (q.x - p.x) / 3, y: p.y + (q.y - p.y) / 3 }, { x: p.x + ((q.x - p.x) * 2) / 3, y: p.y + ((q.y - p.y) * 2) / 3 }, q];
  const [a1, a2, b2, b1] = [at(a, REACH, 0), at(a, REACH, ra), at(b, -REACH, rb), at(b, -REACH, 0)];
  return [
    a,
    ...line(a, a1),
    at(a, REACH + (ra * 2) / 3, 0),
    at(a, REACH + (ra * 2) / 3, ra),
    a2,
    ...line(a2, b2),
    at(b, -REACH - (rb * 2) / 3, rb),
    at(b, -REACH - (rb * 2) / 3, 0),
    b1,
    ...line(b1, b),
  ];
}

/** The cubics of a curve. */
const pieces = (c: Curve): Cubic[] => Array.from({ length: (c.length - 1) / 3 }, (_, i) => c.slice(i * 3, i * 3 + 4) as Cubic);

export function cubicAt(c: Cubic, t: number): Point {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return { x: w.reduce((s, k, i) => s + k * c[i].x, 0), y: w.reduce((s, k, i) => s + k * c[i].y, 0) };
}

export const cubicPath = (c: Curve) => `M${c[0].x} ${c[0].y}C${c.slice(1).map((p) => `${p.x} ${p.y}`).join(" ")}`;

/** A curve as a polyline with each point's distance along it. */
export interface Track {
  points: Point[];
  at: number[];
  length: number;
}

export function track(c: Curve, steps = 48): Track {
  const points = [c[0], ...pieces(c).flatMap((p) => Array.from({ length: steps }, (_, i) => cubicAt(p, (i + 1) / steps)))];
  const at = [0];
  for (let i = 1; i < points.length; i++) at.push(at[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return { points, at, length: at[at.length - 1] };
}

/** ART-09: the point a fraction of the way along, by distance, so a token moves at a constant speed. */
export function along(t: Track, f: number): Point {
  const d = Math.min(Math.max(f, 0), 1) * t.length;
  let i = 1;
  while (i < t.at.length - 1 && t.at[i] < d) i++;
  const span = t.at[i] - t.at[i - 1] || 1;
  const k = (d - t.at[i - 1]) / span;
  const p = t.points[i - 1];
  const q = t.points[i];
  return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
}

/** The least distance from a point to a polyline. */
export function distance(t: Track, p: Point): number {
  let best = Infinity;
  for (let i = 1; i < t.points.length; i++) best = Math.min(best, segment(t.points[i - 1], t.points[i], p));
  return best;
}

function segment(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const k = len ? Math.min(Math.max(((p.x - a.x) * dx + (p.y - a.y) * dy) / len, 0), 1) : 0;
  return Math.hypot(a.x + k * dx - p.x, a.y + k * dy - p.y);
}
