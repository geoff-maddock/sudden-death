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

## The party is the team (w6-party.js, w7b-camp.js): phase 3

- **`WG.roster`** = `[{ id, n, kind, num, flav, lvl, xp, joined, from }]` in lineup order: the first 3 start, the rest are the bench (up to 8). Only one player of each kind can start. `RUN.party` is always the 3 starters (`wSyncParty`), so `runKinds`, `cardPool`, `SIG` and the HUD follow the lineup.
- **Cards belong to players.** `RUN.deck` is the whole collection in the world. A card with `wp` (a player id) plays only when that player starts; a card without one (league cards) always plays. `wKickoff` (wrapped) moves the bench's cards to `RUN.wbench` for the match, so mid-match saves and SD's reward panel see only the match deck; `wDispatchEnd` (wrapped) puts them back and tags new kind cards to the starter of that kind.
- **Levels:** XP per match (`W_PARTY.xp[type] * tier`, a quarter for a loss, half for the bench, a bonus for player of the game). A level up gives +2 team max HP and a pick of 3 cards of the player's kind (`wGainCard({ pick, pool, pid })`). Picks and recruits queue in `WG.wprompts` and show when the world is free.
- **Recruiting** always ends in `wRecruit(player, from, done?)`: the signature card and 1-2 kind cards, or a release question when the roster is full. Sources: taverns (topic `agents` at every inn, `WG.tavern[town]`, weekly), post-game (`W_PARTY.recruitOdds`, `W_PARTY.force` for tests), and quest topics with `recruit: { kind, n, lvl }` (paid in `wSay`).
- **New game:** SD's draft screen (`renderDraft`, reassigned while `DR.realm`) picks the club, the 3 founders and Hardcore; `wStart(null, { club, picks, roster?, relic?, hardcore })`. `WG.rivals` maps each TC company to an SD club other than yours.
- **Careers:** `logGame` (wrapped) adds each match to SD's careers under `club:name`; `updateCareers` does nothing in the realm, so the Hardcore ending does not count twice.
## The road and towns (w9-road.js, w9b-town.js): phase 4

Both load after `w8-boot` and change earlier parts only by reassignment (see the header comment in each file for the full list). Their styles are `src/realm/w9.css`, a second `style` line in the manifest.

- **Tiers** stay `W_TIER` / `W_DUNGEON_TIER` (w5): plains 1, outer regions 2, the deep vaults 3. **Level** (0 to 4) is a step inside a tier, on `enc.world.lv` with its reasons on `enc.world.lvWhy`: +1 per 11 tiles beyond the first 4 from Graftonbury (at most +3, not in dungeons), +1 per two cups won, +1 at night off the road. At kickoff (`onHook('fightStart')`) each level gives the other team +8% HP and, from level 2, Strength (`W_ROAD.strAt`). It never touches `atkDmg`; the numbers show as HP and a Strength status, and the pre-game card and fight log say why. `startMatch` takes `lv` and `ambush` to force them.
- **Ambush:** a night off-road wild match is one half the time (`enc.world.ambush`). The other team opens a score ahead (Sudden Death's Hot start), or, in sports with no score unit (golf, bowling, boxing), starts with 1 Strength each. Shown on the pre-game card.
- **Wild teams** wear their region's colours (`W_WILD_TEAM`), and lean to the region's own kinds (`DB.regions[r].kinds`) when the act's encounter tables have them (`rollEncounter`, reassigned for the realm).
- **SD acts in the realm (the phase 2 issue):** Sudden Death's season goals are off in the realm (`checkGoals` returns `[]` when `WG` is set): they are per act, and an act here is only a tier. The easy encounter pool is used for the first two wins in each tier, counted in `WG.tierFights[tier]` instead of `RUN.actFights`. Realm goals can replace season goals later.
- **Energy for wins:** every realm win adds `tier` (+1 for an elite) energy of the region's element (a dungeon's own element) to `WG.energy` (`onHook('fightWon')`).
- **Road events** (`DB.events`, w1): rolled from the encounter hook on world steps that rolled no match, at TC's rate (1.8%). `WG.event = { id, done, rival? }` is the open card (it reopens after a reload). Choices pay effects (`wApplyEffects`) or start a match with `world.kind: 'event'`; `W_ON_END.event` pays a won event match. `wRoadEvent(id)` forces one; `wEventChoose(i, { roll })` forces a gamble.
- **Meals** (`DB.meals`, `DB.recipes`, `DB.innMenu`, w1): `WG.pantry = { mealId: n }`, snacks are items in `WG.items`; `WG.meal` (one meal) and `WG.charm` (a fortune) act at the next realm kickoff, then clear. `wOpenMeals(innId | null)` is the menu and hearth; camp can call it with `null`.
- **Enchanter** (`DB.enchanter`, w1): `wOpenEnchanter()`, `wEnchant(service, card)`; `WG.enchUsed[service]` counts uses, so prices climb.
- **Card vendors** (`DB.cardShops`, w1): `wOpenCardShop(charId)`; stock is `WG.cardShops[charId] = { week, cards: [{ id, price, sold }], removed }` and turns over when `wWeek()` changes. Prices are Sudden Death's `PRICE`; trading a card away is `RUN.removeCost`.
- **Talk acts** added: `enchant` (Quill), `kitchen` (Tansy), `meals` (every innkeeper), `cards` (the three vendors).

## Dungeons and magic gear (w10-dungeon.js): phase 5

Loads after `w9b-town` and changes earlier parts only by reassignment; saved originals are named `wW10…`. All the numbers are in four tables at the top of the file: `W_DUNGEON` (depth levels, perk and stakes odds, room gear odds), `W_GATE`, `W_ALPHA_BOSS` and `W_MAGIC`. `W_FAMOUS` names each dungeon's teams.

- **Rooms.** `wDungeonRooms(id)` lists a dungeon's famous-team rooms, `{ dg, d, n, x, y, w, h, cx, cy, flag, team }`, from `MAPS[id].rooms` (deterministic), shallowest first by walking distance from the stairs, skipping the stairs room and the alpha's room. One room per `W_FAMOUS[id]` entry (3 or 4). They are cached in `W10.rooms` and never saved. `wRoomAt(id, x, y)` and `wRoomsLeft(id)` read them.
- **Room matches.** Walking into a room from outside (`wTryMove`, wrapped) calls `wStartRoom(R, o?)`. It plays an elite match with an `ELITE_TRAITS` trait (no Rattled after the first room), and a depth level (`wLevelInfo`, wrapped, says "room N, deeper down"). Deeper rooms are more likely to force a `SPORT_PERKS` perk (`world.perk`, applied in `onHook('fightStart')` when SD's own roll gave none) and `STAKES`. `o` = `{ card: false, perk, stakes, trait }` forces them for tests. The world context is `world.kind: 'room'`, `ref: { dg, room }` (1-based), plus `fam` (the team's colours, used by `wMatchTeam`, wrapped), `room`, `rooms` and `dgName`. The step into a room never rolls a wild match (`wEncounterHook`, wrapped).
- **Flags.** A won room sets `room_<dungeon>_<n>` (`W_ON_END.room`), and the room stays beaten. Alphas still use `alpha_<id>`, chests `chest_<id>`.
- **Bosses.** `wStartAlpha` (wrapped) plays each alpha as the Sudden Death boss in `W_ALPHA_BOSS`, with `type: 'boss'`, the boss's escort and its tier:

  | Alpha | Where | Boss | Tier |
  |---|---|---|---|
  | the Hatch-Mother | The Drowned Hatchery | `cube` | 2 |
  | the Warren Queen | Emberdeep Warren | `kqueen` | 2 |
  | Specimen Nought | The Gene Vault | `mirror` | 3 |
  | the Seam Wyrm | The Deep Seam | `wyrm` | 3 |
  | the Elder of the Grove | Elder Grove (lair) | `groundskeeper` | 2 |
  | the Aurora Matriarch | Aurora Roost (lair) | `banshee` | 2 |

  `wNameLead` (wrapped) gives the boss enemy the alpha's name. A dungeon's alpha only plays once every room is beaten (`W_DUNGEON.alphaNeedsRooms`). SD's boss reward (a boss trophy pick) applies as usual, and the reward panel's Continue (`advanceAct`, already reassigned in w5) goes back to the world.
- **Gates.** `wGateCheck(locId)` returns `{ ok, need, text }` from `W_GATE`: cups won (`wCupsWon()`, w9; phase 6 sets the `cup_*` flags) and/or a key item. `wStepEnter` (wrapped) refuses a shut dungeon door and logs what is missing, and logs a line about the rooms on the way in. Lairs check the same table before their match. The table: Hatchery and Emberdeep 1 cup, the Gene Vault 2 cups and the keycard, the Deep Seam 3 cups (it is also hidden), Elder Grove none, Aurora Roost 1 cup.
- **Magic gear.** `wMagicDrop({ relic?, gear?, legend? }, why)` pays a Sudden Death trophy of that rarity (`relicPool`, then `gainRelic`), gear cards (`gr_*`, leaning to the region's sports, through `wGainCard`) and a pick of N Hall of Fame legends (`wGainCard({ pick, pool })`). The prize chests carry `magic: '<chest id>'` (set at load from `W_MAGIC`), and `wGiveLoot` (wrapped) pays it after the usual loot. A lair's win pays `W_MAGIC[alphaId]` (`W_ON_END.lair`, wrapped). A won room drops one gear card `W_DUNGEON.roomGear` of the time.

  | Source | Trophy | Gear | Legends |
  |---|---|---|---|
  | Hatchery and Emberdeep prizes | uncommon | 1 | none |
  | Gene Vault and Deep Seam prizes | rare | 1 | pick of 3 |
  | Elder Grove win | uncommon | none | pick of 3 |
  | Aurora Roost win | rare | 1 | pick of 3 |
  | A won room | none | 1 (35%) | none |

- **Help:** `renderHelp` (wrapped as `wW10RenderHelp`) adds `#wHelp5` inside `#wHelp`.
- **Skipped:** the Frozen Chapel bell companion (striking the bell still only logs) and TC's stray event. Both are still open.
- **Test:** `test/realm_dungeon.py`. `test/realm_match.py` now flags the Hatchery's rooms before its alpha, and expects a boss.
