# CLAUDE.md: working context for Sudden Death

Read this first, then `ARCHITECTURE.md` for the code map. `README.md` is the public-facing doc.

## What this is

A single-file browser deckbuilder (Slay-the-Spire-like) in the *Fantasy Monster Sports* series. Every fight is also a sports game under one of nine rulesets. The shipped artifact is `sudden-death.html`, which is generated from ordered parts in `src/` by `./build.sh`. There is no framework, no bundler and no runtime dependencies: plain JS in one global scope, Canvas 2D for the arena, and DOM for everything else.

## How it was developed

Built in one long, iterative collaboration in claude.ai between the designer (Geoff / Cutups) and Claude, published as a claude.ai artifact after every change. The loop each time was:

1. Edit `src/`.
2. `./build.sh`.
3. Run Playwright checks and screenshots.
4. Run the headless balance bots.
5. Publish.

Roughly in order:

1. **Core game.** Card engine (attack/skill/power, then set plays, gear, Hall of Fame legendaries, extra costs and keywords), 18 creature kinds with a procedural ink-style renderer, 3 acts, map generation with route repair and rival nodes, 9 bosses with "brains" and phases, VFX layer.
2. **Sports layer.** Per-sport scoring on every card (`p4b`), momentum (the score margin changes damage), highlights and sports wins, then field visuals per sport, the crowd, and the scoreboard.
3. **Run meta.** Season log of every game, per-player stats and careers, the sky (moon phases and constellations on a shared tick), music and settings, the open draft (free agents), 8 clubs with styles and unique trophies, the treasure scene.
4. **Hardening.** Blur bug (canvas size drift and leaked context state), refactor pass (damage breakdown, coach's notes, hooks registry, sprite cache, elite scouting reports), pause and mid-fight save/resume.
5. **Difficulty.** Act 1 retune, four difficulty levels, then a global retune once the bot was taught to spend the newer rewards.
6. **Sports punch-up.** Published per-room schedule with act home sports, Practice (★) as a separate upgrade track, 25 archetype cards for under-served sports, "fits" glyphs, scoring animations, play of the game, season goals (3-tier ladders), fans and the fan stand.
7. **Meta progression.** Achievements (bronze/silver/gold), local player profiles (Guest = no-login mode), enemy sport perks, high-stakes rooms.
8. **Fixes found by tests.** A tooltip name collision, Mountain Boots never working, a profile-switch save leak, native `confirm()` blocked in the artifact frame.

Design decisions were usually tested with bots before shipping. For example, "draw 4 cards" was tried as a global fix for Act 1 being too easy. It failed (Act 1 barely changed and Acts 2–3 became brutal), so it became the Hall of Fame difficulty instead.

## Commands

```bash
./build.sh                                    # build; fails on syntax errors or duplicate top-level names
./test/all.sh                                 # quick suite (several minutes); run before every commit
python3 test/<name>.py                        # one check
python3 test/lab.py 200                       # balance: win rate, deaths by act, sports-win rate per sport
python3 test/difficulty.py 120 '{}' diff=1 dumb   # skilled vs careless bot on a difficulty
python3 test/policy.py 200                    # routing policies
python3 test/clubs.py ironmaw,frostfang 60    # per-club win rates
```

Tests need Python Playwright with Chromium (see `requirements-dev.txt`). Screenshots go to `/tmp/`.

## Rules of the road

- **Never edit `sudden-death.html`.** Edit `src/`, then build.
- **One global scope.** Parts are concatenated in build order. A second top-level `function foo` silently replaces the first; `build.sh` now refuses this, so keep it that way. To wrap an existing function, reassign it (`renderTitle = function () { … }`) rather than redeclare it.
- **Load order matters only at load time.** A part may call later parts at runtime but not while loading. Data tables that read other tables at load (e.g. `p2c` reads sky groups) must come after them.
- **`B` (battle state) must stay plain data.** It is JSON-snapshotted for mid-fight saves. No functions, Maps, Sets or object identity that matters. Enemy plans are recomputed on restore.
- **Persisted per-player data goes through `pkey('sd-…')`.** Settings (`sd-settings`) are per device; everything else is per profile.
- **No `alert` / `confirm` / `prompt`.** claude.ai frames block them silently. Use `askConfirm()` and `modal()`.
- **Canvas state.** Wrap `shadowBlur`, `filter`, `globalAlpha` and composite changes in `save()`/`restore()`. The frame loop resets the context as a safety net, but do not rely on it.
- **Explain numbers.** New damage modifiers inside `atkDmg` use its `add()`/`mul()` helpers so the on-screen breakdown includes them.
- **Trophies are declarative.** Add behaviour to `TROPHY_FX` (p2d) via `on:` events and `mod:` sums, not `hasRelic()` checks in the engine. If a moment is missing, add one `fire('event')` call.
- **Engine never touches the DOM.** It emits `fx({k: …})` events, and the scene drains them in `consumeFx()`. `LAB` mode (bots) disables sound, saves, tips, music and achievements.
- **Every new system gets a test** in `test/` and a line in `test/all.sh`. Known gap: most checks *print* their results (and `errors: [...]`) rather than assert, so a run can exit 0 with a failure in its output. Read the output, and convert checks to asserts when you touch them.
- **Balance changes get measured.** Use 100+ bot runs per side and report before/after. Bot win rates are relative: a careful human wins far more. When adding rewards, make sure `test/lab.js` spends them like a player would, or the numbers will lie (this happened once).
- **User-facing text:** plain, short, and specific. Every system is explained in How to play (`renderHelp` in p8).

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
- **Daily seeded challenge** with a shared record.
- **Folding momentum and the sky into the sports layer** to reduce the number of separate meta-systems.
