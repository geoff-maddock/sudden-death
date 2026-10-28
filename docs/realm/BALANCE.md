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
