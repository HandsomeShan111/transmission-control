// Words measured and wrapped: UI style's fonts, Play's Layout name line.
import { expect, test } from "bun:test";
import { esc, nameLines, stubMeasure, wrap } from "../../src/draw/text.ts";

test("the stub measure: per character 0.55 or 0.47 of the size, plus letter spacing", () => {
  expect(stubMeasure("ABCD", "label")).toBeCloseTo(4 * 13 * (0.55 + 0.08));
  expect(stubMeasure("abcd", "body")).toBeCloseTo(4 * 16 * 0.47);
  expect(stubMeasure("ab", "title")).toBeCloseTo(2 * 28 * (0.55 + 0.12));
});

test("wrap is greedy by words", () => {
  const m = (s: string) => s.length;
  expect(wrap("aa bb cc dd", "body", 5, m)).toEqual(["aa bb", "cc dd"]);
  expect(wrap("aaaaaaa b", "body", 5, m)).toEqual(["aaaaaaa", "b"]);
  expect(wrap("", "body", 5, m)).toEqual([]);
});

test("an agent name keeps its number on the line of its last word", () => {
  // Name room: 112 px as given, 128 turned, Screen numbers.
  expect(nameLines("RUBBER STAMP 1", 112, stubMeasure)).toEqual(["RUBBER", "STAMP 1"]);
  expect(nameLines("RUBBER STAMP 1", 128, stubMeasure)).toEqual(["RUBBER STAMP 1"]);
  expect(nameLines("STRAIGHT TALKER 1", 128, stubMeasure)).toEqual(["STRAIGHT", "TALKER 1"]);
  expect(nameLines("SUMMARIZER 1", 50, stubMeasure)).toEqual(["SUMMARIZER 1"]);
});

test("words are escaped for markup", () => {
  expect(esc("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
});
