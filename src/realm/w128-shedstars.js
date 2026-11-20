/* w128: superstars on the ice (issue #102, phase 8), the Realm's side of src/realm/shed/s0-stars.js, as w119 is the
   Lanes'. Each of the six superstars has a curling kind there: ratings, two draw and two hit powers, and an ultimate.
   The rest follows by itself: wCrOf seeds p.cr from the kind, the Shed tab offers the two picks of each pair (w126),
   the Powers row lists the power and the ultimate, and the curler holding the broom and the sweepers on the ice are
   drawn as their own kind (09-draw.js, with the superstars' figures from src/realm/stars/s1-figures.js).
   What this part adds:
   - A superstar signed before this part had no curling kind, so their p.cr was seeded as an average player's. Once,
     when the journey is next loaded, it is made again from their own kind and grown to their level (p.cr.st marks it
     done; a superstar made from now on has it from the start). Gear is untouched: it never changed the ratings.
   - How to play: #wHelpShedStars, after curling's gear and potions, each superstar's game on the ice.
   wShedStarFix(p)   true when p's ratings were made again
   Wraps: wMakePlayer (wW128MakePlayer: the mark), wStart (wW128Start: older saves), renderHelp (wW128RenderHelp). */

const wShedStarKind = k => W_STARS.some(s => s.kind === k) && !!wCR.pow[k];
function wShedStarFix(p) {
  if (!p || !wShedStarKind(p.kind) || (p.cr && p.cr.st)) return false;
  const had = !!p.cr;
  delete p.cr; const b = wCrOf(p); b.st = 1;
  return had;
}
const wW128MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW128MakePlayer.apply(this, arguments); if (p && wShedStarKind(p.kind)) { const b = wCrOf(p); if (b) b.st = 1; } return p; };
const wW128Start = wStart;
wStart = function (save, opts) {
  const r = wW128Start(save, opts);
  // (ratings made again: the captain picks the four again, unless you set it yourself)
  if (WG) { let n = 0; for (const p of (WG.roster || []).concat(WG.wwait || [])) if (wShedStarFix(p)) n++; if (n && !(WG.shed && WG.shed.mine)) wFourAutoCr(); if (n && save) wSave(); }
  return r;
};

const wW128RenderHelp = renderHelp;
renderHelp = function () {
  wW128RenderHelp();
  const after = $('wHelpShedKit') || $('wHelpShedGame'); if (!after || $('wHelpShedStars')) return;
  const word = { drw: 'the draw', lin: 'the line', hit: 'the hit', swp: 'sweeping', nrv: 'nerve', red: 'reading the ice' };
  const one = s => { const A = wCR.pow[s.kind], B = wCR.pow2[s.kind], U = wCR.ult[s.kind], r = wCR.rate(s.kind), top = wCR.stats.slice().sort((a, b) => r[b] - r[a]).slice(0, 2).map(k => word[k]);
    return `<b>The ${esc(s.n)}</b> (${esc(top.join(' and '))}): ${esc(A[0].n)} or ${esc(B[0].n)} for a draw, ${esc(A[1].n)} or ${esc(B[1].n)} for a hit, and ${esc(U.n)}. ${esc(U.desc)}`; };
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpShedStars"><b>Superstars on the ice.</b> A superstar on your team curls as its own kind: its own ratings on the Stats tab, two draw powers and two hit powers to pick from on the Shed tab, and an ultimate. ${W_STARS.filter(s => s.kind && wCR.pow[s.kind]).map(one).join(' ')}</p>`);
};
