// The game's content: properties, agents, levels, acts, words and parameters.
import type { Act, AgentKind, Level, Param, PortKind, Property, ShellWords, Style, Terminal } from "./types.ts";

export const PROPERTIES: Property[] = [
  {
    name: "Length",
    scale: ["short", "medium", "long"],
  },
  {
    name: "Tone",
    scale: ["rude", "flat", "polite"],
  },
  {
    name: "Format",
    scale: ["text", "list", "chart"],
  },
  {
    name: "Language",
    scale: ["English", "legalese", "alien"],
  },
];
export const PORT_KINDS: PortKind[] = ["data", "positive", "negative"];
export const AGENTS: AgentKind[] = [
  {
    kind: "Summarizer",
    inputs: ["data", "negative"],
    outputs: ["data"],
    work: [
      { prop: 0, shift: -1 },
    ],
    ruleText: "One step shorter.",
    lines: { data: "{Agent} tries to cut it down. It is {Length} now.", negative: "{Agent} tries to fix the rejected draft by cutting it. It is {Length} now." },
  },
  {
    kind: "Padder",
    inputs: ["data", "negative"],
    outputs: ["data"],
    work: [
      { prop: 0, shift: 1 },
    ],
    ruleText: "One step longer.",
    lines: { data: "{Agent} tries to add words. It is {Length} now.", negative: "{Agent} tries to answer the rejection with more words. It is {Length} now." },
  },
  {
    kind: "Diplomat",
    inputs: ["data", "negative"],
    outputs: ["data"],
    work: [
      { prop: 1, shift: 1 },
      { prop: 0, shift: 1 },
    ],
    ruleText: "One step politer, then one longer.",
    lines: { data: "{Agent} makes it {Tone} and lets it run {Length}.", negative: "{Agent} apologises for the rejected draft: {Tone}, {Length}." },
  },
  {
    kind: "Straight Talker",
    inputs: ["data", "negative"],
    outputs: ["data"],
    work: [
      { prop: 1, shift: -1 },
      { prop: 0, shift: -1 },
    ],
    ruleText: "One step ruder, then one shorter.",
    lines: { data: "{Agent} makes it {Tone} and {Length}, and is proud of it.", negative: "{Agent} tells the rejected draft what it thinks: {Tone}, {Length}." },
  },
  {
    kind: "Analyst",
    inputs: ["data", "negative"],
    outputs: ["data"],
    work: [
      { prop: 2, shift: 1 },
    ],
    ruleText: "Text to list, list to chart.",
    lines: { data: "{Agent} tries to add structure. It is a {Format} now.", negative: "{Agent} studies the rejection and produces a {Format}." },
  },
  {
    kind: "Poet",
    inputs: ["data", "negative"],
    outputs: ["data"],
    work: [
      { prop: 2, shift: -1 },
    ],
    ruleText: "Chart to list, list to text.",
    lines: { data: "{Agent} tries to free it from structure. It is a {Format} now.", negative: "{Agent} takes the rejection personally and makes it a {Format}." },
  },
  {
    kind: "Lawyer",
    inputs: ["data", "negative"],
    outputs: ["data"],
    work: [
      { prop: 3, shift: 1 },
      { prop: 0, shift: 1 },
    ],
    ruleText: "Language a step toward alien, then one longer.",
    lines: { data: "{Agent} puts it into {Language} and makes it {Length}.", negative: "{Agent} appeals the rejection in {Language}, at {Length} length." },
  },
  {
    kind: "Translator",
    inputs: ["data", "negative"],
    outputs: ["data"],
    work: [
      { prop: 3, shift: -1 },
      { prop: 1, set: 1 },
    ],
    ruleText: "Language a step toward English, then Tone to flat.",
    lines: { data: "{Agent} renders it in {Language} and takes the feeling out.", negative: "{Agent} translates the rejection into {Language}, flatly." },
  },
  {
    kind: "Inspector",
    inputs: ["data", "positive"],
    outputs: ["positive", "negative"],
    work: { step: "AGENT-04" },
    ruleText: "Has this value: positive. Else negative.",
    lines: { data: "{Agent} inspects the {Tone}, {Length} {Format} in {Language} and rules on it.", positive: "{Agent} inspects the approved {Tone}, {Length} {Format} in {Language}, to be sure." },
  },
  {
    kind: "Rubber Stamp",
    inputs: ["data"],
    outputs: ["positive"],
    work: { step: "AGENT-05" },
    ruleText: "Sends everything out positive.",
    lines: { data: "{Agent} approves it without reading it." },
  },
  {
    kind: "Manager",
    inputs: ["positive", "negative"],
    outputs: ["data"],
    work: { step: "AGENT-06" },
    ruleText: "Sends everything out as data.",
    lines: { positive: "{Agent} sends the approved {Format} out again as new work.", negative: "{Agent} sends the rejected {Format} out again as new work, unchanged." },
  },
  {
    kind: "Shredder",
    inputs: ["data", "negative"],
    outputs: [],
    work: { step: "AGENT-07" },
    ruleText: "Shreds everything.",
    lines: { data: "{Agent} shreds the {Tone}, {Length} draft. Nobody asks why.", negative: "{Agent} disposes of the rejected draft, as is customary." },
  },
];
export const TERMINALS: Terminal[] = [
  {
    name: "Input terminal",
    inputs: [],
    outputs: ["data"],
  },
  {
    name: "Output terminal",
    inputs: ["data", "positive"],
    outputs: [],
  },
];
export const LEVELS: Level[] = [
  {
    id: 1,
    inputs: [
      [2, 1, 0, 0],
    ],
    target: [
      { prop: 0, v: 1 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        { kind: "Summarizer", number: 1 },
        { terminal: "Output terminal" },
      ],
    ],
    task: "shorten the greeting to the fleet to medium length",
    stake: "the fleet ignores any message longer than its own",
    words: {
      newLine: "New: Summarizer, data wires.",
      win: "The fleet reads Earth's greeting to the end. It is exactly as long as its own. The fleet replies. Contact is made.",
      lines: { "Nothing arrived": "Nothing reaches the fleet. It waits, hears silence and files Earth as a planet with nothing to say.", Dropped: "A copy of the greeting stops at a port with no wire, {Length}. Another reaches the fleet, which wonders what the first one said.", "All wrong": "The fleet receives a {Length} greeting. It expects a medium one, so it ignores it. Humanity is noted as hard to talk to." },
    },
  },
  {
    id: 2,
    inputs: [
      [1, 0, 0, 0],
    ],
    target: [
      { prop: 1, v: 1 },
      { prop: 0, v: 1 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        { kind: "Diplomat", number: 1 },
        { kind: "Summarizer", number: 1 },
        { terminal: "Output terminal" },
      ],
    ],
    task: "flatten the general's rude reply to the fleet's hello, at medium length",
    stake: "the fleet reads rudeness as a declaration of war",
    words: {
      newLine: "New: Diplomat.",
      win: "The general's reply reaches the fleet flat and of medium length. The fleet finds it neither rude nor warm. A fine start.",
      lines: { "Nothing arrived": "The general's reply never leaves Earth. The fleet takes the silence as a reply, and assumes the worst.", Dropped: "A copy of the reply stops at a port with no wire, {Tone} and {Length}. Another reaches the fleet. The general denies sending two.", "All wrong": "The fleet receives the general's reply {Tone} and {Length}. Its war council meets at once, to discuss the wording." },
    },
  },
  {
    id: 3,
    inputs: [
      [0, 2, 0, 2],
    ],
    target: [
      { prop: 3, v: 0 },
      { prop: 1, v: 2 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        { kind: "Translator", number: 1 },
        { kind: "Diplomat", number: 1 },
        { terminal: "Output terminal" },
      ],
      [
        null,
        { kind: "Summarizer", number: 1 },
        { kind: "Translator", number: 2 },
        null,
      ],
    ],
    task: "echo the fleet's greeting back in polite English, to show Earth read it",
    stake: "the fleet takes an unread greeting as an insult",
    words: {
      newLine: "New: Translator.",
      win: "Earth's echo reaches the fleet in polite English. The fleet concludes that humans can read. Earth is upgraded to a planet.",
      lines: { "Nothing arrived": "The fleet's greeting goes unanswered. By fleet custom, Earth has now insulted a whole civilisation by reading nothing.", Dropped: "A copy of the echo stops at a port with no wire, in {Language}. Another reaches the fleet, which suspects Earth kept the better one.", "All wrong": "The fleet receives its greeting back {Tone}, in {Language}. It takes this as proof that Earth has not read a word." },
    },
  },
  {
    id: 4,
    inputs: [
      [2, 0, 0, 0],
    ],
    target: [
      { prop: 2, v: 1 },
      { prop: 0, v: 1 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        { kind: "Summarizer", number: 1 },
        { kind: "Diplomat", number: 1 },
        { kind: "Analyst", number: 1 },
        { terminal: "Output terminal" },
      ],
    ],
    task: "turn the ministry's long rant into a medium-length list of Earth's wishes",
    stake: "the fleet reads nothing but lists",
    words: {
      newLine: "New: Analyst.",
      win: "The ministry's rant reaches the fleet as a tidy list of medium length. The fleet reads every item. It notes that Earth wants things.",
      lines: { "Nothing arrived": "The ministry's wishes never reach the fleet. The ministry, unaware, goes on ranting.", Dropped: "A copy of the ministry's wishes stops at a port with no wire, as a {Format}. Another reaches the fleet. The ministry rants about the lost one.", "All wrong": "The fleet receives the ministry's wishes as a {Length} {Format}. It reads only lists of medium length. It reads nothing." },
    },
  },
  {
    id: 5,
    inputs: [
      [0, 2, 1, 0],
      [2, 2, 1, 0],
    ],
    target: [
      { prop: 3, v: 1 },
      { prop: 0, v: 2 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        { kind: "Translator", number: 1 },
        { kind: "Lawyer", number: 1 },
        { kind: "Diplomat", number: 1 },
        { terminal: "Output terminal" },
      ],
    ],
    task: "write Earth's two welcome offers in long legalese",
    stake: "fleet law ignores any promise not in legalese",
    words: {
      newLine: "New: Lawyer.",
      win: "Both welcome offers reach the fleet in long legalese. Fleet law now binds Earth to its own hospitality.",
      lines: { "Nothing arrived": "No offer reaches the fleet. Under fleet law, Earth has offered nothing, and owes accordingly.", Dropped: "A copy of an offer stops at a port with no wire, {Length}, in {Language}. Fleet law counts an unsent copy as a broken promise.", "All wrong": "The fleet receives Earth's offers wrong, the first {Length}, in {Language}. Fleet law ignores both. Legally, Earth has not said welcome.", "Partly right": "One offer arrives in proper legalese. Another comes {Length}, in {Language}. Fleet law accepts half a welcome." },
    },
  },
  {
    id: 6,
    inputs: [
      [2, 1, 0, 0],
      [1, 1, 0, 0],
    ],
    target: [
      { prop: 0, v: 0 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        { kind: "Summarizer", number: 1 },
        {
          kind: "Inspector",
          number: 1,
          value: { prop: 0, v: 0 },
        },
        { terminal: "Output terminal" },
      ],
    ],
    task: "cut both greetings down to short, the fleet's word limit",
    stake: "a message over the limit gets Earth's frequency jammed",
    words: {
      newLine: "New: Inspector, positive and negative wires.",
      win: "Both greetings reach the fleet short, under its word limit. Earth's frequency stays open. For now.",
      lines: { Loop: "A greeting goes round a loop and never leaves, last seen {Length}. Mission control calls this a committee.", "Nothing arrived": "No greeting reaches the fleet. The fleet jams Earth's frequency anyway, to be safe.", Dropped: "A copy of a greeting stops at a port with no wire, {Length}. The fleet suspects Earth is keeping something back.", "All wrong": "The fleet receives greetings over its word limit, the first {Length}. Earth's frequency is jammed. Earth now hears only static.", "Partly right": "One greeting is short enough. Another arrives {Length}. The fleet jams Earth's frequency over it." },
    },
  },
  {
    id: 7,
    inputs: [
      [0, 1, 0, 0],
      [2, 1, 0, 0],
    ],
    target: [
      { prop: 0, v: 1 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        {
          kind: "Inspector",
          number: 1,
          value: { prop: 0, v: 1 },
        },
        { kind: "Summarizer", number: 1 },
        { kind: "Padder", number: 1 },
        { terminal: "Output terminal" },
      ],
    ],
    task: "bring two treaty terms to medium, the treaty's set length",
    stake: "a term of the wrong length voids the treaty",
    words: {
      newLine: "New: Padder.",
      win: "Both treaty terms reach the fleet at the treaty's set length. The treaty stands. Nobody reads it.",
      lines: { Loop: "A treaty term goes round a loop, last seen {Length}. Mission control stops counting. The treaty waits.", "Nothing arrived": "No treaty term reaches the fleet. The fleet signs the blank treaty anyway, and holds Earth to it.", Dropped: "A copy of a treaty term stops at a port with no wire, {Length}. The fleet notes its absence in the treaty, as a new clause.", "All wrong": "Every term arrives the wrong length, the first {Length}. The treaty is void. So, by its own terms, is Earth's lease.", "Partly right": "One term arrives {Length}, not medium. The fleet voids the whole treaty over it, exactly as the treaty says." },
    },
  },
  {
    id: 8,
    inputs: [
      [2, 2, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    target: [
      { prop: 1, v: 0 },
      { prop: 0, v: 0 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        { kind: "Summarizer", number: 1 },
        {
          kind: "Inspector",
          number: 1,
          value: { prop: 1, v: 0 },
        },
        { kind: "Straight Talker", number: 1 },
        { terminal: "Output terminal" },
      ],
    ],
    task: "make three treaty terms short and rude, the fleet's idea of diplomacy",
    stake: "the fleet takes politeness for weakness",
    words: {
      newLine: "New: Straight Talker.",
      win: "All three terms reach the fleet short and rude. The fleet calls Earth's diplomacy refreshingly hostile.",
      lines: { Loop: "A term goes round a loop and never arrives, last seen {Tone}. The fleet takes the delay for a polite pause. It is insulted.", "Nothing arrived": "No term reaches the fleet. The fleet takes the silence for good manners, and good manners for weakness.", Dropped: "A copy of a term stops at a port with no wire, {Tone} and {Length}. The fleet negotiates with the gap, and wins.", "Partly right": "One term arrives {Tone} and {Length}, not rude enough. The fleet takes it for weakness, and the rude ones for sarcasm." },
    },
  },
  {
    id: 9,
    inputs: [
      [1, 1, 2, 0],
      [1, 1, 1, 0],
    ],
    target: [
      { prop: 2, v: 0 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        { kind: "Analyst", number: 1 },
        {
          kind: "Inspector",
          number: 1,
          value: { prop: 2, v: 0 },
        },
        { kind: "Poet", number: 1 },
        { terminal: "Output terminal" },
      ],
    ],
    task: "turn the treaty's chart and list back into plain text",
    stake: "the fleet's ambassador cannot read diagrams",
    words: {
      newLine: "New: Poet.",
      win: "The treaty's chart and list reach the ambassador as plain text. The ambassador reads them aloud, slowly, to everyone.",
      lines: { Loop: "A part of the treaty goes round a loop and never arrives, last seen as a {Format}. The ambassador waits, holding a page upside down.", "Nothing arrived": "Nothing reaches the ambassador, who is relieved, and reports a successful meeting.", Dropped: "A copy of a part of the treaty stops at a port with no wire, as a {Format}. The ambassador signs without it. Unread, as usual.", "All wrong": "The ambassador receives a {Format} instead of text. The treaty is signed in the wrong place.", "Partly right": "One part arrives as text, another as a {Format}. The ambassador frames the {Format} and signs half the treaty." },
    },
  },
  {
    id: 10,
    inputs: [
      [0, 1, 0, 0],
      [2, 0, 0, 0],
      [1, 2, 0, 0],
    ],
    target: [
      { prop: 0, v: 1 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        { kind: "Straight Talker", number: 1 },
        {
          kind: "Inspector",
          number: 1,
          value: { prop: 0, v: 0 },
        },
        { terminal: "Output terminal" },
      ],
      [
        null,
        { kind: "Manager", number: 1 },
        { kind: "Padder", number: 1 },
        null,
      ],
    ],
    task: "even out three clauses to one medium length",
    stake: "uneven clauses look like a trick to the fleet's lawyers",
    words: {
      newLine: "New: Manager.",
      win: "All three clauses reach the fleet at one medium length. The fleet's lawyers find no trick. They are disappointed.",
      lines: { Loop: "A clause goes round a loop, last seen {Length}. It is now the longest-running clause in history. It is never sent.", "Nothing arrived": "No clause reaches the fleet. Its lawyers call the empty treaty Earth's cleverest trick yet.", Dropped: "A copy of a clause stops at a port with no wire, {Length}. The fleet's lawyers find the gap, and move in.", "All wrong": "The clauses arrive the wrong length, the first {Length}. The fleet's lawyers call it a trick, and bill Earth for their time.", "Partly right": "Some clauses arrive medium. One arrives {Length}. The fleet's lawyers find the odd one out and call it a trick." },
    },
  },
  {
    id: 11,
    inputs: [
      [1, 0, 0, 0],
      [1, 2, 0, 0],
    ],
    target: [
      { prop: 1, v: 1 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        {
          kind: "Inspector",
          number: 1,
          value: { prop: 1, v: 0 },
        },
        { kind: "Manager", number: 1 },
        { kind: "Diplomat", number: 1 },
        { terminal: "Output terminal" },
      ],
      [
        null,
        { kind: "Straight Talker", number: 1 },
        { kind: "Rubber Stamp", number: 1 },
        null,
        null,
      ],
    ],
    task: "make two treaty clauses flat, with no feeling left",
    stake: "the fleet's inspectors reject any clause with emotion",
    words: {
      newLine: "New: Rubber Stamp.",
      win: "Both clauses reach the fleet flat, with no feeling left in them. The fleet's inspectors approve, without feeling.",
      lines: { Overload: "A clause is copied past all counting, and every copy still moving jams at its port. The inspectors reject the queue.", Loop: "A clause goes round a loop and never arrives, last seen {Tone}. The inspectors are still waiting.", "Nothing arrived": "No clause reaches the fleet. Its inspectors reject the silence for being too emotional.", Dropped: "A copy of a clause stops at a port with no wire, {Tone}. The inspectors reject it in its absence.", "All wrong": "Every clause arrives with feeling, the first {Tone}. The inspectors reject them all, and note Earth as moody.", "Partly right": "One clause arrives flat. Another arrives {Tone}. The inspectors reject it, and now suspect the flat one too." },
    },
  },
  {
    id: 12,
    inputs: [
      [0, 1, 0, 0],
      [2, 1, 0, 0],
    ],
    target: [
      { prop: 0, v: 1 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        { kind: "Summarizer", number: 1 },
        {
          kind: "Inspector",
          number: 1,
          value: { prop: 0, v: 1 },
        },
        { kind: "Shredder", number: 1 },
        { terminal: "Output terminal" },
      ],
      [
        null,
        { kind: "Padder", number: 1 },
        { kind: "Rubber Stamp", number: 1 },
        null,
        null,
      ],
    ],
    task: "send two treaty annexes at medium, the regulation length",
    stake: "one wrong annex and the fleet tears up the whole treaty",
    words: {
      newLine: "New: Shredder.",
      win: "Both annexes reach the fleet at the regulation length. The treaty is complete, and filed in triplicate.",
      lines: { Loop: "An annex goes round a loop, last seen {Length}. The treaty waits for it. So does humanity.", "Nothing arrived": "No annex reaches the fleet. The fleet tears up the treaty, then tears up the pieces, by regulation.", Dropped: "A copy of an annex stops at a port with no wire, {Length}. The fleet tears up the treaty for want of it.", Shredded: "An annex goes into the shredder, {Length}. The shredder does its job perfectly. The fleet tears up the rest, to match.", "All wrong": "Every annex arrives the wrong length, the first {Length}. The fleet tears up the treaty into pieces of regulation length.", "Partly right": "One annex arrives {Length}, not medium. The fleet tears up the whole treaty, as promised." },
    },
  },
  {
    id: 13,
    inputs: [
      [0, 2, 0, 2],
      [0, 0, 0, 0],
      [0, 1, 0, 1],
    ],
    target: [
      { prop: 3, v: 0 },
      { prop: 1, v: 2 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        { kind: "Translator", number: 1 },
        {
          kind: "Inspector",
          number: 1,
          value: { prop: 3, v: 0 },
        },
        { kind: "Lawyer", number: 1 },
        { terminal: "Output terminal" },
      ],
      [
        null,
        { kind: "Diplomat", number: 1 },
        {
          kind: "Inspector",
          number: 2,
          value: { prop: 1, v: 2 },
        },
        null,
        null,
      ],
    ],
    task: "gather three departments' replies into polite English",
    stake: "one reply the fleet cannot read, and it assumes Earth hides something",
    words: {
      newLine: null,
      win: "All three replies reach the fleet in polite English. The fleet finds nothing hidden in them. It checks twice.",
      lines: { Overload: "A reply is copied between departments past all counting, and every copy still moving jams at its port. Each department blames another.", Loop: "A reply goes round a loop and never leaves, last seen in {Language}. Each department believes another one is sending it.", "Nothing arrived": "No reply reaches the fleet. The fleet assumes Earth is hiding something. Possibly everything.", Dropped: "A copy of a reply stops at a port with no wire, in {Language}. The fleet counts the copies, and suspects a department of hiding one.", "All wrong": "The fleet receives replies it cannot use, the first {Tone}, in {Language}. It assumes Earth hides something, and starts looking.", "Partly right": "Some replies are fine. One arrives {Tone}, in {Language}. The fleet assumes that department is hiding something." },
    },
  },
  {
    id: 14,
    inputs: [
      [0, 1, 0, 0],
      [2, 1, 0, 0],
      [1, 0, 0, 0],
    ],
    target: [
      { prop: 0, v: 1 },
      { prop: 1, v: 1 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        { kind: "Summarizer", number: 1 },
        {
          kind: "Inspector",
          number: 1,
          value: { prop: 0, v: 1 },
        },
        { kind: "Rubber Stamp", number: 1 },
        { terminal: "Output terminal" },
      ],
      [
        null,
        { kind: "Padder", number: 1 },
        { kind: "Diplomat", number: 1 },
        {
          kind: "Inspector",
          number: 2,
          value: { prop: 1, v: 1 },
        },
        null,
      ],
    ],
    task: "make the reply's three closing statements flat and of medium length",
    stake: "any sign of panic, and the fleet assumes the worst",
    words: {
      newLine: null,
      win: "All three closing statements reach the fleet flat and of medium length. The fleet detects no panic. It relaxes slightly.",
      lines: { Overload: "A statement is copied past all counting, and every copy still moving jams at its port. Mission control calls it a precaution.", Loop: "A statement goes round a loop and never arrives, last seen {Length} and {Tone}. The fleet reads the pause as panic.", "Nothing arrived": "No closing statement reaches the fleet. The fleet assumes the worst, as it does by default.", Dropped: "A copy of a statement stops at a port with no wire, {Tone}. The fleet notices the gap, and assumes panic.", "All wrong": "The closing statements arrive wrong, the first {Length} and {Tone}. The fleet detects panic, and assumes the worst.", "Partly right": "One statement arrives {Length} and {Tone}. The fleet detects panic in it, and assumes the worst of all three." },
    },
  },
  {
    id: 15,
    inputs: [
      [1, 1, 2, 2],
      [1, 1, 0, 0],
    ],
    target: [
      { prop: 3, v: 1 },
      { prop: 2, v: 1 },
    ],
    rows: [
      [
        { terminal: "Input terminal" },
        { kind: "Lawyer", number: 1 },
        { kind: "Analyst", number: 1 },
        {
          kind: "Inspector",
          number: 1,
          value: { prop: 3, v: 1 },
        },
        { terminal: "Output terminal" },
      ],
      [
        null,
        { kind: "Translator", number: 1 },
        { kind: "Poet", number: 1 },
        {
          kind: "Inspector",
          number: 2,
          value: { prop: 2, v: 1 },
        },
        null,
      ],
    ],
    task: "file the reply's two appendices as lists in legalese",
    stake: "an appendix not filed counts as no answer",
    words: {
      newLine: null,
      win: "Both appendices reach the fleet as lists in legalese, properly filed. Earth has answered, in triplicate.",
      lines: { Overload: "An appendix is copied past all counting, and every copy still moving jams at its port. The clerks order more shelves anyway.", Loop: "An appendix goes round a loop, refiled each time, last seen as a {Format} in {Language}. It is never filed.", "Nothing arrived": "No appendix reaches the fleet. By fleet law, Earth gives no answer. The deadline passes.", Dropped: "A copy of an appendix stops at a port with no wire, a {Format} in {Language}. It counts as no answer.", "All wrong": "The appendices arrive wrong, the first a {Format} in {Language}. The clerks cannot file them. Earth has said nothing.", "Partly right": "One appendix arrives as a {Format} in {Language}. Unfiled, it counts as no answer. So does the whole reply." },
    },
  },
  {
    id: 16,
    inputs: [
      [2, 0, 0, 2],
      [0, 2, 0, 0],
      [1, 1, 0, 1],
    ],
    target: [
      { prop: 1, v: 2 },
      { prop: 0, v: 0 },
      { prop: 3, v: 0 },
    ],
    rows: [
      [
        null,
        { kind: "Translator", number: 1 },
        {
          kind: "Inspector",
          number: 1,
          value: { prop: 3, v: 0 },
        },
        { kind: "Manager", number: 1 },
        null,
      ],
      [
        { terminal: "Input terminal" },
        { kind: "Diplomat", number: 1 },
        {
          kind: "Inspector",
          number: 2,
          value: { prop: 1, v: 2 },
        },
        null,
        { terminal: "Output terminal" },
      ],
      [
        null,
        { kind: "Summarizer", number: 1 },
        {
          kind: "Inspector",
          number: 3,
          value: { prop: 0, v: 0 },
        },
        null,
        null,
      ],
    ],
    task: "boil three drafts of the reply's opening down to short, polite English",
    stake: "the fleet stops reading at the first long or rude line",
    words: {
      newLine: null,
      win: "All three drafts reach the fleet short, polite and in English. The fleet reads the whole opening. A first.",
      lines: { Overload: "A draft is copied past all counting, and every copy still moving jams at its port. Mission control drafts an apology. It is copied too.", Loop: "A draft goes round a loop and never arrives, last seen {Length} and {Tone}. The opening still has no opening.", "Nothing arrived": "No draft reaches the fleet. It reads nothing, and calls it Earth's best work so far.", Dropped: "A copy of a draft stops at a port with no wire, {Tone} and {Length}. The fleet reads the rest, and misses the point.", "All wrong": "The fleet receives a {Length}, {Tone} line in {Language}, and no line it can use. The opening is lost.", "Partly right": "Some drafts arrive right. One arrives {Length} and {Tone}, in {Language}, and spoils the opening." },
    },
  },
  {
    id: 17,
    inputs: [
      [2, 0, 2, 2],
      [1, 2, 1, 1],
      [0, 1, 0, 0],
    ],
    target: [
      { prop: 2, v: 2 },
      { prop: 3, v: 0 },
    ],
    rows: [
      [
        null,
        { kind: "Translator", number: 1 },
        { kind: "Manager", number: 1 },
        { kind: "Poet", number: 1 },
        null,
      ],
      [
        { terminal: "Input terminal" },
        {
          kind: "Inspector",
          number: 1,
          value: { prop: 3, v: 0 },
        },
        { kind: "Analyst", number: 1 },
        { kind: "Rubber Stamp", number: 1 },
        { terminal: "Output terminal" },
      ],
      [
        null,
        { kind: "Straight Talker", number: 1 },
        {
          kind: "Inspector",
          number: 2,
          value: { prop: 2, v: 2 },
        },
        null,
        null,
      ],
    ],
    task: "put the reply's three parts into charts, in English",
    stake: "the fleet's admiral trusts nothing but charts",
    words: {
      newLine: null,
      win: "All three parts reach the admiral as charts in English. The admiral trusts the reply, and asks for more charts.",
      lines: { Overload: "A part is copied past all counting, and every copy still moving jams at its port. The admiral asks for a chart of the jam.", Loop: "A part goes round a loop, last seen as a {Format} in {Language}. The admiral is still waiting for the chart.", "Nothing arrived": "No part reaches the admiral. The admiral draws a chart of Earth's silence, and does not like its shape.", Dropped: "A copy of a part stops at a port with no wire, a {Format} in {Language}. The admiral notices the gap in the charts.", "All wrong": "The admiral receives a {Format} in {Language}, and trusts nothing but charts in English. Trust is low.", "Partly right": "One part arrives as a {Format} in {Language}. The admiral trusts the charts, and distrusts Earth for the rest." },
    },
  },
  {
    id: 18,
    inputs: [
      [0, 2, 0, 2],
      [2, 0, 2, 0],
      [1, 1, 1, 1],
      [0, 0, 2, 0],
    ],
    target: [
      { prop: 3, v: 0 },
      { prop: 1, v: 2 },
      { prop: 0, v: 1 },
    ],
    rows: [
      [
        null,
        { kind: "Translator", number: 1 },
        { kind: "Diplomat", number: 1 },
        { kind: "Summarizer", number: 1 },
        null,
      ],
      [
        { terminal: "Input terminal" },
        {
          kind: "Inspector",
          number: 1,
          value: { prop: 3, v: 0 },
        },
        {
          kind: "Inspector",
          number: 2,
          value: { prop: 1, v: 2 },
        },
        { kind: "Lawyer", number: 1 },
        { terminal: "Output terminal" },
      ],
      [
        null,
        { kind: "Manager", number: 1 },
        {
          kind: "Inspector",
          number: 3,
          value: { prop: 0, v: 1 },
        },
        null,
        null,
      ],
    ],
    task: "send humanity's reply: four drafts, each polite, medium and in English",
    stake: "this message decides whether Earth is worth keeping",
    words: {
      newLine: null,
      win: "All four drafts reach the fleet polite, medium and in English. The fleet decides: Earth is worth keeping. Well done, everyone.",
      lines: { Overload: "Humanity's reply is copied past all counting, and every copy still moving jams at its port. The fleet decides without waiting.", Loop: "A draft goes round a loop, last seen {Tone} and {Length}, in {Language}. Humanity's last answer is still in review.", "Nothing arrived": "Humanity's reply never leaves Earth. The fleet decides. Earth is not kept.", Dropped: "A copy of a draft stops at a port with no wire, {Tone} and {Length}. The fleet decides without it, and not in Earth's favour.", "All wrong": "The fleet receives a draft {Tone} and {Length}, in {Language}. It decides Earth is not worth keeping, and files the draft as evidence.", "Partly right": "Some drafts are right. One arrives {Tone} and {Length}, in {Language}. The fleet decides on that one." },
    },
  },
];
export const ACTS: Act[] = [
  { act: 1, first: 1, last: 6, name: "First contact", situation: "an alien fleet reads Earth's messages, and Earth must answer its greetings" },
  { act: 2, first: 7, last: 12, name: "The treaty", situation: "every term Earth sends must pass inspection first" },
  { act: 3, first: 13, last: 18, name: "The reply", situation: "humanity's last answer before the fleet decides" },
];
export const PARAMS: Record<string, Param> = {
  MoveTime: { value: 0.4, unit: "seconds", page: "core/run.md" },
  WorkTime: { value: 0.25, unit: "seconds", page: "core/run.md" },
  FastFactor: { value: 4, unit: "times", page: "core/run.md" },
  MaxMoves: { value: 200, unit: "moves", page: "core/run.md" },
  ZoomMax: { value: 2, unit: "times full size", page: "core/view.md" },
  PortTouch: { value: 44, unit: "CSS pixels", page: "core/view.md" },
  PortPointer: { value: 24, unit: "CSS pixels", page: "core/view.md" },
  EdgeZone: { value: 24, unit: "CSS pixels", page: "core/view.md" },
  EdgeSpeed: { value: 600, unit: "CSS pixels per second", page: "core/view.md" },
  TapDistance: { value: 8, unit: "CSS pixels", page: "core/view.md" },
  MaxAgents: { value: 8, unit: "agents", page: "levels/levels.md" },
  MaxInputs: { value: 4, unit: "inputs", page: "levels/levels.md" },
  ReportAgents: { value: 4, unit: "lines", page: "levels/report.md" },
  FirstLoad: { value: 300, unit: "kilobytes, compressed", page: "shell/app-shell.md" },
  LookStart: { value: "light", unit: "light or dark", page: "shell/app-shell.md" },
  SoundStart: { value: "on", unit: "on or off", page: "shell/app-shell.md" },
  MusicStart: { value: "on", unit: "on or off", page: "shell/app-shell.md" },
  CountsStart: { value: "on", unit: "on or off", page: "shell/app-shell.md" },
  TextContrast: { value: 4.5, unit: "contrast ratio", page: "art-direction.md" },
  MarkContrast: { value: 3, unit: "contrast ratio", page: "art-direction.md" },
  FlashMax: { value: 3, unit: "flashes per second", page: "art-direction.md" },
  SpringTime: { value: 0.15, unit: "seconds", page: "art-direction.md" },
  BeepTime: { value: 0.25, unit: "seconds", page: "art-direction.md" },
};
export const STYLE: Style = {
  colors: {
    ground: { light: "#EFEBE1", dark: "#0F1113" },
    face: { light: "#FAF8F3", dark: "#1C1F23" },
    dim: { light: "#80868E", dark: "#7A8088" },
    muted: { light: "#4F555C", dark: "#A6ABB2" },
    ink: { light: "#16181B", dark: "#EDE8DC" },
    blue: { light: "#2B62C9", dark: "#5B9BF5" },
    yellow: { light: "#9A7200", dark: "#F2C230" },
    red: { light: "#C8341C", dark: "#E04A2F" },
  },
  fonts: {
    body: { size: 16, weight: 400, lineHeight: 1.4, caps: false, spacing: 0 },
    label: { size: 13, weight: 600, lineHeight: 1.2, caps: true, spacing: 0.08 },
    title: { size: 28, weight: 700, lineHeight: null, caps: true, spacing: 0.12 },
    small: { size: 13, weight: 400, lineHeight: 1.2, caps: false, spacing: 0 },
  },
  sizes: { line: 2, unit: 8, corner: 0, buttonHeight: 44, markSize: 10, portMarkSize: 14, tokenSize: 32 },
};
export const COUNTS_LINE = "Agents used: {Agents}. Wires used: {Wires}.";
export const SHELL_WORDS: ShellWords = { notKept: "Progress is not kept in this browser. It ends when the page closes.", countsLine: "Counts two events, with nothing that tells who you are: a first level started, and the campaign finished.", homeScreen: "Add the game to your home screen to keep progress longer. The home screen copy starts from the first level." };
