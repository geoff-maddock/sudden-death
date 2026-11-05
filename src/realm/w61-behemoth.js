/* w61: the Behemoth (issue #24, phase 3), the third superstar. Its drawing is in src/realm/stars/s1-figures.js; its
   ratings and powers in each engine in src/realm/ring/r0-stars.js (boxing: the Living Wall nature, body shots doing
   little), src/realm/gridiron/g0-stars.js and src/realm/diamond/d1-stars.js (the Earthquake ultimates). Here:
   - Cards: a signature card (Stomp) and five of its own kind.
   - Earthquake, in the card game: while the Behemoth starts, on your turn W_BHM.turn of each match the ground heaves
     and every enemy is Stunned (the turnStart hook).
   - Captain: Bulwark, 12 Block at kickoff.
   - Meeting: Sister Fern, who keeps the totem and the old stories in Mossgate, knows where it sleeps; ask about the
     BEHEMOTH. Its price is W_BHM.price: gold, or Moss Eggs from the Mosswold's nests.
   Unlocked by beating three legends over any number of journeys (w57). How to play: #wHelpBehemoth. */

const W_BHM = { turn: 3, price: { gold: 300, items: { mossegg: 2 } } };
Object.assign(wStar('behemoth'), {
  kind: 'behemoth', name: 'Mossback', num: 70,
  flav: 'Woke up under a hill in the Mosswold, and the hill came with it.',
  meet: { who: 'fern', topic: 'behemoth', price: W_BHM.price, where: 'Meet them: ask Sister Fern, who keeps the totem in Mossgate, about the BEHEMOTH.',
    rumour: 'Sister Fern touches the totem. "There is a hill in the Mosswold that breathes. The old stories say it gets up for a team that has beaten the legends of the game: three of them, it does not matter how long it takes. Beat three, on any journeys, and I will take you to it."',
    hello: 'Sister Fern walks you into the deep moss to a hill with flowers on it. The hill opens two amber eyes, and stands, and keeps standing.',
    ask: 'It will play for you, for a price: gold for the League\'s books, or two Moss Eggs, which it eats like grapes.' },
});
FA_NAMES.behemoth = ['Mossback'];
FA_SCOUT.behemoth = ['A wall that moves. Slowly. Through you.'];

/* ---------- cards ---------- */
K('bhm_stomp', 'Stomp', 'behemoth', 'atk', 1, 's', 'one', [['d', 6], ['b', 4]], { fl: 'The pitch moves. So does the defender.', sport: 'football' });
K('bhm_charge', 'Moss Charge', 'behemoth', 'atk', 2, 'c', 'one', [['d', 13]], { sport: 'football' });
K('bhm_wall', 'Living Wall', 'behemoth', 'skl', 1, 'c', 'self', [['b', 9]], { fl: 'You go around. There is no around.', sport: 'hockey' });
K('bhm_tremor', 'Tremor', 'behemoth', 'atk', 1, 'u', 'all', [['d', 4], ['s', 'weak', 1, 'all']], { sport: 'baseball' });
K('bhm_roots', 'Deep Roots', 'behemoth', 'skl', 2, 'u', 'self', [['b', 10], ['heal', 3]]);
K('bhm_quake', 'Earthquake', 'behemoth', 'atk', 3, 'r', 'all', [['d', 10], ['s', 'stun', 1, 'all']], { ex: 1, fl: 'Everybody down.' });
SIG.behemoth = 'bhm_stomp';

/* ---------- Earthquake, in the card game ---------- */
function wBhmStarts() { return !!(WG && RUN && wStarters().some(p => p.kind === 'behemoth')); }
onHook('turnStart', () => {
  if (!B || B.turn !== W_BHM.turn || !wBhmStarts()) return;
  const foes = alive(); if (!foes.length) return;
  for (const e of foes) addSt(e, 'stun', 1);
  fx({ k: 'banner', t: 'Earthquake', sub: 'The ground heaves: every enemy is Stunned' });
  log('Earthquake: the Behemoth stamps, the ground heaves, and every enemy goes down.', 'good');
});
W_CAPTAIN.behemoth = { n: 'Bulwark', d: '12 Block at kickoff.', on: { fightStart: () => { B.P.block += 12; } } };

/* ---------- the meeting: Sister Fern in Mossgate ---------- */
(() => {
  const S = DB.chars.fern; if (!S) return;
  S.topics.job.t += ' There is an old story about a BEHEMOTH, too.';
  S.topics.behemoth = { t: 'The hill that breathes. Listen.', act: 'star:behemoth' };
})();

const wW61RenderHelp = renderHelp;
renderHelp = function () {
  wW61RenderHelp();
  const after = $('wHelpKraken') || $('wHelpStars'); if (!after || $('wHelpBehemoth')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpBehemoth"><b>The Behemoth.</b> Beat three legends from the Hall of Legends, over any number of journeys, to unlock it. Then ask Sister Fern, who keeps the totem in Mossgate, about the BEHEMOTH: it signs for ${W_BHM.price.gold} gold or ${W_BHM.price.items.mossegg} Moss Eggs. Its power is Earthquake. In a card-game match, while it starts, on your turn ${W_BHM.turn} every enemy is Stunned. In the ring body shots do little to it. On the gridiron its ultimate knocks every defender down at the snap, and on the diamond it staggers every fielder. As captain it gives 12 Block at kickoff.</p>`);
};
