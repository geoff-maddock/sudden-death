/* w109: superstars on the course (issue #92, phase 8), the Realm's side of src/realm/links/l0-stars.js. Each of the six
   superstars has a golf kind there: ratings, two long-game and two short-game powers, and an ultimate. Nearly
   everything follows from that by itself: wGlOf seeds p.gl from the kind, the Links tab offers the two picks of each
   pair (w106), the Powers row lists the power and the ultimate.
   What this part adds:
   - A superstar signed before this part had no golf kind, so their p.gl was seeded as an average player's. Once, when
     the journey is next loaded, it is made again from their own kind and grown to their level (p.gl.st marks it done; a
     superstar made from now on has it from the start). Gear is untouched: it never changed the ratings. If the caddie
     still picks your four (WG.links.mine unset), it picks again for the new ratings.
   - How to play: #wHelpLinksStars, after golf's gear and potions, each superstar's game on the course.
   wLinksStarFix(p)   true when p's ratings were made again
   Wraps: wMakePlayer (wW109MakePlayer: the mark), wStart (wW109Start: older saves), renderHelp (wW109RenderHelp). */

const wLinksStarKind = k => W_STARS.some(s => s.kind === k) && !!wGL.pow[k];
function wLinksStarFix(p) {
  if (!p || !wLinksStarKind(p.kind) || (p.gl && p.gl.st)) return false;
  const had = !!p.gl;
  delete p.gl; wGlOf(p).st = 1;
  return had;
}
const wW109MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW109MakePlayer.apply(this, arguments); if (p && p.gl && wLinksStarKind(p.kind)) p.gl.st = 1; return p; };
const wW109Start = wStart;
wStart = function (save, opts) {
  const r = wW109Start(save, opts);
  if (WG) { let n = 0; for (const p of (WG.roster || []).concat(WG.wwait || [])) if (wLinksStarFix(p)) n++; if (n && WG.links && WG.links.four && !WG.links.mine) wFourAutoPick(WG.links); if (n && save) wSave(); }
  return r;
};

const wW109RenderHelp = renderHelp;
renderHelp = function () {
  wW109RenderHelp();
  const after = $('wHelpLinksKit') || $('wHelpLinksGame'); if (!after || $('wHelpLinksStars')) return;
  const one = s => { const A = wGL.pow[s.kind], B = wGL.pow2[s.kind], U = wGL.ult[s.kind], r = wGL.rate(s.kind), top = wGL.stats.slice().sort((a, b) => r[b] - r[a]).slice(0, 2).map(k => W_GLR.stat[k][1].split(':')[0].toLowerCase());
    return `<b>The ${esc(s.n)}</b> (${esc(top.join(' and '))}): ${esc(A[0].n)} or ${esc(B[0].n)} in the long game, ${esc(A[1].n)} or ${esc(B[1].n)} in the short game, and ${esc(U.n)}. ${esc(U.desc)}`; };
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLinksStars"><b>Superstars on the course.</b> A superstar on your team plays golf as its own kind: its own ratings on the Stats tab, two long-game powers and two short-game powers to pick from on the Links tab, and an ultimate. ${W_STARS.filter(s => s.kind && wGL.pow[s.kind]).map(one).join(' ')} The other clubs never field one.</p>`);
};
