/* w93: hockey gear and potions (issue #83, phase 8), by #61's conventions; the engine's side is
   src/hk/parts/15-kit.js, the plumbing (W_GEAR, W_POTIONS, the slot, the Bag) is w72.
   Gear (W_RINK_GEAR, one piece a player, p.gear.rink): Skates, an Ash Stick and a Lucky Puck from the Rimewatch store;
   Gloves, Shin Pads and a Mask from chests; the Pond Kettle (phase 10) adds a piece you don't have yet. Small effects
   (measured in phase 11's lab). It reaches the engine through wRinkPlayer, never by changing the player's own
   ratings, and shows on the stats card's Gear block and the Rink tab.
   Potions: the Stamina Draught (football's item, serving the rink too: the general stores sell it), and Antifreeze,
   Hot Cider and Tove's Liniment from the Rimewatch store. In a real game, at a whistle or a break, from the Bag under
   the rink (one a whistle), with your bench's advice; each comes out of your bag when given. Your coaches never open
   your bag (Watch and Auto powers don't), and Simulate leaves it alone. The other side's bench brings
   W_RINK_KIT.opp[tier] and gives at its skill; every use is in the line under the rink with its reason, and the game
   card says what each club brings.
   Wraps: wGearLive (wW93GearLive: the rink), wRinkPlayer (wW93RinkPlayer: gear's ratings and the piece), wStartRink
   (wW93StartRink: their bag goes in), wRinkCalls (wW93RinkCalls: the Bag block), wSixRow (wW93SixRow: the gear on the
   Rink tab), wOpenRinkCard (wW93OpenRinkCard: the bags on the card), renderHelp (wW93RenderHelp: #wHelpRinkKit); and
   wHK.start and wHK.simGame (the bags go in). */

W_GEAR_CFG.sports.rink = 'hockey';
W_GEAR_STATN.rink = { spd: 'speed', siz: 'size', hnd: 'hands', sht: 'shot', def: 'defense', ref: 'reflexes' };
const W_RINK_GEAR = {
  hk_skates: { sport: 'rink', name: 'Sharp Skates', price: 60, desc: 'A fresh edge: they get going an eighth quicker.', fx: { accel: 1.12 } },
  hk_stick: { sport: 'rink', name: 'Ash Stick', price: 55, desc: 'A stiffer stick: their shots are a little harder to stop.', fx: { shot: .012 } },
  hk_gloves: { sport: 'rink', name: 'Soft Gloves', price: 50, desc: 'A better feel for the puck: it is harder to poke off them.', fx: { guard: -.03 } },
  hk_pads: { sport: 'rink', name: 'Shin Pads', price: 45, desc: 'A blocked shot hurts much less: it costs them a third of the stamina.', fx: { blkSta: .33 } },
  hk_mask: { sport: 'rink', name: 'Bone Mask', price: 60, desc: 'In goal only: they see it all the way, and stop a little more.', fx: { save: .012 } },
  hk_puck: { sport: 'rink', name: 'Lucky Puck', price: 40, desc: 'Kept in a pocket: they win more face-offs.', fx: { fo: .08 } },
};
for (const id of Object.keys(W_RINK_GEAR)) wGearAdd(id, W_RINK_GEAR[id]);
const W_RINK_KIT = {
  potions: { hkanti: 35, hkcider: 40, hkliniment: 45 }, // prices (the Stamina Draught's is football's: one item, every sport)
  store: ['hk_skates', 'hk_stick', 'hk_puck'], // Rimewatch's gear (its store is the rime shop)
  cup: ['hk_mask', 'hk_pads', 'hk_gloves', 'hk_skates', 'hk_stick', 'hk_puck'], cupGold: 60,
  opp: { 1: { draught: 1 }, 2: { draught: 1, hkanti: 1 }, 3: { draught: 2, hkanti: 1, hkcider: 1, hkliniment: 1 } },
};
for (const id of Object.keys(wHK.potions)) {
  const P = wHK.potions[id];
  // (the Stamina Draught is football's item, and serves the rink too)
  if (id === 'draught') {
    W_POTIONS[id].sports = (W_POTIONS[id].sports || ['grid']).concat('rink');
    DB.items[id].desc += ` On the ice: ${P.desc.charAt(0).toLowerCase()}${P.desc.slice(1)}`;
    DB.items[id].use += ' Or in a hockey game, at a whistle, one a whistle.';
    continue;
  }
  wPotionAdd(id, { sport: 'rink' });
  DB.items[id] = { name: P.n, desc: P.desc, use: 'In a hockey game, at a whistle or a break: the Bag under the rink. One potion a whistle.', price: W_RINK_KIT.potions[id] };
}
if (DB.shops.rime) { for (const id of Object.keys(W_RINK_KIT.potions)) DB.shops.rime[id] = W_RINK_KIT.potions[id]; for (const id of W_RINK_KIT.store) DB.shops.rime[id] = W_RINK_GEAR[id].price; }
for (const [c, it] of [['chapel_chest', 'hk_gloves'], ['genevault_c6', 'hk_pads'], ['emberdeep_c3', 'hk_mask'], ['hatchery_c6', 'hkliniment'], ['deepseam_c3', 'hkcider']]) {
  const C = DB.chests[c]; if (C) { C.items = C.items || {}; C.items[it] = (C.items[it] || 0) + 1; }
}
const wW93GearLive = wGearLive;
wGearLive = function (sport) { return sport === 'rink' ? wRinkLive() : wW93GearLive(sport); };
// a roster player's rink gear: its ratings (past the cap by W_GEAR_CFG.over at most) and the piece
const wW93RinkPlayer = wRinkPlayer;
wRinkPlayer = function (p) {
  const t = wW93RinkPlayer(p), G = p && p.id != null && wPlayer(p.id) === p ? wGearOf(p, 'rink') : null;
  if (G) { t.r = wGearRate(t.r, G, W_HKR.cap); t.gear = wGearTag(G); }
  return t;
};

/* ---------- the bags go in ---------- */
const WHKK = { next: null };
const wRinkBagMine = () => Object.fromEntries(wMatchBag('rink').filter(x => wHK.potions[x.id]).map(x => [x.id, x.n]));
const wRinkBagTheirs = tier => Object.assign({}, W_RINK_KIT.opp[tier] || {});
const wRinkBagWords = bag => { const ks = Object.keys(bag).filter(id => bag[id] > 0 && wHK.potions[id]); return ks.length ? ks.map(id => `${bag[id]} ${wHK.potions[id].n}`).join(', ') : 'nothing'; };
const wW93StartRink = wStartRink;
wStartRink = function (o) {
  WHKK.next = [null, wRinkBagTheirs((o && o.tier) || (o && o.club ? wBallTier(o.club) : 1))];
  try { return wW93StartRink(o); } finally { WHKK.next = null; }
};
// (only the game wStartRink starts: a scrimmage, a practice or a cup game between clubs brings none)
const wW93Start = wHK.start, wW93SimGame = wHK.simGame;
wHK.start = o => wW93Start(WHKK.next ? Object.assign({}, o, { bags: WHKK.next }) : o);
wHK.simGame = o => wW93SimGame(WHKK.next && !(o && o.keep) ? Object.assign({}, o, { bags: WHKK.next }) : o);

/* ---------- your Bag, in a real game ---------- */
function wRinkPotion(id, ri) {
  if (!wRinkWorld()) return 'Potions are for real games, not practice.';
  if (!wHas(id)) return `You have no ${(wHK.potions[id] || {}).n || 'such potion'}.`;
  const r = wHK.potion(id, ri); if (r) return r;
  // (the save point is the game as it is now, with the potion given: a reload can't lose it, or give it back)
  wAddItem(id, -1); if (WG.hkg && WG.hkg.live) WG.hkg.live.snap = wHK.snapshot(); wSave(); return '';
}
let W_RINK_KITKEY = '', W_RINK_KITMSG = '';
const wW93RinkCalls = wRinkCalls;
wRinkCalls = function (force) {
  wW93RinkCalls(force);
  const box = $('wRinkCalls'); if (box.hidden || !box.querySelector('.wccrows')) { W_RINK_KITKEY = ''; return; }
  if (!wRinkWorld()) { const k = box.querySelector('.wcckit'); if (k) k.remove(); return; }
  if (!box.querySelector('.wcckit')) box.insertAdjacentHTML('beforeend', '<div class="wcckit"></div>');
  const bag = wRinkBagMine(), G = wHK.G, you = wHK.you, ph = wHK.phase;
  const key = `${ph}|${JSON.stringify(bag)}|${G.sta[you].map(v => Math.round(v * 20)).join()}|${G.box.length}|${W_RINK_KITMSG}|${wHK.pots.length}`;
  if (!force && key === W_RINK_KITKEY) return;
  if (!force && box.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
  W_RINK_KITKEY = key;
  const ids = Object.keys(bag), R = G.teams[you].roster, adv = wHK.advice(bag), gk = G.on[you][wHK.pos.indexOf('G')];
  const who = id => { const P = wHK.potions[id]; if (!P.one) return ''; const list = R.map((_, i) => i).filter(i => id !== 'hkcider' || i !== gk);
    return `<select data-hkwho="${id}" aria-label="Who gets the ${esc(P.n)}">${list.map(ri => `<option value="${ri}"${adv && adv.id === id && adv.ri === ri ? ' selected' : ''}>${esc(R[ri].n)} (${Math.round(G.sta[you][ri] * 100)}%)</option>`).join('')}</select>`; };
  box.querySelector('.wcckit').innerHTML = `<div class="wccrow"><span class="wccl">Bag</span>${ids.length ? ids.map(id => { const P = wHK.potions[id], why = wHK.potionWhy(id, P.one ? (adv && adv.id === id ? adv.ri : G.on[you][0]) : -1);
      return `<span class="wcpot">${who(id)}<button class="ghost${adv && adv.id === id ? ' on' : ''}" data-hkuse="${id}" title="${esc(P.desc + (why && !/Pick|fresh/.test(why) ? ` Not now: ${why}` : ''))}">${esc(P.n)} (${bag[id]})</button></span>`; }).join('') : '<small class="hint">No hockey potions in your bag. The Rimewatch store sells them.</small>'}</div>
    ${W_RINK_KITMSG ? `<p class="wbad wcmsg" role="alert">${esc(W_RINK_KITMSG)}</p>` : ''}${adv ? `<p class="hint">Your bench says: <b>${esc(wHK.potions[adv.id].n)}</b>${adv.ri >= 0 ? ` for ${esc(R[adv.ri].n)}` : ''}, ${esc(adv.why)}.</p>` : ''}`;
};
$('wRinkCalls').addEventListener('click', e => {
  const b = e.target.closest('[data-hkuse]'); if (!b) return;
  const id = b.dataset.hkuse, sel = document.querySelector(`[data-hkwho="${id}"]`);
  W_RINK_KITMSG = wRinkPotion(id, sel ? +sel.value : -1); wRinkCalls(true);
});

/* ---------- the Rink tab and the card ---------- */
const wW93SixRow = wSixRow;
wSixRow = function (k, C) {
  const html = wW93SixRow(k, C), p = wSixWho(k), g = p && typeof k === 'number' ? wGearOf(p, 'rink') : null;
  return g ? html.replace('<small class="wnst">', `<small class="wnst" title="${esc(g.desc)}">Wears the <b>${esc(g.name)}</b>.</small><small class="wnst">`) : html;
};
const wW93OpenRinkCard = wOpenRinkCard;
wOpenRinkCard = function () {
  wW93OpenRinkCard();
  const ul = document.querySelector('#modalBox .wbclubs'); if (!ul) return;
  ul.insertAdjacentHTML('afterend', `<p class="hint">What their benches bring: ${[1, 2, 3].map(t => `tier ${t}, ${esc(wRinkBagWords(W_RINK_KIT.opp[t]))}`).join('; ')}. Yours is your bag: give from it at a whistle, in the Bag under the rink.</p>`);
};

const wW93RenderHelp = renderHelp;
renderHelp = function () {
  wW93RenderHelp();
  const after = $('wHelpRinkGame'); if (!after || $('wHelpRinkKit')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpRinkKit"><b>Hockey gear and potions.</b> Each player can wear one piece for the rink: Sharp Skates, an Ash Stick and a Lucky Puck from the Rimewatch store; Soft Gloves, Shin Pads and a Bone Mask (for your goalie) from chests. Put it on from the Bag on the Team screen. In a real game, at a whistle or a break, give one potion from the Bag under the rink: a Stamina Draught (one skater), Antifreeze (your skaters tire slower for the rest of the period), Hot Cider (one player's shots are harder to stop for the rest of the period) or Tove's Liniment (your earliest penalty ends). Your bench says which suits the moment. The other side's bench brings potions by tier and uses them; every use is in the line under the rink. Blocking a shot costs a skater some stamina, less in Shin Pads.</p>`);
};
