// VIEW-05 and VIEW-08 to VIEW-11, and WIRE-06's lock, on a stand-in screen.
import { expect, test } from "bun:test";
import { ref, type LevelModel, type Port } from "../../src/core/level.ts";
import { join, move, newWiring, remove, wireList, type Wiring } from "../../src/core/wiring.ts";
import { layout, spot, type InputKind, type Layout, type Point } from "../../src/draw/layout.ts";
import { Gesture, hitTest, portAt, type DragShow } from "../../src/ui/gesture.ts";
import { centreOn, openView, toScreen, type View } from "../../src/ui/view.ts";
import { model, port, wires } from "../core/helpers.ts";

class Screen {
  L: Layout;
  v: View;
  w: Wiring;
  running = false;
  chosen: Port | null = null;
  shown: DragShow | null = null;
  springs: { d: DragShow; back: Point }[] = [];
  sounds: string[] = [];
  inputs: InputKind[] = [];
  g: Gesture;

  constructor(
    readonly m: LevelModel,
    w = 1888,
    h = 924,
    kind: InputKind = "pointer",
  ) {
    this.L = layout(m, kind, false);
    this.v = openView(w, h, this.L);
    this.w = newWiring();
    const s = this;
    this.g = new Gesture({
      layout: () => s.L,
      view: () => s.v,
      setView: (v) => (s.v = v),
      wires: () => wireList(s.w),
      runOn: () => s.running,
      input: (k) => s.inputs.push(k),
      start: () => s.chosen,
      setStart: (p) => (s.chosen = p),
      join: (a, b) => s.did(join(m, s.w, a, b)),
      move: (to, end, target) => s.did(move(m, s.w, to, end, target)),
      remove: (to) => void s.did(remove(s.w, to)),
      show: (d) => (s.shown = d),
      spring: (d, back) => s.springs.push({ d, back }),
    });
  }

  did(o: { sound: string } | null) {
    if (o) this.sounds.push(o.sound);
    return !!o;
  }

  /** The play area point of a port's centre. */
  at(p: Port, dx = 0, dy = 0): Point {
    const s = toScreen(this.v, spot(this.L, p));
    return { x: s.x + dx, y: s.y + dy };
  }

  tap(p: Point, id = 1) {
    this.g.down(id, p, "pointer");
    this.g.up(id, p);
  }

  drag(a: Point, b: Point, id = 1) {
    this.g.down(id, a, "pointer");
    this.g.move(id, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    this.g.move(id, b);
    this.g.up(id, b);
  }

  list() {
    return wireList(this.w);
  }
}

const level1 = () => {
  const m = model(1);
  return { m, s: new Screen(m), out: port(m, "Input terminal", true), data: port(m, "Summarizer 1.data", false), neg: port(m, "Summarizer 1.negative", false) };
};

test("VIEW-11: a drag from a port released on another joins them", () => {
  const { m, s, out, data } = level1();
  s.drag(s.at(out), s.at(data));
  expect(s.list()).toEqual(wires(m, [["Input terminal", "Summarizer 1"]]));
  expect(s.sounds).toEqual(["connect"]);
  expect(s.shown).toBeNull();
});

test("VIEW-11: a tap on a port, then on another, joins them; the start then goes", () => {
  const { m, s, out, data } = level1();
  s.tap(s.at(data));
  expect(s.chosen).toEqual(data);
  s.tap(s.at(out));
  expect(s.list()).toEqual(wires(m, [["Input terminal", "Summarizer 1"]]));
  expect(s.chosen).toBeNull();
});

test("WIRE-01: no second port drops the start; ports of two kinds lay no wire", () => {
  const { s, out, neg } = level1();
  s.tap(s.at(out));
  s.tap(s.at(out));
  expect(s.chosen).toBeNull();
  s.tap(s.at(out));
  s.tap({ x: 5, y: 5 });
  expect(s.chosen).toBeNull();
  s.tap(s.at(out));
  s.tap(s.at(neg));
  expect(s.list()).toEqual([]);
  expect(s.chosen).toBeNull();
  // A dragged end of two kinds springs back to its port.
  s.drag(s.at(out), s.at(neg));
  expect(s.list()).toEqual([]);
  expect(s.springs.length).toBe(1);
  expect(s.springs[0].back).toEqual(spot(s.L, out));
});

test("VIEW-11: a wire's picked-up end moves, goes, or stays on its own port", () => {
  const { m, s, out, data } = level1();
  const agentOut = port(m, "Summarizer 1", true);
  const outData = port(m, "Output terminal.data", false);
  s.drag(s.at(out), s.at(data));
  s.drag(s.at(agentOut), s.at(outData));
  // From an input port with a wire: its end moves; here back onto its own port.
  s.g.down(1, s.at(outData), "pointer");
  s.g.move(1, s.at(outData, 0, 40));
  expect(s.shown?.hide).toBe(ref(outData.node, outData.i));
  s.g.up(1, s.at(outData));
  expect(s.list().length).toBe(2);
  // Released on no port: removed, with the cut sound.
  s.drag(s.at(outData), { x: 5, y: 5 });
  expect(s.list()).toEqual(wires(m, [["Input terminal", "Summarizer 1"]]));
  expect(s.sounds.at(-1)).toBe("cut");
});

test("VIEW-09: in two targets, the nearer centre; equally near, the input port; else the last wire laid", () => {
  const m = model(1);
  const L = layout(m, "touch", false);
  const out = port(m, "Input terminal", true);
  const data = port(m, "Summarizer 1.data", false);
  const a = spot(L, out);
  const b = spot(L, data);
  expect([a.x, a.y, b.x, b.y]).toEqual([150, 66, 190, 33]);
  expect(portAt(L, { x: 170, y: 52 })).toEqual(out);
  expect(portAt(L, { x: 170, y: 49.5 })).toEqual(data);
  const two = wires(m, [["Input terminal", "Summarizer 1.data"]]);
  expect(hitTest(L, two, { x: 170, y: 140 })).toBeNull();
  const P = layout(m, "pointer", false);
  const w = wires(m, [["Input terminal", "Summarizer 1.data"]]);
  expect(hitTest(P, w, { x: 178, y: 50 })).toEqual({ wire: w[0] });
});

test("VIEW-09: a drag from a wire picks up its nearer end", () => {
  const { m, s, out, data } = level1();
  s.drag(s.at(out), s.at(data));
  const a = s.at(out);
  // Nearer the output end, on the wire's line, outside both targets.
  const p = { x: a.x + 16, y: a.y - 1 };
  s.g.down(1, p, "pointer");
  s.g.move(1, { x: p.x, y: p.y + 30 });
  expect(s.shown?.from).toEqual(data);
  s.g.up(1, { x: 5, y: 5 });
  expect(s.list()).toEqual([]);
});

test("VIEW-10: a second finger ends a drag with no wire, chooses its port, and zooms", () => {
  const m = model(16);
  const s = new Screen(m, 1888, 924, "touch");
  const a = port(m, "Input terminal", true);
  s.g.down(1, s.at(a), "touch");
  s.g.move(1, s.at(a, 30, 0));
  expect(s.shown).not.toBeNull();
  s.g.down(2, s.at(a, 200, 0), "touch");
  expect(s.list()).toEqual([]);
  expect(s.springs.length).toBe(1);
  expect(s.chosen).toEqual(a);
  const z = s.v.zoom;
  s.g.move(2, s.at(a, 400, 0));
  expect(s.v.zoom).toBeGreaterThan(z);
  s.g.up(1, s.at(a));
  s.g.up(2, s.at(a));
  // The browser cancels: no start chosen.
  s.chosen = null;
  s.g.down(3, s.at(a), "touch");
  s.g.move(3, s.at(a, 30, 0));
  s.g.cancel(3);
  expect(s.chosen).toBeNull();
  expect(s.springs.length).toBe(2);
});

test("VIEW-05: below full size a tap on a port zooms to it, and a drag from it moves the level", () => {
  const m = model(16);
  const s = new Screen(m, 328, 484);
  expect(s.v.zoom).toBeLessThan(1);
  const p = port(m, "Inspector 3", true);
  s.tap(s.at(p));
  expect(s.chosen).toBeNull();
  expect(s.v.zoom).toBe(1);
  const c = spot(s.L, p);
  const v1 = centreOn(s.v, c, 1);
  expect(s.v).toEqual(v1);
  const small = new Screen(m, 328, 484);
  const before = small.v;
  small.drag(small.at(p), small.at(p, -40, 0));
  expect(small.list()).toEqual([]);
  expect(small.shown).toBeNull();
  expect(small.v).toEqual(before);
});

test("VIEW-08: a wire's end joined while zoomed out lays no wire; the view goes to that port, the start stays", () => {
  const m = model(16);
  const s = new Screen(m, 328, 484);
  const a = port(m, "Input terminal", true);
  const b = port(m, "Translator 1.data", false);
  s.tap(s.at(a));
  s.g.zoom(10, s.at(a));
  expect(s.v.zoom).toBe(2);
  s.drag(s.at(a), s.at(a, 50, 0));
  // A drag from a port drops the start; now zoom out and release on another port.
  s.g.down(1, s.at(a), "pointer");
  s.g.move(1, s.at(a, 20, 0));
  s.g.zoom(0.01, s.at(a, 20, 0));
  expect(s.v.zoom).toBeLessThan(1);
  s.g.move(1, s.at(b));
  s.g.up(1, s.at(b));
  expect(s.list()).toEqual([]);
  expect(s.v.zoom).toBe(1);
  expect(s.chosen).toEqual(a);
  // Held at the edge: the view moves at EdgeSpeed.
  const x = s.v.x;
  s.g.down(1, s.at(a), "pointer");
  s.g.move(1, { x: 320, y: s.at(a).y });
  s.g.tick(0.1);
  expect(s.v.x).toBeCloseTo(Math.max(x - 60, 328 - s.L.width), 6);
});

test("WIRE-06: a run on takes no wiring action; a drag from a port moves the level", () => {
  const m = model(16);
  const s = new Screen(m, 328, 484);
  const a = port(m, "Input terminal", true);
  s.g.zoom(10, s.at(a));
  s.running = true;
  s.tap(s.at(a));
  expect(s.chosen).toBeNull();
  const before = s.v.x;
  s.drag(s.at(a), s.at(a, -40, 0));
  expect(s.list()).toEqual([]);
  expect(s.v.x).toBeCloseTo(before - 40, 6);
  // A wire being laid when the run starts: no wire.
  s.running = false;
  s.g.down(1, s.at(a), "pointer");
  s.g.move(1, s.at(a, 40, 0));
  s.running = true;
  s.g.lock();
  s.g.up(1, s.at(port(m, "Translator 1.data", false)));
  expect(s.list()).toEqual([]);
  expect(s.chosen).toBeNull();
});

test("VIEW-09: a press that moves less than TapDistance is a tap; TapDistance or farther, a drag", () => {
  const { s, out } = level1();
  s.g.down(1, s.at(out), "pointer");
  s.g.move(1, s.at(out, 7.9, 0));
  expect(s.shown).toBeNull();
  s.g.up(1, s.at(out, 7.9, 0));
  expect(s.chosen).toEqual(out);

  s.chosen = null;
  s.g.down(1, s.at(out), "pointer");
  s.g.move(1, s.at(out, 8, 0));
  expect(s.shown).not.toBeNull();
  s.g.up(1, s.at(out, 8, 0));
  expect([s.chosen, s.list()]).toEqual([null, []]);
});

test("VIEW-10: a second press on a button ends a drag with no wire, its port the chosen start", () => {
  const { s, out, data } = level1();
  s.g.down(1, s.at(out), "pointer");
  s.g.move(1, s.at(data));
  s.g.outside();
  expect([s.list(), s.springs.length, s.chosen]).toEqual([[], 1, out]);
  // The first pointer's release does nothing more.
  s.g.up(1, s.at(data));
  expect([s.list(), s.chosen]).toEqual([[], out]);
});
