// Small DOM helpers the screens share.

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** UI style's Button: normal; on, pressed or on; off, disabled. */
export type ButtonState = "normal" | "on" | "off";

/** A disabled button still takes the press, so VIEW-10 sees it, but does nothing with it. */
export function button(word: string, press: () => void): HTMLButtonElement {
  const b = el("button", "btn label", word);
  b.type = "button";
  b.addEventListener("click", () => {
    if (!b.classList.contains("off")) press();
  });
  return b;
}

export function setState(b: HTMLButtonElement, s: ButtonState) {
  b.classList.toggle("on", s === "on");
  b.classList.toggle("off", s === "off");
  b.setAttribute("aria-disabled", String(s === "off"));
}

export const SVG_NS = "http://www.w3.org/2000/svg";

export const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K) => document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];

/**
 * A press that takes Enter or Space too, for a card that closes on a press. A double click's
 * second click is dropped, so it never closes the screen the first one opened.
 */
export function pressable(e: HTMLElement, press: () => void) {
  e.setAttribute("role", "button");
  e.tabIndex = 0;
  e.addEventListener("click", (c) => {
    if (c.detail <= 1) press();
  });
  e.addEventListener("keydown", (k) => {
    if (k.key !== "Enter" && k.key !== " ") return;
    k.preventDefault();
    press();
  });
}

/**
 * A mouse drag scrolls `e`, as touch and the wheel already do; past TapDistance
 * it is a drag, and the click at its end does not reach a button.
 */
export function dragScroll(e: HTMLElement, tapDistance: number) {
  let from: { id: number; y: number; top: number } | null = null;
  let dragged = false;
  e.addEventListener("pointerdown", (p) => {
    if (p.pointerType !== "mouse" || p.button !== 0) return;
    from = { id: p.pointerId, y: p.clientY, top: e.scrollTop };
    dragged = false;
  });
  e.addEventListener("pointermove", (p) => {
    if (!from || p.pointerId !== from.id) return;
    const dy = p.clientY - from.y;
    if (!dragged && Math.abs(dy) > tapDistance) {
      dragged = true;
      e.setPointerCapture(p.pointerId);
    }
    if (dragged) e.scrollTop = from.top - dy;
  });
  const end = (p: PointerEvent) => {
    if (from && p.pointerId === from.id) from = null;
  };
  e.addEventListener("pointerup", end);
  e.addEventListener("pointercancel", end);
  e.addEventListener(
    "click",
    (c) => {
      if (!dragged) return;
      dragged = false;
      c.stopPropagation();
      c.preventDefault();
    },
    true,
  );
}
