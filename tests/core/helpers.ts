// Setups as the acceptance tests write them: "Summarizer 1 to Inspector 1".
import { levelById, levelModel, ref, type LevelModel, type Port } from "../../src/core/level.ts";
import { run, type RunResult } from "../../src/core/run.ts";
import { decodeWires, type SavedWire } from "../../src/core/save.ts";
import { newWiring, type Wire, type Wiring } from "../../src/core/wiring.ts";
import fixture from "../fixtures/level-checks.json";

export const model = (id: number) => levelModel(levelById(id));

/** A port by "ID" or "ID.kind": an output port, or an input port when `out` is false. */
export function port(m: LevelModel, name: string, out: boolean, kind?: string): Port {
  const [id, k] = name.split(".");
  const node = m.nodes.findIndex((n) => n.id === id);
  if (node < 0) throw new Error(`no ${id} on level ${m.level.id}`);
  const ports = out ? m.nodes[node].outputs : m.nodes[node].inputs;
  const i = ports.indexOf((k ?? kind ?? ports[0]) as never);
  if (i < 0) throw new Error(`no ${out ? "output" : "input"} ${k ?? kind} on ${id}`);
  return { node, out, i };
}

/** Wires from [from, to] pairs; the input port takes the kind of the output port. */
export function wires(m: LevelModel, pairs: [string, string][]): Wire[] {
  return pairs.map(([a, b]) => {
    const o = port(m, a, true);
    const i = port(m, b, false, m.nodes[o.node].outputs[o.i]);
    return { from: ref(o.node, o.i), to: ref(i.node, i.i) };
  });
}

export const wiring = (m: LevelModel, pairs: [string, string][]): Wiring => newWiring(wires(m, pairs));

export function runWith(id: number, pairs: [string, string][]): { m: LevelModel; r: RunResult } {
  const m = model(id);
  return { m, r: run(m, wiring(m, pairs)) };
}

type Check = { solution: SavedWire[]; moves: number[]; distinct?: number; kinds: Record<string, SavedWire[]>; longRun?: SavedWire[] };
export const checks = fixture as unknown as Record<string, Check>;

/** A level wired as the level checks print: its solution, a kind of result's wiring, or the long run. */
export function fromChecks(id: number, which: "solution" | "longRun" | string = "solution"): { m: LevelModel; w: Wiring } {
  const m = model(id);
  const c = checks[id];
  const saved = which === "solution" ? c.solution : which === "longRun" ? c.longRun! : c.kinds[which];
  return { m, w: newWiring(decodeWires(m, saved)) };
}
