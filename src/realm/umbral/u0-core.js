/* u0: the Umbral Realm's plumbing (issue #99, phase 0). Loads after every other Realm part (it wraps the map builder
   once the others have laid their things on the maps); changes earlier parts only by reassignment (saved originals
   carry the wWU0 prefix).

   The state, WG.umbral (plain JSON), from the unlock on: { at (dayAbs), year, crossed (times through the portal),
   pieces [ids], beaten {champion: dayAbs}, tries {champion: n}, finale (the round reached, 0 before it), sealed (0/1),
   need [the piece ids the Seal asks for: every piece at the unlock; issue #117, phase 11, u3's wUmbNeed] }.
   Unlocked the first time the Crown is won on a journey (the 'champion' flag), or on loading a journey that won it
   before the Umbral existed. Phase 1 turns the unlock into its scene; here it is a line in the log.
   The dark maps: MAPS['u:' + id], built with the light ones, from them, by a fixed transform (nothing about the maps
   is saved): the same tiles under dark palettes (WINK['u' + region]), what can be used taken away (wells, nests,
   bushes, eggs: the Umbral's own come later), people left behind, and the signs gone wrong. W_UMB.maps lists the ones
   built so far: the world and the Road to Nowhere. On the dark world every other place is shut till phase 2.
   The portal: a tile ('D', meta.portal) at the end of the Road to Nowhere, on both sides; the light one shows only
   once the Umbral is open. Stepping into it crosses. Leaving the dark road comes out on the dark world, and walking
   into the Road to Nowhere there goes back to it.
   On the dark side: region names are the dark ones (W_UMB.regions), it is never brighter than dusk, and the world
   map's fog is left alone (phase 2 gives the Umbral its own).

   W_UMB, wUmb, wUmbOn, wUmbDark, wUmbralUnlock, wUmbralMap, wUmbCross, wUmbPortalAt
   Wraps: buildAllMaps (wWU0BuildAllMaps: the dark maps and the light portal's spot), wTileAt (wWU0TileAt: the light
   portal, once open), wLookText (wWU0LookText: its words, once open), wInvalidate (wWU0Invalidate: a dark copy's
   picture with its light map's), wAmbient (wWU0Ambient: the dark regions' arrival lines), renderTitle
   (wWU0RenderTitle: a dark place's name on the Continue row), wStepEnter (wWU0StepEnter: the portal; places on the dark world), wLeaveToWorld
   (wWU0LeaveToWorld: off a dark place onto the dark world), wUse (wWU0Use: a lair on the dark world is shut), wRegionHere (wWU0RegionHere: a dark place's own region),
   wRegionName (wWU0RegionName), wDarkness (wWU0Darkness), wMapRevealHere (wWU0MapRevealHere), wSetFlag
   (wWU0SetFlag: the Crown unlocks it), wStart (wWU0Start: a journey that won the Crown before). */

const W_UMB = {
  maps: ['world', 'umbralden'],
  names: { world: 'The Umbral Realm', umbralden: 'The Road to Somewhere' },
  regions: { plains: 'The Severed Plains', bloom: 'The Rotwold', tide: 'The Drownfen', ember: 'The Ashmaw', rime: 'The Deadspire' },
  // each region's sickly accent, in its runes, banners and glows
  accent: { plains: '#c8b8ff', bloom: '#b6ff6a', tide: '#5fffd2', ember: '#ff4a6a', rime: '#9fffe8' },
  signs: { umbralden: 'Somebody made this road. It was here before the spring, and it goes somewhere, and at the end of it something waits for the light.' },
  // the portal, at the end of the Road to Nowhere, past the nest
  portal: { umbralden: [16, 6] },
  dusk: .28,   // dim, but under wIsNight's .3: the dark side's rules are day's till its own night
};

const wUmb = () => (typeof WG !== 'undefined' && WG && WG.umbral) || null;
const wUmbOn = () => !!wUmb();
// the portal is open: the Umbral is, and the Seal is not yet forged
const wUmbOpen = () => !!wUmb() && !wUmb().sealed;
// the map you are on is a dark one
const wUmbDark = m => !!(m || (typeof WG !== 'undefined' && WG && MAPS[WG.map]) || {}).umbral;

function wUmbralUnlock() {
  if (typeof WG === 'undefined' || !WG || WG.umbral) return false;
  // (need: the pieces this Umbral's Seal asks for, every one there is as it opens: u3's wUmbNeed)
  WG.umbral = { at: WG.dayAbs || 0, year: WG.year || 1, crossed: 0, pieces: [], beaten: {}, tries: {}, finale: 0, sealed: 0, need: Object.keys(W_UMB_PIECES) };
  // the Road to Nowhere is on the map from now on, found or not
  wSetFlag('clue_den');
  wInvalidate('umbralden'); wInvalidate('world');
  if (!LAB) wLog('Far to the north, at the end of the Road to Nowhere, something has opened. The snow there is black.', 'b');
  return true;
}

/* ---------- the dark palettes: each region's, drained, darkened and turned toward violet ---------- */
function wUmbCol(c, k) {
  if (typeof c !== 'string' || !/^(#|rgb)/.test(c)) return c;
  const [r, g, b] = rgbOf(c), l = r * .3 + g * .59 + b * .11, mix = (v, gray) => v + (gray - v) * .62;
  const d = (k == null ? .62 : k), v = [mix(r, l) * d + 22, mix(g, l) * d + 10, mix(b, l) * d + 30];
  return `rgb(${v.map(x => Math.max(0, Math.min(255, Math.round(x)))).join(',')})`;
}
function wUmbPal(p, id) {
  const o = { id: 'u' + id };
  for (const k in p) {
    if (k === 'id' || k === 'under' || k === 'name') continue;
    const v = p[k];
    o[k] = Array.isArray(v) ? v.map(x => wUmbCol(x)) : (k === 'ink' || k === 'paper') ? v : wUmbCol(v);
  }
  Object.assign(o, { name: W_UMB.regions[id], accent: W_UMB.accent[id], rune: W_UMB.accent[id], water: '#2a1a30', wtint: 'rgba(40,0,50,.38)',
    snow: '#9a948b', ice: '#6a7680', lava: '#b8203a', flowers: ['#6e5a7e', '#a898b8'], flowerP: p.flowerP * .5, dark: .25 });
  o.under = Object.assign({}, o, { id: o.id + ':under', dark: 1, vault: tint(o.vault, -.2), wallX: tint(o.wallX, -.25), grass: tint(o.grass, -.3), road: tint(o.road, -.3) });
  return o;
}
for (const id of Object.keys(W_UMB.regions)) WINK['u' + id] = wUmbPal(WINK[id], id);

/* ---------- the dark maps ---------- */
// a ground tile beside (x, y) to stand in for something taken away
function wUmbGround(t, x, y, fall) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) {
    const c = t[y + dy] && t[y + dy][x + dx], td = c && DB.tiles[c];
    if (td && td.walk && td.ground && !td.use && !td.enter) return c;
  }
  return fall;
}
// a free tile beside the portal, to arrive on
function wUmbBeside(m, x, y) {
  for (const [dx, dy] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
    const nx = x + dx, ny = y + dy, c = wTileAt(m, nx, ny), td = c && DB.tiles[c];
    if (td && td.walk && !td.enter && !(m.npcs || []).some(n => n.x === nx && n.y === ny)) return [nx, ny];
  }
  return m.spawn.slice();
}
function wUmbralMap(m) {
  const t = m.t.map(r => r.slice()), u = { id: 'u:' + m.id, name: W_UMB.names[m.id] || m.name, kind: m.kind, w: m.w, h: m.h, t, meta: {}, npcs: [], spawn: m.spawn.slice(), light: [], umbral: 1, blds: (m.blds || []).map(b => b.slice()) };
  if (m.kind === 'world') {
    u.region = m.region.map(r => 'u' + r);
    u.sea = 'uplains'; u.voidCol = '#120c18';
  } else {
    const L = DB.locs.find(l => l.map === m.id);
    u.region = 'u' + (L ? regionAt(L.x, L.y) : 'plains');
  }
  const gc = m.kind === 'world' ? '.' : (DB.towns.find(d => d.id === m.id) || {}).ground || '.';
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = t[y][x], td = DB.tiles[c] || {}, mt = m.meta[x + ',' + y];
    // the places stay where they are (shut, till theirs are built)
    if (mt && mt.loc) { u.meta[x + ',' + y] = { loc: mt.loc, under: mt.under }; continue; }
    if (c === 'S') { u.meta[x + ',' + y] = { text: W_UMB.signs[m.id] || (mt && mt.text) || '...' }; continue; }
    if (td.use) t[y][x] = (mt && mt.under) || wUmbGround(m.t, x, y, gc);
  }
  return u;
}
// a portal on a map. The dark one is a tile with its words and a light. The light one is only a spot (m.uPortal): the
// map's own tiles and meta are left as they were, and wTileAt and wLookText show it once the Umbral is open, so
// nothing reading the raw map (the local map, Look) gives it away before the Crown
function wUmbPortal(m, x, y, dark) {
  if (!dark) { m.uPortal = [x, y]; return; }
  m.t[y][x] = 'D';
  m.meta[x + ',' + y] = { portal: 1, look: 'The portal, from the wrong side. Through it, faintly, snow that is white.' };
  m.light.push([x, y, 3.2]);
}
const wUmbPortalAt = (m, x, y) => !!m && (m.uPortal ? m.uPortal[0] === x && m.uPortal[1] === y && wUmbOpen() : !!(m.meta[x + ',' + y] || {}).portal);
const wWU0BuildAllMaps = buildAllMaps;
buildAllMaps = function () {
  const r = wWU0BuildAllMaps.apply(this, arguments);
  for (const id of W_UMB.maps) if (MAPS[id]) MAPS['u:' + id] = wUmbralMap(MAPS[id]);
  for (const id in W_UMB.portal) {
    const [x, y] = W_UMB.portal[id];
    if (MAPS[id]) wUmbPortal(MAPS[id], x, y, false);
    if (MAPS['u:' + id]) wUmbPortal(MAPS['u:' + id], x, y, true);
  }
  return r;
};
// the light portal is there once the Umbral opens
const wWU0TileAt = wTileAt;
wTileAt = function (map, x, y) {
  const c = wWU0TileAt(map, x, y);
  return map.uPortal && map.uPortal[0] === x && map.uPortal[1] === y && wUmbOpen() ? 'D' : c;
};
const wWU0LookText = wLookText;
wLookText = function (x, y) {
  const m = wCurMap();
  if (m && m.uPortal && wUmbPortalAt(m, x, y)) return 'A tear in the air at the end of the road. The snow around it is black, and cold comes out of it.';
  return wWU0LookText.apply(this, arguments);
};
// a picture cached for a light map is cached for its dark copy too: clear both (a clue that shows a place, the unlock)
const wWU0Invalidate = wInvalidate;
wInvalidate = function (mapId) {
  wWU0Invalidate.apply(this, arguments);
  if (mapId != null && W_UMB.maps.includes(mapId)) wWU0Invalidate('u:' + mapId);
};

/* ---------- crossing ---------- */
function wUmbCross() {
  const m = wCurMap(), U = wUmb(); if (!U || !m.uPortal && !m.umbral) return false;
  const to = MAPS[m.umbral ? m.id.slice(2) : 'u:' + m.id]; if (!to) return false;
  const p = Object.keys(to.meta).find(k => to.meta[k].portal), [px, py] = to.uPortal || (p ? p.split(',').map(Number) : to.spawn);
  const [ax, ay] = wUmbBeside(to, px, py);
  // (counted before the map changes, which saves)
  if (to.umbral) U.crossed = (U.crossed || 0) + 1;
  wEnterMap(to.id, ax, ay); WG.face = ax < px ? 'l' : ax > px ? 'r' : ay < py ? 'u' : 'd';
  if (to.umbral) { wLog(U.crossed === 1 ? 'You step through. The cold goes into your teeth. The road runs on, the same road, and the snow on it is grey as ash.' : 'You step through, into the Umbral.', 'b'); }
  else wLog('You step back through. White snow, and a sky with colour in it.', 'g');
  return true;
}
const wWU0StepEnter = wStepEnter;
wStepEnter = function (c, x, y) {
  const m = wCurMap(), mt = m.meta[x + ',' + y];
  if (c === 'D' && wUmbPortalAt(m, x, y)) { wUmbCross(); return; }
  if (m.umbral && m.kind === 'world' && mt && mt.loc) {
    const L = DB.locs.find(l => l.id === mt.loc), to = L && MAPS['u:' + L.map];
    if (!to) {
      wLog(`${L ? L.name : 'The place'}, on this side: the way in is shut, and something moves behind it.`, 'd');
      const bk = wTileAt(m, x, y + 1); if (bk && DB.tiles[bk] && DB.tiles[bk].walk) WG.y = y + 1;
      return;
    }
    wEnterMap(to.id, to.spawn[0], to.spawn[1]); WG.face = 'u';
    wLog(to.name + '.', 'd');
    return;
  }
  return wWU0StepEnter(c, x, y);
};
// a place used rather than walked into (an alpha's lair): shut on the dark world too
const wWU0Use = wUse;
wUse = function (x, y) {
  const m = wCurMap(), mt = m && m.meta[x + ',' + y];
  if (m && m.umbral && mt && mt.loc && !MAPS['u:' + ((DB.locs.find(l => l.id === mt.loc) || {}).map || '')]) {
    const L = DB.locs.find(l => l.id === mt.loc);
    return wLog(`${L ? L.name : 'The place'}, on this side: the way in is shut, and something moves behind it.`, 'd');
  }
  return wWU0Use.apply(this, arguments);
};
const wWU0LeaveToWorld = wLeaveToWorld;
wLeaveToWorld = function () {
  const m = wCurMap();
  if (!m || !m.umbral || m.kind === 'world') return wWU0LeaveToWorld.apply(this, arguments);
  const L = DB.locs.find(l => l.map === m.id.slice(2)); if (!L || !MAPS['u:world']) return;
  wEnterMap('u:world', L.x, L.y + 1); WG.face = 'd';
  wLog('You leave ' + m.name + '.', 'd');
};

/* ---------- the dark side: its regions, its dusk, its fog ---------- */
const wWU0RegionHere = wRegionHere;
wRegionHere = function () {
  const m = wCurMap();
  if (!m || !m.umbral || m.kind === 'world') return wWU0RegionHere.apply(this, arguments);
  const L = DB.locs.find(l => l.map === m.id.slice(2));
  return L ? regionAt(L.x, L.y) : 'plains';
};
const wWU0RegionName = wRegionName;
wRegionName = function () { return wUmbDark() ? (W_UMB.regions[wRegionHere()] || '') : wWU0RegionName.apply(this, arguments); };
const wWU0Darkness = wDarkness;
wDarkness = function () { const d = wWU0Darkness.apply(this, arguments); return wUmbDark() ? Math.max(W_UMB.dusk, d) : d; };
const wWU0MapRevealHere = wMapRevealHere;
wMapRevealHere = function () { if (wUmbDark()) return; return wWU0MapRevealHere.apply(this, arguments); };

// crossing a border on the dark world says the dark region's name, not the light one's
W_UMB.arrive = { plains: 'The Severed Plains. The grass is ash and the roads run the same, almost.', bloom: 'The Rotwold. The trees are grey and soft, and nothing sings in them.',
  tide: 'The Drownfen. The water is black and very still, and it is watching.', ember: 'The Ashmaw. Cold cinders, and smoke that drifts the wrong way.', rime: 'The Deadspire. Bone-grey snow, and no tracks in it but yours.' };
const wWU0Ambient = wAmbient;
wAmbient = function (m, preReg) {
  if (m && m.umbral && m.kind === 'world') { const rg = regionAt(WG.x, WG.y); if (rg !== preReg && W_UMB.arrive[rg]) wLog(W_UMB.arrive[rg], 'd'); return; }
  return wWU0Ambient.apply(this, arguments);
};
// the title's Continue row names a dark place by its name, not its map id
const wWU0RenderTitle = renderTitle;
renderTitle = function () {
  const r = wWU0RenderTitle.apply(this, arguments), sv = wLoadSave(), id = sv && sv.WG && sv.WG.map, sp = $('resumeRow') && $('resumeRow').querySelector('span');
  if (sp && typeof id === 'string' && id.startsWith('u:')) sp.textContent = sp.textContent.replace(id, W_UMB.names[id.slice(2)] || 'The Umbral Realm');
  return r;
};

/* ---------- the unlock ---------- */
const wWU0SetFlag = wSetFlag;
wSetFlag = function (f) { const had = wFlag(f); wWU0SetFlag.apply(this, arguments); if (f === 'champion' && !had) wUmbralUnlock(); };
const wWU0Start = wStart;
wStart = function (save) {
  const r = wWU0Start.apply(this, arguments);
  if (WG && wFlag('champion') && !WG.umbral) { wUmbralUnlock(); wSave(); }
  return r;
};
