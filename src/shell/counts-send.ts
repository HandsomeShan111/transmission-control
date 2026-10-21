// Sending the waiting play counts, MEAS-03: each by its name only, no identifier, to GoatCounter
// as an event. A sent event leaves the save; one not sent goes again at a later visit.
import { eventKey, removeEvent, type SaveData, type WaitingEvent } from "../core/save.ts";

export interface SendDeps {
  address: string;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

/** Sends each waiting event of the save; removes each one sent from s.events; true when any left. Empty address: sends nothing, events wait. */
export async function sendWaiting(s: SaveData, deps: SendDeps): Promise<boolean> {
  if (!deps.address) return s.events.length > 0;
  const sent: WaitingEvent[] = [];
  await Promise.all(
    s.events.map(async (e) => {
      const url = new URL("/count", deps.address);
      url.searchParams.set("p", e.name);
      url.searchParams.set("e", "true");
      try {
        await deps.fetch(url.href, { mode: "no-cors", credentials: "omit", cache: "no-store" });
        sent.push(e);
      } catch {
        // No network, or refused: it waits.
      }
    }),
  );
  // The save may have been written meanwhile, so events go by name and day, not by object: one for each sent.
  for (const e of sent) removeEvent(s.events, eventKey(e));
  return s.events.length > 0;
}
