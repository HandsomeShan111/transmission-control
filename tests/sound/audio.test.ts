// Sounds and music in the browser, APP-07, with stand-ins for the browser's audio, fetch and frame.
import { describe, expect, test } from "bun:test";
import { createAudio } from "../../src/shell/audio.ts";
import { SOUNDS, TRACKS, type SoundName, type TrackName } from "../../src/shell/sound-names.ts";

class Source {
  buffer: { name: string; duration: number } | null = null;
  loop = false;
  onended: (() => void) | null = null;
  starts: number[] = [];
  stops = 0;
  connect() {}
  start(_when: number, offset: number) {
    this.starts.push(offset);
  }
  stop() {
    this.stops++;
  }
  get playing() {
    return this.starts.length > 0 && this.stops === 0;
  }
}

class Context {
  state = "suspended";
  currentTime = 0;
  destination = {};
  sources: Source[] = [];
  resumes = 0;
  runOnResume = false;
  createGain() {
    return { gain: { value: 1 }, connect() {} };
  }
  createBufferSource() {
    const s = new Source();
    this.sources.push(s);
    return s;
  }
  async resume() {
    this.resumes++;
    if (this.runOnResume) this.state = "running";
  }
  /** The bytes are the file's name; "bad" does not decode. */
  async decodeAudioData(data: ArrayBuffer) {
    const name = new TextDecoder().decode(data);
    if (name === "bad") throw new Error("decode");
    return { name, duration: 10 };
  }
  /** The sources of one buffer that are playing. */
  of(name: string) {
    return this.sources.filter((s) => s.buffer?.name === name && s.playing);
  }
  started(name: string) {
    return this.sources.filter((s) => s.buffer?.name === name && s.starts.length > 0);
  }
}

type File = "ok" | "reject" | "notok" | "bad" | "hold";
const flush = () => new Promise((r) => setTimeout(r, 0));

/** An audio with stand-ins. `files` says how each file's fetch goes; a held file is let go by `release(name)`. */
function rig(files: Partial<Record<SoundName | TrackName, File>> = {}) {
  const contexts: Context[] = [];
  const fetched: string[] = [];
  const held = new Map<string, () => void>();
  const frames: (() => void)[] = [];
  const names = [...SOUNDS, ...TRACKS];
  const urls = Object.fromEntries(names.map((n) => [n, `/${n}.wav`])) as Record<SoundName | TrackName, string>;
  const audio = createAudio({
    createContext: () => {
      const c = new Context();
      contexts.push(c);
      return c as unknown as AudioContext;
    },
    fetch: async (url) => {
      fetched.push(url);
      const name = url.slice(1, -4) as SoundName | TrackName;
      const how = files[name] ?? "ok";
      if (how === "reject") throw new Error("network");
      if (how === "notok") return new Response("missing", { status: 404 });
      if (how === "hold") await new Promise<void>((r) => held.set(name, r));
      return new Response(how === "bad" ? "bad" : name);
    },
    urls,
    nextFrame: (fn) => frames.push(fn),
  });
  return {
    audio,
    contexts,
    fetched,
    get ctx() {
      return contexts[0];
    },
    release: (name: string) => held.get(name)!(),
    frame: () => frames.splice(0).forEach((fn) => fn()),
    /** Loads everything and presses, as a page does, and lets it all arrive. */
    async ready() {
      audio.load();
      audio.press();
      await flush();
    },
  };
}

describe("Before a press", () => {
  test("no context is made, nothing plays; the files still load", async () => {
    const r = rig();
    r.audio.load();
    r.audio.setTrack("level");
    r.audio.setSettings({ sound: true, music: true });
    r.audio.setHidden(false);
    r.audio.play("connect");
    await flush();
    expect(r.contexts.length).toBe(0);
    expect(r.fetched.length).toBe(SOUNDS.length + TRACKS.length);
  });

  test("a sound asked for before the press does not play; one asked for after does", async () => {
    const r = rig();
    r.audio.load();
    await flush();
    r.audio.play("connect");
    r.audio.press();
    await flush();
    expect(r.ctx.started("connect").length).toBe(0);
    r.audio.play("connect");
    expect(r.ctx.started("connect").length).toBe(1);
  });

  test("the music waits for the press too, then starts at once", async () => {
    const r = rig();
    r.audio.load();
    r.audio.setTrack("level");
    await flush();
    r.audio.press();
    await flush();
    expect(r.ctx.of("level").length).toBe(1);
  });
});

describe("Context", () => {
  test("is made once, at the first press, and resumed at each press until it runs", () => {
    const r = rig();
    r.audio.press();
    r.audio.press();
    expect(r.contexts.length).toBe(1);
    expect(r.ctx.resumes).toBe(2);
    r.ctx.state = "running";
    r.audio.press();
    expect(r.ctx.resumes).toBe(2);
    r.ctx.state = "interrupted";
    r.audio.press();
    expect(r.ctx.resumes).toBe(3);
  });
});

describe("Sounds", () => {
  test("play after a press with sound on", async () => {
    const r = rig();
    await r.ready();
    r.audio.play("cut");
    expect(r.ctx.started("cut").length).toBe(1);
    expect(r.ctx.sources.at(-1)!.loop).toBe(false);
  });

  test("do not play with sound off, and play again when it is on", async () => {
    const r = rig();
    await r.ready();
    r.audio.setSettings({ sound: false, music: true });
    r.audio.play("cut");
    expect(r.ctx.started("cut").length).toBe(0);
    r.audio.setSettings({ sound: true, music: true });
    r.audio.play("cut");
    expect(r.ctx.started("cut").length).toBe(1);
  });

  test("asked three times in one frame play once; again after the frame", async () => {
    const r = rig();
    await r.ready();
    r.audio.play("works");
    r.audio.play("works");
    r.audio.play("works");
    r.audio.play("arrives");
    expect(r.ctx.started("works").length).toBe(1);
    expect(r.ctx.started("arrives").length).toBe(1);
    r.frame();
    r.audio.play("works");
    r.audio.play("works");
    expect(r.ctx.started("works").length).toBe(2);
  });

  test("a sound that failed to arrive or decode stays silent; the others play; none is fetched again", async () => {
    const r = rig({ cut: "reject", works: "notok", arrives: "bad" });
    await r.ready();
    for (const name of SOUNDS) r.audio.play(name);
    r.frame();
    for (const name of SOUNDS) r.audio.play(name);
    const heard = SOUNDS.filter((name) => r.ctx.started(name).length > 0);
    expect(heard).toEqual(["connect", "launch", "win", "fail", "button"]);
    r.audio.press();
    await flush();
    expect(r.fetched.filter((u) => u === "/cut.wav").length).toBe(1);
    expect(r.fetched.length).toBe(SOUNDS.length + TRACKS.length);
  });

  test("a sound whose file has not arrived yet does not play, and plays once it has", async () => {
    const r = rig({ launch: "hold" });
    await r.ready();
    r.audio.play("launch");
    expect(r.ctx.started("launch").length).toBe(0);
    r.release("launch");
    await flush();
    r.audio.play("launch");
    expect(r.ctx.started("launch").length).toBe(1);
  });

  test("the sounds load first, then the tracks", async () => {
    const r = rig({ button: "hold" });
    r.audio.load();
    await flush();
    expect(r.fetched).toEqual(SOUNDS.map((n) => `/${n}.wav`));
    r.release("button");
    await flush();
    expect(r.fetched.slice(SOUNDS.length)).toEqual(TRACKS.map((n) => `/${n}.wav`));
  });

  test("load starts once", async () => {
    const r = rig();
    r.audio.load();
    r.audio.load();
    await flush();
    expect(r.fetched.length).toBe(SOUNDS.length + TRACKS.length);
  });
});

describe("Music", () => {
  test("a track set before its file arrives starts when it arrives", async () => {
    const r = rig({ level: "hold" });
    r.audio.setTrack("level");
    await r.ready();
    expect(r.ctx.sources.length).toBe(0);
    r.release("level");
    await flush();
    expect(r.ctx.of("level").length).toBe(1);
    expect(r.ctx.of("level")[0].loop).toBe(true);
    expect(r.ctx.of("level")[0].starts).toEqual([0]);
  });

  test("a track no longer wanted when its file arrives does not start", async () => {
    const r = rig({ level: "hold" });
    r.audio.setTrack("level");
    await r.ready();
    r.audio.setTrack("map");
    r.release("level");
    await flush();
    expect(r.ctx.started("level").length).toBe(0);
    expect(r.ctx.of("map").length).toBe(1);
  });

  test("a track that failed to arrive stays silent", async () => {
    const r = rig({ level: "notok" });
    r.audio.setTrack("level");
    await r.ready();
    expect(r.ctx.sources.length).toBe(0);
  });

  test("changing the track stops the old one and starts the new one from its start", async () => {
    const r = rig();
    await r.ready();
    r.audio.setTrack("level");
    r.ctx.currentTime = 4;
    r.audio.setTrack("map");
    expect(r.ctx.of("level").length).toBe(0);
    expect(r.ctx.of("map").length).toBe(1);
    expect(r.ctx.of("map")[0].starts).toEqual([0]);
    r.audio.setTrack("map");
    expect(r.ctx.started("map").length).toBe(1);
    r.audio.setTrack(null);
    expect(r.ctx.of("map").length).toBe(0);
  });

  test("music off stops it; on again starts it", async () => {
    const r = rig();
    await r.ready();
    r.audio.setTrack("level");
    expect(r.ctx.of("level").length).toBe(1);
    r.audio.setSettings({ sound: true, music: false });
    expect(r.ctx.of("level").length).toBe(0);
    r.audio.setSettings({ sound: true, music: true });
    expect(r.ctx.of("level").length).toBe(1);
    expect(r.ctx.started("level").length).toBe(2);
    expect(r.ctx.of("level")[0].starts).toEqual([0]);
  });

  test("music off keeps sounds playing, and sound off keeps the music", async () => {
    const r = rig();
    await r.ready();
    r.audio.setTrack("level");
    r.audio.setSettings({ sound: false, music: true });
    expect(r.ctx.of("level").length).toBe(1);
    r.audio.setSettings({ sound: true, music: false });
    r.audio.play("win");
    expect(r.ctx.of("win").length).toBe(1);
  });
});

describe("Page hidden", () => {
  test("stops the sounds and the music; shown again, only the music starts", async () => {
    const r = rig();
    await r.ready();
    r.audio.setTrack("level");
    r.audio.play("win");
    r.audio.play("fail");
    expect(r.ctx.of("win").length + r.ctx.of("fail").length).toBe(2);
    r.audio.setHidden(true);
    expect(r.ctx.sources.filter((s) => s.playing).length).toBe(0);
    r.audio.setHidden(false);
    expect(r.ctx.sources.filter((s) => s.playing).map((s) => s.buffer!.name)).toEqual(["level"]);
    expect(r.ctx.started("win").length).toBe(1);
    expect(r.ctx.started("fail").length).toBe(1);
  });

  test("the music goes on from where it stopped", async () => {
    const r = rig();
    await r.ready();
    r.audio.setTrack("level");
    r.ctx.currentTime = 3;
    r.audio.setHidden(true);
    r.ctx.currentTime = 50;
    r.audio.setHidden(false);
    expect(r.ctx.of("level")[0].starts).toEqual([3]);
  });

  test("music turned off and on while hidden starts from its start", async () => {
    const r = rig();
    await r.ready();
    r.audio.setTrack("level");
    r.ctx.currentTime = 3;
    r.audio.setHidden(true);
    r.audio.setSettings({ sound: true, music: false });
    r.audio.setSettings({ sound: true, music: true });
    r.audio.setHidden(false);
    expect(r.ctx.of("level")[0].starts).toEqual([0]);
  });

  test("nothing starts while hidden", async () => {
    const r = rig();
    await r.ready();
    r.audio.setHidden(true);
    r.audio.setTrack("map");
    r.audio.play("connect");
    expect(r.ctx.sources.length).toBe(0);
    r.audio.setHidden(false);
    expect(r.ctx.of("map").length).toBe(1);
    expect(r.ctx.of("map")[0].starts).toEqual([0]);
    expect(r.ctx.started("connect").length).toBe(0);
  });

  test("a sound asked for just after the page is shown plays", async () => {
    const r = rig();
    await r.ready();
    r.audio.play("connect");
    r.audio.setHidden(true);
    r.audio.setHidden(false);
    r.audio.play("connect");
    expect(r.ctx.of("connect").length).toBe(1);
  });
});
