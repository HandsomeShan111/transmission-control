// Words in drawn markup: measure, wrap and place lines, UI style's fonts, Play's Layout.
import { STYLE } from "../content/generated.ts";
import { num } from "./style.ts";

export type FontName = "body" | "label" | "small" | "title";

/** Width in px of the text as shown, letter spacing included. */
export type Measure = (text: string, font: FontName) => number;

/**
 * For tests: per character 0.55 × size for label and title, 0.47 × size for
 * body and small, plus the font's letter spacing × size.
 */
export const stubMeasure: Measure = (text, font) => {
  const f = STYLE.fonts[font];
  return text.length * f.size * ((font === "label" || font === "title" ? 0.55 : 0.47) + f.spacing);
};

/** Line height in px; Title has none in the style, so 1.2 as Label. */
export const lineHeight = (font: FontName) => STYLE.fonts[font].size * (STYLE.fonts[font].lineHeight ?? 1.2);

/** Greedy by units: a unit that does not fit on its own still takes a line. */
function wrapUnits(units: string[], font: FontName, width: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const u of units) {
    const last = lines[lines.length - 1];
    if (last !== undefined && measure(`${last} ${u}`, font) <= width) lines[lines.length - 1] = `${last} ${u}`;
    else lines.push(u);
  }
  return lines;
}

export const wrap = (text: string, font: FontName, width: number, measure: Measure) => wrapUnits(text.split(" ").filter(Boolean), font, width, measure);

/** An agent name in Label: its number stays on the line of its last word. */
export function nameLines(name: string, width: number, measure: Measure): string[] {
  const w = name.split(" ");
  const units = w.length > 2 ? [...w.slice(0, -2), w.slice(-2).join(" ")] : [w.join(" ")];
  return wrapUnits(units, "label", width, measure);
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Cap height as a share of the size, to centre capitals in a line. */
const CAP = 0.7;

/** One line of words, its line box's top-left at (x, top). */
export function line(s: string, font: FontName, x: number, top: number): string {
  const y = top + (lineHeight(font) + CAP * STYLE.fonts[font].size) / 2;
  return `<text class="t-${font}" x="${num(x)}" y="${num(y)}">${esc(s)}</text>`;
}

/** Lines one under the other, from (x, top). */
export const lines = (ls: string[], font: FontName, x: number, top: number) => ls.map((s, k) => line(s, font, x, top + k * lineHeight(font))).join("");
