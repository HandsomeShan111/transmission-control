# Build order

Builders start here. Rules live on the design pages, kept in the gamedev-pipelines repo; this page orders them.
Tests: [Acceptance tests](acceptance.md). Values to tune: [Tunables](tunables.md).

## Before building

- OQ-LEVELS-14: how each browser saves the share picture. Blocks: Report, the Save picture control.
- OQ-SHELL-08: how the page tells an iPhone or iPad, and the home screen copy. Blocks: App shell, the home screen suggestion.

## Order

1. Items, steps `ITEM-`, with Data and Data: Levels. Needs: none. Stubs: Agents, Run.
2. Agents, steps `AGENT-`. Needs: Items. Stubs: Run.
3. Wiring, steps `WIRE-`. Needs: Agents. Stubs: Run, View.
4. Run, steps `RUN-`. Needs: Items, Agents, Wiring. Stubs: Campaign, App shell.
5. View, steps `VIEW-`. Needs: Wiring. Stubs: Levels.
6. Levels, steps `LEVEL-`. Needs: Items, Agents, Wiring, Run, View. Stubs: Campaign, Save, App shell.
7. Report, steps `REPORT-`. Needs: Agents, Run, Levels. Stubs: Campaign, Save.
8. Campaign, steps `CAMP-`. Needs: Levels, Report. Stubs: Save.
9. Save, steps `SAVE-`. Needs: Wiring, Campaign. Stubs: App shell, Play counts.
10. App shell, steps `APP-`. Needs: Run, Levels, Campaign, Save. Stubs: Play counts.

## Screens and content

- Screens: Play, Campaign map, Settings, Share picture, after the systems whose outputs they show. Style: UI style.
- Look, sound and words: Art direction, steps `ART-`, with each system whose step its steps link.
- Assets: Content inventory.

## Product measures

- MEAS-01 to MEAS-04, after the steps they hook into: SAVE-01, SAVE-03, CAMP-02, APP-04, APP-05.
