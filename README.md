# Velocity Rally

A browser arcade rally game about learning a road and finding another second. Built with Three.js and a shared fixed-step simulation used both in the browser and by the competition server.

## Run locally

Requires Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:8080**. For a production build:

```sh
npm run build
npm start
```

The built client bundles its dependencies and assets; it does not import Three.js from a public CDN. Open the game through the server, rather than by double-clicking `index.html`.

## What you can play

- Four authored campaign stages: Fern Valley, Amber Ridge, Mosswater, and Blue Hour. Earn bronze to open the next road.
- First Tracks driving school, with guidance on throttle, braking, corner exit, and gravel.
- Three arcade handling profiles: forgiving Scout, balanced Comet, and playful Lynx.
- Gold/silver/bronze targets, sector splits, comparison to your previous best, and instant course-preserving retries.
- Personal-best ghosts per course, car, and physics version. Campaign progress, records, preferences, and cosmetic liveries save on the current browser/device. A storage failure falls back to session-only play.
- A date-seeded daily course with a fixed Comet and fixed conditions. The date rolls over at **00:00 UTC**. The date is shown in the menu. Local car/graphics/livery choices cannot change the competitive physics.
- Server-verified top-ten boards, optional run submission, shareable stage/ghost links, and cyan rival ghosts. Gold personal ghosts remain separate from rival ghosts.
- Chase, close, and hood cameras; headlights; readable surface changes; minimap; damage feedback; synthesized audio; optional spoken notes; low/medium/high graphics; and touch controls on touch devices.

There is deliberately no boost button. Skill, braking, and car control determine your time. Recoveries cost five seconds. Pauses and background-tab time are excluded. A long frame stall pauses the race rather than discarding time while continuing competition.

## Controls

| Action | Keyboard | Standard controller |
|---|---|---|
| Accelerate | W / Up | RT |
| Brake | S / Down | LT |
| Steer | A/D / Left/Right | Left stick / D-pad |
| Handbrake | Space | A |
| Deliberate reverse | B | LB |
| Recover to last crossed gate (+5 s) | R | Y / Back |
| Retry same course | T | Pause menu |
| Camera | C | X |
| Headlights | H | B |
| Pause/resume | P / Escape | Start |

The pause menu also provides recover, retry, and stage selection. Touch players use on-screen steering, throttle, brake, and handbrake; recovery is available in the pause menu. Losing browser focus clears inputs and pauses the race.

## Competition server

`server/index.js` serves the built client and the leaderboard/replay API. It binds to loopback by default. Environment variables:

- `PORT`: default `8080`.
- `HOST`: default `127.0.0.1`; use `0.0.0.0` only when intentionally hosting for other players.
- `RALLY_DATA_DIR`: default `server/data`. Persist this directory when deploying.

An explicit submission sends driver name, stage/car, claimed time, physics version, and a run-length encoded input recording to this server. The server simulates those inputs in a worker, checks every ordered gate and the exact finish time, enforces the daily car, and generates ghost frames itself. It rejects malformed or excessive inputs, tampered times, and unfinished runs. It saves top-ten results per course/car in an atomic JSON file. Daily boards older than 14 days are pruned. Slower runs outside the top ten are verified but not retained. Ghost links only work while the run remains on its board.

Driver names are **not authenticated**. Replay verification prevents fabricated times, but does not prevent bots, input assistance, or duplicate names. This is a single-process, small-community backend, not an esports anti-cheat system. It rate-limits submissions, bounds payload size, and limits replay worker concurrency. Public production hosting still needs an HTTPS reverse proxy, persistent data storage, backups, and a hosting destination. No deployment or external analytics is configured.

If the API is unavailable, campaign play and local ghosts still work once the client is loaded. This is not a service-worker/PWA offline installation.

## Validation

```sh
npm test
npm run build
```

The regression suite checks frame-rate independence, braking/reverse/steering, deterministic daily tracks, continuous road contact, recovery penalties, ordered finish validation, all five routes with all three handling profiles, input edges, storage/progression, replay integrity, and HTTP submission/ghost/persistence behavior. HTTP tests use a temporary data directory, never the player's board.

`PLAYTEST.md` provides a structured first playtest. Medal targets are initial values calibrated against automated route-following runs; real-player feedback should drive further tuning. Browser/UI checks do not establish audible quality, physical gamepad compatibility, Safari support, or performance on low-end hardware.

## Main modules

- `Stages.js`: authored route blocks, daily rules, car profiles, medals, liveries, physics version.
- `Course.js`: deterministic course geometry, surface zones, continuous projection, corner events, gates.
- `Simulation.js`: shared 60 Hz driving/race rules and fixed clock.
- `Game.js`: menus, scene, race lifecycle, feedback, ghosts, and competition client.
- `Progress.js`, `Ghost.js`: per-device records/progression and interpolated ghost playback/input encoding.
- `Track.js`, `Vehicle.js`, `Textures.js`, `Camera.js`, `Effects.js`, `AudioEngine.js`, `HUD.js`: presentation.
- `server/`: competition API, persistence, and authoritative replay validation.

Bump `RULES_VERSION` whenever handling or course geometry changes, so new records are not compared against incompatible ghosts.
# Velocity_Rally
