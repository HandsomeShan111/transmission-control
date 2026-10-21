// FINDING-004 and FINDING-005: a map level's name says its state, and the report dialog is named by its heading.
import { expect, test } from "@playwright/test";
import { button, lay, open, saveWith, seed, solution } from "./helpers.ts";

test("Map levels take their state in their name", async ({ page }) => {
  await seed(page, saveWith(2));
  await open(page);
  await button(page, "MAP").click();
  const map = page.locator(".map");
  await expect(map.getByRole("button", { name: "Level 1 won", exact: true })).toBeVisible();
  await expect(map.getByRole("button", { name: "Level 3 unlocked", exact: true })).toBeVisible();
  await expect(map.getByRole("button", { name: "Level 4 locked", exact: true })).toBeVisible();
});

test("The report dialog is named by its heading", async ({ page }) => {
  await open(page);
  await lay(page, 1, solution(1));
  await button(page, "LAUNCH").click();
  await button(page, "SKIP").click();
  await expect(page.getByRole("dialog", { name: "REPORT", exact: true })).toBeVisible();
});
