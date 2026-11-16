# Changelog

Milestones from development, newest first. The game was built in claude.ai and published as an artifact after each step; this is the record of what landed when.

## Hockey at the Pond Rink (the Realm's fifth engine)
- **After the first games by hand:** quicker skating that follows a player's speed more; a closer camera that follows the puck, and a larger picture; a longer face-off with the words on the ring and a line saying how your timing was; stronger powers with more mana, a glow under a side with one going; Speed (1, 2, 4 or 8 times) in Watch and Manage.
- **Black Ice:** real hockey on the pond at Rimewatch, five skaters and a goalie a side. Skating with glide, a puck that is loose a lot, wrist shots, slap shots and one-timers, a goalie who follows the puck a moment late, pokes and body checks, face-offs and icing. Nobody goes home level: sudden death at three a side, then a shootout played out on the ice.
- **Penalties and power plays:** the box, the delayed penalty, five on three, and pulling the goalie for an extra skater.
- **By hand, managed or simulated:** skate your six yourself (aim by the way you steer), or coach them: systems with and without the puck, power-play and penalty-kill setups, Tempo and Edge, line changes, the timeout.
- **Your six:** hockey ratings for every player, the Rink tab, stamina and shifts, a bench that comes over the boards.
- **Powers, gear and potions:** a puck power and a checking power for every kind, ultimates that mark the ice, the bank's roar; Sharp Skates to a Bone Mask; Antifreeze, Hot Cider and Tove's Liniment.
- **The pond's own ways:** snow that builds through a period, old boards that are dead or lively, ice that cracks under a big hit.
- **The Pond Kettle:** a weekly cup, and league fixtures at the Rink played on the ice.

## Soccer, the tenth sport
- **Pass and move:** every card you play is a pass. An Attack with 3+ passes behind it is a shot, +1 damage per pass (up to 6), and 10+ on one enemy is a goal. An enemy hit with 5+ through your Block is their goal; block every hit in their turn and it is a goal prevented, and your next turn starts with a pass.
- **Highlights:** golazo, clean sheet, brick wall (three saves), and the hat trick.
- **On the schedule like a major sport** (2, 2 and 3 across the acts), with five archetype cards, a set play (One-Touch), a snow pitch, the ball working up the pitch with each pass, and a constellation, The Net.
- **The Realm:** the Rimewatch Sheet, the second curling ground, is the Hoarfrost Pitch, so every ground has its own sport. The Frostspire plays hockey and soccer. Eleven a side, five of your own.

## Trouble, profiles and achievements
- **Enemy sport perks:** Ace, Stopper, Hot start and Clutch, shown as gold tags over enemies. Rare in brawls, common among elites, rivals and bosses.
- **High-stakes rooms** on the map (red badge): Grudge match, Hot-headed ref, Bloodsport and Side bet. They settle on the reward screen.
- **Local player profiles:** Guest is the no-login mode. Each profile keeps its own run, records, careers, achievements and coach's notes. The current player is shown in the header, and switching mid-run is safe.
- **18 achievements** with bronze, silver and gold, counted across runs per profile, with toasts and a record book section.
- **Season goals are three-tier ladders:** finish one and it climbs to a harder target with a bigger payout.
- **Global difficulty retune** after teaching the bot to spend the newer rewards. Contender went from about 47% to about 23% bot win rate, and fan and goal payouts were trimmed.
- **Fixes:**
  - Forfeit (and profile delete) did nothing on claude.ai because the browser's `confirm()` is blocked there. They now use an in-game dialog.
  - Switching profiles mid-fight saved the fight into the wrong profile.

## Sports punch-up
- **Published schedule:** every fight room shows its sport, each act has a home sport, and card rewards lean toward upcoming sports.
- **Practice (★),** a second upgrade track that improves a card at the game, with a different effect in each sport.
- **25 archetype cards** for golf, bowling, jousting, curling and boxing, plus "fits" glyphs on every card.
- **Scoring animations** for every sport, and the play of the game on the reward screen.
- **Season goals and fans,** with a fan stand at the pro shop.

## Difficulty
- Tougher Act 1 enemies and one fewer warm-up fight.
- **Four difficulty levels:** Rookie, Contender, All-Star, Hall of Fame (draw 4). Each run keeps its level, has a score multiplier, and gets a record book tag.

## Saving
- **Pause menu** (`Esc`/`P`).
- **Save and quit mid-fight:** the whole battle is snapshotted and resumes on the same turn with the same hand. It autosaves each turn, after each card, and when the page closes.

## Refactor pass
- **Damage breakdown** strip for the selected attack.
- **Coach's notes** (one-time tips).
- **Clearer sport rules**, and rebalanced hockey and bowling.
- **Hooks registry** for trophies (`TROPHY_FX`).
- **Creature sprite cache**, about 3.5–4× faster frames.
- **Elite scouting reports** (traits with risk and pay).
- **Fixes:**
  - Tooltips were broken by a name collision; the build now rejects duplicate globals.
  - Mountain Boots' Block was being wiped on turn 1.
- **Docs and tooling:** `ARCHITECTURE.md`, a portable build, and `test/all.sh`.

## Hardening
- **Arena blur:** the canvas now refits when its displayed size changes, and the drawing context is reset every frame.

## Run meta
- **Eight clubs** with styles and unique trophies, and the open draft class of free agents.
- **Moon phases and constellations** on a shared tick, with small kind and sport bonuses.
- **Procedural music** per act with an "exciting" version near elimination, and separate music and sound settings.
- **Records:** a season log of every game, per-player stats and careers with charts, and the treasure trunk scene.

## Sports layer
- Scoring for all nine sports, momentum, highlights, sports wins, the Highlight Reel, field visuals and the crowd.

## Core game
- **Cards:** the card engine, extra costs and keywords, set plays, gear and Hall of Fame cards.
- **Creatures and bosses:** 18 creature kinds, nine bosses with brains and phases, and the VFX layer.
- **Run structure:** map generation with route repair and rival nodes, events, the shop and the locker room.
