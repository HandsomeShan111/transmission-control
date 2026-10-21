// RUN-03 to RUN-05 shown, and RUN-09 to RUN-12, over level 16's solution.
import { expect, test } from "bun:test";
import { run } from "../../src/core/run.ts";
import { layout } from "../../src/draw/layout.ts";
import { Playback } from "../../src/ui/playback.ts";
import { fromChecks } from "../core/helpers.ts";

const solved = () => {
  const { m, w } = fromChecks(16);
  return new Playback(m, run(m, w));
};

test("RUN-03: tokens move along their wires for MoveTime; the input sends with its moves so far", () => {
  const p = solved();
  const L = layout(p.m, "pointer", false);
  p.advance(0.2);
  const f = p.frame(L);
  expect(f.moving.length).toBe(1);
  expect(f.moving[0].kind).toBe("data");
  expect(f.sending).toEqual({ input: 0, moves: 1 });
  expect(f.working.size).toBe(0);
});

test("RUN-04 and RUN-05: works and arrivals play their sounds as the clock passes them", () => {
  const p = solved();
  const sounds = new Set<string>();
  while (!p.ended) for (const s of p.advance(1 / 60)) sounds.add(s);
  expect([...sounds].sort()).toEqual(["arrives", "works"]);
  expect(p.frame(layout(p.m, "pointer", false)).moving).toEqual([]);
  expect(p.r.won).toBe(true);
});

test("RUN-09: Fast plays FastFactor times as fast; RUN-12: paused, the clock stands", () => {
  const p = solved();
  p.fast = true;
  p.advance(0.1);
  expect(p.t).toBeCloseTo(0.4, 9);
  p.fast = false;
  p.advance(0.1);
  expect(p.t).toBeCloseTo(0.5, 9);
  p.paused = true;
  p.advance(5);
  expect(p.t).toBeCloseTo(0.5, 9);
});

test("RUN-10: Skip plays the rest at once, with no sounds", () => {
  const p = solved();
  p.advance(0.1);
  p.skip();
  expect(p.ended).toBe(true);
  expect(p.advance(1)).toEqual([]);
  expect(p.t).toBe(p.r.timeline.end);
});
