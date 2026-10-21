// The play screen, Play's Controls and Layout: the bars, the play area, and the brief, report and notice panels.
// One Play is one opening of a level: Undo's history lives and ends with it.
import { SHELL_WORDS } from "../content/generated.ts";
import { isLast } from "../core/campaign.ts";
import { levelById, levelModel, param, portKind, type LevelModel, type Port } from "../core/level.ts";
import { report, type Report } from "../core/report.ts";
import { run, type RunResult } from "../core/run.ts";
import { clear, join, move, newWiring, remove, undo, wireList, type Outcome, type Wire, type Wiring } from "../core/wiring.ts";
import { sentence } from "../core/words.ts";
import { layout, spot, type InputKind, type Layout, type Point } from "../draw/layout.ts";
import { drawCards, drawChosenStart, drawDragLine, drawTokens, drawWires, IDLE, restsOf, type Rest } from "../draw/level.ts";
import { num, svgCss } from "../draw/style.ts";
import type { Measure } from "../draw/text.ts";
import type { SoundName } from "../shell/sound-names.ts";
import { button, el, setState, svgEl } from "./dom.ts";
import { Gesture, type DragShow } from "./gesture.ts";
import { Playback } from "./playback.ts";
import { openView, refit, type View } from "./view.ts";

export interface PlayHost {
  measure: Measure;
  sound(name: SoundName): void;
  /** APP-06; a run on has already stopped, RUN-11. */
  map(): void;
  /** APP-05. */
  settings(): void;
  /** A wiring action, WIRE-01 to WIRE-05: the level's wires, in the order laid. */
  wired(wires: Wire[]): void;
  /** A run won the level, CAMP-02. */
  won(): void;
  /** Next level, on a win's report. */
  next(): void;
  /** Campaign map, on the last level's report, CAMP-02. */
  campaignMap(): void;
  /** SAVE-04: true once a visit, when the notice is due; it then counts as shown. */
  takeNotice(): boolean;
  /** REPORT-07. */
  picture(o: { m: LevelModel; wiring: Wiring; result: RunResult; report: Report }): void;
}

type Panel = "brief" | "report" | "notice" | null;


export const inputOf = (e: PointerEvent): InputKind => (e.pointerType === "touch" ? "touch" : "pointer");

export class Play {
  readonly root = el("div", "screen play");
  readonly m: LevelModel;
  private w: Wiring;
  private L: Layout;
  private v: View | null = null;
  private start: Port | null = null;
  private drag: DragShow | null = null;
  private springs: { d: DragShow; back: Point; t: number }[] = [];
  private pb: Playback | null = null;
  /** RUN-13: the stops of the last run, until a wiring action, Launch or Stop. */
  private rests: Rest[] = [];
  private result: { result: RunResult; report: Report } | null = null;
  private panel: Panel = "brief";
  private hidden = false;
  private gesture: Gesture;
  private pressed = new Set<number>();
  private raf = 0;
  private last = 0;
  private dirty = true;
  private drawn = new WeakMap<Element, string>();
  private resize = new ResizeObserver(() => this.fit());

  private title: HTMLButtonElement;
  private bottom = el("footer", "bar bottom");
  private area = el("div", "area");
  private level = svgEl("g");
  private layers = { cards: svgEl("g"), wires: svgEl("g"), tokens: svgEl("g"), over: svgEl("g") };
  private panelEl = el("section", "panel");
  private buttons: Record<"undo" | "clear" | "launch" | "fast" | "skip" | "stop", HTMLButtonElement>;

  constructor(
    private host: PlayHost,
    readonly id: number,
    wires: Wire[],
    private input: InputKind,
  ) {
    this.m = levelModel(levelById(id));
    this.w = newWiring(wires);
    this.L = layout(this.m, input, false);
    const s = this;
    this.gesture = new Gesture({
      layout: () => s.L,
      view: () => s.v!,
      setView: (v) => ((s.v = v), s.changed()),
      wires: () => wireList(s.w),
      runOn: () => s.pb !== null,
      input: (k) => s.setInput(k),
      start: () => s.start,
      setStart: (p) => ((s.start = p), s.changed()),
      join: (a, b) => s.act(join(s.m, s.w, a, b)),
      move: (to, end, target) => s.act(move(s.m, s.w, to, end, target)),
      remove: (to) => void s.act(remove(s.w, to)),
      show: (d) => ((s.drag = d), s.changed()),
      spring: (d, back) => (s.springs.push({ d, back, t: 0 }), s.changed()),
    });

    this.title = button(`LEVEL ${id}`, () => this.setPanel(this.panel === "brief" ? null : "brief"));
    const top = el("header", "bar top");
    const right = el("div", "grp");
    right.append(
      button("MAP", () => {
        if (this.pb) this.stop();
        host.sound("button");
        host.map();
      }),
      button("SETTINGS", () => {
        host.sound("button");
        host.settings();
      }),
    );
    top.append(this.title, right);

    this.buttons = {
      undo: button("UNDO", () => this.edit(undo(this.w))),
      clear: button("CLEAR", () => this.edit(clear(this.w))),
      launch: button("LAUNCH", () => this.launch()),
      fast: button("FAST", () => this.pb && ((this.pb.fast = !this.pb.fast), this.renderBars())),
      skip: button("SKIP", () => this.pb && (this.pb.skip(), this.end())),
      stop: button("STOP", () => this.stop()),
    };

    const svg = svgEl("svg");
    const style = svgEl("style");
    style.textContent = svgCss();
    this.level.append(this.layers.cards, this.layers.wires, this.layers.tokens, this.layers.over);
    svg.append(style, this.level);
    this.area.append(svg);
    this.wireEvents();

    // LEVEL-03, SAVE-04: a press on the brief or the notice closes it; by keyboard, Enter or Space.
    const closes = () => this.panel === "brief" || this.panel === "notice";
    this.panelEl.addEventListener("click", () => closes() && this.setPanel(null));
    this.panelEl.addEventListener("keydown", (k) => {
      if (!closes() || (k.key !== "Enter" && k.key !== " ")) return;
      k.preventDefault();
      this.setPanel(null);
    });
    this.root.append(top, this.area, this.bottom, this.panelEl);
    this.render();
  }

  /** Once the root is in the page: the play area's size opens the view, VIEW-02. */
  attach() {
    this.resize.observe(this.area);
    this.fit();
  }

  destroy() {
    this.resize.disconnect();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  get runOn() {
    return this.pb !== null;
  }

  /** The play screen hidden, by settings or the page, RUN-12. */
  setHidden(h: boolean) {
    this.hidden = h;
    this.root.inert = h;
    if (this.pb) this.pb.paused = h;
    if (!h) this.notice();
    this.render();
    this.wake();
  }

  /** VIEW-01: any press on the screen sets the port targets. */
  setInput(kind: InputKind) {
    if (kind === this.input) return;
    this.input = kind;
    const L = layout(this.m, kind, this.L.turned);
    if (this.v) this.v = refit(this.v, this.L, L, this.v.w, this.v.h);
    this.L = L;
    this.changed();
  }

  /** SAVE-04: shows the notice when it is due and no brief or report shows. */
  notice() {
    if (this.hidden || this.panel !== null || !this.host.takeNotice()) return;
    this.panel = "notice";
    this.render();
  }

  private fit() {
    const w = this.area.clientWidth;
    const h = this.area.clientHeight;
    if (!w || !h) return;
    const turned = h > w;
    if (!this.v) {
      this.L = layout(this.m, this.input, turned);
      this.v = openView(w, h, this.L);
    } else if (w !== this.v.w || h !== this.v.h || turned !== this.L.turned) {
      // VIEW-06.
      const L = turned === this.L.turned ? this.L : layout(this.m, this.input, turned);
      this.v = refit(this.v, this.L, L, w, h);
      this.L = L;
    }
    this.changed();
  }

  private wireEvents() {
    const a = this.area;
    const at = (e: { clientX: number; clientY: number }): Point => {
      const r = a.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    // VIEW-01 by any press; VIEW-10 by a press off the play area.
    this.root.addEventListener(
      "pointerdown",
      (e) => {
        this.setInput(inputOf(e));
        if (!a.contains(e.target as Node)) this.gesture.outside();
      },
      true,
    );
    a.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      a.setPointerCapture(e.pointerId);
      this.pressed.add(e.pointerId);
      this.gesture.down(e.pointerId, at(e), inputOf(e));
      this.wake();
    });
    a.addEventListener("pointermove", (e) => this.gesture.move(e.pointerId, at(e)));
    a.addEventListener("pointerup", (e) => {
      this.pressed.delete(e.pointerId);
      this.gesture.up(e.pointerId, at(e));
    });
    // A capture lost with no up, as when the screen goes inert, ends as the browser's cancel; after an up it does nothing.
    for (const t of ["pointercancel", "lostpointercapture"] as const)
      a.addEventListener(t, (e) => {
        this.pressed.delete(e.pointerId);
        this.gesture.cancel(e.pointerId);
      });
    // VIEW-03: the wheel, and a trackpad's pinch or two-finger scroll, which browsers send as the wheel.
    a.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const px = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? a.clientHeight : 1;
        this.gesture.zoom(Math.exp(-e.deltaY * px * (e.ctrlKey ? 0.01 : 0.002)), at(e));
      },
      { passive: false },
    );
    // Safari's trackpad pinch. A touch pinch also sends these on Safari; its pointers zoom instead.
    let scale = 1;
    const gesture = (e: Event & { scale?: number; clientX?: number; clientY?: number }) => {
      e.preventDefault();
      const s = e.scale ?? 1;
      if (e.type !== "gesturestart" && !this.pressed.size && scale > 0) this.gesture.zoom(s / scale, at({ clientX: e.clientX ?? 0, clientY: e.clientY ?? 0 }));
      scale = s;
    };
    for (const t of ["gesturestart", "gesturechange", "gestureend"]) a.addEventListener(t, gesture as EventListener, { passive: false });
  }

  /** A wiring action, or none. */
  private act(o: Outcome | null): boolean {
    if (!o) return false;
    this.host.sound(o.sound);
    this.rests = [];
    this.result = null;
    // LEVEL-03, REPORT-08, SAVE-04: a wiring action closes the panel that shows.
    this.panel = null;
    this.host.wired(wireList(this.w));
    this.notice();
    this.render();
    return true;
  }

  /** Undo or Clear: VIEW-11 drops a chosen start, whether or not the wiring changes. */
  private edit(o: Outcome | null) {
    const chosen = this.start !== null;
    this.start = null;
    if (!this.act(o) && chosen) this.changed();
  }

  /** RUN-01, with WIRE-06's lock. */
  private launch() {
    if (this.pb) return;
    this.gesture.lock();
    this.start = null;
    this.drag = null;
    this.rests = [];
    this.result = null;
    this.pb = new Playback(this.m, run(this.m, this.w));
    this.pb.paused = this.hidden;
    this.host.sound("launch");
    this.render();
  }

  /** RUN-11: no result, and the tokens leave the wires. */
  private stop() {
    this.pb = null;
    this.rests = [];
    this.render();
  }

  /** RUN-08, then REPORT-01. */
  private end() {
    const r = this.pb!.r;
    const shown = { result: r, report: report(this.m, r) };
    this.pb = null;
    this.rests = restsOf(this.m, r);
    this.result = shown;
    if (r.won) this.host.won();
    this.host.sound(r.won ? "win" : "fail");
    this.panel = "report";
    this.render();
  }

  private setPanel(p: Panel) {
    this.panel = p;
    if (p === null) this.notice();
    this.render();
  }

  private changed() {
    this.dirty = true;
    this.wake();
  }

  private wake() {
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 0;
    this.last = now;
    const pb = this.pb;
    if (pb && !pb.paused) {
      for (const s of pb.advance(dt)) this.host.sound(s);
      if (pb.ended) this.end();
      this.dirty = true;
    }
    this.gesture.tick(dt);
    if (this.springs.length) {
      for (const s of this.springs) s.t += dt;
      this.springs = this.springs.filter((s) => s.t < param("SpringTime"));
      this.dirty = true;
    }
    if (this.dirty) this.draw();
    if ((this.pb && !this.pb.paused) || this.springs.length || this.gesture.drawing) this.raf = requestAnimationFrame(this.frame);
    else this.last = 0;
  };

  private put(e: Element, html: string) {
    if (this.drawn.get(e) === html) return;
    this.drawn.set(e, html);
    e.innerHTML = html;
  }

  private draw() {
    this.dirty = false;
    const v = this.v;
    if (!v) return;
    const { L, m } = this;
    const measure = this.host.measure;
    this.level.setAttribute("transform", `translate(${num(v.x)} ${num(v.y)}) scale(${+v.zoom.toFixed(5)})`);
    const f = this.pb?.frame(L);
    this.put(this.layers.cards, drawCards(L, measure, f ?? IDLE));
    const hide = new Set([this.drag?.hide, ...this.springs.map((s) => s.d.hide)]);
    this.put(this.layers.wires, drawWires(L, wireList(this.w).filter((w) => !hide.has(w.to))));
    this.put(this.layers.tokens, f ? drawTokens(L, f.moving, restsOf(m, this.pb!.r, f.t), measure) : drawTokens(L, [], this.rests, measure));
    const line = (d: DragShow, end: Point) => drawDragLine(spot(L, d.from), end, portKind(m, d.from)!);
    const springs = this.springs.map((s) => {
      const k = Math.min(1, s.t / param("SpringTime"));
      return line(s.d, { x: s.d.end.x + (s.back.x - s.d.end.x) * k, y: s.d.end.y + (s.back.y - s.d.end.y) * k });
    });
    this.put(this.layers.over, (this.start ? drawChosenStart(L, this.start) : "") + springs.join("") + (this.drag ? line(this.drag, this.drag.end) : ""));
  }

  private render() {
    setState(this.title, this.panel === "brief" ? "on" : "normal");
    this.renderBars();
    this.renderPanel();
    this.changed();
  }

  private renderBars() {
    const b = this.buttons;
    const left = el("div", "grp");
    const right = el("div", "grp");
    if (this.pb) {
      setState(b.fast, this.pb.fast ? "on" : "normal");
      left.append(b.fast, b.skip);
      right.append(b.stop);
    } else {
      // Disabled where a press changes nothing.
      setState(b.undo, this.w.done.length ? "normal" : "off");
      setState(b.clear, this.w.wires.size ? "normal" : "off");
      left.append(b.undo, b.clear);
      right.append(b.launch);
    }
    this.bottom.replaceChildren(left, right);
    // Under a panel: no press reaches it, by keyboard either.
    this.bottom.inert = this.panel !== null;
  }

  private renderPanel() {
    const p = this.panel;
    const box = this.panelEl;
    box.hidden = p === null;
    box.className = `panel ${p ?? ""}`.trim();
    if (!p) return box.replaceChildren();
    const col = el("div", "col");
    const words = el("div", "words");
    const heading = el("h2", "label", { brief: "BRIEF", report: "REPORT", notice: "PROGRESS" }[p]);
    col.append(heading, words);
    if (p === "brief") {
      const l = this.m.level;
      words.append(el("p", "", [sentence(l.task), sentence(l.stake), l.words.newLine].filter(Boolean).join(" ")));
    } else if (p === "notice") {
      words.append(el("p", "", SHELL_WORDS.notKept));
    } else {
      const shown = this.result!;
      words.append(...shown.report.lines.map((s) => el("p", "", s)));
      const btns = el("div", "btns");
      btns.append(
        button("CLOSE", () => this.setPanel(null)),
        button("SAVE PICTURE", () => this.host.picture({ m: this.m, wiring: this.w, ...shown })),
      );
      if (shown.report.won) btns.append(isLast(this.id) ? button("CAMPAIGN MAP", () => this.host.campaignMap()) : button("NEXT LEVEL", () => this.host.next()));
      col.append(btns);
    }
    box.setAttribute("role", p === "report" ? "dialog" : "button");
    // The report dialog is named by its heading.
    heading.id = "panel-heading";
    if (p === "report") box.setAttribute("aria-labelledby", heading.id);
    else box.removeAttribute("aria-labelledby");
    box.tabIndex = p === "report" ? -1 : 0;
    box.replaceChildren(col);
  }
}
