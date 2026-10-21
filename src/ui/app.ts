// The screens and the way between them, APP-01 and APP-05 to APP-07, CAMP-02 to CAMP-05; what each
// step keeps, SAVE-02, SAVE-04, SAVE-06 and SAVE-07; and the counts, MEAS-01 to MEAS-03.
import { actCardAfter, actCardBefore, LEVEL_IDS, nextLevel, startLevel, win } from "../core/campaign.ts";
import { countsOff, expire, record } from "../core/counts.ts";
import { levelById, levelModel } from "../core/level.ts";
import { decodeWires, encodeWires, progressOf, reset, setProgress, type EventName, type SaveData } from "../core/save.ts";
import type { InputKind } from "../draw/layout.ts";
import type { Measure } from "../draw/text.ts";
import type { GameAudio } from "../shell/audio.ts";
import type { Store } from "../shell/storage.ts";
import type { Visit } from "../shell/visit.ts";
import { actCard, campaignMap, titleScreen } from "./map.ts";
import { Play, type PlayHost } from "./play.ts";
import { SettingsScreen } from "./settings.ts";

export interface AppDeps {
  root: HTMLElement;
  store: Store;
  visit: Visit;
  audio: GameAudio;
  measure: Measure;
  /** YYYY-MM-DD, UTC. */
  today: () => string;
  /** MEAS-03: sends the save's waiting events, removing each one sent. */
  send: (s: SaveData) => Promise<unknown>;
  /** SAVE-07. */
  keep: () => void;
  /** Every screen in the look at once, APP-05. */
  setLook: (look: "light" | "dark") => void;
  picture: PlayHost["picture"];
}

/** Visit flags: the visit's first wiring action taken; SAVE-04's notice shown. */
const WIRED = "wired";
const NOTICE = "notice";

export class App {
  /** VIEW-01: the player's last press, set by the page. */
  input: InputKind;
  private play: Play | null = null;
  private settings: SettingsScreen;
  private settingsOpen = false;
  private pageHidden = false;
  private sending = Promise.resolve();

  constructor(
    private d: AppDeps,
    input: InputKind,
  ) {
    this.input = input;
    const s = this;
    this.settings = new SettingsScreen({
      settings: () => s.data.settings,
      runOn: () => s.play?.runOn ?? false,
      notKept: () => s.notKept(),
      flip(k) {
        const set = s.data.settings;
        if (k === "look") {
          set.look = set.look === "light" ? "dark" : "light";
          d.setLook(set.look);
        } else {
          set[k] = !set[k];
          if (k === "counts" && !set.counts) countsOff(s.data);
          d.audio.setSettings(set);
        }
        s.write();
      },
      reset() {
        Object.assign(s.data, reset(s.data));
        s.write();
        s.closeSettings();
        s.showLevel(LEVEL_IDS[0]);
      },
      close: () => s.closeSettings(),
      sound: () => d.audio.play("button"),
    });
    d.store.onFail(() => {
      this.play?.notice();
      if (this.settingsOpen) this.settings.render();
    });
  }

  private get data() {
    return this.d.store.data;
  }

  private write() {
    void this.d.store.write();
  }

  /** APP-01, once the first load has arrived: the title screen; MEAS-03's waiting events sent. */
  start() {
    if (expire(this.data, this.d.today())) this.write();
    this.show(titleScreen(() => this.openSession()), null);
    this.send();
  }

  /**
   * The title screen pressed: the level a session starts on, after its act's card, CAMP-05, or the
   * map with every level won; MEAS-01 on a first visit.
   */
  private openSession() {
    const id = startLevel(progressOf(this.data));
    if (id === null) return this.showMap();
    const go = () => {
      this.showLevel(id);
      if (this.d.store.fresh) this.count("first_level_start");
    };
    const act = actCardBefore(id);
    if (!act) return go();
    this.show(actCard(act, go), null);
    this.d.audio.setTrack("map");
  }

  /** The page hidden or shown, APP-07 and RUN-12. */
  setPageHidden(h: boolean) {
    this.pageHidden = h;
    this.d.audio.setHidden(h);
    this.play?.setHidden(h || this.settingsOpen);
  }

  private count(name: EventName) {
    if (record(this.data, name, this.d.today())) this.send();
  }

  /**
   * MEAS-03: a write first, so Counts switched off in another page holds; then the send, and a
   * write of what it removed. One send at a time, so no event goes twice.
   */
  private send() {
    if (!this.data.events.length) return;
    this.sending = this.sending.then(async () => {
      await this.d.store.write();
      if (!this.data.events.length) return;
      await this.d.send(this.data);
      await this.d.store.write();
    });
  }

  /** SAVE-04: a write failed, and the visit has taken a wiring action. */
  private notKept() {
    return this.d.store.failed && this.d.visit.has(WIRED);
  }

  private show(e: HTMLElement, play: Play | null) {
    this.play?.destroy();
    this.play = play;
    this.d.root.replaceChildren(e);
    // A card takes the keyboard at once: Enter or Space closes it with no Tab first.
    if (e.tabIndex >= 0) e.focus({ preventScroll: true });
  }

  /** LEVEL-01, with the wiring Save kept for it. */
  private showLevel(id: number) {
    const m = levelModel(levelById(id));
    const play = new Play(this.playHost, id, decodeWires(m, this.data.wiring[id] ?? []), this.input);
    this.show(play.root, play);
    play.attach();
    if (this.pageHidden) play.setHidden(true);
    this.d.audio.setTrack("level");
  }

  /** CAMP-04. */
  private showMap() {
    const map = campaignMap(progressOf(this.data), (id) => this.showLevel(id));
    this.show(map.root, null);
    map.attach();
    this.d.audio.setTrack("map");
  }

  private openSettings() {
    this.settingsOpen = true;
    this.settings.open();
    this.d.root.append(this.settings.root);
    this.play?.setHidden(true);
  }

  private closeSettings() {
    this.settingsOpen = false;
    this.settings.root.remove();
    this.play?.setHidden(this.pageHidden);
  }

  private playHost: PlayHost = {
    measure: (text, font) => this.d.measure(text, font),
    sound: (name) => this.d.audio.play(name),
    map: () => this.showMap(),
    settings: () => this.openSettings(),
    wired: (wires) => {
      const { id, m } = this.play!;
      if (wires.length) this.data.wiring[id] = encodeWires(m, wires);
      else delete this.data.wiring[id];
      if (!this.d.visit.has(WIRED)) this.d.visit.set(WIRED);
      this.write();
    },
    won: () => {
      const p = progressOf(this.data);
      const o = win(p, this.play!.id);
      if (o.changed) {
        setProgress(this.data, p);
        this.write();
      }
      if (o.firstWin) this.d.keep();
      if (o.finished) this.count("campaign_finish");
    },
    next: () => {
      const id = this.play!.id;
      const next = nextLevel(id)!;
      const act = actCardAfter(id);
      if (!act) return this.showLevel(next);
      this.show(actCard(act, () => this.showLevel(next)), null);
      this.d.audio.setTrack("map");
    },
    campaignMap: () => this.showMap(),
    takeNotice: () => {
      if (!this.notKept() || this.d.visit.has(NOTICE)) return false;
      this.d.visit.set(NOTICE);
      return true;
    },
    picture: (o) => this.d.picture(o),
  };
}
