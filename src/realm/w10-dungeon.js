/* w10: dungeons and magic gear (phase 5). Loads after w9b; changes earlier parts only by reassignment.

   Gauntlets. Some rooms of each dungeon hold a famous team (W_FAMOUS). Walking into one of those rooms from outside
   starts an elite match against them: an ELITE_TRAITS scouting report always, a sport perk and high stakes more often
   the deeper the room, and a level step per depth (W_DUNGEON.depthLv). A won room is flagged room_<dungeon>_<n> in
   WG.flags and stays beaten. The rooms themselves come from the dungeon map (MAPS[id].rooms, deterministic), ordered
   by walking distance from the stairs, so nothing but the flags goes into the save.
   The alpha in the deepest room plays only a team that has beaten every room, and it is a Sudden Death boss
   (W_ALPHA_BOSS, the boss's brain and phases, led by the alpha's name). The two lairs' alphas are bosses too.

   Magic gear. W_MAGIC is the drop table: a prize strongbox (DB.chests[..].magic) or a lair win pays a Sudden Death
   trophy (gainRelic), a gear card (gr_*, via wGainCard) and, for the deep ones, a pick of Hall of Fame legends.
   A won room may also drop a gear card (W_DUNGEON.roomGear).

   Gating. W_GATE: a dungeon door wants a number of cups won (wCupsWon, w9; phase 6 sets the cup flags) and/or a key
   item, and says plainly what is missing. Lairs are in the table too.

   Skipped (still not built): the Frozen Chapel bell companion and TC's stray event. See CONTRACT.md, phase 5.

   Realm functions wrapped: wTryMove (rooms), wEncounterHook (no wild roll on the step into a room), wStepEnter (the
   gate, and a line on arrival), wStartAlpha (bosses), wNameLead (the boss takes the alpha's name), wLevelInfo (depth),
   wMatchTeam (famous team colours), wMatchTitle and wPreGame (room and boss lines), wGiveLoot (magic drops),
   W_ON_END.lair (the lair drop); renderHelp (a dungeon section). Adds W_ON_END.room. */

/* ---------- the numbers: one table for phase 7 to tune ---------- */
const W_DUNGEON = {
  depthLv: [0, 1, 1, 2],                  // extra level per room depth (index = depth, the last one repeats)
  perkOdds: [0, .6, 1, 1],                // chance a room forces a sport perk (if SD's own roll gave none)
  stakesOdds: [0, .3, .6, 1],             // chance a room is played for high stakes
  softTraitsTo: 0,                        // the Rattled trait (a soft target) only in rooms up to this depth
  roomGear: .35,                          // chance a won room also drops a gear card
  alphaNeedsRooms: true,                  // the alpha only plays a team that has beaten every room
};
const W_GATE = {                          // cups: cups won; key: an item in WG.items; hint: where the key is
  hatchery: { cups: 1 },
  emberdeep: { cups: 1 },
  genevault: { cups: 2, key: 'keycard', hint: 'ask Gant Vesper in Graftonbury about the VAULT' },
  deepseam: { cups: 3 },
  eldergrove: { cups: 0 },
  auroraroost: { cups: 1 },
};
const W_ALPHA_BOSS = {                    // the Sudden Death boss each alpha plays as, and its tier
  hatchmother: { boss: 'cube', tier: 2 },        // the Hatch-Mother: splits in two at half health
  emberqueen: { boss: 'kqueen', tier: 2 },       // the Warren Queen: shielded by her squad
  vaultwarden: { boss: 'mirror', tier: 3 },      // Captain Nought: your own captain, copied
  seamwyrm: { boss: 'wyrm', tier: 3 },           // the Seam Wyrm
  grove: { boss: 'groundskeeper', tier: 2 },     // the Elder of the Grove: has kept this ground for ever
  aurora: { boss: 'banshee', tier: 2 },          // the Aurora Matriarch: the wail the bells were cast against
};
const W_MAGIC = {                         // relic: trophy rarity ('c'|'u'|'r'); gear: gear cards; legend: a pick of N
  hatchery_prize: { relic: 'u', gear: 1 },
  emberdeep_prize: { relic: 'u', gear: 1 },
  genevault_prize: { relic: 'r', gear: 1, legend: 3 },
  deepseam_prize: { relic: 'r', gear: 1, legend: 3 },
  grove: { relic: 'u', legend: 3 },              // lairs have no strongbox: the win pays
  aurora: { relic: 'r', gear: 1, legend: 3 },
};
/* the famous teams, room by room, shallowest first: [name, short, colour, light] */
const W_FAMOUS = {
  hatchery: [['The Drowned Eleven', 'DRN', '#235c9c', '#bfe3ff'], ['The Brood Tide', 'BRD', '#2f7f7a', '#c8f0e8'], ['The Shell Game', 'SHL', '#8a6a3c', '#f0e0c0']],
  emberdeep: [['The Cinder Saints', 'CSA', '#a83a1e', '#ff9a7a'], ['Slag Heap United', 'SLG', '#5a4a3a', '#e0c8a8'], ["The Queen's Guard", 'QGD', '#c0392b', '#ffd0c0']],
  genevault: [['The Old Guard', 'OLD', '#3a6f8f', '#d0ecff'], ['The Sealed Six', 'SIX', '#6a4a9c', '#e0d0ff'], ['Lockdown United', 'LCK', '#a08010', '#fff3b0'], ['Apex Prototypes', 'APX', '#2a1f3a', '#b494ff']],
  deepseam: [['The Seam Splitters', 'SEA', '#8a3a1e', '#ffb08a'], ['Deep Shift', 'DSH', '#4a3a2a', '#e0c8a0'], ['The Glassheart Few', 'GLS', '#3a8a8a', '#c0fff8']],
};
const W10 = { rooms: {}, hold: false, depth: null };
for (const k in W_MAGIC) if (DB.chests[k]) DB.chests[k].magic = k;

/* ---------- the rooms of a dungeon (from the map, cached; never saved) ---------- */
function wDungeonRooms(id) {
  if (W10.rooms[id]) return W10.rooms[id];
  const m = MAPS[id], fam = W_FAMOUS[id];
  if (!m || m.kind !== 'dungeon' || !m.rooms || !fam) return (W10.rooms[id] = []);
  const w = m.w, dist = new Int32Array(m.w * m.h).fill(-1), s = m.rooms[0], q = [[s.cx, s.cy]];
  dist[s.cy * w + s.cx] = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const [x, y] = q[qi];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, i = ny * w + nx; if (m.t[ny] && m.t[ny][nx] && m.t[ny][nx] !== 'X' && dist[i] < 0) { dist[i] = dist[y * w + x] + 1; q.push([nx, ny]); } }
  }
  const mid = m.rooms.filter(r => r !== s && r !== m.far).sort((a, b) => dist[a.cy * w + a.cx] - dist[b.cy * w + b.cx]);
  const n = Math.min(fam.length, mid.length), out = [];
  for (let d = 0; d < n; d++) {
    const r = mid[n === mid.length ? d : Math.round(d * (mid.length - 1) / Math.max(1, n - 1))], f = fam[d];
    out.push({ dg: id, d, n, x: r.x, y: r.y, w: r.w, h: r.h, cx: r.cx, cy: r.cy, flag: `room_${id}_${d + 1}`, team: { name: f[0], short: f[1], color: f[2], light: f[3] } });
  }
  return (W10.rooms[id] = out);
}
function wRoomAt(id, x, y) { return wDungeonRooms(id).find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) || null; }
function wRoomsLeft(id) { return wDungeonRooms(id).filter(r => !wFlag(r.flag)); }
function wDepthOf(tbl, d) { return tbl[Math.min(d, tbl.length - 1)]; }
/* the line you get when you walk into a dungeon */
function wDungeonBrief(id) {
  const R = wDungeonRooms(id), left = wRoomsLeft(id), dg = DB.dungeons.find(d => d.id === id), a = dg && DB.alphas[dg.alpha];
  if (!R.length) return '';
  if (dg && wFlag('alpha_' + dg.alpha)) return `${dg.name}: every room is beaten, and ${a ? a.name : 'the alpha'} is gone.`;
  if (!left.length) return `${dg.name}: every room is beaten. ${a ? wCap(a.name) : 'The alpha'} waits in the deepest room.`;
  return `${dg.name}: ${left.length} of ${R.length} rooms still hold famous teams. Beat them all, and ${a ? a.name : 'the alpha'} in the deepest room will play you.`;
}

/* ---------- the gate ---------- */
/* { ok, need: [what is missing], text } for a location id */
function wGateCheck(locId) {
  const G = W_GATE[locId], L = DB.locs.find(l => l.id === locId);
  if (!G || !L) return { ok: true, need: [], text: '' };
  const need = [], have = wCupsWon();
  if (G.cups && have < G.cups) need.push(`${G.cups} cup${G.cups === 1 ? '' : 's'} won (you have ${have})`);
  if (G.key && !wHas(G.key)) need.push(`the ${DB.items[G.key].name}${G.hint ? ' (' + G.hint + ')' : ''}`);
  return { ok: !need.length, need, text: need.length ? `${L.name} is shut to you. You need ${need.join(' and ')}.` : '' };
}
const wW10StepEnter = wStepEnter;
wStepEnter = function (c, x, y) {
  const m = wCurMap(), meta = m.meta[x + ',' + y], L = meta && DB.locs.find(l => l.id === meta.loc);
  if (L && L.kind === 'dungeon') {
    const g = wGateCheck(L.id);
    if (!g.ok) { wLog(g.text, 'b'); WG.y += 1; return; }
  }
  wW10StepEnter(c, x, y);
  if (L && L.kind === 'dungeon' && WG.map === L.map) { const t = wDungeonBrief(L.map); if (t) wLog(t, 'g'); }
};

/* ---------- walking into a room ---------- */
const wW10TryMove = wTryMove;
wTryMove = function (dx, dy) {
  if (!WG || wCurMap().kind !== 'dungeon') return wW10TryMove(dx, dy);
  const id = WG.map, from = wRoomAt(id, WG.x, WG.y), to = wRoomAt(id, WG.x + dx, WG.y + dy);
  const fresh = to && to !== from && !wFlag(to.flag) ? to : null;
  W10.hold = !!fresh;
  let moved;
  try { moved = wW10TryMove(dx, dy); } finally { W10.hold = false; }
  if (moved && fresh && WG.map === id && wRoomAt(id, WG.x, WG.y) === fresh) wStartRoom(fresh);
  return moved;
};
const wW10EncounterHook = wEncounterHook;
wEncounterHook = function (region, tileCh, info) {
  if (W10.hold && !info) return; // the step into a room meets its team, not a wild one
  if (info && (info.kind === 'alpha' || info.kind === 'lair') && !wAlphaReady(info)) return;
  return wW10EncounterHook(region, tileCh, info);
};
/* start a room's match; returns the encounter. o.card: false kicks off without the pre-game card (tests) */
function wStartRoom(R, o) {
  if (!R || wFlag(R.flag) || !WG || !RUN) return null;
  o = o || {};
  const traits = Object.keys(ELITE_TRAITS).filter(t => R.d <= W_DUNGEON.softTraitsTo || ELITE_TRAITS[t].risk > 0);
  const m = { type: 'elite', tier: wTierHere(), trait: o.trait || pick(traits), world: { kind: 'room', ref: { dg: R.dg, room: R.d + 1 } } };
  if (o.stakes || Math.random() < wDepthOf(W_DUNGEON.stakesOdds, R.d)) m.stakes = o.stakes || pick(Object.keys(STAKES));
  let enc;
  W10.depth = R.d;
  try { enc = wBuildEncounter(m); } finally { W10.depth = null; }
  const W = enc.world;
  W.fam = Object.assign({}, R.team); W.room = R.d + 1; W.rooms = R.n;
  W.dgName = (DB.dungeons.find(d => d.id === R.dg) || {}).name || '';
  if (o.perk || Math.random() < wDepthOf(W_DUNGEON.perkOdds, R.d)) W.perk = o.perk || pick(Object.keys(SPORT_PERKS));
  WUI.held = null; WUI.goto = null;
  if (o.card === false || LAB) wKickoff(enc); else wPreGame(enc);
  return enc;
}
/* depth adds levels, with the reason on the card */
const wW10LevelInfo = wLevelInfo;
wLevelInfo = function (night) {
  const L = wW10LevelInfo(night);
  if (W10.depth == null) return L;
  const add = wDepthOf(W_DUNGEON.depthLv, W10.depth);
  if (add) { L.lv = Math.min(W_ROAD.maxLv, L.lv + add); L.why.push(`room ${W10.depth + 1}, deeper down`); }
  return L;
};
const wW10MatchTeam = wMatchTeam;
wMatchTeam = function (W) { return W && W.kind === 'room' && W.fam ? W.fam : wW10MatchTeam(W); };
/* a forced perk, when Sudden Death's own roll gave none (its hook ran first) */
onHook('fightStart', () => {
  if (!WG || !RUN || !B || !B.sc || !RUN.pending || !RUN.pending.world) return;
  const W = RUN.pending.world;
  if (W.kind !== 'room' || !W.perk || B.sp) return;
  const al = alive(); if (!al.length) return;
  const e = pick(al), id = W.perk;
  e.sp = id; B.sp = id;
  fx({ k: 'banner', t: `${e.n.split(',')[0]}: ${SPORT_PERKS[id].n}`, sub: SPORT_PERKS[id].desc, small: 1 });
  log(`Scouting report: ${e.n.split(',')[0]} is ${/^[AEIOU]/.test(SPORT_PERKS[id].n) ? 'an' : 'a'} ${SPORT_PERKS[id].n.toLowerCase()}. ${SPORT_PERKS[id].desc}`, 'bad');
  if (id === 'headstart' && SPORT_UNIT[B.sport]) { B.sc.them += SPORT_UNIT[B.sport]; momentumCheck(); }
});
W_ON_END.room = function (r, ref, W) {
  if (!ref) return;
  const R = wDungeonRooms(ref.dg)[ref.room - 1]; if (!R) return;
  const name = (W.fam && W.fam.name) || 'The famous team';
  if (r !== 'win') { wLog(`${name} still hold room ${ref.room}.`, 'd'); return; }
  wSetFlag(R.flag);
  const left = wRoomsLeft(ref.dg).length;
  wLog(`${name} are beaten. Room ${ref.room} is yours${left ? `; ${left} to go` : ', and the way to the deepest room is open'}.`, 'g');
  if (Math.random() < W_DUNGEON.roomGear) wMagicDrop({ gear: 1 }, `left behind by ${name}`);
};

/* ---------- the alphas are Sudden Death bosses ---------- */
function wAlphaReady(info) {
  const a = DB.alphas[info.alpha]; if (!a || wFlag('alpha_' + info.alpha)) return true;
  if (info.kind === 'lair') {
    const g = wGateCheck(info.loc);
    if (!g.ok) { wLog(g.text, 'b'); return false; }
    return true;
  }
  const left = W_DUNGEON.alphaNeedsRooms ? wRoomsLeft(WG.map) : [];
  if (left.length) { wLog(`${wCap(a.name)} only plays a team that has beaten every room in here. ${left.length} room${left.length === 1 ? '' : 's'} to go.`, 'b'); return false; }
  return true;
}
function wBossIds(id) { const es = ENEMIES[id].escort || []; return es.length === 2 ? [es[0], id, es[1]] : [id].concat(es); }
const wW10StartAlpha = wStartAlpha;
wStartAlpha = function (info) {
  const X = W_ALPHA_BOSS[info.alpha], a = DB.alphas[info.alpha];
  if (!X || !a || !ENEMIES[X.boss]) return wW10StartAlpha(info);
  if (wFlag('alpha_' + info.alpha)) return null;
  return startMatch({ ids: wBossIds(X.boss), type: 'boss', tier: X.tier, name: wCap(a.name), world: { kind: info.kind, ref: { alpha: info.alpha, loc: info.loc || null } } });
};
/* a boss keeps its brain and phases, and takes the alpha's name */
const wW10NameLead = wNameLead;
wNameLead = function () {
  const W = RUN && RUN.pending && RUN.pending.world;
  if (!W || !W.name || !B || B.type !== 'boss') return wW10NameLead();
  const e = B.enemies.find(isBoss); if (!e) return wW10NameLead();
  e.n = W.name;
  if (!LAB) renderFightHUD();
};
/* the lair's alpha has no strongbox: the win pays the magic gear */
const wW10OnEndLair = W_ON_END.lair;
W_ON_END.lair = function (r, ref, W) {
  wW10OnEndLair(r, ref, W);
  if (r === 'win' && ref && W_MAGIC[ref.alpha]) wMagicDrop(W_MAGIC[ref.alpha], `from ${W.name || 'the alpha'}'s hoard`);
};

/* ---------- the pre-game card ---------- */
const wW10MatchTitle = wMatchTitle;
wMatchTitle = function (enc) {
  const W = enc.world;
  if (W.kind === 'room' && W.fam) return `${W.fam.name}, room ${W.room} of ${W.rooms}`;
  return wW10MatchTitle(enc);
};
const wW10PreGame = wPreGame;
wPreGame = function (enc) {
  wW10PreGame(enc);
  const W = enc.world, box = document.querySelector('#modalBox .wpgtxt'); if (!box) return;
  const who = box.querySelector('.wpgwho'), lines = [];
  if (W.kind === 'room' && W.fam) {
    lines.push(`<p class="wroom">Famous team: <b>${esc(W.fam.name)}</b> hold room ${W.room} of ${W.rooms} in ${esc(W.dgName)}. Beat them and the room stays beaten.</p>`);
    if (W.perk) lines.push(`<p class="hint">Sport perk: <b>${esc(SPORT_PERKS[W.perk].n)}</b>. ${esc(SPORT_PERKS[W.perk].desc)}</p>`);
  }
  if (enc.stakes && STAKES[enc.stakes]) lines.push(`<p class="hint">High stakes: <b>${esc(STAKES[enc.stakes].n)}</b>. ${esc(STAKES[enc.stakes].desc)}</p>`);
  if (enc.type === 'boss') {
    const b = ENEMIES[enc.ids.find(id => ENEMIES[id].boss) || enc.ids[0]];
    lines.push(`<p class="wroom">A Sudden Death boss: <b>${esc(b.n.split(',')[0])}</b>. ${esc(b.flav || '')}</p>`);
  }
  if (lines.length && who) who.insertAdjacentHTML('afterend', lines.join(''));
};

/* ---------- magic gear ---------- */
function wGearPool() {
  const sp = ((DB.regions[wRegionHere()] || {}).sports || []).map(s => s[0]);
  const all = Object.keys(CARDS).filter(id => /^gr_/.test(id)), own = new Set(RUN.deck.map(c => c.id));
  const fresh = all.filter(id => !own.has(id)), src = fresh.length ? fresh : all;
  const near = src.filter(id => sp.includes(CARDS[id].sport));
  return near.length ? near : src;
}
/* spec = { relic?: rarity, gear?: n, legend?: pick size }. Returns what it gave, for tests: { relic, gear: [], legend } */
function wMagicDrop(spec, why) {
  const got = { relic: null, gear: [], legend: null };
  if (!spec || !RUN) return got;
  if (spec.relic) {
    let p = relicPool(spec.relic); if (!p.length) p = relicPool();
    if (p.length) {
      const id = pick(p); gainRelic(id); got.relic = id;
      wLog(`Magic gear: ${RELICS[id].n}, a trophy for the team. ${RELICS[id].desc}`, 'm');
    } else { const g = gainGold(60); wLog(`There is no trophy left you do not own; ${g} gold instead.`, 'm'); }
  }
  for (let i = 0; i < (spec.gear || 0); i++) {
    const pool = wGearPool().filter(id => !got.gear.includes(id));
    if (!pool.length) break;
    const id = pick(pool); got.gear.push(id);
    wGainCard(id, 'magic gear, ' + (why || 'found'));
  }
  if (spec.legend) {
    const L = cardPool('l').map(c => c.id);
    if (L.length) { got.legend = wGainCard({ pick: spec.legend, pool: L }, 'a Hall of Fame legend, ' + (why || 'found')); }
  }
  wSave();
  return got;
}
const wW10GiveLoot = wGiveLoot;
wGiveLoot = function (l) {
  wW10GiveLoot(l);
  if (l && l.magic && W_MAGIC[l.magic]) wMagicDrop(W_MAGIC[l.magic], 'from the strongbox');
};

/* ---------- How to play ---------- */
const wW10RenderHelp = renderHelp;
renderHelp = function () {
  wW10RenderHelp();
  const sec = $('wHelp'); if (!sec || $('wHelp5')) return;
  sec.insertAdjacentHTML('beforeend', `<div id="wHelp5"><h4>Dungeons and lairs</h4>
    <p class="hint"><b>Dungeons.</b> Each dungeon is a gauntlet. Some rooms hold famous teams: walk in and they want a game, an elite match with a scouting report, and deeper rooms bring sport perks, high stakes and a higher level. A room you win stays won. When every room is beaten, the alpha in the deepest room plays you, and it is a Sudden Death boss. The two lairs out in the wild hold bosses too.</p>
    <p class="hint"><b>Getting in.</b> Dungeon doors open to teams that have won cups, and the Sealed Vault also wants its keycard. A shut door tells you what you are missing.</p>
    <p class="hint"><b>Magic gear.</b> The strongbox behind a beaten alpha holds a trophy and a gear card, and in the deepest vaults a pick of Hall of Fame legends. A lair's alpha pays the same way when you beat it, and a beaten room sometimes leaves a gear card behind.</p></div>`);
};
