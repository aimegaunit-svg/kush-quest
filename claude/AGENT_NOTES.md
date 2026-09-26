# AGENT_NOTES

## Correction + status update (main session, after this landed)
`public/drive.js` now exists — the main session built it (commit 7d02668), on top of this file's
`transit.js` framework, since it turned out nothing had actually landed for it despite what
`PLAN.md` said. See `Drive.needsDrive`/`Drive.start` in `public/drive.js` for its contract; it
follows the same `net`/`makeSwapPool`/`makeNet` conventions as the 5 games below.

The server relay this file's authors correctly flagged as missing is now added: `server.js`
`case 'd':` in `handle()`, relaying `{t:'d', k, p, to?}` to the room (or unicast if `to` is set),
tagging the sender id. Both `drive.js` and the 5 transit games below can rely on it now.

**Still open, not yet done by the main session:** a real Playwright click-through of the 5
transit games' `*-test.html` pages (only `drive-test.html` has been verified end-to-end so far),
and wiring the online relay's incoming messages into each game's `net._deliver()` in the test
pages / eventually in `game.js`'s own socket handler once these are hooked into the real map.

## Owned by the transit-games agent

**Scope:** Part B3 of brief v1.1 — 5 transit mini-games + shared framework.

**Status: complete.**

Files added (all new, nothing existing touched):
- `public/transit.js` — shared IIFE framework (`window.Transit`): canvas setup at the game's
  native 320x192 base resolution with the same integer-ish auto-scale convention as the main
  game, `assignSeats(crew, roles)` for 1-4 player role scaling, `showInstructionCard` (skippable
  first-time tutorial card, auto-skips on replay via a save flag), `makeSwapPool` +
  `makeSwapRunner` (per-game no-repeat-until-exhausted swap-event pool, banner + freeze +
  authority-handoff hook), `makeResultsScreen` (awards/coins/score screen), `tone`/`noise`
  WebAudio helpers, and `makeNet` (thin wrapper around the `net.send` contract below).
- `public/lazyriver.js` + `public/lazyriver-test.html` — LAZY RIVER (Park→Beach). Tank/paddle
  controls (A/D = left/right paddle, no direct steering), momentum+angular-velocity physics,
  rocks/swans/whirlpools, waterfall finish. Swap event: CAPSIZE.
- `public/paperplane.js` + `public/paperplane-test.html` — PAPER PLANE (Beach→Suburbia). One-button
  glide physics (hold=dive/gain speed, release=climb/gain height), wet-paper weight mechanic,
  updrafts/gusts, wing-walker lean (extra crew), pelican-grab rescue. Swap event: GUST.
- `public/munchietruck.js` + `public/munchietruck-test.html` — MUNCHIE TRUCK (Suburbia→Downtown).
  Top-down drift driving (WASD/arrows + SHIFT/SPACE handbrake) for the driver, mouse-aimed
  snack-throwing with color/shape match-to-customer scoring for the rest of the crew, HOA
  security carts as a speed hazard. Swap event: BRAIN FREEZE.
- `public/smokeballoon.js` + `public/smokeballoon-test.html` — SMOKE BALLOON (Downtown→Woods).
  Altitude-only rhythm controls: shared lung meter fed by on-beat taps split across up to 4
  color lanes, sandbag drop for a quick climb, chopper-searchlight Heat mechanic forcing descent
  at 100%. Swap event: HICCUPS (shuffles lane assignment).
- `public/bongrocket.js` + `public/bongrocket-test.html` — BONG ROCKET (Woods→HQ, finale). Free
  8-direction 2D flight with momentum for the pilot (the only free-flight game in the set),
  independent mouse-aimed 360° turret(s) for gunners, fuel burned by boosting/collected from
  bubbles, drones/satellites + a mini-boss wave before docking. Accepts an `astral: true` flag
  (currently only tints the background/palette) as the explicit hook for the later, harder/
  trippier Astral Plane reuse of this same file — not built out yet, intentionally, per the brief.
  Swap event: ZERO-G.

**Shared contract every game follows** (mirrors the `<Game>.start({...})` / `onDone({...})`
shape the brief specified, modeled on the drive-agent's pattern from the plan since no
`public/drive.js`/`drive-test.html` actually exists yet in this checkout — see note below):

```
window.<Game>.start({
  from, to, world,          // level-transition context, passed straight through to onDone
  crew,                      // int 1-4, or array of {id,name,color} in join order
  save,                      // host game's save object; each game reads/writes its own seen-flag
  net,                       // null for solo, or { id, hostId, send: o => ... } for online
  onDone,                    // callback: onDone({ coins, score, awards, ...game-specific })
  mount,                     // DOM element to mount the canvas into (defaults to document.body)
  scale                      // integer canvas scale factor, default 3 (960x576 @320x192 base)
})
```
Returns `{ cleanup() }` to tear down listeners/rAF if the host page navigates away early.

**Online authority model:** whichever seat is "driving" (paddle/pilot/driver/etc., always
`seats[0]` from `Transit.assignSeats`) runs the simulation when `net.hostId === net.id`, and
broadcasts `{type:'state', ...}` ~10x/sec (every 0.1s) over `net.send`. Everyone else sends
`{type:'input', ...}` every frame and applies incoming state snapshots directly (no client-side
prediction — acceptable for 60-90s mini-games). A mid-game swap event freezes for ~1.3s, shows a
banner via `Transit.makeSwapRunner`, and at the freeze midpoint calls the game's own `onReseat()`
which rotates `seats` (`seats.push(seats.shift())`) so the seat that was authority hands off to
the next one — this reassigns who simulates/broadcasts without any special-case network code,
since seat 0 is always re-evaluated against `net.id`/`net.hostId` every frame.

**Wire format:** every game wraps its messages as `net.send({ t: 'd', k: '<gk>', p: payload, to })`
via `Transit.makeNet`, where `<gk>` is a 2-letter game key (`lr`,`pp`,`mt`,`sb`,`br`). This is
designed to reuse `server.js`'s documented `case 'd':` relay for `{t:'d', k, p, to?}` messages
(broadcast to the room, or unicast if `to` is set) — **I did not find that relay in the current
`server.js`**, and did not add it, since server.js is explicitly off-limits for this agent. The
`*-test.html` pages currently only exercise solo and local-multi-seat-simulation (`startCrew(n)`
against `net: null`) for that reason — the online 2-4 tab path against a live `server.js` needs
either (a) that relay to exist, or (b) the main session's own websocket message router to call
`Transit`'s `net._deliver(fromId, payload)` for messages keyed by `k`. Flagging this clearly
rather than guessing at server.js's message shape and touching a file I was told not to touch.

**On `public/drive.js`:** the brief said to use it as the reference pattern ("Hotbox Highway").
It does not exist in this checkout (`public/` only had `game.js`, `index.html` before this PR).
`PLAN.md` describes it as already built by a separate chat/session but it evidently hasn't landed
in this repo yet. I designed `transit.js`'s contract shape directly from the brief's own spec
(seat scaling, swap-event freeze+handoff, results/awards screen, instruction card, `net`
shape) rather than by reading that file. If `drive.js` lands later with a different `net`/handoff
convention, `transit.js`'s `makeNet`/swap-runner API is the one seam to reconcile — everything
else in the 5 games is independent of it.

**New save fields the host game should read/write** (all booleans, default falsy/unset = show
the intro card once):
- `save.seenLazyRiver`
- `save.seenPaperPlane`
- `save.seenMunchieTruck`
- `save.seenSmokeBalloon`
- `save.seenBongRocket`

Each game also calls `save.__persist()` if that function exists on the save object, after
marking its seen-flag — harmless no-op if the host save object doesn't define one.

**Files touched:** only new files under `public/` (`transit.js`, `lazyriver.js`, `paperplane.js`,
`munchietruck.js`, `smokeballoon.js`, `bongrocket.js`, and one `*-test.html` per game) plus this
`claude/AGENT_NOTES.md` entry. `public/game.js`, `public/index.html`, `server.js` and
`public/drive.js`/`drive-test.html` were not touched (the latter two don't exist yet in this repo).

**Testing done:** `node -c` syntax-checked all 6 `.js` files (all pass). Reviewed each game's
physics/input/swap-event/results logic by inspection for the described control scheme, solo vs.
multi-seat branching, and the swap-event no-repeat pool + freeze/reseat/resume sequence. Did not
have a headless-browser tool available in this environment to click through the `*-test.html`
pages end-to-end or exercise the live 2-4 tab online path against `server.js` — that pass (and
wiring the `t:'d'` relay/router once it exists) is the one remaining piece, called out above.

**What's left / not done:**
1. Live browser (Playwright or similar) click-through of all 5 `*-test.html` pages, solo and
   multi-seat-simulated, to catch runtime console errors/softlocks that static review can't.
2. The actual online 2-4 tab path needs `server.js`'s `t:'d'` relay (or equivalent) to exist and
   the test pages need a small amount of socket-wiring glue connecting incoming relayed messages
   to each game's `net._deliver(fromId, payload)` — currently `net` is untested end-to-end because
   there is no live relay in this checkout to test against yet.
3. Hook-up into the world-select map / `game.js` transition points is explicitly the main
   session's job (per `PLAN.md` §6), not done here.
