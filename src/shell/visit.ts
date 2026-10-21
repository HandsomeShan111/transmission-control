// The visit, APP-04: from a page of the game opening while no other page of it is open, until
// every page of it has closed. A reload keeps it; a discarded tab opened again starts a new one.
// Its flags, such as SAVE-04's once-a-visit notice, are shared by its open pages.

export interface VisitDeps {
  channel: (name: string) => BroadcastChannel | null;
  session: () => Storage;
  wasDiscarded: boolean;
  wait?: number;
}

export interface Visit {
  readonly isNew: boolean;
  /** visit-wide flags shared with the other open pages, such as "notice" for SAVE-04's once-a-visit notice */
  has(flag: string): boolean;
  set(flag: string): void;
  close(): void;
}

const NAME = "transmission-control-visit";

type Message = { ask: true } | { flags: string[] } | { set: string };

export async function joinVisit(deps: VisitDeps): Promise<Visit> {
  let flags = new Set<string>();
  let marked: string[] | null = null;
  try {
    const text = deps.session().getItem(NAME);
    if (text !== null) {
      const v: unknown = JSON.parse(text);
      marked = Array.isArray(v) ? v.filter((f) => typeof f === "string") : [];
    }
  } catch {
    // No session storage: as unmarked.
  }
  const mark = () => {
    try {
      deps.session().setItem(NAME, JSON.stringify([...flags]));
    } catch {
      // No session storage: a reload alone cannot tell it is one.
    }
  };
  let ch: BroadcastChannel | null = null;
  try {
    ch = deps.channel(NAME);
  } catch {
    // No channel: this page cannot hear the others.
  }
  const post = (m: Message) => {
    try {
      ch?.postMessage(m);
    } catch {
      // Channel closed.
    }
  };
  let joined = false;
  let answered = () => {};
  let heard = false;
  if (ch) {
    ch.onmessage = (e: MessageEvent<Message>) => {
      const m = e.data;
      if (typeof m !== "object" || m === null) return;
      // A page still asking is not yet in a visit, so it does not answer.
      if ("ask" in m) {
        if (joined) post({ flags: [...flags] });
        return;
      }
      if ("flags" in m) {
        heard = true;
        answered();
      }
      for (const f of "flags" in m ? m.flags : [m.set]) flags.add(f);
      if (joined) mark();
    };
    post({ ask: true });
    await new Promise<void>((done) => {
      answered = done;
      setTimeout(done, deps.wait ?? 150);
    });
  }
  const isNew = !heard && !(marked && !deps.wasDiscarded);
  if (!heard) flags = new Set(isNew ? [] : marked);
  joined = true;
  mark();
  return {
    isNew,
    has: (flag) => flags.has(flag),
    set(flag) {
      flags.add(flag);
      mark();
      post({ set: flag });
    },
    close() {
      ch?.close();
      ch = null;
    },
  };
}
