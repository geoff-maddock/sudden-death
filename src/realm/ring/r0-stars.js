/* The Anvil Ring's superstars (issue #24, phase 2), inside the wBX scope: each superstar's ratings, nature and powers,
   added to the engine's own tables after its parts load. Plain assignments, nothing declared. A superstar is never
   picked for a CPU side by kind (the Realm only ever sends one as your own player).
   The Phoenix: fast, a fair chin, and its nature is Rebirth (BX_TRAIT reborn, in 07-bout.js): once a bout, a count it
   would not beat, it beats, and gets up with most of its health. */
BX_KIND.phoenix = [6, 6, 9, 4, 6, 7];
BX_TRAIT.phoenix = { n: 'Rebirth', desc: 'Once a bout, a count it would not beat, it beats, rising from the ashes with most of its health.', reborn: 1 };
BX_POW.phoenix = {
  sp: { id: 'flare', n: 'Flare', when: 'mid', desc: 'A burst of fire through the guard (6), and they flinch for half a second.', now: { dmg: 6, stun: .5 } },
  ult: { id: 'sunfire', n: 'Sunfire', when: 'hurt', desc: 'Burns bright: 18 health back, and 25% quicker for 5 seconds.', now: { hp: 18 }, fx: { who: 'self', t: 5, spd: 1.25 } },
};
