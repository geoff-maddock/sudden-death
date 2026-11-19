/* w118: bowling gear and potions (issue #100, phase 7), by #61's conventions; the engine's side is
   src/bl/parts/14-kit.js, the plumbing (W_GEAR, W_POTIONS, the slot, the Bag) is w72.
   Gear (W_LANES_GEAR, one piece a player, p.gear.lanes): a Reactive Ball, a Wrist Brace and a Rosin Bag from Saltmere's
   store; a Urethane Ball, Slide Shoes and a Lucky Pin from chests. Small effects (to be measured in phase 10's lab). It
   reaches the engine through wLanesPlayer, never by changing the player's own ratings, and shows on the stats card's
   Gear block and the Lanes tab.
   Potions: the Stamina Draught (football's item, serving the Lanes too: here it gives arm back), and Steady Hand, Grip
   Chalk and Moll's Lane Oil from Saltmere's store. In a real match, before one of your balls, from the Bag row under the
   lanes (one a frame), with your captain's advice; each comes out of your bag when given. Your captain never opens your
   bag (Watch, Manage and Auto powers don't), and Simulate leaves it alone. The other side brings W_LANES_KIT.opp[tier]
   and gives at its skill; the match card says what each club brings.
   Wraps: wGearLive (wW118GearLive: the Lanes), wLanesPlayer (wW118LanesPlayer: gear's ratings and the piece),
   wStartLanes (wW118StartLanes: their bag goes in), wLanesRows (wW118LanesRows: the Bag row), wFiveRow (wW118FiveRow:
   the gear on the Lanes tab), wOpenLanesCard (wW118OpenLanesCard: the bags on the card), renderHelp (wW118RenderHelp:
   #wHelpLanesKit); and wBL.start and wBL.simGame (the bags go in). */

W_GEAR_CFG.sports.lanes = 'bowling';
W_GEAR_STATN.lanes = { pow: 'power', rev: 'revs', acc: 'accuracy', spr: 'spare', nrv: 'nerve', red: 'read' };
const W_LANES_GEAR = {
  bl_reactive: { sport: 'lanes', name: 'Reactive Ball', price: 60, desc: 'A resin shell that grabs the dry boards: +1 revs.', fx: { r: { rev: 1 } } },
  bl_brace: { sport: 'lanes', name: 'Wrist Brace', price: 55, desc: 'Holds the wrist square at the release: +1 accuracy.', fx: { r: { acc: 1 } } },
  bl_rosin: { sport: 'lanes', name: 'Rosin Bag', price: 40, desc: 'A dry grip: every ball costs them a fifth less arm.', fx: { arm: .8 } },
  bl_urethane: { sport: 'lanes', name: 'Urethane Ball', price: 55, desc: 'An old, honest ball: their release strays a tenth less.', fx: { err: .9 } },
  bl_shoes: { sport: 'lanes', name: 'Slide Shoes', price: 50, desc: 'A sure slide to the line: a big moment weighs a third less on them.', fx: { press: .65 } },
  bl_luckypin: { sport: 'lanes', name: 'Lucky Pin', price: 45, desc: 'A pin from the 300 game, kept in the bag: their ball carries a little better.', fx: { carry: 1.05 } },
};
for (const id of Object.keys(W_LANES_GEAR)) wGearAdd(id, W_LANES_GEAR[id]);
const W_LANES_KIT = {
  potions: { blsteady: 35, blchalk: 35, bloil: 45 },
  store: ['bl_reactive', 'bl_brace', 'bl_rosin'],
  opp: { 1: { draught: 1 }, 2: { draught: 1, blsteady: 1 }, 3: { draught: 2, blsteady: 1, blchalk: 1, bloil: 1 } },
};
for (const id of Object.keys(wBL.potions)) {
  const P = wBL.potions[id];
  if (id === 'draught') {
    W_POTIONS[id].sports = (W_POTIONS[id].sports || ['grid']).concat('lanes');
    DB.items[id].desc += ` At the lanes: ${P.desc.charAt(0).toLowerCase()}${P.desc.slice(1)}`;
    DB.items[id].use += ' Or in a bowling match, before a ball, one a frame.';
    continue;
  }
  wPotionAdd(id, { sport: 'lanes' });
  DB.items[id] = { name: P.n, desc: P.desc, use: 'In a bowling match, before one of your balls: the Bag row under the lanes. One potion a frame.', price: W_LANES_KIT.potions[id] };
}
if (DB.shops.salt) { for (const id of Object.keys(W_LANES_KIT.potions)) DB.shops.salt[id] = W_LANES_KIT.potions[id]; for (const id of W_LANES_KIT.store) DB.shops.salt[id] = W_LANES_GEAR[id].price; }
for (const [c, it] of [['marigold_chest', 'bl_urethane'], ['chapel_chest', 'bl_shoes'], ['deepseam_c3', 'bl_luckypin'], ['hatchery_c6', 'bloil'], ['emberdeep_c6', 'blchalk']]) {
  const C = DB.chests[c]; if (C) { C.items = C.items || {}; C.items[it] = (C.items[it] || 0) + 1; }
}
const wW118GearLive = wGearLive;
wGearLive = function (sport) { return sport === 'lanes' ? wLanesLive() : wW118GearLive(sport); };
const wW118LanesPlayer = wLanesPlayer;
wLanesPlayer = function (p) {
  const t = wW118LanesPlayer(p), G = p && p.id != null && wPlayer(p.id) === p ? wGearOf(p, 'lanes') : null;
  if (G) { t.r = wGearRate(t.r, G, wBL.cap); t.gear = wGearTag(G); }
  return t;
};

/* ---------- the bags go in ---------- */
const WLNK = { next: null };
const wLanesBagMine = () => Object.fromEntries(wMatchBag('lanes').filter(x => wBL.potions[x.id]).map(x => [x.id, x.n]));
const wLanesBagWords = bag => { const ks = Object.keys(bag).filter(id => bag[id] > 0 && wBL.potions[id]); return ks.length ? ks.map(id => `${bag[id]} ${wBL.potions[id].n}`).join(', ') : 'nothing'; };
const wW118StartLanes = wStartLanes;
wStartLanes = function (o) {
  WLNK.next = [null, Object.assign({}, W_LANES_KIT.opp[(o && o.tier) || (o && o.club ? wBallTier(o.club) : 1)] || {})];
  try { return wW118StartLanes(o); } finally { WLNK.next = null; }
};
const wW118Start = wBL.start, wW118SimGame = wBL.simGame;
wBL.start = o => wW118Start(WLNK.next ? Object.assign({}, o, { bags: WLNK.next }) : o);
wBL.simGame = o => wW118SimGame(WLNK.next ? Object.assign({}, o, { bags: WLNK.next }) : o);

/* ---------- your Bag, in a real match ---------- */
function wLanesPotion(id, ri) {
  if (!wLanesWorld()) return 'Potions are for real matches, not exhibitions or practice.';
  if (!wHas(id)) return `You have no ${(wBL.potions[id] || {}).n || 'such potion'}.`;
  const r = wBL.potion(id, ri); if (r) return r;
  wAddItem(id, -1); if (WG.lng && WG.lng.live) WG.lng.live.snap = wBL.snapshot(); wSave(); return '';
}
let W_LANES_KITMSG = '';
$('wLanesRows').insertAdjacentHTML('beforeend', '<div class="wccrow" id="wLanesRowBag" hidden><span class="wccl">Bag</span><span id="wLanesBag"></span></div>');
const wW118LanesRows = wLanesRows;
wLanesRows = function () {
  wW118LanesRows();
  const row = $('wLanesRowBag'), V = WBL && !WBL.over && wBL.G && wBL.G.teams ? wBL.view : null;
  const show = !!V && wLanesWorld() && ((V.mode === 'play' && V.ph === 'aim' && V.up === V.you) || V.mode === 'manage');
  row.hidden = !show; if (!show) return;
  if (row.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
  const G = wBL.G, s = V.you, Ro = G.teams[s].roster, bag = wLanesBagMine(), ids = Object.keys(bag), next = V.up === s ? V.bowler : 0, adv = V.up === s ? wBL.advice(bag, next) : null;
  const who = id => { const P = wBL.potions[id]; if (!P.one) return '';
    return `<select data-nkwho="${id}" aria-label="Who gets the ${esc(P.n)}">${Ro.map((m, ri) => `<option value="${ri}"${(adv && adv.id === id ? adv.ri === ri : ri === next) ? ' selected' : ''}>${esc(m.n)} (${Math.round(G.arm[s][ri] * 100)}%)</option>`).join('')}</select>`; };
  $('wLanesBag').innerHTML = (ids.length ? ids.map(id => { const P = wBL.potions[id];
      return `<span class="wcpot">${who(id)}<button class="ghost${adv && adv.id === id ? ' on' : ''}" data-nkuse="${id}" ${V.mode === 'play' ? '' : 'disabled'} title="${esc(P.desc)}">${esc(P.n)} (${bag[id]})</button></span>`; }).join(' ') : '<small class="hint">No bowling potions in your bag. Saltmere\'s store sells them.</small>')
    + (W_LANES_KITMSG ? ` <small class="wbad">${esc(W_LANES_KITMSG)}</small>` : '') + (adv ? ` <small class="hint">Your captain says: <b>${esc(wBL.potions[adv.id].n)}</b>${adv.ri >= 0 ? ` for ${esc(Ro[adv.ri].n)}` : ''}, ${esc(adv.why)}.</small>` : '');
};
$('wLanesRows').addEventListener('click', e => {
  const b = e.target.closest('[data-nkuse]'); if (!b || b.disabled) return;
  const id = b.dataset.nkuse, sel = document.querySelector(`[data-nkwho="${id}"]`);
  W_LANES_KITMSG = wLanesPotion(id, sel ? +sel.value : -1); wLanesRows(); wLanesBarNote();
});

/* ---------- the Lanes tab and the card ---------- */
const wW118FiveRow = wFiveRow;
wFiveRow = function (k, C) {
  const html = wW118FiveRow(k, C), p = wFiveWho(k), g = p && typeof k === 'number' ? wGearOf(p, 'lanes') : null;
  return g ? html.replace('<small class="wnst"', `<small class="wnst" title="${esc(g.desc)}">Bowls with the <b>${esc(g.name)}</b>.</small><small class="wnst"`) : html;
};
const wW118OpenLanesCard = wOpenLanesCard;
wOpenLanesCard = function () {
  wW118OpenLanesCard();
  const ul = document.querySelector('#modalBox .wbclubs'); if (!ul) return;
  ul.insertAdjacentHTML('afterend', `<p class="hint">What their bowlers bring: ${[1, 2, 3].map(t => `tier ${t}, ${esc(wLanesBagWords(W_LANES_KIT.opp[t]))}`).join('; ')}. Yours is your bag: give from it before a ball, in the Bag row under the lanes.</p>`);
};

const wW118RenderHelp = renderHelp;
renderHelp = function () {
  wW118RenderHelp();
  const after = $('wHelpLanesGame'); if (!after || $('wHelpLanesKit')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLanesKit"><b>Bowling gear and potions.</b> Each player can carry one piece for the Lanes: a Reactive Ball (+1 revs), a Wrist Brace (+1 accuracy) and a Rosin Bag (balls cost less arm) from Saltmere's store; a Urethane Ball (a truer release), Slide Shoes (a big moment weighs less) and a Lucky Pin (a little more carry) from chests. Put it on from the Bag on the Team screen. In a real match, before one of your balls, give one potion a frame from the Bag row under the lanes: a Stamina Draught (one bowler's arm back), Steady Hand (no pressure on your next ball), Grip Chalk (one bowler truer this frame) or Moll's Lane Oil (a fresh stripe on the lane you bowl next, the dry track gone). Your captain says which suits the moment. The other side brings potions by tier and uses them.</p>`);
};
