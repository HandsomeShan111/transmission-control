// Sending the waiting play counts, MEAS-03, with a stand-in fetch.
import { describe, expect, test } from "bun:test";
import { firstSave, type SaveData } from "../../src/core/save.ts";
import { sendWaiting } from "../../src/shell/counts-send.ts";

const waiting = (): SaveData => ({
  ...firstSave(),
  events: [
    { name: "first_level_start", day: "2026-10-19" },
    { name: "campaign_finish", day: "2026-10-20" },
  ],
});

describe("sendWaiting", () => {
  test("An empty address sends nothing; the events wait", async () => {
    const s = waiting();
    let calls = 0;
    expect(await sendWaiting(s, { address: "", fetch: async () => (calls++, new Response()) })).toBe(true);
    expect(calls).toBe(0);
    expect(s.events).toHaveLength(2);
  });

  test("A sent event leaves the save; a failed one waits", async () => {
    const s = waiting();
    const asked: [string, RequestInit | undefined][] = [];
    const fetch = async (url: string, init?: RequestInit) => {
      asked.push([url, init]);
      if (url.includes("campaign_finish")) throw new TypeError("Failed to fetch");
      return new Response(null, { status: 500 });
    };
    expect(await sendWaiting(s, { address: "https://example.goatcounter.com", fetch })).toBe(true);
    expect(s.events).toEqual([{ name: "campaign_finish", day: "2026-10-20" }]);
    expect(asked.map(([u]) => u)).toEqual([
      "https://example.goatcounter.com/count?p=first_level_start&e=true",
      "https://example.goatcounter.com/count?p=campaign_finish&e=true",
    ]);
    for (const [, init] of asked) expect(init).toEqual({ mode: "no-cors", credentials: "omit", cache: "no-store" });
  });

  test("Two events of one name on one day: one sent, one waits", async () => {
    const s = waiting();
    s.events = [s.events[1], { ...s.events[1] }];
    let calls = 0;
    const fetch = async () => {
      if (calls++) throw new TypeError("Failed to fetch");
      return new Response();
    };
    expect(await sendWaiting(s, { address: "https://example.goatcounter.com", fetch })).toBe(true);
    expect(s.events).toEqual([{ name: "campaign_finish", day: "2026-10-20" }]);
  });

  test("Every event sent: none left", async () => {
    const s = waiting();
    expect(await sendWaiting(s, { address: "https://example.goatcounter.com/", fetch: async () => new Response() })).toBe(false);
    expect(s.events).toEqual([]);
  });

  test("The address holds the event's name only: no identifier, no day", async () => {
    const s = waiting();
    s.settings.look = "dark";
    const urls: string[] = [];
    await sendWaiting(s, { address: "https://example.goatcounter.com", fetch: async (u) => (urls.push(u), new Response()) });
    for (const u of urls) expect([...new URL(u).searchParams.keys()]).toEqual(["p", "e"]);
    expect(urls.join(" ")).not.toContain("2026");
  });
});
