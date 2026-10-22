# Sudden Death: Realm. Hybrid open-world RPG plus deckbuilder sports (plan and outline issue)

Tracking issue: https://github.com/geoff-maddock/sudden-death/issues/1

## Context

Geoff wants a new game that combines `context/terra_chimera.html` with `sudden-death.html`:

- **From Terra Chimera:** a Ultima-style open-world creature RPG. It has 5 regions, towns, dungeons, an NPC keyword dialogue system, cups, rival companies, road events and day/night. Its fights are tactics on a grid.
- **From Sudden Death:** a single-file Slay-the-Spire-like where every fight is also a sports game.

**The hybrid:** you travel a fantasy-monster realm of cities, forests, tundra, fens and volcano. You meet companions who join your adventuring party, and they are also the players on your sports team.

- Every fight is a Sudden Death match.
- As the team improves you enter dungeons, where you play harder games against famous, powerful teams and win magic gear.
- You finish as champion of the realm.

This plan covers two things: what you'll build, and the GitHub epic issue that tracks it.

**Decisions Geoff made:**
- **Losing:** you black out and wake at your last inn, losing some gold and fans. An optional **Hardcore** mode at new game makes a loss end the save.
- **Art:** ink style everywhere. The overworld is redrawn in Sudden Death's procedural ink style; Terra Chimera's pixel art is not used.
- **Terra Chimera systems that carry over:**
  - cooking, as pre-game meals;
  - enchanting, as gear and card upgrades;
  - road events with day/night, seasons and championship week.
- **Terra Chimera systems that are dropped:** grid combat, snaring, the gene lab and mutations, and the editor UI.
- **Tracking:** one epic GitHub issue with a phase checklist.

## Approach: one codebase, new world parts layered on Sudden Death

Because the whole game is ink-styled, the hybrid **reuses Sudden Death's global scope**. That covers the renderer (`drawMonster`, `portraitURL`, ink primitives in p1), `modal()`, tooltips, the card engine and the fight scene. Terra Chimera's world *logic* is ported in as new parts. It does not run in an iframe or a closure.

- **Branch** `realm` off `main`.
- **New parts** go in `src/realm/`, for example:

  | Part | Contents |
  |---|---|
  | `w0.html` | shell additions |
  | `w1-data.js` | regions, locations, towns, NPCs, events, cups, recipes, ported from TC `DB` |
  | `w2-maps.js` | TC `buildWorld`, `buildTown`, `buildDungeon`, `carvePath`, `bfsReach`, `worldProblems` |
  | `w3-state.js` | world state, time, movement, interaction, dialogue `say`/`runAct` |
  | `w4-ink.js` | ink tile renderer and layer cache |
  | `w5-bridge.js` | world ↔ match seam |
  | `w6-party.js` | roster, lineup, per-player cards, levels |
  | `w7-ui.js` | HUD, camp, shops, talk, journal |
  | `w8-boot.js` | title, new game, save, overrides |

- **Build:** a new `src/realm/manifest.txt` concatenates the Sudden Death JS parts (same order as `build.sh`), then the `src/realm/` parts, and writes **`dist/realm.html`**.
  - It does the same `node --check` and duplicate-global-name check.
  - `build.sh` and `sudden-death.html` are untouched, so the standalone game and its test suite stay green.
- **Name collisions:** the explorer listed them. TC's colliding names (`G`, `B`, `UI`, `log`, `advance`, `startCombat`, `endTurn`, `doMove`, `frame`, `boot`, `ST`, `EN`, `cv`, `ctx`, `$`, `esc`, `pick`, `ri`, `wpick`, `cap`, `showTip`, `saveSettings`) are handled when porting:
  - **Use Sudden Death's version** where it is a utility: `$`, `esc`, `pick`, `ri`, `wpick`, `modal`, tooltips.
  - **Rename with a `w` prefix** where it is world-specific: `WG` for world state, `wLog`, `wAdvance`, `wFrame`.
  - **Drop entirely** where it belongs to cut systems: TC `startCombat`/`endTurn`/`doMove`/`B`/`ST` (grid combat) and the gene lab.
- **Overrides:** follow the CLAUDE.md rule and reassign, never redeclare. Examples: `renderTitle = function(){…}`, `finishFight = …`, `saveRun = …`, `frame` gets a world branch.
- **Screens:** add a `#v-world` view beside `#v-map/#v-fight/#v-panel`. Sudden Death's act map (`#v-map`) is not used in Realm. The existing rAF `frame()` gets a branch so it draws the world when `UI.view==='world'`.
- **Listeners:**
  - TC's document `keydown`/`click` handling is rewritten to go through Sudden Death's patterns and only act when `UI.view==='world'`.
  - Sudden Death's pause hotkey (p9) needs a one-line view guard. Add it via a reassignment in the realm parts if possible; otherwise as a guarded line that is harmless to the standalone game.

### The match seam (`w5-bridge.js`)

```
startMatch({ ids, type: 'normal'|'elite'|'rival'|'boss', sport, tier, trait?, stakes?, onEnd })
```

1. Store the world context on `RUN.pending.world` (plain data, so the mid-match save still works):

   ```
   { kind: 'wild'|'cup'|'dungeon'|'event', ref }
   ```

2. Set `RUN.act = tier` (1–3) so `TUNE`/`spawn` scaling applies. Add a finer level multiplier through a `mod('enemyHp')`-style hook, and add it to `atkDmg`'s breakdown if it touches damage.
3. Filter the match deck to the 3 starters (see Party), then call the existing `beginFight(enc)`.
4. Reassign `finishFight`:
   - **Win:** `afterCombat()` + `combatRewards()` + `settleStakes()`, then the reward panel. Its Continue goes back to `#v-world` instead of `backToMap()`, then calls the world handler by name, looked up from `RUN.pending.world.kind`. It never stores a callback, because `B`/`RUN` must stay JSON.
   - **Loss:** normally a **blackout**: wake at `WG.home` (the last inn), lose X% gold and fans, heal partly. In Hardcore, call `recordRun('lose')` + `showEnd`.
   - The player's world position never changes during a match, which matches TC's `endCombat` contract.
5. Starting templates: `test/lab.js:35-41` for the headless path, and the `enterNode`/`rollEncounter` logic (p8.js:91, p5.js:131) for building encounters.

### Party = team (`w6-party.js`)

- **Roster:** up to 8 companions. Each one is an **SD creature kind** plus a name, number and flavour (the existing `RUN.party` row shape), plus RPG fields `lvl`, `xp` and `cards[]`.
- **Lineup:** the first 3 are starters, the rest are bench. This mirrors both TC's `team()` = `roster.slice(0,3)` and SD's 3-player line.
- **Cards belong to players.** Each card's `own` kind already exists (`assignOwners`, p4d).
  - Match deck = league (`'any'`) cards + cards owned by the 3 starters.
  - Benching a player benches their cards.
  - `RUN.party` is rebuilt from the lineup before every match, so `runKinds()`/`cardPool`/`SIG` all just work.
- **Team HP:** keep SD's single team stamina pool (`RUN.hp`). It persists in the world, and inns, meals and resting heal it.
- **Levels:** companions earn XP from matches, with a share for the bench. Each level gives a card choice from that kind's pool and +team max HP. Practice ★ stays as the per-card track.
- **Careers:** existing `updateCareers` (p4d) keeps per-companion stats.
- **Recruitment:**
  - free agents in town taverns, reusing `genDraftClass` (p2c);
  - after a win, a beaten player may ask to join (a chance, higher against elites);
  - NPC quest companions found through dialogue keywords.
- **Start:** pick a club (reuse `renderDraft`, p8) for your 3 founders and your club trophy. TC "companies" become rival SD clubs.

### World content mapped to matches

**Regions to sports** (a starting point, tuned with bots):

| Region | Theme | Home sports |
|---|---|---|
| Charter Plains | hub | baseball, basketball |
| Mosswold | forest | golf, jousting |
| Brinefen | fen | bowling, curling |
| Frostspire | tundra | hockey, curling |
| Cindermaw | volcano | football, boxing |

Each region also gets native creature kinds for wild teams and recruits.

**Tiers:** plains and road encounters are tier 1, the outer regions tier 2, deep dungeons and the Crown tier 3, with a level multiplier inside each tier.

- **Wild encounters** (TC `encounterRoll`): roaming pickup teams play a normal SD encounter. Night off-road games are tougher, with an ambush that gives the enemy a hot start.
- **Town cups:** 4 cups (Mossgate, Saltmere, Cinderhold, Rimewatch). Each is 3 rounds: normal, then elite with a trait, then a rival club.
- **Crown:** at the Coliseum during championship week, after 4 cups. The final is against the apex club with an Act 3 boss.
- **Dungeons and lairs:** Genevault, Emberdeep, Hatchery, Deepseam (hidden), Eldergrove, Auroraroost.
  - Each is a gauntlet of rooms of famous teams, using SD elites with `ELITE_TRAITS`, `SPORT_PERKS` and `STAKES`.
  - The deepest room holds one of the 9 SD bosses.
  - Chests give **magic gear**: SD trophies, `gr_*` gear cards and Hall of Fame legendaries.
  - Dungeons are gated by cups won and keys.
- **Rivals remember you:** rival clubs recur across cups and dungeons and keep a head-to-head record. This is the "rival continuity" open idea.
- **Kept TC systems, reworked:**
  - **Cooking:** meals bought or cooked from foraged ingredients become SD `TONICS` or one-match buffs (via `onHook('fightStart')`).
  - **Enchanting:** elemental energy (earned by winning in each region) is spent at the enchanter to upgrade cards (`up`), Practice ★ or gear charges.
  - **Road events, day/night, seasons and championship week:** ported, but events lead to matches or rewards instead of grid fights.

### Ink overworld (`w4-ink.js`)

- Keep TC's tile semantics from `DB.tiles` (walk, enter, use, enc).
- Draw each tile type with SD's ink primitives (p1) on a paper-toned palette per region, cached into a per-map offscreen layer like TC's `mapLayer`.
- Draw the party leader and NPCs with `drawMonster` at small scale through SD's sprite cache (`drawWho` pattern, p7). Night uses a darkness overlay.
- Follow the canvas rules: `save()`/`restore()`, whole device pixels, DPR sizing like `fitStage`.

### Save

- One save: `localStorage[pkey('sd-realm')] = { v, WG, RUN }`.
- `saveRun` is reassigned to write it, and is a no-op in `LAB`. The mid-match snapshot (`snapBattle`/`restoreBattle`, p9) is reused unchanged. On resume, a pending battle is restored, otherwise the game returns to the world.
- Realm's records and achievements stay per profile.

## Phases (these become the epic's checklist)

0. **Setup:**
   - create the `realm` branch;
   - commit this plan as `docs/realm/PLAN.md`;
   - create the epic issue on `geoff-maddock/sudden-death`;
   - write `src/realm/manifest.txt` with an empty realm shell that boots to the SD title.
1. **World skeleton:**
   - port the TC data and map builders;
   - add the ink tile renderer, `#v-world`, movement, map transitions, NPC talk and the HUD;
   - walk the realm with no fights yet.
   - Port TC's `audit()` and `worldProblems` as a test.
2. **Match seam:** `startMatch`, `finishFight` override, return to the same tile, blackout, Hardcore, and resuming mid-match from the world.
3. **Party = team:** roster and lineup UI, per-player cards and match deck filtering, levels, recruitment (taverns, post-game, quests), club start.
4. **Encounters and towns:** wild encounters with region sports and tiers, shops and inns, meals (cooking), the enchanter, road events, day/night.
5. **Dungeons and magic gear:** dungeon gauntlets, bosses, gear and legendary drops, gating.
6. **Cups, rivals and Crown:** cup ladders, rival continuity, championship week, the Crown final and the champion ending.
7. **Balance:** a realm bot (`test/realm_lab.js`) that follows a scripted progression path (cups, dungeons, Crown) using the SD `botTurn`. Report win rate by stage with 100+ runs per configuration.
8. **Polish:** a How to play section for Realm, music per region, tips, achievements for Realm, publishing as an artifact, and updating README, ARCHITECTURE and CLAUDE.md.

## Verification

- `./build.sh && ./test/all.sh` stays green on the branch, so the standalone game is unaffected.
- `./build.sh src/realm/manifest.txt` passes `node --check` and the duplicate-name check.
- New Playwright checks loading `realm.html`, each added to `test/all.sh` and asserting rather than printing:
  - `test/realm_smoke.py`: boot, new game, walk N steps, enter a town, talk to an NPC, no `__sdErrs`.
  - `test/realm_match.py`: trigger a wild match, win it via bot turns, assert the same tile, rewards applied and XP gained; lose one and assert the blackout to `WG.home`; in Hardcore, assert the save ends.
  - `test/realm_save.py`: save mid-world and mid-match, reload, then assert the position, roster, deck and battle match.
  - `test/realm_audit.py`: ported `audit()` and `worldProblems()` return no issues.
  - `test/realm_lab.py`: the balance bot (phase 7).
- Screenshots of world, town, dungeon and match at desktop and phone widths, saved to `/tmp/`.

## Epic issue (created in phase 0 with `gh issue create`)

- **Title:** "Sudden Death: Realm — open-world RPG hybrid (epic)"
- **Body:**
  - the vision paragraph;
  - Geoff's decisions;
  - the architecture summary (realm parts layered on SD, `src/realm/manifest.txt` → `realm.html`);
  - the phase 0–8 checklist above, each phase with 3–5 sub-bullets;
  - the open questions: final game name, region sport weights, and how many companions you can have.
