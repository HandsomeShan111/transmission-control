// LEVEL-02 through the level checker, over the built levels; the fixture the browser tests read is its output.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { check, FIXTURE } from "../../tools/levelcheck.ts";

test("LEVEL-02: each kind new on a level is used by a solution of it; the level checks fixture is fresh", () => {
  const { checks, faults } = check();
  expect(faults).toEqual([]);
  expect(JSON.stringify(checks, null, 1) + "\n").toBe(readFileSync(FIXTURE, "utf8"));
}, 120_000);
