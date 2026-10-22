# Sudden Death

**A dungeon-crawl deckbuilder where every fight is also a game.**
Part of the *Fantasy Monster Sports* series, alongside *Black Ice* (hockey) and *Brimstone Diamond* (baseball).

Draft a line of three monster athletes, build one shared deck, and fight up through three acts of the Brimstone League's underground. Every fight is played under a sport's rules (baseball, football, hockey, basketball, golf, bowling, jousting, curling or boxing), so you are trying to win the fight *and* the game. Beat the Commissioner of the Pit at the end of Act 3 to lift the Brimstone Cup.

The whole game is one self-contained HTML file. No server, no install, no build step for players.

---

## Play

- **Locally:** open `sudden-death.html` in any modern browser (Chrome, Firefox, Safari, Edge).
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

## Deploying

The build output is a single static file, `sudden-death.html`. Host it anywhere that serves static files.

### GitHub Pages (included workflow)

`.github/workflows/pages.yml` builds the game on every push to `main` and publishes it to GitHub Pages as `index.html`.

1. Push the repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`. The site appears at `https://<user>.github.io/<repo>/`.

### Anything else

- **Netlify / Vercel / Cloudflare Pages:** build command `./build.sh`, publish the repo root, and set `sudden-death.html` as the index (or copy it to `index.html` as the Pages workflow does).
- **Any web server or bucket:** upload `sudden-death.html`.

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
  python3 -m pip install -r requirements-dev.txt
  python3 -m playwright install chromium
  ```

### Build

```bash
./build.sh
```

This concatenates the ordered parts in `src/` into `build/all.js`, syntax-checks it, refuses to build if two parts define the same top-level name (they share one global scope), and writes `sudden-death.html`.

**Edit `src/`, never `sudden-death.html`.** The HTML file is generated. It is committed so the game is playable straight from the repo.

### Project layout

```
src/            the game, as ordered parts (see ARCHITECTURE.md for what each does)
  p0.html       CSS and page shell
  p1.js … p9.js renderer, data, engine, sports layer, run structure, UI, screens, audio
test/           Playwright checks and the balance bots
  all.sh        the quick suite
  lab.js        headless bot that plays whole runs from the model, not the screen
build.sh        build script
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

All difficulty numbers live in `TUNE` and `DIFFS` at the top of `src/p4.js`. The bot is weaker than a careful human, so treat its win rates as relative. Compare before and after, with at least 100 runs per side.

---

## Contributing

See [ARCHITECTURE.md](ARCHITECTURE.md) for the build order, the fight loop, hooks, saving, and recipes for adding cards, trophies, clubs, sports, bosses, elite traits, season goals and achievements. [CLAUDE.md](CLAUDE.md) has the working rules used while building it.

## Credits

Designed by Geoff Maddock (Cutups). Built iteratively with Claude.
All art, music and sound are generated in code at runtime. There are no asset files.

## License

TBD. Add a `LICENSE` file before publishing.
