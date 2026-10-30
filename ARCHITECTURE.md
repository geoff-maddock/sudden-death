# Sudden Death: how the code fits together

The game ships as one file, `dist/sudden-death.html`. `./build.sh` reads `src/manifest.txt`, concatenates the files it lists in that order, syntax-checks the result with `node --check`, and wraps it in the HTML shell (`src/shell.html`). Every file shares one global scope, so **order matters**: a file may only use things defined in earlier files at load time (calls made later, at runtime, can reach anything). Folders say what a file is; the manifest says when it loads, and the two do not always agree (sound effects load just before the fight scene, and boot runs before the stats, treasure and `app/` files).

The manifest format: one path per line, relative to the repo root; blank lines and `#` comments are ignored; `shell <file>` names the page, `out <file>` the output, and `include <manifest>` reads another manifest in place. `./build.sh <manifest>` builds from another one. `scope <NAME> <manifest> <exports>` wraps another manifest's files in one function, so their top-level names stay private, and sets the global `NAME` to what the exports file returns; duplicate names are checked inside each scope on its own. `text <NAME> <file>` adds a line `const NAME = "<the file's contents>";`, so a script can carry a stylesheet or markup.

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
| `app/boot.js` | The frame loop and `boot()`. Boot runs here, so the files after it patch in once it has started. It leaves the Settings button (`#bSound`) to `app/settings.js`: the Realm calls `boot()` later, after that file has wired it. |
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
| `w16-stats.js` | Player stats: a Stats tab on the Team screen with each player's numbers for the journey or their career, by sport, and their last games. |
| `w17-bonds.js` | Hometowns and personal quests (talk to a player: a nickname and their kind's Hall of Fame card), and chemistry between starters (a strong pair's combo card). |
| `w18-league.js` | The league table (rivals and Apex play rounds while you travel; inns post it) and rivals who act: bids for bench players, grudge matches on the road, cup taunts and revenge. |
| `w19-journal.js` | The journal (`J`): people you've talked to and what they said, places by region with their rules, big victories, quests; filters by active quest, learned keyword and search. |
| `scope wBD` (`src/realm/diamond/`) | Brimstone Diamond, the baseball game, in its own scope: `d0-page.js` mounts its page in a shadow root inside `#v-diamond` and stands in for `document`, `window`, `localStorage` and the frame loop inside the scope; `exports.js` is what the Realm may call (`wBD`). |
| `scope wGF` (`src/realm/gridiron/`) | Cinder Gridiron, the football engine (issue #9), in its own scope: `src/gf/parts/` (the engine), then `g1-page.js` (its canvas in `#v-gridiron`, and a frame loop that runs only while it is shown); `exports.js` is what the Realm may call (`wGF`). |
| `w19b-engines.js` | `W_ENGINES`: the engines that play a sport on their own field, by id (`{ api, view, sport }`): the diamond (baseball) and the gridiron (football). `wEnginesShow(v)` shows the engine whose view it is and hides the rest. |
| `w20-diamond.js` | The diamond view: `showView('diamond')` (through `wEnginesShow`), the bar above the field, `wDiamondExhibition` (CPU against CPU, Watch them play), back to the world. |
| `w20b-ratings.js` | Baseball ratings: every player's `p.bd` (position, hand, POW/CON/SPD/ARM/FLD 1–12, powers, pitches), seeded from their kind's Brimstone Diamond player, a point per level; a Baseball block on the Stats page. |
| `w20c-nine.js` | The baseball nine (`WG.nine`): batting order and positions, call-ups at your level for the spots your roster can't fill, `wNineDef()` for the diamond; a Nine tab on the Team screen. |
| `w20d-ballgame.js` | Ball games from the world (`WG.ball`): Play, Manage or Simulate against the local nine or a rival once you have 5 players, XP, gold, fans, head to head and box scores (`WG.bstats`), save and resume mid-game, a Baseball view on the Stats tab. |
| `w20e-dcup.js` | The Diamond Cup (`WG.dcup`): baseball's weekly 8-nine bracket, entered through the League clerk (DIAMOND) or the Nine tab; you play your games, the rest are simulated on the engine; prizes, the journal and the Wall of Awards. |
| `w20f-feel.js` | Baseball's feel: Sudden Death's music stops on the diamond and Brimstone Diamond's follows the Music and Sound settings (`wBD.audio`); coach's notes for playing ball and the Diamond Cup; medals for ball games won and Diamond Cups. |
| `w21-grounds.js` | Sports grounds (issue #6): two per city, one for each of its region's sports, on a road outside the gate; each a walk-in map with the field drawn for its sport, stands, a scoreboard, a groundskeeper who explains the scoring and a fan. The Ballpark's keeper books ball games and the Diamond Cup. |
| `w21b-gmatch.js` | Games at the grounds (issue #6, phase 2): each ground needs a squad sized for its sport (`W_GRD_SQUAD`, 4 to 7); then its keeper puts on a Friendly or a Challenge, a card-game match locked to the ground's sport against the city's club, once a day. The record is on the scoreboard and in the journal. |
| `w22-cities.js` | Bigger cities (issue #6, phase 3): the five cities rebuilt at about twice the area with their own districts (`W_CITIES` replaces their `DB.towns` entries), homes you can walk into, and new decor tiles with ink painters (hedge, fence, flower bed, bench, crates, vegetable patch, goalposts, slag heap, fish rack). Old saves standing on a new wall move to the nearest open tile. |
| `w23-spots.js` | A sport in every city (issue #6, phase 4): two training spots per city (tile `!`), one per regional sport, each with a coach. Once a week at each: drill a card that suits the sport (Practice ★, free, an hour) and answer the coach's challenge on how the sport scores (20 gold and 5 fans). |
| `w24-fixtures.js` | Fixtures and the league at the grounds (issue #6, phase 5): each league round is drawn up in advance (`WG.league.next`), the clubs' games are played at the home side's grounds (results carry the ground, shown on its scoreboard), and you have a fixture every round, away, played at its ground through the keeper's card. Fans greet you by your place in the table. |
| `w25-home.js` | Home grounds move (issue #6, phase 6): the home ground (w14) is one of the sports grounds (`WG.ground.grd`), bought from its groundskeeper (HOME) or from the city's inn. Upgrades, beds, kitchen and scouts work as before; you host your league fixture there every other round (not at the Ballpark, which alone hosts ball games). Old saves move to the city's first ground. |
| `w26-gfeel.js` | The feel of the grounds (issue #6, phase 7): a theme per ground (`THEMES.wg_*`, walking it and in a match there), tips for the grounds, the squad, your fixture and the training spots, three medals (Groundhopper, Fixture List, Top of the Class), the League shop's team kit in Graftonbury (`WG.kit`, worn through a wrapped `clubTeam`), and match-day posters and results in the cities. |
| `w27-notices.js` | Notice boards (epic 2, phase 4): every city's inn posts three contracts for its region each week (`wBoard`; ask about the NOTICES). Take up to three, each for seven days; a won match that meets one (`wNoticeMet`, checked in a wrapped `wDispatchEnd`) pays gold and fans at once, and the harder ones a pick of cards. In the journal's Quests; a tip and the Odd Jobs medal. |
| `w28-legs.js` | Tired legs (epic 2, phase 5): `p.legs` counts the matches a player has started since a rest. At kickoff a Tired starter (3+) shuffles 1 Fatigue card into the draw pile and a Spent one (5+) 2; then starters' legs go up one and the bench's down one. A bed takes 4 off everyone, camping 2. Fresh, Tired or Spent tags on the Team screen, a pre-game line, a tip. |
| `w29-captain.js` | The captain (epic 2, phase 6): `WG.captain`, one starter, named with the Team screen's Captain button. While they start, their kind gives a team bonus (`W_CAPTAIN`, one per player kind, declarative `on:` handlers run by one `onHook` per event). A new journey or an old save names the first starter; a released captain hands the armband on. |
| `w30-weather.js` | Weather (epic 2, phase 7): each morning a blizzard may blow in the Frostspire, fog on the Brinefen, an ash storm in the Cindermaw (`WG.wx`). It changes matches out in the open and at outdoor grounds (`wMatchWeather`): Frostbite cards and Weak foes, 6 Block a side, or 4 Burn a side, plus a marker status on each side. Whiteout, Fog Bank and Cinder Wind play off the markers. The top bar names it, and the world is drawn in it. |
| `w31-name.js` | Regional fans (epic 2, phase 8): `WG.rep[region]`, earned by wins, cups and contracts there and lost a little by losses. Known: cheaper rooms at the region's inn. Liked: half price, and its free agents a level higher at the same fee. Loved: a home crowd (Block at kickoff) at every match in the region. Shown on the Team screen. |
| `w32-tour.js` | The Barnstormers (epic 2, phase 9): a show team that tours a region at a time (`WG.tour`), tracked by rumour (innkeepers' BARNSTORMERS, the notice boards' poster, a day behind after a move). In their region's open country they may turn up for a top-tier match; beat them for Showstopper, a Hall of Fame card no pool offers, then they go home for the year. |
| `w33-sinks.js` | Gold sinks (epic 2, phase 10): paid training camp sessions at the training spots after the week's free drill (rising prices, `WG.sink`), and League coaches between the five cities from any inn (`wTakeCoach`: a fare by distance, half the walking time, no encounters). |
| `w34-defend.js` | Defend the title (epic 2, phase 11): after the Crown, each crown adds to renown, the cups on your wall reopen the next year as title defences a level harder (`WG.defend`), rival clubs hunt the champions on the road (a rival `event` match with `ref.hunt`), and the Crown is a level harder for each crown held. |
| `w35-legends.js` | The Hall of Legends (epic 2, phase 12): a Crown writes your team (name, colours, starting three) to `pkey('sd-realm-legends')`, outside the journey's save. Later journeys copy the Hall (`WG.legends`) and meet those champions at the Crown Coliseum (Steward Crane's LEGENDS) and, with two cups, on the road, once a journey each. |
| `w36-gate.js` | Gate money at the grounds (issue #6, open question 4): no fee to play; a win at a card-game ground takes `W_TAKE.per` gold a tier (Friendly 5, Challenge 6) times your name in the region (`wTake`), shown on the keeper's and pre-game cards. |
| `w37-map.js` | The map of wherever you are: `M`, a Map button beside the Journal, or Map on the Menu. The world, a city, a ground, a house or a dungeon, each under its own fog of war (`WG.fog` for the world, `WG.fogs[mapId]` for the rest), revealed as you walk. A tab shows the realm from inside. Dungeon maps cross off beaten teams' rooms and show the alpha, strongboxes and stairs; town maps label the street signs. |
| `w38-soccer.js` | Soccer at Rimewatch (issue #10): the Rimewatch Sheet is the Hoarfrost Pitch (`g_sheet`, soccer, in `w21-grounds.js`), and an older save clears its curling record there once (`WG.soccer`). |
| `w39-retire.js` | Retire a card at your home ground: once a week, a card leaves your deck for `W_RETIRE.energy` energy of your home region's element (`WG.ground.retired`). The vendors' gold trade is unchanged. How to play explains both. |
| `w42-gridiron.js` | The gridiron view (issue #9, phase 1): `showView('gridiron')`, a bar with the four calls plus Punt and Field goal, three modes (Coaches, You call, You play), Start over, back to the world; under the field, `#wGridPanel`: who is on it with their ratings (hovering a row rings them on the field), the drive play by play with why each went that way, and How it works. Clinker Dunn at the Ash Bowl puts on a DRIVE (act `drive`: one drive by the Cinderhold Football Club from its own 25) or GRIDIRON (act `ggame`: a whole game, two halves, and on Call the plays you pick the defense too; GAME and FOOTBALL stay the card-game match and its rules), nothing won or lost. Leaving or starting over mid-game asks first (`wGridForfeit`): it forfeits the game. How to play: `#wHelpGridiron`. |
| `w43-gfseven.js` | Football ratings and the seven (issue #9, phase 3). `p.gf` on every player (speed, strength, hands, arm, kicking, tackling, 1 to 12), seeded from the kind and grown a point a level, as `p.bd`; older saves get them on load. `WG.seven`: who plays football and where, on offense and on defense, with call-ups at your level in any gap. The Seven tab on the Team screen, a Football block on each player's stats, and Practice game (your seven against the Cinderhold Football Club). How to play: `#wHelpSeven`. |
| `w44-gfgame.js` | Football games from the world (issue #9, phase 5), as `w20d` is for baseball. Your seven plays the local side or a rival: Play (`'play'` mode), Manage (`'call'`) or Simulate (`wGF.simGame`). Five players of your own; each club once a day. A win pays XP, gold and fans by tier, a loss a quarter of the XP (question 5), a tie half. Box lines (`WG.gfstats`), the head to head and the league table; Save and leave keeps the game at its last call (`WG.gfg.live.snap`) through a reload; pressed during a play, it leaves at the next call, so the play counts; Concede. Clinker Dunn's GRIDIRON and the Seven tab open the game card; the Stats tab gets a Football view. How to play: `#wHelpGfGame`. |
| `w45-gfpowers.js` | Monster powers on the gridiron (issue #9, phase 6; the engine's side is `src/gf/parts/14-powers.js`). The powers row at the foot of the bar in You call and You play: your mana, the powers your players can cast with this call (G goes through them), Auto powers (T), and the tip box with each power's pros and cons for the down. How it works gains powers, stamina and every kind's powers; How to play: `#wHelpGfPowers`. Wraps `wGridBar` and `renderHelp`. |
| `w46-gfcup.js` | The Cinder Cup and fixtures at the Ash Bowl (issue #9, phase 7). Football's weekly cup, as `w20e` is baseball's: eight sevens, three rounds of rising tier, your games on the gridiron (Play, Manage or Simulate) and the rest simulated on the engine; a tie after Sudden Death goes to the yards from scrimmage. Clinker Dunn's CINDER topic, the Seven tab and the game card open it. Your league fixture at the Bowl is a gridiron game (`kind: 'gfix'`), and the clubs' fixtures there are simulated on the engine (`wSimAt`). How to play: `#wHelpGcup`. |

### Brimstone Diamond (`src/bd/`)

The baseball engine for issue #4, from the same designer's *Brimstone Diamond*. It is split at its own section headers into `src/bd/parts/`, with its page (`shell.html`) and stylesheet (`bd.css`). `./build.sh src/bd/manifest.txt` builds the standalone game into `build/`. The Realm takes the same parts through a `scope wBD …` line (`src/realm/diamond/manifest.txt`), because about 70 of its names (`G`, `S`, `KIND`, `drawFig`, `frame`…) are also Sudden Death's. `src/bd/README.md` has where the source came from and the one edit made for scoping. `test/realm_diamond_source.py` proves both builds play a game and that the scoped one leaks nothing.

**Inside the Realm.** Brimstone Diamond expects to own its page: about 120 `getElementById` calls, document click handlers, window key listeners, a frame loop from load, its own saves and hash pages. `src/realm/diamond/d0-page.js` opens the scope and declares the page names its parts see. `document` looks up ids and selectors in a shadow root inside `#v-diamond`, and puts its listeners there, so its ids (`cv`, `pg-play`…) and its CSS never meet ours. `window`'s listeners, `requestAnimationFrame` and `setInterval` only act while the diamond is shown, so its loop is parked and its keys are dead in the world. `localStorage` is an in-memory Map, and `location`/`history` are stubs. Its CSS is mounted with `:root` turned into `:host` and `body` into the page wrapper; `BDX_OWN_CSS` hides its header, menus and other pages. `exports.js` wraps `gameOver` and `showMenu` inside the scope so the Realm hears about a final or a quit. `test/realm_diamond.py` checks all of this.

### Cinder Gridiron (`src/gf/`)

The football engine for issue #9, played at the Ash Bowl. Unlike Brimstone Diamond it is new code, written for the Realm: `src/gf/manifest.txt` lists its parts, and the Realm takes them through `scope wGF …` (`src/realm/gridiron/manifest.txt`), so its names stay private. What it needs from Brimstone Diamond is copied and adapted, not shared (question 6). The parts, in load order:

- `01-util.js`: the seeded random number (`gfSeed`), so a headless drive plays the same twice, and small helpers.
- `02-rules.js`: `G` (plain JSON: `{ poss, ball, down, togo, score, plays }`, the ball in yards from the offense's own goal line), downs and the chains (`gfSpot`), field goals, turnovers.
- `03-figures.js`: Brimstone Diamond's inked players (`drawFig`), copied with the weapons taken out and its clock (`GFT.t`).
- `04-teams.js`: football ratings by kind (`GF_KIND`: spd, str, hnd, arm, kck, tkl), and the lineup the same seven play both ways.
- `05-plays.js`: four offense plays and three defenses. Each has its own formation (`set`): on a run the receivers line up tight and block, and on a blitz the linebacker and safety creep up. `GF_EDGE` says how each call tends to go against each defense, for the result's reason.
- `06-live.js`: the live play on a fixed step (`L`, plain JSON). Blocks, the handoff or the throw, catches, tackles and broken tackles are settled from the ratings. The calls only say where everyone goes, so their matchups come out of the field.
- `07-cpu.js`: the coaches' calls (through the playbook's counter-calls) and fourth-down decisions.
- `08-drive.js`: one drive, from call to snap to result, with what happened and why (`gfWhy`); you may punt or kick on any down in call mode. `gfSim` runs the same flow headless.
- `09-draw.js`: the field, the players (with their positions between plays), the blocks and the scoreboard, which gives each result's reason, and in a game the half and the clock.
- `11-play.js`: Play mode (phase 2). You play your side's offense by hand: hold Space to lead the ringed receiver and let go to throw (Q and E pick another), WASD to steer the carrier or scramble, Space once a play for a stiff-arm, and a two-tap power-and-aim meter for your kicks. On defense you call and watch (question 3). The page writes the keys through `gfInput`; `L.ctl` holds them as plain data.
- `13-box.js`: box scores and saving (phase 5). Each play adds to its players' lines (`G.box`); `gfSnapshot` is the game at a call, plain JSON, and `gfResume` puts it back on the field.
- `14-powers.js`: monster powers (phase 6), as on the diamond. Team mana (`G.mana`), an offense and a defense power by kind (`GF_POW`) cast with the call, one ultimate a game per kind (`GF_ULT`) that leaves a zone (`G.zones`) for 3 plays or the drive, and stamina (`G.stam`: every play and every cast cost it; below half a player plays on worn ratings). Every power is one set of effects (`GF_FX0`) merged into `L.fx` at the snap, which `06-live.js` reads. The CPU casts at three skill levels (`G.skill`); power tips (`gfPowerTip`).
- `12-playbook.js`: the playbook (phase 4). Plays and defenses tire with use and recover while others are called (`G.fresh`, question 4); a stale call is one the other side sees coming (`L.read`, `L.tell`: the defense jumps a stale play, and a stale defense is easier to beat). The coaches' counter-calls read the other side's recent calls (`G.seen`) and lean to what beats them.
- `10-game.js`: a full game (phase 2). Two halves on a game clock that runs through plays and between them and stops as in real football, kickoffs after scores and at the half, the extra point, and Sudden Death when it's tied (the first score wins). `gfSimGame` plays one headless; a game takes about 7 minutes to watch.

`test/realm_gridiron.py` asserts the drive, the matchups over 200 seeded downs each (the blitz beats the deep pass, the screen beats the blitz, the deep zone gives up short runs), the view and the calls, the panel (the lineups, the drive's log with reasons), kicks on any down and fourth down waiting for you, and that the scope leaks nothing. `test/realm_gridiron_game.py` asserts whole games: 200 seeded games end with sane scores in 6 to 9 minutes to watch, near even between the exhibition clubs, Sudden Death, and your defensive calls. `test/realm_gridiron_seven.py` asserts the ratings (seeded, grown, older saves), the seven (call-ups, swaps, Sit out and Replace, the coaches' re-pick), that the engine plays your positions, that ratings matter, and the Seven tab and Practice game. `test/realm_gridiron_world.py` asserts games from the world: Simulate paid in the world, once a day, Manage on the field, Save and leave through a reload, Resume, a game played out, Concede, the Seven tab, the card, and the Football view. `test/realm_gridiron_playbook.py` asserts tiring and resting, that stale calls cost yards, the counter-calls, and the fresh bars on the call buttons. `test/realm_gridiron_cup.py` asserts the Cinder Cup (entry, the bracket on the engine, a round on the field, ties on yards, the prize, once a week, knocked out) and fixtures at the Bowl. `test/realm_gridiron_fixes.py` asserts the fixes from the review: a conceded cup game is a loss, a game simulated during yours leaves yours on the field, head to head counted once at the Bowl, a picked power gone after a punt, ultimates per kind, and Save and leave during a play. `test/realm_gridiron_powers.py` asserts powers: every kind's, their effect on the field over seeded downs, mana and stamina, ultimates and their zones, the reason, the Archmage's choices, Auto powers, G and T, the tip box, and the help. `test/realm_gridiron_play.py` asserts Play mode: throws to the ringed receiver and as good as the coaches', steering, the scramble, the stiff-arm, and in the Realm a pass thrown with Space and a field goal on the meter.

### The match seam

`startMatch({ type, tier, sport?, ids?, world: { kind, ref } })` (`w5-bridge.js`) builds a Sudden Death encounter at `RUN.act = tier - 1`, shows the pre-game card and calls `beginFight`. The world context rides on `RUN.pending.world` as plain data, so a mid-match save restores it. When the match ends, `W_ON_END[world.kind](result, ref, world)` runs, looked up by name: `wild`, `alpha`, `lair`, `event`, `room`, `cup`. Nothing stores a callback. A win goes through Sudden Death's reward panel, whose Continue (`backToMap`, reassigned) returns to the world; a loss is a blackout (`wBlackout`), or the end in Hardcore. **Not yet** on the pre-game card calls `wBackAway(enc)`: for a road event's match it reopens the event card (`w9-road.js`), because an event only closes, and its choice is paid, at kickoff.

### Conventions

- **Realm names start with `w` or `W`** (`WG`, `wLog`, `W_CUP`). The Terra Chimera names `DB`, `MAPS`, `WW`, `WH`, `regionAt`, `mulberry`, `noise2` are the only exceptions. Never declare a name Sudden Death already has.
- **Wrap by reassignment.** Later realm files change earlier ones, and Sudden Death, only by saving the original and reassigning: `const wW11PreGame = wPreGame; wPreGame = function (enc) { wW11PreGame(enc); … };`. The saved original is named `wW<n>` plus the function name, where `<n>` is the part doing the wrapping (`wW10` … `wW15`); a Sudden Death original saved in the realm is `wSd…`. Each file's header comment lists what it wraps.
- **How to play** is one section, `#wHelp`, built by `w5-bridge.js` and added to by each part's `renderHelp` wrapper, in load order. Each part's block keeps its id (`wHelpTeam`, `wHelp4`, `wHelp5`, `wHelpCups`, `wHelpRenown`, `wHelpGround`): the tests look for them.
- **Talk topics** are lower-case keys; an ALL-CAPS word in a line becomes a link when the speaker has a topic for it. `test/realm_polish.py` checks every capitalised word leads somewhere, and `wAudit` checks every `need` flag is set by something.

### The save

One record per profile: `localStorage[pkey('sd-realm')] = { v: 2, WG, RUN }`. `saveRun`, `loadRun` and `clearRun` are reassigned to it, so Sudden Death's mid-match snapshot (`RUN.battle`) works unchanged. `WG` and `RUN` must stay plain JSON, like `B`.
