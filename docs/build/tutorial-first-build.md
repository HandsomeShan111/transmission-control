# Tutorial: build and play

Builders new to the repo: build the game, serve it as GitHub Pages does, play the opening, run one test.
Needs Bun. Commands run from the repo root.

## Steps

1. Install the packages: `bun install`.
2. Build into a folder named as on GitHub Pages: `bun tools/build.ts dist-pages/transmission-control`.
3. Serve it on a free port: `PORT=8080 bun tools/serve.ts dist-pages`.
4. Open `/transmission-control/` on that port in a browser. The title screen shows the game's name.
5. Press it. Act 1's card shows: its name and its situation.
6. Press the card. Level 1 opens.
7. Reload the page. The title screen shows again, then Act 1's card, while level 1 stays unwon.
8. Stop the server. Run the campaign tests: `bun test ./tests/core/progress.test.ts`.

## Next

- Publish: [How to publish on GitHub Pages](how-to-publish.md).
- Commands and files: [Reference: build and hosting](reference-build.md).
- Why the build works under any path: [Explanation: one build for every address](explanation-hosting.md).
- Opening rules: APP-01, CAMP-05.
