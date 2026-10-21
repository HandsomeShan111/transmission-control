// The synthesizer, ART-14 and ART-15: every name, valid WAV, same bytes each run, lengths, levels, loops.
import { describe, expect, test } from "bun:test";
import { RATE, synthesize } from "../../tools/synth.ts";
import { SOUNDS, TRACKS } from "../../src/shell/sound-names.ts";

const all = synthesize();
const byName = new Map(all.map((s) => [s.name as string, s.wav]));
const samples = (name: string) => new Int16Array(byName.get(name)!.slice(44).buffer);
const seconds = (name: string) => samples(name).length / RATE;
const peak = (name: string) => samples(name).reduce((m, s) => Math.max(m, Math.abs(s)), 0) / 32768;
const db = (x: number) => 20 * Math.log10(x);
const crossings = (name: string) => samples(name).reduce((n, s, i, a) => n + (i > 0 && (s < 0) !== (a[i - 1] < 0) ? 1 : 0), 0) / 2 / seconds(name);

describe("Synthesizer", () => {
  test("gives exactly the sounds and tracks, once each", () => {
    expect(all.map((s) => s.name).sort()).toEqual([...SOUNDS, ...TRACKS].sort());
  });

  test("two calls give the same bytes", () => {
    const again = synthesize();
    expect(again.map((s) => s.name)).toEqual(all.map((s) => s.name));
    again.forEach((s, i) => expect(Buffer.from(s.wav).equals(Buffer.from(all[i].wav))).toBe(true));
  });

  test("each is a 16-bit mono 22,050 Hz WAV whose sizes match its length", () => {
    for (const { name, wav } of all) {
      const v = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
      const text = (at: number) => String.fromCharCode(...wav.slice(at, at + 4));
      expect([name, text(0), text(8), text(12), text(36)]).toEqual([name, "RIFF", "WAVE", "fmt ", "data"]);
      expect(v.getUint16(20, true)).toBe(1); // PCM
      expect(v.getUint16(22, true)).toBe(1); // mono
      expect(v.getUint32(24, true)).toBe(22050);
      expect(v.getUint16(34, true)).toBe(16);
      expect(v.getUint32(40, true)).toBe(wav.length - 44);
      expect(v.getUint32(4, true)).toBe(wav.length - 8);
    }
  });

  test("sounds are short: clicks under 0.1 s, win and fail under 0.8 s", () => {
    for (const name of ["connect", "cut", "works", "arrives", "button"]) expect(seconds(name)).toBeLessThan(0.1);
    for (const name of ["win", "fail"]) expect(seconds(name)).toBeLessThan(0.8);
  });

  test("launch lasts BeepTime, 0.25 s, to the sample, and is one pure tone", () => {
    expect(Math.abs(seconds("launch") - 0.25)).toBeLessThan(1 / RATE);
    // 880 Hz: 220 cycles in a second, counted as pairs of crossings.
    expect(crossings("launch")).toBeGreaterThan(860);
    expect(crossings("launch")).toBeLessThan(900);
    // Short fades: it starts and ends on silence.
    const x = samples("launch");
    expect(x[0]).toBe(0);
    expect(Math.abs(x[x.length - 1])).toBeLessThan(40);
  });

  test("cut is lower than connect", () => {
    expect(crossings("cut")).toBeLessThan(crossings("connect"));
  });

  test("nothing is silent or at full scale; sounds peak near -3 dBFS and tracks near -12", () => {
    for (const name of SOUNDS) {
      expect(peak(name)).toBeLessThan(0.98);
      expect(db(peak(name))).toBeGreaterThan(-4);
      expect(db(peak(name))).toBeLessThan(-2);
    }
    for (const name of TRACKS) {
      expect(peak(name)).toBeLessThan(0.98);
      expect(db(peak(name))).toBeGreaterThan(-13);
      expect(db(peak(name))).toBeLessThan(-11);
    }
  });

  test("tracks last 16 to 24 s and their end joins their start", () => {
    for (const name of TRACKS) {
      expect(seconds(name)).toBeGreaterThanOrEqual(16);
      expect(seconds(name)).toBeLessThanOrEqual(24);
      const x = samples(name);
      const join = Math.abs(x[0] - x[x.length - 1]);
      const step = x.reduce((m, s, i) => (i ? Math.max(m, Math.abs(s - x[i - 1])) : m), 0);
      // The jump over the loop point is no bigger than the biggest step inside the track, and small.
      expect(join).toBeLessThanOrEqual(step);
      expect(join / 32768).toBeLessThan(0.02);
    }
  });

  test("all together are under 2.5 MB", () => {
    expect(all.reduce((n, s) => n + s.wav.length, 0)).toBeLessThan(2.5e6);
  });
});
