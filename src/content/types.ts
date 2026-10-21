// Shapes of the game's content in generated.ts.

export type PortKind = "data" | "positive" | "negative";

export type ResultKind = "Overload" | "Loop" | "Nothing arrived" | "Dropped" | "Shredded" | "All wrong" | "Partly right";

/** REPORT-02's order: the first that holds is the run's kind of result. */
export const RESULT_KINDS: readonly ResultKind[] = ["Overload", "Loop", "Nothing arrived", "Dropped", "Shredded", "All wrong", "Partly right"];

export interface Property {
  name: string;
  /** Values, low end to high end. */
  scale: string[];
}

/** One value of one property: indexes into PROPERTIES and its scale. */
export interface Value {
  prop: number;
  v: number;
}

export type Op = { prop: number; shift: 1 | -1 } | { prop: number; set: number };

export interface AgentKind {
  kind: string;
  inputs: PortKind[];
  outputs: PortKind[];
  /** Shifts and sets, AGENT-03; or the step that settles the kind's work. */
  work: Op[] | { step: string };
  ruleText: string;
  /** Agent lines, REPORT-04, by the port kind of the input port reached. */
  lines: Partial<Record<PortKind, string>>;
}

export interface Terminal {
  name: string;
  inputs: PortKind[];
  outputs: PortKind[];
}

export type Place =
  | { terminal: "Input terminal" | "Output terminal" }
  | { kind: string; number: number; value?: Value };

export interface LevelWords {
  /** The brief's New line, or null on a level with no new kind. */
  newLine: string | null;
  win: string;
  lines: Partial<Record<ResultKind, string>>;
}

export interface Level {
  id: number;
  /** Each input's values, in property order. */
  inputs: number[][];
  target: Value[];
  /** Rows top to bottom, places left to right; null for empty. */
  rows: (Place | null)[][];
  task: string;
  stake: string;
  words: LevelWords;
}

export interface Act {
  act: number;
  first: number;
  last: number;
  name: string;
  situation: string;
}

export interface Param {
  value: number | string;
  unit: string;
  /** The design page that owns it. */
  page: string;
}

export interface FontStyle {
  size: number;
  weight: number;
  /** Null where the style gives none. */
  lineHeight: number | null;
  caps: boolean;
  /** Letter spacing in em. */
  spacing: number;
}

export interface Style {
  colors: Record<string, { light: string; dark: string }>;
  fonts: Record<"body" | "label" | "title" | "small", FontStyle>;
  sizes: Record<"line" | "unit" | "corner" | "buttonHeight" | "markSize" | "portMarkSize" | "tokenSize", number>;
}

export interface ShellWords {
  notKept: string;
  countsLine: string;
  homeScreen: string;
}
