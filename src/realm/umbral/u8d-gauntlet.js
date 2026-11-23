/* u8d: the gauntlet on the dark grounds (issue #111, phase D). Loads after u7-feel.js; changes earlier parts only by
   reassignment (saved originals carry the wWU8D prefix).

   Crossing a dark ground is part of the challenge now, not only the champion's refusal. On each dark ground the row
   the guards stand on (u4's wUmbFieldEnd) is walled off from stand to stand with a bone railing, leaving a gap of three
   in the middle: the two guards stand in its outer tiles and a shut gate fills the middle.
     the guards   fixed, so there is no squeezing past. Beaten (WG.umbral.guards), a guard steps one tile back off the
                  line, behind the tile they stood on, which leaves that tile an empty pocket: the only way on is the
                  gate. Once the gate is open they step clear (one more tile out), so the champion's end is free to walk.
     the gate     open once given its item, or once you hold the piece of every champion behind it. Used (walked into): while a guard stands, and then without the region's item (W_UMB4.gate), it says
                  so in the champion's words, as u4 does; with it, the item is handed over and the gate opens for good
                  (WG.umbral.gates, for every champion of that ground). The map keeps the shut gate; wTileAt shows it
                  open from WG.umbral.gates, so a reload, or a gate opened through u4's refusal, reads open too.
   u4's refusal (the guards, then the item) stays as a backstop: a save from before the wall still plays, and the
   realm bot, which never walks, still gets its games. A journey saved standing behind the line before the wall stood
   wakes at the ground's way in.
   A ground whose guards' row does not run straight across the field from one solid edge to the other gets no wall
   (today's behaviour) and the audit says which and why. The audit checks each wall really works: the champion cut off
   with the gate shut (guards standing or beaten), the guards and the gate reachable, and with the gate open and the
   guards clear, everyone and every marked tile on the ground reachable.
   Tiles taken: 'ƚ' (bone railing), 'Ƞ' (the gate, shut), 'ƞ' (the gate, open: only ever what wTileAt shows).

   W_UMB8D, wUmbGroundChamps, wUmbGateOpen, wUmbGuardSpot, wUmbGauntletReach, wUmbGauntletProblems, wUmbBuildGauntlet,
   wUmbGauntletSync, wUmbGauntletSyncAll, wUmbUseGate
   Wraps: buildAllMaps (wWU8DBuildAllMaps: the wall and the gate), wTileAt (wWU8DTileAt: an opened gate reads open),
   wUse (wWU8DUse: the gate), wTryMove (wWU8DTryMove: a guard kept off your tile takes it), wMapPaint (wWU8DMapPaint:
   an open gate on the local map), wApplyNpcs (wWU8DApplyNpcs: the guards where WG.umbral puts them), wStart (wWU8DStart:
   the same on loading, and nobody left behind the line), W_ON_END.uguard (wWU8DOnGuard: a beaten guard steps back),
   wNadirMatch (wWU8DNadirMatch: a gate opened by u4's backstop is given for the whole ground and redrawn open), wAudit
   (wWU8DAudit: every wall works; the reach checks that knew nothing of the gate are replaced for the champions, guards
   and tiles behind it), renderHelp (wWU8DRenderHelp: the wall in #wHelpUmbral). */

const W_UMB8D = {
  wall: 'ƚ', gate: 'Ƞ', open: 'ƞ',
  bone: '#c9bfae',
  tiles: {
    'ƚ': { name: 'bone railing', walk: 0, look: 'A railing of long bones, lashed end to end across the field. The joints have been gnawed smooth.' },
    'Ƞ': { name: 'bone gate', walk: 0, use: 'ugate', look: 'A gate of ribs, shut. In the middle of it is a hollow, about the size of something you could carry.' },
    'ƞ': { name: 'open gate', walk: 1, look: 'The bone gate, standing open. It made no sound when it swung. Nothing here does.' },
  },
};
Object.assign(DB.tiles, W_UMB8D.tiles);
W_MAP_COL[W_UMB8D.wall] = '#cfc6b4'; W_MAP_COL[W_UMB8D.gate] = '#b38cf0'; W_MAP_COL[W_UMB8D.open] = '#8a7a9a';

/* ---------- who stands where ---------- */
// the champions who play on a ground (one each, in the game; a check may add another)
const wUmbGroundChamps = g => Object.keys(W_NADIR).filter(k => W_NADIR[k].ground === g);
// the gate is open once it has been given its item (WG.umbral.gates), or once every champion behind it has lost their
// piece to you (a save from before the wall, when u4 took the item and the gate had no entry of its own)
function wUmbGateOpen(g) {
  const U = wUmb(), ids = wUmbGroundChamps(g); if (!U || !ids.length) return false;
  return (!!U.gates && ids.some(id => U.gates[id])) || ids.every(id => (U.pieces || []).includes(W_NADIR[id].piece));
}
// a guard's spot: on the line; one tile back off it once beaten; clear of the way through once the gate is open too.
// st: { open, beaten (both, or [left, right]) } for a what-if; left out, the journey's own state
function wUmbGuardSpot(m, g, i, st) {
  const G = m.gauntlet, U = wUmb();
  const beaten = st ? (Array.isArray(st.beaten) ? st.beaten[i] : st.beaten) : !!(U && U.guards && U.guards[g + ':' + i]);
  const open = st ? st.open : wUmbGateOpen(g);
  return !beaten ? G.line[i] : open ? G.clear[i] : G.aside[i];
}
// the tiles you can walk to from the way in, with the gate shut or open and everyone where they would stand (every
// person on a dark ground is fixed, so each is in the way). st left out: the journey as it is, the guards where they
// really stand (one kept off your tile stays where it was)
function wUmbGauntletReach(m, g, st) {
  const G = m.gauntlet, W = m.w, seen = new Uint8Array(W * m.h), gi = [0, 1].map(i => wUmbGuardOf(g, i));
  const open = st ? st.open : wUmbGateOpen(g), who = new Set(m.npcs.filter(n => !st || !gi.includes(n.id)).map(n => n.x + ',' + n.y));
  if (st) for (const i of [0, 1]) who.add(wUmbGuardSpot(m, g, i, st).join(','));
  const walk = (x, y) => (open && x === G.gate[0] && y === G.gate[1]) || walkCh(m.t[y][x]);
  const q = [m.spawn.slice()]; seen[m.spawn[1] * W + m.spawn[0]] = 1;
  for (let k = 0; k < q.length; k++) {
    const [x, y] = q[k];
    for (const [dx, dy] of W_SIDES) {
      const nx = x + dx, ny = y + dy, i = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= m.h || seen[i] || who.has(nx + ',' + ny) || !walk(nx, ny)) continue;
      seen[i] = 1; q.push([nx, ny]);
    }
  }
  return seen;
}
// what is wrong with a ground's wall: [] when it shuts the champion off until the guards are beaten and the gate open
function wUmbGauntletProblems(m, g) {
  const P = [], G = m.gauntlet, id = 'u:' + g, gi = [0, 1].map(i => wUmbGuardOf(g, i)), champs = wUmbGroundChamps(g).map(k => W_NADIR[k].char);
  const near = (s, x, y) => W_SIDES.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < m.w && ny < m.h && !!s[ny * m.w + nx]; });
  const shut = wUmbGauntletReach(m, g, { open: false, beaten: false });
  const past = [[true, false], [false, true], [true, true]].map(b => wUmbGauntletReach(m, g, { open: false, beaten: b }));
  const open = wUmbGauntletReach(m, g, { open: true, beaten: true });
  for (const n of m.npcs) if (champs.includes(n.id)) {
    if (near(shut, n.x, n.y)) P.push(id + ': ' + n.id + ' can be reached past the guards');
    else if (past.some(s => near(s, n.x, n.y))) P.push(id + ': ' + n.id + ' can be reached with the gate shut');
  }
  for (const i of [0, 1]) if (!near(shut, ...G.line[i])) P.push(id + ': cannot reach guard ' + i + ' on the line');
  if (!near(shut, ...G.gate)) P.push(id + ': cannot reach the gate');
  for (const n of m.npcs) { const k = gi.indexOf(n.id), p = k >= 0 ? G.clear[k] : [n.x, n.y]; if (!near(open, ...p)) P.push(id + ': cannot reach ' + n.id + ' with the gate open'); }
  for (const k in m.meta) { const [x, y] = k.split(',').map(Number); if (!near(open, x, y)) P.push(id + ': cannot reach the tile ' + k + ' with the gate open'); }
  return P;
}

/* ---------- building the wall ---------- */
function wUmbBuildGauntlet(g) {
  const m = MAPS['u:' + g]; if (!m) return false;
  delete m.gauntlet; m.gauntletWhy = '';
  const no = why => { m.gauntletWhy = why; return false; };
  const F = wUmbFieldEnd(m); if (!F) return no('it has no field');
  const at = (x, y) => m.npcs.find(n => n.x === x && n.y === y);
  const [[lx, gy], [rx, ry]] = F.guards, gx = (lx + rx) >> 1, s = Math.sign(F.champ[1] - gy);
  if (!s || ry !== gy || rx - lx !== 2 || !at(...F.champ) || [0, 1].some(i => (at(...F.guards[i]) || {}).id !== wUmbGuardOf(g, i))) return no('its guards are not on the field');
  const free = (x, y) => { const c = m.t[y] && m.t[y][x], td = c && DB.tiles[c]; return !!td && !!td.walk && !td.enter && !m.meta[x + ',' + y] && !at(x, y); };
  // the row, from the gap out to the field's edge each way: open ground all along, ending against something solid
  const run = [];
  const straight = [-1, 1].every(d => {
    for (let x = (d < 0 ? lx : rx) + d; ; x += d) { const c = m.t[gy][x]; if (c == null) return false; if (!walkCh(c)) return true; if (!free(x, gy)) return false; run.push(x); }
  });
  if (!straight || !free(gx, gy)) return no('the guards\' row does not run straight across it');
  const aside = F.guards.map(([x, y]) => [x, y + s]);
  if (!aside.every(p => free(...p))) return no('a guard has nowhere to step back to');
  const clear = F.guards.map(([x, y], i) => { const p = [x + (i ? 1 : -1), y + s]; return free(...p) ? p : aside[i]; });
  const was = run.map(x => m.t[gy][x]), wasGate = m.t[gy][gx];
  for (const x of run) m.t[gy][x] = W_UMB8D.wall;
  m.t[gy][gx] = W_UMB8D.gate;
  m.gauntlet = { row: gy, gate: [gx, gy], wall: run.slice().sort((a, b) => a - b), line: F.guards.map(p => p.slice()), aside, clear };
  // it must really shut the champion off, and really let you through once open; if not, no wall
  const P = wUmbGauntletProblems(m, g);
  if (P.length) { run.forEach((x, k) => { m.t[gy][x] = was[k]; }); m.t[gy][gx] = wasGate; delete m.gauntlet; return no(P[0]); }
  return true;
}
// the guards where the journey says they stand (step: walk them there, as people in towns walk)
function wUmbGauntletSync(g, step) {
  const m = MAPS['u:' + g]; if (!m || !m.gauntlet) return;
  const here = typeof WG !== 'undefined' && WG && WG.map === m.id;
  for (const i of [0, 1]) {
    const n = m.npcs.find(k => k.id === wUmbGuardOf(g, i)); if (!n) continue;
    const [x, y] = wUmbGuardSpot(m, g, i);
    if ((n.x === x && n.y === y) || (here && WG.x === x && WG.y === y)) continue;   // (never onto you)
    if (step && here) { n.px = n.x; n.py = n.y; n.mt = performance.now(); }
    n.x = x; n.y = y;
  }
}
const wUmbGauntletSyncAll = () => { for (const g in W_UMB4.grounds) wUmbGauntletSync(g); };
const wWU8DBuildAllMaps = buildAllMaps;
buildAllMaps = function () {
  const r = wWU8DBuildAllMaps.apply(this, arguments);
  for (const g in W_UMB4.grounds) wUmbBuildGauntlet(g);
  if (typeof WG !== 'undefined' && WG) wUmbGauntletSyncAll();
  return r;
};

/* ---------- the gate ---------- */
const wWU8DTileAt = wTileAt;
wTileAt = function (map, x, y) {
  const c = wWU8DTileAt.apply(this, arguments);
  return c === W_UMB8D.gate && map && map.gauntlet && wUmbGateOpen(map.id.slice(2)) ? W_UMB8D.open : c;
};
function wUmbUseGate(m, g) {
  const U = wUmb(), ids = wUmbGroundChamps(g); if (!U || !ids.length) return wLog('The gate is shut, and nobody waits behind it.', 'd');
  if (wUmbGateOpen(g)) return;
  U.guards = U.guards || {}; U.gates = U.gates || {};
  const C = W_NADIR[ids[0]], name = DB.chars[C.char].name, it = W_UMB4.gate[C.region], left = [0, 1].filter(i => !U.guards[g + ':' + i]);
  if (left.length) return wLog(`The gate is shut, and the Hands of the Nadir stand either side of it. ${name} will not play you until you have got past ${left.map(i => W_UMB4.guardNames[i]).join(' and ')}.`, 'd');
  if (!wHas(it)) return wLog(`The gate is shut. ${name} wants something from the light side of the region first: a ${DB.items[it].name}. Bring one through the portal.`, 'd');
  wAddItem(it, -1);
  for (const k of ids) U.gates[k] = WG.dayAbs;
  wLog(`You set a ${DB.items[it].name} in the hollow of the gate. It swings open without a sound, and the Hands of the Nadir step back to let you through. ${name} is waiting.`, 'd');
  if (!LAB && SET.sfx) { try { tone(110, 1.1, 'triangle', .05, -30); tone(165, .9, 'sine', .03, -40, .15); } catch (e) { console.error(e); } }
  wInvalidate(m.id); wUmbGauntletSync(g, true); wSave();
}
const wWU8DUse = wUse;
wUse = function (x, y) {
  const m = wCurMap(), G = m && m.gauntlet;
  if (G && x === G.gate[0] && y === G.gate[1] && wTileAt(m, x, y) === W_UMB8D.gate) return wUmbUseGate(m, m.id.slice(2));
  return wWU8DUse.apply(this, arguments);
};
// a gate opened by the champion's own refusal (u4's backstop: the bot, an old save) is drawn open at once
const wWU8DNadirMatch = wNadirMatch;
wNadirMatch = function (id) {
  const C = W_NADIR[id], g = C && C.ground, was = !!g && wUmbGateOpen(g), r = wWU8DNadirMatch.apply(this, arguments);
  if (g && !was && wUmbGateOpen(g)) {
    // (one gate for the ground: every champion behind it counts it given, as wUmbUseGate does)
    const U = wUmb(), at = (U.gates && U.gates[id]) || WG.dayAbs; U.gates = U.gates || {};
    for (const k of wUmbGroundChamps(g)) if (!U.gates[k]) U.gates[k] = at;
    wInvalidate('u:' + g); wUmbGauntletSync(g);
  }
  return r;
};

/* ---------- the guards step back ---------- */
const wWU8DOnGuard = W_ON_END.uguard;
W_ON_END.uguard = function (r, ref) {
  const out = wWU8DOnGuard.apply(this, arguments);
  if (r === 'win' && ref && ref.g) wUmbGauntletSync(ref.g, true);
  return out;
};
// a guard kept off your tile (a journey loaded with you standing on their spot) takes it once you step off
const wWU8DTryMove = wTryMove;
wTryMove = function () {
  const r = wWU8DTryMove.apply(this, arguments), m = WG && MAPS[WG.map];
  if (m && m.gauntlet) wUmbGauntletSync(m.id.slice(2), true);
  return r;
};
const wWU8DApplyNpcs = wApplyNpcs;
wApplyNpcs = function (id) {
  const r = wWU8DApplyNpcs.apply(this, arguments);
  if (typeof id === 'string' && id.startsWith('u:') && W_UMB4.grounds[id.slice(2)]) wUmbGauntletSync(id.slice(2));
  return r;
};
const wWU8DStart = wStart;
wStart = function () {
  const r = wWU8DStart.apply(this, arguments);
  if (!WG) return r;
  wUmbGauntletSyncAll();
  // a journey saved behind the line before the wall stood (or with the gate since shut by a check) wakes at the way in
  const m = MAPS[WG.map], g = m && m.gauntlet && m.id.slice(2);
  if (g && !wUmbGauntletReach(m, g)[WG.y * m.w + WG.x]) {
    WG.x = m.spawn[0]; WG.y = m.spawn[1]; WG.face = 'u'; wUmbGauntletSync(g); WQ.push({ k: 'map' });   // (a guard kept off your old spot takes it now; the view follows you)
    if (!LAB) wLog('A railing of bone stands across the field now. You find yourself back at the way in.', 'd');
  }
  return r;
};

/* ---------- drawing: bone, lashed and gnawed ---------- */
const wUmbGauntletCh = ch => ch === W_UMB8D.wall || ch === W_UMB8D.gate || ch === W_UMB8D.open;
// a long bone from (x0, y0) to (x1, y1), knuckled at both ends
function wUmbBone(c, x0, y0, x1, y1, w) {
  const B = W_UMB8D.bone, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  c.save(); c.translate(x0, y0); c.rotate(Math.atan2(dy, dx));
  wCel(c, pRR(0, -w / 2, len, w, w / 2), B, .6, 1.1);
  for (const x of [0, len]) for (const o of [-w * .45, w * .45]) { const p = new Path2D(); p.arc(x, o, w * .42, 0, 7); wCel(c, p, B, .4, 1); }
  c.restore();
}
function wUmbSkull(c, x, y, k) {
  const p = new Path2D(); p.arc(x, y, 3.6 * k, 0, 7); wCel(c, p, tint(W_UMB8D.bone, .08), .5, 1);
  c.fillStyle = WINKC; c.fillRect(x - 2 * k, y - .4 * k, 1.4 * k, 1.6 * k); c.fillRect(x + .6 * k, y - .4 * k, 1.4 * k, 1.6 * k);
}
const wUmbAccentOf = m => W_UMB.accent[String((m && m.region) || '').replace(/^u/, '')] || '#c8b8ff';
// the railing: two rails joined to the railing or gate beside it, and a bone post in each tile, some capped by a skull
WOBJ[W_UMB8D.wall] = (c, P, r, e) => {
  const L = wUmbGauntletCh(e.at(-1, 0)), R = wUmbGauntletCh(e.at(1, 0));
  wShadow(c, 16, 28, 15, 2.2, .28);
  const x0 = L ? -2 : 6, x1 = R ? 34 : 26;
  for (const y of [13, 21]) wUmbBone(c, x0, y, x1, y + (r() - .5) * 1.2, 3);
  wUmbBone(c, 16, 28, 16, 7, 3.4);
  if (r() < .4) wUmbSkull(c, 16, 5, 1);
};
// the gate, shut: two tall posts, each with its skull, and a lattice of ribs with a hollow in the middle that glows
WOBJ[W_UMB8D.gate] = (c, P, r, e) => {
  wShadow(c, 16, 29, 16, 2.6, .32);
  for (let i = 0; i < 5; i++) { const x = 7 + i * 4.5; c.save(); c.beginPath(); c.moveTo(x, 27); c.quadraticCurveTo(x + (i - 2) * 1.6, 15, x, 4); c.lineWidth = 2.4; c.strokeStyle = WINKC; c.stroke(); c.lineWidth = 1.3; c.strokeStyle = W_UMB8D.bone; c.stroke(); c.restore(); }
  wUmbBone(c, 4, 9, 28, 9, 2.6); wUmbBone(c, 4, 22, 28, 22, 2.6);
  c.save(); c.globalAlpha = .85; c.fillStyle = wUmbAccentOf(e.m); c.beginPath(); c.arc(16, 15.5, 3.2, 0, 7); c.fill(); c.restore();
  c.save(); c.lineWidth = 1; c.strokeStyle = WINKC; c.beginPath(); c.arc(16, 15.5, 3.2, 0, 7); c.stroke(); c.restore();
  for (const x of [3, 29]) { wUmbBone(c, x, 29, x, -2, 4); wUmbSkull(c, x, -5, 1.15); }
};
// the gate, open: the posts, and the two leaves of ribs swung back against them, the way through clear
WOBJ[W_UMB8D.open] = (c, P, r, e) => {
  wShadow(c, 5, 29, 5, 2, .3); wShadow(c, 27, 29, 5, 2, .3);
  for (const [x, d] of [[3, 1], [29, -1]]) {
    c.save(); c.globalAlpha = .9;
    for (let i = 0; i < 3; i++) { const rx = x + d * (2.5 + i * 1.8); c.beginPath(); c.moveTo(rx, 27 - i); c.lineTo(rx, 5 + i); c.lineWidth = 2.2; c.strokeStyle = WINKC; c.stroke(); c.lineWidth = 1.1; c.strokeStyle = W_UMB8D.bone; c.stroke(); }
    c.restore();
    wUmbBone(c, x, 29, x, -2, 4); wUmbSkull(c, x, -5, 1.15);
  }
};

/* ---------- the local map: an open gate shows open ---------- */
const wWU8DMapPaint = wMapPaint;
wMapPaint = function (c, m) {
  const G = m && m.gauntlet; if (!G || !wUmbGateOpen(m.id.slice(2))) return wWU8DMapPaint.apply(this, arguments);
  const [x, y] = G.gate; m.t[y][x] = W_UMB8D.open;
  try { return wWU8DMapPaint.apply(this, arguments); } finally { m.t[y][x] = W_UMB8D.gate; }
};

/* ---------- the audit ---------- */
const wWU8DAudit = wAudit;
wAudit = function () {
  // the reach checks before this part know nothing of the wall: on a walled ground, for its champions, its guards and
  // its tiles, its own check (with the gate open) replaces them; anything else they say stands
  const behind = (id, who) => { const m = MAPS[id]; if (!m || !m.gauntlet) return false; const g = id.slice(2);
    return who.includes(',') ? !!m.meta[who] : [0, 1].some(i => wUmbGuardOf(g, i) === who) || wUmbGroundChamps(g).some(k => W_NADIR[k].char === who); };
  const P = wWU8DAudit.apply(this, arguments).filter(s => {
    const k = /^(u:g_\w+): cannot reach (\S+)$/.exec(s) || /^town (u:g_\w+): (\S+) cannot be reached$/.exec(s) || /^town (u:g_\w+): tile (\d+,\d+) unreachable$/.exec(s);
    return !(k && behind(k[1], k[2]));
  });
  for (const t in W_UMB8D.tiles) if (DB.tiles[t] !== W_UMB8D.tiles[t]) P.push('the gauntlet\'s tile ' + t + ' was taken by another part (' + ((DB.tiles[t] || {}).name || 'nothing') + ')');
  for (const g in W_UMB4.grounds) {
    const m = MAPS['u:' + g]; if (!m) continue;
    if (!m.gauntlet) { P.push('u:' + g + ': no wall across the field (' + (m.gauntletWhy || 'not built') + ')'); continue; }
    P.push(...wUmbGauntletProblems(m, g));
  }
  return P;
};

/* ---------- How to play ---------- */
const wWU8DRenderHelp = renderHelp;
renderHelp = function () {
  wWU8DRenderHelp.apply(this, arguments);
  const h = $('wHelpUmbral'); if (!h || $('wHelpUmbGate') || h.tagName === 'P') return;
  const at = [...h.querySelectorAll('p')].find(p => /^The pieces\./.test(p.textContent)) || h.lastElementChild;
  at.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpUmbGate"><b>The wall.</b> On every dark ground a railing of bone runs across the field. The two guards stand in its gap, either side of a shut gate, and nobody squeezes past them. Beat a guard and they step back off the line. Beat both, then give the gate what the champion wants from the light side, and it opens for good.</p>`);
};
