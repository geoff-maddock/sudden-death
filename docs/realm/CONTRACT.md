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

## The journal (w19-journal.js)

`w19-journal.js` loads after `w18-league.js` and changes earlier parts only by reassignment (`wW19` prefix).

- **State.** `WG.journal = { people, places, wins, words, quests }`. Each record carries a stamp, `{ a: dayAbs, y, d, where }`.
  - `people[id]`: `{ n, at, last, said: { topic: text } }`. `'greet'` holds the hello. Your own players are `p:<pid>`.
  - `places[id]`: `{ at, last }`, keyed by `DB.locs` id. Regions are stored as `'r:<region>'`.
  - `wins`: entries `{ at, where, k, t, opp, sport, score }`, oldest first. The list is capped at `W_JOURNAL.wins`.
  - `words[WORD]`: `{ who, n, at }`, recording who said the word first.
  - `quests[sideplot id]`: the stamp of when that side quest became active.
- **Older saves.** `wJ()` builds a journal on first use from what the save already holds. Its stamps are `{ old: 1 }`, shown as "before this journal".
  - **Places:** from the `seen_` flags, the current map, and lairs whose alpha is beaten.
  - **Victories:** cup titles from `WG.cupLog`, and bosses from the `alpha_` flags.
- **People and words.** The `wSay` wrapper records every answered line.
  - Unanswered words and `name` add nothing.
  - A CAPITALISED word (3+ letters) is learned when some character answers to it, using `wFindTopic`'s rule over `DB.chars`.
  - `W_JOURNAL.plain` lists the words that are never learned: `JOB`, `NAME`, `BYE`, `YES` and `HOME`.
- **Quests.** A side quest goes active when one of its givers says one of its hint's CAPITALISED words, or answers a topic matching one.
  - **Givers:** `wJGivers` takes the `DB.chars` entries whose name appears in the quest's `who`, by full name or by first and last word.
  - **Done:** a quest is done when its flag is set.
  - **Players' quests:** your players' quests (`p.pq`) are listed as well.
- **Places.** These wrappers record places:
  - `wEnterMap`: towns, dungeons, sites, and the region on return to the world;
  - `wAmbient`: the region as you cross it;
  - `wEncounterHook`: a lair, when `info.kind === 'lair'`.
- **Rules.** `wJRules(locId)` writes the Rules box from the game's own tables, so it stays true if a number changes:
  - town cups and the Crown use `DB.cups` and `W_CUP`;
  - dungeons use `DB.dungeons`, `wDungeonRooms`, `W_GATE` and `DB.chests`;
  - lairs use `DB.alphas` and `W_GATE`;
  - the home ground uses `W_GROUND`.
- **Victories.** The `wDispatchEnd` wrapper records only wins:
  - a `cup` round, plus a title when round 3 sets the cup's flag;
  - an `alpha` or `lair` boss;
  - an `event` against a rival club, as either a grudge match or a rival win.
  
  Wild matches are not recorded. Each entry's score comes from the last `RUN.games` entry, through `gameScore`.
- **UI.** `wOpenJournal(tab)` opens the journal. It is reached from the Journal button beside Team (`#wJournalBtn`) or the `J` key.
  - **Tabs:** People, Places, Victories and Quests, each with a count.
  - **Filters:** `WJ.quest`, `WJ.word` and `WJ.q` are combined with AND (`wJPass`).
  - **Keyword links:** a learned CAPITALISED word in the journal links to the keyword filter.
  - **Focus:** closing the journal takes focus off the search box, so the world's keys work again.
- **Help.** `#wHelpJournal`, at the end of `#wHelp`.
- **Test:** `test/realm_journal.py`.

## The diamond (w20-diamond.js and the wBD scope)

Brimstone Diamond runs in `scope wBD src/realm/diamond/manifest.txt src/realm/diamond/exports.js`, after `w19`. Nothing of it is global but `wBD`:

- `wBD.start(opts)` starts a game on the field, skipping its setup menu (`opts` as its `newGame`: `{ mode: 'demo', team, opp, innings, diff }`). `wBD.G` is its game state (`G.phase === 'over'` at a final), and `wBD.simToEnd(quiet)` plays the rest of a game at once.
- `wBD.show()` / `wBD.hide()` show it and park it (`wBD.on`); `showView('diamond')` calls them, through `W_ENGINES`. Inside the scope, its window listeners, frame loop and timers do nothing while it is hidden.
- `wBD.start(opts)` also takes `rules: { key: value }`, Brimstone Diamond's optional rules for that game only. `wBD.resume(snap)` puts a snapshot back on the field; `wBD.sim(opts)` plays a whole game at once, CPU against CPU and silent; `wBD.box()` lists each player who appeared with their box line (`{ side, rid, n, line }`); `wBD.live` is true while a game is on.
- `wBD.onOver` and `wBD.onQuit` are called at a final and when its End game sends it back to its menu; `wBD.onSnap(snap)` at the start of each pitch, with Brimstone Diamond's own snapshot (plain JSON).
- Its final card only shows between games (`.bdlive` on its page), so a card from a game that just ended never covers the next one.
- In the diamond, Esc and P are its own Time out: `openPause` does nothing there.
- `WD` is the game on the field (`{ opts, over, from, ball? }`); a ball game from the world (`ball: true`) is saved in `WG.ball.live`.

## The engines (w19b-engines.js) and the wGF scope

- `W_ENGINES = { id: { api, view, sport } }` lists the engines that play a sport on their own field: `diamond` (`wBD`, baseball). Each speaks the same API: `start`, `sim`, `box`, `show`, `hide`, `pause`, `audio`, `on`, `live`, `onOver`, `onQuit`, `onSnap`.
- `showView(v)` calls `wEnginesShow(v)`: the engine whose `view` is `v` shows, and every other one that is on hides.
- Cinder Gridiron runs in `scope wGF src/realm/gridiron/manifest.txt src/realm/gridiron/exports.js`, after `wBD`. Nothing of it is global but `wGF`, and it joins `W_ENGINES` as `gridiron` (football, view `gridiron`).
- `wGF.start({ teams, mode, seed })` puts a drive on the field: `teams` are two `{ name, short, color, light, kinds: [7] }` (or `roster: [{ n, kind, num, r? }]`); `mode` is `'watch'` (the coaches call both sides) or `'call'` (`wGF.call(play)` calls the offense, `'punt'` on any down or `'fg'` in range too; fourth down waits for your call; the defense is the coaches'). `wGF.phase` is the drive's beat (`call`, `pre`, `live`, `kick`, `post`, `over`), and `onPhase` and `onOver` hear them (`wGF.onPhase` can be read too, so a part can wrap it).
- `wGF.game({ teams, mode, seed })` puts a whole game on the field instead (phase 2); in `'call'` mode `wGF.call(defense)` picks your side's defense when the other side has the ball (`wGF.yourBall`). `wGF.clock()` is `{ half, text, name }` in a game, `wGF.isGame` says which it is, `wGF.setMode(m)` switches who calls it without restarting (`'watch'`, `'call'` or `'play'`: in `'play'` you play your offense by hand, through `wGF.input({ steer: [sx, sy], hold, pick, tap })`; `wGF.hands` says a hands-on play is live and `wGF.meter` is your kick meter), and `wGF.simGame(opts)` plays a game headless: `{ score, teams, drives, plays, half, ends, secs }` (`half` 3 is Sudden Death; `secs` is how long it would take to watch). The game adds `half`, `clock`, `recv` and `drives` to `G`, and a drive can end `clock` when its half runs out.
- The playbook (phase 4): `G.fresh = [{ off: { play: 0..1 }, def: { defense: 0..1 } }, ...]` by side, and `G.seen`, each side's recent calls. `wGF.fresh(side)` and `wGF.tendency(side, 'off' | 'def')` read them for the page; `wGF.cpu.off()` and `wGF.cpu.def()` are the coaches' calls, for the tests.
- Powers (phase 6): `G.mana = [n, n]` (0 to 6), `G.stam = [[0..100 by roster index], ...]`, `G.zones = [{ id, n, side, left }]`, `G.ultUsed = [{ kind: true }, ...]` (once a game per kind) and `G.skill = [0..2, 0..2]`, all plain JSON in the snapshot. `GD.pow` is your pick, `GD.auto` Auto powers, `GD.cast = { off, def }` the play's casts. The page reads `wGF.powers()`, `wGF.tip(key)`, `wGF.zones()`, `wGF.powerBook`, and writes `wGF.pickPower(key)`, `wGF.cyclePower()`, `wGF.setAuto(on)`; `start`, `game` and `simGame` take `skill` and `powers: false`. A play in the log carries `pw: [{ side, n, name, ult }]`; `wGF.lineup()` players carry `stam`, `r` (worn) and `base`.
- `wGF.sim(opts)` plays a whole drive at once, headless and silent: `{ end, plays, yards, score, teams, log }`. `end` is `td`, `fg`, `miss`, `punt`, `downs`, `int` or `safety`.
- `wGF.show()`, `wGF.hide()` and `wGF.on`, as the diamond's. `wGF.plays` and `wGF.defs` name the calls. `wGF.canCall(c)` says whether a call can be made now, `wGF.kick()` is the field-goal try from here (`{ dist, chance, inRange, coach }`), `wGF.lineup()` who is on the field (the drive's offense and the other side's defense, with ratings), `wGF.edge(oc, dc)` the matchup (`[+1|0|-1, why]`), `wGF.why` the last result's reason, and `wGF.highlight({ side, pos })` rings a player. Each entry of `G.drive.plays` carries its `msg` and `why`. `wGF.down`, `snap` and `step` are the tests' handle on one play; a down's result carries `air`, the yards past the line the ball was thrown to (null if nothing was thrown).
- `WGF` (`w42-gridiron.js`) is the drive or game on the field: `{ kind: 'drive' | 'game', mode, over, teams }` (`teams`: the two sides as the engine takes them, yours first). Not saved.

## The ring (w51-ring.js) and the wBX scope

- The Anvil Ring runs in `scope wBX src/realm/ring/manifest.txt src/realm/ring/exports.js`, after `wGF`. Nothing of it is global but `wBX`, and it joins `W_ENGINES` as `ring` (boxing, view `ring`).
- The rules (phase 0): `wBX.newBout()`, `knockdown(side)` (`'kd'`, or `'tko'` on the third), `countOut(side)`, `bell(work)` (`work`: each judge's view of the round, side 0's less side 1's; `'round'` or `'over'`), `roundScore(work, rkd)`, `decision(cards)`, `totals(cards)` and `cardResult(bouts)`; `wBX.rules` is `{ rounds: 3, secs: 40, kd: 3, count: 10, judges: 3, card: 3, must: 10, patches: 2 }`.
- `wBX.start({ fighters: [2 × { n, kind, num, r?, style? }], corners: [2 × { name, short, color, light }], mode: 'watch', seed, skill: [0..2, 0..2] })` puts a bout in the ring (phase 1: CPU against CPU). `G` gains the fighters (`G.F`), `corners`, `skill`, `work`, `rstats`, `plans`, `log` and `secs`, all plain JSON. `wBX.phase` is the beat (`intro`, `round`, `kd`, `rise`, `corner`, `over`); `onPhase` hears each one and `onOver` the end, with the summary.
- `wBX.simBout(opts)` boxes a whole bout headless and silent, and leaves the one in the ring as it was: `{ over, verdict, cards, totals, work, rounds, stats, kd, plans, fighters, secs, log }`. `over` is `{ how: 'ko' | 'tko' | 'dec', win: 0 | 1 | null, kind?, round, kd, pts, totals }`.
- `wBX.show()`, `hide()`, `on`, `pause(on)`, `paused`, `verdict()`, `summary()`. For the page and How to play: `rate(kind)`, `style(kind)`, `kinds`, `stats`, `plans`, `punches`, `judges`. The tests' handles: `step()` (one beat), `act(side, k)`, `clinch(side)`, `land(side, k)`, `range(side, k)`, `dist()`, `count`, `ev` (the ring's events).
- Your corner and your hands (phase 2): `start` takes `mode` (`'watch'`, `'call'` or `'play'`) and `you`. With a corner of your own the bout waits before the first round and between rounds: `wBX.wait` is `{ plan, patch, why }` (what your corner would do; `G.wait`, plain JSON) until `wBX.call(plan)`; `wBX.patch()` has the cut-man work (once a break, while patches last). `wBX.setMode(m)` switches without starting over (to `'watch'` mid-break it takes the advice). In `'play'`, `wBX.input({ steer: [x, y], guard, act })` boxes your fighter (`act`: `'jab'`, `'hook'`, `'body'`, `'slip'`, `'clinch'`); `wBX.inputState`, `wBX.buffer`, `wBX.rawCard` (the live card, not a copy) and `wBX.speed` (steps a frame, 1 to 8) are for the tests. The input is cleared at the bell, a knockdown, a new bout and a change of mode; a press counts only in a round. Headless bouts are always `'watch'`.
- The card (phase 3): `wBX.cardStart({ sides: [2 × { name, short, color, light, fighters }], picks, order, mode, you, seed })` boxes three bouts one after another (`picks`: your fighter for each of their `order`; the corner's, `wBX.cardAuto(mine, theirs)`, when not given). `wBX.card` is a copy of `CD`: `{ sides, pairs, bouts: [{ over, verdict }], i, mode, you, seed, result }`; `wBX.cardNext()` boxes the next bout once one is over, `wBX.cardScore()` is `{ won, done, n }`, and `wBX.simCard(opts)` is a whole card headless (`{ bouts, pairs, result }`). `wBX.start` (a single bout) clears the card. A bout on a card carries `G.card = { i, n }`.
- Powers (phase 4): `start`, `cardStart` and `simBout` take `powers` (false: none; `G.powers`). A fighter carries `fx` (statuses: `[{ id, n, t, from, ...effects }]`), `spUsed` (the round its special was cast) and `ultUsed`. `wBX.powers(side)` is `{ sp, ult, fx }` (each power `{ id, n, desc, ok, why, used }`), `wBX.cast(side, 'sp' | 'ult')` casts (the tests' handle; in play it is `input({ act: 'sp' | 'ult' })`, Q and R), `wBX.powerBook` every kind's powers by name and description, `wBX.powerCost` the stamina, and `wBX.powerData` the full definitions (for the tests). A bout's stats count `pw`, the powers cast. The ring's events add `cast` and `zap` (a power's hit).
- Save points (phase 5): `wBX.wantSnap` and `wBX.onSnap` (setters): at the start of a bout on a card, each corner and between bouts, `onSnap(snapshot)` hears `{ G, BD: { ph, t, mode, you, count, getUp }, CD }` (plain JSON) when `wantSnap()` is true. `wBX.snapshot()` takes one now; `wBX.resume(sn)` puts it back in the ring (fresh random numbers, no input held). `cardStart` takes `skill`; each bout on a card keeps `stats` (both sides' bout lines) and `kd`. `wBX.onOver` can be read, so a part can wrap it.
- Cards from the world (`w53-ringgame.js`): `WG.bxg = { live: null | { world, snap }, met: { club: dayAbs }, opp: { club: { lvl, side } }, cards: [last 10], w, l, t }`, `world = { kind: 'bxcard', ref, club, tier, how, day, name, ids, cup }` (the end dispatches `W_ON_END[kind]`); `WG.bxstats = { pid: { bb, w, l, d, ko, kd, down, landed, thrown, pw } }`; a player's boxing ratings are `p.bx` (`wBxOf(p)`). `wStartRing({ club, how, tier?, kind?, ref?, cup? })` opens the pairing (returns a reason it can't, or ''); `wResumeRing()`, `wRingLeave()`, `wRingConcede()`, `wOpenRingCard()`.
- `WBX` (`w51-ring.js`) is the bout in the ring: `{ over, kinds }`, or `{ over, card: true }` for a card (`w52-ringcard.js`), with `world: true, msg` for a card from the world (`w53-ringgame.js`). Not saved (the card itself is, in `WG.bxg.live`). `wRingBout({ kinds, seed })` starts one; Ma Gristle's BOUT topic runs it.

## Baseball ratings (w20b-ratings.js)

- `p.bd = { pos, hand, wpn, bat, run, field, ult, pitches, pow, con, spd, arm, fld, lv, got }` on every player in `WG.roster` and `WG.wwait`. Plain JSON, saved with the player.
- Seeded by `wBD.rate(kind)`: the kind's player on Brimstone Diamond's two founding clubs (so the kind gives the position; kobolds and witches pitch), each stat moved by up to 1.
- `lv` is the level the ratings have caught up to; `wBdOf(p)` catches them up, a point per level to a stat below 12, weighted by the kind's numbers (`wBD.templ(kind)`). `got` counts those points per stat.
- `wMakePlayer`, `wGiveXp` and `wStart` call it, so recruits, level-ups, founders and older saves are all covered.

## The nine (w20c-nine.js)

- `p.gf = { spd, str, hnd, arm, kck, tkl, lv, got }` on every player (football, `w43-gfseven.js`), 1 to 12, as `p.bd`. Plain JSON, saved with the player.
- `WG.seven = { ids: [7 keys], cu: [call-ups], seq, off: { pos: key }, def: { pos: key }, add?, mine? }`: the football seven, a key being a roster id or a call-up's `cid` (`'g<n>'`). `off` and `def` give every position (`wGF.offPos`, `wGF.defPos`) a different one of the seven. Until `mine` is set (you changed a position), the coaches re-pick the positions whenever the seven changes. `wSevenTeam()` is the seven as `wGF.start` and `wGF.game` take a team. `wGF.auto(roster)` is the coaches' pick for any seven, and a team sent with full `off`/`def` maps keeps them.
- `WG.gfg = { live: null | { world, snap }, met: { club: dayAbs }, opp: { club: { lvl, team } }, games, w, l, t }` (football games, `w44-gfgame.js`); `world = { kind: 'gfgame', ref, club, tier, how, day, name, ids, cup }`, and the end dispatches `W_ON_END[kind]`. `snap` is `wGF.snapshot()`, the game at a call. `WG.gfstats = { pid: summed box lines, gg }`. `wStartGrid({ club, how, tier?, kind?, ref?, cup? })` returns '' or why not.
- `WG.gcup = { week, field, round, games: [[{ a, b, ra, rb, w, ya, yb }]], pending, show, out, done, champ }` (the Cinder Cup, `w46-gfcup.js`), shaped as `WG.dcup`; `WG.gcupWins`, `WG.gcupLog`. Football games carry `world.kind` `'gcup'` or `'gfix'` (a league fixture at the Ash Bowl, `ref = { g, club, day }`), and `wGridSettle` sets `W.yards = [ours, theirs]` before the end dispatches.
- The engine's box: `wGF.box()` is `[{ side, ri, n, kind, line }]`; a line counts `pa pc py ptd pint sacked ra ry rec recy td fum fuml tkl sk ints ff fr fga fgm xpa xpm` (`fum`, `fuml`: fumbles and fumbles lost; `ff`, `fr`: forced and recovered). `wGF.simGame` returns it as `box`. `wGF.onSnap` hears a snapshot at each call, unless `wGF.wantSnap()` says no (the Realm takes them only in a real game); `wGF.resume(snap)` puts it back on the field. `wGF.simGame({ keep: true })` puts the game that was on the field back afterwards, for a game simulated while yours is on.
- The bench: `wGF.bench()` is `{ on, bench, between, item, stam }` for your side (each player `{ ri, n, kind, num, stam, off, def, kicker }`); `wGF.swap(out, inn)` and `wGF.useItem(ri | null, n, name)` return what happened or `''` (only between plays; one item a play); `wGF.notes()` is what waits for the next play's log line (`{ side, k: 'swap' | 'rest', msg }`). A team may send more than seven: the first seven start, and up to `wGF.rules.bench` more sit. `wGF.box()` lines carry `played`.
- Stances: `wGF.stance()` is `{ mine: { off, def }, role, play, used }` (your stances, the side of the ball you're on, both sides' on the play on show as `{ off, def, side }`, and each side's downs by stance); `wGF.setStance(role, id)` (`id` one of `safe bal risky`; not under Coaches), `wGF.cycleStance()`, `wGF.stanceTip(id)` (`{ pro, con, note }`), `wGF.stanceMost(side)`, `wGF.stances` (the rules). Your stances are in `G.stance`, so the snapshot keeps them. A play's log line has `st: [off, def]`. Drives may end `fum` (a fumble lost) or `fumtd` (run back for a touchdown). `wGF.simGame` and `onOver`'s summary carry `stance: [side 0, side 1]` (the stance each used most); `opts.stance` (`[id or null, id or null]`) forces a side's stance for the bot. `wGF.fumRules` is the live fumble rules, for tests (`wary`: the fumble risk at which a Knight or better punts on fourth and short); `wGF.fumRisk(side)` is `{ x, why }`, the back's fumble risk this down against the usual, and `wGF.kick().wary` the coach's reason to be careful, or `''`.
- The view: `wGF.view()` is `{ zoom, why, big, px }`: how far the camera has zoomed in (1 is the whole width), the big play it zoomed for, the banner for the play just ended (`{ k, gain, sub }`, `k` one of `td int fum fumtd first sack safety downs long fg miss`; null once the next drive starts), and `px`, the device pixels per canvas pixel (the field is drawn in a 960 by 600 space; a yard is 19 of those). Read-only; the page only draws it.
- `WG.nine = { order: [{ id, pos }], cu: [call-ups], seq, add? }`. `order` is the batting order; `id` is a roster id (a number) or a call-up's `cid` (`'c<n>'`). Plain JSON, saved with `WG`.
- A call-up is a `wMakePlayer` player (so it has `p.bd`) with `from: 'callup'` and a `cid` in place of an `id`. Call-ups play at `wNineTier()`, the roster's average level rounded down, and catch up when it rises. They are not on the roster and earn nothing.
- `wNineSync()` keeps the nine whole: anyone who left is dropped, a position nobody holds gets a call-up, and players who joined since (`add`, set by the `wAddPlayer` wrapper) take a call-up's place, at their own position first. A player you sat out stays out.
- Only a player with pitches (`p.bd.pitches`) can play P, as in Brimstone Diamond. Out of position a player's FLD is 2 lower in `wNineDef()`.
- `wNineDef()` is the nine as a Brimstone Diamond team (`{ id: 'realm', name, short, color, trim, light, motto, roster, pen }`); each player carries `rid`, their roster id or `cid`. Roster pitchers who sit out are in the pen. Phase 4 plays it.
- Changes go through `wNineMove`, `wNineSetPos`, `wNineSit`, `wNinePutIn` and `wNineAuto`; each returns a message for the player, or `''`.

## Ball games (w20d-ballgame.js)

- **Who can play.** `wBallProblems()` is empty once the roster has `W_BALL.minOwn` (5) players and the nine can take the field. Opponents are the local nine of the region you're in and your rival clubs (`wBallClubs()`); each plays you once a day (`WG.ball.met[club] = dayAbs`).
- **How.** `wStartBall({ club, how, home?, tier?, kind?, ref? })` returns `''` or why not. `how` is `play` (every pitch), `manage` (Auto powers on) or `sim` (`wBD.sim`, settled before it returns). The tier is the region's (`wTierHere()`), +1 against a rival; CPU skill is `W_BALL.diff[tier]`, and the other nine (`wBallOpp`) is at your nine's level + tier − 1, its own kinds first, with `W_BALL.oppBonus[tier]` on every rating (+1 at tier 3; see `BALANCE.md`). A rival's nine is cached in `WG.ball.opp[club]` until it would be a different level.
- **Rules.** `W_BALL.rules`: injuries, magic bats and balls, the pitch clock and brawls off; stealing and the moon and stars on.
- **State.** `WG.ball = { live: null | { world, snap }, met, opp, games: [last 10], w, l }`, plain JSON. `world = { kind: 'ball', ref, club, tier, home, how, day, name }`. `snap` is refreshed at each pitch (`wBD.onSnap`); the save is written at most every 15 seconds and on Save and leave.
- **The end.** `wBallSettle(r, us, them, box, inning)`: box lines for your own players into `WG.bstats[pid]` (call-ups and the other side have no numeric `rid`), XP (`W_BALL.xp × tier` to the nine, half to players sitting out, a quarter for a loss, `mvpXp` to the player of the game), gold and fans for a win, `WG.h2h[club]` with `sport: 'baseball'`, the league table for a rival, `W_BALL.minutes` on the clock, then `W_ON_END[world.kind]`. There is no team HP on the diamond and no blackout.
- **Leaving.** Save and leave keeps `WG.ball.live`; a reload asks once (`wNextPrompt`), and the Nine tab has Resume the game. Concede is a loss. Brimstone Diamond's End game (don't save) calls the game off: no result, and the club can play you again that day.
- **Where.** Play a game on the Nine tab, and Host a ball game (you're the home side) at your home ground. Epic #6 adds ballparks to the world.
- **Stats.** The Stats tab's Baseball view (G, AB, H, HR, RBI, AVG, SB, IP, ERA, K) and a box line on each player's Baseball block.
- **Card picks.** `modal` (wrapped, `wSdModal`) notes a card pick it opens on top of, and that pick comes back once the world is free (`wNextPrompt`), so it never holds up the prompts after it.

## The Diamond Cup (w20e-dcup.js)

- **Entry.** Ask the League clerk about the DIAMOND cup (act `dcup`), or the Diamond Cup button on the Nine tab. `W_DCUP.fee` (40) gold, the ball game rules (5 players of your own), and one cup a week (`wWeek()`), whether you finish it or not.
- **The field.** Eight nines: you first, then up to four rival clubs and the regions' nines (`wild:<region>`), drawn at random. The pairings of each round are the previous round's winners in order, two by two (`wDcupPairs(r)`).
- **Rounds.** `W_DCUP.tiers` = 1, 2, 3 for the quarter-final, semi-final and final: CPU skill Squire, Knight, Archmage, and the other nine one level higher each round. Your game is a ball game (`wStartBall` with `kind: 'dcup'`, `cup: true`, so the once-a-day rule doesn't apply) and pays as one.
- **The rest of the round.** `W_ON_END.dcup` records your result and sets `pending`; `wDcupCatchUp()` simulates the other games (`wBD.sim`, both sides on the CPU) once you're back in the world, never inside the engine's final. Out of the cup, the rest of the bracket is played to a champion.
- **State.** `WG.dcup = { week, field, round, games: [[{ a, b, ra, rb, w }]], pending, show, out, done, champ }`, plain JSON. `WG.dcupWins` and `WG.dcupLog` count the cups won.
- **The prize.** `W_DCUP.prize`: 150 gold, 20 fans, a pick of 3 baseball cards (`wSportPool(['baseball'])`), a journal win and a line on the Wall of Awards. The prize pick shows before the bracket.
- **Tests.** `W_DCUP.force` (`'win'` | `'lose'`) settles your next cup game that way.

## Baseball's feel (w20f-feel.js)

- **Sound.** `musicSet` (wrapped, `wSdMusicSet`) stops Sudden Death's music while `UI.view === 'diamond'`. `showView('diamond')` calls `wBD.audio(SET.music, SET.sfx)`, so the ballpark organ and Brimstone Diamond's sound effects follow your settings. `wBD.sound` reads them back.
- **Tips.** `w_ball` once the roster has `W_BALL.minOwn` players, and `w_dcup` after your first won ball game.
- **Medals.** `w_ball` (Play Ball: `realmBallWins` 1, 10, 30) and `w_dcup` (Diamond Cutter: `realmDcups` 1, 3, 8).
- **Leaving early.** Save and leave before the first pitch has no snapshot to keep, so the game is called off and the club can play you again that day.

## Sports grounds (w21-grounds.js)

- **The grounds.** `W_GRDS`: ten grounds, two per city, one for each sport in its region's `sports` list. Each is a location in `DB.locs` (`kind: 'ground'`, world tile `U`, `map` = its id, plus `city` and `sport`), and its map is a `DB.towns` entry built by `buildTown`, so it behaves like a town: walk off any edge to leave, people wander, ambient lines, no wild matches.
- **Placement.** `buildWorld` (wrapped) builds the world as before, then places each ground at the clear spot nearest `g.at` (`wGrdSpot`: in the city's region, not a road, no well, bush, nest or entrance within 2 tiles), and carves a road from the city gate (`x, y + 1`) to the ground's. Nothing the original world placed moves, so old saves keep their wells and bushes. The ground locations are added to `DB.locs` by the wrapper, after the original build.
- **The map.** 24×18: the field (tile `d`, `m.field = { x, y, w, h, sport, gc }`) drawn whole for its sport by `wGrdArt`, stands (`J`) on three sides, a two-tile scoreboard (`%`, a sign), banners, lamps, a path from the gate, the groundskeeper (`gk_<name>`, fixed) and a fan (`gf_<name>`). `m.grd` is the ground's id.
- **Talk.** Every keeper has `job`, the sport's own keyword (the text of `SPORTS[sport].desc`) and `fixtures`. The Ballpark's keeper also has `game` (act `ball`: `wOpenBallCard`) and `diamond` (act `dcup`).
- **Drawing.** `WGND.d` draws the tile's piece of the field (outside the field rect, the map's own ground); `WPRI.d = 0`, so the field has hard edges. `WOBJ.U` is a bowl of stands round the sport's field colour, or a hall for the indoor sports (bowling, curling, boxing), with the sport's pennant.

## Games at the grounds (w21b-gmatch.js)

- **The squad rule.** `W_GRD_SQUAD[sport]` is how many players of your own a ground needs before it hosts you: golf, jousting, boxing and curling 4; bowling, basketball and baseball 5 (baseball's is `W_BALL.minOwn`); hockey 6; football 7. `wGrdProblems(id)` gives the reasons in sentences (empty when you can play); the Ballpark's are `wBallProblems()`. Wild matches, cups and dungeons need no squad.
- **A game.** Every keeper but the Ballpark's has `game` (act `gmatch`: `wOpenGrdCard`). `wStartGrd(id, mode)` starts a match through `startMatch` with `sport` = the ground's, `world: { kind: 'ground', ref: { g, mode }, region }`. A Friendly (`normal`) is at the region's tier; a Challenge (`elite`, with a scouting trait) is a tier up. `wBuildEncounter` (wrapped) forces `enc.sport` to the ground's sport, whatever enemies are drawn. The other side wears the city club's name (`<City> <Sport> Club`) and the sport's pennant colour (`wMatchTeam`).
- **The end.** `W_ON_END.ground` records the result in `WG.grd = { met: { id: dayAbs }, rec: { id: { w, l, last } } }` (plain JSON), and the ground is used up for the day, win or lose. A loss is a blackout, as on the road. The scoreboard (`%`, `wUse` wrapped) and the journal (`wJRules`) show the record. Rewards are Sudden Death's for the match type; there is no fee. A win also takes the gate (w36-gate.js).

## Bigger cities (w22-cities.js)

- **Layouts.** `W_CITIES[id]` replaces each city's `DB.towns` entry (built by `buildTown` as before): Graftonbury 50×34, Mossgate 42×31, Saltmere 46×34, Cinderhold 42×34, Rimewatch 40×31, about twice the old area (`W_CITY_OLD`). Every building keeper, townsperson, sign and piece of furniture from the old towns is kept, with the same words. New: homes (`wHome`, buildings with no keeper), and districts per city.
- **New tiles.** `1` hedge, `2` fence, `3` flower bed, `4` bench, `5` crates, `7` vegetable patch, `8` goalposts, `9` slag heap, `0` fish rack. All block the way; each has a look and a `WOBJ` painter. Hedges and fences join their neighbours.
- **Old saves.** `WG.cities` is the layout version (`W_CITY_VER`). Continuing an older save drops the five cities' saved townsfolk places (`WG.npc`), and moves you to the nearest open tile you can walk from (`wNearestOpen`) if you were standing in a town.
- **Reach.** `test/realm_cities.py` checks that every person (or their counter), object, door and building floor can be reached from the way in, and that you can walk out by an edge.

## Training spots (w23-spots.js)

- **The spots.** `W_SPOTS`: ten, two per city, one for each sport in its region (the batting cage and the hoop at Graftonbury, the putting green and the tilting yard at Mossgate, skittles and stones at Saltmere, the sparring ring and the kick-about pitch at Cinderhold, pond hockey and the stone maker at Rimewatch). Each is a decor tile `!` with meta `{ spot }` pushed into its city's `W_CITIES` def, and a coach (`tc_<name>`, fixed) beside it. One painter (`WOBJ['!']`) draws the thing for the spot's sport.
- **Use.** Using the tile, or the coach's `drill` or `challenge` (act `spot`), opens `wOpenSpot`. Drill: once a week (`wWeek()`) per spot, a card from `wSpotCards(sport)` (cards whose `sportFits` include the sport, or any `practicable` card if none do) gets `sk = 1`, an hour passes. Challenge: once a week per spot, three answers from `SPORT_BRIEF` (the spot's sport and two others); right pays `W_SPOT.prize`.
- **State.** `WG.spots = { id: { drill: week, quiz: week, right } }`, plain JSON.

## Fixtures (w24-fixtures.js)

- **The draw.** `wFixtures()` returns `WG.league.next = { day, games: [{ a, b, g, done? }] }`, drawn lazily and again after each round: the five clubs (`wLeagueClubs()`) and `'me'` paired off; `a` is the home side, and `g` is one of its city's grounds (`wClubTown`: a rival's cup town, Apex Athletic's Graftonbury). You are always away (`b: 'me'`), and never at the Ballpark.
- **The round.** `wLeagueRound` (wrapped; w18's `wNewDay` calls it every `W_LEAGUE.every` days) plays the drawn clubs' games with `wSimAt(a, b, g)` in the ground's sport (results get `g`), logs your fixture as postponed if it was not played, and draws the next round.
- **Your fixture.** `wStartGrd(id, 'fixture')`: a `rival` match at the region's tier + `W_FIX.tierUp` (+1 more against Apex Athletic), ref `{ g, mode: 'fixture', club, day }`. The squad rule and the one-game-a-day rule hold. `W_ON_END.ground` (wrapped) marks it done and records it in `L.me`, the club's row, `L.results`, `WG.h2h`; a win adds `W_FIX.fans` and may bring a bid (`wMaybeBid`).
- **Words.** `wClubName('me')` is your team. Results read "... at <ground>". The inns' table lists the next round. Keepers' `fixtures` (act `fixtures`) opens the list. The scoreboard shows the last league game at its ground. Fans (`gf_*`) greet you by `wMyPlace()`, and the pre-game card at a ground has a crowd line (`wCrowdLine`).

## Home grounds at the sports grounds (w25-home.js)

- **Buying.** `wBuyGround(where)` takes a ground id or a town (a town buys its first ground, `wGrdsOf(town)[0]`). `WG.ground` keeps `town` (the ground's city: the home region, the kitchen's inn menu and the scouts' inn are keyed on it) and gains `grd`. Keepers have `home` (act `ground`); the innkeepers' `ground` still opens the sale, which lists the city's two grounds (`[data-wbuy]`, the first also `#wBuyGround`).
- **The screen.** `wOpenGround(where)` takes a ground id or a town; owned, it is w14's screen titled `Your ground: <name>`. `wSleepGround` works on the ground's own map too (you still wake at the city's inn). Host a ball game is offered only when the home ground is the Ballpark.
- **Fixtures.** `wDrawRound` (wrapped): with a home ground that is not the Ballpark, every other round (`L.hosted` toggles) your fixture is at home: `{ a: 'me', b: club, g: grd }`. A match there has the home crowd (w14's `wIsHome`, by region).
- **Old saves.** `wStart` (wrapped): a `WG.ground` without `grd` gets its city's first ground, once, with a log line; parts and drills are kept.


## The feel of the grounds (w26-gfeel.js)

- **Music.** `THEMES.wg_<ground id>`, one per ground, in Sudden Death's theme format (`wMel` turns a text melody into steps). `wMusicHere` (wrapped) plays the ground's theme on its map; `wMusicMatch` (wrapped) plays it in a match with `world.kind === 'ground'`. Bosses keep Sudden Death's themes.
- **Tips.** `TIPS.w_grounds`, `w_squad`, `w_fixture` and `w_spot`, from the `wGrdTips` watcher (never in LAB).
- **Medals.** `w_grounds` (Groundhopper, set stat `realmGrounds`: ground ids, from `W_ON_END.ground` and, for the Ballpark, a `wBallSettle` while `WG.map === 'g_ballpark'`), `w_fixtures` (`realmFixWins`, a fixture won), `w_coach` (`realmSpotWins`, a right answer in `wSpotAnswer`).
- **Team kit.** `WG.kit = { own: [ids], on: id }`, plain JSON; `home` is the club's own colours and always owned. `W_KITS` (six to buy at `W_KIT.price`), `wBuyKit(id)` returns '' or why not, and wears a kit you own for free. `clubTeam` (Sudden Death's, now a function declaration so it can be wrapped as `wSdClubTeam`) returns the kit's `color`, `light` and `dark` with the club's `short`. The League shop (`lg_shop`, act `kit`) takes the house at 32,21 in Graftonbury. Old saves without `WG.kit` drop `WG.npc.graftonbury` once (townsfolk places are kept by index).
- **Match days.** `wMatchDayLine(city)`: a poster for tomorrow's league games at the city's grounds (not yours) or today's results there; `wAmbient` (wrapped) logs one now and then in the city and at its grounds.

## Notice boards (w27-notices.js)

- **The boards.** `W_NOTICE_CITY` maps each city to its inn's keeper, who has `notices` (act `board`: `wOpenBoard(city)`); the inn panel has a Notice board button (`#wInnBoard`). `wBoard(city)` posts `W_NOTICE.posted` contracts of different types once a week (`wWeek()`), for the city's region (`W_GRD_REG`).
- **Contracts.** `{ id, city, region, t, sport?, n?, club?, g?, pay: { gold, fans, card }, prog, until? }`. Types: `sport`, `night`, `margin` (`W_NOTICE.margin[sport]`, scoreboard sports only), `club` (`wNoticeClub(region)`: the region's cup rival, Apex Athletic for the Charter Plains), `ground` (a city ground other than the Ballpark), `seeded` (`type === 'elite'`), `count` (`W_NOTICE.count` wins). Pay: `W_NOTICE.gold[t]`, times 1.5 in a tier 2 region; fans two fifths of it; `W_NOTICE.card[t]` adds a pick of 3 from `wSportPool` of the region's sports.
- **Taking.** `wTakeNotice(city, id)` returns '' or why not (at most `W_NOTICE.max`); a taken contract has `until = dayAbs + W_NOTICE.days`. `wDropNotice(id)`. `wNewDay` (wrapped) lapses the ones past `until`.
- **Meeting one.** `wDispatchEnd` (wrapped), on a win: `wNoticeFacts(W)` reads the world context and the last game record (`RUN.games`): `{ region, sport, night, us, them, won, type, club: ref.club || ref.rival, g }`. Every taken contract that `wNoticeMet` pays at once (`count` counts up first). Ball games on the diamond do not count.
- **State.** `WG.notice = { boards: { city: { week, list } }, taken: [contract], done, lapsed }`, plain JSON.

## Tired legs (w28-legs.js)

- **State.** `p.legs` on each roster player (plain number, missing = 0). `wLegsState(p)`: `fresh` below `W_FAT.tired` (3), `tired` below `W_FAT.spent` (5), else `spent`. `wFatCards(p)`: 0, 1 or 2.
- **Kickoff.** A `fightStart` hook splices `wFatCards(p)` Sudden Death `fatigue` cards into `B.draw` for each starter and sets `B.wTired`. `wKickoff` (wrapped) then moves the legs: starters +1 (at most `W_FAT.max`), bench −1 (at least 0). Ball games on the diamond do not count.
- **Rest.** `wSleepInn` (wrapped, so also the home ground's beds) takes `W_FAT.bed` off everyone; `wMakeCamp` (wrapped) `W_FAT.camp`.
- **Off.** `W_FAT.off` turns it all off (the bot's control runs).

## The captain (w29-captain.js)

- **State.** `WG.captain`: a player id. `wCaptain()` is that player only while they start. `wSetCaptain(pid)` returns '' or why not (only a starter). `wStart` (wrapped) names the first starter if there is none (new journeys and old saves); `wRelease` (wrapped) hands the armband to the first starter.
- **The bonus.** `W_CAPTAIN[kind] = { n, d, on: { event: fn } }`, one for each of the 18 kinds a player can be (`SIG`). One `onHook(event)` per event used runs the captain's handler during a realm match; `fightStart` also logs it. `W_CAPT.off` turns it off.
- **UI.** `wCampRow` (wrapped): a `.wcap` tag on the captain, a `[data-capt]` Captain button on other starters. `wPreGame` (wrapped): a `.wcapt` line.

## Weather (w30-weather.js)

- **The roll.** `wWeather(region)` rolls `WG.wx = { day, by: { region: kind } }` once per `dayAbs`: `blizzard` (rime), `fog` (tide), `ash` (ember), each with its `W_WX[k].p`. The Plains and the Mosswold stay fair.
- **Which matches.** `wMatchWeather(W)`: a `W_WX_OUT` kind (`wild`, `event`, `camp`, `alpha`, `lair`, `tour`) on the world map, or a `ground` match whose sport is not in `W_WX_INDOOR`. `wBuildEncounter` (wrapped) sets `enc.world.wx`; fog may make a day wild game off the road an ambush.
- **Kickoff.** A `fightStart` hook gives both sides the marker status (`snowed`, `fogbound`, `ashen`, new `ST` entries) and applies the effect; `B.wWx` is set. Cards: `wx_whiteout`, `wx_fogbank`, `wx_cinder` (kind `any`, uncommon, one regional sport each), using `['ifst', marker, yes, no]`.
- **UI.** The weather after the region's name in the top bar (`wRenderHud`, wrapped), a `.wwx` pre-game line, and `wDrawWeather` over the world view (`wRender`, wrapped, in screen space inside save/restore).

## Regional fans (w31-name.js)

- **State.** `WG.rep = { region: points }`. `wRepStep(region)` counts the thresholds in `W_REP.at` (10, 25, 50): Unknown, Known, Liked, Loved. `W_REP.off` turns the effects off.
- **Earning.** `wDispatchEnd` (wrapped): +`W_REP.win` for a win in `W.region`, −`W_REP.lose` for a loss. `wCupWon` (wrapped): +`W_REP.cup` to the cup's region. `wNoticePayOut` (wrapped): +`W_REP.notice` to the contract's region.
- **Effects.** `wInnPrice(price, region)` (`W_REP.inn` by step) is applied by `wOpenInn` (wrapped) in a city. `wTavern` (wrapped): Liked or better, each new week's agents +1 level, fee unchanged (`T.wrep`). Loved: a `fightStart` hook adds `W_REP.block` Block (`B.wRep`) unless the match is at home (`wIsHome`) or the Crown.

## The Barnstormers (w32-tour.js)

- **State.** `WG.tour = { region, prev, since, beat: [years], played }`. The tour starts on day `W_TOUR.start`, away from the Plains; `wNewDay` (wrapped) moves it after `W_TOUR.stay` days (`since` is the day after the move). `wTourOn()`: started, and not beaten this year.
- **Rumours.** `wTourRumour()`: the region they are in, or for the day between regions where they were. Innkeepers' `barnstormers` (act `tour`) logs it; `wOpenBoard` (wrapped) shows it as a poster.
- **The match.** `wEncounterHook` (wrapped): on the world map in their region, `W_TOUR.p` a step. `wTourMatch(region)`: `W_TOUR.type` (`boss`), tier `W_TOUR.tier` (3), level + `W_TOUR.lvUp` (0), only once you hold `W_TOUR.cups` cup, kind `tour`, in `W_TOUR.team`'s colours (`wMatchTeam`, wrapped). `W_ON_END.tour`: a first win pays `W_TOUR.prize` and the card `tour_showstop` (kind `none`, so no reward pool offers it); later years `W_TOUR.again`. A loss moves them on.

## Gold sinks (w33-sinks.js)

- **Training camp.** `wCampDrill(spotId, card)`: only after that spot's free drill this week; `wCampPrice()` from `W_SINK.camp` by sessions this week (`WG.sink = { week, drills, coaches }`). A row added to `wOpenSpot` (wrapped).
- **Coaches.** `wCoachTrip(from, to)`: `{ dist, price, minutes }` between two of `W_COACH_CITIES`. `wTakeCoach(to)` charges, advances the clock, and puts you at the destination's inn spot (`wInnSpot`) with the usual grace. Innkeepers' `coach` (act `coach`) and the inn's Coach button open `wOpenCoach`.

## Defend the title (w34-defend.js)

- **Champions.** `wChamps()` = crowns held. `wRenown` (wrapped) adds `W_DEF.renown` each. `WG.crownDay` is the day of the last crown.
- **Defences.** `wDefending(id)`: a town cup on your wall whose `cupLog` year is before this year, once you are champions. `wCupProblem`, `wCupEnter` and `wCupPlay` (wrapped) let you in and mark `WG.cup.defence` before round 1 is built; `wCupMatch` (wrapped) adds `W_DEF.lvUp` levels to a defence and a level per crown to the Crown. `WG.defend.cups[id]` lists the years defended.
- **The hunt.** `wEncounterHook` (wrapped), from the day after a crown: `W_DEF.huntP` a world step, a rival club's `event` match with `ref: { rival, hunt: 1 }` (so w18 counts it on the table and h2h). `W_ON_END.event` (wrapped) pays `W_DEF.huntWin`.

## The Hall of Legends (w35-legends.js)

- **Storage.** `localStorage[pkey('sd-realm-legends')]`: the latest `W_LEG.keep` entries `{ id, name, short, color, light, year, crowns, hard, at, cap, players: [{ n, kind, lvl, num }] }`, written on a Crown (`wCupWon`, wrapped; never in LAB). One entry per journey (`WG.legId`), updated by later crowns.
- **Later journeys.** `wStart` (wrapped) copies the Hall into `WG.legends` (never the journey's own). `wLegendMatch(id)`: a `rival` match at tier `W_LEG.tier` against `wLegendIds(L)` (an ordinary enemy of each player's kind, at most one elite), kind `legend`; a `fightStart` hook gives the enemies the legend players' names; `wMatchTeam` (wrapped) their colours. `W_ON_END.legend` records `WG.legBeat[id]` and pays `W_LEG.prize`. Steward Crane's `legends` (act `legends`) opens the Hall; with `W_LEG.roadCups` cups, `wEncounterHook` (wrapped) may bring one on the road.

## Gate money (w36-gate.js)

- **No fee, a gate on a win.** `wTake(id, mode)` is the gold a win at a card-game ground takes today: `W_TAKE.per[mode]` (Friendly 5, Challenge 6) × `wGrdTier(id, mode)` × `W_TAKE.name[wRepStep(region)]` (1, 1.25, 1.5, 2 for Unknown, Known, Liked, Loved), rounded. 0 at the Ballpark (ball games keep `W_BALL.gold`) and when `W_TAKE.off`.
- **Paid by** `W_ON_END.ground` (wrapped as `wW36GrdEnd`): worked out before the win adds to your name, so it matches the cards; paid through `gainGold` (trophy gold bonuses apply) with a log line. A loss takes nothing.
- **Shown** on the keeper's card (`.wgate`, `wOpenGrdCard` wrapped), the pre-game card's ground line (`.wpground`), and How to play (`#wHelpGate` in `#wHelpGrdPlay`).

## The map (w37-map.js)

- **State.** `WG.fog`: the revealed world tiles, a `WW`×`WH` bitset as a base64 string (plain JSON), decoded once per `WG` into a module cache. `wFogSeen(x, y)`, `wFogReveal(x, y, r)` (returns how many tiles were new, and stores), `wMapSeenCount()`.
- **Reveal.** `wDoStep` and `wEnterMap` (wrapped) reveal a circle of `W_MAP.see` tiles round you when you are on the world map. `wStart` (wrapped): a journey without `WG.fog` (new, or an older save) is revealed `W_MAP.back` tiles round Graftonbury and every place in the journal or with a `seen_` flag.
- **Drawn** by `wMapDraw` on `#wMapCv` (`W_MAP.px` pixels a tile): `W_MAP_COL` flat tile colours, an inked edge on the fog, `wMapMark` for each place in `wMapPlaces()` (kinds in `W_MAP_KIND`; bold name once in the journal's places; a ground's name on the side away from its city), and a red mark at `wMapHere()` (your tile, or the place whose map you are in).
- **Every map.** `WG.fogs = { mapId: base64 }` holds the fog of every map but the world, sized `m.w`×`m.h`; `wFogSeen`, `wFogReveal` and `wMapSeenCount` take the map id as an optional last argument (`'world'` when left out). Off the world, the reveal radius is `W_MAP.seeIn[m.kind]` (town 6, dungeon 4). `wMapDrawLocal(cv, id)` draws a town or dungeon at `wMapPx(m)` pixels a tile: rooms from `wDungeonRooms(id)` (crossed off by `room_` flags), the alpha (`M`, its `alpha_` flag), strongboxes (`C`, their `chest_` flags), ways out (tiles with `enter`), street signs (an `S` with capitalised text and no `under`) and people. An older save without `WG.fogs` reveals the towns in the journal (or with a `seen_` flag) whole, and those dungeons round their stairs; a new journey starts dark.
- **Opened** by `wOpenMap()`: the `M` key, `#wMapBtn` (`wRenderHud` wrapped, after the Journal button), and `#pMap` on the Menu (`openPause` wrapped, in the world only). How to play: `#wHelpMap`.

## Soccer at Rimewatch (w38-soccer.js)

- **The ground.** `g_sheet` keeps its id and is now the Hoarfrost Pitch, a soccer ground (`W_GRDS` in `w21-grounds.js`): Sister Hogline keeps it, its field art is `wGrdArt` case `soccer`, and it is outdoors (not in `W_GRD_INDOOR`), so a blizzard reaches it. `DB.regions.rime.sports = [['hockey', 3], ['soccer', 2]]`. The squad rule is `W_GRD_SQUAD.soccer = 5` ("eleven a side: five of your own, and call-ups fill the rest"). The spot `sp_maker` is the kick-about wall (soccer). `W_NOTICE.margin.soccer = 2`.
- **Old saves.** `wStart` (wrapped as `wW38Start`): when `WG.soccer !== 1`, `WG.grd.rec.g_sheet` (a curling record) is deleted with a log line, and `WG.soccer = 1`. A home ground at `g_sheet` and fixtures drawn there carry over and play as soccer.
- **The rule** is Sudden Death's (`SPORTS.soccer`, `src/engine/sports.js`): `B.sc.passes`, `B.sc.saves`, `B.sc.eh`/`B.sc.et` (the enemy turn's hits, and whether any got through), `B.sc.keep` (a pass to start the next turn), all plain numbers.

## Retiring a card (w39-retire.js)

- **The rule.** `wRetireCard(card)`: at your home ground, once a week (`WG.ground.retired = wWeek()`), for `W_RETIRE.energy` (3) energy of `REGION_ELEM[wHomeRegion()]`, and never below `W_RETIRE.minDeck` (5) cards. `wRetireProblems()` says why not, in a sentence. It doesn't touch `RUN.removeCost`, the card vendors' gold price.
- **Shown** on the ground's screen (`#wGroundRetire`, `wOpenGround` wrapped), and in How to play (`#wHelpRetire` in the home ground section, `#wHelpTrade` for the vendors' trade in Towns).
- **Copies in your deck.** `inDeckHTML(id)` (Sudden Death, `src/ui/card-faces.js`) writes "In your deck: N" or "Not in your deck" under a card on offer: the card choices (`cardChoiceRow`, which the Realm's picks use too), the pro shop, an event's cards, and the Realm's card vendors.

## Ambient music (w50-ambient.js)

- **The plan.** `wAmbGen(pal, seed, mood)` returns a function that gives the next event in time order: `{k: 'chord', t, dur, deg, notes}`, `{k: 'motif', t, frag, src, answer, notes: [[midi, at, len]], dur}`, `{k: 'acc', a, t, x}`, `{k: 'grain', a, t, x}` and `{k: 'gust', t, f, v}` and `{k: 'pulse', t, grid, hz, beat}`. Times are seconds from the start. `mood()` gives `{i, night, wx}` as each event is planned. `wAmbPlan(pal, seed, secs, i, night, wx)` collects the first `secs` seconds at a fixed intensity. The seed is `wAmbSeed(pal)`: the palette, `WG.dayAbs` and the hour.
- **The palettes** are `W_AMB_PAL`: the five regions, `town` and `dungeon`. Each has a scale, a root (the drone's note), tempos calm and in danger (`bpm`, `bpmHi`), the sounds (`drone`, `pad`, `lead`, their filters, `oct`, and `pluck`, `waver` or `bellLead` for the lead), `gain` (its level: each is set to about 0.019 RMS, measured offline over three minutes), the chord walk, the texture (`tex`: filtered noise and a slow swell), `grain`/`nightGrain` (crackle, crickets, drips), the accents (`acc`, `accNight`, `accGap`), the tunes the motifs come from (`theme`, `nightTheme`), and `wx` (the weather it sounds: a texture layer, grains, accents and how far it closes the master filter). Accents and grains are played by name from `W_AMB_SND`, each from its event's seed (`e.x`), so a plan sounds the same every time. The noise and the reverb are seeded too (the room is drawn at 44.1 kHz and resampled, so it is the same room at any sample rate, and every pitch is as loud through it in every session); the levels were set with it.
- **Special places** (phase 4). `wAmbPlace()` comes first: a secret site's palette by location id (`W_AMB_PLACE`: `wreck`, `chapel`, `shrine`, `cottage`, `nowhere`), a ground's map (`grd_<ground>`, built at load from `W_GRD_THEMES` with the ground's tune, scale and chords, levels in `W_AMB_GRD_GAIN`), the Coliseum (`hall`, the Hall of Legends, on Sudden Death's `title` tune), inside the abbey in Rimewatch (`abbey`, from the building signed ABBEY, `wAmbAbbey()`), and within `W_AMB.lair` tiles of an unbeaten, found lair (`lair`). `wAmbLairNear(R)` is the one rule for lairs (unbeaten, and found if hidden behind a clue), for the bed at the door and the danger further off; `wAmbAlphaNear(m)` scans for alphas (`M`) as the map shows them. `wAmbPlace()` returns `undefined` for no special place, `null` for one with no palette yet (it keeps its tune), or the palette. `choir: 1` sings a palette's pad (two detuned voices a note with a slow vibrato). `wMusicMood().place` adds `hall` and `abbey`.
- **The whole tune** (phase 4). The plan has a `theme` stream: `{k: 'theme', t, src, notes, dur}`, the palette's whole tune on the lead, slowly (its notes go on the bed's queue, `ch.q`, and `wAmbFlush(c, until)` schedules each as it comes into the lookahead, so a long tune never fills the voice cap; `WAMB.tn` and `WAMB.tnLost` count its notes played and refused), by chance every `W_AMB.theme` (300 to 600) seconds, never above `W_AMB.quietAt` (it waits a minute), and no fragment plays over it: one that would still be ringing when it comes waits for it to finish. `gen.soon(t)` asks for it at plan time `t` (never before the event already planned, nor over a fragment still ringing): on arriving in a region (`W_AMB.arrive`, 8 s; not on coming back to the same region after a match, `WAMB.region`), and at dawn (`W_AMB.dawn`, 6 to 8 am, once a day, `WAMB.dawnDay`). `gen.S` is the plan's state, for tests.
- **Which palette.** `W_AMB_THEME` maps a calm tune to its palette; `wAmbPalFor(theme)` also sends the night road (`w_night`) to its region's palette, tinted for night. A tune with no palette plays as before. Moving to another palette crossfades: once the new one has been wanted for `W_AMB.settle` (1.2 s, so a border never flaps), the old bed fades out over `W_AMB.cross` (4 s) as the new one fades in over the same time. Each bed's seed also counts the beds started, so coming back is never a replay. The voice cap keeps `W_AMB.keep` voices for the pad, motif and pulse (accents and grains stop short of them); after a stall or a sleeping tab more than `W_AMB.late` behind, the plan's clock moves on by the lag in one step, so it picks up where it was and nothing bursts out; a new bed keeps the eased intensity (it never jumps to the target); the alpha and lair scan reads the map as shown (`wTileAt`), so a hidden place stays hidden; the pause menu ducks the bed to `W_AMB.pause`. A texture's swell multiplies its level (1 ± depth), so it never goes below zero. The numbers are in `W_AMB`.
- **The mood.** `wMusicMood()` returns `{place, site, palette, intensity, tint: {night, wx, tired, hurt}, why}`. `place` is `world`, `town`, `dungeon`, `site`, `ground` or `lair`; `intensity` (0 to 1) is the target, from the threats in `why` (`wild`, from `wEncounterP(m, c)` in `w5-bridge.js`, the tile's wild-match odds; `alpha`, `lair`, `dungeon`, `grudge`, `fog`, `night`, `hurt`), combined as 1 − Π(1 − s). The numbers are in `W_AMB_MOOD`. `WAMB.i` eases toward the target (`wAmbEase(target, dt)`, `W_AMB.ease`).
- **When it plays.** `wAmbWants(theme, mode)`: Music on, not `LAB`, `SET.mstyle !== 'classic'`, `calm`, the world or panel view, and a palette for the tune. `musicWanted` is unchanged (it still names the tune); `musicSet` is wrapped and plays the bed instead of the tune. `musicStop` stops both.
- **Levels** (phase 5). `W_AMB.vol` (.68) puts the bed at the tunes' level (about 0.016 RMS), so the sound effects sit over it as they do over the tunes; `W_AMB.voices` is 32, as a choir's pad and motif need up to 23 at once.
- **The live state** is `WAMB` (not saved, and never in `WG` or `RUN`): `pal`, the audio chain `ch`, `live` and `peak` voices (capped at `W_AMB.voices`), and the last 200 events played in `log`.
- **Settings.** `SET.mstyle` is `'ambient'` (the default) or `'classic'`, saved with the other settings. The Music style row (`#wMstyle`) joins the Settings panel through an observer on `#modalBox`. How to play: `#wHelpAmb`.
