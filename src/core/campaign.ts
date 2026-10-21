// Campaign progress, CAMP-01 to CAMP-05, and the level a session starts on, APP-01.
import { ACTS, LEVELS } from "../content/generated.ts";
import type { Act } from "../content/types.ts";

export interface Progress {
  won: Set<number>;
  /** Levels opened to play; a won level may be among them. */
  unlocked: Set<number>;
}

/** Level IDs in the order of their entries. */
export const LEVEL_IDS = LEVELS.map((l) => l.id);

/** CAMP-01. */
export const firstVisit = (): Progress => ({ won: new Set(), unlocked: new Set([LEVEL_IDS[0]]) });

export const nextLevel = (id: number): number | null => LEVEL_IDS[LEVEL_IDS.indexOf(id) + 1] ?? null;

export const isLast = (id: number) => id === LEVEL_IDS[LEVEL_IDS.length - 1];

export type LevelState = "won" | "unlocked" | "locked";

export const levelState = (p: Progress, id: number): LevelState => (p.won.has(id) ? "won" : p.unlocked.has(id) ? "unlocked" : "locked");

export interface WinOutcome {
  /** No level was won before: SAVE-07 asks to keep the game's data. */
  firstWin: boolean;
  /** The last level won for the first time: the campaign is finished, MEAS-02. */
  finished: boolean;
  /** The won or unlocked levels changed, so the save is written. */
  changed: boolean;
}

/** CAMP-02. */
export function win(p: Progress, id: number): WinOutcome {
  const firstWin = p.won.size === 0;
  const before = p.won.has(id);
  const next = nextLevel(id);
  const size = p.unlocked.size;
  p.won.add(id);
  if (next !== null && !p.won.has(next)) p.unlocked.add(next);
  return { firstWin, finished: isLast(id) && !before, changed: !before || p.unlocked.size !== size };
}

export const actOf = (id: number): Act => ACTS.find((a) => id >= a.first && id <= a.last)!;

/** CAMP-05: the act card Next level shows after winning `id`, or null. */
export function actCardAfter(id: number): Act | null {
  const next = nextLevel(id);
  if (next === null || actOf(id).last !== id) return null;
  return actOf(next);
}

/** CAMP-05: the act card a session opening on `id` shows first, when `id` is its act's first level; else null. */
export function actCardBefore(id: number): Act | null {
  const a = actOf(id);
  return a.first === id ? a : null;
}

/** APP-01: the lowest-numbered unlocked level not yet won; null, every level won: the campaign map. */
export function startLevel(p: Progress): number | null {
  const open = LEVEL_IDS.filter((id) => p.unlocked.has(id) && !p.won.has(id));
  return open.length ? Math.min(...open) : null;
}

/** SAVE-05: the first level and each level after a won level unlocked, every other level not won locked. */
export function unlockAfterWins(p: Progress) {
  p.unlocked = new Set(LEVEL_IDS.filter((id, k) => k === 0 || p.won.has(LEVEL_IDS[k - 1])));
}
