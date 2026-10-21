// The Screens checks, docs/build/acceptance.md: each screen at the smallest and the largest Platform
// screen, in each look. Measures what the Layout states in numbers; saves a picture of each for the eye.
import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { button, closeBrief, open, openTitle, saveWith, seed, solution } from "./helpers.ts";
import checks from "../fixtures/level-checks.json" with { type: "json" };

const SHOTS = process.env.SHOTS ?? "test-results/screens";
const SIZES = [
  { name: "360x640", width: 360, height: 640, portrait: true },
  { name: "640x360", width: 640, height: 360, portrait: false },
  { name: "1920x1080", width: 1920, height: 1080, portrait: false },
];
const LOOKS = ["light", "dark"] as const;
/** Level 16 lost, as the share picture's preview shows it. */
const LOST_16 = (checks as unknown as Record<string, { kinds: Record<string, never[]> }>)["16"].kinds["Partly right"];

const box = (page: Page, sel: string) => page.locator(sel).first().boundingBox().then((b) => b!);
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png` });

test.beforeAll(() => mkdir(SHOTS, { recursive: true }));
test.beforeEach(({ browserName }) => test.skip(browserName !== "chromium", "screen checks are measured once, in Chromium"));

for (const size of SIZES) {
  for (const look of LOOKS) {
    const at = `${size.name}-${look}`;
    test.describe(at, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test(`Play, ${look}: bars, play area, brief and report`, async ({ page }) => {
        const s = saveWith(15, { wiring: { 16: LOST_16 } });
        s.settings.look = look;
        await seed(page, s);
        await open(page);
        await expect(page.locator("html")).toHaveAttribute("data-look", look);
        await expect(button(page, "LEVEL 16")).toBeVisible();
        expect((await box(page, ".play .top")).height).toBe(52);
        expect((await box(page, ".play .bottom")).height).toBe(72);
        const a = await box(page, ".play .area");
        expect([a.x, a.width, a.height]).toEqual([16, size.width - 32, size.height - 52 - 72 - 32]);
        // Screen numbers round to whole pixels: 36 + 23.6 + 44.8 = 104.4 shows as 104.
        expect((await box(page, ".panel.brief")).height).toBeLessThan(size.portrait ? 150 : 105);
        await shot(page, `play-brief-${at}`);
        await closeBrief(page);
        await shot(page, `play-${at}`);
        await button(page, "LAUNCH").click();
        await button(page, "SKIP").click();
        const r = await box(page, ".panel.report");
        expect(r.height).toBeLessThanOrEqual(size.portrait ? 380 : 246);
        await shot(page, `play-report-${at}`);
      });

      test(`Share picture, ${look}`, async ({ page }) => {
        const s = saveWith(15, { wiring: { 16: LOST_16 } });
        s.settings.look = look;
        await seed(page, s);
        await open(page);
        await closeBrief(page);
        await button(page, "LAUNCH").click();
        await button(page, "SKIP").click();
        const [d] = await Promise.all([page.waitForEvent("download"), button(page, "SAVE PICTURE").click()]);
        expect(d.suggestedFilename()).toBe("transmission-control-level-16.png");
        await d.saveAs(`${SHOTS}/share-${at}.png`);
      });

      test(`Campaign map, ${look}: rows, scroll and opening place`, async ({ page }) => {
        const s = saveWith(3);
        s.settings.look = look;
        await seed(page, s);
        await open(page);
        await button(page, "MAP").click();
        const col = await box(page, ".map .col");
        expect(col.width).toBe(Math.min(640, size.width - 32));
        const tops = await page.locator(".act").first().locator(".btn.level").evaluateAll((bs) => new Set(bs.map((b) => b.getBoundingClientRect().top)).size);
        expect(tops).toBe(size.portrait ? 2 : 1);
        const scrolls = await page.locator(".map .scroll").evaluate((e) => e.scrollHeight > e.clientHeight);
        expect(scrolls).toBe(size.width < 1920);
        await shot(page, `map-${at}`);
      });

      test(`Settings, ${look}: rows, and scroll only in landscape`, async ({ page }) => {
        const s = saveWith(0);
        s.settings.look = look;
        await seed(page, s);
        await open(page);
        await button(page, "SETTINGS").click();
        const col = await box(page, ".settings .col");
        expect(col.width).toBe(Math.min(640, size.width - 32));
        const scrolls = await page.locator(".settings .scroll").evaluate((e) => e.scrollHeight > e.clientHeight);
        expect(scrolls).toBe(!size.portrait && size.width < 1920);
        await shot(page, `settings-${at}`);
      });

      test(`Title screen and Act 1's card, ${look}: whole screen, one centred block`, async ({ page }) => {
        const s = saveWith(0);
        s.settings.look = look;
        await seed(page, s);
        await openTitle(page);
        for (const name of ["title", "card-act-1"]) {
          const col = await box(page, ".card .col");
          expect(col.width).toBe(Math.min(640, size.width - 32));
          const words = await box(page, ".card .title");
          expect(Math.abs(words.y + words.height / 2 - size.height / 2)).toBeLessThan(name === "title" ? 1 : size.height / 4);
          await shot(page, `${name}-${at}`);
          await page.locator(".card").click();
        }
        await expect(button(page, "LEVEL 1")).toBeVisible();
      });

      test(`Act card, ${look}`, async ({ page }) => {
        const s = saveWith(5, { wiring: { 6: solution(6) } });
        s.settings.look = look;
        await seed(page, s);
        await open(page);
        await closeBrief(page);
        await button(page, "LAUNCH").click();
        await button(page, "SKIP").click();
        await button(page, "NEXT LEVEL").click();
        await expect(page.locator(".card")).toBeVisible();
        await shot(page, `card-${at}`);
      });
    });
  }
}
