/* w63: the Hydra (issue #24, phase 3), the fifth superstar. Its drawing is in src/realm/stars/s1-figures.js; its
   ratings and powers in each engine in src/realm/ring/r0-stars.js (boxing: the Regrow nature, fighting harder when
   behind and growing back between rounds), src/realm/gridiron/g0-stars.js (the Regrow ultimate) and
   src/realm/diamond/d1-stars.js (the Many Heads ultimate, a catcher). Here:
   - Cards: a signature card (Triple Bite) and five of its own kind.
   - Regrow, in the card game: while the Hydra starts, at the start of each of your turns, if your line was hit since
     your last one, W_HYD.regrow HP grow back (the turnStart hook; B.hydHp is Team HP at the last turn start).
   - Captain: Venom, every enemy starts with 3 Plague.
   - Meeting: Dr. Pell, whose incubator hatched the rare eggs, knows what all five make together; ask about the
     HYDRA. Its price is W_HYD.price: gold, or a Moss Egg and a Brine Egg.
   Unlocked by hatching all five rare eggs over any number of journeys (w57). How to play: #wHelpHydra. */

const W_HYD = { regrow: 4, price: { gold: 300, items: { mossegg: 1, brineegg: 1 } } };
Object.assign(wStar('hydra'), {
  kind: 'hydra', name: 'Threefold', num: 33,
  flav: 'Hatched from all five eggs at once, somehow, and argues with itself about tactics.',
  meet: { who: 'pell', topic: 'hydra', price: W_HYD.price, where: 'Meet them: ask Dr. Pell in Graftonbury about the HYDRA.',
    rumour: 'Dr. Pell polishes the incubator. "Every rare egg I have hatched left a little something in the shell. When I have had all five through here, over however many journeys it takes, there is enough to grow something with more heads than sense. Bring me all five."',
    hello: 'Dr. Pell opens the big tank at the back. Three heads rise out of the water at once, look at you, look at each other, and agree.',
    ask: 'It will play for you, for a price: gold for the League\'s books, or a Moss Egg and a Brine Egg, one for each of two heads. The third does not eat eggs.' },
});
FA_NAMES.hydra = ['Threefold'];
FA_SCOUT.hydra = ['Gets stronger when you hurt it. Stop hurting it.'];

/* ---------- cards ---------- */
K('hyd_bite', 'Triple Bite', 'hydra', 'atk', 1, 's', 'one', [['d', 3, 3]], { fl: 'Left, middle, right. In that order, usually.', sport: 'hockey' });
K('hyd_lash', 'Tail Lash', 'hydra', 'atk', 1, 'c', 'one', [['d', 7], ['b', 2]], { sport: 'football' });
K('hyd_scales', 'Scales', 'hydra', 'skl', 1, 'c', 'self', [['b', 8]], { sport: 'baseball' });
K('hyd_venom', 'Venom', 'hydra', 'atk', 1, 'u', 'one', [['d', 4], ['s', 'psn', 4]], { sport: 'soccer' });
K('hyd_regrow', 'Regrow', 'hydra', 'skl', 1, 'u', 'self', [['heal', 6]], { ex: 1, fl: 'Two where there was one.' });
K('hyd_heads', 'All Heads', 'hydra', 'atk', 2, 'r', 'all', [['d', 5, 2]], { fl: 'Everyone gets one.' });
SIG.hydra = 'hyd_bite';

/* ---------- Regrow, in the card game ---------- */
function wHydStarts() { return !!(WG && RUN && wStarters().some(p => p.kind === 'hydra')); }
onHook('turnStart', () => {
  if (!B || !wHydStarts()) return;
  const was = B.hydHp; B.hydHp = RUN.hp;
  if (was != null && RUN.hp < was && RUN.hp > 0) { healP(W_HYD.regrow); B.hydHp = RUN.hp; log(`Regrow: two heads grow back for every one they hit. ${W_HYD.regrow} HP back.`, 'good'); }
});
W_CAPTAIN.hydra = { n: 'Venom', d: 'Every enemy starts with 3 Plague.', on: { fightStart: () => { for (const e of alive()) addSt(e, 'psn', 3); } } };

/* ---------- the meeting: Dr. Pell in Graftonbury ---------- */
(() => {
  const S = DB.chars.pell; if (!S) return;
  S.topics.job.t += ' Hatch all five rare eggs, ever, and ask me about the HYDRA.';
  S.topics.hydra = { t: 'What five shells make together. Look.', act: 'star:hydra' };
})();

const wW63RenderHelp = renderHelp;
renderHelp = function () {
  wW63RenderHelp();
  const after = $('wHelpDjinn') || $('wHelpStars'); if (!after || $('wHelpHydra')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpHydra"><b>The Hydra.</b> Hatch all five rare eggs at Pell's, over any number of journeys, to unlock it. Then ask Dr. Pell in Graftonbury about the HYDRA: it signs for ${W_HYD.price.gold} gold, or a Moss Egg and a Brine Egg. Its power is Regrow. In a card-game match, while it starts, if your line was hit since your last turn, ${W_HYD.regrow} HP grow back at the start of your turn. In the ring it fights harder when behind and grows back far more between rounds. On the gridiron its ultimate gives its side stamina back; on the diamond every fielder reacts sooner. As captain every enemy starts with 3 Plague.</p>`);
};
