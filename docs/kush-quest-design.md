# Kush Quest: Design Doc (current: v0.9 + Phase 0)

Live at https://kush-quest.onrender.com · repo aimegaunit-svg/kush-quest

## Pitch
A 2.5D, 8-bit, stoner-themed beat-'em-up in the browser, for 1–4 players online. You and your homies fight Buzzkill Corp's cops, rangers, Karens and coin-stealing critters. You collect hash coins and nugs, reach smoke spots, and save up for a pot farm.

## Core loop
World map → pick a level → a string of fight zones (the screen locks until the zone is cleared) → boss → reach the smoke spot → results → Head Shop → map.
- **Hash coins** buy gear. **Nugs** fill the **Cooked meter** (score/buff, and it powers skills).
- Clearing **5 smoke spots** unlocks the **Pot Farm** node in World 1. Reaching it is the win condition.
- Every level ends with a **boss that teaches a skill**. Each world's x-5 is a **mega boss**.

## Structure
- **5 worlds × 5 levels = 25 levels.** Each world has its own map with nodes and a gate to the next world (Q/E or [ ] switch worlds).
- 6 base themes (Park, Beach, Suburb, City, Woods, HQ) plus 20 tinted variants. Every level has its own look, and the palette shifts as you move through a level.
- Levels get longer as you progress. Enemy count scales with crew size: ×(1 + 0.55 per extra player).
- Early game is pure carnage. Karens (projectile throwers) arrive later, are easier, and are foreshadowed first.

## Combat
- Swing: a 3-hit combo. Running swing = lunge. Air swing = spin. Falling swing = ground pound*. Held swing = charged swing*.
- Throw*: Rolling Papers (straight) and Nug Bombs (lob).
- Dodge roll*: Shift+Space.
- Toke key (V)*: tap for a smoke cloud that confuses enemies; hold for dragon breath; at 100% Cooked, an ultimate.
- Bodies stay on the ground. Blood is moderate and can be turned off in settings.
- Downed players get revived by a homie holding the Munchies key.

\* Learned from bosses. There are 25 skills in total, including crit, magnet, regen and hotbox.

## Weapons (upgradable to LV3)
| Weapon | Feel | Effect |
|---|---|---|
| Giant Joint | medium reach | small burn (needs Light the Cherry) |
| Lighter Blade | close | spreading fire |
| Dab Saber | long | pierces, crits |
| Bong Hammer | heavy | stun, knockback |
| Grinder Spin | all around | bleed |
| Blunt Bat | chest-only | home runs |

## Items (saved in the bag)
Munchies (E: heal/revive), Rage Brownie, Energy Soda, Pre-roll and Golden Nug. Pick one as the quick item (C). Armor adds max hearts.

## Enemies
Mouse and squirrel (steal coins; kill them to get the coins back), cop, Karen (purse projectile, jumpable), and variants: ranger, guard, suit, rat, raccoon. Bosses have volleys, dashes, rage below 50% HP and summons, and can't be stun-locked.

## Online
- Zero-dependency Node server (`server.js`) with hand-written WebSockets and 5-letter room codes.
- Room phases: map → play → shop.
- The host runs enemy AI and broadcasts snapshots. Clients send hits and steals.
- Host migration on leave, and reconnect with up to 30 retries. After that, a **REJOIN** banner appears (click it or press Enter).
- Server hardening: input validation, 120 messages/s rate limit, 2-minute cleanup of empty rooms, `/health` endpoint.

## UX
- Animated story intro and a big-exhale smoke transition between screens.
- Adaptive chiptune music with DnB in fights.
- 3 save slots. Crew name picker (AK, LOG, G-RAT, ELIJAH, GRYPH, TG, OGMUDBONE).
- Esc menu: settings, rebindable controls (binding a key that's already in use swaps the two actions and shows a warning), chat (T), invite link, and main menu.
- Mouse works everywhere. Fullscreen (F). Touch controls on phones.
- All key prompts show the player's current bindings.

## Roadmap
Phases 1–8 are in `claude/coder-brief-v0.8.md`: lobby, gamepad, accessibility, dialogue, character select, new enemies and hazards, economy, farm hub, stats and achievements.
