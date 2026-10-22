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
  - the gear charges the enchanter can buy.

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
