# CLAUDE.md: working context for Sudden Death

Read this first, then `ARCHITECTURE.md` for the code map. `README.md` is the public-facing doc.

## What this is

A single-file browser deckbuilder (Slay-the-Spire-like) in the *Fantasy Monster Sports* series. Every fight is also a sports game under one of ten rulesets. The shipped artifact is `dist/sudden-death.html`, which `./build.sh` generates from the source files listed, in order, in `src/manifest.txt`. There is no framework, no bundler and no runtime dependencies: plain JS in one global scope, Canvas 2D for the arena, and DOM for everything else.

## How it was developed

Built in one long, iterative collaboration in claude.ai between the designer (Geoff / Cutups) and Claude, published as a claude.ai artifact after every change. The loop each time was:

1. Edit `src/`.
2. `./build.sh`.
3. Run Playwright checks and screenshots.
4. Run the headless balance bots.
5. Publish.

Roughly in order:

1. **Core game.** Card engine (attack/skill/power, then set plays, gear, Hall of Fame legendaries, extra costs and keywords), 18 creature kinds with a procedural ink-style renderer, 3 acts, map generation with route repair and rival nodes, 9 bosses with "brains" and phases, VFX layer.
2. **Sports layer.** Per-sport scoring on every card (`engine/sports.js`), momentum (the score margin changes damage), highlights and sports wins, then field visuals per sport, the crowd, and the scoreboard.
3. **Run meta.** Season log of every game, per-player stats and careers, the sky (moon phases and constellations on a shared tick), music and settings, the open draft (free agents), 8 clubs with styles and unique trophies, the treasure scene.
4. **Hardening.** Blur bug (canvas size drift and leaked context state), refactor pass (damage breakdown, coach's notes, hooks registry, sprite cache, elite scouting reports), pause and mid-fight save/resume.
5. **Difficulty.** Act 1 retune, four difficulty levels, then a global retune once the bot was taught to spend the newer rewards.
6. **Sports punch-up.** Published per-room schedule with act home sports, Practice (★) as a separate upgrade track, 25 archetype cards for under-served sports, "fits" glyphs, scoring animations, play of the game, season goals (3-tier ladders), fans and the fan stand.
7. **Meta progression.** Achievements (bronze/silver/gold), local player profiles (Guest = no-login mode), enemy sport perks, high-stakes rooms.
8. **Fixes found by tests.** A tooltip name collision, Mountain Boots never working, a profile-switch save leak, native `confirm()` blocked in the artifact frame.

Design decisions were usually tested with bots before shipping. For example, "draw 4 cards" was tried as a global fix for Act 1 being too easy. It failed (Act 1 barely changed and Acts 2–3 became brutal), so it became the Hall of Fame difficulty instead.

## Commands

```bash
Activate the venv first (`source .venv/bin/activate`). On macOS, `brew install coreutils` provides `gtimeout` for per-check timeouts (optional).
./build.sh                                    # build; fails on syntax errors or duplicate top-level names (reads src/manifest.txt, writes dist/)
./test/all.sh                                 # quick suite (several minutes); run before every commit
python3 test/<name>.py                        # one check
python3 test/lab.py 200                       # balance: win rate, deaths by act, sports-win rate per sport
python3 test/difficulty.py 120 '{}' diff=1 dumb   # skilled vs careless bot on a difficulty
python3 test/policy.py 200                    # routing policies
python3 test/clubs.py ironmaw,frostfang 60    # per-club win rates
python3 test/daily_lab.py twists 300           # daily balance: each twist against none on the same days (paired); `week 52` for win rate by weekday
./build.sh src/realm/manifest.txt             # Realm build: writes dist/realm.html
./build.sh src/bd/manifest.txt                # Brimstone Diamond, standalone, into build/ (the Realm's baseball engine; src/bd/README.md)
python3 test/realm_smoke.py                   # one realm check (realm_*.py; all of them are in ./test/all.sh)
python3 test/realm_lab.py 140 '{}'            # Realm balance: champion rate, where runs end, per-match cost (docs/realm/BALANCE.md)
python3 test/realm_diamond_lab.py 120          # Realm baseball balance: win rate by level gap and tier, Diamond Cups (Simulate)
python3 test/realm_gridiron_lab.py 120         # Realm football balance: win rate by level gap, tier and CPU skill, powers on and off, stances, Cinder Cups, gear and potions by tier
python3 test/realm_ring_lab.py 120             # Realm boxing balance: card win rate by level gap, tier and CPU skill, powers on and off, Anvil Belts, gear and potions by tier
python3 test/realm_court_lab.py 120            # Realm basketball balance: win rate by level gap, tier and CPU skill, powers on and off, each set, defense and stance, Charter Nets, gear and potions by tier
python3 test/realm_rink_lab.py 120              # Realm hockey balance: win rate by level gap, tier and CPU skill, powers on, off and one side's, each system, special-teams setup and stance, Pond Kettles, gear and potions by tier
python3 test/realm_quick_shots.py              # retake the Quick start screenshots (all sports, or name some: links ball grid ring court rink), then rebuild
python3 test/realm_links_lab.py 400            # Realm golf balance: win rate by tier, level gap and caddie, powers on, off and one side's, each line and stance, gear and potions by tier, the enchanted course, the hitter rule, Divot Cups
python3 test/realm_stars_lab.py 200            # Realm superstar balance: what each superstar adds in the card game, football, baseball, basketball and hockey, against an ordinary player
```

Tests need Python Playwright with Chromium (see `requirements-dev.txt`). Screenshots go to `/tmp/`.

## Rules of the road

- **Never edit `dist/sudden-death.html`.** Edit `src/`, then build.
- **`src/manifest.txt` is the build order.** A new source file goes in the folder that says what it is, and on the manifest line that says when it loads. Folders do not imply order.
- **One global scope.** Files are concatenated in manifest order. A second top-level `function foo` silently replaces the first; `build.sh` now refuses this, so keep it that way. To wrap an existing function, reassign it (`renderTitle = function () { … }`) rather than redeclare it.
- **Load order matters only at load time.** A file may call later files at runtime but not while loading. Data tables that read other tables at load (e.g. `data/draft-class.js` reads the sky groups from `engine/sky.js`) must come after them in the manifest.
- **`B` (battle state) must stay plain data.** It is JSON-snapshotted for mid-fight saves. No functions, Maps, Sets or object identity that matters. Enemy plans are recomputed on restore.
- **Persisted per-player data goes through `pkey('sd-…')`.** Settings (`sd-settings`) are per device; everything else is per profile.
- **No `alert` / `confirm` / `prompt`.** claude.ai frames block them silently. Use `askConfirm()` and `modal()`.
- **Canvas state.** Wrap `shadowBlur`, `filter`, `globalAlpha` and composite changes in `save()`/`restore()`. The frame loop resets the context as a safety net, but do not rely on it.
- **Explain numbers.** New damage modifiers inside `atkDmg` use its `add()`/`mul()` helpers so the on-screen breakdown includes them.
- **Trophies are declarative.** Add behaviour to `TROPHY_FX` (`core/hooks.js`) via `on:` events and `mod:` sums, not `hasRelic()` checks in the engine. If a moment is missing, add one `fire('event')` call.
- **Engine never touches the DOM.** It emits `fx({k: …})` events, and the scene drains them in `consumeFx()`. `LAB` mode (bots) disables sound, saves, tips, music and achievements.
- **CI splits the quick checks across 4 shards** (issue #94), balanced by `test/ci-times.txt` through `test/shard.py`. A new check needs no time there (it counts as the median); refresh the file from a CI run's log when the suite changes a lot (`gh run view <id> --log | python3 test/shard.py --from-log > test/ci-times.txt`). The split costs about twice the runner minutes, free while the repo is public: if it goes private, go back to one job (the header of `.github/workflows/ci.yml` says how).
- **Every new system gets a test** in `test/` and a line in `test/all.sh`. Known gap: most checks *print* their results (and `errors: [...]`) rather than assert, so a run can exit 0 with a failure in its output. Read the output, and convert checks to asserts when you touch them.
- **Balance changes get measured.** Use 100+ bot runs per side and report before/after. Bot win rates are relative: a careful human wins far more. When adding rewards, make sure `test/lab.js` spends them like a player would, or the numbers will lie (this happened once).
- **Publishing as a claude.ai artifact:** declare the `db` and `user` capabilities, with the rules in `ui/screens/daily-board.js`'s header, or the daily's shared board stays off (each build is its own artifact with its own board).
- **User-facing text:** plain, short, and specific. Every system is explained in How to play (`renderHelp` in `ui/screens/pages.js`).

## Realm rules

Champions of the Realm (the Realm for short; `src/realm/`, `dist/realm.html`) layers an open world on this game. See the Realm section of `ARCHITECTURE.md` and `docs/realm/`.

- **Rebuild `dist/realm.html` after every change** (`./build.sh src/realm/manifest.txt`) and commit it. CI fails on a stale one. A change to Sudden Death's own files changes both builds.
- **`w`/`W` names only.** Every realm top-level name starts with `w` or `W` (except the ported `DB`, `MAPS`, `WW`, `WH`, `regionAt`, `mulberry`, `noise2`).
- **Wrap with the `wW<n>` prefix.** A realm file changes an earlier function only by reassignment, saving the original as `wW<n>Name`, where `<n>` is the wrapping part (`const wW11PreGame = wPreGame;`). Sudden Death originals saved in the realm are `wSdName`. List what a file wraps in its header comment.
- **`WG` and `RUN` stay plain JSON.** Match ends dispatch by name through `W_ON_END[kind]`; never store a callback.
- **Every realm system gets a `test/realm_*.py`** with real asserts, a line in `test/all.sh` and in the realm list in `.github/workflows/ci.yml`. Wait on state in tests, not fixed sleeps.
- **Realm words.** The world was ported from Terra Chimera; it is now a monster sports league. Your party is a team of players, rivals are clubs, fights are matches. No chimeras, snares, handlers or gene labs (`test/realm_polish.py` checks). A renamed talk keyword must be renamed in every topic, `need`, quest hint and test.
- **A weekly cup is a table, not a copy.** The engine cups (football, boxing, basketball, hockey and golf's Divot Cup) share one bracket (`w45b-bracket.js`): a new one registers `W_BRACKETS[key]` (its numbers, words, `sim`, `won`, `mark`) and writes only its game's result, prize and card. The engines' small helpers (seeded random, `clamp`, `pick`) are one file too, `src/scoped/util.js`, loaded inside each scope.
- **How to play** for the realm is `#wHelp`; each part adds its section in load order and keeps its id.
- **The boxing, football, basketball, hockey and golf engines are scoped.** `src/bx/`, `src/gf/`, `src/bk/`, `src/hk/` and `src/gl/` load inside `scope wBX`, `scope wGF`, `scope wBK`, `scope wHK` and `scope wGL` (the Realm's `ring/`, `gridiron/`, `court/`, `rink/` and `links/` manifests); the Realm reaches them only through `exports.js`. The players are drawn by one file the first four and bowling load inside their scope, `src/figures/figures.js`; each engine defines its clock, `figClock()`, and the file names no engine. Golf (Mossgate Links, issue #92) is the first turn-based engine: a state machine of shots, not a frame loop, and its shot model is pure, shared by Play, the CPU and the sim. Bowling (the Saltmere Lanes, issue #100, being built) is the second: `src/bl/` inside `scope wBL` (the Realm's `lanes/` manifest), the same pattern. Superstar data for them sits in `ring/r0-stars.js`, `gridiron/g0-stars.js`, `court/c0-stars.js`, `rink/k0-stars.js`, `links/l0-stars.js` and `lanes/p0-stars.js`, at the foot.
- **Fans are your following (issue #79).** `RUN.fans` is the one number; the step (`wFollowStep()`, `W_FOLLOW.at`) is read from it, never stored. An effect of a step checks `wFollowOn(step)`, which is false in LAB mode unless the lab sets `W_FOLLOW.lab`, so the other balance numbers stand. In an engine the following is a start value (`opts.fans`, `opts.crowd`), never a change to a rating, and the other side gets none. A new favour is a row in `W_STAND.favours` and a branch in `wStandBuy`; the realm bot must be able to buy it.
- **Gear, potions and powers (issue #61).** Gear is one piece a player per sport (`p.gear = { ring, grid, court, rink }`, w72); it reaches the engines through `wBxFighter` / `wSevenPlayer` / `wCourtPlayer` / `wRinkPlayer`, never by changing the player's own ratings. A new piece is `wGearAdd`, a new potion `wPotionAdd` and its engine table (`BX_POTIONS`, `GF_POTIONS`, `BK_POTIONS`, `HK_POTIONS`). The CPU uses its bag at its skill and logs every use with a reason; your coaches never open your bag in football, and Simulate leaves it alone in both sports. Each league kind has two boxing specials (picked on the Ring tab, `p.bxSp`) and two football powers each way (Seven tab, `p.gfPw`); a new kind or superstar needs both. Boxing powers spend spirit as well as stamina (`BX_SPIRIT`). An engine id must be unique across the engine and its star file (a clash silently replaces the other power).

## Current balance (bot, after the last retune)

| Difficulty | Skilled bot win rate | Notes |
|---|---|---|
| Rookie | ~61% | |
| Contender | ~23% | The designer found the earlier ~47% version far too easy |
| All-Star | ~13% | |
| Hall of Fame | ~3% | Draw 4; most bot runs die in Act 1 |

Routing: a balanced route that reads elite traits beats taking every elite, which beats avoiding elites. Sports-win rates by sport ranged from about 40% to 70% at last check; baseball and boxing are the easiest games.

## Open ideas, not yet built

- **Online accounts:** use the claude.ai artifact runtime's `user` and `db` capabilities to sync a signed-in player's records, careers and achievements privately across devices, falling back to local profiles everywhere else.
- **Instant replay** of the best play at the end of a fight.
- **Simulated league standings** next to your season record.
- **Rival continuity** across acts (they remember your last game).
- **Folding momentum and the sky into the sports layer** to reduce the number of separate meta-systems.
