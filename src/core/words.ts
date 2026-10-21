// How data words show, ART-13.

/** A task, stake or situation as a sentence: a capital first letter, a full stop at its end. */
export function sentence(s: string): string {
  const t = s.charAt(0).toUpperCase() + s.slice(1);
  return t.endsWith(".") ? t : t + ".";
}
