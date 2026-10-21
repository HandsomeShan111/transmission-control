# Tunables

Parameters and data fields with a tuning range, by system. Start values: `src/content/generated.ts`. Ranges: the design pages, kept in the gamedev-pipelines repo.

## Run

- MoveTime: tokens move slower; each run takes longer to watch.
- WorkTime: each agent's work shows longer.
- FastFactor: Fast plays a run quicker.
- MaxMoves: a multiplying wiring runs longer before it overloads.

## View

- ZoomMax: the player zooms closer on a level.
- EdgeZone: a held wire end moves the view from farther inside the edge.
- EdgeSpeed: the view moves faster under a held wire end.
- TapDistance: a press moves farther before it counts as a drag.

## Levels

- MaxAgents: a level may hold more agents.
- MaxInputs: a level may send more inputs.

## Report

- ReportAgents: a lost run's report tells more of the followed copy's path.

## App shell

- FirstLoad: a first visit may wait longer for its first level.

## Art direction

- SpringTime: a let-go wire end takes longer to spring back.
