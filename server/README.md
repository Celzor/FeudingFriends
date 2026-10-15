# Server

See the [root README](../readme.md) for development and Docker deployment.

Use Node 24. From the repository root run `npm ci`, then `npm run dev`. The compiled server starts with `npm start` after `npm run build`.

The shared game referee lives in `shared/`. The standalone transport enforces host/player permissions, request limits, origin checks, answer redaction and timers. No Redis instance is required. State is in memory; restarting the server ends its games.
