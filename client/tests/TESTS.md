# Browser checks

From the repository root: `npm run test:e2e` after `npm ci` and `npx playwright install --with-deps chromium`.

The suite starts the server and Vite client, completes a multiplayer lightning/main game, checks timer resets and revealed answers, checks the mobile viewport, and exercises Refract's multi-frame parent relay and host permissions. Failure traces and screenshots are retained under `client/output/results/`.

Run `npm run test:pages` from the repository root to build the production Refract activity and serve it under `/FeudingFriends/`, matching GitHub Pages. This test runs without the Node game server. It checks the **Play in Refract** landing page and exercises the activity inside the local Refract relay using the built assets and question data. Failure artifacts are retained under `client/output/pages-results/`.

The relay checks the integration contract locally. A real call in the deployed Refract application remains a manual deployment check.

The referee's isolated permission, timer and scoring tests run with `npm test` from the root.

The multiplayer flow also checks the two-column desktop board and stacked boards at 760px and 390px, countdown containment, and page overflow. It checks actual decoded audio readiness, sound/answer-animation timing, original victory-music playback and stop, and celebration overlays. Desktop/mobile round and finale screenshots are saved in `client/output/`.
