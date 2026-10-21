// Level checks: every wiring of levels 1 to 12, a search on levels 13 to 18.
// Fails when LEVEL-01, LEVEL-02 or REPORT-03 does not hold. Writes
// tests/fixtures/level-checks.json for the tests. Run: bun run levelcheck
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { LEVELS } from "../src/content/generated.ts";
import { RESULT_KINDS, type Level, type PortKind, type ResultKind } from "../src/content/types.ts";
import { applyWork, meetsTarget } from "../src/core/items.ts";
import { levelModel, param, ref, refNode, refPort, type InRef, type LevelModel, type OutRef } from "../src/core/level.ts";
import { run } from "../src/core/run.ts";
import { encodeWires, type SavedWire } from "../src/core/save.ts";
import { newWiring, type Wire } from "../src/core/wiring.ts";

export const FIXTURE = join(import.meta.dir, "../tests/fixtures/level-checks.json");

export interface LevelCheck {
  /** Distinct solutions: none of its wires can go, up to agents of one kind and value swapped. Levels 1 to 12. */
  distinct?: number;
  /** The solution with fewest wires, and each input's moves in it. */
  solution: SavedWire[];
  moves: number[];
  /** A wiring for each kind of result the level reaches. */
  kinds: Partial<Record<ResultKind, SavedWire[]>>;
  /** Level 18: a wiring that overloads an input. */
  longRun?: SavedWire[];
}

const ENUM_LAST = 12;

/** Every input port's choices: no wire, or any output port of its kind. */
function choices(m: LevelModel): { to: InRef; opts: (OutRef | -1)[] }[] {
  const outs: { r: OutRef; k: PortKind }[] = [];
  m.nodes.forEach((n, ni) => n.outputs.forEach((k, pi) => outs.push({ r: ref(ni, pi), k })));
  const res: { to: InRef; opts: (OutRef | -1)[] }[] = [];
  m.nodes.forEach((n, ni) => n.inputs.forEach((k, pi) => res.push({ to: ref(ni, pi), opts: [-1, ...outs.filter((o) => o.k === k).map((o) => o.r)] })));
  return res;
}

const wins = (m: LevelModel, ws: Wire[]) => run(m, newWiring(ws)).won;
const minimal = (m: LevelModel, ws: Wire[]) => ws.every((_, k) => !wins(m, ws.filter((__, j) => j !== k)));

/** A wiring's key with agents of one kind and value swapped in every way, the least kept. */
function canon(m: LevelModel, ws: Wire[]): string {
  const groups = new Map<string, number[]>();
  m.nodes.forEach((n, i) => {
    if (n.terminal) return;
    const key = n.kind + (n.value ? `${n.value.prop}:${n.value.v}` : "");
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  const permute = (a: number[]): number[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => permute([...a.slice(0, i), ...a.slice(i + 1)]).map((r) => [x, ...r])));
  let maps: number[][] = [m.nodes.map((_, i) => i)];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    maps = maps.flatMap((p) => permute(g).map((q) => { const np = p.slice(); g.forEach((orig, k) => (np[orig] = q[k])); return np; }));
  }
  const keys = maps.map((p) =>
    ws.map((w) => [ref(p[refNode(w.to)], refPort(w.to)), ref(p[refNode(w.from)], refPort(w.from))]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x.join(">")).join(","),
  );
  return keys.sort()[0];
}

interface Found {
  solutions: Wire[][];
  kinds: Map<ResultKind, Wire[]>;
  distinct?: number;
  longRun?: Wire[];
}

const fewer = (a: Wire[] | undefined, b: Wire[]) => !a || b.length < a.length;

function enumerate(m: LevelModel): Found {
  const ch = choices(m);
  const kinds = new Map<ResultKind, Wire[]>();
  const solutions: Wire[][] = [];
  const idx = new Array(ch.length).fill(0);
  for (;;) {
    const ws: Wire[] = [];
    ch.forEach((c, k) => c.opts[idx[k]] !== -1 && ws.push({ from: c.opts[idx[k]], to: c.to }));
    const r = run(m, newWiring(ws));
    if (r.won) solutions.push(ws);
    else if (fewer(kinds.get(r.kind!), ws)) kinds.set(r.kind!, ws);
    let k = 0;
    for (; k < ch.length; k++) {
      if (++idx[k] < ch[k].opts.length) break;
      idx[k] = 0;
    }
    if (k === ch.length) break;
  }
  const distinct = new Set(solutions.filter((ws) => minimal(m, ws)).map((ws) => canon(m, ws))).size;
  return { solutions, kinds, distinct };
}

/** A search that wires each output port only when an item first leaves by it, up to two wires a port. */
function search(m: LevelModel, limit = 50, budget = 2_000_000): Wire[][] {
  const maxMoves = param("MaxMoves");
  const ch = choices(m);
  const inKind = (to: InRef) => m.nodes[refNode(to)].inputs[refPort(to)];
  const outKind = (o: OutRef) => m.nodes[refNode(o)].outputs[refPort(o)];
  const sols: Wire[][] = [];
  let steps = 0;
  type Probe = { need: OutRef } | "lost" | "won";
  const probe = (w: Map<InRef, OutRef>, decided: Set<OutRef>): Probe => {
    const from = new Map<OutRef, InRef[]>();
    for (const [to, o] of w) from.set(o, [...(from.get(o) ?? []), to]);
    for (const vals of m.level.inputs) {
      let moves = 0;
      let arrived = false;
      let leaving = [{ v: vals as readonly number[], h: new Set<string>(), out: ref(m.input, 0) }];
      while (leaving.length) {
        for (const l of leaving) if (!decided.has(l.out)) return { need: l.out };
        let n = 0;
        for (const l of leaving) {
          const to = from.get(l.out) ?? [];
          if (!to.length) return "lost";
          n += to.length;
        }
        if ((moves += n) > maxMoves) return "lost";
        const next: typeof leaving = [];
        for (const l of leaving) {
          for (const dest of from.get(l.out)!) {
            const key = `${dest}|${l.v.join()}`;
            if (l.h.has(key)) return "lost";
            const h = new Set(l.h).add(key);
            const node = m.nodes[refNode(dest)];
            if (node.terminal === "out") {
              if (!meetsTarget(m.level, l.v)) return "lost";
              arrived = true;
              continue;
            }
            const r = applyWork(node, l.v);
            if (r.out !== null) next.push({ v: r.values, h, out: ref(refNode(dest), r.out) });
          }
        }
        leaving = next;
      }
      if (!arrived) return "lost";
    }
    return "won";
  };
  const dfs = (w: Map<InRef, OutRef>, decided: Set<OutRef>) => {
    if (sols.length >= limit || ++steps > budget) return;
    const p = probe(w, decided);
    if (p === "lost") return;
    if (p === "won") {
      sols.push([...w].map(([to, from]) => ({ from, to })));
      return;
    }
    const free = ch.map((c) => c.to).filter((to) => !w.has(to) && inKind(to) === outKind(p.need));
    const sets = [...free.map((a) => [a]), ...free.flatMap((a, i) => free.slice(i + 1).map((b) => [a, b]))];
    for (const s of sets) {
      const w2 = new Map(w);
      for (const to of s) w2.set(to, p.need);
      dfs(w2, new Set(decided).add(p.need));
    }
  };
  dfs(new Map(), new Set());
  return sols.filter((ws) => wins(m, ws));
}

/** Random wirings, the same each run, for the kinds of result a level reaches. */
function sample(m: LevelModel, tries = 60_000): Pick<Found, "kinds" | "longRun"> {
  let seed = 12345 + m.level.id;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000;
  const ch = choices(m);
  const kinds = new Map<ResultKind, Wire[]>();
  let longRun: Wire[] | undefined;
  let worst = 0;
  for (let s = 0; s < tries; s++) {
    const ws: Wire[] = [];
    for (const c of ch) {
      const o = c.opts[Math.floor(rnd() * c.opts.length)];
      if (o !== -1) ws.push({ from: o, to: c.to });
    }
    const r = run(m, newWiring(ws));
    if (!r.won && fewer(kinds.get(r.kind!), ws)) kinds.set(r.kind!, ws);
    const over = r.copies.filter((c) => c.stop === "overloaded");
    const score = new Set(over.map((c) => c.input)).size * 1000 + over.length;
    if (score > worst) [worst, longRun] = [score, ws];
  }
  return { kinds, longRun };
}

/** LEVEL-02: kinds new on a level, agent kinds and port kinds a wire can be laid with. */
function newKinds(levels: Level[]): Map<number, string[]> {
  const seen = new Set<string>();
  const out = new Map<number, string[]>();
  for (const l of levels) {
    const m = levelModel(l);
    const here = new Set<string>();
    for (const n of m.nodes) if (!n.terminal) here.add(n.kind);
    for (const k of ["data", "positive", "negative"] as PortKind[])
      if (m.nodes.some((n) => n.outputs.includes(k)) && m.nodes.some((n) => n.inputs.includes(k))) here.add(`${k} wires`);
    out.set(l.id, [...here].filter((k) => !seen.has(k)));
    here.forEach((k) => seen.add(k));
  }
  return out;
}

function uses(m: LevelModel, ws: Wire[], kind: string): boolean {
  if (kind.endsWith(" wires")) return ws.some((w) => m.nodes[refNode(w.to)].inputs[refPort(w.to)] === kind.slice(0, -6));
  return ws.some((w) => m.nodes[refNode(w.to)].kind === kind || m.nodes[refNode(w.from)].kind === kind);
}

export function check(levels = LEVELS): { checks: Record<string, LevelCheck>; faults: string[]; log: string[] } {
  const faults: string[] = [];
  const log: string[] = [];
  const checks: Record<string, LevelCheck> = {};
  const fresh = newKinds(levels);
  for (const l of levels) {
    const m = levelModel(l);
    const agents = m.nodes.filter((n) => !n.terminal).length;
    if (agents > param("MaxAgents")) faults.push(`level ${l.id}: ${agents} agents, more than MaxAgents`);
    if (l.inputs.length > param("MaxInputs")) faults.push(`level ${l.id}: ${l.inputs.length} inputs, more than MaxInputs`);
    const found: Found = l.id <= ENUM_LAST ? enumerate(m) : { solutions: search(m), ...sample(m) };
    const sols = found.solutions.filter((ws) => minimal(m, ws)).sort((a, b) => a.length - b.length);
    if (!sols.length) {
      faults.push(`level ${l.id}: no solution found`);
      continue;
    }
    for (const k of fresh.get(l.id)!) if (!sols.some((ws) => uses(m, ws, k))) faults.push(`level ${l.id}: no solution uses ${k}, new here`);
    for (const k of RESULT_KINDS) {
      const line = l.words.lines[k] !== undefined;
      const reached = found.kinds.has(k);
      if (line && !reached) faults.push(`level ${l.id}: ${k} has a level line, and no wiring found reaches it`);
      if (!line && reached) faults.push(`level ${l.id}: ${k} is reached, and has no level line`);
    }
    const best = sols[0];
    const r = run(m, newWiring(best));
    checks[l.id] = {
      ...(found.distinct !== undefined && { distinct: found.distinct }),
      solution: encodeWires(m, best),
      moves: r.movesPerInput,
      kinds: Object.fromEntries(RESULT_KINDS.filter((k) => found.kinds.has(k)).map((k) => [k, encodeWires(m, found.kinds.get(k)!)])),
      ...(l.id === levels[levels.length - 1].id && found.longRun && { longRun: encodeWires(m, found.longRun) }),
    };
    log.push(`level ${l.id}: ${found.distinct ?? "-"} distinct, best ${best.length} wires, moves ${r.movesPerInput.join(",")}; kinds ${RESULT_KINDS.filter((k) => found.kinds.has(k)).join(", ")}`);
  }
  return { checks, faults, log };
}

if (import.meta.main) {
  const t = performance.now();
  const { checks, faults, log } = check();
  for (const line of log) console.log(line);
  console.log(`${Math.round(performance.now() - t)} ms`);
  if (faults.length) {
    for (const f of faults) console.error(`FAULT ${f}`);
    process.exit(1);
  }
  writeFileSync(FIXTURE, JSON.stringify(checks, null, 1) + "\n");
  console.log(`wrote ${FIXTURE}`);
}
