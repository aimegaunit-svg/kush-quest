# KUSH QUEST: Road to the Farm (v0.5, beat-em-up)

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

## Controls
| | Keyboard | Phone |
|---|---|---|
| Move (all 4 directions) | Arrows / WASD | D-pad |
| Jump / Float (tap jump again in the air) | Space / Z | A |
| Attack, 3-hit combo (while floating = smoke blast) | X / J / K | B |
| Run | Shift | |
| Switch weapon | Q or 1-5 | |
| Inventory | I / Tab | INV |
| Eat munchies | C | |
| Emotes | 7 8 9 0 | |
| Pause (solo) / Music | P / M | |

At the smoke spot, press **Enter** to call the crew (20 second timer for everyone else).

## Run it on your PC
Install Node.js LTS (https://nodejs.org), then double-click **start.bat**.

## Hosting
**Live:** https://kush-quest.onrender.com

This repo deploys to Render as-is (`render.yaml`, start command `node server.js`, health check `/health`). Pushing to GitHub redeploys automatically.
The free plan sleeps after 15 min idle; the first visit after that takes about 30-60 seconds to wake it.
