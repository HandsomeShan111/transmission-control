// The campaign map, Campaign map's Layout, CAMP-03 and CAMP-04; the act card, CAMP-05, and the title screen, APP-01, as ART-11.
import { ACTS } from "../content/generated.ts";
import type { Act } from "../content/types.ts";
import { LEVEL_IDS, levelState, type Progress } from "../core/campaign.ts";
import { param } from "../core/level.ts";
import { sentence } from "../core/words.ts";
import { lamp } from "../draw/marks.ts";
import { button, dragScroll, el, pressable, setState } from "./dom.ts";

const LAMP = { won: "lit", unlocked: "unlocked", locked: "locked" } as const;

/** Number and name in Title: on one line where they fit, else the number above the name. */
function actWords(a: Act): HTMLElement[] {
  const title = el("h2", "title");
  title.append(el("span", "", `ACT ${a.act}`), " ", el("span", "", a.name));
  return [title, el("p", "", sentence(a.situation))];
}

/** `open`: a won or unlocked level pressed. A locked one changes nothing. */
export function campaignMap(p: Progress, open: (id: number) => void) {
  const root = el("div", "screen map");
  const top = el("header", "bar top");
  top.append(el("h1", "label", "CAMPAIGN"));
  const scroll = el("div", "scroll");
  const col = el("div", "col");
  const sections = ACTS.map((a) => {
    const s = el("section", "act");
    const levels = el("div", "levels");
    for (const id of LEVEL_IDS.filter((id) => id >= a.first && id <= a.last)) {
      const state = levelState(p, id);
      const b = button("", () => open(id));
      b.classList.add("level");
      b.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">${lamp(LAMP[state], 5, 5)}</svg><span>${id}</span>`;
      // The lamp is hidden, so its state is in the name: "Level 3 won".
      b.setAttribute("aria-label", `Level ${id} ${state}`);
      if (state === "locked") setState(b, "off");
      levels.append(b);
    }
    s.append(...actWords(a), levels);
    return s;
  });
  col.append(...sections);
  scroll.append(col);
  dragScroll(scroll, param("TapDistance"));
  root.append(top, scroll);
  return {
    root,
    /** Once in the page: the act of the lowest-numbered level not won at the column's top; every level won, the map's top. */
    attach() {
      const id = LEVEL_IDS.find((id) => !p.won.has(id));
      const k = id === undefined ? -1 : ACTS.findIndex((a) => id >= a.first && id <= a.last);
      scroll.scrollTop = k < 0 ? 0 : sections[k].offsetTop - col.offsetTop;
    },
  };
}

/** The whole screen, no bars; a press closes it. */
function card(words: HTMLElement[], close: () => void): HTMLElement {
  const root = el("div", "screen card");
  const col = el("div", "col");
  col.append(...words);
  root.append(col);
  pressable(root, close);
  return root;
}

export const actCard = (a: Act, close: () => void) => card(actWords(a), close);

/** The game's name, shown to players, in Title. */
export const titleScreen = (close: () => void) => card([el("h1", "title", "Transmission Control")], close);
