# KUSH QUEST: Road to the Farm (v0.6)

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

## How it works
1. **Story intro** (first time), then the **World Map**: walk the path like Mario and pick a stop.
   Every stop looks like its level: 1-1 The Park, 1-2 The Beach, 1-3 Suburbia, Head Shop, 1-4 Downtown, 1-5 Misty Woods, 1-6 Buzzkill HQ, and the Pot Farm.
2. A **mission briefing** shows the goal and who to watch out for.
3. Brawl through each wave, get **cooked to 50%**, and reach the **smoke spot**. Beating a stop unlocks the next one.
4. Spend coins at the Head Shop, or save up **1500 hash coins** and walk to the Farm once all 6 smoke spots are done.
Online: the room host picks the mission on the map. Anyone can press **H** on the map to shop.

## Controls
| | Keyboard + mouse | Phone |
|---|---|---|
| Move (all 4 directions) | WASD / Arrows | D-pad |
| Jump | Space | A |
| Sword swing (3-hit combo; Shift+swing = lunge, swing in the air = spin) | Left click / J | B |
| Throw (Rolling Papers / Nug Bombs) | Right click / K | |
| Switch sword / throwable | Q or wheel / R | |
| Bag (inventory) | Tab | INV |
| Munchies / Emotes | E / 1-4 | |
| Pause (solo) / Music | Esc / M | |

At the smoke spot, press **Enter or Space** to call the crew (20 second timer for everyone else).

## Run it on your PC
Install Node.js LTS (https://nodejs.org), then double-click **start.bat**.

## Hosting
**Live:** https://kush-quest.onrender.com

This repo deploys to Render as-is (`render.yaml`, start command `node server.js`, health check `/health`). Pushing to GitHub redeploys automatically.
The free plan sleeps after 15 min idle; the first visit after that takes about 30-60 seconds to wake it.
