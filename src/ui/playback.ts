// A run played back over the timeline computed at Launch: RUN-03 to RUN-05 shown, RUN-09 to RUN-12.
import { outPort, param, portKind } from "../core/level.ts";
import type { LevelModel } from "../core/level.ts";
import type { Values } from "../core/items.ts";
import { startTimes, type RunResult, type RunTimes } from "../core/run.ts";
import type { PortKind } from "../content/types.ts";
import { along, track, wireCurve, type Layout, type Track } from "../draw/layout.ts";

export interface Moving {
  x: number;
  y: number;
  kind: PortKind;
  values: Values;
}

export interface Frame {
  /** Seconds of run time since Launch. */
  t: number;
  moving: Moving[];
  /** Nodes at work, AGENT-08. */
  working: Set<number>;
  /** RUN-14: the input being sent and its moves so far. */
  sending: { input: number; moves: number } | null;
}

export type RunSound = "works" | "arrives";

export class Playback {
  /** Seconds of run time since Launch. */
  t = 0;
  fast = false;
  paused = false;
  private tracks = new WeakMap<Layout, Map<string, Track>>();

  constructor(
    readonly m: LevelModel,
    readonly r: RunResult,
    readonly times: RunTimes = startTimes(),
  ) {}

  get ended() {
    return this.t >= this.r.timeline.end;
  }

  /**
   * Moves the clock by `dt` seconds of the page's time: FastFactor times as far
   * while Fast is on, RUN-09; not at all while paused, RUN-12. Returns the sounds
   * of the works and arrivals it passed.
   */
  advance(dt: number): RunSound[] {
    if (this.paused || this.ended) return [];
    const from = this.t;
    this.t = Math.min(this.r.timeline.end, from + dt * (this.fast ? param("FastFactor") : 1));
    const passed = (t: number) => t > from && t <= this.t;
    const sounds: RunSound[] = [];
    if (this.r.timeline.works.some((w) => passed(w.t))) sounds.push("works");
    if (this.r.timeline.stops.some((s) => passed(s.t) && this.r.copies[s.copy].stop === "arrived")) sounds.push("arrives");
    return sounds;
  }

  /** RUN-10: the rest plays out at once, with no moves shown and no sounds. */
  skip() {
    this.t = this.r.timeline.end;
  }

  frame(L: Layout): Frame {
    const t = this.t;
    const { moveTime, workTime } = this.times;
    const tl = this.r.timeline;
    const on = !this.ended;
    const moving = on
      ? tl.moves
          .filter((mv) => mv.t <= t && t < mv.t + moveTime)
          .map((mv) => {
            const p = along(this.track(L, mv.from, mv.to), (t - mv.t) / moveTime);
            return { x: p.x, y: p.y, kind: portKind(this.m, outPort(mv.from))!, values: mv.values };
          })
      : [];
    const working = new Set(on ? tl.works.filter((w) => w.t <= t && t < w.t + workTime).map((w) => w.node) : []);
    let sending: Frame["sending"] = null;
    if (on) for (const c of tl.counts) if (c.t <= t) sending = { input: c.input, moves: c.moves };
    return { t, moving, working, sending };
  }

  private track(L: Layout, from: number, to: number): Track {
    let byWire = this.tracks.get(L);
    if (!byWire) this.tracks.set(L, (byWire = new Map()));
    const key = `${from}>${to}`;
    let tr = byWire.get(key);
    if (!tr) byWire.set(key, (tr = track(wireCurve(L, from, to))));
    return tr;
  }
}
