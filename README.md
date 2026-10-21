# Transmission Control

A wiring puzzle for the browser: route messages through scripted agents to answer an alien fleet.
Working title: Agent Wires, never shown to players. The design pages live in the gamedev-pipelines repo. Build docs: [Build order](docs/build/order.md), [Acceptance tests](docs/build/acceptance.md), [Tunables](docs/build/tunables.md).

## Build

```sh
bun install
bun run build          # dist/: index.html, sw.js, assets/
```

`dist/` is the whole game: static files with relative paths, no server code.
`TC_COUNTS_ADDRESS=https://… bun run build` sets the count service's address. Unset, the two play counts wait in the save and are never sent.

Sources:

- `src/content/`: the game's data: levels, agents, words, parameters. `generated.ts` is edited by hand; run `bun run levelcheck` after a level change.
- `src/core/`: rules with no browser: items, agents, wiring, run, report, campaign, save, counts.
- `src/draw/`: SVG for the play area and the share picture.
- `src/ui/`: the screens. `src/shell/`: storage, the visit, sound, sending counts. `src/main.ts`: start-up.
- `src/sw.ts`: the service worker, offline play.

## Test

```sh
bun test ./tests/core/run.test.ts     # one file; tests/ holds core, draw, ui, shell, sound and build tests
bun run typecheck
bun run levelcheck                    # LEVEL-01, LEVEL-02, REPORT-03 on every level; writes the test fixture
```

Browser tests run against the built game as served; they start no server. The test site serves it under `/transmission-control/`, as GitHub Pages does:

```sh
bun tools/build.ts dist-pages/transmission-control && PORT=<port> bun tools/serve.ts dist-pages
BASE_URL=http://127.0.0.1:<port>/transmission-control/ bunx playwright test
```

## Host

Copy `dist/` to any static host:

- GitHub Pages: `.github/workflows/pages.yml` builds and publishes `dist/` on each push to `staging`, at https://handsomeshan111.github.io/transmission-control/. The repo's Pages source must be GitHub Actions.
- itch.io: zip the contents of `dist/`, upload as an HTML game.

Offline play and the save need a secure address: https, or localhost.

More: [Tutorial: build and play](docs/build/tutorial-first-build.md), [How to publish on GitHub Pages](docs/build/how-to-publish.md), [Reference: build and hosting](docs/build/reference-build.md), [Explanation: one build for every address](docs/build/explanation-hosting.md).
