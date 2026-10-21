// FINDING-003: each Settings button is named by its row and its word, not by the word alone.
import { expect, test } from "@playwright/test";
import { button, open, saveWith, seed } from "./helpers.ts";

test("Settings buttons take their row's name", async ({ page }) => {
  await seed(page, saveWith(1));
  await open(page);
  await button(page, "SETTINGS").click();
  const s = page.locator(".settings");
  await expect(s.getByRole("button", { name: "Look LIGHT", exact: true })).toBeVisible();
  for (const name of ["Sound", "Music", "Counts"]) await expect(s.getByRole("button", { name: `${name} ON`, exact: true })).toBeVisible();
  await s.getByRole("button", { name: "Sound ON", exact: true }).click();
  await expect(s.getByRole("button", { name: "Sound OFF", exact: true })).toBeVisible();
});
