# How to publish on GitHub Pages

The game publishes from HandsomeShan111/transmission-control to https://handsomeshan111.github.io/transmission-control/.
Workflow: `.github/workflows/pages.yml`.

## Once per repository

The repository owner's GitHub account does these:

1. Settings → General → Danger Zone → Change visibility: Public.
2. Settings → Pages → Build and deployment → Source: GitHub Actions.

Keep `pages.yml` the only workflow that deploys to Pages. Two would race, and the last one to finish wins.

## Publish

1. Merge the change into `staging`.
2. Push `staging` to GitHub. The push starts the Pages workflow: it builds `dist/` and deploys it.
3. Actions tab → Pages: wait for both jobs, build and deploy, to pass.
4. Open https://handsomeshan111.github.io/transmission-control/. The title screen shows.

To publish again with no new commit: Actions tab → Pages → Run workflow, branch `staging`.

## Check offline play

1. Open the address once.
2. Browser developer tools → Application → Service workers: wait until `sw.js` shows activated.
3. Network → Offline.
4. Reload. The game opens with no network.

A new version reaches a player on the visit after every page of the old one has closed, APP-04.
