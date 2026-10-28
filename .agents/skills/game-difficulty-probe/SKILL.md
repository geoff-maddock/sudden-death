---
name: game-difficulty-probe
description: Measure and tune difficulty, skill expression and reward creep in a roguelike or deckbuilder using headless bots. Use when a player says a game is too easy or too hard, when adding difficulty levels, when a new reward or meta-progression system might have shifted balance, or when deciding whether a proposed change (fewer cards, more enemy HP, less healing) actually hits the problem. Builds on a model-driven bot harness such as game-playtest-lab.
---

# Difficulty probing with a skilled bot and a careless bot

These are lessons from tuning *Sudden Death*. A single bot win rate tells you little. Measure *where* runs end, *how much* each fight costs, and the *gap* between good and careless play.

## Set up

1. **Put every difficulty number in one table** (e.g. `TUNE`: cards drawn, enemy HP and damage per act, elite and boss HP, healing between acts). Have the bot harness accept overrides: `Object.assign(TUNE, overrides)`.
2. **Use two bots on the same harness:**
   - **Skilled:** your normal heuristic bot.
   - **Careless:** plays any playable card at a random target, in any order. Its job is to show what the game asks of the player.
3. **Report more than the win rate:**
   - deaths by act
   - HP lost per early brawl
   - turns per early brawl
   - HP lost per elite
   - HP going into each boss

## Read the numbers

- **"Too easy early"** shows as tiny HP loss per Act 1 brawl (2 HP of 75 was the tell), short fights (about 2.5 turns), and nearly full HP going into the first boss. Win rate alone hid this.
- **Skill expression is the gap.** If the careless bot nearly survives Act 1, early fights ask nothing of the player. A good tune keeps the skilled bot's win rate roughly steady while the careless bot's early death rate climbs. Here it went from 44% to 50–70% dying in Act 1.
- **Test the proposed lever before adopting it.** "Draw fewer cards" was the obvious fix. Measured, it barely changed Act 1 (fights just ran a turn longer) and crushed Acts 2–3, cutting the win rate from 37% to 21%. Raising Act 1 enemy HP and damage hit the actual problem. The draw-4 change became a Hall of Fame difficulty instead.

## Reward creep

When you add rewards (tokens, currencies, max HP, upgrade tracks), **teach the bot to spend them like a player would** before trusting any number. In this project, goal tokens, a fan currency and max-HP payouts went unspent by the bot, which hid a jump from about 37% to 47%. HP into the late bosses rose by roughly 10. The fixes were to trim the payouts and retune, then re-measure.

## Sample sizes and noise

- Runs are high variance. At 100 runs the standard error is about ±5 points, and two batches of identical settings came out at 53% (80 runs) and 40% (140 runs).
- Use 100–140 runs per setting, pool repeated batches, and compare directional metrics (HP lost per brawl, deaths by act) that are steadier than win rate.
- A model-driven bot (no rendering) runs a whole run in about a second, so 140 runs fit in a couple of minutes.

## Difficulty ladders

- Define levels as offsets from the standard table (draw ±, HP ×, damage ±, heal share) and store the level on the run, so it never changes mid-run.
- Target clearly separated bot win rates. The ladder ended at about 61 / 23 / 13 / 3%. Remember a careful human wins far more than the bot, so "medium" for the bot should feel firm, not fair.
- Give harder levels a score multiplier and a tag in the record book, so choosing them means something.

## Checklist for a balance change

- [ ] One table holds the numbers; the harness can override them.
- [ ] The bot spends every reward the game gives.
- [ ] Before/after with 100+ runs each, skilled and careless.
- [ ] Look at deaths by act and per-fight HP cost, not just win rate.
- [ ] The proposed lever was measured, not assumed.
- [ ] Report the new numbers, and note that humans beat the bot.
