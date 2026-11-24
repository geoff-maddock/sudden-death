# The Umbral, the rest of the spec (#111): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan phase by phase. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Umbral Realm (#99) as #111 lists it, and turn it from nine flat, any-order challenges into a journey that **ramps**: the dark side wakes as you take its pieces, and you grow stronger as it does.

**Architecture:** New Umbral parts in `src/realm/umbral/` named `u8*`–`u9*`, loaded after `u7-feel.js` on the Realm manifest. They change earlier parts only by reassignment (`wWU8<x>Name`), as the Realm rules require. Engine changes are small guarded hooks in each engine's existing `*-umbral.js` part, and `src/figures/figures.js` and `src/render/creatures.js` for the drawing. All new state lives in `WG.umbral` (plain JSON).

**Tech Stack:** Plain JS in one global scope (scoped engines through `exports.js`), Canvas 2D, Python Playwright checks.

**Spec:** GitHub issue #111 (the rest of #99's spec). #99's own body is still the source for the words and the story.

## Global Constraints

- Realm rules (CLAUDE.md): `w`/`W` names; wraps by reassignment as `wWU8<x>Name`; `WG` and `RUN` plain JSON; dispatch by name through `W_ON_END`; no `alert`/`confirm`/`prompt`; Canvas state wrapped in `save()`/`restore()`.
- Every part gets a `test/realm_umbral_*.py` with real asserts, a line in `test/all.sh` and in the realm list in `.github/workflows/ci.yml`. Tests wait on state, not fixed sleeps.
- `./build.sh` and `./build.sh src/realm/manifest.txt` after every phase, with `dist/` committed.
- Realm words: a monster sports league in a dark register. No chimeras, snares, handlers or gene labs (`test/realm_polish.py`).
- With no hexes, no Lich and no Umbral flags, every engine plays exactly as before (seeded games compared before and after, as #99 did).
- `LAB` mode: no scenes, no sound, no saves. The realm bot (`test/realm_umbral_journey_lab.py`) must be able to do whatever the new systems ask (fight legends, meet feats, avoid hazards).
- Balance target stays: the Seal on **5–15%** of bot journeys that win the Crown. Tier U champions about **15–25%** a game at level parity. No single hex, feat or boon swings a game by more than about **10 points**.
- How to play (`#wHelpUmbral`) and the Quick start's Umbral tab explain every new system in plain, short words.

## The shape of the ramp

Today all nine champions are open from the first step, the dark world is the light one recoloured, and nothing changes between the first piece and the ninth. The plan adds two curves that climb together.

**The Dread (the dark side wakes).** It is read from the pieces you hold and never stored: `wUmbDread()` gives a stage from 0 to 3.

| Stage | Pieces | Name | What changes |
|---|---|---|---|
| 0 | 0–2 | The Quiet | A few slow shadows; spikes on the roads near the grounds |
| 1 | 3–5 | The Stirring | A scene (the dead moon cracks); the Corrupted Kraken wakes in the Drownfen; more shadows, and pits open |
| 2 | 6–7 | The Raging | A scene; the Corrupted Phoenix wakes in the Ashmaw; shadows hunt in pairs and see further; ash storms |
| 3 | 8–9 | The Last Hour | A scene; the Corrupted Frost Wyrm lands on the Hollow Coliseum's road; the dark world's sky bleeds |

**Resonance (the Seal answers you).** Each piece you hold gives a small Umbral-only boon, listed in a Seal panel in the journal. A piece won **with its feat** (see below) resonates twice as strongly. So the first piece makes the dark world gentler to walk, and a run that wins pieces well arrives at the finale with real edges.

**Feats (win them well).** Every champion gets an optional feat: night, margin, no powers, on the brink. The four hard conditions from #99 stay as they are. A feat is never required. Meeting it marks the piece *won well*, which doubles its resonance and gives its finale round an edge in its own sport. This is #111's "each piece's edge in the finale" and its "more conditions", made a choice instead of a wall.

**Legends (the big set pieces).** The three corrupted legends wake with the Dread as world bosses: optional, hard, card-game boss fights with phases. Each one beaten gives a **Legend's Shard**, a one-use finale boon. Three champions also field a corrupted legend in their own sport's lineup (#111's "several champions field a dark take").

## File Structure

| File | Responsibility |
|---|---|
| `src/realm/umbral/u8a-fixes.js` | The small things from #111 that live on the Realm side (Hoarfrost announced, champion games' fixed length) |
| `src/realm/umbral/u8b-land.js` | The dark land: tile looks (ash, ichor, dead trees, bone drift, salt crust), their Look words, reversed constellations |
| `src/realm/umbral/u8c-dread.js` | `wUmbDread()`, the stage scenes, hazards (spikes, pits), the hungry shadows, Shadow Salt |
| `src/realm/umbral/u8d-gauntlet.js` | The walled approach on each dark ground: the gate tile and the guards standing in the gap |
| `src/realm/umbral/u8e-forms.js` | Truer dark traits in the card game; Umbral sides drawn in shadow in every engine (calls the engines' `shade` option) |
| `src/realm/umbral/u8f-legends.js` | The three corrupted legends (world bosses, scenes, shards) and the three lineups that field one |
| `src/realm/umbral/u8g-feats.js` | Feats, resonance, the finale's per-piece edges, the Seal panel |
| `src/realm/umbral/u8h-market.js` | Dark shops that take a trophy: Hex Ward, Lantern Oil, Shadow Salt, Ichor Draught |
| `src/realm/umbral/u9-redeemed.js` | The redeemed captain as a true superstar (signature card and a power in every sport) |
| `src/render/creatures.js`, `src/figures/figures.js`, `src/bd/parts/14-rendering.js` | `o.shade` richer: horns, cracks of light; figures gain `o.shade` |
| Each engine's `*-umbral.js` part | Hockey's interference under The Hollow Whistle; the minotaur's nature next to Brakka (boxing); `shade` passed to the figures |
| `src/realm/w0.css` or `src/realm/umbral/u.css` | How to play's powers table scrolls inside itself at phone width |

## Status (2026-11-24)

Phases A to H and I1 and I3 are built, reviewed until clean and merged on `umbral-rest`. Where the build differs from
the plan:
- The legends and feats files load after the market (they wrap its hex count): `u8i-legends.js` (Phase F) and
  `u8j-feats.js` (Phase G), not u8f/u8g.
- The world legends play fixed sports (the Kraken soccer, the Phoenix basketball, the Wyrm golf) and start stronger
  than first planned (they play alone against a whole team); see BALANCE.md.
- Feats count a first-try win as winning well, so the old first-try rule is a subset; the finale's per-piece edge is a
  hex fewer (and 10 Block in a card round), not a potion.
- The dark tiles keep their characters: only their drawing and words change, so every check that reads the map stands.
- Hazards and shadows are an overlay (`W_ACTORS`), not new tiles.
- Added after the PR opened: the shadows show plainly only when close (6 steps, 5 from the Raging), fading over two
  more and then only a shimmer, for the spec's wraith that can't be seen coming (the Realm has no minimap). Look finds
  one only where it shows.

---

## Phase A: the small things (#111 "small things found along the way")

**Files:** Create `src/realm/umbral/u8a-fixes.js`. Modify the hockey, boxing and golf/bowling/basketball adapters only where the bug lives; `src/realm/umbral/u.css`. Test: `test/realm_umbral_fixes.py`.

- [x] **A1. Hoarfrost is announced.** Find where boxing's (or the hex table's) Hoarfrost fires without a log or scoreboard line, and give it one, the way the other hexes announce. Test: start the hex in LAB and assert its line is in the game's log.
- [x] **A2. The minotaur's nature next to Brakka.** The pairing screen shows the kind's usual nature, not Brakka's own. Show the champion's own nature (the one the engine uses). Test: the pairing text names Brakka's nature and not the minotaur default.
- [x] **A3. Hockey's interference under The Hollow Whistle.** Interference calls ignore the hex. Make the hex apply to them the way it applies to the other calls. Test: with the hex on, a seeded interference call goes the hex's way.
- [x] **A4. A champion game's length is fixed.** In golf, bowling and basketball a champion game follows your length setting. Fix it to the full game (the same length the lab measured), whatever the setting, and say so on the card. Test: with the setting at its shortest, the champion game's length is the full one.
- [x] **A5. How to play at phone width.** `table.wrpow` (660px) makes the page scroll sideways by about 270px at 400px wide. Wrap wide tables so they scroll inside themselves (`overflow-x: auto` on a wrapper, `max-width: 100%`). Test: at 400px, `document.scrollingElement.scrollWidth <= 400` with How to play open.
- [x] **A6.** Build both, run the new check plus the touched engines' checks, commit, then review the phase until clean.

## Phase B: the dark land

**Files:** Create `src/realm/umbral/u8b-land.js`. Test: `test/realm_umbral_land.py`.

The tiles keep their characters (encounters, walking and every check read them). What changes is how they are **drawn and described** on a dark map, so nothing reading the raw map breaks.

- [x] **B1. Tile looks.** Wrap `WGND['.']`, `WGND['"']`, `WGND[':']`, `WGND['n']`, `WGND['~']`, `WGND['s']` and `WOBJ.T` / `WOBJ.f` (whichever draws trees) so that when `e.m.umbral` is set they draw:
  - grass (`.`, `"`) as **ash**: grey ground, cinders, a few dead stalks;
  - water (`~`) and fen (`s`) as **black ichor**: the dark palette's water with an oily violet sheen;
  - trees as **dead trees**: bare grey trunks, no canopy;
  - snow (`n`) as **bone-grey drift**, with a bone poking out now and then;
  - sand (`:`) as **salt crust**: pale cracked plates.
  Each wrapper calls the original when the map isn't dark. Draw through the same random source (`r`) so the look is fixed per tile.
- [x] **B2. Their words.** Wrap `wLookText` so Look on a dark map says the dark tile's words (`W_UMB8B.look[ch]`), e.g. ash: "Ash, ankle deep. Something under it moves when you stop."
- [x] **B3. Reversed constellations.** Find the realm's night sky (constellations come from `engine/sky.js` through the realm's sky drawing). On a dark map, draw them mirrored left to right, with the dead moon already there. Test: the sky drawing on a dark map is called with the mirror flag (expose `wUmbSkyMirrored()` returning true on dark maps).
- [x] **B4. Test** `realm_umbral_land.py`:
  - render the dark world's chunk around the portal and a light one at the same place; assert the pixel average differs on grass tiles, and that the light map's pixels are unchanged from a build without the part (compare against the original drawer called directly);
  - Look on ash, ichor and a dead tree gives the dark words; Look on the light side is unchanged;
  - `wAudit()` has no problems; no page errors.
- [x] **B5.** Screenshots of the dark world, a dark town and a dark ground (`anthropic-skills:canvas-game-visual-qa`) at 1280px and 400px; fix what they show. Build, commit, review until clean.

## Phase C: the Dread, hazards and the hungry shadows

**Files:** Create `src/realm/umbral/u8c-dread.js`. Test: `test/realm_umbral_dread.py`.

**Interfaces (produced):**
- `wUmbDread() -> 0..3`, from `wUmb().pieces.length` and `W_UMB8C.stages = [0, 3, 6, 8]`; 0 when the Umbral is shut or sealed.
- `WG.umbral.dreadSeen` (the highest stage whose scene has played).
- `WG.umbral.shadows = [{ id, x, y, hx, hy }]` on `u:world` (plain JSON).
- `wUmbHazardAt(m, x, y) -> 'spike' | 'pit' | null`.

- [x] **C1. The stages and their scenes.** When the stage rises (checked in `W_ON_END.nadir` after a piece and in `wNextPrompt`), queue a short staged scene the next time the world is free, like u1's: the line, a sky change, a sting (`wUmbSound('dread')`, a low swell), and a screen shake. One scene per stage, never in LAB; the journal's Umbral chapter lists the stages reached.
- [x] **C2. Hazards on the dark maps.** At map build, place hazards deterministically (seeded by map id) on walkable ground tiles away from roads, towns, lanterns, portals and every NPC:
  - **spikes** (`W_UMB8C.spike`, a new tile char with `walk:1`): stepping on one costs `W_UMB8C.spikeHp` (2) team HP, never below 1. Visible, so they are a choice. Present from stage 0, mostly on the approaches to the grounds.
  - **pits** (a new char, `walk:1`): only from stage 1 (drawn as cracked ground before, and fully open after). Falling in costs 3 HP and drops you on a random free tile within 4 steps, with a one-line log. The tile is shown, so it can be avoided.
  The audit must still pass: the hazards never cut off a place, a lantern or the portal (use `bfsReach` without hazard tiles, as u2's lanterns do).
- [x] **C3. The hungry shadows.** Dark-world NPCs (`DB.chars.u_shadow`, kind wraith, drawn in shadow) kept in `WG.umbral.shadows`:
  - Count by stage: `W_UMB8C.shadows = [3, 6, 10, 14]`; spawned at hazard-free spots at least 8 steps from you.
  - Each step you take on `u:world`, each shadow that can see you (within `W_UMB8C.sight = [4, 5, 6, 7]` by stage, in a straight walkable line) moves one step toward you. One that can't wanders within 3 of its home. From stage 2 they move two steps every third step (they hunt).
  - A shadow that reaches you (or that you walk into) starts an Umbral wild match (`world.kind = 'shadow'`, the dark side's own team for the region). Win: it dissolves and comes back elsewhere after a day. Lose: a blackout, as any dark-side loss.
  - Not inside lanterns' light (radius 3): they stop at its edge. Not in towns or grounds.
  - Applied on top of `wEncounterHook`: the random wild-match chance on the dark world falls by half, so the danger moves from luck to things you can see and dodge.
- [x] **C4. Shadow Salt** (`DB.items.shadowsalt`): use it and the shadows can't see you for 60 steps. Sold in the dark shops for fans (from Phase H also for a trophy).
- [x] **C5. The light side feels it.** The blight's hunters and eclipses (u1) grow one step per Dread stage as well as with the weeks.
- [x] **C6. Test** `realm_umbral_dread.py` (real asserts):
  - stage boundaries: 0, 3, 6, 8 pieces give 0..3; sealed gives 0;
  - a scene is queued once per stage and is never queued in LAB;
  - spikes cost 2 HP and never take you below 1; a pit moves you and costs 3 HP; hazards are not on roads, and `wAudit()` is clean;
  - a shadow in sight moves toward you, one out of sight doesn't, and one touching you starts a match with `world.kind === 'shadow'`; none crosses a lantern's light; Shadow Salt hides you;
  - shadows survive a save and reload at the same spots.
- [x] **C7. The realm bot.** In the journey lab, model what walking costs: per champion visited, a Dread-scaled chance of a shadow match (played by the bot), and the spikes' HP (rested away at lanterns, as now). Run 40 journeys and record the Seal rate before and after in `docs/realm/BALANCE.md`.
- [x] **C8.** Screenshots at each stage, build, commit, review until clean.

## Phase D: the gauntlet on the dark grounds

**Files:** Create `src/realm/umbral/u8d-gauntlet.js`. Test: `test/realm_umbral_gauntlet.py`.

Today the champion enforces the guards and the gate by refusing to play. Make crossing the ground part of the challenge.

- [x] **D1. The wall and the gate.** On each dark ground, find the row the guards stand on (u4's `wUmbFieldEnd`). Wall that row off from edge to edge with a new impassable tile (`W_UMB8D.wall`, bone railing), leaving a three-tile gap in the middle: the two guards stand in the outer tiles of the gap, and a **gate** tile (`W_UMB8D.gate`, impassable, `use: 'ugate'`) fills the middle. If the field has no straight row, fall back to today's behaviour (no wall) and say so in the audit.
- [x] **D2. Opening it.** Using the gate: with the region's item (`W_UMB4.gate`), it is handed over and the gate swings open for good (`WG.umbral.gates[id]`; the tile reads as open and walkable). Without it, the gate says what it wants, in the same words as today.
- [x] **D3. The guards step aside.** A guard beaten (`WG.umbral.guards`) moves one tile back off the line, leaving the gap. While a guard stands, the gap beside the gate is theirs (fixed NPCs, no squeezing past).
- [x] **D4.** u4's refusal (guards, then the item) stays as a backstop, so a save from before the wall still works.
- [x] **D5. Test** `realm_umbral_gauntlet.py`:
  - every dark ground with a field has the wall, the gate and two guards in the gap;
  - before anything, the champion can't be reached by walking (`bfsReach` from spawn doesn't reach them);
  - beat both guards and open the gate: they can be reached;
  - with the item, using the gate takes one item and opens it; a reload keeps it open;
  - `wAudit()` is clean.
- [x] **D6.** Screenshots, build, commit, review until clean.

## Phase E: corrupted forms

**Files:** Create `src/realm/umbral/u8e-forms.js`; modify `src/render/creatures.js`, `src/figures/figures.js`, `src/bd/parts/14-rendering.js`, the engines' umbral parts (or their `exports.js`) to take a `shade` flag for a side. Test: `test/realm_umbral_forms.py`.

- [x] **E1. Richer umbral forms.** In `creatures.js`, when `o.shade` is set, also draw two short curved horns over the head (unless the kind already has horns) and two or three thin cracks of light across the body (the region's accent, or `#c8b8ff`), seeded so they stay put. In `figures.js` add the same `o.shade` (drained colours through a `shadeOf` like creatures.js, pale glowing eyes, horns, cracks). Brimstone Diamond's own figures get the same.
- [x] **E2. Umbral sides in shadow in every sport.** Every Nadir side and every dark-side engine game draws the other team with `shade` on: add `shade` to the team object each adapter builds (`W_UMB4*.team`), and have each engine's figure call pass `o.shade = team.shade`. Your side is never shaded.
- [x] **E3. Truer dark traits** (card game; `W_UMB3.traits` gains these, replacing the stand-in versions):
  - wraith **Half There**: the first hit each turn against it does nothing (a status `u_phase` that a hit spends and `turnStart` restores);
  - ogre **Won't Flinch**: Weak and Exposed don't take on it (wrap the status apply for `B.umb` enemies of kind ogre);
  - spider **Webs the Bench**: at the start of each of your turns, one card in your hand costs 1 more that turn (shown on the card as webbed);
  - others keep their current traits. Each trait's words say exactly what it does, in the match log and in How to play.
  All through hooks (`onHook('turnStart')`, the existing damage helpers), and recorded in `atkDmg`'s breakdown where they touch damage, so the on-screen numbers explain themselves.
- [x] **E4. Test** `realm_umbral_forms.py`:
  - each trait does what its words say (seeded fights in LAB: the wraith's first hit is cancelled, the second lands; the ogre takes no Weak; a webbed card costs 1 more);
  - each engine's figure call gets `shade: true` for the Nadir side (spy on `drawFig` through each engine's export, or check the team object);
  - the light side's figures are drawn without shade (pixel check on one engine);
  - no page errors.
- [x] **E5. The lab.** Re-run `test/realm_umbral_lab.py 40` (card game at tier U) before and after E3, and keep the card game's tier U near where it was (adjust the traits, not the targets).
- [x] **E6.** Screenshots of a Nadir side in each engine, build, commit, review until clean.

## Phase F: the corrupted legends

**Files:** Create `src/realm/umbral/u8f-legends.js`; touch the three lineups in `u4b-football.js`, `u4d-basketball.js` and `u4g-bowling.js` (or wrap their team builders from u8f). Test: `test/realm_umbral_legends.py`.

**Interfaces (produced):** `W_UMB8F.legends = { kraken: { stage: 1, region: 'tide', ... }, phoenix: { stage: 2, region: 'ember' }, wyrm: { stage: 3, region: 'plains', near: 'coliseum' } }`; `WG.umbral.legends = { kraken: 'beaten' | 'awake' }`; `WG.umbral.shards` (a count); `wUmbShardUse(round)`.

- [x] **F1. The world legends.** Each is a card-game boss (`EN('u_kraken' ...)`, `'u_phoenix'`, `'u_wyrm'`, drawn in shadow with the legend's own kind), in two phases (the boss "brains" pattern the light-side bosses use: a second set of moves under half HP). Each stands on the dark world in its region, on a lair tile placed like the lanterns, from the moment its stage is reached. Its scene is part of that stage's scene (C1). Talking to it shows a card naming the fight, its phases and the prize.
  - Corrupted Kraken (stage 1, the Drownfen): drowns your hand, discarding cards and adding Slimed.
  - Corrupted Phoenix (stage 2, the Ashmaw): Burn, and once it would die it rises at 40% HP.
  - Corrupted Frost Wyrm (stage 3, on the road to the Hollow Coliseum): Weak and Exposed, and a Blizzard that freezes a card each turn.
- [x] **F2. The prize: a Legend's Shard.** Win and gain a shard (`WG.umbral.shards++`) and a rare card. In the finale, before a round starts, you may spend a shard to take one hex off that round (or, in a card round, to start with 15 Block). Lose: a blackout as usual; the legend stays and heals.
- [x] **F3. Champions who field a legend.** Three Nadir lineups swap one player for a corrupted legend of a superstar kind already built for that engine: the Behemoth in the Cinder Pit's seven (football), the Hydra on the Black Court (basketball), the Djinn in the Drowned Lanes (bowling). Check each star's kind is rated in that engine's star file first. The card says so, and they are drawn in shadow.
- [x] **F4. The realm bot** fights each world legend once when it wakes, if the bot's HP is full (resting first), and spends shards on the finale's hardest round. Measure the Seal rate with and without (`'{"legends": false}'`).
- [x] **F5. Test** `realm_umbral_legends.py`:
  - each legend appears only once its stage is reached and is placed reachably;
  - each boss changes phase under half HP (LAB fight with HP set);
  - a win gives one shard and marks the legend beaten (no second shard);
  - spending a shard takes one hex off the finale round's draw and is saved;
  - the three lineups each field their legend (team builder output);
  - `wAudit()` is clean.
- [x] **F6.** Screenshots, build, commit, review until clean.

## Phase G: feats, resonance and the finale's edges

**Files:** Create `src/realm/umbral/u8g-feats.js`; modify u5's round building through a wrap (no edits to u5). Test: `test/realm_umbral_feats.py`.

**Interfaces (produced):**
- `W_UMB8G.feats[championId] = { k, n, test(W, ctx) }`. Feat kinds: `night` (won after dark), `margin` (by N), `nopowers` (your powers off: the engines that take `powers: [yours, theirs]`, i.e. hockey, golf, bowling, curling), `brink` (card game: won with Team HP at or under 25% of max), `flawless` (boxing: never knocked down), `shutout` (no runs/goals/points against, where the engine reports it).
- `WG.umbral.well = { piece: true }` (the pieces won well).
- `wUmbResonance() -> { [piece]: 0 | 1 | 2 }`.

- [x] **G1. Feats.** Give every champion one feat that suits their sport and isn't already their hard condition. The game card names it under the condition, as optional ("Win it by three, or after dark, and the piece will sing for you"). For `nopowers`, the card offers a "Play without powers" choice that starts the engine with your powers off. The result card and the log say whether the feat was met.
- [x] **G2. Resonance.** Each held piece gives its boon (doubled when won well), all on the dark side only:
  - Cracked Card: the first card match each day on this side draws its missing card back on turn 1;
  - Iron Stitch: lanterns heal 10% more and the shadows' sight is one shorter;
  - Black Net: spikes cost 1 less;
  - Hollow Flag: you see pits from further away (they draw open from stage 0);
  - Drowned Pin and Sunken Stone: guards start with less HP (10% each);
  - Ash Ball: a shadow match starts with 6 Block;
  - Broken Bell: blackouts on this side lose half the gold;
  - Dead Puck: shadows move one step slower in the Raging and the Last Hour.
  The exact numbers are tuned in Phase I; the words name them. A Seal panel in the journal's Umbral chapter lists each piece, won well or not, and what it does now.
- [x] **G3. The finale's edges.** Replace "won at the first try takes a hex off" with: a round in a piece's sport draws one hex fewer if that piece was **won well** (feat met), and also starts with that sport's edge: one free potion of your choice in that sport's bag (engines with bags), or 10 Block (the card game). The old first-try rule stays for pieces won before this part, so old saves aren't worse off.
- [x] **G4. Test** `realm_umbral_feats.py`:
  - each champion has a feat; the card names it; meeting it (results faked through each `W_ON_END` kind with the right `W` fields) sets `well[piece]`; missing it still wins the piece;
  - `nopowers` starts the engine with your powers off (check the engine's start options);
  - resonance values follow pieces and well-won pieces, and each boon applies (spikes cost less, shadows' sight shorter, and so on);
  - the finale round draws one hex fewer for a well-won piece and carries its edge.
- [x] **G5. The realm bot** meets feats it can (night: it waits for dark; nopowers: it tries without powers first; the rest by chance), and the lab prints the well-won rate.
- [x] **G6.** Build, commit, review until clean.

## Phase H: dark shops that take a trophy

**Files:** Create `src/realm/umbral/u8h-market.js`. Test: `test/realm_umbral_market.py`.

- [x] **H1. The wares.** A dark shop keeper's stock gains a "for a trophy" row of Umbral-only wares (`DB.items`, `W_UMB2.noSell` untouched):
  - **Hex Ward**: the next Nadir game (or Seal round) draws one hex fewer;
  - **Lantern Oil**: rest anywhere on the dark side once, as at a lantern;
  - **Shadow Salt** (from C4; also sold for fans);
  - **Ichor Draught**: a card match on this side starts with 2 Strength.
- [x] **H2. Paying.** The price is one trophy (`RUN.relics`), chosen from a list. Not the Seal of the Crown, not a trophy the journey can't lose (mark `noTrade`). It is gone for good, with a line saying so.
- [x] **H3. Test** `realm_umbral_market.py`: buying with a trophy removes it and adds the ware; the Seal can't be traded; each ware does what it says (Hex Ward lowers the next champion's hex count by one, then is used up); the light side's shops are unchanged.
- [x] **H4.** Build, commit, review until clean.

## Phase I: the redeemed, balance and polish

**Files:** Create `src/realm/umbral/u9-redeemed.js`; `docs/realm/BALANCE.md`; `ARCHITECTURE.md`; `CLAUDE.md` (commands); u6's How to play through a wrap. Tests: `test/realm_umbral_redeemed.py`, the journey lab.

- [x] **I1. The redeemed captain as a superstar.** When the Seal's recruit joins, they join as a superstar: their own name and number, a signature card in the card game, and in every engine the power their kind has there plus their champion's own ultimate in their home sport (where the engine already has it as an opponent's ultimate). Use the star registration pattern (`wStar(id)`) with an id per champion. Test: the recruit is a star, has a signature card, and keeps their ultimate in their home sport.
- [ ] **I2. Balance pass.** `python3 test/realm_umbral_journey_lab.py 40 15` (and 80 for the final number): the Seal rate (target 5–15%), where runs stop, each champion's game rate, the well-won rate, legends fought and won. Tune the Dread's numbers, resonance and feats (not the targets). Write the before/after into `docs/realm/BALANCE.md`.
- [x] **I3. How to play and the Quick start.** `#wHelpUmbral` gains the Dread, the hazards and shadows, the gauntlet, feats, resonance, the legends and shards, and the trophy wares. The Quick start's Umbral tab gains the feats and the Dread stages. `realm_polish` passes.
- [ ] **I4. Screenshots** of every new screen at 1280px and 400px (`test/realm_umbral_shots.py` extended), with no sideways scrolling.
- [ ] **I5.** Full `./test/all.sh`, docs (`ARCHITECTURE.md`'s Umbral section, `CLAUDE.md`'s command list), build, commit, final review until clean, and update #111.

## Review Focus

- **Saves from before this work.** A journey saved mid-Umbral (pieces held, guards beaten, gates opened through u4's refusal, no `shadows`, `well` or `legends` keys) must load and play: the gauntlet opens what u4 already let through, and stages already passed don't replay their scenes all at once (only the highest one, once). Test in C6 and D5 with a hand-built old `WG.umbral`.
- **A shadow or legend at the edge of things:** a shadow that reaches you on the turn you step onto a portal, into a town or onto a lantern must not start a match on the far side. Test in C6: step onto the portal with a shadow adjacent; no match starts.
- **The finale with shards, wards and well-won pieces together** never draws fewer than zero hexes, and spending one is never lost if you back out of the card. Test in F5/H3: ward + shard + well-won on a 2-hex round gives 0, not -1; backing out keeps both.
- **Hardcore.** A shadow or legend loss in a Hardcore journey ends it like any loss, and the scenes don't draw over the end screen. Test in C6.
- **The bot and LAB.** No scene, sound, save or wait in LAB; every new interaction has a LAB path so the journey lab never stalls. Every lab run checks for page errors.

## Notes on order

A (fixes) and B (the land) stand alone. C (the Dread) is the backbone: F (legends wake by stage) and G (resonance tunes the hazards) build on it. D, E and H are independent of each other. I closes it out. Each phase ends with its own review loop (the code-review skill at medium on the phase's commits, fixed and re-reviewed until clean), as the issue epics before it did.
