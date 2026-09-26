# KUSH QUEST (v0.9)

Cozy retro co-op platformer starring 4 stoner homies (Rasta, Snapback, Bucket Hat, Afro) swinging oversized weapons: Giant Joint, Giant Lighter, Mega Bong, Dab Tool, Giant Grinder. Up to 4 friends online. Save up hash coins to buy your own pot farm.

**Style:** a co-op street brawler like TMNT, Streets of Rage or Castle Crashers. Walk up, down, left and right, clear each fight area, then keep moving.

**The mission:** each mission, get **COOKED** (50%+ on the meter, from nugs + smoke rings) and reach the **SMOKE SPOT** at the end.
Every smoke spot gets you closer to the farm. Reach 6 smoke spots and save up 1500 hash coins to buy **THE POT FARM**.

**Enemies:** Cops chase you and beat you up. Karens throw purses and harsh your buzz. Mice and squirrels steal your hash coins; knock them out to get the coins back.

**Pickups:** Hash Coins, Nugs (+cooked), Smoke Rings, Munchies (heal), Golden Leaf (invincible), treasure chests (gear), plus rare bonuses:
Shatter (speed), Diamonds (+50 coins, +cooked), Kief (coin magnet), Hash (+1 attack damage).
Legendary stoners hang out at checkpoints and share wisdom (and a gift).

**Head Shop** (between missions): weapons (Giant Lighter, Mega Bong, Dab Tool, Giant Grinder), armor (Hoodie, Tie-Dye Vest, Rasta Crown), Stash Pouch (anti-theft), Munchies, Pre-Rolls, Golden Leaves, and the Farm.
Your progress saves in your browser.

**Music:** adaptive soundtrack: a bouncy 8-bit theme on the map, laid-back lo-fi chiptune while exploring, and 8-bit + 174 BPM drum & bass (breakbeats, reese bass, chip arps) whenever a fight locks you in.

## Worlds, bosses + skills
5 worlds x 5 levels. Every level ends with a boss who teaches a new skill; every 5th is a MEGA boss.
1. **Road to the Farm**: Park, Beach, Suburbia, Downtown, Buzzkill HQ (mega: Regional Manager teaches HIT A TOKE)
2. **Into the Wild**: Misty Woods, Midnight Woods, Skunk Swamp, Snowy Peaks, Ranger Station
3. **Coastline Chaos**: Sunset Beach, Boardwalk, Pier at Night, Hidden Island, Luxury Resort
4. **Neon Nights**: Neon Strip, Back Alley, The Club, Rooftops, High Roller Casino
5. **Buzzkill Tower**: Lobby, Sobriety Labs, Factory, The Vault, The Penthouse (final: Buzzkill CEO)

Skills include Light the Cherry (burning joint), Charged Swing (hold swing), Throwing, Dodge Roll (Shift + Space), Hit a Toke (V: smoke screen), Ground Pound, Hotbox, Embers, Puff Puff Pass (healing smoke), Dragon Breath (hold V), Giant Bong Rip, Ultimate High (V at 100% cooked) and more.
The Pot Farm (1500 coins) opens after World 1. Q/E switch worlds on the map.

## How it works
1. **Story intro** (first time), then the **World Map**: walk the path like Mario and pick a stop.
   Every stop looks like its level: 1-1 The Park, 1-2 The Beach, 1-3 Suburbia, Head Shop, 1-4 Downtown, 1-5 Misty Woods, 1-6 Buzzkill HQ, and the Pot Farm.
2. A **mission briefing** shows the goal and who to watch out for.
3. Brawl through each wave, get **cooked to 50%**, and reach the **smoke spot**. Beating a stop unlocks the next one.
4. Spend coins at the Head Shop, or save up **1500 hash coins** and walk to the Farm once all 6 smoke spots are done.
Online: the room host picks the mission on the map. Anyone can press **H** on the map to shop.

## Controls (all rebindable: ESC > CONTROLS)
| | Default | Mouse | Phone |
|---|---|---|---|
| Move (all 4 directions) | WASD / Arrows | | D-pad |
| Jump | Space | | A |
| Swing (3-hit combo; Shift+swing = lunge; in the air = spin) | J | Left click | B |
| Throw (Rolling Papers / Nug Bombs) | K | Right click | |
| Run | Shift | | |
| Switch weapon / throwable | Q / R | Wheel | |
| Munchies (hold next to a downed friend = revive) | E | | |
| Quick item (Rage Brownie, Energy Soda...) | C | | |
| Bag | Tab | | INV |
| Chat (online) | T | | |
| Emotes | 1 2 3 4 | | |
| Menu: settings, controls, invite link, main menu | Esc | | |
| Music / Fullscreen | M / F | | |

All menus work with the mouse too: hover to highlight, click to select, click again to buy/equip.

**Weapons:** Giant Joint (sword, light burn), Lighter Blade (close, spreading fire), Dab Saber (long, pierces, crits), Bong Hammer (heavy, stuns), Grinder Spin (all around, bleed), Blunt Bat (home runs). Upgrade each to LV3 at the Head Shop.

At the smoke spot, press **Enter or Space** to call the crew (20 second timer for everyone else).

## Run it on your PC
Install Node.js LTS (https://nodejs.org), then double-click **start.bat**.

## Hosting
**Live:** https://kush-quest.onrender.com

This repo deploys to Render as-is (`render.yaml`, start command `node server.js`, health check `/health`). Pushing to GitHub redeploys automatically.
The free plan sleeps after 15 min idle; the first visit after that takes about 30-60 seconds to wake it.
