# Sudden Death: how the code fits together

The game ships as one file, `sudden-death.html`. It is built from ordered source parts in `src/` by `./build.sh`, which concatenates them, syntax-checks the result with `node --check`, and wraps it in the HTML shell. Every part shares one global scope, so **order matters**: a part may only call things defined in earlier parts at load time (calls made later, at runtime, can reach anything).

## The parts, in build order

| Part | What lives there |
|---|---|
| `p0.html` | CSS and the page shell (header, views, modal). |
| `p1.js` | The creature renderer: ink style, every kind's body and weapon, portraits. |
| `p2.js` | Data: clubs and their styles, statuses, cards, upgrades, trophies (relics), tonics. |
| `p2b.js` | Data: set plays, gear, Hall of Fame cards, extra costs. |
| `p2e.js` | Player profiles: `pkey()` namespaces every per-player storage key; Guest keeps the original keys. |
| `p2d.js` | **Hooks**: `fire(event)`, `mod(name)`, `onHook()`, and what every trophy does (`TROPHY_FX`). |
| `p3.js` | Data: sports and their rules text, acts, enemies, encounters. |
| `p3b.js` | Data: the nine bosses, their brains and phases. |
| `p3c.js` | Sports front office: sport glyphs, the published schedule (`scheduleMap`), Practice (`SKT`, `PRACTICE`), the archetype cards for golf, bowling, jousting, curling and boxing, and `sportFits`. |
| `p4.js` | **The combat engine**: turns, drawing, playing a card, damage (`atkDmg`, `hurtEnemy`), enemy intents. |
| `p4b.js` | The sports layer: scoring for each sport, momentum, highlights, the final whistle. |
| `p4c.js` | Boss-only effect ops (steal a card, strip Block, sacrifice an escort...). |
| `p4d.js` | Player stats: card ownership, crediting damage/Block/kills/points, careers. |
| `p4e.js` | The sky: moon phases and constellations and what they do. |
| `p2c.js` | The open draft class (free agents). Sits after `p4e` because it reads the sky groups. |
| `p5.js` | The run: new run, map generation, rewards, shop, saves, records, the season log. |
| `p5b.js` | Elite scouting reports; season goals (`GOALS`, `checkGoals`) and the fan stand (`FAN_STAND`). |
| `p5c.js` | Achievements: bronze/silver/gold ladders counted across runs, per profile, with toasts. |
| `p5d.js` | Trouble: enemy sport perks (Ace, Stopper, Hot start, Clutch) and high-stakes rooms on the map. |
| `p6.js` | UI helpers: icons, card faces, tooltips, the run bar, the map. |
| `p7.js` | The fight scene: arena, scoreboard, entities, hand, drag and target. |
| `p7b.js` | Bespoke boss art and the visual effects layer (`spawnVfx`, `drawVfx`). |
| `p7c.js` | Sport visuals on the field, the crowd, the momentum bar, the damage breakdown. |
| `p7d.js` | Drawing the sky: skylights, moon and star icons, the map's sky panel. |
| `p8.js` | Screens: title, draft, panels, reward, shop, locker room, events, end, records, boot. |
| `p8b.js` | Stat sheets and charts. |
| `p8c.js` | The treasure trunk scene. |
| `p9.js` | Settings, the music sequencer, coach's notes. |

## The core loop of a fight

1. `beginFight(enc)` (p8) calls `startCombat(ids, type, sport)` (p4): builds `B`, the battle state, shuffles the deck, applies start-of-fight trophies, the sky and the sport.
2. `playerTurnStart()`: the sky ticks (`skyTick`), the turn counter rises, statuses tick, `sportTurnBegin()` runs, cards are drawn.
3. Playing a card: `playCard(i, targetUid)` pays costs, then `resolve(def.fx, ctx)` runs the card's effect ops. Damage goes through `atkDmg` (every modifier) then `hurtEnemy` (Block, statuses, crediting, sport scoring). `sportCardStart/End` wrap each card to score it for the sport.
4. `endTurn()` returns a list of steps (enemy intents), which the UI plays out with timing; the lab runs them instantly.
5. The engine never touches the screen directly. It pushes events with `fx({ k: ... })`, and the fight scene drains them each frame in `consumeFx()`.

`B.over` ends the fight; `finishFight()` logs the game (`logGame`), pays rewards and returns to the map.

## Hooks

Trophies no longer get checked by name inside the engine. Each one declares what it does next to its data in `TROPHY_FX` (p2d):

- `on: { event: fn }` for things that happen. The engine calls `fire(event, arg)` at fixed points: `fightStart`, `turnStart`, `turnEnd`, `turnEndHeal`, `cardPlayed`, `attackPlayed`, `enemyFalls`, `lethal` (return true to cancel the knockout), `fightWon`.
- `mod: { name: n | fn }` for numbers that add up. The engine asks `mod(name)` for `energy`, `draw`, `d20`, `atk`, `rewardGold`, `goldMult`, `choices`.

Systems that are not trophies use `onHook(event, fn)`: the sky and the elite traits both do. Sports keep their own dispatch in p4b because every sport needs a different hook at nearly every point. `test/hooks.py` checks every hooked trophy does what its text says.

## Drawing creatures

Creatures are drawn procedurally and are most of a frame's cost. `drawWho` (p7) keeps an offscreen sprite per entity and redraws it at most 20 times a second while the creature is idle, blitting it on whole device pixels so it stays crisp. Anything in motion (a lunge, a pose, fire breath, a charge) draws live. Set `SPR_ON = false` to compare. `test/sprites.py` checks every kind looks the same through the cache as drawn live, and measures the frame time with and without it.

## Saving

The run (`RUN`) is saved to `localStorage` (`sd-run`) on the map and in every panel. A fight is saved whole as `RUN.battle`, a JSON copy of `B`, by `snapBattle()` (p9): at the top of each of your turns, after each card you play, when you choose Save and quit, and when the page closes. It is only taken when nothing is resolving (your turn, `UI.busy` false), so `restoreBattle()` always lands on a clean state; enemy plans are recomputed from their intents on restore. `finishFight` clears it. `test/pausesave.py` plays part of a fight, saves and quits, opens the game in a new page, resumes, and checks every pile, HP, status, intent and score matches, including after closing the tab mid-turn.

## Conventions worth keeping

- **Data, not branches.** Cards, statuses, trophies, enemies, sports and sky effects are tables. A card's behaviour is a list of ops (`['d', 6, 2]` is 6 damage twice). Add an op to `resolve` once and every card can use it.
- **`def(card)`** gives the live definition with upgrades applied. Never read `CARDS[id]` for gameplay.
- **Explain numbers.** `atkDmg` records each modifier when the global `WHY` is an array; `dmgWhy(card, target)` uses that to draw the breakdown under the arena. A new damage modifier inside `atkDmg` should use its `add()` or `mul()` helpers so it shows up there.
- **One global scope.** Every part shares it, so two top-level functions with the same name silently replace each other. `build.sh` refuses to build if that happens.
- **`B` must stay plain data** (objects, arrays, numbers, strings) so it can be saved mid-fight. A function stored on battle state is dropped by the save; if something needs one, store a name and look the function up.
- **The engine is headless-safe.** `LAB` is true in bot runs: no sound, no saves, no tips, no music. Anything visual goes through `fx`.
- **Canvas state.** Wrap any `shadowBlur`, `filter`, `globalAlpha` or composite change in `save()`/`restore()`. The frame loop also resets the context each frame as a safety net.

## Adding things

- **A card**: add it to `CARDS` (p2 or p2b) with `fx` ops; give it an upgrade in `UP_OVERRIDE` only if the default upgrade does not fit.
- **A trophy**: add it to `RELICS` (p2), an icon to `ICO` (p6), and its behaviour to `TROPHY_FX` (p2d) using the events and mods above. If it needs a moment the engine does not fire yet, add one `fire('newEvent')` call in the engine rather than a `hasRelic` check.
- **A sport's practice effect**: thresholds live in `SKT(card)` (p3c) and are read by `sportCardEnd` and `sportBadge` (p4b); describe it in `PRACTICE`.
- **A season goal**: add it to `GOALS` (p5b) with a name, a target, a per-game `count` and a `pay`.
- **An elite trait**: add it to `ELITE_TRAITS` (p5b) with `apply` (fight start), optional `turn`, `reward(out)`, and a `risk` from 0 to 3 for the map badge colour.
- **A club**: add it to `CLUBS` with six players and a unique trophy, and a line to `CLUB_STYLE`.
- **A sport**: add rules text to `SPORTS` (p3), scoring in `sportCardEnd`/`sportEnemyHit`/`sportTurnEnd`/`sportFinal` (p4b), a scoreboard line in `sportLine`, and field visuals in `drawFieldState` (p7c).
- **A boss**: data in `p3b.js` (moves, `brain`, `phases`); any new ops in `p4c.js`; art in `p7b.js` if it needs more than the standard creature renderer.

## Testing

`./test/all.sh` builds and runs the fast checks (about two minutes): a smoke test, every enemy move through the tooltip code, a hover tooltip, sprite parity and speed, every hooked trophy, elite traits, a render fuzz across every enemy and sport looking for errors and leaked canvas state, the sport visuals, stats, the damage breakdown, coach's notes, the open draft, the treasure scene, and the stage-resize fix. They need Python with Playwright and Chromium.

Balance is measured with bots that play from the model, not the screen (`test/lab.js`):

- `python3 test/lab.py 200`: win rate, where runs die, killers, sports-win rate by sport, highlights.
- `python3 test/policy.py 200`: the same with safe, balanced and greedy routes.
- `python3 test/clubs.py ironmaw,mirewood 60`: win rate per club.

- `python3 test/difficulty.py 100 '{"draw":4}' dumb`: difficulty probe. Overrides `TUNE` (p4: cards drawn, enemy HP and damage per act, elite HP, healing between acts), and with `dumb` also runs a careless bot that plays random cards at random targets. The gap between the two is a rough measure of how much skill matters. Add `hard` for Hall of Fame difficulty.

Bot numbers measure relative balance, not how hard the game feels to a person. Compare before and after a change, with at least 100 runs per side, and expect a few points of noise either way.
