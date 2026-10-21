// VIEW-02 to VIEW-08: the view's zoom and position.
import { expect, test } from "bun:test";
import { layout } from "../../src/draw/layout.ts";
import { centreOn, dragBy, edgeVelocity, minZoom, openView, refit, toLevel, toScreen, zoomAt } from "../../src/ui/view.ts";
import { model } from "../core/helpers.ts";

test("VIEW-02: a level opens whole and centred, at full size or the largest zoom that fits", () => {
  const L = layout(model(16), "pointer", false);
  const v = openView(328, 484, L);
  expect(v.zoom).toBeCloseTo(328 / L.width, 9);
  expect(v.x).toBeCloseTo(0, 9);
  expect(v.y).toBeCloseTo((484 - L.height * v.zoom) / 2, 9);
  const small = openView(1888, 924, layout(model(1), "pointer", false));
  expect(small.zoom).toBe(1);
  expect([small.x, small.y]).toEqual([(1888 - 562) / 2, (924 - 132) / 2]);
});

test("VIEW-03: zoom about the gesture's point, between the opening zoom and ZoomMax", () => {
  const L = layout(model(16), "pointer", false);
  const v = openView(328, 484, L);
  const p = { x: 100, y: 240 };
  const z = zoomAt(v, 1.5, p);
  expect(z.zoom).toBeCloseTo(v.zoom * 1.5, 9);
  const before = toLevel(v, p);
  const after = toLevel(z, p);
  expect(after.x).toBeCloseTo(before.x, 6);
  expect(zoomAt(v, 100, p).zoom).toBe(2);
  expect(zoomAt(v, 0.01, p).zoom).toBeCloseTo(minZoom(v), 9);
  // Derived: a level that fits at full size never zooms out.
  const one = openView(1888, 924, layout(model(1), "pointer", false));
  expect(zoomAt(one, 0.5, { x: 10, y: 10 }).zoom).toBe(1);
});

test("VIEW-04: a drag moves the level while it is larger, never past its edge; a fitting axis stays centred", () => {
  const L = layout(model(16), "pointer", false);
  const v = centreOn(openView(328, 484, L), { x: L.width / 2, y: L.height / 2 }, 1);
  const right = dragBy(v, 10_000, 10_000);
  expect(right.x).toBe(0);
  expect(right.y).toBe(v.y);
  expect(v.y).toBe(12);
  const left = dragBy(v, -10_000, 0);
  expect(left.x).toBe(328 - L.width);
  const mid = dragBy(v, 20, 0);
  expect(mid.x).toBeCloseTo(v.x + 20, 9);
});

test("VIEW-06 and VIEW-07: a turn keeps the level point at the centre, and the zoom", () => {
  const m = model(16);
  const wide = layout(m, "pointer", false);
  const tall = layout(m, "pointer", true);
  // Centred on Inspector 2's place: column 2, row 1.
  const box = wide.boxes[m.nodes.findIndex((n) => n.id === "Inspector 2")];
  const v = centreOn(openView(608, 204, wide), { x: box.x + 75, y: box.y + 66 }, 1);
  const t = refit(v, wide, tall, 328, 484);
  expect(t.zoom).toBe(1);
  const c = toLevel(t, { x: 164, y: 242 });
  const turned = tall.boxes[m.nodes.findIndex((n) => n.id === "Inspector 2")];
  // The level's row fraction shows across, its column fraction down.
  expect(c.x).toBeCloseTo(turned.x + (66 * (150 + 56)) / (132 + 32), 6);
  expect(c.y).toBeCloseTo(turned.y + (75 * (132 + 32)) / (150 + 56), 6);
  expect(c.x).toBeGreaterThan(turned.x);
  expect(c.x).toBeLessThan(turned.x + 150);
  expect(toScreen(t, c).x).toBeCloseTo(164, 6);
});

test("VIEW-08: a wire's end within EdgeZone of an edge moves the view at EdgeSpeed", () => {
  const v = openView(328, 484, layout(model(16), "pointer", false));
  expect(edgeVelocity(v, { x: 10, y: 200 })).toEqual({ x: 600, y: 0 });
  expect(edgeVelocity(v, { x: 320, y: 470 })).toEqual({ x: -600, y: -600 });
  expect(edgeVelocity(v, { x: 100, y: 200 })).toEqual({ x: 0, y: 0 });
});
