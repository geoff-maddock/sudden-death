/* w74: football gear and potions (issue #61, phase 3), end to end. The engine's side is src/gf/parts/17-kit.js; the
   plumbing (W_GEAR, W_POTIONS, slots, the Bag) is w72, and the bench and the first two potions are w48.
   Gear (W_GRID_GEAR, one piece a player): Ash Cleats, a Reinforced Helmet and a Kicking Tee from the Cinderhold store;
   Sticky Gloves and Shoulder Pads from chests; the Cinder Cup adds the first piece you don't have yet. It shows on the
   stats card, the Seven tab and the lineup on the field.
   Potions (one a play, between plays, as w48's): Fumble Resin and the Mending Balm in every general store, the Speed
   Elixir and the Fog Vial in Cinderhold's. You give them from Your bench under the field, in a real game, and your
   sideline says which suits the moment; each comes out of your bag when it is given (as w48's). The coaches never open
   your bag, and Simulate leaves it alone. The other side's sideline brings W_GRID_KIT.opp[tier] and uses it at its
   skill; every use is in the play log with its reason, and the game card says what each club brings.
   Wraps: wStartGrid (wW74StartGrid: their bag goes in), wGridPotion (wW74GridPotion: the new potions), wGridBenchHTML
   (wW74GridBenchHTML: the new potions and the advice on Your bench), wSevenRow (wW74SevenRow: gear on the Seven tab),
   wOpenGridCard (wW74OpenGridCard: the bags on the card), wGcupWon (wW74GcupWon: the Cup's gear), renderHelp
   (wW74RenderHelp: #wHelpGridKit); and wGF.game and wGF.simGame (the bags go in). wGridGearTag is w42's lineup hook. */

const W_GRID_GEAR = {
  gf_cleats: { sport: 'grid', name: 'Ash Cleats', price: 60, desc: 'Spiked for the ash: 1% faster, and they cut a fifth sharper.', fx: { spd: 1.01, turn: 1.2 } },
  gf_helmet: { sport: 'grid', name: 'Reinforced Helmet', price: 55, desc: 'With the ball, they fumble less than half as often.', fx: { fum: .4 } },
  gf_gloves: { sport: 'grid', name: 'Sticky Gloves', price: 65, desc: '7% likelier to hold on to a catch, contested or not.', fx: { catch: .07 } },
  gf_tee: { sport: 'grid', name: 'Kicking Tee', price: 50, desc: 'As the kicker: field goals go as if from 6 yards closer and can be tried from 6 yards further out, and punts go 4 yards longer.', fx: { kick: 6, punt: 4 } },
  gf_pads: { sport: 'grid', name: 'Shoulder Pads', price: 70, desc: 'Every block they are in, on offense or defense, goes as if they were a point stronger.', fx: { blk: 1 } },
};
for (const id of Object.keys(W_GRID_GEAR)) wGearAdd(id, W_GRID_GEAR[id]);
// (a full set of seven of one piece, against no gear, over 80 games under the coaches: cleats +3.5 points a game, pads
// +1.8, the tee +1.5, gloves +1.3, the helmet +1.1 and a quarter of the fumbles; a tier-3 bag +2 points. Cleats at
// 3% faster were +9: speed is worth the most)
const W_GRID_KIT = {
  potions: { gfresin: 30, gfhaste: 35, gffog: 40, gfsalve: 35 }, // prices
  store: ['gf_cleats', 'gf_helmet', 'gf_tee'], // Cinderhold's gear
  cup: ['gf_pads', 'gf_gloves', 'gf_cleats', 'gf_helmet', 'gf_tee'], cupGold: 60,
  opp: { 1: { draught: 1 }, 2: { draught: 1, secondwind: 1, gfresin: 1 }, 3: { draught: 2, secondwind: 1, gfresin: 1, gfhaste: 1, gffog: 1, gfsalve: 1 } },
};
// the new potions: the engine's words, sold where they belong
for (const id of Object.keys(W_GRID_KIT.potions)) {
  const P = wGF.potions[id];
  wPotionAdd(id, { sport: 'grid' });
  DB.items[id] = { name: P.n, desc: P.desc, use: 'In a football game, between plays: Potions, under your lineup. One potion a play.', price: W_GRID_KIT.potions[id] };
}
for (const k in DB.shops) { DB.shops[k].gfresin = W_GRID_KIT.potions.gfresin; DB.shops[k].gfsalve = W_GRID_KIT.potions.gfsalve; }
if (DB.shops.cind) { DB.shops.cind.gfhaste = W_GRID_KIT.potions.gfhaste; DB.shops.cind.gffog = W_GRID_KIT.potions.gffog; for (const id of W_GRID_KIT.store) DB.shops.cind[id] = W_GRID_GEAR[id].price; }
for (const [c, it] of [['hatchery_prize', 'gf_gloves'], ['genevault_prize', 'gf_pads'], ['genevault_c3', 'gffog'], ['deepseam_c3', 'gfresin']]) {
  const C = DB.chests[c]; if (C) { C.items = C.items || {}; C.items[it] = (C.items[it] || 0) + 1; }
}
const wGridKitIds = () => Object.keys(wGF.potions);
const wGridBagMine = () => { const o = {}; if (WG && WG.items) for (const id of wGridKitIds()) if ((WG.items[id] || 0) > 0) o[id] = WG.items[id]; return o; };
const wGridBagTheirs = tier => Object.assign({}, W_GRID_KIT.opp[tier] || {});
const wGridBagWords = bag => { const ks = Object.keys(bag).filter(id => bag[id] > 0 && wGF.potions[id]); return ks.length ? ks.map(id => `${bag[id]} ${wGF.potions[id].n}`).join(', ') : 'nothing'; };

/* ---------- the bags go in ---------- */
const WGK = { next: null };
const wW74StartGrid = wStartGrid;
wStartGrid = function (o) {
  WGK.next = [null, wGridBagTheirs((o && o.tier) || (o && o.club ? wBallTier(o.club) : 1))];
  try { return wW74StartGrid(o); } finally { WGK.next = null; }
};
// (only the game that wStartGrid starts: an exhibition, a practice or a cup game between clubs brings none)
const wW74Game = wGF.game, wW74SimGame = wGF.simGame;
wGF.game = o => wW74Game(WGK.next ? Object.assign({}, o, { bags: WGK.next }) : o);
wGF.simGame = o => wW74SimGame(WGK.next && !(o && o.keep) ? Object.assign({}, o, { bags: WGK.next }) : o);

/* ---------- your potions ---------- */
const wW74GridPotion = wGridPotion;
wGridPotion = function (id, ri) {
  if (!W_GRID_KIT.potions[id]) return wW74GridPotion(id, ri);
  const P = wGF.potions[id], b = wGF.bench();
  if (!P || !b) return '';
  if (!wGridWorld()) return 'Potions are for real games, not practice.';
  if (!wHas(id)) return `You have no ${P.n}.`;
  const why = wGF.potionWhy(id, ri); if (why) return why;
  if (!wGF.potion(id, ri)) return 'That potion can\'t be given now.';
  wAddItem(id, -1); wGridResnap(); wGridBar(); return '';
};
// Your bench: the new potions you have, beside w48's two, and what your sideline would give now
const wW74GridBenchHTML = wGridBenchHTML;
wGridBenchHTML = function () {
  const h = wW74GridBenchHTML(), b = wGF.bench(); if (!h || !b) return h;
  const world = wGridWorld(), on = b.on.slice().sort((x, y) => x.stam - y.stam), mine = wGridBagMine();
  const opt = p => `<option value="${p.ri}">${esc(p.n)} (${[p.off, p.def].filter(Boolean).join('/')}), ${p.stam}%</option>`;
  const extra = Object.keys(W_GRID_KIT.potions).filter(id => mine[id] > 0).map(id => {
    const P = wGF.potions[id], can = world && b.between && !b.item;
    return P.one ? `<select data-gpot="${id}" aria-label="Give a ${esc(P.n)} to" title="${esc(P.desc)}"${can ? '' : ' disabled'}><option value="">${esc(P.n)} ×${mine[id]}: give to…</option>${on.map(opt).join('')}</select>`
      : (why => `<button class="ghost" data-gpot="${id}" title="${esc(P.desc + (can && why ? ' ' + why : ''))}"${can && !why ? '' : ' disabled'}>${esc(P.n)} ×${mine[id]}</button>`)(wGF.potionWhy(id, null));
  }).join('');
  const adv = world && b.between && !b.item ? wGF.advice(mine) : null;
  const say = adv ? `<small class="hint" data-gkadv="${adv.id}">Your sideline says: the ${esc(wGF.potions[adv.id].n)} (${esc(adv.why)}).</small>` : '';
  return h.replace('<div class="wgpots"><b>Potions</b>', `<div class="wgpots"><b>Potions</b>${extra}`).replace(/(<div class="wgpots">[\s\S]*?)(<\/div>)/, `$1${say}$2`);
};

/* ---------- gear on screen ---------- */
// the lineup on the field (w42): the piece a player wears
function wGridGearTag(p) { return p && p.gear ? ` <small class="wggear" data-ggear="${esc(p.gid || '')}" title="${esc(((W_GEAR[p.gid] || {}).desc) || '')}">⚙ ${esc(p.gear)}</small>` : ''; }
// the Seven tab: the same
const wW74SevenRow = wSevenRow;
wSevenRow = function (k, out) {
  const h = wW74SevenRow(k, out), p = typeof k === 'number' ? wPlayer(k) : null, G = p && wGearOf(p, 'grid');
  return G ? h.replace('<small class="wnst">', `<small class="wggear" data-sgear="${G.id}" title="${esc(G.desc)}">⚙ ${esc(G.name)}</small> <small class="wnst">`) : h;
};
// the game card: what each club's sideline brings, and your bag
const wW74OpenGridCard = wOpenGridCard;
wOpenGridCard = function () {
  wW74OpenGridCard();
  const box = $('modalBox'); if (!box) return;
  box.querySelectorAll('.wbcl').forEach(li => {
    const b = li.querySelector('[data-gfclub]'); if (!b) return;
    const sm = li.querySelector('small'); if (sm) sm.insertAdjacentHTML('beforeend', ` <span data-gkbags>Their sideline brings ${esc(wGridBagWords(wGridBagTheirs(wBallTier(b.dataset.gfclub))))}.</span>`);
  });
  const ul = box.querySelector('.wbclubs');
  if (ul) ul.insertAdjacentHTML('beforebegin', `<p class="hint" data-gkmine>Your bag for the game: <b>${esc(wGridBagWords(wGridBagMine()))}</b>. Give potions between plays from Your bench (Play and Manage); Simulate leaves the bag alone.</p>`);
};
// the Cinder Cup: the first piece of football gear you don't have yet
const wW74GcupWon = wGcupWon;
wGcupWon = function () {
  wW74GcupWon();
  const have = id => (WG.items[id] || 0) > 0 || wRoster().some(p => p.gear && p.gear.grid === id);
  const id = W_GRID_KIT.cup.find(x => !have(x));
  if (id) { wAddItem(id, 1); wLog(`The Cup comes with gear: the ${W_GRID_GEAR[id].name}. ${W_GRID_GEAR[id].desc}`, 'g'); }
  else { RUN.gold += W_GRID_KIT.cupGold; wLog(`You have every piece of football gear, so the Cup pays ${W_GRID_KIT.cupGold} gold more instead.`, 'g'); }
};

/* ---------- How to play ---------- */
const wW74HelpText = () => {
  const low = s => s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, '');
  const G = Object.values(W_GRID_GEAR).map(g => `<b>${esc(g.name)}</b> (${esc(low(g.desc))})`).join('; ');
  const P = Object.keys(W_GRID_KIT.potions).map(id => `<b>${esc(wGF.potions[id].n)}</b> (${esc(low(wGF.potions[id].desc))})`).join('; ');
  return `<b>Football gear and potions.</b> Each of your players can wear one piece of football gear: ${G}. Cleats, the Helmet and the Tee are sold in Cinderhold; the rest are found, and the Cinder Cup adds a piece you don't have. Beside the Stamina Draught and Second Wind, four more potions, one a play between plays: ${P}. Resin and the Balm are in every general store, the Elixir and the Fog in Cinderhold's. Give them from Your bench under the field; your sideline says which suits the moment. The coaches never open your bag, and Simulate leaves it alone. The other side brings potions too (more at a harder tier) and uses them; the play log says when, and why (⚗). The game card says what each club brings, and gear shows on the Seven tab and in the lineup (⚙).`;
};
W_GRID_HOW.push(() => `<p class="hint">${wW74HelpText()}</p>`);
const wW74RenderHelp = renderHelp;
renderHelp = function () {
  wW74RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpGridKit')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpGridKit">${wW74HelpText()}</p>`);
};
