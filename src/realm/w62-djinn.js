/* w62: the Djinn (issue #24, phase 3), the fourth superstar. Its drawing is in src/realm/stars/s1-figures.js; its
   ratings and powers in each engine in src/realm/ring/r0-stars.js (boxing: the Smoke and Mirrors nature, and Three
   Wishes, which grants the wish the moment needs: bxWish), src/realm/gridiron/g0-stars.js and
   src/realm/diamond/d1-stars.js (Three Wishes ultimates, three small boons at once). Here:
   - Cards: a signature card (Wish) and five of its own kind.
   - Three Wishes, in the card game: while the Djinn starts, at kickoff it grants one wish, the one the moment needs:
     W_DJN.heal HP back when Team HP is under half, W_DJN.storm damage to every enemy against three or more, or
     else W_DJN.str Strength (the fightStart hook).
   - Captain: Glamour, 1 Strength and 1 Footwork at kickoff.
   - Meeting: Ingrith Skarr, the cartographer in Rimewatch who knows the Road to Nowhere; ask about the DJINN. Its
     price is W_DJN.price: gold, or Meadow Eggs from the Charter Plains' nests.
   Unlocked by walking the Road to Nowhere to its end (w57). How to play: #wHelpDjinn. */

const W_DJN = { heal: 12, storm: 5, str: 2, price: { gold: 300, items: { meadowegg: 2 } } };
Object.assign(wStar('djinn'), {
  kind: 'djinn', name: 'Zarim', num: 3,
  flav: 'Came out of a lamp nobody remembers rubbing, and would like a contract, thank you.',
  meet: { who: 'ingrith', topic: 'djinn', price: W_DJN.price, where: 'Meet them: ask Ingrith Skarr, the cartographer in Rimewatch, about the DJINN.',
    rumour: 'Ingrith taps a blank corner of the map. "At the end of the Road to Nowhere there is a lamp in the snow that nobody put there. Whoever walks the road to its end, after dark, on any journey, may find it lit. Until then, it is just a lamp."',
    hello: 'Ingrith walks you up the Road to Nowhere. At its end the lamp is lit, and smoke pours out of it, and the smoke stands up, folds its arms and grins.',
    ask: 'It will play for you, for a price: gold for the League\'s books, or two Meadow Eggs, which it wished for.' },
});
FA_NAMES.djinn = ['Zarim'];
FA_SCOUT.djinn = ['Tricky, all guile, and never where you look.'];

/* ---------- cards ---------- */
K('djn_wish', 'Wish', 'djinn', 'skl', 1, 's', 'self', [['b', 4], ['draw', 1]], { fl: 'Careful what you wish for. It is very careful.', sport: 'basketball' });
K('djn_bolt', 'Arcane Bolt', 'djinn', 'atk', 1, 'c', 'one', [['d', 7]], { sport: 'jousting' });
K('djn_mirage', 'Mirage', 'djinn', 'skl', 1, 'c', 'one', [['b', 7], ['s', 'weak', 1]], { fl: 'There were three of it. Then none.', sport: 'soccer' });
K('djn_lamp', 'Back in the Lamp', 'djinn', 'skl', 1, 'u', 'self', [['b', 12]], { ex: 1 });
K('djn_sleight', 'Sleight', 'djinn', 'skl', 0, 'u', 'self', [['draw', 2]], { sport: 'basketball' });
K('djn_three', 'Three Wishes', 'djinn', 'skl', 2, 'r', 'self', [['draw', 3], ['nrg', 2], ['heal', 5]], { ex: 1, fl: 'One, two, three. No refunds.' });
SIG.djinn = 'djn_wish';

/* ---------- Three Wishes, in the card game ---------- */
function wDjnStarts() { return !!(WG && RUN && wStarters().some(p => p.kind === 'djinn')); }
// the wish the moment needs: 'heal' (Team HP under half), 'storm' (three or more enemies), or 'str'
function wDjnWish() { return RUN.hp < RUN.maxhp / 2 ? 'heal' : alive().length >= 3 ? 'storm' : 'str'; }
onHook('fightStart', () => {
  if (!B || !wDjnStarts()) return;
  const w = wDjnWish(); B.djnWish = w;
  if (w === 'heal') { healP(W_DJN.heal); log(`Three Wishes: the Djinn wishes your line well. ${W_DJN.heal} HP back.`, 'good'); }
  else if (w === 'storm') { for (const e of alive()) hurtEnemy(e, W_DJN.storm, { raw: true, src: 'Three Wishes' }); log(`Three Wishes: the Djinn wishes them a storm. ${W_DJN.storm} damage to every enemy.`, 'good'); }
  else { addSt(B.P, 'str', W_DJN.str); log(`Three Wishes: the Djinn wishes you strength. ${W_DJN.str} Strength.`, 'good'); }
  fx({ k: 'banner', t: 'Three Wishes', sub: w === 'heal' ? `${W_DJN.heal} HP back` : w === 'storm' ? `${W_DJN.storm} damage to every enemy` : `${W_DJN.str} Strength` });
});
W_CAPTAIN.djinn = { n: 'Glamour', d: '1 Strength and 1 Footwork at kickoff.', on: { fightStart: () => { addSt(B.P, 'str', 1); addSt(B.P, 'dex', 1); } } };

/* ---------- the meeting: Ingrith Skarr in Rimewatch ---------- */
(() => {
  const S = DB.chars.ingrith; if (!S) return;
  S.topics.job.t += ' There is a blank on my map where a DJINN is supposed to be, too.';
  S.topics.djinn = { t: 'The lamp at the end of the road. Come here.', act: 'star:djinn' };
})();

const wW62RenderHelp = renderHelp;
renderHelp = function () {
  wW62RenderHelp();
  const after = $('wHelpBehemoth') || $('wHelpStars'); if (!after || $('wHelpDjinn')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpDjinn"><b>The Djinn.</b> Walk the Road to Nowhere to its end, after dark, on any journey, to unlock it. Then ask Ingrith Skarr, the cartographer in Rimewatch, about the DJINN: it signs for ${W_DJN.price.gold} gold or ${W_DJN.price.items.meadowegg} Meadow Eggs. Its power is Three Wishes. In a card-game match, while it starts, it grants one wish at kickoff, the one the moment needs: ${W_DJN.heal} HP back when Team HP is under half, ${W_DJN.storm} damage to every enemy against three or more, or else ${W_DJN.str} Strength. In the ring its ultimate grants health, a heavy blow or speed, whichever the moment needs; on the gridiron and the diamond it grants three small wishes at once. As captain it gives 1 Strength and 1 Footwork at kickoff.</p>`);
};
