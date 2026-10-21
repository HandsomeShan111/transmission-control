// Play counts waiting in the save, MEAS-01 to MEAS-03. Sending is the shell's.
import type { EventName, SaveData } from "./save.ts";

/** CNIL's tracer lifetime, in months. */
export const TRACER_MONTHS = 13;

/** The day of a moment, YYYY-MM-DD, in UTC. */
export const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/** MEAS-03: the event waits in the save while counts are on; else nothing happens. */
export function record(s: SaveData, name: EventName, day: string): boolean {
  if (!s.settings.counts) return false;
  s.events.push({ name, day });
  return true;
}

/** Drops events older than the tracer lifetime. True when one went. */
export function expire(s: SaveData, today: string): boolean {
  const [y, m, d] = today.split("-").map(Number);
  const limit = dayOf(new Date(Date.UTC(y, m - 1 - TRACER_MONTHS, d)));
  const n = s.events.length;
  s.events = s.events.filter((e) => e.day >= limit);
  return s.events.length !== n;
}

/** MEAS-03: counts switched off, so waiting events are dropped. */
export function countsOff(s: SaveData) {
  s.events = [];
}
