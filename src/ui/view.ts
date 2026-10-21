// The play area's view of the level: zoom and position, VIEW-02 to VIEW-08.
import { param } from "../core/level.ts";
import { GAPS, PLACE_H, PLACE_W, type Layout, type Point } from "../draw/layout.ts";

export interface View {
  /** The play area's size, CSS px. */
  w: number;
  h: number;
  /** The level's size at full size. */
  lw: number;
  lh: number;
  zoom: number;
  /** Where the level's top left sits in the play area. */
  x: number;
  y: number;
}

/** VIEW-02: full size, or the largest zoom below it at which the whole level fits. */
export const minZoom = (v: View) => Math.min(1, v.w / v.lw, v.h / v.lh);

/** VIEW-03 and VIEW-04: zoom within its limits; each axis centred where the level fits, else edge to edge at most. */
function clamp(v: View): View {
  const zoom = Math.min(Math.max(v.zoom, minZoom(v)), param("ZoomMax"));
  const axis = (pos: number, area: number, size: number) => (size <= area + 1e-6 ? (area - size) / 2 : Math.min(0, Math.max(area - size, pos)));
  return { ...v, zoom, x: axis(v.x, v.w, v.lw * zoom), y: axis(v.y, v.h, v.lh * zoom) };
}

/** VIEW-02. */
export const openView = (w: number, h: number, L: Layout): View => clamp({ w, h, lw: L.width, lh: L.height, zoom: 0, x: 0, y: 0 });

export const toLevel = (v: View, p: Point): Point => ({ x: (p.x - v.x) / v.zoom, y: (p.y - v.y) / v.zoom });
export const toScreen = (v: View, p: Point): Point => ({ x: v.x + p.x * v.zoom, y: v.y + p.y * v.zoom });

/** Below full size, VIEW-05. */
export const isSmall = (v: View) => v.zoom < 1 - 1e-6;

/** VIEW-03: scales by `factor` about the play area point `p`. */
export function zoomAt(v: View, factor: number, p: Point): View {
  const zoom = Math.min(Math.max(v.zoom * factor, minZoom(v)), param("ZoomMax"));
  const l = toLevel(v, p);
  return clamp({ ...v, zoom, x: p.x - l.x * zoom, y: p.y - l.y * zoom });
}

/** VIEW-04. */
export const dragBy = (v: View, dx: number, dy: number): View => clamp({ ...v, x: v.x + dx, y: v.y + dy });

/** The level point `l` at the play area's centre, as far as VIEW-04 lets it. */
export const centreOn = (v: View, l: Point, zoom = v.zoom): View => clamp({ ...v, zoom, x: v.w / 2 - l.x * zoom, y: v.h / 2 - l.y * zoom });

/** A level point as columns and rows of places, in the level's own orientation. */
function gridOf(L: Layout, p: Point) {
  const g = GAPS[L.input];
  const a = p.x / (PLACE_W + g.x);
  const d = p.y / (PLACE_H + g.y);
  return L.turned ? { col: d, row: a } : { col: a, row: d };
}

function pointOf(L: Layout, g: { col: number; row: number }): Point {
  const s = GAPS[L.input];
  const [a, d] = L.turned ? [g.row, g.col] : [g.col, g.row];
  return { x: a * (PLACE_W + s.x), y: d * (PLACE_H + s.y) };
}

/**
 * VIEW-06, and VIEW-01's change of input: the new play area and layout keep the
 * level point at the centre and the zoom, within VIEW-03's limits.
 */
export function refit(v: View, from: Layout, to: Layout, w: number, h: number): View {
  const c = pointOf(to, gridOf(from, toLevel(v, { x: v.w / 2, y: v.h / 2 })));
  return centreOn({ ...v, w, h, lw: to.width, lh: to.height }, c);
}

/** VIEW-08: the level's move per second while a wire's end is held at `p`, within EdgeZone of an edge. */
export function edgeVelocity(v: View, p: Point): Point {
  const zone = param("EdgeZone");
  const speed = param("EdgeSpeed");
  const axis = (q: number, size: number) => (q < zone ? speed : q > size - zone ? -speed : 0);
  return { x: axis(p.x, v.w), y: axis(p.y, v.h) };
}
