# Sudden Death: how the code fits together

The game ships as one file, `dist/sudden-death.html`. `./build.sh` reads `src/manifest.txt`, concatenates the files it lists in that order, syntax-checks the result with `node --check`, and wraps it in the HTML shell (`src/shell.html`). Every file shares one global scope, so **order matters**: a file may only use things defined in earlier files at load time (calls made later, at runtime, can reach anything). Folders say what a file is; the manifest says when it loads, and the two do not always agree (sound effects load just before the fight scene, and boot runs before the stats, treasure and `app/` files).

The manifest format: one path per line, relative to the repo root; blank lines and `#` comments are ignored; `shell <file>` names the page, `out <file>` the output, and `include <manifest>` reads another manifest in place. `./build.sh <manifest>` builds from another one.

Several files still open with their old part name in a comment (`/* p5: ... */`). That is deliberate for now: the move was checked to produce a byte-identical build.

## The files, in build order

| File | What lives there |
|---|---|
| `shell.html` | CSS and the page shell (header, views, modal). |
| `core/util.js` | Small shared utilities: random helpers, `esc`, `$`, text and rounded-rect drawing, fonts. |
| `render/creatures.js` | The creature renderer: ink style, every kind's body and weapon, portraits, dungeon-folk and bespoke monsters. |
| `data/clubs.js` | Clubs and their styles (`CLUBS`, `CLUB_STYLE`). |
| `data/statuses.js` | Statuses (`ST`). |
| `data/cards.js` | Cards (`CARDS`, `K`), kind and signature tables, upgrades (`cardDef`, `UP_OVERRIDE`). |
| `data/trophies-tonics.js` | Trophies (`RELICS`) and tonics (`TONICS`). |
| `data/cards-extra.js` | Set plays, gear, Hall of Fame cards, extra costs. |
| `core/profiles.js` | Player profiles: `pkey()` namespaces every per-player storage key; Guest keeps the original keys. |
| `core/hooks.js` | **Hooks**: `fire(event)`, `mod(name)`, `onHook()`, and what every trophy does (`TROPHY_FX`). |
| `data/sports-acts-enemies.js` | Sports and their rules text, acts, enemies, encounters. |
| `data/bosses.js` | The nine bosses, their brains and phases. |
| `data/sport-office.js` | Sports front office: sport glyphs, the published schedule (`scheduleMap`), Practice (`SKT`, `PRACTICE`). |
| `data/cards-archetypes.js` | The archetype cards for golf, bowling, jousting, curling and boxing. |
| `data/sport-fits.js` | `sportFits`: which sports a card is good at, for the glyphs on its face. |
| `engine/combat.js` | **The combat engine**: difficulty (`DIFFS`, `TUNE`), turns, drawing, playing a card, damage (`atkDmg`, `hurtEnemy`), enemy intents. |
| `engine/sports.js` | The sports layer: scoring for each sport, momentum, highlights, the final whistle. |
| `engine/boss-ops.js` | Boss-only effect ops (steal a card, strip Block, sacrifice an escort...). |
| `engine/stats.js` | Player stats: card ownership, crediting damage/Block/kills/points, careers. |
| `engine/sky.js` | The sky: moon phases and constellations and what they do. |
| `data/draft-class.js` | The open draft class (free agents). Sits after `engine/sky.js` because it reads the sky groups. |
| `run/run.js` | Starting a run (`newRun`) and party helpers. |
| `run/map.js` | Map generation and repair, and rolling encounters. |
| `run/rewards-shop.js` | Rewards, the season log (`logGame`), after-fight flow, and the shop. |
| `run/events.js` | Events between fights. |
| `run/saves-records.js` | Saving the run, and the record book. |
| `run/elite-traits.js` | Elite scouting reports (`ELITE_TRAITS`). |
| `run/goals.js` | Season goals (`GOALS`, `checkGoals`) and the fan stand (`FAN_STAND`). |
| `run/achievements.js` | Achievements: bronze/silver/gold ladders counted across runs, per profile, with toasts. |
| `run/trouble.js` | Trouble: enemy sport perks (Ace, Stopper, Hot start, Clutch) and high-stakes rooms on the map. |
| `ui/icons.js` | Icons (`ICO`, `NODE_ICO`) and sport emblems for league cards. |
| `ui/card-faces.js` | Card text and card faces (`cardText`, `cardHTML`). |
| `ui/widgets.js` | Tooltips, the run bar, `modal`, the deck viewer and deck picker. |
| `ui/map-view.js` | The UI state object (`UI`) and the map view. |
| `app/sound.js` | Sound effects (`SND`, `sfx`). |
| `ui/fight/arena.js` | Arena backgrounds and the scoreboard on the back wall. |
| `ui/fight/scene.js` | Drawing a scene: entities, the sprite cache, intents, pops, banners, dice, `consumeFx`. |
| `ui/fight/screen.js` | The fight screen: stage sizing, HUD, the hand, drag and target. |
| `render/boss-art.js` | Bespoke boss art. |
| `render/vfx.js` | The visual effects layer (`spawnVfx`, `drawVfx`). |
| `ui/fight/field.js` | Sport visuals on the field, the crowd, the momentum bar, the damage breakdown. |
| `ui/fight/sky-view.js` | Drawing the sky: skylights, moon and star icons, the map's sky panel. |
| `ui/screens/title.js` | Switching screens and views, and the title screen. |
| `ui/screens/draft.js` | The draft. |
| `ui/screens/flow.js` | Run flow: resume, entering a node, beginning and finishing a fight, the next act. |
| `ui/screens/panels.js` | Panels: reward, shop, locker room, events, and the end screen. |
| `ui/screens/pages.js` | Pages: How to play, the bestiary, records and the season table. |
| `app/boot.js` | The frame loop and `boot()`. Boot runs here, so the files after it patch in once it has started. |
| `ui/screens/stats.js` | Stat sheets and charts. |
| `ui/screens/treasure.js` | The treasure trunk scene. |
| `app/music.js` | Settings store (`SET`), audio buses, the music sequencer. |
| `app/settings.js` | The settings panel. |
| `app/coach.js` | Coach's notes. |
| `app/pause-save.js` | Pause, and saving a fight to come back to (`snapBattle`, `restoreBattle`). |
| `app/profiles-ui.js` | Profiles on the title screen, and `askConfirm`. |

## The core loop of a fight

1. `beginFight(enc)` (`ui/screens/flow.js`) calls `startCombat(ids, type, sport)` (`engine/combat.js`): builds `B`, the battle state, shuffles the deck, applies start-of-fight trophies, the sky and the sport.
2. `playerTurnStart()`: the sky ticks (`skyTick`), the turn counter rises, statuses tick, `sportTurnBegin()` runs, cards are drawn.
3. Playing a card: `playCard(i, targetUid)` pays costs, then `resolve(def.fx, ctx)` runs the card's effect ops. Damage goes through `atkDmg` (every modifier) then `hurtEnemy` (Block, statuses, crediting, sport scoring). `sportCardStart/End` wrap each card to score it for the sport.
4. `endTurn()` returns a list of steps (enemy intents), which the UI plays out with timing; the lab runs them instantly.
5. The engine never touches the screen directly. It pushes events with `fx({ k: ... })`, and the fight scene drains them each frame in `consumeFx()`.

`B.over` ends the fight; `finishFight()` logs the game (`logGame`), pays rewards and returns to the map.

## Hooks

Trophies no longer get checked by name inside the engine. Each one declares what it does next to its data in `TROPHY_FX` (`core/hooks.js`):

- `on: { event: fn }` for things that happen. The engine calls `fire(event, arg)` at fixed points: `fightStart`, `turnStart`, `turnEnd`, `turnEndHeal`, `cardPlayed`, `attackPlayed`, `enemyFalls`, `lethal` (return true to cancel the knockout), `fightWon`.
- `mod: { name: n | fn }` for numbers that add up. The engine asks `mod(name)` for `energy`, `draw`, `d20`, `atk`, `rewardGold`, `goldMult`, `choices`.

Systems that are not trophies use `onHook(event, fn)`: the sky and the elite traits both do. Sports keep their own dispatch in `engine/sports.js` because every sport needs a different hook at nearly every point. `test/hooks.py` checks every hooked trophy does what its text says.

## Drawing creatures

Creatures are drawn procedurally and are most of a frame's cost. `drawWho` (`ui/fight/scene.js`) keeps an offscreen sprite per entity and redraws it at most 20 times a second while the creature is idle, blitting it on whole device pixels so it stays crisp. Anything in motion (a lunge, a pose, fire breath, a charge) draws live. Set `SPR_ON = false` to compare. `test/sprites.py` checks every kind looks the same through the cache as drawn live, and measures the frame time with and without it.

## Saving

The run (`RUN`) is saved to `localStorage` (`sd-run`) on the map and in every panel. A fight is saved whole as `RUN.battle`, a JSON copy of `B`, by `snapBattle()` (`app/pause-save.js`): at the top of each of your turns, after each card you play, when you choose Save and quit, and when the page closes. It is only taken when nothing is resolving (your turn, `UI.busy` false), so `restoreBattle()` always lands on a clean state; enemy plans are recomputed from their intents on restore. `finishFight` clears it. `test/pausesave.py` plays part of a fight, saves and quits, opens the game in a new page, resumes, and checks every pile, HP, status, intent and score matches, including after closing the tab mid-turn.

## Conventions worth keeping

- **Data, not branches.** Cards, statuses, trophies, enemies, sports and sky effects are tables. A card's behaviour is a list of ops (`['d', 6, 2]` is 6 damage twice). Add an op to `resolve` once and every card can use it.
- **`def(card)`** gives the live definition with upgrades applied. Never read `CARDS[id]` for gameplay.
- **Explain numbers.** `atkDmg` records each modifier when the global `WHY` is an array; `dmgWhy(card, target)` uses that to draw the breakdown under the arena. A new damage modifier inside `atkDmg` should use its `add()` or `mul()` helpers so it shows up there.
- **One global scope.** Every source file shares it, so two top-level functions with the same name silently replace each other. `build.sh` refuses to build if that happens.
- **`B` must stay plain data** (objects, arrays, numbers, strings) so it can be saved mid-fight. A function stored on battle state is dropped by the save; if something needs one, store a name and look the function up.
- **The engine is headless-safe.** `LAB` is true in bot runs: no sound, no saves, no tips, no music. Anything visual goes through `fx`.
- **Canvas state.** Wrap any `shadowBlur`, `filter`, `globalAlpha` or composite change in `save()`/`restore()`. The frame loop also resets the context each frame as a safety net.

## Adding things

- **A card**: add it to `CARDS` (`data/cards.js` or `data/cards-extra.js`) with `fx` ops; give it an upgrade in `UP_OVERRIDE` only if the default upgrade does not fit.
- **A trophy**: add it to `RELICS` (`data/trophies-tonics.js`), an icon to `ICO` (`ui/icons.js`), and its behaviour to `TROPHY_FX` (`core/hooks.js`) using the events and mods above. If it needs a moment the engine does not fire yet, add one `fire('newEvent')` call in the engine rather than a `hasRelic` check.
- **A sport's practice effect**: thresholds live in `SKT(card)` (`data/sport-office.js`) and are read by `sportCardEnd` and `sportBadge` (`engine/sports.js`); describe it in `PRACTICE`.
- **A season goal**: add it to `GOALS` (`run/goals.js`) with a name, a target, a per-game `count` and a `pay`.
- **An elite trait**: add it to `ELITE_TRAITS` (`run/elite-traits.js`) with `apply` (fight start), optional `turn`, `reward(out)`, and a `risk` from 0 to 3 for the map badge colour.
- **A club**: add it to `CLUBS` (`data/clubs.js`) with six players and a unique trophy, and a line to `CLUB_STYLE`.
- **A sport**: add rules text to `SPORTS` (`data/sports-acts-enemies.js`), scoring in `sportCardEnd`/`sportEnemyHit`/`sportTurnEnd`/`sportFinal` (`engine/sports.js`), a scoreboard line in `sportLine`, and field visuals in `drawFieldState` (`ui/fight/field.js`).
- **A boss**: data in `data/bosses.js` (moves, `brain`, `phases`); any new ops in `engine/boss-ops.js`; art in `render/boss-art.js` if it needs more than the standard creature renderer.

## Testing

`./test/all.sh` builds and runs the fast checks (about two minutes): a smoke test, every enemy move through the tooltip code, a hover tooltip, sprite parity and speed, every hooked trophy, elite traits, a render fuzz across every enemy and sport looking for errors and leaked canvas state, the sport visuals, stats, the damage breakdown, coach's notes, the open draft, the treasure scene, and the stage-resize fix. They need Python with Playwright and Chromium.

Balance is measured with bots that play from the model, not the screen (`test/lab.js`):

- `python3 test/lab.py 200`: win rate, where runs die, killers, sports-win rate by sport, highlights.
- `python3 test/policy.py 200`: the same with safe, balanced and greedy routes.
- `python3 test/clubs.py ironmaw,mirewood 60`: win rate per club.

- `python3 test/difficulty.py 100 '{"draw":4}' dumb`: difficulty probe. Overrides `TUNE` (`engine/combat.js`: cards drawn, enemy HP and damage per act, elite HP, healing between acts), and with `dumb` also runs a careless bot that plays random cards at random targets. The gap between the two is a rough measure of how much skill matters. Add `hard` for Hall of Fame difficulty.

Bot numbers measure relative balance, not how hard the game feels to a person. Compare before and after a change, with at least 100 runs per side, and expect a few points of noise either way.

## Champions of the Realm

`./build.sh src/realm/manifest.txt` writes `dist/realm.html`: an open-world build where you walk a realm with your team and every fight is a Sudden Death match. Its manifest loads a prelude, then `include src/manifest.txt` (all of Sudden Death, in its own order), then the realm files. Its `out` line comes after the include, so it replaces Sudden Death's. `style` lines add the realm CSS to the shell's `<style>`. The standalone build never sees a realm file. `docs/realm/` has the plan (`PLAN.md`), the shapes the parts agree on (`CONTRACT.md`) and the balance notes (`BALANCE.md`).

### The files, in build order

| File | What lives there |
|---|---|
| `w00-pre.js` | Sets `__SD_REALM` before anything else, so Sudden Death's `app/boot.js` stands down. |
| *(all of Sudden Death)* | Unchanged. |
| `w0.css`, `w6.css`, `w9.css` | Realm styles: the world view, the camp, the road and towns. |
| `w1-data.js` | `DB`: regions, tiles, locations, towns, NPCs and their keyword topics, items, meals, events, cups, quests (ported from Terra Chimera, rewritten for teams). |
| `w2-maps.js` | `MAPS`: the overworld, towns and dungeons, built deterministically; `worldProblems`, `dungeonProblems`, `wAudit`. |
| `w3-state.js` | `WG`, the world state: time, movement, map changes, using tiles, NPC talk (`wSay`, `wRunAct`), shops and inns. No DOM. |
| `w4-ink.js` | The ink tile renderer and actor drawing (`wDrawMap`, `wDrawActor`), with a per-map layer cache. |
| `w5-bridge.js` | **The match seam**: `startMatch`, the pre-game card, `W_ON_END`, wins and blackouts, the save, `wGainCard`. |
| `w6-party.js` | The party is the team: roster, lineup, cards owned by players, XP and levels, recruiting, taverns, careers, the new-journey draft. |
| `w7-ui.js` | The world view: HUD, log, talk panel, shop and inn panels, input, drawing each frame. |
| `w7b-camp.js` | The camp (Team button, `C`): lineup, levels, cards by player. |
| `w8-boot.js` | Title screen, new journey, save and resume, the frame loop's world branch. |
| `w9-road.js` | Tiers and levels, wild teams by region, night ambushes, energy for wins, road events. |
| `w9b-town.js` | Meals and cooking, the enchanter, card shops. |
| `w10-dungeon.js` | Dungeon rooms of famous teams, alphas as Sudden Death bosses, gates, magic gear. |
| `w11-cups.js` | Town cups, rivals and head to head, the Crown and the champion ending. |
| `w12-renown.js` | Renown (foes grow with cups and bosses), and no trophies from ordinary elite wins. |
| `w13-feel.js` | Music per region, tips, Realm achievements, the Crown in the record book, the Bag. |
| `w14-ground.js` | Your home ground: buy one behind any inn, the home crowd in its region, and its upgrades. |
| `w15-camp.js` | Camping out in the wild: a Trail Ration for a night's rest, and the risk of being caught asleep. |

### The match seam

`startMatch({ type, tier, sport?, ids?, world: { kind, ref } })` (`w5-bridge.js`) builds a Sudden Death encounter at `RUN.act = tier - 1`, shows the pre-game card and calls `beginFight`. The world context rides on `RUN.pending.world` as plain data, so a mid-match save restores it. When the match ends, `W_ON_END[world.kind](result, ref, world)` runs, looked up by name: `wild`, `alpha`, `lair`, `event`, `room`, `cup`. Nothing stores a callback. A win goes through Sudden Death's reward panel, whose Continue (`backToMap`, reassigned) returns to the world; a loss is a blackout (`wBlackout`), or the end in Hardcore. **Not yet** on the pre-game card calls `wBackAway(enc)`: for a road event's match it reopens the event card (`w9-road.js`), because an event only closes, and its choice is paid, at kickoff.

### Conventions

- **Realm names start with `w` or `W`** (`WG`, `wLog`, `W_CUP`). The Terra Chimera names `DB`, `MAPS`, `WW`, `WH`, `regionAt`, `mulberry`, `noise2` are the only exceptions. Never declare a name Sudden Death already has.
- **Wrap by reassignment.** Later realm files change earlier ones, and Sudden Death, only by saving the original and reassigning: `const wW11PreGame = wPreGame; wPreGame = function (enc) { wW11PreGame(enc); … };`. The saved original is named `wW<n>` plus the function name, where `<n>` is the part doing the wrapping (`wW10` … `wW15`); a Sudden Death original saved in the realm is `wSd…`. Each file's header comment lists what it wraps.
- **How to play** is one section, `#wHelp`, built by `w5-bridge.js` and added to by each part's `renderHelp` wrapper, in load order. Each part's block keeps its id (`wHelpTeam`, `wHelp4`, `wHelp5`, `wHelpCups`, `wHelpRenown`, `wHelpGround`): the tests look for them.
- **Talk topics** are lower-case keys; an ALL-CAPS word in a line becomes a link when the speaker has a topic for it. `test/realm_polish.py` checks every capitalised word leads somewhere, and `wAudit` checks every `need` flag is set by something.

### The save

One record per profile: `localStorage[pkey('sd-realm')] = { v: 2, WG, RUN }`. `saveRun`, `loadRun` and `clearRun` are reassigned to it, so Sudden Death's mid-match snapshot (`RUN.battle`) works unchanged. `WG` and `RUN` must stay plain JSON, like `B`.
