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

