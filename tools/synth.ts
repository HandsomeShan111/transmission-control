// The game's sounds and music, made by synthesis, the same each run: ART-14, ART-15.
// Run: bun tools/synth.ts <out-dir> writes <name>.wav for each.
import { param } from "../src/core/level.ts";
import { SOUNDS, TRACKS, type SoundName, type TrackName } from "../src/shell/sound-names.ts";

export const RATE = 22050;

const TAU = Math.PI * 2;
const BEEP_TIME = param("BeepTime");
const SOUND_PEAK = 0.708; // -3 dBFS
const TRACK_PEAK = 0.251; // -12 dBFS
const LEVEL_SEC = 20;
const MAP_SEC = 16;

/** 16-bit mono PCM WAV of samples in -1..1. */
export function wav(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(out.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, s)) * 32767), true));
  return out;
}

/** White noise in -1..1 from a fixed seed (mulberry32): no Math.random, so every run is the same. */
function noise(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

const silence = (sec: number) => new Float32Array(Math.round(sec * RATE));

/** Scales x so its largest sample is `peak`. */
function norm(x: Float32Array, peak: number): Float32Array {
  const top = x.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
  return x.map((s) => (s * peak) / top);
}

/** Raised-cosine fades over the first `inSec` and last `outSec`, so a sound neither starts nor ends on a step. */
function fade(x: Float32Array, inSec: number, outSec: number): Float32Array {
  const a = Math.round(inSec * RATE);
  const b = Math.round(outSec * RATE);
  for (let i = 0; i < a; i++) x[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / a);
  for (let i = 0; i < b; i++) x[x.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / b);
  return x;
}

/** Adds a sine struck at `at` s, dying away with time constant `tau` s: a part of a mechanism ringing. */
function ping(x: Float32Array, at: number, hz: number, tau: number, amp: number) {
  for (let i = Math.round(at * RATE), k = 0; i < x.length; i++, k++) {
    const t = k / RATE;
    x[i] += amp * Math.sin(TAU * hz * t) * Math.exp(-t / tau);
  }
}

/** Adds a burst of noise struck at `at` s, dying away with time constant `tau` s. `bright` 1 is sharp, high noise; 0 is a dull rumble. */
function burst(x: Float32Array, at: number, tau: number, amp: number, rand: () => number, bright = 1) {
  let low = 0;
  for (let i = Math.round(at * RATE), k = 0; i < x.length; i++, k++) {
    const n = rand();
    low += 0.15 * (n - low);
    x[i] += amp * (bright * (n - low) + (1 - bright) * 3 * low) * Math.exp(-k / RATE / tau);
  }
}

/** A click from a mechanism: noise and rings at `hz` and `thump`, then a bounce `bounce` s later. */
function click(sec: number, seed: number, p: { hz: number; thump: number; ring: number; bounce: number; bright: number }): Float32Array {
  const x = silence(sec);
  const rand = noise(seed);
  burst(x, 0, 0.004, 1, rand, p.bright);
  ping(x, 0, p.hz, p.ring, 0.6);
  ping(x, 0, p.thump, p.ring * 1.5, 0.5);
  burst(x, p.bounce, 0.002, 0.4, rand, p.bright);
  ping(x, p.bounce, p.hz * 1.3, p.ring * 0.7, 0.3);
  return norm(fade(x, 0.0004, 0.004), SOUND_PEAK);
}

/** One note: attack and release in s, an exponential die-away `tau` s, harmonics `h` as amplitudes of 1x, 2x, 3x. */
function note(hz: number, sec: number, tau: number, h: number[], attack: number, release: number): Float32Array {
  const x = silence(sec);
  for (let i = 0; i < x.length; i++) {
    const t = i / RATE;
    x[i] = h.reduce((s, a, n) => s + a * Math.sin(TAU * hz * (n + 1) * t), 0) * Math.exp(-t / tau);
  }
  return fade(x, attack, release);
}

/** Adds y into x from sample `at`, wrapping past the end back to the start, so a loop stays seamless. */
function mix(x: Float32Array, y: Float32Array, at: number, gain = 1) {
  for (let i = 0; i < y.length; i++) x[(at + i) % x.length] += y[i] * gain;
}

/** A low reedy buzz gliding from `hz0` to `hz1`: odd and even harmonics falling away, two voices a hair apart. */
function buzz(hz0: number, hz1: number, sec: number): Float32Array {
  const x = silence(sec);
  const phase = [0, 0];
  for (let i = 0; i < x.length; i++) {
    const t = i / RATE;
    const hz = hz0 + ((hz1 - hz0) * t) / sec;
    phase[0] += (TAU * hz) / RATE;
    phase[1] += (TAU * hz * 1.012) / RATE;
    let s = 0;
    for (let n = 1; n <= 7; n++) s += (Math.sin(n * phase[0]) + Math.sin(n * phase[1])) / n ** 1.5;
    x[i] = s * Math.exp(-t / 0.35);
  }
  return fade(x, 0.015, 0.06);
}

/** A loop of `sec` s from parts [hz, amp, swells per loop, swell depth, swell phase]. Each part makes whole cycles in the loop, so the end joins the start. */
function hum(sec: number, parts: number[][]): Float32Array {
  const x = silence(sec);
  const n = x.length;
  for (const [hz, amp, swells, depth, ph] of parts) {
    const cycles = Math.round(hz * sec);
    for (let i = 0; i < n; i++) {
      const swell = 1 + depth * Math.sin((TAU * ((swells * i) % n)) / n + ph);
      x[i] += amp * swell * Math.sin((TAU * ((cycles * i) % n)) / n);
    }
  }
  return x;
}

const make: Record<SoundName | TrackName, () => Float32Array> = {
  // A relay closing: a sharp tick, a body thump, a small bounce.
  connect: () => click(0.08, 1, { hz: 1800, thump: 300, ring: 0.012, bounce: 0.006, bright: 1 }),
  // A relay opening: the same, lower and duller.
  cut: () => click(0.09, 2, { hz: 1100, thump: 200, ring: 0.014, bounce: 0.008, bright: 0.5 }),
  // A pure 880 Hz sine, BeepTime long.
  launch: () => norm(note(880, BEEP_TIME, Infinity, [1], 0.01, 0.01), SOUND_PEAK),
  // A type bar striking, then the carriage settling.
  works: () => {
    const x = silence(0.07);
    const rand = noise(4);
    burst(x, 0, 0.002, 1, rand);
    ping(x, 0, 2600, 0.006, 0.8);
    burst(x, 0.026, 0.002, 0.35, rand);
    ping(x, 0.026, 1500, 0.008, 0.4);
    return norm(fade(x, 0.0004, 0.004), SOUND_PEAK);
  },
  // A soft click: a low ring with a slow start and no noise.
  arrives: () => {
    const x = silence(0.06);
    ping(x, 0, 700, 0.01, 1);
    ping(x, 0, 1400, 0.006, 0.3);
    return norm(fade(x, 0.0015, 0.004), SOUND_PEAK);
  },
  // Two rising beeps, C5 then G5, the second longer.
  win: () => {
    const x = silence(0.62);
    mix(x, note(523.25, 0.28, 0.12, [1, 0, 0.15], 0.008, 0.03), 0);
    mix(x, note(783.99, 0.4, 0.17, [1, 0, 0.15], 0.008, 0.03), Math.round(0.2 * RATE));
    return norm(x, SOUND_PEAK);
  },
  // Two low buzzes, a minor third down, the second sagging: a shrug.
  fail: () => {
    const x = silence(0.52);
    mix(x, buzz(130.8, 128, 0.2), 0);
    mix(x, buzz(110, 102, 0.28), Math.round(0.22 * RATE));
    return norm(x, SOUND_PEAK);
  },
  // A switch: a tight click and a smaller one after.
  button: () => {
    const x = silence(0.05);
    const rand = noise(8);
    burst(x, 0, 0.0015, 1, rand);
    ping(x, 0, 3200, 0.005, 0.8);
    ping(x, 0.012, 2100, 0.004, 0.3);
    return norm(fade(x, 0.0004, 0.003), SOUND_PEAK);
  },
  // A low hum, 55 Hz and its fifth and octave, pairs a hair apart that throb, swelling slowly.
  level: () =>
    norm(
      hum(LEVEL_SEC, [
        [55, 1, 1, 0.3, 0],
        [55.15, 0.8, 1, 0.3, Math.PI],
        [82.5, 0.35, 1, 0.5, Math.PI / 2],
        [110, 0.4, 2, 0.4, 0],
        [110.15, 0.3, 1, 0.4, Math.PI],
        [165, 0.1, 3, 0.5, 0],
      ]),
      TRACK_PEAK,
    ),
  // A pad on A and E, with a soft note every 2 s that rises from the pad and fades back.
  map: () => {
    const x = hum(MAP_SEC, [
      [110, 0.5, 1, 0.3, 0],
      [164.8125, 0.35, 1, 0.3, Math.PI],
      [220, 0.12, 2, 0.4, 0],
    ]);
    const pulse = [220, 329.63, 220, 293.66, 220, 329.63, 220, 246.94];
    pulse.forEach((hz, k) => {
      for (const d of [-0.4, 0.4]) mix(x, note(hz + d, 2.6, 0.6, [0.5, 0.15, 0.05], 0.15, 0.3), k * 2 * RATE, 0.5);
    });
    return norm(x, TRACK_PEAK);
  },
};

/** Every sound and track. */
export function synthesize(): { name: SoundName | TrackName; wav: Uint8Array }[] {
  return [...SOUNDS, ...TRACKS].map((name) => ({ name, wav: wav(make[name]()) }));
}

if (import.meta.main) {
  const dir = process.argv[2];
  if (!dir) throw new Error("usage: bun tools/synth.ts <out-dir>");
  for (const s of synthesize()) await Bun.write(`${dir}/${s.name}.wav`, s.wav);
}
