# Reference: build and hosting

Commands, built files and hosting settings. Commands run from the repo root.

## Commands

- `bun install`: packages.
- `bun run build`: builds into `dist/`. `bun tools/build.ts <folder>`: builds into that folder, which must sit inside the repo.
- `bun run typecheck`: type checks.
- `bun run levelcheck`: checks every level, writes `tests/fixtures/level-checks.json`.
- `bun test <file>`: one unit test file under `tests/`. One file at a time.
- `PORT=<port> [HOST=<host>] bun tools/serve.ts [folder]`: serves a built folder, default `dist/`.
- `BASE_URL=<address> bunx playwright test`: browser tests against a served build. `BASE_URL` ends with a slash.

## Build settings

- `TC_COUNTS_ADDRESS`: the count service's https address, read at build time. Unset, counts stay in the save, MEAS-03.
- The build refuses an output folder holding files but no earlier build.

## Built files

- `index.html`: the page.
- `sw.js`: the service worker, offline play, APP-03.
- `assets/`: scripts, styles, font, sounds, each name carrying its content hash.

Every URL to the game's own files is relative. The same folder works at a site root or under a path.

## Test server

`tools/serve.ts` answers as a static host does:

- `index.html` and `sw.js`: `Cache-Control: no-cache`, at any depth.
- A folder without its trailing slash: 301 to the folder with it, query kept.
- A path outside the folder: 403. No such file: 404.

## GitHub Pages workflow

`.github/workflows/pages.yml`:

- Runs on each push to `staging`, and on Run workflow.
- Build job: Bun 1.4.2, `bun install --frozen-lockfile`, `bun tools/build.ts`, uploads `dist/`.
- Deploy job: after build, environment `github-pages`.
- Address: https://handsomeshan111.github.io/transmission-control/.

Steps to publish: [How to publish on GitHub Pages](how-to-publish.md).
