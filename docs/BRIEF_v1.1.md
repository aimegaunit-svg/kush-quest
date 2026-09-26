# KUSH QUEST — Brief v1.1: Gameplay Rework + World Structure

Build this **after v0.8, v0.9 and v1.0** (see `ROADMAP.md`). **This brief overrides all earlier briefs** wherever they disagree, in particular on:
- weapons, the shop, throwables, consumables and difficulty,
- enemy scaling,
- level count and world structure, map, smoke-spot counts,
- drive placement, the economy and farm price, and the Astral Plane unlock.

The same ground rules apply:
- No npm dependencies, and keep the pixel and chiptune style.
- Host-run shared state with network sync.
- **Never break old saves:**
  - Migrate old owned weapons into Resin or coins.
  - Map old weapon levels to core levels.
  - Old per-world completion unlocks the matching world's first level.
- Test solo and online with 2–4 tabs.
- Commit after each section, and update the README and design doc.

**Before starting:** check this brief against the current code and send a short plan covering:
- what gets removed, what gets migrated, and what's reused,
- the build order.

This brief has two sections:
- **Section A: Weapons, Difficulty & Enemies** (Parts A1–A7, including the fixes from the latest playtest).
- **Section B: World Structure & Transit Games** (Parts B1–B5).

---

# SECTION A: WEAPONS, DIFFICULTY & ENEMIES


## PART A1: Two weapon slots
Each player has exactly **two weapon slots**:
1. **CORE:** permanent, tied to your homie, upgraded over the whole game.
2. **WILD:** a temporary, extreme weapon picked up in levels. It runs on Resin and is lost when dropped or replaced.

- **Swap between them** with Q or the mouse wheel.
- The HUD shows both slots, the core level, and the Wild charge bar.
- **Remove:**
  - buying weapons in the shop,
  - the 6-weapon list as owned gear,
  - the separate throw button and throwable ammo (papers, nug bombs, Zippo, hacky sack).

  These become Wild weapons (Part 3). The K / right-click throw action becomes "**USE WILD**" if the Wild weapon has a throw mode, or is removed.

---

## PART A2: Core weapons (one per homie, each with a specialty)
The homie is chosen at character select. Online, homies are unique, so each crew has four different cores.
**Solo:** you can switch homies between levels (at the Head Shop or the farm). Each homie's core level is saved separately (`save.cores = { rasta: 1, afro: 1, bucket: 1, snapback: 1 }`).

| Homie | Core | Range | Specialty |
|---|---|---|---|
| **RASTA** | **The Joint** | medium | the all-rounder. Grows bigger with more fire damage |
| **AFRO** | **The Lighter** | close | a huge flame and tons of fire damage. You have to get in close |
| **SNAPBACK** | **The Bong** | flexible | tap = a close smash, hold = a mid-range smoke blast. Covers all ranges but doesn't lead in any |
| **BUCKET** | **The Grinder** | long | throws a disc that flies out and returns. Range grows with level |

### 10 levels with visual evolution
The **form names** change every 2 levels, and the weapon's **sprite, swing effects, particles and sounds change** with them. The growth must be clearly visible in every swing.

**THE JOINT (medium, fire)**
| Lv | Form | Gains | Visual |
|---|---|---|---|
| 1–2 | Pinner | basic 3-hit combo | skinny, unlit |
| 3–4 | Joint | small burn | the cherry lights and glows |
| 5–6 | Fatty | +reach, burn spreads to 1 neighbour | thicker, smoke trail on swings |
| 7–8 | Blunt | 4-hit combo, knockback | big glowing cherry, embers on hits |
| 9 | Cannon | the finisher leaves burning ground | huge, flames at the tip, heavy smoke |
| 10 | Legendary Doobie | every hit can ignite smoke clouds, special finisher | rainbow smoke, sparkles, glow aura |

**THE LIGHTER (close, heavy fire)**
| Lv | Form | Gains | Visual |
|---|---|---|---|
| 1–2 | Bic | a short flame jab | small flicker |
| 3–4 | Zippo | a wider flame, burn stacks x2 | a flip-open animation and a steady flame |
| 5–6 | Torch Lighter | a longer flame, burn stacks x3 | a blue jet flame |
| 7–8 | Jet Flame | a flame burst on the combo finisher | a roaring jet, heat shimmer |
| 9 | Blowtorch | a short hold-to-fire flamethrower stream | a blue-white torch, sparks |
| 10 | Dragon's Breath | a big cone flamethrower, and burning enemies explode on death | a dragon-shaped flame, screen glow |

**THE BONG (flexible: tap = smash, hold = blast)**
| Lv | Form | Gains | Visual |
|---|---|---|---|
| 1–2 | Mini Bong | a small smash and a short blast | small clear glass |
| 3–4 | Glass Bong | a bigger smash radius, and the blast pushes enemies back | tinted glass, bubbles |
| 5–6 | Double Chamber | a bong-water splash that knocks enemies down | two chambers, water sloshes |
| 7–8 | Percolator | the blast leaves a smoke cloud (ties into the smoke system) | percolator bubbling, haze |
| 9 | Gravity Beast | a two-stage charge (the 2nd stage is a huge blast) | glowing water, heavy bubbles |
| 10 | The Mothership | the smash makes a shockwave ring, and the blast pierces | ornate glowing glass, a haze aura |

**THE GRINDER (long range, returning disc)**
| Lv | Form | Gains | Visual |
|---|---|---|---|
| 1–2 | Pocket Grinder | a short throw that returns | a small disc |
| 3–4 | 2-Piece | +range, faster return | a bigger disc, spin trail |
| 5–6 | 4-Piece | pierces through enemies | teeth glint, sparks |
| 7–8 | Electric | splits into 2 discs | electric blue glow, buzzing sound |
| 9 | Industrial | +range, and hits on the way back too | a heavy disc, metal sparks |
| 10 | Kief Cyclone | leaves a kief cloud that slows enemies | a golden sparkle trail, a tornado effect |

- **Balance:** the Grinder's damage per hit is lowest but it's safest. The Lighter's is highest but it's riskiest. The Joint is in the middle. The Bong is the most flexible.
- **Co-op roles** come naturally from this: the Lighter tanks up close, the Grinder pokes from range, the Joint handles crowds, the Bong controls.

### Core upgrades are slower
- They're bought at the Head Shop (a **CORE** tab) and cost **coins plus materials**:
  - **Resin:** dropped by enemies (also the Wild weapon ammo, Part 3). It's a shared currency: spending it on upgrades means less for your Wild weapon.
  - **Seeds:** dropped only by bosses (1 per boss per player).
- **Level caps:** the cap rises at each world's mini-boss and boss (see Part B1.6), reaching **Lv 10** after beating Mr. Killjoy.
- **Example cost curve** (tune it): Lv2 = 60 coins + 10 Resin; each level after costs about 1.6x the coins and +10 Resin; odd levels also need 1 Seed.

---

## PART A3: Wild weapons (temporary and extreme)
- They're found in levels: from rare enemy drops, **special chests**, and a **weapon rack** that appears once per level.
- Only **one** can be held. Picking up a new one swaps it (the old one drops on the ground).
- **Ammo is Resin:** each Wild weapon has a **charge bar**. Using it drains Resin. When it's empty, the weapon does nothing (a "click" sound) until more Resin is picked up. Resin drops from knocked-out enemies (more from tougher ones).
  - Resin goes into the **Wild charge first** while it's below full, and the rest goes to the player's Resin bank (used for core upgrades). *(Tune this: it could also be a 50/50 split.)*
- **Lost** when dropped, replaced, or at the end of the level (it doesn't carry over).
- The **pool rotates** so each world offers a different set, with 3–4 Wild weapons available per world.

### Wild weapon pool
| Wild weapon | Effect | Worlds |
|---|---|---|
| **Bong Hammer** | ground-pound shockwave that stuns everything around | Park, Suburbia |
| **Blunt Bat** | home runs launch enemies into their buddies | Park, Downtown |
| **Rolling Papers** | throwing-star spread that pierces | Park, Beach |
| **Nug Bombs** | lob a big smoky explosion | Beach, Woods |
| **Dab Torch** | a short flamethrower stream | Beach, HQ |
| **Hacky Sack** | juggles an enemy in the air for combos, and it bounces back to you | Suburbia, Beach |
| **Leaf Blower** | blows enemies back and moves smoke clouds | Suburbia, Woods |
| **Zippo Flick** | a thrown flame that ignites smoke clouds from range | Downtown, Woods |
| **Hookah Whip** | long reach, pulls enemies to you | Downtown, HQ |
| **Lava Lamp Mace** | hits leave hot goo puddles | Woods, HQ |
| **Gravity Bong Cannon** | a slow, huge smoke blast | HQ, Astral Plane |
| **Apple Pipe** | cheap and weak, but it never runs out of charge (a joke weapon) | Park |

- Each gets a unique sprite, sound, and a HUD icon with the charge bar.
- Wild weapons are **strong on purpose**, 2–3x core damage, but the Resin limit stops them from being spammed.

---

## PART A4: Consumables (simplified and sharable)
- Carry **Munchies (max 3) plus 2 other items** at once.
- **Sharable in co-op** (stand next to a homie and press the **GIVE** key, default G, with a "HERE BRO" animation), or drop the item for them:
  - **Munchies:** heal. Also revives a downed homie, as before.
  - **Pre-roll:** Cooked boost.
  - **Rage Brownie:** when eaten, also gives nearby crewmates a smaller version of the buff ("pass the plate").
- **Personal only:** Energy Soda, Golden Leaf, Vape Pen.
- Remove any other consumables that overlap. Keep the list short.

---

## PART A5: Difficulty
- **Remove Chill Mode** (from v0.9). The modes are **Normal** and **Harder High** (NG+, after the ending).
- **Crew lives:** a counter per level, shared by the whole crew and shown on the HUD. **3 solo, 5 in co-op.**
  - Getting knocked out costs 1 crew life. In co-op, a downed player revived by a crewmate (or with Munchies) costs **no** life.
  - **Crew wipe** (all players down at once) sends the crew back to the **last checkpoint**. The **mid-level legend NPC is a checkpoint**, and each boss arena start is one too.
  - **Out of crew lives:** **restart the level** from the start. Keep **50% of the coins** earned in the failed attempt, with no smoke-spot bonus. Resin earned is kept at 50% too.
- **Economy fix (from playtest):** 1-1 paid 584 coins, far too much. Target **about 60–100 per level solo** (see Part B4). Cut the Ultra bonus from x2 to about +25%, and lower the per-kill coins.
- **Cooked fade:** make sure it's actually working. Ultra should be hard to reach and hard to hold.
- **Soften the first fight of 1-1** (the tutorial wave). After that, ramp up normally.

---

## PART A6: Enemy scaling and new enemy weapons
- **Stats scale per world:** HP, damage and aggression go up. Tune it so a core **on-level** feels powerful, and a core **1–2 levels behind** feels the gap (but it's still winnable with smart Wild weapon use).
- **Existing enemies get a new weapon or trick in each world**, on top of each world's new enemy type from v0.8. They keep the old moves and add the new one:

| World | Cops | Karens | Mice / squirrels |
|---|---|---|---|
| **Park** | baton | purse throw | steal coins |
| **Beach** | **taser**: a short-range stun | **sunscreen spray**: blinds the screen for a moment | squirrels throw **sand** (slows you) |
| **Suburbia** | **pepper-spray cone** | **leaf-blower Karen**: blows you back and clears smoke clouds | mice drop **mousetraps** (root you in place) |
| **Downtown** | **riot shield cops**: block from the front, hit from behind or stun them | **phone camera flash**: stuns you and calls in backup | rats swarm in **gangs** |
| **Woods** | **net launcher**: roots you, and a crewmate can free you faster | **essential-oil diffuser**: a poison cloud zone | squirrels throw **pinecone grenades** |
| **HQ** | **drone-backed cops**: a drone shoots from above (the Grinder is good against drones) | **clipboard Karens**: "write you up", buffing nearby enemies until the Karen is knocked out | **robot mice** that explode |

- Each new enemy weapon needs: a telegraph (a wind-up animation or warning), a counter the player can learn, a briefing "NEW TRICK" entry, a sound, and network sync.
- Enemy weapons should **keep innovating** without being too crazy: each one asks the players to play differently.

---

## PART A7: Playtest fixes (from the v0.9 playtest)
- **World map:** the bottom text overlaps. The "WATCH OUT:" icons are drawn over the help line.
- **Boss intro:** popups draw through the boss banner and quote. Hide popups during the banner, or draw the banner on top.
- **Pause menu:** remove the empty dark box above the PAUSED panel.
- **Bag:** the rows overflow into the description panel. This gets redone for the 2-slot system anyway.
- **Smoke spot:** a big empty box under "CHILLING AT THE SMOKE SPOT" in solo. The crew-scene text doesn't show.
- **Legend NPC:** the name is cut off at the screen edge.
- **Text:**
  - Remove the smoke-spot count for the farm (SPOTS_TO_FARM) entirely. The farm now needs Mr. Killjoy beaten plus coins (Part B4). Update the README to match.
  - Remove every "SWORD" in text.
  - Fix "RUN: SHIFT" in the menu help.
  - The tutorial bar should show the J key, not only "CLICK HIT".

---

## Section A testing checklist
- Each homie's core at every level: damage, reach, the visual change, the sound.
- Solo homie switching, with core levels saved separately.
- Level caps block upgrades until the boss is beaten.
- Wild weapons: pickup, swap and drop, Resin drain and refill, an empty weapon clicks, lost at level end, the right pool per world.
- Consumables: carry limits, GIVE to a crewmate, the brownie's shared buff.
- Crew lives: solo 3, co-op 5, revive costs no life, crew wipe goes to the checkpoint, out of lives restarts the level and keeps 50%.
- Economy: about 60–100 coins per level solo.
- Every enemy weapon: telegraph, counter, sync.
- An old save migrates correctly.

---

# SECTION B: WORLD STRUCTURE & TRANSIT GAMES


## PART B1: Worlds and levels

### 1.1 Structure
There are **6 worlds**, and the number of levels **grows** each world. Each world has a mid-world **mini-boss**, an end **boss**, and **1 secret level** (reached by a hidden exit).

| World | Levels | Mini-boss at | Boss at | Secret |
|---|---|---|---|---|
| 1. The Park | 6 | 3 | 6 (Ranger Rick) | +1 |
| 2. The Beach | 7 | 4 | 7 (Lifeguard Lance) | +1 |
| 3. Suburbia | 8 | 4 | 8 (HOA President Pam) | +1 |
| 4. Downtown | 9 | 5 | 9 (Narc Drone Swarm) | +1 |
| 5. Misty Woods | 9 | 5 | 9 (The Forest Narc) | +1 |
| 6. Buzzkill HQ | 10 | 5 | 10 (Mr. Killjoy) | +1 |

That's **49 main levels + 6 secret levels**, then the **Astral Plane** after the ending.
- Each world needs **a mini-boss** too (design one per world, smaller than the boss, with 2 attack patterns).
- Levels are **2–4 minutes** each, so a world takes about 20–35 minutes.

### 1.2 Maps
- **World select:** the current big map becomes a world select (6 world nodes, plus the Farm and the Astral Plane when unlocked).
- **Per-world map:** a Mario-style path of level nodes in that world's art style, showing:
  - level nodes (beaten, open or locked, with the best grade shown),
  - a **Hotbox Highway node** right after the mini-boss (Part 2),
  - a **Head Shop branch** (one shop node per world),
  - **hidden paths** to the secret level, revealed by finding a secret exit in a certain level (e.g. a blacklight wall or a hidden door).
- Online, the host drives the map cursor, as now.

### 1.3 Level variety
Mix level types in every world so 49 levels don't feel the same. Each world uses at least 4 types:
- **BRAWL:** fight areas, the standard kind.
- **GAUNTLET:** survive waves in one arena for a set time.
- **ESCORT:** protect something moving (a delivery guy, Grandma Kush's cart, the van).
- **CHASE:** something pushes you forward and you keep moving (a flood, a bulldozer, a Buzzkill Corp wrecking ball).
- **HAZARD:** built around the world's hazard (waves, sprinklers, traffic, fog, lasers).
- **SECRET / BONUS:** coin and Resin heavy, with a puzzle or a hidden-path twist.

### 1.4 Level building from hand-made chunks
Hand-building 55 levels is too slow. Instead, build **hand-designed chunks** per world:
- fight arenas,
- hazard sections,
- walk sections with pickups and secrets,
- set-piece moments.

Then have `buildLevel` assemble each level from a **level recipe** (type + chunk list + enemy mix + seed). Each level has a fixed recipe, so it's the same every time you play it. Remix and Smoke Runs can shuffle the chunks.

### 1.5 Cutscenes
- A **cutscene between every world** using the dialogue system: the story beat (Grandma, Buzzkill Corp, Killjoy), plus a crew scene.
- The story beats from v0.8 get spread across these 5 cutscenes plus the intro and the ending.
- A short crew line after each boss is enough. Normal levels don't need scenes (keep them quick).

### 1.6 Pacing new things
- A **new enemy trick or type** appears roughly **every 2–3 levels**, not only once per world (the tables from Section A get spread through each world).
- **Wild weapons:** each world introduces its pool gradually.
- **Core upgrade caps** (Section A) rise at **each mini-boss and each boss** (2 cap raises per world, reaching Lv 10 after Killjoy).

---

## PART B2: Hotbox Highway (once per world)
- **One drive per world**, placed on the world map **right after the mini-boss** as the trip to the second half of the world. That's 6 in total, each themed to its world (Park parkway, coastal highway, suburb streets, Downtown at night, a forest road, the HQ industrial zone).
- Everything else follows **v1.0 Part 1**: the ride vote, the scaling seats, baked steering, Heat and cops, the seat swap events, results, and the test drive. The "first trip is a drive, then skippable" rule still applies.
- Remove the v1.0 rule that puts a drive between every level.

---

## PART B3: Transit games (between worlds, each one different)
Each world transition is a **one-off co-op vehicle mini-game**, 60–90 seconds, stoner-themed, and **each one must have different controls and dynamics**, so none of them feels like a reskin of Hotbox Highway or of each other.

**Shared framework** (build it once and reuse it):
- the seats and roles system with scaling for 1–4 players,
- the mid-game **seat swap** (each game uses its own flavour of swap events),
- the authority handoff and online sync,
- the results screen with awards,
- a first-time instruction card,
- skippable when replaying.

**Per-game** (unique for each): the renderer, physics, controls, win and fail rules, and audio.

### 3.1 Park → Beach: "LAZY RIVER" (paddling / tank controls)
- The crew floats on a giant inflatable tube down a winding river. The view is top-down with vertical scrolling.
- **The unique control:** there's no direct steering. The tube is moved by **paddling on the left and right sides**. Left paddle turns right, right paddle turns left, and both together go straight faster. There's momentum and spin physics, plus river currents and rapids.
- **Seats:**
  - Solo: left and right paddle on two keys (A/D).
  - 2 players: one paddles left, one right. They must coordinate.
  - 3–4 players: the extra players become **lookout / fend-off**, pushing away rocks, swans and debris with a pole and grabbing floating snacks.
- **Hazards:** rocks, angry swans, whirlpools (spin you), and a waterfall section at the end.
- **Fail:** too many hits pops the tube, and the crew loses coins and respawns at the last calm stretch.
- **Swap flavour:** a "CAPSIZE!" moment, where the tube flips and everyone lands on a different side.

### 3.2 Beach → Suburbia: "PAPER PLANE" (glide / momentum controls)
- The crew rides a huge glider made of rolling papers across the ocean. The view is side-on and scrolls right.
- **The unique control:** **one-button glide physics.** Hold to dive (gaining speed, losing height), release to pull up (trading speed for height). There's no engine, only momentum, **updraft** zones and **wind gusts** (like the game Tiny Wings, but in the air).
- **Wet paper:** spray from waves and rain clouds makes the glider **sag** (heavier). Fly through warm air or sun zones to dry it.
- **Seats:**
  - Solo: pilot only.
  - 2 players: pilot plus a **wing-walker** who leans left or right on the wing to shift the weight (a small pitch adjust) and grabs coins.
  - 3–4 players: more wing-walkers, and each lean affects the balance. Everyone leaning the same way tips the plane.
- **Hazards:** seagulls, pelicans that grab a player (a crewmate taps to free them), and a storm cloud at the end.
- **Swap flavour:** "GUST!", where the plane rolls and everyone tumbles to a different spot, including the pilot.

### 3.3 Suburbia → Downtown: "MUNCHIE TRUCK" (top-down drift driving + precision aiming)
- The crew hijacks an ice cream truck and delivers snacks through the suburbs to the city. The view is **top-down**, with free-roam streets on a short, fixed route.
- **The unique control:** **drift steering** (rotate plus throttle, with handbrake drifting around corners), and the throwers **aim with the mouse** to land snacks on **customers who show a matching order icon** (a colour/shape match).
- **Scoring:** delivery combos matter more than speed. The wrong snack means an angry customer.
- **Seats:**
  - Solo: the driver auto-throws when passing a customer (press to throw).
  - 2–4 players: one driver, and the rest are throwers from the side windows and the back hatch. HOA security carts chase the truck, and throwers can hit them too.
- **Swap flavour:** "BRAIN FREEZE!", where the driver eats the stock and freezes, and everyone rotates seats.

### 3.4 Downtown → Woods: "SMOKE BALLOON" (altitude-only / rhythm controls)
- The crew floats out of the city in a hot air balloon powered by their smoke. The view is side-on, with the wind moving it right automatically.
- **The unique control:** you can only control **height**, never direction. Height comes from **breathing in rhythm**: press on the beat marker to take a good hit (a big lift), a mistimed press gives a cough (a small drop). The balloon drifts down when nobody is smoking. Sandbags can be dropped for a quick climb, with a limited number.
- **Crew dynamic:** everyone shares one **lung meter**. Players take turns inhaling on the rhythm track, and staying in time together gives a combo lift.
- **Seats:**
  - Solo: inhale on the rhythm and drop sandbags.
  - 2–4 players: the rhythm notes are split between players (each has their own colour of notes), and one player also works the **sandbag drop**.
- **Hazards:** police helicopters with searchlights (being caught in the light raises Heat, and a full meter means a forced descent), power lines, skyscrapers, birds.
- **Swap flavour:** "HICCUPS!", where the rhythm lanes shuffle between players.

### 3.5 Woods → HQ: "BONG ROCKET" (the finale: free 2D flight + twin-stick turrets)
- A rocket built from a giant bong blasts the crew up to Buzzkill HQ's sky tower. It's a **vertical-scrolling space shooter**.
- **The unique control:** the **pilot flies freely in 2D** (8 directions, with momentum). The gunners control **360° turrets** with the mouse, aiming and firing independently. It's the only twin-stick style game in the set.
- **Fuel:** the rocket burns "bong water", so collect fuel bubbles to keep boosting.
- **Seats:**
  - Solo: pilot plus an auto-aim gun (press to fire).
  - 2–4 players: one pilot and 1–3 turret gunners (left, right, rear).
- **Enemies:** Buzzkill drones, satellites and a mini carrier at the end. A short **boss-lite** attack wave just before docking at HQ.
- **Swap flavour:** "ZERO-G!", where everyone floats out of their seats and drifts into new ones.
- **Reused later:** the Bong Rocket is also the vehicle to the **Astral Plane** (a harder, trippier second version of this game).

### 3.6 Summary of unique controls
| Game | View | Core control | Crew dynamic |
|---|---|---|---|
| Hotbox Highway (x6) | behind the car, pseudo-3D | steering with baked drift | driver plus window throwers |
| Lazy River | top-down | left/right paddling (tank controls) | paddlers must coordinate |
| Paper Plane | side-on | one-button glide physics | wing-walkers shift the balance |
| Munchie Truck | top-down | drift driving plus mouse aim | order matching |
| Smoke Balloon | side-on | height only, by rhythm | a shared lung meter, split rhythm lanes |
| Bong Rocket | vertical shooter | free 2D flight plus twin-stick turrets | pilot plus gunners |

---

## PART B4: Economy and the farm
- **Coins per level:** a target of **about 60–100 solo**, more for bosses, secrets and good grades. That's about 3,000–5,000 total across the game before spending.
- **Farm price: about 2,500 coins** (tune it after a full playthrough).
- **The farm needs BOTH:** Mr. Killjoy beaten, **and** enough coins. Remove the "X smoke spots" rule. Progress is now world and boss completion.
- **Remix levels:** unlocked after the farm, as before.
- **Astral Plane unlock:** get an **S grade on all 6 world bosses** (replaces "Ultra on every mission"), and it's reached by the Bong Rocket.

---

## PART B5: UI and saves
- **Save:** per-level completion, best grade, secrets found, the highway and transit games done, and world progress.
- **The world select** shows each world's % complete and secrets found (e.g. "7/8 · SECRET ✓").
- **The main menu save slots** show the current world and level, coins, and completion %.
- **Mission briefing:** show the level type (BRAWL / CHASE / ESCORT...) with a one-line goal.

---

## Section B testing checklist
- A full playthrough of World 1 (6 levels + mini-boss + Highway + boss + secret + cutscene + Lazy River into World 2).
- Each transit game solo and with 2, 3 and 4 players: the unique controls work, the seat swap, results, and a skip on replay.
- Recipe-based levels load the same every time. Remix and Smoke Runs shuffle chunks.
- Core cap raises at each mini-boss and boss.
- The farm is locked until Killjoy is beaten AND you have the coins.
- An old save migrates.
- The economy stays within the target per level.

When done, report the per-world level recipes, the new save fields and network messages, and balance numbers.
