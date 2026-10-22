/* w9b: towns (phase 4). Meals and cooking, Brother Quill the enchanter, card vendors, and the help text for all of it.
   Loads last; wraps earlier realm functions by reassignment.

   Meals (DB.meals, w1). You cook them at an inn hearth or in Tansy's canteen from foraged and bought ingredients
   (DB.recipes), or buy them from an inn's kitchen (DB.innMenu). Cooked and bought meals go in your pantry (WG.pantry);
   snacks (honey drops, salt fish, jerky, hardtack) are items in your bag. Eat one and it is your meal for the next
   match (WG.meal), applied at kickoff by onHook('fightStart') and then gone. A fortune (WG.charm) stacks with it.
   Eating a second meal puts the first back in the pantry. wOpenMeals(innId?) is the menu; camp can call it too.

   The enchanter (DB.enchanter): Brother Quill spends elemental energy (WG.energy: wells, road events, and wins, see
   w9-road.js) to upgrade a card, add a Practice star, or upgrade a gear card. Any kind of energy pays; he takes from
   what you have most of. Each use of a service raises its price by one, up to a cap (WG.enchUsed). wOpenEnchanter().

   Card vendors (DB.cardShops): three towns sell cards in Sudden Death's shop style and prices (PRICE), with stock that
   leans to the region's sports and kinds and turns over every week (WG.cardShops[id].week). Trading a card away costs
   Sudden Death's removeCost (it rises by 25 each time), once per vendor per week.

   Realm functions wrapped: wRunAct (acts enchant, kitchen, meals, cards), wOpenInn (a Meals button), wPreGame (the
   meal line), wRenderHud (energy and meal), renderHelp (the road and town section). */

/* ---------- meals ---------- */
function wPantry() { return (WG.pantry = WG.pantry || {}); }
/* what you could eat: cooked and bought meals, then snacks in your bag. [{ id, n, snack }] */
function wEdibles() {
  const out = [];
  for (const id in wPantry()) if (WG.pantry[id] > 0 && DB.meals[id]) out.push({ id, n: WG.pantry[id], snack: false });
  for (const id in DB.meals) if (DB.meals[id].snack && (WG.items[id] || 0) > 0) out.push({ id, n: WG.items[id], snack: true });
  return out;
}
function wRecipeKnown(id) { const r = DB.recipes[id]; return !!r && (!r.need || wFlag(r.need)); }
function wCanCook(id) { const r = DB.recipes[id]; return wRecipeKnown(id) && Object.keys(r.needs).every(k => wHas(k, r.needs[k])); }
function wCook(id) {
  const r = DB.recipes[id];
  if (!r || !wRecipeKnown(id)) return 'You do not know that recipe.';
  if (!wCanCook(id)) return 'You are missing ingredients.';
  for (const k in r.needs) wAddItem(k, -r.needs[k]);
  wAdvance(60);
  const e = r.effect;
  if (e.kind === 'meal') { wPantry()[e.meal] = (WG.pantry[e.meal] || 0) + 1; wLog(`You cook ${DB.meals[e.meal].name}. It goes in your pantry.`, 'm'); }
  else if (e.kind === 'item') { wAddItem(e.item, e.n || 1); wLog(`You make ${e.n || 1} ${DB.items[e.item].name}.`, 'm'); }
  wSave();
  return '';
}
function wBuyMeal(inn, id) {
  const pr = (DB.innMenu[inn] || {})[id];
  if (pr == null) return 'Not on the menu here.';
  if (RUN.gold < pr) return 'You cannot afford that.';
  RUN.gold -= pr; wPantry()[id] = (WG.pantry[id] || 0) + 1;
  wLog(`You buy ${DB.meals[id].name} to take away. It goes in your pantry.`, 'm');
  wSave();
  return '';
}
/* eat now: it acts at the next kickoff. A meal you already ate goes back where it came from. */
function wEat(id) {
  const M = DB.meals[id]; if (!M || M.charm) return 'You cannot eat that.';
  if (M.snack ? !wHas(id) : !(wPantry()[id] > 0)) return 'You have none.';
  if (M.snack) wAddItem(id, -1); else { WG.pantry[id]--; if (!WG.pantry[id]) delete WG.pantry[id]; }
  if (WG.meal) { const old = DB.meals[WG.meal]; if (old && old.snack) wAddItem(WG.meal, 1); else if (old) wPantry()[WG.meal] = (WG.pantry[WG.meal] || 0) + 1; }
  WG.meal = id;
  wLog(`You eat ${M.name}. ${M.does}`, 'm');
  wSave();
  return '';
}
function wMealFx(id) {
  const M = DB.meals[id]; if (!M || !B) return;
  const f = M.fx || {};
  if (f.block) B.P.block += f.block;
  for (const k in f.st || {}) addSt(B.P, k, f.st[k]);
  if (f.draw) addSt(B.P, 'drawnext', f.draw);
  if (f.energy) addSt(B.P, 'nrgnext', f.energy);
  if (f.heal) healP(f.heal);
}
/* at kickoff in the realm: the meal and the fortune act once, then they are gone */
onHook('fightStart', () => {
  if (!WG || !RUN || !B || !RUN.pending || !RUN.pending.world) return;
  const ids = [WG.meal, WG.charm].filter(id => id && DB.meals[id]);
  if (!ids.length) return;
  for (const id of ids) { wMealFx(id); log(`Pre-game: ${DB.meals[id].name}. ${DB.meals[id].does}`, 'good'); }
  B.wMeal = ids.slice();
  fx({ k: 'banner', t: DB.meals[ids[0]].name, sub: ids.map(id => DB.meals[id].does).join(' '), small: 1 });
  WG.meal = null; WG.charm = null;
});
function wNeedsText(r) { return Object.keys(r.needs).map(k => `${r.needs[k]} ${DB.items[k].name}`).join(', '); }
/* the meal menu: what you will eat next, your pantry, the inn's kitchen (innId), and the hearth */
function wOpenMeals(inn) {
  const who = inn && DB.chars[inn] ? DB.chars[inn].name : 'The hearth';
  modal(`<header><h3>${inn ? esc(who) + ': meals' : 'Cooking'}</h3><button class="ghost" data-close>Done</button></header><div id="wMealBody"></div>`);
  const render = msg => {
    const body = $('wMealBody'); if (!body) return;
    const now = [WG.meal, WG.charm].filter(Boolean);
    let h = `<p class="hint">A meal helps in your next match only. You have <b class="wgold">${RUN.gold} gold</b>.${msg ? ' <span class="wbad">' + esc(msg) + '</span>' : ''}</p>`;
    h += `<h4>Next match</h4><p class="wmealnow">${now.length ? now.map(id => `<b>${esc(DB.meals[id].name)}</b>: ${esc(DB.meals[id].does)}`).join('<br>') : 'Nothing eaten yet.'}</p>`;
    const ed = wEdibles();
    h += `<table class="wshop"><tbody><tr class="wsellh"><td colspan="4"><h4>Your pantry</h4></td></tr>`;
    h += ed.length ? ed.map(e => `<tr><td><b>${esc(DB.meals[e.id].name)}</b><small>${esc(DB.meals[e.id].does)}</small></td><td class="wnum dim">have ${e.n}</td><td></td><td><button class="ghost" data-weat="${e.id}">Eat</button></td></tr>`).join('') : '<tr><td colspan="4" class="dim">Empty. Cook something, or buy it.</td></tr>';
    if (inn && DB.innMenu[inn]) {
      h += `<tr class="wsellh"><td colspan="4"><h4>The kitchen</h4></td></tr>`;
      for (const id in DB.innMenu[inn]) { const pr = DB.innMenu[inn][id]; h += `<tr><td><b>${esc(DB.meals[id].name)}</b><small>${esc(DB.meals[id].does)}</small></td><td class="wnum">${pr}g</td><td></td><td><button class="ghost" data-wbuym="${id}" ${RUN.gold < pr ? 'disabled' : ''}>Buy</button></td></tr>`; }
    }
    h += `<tr class="wsellh"><td colspan="4"><h4>Cook at the hearth</h4><small class="dim">An hour each. Ingredients come from bushes and shops.</small></td></tr>`;
    for (const id in DB.recipes) {
      if (!wRecipeKnown(id)) continue;
      const r = DB.recipes[id], M = r.effect.kind === 'meal' ? DB.meals[r.effect.meal] : null;
      h += `<tr><td><b>${esc(r.name)}</b><small>${esc(M ? M.does : r.desc || '')}</small></td><td class="wneeds" colspan="2">${Object.keys(r.needs).map(k => `<span class="${wHas(k, r.needs[k]) ? '' : 'wbad'}">${r.needs[k]} ${esc(DB.items[k].name)} <i>(${WG.items[k] || 0})</i></span>`).join('')}</td><td><button class="ghost" data-wcook="${id}" ${wCanCook(id) ? '' : 'disabled'}>Cook</button></td></tr>`;
    }
    h += '</tbody></table>';
    body.innerHTML = h;
    body.querySelectorAll('[data-weat]').forEach(b => b.onclick = () => { render(wEat(b.dataset.weat)); wDrain(); });
    body.querySelectorAll('[data-wbuym]').forEach(b => b.onclick = () => { render(wBuyMeal(inn, b.dataset.wbuym)); wDrain(); });
    body.querySelectorAll('[data-wcook]').forEach(b => b.onclick = () => { render(wCook(b.dataset.wcook)); wDrain(); });
  };
  render('');
}
/* the pre-game card: what you have eaten, or a quick bite from the pantry */
const wW9PreGame = wPreGame;
wPreGame = function (enc) {
  wW9PreGame(enc);
  const box = document.querySelector('#modalBox .wpgtxt'); if (!box) return;
  const draw = () => {
    const old = $('wPgMeal'); if (old) old.remove();
    const now = [WG.meal, WG.charm].filter(Boolean), ed = wEdibles().slice(0, 4);
    let h = `<div id="wPgMeal" class="wpgmeal">`;
    h += now.length ? `<p>Pre-game: ${now.map(id => `<b>${esc(DB.meals[id].name)}</b> (${esc(DB.meals[id].does)})`).join(', ')}</p>` : `<p class="hint">Nothing eaten.${ed.length ? ' A bite first?' : ''}</p>`;
    if (!WG.meal && ed.length) h += `<div class="row">${ed.map(e => `<button class="ghost" data-wpge="${e.id}" title="${esc(DB.meals[e.id].does)}">Eat ${esc(DB.meals[e.id].name)}</button>`).join('')}</div>`;
    h += '</div>';
    const hint = [...box.querySelectorAll('p.hint')].pop();
    if (hint) hint.insertAdjacentHTML('beforebegin', h); else box.insertAdjacentHTML('beforeend', h);
    box.querySelectorAll('[data-wpge]').forEach(b => b.onclick = () => { wEat(b.dataset.wpge); draw(); });
  };
  draw();
};

/* ---------- the enchanter ---------- */
function wEnergyTotal() { return Object.values(WG.energy || {}).reduce((a, b) => a + (b || 0), 0); }
function wEnchCost(k) { const S = DB.enchanter[k], used = (WG.enchUsed || {})[k] || 0; return Math.min(S.max, S.base + S.step * used); }
/* spend n energy, most plentiful kind first; returns what was spent, e.g. "2 Ember, 1 Tide", or null if short */
function wSpendEnergy(n) {
  if (wEnergyTotal() < n) return null;
  const spent = {};
  while (n > 0) { const el = Object.keys(WG.energy).sort((a, b) => WG.energy[b] - WG.energy[a])[0]; WG.energy[el]--; spent[el] = (spent[el] || 0) + 1; n--; }
  return Object.keys(spent).map(e => spent[e] + ' ' + DB.elems.names[e]).join(', ');
}
function wEnchList(k) {
  if (k === 'star') return RUN.deck.filter(practicable);
  if (k === 'gear') return RUN.deck.filter(c => upgradable(c) && CARDS[c.id].type === 'gear');
  return RUN.deck.filter(c => upgradable(c) && CARDS[c.id].type !== 'gear');
}
/* do a service on a card (tests call this directly; the menu calls it after a pick) */
function wEnchant(k, card) {
  const S = DB.enchanter[k]; if (!S || !card) return 'Nothing to enchant.';
  if (!wEnchList(k).includes(card)) return 'That card cannot take it.';
  const cost = wEnchCost(k), paid = wSpendEnergy(cost);
  if (!paid) return `You need ${cost} energy.`;
  if (k === 'star') { card.sk = 1; achAdd('practice', 1); } else card.up = true;
  WG.enchUsed = WG.enchUsed || {}; WG.enchUsed[k] = (WG.enchUsed[k] || 0) + 1;
  wAdvance(45);
  wLog(`Brother Quill ${k === 'star' ? 'drills' : k === 'gear' ? 'recharges' : 'binds energy into'} ${wCardName(card.id, card.up)}${k === 'star' ? ' (★)' : ''}. (${paid} energy)`, 'm');
  wSave();
  return '';
}
function wOpenEnchanter(msg) {
  const ch = DB.chars.quill, en = WG.energy || {};
  const close = modal(`<header><div class="row"><img class="wmport" src="${portraitURL(ch.kind, wNpcTeam(ch.kind), '', 96)}" alt=""><h3>${esc(ch.name)}, enchanter</h3></div><button class="ghost" data-close>Done</button></header>
    <p class="hint">Energy comes from wells, from the road, and from every win in a region. Any kind pays: Quill takes from what you have most of. Each service costs one more every time you use it.${msg ? ' <span class="wbad">' + esc(msg) + '</span>' : ''}</p>
    <div class="wenergy">${DB.elems.order.map(e => `<span class="wen-${e}"><b>${en[e] || 0}</b> ${DB.elems.names[e]}</span>`).join('')}<span class="wentot">${wEnergyTotal()} in all</span></div>
    <table class="wshop"><tbody>${Object.keys(DB.enchanter).map(k => { const S = DB.enchanter[k], c = wEnchCost(k), n = wEnchList(k).length; return `<tr><td><b>${esc(S.name)}</b><small>${esc(S.does)}${n ? '' : ' (no card in your deck can take it)'}</small></td><td class="wnum">${c} energy</td><td><button class="ghost" data-wench="${k}" ${wEnergyTotal() < c || !n ? 'disabled' : ''}>Choose</button></td></tr>`; }).join('')}</tbody></table>`);
  $('modalBox').querySelectorAll('[data-wench]').forEach(b => b.onclick = () => {
    const k = b.dataset.wench, S = DB.enchanter[k];
    close();
    wPickCard(wEnchList(k), S.name, `${S.does} Costs ${wEnchCost(k)} energy.`, card => { const r = card ? wEnchant(k, card) : ''; wDrain(); wOpenEnchanter(r); });
  });
}

/* ---------- card vendors ---------- */
function wMakeStock(id) {
  const S = DB.cardShops[id], Rg = DB.regions[S.region], sports = Rg.sports.map(s => s[0]), kinds = runKinds();
  const all = Object.values(CARDS).filter(c => ['c', 'u', 'r'].includes(c.rar) && !['junk', 'curse', 'status'].includes(c.type) && (c.kind === 'any' || kinds.includes(c.kind)));
  // slots 1-3: cards made for the region's sports; slot 4: cards that suit them or a native kind; slot 5: any rare
  const home = all.filter(c => sports.includes(c.sport));
  const fit = all.filter(c => sports.includes(c.sport) || Rg.kinds.includes(c.kind) || sportFits(c).slice(0, 2).some(s => sports.includes(s)));
  const cards = [], free = c => !cards.some(o => o.id === c.id);
  for (let i = 0; i < 5; i++) {
    const rar = i === 4 ? 'r' : wpick({ c: 6, u: 3, r: 1 });
    let pool = (i < 3 ? home : i < 4 ? fit : all).filter(c => c.rar === rar && free(c));
    if (!pool.length) pool = (i < 3 ? home : fit).filter(free);
    if (!pool.length) pool = all.filter(c => c.rar === rar && free(c));
    if (!pool.length) continue;
    const c = pick(pool);
    cards.push({ id: c.id, price: Math.round(PRICE[c.rar] * (.9 + R() * .2)), sold: false });
  }
  return { week: wWeek(), cards, removed: false };
}
function wShopStock(id) {
  WG.cardShops = WG.cardShops || {};
  const st = WG.cardShops[id];
  if (!st || st.week !== wWeek()) { WG.cardShops[id] = wMakeStock(id); wSave(); }
  return WG.cardShops[id];
}
function wBuyCard(id, i) {
  const st = wShopStock(id), w = st.cards[i];
  if (!w || w.sold) return 'Sold out.';
  if (RUN.gold < w.price) return 'You cannot afford that.';
  RUN.gold -= w.price; w.sold = true;
  RUN.deck.push(mkCard(w.id)); RUN.stats.cards = (RUN.stats.cards || 0) + 1; assignOwners();
  wLog(`You buy ${wCardName(w.id)} for ${w.price} gold.`, 'm');
  wSave();
  return '';
}
/* trade a card away: Sudden Death's removeCost, once per vendor per week */
function wRemoveCard(id, card) {
  const st = wShopStock(id);
  if (st.removed) return 'One trade a week.';
  if (RUN.gold < RUN.removeCost) return 'You cannot afford that.';
  const i = RUN.deck.indexOf(card); if (i < 0) return 'Not in your deck.';
  RUN.deck.splice(i, 1); RUN.gold -= RUN.removeCost; RUN.removeCost += 25; st.removed = true;
  wLog(`You trade away ${wCardName(card.id, card.up)}.`, 'd');
  wSave();
  return '';
}
function wOpenCardShop(id, msg) {
  const S = DB.cardShops[id], ch = DB.chars[id], st = wShopStock(id), Rg = DB.regions[S.region];
  const days = 7 - ((WG.dayAbs - 1) % 7), ok = p => RUN.gold >= p;
  const close = modal(`<header><div class="row"><img class="wmport" src="${portraitURL(ch.kind, wNpcTeam(ch.kind), '', 96)}" alt=""><h3>${esc(S.name)}</h3></div><button class="ghost" data-close>Done</button></header>
    <p class="hint">${esc(Rg.name)} stock: cards for ${esc(Rg.sports.map(s => SPORT_NAME[s[0]].toLowerCase()).join(' and '))}, and the kinds that play here. New stock in ${days} day${days === 1 ? '' : 's'}. You have <b class="wgold">${RUN.gold} gold</b>.${msg ? ' <span class="wbad">' + esc(msg) + '</span>' : ''}</p>
    <div class="shopgrid"><div class="cardrow">${st.cards.map((w, i) => `<div class="ware${w.sold ? ' sold' : ''}">${cardHTML({ uid: 'ws' + i, id: w.id }, { attrs: `data-wbuyc="${i}"`, flav: false })}<div class="price${ok(w.price) ? '' : ' no'}">${w.sold ? 'Sold' : w.price + ' gold'}</div></div>`).join('')}</div>
    <div class="items"><button class="item${st.removed ? ' sold' : ''}" id="wRemove" ${st.removed ? 'disabled' : ''}>${svgI('<path d="M6 6l12 12M18 6L6 18" stroke="#e0533a" stroke-width="3"/>')}<span><b>Trade a card away</b></span><small>Remove one card from your deck. Once a week here.</small><span class="price${ok(RUN.removeCost) ? '' : ' no'}">${RUN.removeCost} gold</span></button></div></div>`);
  $('modalBox').querySelectorAll('[data-wbuyc]').forEach(el => el.onclick = () => { const r = wBuyCard(id, +el.dataset.wbuyc); if (!r && typeof sfx !== 'undefined') sfx.coin(); close(); wDrain(); wOpenCardShop(id, r); });
  $('wRemove').onclick = () => {
    if (st.removed || !ok(RUN.removeCost)) { close(); wOpenCardShop(id, st.removed ? 'One trade a week.' : 'You cannot afford that.'); return; }
    close();
    wPickCard(RUN.deck.slice(), 'Trade a card away', `It leaves your deck for good. ${RUN.removeCost} gold.`, card => { const r = card ? wRemoveCard(id, card) : ''; wDrain(); wOpenCardShop(id, r); });
  };
}

/* ---------- talk acts, the inn, the HUD ---------- */
const wW9RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'enchant') return LAB ? null : wOpenEnchanter();
  if (act === 'kitchen') return LAB ? null : wOpenMeals(null);
  if (act === 'meals') return LAB ? null : wOpenMeals(id);
  if (act === 'cards' && DB.cardShops[id]) return LAB ? null : wOpenCardShop(id);
  return wW9RunAct(act, id);
};
const wW7OpenInn = wOpenInn;
wOpenInn = function (price, who) {
  wW7OpenInn(price, who);
  const inn = WUI.talk && DB.innMenu[WUI.talk.id] ? WUI.talk.id : null, row = $('wSleep') && $('wSleep').parentNode;
  if (!row) return;
  row.insertAdjacentHTML('beforeend', '<button class="ghost" id="wInnMeals">Meals and the hearth</button>');
  $('wInnMeals').onclick = () => wOpenMeals(inn);
};
const wW9RenderHud = wRenderHud;
wRenderHud = function () {
  const k0 = WUI.hudKey;
  wW9RenderHud();
  if (!WUI.built || !WG) return;
  const key = [wEnergyTotal(), WG.meal || '', WG.charm || ''].join('|');
  if (k0 === WUI.hudKey && $('wHudEn') && $('wHudEn').dataset.k === key) return;
  const old = $('wHudEn'); if (old) old.remove();
  const en = WG.energy || {}, meal = [WG.meal, WG.charm].filter(Boolean).map(id => DB.meals[id].name).join(', ');
  const party = document.querySelector('#wHud .wparty');
  const html = `<div class="stat wen" id="wHudEn" data-k="${esc(key)}" title="Energy for the enchanter: ${esc(DB.elems.order.map(e => (en[e] || 0) + ' ' + DB.elems.names[e]).join(', '))}${meal ? '. Next match: ' + esc(meal) : ''}"><small>Energy${meal ? ' &middot; fed' : ''}</small><b>${wEnergyTotal()}</b></div>`;
  if (party) party.insertAdjacentHTML('beforebegin', html); else $('wHud').insertAdjacentHTML('beforeend', html);
};

/* ---------- the audit: phase 4 data refers to real meals, items, cards and people ---------- */
const wW2Audit = wAudit;
wAudit = function () {
  const P = wW2Audit(), chk = (c, m) => { if (!c) P.push(m); };
  for (const id in DB.meals) { const M = DB.meals[id]; chk(M.name && M.does && M.fx, 'meal ' + id + ' needs name, does and fx'); if (M.snack) chk(DB.items[id], 'snack ' + id + ' is not an item'); for (const k in M.fx.st || {}) chk(ST[k], 'meal ' + id + ' gives unknown status ' + k); }
  for (const r in DB.recipes) { const e = DB.recipes[r].effect; if (e.kind === 'meal') chk(DB.meals[e.meal], 'recipe ' + r + ' makes unknown meal ' + e.meal); }
  for (const inn in DB.innMenu) { chk(DB.chars[inn] && DB.chars[inn].inn, 'inn menu ' + inn + ' is not an innkeeper'); for (const id in DB.innMenu[inn]) chk(DB.meals[id] && !DB.meals[id].snack && !DB.meals[id].charm, 'inn ' + inn + ' sells unknown meal ' + id); }
  for (const id in DB.cardShops) { chk(DB.chars[id] && DB.chars[id].topics.cards, 'card shop ' + id + ' has no CARDS topic'); chk(DB.regions[DB.cardShops[id].region], 'card shop ' + id + ' bad region'); }
  for (const ev of DB.events) for (const c of [ev.auto || {}].concat(ev.choices || [])) {
    for (const k of ['snack', 'charm']) if (c[k]) chk(DB.meals[c[k]], 'event ' + ev.id + ' ' + k + ' ' + c[k] + ' is not a meal');
    for (const k in c.energy || {}) chk(k === 'here' || DB.elems.names[k], 'event ' + ev.id + ' unknown energy ' + k);
    for (const id of [].concat(c.card || [], c.cards || [])) chk(CARDS[id], 'event ' + ev.id + ' pays unknown card ' + id);
  }
  for (const c in DB.chests) for (const id of [].concat(DB.chests[c].card || [], DB.chests[c].cards || [], (DB.chests[c].cardChoice || {}).pool || [])) chk(CARDS[id], 'chest ' + c + ' pays unknown card ' + id);
  for (const ch in DB.chars) for (const k in DB.chars[ch].topics || {}) { const t = DB.chars[ch].topics[k]; for (const id of [].concat(t.card || [], t.cards || [], (t.cardChoice || {}).pool || [])) chk(CARDS[id], ch + '.' + k + ' pays unknown card ' + id); }
  return P;
};

/* ---------- How to play ---------- */
const wW9RenderHelp = renderHelp;
renderHelp = function () {
  wW9RenderHelp();
  const sec = $('wHelp'); if (!sec || $('wHelp4')) return;
  sec.insertAdjacentHTML('beforeend', `<div id="wHelp4">
    <p class="hint"><b>How hard a game is.</b> The Charter Plains are tier 1, the four outer regions tier 2, and the deepest vaults tier 3. Inside a tier, the level (0 to 4) goes up the further you are from Graftonbury, with every two cups you win, and at night off the road. Each level gives the other team 8% more HP, and from level 2 some Strength. The pre-game card shows the level and why. At night off the road, a wild team may <b>ambush</b> you: they start a score ahead.</p>
    <p class="hint"><b>Road events.</b> Now and then you meet somebody on the road: a pedlar, a cook, an old coach, a rival club. The card says what each choice costs and what it does. Some lead to a match, and a lost match is a blackout like any other.</p>
    <p class="hint"><b>Meals.</b> Cook at any inn hearth (or in Tansy's canteen) from ingredients you pick off bushes or buy, or buy a meal from an inn's kitchen. Meals wait in your pantry. Eat one before a match (from an inn's MEAL menu, or on the pre-game card) and it helps in that match only: Block, Strength, Footwork, extra cards or Stamina on the first turn, or a little HP.</p>
    <p class="hint"><b>Energy and the enchanter.</b> Wells, some road events and every win give elemental energy (wins give the region's kind). Brother Quill, in Graftonbury's chapel, spends it: upgrade a card, drill a card (Practice ★), or recharge a gear card. Any kind of energy pays, and each service costs a little more every time.</p>
    <p class="hint"><b>Card shops.</b> Odd Lots in Graftonbury, Hob Tarn's nets in Saltmere and the Brandt smithy in Cinderhold sell cards for their region's sports, with new stock every week. They will also take a card off your hands, for a fee.</p></div>`);
};
