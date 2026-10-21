// A level's places as nodes with ports, LEVEL-01 and AGENT-01/02.
import { AGENTS, LEVELS, PARAMS, TERMINALS } from "../content/generated.ts";
import type { AgentKind, Level, PortKind, Value } from "../content/types.ts";

export interface Node {
  /** Agent or terminal ID, as Levels spells it: "Summarizer 1", "Input terminal". */
  id: string;
  kind: string;
  col: number;
  row: number;
  inputs: PortKind[];
  outputs: PortKind[];
  /** An inspector's value, AGENT-04. */
  value?: Value;
  terminal?: "in" | "out";
}

export interface LevelModel {
  level: Level;
  nodes: Node[];
  /** Node index of each terminal. */
  input: number;
  output: number;
  cols: number;
  rows: number;
}

/** A port: node index, side and index from the top of its edge. */
export interface Port {
  node: number;
  out: boolean;
  i: number;
}

/** Ports as numbers, one space for input ports and one for output ports. */
export type InRef = number;
export type OutRef = number;
export const ref = (node: number, i: number) => node * 4 + i;
export const refNode = (r: number) => r >> 2;
export const refPort = (r: number) => r & 3;

export const param = (name: string): number => {
  const v = PARAMS[name]?.value;
  if (typeof v !== "number") throw new Error(`no number parameter ${name}`);
  return v;
};

export function agentKind(kind: string): AgentKind {
  const a = AGENTS.find((x) => x.kind === kind);
  if (!a) throw new Error(`no agent kind ${kind}`);
  return a;
}

export function levelById(id: number): Level {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error(`no level ${id}`);
  return l;
}

const cache = new Map<Level, LevelModel>();

export function levelModel(level: Level): LevelModel {
  const hit = cache.get(level);
  if (hit) return hit;
  const nodes: Node[] = [];
  level.rows.forEach((row, r) =>
    row.forEach((p, c) => {
      if (!p) return;
      if ("terminal" in p) {
        const t = TERMINALS.find((x) => x.name === p.terminal)!;
        nodes.push({ id: t.name, kind: t.name, col: c, row: r, inputs: t.inputs, outputs: t.outputs, terminal: p.terminal === "Input terminal" ? "in" : "out" });
      } else {
        const a = agentKind(p.kind);
        nodes.push({ id: `${p.kind} ${p.number}`, kind: p.kind, col: c, row: r, inputs: a.inputs, outputs: a.outputs, value: p.value });
      }
    }),
  );
  const m: LevelModel = {
    level,
    nodes,
    input: nodes.findIndex((n) => n.terminal === "in"),
    output: nodes.findIndex((n) => n.terminal === "out"),
    cols: Math.max(...level.rows.map((r) => r.length)),
    rows: level.rows.length,
  };
  cache.set(level, m);
  return m;
}

export function portKind(m: LevelModel, p: Port): PortKind | undefined {
  const n = m.nodes[p.node];
  return (p.out ? n.outputs : n.inputs)[p.i];
}

export const inPort = (r: InRef): Port => ({ node: refNode(r), out: false, i: refPort(r) });
export const outPort = (r: OutRef): Port => ({ node: refNode(r), out: true, i: refPort(r) });

/**
 * REPORT-04's order of places where copies stop: the level's column, then
 * row, then port, input ports before output ports, each from the top.
 */
export function comparePorts(m: LevelModel, a: Port, b: Port): number {
  const na = m.nodes[a.node];
  const nb = m.nodes[b.node];
  return na.col - nb.col || na.row - nb.row || Number(a.out) - Number(b.out) || a.i - b.i;
}
