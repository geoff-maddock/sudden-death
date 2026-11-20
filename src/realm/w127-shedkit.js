/* w127: curling gear and potions (issue #102, phase 7), by #61's conventions; the engine's side is
   src/cr/parts/14-kit.js, the plumbing (W_GEAR, W_POTIONS, the slot, the Bag) is w72.
   Gear (W_SHED_GEAR, one piece a player, p.gear.shed): a Hair Broom, a Teflon Slider and Gripper Shoes from Saltmere's
   store; a Granite Charm, Stone Polish and a Lucky Stopwatch from chests. Small effects (to be measured in phase 10's
   lab). It reaches the engine through wShedPlayer, never by changing the player's own ratings, and shows on the stats
   card's Gear block and the Shed tab.
   Potions: the Stamina Draught (football's item, serving the Shed too: here it gives the sweepers' legs back), and a
   Warming Draught, Frost Salt and Hennock's Pebble from Saltmere's store. In a real match, before one of your stones,
   from the Bag row under the ice (one an end), with your captain's advice; each comes out of your bag when given. Your
   captain never opens your bag (Watch, Manage and Auto powers don't), and Simulate leaves it alone. The other side
   brings W_SHED_KIT.opp[tier] and gives at its skill; the match card says what each club brings.
   Wraps: wGearLive (wW127GearLive: the Shed), wShedPlayer (wW127ShedPlayer: gear's ratings and the piece), wStartShed
   (wW127StartShed: their bag goes in), wShedRows (wW127ShedRows: the Bag row), wFourCrRow (wW127FourCrRow: the gear on
   the Shed tab), wOpenShedCard (wW127OpenShedCard: the bags on the card), wShedHowHTML (wW127ShedHow), renderHelp
   (wW127RenderHelp: #wHelpShedKit), wResumeShed (wW127ResumeShed: an older save's bag); and wCR.start, wCR.simGame
   (the bags go in) and wCR.onPhase (a refusal goes with its stone). */

W_GEAR_CFG.sports.shed = 'curling';
W_GEAR_STATN.shed = { drw: 'draw', lin: 'line', hit: 'hit', swp: 'sweep', nrv: 'nerve', red: 'read' };
const W_SHED_GEAR = {
  cr_broom: { sport: 'shed', name: 'Hair Broom', price: 55, desc: 'Horsehair, as Hennock swears by: +1 sweep.', fx: { r: { swp: 1 } } },
  cr_slider: { sport: 'shed', name: 'Teflon Slider', price: 60, desc: 'A long, smooth slide out of the hack: +1 draw.', fx: { r: { drw: 1 } } },
  cr_gripper: { sport: 'shed', name: 'Gripper Shoes', price: 40, desc: 'A sure foot on the ice: sweeping costs their legs a fifth less.', fx: { legs: .8 } },
  cr_charm: { sport: 'shed', name: 'Granite Charm', price: 45, desc: 'A chip of Ailsa granite on a cord: a big moment weighs a third less on them.', fx: { press: .65 } },
  cr_polish: { sport: 'shed', name: 'Stone Polish', price: 50, desc: 'A running band polished true: their release strays a tenth less.', fx: { err: .9 } },
  cr_stopwatch: { sport: 'shed', name: 'Lucky Stopwatch', price: 45, desc: 'Times the stone from hog to hog: their weight a tenth truer.', fx: { wt: .9 } },
};
for (const id of Object.keys(W_SHED_GEAR)) wGearAdd(id, W_SHED_GEAR[id]);
const W_SHED_KIT = {
  potions: { crwarm: 35, crsalt: 40, crpebble: 45 },
  store: ['cr_broom', 'cr_slider', 'cr_gripper'],
  opp: { 1: { draught: 1 }, 2: { draught: 1, crwarm: 1 }, 3: { draught: 2, crwarm: 1, crsalt: 1, crpebble: 1 } },
};
for (const id of Object.keys(wCR.potions)) {
  const P = wCR.potions[id];
  if (id === 'draught') {
    W_POTIONS[id].sports = (W_POTIONS[id].sports || ['grid']).concat('shed');
    DB.items[id].desc += ` At the Shed: ${P.desc.charAt(0).toLowerCase()}${P.desc.slice(1)}`;
    DB.items[id].use += ' Or in a curling match, before a stone, one an end.';
    continue;
  }
  wPotionAdd(id, { sport: 'shed' });
  DB.items[id] = { name: P.n, desc: P.desc, use: 'In a curling match, before one of your stones: the Bag row under the ice. One potion an end.', price: W_SHED_KIT.potions[id] };
}
if (DB.shops.salt) { for (const id of Object.keys(W_SHED_KIT.potions)) DB.shops.salt[id] = W_SHED_KIT.potions[id]; for (const id of W_SHED_KIT.store) DB.shops.salt[id] = W_SHED_GEAR[id].price; }
for (const [c, it] of [['cottage_chest', 'cr_charm'], ['shrine_chest', 'cr_polish'], ['genevault_c6', 'cr_stopwatch'], ['emberdeep_c3', 'crpebble'], ['genevault_c3', 'crsalt']]) {
  const C = DB.chests[c]; if (C) { C.items = C.items || {}; C.items[it] = (C.items[it] || 0) + 1; }
}
const wW127GearLive = wGearLive;
wGearLive = function (sport) { return sport === 'shed' ? wShedLive() : wW127GearLive(sport); };
const wW127ShedPlayer = wShedPlayer;
wShedPlayer = function (p) {
  const t = wW127ShedPlayer(p), G = p && p.id != null && wPlayer(p.id) === p ? wGearOf(p, 'shed') : null;
  if (G) { t.r = wGearRate(t.r, G, wCR.cap); t.gear = wGearTag(G); }
  return t;
};

/* ---------- the bags go in ---------- */
const WSHK = { next: null };
let W_SHED_KITMSG = '';
const wShedBagMine = () => Object.fromEntries(wMatchBag('shed').filter(x => wCR.potions[x.id]).map(x => [x.id, x.n]));
const wShedBagWords = bag => { const ks = Object.keys(bag).filter(id => bag[id] > 0 && wCR.potions[id]); return ks.length ? ks.map(id => `${bag[id]} ${wCR.potions[id].n}`).join(', ') : 'nothing'; };
const wW127StartShed = wStartShed;
wStartShed = function (o) {
  W_SHED_KITMSG = '';
  WSHK.next = [null, Object.assign({}, W_SHED_KIT.opp[(o && o.tier) || (o && o.club ? wBallTier(o.club) : 1)] || {})];
  try { return wW127StartShed(o); } finally { WSHK.next = null; }
};
const wW127Start = wCR.start, wW127SimGame = wCR.simGame;
wCR.start = o => wW127Start(WSHK.next ? Object.assign({}, o, { bags: WSHK.next }) : o);
wCR.simGame = o => wW127SimGame(WSHK.next ? Object.assign({}, o, { bags: WSHK.next }) : o);

/* ---------- your Bag, in a real match ---------- */
function wShedPotion(id) {
  if (!wShedWorld()) return 'Potions are for real matches, not exhibitions or practice.';
  if (!wHas(id)) return `You have no ${(wCR.potions[id] || {}).n || 'such potion'}.`;
  const r = wCR.potion(id); if (r) return r;
  wAddItem(id, -1); if (WG.shg && WG.shg.live) WG.shg.live.snap = wCR.snapshot(); wSave(); return '';
}
$('wShedPowRow').insertAdjacentHTML('afterend', '<div id="wShedBagRow" class="wccalls" hidden><div class="wccrow"><span class="wccl">Bag</span><span id="wShedBag"></span></div></div>');
const wW127ShedRows = wShedRows;
wShedRows = function () {
  wW127ShedRows();
  const row = $('wShedBagRow'), V = WCR && !WCR.over && wCR.G && wCR.G.teams ? wCR.view : null;
  const show = !!V && wShedWorld() && ((V.mode === 'play' && V.ph === 'aim' && V.up === V.you) || V.mode === 'manage');
  row.hidden = !show; if (!show) return;
  const bag = wShedBagMine(), ids = Object.keys(bag), adv = V.up === V.you ? wCR.advice(bag) : null;
  $('wShedBag').innerHTML = (ids.length ? ids.map(id => { const P = wCR.potions[id];
      return `<button class="ghost${adv && adv.id === id ? ' on' : ''}" data-crkuse="${id}" ${V.mode === 'play' ? '' : 'disabled'} title="${esc(P.desc)}">${esc(P.n)} (${bag[id]})</button>`; }).join(' ') : '<small class="hint">No curling potions in your bag. Saltmere\'s store sells them.</small>')
    + (W_SHED_KITMSG ? ` <small class="wbad">${esc(W_SHED_KITMSG)}</small>` : '') + (adv ? ` <small class="hint">Your captain says: <b>${esc(wCR.potions[adv.id].n)}</b>, ${esc(adv.why)}.</small>` : '');
};
// (a refusal is for the stone it was about: a new stone clears it)
const wW127OnPhase = wCR.onPhase;
wCR.onPhase = ph => { if (ph === 'next') W_SHED_KITMSG = ''; wW127OnPhase(ph); };
// a match saved before bags came in: the other club's bag by its tier
const wW127ResumeShed = wResumeShed;
wResumeShed = function () {
  wW127ResumeShed();
  const L = WG.shg && WG.shg.live, G = wCR.G; if (L && G && G.bags && G.bags[1] == null && WCR && WCR.world) G.bags[1] = Object.assign({}, W_SHED_KIT.opp[L.world.tier] || {});
};
$('wShedBagRow').addEventListener('click', e => {
  const b = e.target.closest('[data-crkuse]'); if (!b || b.disabled) return;
  W_SHED_KITMSG = wShedPotion(b.dataset.crkuse); wShedRows(); wShedBarNote();
});

/* ---------- the Shed tab and the card ---------- */
const wW127FourCrRow = wFourCrRow;
wFourCrRow = function (k, C) {
  const html = wW127FourCrRow(k, C), p = wFourCrWho(k), g = p && typeof k === 'number' ? wGearOf(p, 'shed') : null;
  return g ? html.replace('<small class="wnst"', `<small class="wnst" title="${esc(g.desc)}">Curls with the <b>${esc(g.name)}</b>.</small><small class="wnst"`) : html;
};
const wW127OpenShedCard = wOpenShedCard;
wOpenShedCard = function () {
  wW127OpenShedCard();
  const ul = document.querySelector('#modalBox .wbclubs'); if (!ul) return;
  ul.insertAdjacentHTML('afterend', `<p class="hint">What their curlers bring: ${[1, 2, 3].map(t => `tier ${t}, ${esc(wShedBagWords(W_SHED_KIT.opp[t]))}`).join('; ')}. Yours is your bag: give from it before a stone, in the Bag row under the ice.</p>`);
};

const wW127ShedHow = wShedHowHTML;
wShedHowHTML = function () {
  return wW127ShedHow() + `<p class="hint"><b>Gear and potions.</b> Each player can carry one piece for the Shed: a Hair Broom (+1 sweep), a Teflon Slider (+1 draw) and Gripper Shoes (sweeping costs less legs) from Saltmere's store; a Granite Charm (a big moment weighs less), Stone Polish (a truer release) and a Lucky Stopwatch (a truer weight) from chests. In a real match, before one of your stones, give a potion from the Bag row (one an end): the Stamina Draught (the sweepers' legs back), a Warming Draught (no pressure on the stone), Frost Salt (their next stone drags) or Hennock's Pebble (the worn ice fresh again). Your captain advises, but never opens your bag.</p>`;
};
const wW127RenderHelp = renderHelp;
renderHelp = function () {
  wW127RenderHelp();
  const after = $('wHelpShedPowers'); if (!after || $('wHelpShedKit')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpShedKit"><b>Curling gear and potions.</b> One piece of curling gear a player (Saltmere's store sells a Hair Broom, a Teflon Slider and Gripper Shoes; chests hold the rest), and curling potions from your bag in a real match, one an end, from the Bag row under the ice. See Curling: how it works.</p>`);
};
