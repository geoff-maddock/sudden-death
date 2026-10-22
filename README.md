# Sudden Death

**A dungeon-crawl deckbuilder where every fight is also a game.**
Part of the *Fantasy Monster Sports* series, alongside *Black Ice* (hockey) and *Brimstone Diamond* (baseball).

Draft a line of three monster athletes, build one shared deck, and fight up through three acts of the Brimstone League's underground. Every fight is played under a sport's rules (baseball, football, hockey, basketball, golf, bowling, jousting, curling or boxing), so you are trying to win the fight *and* the game. Beat the Commissioner of the Pit at the end of Act 3 to lift the Brimstone Cup.

The whole game is one self-contained HTML file. No server, no install, no build step for players.

---

## Play

- **Locally:** open `dist/sudden-death.html` in any modern browser (Chrome, Firefox, Safari, Edge).
- **Hosted:** any static host works. See [Deploying](#deploying).

Progress (runs in progress, the record book, careers, achievements, settings) is saved in the browser's `localStorage`, per profile. Nothing is sent anywhere. Fonts load from Google Fonts and fall back to system fonts offline.

### Controls

| Action | Mouse / touch | Keyboard |
|---|---|---|
| Play a card | Drag it onto an enemy, or click the card then the enemy | `1`–`9` and `0` pick a card, `←` `→` pick a target, `Enter` plays it |
| End turn | **End turn** button | `E` |
| Cancel a selected card | Click elsewhere | `Esc` |
| Pause / save and quit | **Pause** in the top bar | `Esc` or `P` |

### What's in it

- **18 creature kinds**, 8 clubs with their own styles and trophies, plus an open draft of free agents.
- **9 sports**, each with its own scoring rules, field visuals and scoring animations, a momentum system, highlights and a Highlight Reel.
- **A published schedule:** every fight room shows its sport, and each act has a home sport. Build and route for the games you are good at.
- **Practice (★):** a second upgrade track that makes a card better at the game without changing its fight stats.
- **9 bosses** with their own brains and phases, elite scouting reports, rival games, enemy sport perks and high-stakes rooms.
- **Season goals** (three-tier ladders per act), **fans** to spend at the fan stand, and the **play of the game**.
- **Four difficulty levels:** Rookie, Contender, All-Star, Hall of Fame.
- **Achievements** (bronze/silver/gold), **player profiles**, player stats and careers, a season log, and mid-fight save and resume.
- A procedural soundtrack with a theme per act, and coach's notes for first-time players.

---

## Champions of the Realm

**The same game, on the road.** Champions of the Realm is a second build of Sudden Death: an open-world RPG where you walk a realm of towns, wilds and dungeons with your team, and every fight is a Sudden Death match. Its world (regions, towns, people, road events, cups) is ported from an earlier game, *Terra Chimera*, and redrawn in Sudden Death's ink style.

It is one self-contained file too: `dist/realm.html`. Open it in a browser. It keeps its own save, per profile, beside the standalone game's.

### How to play, briefly

- **Found a team.** Pick a club and three of its players. More join on the road: free agents at every inn, players you beat, and quest companions. The first three in the lineup start; the rest sit on the bench, and their cards sit out with them.
- **Walk.** Arrow keys or WASD, or click. Walk into people to talk, and click a CAPITALISED word to ask about it. `Space` uses, `L` looks, `C` opens the team, and `Esc` (or the Menu button) opens the menu, where you can save and quit.
- **Play matches.** Wild teams in the long grass, road events, famous teams in dungeon rooms, and bosses in lairs. Team HP carries over; an inn heals it, or make camp in the wild with a Trail Ration, if you dare. Lose and you black out at your last inn (or, in Hardcore, the journey ends).
- **Grow.** Players level up and bring cards. Cook meals for match day, spend energy at the enchanter, buy cards in three towns, and find gear and Hall of Fame legends in dungeon strongboxes.
- **Settle.** Buy the old ground behind any inn and its region is home: your crowd at every match there, free beds, and stands, a training pitch, a kitchen and a scout's office to build.
- **Win.** Take the four regional cups, then the Crown at the Coliseum in championship week.

How to play inside the game explains every system, with the current numbers.

### Build and test

```bash
./build.sh src/realm/manifest.txt     # writes dist/realm.html (the standalone build is unaffected)
python3 test/realm_smoke.py           # any one realm check
python3 test/realm_lab.py 140         # the realm balance bot: champion rate, where journeys end, per-match cost
```

`./test/all.sh` runs the realm checks along with the rest: `realm_audit` (the world data and maps), `realm_tiles`, `realm_smoke`, `realm_match` (the match seam, blackouts, Hardcore), `realm_save`, `realm_party`, `realm_road`, `realm_town`, `realm_dungeon`, `realm_cups`, `realm_bot` (four bot journeys) and `realm_polish` (wording, event back-out, taverns, How to play). `docs/realm/` has the plan, the contract between the parts, and the balance notes.

---

## Deploying

The build output is a single static file, `dist/sudden-death.html`. Host it anywhere that serves static files.

### GitHub Pages (included workflow)

`.github/workflows/pages.yml` builds the game on every push to `main` and publishes it to GitHub Pages as `index.html`.

1. Push the repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`. The site appears at `https://<user>.github.io/<repo>/`.

### Anything else

- **Netlify / Vercel / Cloudflare Pages:** build command `./build.sh`, publish the `dist/` directory, and set `sudden-death.html` as the index (or copy it to `index.html` as the Pages workflow does).
- **Any web server or bucket:** upload `dist/sudden-death.html`.

### Hosting notes

- **Saves are per origin.** Players on a new domain start fresh, and the downloaded file keeps separate saves from a hosted copy.
- **Native dialogs.** The game never uses `alert`/`confirm`/`prompt`, because sandboxed frames (such as claude.ai artifacts) block them silently. Keep it that way if you embed it in an iframe.
- **Audio** starts only after the first click or key press, as browsers require.

---

## Development

### Requirements

- **Node.js 18+**, only used for `node --check` during the build.
- **Python 3.10+ with Playwright and Chromium**, for the test suite:

  ```bash
python3 -m venv .venv && source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
  ```

### Build

```bash
./build.sh
```

This reads `src/manifest.txt`, concatenates the files it lists, in that order, into `build/sudden-death.js`, syntax-checks it, refuses to build if two files define the same top-level name (they share one global scope), and writes `dist/sudden-death.html`.

**Edit `src/`, never `dist/sudden-death.html`.** The HTML file is generated. It is committed so the game is playable straight from the repo.

The manifest is the build order: one path per line, `#` comments, plus `shell <file>` (the HTML page), `out <file>` (where to write it) and `include <manifest>`. `./build.sh other-manifest.txt` builds from a different one.

### Project layout

```
src/                the game (see ARCHITECTURE.md for what each file does)
  manifest.txt      build order: the files load in this order, in one global scope
  shell.html        CSS and page shell
  core/             utilities, player profiles, hooks
  data/             clubs, statuses, cards, trophies, sports, enemies, bosses, the draft class
  engine/           combat, the sports layer, boss ops, player stats, the sky
  run/              a run: the map, rewards, events, saves, goals, achievements, trouble
  render/           the creature renderer, boss art, visual effects
  ui/               icons, card faces, widgets, the map; fight/ (the fight scene) and screens/
  app/              sound, music, settings, coach's notes, pause and saves, profiles, boot
  realm/            Champions of the Realm, layered on the files above (its own manifest.txt)
dist/               the built games, sudden-death.html and realm.html (generated, committed)
test/               Playwright checks and the balance bots
  all.sh            the quick suite
  lab.js            headless bot that plays whole runs from the model, not the screen
build.sh            build script (reads a manifest)
docs/           design notes, balance notes, changelog
ARCHITECTURE.md how the code fits together, conventions, how to add things
CLAUDE.md       working context for Claude Code
```

### Tests

```bash
./test/all.sh              # build + the quick suite (a few minutes)
python3 test/smoke.py      # any single check
```

The quick suite covers:
- **Core:** a smoke test, every enemy move through the tooltip code, hover tooltips, and a render fuzz across every enemy and sport.
- **Systems:** sprite parity and speed, every trophy hook, elite traits, sports, stats, the damage breakdown, coach's notes, the open draft, the treasure scene, stage resizing, Practice, scoring animations, season goals, and trouble (perks and stakes).
- **Persistence and flows:** pause/save/resume, difficulty, profiles, and forfeit.

### Balance tools

The bots play from the game model, so a whole run takes about a second.

```bash
python3 test/lab.py 200                            # win rate, deaths by act, killers, sports-win rate per sport
python3 test/policy.py 200                         # safe vs balanced vs greedy routing
python3 test/clubs.py ironmaw,frostfang 60         # win rate per club
python3 test/difficulty.py 120 '{}' diff=1 dumb    # skilled vs careless bot on a difficulty (0–3)
python3 test/difficulty.py 120 '{"draw":4}'        # try a TUNE override
```

All difficulty numbers live in `TUNE` and `DIFFS` at the top of `src/engine/combat.js`. The bot is weaker than a careful human, so treat its win rates as relative. Compare before and after, with at least 100 runs per side.

---

## Contributing

See [ARCHITECTURE.md](ARCHITECTURE.md) for the build order, the fight loop, hooks, saving, and recipes for adding cards, trophies, clubs, sports, bosses, elite traits, season goals and achievements. [CLAUDE.md](CLAUDE.md) has the working rules used while building it.

## Credits

Designed by Geoff Maddock (Cutups). Built iteratively with Claude.
All art, music and sound are generated in code at runtime. There are no asset files.

## License

TBD. Add a `LICENSE` file before publishing.
