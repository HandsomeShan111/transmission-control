// Presses on the play area, VIEW-05 and VIEW-08 to VIEW-11, with WIRE-06's lock.
// Found by geometry from the layout, never by the element under the finger.
import { inPort, outPort, param, ref, type InRef, type Port } from "../core/level.ts";
import type { Wire } from "../core/wiring.ts";
import { distance, inSpot, outSpot, ports, spot, track, wireCurve, type InputKind, type Layout, type Point } from "../draw/layout.ts";
import { centreOn, dragBy, edgeVelocity, isSmall, toLevel, zoomAt, type View } from "./view.ts";

export type Hit = { port: Port } | { wire: Wire } | null;

const samePort = (a: Port, b: Port) => a.node === b.node && a.out === b.out && a.i === b.i;

/** VIEW-09: the port whose target holds `p`, the nearer centre in two, the input port when equally near. */
export function portAt(L: Layout, p: Point): Port | null {
  const half = L.target / 2;
  let best: Port | null = null;
  let bestD = Infinity;
  for (const q of ports(L)) {
    const s = spot(L, q);
    if (Math.abs(p.x - s.x) > half || Math.abs(p.y - s.y) > half) continue;
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && best?.out && !q.out)) [best, bestD] = [q, d];
  }
  return best;
}

/** VIEW-09: a port, else the wire laid last within half a port target of `p`, else nothing. */
export function hitTest(L: Layout, wires: Wire[], p: Point): Hit {
  const port = portAt(L, p);
  if (port) return { port };
  let hit: Wire | null = null;
  for (const w of wires) if (distance(track(wireCurve(L, w.from, w.to)), p) <= L.target / 2) hit = w;
  return hit ? { wire: hit } : null;
}

/** VIEW-09: a wire's end nearer `p`; equally near, its input end. */
export function nearerEnd(L: Layout, w: Wire, p: Point): "in" | "out" {
  const a = outSpot(L, w.from);
  const b = inSpot(L, w.to);
  return Math.hypot(p.x - a.x, p.y - a.y) < Math.hypot(p.x - b.x, p.y - b.y) ? "out" : "in";
}

/** A wire being drawn: from a port to the pointer, in level points; `hide`, the wire whose end is picked up. */
export interface DragShow {
  from: Port;
  end: Point;
  hide: InRef | null;
}

export interface GestureHost {
  layout(): Layout;
  view(): View;
  setView(v: View): void;
  /** In the order laid. */
  wires(): Wire[];
  runOn(): boolean;
  /** VIEW-01: the input of a press that starts; the host lays the level out again when it changed. */
  input(kind: InputKind): void;
  start(): Port | null;
  setStart(p: Port | null): void;
  /** WIRE-01. False: no wire. */
  join(a: Port, b: Port): boolean;
  /** WIRE-02. False: the wire stays as it was. */
  move(to: InRef, end: "in" | "out", target: Port): boolean;
  /** WIRE-03. */
  remove(to: InRef): void;
  show(d: DragShow | null): void;
  /** The dragged end goes back to the port it came from, over SpringTime. */
  spring(d: DragShow, back: Point): void;
}

type State =
  | { s: "idle" }
  | { s: "press"; id: number; at: Point; hit: Hit }
  | { s: "pan"; id: number; last: Point }
  | { s: "wire"; id: number; from: Port; at: Point }
  | { s: "end"; id: number; wire: Wire; end: "in" | "out"; at: Point }
  | { s: "pinch"; a: number; b: number; dist: number; mid: Point }
  /** Pointers left over after a pinch or an ended press: they do nothing until all are up. */
  | { s: "dead" };

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Points are in the play area's CSS px, from its top left. */
export class Gesture {
  private state: State = { s: "idle" };
  private pointers = new Map<number, Point>();

  constructor(private host: GestureHost) {}

  /** A drag with a wire's end is under way, for VIEW-08's edge moves. */
  get drawing() {
    return this.state.s === "wire" || this.state.s === "end";
  }

  down(id: number, p: Point, kind: InputKind) {
    this.pointers.set(id, p);
    const st = this.state;
    if (st.s === "idle") {
      this.host.input(kind);
      const h = this.host;
      this.state = { s: "press", id, at: p, hit: hitTest(h.layout(), h.wires(), toLevel(h.view(), p)) };
      return;
    }
    if (st.s === "press" || st.s === "pan" || st.s === "wire" || st.s === "end") {
      // VIEW-10: the second press on the play area; the two zoom.
      const first = this.pointers.get(st.id)!;
      this.endFirst(true);
      this.state = { s: "pinch", a: st.id, b: id, dist: gap(first, p), mid: mid(first, p) };
    }
  }

  move(id: number, p: Point) {
    if (!this.pointers.has(id)) return;
    this.pointers.set(id, p);
    const h = this.host;
    let st = this.state;
    if (st.s === "press" && st.id === id) {
      if (gap(st.at, p) < param("TapDistance")) return;
      st = this.state = this.beginDrag(st);
    }
    if (st.s === "pan" && st.id === id) {
      h.setView(dragBy(h.view(), p.x - st.last.x, p.y - st.last.y));
      st.last = p;
    } else if ((st.s === "wire" || st.s === "end") && st.id === id) {
      st.at = p;
      this.showDrag();
    } else if (st.s === "pinch" && (id === st.a || id === st.b)) {
      const a = this.pointers.get(st.a)!;
      const b = this.pointers.get(st.b)!;
      const m = mid(a, b);
      const d = gap(a, b);
      const v = dragBy(h.view(), m.x - st.mid.x, m.y - st.mid.y);
      h.setView(st.dist > 0 && d > 0 ? zoomAt(v, d / st.dist, m) : v);
      st.dist = d;
      st.mid = m;
    }
  }

  up(id: number, p: Point) {
    if (!this.pointers.has(id)) return;
    this.pointers.set(id, p);
    const st = this.state;
    if (st.s === "press" && st.id === id) this.tap(st);
    else if (st.s === "wire" && st.id === id) this.releaseWire(st, p);
    else if (st.s === "end" && st.id === id) this.releaseEnd(st, p);
    this.release(id);
  }

  /** VIEW-10: the browser cancels a press or drag; it ends with no start chosen. */
  cancel(id: number) {
    if (!this.pointers.has(id)) return;
    const st = this.state;
    if ("id" in st && st.id === id) this.endFirst(false);
    this.release(id);
  }

  /** A pointer of the press or the pinch goes: the rest do nothing until all are up. */
  private release(id: number) {
    const st = this.state;
    if (("id" in st && st.id === id) || (st.s === "pinch" && (st.a === id || st.b === id))) this.state = { s: "dead" };
    this.pointers.delete(id);
    if (!this.pointers.size) this.state = { s: "idle" };
  }

  /** VIEW-10: a second press on a button or a panel. */
  outside() {
    if (!("id" in this.state)) return;
    this.endFirst(true);
    this.state = { s: "dead" };
  }

  /** WIRE-06: a run starts; a wire being laid ends as for no second port. */
  lock() {
    if (!("id" in this.state)) return;
    this.endFirst(false);
    this.state = { s: "dead" };
  }

  /** VIEW-03: the wheel, a trackpad's pinch or scroll. */
  zoom(factor: number, p: Point) {
    const h = this.host;
    h.setView(zoomAt(h.view(), factor, p));
    if (this.drawing) this.showDrag();
  }

  /** VIEW-08: each frame, a wire's end held near the edge moves the view. */
  tick(dt: number) {
    const st = this.state;
    if (st.s !== "wire" && st.s !== "end") return;
    const h = this.host;
    const vel = edgeVelocity(h.view(), st.at);
    if (!vel.x && !vel.y) return;
    h.setView(dragBy(h.view(), vel.x * dt, vel.y * dt));
    this.showDrag();
  }

  private beginDrag(st: { id: number; at: Point; hit: Hit }): State {
    const h = this.host;
    const v = h.view();
    if (st.hit && !h.runOn() && !isSmall(v)) {
      h.setStart(null);
      if ("wire" in st.hit) return { s: "end", id: st.id, wire: st.hit.wire, end: nearerEnd(h.layout(), st.hit.wire, toLevel(v, st.at)), at: st.at };
      const port = st.hit.port;
      const to = ref(port.node, port.i);
      const from = port.out ? undefined : h.wires().find((w) => w.to === to);
      if (from) return { s: "end", id: st.id, wire: from, end: "in", at: st.at };
      return { s: "wire", id: st.id, from: port, at: st.at };
    }
    return { s: "pan", id: st.id, last: st.at };
  }

  /** The port that stays, and the port the dragged end came from. */
  private ends(st: { s: "wire"; from: Port } | { s: "end"; wire: Wire; end: "in" | "out" }) {
    if (st.s === "wire") return { from: st.from, back: st.from, hide: null };
    const out = outPort(st.wire.from);
    const inp = inPort(st.wire.to);
    return st.end === "in" ? { from: out, back: inp, hide: st.wire.to } : { from: inp, back: out, hide: st.wire.to };
  }

  private showDrag() {
    const st = this.state;
    if (st.s !== "wire" && st.s !== "end") return;
    const { from, hide } = this.ends(st);
    this.host.show({ from, end: toLevel(this.host.view(), st.at), hide });
  }

  private springBack(st: { s: "wire"; from: Port; at: Point } | { s: "end"; wire: Wire; end: "in" | "out"; at: Point }) {
    const h = this.host;
    const { from, back, hide } = this.ends(st);
    h.show(null);
    h.spring({ from, end: toLevel(h.view(), st.at), hide }, spot(h.layout(), back));
  }

  /** VIEW-10: the first press ends with no wiring action. */
  private endFirst(mayChoose: boolean) {
    const st = this.state;
    const h = this.host;
    if (st.s === "wire" || st.s === "end") this.springBack(st);
    const port = st.s === "wire" ? st.from : st.s === "press" && st.hit && "port" in st.hit ? st.hit.port : null;
    if (mayChoose && port && !h.runOn() && !isSmall(h.view()) && !h.start()) h.setStart(port);
  }

  private tap(st: { at: Point; hit: Hit }) {
    const h = this.host;
    const v = h.view();
    const port = st.hit && "port" in st.hit ? st.hit.port : null;
    if (port && isSmall(v)) {
      h.setView(centreOn(v, spot(h.layout(), port), 1));
      return;
    }
    if (h.runOn()) return;
    const start = h.start();
    if (!port || !start || samePort(port, start)) {
      h.setStart(port && !start ? port : null);
      return;
    }
    h.join(start, port);
    h.setStart(null);
  }

  private releaseWire(st: { s: "wire"; from: Port; at: Point }, p: Point) {
    const h = this.host;
    st.at = p;
    const v = h.view();
    const target = portAt(h.layout(), toLevel(v, p));
    if (target && !samePort(target, st.from) && isSmall(v)) {
      // VIEW-08: joined while zoomed out; no wire, and the start stays chosen.
      h.show(null);
      h.setView(centreOn(v, spot(h.layout(), target), 1));
      h.setStart(st.from);
      return;
    }
    if (target && h.join(st.from, target)) h.show(null);
    else this.springBack(st);
  }

  private releaseEnd(st: { s: "end"; wire: Wire; end: "in" | "out"; at: Point }, p: Point) {
    const h = this.host;
    st.at = p;
    const v = h.view();
    const target = portAt(h.layout(), toLevel(v, p));
    const { back } = this.ends(st);
    if (target && samePort(target, back)) {
      h.show(null);
      return;
    }
    if (target && isSmall(v)) {
      // VIEW-08 read for a moved end: no wire changes; the view goes to that port.
      h.show(null);
      h.setView(centreOn(v, spot(h.layout(), target), 1));
      return;
    }
    if (!target) {
      h.show(null);
      h.remove(st.wire.to);
      return;
    }
    if (h.move(st.wire.to, st.end, target)) h.show(null);
    else this.springBack(st);
  }
}
