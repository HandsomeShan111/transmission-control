// Play's Layout: places, gaps, ports, VIEW-07's turned grid and ART-08's curve.
import { expect, test } from "bun:test";
import { ref } from "../../src/core/level.ts";
import { cubicPath, layout, outSpot, inSpot, ports, track, along, wireCurve } from "../../src/draw/layout.ts";
import { model } from "../core/helpers.ts";

test("level sizes by input, plain and turned", () => {
  const m = model(16);
  expect([m.cols, m.rows]).toEqual([5, 3]);
  const t = layout(m, "touch", false);
  expect([t.width, t.height]).toEqual([5 * 150 + 4 * 40, 3 * 132 + 2 * 24]);
  const p = layout(m, "pointer", false);
  expect([p.width, p.height]).toEqual([5 * 150 + 4 * 56, 3 * 132 + 2 * 32]);
  const turned = layout(m, "touch", true);
  expect([turned.width, turned.height]).toEqual([3 * 150 + 2 * 40, 5 * 132 + 4 * 24]);
});

test("ports spread at (i − ½) / n of their edge", () => {
  const m = model(16);
  const L = layout(m, "pointer", false);
  const two = m.nodes.findIndex((n) => n.inputs.length === 2);
  const b = L.boxes[two];
  const ys = [0, 1].map((i) => inSpot(L, ref(two, i)).y - b.y);
  expect(ys).toEqual([33, 99]);
  expect(inSpot(L, ref(two, 0)).x).toBe(b.x);
  const T = layout(m, "pointer", true);
  const bt = T.boxes[two];
  expect([0, 1].map((i) => inSpot(T, ref(two, i)).x - bt.x)).toEqual([37.5, 112.5]);
  expect(inSpot(T, ref(two, 0)).y).toBe(bt.y);
  expect(outSpot(T, ref(two, 0)).y).toBe(bt.y + 132);
  expect(ports(L).length).toBe(m.nodes.reduce((s, n) => s + n.inputs.length + n.outputs.length, 0));
});

test("a wire leaves and enters square to its edges", () => {
  const m = model(1);
  const L = layout(m, "pointer", false);
  const out = m.nodes.findIndex((n) => n.terminal === "in");
  const node = m.nodes.findIndex((n) => !n.terminal);
  const c = wireCurve(L, ref(out, 0), ref(node, 0));
  expect(c[1].y).toBe(c[0].y);
  expect(c[2].y).toBe(c[3].y);
  expect(c[1].x).toBeGreaterThan(c[0].x);
  expect(c[2].x).toBeLessThan(c[3].x);
  expect(cubicPath(c)).toMatch(/^M\S+ \S+C\S+ \S+ \S+ \S+ \S+ \S+$/);
  // A card's output back to its own input loops out from both edges.
  const self = wireCurve(L, ref(node, 0), ref(node, 0));
  expect(self[1].x).toBeGreaterThan(self[0].x);
  expect(self[2].x).toBeLessThan(self[3].x);
});

test("a token moves at a constant speed", () => {
  const m = model(1);
  const L = layout(m, "pointer", false);
  const node = m.nodes.findIndex((n) => !n.terminal);
  const t = track(wireCurve(L, ref(node, 0), ref(node, 0)));
  const pts = Array.from({ length: 101 }, (_, i) => along(t, i / 100));
  const steps = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  for (const s of steps) expect(Math.abs(s - t.length / 100)).toBeLessThan(t.length / 100 * 0.15);
});
