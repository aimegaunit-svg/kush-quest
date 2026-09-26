# AGENT_NOTES

## Hotbox Highway / FIX_STEPS Step 3 (drive agent, owns ONLY public/drive.js + public/drive-test.html)
**Status: Step 3 DONE. Verified solo, and online with 2, 3 and 4 real game clients (the actual `index.html`, after Step 2).**

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

**Online (Step 3.6). Verified in the real game after Step 2 (Playwright, separate browser contexts, local server.js):**
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

**Real online test results** (host launches the map's Hotbox node, and every client gets `transit-start`):
- 3 players: the vote went 2-1 for the Shitbox and every client started together with seats [drv, right, -, left].
  At the swap the left window became the driver and the drive handed over its full state. The new
  driver's tab was then closed: the host's game took over within about 2.5 seconds, the drive finished,
  and the awards named both drivers. Everyone went back to the map with coins and Cooked applied and
  `save.drives` set.
- 2 players and 4 players: the swap rotation and handoff work, the drive finishes, and players go back
  to the map.
- Two bugs found by this test and fixed: (1) the old driver's silence timer wasn't reset at the swap, so
  the host "took over" from the real new driver; (2) the SPACE that closes the results also reached
  `game.js`, which relaunched the drive from the map. The drive now captures keydown while it runs.
- For the main session: a `game.js` page error ("Cannot read properties of undefined (reading 'x')")
  showed up on the non-host clients in 2 of 6 online runs. It wasn't from `drive.js` and I couldn't
  reproduce it reliably. It's probably in the map or remote-player code.
- Drop-in mid-drive uses Step 2's own "crew is driving" wait screen. `Drive.start({spectate:true})`
  also exists if you'd rather have late joiners watch the drive.

**GARAGE, drive side (Step 9.4). DONE in `drive.js` and verified.** The GARAGE tab UI in the shop is `game.js`, so it's still the main session's. It just needs to write these save fields:
- `save.vanUp = { tires: 0-2, engine: 0-2, stash: 0-2 }` (both cars). Tires cut the baked lag and drift by 25% per
  level, engine adds +6% top speed per level, stash adds +10 snacks per level.
- `save.vanPaint = 'tiedye' | 'flames' | 'leaf' | null` (van only).
- `save.shitboxDeco = { dice: bool, fresh: bool }` (Taylor's Shitbox: fuzzy dice and a new air freshener
  in the rear window).
- Online, the **host's** garage goes to everyone in the start message, so all players see the same car
  and a mid-drive handoff keeps the same handling. Tested: a guest with no upgrades got the host's
  tie-dye van and +20 snack stash.

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

### Step 4 progress (transit agent, 2026-09-26) — what actually works now
Files touched: `public/transit.js`, the 5 game files, their 5 `*-test.html` pages. Nothing else.

**4.2 Replay skip — works (solo, headless-verified).** New in `transit.js`: `hasDone/markDone/needsPlay`
and `makeStartGate()`. A run that reaches its results screen sets `save.transitDone[<gk>] = true`
(gk = `lr/pp/mt/sb/br`, calls `save.__persist()` if present). Next launch shows **PLAY AGAIN / SKIP**
(arrows+Enter, `P`, `S`/Esc, or click left/right half). SKIP calls `onDone({coins:0, score:0, awards:[],
skipped:true, ...})` right away. Each game also exports `<Game>.needsPlay(save)` if the map wants to
decide before launching. Online (coded, **not yet tested live**): only the room host picks; others see
"WAITING FOR THE HOST" and follow a relayed `{type:'gate', skip}` (they poll with `{type:'gate?'}`
every 0.5s so a late joiner still gets it).
**Main session:** a skipped result carries `skipped:true` — treat it as "advance, no rewards".

**4.3 Swap events — works (5 per game, headless-verified).** New `Transit.makeSwapDeck()`: no repeats
until the deck is used up; every event reseats the crew a different way (rotate / reverse / shuffle /
swap first two / rotate by 2) and has its own gameplay effect, so solo runs feel them too:
- Lazy River: CAPSIZE, SPIN CYCLE, SWAN ATTACK, BUTTERFINGERS (paddles mirrored 4s), RAPIDS
- Paper Plane: GUST, BARREL ROLL, PELICAN SNATCH, SOGGY PAPER, THERMAL
- Munchie Truck: BRAIN FREEZE, POTHOLE, SUGAR RUSH, WRONG TURN, SPRINKLE SPILL
- Smoke Balloon: HICCUPS, COUGHING FIT, CONTACT HIGH, BIRD STRIKE, LOOSE SANDBAG
- Bong Rocket: ZERO-G, WORMHOLE, HULL BREACH, SPACE MUNCHIES, SOLAR FLARE (controls inverted 3s)
The authority broadcasts `{type:'swap', id, order:[playerIds]}` so every client reseats the same way
(coded, not live-tested yet). The banner shows the new seats underneath ("YOU ARE NOW: GUNR" online).
`onDone` now also returns `swaps: [ids]`.

**Headless click-through — done, all 5 pass with zero console/page errors** (Playwright, real button
clicks + key/mouse input on each `*-test.html`): intro card on first run → play with held inputs →
5 swaps in solo (5 distinct banners) → forced finish → results dismissed → `onDone` fires and
`transitDone` is set → replay shows the gate → SKIP by key → PLAY by click (intro auto-skipped) →
SKIP by click → 4-seat crew: seat order changed on every one of 5 swaps → 2-seat crew runs.
Test pages now have **Mark done (test replay SKIP)** / **Reset save** buttons, and each `start()`
returns a `_debug` handle (`st`, `seats`, `deck`, `fireSwap()`, `running()`) for tests.

**4.1 Online — works, tested live with 2, 3 and 4 real browser tabs** against a local `server.js`, all
5 games, launched through the host's real map click (gate node) so Step 2's `transit-start` / `case 'd'`
routing is exercised end to end. Per game, every check passed at 2/3/4 tabs: every tab launches; every
tab gets the same seat order and the same hazard layout; a swap fired by the host shows the same banner
on every tab and leaves identical seats; a **non-host** player in seat 0 steers the host's simulation
(paddles / dive / drive / pilot); the extra seats work remotely (Lazy River fend-off, Munchie thrower hits
a customer, Bong Rocket gunner fires, Smoke Balloon taps from every tab register as note hits and sync back);
progress stays within ~5 units across tabs; the host's finish shows results on every tab; everyone
returns to the map with the **same coins added**; the replay shows PLAY/SKIP on the host and "waiting" on
the others, and the host's SKIP sends every tab back to the map.
What changed to get there (my files only):
- `transit.js`: `assignSeats` sorts the crew by player id (game.js puts each client first, so seat 0
  used to be different on every tab); `rng/newSeed` (the host's seed travels in the gate message and
  non-hosts rebuild their layout from it); `inputSender` (held input at most every 50ms, since the
  server drops >120 msgs/sec); `flagIdx/applyFlags/seatIsMine`.
- Every game: state snapshots now carry collected/destroyed item flags; the host broadcasts
  `{type:'end', ...}` so non-hosts reach results with the host's final coins/awards.
- Munchie Truck / Bong Rocket: seat 0's relayed input actually drives now (before, only the host's own
  keys did); only non-driver/non-pilot seats throw/fire online; quick clicks are latched (a fast click
  used to be missed between frames).
- Smoke Balloon: each player owns one lane (= seat index, moves with swaps); taps go to the host.
- Lazy River: the fend-off seats finally do something (pole-shove the next rock/swan, hook a snack).
- Bong Rocket: bullets fly where you aim and hit by position (they used to hit anything at a fixed
  distance regardless of height); ramming an enemy = one hit, not one per frame.

**4.4 Carry-over:** coins apply correctly (checked on every tab above). Lazy River now returns
`munchies` (1 per 3 floating snacks grabbed, max 2) and Munchie Truck returns `munchies: 1` for a 5+
delivery combo; both match game.js's `r.munchies` handling. None of the 5 returns `cooked` on purpose:
game.js *sets* `me.cooked = r.cooked`, and these games aren't given the player's current Cooked, so
returning one would overwrite it. No `buff` either.

**For the main session (game.js, not my file):** non-host tabs crash in `drawMap_` (game.js ~4049,
`MAP_NODES[mapSel]` undefined) after a world-gate ride. Seen after Paper Plane and Munchie Truck:
the non-host ended on world 0 (9 nodes) with `mapSel` = 9 relayed from the host. The non-host's world
doesn't follow the host's after `advance()`, and the relayed cursor isn't range-checked.

**Known online gaps left:** the room host always simulates, and `net.isHost` is fixed at launch, so if
the host leaves mid-ride the ride stalls for everyone else (no handoff yet). Non-hosts are ~0.5s behind
the host at the start (they wait for the gate/seed message). Paper Plane's "free the pelican" and dive
use held input, so a very quick tap from a non-host can be missed. Astral Bong Rocket: waiting for Step 7.


**Scope:** Part B3 of brief v1.1 — 5 transit mini-games + shared framework.

**Status (original B3 build): complete. See Step 4 progress above for current state.**

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

---

## STEP 1 (FIX_STEPS.md): foundations - landed and verified

Implemented every item in Step 1 of `claude/FIX_STEPS.md` (the new audit-based plan that replaces
`PLAN.md`'s ordering), in `public/game.js` and `server.js`:

1. **Q key** (`cycleWeapon()`, `public/game.js`): completely rewritten. It used to unconditionally drop
   any held Wild weapon and cycle through the dead `save.weapons` 6-weapon roster. Now it just toggles a
   new `me.wildOn` boolean between Core and the held Wild weapon (`me.envWeapon`) and never drops anything;
   with no Wild weapon held it's a no-op click. `attack()`, the charge-drain/empty-click logic, and the
   HUD weapon icon were all updated to key off `wildActive = me.envWeapon && me.wildOn` instead of just
   `me.envWeapon`. The HUD weapon-icon box now shows a small C/W badge so you can actually see which is
   active. Picking up a new Wild weapon auto-activates it (`wildOn = true`), matching the old instant-equip
   feel. Verified: gave a Wild weapon via the debug handle, pressed Q twice, confirmed `envWeapon` stayed
   held both times while `wildOn` toggled false then true, and confirmed a fresh screenshot of the HUD
   showing the C/W badge and popup text change correctly both ways.
2. **Crew wipe sync** (`restartLevelOutOfLives()` + `case 'wipe'` in both `game.js` and `server.js`): the
   host now computes the real reset `crewLives` value BEFORE sending the wipe message (order was backwards
   before - it sent, then computed) and includes it as `n`. Non-host clients now read `m.n` instead of a
   hardcoded `5`. `server.js`'s `case 'wipe'` relay now forwards `n` (clamped 0-9, same as `case 'lives'`).
   Verified with a REAL 2-browser test (`/tmp/kq_step1_wipe.js`, not committed - scratch test): host and
   joiner both join a room, reach `play`, host calls the real `restartLevelOutOfLives()` via the debug
   handle, and both clients end up agreeing on `crewLives` afterward. Also sniffed the raw WebSocket frame
   B actually received: `{"t":"wipe","l":1,"n":5}` - confirms the `n` field is real wire data, not
   something the client invents locally.
3. **Ultra bonus**: `toResults()`'s `ultraBonus` changed from `me.earned` (a full +100%/x2) to
   `Math.round(me.earned * 0.25)` (+25%, per the brief). Updated both result-screen text ("ULTRA +25%!")
   and the in-level "ULTRA COOKED!!" banner text (was still advertising "x2 COINS AT THE SPOT").
4. **A1 cleanup**: the Bag's old "MELEE" (6-weapon roster) and "THROW" (papers/bombs/smoke ammo) rows are
   gone, replaced with "CORE" (the current homie's fixed Core weapon, display-only - always equipped) and
   "WILD" (the currently-held Wild weapon, if any; confirming it toggles active the same as pressing Q).
   Added a `WILD_ICON_ID` map so the WILD row always has a real icon to draw (Wild weapons have no icon art
   of their own - reuses the closest-themed MELEE/THROW icon). Deleted the now-fully-dead `selectWeapon()`
   function. **Not done / disclosed scope decision**: the underlying legacy THROWS/papers/bombs/smoke K-key
   throw mechanic itself (ammo array, `throwItem()`, the `throwsel` rebind action, the gamepad/mobile K
   button, the HUD ammo icon) was left in place rather than fully ripped out - it's dead-in-practice (no
   shop/chest/pickup has granted ammo since A1/A2, only a single one-time 10-pack from the `throw` skill
   unlock), but fully retiring it touches keybindings, gamepad mapping, and the mobile touch control, which
   felt like more blast radius than this step's check called for. Flagged here rather than guessed through
   silently; happy to finish the rip-out if wanted.
5. **Cooked fade pause at the smoke spot**: investigated and found this was **already correct** - the decay
   tick (`updatePlayer()`, `frame % 180 === 0 ... && state === 'play'`) already only runs during `state ===
   'play'`, and `sitDown()` (triggered the instant you reach the spot at >=50% Cooked) immediately flips
   `state` to `'sitting'`, which stops the decay. Verified with a fresh test: teleported the player to the
   spot at 75% Cooked, confirmed `state` became `'sitting'` and `me.cooked` was unchanged 4 real seconds
   later (well past the 3s decay tick). No code change needed here - just confirmed and left alone.
6. **"SMOKE SPOTS x/49" text**: replaced everywhere it appeared as a literal string (save-slot list, the
   Bag footer, the stats screen, and the farm-lock shop message) with a new `progressLabel(spots)` helper
   that renders "WORLD 2-3"-style world/level labels (`worldOf()`/`levelInWorld()` already existed from
   B1). The farm-lock message was reworded to "BEAT ALL 6 WORLDS FIRST" instead of forcing the label through
   `progressLabel(49)` (which would read as "REACH ALL WORLDS CLEARED FIRST" - bad grammar). **Left alone,
   out of scope for this text-only step**: the 49-dot progress track widget on the shop/farm-hub screen
   (`drawMap()`) still shows 49 individual numbered dots rather than being grouped by world - that's a
   bigger display rework that belongs with Step 7 ("world select: % complete... save slots: show world and
   level"), not this literal-string-replacement item.
7. **Server hardening** (`server.js`): added a dedicated chat rate limit (800ms cooldown per client, on top
   of the existing blanket 120msg/sec-per-socket limit) and a dedicated `fx` rate limit (40/sec/client -
   generous for real combat, but catches a client blasting far more fx than any real attack cadence could
   produce). Added `process.on('uncaughtException'/'unhandledRejection', ...)` handlers that log and keep
   the process alive instead of the whole server (every room on it) going down on one bad message. `/health`
   now returns JSON (`{ok, rooms, players, connections, uptime}`) instead of a bare "ok" string - useful for
   glancing at server load. **Host takeover of enemy AI when the host leaves**: verified this already works
   correctly by design, not touched - `case 'host'` on the client just updates `Net.hostId`, and since every
   client (including the eventual new host) has been continuously mirroring the old host's authoritative
   `lvl.enemies` state via `'es'` snapshot broadcasts the whole time, the new host's `hostUpdate()` picks up
   from an already-fresh local copy the next frame with no special handoff code needed.

**Debug handle additions** (`window.__KQ`, for future automated tests): `crewLives` (getter),
`restartLevelOutOfLives`, `cycleWeapon`, `progressLabel`.

**Check status**: solo run through 1-1 done via Playwright (menu -> story -> map -> brief -> play, no
console errors). Q-key swap verified via debug handle + screenshots. Crew wipe forced in 2 real browser
tabs against a locally running `server.js`, both clients agreed on the post-wipe `crewLives`, and the raw
WS payload was sniffed to confirm the fix is real (not just coincidentally consistent). All of Step 1's
checklist items pass.

Pushed to `main`. Next: Step 2 (online wiring for the vehicle games - `case 'd'` routing, host-broadcasts-
launch, drop-in, carry-over), which the drive/transit agents need before they can test their games online.

## STEP 2 (FIX_STEPS.md): online wiring for all vehicle games - landed and verified

**Status: done. This is the one the drive/transit agents were waiting on - you can now test Hotbox Highway
and all 5 world-transition games online.**

1. **Incoming relay routing** (`game.js`, `onNet()`): added `case 'd':`. `{t:'d', k, p, id}` messages now
   route to the right place: `k === 'dr'` goes to `window.Drive._deliver(id, p)` (Drive is a singleton -
   it already exposed `_deliver` directly, no extra plumbing needed). Any other `k` (the 5 transit games'
   2-letter keys - `lr`/`pp`/`mt`/`sb`/`br`) looks up `window.Transit._activeNets[k]._deliver`.
   `Transit._activeNets` didn't exist before this step - `transit.js` (not ours to edit) never exposes the
   wrapped net object `makeNet()` builds for each mini-game, so there was no way for `game.js` to reach it
   to deliver incoming messages. Fixed by monkey-patching `Transit.makeNet` from inside `game.js` (see the
   comment right above `launchTransit()`) to stash every wrapped net into `Transit._activeNets[gameKey]`
   the moment it's created - `transit.js` itself is untouched, and the 5 games still attach their own
   `_deliver` to the exact same object afterward, so the stashed reference sees it too. Verified with a
   Playwright check: after launching Lazy River (world 0's gate game) in 2 tabs, both clients had
   `Transit._activeNets.lr._deliver` set to a real function.
2. **Host broadcasts the launch**: the map's `hotbox`/`gate` click handlers now send `{t:'transit-start',
   k, from, to, w}` before launching locally (host-only - `updateMap()`'s whole click-handling block is
   already gated by `canDrive = !Net.online || isHost()`). The actual launch logic was factored out of the
   click handlers into two new functions, `startHotboxTransit(from,to,worldIdx)` and
   `startGateTransit(worldIdx)`, so both the host and every crewmate (via the new `case 'transit-start':`
   in `onNet()`, which calls the same two functions) launch the identical ride. `server.js` relays
   `transit-start`/`transit-end` (host-only, rejects non-host senders) and also tracks the ride on
   `room.transit` for point 4 below.
3. **Carry-over from vehicle games**: `launchTransit()`'s `onDone` now applies `cooked` (a full set,
   clamped 0-100), `munchies` (an add, capped at 3 like the existing snack-cap pattern), and `buff`
   (`'cooked10'` = instant +10% Cooked, `'soda10'` = the existing 600-frame soda speed buff) - previously
   only `coins` was applied. Each client applies its own carry-over locally from its own ride result, since
   Cooked% etc. are per-player.
4. **Drop-in during a vehicle game**: a player who (re)joins mid-ride can't launch the ride themselves (they
   never got the original `transit-start`), so they land on a new minimal `'transit-wait'` state (a
   "CREW IS DRIVING..." screen, gated out of the main update/draw loop the same way `'transit'` is) instead
   of dropping into the live map underneath everyone else. `server.js`'s `enter()` now includes
   `room.transit` (set by point 2, cleared on `transit-end` or if the host disconnects mid-ride - see
   `leave()`) in the `'joined'` payload, and `startGame()`'s map-phase branch checks `Net.transit` to decide
   between `openMap()` and `openMap(); state = 'transit-wait'`. The matching `case 'transit-end':` (sent by
   whichever client's `onDone` fires while `isHost()`) frees anyone stuck on that screen back to the map.
5. Also forwarded `'pl'` (player left) and `'host'` (host changed) to `window.Drive.onNet(m)` per the drive
   agent's documented contract in their own header comment, wrapped in try/catch since Drive may not be
   loaded/running.

**Check status - verified in real 2-3 browser-tab runs against a locally running `server.js` (not just by
reading the code), per the rule for anything online:**
- Launched Hotbox Highway from the map in 2 tabs: both clients' `state` became `'transit'` together.
  PASS.
- Launched a gate transit (Lazy River, world 0's B3 game) from the map in 2 tabs: same result, both
  `'transit'` together. PASS. Confirmed `Transit._activeNets.lr._deliver` was a real function on both
  clients (proof the makeNet hook actually wired the incoming-message path, not just that the game loaded).
- Simulated each client's own ride finishing (`Drive._debug().opts.onDone({coins, cooked, munchies, buff})`
  - drive.js's own gameplay/scoring is the drive agent's territory and already tested by them; this only
  exercises `game.js`'s own onDone wiring) with different values per client: both clients landed back on
  `state === 'map'`, and each client's own `coins`/`cooked`/`munchie` carried over correctly, including the
  `buff: 'cooked10'` case (+10 on top of the set `cooked` value). PASS.
- Drop-in: started a solo-hosted room, launched Hotbox Highway, then had a 3rd browser tab join the SAME
  room code mid-ride. The joiner landed on `'transit-wait'` immediately (not the map). PASS. When the host's
  ride finished, both the host and the drop-in joiner ended up on `'map'` together. PASS.
- `node --check` clean on both `game.js` and `server.js` throughout.

**Known gap, out of scope for this step**: if a *non-host* crewmate is mid-ride when the host disconnects
(not just when a new player joins), the new host inherits `isHost()` but there's no code that re-broadcasts
`transit-start` for anyone who wasn't already in the ride - this only matters for the drop-in-while-mid-ride
case, which is now handled at join time via `room.transit`, not for a host handoff mid-ride. Flagging rather
than guessing whether that edge case matters for this brief.

Pushed to `main`. Next: Step 5 (Core weapons for real, per Brief v1.1 A2).

## STEP 5 (FIX_STEPS.md): Core weapons for real (Brief v1.1 A2) - landed and verified

**Status: done, with one deliberate scope trim flagged below (visuals) and everything else built for real,
not stubbed.** `game.js` only - didn't touch `drive.js`/`transit.js`/the 5 transit game files.

1. **10-level form tables for all 4 Cores.** Added `coreTier(lv)` (buckets 1-2/3-4/5-6/7-8/9/10 into tiers
   0-5, matching the brief's form-name groupings exactly) and `CORE_FORMS`/`formName(wid, lv)` with the
   brief's real names for all 4 weapons (Joint: Pinner...Legendary Doobie; Lighter: Bic...Dragon's Breath;
   Bong: Mini Bong...The Mothership; Grinder: Pocket Grinder...Kief Cyclone). The HUD Bag row, the shop's
   core-upgrade buy button, and the level-up confirmation banner all show the real form name now (and call
   out when a purchase crosses into a new form), replacing the old static `WEAPONS[].name` display. Verified
   via debug hook (`setCoreLevel`) at lv 1/3/5/7/9/10 for the Joint: all 6 names distinct, damage strictly
   increasing.
2. **The Grinder is now genuinely ranged** - a thrown disc (`shots` kind 12) that flies out to a
   tier-scaled range, flips around, and homes back toward the player's CURRENT position until caught (its
   own little state machine in `updateShots`, since nothing else here needed an out-and-back projectile).
   4-Piece+ (tier2/Lv5+) pierces every enemy it passes; Electric+ (tier3/Lv7+) throws 2 discs at once;
   Industrial+ (tier4/Lv9+) can also hit on the way back (a fresh `s.hit` Set once it turns around); Kief
   Cyclone (tier5/Lv10) leaves a `slow` cloud where it's caught - a new cloud type that cuts enemy move
   speed by more than half rather than the existing "confuse and wander" smoke behavior (kept deliberately
   separate so it doesn't also stop enemies from attacking). Verified with a real enemy and real frames (not
   simulated): the disc travelled out, actually called `hitEnemy` (enemy hp dropped), returned, and was
   removed from `shots` - not just spawned-and-assumed.
3. **The Bong's tap vs hold** is its own input rule now, not gated behind the `charge` skill like every
   other weapon's charged swing - `updatePlayer()` allows the hold-to-charge gesture for Bong regardless of
   whether the player has learned Charged Swings. A tap still falls through to the existing melee smash
   (reach now also grows a little with tier - Glass Bong+); a hold fires a new ranged blast (`shots` kind
   13) instead. Percolator+ (tier3/Lv7+) leaves a smoke cloud where the blast lands; Gravity Beast+
   (tier4/Lv9+) rewards holding past ~1.2s with a bigger "2nd stage" blast; The Mothership (tier5/Lv10) is
   the only tier where the blast pierces the whole line (earlier tiers stop after their first hit, like the
   existing Rolling Papers throw). The tap's own shockwave-on-stun effect (previously firing from Lv3
   onward, a leftover from the old 1-3 weapon system) is now correctly gated to tier5/Lv10 only, matching
   the brief's "Mothership: smash makes shockwave ring". Verified: a tap spawns zero ranged shots (pure
   melee); a hold at Lv10 spawns exactly one piercing kind-13 shot.
4. **The Lighter's** burn/reach already scaled continuously by level (unchanged, that part was already
   correct); added the tier-gated pieces the brief calls for: Zippo+ (tier1/Lv3+) leaves a burning ground
   patch on hit (was previously gated at the old flat "lv>=3" latch - now genuinely tier-based, so it doesn't
   stop mattering past tier1); Jet Flame+ (tier3/Lv7+) bursts extra fire around the target on the combo
   finisher; Blowtorch+ (tier4/Lv9+) - a HELD attack now fires a short flamethrower stream (`shots` kind 14,
   3 jets in a fan) instead of the normal jab; Dragon's Breath (tier5/Lv10) widens that to a 5-jet cone and
   flags every enemy it burns (`e.dragonBurn`, carried over the network via a new `dr` field on the `hit`
   message so this also works for non-host clients) to explode with real splash damage when they die -
   verified end to end: hit an enemy with the stream (confirmed `dragonBurn` set), killed it, confirmed a
   neighboring enemy took splash damage from the death explosion.
5. **The Joint's** burn/reach already scaled continuously too; added Fatty+ (tier2/Lv5+): burn now actually
   spreads to a neighbor (previously the `spread` flag only ever applied to the Lighter - the Joint's own
   "burn spreads to 1 neighbour" from the brief's table was never wired up at all); Blunt+ (tier3/Lv7+): a
   genuine 4th hit joins the combo (the shared combo-length math, previously hardcoded to always cap at 3
   hits for every weapon, now reads `comboMax` per-weapon-per-tier); Cannon+ (tier4/Lv9+): the combo finisher
   leaves a patch of burning ground; Legendary Doobie (tier5/Lv10): that patch is bigger and the puff/particle
   colors go rainbow.
6. **Seeds for every player in co-op on a boss kill.** This was the one straightforwardly wrong bit: the
   `by === Net.id` gate in `onKill()` meant only whoever landed the killing hit got a seed, even though
   `onKill()` already runs identically on every client (same `case 'kill':` network event, same `e.mega`/
   `lvl.n`/`frame` state) - so the fix needed no new network message at all, just dropping that gate.
   Verified with 2 real browser tabs: replayed the same boss-kill event on both, crediting the kill to A;
   both A (the killer) AND B (not the killer) ended up with a seed.

**Scope trim, flagged rather than guessed past (per your standing rule)**: the brief asks for a genuinely
new sprite per form (24 total: 4 Cores x 6 forms each). That's real hand-drawn pixel art, not something to
improvise well in code, so instead every Core's held-weapon size and swing-trail size/color now scales with
tier (a growing colored glow aura appears from tier2 on, using `CORE_TIER_GLOW`), and every Core has at
least one real new visual per major tier jump (Dragon's Breath's cone flame, the Grinder disc's spin +
gold sparkle trail at Kief Cyclone, the Bong blast bubble growing at The Mothership, Legendary Doobie's
rainbow puff colors). It's a real, testable "the look changes with level" per the Step 5 check - screenshots
at Joint Lv1 vs Lv10 show a visibly bigger glowing swing - just not 24 unique sprites. Say if you'd rather
this get a real art pass instead.

One more small thing worth knowing: remote players' held-weapon visuals now also scale by tier (added a
`cl` field to the position snapshot so every client knows every other player's Core level, not just their
own) - this wasn't strictly required by the check (which is a solo debug/screenshot check) but was cheap
and keeps multiplayer visuals consistent with what each player sees of themselves.

**Check status**: `setCoreLevel(lv)` debug hook (bypasses coreCap/cost) lets any core be set to any level
1-10 directly, matching the brief's own check wording ("a debug command sets each core to levels 1, 3, 5,
7, 9 and 10"). Verified for the Joint: 6 distinct form names, strictly increasing damage, and a visible
size/glow difference between Lv1 and Lv10 screenshots. Verified the Grinder's full disc lifecycle (spawn,
travel, hit, return, catch) and the Bong's tap/hold split with real frame-stepping, not just inspecting the
spawned-shot shape. Verified online in 2 real browser tabs: a Grinder Lv10 attack and a Lighter Lv10 charged
attack both ran with zero console errors on either client. `node --check` clean throughout.

Pushed to `main`. Next: Step 6 (Levels become real, per Brief v1.1 B1).
