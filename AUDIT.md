# Velocity Rally audit — 7 October 2026

> Historical pre-upgrade findings. The v2 implementation and validation status are documented in [UPGRADE.md](UPGRADE.md), with run instructions in [README.md](README.md).

## Verdict

This is a promising scenic driving prototype with a thin time-trial layer. It has a recognizable look and useful building blocks, but its timing, controls, track identity, and feedback currently prevent fair mastery. There is no developed reason to return after finishing a run. The best next step is a small, polished arcade rally time-trial game.

This assessment combines source review of all gameplay modules, a localhost browser launch and short UI inspection, and isolated execution of actual vehicle/input/race logic. It is not a completed human stage playthrough, a hardware performance benchmark, an audio listening review, or a physical controller test. No game code was changed.

## What is worth keeping

- The forest setting, fog, shadows, stage gates, teal car, and warm cream/terracotta interface give the prototype a recognizable identity. The browser successfully rendered the scene and entered the race flow without captured warning/error logs during the short inspection.
- There are already three camera implementations, an automatic gearbox, handbrake grip reduction, surface-sensitive forces, headlights, speed/gear/time displays, minimap, dust, and impact feedback.
- Checkpoint recovery and a stuck hint are good foundations for keeping beginners playing.
- Controller polling supports analog pedals and steering, button edges, hot-plug events, and rumble. These are implemented, but not verified on hardware.
- Procedural audio contains engine, skid, rolling, wind, impact, shift, and checkpoint layers. Its audible quality remains unverified.
- Code is small and separated into workable modules. This does not require an engine rewrite to make substantial progress.

## Problems, ordered by priority

| Priority | Finding and evidence | Player consequence | Recommended correction |
|---|---|---|---|
| Critical | `Game.animate()` always advances by 1/60 s per animation frame (`js/Game.js:403–406`). In a straight, flat, tarmac harness, 10 real seconds at 30/60/120 rendered FPS moved the car about 163/382/829 m. Race time uses `performance.now()`. | Different devices get different car performance and countdown duration. Times cannot be compared fairly. | Use elapsed wall time with a fixed simulation step and bounded catch-up; interpolate rendering. Audit camera smoothing and particle emission for frame dependence too. |
| Critical | Brake subtracts a constant forward force without stopping at zero (`js/Vehicle.js:217–220`). From rest, one second of brake reached about 153 km/h backward in the isolated harness. | Braking and handbraking can become reverse propulsion. | Apply braking against signed velocity and clamp through zero; implement deliberate, limited reverse separately. |
| Critical | The nitro multiplier applies whenever charge is above zero, regardless of whether boost is pressed (`js/Vehicle.js:213–215`). One second of throttle reached 93.45 km/h with no boost, versus 82.47 with boost held in the same harness. | The boost button drains an always-active benefit and makes the car slower. | Decide whether boost belongs in this game; remove it or gate extra force on active boost. |
| High | Keyboard left produces positive yaw, turning the forward +Z direction toward +X; the car therefore turns right. Controller stick and D-pad feed the same sign convention (`Vehicle.js:157–159, 240–242`; `Gamepad.js:51–55`). | Steering is opposite to the intended direction in world coordinates. | Correct signs consistently and verify keyboard, stick, and D-pad in every camera. |
| High | Pause/resume never adjusts `startTime` (`Game.js:156–174`). A simulated 1 s race plus 5 s pause returned 6 s elapsed. | Pausing punishes the player's result. | Track active race time explicitly. Pause/mute race audio and handle page visibility changes. |
| High | Restart reloads the page, track generation uses unseeded `Math.random()`, and all courses share `velocity_rally_best_ms`. | “Try Again” changes the challenge; a best time may belong to an easier course. Players cannot practice the same corners. | Keep the current course on retry; use stable course seeds/IDs and versioned per-course records. Separate “new random stage” from retry. |
| High | Surface physics changes every approximately 12.5 m between tarmac/gravel/mud, but the full road renders as asphalt (`Track.js:27–41, 118–121`). | Grip changes have no matching visual explanation. | Define longer deliberate surface zones, and use the same data for road appearance, physics, audio, and notes. |
| High | Course generation is a smoothed random walk, with no explicit corner, crest, jump, or difficulty design. Ride height follows sparse control points every ~62.5 m; there is no airborne/gravity/suspension simulation (`Track.js:439–449`; `Vehicle.js:264–267`). | The advertised rally variety is not reliably produced, and elevation contact can disagree with the rendered road. | Author a compact first course with clear corner sequences. Project onto the continuous road for contact; add simple suspension/jumps only if useful to the chosen handling style. |
| Medium | P/C repeat events re-arm toggles after they are consumed; keyup can erase a pending toggle. No blur reset or visibility handling exists. X is mapped to both boost and camera. | Holding a key can repeatedly pause/switch views; quick taps can be lost; focus loss can retain driving input; controller X has conflicting actions. | Separate held state from one-shot events, ignore repeat, clear controls on blur, and assign unique controller buttons. |
| Medium | “Avg Speed” displays finish speed (`Game.js:383`). Damage affects power but has no live display. Finish checks only proximity to the endpoint, rather than ordered gate completion. Reset doesn't immediately synchronize all visual/mechanical state. | Results and recovery are less trustworthy, especially on future folding/crossing courses. | Integrate real distance/active time for average speed; expose relevant damage feedback; validate ordered gates and finish crossing; reset all intended state consistently. |
| Medium | Pace notes choose the largest heading difference at one of four fixed lookahead distances. No voice callouts or persistent corner IDs exist. | Notes can shift between corners and don't precisely identify corner entry or its actual distance. | Generate named corner events, call them once at speed-aware lead times, and show a clear next-corner cue. |

The numerical vehicle checks used the actual `Vehicle.update()` with rendered model construction stubbed out, a flat tarmac track, 1/60 s updates, and no collisions. They demonstrate logic faults; they are not measured speeds from a normal stage run.

## Design diagnosis

The current loop is: start → drive a random road → see a time → reload into a different road. There are no medals, ghost, split comparisons, course collection, campaign progress, distinct car handling choices, or shared challenges. Random scenery supplies novelty, but restarting does not produce a clear opportunity to learn and improve.

Handling currently rotates the car at an input-driven yaw rate and damps lateral velocity. Body roll/pitch is mostly visual; it is not a weight-transfer model. An accessible arcade model is suitable, but it needs predictable braking, a controllable grip limit, useful throttle steering, and an intentional difference between clean grip driving and a slower/wider slide. Complex real-world tire simulation is unnecessary for this first release.

Visual inspection showed a very dark car against a bright environment, a large HUD, repeating geometric trees, and sparse landmarks. Improve readability and composition before adding expensive visual effects. The warm interface can become part of a deliberate vintage rally identity; the “Pro Simulation” title currently promises more realism than the mechanics support.

## Upgrade sequence and acceptance gates

### 1. Make one run trustworthy

Fix time stepping, steering, braking, boost, pause, input edges, retry identity, surface readability, and road contact. Add basic volume and graphics settings, clear race loading/error states, focus handling, and accurate results. Keep the existing browser/Three.js architecture.

Gate: the same recorded input on the same course behaves consistently at 30/60/120 render FPS; brakes stop the car; pause adds no race time; retry preserves the course; left/right work on all input methods; the finish requires valid progress.

### 2. Make one course worth repeating

Create one memorable 60–120 second stage with an opening that teaches braking, a satisfying linked-corner section, one clear surface transition, recognizable landmarks, and a legible finish. Tune a single car until corner entry, grip loss, recovery, and handbrake turns are readable. Add an instant retry, bronze/silver/gold targets, a personal-best ghost, and sector deltas.

Record ghost position/orientation against simulation time to avoid depending on perfect input replay. Store records with course ID, vehicle rules, and physics version.

Gate: new testers understand a mistake, intentionally improve it, and choose another attempt without prompting. Observe roughly 8–12 people, including newcomers and racing players; their behavior matters more than feature count.

### 3. Add a small game around that course

Expand to 3–5 deliberately different stages and 2–3 handling profiles, introduce a short tutorial and medal-based progression, save campaign progress, and offer cosmetic liveries. Show the next attainable target after each result. Avoid mandatory grind or raw-power upgrades that invalidate comparable times.

Gate: players can explain what is different about the next stage/car and return to improve a result. Measure start-to-finish rate, voluntary retries, personal-best improvement, later return visits, and where players quit. Get consent for any deployed analytics.

### 4. Give people a reason to return together

Add a daily seeded challenge, shareable course seed/result, friend ghosts, and leaderboards only after race validation is reliable. A daily event should give everyone the same course, car, physics version, and conditions. Validate submissions on a server; client-editable localStorage is fine for personal records, not public competitive ranking.

Trackmania's official documentation describes fixed campaigns with medal targets and a curated Track of the Day. These are useful reference patterns, not evidence that copying them guarantees retention:
- https://doc.trackmania.com/play/what-is-a-seasonal-campaign/
- https://doc.trackmania.com/play/what-is-totd/

## What to defer

Real-time multiplayer, open-world driving, huge garages, monetization systems, advanced tire simulation, photorealistic assets, and additional heavy post-processing should wait until people voluntarily replay the first course. Ghost competition provides a useful social challenge at substantially smaller scope than synchronized racing.

## Technical and release limits

The README is stale: it says particles are absent despite `Effects.js`, and claims direct-file execution and 60 FPS without demonstrated browser/device coverage. Native module loading from `file://` should not be the distribution promise. Serve the game over HTTP, vendor/bundle the pinned dependency for reliable distribution, and document the actual controls and implemented features.

The renderer enables DPR up to 2, shadows, multisampled half-float post-processing, and bloom without a player quality setting. Instanced scenery is a good start, but performance must be profiled on actual target devices. There are no touch controls, so mobile play is not currently supported as an input experience. This audit does not establish Safari/Firefox support, audio quality, controller compatibility, or a performance target.

**Recommended first milestone:** one fair, readable, instantly replayable stage with a satisfying car, medal targets, a personal-best ghost, and trustworthy timing. Demonstrate that people want another run before expanding content.
