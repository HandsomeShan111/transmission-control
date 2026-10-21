// FINDING-002: ports facing away at one height loop out and back, ART-08, never one flat line folded on itself.
import { expect, test } from "bun:test";
import { ref } from "../../src/core/level.ts";
import { layout, ports, spot, track, wireCurve, type Point } from "../../src/draw/layout.ts";
import { model } from "../core/helpers.ts";

for (const turned of [false, true]) {
  test(`every wire between ports facing away at one height loops wide, ${turned ? "turned" : "plain"}`, () => {
    const L = layout(model(16), "pointer", turned);
    const across = (p: Point) => (turned ? p.x : p.y);
    const along = (p: Point) => (turned ? p.y : p.x);
    const all = ports(L);
    let seen = 0;
    for (const o of all.filter((p) => p.out))
      for (const i of all.filter((p) => !p.out)) {
        const [a, b] = [spot(L, o), spot(L, i)];
        if (across(a) !== across(b) || along(b) >= along(a)) continue;
        seen++;
        const c = wireCurve(L, ref(o.node, o.i), ref(i.node, i.i));
        expect([c[0], c[c.length - 1]]).toEqual([a, b]);
        // Square out of a and into b.
        expect(across(c[1])).toBe(across(a));
        expect(across(c[c.length - 2])).toBe(across(b));
        const t = track(c);
        expect(Math.max(...t.points.map((p) => Math.abs(across(p) - across(a))))).toBeGreaterThanOrEqual(48);
      }
    expect(seen).toBeGreaterThan(0);
  });
}
