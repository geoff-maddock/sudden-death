/* u4: the dark grounds (issue #99, phase 4's frame). Loads after u3-monsters.js; changes earlier parts only by
   reassignment (saved originals carry the wWU4 prefix). The sports' own parts (u4a to u4h) load after it.

   Every sport with an engine has its ground on the dark world too (W_UMB4.grounds): the light ground through u0's
   transform, under its dark name. A Nadir champion waits at the far end of each, and the approach is guarded:
     the cold     every W_UMB4.cold.steps steps on a dark ground costs your team 1 HP (never below 1)
     the guards   two of the Nadir, by the champion; each plays you an Umbral card match (an elite, tier U) and once
                  beaten stands aside for the rest of the journey (WG.umbral.guards)
     the gate     the champion plays nobody who hasn't brought something from the light side of the region
                  (W_UMB4.gate: an item, handed over once; WG.umbral.gates)
   The champion stands at the far end of the field, the guards two rows in front of them, either side of the way up.
   Then PLAY: a champion who plays a sport starts its engine's game through that sport's adapter (W_UMB4.start[engine],
   written by u4a..u4h), at tier U, with its hexes; the adapter reports the end to wUmbNadirEnd, which pays the piece
   (or counts the try) as the card game's champion does. A champion may want a condition too (C.cond: its words, and
   the adapter checks it).

   W_UMB4, wUmbNadirEnd, wUmbGuardOf, wUmbGuardMatch, wUmbTollAtKickoff, wUmbFieldEnd, wUmbFarEnd, wUmbPlaceGround
   An adapter charges a retry's toll itself, at the real kickoff (wUmbTollAtKickoff), so backing out costs nothing.
   The gate's items are not sold in the dark shops (W_UMB2.noSell).
   Wraps: wNadirMatch (wWU4NadirMatch: the guards, the gate, an engine's champion), wRunAct (wWU4RunAct: a guard's
   PLAY), wUmbralMap (wWU4UmbralMap: a ground's field look, scoreboard and sign), wTryMove (wWU4TryMove: the cold),
   buildAllMaps (wWU4BuildAllMaps: the champions and guards on the dark grounds), wAudit (wWU4Audit: every dark
   ground has its guards, and its gate is a real item). */

const W_UMB4 = {
  grounds: { g_ballpark: 'baseball', g_court: 'basketball', g_links: 'golf', g_lanes: 'bowling', g_shed: 'curling', g_bowl: 'football', g_ring: 'boxing', g_rink: 'hockey' },
  names: { g_ballpark: 'The Bone Diamond', g_court: 'The Black Court', g_links: 'The Hollow Links', g_lanes: 'The Drowned Lanes', g_shed: 'The Sunken Shed', g_bowl: 'The Cinder Pit', g_ring: 'The Broken Ring', g_rink: 'The Dead Pond' },
  cold: { steps: 2, hp: 1 },
  gate: { plains: 'grain', bloom: 'mossberry', tide: 'brinekelp', ember: 'emberpepper', rime: 'frostmint' },
  guardNames: ['The Left Hand of the Nadir', 'The Right Hand of the Nadir'],
  // the sports' adapters: (C, id, hexes) => '' when the game started, or why not
  start: {},
};
W_UMB.maps.push(...Object.keys(W_UMB4.grounds));
Object.assign(W_UMB.names, W_UMB4.names);

/* ---------- the guards ---------- */
const wUmbGuardOf = (g, i) => 'nguard_' + g + '_' + i;
for (const g in W_UMB4.grounds) {
  const G = wGrd(g), rg = G ? W_GRD_REG[G.city] : 'plains', ks = (DB.regions[rg] || DB.regions.plains).kinds;
  W_UMB4.guardNames.forEach((n, i) => {
    DB.chars[wUmbGuardOf(g, i)] = { name: n, kind: ks[i % ks.length], look: { coat: '#3a2a4a' },
      greet: 'Nobody reaches the champion without going through us. Say PLAY, if you want to try.',
      topics: { job: { t: 'We stand here. We play anyone who wants to go further. Mostly they go back.' }, play: { t: 'Cards, then. Our rules.', act: 'uguard:' + g + ':' + i } } };
  });
}
function wUmbGuardMatch(g, i) {
  const U = wUmb(), G = wGrd(g); if (!U || !G) return 'Nobody here plays.';
  U.guards = U.guards || {};
  if (U.guards[g + ':' + i]) return `${W_UMB4.guardNames[i]} steps aside. You beat them once; they remember.`;
  startMatch({ type: 'elite', tier: 3, lv: W_ROAD.maxLv, ambush: false, name: W_UMB4.guardNames[i],
    world: { kind: 'uguard', ref: { g, i }, region: W_GRD_REG[G.city], umbral: 1 } });
  return '';
}
W_ON_END.uguard = function (r, ref) {
  const U = wUmb(); if (!U || !ref) return;
  if (r === 'win') { U.guards = U.guards || {}; U.guards[ref.g + ':' + ref.i] = WG.dayAbs; wLog(`${W_UMB4.guardNames[ref.i]} steps aside.`, 'g'); wSave(); }
};

/* ---------- the champions of the sports ---------- */
// the end of a champion's game, whatever the sport: the piece, or a try counted
function wUmbNadirEnd(id, r) { W_ON_END.nadir(r, { id }); }
const wWU4NadirMatch = wNadirMatch;
wNadirMatch = function (id) {
  const C = W_NADIR[id], U = wUmb(); if (!C || !U) return wWU4NadirMatch.apply(this, arguments);
  if (U.pieces.includes(C.piece)) return wWU4NadirMatch.apply(this, arguments);
  if (C.ground) {
    U.guards = U.guards || {}; U.gates = U.gates || {};
    const left = [0, 1].filter(i => !U.guards[C.ground + ':' + i]);
    if (left.length) return `${DB.chars[C.char].name} will not play you until you have got past ${left.map(i => W_UMB4.guardNames[i]).join(' and ')}.`;
    const it = W_UMB4.gate[C.region];
    if (!U.gates[id]) {
      if (!wHas(it)) return `${DB.chars[C.char].name} wants something from the light side of the region first: a ${DB.items[it].name}. Bring one through the portal.`;
      wAddItem(it, -1); U.gates[id] = WG.dayAbs; wLog(`You hand over a ${DB.items[it].name}. ${DB.chars[C.char].name} turns it over and over, as if it were warm.`, 'd');
    }
  }
  if (!C.engine) return wWU4NadirMatch.apply(this, arguments);
  const tries = U.tries[id] || 0;
  if (tries > 0 && RUN.gold < C.toll) return `Another game costs a toll of ${C.toll} gold, and you have ${RUN.gold}.`;
  const go = W_UMB4.start[C.engine]; if (!go) return `${DB.chars[C.char].name} is not ready to play yet.`;
  // (the adapter charges the toll itself, at the real kickoff, through wUmbTollAtKickoff: backing out costs nothing)
  return go(C, id, wUmbHexes(id, C.hexes || 1));
};
// a retry's toll, paid once per try when the game really starts (an adapter calls it after Play, Manage or Simulate)
function wUmbTollAtKickoff(id) {
  const C = W_NADIR[id], U = wUmb(); if (!C || !U) return 0;
  const t = U.tries[id] || 0; U.paid = U.paid || {};
  if (!t || U.paid[id] === t) return 0;
  U.paid[id] = t; RUN.gold = Math.max(0, RUN.gold - C.toll); wLog(`You pay the toll: ${C.toll} gold.`, 'd'); wSave();
  return C.toll;
}
const wWU4RunAct = wRunAct;
wRunAct = function (act, id) {
  if (typeof act === 'string' && act.startsWith('uguard:')) { WUI.held = null; if (WUI.talk) wCloseTalk(); const [, g, i] = act.split(':'); const why = wUmbGuardMatch(g, +i); if (why) wLog(why, 'd'); return; }
  return wWU4RunAct.apply(this, arguments);
};

/* ---------- the cold ---------- */
const wWU4TryMove = wTryMove;
wTryMove = function (dx, dy) {
  const m0 = WG && WG.map, moved = wWU4TryMove.apply(this, arguments);
  if (moved && WG && WG.map === m0 && m0.startsWith('u:') && W_UMB4.grounds[m0.slice(2)] && !LAB) {
    WG.umbCold = (WG.umbCold || 0) + 1;
    if (WG.umbCold % W_UMB4.cold.steps === 0 && RUN.hp > 1) { RUN.hp = Math.max(1, RUN.hp - W_UMB4.cold.hp); if (WG.umbCold % (W_UMB4.cold.steps * 8) === 0) wLog('The cold here gets into your team\'s bones.', 'd'); }
  }
  return moved;
};

/* ---------- placing the champions and guards on the dark grounds ---------- */
// the far end of a map from its way in: the free tile farthest by walking, with a free side
function wUmbFarEnd(m) {
  const W = m.w, dist = new Int32Array(W * m.h).fill(-1), q = [[m.spawn[0], m.spawn[1]]];
  dist[m.spawn[1] * W + m.spawn[0]] = 0;
  for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= m.h || dist[ny * W + nx] >= 0 || !walkCh(m.t[ny][nx])) continue; dist[ny * W + nx] = dist[y * W + x] + 1; q.push([nx, ny]); } }
  return dist;
}
// the far end of the field (tiles 'd'), away from the way in: the champion's spot, with the guards two rows in front,
// one either side of the way up the middle; null when the ground has no field
function wUmbFieldEnd(m) {
  let x0 = m.w, x1 = -1, y0 = m.h, y1 = -1;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.t[y][x] === 'd') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const cx = (x0 + x1) >> 1, far = Math.abs(m.spawn[1] - y0) > Math.abs(m.spawn[1] - y1), cy = far ? y0 + 1 : y1 - 1, dy = far ? 2 : -2;
  return { champ: [cx, cy], guards: [[cx - 1, cy + dy], [cx + 1, cy + dy]] };
}
function wUmbPlaceGround(g) {
  const m = MAPS['u:' + g]; if (!m) return;
  const F = wUmbFieldEnd(m), ok = (x, y) => { const c = m.t[y] && m.t[y][x], td = c && DB.tiles[c]; return td && td.walk && !td.enter && !m.npcs.some(n => n.x === x && n.y === y); };
  if (F && ok(...F.champ) && F.guards.every(p => ok(...p))) {
    const champ = Object.keys(W_NADIR).find(k => W_NADIR[k].ground === g), C = champ && W_NADIR[champ];
    if (C && !m.npcs.some(n => n.id === C.char)) m.npcs.push({ id: C.char, x: F.champ[0], y: F.champ[1], fixed: true });
    F.guards.forEach((p, i) => { if (!m.npcs.some(n => n.id === wUmbGuardOf(g, i))) m.npcs.push({ id: wUmbGuardOf(g, i), x: p[0], y: p[1], fixed: true }); });
    return;
  }
  const dist = wUmbFarEnd(m), W = m.w, taken = (x, y) => m.npcs.some(n => n.x === x && n.y === y);
  const free = (x, y) => { const c = m.t[y] && m.t[y][x], td = c && DB.tiles[c]; return td && td.walk && !td.enter && !taken(x, y) && !m.meta[x + ',' + y] && dist[y * W + x] > 2; };
  // the champion (if one plays here) at the far end; the guards two and four steps nearer the way in
  const champ = Object.keys(W_NADIR).find(k => W_NADIR[k].ground === g), C = champ && W_NADIR[champ];
  let best = null; for (let y = 0; y < m.h; y++) for (let x = 0; x < W; x++) if (free(x, y) && (!best || dist[y * W + x] > dist[best[1] * W + best[0]])) best = [x, y];
  if (!best) return;
  if (C && !m.npcs.some(n => n.id === C.char)) m.npcs.push({ id: C.char, x: best[0], y: best[1], fixed: true });
  const d0 = dist[best[1] * W + best[0]];
  [2, 4].forEach((k, i) => {
    if (m.npcs.some(n => n.id === wUmbGuardOf(g, i))) return;
    let at = null; for (let y = 0; y < m.h && !at; y++) for (let x = 0; x < W && !at; x++) if (free(x, y) && dist[y * W + x] === d0 - k && Math.abs(x - best[0]) + Math.abs(y - best[1]) <= k + 2) at = [x, y];
    for (let y = 0; y < m.h && !at; y++) for (let x = 0; x < W && !at; x++) if (free(x, y) && dist[y * W + x] < d0 && dist[y * W + x] >= d0 - k - 3) at = [x, y];
    if (at) m.npcs.push({ id: wUmbGuardOf(g, i), x: at[0], y: at[1], fixed: true });
  });
}
// the gate wants something brought from the light side: the dark shops don't sell it
W_UMB2.noSell = (W_UMB2.noSell || []).concat(Object.values(W_UMB4.gate));
// a dark ground keeps its field's look (m.field) and its scoreboard, and its sign has gone wrong
const wWU4UmbralMap = wUmbralMap;
wUmbralMap = function (m) {
  const u = wWU4UmbralMap.apply(this, arguments);
  if (!W_UMB4.grounds[m.id]) return u;
  if (m.field) u.field = JSON.parse(JSON.stringify(m.field));
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = m.t[y][x], mt = m.meta[x + ',' + y];
    if (c === '%') u.t[y][x] = c;
    if (c === 'S' && mt) u.meta[x + ',' + y] = { text: wUmbWrongSign(mt.text || '...') };
  }
  return u;
};
const wWU4BuildAllMaps = buildAllMaps;
buildAllMaps = function () { const r = wWU4BuildAllMaps.apply(this, arguments); for (const g in W_UMB4.grounds) wUmbPlaceGround(g); return r; };
const wWU4Audit = wAudit;
wAudit = function () {
  const P = wWU4Audit.apply(this, arguments).filter(s => !/^character nguard_/.test(s));
  for (const g in W_UMB4.grounds) {
    const m = MAPS['u:' + g]; if (!m) { P.push('dark ground u:' + g + ' was not built'); continue; }
    for (const i of [0, 1]) if (!m.npcs.some(n => n.id === wUmbGuardOf(g, i))) P.push('u:' + g + ': guard ' + i + ' has nowhere to stand');
    const s = bfsReach(m, m.spawn[0], m.spawn[1]);
    for (const n of m.npcs) if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s[(n.y + dy) * m.w + n.x + dx])) P.push('u:' + g + ': cannot reach ' + n.id);
  }
  for (const rg in W_UMB4.gate) if (!DB.items[W_UMB4.gate[rg]]) P.push('the gate item for ' + rg + ' is not an item');
  for (const id in W_NADIR) {
    const C = W_NADIR[id]; if (!C.ground) continue;
    if (C.map !== 'u:' + C.ground) P.push('the Nadir champion ' + id + ' is on ' + C.map + ' but its ground is ' + C.ground);
    if (!W_UMB4.gate[C.region]) P.push('the Nadir champion ' + id + '\'s region ' + C.region + ' has no gate item');
    if (!W_UMB4.grounds[C.ground]) P.push('the Nadir champion ' + id + '\'s ground ' + C.ground + ' is not a dark ground');
  }
  return P;
};
