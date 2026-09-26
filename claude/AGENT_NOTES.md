# AGENT_NOTES

## Hotbox Highway / FIX_STEPS Step 3 (drive agent, owns ONLY public/drive.js + public/drive-test.html)
**Status: solo verified in the browser; online built and waiting on Step 2 before a real multi-tab test.**

`drive.js` has been rewritten. The old version only drew the road and the HUD. The new one is a full
game that keeps the same contract: `Drive.start({from,to,world,cooked,crew,save,net,onDone,mount,scale})`
returns `{cleanup}`, and `Drive.needsDrive()` is unchanged. It draws its own canvas inside `mount`, which
`game.js`'s `#transitMount` works with as is. It no longer depends on `transit.js`.

**What works, verified solo in `drive-test.html` with a Playwright autopilot (0 page errors):**
- Step 3.1: the van and Taylor's Shitbox from behind, cruiser/motorcycle/Buzzkill SUV cops, roadblocks with
  a gap, civilian traffic, and coins/snack crates/incense/air freshener/nugs, all scaled by depth.
  Roadside props and spoof signs are themed for all 6 worlds (park, beach, suburb, city, woods, hq).
- Step 3.2: the rear-view mirror inset showing tailing cops, the siren light wash, and side warning arrows.
- Step 3.3: snack ammo and counter. Each seat throws into its own zone: the right window covers the right,
  the left window covers the left, and the rear window aims through the mirror. With a crew of 2 the lone
  window covers everything, and with 3 the windows can click the mirror. A hit blinds the cop.
- Step 3.4: Heat rises from speeding, crashes, rams and take-a-hit smoke. At full Heat you're LOCKED ON
  for 5 seconds. If caught: -10 coins, a SIRENS slowdown, and Heat resets to 50.
- Step 3.5: the pick screen and vote (5 seconds, no votes or a tie = the van, and the host starts
  everyone together). The Shitbox has its popup, its one-song loop, and a backfire that scares cops.
- Step 3.7: all 28 swap events, including world-only and Shitbox-only ones. There are no repeats until
  the deck is used up, and the deck is saved in `save.driveDeck`. Each event has its own sound. Solo
  scrambles the controls for 3 seconds. Online shows "YOU'RE DRIVING NOW".
- Step 3.8: baked tiers (40/90/100%) add steering lag, drift and sway, colour shift, and Ultra's rainbow
  road in slow motion. Smoke from a hit blurs the road.
- Step 3.9: the fork at 25% with signs (the scenic route has more coins and a +25 secret stash), van
  damage that builds up, and a 6-step test drive (first time only, TAB skips, sets `save.testDrive`).
- Step 3.10: results with awards named per player, first half vs second half, munchies = floor(snacks/5)
  up to 2, and a high-score buff (`'cooked10'` or `'soda10'`).
- Step 3.11: engine, siren, crash, splat, cough, horn, backfire and music (the van loop, the Shitbox
  song, and a trippy version at Ultra).
- Step 3.12: `needsDrive` and `save.drives` use the key `min-max`.

**Online (Step 3.6). Code is written, and a real 2-4 tab test is waiting on Step 2:**
- The driver's game runs the drive. It seeds the road, sends 10 snapshots a second, and havoc seats send
  inputs. The swap hands the full state to the new driver. If the driver goes quiet for 2.5 seconds, or
  a `'pl'` message arrives, the room host's game takes over. Driver order: the host drives the first
  drive, then whoever has driven least this session.
- Drop-in: `Drive.start({..., spectate:true})`. The joiner waits, then follows the driver's view from the
  next snapshot header (sent about once a second).
- **Routing for Step 2:** every message is `{t:'d', k:'dr', p:{k:<kind>,...}}`. In `game.js`'s `case 'd'`,
  call `Drive._deliver(m.id, m.p)` when `m.k === 'dr'`, or pass the whole message to `Drive.onNet(m)`.
  Also pass `'pl'` messages to `Drive.onNet(m)` (optional, since the silence check covers it).
  Pass the live `Net` object as `net`. The drive reads `net.hostId` each time, so host migration works.
- `onDone` returns `{coins, cooked, snacksLeft, munchies, buff, score, awards, heatCaught, route}`.
  `cooked` is this player's own Cooked. Each player gets the full `coins` (being busted already took
  10 from everyone).

**Not done yet:** the real multi-tab online test (waiting on Step 2) and the GARAGE (Step 9, after Step 3).

## Session wrap-up: A2-A6 + B1-B3 all landed and merged (main session, latest)
This session ran 4 subagents in parallel git worktrees (A6 enemy tricks, B1 world/level rebuild, A2/A3
economy fidelity, mobile/touch polish), each briefed against the real `BRIEF_v1.1.md` text and told which
files/systems NOT to touch so their work wouldn't collide. All 4 branches merged into `main` with **zero
textual conflicts** across two merge rounds (`9a663a8`+`3901f0e`, then `7d4bc04`+`4432aff`), and the
combined result was re-verified after each merge, not just trusted: `node --check` on every touched file,
the full existing Playwright regression (fresh save -> migration -> solo -> combat -> shop cycling ->
crew-lives drain-to-restart still losing exactly 50% coins/Resin -> all 55 levels building with zero
errors), plus targeted checks of the newly-merged transit-game launch wiring (Hotbox Highway + a world-gate
game both still launch correctly into `state:'transit'` after the touch-input changes landed on top).

Also landed this session, directly (not via subagent): B2/B3's actual map wiring (commit `24ec993`) -
`index.html` now loads `transit.js`+all 6 mini-game files and gets a `#transitMount` overlay; a new
`launchTransit()` in `game.js` pauses the main loop and launches Drive.start/LazyRiver.start/etc. from the
Hotbox Highway node and each world-gate node, banking coins and returning to the map on completion.

**Everything currently on `main` for brief v1.1**: A1 (two weapon slots) / A2 (4 Core weapons, real
coins+Resin+Seeds cost curve, `save.coreCap` raised at each mini-boss/boss) / A3 (the 12 named Wild
weapons, per-world pool, Resin-backed charge bar) / A4 (trimmed consumables) / A5 (crew lives, checkpoints,
restart-at-0-with-50%-loss) / A6 (world-gated enemy tricks for cop/karen/mouse/squirrel) / B1 (6 worlds,
49+6 levels, mini-bosses, per-world maps, cutscenes) / B2+B3 (Hotbox Highway + the 5 transit games actually
launchable from the map) / mobile touch support pass across the main game and all 6 mini-games.

**Remaining known gaps** (each already disclosed in detail in its own commit/section below - read those
before starting on any of them): A1's old THROWS system was never fully ripped out (just no longer fed).
A6 was never verified with real two-client co-op. B1's level-TYPE tags (BRAWL/GAUNTLET/etc.) are metadata
only, not yet distinct gameplay; mini-bosses reuse one attack pattern; secret levels build as data but
have no discovery mechanic. A2/A3's Seed-per-boss-per-player and Resin drops aren't co-op-synced (single-
client credit only). Mobile audio-unlock on real iOS Safari couldn't be verified from headless Chromium.
Farm price/gate (Part B4: "~2500 coins + Killjoy beaten") and the Astral Plane unlock change (Part B4:
"S grade on all 6 bosses" - no grade system exists yet) are untouched. Part B5 (save/UI: world %, secrets-
found count on the menu) is untouched.

**Deploy**: this repo has a `render.yaml` and README-documented live URL (`https://kush-quest.onrender.com`)
that auto-deploys from GitHub on push to `main` - already pushed as of commit `4432aff`. The sandbox's
network egress doesn't allow curling arbitrary external hosts, so the live deploy couldn't be verified
from inside this session; Render's own dashboard/build logs are the way to confirm it went out.

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

---

## Mobile UX fix pass (post-playtest bug reports) — landed, commit d88bbdc

The user actually playtested on an iPhone and reported two real bugs mid-session:
1. The up/down/left/right d-pad buttons "feel bad" and occasionally trigger iOS's
   copy/paste-selection callout.
2. Spamming the attack button on mobile could zoom the page in via the pinch/double-tap
   gesture, with no way back to normal zoom — described as a must-fix.

**Fixed:**
- Replaced the 4-button d-pad in `public/index.html` (`#touch` first `.grp`) with a single
  drag joystick (`#joyBase`/`#joyKnob`). The wiring lives in `public/game.js` right after the
  `#touch button` pointerdown/pointerup block (grep `virtual joystick`). It reuses the existing
  `K.left/right/up/down` booleans via `press()` for movement during `play`/`sitting` (8-way via
  angle sectors, so diagonals work), and the existing single-shot `K.nav` pulse for
  menu/map/lobby/story/inventory/results screens — zero changes to movement physics or menu
  cursor code. Verified with Playwright (real `PointerEvent` drag, iPhone 13 emulation): dragging
  right in `play` moved `me.x` 40 → 83.8 and correctly cleared `K.right` on release.
- Added document-level zoom prevention in `public/index.html` (inline `<script>` right after the
  canvas, before the game scripts load): `gesturestart/change/end` preventDefault (Safari pinch),
  a `touchend` double-tap timing guard (≤350ms), `touchmove` preventDefault for 2+ finger touches,
  and a `visualViewport` `resize` listener that snaps the meta viewport back to 1x if a zoom ever
  slips through anyway (belt-and-suspenders — there should never be a stuck-zoomed state now).
  The old `<meta viewport maximum-scale=1,user-scalable=no>` alone is known to be unreliable on
  iOS Safari once double-tap/fast-multitouch happens, which matches exactly what the user hit.
  Verified with Playwright: 6 rapid taps on the attack button, `visualViewport.scale` stayed 1.
- iOS copy/paste callout suppression (`-webkit-touch-callout:none`, `user-select:none`) was
  already broadly applied to `button, #touch` in the CSS; the new `#joyBase`/`#joyKnob` carry the
  same properties so the joystick itself can't reintroduce the issue.

**Not done / scoped out:** no further mobile UX polish beyond these three explicit asks — didn't
touch the other touch-control buttons (attack/jump/weapon/quick/throw/inv/pause/emote) beyond
removing the 4 d-pad buttons they used to sit next to.

**Testing:** `node --check public/game.js` (pass), then two Playwright passes — one with iPhone 13
device emulation driving the full story→map→startLevel→brief→play flow and dragging the joystick
with real `PointerEvent`s, one on a plain desktop viewport confirming `ArrowRight` keyboard
movement still works unaffected (x: 40 → 80.1). No new console/page errors in either pass (the
only reported "error" was the sandbox's own outbound network block on unrelated Google telemetry
domains — not a game issue). Pushed to `main`; Render auto-deploys from there.

---

## Follow-up: two-client online verification + user report of joystick "not changed" (latest)

Ran a real two-browser-context Playwright test (`/tmp/kq_2browser_test.js`, not committed - scratch
test) against a locally running `server.js`: client A (desktop) creates a room, client B (iPhone 13
emulation) joins with the room code, both advance through lobby → brief → play on the same level
(host picks level via `Net.send({t:'pick', n:1})`), then A moves right via keyboard and B moves
right via a real `PointerEvent` drag on the new joystick. Result: both local positions advanced
(A: 40→136, B: 50→149) **and each client's `remotes` map showed the other player's x position
matching**, confirming both the mobile joystick and the desktop keyboard path stay correctly
network-synced together. No new console/page errors (only the sandbox's own blocked outbound
telemetry domain, as before).

The user then reported the mobile controls "did not change in the way I wanted" (still expecting
a drag-anywhere joystick instead of 4 buttons). Re-verified the code on `main` (commit `d88bbdc`)
is in fact exactly that — `#joyBase`/`#joyKnob` in `index.html`, wired in `game.js` right after the
`#touch button` listener block — and took a fresh screenshot confirming it renders as a circular
drag stick, not 4 separate buttons. Likely explanation given to the user: Render free-tier deploy
lag/cold-start or a stale browser cache on their phone, not a code issue — asked them to hard-reload
and report back with specifics if it's still wrong. No code changes made in this follow-up; purely
verification. If the user comes back saying it's still 4 buttons after a hard refresh + confirming
they're on `kush-quest.onrender.com`, the next step is to ask for a screenshot from their actual
device rather than guessing further from the sandbox (which cannot reach the live Render URL to
verify the deployed bytes directly - egress is allowlisted to GitHub/npm only).
