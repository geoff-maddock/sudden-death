# The frozen deep: Old Grey under the Curling Shed's ice (issue #108)

Agreed with Geoff on 2026-11-24 (shape 1 of three: a creature, over a current or cracks).

## Intent

Wild games at the Curling Shed get a character of their own, as the tide gives the Saltmere Lanes and the enchanted
course gives Mossgate. Something lives under the ice, and a careful skip can read it and play round it (or use it):
it rewards attention, not luck.

## What it is

**Old Grey**, a great pike under the Shed's ice. Hennock says so at the start: "Old Grey's under the ice today." It
swims only in the far end, between the far hog line and the back line, where the stones come to rest.

## What it does

1. **Keen ice over it.** Within `reach` inches (about 30) of where it lies, the ice is thin and keen: a stone crossing
   slides further (friction times about .9) and curls less (curl times about .6), more the nearer the middle.
2. **It moves after every stone, and bumps.** When a stone has come to rest (and the rules have taken it), Old Grey
   swims about 40 inches to its next spot. Before the rules score the stones, every stone at rest within `bumpR`
   inches (about 20) of that next spot is pushed a few inches straight away from it (more the nearer it lies), by the
   frost sprite's limits: never off the sheet and never into another stone. A bump can carry a stone into or out of the
   house, so it can change an end's score. *(Geoff's agreed design; the exact numbers are the builder's, tuned by the
   lab.)*
3. **Where it goes next is always shown**: its shadow (the keen ice round it) and a faint ring where it moves after the
   next stone. Its following spot is picked when it arrives (seeded), so you can always see one move ahead.

## When

- About one wild game in three (`W_DEEP.p`), decided at kickoff, Simulate too.
- Wild games are the club matches from Hennock's match card (`kind: 'shgame'`, not a cup). Never in the Brass Broom,
  league fixtures, the exhibition and practice, or the Umbral. *(My call: the exhibition and practice are off, so the
  deep is a thing of real matches.)*
- The bare engine and the labs: only with `start({ deep: true })`.
- A game without the deep plays exactly as before: same seed, same game (the deep draws from the random stream only
  when it is on).

## The CPU, by skill

Through the skill's read of the ice (`crIceRead`'s idea):
- a **Squire** doesn't see Old Grey at all (it plans on the ice without it);
- a **Knight** reads the keen ice, not the bumps;
- an **Archmage** and the **Lich** read both: their trial runs bump the stones as Old Grey will.

The real stone always meets the real ice. Your own guide and your coach's broom read it as it is.

## The page

- Under the stones on the sheet view and the house view: a long dark shape with a slow tail, the keen ice a little
  glossier round it, and the next spot a faint dotted ring. On the sheet strip, a small grey mark.
- The status line says when it bumps a stone ("Old Grey turns under the ice and nudges Saltmere's stone 4 inches.").
- How to play gains a line in the Shed's section.

## State

`G.deep = { x, y, nx, ny, hd }` (plain JSON, so a kept match keeps it), or null. An older save has none and plays
without it.

## Approaches considered

1. **A creature that moves** (picked): alive, and it gives timing a reason; the most work (drawing, moving, the CPU's
   read).
2. A current: bubbles under one band push stones sideways, turning at the half. Readable and simple, but it feels like
   wind, not something alive.
3. Cracks: a few cracks each end run fast and straight, and grow. Static, easy to see, the least exciting.

## Goals, non-goals

- Goal: wild Shed matches feel different and reward reading the ice; even games don't swing on luck.
- Non-goals: no medal, no power that targets Old Grey, Tilda doesn't mention it, no deep in cups or fixtures.
- Anti-goal: a bump that feels random or unfair (it must be visible a move ahead and plain in the status line).

## Done when (issue #108)

- Built in `src/cr/` (scope `wCR`), on in wild games only.
- An asserting check in `test/all.sh` and CI.
- `test/realm_shed_lab.py` measures it on and off; the numbers in `docs/realm/BALANCE.md`.

## Left to the builder

The exact reach, bump distance and strength of the keen ice (tuned by the lab: the deep should leave an even game even,
and may widen a skill gap a little); the shape's drawing; the step's path (a heading that turns a little each move and
turns back off the sheet's edges).
