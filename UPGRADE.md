# Velocity Rally v2 — implemented 7 October 2026

The original random-road prototype is now a small arcade rally campaign with repeatable stages, progression, ghosts, and a shared daily competition.

## Delivered

- Replaced frame-dependent driving with a shared 60 Hz simulation and interpolated rendering. Long stalls and lost focus pause the race.
- Corrected steering and braking; added deliberately selected, capped reverse; removed broken nitro.
- Added ordered gate validation, five-second recoveries, accurate active race timing, true distance/time average speed, and synchronized vehicle resets.
- Replaced random roads with four designed campaign routes and a training route. Continuous road projection supplies position/height/contact. Road textures, grip, audio, signs, and pace notes use coherent surface/corner data.
- Added three handling profiles, instant retries on the same road, medals, stage unlocks, saved progress, cosmetic liveries, best ghosts, and sector comparisons.
- Added a daily seeded route with fixed car and conditions; shareable course/replay links; optional rival ghosts; and a persistent top-ten API that re-simulates recorded inputs before accepting scores.
- Redesigned menus/HUD, reduced view obstruction, brightened the car, improved portrait chase-camera distance, added graphics/volume/voice/ghost settings, touch input, and keyboard focus handling.
- Added a reproducible npm setup and production bundles containing Three.js/assets, a README, and a human playtest worksheet.

## Validation completed

`npm test`: 19 checks passed. Coverage includes a full actual Game race lifecycle (with presentation/DOM stubs), input recording and server verification, finish results, unlocks, course-preserving retries, frame-rate equivalence at 30/60/120 FPS, braking/reverse/steering, daily rules, continuous road projection, recoveries, ordered gates, storage fallback, API integrity, ghost retrieval, and server persistence after restart.

Automated route followers finished all five routes in each of the three handling profiles. Medal targets were initially calibrated against these runs. This proves route feasibility, not that the handling is fun for real players.

`npm run build`: production client built successfully, with separate game, Three.js core, and effects chunks.

Browser inspection of the production build verified scene loading, the campaign menu/locks, daily date and fixed-car UI, school entry, pause, recovery feedback and penalty, stage selection, and a 390 px phone layout without horizontal document overflow. A desktop production screenshot is saved at `artifacts/menu.png`. Earlier audit browser cache data was bypassed when switching from the old direct-file build to the bundled version.

## Remaining real-world work

- Recruit and observe the 8–12 testers described in PLAYTEST.md, then tune handling, targets, and onboarding from their behavior. No recruitment or real-player retention results are claimed.
- Choose a public hosting destination and deploy the provided backend with HTTPS and persistent storage. The current server is local only; there is no public release.
- Verify audio by listening, physical gamepads/touch hardware, Safari/Firefox, and performance on target devices. Spoken notes depend on available browser voices.
- Public competitive use would benefit from authenticated player identities and stronger abuse controls. The current boards explicitly identify names as unauthenticated. Server replay checks reject fabricated times but cannot distinguish human input from bots.

The deliberately deferred features remain deferred: synchronous multiplayer, open world, a large garage, monetization, and photorealism. The playable core now supports testing the “one more run” loop before expanding that scope.
