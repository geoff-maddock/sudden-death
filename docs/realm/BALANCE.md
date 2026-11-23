# Realm balance (phase 7)

How the Realm was measured and tuned, and how to measure it again.

## The bot

`test/realm_lab.js` plays a whole journey using the realm's own functions:

- `startMatch` for wild games, cups, rooms and alphas;
- the realm's `finishFight` and `backToMap`, so rewards, XP, recruits and blackouts happen as they do for a player.

Only the fight is played without the screen. Instead of walking, it follows a fixed route:

1. 4 wild games in the plains and 2 in the Mosswold
2. Mosswold Cup
3. the Hatchery, then the Elder Grove lair
4. 2 Brinefen wild games, the Brinefen Cup, Emberdeep, then the Aurora Roost lair
5. 2 Cindermaw wild games, the Cindermaw Cup, then the Sealed Vault
6. 2 Frostspire wild games, the Frostspire Cup, then the Deep Seam
7. the Crown, in championship week

Between matches it does what a player would:

- **Rests:** sleeps at an inn below 70% HP.
- **Recruits:**
  - signs post-game recruits and tavern agents who outrank a starter;
  - starts the three highest levels, one of each kind.
- **Picks cards:** takes the rarest card from every pick.
- **Shops:** buys uncommons and rares at the card vendors and trades basic cards away, keeping 150 gold back.
- **Enchants:** spends energy at the enchanter.
- **Eats:** has the region's best meal before cup rounds and bosses.

When it loses (a blackout), it plays a couple of wild games and tries again, up to 3 times. After that the run counts as **stuck** at that stage. In Hardcore, a loss is **dead**. `{"dumb": true}` swaps in the careless bot from `test/lab.js`, which plays any card at any target.

```bash
python3 test/realm_lab.py 140                          # skilled
python3 test/realm_lab.py 140 '{"dumb": true}'         # careless
python3 test/realm_lab.py 140 '{"hardcore": true}'     # a loss ends the journey
python3 test/realm_lab.py 140 '{}' 'W_RENOWN.hpPer = .12'   # try a number: JS run in the page first
```

Other options:

- `meals`, `recruit` and `shop` (each `false` to turn it off);
- `night` (the share of wild games played at night);
- `retries`;
- `route`.

It prints:

- the champion rate;
- where the other runs ended;
- per stage: how many runs reached and cleared it, and their day, max HP, gold, deck and starter level on arrival;
- per match: win rate, HP lost (as a number and as a share of max), turns and level.

`test/realm_bot.py` (in the quick suite) runs four journeys and checks that they finish cleanly.

## What it found

| Before the retune (140 runs) | Skilled | Careless | Hardcore (skilled) |
|---|---|---|---|
| Champion | 86% | 28% | 43% |
| Where runs ended | all at the first cup | almost all at the first cup | the Mosswold and the first cup |

The first cup was the only wall. After it, nothing lost: every match from the second cup to the Crown final was won 100% of the time, and bosses cost under 20% of max HP. Taking out one reward source at a time found three causes:

- **Trophies.** Sudden Death pays a trophy for every elite or rival win, and a Sudden Death run meets a handful of elites. A realm journey plays about 25. Teams held 8 trophies by the Elder Grove and 23 by the Crown.
  - With no new trophies at all, only 14% of runs ended as champion.
  - Slower XP or less HP per level changed almost nothing on their own.
- **Enemies stopped growing.** They only scaled by tier (1 to 3) and a level of at most 4, which gives +32% HP. The team kept growing, through levels, max HP, gear and legends.
- **Levels came too fast.** Starters reached the cap of 10 by the second cup, half way through, so level-ups stopped there and late matches tested the deck, not the player. Late in the journey, the careless bot's survivors won about as often as the skilled bot.

## The retune

| Change | Where |
|---|---|
| No trophy for an ordinary elite or rival win in the realm. Bosses, strongboxes and lairs still pay. | `w12-renown.js` |
| **Renown:** each cup won and each boss beaten gives foes +15% HP, and every 2 points +1 Strength. It is shown on the pre-game card and explained in How to play. | `w12-renown.js` (`W_RENOWN`) |
| Cup tiers by cups already won: `[1, 2, 3, 3]`, was `[2, 2, 2, 3]`. The first cup is the way in, and the later ones are harder. | `w11-cups.js` (`W_CUP.tier`) |
| XP to the next level: `10 + 10×lvl + 2×lvl²`, was `10 + 10×lvl`. Level 9 to 10 now takes 262 XP, and level-ups last until about the fourth cup. | `w6-party.js` (`wXpNeed`) |

Variants measured and not used:

- slower XP across the board, which only made the first cup harder;
- 1 HP per level instead of 2;
- a level per cup instead of per two;
- renown at 10% and at 20% a point;
- tier 1 for the Mosswold.

## After (140 runs each)

| | Skilled | Careless | Hardcore (skilled) | Skilled, no meals | Skilled, no recruiting |
|---|---|---|---|---|---|
| Champion | **72%** | **15%** | **17%** | 56% | 58% |

Where the runs that were not champion ended:

| Bot | Ended at |
|---|---|
| Skilled | the Hatchery 15, the Crown 13, the first cup 5, the Deep Seam 3, the Sealed Vault 3 |
| Careless | the first cup 57, the Hatchery 54, the Sealed Vault 4, the Deep Seam 4 |

Single matches, skilled bot (win rate, and HP lost as a share of max):

| Match | Before | After |
|---|---|---|
| Mosswold wild game | 91%, 36% | 88%, 32% |
| First cup, round 3 | 74%, 67% | 86%, 48% |
| Hatchery boss (the cube) | 97%, 49% | 59%, 77% |
| Brinefen Cup, round 3 | 100%, 9% | 100%, 21% |
| Aurora Roost (the banshee) | 100%, 14% | 79%, 59% |
| Cindermaw Cup, round 3 | 100%, 3% | 98%, 44% |
| Sealed Vault boss (the mirror) | 100%, 15% | 86%, 55% |
| Frostspire Cup, round 3 | 100%, 11% | 96%, 42% |
| Deep Seam boss (the wyrm) | 100%, 18% | 77%, 73% |
| Crown final (Apex's boss) | 100%, 20% | 55%, 78% |

The shape is now:

1. a filter early: the Mosswold, the first cup and the first boss;
2. a breather: the Brinefen Cup, Emberdeep and the Grove;
3. a climb to the Crown, with the bosses as the peaks.

Some numbers from the after run:

- Skilled bot: about 3.3 blackouts per journey, at about 49 matches a journey.
- Max HP at the Crown is 141 (151 before). Starters reach level 10 at about the fourth cup (the second cup before).

Meals are worth about 16 points of champion rate and recruiting about 14.

## Caveats

- **These are relative numbers.** A careful human beats the bot by a wide margin.
- **Noise:** at 140 runs, a win rate is good to about ±4 points. Compare HP lost and where runs end, which move less than the win rate.
- **The route is fixed.** A player who grinds more wild games, or takes the dungeons in a different order, will find it easier. Every journey here is the same 16 stages.
- **Gold still piles up:** about 800 at the Crown, even with the shops.
- **Rare stalls:** a deck that can't out-hit a regrowing Troll Grinder plays out its 80 turns as a loss. This happens about once in 7,000 matches.
- **Not measured yet:**
  - night share, ambushes and road events (the bot plays no events);
  - card shop prices;
  - the gear charges the enchanter can buy;
  - camping out (the bot sleeps at inns; it never camps).

## The home ground (epic 2, phase 1)

The ground is meant to soak up the gold that piled up (about 800 at the Crown) without making the realm easier. The bot buys one at the first cup or dungeon stop with 250 gold to spare. That turns out to be Saltmere in about 80% of runs; about 20% never get there. Once a stage it goes home to build, drill and sleep.

| 140 runs each, skilled bot with meals | Champion | Gold at the end |
|---|---|---|
| No ground, batch 1 | 67.1% | 559 |
| No ground, batch 2 | 63.6% | 568 |
| Ground, batch 1 | 62.1% | 451 |
| Ground, batch 2 | 67.1% | 446 |
| Ground, without the scout's office | 60.0% | |

- **Pooled:** 65.4% without the ground against 64.6% with it. The ground is neutral for the bot, and it spends about 120 gold more a journey.
- **Home matches:** about 3 a journey, won 98% of the time. The home region is one of five, and the Crown is neutral, so the stands decide little.
- **Buying early is a trap.** A bot that bought at the first chance (about 210 gold, at the Mosswold Cup) fell to 57%. The first boss went from 61% to 52%, because it had no gold left for cards or a meal. A player who buys with spare gold loses nothing.
- **The scout's office** is not the cause of anything: without it, 60%, within the noise.

## Personal quests and bonds (epic 2, phase 2)

The bot takes every quest on when offered and turns it in only when the route passes the player's hometown (no detours), so it finishes about 2 a journey. It picks combo cards at random; because it reorders the lineup by level, many pairs form, and it ends with about 3.7 combo cards.

| 140 runs each, skilled bot with meals | Champion |
|---|---|
| Neither, batch 1 / batch 2 | 67.9% / 66.4% |
| Quests only | 65.7% |
| Chemistry only | 68.6% |
| Both, batch 1 / batch 2 | 71.4% / 73.6% |
| Both, strong at 16 instead of 12, batch 1 / batch 2 | 77.1% / 80.0% |

- **Pooled:** 67.1% with neither (280 runs), 75.5% with both (560 runs, either threshold).
- **Each alone is neutral**, within the noise. Together the measured lift is about 5 to 8 points, but identical settings varied by about 9 points between batches here, so treat the size as rough.
- **Raising the threshold to 16 did not cut the combo cards** (3.3 a journey), so it is not the lever; the strong pair stays at 12.
- **The cap (Geoff's call):** a team holds 2 combo cards at most (`W_BOND.maxCombos`). With it: 67.9% and 76.4% (pooled 72.1%, 280 runs), against 67.1% with neither. The noise between identical batches is as large as the effect, so all we can say is that quests and chemistry together add a few points at most.

## The league and rivals who act (epic 2, phase 3)

The bot refuses every bid (keeping the player) and plays the grudge on its next wild stop; it never sees a taunt it can act on, but takes the revenge gold when it wins round 3.

| 140 runs each, skilled bot with meals | Champion | Grudge matches a journey |
|---|---|---|
| Batch 1 | 67.1% | 0.49 |
| Batch 2 | 75.0% | 0.58 |

- **Pooled:** 71.1% (280 runs), against 72.1% before this phase: neutral. Bids come rarely (a rival must lose to you twice, and you need a bench), so about one journey in two sees a grudge match.

## Baseball (issue #4, phase 6)

`test/realm_diamond_lab.py` plays ball games and Diamond Cups on Brimstone Diamond's own engine, headless (`wBD.sim`, about 180 ms a game). Both sides are on the CPU at the same skill, so this measures **Simulate**: the result comes from the players' ratings, and a tier's CPU skill makes no difference to it. When you Play or Manage, you take the CPU's place on your side, and the CPU skill (Squire, Knight, Archmage by tier) is what you face.

```bash
python3 test/realm_diamond_lab.py 120                                  # 120 games at each level gap, and 120 cups
python3 test/realm_diamond_lab.py 120 'W_BALL.oppBonus = { 1: 0, 2: 0, 3: 2 }'   # try a number: JS run in the page first
```

Part 1 plays a fresh five-player journey at level 3 against a rival's nine at that level plus a gap. Part 2 enters a Diamond Cup at level 3 and simulates every round.

**What it found: levels barely move a ball game.** A level is one rating point on one of five ratings (1 to 12), as in Brimstone Diamond's seasons. Even three levels down, a nine wins about 41% of the time, so the cup's later rounds were no harder than the first. Ratings do matter, though:

| The other nine has | Win rate at an even level (100–120 games) | Cups won by simulating |
|---|---|---|
| nothing extra (before the retune) | 49% | 16.7% |
| +1 to every rating | 31% | 1% |
| +2 to every rating | 15% | 1% |

**The retune.** `W_BALL.oppBonus = { 1: 0, 2: 0, 3: 1 }`: at tier 3 (the outer regions' rivals, and the cup final), the other nine has +1 to every rating. The level step (their level is yours plus the tier minus 1) stays.

| 120 games each | Before | After |
|---|---|---|
| tier 1 | 46% | 49% |
| tier 2 | 54% | 56% |
| tier 3 | 47% | 32% |
| cup quarter-final (tier 1) | 47% | 52% |
| cup semi-final (tier 2) | 59% | 63% |
| cup final (tier 3) | 61% | 23% |
| cups won | 16.7% | 7.5% |

A simulated cup costs about 8 gold on average (the 40 gold fee against the 150 gold prize) and pays about 112 XP across the roster. With 120 games a cell, a rate is good to about ±9%. A player who plays the pitches beats Squire and Knight far more often than a coin flip; nobody has measured that yet.

## Training spots (issue #6, phase 4)

The bot drills a card and answers the challenge at each spot in every town it stops in, once a week (`opts.spots`). 140 journeys each, skilled bot, meals on:

| | Champion rate | Gold at the Crown | Stuck at the Hatchery |
|---|---|---|---|
| Spots off | 73.6% | 582 | 16 |
| Spots on | 77.9% | 652 | 10 |

About +4 points, inside the noise of two 140-run samples. The free Practice ★ helps most early (the Hatchery), and the prize money adds about 70 gold by the Crown. No retune.

## Notice boards (epic 2, phase 4)

At every town it stops in, the bot takes the best-paying contracts the route can meet (not ground games, which the route never plays), up to three (`opts.notices`). 140 journeys each, skilled bot:

| | Champion rate | Contracts done | Gold at the end |
|---|---|---|---|
| Boards off | 75.7% | 0 | 631 |
| Boards on, first pay table | 81.4% | 12.8 (4.4 lapsed) | 1,172 |
| Boards on, gold halved (shipped) | 76.4% | 11.9 (4.8 lapsed) | 853 |

The first pay table nearly doubled the gold a journey ends with, and gold already piles up, so contracts now pay half the gold (`W_NOTICE.gold`), with fans at two fifths of it and the card picks kept. The champion rate is inside the noise either way. The gold sinks of phase 10 should take up the extra 220.

## Epic 2, phases 5 to 12

The bot now plays the new systems as a player would: it rotates a Tired starter for a fresh bench player (a Tired one counts a level lower, a Spent one two; `opts.rotate`), keeps a starter as captain, pays the inn's price for your name in the region, takes one paid training camp session a stop while it has 200 gold to spare (`opts.camp`, `opts.campSpare`), and with two cups hunts the Barnstormers on a wild stop in their region (`opts.tour`, `opts.tourCups`). Weather and the regional crowd apply on their own. Defending the title and the Hall of Legends come after the Crown, where the bot's route ends, so they are not measured. Each row switches one system off. 140 journeys each, skilled bot, all run on the same build:

| 140 journeys | Champion rate | Gold at the end | Notes |
|---|---|---|---|
| Everything on | 80.7% | 654 | 15% of matches with a Tired starter; 5% in weather |
| Tired legs off (`W_FAT.off`) | 80.0% | 698 | |
| Tired legs on, never rotating | 75.0% | 630 | Rotation is worth about 5 points |
| Captain off (`W_CAPT.off`) | 82.9% | 669 | |
| Weather off | 84.3% | 686 | Weather matches are mostly wild games, won 98% of the time |
| Regional fans off (`W_REP.off`) | 85.7% | 662 | The bot is rarely Loved anywhere (5 crowd matches in 140 journeys) |
| Barnstormers off | 79.3% | 654 | |
| Training camp off | 81.4% | 972 | About 13 paid sessions a journey: the gold sink takes about 320 |

With 140 journeys a side, a difference of up to about 9 points is noise, and every row is inside it. Together, phases 4 to 12 leave the champion rate where it was (75.7% before the notice boards) and the gold at the end near the old level (631): contracts add about 220, and training camp takes about 320.

**The Barnstormers.** They should be a fight worth a unique Hall of Fame card. The bot hunts them once it has two cups:

| Their match | Bot wins | HP lost (% of max) |
|---|---|---|
| Elite, tier 3, two levels up | 44 of 44 | 36% |
| Boss, tier 2, two levels up | 95% (61 games) | 49% |
| Boss, tier 3, two levels up | 47% (55 games) | 78% |
| **Boss, tier 3, no extra levels (shipped)** | **68.5% (54 games)** | **66%** |

The shipped match is about as hard as the Crown final (68%). They only turn up once you hold a cup, and you can always back away from the card. Champion rate with it: 82.9%.

## Gate money (issue #6, open question 4)

A game at a ground costs nothing; a win takes the gate (`W_TAKE`: 5 gold a tier for a Friendly, 6 for a Challenge, up to double where your name is Loved). The route never played ground games before, so the bot now can (`opts.grounds`: a Friendly at each of a cup town's card-game grounds its squad is big enough for, off unless asked, so older rows still compare). 140 journeys each, skilled bot:

| 140 journeys | Champion rate | Ground games a journey (won) | Gate money a journey | Gold at the end |
|---|---|---|---|---|
| No ground games (the old route) | 79.3% | - | - | 620 |
| Ground games, no gate (`W_TAKE.off`) | 82.1% | 8.4 (98.2%) | - | 674 |
| Ground games, with the gate (shipped) | 82.1% | 8.9 (98.4%) | 89 | 693 |

The gate is a small top-up, about 10 gold a game: less than a Friendly's own match gold (10 to 20). Champion rate and end gold stay within noise, so the gold sinks from epic 2 still hold. Friendlies at the region's tier are easy wins for the bot (98%); the Challenge is the harder game, and pays a little more.

## Soccer (issue #10)

Soccer is Sudden Death's tenth sport. In the Realm it takes the Rimewatch Sheet from curling (the Hoarfrost Pitch), so the Frostspire plays hockey and soccer.

**Sudden Death, the rule** (`SOCCER` in `src/engine/sports.js`; 300 bot runs each, two at a time):

| | `main` | soccer |
|---|---|---|
| Run win rate | 22.7% | 23.3% |
| Deaths in Act 1 | 37.7% | 37.3% |
| Soccer's sports-win rate | – | 49% |

The first rule (a shot after 3 passes, their goal at 5+ through Block) gave soccer 34%, below every major sport. A shot after 2 passes, and their goal at 6+, puts it at 49%, beside football (51%), hockey (51%), basketball (59%) and baseball (67%). Samples of 150 to 200 runs swung by 7 points between two runs of `main`, so compare 300.

**The Realm** (`python3 test/realm_lab.py 140 '{}'`):

| | `main` | soccer |
|---|---|---|
| Champion rate | 77.9% | 78.6% |
| Frostspire wild match, HP | 12.8 | 19.2 |
| Rimewatch cup final, win | 98.4% | 95.2% |

The champion rate doesn't move. The Frostspire costs a little more, because soccer replaced curling there, and curling is one of the bot's easiest sports. The soccer run had one stall, a Brinefen wild match against `grinder` (bowling or curling, not soccer).

**After the review fixes** (the pass bonus once per shot, the Harpy Striker elite, the Penalty Spot, the Golden Boot), 300 runs each, side by side: `main` 24.0% run wins and 32.3% deaths in Act 1, this branch 22.0% and 35.7%, with soccer's sports-win rate at 53%. One earlier 300-run sample of the branch gave 17.3%; the side-by-side rerun puts that down to noise.

## Retiring a card at your home ground

The balance bot retires a basic card (Body Check or Hold the Line) once a week when it can (`opts.retire`). Over 140 journeys each, `main` was champion 79.3% of the time, and with retiring 85.7%. That's about 1.3 standard errors at this sample size, so part of it may be noise.

**Re-measured with 280 journeys each,** on the same build, with `opts.retire` off and on: 80.7% without retiring, 77.1% with it, about one standard error the other way. So retiring doesn't make the Realm easier for the bot, and the first gap was noise. `W_RETIRE.energy` stays at 3.

## Eggs (issue #12, phases 1 and 2)

With `opts.eggs`, the bot takes a region's nest and bush every 4 days it passes through, learns the Grand Tour once it holds one egg of each, keeps one of each back for it, and cooks the strongest egg dish it can before a big match. 280 journeys each, with meals on:

| | Meals only | Meals and eggs |
|---|---|---|
| Champion rate | 79.3% | 76.8% |
| Nests a journey | – | 11.8 |
| Egg dishes eaten | – | 3.8 |
| Grand Tours eaten | – | 0.19 |

The champion rate doesn't move: the gap is about one standard error. Egg dishes mostly take the place of meals the bot would buy at an inn, and the Grand Tour is rare enough (about one journey in five) not to tilt a Crown.

## Rare eggs and prospects (issue #12, phases 3 to 5)

With `opts.hatch`, the bot takes a dungeon's rare egg once its alpha is beaten and hatches it at Pell's when it has the energy. 280 journeys each, with meals and eggs on:

| | Champion rate | Prospects a journey |
|---|---|---|
| No hatching | 78.2% | – |
| Hatching, as built | 87.1% | 1.76 |
| Hatching, no double XP (`hatchXpTo: 0`) | 88.2% | 1.83 |
| Hatching, no hatchling card (`noHatchCard`) | 84.6% | 1.71 |

Hatching adds about 9 points, about 2.7 standard errors, so it's real. Double XP isn't the cause: taking it away changes nothing. The hatchling cards are worth perhaps 2 to 3 points, within noise. Most of it comes from the free players themselves: roster depth for tired legs, and the signature and kind cards each new player brings. The levers are `W_HATCH.energy` (6), `W_HATCH.days` (3) and how many rare eggs there are (5 a journey).

## Football (issue #9, phase 8)

`test/realm_gridiron_lab.py` plays football games and Cinder Cups on the gridiron engine, headless (`wGF.simGame`, about 45 ms a game), as Simulate plays them: your seven casts its powers as a Knight, the other side at the tier's CPU skill (Squire, Knight, Archmage).

```bash
python3 test/realm_gridiron_lab.py 150                                      # 150 games a row, and 150 cups
python3 test/realm_gridiron_lab.py 150 'W_GFG.oppBonus = { 1: 0, 2: 1, 3: 3 }'  # try a number: JS run in the page first
```

Part 1 plays a fresh five-player journey at level 3 (two call-ups fill the seven) against a rival's seven at that level plus a gap, then by tier. Part 2 sets the other side's CPU skill at an even level. Part 3 turns powers off for both sides. Part 4 enters a Cinder Cup and simulates every round.

**What it found.**
- **Levels matter more than on the diamond.** An even game is won about 42–50% of the time, three levels down about 21–27%.
- **The CPU skill makes little difference under Simulate.** Squire, Knight and Archmage were 35%, 29% and 37% (150 games each), inside the noise. Skill picks which power to cast, and both sides cast about 14 a game either way. It shows when you call the plays yourself.
- **Powers are fair to both sides.** Powers on against off at tier 2 was 29% against 43% in one run of 150 and 33% against 26% in a run of 200, so there is no lean either way. The same seven on either side of the ball wins the same (57% and 58% at tier 1).
- **The rating bonus by tier was too steep.** With `{ 2: 3, 3: 6 }`, tier 2 was won 30% and tier 3 16%, against the diamond's 56% and 32%.

**The retune.** `W_GFG.oppBonus = { 1: 0, 2: 1, 3: 4 }` (rating points spread over each of their players; 6 is +1 to every rating). 150 games a cell, 250 a tier (a rate is good to about ±6%):

| | Before `{ 2: 3, 3: 6 }` | `{ 2: 1, 3: 3 }` | `{ 2: 2, 3: 4 }` | After `{ 2: 1, 3: 4 }` |
|---|---|---|---|---|
| tier 1 | 51% | 45% | 47% | 49% |
| tier 2 | 30% | 38% | 35% | 44% |
| tier 3 | 16% | 24% | 22% | 25% |
| cup quarter-final (tier 1) | 55% | 59% | 57% | 55% |
| cup semi-final (tier 2) | 34% | 38% | 31% | 43% |
| cup final (tier 3) | 36% (28 played) | 18% | 19% | 17% |
| cups won | 6.7% | 4.0% | 3.3% | 4.0% |

Tier 1 changes nothing (no bonus), so its spread from 45% to 51% is the noise. Cups won stay at about 4–7% either way: few runs reach the final (28–36 of 150), so the final's rate swings. A simulated cup pays about 95 XP across the roster and costs about 17 gold. A player who calls the plays beats the coaches more often; nobody has measured that yet.

**The bench (later).** Each side now brings a bench of three, and the coaches swap tired players. A first try gave their bench the tier's rating bonus and let a Knight bring on the freshest player whoever it was. Tier 3 fell from 23% to 16% and cups won from 11% to 2%: their bench was as good as their starters, while yours is call-ups. The fix: their bench is reserves (a level lower, no bonus), and a Knight only brings on someone who would play the positions at least as well now. Your side in Simulate, against the code before the bench:

| | Before | After |
|---|---|---|
| tier 1 (150 a gap, 250 a tier after) | 51% | 48% |
| tier 2 | 42.5% | 40% |
| tier 3 | 23% | 21% |
| cups won (300 cups each) | 3.7% | 5.3% |
| cup final, won | 16% (68 played) | 22% (72 played) |

All inside the noise. After the review's fixes (the Archmage casts restoring powers only when they fit, and swaps before kicks too), one more run of 150 a gap and 150 cups: tier 1 53%, tier 2 40%, tier 3 20%, cups won 4.7%. Still inside the noise.

## Football stances (issue #29)

Each side of the ball plays Safe, Balanced or Risky (`GF_STANCE` in `src/gf/parts/16-stance.js`), and fumbles are new. Balanced is how every play ran before, so a game where both sides play Balanced matches the old one. The coaches pick a stance each down (Risky when behind late or on a long third down, Safe when ahead late or backed up), so the Simulate rows shift a little.

**The Realm lab against the bench run** (150 a gap, 250 a tier, 150 cups): tier 1 53% → 56% and 54% (two runs), tier 2 40% → 39% and 36%, tier 3 20% → 22% and 18%, cups won 4.7% → 6.7% and 6.7%. All inside the noise.

**Fumbles** (the coaches picking): about 0.4 lost a game between the two sides, against the issue's one every two or three games for Balanced; about 1.3 a game when both play Risky, and almost none on Safe. One fumble in a few hundred is run back for a touchdown.

**Whole games with a stance forced on one side** (the Ash Bowl's home side against the visitors, both Knights; 200 to 250 games a row; the home side wins about 43% with both on Balanced, ±3%). Tuned over seven rounds. Risky's first numbers (quarterback holding 30% longer, blockers releasing 25% sooner) gave five to seven sacks a game and no more big plays, and Safe beat it about two games in three. Interceptions are rare in the engine (about one in ten games), so a multiplier on them alone changed nothing; a Risky defense now also reaches further for the ball (`jump`, more break-ups and picks).

| Home side's stance (the visitors') | Win | Turnovers lost a game | Sacked | Stamina at the end |
|---|---|---|---|---|
| Balanced (Balanced) | 42–47% | 0.2 | 1.3 | 48 |
| Risky (Balanced) | 48–50% | 0.4 | 1.9 | 36 |
| Safe (Balanced) | 37% | 0.05 | 0.6 | 63 |
| Risky (Safe) | 32% | 0.2 | 1.4 | 38 |
| Safe (Risky) | 49% | 0.2 | 0.9 | 60 |

It comes out a mild rock, paper, scissors: Risky edges Balanced, Safe edges Risky, Balanced edges Safe, each by 5 to 8 points. Both on Risky, the box changes most: about 30 points a game against 22, 2 turnovers against none on Safe, and 6 sacks against fewer than 1.

**Your stance, every down, in the Realm lab** (even level, tier 2, both Knights, 150 each): Safe 47%, Balanced 40%, Risky 50%; turnovers lost 0.06, 0.19 and 0.38 a game; sacked 1.0, 2.0 and 3.1; stamina at the end 70, 65 and 59 (the coaches swap tired players, so it stays closer than in the table above).

**Big plays, first pass:** not met. Over 2,400 seeded downs Risky on offense made 276 plays of 20+ yards against Safe's 271, and in whole games the three stances made the same number (2.7 to 2.8 a game). Both receivers ran the same depth on each call, so looking deeper (`deepW`) rarely changed who got the ball.

### Route depths (follow-up to #29)

The short pass now has two depths: X cuts inside at 9 yards and Z runs up the seam (18 yards). The quarterback weighs each receiver by where he would catch it (his position plus his run while the ball is in the air), not where he stands, so the seam counts for its depth. On the deep pass, a Safe offense's back slips out of his block into the flat after 1.3 seconds, once no rusher is within 4 yards of him (`valve`), as a checkdown. Risky's pick chance on offense came down from 3.5× to 2.2×, because the seam throws are contested more often. Balanced plays as before: it almost never takes the seam, and the deep routes did not change.

A 13-yard dig or a 22-yard post on the deep pass instead were tried and dropped. Both cut the deep call's yards a play about in half (8.7 to 4 or 5): the inside routes run into the safety.

**Seeded downs** (900 of each call, every defense, the other side Balanced):

| Offense | Short: throws 15+ yards out | Short: 20+ plays | Deep: mean air yards | Deep: 20+ plays | Picks (short + deep) |
|---|---|---|---|---|---|
| Safe | 0% | 59 | 14 (checks down on about a third) | 245 | 0 |
| Balanced | 1% | 78 | 27 | 293 | 6 |
| Risky | 46% | 174 | 31 | 270 | 36 |

Over the 2,400 mixed downs of `test/realm_gridiron_stance.py`, Risky makes 396 plays of 20+ yards, Balanced 326, and Safe 264 (before: 276, 271).

**Your stance, every down, in the Realm lab** (600 games each, two runs of 300, against the same 600 before the change):

| Stance | Win, before | Win, after | 20+ plays a game, before | after | Sacked, before | after |
|---|---|---|---|---|---|---|
| Safe | 45% | 42% | 2.9 | 2.8 | 1.1 | 1.45 |
| Balanced | 45% | 43% | 2.7 | 3.6 | 2.2 | 2.1 |
| Risky | 49% | 52% | 2.8 | 3.9 | 2.9 | 2.9 |

The back first left his block whatever the rush did, which sacked Safe 1.9 times a game and dropped it to 37–41%. Waiting until no rusher is near brought it back. Every Balanced row has more big plays, because the other coach plays Risky some downs and now takes the seam. Cups won: 4.0% and 5.0% (4.7% before).

**Forced stances, whole games** (250 games a row, as the table above): Balanced (Balanced) 42%, Risky (Balanced) 38%, Safe (Balanced) 43%, Risky (Safe) 42%, Safe (Risky) 42%. The rock, paper, scissors has flattened: every pairing is within 4 points of even. 20+ plays a game, home side: 3.5 Balanced, 3.9 Risky, 2.4 Safe.

### Fourth down and the fumble (follow-up to #29)

On fourth and 2 or less past their own 40, a Knight or Archmage coach now weighs how likely the back is to fumble (`gfFumbleRisk`): his stamina (under 50 is 1.4×), his hands and strength against the tacklers, and the stance the other coach would play (a Knight's defense goes Risky on short yardage, 1.8×; a Squire's could be anything). At 2.2× the usual or more (`GF_FUM.wary`), the coach punts, or on fourth and 1 past midfield goes for it playing Safe. A Squire doesn't weigh it. In practice this means a tired back, or one with poor hands against hard tacklers.

Over 1,000 games, both Knights: the coaches punt for the fumble 37 times (about once every 27 games), and go for it on fourth down 263 times instead of 299. Fumbles on fourth-down tries: 3 either way. It rarely matters, because fourth and short past the 40 is rare, and a fumble there costs little more than being stopped.

**The Realm lab** (300 a row, before → after): tier 1 54.8% → 51.4%, tier 2 37.0% → 41.0%, tier 3 22.2% → 18.8%, Knight 49.0% → 43.7%, cups won 4.0% → 4.0%; your stance every down Safe 41.0% → 41.7%, Balanced 43.0% → 47.3%, Risky 48.3% → 47.7%. All inside the noise.


## Boxing (issue #23, phase 7)

`test/realm_ring_lab.py` boxes cards and Anvil Belts on the Anvil Ring's engine, headless (`wBX.simCard`, about 3 ms a card), as Simulate boxes them: your corner's pairing, your fighters boxing and casting as Knights, theirs at the tier's CPU skill.

```bash
python3 test/realm_ring_lab.py 300                                         # 300 cards a row, and 300 Belts
python3 test/realm_ring_lab.py 300 'W_BXG.oppBonus = { 1: 2, 2: 1, 3: 2 }'  # try a number: JS run in the page first
```

Part 1 boxes a fresh three-player journey at level 3 against a rival's three at that level plus a gap, then by tier as the world sets it (their level is yours plus the tier, less one, with the tier's rating bonus and CPU skill). Part 2 sets their CPU skill at an even level. Part 3 turns powers off for both sides. Part 4 enters an Anvil Belt and simulates every round.

**The engine on its own** (phases 1 to 4, headless bouts between kinds at their own ratings, 1,800 bouts):
- **Outcomes:** about 54% unanimous decisions, 17% split, 7% majority and 12% draws on the cards (the pro rule's 10-8 for a knockdown levels a card now and then); 10% of bouts are stopped, and 59% have a knockdown.
- **Kinds** won 32% (spider) to 65% (dwarf) of their decided bouts with powers on; powers move a kind by at most 11 points. The heavy hitters with iron chins (dwarf, golem, minotaur, ogre) were a little strong, and the long, light ones (spider, skeleton, kobold) a little weak.
- **Each kind's nature** (`BX_TRAIT`, Geoff: a few ways for the weak to counter, a few weaknesses for the strong, mostly flavour): Long Arms (spider), Hollow (skeleton), Quick Recovery (kobold), Cold Read (lich), Scrappy (goblin) and Second Wind (werewolf); Stone Weight (golem), Stocky (dwarf), Charges In (minotaur), Heavy Breather (ogre) and Rotting (zombie). The first numbers overshot (golem 36%, goblin 62%), so they were softened. After, over 2,700 bouts: lich 39%, gorgon 42%, spider 45%, most kinds 46–53%, then witch 57%, ogre 58%, golem 60%, dwarf 62%. The heavy hitters are still a little strong, and the light ones have come up to the middle. Cards by tier after the traits: 51.5%, 43%, 23% (400 a row), Belts won 6%.
- **A +3 in one rating** is worth 56% (reach) to 75% (stamina) of bouts against an even fighter.
- **The plans** mostly beat each other 37–63%; Cover up is for a hurt fighter, and loses on the cards.
- **Boxing by hand** (a scripted player): pressing faster than every 0.7 seconds mostly loses (they punch themselves out); about one punch a second with some timed slips wins a little over half.

**Cards, before** (`W_BXG.oppBonus = { 1: 0, 2: 1, 3: 3 }`, 100 a row): tier 1 70%, tier 2 41%, tier 3 13%; Belts won 5%. Tier 1 was far too easy and tier 3 too hard. At an even level with no bonus your three win about half; tier 1's edge comes from your corner picking the pairing against their order, and from a Squire boxing worse than a Knight (Squire, Knight and Archmage at an even level: 53%, 51%, 45%). Unlike football, the CPU's skill shows under Simulate: it reads and defends punches, and picks its moments to cast.

**The retune.** `W_BXG.oppBonus = { 1: 2, 2: 1, 3: 2 }` (rating points spread over each of their fighters; 6 is +1 to every rating). 300 to 400 cards a row (a rate is good to about ±5%):

| | Before `{ 1: 0, 2: 1, 3: 3 }` | `{ 1: 2, 2: 1, 3: 1 }` | `{ 1: 3, 2: 1, 3: 0 }` | `{ 1: 3, 2: 2, 3: 1 }` | After `{ 1: 2, 2: 1, 3: 2 }` |
|---|---|---|---|---|---|
| tier 1 | 70% | 51–53% | 48% | 46% | 53% |
| tier 2 | 41% | 39–44% | 46% | 33% | 39% |
| tier 3 | 13% | 26–28% | 32% | 28% | 26% |
| Belt quarter-final (tier 1) | 62% | 50–52% | 47% | 46% | 51% |
| Belt semi-final (tier 2) | 40% | 44–47% | 39% | 37% | 43% |
| Belt final (tier 3) | 20% (25 played) | 31–37% | 38% | 28% | 24% (87 played) |
| Belts won | 5% | 7.7–8% | 7% | 4.7% | 5.2% |

Close to the gridiron's 49%, 44% and 25%. The two settings for tier 3 at 1 and 2 points come out the same (26%) on cards; the final of a Belt, played more rarely, falls from 37% to 24% with 2. A simulated Belt pays about 46 XP across the team and costs about 16 gold, as a Cinder Cup does. Draws of a whole card are rare (under 1%): level on bouts, a card goes to the knockdowns and then the points. Powers at an even level: 51% with them, 45% without (100 a row: inside the noise). A player who boxes by hand or works the corner does better than the CPU's corner; nobody has measured that yet.

**Spirit and two specials (issue #61, phase 4).** Powers now need spirit as well as stamina (`BX_SPIRIT`: clean punches landed and punishment taken fill it; a special needs 25, an ultimate 60). The first try filled it from every point of damage at full rate (about 125 a round) and changed nothing: 5.3 specials and 2.0 ultimates a bout before, 5.2 and 2.0 after. At a third of that rate (about 35 a round), and with a Knight saving for its ultimate in the last round: 4.4 specials and 0.9 ultimates a bout (200 bouts). The Realm lab after (60 a row, so about ±6 points): tier 1 55%, tier 2 38%, tier 3 32%, Belts won 5%; powers on 50%, off 52%. Inside the noise of the numbers above. Phase 7 measures it finer.

## Superstars: the Phoenix in the ring (issue #24, phase 2)

A superstar should be strong but not win a journey alone. Round robin, the Phoenix against every league kind at its
kind's ratings, both CPU Knights, 300 bouts a kind, sides swapped (a draw counts half):

| Phoenix ratings (reach, pow, spd, chin, sta, gui) | Phoenix | Best league kind | Worst |
|---|---|---|---|
| 6, 6, 9, 4, 7, 7 (first try) | 66.8% | 58.6% (witch) | 40.0% (lich) |
| 6, 5, 9, 4, 6, 7 | 57.6% | 58.5% | 40.7% |
| **6, 6, 9, 4, 6, 7 (shipped)** | **63.1%** | 59.1% | 40.3% |

The best kind in the ring by about four points, with Rebirth (one lost count beaten a bout). The card game's Rebirth
(30% of max HP once a match), football and baseball are measured in phase 4 with the realm, gridiron and diamond labs.

### The Kraken in the ring (issue #24, phase 3)

Same round robin (300 bouts a kind):

| Kraken ratings (reach, pow, spd, chin, sta, gui) | Kraken | Best league kind |
|---|---|---|
| 10, 7, 3, 7, 6, 5 (first try) | 42.5% | 59.2% |
| 10, 7, 5, 7, 6, 6 | 56.7% | 58.8% |
| 10, 8, 5, 7, 6, 6 | 66.1% | 58.4% |
| **10, 7, 5, 8, 6, 6 (shipped)** | **61.3%** | 58.7% |

Speed matters most: at 3 the longest reach in the ring could not make up for it. Shipped just under the Phoenix (63%).

### The Behemoth in the ring (issue #24, phase 3)

Same round robin, from here on against the 18 league kinds only (a superstar against a superstar is left out, so each
number stays comparable as more are added; the Phoenix and the Kraken measure 63.1% and 62.3% that way):

| Behemoth ratings (reach, pow, spd, chin, sta, gui), Living Wall | Behemoth |
|---|---|
| 6, 9, 3, 9, 7, 3, hollow .7 (first try, field included the other superstars) | 84.2% |
| 6, 8, 2, 8, 6, 3, hollow .8 | 66.3% |
| 6, 8, 2, 7, 6, 3 | 56.3% |
| 6, 7, 2, 8, 6, 3 | 59.0% |
| 6, 8, 2, 8, 5, 3 | 58.7% |
| 6, 8, 2, 8, 6, 3, hollow .85 | 65.0% |
| **6, 8, 1, 8, 6, 3, hollow .8 (shipped)** | **63.5%** |

Chin is the steepest rating for a big kind (a point is about ten points of win rate); Living Wall's strength barely
matters. Shipped level with the other two.

### The Djinn in the ring (issue #24, phase 3)

| Djinn ratings (reach, pow, spd, chin, sta, gui) | Djinn (against the league kinds) |
|---|---|
| 6, 5, 7, 5, 6, 10 (first try) | 72.6% |
| **6, 5, 6, 5, 6, 9 (shipped)** | **61.8%** |

Guile and speed together were the counter-puncher's old edge (phase 7's Counter plan); a point off each brings it
level with the others (Phoenix 63.1%, Kraken 62.3%, Behemoth 63.5%).

### The Hydra in the ring (issue #24, phase 3)

| Hydra ratings (reach, pow, spd, chin, sta, gui), Regrow (scrappy .03, mend .6) | Hydra (against the league kinds) |
|---|---|
| 6, 6, 5, 6, 7, 6 (first try) | 74.1% |
| 6, 5, 5, 6, 6, 6 | 55.7% |
| **6, 6, 5, 6, 6, 6 (shipped)** | **63.4%** |

Its nature carries it (it mends 0.6 of what it lost between rounds, everyone else 0.35), so its ratings are plain.

### All six in the ring

| Superstar | Against the league kinds | Best league kind |
|---|---|---|
| Phoenix | 63.1% | about 59% (witch) |
| Kraken | 62.3% | |
| Behemoth | 63.5% | |
| Djinn | 61.8% | |
| Hydra | 63.4% | |
| Frost Wyrm | 62.8% | |

The Frost Wyrm (strong at everything): 7, 7, 6, 7, 7, 6 won 74.4%; chin 6 gave 70.3%; chin and power 6, 61.0%;
shipped at 7, 7, 6, 6, 6, 6, 62.8%. Its edge is being good at everything in every sport, which its price (500 gold,
the most) pays for.

## Superstars in the card game, football and baseball (issue #24, phase 4)

`python3 test/realm_stars_lab.py N` measures what one superstar adds to a team. Each test is a fresh journey with its
players at one level, plus one more player at that level who starts: a superstar, or (the control) a league kind the
team lacks, picked at random. Somebody else is captain. The card game is played by the realm lab's bot
(`REALMBOT`, now shared from `test/realm_lab.js`) at level 4, tier 2; football and baseball are whole games on
Simulate at an even level, tier 2. The aim, as in the ring: a superstar is clearly better than an ordinary player, but
does not win alone.

### The card game (elite matches, 500 each)

Pickup games were won 98–100% by everyone; superstars lost less HP in them (3–6 against 6.6).

| Superstar | First try | Power off (cards only) | Shipped |
|---|---|---|---|
| Control | 40.0% | 41.8% | 42.8% |
| Phoenix | 61.0% | 39.5% | 55.4% |
| Kraken | 80.3% | 64.5% | 49.6% |
| Behemoth | 46.0% | 42.2% | 59.6% |
| Djinn | 52.3% | 36.0% | 55.8% |
| Hydra | 52.3% | 37.2% | 46.4% |
| Frost Wyrm | 51.7% | 40.5% | 50.8% |

- The Kraken's edge was mostly its cards: its pool has no slow cards (league kinds alone range 36–52% here), and
  Tentacle Grab was the zombie's Grave Grip. Shipped: Tentacle Grab Weak 1 (was 2), Tentacle Slam 7 (8), Ink Cloud
  6 Block (8), From the Depths 4 Block and draw 1 (6, 2), Constrict 8 damage and Weak 1 (7 and Stun), and Eight Arms
  2 damage and 2 Block a turn (3 and 3).
- The Phoenix's Rebirth comes back at 20% of max HP (was 30%; 15% gave 54.3%).
- The Behemoth's Earthquake was worth little on turn 3 alone. Every third turn gave 78.5%, every fourth 71.5%;
  shipped on turns 3 and 6.
- Runs of 400–500 vary by about 4 points, so the Hydra's 46% and the Behemoth's 60% were left alone.
- A check at 3,000 elite matches each: control 43.8%, Phoenix 56.3%, Behemoth 58.0%, Djinn 53.0%. The Behemoth's
  60% at 500 was partly noise; its edge (+14) is next to the Phoenix's (+12.5). Two trims at 500 matches (Stomp 5
  damage and 3 Block with Moss Charge 11; Earthquake on turns 3 and 7) gave 53.6% and 56.6% against 55.2% for the
  shipped Behemoth, inside the noise, so nothing changed.

### Football and baseball (1,500 games each)

| Superstar | Football, first try (1,000) | Football, shipped | Baseball, first try (1,000) | Baseball, shipped |
|---|---|---|---|---|
| Control | 41.2% | 37.4% | 48.0% | 50.1% |
| Phoenix | 46.2% | 42.6% | 49.8% | 54.5% |
| Kraken | 36.2% | 46.5% | 49.8% | 55.5% |
| Behemoth | 39.4% | 44.4% | 48.7% | 55.3% |
| Djinn | 40.0% | 46.1% | 47.4% | 53.8% |
| Hydra | 39.8% | 44.1% | 49.1% | 52.9% |
| Frost Wyrm | 47.0% | 45.9% | 54.2% | 55.9% |

At first only the Phoenix and the Frost Wyrm did better than an ordinary player; the slow Kraken did worse (speed
counts most in football). Shipped ratings, football (spd, str, hnd, arm, kck, tkl): Kraken 6, 9, 9, 6, 4, 9;
Behemoth 5, 10, 5, 6, 5, 10; Djinn 9, 5, 9, 9, 6, 5; Hydra 7, 8, 8, 7, 5, 9. Baseball (pow, con, spd, arm, fld):
Phoenix 7, 8, 9, 6, 8; Kraken 9, 7, 5, 7, 10; Behemoth 10, 8, 4, 9, 8; Djinn 9, 9, 8, 7, 8; Hydra 9, 8, 5, 9, 8
(league kinds total about 30 there, the superstars 38–42). One player in seven or nine now adds 5–9 points in
football and 3–6 in baseball.


### Basketball (issue #77, phase 8)

`python3 test/realm_stars_lab.py 1000 '' bk`: four of your own and one more player as your five (the coach picks the
spots), level 3, Simulate against a tier 2 club coached by a Knight. Court ratings are spd, siz, hop, tch, hnd, def
(league kinds total 26 to 41).

| Superstar | First try (400) | Shipped (1,000) | Shipped ratings |
|---|---|---|---|
| Control | 36.0% | 36.6% | |
| Phoenix | 50.2% | 42.0% | 9, 4, 9, 8, 7, 5 |
| Kraken | 42.5% | 45.6% | 5, 10, 5, 7, 7, 10 |
| Behemoth | 36.5% | 40.5% | 5, 10, 6, 5, 3, 10 |
| Djinn | 41.0% | 44.6% | 9, 5, 7, 8, 10, 6 |
| Hydra | 39.2% | 41.7% | 7, 8, 6, 6, 6, 9 |
| Frost Wyrm | 45.8% | 42.8% | 7, 8, 7, 7, 6, 7 |

One player in five adds 4 to 9 points, as in football. The first Phoenix (9, 5, 9, 9, 7, 5) added 14 and was cut
back; the first Behemoth (3, 10, 4, 4, 3, 10) added nothing, since slow feet cost more on a full court than size
gives, so it got a little speed and hops. The Djinn is worth its points only at the point: with a handle of 9 it lost
the spot to a goblin in a fixed five and added nothing (53% against a league mean of 54%), and with 10 it takes the
ball (66%). Run to run the control moved between 33.6% and 37.1%, so a difference under about 4 points is noise.
After phase 10's retune (the tier bonus and the stances, below) the same lab reads: control 33.5%, Phoenix 40.7%,
Kraken 37.4%, Behemoth 37.2%, Djinn 40.2%, Hydra 40.6%, Frost Wyrm 38.8%: 4 to 7 points each, the Kraken's and the
Behemoth's 4 at the edge of the noise.

## Basketball at the Charter Court (issue #77, phase 10)

`python3 test/realm_court_lab.py N`: every game is the court engine played to a final, headless, as Simulate plays it
(five minutes, the Charter Court's ways on). A fresh journey with seven players at level 3 (a five and a bench of two,
as theirs), your coach a Knight, theirs at the tier's skill. A cell of 200 games is good to about 3.5 points either
way, one of 600 to about 2; the same cell moved by up to 5 points between runs, so differences under about 5 are
noise. About 14 ms a game; 5% go to overtime.

**Tiers, as the world sets them** (500 games each): a tier is their level (yours plus the tier, less one), extra
rating points on each of their five (`W_BKG.oppBonus`), and their coach.

| Bonus by tier | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| 0, 1, 3 (as built) | 59.6% | 45.0% | 32.0% |
| 0, 1, 2 | 65.0% | 43.8% | 36.4% |
| **0, 2, 5 (shipped)** | 56.6% | 44.0% | 26.0% |

Tier 3 was a little kind as built; shipped, the three sit by boxing's (51/42/28%, measured the same way). Tier 1 has
no bonus in any row, so its 57 to 65% is the run-to-run noise. Tier 2 reads the same at a bonus of 1 or 2.
At an even level instead (600 each, the first way this was measured, and not a game the world offers past tier 1):
0, 1, 3 gave 58.2/48.5/39.2%, and 0, 2, 5 gave 57.8/47.3/33.0%. A level counts for little, so the two ways agree.

**Level gap** (200 games each, tiers mixed, before the tier 2 change): their level a point below yours 51.5%, even
48.0%, +1 38.0%, +2 34.5%, +3 36.0%. A level is one rating point a player, so a gap counts for less than a tier does.

**Their coach** (even level, tier 2 ratings, 200 each): Squire 60.5%, Knight 43.5%, Archmage 42.5% (an earlier 150
read 58.7/54.0/49.3). A Squire is clearly easier; Knight and Archmage are within the noise of each other.

**Powers** (even level, both Knights, 800 each): on 49.5%, off 47.4%, at the same scores (28.8–28.7 and 28.7–29.0).
Powers add colour and don't tilt a game between sides that both have them.

**Your call, fixed all game** (even level, both Knights, theirs picked by their coach; 200 each, the rest Motion, Man
and Balanced). With your coach calling it you won 43.5% in this run, and 45 to 54% in others.

| Offense set | Win | Points | Turnovers |
|---|---|---|---|
| Pick and roll | 43.0% | 24.9–26.3 | 2.9 |
| Post up | 20.0% | 22.0–29.6 | 6.9 |
| Motion | 41.5% | 25.3–26.6 | 3.0 |
| Isolation | 27.0% | 23.5–28.4 | 3.2 |
| Spread for three | 34.5% | 24.3–26.8 | 2.9 |
| Feed the hot hand | 42.0% | 24.1–25.9 | 3.5 |

| Defense | Win | Points |
|---|---|---|
| Man | 41.5% | 25.3–26.6 |
| Zone | 36.5% | 25.8–28.2 |
| Press | 51.0% | 25.8–25.8 |
| Switch everything | 42.5% | 25.3–26.9 |
| Pack the paint | 37.0% | 24.7–27.4 |

No set called every time beats your coach mixing them (43.5% in the same run), and three do clearly worse, which is the
scout doing its job (the issue's fifth decision); Pick and roll, Motion and Feed the hot hand lose nothing by it here.
**Post up is the weak one**: it loses the ball nearly seven times a game, twice any other set, with a random
five that may have no real big; it is left as it is for now and is the first thing to look at next. Isolation is also
poor with no star to give it to. The Press did best of the defenses in both runs (48.0% and 51.0%).

**Pace and Pressure** (your stance fixed all game, 600 to 800 each):

| | As built (600) | Shipped (800) |
|---|---|---|
| Push | 35.8% | 38.2% |
| Balanced | 39.3% | 42.0% |
| Grind | 49.2% | 45.1% |
| Gamble | 46.0% | 43.6% |
| Balanced | 39.3% | 42.0% |
| Sit back | 34.8% | 40.2% |

As built, Grind and Gamble were simply better (10 and 7 points over Balanced) and Push and Sit back simply worse.
Shipped: Push `shootAt` −.14 → −.04 and `risk` 1.25 → 1.06; Grind `look` .025 → .012; Gamble `foul` 1.6 → 1.8 (4.3
fouls a game against 2.5); Sit back `steal` .6 → .8, `block` .85 → .9, `con` .82 → .95, `foul` .55 → .45. Pressure is
now a matter of taste (within 3.4 points). Pace still leans to Grind by 7 points over Push; Push is for when you're
behind and need possessions, which a fixed stance can't show. A middle try made Gamble worst (38.3% at `foul` 2).

**The Charter Net** (300 cups, Simulate every round): quarter-final won 56.3%, semi-final 45.6%, final 16.9%;
champion 4.3% (the Cinder Cup 3.3%, the Anvil Belt 3.3%). The final is the hardest game there is: tier 3, against a
side that has won twice. No game of yours went to the rebounds. A cup is worth about
139 XP and costs 15 gold on average, fee and prize included.

**Gear and potions** (even level, 200 each, before the tier 2 change; your bench gives your potions as a Knight would):

| tier | plain | their bag only | both bags | both bags, you in gear |
|---|---|---|---|---|
| 1 | 63.5% | 54.0% (0–0.9) | 53.5% (1.2–0.9) | 67.5% (1.0–0.9) |
| 2 | 52.0% | 55.5% (0–0.2) | 54.5% (1.2–0.2) | 52.5% (1.0–0.1) |
| 3 | 31.5% | 34.5% (0–2.0) | 29.5% (1.0–1.9) | 31.0% (0.9–1.7) |

No column moves the same way at all three tiers, so nothing here is a measured effect: tier 1 swings by 14 points
between columns that differ only by gear (53.5% and 67.5%) while tiers 2 and 3 don't move, which says these cells are
noisier than the 3.5 points their size suggests. A bench gives about one potion a game and each touches one player or
one stoppage, and one piece of gear a player is worth a point or two a game at most (phase 7). As in football, a bag and a kit are a
small edge and never turn a tier. Bot numbers are relative: a player who shoots the release meter well, and mixes
calls, will do better than the Knight stand-in.

## Adventure rewards (issue #47, phase 5)

The three adventures' kept rewards are handed over again at the start of every later journey, so a profile that has
finished them plays every journey with them from day one. That is what the bot measured: each reward given at
`wStart`, 300 journeys a row, with `test/realm_lab.py` and a `wStart` wrapper as the tuning snippet.

As first written, they made the Crown close to a formality:

| Champion rate (300 runs each) | Skilled | Careless | Hardcore |
|---|---|---|---|
| No adventure rewards | 77.7% | 36.3% | 15.7% |
| All of them | 97.7% | 65.0% | 52.0% |
| Founder's Charm alone (1 Strength and 1 Footwork every fight) | 90.3% | 50.3% | 36.3% |
| The two Hall of Fame cards alone | 91.0% | 48.0% | 31.7% |

The retune:

- **Founder's Charm:** 4 Block at the start of each fight (was 1 Strength and 1 Footwork).
- **The Founding Rule:** 6 Block and 1 Strength, and it Exhausts (was 9 Block, 1 Strength and 1 Footwork, every time).
- **Drop Anchor:** 8 Block and every enemy Weak, and it Exhausts (was 12 Block).
- **The Marigold's Flag** is unchanged (3 fans after a win). On its own it's within noise: 81.3% / 33.7% / 19.0%.

After, with the shipped values and a fresh baseline:

| Champion rate (300 runs each) | Skilled | Careless | Hardcore |
|---|---|---|---|
| No adventure rewards | 79.0% | 32.7% | 22.3% |
| All of them | 85.0% | 39.3% | 22.3% |

So all three adventures finished is worth about six points of champion rate to the skilled and careless bots, and
nothing measurable in hardcore (whose baseline moved from 15.7% to 22.3% between runs: that is its noise). The two
reward players, Bosun Gale and Rook Halloran, are an ordinary troll and werewolf at the team's level, as a tavern
recruit would be, so they add a body, not a power. The ending pay (gold and fans, once) was not measured: the bot
already spends what it earns.

**Football: second powers and situation powers (issue #61, phase 5).** The Realm lab after (60 a row, 100 a tier, so about ±6 to ±10 points): tier 1 51%, tier 2 42%, tier 3 24%, Cups won 5%; Squire, Knight and Archmage at an even level 60%, 47% and 40%; powers on 47%, off 50%. All inside the noise of the runs above. Phase 7 measures it finer.

**The superstars' second powers (issue #61, phase 6).** In the ring, each superstar against six league kinds over 150 seeded bouts, first special against second: the first try had the second ahead for four of them (Hydra 68% → 82%, Kraken 68% → 77%, Phoenix 57% → 66%, Djinn 64% → 71%), so Venom Spit, Ink Cloud, Wall of Heat and Lamp Smoke were softened. After: Phoenix 57/61, Kraken 66/66, Behemoth 68/60, Djinn 64/64, Hydra 70/70, Frost Wyrm 68/66. On the gridiron (the superstar in an ordinary six, 40 games each, first powers against second, points a game): Phoenix +8.2/+5.0, Kraken −3.6/−1.8, Behemoth +0.6/−1.7, Djinn +0.1/+2.0, Hydra +0.2/−1.9, Frost Wyrm +0.3/+1.9; inside the noise (about ±2 at 40 games, the Phoenix aside).

## Gear and potions in boxing and football (issue #61, phase 7)

Both labs gained a part that plays each tier, as the world sets it, four ways: **plain** (no gear, no potions);
**their bag only** (`W_RING_KIT.opp` / `W_GRID_KIT.opp` by tier: how Simulate plays now, since it leaves your bag
alone); **both bags** (yours a full one, `KIT_MINE` in each lab, given by your corner or coach as a Knight would: a
stand-in for giving them by hand in Play and Manage); and **the full kit** (both bags, and your players in gear,
`KIT_GEAR`). 150 a row, so a difference needs about 8 points to stand out.

**Boxing** (`python3 test/realm_ring_lab.py 150`; card win rate, potions used a card yours–theirs):

| tier | plain | their bag only | both bags | both bags, you in gear |
|---|---|---|---|---|
| 1 | 57.3% | 50.0% (0–0.9) | 49.3% (1.7–0.9) | 54.7% (1.7–0.9) |
| 2 | 39.3% | 40.7% (0–0.4) | 40.7% (1.8–0.4) | 49.3% (1.7–0.6) |
| 3 | 23.3% | 20.7% (0–2.0) | 26.0% (2.3–2.0) | 25.3% (2.0–2.0) |

**Football** (`python3 test/realm_gridiron_lab.py 150`; even level, game win rate, potions used a game yours–theirs):

| tier | plain | their bag only | both bags | both bags, you in gear |
|---|---|---|---|---|
| 1 | 66.7% | 70.0% (0–1.0) | 62.0% (2.7–1.0) | 69.3% (2.8–1.0) |
| 2 | 49.3% | 56.0% (0–1.3) | 55.3% (3.0–1.2) | 56.7% (2.9–1.3) |
| 3 | 25.3% | 35.3% (0–4.4) | 28.7% (2.9–4.4) | 30.7% (3.2–4.6) |

Football read backwards at first (their bag seemed to help you, yours to hurt you), so each potion was tested alone:
a CPU side with three of one potion against none, the same 200 seeds (`B`'s points a game against `A`'s): none −1.18;
draught −1.55, secondwind −1.03, resin −1.11, haste −0.77, fog −0.76, salve −0.96. No potion hurts the side that
drinks it; each moves a game by at most about 0.4 points, inside the noise (about ±1). The backwards rows were noise.
A whole bag (`draught 2, secondwind, resin, haste, fog, salve`) against none, 300 seeds: +0.6 points a game and +2.6
points of win rate. The Speed Elixir went from 6% to 10% and the Mending Balm from 15 to 25 stamina; after, +0.4 points
and +4.1 points of win rate, still inside the noise. A coach gives about 3.3 a game, and each touches one play or one
drive of 60 or more, so a football potion is a small edge by nature.

**What it comes to.** A full bag helps a little and never wins a match on its own (the issue's aim): boxing about 0 to
+5 points of card win rate, football about +3. Gear does more (a full set +5 to +10 in boxing; in football a set of
seven of one piece +1 to +3.5 points a game, measured in phase 3), and still doesn't turn a tier: tier 3 stays at
20–31% however you're equipped. A player who picks the moments by hand will do better than the Knight stand-in;
nobody has measured that yet. The rest of each lab is unchanged from the runs above: boxing tiers 51/42/28%, Belts won
3.3%; football tiers 57/45/27%, Cups won 3.3%.


## Hockey at the Pond Rink (issue #83, phase 11)

`python3 test/realm_rink_lab.py N`: every game is the rink engine played to a final, headless, as Simulate plays it
(six minutes, the Pond Rink's ways on). A fresh journey with eight players at level 3 (a six and a bench of two, as
theirs), your coach a Knight, theirs at the tier's skill. Hockey is low scoring (about 2.7 goals a side), so one game
is mostly luck: a cell of 100 games is good to about 5 points either way, one of 150 to about 4, and the same cell
moved by up to 8 points between runs. Differences under about 8 are noise. About 90 ms a game; 16% go past the third
period and 5 to 7% to a shootout. No game ends level.

**Tiers, as the world sets them** (100 games each): a tier is their level (yours plus the tier, less one), extra
rating points on each of their six (`W_HKG.oppBonus`: 0, 2, 5, the court's), and their coach.

| | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Win | 59.0% | 40.0% | 21.0% |
| Goals | 2.79–2.31 | 2.62–3.31 | 2.00–4.01 |

These sit by basketball's (57/44/26%) and boxing's (51/42/28%), so the court's bonus is kept. Tier 3 reads a little
hard; it is inside the noise of basketball's, and is the first number to look at if it feels unfair by hand.

**Level gap** (100 each, tiers mixed): their level a point below yours 46%, even 47%, +1 43%, +2 34%, +3 28%. A level
is one rating point a player, so a gap counts for less than a tier does.

**Their coach** (even level, tier 2 ratings, 100 each): Squire 50%, Knight 43%, Archmage 33%. In order, and each step
is about the size of the noise. Coach against coach with the same skaters (300 each, phase 5): a Knight beats a Squire
56 in 100, an Archmage a Knight 59, an Archmage a Squire 62. A Squire's first handicaps (a second skater chasing the
puck, slower decisions) measured at nothing; what he has now is what did: guessed passes, worse shots, drift out of
shape, and late line changes.

**Powers.** Both sides with powers 43%, neither 51% (100 each): powers don't tilt a game between sides that both have
them. One side only, the same seeds both ways (600 games, phase 7): +0.24 goals a game and 54 wins in 100. As first
written (two mana to start, half a mana when scored on, seven-second powers) they were worth about half that, so the
mana was raised (three to start, one when scored on, two at a break) and powers last ten seconds. About 10.5 casts a
side a game.

**Your call, fixed all game** (even level, both Knights, theirs picked by their coach; 150 each, the rest Cycle, Man
and Balanced, after the retune below).

| With the puck | Win | Goals | Shots |
|---|---|---|---|
| Cycle | 48.0% | 3.00–3.00 | 16.9 |
| Rush | 36.7% | 2.44–3.23 | 17.3 |
| Dump and chase | 31.3% | 2.11–3.16 | 13.7 |
| Point shots | 49.3% | 3.19–3.30 | 19.0 |
| Crash the net | 49.3% | 3.06–3.29 | 18.6 |

| Without it | Win | Goals | Their shots |
|---|---|---|---|
| Man | 48.0% | 3.00–3.00 | 18.4 |
| Forecheck | 38.0% | 2.47–3.25 | 18.6 |
| Trap | 34.0% | 2.48–3.37 | 18.2 |
| Box | 40.0% | 2.44–3.09 | 17.9 |
| Collapse | 46.0% | 2.20–2.63 | 17.4 |

No system called every time beats mixing them by more than the noise, which is the scout and their coach's answer
doing their job. **Dump and chase is the weak one**: three fewer shots a game than anything else, and it read 33% and
31% in two runs. Lowering how often it dumps and making the puck safer in it (this phase) did not move it. It is left
as it is, and is the first thing to look at next: the chase does not win the puck back often enough. The Collapse
gives up the fewest goals (2.63) and scores the fewest (2.20). A run before the retune had Point shots at 54% and
Forecheck at 50%; in this one they are 49% and 38%, which is the size of the noise.

| Tempo | Win | Shots | Stamina at the end |
|---|---|---|---|
| Push | 39.3% | 16.1 | 71 |
| Balanced | 48.0% | 16.9 | 72 |
| Sit on it | 46.0% | 15.0 | 75 |

| Edge | Win | Hits | Penalties |
|---|---|---|---|
| Rough | 39.3% | 9.1 | 1.44 |
| Balanced | 48.0% | 6.5 | 0.89 |
| Clean | 40.0% | 3.8 | 0.50 |

Rough was penalised 2.0 times a game and won 35% as first built; its fouls were cut (1.5 times a balanced side's,
now 1.3) and it takes 1.4. Push does not yet produce more shots than Balanced, which it should: also for next time.

**Special teams** (100 each, your setup fixed). A power play scores on 14 to 27% of penalties (Umbrella 13.6%,
Overload 18.3%, Net front 27.1%); a penalty kill gives up 16 to 22% (Box 15.8%, Pressure 20.0%, Diamond 21.7%). A side
takes about one penalty a game. Per minute a power play outscores even strength only a little (0.66 goals a minute
against 0.58, phase 3): a minor is a sixth of a period, and a side that is short clears the puck and makes the power
play fetch it. A short-handed side scores a twelfth as often as an even one.

**The Pond Kettle** (100 cups, level 3, Simulate every round): the quarter-final won 61%, the semi-final 36%, the
final 18%; champion in 4 cups of 100, 158 XP and 16 gold down a cup with the fee and the prize. A level 3 six is not
expected to win a final against tier 3: it is a cup to come back to.

**Gear and potions** (100 each, even level; your bench gives your potions as a Knight would):

| | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Plain | 56% | 38% | 28% |
| Their bag only | 55% | 38% | 29% |
| Both bags | 61% | 44% | 32% |
| Both bags, you in gear | 58% | 50% | 40% |

Their bag alone changes nothing you can measure. Your bag is worth about 5 points, and a full set of gear on top about
5 more at tiers 2 and 3: together, most of a tier. No single piece or potion was measured on its own.

**Superstars** (`python3 test/realm_stars_lab.py 60 '' hk`, 60 games each, even level, tier 2; an ordinary sixth
player won 43%): Kraken 53% (in goal in 88% of games, and the only one with a positive margin), Djinn 53%, Hydra 48%,
Phoenix 43%, Frost Wyrm 42%, Behemoth 37%. At 60 games a cell is good to about 6.5 points, so only the Kraken and the
Djinn are clearly worth more than an ordinary player, and the Behemoth (slow feet on a long sheet, as on the court)
may be worth less.

**After the first games by hand** (the same lab, 100 a cell). Skating is quicker and follows a player's speed more
(top speed 5 + 0.52 a point of speed, from 5.4 + 0.42; getting to it 5.5 + 0.85 a point, from 4.5 + 0.5). Powers are
one and a half times as strong (`HK_POW_K`), mana starts at 4 of 8 and one comes back every 30 seconds of play, and an
ultimate takes 50 of the roar. Powers on one side only are now worth 1.19 goals a game and 69 wins in 100 (from 0.24
and 54), with about 22 casts a game. As the world sets tiers: 73%, 37%, 19% (from 59/40/21); tiers 2 and 3 are inside
the noise, and tier 1 may now be easier (a Squire spends his mana worse), though the mixed-gap cell beside it read
54%. The systems, special teams, cups and kits above were not measured again.

## Your following (issue #79)

`python3 test/realm_lab.py N '{}' 'W_FOLLOW.lab = true'` runs the journeys with the following's effects on; without the
override the bots play as before (the effects are off in LAB mode), so every other number in this file is unchanged.

**How many fans a journey holds** (150 journeys, a bot that never spends them). The issue guessed 300 to 600 at the end.
It is about three times that: the card game pays fans for every win.

| Stage | Day | Fans, median | 10th to 90th |
|---|---|---|---|
| The first cup (Moss) | 2 | 97 | 44 to 170 |
| The first dungeon | 3 | 226 | 150 to 302 |
| The second cup (Salt) | 8 | 342 | 217 to 472 |
| The third cup (Cinder) | 13 | 692 | 498 to 852 |
| The fourth cup (Rime) | 17 | 1,138 | 868 to 1,357 |
| The Crown | 22 | 1,515 | 1,074 to 1,763 |

So the steps are **100, 400, 900 and 1,500** (the issue's first guess was 25, 100, 300, 750, which a journey passed by
day 12): a few regulars in the first region, a supporters' club in the second, a travelling army in the third, and a
household name only for a team that reaches the Crown having kept its fans.

**Phase 2, the gate and the away end in the card game** (250 journeys each way): champion 78.0% without, 76.0% with;
gold earned a journey 2,908 and 2,883. No difference you can measure (250 journeys is good to about 5 points). The bot
plays few matches at grounds, so the gate (at most 20 gold a match, 30 with a travelling army, doubled at home) is
hardly seen in these numbers, and 3 Block at kickoff away from home is small beside a deck. That is the aim: felt, and
never the reason a match is won.

**Phase 3, the lift in the engines** (300 seeded headless games a cell, even clubs, both coaches Knights, the fans on
your side only; a cell is good to about 6 points, and one changed start value changes every game after it, so the
cells are independent draws). The away end is 10 spirit to start (a mana in football); a travelling army gives the
same again, once, when you are behind going into the last period.

| | No fans | The away end | And the late lift |
|---|---|---|---|
| Hockey | 53.7% | 50.0% | 51.0% |
| Basketball | 52.7% | 56.7% | 56.7% |
| Football | 48.3% | 46.7% | 47.5% |
| Boxing (a bout) | 54.7% | 51.8% | 50.8% |

Nothing outside the noise in any sport, which is the aim (decision 3: felt, and never the reason a game is won). The
size is small beside what a side earns in play: an ultimate costs 50 to 60 spirit, and a hockey goal alone is worth 18.
Football's lift was first half a mana, which bought nothing at all (every cost and gain there is whole, and the two
runs came out identical), so it is one.

**Phase 4, the Supporters' Stand** (300 journeys each, the following's effects on). The lab's bot spends fans when
told what following to keep (`'{"spend": 400}'`): above it, a mascot once, then a fan favourite for its lowest
starter, then a whip-round. It does not walk to the Stand. Prices are three times Sudden Death's fan stand: Open
training 350, Whip-round 150 (for 50 gold), Fan favourite 450, Mascot 750 (900 since the second pass, below), the coach
250, a testimonial 600.

| The bot keeps | Champion | Fans at the end | Favours a journey |
|---|---|---|---|
| Everything (never spends) | 78.3% | 1,397 | 0 |
| A travelling army (900) | 82.0% | 1,272 | 1.4 |
| A supporters' club (400) | 82.0% | 898 | 3.5 |
| Nothing | 83.7% | 601 | 4.8 |

Spending is worth about 4 points of champion rate (a cell is good to about 5, and all three spending rows sit
together above the row that never spends), nearly all of it from the first favour, the mascot: an uncommon trophy.
Favours after it add little. **Holding looks like it is worth nothing here, and that is the bot, not the game**: its
journey is the card game on the road, with few matches at grounds and none in the engines, so it never sees the gate
or the lift. Whether holding a big following is a real rival to spending it has to be judged by hand; if it isn't,
the mascot's price is the first number to raise.

**A second pass** (300 journeys each, the effects on). The mascot was the one favour that showed, so its price went
from 750 to 900 fans, and the three rows were run again: never spending 80.7%, keeping a supporters' club 79.3%,
keeping nothing 79.3%. Set beside the first run (78.3%, 82.0%, 83.7%), the honest reading is that **spending and
holding cannot be told apart by this bot at 300 journeys**: the first run's four points were mostly noise, and the
never-spending row alone moved 2.4 points between the two runs. The mascot stays at 900. The fans' gate is now paid at
hockey, basketball and football games and boxing cards as well as card matches at grounds; the bot plays none of
those from the world, so that is not in these numbers either.

## Golf at Mossgate Links (issue #92, phase 10)

`python3 test/realm_links_lab.py N`: every match is the golf engine played to a final, headless, as Simulate plays it
(nine holes of captain's choice match play on the standing nine, a breeze, the wood and the enchanted course on, powers
on), your four caddied as a Knight, theirs at the tier's skill. A player's six ratings are rolled a point either way,
so **every match draws both fours afresh** (your kinds at your level, and theirs): one draw is luck, and the lab's first
version, which drew them once, read 26% and 73% for the same "even" match on two runs. Match play is noisy: a cell of
400 matches is good to about 2.5 points either way. About 3 ms a match; 14% go to a playoff, and about half are settled
before the 9th. No match ends level.

**Tiers, as the world sets them** (400 each; their level yours plus the tier less one, extra rating points on each of
their four, `W_LKG.oppBonus`, and their caddie by tier). A journey's rival clubs are drawn afresh, and a club's own kinds
swing a match more than the tier does (one run met an ogre, minotaur, troll and golem four and read nothing like the
next), so the cells go round every club, a match each. Over three journeys:

| | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Win | 66 to 79% | 46 to 54% | 20 to 24% |

Beside hockey's 59/40/21% and basketball's 57/44/26%. The bonus was raised from the court's 0/2/5 to 2/4/7: at 0/2/5
tier 1 read 78% (a Squire's four of local kinds against your elf and spider). Tier 1 is still a little generous; it is
the first number to look at if golf feels easy by hand.

**Level gap** (even kinds, both Knights, no bonus): a level below 58%, even 50.5%, +1 43%, +2 42%, +3 37%. A level is a
rating point a player spread over six ratings, so it counts for less than in hockey (+3 there is 28%).

**Their caddie** (even level and kinds): Squire 69%, Knight 48%, Archmage 32%. Caddie against caddie with the same four
(150 to 300 each): a Knight beats a Squire about 59 in 100, an Archmage a Knight about 70. The Squire was retuned: as first
written (a third more swing error, no wind read at all) your side beat one 95% of the time; now its swing error is
1.05 times a Knight's and it reads 40% of the wind, and it still takes the driver everywhere and goes for everything.

**Powers** (even): both 48%, neither 49%, yours only 59%, theirs only 42.5%: powers don't tilt a match between sides that
both have them, and a side with them gains about 8 to 10 points. About six everyday powers a side a match.

**Your line, fixed all game** (theirs their caddie's): Go for it 53%, Percentages 48.5%, the caddie's own (Auto) 48%,
Lay up 31.5%. No line called every time beats the caddie by more than the noise. Laying up every shot is a bad way to
play, as it should be: it is for the shots with water on the line.

**Your stance, fixed all game** (600 each; and 2,000 in the bare engine, without powers or the course's ways):
Steady and Careful 54% (50%), Steady and Bold 43% (46%), Quick and Careful 44% (46%). Fixed all game, Bold and Quick each
cost a few points: Bold is for when you need the variance (behind late), Quick for when focus runs low. Two things were
fixed on the way: the CPU's planner did not allow for Bold's extra distance (every bold CPU shot flew 5% past where it
aimed), nor for a webbed ball's half-length shot; and Bold's miss and Quick's were made smaller (from 1.15 and 1.06 to
1.03 each).

**Gear and potions** (by tier, 400 each): plain; their bag only (`W_LINKS_KIT.opp`, as Simulate plays it); both bags
(yours a full one, given by your caddie as a Knight would); the full kit (both bags, and your four in gear, a +1 piece
each on their key rating).

| | Plain | Their bag | Both bags | Full kit |
|---|---|---|---|---|
| Tier 1 | 73% | 80% | 81.5% | 87% |
| Tier 2 | 56% | 54% | 57.5% | 64.5% |
| Tier 3 | 25% | 23% | 24% | 37% |

Potions are worth little, inside the noise: the CPU's caddie at first never gave one (its thresholds were out of reach),
and was lowered to give at value 2.5 (a Knight) and 2 (an Archmage). Gear is worth 7 to 12 points for four pieces, about
3 a piece: no single piece decides a match.

**The enchanted course** (even, 400 each): on 46%, off 52%; a side a level down wins 51% with it on and 44% with it off.
The traps fall on both sides alike, and add a little luck that helps the weaker side, which is the point of them.

**The hitter rule** moves about 20% of a side's shots off their role's player (the rule: the first four shots of a hole
four different players, then nobody twice running).

**Divot Cups** (400, Simulate every round): won 14.5%, out in the quarter-final 25%, the semi-final 30%, the final 31%.

### One thing at a time (issue #95)

`python3 test/realm_links_lab.py 300 '' single`: each power, piece of gear and potion on its own, even level, both
Knights, against the same match without it (300 a cell: about 2 to 3 points either way).

**Powers.** For each kind, a four of that kind, with only that one power castable by your side (the engine's lab-only
`powOnly`) and none for the other side, against the same four with no powers. All four players cast it, so these are
upper bounds: in a real four only one player has the kind. Most powers move a match by less than 5 points. The ones
that stand out:

| Power | With it | Without | Casts a match |
|---|---|---|---|
| Elf: Starlight (short) | 61.7% | 43.7% | 8.1 |
| Elf: Arrow (long) | 60.0% | 43.7% | 5.0 |
| Kraken: Eight Arms (short) | 61.7% | 47.3% | 6.4 |
| Goblin: Sticky (short) | 26.0% | 13.0% | 5.9 |
| Gorgon: Scaled (second short) | 42.7% | 29.3% | 6.4 |
| Frost Wyrm: Cold Blood (second short) | 65.3% | 54.7% | 7.6 |
| Phoenix: Ember Putt (short) | 38.0% | 28.0% | 7.1 |
| Wraith: Cold Putt (short) | 33.7% | 23.7% | 6.8 |

The biggest, spread over a mixed four, is worth less than one side's whole set of powers (about +9 to +10). No single
power decides games. Starlight and Arrow are the first to look at if the elf feels strong by hand. The situation powers
(dormie, playoff, up and down) and Steady are all inside the noise: 47% without, 50 to 52% with each.

**Gear,** one piece on the player whose role uses it (none 49%):

| Piece | Win |
|---|---|
| True Irons (+1 accuracy, approach) | 60.0% |
| Mossgate Driver (+1 power, tee) | 54.7% |
| Old Putter (+1 putting) | 52.7% |
| Soft Wedge (+1 touch) | 51.3% |
| Calfskin Glove (a fifth less focus) | 50.7% |
| Lucky Tee (a power shot's mark shrinks less) | 49.3% |

This corrects phase 10's "about 3 points a piece": accuracy is the strongest rating in the shot model (the mark's width
and how far a miss strays), so the Irons are worth about 11 points on their own, the rest 0 to 6. The Irons are the piece
to watch; no piece decides a match.

**Potions,** two of one kind in your bag, given by your caddie as a Knight would (none 49%): Agatha's Oil 55.7%, Still
Water 52%, Moss Tonic 48.3%, Stamina Draught 45%. All small.

**A note on ids:** the dwarf's short-game power is `steady`, the same id as the roar's Steady. Play tells them apart (one
is a power cast, `k: 'pow'`, the other `k: 'steady'`), but anything keyed on a cast's id alone, like the lab's `powOnly`,
treats them as one.

### The other engines, before and after golf (issue #95)

#92 asked that the card game and the other five engines read the same before and after it. No code of theirs
changed (the shared seeded random function was refactored to give the same numbers). Their labs after golf, at 120 to
200 a row, against their last recorded tiers:

| Sport | Recorded (tiers 1/2/3) | After golf |
|---|---|---|
| Baseball | 49 / 56 / 32 | 50 / 51 / 26.5 |
| Football | 51 / 41 / 19 | 55.5 / 44 / 24.5 |
| Boxing | 53 / 39 / 26 | 48 / 46 / 23 |
| Basketball | 57 / 44 / 26 | 68 / 47.5 / 30, and 66 / 41 / 24 |
| Hockey | 73 / 37 / 19 | 53 / 30 / 18, and 55 / 39 / 25 |

Basketball's and hockey's tier 1 moved, in opposite directions, so both were run on the build just before golf (the
commit before #93's merge, same lab): basketball 62 / 45 / 24, hockey 59 / 38 / 22.5. After golf is inside the noise of
those (two 120-match runs are good to about 6 points), so the engines read the same; the recorded numbers above are
older than later changes, and these labs draw each journey's rival clubs once, which swings a tier cell (as phase 10
found in golf).


## Bowling at the Saltmere Lanes (issue #100, phase 10)

`python3 test/realm_lanes_lab.py N`: every game is the bowling engine played to a final, headless, as Simulate plays it
(one Baker game of ten frames, the hall on, the tide mid, powers on), your five bowling as a Knight, theirs at the tier's
skill. Every game draws both fives afresh, and **each cell has its own run of seeds**: the first version gave every cell
the same 200 seeds, and that one run's luck put side 0 at 55 to 62% in every "even" cell. About 40 ms a game; a cell of
400 is good to about 2.5 points either way, 150 to about 4. A roll-off settles about 1 game in 100.

The first run found five things wrong, all fixed before these numbers:

1. **Levels didn't matter.** Their five three levels up won as often as an even five (52%). A level is one rating
   point to one of six ratings, and each point was worth too little. Accuracy, spare, power and revs now reach further
   (`BL_REACH` in `10-ratings.js`), and an average bowler (6.5) is where they were.
2. **Power and revs made a bowler worse.** They set the ball's speed and revs outright, and the lane has a sweet spot
   (about 16.8 mph and 350 rpm: 43% strikes there, 30 to 33% at the corners of the range). +3 power or +3 revs cost
   about 9 points. Now they set the speed and revs only within a narrow band round the sweet spot, and pay in a wider
   pocket on the strike ball (a strong, spinning ball strikes from further off the line) and in drive through the pins.
   Each rating +3 on all five, against the same five (500 each): accuracy +15, revs +9, power +5, nerve +5, spare +3,
   read +2.
3. **A line fixed up the boards beat everything** (65% against the captain's own 53%), and Deep inside lost (37%).
   With both sides on one line, strikes are level from `blStand`'s stand out to 4.5 boards further out and fall off
   fast either side. And the line didn't really move anyone: a Knight tries three stands two boards apart and the
   line only shifted the set, so the sets overlapped and every line picked the same stand. Now the best stand is
   found round a point two boards out from `blStand` (`BL_LINE_BASE`), and the line moves the feet off it (deep two
   boards in, up the boards two out). The CPU moves up the boards when its track dries (onto fresher oil), not deep.
4. **The Squire lost 87% of the time,** so tier 1 read 90%. It now plays spares (as the others do) from one of two
   stands, with a little less miss. Every skill's miss is a fifth wider than before (which keeps Knight against Knight
   near 195), and the gaps between the three are as they were.
5. **The skid curses decided games.** A Hex (the oil plays heavy for their next ball) was worth +24 to +31 points on a
   five that casts it: the CPU plans for the oil it sees, so a ball that skids long misses the pocket badly. Skid is
   a touch now (Hex and the Coven 1.06, Iced Lane 1.04, Chill and Mirage mostly a wider miss), and the harpy's Gust
   wobbles less.

**Tiers, as the world sets them** (400 each; their level yours plus the tier less one, `W_LNG.oppBonus` extra rating
points on each of their five, now 1/1/1 from 2/4/7, and their skill by tier), round every club (600 each):

| | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Win | 74% | 50% | 23% |

With the bonus at 2/2/2 it read 70/43/22%; with 2/3/4, 75/46/14.5%. Since the ratings reach further, a point counts.

Beside golf's 66 to 79 / 46 to 54 / 20 to 24%, hockey's 59/40/21% and basketball's 57/44/26%.

**Level gap** (even kinds, both Knights, no bonus, 400 each, over two runs): a level below 50 to 60%, even 50 to 53%,
+1 48 to 51%, +2 46.5 to 47%, +3 45.5 to 48%: 2 to 4 points a level, less than golf (where +3 is 37%). A level is one
point on one of six ratings, and the tier's skill counts for more. **Their skill** (even, over two runs): Squire 70 to
75%, Knight 50 to 54%, Archmage 18 to 27%.

The cells below are from the run before the line's last change, and were measured again on the final settings (300
each, about 4 points either way): powers both 51.7%, neither 60.3%, yours only 59%, theirs only 48.3%; tempo and ball
fixed 44 to 53%, none above the noise; the full kit 81.7%, 54.7% and 19.7% by tier against plain 75.7%, 52.7% and
22.3%; the hall on 55.7%, off 51.3%. The same picture.

**Powers** (even): both 56%, neither 52%, yours only 56%, theirs only 45%: worth about 5 or 6 points to a side that has
them and the other doesn't (golf 8 to 10), and nothing between sides that both do. About five everyday powers a side a
game.

**Your line, fixed all game** (theirs their own call, 400 each): the pocket 53%, the captain's own 50%, Up the boards
40%, Deep inside 37.5%. The other lines are for a moment, not a game: deep is the gamble when behind late, the boards
for a dried lane or a lead to keep. Every ball off the pocket line costs, as laying up every shot does in golf.

**Your tempo and ball, fixed all game:** Steady and heavy 52%, Quick and heavy 51.5%, Steady and light 47%, Quick and
light 47%. The light ball costs a few points fixed all game: it is for a tired arm.

**Gear and potions** (by tier, 300 each): plain; their bag only (`W_LANES_KIT.opp`); both bags; the full kit (both bags,
and your five in gear, a piece each).

| | Plain | Their bag | Both bags | Full kit |
|---|---|---|---|---|
| Tier 1 | 71.7% | 73.3% | 73% | 75.7% |
| Tier 2 | 49% | 43.3% | 53% | 52% |
| Tier 3 | 17.3% | 19.7% | 20.7% | 21% |

Potions are worth little, as in golf; the full kit about 3 or 4 points.

**The hall** (even, 300 each): on 52%, off 50%; a side a level up wins 48% with it on and 48% off. The tide moves
scores (low tide about 10 pins down for both sides), not who wins.

**Gutter Cups** (600, Simulate every round, the final best of three), by the rounds' tiers:

| Rounds | Won | Out in the QF | SF | Final | Finals to a third game |
|---|---|---|---|---|---|
| 1, 2, 3 | 4.8% | 28% | 34% | 33% | 35% |
| 2, 2, 2 | 14.3% | 50% | 22% | 13.5% | 49% |
| **1, 2, 2** (now) | 25.5% | 25% | 34% | 16% | 44% |

Golf's Divot Cup is won 14.5%. The Gutter Cup is set at 1, 2, 2 (a weaker side first, then two at your level), which is
generous; `W_GUTTER.tiers = [2, 2, 2]` is the lever if the cup comes too easily by hand.

**Reading the transition** (`read`, 400 each; lab-only switches: `noRead` plans a side's balls on the fresh lane whatever
it has become, `wear: false` keeps the lanes as dressed). An Archmage that moves (reads the oil as it is and changes its
line) against one that doesn't (plans on the fresh lane, the pocket every ball): 63%. With the transition off, 46.5%:
reading is worth about 13 to 15 points, and only because the lanes change. Knight against Knight scores 206 with the
transition on and 211.5 with it off (54 and 58% strikes): the worn lanes cost both sides about 6 pins. (Archmage
against Archmage averages about 238, 70% strikes.)

**The order** (your five in the order the ratings suggest, in its reverse, and shuffled; 400 each): 50%, 52%, 50%. The
order hardly changes a result: the anchor's nerve counts only in the tenth, and every bowler bowls two frames. It is
there for the feel of a lineup more than for the score; giving it teeth (a lead-off's strike setting up the next
bowler, say) would be its own change.

### One thing at a time

`python3 test/realm_lanes_lab.py 150 '' single`: for each kind, a five of that kind with only that one power castable
by your side (`powOnly`) and none for the other side, against the same five with none (150 a cell, about 6 points
either way; all five cast it, so these are upper bounds). Most powers sit inside the noise. Measured again at 300 after
the skid change: the witch's Hex 51% (none 40%), the Frost Wyrm's Iced Lane 83% (none 68%, before the last trim to
1.04), the Djinn's Wish Ball 77% (none 62%), the wraith's Ghost Ball 58% (none 51%). The situation powers and Steady,
each piece of gear on all five, and each potion two in the bag are all within the noise of none.

### Superstars on the lanes (issue #100, phase 11)

`python3 test/realm_stars_lab.py 200 '' bl`: four of your own and one more player as your five (the order set by the
ratings), a whole game Simulated at an even level against a Knight's five (tier 2), the hall and powers on. Against the
control (a league kind the team lacks), 52%: the Phoenix 52%, the Kraken 51%, the Djinn 51.5%, the Hydra 63.5%, the
Frost Wyrm 56%, and the Behemoth 40.5%. One bowler of five bowls two frames, so a superstar moves a game less than in
the other sports. The Behemoth's 4s in revs, accuracy, spare and read cost more than its 12 in power earned, so they
are 7, 7, 6 and 6 now (nerve 10): 53% against the control's 49% (300 each).

## Curling at the Curling Shed (issue #102, phase 10)

`python3 test/realm_shed_lab.py N`: every game is the curling engine played to a result, headless, as Simulate plays
it (6 ends, the Shed's ways on, powers on), your four curling as a Knight, theirs at the tier's skill, the hammer to
each side in turn. Every game draws both fours afresh and each cell has its own run of seeds. About 0.6 s a game, so
the lab is slow: the main parts at 100 a cell take about 50 minutes, the single parts at 40 about the same; a cell of
100 is good to about 5 points either way, 40 to about 8. A head-to-head check in node (the engine alone, the rinks
swapping sides) is faster for one question at a time.

The first run found two things wrong, both fixed before the numbers below:

1. **The Squire lost 99 to 100% of the time** to a Knight, so tier 1 read 95%. It now misses less (`ang` .45 to .33,
   `v` .022 to .016), weighs its best two shots twice each, which (weighing more than one) also brought in both
   handles and the hit and roll (it had one handle and no hit and roll; with the rest of the change and the old list
   it was still 91%, 150 games: the wider list is most of it), and its
   sweepers start from 300 inches past the hack rather than halfway: a Knight beats it 83% (150 games in node), 84 to
   87% in the lab.
2. **Granite decided games.** A golem's Granite Stone (the draw power: once at rest, the stone is heavier) won 80%
   against the same four with no powers (120 games). Granite is now twice an ordinary stone, not three times
   (`CR_GRANITE`): 58%. Measured again at 100 a cell in the lab, the granite on a hitting stone was still strong (a
   takeout that sticks and won't be moved): Stone Wall 71% against 60% with none, the troll's Boulder 60% against
   37%, Troll Bridge 54%, the Kraken's Grasp 65% against 60%, the Behemoth's Mountain Stone 79% against 66%; the
   Granite Stone 61% against 60%. Granite is cast on nearly every stone that matters, so a granite power now costs 3
   mana, not 2 (`CR_MANA.granite`): in node (150 games) Stone Wall 70% to 63% against 55%, the Boulder 49% to 56%
   against 45% (within the noise). The cost works through how often it is cast: a golem rink with only Stone Wall to
   cast threw it 15.7 times a game at 2 mana and 10.8 at 3 (100 games each), 71% and 63%. Mana is the limit for you as
   for the CPU, so a player who casts it on every stone that matters is held to about as many. The troll's Troll Bridge (an ultimate: granite on every stone of one end, 54% against
   37% at twice) is paid from the roar, once a game, and is left as it is.

**Tiers, as the world sets them** (100 each; their level yours plus the tier less one, `W_SHG.oppBonus` a point on each
of their four, their skill by tier, round every club):

| | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Before | 95% | 43% | 32% |
| After | 80% | 49% | 31% |

**Their skill** (even level, your Knight): a Squire 84% (99% before), a Knight 53%, an Archmage 31%. The ladder with the
same four on both sides: an Archmage beats a Knight 70%, a Knight beats a Squire 87%.

**What stayed as it was, and why:**

- **Levels matter, but not much.** In node, a rink with 3 more rating points a player (about three levels) wins 60%,
  with 6 more about 56%, with 12 more 74%; the lab's level gaps (-1 to +3, both Knights) read 39 to 54% with no clear
  trend. More reach for the ratings (`CR_REACH` drw 1.6, lin and hit 1.4) didn't read any better at 100 games, so it
  was left. Curling here is decided mostly by the call and the miss (the skill), which is what the tiers turn.
- **Sweeping is worth about 6 points.** Head to head in node (200 games), a rink that sweeps beats one that doesn't 56%;
  it lifts shots made from 73% to 81%. In the lab's separate cells the win rate didn't move (on 46 to 50%, off 49 to
  50%), within its noise. Sweeping less hard on the curl (`sweepCurl` .4 to .2) read no better (52%), so it was left.
- **The hammer is worth a lot.** With the hammer in the first end your Knight wins 69% (a margin of +0.6); without it,
  25% (-0.8). Ends a game (6 ends): about 3.5 singles, 0.5 twos, 0.05 big ends, 2.1 blanks and 0.5 steals, which is
  low scoring, as club curling between careful skips is.
- **Powers** (even level, both Knights): both 49%, neither 49%, yours only 64%, theirs only 34%.
- **The pebble and the Shed** (an Archmage against a Knight): the wear on 68%, off 75%; the Shed's ways on 67%, off 72%.
- **Gear and potions** move a game by a few points at most (tier 2: plain 44%, their bag 47%, both bags 48%, the full
  kit 45%); the side with the tier 3 bag in node: 45 to 49%.
- **The Brass Broom** (Simulate every round, their bags in): won 15% before, 19% after; out in the quarter-final 17%,
  the semi-final 40%, the final 24%.

### Harder to make a shot (after play)

Played by hand, curling felt too hard to score: every stone you got into the house was knocked out. The numbers agreed:
takeouts were made 89% of the time by a Squire, 93% by a Knight and 99% by an Archmage (60 games a skill, in node), and
a curler's ratings moved their miss only a little. Three changes:

1. **A hit has its own, wider line** by skill (`CR_SKILL` `hitAng`: a Squire .7, a Knight .46, an Archmage .36 degrees,
   against .4, .3 and .22 for a draw): a takeout at full weight misses by its line, where a draw misses by its weight.
   Draws are a little harder too (`v` .022, .016, .011).
2. **Ratings reach further,** as a multiplier: a curler's miss is `exp(reach x (.5 - rating))` of the skill's
   (`crReachK`, `CR_REACH` drw, lin and hit 1.4), so one rated 1 misses about twice as wide as an average curler and
   one rated 12 about half as wide. Draw, line and hit 10 against 3 (both Knights): 85% before, 99% now. Three more
   rating points a player wins 61% (60% before), six more 68% (56%), twelve more 75% (74%).
3. **Your own stones answer to your curler's ratings:** the line off your aim (`CR_PLAY.you` .25 degrees, a hit's .4,
   from .12 for both) and a small part of the weight on top of the meter's (`v` .01), each times the curler's own
   ratings.

Shots made by skill (60 games, in node): takeouts 53%, 73% and 85%; draws 53%, 69% and 83%; points a game rose. The
lab (100 a cell): tiers 98%, 53% and 24% (80%, 49% and 31% before); against a Squire 94%, a Knight 50%, an Archmage
20%; an Archmage beats a Knight 82% and a Knight beats a Squire 95% (70% and 87% before); your rink scores 6.8, 3.3 and
2.7 points a game by tier (3.4, 2.4 and 2.2); shots made about 70% (80%); the Brass Broom won 24% (19%). The low skill
plays much worse, as asked, and both sides score more.

### One thing at a time

`realm_shed_lab.py 40 '' single` (40 games a cell, so about 8 points of noise; the granite rows were measured again
after the change). With only that one power castable by your side (a four of that kind against the same four with
none), most powers sit within the noise of their kind's "none". The stand-outs before the change were granite (the
golem's Granite Stone 75%, Stone Wall 85%, the troll's Boulder 72.5% and Troll Bridge 70%, against 47.5 to 50%), and the
sweeping powers read a little negative (Pack Sweep 27.5% against 42.5%, Broomstick 32.5% against 42.5%), within two
standard errors. The situation powers: the Hammer 62.5% and the Steal 67.5% against 45% (cast about once and a third
of a time a game), Extra End and Steady within the noise. Each piece of gear on all four: 35 to 57.5% against 47.5%;
each potion, two in the bag: 37.5 to 57.5% against 47.5%.

### Superstars on the ice

`realm_stars_lab.py 100 '' cr` (three of your own and the extra player as your four, at an even level against a
Knight, tier 2), on the build with granite at twice and its powers at 3 mana: the control (a league kind) 45%, the
Phoenix 47%, the Kraken 53%, the Behemoth 47%, the Djinn 65%, the Hydra 60%, the Frost Wyrm 50%. An earlier run (granite
at twice, its powers still at 2) read the control 37% and the Frost Wyrm 66%, and one at 60 the control 48%: the cells
move about 10 points between runs, so a superstar adds from nothing to about 20 points as one player in four. The
Djinn (+20 here, the best draw in the realm) is the one to watch; a run at 200 or more a cell would settle it.

## Pets (issue #104, phase 8)

The bot keeps a pet at its side from the start (`test/realm_lab.js`, `opts.pet`), feeds it when it goes hungry and
there is the gold, lets its bond grow from wins as a player's would, and throws its trick as a player would: a buff or
debuff from the second turn (at once in a hard match), damage when it finishes the weakest enemy or from the second
turn. `opts.petBond` starts it at a bond, `opts.petHungry` keeps it hungry, `opts.trick: false` never throws the trick,
`opts.rivals: false` takes the rival clubs' pets away. Per-match numbers are from `/tmp/realm_lab.json` (HP lost as a
share of max HP, over every match of every journey).

**First cut (as phases 0 to 7 shipped them), 60 to 120 runs a pet.** Far too strong: every pet lifted the champion rate,
most to 95 to 100% from about 75%, and blackouts fell from 3.3 to under 1 a journey. Half-scaling every number
(`PET.scale = .5`) barely moved it: the strength was in things that don't scale, a card drawn every turn, Stamina every
turn, Weak on every enemy at each kill, and in bond rounding a 1 up to 2 at bond 3.

**The retune.**
- Bond multipliers ×1/×1.5/×2 became ×0.7/×0.9/×1.1, rounding a half down (`PET.bias = .4`), so a 1 stays a 1.
- Bond comes slower: bond 2 at 12 points, bond 3 at 45 (was 6 and 16). The bot still reaches bond 3 by the end of a journey (about 48 wins).
- What suits a match is 15% a step (was 25%).
- The repeatable effects are capped:
  - the Blinkpup's fetch and the Sprite's Stamina, twice a fight;
  - the Bog Frog's draw on a fall, twice a fight;
  - the Jellycube's Weak and the Cockatrice's Exposed, every second turn;
  - the Mephitling's Weak, on the first fall only;
  - the Hootling's third-attack Strength, once a fight;
  - the Frostpup's breath, every fourth turn.
- Smaller numbers:
  - Blinkpup: its blink gives 2 Block (was 4).
  - Mephitling: hand Block 1 a card, at most 4; its sulk 1 Strength; Frost Puff Weak 1 and 4 Block.
  - Hippogriff: late Block 2.
  - Rustnibbler: Rust strips Block, not Strength.
  - Hootling: its Strength comes on the first enemy hit that leaves you below half HP, not at the start.

**After (100 runs each, skilled bot, rival pets on).** About ±5 points of noise on the champion rate at this size. (The Hootling's row is from after its trait settled on the first enemy hit that leaves you below half HP; no pet in that batch: 76%, 30.1%.)

| setup | champion | blackouts | match win | HP lost a match |
|---|---|---|---|---|
| no pet | 75% | 3.3 | 93.6% | 30.9% |
| Blinkpup | 85% | 2.3 | 95.6% | 25.4% |
| Pseudodragon | 88% | 2.2 | 95.8% | 26.2% |
| Axebeak Chick | 87% | 2.0 | 96.2% | 25.5% |
| Hootling | 92% | 1.5 | 97.0% | 27.4% |
| Sprite in a Jar | 81% | 2.5 | 95.4% | 27.4% |
| Bog Frog | 75% | 2.9 | 94.7% | 27.9% |
| Chestnut | 85% | 2.7 | 95.0% | 28.0% |
| Jellycube | 83% | 2.1 | 96.0% | 24.2% |
| Hatchling Hippogriff | 92% | 1.6 | 96.9% | 24.4% |
| Glowbeetle | 85% | 2.4 | 95.5% | 26.4% |
| Rustnibbler | 87% | 2.3 | 95.6% | 27.5% |
| Imp-in-Waiting | 78% | 2.5 | 95.3% | 28.1% |
| Frostpup | 90% | 1.4 | 97.3% | 20.2% |
| Mephitling | 91% | 1.5 | 97.0% | 22.9% |
| Cockatrice Chick | 84% | 1.8 | 96.7% | 22.6% |

A pet takes 10 to 25% off the HP a match costs. The Bog Frog and the Imp are the mildest. (The Hippogriff and the
Frostpup were toned down after this table: see the second retune below.)

**Second retune: the Hippogriff and the Frostpup (100 runs each, skilled bot, rival pets on).** They sat at the top
with the Hootling and the Mephitling, and added more than "a few points" of champion rate. Each was measured fresh,
then after each change.
- Hippogriff: its late Block comes every second turn from the fourth, not every turn; the bond 2 hit on the biggest
  enemy is 2 more, not 3; Swoop is 4 twice, not 5 twice.
- Frostpup: its breath Stuns once a fight, on the fourth turn, not every fourth turn; its Block below half HP is 2,
  not 4; Snow Breath (the trick) makes one enemy Weak 2 instead of Stunning it. The trick was most of its strength:
  without it, HP lost a match went from 21% to 27% and blackouts from 1.5 to 2.5, while taking its trait away moved
  much less. A Stun once a match is a free turn against the strongest enemy.

| setup | champion | blackouts | match win | HP lost a match |
|---|---|---|---|---|
| no pet (two batches) | 79%, 72% | 3.3, 3.3 | 93.9%, 93.5% | 30.1%, 31.4% |
| Hippogriff, before | 93% | 1.5 | 97.1% | 24.5% |
| Hippogriff, Block every second turn, Swoop 4×2 | 90% | 1.9 | 96.3% | 25.8% |
| Hippogriff, and the bond 2 hit 2 (shipped) | 79% | 2.1 | 96.0% | 27.3% |
| Frostpup, before | 92% | 1.5 | 97.1% | 21.6% |
| Frostpup, breath every fifth turn, Block 3 | 91% | 1.7 | 96.6% | 22.5% |
| Frostpup, breath once a fight, Block 2 | 89% | 1.5 | 97.1% | 21.4% |
| Frostpup, that, and no trick (diagnostic) | 84% | 2.5 | 95.2% | 27.1% |
| Frostpup, that, and no trait (diagnostic) | 85% | 2.1 | 95.9% | 22.2% |
| Frostpup, Snow Breath Weak 2 (shipped) | 83% | 2.0 | 96.1% | 25.8% |

Both now sit in the middle of the pack on blackouts and HP lost a match, which are steadier than the champion rate
at this size (the Hippogriff's 79% is low partly by chance; the two no-pet batches differ by 7 points). The Hootling
(92%) and the Mephitling (91%) are now the strongest.

**Bond, hunger, the trick and rivals (Blinkpup, 100 runs).**

| setup | champion | HP lost a match |
|---|---|---|
| bond growing from 1 | 85% | 25.4% |
| bond 3 from the start | 89% | 24.6% |
| kept at bond 1 all journey | 88% | 27.1% |
| hungry all journey (bond 1, halved) | 78% | 28.2% |
| no trick | 93% | 25.7% |
| no pet, rival pets off | 81% | 27.7% |

A hungry pet is worth little, which is the point of upkeep. The trick is a small part of a pet's worth; the run
without it landing higher is noise. The rival clubs' pets cost the bot about 3 points of HP a match and a few points
of champion rate.

**Upkeep against earnings.** A journey earns about 3,100 gold. One common pet costs 6 a week, about 100 a journey (3%);
a full kennel of six costs 40 to 90 a week, a third to a half of what a journey earns. That is the limit on
collecting. Treats are cheap (an 8-gold biscuit feeds a hungry pet), so hunger is a nuisance, not a trap.

## The Umbral Realm (issue #99)

`test/realm_umbral_lab.py N K` plays N journeys with the realm bot; each that wins the Crown then plays K matches of
each kind at full HP, at level 4, from the same team (team level about 10, a deck of about 110). A champion's team is
far stronger than a fresh one, so this is the honest measure of the dark side.

**The card game at tier U (phase 3).** An Umbral match is tier 3, then tier U: the other side has a quarter more HP
and 1 more Strength, each player its kind's dark trait, and you draw one card fewer (the Hall of Fame's draw).

| kind (60 journeys, 45 champions, 135 matches each) | win | HP lost a match | turns |
|---|---|---|---|
| light, tier 3 | 100% | 25.7% | 6.2 |
| dark, tier U | 95.6% | 39.9% | 8.4 |
| light elite, tier 3 | 90.4% | 55.3% | 10.1 |
| dark elite, tier U | 81.5% | 66.0% | 11.8 |
| the Gatekeeper, first cut (92 to 98 HP, alone) | 100% | 29.5% | 9.8 |

An ordinary dark match is still won, but costs half as much HP again as a light one: the dark side wears a team down,
and the lanterns are few. The Gatekeeper's first cut was a formality, so he was rebuilt and measured:

| the Gatekeeper (two hexes, a first try) | win | HP lost |
|---|---|---|
| 170 to 180 HP, hits 13 and 6×3, a Bone Lineman beside him (30 journeys) | 50.0% | 82.4% |
| 210 to 220 HP, hits 15 and 7×3, two Bone Linemen (30 journeys) | 2.3% | 99.7% |
| **150 to 160 HP, hits 12 and 6×3, a Bone Lineman beside him (45 journeys, 68 matches)** | **55.9%** | **76.8%** |

The last is kept: the gentlest of the nine, won about half the time on a first try by the team that won the Crown, and
every try after the first costs a toll.

**After the review (three traits fixed).** The first measurements had the dwarf's, ogre's and wraith's traits doing
nothing (the engine has no Plating or Phased for the other side); they now give starting Block (and the wraith 1
Strength). Measured again (60 journeys, 44 champions, 132 matches each):

| kind | win | HP lost a match | turns |
|---|---|---|---|
| light, tier 3 | 99.2% | 27.4% | 6.5 |
| dark, tier U | 91.7% | 43.8% | 8.2 |
| light elite, tier 3 | 85.6% | 62.3% | 10.1 |
| dark elite, tier U | 66.7% | 75.0% | 12.0 |
| the Gatekeeper | 47.0% | 80.0% | 12.4 |

About ±9 points of noise on the Gatekeeper at this size: the two batches (56% and 47%) agree on about half.

### Umbral: football (#99, 4b)

`python3 test/realm_gridiron_lab.py N '' umbral` plays only the Umbral part: your seven at level 3 under Simulate (you
cast as a Knight), at an even level. Tier U on the gridiron is tier 4 in the football tables: `W_GFG.oppBonus[4]`
rating points on each of their seven, the Lich coaching (skill 3: it reads the whole down and leans to the call with
the best matchup against what it expects, goes for it more on fourth down, swaps and drinks sooner), and their full bag
(`W_GRID_KIT.opp[4]`). Tiers 1 to 3 are untouched: with no hexes and no Lich the engine plays the same game seed for
seed (30 seeded games, before and after, identical), and the full lab at 100 a row reads as before (tier 3, all gaps:
21.8% before, 22.4% after).

**The Lich against the Archmage** (tier 2 ratings, no bags, 1,000 games each): you win 46.9% against an Archmage and
36.5% against a Lich. The Lich is ten points better from its decisions alone.

**Tier U.** First cut: 6 rating points (one more on every rating), the Lich and the full bag; the Nadir seven had an
ogre on the line and a harpy at receiver.

| even level, their bag | first cut (6 points, 200 games) | **kept (5 points, the Nadir seven with a dwarf and a goblin; 1,000 games)** |
|---|---|---|
| tier 3, a rival's seven (4 points, Archmage) | 29.5% | 27.2% |
| tier U, a rival's seven | 13.5% | **18.7%** |
| tier U, the Nadir seven (the champion's game without hexes) | 2.5% | **15.0%** |

The first cut's Nadir seven was out of reach. At 5 points tier U sits between tier 3 and the target's floor, and the
Cinder Pit's champion (Ossian Pyre at quarterback, with his own ultimate, Eclipse) is a little harder than a rival's
seven at the same tier.

**The hexes, each alone on the champion's game against none** (1,000 games each; about ±2 points of noise):

| hex | win | swing | your turnovers a game |
|---|---|---|---|
| none | 15.0% | | 0.19 |
| The Pit Closes (your end zone 5 yards out each quarter after the first) | 14.4% | -0.6 | 0.18 |
| Fumbles Roll Dark (you fumble twice as often; they fall on 92%) | 11.5% | -3.5 | 0.45 |
| Grave Cold (40% more stamina a play) | 16.0% | +1.0 | 0.19 |
| Ash Wind (your kicks 6 yards longer, punts 6 shorter; first cut 8) | 13.3% | -1.7 | 0.19 |
| **the champion as played, one hex drawn** | **13.2%** | | |

No hex swings a game by more than about 4 points, well inside the 10-point limit. Ash Wind at 8 yards cost 8 points in
a 200-game first look (noise at that size), and was cut to 6. Grave Cold barely shows: a game rarely runs a seven
below half stamina, where it starts to cost ratings; at twice the stamina (500 games) it was still -1.6. The champion
draws one hex a try (two, in the first look, put the bot at 11.5%): about 13%, a little under the 15 to 25% band (the
Gatekeeper, the gentlest of the nine, is about half); a careful human, calling the plays, wins far more.

### Umbral: baseball (#99, 4a)

`python3 test/realm_diamond_lab.py 600 '' umbral` (part 3 of the baseball lab; 600 Simulated games a row, your nine
of five at level 3, call-ups filling the rest). Tier U on the diamond is tier 4 in the ball game's tables: the Lich
(CPU skill 3) and `W_BALL.oppBonus[4]` on every rating of the other nine. The champion's game puts your nine, as an
Archmage, against the Bone Nine at your level (level parity): the Lich on their side only, the bonus, and the champion
on the mound with 2 more on every rating and her Dead Ball. Simulate plays it the same way, so it is no way round the
Lich. Tiers 1 to 3 are unchanged: with no hexes, 36 seeded games (each CPU skill, Auto powers on and off) play out
identically on the engine before and after this part, line for line.

**The Lich.** On the same nine, an Archmage against the Lich, against an Archmage against an Archmage (each row 600):

| run | Archmage v Archmage | Archmage v Lich | the Lich's edge |
|---|---|---|---|
| 1 | 57.2% | 43.7% | 13.5 pts |
| 2 | 60.0% | 44.3% | 15.7 pts |
| 3 | 58.3% | 44.8% | 13.5 pts |

It reads pitches sooner (aim error 0.13 ft against the Archmage's 0.19), times its swing tighter, chases less, times
its releases (always a good release, 40% perfect), throws a two-strike chase pitch more often, and fields, throws and
runs sharper. (The away side wins the even game a little more than half the time in these runs.)

**Tier U at level parity** (target 15 to 25% for the skilled bot):

| the rating bonus at tier U | your win | runs for-against |
|---|---|---|
| +2 (300 games) | 8.7% | 2.0-5.8 |
| **+1 (kept; three runs of 600)** | **23.7%, 22.2%, 19.8%** | 2.3-4.5 |

Tier 3 at +2 levels is 20 to 25% today, so tier U at parity sits with it, with the Lich and the champion doing what
the two levels did.

**Hexes, each alone against none** (600 games a row, the tier U setup; about ±2.4 points of noise on a difference):

| hex | first cut | second | kept |
|---|---|---|---|
| none (the base) | 23.7% | 22.2% | 19.8% |
| The Phantom Pitch | -1.3 pts (first ball in play an inning, never strike three) | +0.5 pts (any count) | +1.3 pts (the first ball hit hard) |
| Restless Bases | -4.2 pts | -4.3 pts | -2.5 pts |
| The Black Font | -7.5 pts | -3.5 pts | -1.2 pts |
| Grave Chill | +0.8 pts (timing window 5/6) | -0.7 pts (window 0.72) | -0.3 pts (swing circle 0.8) |
| the champion's game, two drawn | 17.5% (-6.2) | 17.2% (-5.0) | 14.7% (-5.2) |

No single hex moves the game by more than about 8 points in any run, inside the 10-point ceiling. Two together cost
about 5 points, steadily, so the champion's own game lands at 15 to 17.5%. The Phantom Pitch and Grave Chill barely
register for the bot (its swing rarely misses by the margin they take away); a human, who sees the ball go through the
bat and the smaller circle, feels them more. The Black Font's first-cut 7.5 points did not hold up in the later runs
(the code did not change), which is the size of the noise at 600 games.


### Umbral: boxing (#99, 4c)

`test/realm_ring_lab.py N --umbral` (parts 6 and 7 only). Cards as Simulate boxes them: your three at level 3 against
three at level 3 (level parity), your corner's pairing, your fighters boxing and casting as Knights; your bag stays
home, theirs is tier U's. Each card is seeded by its number (the journey, their side and the bouts), so the rows box
much the same cards; the realm still draws some of its own randomness, so blocks of 300 seeds differ by up to ±4
points, and the numbers below are 600 cards a row (1,200 for the hexes).

**Tier U** is tier 4 in the ring's tables: their rating bonus `W_BXG.oppBonus[4]` (tier 3's is 2), a full bag
(`W_RING_KIT.opp[4]`: one of each potion) and the Lich in their corner (CPU skill 3). The Lich is as sharp as an
Archmage (the same reading and timing numbers) and wins on its decisions (`BX_LICH`, 06-cpu.js): it slips more head
punches and every body shot, works the body of a fighter covering up, steps on the gas when the other fighter is
hurt, tired or on the ropes, saves its breath for the hooks that count, ties up sooner when hurt, reads the other
fighter's plan in the corner, sends the cut-man in sooner and opens the bag sooner.

| tier U at level parity | win |
|---|---|
| first cut: bonus 4, the Lich sharper than an Archmage (skill 3 on every scaled number), slip 0.8, gas 1.6 (120) | 5.8% |
| the same ratings, an Archmage in their corner (120) | 15.0% |
| bonus 1, the same Lich (200; two batches, 21.7% and 11.5%) | about 15% |
| bonus 3, the Lich only as sharp as an Archmage, slip 0.65, gas 1.3, cut-man at 70%, one of each potion | **17.3%** |
| the same, an Archmage in their corner | 25.2% |
| the same, no powers either side | 15.7% |

The Lich costs a skilled bot about 8 points of card win rate against an Archmage with the same ratings (in single
bouts, a Knight wins 31% against an Archmage and 26% against the Lich, 1,200 seeded bouts). Kept: bonus 3, 17% at
parity, inside the 15 to 25% target.

**Hexes** (14-hexes.js): one at a time against none, the tier U card. The first cut (water a half, leaden gloves a
quarter more breath, the Shrinking Ring a foot and a half, the Quick Count one more) at bonus 4 and then 1:

| hex | first cut (400 cards, none 13.0%) | kept (1,200 cards, none 15.6%) |
|---|---|---|
| The Shrinking Ring (the ropes 2 ft in a round, never under 5) | -1.0 | +3.5 |
| Tainted Water (four fifths of the break's breath and health) | -7.8 | -5.9 |
| Leaden Gloves (a punch costs a tenth more breath) | **-11.8** | -6.2 |
| The Quick Count (a count of two more to rise) | +4.0 (noise) | -0.9 |

No hex moves a card more than about 6 points. The Shrinking Ring closes in on both fighters, so it changes the fight
(more time on the ropes) more than it changes who wins; the Quick Count bites only on the knockdowns a bout has.

**The champion's card.** Brakka Knell (a minotaur with their own powers, Death Knell and The Last Bell, and nature,
Cracked Bronze), in the main event behind two Nadir boxers, all at tier U. Their card draws one or two hexes a try.

| the Nadir's card at level parity | win |
|---|---|
| first cut: a golem and a kobold before Brakka, Brakka 3 more points (200) | 2.0% |
| a zombie and a kobold, Brakka 1 more (300) | 6.0% |
| **an ogre and a dwarf (Ashmaw kinds), Brakka no more points: no hexes (600)** | **9.5%** |
| the same, the try's hexes drawn (600) | 4.2% |

The boss of the ring is harder than a tier U club by their powers and nature alone; a careful human in the corner (or
boxing the rounds) wins far more than the bot. Phase 7 measures it inside whole journeys.

### Umbral: basketball (#99, 4d)

`python3 test/realm_court_lab.py N '' umbral` plays only the Umbral part: your five at level 3 under Simulate (your
coach a Knight), at an even level, five minutes, the Charter Court's own ways on. Tier U on the court is tier 4 in the
basketball tables: `W_BKG.oppBonus[4]` rating points on each of their five, the Lich coaching (skill 3), and their full
bag (`W_COURT_KIT.opp[4]`). Tiers 1 to 3 are untouched: with no hexes and no Lich the engine plays the same game seed
for seed (40 seeded games against a build from before the change, at every skill pairing, length, with and without
powers, the ground and bags: score, box score, tally, subs, sets, timeouts and the scoring log identical). Games here
are short and swingy: blocks of 1,000 differ by up to ±4 points (tier 3 at an even level read 31.1%, 32.5% and 34.2%
in three batches), so the rows below are 1,000 games or more, and averages of batches where there are several.

**The Lich against the Archmage** (tier 2 ratings, no bags). The first cut decided only the calls: on defense it weighs
each defense by what your offense will run against it (a coach by hand keeps the set it called; a CPU coach leans to
what beats that defense; blended with what you have really run), on offense it changes sets before the scout catches
up, and its stances read the game. That was worth about 2 points (Archmage 39.7%, Lich 37.5%, 1,500 games each):
the Archmage already reads the defense on the floor and your habit, and most of what the calls are worth it had. Tried
on the floor, 1,500 games each against the Lich's 37.5%:

| the Lich also... | you win |
|---|---|
| waits for a better look (+.06 on the shot it takes), passes to a better one, reaches in half as often | 38.3% |
| no stances of its own | 37.3% |
| subs a tiring player later (35, not 50) | 37.6% |
| shoots sooner (-.05) | 39.7% |
| is up in time on the contest a share .3 more often | 36.8% |
| **plays a good shooter tighter and a poor one further off** (`BK_LICH.close` 1) | **33.4%** |
| **both** (close 1, jump .3) | **29.3%** |
| close 1.5 and jump .3 / close 2 alone | 28.7% / 31.0% |

Kept: the calls, and close 1 with jump .3. Scouting the shooters is the big one: the contest is most of a shot's odds,
and putting it where the shooting is wins far more than any call. Over three batches of 1,000 you win 43.4% against an
Archmage and 31.6% against the Lich: the Lich is about 12 points better on its decisions alone.

**Tier U.** First cut: 7 points, the calls-only Lich, the full bag (two Stamina Draughts, two Second Winds, Steady
Drops and two Hot Hand Elixirs); the Nadir five a vampire, a wraith, an elf, a spider and a golem, a zombie and a
skeleton on the bench.

| even level, their bag | tier U, a rival's five | tier U, the Nadir five (no hexes) |
|---|---|---|
| first cut (300) | 20.3% | 11.7% |
| 7 points, calls-only Lich, a skeleton for the elf, a witch on the bench (1,000) | 23.6% | 14.7% |
| 6 points, the same (1,000) | 24.1% | 17.4% |
| 6 points, **the sharper Lich** (close-outs and jumps), the same five (1,000 each) | 20.5%, 19.8% | 12.7%, 11.8%, 10.8% |
| the same, a zombie for the spider (1,500) | | 16.0% |
| **kept: 6 points, the sharper Lich, a zombie for the spider and a skeleton for the wraith** | **19.6%** | **16.9%** (1,000), **18.5%** (1,500) |
| (tier 3, a rival's five, 5 points and an Archmage, the same batches) | 31.1%, 34.2%, 32.5% | |

Tier U sits at 6 points (one more than tier 3): about 20% against a rival's five at level parity, inside the 15 to 25%
target. The Nadir five were out of the band with the sharper Lich: the spider's defense and the wraith's handle cost
most. Kept: Vesper Gloam (a vampire, at the point, with her own ultimate, Lights Out), two skeletons on the wings, a
zombie and a golem inside; a zombie and a witch on the bench: about 17.5% without hexes.

**The hexes, each alone on the champion's game against none** (1,000 games; first a rough 300-game look, with the
calls-only Lich; the figures in brackets are two batches with the sharper Lich against the five before the last swap):

| hex | first cut | **kept** | your FG / FT, against none's 42% / 66% |
|---|---|---|---|
| The Rim Drifts (your jumpers up to **8** points worse as the rim swings, layups a third; wild misses. At 9: -6.3 and -7.3; at 7: -3.6) | -6.3 | **-5.5** (also -5.7, -5.0) | 40% / 64% |
| The Shadow Sixth (once a quarter, a shadow defends one of your possessions) | -4.3 | **-3.9** (also -5.3, -2.1) | 40% / 65% |
| The Short Clock (a 10-second shot clock; then 7, then 6): **cut** | 0.0 | -0.9 at 7 s, +0.2 at 6 s | 42% / 64% |
| The Crooked Whistle (fouls on your five half again as likely), in its place | | **-1.3** (also -2.6, -3.0) | 41% / 63% |
| Cold Hands (your free throws 12, then **15** points worse) | -1.3 | **-1.4** (also -1.7, -0.8) | 41% / 50% |

No hex swings a game by more than about 6 points. The Short Clock did nothing at any length: the CPU rarely needs more
than 6 seconds, and both sides only played faster; it was replaced by the Crooked Whistle. Cold Hands is the gentlest:
a five-minute game has few free throws.

**The champion as played**, one hex drawn a try: **about 15%** (17.1% in 1,000, 13.8% in 2,000), inside the 15 to 25%
band. A careful human, calling the sets and timing the shots, wins far more.

### Umbral: golf (#99, 4f)

`python3 test/realm_links_lab.py N '' umbral` (the Umbral part of the golf lab). Matches as Simulate plays the Hollow
Links' champion: your four at level 3 (the journey's kinds) caddied as a Knight, against level 3 (level parity), nine
holes on the standing nine with the wood, the enchanted course and powers on. Every row draws match i's two fours from
the same seeded stream, so the rows in a run play the same players; a run's journey (its first player) is new each
time, and runs differ by up to 6 points, so two runs of 800 a row are given.

Tier U on the course is tier 4 in golf's tables: `W_LKG.oppBonus[4]` rating points on each of their four, a full bag
(`W_LINKS_KIT.opp[4]`: two draughts, Still Water, Moss Tonic, Agatha's Oil) and the Lich caddying (skill 3,
`src/gl/parts/14-umbral.js`). Tiers 1 to 3 are untouched: with no hexes and no Lich the engine plays the same round
seed for seed (36 seeded rounds across every skill, length, weather, the wood, the enchanted course, powers and bags,
before and after this part: identical, summary and shot log).

**The Lich.** It swings no better than an Archmage (the same error); before each stroke it hits every line (go, the
percentages, lay up), each aimed straight and a little left and right, 14 times in its head through the same shot
model, and plays the one that leaves the fewest strokes to hole out, unless the Archmage's own choice is within 0.03 of
a stroke. On the green it reads far better (read error 0.06 against 0.12) and weighs each pace the same way.

| even level, no bonus, no bags (your win) | run 1 | run 2 |
|---|---|---|
| their caddie an Archmage | 32.1% | 31.0% |
| their caddie the Lich | 22.4% | 24.8% |

Six to ten points from its decisions alone (over 600 rounds against a Knight, a Lich side takes about 0.07 strokes a
hole fewer than an Archmage side: fewer putts, more lay-ups to a wedge).

**Tier U.** Tier 3's bonus is 7 points at two levels up; golf's ratings are steep (one point on one rating a player
moved the parity match about 8 points in a fixed-four probe), so tier U's bonus at level parity is small and the Lich
and the bag do the rest. First cut 3 points (and the champion 2 more): the Nadir four at 14.7% with no hexes and 0% with
two. Kept: **1 point**, the champion no more (their own ultimate, The Hollow Flag, is their mark: within noise for the
bot, 16.3% against 19.4% in run 1, 12.8% against 13.4% in run 2).

| your win, level parity (800 a row) | run 1 | run 2 |
|---|---|---|
| tier 3, a rival's four as the world sets it (two levels up, 7 points, Archmage, bag) | 19.1% | 13.8% |
| tier U, your own kinds (1 point, the Lich, the full bag) | 15.8% | 15.1% |
| **the Nadir four, no hexes (the champion's game)** | **19.4%** | **13.4%** |

**The hexes** (14-umbral.js), each against your side, each alone on the champion's game:

| hex | first cut (300) | kept, run 1 | kept, run 2 |
|---|---|---|---|
| none | 14.7% | 19.4% | 13.4% |
| The Restless Green (a tilt no read sees under your putts: first 0.011, kept 0.003) | -13.4 | -3.9 | -2.3 |
| The Wandering Cup (the cup creeps from your ball: first 2 yd after any shot, kept 0.75 yd after a shot from off the green) | -13.0 | -5.8 | -4.3 |
| The Grey Fog (the flag seen off the green: first 6 to 10 yd, kept 2 to 3.5) | -11.4 | -4.0 | -3.1 |
| The Turning Wind (on your full shots: first a quarter turn and 4 mph, kept a twelfth and 1 mph) | -13.4 | -2.0 | -3.9 |
| **the champion as played: one drawn** | | **17.0%** | **9.4%** |
| two drawn (the finale's round) | 0% | 11.5% | 5.9% |

The first cut swung each by 11 to 13 points: the bot's game is precise, so a few yards cost a hole. Kept, none moves
the game by more than about 6 points. The champion draws one hex a try (two was 4 to 6 points more): about 13% across
the two runs, a little under the 15 to 25% band, as football's champion is; a careful human, who sees the fog and
reads the cup's creep, wins more.

### Umbral: hockey (#99, 4e)

`python3 test/realm_rink_lab.py N '' umbral` plays only the Umbral part: your six at level 3 under Simulate (your coach
a Knight), at an even level. Tier U on the ice is tier 4 in the hockey tables: `W_HKG.oppBonus[4]` rating points on
each of their six, the Lich coaching (skill 3, `src/hk/parts/16-umbral.js`) and their full bag (`W_RINK_KIT.opp[4]`).
Tiers 1 to 3 are untouched: with no hexes and no Lich the engine plays the same game seed for seed (60 seeded games on
the build from before this part and on this one, each CPU skill pairing, the pond and snow on and off, powers on and
off, bags, 3, 6 and 9 minutes: identical, summary for summary), so every hockey number above stands.

**The Lich.** On top of the Archmage it answers your call at every face-off (what beats your systems far more, what
loses to them far less), leaves a system you have scouted, matches your special-teams setups, changes lines sooner,
pulls its goalie sooner, looks harder for the pass across, and sends its checker at where your carrier is going (0.4
seconds ahead, against 0.22): that last one was worth the most against a Knight. The same six on both sides, the Lich
on each side half the time (800 seeded games a row):

| | win for the better coach |
|---|---|
| Archmage against Archmage (the control) | 48.1% |
| Lich against Archmage | 61.9% |
| Archmage against Knight | 56.4% |
| Lich against Knight | 65.1% |

Each part measured alone against the Knight (600 games): the answer to your call adds little against a Knight (who
answers nobody), the line changes and the pull a point or two each, and the checker's lead the most (+7). Waiting for
a better look before shooting measured at nothing and was taken out. In the lab's own row (your Knight against a
rival's six on tier 2 ratings, three runs of 600) an Archmage wins 38.5% of your games and the Lich 33.2%.

**Tier U** (600 games a row, their bag):

| even level | first cut (7 points, 600) | **kept (6 points, 600)** |
|---|---|---|
| tier 3, a rival's six (5 points, Archmage) | 23.7% | 24.8% |
| tier U, a rival's six | 18.2% | 22.2% |
| tier U, the Nadir six (the champion's game without hexes) | 14.3% | **17.3%** |
| the champion as played, one hex drawn | 12.7% | **18.7%** |

At 7 points the champion's own game fell under the 15 to 25% band; at 6 it sits in it, a little under tier 3 against a
rival. The Nadir six (Hollis Grael, a wraith, at centre with his own ultimate, The Long Night; a gorgon in goal) is
about as hard as a rival's six at tier U.

**The hexes, each alone on the champion's game against none** (600 games a row; about ±3 points of noise on a swing):

| hex | first cut (200 games, 7 points) | second (600, 7 points) | **kept (600, 6 points)** |
|---|---|---|---|
| The Ice Opens | -12.5 (three holes, the face-off in your own end) | -4.7 (three, at centre ice) | -2.3 (two, at centre ice) |
| The Wandering Net (1.3 m, then 1.8 m) | -6.0 | -0.5 | +1.0 |
| Grave Cold (35%, then 30% more tiring) | -10.0 | -1.3 | 0.0 |
| The Hollow Whistle (your fouls up to twice as often, capped) | -6.5 | +0.2 | +2.7 |

The first 200-game look had a lucky base (21%) and read every hex as costly; at 600 games only The Ice Opens shows
clearly, and it was the one that was cut (a face-off in your own end, three holes): no hex moves the game more than
about 5 points in any later run, well inside the 10-point limit. The Wandering Net and The Hollow Whistle barely touch
the bot: the net slides away from where the puck is, so it costs shots from the wings, and the bot shoots mostly from
the slot; a whistled side takes about 2.5 penalties a game instead of 1.3, and a power play here is worth little (see
the hockey notes above). A human, who sees the net wander and spends more time on the wings, will feel them more.

### Umbral: curling (#99, 4h)

`python3 test/realm_shed_lab.py N '' umbral` (the Umbral part of the curling lab; `... umbral nadir,rime` plays only
those rows, so rows can run in several processes). Games as Simulate plays the Sunken Shed's champion: your four at
level 3 (the journey's kinds) curling as a Knight, against level 3 (level parity), six ends, the Shed's ways and powers
on. Every row plays game i on the same seed with the same two fours (Math.random seeded while they are drawn), so the
rows are paired and a run is repeatable exactly; a hex's swing is measured on the same games as the row without it.
About 1.2 s a game with the Lich in the page, so the tuning was done head to head in node on the engine alone (400
games a row over ten processes, your four elf, spider, gorgon and dwarf at their kind's ratings, the same seeds in every
row), and the lab run at the end.

Tier U at the Shed is tier 4 in curling's tables: `W_SHG.oppBonus[4]` (1) rating point on each of their four, a full
bag (`W_SHED_KIT.opp[4]`: two Stamina Draughts, a Warming Draught, two Frost Salts and Hennock's Pebble) and the Lich
skipping (skill 3, its own row `CR_LICH` in `src/cr/parts/15-umbral.js`, so the exhibition still offers three skips).
Tiers 1 to 3 are untouched: with no hexes, no Lich and no curler's own ultimate the engine plays the same game seed for
seed (36 seeded games across every skill pairing, length, cold, the Shed's ways, powers both, one side or none, bags and
the free guard zone, before and after this part: identical summaries; and three games played through the page's own
beat in Watch, ticked to the end with a snapshot every 400 ticks: identical).

**The Lich.** It throws no better than an Archmage (the same miss). The first cut decided more: more shots (draws to
five more spots, three more guards, a takeout of each of their stones in the house hit a little thin either way), its
best six over six throws each, six replies weighed in at 0.35; and its sweepers read the stone as it runs (every
quarter second of the stone's run they play it on, alone on the ice as it is now, swept not at all, half and hard, and
sweep the way that brings it nearest the call: a draw's spot or a hit's line, since a swept stone curls less).

| your win against (node, your Knight, even level, no bonus, no bags) | 200 | 400 |
|---|---|---|
| an Archmage | 29.0% | 24.8% |
| the first-cut Lich | 21.5% | |
| ... with an Archmage's sweepers | 31.5% | |
| ... with an Archmage's search (best four of five throws, four replies at 0.3) | 15.5% | 13.3% |
| ... and no extra shots | | 12.8% |
| ... the Archmage's search, its sweepers also in its head when it weighs a shot | | 13.3% |

The broom is nearly all of it: its sweepers alone take about 12 points off you, and the wider search was worse than
the Archmage's (weighing six noisy candidates picks a lucky one). Kept: the Archmage's search with the extra shots (no
cost, and it calls a different shot about a third of the time, `test/realm_umbral_curling.py`), and the Lich's
sweepers. Playing its sweepers in its head as well changed nothing and was dropped. In the page: the Archmage 19%, the
Lich 11% (100 a row): 8 to 12 points from its decisions.

**Tier U.** One point at level parity, as golf: curling's ratings move a game little (the Nadir four with no bonus won
1 point more in node, 14.5% against 13.5% with one hex), the Lich and the bag do the rest. The Nadir four: a zombie
lead (Silt), a spider second (Weir, the best broom on the sheet), a skeleton third (Knucklebone) and the champion
skipping, Grisel Mourne (a lich), with an ultimate of their own, The Sunken Stone (the other rink's stones that end drag
heavy, 1.03, and hardly curl, 0.7): within the noise for the bot (15% without it, 16% with it).

| your win, level parity | page, 100 | page, 200 | node, 400 |
|---|---|---|---|
| tier 3, a rival's four as the world sets it | 18% | | |
| tier U, your own kinds (1 point, the Lich, the full bag) | 12% | 11% | |
| **the Nadir four, no hexes (the champion's game)** | **16%** | **15.5%** | **19.0%** |

**The hexes** (15-umbral.js), each against your side, each alone on the champion's game, node 400 (none 19.0%):

| hex | first cut | second | **kept** |
|---|---|---|---|
| Rime on the Pebble (your stones curl more than your skip reads: 1.2, 1.4, kept 1.3) | +0.5 | -12.2 | **-4.2** |
| Leaden Brooms (your sweepers' legs: 3 times, sweeping 0.7; kept 4 times, 0.6) | -1.5 | **-2.0** | |
| The Drifting House (your stone at rest in the house slides 4 inches out) | **-5.5** | | |
| Hoarfrost (their stones frozen like granite: every one in the four-foot, -10 in the page; every one on the button; kept the first in the four-foot an end) | | -2.7 | **-3.5** |

In the page (100, paired with none's 16%): Rime -7, Leaden Brooms +2, the Drifting House -3, Hoarfrost -2. Rime on the
Pebble is steep: the bot's draws are judged on inches, so a fifth more curl does nothing and two fifths more takes 12
points. No hex swings a game by more than about 7 points. Leaden Brooms is the gentlest: sweeping is worth about 6 points
to the bot in all (phase 10), so a hex on the brooms can't take much; a human who sweeps by hand feels it more.

**The champion as played**, one hex drawn a try: **14%** (200, the page; every draw in turn), two drawn (the finale's
round) 12.5%. A little under the 15 to 25% band, as golf's and football's champions are; a careful human, who sweeps
their own stones and sees the curl the rime adds, wins far more.

### Umbral: bowling (#99, 4g)

`python3 test/realm_lanes_lab.py N '' umbral` (the Umbral part of the bowling lab). Games as Simulate plays the Drowned
Lanes' champion: your five at level 3 (the journey's kinds) bowling as a Knight, against level 3 (level parity), one
Baker game of ten frames, the hall on (the tide mid) and powers on. Every row draws game i's two fives from the same
seeded stream, and the paired rows (the Archmage, the Lich and tier U; every Nadir row) play game i on the same seed, so
a hex is measured on the same games as the row without it. A run's journey (its first player) is new each run, and runs
differ by up to 5 points. About 0.15 s a game with the Lich (0.05 without).

Tier U at the lanes is tier 4 in bowling's tables: `W_LNG.oppBonus[4]` rating points on each of their five, a full bag
(`W_LANES_KIT.opp[4]`: two draughts, two Steady Hands, two Grip Chalks, Moll's Lane Oil) and the Lich bowling for them
(skill 3, `src/bl/parts/16-umbral.js`). Tiers 1 to 3 are untouched: with no hexes, no Lich and no bowler's own
ultimate the engine plays the same game seed for seed (30 seeded sims across every skill, the hall, powers, bags, the
tides, five and ten frames and the transition off, and a watched game ticked through by hand, before and after this
part: identical, summary, sheet, casts, potions and every message).

**The Lich.** Its release strays exactly as an Archmage's. Before every ball it weighs nine stands (deep inside to up
the boards, which sets its line), three aims in the pocket and, from the best, a touch slower and quicker: each thrown
seven times in its head through the ball model with its own miss at that moment (line, tempo and any curse on its ball
included), scored at the pins by a carry table worked once a page from the pins themselves (strikes and splits by
place, entry angle and speed). The Archmage's own ball is one of those weighed and wins unless another scores better.
At a spare it weighs three aims (and, at a lone pin, three stands); at a split it converts or takes the sure count by
what each is worth. No random number is drawn for any of it.

| even level, no bonus, no bags (your win, 300 a row) | run 1 | run 2 | run 3 | run 4 | run 5 |
|---|---|---|---|---|---|
| their bowlers Archmages | 19.7% | 21.7% | 23.7% | 19.7% | 24.3% |
| their bowlers the Lich | 14.7% | 12.3% | 13.0% | 9.7% | 13.0% |

Five to ten points from its decisions alone. Against a Knight over 120 seeded games it strikes 8 points more often than
an Archmage (71% against 63%) and converts more spares (85% against 80%): about 14 pins a game more.

**Tier U.** Tier 3 is one rating point at two levels up with an Archmage. The Nadir five are the undead kinds (Ossery
Brine, the champion, a zombie; a witch, a wraith, a skeleton and a lich): middling bowlers, against the journey's five.
A second rating point (`W_LNG.oppBonus[4] = 2`) put the Nadir five at 12.5% with no hexes and 8% as played, so tier U
keeps **1 point**, as tier 3 has, at level parity: the Lich and the bag make it the harder game. The champion's own
ultimate, The Drowning Bell (their balls this frame skid long on heavy oil and carry less), is their mark rather than a
swing: within noise (18.7% against 18.7%, 20.3% against 14%, 17.3% against 20%).

| your win, level parity (300 a row) | run 1 | run 2 |
|---|---|---|
| tier 3, a rival's five as the world sets it (two levels up, 1 point, Archmage, bag) | 21.7% | 23.0% |
| tier U, your own kinds (1 point, the Lich, the full bag) | 17.3% | 9.0% |
| **the Nadir five, no hexes (the champion's game)** | **18.7%** | **19.3%** |

**The hexes** (16-umbral.js), each against your side, each alone on the champion's game (300 a row, paired):

| hex (its setting in each cut) | cut 1 (150) | cut 2 (200) | cut 3 (two runs) | cut 4 (two runs) | kept, run 1 | kept, run 2 |
|---|---|---|---|---|---|---|
| none | 17.3% | 18.5% | 20.3%, 18.7% | 20.3%, 16.3% | 18.7% | 19.3% |
| The Ichor Oil (your balls take k times the oil off the lane: 3, 3, 2.5, 2.5, kept 2) | -4.6 | -5.5 | -3.3, -6.0 | -9.0, -3.6 | -5.0 | -5.0 |
| The Waterlogged Pin (a pin of each of your frames k times as heavy: 2, 2, 3, 5, kept 3.7) | -2.6 | -0.5 | -2.0, +1.0 | -15.6, -14.0 | -3.4 | -5.0 |
| The Hungry Gutters (near either edge your ball drifts toward the gutter: 6 inches and 0.0016 a step, 0.0007, 0.0003, then 3 boards and 0.0006, kept) | -11.3 | -11.0 | -11.6, -12.0 | -1.6, -3.0 | -2.7 | -2.0 |
| The Black Tide (the oil under your balls k times as heavy as it looks: 1.07, 1.025, 1.012, kept) | -15.3 | -9.5 | -5.6, -0.4 | -5.3, -1.3 | -0.4 | -2.6 |
| **the champion as played: one drawn** | 7.3% | 12.0% | 14.0%, 15.3% | 11.7%, 9.0% | **17.3%** | **15.7%** |
| two drawn (the finale's round) | 4.7% | 5.5% | 11.7%, 9.7% | 8.7%, 7.7% | 12.0% | 16.3% |

The first cut found two hexes far too strong for the bot, for the reason the skid curses were (phase 10): a Knight
plans on the lane it sees, so a ball that skids long on a heavier tide misses the pocket every time, and the gutters'
pull reached in to the boards a hook ball rolls out to at its breakpoint, so every strike ball came back light. Kept,
the pull works only on the outside three boards (a wide miss, a corner pin), and the tide is a touch. The waterlogged
pin is a threshold: at three times a pin's weight the ball still carries it, at five it is heavier than the ball and
strikes fall from 53% to 34%. Kept, none moves the game by more than about 5 points; the champion draws one hex a try:
16 to 17% across the two runs, inside the 15 to 25% band, and the finale's round with two 12 to 16%. A careful human,
who is told the waterlogged pin before each frame and can move off a dried track or a heavy tide, wins more.

### Umbral: the whole journey (#99, phase 7)

`test/realm_umbral_journey_lab.py N TRIES` plays N journeys with the realm bot; each Crown winner then plays the whole
Umbral: the Gatekeeper, then each sport's champion (its two guards first, Umbral card matches tried until beaten), each
tried at most TRIES times while the gold lasts for the toll, rested by a lantern before every match; with all nine
pieces, the Seal's three rounds, each tried at most TRIES times. Engine games are Simulated; card matches played by
the bot. The target (issue #99): the Seal on about 5 to 15% of journeys that reach the Crown.

| run (40 journeys) | Crown winners | forged the Seal | where most stopped |
|---|---|---|---|
| first, TRIES 10 | 26 | 0 (0%) | beaten by baseball (6), boxing (6), football (3); out of gold (7) |
| boxing's card eased (undercard 2 points under, one hex), TRIES 15 | 29 | 2 (7%) | out of gold (14), boxing (4), football (4) |
| and boxing's undercard 3 under, Brakka 1 under, curling's tier U bonus 0, TRIES 15 | 33 | **4 (12%)** | |

Each champion's games won in the last run (all tries, all journeys): the Gatekeeper 44%, the Bone Diamond 22%, the
Dead Pond 27%, the Cinder Pit 16%, the Drowned Lanes 15%, the Broken Ring 13%, the Hollow Links 12%, the Black Court
10%, the Sunken Shed 10%; the guards 77%. The finale's rounds 0 to 67% on small numbers (a round of the Seal draws two
hexes). Boxing's card of three (two bouts of three to win) was nearly unwinnable at full tier U for every bout (7%);
curling's champion read 14% in its own lab but 4% in a real journey, and 10% with tier U's bonus at 0. Gold for the
tolls is now a common place for a run to stop: the Seal is a long, expensive road, which is the point.


**The champions' conditions (#99, after phase 8).** Vesper Gloam (basketball) and Sexton Vale (golf) now play only
after dark (the journey lab waits for night, so it changes nothing there), and Vesper Quill (baseball) and Hollis Grael
(hockey), the two easiest champions, want it won by two or more. `python3 test/realm_umbral_journey_lab.py 40 15`
after: 29 Crown winners, the Seal forged by 4 (14%, against 12% before: inside the noise of 40 journeys). The margin
made those two the hardest games in the Umbral: the Bone Diamond 22% to 10% a game, the Dead Pond 27% to 8% (a hockey
game is low-scoring, so a two-goal margin is steep). The others as before, within the noise: the Gatekeeper 38%, the Cinder
Pit 18%, the Black Court 17%, the Drowned Lanes 17%, the Hollow Links 9%, the Broken Ring 9%.

### Umbral: corrupted forms (#111, E)

Three card-game traits replaced their stand-ins (`src/realm/umbral/u8e-forms.js`): the wraith's Half There (the first
hit from an attack against it each turn does nothing; was 1 Strength and 6 Block), the ogre's Won't Flinch (Weak and
Exposed don't take; was 12 Block), the spider's Webs the Bench (a card in your hand costs 1 more that turn; was a Slimed
in your draw pile). `python3 test/realm_umbral_lab.py 80`, the old traits put back by the override against the new,
same build:

| kind | old traits (80) | new traits (80) | old, after the review fixes (80) | new, after the fixes (80) |
|---|---|---|---|---|
| light3 | 99.5% | 97.9% | 98.9% | 98.7% |
| dark | 92.3% | 95.4% | 91.4% | 94.9% |
| light3 elite | 89.6% | 87.7% | 88.7% | 94.2% |
| dark elite | 68.9% | 63.6% | 73.7% | 64.1% |
| gate | 44.8% | 60.5% | 57.0% | 56.4% |

The lab is noisy: each run is a fresh set of journeys, and the gate (no wraith, ogre or spider in it) moved 16 points
between two runs with nothing changed for it, so a row moves about 10 points on its own. Only dark elite fell in both
pairs; its elites are the Champ and the Spider Matriarch, and by the match ids the whole fall was the Matriarch. Paired
(each Crown-winning team fights the dark Matriarch 10 times under each spider trait; 29 teams, 290 matches each):

| spider trait | win |
|---|---|
| none | 63.4% |
| a Slimed in your draw pile (the old) | 53.8% |
| Webs the Bench every turn | 45.9% |
| **Webs the Bench every other turn (the first, the third...)** | **50.0%** |

Every turn was 8 points under the old trait, every other turn 4, inside the 10-point rule for a single trait: the web
lands every other turn. The wraith and the ogre don't come up in the lab's dark pools (their checks are in
`test/realm_umbral_forms.py`, the realm bot beating a Wraith among them).
