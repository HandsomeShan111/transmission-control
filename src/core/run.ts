// A run, computed whole at Launch: RUN-02 to RUN-08, RUN-14, and the win of LEVEL-06.
// Playback replays the timeline; the report reads the same result.
import type { ResultKind } from "../content/types.ts";
import { applyWork, meetsTarget, type Values } from "./items.ts";
import { comparePorts, inPort, outPort, param, ref, refNode, refPort, type InRef, type LevelModel, type OutRef, type Port } from "./level.ts";
import type { Wiring } from "./wiring.ts";

export type StopKind = "arrived" | "dropped" | "shredded" | "loop" | "overloaded";

/** A time an agent worked on the copy or an item it came from. */
export interface Visit {
  node: number;
  /** The input port it reached the agent by. */
  inPort: number;
  /** Values after the work. */
  after: Values;
}

export interface Copy {
  input: number;
  /** Values at the stop. */
  values: Values;
  stop: StopKind;
  /** RUN-13's place: an output port for dropped and overloaded, else an input port. */
  port: Port;
  /** Stop time in steps since its input was sent: a move or a work is one step. */
  step: number;
  /** Input port reached by each move, the items it came from included. */
  route: InRef[];
  visits: Visit[];
}

export interface Move {
  input: number;
  from: OutRef;
  to: InRef;
  /** Start, in seconds since Launch; it takes MoveTime. */
  t: number;
  values: Values;
}

export interface Work {
  node: number;
  /** Start, in seconds since Launch; it takes WorkTime. */
  t: number;
}

export interface Timeline {
  moves: Move[];
  works: Work[];
  /** Each copy's stop, in seconds since Launch, by index into the copies. */
  stops: { copy: number; t: number }[];
  /** RUN-14's readout: an input's moves so far, from time t. */
  counts: { input: number; t: number; moves: number }[];
  /** Time the run ends, RUN-08. */
  end: number;
}

export interface RunResult {
  /** By input; within one, compareStops gives their order. */
  copies: Copy[];
  won: boolean;
  /** REPORT-02, null when won. */
  kind: ResultKind | null;
  /** Agents a copy reached and wires a copy moved along, REPORT-06. */
  agents: Set<number>;
  wires: Set<string>;
  movesPerInput: number[];
  timeline: Timeline;
}

export interface RunTimes {
  moveTime: number;
  workTime: number;
  maxMoves: number;
}

export const startTimes = (): RunTimes => ({ moveTime: param("MoveTime"), workTime: param("WorkTime"), maxMoves: param("MaxMoves") });

interface Live {
  values: Values;
  history: Set<string>;
  route: InRef[];
  visits: Visit[];
}

export function run(m: LevelModel, wiring: Wiring, times = startTimes()): RunResult {
  const { moveTime, workTime, maxMoves } = times;
  const from = new Map<OutRef, InRef[]>();
  for (const [to, o] of wiring.wires) from.set(o, [...(from.get(o) ?? []), to]);
  const copies: Copy[] = [];
  const tl: Timeline = { moves: [], works: [], stops: [], counts: [], end: 0 };
  const agents = new Set<number>();
  const wires = new Set<string>();
  const movesPerInput: number[] = [];
  let start = 0;

  m.level.inputs.forEach((vals, input) => {
    // Step s starts at this time: an even step is a move, an odd one a work.
    const at = (s: number) => start + Math.floor(s / 2) * (moveTime + workTime) + (s % 2) * moveTime;
    let last = 0;
    const stop = (c: Live, kind: StopKind, port: Port, step: number) => {
      tl.stops.push({ copy: copies.length, t: at(step) });
      copies.push({ input, values: c.values, stop: kind, port, step, route: c.route, visits: c.visits });
      last = Math.max(last, step);
    };
    let moves = 0;
    let leaving: { c: Live; out: OutRef }[] = [{ c: { values: vals, history: new Set(), route: [], visits: [] }, out: ref(m.input, 0) }];
    tl.counts.push({ input, t: at(0), moves: 0 });
    for (let step = 0; leaving.length; step += 2) {
      const moving: { c: Live; out: OutRef; to: InRef[] }[] = [];
      for (const l of leaving) {
        const to = from.get(l.out);
        if (to) moving.push({ ...l, to });
        else stop(l.c, "dropped", outPort(l.out), step);
      }
      if (!moving.length) break;
      const n = moving.reduce((s, x) => s + x.to.length, 0);
      if (moves + n > maxMoves) {
        for (const x of moving) stop(x.c, "overloaded", outPort(x.out), step);
        break;
      }
      moves += n;
      tl.counts.push({ input, t: at(step), moves });
      const next: { c: Live; out: OutRef }[] = [];
      for (const x of moving) {
        for (const dest of x.to) {
          const c: Live = x.to.length === 1 ? x.c : { values: x.c.values, history: new Set(x.c.history), route: x.c.route.slice(), visits: x.c.visits.slice() };
          tl.moves.push({ input, from: x.out, to: dest, t: at(step), values: c.values });
          wires.add(`${x.out}>${dest}`);
          c.route.push(dest);
          const key = `${dest}|${c.values.join()}`;
          const node = m.nodes[refNode(dest)];
          if (c.history.has(key)) {
            stop(c, "loop", inPort(dest), step + 1);
            continue;
          }
          c.history.add(key);
          if (node.terminal === "out") {
            stop(c, "arrived", inPort(dest), step + 1);
            continue;
          }
          agents.add(refNode(dest));
          tl.works.push({ node: refNode(dest), t: at(step + 1) });
          const w = applyWork(node, c.values);
          c.values = w.values;
          c.visits.push({ node: refNode(dest), inPort: refPort(dest), after: w.values });
          if (w.out === null) stop(c, "shredded", inPort(dest), step + 2);
          else next.push({ c, out: ref(refNode(dest), w.out) });
        }
      }
      leaving = next;
    }
    movesPerInput.push(moves);
    start = at(last);
  });
  tl.end = start;

  const lv = m.level;
  const arrived = copies.filter((c) => c.stop === "arrived");
  const has = (k: StopKind) => copies.some((c) => c.stop === k);
  const everyInput = lv.inputs.every((_, i) => arrived.some((c) => c.input === i));
  const meeting = arrived.filter((c) => meetsTarget(lv, c.values)).length;
  const won = everyInput && meeting === arrived.length && !has("loop") && !has("overloaded") && !has("dropped");
  let kind: ResultKind | null = null;
  if (!won) {
    if (has("overloaded")) kind = "Overload";
    else if (has("loop")) kind = "Loop";
    else if (!arrived.length) kind = "Nothing arrived";
    else if (has("dropped")) kind = "Dropped";
    else if (!everyInput) kind = "Shredded";
    else if (meeting === 0) kind = "All wrong";
    else kind = "Partly right";
  }
  return { copies, won, kind, agents, wires, movesPerInput, timeline: tl };
}

/**
 * REPORT-04's tie order for copies that stop at once: by where they stop,
 * then, at one port, by the wire each took where their paths part.
 */
export function compareStops(m: LevelModel, a: Copy, b: Copy): number {
  if (a.input !== b.input) return a.input - b.input;
  if (a.step !== b.step) return a.step - b.step;
  const byPort = comparePorts(m, a.port, b.port);
  if (byPort) return byPort;
  const k = a.route.findIndex((r, j) => r !== b.route[j]);
  return k < 0 ? 0 : comparePorts(m, inPort(a.route[k]), inPort(b.route[k]));
}
