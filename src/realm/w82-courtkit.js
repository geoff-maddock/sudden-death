/* w82: basketball gear and potions (issue #77, phase 7), by #61's conventions; the engine's side is
   src/bk/parts/15-kit.js, the plumbing (W_GEAR, W_POTIONS, the slot, the Bag) is w72.
   Gear (W_COURT_GEAR, one piece a player, p.gear.court): Court Shoes, Wrist Bands and Lucky Socks from the Graftonbury
   store; Knee Pads and Ankle Braces from chests; the Charter Net (phase 9) adds a piece you don't have yet. Small
   effects (measured in phase 10's lab). It reaches the engine through wCourtPlayer, never by changing the player's own
   ratings, and shows on the stats card's Gear block and the Court tab.
   Potions: the Stamina Draught and Second Wind (football's items, serving the court too: the general stores sell them)
   and Steady Drops and the Hot Hand Elixir from the Graftonbury store. In a real game, at a stoppage, from the calls panel's Bag (one a stoppage), with your
   bench's advice; each comes out of your bag when given. Your coaches never open your bag (Watch and Auto powers
   don't), and Simulate leaves it alone. The other side's bench brings W_COURT_KIT.opp[tier] and gives at its skill;
   every use is in the line under the court with its reason, and the game card says what each club brings.
   Wraps: wGearLive (wW82GearLive: the court), wCourtPlayer (wW82CourtPlayer: gear's ratings and the piece), wStartCourt
   (wW82StartCourt: their bag goes in), wCourtCalls (wW82CourtCalls: the Bag block), wCourtRow (wW82CourtRow: the gear
   on the Court tab), wOpenCourtCard (wW82OpenCourtCard: the bags on the card), renderHelp (wW82RenderHelp:
   #wHelpCourtKit); and wBK.start and wBK.simGame (the bags go in). */

W_GEAR_CFG.sports.court = 'basketball';
W_GEAR_STATN.court = { spd: 'speed', siz: 'size', hop: 'hops', tch: 'touch', hnd: 'handle', def: 'defense' };
const W_COURT_GEAR = {
  bk_shoes: { sport: 'court', name: 'Court Shoes', price: 60, desc: 'Grippy soles: 2% faster, and they cut a quarter sharper (on the wax too).', fx: { spd: 1.02, turn: 1.25 } },
  bk_bands: { sport: 'court', name: 'Wrist Bands', price: 50, desc: 'A steadier wrist: the release window a little wider, and their shots a touch likelier.', fx: { win: .03 } },
  bk_pads: { sport: 'court', name: 'Knee Pads', price: 55, desc: 'They box out as if a point bigger.', fx: { reb: 1 } },
  bk_braces: { sport: 'court', name: 'Ankle Braces', price: 45, desc: 'Crossovers and spins cost them half the stamina.', fx: { move: .5 } },
  bk_socks: { sport: 'court', name: 'Lucky Socks', price: 40, desc: 'Free throws 5 points likelier.', fx: { ft: .05 } },
};
for (const id of Object.keys(W_COURT_GEAR)) wGearAdd(id, W_COURT_GEAR[id]);
const W_COURT_KIT = {
  potions: { bkhot: 40, bksteady: 30 }, // prices (the Stamina Draught's and Second Wind's are football's: one item each, every sport)
  store: ['bk_shoes', 'bk_bands', 'bk_socks'], // Graftonbury's gear (its store is the hq shop)
  cup: ['bk_pads', 'bk_braces', 'bk_shoes', 'bk_bands', 'bk_socks'], cupGold: 60,
  opp: { 1: { draught: 1 }, 2: { draught: 1, secondwind: 1 }, 3: { draught: 2, secondwind: 1, bksteady: 1, bkhot: 1 } },
};
for (const id of Object.keys(wBK.potions)) {
  const P = wBK.potions[id];
  // (the Stamina Draught and Second Wind are football's items, and serve the court too)
  if (id === 'draught' || id === 'secondwind') {
    W_POTIONS[id].sports = (W_POTIONS[id].sports || ['grid']).concat('court');
    DB.items[id].desc += ` On the court: ${P.desc.charAt(0).toLowerCase()}${P.desc.slice(1)}`;
    DB.items[id].use += ` Or in a basketball game, at a stoppage${id === 'secondwind' ? ' (a timeout)' : ''}, one a stoppage.`;
    continue;
  }
  wPotionAdd(id, { sport: 'court' });
  DB.items[id] = { name: P.n, desc: P.desc, use: 'In a basketball game, at a stoppage: the Bag under the court. One potion a stoppage.', price: W_COURT_KIT.potions[id] };
}
if (DB.shops.hq) { for (const id of Object.keys(W_COURT_KIT.potions)) DB.shops.hq[id] = W_COURT_KIT.potions[id]; for (const id of W_COURT_KIT.store) DB.shops.hq[id] = W_COURT_GEAR[id].price; }
for (const [c, it] of [['hatchery_prize', 'bk_pads'], ['deepseam_prize', 'bk_braces'], ['genevault_c3', 'bksteady'], ['emberdeep_c6', 'bkhot']]) {
  const C = DB.chests[c]; if (C) { C.items = C.items || {}; C.items[it] = (C.items[it] || 0) + 1; }
}
const wW82GearLive = wGearLive;
wGearLive = function (sport) { return sport === 'court' ? wCourtLive() : wW82GearLive(sport); };
// a roster player's court gear: its ratings (past the cap by W_GEAR_CFG.over at most) and the piece
const wW82CourtPlayer = wCourtPlayer;
wCourtPlayer = function (p) {
  const t = wW82CourtPlayer(p), G = p && p.id != null && wPlayer(p.id) === p ? wGearOf(p, 'court') : null;
  if (G) { t.r = wGearRate(t.r, G, W_BKR.cap); t.gear = wGearTag(G); }
  return t;
};

/* ---------- the bags go in ---------- */
const WCK = { next: null };
const wCourtBagMine = () => Object.fromEntries(wMatchBag('court').filter(x => wBK.potions[x.id]).map(x => [x.id, x.n]));
const wCourtBagTheirs = tier => Object.assign({}, W_COURT_KIT.opp[tier] || {});
const wCourtBagWords = bag => { const ks = Object.keys(bag).filter(id => bag[id] > 0 && wBK.potions[id]); return ks.length ? ks.map(id => `${bag[id]} ${wBK.potions[id].n}`).join(', ') : 'nothing'; };
const wW82StartCourt = wStartCourt;
wStartCourt = function (o) {
  WCK.next = [null, wCourtBagTheirs((o && o.tier) || (o && o.club ? wBallTier(o.club) : 1))];
  try { return wW82StartCourt(o); } finally { WCK.next = null; }
};
// (only the game wStartCourt starts: a scrimmage, a practice or a cup game between clubs brings none)
const wW82Start = wBK.start, wW82SimGame = wBK.simGame;
wBK.start = o => wW82Start(WCK.next ? Object.assign({}, o, { bags: WCK.next }) : o);
wBK.simGame = o => wW82SimGame(WCK.next && !(o && o.keep) ? Object.assign({}, o, { bags: WCK.next }) : o);

/* ---------- your Bag, in a real game ---------- */
function wCourtPotion(id, ri) {
  if (!wCourtWorld()) return 'Potions are for real games, not practice.';
  if (!wHas(id)) return `You have no ${(wBK.potions[id] || {}).n || 'such potion'}.`;
  const r = wBK.potion(id, ri); if (r) return r;
  // (the save point is the game as it is now, with the potion given: a reload can't lose it, or give it back)
  wAddItem(id, -1); if (WG.bkg && WG.bkg.live) WG.bkg.live.snap = wBK.snapshot(); wSave(); return '';
}
let W_COURT_KITKEY = '';
const wW82CourtCalls = wCourtCalls;
wCourtCalls = function (force) {
  wW82CourtCalls(force);
  const box = $('wCourtCalls'); if (box.hidden || !box.querySelector('.wccrows')) { W_COURT_KITKEY = ''; return; }
  if (!wCourtWorld()) { const k = box.querySelector('.wcckit'); if (k) k.remove(); return; }
  if (!box.querySelector('.wcckit')) box.insertAdjacentHTML('beforeend', '<div class="wcckit"></div>');
  const bag = wCourtBagMine(), G = wBK.G, you = wBK.you, ph = wBK.phase;
  const key = `${wBK.ver}|${ph}|${JSON.stringify(bag)}|${G.stam[you].map(v => Math.round(v / 5)).join()}`;
  if (!force && key === W_COURT_KITKEY) return;
  if (!force && (W_COURT_DOWN || (box.contains(document.activeElement) && document.activeElement.tagName === 'SELECT'))) return;
  W_COURT_KITKEY = key;
  const ids = Object.keys(bag), R = G.teams[you].roster, adv = wBK.advice(bag);
  const who = id => { const P = wBK.potions[id]; if (!P.one) return ''; const list = id === 'bkhot' ? G.on[you] : R.map((_, i) => i).filter(i => G.on[you].includes(i) || !((G.pf[you][i] || 0) >= wBK.rules.out));
    return `<select data-ckwho="${id}" aria-label="Who gets the ${esc(P.n)}">${list.map(ri => `<option value="${ri}"${adv && adv.id === id && adv.ri === ri ? ' selected' : ''}>${esc(R[ri].n)} (${Math.round(G.stam[you][ri])})</option>`).join('')}</select>`; };
  box.querySelector('.wcckit').innerHTML = `<div class="wccrow"><span class="wccl">Bag</span>${ids.length ? ids.map(id => { const P = wBK.potions[id], why = wBK.potionWhy(id, P.one ? (adv && adv.id === id ? adv.ri : G.on[you][0]) : -1);
      return `<span class="wcpot">${who(id)}<button class="ghost${adv && adv.id === id ? ' on' : ''}" data-ckuse="${id}" title="${esc(P.desc + (why && !/Pick|fresh|already on fire|floor/.test(why) ? ` Not now: ${why}` : ''))}">${esc(P.n)} (${bag[id]})</button></span>`; }).join('') : '<small class="hint">No basketball potions in your bag. The Graftonbury store sells them.</small>'}</div>
    ${adv ? `<p class="hint">Your bench says: <b>${esc(wBK.potions[adv.id].n)}</b>${adv.ri >= 0 ? ` for ${esc(R[adv.ri].n)}` : ''}, ${esc(adv.why)}.</p>` : ''}`;
};
$('wCourtCalls').addEventListener('click', e => {
  const b = e.target.closest('[data-ckuse]'); if (!b) return;
  const id = b.dataset.ckuse, sel = document.querySelector(`[data-ckwho="${id}"]`), r = wCourtPotion(id, sel ? +sel.value : -1);
  if (r) wCourtCallSay(r); wCourtCalls(true);
});

/* ---------- the Court tab and the card ---------- */
const wW82CourtRow = wCourtRow;
wCourtRow = function (k, C) {
  const html = wW82CourtRow(k, C), p = wCourtWho(k), g = p && typeof k === 'number' ? wGearOf(p, 'court') : null;
  return g ? html.replace('<small class="wnst">', `<small class="wnst" title="${esc(g.desc)}">Wears the <b>${esc(g.name)}</b>.</small><small class="wnst">`) : html;
};
const wW82OpenCourtCard = wOpenCourtCard;
wOpenCourtCard = function () {
  wW82OpenCourtCard();
  const ul = document.querySelector('#modalBox .wbclubs'); if (!ul) return;
  ul.insertAdjacentHTML('afterend', `<p class="hint">What their benches bring: ${[1, 2, 3].map(t => `tier ${t}, ${esc(wCourtBagWords(W_COURT_KIT.opp[t]))}`).join('; ')}. Yours is your bag: give from it at a stoppage, in the Bag under the court.</p>`);
};

const wW82RenderHelp = renderHelp;
renderHelp = function () {
  wW82RenderHelp();
  const after = $('wHelpCourtPow'); if (!after || $('wHelpCourtKit')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpCourtKit"><b>Basketball gear and potions.</b> Each player can wear one piece for the court: Court Shoes, Wrist Bands and Lucky Socks from the Graftonbury store, Knee Pads and Ankle Braces from chests. Put it on from the Bag on the Team screen. In a real game, at a stoppage (a dead ball, a break, a timeout or free throws), give one potion from the Bag under the court: a Stamina Draught, Second Wind (at a timeout, the whole five), Steady Drops (no nerves at the line for the half: in the last minute of a close game, free throws are harder) or the Hot Hand Elixir (start a player on fire). Your bench says which suits the moment. The other side's bench brings potions by tier and uses them; every use is in the line under the court.</p>`);
};
