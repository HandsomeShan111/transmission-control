// The play area's layers at full size, bottom to top: cards and terminals, wires, tokens.
// ART-05 to ART-08, Play's Layout, UI style's Readout and Lamp, AGENT-04, AGENT-08, RUN-13, RUN-14.
import type { PortKind } from "../content/types.ts";
import { valueWord, type Values } from "../core/items.ts";
import { agentKind, comparePorts, outPort, param, portKind, type LevelModel, type Port } from "../core/level.ts";
import { compareStops, type RunResult } from "../core/run.ts";
import type { Wire } from "../core/wiring.ts";
import { cubicPath, ports, spot, wireCurve, type Box, type Layout, type Point, type Spot } from "./layout.ts";
import { emblem, itemMark, KIND_COLOR, KIND_DASH, lamp, portMark } from "./marks.ts";
import { C, num } from "./style.ts";
import { line, lineHeight, lines, nameLines, wrap, type Measure } from "./text.ts";

export interface CardsState {
  /** Node indexes of cards working, AGENT-08. */
  working: ReadonlySet<number>;
  /** During a run: the input being sent and its moves so far, RUN-14. */
  sending: { input: number; moves: number } | null;
}

const LABEL = lineHeight("label");
const GAP = 4;
const MARK = 10;
const EMBLEM = 24;
/** The output terminal's name line and readout, in from its input edge. */
const OUT_IN = 26;

const stroke = (kind: PortKind) => `stroke-width="2"${KIND_DASH[kind] ? ` stroke-dasharray="${KIND_DASH[kind]}"` : ""}`;
const frame = (x: number, y: number, w: number, h: number, fill: string, color: string, more = "") =>
  `<rect${more} x="${num(x + 1)}" y="${num(y + 1)}" width="${num(w - 2)}" height="${num(h - 2)}" stroke-width="2" style="fill:${fill};stroke:${color}"/>`;

/** Content room: 12 px in from a port edge at the side, 8 from one at the top or bottom, 4 from an edge with no port. */
function room(L: Layout, i: number): Box {
  const b = L.boxes[i];
  const n = L.m.nodes[i];
  const ins = n.inputs.length > 0;
  const outs = n.outputs.length > 0;
  const l = !L.turned && ins ? 12 : 4;
  const r = !L.turned && outs ? 12 : 4;
  const t = L.turned && ins ? 8 : 4;
  const u = L.turned && outs ? 8 : 4;
  return { x: b.x + l, y: b.y + t, w: b.w - l - r, h: b.h - t - u };
}

function agentCard(L: Layout, i: number, measure: Measure, working: boolean): string {
  const n = L.m.nodes[i];
  const R = room(L, i);
  const name = nameLines(n.id.toUpperCase(), R.w - MARK - GAP, measure);
  const ey = R.y + name.length * LABEL + GAP;
  let s = lines(name, "label", R.x, R.y) + lamp(working ? "lit" : "unlit", R.x + R.w - MARK / 2, R.y + LABEL / 2) + emblem(n.kind, R.x, ey);
  if (n.value) {
    const x = R.x + EMBLEM + 8;
    s += itemMark(n.value.prop, n.value.v, x, ey + (EMBLEM - MARK) / 2) + line(valueWord(n.value), "body", x + MARK + GAP, ey + (EMBLEM - lineHeight("body")) / 2);
  }
  // Rule text: 3 lines of room, 2 under a name on 2; the content checks keep every rule text within it.
  return s + lines(wrap(agentKind(n.kind).ruleText, "body", R.w, measure), "body", R.x, ey + EMBLEM + GAP);
}

/** Readout: each input a 50 × 14 box of its 4 marks, two columns, across then down. */
function inputTerminal(L: Layout, i: number, measure: Measure, sending: CardsState["sending"]): string {
  const R = room(L, i);
  let s = line("INPUT", "label", R.x, R.y);
  if (sending) s += line(`${sending.moves} / ${param("MaxMoves")}`, "small", R.x + measure("INPUT", "label") + 8, R.y);
  const top = R.y + LABEL + 2;
  L.m.level.inputs.forEach((values, k) => {
    const x = R.x + (k % 2) * 52;
    const y = top + Math.floor(k / 2) * 16;
    s += frame(x, y, 50, 14, "none", sending?.input === k ? C.ink : C.dim);
    s += values.map((v, p) => itemMark(p, v, x + 2 + p * (MARK + 2), y + 2)).join("");
  });
  return s;
}

/** Readout: each target value a 16 px row of its mark and its word in Small, rows 2 px apart. */
function outputTerminal(L: Layout, i: number): string {
  const R = room(L, i);
  const b = L.boxes[i];
  const x = L.turned ? R.x : b.x + OUT_IN;
  const top = L.turned ? b.y + OUT_IN : R.y + LABEL + 2;
  const rows = L.m.level.target.map((t, k) => {
    const y = top + k * 18;
    return itemMark(t.prop, t.v, x, y + 3) + line(valueWord(t), "small", x + MARK + GAP, y + (16 - lineHeight("small")) / 2);
  });
  return line("OUTPUT", "label", x, R.y) + rows.join("");
}

/** No card working, nothing being sent: the level with no run. */
export const IDLE: CardsState = { working: new Set(), sending: null };

export function drawCards(L: Layout, measure: Measure, s: CardsState): string {
  const all = ports(L);
  return L.m.nodes
    .map((n, i) => {
      const b = L.boxes[i];
      const working = s.working.has(i);
      const body = n.terminal === "in" ? inputTerminal(L, i, measure, s.sending) : n.terminal === "out" ? outputTerminal(L, i) : agentCard(L, i, measure, working);
      const marks = all
        .filter((p) => p.node === i)
        .map((p) => {
          const q = spot(L, p);
          return portMark(portKind(L.m, p)!, q.x, q.y);
        });
      return `<g data-node="${i}">${frame(b.x, b.y, b.w, b.h, C.face, working ? C.ink : C.dim)}${body}${marks.join("")}</g>`;
    })
    .join("");
}

/** ART-08: in the order laid, each in its output port's kind. */
export function drawWires(L: Layout, wires: Wire[]): string {
  return wires
    .map((w) => {
      const k = portKind(L.m, outPort(w.from))!;
      return `<path data-to="${w.to}" d="${cubicPath(wireCurve(L, w.from, w.to))}" ${stroke(k)} style="fill:none;stroke:${KIND_COLOR[k]}"/>`;
    })
    .join("");
}

/** ART-08: a wire being laid, or a wire end picked up. */
export const drawDragLine = (from: Point, to: Point, kind: PortKind) =>
  `<line x1="${num(from.x)}" y1="${num(from.y)}" x2="${num(to.x)}" y2="${num(to.y)}" ${stroke(kind)} style="stroke:${KIND_COLOR[kind]}"/>`;

/** Chosen start: an Ink Line square around its port's target. */
export function drawChosenStart(L: Layout, p: Port): string {
  const q = spot(L, p);
  const t = L.target + 4;
  return frame(q.x - t / 2, q.y - t / 2, t, t, "none", C.ink);
}

/** ART-05: TokenSize on Face in its kind's frame; 2 × 2 marks, half a Unit around and between. */
export function token(cx: number, cy: number, kind: PortKind, values: Values): string {
  const x = cx - 16;
  const y = cy - 16;
  const marks = values.map((v, p) => itemMark(p, v, x + 4 + (p % 2) * 14, y + 4 + Math.floor(p / 2) * 14));
  return `<rect class="token" x="${num(x + 1)}" y="${num(y + 1)}" width="30" height="30" ${stroke(kind)} style="fill:${C.face};stroke:${KIND_COLOR[kind]}"/>${marks.join("")}`;
}

export interface Rest {
  port: Port;
  kind: PortKind;
  /** In stop order: the last on top. */
  values: Values[];
}

/**
 * A stack's count, in Small, beside the part of a 3-token stack outside its
 * card: above it at a side port, to its left at a top or bottom port.
 */
function count(q: Spot, n: number, measure: Measure): string {
  const s = String(n);
  const w = measure(s, "small");
  const h = lineHeight("small");
  const at: Record<Spot["edge"], Point> = {
    left: { x: q.x - 2 - w, y: q.y - 18 - h },
    right: { x: q.x + 2, y: q.y - 18 - h },
    top: { x: q.x - 18 - w, y: q.y - 2 - h },
    bottom: { x: q.x - 18 - w, y: q.y + 2 },
  };
  return line(s, "small", at[q.edge].x, at[q.edge].y);
}

/** Moving tokens centred on (x, y); at rest, stacked on their port, each half a Unit down and right of the one before. */
export function drawTokens(L: Layout, moving: { x: number; y: number; kind: PortKind; values: Values }[], rests: Rest[], measure: Measure): string {
  const rested = rests.map((r) => {
    const q = spot(L, r.port);
    const shown = r.values.slice(-3).map((v, j) => token(q.x + 4 * j, q.y + 4 * j, r.kind, v));
    return shown.join("") + (r.values.length > 3 ? count(q, r.values.length, measure) : "");
  });
  return rested.join("") + moving.map((t) => token(t.x, t.y, t.kind, t.values)).join("");
}

/**
 * RUN-13: where stopped copies rest, by port, each in stop time order, ties
 * by compareStops. Shredded copies rest nowhere. `upTo`: seconds since Launch.
 */
export function restsOf(m: LevelModel, r: RunResult, upTo?: number): Rest[] {
  const at = new Map(r.timeline.stops.map((s) => [s.copy, s.t]));
  const groups = new Map<string, { port: Port; copies: number[] }>();
  r.copies.forEach((c, k) => {
    if (c.stop === "shredded" || (upTo !== undefined && at.get(k)! > upTo)) return;
    const key = `${c.port.node} ${c.port.out} ${c.port.i}`;
    if (!groups.has(key)) groups.set(key, { port: c.port, copies: [] });
    groups.get(key)!.copies.push(k);
  });
  return [...groups.values()]
    .sort((a, b) => comparePorts(m, a.port, b.port))
    .map((g) => ({
      port: g.port,
      kind: portKind(m, g.port)!,
      values: g.copies.sort((a, b) => at.get(a)! - at.get(b)! || compareStops(m, r.copies[a], r.copies[b])).map((k) => r.copies[k].values),
    }));
}
