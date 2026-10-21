// The game's sounds and music tracks, ART-14 and ART-15, by the names files and code use.
export const SOUNDS = ["connect", "cut", "launch", "works", "arrives", "win", "fail", "button"] as const;
export const TRACKS = ["level", "map"] as const;
export type SoundName = (typeof SOUNDS)[number];
export type TrackName = (typeof TRACKS)[number];
