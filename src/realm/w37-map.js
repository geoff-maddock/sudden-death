/* w37: the map. Loads after w36-gate.js; changes earlier parts only by reassignment (saved originals carry the wW37
   prefix).

   A Map button in the world HUD (and the M key, and a Map button on the Menu) opens the map of wherever you are: the
   world, a city, a ground, a house or a dungeon, each drawn in ink. Off the world map, a World tab shows the realm.
   Every map starts dark: the tiles round your team are revealed as you walk (W_MAP.see: 5 on the world, 6 in towns,
   4 in dungeons, where it should feel like exploring), and stay revealed.
     The world   places (town, ground, dungeon, lair, the Coliseum) get their mark once their tile is seen, and their
                 name in bold once you have been there (the journal's places).
     A town      its signs label the streets (LEAGUE OFFICE), and the people, the strongboxes and the ways out show.
     A dungeon   each famous team's room is outlined in its colours and crossed off once you have beaten it; the
                 alpha, the strongboxes (open or not) and the stairs show.
   The red mark is you.

   WG.fog         the world's revealed tiles, a bitset of WW×WH bits as a base64 string (plain JSON)
   WG.fogs        { mapId: the same, for every other map }
   An older save without WG.fog is revealed round every place the journal says you have been; without WG.fogs, the
   towns you have been to are revealed whole, and the dungeons round their stairs.
   wFogSeen(x, y, id?), wFogReveal(x, y, r, id?), wFogRevealAll(id), wMapSeenCount(id?), wOpenMap(view?)
   Wrapped: wDoStep (wW37DoStep: reveal round each step), wEnterMap (wW37EnterMap: reveal where you come in),
   wStart (wW37Start: the old-save backfill), wRenderHud (wW37RenderHud: the Map button), openPause (wW37OpenPause:
   Map on the Menu), renderHelp (#wHelpMap). */

const W_MAP = { see: 5, back: 4, px: 8, seeIn: { town: 6, dungeon: 4 } };
// a flat colour for each tile, in the ink style's colours; tiles not listed are floor or wall by whether you can walk on them
const W_MAP_COL = {
  '.': '#9cbf6a', '"': '#86ad58', f: '#5f8a45', '~': '#5d8fb8', ':': '#d9c48a', s: '#6f7f55', a: '#a8a39a', c: '#7d6a58',
  L: '#d0582c', n: '#e8eef0', p: '#5d7a66', i: '#bcd8e4', '^': '#8a8178', '=': '#c9a978', b: '#a07a4e', o: '#b8aa94',
  '#': '#5a4632', X: '#4a4852', _: '#cdb68a', g: '#9a98a2', '+': '#8a5a2e', T: '#3f6a3a', J: '#7a6a54', d: '#7fae5a', w: '#5d8fb8', j: '#5d8fb8'
};
const W_MAP_FLOOR = '#c4b494', W_MAP_SOLID = '#6f5e48';
const W_MAP_KIND = { town: ['■', 'Town'], coliseum: ['♛', 'The Coliseum'], ground: ['●', 'Ground'], dungeon: ['▼', 'Dungeon'], lair: ['✶', 'Lair'] };
let wFogBits = {}, wFogFor = null; // the decoded bitsets by map id, and the WG they belong to

function wFogDims(id) { const m = id === 'world' ? null : MAPS[id]; return m ? [m.w, m.h] : [WW, WH]; }
function wFogBytes(id) {
  id = id || 'world';
  if (!WG) return null;
  if (wFogFor !== WG) { wFogBits = {}; wFogFor = WG; }
  if (wFogBits[id]) return wFogBits[id];
  const [w, h] = wFogDims(id), n = Math.ceil(w * h / 8), b = new Uint8Array(n);
  const src = id === 'world' ? WG.fog : (WG.fogs || {})[id];
  if (typeof src === 'string') { try { const s = atob(src); for (let i = 0; i < Math.min(n, s.length); i++) b[i] = s.charCodeAt(i); } catch (e) { } }
  return (wFogBits[id] = b);
}
function wFogStore(id) {
  id = id || 'world';
  const b = wFogBytes(id); if (!b) return;
  let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  if (id === 'world') WG.fog = btoa(s); else (WG.fogs = WG.fogs || {})[id] = btoa(s);
}
function wFogSeen(x, y, id) {
  const b = wFogBytes(id), [w, h] = wFogDims(id || 'world');
  if (!b || x < 0 || y < 0 || x >= w || y >= h) return false;
  const i = y * w + x; return !!(b[i >> 3] & (1 << (i & 7)));
}
function wFogReveal(x, y, r, id) {
  id = id || 'world';
  const b = wFogBytes(id), [w, h] = wFogDims(id); if (!b) return 0;
  let n = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const tx = x + dx, ty = y + dy;
    if (tx < 0 || ty < 0 || tx >= w || ty >= h || dx * dx + dy * dy > r * r + r) continue;
    const i = ty * w + tx, bit = 1 << (i & 7);
    if (!(b[i >> 3] & bit)) { b[i >> 3] |= bit; n++; }
  }
  if (n) wFogStore(id);
  return n;
}
function wFogRevealAll(id) { const b = wFogBytes(id); if (!b) return; b.fill(255); wFogStore(id); }
function wMapSeenCount(id) { const [w, h] = wFogDims(id || 'world'); let n = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (wFogSeen(x, y, id)) n++; return n; }
// the world tile you are on: your own spot on the world map, or the place whose map you are in
function wMapHere() {
  if (!WG) return null;
  const m = wCurMap();
  if (m && m.kind === 'world') return [WG.x, WG.y];
  const L = DB.locs.find(l => l.map === WG.map);
  return L ? [L.x, L.y] : null;
}
function wMapRevealHere() {
  const m = WG && wCurMap(); if (!m) return;
  if (m.kind === 'world') wFogReveal(WG.x, WG.y, W_MAP.see);
  else wFogReveal(WG.x, WG.y, W_MAP.seeIn[m.kind] || W_MAP.seeIn.town, m.id);
}

const wW37DoStep = wDoStep;
wDoStep = function () { const r = wW37DoStep.apply(this, arguments); wMapRevealHere(); return r; };
const wW37EnterMap = wEnterMap;
wEnterMap = function () { const r = wW37EnterMap.apply(this, arguments); wMapRevealHere(); return r; };
const wW37Start = wStart;
wStart = function (save) {
  const r = wW37Start.apply(this, arguments);
  const P = (typeof wJ === 'function' && wJ() && wJ().places) || {}, been = L => P[L.id] || WG.flags['seen_' + L.id] || L.id === 'graftonbury';
  if (WG && typeof WG.fog !== 'string') {
    // an older save: what you already know of the world
    for (const L of DB.locs) if (been(L)) wFogReveal(L.x, L.y, W_MAP.back);
    wFogStore();
  }
  if (WG && !WG.fogs) {
    WG.fogs = {};
    // an older save: the places you have been, a town whole and a dungeon round its stairs (a new journey starts dark)
    if (save) for (const L of DB.locs) {
      const m = L.map && MAPS[L.map]; if (!m || !(P[L.id] || WG.flags['seen_' + L.id])) continue;
      if (m.kind === 'dungeon') wFogReveal(m.spawn[0], m.spawn[1], W_MAP.seeIn.dungeon, m.id); else wFogRevealAll(m.id);
    }
  }
  wMapRevealHere();
  return r;
};

/* ---------- drawing ---------- */
function wMapTileCol(ch, under) {
  return W_MAP_COL[ch] || W_MAP_COL[under] || (DB.tiles[ch] && DB.tiles[ch].walk ? W_MAP_FLOOR : W_MAP_SOLID);
}
// fill the seen tiles, then ink the edge of what you know
function wMapPaint(c, m, S, id) {
  c.fillStyle = '#e9dcbc'; c.fillRect(0, 0, m.w * S, m.h * S);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!wFogSeen(x, y, id)) continue;
    c.fillStyle = wMapTileCol(m.t[y][x], (m.meta[x + ',' + y] || {}).under);
    c.fillRect(x * S, y * S, S, S);
  }
  c.save(); c.strokeStyle = 'rgba(60,40,20,.55)'; c.lineWidth = 1; c.beginPath();
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!wFogSeen(x, y, id)) continue;
    if (!wFogSeen(x, y - 1, id)) { c.moveTo(x * S, y * S + .5); c.lineTo(x * S + S, y * S + .5); }
    if (!wFogSeen(x, y + 1, id)) { c.moveTo(x * S, y * S + S - .5); c.lineTo(x * S + S, y * S + S - .5); }
    if (!wFogSeen(x - 1, y, id)) { c.moveTo(x * S + .5, y * S); c.lineTo(x * S + .5, y * S + S); }
    if (!wFogSeen(x + 1, y, id)) { c.moveTo(x * S + S - .5, y * S); c.lineTo(x * S + S - .5, y * S + S); }
  }
  c.stroke(); c.restore();
}
function wMapLabel(c, text, x, y, size, bold, col) {
  c.font = `${bold ? 'bold ' : ''}${size}px Georgia, serif`; c.lineWidth = 3; c.strokeStyle = 'rgba(233,220,188,.9)';
  c.strokeText(text, x, y); c.fillStyle = col || '#2a1c10'; c.fillText(text, x, y);
}
function wMapYou(c, x, y) { c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fillStyle = '#c94a3a'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff6e0'; c.stroke(); }
function wMapDraw(cv) {
  const S = W_MAP.px, c = cv.getContext('2d'), m = MAPS.world;
  cv.width = WW * S; cv.height = WH * S;
  wMapPaint(c, m, S, 'world');
  // places, then you
  const P = (typeof wJ === 'function' && wJ() && wJ().places) || {};
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const L of wMapPlaces()) {
    const cx = L.x * S + S / 2, cy = L.y * S + S / 2, been = !!P[L.id], small = L.kind === 'ground';
    wMapMark(c, L.kind, cx, cy);
    // grounds sit beside their city: a smaller name, on the side away from it, so the two do not run together
    const city = small && DB.locs.find(l => l.id === L.city), ty = !small ? cy - 13 : city && L.y < city.y ? cy - 11 : cy + 12;
    wMapLabel(c, L.name, cx, ty, small ? 11 : 13, been, been ? '#2a1c10' : '#6b5a44');
  }
  const h = wMapHere();
  if (h) wMapYou(c, h[0] * S + S / 2, h[1] * S + S / 2);
  c.restore();
}
// the map of a town, a ground, a house or a dungeon
function wMapPx(m) { return Math.max(8, Math.min(16, Math.floor(768 / m.w))); }
function wMapDrawLocal(cv, id) {
  const m = MAPS[id], S = wMapPx(m), c = cv.getContext('2d'), at = (x, y) => [x * S + S / 2, y * S + S / 2];
  cv.width = m.w * S; cv.height = m.h * S;
  wMapPaint(c, m, S, id);
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
  // a dungeon's rooms: each famous team's, outlined in its colours, crossed off once beaten
  if (m.kind === 'dungeon' && typeof wDungeonRooms === 'function') for (const R of wDungeonRooms(id)) {
    let seen = false; for (let y = R.y; y < R.y + R.h && !seen; y++) for (let x = R.x; x < R.x + R.w; x++) if (wFogSeen(x, y, id)) { seen = true; break; }
    if (!seen) continue;
    const beat = wFlag(R.flag);
    c.lineWidth = 2; c.strokeStyle = beat ? 'rgba(60,40,20,.45)' : R.team.color; c.strokeRect(R.x * S + 1, R.y * S + 1, R.w * S - 2, R.h * S - 2);
    const [cx, cy] = at(R.cx, R.cy);
    if (beat) { c.strokeStyle = 'rgba(60,40,20,.7)'; c.beginPath(); c.moveTo(cx - 7, cy - 7); c.lineTo(cx + 7, cy + 7); c.moveTo(cx + 7, cy - 7); c.lineTo(cx - 7, cy + 7); c.stroke(); }
    wMapLabel(c, R.team.short, cx, R.y * S + 9, 11, !beat, beat ? '#6b5a44' : '#2a1c10');
  }
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!wFogSeen(x, y, id)) continue;
    const ch = m.t[y][x], mt = m.meta[x + ',' + y] || {}, [cx, cy] = at(x, y);
    if (ch === 'C') { const open = mt.chest && wFlag('chest_' + mt.chest); c.lineWidth = 1.5; c.strokeStyle = '#2a1c10'; c.fillStyle = open ? '#e9dcbc' : '#c9a24a'; c.fillRect(cx - 5, cy - 4, 10, 8); c.strokeRect(cx - 5, cy - 4, 10, 8); }
    else if (ch === 'M') { wMapMark(c, 'lair', cx, cy); wMapLabel(c, mt.alpha && wFlag('alpha_' + mt.alpha) ? 'Alpha (beaten)' : 'Alpha', cx, cy - 13, 11, true); }
    else if (DB.tiles[ch] && DB.tiles[ch].enter) { c.fillStyle = '#2a1c10'; c.beginPath(); c.moveTo(cx, cy - 6); c.lineTo(cx + 6, cy + 4); c.lineTo(cx - 6, cy + 4); c.closePath(); c.fill(); }
    else if (ch === 'S' && mt.text && !mt.under) { const name = mt.text.split('.')[0]; if (name.length <= 26 && name === name.toUpperCase()) wMapLabel(c, name, cx, cy - 10, 11, true); }
  }
  for (const n of m.npcs || []) if (wFogSeen(n.x, n.y, id)) { const [cx, cy] = at(n.x, n.y); c.beginPath(); c.arc(cx, cy, 3.5, 0, Math.PI * 2); c.fillStyle = '#3a5a9a'; c.fill(); }
  if (WG.map === id) { const [cx, cy] = at(WG.x, WG.y); wMapYou(c, cx, cy); }
  c.restore();
}
// a place's mark, inked: the same shapes as the key's glyphs
function wMapMark(c, kind, x, y) {
  c.save(); c.fillStyle = '#2a1c10'; c.strokeStyle = '#fff6e0'; c.lineWidth = 1.5; c.beginPath();
  if (kind === 'town') c.rect(x - 5, y - 5, 10, 10);
  else if (kind === 'ground') c.arc(x, y, 4.5, 0, Math.PI * 2);
  else if (kind === 'dungeon') { c.moveTo(x - 6, y - 4); c.lineTo(x + 6, y - 4); c.lineTo(x, y + 6); c.closePath(); }
  else if (kind === 'lair') for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.8 : 7; c[i ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a)); }
  else { c.moveTo(x - 6, y + 5); c.lineTo(x - 6, y - 3); c.lineTo(x - 3, y); c.lineTo(x, y - 6); c.lineTo(x + 3, y); c.lineTo(x + 6, y - 3); c.lineTo(x + 6, y + 5); c.closePath(); } // the Coliseum's crown
  if (kind === 'lair') c.closePath();
  c.fill(); c.stroke(); c.restore();
}
// the places whose tile you have seen
function wMapPlaces() { return DB.locs.filter(L => W_MAP_KIND[L.kind] && wFogSeen(L.x, L.y)); }

const W_MAP_LOCAL_KEY = { town: [['▲', 'A way out'], ['●', 'Somebody to talk to'], ['■', 'A strongbox']], dungeon: [['▲', 'Stairs'], ['✕', 'A team you have beaten'], ['✶', 'The alpha'], ['■', 'A strongbox (open, pale)']] };
function wOpenMap(view) {
  if (!WG || !RUN) return;
  WUI.held = null; WUI.goto = null;
  const m = wCurMap(), local = m.kind !== 'world', show = local && view !== 'world' ? m.id : 'world';
  const tabs = local ? `<div class="filters wmaptabs" role="tablist"><button role="tab" data-wmapv="here" aria-selected="${show !== 'world'}">${esc(m.name)}</button><button role="tab" data-wmapv="world" aria-selected="${show === 'world'}">The realm</button></div>` : '';
  let hint, key;
  if (show === 'world') {
    const pct = Math.round(100 * wMapSeenCount() / (WW * WH)), where = m.kind === 'world' ? (wRegionName() || m.name) : m.name;
    hint = `You are in ${esc(where)} (the red mark). You have seen ${pct}% of the realm. The map fills in as your team walks the world.`;
    key = Object.values(W_MAP_KIND).map(([g, n]) => `<span><b>${g}</b> ${n}</span>`).join('') + '<span>Bold: you have been there</span>';
  } else {
    const pct = Math.round(100 * wMapSeenCount(m.id) / (m.w * m.h));
    hint = `You have seen ${pct}% of ${esc(m.name)}. It fills in as you walk${m.kind === 'dungeon' ? ' the halls' : ''}. The red mark is you.`;
    key = (W_MAP_LOCAL_KEY[m.kind] || W_MAP_LOCAL_KEY.town).map(([g, n]) => `<span><b>${g}</b> ${n}</span>`).join('');
  }
  modal(`<header><h3>${show === 'world' ? 'Map of the realm' : 'Map: ' + esc(m.name)}</h3><button class="ghost" data-close>Close</button></header>${tabs}
    <p class="hint">${hint}</p>
    <div class="wmapbox"><canvas id="wMapCv" aria-label="${show === 'world' ? 'Map of the realm' : 'Map of ' + esc(m.name)}"></canvas></div>
    <p class="hint wmapkey">${key}</p>`,
    () => { WUI.hudKey = ''; wDrain(); });
  if (show === 'world') wMapDraw($('wMapCv')); else wMapDrawLocal($('wMapCv'), show);
  $('modalBox').querySelectorAll('[data-wmapv]').forEach(b => b.onclick = () => { const v = b.dataset.wmapv; $('modalBox').querySelector('[data-close]').click(); wOpenMap(v); });
}

/* the Map button, beside the Journal; M opens it */
const wW37RenderHud = wRenderHud;
wRenderHud = function () {
  wW37RenderHud();
  if (!WUI.built || !WG) return;
  const j = $('wJournalBtn');
  if (j && !$('wMapBtn')) {
    j.insertAdjacentHTML('afterend', `<button class="ghost wcampb" id="wMapBtn" title="Map of where you are, and of the realm (M)">Map</button>`);
    $('wMapBtn').onclick = () => { if (wActive()) wOpenMap(); };
  }
};
document.addEventListener('keydown', e => {
  if ((e.key === 'm' || e.key === 'M') && wActive() && !WUI.talk && !(e.target.closest && e.target.closest('input,textarea,select')) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); wOpenMap(); }
});
const wW37OpenPause = openPause;
openPause = function () {
  const r = wW37OpenPause.apply(this, arguments);
  const btns = document.querySelector('#pause .pbtns');
  if (WG && UI.paused && UI.view === 'world' && btns && !$('pMap')) {
    btns.insertAdjacentHTML('beforeend', '<button class="ghost" id="pMap">Map</button>');
    $('pMap').onclick = () => { closePause(); wOpenMap(); };
  }
  return r;
};

const wW37RenderHelp = renderHelp;
renderHelp = function () {
  wW37RenderHelp();
  const sec = $('wHelp'); if (!sec || $('wHelpMap')) return;
  sec.insertAdjacentHTML('beforeend', `<div id="wHelpMap"><h4>The map</h4>
    <p class="hint"><b>Map</b> (<kbd>M</kbd>, or from the Menu) shows wherever you are: the realm, a city, a ground or a dungeon, with a tab for the realm when you are inside somewhere. Every map starts dark and fills in round your team as you walk, and what you have seen stays on it. On the realm, towns, grounds, dungeons and lairs get their mark once you have seen them, and their name in bold once you have been there. In a city, the signs name the streets and the people show; in a dungeon, each famous team's room is crossed off once you beat it, and the alpha, the strongboxes and the stairs show. The red mark is you.</p></div>`);
};
