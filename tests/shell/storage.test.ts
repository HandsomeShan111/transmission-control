// The save in local storage, SAVE-02 to SAVE-04, SAVE-07, with stand-ins for Storage and LockManager.
import { describe, expect, test } from "bun:test";
import { firstSave, parseSave, type SavedWire } from "../../src/core/save.ts";
import { askKeep, createStore, SAVE_KEY } from "../../src/shell/storage.ts";

class MemStorage implements Storage {
  items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(k: string) {
    return this.items.get(k) ?? null;
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.items.delete(k);
  }
  setItem(k: string, v: string) {
    this.items.set(k, v);
  }
}

/** Grants one request at a time, in the order asked, as the Web Locks API does. */
function lockManager(): LockManager {
  let chain: Promise<unknown> = Promise.resolve();
  const request = (_name: string, cb: (lock: Lock | null) => unknown) => {
    const run = chain.then(() => cb(null));
    chain = run.catch(() => {});
    return run;
  };
  return { request, query: async () => ({}) } as unknown as LockManager;
}

/** Level 1's first wire. */
const wire: SavedWire = {
  from: { id: "Input terminal", side: "output", kind: "data", place: 1 },
  to: { id: "Summarizer 1", side: "input", kind: "data", place: 1 },
};
const stored = (m: MemStorage) => parseSave(m.getItem(SAVE_KEY));

describe("Store", () => {
  test("SAVE-03: no save loads as a first visit, and it is stored at once", async () => {
    const m = new MemStorage();
    const s = createStore({ storage: () => m, locks: lockManager() });
    expect(s.load()).toEqual(firstSave());
    expect(s.fresh).toBe(true);
    await s.write();
    expect(stored(m)).toEqual(firstSave());
  });

  test("SAVE-03: a stored save loads", () => {
    const m = new MemStorage();
    const save = { ...firstSave(), won: [1], unlocked: [1, 2], wiring: { 1: [wire] } };
    save.settings.sound = false;
    m.setItem(SAVE_KEY, JSON.stringify(save));
    const s = createStore({ storage: () => m, locks: lockManager() });
    expect(s.load()).toEqual(save);
    expect(s.data).toEqual(save);
    expect(s.fresh).toBe(false);
  });

  test("SAVE-05: a load drops wires whose ports are gone, and stores the result at once", () => {
    const m = new MemStorage();
    const gone: SavedWire = { ...wire, to: { ...wire.to, id: "Summarizer 9" } };
    m.setItem(SAVE_KEY, JSON.stringify({ ...firstSave(), wiring: { 1: [wire, gone] } }));
    const s = createStore({ storage: () => m, locks: undefined });
    expect(s.load().wiring).toEqual({ 1: [wire] });
    expect(stored(m)!.wiring).toEqual({ 1: [wire] });
  });

  test("SAVE-03: unreadable text loads as a first visit", async () => {
    const m = new MemStorage();
    m.setItem(SAVE_KEY, "{not json");
    const s = createStore({ storage: () => m, locks: lockManager() });
    expect(s.load()).toEqual(firstSave());
    await s.write();
    expect(stored(m)).toEqual(firstSave());
  });

  test("SAVE-02: a write stores what SAVE-01 says, and data stays the same object", async () => {
    const m = new MemStorage();
    const s = createStore({ storage: () => m, locks: lockManager() });
    const d = s.load();
    d.won = [1];
    d.unlocked = [1, 2];
    d.wiring[1] = [wire];
    d.settings.music = false;
    d.events.push({ name: "first_level_start", day: "2026-10-20" });
    await s.write();
    expect(stored(m)).toEqual({
      format: 1,
      won: [1],
      unlocked: [1, 2],
      wiring: { 1: [wire] },
      settings: { look: "light", sound: true, music: false, counts: true },
      events: [{ name: "first_level_start", day: "2026-10-20" }],
    });
    expect(s.data).toBe(d);
    expect(s.failed).toBe(false);
  });

  test("SAVE-02: two pages each keep their own changes", async () => {
    const m = new MemStorage();
    const locks = lockManager();
    const a = createStore({ storage: () => m, locks });
    const b = createStore({ storage: () => m, locks });
    a.load();
    b.load();
    a.data.wiring[1] = [wire];
    a.data.settings.sound = false;
    b.data.wiring[2] = [wire];
    b.data.settings.look = "dark";
    await a.write();
    await b.write();
    expect(stored(m)!.wiring).toEqual({ 1: [wire], 2: [wire] });
    expect(stored(m)!.settings).toEqual({ look: "dark", sound: false, music: true, counts: true });
    expect(b.data).toEqual(stored(m)!);
    // Page A's next write adopts B's changes and keeps them.
    a.data.settings.music = false;
    await a.write();
    expect(stored(m)!.settings).toEqual({ look: "dark", sound: false, music: false, counts: true });
    expect(a.data.wiring).toEqual({ 1: [wire], 2: [wire] });
  });

  test("SAVE-02: one page's writes run in order", async () => {
    const m = new MemStorage();
    const s = createStore({ storage: () => m, locks: lockManager() });
    s.load();
    s.data.settings.sound = false;
    const first = s.write();
    s.data.settings.sound = true;
    s.data.settings.music = false;
    await Promise.all([first, s.write()]);
    expect(stored(m)!.settings).toEqual({ look: "light", sound: true, music: false, counts: true });
  });

  test("SAVE-04: blocked storage loads as a first visit; each failed write is told; data stays in memory", async () => {
    const blocked = () => {
      throw new Error("SecurityError");
    };
    const s = createStore({ storage: blocked, locks: lockManager() });
    let told = 0;
    s.onFail(() => told++);
    expect(s.load()).toEqual(firstSave());
    s.data.wiring[1] = [wire];
    await s.write();
    expect(s.failed).toBe(true);
    expect(told).toBe(2);
    expect(s.data.wiring[1]).toEqual([wire]);
    await s.write();
    expect(told).toBe(3);
  });

  test("SAVE-04: a full storage fails the write; a later write tries again", async () => {
    const m = new MemStorage();
    const set = m.setItem.bind(m);
    let full = true;
    m.setItem = (k, v) => {
      if (full) throw new Error("QuotaExceededError");
      set(k, v);
    };
    const s = createStore({ storage: () => m, locks: lockManager() });
    let told = 0;
    s.onFail(() => told++);
    s.load();
    s.data.settings.sound = false;
    await s.write();
    expect([s.failed, told, stored(m)]).toEqual([true, 2, null]);
    full = false;
    await s.write();
    expect(stored(m)!.settings.sound).toBe(false);
    expect([s.failed, told]).toEqual([true, 2]);
  });

  test("No lock manager: the read, merge and store run at once", async () => {
    const m = new MemStorage();
    const a = createStore({ storage: () => m, locks: undefined });
    const b = createStore({ storage: () => m, locks: undefined });
    a.load();
    expect(stored(m)).toEqual(firstSave());
    b.load();
    a.data.settings.sound = false;
    b.data.wiring[3] = [wire];
    const pending = a.write();
    expect(stored(m)!.settings.sound).toBe(false);
    await pending;
    await b.write();
    expect(stored(m)!.settings.sound).toBe(false);
    expect(stored(m)!.wiring).toEqual({ 3: [wire] });
  });
});

describe("askKeep", () => {
  test("SAVE-07: asks for persistent storage; refusals, errors and no StorageManager change nothing", async () => {
    let asked = 0;
    askKeep({ persist: async () => (asked++, false) } as unknown as StorageManager);
    askKeep({ persist: () => Promise.reject(new Error("no")) } as unknown as StorageManager);
    askKeep({} as StorageManager);
    askKeep(undefined);
    await Promise.resolve();
    expect(asked).toBe(1);
  });
});
