// Shared steps for the browser tests: a seeded save, port spots, wire gestures and reads of the save.
import { expect, type Page } from "@playwright/test";
import { levelById, levelModel } from "../../src/core/level.ts";
import { firstSave, type SaveData, type SavedPort, type SavedWire } from "../../src/core/save.ts";
import { SAVE_KEY } from "../../src/shell/storage.ts";
import checks from "../fixtures/level-checks.json" with { type: "json" };

type Check = { solution: SavedWire[]; kinds: Record<string, SavedWire[]>; longRun?: SavedWire[] };
const CHECKS = checks as unknown as Record<string, Check>;

/** A level wired as the level checks print it. */
export const solution = (id: number) => CHECKS[id].solution;
/** Level 18 wired for its longest run, so a run is still on when the next press lands. */
export const longRun = () => CHECKS[18].longRun!;

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** A save with levels 1 to `won` won and the next one unlocked, plus any changes. */
export function saveWith(won: number, more: Partial<SaveData> = {}): SaveData {
  return { ...firstSave(), won: range(1, won), unlocked: range(1, won + 1), ...more };
}

/** Stores `s` before the page's first load only, so a reload reads what the game wrote. */
export async function seed(page: Page, s: SaveData) {
  await page.addInitScript(
    ([key, text]) => {
      if (sessionStorage.getItem("test-seeded")) return;
      sessionStorage.setItem("test-seeded", "1");
      localStorage.setItem(key, text);
    },
    [SAVE_KEY, JSON.stringify(s)] as const,
  );
}

export const readSave = (page: Page): Promise<SaveData> => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), SAVE_KEY);

/** Opens the game and waits for its first screen, the title screen. */
export async function openTitle(page: Page) {
  await page.goto("./");
  await expect(page.locator("#opening")).toHaveCount(0);
}

/** Presses the title screen, then the act card when one follows: on to the level or the map. */
export async function pressOn(page: Page) {
  const card = page.locator(".screen.card");
  await expect(card.locator("h1")).toHaveText("Transmission Control");
  await card.click();
  await expect(card.locator("h1")).toHaveCount(0);
  if (await card.count()) await card.click();
}

/** The save as the game last wrote it, after any write still in progress. */
export async function settledSave(page: Page): Promise<SaveData | null> {
  await page.evaluate((key) => navigator.locks.request(key, () => undefined), SAVE_KEY);
  return readSave(page);
}

/** Opens the game and presses on to its level or map. */
export async function open(page: Page) {
  await openTitle(page);
  await pressOn(page);
}

/** Reloads the page and presses on to its level or map. */
export async function reopen(page: Page) {
  await page.reload();
  await pressOn(page);
}

/** The brief shows over the bottom bar as a level opens: a press on it closes it. */
export async function closeBrief(page: Page) {
  await page.locator(".panel.brief").click();
  await expect(page.locator(".panel.brief")).toHaveCount(0);
}

export const area = (page: Page) => page.locator(".play .area");
export const wires = (page: Page) => area(page).locator("path[data-to]");
export const button = (page: Page, word: string) => page.locator(".btn", { hasText: new RegExp(`^${word}$`) });

/** A port's centre on the screen: marks are drawn inputs first, then outputs. */
export async function portSpot(page: Page, level: number, p: SavedPort) {
  const m = levelModel(levelById(level));
  const node = m.nodes.findIndex((n) => n.id === p.id);
  const k = p.side === "input" ? p.place - 1 : m.nodes[node].inputs.length + p.place - 1;
  const b = (await area(page).locator(`g[data-node="${node}"] .port`).nth(k).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

export async function mouseDrag(page: Page, a: { x: number; y: number }, b: { x: number; y: number }) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

/** Lays each wire with a mouse drag from its output port to its input port. */
export async function lay(page: Page, level: number, ws: SavedWire[]) {
  for (const w of ws) await mouseDrag(page, await portSpot(page, level, w.from), await portSpot(page, level, w.to));
}

/** A downloaded PNG's width and height, from its IHDR chunk. */
export function pngSize(b: Buffer) {
  expect(b.subarray(1, 4).toString()).toBe("PNG");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
