/* w55: the feel of boxing (issue #23, phase 8), as w47 is for football. Sound in the ring, coach's notes and medals.

   Sound. Sudden Death's own effects (sfx), following your Sound effects setting, from the ring's events (wBX.onEv) and
   beats (wBX.onPhase): the bell at the start and the end of every round, a slap for a jab and a crunch for a big punch
   or a counter, a dull knock for a block and a swish for a slip, a groan and the crowd for a knockdown, the crowd for a
   fighter hurt, a shimmer for a power (a bright one for an ultimate), the count's ticks, and at the end the horn and the
   crowd if your corner won, a groan if it lost. The realm's music plays on, as it does at any ground.
   Tips. TIPS.w_ring once your team can box (W_BXG.minOwn players), TIPS.w_bcup once you've won a card.
   Achievements. Cards won (realmRingWins), wins inside the distance by your fighters (realmRingKos) and Anvil Belts
   (realmBcups), on SD's ACH.

   Wraps: wBX.onEv (wW55OnEv: the sounds), wBX.onPhase (wW55OnPhase: the bell, the count), wBX.onOver (wW55OnOver: the
   end), wRingSettle
   (wW55RingSettle), wBcupWon (wW55BcupWon), renderHelp (wW55RenderHelp: #wHelpRingFeel after #wHelpBcup). */

const WRSND = { ph: null, count: 0 };
const wRingSoundOn = () => !LAB && SET.sfx !== false && UI.view === 'ring' && !!wBX.G;
// the ring's bell: a struck note that rings on
function wRingBell(n) { for (let i = 0; i < (n || 1); i++) { tone(1660, 1.1, 'sine', .07, 0, i * .32); tone(2490, .9, 'sine', .025, 0, i * .32); } }
function wRingEvSound(e) {
  if (!wRingSoundOn()) return;
  if (e.k === 'land') { if (e.ctr || e.n >= 9) sfx.crunch(); else sfx.hit(e.p === 'body' ? .4 : .2); }
  else if (e.k === 'block') sfx.block();
  else if (e.k === 'slip') sfx.card();
  else if (e.k === 'kd') { sfx.hurt(); sfx.crowd(2); }
  else if (e.k === 'stun') sfx.crowd(.9);
  else if (e.k === 'cast') { if (e.ult) sfx.crit(); else sfx.magic(); }
  else if (e.k === 'zap') sfx.crunch();
}
// a beat changing (the same beat heard again, as when your corner is asked, rings nothing)
function wRingPhSound(ph) {
  const prev = WRSND.ph; WRSND.ph = ph;
  if (ph === prev || !wRingSoundOn()) return;
  if (ph === 'round' && prev !== 'rise') wRingBell(1);
  else if (ph === 'corner') wRingBell(2);
  else if (ph === 'kd') WRSND.count = 0;
}
// the end of a bout (heard through wBX.onOver): three bells, then the horn for your win or a groan for your loss
function wRingEndSound() {
  WRSND.ph = 'over';
  if (!wRingSoundOn()) return;
  wRingBell(3);
  const v = wBX.G.over, you = wBX.you, mine = wBX.mode !== 'watch' || (WBX && WBX.world);
  if (!v || v.win == null) return;
  if (!mine) { sfx.crowd(1.6); return; }
  if (v.win === you) { sfx.horn(); sfx.crowd(2); } else sfx.bad();
}
const wW55OnEv = wBX.onEv;
wBX.onEv = e => { if (wW55OnEv) wW55OnEv(e); try { wRingEvSound(e); } catch (er) { console.error(er); } };
const wW55OnPhase = wBX.onPhase;
wBX.onPhase = ph => { if (wW55OnPhase) wW55OnPhase(ph); try { wRingPhSound(ph); } catch (er) { console.error(er); } };
const wW55OnOver = wBX.onOver;
wBX.onOver = s => { if (wW55OnOver) wW55OnOver(s); try { wRingEndSound(); } catch (er) { console.error(er); } };
// the count: a tick for each number the referee calls
setInterval(() => { if (WRSND.ph === 'kd' && wRingSoundOn() && wBX.count > WRSND.count) { WRSND.count = wBX.count; tone(900, .05, 'square', .04, 0); } }, 100);

Object.assign(TIPS, {
  w_ring: ['Boxing', 'Your team can box. Ask Ma Gristle at the Anvil Ring, outside Cinderhold, for a CARD: three bouts, three of yours against three of a club\'s. Box it yourself, work the corner, or simulate it.'],
  w_bcup: ['The Anvil Belt', 'Boxing has its own cup, every week. Ask Ma Gristle at the Anvil Ring about the BELT, or use the Anvil Belt button on the card.'],
});
function wRingTips() {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world') return;
  if (wRoster().length >= W_BXG.minOwn) tip('w_ring');
  if (WG.bxg && WG.bxg.w > 0) tip('w_bcup');
}
setInterval(wRingTips, 700);

ACH.push(
  { id: 'w_ring', n: 'Iron Fists', d: 'Win cards in the Anvil Ring', stat: 'realmRingWins', at: [1, 10, 30] },
  { id: 'w_ringko', n: 'Knockout Artist', d: 'Win bouts inside the distance in the Anvil Ring', stat: 'realmRingKos', at: [1, 10, 30] },
  { id: 'w_bcup', n: 'Belt Holder', d: 'Win the Anvil Belt', stat: 'realmBcups', at: [1, 3, 8] },
);
const wW55RingSettle = wRingSettle;
wRingSettle = function (result, bouts, pairs) {
  const m = wW55RingSettle.apply(this, arguments);
  if (!LAB) {
    if (result.win === 0) achAdd('realmRingWins', 1);
    const ko = (bouts || []).filter(b => b && b.over.win === 0 && (b.over.how === 'ko' || b.over.how === 'tko')).length;
    if (ko) achAdd('realmRingKos', ko);
  }
  return m;
};
const wW55BcupWon = wBcupWon;
wBcupWon = function () { wW55BcupWon(); if (!LAB) achAdd('realmBcups', 1); };

const wW55RenderHelp = renderHelp;
renderHelp = function () {
  wW55RenderHelp();
  const d = $('wHelpBcup'); if (!d || $('wHelpRingFeel')) return;
  d.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpRingFeel"><b>In the ring</b> you hear the bell at the start and end of every round, the punches, the blocks and the slips, the crowd for a knockdown, and a shimmer for a power. Sounds follow your Sound effects setting, and the realm's music plays on. Cards won, knockouts and Anvil Belts have medals in the record book.</p>`);
};
