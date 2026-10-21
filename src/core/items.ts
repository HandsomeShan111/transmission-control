// Item values, ITEM-01 to ITEM-03, and the agents' work, AGENT-03 to AGENT-07.
import { PROPERTIES } from "../content/generated.ts";
import type { Level, Value } from "../content/types.ts";
import { agentKind, type Node } from "./level.ts";

/** An item's values: one scale index per property, in property order. */
export type Values = readonly number[];

export function applyWork(node: Node, values: Values): { out: number | null; values: Values } {
  const a = agentKind(node.kind);
  if (Array.isArray(a.work)) {
    const v = values.slice();
    const top = (p: number) => PROPERTIES[p].scale.length - 1;
    for (const op of a.work) v[op.prop] = "set" in op ? op.set : Math.max(0, Math.min(top(op.prop), v[op.prop] + op.shift));
    return { out: 0, values: v };
  }
  switch (node.kind) {
    case "Inspector":
      return { out: holds(values, node.value!) ? 0 : 1, values };
    case "Rubber Stamp":
    case "Manager":
      return { out: 0, values };
    case "Shredder":
      return { out: null, values };
  }
  throw new Error(`no work for ${node.kind}`);
}

export const holds = (values: Values, t: Value) => values[t.prop] === t.v;

/** LEVEL-05: every value the target names. */
export const meetsTarget = (level: Level, values: Values) => level.target.every((t) => holds(values, t));

export const valueWord = (t: Value) => PROPERTIES[t.prop].scale[t.v];

/** REPORT-05: fills {Length}, {Tone}, {Format}, {Language} and the named extra slots. */
export function fillSlots(line: string, values: Values, extra: Record<string, string> = {}): string {
  return line.replace(/\{(\w+)\}/g, (all, name: string) => {
    if (name in extra) return extra[name];
    const p = PROPERTIES.findIndex((x) => x.name === name);
    if (p < 0) throw new Error(`unknown slot ${all} in: ${line}`);
    return PROPERTIES[p].scale[values[p]];
  });
}
