# KUSH QUEST — Merged Build Plan (v0.8 + v0.9 + v1.0 + v1.1)

Written by the main coding session after reading all four briefs against the current code.
**v1.1 overrides v0.8/v0.9/v1.0 wherever they disagree.** This plan is the single build order —
nothing in it gets built twice, and nothing already-good gets thrown away without a note saying why.

Status as of this plan: v0.8 Phases 0-8 complete and pushed. v0.9 Phase A (smoke clouds) and
Phase C (block/parry/dodge/enviro weapons) complete and pushed. v0.9 Phase B was next in line
when v1.1 arrived — paused, re-sequenced below. A separate chat ("the drive agent") independently
built Hotbox Highway (v1.0 Part 1) in `public/drive.js` — solo working, online seats still TODO,
not yet hooked into `game.js`. See `claude/AGENT_NOTES.md`.

---

## 1. What's already done and SURVIVES v1.1 as-is

- Core movement/combat loop: WASD move, mouse-aim facing, 3-hit combo, lunge/air/charge attacks,
  Cooked meter, revive, combo counter, sitting/smoke-spot scene.
- Hazards per theme (park/beach/suburb/city/woods/hq) and the 5 new enemy variants
  (crab/lawnmower/segway/owl/securitybot) from v0.8 Phase 5 — v1.1 Part A6 *adds* enemy weapons
  on top of these, doesn't replace them.
- Smoke cloud world mechanic (v0.9 Phase A): clouds that confuse enemies, hide players, ignite on
  fire contact, regen Cooked for crewmates. v1.1's Bong ("Percolator"/"Gravity Beast"/"Mothership"
  forms), the Zippo Flick, Leaf Blower and Gravity Bong Cannon Wild weapons all key off this same
  cloud system — it's load-bearing infrastructure now, not just a Phase A feature.
- Block/parry/dodge-roll/minimal-shove (v0.9 Phase C) — stays, and now also becomes the counter
  for v1.1's new enemy weapons (riot shield cops need "hit from behind or stun", net launchers
  need a crewmate to free you faster — parry/block interacts naturally with both).
- Achievements + Stats page (v0.8 Phase 8) — stays; a handful of achievement conditions need
  updating once `save.spots` semantics change (see §2).
- Farm Hub, Strains, Pets, Remix, Daily Challenge (v0.8 Phase 7) — stays; only the *unlock gate*
  and *price* change (see §2, §4).
- Armor upgrade line (Comfy Hoodie → Tie-Dye Vest → Rasta Crown) — not mentioned in v1.1, kept.

## 2. What v1.1 makes unnecessary — REMOVE

- **Buying the 6 weapons in the shop / owning them as a flat list** (`save.weapons`,
  weapon shop entries). Gone — replaced by the two-slot Core/Wild system (Part A1).
- **The separate throw button + throwable ammo** (`save.throws`, Rolling Papers/Nug Bombs/Smoke
  Grenade as bag items, the `throwsel` key). Gone — these become Wild weapons; the throw key
  becomes "USE WILD".
- **`WEAPON_LV3` perk text and the LV2/LV3 upgrade model.** Gone — replaced by each Core's
  10-level named-form evolution table (Part A2).
- **The standalone environmental-weapon pickups I just built in Phase C** (Trash-Can Lid, Traffic
  Cone, Surfboard, Office Chair with a discrete "uses" counter). v1.1 doesn't list these in its
  Wild pool by name, but the *mechanism* — a temporary pickup that replaces your melee weapon and
  eventually runs out — is now the Wild-weapon system running on Resin. **Decision (flagging for
  your okay): fold these 4 into the Wild pool as extra reskins** (Lid → a stun-bash alt in
  Park/Suburbia next to Bong Hammer, Office Chair → an HQ ram alt next to Hookah Whip) rather than
  deleting the art/logic outright, but they'll run on Resin charge like every other Wild weapon,
  not a discrete use-counter.
- **`SPOTS_TO_FARM` / `save.spots` as the farm gate and world-unlock counter.** Gone — replaced by
  world/level completion tracking (Part B1) plus "Killjoy beaten + coins" for the farm (Part B4).
  This is the single biggest data-model change: `save.spots` is currently read in ~10 places
  (map unlocks, remix trigger, farm gate, stats screen, achievements) and all of them need to move
  to the new per-level-completion save shape.
- **Chill Mode.** Never built (it was only ever mentioned in v0.9 Phase F), so there's nothing to
  remove in code — just confirming it's off the list.

## 3. What needs REWORK (not a straight remove, not a straight add)

- **Dab Saber's fate is undefined in v1.1** — it's not one of the 4 Cores (Joint/Lighter/Bong/
  Grinder) and it's not in the Wild pool table either. **Decision (flagging for your okay): keep
  it as an extra Wild weapon** (long-reach piercing crit poke, Downtown/HQ) since the brief
  encourages the pool to "keep innovating" and doesn't say to cut it. Say if you'd rather it be
  fully retired.
- **Gear Pack items from v1.0 Part 2** (Zippo, Hacky Sack, Apple Pipe, Gravity Bong, Vape Pen,
  Incense, Air Freshener, Hookah, Lava Lamp, Blacklight, Rolling Tray, Tie-Dye Tapestry) — most of
  these are *explicitly* Wild weapons or consumables in v1.1's own tables now, so they're not lost,
  just redistributed: Zippo Flick/Hacky Sack/Gravity Bong Cannon/Apple Pipe/Lava Lamp Mace →
  Wild pool; Vape Pen → personal-only consumable; Hookah/Blacklight/Rolling Tray/Tie-Dye Tapestry →
  stay as farm upgrades/cosmetics; Incense/Air Freshener → stay Highway-only items.
- **Consumables/pickups from v0.8 Phase 6** (Hash, Shatter, Kief, Diamonds, Stash Pouch, etc.) —
  need trimming against Part A4's short list (Munchies max 3 + 2 others, shareable via GIVE,
  Soda/Golden Leaf/Vape Pen personal-only). Some are already close matches; a few overlap and get
  cut per A4's "remove any other consumables that overlap" instruction.
- **Boss roster / world themes** — the 6 base themes and per-world bosses stay conceptually, but
  the whole world/level *count and structure* is rebuilt (see §4). Boss AI and hazard code are
  reused, not rewritten.
- **Hotbox Highway placement** — the drive agent's `drive.js` mechanics are reused wholesale
  (v1.1 Part B2 says so explicitly), only the *trigger site* changes: once per world, right after
  that world's mini-boss, instead of between every level pair. This is a small hook-up change in
  `game.js`'s map logic, not a rewrite of `drive.js`.
- **Grades (S/A/B/C)** — referenced by v0.9 Phase H ("mission grades on the map") and now required
  by v1.1 Part B5 (world-select %, level node grades) and Part B4 (Astral Plane unlock = S grade on
  all 6 world bosses). **No grading system exists yet anywhere in the codebase.** This needs to be
  designed fresh: proposed formula is a weighted score from time, no-deaths, coins/secrets found,
  and combo — tuned once World 1 is playable end-to-end. Flagging as new work, not a hidden brief
  requirement I'm quietly inventing.

## 4. What's genuinely NEW

- **Section A (weapons/difficulty/enemies):** two weapon slots, 4 Core weapons with 10-level
  evolution trees, the Wild weapon pool + Resin economy, trimmed shareable consumables, crew
  lives + checkpoints + crew-wipe/out-of-lives handling, the economy fix, new enemy weapons per
  world with telegraphs, and the Part A7 playtest bug fixes.
- **Section B (world structure):** 6 worlds / 49 levels + 6 secrets, mini-bosses, per-world maps,
  level types (BRAWL/GAUNTLET/ESCORT/CHASE/HAZARD/SECRET), the chunk-based level-recipe builder,
  inter-world cutscenes, the once-per-world Highway, **5 new transit mini-games** (Lazy River,
  Paper Plane, Munchie Truck, Smoke Balloon, Bong Rocket) each with a genuinely different control
  scheme, the farm/economy retune, and save/UI updates (world %, secrets found, grades).
- The 5 transit games are a *lot* of net-new, self-contained work — see §6 for how that's split
  off so it doesn't block Section A.

## 5. Build order

Dependencies that decide the order: Section A's Core weapons touch the same `attack()`/`weaponDef`
code paths as everything else in combat, so it has to land and be stable before the world rebuild
starts (world building doesn't care what the weapons do, but *I* can't safely juggle both at once
in one file). The 5 transit games don't depend on Section A or B1 at all — they're standalone,
like `drive.js` was — so they can be built in parallel starting now.

1. **Section A** (weapons, Wild/Resin, consumables, crew lives, enemy weapons, playtest fixes) —
   main session, in `game.js`/`server.js`/`index.html`. Old-save migration (owned weapons → Resin/
   coins, weapon levels → core levels) lands in the same pass since it's part of A1's contract.
2. **Part B1** (world/level restructure: 6 worlds, per-world maps, level types, chunk/recipe
   builder) — main session, once Section A is stable. This is the largest single piece of work in
   either section.
3. **Part B2** (Highway re-hook to once-per-world) + **Part B4** (economy/farm gating) + **Part
   B5** (save/UI: world %, secrets, grade design) — main session, right after B1 since they need
   the new world/level shape to hook into.
4. **Transit games** — built in parallel with 1-3 by a second agent (see §6), then hooked into the
   world-select map by the main session as each one is ready and as B1 lands.
5. **v0.9 Phase B** (co-op-first: drop-in, team chests, boss loot vote, Blunt-Bat-launch friendly
   chaos, munchie steal, spectator) and the remaining v0.9 polish phases (E Smoke Runs, F Astral
   Plane/cosmetics, G/H/I/J humor/pacing/sharing/polish) — after Section A + B1-B5, since they're
   additive on top of a stable weapon/world model rather than blocking it. Astral Plane's unlock
   condition already needs to change to "S grade on all 6 world bosses" per v1.1 Part B4.

## 6. Who's touching which files (so nothing collides)

| Area | Files | Owner |
|---|---|---|
| Section A (weapons/Wild/Resin/consumables/crew lives/enemy weapons) | `public/game.js`, `server.js`, `public/index.html` | Main session |
| Part B1/B2/B4/B5 (world rebuild, Highway hook, economy, save/UI) | `public/game.js`, `public/index.html` | Main session |
| v0.9 Phase B and remaining polish phases | `public/game.js` | Main session (or a follow-up agent round once Section A/B lands) |
| Hotbox Highway itself | `public/drive.js`, `public/drive-test.html` | The drive agent (separate chat) — untouched by anyone else, per `AGENT_NOTES.md` |
| **5 transit mini-games + shared seat/swap/handoff/results framework** | new files: `public/transit.js` (shared) + `public/lazyriver.js`, `public/paperplane.js`, `public/munchietruck.js`, `public/smokeballoon.js`, `public/bongrocket.js`, plus a `*-test.html` per game | **A new subagent ("Game coding speed")**, spawned now, working the same way the drive agent did: self-contained files, its own test harnesses, a documented `<Game>.start({...})`/`onDone({...})` contract mirroring `Drive.start`/`onDone`, and its own `AGENT_NOTES.md` entry. Does not touch `game.js`, `index.html`, `server.js`, or `drive.js`. |

The transit-game subagent starts immediately in parallel with Section A — its work has zero
dependency on the weapon rework or the world restructure. I'll hook each finished game into the
new per-world map as Part B1 lands and as each game is ready, one at a time, testing after each
hookup (same pattern used for the Highway).

## 7. Open questions for you (not blocking, but flagging before I build past them)

1. OK to fold the 4 environmental weapons (Lid/Cone/Surfboard/Chair) into the Wild pool as extra
   reskins instead of deleting them outright? (§2)
2. OK to keep Dab Saber alive as an extra Wild weapon rather than retiring it? (§3)
3. The grade (S/A/B/C) formula doesn't exist yet anywhere — I'll design a reasonable default
   (time + no-deaths + secrets/coins + combo) and tune it once World 1 is fully playable, unless
   you want to specify the formula now.

If I don't hear otherwise I'll proceed with the defaults above once you give the go-ahead to start
building.
