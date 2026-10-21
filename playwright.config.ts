// The browser tests run against the built game as served at BASE_URL; nothing here starts a server.
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL;
const viewport = { width: 1280, height: 800 };
if (!baseURL) throw new Error("BASE_URL is not set: serve the built game, then set BASE_URL to its address");
// "./" resolves against the base: without the trailing slash, a game under a path opens its parent.
if (!baseURL.endsWith("/")) throw new Error(`BASE_URL must end with a slash: ${baseURL}`);

export default defineConfig({
  testDir: "tests/browser",
  // Not *.test.ts or *.spec.ts, which bun test would also pick up.
  testMatch: "**/*.pw.ts",
  fullyParallel: true,
  retries: 0,
  // More at once runs this host out of memory, and Firefox crashes.
  workers: 2,
  reporter: "list",
  use: { baseURL, viewport },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport } },
  ],
});
