# Realm phase 1: interfaces between the parts

These are the shapes the parts agree on, so they can be built in parallel. See `PLAN.md` for the why, and `context/terra_chimera.html` (TC) for the source being ported.

## Build and scope

- `./build.sh src/realm/manifest.txt` puts the parts in this order and writes `dist/realm.html`:
  1. the prelude `src/realm/w00-pre.js`;
  2. every Sudden Death part (SD), in the same order as `build.sh`;
  3. the realm parts: `w1-data`, `w2-maps`, `w3-state`, `w4-ink`, `w5-bridge`, `w7-ui`, `w8-boot`.
- The page shell is SD's `src/shell.html`. The manifest's `style src/realm/w0.css` line adds the realm CSS to its `<style>`, and `w7-ui.js` inserts `<div id="v-world" hidden></div>` after `#v-map` while loading.
- SD's files now live in named folders (see `ARCHITECTURE.md`); old part names like `p7`/`p8` in this doc map to them through the table there.
- **One global scope with SD.** Never declare a top-level name SD already has. The build refuses duplicates, and `node --check` refuses a second `const`/`let`.
  - Realm-only names start with `w` or `W` (`WG`, `wLog`, `wAdvance`). The TC-native names `DB`, `MAPS`, `WW`, `WH`, `regionAt`, `mulberry`, `noise2` are free.
  - Reuse SD's helpers instead of TC's: `$`, `esc`, `pick`, `ri`, `wpick` (SD's version takes a different shape, so check before use), `clamp`, `modal()`, `askConfirm()`, `showTip`/`hideTip`.
  - Avoid TC's colliding names entirely: `G`, `B`, `UI`, `log`, `advance`, `startCombat`, `endTurn`, `doMove`, `frame`, `boot`, `ST`, `EN`, `cv`, `ctx`, `cap`, `showTip`, `saveSettings`.
- **Load order.** Realm parts load after all of SD, so they may read SD tables (`KIND`, `KIND_NAME`, `SPORTS`, `CLUBS`) at load time.
- **No `alert`/`confirm`/`prompt`.** Canvas state changes go inside `save()`/`restore()`.
- **No DOM at load time** in w1–w3. They must run headless.

## Data (w1-data.js)

- **`const DB = { … }`**, ported from TC part3, *without* these TC registries, which are not used in Realm:
  - `species`, `parts`, `uniques`, `muts`, `trees`, `moves`;
  - the type tables `MT`, `ST`, `LK`, `PT`, `UT`;
  - `companies`' starter species;
  - `encounters`/`encountersNight` (phase 4 rebuilds these as SD teams).
- **Keep:** `meta`, `regions`, `tiles`, `locs`, `towns`, `dungeons`, `chars` (NPC dialogue), `events`, `cups`, `items` (non-combat ones only), `shops`, `recipes`, `crew` (handler, ench and cook only).
- **`DB.tiles[ch]`** = `{ name, walk, enter?, use?, enc?, ground?, look }`, using TC's single-character tile codes, unchanged.
- **`DB.regions[id]`** for ids `plains`, `bloom`, `tide`, `ember`, `rime`. Each keeps TC's fields and adds:
  - `sports: [[sportId, weight], …]`, with sport ids from SD `SPORTS`:

    | Region | Sports |
    |---|---|
    | plains | baseball, basketball |
    | bloom | golf, jousting |
    | tide | bowling, curling |
    | rime | hockey, curling |
    | ember | football, boxing |

  - `kinds: [SD kind ids]`: 4–6 native creature kinds from SD `KIND_NAME` that fit the region.
- **NPCs (`DB.chars[id]`)** keep TC's keyword topics. Each gets **`kind`**, an SD creature kind used to draw them, since everyone in the realm is a monster.
  - Topics whose payouts reference dropped systems (`giveEgg`, `needSp`, `needCaught`, `takeParts`, species or part rewards) are removed or replaced with gold, items or flags.
  - Write each removal down in a `// dropped:` comment.

## Maps (w2-maps.js)

- **`const MAPS = {}`.** `buildAllMaps()` fills it with `world`, every town and every dungeon. It is deterministic (seeded with `mulberry`).
- **A map** is `{ id, name, kind: 'world'|'town'|'dungeon', w, h, t, region?, npcs, spawn, meta, light }`:
  - `t` is rows of single-character tiles: `t[y][x]`.
  - `region` is only on `world`: a flat array indexed `y*w+x` of region ids.
  - `npcs` is a list of `{ id, x, y }`.
  - `spawn` is `[x, y]`.
- **Exported:** `regionAt(x, y)`, `walkCh(ch)`, `bfsReach`, `worldProblems()`, `dungeonProblems(map)`.
- **`wAudit()`** is the port of TC's `audit()`, minus checks on dropped registries. It returns a list of problem strings, and `[]` means clean.

## Renderer (w4-ink.js)

- **Scale.** `const WTILE = 32` logical pixels per tile, drawn at device-pixel ratio on whole pixels.
- **Palette.** `WINK[regionId]` gives the paper, ink and accent colours for each region. Towns and dungeons use their region's palette; dungeons are darker.
- **`wDrawMap(c, mapId, camX, camY, vw, vh, t, opts)`** draws the visible tiles of a map onto context `c`, with the camera's top-left at tile coordinates `camX`/`camY` (fractional allowed) and a view of `vw` by `vh` logical pixels.
  - Static tiles come from a per-map offscreen layer cache.
  - Animated tiles (water, lava, flags) may draw live.
  - `opts` = `{ night: 0..1, lights: [[x, y, r]], noNight? }`. `noNight: true` skips the darkness entirely (also a dungeon's), for callers that draw it themselves over their actors.
- **`wInvalidate(mapId?)`** drops the layer cache, for example after a tile changes.
- **`wDrawActor(c, who, px, py, t, opts)`** draws a creature standing at logical pixel `px`/`py` (feet). `who` = `{ kind, col?, face: 'l'|'r', walk? }`.
  - Use SD's renderer (`drawMonster`/`drawAny`, p1) at a small scale, through a sprite cache like `drawWho` (p7).
- **Look.** Ink style matching SD: hand-inked outlines, cel fills, cross-hatching for shade, paper texture.
  - Each tile code needs a readable look at `WTILE`: grass, tall grass, woodland, water, bridge, road, mountain, lava, sand, snow, buildings, doors, signs, counters, wells, nests, bushes, chests, stairs and so on.

## State, movement and UI (w3-state.js, w7-ui.js, w8-boot.js): phase 1, second wave

- **`let WG = null`**, the world state, ported from TC's `G` minus the dropped systems: `{ v, map, x, y, face, step, year, day, dayAbs, min, flags, items, home, npc, seen, marks, club, hardcore }`. Since phase 2 there is no `WG.gold` or `WG.party`: Sudden Death's `RUN` holds the team (`RUN.party`), deck, HP and the only purse (`RUN.gold`).
- **Functions:** `wNewGame()`, `wTryMove(dx, dy)`, `wEnterMap(id, x, y)`, `wInteract()`, `wSay(id, kw)`, `wAdvance(min)`, `wHour()`, `wDarkness()`.
- **Steps that would roll an encounter** call `wEncounterHook(region, tileCh, info?)`. Phase 2 (`w5-bridge.js`) makes it roll wild matches and start alpha matches.
- **`#v-world`** holds the canvas, the HUD (place, time, gold, party portraits through SD `portraitURL`), the log and a talk panel.
- **Input:** arrows/WASD, Space or Enter to interact, plus on-screen pads for phones. Listeners only act when `UI.view === 'world'`.
- **The frame loop:** realm reassigns `frame` so it also draws the world when `UI.view === 'world'`. SD's `frame` is a function declaration; wrap it by reassignment and keep the error trap.
- **Boot:** realm's title screen gets a "Walk the realm" button, which calls `wNewGame()` and `showView('world')`. `showView` is reassigned to know about `world`.

## The match seam (w5-bridge.js): phase 2

- **`startMatch({ ids?, type, sport?, tier, trait?, stakes?, name?, card?, world: { kind, ref } })`** builds an SD encounter (SD's `rollEncounter` at `RUN.act = tier - 1` when `ids` is missing; the sport from the region's weights when `sport` is missing), shows the pre-game card (`card: false` skips it), and kicks off with `beginFight`. The world context is plain data on `RUN.pending.world` = `{ kind, ref, tier, act0, region, map, x, y, night, name }`.
- **Ends** dispatch by name: `W_ON_END[kind](result, ref, world)`, for `wild`, `alpha` and `lair` so far. Never store a callback.
- **Win:** SD's path (rewards, stakes, the reward panel). Its Continue (`backToMap`/`advanceAct`, both reassigned) returns to the world; `RUN.act` goes back to `act0`, and a boss never advances SD acts.
- **Loss:** a blackout (`wBlackout`: wake by the innkeeper of `WG.home` or Graftonbury, lose 10% gold and 25% fans, HP back to at least half), or in Hardcore (`WG.hardcore`) `recordRun('lose')` and SD's end screen, which clears the save. Conceding (run bar or pause) is a loss.
- **Tiers:** `W_TIER` by region (plains 1, the outer regions 2) and `W_DUNGEON_TIER` by dungeon (Hatchery and Emberdeep 2, Gene Vault and Deep Seam 3).
- **Save:** `localStorage[pkey('sd-realm')] = { v: 2, WG, RUN }`. SD's `saveRun`, `loadRun` and `clearRun` are reassigned to it; v1 saves (WG only) get a RUN on load.
- **Cards from the world:** `wGainCard(id | { id, up } | { pick, rarity?, kind?, pool? }, why)` is the one way in; chests and topics pay through `card:`, `cards:` and `cardChoice:`. Phase 3 calls it for players' cards.
