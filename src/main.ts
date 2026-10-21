// Start-up, APP-01 to APP-04 and APP-07: the font, the save, the visit and sound; then the first screen, then the service worker.
import "./ui/style.css";
import { STYLE } from "./content/generated.ts";
import { dayOf } from "./core/counts.ts";
import { sharePicture, toPng } from "./draw/share.ts";
import type { Measure } from "./draw/text.ts";
import { createAudio } from "./shell/audio.ts";
import { sendWaiting } from "./shell/counts-send.ts";
import type { SoundName, TrackName } from "./shell/sound-names.ts";
import { askKeep, createStore } from "./shell/storage.ts";
import { joinVisit } from "./shell/visit.ts";
import { App } from "./ui/app.ts";
import { inputOf } from "./ui/play.ts";

const ASSETS = __ASSETS__;

const store = createStore({ storage: () => localStorage, locks: navigator.locks });
const data = store.load();
const setLook = (look: "light" | "dark") => (document.documentElement.dataset.look = look);
setLook(data.settings.look);

const audio = createAudio({
  createContext: () => new AudioContext(),
  fetch: (url) => fetch(url),
  urls: ASSETS.sounds as Record<SoundName | TrackName, string>,
  nextFrame: (fn) => requestAnimationFrame(() => fn()),
});
audio.setSettings(data.settings);
for (const t of ["pointerdown", "pointerup", "touchend", "keydown"]) window.addEventListener(t, () => audio.press(), true);

/** Text widths in Jost, letter spacing included, as the SVG text shows them. */
const canvas = document.createElement("canvas").getContext("2d")!;
const widths = new Map<string, number>();
const measure: Measure = (text, font) => {
  const key = `${font} ${text}`;
  let w = widths.get(key);
  if (w === undefined) {
    const f = STYLE.fonts[font];
    canvas.font = `${f.weight} ${f.size}px Jost`;
    w = canvas.measureText(text).width + text.length * f.spacing * f.size;
    widths.set(key, w);
  }
  return w;
};

/** The font as a data URL, for the share picture, which an image draws with no access to the page's fonts. */
let fontCss: Promise<string> | null = null;
const embeddedFont = () =>
  (fontCss ??= fetch(ASSETS.font)
    .then((r) => {
      if (!r.ok) throw new Error(`font: HTTP ${r.status}`);
      return r.blob();
    })
    .then(
      (b) =>
        new Promise<string>((done, fail) => {
          const r = new FileReader();
          r.onload = () => done(`@font-face{font-family:Jost;font-weight:400 700;src:url(${r.result}) format("woff2")}`);
          r.onerror = () => fail(r.error);
          r.readAsDataURL(b);
        }),
    )
    .catch((e) => {
      // The next picture tries again.
      fontCss = null;
      throw e;
    }));

/** The address the game was opened from. */
const address = () => (location.host + location.pathname).replace(/index\.html$/, "").replace(/\/$/, "");

const font = new FontFace("Jost", `url(${ASSETS.font})`, { weight: "400 700" });
document.fonts.add(font);
const [visit] = await Promise.all([
  joinVisit({
    channel: (name) => new BroadcastChannel(name),
    session: () => sessionStorage,
    wasDiscarded: (document as Document & { wasDiscarded?: boolean }).wasDiscarded ?? false,
  }),
  font.load(),
]);

const app = new App(
  {
    root: document.getElementById("app")!,
    store,
    visit,
    audio,
    measure,
    today: () => dayOf(new Date()),
    send: (s) => sendWaiting(s, { address: __COUNTS__, fetch: (url, init) => fetch(url, init) }),
    keep: () => askKeep(navigator.storage),
    setLook,
    // REPORT-07: the picture saved as a PNG file named after its level.
    async picture(o) {
      try {
        const svg = sharePicture({ ...o, look: data.settings.look, address: address(), measure, fontCss: await embeddedFont() });
        const png = await toPng(svg, {
          createImage: () => new Image(),
          createCanvas: (width, height) => Object.assign(document.createElement("canvas"), { width, height }),
        });
        const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(png), download: `transmission-control-level-${o.m.level.id}.png` });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      } catch (e) {
        console.error("picture not saved", e);
      }
    },
  },
  matchMedia("(pointer: coarse)").matches ? "touch" : "pointer",
);
// VIEW-01: the last press's input, for each level opened.
window.addEventListener("pointerdown", (e) => (app.input = inputOf(e)), true);
document.addEventListener("visibilitychange", () => app.setPageHidden(document.hidden));
app.setPageHidden(document.hidden);
app.start();
document.getElementById("opening")?.remove();
// APP-02: sounds, then music, behind play.
audio.load();
// APP-03: the service worker keeps the game's files for later visits; after the first load, so it takes none of its time.
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch((e) => console.error("service worker not registered", e));
