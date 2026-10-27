# Brimstone Diamond source

Brimstone Diamond (monster-league baseball, by the same designer) is the engine that the Realm's baseball games will run on ([issue #4](https://github.com/geoff-maddock/sudden-death/issues/4)).

## Where this came from

It came from `brimstone-diamond_12.html`. The browser snapshot in `context/` (saved from `brimstone-diamond_13.html`) has a byte-for-byte identical engine script, stylesheet and head scripts.

- **`shell.html`:** the page markup and head, with an empty `<style>` that `bd.css` fills.
- **`bd.css`:** the stylesheet.
- **`parts/NN-*.js`:** the one script, split at its own `/* ===== section ===== */` headers. One file per section, in the original order. `manifest.txt` lists them.

### The one edit

The parts concatenate to the original script with one change.

- **What changed:** eight tables are top-level `var`s that the code read as `window.MOON`, `window.LEAGUES`, `window.GAMES`, `window.TAKE`, `window.GEAR`, `window.FO_READY`, `window.DG_READY` and `window.CAREER`. Those 28 reads now use the bare name.
- **Why:** inside a scope, a `var` is not a `window` property, so the old reads would quietly switch those features off.
- **Why it's safe:** a `var` is hoisted in both a script and a function, so the bare read behaves the same in both builds.

## Builds

| Command | Output | Use |
|---|---|---|
| `./build.sh src/bd/manifest.txt` | `build/brimstone-diamond.html` | the standalone game, not committed; proves the split |
| `./build.sh test/fixtures/bd-scope.txt` | `build/bd-scoped.html` | the same parts inside `scope wBD …`, the way the Realm will take them |

A `scope` line wraps a manifest's files in one function, so the ~70 names that Brimstone Diamond shares with Sudden Death (`G`, `R`, `S`, `KIND`, `drawFig`, `frame`…) stay private. The line is described in the header of `build.sh`.

`test/realm_diamond_source.py` checks the following:

- both builds;
- a full 3-inning CPU game in each;
- that nothing but `wBD` reaches the page.

## Rules for these files

- **Realm naming rules:** the `w`/`W` naming rules for the Realm don't apply inside the scope. The scope's exports are its API.
- **Changes:** edit the parts here; there is no other copy. Later phases cut what the Realm doesn't use: the menu, season, clubhouse, team builder, records, settings, cloud sync, 2-player mode and its own saves.
