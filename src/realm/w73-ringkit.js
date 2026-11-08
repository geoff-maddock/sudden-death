/* w73: boxing gear and potions (issue #61, phase 2), end to end. The engine's side is src/bx/parts/13-kit.js; the
   plumbing (W_GEAR, W_POTIONS, slots, the Bag) is w72.
   Gear (W_RING_GEAR, one piece a boxer): Hand Wraps, a Mouthguard and Lucky Trunks from the Cinderhold store; Weighted
   Gloves and the Ember Robe from chests; the Anvil Belt's prize adds the first piece you don't have yet.
   Potions (one a round, in the corner between rounds): the Stamina Draught (football's too), Cut Salve and Smelling
   Salts in every general store, the Rage Tonic in Cinderhold's. In Play and Manage your bag goes to the corner and you
   give them from the ring bar (your corner says which, and why); Simulate leaves your bag alone. The other side's corner
   brings W_RING_KIT.opp[tier] and uses it at its skill. Every use is in the bout's log, with its reason. What your
   corner used comes out of your bag when the card is settled (so a reload back to a corner gives a potion back to the
   card and the bag alike), and the pairing says what each corner brings.
   Wraps: wStartRing (wW73StartRing: the pairing's club and tier), wRingGo (wW73RingGo: the bags), wRingSettle
   (wW73RingSettle: the bag), wRingPairing (wW73RingPairing: the bags in words), wRingTape (wW73RingTape: gear on the
   tape), wRingBarNote (wW73RingBarNote: the potions in the corner), wBcupWon (wW73BcupWon: the Belt's gear),
   renderHelp (wW73RenderHelp: #wHelpRingKit); and wBX.cardStart and wBX.simCard (the bags go in). */

const W_RING_GEAR = {
  bx_wraps: { sport: 'ring', name: 'Hand Wraps', price: 60, desc: 'Their punches hit 8% harder and cut deeper: their power punches take a third more off the other fighter’s most health.', fx: { dmg: 1.08, cut: 1.33 } },
  bx_guard: { sport: 'ring', name: 'Mouthguard', price: 65, desc: 'Punches to the head do 5% less to them, so fewer of them stagger.', fx: { headIn: .95 } },
  bx_trunks: { sport: 'ring', name: 'Lucky Trunks', price: 50, desc: '+1 chin, and they beat every count a second sooner.', fx: { r: { chin: 1 }, rise: 1 } },
  bx_gloves: { sport: 'ring', name: 'Weighted Gloves', price: 70, desc: 'Heavier and slower: +2 power, −1 speed.', fx: { r: { pow: 2, spd: -1 } } },
  bx_robe: { sport: 'ring', name: 'Ember Robe', price: 90, desc: 'For the first 12 seconds of every bout, their punches land more often and they take a fifth less.', fx: { open: { t: 12, acc: .08, dmgIn: .8 } } },
};
for (const id of Object.keys(W_RING_GEAR)) wGearAdd(id, W_RING_GEAR[id]);
const W_RING_KIT = {
  potions: { draught: 20, cutsalve: 30, smellsalts: 25, ragetonic: 35 }, // prices (the draught's is football's)
  store: ['bx_wraps', 'bx_guard', 'bx_trunks'], // Cinderhold's gear
  belt: ['bx_robe', 'bx_gloves', 'bx_wraps', 'bx_guard', 'bx_trunks'], beltGold: 60,
  opp: { 1: { cutsalve: 1 }, 2: { cutsalve: 1, smellsalts: 1 }, 3: { cutsalve: 1, smellsalts: 1, ragetonic: 1, draught: 1 } },
};
// the potions: the engine's words, sold where they belong
for (const id of Object.keys(wBX.potions)) {
  const P = wBX.potions[id];
  if (id === 'draught') {
    W_POTIONS.draught.sports = ['grid', 'ring'];
    DB.items.draught.desc += ` In boxing: ${P.desc.charAt(0).toLowerCase()}${P.desc.slice(1)}`;
    DB.items.draught.use = 'In a football game, between plays (one potion a play), or in the corner between rounds of a bout (one a round).';
    continue;
  }
  wPotionAdd(id, { sport: 'ring' });
  DB.items[id] = { name: P.n, desc: P.desc, use: 'In a bout, in the corner between rounds: one potion a round, from the ring bar.', price: W_RING_KIT.potions[id] };
}
for (const k in DB.shops) { DB.shops[k].cutsalve = W_RING_KIT.potions.cutsalve; DB.shops[k].smellsalts = W_RING_KIT.potions.smellsalts; }
if (DB.shops.cind) { DB.shops.cind.ragetonic = W_RING_KIT.potions.ragetonic; for (const id of W_RING_KIT.store) DB.shops.cind[id] = W_RING_GEAR[id].price; }
for (const [c, it] of [['emberdeep_prize', 'bx_gloves'], ['deepseam_prize', 'bx_robe'], ['emberdeep_c3', 'smellsalts'], ['hatchery_c3', 'cutsalve']]) {
  const C = DB.chests[c]; if (C) { C.items = C.items || {}; C.items[it] = (C.items[it] || 0) + 1; }
}

/* ---------- the bags ---------- */
const WRK = { next: null, simBags: null, club: null, tier: null };
const wRingKitIds = () => Object.keys(wBX.potions);
function wRingBagMine() { const o = {}; for (const id of wRingKitIds()) if ((WG.items[id] || 0) > 0) o[id] = WG.items[id]; return o; }
function wRingBagTheirs(tier) { return Object.assign({}, W_RING_KIT.opp[tier] || {}); }
const wRingBagWords = bag => { const ks = Object.keys(bag).filter(id => bag[id] > 0); return ks.length ? ks.map(id => `${bag[id]} ${wBX.potions[id].n}`).join(', ') : 'nothing'; };
const wW73StartRing = wStartRing;
wStartRing = function (o) {
  WRK.club = o && o.club; WRK.tier = o && (o.tier || (o.club ? wBallTier(o.club) : null));
  try { return wW73StartRing(o); } finally { WRK.club = WRK.tier = null; }
};
const wW73RingGo = wRingGo;
wRingGo = function (o, mine, theirs, picks) {
  if (wBxg().live) return wW73RingGo(o, mine, theirs, picks);
  WRK.next = [o.how === 'sim' ? {} : wRingBagMine(), wRingBagTheirs(o.tier)];
  try { return wW73RingGo(o, mine, theirs, picks); } finally { WRK.next = null; }
};
// the bags go in with a card from the world, and the card keeps what you brought (to settle the bag at the end)
const wW73CardStart = wBX.cardStart, wW73SimCard = wBX.simCard;
wBX.cardStart = o => { if (WRK.next) { o = Object.assign({}, o, { bags: WRK.next }); const L = wBxg().live; if (L) L.world.bag0 = WRK.next[0]; } return wW73CardStart(o); };
wBX.simCard = o => {
  if (!WRK.next) return wW73SimCard(o);
  const r = wW73SimCard(Object.assign({}, o, { bags: WRK.next })), L = wBxg().live;
  if (L) L.world.bag0 = WRK.next[0];
  WRK.simBags = r.bags; return r;
};
// what your corner used comes out of your bag
const wW73RingSettle = wRingSettle;
wRingSettle = function (result, bouts, pairs) {
  const L = wBxg().live, bag0 = L && L.world && L.world.bag0;
  let left = null;
  if (bag0) {
    const G = wBX.G, C = wBX.card;
    left = WRK.simBags ? WRK.simBags[0] : G && G.bags && G.card ? G.bags[0] : C && C.bags ? C.bags[0] : bag0;
  }
  WRK.simBags = null;
  const msg = wW73RingSettle(result, bouts, pairs);
  if (bag0 && left) {
    const used = [];
    for (const id of Object.keys(bag0)) { const n = bag0[id] - (left[id] || 0); if (n > 0) { wAddItem(id, -Math.min(n, WG.items[id] || 0)); used.push(`${n} ${wBX.potions[id].n}`); } }
    if (used.length) { wLog(`Used in the corner: ${used.join(', ')}.`, 'm'); wSave(); }
  }
  return msg;
};

/* ---------- on screen ---------- */
// the pairing: what each corner brings
const wW73RingPairing = wRingPairing;
wRingPairing = function (o) {
  if (o && o.onGo && WRK.tier) {
    const mine = wRingBagMine(), theirs = wRingBagTheirs(WRK.tier);
    o = Object.assign({}, o, { intro: `${o.intro} <span data-rkbags>Your corner's bag: <b>${esc(wRingBagWords(mine))}</b> (Play and Manage; Simulate leaves it alone). Theirs: <b>${esc(wRingBagWords(theirs))}</b>.</span>` });
  }
  return wW73RingPairing(o);
};
// the tape: what each fighter wears
const wW73RingTape = wRingTape;
wRingTape = function (a, b) {
  const g = f => f && f.gear ? `<b title="${esc((W_GEAR[f.gear.id] || {}).desc || '')}">${esc(f.gear.name)}</b>` : '<span class="dim">none</span>';
  return wW73RingTape(a, b) + `<div class="wtgear" data-tgear>Gear: ${g(a)} · ${g(b)}</div>`;
};
// the corner: your potions, between rounds
$('wRingPatch').insertAdjacentHTML('afterend', '<span id="wRingPots"></span>');
$('wRingPots').addEventListener('click', e => { const b = e.target.closest('[data-rpot]'); if (!b) return; wBX.potion(b.dataset.rpot); wRingBarNote(); });
const wW73RingBarNote = wRingBarNote;
wRingBarNote = function () {
  wW73RingBarNote();
  const el = $('wRingPots'); if (!el || !WBX) return;
  const w = wBX.wait, G = wBX.G, bag = G && G.bags ? wBX.bag() : {};
  el.innerHTML = Object.keys(bag).filter(id => bag[id] > 0 && wBX.potions[id]).map(id => { const P = wBX.potions[id], adv = w && w.pot && w.pot.id === id;
    return `<button class="ghost${adv ? ' on' : ''}" data-rpot="${id}" ${wBX.potionOk(id) && w ? '' : 'disabled'} title="${esc(P.desc + ' One potion a round, between rounds.' + (adv ? ` Your corner says now: ${w.pot.why}.` : ''))}">${esc(P.n)} (${bag[id]})</button>`; }).join('');
  if (w && w.pot && wBX.potions[w.pot.id]) $('wRingNote').textContent += ` And the ${wBX.potions[w.pot.id].n}: ${w.pot.why}.`;
};
// the Belt: the first piece of gear you don't have yet
const wW73BcupWon = wBcupWon;
wBcupWon = function () {
  wW73BcupWon();
  const have = id => (WG.items[id] || 0) > 0 || wRoster().some(p => p.gear && p.gear.ring === id);
  const id = W_RING_KIT.belt.find(x => !have(x));
  if (id) { wAddItem(id, 1); wLog(`The Belt comes with gear: the ${W_RING_GEAR[id].name}. ${W_RING_GEAR[id].desc}`, 'g'); }
  else { RUN.gold += W_RING_KIT.beltGold; wLog(`You have every piece of boxing gear, so the Belt pays ${W_RING_KIT.beltGold} gold more instead.`, 'g'); }
};

/* ---------- How to play ---------- */
const wW73RenderHelp = renderHelp;
renderHelp = function () {
  wW73RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpRingKit')) return;
  const G = Object.values(W_RING_GEAR).map(g => `<b>${esc(g.name)}</b> (${esc(g.desc.charAt(0).toLowerCase() + g.desc.slice(1).replace(/\.$/, ''))})`).join('; ');
  const P = Object.values(wBX.potions).map(p => `<b>${esc(p.n)}</b> (${esc(p.desc.charAt(0).toLowerCase() + p.desc.slice(1).replace(/\.$/, ''))})`).join('; ');
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpRingKit"><b>Boxing gear and potions.</b> Each boxer can wear one piece of boxing gear: ${G}. Hand Wraps, the Mouthguard and Lucky Trunks are sold in Cinderhold; the rest are found, and the Anvil Belt adds a piece you don't have. Between rounds your corner can give one potion a round from your bag: ${P}. Cut Salve and Smelling Salts are in every general store, the Rage Tonic in Cinderhold's. In Play and Manage the potions are on the ring bar in the corner, and your corner says which suits the moment; Simulate leaves your bag alone. The other corner brings potions too (more at a harder tier) and uses them; the log says when, and why. The pairing says what each corner brings, and the tale of the tape shows each fighter's gear.</p>`);
};
