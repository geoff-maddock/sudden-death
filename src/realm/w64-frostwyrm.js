/* w64: the Frost Wyrm (issue #24, phase 3), the sixth superstar (id wyrm, kind frostwyrm: "wyrm" was already the Seam
   Wyrm boss's kind). Its drawing is in src/realm/stars/s1-figures.js; its ratings and powers in each engine in
   src/realm/ring/r0-stars.js (boxing: the Frozen Heart nature), src/realm/gridiron/g0-stars.js and
   src/realm/diamond/d1-stars.js (the Whiteout ultimates: the witch's ultimate is already called Blizzard there). Here:
   - Cards: a signature card (Frost Breath) and five of its own kind.
   - Blizzard, in the card game: while the Frost Wyrm starts, every enemy starts Weak and Exposed for W_WYR.turns turns
     (the fightStart hook).
   - Captain: Winter's Crown, 1 Strength, 1 Footwork and 5 Block at kickoff.
   - Meeting: Jory Farsight, who watches the sky over Rimewatch, has seen it circle the peaks; ask about the WYRM. It is
     the costliest superstar: W_WYR.price, gold, or Rime Eggs from the Frostspire's nests.
   Unlocked by winning the Crown (w57). How to play: #wHelpWyrm. */

const W_WYR = { turns: 2, price: { gold: 500, items: { rimeegg: 3 } } };
Object.assign(wStar('wyrm'), {
  kind: 'frostwyrm', name: 'Hoarfang', num: 9,
  flav: 'Came down off the Frostspire the winter after you won the Crown, and has not been warm since.',
  meet: { who: 'watcher', topic: 'wyrm', price: W_WYR.price, where: 'Meet them: ask Jory Farsight, the watcher in Rimewatch, about the WYRM.',
    rumour: 'Jory hands you the spyglass. "See the peaks? Some nights a shape circles them, bigger than the Roost\'s Matriarch, white on white. It only comes down for a champion. Win the Crown, on any journey, and it will come to you."',
    hello: 'Jory takes you up the watchtower at dusk. The wind drops, the snow stops in the air, and a dragon of ice settles on the tower, looking down at you like a champion looks at a cup.',
    ask: 'It is the costliest player in the realm: gold for the League\'s books, or three Rime Eggs, and it will want all three.' },
});
FA_NAMES.frostwyrm = ['Hoarfang'];
FA_SCOUT.frostwyrm = ['Strong at everything, and it knows it.'];

/* ---------- cards ---------- */
K('wyr_breath', 'Frost Breath', 'frostwyrm', 'atk', 1, 's', 'all', [['d', 3], ['s', 'weak', 1, 'all']], { fl: 'The whole defense, frozen to the spot.', sport: 'hockey' });
K('wyr_claw', 'Ice Claw', 'frostwyrm', 'atk', 1, 'c', 'one', [['d', 8]], { sport: 'hockey' });
K('wyr_scales', 'Ice Scales', 'frostwyrm', 'skl', 1, 'c', 'self', [['b', 8]], { sport: 'curling' });
K('wyr_dive', 'Wyrm Dive', 'frostwyrm', 'atk', 2, 'u', 'one', [['d', 14]], { sport: 'football' });
K('wyr_rime', 'Rime Armor', 'frostwyrm', 'skl', 1, 'u', 'one', [['b', 7], ['s', 'weak', 1]]);
K('wyr_storm', 'Blizzard', 'frostwyrm', 'atk', 2, 'r', 'all', [['d', 7], ['s', 'weak', 2, 'all'], ['s', 'vuln', 1, 'all']], { ex: 1, fl: 'Snow on everything. Snow on the scoreboard.' });
SIG.frostwyrm = 'wyr_breath';

/* ---------- Blizzard, in the card game ---------- */
function wWyrStarts() { return !!(WG && RUN && wStarters().some(p => p.kind === 'frostwyrm')); }
onHook('fightStart', () => {
  if (!B || !wWyrStarts()) return;
  for (const e of alive()) { addSt(e, 'weak', W_WYR.turns); addSt(e, 'vuln', W_WYR.turns); }
  fx({ k: 'banner', t: 'Blizzard', sub: `Every enemy Weak and Exposed for ${W_WYR.turns} turns` });
  log(`Blizzard: the Frost Wyrm brings the snow. Every enemy is Weak and Exposed for ${W_WYR.turns} turns.`, 'good');
});
W_CAPTAIN.frostwyrm = { n: 'Winter\'s Crown', d: '1 Strength, 1 Footwork and 5 Block at kickoff.', on: { fightStart: () => { addSt(B.P, 'str', 1); addSt(B.P, 'dex', 1); B.P.block += 5; } } };

/* ---------- the meeting: Jory Farsight in Rimewatch ---------- */
(() => {
  const S = DB.chars.watcher; if (!S) return;
  S.topics.job.t += ' And something bigger than the Matriarch, a WYRM, circles the peaks.';
  S.topics.wyrm = { t: 'The white shape over the peaks. Take the glass.', act: 'star:wyrm' };
})();

const wW64RenderHelp = renderHelp;
renderHelp = function () {
  wW64RenderHelp();
  const after = $('wHelpHydra') || $('wHelpStars'); if (!after || $('wHelpWyrm')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpWyrm"><b>The Frost Wyrm.</b> Win the Crown on any journey to unlock it. Then ask Jory Farsight, the watcher in Rimewatch, about the WYRM. It is the costliest superstar: ${W_WYR.price.gold} gold or ${W_WYR.price.items.rimeegg} Rime Eggs. Its power is Blizzard. In a card-game match, while it starts, every enemy starts Weak and Exposed for ${W_WYR.turns} turns. In the ring, counters hurt it less. Its ultimate, Whiteout, brings the snow: slower at everything in the ring, a slow offense on the gridiron, slow runners on the diamond. As captain it gives 1 Strength, 1 Footwork and 5 Block at kickoff.</p>`);
};
