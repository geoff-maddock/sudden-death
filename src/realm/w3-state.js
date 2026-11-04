/* w3: Realm world state (WG), time, movement, map transitions, interaction, NPC keyword talk.
   Ported from Terra Chimera part4a/4b (newGame, hour/advance/newDay, darkness, tileAt, tileVariant, npcAt, enterMap,
   tryMove, ambient, leaveToWorld, stepEnter, wanderNpcs, interact, doLook, doUse, giveLoot, say, runAct).
   No DOM here: the UI (w7) reads WG and the event queue WQ. Everything runs headless.

   Dropped from TC's state: roster, bin, research, eggs, rp (research data), know, cups, champion, chron, rivals, fed.
   Kept beyond the contract's list: energy (wells and Quill's enchanting, phase 4), harv (spent wells and bushes),
   xpk (topics already learned), club, hardcore (a lost match ends the save), grace (steps of calm after a transition).

   Phase 2: Sudden Death's RUN lives alongside WG. RUN is the team: RUN.party (who plays), RUN.deck, RUN.hp/maxhp,
   RUN.fans, and RUN.gold, the only purse (WG has no gold of its own). w5-bridge.js is the seam between the two.

   Later phases plug in through:
     wEncounterHook(region, tileCh, info?)   every step that would roll an encounter or road event; info is set for
                                             set pieces (alphas, lairs, the chapel bell, cups) that start a match.
   w5-bridge.js reassigns it to roll wild matches and start alpha matches. */
let WG = null;
let WLOG = [];
/* UI events from the model: talk opened, shop or inn wanted, map changed. w7 drains it every frame. */
const WQ = [];
const WSTEP_MIN = { world: 15, town: 2, dungeon: 5 };
const WREGROW = { V: 1, Y: 3, N: 4 };
const WDIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

function wEncounterHook(region, tileCh, info) { /* reassigned in w5-bridge.js: wild matches and alphas */ }

function wLog(t, c) { WLOG.push([t, c || '']); if (WLOG.length > 80) WLOG.shift(); WQ.push({ k: 'log' }); }
function wFlag(f) { return !!(WG && WG.flags[f]); }
function wSetFlag(f) { WG.flags[f] = 1; }
function wHas(id, n) { return (WG.items[id] || 0) >= (n || 1); }
function wAddItem(id, n) { WG.items[id] = (WG.items[id] || 0) + n; if (WG.items[id] <= 0) delete WG.items[id]; }
function wCap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

/* the default club on the new-journey draft (w6-party.js); the roster itself is WG.roster */
function wDefaultClub() { return CLUB_IDS[0]; }
/* who plays: Sudden Death's RUN.party is the source of truth */
function wParty() { return (RUN && RUN.party) || []; }

/* opts: { hardcore?, club?, picks?, roster?, relic? } (the draft's choices). Starts Sudden Death's run too: RUN holds the team, its deck, HP and the purse. */
function wNewGame(opts) {
  opts = opts || {};
  const club = CLUBS[opts.club] ? opts.club : wDefaultClub();
  WG = { v: 2, world: WORLD_VER, map: 'graftonbury', x: 5, y: 11, face: 'd', step: 0, year: 1, day: 1, dayAbs: 1, min: 8 * 60,
    flags: {}, items: { ration: 3, salve: 2, grain: 2, salt: 2 }, energy: { bloom: 0, ember: 0, tide: 0, rime: 0, aether: 0 },
    home: null, npc: {}, seen: {}, marks: [], harv: {}, xpk: {}, grace: 0, club, hardcore: !!opts.hardcore, blackouts: 0 };
  wNewRun(club, 120, opts);
  WLOG = [];
  wApplyNpcs(WG.map);
  wLog('Graftonbury. The League office is the building to the north-west. Walk into people to talk to them.', 'g');
  WQ.push({ k: 'map' });
  return WG;
}

/* ---------- time ---------- */
/* Sudden Death's newRun for the realm: no act map (the realm is the map), and the realm's starting purse */
function wNewRun(club, gold, o) {
  o = o || {};
  newRun(club, o.picks && o.picks.length === 3 ? o.picks : [0, 1, 2], o.roster || undefined, o.relic || undefined);
  RUN.map = null; RUN.path = []; RUN.gold = gold;
  return RUN;
}

function wHour() { return WG.min / 60; }
function wAdvance(min) { WG.min += min; while (WG.min >= 1440) { WG.min -= 1440; wNewDay(); } }
function wNewDay() {
  WG.day++; WG.dayAbs++;
  if (WG.day > DB.meta.yearDays) { WG.day = 1; WG.year++; wLog('A new year. The brackets are wiped clean; your cups stay on the wall.', 'g'); }
  if (wChampWeek() && WG.day === DB.meta.yearDays - DB.meta.champWeek + 1) wLog('Championship week has begun at the Crown Coliseum.', 'g');
  // regrown wells and bushes change how they are drawn
  wInvalidate();
}
function wChampWeek() { return WG.day > DB.meta.yearDays - DB.meta.champWeek; }
function wDaysToChamp() { return Math.max(0, DB.meta.yearDays - DB.meta.champWeek + 1 - WG.day); }
function wSeason() { return ['Spring', 'Summer', 'Autumn', 'Winter'][Math.min(3, Math.floor((WG.day - 1) / 28))]; }
function wTimeStr() { const h = Math.floor(WG.min / 60), mm = WG.min % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
function wPartOfDay() { const h = wHour(); return h < 5 ? 'Night' : h < 7 ? 'Dawn' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 20 ? 'Evening' : 'Night'; }
// 0 by day, up to .62 at night (TC's numbers); dungeons are dark whatever the hour (the renderer handles that)
function wDarkness() { const h = wHour(); if (h >= 7 && h < 18) return 0; if (h >= 18 && h < 21) return (h - 18) / 3 * .62; if (h >= 5 && h < 7) return (7 - h) / 2 * .62; return .62; }
function wIsNight() { return wDarkness() > .3; }

/* ---------- maps ---------- */
function wCurMap() { return MAPS[WG.map]; }
function wHkey(x, y, map) { return (map || WG.map) + ':' + x + ',' + y; }
function wDepleted(x, y, days, map) { const d = WG.harv[wHkey(x, y, map)]; return d != null && WG.dayAbs - d < days; }
/* what is really on a tile: hidden places look like the ground until a clue reveals them; beaten alphas leave floor */
function wTileAt(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return map.kind === 'dungeon' ? 'X' : null;
  const c = map.t[y][x];
  if (!WG) return c;
  if (c === 'M') { const m = map.meta[x + ',' + y]; if (m && wFlag('alpha_' + m.alpha)) return 'g'; }
  if (map.kind === 'world') { const m = map.meta[x + ',' + y]; if (m && m.loc) { const L = DB.locs.find(l => l.id === m.loc); if (L && L.hidden && !wFlag(L.hidden)) return m.under || '.'; } }
  return c;
}
/* '0' = spent well, picked bush, empty nest, opened chest, beaten lair */
function wTileVariant(map, x, y, c) {
  const m = map.meta[x + ',' + y] || {};
  if (!WG) return null;
  if (c === 'V') return (m.elem || 'aether') + (wDepleted(x, y, 1, map.id) ? '0' : '');
  if (c === 'Y') return wDepleted(x, y, 3, map.id) ? '0' : (m.elem || 'bloom');
  if (c === 'N') return wDepleted(x, y, 4, map.id) ? '0' : '1';
  if (c === 'C') return wFlag('chest_' + m.chest) ? '0' : '1';
  if (c === 'Z') { const L = DB.locs.find(l => l.id === m.loc); return L && wFlag('alpha_' + L.alpha) ? '0' : '1'; }
  return '1';
}
function wNpcAt(x, y) { const m = wCurMap(); return (m.npcs || []).find(n => n.x === x && n.y === y); }
function wChar(id) { const c = DB.chars[id]; if (!c) return { name: 'Somebody', greet: '...', topics: {}, kind: 'goblin' }; const o = Object.assign({}, c); if (typeof o.name === 'string' && o.name[0] === '@') o.name = 'A rival captain'; return o; }
/* NPC positions live in WG.npc so wandering survives a save */
function wApplyNpcs(id) { const m = MAPS[id], s = WG.npc[id]; if (!m || !s) return; m.npcs.forEach((n, i) => { if (s[i]) { n.x = s[i][0]; n.y = s[i][1]; } }); }
function wStoreNpcs(id) { const m = MAPS[id]; if (m && m.kind === 'town' && m.npcs.some(n => !n.fixed)) WG.npc[id] = m.npcs.map(n => [n.x, n.y]); }
function wRegionHere() {
  const m = wCurMap();
  if (m.kind === 'world') return regionAt(WG.x, WG.y);
  const L = DB.locs.find(l => l.map === m.id);
  return L ? regionAt(L.x, L.y) : 'plains';
}
function wEnterMap(id, x, y) {
  wStoreNpcs(WG.map);
  WG.map = id; WG.x = x; WG.y = y; WG.grace = 4; WG.bump = null;
  wApplyNpcs(id);
  WQ.push({ k: 'map' });
  if (typeof wSave === 'function') wSave();
}
function wLookText(x, y) {
  const m = wCurMap(), c = wTileAt(m, x, y);
  if (c == null) return 'The way out of town.';
  const mm = m.meta[x + ',' + y]; if (mm && mm.look) return mm.look;
  const n = wNpcAt(x, y); if (n) return wChar(n.id).name + '.';
  const td = DB.tiles[c] || {}, v = wTileVariant(m, x, y, c);
  return (String(v).endsWith('0') && td.look0) || td.look || 'Ground.';
}
function wFacing() { const [dx, dy] = WDIRS[WG.face] || [0, 1]; return [WG.x + dx, WG.y + dy]; }

/* ---------- movement ---------- */
/* one step. Returns true if the party moved (or changed map). Walking into somebody talks to them; a second bump
   squeezes past anyone who is not behind a counter. Walking into a usable tile uses it. */
function wTryMove(dx, dy) {
  if (!WG) return false;
  const m = wCurMap();
  WG.face = dx < 0 ? 'l' : dx > 0 ? 'r' : dy < 0 ? 'u' : 'd';
  const nx = WG.x + dx, ny = WG.y + dy, c = wTileAt(m, nx, ny);
  if (c == null) { if (m.kind === 'town') { wLeaveToWorld(); return true; } return false; }
  const n = wNpcAt(nx, ny);
  if (n) {
    if (WG.bump === n.id) {
      WG.bump = null;
      if (n.fixed) wLog(wChar(n.id).name + ' will not budge.', 'd');
      else { const ox = WG.x, oy = WG.y; WG.x = nx; WG.y = ny; n.x = ox; n.y = oy; WG.step++; wAdvance(2); wLog('You squeeze past ' + wChar(n.id).name + '.', 'd'); return true; }
    } else { WG.bump = n.id; wTalkTo(n.id); }
    return false;
  }
  let td = DB.tiles[c] || {};
  // cut off behind a counter (an old save, or a bug): you can always climb over it to get back out
  if (c === '-' && m.kind === 'town' && !bfsReach(m, m.spawn[0], m.spawn[1])[WG.y * m.w + WG.x]) { td = { walk: 1 }; wLog('You climb over the counter.', 'd'); }
  if (!td.walk) { if (td.use) wUse(nx, ny); return false; }
  WG.bump = null;
  const preReg = m.kind === 'world' ? regionAt(WG.x, WG.y) : null;
  WG.x = nx; WG.y = ny; WG.step++;
  wAdvance(WSTEP_MIN[m.kind] || 2);
  wWanderNpcs(); wAmbient(m, preReg);
  if (td.enter) { wStepEnter(c, nx, ny); return true; }
  if (WG.grace > 0) WG.grace--;
  else if (m.kind !== 'town') wEncounterHook(wRegionHere(), c);
  return true;
}
function wAmbient(m, preReg) {
  if (m.kind === 'world') {
    const rg = regionAt(WG.x, WG.y), R = DB.regions[rg];
    if (R && rg !== preReg) { wLog(R.arrive, 'd'); return; }
    if (R && R.ambient && WG.step % 11 === 0 && Math.random() < .35) wLog(pick(R.ambient), 'd');
    return;
  }
  if (m.kind === 'town') { const t = DB.towns.find(t => t.id === m.id); if (t && t.ambient && WG.step % 9 === 0 && Math.random() < .4) wLog(pick(t.ambient), 'd'); }
}
function wLeaveToWorld() {
  const L = DB.locs.find(l => l.map === WG.map); if (!L) return;
  wEnterMap('world', L.x, L.y + 1); WG.face = 'd';
  wLog('You leave ' + L.name + '.', 'd');
}
function wStepEnter(c, x, y) {
  const m = wCurMap();
  if (c === '<') { wLeaveToWorld(); return; }
  const meta = m.meta[x + ',' + y], L = meta && DB.locs.find(l => l.id === meta.loc);
  if (!L) return;
  if (L.key && !wHas(L.key)) { wLog(L.name + '. A slab door with a card slot. It wants a ' + DB.items[L.key].name + '.', 'b'); WG.y += 1; return; }
  const mp = MAPS[L.map]; if (!mp) return;
  if (!WG.flags['seen_' + L.id]) wSetFlag('seen_' + L.id);
  wEnterMap(L.map, mp.spawn[0], mp.spawn[1]); WG.face = 'u';
  const td = DB.towns.find(t => t.id === L.map);
  wLog(td && td.arrive ? td.arrive : L.name + '.', 'g');
}
function wWanderNpcs() {
  const m = wCurMap(); if (m.kind !== 'town' || WG.step % 3) return;
  for (const n of m.npcs) {
    if (n.fixed || Math.random() < .5) continue;
    n.hx = n.hx == null ? n.x : n.hx; n.hy = n.hy == null ? n.y : n.hy;
    const [dx, dy] = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]), x = n.x + dx, y = n.y + dy, c = wTileAt(m, x, y);
    const nearDoor = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => wTileAt(m, x + ax, y + ay) === '+');
    if (c && DB.tiles[c].walk && !DB.tiles[c].enter && !nearDoor && !wNpcAt(x, y) && !(x === WG.x && y === WG.y) && Math.abs(x - n.hx) + Math.abs(y - n.hy) <= 2) { n.px = n.x; n.py = n.y; n.mt = performance.now(); n.x = x; n.y = y; }
  }
  wStoreNpcs(m.id);
}
/* the first step of a shortest walk to (tx, ty), for click/tap to move. A blocked target (a person, a sign, a
   counter) is walked up to, and the last step bumps into it. Returns [dx, dy] or null. */
function wPathStep(tx, ty) {
  const m = wCurMap(); if (tx === WG.x && ty === WG.y) return null;
  const R = 40, W = m.w, H = m.h;
  const free = (x, y) => { const c = wTileAt(m, x, y); if (c == null) return m.kind === 'town'; const td = DB.tiles[c]; return !!(td && td.walk) && !wNpcAt(x, y); };
  const goal = (x, y) => x === tx && y === ty;
  const key = (x, y) => (y + 1) * (W + 2) + (x + 1);
  const prev = new Map(), q = [[WG.x, WG.y]]; prev.set(key(WG.x, WG.y), null);
  for (let qi = 0; qi < q.length && qi < 6000; qi++) {
    const [x, y] = q[qi];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || Math.abs(nx - WG.x) > R || Math.abs(ny - WG.y) > R || nx < -1 || ny < -1 || nx > W || ny > H) continue;
      if (goal(nx, ny)) { prev.set(k, [x, y]); let cur = [nx, ny]; while (true) { const p = prev.get(key(cur[0], cur[1])); if (!p || (p[0] === WG.x && p[1] === WG.y)) return [cur[0] - WG.x, cur[1] - WG.y]; cur = p; } }
      if (!free(nx, ny)) continue;
      // never path through an entrance on the way somewhere else
      const c = wTileAt(m, nx, ny); if (c && DB.tiles[c] && DB.tiles[c].enter) continue;
      if (c == null) continue;
      prev.set(k, [x, y]); q.push([nx, ny]);
    }
  }
  return null;
}

/* ---------- interaction ---------- */
function wInteract() {
  const [x, y] = wFacing(), n = wNpcAt(x, y);
  if (n) return wTalkTo(n.id);
  const m = wCurMap(), c = wTileAt(m, x, y);
  if (c && DB.tiles[c] && DB.tiles[c].use) return wUse(x, y);
  wLog(wLookText(x, y), 'd');
}
function wLook() { const [x, y] = wFacing(); wLog(wLookText(x, y), 'd'); }
/* verbs on tiles: the table is DB.tiles[..].use */
function wUse(x, y) {
  const m = wCurMap(), c = wTileAt(m, x, y), use = (DB.tiles[c] || {}).use, meta = m.meta[x + ',' + y] || {};
  switch (use) {
    case 'counter': { const dx = x - WG.x, dy = y - WG.y, n = wNpcAt(x + dx, y + dy); if (n) wTalkTo(n.id); else wLog(wLookText(x, y), 'd'); break; }
    case 'sign': wLog((c === 'S' ? 'The sign reads: ' : c === 'P' ? 'The painting: ' : c === 'K' ? 'On the shelf: ' : c === 't' ? 'In the case: ' : '') + (meta.text || '...'), 'g'); break;
    case 'wall': wWallText(); break;
    case 'eggs': wLog(wLookText(x, y), 'd'); break; // dropped: eggs (TC's incubator)
    case 'well': {
      if (wDepleted(x, y, 1)) return wLog(DB.tiles.V.look0, 'd');
      const n = ri(2, 3), e = meta.elem || 'aether';
      WG.energy[e] = (WG.energy[e] || 0) + n; WG.harv[wHkey(x, y)] = WG.dayAbs; wAdvance(20); wInvalidate(WG.map);
      wLog('You draw ' + n + ' ' + DB.elems.names[e] + ' energy from the well. The enchanter can bind it into your team later.', 'm'); break;
    }
    case 'bush': {
      if (wDepleted(x, y, 3)) return wLog(DB.tiles.Y.look0, 'd');
      const it = DB.forage[meta.elem || 'aether'] || 'aethercap', n = ri(2, 3);
      wAddItem(it, n); WG.harv[wHkey(x, y)] = WG.dayAbs; wAdvance(20); wInvalidate(WG.map);
      wLog('You pick ' + n + ' ' + DB.items[it].name + '.', 'm'); break;
    }
    case 'nest': // dropped: eggs. Nests are scenery.
      if (meta.alpha && !wFlag('alpha_' + meta.alpha)) return wLog('The alpha will not let you near its nest.', 'b');
      wLog(wDepleted(x, y, 4) ? DB.tiles.N.look0 : DB.tiles.N.look + ' Whatever lives here is out.', 'd'); break;
    case 'chest': {
      const id = meta.chest; if (wFlag('chest_' + id)) return wLog(DB.tiles.C.look0, 'd');
      const dg = DB.dungeons.find(d => d.id === m.id);
      if (/_prize$/.test(id) && dg && !wFlag('alpha_' + dg.alpha)) return wLog('The alpha stands between you and the strongbox.', 'b');
      wGiveLoot(DB.chests[id] || { gold: 40 }); wSetFlag('chest_' + id); wInvalidate(WG.map); break;
    }
    case 'alpha': { const a = DB.alphas[meta.alpha] || { name: 'the alpha' }; wLog(wCap(a.name) + ' watches you, and wants a game.', 'b'); wEncounterHook(wRegionHere(), c, { kind: 'alpha', alpha: meta.alpha }); break; }
    case 'bell': {
      const rg = meta.ring; if (!rg) return wLog(wLookText(x, y), 'd');
      if (!wHas(rg.item)) return wLog('A great bronze bell, silent. You have nothing that would make it ring true.', 'd');
      if (rg.night && wDarkness() < .3) return wLog('You strike the bell. In daylight the note just dies in the snow. Come back after dark.', 'd');
      wLog('You strike the bell with the rod. The note goes up, and up, and the lights shiver. Nothing comes down tonight.', 'g');
      wEncounterHook(wRegionHere(), c, { kind: 'bell', ring: rg }); break;
    }
    case 'lair': {
      const L = DB.locs.find(l => l.id === meta.loc); if (!L) break;
      // a lair has no map to walk into, so reaching its door is seeing it (Ingrith's ROOST needs seen_auroraroost)
      if (!WG.flags['seen_' + L.id]) wSetFlag('seen_' + L.id);
      if (wFlag('alpha_' + L.alpha)) return wLog(DB.tiles.Z.look0, 'd');
      wLog(L.name + '. ' + wCap((DB.alphas[L.alpha] || {}).name || 'something big') + ' is home, and wants a game.', 'b');
      wEncounterHook(wRegionHere(), c, { kind: 'lair', loc: L.id, alpha: L.alpha }); break;
    }
    default: wLog(wLookText(x, y), 'd');
  }
}
function wGiveLoot(l) {
  const bits = [];
  if (l.gold) { RUN.gold += l.gold; bits.push(l.gold + ' gold'); }
  for (const k in l.items || {}) { wAddItem(k, l.items[k]); bits.push(l.items[k] + ' ' + DB.items[k].name); }
  const cards = [].concat(l.card || [], l.cards || []);
  if (cards.length) bits.push(cards.length === 1 ? 'a card' : cards.length + ' cards');
  if (l.cardChoice) bits.push('a choice of cards');
  wLog('Inside: ' + (bits.join(', ') || 'dust') + '.', 'g');
  wPayCards(l, 'found in a strongbox');
}
/* card payouts on loot and topics: card: id, cards: [ids], cardChoice: { pick, rarity?, kind?, pool? }.
   wGainCard (w5-bridge.js) adds them to RUN.deck, or opens the pick-one panel for a choice. */
function wPayCards(src, why) {
  if (typeof wGainCard !== 'function') return;
  for (const id of [].concat(src.card || [], src.cards || [])) wGainCard(id, why);
  if (src.cardChoice) wGainCard(src.cardChoice, why);
}
function wWallText() {
  const won = Object.keys(DB.cups).filter(c => wFlag(DB.cups[c].flag));
  wLog(won.length ? 'The Wall of Awards. Your cups: ' + won.map(c => DB.cups[c].name).join(', ') + '.' : 'The Wall of Awards. There are hooks waiting for cups, and none of them are yours yet.', 'g');
}

/* ---------- conversation: wSay() is the model, the talk panel in w7 the view ---------- */
function wFindTopic(ch, kw) { const ks = Object.keys(ch.topics || {}); return ks.find(k => k === kw) || (kw.length >= 4 ? ks.find(k => k.startsWith(kw.slice(0, 4))) : null); }
function wTopicBlocked(t) {
  if (t.need && [].concat(t.need).some(f => !wFlag(f))) return true;
  if (t.needNight && wDarkness() < .3) return true;
  if (t.takeEn && Object.keys(t.takeEn).some(e => (WG.energy[e] || 0) < t.takeEn[e])) return true;
  if (t.take && !Object.keys(t.take).every(k => wHas(k, t.take[k]))) return true;
  return false;
}
/* returns { text, act? }. text null means goodbye. */
function wSay(id, kw) {
  const ch = wChar(id); kw = (kw || '').trim().toLowerCase();
  if (!kw) return { text: ch.greet };
  if (kw === 'name') return { text: 'I am ' + ch.name + '.' };
  if (kw === 'bye') return { text: null };
  const key = wFindTopic(ch, kw);
  if (!key) return { text: pick(['I could not tell you about that.', 'Not my department.', 'You would have to ask somebody else.']) };
  const t = ch.topics[key];
  if (t.once && wFlag(t.once)) return { text: t.t2 || t.t, key };
  if (wTopicBlocked(t)) return { text: t.needNo || 'Not yet.', key };
  for (const k in t.take || {}) { wAddItem(k, -t.take[k]); wLog('Handed over ' + t.take[k] + ' ' + DB.items[k].name + '.', 'd'); }
  for (const e in t.takeEn || {}) WG.energy[e] -= t.takeEn[e];
  for (const k in t.give || {}) { wAddItem(k, t.give[k]); wLog('Received ' + t.give[k] + ' ' + DB.items[k].name + '.', 'm'); }
  for (const k in t.giveEn || {}) { WG.energy[k] = (WG.energy[k] || 0) + t.giveEn[k]; wLog('Received ' + t.giveEn[k] + ' ' + DB.elems.names[k] + ' energy.', 'm'); }
  if (t.gold) { RUN.gold += t.gold; wLog('Received ' + t.gold + ' gold.', 'm'); }
  wPayCards(t, 'from ' + ch.name);
  if (t.recruit && typeof wRecruitTopic === 'function') wRecruitTopic(t.recruit); // a quest companion (w6-party.js)
  if (t.set) { wSetFlag(t.set); wInvalidate('world'); } // a clue can reveal a hidden place on the world map
  if (t.once) { wSetFlag(t.once); const sp = DB.sideplots.find(s => s.id === t.once); if (sp) wLog('Done: ' + sp.title + '.', 'g'); }
  if (t.xp && !WG.xpk[id + ':' + key]) WG.xpk[id + ':' + key] = 1; // dropped: TC paid research data here
  return { text: t.t, act: t.act, key };
}
function wTalkTo(id) {
  const r = wSay(id, '');
  wAdvance(1);
  WQ.push({ k: 'talk', id, text: r.text });
}
/* acts a topic can trigger. The UI calls this after showing the topic's line. */
function wRunAct(act, id) {
  if (!act) return;
  const ch = wChar(id);
  if (act === 'shop') { WQ.push({ k: 'shop', id, shop: ch.shop || 'general', who: ch.name }); return; }
  if (act === 'inn') { WQ.push({ k: 'inn', id, price: ch.inn || 12, who: ch.name }); return; }
  if (act === 'wall') { wWallText(); return; }
  if (act === 'waitweek') { wLog(wWaitForWeek(), 'g'); return; }
  // cup:<id> is handled by w11-cups.js, which wraps this function
  wLog('Nothing happens.', 'd');
}

/* ---------- shops and inns ---------- */
function wSellPrice(id) { const it = DB.items[id]; return it && it.price ? Math.max(1, Math.floor(it.price / 2)) : 0; }
function wBuy(shop, id) { const pr = (DB.shops[shop] || {})[id]; if (pr == null) return 'Not sold here.'; if (RUN.gold < pr) return 'You cannot afford that.'; RUN.gold -= pr; wAddItem(id, 1); return ''; }
function wSell(id) { const pr = wSellPrice(id); if (!pr || !wHas(id)) return 'Nobody wants that.'; wAddItem(id, -1); RUN.gold += pr; return ''; }
/* a night at an inn: morning comes, the team is fully healed, and this town becomes where you wake if a match goes badly */
function wSleepInn(price) {
  if (RUN.gold < price) return 'You cannot afford a room.';
  RUN.gold -= price;
  wAdvance((24 * 60 - WG.min) + 7 * 60);
  RUN.hp = RUN.maxhp;
  if (wCurMap().kind === 'town') WG.home = WG.map;
  wLog('You sleep, and your team is back to full health. It is morning, and you will wake here if a match goes badly.', 'm');
  if (typeof wSave === 'function') wSave();
  return '';
}
function wWaitForWeek() {
  if (wChampWeek()) return 'It is championship week already.';
  const days = wDaysToChamp();
  wAdvance(days * 1440 - WG.min + 8 * 60);
  return 'You wait out ' + days + ' day' + (days === 1 ? '' : 's') + ' in the guest rooms. Championship week has begun.';
}
