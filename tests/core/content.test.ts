// The word counts of the Content inventory; ART-13's form.
import { describe, expect, test } from "bun:test";
import { ACTS, AGENTS, COUNTS_LINE, LEVELS, SHELL_WORDS } from "../../src/content/generated.ts";
import { sentence } from "../../src/core/words.ts";

describe("Content", () => {
  test("counts of the Content inventory: 18 briefs and win lines, 88 level lines, 12 rule texts, 23 agent lines", () => {
    expect(LEVELS.length).toBe(18);
    expect(LEVELS.filter((l) => l.task && l.stake && l.words.win).length).toBe(18);
    expect(LEVELS.reduce((n, l) => n + Object.keys(l.words.lines).length, 0)).toBe(88);
    expect(AGENTS.filter((a) => a.ruleText).length).toBe(12);
    expect(AGENTS.reduce((n, a) => n + Object.keys(a.lines).length, 0)).toBe(23);
  });

  test("REPORT-04: every agent kind has a line for each kind of its input ports", () => {
    for (const a of AGENTS) expect(Object.keys(a.lines).sort()).toEqual([...new Set(a.inputs)].sort());
  });
});

const shown = (): string[] => [
  ...LEVELS.flatMap((l) => [sentence(l.task), sentence(l.stake), l.words.newLine ?? "", l.words.win, ...Object.values(l.words.lines)]),
  ...ACTS.flatMap((a) => [a.name, sentence(a.situation)]),
  ...AGENTS.flatMap((a) => [a.ruleText, ...Object.values(a.lines)]),
  COUNTS_LINE,
  ...Object.values(SHELL_WORDS),
].filter(Boolean);

describe("Art direction", () => {
  test("ART-13: no exclamation marks in any shown line", () => {
    expect(shown().filter((s) => s.includes("!"))).toEqual([]);
  });

  test("ART-13: task, stake and situation show as sentences", () => {
    for (const s of [...LEVELS.flatMap((l) => [l.task, l.stake]), ...ACTS.map((a) => a.situation)]) expect(sentence(s)).toMatch(/^[A-Z].*\.$/);
    expect(sentence("an alien fleet reads Earth's messages")).toBe("An alien fleet reads Earth's messages.");
    expect(sentence("Done.")).toBe("Done.");
  });
});
