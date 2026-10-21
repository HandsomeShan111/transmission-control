// UI style's Style values as CSS for drawn markup, and each look's colours, ART-01, ART-04.
import { STYLE } from "../content/generated.ts";

export type ColorName = "ground" | "face" | "dim" | "muted" | "ink" | "blue" | "yellow" | "red";

/** Colours as CSS variables named after STYLE.colors keys, so a look switch redraws nothing. */
export const C = Object.fromEntries(Object.keys(STYLE.colors).map((k) => [k, `var(--${k})`])) as Record<ColorName, string>;

/** A coordinate as markup: two decimals at most. */
export const num = (v: number) => String(Math.round(v * 100) / 100);

/** Text classes; words are Ink unless an element says otherwise. */
export function svgCss(): string {
  return Object.entries(STYLE.fonts)
    .map(([name, f]) => `.t-${name}{font-family:Jost,sans-serif;font-size:${f.size}px;font-weight:${f.weight};letter-spacing:${f.spacing}em;fill:${C.ink}}`)
    .join("");
}

export function lookVars(look: "light" | "dark"): string {
  return Object.entries(STYLE.colors)
    .map(([k, v]) => `--${k}:${v[look]};`)
    .join("");
}
