/* w60: the Kraken (issue #24, phase 3), the second superstar. Its drawing is in src/realm/stars/s1-figures.js; its
   ratings and powers in each engine in src/realm/ring/r0-stars.js (boxing: the Eight Arms nature, a jab from much
   further away), src/realm/gridiron/g0-stars.js and src/realm/diamond/d1-stars.js (the Eight Arms ultimates). Here:
   - Cards: a signature card (Tentacle Grab) and five of its own kind.
   - Eight Arms, in the card game: while the Kraken starts, at the start of each of your turns a tentacle lashes a
     random enemy for W_KRK.lash and catches W_KRK.catch Block for you (the turnStart hook).
   - Captain: Ink Cloud, 6 Block at kickoff and one enemy Weak for two turns.
   - Meeting: Ysolde Wrack, the salvage diver in Saltmere, has seen it; ask about the KRAKEN. Its price is
     W_KRK.price: gold, or Brine Eggs from the Brinefen's nests.
   Unlocked by winning the Rimewatch cup (w57). Also How to play (#wHelpKraken, after the Phoenix's). */

const W_KRK = { lash: 3, catch: 3, price: { gold: 300, items: { brineegg: 2 } } };
Object.assign(wStar('kraken'), {
  kind: 'kraken', name: 'Deepmaw', num: 8,
  flav: 'Came up out of the deep water off Saltmere and asked, very politely, for a game.',
  meet: { who: 'diver', topic: 'kraken', price: W_KRK.price, where: 'Meet them: ask Ysolde Wrack, the diver in Saltmere, about the KRAKEN.',
    rumour: 'Ysolde wrings out her hair. "Out past the drowned hatchery there is something with more arms than I can count, and it watches the matches from the water. It only comes in for a team that has won the cup at Rimewatch. Win that, on any journey, and I will row you out."',
    hello: 'Ysolde rows you out past the hatchery at slack tide. The water bulges, and a head the size of a boat rises, gold-eyed, with arms enough for a whole team.',
    ask: 'It will play for you, for a price: gold for the League\'s books, or two Brine Eggs, which it misses.' },
});
FA_NAMES.kraken = ['Deepmaw'];
FA_SCOUT.kraken = ['Huge reach, slow to turn, and nothing it catches gets away.'];

/* ---------- cards ---------- */
K('krk_grab', 'Tentacle Grab', 'kraken', 'atk', 1, 's', 'one', [['d', 5], ['s', 'weak', 2]], { fl: 'It gets a hold of you from across the field.', sport: 'football' });
K('krk_slam', 'Tentacle Slam', 'kraken', 'atk', 1, 'c', 'one', [['d', 8]], { sport: 'hockey' });
K('krk_ink', 'Ink Cloud', 'kraken', 'skl', 1, 'c', 'self', [['b', 8]], { fl: 'Where did it go? Where did the ball go?', sport: 'soccer' });
K('krk_depths', 'From the Depths', 'kraken', 'skl', 1, 'u', 'self', [['b', 6], ['draw', 2]]);
K('krk_coil', 'Constrict', 'kraken', 'atk', 2, 'u', 'one', [['d', 7], ['s', 'stun', 1]], { sport: 'football' });
K('krk_eight', 'Eight Arms', 'kraken', 'atk', 2, 'r', 'one', [['d', 2, 8]], { fl: 'One for each.' });
SIG.kraken = 'krk_grab';

/* ---------- Eight Arms, in the card game ---------- */
function wKrkStarts() { return !!(WG && RUN && wStarters().some(p => p.kind === 'kraken')); }
onHook('turnStart', () => {
  if (!B || !wKrkStarts()) return;
  const foes = alive(); if (!foes.length) return;
  const e = pick(foes); hurtEnemy(e, W_KRK.lash, { raw: true, src: 'Eight Arms' }); gainBlock(W_KRK.catch, true);
  log(`Eight Arms: a tentacle lashes ${e.n} for ${W_KRK.lash} and catches ${W_KRK.catch} Block.`, 'good');
});
W_CAPTAIN.kraken = { n: 'Ink Cloud', d: '6 Block at kickoff, and one enemy starts Weak for two turns.', on: { fightStart: () => { B.P.block += 6; const e = pick(alive()); if (e) addSt(e, 'weak', 2); } } };

/* ---------- the meeting: Ysolde Wrack in Saltmere ---------- */
(() => {
  const S = DB.chars.diver; if (!S) return;
  S.topics.job.t += ' And I have seen a KRAKEN out past the hatchery.';
  S.topics.kraken = { t: 'The thing out past the hatchery. Sit down.', act: 'star:kraken' };
})();

const wW60RenderHelp = renderHelp;
renderHelp = function () {
  wW60RenderHelp();
  const after = $('wHelpPhoenix') || $('wHelpStars'); if (!after || $('wHelpKraken')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpKraken"><b>The Kraken.</b> Win the Rimewatch cup on any journey to unlock it. Then ask Ysolde Wrack, the diver in Saltmere, about the KRAKEN: it signs for ${W_KRK.price.gold} gold or ${W_KRK.price.items.brineegg} Brine Eggs. Its power is Eight Arms. In a card-game match, while it starts, a tentacle hits a random enemy for ${W_KRK.lash} at the start of each of your turns and catches you ${W_KRK.catch} Block. In the ring its jab lands from much further away. On the gridiron and the diamond its ultimate reaches across the field: surer tackles, or runners grabbed on the basepaths. As captain it gives 6 Block and a Weak enemy at kickoff.</p>`);
};
