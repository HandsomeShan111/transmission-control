# Explanation: one build for every address

GitHub Pages serves the game under `/transmission-control/`, not at a site root. itch.io and a local test server use other paths. One build serves them all, unchanged.

## Relative URLs

Every URL to the game's own files is relative: the page's scripts, styles, font and sounds, and the service worker's own address, `./sw.js`.
A relative URL resolves against the page's folder. The game then finds its files wherever the folder sits.
The folder address needs its trailing slash: without it, `./` resolves against the parent. GitHub Pages redirects to the slash; the test server does the same, and browser tests refuse a `BASE_URL` without one.

## Service worker

A service worker controls the folder it is served from, its scope. Served from `/transmission-control/sw.js`, it controls that path only.
It keeps one cache per version, named by its scope. Two copies of the game on one host, at two paths, never share or delete each other's files.
It fetches each file by its address relative to the scope, so offline play works under any path.

## Fresh page, kept assets

`index.html` and `sw.js` keep fixed names, so a host must never serve them stale: the test server sends both with `no-cache`.
Every other file carries its content hash in its name. A changed file gets a new name, so a kept copy is never wrong.
The version is a hash of the page and every asset's name. A change to the page or to any asset makes a new version, APP-04.

## Built, not raw

The repository holds TypeScript sources and build docs, not a playable page. Publishing the repository as it stands shows its README.
The Pages workflow runs the repo's own build and publishes only `dist/`. It is the only workflow that deploys to Pages: two would race, and the last to finish would win.
