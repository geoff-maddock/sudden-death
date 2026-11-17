/* w104: places, the dungeons (issue #90). Loads after w103-places.js; changes earlier parts only by reassignment
   (saved originals carry the wW104 prefix).

   Terrain, per dungeon (W_DELVE: each dungeon's theme). Laid over the built map by wDelvesBuild, from buildAllMaps
   (w103), deterministically, so nothing but flags goes into the save:
     The Sealed Vault   rune tiles ('`') in its rooms, glowing aether conduits ('¦') down its passages, sealed pillars
     Emberdeep Warren   ash floors (','), lava pools ('L'), steam vents ('>'): a vent blows every third step (wVentOn),
                        and crossing one while it blows costs the team W_DELVE_N.vent HP
     Drowned Hatchery   shallow water (';', walkable, each step W_DELVE_N.wade minutes longer), deep pools ('~'), kelp
                        beds and shell drifts
     The Deep Seam      chasms ('6'), cart rails down its passages ('ÿ'), crystal clusters, ore seams in its walls
   Anything that blocks the way is placed only where every floor tile, strongbox, well, nest and the alpha can still be
   reached (wDelveBlock). The rooms, their order and which famous team is in which stay exactly as they were: walls
   stay walls in the raw map (cracks and seams are overlays, m.ovr), so wDungeonRooms sees the same layout.

   Things to do, in every dungeon:
     a lever (']') and a sealed gate ('['): behind the gate a small side vault with a strongbox (DB.chests <id>_vault);
       the lever is in another room. Pulled stays pulled (flag lever_<id>).
     cracked walls ('{'): a weak spot, one to three tiles thick, between two passages far apart on foot. Break through (an hour) for a shortcut
       that stays open (flag crack_<id>_<n>).
     a survey stone ('*') by the stairs: shows the whole dungeon on the map.
     a famous team's pennant ('}') in each of their rooms, in their colours; torn once they are beaten.
   and themed finds: ore seams ('|') in the Deep Seam (gold, once a week) and kelp beds ('?') in the Hatchery
   (brinekelp, every three days).

   W_DELVE, W_DELVE_N, wDelvesBuild, wDelveBlock, wVentOn, wDelveUse
   Wrapped: wTileAt (wW104TileAt: the overlays), wTileVariant (wW104TileVariant), wUse (wW104Use), wTryMove (wW104TryMove:
   vents and wading), wEnterMap (wW104EnterMap: redraw a dungeon on the way in), wDrawMap (wW104DrawMap: the vents'
   steam). A sealed gate is floor in the raw map (the gate is an overlay), so the audit counts what is behind it as
   reachable, which it is once the lever is pulled. */

const W_DELVE_N = { vent: 2, wade: 4, oreGold: [25, 40], oreDays: 7, kelpDays: 3, crackMin: 60, crackDist: 16 };
const W_DELVE = {
  genevault: { name: 'rune vault', room: '`', hall: '¦', decor: 'ô', decorN: 6 },
  emberdeep: { name: 'warren', room: ',', hall: ',', pool: 'L', poolN: 5, vents: 8 },
  hatchery: { name: 'flooded', wet: ';', pool: '~', poolN: 9, decor: '@', decorN: 5, kelp: 2 },
  deepseam: { name: 'seam', hall: 'ÿ', pool: '6', poolN: 6, decor: 'ç', decorN: 5, ore: 3 },
};
Object.assign(DB.tiles, {
  '`': { name: 'rune tiles', walk: 1, ground: 1, enc: .06, look: 'Polished tiles with lines inlaid in something that still glows. Somebody swept here, once.' },
  '¦': { name: 'conduit', walk: 1, ground: 1, enc: .05, look: 'A channel cut in the floor, running with pale aether. It hums through your boots.' },
  ',': { name: 'ash floor', walk: 1, ground: 1, enc: .07, look: 'Warm ash, ankle deep, with embers in it that wink out as you pass.' },
  ';': { name: 'shallow water', walk: 1, ground: 1, enc: .07, look: 'Knee-deep black water over old stone. Each step is slow, and something brushes your shins.' },
  '6': { name: 'chasm', walk: 0, ground: 1, look: 'A crack in the world. A stone dropped in never lands.' },
  'ÿ': { name: 'cart rails', walk: 1, ground: 1, enc: .05, look: 'Old cart rails, rusted to the sleepers. Every miner who worked the Seam walked these.' },
  '>': { name: 'steam vent', walk: 1, ground: 1, enc: .04, look: 'A steam vent in the ash. It blows every few steps: count, then cross.' },
  '[': { name: 'sealed gate', walk: 0, use: 'gate', look: 'An iron gate, shut fast. Somewhere a lever works it.' },
  ']': { name: 'lever', walk: 0, use: 'lever', look: 'A great iron lever in a stone socket.', look0: 'The lever, pulled down. Somewhere a gate stands open.' },
  '{': { name: 'cracked wall', walk: 0, use: 'crack', look: 'A cracked stretch of wall. You can feel a draught through it.' },
  '}': { name: 'pennant', walk: 0, use: 'pennant', look: 'A team pennant on a pole.' },
  '*': { name: 'survey stone', walk: 0, use: 'survey', look: 'A survey stone, its face carved with the plan of this place.' },
  '|': { name: 'ore seam', walk: 0, use: 'ore', look: 'A seam of ore in the rock, glittering.', look0: 'A worked-out seam. It will show colour again in a week.' },
  '?': { name: 'kelp bed', walk: 0, use: 'kelp', look: 'A bed of brinekelp growing up out of the shallows.', look0: 'Cut kelp. It will grow back in a few days.' },
  'ô': { name: 'sealed pillar', walk: 0, look: 'A pillar with an aether seal set in it, still turning slowly after all these years.' },
  '@': { name: 'shell drift', walk: 0, look: 'A drift of broken eggshell, pearl on the inside. Whatever hatched here was big.' },
  'ç': { name: 'crystal cluster', walk: 0, look: 'Crystals as long as your arm, growing out of the floor. They ring if you breathe on them.' },
});
// ash and shallows sit above lava and deep water, so they spill a ragged edge over a pool, as land does over the sea
Object.assign(WPRI, { '`': 0, '¦': 0, ',': 4.4, '>': 4.4, ';': 2, '6': 0, 'ÿ': 0 });
WWALL['{'] = 1; WWALL['|'] = 1;
DB.chests.genevault_vault = { gold: 120, cardChoice: { pick: 3, rarity: 'r' } };
DB.chests.emberdeep_vault = { gold: 90, items: { emberpepper: 2 }, cardChoice: { pick: 3, rarity: 'u' } };
DB.chests.hatchery_vault = { gold: 80, items: { saltfish: 2 }, cardChoice: { pick: 3, rarity: 'u' } };
DB.chests.deepseam_vault = { gold: 150, cardChoice: { pick: 3, rarity: 'r' } };

/* ---------- laying the terrain ---------- */
function wDelveReach(m) { return bfsReach(m, m.spawn[0], m.spawn[1]); }
function wDelveCount(seen) { let n = 0; for (let i = 0; i < seen.length; i++) n += seen[i]; return n; }
function wDelveMetaOk(m, seen) {
  for (const k in m.meta) { const [x, y] = k.split(',').map(Number); if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(y + dy) * m.w + x + dx])) return false; }
  return true;
}
// put something that blocks the way, only if everything else can still be reached
function wDelveBlock(m, x, y, ch, meta) {
  const c0 = m.t[y][x]; if (!walkCh(c0) || DB.tiles[c0].enter || m.meta[x + ',' + y]) return false;
  if (Math.abs(x - m.spawn[0]) + Math.abs(y - m.spawn[1]) < 2) return false;
  const before = wDelveCount(wDelveReach(m));
  m.t[y][x] = ch; if (meta) m.meta[x + ',' + y] = meta;
  const seen = wDelveReach(m);
  if (wDelveCount(seen) === before - 1 && wDelveMetaOk(m, seen)) return true;
  m.t[y][x] = c0; if (meta) delete m.meta[x + ',' + y];
  return false;
}
function wDelveRoomOf(m, x, y) { return m.rooms.findIndex(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h); }
function wDelveIsFloor(c) { return c === 'g' || c === '`' || c === '¦' || c === ',' || c === ';' || c === 'ÿ'; }
function wDelvesBuild() {
  for (const id in W_DELVE) { const m = MAPS[id]; if (m && m.kind === 'dungeon' && !m.delved) wDelveOne(m, W_DELVE[id]); }
}
function wDelveOne(m, T) {
  const r = mulberry(m.id.length * 331 + m.id.charCodeAt(1) * 17), first = m.rooms[0], far = m.far;
  m.ovr = {}; m.delved = true;
  const tiles = []; for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) tiles.push([x, y]);
  const nz = (x, y, s, k) => wNoise(x, y, s, k);
  // 1. floors
  for (const [x, y] of tiles) {
    if (m.t[y][x] !== 'g') continue;
    const inRoom = wDelveRoomOf(m, x, y) >= 0;
    if (T.room && inRoom) m.t[y][x] = T.room;
    else if (T.hall && !inRoom) m.t[y][x] = T.hall;
    else if (T.wet && nz(x, y, 4, 71) > .45) m.t[y][x] = T.wet;
  }
  // 2. pools and chasms: in rooms, where the noise is high, never in the stairs' room
  if (T.pool) {
    const cand = tiles.filter(([x, y]) => { const ri0 = wDelveRoomOf(m, x, y); return ri0 > 0 && m.rooms[ri0] !== far && wDelveIsFloor(m.t[y][x]); })
      .map(([x, y]) => [x, y, nz(x, y, 3, 73) + r() * .15]).sort((a, b) => b[2] - a[2]);
    let n = 0; const cap = T.poolN * 3;
    for (const [x, y] of cand) { if (n >= cap) break; if (wDelveBlock(m, x, y, T.pool)) n++; }
    // deep water is ringed by shallows
    if (T.wet) for (const [x, y] of tiles) if (m.t[y][x] === T.pool) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (m.t[y + dy][x + dx] === 'g') m.t[y + dy][x + dx] = T.wet;
  }
  // 3. vents
  if (T.vents) {
    const cand = tiles.filter(([x, y]) => wDelveIsFloor(m.t[y][x]) && wDelveRoomOf(m, x, y) !== 0 && !m.meta[x + ',' + y]);
    for (let i = 0; i < T.vents && cand.length; i++) { const k = (r() * cand.length) | 0, [x, y] = cand.splice(k, 1)[0]; m.t[y][x] = '>'; }
  }
  // 4. decor, against room walls
  if (T.decor) {
    let n = 0;
    for (let i = 1; i < m.rooms.length && n < T.decorN; i++) {
      const R = m.rooms[i]; if (R === far) continue;
      const spots = [[R.x, R.y], [R.x + R.w - 1, R.y], [R.x, R.y + R.h - 1], [R.x + R.w - 1, R.y + R.h - 1]].sort(() => r() - .5);
      for (const [x, y] of spots.slice(0, 2)) if (n < T.decorN && wDelveBlock(m, x, y, T.decor)) n++;
    }
  }
  // 5. kelp beds (hatchery)
  for (let i = 0, tries = 0; i < (T.kelp || 0) && tries < 200; tries++) {
    const [x, y] = tiles[(r() * tiles.length) | 0]; if (m.t[y][x] !== ';' || wDelveRoomOf(m, x, y) <= 0) continue;
    if (wDelveBlock(m, x, y, '?', { kelp: 1 })) i++;
  }
  // 6. the survey stone, in the stairs' room
  for (const [x, y] of [[first.x, first.y], [first.x + first.w - 1, first.y], [first.x, first.y + first.h - 1], [first.x + first.w - 1, first.y + first.h - 1]]) if (wDelveBlock(m, x, y, '*', { survey: 1 })) break;
  // 7. pennants in the famous teams' rooms
  const fam = typeof wDungeonRooms === 'function' ? wDungeonRooms(m.id) : [];
  for (const R of fam) {
    const spots = []; for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) spots.push([x, y, Math.abs(x - R.x - 1) + Math.abs(y - R.y)]);
    spots.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of spots) if (wDelveBlock(m, x, y, '}', { pennant: R.d })) break;
  }
  // 8. the gate and its side vault; the lever in another room
  wDelveVault(m, T, fam, r);
  // 9. cracked walls: shortcuts between passages far apart on foot
  wDelveCracks(m, r);
  // 10. ore seams in the walls (deep seam)
  if (T.ore) {
    const seen = wDelveReach(m), cand = [];
    for (const [x, y] of tiles) if (m.t[y][x] === 'X' && !m.ovr[x + ',' + y] && [[0, 1]].some(([dx, dy]) => seen[(y + dy) * m.w + x + dx])) cand.push([x, y]);
    for (let i = 0; i < T.ore && cand.length; i++) { const [x, y] = cand.splice((r() * cand.length) | 0, 1)[0]; m.ovr[x + ',' + y] = { ch: '|' }; m.meta[x + ',' + y] = { ore: 1 }; }
  }
  // lava glows in the dark
  for (const [x, y] of tiles) if (m.t[y][x] === 'L') m.light.push([x, y, 1.4]);
  for (const [x, y] of tiles) if (m.t[y][x] === '¦' && (x + y) % 4 === 0) m.light.push([x, y, 1.2]);
}
function wDelveVault(m, T, fam, r) {
  const famSet = new Set(fam.map(R => R.x + ',' + R.y)), first = m.rooms[0], far = m.far;
  const order = m.rooms.filter(R => R !== first && R !== far).sort((a, b) => (famSet.has(a.x + ',' + a.y) ? 1 : 0) - (famSet.has(b.x + ',' + b.y) ? 1 : 0));
  const floor = T.room || 'g', X = (x, y) => x >= 1 && y >= 1 && x < m.w - 1 && y < m.h - 1 && m.t[y][x] === 'X';
  for (const R of order) {
    // gate (gx, gy) just outside the room's edge, the pocket behind it is 3 wide and 2 deep, walled all round
    const sides = [];
    for (let x = R.x + 1; x < R.x + R.w - 1; x++) { sides.push([x, R.y - 1, 0, -1]); sides.push([x, R.y + R.h, 0, 1]); }
    for (let y = R.y + 1; y < R.y + R.h - 1; y++) { sides.push([R.x - 1, y, -1, 0]); sides.push([R.x + R.w, y, 1, 0]); }
    for (const [gx, gy, dx, dy] of sides.sort(() => r() - .5)) {
      const px = dx ? [0] : [-1, 0, 1], py = dy ? [0] : [-1, 0, 1], pocket = [];
      for (let d = 1; d <= 2; d++) for (const ox of px) for (const oy of py) pocket.push([gx + dx * d + ox, gy + dy * d + oy]);
      // the wall round the pocket and the gate must all be solid rock
      let ok = X(gx, gy);
      for (const [x, y] of pocket) for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1 && ok; b++) { const xx = x + a, yy = y + b; if (xx === gx && yy === gy) continue; if (!X(xx, yy) && !pocket.some(([qx, qy]) => qx === xx && qy === yy)) ok = false; }
      if (!ok) continue;
      // a lever in another room, as far from this one as there is
      const others = m.rooms.filter(o => o !== R && o !== far).sort((a, b) => Math.hypot(b.cx - R.cx, b.cy - R.cy) - Math.hypot(a.cx - R.cx, a.cy - R.cy));
      for (const [x, y] of pocket) m.t[y][x] = floor;
      m.t[gy][gx] = floor;
      const flag = 'lever_' + m.id, cx = pocket[pocket.length - 2] || pocket[pocket.length - 1];
      m.t[cx[1]][cx[0]] = 'C'; m.meta[cx[0] + ',' + cx[1]] = { chest: m.id + '_vault' };
      m.ovr[gx + ',' + gy] = { ch: '[', flag, open: floor }; m.meta[gx + ',' + gy] = { gate: flag };
      for (const L of others) {
        const spots = []; for (let y = L.y; y < L.y + L.h; y++) for (let x = L.x; x < L.x + L.w; x++) spots.push([x, y]);
        spots.sort((a, b) => (Math.abs(a[0] - L.cx) + Math.abs(a[1] - L.cy)) - (Math.abs(b[0] - L.cx) + Math.abs(b[1] - L.cy)));
        for (const [x, y] of spots) if (wDelveBlock(m, x, y, ']', { lever: flag })) return true;
      }
      return true;
    }
  }
  return false;
}
function wDelveCracks(m, r) {
  const n = W_DELVE_N, found = [];
  const seen = wDelveReach(m), walk = (x, y) => seen[y * m.w + x] && walkCh(m.t[y][x]);
  const dist = (ax, ay, bx, by) => {
    const d = new Int32Array(m.w * m.h).fill(-1), q = [[ax, ay]]; d[ay * m.w + ax] = 0;
    for (let qi = 0; qi < q.length; qi++) { const [x, y] = q[qi]; if (x === bx && y === by) return d[y * m.w + x]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, i = ny * m.w + nx; if (d[i] < 0 && walkCh(m.t[ny][nx])) { d[i] = d[y * m.w + x] + 1; q.push([nx, ny]); } } }
    return 1e9;
  };
  const rock = (x, y) => x >= 1 && y >= 1 && x < m.w - 1 && y < m.h - 1 && m.t[y][x] === 'X' && !m.ovr[x + ',' + y];
  // a wall one to three tiles thick, rock on both flanks so it reads as a wall, with passages on both faces
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
    if (!rock(x, y)) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) for (const thick of [1, 2, 3]) {
      const cells = []; for (let i = 0; i < thick; i++) cells.push([x + dx * i, y + dy * i]);
      if (!cells.every(([cx, cy]) => rock(cx, cy) && rock(cx + dy, cy + dx) && rock(cx - dy, cy - dx))) continue;
      const ax = x - dx, ay = y - dy, bx = x + dx * thick, by = y + dy * thick;
      if (!walk(ax, ay) || !walk(bx, by)) continue;
      const d = dist(ax, ay, bx, by);
      if (d >= n.crackDist) found.push([cells, d - thick * 4]);
    }
  }
  found.sort((a, b) => b[1] - a[1]);
  let k = 0;
  for (const [cells] of found) {
    if (k >= 2) break;
    if (cells.some(([x, y]) => Object.keys(m.ovr).some(key => { const [ox, oy] = key.split(',').map(Number); return Math.abs(ox - x) + Math.abs(oy - y) < 4; }))) continue;
    k++;
    const flag = 'crack_' + m.id + '_' + k;
    for (const [x, y] of cells) {
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => m.t[y + dy][x + dx]).find(wDelveIsFloor) || 'g';
      m.ovr[x + ',' + y] = { ch: '{', flag, open: nb };
      // only the faces you can bump carry the meta (the middle of a thick wall touches no floor)
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => walkCh(m.t[y + dy][x + dx]))) m.meta[x + ',' + y] = { crack: flag };
    }
  }
}

/* ---------- the overlays, and the state of things ---------- */
const wW104TileAt = wTileAt;
wTileAt = function (map, x, y) {
  const o = map.ovr && map.ovr[x + ',' + y];
  if (o) return o.flag && WG && wFlag(o.flag) ? o.open : o.ch;
  return wW104TileAt(map, x, y);
};
const wW104TileVariant = wTileVariant;
wTileVariant = function (map, x, y, c) {
  const mt = map.meta[x + ',' + y] || {};
  if (WG && c === '}') { const R = (typeof wDungeonRooms === 'function' ? wDungeonRooms(map.id) : [])[mt.pennant]; return R && wFlag(R.flag) ? '0' : '1'; }
  if (WG && c === ']') return wFlag(mt.lever) ? '0' : '1';
  if (WG && c === '|') return wDepleted(x, y, W_DELVE_N.oreDays, map.id) ? '0' : '1';
  if (WG && c === '?') return wDepleted(x, y, W_DELVE_N.kelpDays, map.id) ? '0' : '1';
  return wW104TileVariant(map, x, y, c);
};

/* ---------- vents and wading ---------- */
function wVentOn(x, y, step) { return ((step + ((wHash(x, y, 81) * 3) | 0)) % 3) === 0; }
const W104 = { wet: null };
const wW104TryMove = wTryMove;
wTryMove = function (dx, dy) {
  const map0 = WG && WG.map, moved = wW104TryMove(dx, dy);
  if (!moved || !WG || WG.map !== map0) return moved;
  const m = wCurMap(); if (m.kind !== 'dungeon') return moved;
  const c = wTileAt(m, WG.x, WG.y);
  if (c === ';') {
    wAdvance(W_DELVE_N.wade);
    if (W104.wet !== m.id) { W104.wet = m.id; wLog('Knee-deep water. Every step through it is slow going.', 'd'); }
  } else if (c === '>' && wVentOn(WG.x, WG.y, WG.step) && !LAB) {
    RUN.hp = Math.max(1, RUN.hp - W_DELVE_N.vent);
    wLog('The vent blows as you cross it. Scalded: -' + W_DELVE_N.vent + ' HP. Count the puffs next time.', 'b');
  }
  return moved;
};
const wW104EnterMap = wEnterMap;
wEnterMap = function (id, x, y) {
  const r = wW104EnterMap(id, x, y);
  if (MAPS[id] && MAPS[id].kind === 'dungeon') { W104.wet = null; wInvalidate(id); }
  return r;
};

/* ---------- uses ---------- */
function wDelveUse(x, y) {
  const m = wCurMap(), c = wTileAt(m, x, y), mt = m.meta[x + ',' + y] || {};
  switch (c) {
    case '[': return wLog(DB.tiles['['].look, 'd');
    case ']': {
      if (wFlag(mt.lever)) return wLog(DB.tiles[']'].look0, 'd');
      wSetFlag(mt.lever); wInvalidate(m.id);
      return wLog('You haul the lever down. Somewhere off in the dark, chains run and a gate grinds up.', 'g');
    }
    case '{': {
      wAdvance(W_DELVE_N.crackMin); wSetFlag(mt.crack); wInvalidate(m.id);
      return wLog('The team puts their shoulders to the cracked wall for an hour. It gives all at once: a way through, and a shortcut back.', 'g');
    }
    case '}': {
      const R = (typeof wDungeonRooms === 'function' ? wDungeonRooms(m.id) : [])[mt.pennant];
      if (!R) return wLog(DB.tiles['}'].look, 'd');
      return wLog(wFlag(R.flag) ? R.team.name + '\'s pennant, torn down the middle. You beat them here.' : 'The pennant of ' + R.team.name + ' (' + R.team.short + '). This is their room, and they are waiting.', wFlag(R.flag) ? 'g' : 'b');
    }
    case '*': {
      if (typeof wFogRevealAll === 'function') wFogRevealAll(m.id);
      return wLog('You trace the plan carved in the survey stone. Now you know every room of ' + m.name + ' (see the map, M).', 'g');
    }
    case '|': {
      if (wDepleted(x, y, W_DELVE_N.oreDays)) return wLog(DB.tiles['|'].look0, 'd');
      const g = ri(W_DELVE_N.oreGold[0], W_DELVE_N.oreGold[1]); RUN.gold += g; WG.harv[wHkey(x, y)] = WG.dayAbs; wAdvance(60); wInvalidate(m.id);
      return wLog('An hour with a borrowed pick, and the seam gives up ' + g + ' gold of ore.', 'm');
    }
    case '?': {
      if (wDepleted(x, y, W_DELVE_N.kelpDays)) return wLog(DB.tiles['?'].look0, 'd');
      const n = ri(2, 3); wAddItem('brinekelp', n); WG.harv[wHkey(x, y)] = WG.dayAbs; wAdvance(20); wInvalidate(m.id);
      return wLog('You cut ' + n + ' ' + DB.items.brinekelp.name + ' from the bed.', 'm');
    }
  }
  wLog(wLookText(x, y), 'd');
}
const wW104Use = wUse;
wUse = function (x, y) {
  const m = wCurMap(), c = wTileAt(m, x, y), u = (DB.tiles[c] || {}).use;
  if (['gate', 'lever', 'crack', 'pennant', 'survey', 'ore', 'kelp'].includes(u)) return wDelveUse(x, y);
  return wW104Use(x, y);
};

/* ---------- drawing ---------- */
function wDelveConn(e, set) { return [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => set.includes(e.at(dx, dy))); }
Object.assign(WGND, {
  '`': (c, P, r, e) => {
    c.fillStyle = tint(P.vault, -.25); c.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const p = pRR(i * 16 + .8, j * 16 + .8, 14.4, 14.4, 1); c.fillStyle = tint(P.vault, ((i + j + e.x + e.y) % 2 ? .08 : -.04)); c.fill(p); c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(i * 16 + 1, j * 16 + 1, 14, 2); wStroke(c, p, .6, 'rgba(8,6,12,.8)'); }
    if (wHash(e.x, e.y, 82) < .4) { c.save(); c.shadowColor = P.rune; c.shadowBlur = 4; c.globalAlpha = .8; const k = wHash(e.x, e.y, 83); if (k < .5) { c.beginPath(); c.arc(16, 16, 5, 0, 7); c.lineWidth = .9; c.strokeStyle = P.rune; c.stroke(); } else wLine(c, [[9, 16], [16, 9], [23, 16], [16, 23], [9, 16]], .9, P.rune); c.restore(); }
  },
  '¦': (c, P, r, e) => {
    WGND.g(c, P, r, e);
    const [u, rt, d, l] = wDelveConn(e, ['¦', '`', 'g', '[', ']', 'C', '<', '*', '}']);
    c.save(); c.shadowColor = '#b38cf0'; c.shadowBlur = 6; c.lineCap = 'round';
    const seg = (x, y) => { c.beginPath(); c.moveTo(16, 16); c.lineTo(x, y); c.lineWidth = 4; c.strokeStyle = '#2a1f3a'; c.stroke(); c.lineWidth = 1.6; c.strokeStyle = '#d8c0ff'; c.stroke(); };
    if (u) seg(16, 0); if (d) seg(16, 32); if (l) seg(0, 16); if (rt) seg(32, 16); if (!u && !d && !l && !rt) seg(16, 16);
    c.restore();
  },
  ',': (c, P, r, e) => {
    c.fillStyle = tint(P.ash, -.45); c.fillRect(0, 0, 32, 32);
    wMottle(c, r, 2, 'rgba(255,220,180,.05)', 'rgba(0,0,0,.14)');
    wStipple(c, r, 16, tint(P.ash, -.62), 1.2); wStipple(c, r, 6, tint(P.ash, -.15), 1);
    if (r() < .5) { c.save(); c.fillStyle = '#ff8a3c'; c.shadowColor = '#ff6a1a'; c.shadowBlur = 3; c.fillRect(r() * 28 + 2, r() * 28 + 2, 1.4, 1.4); c.restore(); }
  },
  ';': (c, P, r, e) => {
    WGND.g(c, P, r, e);
    c.fillStyle = 'rgba(30,80,110,.62)'; c.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 2; i++) { const x = 4 + r() * 18, y = 6 + r() * 20; wLine(c, [[x, y], [x + 4, y - 1], [x + 9, y]], .8, 'rgba(190,230,255,.45)'); }
    // the waterline where the shallows meet dry floor
    const wet = ch => ch === ';' || ch === '~' || ch === '?' || ch === '@';
    c.lineWidth = 1.4; c.strokeStyle = 'rgba(200,235,255,.5)'; c.beginPath();
    if (!wet(e.at(0, -1)) && e.at(0, -1) !== 'X') { c.moveTo(0, 1); c.lineTo(32, 1); }
    if (!wet(e.at(0, 1)) && e.at(0, 1) !== 'X') { c.moveTo(0, 31); c.lineTo(32, 31); }
    if (!wet(e.at(-1, 0)) && e.at(-1, 0) !== 'X') { c.moveTo(1, 0); c.lineTo(1, 32); }
    if (!wet(e.at(1, 0)) && e.at(1, 0) !== 'X') { c.moveTo(31, 0); c.lineTo(31, 32); }
    c.stroke();
  },
  '6': (c, P, r, e) => {
    const g = c.createRadialGradient(16, 16, 2, 16, 16, 24); g.addColorStop(0, '#000000'); g.addColorStop(1, '#151018'); c.fillStyle = g; c.fillRect(0, 0, 32, 32);
    const pit = ch => ch === '6';
    // rim: a broken stone lip and the rock face dropping away where the floor meets the edge
    c.fillStyle = tint(P.vault, -.2);
    if (!pit(e.at(0, -1))) { c.fillRect(0, 0, 32, 5); c.fillStyle = 'rgba(60,50,60,.9)'; c.fillRect(0, 5, 32, 6); c.fillStyle = tint(P.vault, -.2); }
    if (!pit(e.at(-1, 0))) c.fillRect(0, 0, 3, 32);
    if (!pit(e.at(1, 0))) c.fillRect(29, 0, 3, 32);
    if (!pit(e.at(0, 1))) c.fillRect(0, 29, 32, 3);
    c.lineWidth = 1.3; c.strokeStyle = WINKC; c.beginPath();
    if (!pit(e.at(0, -1))) { c.moveTo(0, 5); c.lineTo(32, 5); } if (!pit(e.at(0, 1))) { c.moveTo(0, 29); c.lineTo(32, 29); }
    if (!pit(e.at(-1, 0))) { c.moveTo(3, 0); c.lineTo(3, 32); } if (!pit(e.at(1, 0))) { c.moveTo(29, 0); c.lineTo(29, 32); }
    c.stroke();
    if (wHash(e.x, e.y, 84) < .3) { c.fillStyle = '#3fd0c0'; c.globalAlpha = .4; c.fillRect(10 + r() * 12, 14 + r() * 10, 1.2, 1.2); c.globalAlpha = 1; }
  },
  'ÿ': (c, P, r, e) => {
    WGND.g(c, P, r, e);
    const [u, rt, d, l] = wDelveConn(e, ['ÿ', 'g', '<', '*']);
    const vert = (u || d) && !(l || rt) ? true : (l || rt) && !(u || d) ? false : wHash(e.x, e.y, 85) < .5;
    c.save(); if (!vert) { c.translate(32, 0); c.rotate(Math.PI / 2); }
    for (let y = 2; y < 32; y += 7) { const s = pRR(6, y, 20, 3, .5); wFlat(c, s, '#5a3e26', .6); }
    wLine(c, [[10, 0], [10, 32]], 1.6, '#7a7472'); wLine(c, [[22, 0], [22, 32]], 1.6, '#7a7472');
    c.restore();
  },
  '>': (c, P, r, e) => {
    WGND[','](c, P, r, e);
    const ring = new Path2D(); ring.ellipse(16, 18, 8, 5, 0, 0, Math.PI * 2); wCel(c, ring, '#4a3a36', .8, 1.1);
    const hole = new Path2D(); hole.ellipse(16, 18, 4.5, 2.6, 0, 0, Math.PI * 2); c.fillStyle = '#1a0a06'; c.fill(hole);
    c.save(); c.shadowColor = '#ff6a1a'; c.shadowBlur = 4; c.fillStyle = 'rgba(255,120,40,.7)'; c.beginPath(); c.ellipse(16, 18.5, 2.5, 1.2, 0, 0, Math.PI * 2); c.fill(); c.restore();
    for (const a of [.4, 2.2, 4, 5.4]) wLine(c, [[16 + Math.cos(a) * 8, 18 + Math.sin(a) * 5], [16 + Math.cos(a) * 12, 18 + Math.sin(a) * 7.5]], .7, 'rgba(0,0,0,.6)');
  },
});
Object.assign(WOBJ, {
  '[': (c, P, r, e) => {
    wWallFace(c, P, e, 'X');
    const arch = new Path2D(); arch.moveTo(5, 32); arch.lineTo(5, 12); arch.quadraticCurveTo(16, 2, 27, 12); arch.lineTo(27, 32); arch.closePath();
    c.fillStyle = '#07060a'; c.fill(arch);
    c.save(); c.clip(arch); for (let x = 7; x < 27; x += 4) wLine(c, [[x, 0], [x, 32]], 1.6, '#7a7a84'); for (const y of [14, 22, 30]) wLine(c, [[4, y], [28, y]], 1.4, '#6a6a72');
    c.fillStyle = '#7a7a84'; for (let x = 7; x < 27; x += 4) { c.beginPath(); c.moveTo(x - 1.2, 31); c.lineTo(x + 1.2, 31); c.lineTo(x, 33); c.fill(); } c.restore();
    wStroke(c, arch, 1.3);
  },
  ']': (c, P, r, e, v) => {
    const down = String(v) === '0';
    wShadow(c, 16, 28, 9, 2.5, .3);
    const base = pRR(9, 20, 14, 9, 2); wCel(c, base, '#6a6a72', 1, 1.1);
    const a = down ? .9 : -.9, tx = 16 + Math.sin(a) * 15, ty = 22 - Math.cos(a) * 15;
    wLine(c, [[16, 22], [tx, ty]], 2.2, '#3a3a40'); wLine(c, [[16, 22], [tx, ty]], 1.1, '#9a9aa4');
    const k = new Path2D(); k.arc(tx, ty, 2.6, 0, 7); wFlat(c, k, '#c94a3a', .9);
  },
  '{': (c, P, r, e) => {
    wWallFace(c, P, e, 'X');
    c.save(); c.shadowColor = 'rgba(255,240,200,.6)'; c.shadowBlur = 3;
    wLine(c, [[9, 4], [13, 12], [11, 18], [17, 24], [15, 31]], 1.4, '#0a0808'); wLine(c, [[13, 12], [20, 10], [24, 15]], 1, '#0a0808'); wLine(c, [[17, 24], [23, 26]], .9, '#0a0808');
    c.restore();
    for (const [x, y] of [[6, 30], [22, 30], [26, 29]]) { const p = wBlob(x, y, 2.2, 1.5, r, 5); wFlat(c, p, tint(P.wallX, .3), .6); }
  },
  '}': (c, P, r, e, v) => {
    const R = (typeof wDungeonRooms === 'function' ? wDungeonRooms(e.m.id) : [])[(wMeta(e.m, e.x, e.y) || {}).pennant] || { team: { color: '#7a7a84', light: '#efe3c8', short: '???' } };
    const torn = String(v) === '0';
    wShadow(c, 16, 30, 7, 2, .3);
    wLine(c, [[9, 30], [9, -10]], 1.5, '#5a3e26'); c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(9, -11, 1.6, 0, 7); c.fill();
    const fl = torn ? pPoly([[9, -8], [27, -6], [20, -1], [24, 4], [15, 2], [17, 9], [9, 8]]) : pPoly([[9, -8], [28, -5], [24, 1], [28, 7], [9, 10]]);
    wCel(c, fl, torn ? tint(R.team.color, -.35) : R.team.color, 1, 1.1);
    c.save(); c.clip(fl); c.fillStyle = R.team.light; c.fillRect(9, 1, 20, 2.2); c.restore();
    txt(c, R.team.short, 17, 0, F_HUD(9), torn ? 'rgba(255,255,255,.5)' : R.team.light, 'center');
  },
  '*': (c, P, r) => {
    wShadow(c, 16, 30, 10, 3, .35);
    const st = pPoly([[8, 30], [9, 4], [16, 0], [23, 4], [24, 30]]); wCel(c, st, '#8a8f9a', 1.2, 1.3);
    wLine(c, [[11, 9], [21, 9], [21, 15], [14, 15], [14, 22], [20, 22]], .8, 'rgba(29,20,15,.75)');
    c.save(); c.shadowColor = P.rune; c.shadowBlur = 4; c.fillStyle = P.rune; c.beginPath(); c.arc(20, 22, 1.5, 0, 7); c.fill(); c.restore();
  },
  '|': (c, P, r, e, v) => {
    wWallFace(c, P, e, 'X');
    if (String(v) === '0') { for (let i = 0; i < 3; i++) { c.fillStyle = 'rgba(120,110,100,.6)'; c.fillRect(8 + i * 6, 18 + (i % 2) * 4, 2, 2); } return; }
    c.save(); c.shadowColor = '#ffd36b'; c.shadowBlur = 5;
    for (let i = 0; i < 6; i++) { const x = 5 + wHash(e.x, e.y + i, 86) * 22, y = 14 + wHash(e.x + i, e.y, 87) * 15; c.fillStyle = i % 2 ? '#ffd36b' : '#3fd0c0'; c.beginPath(); c.moveTo(x, y - 2.5); c.lineTo(x + 1.6, y); c.lineTo(x, y + 2.5); c.lineTo(x - 1.6, y); c.closePath(); c.fill(); }
    c.restore();
  },
  '?': (c, P, r, e, v) => {
    const cut = String(v) === '0';
    for (let i = 0; i < 5; i++) {
      const x = 6 + i * 5 + (r() - .5) * 2, h = cut ? 4 + r() * 2 : 14 + r() * 10;
      const p = new Path2D(); p.moveTo(x - 1.6, 28); p.quadraticCurveTo(x + 3, 28 - h / 2, x - 1, 28 - h); p.quadraticCurveTo(x + 1, 28 - h / 2, x + 1.6, 28); p.closePath();
      wCel(c, p, i % 2 ? '#3f7a4a' : '#5a8a3a', .6, .8);
    }
  },
  'ô': (c, P, r) => {
    wShadow(c, 16, 30, 8, 2.5, .35);
    const col = pRR(10, -6, 12, 36, 1.5); wCel(c, col, '#6a6e7e', 1, 1.2);
    for (const y of [-6, 26]) { const cap = pRR(8, y, 16, 4, .8); wCel(c, cap, '#8a8f9a', .8, 1); }
    c.save(); c.shadowColor = '#b38cf0'; c.shadowBlur = 6; const s = new Path2D(); s.arc(16, 9, 3.6, 0, 7); c.fillStyle = '#d8c0ff'; c.fill(s); c.restore();
    wLine(c, [[16, 5.4], [16, 12.6]], .6, '#2a1f3a'); wLine(c, [[12.4, 9], [19.6, 9]], .6, '#2a1f3a');
  },
  '@': (c, P, r) => {
    for (let i = 0; i < 6; i++) { const x = 5 + r() * 22, y = 14 + r() * 14, p = new Path2D(); p.arc(x, y, 3 + r() * 2.5, Math.PI * (1 + r() * .3), Math.PI * (1.9 + r() * .3)); p.closePath(); wCel(c, p, '#e8e0d0', .6, .8); c.save(); c.clip(p); c.fillStyle = 'rgba(200,180,230,.5)'; c.fillRect(x - 5, y - 1.5, 10, 2); c.restore(); }
  },
  'ç': (c, P, r) => {
    wShadow(c, 16, 29, 11, 3, .35);
    c.save(); c.shadowColor = '#3fd0c0'; c.shadowBlur = 5;
    for (const [x, h, a] of [[10, 18, -.3], [16, 26, 0], [22, 16, .35], [13, 11, -.15]]) {
      c.save(); c.translate(x, 29); c.rotate(a);
      const p = pPoly([[-2.6, 0], [-2.6, -h + 4], [0, -h], [2.6, -h + 4], [2.6, 0]]); c.fillStyle = '#8af0e4'; c.fill(p); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-1.6, -h + 4, 1.2, h - 6); wStroke(c, p, .8);
      c.restore();
    }
    c.restore();
  },
});
Object.assign(W_MAP_COL, { '`': '#8a86a0', '¦': '#b38cf0', ',': '#6a625c', ';': '#4a7f9a', '6': '#141018', 'ÿ': '#8a7a6a', '>': '#c96a3a', '[': '#7a7a84', ']': '#c94a3a', '{': '#6a5a5a', '}': '#e0b84a', '*': '#3fd0c0', '|': '#ffd36b', '?': '#3f7a4a', 'ô': '#6a6e7e', '@': '#e8e0d0', 'ç': '#8af0e4' });

// steam over the vents, live: a plume when it blows now, a hiss when it blows on your next step
const wW104DrawMap = wDrawMap;
wDrawMap = function (c, mapId, camX, camY, vw, vh, t, opts) {
  const out = wW104DrawMap(c, mapId, camX, camY, vw, vh, t, opts);
  const m = MAPS[mapId];
  if (!m || m.kind !== 'dungeon' || !W_DELVE[mapId] || !W_DELVE[mapId].vents || !WG) return out;
  const T = c.getTransform(), s = Math.max(.5, Math.min(8, Math.hypot(T.a, T.b))), L = WLAY[m.id]; if (!L) return out;
  const sd = L.s, bx = Math.round(T.e) - Math.round(camX * WTILE * sd), by = Math.round(T.f) - Math.round(camY * WTILE * sd);
  const x0 = Math.max(0, Math.floor(camX) - 1), y0 = Math.max(0, Math.floor(camY) - 1), x1 = Math.min(m.w, Math.ceil(camX + vw / WTILE) + 1), y1 = Math.min(m.h, Math.ceil(camY + vh / WTILE) + 1);
  c.save(); c.setTransform(sd, 0, 0, sd, bx, by);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (m.t[y][x] !== '>') continue;
    const now = wVentOn(x, y, WG.step), next = wVentOn(x, y, WG.step + 1);
    if (!now && !next) continue;
    c.save(); c.translate(x * WTILE, y * WTILE);
    for (let i = 0; i < (now ? 6 : 2); i++) {
      const k = (t * (now ? 1.6 : .8) + i / 6) % 1, px = 16 + Math.sin(i * 2.3 + t * 3) * (3 + k * 5), py = 18 - k * (now ? 34 : 12);
      c.fillStyle = now ? `rgba(240,235,230,${.7 * (1 - k)})` : `rgba(255,170,110,${.5 * (1 - k)})`;
      c.beginPath(); c.arc(px, py, (now ? 3 : 1.6) + k * (now ? 5 : 2), 0, 7); c.fill();
    }
    c.restore();
  }
  c.restore();
  return out;
};
