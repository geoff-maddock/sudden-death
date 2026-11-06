# Realm adventures: design

Issue #47. Agreed with Geoff on 2026-11-05. Anything marked **(Claude's call)** was decided by the writer, not by Geoff, and is open to change.

## Why

Right now the Realm plays as a sports season: wild games, four cups, dungeons, then the Crown. Its side quests are one or two steps in a single town. Adventures add long stories that cross the whole map, with characters who come back, a mystery or a hunt, and chapters that build on each other. They make the Realm playable as an RPG with a plot, and sport stays at the centre of the story: you get a clue by winning the right game, and people talk once you've beaten them at their own sport.

## What Geoff decided

1. **Progress belongs to the profile, not the journey.** If a journey ends halfway through an adventure, the next journey on the same profile picks up exactly where it stopped. Other profiles, and Guest, have their own progress.
2. **Finishing is permanent.** A finished adventure stays finished on that profile, and its final reward is kept for good.
3. **Reward characters work like superstars.** Finishing unlocks the character. They live permanently in one fixed place in the Realm, and on any later journey you go there and recruit them like any other recruit.
4. **Two kinds of step.**
   - **Retryable:** anything it makes sense to try again. If you lose a Friendly, challenge them another day. If you miss low tide, wait for the next one. Failing costs time, nothing more.
   - **Pinnacle:** a decisive moment or choice. If you lose it or get it wrong, the adventure is **lost**. There's no retry and no restart on that profile. The journal keeps it as a story that ended badly. Another profile can still play it in their own game.
   - **Warn plainly.** Before a pinnacle (on the pre-game card, or on the choice screen), the game says in plain words that this can't be retried.
   - **Not every story can be lost.** The Marigold's Crew has no pinnacle: its last game pays out win or lose, and a win gets the better ending. In The Fixed Game, only naming the fixer is a pinnacle; the grudge final can be replayed until you win.
5. **Starting.** An adventure begins only when you take up a conversation with the right person about the right thing. Nothing is announced and no letters are sent. **Rumours can point you there:** innkeepers and notice boards, the way they track the Barnstormers (`w32-tour.js`).
6. **Size.** There's no length target. Several adventures can run at once, and you can finish more than one in a journey.
7. **Which stories, in order:** The Lost Charter, The Marigold's Crew, The Fixed Game, as written in issue #47 (with the changes noted under "Story notes" below).
8. **Superstars.** An adventure's ending *may* also count as a superstar's feat. The format has to allow it. **(Claude's call:** none of the first three do this; they reward their own characters and trophies.)

## Goals

- The three stories, playable start to finish, each visiting at least three regions and bringing back characters you met earlier.
- Steps that use every engine: the card game, baseball, football, the ring.
- A journal tab a player can come back to after a week away and know what they're doing.
- Story steps that change neither the season nor the Crown. The two never block each other.

## Non-goals

- New regions. Adventures use the existing map, towns, sites and characters, plus a few new places and items.
- Dialogue trees. Talk stays keyword-based, as it is now.
- Announcements, quest givers with "!" markers, or auto-tracking. Discovery is part of the game.

## Anti-goals (failures even if it all works)

- **Rewards that make the Crown trivial.** They're measured with the realm lab before shipping.
- **Spoilers.** How to play, and the journal before you get there, must not give the story away.
- **Save-scumming a pinnacle.** Reloading a journey save must not undo a pinnacle result (see "Storage").
- **Words outside the realm vocabulary.** No chimeras, snares, handlers or gene labs; `test/realm_polish.py` checks this.

## How it fits the existing code

These systems already exist and the design builds on them (file references are in `src/realm/`):

- **Talk topics** (`DB.chars[id].topics`, `wSay`, `w3-state.js:316`) with `need` / `set` / `take` / `give` / `once` / `act`. Side quests advance through `WG.flags`.
- **The per-profile store** used by the superstars: `pkey('sd-realm-stars')`, `wStarsAll` / `wStarsSave` (`w57-stars.js:50`), with no saving in `LAB`. Superstar meetings are `act: 'star:<id>'` → `wOpenStar` (`w58-starsign.js`).
- **Match ends.** A custom `kind` with a `ref` gets its own `W_ON_END[kind]` handler. The card game goes through `wDispatchEnd` (no score there; read the last `RUN.games` entry, as `wNoticeFacts` does). Baseball (`wBallSettle`), football (`wGridSettle`) and the ring (`wRingSettle`) set `W.us` / `W.them` and call `W_ON_END[W.kind]` directly. The cups already use this (`dcup`, `gcup`, `bcup`).
- **Notice contracts** already check conditions after a match (`wNoticeMet`, `w27-notices.js:118`): sport, night, margin, club, ground.
- **Places:** `DB.locs` with `hidden` clue flags, time (`wIsNight`), season (`wSeason`) and weather (`wWeather`). There's **no tide** yet.
- **Rumours** from innkeepers and on notice boards (`w32-tour.js`).
- **The journal** (`w19-journal.js`, tabs People / Places / Victories / Quests). No later part adds a tab yet.
- **Every character the stories need already exists:** Foss (`clerk`), Vesper, Rowe, Marrowbone, Halvard, Marco Fine (`bookie`), Hermit Oak (`hermit`), Herald Pim. So do the places: Hollow Shrine, Marigold wreck, Deep Seam, Frozen Chapel, Crown Coliseum, the Anvil Ring.
- **Known gap:** the Frozen Chapel bell's `ring.set: 'rq_aur2'` is never actually set (`wUse` ignores it). The Charter's chapel step will need `wUse` to honour `set`; fix the gap at the same time.

## The adventure format

Adventures are declared as data, like `DB.sideplots`, in a table `W_ADV` (**Claude's call** on the name). Each one has:

- `id`, `title`, a one-line spoiler-free `teaser` for the journal, `regions` (for the region count), and `starter`: the character and keyword that start it.
- `rumours`: lines innkeepers and notice boards use to point at the starter.
- `chapters`, in order. Each has a title, a journal summary, `steps` and an optional `pay`.
- **Steps**, done in order within a chapter unless marked `any` (for example, the four charter pieces can be gathered in any order). Each step has a `kind`:
  - `talk`: a character and a keyword, with an optional `need` on time, season or weather.
  - `visit`: a place, with optional gates for night, season, weather or tide.
  - `find`: an item at a place (a chest, a bell, a grave).
  - `give`: carry an adventure item to a character.
  - `match`: a game with **conditions** (below).
  - `choice`: pick from options (for example, name the fixer). One is right.
  - Every step has `pinnacle: true` or not. Without it, the step is retryable.
- `end`: the final reward, and an optional `feat: '<starId>'` so the ending can count as a superstar's feat.
- `lostText`: the bad ending the journal shows.

Talk steps hook into the existing talk system: an active adventure adds topics to characters while its step is live, and removes them once that step is done. **(Claude's call:** the builder decides whether to add them to `DB.chars` at runtime or to answer through a wrapper around `wFindTopic` / `wSay`, as long as the world data isn't changed permanently.)

## Match conditions

A `match` step names the opponent and where the game is played, plus any of these:

- `engine`: `card` | `ball` | `grid` | `ring`
- `sport` (for the card game)
- `margin`: win by at least N
- `starter`: a named player, or a kind, in the starting side
- `night`, `weather`
- `oldRules`: no gear and only basic cards (the Charter's Hollow Shrine game). It needs a card-game `fightStart` hook. **(Claude's call:** this comes in phase 2, not phase 1.)
- `pinnacle`

The game starts with `kind: 'adv'` and `ref: '<advId>:<chapter>:<step>'`. A single `W_ON_END.adv` handler checks the result against the conditions and advances the step, retries it, or loses the adventure. The pre-game card and the journal state the conditions before kickoff, so the player always knows what counts.

**What counts as failing. (Claude's call.)**
- A match is passed only if you win *and* meet every condition. Winning without meeting a condition (a margin, a starter) counts as a failure, and on a pinnacle that loses the adventure.
- Backing out at the pre-game card ("Not yet") isn't an attempt.
- A match that ends unfinished (a forfeit or a blackout) counts as a loss.

## Storage

- **Profile store:** `pkey('sd-realm-adv')`, plain JSON. For each adventure: its state (`active` | `won` | `lost`), the chapter and step, the adventure items held, what's been learned (journal lines), start and end dates, and, once won, `unlocked`. Nothing is saved in `LAB`.
- **Adventure items live in the profile store, not `WG.items`,** because `WG.items` resets with every journey and the charter pieces must not. They still show in the Bag. **(Claude's call:** in their own Adventures section.)
- **Written at the moment it happens.** Every step result, and above all every pinnacle, is saved to the profile store right away. That way reloading a journey save can't undo a loss. **(Claude's call.)**
- **Chapter rewards** (gold, cards, fans, ordinary items) go to the journey you earn them in, through the usual `WG` / `RUN` paths.
- **Final rewards** are unlocks in the profile store. On every later journey, the unlocked character waits at their fixed place and recruits through a topic `act`, like `wOpenStar` / `wSignStar`. **(Claude's call:** a trophy or Hall of Fame card works the same way. The character who gave it hands it to you again on each later journey when you ask, so "kept for good" covers non-player rewards too.)

## Discovery and rumours

- The starter's keyword only shows up in that character's talk. It's never listed anywhere before you've heard it.
- Innkeepers (`W_TAVERN_INNS`) and notice boards each carry one rumour line for an adventure the profile hasn't started yet. **(Claude's call:** innkeepers rotate their rumour daily; the board shows the one for the nearest region.) Once you've heard it, the journal's People tab records the hint, just as the Quests tab records keywords now.

## The journal: an Adventures tab

A new journal tab, added by reassigning `wOpenJournal` / `wRenderJournal`. It has three sections:

- **Under way:** the chapter title, what you know so far (the learned lines, in order), where to go next in plain words, the adventure items found, and the conditions of the next match if there is one.
- **Finished:** the ending, the reward, and where the reward character lives.
- **Ended badly:** the `lostText` and the pinnacle that went wrong.

Adventures you haven't started don't appear at all.

## How to play

A `#wHelpAdventures` section explains what adventures are, that progress stays with your profile, that some moments can't be taken back, and that rumours at inns can point the way. It names no stories, characters or steps.

## Story notes (changes to the issue's drafts)

- **The Fixed Game:** naming the wrong fixer is a **pinnacle**. The adventure is lost, and the trail no longer just "goes cold for a week" as the issue says. The grudge final is retryable.
- **The Marigold's Crew:** no pinnacle. The last game at the Crown pays out win or lose (the veteran joins either way), and a win gets the better ending text.
- **The Lost Charter:** the four regional pieces are an `any`-order chapter. The Marigold wreck "at low tide, after dark" needs a **tide**. **(Claude's call:** two low tides a day, derived from the clock, shown in the wreck's description and the journal. Phase 2.) The pinnacle is the exhibition at the Crown Coliseum under the founding rule.
- **Superstar feats:** none in these three (decision 8).
- **The fixer is an authored person, not one of the eight clubs. (Claude's call.)** Rival clubs are drawn fresh every journey, so a fixed culprit club would sometimes be your own club or missing from the league. Instead, the fixer (a new character) pays whichever rival club fits on the current journey. The journal's learned lines name the fixer and "the club they're paying", never a club by name, so progress carried across journeys stays true. The grudge final is against the club the fixer is paying on the journey you reach it. The reward player is one of the fixer's own people, authored, with a fixed home.
- **Starting conditions. (Claude's call.)** The Charter's starter needs `q_bracket`, and the Crew's needs `q_shiplog`, but only to start. Once a story is under way on the profile, later journeys skip those prerequisites. The Fixed Game starts from a new keyword with Marco Fine, not his existing `LONG` topic, so it has no three-cup gate.

## People and recruits

- **New characters are allowed. (Claude's call.)** The stories need people who don't exist yet: the crew members, the referee, the pit fighter and the fixer. Place them in existing towns, sites and grounds. Where an existing character fits without changing their current quests, use them (for example Ash Peregrine, a harpy in Cindermaw, or Ingrith, an elf in Rimewatch). The non-goal is about new regions, not new people.
- **Reward characters. (Claude's call.)** Each one has a signature card and joins at the team's level (as `wStarLvl` does), for a price set in the balance phase. They don't count against the one-superstar-per-journey limit; adventure recruits have their own limit of one each. The Crew's veteran is one fixed character with a fixed home. The player doesn't choose, which keeps decision 3 simple.
- **Non-player final rewards. (Claude's call.)** A trophy or Hall of Fame card is handed back on each later journey (see Storage). The Fixed Game's fan boost happens once, on the journey you finish it, because fans belong to a journey. Its League honour shows permanently on the Team screen. The balance phase measures what the repeatable rewards are worth.

## Tests

- `test/realm_adventure.py` (phase 1) runs a tiny test adventure and asserts that:
  - the starter keyword starts it and rumours point to it;
  - steps advance, and a retryable failure lets you try again;
  - a pinnacle failure loses it for good;
  - progress survives a new journey on the same profile;
  - another profile starts fresh, and reloading a journey save doesn't undo a pinnacle;
  - the journal tab and How to play render;
  - there are no page errors.
- `test/realm_adventure_charter.py`, `_crew.py` and `_fixed.py` (phases 2–4) each play their story start to finish. The Charter and The Fixed Game also test their losing path (the pinnacle failed, the story ends badly, and it stays lost on a new journey). The Crew tests both endings of its last game.
- Each test is added to `test/all.sh` and to `.github/workflows/ci.yml`. They use real asserts and wait on state, not sleeps.

## Balance

Measure the final and chapter rewards with `test/realm_lab.py` (and the diamond, gridiron and ring labs for the reward characters), using 100+ runs with and without each reward. Report before and after in the PR. A finished adventure may help, but must not make the Crown trivial.

## Phases

1. **The plumbing:** the format, the profile store, match conditions (except `oldRules`), the Adventures journal tab, rumours, How to play, the tiny test adventure, and `test/realm_adventure.py`.
2. **The Lost Charter:** `oldRules`, the tide, the chapel bell fix, and the Founder's trophy and Hall of Fame card.
3. **The Marigold's Crew:** steps in every engine, and the veteran reward character.
4. **The Fixed Game:** clues, the `choice` pinnacle, the grudge final, and the fixer's best player as a recruit.
5. **Balance and polish:** reward measurement, optional map markers (off by default), and a pass over the writing.

Each phase is its own PR, and rebuilds and commits `dist/realm.html`.

## Left to the builder

- The file layout: new realm parts start at `w65-…`, use `w`/`W` names, and wrap with `wW65…` saved originals, listed in each file's header.
- Exactly how talk steps hook into topics (above).
- Wording, as long as it's plain, short and specific.
- The tiny test adventure's content.
