# The Frozen Deep (Old Grey) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Old Grey, a great pike under the Curling Shed's ice, in about one wild match in three: keen ice where it lies, a bump where it swims next, read by the CPU by skill (issue #108).

**Architecture:** One new engine part, `src/cr/parts/16-deep.js` (scope `wCR`), owns the state (`G.deep`), the keen ice (read by `crIceAt` and `crAccel`), the bump and the swim (called from `crThrowFinish`), the CPU's read (a sight level set around `crPlan`) and the drawing hooks. One new Realm part, `src/realm/w139-sheddeep.js`, rolls the deep for wild club matches and passes `deep: true` into `wCR.start` / `wCR.simGame` the way `u4h` passes hexes.

**Tech Stack:** plain JS in the scoped engine, Canvas 2D, Python Playwright checks.

**Spec:** `docs/superpowers/specs/2026-11-24-frozen-deep-design.md`

## Global Constraints

- Realm rules (CLAUDE.md): `w`/`W` names in the Realm; engine names `cr`/`CR` inside `scope wCR`; wraps saved as `wW139Name`; `WG` and `G` plain JSON; no alert/confirm/prompt; rebuild and commit `dist/realm.html` after every change.
- A game without the deep plays exactly as before: same seed, same game (`R()` is drawn only when `G.deep` is on).
- On only with `start({ deep: true })`; the Realm sets it only for wild club matches (`wStartShed` with no `cup`), about one in three (`W_DEEP.p = 1/3`).
- Every new system: a `test/realm_*.py` with real asserts, a line in `test/all.sh` and in ci.yml's realm list.
- Balance measured with `test/realm_shed_lab.py` (100+ games a side), numbers in `docs/realm/BALANCE.md`.
- User-facing text plain and short; How to play (`#wHelpShedGame`) gains a line.

## Review Focus

1. A bump that would push a stone off the sheet or into another: it tries half the distance, then leaves the stone be (never out of play by Old Grey).
2. A match saved and resumed mid-game with the deep, and an older save without `G.deep`: the deep comes back exactly; an old save plays without it, no errors.
3. A stone refused by the rules, or a guard put back by the free guard zone: Old Grey doesn't swim and no bump is kept.
4. Old Grey never leaves its box (far hog line to back line, inside the boards) over a long game.
5. Simulate and Play agree: the sim game with the deep bumps and reports the same way (summary's `deep`).

---

### Task 1: The engine part (state, keen ice, bump, swim, CPU read)

**Files:**
- Create: `src/cr/parts/16-deep.js`
- Modify: `src/cr/manifest.txt` (append `src/cr/parts/16-deep.js` with a comment line), `src/cr/parts/03-ice.js` (`crIceAt` times `crDeepMu(x, y)`), `src/cr/parts/04-stone.js` (`crAccel`'s `lat` times `crDeepCurl(st.x, st.y)`), `src/cr/parts/06-cpu.js` (`crPlan` runs under `crDeepSight(s, fn)`; `crTry` bumps its result when the sight is 2), `src/cr/parts/07-game.js` (`crStart` calls `crDeepStart(o)`; `crThrowFinish` bumps before `crThrow` and swims after a rule ok; the status line; `crSummary` carries `deep`; `crResume` leaves an old save's missing `G.deep` null), `src/realm/shed/exports.js` (header line and `deep`, `deepRules`, `deepSee`)
- Test: `test/realm_shed_deep.py` (engine half)

**Interfaces:**
- Produces:
  - `CR_DEEP = { reach: 30, keen: .1, curlCut: .4, bumpR: 20, bump: 6, minBump: 1.5, step: 40, turn: .9, box: { x: CR_SHEET.halfW - 24, y0: -CR_SHEET.hog + 24, y1: CR_SHEET.back - 12 } }` (numbers are first guesses; Task 3 tunes them)
  - `G.deep = { x, y, nx, ny, hd, bumps, swings }` or `null` (plain JSON)
  - `crDeepStart(o)`: `G.deep` from `R()` when `o.deep`, else `null`; sets `G.deepSaid` to Hennock's line ("Old Grey's under the ice today: the ice runs keen over him, and he bumps what lies where he swims next.") or `''`
  - `crDeepMu(x, y) -> number` (1 when off, or the sight is under 1; else `1 - keen * (1 - (d/reach)^2)` inside `reach` of `(G.deep.x, G.deep.y)`)
  - `crDeepCurl(x, y) -> number` (same shape with `curlCut`)
  - `crDeepBump(stones) -> [{ id, d }]`: pushes stones within `bumpR` of `(nx, ny)` straight away from it by `max(minBump, bump * (1 - dist/bumpR))`; tries half that if the spot is off the sheet or overlaps another stone, else leaves it; mutates `stones`
  - `crDeepSwim()`: `x, y = nx, ny`; turns `hd` by `(R() - .5) * 2 * turn`, steps `step`, reflects off the box, clamps; sets `nx, ny`
  - `CR_DEEP_SEE` (module `let`, 2 normally) and `crDeepSight(s, fn)`: runs `fn` with the sight set to side `s`'s read (skill 0 → 0, skill 1 → 1, skill 2 and the Lich → 2), restores it in `finally`
  - `crDeepSay(bumps, teams) -> string` ("Old Grey turns under the ice and nudges Saltmere's stone 4 inches." / "…nudges two stones.")
  - summary `deep: null | { bumps, swings }` (swings: bumps that changed the end's score as the stones lay, `crScoreEnd` before and after)
  - exports: `deep` (getter: a copy of `G.deep` or null), `deepRules` (a copy of `CR_DEEP`), `deepSee(s)` (the sight level side `s` plans with), `deepMu(x, y)`

- [ ] **Step 1: Write the engine checks** in `test/realm_shed_deep.py` (the shape of `test/realm_shed_tilda.py`: `check(ok, what, detail)`, FAILS, exit nonzero). Through `wCR` on the built page:
  - `start({ seed: 7 })` gives `G.deep === null`; `start({ seed: 7, deep: true })` gives `x, y, nx, ny` inside the box and `|next - here|` within `step + 1`.
  - `simGame({ seed: 11, ends: 4 })` and `simGame({ seed: 11, ends: 4, deep: false })` have the same log (the deep off draws nothing).
  - keen ice: with the deep on, `deepMu(G.deep.x, G.deep.y)` is `1 - keen`, `deepMu` 40 inches off the reach is 1; a lone stone through the patch (`run([], th, { ice: G.ice, cold: 'mid' })` aimed at `(G.deep.x, G.deep.y)`) stops further than with `G.deep = null`.
  - bump: a stone set 5 inches from `(nx, ny)` moves away from it by 1.5 to 6 inches after a thrown stone that comes to rest elsewhere; Old Grey is then at the old `(nx, ny)`.
  - limits: a stone against the boards inside `bumpR` stays on the sheet; two touching stones don't overlap after a bump.
  - a stone refused (out of turn through `throwStone`) leaves `G.deep` unchanged.
  - 300 stones of `simGame({ deep: true })` over several seeds: Old Grey stays inside the box (checked through a wrapped `crDeepSwim` in the test, or by sampling `G.deep` after each `turn()`).
  - sight: on a game with skills `[0, 2]`, `deepSee(0) === 0`, `deepSee(1) === 2`; skill 1 gives 1.
  - `snapshot()` then `resume()` keeps `G.deep` identical; a snapshot with `deep` deleted resumes with `G.deep` null and plays a stone without error.
  - summary `deep` has `bumps` and `swings` numbers when on, `null` when off.
- [ ] **Step 2: Run it**: `python3 test/realm_shed_deep.py`. Expected: FAIL (no `deep` export).
- [ ] **Step 3: Write `16-deep.js` and the hooks** to the interfaces above. In `crThrowFinish`: `const bumps = G.deep ? crDeepBump(run.stones) : []` before `crThrow` (score before and after for `swings`); after `rule.ok`, `crDeepSwim()` and count; the status line appends `crDeepSay`. `crTry` applies `crDeepBump` to a copy of its result (without counting) when `CR_DEEP_SEE >= 2`.
- [ ] **Step 4: Build and run**: `./build.sh src/realm/manifest.txt && python3 test/realm_shed_deep.py`, then `python3 test/realm_shed.py && python3 test/realm_shed_game.py && python3 test/realm_shed_call.py`. Expected: all ok (the old checks unchanged: the deep is off there).
- [ ] **Step 5: Commit** `src/cr`, `src/realm/shed/exports.js`, `test/realm_shed_deep.py`, `dist/realm.html`.

### Task 2: The page and the Realm

**Files:**
- Modify: `src/cr/parts/09-draw.js` (`crDeepDraw(c)` on the sheet view under the stones, `crDeepHouseDraw(c)` in the house view, a mark on the strip), `src/cr/parts/08-play.js` (the opening message adds `G.deepSaid`)
- Create: `src/realm/w139-sheddeep.js` (after `w131-shedtilda.js` in `src/realm/manifest.txt`)
- Modify: `test/realm_shed_deep.py` (Realm half), `test/all.sh` and `.github/workflows/ci.yml` (add `realm_shed_deep` after `realm_shed_tilda`)

**Interfaces:**
- Consumes: Task 1's `G.deep`, `G.deepSaid`, `CR_DEEP`.
- Produces: `W_DEEP = { p: 1 / 3 }`, `WDEEP = { next: false }`; wraps `wStartShed` (`wW139StartShed`: rolls `Math.random() < W_DEEP.p` when `!o.cup`, sets `WDEEP.next`, clears it in `finally`), `wCR.start` and `wCR.simGame` (`wW139Start`, `wW139SimGame`: add `deep: true` when `WDEEP.next`), `renderHelp` (`wW139RenderHelp`: a paragraph in `#wHelpShedGame` naming Old Grey, the keen ice, the ring where he goes next, wild matches only).

Drawing (canvas state in `save()`/`restore()`): the keen ice a soft lighter ellipse of radius `reach` at `(x, y)`; Old Grey a long dark translucent body (about 34 by 11 inches, along `hd`) with a tail that swings with `CRC.t`; the next spot a dashed ring of radius `bumpR`.

- [ ] **Step 1: Add the Realm checks**: with `Math.random` forced to 0, a club match from `wStartShed({ club, how: 'play' })` has `wCR.G.deep` set and Hennock's line in `wCR.msg`; forced to .99 it has none; a Brass Broom round and a league fixture (`cup: true`) never have it even forced to 0; the exhibition (`wShedGame({})`) has none; Simulate forced to 0 returns a result with the deep (`wCR.simGame` spied: its opts carry `deep: true`); after a bump in a played match the status line names Old Grey; How to play's `#wHelpShedGame` names Old Grey; drawing a frame with the deep on throws nothing (no page errors) and a screenshot is saved to `/tmp/shed-deep.png`.
- [ ] **Step 2: Run**: expected FAIL.
- [ ] **Step 3: Implement** the drawing, the message and `w139-sheddeep.js`.
- [ ] **Step 4: Build, run** `realm_shed_deep`, `realm_shed_world`, `realm_shed_cup`, `realm_shed_feel`, `realm_umbral_curling`; look at `/tmp/shed-deep.png`.
- [ ] **Step 5: Commit** with `dist/realm.html`.

### Task 3: Balance and docs

**Files:**
- Modify: `test/realm_shed_lab.py` (part `deep`, in the default list), `docs/realm/BALANCE.md`, `ARCHITECTURE.md` (the `scope wCR` row: `16-deep.js`; a `w139-sheddeep.js` row), `docs/realm/CONTRACT.md` (the deep's start option, `G.deep`, exports), `CLAUDE.md` (the curling lab line names the deep), `test/ci-times.txt` not needed (a new check counts as the median).

- [ ] **Step 1: Lab part `deep`**: N games each, deep on and off, for Knight v Knight (equal fours), Archmage v Knight, Knight v Squire; report win rate, points per end, bumps and swings per game.
- [ ] **Step 2: Run** `python3 test/realm_shed_lab.py 120 '' deep`. Target: equal sides stay within noise of 50%; a skill gap may widen a little; swings a few per game at most. Tune `CR_DEEP` if not, re-run, and re-run `realm_shed_deep`.
- [ ] **Step 3: Docs** as listed, with the numbers.
- [ ] **Step 4: Commit** (rebuild realm first).

### Task 4: Review and PR

- [ ] Code review of the branch (fresh reviewer), fix, re-review until clean.
- [ ] Full `./test/all.sh` before the PR (the memory rule), then push and open the PR (Summary / What this does / Changes / Notes / Checks), linking #108.
