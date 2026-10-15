# Client

See the [root README](../readme.md) for development commands and the two deployments: GitHub Pages serves the activity launched through Refract; Docker serves the complete standalone website and game server.

Use Node 24. From the repository root run `npm ci`, then `npm run dev`.

- `npm run build` builds the standalone client and Node game server for Docker.
- `npm run build:pages` builds only the static Refract activity into `client/dist/`. Opening this build directly shows a **Play in Refract** notice; framed activity sessions communicate through Refract.
- `npm run test:pages` tests the production activity under `/FeudingFriends/` without a Node game server.

The GitHub Pages workflow deploys on pushes to `main` or manual runs. Select **GitHub Actions** in the repository's **Settings → Pages → Source** first. The default activity URL is **https://celzor.github.io/FeudingFriends/**.
