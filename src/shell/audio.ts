// Sounds and music in the browser, APP-07; the files load behind play, APP-02, and a file not kept stays silent, APP-03.
// Browser objects come in as `deps`. Nothing plays before a press; the AudioContext is made at the first.
// The page hidden stops sounds and music; music then goes on from where it stopped.
import { SOUNDS, TRACKS, type SoundName, type TrackName } from "./sound-names.ts";

export interface AudioDeps {
  createContext: () => AudioContext;
  fetch: (url: string) => Promise<Response>;
  urls: Record<SoundName | TrackName, string>;
  /** Calls fn once at the next frame, as requestAnimationFrame. */
  nextFrame: (fn: () => void) => void;
}

export interface GameAudio {
  /** A press on the page, APP-07: from the first, sound and music may play. Call on every pointerdown, pointerup, touchend and keydown; it resumes the context until it runs. */
  press(): void;
  /** Start loading: every sound, then both tracks, APP-02. Called once. */
  load(): void;
  play(name: SoundName): void;
  /** The screen's track: "level" on a level, "map" on the campaign map and act cards, null for none. */
  setTrack(track: TrackName | null): void;
  setSettings(s: { sound: boolean; music: boolean }): void;
  /** The page hidden or shown, APP-07. */
  setHidden(hidden: boolean): void;
}

export function createAudio(deps: AudioDeps): GameAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let made!: (c: AudioContext) => void;
  const context = new Promise<AudioContext>((done) => (made = done));
  let loading = false;
  let sound = true; // SoundStart
  let music = true; // MusicStart
  let hidden = false;
  let track: TrackName | null = null;

  const buffers = new Map<SoundName | TrackName, AudioBuffer>();
  /** Sounds started since the last frame, so one asked for again before the next frame plays once. */
  const started = new Set<SoundName>();
  let clearing = false;
  const sounding = new Set<AudioBufferSourceNode>();
  /** The track playing, the context time it started and the offset into it then; `left` is where a hidden page stopped it. */
  let playing: { name: TrackName; src: AudioBufferSourceNode; at: number; from: number } | null = null;
  let left: { name: TrackName; from: number } | null = null;

  function start(buffer: AudioBuffer, loop: boolean, from = 0) {
    const src = ctx!.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    src.connect(master);
    src.start(0, from);
    return src;
  }

  function stopSounds() {
    for (const src of sounding) src.stop();
    sounding.clear();
    started.clear();
  }

  /** Stops the music; `keep` remembers where it was, for a page shown again. */
  function stopMusic(keep: boolean) {
    if (!playing) return;
    if (keep) left = { name: playing.name, from: (playing.from + ctx!.currentTime - playing.at) % playing.src.buffer!.duration };
    playing.src.stop();
    playing = null;
  }

  /** Makes the music match what is wanted now: the screen's track, if pressed, music on, page shown and the file here. */
  function syncMusic() {
    const want = ctx && music && !hidden && track && buffers.has(track) ? track : null;
    if ((playing?.name ?? null) === want) return;
    stopMusic(false);
    if (!want) return;
    const from = left?.name === want ? left.from : 0;
    left = null;
    playing = { name: want, src: start(buffers.get(want)!, true, from), at: ctx!.currentTime, from };
  }

  async function bytes(name: SoundName | TrackName) {
    try {
      const r = await deps.fetch(deps.urls[name]);
      return r.ok ? await r.arrayBuffer() : null;
    } catch {
      return null;
    }
  }

  /** Decodes a file once the context exists. A failure leaves the file silent, with no retry. */
  async function decode(name: SoundName | TrackName, data: ArrayBuffer) {
    try {
      buffers.set(name, await (await context).decodeAudioData(data));
    } catch {
      return;
    }
    syncMusic();
  }

  /** Fetches a file and hands it to decode, which waits for a press. */
  async function fetchOne(name: SoundName | TrackName) {
    const data = await bytes(name);
    if (data) void decode(name, data);
  }

  return {
    press() {
      if (!ctx) {
        ctx = deps.createContext();
        master = ctx.createGain();
        master.connect(ctx.destination);
        made(ctx);
      }
      if (ctx.state !== "running") ctx.resume().catch(() => {});
      syncMusic();
    },

    load() {
      if (loading) return;
      loading = true;
      void (async () => {
        await Promise.all(SOUNDS.map(fetchOne));
        await Promise.all(TRACKS.map(fetchOne));
      })();
    },

    play(name) {
      if (!ctx || !sound || hidden || started.has(name)) return;
      const buffer = buffers.get(name);
      if (!buffer) return;
      started.add(name);
      if (!clearing) {
        clearing = true;
        deps.nextFrame(() => {
          clearing = false;
          started.clear();
        });
      }
      const src = start(buffer, false);
      sounding.add(src);
      src.onended = () => sounding.delete(src);
    },

    setTrack(t) {
      track = t;
      syncMusic();
    },

    setSettings(s) {
      sound = s.sound;
      music = s.music;
      if (!sound) stopSounds();
      if (!music) left = null;
      syncMusic();
    },

    setHidden(h) {
      hidden = h;
      if (hidden) {
        stopSounds();
        stopMusic(true);
      }
      syncMusic();
      if (!hidden) left = null;
    },
  };
}
