# AGENT_NOTES

## v1.1 A2/A3 real-brief pass landed (parallel subagent, latest)
Closed the two specific A2/A3 gaps this file flagged after the real brief was read in full (see the
"IMPORTANT: the full BRIEF_v1.1.md text..." section below) - commit `df1fb90` on top of `24ec993`, in
its own git worktree, `public/game.js` only. Did NOT touch crew-lives/checkpoint code, WORLD_DEF/WORLDS/
buildLevel/bossDataFor/mapNodes, the A6 enemy tricks, or launchTransit/WORLD_TRANSIT_GAMES, per this
session's explicit brief.

**A2**: the `coreup` shop entry now costs coins + Resin (+1 Seed on odd target levels) following the
brief's example curve (`coreUpCost()`: Lv2=60c+10r, ~1.6x coins + 10 more Resin per level after). New
`save.coreCap` gates how high ANY core can be leveled right now - starts at 3 for new saves, rises in
`onKill()` at each world's mini-boss (`e.mini`, ->4+world) and boss (`e.mega`, ->5+world), landing on 10
after Mr. Killjoy (world index 5), never lowered. The shop just won't offer the upgrade past the cap
(LOCKED row) rather than clamping an already-higher stored core level. `onKill()` also grants +1 Seed to
the killer on a world-boss kill only (not mini-bosses or ordinary captain fights). Old saves: `loadSlot()`
seeds `coreCap` at 10 (not 3) for any save that already had `migratedV11 === true` before this pass's own
migration ran, so nobody who leveled a core past 3 under the old free/uncapped economy gets locked out.

**A3**: `ENV_WEAPONS` replaced wholesale with the brief's 12 named Wild weapons (Bong Hammer, Blunt Bat,
Rolling Papers, Nug Bombs, Dab Torch, Hacky Sack, Leaf Blower, Zippo Flick, Hookah Whip, Lava Lamp Mace,
Gravity Bong Cannon, Apple Pipe), each mechanically distinct via the existing weapon-stat shape + flags
(pierce/spin/homer/stun/burn/etc). `WILD_POOL_BY_THEME` gives each of the 6 worlds its 3-4 weapons per
the brief's table (Gravity Bong Cannon is HQ-only - no Astral Plane in this codebase); a pickup now rolls
randomly from its world's pool instead of a fixed per-theme weapon. `me.envWeapon` is now `{id, charge}`
(a Resin-backed charge bar, draining `cost` per swing) instead of `{id, uses}` - an empty weapon "clicks"
(no damage, stays held) instead of breaking/auto-dropping. New `gainResin(amt)`, called from `onKill` for
every kill the local player lands (1 regular / 3 mini-boss / 5 boss), tops up a held weapon's charge
first, banking any leftover Resin, per the brief's stated priority.

**Known gaps/simplifications** (all disclosed in the commit message too): Resin drops from enemies as an
instant grant via `gainResin()`, not a physical pickup item with network sync/animation. Seeds and the
`coreCap` raise are per-kill-credit/per-client rather than guaranteeing every co-op player their own Seed
per boss (brief's literal "1 per boss per player") - no new net sync built for that. No Wild-weapon HUD
charge bar (same as the pre-existing lack of a "uses remaining" display). No shop-side Wild-weapon
buy/refill/reroll. Not multiplayer-verified (single-client testing + code review only, same caveat A6
already carries).

**Still open per the earlier gap list below**: the Grinder is still melee, not the brief's ranged
returning disc (A2's other flagged gap - untouched this pass, out of this session's scope). A4's item
list (6 items, not 3) and A5's checkpoint triggers (mid-level legend NPC + boss-arena-start, not just
zone-clear) are both still exactly as this file already described them.

## v1.1 A6 + B1 landed via parallel subagents (main session, latest)
Two subagents ran in parallel git worktrees off `2bc3b74`, each briefed with the actual
`BRIEF_v1.1.md` text and told explicitly not to touch the other's territory (Core/Wild/crew-lives
systems vs. world/level structure). Both merged into `main` cleanly - `9a663a8` (A6) then `3901f0e`
(B1), no textual conflicts, and the combined result was re-verified after merging (not just trusted):
`node --check` both files, a full Playwright regression (fresh save -> migration -> solo -> combat ->
shop cycling -> crew-lives drain-to-restart, still losing exactly 50% coins/Resin), and all 55 levels
(49 main + 6 secret) built via the debug handle with zero errors.

**A6 (commit `70e0d9c`)**: world-gated enemy tricks for cop/karen/mouse/squirrel across
beach/suburb/city/woods/hq (Park intentionally untouched). Each has a telegraph, a status-effect
(`me.stunT/rootT/slowT/blindT`), new SFX, and network sync via existing per-enemy state sync plus two
new relay message types (`'cloud'`, `'trap'`) added to server.js's explicit whitelist. Known gaps:
mousetraps are level-seeded not dynamically dropped, the HQ drone has no independent hittable hp, the
clipboard-Karen buff icon is host-local cosmetic only (the actual buff is synced), and **true two-client
multiplayer was not tested** - only single-client plus code-level mirroring of already-proven sync
patterns. A manual two-browser smoke test is recommended before calling this multiplayer-verified.

**B1 (commits `3963a59`, `9ab39fc`)**: `WORLD_DEF` replaces the old fixed-length world scheme with the
brief's real 6/7/8/9/9/10-level (49 main + 6 secret) structure, mini-bosses per world (`bossDataFor(n)`,
deterministic by level number, brief's exact names), per-world maps sized to each world's real level
count with a Hotbox Highway node after the mini-boss and a Head Shop node, and once-per-save
world-transition cutscenes. Old saves migrate (`migratedB1` flag) - spot-tested with a save shaped like
the pre-B1 format. **Biggest disclosed gap**: no real hand-chunk content-authoring happened (that's a
genuine multi-day task) - `buildLevel` is still one deterministic procedural generator per level number,
and the BRAWL/GAUNTLET/HAZARD/CHASE/ESCORT/SECRET level-type tags are metadata only, not yet wired to
distinct gameplay (every level still plays as the existing clear-zones-then-boss flow). Also: mini-bosses
reuse their base enemy's single attack pattern (brief wants 2 patterns each), the Hotbox Highway map node
is clickable but shows "COMING SOON" rather than launching `drive.js` (which exists as a standalone file
but was never hooked into `game.js`'s map at all, by anyone, until now being a visible gap), and the 6
secret levels build as data but have no in-level hidden-exit discovery mechanic yet.

**Next most valuable steps, roughly in priority order**: (1) wire the Hotbox Highway map node to actually
launch `drive.js` (and the equivalent per-world-transition hookup for the 5 built transit games -
lazyriver/paperplane/munchietruck/smokeballoon/bongrocket - which also still aren't connected to any
in-game trigger despite existing and working standalone), (2) give GAUNTLET/CHASE/ESCORT real distinct
mechanics instead of metadata tags, (3) a real two-browser co-op smoke test of the A6 tricks, (4) hidden
secret-level exits, (5) the A2/A3/A4 brief-fidelity gaps already documented below (Grinder should be
ranged, Core upgrades should cost coins+Resin+Seeds with mini-boss/boss level caps, the Wild pool should
be the 12 brief-named weapons with a charge-bar economy, consumables should be 6 items not 3).

## IMPORTANT: the full BRIEF_v1.1.md text was only read in full late in this session
Everything below "v1.1 Section A progress" was built from a compacted/summarized memory of the
brief, not the actual document. Once the real `claude/BRIEF_v1.1.md` was read from the Project (near
the end of this session), a few real deviations turned up - **noted here, not yet fixed**:
- **A2**: the Grinder is specced as a **ranged returning disc** ("throws a disc that flies out and
  returns... range grows with level"), not melee. This session deliberately kept it melee as a scoped
  simplification (disclosed in the A1/A2 commit) - that's now a bigger gap than it looked at the time.
- **A2 cost curve**: the brief wants Core upgrades to cost **coins + Resin** (and Seeds on odd levels,
  Seeds dropped only by bosses), with level caps that only rise at each world's mini-boss/boss (capping
  at Lv10 after Mr. Killjoy). This session's shop entry is Resin-only, no coin cost, no Seeds, no level
  caps at all - upgradeable 1-10 freely from the start. `save.seeds` field exists (added in the A1
  foundation commit) but is completely unused.
- **A3 Wild pool**: the brief lists 12 specific named Wild weapons (Bong Hammer, Blunt Bat, Rolling
  Papers, Nug Bombs, Dab Torch, Hacky Sack, Leaf Blower, Zippo Flick, Hookah Whip, Lava Lamp Mace,
  Gravity Bong Cannon, Apple Pipe), each with 3-4 worlds it appears in, a charge-bar economy (Resin
  fills the Wild charge first, overflow goes to the bank), and being lost at level end. This session's
  A3 only folded the Dab Saber into the existing 4 enviro-weapon pickups (lid/cone/surfboard/chair) -
  none of the 12 named weapons, no charge-bar (still flat "uses" count), no per-world pool rotation.
- **A4**: the brief's actual item list is Munchies/Pre-roll/Rage Brownie (shareable) plus Energy
  Soda/Golden Leaf/**Vape Pen** (personal-only) - 6 items total, carry Munchies+2 others. This session
  instead cut down to exactly 3 items total (munchie/brownie/soda), dropping pre-roll and gold rather
  than keeping them as brief'd. No GIVE key, no shared brownie buff (both flagged already).
- **A5 checkpoints**: the brief's checkpoints are specifically "the mid-level legend NPC" and "each
  boss arena start", not just "the last zone that cleared" (what this session actually built). Close in
  spirit but not the same trigger points - there's currently no legend-NPC or boss-arena-start hook
  setting `checkpoint`, only the zone-clear one.
- **A6**: not started at all this session. The brief has a full 6-world x 3-enemy-type table (18
  distinct tricks: taser/sunscreen-spray/sand at Beach, pepper-spray/leaf-blower-Karen/mousetraps at
  Suburbia, riot-shield/phone-flash/rat-gangs at Downtown, net-launcher/essential-oil-diffuser/pinecone-
  grenades at Woods, drone-backed-cops/clipboard-Karens/exploding-robot-mice at HQ), each needing a
  telegraph, a counter, a briefing entry, a sound, and network sync. None of this exists yet.
- **Section B** (the 6-world/49-level rebuild, the 5 already-built transit games' actual per-world
  hookup + pool rotation, the Head Shop CORE tab, farm price/gate change to "Killjoy beaten + coins",
  Astral Plane unlock changed to "S grade on all 6 bosses", save/UI updates) is entirely unbuilt - this
  was already known/flagged before the brief was re-read, just re-confirming it here.

**Read `claude/BRIEF_v1.1.md` in full before touching Section A again** - do not keep working from a
summary of it. The gaps above are exactly the kind of drift that happens when a brief gets paraphrased
across a context-compaction boundary; the original doc is short enough to just read directly.

## v1.1 Section A progress (main session, latest)
Commits `100a4ed`..`c295b95` on `main` land brief v1.1 Section A1-A4 in `public/game.js`:
- **A1/A2 done**: `save.cores{rasta,snapback,bucket,afro}` (1-10 Core-weapon levels), `save.resin`,
  `coreLevel()`, `weaponDef()`/`wlv()` rewired so each homie has one fixed Core weapon
  (rasta->puff, snapback->bong, bucket->grinder, afro->lighter) that levels via a Resin-paid shop
  entry (`kind: 'coreup'`) instead of the old shop-bought weapon roster. Weapon buying + throwable
  ammo (papers/bombs/smoke) removed from the shop and from chest loot (chests now drop Resin).
  One-time `migratedV11` pass banks old `save.weapons`/`save.throws` counts into Resin and seeds
  `save.cores` from old `save.wlv`.
- **A3 (scoped)**: Dab Saber folded into the existing enviro-weapon pickup system as a rarer (15%)
  Wild-weapon drop, alongside lid/cone/surfboard/chair. That per-level "uses" pickup system IS
  being reused as the Wild-weapon pool for now. NOT done: a persistent `save.wild` slot (Wild
  weapons still reset every level) and Resin-funded refill/reroll from the shop.
- **A4 (scoped)**: `ITEMS` trimmed to munchie(cap 3)/brownie/soda, preroll+gold removed. Fixed a
  real latent crash this caused (`save.quick` pointing at a removed item -> `ITEMS[q].icon` throws
  in the HUD draw) by retargeting `save.quick` in `loadSlot()` if it's not one of the 3 survivors.
  NOT done: brownie's "pass the plate" shared co-op buff, a GIVE key to hand items to crewmates.
- **Still open in Section A**: A5 (crew lives 3 solo/5 co-op replacing per-player deaths, checkpoints,
  economy retune ~60-100 coins/level), A6 (new per-world enemy weapons/telegraphs), and the two
  pieces of A1/A4 flagged above (THROWS system full removal, GIVE key). A7 was already handled
  earlier (only the map-overlap bug reproduced; everything else checked-but-not-reproduced).
- **Every commit in this range was verified** with `node --check public/game.js` plus a Playwright
  pass that: loads fresh, picks a save slot + character, starts solo, attacks repeatedly (exercises
  weaponDef/wlv/coreLevel), forces into the shop/results state via the `window.__KQ` debug handle
  and cycles every tab + buys through every entry via keyboard, and (for A4) seeds an old save with
  a since-removed quick-item id to confirm the migration path doesn't crash. All passes: `errors: []`.
- **Next up per `PLAN.md`'s build order**: finish A5/A6, then Part B1 (the 6-world/49-level rebuild -
  by far the biggest remaining task), then B2/B4/B5, then hook the 5 transit games + drive.js into
  the new per-world map, then mobile/touch polish (per the user's explicit instruction, this comes
  *before* the final dedicated bug-review pass), then that bug-review pass itself.

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
