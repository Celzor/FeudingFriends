# Feuding Friends

A loud, purple, multiplayer family quiz: one host, two or more teams, hidden answers, silly sound effects, and seven-segment scoreboards.

## Develop

Use **Node 24 LTS** (`.nvmrc`) and npm. From the repository root:

```sh
npm ci
npm run dev
```

The client uses port 3011 and proxies Socket.IO to the server on 3010. `npm run dev` prepares the question data and starts both processes. No database, Redis, account credentials, or external fonts are required. Node 18, Yarn, webpack, nodemon and ts-node have been replaced with Node 24, npm workspaces, Vite and tsx. Dependency versions are locked in `package-lock.json`; use `npm ci` in CI and deployments.

```sh
npm run build       # generate data, type-check/build React, compile the server
npm run typecheck
npm test            # real referee permission, timer, scoring and state tests
npx playwright install --with-deps chromium
npm run test:e2e    # full game, responsive layout, and multi-frame Refract integration
npm audit
```

On a machine with an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` instead of downloading Playwright's browser. Tests start their own services if absent. Use the existing cloud checkout; tasks already run in isolated environments.

## Host with Docker

```sh
docker compose up -d --build
```

Run that command from the repository folder. Open **http://localhost:3011** on the server, or **http://YOUR-SERVER-IP:3011** from another device. Everyone joins through the same address. No `.env` file, database, or extra services are needed for direct hosting.

To use another port, for example **8080**:

```sh
HOST_PORT=8080 docker compose up -d --build
```

For a permanent setting, copy `.env.example` to `.env` and set `HOST_PORT=8080`, then run the usual Compose command. Allow the chosen TCP port through the server's firewall. Use `docker compose logs -f app` to view logs and `docker compose down` to stop the game. To update after pulling new code, run `docker compose up -d --build` again.

The container serves the built client and Socket.IO together and restarts automatically unless explicitly stopped. It runs compiled JavaScript as the unprivileged `node` user, includes a health check, and handles termination signals. For a public HTTPS address, place it behind a reverse proxy with WebSocket upgrades enabled and set `PUBLIC_ORIGIN=https://feud.example.com`. Example proxy and Refract settings are in `.env.example` and `docker-compose.override.yml.example`.

For a direct image deployment:

```sh
docker build -t feuding-friends .
docker run --init --rm -p 3011:3010 -e PUBLIC_ORIGIN=https://feud.example.com feuding-friends
```

`PORT` defaults to 3010 inside the container. `SERVER_PORT` remains supported. `/health` returns JSON `"ok"`. The runtime contains only the build output, question CSVs, and production dependencies; source code, tests, `.env` files, caches and Git metadata are excluded.

Behind a corporate TLS-inspecting proxy, pass the existing proxy build arguments and an optional CA file as a BuildKit secret (`--secret id=build_ca,src=/path/to/trusted-ca.pem`). The CA is used only for dependency installation and is never copied into the image. TLS and npm integrity verification stay enabled. The usual build needs no secret.

**Hosting limits:** games are kept in memory in a single process. Restarting a container loses active lobbies. Use one replica; scaling to multiple replicas requires a shared game store and Socket.IO adapter. Temporary Socket.IO disconnects can recover for up to two minutes; reloads that create a new identity require rejoining. Join during the lobby, before the host begins.

## Deploy in Refract

The integration follows the public `refract-activity/1` contract used by [Celzor/refract-tack-toe](https://github.com/Celzor/refract-tack-toe), reviewed at commit `20936d36be91526c1ebf751205050f7b5fbe9184`.

```sh
npm ci
npm run build
```

Deploy **only `client/dist/`** to any static HTTPS host (including a repository subpath). Configure that URL as the activity URL in Refract using the same activity-launch mechanism as Refract Tack Toe. The build uses relative asset paths, bundles its fonts, and includes generated question pools. No SDK checkout, backend service, Refract token, or Socket.IO connection is needed in an activity frame. The activity sends `ready` to the framing window, receives `init`, and uses targeted `broadcast` messages for synchronization. Leave activity sends `close` to Refract.

The Docker-hosted URL can also be used as an activity. Set `REFRACT_FRAME_ANCESTORS` to the exact Refract instance origin, e.g. `"'self' https://chat.example.com"`, so the server's Content Security Policy permits the frame. Static hosting must similarly allow Refract to frame the activity and must not add `X-Frame-Options: DENY` or `SAMEORIGIN`.

### Permissions and synchronization

- Standalone: the Node server is the referee. Host actions require the lobby's actual host socket; players can buzz only for their own assigned team, in the correct state. Questions, answers, teams, limits and transitions are validated. Answer and score data are redacted separately for every recipient, including action acknowledgments. Clients cannot submit authoritative scores, players or question content.
- Refract: the first roster participant coordinates the shared referee and hosts the lobby. Other participants automatically join teams. The browser checks message source, pins the validated parent origin, and scopes every message to the session, host and ordered roster. Sender identity comes from Refract's relay. A participant cannot acquire host permissions by changing a payload.
- In Refract, ordinary membership changes keep the running game; new arrivals during play watch until the next lobby. Host departure elects the first remaining participant and starts a **fresh lobby**. Host reload also starts a fresh lobby. There is no durable in-call history. Periodic targeted synchronization recovers missed updates. Large snapshots are split below Refract's 16 KiB message limit and bounded during reassembly; duplicate action IDs are deduplicated.
- Refract is a cooperative browser-hosted game, like the reference project. The coordinating browser is trusted; it is not an anti-cheat service. Static question data is downloadable. Use standalone server hosting when you need a separate referee.

The Refract browser test uses a local three-frame relay matching the reference protocol. A live call in your Refract instance still needs a deployment check; local simulation does not prove the host application's launcher or policies.

## Game changes

Enable **Lightning Round** in the lobby. Each new game randomly selects **Catch the buzzer**, **Whack the buzzer**, or **Wait for green**. Players use touch, mouse or keyboard; the first valid buzz wins control. The referee checks the start time and target, and later buzzes cannot overwrite the winner. The host adjudicates spoken answers. A wrong answer passes control to another team; once all teams have tried, the round reveals the board even if nobody answered correctly.

After lightning ends, **all lightning answers stay on screen for everyone**. The host chooses **Continue to main game** when ready.

The host sets **Seconds per answer** (0 disables it; maximum 300). Each selected answer, including a wrong answer, resets the clock. The clock grows and shifts from green through amber to red as time runs out. The referee handles expiry even when the host tab is idle: a timeout counts as a wrong answer, three wrong answers open a steal, and a failed steal ends the round. Lightning answer turns also use this timer; the chase itself waits for a valid buzz.

Main rounds finish when at least 60% of answers have been selected (rounded up), or after a steal attempt. The round winner receives the selected board's total points. The selected round count and optional winning score determine the finish.

The purple stage, yellow trims, chunky buttons, original sounds and scoreboards remain. Layouts now fit mobile screens, inputs have readable contrast and labels, keyboard focus is visible, fonts load locally, and reduced-motion preferences are respected.

## Question data

See [question sources and review](server/data/SOURCES.md) for the cleaned bank, correction rules, and upstream import status. `npm run generate` creates the Refract copy from the same CSVs the server reads. `npm test` validates all boards and confirms that both versions match. Fast Money gameplay is excluded.
