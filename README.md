# KUSH QUEST (v0.3)

Retro co-op platformer for the browser. Up to 4 friends online, with Hash Coins, Nugs, combos, and Budmon sidekicks.

**Levels:** 1-1 Kush Valley (find Sprouty = double jump) · 1-2 Hempire City (find Puffball = float)

## Controls
| | Keyboard | Phone |
|---|---|---|
| Move | Arrows / A D | ◀ ▶ |
| Jump (hold = higher, in air = double jump / float) | Space / W / Z | A |
| Run | Shift / X | B |
| Emotes | 1 = 420!  2 = NICE!  3 = HELP!  4 = LOL | |
| Music on/off | M | |
| Pause (solo) | P / Esc | |

Items: **Golden Leaf** box = rainbow invincibility · **Munchies** (pizza) = +1 heart · coin sounds rise in pitch as your combo climbs.

Co-op tricks: stand on a friend's head to reach high places. Whoever reaches the flag and presses Enter moves the whole crew to the next level.

---

## Test it on your PC
1. Install **Node.js LTS** from https://nodejs.org (one time).
2. Double-click **start.bat**. The game opens at http://localhost:3000.

## Put it online (free, about 10 minutes)
You need a free GitHub account and a free Render account.

**1. Upload to GitHub**
1. Go to https://github.com/new, name it `kush-quest`, and click **Create repository**.
2. On the next page click **"uploading an existing file"**.
3. Drag in everything from this folder: `server.js`, `package.json`, `render.yaml`, `Dockerfile`, `README.md`, `start.bat`, `.gitignore`, and the **public** folder.
4. Click **Commit changes**.

**2. Host it on Render**
1. Go to https://render.com and sign in with GitHub.
2. Click **New + → Blueprint**, pick the `kush-quest` repo, and click **Apply**. The `render.yaml` sets everything up for you.
   (Or use **New + → Web Service** with Start Command `node server.js` and no build command.)
3. Wait for the status to show "Live". You get a link like `https://kush-quest.onrender.com`.

**3. Play**
Open the link, click **CREATE ROOM**, and send friends the link with your code, like
`https://kush-quest.onrender.com/?room=ABCDE`. The code is filled in for them automatically.

Notes:
- The free Render plan sleeps after 15 minutes of no visitors. The first visit after that takes about 30–60 seconds to wake it.
- To update the game, upload the changed files to GitHub again. Render redeploys automatically.
- Any Node host also works (Railway, Fly.io, a VPS), as does Docker via the included `Dockerfile`. The server reads the `PORT` environment variable.

## Files
- `server.js`: web server and multiplayer rooms (no dependencies, no npm install)
- `public/index.html`: menu and touch controls
- `public/game.js`: the game itself: art, levels, physics, sound, networking
