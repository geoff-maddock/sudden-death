/* w94: superstars on the ice (issue #83, phase 9), the Realm's side of src/realm/rink/k0-stars.js. Each of the six
   superstars has a rink kind there: ratings, two puck and two checking powers, and an ultimate, drawn as itself
   (src/realm/stars/s1-figures.js, in the wHK scope too). Nearly everything follows from that by itself: wHkOf seeds
   p.hk from the kind, the Rink tab offers the two picks of each pair (w92), the rows under the rink list the powers
   and the ultimate.
   What this part adds:
   - A superstar signed before this part had no rink kind, so their p.hk was seeded as a goblin's. Once, when the
     journey is next loaded, it is made again from their own kind and grown to their level (p.hk.st marks it done; a
     superstar made from now on has it from the start). Gear is untouched: it never changed the ratings. If the coach
     still picks your six (WG.rink.mine unset), it picks again for the new ratings.
   - How to play: #wHelpRinkStars, after hockey's gear and potions, each superstar's game on the ice.
   wRinkStarFix(p)   true when p's ratings were made again
   Wraps: wMakePlayer (wW94MakePlayer: the mark), wStart (wW94Start: older saves), renderHelp (wW94RenderHelp). */

const wRinkStarKind = k => W_STARS.some(s => s.kind === k) && wHK.kinds.includes(k);
function wRinkStarFix(p) {
  if (!p || !wRinkStarKind(p.kind) || (p.hk && p.hk.st)) return false;
  const had = !!p.hk;
  delete p.hk; wHkOf(p).st = 1;
  return had;
}
const wW94MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW94MakePlayer.apply(this, arguments); if (p && p.hk && wRinkStarKind(p.kind)) p.hk.st = 1; return p; };
const wW94Start = wStart;
wStart = function (save, opts) {
  const r = wW94Start(save, opts);
  if (WG) { let n = 0; for (const p of (WG.roster || []).concat(WG.wwait || [])) if (wRinkStarFix(p)) n++; if (n && WG.rink && WG.rink.six && !WG.rink.mine) wSixAutoPick(WG.rink); if (n && save) wSave(); }
  return r;
};

const wW94RenderHelp = renderHelp;
renderHelp = function () {
  wW94RenderHelp();
  const after = $('wHelpRinkKit') || $('wHelpRinkGame'); if (!after || $('wHelpRinkStars')) return;
  const one = s => { const B = wHK.pows[s.kind], r = wHK.rate(s.kind), top = wHK.stats.slice().sort((a, b) => r[b] - r[a]).slice(0, 2).map(k => W_HKR.stat[k][1].split(':')[0].toLowerCase());
    return `<b>The ${esc(s.n)}</b> (${esc(top.join(' and '))}): ${esc(B.one[0].n)} or ${esc(B.two[0].n)} with the puck, ${esc(B.one[1].n)} or ${esc(B.two[1].n)} without it, and ${esc(B.ult.n)}. ${esc(B.ult.desc)}`; };
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpRinkStars"><b>Superstars on the ice.</b> A superstar on your team plays hockey as its own kind: its own ratings on the Stats tab, two puck powers and two checking powers to pick from on the Rink tab, and an ultimate. ${W_STARS.filter(s => s.kind && wHK.pows[s.kind]).map(one).join(' ')} The other clubs never field one.</p>`);
};
