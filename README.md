# DUEL — Wild West Quick-Draw Showdown

A browser-based quick-draw dueling game inspired by classic western reaction shooters.
Pure HTML5 — no frameworks, no build step, no external assets. All art is drawn
procedurally on canvas and all sound is synthesized with WebAudio.

## Play

**Online:** https://balug87.github.io/Duel/ (deployed from `main` via GitHub Pages)

Or open `index.html` in any modern browser, or serve the folder:

```
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How to play

The duel is staged in classic side view — you on the left, your opponent on the right.

1. Rest your cursor on your gunslinger's **revolver** at the bottom-left and keep it there.
2. Wait through the countdown — **3… 2… 1…** Move off the holster early and the count resets.
3. On **FIRE!**, nudge your mouse across to your opponent and click. First gunslinger to drop loses.
4. Headshots are lethal (configurable). Torso, arm and leg hits deal decreasing damage.
   You each get a limited number of shots — if both duelists are standing when the
   guns are empty, it's a **draw** and the duel replays.
5. Shooting an opponent's hat off scores bonus points without hurting them.
6. Every couple of duels you'll get a **bonus round**: shoot the bottles —
   and do **not** shoot the assistant.
7. Score comes from draw speed, accuracy and remaining health. Beat every
   gunslinger in the territory to win. High scores persist between visits.

Press **Esc** during play to bail back to the title screen.

## Customization

**Character select** — pick from 8 gunslingers, then recolor their hat, shirt,
vest, pants, bandana, skin, gun and hair, and give them your own name.

**Settings** — everything is adjustable and saved to your browser:

| Setting | Options |
|---|---|
| Difficulty presets | Easy / Normal / Hard / Deadeye |
| Opponent reaction | 30%–300% fine-tune slider (100% = original-style sub-second draws) |
| Opponent accuracy | 40%–130% fine-tune slider |
| Blood & gore | Buckets (default) / Classic / Off |
| Starting health | 50 / 100 / 150 / 200 |
| Shots per duel | 3 / 6 / 9 / 12 / unlimited |
| Number of opponents | 3 / 6 / 9 / 12 |
| Damage model | Body zones or uniform |
| One-shot headshots | On / off |
| Bonus rounds | Every 2 duels / every 3 / off |
| Sound | On / off |

## Cheat codes

Type these into the cheat box on the character select screen:

| Code | Effect |
|---|---|
| `NOHIT` | Opponents can't hurt you |
| `MOREAMMO` | Unlimited ammo |
| `FASTFIRE` | Near-instant trigger |
| `SLOWMO` | Opponents react and fire much slower |
| `ONESHOT` | Every hit you land is lethal |
| `BIGHEAD` | Opponents grow enormous heads |
| `LEVEL5` | Start at level 5 (any level number works) |
| `BONUS1` / `BONUS2` | Start at a bonus round |
| `RESET` | Clear all active cheats |

Cheats last for the session and are cleared on reload.

## Project layout

```
index.html        page shell + DOM menu screens
css/style.css     western UI theme
js/audio.js       WebAudio-synthesized sound effects
js/characters.js  procedural vector gunslingers, hit zones, roster & opponents
js/duel.js        duel state machine, AI, particles, scene rendering
js/bonus.js       bonus rounds (Steady Hands / Toss-Up)
js/ui.js          menus, settings, cheat codes, localStorage persistence
js/main.js        game loop, progression, scoring
```
