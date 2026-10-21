# Acceptance tests

One test per step; it passes when the build does what its step says, every parameter at its start value.
Order: [Build order](order.md).

Test form: `- **<STEP ID>**: Setup: <state before, naming parameters>. Do: <player or system action>. Expect: <step ID>.`
Expected count or position computed from parameters → name them in a **Derived:** part, never the values.

Setups: level N, unlocked, SAVE-01; solved, wired as the level's `solution` in `tests/fixtures/level-checks.json`; input, output: terminals.

## Items

- **ITEM-01**: Setup: level 1. Do: read input. Expect: ITEM-01.
- **ITEM-02**: Setup: ITEM-04's. Do: Launch. Expect: ITEM-02.
- **ITEM-03**: Setup: ITEM-04's. Do: Launch. Expect: ITEM-03.
- **ITEM-04**: Setup: level 3, input to Translator 1 and Summarizer 1. Do: Launch. Expect: ITEM-04.
- **ITEM-05**: Setup: level 1 solved. Do: Launch; read a moving token. Expect: ITEM-05.

## Agents

- **AGENT-01**: Setup: level 11. Do: open it. Expect: AGENT-01.
- **AGENT-02**: Setup: level 16. Do: open it. Expect: AGENT-02.
- **AGENT-03**: Setup: level 2, input to Diplomat 1. Do: Launch. Expect: AGENT-03.
- **AGENT-04**: Setup: level 6, input to Summarizer 1 to Inspector 1, positive to output. Do: Launch. Expect: AGENT-04.
- **AGENT-05**: Setup: level 11, input to Rubber Stamp 1. Do: Launch. Expect: AGENT-05.
- **AGENT-06**: Setup: level 10, input to Inspector 1, both outputs to Manager 1, it to output. Do: Launch. Expect: AGENT-06.
- **AGENT-07**: Setup: level 12, input to Summarizer 1 to Inspector 1; positive to output, negative to Shredder 1. Do: Launch. Expect: AGENT-07.
- **AGENT-08**: Setup: level 1 solved. Do: Launch. Expect: AGENT-08.

## Wiring

- **WIRE-01**: Setup: level 6. Do: join Summarizer 1 to Inspector 1's positive, then data input; input to Inspector 1. Expect: WIRE-01.
- **WIRE-02**: Setup: AGENT-03's. Do: move the wire's end to Summarizer 1. Expect: WIRE-02.
- **WIRE-03**: Setup: level 1, one wire. Do: drag the wire to no port. Expect: WIRE-03.
- **WIRE-04**: Setup: level 2: two lays, a move, a remove, a Clear. Do: Undo six times. Expect: WIRE-04.
- **WIRE-05**: Setup: level 3, three wires. Do: Clear. Expect: WIRE-05.
- **WIRE-06**: Setup: a run on. Do: join two ports; Undo; Clear. Expect: WIRE-06.

## Run

- **RUN-01**: Setup: level 1 solved. Do: Launch. Expect: RUN-01.
- **RUN-02**: Setup: level 5 solved. Do: Launch. Expect: RUN-02.
- **RUN-03**: Setup: ITEM-04's. Do: Launch; time each move. Expect: RUN-03.
- **RUN-04**: Setup: level 10, input to Straight Talker 1 and Inspector 1, both to Padder 1. Do: Launch; time the work. Expect: RUN-04.
- **RUN-05**: Setup: level 1 solved. Do: Launch. Expect: RUN-05.
- **RUN-06**: Setup: level 10, input to Padder 1 to Inspector 1, negative to Padder 1. Do: Launch. Expect: RUN-06.
- **RUN-14**: Setup: level 18, long-run wiring, `longRun` in `tests/fixtures/level-checks.json`. Do: Launch. Expect: RUN-14.
- **RUN-07**: Setup: level 6, input to Summarizer 1 to output. Do: Launch. Expect: RUN-07.
- **RUN-08**: Setup: level 5 solved. Do: Launch; wait. Expect: RUN-08.
- **RUN-09**: Setup: a run on. Do: Fast mid-move; time a move, work; Fast mid-work. Expect: RUN-09.
- **RUN-10**: Setup: a run on. Do: Skip. Expect: RUN-10.
- **RUN-11**: Setup: a run on. Do: Stop; again, open the campaign map. Expect: RUN-11.
- **RUN-12**: Setup: a run on. Do: hide the page; show it; open settings. Expect: RUN-12.
- **RUN-13**: Setup: ITEM-03's, AGENT-07's, RUN-06's, RUN-14's. Do: Launch each; lay a wire. Expect: RUN-13.

## View

- **VIEW-01**: Setup: level 1. Do: touch, then click; measure a port's target. Expect: VIEW-01.
- **VIEW-02**: Setup: level 16, smallest Platform screen. Do: open it. Expect: VIEW-02.
- **VIEW-03**: Setup: level 16. Do: zoom past ZoomMax; out past the opening zoom. Expect: VIEW-03.
- **VIEW-04**: Setup: level 16, zoomed in. Do: drag each way. Expect: VIEW-04.
- **VIEW-05**: Setup: VIEW-02's. Do: tap a port. Expect: VIEW-05.
- **VIEW-06**: Setup: level 16, zoomed in. Do: turn the screen. Expect: VIEW-06.
- **VIEW-07**: Setup: level 3, portrait. Do: open it. Expect: VIEW-07.
- **VIEW-08**: Setup: VIEW-02's, zoomed in, a start chosen. Do: zoom; drag; join zoomed out; drag from a port into EdgeZone. Expect: VIEW-08.
- **VIEW-09**: Setup: level 1. Do: press targets, wires, empty space; move under and at TapDistance; pinch. Expect: VIEW-09.
- **VIEW-10**: Setup: level 1, a drag from a port. Do: press a second finger. Expect: VIEW-10.
- **VIEW-11**: Setup: level 1. Do: each listed gesture, by touch, mouse and trackpad. Expect: VIEW-11.

## Levels

- **LEVEL-01**: Setup: level 16. Do: open it. Expect: LEVEL-01.
- **LEVEL-02**: Setup: `bun run levelcheck` passed. Do: match the build's levels to Data: Levels. Expect: LEVEL-02.
- **LEVEL-03**: Setup: level 6. Do: open it; press the brief; press the level's number. Expect: LEVEL-03.
- **LEVEL-04**: Setup: level 8 solved. Do: open it; Launch. Expect: LEVEL-04.
- **LEVEL-05**: Setup: level 8. Do: open it. Expect: LEVEL-05.
- **LEVEL-06**: Setup: level 6 solved; then RUN-07's. Do: Launch each. Expect: LEVEL-06.

## Report

- **REPORT-01**: Setup: level 1 solved; then unwired. Do: Launch each. Expect: REPORT-01.
- **REPORT-02**: Setup: RUN-14's, RUN-06's, REPORT-01's, AGENT-04's, AGENT-07's, RUN-07's; level 1, input to output. Do: Launch each. Expect: REPORT-02.
- **REPORT-03**: Setup: REPORT-02's. Do: Launch each. Expect: REPORT-03.
- **REPORT-04**: Setup: RUN-06's. Do: Launch. Expect: REPORT-04.
- **REPORT-05**: Setup: AGENT-04's. Do: Launch; read each slot. Expect: REPORT-05.
- **REPORT-06**: Setup: level 3 solved. Do: Launch. Expect: REPORT-06.
- **REPORT-07**: Setup: a report open. Do: Save picture. Expect: REPORT-07.
- **REPORT-08**: Setup: RUN-06's report open. Do: close it. Expect: REPORT-08.

## Campaign

- **CAMP-01**: Setup: no save. Do: open the game. Expect: CAMP-01.
- **CAMP-02**: Setup: level 1 solved. Do: Launch; Next level. Expect: CAMP-02.
- **CAMP-03**: Setup: CAMP-04's. Do: open the campaign map. Expect: CAMP-03.
- **CAMP-04**: Setup: levels 1 to 3 won. Do: open the campaign map. Expect: CAMP-04.
- **CAMP-05**: Setup: level 6 solved; no save; level 7, its card seen; level 4. Do: Launch, Next level, press the card; open the game on each other setup, press the title screen. Expect: CAMP-05.

## Save

- **SAVE-01**: Setup: level 2 won, a wire, sound off, offline. Do: read storage. Expect: SAVE-01.
- **SAVE-02**: Setup: level 1. Do: lay a wire, switch a setting; read storage after each. Expect: SAVE-02.
- **SAVE-03**: Setup: a save; then none. Do: open the game each time. Expect: SAVE-03.
- **SAVE-04**: Setup: storage blocked. Do: win level 1; reload. Expect: SAVE-04.
- **SAVE-05**: Setup: a save with wires; a new version renaming one port. Do: open it. Expect: SAVE-05.
- **SAVE-06**: Setup: level 3 won and wired, sound off. Do: Reset, confirmed. Expect: SAVE-06.
- **SAVE-07**: Setup: no level won. Do: win level 1, then level 2. Expect: SAVE-07.

## App shell

- **APP-01**: Setup: no save; level 2 open, dark look; every level won. Do: open the game each time, and reload; press the title screen and any card. Expect: APP-01.
- **APP-02**: Setup: no save, a slow network. Do: open the game; sum bytes before play. Expect: APP-02.
- **APP-03**: Setup: every file arrived. Do: offline, open the game. Expect: APP-03.
- **APP-04**: Setup: a new version published. Do: visit twice. Expect: APP-04.
- **APP-05**: Setup: level 1, an iPhone's browser. Do: open settings; press each control; close. Expect: APP-05.
- **APP-06**: Setup: level 1. Do: press the map control. Expect: APP-06.
- **APP-07**: Setup: sound and music on. Do: open the game; press; open the campaign map. Expect: APP-07.

## Art direction

- **ART-01**: Setup: level 18, each look. Do: open it. Expect: ART-01.
- **ART-02**: Setup: AGENT-07's. Do: Launch. Expect: ART-02.
- **ART-03**: Setup: AGENT-07's. Do: Launch. Expect: ART-03.
- **ART-04**: Setup: a greyscale screen. Do: read each listed state. Expect: ART-04.
- **ART-05**: Setup: RUN-14's. Do: Launch; read tokens and stacks. Expect: ART-05.
- **ART-06**: Setup: level 18. Do: read target and inspectors. Expect: ART-06.
- **ART-07**: Setup: level 18 solved. Do: Launch. Expect: ART-07.
- **ART-08**: Setup: level 16. Do: lay wires to ports on each side. Expect: ART-08.
- **ART-09**: Setup: level 1 solved. Do: Launch; drag input to no port. Expect: ART-09.
- **ART-10**: Setup: RUN-14's, Fast on. Do: Launch. Expect: ART-10.
- **ART-11**: Setup: CAMP-05's. Do: Launch; Next level; open the game, no save. Expect: ART-11.
- **ART-12**: Setup: APP-02's. Do: open the game. Expect: ART-12.
- **ART-13**: Setup: Content inventory. Do: read each shown line. Expect: ART-13.
- **ART-14**: Setup: level 1, sound on. Do: lay, cut, Undo, Launch, win, lose, press a button. Expect: ART-14.
- **ART-15**: Setup: music on. Do: open a level, then the campaign map. Expect: ART-15.

## Play counts

- **MEAS-01**: Setup: no save. Do: open the game; reach level 1. Expect: MEAS-01.
- **MEAS-02**: Setup: level 18 solved. Do: Launch. Expect: MEAS-02.
- **MEAS-03**: Setup: offline. Do: MEAS-01's; online, visit again; counts off. Expect: MEAS-03.
- **MEAS-04**: Setup: level 1. Do: open settings. Expect: MEAS-04.

## Screens

One check per screen and look: at the smallest and largest Platform screen, the build matches the screen's Layout; previews are a guide only.

- **Play**: Expect: Play.
- **Campaign map**: Expect: Campaign map.
- **Settings**: Expect: Settings.
- **Share picture**: Expect: Share picture.
