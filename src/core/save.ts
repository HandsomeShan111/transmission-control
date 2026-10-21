// What the save holds and how pages' writes join, SAVE-01, SAVE-02, SAVE-05 and SAVE-06.
// Storage itself is the shell's.
import { LEVELS, PARAMS, PORT_KINDS } from "../content/generated.ts";
import type { PortKind } from "../content/types.ts";
import { firstVisit, LEVEL_IDS, unlockAfterWins, type Progress } from "./campaign.ts";
import { levelModel, ref, refNode, refPort, type LevelModel } from "./level.ts";
import type { Wire } from "./wiring.ts";

/** The save's shape. Raise it with a step that reads the older shape. */
export const SAVE_FORMAT = 1;

export interface Settings {
  look: "light" | "dark";
  sound: boolean;
  music: boolean;
  counts: boolean;
}

export const EVENT_NAMES = ["first_level_start", "campaign_finish"] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export interface WaitingEvent {
  name: EventName;
  /** The day it happened, YYYY-MM-DD. */
  day: string;
}

/** A port by its agent's or terminal's ID, its side, its kind and its place top to bottom, from 1. */
export interface SavedPort {
  id: string;
  side: "input" | "output";
  kind: PortKind;
  place: number;
}

export interface SavedWire {
  from: SavedPort;
  to: SavedPort;
}

export interface SaveData {
  format: number;
  won: number[];
  unlocked: number[];
  /** By level ID; a level with no wire has no entry. */
  wiring: Record<string, SavedWire[]>;
  settings: Settings;
  events: WaitingEvent[];
}

export const startSettings = (): Settings => ({
  look: PARAMS.LookStart.value === "dark" ? "dark" : "light",
  sound: PARAMS.SoundStart.value === "on",
  music: PARAMS.MusicStart.value === "on",
  counts: PARAMS.CountsStart.value === "on",
});

export function firstSave(): SaveData {
  const p = firstVisit();
  return { format: SAVE_FORMAT, won: [], unlocked: [...p.unlocked], wiring: {}, settings: startSettings(), events: [] };
}

export const progressOf = (s: SaveData): Progress => ({ won: new Set(s.won), unlocked: new Set(s.unlocked) });

export function setProgress(s: SaveData, p: Progress) {
  s.won = LEVEL_IDS.filter((id) => p.won.has(id));
  s.unlocked = LEVEL_IDS.filter((id) => p.unlocked.has(id));
}

function savedPort(m: LevelModel, r: number, out: boolean): SavedPort {
  const n = m.nodes[refNode(r)];
  return { id: n.id, side: out ? "output" : "input", kind: (out ? n.outputs : n.inputs)[refPort(r)], place: refPort(r) + 1 };
}

export const encodeWires = (m: LevelModel, wires: Wire[]): SavedWire[] => wires.map((w) => ({ from: savedPort(m, w.from, true), to: savedPort(m, w.to, false) }));

/** SAVE-05: a saved wire stays only when both its ports exist under the same names. */
export function decodeWires(m: LevelModel, saved: SavedWire[]): Wire[] {
  const find = (p: SavedPort, out: boolean): number | null => {
    if (p.side !== (out ? "output" : "input")) return null;
    const node = m.nodes.findIndex((n) => n.id === p.id);
    if (node < 0) return null;
    const ports = out ? m.nodes[node].outputs : m.nodes[node].inputs;
    return ports[p.place - 1] === p.kind ? ref(node, p.place - 1) : null;
  };
  const wires = new Map<number, number>();
  for (const w of saved) {
    const from = find(w.from, true);
    const to = find(w.to, false);
    if (from !== null && to !== null && w.from.kind === w.to.kind) wires.set(to, from);
  }
  return [...wires].map(([to, from]) => ({ from, to }));
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isPort = (p: unknown): p is SavedPort =>
  isObj(p) && typeof p.id === "string" && (p.side === "input" || p.side === "output") && PORT_KINDS.includes(p.kind as PortKind) && Number.isInteger(p.place);
const isIds = (v: unknown): v is number[] => Array.isArray(v) && v.every(Number.isInteger);

/** SAVE-03: the stored text as a save, or null when there is none or it cannot be read. */
export function parseSave(text: string | null): SaveData | null {
  if (text === null) return null;
  let s: unknown;
  try {
    s = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(s) || s.format !== SAVE_FORMAT || !isIds(s.won) || !isIds(s.unlocked) || !isObj(s.wiring) || !isObj(s.settings) || !Array.isArray(s.events)) return null;
  const st = s.settings;
  if ((st.look !== "light" && st.look !== "dark") || typeof st.sound !== "boolean" || typeof st.music !== "boolean" || typeof st.counts !== "boolean") return null;
  if (!Object.values(s.wiring).every((ws) => Array.isArray(ws) && ws.every((w) => isObj(w) && isPort(w.from) && isPort(w.to)))) return null;
  const events = s.events as unknown[];
  if (!events.every((e) => isObj(e) && (EVENT_NAMES as readonly unknown[]).includes(e.name) && typeof e.day === "string" && /^\d{4}-\d\d-\d\d$/.test(e.day))) return null;
  return s as unknown as SaveData;
}

/**
 * SAVE-05, at every load: drops saved wires whose ports are gone; drops levels
 * whose ID is gone, then unlocks again from the levels won.
 */
export function upgrade(s: SaveData): SaveData {
  const out: SaveData = structuredClone(s);
  const known = new Set(LEVEL_IDS);
  const gone = [...s.won, ...s.unlocked, ...Object.keys(s.wiring).map(Number)].some((id) => !known.has(id));
  out.won = s.won.filter((id) => known.has(id));
  out.unlocked = s.unlocked.filter((id) => known.has(id));
  out.wiring = {};
  for (const l of LEVELS) {
    const saved = s.wiring[l.id];
    if (!saved) continue;
    const m = levelModel(l);
    const wires = encodeWires(m, decodeWires(m, saved));
    if (wires.length) out.wiring[l.id] = wires;
  }
  if (gone) {
    const p = progressOf(out);
    unlockAfterWins(p);
    setProgress(out, p);
  }
  return out;
}

/** SAVE-06: progress back to a first visit's; settings and waiting events kept. */
export function reset(s: SaveData): SaveData {
  return { ...firstSave(), settings: { ...s.settings }, events: s.events.slice() };
}

export const eventKey = (e: WaitingEvent) => `${e.name}|${e.day}`;
const tally = (es: WaitingEvent[]) => {
  const t = new Map<string, number>();
  for (const e of es) t.set(eventKey(e), (t.get(eventKey(e)) ?? 0) + 1);
  return t;
};
/** Removes one event with this key, if any. */
export function removeEvent(es: WaitingEvent[], key: string) {
  const i = es.findIndex((e) => eventKey(e) === key);
  if (i >= 0) es.splice(i, 1);
}

/**
 * SAVE-02 with two pages: `stored` is the save as it is now, `base` the save this
 * page last read or wrote, `mine` this page's save. Only this page's changes since
 * `base` go onto `stored`; for one level's wiring or one setting, this write stands.
 */
export function merge(stored: SaveData | null, base: SaveData, mine: SaveData): SaveData {
  if (!stored) return structuredClone(mine);
  const out: SaveData = structuredClone(stored);
  for (const key of ["won", "unlocked"] as const) {
    const b = new Set(base[key]);
    const m = new Set(mine[key]);
    const o = new Set(out[key]);
    for (const id of new Set([...b, ...m])) {
      if (b.has(id) === m.has(id)) continue;
      if (m.has(id)) o.add(id);
      else o.delete(id);
    }
    out[key] = LEVEL_IDS.filter((id) => o.has(id));
  }
  for (const id of new Set([...Object.keys(base.wiring), ...Object.keys(mine.wiring)])) {
    if (JSON.stringify(base.wiring[id]) === JSON.stringify(mine.wiring[id])) continue;
    if (mine.wiring[id]) out.wiring[id] = structuredClone(mine.wiring[id]);
    else delete out.wiring[id];
  }
  for (const k of Object.keys(mine.settings) as (keyof Settings)[]) {
    if (base.settings[k] !== mine.settings[k]) (out.settings as unknown as Record<string, unknown>)[k] = mine.settings[k];
  }
  // Events count: two of one name on one day stay two. This page's added or removed ones go onto stored.
  const b = tally(base.events);
  const m = tally(mine.events);
  for (const k of new Set([...b.keys(), ...m.keys()])) {
    const d = (m.get(k) ?? 0) - (b.get(k) ?? 0);
    if (d > 0) out.events.push(...mine.events.filter((e) => eventKey(e) === k).slice(0, d).map((e) => ({ ...e })));
    for (let i = 0; i < -d; i++) removeEvent(out.events, k);
  }
  // MEAS-03: Counts off, in this page or another, drops the waiting events.
  if (!out.settings.counts) out.events = [];
  return out;
}
