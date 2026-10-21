// The report's lines, REPORT-02 to REPORT-06.
import { COUNTS_LINE } from "../content/generated.ts";
import { fillSlots, meetsTarget } from "./items.ts";
import { agentKind, param, type LevelModel } from "./level.ts";
import { compareStops, type Copy, type RunResult } from "./run.ts";

export interface Report {
  won: boolean;
  /** The level line, then agent lines when lost or the counts line when won. */
  lines: string[];
  /** REPORT-04's followed copy, null when won. */
  followed: Copy | null;
}

/** REPORT-04: the copy a lost run's report follows. */
export function followed(m: LevelModel, r: RunResult): Copy | null {
  const first = (cs: Copy[]) => cs.slice().sort((a, b) => compareStops(m, a, b))[0] ?? null;
  const missed = (c: Copy) => c.stop === "arrived" && !meetsTarget(m.level, c.values);
  switch (r.kind) {
    case null:
      return null;
    case "Overload":
      return first(r.copies.filter((c) => c.stop === "overloaded"));
    case "Loop":
      return first(r.copies.filter((c) => c.stop === "loop"));
    case "Nothing arrived":
      return first(r.copies);
    case "Dropped":
      return first(r.copies.filter((c) => c.stop === "dropped"));
    case "Shredded": {
      const input = m.level.inputs.findIndex((_, i) => !r.copies.some((c) => c.input === i && c.stop === "arrived"));
      return first(r.copies.filter((c) => c.input === input && c.stop === "shredded"));
    }
    case "All wrong":
    case "Partly right":
      return first(r.copies.filter(missed));
  }
}

export function report(m: LevelModel, r: RunResult, reportAgents = param("ReportAgents")): Report {
  const words = m.level.words;
  if (r.won) {
    const counts = fillSlots(COUNTS_LINE, [], { Agents: String(r.agents.size), Wires: String(r.wires.size) });
    return { won: true, lines: [words.win, counts], followed: null };
  }
  const c = followed(m, r)!;
  const line = words.lines[r.kind!];
  if (line === undefined) throw new Error(`level ${m.level.id} has no line for ${r.kind}`);
  const agentLines = c.visits.slice(-reportAgents).map((v) => {
    const node = m.nodes[v.node];
    const kind = node.inputs[v.inPort];
    const l = agentKind(node.kind).lines[kind];
    if (l === undefined) throw new Error(`${node.kind} has no line for its ${kind} input`);
    return fillSlots(l, v.after, { Agent: node.id });
  });
  return { won: false, lines: [fillSlots(line, c.values), ...agentLines], followed: c };
}
