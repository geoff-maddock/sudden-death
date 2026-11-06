# Realm adventures, phase 1 (the plumbing): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the adventure system: the data format, per-profile progress, talk, visit, match and choice steps, match conditions, the pinnacle rules, an Adventures journal tab, rumours, How to play, and the test that proves it all with throwaway adventures. No real story ships in this phase.

**Architecture:** Two new realm parts. `w65-adventures.js` is the model: the `W_ADV` table, the profile store and the step machine, hooked into `wSay`, `wEnterMap`, `wRunAct` and a new `W_ON_END.adv`. `w66-advjournal.js` is the view: the match and choice cards, the journal tab, the Bag section, rumours and How to play. `W_ADV` ships **empty**. The test registers its own adventures at runtime, so players never see a test story.

**Tech stack:** Plain JS in one global scope, Python Playwright tests.

**Spec:** `docs/superpowers/specs/2026-11-05-realm-adventures-design.md` (read it first). Read the project rules in `CLAUDE.md` ("Realm rules" especially) too.

## Global constraints

- Every top-level name starts with `w` or `W`. To wrap an earlier function, reassign it and keep the original as `wW65Name` / `wW66Name`. List what each file wraps in its header comment.
- `WG` and `RUN` stay plain JSON. Match ends dispatch by name through `W_ON_END[kind]`; never store a callback.
- Profile data goes through `pkey('sd-realm-adv')`. Nothing is saved, and no tips are shown, when `LAB` is set.
- No `alert` / `confirm` / `prompt`. Use `modal()`.
- The pinnacle warning copy is exactly: `This can't be retried.`
- Realm words only (no chimeras, snares, handlers or gene labs). `test/realm_polish.py` checks this.
- After every task: `./build.sh src/realm/manifest.txt` and `./build.sh`, then commit `dist/realm.html` (and `dist/sudden-death.html` if it changed) with the source.
- The test asserts and exits nonzero on failure, and waits on state rather than sleeping.

## Review focus

1. **A pinnacle result must survive a page reload.** Lose a pinnacle, reload, resume the journey: still lost. (Task 3's test.)
2. **Talking to a character about a keyword that belongs to an adventure step not yet live** must fall through to their normal topics and normal "no idea" answers, never reveal the step. (Task 2's test.)
3. **A tie, a forfeit or a blackout in an adventure match is a failure,** not a crash or a pass. (Task 3's test.)
4. **A profile with corrupt or missing `sd-realm-adv` JSON** must load as empty, not throw. (Task 1's test.)
5. **Starting the same adventure twice** (asking the starter again once it's active, won or lost) must not reset progress. (Task 2's test.)

---

## File structure

- Create `src/realm/w65-adventures.js`: data tables, store, step machine, talk/visit hooks, conditions, `W_ON_END.adv`, the reward recruit.
- Create `src/realm/w66-advjournal.js`: match card, choice card, the journal tab, Bag section, rumours, How to play.
- Modify `src/realm/manifest.txt`: append both after `src/realm/w64-frostwyrm.js`.
- Create `test/realm_adventure.py`, built up across the tasks.
- Modify `test/all.sh` (`CHECKS`) and `.github/workflows/ci.yml` (`CHECKS`): append `realm_adventure`.
- Modify `ARCHITECTURE.md`, Realm section: one paragraph on w65/w66.

## The data format (shared by every task)

```js
W_ADV = [ {
  id: 'adv_x', title: 'Title', teaser: 'one spoiler-free line', regions: ['hq', 'tide'],
  starter: { who: 'clerk', kw: 'charter', need: ['q_bracket'], t: 'what they say', learn: 'journal line' },
  rumours: ['an innkeeper line pointing at the starter'],
  lostText: 'the bad ending',
  chapters: [ { t: 'Chapter title', sum: 'journal summary', any: false, pay: { gold, fans, cards: [ids], items: { id: n } },
                steps: [ STEP, … ] } ],
  end: { t: 'ending text', pay: { … }, unlock: { at: 'rowe', kw: 'veteran', recruit: { kind, n, lvl? }, t: 'line' }, feat: 'djinn' },
} ]
```

Each `STEP` has `k` plus common fields `t` (what's said or shown), `learn` (a journal line, optional) and `pinnacle` (bool, optional):

| `k` | Fields | Fires when |
|---|---|---|
| `talk` | `who`, `kw`, `need?{night,season,weather}`, `tNo?`, `take?{advItem:n}`, `give?{advItem:n}` | you ask `who` about `kw` while the step is live |
| `visit` | `loc` (a `DB.locs` id), `need?{…}`, `tNo?`, `give?{advItem:n}` | you enter that loc's map while the step is live |
| `match` | `who`, `kw`, `engine: 'card'\|'ball'\|'grid'\|'ring'`, `tier`, `ids?` (card), `sport?` (card), `club?` (engines, default `'local'`), `cond?{margin, starter:{kind\|pid}, night, weather}`, `win`, `lose` | asking `who` about `kw` opens the match card |
| `choice` | `who`, `kw`, `q`, `opts: [strings]`, `right: index`, `win`, `lose` | asking `who` about `kw` opens the choice card |

The spec's `find` is a `visit` with `give`, and its `give` is a `talk` with `take`.

`W_ADV_ITEMS = { id: { n: 'Name', d: 'description' } }` holds adventure items. They live in the profile store, never in `WG.items`.

**Live steps:** in a chapter with `any: false`, the live step is the first step not done. With `any: true`, every step not yet done is live.

---

### Task 1: The store and the step machine

**Files:**
- Create: `src/realm/w65-adventures.js`
- Modify: `src/realm/manifest.txt`
- Test: `test/realm_adventure.py`

**Interfaces (produced):**
- `W_ADV` (array, empty), `W_ADV_ITEMS` (object, empty), `W_ADV_CFG = { key: 'sd-realm-adv' }`.
- `wAdvKey()` returns `pkey('sd-realm-adv')`.
- `wAdvAll()` returns `{ a: { [advId]: AS }, rec: {} }`; corrupt or missing data reads as empty.
- `wAdvSave(S)` does nothing in `LAB`.
- `AS = { st: 'active'|'won'|'lost', ch: int, done: [stepIdx], items: { id: n }, learned: [{ t, d }], since: 'YYYY-MM-DD', ended?: 'YYYY-MM-DD', why?: string }`.
- `wAdv(id)` returns the definition or null; `wAdvState(id)` returns AS or null.
- `wAdvLive(id)` returns `[{ ch, si, step }]` for the live steps; empty unless active.
- `wAdvBegin(id)` returns bool: false if the adventure is already in the store.
- `wAdvLearn(id, text)`.
- `wAdvDone(id, si)`: marks the step, applies `give`/`take` on adventure items, completes the chapter (pays it) and, after the last chapter, the adventure. Saves immediately.
- `wAdvLose(id, why)`: `st = 'lost'`, records `why` and `ended`, saves immediately, logs `lostText`.
- `wAdvPay(pay, from)`: gold to `RUN.gold`, fans to `RUN.fans`, cards via `wPayCards({ cards }, from)`, items via `wAddItem`.
- `wAdvWin(id)`: pays `end.pay`; on `end.feat`, sets `wStarsAll().un[feat]` to today's date and saves with `wStarsSave`.
- `wAdvToday()` returns the `YYYY-MM-DD` date string, as `wStarsCheck` stamps unlocks.

- [ ] **Step 1: Write the test skeleton and its first section.** Copy the setup from `test/realm_tour.py` (`check`, `CLOSE_ALL`, `WIN`, launch, `#bNew` / `#cfYes` / `#wGo`, wait for the world). Define `TEST_ADV` as a JS string that pushes these into `W_ADV` and `W_ADV_ITEMS`:
  - `adv_t1`, a test adventure:
    - starter: `{ who: 'clerk', kw: 'testcase', t: 'Funny you should ask.', learn: 'Foss has a job.' }`
    - chapter 0, steps:
      1. `{ k: 'visit', loc: 'saltmere', give: { adv_tok: 1 }, learn: 'Found a token.' }`
      2. `{ k: 'talk', who: 'rowe', kw: 'token', take: { adv_tok: 1 }, t: 'Ah, my token.' }`
      - `pay: { gold: 30 }`
    - chapter 1, steps:
      1. `{ k: 'match', who: 'clerk', kw: 'friendly', engine: 'card', tier: 1, ids: ['cheer', 'cheer'], cond: { margin: 1 }, win: 'Well played.', lose: 'Try again.' }`
      2. `{ k: 'match', who: 'clerk', kw: 'diamond', engine: 'ball', tier: 1, club: 'local', win: 'Nice.', lose: 'Again.' }`
    - chapter 2: `any: true`, steps:
      1. `{ k: 'talk', who: 'rowe', kw: 'alpha' }`
      2. `{ k: 'talk', who: 'clerk', kw: 'beta' }`
    - chapter 3, steps:
      1. `{ k: 'choice', who: 'clerk', kw: 'verdict', q: 'Who?', opts: ['A', 'B', 'C'], right: 1, pinnacle: true, win: 'Right.', lose: 'Wrong.' }`
    - end: `{ t: 'Done.', pay: { gold: 50 }, unlock: { at: 'rowe', kw: 'veteran', recruit: { kind: 'dwarf', n: 'Old Testa' }, t: 'Testa joins.' } }`
  - `adv_t2`: starter `{ who: 'rowe', kw: 'starquest' }`, one chapter with one step `{ k: 'talk', who: 'rowe', kw: 'finish' }`, and `end: { t: 'Done.', feat: 'djinn' }`.
  - `adv_t3`: starter `{ who: 'clerk', kw: 'grudge' }`, one chapter with one step `{ k: 'match', who: 'clerk', kw: 'showdown', engine: 'card', tier: 1, ids: ['cheer', 'cheer'], pinnacle: true, win: 'Won.', lose: 'Lost.' }`, and `lostText: 'It ended badly.'`.
  - `W_ADV_ITEMS.adv_tok = { n: 'Test Token', d: 'A token.' }`

  Section "store" asserts that:
  - `localStorage.setItem(wAdvKey(), '{bad')` then `wAdvAll()` returns `{a:{}, rec:{}}` without throwing;
  - `wAdvBegin('adv_t1')` is true and a second call is false;
  - `wAdvState('adv_t1')` is `{st:'active', ch:0, done:[]}` (with `since` set);
  - `wAdvLive('adv_t1')` is one step, `si: 0`;
  - `wAdvDone('adv_t1', 0)` leaves `items.adv_tok === 1` and `adv_tok` is **not** in `WG.items`;
  - `wAdvDone('adv_t1', 1)` moves to `ch === 1`, takes the token, and `RUN.gold` rises by 30;
  - setting `PROFILES.cur = 'advB'` makes `wAdvState('adv_t1')` null, and setting it back to `'guest'` restores it;
  - after `wAdvBegin('adv_t2')` and `wAdvDone('adv_t2', 0)`, `wAdvState('adv_t2').st === 'won'` and `wStarOn('djinn')` is true.

  End the file with `print('errors:', FAILS)` and `sys.exit(1 if FAILS else 0)`.

- [ ] **Step 2: Run it and see it fail.** Run `./build.sh src/realm/manifest.txt && python3 test/realm_adventure.py`. Expected: the store section fails with `wAdvKey is not defined`.

- [ ] **Step 3: Implement the Task 1 interfaces in `w65-adventures.js`.** Model the store on `wStarsAll` / `wStarsSave` (`w57-stars.js:50-56`). Write the header comment: purpose, storage shape, and what's wrapped (filled in as tasks add wrappers). Append `src/realm/w65-adventures.js` to `manifest.txt`.

- [ ] **Step 4: Run and see it pass.** Run `./build.sh src/realm/manifest.txt && python3 test/realm_adventure.py`. Expected: every "store" line is `ok` and `errors: []`.

- [ ] **Step 5: Commit.** Rebuild both pages, then:
  ```bash
  git add src/realm/w65-adventures.js src/realm/manifest.txt test/realm_adventure.py dist/
  git commit -m "Realm adventures, phase 1: the store and the step machine (#47)"
  ```

### Task 2: Talk, visit, starting and the reward recruit

**Files:**
- Modify: `src/realm/w65-adventures.js`
- Test: `test/realm_adventure.py`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `wAdvTalk(id, kw)` returns `{ text, act?, key }` or null. It handles starters, live `talk` steps, the `match` / `choice` triggers (returning `act: 'adv:<advId>:<si>'`) and unlocked recruits.
  - `wAdvNeedMet(need)` returns bool (`night` uses `wIsNight()`, `season` uses `wSeason()`, `weather` uses `wWeather(wRegionHere())`).
  - `wAdvVisit(mapId)`.
  - Wraps: `wSay` → `wW65Say`; `wEnterMap` → `wW65EnterMap`; `wRunAct` → `wW65RunAct` (only defines how `adv:` acts route; Task 3/4 fill in the cards).

**Rules:**
- Keyword matching is the same as `wFindTopic`: exact match, or a 4-letter prefix when the keyword is 4+ letters long.
- `wW65Say` asks `wAdvTalk` first. When it returns a reply, call `wJHeard(id, kw, r)` (the journal's wrapper sits inside ours and won't see it) and return the reply. Otherwise fall through to `wW65Say`.
- **Starting:** a starter fires only when its `need` flags are all set and `wAdvState(id)` is null. Asking again later falls through to normal talk.
- **Recruits:** an unlock fires for a won adventure's `unlock.at` / `kw`, once per journey (`WG.advRec[advId] = 1`), through `wRecruitTopic(unlock.recruit)`. On a later ask it says "Already with you" in the realm voice.
- **Gates:** a `talk` step whose `need` isn't met returns `tNo` (or "Not yet.") and doesn't complete.
- `wAdvVisit` is called from `wW65EnterMap` with the map id. It completes live `visit` steps whose `DB.locs` entry has that `map`, or logs `tNo` when `need` fails.

- [ ] **Step 1: Add section "talk" to the test.** On a fresh profile (`localStorage.clear()` and a new journey, as at the top), assert that:
  - `wSay('clerk', 'friendly').text` is not `'Well played.'` and returns no `adv:` act (the step isn't live, so it falls through: review focus 2);
  - `wSay('clerk', 'testcase').text === 'Funny you should ask.'`, and `wAdvState('adv_t1').st === 'active'`;
  - asking `testcase` again doesn't reset progress, after `wAdvDone('adv_t1', 0)` (review focus 5);
  - `wEnterMap('saltmere', …)` (use the arrival point of `DB.towns.saltmere`) completes step 0 with a fresh state;
  - `wSay('rowe', 'tok')` (prefix) completes step 1;
  - `wSay('clerk', 'friendly').act === 'adv:adv_t1:0'`;
  - in the `any: true` chapter (force `ch = 2` in the store), `rowe:alpha` and `clerk:beta` both work in either order and move the adventure to `ch === 3`;
  - for the recruit, force `adv_t1` to `won`: `wSay('rowe', 'veteran')` adds a roster player named `'Old Testa'`, and a second ask adds none;
  - starting a new journey (the `#bNew` flow again) leaves `wAdvState('adv_t1').st === 'won'`, and `veteran` recruits Testa again on the new journey.

- [ ] **Step 2: Run it and see it fail.** Run `python3 test/realm_adventure.py`. Expected: "talk" lines FAIL.
- [ ] **Step 3: Implement the Task 2 interfaces and wrappers** in `w65-adventures.js`, and update the header's wrap list.
- [ ] **Step 4: Run and see it pass.** Expected: "store" and "talk" all `ok`.
- [ ] **Step 5: Commit** (rebuild both pages first), with the message `Realm adventures, phase 1: talk, visit, starting and the reward recruit (#47)`.

### Task 3: Matches, conditions and pinnacles

**Files:**
- Modify: `src/realm/w65-adventures.js`
- Create: `src/realm/w66-advjournal.js` (the match card only, in this task)
- Modify: `src/realm/manifest.txt` (append w66)
- Test: `test/realm_adventure.py`

**Interfaces:**
- Consumes: Task 2's `adv:` act.
- Produces:
  - `wAdvCondText(step)` returns a list of plain sentences, e.g. `Win by at least 1.`, `Old Testa must start.`, `At night.`
  - `wAdvStartMatch(advId, si, how?)`:
    - `card`: `startMatch({ type: 'normal', tier, ids, sport, card: false, world: { kind: 'adv', ref: '<advId>:<ch>:<si>' } })`
    - other engines: `wStartBall` / `wStartGrid` / `wStartRing` with `{ club: step.club || 'local', how: how || 'play', tier, kind: 'adv', ref }`
    - Returns the engine's reason string, or `''`.
  - `wAdvMatchFacts(r, W)` returns `{ win, us, them }`:
    - card game: the last `RUN.games` entry (`us` / `them`)
    - engines: `W.us` / `W.them`
    - `win` is `r === 'win'`; a tie, `'quit'` or `'lose'` is not a win.
  - `wAdvCondMet(step, facts, W)` returns bool, checking:
    - `margin`: `us - them >= margin`
    - `starter`: the card game uses `wStarters()`; football and the ring use `W.ids`; baseball uses `WG.nine.order` ids
    - `night`: `wIsNight()`
    - `weather`: `wWeather(wRegionHere())`
  - `W_ON_END.adv(r, ref, W)`:
    - It ignores a ref whose chapter isn't the adventure's current chapter, or whose step isn't live.
    - Pass: `wAdvDone` and log `step.win`.
    - Fail on a step that isn't a pinnacle: log `step.lose`; the step stays live.
    - Fail on a pinnacle: `wAdvLose(advId, step.lose)`.
  - `wAdvMatchCard(advId, si)` (in w66) opens a `modal()` with:
    - the adventure title and `step.t`
    - the opponent and engine in plain words
    - `wAdvCondText` as a list
    - for a pinnacle, `<p class="wbad" id="wAdvWarn">This can't be retried.</p>`
    - **Play** (`#wAdvPlay`) and **Not yet** (`#wAdvNo`)
  - Wraps: `wRunAct` (w66 → `wW66RunAct`): `adv:<id>:<si>` on a `match` step opens `wAdvMatchCard`.

- [ ] **Step 1: Add section "matches" to the test.** Put `adv_t1` at `ch = 1` with nothing done, then assert that:
  - `wRunAct('adv:adv_t1:0', 'clerk')` opens a modal containing `Win by at least 1.` with no `#wAdvWarn`;
  - `#wAdvNo` closes it and nothing changes (not an attempt);
  - clicking `#wAdvPlay` starts a fight (`B` set, `RUN.pending.world.kind === 'adv'`);
  - then `WIN` makes step 0 done, provided the last `RUN.games` entry has `us - them >= 1`; if it doesn't, the step stays live, which the test asserts by forcing a game record with `us === them` and calling `W_ON_END.adv('win', 'adv_t1:1:0', { kind: 'adv' })`;
  - `W_ON_END.adv('tie', 'adv_t1:1:1', { kind: 'adv', us: 2, them: 2 })` doesn't complete step 1, and the adventure is still `active` (review focus 3);
  - `wAdvStartMatch('adv_t1', 1, 'sim')` returns `''` and the baseball game settles through `W_ON_END.adv` (a win completes step 1; a loss keeps it live; loop at most 8 times until it completes);
  - `W_ON_END.adv('win', 'adv_t1:0:0', { kind: 'adv' })` (a stale chapter) changes nothing;
  - for the pinnacle loss with `adv_t3`: begin it, open its match card and assert `#wAdvWarn` reads exactly `This can't be retried.`, then call `W_ON_END.adv('lose', 'adv_t3:0:0', { kind: 'adv' })`, after which `st === 'lost'` and `why === 'Lost.'`;
  - `wRunAct('adv:adv_t3:0', 'clerk')` no longer opens a card;
  - after a reload (`pg.reload()`, resume the journey with `wLoadSave` the way the title screen's Continue does, wait for the world), `wAdvState('adv_t3').st` is still `'lost'` (review focus 1).

- [ ] **Step 2: Run it and see it fail.**
- [ ] **Step 3: Implement the Task 3 interfaces.** Create w66 with its header and append it to the manifest.
- [ ] **Step 4: Run and see it pass.** Expected: the store, talk and matches sections all `ok`.
- [ ] **Step 5: Commit** (rebuild first), with the message `Realm adventures, phase 1: matches, conditions and pinnacles (#47)`.

### Task 4: The choice step

**Files:**
- Modify: `src/realm/w66-advjournal.js` and `src/realm/w65-adventures.js`
- Test: `test/realm_adventure.py`

**Interfaces:**
- `wAdvChoose(advId, si, i)`:
  - `i === step.right`: `wAdvDone`, and log `win`.
  - Otherwise, on a pinnacle: `wAdvLose(advId, step.lose)`.
  - Otherwise, not a pinnacle: log `lose`; the step stays live.
- `wAdvChoiceCard(advId, si)` (w66): `step.q`, one button per option (`[data-advopt="i"]`), and `#wAdvWarn` on a pinnacle. Choosing closes the card and calls `wAdvChoose`.
- `wW66RunAct` routes `adv:` on a `choice` step to `wAdvChoiceCard`.

- [ ] **Step 1: Add section "choice" to the test.**
  - Right answer: put `adv_t1` at `ch = 3`, then `wSay('clerk', 'verdict')` returns the act. The card shows 3 options and `#wAdvWarn`. Clicking option 1 makes the adventure `won`, and `RUN.gold` rises by 50.
  - Wrong answer: reset `adv_t1` to `active` at `ch = 3`, click option 0, and the adventure is `lost` with `why === 'Wrong.'`.

- [ ] **Step 2: Run it and see it fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and see it pass.**
- [ ] **Step 5: Commit** (rebuild first), with the message `Realm adventures, phase 1: the choice step (#47)`.

### Task 5: The journal tab, the Bag, rumours and How to play

**Files:**
- Modify: `src/realm/w66-advjournal.js`
- Test: `test/realm_adventure.py`
- Modify: `test/all.sh`, `.github/workflows/ci.yml`, `ARCHITECTURE.md`

**Interfaces:**
- **The journal tab.** Wraps `wOpenJournal` → `wW66OpenJournal` to append `<button role="tab" data-jadv>Adventures <small></small></button>` to `.wjtabs`.
  - Use `data-jadv`, **not** `data-jtab`: the original renderer indexes its own table by `data-jtab` and would throw on an unknown key.
  - Wraps `wRenderJournal` → `wW66RenderJournal`:
    - when `WJ.tab === 'adv'`, render the original with `WJ.tab = 'people'` for the shared parts, restore `'adv'`, and then fill `#wJBody` with `wAdvJournalHtml()`;
    - set `aria-pressed` / `aria-selected` on both kinds of tab;
    - put the count of active adventures in the button's `<small>`.
- **`wAdvJournalHtml()`** returns three sections:
  - **Under way:** the title, the chapter title, `sum`, the learned lines in order, the adventure items held, and the next match's `wAdvCondText`.
  - **Finished:** the title, `end.t`, and where the reward character lives (the `unlock.at` character's name and town).
  - **Ended badly:** the title, `lostText` and `why`.
  - Adventures not yet started aren't listed. With none at all, show: `No adventures yet. Rumours at the inns sometimes point the way.`
- **The Bag.** Wraps `wRenderCamp` → `wW66RenderCamp`: when `WCAMP.tab === 'bag'` and the profile holds adventure items, append `<div id="wBagAdv"><h4>Adventures</h4>…</div>` listing each item's name, description and its adventure's title.
- **Rumours:**
  - Every innkeeper in `W_TAVERN_INNS` gets `topics.rumours = { t: 'Folk talk. Here is what I heard.', act: 'advrumour' }`.
  - `wW66RunAct` handles `'advrumour'` by logging `"<name>: <line>"`, choosing from the `rumours` of adventures this profile hasn't started, rotating by `WG.dayAbs`. With none left it says: `Nothing worth repeating.`
  - Wraps `wOpenBoard` → `wW66OpenBoard` to add `<p class="wadvrum"><b>Heard around:</b> <line></p>` when there is a rumour (not in `LAB`).
  - **My call, replacing the spec's "nearest region" for the board:** the board uses the same daily rotation as the inns. This is simpler, and the spec marked it as my call.
- **How to play.** Wraps `renderHelp` → `wW66RenderHelp`, adding `#wHelpAdventures` with this copy:
  > **Adventures.** Some people in the Realm know the start of a longer story. Press the right person about the right thing and an adventure begins: chapters across the regions, with games to win along the way. Rumours at the inns can point you to them. Your progress stays with your profile from one journey to the next, and a finished adventure's reward is yours for good. Most setbacks can be tried again, but a few moments can't; the game tells you when.

- [ ] **Step 1: Add section "journal" to the test.** With `adv_t1` active at ch 1, `adv_t2` won and `adv_t3` lost, assert that:
  - `wOpenJournal()` then clicking `[data-jadv]` shows `#wJBody` with `Under way`, `Finished` and `Ended badly`, the three titles, and `It ended badly.`;
  - the other tabs still render (click `[data-jtab="people"]` with no page error);
  - with a test-held `adv_tok`, `wOpenCamp('bag')` shows `#wBagAdv` containing `Test Token`;
  - on a fresh profile (`PROFILES.cur = 'advC'`), `wSay('hq_inn', 'rumours')` followed by `wRunAct('advrumour', 'hq_inn')` logs one of the test adventures' rumour lines (give `adv_t1` the rumour `rumours: ['Foss has been asking odd questions.']` in `TEST_ADV`);
  - `renderHelp()` creates `#wHelpAdventures` containing `can't`;
  - `errs` is empty.

- [ ] **Step 2: Run it and see it fail.**
- [ ] **Step 3: Implement.** Append `realm_adventure` to `CHECKS` in `test/all.sh` and `.github/workflows/ci.yml`, and add the w65/w66 paragraph to `ARCHITECTURE.md`'s Realm section.
- [ ] **Step 4: Run it and its neighbours.** Run `./test/all.sh realm_adventure realm_polish realm_journal realm_audit realm_smoke realm_tour realm_stars`. Expected: `all passed`.
- [ ] **Step 5: Commit** (rebuild both pages first), with the message `Realm adventures, phase 1: the journal tab, the Bag, rumours and How to play (#47)`.

### Task 6: Full check and PR

- [ ] **Step 1: Run the full suite.** Run `./test/all.sh`. Expected: `all passed`. Read the output for `errors: [...]` lines too.
- [ ] **Step 2: Confirm both built files are current.** Run `./build.sh && ./build.sh src/realm/manifest.txt && git status --short`. Expected: no output.
- [ ] **Step 3: Push the branch and open a PR** using the PR format in the user's global CLAUDE.md (Summary with a link to issue #47, What this does, Changes, Notes, Checks). Tick phase 1 on issue #47 only after the PR merges.
