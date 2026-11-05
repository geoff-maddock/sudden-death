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

/* The Kraken: the longest reach in the ring, slowish feet and a good chin; its nature is Eight Arms, a jab that lands from much
   further away. It grabs from range (rooted) and, once a bout, throws punches with every arm at once. */
BX_KIND.kraken = [10, 7, 5, 8, 6, 6];
BX_TRAIT.kraken = { n: 'Eight Arms', desc: 'Its jab lands from much further away than anyone else\'s.', jabReach: .55 };
BX_POW.kraken = {
  sp: { id: 'grab', n: 'Tentacle Grab', when: 'mid', desc: 'A tentacle wraps round their legs from range: rooted for 2 seconds.', fx: { who: 'them', t: 2, root: 1 } },
  ult: { id: 'eightarms', n: 'Eight Arms', when: 'mid', desc: 'Every arm at once: five punches that all land.', now: { hits: 5 } },
};

/* The Behemoth: a wall that moves. Big power, a good chin, as slow as a golem; its nature is Living Wall, body shots sinking into
   moss (they hurt it less and take none of its breath). It stamps (a stumble) and, once a bout, Earthquake. */
BX_KIND.behemoth = [6, 8, 1, 8, 6, 3];
BX_TRAIT.behemoth = { n: 'Living Wall', desc: 'Body shots sink into moss and do little: they hurt it less, and take none of its breath.', hollow: .8 };
BX_POW.behemoth = {
  sp: { id: 'stomp', n: 'Stomp', when: 'close', desc: 'Stamps the canvas: they stumble for a second.', now: { stun: 1 } },
  ult: { id: 'earthquake', n: 'Earthquake', when: 'any', desc: 'The ring heaves under them: 14 through the guard, and they stagger for over a second.', now: { dmg: 14, stun: 1.3 } },
};
