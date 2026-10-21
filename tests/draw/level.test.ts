// The play area's layers: cards and terminals, wires, tokens. ART-01 to ART-08, Play's Layout, Readout, RUN-13.
import { describe, expect, test } from "bun:test";
import { LEVELS } from "../../src/content/generated.ts";
import { portKind } from "../../src/core/level.ts";
import { compareStops, run } from "../../src/core/run.ts";
import { wireList } from "../../src/core/wiring.ts";
import { layout, ports, spot, type InputKind } from "../../src/draw/layout.ts";
import { drawCards, drawChosenStart, drawDragLine, drawTokens, drawWires, restsOf, token } from "../../src/draw/level.ts";
import { num } from "../../src/draw/style.ts";
import { portMark } from "../../src/draw/marks.ts";
import { stubMeasure } from "../../src/draw/text.ts";
import { checks, fromChecks, model } from "../core/helpers.ts";

const idle = { working: new Set<number>(), sending: null };
const KIND_VARS = /var\(--(blue|yellow|red)\)/;
const count = (s: string, re: RegExp) => [...s.matchAll(new RegExp(re.source, "g"))].length;
const nodeMarkup = (s: string, i: number) => s.match(new RegExp(`<g data-node="${i}">.*?</g>`))![0];
const withoutPorts = (s: string) => s.replace(/<path class="port"[^>]*\/>/g, "");

describe("Cards and terminals", () => {
  for (const l of LEVELS)
    for (const input of ["pointer", "touch"] as InputKind[])
      for (const turned of [false, true])
        test(`level ${l.id}, ${input}${turned ? ", turned" : ""}: a port mark at every port, every node marked`, () => {
          const L = layout(model(l.id), input, turned);
          const s = drawCards(L, stubMeasure, idle);
          expect(count(s, /class="port"/g)).toBe(ports(L).length);
          L.m.nodes.forEach((_, i) => expect(s).toContain(`data-node="${i}"`));
          expect(count(s, /data-node=/g)).toBe(L.m.nodes.length);
          // Each port mark in its kind, centred on its port's spot, in its node's group.
          for (const p of ports(L)) {
            const q = spot(L, p);
            expect(nodeMarkup(s, p.node)).toContain(portMark(portKind(L.m, p)!, q.x, q.y));
          }
        });

  test("content insets: 12 px from a side port edge, 4 from an edge with no port, 8 from a top port edge", () => {
    const m = model(1);
    const node = m.nodes.findIndex((n) => !n.terminal);
    const L = layout(m, "pointer", false);
    const b = L.boxes[node];
    expect(nodeMarkup(drawCards(L, stubMeasure, idle), node)).toContain(`<text class="t-label" x="${b.x + 12}"`);
    const T = layout(m, "pointer", true);
    const t = T.boxes[node];
    const card = nodeMarkup(drawCards(T, stubMeasure, idle), node);
    expect(card).toContain(`<text class="t-label" x="${t.x + 4}"`);
    // Name line from 8 px down: its baseline at 8 + (15.6 + 0.7 × 13) / 2.
    expect(card).toContain(`y="${Math.round((t.y + 8 + (15.6 + 9.1) / 2) * 100) / 100}">SUMMARIZER 1</text>`);
    const inT = layout(m, "pointer", false);
    expect(nodeMarkup(drawCards(inT, stubMeasure, idle), m.input)).toContain(`x="${inT.boxes[m.input].x + 4}"`);
  });

  test("the output terminal's name line and readout start 26 px in from its input edge, or the readout 26 px down when turned", () => {
    const m = model(16);
    const L = layout(m, "pointer", false);
    const b = L.boxes[m.output];
    const out = nodeMarkup(drawCards(L, stubMeasure, idle), m.output);
    expect(out).toContain(`<text class="t-label" x="${b.x + 26}"`);
    expect(count(out, /class="t-small"/g)).toBe(m.level.target.length);
    const T = layout(m, "pointer", true);
    const t = T.boxes[m.output];
    const turned = nodeMarkup(drawCards(T, stubMeasure, idle), m.output);
    // Name line 8 px down, under the stack while tokens rest; the first target row's word 26 px down, centred in its 16 px row.
    expect(turned).toContain(`<text class="t-label" x="${t.x + 4}" y="${num(t.y + 8 + 12.35)}">OUTPUT</text>`);
    expect(turned).toContain(`<text class="t-small" x="${t.x + 4 + 14}" y="${num(t.y + 26 + 0.2 + 12.35)}">`);
  });

  test("a working card: Ink frame and lit lamp; idle: Dim frame and unlit lamp", () => {
    const m = model(1);
    const node = m.nodes.findIndex((n) => !n.terminal);
    const L = layout(m, "pointer", false);
    const busy = nodeMarkup(drawCards(L, stubMeasure, { working: new Set([node]), sending: null }), node);
    expect(busy).toContain("fill:var(--face);stroke:var(--ink)");
    expect(busy).toContain('r="4" stroke-width="2" style="fill:var(--ink);stroke:var(--ink)"');
    const rest = nodeMarkup(drawCards(L, stubMeasure, idle), node);
    expect(rest).toContain("fill:var(--face);stroke:var(--dim)");
    expect(rest).toContain('r="4" stroke-width="2" style="fill:none;stroke:var(--dim)"');
  });

  test("the input terminal's readout: a 50 × 14 box an input, the one being sent in Ink, its moves on the name line", () => {
    const m = model(16);
    const L = layout(m, "pointer", false);
    const sending = nodeMarkup(drawCards(L, stubMeasure, { working: new Set(), sending: { input: 1, moves: 7 } }), m.input);
    expect(count(sending, /width="48" height="12"/g)).toBe(m.level.inputs.length);
    expect(count(sending, /width="48" height="12" stroke-width="2" style="fill:none;stroke:var\(--ink\)"/g)).toBe(1);
    expect(sending).toContain(">7 / 200</text>");
    const b = L.boxes[m.input];
    // Second input: the right column, 52 px along.
    expect(sending).toContain(`x="${b.x + 4 + 52 + 1}" y="${Math.round((b.y + 4 + 15.6 + 2 + 1) * 100) / 100}" width="48"`);
    expect(nodeMarkup(drawCards(L, stubMeasure, idle), m.input)).not.toContain(" / 200");
  });

  test("an inspector shows its value: mark and word beside the emblem", () => {
    const m = model(16);
    const i = m.nodes.findIndex((n) => n.value);
    const s = nodeMarkup(drawCards(layout(m, "pointer", false), stubMeasure, idle), i);
    expect(s).toMatch(/<text class="t-body"[^>]*>(short|medium|long|rude|flat|polite|text|list|chart|English|legalese|alien)<\/text>/);
  });
});

describe("ART-01, ART-02: shapes and colours", () => {
  const { m, w } = fromChecks(16, "Dropped");
  const L = layout(m, "pointer", false);
  const r = run(m, w);
  const cards = drawCards(L, stubMeasure, { working: new Set([1, 2]), sending: { input: 0, moves: 3 } });
  const all =
    cards +
    drawWires(L, wireList(w)) +
    drawTokens(L, [{ x: 10, y: 10, kind: "negative", values: [0, 1, 2, 0] }], restsOf(m, r), stubMeasure) +
    drawChosenStart(L, ports(L)[0]) +
    drawDragLine({ x: 0, y: 0 }, { x: 9, y: 9 }, "positive");

  test("no colour literal, gradient, filter, shadow or opacity", () => {
    expect(all).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(all).not.toMatch(/gradient|filter|shadow|opacity|<image/i);
    for (const c of all.matchAll(/var\(--(\w+)\)/g)) expect(["ground", "face", "dim", "muted", "ink", "blue", "yellow", "red"]).toContain(c[1]);
  });

  test("kind colours only on port marks, wires and tokens", () => {
    expect(withoutPorts(cards)).not.toMatch(KIND_VARS);
    expect(count(cards, KIND_VARS)).toBe(ports(L).length);
  });
});

describe("Wires", () => {
  test("in the order laid, each in its output port's kind and line, with its input ref", () => {
    const { m, w } = fromChecks(16, "solution");
    const L = layout(m, "pointer", false);
    const list = wireList(w);
    const s = drawWires(L, list);
    expect([...s.matchAll(/data-to="(\d+)"/g)].map((x) => +x[1])).toEqual(list.map((x) => x.to));
    expect(s).toContain('stroke-dasharray="8 5"');
    expect(s).toMatch(/<path data-to="\d+" d="M[^"]+" stroke-width="2" style="fill:none;stroke:var\(--blue\)"/);
  });

  test("a wire being laid: a straight line in its kind's colour and line", () => {
    expect(drawDragLine({ x: 1, y: 2 }, { x: 3, y: 4 }, "negative")).toBe(
      '<line x1="1" y1="2" x2="3" y2="4" stroke-width="2" stroke-dasharray="2 4" style="stroke:var(--red)"/>',
    );
  });

  test("chosen start: an Ink Line square around the port's target", () => {
    const m = model(1);
    for (const input of ["pointer", "touch"] as InputKind[]) {
      const L = layout(m, input, false);
      const p = { node: m.input, out: true, i: 0 };
      const q = spot(L, p);
      expect(drawChosenStart(L, p)).toBe(
        `<rect x="${q.x - L.target / 2 - 1}" y="${q.y - L.target / 2 - 1}" width="${L.target + 2}" height="${L.target + 2}" stroke-width="2" style="fill:none;stroke:var(--ink)"/>`,
      );
    }
  });
});

describe("Tokens", () => {
  test("a 32 px square on Face in its kind's frame, marks at 4 px insets", () => {
    const t = token(100, 100, "positive", [0, 1, 2, 0]);
    expect(t).toContain('<rect class="token" x="85" y="85" width="30" height="30" stroke-width="2" stroke-dasharray="8 5" style="fill:var(--face);stroke:var(--yellow)"/>');
    // Top-left of each mark: 4 px in, 14 px apart.
    const starts = [...t.matchAll(/<path d="M([\d.]+) ([\d.]+)/g)].map((x) => [+x[1], +x[2]]);
    expect(starts.length).toBe(4);
    // Length's short bar, 4 units down in the cell at (88, 88).
    expect(starts[0]).toEqual([88, 92]);
    // Tone's flat mark, a square 1 unit in: its cell at (102, 88).
    expect(starts[1]).toEqual([103, 89]);
    // Format's chart mark: its first bar 6 units down in the cell at (88, 102).
    expect(starts[2]).toEqual([88, 108]);
    // Language's English ring: its left point at the cell's left, half down, in the cell at (102, 102).
    expect(starts[3]).toEqual([102, 107]);
  });

  test("a rest of 5 shows 3 tokens and the count 5; of 3, no count", () => {
    const m = model(16);
    const L = layout(m, "pointer", false);
    const port = { node: m.output, out: false, i: 0 };
    const v = [0, 0, 0, 0];
    const s = drawTokens(L, [], [{ port, kind: "data", values: [v, v, v, v, [2, 2, 2, 2]] }], stubMeasure);
    expect(count(s, /class="token"/g)).toBe(3);
    expect(s).toContain('class="t-small"');
    expect(s).toMatch(/>5<\/text>/);
    const q = spot(L, port);
    // Each 4 px down and right of the one before, the last on top.
    expect(s).toContain(`x="${q.x - 15}" y="${q.y - 15}"`);
    expect(s.lastIndexOf('<rect class="token"')).toBe(s.indexOf(`<rect class="token" x="${q.x - 15 + 8}" y="${q.y - 15 + 8}"`));
    const three = drawTokens(L, [], [{ port, kind: "data", values: [v, v, v] }], stubMeasure);
    expect(count(three, /class="token"/g)).toBe(3);
    expect(three).not.toContain("<text");
  });

  test("the count sits outside the stack, beside the card edge", () => {
    const m = model(16);
    for (const turned of [false, true]) {
      const L = layout(m, "touch", turned);
      for (const p of ports(L)) {
        const q = spot(L, p);
        const s = drawTokens(L, [], [{ port: p, kind: "data", values: Array(12).fill([0, 0, 0, 0]) }], stubMeasure);
        const [, x, y] = s.match(/<text class="t-small" x="([\d.-]+)" y="([\d.-]+)">12<\/text>/)!;
        const w = stubMeasure("12", "small");
        const top = +y - (15.6 + 9.1) / 2;
        // The stack spans 16 px before the spot to 24 px after, both ways.
        const outside = +x + w <= q.x - 16 || +x >= q.x + 24 || top + 15.6 <= q.y - 16 || top >= q.y + 24;
        expect(outside).toBe(true);
        const b = L.boxes[p.node];
        const inCard = +x >= b.x && +x + w <= b.x + b.w && top >= b.y && top + 15.6 <= b.y + b.h;
        expect(inCard).toBe(false);
      }
    }
  });

  test("moving tokens centred on their point, over rests", () => {
    const m = model(1);
    const L = layout(m, "pointer", false);
    const s = drawTokens(L, [{ x: 50, y: 60, kind: "data", values: [1, 1, 1, 1] }], [{ port: { node: m.output, out: false, i: 0 }, kind: "data", values: [[0, 0, 0, 0]] }], stubMeasure);
    expect(s.lastIndexOf('<rect class="token"')).toBe(s.indexOf('<rect class="token" x="35" y="45"'));
  });
});

describe("RUN-13: restsOf", () => {
  const cases = [...Object.keys(checks[16].kinds).map((k) => [16, k] as const), [18, "longRun"] as const];
  for (const [id, which] of cases)
    test(`level ${id}, ${which}: a token for every copy not shredded, in stop order`, () => {
      const { m, w } = fromChecks(id, which);
      const r = run(m, w);
      const rests = restsOf(m, r);
      const tokens = rests.reduce((s, x) => s + x.values.length, 0);
      expect(tokens).toBe(r.copies.filter((c) => c.stop !== "shredded").length);
      const at = new Map(r.timeline.stops.map((s) => [s.copy, s.t]));
      for (const rest of rests) {
        const here = r.copies.map((c, k) => ({ c, k })).filter(({ c }) => c.port.node === rest.port.node && c.port.out === rest.port.out && c.port.i === rest.port.i);
        expect(rest.values).toEqual(here.sort((a, b) => at.get(a.k)! - at.get(b.k)! || compareStops(m, a.c, b.c)).map(({ c }) => c.values));
      }
      // upTo: only copies stopped at or before it.
      const at0 = r.timeline.stops.filter((s) => s.t <= 0).length;
      expect(restsOf(m, r, 0).reduce((s, x) => s + x.values.length, 0)).toBe(at0);
      const mid = r.timeline.end / 2;
      expect(restsOf(m, r, mid).reduce((s, x) => s + x.values.length, 0)).toBe(r.timeline.stops.filter((s) => s.t <= mid && r.copies[s.copy].stop !== "shredded").length);
      expect(restsOf(m, r, r.timeline.end)).toEqual(rests);
    });

  test("upTo 0 gives none when no copy stops at Launch", () => {
    for (const which of ["Overload", "Loop", "Dropped", "All wrong", "Partly right"]) {
      const { m, w } = fromChecks(16, which);
      expect(restsOf(m, run(m, w), 0)).toEqual([]);
    }
    const { m, w } = fromChecks(18, "longRun");
    expect(restsOf(m, run(m, w), 0)).toEqual([]);
  });

  test("shredded copies rest nowhere; a rest's kind is its port's", () => {
    const { m, w } = fromChecks(12, "Shredded");
    const r = run(m, w);
    expect(r.copies.some((c) => c.stop === "shredded")).toBe(true);
    const rests = restsOf(m, r);
    expect(rests.reduce((s, x) => s + x.values.length, 0)).toBe(r.copies.filter((c) => c.stop !== "shredded").length);
    for (const rest of rests) expect(rest.kind).toBe((rest.port.out ? m.nodes[rest.port.node].outputs : m.nodes[rest.port.node].inputs)[rest.port.i]);
  });

  test("within a port, by stop time, the last to stop on top", () => {
    const { m, w } = fromChecks(18, "longRun");
    const r = run(m, w);
    const at = new Map(r.timeline.stops.map((s) => [s.copy, s.t]));
    const big = restsOf(m, r).find((x) => x.values.length > 3)!;
    const L = layout(m, "pointer", false);
    const s = drawTokens(L, [], [big], stubMeasure);
    expect(count(s, /class="token"/)).toBe(3);
    expect(s).toContain(`>${big.values.length}</text>`);
    const here = r.copies.map((c, k) => ({ c, k })).filter(({ c }) => c.port.node === big.port.node && c.port.out === big.port.out && c.port.i === big.port.i);
    const latest = Math.max(...here.map(({ k }) => at.get(k)!));
    const lastValues = big.values[big.values.length - 1];
    expect(here.some(({ c, k }) => at.get(k) === latest && c.values === lastValues)).toBe(true);
  });
});
