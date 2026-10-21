// Item marks, port marks, emblems, lamps and kind lines: ART-01 to ART-05, UI style's Lamp.
import { expect, test } from "bun:test";
import { AGENTS, PORT_KINDS, PROPERTIES, STYLE } from "../../src/content/generated.ts";
import { emblem, itemMark, KIND_COLOR, KIND_DASH, lamp, portMark } from "../../src/draw/marks.ts";
import { lookVars, svgCss } from "../../src/draw/style.ts";

const KIND_VARS = /var\(--(blue|yellow|red)\)/;

test("12 item marks, all different, and a property's three differ", () => {
  const all = PROPERTIES.flatMap((p, prop) => p.scale.map((_, v) => itemMark(prop, v, 0, 0)));
  expect(all.length).toBe(12);
  expect(new Set(all).size).toBe(12);
  PROPERTIES.forEach((p, prop) => expect(new Set(p.scale.map((_, v) => itemMark(prop, v, 0, 0))).size).toBe(3));
  for (const m of all) expect(m).toContain("fill:var(--ink)");
});

test("item marks stay in their square, at MarkSize or the size given", () => {
  for (const size of [10, 5]) {
    for (let prop = 0; prop < 4; prop++)
      for (let v = 0; v < 3; v++) {
        const nums = [...itemMark(prop, v, 100, 200, size).matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((x) => [+x[1], +x[2]]);
        for (const [x, y] of nums) {
          expect(x).toBeGreaterThanOrEqual(100);
          expect(x).toBeLessThanOrEqual(100 + size);
          expect(y).toBeGreaterThanOrEqual(200);
          expect(y).toBeLessThanOrEqual(200 + size);
        }
      }
  }
});

test("port marks: the kind's shape and colour, 14 px, centred", () => {
  const marks = PORT_KINDS.map((k) => portMark(k, 50, 50));
  expect(new Set(marks).size).toBe(3);
  PORT_KINDS.forEach((k, i) => expect(marks[i]).toContain(`fill:${KIND_COLOR[k]}`));
  expect(portMark("negative", 50, 50)).toContain("M43 43L57 43L57 57L43 57Z");
  expect(portMark("data", 50, 50)).toContain("M43 50A7 7");
});

test("an emblem for each agent kind, all different, never in a kind colour", () => {
  const all = AGENTS.map((a) => emblem(a.kind, 0, 0));
  expect(all.length).toBe(12);
  expect(new Set(all).size).toBe(12);
  for (const e of all) {
    expect(e).not.toMatch(KIND_VARS);
    for (const c of e.matchAll(/var\(--(\w+)\)/g)) expect(["ink", "dim", "muted"]).toContain(c[1]);
  }
});

test("lamps: lit, unlit, unlocked, locked", () => {
  expect(lamp("lit", 5, 5)).toContain('r="4" stroke-width="2" style="fill:var(--ink);stroke:var(--ink)"');
  expect(lamp("unlit", 5, 5)).toContain("fill:none;stroke:var(--dim)");
  expect(lamp("unlocked", 5, 5)).toContain("fill:none;stroke:var(--ink)");
  expect(lamp("locked", 5, 5)).toContain("<line");
  expect(lamp("locked", 5, 5)).not.toMatch(/ink/);
});

test("kind lines: solid, dashed, dotted", () => {
  expect(KIND_DASH).toEqual({ data: null, positive: "8 5", negative: "2 4" });
  expect(Object.values(KIND_COLOR)).toEqual(["var(--blue)", "var(--yellow)", "var(--red)"]);
});

test("style: colour only as variables in the CSS, a look's values from STYLE", () => {
  const css = svgCss();
  for (const f of ["body", "label", "small", "title"]) expect(css).toContain(`.t-${f}{font-family:Jost`);
  expect(css).toContain("letter-spacing:0.08em");
  expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  expect(lookVars("light")).toStartWith("--ground:#EFEBE1;");
  expect(lookVars("dark")).toContain("--red:#E04A2F;");
  expect(Object.keys(STYLE.colors)).toEqual(["ground", "face", "dim", "muted", "ink", "blue", "yellow", "red"]);
});
