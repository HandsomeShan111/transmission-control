// Items, Agents and Run, with the acceptance tests' setups.
import { describe, expect, test } from "bun:test";
import { PROPERTIES } from "../../src/content/generated.ts";
import { param, refNode } from "../../src/core/level.ts";
import { run, startTimes } from "../../src/core/run.ts";
import { fromChecks, model, runWith } from "./helpers.ts";

const named = (v: readonly number[]) => v.map((x, p) => PROPERTIES[p].scale[x]).join(" ");
const MT = param("MoveTime");
const WT = param("WorkTime");

describe("Items", () => {
  test("ITEM-01: an input holds one value of each property", () => {
    const m = model(1);
    expect(m.level.inputs[0]).toHaveLength(PROPERTIES.length);
    expect(named(m.level.inputs[0])).toBe("long flat text English");
  });

  // ITEM-04's setup: level 3, input to Translator 1 and Summarizer 1.
  const item4 = () => runWith(3, [["Input terminal", "Translator 1"], ["Input terminal", "Summarizer 1"]]);

  test("ITEM-04: an output port with two wires makes two copies of the input", () => {
    const { r } = item4();
    expect(r.copies).toHaveLength(2);
    expect(r.copies.every((c) => c.input === 0)).toBe(true);
    expect(r.timeline.moves.filter((mv) => mv.t === 0)).toHaveLength(2);
  });

  test("ITEM-02: a shift at the scale's end stays; ITEM-03: a set", () => {
    const { m, r } = item4();
    const by = (id: string) => r.copies.find((c) => m.nodes[c.visits[0].node].id === id)!;
    // Input: short polite text alien. Summarizer shifts Length down from short: stays.
    expect(named(m.level.inputs[0])).toBe("short polite text alien");
    expect(named(by("Summarizer 1").visits[0].after)).toBe("short polite text alien");
    // Translator: Language a step toward English, then Tone set to flat.
    expect(named(by("Translator 1").visits[0].after)).toBe("short flat text legalese");
  });

  test("ITEM-05: a moving item carries its values", () => {
    const { m, w } = fromChecks(1);
    const r = run(m, w);
    expect(named(r.timeline.moves[0].values)).toBe("long flat text English");
    expect(named(r.timeline.moves[1].values)).toBe("medium flat text English");
  });
});

describe("Agents", () => {
  test("AGENT-01, AGENT-02: each agent has its kind's ports and the level's place", () => {
    const m = model(16);
    for (const n of m.nodes) {
      const p = m.level.rows[n.row][n.col]!;
      expect("terminal" in p ? p.terminal : `${p.kind} ${p.number}`).toBe(n.id);
    }
    const inspector = m.nodes.find((n) => n.kind === "Inspector")!;
    expect(inspector.inputs).toEqual(["data", "positive"]);
    expect(inspector.outputs).toEqual(["positive", "negative"]);
  });

  test("AGENT-03: the Diplomat's shifts in order", () => {
    const { r } = runWith(2, [["Input terminal", "Diplomat 1"]]);
    // medium rude: politer, then longer.
    expect(named(r.copies[0].visits[0].after)).toBe("long flat text English");
    expect(r.copies[0].stop).toBe("dropped");
  });

  test("AGENT-04: an inspector sends the item out positive when it holds the value, else negative", () => {
    const { m, r } = runWith(6, [["Input terminal", "Summarizer 1"], ["Summarizer 1", "Inspector 1"], ["Inspector 1.positive", "Output terminal"]]);
    const [a, b] = [0, 1].map((i) => r.copies.find((c) => c.input === i)!);
    // Input 1 long → medium: negative, no wire, dropped. Input 2 medium → short: positive, arrives.
    expect(a.stop).toBe("dropped");
    expect(m.nodes[a.port.node].id).toBe("Inspector 1");
    expect(m.nodes[a.port.node].outputs[a.port.i]).toBe("negative");
    expect(b.stop).toBe("arrived");
    expect(named(b.values)).toBe("short flat text English");
  });

  test("AGENT-05: a rubber stamp sends everything out positive", () => {
    const { m, r } = runWith(11, [["Input terminal", "Rubber Stamp 1"]]);
    const c = r.copies[0];
    expect(c.stop).toBe("dropped");
    expect(m.nodes[c.port.node].id).toBe("Rubber Stamp 1");
    expect(m.nodes[c.port.node].outputs[c.port.i]).toBe("positive");
  });

  test("AGENT-06: a manager sends approved and rejected work on as data, unchanged", () => {
    const { m, r } = runWith(10, [["Input terminal", "Inspector 1"], ["Inspector 1.positive", "Manager 1"], ["Inspector 1.negative", "Manager 1"], ["Manager 1", "Output terminal"]]);
    expect(r.copies.map((c) => c.stop)).toEqual(["arrived", "arrived", "arrived"]);
    r.copies.forEach((c) => expect(c.values).toEqual(m.level.inputs[c.input]));
    expect(r.copies.map((c) => m.nodes[c.visits[1].node].inputs[c.visits[1].inPort])).toEqual(["positive", "negative", "negative"]);
  });

  test("AGENT-07: a shredder works, then the item stops there, shredded", () => {
    const { m, r } = runWith(12, [["Input terminal", "Summarizer 1"], ["Summarizer 1", "Inspector 1"], ["Inspector 1.positive", "Output terminal"], ["Inspector 1.negative", "Shredder 1"]]);
    const shred = r.copies.find((c) => c.stop === "shredded")!;
    expect(m.nodes[shred.port.node].id).toBe("Shredder 1");
    const work = r.timeline.works.find((w) => m.nodes[w.node].id === "Shredder 1")!;
    const stopAt = r.timeline.stops.find((s) => r.copies[s.copy] === shred)!.t;
    expect(stopAt).toBeCloseTo(work.t + WT);
  });

  test("AGENT-08: each agent the item reaches works for WorkTime", () => {
    const { m, w } = fromChecks(1);
    const r = run(m, w);
    expect(r.timeline.works.map((x) => [m.nodes[x.node].id, x.t])).toEqual([["Summarizer 1", MT]]);
  });
});

describe("Run", () => {
  test("RUN-01, RUN-02: the first input leaves the input terminal's data output at Launch", () => {
    const { m, w } = fromChecks(5);
    const r = run(m, w);
    const first = r.timeline.moves[0];
    expect(first.t).toBe(0);
    expect(refNode(first.from)).toBe(m.input);
    expect(first.values).toEqual(m.level.inputs[0]);
  });

  test("RUN-02, RUN-07: inputs go one after another, the next once every copy of the one before has stopped", () => {
    const { m, w } = fromChecks(5);
    const r = run(m, w);
    const lastStop0 = Math.max(...r.timeline.stops.filter((s) => r.copies[s.copy].input === 0).map((s) => s.t));
    const firstMove1 = Math.min(...r.timeline.moves.filter((mv) => mv.input === 1).map((mv) => mv.t));
    expect(firstMove1).toBeCloseTo(lastStop0);
    expect(r.timeline.moves.filter((mv) => mv.input === 1)[0].values).toEqual(m.level.inputs[1]);
  });

  test("RUN-03: copies of one input move at once, each move taking MoveTime", () => {
    const { r } = runWith(3, [["Input terminal", "Translator 1"], ["Input terminal", "Summarizer 1"]]);
    expect(r.timeline.moves.map((mv) => mv.t)).toEqual([0, 0]);
    expect(r.timeline.works.map((w) => w.t)).toEqual([MT, MT]);
  });

  test("RUN-04: items reaching agents at once are worked on side by side, for WorkTime", () => {
    const { m, r } = runWith(10, [["Input terminal", "Straight Talker 1"], ["Input terminal", "Inspector 1"], ["Straight Talker 1", "Padder 1"], ["Inspector 1.negative", "Padder 1"]]);
    const first = r.timeline.works.filter((w) => w.t === MT).map((w) => m.nodes[w.node].id).sort();
    expect(first).toEqual(["Inspector 1", "Straight Talker 1"]);
    // Input 2 is long, so the inspector sends it negative: both copies reach Padder 1 at once.
    const start2 = r.timeline.moves.find((mv) => mv.input === 1)!.t;
    const padder = r.timeline.works.filter((w) => m.nodes[w.node].id === "Padder 1" && w.t > start2 && w.t < start2 + 2 * (MT + WT));
    expect(padder.map((w) => w.t - start2)).toEqual([2 * MT + WT, 2 * MT + WT]);
  });

  test("RUN-05: an item reaching the output terminal stops there, arrived", () => {
    const { m, w } = fromChecks(1);
    const r = run(m, w);
    expect(r.copies[0].stop).toBe("arrived");
    expect(r.copies[0].port.node).toBe(m.output);
    expect(r.timeline.stops[0].t).toBeCloseTo(2 * MT + WT);
  });

  test("RUN-06: a copy reaching an input port again with the same values is lost in a loop", () => {
    const { m, r } = runWith(10, [["Input terminal", "Padder 1"], ["Padder 1", "Inspector 1"], ["Inspector 1.negative", "Padder 1"]]);
    const loops = r.copies.filter((c) => c.stop === "loop");
    expect(loops.length).toBeGreaterThan(0);
    // Padder 1 lengthens to long, Inspector 1 rejects it, Padder 1 keeps it long: Inspector 1 sees it again.
    for (const c of loops) expect([m.nodes[c.port.node].id, PROPERTIES[0].scale[c.values[0]]]).toEqual(["Inspector 1", "long"]);
    expect(r.kind).toBe("Loop");
  });

  test("RUN-14: moves past MaxMoves overload the input; every run ends", () => {
    const { m, w } = fromChecks(18, "longRun");
    const r = run(m, w);
    const over = r.copies.filter((c) => c.stop === "overloaded");
    expect(over.length).toBeGreaterThan(0);
    for (const i of new Set(over.map((c) => c.input))) expect(r.movesPerInput[i]).toBeLessThanOrEqual(param("MaxMoves"));
    for (const c of over) expect(c.port.out).toBe(true);
    expect(r.kind).toBe("Overload");
    const counts = r.timeline.counts.filter((c) => c.input === over[0].input);
    expect(counts.at(-1)!.moves).toBe(r.movesPerInput[over[0].input]);
  });

  test("RUN-14: a lower MaxMoves overloads sooner", () => {
    const { m, w } = fromChecks(1);
    const r = run(m, w, { ...startTimes(), maxMoves: 1 });
    expect(r.copies[0].stop).toBe("overloaded");
    expect(r.copies[0].port.node).toBe(model(1).nodes.findIndex((n) => n.id === "Summarizer 1"));
  });

  test("RUN-07: the next input goes whether or not this one met the target", () => {
    const { r } = runWith(6, [["Input terminal", "Summarizer 1"], ["Summarizer 1", "Output terminal"]]);
    expect(r.copies.map((c) => [c.input, c.stop])).toEqual([[0, "arrived"], [1, "arrived"]]);
  });

  test("RUN-08: the run ends when the last input's copies have stopped", () => {
    const { m, w } = fromChecks(5);
    const r = run(m, w);
    expect(r.timeline.end).toBeCloseTo(Math.max(...r.timeline.stops.map((s) => s.t)));
    expect(r.won).toBe(true);
  });

  test("Launch with no wire from the input terminal: each input stops there, dropped", () => {
    const { m, r } = runWith(5, []);
    expect(r.copies.map((c) => [c.stop, c.port.node])).toEqual([["dropped", m.input], ["dropped", m.input]]);
    expect(r.kind).toBe("Nothing arrived");
  });
});
