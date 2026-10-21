// The acceptance tests the unit tests cannot reach: the built game in a browser, by mouse.
// docs/build/acceptance.md; each test names the steps it checks.
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { SAVE_KEY } from "../../src/shell/storage.ts";
import { area, button, closeBrief, lay, longRun, mouseDrag, open, openTitle, pngSize, portSpot, readSave, reopen, saveWith, seed, settledSave, solution, wires } from "./helpers.ts";

test("APP-01, CAMP-05, ART-11: a first visit opens on the title screen, then Act 1's card, then level 1", async ({ page }) => {
  await openTitle(page);
  const card = page.locator(".screen.card");
  await expect(card.locator("h1.title")).toHaveText("Transmission Control");
  await expect(card).toHaveRole("button");
  await expect(page.locator(".bar")).toHaveCount(0);
  await card.click();
  await expect(card.locator(".title span").first()).toHaveText("ACT 1");
  await expect(card.locator(".title span").nth(1)).toHaveText("First contact");
  expect((await settledSave(page))?.events ?? []).toEqual([]);
  await card.click();
  await expect(card).toHaveCount(0);
  await expect(button(page, "LEVEL 1")).toBeVisible();
});

test("APP-01, CAMP-05: the keyboard alone opens the game, with no Tab first", async ({ page }) => {
  await openTitle(page);
  const card = page.locator(".screen.card");
  await expect(card.locator("h1")).toHaveText("Transmission Control");
  await page.keyboard.press("Enter");
  await expect(card.locator(".title span").first()).toHaveText("ACT 1");
  await page.keyboard.press(" ");
  await expect(button(page, "LEVEL 1")).toBeVisible();
});

test("APP-01, CAMP-05: a double click on the title screen leaves Act 1's card showing", async ({ page }) => {
  await openTitle(page);
  const card = page.locator(".screen.card");
  await expect(card.locator("h1")).toHaveText("Transmission Control");
  await card.dblclick();
  await expect(card.locator(".title span").first()).toHaveText("ACT 1");
});

test("APP-01, CAMP-05: a later visit mid-act shows the title screen, then the level, with no act card", async ({ page }) => {
  await seed(page, saveWith(3));
  await openTitle(page);
  await page.locator(".screen.card").click();
  await expect(page.locator(".screen.card")).toHaveCount(0);
  await expect(button(page, "LEVEL 4")).toBeVisible();
});

test("APP-01, CAMP-05: a later visit on an act's first level shows the title screen, then that act's card", async ({ page }) => {
  await seed(page, saveWith(6));
  await openTitle(page);
  const card = page.locator(".screen.card");
  await card.click();
  await expect(card.locator(".title span").first()).toHaveText("ACT 2");
  await card.click();
  await expect(button(page, "LEVEL 7")).toBeVisible();
});

test("CAMP-01, MEAS-01, LEVEL-03: a first visit opens level 1 with its brief, counted once", async ({ page }) => {
  await open(page);
  await expect(button(page, "LEVEL 1")).toBeVisible();
  const brief = page.locator(".panel.brief");
  await expect(brief.locator("h2")).toHaveText("BRIEF");
  await brief.click();
  await expect(brief).toHaveCount(0);
  await button(page, "LEVEL 1").click();
  await expect(page.locator(".panel.brief")).toBeVisible();
  await expect.poll(async () => (await readSave(page)).events.map((e) => e.name)).toEqual(["first_level_start"]);
  await reopen(page);
  await expect(button(page, "LEVEL 1")).toBeVisible();
  expect((await readSave(page)).events.map((e) => e.name)).toEqual(["first_level_start"]);
});

test("WIRE-01, RUN-01, RUN-10, REPORT-01, REPORT-07, REPORT-08, CAMP-02: wire level 1, win, save the picture, next level", async ({ page }) => {
  await open(page);
  await lay(page, 1, solution(1));
  await expect(wires(page)).toHaveCount(2);
  await expect(page.locator(".panel:visible")).toHaveCount(0);
  await button(page, "LAUNCH").click();
  await expect(button(page, "STOP")).toBeVisible();
  await expect(button(page, "FAST")).toBeVisible();
  await button(page, "SKIP").click();
  const report = page.locator(".panel.report");
  await expect(report.locator("h2")).toHaveText("REPORT");
  await expect(report.locator(".words p").first()).toBeVisible();
  await expect(button(page, "NEXT LEVEL")).toBeVisible();
  await expect.poll(async () => (await readSave(page)).won).toEqual([1]);

  const [download] = await Promise.all([page.waitForEvent("download"), button(page, "SAVE PICTURE").click()]);
  expect(download.suggestedFilename()).toBe("transmission-control-level-1.png");
  expect(pngSize(await readFile(await download.path()))).toEqual({ width: 1600, height: 900 });

  await button(page, "CLOSE").click();
  await expect(report).toHaveCount(0);
  await expect(wires(page)).toHaveCount(2);
  await expect(area(page).locator(".token")).not.toHaveCount(0);
  await button(page, "LAUNCH").click();
  await button(page, "SKIP").click();
  await button(page, "NEXT LEVEL").click();
  await expect(button(page, "LEVEL 2")).toBeVisible();
  expect((await readSave(page)).unlocked).toContain(2);
});

test("WIRE-03, WIRE-04, WIRE-05: drag a wire's end to no port, Undo, Clear", async ({ page }) => {
  await open(page);
  const [w] = solution(1);
  await lay(page, 1, [w]);
  await expect(wires(page)).toHaveCount(1);
  const end = await portSpot(page, 1, w.to);
  await mouseDrag(page, end, { x: end.x, y: end.y - 120 });
  await expect(wires(page)).toHaveCount(0);
  await button(page, "UNDO").click();
  await expect(wires(page)).toHaveCount(1);
  await button(page, "CLEAR").click();
  await expect(wires(page)).toHaveCount(0);
  await button(page, "UNDO").click();
  await expect(wires(page)).toHaveCount(1);
});

test("VIEW-11: Undo and Clear drop a chosen start", async ({ page }) => {
  await open(page);
  await closeBrief(page);
  const marks = area(page).locator("svg > g > g:nth-of-type(4) > *");
  const [w] = solution(1);
  // With nothing to undo or clear, both are disabled (Style: a press changes nothing); so a wire first.
  for (const word of ["UNDO", "CLEAR"]) {
    await lay(page, 1, [w]);
    const p = await portSpot(page, 1, w.from);
    await page.mouse.click(p.x, p.y);
    await expect(marks).not.toHaveCount(0);
    await button(page, word).click();
    await expect(marks).toHaveCount(0);
  }
});

test("RUN-13: the stops rest until the next wiring action", async ({ page }) => {
  await seed(page, saveWith(0, { wiring: { 1: solution(1) } }));
  await open(page);
  await closeBrief(page);
  await button(page, "LAUNCH").click();
  await button(page, "SKIP").click();
  await button(page, "CLOSE").click();
  await expect(area(page).locator(".token")).not.toHaveCount(0);
  await button(page, "CLEAR").click();
  await expect(area(page).locator(".token")).toHaveCount(0);
});

test("MEAS-02, APP-01: winning level 18 counts campaign_finish; with every level won the game opens on the map", async ({ page }) => {
  await seed(page, saveWith(17, { wiring: { 18: solution(18) } }));
  await open(page);
  await expect(button(page, "LEVEL 18")).toBeVisible();
  await closeBrief(page);
  await button(page, "LAUNCH").click();
  await button(page, "SKIP").click();
  await expect(page.locator(".panel.report")).toBeVisible();
  // No count service address in this build: the event waits in the save.
  await expect.poll(async () => (await readSave(page)).events.map((e) => e.name)).toEqual(["campaign_finish"]);
  await reopen(page);
  await expect(page.locator(".map h1")).toHaveText("CAMPAIGN");
});

test("RUN-11, APP-06: Stop ends a run; the map control stops one too", async ({ page }) => {
  await seed(page, saveWith(17, { wiring: { 18: longRun() } }));
  await open(page);
  await expect(wires(page)).toHaveCount(longRun().length);
  await closeBrief(page);
  await button(page, "LAUNCH").click();
  await button(page, "STOP").click();
  await expect(button(page, "LAUNCH")).toBeVisible();
  await expect(page.locator(".panel.report")).toHaveCount(0);
  await button(page, "LAUNCH").click();
  await button(page, "MAP").click();
  await expect(page.locator(".map h1")).toHaveText("CAMPAIGN");
});

test("CAMP-03, CAMP-04: the map shows each act and level; a locked level does nothing", async ({ page }) => {
  await seed(page, saveWith(3));
  await open(page);
  await expect(button(page, "LEVEL 4")).toBeVisible();
  await button(page, "MAP").click();
  await expect(page.locator(".map .act")).toHaveCount(3);
  await expect(page.locator(".btn.level")).toHaveCount(18);
  await expect(page.locator(".btn.level.off")).toHaveCount(14);
  await page.locator(".btn.level", { hasText: /^5$/ }).click({ force: true });
  await expect(page.locator(".map")).toBeVisible();
  await page.locator(".btn.level", { hasText: /^2$/ }).click();
  await expect(button(page, "LEVEL 2")).toBeVisible();
});

test("CAMP-05, ART-11: winning level 6 shows act 2's card, then level 7", async ({ page }) => {
  await seed(page, saveWith(5, { wiring: { 6: solution(6) } }));
  await open(page);
  await expect(button(page, "LEVEL 6")).toBeVisible();
  await closeBrief(page);
  await button(page, "LAUNCH").click();
  await button(page, "SKIP").click();
  await button(page, "NEXT LEVEL").click();
  const card = page.locator(".card");
  await expect(card.locator(".title span").first()).toHaveText("ACT 2");
  await card.click();
  await expect(button(page, "LEVEL 7")).toBeVisible();
});

test("APP-05, SAVE-02, SAVE-06, MEAS-04: settings switch, write, and Reset after a confirm", async ({ page }) => {
  await seed(page, saveWith(3, { wiring: { 4: solution(1) } }));
  await open(page);
  await button(page, "SETTINGS").click();
  const s = page.locator(".settings");
  await expect(s.locator("h1")).toHaveText("SETTINGS");
  await expect(s.getByText(/^Counts two events/)).toBeVisible();
  await s.locator(".btn", { hasText: /^LIGHT$/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-look", "dark");
  await expect.poll(async () => (await readSave(page)).settings.look).toBe("dark");
  for (const i of [0, 1, 2]) await s.locator(".btn", { hasText: /^ON$/ }).first().click();
  await expect(s.locator(".btn", { hasText: /^OFF$/ })).toHaveCount(3);
  await expect.poll(async () => (await readSave(page)).settings).toEqual({ look: "dark", sound: false, music: false, counts: false });
  await button(page, "RESET").click();
  await expect(button(page, "CONFIRM RESET")).toBeVisible();
  await button(page, "CONFIRM RESET").click();
  await expect(s).toHaveCount(0);
  await expect(button(page, "LEVEL 1")).toBeVisible();
  await expect.poll(async () => (await readSave(page)).won).toEqual([]);
  const after = await readSave(page);
  expect([after.unlocked, after.wiring, after.settings.look]).toEqual([[1], {}, "dark"]);
  await button(page, "SETTINGS").click();
  await button(page, "CLOSE").click();
  await expect(page.locator(".settings")).toHaveCount(0);
});

test("SAVE-02, SAVE-03: a laid wire is written and read back on the next visit", async ({ page }) => {
  await open(page);
  await lay(page, 1, solution(1).slice(0, 1));
  await expect.poll(async () => (await readSave(page)).wiring["1"]?.length).toBe(1);
  await reopen(page);
  await expect(wires(page)).toHaveCount(1);
});

test("SAVE-04: with storage blocked, the notice shows once a visit and settings say so", async ({ page }) => {
  await page.addInitScript((key) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k === key) throw new DOMException("blocked", "SecurityError");
      return set.call(this, k, v);
    };
  }, SAVE_KEY);
  await open(page);
  const [a, b] = solution(1);
  await lay(page, 1, [a]);
  const notice = page.locator(".panel.notice");
  await expect(notice.locator("h2")).toHaveText("PROGRESS");
  await expect(notice).toContainText("Progress is not kept in this browser.");
  await notice.click();
  await expect(notice).toHaveCount(0);
  await lay(page, 1, [b]);
  await expect(wires(page)).toHaveCount(2);
  await expect(page.locator(".panel:visible")).toHaveCount(0);
  await button(page, "SETTINGS").click();
  await expect(page.locator(".settings").getByText("Progress is not kept in this browser.")).toBeVisible();
});

test("APP-03: after a first visit the game opens offline", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Playwright's offline switch reaches service worker fetches in Chromium only");
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await reopen(page);
  await expect(button(page, "LEVEL 1")).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await reopen(page);
  await expect(button(page, "LEVEL 1")).toBeVisible();
  await expect(area(page).locator("g[data-node]")).toHaveCount(3);
});

test.describe("touch", () => {
  test.use({ hasTouch: true });

  test("VIEW-01: the last press's input sets the room between places and each port's target", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "touch is sent through Chromium's DevTools protocol");
    const cdp = await page.context().newCDPSession(page);
    const touch = async (type: "touchStart" | "touchMove" | "touchEnd", p?: { x: number; y: number }) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
    const across = async () => {
      const [a, b] = await Promise.all([0, 1].map((i) => area(page).locator(`g[data-node="${i}"] rect`).first().boundingBox()));
      return Math.round(b!.x - a!.x);
    };
    const [w] = solution(1);
    await open(page);
    await closeBrief(page);
    await page.mouse.click(5, 400);
    expect(await across()).toBe(150 + 56);
    // 18 px off the port: outside PortPointer's 24 px target, inside PortTouch's 44.
    let from = await portSpot(page, 1, w.from);
    await mouseDrag(page, { x: from.x, y: from.y - 18 }, await portSpot(page, 1, w.to));
    await expect(wires(page)).toHaveCount(0);

    await touch("touchStart", { x: 5, y: 400 });
    await touch("touchEnd");
    await expect.poll(across).toBe(150 + 40);
    from = await portSpot(page, 1, w.from);
    const to = await portSpot(page, 1, w.to);
    await touch("touchStart", { x: from.x, y: from.y - 18 });
    for (let k = 1; k <= 8; k++) await touch("touchMove", { x: from.x + ((to.x - from.x) * k) / 8, y: from.y - 18 + ((to.y - from.y + 18) * k) / 8 });
    await touch("touchEnd");
    await expect(wires(page)).toHaveCount(1);
  });
});
