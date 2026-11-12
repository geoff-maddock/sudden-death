/* w83: superstars on the court (issue #77, phase 8), the Realm's side of src/realm/court/c0-stars.js. Each of the six
   superstars has a court kind there: ratings, two offense and two defense powers, and an ultimate, drawn as itself
   (src/realm/stars/s1-figures.js, in the wBK scope too). Nearly everything follows from that by itself: wBkOf seeds
   p.bk from the kind, the Court tab offers the two picks at each end (w81), the calls panel lists the powers and the
   ultimate, and How to play's table of powers gains six rows.
   What this part adds:
   - A superstar signed before this part had no court kind, so their p.bk was seeded as a goblin's. Once, when the
     journey is next loaded, it is made again from their own kind and grown to their level (p.bk.st marks it done;
     a superstar made from now on has it from the start). Gear is untouched: it never changed the ratings. If the
     coach still picks your five (WG.court.mine unset), it picks again for the new ratings.
   - How to play: #wHelpCourtStars, after the court's gear and potions, each superstar's game on the court.
   wCourtStarFix(p)   true when p's ratings were made again
   Wraps: wMakePlayer (wW83MakePlayer: the mark), wStart (wW83Start: older saves), renderHelp (wW83RenderHelp). */

const wCourtStarKind = k => W_STARS.some(s => s.kind === k) && wBK.kinds.includes(k);
function wCourtStarFix(p) {
  if (!p || !wCourtStarKind(p.kind) || (p.bk && p.bk.st)) return false;
  const had = !!p.bk;
  delete p.bk; wBkOf(p).st = 1;
  return had;
}
const wW83MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW83MakePlayer.apply(this, arguments); if (p && p.bk && wCourtStarKind(p.kind)) p.bk.st = 1; return p; };
const wW83Start = wStart;
wStart = function (save, opts) {
  const r = wW83Start(save, opts);
  if (WG) { let n = 0; for (const p of (WG.roster || []).concat(WG.wwait || [])) if (wCourtStarFix(p)) n++; if (n && WG.court && WG.court.five && !WG.court.mine) wCourtAutoPick(WG.court); if (n && save) wSave(); }
  return r;
};

const wW83RenderHelp = renderHelp;
renderHelp = function () {
  wW83RenderHelp();
  const after = $('wHelpCourtKit') || $('wHelpCourtPow'); if (!after || $('wHelpCourtStars')) return;
  const one = s => { const B = wBK.powerBook[s.kind], r = wBK.rate(s.kind), top = wBK.stats.slice().sort((a, b) => r[b] - r[a]).slice(0, 2).map(k => W_BKR.stat[k][1].split(':')[0].toLowerCase());
    return `<b>The ${esc(s.n)}</b> (${esc(top.join(' and '))}): ${esc(B.off.n)} or ${esc(B.off2.n)} on offense, ${esc(B.def.n)} or ${esc(B.def2.n)} on defense, and ${esc(B.ult.n)}. ${esc(B.ult.desc)}`; };
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpCourtStars"><b>Superstars on the court.</b> A superstar on your team plays basketball as its own kind: its own ratings on the Stats tab, two offense and two defense powers to pick from on the Court tab, and an ultimate. ${W_STARS.filter(s => s.kind && wBK.powerBook[s.kind]).map(one).join(' ')} The other clubs never field one.</p>`);
};
