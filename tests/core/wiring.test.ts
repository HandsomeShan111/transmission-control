// Wiring, WIRE-01 to WIRE-05, on the core's actions.
import { describe, expect, test } from "bun:test";
import { ref } from "../../src/core/level.ts";
import { clear, join, move, newWiring, remove, undo, wireList } from "../../src/core/wiring.ts";
import { model, port, wires } from "./helpers.ts";

describe("Wiring", () => {
  test("WIRE-01: a lay needs an output and an input port of one kind; a new wire replaces the input port's old one", () => {
    const m = model(6);
    const s = newWiring();
    const sum = port(m, "Summarizer 1", true);
    // Summarizer 1 data to Inspector 1's positive input: kinds differ, no wire.
    expect(join(m, s, sum, port(m, "Inspector 1.positive", false))).toBeNull();
    expect(s.wires.size).toBe(0);
    expect(join(m, s, sum, port(m, "Inspector 1.data", false))).toEqual({ sound: "connect", changed: true });
    // Two output ports, two input ports: no wire.
    expect(join(m, s, sum, port(m, "Input terminal", true))).toBeNull();
    expect(join(m, s, port(m, "Inspector 1.data", false), port(m, "Summarizer 1.data", false))).toBeNull();
    // The input terminal onto Inspector 1's data input: the Summarizer's wire there goes.
    expect(join(m, s, port(m, "Inspector 1.data", false), port(m, "Input terminal", true))).toEqual({ sound: "connect", changed: true });
    expect(wireList(s)).toEqual(wires(m, [["Input terminal", "Inspector 1"]]));
  });

  test("WIRE-02: a moved end lays a new wire; a refused move keeps the wire", () => {
    const m = model(2);
    const s = newWiring(wires(m, [["Input terminal", "Diplomat 1"]]));
    const to = wireList(s)[0].to;
    // Onto an output port: refused. Onto the port it came from: stays.
    expect(move(m, s, to, "in", port(m, "Summarizer 1", true))).toBeNull();
    expect(move(m, s, to, "in", port(m, "Diplomat 1", false))).toBeNull();
    expect(s.done).toHaveLength(0);
    expect(move(m, s, to, "in", port(m, "Summarizer 1", false))).toEqual({ sound: "connect", changed: true });
    expect(wireList(s)).toEqual(wires(m, [["Input terminal", "Summarizer 1"]]));
  });

  test("WIRE-02: moving the output end", () => {
    const m = model(2);
    const s = newWiring(wires(m, [["Input terminal", "Summarizer 1"]]));
    expect(move(m, s, wireList(s)[0].to, "out", port(m, "Diplomat 1", true))).toEqual({ sound: "connect", changed: true });
    expect(wireList(s)).toEqual(wires(m, [["Diplomat 1", "Summarizer 1"]]));
  });

  test("WIRE-03: a wire removed is gone, with the cut sound", () => {
    const m = model(1);
    const s = newWiring(wires(m, [["Input terminal", "Summarizer 1"]]));
    expect(remove(s, wireList(s)[0].to)).toEqual({ sound: "cut", changed: true });
    expect(s.wires.size).toBe(0);
  });

  test("WIRE-04: Undo reverses each action in turn, re-laying replaced wires; then nothing", () => {
    const m = model(2);
    const s = newWiring();
    const shots: string[] = [];
    const shot = () => shots.push(JSON.stringify(wireList(s)));
    shot();
    join(m, s, port(m, "Input terminal", true), port(m, "Diplomat 1", false));
    shot();
    join(m, s, port(m, "Diplomat 1", true), port(m, "Summarizer 1", false));
    shot();
    // The second wire's output end moved to the input terminal.
    move(m, s, ref(port(m, "Summarizer 1", false).node, 0), "out", port(m, "Input terminal", true));
    shot();
    remove(s, ref(port(m, "Summarizer 1", false).node, 0));
    shot();
    clear(s);
    const sounds: (string | null)[] = [];
    for (let k = 0; k < 6; k++) sounds.push(undo(s)?.sound ?? null);
    expect(JSON.stringify(wireList(s))).toBe(shots[0]);
    expect(sounds).toEqual(["connect", "connect", "connect", "cut", "cut", null]);
  });

  test("WIRE-04: undoing a lay that replaced a wire lays the old one again", () => {
    const m = model(1);
    const s = newWiring(wires(m, [["Input terminal", "Summarizer 1"]]));
    join(m, s, port(m, "Summarizer 1", true), port(m, "Summarizer 1", false));
    expect(undo(s)).toEqual({ sound: "connect", changed: true });
    expect(wireList(s)).toEqual(wires(m, [["Input terminal", "Summarizer 1"]]));
  });

  test("WIRE-05: Clear removes every wire as one action; with no wire, nothing", () => {
    const m = model(3);
    const s = newWiring(wires(m, [["Input terminal", "Translator 1"], ["Translator 1", "Diplomat 1"], ["Diplomat 1", "Output terminal"]]));
    expect(clear(s)).toEqual({ sound: "cut", changed: true });
    expect(s.wires.size).toBe(0);
    expect(s.done).toHaveLength(1);
    expect(clear(s)).toBeNull();
    expect(s.done).toHaveLength(1);
    undo(s);
    expect(s.wires.size).toBe(3);
  });

  test("A lay identical to a wire changes nothing for Undo", () => {
    const m = model(1);
    const s = newWiring(wires(m, [["Input terminal", "Summarizer 1"]]));
    expect(join(m, s, port(m, "Input terminal", true), port(m, "Summarizer 1", false))).toEqual({ sound: "connect", changed: false });
    expect(s.done).toHaveLength(0);
  });
});
