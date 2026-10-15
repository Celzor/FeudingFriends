# Browser checks

From the repository root: `npm run test:e2e` after `npm ci` and `npx playwright install --with-deps chromium`.

The suite starts the server and Vite client, completes a multiplayer lightning/main game, checks timer resets and revealed answers, checks the mobile viewport, and exercises Refract's multi-frame parent relay and host permissions. Failure traces and screenshots are retained under `client/output/results/`.

The referee's isolated permission, timer and scoring tests run with `npm test` from the root.
