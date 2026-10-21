// LEVEL-04 inputs shown, ART-09 panels at once, ART-10 flashes.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { layout } from "../../src/draw/layout.ts";
import { drawCards } from "../../src/draw/level.ts";
import { itemMark } from "../../src/draw/marks.ts";
import { stubMeasure } from "../../src/draw/text.ts";
import { model } from "../core/helpers.ts";

const nodeMarkup = (s: string, i: number) => s.match(new RegExp(`<g data-node="${i}">.*?</g>`))![0];

test("LEVEL-04: the input terminal shows each input's values in sending order, before Launch and during a run", () => {
  const m = model(8);
  const L = layout(m, "pointer", false);
  for (const sending of [null, { input: 1, moves: 3 }]) {
    const s = nodeMarkup(drawCards(L, stubMeasure, { working: new Set(), sending }), m.input);
    const boxes = [...s.matchAll(/x="([\d.]+)" y="([\d.]+)" width="48" height="12"/g)].map((b) => ({ x: Number(b[1]) - 1, y: Number(b[2]) - 1 }));
    expect(boxes.length).toBe(m.level.inputs.length);
    let at = -1;
    m.level.inputs.forEach((values, k) => {
      const marks = values.map((v, p) => itemMark(p, v, boxes[k].x + 2 + p * 12, boxes[k].y + 2)).join("");
      const i = s.indexOf(marks);
      expect(i).toBeGreaterThan(at);
      at = i;
    });
  }
});

test("ART-09: panels and act cards open and close at once: no transition or animation", () => {
  expect(readFileSync(new URL("../../src/ui/style.css", import.meta.url), "utf8")).not.toMatch(/transition|animation|@keyframes/);
});

test("ART-10: a card at work changes only its lamp and frame line, never a fill", () => {
  const m = model(16);
  const L = layout(m, "pointer", false);
  const fills = (s: string) => [...s.matchAll(/<rect[^>]*style="fill:([^;"]+)/g)].map((f) => f[1]);
  m.nodes.forEach((n, i) => {
    if (n.terminal) return;
    const idle = nodeMarkup(drawCards(L, stubMeasure, { working: new Set(), sending: null }), i);
    const work = nodeMarkup(drawCards(L, stubMeasure, { working: new Set([i]), sending: null }), i);
    expect(work).not.toBe(idle);
    expect(fills(work)).toEqual(fills(idle));
    expect(work.replace(/<circle[^>]*\/>/, "").replaceAll("var(--ink)", "var(--dim)")).toBe(idle.replace(/<circle[^>]*\/>/, "").replaceAll("var(--ink)", "var(--dim)"));
  });
});
