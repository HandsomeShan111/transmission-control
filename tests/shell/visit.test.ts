// The visit, APP-04, with a stand-in for BroadcastChannel and sessionStorage.
import { describe, expect, test } from "bun:test";
import { joinVisit, type VisitDeps } from "../../src/shell/visit.ts";

/** Channels of one name on one origin: a message reaches every other open one, later, as the browser does. */
function bus() {
  const open = new Set<Chan>();
  class Chan {
    onmessage: ((e: { data: unknown }) => void) | null = null;
    constructor() {
      open.add(this);
    }
    postMessage(data: unknown) {
      if (!open.has(this)) throw new Error("InvalidStateError");
      const copy = structuredClone(data);
      for (const c of open) if (c !== this) setTimeout(() => open.has(c) && c.onmessage?.({ data: copy }));
    }
    close() {
      open.delete(this);
    }
  }
  return () => new Chan() as unknown as BroadcastChannel;
}

function session(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as Storage;
}

const page = (channel: () => BroadcastChannel | null, s = session(), wasDiscarded = false): VisitDeps => ({ channel, session: () => s, wasDiscarded, wait: 20 });

describe("Visit", () => {
  test("The first page opens a new visit", async () => {
    const v = await joinVisit(page(bus()));
    expect(v.isNew).toBe(true);
    expect(v.has("notice")).toBe(false);
  });

  test("A second page joins the first's visit and sees its flags", async () => {
    const ch = bus();
    const a = await joinVisit(page(ch));
    a.set("notice");
    const b = await joinVisit(page(ch));
    expect(b.isNew).toBe(false);
    expect(b.has("notice")).toBe(true);
  });

  test("set() reaches the other open pages", async () => {
    const ch = bus();
    const a = await joinVisit(page(ch));
    const b = await joinVisit(page(ch));
    b.set("notice");
    await Bun.sleep(5);
    expect(a.has("notice")).toBe(true);
  });

  test("A reload, alone, keeps the visit and its flags", async () => {
    const s = session();
    const first = await joinVisit(page(bus(), s));
    first.set("notice");
    first.close();
    const reload = await joinVisit(page(bus(), s));
    expect(reload.isNew).toBe(false);
    expect(reload.has("notice")).toBe(true);
  });

  test("A discarded tab opened again, alone, starts a new visit with no flags", async () => {
    const s = session();
    const first = await joinVisit(page(bus(), s));
    first.set("notice");
    first.close();
    const again = await joinVisit(page(bus(), s, true));
    expect(again.isNew).toBe(true);
    expect(again.has("notice")).toBe(false);
  });

  test("A discarded tab opened again while another page is open joins that visit", async () => {
    const ch = bus();
    const s = session();
    (await joinVisit(page(ch, s))).set("notice");
    const other = await joinVisit(page(ch));
    const again = await joinVisit(page(ch, s, true));
    expect(again.isNew).toBe(false);
    expect(again.has("notice")).toBe(true);
    other.close();
  });

  test("Every page of a visit closed: the next page opens a new visit", async () => {
    const ch = bus();
    const a = await joinVisit(page(ch));
    a.set("notice");
    a.close();
    const b = await joinVisit(page(ch));
    expect(b.isNew).toBe(true);
    expect(b.has("notice")).toBe(false);
  });

  test("No channel and a throwing session storage: a new visit; set() still holds for this page", async () => {
    const blocked = () => {
      throw new Error("SecurityError");
    };
    const v = await joinVisit({ channel: () => null, session: blocked, wasDiscarded: false });
    expect(v.isNew).toBe(true);
    v.set("notice");
    expect(v.has("notice")).toBe(true);
    const w = await joinVisit({ channel: blocked, session: blocked, wasDiscarded: false, wait: 20 });
    expect(w.isNew).toBe(true);
  });
});
