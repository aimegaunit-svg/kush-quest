# KUSH QUEST (v1.4)

Cozy retro co-op beat-em-up starring 4 stoner homies (RASTA, SNAPBACK, BUCKET HAT, AFRO), each with their
own unique Core weapon (Giant Joint, Mega Bong, Giant Grinder, Giant Lighter) and now their own unique
attack animations that get bigger and flashier once that weapon hits Core level 6. Up to 4 friends online.
Save up hash coins to buy your own pot farm.

**Style:** a co-op street brawler like TMNT, Streets of Rage or Castle Crashers. Walk up, down, left and
right, clear each fight area, then keep moving.

**The mission:** each mission, get **COOKED** (50%+ on the meter, from nugs + smoke rings) and reach the
**SMOKE SPOT** at the end. Every smoke spot gets you closer to the farm.

**Enemies:** Cops chase you and beat you up. Karens throw purses and harsh your buzz. Mice and squirrels
steal your hash coins; knock them out to get the coins back. The Park and The Beach have their own full
cast of unique hand-drawn enemies and bosses on top of that (see below).

**Pickups:** Hash Coins, Nugs (+cooked), Smoke Rings, Munchies (heal), Golden Leaf (invincible), treasure
chests (gear), plus rare bonuses: Shatter (speed), Diamonds (+50 coins, +cooked), Kief (coin magnet), Hash
(+1 attack damage). Legendary stoners hang out at checkpoints and share wisdom (and a gift).

**Head Shop** (between missions): weapons, armor (Hoodie, Tie-Dye Vest, Rasta Crown), Stash Pouch
(anti-theft), Munchies, Pre-Rolls, Golden Leaves, and the Farm. Your progress saves in your browser.

**Music:** adaptive soundtrack: a bouncy 8-bit theme on the map, laid-back lo-fi chiptune while exploring,
and 8-bit + 174 BPM drum & bass (breakbeats, reese bass, chip arps) whenever a fight locks you in.

## Worlds + levels

**6 worlds, 49 levels**, walked like a Mario-style world map:

1. **THE PARK** — 6 levels, mini-boss @3 PARK RANGER PETE, boss @6 RANGER RICK
2. **THE BEACH** — 7 levels, mini-boss @4 BEACH PATROL BARB, boss @7 LIFEGUARD LANCE
3. **SUBURBIA** — 8 levels
4. **DOWNTOWN** — 9 levels
5. **MISTY WOODS** — 9 levels
6. **BUZZKILL HQ** — 10 levels

Each world also has a **secret level**, plus the **Farm** as the final destination/ending once all 6
worlds are cleared and you've saved enough hash coins.

**THE PARK and THE BEACH ship a full unique content pack**: 14 hand-drawn enemy kinds (joggers, pigeons,
dog walkers + their dogs, beach bros, metal detector guys, jellyfish, ATV riders, crabs and more), 4 unique
bosses with their own movesets (PETE, RICK, BARB, LANCE — not random grunt-sprite reskins), and elite
variants (GOLD SQUIRREL, TREASURE CRAB) on their secret levels. **SUBURBIA, DOWNTOWN, MISTY WOODS and
BUZZKILL HQ still run the older generic palette-tint enemy system** (cop/karen/mouse/squirrel reskins) and
random-grunt bosses — no unique art/AI there yet.

Skills include Light the Cherry (burning joint), Charged Swing (hold swing), Throwing, Dodge Roll (Shift +
Space), Hit a Toke (V: smoke screen), Ground Pound, Hotbox, Embers, Puff Puff Pass (healing smoke), Dragon
Breath (hold V), Giant Bong Rip, Ultimate High (V at 100% cooked) and more — taught by bosses as you clear
each world.

## How it works

1. **Story intro** (first time), then the **World Map**: walk the path like Mario and pick a stop.
2. A **mission briefing** shows the goal and who to watch out for.
3. Brawl through each wave, get **cooked to 50%**, and reach the **smoke spot**. Beating a stop unlocks
   the next one.
4. Spend coins at the Head Shop, or save up enough hash coins to unlock the Farm once you've made enough
   progress through the worlds.

Online: the room host picks the mission on the map. Anyone can press **H** on the map to shop. Multiplayer
is **host-authoritative** co-op: up to 4 players share lives/knockout, loot and the Cooked% buff meter
together, with Bag/inventory kept per-player.

## Controls (all rebindable: ESC > CONTROLS)

| | Default | Mouse | Phone |
|---|---|---|---|
| Move (all 4 directions) | WASD / Arrows | | D-pad |
| Jump | Space | | A |
| Swing (3-hit combo; swing while running = lunge; in the air = spin; hold = charged swing*) | J | Left click | B |
| Throw (Rolling Papers / Nug Bombs)* | K | Right click | |
| Run (hold while moving) / Shift+Space = dodge roll* | Shift | | |
| Hit a Toke: smoke cloud, hold = dragon breath, full Cooked = ultimate* | V | | |
| Switch weapon / throwable | Q / R | Wheel | |
| Munchies (hold next to a downed friend = revive) | E | | |
| Quick item (Rage Brownie, Energy Soda...) | C | | |
| Bag | Tab | | INV |
| Chat (online) | T | | |
| Emotes | 1 2 3 4 | | |
| Menu: settings, controls, invite link, main menu | Esc | | |
| Music / Fullscreen | M / F | | |

\* Learned from bosses. Every boss at the end of a level teaches a skill.

All menus work with the mouse too: hover to highlight, click to select, click again to buy/equip.

At the smoke spot, press **Enter or Space** to call the crew (20 second timer for everyone else).

## Run it on your PC

Install Node.js LTS (https://nodejs.org), then double-click **start.bat** (or run `node server.js`
directly).

## Hosting

**Live:** https://kush-quest.onrender.com

This repo deploys to Render as-is (`render.yaml`, start command `node server.js`, health check `/health`).
Pushing to GitHub redeploys automatically. The free plan sleeps after 15 min idle; the first visit after
that takes about 30-60 seconds to wake it.
