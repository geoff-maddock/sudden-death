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
- **Tiers:** `W_TIER` by region (plains 1, the outer regions 2) and `W_DUNGEON_TIER` by dungeon (Hatchery and Emberdeep 2, Sealed Vault and Deep Seam 3).
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
  | Captain Nought | The Sealed Vault | `mirror` | 3 |
  | the Seam Wyrm | The Deep Seam | `wyrm` | 3 |
  | the Elder of the Grove | Elder Grove (lair) | `groundskeeper` | 2 |
  | the Aurora Matriarch | Aurora Roost (lair) | `banshee` | 2 |

  `wNameLead` (wrapped) gives the boss enemy the alpha's name. A dungeon's alpha only plays once every room is beaten (`W_DUNGEON.alphaNeedsRooms`). SD's boss reward (a boss trophy pick) applies as usual, and the reward panel's Continue (`advanceAct`, already reassigned in w5) goes back to the world.
- **Gates.** `wGateCheck(locId)` returns `{ ok, need, text }` from `W_GATE`: cups won (`wCupsWon()`, w9; phase 6 sets the `cup_*` flags) and/or a key item. `wStepEnter` (wrapped) refuses a shut dungeon door and logs what is missing, and logs a line about the rooms on the way in. Lairs check the same table before their match. The table: Hatchery and Emberdeep 1 cup, the Sealed Vault 2 cups and the keycard, the Deep Seam 3 cups (it is also hidden), Elder Grove none, Aurora Roost 1 cup.
- **Magic gear.** `wMagicDrop({ relic?, gear?, legend? }, why)` pays a Sudden Death trophy of that rarity (`relicPool`, then `gainRelic`), gear cards (`gr_*`, leaning to the region's sports, through `wGainCard`) and a pick of N Hall of Fame legends (`wGainCard({ pick, pool })`). The prize chests carry `magic: '<chest id>'` (set at load from `W_MAGIC`), and `wGiveLoot` (wrapped) pays it after the usual loot. A lair's win pays `W_MAGIC[alphaId]` (`W_ON_END.lair`, wrapped). A won room drops one gear card `W_DUNGEON.roomGear` of the time.

  | Source | Trophy | Gear | Legends |
  |---|---|---|---|
  | Hatchery and Emberdeep prizes | uncommon | 1 | none |
  | Sealed Vault and Deep Seam prizes | rare | 1 | pick of 3 |
  | Elder Grove win | uncommon | none | pick of 3 |
  | Aurora Roost win | rare | 1 | pick of 3 |
  | A won room | none | 1 (35%) | none |

- **Help:** `renderHelp` (wrapped as `wW10RenderHelp`) adds `#wHelp5` inside `#wHelp`.
- **Skipped:** the Frozen Chapel bell companion (striking the bell still only logs) and TC's stray event. Both are still open.
- **Test:** `test/realm_dungeon.py`. `test/realm_match.py` now flags the Hatchery's rooms before its alpha, and expects a boss.

## Cups, rivals and the Crown (w11-cups.js): phase 6

`w11-cups.js` loads after `w9b-town.js` and changes earlier parts only by reassignment (saved originals carry the `wW11` prefix). Its numbers are in `W_CUP` at the top of the file.

- **Town cups** (`DB.cups.moss|salt|cind|rime`): entered with each town's registrar (topic ENTER, act `cup:<id>`) for `W_CUP.fee` gold. Three rounds in order, in the cup region's sports (`DB.regions[cup.elem].sports`):
  1. `normal`, against the local side (`rounds[0].who`);
  2. `elite` with a random `ELITE_TRAITS` trait, against the named seed (`rounds[2].who`);
  3. `rival`, against the cup's rival club: `WG.rivals[W_CUP.home[cup]]`, in the club's colours, led by its captain.
  - Tier is `W_CUP.tier[cups already won]` (2, 2, 2, then 3 for the fourth cup). Level is `W_CUP.lv[round] + floor(cups × W_CUP.lvPerCup)`, capped at `W_ROAD.maxLv`. Both are passed to `startMatch`, so distance and night do not add to cup levels.
  - A loss knocks you out (`WG.cup = null`), and you may pay and enter again at once. Not yet on the pre-game card keeps your place; ENTER again resumes the round. A win sets `WG.cup.ready`, and the next round's card opens when the world is free (`wNextPrompt`, after level-ups and recruits).
  - Winning sets the flag `cup.flag` (`cup_moss` …) and `cups1`..`cupsN` for N = `wCupsWon()`, records `WG.cupLog[id] = { year, day }`, and pays `W_CUP.prize` (gold, fans, a pick of rare cards). The wall (`wWallText`) lists the cups with their year.
- **State:** `WG.cup = { id, round, ready?, clubs?, year? }` (the cup you are in), `WG.cupLog`, `WG.h2h`, `WG.crownYear`, `WG.crowns` (years won). All plain JSON in the save.
- **Matches:** `world.kind: 'cup'`, `ref: { cup, round, club }` (`club` is an SD club id, `'apex'` for the Crown final, or null). `W_ON_END.cup` advances, knocks out, or awards the cup.
- **Head to head:** `WG.h2h[clubId | 'apex'] = { w, l, last: { r: 'win'|'lose', us, them, sport, day } }`; the score comes from the last `RUN.games` entry. It is kept for cup matches against a club and for the road's `rival` event (`W_ON_END.event` is wrapped). It shows on the pre-game card (`wH2hLast`: "They remember last time: you won, 3–1 (Hockey). Head to head: 2–1.") and on the Camp's team tab, with the cups held. The road's rival event now draws its club from `WG.rivals` (`wOpenEvent` wrapped).
- **The Crown** (`DB.cups.crown`, renamed "The Crown" at load; the steward's topic ENTER, act `cup:crown`): only when `wChampWeek()` and `wCupsWon() === 4`, once per year (`WG.crownYear`), no fee. Tier 3, levels `W_CUP.crown.lv`, sports drawn from every region.
  - Rounds: the two rival clubs with the best record against you (`wCrownClubs`, fixed at entry in `WG.cup.clubs`), then the final: `type: 'boss'` at SD act 3 (`ENCOUNTERS[2].boss`, through `bossId`), in Apex Athletic colours.
  - Winning sets `champion`, pays `W_CUP.crown.prize`, and shows the champion ending: SD's `showEnd('win')`, retitled "Champions of the realm", with **Keep exploring** (back to the world, save intact) and Back to the title. `recordRun` is not called, so the save is not cleared. Level-up prompts wait until Keep exploring.
- **WAIT** (act `waitweek`) is refused without four cups, and saves after waiting.
- **Functions:** `wCupEnter(id, { card? })`, `wCupPlay({ card? })`, `wCupProblem(id)` ('' or why not), `wCupMatch(id, round)` (the `startMatch` options), `wCupWho`, `wCupThe`, `wCupWithdraw`, `wCrownClubs`, `wCrownEnding`, `wH2hRecord(club, r)`, `wH2hLast(club)`.
- **Wrapped:** `wRunAct` (`cup:*`, `waitweek`), `wPreGame` (round line and the rival's memory), `wMatchTitle`, `wMatchTeam` (club, town and Apex colours), `wOpenEvent`, `wWallText`, `wCampTeam`, `wNextPrompt`, `wReturnToWorld` (the ending), and SD's `renderHelp` (a "Cups, rivals and the Crown" section, `#wHelpCups`). `W_ON_END.cup` is new and `W_ON_END.event` is wrapped, both by assignment. The rival handler's and the registrars' CUP text is rewritten at load.
- **Test:** `test/realm_cups.py`.

## Balance (w12-renown.js, test/realm_lab.js): phase 7

`w12-renown.js` loads after `w11-cups.js` and changes earlier parts only by reassignment (saved originals carry the `wW12` prefix). See `BALANCE.md` for the measurements behind every number.

- **Renown** (`W_RENOWN`, `wRenown()`) = cups won + `alpha_*` flags. A `fightStart` hook gives every realm team `+hpPer × renown` HP and `floor(renown / strEvery)` Strength. It runs after the level hook from `w9-road.js`, so the two stack. It sets `B.wRenown` and logs a line, and the `wPreGame` wrapper adds a `.wrenown` line to the card.
- **Trophies:** `combatRewards` is wrapped so that a realm elite or rival win pays no `relic`. Boss picks, strongboxes (`W_MAGIC`) and lairs still pay.
- **Elsewhere:**
  - `W_CUP.tier` is `[1, 2, 3, 3]` (`w11-cups.js`);
  - `wXpNeed` is `10 + 10·lvl + 2·lvl²` (`w6-party.js`).
- **The bot:**
  - `test/realm_lab.js` defines `window.REALMLAB(opts)`. It replaces `beginFight` with a model-only start and `renderPanel` with a no-op, then plays the route through the realm's own functions. It returns a log with matches, stages and a result (`champion`, `stuck` or `dead`).
  - `test/realm_lab.py N [opts] [js]` prints the report.
  - `test/realm_bot.py` is the quick-suite check.

## Phase 8: feel (w13-feel.js)

`w13-feel.js` loads after `w12-renown.js` and changes earlier parts only by reassignment (saved originals carry the `wW13` prefix) and by adding entries to Sudden Death's tables (`THEMES`, `SCALES`, `TIPS`, `ACH`). The numbers it owns are in `W_BAG` at the top of the file.

- **Music.** Eight realm themes in `THEMES`, in Sudden Death's theme format, played by SD's sequencer. `SCALES.ionian` and `SCALES.lydian` are added for them.

  | Theme | Where | Sound |
  |---|---|---|
  | `w_plains` | Charter Plains | G ionian, 100 bpm, triangle lead: a walking tune |
  | `w_bloom` | Mosswold | D dorian, 88 bpm, sine bells, shaker hats |
  | `w_tide` | Brinefen | G aeolian, 72 bpm, wavering triangle over sine pads |
  | `w_ember` | Cindermaw | D phrygian, 132 bpm, heavy sawtooth, driving bass |
  | `w_rime` | Frostspire | A lydian, 96 bpm, high bells, sleigh-bell hats |
  | `w_town` | every town | C mixolydian, 118 bpm, square organ, oom-pah bass |
  | `w_dungeon` | dungeons and dungeon rooms | E harmonic minor, 78 bpm, heavy, sparse |
  | `w_night` | off the road at night | A aeolian, 70 bpm, quiet bells |

  `musicWanted` is reassigned. In the world view (and the reward panel) it returns `[wMusicHere(), 'calm']`. In a realm match it returns `wMusicMatch(world)` with SD's fight/hype mode: the match's region theme, or `w_dungeon` for a match on a dungeon map. Cups play their region's theme; the Crown's rounds play the plains theme. Bosses (alphas and the Crown final) keep SD's act theme. `MUS.want` records the theme asked for. SD's `musicSet` already does nothing in `LAB`.
- **Tips.** `TIPS.w_walk`, `w_wild`, `w_blackout`, `w_level`, `w_recruit`, `w_cup`, `w_door`, `w_renown`, `w_champ`, `w_night` and `w_bag`, shown once per profile through SD's `tip(id)`. `wFeelTips()` runs every 700 ms (like SD's coach watcher) and reads the state. `w_door` comes from `wGateCheck` (wrapped) and `w_level` from `wGiveXp` (wrapped). `tip()` refuses in `LAB`; realm tests mark every tip seen (`NOTIPS`).
- **Achievements.** Pushed onto `ACH`:

  | id | Name | Stat | Ladder |
  |---|---|---|---|
  | `w_cups` | Silverware | `realmCups` (regional cups won) | 1, 4, 12 |
  | `w_alphas` | Alpha Hunter | `realmAlphas` (new `alpha_*` flags) | 1, 6, 15 |
  | `w_crown` | Wear the Crown | `realmCrowns` | 1, 3, 10 |
  | `w_iron` | Iron Crown | `realmHardCrowns` (the Crown on Hardcore) | 1, 2, 5 |
  | `w_scout` | Talent Scout | `realmRecruits` (`wAddPlayer`, not founders) | 3, 10, 30 |
  | `w_renown` | Household Name | `realmRenown` (best `wRenown()` reached) | 3, 6, 10 |
  | `w_regions` | Cartographer | `realmRegions` (a set, counted as you walk) | 2, 4, 5 |
  | `w_feet` | Back on Your Feet | `realmBlackouts` | 1, 5, 20 |

  Counted from `wCupWon`, `wDispatchEnd` and `wAddPlayer` (all wrapped). `achAdd`/`achSet` do nothing in `LAB`.
- **Records.** `wRecordCrown()` writes the same entry `recordRun` would (`result: 'win'`) plus `realm: { kind: 'crown', year, day, days, cups, alphas, crowns, hardcore, place }`. It never sets `RUN.over` and never calls `clearRun`, so the journey and its save carry on. It is called from the `wCupWon` wrapper on the Crown. `recordRun` is wrapped so a Hardcore loss is tagged with `realm` too. `renderRecords` is wrapped to show realm rows as "Champions of the realm" and "The realm: year Y, day D. N cups, M alphas".
- **The bag.** `W_BAG` = `{ salve: { heal: .3, min: 10 }, ration: { heal: .15, min: 120 } }`. `wUseItem(id)` returns '' or why not: never during a match, not with none, not at full health. It heals `ceil(maxhp × heal)`, passes the time and saves. The Team screen gets a **Bag** tab (`wOpenCamp` and `wRenderCamp` wrapped). `DB.items.ration` is renamed Trail Ration, and both items' `desc`/`use` text is rewritten from `W_BAG` at load. Shop prices are unchanged (salve 30, or 28 in Rimewatch; ration 12). The bot does not use them.
- **Help:** `renderHelp` (wrapped as `wW13RenderHelp`) adds `#wHelpFeel` inside `#wHelp`: the bag table, music and medals.
- **Test:** `test/realm_feel.py`.

## Epic 2, phase 1: the home ground (w14-ground.js)

`w14-ground.js` loads after `w13-feel.js` and changes earlier parts only by reassignment (saved originals carry the `wW14` prefix), one `fightStart` hook, and a `ground` topic added to the five innkeepers. The numbers are in `W_GROUND`.

- **State.** `WG.ground = { town, parts: { stands, pitch, kitchen, scouts }, drill: { week, n } }`, or absent. Plain JSON. One per journey.
- **Buying.** `wBuyGround(town)` for `W_GROUND.price` (150) in any of the five inn towns (`W_GROUND.inns`). From the inn panel (**The ground (for sale)** / **Your ground**, `wOpenInn` wrapped) or the GROUND topic (`act: 'ground'`, `wRunAct` wrapped). `wOpenGround(town)` is the screen.
- **Home.** `wHomeRegion()` is the ground town's region. `wIsHome(world)` is true for a match whose `world.region` is home, except the Crown (`kind: 'cup'`, `ref.cup === 'crown'`), which is neutral ground. At kickoff a home match sets `B.wHome` and, with the stands built, adds `W_GROUND.block` (6) Block, and at level 2 1 Strength. The pre-game card (`wPreGame` wrapped) adds a `.wground` line.
- **Upgrades.** `wUpgradeGround(part)`, two levels each:

  | Part | Costs | Does |
  |---|---|---|
  | `stands` | 100, 200 | 6 Block at kickoff in home matches; then 1 Strength too |
  | `pitch` | 120, 240 | 1, then 2, free Practice ★ drills a week (`wDrill(card)`, `wDrillsLeft()`) |
  | `kitchen` | 80, 160 | waking at the ground packs a hash; then also the town inn's best dish (never more than 2 of a dish) |
  | `scouts` | 100, 200 | the ground town's free agents (`wTavern` wrapped, on a new week) are 1, then 2, levels higher, with at least 2, then 3, of them |

- **Beds.** `wSleepGround()`: a free night (`wSleepInn(0)`), so the ground's town becomes where you wake after a blackout, then the kitchen's breakfast.
- **Tip, achievement, help.** `TIPS.w_ground` (in a town with an inn and 200 gold, before you own a ground; its own watcher, since `wFeelTips` is passed to `setInterval` by reference). `ACH` `w_ground` Home Ground, stat `realmGroundWork` (each buy or upgrade), 1, 5, 9. `#wHelpGround` in How to play.
- **Bot.** `test/realm_lab.js` buys a ground at the first cup or dungeon stop with 250 gold to spare, then once a stage goes home to build (keeping 150 back), drill, sign the home inn's agents, and sleep. Options: `ground: false`, `groundAt`, `groundSpare`, `groundOrder`, `groundTavern: false`. See `BALANCE.md`.
- **Test:** `test/realm_ground.py`.

## Ways in and out (test/realm_ways.py)

- **Towns.** `buildTown` keeps each building's rectangle on `map.blds` and calls `wSettleSpawn(map)`: a way in that lands inside a building (Saltmere's did) moves to the nearest open tile, a street first. `wAudit` checks no town's way in is inside a building.
- **Waking.** `wInnSpot` picks the tile nearest the innkeeper that is reachable from the town's way in (`bfsReach`), so you wake in front of the counter, not behind it. `wAudit` checks every inn.
- **Counters.** In a town, if you stand somewhere cut off from the way in, walking into a counter climbs over it (`wTryMove`). From the customer side a counter still stops you.
- **The menu.** A **Menu** button in the world HUD (`w7b-camp.js`), Esc (when no talk panel is open) and P open Sudden Death's pause screen, `wOpenMenu()`. In the world its **Save and quit to title** saves and clears `WG`, `RUN` and `B` (`openPause` wrapped in `w5-bridge.js`); Continue on the title resumes in the same place.

## Camping out (w15-camp.js)

`w15-camp.js` loads after `w14-ground.js` and changes earlier parts only by reassignment (`wW15` prefix), one `fightStart` hook and `W_ON_END.camp`. The numbers are in `W_CAMP`.

- **Where.** `wCanCamp()` returns '' or why not. Only on the world map (not a town: "sleep at the inn"; not a dungeon), never during a match, and only with a Trail Ration (`W_CAMP.item`).
- **A night out.** `wMakeCamp(roll?)` uses one ration. Risk: `wCampRisk()` is `W_CAMP.risk` (.33) on a tile where wild teams roam, off the road, and `W_CAMP.riskOpen` (.2) on the road or open ground. A quiet night: sleep until 7 (`W_CAMP.wakeAt`), heal `ceil(maxhp × .5)`, wild-team grace as after a match.
- **Caught asleep.** The clock goes to 2 (`W_CAMP.attackAt`), you heal a quarter, and a wild match starts with no pre-game card (`card: false`): `world: { kind: 'camp', ref: { heal: .25 } }`, `ambush: true` (they start a score ahead, `w9-road.js`), night-level rules, and the kickoff hook makes your team Weak 1 (`B.wCamp`). `W_ON_END.camp` on a win sleeps until 7 and heals the other quarter. A loss is an ordinary blackout.
- **UI.** A Make camp row at the top of the Bag tab (`wRenderCamp` wrapped), with the risk where you stand. `#wHelpCampOut`, a paragraph in `#wHelpFeel`.
- **Bot.** The balance bot does not camp (it rests at inns), so camping is not measured.
- **Test:** `test/realm_camp.py`.

## Player stats (w16-stats.js)

`w16-stats.js` loads after `w15-camp.js` and changes earlier parts only by reassignment (`wW16` prefix).

- **The data.** `WG.pstats[pid]` is `{ g, w, c, d, b, k, p, mvp, best, sp: { sport: { g, w, p } } }` for this journey: games started, wins (not blacked out), cards, damage, Block, kills, points, player of the game, best single-game damage, and a record per sport. Sudden Death credits a match by kind (`B.ps[kind]`); only one player of a kind starts, so the `logGame` wrapper credits each starter and tags the game record with `g.wp = { kind: pid }`. Benched players add nothing. Released players keep their line.
- **Older saves.** `wEnsureStats()` rebuilds the lines from `RUN.games` the first time they are needed: a tagged game knows who started; an untagged one credits each kind's numbers to the first player of that kind.
- **Career.** The Career view reads Sudden Death's careers (`wCareer(p)`, keyed `club:name`), which keep no wins.
- **UI.** A Stats tab after Deck (`wOpenCamp`/`wRenderCamp` wrapped), sortable by any column, with a page per player (`WSTAT.pid`): their record by sport and last `W_STATS.recent` games. Each lineup row gets a Stats button (`wOpenStats(pid)`). `#wHelpStats`, a paragraph in `#wHelpTeam`.
- **Next.** These lines are what a later tournament (baseball through Brimstone Diamond, issue to come) can read for form and selection.
- **Test:** `test/realm_stats.py`.

## Personal quests and bonds (w17-bonds.js)

`w17-bonds.js` loads after `w16-stats.js` and changes earlier parts only by reassignment (`wW17` prefix). Epic #3, phase 2.

- **Hometowns.** `p.home` is a town id (a key of `W_GROUND.inns`): a free agent's is the town they were signed in, anyone else's a town whose region their kind lives in (`wEnsureHome`, set lazily, so older saves get one).
- **Talking to a player.** Talk ids `p:<pid>`: `wChar` and `wSay` are wrapped, so the talk panel works unchanged (`wTalkPlayer(pid)` opens it from the Team screen; `wRenderTalk` swaps in the player's own portrait). Words: JOB, HOME, and YES while a quest is offered.
- **Quests.** `p.pq = { t, sport?, n, need, st }`. HOME from level `W_BOND.questLvl` (2) makes one up (`wQuestOffer`, `st: 'offer'`); YES takes it on (`wQuestAccept`, `'go'`). Kinds (`W_PQ`): `home` (a win in their hometown's region), `mvp` (player of the game in 2 wins), `sport` (2 wins in their region's first sport), `big` (an elite, rival or boss win). Only wins with them starting count (`wQuestTick`, from the `wDispatchEnd` wrapper). Done, `st: 'home'`: HOME while you are in their town (`wQuestTurnIn`) sets `p.nick` and gives `hof_<kind>` upgraded, tagged to them. `p.n` never changes (careers are keyed by it); show names with `wNameOf(p)`.
- **Chemistry.** `WG.bonds['a-b']` (lower id first) `= { n, combo }`: each pair of starters gets 2 for a win, 1 for a loss (`wBondTick`). Good at `W_BOND.good` (4), strong at `W_BOND.strong` (12): while the team holds fewer than `W_BOND.maxCombos` (2) counting offers waiting (`wComboRoom`), a `{ t: 'bond', a, b }` prompt offers a pick of three of `W_COMBOS`; a strong pair that waited picks after its next match together once a place opens. Combo cards are `wb_*`, rarity `'b'`, which no pool rolls. The card taken gets `c.wb = [a, b]` and no `wp`; `wBenchCards`, `wNextMatchDeck` and `wLeagueCards` keep it out unless both start (`wComboOn`). `wRelease` drops the pair's combo cards and chemistry.
- **Offers after a blackout.** `wBlackout` (w5) now shows a pending card offer again when you get up: before, a level-up pick from a lost match opened under the Blackout box and was lost until a reload. `wShowCardOffer` re-adds the pair's or the level-up banner.
- **UI.** On the Lineup tab: a Talk button on each row (marked when they have something to say), the quest line, nicknames, and a Chemistry list of the starting pairs (and any good pair). Combo cards get their own section on the Deck tab. `#wHelpBonds` in `#wHelpTeam`.
- **Bot.** `test/realm_lab.js` takes every quest on when offered and turns it in when the route passes the player's hometown; combo cards are picked at random. `{"quests": false}` turns quests off.
- **Test:** `test/realm_bonds.py`.

## The league and rivals who act (w18-league.js)

`w18-league.js` loads after `w17-bonds.js` and changes earlier parts only by reassignment (`wW18` prefix). Epic #3, phase 3.

- **The league.** `WG.league = { str, table, me, results, poached }`. Clubs: the distinct rival clubs in `WG.rivals` and `'apex'` (`wLeagueClubs`). Strength per club is rolled once (`W_LEAGUE.str`, Apex `apexStr`). The `wNewDay` wrapper plays a round every `W_LEAGUE.every` days (`wLeagueRound`: shuffle, pair; one sits out): the stronger club wins `str_a / (str_a + str_b)` of the time, with a score where the sport has a unit (`SPORT_UNIT`). The last `keep` results are posted. Your row (`me`) counts cup games and games against rival clubs (the `W_ON_END.cup` and `W_ON_END.event` wrappers). Rows sort by points (2 a win), then fewer losses.
- **The inns.** Each tavern innkeeper answers TABLE (act `'league'`, `wOpenLeague`), mentions it in their greeting, and the room menu gets a League table button (`wOpenInn` wrapped).
- **Bids.** After a win against a rival club, when the head to head has `W_LEAGUE.bidEvery` (2) more wins than at their last bid (`poached[club]`) and there is no grudge, a `{ t: 'bid', club, pid }` prompt bids for your best bench player at `W_LEAGUE.fee(lvl)`. Sell (`wBidSell`: `wRelease`, plus the fee) or refuse (`wBidRefuse`: `WG.grudge = { club, day: tomorrow, n }`). Closing the box counts as refusing. The bot refuses (`W_LEAGUE.labSell` to sell).
- **Grudges.** The `wEncounterHook` wrapper: on the world map, no event open, no grace, from `WG.grudge.day`, a `W_LEAGUE.grudgeP` chance a step of `wGrudgeMatch()`: a `'rival'` match, one level up, `world: { kind: 'event', ref: { rival, grudge: 1 } }`, so the event rival's colours, head to head and memory line all apply. Either result ends the grudge; a win pays `W_LEAGUE.grudgeWin`.
- **Taunts.** `wCupEnter` wrapped: entering a town cup whose rival (`wCupRival`) won your last meeting logs the captain's taunt and sets `WG.cup.revenge` and `WG.cup.taunt` (through `wCupPlay`, once the cup exists). Round 3 won against them pays `W_LEAGUE.revenge` on top of the prize. The pre-game card shows the taunt (round 1), the revenge (round 3) or the grudge (`.wtaunt`).
- **Help.** `#wHelpLeague` in `#wHelpCups`.
- **Test:** `test/realm_league.py`.
