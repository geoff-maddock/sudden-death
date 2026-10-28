/* w37: the map of the realm. Loads after w36-gate.js; changes earlier parts only by reassignment (saved originals carry
   the wW37 prefix).

   A Map button in the world HUD (and the M key, and a Map button on the Menu) opens the world map drawn in ink. It
   starts blank: every tile within W_MAP.see of your team is revealed as you walk the world map, and stays revealed.
   A place (town, ground, dungeon, lair, the Coliseum) gets its mark once its tile is revealed, and its name in bold
   once you have been there (the journal's places). In a town, a ground or a dungeon, "you are here" is that place
   on the world.

   WG.fog   the revealed tiles, a bitset of WW×WH bits as a base64 string (plain JSON). An older save without one is
            revealed around every place the journal says you have been, and around where you stand.
   wFogSeen(x, y), wFogReveal(x, y, r), wMapSeenCount(), wOpenMap()
   Wrapped: wDoStep (wW37DoStep: reveal round each step), wEnterMap (wW37EnterMap: reveal where you come out),
   wStart (wW37Start: the old-save backfill), wRenderHud (wW37RenderHud: the Map button), openPause (wW37OpenPause:
   Map on the Menu), renderHelp (#wHelpMap). */

const W_MAP = { see: 5, back: 4, px: 8 };
// a flat colour for each world tile, in the ink style's colours
const W_MAP_COL = {
  '.': '#9cbf6a', '"': '#86ad58', f: '#5f8a45', '~': '#5d8fb8', ':': '#d9c48a', s: '#6f7f55', a: '#a8a39a', c: '#7d6a58',
  L: '#d0582c', n: '#e8eef0', p: '#5d7a66', i: '#bcd8e4', '^': '#8a8178', '=': '#c9a978', b: '#a07a4e', o: '#b8aa94'
};
const W_MAP_KIND = { town: ['■', 'Town'], coliseum: ['♛', 'The Coliseum'], ground: ['●', 'Ground'], dungeon: ['▼', 'Dungeon'], lair: ['✶', 'Lair'] };
let wFogBits = null, wFogFor = null; // the decoded bitset, and the WG it belongs to

function wFogBytes() {
  if (!WG) return null;
  if (wFogFor === WG && wFogBits) return wFogBits;
  const n = Math.ceil(WW * WH / 8), b = new Uint8Array(n);
  if (typeof WG.fog === 'string') { try { const s = atob(WG.fog); for (let i = 0; i < Math.min(n, s.length); i++) b[i] = s.charCodeAt(i); } catch (e) { } }
  wFogBits = b; wFogFor = WG;
  return b;
}
function wFogStore() { const b = wFogBytes(); if (!b) return; let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); WG.fog = btoa(s); }
function wFogSeen(x, y) { const b = wFogBytes(); if (!b || x < 0 || y < 0 || x >= WW || y >= WH) return false; const i = y * WW + x; return !!(b[i >> 3] & (1 << (i & 7))); }
function wFogReveal(x, y, r) {
  const b = wFogBytes(); if (!b) return 0;
  let n = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const tx = x + dx, ty = y + dy;
    if (tx < 0 || ty < 0 || tx >= WW || ty >= WH || dx * dx + dy * dy > r * r + r) continue;
    const i = ty * WW + tx, bit = 1 << (i & 7);
    if (!(b[i >> 3] & bit)) { b[i >> 3] |= bit; n++; }
  }
  if (n) wFogStore();
  return n;
}
function wMapSeenCount() { let n = 0; for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) if (wFogSeen(x, y)) n++; return n; }
// the world tile you are on: your own spot on the world map, or the place whose map you are in
function wMapHere() {
  if (!WG) return null;
  const m = wCurMap();
  if (m && m.kind === 'world') return [WG.x, WG.y];
  const L = DB.locs.find(l => l.map === WG.map);
  return L ? [L.x, L.y] : null;
}
function wMapRevealHere() { const m = WG && wCurMap(); if (m && m.kind === 'world') wFogReveal(WG.x, WG.y, W_MAP.see); }

const wW37DoStep = wDoStep;
wDoStep = function () { const r = wW37DoStep.apply(this, arguments); wMapRevealHere(); return r; };
const wW37EnterMap = wEnterMap;
wEnterMap = function () { const r = wW37EnterMap.apply(this, arguments); wMapRevealHere(); return r; };
const wW37Start = wStart;
wStart = function () {
  const r = wW37Start.apply(this, arguments);
  if (WG && typeof WG.fog !== 'string') {
    // an older save: what you already know of the world
    const P = (typeof wJ === 'function' && wJ() && wJ().places) || {};
    for (const L of DB.locs) if (P[L.id] || WG.flags['seen_' + L.id] || L.id === 'graftonbury') wFogReveal(L.x, L.y, W_MAP.back);
    wFogStore();
  }
  wMapRevealHere();
  return r;
};

/* ---------- the map ---------- */
function wMapDraw(cv) {
  const S = W_MAP.px, c = cv.getContext('2d'), m = MAPS.world;
  cv.width = WW * S; cv.height = WH * S;
  c.fillStyle = '#e9dcbc'; c.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    if (!wFogSeen(x, y)) continue;
    const ch = m.t[y][x], under = (m.meta[x + ',' + y] || {}).under;
    c.fillStyle = W_MAP_COL[ch] || W_MAP_COL[under] || W_MAP_COL['.'];
    c.fillRect(x * S, y * S, S, S);
  }
  // the edge of what you know, inked
  c.save(); c.strokeStyle = 'rgba(60,40,20,.55)'; c.lineWidth = 1; c.beginPath();
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    if (!wFogSeen(x, y)) continue;
    if (!wFogSeen(x, y - 1)) { c.moveTo(x * S, y * S + .5); c.lineTo(x * S + S, y * S + .5); }
    if (!wFogSeen(x, y + 1)) { c.moveTo(x * S, y * S + S - .5); c.lineTo(x * S + S, y * S + S - .5); }
    if (!wFogSeen(x - 1, y)) { c.moveTo(x * S + .5, y * S); c.lineTo(x * S + .5, y * S + S); }
    if (!wFogSeen(x + 1, y)) { c.moveTo(x * S + S - .5, y * S); c.lineTo(x * S + S - .5, y * S + S); }
  }
  c.stroke(); c.restore();
  // places, then you
  const P = (typeof wJ === 'function' && wJ() && wJ().places) || {};
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const L of wMapPlaces()) {
    const cx = L.x * S + S / 2, cy = L.y * S + S / 2, been = !!P[L.id], small = L.kind === 'ground';
    wMapMark(c, L.kind, cx, cy);
    // grounds sit beside their city: a smaller name, on the side away from it, so the two do not run together
    const city = small && DB.locs.find(l => l.id === L.city), ty = !small ? cy - 13 : city && L.y < city.y ? cy - 11 : cy + 12;
    c.font = `${been ? 'bold ' : ''}${small ? 11 : 13}px Georgia, serif`; c.lineWidth = 3; c.strokeStyle = 'rgba(233,220,188,.9)';
    c.strokeText(L.name, cx, ty); c.fillStyle = been ? '#2a1c10' : '#6b5a44'; c.fillText(L.name, cx, ty);
  }
  const h = wMapHere();
  if (h) {
    const cx = h[0] * S + S / 2, cy = h[1] * S + S / 2;
    c.beginPath(); c.arc(cx, cy, 7, 0, Math.PI * 2); c.fillStyle = '#c94a3a'; c.fill();
    c.lineWidth = 2; c.strokeStyle = '#fff6e0'; c.stroke();
  }
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

function wOpenMap() {
  if (!WG || !RUN) return;
  WUI.held = null; WUI.goto = null;
  const pct = Math.round(100 * wMapSeenCount() / (WW * WH)), m = wCurMap();
  const where = m.kind === 'world' ? (wRegionName() || m.name) : m.name;
  modal(`<header><h3>Map of the realm</h3><button class="ghost" data-close>Close</button></header>
    <p class="hint">You are in ${esc(where)} (the red mark). You have seen ${pct}% of the realm. The map fills in as your team walks the world.</p>
    <div class="wmapbox"><canvas id="wMapCv" aria-label="Map of the realm"></canvas></div>
    <p class="hint wmapkey">${Object.values(W_MAP_KIND).map(([g, n]) => `<span><b>${g}</b> ${n}</span>`).join('')}<span>Bold: you have been there</span></p>`,
    () => { WUI.hudKey = ''; wDrain(); });
  wMapDraw($('wMapCv'));
}

/* the Map button, beside the Journal; M opens it */
const wW37RenderHud = wRenderHud;
wRenderHud = function () {
  wW37RenderHud();
  if (!WUI.built || !WG) return;
  const j = $('wJournalBtn');
  if (j && !$('wMapBtn')) {
    j.insertAdjacentHTML('afterend', `<button class="ghost wcampb" id="wMapBtn" title="Map of the realm (M)">Map</button>`);
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
    <p class="hint"><b>Map</b> (<kbd>M</kbd>, or from the Menu) shows the realm as far as your team has seen it. It starts blank and fills in round you as you walk the world, and what you have seen stays on it. Towns, grounds, dungeons and lairs get their mark once you have seen them, and their name in bold once you have been there. The red mark is you.</p></div>`);
};
