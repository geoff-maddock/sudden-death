/* w156: superstars at the Lists (issue #117, phase 9), the Realm's side of src/realm/lists/j0-stars.js, as w128 is the
   Shed's. Each of the six superstars has a jousting kind there: ratings, two lance and two shield powers (one a curse),
   and an ultimate. The rest follows by itself: wJtOf seeds p.jt from the kind, the Lists tab offers the two picks of
   each pair (w153), the Powers row lists the power and the ultimate, the herald's card names them, and a superstar
   riding is drawn as its own kind (08-draw.js, with the superstars' figures from src/realm/stars/s1-figures.js).
   What this part adds:
   - A superstar signed before this part had no jousting kind, so their p.jt was seeded as an average player's. Once,
     when the journey is next loaded, it is made again from their own kind and grown to their level (p.jt.st marks it
     done; a superstar made from now on has it from the start). Gear is untouched: it never changed the ratings.
   - How to play: #wHelpListsStars, after jousting's gear and potions, each superstar's game at the Lists; and a line
     in Jousting: how it works (#wListsHowStars).
   The redeemed Umbral champions (u9-redeemed.js) are league kinds, so jousting already knows them; they are not
   superstars here (W_STARS only).
   wListsStarFix(p)   true when p's ratings were made again
   wListsRepick(C)    the captain's four again on the new ratings, the call-ups kept
   Wraps: wMakePlayer (wW156MakePlayer: the mark), wStart (wW156Start: older saves), wListsHowHTML (wW156ListsHow),
   renderHelp (wW156RenderHelp). */

const wListsStarKind = k => W_STARS.some(s => s.kind === k) && Object.prototype.hasOwnProperty.call(wJT.pow, k);
function wListsStarFix(p) {
  if (!p || !wListsStarKind(p.kind) || (p.jt && p.jt.st)) return false;
  const had = !!p.jt;
  delete p.jt; const b = wJtOf(p); b.st = 1;
  return had;
}
function wListsRepick(C) {
  const cu = C.cu.slice(); wListsAutoPick(C);
  // (each open place takes the kept call-up that suits its role best)
  for (let i = 0; i < 4 && cu.length; i++) if (C.four[i] == null) {
    const role = i < 2 ? 'rider' : 'squire'; cu.sort((a, b) => wJtFit(b, role) - wJtFit(a, role));
    const c = cu.shift(); C.four[i] = c.cid; C.cu.push(c);
  }
  wListsSync();
}
const wW156MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW156MakePlayer.apply(this, arguments); if (p && wListsStarKind(p.kind)) { const b = wJtOf(p); if (b) b.st = 1; } return p; };
const wW156Start = wStart;
wStart = function (save, opts) {
  const r = wW156Start(save, opts);
  // (ratings made again: the captain picks the four again from your roster, unless you set it yourself; the call-ups
  // filling the rest are kept, with their ratings and picks)
  if (WG) { let n = 0; for (const p of (WG.roster || []).concat(WG.wwait || [])) if (wListsStarFix(p)) n++; if (n && WG.lists && WG.lists.four && !WG.lists.mine) wListsRepick(WG.lists); if (n && save) wSave(); }
  return r;
};

/* ---------- How to play ---------- */
const W_JTSTAR_WORD = { lance: 'the lance', couch: 'the couch', seat: 'the seat', shield: 'the shield', ride: 'the ride', nerve: 'nerve', care: 'a squire\'s care' };
function wListsStarLine(s) {
  const A = wJT.pow[s.kind], B = wJT.pow2[s.kind], U = wJT.ult[s.kind], r = wJT.rate(s.kind), top = wJT.stats.slice().sort((a, b) => r[b] - r[a]).slice(0, 2).map(k => W_JTSTAR_WORD[k]);
  return `<b>The ${esc(s.n)}</b> (${esc(top.join(' and '))}): ${esc(A[0].n)} or ${esc(B[0].n)} for the lance, ${esc(A[1].n)} or ${esc(B[1].n)} for the shield, and ${esc(U.n)}. ${esc(U.desc)}`;
}
const wListsStarsAll = () => W_STARS.filter(s => s.kind && wListsStarKind(s.kind));
const wW156ListsHow = wListsHowHTML;
wListsHowHTML = function () {
  return wW156ListsHow() + `<p class="hint" id="wListsHowStars"><b>Superstars at the Lists.</b> A superstar on your team jousts as its own kind: its own ratings, two lance powers and two shield powers to pick from on the Lists tab (one of the four lays a curse), and an ultimate of its own that marks a course. ${wListsStarsAll().map(s => `${esc(s.n)}: ${esc(wJT.ult[s.kind].n)}.`).join(' ')}</p>`;
};
const wW156RenderHelp = renderHelp;
renderHelp = function () {
  wW156RenderHelp();
  const after = $('wHelpListsKit') || $('wHelpListsGround') || $('wHelpListsPowers'); if (!after || $('wHelpListsStars')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpListsStars"><b>Superstars at the Lists.</b> A superstar on your team jousts as its own kind: its own ratings on the Stats tab, two lance powers and two shield powers to pick from on the Lists tab, and an ultimate. ${wListsStarsAll().map(wListsStarLine).join(' ')}</p>`);
};
