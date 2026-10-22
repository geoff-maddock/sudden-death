# Changelog

Milestones from development, newest first. The game was built in claude.ai and published as an artifact after each step; this is the record of what landed when.

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
