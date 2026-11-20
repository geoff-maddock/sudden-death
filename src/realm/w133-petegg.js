/* w133: pet eggs (issue #104, phase 3). Loads after w132-pets.js; changes earlier parts only by reassignment (saved
   originals carry the wW133 prefix).

   Pet eggs are a third kind of egg: not the nests' cooking eggs (w40), not the rare eggs that hatch players at Dr.
   Pell's (w41). Each pet that comes from an egg (PETS[k].how === 'egg') has one, once a journey, at one spot
   (W_PEGG.eggs): the three dungeon eggs sit in the alpha's room and can be taken once the alpha is beaten; the
   Cockatrice's, at the end of the Road to Nowhere, only after dark. Taking one sets pegg_<kind>.

   Each egg names the one place that hatches it, by its element (W_PEGG.places, one per region): Graftonbury's
   glasshouse (aether), the Mossgate warm spring (bloom), a rock pool in Saltmere (tide), the Cinderhold forge's back
   wall (ember), the Rimewatch ice-house (rime). Walk into one: put an egg of its element in (one at a time; eggs
   don't spoil), check on it, and after W_PEGG.days days meet what hatched and name it. The pet goes into the kennel
   (wPetAdd, from 'hatch:<element>'); at a full kennel it waits at the hatching place, like any pet let go from
   there, and can be had back for nothing (Reclaim).

   Ask Dr. Pell about PETS. The spots and the places are tiles laid over the built maps (wPeggBuild, from buildAllMaps,
   deterministically), so only flags and WG.petEggs go into the save.

   WG.petEggs = { [element]: { kind, due } }
   W_PEGG, wPeggBuild, wPeggPut, wPeggTake, wPeggPlace, wPeggHatch, wPetNameAny
   Wrapped: buildAllMaps (wW133BuildAllMaps), wStart (wW133Start: old saves' unknown eggs), wAudit (wW133Audit: each egg's spot, each place), wUse (wW133Use: 'petegg' and 'pethatch' tiles), wTileVariant
   (wW133TileVariant: an egg there or not), renderHelp (wW133RenderHelp: #wHelpPetEggs). */

const W_PEGG = {
  days: 3,
  eggs: {
    pseudodragon: { map: 'genevault', alpha: 1, name: 'Pseudodragon Egg', desc: 'Small, warm and faintly purring. The Vault Warden kept it by its feet.' },
    sprite: { map: 'hollowshrine', name: 'Sprite Egg', desc: 'Shaped like a jar, and something inside it is keeping score.' },
    bogfrog: { map: 'g_links', name: 'Bog Frog Egg', desc: 'A soft green egg from the water by the ninth. It smells of the pond.' },
    hippogriff: { map: 'hatchery', alpha: 1, name: 'Hippogriff Egg', desc: 'Feathered at one end and scaled at the other, and it smells of fish.' },
    imp: { map: 'deepseam', alpha: 1, name: 'Imp Egg', desc: 'Warm as a coal. Now and then it says something rude.' },
    mephitling: { map: 'frozenchapel', name: 'Mephit Egg', desc: 'An egg of blue ice that never melts, however long you hold it.' },
    cockatrice: { map: 'umbralden', night: 1, name: 'Cockatrice Egg', desc: 'Grey, cold and heavy as stone. Best not to stare back at it.' },
  },
  // the hatching places: where, what it is, how it looks
  places: {
    aether: { map: 'graftonbury', at: [40, 26], name: 'the glasshouse', look: 'A little glasshouse, warm and humming, where the aether gathers under the panes.' },
    bloom: { map: 'mossgate', at: [30, 22], name: 'the warm spring', look: 'A warm spring in a ring of moss, steaming gently. Things hatch here that hatch nowhere else.' },
    tide: { map: 'saltmere', at: [20, 31], name: 'the rock pool', look: 'A rock pool left by the tide, full of anemones and patient things.' },
    ember: { map: 'cinderhold', at: [33, 26], name: 'the forge\'s back wall', look: 'A niche in the back wall of the forge, too hot to touch and just right for an egg.' },
    rime: { map: 'rimewatch', at: [32, 20], name: 'the ice-house', look: 'An ice-house dug into the snow, where the cold keeps the right things alive.' },
  },
};
const W_PEGG_CH = { egg: 'ȩ', hatch: 'ȟ' };
const wPeggItem = kind => 'pegg_' + kind;
const wPeggPlaceOf = kind => W_PEGG.places[(PETS[kind] || {}).el];
// the item for each egg
for (const k in W_PEGG.eggs) {
  const E = W_PEGG.eggs[k], P = wPeggPlaceOf(k), city = P && (DB.towns.find(t => t.id === P.map) || {}).name;
  DB.items[wPeggItem(k)] = { name: E.name, desc: E.desc, use: P ? `A pet egg: it hatches only at ${P.name} in ${city}.` : 'A pet egg.', price: 0 };
}
Object.assign(DB.tiles, {
  [W_PEGG_CH.egg]: { name: 'pet egg nest', walk: 0, use: 'petegg', look: 'A small nest, lined with down and something shiny.' },
  [W_PEGG_CH.hatch]: { name: 'hatching place', walk: 0, use: 'pethatch', look: 'A warm, sheltered spot.' },
});
Object.assign(W_MAP_COL, { [W_PEGG_CH.egg]: '#c8a060', [W_PEGG_CH.hatch]: '#e0b84a' });

/* ---------- laid over the maps: an egg's spot, each hatching place ---------- */
// put ch on the nearest open tile of the kinds in on, keeping everything reachable that was: every floor tile but
// the one taken, and every thing on the map (its meta) still has a reachable side
function wPeggPut(m, ch, x, y, on, meta) {
  const sx = m.spawn[0], sy = m.spawn[1], count = s => { let n = 0; for (let i = 0; i < s.length; i++) n += s[i]; return n; };
  const side = (seen, k) => { const [mx, my] = k.split(',').map(Number); return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(my + dy) * m.w + mx + dx]); };
  const seen0 = bfsReach(m, sx, sy), base = count(seen0), had = Object.keys(m.meta).filter(k => side(seen0, k));
  for (let rad = 0; rad <= 6; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
    const xx = x + dx, yy = y + dy; if (xx < 1 || yy < 1 || xx >= m.w - 1 || yy >= m.h - 1) continue;
    const c0 = m.t[yy][xx], k = xx + ',' + yy;
    if (!on.includes(c0) || m.meta[k] || !seen0[yy * m.w + xx] || (m.npcs || []).some(n => n.x === xx && n.y === yy) || wInsideBuilding(m, xx, yy)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => m.t[yy + ay] && m.t[yy + ay][xx + ax] === '+')) continue;
    m.t[yy][xx] = ch;
    const seen = bfsReach(m, sx, sy);
    if (count(seen) >= base - 1 && side(seen, k) && had.every(h => side(seen, h))) { m.meta[k] = Object.assign({ under: c0 }, meta || {}); return [xx, yy]; }
    m.t[yy][xx] = c0;
  }
  return null;
}
function wPeggSpot(m, kind) {
  const E = W_PEGG.eggs[kind];
  let x = m.spawn[0], y = m.spawn[1], on;
  if (E.alpha) {
    // (in the alpha's room, beside it)
    let ax = -1, ay = -1, alpha = null;
    for (let yy = 0; yy < m.h && ax < 0; yy++) for (let xx = 0; xx < m.w; xx++) { const mt = m.meta[xx + ',' + yy]; if (m.t[yy][xx] === 'M' && mt && mt.alpha) { ax = xx; ay = yy; alpha = mt.alpha; break; } }
    if (ax < 0) return null;
    x = ax + 2; y = ay + 1;
    on = [...new Set([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]].map(([dx, dy]) => m.t[ay + dy] && m.t[ay + dy][ax + dx]).filter(c => c && walkCh(c) && !DB.tiles[c].enter))];
    return wPeggPut(m, W_PEGG_CH.egg, x, y, on, { petegg: kind, alpha });
  }
  // (away from the way in: the far side of the place)
  x = m.w - 1 - m.spawn[0]; y = Math.max(2, Math.min(m.h - 3, m.h - 1 - m.spawn[1]));
  on = [wGroundCh(m)];
  return wPeggPut(m, W_PEGG_CH.egg, x, y, on, { petegg: kind }) || wPeggPut(m, W_PEGG_CH.egg, m.spawn[0], Math.max(2, m.spawn[1] - 4), on, { petegg: kind });
}
function wPeggBuild() {
  for (const k in W_PEGG.eggs) { const m = MAPS[W_PEGG.eggs[k].map]; if (m) wPeggSpot(m, k); }
  for (const el in W_PEGG.places) {
    const P = W_PEGG.places[el], m = MAPS[P.map]; if (!m) continue;
    wPeggPut(m, W_PEGG_CH.hatch, P.at[0], P.at[1], [wGroundCh(m)], { pethatch: el });
  }
}
const wW133BuildAllMaps = buildAllMaps;
buildAllMaps = function () { const r = wW133BuildAllMaps.apply(this, arguments); wPeggBuild(); if (typeof wInvalidate === 'function') wInvalidate(); return r; };

// the audit: every pet egg has its spot (so it can be had), every hatching place is on its map
const wPeggFind = (m, ch, key, v) => m && Object.entries(m.meta).some(([k, x]) => { const [xx, yy] = k.split(',').map(Number); return m.t[yy] && m.t[yy][xx] === ch && x[key] === v; });
const wW133Audit = wAudit;
wAudit = function () {
  const P = wW133Audit().filter(s => !Object.keys(W_PEGG.eggs).some(k => s === 'item ' + wPeggItem(k) + ' cannot be obtained' && wPeggFind(MAPS[W_PEGG.eggs[k].map], W_PEGG_CH.egg, 'petegg', k)));
  for (const k in W_PEGG.eggs) { if (!wPeggFind(MAPS[W_PEGG.eggs[k].map], W_PEGG_CH.egg, 'petegg', k)) P.push('pet egg ' + k + ' has no spot on ' + W_PEGG.eggs[k].map); if (!PETS[k] || PETS[k].how !== 'egg' || !wPeggPlaceOf(k)) P.push('pet egg ' + k + ' is not an egg pet with a hatching place'); }
  for (const k in PETS) { if (PETS[k].how === 'egg' && !W_PEGG.eggs[k]) P.push('egg pet ' + k + ' has no egg'); if (PETS[k].n.length > W_PET.nameMax) P.push('pet ' + k + '\'s name is longer than a pet\'s name may be'); }
  for (const el in W_PEGG.places) if (!wPeggFind(MAPS[W_PEGG.places[el].map], W_PEGG_CH.hatch, 'pethatch', el)) P.push('hatching place ' + el + ' is not on ' + W_PEGG.places[el].map);
  return P;
};

/* ---------- taking an egg ---------- */
function wPeggTake(m, meta) {
  const kind = meta.petegg, E = W_PEGG.eggs[kind]; if (!E) return;
  if (wFlag('pegg_' + kind)) return wLog('The little nest is empty now. Whatever was in it is yours.', 'd');
  if (E.alpha && meta.alpha && !wFlag('alpha_' + meta.alpha)) return wLog('A small nest, right beside the alpha. Not while it is watching.', 'd');
  if (E.night && !wIsNight()) return wLog('A grey egg in a nest of grey feathers, stone-cold and stuck fast. It won\'t come loose by daylight: come back after dark.', 'd');
  const P = wPeggPlaceOf(kind), city = (DB.towns.find(t => t.id === P.map) || {}).name;
  wAddItem(wPeggItem(kind), 1); wSetFlag('pegg_' + kind); wAdvance(10); wInvalidate(WG.map);
  wLog(`In the little nest: a ${E.name}. It will hatch only at ${P.name} in ${city}.`, 'm');
  wSave();
}

/* ---------- a hatching place ---------- */
function wPetEggs() { return WG.petEggs = WG.petEggs || {}; }
const wPeggHeld = el => Object.keys(W_PEGG.eggs).filter(k => wHas(wPeggItem(k)) && (!el || PETS[k].el === el));
// put an egg in: one at a time
function wPeggPlace(el, kind) {
  const H = wPetEggs(); if (H[el]) return 'There is an egg in it already.';
  if (!W_PEGG.eggs[kind] || PETS[kind].el !== el) return 'This place won\'t hatch that egg.';
  if (!wHas(wPeggItem(kind))) return 'You have no such egg.';
  wAddItem(wPeggItem(kind), -1); H[el] = { kind, due: WG.dayAbs + W_PEGG.days };
  wLog(`The ${W_PEGG.eggs[kind].name} goes into ${W_PEGG.places[el].name}. It is due in ${W_PEGG.days} days.`, 'm');
  wInvalidate(WG.map); wSave(); return '';
}
// a due egg hatches: the pet first (never lost: at a full kennel it waits here), then its name
function wPeggHatch(el) {
  const H = wPetEggs(), I = H[el]; if (!I) return null;
  if (WG.dayAbs < I.due) return null;
  if (!PETS[I.kind] || !W_PEGG.eggs[I.kind]) return null;
  // (a known kind always comes: wPetAdd only refuses an unknown one. The crack first, then the kennel's line)
  wLog(`The ${W_PEGG.eggs[I.kind].name} cracks. Out tumbles ${petA(PETS[I.kind].n)} ${PETS[I.kind].n}!`, 'g');
  const q = wPetAdd(I.kind, 'hatch:' + el); if (!q) return null;
  delete H[el];
  wInvalidate(WG.map); wSave();
  return q;
}
// rename a pet in the kennel, or one waiting where it came from
function wPetNameAny(id, name) {
  if (wPetOf(id)) return wPetRename(id, name);
  const a = (WG.petAway || []).find(x => x.id === id); if (!a) return 'No such pet.';
  const n = String(name || '').replace(/[<>]/g, '').trim().slice(0, W_PET.nameMax); if (!n) return 'A name, please.';
  a.name = n; wSave(); return '';
}
function wPetHatchScene(q, el) {
  const D = PETS[q.kind];
  const close = modal(`<header><h3>It hatched!</h3></header><div class="wmsg"><p>${esc(W_PEGG.places[el].name)[0].toUpperCase() + esc(W_PEGG.places[el].name).slice(1)} gives up its egg: out tumbles ${petA(D.n)} ${esc(D.n)}, a ${esc(D.from)}, blinking at you. ${q.waits ? 'Your kennel is full, so it will wait here for you.' : 'It joins your kennel.'}</p>
    <label>What will you call it? <input type="text" id="wHatchName" maxlength="${W_PET.nameMax}" value="${esc(q.name)}"></label></div>
    <p class="wbad" id="wHatchWhy" hidden></p><div class="row"><button class="btn" id="wHatchOk">That's its name</button></div>`, () => wDrain());
  const inp = $('wHatchName'); inp.focus(); inp.select();
  const ok = () => { const why = wPetNameAny(q.id, inp.value); if (why) { const w = $('wHatchWhy'); w.textContent = why; w.hidden = false; return; } const nm = (wPetOf(q.id) || (WG.petAway || []).find(x => x.id === q.id) || q).name; wLog(`You call it ${nm}.`, 'g'); close(); };
  $('wHatchOk').onclick = ok; inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
}
function wPeggOpen(el) {
  const P = W_PEGG.places[el], H = wPetEggs();
  // (an egg of a kind the realm no longer knows (an old save) can't hatch: it goes quiet, and the place is free)
  if (H[el] && (!PETS[H[el].kind] || !W_PEGG.eggs[H[el].kind])) { delete H[el]; wLog(`The egg in ${P.name} has gone quiet and cold. Whatever it was, it won't hatch now; the place is free again.`, 'b'); wInvalidate(WG.map); wSave(); }
  const I = H[el];
  // (a due egg hatches as you walk in)
  if (I && WG.dayAbs >= I.due) { const q = wPeggHatch(el); if (q) return wPetHatchScene(q, el); }
  const held = wPeggHeld(el), other = wPeggHeld().filter(k => PETS[k].el !== el), away = (WG.petAway || []).map((a, i) => ({ a, i })).filter(o => o.a.from === 'hatch:' + el);
  const full = wPets().owned.length >= W_PET.kennel;
  const now = I ? `<p>The ${esc(W_PEGG.eggs[I.kind].name)} is in, and warm. It is due in ${I.due - WG.dayAbs} day${I.due - WG.dayAbs === 1 ? '' : 's'}.</p>`
    : held.length ? `<p>It will take one egg at a time.</p><ul class="wpetlist">${held.map(k => `<li><button class="ghost" data-pegg="${k}">Put in the ${esc(W_PEGG.eggs[k].name)}</button></li>`).join('')}</ul>`
    : `<p>It hatches ${esc(DB.elems.names[el])} eggs: ${Object.keys(W_PEGG.eggs).filter(k => PETS[k].el === el).map(k => esc(W_PEGG.eggs[k].name)).join(', ')}. You have none.</p>`;
  const oth = other.length ? `<p class="hint">Your other eggs hatch elsewhere: ${other.map(k => `${esc(W_PEGG.eggs[k].name)} at ${esc(wPeggPlaceOf(k).name)}`).join('; ')}.</p>` : '';
  const wait = away.length ? `<p>Waiting here for you:</p><ul class="wpetlist">${away.map(o => `<li><button class="ghost" data-pegback="${o.i}"${full ? ' disabled' : ''}>Take ${esc(o.a.name)} back</button> <small>${esc(PETS[o.a.kind] ? PETS[o.a.kind].n : o.a.kind)}, bond ${o.a.bond}</small></li>`).join('')}</ul>${full ? `<p class="hint">Your kennel is full (${W_PET.kennel}): let one go first.</p>` : ''}` : '';
  const close = modal(`<header><h3>${esc(P.name[0].toUpperCase() + P.name.slice(1))}</h3></header><div class="wmsg"><p>${esc(P.look)}</p>${now}${oth}${wait}<p class="wbad" id="wPeggWhy" hidden></p></div>
    <div class="row"><button class="ghost" data-close>Leave</button></div>`, () => wDrain());
  const say = why => { if (why) { const w = $('wPeggWhy'); w.textContent = why; w.hidden = false; return; } close(); };
  $('modalBox').querySelectorAll('[data-pegg]').forEach(b => b.onclick = () => say(wPeggPlace(el, b.dataset.pegg)));
  $('modalBox').querySelectorAll('[data-pegback]').forEach(b => b.onclick = () => {
    const a = WG.petAway[+b.dataset.pegback]; const why = wPetReclaim(+b.dataset.pegback);
    if (!why) wLog(`${a.name} comes back to you, as if it had never left.`, 'g');
    say(why);
  });
}

// (a loaded journey: an egg of a kind the realm no longer knows (an old save) goes quiet at once, so its place is free)
const wW133Start = wStart;
wStart = function () { const r = wW133Start.apply(this, arguments); if (WG && WG.petEggs) for (const el in WG.petEggs) if (!PETS[WG.petEggs[el].kind] || !W_PEGG.eggs[WG.petEggs[el].kind]) delete WG.petEggs[el]; return r; };
const wW133Use = wUse;
wUse = function (x, y) {
  const m = wCurMap(), c = wTileAt(m, x, y), use = (DB.tiles[c] || {}).use, meta = m.meta[x + ',' + y] || {};
  if (use === 'petegg') return wPeggTake(m, meta);
  if (use === 'pethatch' && meta.pethatch) return wPeggOpen(meta.pethatch);
  return wW133Use.apply(this, arguments);
};
// how they look: an egg in the nest or not; the place's element, and an egg in it or not
const wW133TileVariant = wTileVariant;
wTileVariant = function (map, x, y, c) {
  const mt = map.meta[x + ',' + y] || {};
  if (c === W_PEGG_CH.egg) return WG && wFlag('pegg_' + mt.petegg) ? '0' : '1';
  if (c === W_PEGG_CH.hatch) return (mt.pethatch || 'aether') + (WG && WG.petEggs && WG.petEggs[mt.pethatch] ? '1' : '0');
  return wW133TileVariant(map, x, y, c);
};
const W_PEGG_LOOK = { aether: ['#cfe4f0', '#d8c8ff'], bloom: ['#5d8a3a', '#bfe8a0'], tide: ['#7a8a8a', '#6fc3e8'], ember: ['#3b3437', '#ff8a3c'], rime: ['#e8f2f6', '#9ad0ec'] };
Object.assign(WOBJ, {
  [W_PEGG_CH.egg]: (c, P, r, e, v) => {
    wShadow(c, 16, 25, 9, 3, .3);
    const n = new Path2D(); n.ellipse(16, 22, 9, 5, 0, 0, Math.PI * 2); wCel(c, n, '#a8844a', 1, 1.2);
    const inner = new Path2D(); inner.ellipse(16, 21, 6, 2.8, 0, 0, Math.PI * 2); c.fillStyle = '#5a4022'; c.fill(inner);
    if (v !== '0') { const egg = pEl(16, 17.5, 3.6, 4.6); wCel(c, egg, '#f2e6c8', .8, 1); c.fillStyle = '#c94a3a'; c.fillRect(14.5, 16, 1.3, 1.3); c.fillStyle = '#3f7d9a'; c.fillRect(17, 18.5, 1.3, 1.3); c.fillStyle = 'rgba(255,240,180,.35)'; c.beginPath(); c.arc(16, 17, 7, 0, 7); c.fill(); }
  },
  [W_PEGG_CH.hatch]: (c, P, r, e, v) => {
    const el = String(v || 'aether0').slice(0, -1), on = String(v || '').slice(-1) === '1', L = W_PEGG_LOOK[el] || W_PEGG_LOOK.aether;
    wShadow(c, 16, 28, 13, 3.5, .3);
    if (el === 'aether') { const g = pRR(5, 8, 22, 20, 2); wCel(c, g, 'rgba(207,228,240,.85)', 1, 1.1); wLine(c, [[16, 8], [16, 28]], .6, 'rgba(29,20,15,.5)'); wLine(c, [[5, 18], [27, 18]], .6, 'rgba(29,20,15,.5)'); wCel(c, pPoly([[3, 9], [16, 1], [29, 9]]), '#cfe4f0', 1, 1); }
    else if (el === 'bloom') { const s = new Path2D(); s.ellipse(16, 22, 12, 6, 0, 0, 7); wCel(c, s, L[0], 1, 1.2); const w = new Path2D(); w.ellipse(16, 21.5, 8, 3.6, 0, 0, 7); c.fillStyle = '#8ad0c0'; c.fill(w); c.fillStyle = 'rgba(255,255,255,.4)'; for (const x of [11, 16, 21]) c.fillRect(x, 10 + (x % 3) * 2, 1.2, 4); }
    else if (el === 'tide') { const s = wBlob(16, 22, 13, 7, r, 8); wCel(c, s, L[0], 1, 1.2); const w = new Path2D(); w.ellipse(16, 21, 8.5, 3.8, 0, 0, 7); c.fillStyle = '#2f6a8a'; c.fill(w); c.fillStyle = '#e06a8a'; c.fillRect(12, 20, 2, 2); c.fillStyle = '#f0c040'; c.fillRect(19, 21, 2, 1.6); }
    else if (el === 'ember') { const s = pRR(4, 6, 24, 22, 2); wCel(c, s, L[0], 1, 1.2); const n = pRR(9, 13, 14, 11, 3); c.fillStyle = '#5a1a0a'; c.fill(n); const g = c.createRadialGradient(16, 22, 1, 16, 22, 9); g.addColorStop(0, 'rgba(255,170,80,.9)'); g.addColorStop(1, 'rgba(255,90,30,0)'); c.fillStyle = g; c.fill(n); }
    else { const s = new Path2D(); s.moveTo(4, 28); s.lineTo(4, 16); s.quadraticCurveTo(16, 2, 28, 16); s.lineTo(28, 28); s.closePath(); wCel(c, s, L[0], 1, 1.2); const d = pRR(12, 18, 8, 10, 3); c.fillStyle = '#2a3a4a'; c.fill(d); }
    if (on) { const egg = pEl(16, 21, 3.4, 4.2); wCel(c, egg, '#f2e6c8', .8, 1); c.fillStyle = L[1]; c.globalAlpha = .35; c.beginPath(); c.arc(16, 21, 7, 0, 7); c.fill(); c.globalAlpha = 1; }
  },
});

/* ---------- Pell knows ---------- */
(() => {
  const P = DB.chars.pell; if (!P) return;
  P.topics.job.t += ' Pet eggs are something else again: ask me about PETS.';
  P.topics.pets = { t: `Pet eggs! Not my incubator: each one hatches at its own place, by its element. Graftonbury's glasshouse, the warm spring in Mossgate, a rock pool in Saltmere, the back wall of the Cinderhold forge, the ice-house in Rimewatch. One egg at a time in each, ${W_PEGG.days} days, and you name what comes out. Where are they? The alphas keep a few by their feet, and the rest are where you would least like to look.` };
})();

const wW133RenderHelp = renderHelp;
renderHelp = function () {
  wW133RenderHelp();
  const h = $('wHelpPets'); if (!h || $('wHelpPetEggs')) return;
  h.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpPetEggs"><b>Pet eggs.</b> A third kind of egg, found once a journey each: some in the alphas' rooms once they are beaten, others in quieter corners of the realm (one only after dark). Each hatches at one place, by its element: Graftonbury's glasshouse (aether), the Mossgate warm spring (bloom), a rock pool in Saltmere (tide), the Cinderhold forge's back wall (ember), the Rimewatch ice-house (rime). One egg at a time in each; it hatches in ${W_PEGG.days} days and you name it. A pet let go from there waits there, and you can take it back for nothing. Dr. Pell knows more.</p>`);
};
