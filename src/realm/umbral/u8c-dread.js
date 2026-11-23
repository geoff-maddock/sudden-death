/* u8c: the Dread (issue #111, phase C). Loads after u7-feel.js; changes earlier parts only by reassignment (saved
   originals carry the wWU8C prefix).

   The dark side wakes as you take its pieces. The Dread is a stage, read from the pieces you hold and never stored
   (wUmbDread: 0 to 3; 0 once the Seal is forged):
     0  The Quiet       0-2 pieces   a few slow shadows; spikes on the approaches to the grounds
     1  The Stirring    3-5          the pits open; more shadows
     2  The Raging      6-7          the shadows hunt (two steps every third step) and see further
     3  The Last Hour   8-9          more shadows still
   Each stage reached plays a short scene the next time the world is free (WG.umbral.dreadSeen: the highest whose scene
   has played; a save from before this part that is already past a stage sees only the highest one, once). The light
   side feels it too: the blight (u1's eclipses and hunters) is a step further on for each stage.
   Hazards on the dark world (MAPS['u:world'].hazards, 'x,y' -> 'spike' | 'pit', placed when the maps are built, from a
   fixed seed): spikes cost W_UMB8C.spikeHp team HP to step on (never below 1); pits, from the Stirring, cost
   W_UMB8C.pitHp and drop you on a free tile a few steps away (before then they are cracked ground that holds). Both
   are drawn on the ground (an overlay, so the tiles and every check that reads them are unchanged), and neither is on
   a road, beside a place's way in, in a lantern's light or beside the portal road. They never block a way through:
   they can be walked on, at a price.
   The hungry shadows (WG.umbral.shadows: [{ id, x, y, hx, hy }], plain JSON) walk the dark world: W_UMB8C.shadows of
   them by stage. Each step you take there, each that can see you (within its sight, in a clear walkable line) comes a
   step closer; the rest drift near home. One that reaches you, or that you walk into, is an Umbral match (kind
   'shadow'): win and it dissolves (another comes the next day), lose and it is a blackout as any loss on this side.
   They keep out of a lantern's light, never go into a place, and stand still for a few steps after you come out onto
   the dark world (WG.grace). The dark world's own wild matches come half as often: the danger is one you can see.
   Shadow Salt (DB.items.shadowsalt, sold in the dark shops for fans): the shadows can't see you for W_UMB8C.salt steps
   (WG.umbral.salt).

   W_UMB8C, wUmbDread, wUmbHazardAt, wUmbShadowsSync, wUmbShadowStep, wUmbDreadScene
   Wraps: buildAllMaps (wWU8CBuildAllMaps: the hazards), wTryMove (wWU8CTryMove: a shadow walked into, hazards, the
   shadows' step), wEncounterP (wWU8CEncounterP: half the dark world's wild matches), startMatch (wWU8CStartMatch:
   counts matches started, so a step that started one moves no shadows), wLookText (wWU8CLookText: hazards, shadows),
   W_ON_END.nadir (wWU8COnNadir: a stage reached), wNextPrompt (wWU8CNextPrompt: its scene), wStart (wWU8CStart: a save
   past a stage), wUmbBlight (wWU8CBlight), wUmbSound (wWU8CSound: the scene's swell), wUseItem (wWU8CUseItem: Shadow
   Salt), wCampBag (wWU8CCampBag: its button), wUmbShop (wWU8CUmbShop: the dark shops' own lists), renderHelp (wWU8CRenderHelp). */

const W_UMB8C = {
  stages: [0, 3, 6, 8],
  names: ['The Quiet', 'The Stirring', 'The Raging', 'The Last Hour'],
  shadows: [3, 6, 10, 14], sight: [4, 5, 6, 7], hunt: 2,   // from this stage, two steps every third step
  lanternR: 3, minSpawn: 8, home: 3,
  spikes: { near: 4, far: 14 }, pits: 20, spikeHp: 2, pitHp: 3, pitDrop: 4,
  salt: 60, encMult: .5, started: 0,
  scenes: [null,
    { h: 'The Stirring', lines: ['Three pieces gone, and the Umbral notices.', 'The dead moon cracks across its face, and a thin light comes through the crack.', 'Out on the dark world the ground splits open in places. Something down there has woken up, and it is hungry.'] },
    { h: 'The Raging', lines: ['Six pieces. The Umbral is angry now.', 'The wind turns and carries ash the wrong way. The shadows on the dark world stop drifting.', 'They hunt now, and they hunt fast.'] },
    { h: 'The Last Hour', lines: ['Eight pieces. One more, and then the Seal.', 'The sky over the dark world bleeds from the north. Every shadow on that side turns to face the portal.', 'It knows you are nearly done. It will not make the end easy.'] }],
};
DB.items.shadowsalt = { name: 'Shadow Salt', desc: `A pinch of grey salt. Scatter it on the dark side and the shadows can't see you for ${W_UMB8C.salt} steps.`, use: `Bag → Scatter, on the dark world: the shadows can't see you for ${W_UMB8C.salt} steps.`, price: 30 };
// a dark-side ware: each dark shop keeps its own list (DB.shops['u_' + shop]), the light one's and the Umbral's wares
// (u8h adds to them), so the light shops never show it
const W_UMB8C_WARES = { shadowsalt: DB.items.shadowsalt.price };
for (const k of Object.keys(DB.shops)) if (!k.startsWith('u_')) DB.shops['u_' + k] = Object.assign({}, DB.shops[k], W_UMB8C_WARES);

function wUmbDread() {
  const U = wUmb(); if (!U || U.sealed) return 0;
  const n = (U.pieces || []).length; let s = 0;
  W_UMB8C.stages.forEach((a, i) => { if (n >= a) s = i; });
  return s;
}

/* ---------- hazards ---------- */
const wUmbHazardAt = (m, x, y) => (m && m.hazards && m.hazards[x + ',' + y]) || null;
function wUmbPlaceHazards() {
  const m = MAPS['u:world']; if (!m) return;
  m.hazards = {};
  const r = mulberry(8111), locs = DB.locs;
  const lan = Object.keys(m.meta).filter(k => m.meta[k].lantern).map(k => k.split(',').map(Number));
  const ok = (x, y) => {
    const c = m.t[y] && m.t[y][x], td = c && DB.tiles[c];
    if (!td || !td.walk || !td.ground || td.enter || c === '=' || c === 'b' || m.meta[x + ',' + y] || m.hazards[x + ',' + y]) return false;
    // (not beside a road either: a road is always a safe way)
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const n = m.t[y + dy] && m.t[y + dy][x + dx]; return n === '=' || n === 'b'; })) return false;
    if (locs.some(L => Math.abs(L.x - x) + Math.abs(L.y - y) <= 2)) return false;
    if (lan.some(([lx, ly]) => Math.hypot(lx - x, ly - y) <= W_UMB8C.lanternR + 1)) return false;
    return true;
  };
  // spikes on the approaches to the grounds, a few steps out from each way in
  for (const L of DB.locs.filter(l => l.kind === 'ground')) {
    let n = 0, tries = 0;
    while (n < W_UMB8C.spikes.near && tries++ < 80) { const a = r() * Math.PI * 2, d = 3 + r() * 3, x = Math.round(L.x + Math.cos(a) * d), y = Math.round(L.y + Math.sin(a) * d); if (ok(x, y)) { m.hazards[x + ',' + y] = 'spike'; n++; } }
  }
  const scatter = (k, n) => { let i = 0, tries = 0; while (i < n && tries++ < n * 200) { const x = Math.floor(r() * m.w), y = Math.floor(r() * m.h); if (ok(x, y)) { m.hazards[x + ',' + y] = k; i++; } } };
  scatter('spike', W_UMB8C.spikes.far);
  scatter('pit', W_UMB8C.pits);
}
const wWU8CBuildAllMaps = buildAllMaps;
buildAllMaps = function () { const r = wWU8CBuildAllMaps.apply(this, arguments); wUmbPlaceHazards(); return r; };
// a free tile on the dark world: walkable ground, no place, no hazard, nobody standing there
function wUmbFreeAt(m, x, y) {
  const c = m.t[y] && m.t[y][x], td = c && DB.tiles[c];
  return !!td && !!td.walk && !td.enter && !m.meta[x + ',' + y] && !wUmbHazardAt(m, x, y) && !(m.npcs || []).some(n => n.x === x && n.y === y);
}
// a hazard stepped on ('' when nothing happened)
function wUmbHazardStep() {
  const m = wCurMap(), h = wUmbHazardAt(m, WG.x, WG.y); if (!h) return '';
  if (h === 'spike') {
    const h0 = RUN.hp; RUN.hp = Math.max(Math.min(1, h0), h0 - wUmbSpikeHp());
    wLog(`Spikes, black as old bone, through the soles. ${h0 > RUN.hp ? `Your team loses ${h0 - RUN.hp} HP` : 'Your team limps on'} (${RUN.hp}/${RUN.maxhp}).`, 'b');
    return 'spike';
  }
  if (wUmbDread() < 1) { if (!LAB && Math.random() < .3) wLog('The ground here is cracked, and it holds. For now.', 'd'); return ''; }
  const h0 = RUN.hp; RUN.hp = Math.max(Math.min(1, h0), h0 - W_UMB8C.pitHp);
  // out of the pit a few steps away, wherever the dark lets you climb: never somewhere you can't walk back from
  const r = mulberry(WG.step * 31 + WG.x * 7 + WG.y), opts = [], reach = bfsReach(m, WG.x, WG.y);
  for (let dy = -W_UMB8C.pitDrop; dy <= W_UMB8C.pitDrop; dy++) for (let dx = -W_UMB8C.pitDrop; dx <= W_UMB8C.pitDrop; dx++) {
    const x = WG.x + dx, y = WG.y + dy; if ((dx || dy) && Math.abs(dx) + Math.abs(dy) >= 2 && x >= 0 && y >= 0 && x < m.w && y < m.h && reach[y * m.w + x] && wUmbFreeAt(m, x, y) && !wUmbShadowAt(x, y)) opts.push([x, y]);
  }
  if (opts.length) { const [x, y] = opts[Math.floor(r() * opts.length)]; WG.x = x; WG.y = y; }
  wLog(`The ground opens under you. Your team falls, climbs, and comes up somewhere else${h0 > RUN.hp ? `, ${h0 - RUN.hp} HP down` : ''} (${RUN.hp}/${RUN.maxhp}).`, 'b');
  return 'pit';
}
// (u8g's resonance makes spikes cheaper: it wraps this)
function wUmbSpikeHp() { return W_UMB8C.spikeHp; }

/* ---------- the hungry shadows ---------- */
const W_UMB8C_ANIM = {};   // (where each shadow was drawn last, for the glide between steps: not saved)
const wUmbShadows = () => { const U = wUmb(); if (!U) return []; if (!Array.isArray(U.shadows)) U.shadows = []; return U.shadows; };
const wUmbShadowAt = (x, y) => wUmbShadows().find(s => s.x === x && s.y === y) || null;
const wUmbLanternLit = (m, x, y) => Object.keys(m.meta).some(k => { if (!m.meta[k].lantern) return false; const [lx, ly] = k.split(',').map(Number); return Math.hypot(lx - x, ly - y) <= W_UMB8C.lanternR; });
// where a shadow may stand: free ground, out of a lantern's light, not in front of a place's way in (where you come
// out of it)
const wUmbShadowOk = (m, x, y) => wUmbFreeAt(m, x, y) && !wUmbLanternLit(m, x, y) && !wUmbShadowAt(x, y) && !DB.locs.some(L => Math.abs(L.x - x) + Math.abs(L.y - y) <= 1);
// a shadow off your tile (you came out of a place onto it, or ran from its match): back toward home, or anywhere free
function wUmbShadowShove(m, s) {
  for (const [x, y] of [[s.hx, s.hy]].concat([[2, 0], [-2, 0], [0, 2], [0, -2], [3, 1], [-3, -1], [1, 3], [-1, -3]].map(([dx, dy]) => [s.x + dx, s.y + dy])))
    if (!(x === WG.x && y === WG.y) && wUmbShadowOk(m, x, y)) { s.x = x; s.y = y; return true; }
  return false;
}
function wUmbShadowsSync() {
  const U = wUmb(), m = MAPS['u:world']; if (!U || !m || U.sealed) return;
  const S = wUmbShadows();
  U.shadowWait = (U.shadowWait || []).filter(d => d > (WG.dayAbs || 0));
  const want = Math.max(0, W_UMB8C.shadows[wUmbDread()] - U.shadowWait.length);
  if (S.length > want) S.length = want;
  if (S.length >= want) return;
  const r = mulberry((WG.dayAbs || 0) * 977 + (WG.step || 0) + S.length * 31);
  let tries = 0;
  while (S.length < want && tries++ < 4000) {
    const x = Math.floor(r() * m.w), y = Math.floor(r() * m.h);
    if (!wUmbShadowOk(m, x, y) || (WG.map === 'u:world' && Math.abs(x - WG.x) + Math.abs(y - WG.y) < W_UMB8C.minSpawn)) continue;
    S.push({ id: 's' + ((U.shadowN = (U.shadowN || 0) + 1)), x, y, hx: x, hy: y });
  }
}
// a clear walkable line between a shadow and you (no wall, water or mountain in the way)
function wUmbSees(m, s) {
  // (salt hides you; so does a lantern's light, which no shadow comes into)
  if ((wUmb().salt || 0) > 0 || wUmbLanternLit(m, WG.x, WG.y)) return false;
  const sight = wUmbShadowSight(), d = Math.abs(s.x - WG.x) + Math.abs(s.y - WG.y); if (d > sight) return false;
  const n = Math.max(Math.abs(WG.x - s.x), Math.abs(WG.y - s.y));
  for (let i = 1; i < n; i++) {
    const x = Math.round(s.x + (WG.x - s.x) * i / n), y = Math.round(s.y + (WG.y - s.y) * i / n), c = m.t[y] && m.t[y][x], td = c && DB.tiles[c];
    if (!td || !td.walk) return false;
  }
  return true;
}
// (u8g's resonance shortens it: it wraps this)
function wUmbShadowSight() { return W_UMB8C.sight[wUmbDread()]; }
// one step of one shadow: toward you if it sees you, else a drift near home. True when it reached you
function wUmbShadowMove(m, s, r) {
  W_UMB8C_ANIM[s.id] = { px: s.x, py: s.y, mt: typeof performance !== 'undefined' ? performance.now() : 0 };
  if (wUmbSees(m, s)) {
    const dx = Math.sign(WG.x - s.x), dy = Math.sign(WG.y - s.y), ax = Math.abs(WG.x - s.x) >= Math.abs(WG.y - s.y);
    for (const [mx, my] of ax ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]]) {
      if (!mx && !my) continue;
      const x = s.x + mx, y = s.y + my;
      if (x === WG.x && y === WG.y) { s.x = x; s.y = y; return true; }
      if (wUmbShadowOk(m, x, y)) { s.x = x; s.y = y; return false; }
    }
    return false;
  }
  if (r() < .5) return false;
  const [mx, my] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)], x = s.x + mx, y = s.y + my;
  if (Math.abs(x - s.hx) + Math.abs(y - s.hy) <= W_UMB8C.home && wUmbShadowOk(m, x, y) && !(x === WG.x && y === WG.y)) { s.x = x; s.y = y; }
  return false;
}
// the shadows' step, after yours: the one that reaches you, or null
function wUmbShadowStep() {
  const U = wUmb(), m = MAPS['u:world']; if (!U || !m || WG.map !== 'u:world' || U.sealed) return null;
  if (U.salt > 0) U.salt--;
  wUmbShadowsSync();
  for (const s of wUmbShadows()) if (s.x === WG.x && s.y === WG.y) wUmbShadowShove(m, s);
  if (WG.grace > 0) return null;
  const r = mulberry((WG.step || 0) * 131 + (WG.dayAbs || 0)), twice = wUmbDread() >= W_UMB8C.hunt && WG.step % 3 === 0;
  for (const s of wUmbShadows()) {
    if (wUmbShadowMove(m, s, r)) return s;
    if (twice && wUmbSees(m, s) && wUmbShadowMove(m, s, r)) return s;
  }
  return null;
}
function wUmbShadowMatch(s) {
  WG.grace = Math.max(WG.grace || 0, 2);
  wLog('A shadow comes up out of the ground in front of you, and it has a team behind it.', 'b');
  return startMatch({ type: 'normal', tier: 3, name: 'The hungry shadows', world: { kind: 'shadow', ref: { id: s.id }, region: regionAt(s.x, s.y), umbral: 1 } });
}
W_ON_END.shadow = function (r, ref) {
  const U = wUmb(); if (!U) return;
  if (r === 'win' && ref) {
    const S = wUmbShadows(), i = S.findIndex(s => s.id === ref.id);
    if (i >= 0) { S.splice(i, 1); (U.shadowWait = U.shadowWait || []).push((WG.dayAbs || 0) + 1); }
    WG.grace = Math.max(WG.grace || 0, 3);
    wLog('The shadow comes apart like smoke. Somewhere out on the dark world, another one starts to gather.', 'g');
  } else if (ref) {
    // (run from, or lost: it lets you be for a moment, off your tile)
    const s = wUmbShadows().find(s => s.id === ref.id), m = MAPS['u:world'];
    if (s && m && WG.map === 'u:world' && s.x === WG.x && s.y === WG.y) wUmbShadowShove(m, s);
    WG.grace = Math.max(WG.grace || 0, 3);
  }
};

const wWU8CStartMatch = startMatch;
startMatch = function () { W_UMB8C.started++; return wWU8CStartMatch.apply(this, arguments); };
const wWU8CTryMove = wTryMove;
wTryMove = function (dx, dy) {
  const m0 = WG && WG.map;
  if (m0 !== 'u:world' || !wUmb()) return wWU8CTryMove.apply(this, arguments);
  // walking into a shadow: the match, and you stay where you are
  const s0 = wUmbShadowAt(WG.x + dx, WG.y + dy);
  if (s0) { WG.face = dx < 0 ? 'l' : dx > 0 ? 'r' : dy < 0 ? 'u' : 'd'; wUmbShadowMatch(s0); return false; }
  const n0 = W_UMB8C.started, moved = wWU8CTryMove.apply(this, arguments);
  // (a step that took you somewhere else is the end of it; one that started a match still costs its hazard, but the
  // shadows wait)
  if (!moved || WG.map !== m0) return moved;
  wUmbHazardStep();
  if (W_UMB8C.started !== n0) return moved;
  const s = wUmbShadowStep();
  if (s) wUmbShadowMatch(s);
  return moved;
};
const wWU8CEncounterP = wEncounterP;
wEncounterP = function (m) { const p = wWU8CEncounterP.apply(this, arguments); return m && m.umbral && m.kind === 'world' ? p * W_UMB8C.encMult : p; };
const wWU8CLookText = wLookText;
wLookText = function (x, y) {
  const m = wCurMap();
  if (m && m.id === 'u:world') {
    if (wUmbShadowAt(x, y)) return 'A shadow with nobody to cast it. It is looking at you.';
    const h = wUmbHazardAt(m, x, y);
    if (h === 'spike') return `Spikes, black as old bone, a hand high. They cost ${wUmbSpikeHp()} HP to walk on.`;
    if (h === 'pit') return wUmbDread() >= 1 ? 'A pit, open, with no bottom you can see. Walk round it.' : 'Cracked ground. It holds, for now.';
  }
  return wWU8CLookText.apply(this, arguments);
};

/* ---------- drawing them: on the ground, and the shadows among the actors ---------- */
W_ACTORS.push((acts, now, t) => {
  const m = WG && MAPS[WG.map]; if (!m || m.id !== 'u:world' || !wUmb()) return;
  const T = WTILE, open = wUmbDread() >= 1;
  for (const k in m.hazards || {}) {
    const [hx, hy] = k.split(',').map(Number); if (Math.abs(hx - WG.x) > 24 || Math.abs(hy - WG.y) > 16) continue;
    const h = m.hazards[k];
    // (sorted first in its row: a mark on the ground, under anyone standing there)
    acts.push({ x: hx, y: hy - .6, draw: (c, sx, sy) => {
      const cx = sx, cy = sy + 3 - T / 2 + .6 * T;
      c.save();
      if (h === 'spike') {
        for (const [ox, oy, s] of [[-7, 4, 1], [0, -3, 1.2], [7, 3, .9], [-2, 8, .8]]) {
          c.beginPath(); c.moveTo(cx + ox - 4 * s, cy + oy + 4); c.lineTo(cx + ox, cy + oy - 9 * s); c.lineTo(cx + ox + 4 * s, cy + oy + 4); c.closePath();
          c.fillStyle = '#2a2230'; c.fill(); c.strokeStyle = '#17100e'; c.lineWidth = 1.1; c.stroke();
          c.fillStyle = '#d8d0e8'; c.beginPath(); c.moveTo(cx + ox - 1.2 * s, cy + oy - 5 * s); c.lineTo(cx + ox, cy + oy - 9 * s); c.lineTo(cx + ox + 1.2 * s, cy + oy - 5 * s); c.fill();
        }
      } else if (open) {
        c.fillStyle = '#07040a'; c.beginPath(); c.ellipse(cx, cy + 2, 12, 7, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#8a6ab8'; c.globalAlpha = .55 + Math.sin(t * 2 + hx) * .2; c.lineWidth = 1.6; c.stroke();
      } else {
        c.strokeStyle = 'rgba(20,12,24,.75)'; c.lineWidth = 1.3; c.beginPath();
        c.moveTo(cx - 10, cy); c.lineTo(cx - 3, cy + 2); c.lineTo(cx + 2, cy - 2); c.lineTo(cx + 10, cy + 1); c.moveTo(cx - 3, cy + 2); c.lineTo(cx - 5, cy + 7); c.moveTo(cx + 2, cy - 2); c.lineTo(cx + 4, cy - 7);
        c.stroke();
      }
      c.restore();
    } });
  }
  for (const s of wUmbShadows()) {
    if (Math.abs(s.x - WG.x) > 24 || Math.abs(s.y - WG.y) > 16) continue;
    const a = W_UMB8C_ANIM[s.id]; let x = s.x, y = s.y;
    if (a && now - a.mt < WSTEP_MS * 1.6) { const k = (now - a.mt) / (WSTEP_MS * 1.6); x = a.px + (s.x - a.px) * k; y = a.py + (s.y - a.py) * k; }
    acts.push({ x, y, who: { kind: 'wraith', shade: 1, col: '#1a1024', light: '#c8b8ff', face: WG.x < s.x ? 'l' : 'r', walk: t * 8, seed: s.x * 3 + s.y }, size: 30, alpha: .82 });
  }
});

/* ---------- the stages: their scenes ---------- */
function wUmbDreadCheck() {
  const U = wUmb(); if (!U || LAB) return;
  const s = wUmbDread();
  if (s > (U.dreadSeen || 0)) { U.dreadSeen = s; U.dreadScene = s; wInvalidate('u:world'); }
}
const wWU8COnNadir = W_ON_END.nadir;
W_ON_END.nadir = function () { const r = wWU8COnNadir.apply(this, arguments); wUmbDreadCheck(); return r; };
const wWU8CStart = wStart;
wStart = function () { const r = wWU8CStart.apply(this, arguments); wUmbDreadCheck(); return r; };
function wUmbDreadScene(s) {
  const S = W_UMB8C.scenes[s]; if (!S) return false;
  const close = modal(`<header><h3>${esc(S.h)}</h3></header><div class="wumblines">${S.lines.map(l => `<p class="wumbn">${esc(l)}</p>`).join('')}
    <p class="hint">${esc(wUmbDreadDoes(s))}</p></div><div class="row"><button class="btn" id="wUmbDreadGo">On, then</button></div>`, () => { WUI.hudKey = ''; wDrain(); });
  wUmbSound('dread');
  const box = $('modalBox'); if (box && box.animate) box.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(0,0)' }], { duration: 420 });
  wLog(`${S.h}. ${S.lines.join(' ')}`, 'b');
  $('wUmbDreadGo').onclick = () => close();
  return true;
}
// what a stage changes, in a line
function wUmbDreadDoes(s) {
  return [`The shadows on the dark world: ${W_UMB8C.shadows[0]}.`,
    `The pits are open now, and there are ${W_UMB8C.shadows[1]} shadows on the dark world.`,
    `The shadows hunt: when they see you they come two steps at a time, every third step. There are ${W_UMB8C.shadows[2]} of them.`,
    `There are ${W_UMB8C.shadows[3]} shadows on the dark world, and they see further.`][s];
}
const wWU8CNextPrompt = wNextPrompt;
wNextPrompt = function () {
  const U = wUmb();
  if (U && U.dreadScene && U.sealed) U.dreadScene = 0;   // (stale once the Seal is forged)
  if (U && U.dreadScene && !LAB && wActive()) { const s = U.dreadScene; U.dreadScene = 0; wSave(); if (wUmbDreadScene(s)) return true; }
  return wWU8CNextPrompt.apply(this, arguments);
};
const wWU8CBlight = wUmbBlight;
wUmbBlight = function () { const n = wWU8CBlight.apply(this, arguments); return n ? Math.min(W_UMB1.eclipseMax, n + wUmbDread()) : n; };
const wWU8CSound = wUmbSound;
wUmbSound = function (k) {
  if (k !== 'dread') return wWU8CSound.apply(this, arguments);
  if (LAB || !SET.sfx) return;
  try { tone(73, 2.4, 'sawtooth', .025, -12); tone(110, 2.2, 'sine', .04, -30, .15); noise(1.4, .04, 260, 1, .1); } catch (e) { console.error(e); }
};

/* ---------- Shadow Salt ---------- */
const wWU8CUseItem = wUseItem;
wUseItem = function (k) {
  if (k !== 'shadowsalt') return wWU8CUseItem.apply(this, arguments);
  const U = wUmb();
  if (!U || !WG || WG.map !== 'u:world') return 'Shadow Salt only works out on the dark world.';
  if (B && !B.over && UI.view === 'fight') return 'Not during a match.';
  if (!wHas(k)) return 'You have no Shadow Salt.';
  wAddItem(k, -1); U.salt = W_UMB8C.salt;
  wLog(`You scatter the grey salt. The shadows turn this way and that, and can't find you. ${W_UMB8C.salt} steps.`, 'm');
  wSave(); return '';
};
const wWU8CCampBag = wCampBag;
wCampBag = function () {
  const h = wWU8CCampBag.apply(this, arguments);
  if (!wHas('shadowsalt')) return h;
  // (its row gets a button: the bag's own buttons are for healing, and this one isn't)
  return h.replace(/(<b>Shadow Salt<\/b>[\s\S]*?<td class="wnum dim">have \d+<\/td><td>)/, `$1<button class="ghost" data-wuse="shadowsalt" ${WG.map === 'u:world' ? '' : 'disabled title="Only on the dark world"'}>Scatter</button>`);
};

// the dark shops sell from their own lists
const wWU8CUmbShop = wUmbShop;
wUmbShop = function (shop, who) { const k = String(shop || 'general'); return wWU8CUmbShop.call(this, k.startsWith('u_') ? k : DB.shops['u_' + k] ? 'u_' + k : 'u_general', who); };

/* ---------- How to play ---------- */
const wWU8CRenderHelp = renderHelp;
renderHelp = function () {
  wWU8CRenderHelp.apply(this, arguments);
  const h = $('wHelpUmbral'); if (!h || !wUmbOn() || $('wHelpDread')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpDread"><b>The Dread.</b> The dark side wakes as you take its pieces: ${W_UMB8C.names.map((n, i) => `${n} (${W_UMB8C.stages[i]}${W_UMB8C.stages[i + 1] ? '-' + (W_UMB8C.stages[i + 1] - 1) : '-9'} pieces)`).join(', ')}.
    Hungry shadows walk the dark world, more of them at each stage. One that sees you comes for you, and from the Raging they come two steps at a time; one that reaches you is a match. They keep out of a lantern's light, and Shadow Salt (from the dark shops) hides you from them.
    Spikes cost ${W_UMB8C.spikeHp} HP to walk on. From the Stirring, the cracked ground opens into pits: ${W_UMB8C.pitHp} HP, and you climb out somewhere else. Wild matches come half as often on that side; the danger is one you can see.</p>`);
};
