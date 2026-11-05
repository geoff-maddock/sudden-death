/* w59: the Phoenix (issue #24, phase 2), the first superstar built end to end. Its drawing is in
   src/realm/stars/s1-figures.js (all four scopes); its ratings and powers in each engine are in
   src/realm/ring/r0-stars.js (boxing: Rebirth beats a lost count once a bout), src/realm/gridiron/g0-stars.js
   (football: the Rebirth ultimate) and src/realm/diamond/d1-stars.js (baseball: the Sunfire ultimate). Here, the card
   game and the world:
   - Cards: a signature card (Flare) and five of its own kind, in the Phoenix's rewards like any kind's.
   - Rebirth: while the Phoenix starts, once a match, when Team HP would fall to 0 it comes back at W_PHX.reborn of
     your max HP instead (the lethal hook, as the Phylactery does). B.phxReborn marks it used.
   - Captain: Sunrise, 5 HP back at kickoff.
   - Meeting: Ash Peregrine, the League scout in Cinderhold, knows the story; ask about the PHOENIX. Its price is
     W_PHX.price: gold, or Cinder Eggs from the Cindermaw's nests.
   Also How to play (#wHelpPhoenix, after #wHelpStars). */

const W_PHX = { reborn: .2, price: { gold: 300, items: { cinderegg: 2 } } };
Object.assign(wStar('phoenix'), {
  kind: 'phoenix', name: 'Ashwing', num: 1,
  flav: 'Came down off the crater rim in a shower of sparks. Nobody else has one.',
  meet: { who: 'scout', topic: 'phoenix', price: W_PHX.price, where: 'Meet them: ask Ash Peregrine, the scout in Cinderhold, about the PHOENIX.',
    rumour: 'Ash Peregrine lowers her voice. "Up on the crater rim, some nights, there is a light that is not lava. A bird of fire. It only comes down for a team that has won the Cinder Cup. Win that, on any journey, and come and ask me again."',
    hello: 'Ash Peregrine takes you up the crater road at dusk. On the rim a shape unfolds out of the glow: a bird of fire, taller than you, looking at your team the way a scout does.',
    ask: 'It will play for you, for a price: gold for the League\'s books, or two Cinder Eggs to keep warm in.' },
});
FA_NAMES.phoenix = ['Ashwing'];
FA_SCOUT.phoenix = ['Fast, fragile, and very hard to keep down.'];

/* ---------- cards ---------- */
K('phx_flare', 'Flare', 'phoenix', 'atk', 1, 's', 'one', [['d', 6], ['s', 'burn', 3]], { fl: 'It lights up the whole stadium. And the defender.', sport: 'basketball' });
K('phx_dive', 'Firedive', 'phoenix', 'atk', 1, 'c', 'one', [['d', 9]], { fl: 'Straight down, on fire, every time.', sport: 'football' });
K('phx_ash', 'Ash Cloud', 'phoenix', 'skl', 1, 'c', 'one', [['b', 6], ['s', 'weak', 1]], { sport: 'soccer' });
K('phx_kindle', 'Kindle', 'phoenix', 'skl', 0, 'u', 'self', [['heal', 4], ['draw', 1]], { fl: 'A little warmth goes a long way.' });
K('phx_wings', 'Wings of Fire', 'phoenix', 'atk', 2, 'u', 'all', [['d', 6], ['s', 'burn', 2, 'all']], { sport: 'basketball' });
K('phx_pyre', 'Pyre', 'phoenix', 'atk', 2, 'r', 'one', [['d', 16], ['s', 'burn', 4]], { ex: 1, fl: 'What burns comes back. Not for them.' });
SIG.phoenix = 'phx_flare';

/* ---------- Rebirth, in the card game ---------- */
function wPhxStarts() { return !!(WG && RUN && wStarters().some(p => p.kind === 'phoenix')); }
onHook('lethal', () => {
  if (!B || B.phxReborn || !wPhxStarts()) return;
  B.phxReborn = 1; RUN.hp = Math.max(1, Math.round(RUN.maxhp * W_PHX.reborn));
  fx({ k: 'banner', t: 'Rebirth', sub: `The Phoenix rises: back at ${RUN.hp} HP` });
  log('Rebirth: the Phoenix rises from the ashes, and your line gets up with it.', 'good');
  return true;
});
W_CAPTAIN.phoenix = { n: 'Sunrise', d: '5 HP back at kickoff.', on: { fightStart: () => healP(5) } };

/* ---------- the meeting: Ash Peregrine in Cinderhold ---------- */
(() => {
  const S = DB.chars.scout; if (!S) return;
  S.topics.job.t += ' And there is a story about a PHOENIX up on the crater rim.';
  S.topics.phoenix = { t: 'The bird on the crater rim. Let me tell you.', act: 'star:phoenix' };
})();

const wW59RenderHelp = renderHelp;
renderHelp = function () {
  wW59RenderHelp();
  const after = $('wHelpStars'); if (!after || $('wHelpPhoenix')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpPhoenix"><b>The Phoenix.</b> Win the Cinder Cup on any journey to unlock it. Then ask Ash Peregrine, the scout in Cinderhold, about the PHOENIX: it signs for ${W_PHX.price.gold} gold or ${W_PHX.price.items.cinderegg} Cinder Eggs. Its power is Rebirth. In a card-game match, while it starts, the first time Team HP would fall to 0 you are back at ${Math.round(W_PHX.reborn * 100)}% of your max HP instead. In the ring it beats one count it would have lost, once a bout. On the gridiron its ultimate gives its side stamina back. On the diamond its ultimate, Sunfire, makes fly balls carry further. As captain it heals 5 HP at kickoff.</p>`);
};
