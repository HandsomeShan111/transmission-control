// The settings screen, Settings' Layout, APP-05 and MEAS-04. The home screen suggestion never shows: OQ-SHELL-08 is open.
import { SHELL_WORDS } from "../content/generated.ts";
import type { Settings } from "../core/save.ts";
import { param } from "../core/level.ts";
import { button, dragScroll, el, setState } from "./dom.ts";

export interface SettingsHost {
  /** The save's settings, as they are now. */
  settings(): Settings;
  /** RUN-12: Reset is not offered during a run. */
  runOn(): boolean;
  /** After SAVE-04: progress is not kept. */
  notKept(): boolean;
  /** A press switches it. */
  flip(k: keyof Settings): void;
  /** Reset confirmed, SAVE-06. */
  reset(): void;
  close(): void;
  /** APP-07: every control here makes the button sound. */
  sound(): void;
}

export class SettingsScreen {
  readonly root = el("div", "screen settings");
  /** Reset pressed once, not yet confirmed. */
  private confirming = false;
  private b: Record<keyof Settings | "reset", HTMLButtonElement>;
  private resetRow = el("div", "row end");
  private notKept = el("p", "line", SHELL_WORDS.notKept);

  constructor(private host: SettingsHost) {
    const top = el("header", "bar top");
    const right = el("div", "grp");
    right.append(this.press("CLOSE", () => host.close()));
    top.append(el("h1", "label", "SETTINGS"), right);
    const flip = (k: keyof Settings) => () => (host.flip(k), this.render());
    this.b = {
      look: this.press("", flip("look")),
      sound: this.press("", flip("sound")),
      music: this.press("", flip("music")),
      counts: this.press("", flip("counts")),
      reset: this.press("", () => {
        this.confirming = !this.confirming;
        if (this.confirming) return this.render();
        host.reset();
      }),
    };
    // A button is named by its row and its word, "Sound ON", not "ON" alone.
    const row = (name: string, b: HTMLButtonElement, cls = "row") => {
      const r = el("div", cls);
      const n = el("span", "", name);
      n.id = `setting-${name.toLowerCase()}`;
      b.id = `${n.id}-value`;
      b.setAttribute("aria-labelledby", `${n.id} ${b.id}`);
      r.append(n, b);
      return r;
    };
    this.resetRow.append(this.b.reset);
    const col = el("div", "col");
    col.append(
      row("Look", this.b.look),
      row("Sound", this.b.sound),
      row("Music", this.b.music),
      row("Counts", this.b.counts, "row with-line"),
      el("p", "muted line", SHELL_WORDS.countsLine),
      this.resetRow,
      this.notKept,
    );
    const scroll = el("div", "scroll");
    scroll.append(col);
    dragScroll(scroll, param("TapDistance"));
    this.root.append(top, scroll);
    this.render();
  }

  /** A shell control: its change, then the button sound, so a sound switched off is already off. */
  private press(word: string, fn: () => void) {
    return button(word, () => {
      fn();
      this.host.sound();
    });
  }

  render() {
    const s = this.host.settings();
    this.b.look.textContent = s.look === "light" ? "LIGHT" : "DARK";
    for (const k of ["sound", "music", "counts"] as const) {
      this.b[k].textContent = s[k] ? "ON" : "OFF";
      setState(this.b[k], s[k] ? "on" : "normal");
    }
    this.b.reset.textContent = this.confirming ? "CONFIRM RESET" : "RESET";
    this.resetRow.hidden = this.host.runOn();
    this.notKept.hidden = !this.host.notKept();
  }

  /** Each opening starts with no Reset pressed: one pressed once and not confirmed is dropped. */
  open() {
    this.confirming = false;
    this.render();
  }
}
