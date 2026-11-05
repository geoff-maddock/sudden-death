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

/* The Djinn: all guile. Its nature is Smoke and Mirrors (a slip opens a long window to counter in); Mirage makes
   punches find only smoke for a moment, and Three Wishes grants the wish that suits the moment (bxWish in
   11-powers.js): health back when it is hurt, a heavy blow when they are, and speed otherwise. */
BX_KIND.djinn = [6, 5, 6, 5, 6, 9];
BX_TRAIT.djinn = { n: 'Smoke and Mirrors', desc: 'When it slips a punch, it leaves a long window to counter in.', ctrWin: 1.6 };
BX_POW.djinn = {
  sp: { id: 'mirage', n: 'Mirage', when: 'close', desc: 'For a second and a half, punches find only smoke.', fx: { who: 'self', t: 1.5, miss: 1 } },
  ult: { id: 'threewishes', n: 'Three Wishes', when: 'any', desc: 'One wish, the one the moment needs: 22 health back when hurt, 14 through the guard when they are hurt, or 35% quicker for 6 seconds.',
    wish: [{ when: 'hurt', n: 'health', now: { hp: 22 } }, { when: 'theyHurt', n: 'a knockout blow', now: { dmg: 14 } }, { when: 'else', n: 'speed', fx: { who: 'self', t: 6, spd: 1.35, move: 1.2 } }] },
};

/* The Hydra: gets stronger when hurt. Its nature is Regrow: behind on health its punches land more often
   (scrappy), and between rounds it grows back far more than anyone (mend, read in 07-bout.js's corner). Triple Bite
   is three quick hits that land; its ultimate, Regrow, grows the heads back. */
BX_KIND.hydra = [6, 6, 5, 6, 6, 6];
BX_TRAIT.hydra = { n: 'Regrow', desc: 'Behind on health it fights harder (its punches land more often), and between rounds it grows back far more than anyone.', scrappy: .03, mend: .6 };
BX_POW.hydra = {
  sp: { id: 'triplebite', n: 'Triple Bite', when: 'close', desc: 'Three heads bite at once: three quick hits that all land.', now: { hits: 3 } },
  ult: { id: 'regrow', n: 'Regrow', when: 'hurt', desc: 'The heads grow back: 20 health now, and 2 a second for 6 seconds.', now: { hp: 20 }, fx: { who: 'self', t: 6, regHp: 2 } },
};

/* The Frost Wyrm (kind frostwyrm): strong at everything. Its nature is Frozen Heart (counters hurt it less); Frost
   Breath chills them through the guard and slows their feet, and its ultimate, Whiteout, slows them at everything. */
BX_KIND.frostwyrm = [7, 7, 6, 6, 6, 6];
BX_TRAIT.frostwyrm = { n: 'Frozen Heart', desc: 'Cold all the way through: counters hurt it less.', ctrTaken: .8 };
BX_POW.frostwyrm = {
  sp: { id: 'frostbreath', n: 'Frost Breath', when: 'mid', desc: 'A breath of ice through the guard (5), and their feet slow to 60% for 3 seconds.', now: { dmg: 5 }, fx: { who: 'them', t: 3, move: .6 } },
  ult: { id: 'whiteout', n: 'Whiteout', when: 'any', desc: 'A storm in the ring: 30% slower at everything for 5 seconds.', fx: { who: 'them', t: 5, spd: .7, move: .7 } },
};
