// Levels' win, LEVEL-06, and the report, REPORT-02 to REPORT-06.
import { describe, expect, test } from "bun:test";
import { AGENTS, COUNTS_LINE } from "../../src/content/generated.ts";
import { fillSlots } from "../../src/core/items.ts";
import { param } from "../../src/core/level.ts";
import { followed, report } from "../../src/core/report.ts";
import { run } from "../../src/core/run.ts";
import { newWiring } from "../../src/core/wiring.ts";
import { fromChecks, model, runWith } from "./helpers.ts";

const AGENT04: [string, string][] = [["Input terminal", "Summarizer 1"], ["Summarizer 1", "Inspector 1"], ["Inspector 1.positive", "Output terminal"]];
const AGENT07: [string, string][] = [["Input terminal", "Summarizer 1"], ["Summarizer 1", "Inspector 1"], ["Inspector 1.positive", "Output terminal"], ["Inspector 1.negative", "Shredder 1"]];
const RUN06: [string, string][] = [["Input terminal", "Padder 1"], ["Padder 1", "Inspector 1"], ["Inspector 1.negative", "Padder 1"]];
const RUN07: [string, string][] = [["Input terminal", "Summarizer 1"], ["Summarizer 1", "Output terminal"]];

const longRun = () => {
  const { m, w } = fromChecks(18, "longRun");
  return { m, r: run(m, w) };
};

describe("Levels", () => {
  test("LEVEL-01: at most MaxAgents agents and MaxInputs inputs", () => {
    const m = model(16);
    expect(m.nodes.filter((n) => !n.terminal).length).toBeLessThanOrEqual(param("MaxAgents"));
    expect(m.level.inputs.length).toBeLessThanOrEqual(param("MaxInputs"));
  });

  test("LEVEL-05: an item meets the target holding every value it names", () => {
    const { r } = runWith(6, RUN07);
    // Target: short. Input 2 arrives short; input 1 arrives medium.
    expect(r.copies.map((c) => c.values[0])).toEqual([1, 0]);
  });

  test("LEVEL-06: won when every input arrived meeting the target, none looped, overloaded or dropped", () => {
    const { m, w } = fromChecks(6);
    expect(run(m, w).won).toBe(true);
    expect(runWith(6, RUN07).r.won).toBe(false);
  });

  test("LEVEL-06: a shredded copy counts for neither", () => {
    const { r } = runWith(12, AGENT07);
    expect(r.won).toBe(false);
    expect(r.kind).toBe("Shredded");
  });

  test("Every level's solution in the level checks wins", () => {
    for (let id = 1; id <= 18; id++) {
      const { m, w } = fromChecks(id);
      expect(run(m, w).won).toBe(true);
    }
  });
});

describe("Report", () => {
  test("REPORT-02: the kind of result, first that holds", () => {
    expect(longRun().r.kind).toBe("Overload");
    expect(runWith(10, RUN06).r.kind).toBe("Loop");
    expect(runWith(1, []).r.kind).toBe("Nothing arrived");
    expect(runWith(6, AGENT04).r.kind).toBe("Dropped");
    expect(runWith(12, AGENT07).r.kind).toBe("Shredded");
    expect(runWith(6, RUN07).r.kind).toBe("Partly right");
    expect(runWith(1, [["Input terminal", "Output terminal"]]).r.kind).toBe("All wrong");
  });

  test("REPORT-03: the first line is the win line, or the level line for the kind", () => {
    const { m, w } = fromChecks(1);
    expect(report(m, run(m, w)).lines[0]).toBe(m.level.words.win);
    const lost = runWith(1, []);
    expect(report(lost.m, lost.r).lines[0]).toBe(lost.m.level.words.lines["Nothing arrived"]!);
  });

  test("REPORT-04: RUN-06's report follows the first copy lost in a loop, with its last ReportAgents agent lines", () => {
    const { m, r } = runWith(10, RUN06);
    const c = followed(m, r)!;
    expect(c.stop).toBe("loop");
    expect(c.input).toBe(0);
    const rep = report(m, r);
    expect(rep.lines).toHaveLength(1 + Math.min(param("ReportAgents"), c.visits.length));
    const last = c.visits.slice(-param("ReportAgents"));
    last.forEach((v, k) => {
      const node = m.nodes[v.node];
      const line = AGENTS.find((a) => a.kind === node.kind)!.lines[node.inputs[v.inPort]]!;
      expect(rep.lines[1 + k]).toBe(fillSlots(line, v.after, { Agent: node.id }));
    });
    // Short to medium to long, rejected each time; long again at Inspector 1 is the loop. Five works, four lines.
    expect(c.visits.map((v) => `${m.nodes[v.node].id}.${m.nodes[v.node].inputs[v.inPort]}`)).toEqual([
      "Padder 1.data", "Inspector 1.data", "Padder 1.negative", "Inspector 1.data", "Padder 1.negative",
    ]);
    expect(rep.lines).toHaveLength(1 + param("ReportAgents"));
  });

  test("REPORT-04: of copies stopping at once, the first by column, row and port", () => {
    // Level 10: the input to Straight Talker 1 and to Inspector 1, no wire on: both drop at once after work.
    const { m, r } = runWith(10, [["Input terminal", "Straight Talker 1"], ["Input terminal", "Inspector 1"]]);
    expect(r.kind).toBe("Nothing arrived");
    expect(m.nodes[followed(m, r)!.port.node].id).toBe("Straight Talker 1");
  });

  test("REPORT-05: slots show the followed copy's values after each agent's work, and at its stop", () => {
    const { m, r } = runWith(6, AGENT04);
    const rep = report(m, r);
    // Input 1: long → Summarizer 1 → medium; Inspector 1 (short?) rejects it; dropped at the negative output.
    expect(rep.lines).toEqual([
      fillSlots(m.level.words.lines.Dropped!, [1, 1, 0, 0]),
      "Summarizer 1 tries to cut it down. It is medium now.",
      "Inspector 1 inspects the flat, medium text in English and rules on it.",
    ]);
  });

  test("REPORT-06: a win counts the agents reached and the wires moved along, each once", () => {
    const { m, w } = fromChecks(3);
    const r = run(m, w);
    const rep = report(m, r);
    expect(rep.lines).toEqual([m.level.words.win, fillSlots(COUNTS_LINE, [], { Agents: String(r.agents.size), Wires: String(r.wires.size) })]);
    expect(r.wires.size).toBe(w.wires.size);
  });

  test("Every kind of result each level reaches has its level line, and the report fills it", () => {
    for (let id = 1; id <= 18; id++) {
      const m = model(id);
      for (const kind of Object.keys(fromChecks(id).m.level.words.lines)) {
        const { w } = fromChecks(id, kind);
        const r = run(m, w);
        expect(r.kind).toBe(kind as never);
        expect(report(m, r).lines[0]).not.toContain("{");
      }
    }
  });
});

test("The same wiring always gets the same report", () => {
  const { m, w } = fromChecks(18, "longRun");
  expect(report(m, run(m, w))).toEqual(report(m, run(m, newWiring([...w.wires].map(([to, from]) => ({ from, to }))))));
});
