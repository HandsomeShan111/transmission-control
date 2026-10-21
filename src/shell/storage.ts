// The save in the browser's local storage: SAVE-02 to SAVE-05, SAVE-07. What it holds and how
// two pages' writes join: core/save.ts.
import { firstSave, merge, parseSave, upgrade, type SaveData } from "../core/save.ts";

export const SAVE_KEY = "transmission-control-save";

export interface StoreDeps {
  storage: () => Storage;
  locks: LockManager | undefined;
}

export interface Store {
  /** SAVE-03 and SAVE-05: parseSave, then upgrade; no save or a failed read → firstSave(). */
  load(): SaveData;
  /** The save this page holds: change it, then call write(). It stays the same object. */
  readonly data: SaveData;
  /** SAVE-02: merge this page's changes since its last read onto the stored save, store it, and adopt the result. */
  write(): Promise<void>;
  /** True when load() found no save: a first visit, SAVE-03. */
  readonly fresh: boolean;
  /** True once any write of this page failed, SAVE-04. */
  readonly failed: boolean;
  onFail(fn: () => void): void;
}

export function createStore(deps: StoreDeps): Store {
  const data = firstSave();
  /** The save as this page last read or wrote it. */
  let base = firstSave();
  let failed = false;
  let fresh = false;
  const listeners: (() => void)[] = [];
  const adopt = (s: SaveData) => {
    base = structuredClone(s);
    Object.assign(data, structuredClone(s));
  };
  // Runs whole within one task, so no change of this page falls between the read and the adopt.
  const store = () => {
    const storage = deps.storage();
    const out = merge(parseSave(storage.getItem(SAVE_KEY)), base, data);
    storage.setItem(SAVE_KEY, JSON.stringify(out));
    adopt(out);
  };
  async function write() {
    try {
      if (deps.locks) await deps.locks.request(SAVE_KEY, store);
      else store();
    } catch {
      // SAVE-04: play goes on with the save in memory; a later write tries again.
      failed = true;
      for (const fn of listeners) fn();
    }
  }
  return {
    load() {
      let stored: SaveData | null = null;
      try {
        stored = parseSave(deps.storage().getItem(SAVE_KEY));
      } catch {
        // SAVE-03: a failed read is as no save.
      }
      fresh = !stored;
      const loaded = stored ? upgrade(stored) : firstSave();
      adopt(stored ?? loaded);
      Object.assign(data, loaded);
      // Once written, the save stays, SAVE-02; an upgraded one is stored at once, SAVE-05.
      if (!stored || JSON.stringify(loaded) !== JSON.stringify(stored)) void write();
      return data;
    },
    get data() {
      return data;
    },
    write,
    get fresh() {
      return fresh;
    },
    get failed() {
      return failed;
    },
    onFail(fn) {
      listeners.push(fn);
    },
  };
}

/** SAVE-07: asks the browser to keep the game's data; the answer changes nothing in play. */
export function askKeep(storage: StorageManager | undefined) {
  try {
    storage?.persist().catch(() => {});
  } catch {
    // No persistent storage here: nothing to ask.
  }
}
