/* w135: bond and treats (issue #104, phase 5). Loads after w134-petshop.js; changes earlier parts only by reassignment
   (saved originals carry the wW135 prefix).

   Bond (1 to 3) is how well a pet and your team know each other, and the card battle reads it (B.pet.bond: each level
   strengthens the trait and opens or lifts a power, engine/pets.js). It grows from bond points (q.xp):
     a card match won with the pet at your side   W_PBOND.win
     a treat, once a day for each pet             its favourite W_PBOND.fav, a pet biscuit W_PBOND.treat
   and rises at W_PBOND.at points. It never goes down, and a hungry pet's doesn't grow (until fed).
   Treats: every pet has its favourite (W_PBOND.fav_of: something you can forage, cook with or buy), and every pet
   eats pet biscuits (sold at the pet shops). Any treat feeds a hungry pet, whenever it is given; one that would do
   nothing (not hungry, and treated today or at bond 3) isn't given, nor one to the pet at your side mid-match.
   The Pets tab shows each pet's bond points, its favourite, and Give a treat.

   W_PBOND, wPetBondXp, wPetTreat, wPetTreatsFor
   Wrapped: wPetCard (wW135PetCard: bond points, favourite, the treat button), wRenderCamp (wW135RenderCamp: the button),
   wPshopOpen (wW135PshopOpen: pet biscuits for sale), wAudit (wW135Audit: favourites are real items), renderHelp
   (wW135RenderHelp: #wHelpPetBond). The card match's win is the fightWon hook. */

const W_PBOND = {
  at: [0, 0, 6, 16], win: 1, fav: 3, treat: 1, biscuit: 8,
  fav_of: { blinkpup: 'jerky', pseudodragon: 'honeydrop', axebeak: 'grain', hootling: 'mossberry', sprite: 'aethercap', bogfrog: 'brinekelp', chestnut: 'hardtack', jellycube: 'ration', hippogriff: 'saltfish', glowbeetle: 'emberpepper', rustnibbler: 'salt', imp: 'cinderegg', frostpup: 'frostmint', mephitling: 'rimeegg', cockatrice: 'meadowegg' },
};
DB.items.pettreat = { name: 'Pet Biscuit', desc: 'A hard little biscuit shaped like a bone, or a fish, or a beetle. Every pet likes one.', use: 'Give it to a pet on the Pets tab (Team screen): it feeds a hungry pet and grows its bond a little, once a day.', price: W_PBOND.biscuit };
const wPetFav = kind => W_PBOND.fav_of[kind] || null;
// the bond points to the next level, or null at 3
const wPetNext = q => (q.bond || 1) >= 3 ? null : W_PBOND.at[(q.bond || 1) + 1];
// bond points: a hungry pet's don't grow; each level reached says what it opens
function wPetBondXp(q, n, why) {
  if (!q || !n || q.hungry) return 0;
  q.xp = (q.xp || 0) + n;
  let up = 0;
  while ((q.bond || 1) < 3 && q.xp >= W_PBOND.at[(q.bond || 1) + 1]) {
    q.bond = (q.bond || 1) + 1; up++;
    const T = petText(q.kind, q.bond, false), opened = T ? T.powers.filter(w => w.at === q.bond).map(w => w.d) : [];
    wLog(`${q.name}'s bond with the team grows to ${q.bond} of 3${why ? ` (${why})` : ''}.${opened.length ? ' Now: ' + opened.join(' ') : ''}`, 'g');
  }
  wPetSync();
  return up;
}
// a treat would do something: feed it (hungry), or grow its bond (not yet today, not at 3)
const wPetTreatUseful = q => !!q.hungry || (q.treat !== WG.dayAbs && (q.bond || 1) < 3);
// the treats you hold that this pet eats, while one would do something: its favourite, and pet biscuits
const wPetTreatsFor = q => wPetTreatUseful(q) && !(wPets().side === q.id && wPetBusy()) ? [wPetFav(q.kind), 'pettreat'].filter(k => k && DB.items[k] && wHas(k)) : [];
// give a treat: it feeds a hungry pet; bond points once a day each
function wPetTreat(id, item) {
  const q = wPetOf(id); if (!q) return 'No such pet.';
  const fav = item === wPetFav(q.kind);
  if (!(fav || item === 'pettreat') || !DB.items[item]) return `${q.name} won't eat that.`;
  if (!wHas(item)) return `You have no ${DB.items[item].name}.`;
  // (the pet at your side stays as it is till the match is over; a treat that would do nothing isn't given)
  if (wPets().side === id && wPetBusy()) return 'Not during a match.';
  if (!wPetTreatUseful(q)) return (q.bond || 1) >= 3 ? `${q.name} isn't hungry, and its bond is as close as it gets.` : `${q.name} isn't hungry, and has had today's treat.`;
  wAddItem(item, -1);
  const was = !!q.hungry; q.hungry = false;
  const today = q.treat !== WG.dayAbs; q.treat = WG.dayAbs;
  wLog(`${q.name} ${fav ? `wolfs down the ${DB.items[item].name}: its favourite!` : `crunches a ${DB.items[item].name}.`}${was ? ' It isn\'t hungry any more.' : ''}${!today && (q.bond || 1) < 3 ? ' (One treat a day grows its bond.)' : ''}`, 'g');
  if (today && (q.bond || 1) < 3) wPetBondXp(q, fav ? W_PBOND.fav : W_PBOND.treat, 'a treat');
  wPetSync(); wSave(); return '';
}
// a card match won together
onHook('fightWon', () => {
  if (typeof WG === 'undefined' || !WG || !RUN || !RUN.pet || !WG.pets) return;
  const q = wPetSideOf(); if (q) wPetBondXp(q, W_PBOND.win, 'a win together');
});

/* ---------- the Pets tab ---------- */
const wW135PetCard = wPetCard;
wPetCard = function (q, side) {
  const h = wW135PetCard(q, side), nx = wPetNext(q), fav = wPetFav(q.kind), held = wPetTreatsFor(q);
  const line = `<small class="wnst wpetbond">Bond points ${q.xp || 0}${nx != null ? ` of ${nx} to bond ${(q.bond || 1) + 1}` : ' (bond 3: as close as it gets)'} · favourite: ${esc(fav ? DB.items[fav].name : 'anything')}</small>`;
  const btn = held.length ? held.map(k => `<button class="ghost" data-pettreat="${q.id}" data-item="${k}">Give ${esc(DB.items[k].name)}</button>`).join('') : '';
  return h.replace('<small class="hint">', line + '<small class="hint">').replace('<div class="wpa row">', '<div class="wpa row">' + btn);
};
const wW135RenderCamp = wRenderCamp;
wRenderCamp = function () {
  const r = wW135RenderCamp.apply(this, arguments);
  const body = $('wCampBody'); if (body && WCAMP.tab === 'pets') body.querySelectorAll('[data-pettreat]').forEach(b => b.onclick = () => wCampSay(wPetTreat(+b.dataset.pettreat, b.dataset.item)));
  return r;
};

/* ---------- pet biscuits at the pet shops ---------- */
function wPetBuyBiscuit(id) {
  if (!W_PSHOP.shops[id] || !wPshopIsOpen(id)) return 'The shop is shut.';
  if (RUN.gold < W_PBOND.biscuit) return `A biscuit costs ${W_PBOND.biscuit} gold.`;
  RUN.gold -= W_PBOND.biscuit; wAddItem('pettreat', 1); wLog(`You buy a Pet Biscuit for ${W_PBOND.biscuit} gold.`, 'd'); wSave(); return '';
}
const wW135PshopOpen = wPshopOpen;
wPshopOpen = function (id) {
  wW135PshopOpen.apply(this, arguments);
  if (!W_PSHOP.shops[id] || !wPshopIsOpen(id)) return;
  const box = $('modalBox'), at = box.querySelector('#wPshopWhy'); if (!at) return;
  at.insertAdjacentHTML('beforebegin', `<p>Pet biscuits, ${W_PBOND.biscuit} gold each (you have <span id="wBiscN">${WG.items.pettreat || 0}</span>). <button class="ghost" data-psbisc="1"${RUN.gold < W_PBOND.biscuit ? ' disabled' : ''}>Buy one</button></p>`);
  // (bought: the window stays as it is, focus and all; the count, the gold and what it can still afford change in place)
  const bb = box.querySelector('[data-psbisc]');
  bb.onclick = () => {
    const why = wPetBuyBiscuit(id), w = $('wPshopWhy'); if (why) { w.textContent = why; w.hidden = false; return; } w.hidden = true;
    $('wBiscN').textContent = WG.items.pettreat || 0;
    box.querySelectorAll('p.hint').forEach(p => { if (/^Gold: /.test(p.textContent)) p.textContent = `Gold: ${RUN.gold}.`; });
    box.querySelectorAll('[data-psbuy]').forEach(b => { if (RUN.gold < wPshopPrice(b.dataset.psbuy)) b.disabled = true; });
    box.querySelectorAll('[data-psback]').forEach(b => { const a = WG.petAway[+b.dataset.psback]; if (a && RUN.gold < wPshopPrice(a.kind)) b.disabled = true; });
    if (RUN.gold < W_PBOND.biscuit) bb.disabled = true;
  };
};
const wW135Audit = wAudit;
wAudit = function () {
  const P = wW135Audit().filter(s => s !== 'item pettreat cannot be obtained');
  for (const k in PETS) if (!DB.items[wPetFav(k)]) P.push('pet ' + k + '\'s favourite treat is not an item');
  return P;
};

const wW135RenderHelp = renderHelp;
renderHelp = function () {
  wW135RenderHelp();
  const h = $('wHelpPetShops') || $('wHelpPets'); if (!h || $('wHelpPetBond')) return;
  h.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpPetBond"><b>Bond and treats.</b> A pet's bond (1 to 3) grows with card matches won with it at your side, and faster with treats: each pet has its favourite (the Pets tab says which), and every pet eats pet biscuits from the pet shops. A treat grows its bond once a day, and feeds a hungry pet whenever it is given; one that would do neither isn't given, and the pet at your side waits till the match is over. ${W_PBOND.at[2]} bond points make bond 2, and ${W_PBOND.at[3]} make bond 3; each level makes its trait stronger and opens or lifts a power. Bond never goes down, but a hungry pet's doesn't grow.</p>`);
};
