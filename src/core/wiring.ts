// Wiring actions and Undo, WIRE-01 to WIRE-05. WIRE-06's lock is the caller's:
// it takes no action while a run is on.
import { portKind, ref, refNode, refPort, type InRef, type LevelModel, type OutRef, type Port } from "./level.ts";

export interface Wire {
  from: OutRef;
  to: InRef;
}

export type WireSound = "connect" | "cut";

/** One wiring action as the wires it took away and the wires it put down. */
interface Action {
  took: Wire[];
  put: Wire[];
}

export interface Wiring {
  /** Each input port's wire, in the order laid: the last is the wire laid last, VIEW-09. */
  wires: Map<InRef, OutRef>;
  /** Actions of this opening of the level, for Undo. */
  done: Action[];
}

/** What a wiring action did. `changed` false: no wire changed, and Undo has nothing new. */
export interface Outcome {
  sound: WireSound;
  changed: boolean;
}

export const newWiring = (wires: Wire[] = []): Wiring => ({ wires: new Map(wires.map((w) => [w.to, w.from])), done: [] });

export const wireList = (s: Wiring): Wire[] => [...s.wires].map(([to, from]) => ({ from, to }));

function apply(s: Wiring, took: Wire[], put: Wire[]) {
  for (const w of took) s.wires.delete(w.to);
  for (const w of put) s.wires.set(w.to, w.from);
}

const same = (a: Wire[], b: Wire[]) => a.length === b.length && a.every((w, k) => w.from === b[k].from && w.to === b[k].to);

function act(s: Wiring, took: Wire[], put: Wire[], sound: WireSound): Outcome {
  apply(s, took, put);
  const changed = !same(took, put);
  if (changed) s.done.push({ took, put });
  return { sound, changed };
}

const wireAt = (s: Wiring, to: InRef): Wire | null => {
  const from = s.wires.get(to);
  return from === undefined ? null : { from, to };
};

/** WIRE-01's pair: an output port and an input port of one port kind, as a wire; else null. */
export function pair(m: LevelModel, a: Port, b: Port): Wire | null {
  if (a.out === b.out) return null;
  const [o, i] = a.out ? [a, b] : [b, a];
  const k = portKind(m, o);
  if (!k || k !== portKind(m, i)) return null;
  return { from: ref(o.node, o.i), to: ref(i.node, i.i) };
}

/** WIRE-01: the player joins two ports. Null: no wire. */
export function join(m: LevelModel, s: Wiring, a: Port, b: Port): Outcome | null {
  const w = pair(m, a, b);
  if (!w) return null;
  const old = wireAt(s, w.to);
  return act(s, old ? [old] : [], [w], "connect");
}

/**
 * WIRE-02: the player moves the `end` of the wire into `to` onto `target`.
 * Null: no wire laid, so the wire stays; also when dropped on the port it came from.
 */
export function move(m: LevelModel, s: Wiring, to: InRef, end: "in" | "out", target: Port): Outcome | null {
  const w = wireAt(s, to);
  if (!w) return null;
  const kept: Port = end === "in" ? { node: refNode(w.from), out: true, i: refPort(w.from) } : { node: refNode(w.to), out: false, i: refPort(w.to) };
  const moved = end === "in" ? w.to : w.from;
  if (target.out === (end === "out") && ref(target.node, target.i) === moved) return null;
  const nw = pair(m, kept, target);
  if (!nw) return null;
  const took = [w];
  const old = nw.to !== w.to ? wireAt(s, nw.to) : null;
  if (old) took.push(old);
  return act(s, took, [nw], "connect");
}

/** WIRE-03. */
export function remove(s: Wiring, to: InRef): Outcome | null {
  const w = wireAt(s, to);
  return w ? act(s, [w], [], "cut") : null;
}

/** WIRE-05. Null: no wire on the level, no action. */
export function clear(s: Wiring): Outcome | null {
  return s.wires.size ? act(s, wireList(s), [], "cut") : null;
}

/** WIRE-04. Null: nothing to undo. */
export function undo(s: Wiring): Outcome | null {
  const a = s.done.pop();
  if (!a) return null;
  apply(s, a.put, a.took);
  return { sound: a.took.length ? "connect" : "cut", changed: true };
}
