/* w134: pet shops and keepers (issue #104, phase 4). Loads after w133-petegg.js; changes earlier parts only by
   reassignment (saved originals carry the wW134 prefix).

   Pet shops, in Graftonbury, Saltmere and Cinderhold. Each sells its region's shop pets (PETS[k].how === 'shop', by
   element), one of them a week (the stock turns with the week), and takes back any pet let go there at its price.
   Each shop's door is shut until its quest is done, a small side plot in its town:
     Graftonbury  Wick Tallowmere's Blinkpups keep blinking out of the shop: three loose in town (catch them), then
                  tell Wick (PUPS)
     Saltmere     Gull Merriweather's Mimic, Chestnut, has eaten the ledger: two saltfish and it coughs it up (LEDGER)
     Cinderhold   Ottilie Soot's Glowbeetles are loose in the forge quarter: three to catch (BEETLES)
   Keepers, in Mossgate and Rimewatch, each with one pet found nowhere else and a condition of their own:
     Mossgate     Old Bramblewhit, a hermit beast-keeper: the Hootling, to a team that has won a golf match at
                  Mossgate Links (WG.lkg.w)
     Rimewatch    Sigga Runner, a sled-dog drover: the Frostpup, to a team that has won a hockey match at the Pond Rink
                  (WG.hkg.w)
   Ask a shopkeeper or keeper about PETS to see what they sell. A pet bought goes into the kennel (wPetAdd, from
   'shop:<id>' or 'keeper:<id>'); a full kennel can't buy (let one go first). Prices by rarity (W_PSHOP.price). A shop
   sells one pet a week (WG.pshopWk[shop], the week of the last), a keeper its one pet once a journey (pkeep_<id>):
   keeper pets are found nowhere else. Treats come with bond, phase 5.

   The five stand in their towns, and the loose pets wait on open ground, placed over the built maps (wPshopBuild,
   deterministic, keeping everything reachable). Flags: pq_<shop>_<n> (a loose pet caught), q_petshop_<shop> (the
   quest, and the shop open).
   W_PSHOP, wPshopStock, wPshopOpen, wPshopBuy, wPshopKeeperOk, wPshopCatch
   Wrapped: buildAllMaps (wW134BuildAllMaps), wAudit (wW134Audit: the loose pets, the shops' and keepers' pets), wTileAt
   (wW134TileAt: a caught loose pet's tile is the ground again), wUse (wW134Use: loose pets), wTileVariant
   (wW134TileVariant), wRunAct (wW134RunAct: 'petshop'), wSay (wW134Say: PETS shut until the quest or the condition),
   renderHelp (wW134RenderHelp: #wHelpPetShops). */

const W_PSHOP = {
  price: { c: 60, u: 90, r: 140 },
  shops: {
    hq: { town: 'graftonbury', el: 'aether', npc: 'pshop_hq', at: [14, 20], loose: 'blinkpup', kw: 'pups', quest: 'q_petshop_hq', name: 'Tallowmere\'s Pets' },
    salt: { town: 'saltmere', el: 'tide', npc: 'pshop_salt', at: [30, 20], kw: 'ledger', quest: 'q_petshop_salt', take: { saltfish: 2 }, name: 'Merriweather\'s Menagerie' },
    cind: { town: 'cinderhold', el: 'ember', npc: 'pshop_cind', at: [20, 24], loose: 'glowbeetle', kw: 'beetles', quest: 'q_petshop_cind', name: 'Soot & Sons, Pets' },
  },
  keepers: {
    moss: { town: 'mossgate', npc: 'pkeep_moss', at: [32, 16], pet: 'hootling', ok: () => !!(WG.lkg && WG.lkg.w > 0), need: 'a team that has won a golf match at Mossgate Links' },
    rime: { town: 'rimewatch', npc: 'pkeep_rime', at: [10, 14], pet: 'frostpup', ok: () => !!(WG.hkg && WG.hkg.w > 0), need: 'a team that has won a hockey match at the Pond Rink' },
  },
  loose: 3,
};
const W_PSHOP_CH = 'ǝ';
const wPshopPrice = kind => W_PSHOP.price[(PETS[kind] || {}).rar] || W_PSHOP.price.c;
const wPshopOf = id => W_PSHOP.shops[id] ? Object.assign({ id, shop: 1 }, W_PSHOP.shops[id]) : W_PSHOP.keepers[id] ? Object.assign({ id, keeper: 1 }, W_PSHOP.keepers[id]) : null;
const wPshopFrom = S => (S.shop ? 'shop:' : 'keeper:') + S.id;
// a shop's pets, and this week's: one of them, turning with the week
const wPshopPets = id => Object.keys(PETS).filter(k => PETS[k].how === 'shop' && PETS[k].el === W_PSHOP.shops[id].el);
function wPshopStock(id, wk) { const S = wPshopOf(id); if (!S) return null; if (S.keeper) return S.pet; const L = wPshopPets(id); return L.length ? L[((wk == null ? wWeek() : wk) + Object.keys(W_PSHOP.shops).indexOf(id)) % L.length] : null; }
const wPshopKeeperOk = id => { const K = W_PSHOP.keepers[id]; return !!(K && WG && K.ok()); };
const wPshopIsOpen = id => { const S = wPshopOf(id); return !!S && (S.keeper ? wPshopKeeperOk(id) : wFlag(S.quest)); };

/* ---------- the people ---------- */
const W_PSHOP_PEOPLE = {
  pshop_hq: { name: 'Wick Tallowmere', kind: 'kobold', look: { coat: '#6a4a8a', acc: 'clip', hair: '#d8b860' },
    greet: 'Mind the door! No, the other way, they get out. Ask me about PETS, or the PUPS.',
    job: 'I keep the pet shop. Blinkpups and axebeak chicks, mostly. Ask me about PETS. When the PUPS stay put.' },
  pshop_salt: { name: 'Gull Merriweather', kind: 'troll', look: { coat: '#235c9c', acc: 'hat', hair: '#8a857e' },
    greet: 'Shop\'s shut. The books are inside the shop. The shop is inside Chestnut. Ask about the LEDGER.',
    job: 'I sell mimics and cubes, when I can find my LEDGER. Ask me about PETS when it is back.' },
  pshop_cind: { name: 'Ottilie Soot', kind: 'dwarf', look: { coat: '#5a3a2a', acc: 'goggles', hair: '#c94a3a' },
    greet: 'If you see something glowing under a cart, it is mine. Ask about the BEETLES.',
    job: 'Soot and Sons: fire beetles and rust nibblers, bred hot. Ask me about PETS. Once the BEETLES are home.' },
  pkeep_moss: { name: 'Old Bramblewhit', kind: 'elf', look: { coat: '#4a6a3a', acc: 'robe', hair: '#e8e0cc' },
    greet: 'Shh. The owlbears are sleeping. Well, one of them is. Ask me about PETS.',
    job: 'I keep beasts out here, the ones the town is scared of. Owlbear cubs. Hootlings, the children call them. Ask me about PETS.' },
  pkeep_rime: { name: 'Sigga Runner', kind: 'werewolf', look: { coat: '#6aa6c4', acc: 'cap', hair: '#3a3a40' },
    greet: 'Down, Frost. Down! Sorry. They like you. Ask me about PETS.',
    job: 'I run sled dogs from here to the abbey and back. Winter wolf cubs, Frostpups, pull the best. Ask me about PETS.' },
};
for (const id in W_PSHOP_PEOPLE) {
  const C = W_PSHOP_PEOPLE[id];
  DB.chars[id] = { name: C.name, kind: C.kind, look: C.look, greet: C.greet, topics: { job: { t: C.job }, pets: { t: 'Have a look.', act: 'petshop' } } };
}
// the quests: catch the loose ones and tell the keeper; or hand over what was asked
(() => {
  const H = DB.chars.pshop_hq, S = DB.chars.pshop_salt, C = DB.chars.pshop_cind, n = W_PSHOP.loose;
  H.topics.pups = { t: 'All three! Back in their basket, and they have only blinked out twice since. The shop is open: ask me about PETS.', need: [...Array(n).keys()].map(i => 'pq_hq_' + i), once: 'q_petshop_hq', xp: 15,
    needNo: `${n} Blinkpups blinked out of the shop this morning, and they are all over town. Bring them back, every one, and I can open the door again.`, t2: 'They have only blinked out twice since. Ask me about PETS.' };
  S.topics.ledger = { t: 'Two saltfish, and... there. Up it comes. Damp, but every page is there. The shop is open: ask me about PETS.', take: W_PSHOP.shops.salt.take, once: 'q_petshop_salt', xp: 15,
    needNo: 'Chestnut ate the ledger. Mimics give things back for saltfish, two of them. The stall on the square sells them, and the fish off the pier bite.', t2: 'The ledger is back, damp. Ask me about PETS.' };
  C.topics.beetles = { t: 'There they are, glowing in the jar. My thanks. The shop is open: ask me about PETS.', need: [...Array(n).keys()].map(i => 'pq_cind_' + i), once: 'q_petshop_cind', xp: 15,
    needNo: `${n} fire beetles got out of the forge last night. They glow: look under carts and in corners. Bring them home and the shop opens.`, t2: 'Home and glowing. Ask me about PETS.' };
})();
DB.sideplots.push(
  { id: 'q_petshop_hq', title: 'The pups that won\'t stay put', who: 'Wick Tallowmere, Graftonbury', hint: 'Catch the three loose Blinkpups in town and tell Wick (PUPS).', pay: 'The pet shop opens.' },
  { id: 'q_petshop_salt', title: 'The ledger in the mimic', who: 'Gull Merriweather, Saltmere', hint: 'Bring two saltfish for Chestnut (LEDGER).', pay: 'The pet shop opens.' },
  { id: 'q_petshop_cind', title: 'Beetles in the forge', who: 'Ottilie Soot, Cinderhold', hint: 'Catch the three loose fire beetles in town and tell Ottilie (BEETLES).', pay: 'The pet shop opens.' },
);
// (the loose pets' flags are set by catching them, not by a topic)
for (const s of ['hq', 'cind']) for (let i = 0; i < W_PSHOP.loose; i++) DB.engineFlags.push('pq_' + s + '_' + i);
Object.assign(DB.tiles, { [W_PSHOP_CH]: { name: 'loose pet', walk: 0, use: 'petloose', look: 'Something small that should not be out on its own.' } });
Object.assign(W_MAP_COL, { [W_PSHOP_CH]: '#d8c8ff' });

/* ---------- placed over the maps: the five, the loose pets ---------- */
// the nearest open tile to (x, y) for somebody to stand on: one you can reach, with a free side to talk from, where
// standing cuts nothing and nobody off (wPlaceGuard)
function wPshopStand(m, x, y) {
  const G = wPlaceGuard(m), sx = m.spawn[0], sy = m.spawn[1];
  for (let rad = 0; rad <= 10; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
    const xx = x + dx, yy = y + dy; if (xx < 1 || yy < 1 || xx >= m.w - 1 || yy >= m.h - 1) continue;
    if (!wOpenTile(m, xx, yy) || m.meta[xx + ',' + yy] || (xx === sx && yy === sy) || !G.seen0[yy * m.w + xx]) continue;
    m.npcs.push({ id: '_stand', x: xx, y: yy, fixed: true }); const seen = G.reach(); m.npcs.pop();
    // (a side you can reach with nobody on it, so a click on them walks there)
    if (G.ok(seen) && W_SIDES.some(([ax, ay]) => G.at(seen, xx + ax, yy + ay) && !m.npcs.some(n => n.x === xx + ax && n.y === yy + ay))) return [xx, yy];
  }
  return null;
}
function wPshopBuild() {
  for (const S of [...Object.values(W_PSHOP.shops), ...Object.values(W_PSHOP.keepers)]) {
    const m = MAPS[S.town]; if (!m || m.npcs.some(n => n.id === S.npc)) continue;
    const at = wPshopStand(m, S.at[0], S.at[1]); if (at) m.npcs.push({ id: S.npc, x: at[0], y: at[1], fixed: true });
  }
  for (const id in W_PSHOP.shops) {
    const S = W_PSHOP.shops[id], m = MAPS[S.town]; if (!S.loose || !m) continue;
    const spots = [[.2, .3], [.8, .35], [.5, .8]];
    spots.slice(0, W_PSHOP.loose).forEach(([fx, fy], i) => wPeggPut(m, W_PSHOP_CH, Math.round(m.w * fx), Math.round(m.h * fy), [wGroundCh(m)], { loose: id, i, pet: S.loose }));
  }
}
const wW134BuildAllMaps = buildAllMaps;
buildAllMaps = function () { const r = wW134BuildAllMaps.apply(this, arguments); wPshopBuild(); if (typeof wInvalidate === 'function') wInvalidate(); return r; };
// the audit: the five are placed (the base audit checks every character is), and every loose pet is on its map
const wW134Audit = wAudit;
wAudit = function () {
  const P = wW134Audit();
  for (const id in W_PSHOP.shops) { const S = W_PSHOP.shops[id], m = MAPS[S.town]; if (S.loose) for (let i = 0; i < W_PSHOP.loose; i++) if (!m || !Object.values(m.meta).some(x => x.loose === id && x.i === i)) P.push('pet shop ' + id + ': loose pet ' + i + ' is not on ' + S.town); if (!wPshopPets(id).length) P.push('pet shop ' + id + ' has no pets to sell'); }
  for (const id in W_PSHOP.keepers) if (!PETS[W_PSHOP.keepers[id].pet] || PETS[W_PSHOP.keepers[id].pet].how !== 'keeper') P.push('keeper ' + id + ' sells no keeper pet');
  for (const k in PETS) if (PETS[k].how === 'keeper' && !Object.values(W_PSHOP.keepers).some(K => K.pet === k)) P.push('keeper pet ' + k + ' has no keeper');
  return P;
};

/* ---------- a loose pet, caught ---------- */
function wPshopCatch(m, meta) {
  const S = W_PSHOP.shops[meta.loose]; if (!S) return;
  // (a caught one, or one whose shop is open, is ground again (wTileAt) and never comes here; called some other way, nothing)
  const f = 'pq_' + meta.loose + '_' + meta.i, D = PETS[meta.pet] || { n: 'pet' };
  if (wFlag(f) || wFlag(S.quest)) return;
  wSetFlag(f); wAdvance(10); wInvalidate(WG.map);
  const left = [...Array(W_PSHOP.loose).keys()].filter(i => !wFlag('pq_' + meta.loose + '_' + i)).length, who = W_PSHOP_PEOPLE[S.npc].name;
  wLog(left ? `You catch a loose ${D.n}! It wriggles into your coat. ${left} still out there; ${who} will want them all.` : `You catch the last loose ${D.n}. Time to take them back to ${who}.`, 'm');
  wSave();
}

/* ---------- the shop window ---------- */
function wPshopBuy(id, kind) {
  const S = wPshopOf(id); if (!S) return 'No such shop.';
  if (!wPshopIsOpen(id)) return S.keeper ? `Only to ${S.need}.` : 'The shop is shut.';
  if (kind !== wPshopStock(id)) return 'Not in stock this week.';
  const sold = wPshopSold(id); if (sold) return sold;
  if (wPets().owned.length >= W_PET.kennel) return `Your kennel is full (${W_PET.kennel}): let one go first.`;
  const c = wPshopPrice(kind); if (RUN.gold < c) return `It costs ${c} gold.`;
  RUN.gold -= c; const q = wPetAdd(kind, wPshopFrom(S));
  if (!q || q.waits) { RUN.gold += c; return 'It wouldn\'t come.'; }
  if (S.keeper) wSetFlag('pkeep_' + id); else (WG.pshopWk = WG.pshopWk || {})[id] = wWeek();
  wLog(`You buy ${petA(PETS[kind].n)} ${PETS[kind].n} for ${c} gold.`, 'g'); wSave(); return '';
}
// sold out: a shop's pet this week, a keeper's once a journey ('' when there is one to buy)
function wPshopSold(id) {
  const S = wPshopOf(id); if (!S) return 'No such shop.';
  if (S.keeper) return wFlag('pkeep_' + id) ? `${W_PSHOP_PEOPLE[S.npc].name} has only the one ${PETS[S.pet].n} to part with, and it is yours.` : '';
  return WG.pshopWk && WG.pshopWk[id] === wWeek() ? 'Sold out this week: the next one comes in as the week turns.' : '';
}
// one let go here, had back at the price
function wPshopBack(id, i) {
  const S = wPshopOf(id), a = (WG.petAway || [])[i]; if (!S || !a || a.from !== wPshopFrom(S)) return 'Nobody like that waits here.';
  if (wPets().owned.length >= W_PET.kennel) return `Your kennel is full (${W_PET.kennel}): let one go first.`;
  const c = wPshopPrice(a.kind); if (RUN.gold < c) return `It costs ${c} gold to have ${a.name} back.`;
  const why = wPetReclaim(i); if (why) return why;
  RUN.gold -= c; wLog(`${a.name} comes back to you, for ${c} gold.`, 'g'); wSave(); return '';
}
function wPshopOpen(id) {
  const S = wPshopOf(id); if (!S) return;
  if (typeof wCloseTalk === 'function') wCloseTalk();
  const who = W_PSHOP_PEOPLE[S.npc].name, open = wPshopIsOpen(id), kind = wPshopStock(id), D = PETS[kind];
  const full = wPets().owned.length >= W_PET.kennel, away = (WG.petAway || []).map((a, i) => ({ a, i })).filter(o => o.a.from === wPshopFrom(S));
  const T = D && petText(kind, 1, false), sold = open && wPshopSold(id);
  const offer = !open ? `<p>${S.keeper ? `${esc(who)} sells only to ${esc(S.need)}.` : `The shop is shut until ${esc(who)} has sorted things out.`}</p>`
    : `<p>${S.shop ? 'This week' : 'The only one'}: <b>${esc(D.n)}</b>, ${petA(D.from)} ${esc(D.from)} (${esc(DB.elems.names[T.el] || T.el)}), ${wPshopPrice(kind)} gold, upkeep ${wPetCost({ kind })} gold a week.</p>
       <p class="hint"><b>Always:</b> ${esc(T.trait)} <b>Trick:</b> ${esc(T.trick.n)}: ${esc(T.trick.d)}</p>
       ${sold ? `<p class="hint">${esc(sold)}</p>` : `<div class="row"><button class="btn" data-psbuy="${kind}"${full || RUN.gold < wPshopPrice(kind) ? ' disabled' : ''}>Buy (${wPshopPrice(kind)} gold)</button></div>`}
       ${S.shop && wPshopPets(id).length > 1 ? `<p class="hint">Next week: ${esc(PETS[wPshopStock(id, wWeek() + 1)].n)}.</p>` : ''}`;
  const wait = away.length ? `<p>Waiting here for you:</p><ul class="wpetlist">${away.map(o => `<li><button class="ghost" data-psback="${o.i}"${full ? ' disabled' : ''}>Have ${esc(o.a.name)} back (${wPshopPrice(o.a.kind)} gold)</button></li>`).join('')}</ul>` : '';
  const close = modal(`<header><h3>${esc(S.name || who)}</h3></header><div class="wmsg">${offer}${wait}${full ? `<p class="hint">Your kennel is full (${W_PET.kennel}): let one go first.</p>` : ''}<p class="hint" id="wPshopGold">Gold: ${RUN.gold}.</p><p class="wbad" id="wPshopWhy" hidden></p></div>
    <div class="row"><button class="ghost" data-close>Leave</button></div>`, () => wDrain());
  const say = why => { if (why) { const w = $('wPshopWhy'); w.textContent = why; w.hidden = false; return; } close(); };
  $('modalBox').querySelectorAll('[data-psbuy]').forEach(b => b.onclick = () => say(wPshopBuy(id, b.dataset.psbuy)));
  $('modalBox').querySelectorAll('[data-psback]').forEach(b => b.onclick = () => say(wPshopBack(id, +b.dataset.psback)));
}
// the shop's or keeper's name for a person
const wPshopByNpc = npc => Object.keys(W_PSHOP.shops).find(k => W_PSHOP.shops[k].npc === npc) || Object.keys(W_PSHOP.keepers).find(k => W_PSHOP.keepers[k].npc === npc);
const wW134RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'petshop') { const s = wPshopByNpc(id); if (s) wPshopOpen(s); return; } return wW134RunAct.apply(this, arguments); };
// a keeper's answer to PETS says the condition until it is met
const wW134Say = wSay;
wSay = function (id, kw) {
  const r = wW134Say(id, kw), s = wPshopByNpc(id);
  if (!s || !r || !WG || r.key !== 'pets') return r;
  if (W_PSHOP.keepers[s] && !wPshopKeeperOk(s)) return Object.assign({}, r, { text: `Not to just anybody. Only to ${W_PSHOP.keepers[s].need}. Come back when you are.`, act: null });
  if (W_PSHOP.shops[s] && !wFlag(W_PSHOP.shops[s].quest)) return Object.assign({}, r, { text: DB.chars[id].topics[W_PSHOP.shops[s].kw].needNo, act: null });
  return r;
};

// a caught loose pet (or one whose shop is open) leaves only the ground behind: walk on, look at it, draw it as such
const wPshopGone = (map, x, y) => { const mt = map.meta[x + ',' + y] || {}, S = W_PSHOP.shops[mt.loose]; return !!(WG && S && (wFlag('pq_' + mt.loose + '_' + mt.i) || wFlag(S.quest))); };
const wW134TileAt = wTileAt;
wTileAt = function (map, x, y) {
  const c = wW134TileAt(map, x, y);
  if (c === W_PSHOP_CH && wPshopGone(map, x, y)) return (map.meta[x + ',' + y] || {}).under || '.';
  return c;
};
const wW134Use = wUse;
wUse = function (x, y) {
  const m = wCurMap(), c = wTileAt(m, x, y), use = (DB.tiles[c] || {}).use, meta = m.meta[x + ',' + y] || {};
  if (use === 'petloose') return wPshopCatch(m, meta);
  return wW134Use.apply(this, arguments);
};
const wW134TileVariant = wTileVariant;
wTileVariant = function (map, x, y, c) {
  if (c === W_PSHOP_CH) { const mt = map.meta[x + ',' + y] || {}, S = W_PSHOP.shops[mt.loose]; return (mt.pet || 'blinkpup') + (!WG || (!wFlag('pq_' + mt.loose + '_' + mt.i) && !(S && wFlag(S.quest))) ? '1' : '0'); }
  return wW134TileVariant(map, x, y, c);
};
// a loose pet: a little blob in its element's colour, with a guilty look; gone once caught
Object.assign(WOBJ, {
  [W_PSHOP_CH]: (c, P, r, e, v) => {
    const kind = String(v || 'blinkpup1').slice(0, -1); if (String(v).slice(-1) === '0') return;
    const col = PET_EL_COL[(PETS[kind] || {}).el] || '#e9dcc0', bob = (r() - .5) * 2;
    wShadow(c, 16, 26, 7, 2.5, .3);
    const b = pEl(16, 20 + bob, 7, 6); wCel(c, b, col, 1, 1.2);
    c.fillStyle = '#17100e'; c.fillRect(13, 18 + bob, 1.6, 1.6); c.fillRect(18, 18 + bob, 1.6, 1.6);
    if (kind === 'glowbeetle') { c.save(); c.globalAlpha = .35; c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(16, 20, 10, 0, 7); c.fill(); c.restore(); }
    else { c.save(); c.globalAlpha = .5; c.strokeStyle = col; c.setLineDash([1.5, 2]); c.beginPath(); c.arc(16, 20, 10, 0, 7); c.stroke(); c.restore(); }
  },
});

const wW134RenderHelp = renderHelp;
renderHelp = function () {
  wW134RenderHelp();
  const h = $('wHelpPetEggs') || $('wHelpPets'); if (!h || $('wHelpPetShops')) return;
  h.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpPetShops"><b>Pet shops and keepers.</b> Graftonbury, Saltmere and Cinderhold have pet shops, each shut until you help its keeper with a small trouble in town. A shop sells its region's pets, one a week (a different one as the weeks turn), and takes back any pet let go there, at its price. Mossgate and Rimewatch have keepers instead, each with one pet found nowhere else, and only the one each journey: the Hootling, to a team that has won a golf match at Mossgate Links, and the Frostpup, to a team that has won a hockey match at the Pond Rink. Ask any of them about PETS. Prices: ${W_PSHOP.price.c} gold for a common pet, ${W_PSHOP.price.u} uncommon, ${W_PSHOP.price.r} rare.</p>`);
};
