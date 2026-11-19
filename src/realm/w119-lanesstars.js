/* w119: superstars on the lanes (issue #100, phase 8), the Realm's side of src/realm/lanes/p0-stars.js, as w109 is golf's.
   Each of the six superstars has a bowling kind there: ratings, two strike and two spare powers, and an ultimate. The
   rest follows by itself: wBlOf seeds p.bl from the kind, the Lanes tab offers the two picks of each pair (w117), the
   Powers row lists the power and the ultimate, and the bowler at the foul line is drawn as their own kind.
   What this part adds:
   - A superstar signed before this part had no bowling kind, so their p.bl was seeded as an average player's. Once,
     when the journey is next loaded, it is made again from their own kind and grown to their level (p.bl.st marks it
     done; a superstar made from now on has it from the start), keeping their hand. Gear is untouched: it never changed
     the ratings.
   - How to play: #wHelpLanesStars, after bowling's gear and potions, each superstar's game on the lanes.
   wLanesStarFix(p)   true when p's ratings were made again
   Wraps: wMakePlayer (wW119MakePlayer: the mark), wStart (wW119Start: older saves), renderHelp (wW119RenderHelp). */

const wLanesStarKind = k => W_STARS.some(s => s.kind === k) && !!wBL.pow[k];
function wLanesStarFix(p) {
  if (!p || !wLanesStarKind(p.kind) || (p.bl && p.bl.st)) return false;
  const had = !!p.bl, hand = had ? p.bl.hand : null;
  delete p.bl; const b = wBlOf(p); b.st = 1; if (hand === 1 || hand === -1) b.hand = hand;
  return had;
}
const wW119MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW119MakePlayer.apply(this, arguments); if (p && p.bl && wLanesStarKind(p.kind)) p.bl.st = 1; return p; };
const wW119Start = wStart;
wStart = function (save, opts) {
  const r = wW119Start(save, opts);
  if (WG) { let n = 0; for (const p of (WG.roster || []).concat(WG.wwait || [])) if (wLanesStarFix(p)) n++; if (n && save) wSave(); }
  return r;
};

const wW119RenderHelp = renderHelp;
renderHelp = function () {
  wW119RenderHelp();
  const after = $('wHelpLanesKit') || $('wHelpLanesGame'); if (!after || $('wHelpLanesStars')) return;
  const word = { pow: 'power', rev: 'revs', acc: 'accuracy', spr: 'spares', nrv: 'nerve', red: 'reading the lane' };
  const one = s => { const A = wBL.pow[s.kind], B = wBL.pow2[s.kind], U = wBL.ult[s.kind], r = wBL.rate(s.kind), top = wBL.stats.slice().sort((a, b) => r[b] - r[a]).slice(0, 2).map(k => word[k]);
    return `<b>The ${esc(s.n)}</b> (${esc(top.join(' and '))}): ${esc(A[0].n)} or ${esc(B[0].n)} at a full rack, ${esc(A[1].n)} or ${esc(B[1].n)} at a spare, and ${esc(U.n)}. ${esc(U.desc)}`; };
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLanesStars"><b>Superstars on the lanes.</b> A superstar on your team bowls as its own kind: its own ratings on the Stats tab, two strike powers and two spare powers to pick from on the Lanes tab, and an ultimate. ${W_STARS.filter(s => s.kind && wBL.pow[s.kind]).map(one).join(' ')} The other clubs never field one.</p>`);
};
