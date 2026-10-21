// Campaign, CAMP-01 to CAMP-05; the save model, SAVE-01, SAVE-02, SAVE-05, SAVE-06; play counts, MEAS-03.
import { describe, expect, test } from "bun:test";
import { ACTS, LEVELS } from "../../src/content/generated.ts";
import { actCardAfter, actCardBefore, firstVisit, levelState, startLevel, win } from "../../src/core/campaign.ts";
import { countsOff, expire, record } from "../../src/core/counts.ts";
import { decodeWires, encodeWires, firstSave, merge, parseSave, progressOf, reset, setProgress, startSettings, upgrade, type SaveData } from "../../src/core/save.ts";
import { model, wires } from "./helpers.ts";

describe("Campaign", () => {
  test("CAMP-01: a first visit unlocks the first level only", () => {
    const p = firstVisit();
    expect(LEVELS.map((l) => levelState(p, l.id))).toEqual(["unlocked", ...Array(LEVELS.length - 1).fill("locked")]);
    expect(startLevel(p)).toBe(1);
  });

  test("CAMP-02: a win stays won and unlocks the next level", () => {
    const p = firstVisit();
    expect(win(p, 1)).toEqual({ firstWin: true, finished: false, changed: true });
    expect([levelState(p, 1), levelState(p, 2), levelState(p, 3)]).toEqual(["won", "unlocked", "locked"]);
    expect(win(p, 1)).toEqual({ firstWin: false, finished: false, changed: false });
    expect(startLevel(p)).toBe(2);
  });

  test("CAMP-02: the last level won for the first time finishes the campaign", () => {
    const p = firstVisit();
    for (const l of LEVELS.slice(0, -1)) win(p, l.id);
    const last = LEVELS.at(-1)!.id;
    expect(win(p, last).finished).toBe(true);
    expect(win(p, last).finished).toBe(false);
    expect(startLevel(p)).toBeNull();
  });

  test("CAMP-03: levels group into the acts the data gives", () => {
    expect(ACTS.map((a) => [a.first, a.last])).toEqual([[1, 6], [7, 12], [13, 18]]);
  });

  test("CAMP-05: Next level after an act's last level shows the next act's card; never after the campaign's last", () => {
    expect(actCardAfter(6)?.act).toBe(2);
    expect(actCardAfter(12)?.act).toBe(3);
    expect(actCardAfter(5)).toBeNull();
    expect(actCardAfter(18)).toBeNull();
  });

  test("CAMP-05: a session opening on an act's first level shows that act's card first; on any other level, none", () => {
    expect([1, 7, 13].map((id) => actCardBefore(id)?.act)).toEqual([1, 2, 3]);
    for (const id of [2, 6, 8, 12, 14, 18]) expect(actCardBefore(id)).toBeNull();
  });
});

const levelTwoWon = (): SaveData => {
  const s = firstSave();
  const p = progressOf(s);
  win(p, 1);
  win(p, 2);
  setProgress(s, p);
  const m = model(2);
  s.wiring[2] = encodeWires(m, wires(m, [["Input terminal", "Diplomat 1"]]));
  s.settings.sound = false;
  return s;
};

describe("Save", () => {
  test("SAVE-01: levels won and unlocked, each wire by its ports' names, settings, waiting events with their day", () => {
    const s = levelTwoWon();
    record(s, "first_level_start", "2026-10-20");
    expect(JSON.parse(JSON.stringify(s))).toEqual({
      format: 1,
      won: [1, 2],
      unlocked: [1, 2, 3],
      wiring: {
        2: [{ from: { id: "Input terminal", side: "output", kind: "data", place: 1 }, to: { id: "Diplomat 1", side: "input", kind: "data", place: 1 } }],
      },
      settings: { ...startSettings(), sound: false },
      events: [{ name: "first_level_start", day: "2026-10-20" }],
    });
  });

  test("SAVE-03: a save that cannot be read is no save", () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave("{")).toBeNull();
    expect(parseSave(JSON.stringify({ ...firstSave(), format: 99 }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...firstSave(), won: ["x"] }))).toBeNull();
    expect(parseSave(JSON.stringify(levelTwoWon()))).toEqual(levelTwoWon());
  });

  test("SAVE-05: a wire whose ports are renamed is dropped, the others stay", () => {
    const m = model(3);
    const saved = encodeWires(m, wires(m, [["Input terminal", "Translator 1"], ["Translator 1", "Diplomat 1"]]));
    saved[1].to.id = "Diplomat 9";
    expect(decodeWires(m, saved)).toEqual(wires(m, [["Input terminal", "Translator 1"]]));
    const kind = structuredClone(saved);
    kind[0].to.kind = "negative";
    expect(decodeWires(m, kind)).toEqual([]);
  });

  test("SAVE-05: a level whose ID is gone is dropped, then unlocks follow the wins", () => {
    const s = levelTwoWon();
    s.won.push(99);
    s.unlocked.push(7);
    const u = upgrade(s);
    expect(u.won).toEqual([1, 2]);
    expect(u.unlocked).toEqual([1, 2, 3]);
    // Nothing gone: unlocks as saved.
    const t = levelTwoWon();
    t.unlocked.push(7);
    expect(upgrade(t).unlocked).toEqual([1, 2, 3, 7]);
  });

  test("SAVE-06: Reset keeps settings and waiting events", () => {
    const s = levelTwoWon();
    record(s, "first_level_start", "2026-10-20");
    const r = reset(s);
    expect(r).toEqual({ ...firstSave(), settings: s.settings, events: s.events });
  });

  test("SAVE-02: two pages: a write carries only its own changes; the last write stands per wiring and setting", () => {
    const base = levelTwoWon();
    // Page A wins level 3; page B, from the same base, turns music off and rewires level 2.
    const a = structuredClone(base);
    const pa = progressOf(a);
    win(pa, 3);
    setProgress(a, pa);
    const b = structuredClone(base);
    b.settings.music = false;
    delete b.wiring[2];
    const afterA = merge(base, base, a);
    const afterB = merge(afterA, base, b);
    expect(afterB.won).toEqual([1, 2, 3]);
    expect(afterB.unlocked).toEqual([1, 2, 3, 4]);
    expect(afterB.settings.music).toBe(false);
    expect(afterB.wiring[2]).toBeUndefined();
    // Nothing stored: the page's own save.
    expect(merge(null, base, a)).toEqual(a);
  });

  test("SAVE-02, MEAS-01: two pages' events of one name on one day stay two; one sent leaves one", () => {
    const base = firstSave();
    const a = structuredClone(base);
    record(a, "first_level_start", "2026-10-20");
    const b = structuredClone(base);
    record(b, "first_level_start", "2026-10-20");
    const both = merge(merge(base, base, a), base, b);
    expect(both.events).toEqual([
      { name: "first_level_start", day: "2026-10-20" },
      { name: "first_level_start", day: "2026-10-20" },
    ]);
    // Page B sent one of the two it adopted.
    const sent = structuredClone(both);
    sent.events.pop();
    expect(merge(both, both, sent).events).toHaveLength(1);
  });

  test("MEAS-03: Counts off in another page drops this page's waiting events", () => {
    const base = firstSave();
    const off = structuredClone(base);
    off.settings.counts = false;
    const mine = structuredClone(base);
    record(mine, "campaign_finish", "2026-10-20");
    const out = merge(off, base, mine);
    expect([out.settings.counts, out.events]).toEqual([false, []]);
  });
});

describe("Play counts", () => {
  test("MEAS-03: events wait while counts are on; off, nothing waits", () => {
    const s = firstSave();
    expect(record(s, "first_level_start", "2026-10-20")).toBe(true);
    s.settings.counts = false;
    countsOff(s);
    expect(record(s, "campaign_finish", "2026-10-20")).toBe(false);
    expect(s.events).toEqual([]);
  });

  test("MEAS-03: an event older than 13 months is dropped", () => {
    const s = firstSave();
    s.events = [{ name: "first_level_start", day: "2025-09-19" }, { name: "campaign_finish", day: "2025-09-20" }];
    expect(expire(s, "2026-10-20")).toBe(true);
    expect(s.events).toEqual([{ name: "campaign_finish", day: "2025-09-20" }]);
  });
});
