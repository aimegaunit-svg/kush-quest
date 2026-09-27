# KUSH QUEST — Brief v1.4: World 1 + World 2 Content Pack

> ## READ FIRST: reconciliation with live `main` @ `886519d` (added 2026-09-26)
> This brief was written against `1264e6a`. Since then, `0174982` (10 new tint skins, `SPD_MUL`) and `cf19d39` (Wild weapons are now guns that **replace Core**, with no Q-toggle) have shipped. **Where the brief below disagrees with those commits, these decisions win:**
>
> 1. **The art is now in the repo:** `public/assets-w12.js` + `public/assets-w12-preview.html` (this commit). Part 0 can start.
> 2. **`jogger`:** a cop-family tint with the same id already exists. **The new sprite REPLACES that tint's art** (same id, so saves and `save.met` keep working). Move `jogger` **out of the `cop` family** into the new `charger` AI (Part 1), and drop its `SPD_MUL` entry (the charger has its own speeds).
> 3. **`crab`:** the same situation (a squirrel-family tint). The new sprite replaces the tint art, and `crab` gets its own small AI per Part 1. Remove it from the `squirrel` family.
> 4. **Keep all 10 skins from `0174982`** (birdwatcher, yogamom, pigeonlady, skateboarder, patrol, influencer, beachbum, surfer, parrot + jogger) and their tricks (yoga-mat root, life-ring stun, feather blind).
>    - `W12_ROSTER` in Part 5 is the **base** roster. `enemiesForLevel()` still swaps in family skins on top, but never swaps out that level's intro kind.
>    - The existing **yogamat/lifering eshots and `me.rootT/stunT/blindT`** are the conventions to reuse, e.g. Rick's bear trap uses `me.rootT`.
> 5. **Part 3 (Wild weapons): the LIVE gun system wins.**
>    - Don't touch the Park/Beach pools. They stay `budbustershotgun`, `nuglauncher`, `dankdragonflamer` and `seaweedsmg`, `cannonballbazooka`, `tikitorcher`, plus `applepipe`.
>    - **Skip §3.2 (Frisbee/Kite/Super Soaker/Umbrella) and §3.4 (pools/`WILD_UNLOCK_AT`) for now.** Re-spec them later under the replace-Core model if wanted.
>    - **Still do:**
>      - §3.1 icons: use `icon_applepipe`, and the old melee icons for the other worlds' pools that still use them.
>      - §3.3: the seagull steals the quick *consumable* item. That's unrelated to Wild weapons, so it still applies.
>    - The `wildrack` prop is optional art for the ambush-zone Wild pickup.
>    - The `held_*` sprites and `frisbee`/`waterblast` projectiles are unused until then.
> 6. **Boss signature states 50/51 stay** exactly as shipped, and become one entry in each boss's pattern list (Part 2.2).
> 7. **Check `server.js`'s `eshot` whitelist** for any new fields the new projectiles need (e.g. `vz` was a past miss). New `k` strings pass through already.
> 8. Build and commit order: Part 0 → 1 → 2 → 4 → 5 → 6. Part 3 only does the items listed in point 5. Add a section to `claude/AGENT_NOTES.md` after each Part, as usual.

---

**Scope:** The Park (6 levels + secret) and The Beach (7 levels + secret) only. This brief builds the **shared systems** that Worlds 3–6 will reuse, so later worlds mostly need new art.
**Builds on:** GitHub `main` @ `1264e6a` ("Boss/enemy content pass for Park+Beach"). Keep everything that commit added: the `scout`/`tourist` tints, `ENEMY_FAMILY` + `enemiesForLevel()`, veteran levels, and the dart/taserbolt signature (states 50/51).
**Design source:** the ROSTER_PLAN (since retired; everything needed is in this brief).
**The same ground rules apply:**
- no npm dependencies,
- host-run AI with network sync,
- never break old saves,
- test solo and with 2–4 tabs,
- commit after each Part, and update the README and the design doc.

---

## Part 0: Files delivered with this brief

| File | What it is |
|---|---|
| `public/assets-w12.js` | **All the art.** 45 sprites and 82 frames, as string-row pixel art in exactly the `sprite()`/`P` format `game.js` uses. It's pure data on `window.KQ_W12`. |
| `public/assets-w12-preview.html` | Open it in a browser to see every sprite, frame and animation at 3–6×, with a flip toggle. It's the visual reference for this brief. |
| `docs/BRIEF_v1.4_W12.md` | This file (also in the project as `claude/BRIEF_v1.4_W12.md`). |

### 0.1 Loading
In `public/index.html`, add this **before** `game.js`:
```html
<script src="assets-w12.js"></script>
```
In `game.js`, right after the `ENEMY_IMG`/`ENEMY_FLASH` tint block (the `for (const k of ['ranger', ... 'tourist'])` line, about line 1205):
```js
// v1.4: World 1-2 content pack art (public/assets-w12.js)
const W12 = window.KQ_W12 ? KQ_W12.build(sprite, P) : {};
const W12_ENEMIES = ['jogger', 'pigeon', 'dog', 'dogwalker', 'parkranger', 'scout', 'goldsquirrel',
  'crab', 'treasurecrab', 'seagull', 'beachbro', 'metaldetector', 'jellyfish', 'atv'];
const W12_BOSSES = ['pete_cart', 'pete', 'rangerrick', 'rangerrick_atv', 'barb', 'lance'];
for (const k of [...W12_ENEMIES, ...W12_BOSSES]) if (W12[k]) { ENEMY_IMG[k] = W12[k]; ENEMY_FLASH[k] = W12[k].map(flashOf); }
// scout + crab: the new art REPLACES the old tints of the same id (same id, so saves/ENEMY_FAMILY keep working)
```
Projectiles, props, icons and held sprites are read straight from `W12.<id>[frame]`.

### 0.2 Art conventions (important)
- **Frame arrays hold 2–3 frames**, not the fixed `[idle, attack]` pair. Every asset's `frameNames` lists them in order. `drawEnemyB` currently does `imgs[Math.floor(frame/10) % 2]`. Replace that with a per-kind **frame picker** (§1.3).
- **Facing:** every new sprite faces **RIGHT** (flip when `dir < 0`). The one exception is `scout`/`goldsquirrel`, which are squirrel-shaped and face **LEFT**, like the existing squirrel. Keep their `ai: 'squirrel'`, so the existing flip rule in `drawEnemyB` (`e.ai === 'mouse' || e.ai === 'squirrel' ? e.dir > 0 : e.dir < 0`) stays correct.
- **Boss scale:** the new boss sprites are larger than the 16×18 grunts (Rick 24×25, Barb 22×20, Lance 22×21, Pete-cart 32×24). Draw them at **`bs = 1.5`**, not 2. Add a `BOSS_SCALE = { pete_cart: 1.5, pete: 1.75, rangerrick: 1.5, rangerrick_atv: 1.5, barb: 1.5, lance: 1.5 }` lookup and use it before the `e.mega ? 2.5 : 2` default.
- **Render from `e.state` only.** The `es` snapshot already syncs `e.state`, `e.dir` and `e.h`. If each frame choice is a pure function of `(kind, state, frame)`, clients animate correctly with **no new net fields**.

---

## Part 1: Five new enemy behaviours (shared systems)

### 1.1 Registration
Add new `ai` values to `BASE_AI`. Branch on them in the enemy update loop the same way the existing `lawnmower` does (`else if (e.kind === 'lawnmower')`), using `else if (e.ai === 'charger') { ... }` and so on, placed **before** the `e.ai === 'cop'` branch.

```js
// v1.4 additions to BASE_AI
jogger: 'charger', pigeon: 'flyer', dog: 'swarm', dogwalker: 'summoner', parkranger: 'cop',
scout: 'squirrel', goldsquirrel: 'squirrel', crab: 'crab', treasurecrab: 'crab',
seagull: 'flyer', beachbro: 'grabber', metaldetector: 'planter', jellyfish: 'planter', atv: 'rider',
```
- `crab` gets its own tiny AI: a cop-style chaser, but X speed 1.6× and Z speed 0.4×.
- `ENEMY_FAMILY` needs new families so `enemiesForLevel()` has something to swap between:
```js
charger: ['jogger'], flyer: ['pigeon', 'seagull'], grabber: ['beachbro'], planter: ['metaldetector'],
crab: ['crab', 'treasurecrab'],
squirrel: [...existing, 'goldsquirrel'],   // goldsquirrel only ever via a secret-level recipe, never a random swap (filter it out in enemiesForLevel)
```
`VARIANT_HP` (extra HP on top of 1): jogger 1, pigeon 0, dog 0, dogwalker 1, parkranger 1, goldsquirrel 2, crab 1, treasurecrab 4, seagull 0, beachbro 4, metaldetector 1, jellyfish 2, atv 3.

### 1.2 State numbers
The existing reserved state ranges are: 0–7 (core), 10–26 (world tricks), 30–31 (park dart) and 50–51 (boss signature). **The new behaviours use 60–89, and new boss patterns use 90–129**, so nothing collides.

| AI | States | Behaviour | Numbers (tune) |
|---|---|---|---|
| **charger** (jogger) | 60 approach → 61 telegraph → 62 dash → 63 recover | Approach to within 70px on X. **Telegraph:** 26 frames, stops, shows `!`, and locks `dashDir` + `dashZ` (it can't turn during the dash). **Dash:** 3.4 px/frame for 40 frames, and **Z stays fixed**, so moving on Z dodges it. A player hit takes 1 damage + knockdown (reuse the knockback in `hurt()`). Leaving the screen = wrap around and re-enter 90 frames later (the "jogging loop"). **Recover:** 50 frames, vulnerable, takes +1 damage. | speed 1.2 approach |
| **flyer** (pigeon, seagull) | 64 hover → 65 swoop → 66 climb | Hover at `h = 34 ± sin` above a player's X ± 30. After a cooldown of 90–150 frames (random, seeded by `e.id`), swoop diagonally to `h = 4` at the player's position (22 frames), then climb back (30 frames). It can only be hit by melee while `h < 14`, but ranged/Grinder hits it at any `h`. **Pigeon:** 1 damage peck. On death, every pigeon of the same flock scatters (state 66 for 60 frames). **Seagull:** instead of damage it **steals the quick item** (see §3.3) and flies off-screen (state 67), dropping the item if it's KO'd before it leaves. | flock size 3 (+1 per extra player) |
| **swarm** (dog) | 68 surround → 69 nip | Pick an offset slot around the target (the angle comes from `e.id`) and orbit to it at speed 1.8. When within 10px: nip (8-frame wind-up, 1 damage at 50% chance to avoid chip-damage spikes). It ignores smoke confusion **half** the time (dogs smell through it). When its owner (`e.owner` = the dogwalker id) is KO'd: set `e.fleeing`, and it runs off-screen and despawns (it doesn't count as a kill and gives no coins). | 1 HP |
| **summoner** (dogwalker) | 70 keep-distance → 71 release | Stays 90px from the nearest player. Every 240 frames, if she has fewer than 3 dogs alive: 18-frame release animation (frame `release`), then push a `dog` enemy with `owner = e.id`, `reserve: true`, and the same zone. Mirror how `summonAdds()` pushes reserve enemies so the host/snapshot path is identical. She has 4 dogs max per life. | — |
| **grabber** (beachbro) | 72 approach → 73 flex → 74 grab → 75 hold → 76 throw | Slow approach (0.8). **Flex** every 300 frames for 60 frames: **super armor** (takes damage, but no knockback/stun/launch; set `e.armor = true`, and have `hitEnemy` skip knockback when it's set). **Grab:** when within 14px, a 20-frame wind-up (arms-out frame). If the player is still in range and not rolling, **hold** them: the player sets `me.grabbedBy = e.id` and can't move or attack. The hold lasts up to 90 frames. Break out by **mashing attack 8 times**, or when **a crewmate hits the bro once** (co-op: breaking it gives a "BRO, LET GO" popup). **Throw:** the player is launched toward the nearest *other* player or enemy, and landing hurts both for 1. | HP 5 |
| **planter** (metaldetector) | 77 sweep → 78 dig → 79 throw | Wanders slowly. Every 200 frames: **dig** (40 frames, the `dig` frame, with sand particles), then **throw** 1 `junk` projectile (an arcing lob like the woods pinecone `s.k === 'pinecone'`, k = `'junk'`, 1 damage). It also **picks up dropped coins** within 20px: they disappear into `e.stolen`, and KO'ing it pays them back (reuse the thief payout). | — |
| **planter** (jellyfish) | 80 drift → 81 charge → 82 zap | It's placed only in the **shallows lane** (Z ≥ ZMAX − 20) and drifts left/right slowly. It never chases. It charges for 30 frames every 180 frames (`zap` frame), then does a 20-frame shock with radius 16. **Wet** players (`me.wetT > 0`, see §3.2) take **2 damage** instead of 1. Touching it while it's not zapping = 0 damage. Killing it with fire does nothing extra; killing it with water = instant pop. | HP 3 |
| **rider** (atv) | 83 enter → 84 pass → 85 turn → 86 dismounted | Enters from the screen edge in a random lane, and **passes** at 3.2 px/frame, hurting anything in its path (players 1 damage + knockdown; enemies too, which is a bait opportunity). At the far edge it **turns** (40 frames, off-screen), then picks a new lane with a 30-frame lane warning (a flashing arrow at the screen edge). **Knocking the rider off:** any **jump attack** or **launch** hitting the ATV, or 4 total hits. That switches it to state 86: the ATV sprite is left as a wreck prop, and a `tourist` (existing tint) spawns at the rider's position with `ai: 'cop'`, so it becomes a normal chaser. | ATV HP 4 |

**Telegraphs:** every wind-up state shows a glyph over the enemy (the same `text(...)` pattern already in `drawEnemyB`):
- charger 61 `!`
- flyer swoop `v`
- dog nip `*`
- grab `!!`
- jellyfish charge `~` (yellow)
- rider lane-warning arrow at the screen edge

### 1.3 Frame picker
Replace the `f = Math.floor(frame/10) % 2` logic for these kinds with a lookup. Sketch:
```js
const W12_FRAME = {
  jogger: e => e.state === 62 ? 2 : (e.state === 60 ? 1 : 0),
  pigeon: e => e.state === 65 ? 2 : (Math.floor(frame / 5) % 2),
  seagull: e => e.state === 65 || e.state === 67 ? 2 : (Math.floor(frame / 8) % 2),
  dog: e => e.state === 69 ? 2 : Math.floor(frame / 6) % 2,
  dogwalker: e => e.state === 71 ? 1 : 0,
  parkranger: e => e.state === 30 || e.state === 31 || e.whistleT > 0 ? 1 : 0,
  scout: e => Math.floor(frame / 8) % 2, goldsquirrel: e => Math.floor(frame / 8) % 2,
  crab: e => e.state === 2 ? 2 : Math.floor(frame / 6) % 2, treasurecrab: e => Math.floor(frame / 6) % 2,
  beachbro: e => e.state === 73 ? 1 : (e.state >= 74 ? 2 : 0),
  metaldetector: e => e.state === 78 ? 1 : 0,
  jellyfish: e => e.state === 81 || e.state === 82 ? 2 : Math.floor(frame / 14) % 2,
  atv: e => Math.floor(frame / 4) % 2,
};
```
Bosses get the same kind of picker (see Part 2).

### 1.4 Briefing cards: "NEW BUZZKILL"
When `briefT` shows a level containing a kind that isn't in `save.met`, show a card with the sprite (frame 0, 3×), the name and a **one-line counter** tip. `save.met` already exists.

| kind | Card name | Counter line |
|---|---|---|
| jogger | JOGGER | "HE CAN'T TURN MID-SPRINT. STEP UP OR DOWN." |
| pigeon | PIGEON FLOCK | "HIT ONE, THE REST SCATTER. JUMP-SWING THEM." |
| dogwalker | DOG WALKER | "TAKE HER OUT AND THE DOGS GO HOME." |
| parkranger | PARK RANGER | "HIS WHISTLE CALLS PIGEONS. SHUT HIM UP FIRST." |
| crab | CRAB | "FAST SIDEWAYS, SLOW UP/DOWN." |
| seagull | SEAGULL | "IT STEALS YOUR QUICK ITEM. SMACK IT BEFORE IT FLIES OFF." |
| beachbro | BEACH BRO | "DON'T HIT HIM WHILE HE FLEXES. MASH TO ESCAPE A GRAB." |
| metaldetector | METAL DETECTOR GUY | "HE POCKETS DROPPED COINS. KO HIM TO GET THEM BACK." |
| jellyfish | JELLYFISH | "ONLY HURTS WHEN IT GLOWS. DOUBLE DAMAGE IF YOU'RE WET." |
| atv | BEACH PATROL ATV | "WATCH THE EDGE ARROWS. JUMP-HIT TO KNOCK THE RIDER OFF." |

---

## Part 2: Boss framework and the 4 World 1–2 bosses

### 2.1 Unique sprites
`bossDataFor(n)` currently returns `seededPick(n, 0, theme.enemies)` as the boss kind. Add a lookup that wins over that:
```js
const BOSS_KIND = { 'PARK RANGER PETE': 'pete_cart', 'RANGER RICK': 'rangerrick', 'BEACH PATROL BARB': 'barb', 'LIFEGUARD LANCE': 'lance' };
// in bossDataFor: const kind = BOSS_KIND[wd.miniName] || seededPick(n, 0, theme.enemies);   (same for bossName)
```
Keep `e.ai` = the existing `BASE_AI` fallback, so every existing `bossAI` path still works. Pete → `'cop'`, Rick → `'cop'`, Barb → `'karen'`, Lance → `'cop'`.

### 2.2 Pattern list instead of one signature
Give each boss a **pattern list**, and cycle through it with `e.pat` (index) and `e.patCd`. The existing 50/51 dart/taser ring becomes **one entry** in Rick's and Lance's lists. Structure:
```js
const BOSS_PATTERNS = {
  pete_cart: ['cartRam', 'cartRam', 'tickets'],        // phase 1 (on cart)
  pete: ['tickets', 'brawl'],                            // phase 2 (on foot)
  rangerrick: ['rake', 'traps', 'sigRing', 'brawl'],     // rage -> 'atvPhase'
  barb: ['megaphone', 'buoys', 'brawl'],
  lance: ['lasso', 'surfDash', 'sigRing', 'brawl'],      // rage -> 'wave'
};
```
- In `bossAI`, when the boss is idle and `e.patCd <= 0`, start `BOSS_PATTERNS[e.kind][e.pat++ % len]`.
- `'brawl'` = fall through to the existing brawler code.
- `'sigRing'` = the existing `e.state = 50` entry.
- Remove the current `e.mega && (wk === 'park' || wk === 'beach')` trigger. The list now decides when the ring fires.
- Pattern cooldown: 70 frames (50 in rage).

### 2.3 PARK RANGER PETE (mini-boss, 1-3). HP: current mini value.
**Phase 1 (cart, `pete_cart`, bs 1.5):**
- **cartRam** (states 90–92): exits to the screen edge (90, 30 frames). Then a 40-frame lane warning arrow, after which he **drives across** at 3.6 px/frame in a fixed lane (91), hurting players 1 + knockdown. He parks at the far edge (92, 40 frames). While parked, he is **vulnerable and takes double damage**. The `honk` frame flashes during the warning.
- **tickets** (93): from the cart, throws a fan of 3 (5 in rage) `ticketbook` projectiles (`eshots` k = `'ticket'`, 1 damage). Each hit also puts a **"FINED!" −3 coins** popup on the player (host-authoritative: send `{ t: 'fine', amt: 3 }` to the hit player, who subtracts it locally).

**Phase change at 50% HP:** the cart breaks down (a smoke burst plus a `wreck` prop left behind using `pete_cart` frame 0 at 50% alpha). `e.kind = 'pete'`, `bs = 1.75`, and the phase-2 list takes over. Send `{ t: 'bphase', id, kind: 'pete' }` so clients swap the sprite; `kind` isn't in the snapshot.

**Phase 2 (on foot):**
- **tickets** again (from the ground, 5 shots).
- **brawl**.

### 2.4 RANGER RICK (boss, 1-6), `rangerrick`, bs 1.5
- **rake** (94–95): 30-frame wind-up (the `rake` frame, a low sweep line drawn along the ground as a warning). Then a **ground sweep** across 120px in front of him at Z ± 12. Players with `h < 6` take 1 + knockdown, so **jumping avoids it**.
- **traps** (96): drops 3 `beartrap` props at the players' current positions, each with a 50-frame arming flash.
  - An armed trap snaps on contact, which **roots** the player for 70 frames (reuse `me.rootT` from the mousetrap world trick) and switches to the `snapped` frame.
  - Traps also catch enemies (they're stunned for 90 frames).
  - A trap disappears after 600 frames or once it snaps.
  - Traps are props, so sync them with `{ t: 'prop', k: 'beartrap', x, z, id }` and `{ t: 'propsnap', id }`.
- **sigRing**: the existing state 50/51 dart ring. Use the `spin` frame during 50/51.
- **Whistle adds:** replace `summonAdds` kinds for Rick with `['jogger', 'jogger', 'pigeon', 'pigeon', 'pigeon']`.
- **Rage (≤ 50%), atvPhase:** `e.kind = 'rangerrick_atv'` (send `bphase`), and switch to the rider loop from §1.2 (states 83–85) at 3.8 px/frame.
  - Every pass drops 1 bear trap.
  - After 4 passes, the ATV stalls for 150 frames (he's vulnerable, takes 2× damage), then it repeats.
  - He never dismounts. A KO ends the fight.

Rick's frame picker:
- `rake` for 94–95
- `spin` for 50–51
- `idle` otherwise
- the ATV alternates its 2 frames

### 2.5 BEACH PATROL BARB (mini-boss, 2-4), `barb`, bs 1.5, `ai: 'karen'`
- **megaphone** (100–101): 24-frame wind-up (the `megaphone` frame, with `!!`). Then a **sonic cone**: 110px long, ±20 Z, in the direction she faces. Players get knocked back 60px and dazed for 30 frames. The cone **deletes any smoke clouds** inside it (use `lvl.clouds` and remove the overlapping ones). Draw the cone as 3 expanding arc lines.
- **buoys** (102): kicks 2 (3 in rage) `buoy` projectiles that **roll along the ground** (`h = 0`, vx ± 2.2) and **bounce off the zone walls once**. 1 damage + knockdown. Jumping clears them. They can be hit back with any attack, which reverses vx; a reflected buoy does 2 damage to enemies.
- **brawl**: the existing karen-style volley pattern.

### 2.6 LIFEGUARD LANCE (boss, 2-7), `lance`, bs 1.5
- **lasso** (104–106): 20-frame wind-up (the `lasso` frame), then throws a `rescuetube` projectile in a straight line (2.8 px/frame, 140px max). Draw a 1px `#ff5a6a` rope from his hand to it. On a player hit, **pull** them to 20px in front of Lance over 25 frames (the player can't act), then he follows up with a free punch attempt (a normal brawl strike). Block/parry on contact cancels the pull.
- **surfDash** (107–108): the `lance_board` prop is drawn under him (at his feet, scaled with bs). He leaves a 30-frame edge warning, then **dashes the full zone width** at 5 px/frame at the player's Z. The dash leaves a 2-second **wet streak** on the floor, and players touching it get `me.wetT = 180` (see §3.2).
- **sigRing**: the existing taserbolt ring. Use the `spin` frame during 50–51. Wet players take 2 damage from taserbolts.
- **Rage (≤ 50%), wave** (110–113): every 3rd pattern becomes a **tidal wave**.
  - A 60-frame warning: "SURF'S UP!" banner, and the screen edge flashes blue.
  - Then a wave hitbox (a full-height screen band, 40px wide) sweeps across at 2.6 px/frame, with Lance surfing on top (the board is drawn, and Lance is untouchable during the wave).
  - Players must **jump** (`h > 10`) as it passes, or take 1 damage + knockdown + `wetT = 240`.
  - Draw the wave as stacked `#7ac8ff` / `#ffffff` rectangles with foam particles (the same `puff` helper).
- **Adds:** `['crab', 'crab', 'tourist', 'seagull']`.

### 2.7 Net sync summary (new messages)
| msg | Direction | Payload | Purpose |
|---|---|---|---|
| `bphase` | host → all | `{ id, kind }` | boss sprite and phase swap (Pete cart→foot, Rick→ATV) |
| `fine` | host → hit player | `{ amt }` | the Pete ticket coin fine |
| `prop` / `propsnap` | host → all | `{ k, x, z, id }` / `{ id }` | bear traps (reuse this for jellyfish-free zone props later) |
| `grab` / `ungrab` | host → grabbed player | `{ id }` / `{}` | Beach Bro hold. Mash progress is local, and the client sends `{ t: 'mash' }` × 8 → host ends the grab |
| `steal` (existing) | extend with `item` | `{ item }` | seagull quick-item steal/return |
| `eshot` (existing) | new `k` values | `'ticket'`, `'buoy'`, `'junk'`, `'tube'`, `'water'` | reuse the existing eshot path |

The wave, rake sweep and megaphone cone are pure functions of the boss state plus `e.t`, and both are already in the snapshot. Clients re-derive the hitboxes locally for their own player (the same way purses are checked).

---

## Part 3: Wild weapons for Worlds 1–2

### 3.1 Icons
Replace the `WILD_ICON_ID` borrowing for every weapon that has art in this pack. In the bag/HUD icon lookup:
```js
const wildIcon = id => (W12['icon_' + id] && W12['icon_' + id][0]) || ICONS[WILD_ICON_ID[id]] || ICONS.joint;
```
There are icons for: bonghammer, bluntbat, rollingpapers, applepipe, nugbombs, hackysack, frisbee, kite, supersoaker, umbrella, trashlid, surfboard.

### 3.2 Four new Wild weapons (add them to `ENV_WEAPONS`)
```js
frisbee:     { id: 'frisbee', name: 'FRISBEE', dmg: 2, cd: 26, reach: 90, zr: 12, kb: 1, cost: 2, charge: 20, ricochet: 4, desc: 'BOUNCES BETWEEN UP TO 4 BUZZKILLS, THEN FLIES BACK TO YOU' },
kite:        { id: 'kite', name: 'KITE', dmg: 2, cd: 30, reach: 30, zr: 14, kb: 2, cost: 1, charge: 22, glide: 1, desc: 'HOLD JUMP TO GLIDE. SWING IN THE AIR FOR A DIVE-KICK' },
supersoaker: { id: 'supersoaker', name: 'SUPER SOAKER', dmg: 1, cd: 8, reach: 70, zr: 8, kb: 2.2, cost: 1, charge: 26, soak: 1, desc: 'PUSHES THEM BACK AND SOAKS THEM (SHOCKS DO 2X). PUTS OUT BURNING HOMIES' },
umbrella:    { id: 'umbrella', name: 'BEACH UMBRELLA', dmg: 1, cd: 20, reach: 26, zr: 16, kb: 1.5, cost: 2, charge: 22, reflect: 1, desc: 'SPIN TO BLOCK AND REFLECT PROJECTILES. OPEN IT IN THE AIR TO FLOAT DOWN' },
```
New flags to handle in `attack()`:
- **`ricochet`:** spawn a player shot using the `frisbee` projectile frames (alternating). It flies to the nearest enemy, and on a hit retargets to the next closest *un-hit* enemy within 100px. After `ricochet` hits or 90 frames, it homes back to the thrower. Each hit sends the normal damage message.
- **`glide`:** while the Kite is **held and active**:
  - Holding jump after the apex caps the fall speed at `vh >= -0.35`.
  - An air swing does a **dive-kick**: a diagonal down-forward drop at 3.2 px/frame, 2 damage + knockdown on landing within 16px.
  - Draw `held_kite` above the player during the glide.
- **`soak`:** a stream of `waterblast` shots (fly frame, splash frame on hit), and each hit applies `e.wetT = 180`.
  - Wet enemies: **fire burns are removed** and they can't be ignited while wet, but **shock/taser/jellyfish damage is doubled**.
  - Spraying a crewmate removes their burn and sets their `wetT` (a co-op utility).
  - Players get `me.wetT` from the surf streak and the wave. Draw a drip particle every 12 frames when `wetT > 0`.
- **`reflect`:** while swinging (the `atkT` window + 10 frames), any `eshot` within 20px of the player's front is **reversed** (`vx *= -1.4`) and flagged `fromPlayer`, which does 2 damage to enemies. In the air, holding jump caps the fall like `glide` (a slower cap of `-0.5`). Draw `held_umbrella` spun open.

`held_frisbee`, `held_kite`, `held_supersoaker` and `held_umbrella` are the in-hand sprites. Draw them wherever the existing wild-weapon held drawing happens, offset to the hand.

### 3.3 Seagull steals the quick item
When the seagull's swoop connects:
- If the player's quick item slot is empty, it does 1 peck damage instead.
- Otherwise the item is removed from the bag (`save`/`me` bag count − 1), the gull stores it as `e.loot = itemId`, and it goes to state 67 (flies up and away at 2.4 px/frame).
- Draw that item's icon in its feet (the `grab` frame rows 8–9 leave room).

KO'ing it before it leaves the screen **drops** the item as a normal pickup. If it escapes, the item is gone and the "SEAGULL'D!" popup shows.

### 3.4 Pools (replace `WILD_POOL_BY_THEME.park` / `.beach`)
```js
park:  ['frisbee', 'kite', 'bonghammer', 'bluntbat', 'rollingpapers', 'applepipe'],
beach: ['supersoaker', 'umbrella', 'rollingpapers', 'frisbee', 'nugbombs', 'hackysack'],
```
**Per-level gating** (§5): a Wild weapon can only roll once the level it's introduced on has been reached. Implement this as `WILD_UNLOCK_AT = { applepipe: 0, bluntbat: 0, frisbee: 1, bonghammer: 2, kite: 3, rollingpapers: 4, supersoaker: 6, umbrella: 8, nugbombs: 9, hackysack: 10 }` (global level indices n) and filter the pool by `n >= WILD_UNLOCK_AT[id]`.

**The first appearance of each weapon is guaranteed:** on its intro level, the weapon rack (the `wildrack` prop, drawn with the weapon icon on it) always rolls that weapon.

---

## Part 4: Elites and secret specials
| Elite | Where | Rules |
|---|---|---|
| `goldsquirrel` | the Park secret level (only) | `ai: 'squirrel'`. It steals **Resin** instead of coins (take 5 from the Resin bank on touch), runs at 1.3× speed, and emits a gold sparkle particle every 8 frames. KO drops **3× the stolen Resin + 15 coins**. 3 per secret level. |
| `treasurecrab` | the Beach secret level + a 10% chance in 2-6 and 2-7 (veteran levels) | Crab AI, HP 5, and **won't flee**. KO = a Resin jackpot (12) + a guaranteed Munchies drop. |

Add both to `briefT`'s NEW BUZZKILL card list:
- GOLD SQUIRREL: "IT'S STEALING YOUR RESIN! CATCH IT FOR A FAT PAYOUT."
- TREASURE CRAB: "CRACK THE SHELL FOR A JACKPOT."

---

## Part 5: Level-by-level introduction map (the recipe)
Level indices: Park = n 0–5, Beach = n 6–12, Park secret = 49, Beach secret = 50. Ranger Pete is at `miniAt: 2` and Rick at `bossAt: 5`; Barb is at `miniAt: 3` (n 9) and Lance at `bossAt: 6` (n 12).

Add a fixed per-level **roster override** that `enemiesForLevel()` uses as the base roster. It still does its 1–2 family swaps on top, but **never swaps out a kind introduced on that level**, so the intro is guaranteed.

```js
const W12_ROSTER = {
  0:  ['mouse', 'squirrel', 'cop', 'squirrel', 'mouse'],             // 1-1 tutorial: soft first wave (brief A5)
  1:  ['jogger', 'pigeon', 'cop', 'squirrel', 'mouse'],              // 1-2 NEW jogger, pigeons
  2:  ['jogger', 'pigeon', 'cop', 'scout', 'mouse'],                 // 1-3 MINI Pete
  3:  ['dogwalker', 'jogger', 'cop', 'pigeon', 'scout'],             // 1-4 NEW dog walker
  4:  ['parkranger', 'dogwalker', 'jogger', 'pigeon', 'scout'],      // 1-5 NEW park ranger (veteran)
  5:  ['parkranger', 'jogger', 'dogwalker', 'pigeon', 'cop'],        // 1-6 BOSS Rick (veteran)
  49: ['goldsquirrel', 'goldsquirrel', 'goldsquirrel', 'scout', 'pigeon'], // 1-S
  6:  ['crab', 'tourist', 'crab', 'mouse', 'tourist'],               // 2-1 NEW crab, taser
  7:  ['seagull', 'crab', 'tourist', 'squirrel', 'crab'],            // 2-2 NEW seagull, sand
  8:  ['beachbro', 'seagull', 'crab', 'karen', 'tourist'],           // 2-3 NEW beach bro, sunscreen
  9:  ['beachbro', 'crab', 'seagull', 'tourist', 'karen'],           // 2-4 MINI Barb
  10: ['metaldetector', 'jellyfish', 'beachbro', 'crab', 'seagull'], // 2-5 NEW detector guy, jellyfish
  11: ['atv', 'metaldetector', 'beachbro', 'seagull', 'crab'],       // 2-6 NEW ATV (veteran)
  12: ['atv', 'beachbro', 'crab', 'seagull', 'tourist'],             // 2-7 BOSS Lance (veteran)
  50: ['treasurecrab', 'treasurecrab', 'crab', 'seagull', 'jellyfish'], // 2-S
};
```
**Placement rules:**
- `jellyfish`: only spawned with `z >= ZMAX - 20` (the shallows), and max 2 per zone.
- `atv`: max 1 alive at a time. It doesn't count toward "zone cleared" (the zone clears when every *other* enemy is down, and then the ATV drives off).
- `pigeon`: it spawns as a flock. One roster slot = one flock of 3 (+1 per extra player), sharing `e.flock = id`.
- `dogwalker`'s dogs don't count toward zone clear, and they flee when she's down.

Wild weapon intro by level: 1-1 Apple Pipe + Blunt Bat · 1-2 Frisbee · 1-3 Bong Hammer · 1-4 Kite · 1-5 Rolling Papers · 2-1 Super Soaker · 2-3 Beach Umbrella · 2-4 Nug Bombs · 2-5 Hacky Sack.

---

## Part 6: Sounds (chiptune, via the existing `SFX` pattern)
Add these, each a short `tone()`-style blip like the existing `SFX.taser`/`SFX.karen`:
- `jogStep` (a light tick, on dash), `coo` (pigeon), `yap` (dog), `whistle` (a rising square wave), `pinch`, `squawk` (gull), `flex` (a low grunt), `beep` (metal detector), `zap` (jellyfish, reuse taser pitched up), `engine` (ATV loop: a pulsing low saw while on screen), `honk`, `megaphone` (a distorted sweep), `splash` (soaker/wave), `frisbeeWhoosh`, `snap` (bear trap).

---

## Part 7: Testing checklist
- [ ] `assets-w12-preview.html` shows all 45 assets. In-game, every new kind renders facing correctly in both directions (walk left and right past each one).
- [ ] Each new AI solo: the telegraph is visible **before** every damaging move, and the counter from its card actually works (a Z-step dodges the jogger, a jump clears the rake/buoys/wave, mashing breaks the grab, a jump attack dismounts the ATV).
- [ ] Co-op (2–4 tabs):
  - frames match on the host and clients for every kind (proves the state-only render works),
  - the grab is breakable by a crewmate,
  - a seagull steal removes the item from the right player only,
  - the Pete fine hits only the hit player,
  - `bphase` swaps sprites on every tab.
- [ ] Boss pattern lists cycle, rage triggers at ≤ 50% HP, and the dart/taser rings still fire (as a pattern entry).
- [ ] Each Wild weapon: pickup, the icon shows in the HUD/bag, Resin drain, the unique flag works (ricochet 4 hits and returns, the glide cap, soak ↔ shock doubling, reflect reverses a Karen purse and a Barb buoy).
- [ ] Each intro level (n 1, 3, 4, 6–8, 10, 11) always contains its intro kind, even after `enemiesForLevel` swaps. Wild rack intros are guaranteed.
- [ ] Secret levels: gold squirrels steal Resin and pay out, treasure crabs pay out.
- [ ] Old saves load. `save.met` gets the new kinds added on first sight. No new save fields are needed besides `save.met` entries.
- [ ] The economy stays within v1.1's 60–100 coins per level solo (the new payouts are Resin-heavy on purpose).

**When done:**
- report the tuned numbers (HP, speeds, cooldowns),
- screenshot each boss phase,
- update `ROSTER_PLAN.md`'s level map with anything that moved.
