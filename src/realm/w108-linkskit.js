/* w108: golf gear and potions (issue #92, phase 7), by #61's conventions; the engine's side is src/gl/parts/12-kit.js,
   the plumbing (W_GEAR, W_POTIONS, the slot, the Bag) is w72.
   Gear (W_LINKS_GEAR, one piece a player, p.gear.links): a Mossgate Driver, True Irons and a Lucky Tee from the Mossgate
   grocer's (Fenn sells everything); a Soft Wedge, an Old Putter and a Calfskin Glove from chests. Small effects (to be
   measured in phase 10's lab). It reaches the engine through wLinksPlayer, never by changing the player's own ratings,
   and shows on the stats card's Gear block and the Links tab.
   Potions: the Stamina Draught (football's item, serving the Links too: here it gives focus back), and Still Water,
   Moss Tonic and Agatha's Oil from the Mossgate grocer's. In a real match, before one of your strokes, from the Bag
   row under the course (one a hole), with your caddie's advice; each comes out of your bag when given. Your caddies
   never open your bag (Watch, Manage and Auto powers don't), and Simulate leaves it alone. The other side's caddie
   brings W_LINKS_KIT.opp[tier] and gives at its skill; every use is in the line under the bar with its reason, and the
   match card says what each club brings.
   Wraps: wGearLive (wW108GearLive: the Links), wLinksPlayer (wW108LinksPlayer: gear's ratings and the piece),
   wStartLinks (wW108StartLinks: their bag goes in), wLinksRows (wW108LinksRows: the Bag row), wFourRow (wW108FourRow:
   the gear on the Links tab), wOpenLinksCard (wW108OpenLinksCard: the bags on the card), renderHelp (wW108RenderHelp:
   #wHelpLinksKit); and wGL.start and wGL.simGame (the bags go in). */

W_GEAR_CFG.sports.links = 'golf';
W_GEAR_STATN.links = { pow: 'power', acc: 'accuracy', tch: 'touch', put: 'putting', nrv: 'nerve', scr: 'scrambling' };
const W_LINKS_GEAR = {
  gl_driver: { sport: 'links', name: 'Mossgate Driver', price: 60, desc: 'A heavier head: +1 power.', fx: { r: { pow: 1 } } },
  gl_irons: { sport: 'links', name: 'True Irons', price: 60, desc: 'A set that sits square: +1 accuracy.', fx: { r: { acc: 1 } } },
  gl_tee: { sport: 'links', name: 'Lucky Tee', price: 40, desc: 'Kept behind an ear: a power shot\'s mark shrinks a third less.', fx: { pshot: 1.5 } },
  gl_wedge: { sport: 'links', name: 'Soft Wedge', price: 55, desc: 'Grooves like a spider\'s: +1 touch.', fx: { r: { tch: 1 } } },
  gl_putter: { sport: 'links', name: 'Old Putter', price: 55, desc: 'Agatha\'s own, from a drawer: +1 putting.', fx: { r: { put: 1 } } },
  gl_glove: { sport: 'links', name: 'Calfskin Glove', price: 45, desc: 'A sure grip: every stroke costs them a fifth less focus.', fx: { focus: 0.8 } },
};
for (const id of Object.keys(W_LINKS_GEAR)) wGearAdd(id, W_LINKS_GEAR[id]);
const W_LINKS_KIT = {
  potions: { glstill: 35, glmoss: 40, gloil: 45 }, // prices (the Stamina Draught's is football's: one item, every sport)
  store: ['gl_driver', 'gl_irons', 'gl_tee'], // Mossgate's gear (its store is the grocer's)
  opp: { 1: { draught: 1 }, 2: { draught: 1, glstill: 1 }, 3: { draught: 2, glstill: 1, glmoss: 1, gloil: 1 } },
};
for (const id of Object.keys(wGL.potions)) {
  const P = wGL.potions[id];
  // (the Stamina Draught is football's item, and serves the Links too: focus back for one player)
  if (id === 'draught') {
    W_POTIONS[id].sports = (W_POTIONS[id].sports || ['grid']).concat('links');
    DB.items[id].desc += ` On the course: ${P.desc.charAt(0).toLowerCase()}${P.desc.slice(1)}`;
    DB.items[id].use += ' Or in a golf match, before a stroke, one a hole.';
    continue;
  }
  wPotionAdd(id, { sport: 'links' });
  DB.items[id] = { name: P.n, desc: P.desc, use: 'In a golf match, before one of your strokes: the Bag row under the course. One potion a hole.', price: W_LINKS_KIT.potions[id] };
}
if (DB.shops.moss) { for (const id of Object.keys(W_LINKS_KIT.potions)) DB.shops.moss[id] = W_LINKS_KIT.potions[id]; for (const id of W_LINKS_KIT.store) DB.shops.moss[id] = W_LINKS_GEAR[id].price; }
for (const [c, it] of [['marigold_chest', 'gl_wedge'], ['cottage_chest', 'gl_putter'], ['genevault_c3', 'gl_glove'], ['shrine_chest', 'gloil'], ['hatchery_c3', 'glmoss']]) {
  const C = DB.chests[c]; if (C) { C.items = C.items || {}; C.items[it] = (C.items[it] || 0) + 1; }
}
const wW108GearLive = wGearLive;
wGearLive = function (sport) { return sport === 'links' ? wLinksLive() : wW108GearLive(sport); };
// a roster player's golf gear: its ratings (past the cap by W_GEAR_CFG.over at most) and the piece
const wW108LinksPlayer = wLinksPlayer;
wLinksPlayer = function (p) {
  const t = wW108LinksPlayer(p), G = p && p.id != null && wPlayer(p.id) === p ? wGearOf(p, 'links') : null;
  if (G) { t.r = wGearRate(t.r, G, wGL.cap); t.gear = wGearTag(G); }
  return t;
};

/* ---------- the bags go in ---------- */
const WLKK = { next: null };
const wLinksBagMine = () => Object.fromEntries(wMatchBag('links').filter(x => wGL.potions[x.id]).map(x => [x.id, x.n]));
const wLinksBagTheirs = tier => Object.assign({}, W_LINKS_KIT.opp[tier] || {});
const wLinksBagWords = bag => { const ks = Object.keys(bag).filter(id => bag[id] > 0 && wGL.potions[id]); return ks.length ? ks.map(id => `${bag[id]} ${wGL.potions[id].n}`).join(', ') : 'nothing'; };
const wW108StartLinks = wStartLinks;
wStartLinks = function (o) {
  WLKK.next = [null, wLinksBagTheirs((o && o.tier) || (o && o.club ? wBallTier(o.club) : 1))];
  try { return wW108StartLinks(o); } finally { WLKK.next = null; }
};
// (only the match wStartLinks starts: a round, a practice or a cup match between clubs brings none)
const wW108Start = wGL.start, wW108SimGame = wGL.simGame;
wGL.start = o => wW108Start(WLKK.next ? Object.assign({}, o, { bags: WLKK.next }) : o);
wGL.simGame = o => wW108SimGame(WLKK.next ? Object.assign({}, o, { bags: WLKK.next }) : o);

/* ---------- your Bag, in a real match ---------- */
function wLinksPotion(id, ri) {
  if (!wLinksWorld()) return 'Potions are for real matches, not rounds or practice.';
  if (!wHas(id)) return `You have no ${(wGL.potions[id] || {}).n || 'such potion'}.`;
  const r = wGL.potion(id, ri); if (r) return r;
  // (the save point is the match as it is now, with the potion given: a reload can't lose it, or give it back)
  wAddItem(id, -1); if (WG.lkg && WG.lkg.live) WG.lkg.live.snap = wGL.snapshot(); wSave(); return '';
}
let W_LINKS_KITMSG = '';
$('wLinksRowPow').insertAdjacentHTML('afterend', '<div class="wccrow" id="wLinksRowBag" hidden><span class="wccl">Bag</span><span id="wLinksBag"></span></div>');
const wW108LinksRows = wLinksRows;
wLinksRows = function () {
  wW108LinksRows();
  const row = $('wLinksRowBag'), V = WGL && !WGL.over && wGL.G && wGL.G.teams ? wGL.view : null;
  const show = !!V && wLinksWorld() && ((V.mode === 'play' && V.ph === 'aim') || V.mode === 'manage');
  row.hidden = !show; if (!show) return;
  if (row.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
  const G = wGL.G, s = V.you, R = G.teams[s].roster, bag = wLinksBagMine(), ids = Object.keys(bag), next = V.sel ? V.sel.ri : 0, adv = wGL.advice(bag, next);
  const who = id => { const P = wGL.potions[id]; if (!P.one) return '';
    return `<select data-lkwho="${id}" aria-label="Who gets the ${esc(P.n)}">${R.map((m, ri) => `<option value="${ri}"${adv && adv.id === id && adv.ri === ri ? ' selected' : ''}>${esc(m.n)} (${Math.round(G.focus[s][ri] * 100)}%)</option>`).join('')}</select>`; };
  $('wLinksBag').innerHTML = (ids.length ? ids.map(id => { const P = wGL.potions[id], why = wGL.potionWhy(id, P.one ? (adv && adv.id === id ? adv.ri : next) : -1);
      return `<span class="wcpot">${who(id)}<button class="ghost${adv && adv.id === id ? ' on' : ''}" data-lkuse="${id}" title="${esc(P.desc + (why && !/Pick|fresh/.test(why) ? ` Not now: ${why}` : ''))}">${esc(P.n)} (${bag[id]})</button></span>`; }).join(' ') : '<small class="hint">No golf potions in your bag. The Mossgate grocer sells them.</small>')
    + (W_LINKS_KITMSG ? ` <small class="wbad">${esc(W_LINKS_KITMSG)}</small>` : '') + (adv ? ` <small class="hint">Your caddie says: <b>${esc(wGL.potions[adv.id].n)}</b>${adv.ri >= 0 ? ` for ${esc(R[adv.ri].n)}` : ''}, ${esc(adv.why)}.</small>` : '');
};
$('wLinksRows').addEventListener('click', e => {
  const b = e.target.closest('[data-lkuse]'); if (!b) return;
  const id = b.dataset.lkuse, sel = document.querySelector(`[data-lkwho="${id}"]`);
  W_LINKS_KITMSG = wLinksPotion(id, sel ? +sel.value : -1); wLinksRows(); wLinksBarNote();
});

/* ---------- the Links tab and the card ---------- */
const wW108FourRow = wFourRow;
wFourRow = function (k, C) {
  const html = wW108FourRow(k, C), p = wFourWho(k), g = p && typeof k === 'number' ? wGearOf(p, 'links') : null;
  return g ? html.replace('<small class="wnst"', `<small class="wnst" title="${esc(g.desc)}">Wears the <b>${esc(g.name)}</b>.</small><small class="wnst"`) : html;
};
const wW108OpenLinksCard = wOpenLinksCard;
wOpenLinksCard = function () {
  wW108OpenLinksCard();
  const ul = document.querySelector('#modalBox .wbclubs'); if (!ul) return;
  ul.insertAdjacentHTML('afterend', `<p class="hint">What their caddies bring: ${[1, 2, 3].map(t => `tier ${t}, ${esc(wLinksBagWords(W_LINKS_KIT.opp[t]))}`).join('; ')}. Yours is your bag: give from it before a stroke, in the Bag row under the course.</p>`);
};

const wW108RenderHelp = renderHelp;
renderHelp = function () {
  wW108RenderHelp();
  const after = $('wHelpLinksGame'); if (!after || $('wHelpLinksKit')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLinksKit"><b>Golf gear and potions.</b> Each player can carry one piece for the Links: a Mossgate Driver (+1 power), True Irons (+1 accuracy) and a Lucky Tee (a power shot's mark shrinks less) from the Mossgate grocer's; a Soft Wedge (+1 touch), an Old Putter (+1 putting) and a Calfskin Glove (strokes cost less focus) from chests. Put it on from the Bag on the Team screen. In a real match, before one of your strokes, give one potion a hole from the Bag row under the course: a Stamina Draught (one player's focus back), Still Water (no pressure on your next stroke), Moss Tonic (one player scrambles better this hole) or Agatha's Oil (your next putt runs truer, and reads longer). Your caddie says which suits the moment. The other side's caddie brings potions by tier and uses them; every use is in the line under the bar.</p>`);
};
