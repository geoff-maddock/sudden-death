/* ================= Dungeon crawl replay: an animated retelling of the last crawl ================= */
// Built from the crawl's room log (runCrawl records room type, who acted, the foe, trap or puzzle, who got hurt).
// The party is drawn with the game's figure art; each dungeon has its own inked backdrop; foes that match a
// creature (goblins, a lizard-knight, a bone golem…) use the creature art in the dungeon's colours, the rest
// (swarms, oozes, wyrms) are drawn in the same inked style. It plays after you send a party in (Settings can
// make it on-request only), and the crawl report has a "Watch the crawl" button any time.
PREF_DEFS.push({ k: 'dgAnim', label: 'Dungeon crawl replay', opts: [[true, 'Play it'], [false, 'On request']], help: 'After you send a party into a dungeon, play an animated replay of the crawl room by room. On request: only when you press Watch the crawl.' });
{ const g = prefGet, s = prefSet;
  prefGet = function (k) { return k === 'dgAnim' ? SET.dgAnim !== false : g.apply(this, arguments); };
  prefSet = function (k, v) { if (k === 'dgAnim') { SET.dgAnim = v; saveSettings(); return; } return s.apply(this, arguments); }; }

const DW = 960, DH = 480, FLOOR = 408;
const DTHEME = {
  crypt:   { wall: '#1c2a2e', wall2: '#243639', floor: '#1d2c2b', accent: '#5fb3ad', foe: '#4f7f76', light: '#9fe8d6', fx: 'water' },
  warren:  { wall: '#2c2217', wall2: '#382b1c', floor: '#33271a', accent: '#c89a52', foe: '#7a5a2e', light: '#ffd27a', fx: 'roots' },
  orchard: { wall: '#27252e', wall2: '#322f3a', floor: '#2d2a33', accent: '#e6dcc2', foe: '#8a8272', light: '#f2ead2', fx: 'bones' },
  sump:    { wall: '#18261a', wall2: '#203320', floor: '#1d2c1b', accent: '#8fe04a', foe: '#4f8a3a', light: '#c8ff8a', fx: 'acid' },
  pit:     { wall: '#2c120e', wall2: '#3a1813', floor: '#331510', accent: '#ff7a2a', foe: '#8a2a18', light: '#ffb070', fx: 'lava' },
};
const FOE_ART = { 'goblin war-band': ['goblin', 3], 'goblin shaman': ['goblin', 1], 'a goblin war-band': ['goblin', 3], 'lizard-knight': ['kobold', 1], 'bone golem': ['golem', 1], 'Ash Baron': ['vampire', 1], 'thorn wight': ['wraith', 1], 'drowned ghoul': ['zombie', 1], 'weeping shade': ['wraith', 1], 'pit fiend': ['minotaur', 1], 'cave bear': ['werewolf', 1] };
const ROOM_TITLE = { fight: 'Fight', trap: 'Trap', puzzle: 'Puzzle', treasure: 'Treasure', mimic: 'Treasure?', shrine: 'Shrine', turn: 'Turning back', hoard: 'The bottom', enter: '', end: '' };
const SCENE_LEN = { enter: 3, fight: 4.2, trap: 3.8, puzzle: 3.8, treasure: 3.6, mimic: 4, shrine: 3, turn: 2.6, hoard: 3.2 };

/* ---------- the player ---------- */
const DA = { res: null, scenes: [], i: 0, t: 0, speed: 1, playing: false, raf: 0, last: 0, cv: null, c: null, seed: 1 };
const daDlg = document.createElement('div');
daDlg.className = 'dlg-back da-back'; daDlg.hidden = true;
daDlg.innerHTML = `<div class="dlg da-dlg" role="dialog" aria-modal="true" aria-labelledby="daT">
  <div class="da-top"><h2 id="daT">Dungeon crawl</h2><button class="ghost da-x" type="button" data-da="close" aria-label="Close">✕</button></div>
  <canvas id="daCv" width="${DW * 2}" height="${DH * 2}" aria-label="Animated replay of the dungeon crawl"></canvas>
  <p class="sub da-cap" id="daCap" aria-live="polite"></p>
  <div class="row da-ctl"><button class="buy" type="button" data-da="prev">⏮ Room</button><button class="buy" type="button" data-da="play">⏸ Pause</button><button class="buy" type="button" data-da="next">Room ⏭</button><button class="buy" type="button" data-da="speed">Speed 1×</button><button class="buy" type="button" data-da="end">Skip to the end</button><button class="buy" type="button" data-da="replay">Replay</button></div>
</div>`;
document.body.appendChild(daDlg);
DA.cv = document.getElementById('daCv'); DA.c = DA.cv.getContext('2d');

function buildScenes(res) {
  const sc = [{ k: 'enter' }];
  for (const e of res.log || []) {
    if (e.t === 'hurt' && sc.length) { sc[sc.length - 1].extra = e; continue; }
    const k = e.room || (e.t === 'turn' ? 'turn' : e.t === 'shrine' ? 'shrine' : /bottom/.test(e.txt || '') ? 'hoard' : 'fight');
    sc.push({ k, e, ok: e.t === 'win' || e.t === 'loot' || e.t === 'shrine' });
  }
  sc.push({ k: 'end' });
  return sc;
}
function openCrawlAnim(res) {
  if (!res || !res.log) return;
  DA.res = res; DA.scenes = buildScenes(res); DA.i = 0; DA.t = 0; DA.playing = true; DA.seed = (res.rooms * 131 + (res.loot.gold || 0)) % 997 + 1;
  document.getElementById('daT').textContent = res.dungeon;
  daDlg.hidden = false; daSync(); DA.last = performance.now(); cancelAnimationFrame(DA.raf); DA.raf = requestAnimationFrame(daFrame);
  try { daDlg.querySelector('[data-da="play"]').focus(); } catch (e) { }
}
function closeCrawlAnim() { daDlg.hidden = true; DA.playing = false; cancelAnimationFrame(DA.raf); }
function daSync() {
  daDlg.querySelector('[data-da="play"]').textContent = DA.playing ? '⏸ Pause' : '▶ Play';
  daDlg.querySelector('[data-da="speed"]').textContent = `Speed ${DA.speed}×`;
  const s = DA.scenes[DA.i]; document.getElementById('daCap').textContent = s ? capText(s) : '';
}
function capText(s) {
  const r = DA.res;
  if (s.k === 'enter') return `${r.party.map(p => p.n).join(', ')} go into ${r.dungeon} (${'★'.repeat(r.diff)}${'☆'.repeat(5 - r.diff)}, ${r.approach.toLowerCase()}).`;
  if (s.k === 'end') return `${r.rooms}/${r.of} rooms${r.cleared ? ', cleared' : r.turned ? ', turned back' : ''}. +${r.loot.gold}g${r.loot.ess ? `, +${r.loot.ess} essence` : ''}.`;
  return String(s.e.txt || '').trim() + (s.extra ? ' ' + String(s.extra.txt).trim() + '.' : '');
}
daDlg.addEventListener('click', e => {
  if (e.target === daDlg) { closeCrawlAnim(); return; }
  const b = e.target.closest('[data-da]'); if (!b) return;
  const a = b.dataset.da;
  if (a === 'close') return closeCrawlAnim();
  if (a === 'play') { if (DA.i >= DA.scenes.length - 1 && !DA.playing) { DA.i = 0; DA.t = 0; } DA.playing = !DA.playing; }
  else if (a === 'prev') { DA.i = Math.max(0, DA.i - (DA.t < .6 ? 1 : 0)); DA.t = 0; }
  else if (a === 'next') { DA.i = Math.min(DA.scenes.length - 1, DA.i + 1); DA.t = 0; }
  else if (a === 'speed') DA.speed = DA.speed === 1 ? 2 : 1;
  else if (a === 'end') { DA.i = DA.scenes.length - 1; DA.t = 0; }
  else if (a === 'replay') { DA.i = 0; DA.t = 0; DA.playing = true; }
  daSync();
});
window.addEventListener('keydown', e => {
  if (daDlg.hidden) return;
  if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeCrawlAnim(); }
  else if (e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); DA.playing = !DA.playing; daSync(); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); DA.i = Math.min(DA.scenes.length - 1, DA.i + 1); DA.t = 0; daSync(); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); DA.i = Math.max(0, DA.i - 1); DA.t = 0; daSync(); }
}, true);
function daFrame(now) {
  if (daDlg.hidden) return;
  const dt = Math.min(.1, (now - DA.last) / 1000); DA.last = now;
  if (DA.playing) {
    DA.t += dt * DA.speed;
    const s = DA.scenes[DA.i], len = SCENE_LEN[s.k] || 3;
    if (s.k !== 'end' && DA.t >= len) { DA.i++; DA.t = 0; daSync(); }
  }
  if (DA.shown !== DA.i) { DA.shown = DA.i; daSync(); }
  try { drawScene(DA.c, DA.scenes[DA.i], DA.t); } catch (e) { }
  DA.raf = requestAnimationFrame(daFrame);
}

/* ---------- drawing ---------- */
const ez = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const seg = (t, a, b) => ez((t - a) / (b - a));
function daRand(n) { let s = (DA.seed * 7919 + n * 104729) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function drawBackdrop(c, th, t, room) {
  const r = daRand(room * 13 + 3);
  // back wall of rough stone blocks
  c.fillStyle = th.wall; c.fillRect(0, 0, DW, FLOOR);
  for (let y = 0, row = 0; y < FLOOR - 30; y += 34, row++) for (let x = -(row % 2) * 40; x < DW; x += 80) {
    const w = 76 - r() * 8, h = 30 - r() * 4; c.fillStyle = r() < .5 ? th.wall2 : th.wall; rr(c, x + 2, y + 2, w, h, 5); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.stroke();
  }
  // an archway to the next room
  c.fillStyle = '#07090a'; c.beginPath(); c.moveTo(820, FLOOR); c.lineTo(820, 190); c.arc(880, 190, 60, Math.PI, 0); c.lineTo(940, FLOOR); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 8; c.stroke(); c.strokeStyle = th.wall2; c.lineWidth = 3; c.stroke();
  // floor
  const g = c.createLinearGradient(0, FLOOR, 0, DH); g.addColorStop(0, th.floor); g.addColorStop(1, '#050606'); c.fillStyle = g; c.fillRect(0, FLOOR, DW, DH - FLOOR);
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(480 + i * 60, FLOOR); c.lineTo(480 + i * 150, DH); c.stroke(); }
  // theme dressing
  if (th.fx === 'water') for (let i = 0; i < 5; i++) { const x = 60 + r() * 840, y = FLOOR + 20 + r() * 40; ell(c, x, y, 50 + r() * 40, 6, `rgba(95,179,173,${.18 + .06 * Math.sin(t * 2 + i)})`); }
  if (th.fx === 'roots') { c.strokeStyle = '#4a3520'; c.lineWidth = 4; for (let i = 0; i < 7; i++) { const x = r() * DW; c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + 30 - r() * 60, 60, x + 20 - r() * 40, 90 + r() * 70); c.stroke(); } }
  if (th.fx === 'bones') { for (let i = 0; i < 9; i++) { const x = 40 + r() * 880, y = FLOOR + 14 + r() * 50; c.save(); c.translate(x, y); c.rotate(r() * 3); c.fillStyle = '#d8cfb8'; c.fillRect(-9, -1.5, 18, 3); circ(c, -9, -2, 2.4, '#d8cfb8'); circ(c, -9, 2, 2.4, '#d8cfb8'); circ(c, 9, -2, 2.4, '#d8cfb8'); circ(c, 9, 2, 2.4, '#d8cfb8'); c.restore(); } circ(c, 120, FLOOR + 30, 12, '#e6dcc2'); circ(c, 115, FLOOR + 28, 3, '#111'); circ(c, 125, FLOOR + 28, 3, '#111'); }
  if (th.fx === 'acid') for (let i = 0; i < 4; i++) { const x = 90 + r() * 780, y = FLOOR + 24 + r() * 36; ell(c, x, y, 44, 8, 'rgba(143,224,74,.28)'); circ(c, x + Math.sin(t * 3 + i) * 20, y - 2 - ((t * 20 + i * 7) % 10), 2.5, 'rgba(200,255,140,.7)'); }
  if (th.fx === 'lava') { c.strokeStyle = `rgba(255,122,42,${.5 + .2 * Math.sin(t * 4)})`; c.lineWidth = 3; for (let i = 0; i < 5; i++) { let x = r() * DW, y = FLOOR + 10; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 4; j++) { x += 30 - r() * 60; y += 14; c.lineTo(x, y); } c.stroke(); } for (let i = 0; i < 16; i++) { const x = (r() * DW + t * 10) % DW, y = FLOOR - ((t * 40 + r() * 400) % 400); circ(c, x, y, 1.6, 'rgba(255,170,80,.8)'); } }
  // torches
  for (const x of [150, 470, 760]) { const f = .85 + .15 * Math.sin(t * 13 + x); const gl = c.createRadialGradient(x, 120, 2, x, 120, 110 * f); gl.addColorStop(0, 'rgba(255,190,90,.35)'); gl.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = gl; c.fillRect(x - 120, 0, 240, 260); c.fillStyle = '#3a2a1a'; c.fillRect(x - 4, 120, 8, 26); circ(c, x, 116, 7 * f, th.light); circ(c, x, 114, 4 * f, '#fff6d8'); }
}
function vignette(c) { const g = c.createRadialGradient(DW / 2, DH / 2, 220, DW / 2, DH / 2, 620); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.7)'); c.fillStyle = g; c.fillRect(0, 0, DW, DH); }
const partyTeam = () => ({ id: 'club', color: DA.res.club.color || '#c9c2ad', light: DA.res.club.light || '#fff', short: DA.res.club.short || '?', trim: DA.res.club.trim || '#141014' });
function drawParty(c, t, o = {}) {
  const P = DA.res.party, team = partyTeam();
  P.forEach((p, i) => {
    let x = 140 + i * 120 + (o.dx || 0), y = FLOOR + 6, run = o.walk ? t * 16 + i : 0, alpha = 1, tilt = 0, lift = 0;
    if (o.actor === p.n && o.lunge) { x += o.lunge; run = o.lunge > 4 ? t * 22 : run; }
    if (o.victim === p.n && o.hit > 0) { x -= 30 * o.hit; tilt = -(o.down ? 1.35 : .35) * o.hit; lift = o.down ? 0 : 6 * Math.sin(o.hit * Math.PI); }
    if (o.hop) lift = Math.max(lift, 26 * Math.max(0, Math.sin(o.hop * Math.PI)));
    c.save(); c.translate(x, y - lift); if (tilt) c.rotate(tilt);
    c.globalAlpha = alpha;
    drawFig(c, p.kind, 0, 0, 168, team, { num: p.num, run, mitt: false, flip: false });
    c.restore();
    if (o.victim === p.n && o.hit > .2) { txt(c, `−${o.dmg || ''}`.replace(/−$/, '−'), x, y - 190, F_HUD(26), '#ff6a5a', 'center'); if (o.down && o.hit > .8) { txt(c, 'z', x + 30, y - 40 - (t * 10 % 8), F_HUD(18), '#c9d8ff'); txt(c, 'Z', x + 38, y - 50 - (t * 10 % 8), F_HUD(22), '#c9d8ff'); } }
    if (o.mark === p.n) { txt(c, '!', x, y - 190 - 4 * Math.sin(t * 8), F_DSP(40), '#ffd34a', 'center'); }
  });
}
// foes
function foeArt(foe) { const k = Object.keys(FOE_ART).find(n => foe && foe.toLowerCase().includes(n.toLowerCase())); return k ? FOE_ART[k] : null; }
function drawFoe(c, foe, th, x, t, st) {
  const a = foeArt(foe), fade = st.fade == null ? 1 : st.fade, shake = st.hurt ? Math.sin(t * 60) * 4 * st.hurt : 0;
  c.save(); c.globalAlpha = fade; c.translate(x + shake, FLOOR + 6 + (st.sink || 0) * 40);
  const team = { id: 'foe', color: th.foe, light: th.light, short: '?', trim: '#0b0b0b' };
  if (a) { const [kind, n] = a; for (let i = n - 1; i >= 0; i--) drawFig(c, kind, i * 66 - (n - 1) * 33, i ? -8 : 0, 185 - i * 14, team, { flip: true, run: st.charge ? t * 16 : 0, num: '' }); }
  else if (/rat|crow|swarm|hound/i.test(foe)) {
    const n = 9, fire = /magma|hound/i.test(foe), bird = /crow/i.test(foe);
    for (let i = 0; i < n; i++) { const px = Math.sin(t * 5 + i * 1.7) * 50 + (i - n / 2) * 14, py = bird ? -90 - Math.cos(t * 6 + i) * 30 - i * 6 : -10 - (i % 3) * 8;
      LW = 2; FSC = 1; ink(c, pEl(px, py, bird ? 12 : fire ? 18 : 11, bird ? 6 : fire ? 10 : 6, bird ? Math.sin(t * 20 + i) * .5 : 0), fire ? '#8a2a18' : bird ? '#1a1620' : '#8a8272', 0, true);
      circ(c, px + (bird ? 8 : 10), py - 2, 2.2, fire ? '#ffd05a' : '#ff4a3a'); if (fire) circ(c, px - 12, py - 6, 3 + Math.sin(t * 20 + i), 'rgba(255,150,50,.7)'); }
  } else if (/ooze/i.test(foe)) {
    LW = 2.5; FSC = 1; const w = 110 + Math.sin(t * 4) * 10, h = 80 - Math.sin(t * 4) * 8; ink(c, pEl(0, -h / 2, w / 2, h / 2), 'rgba(143,224,74,.85)', 0, true); circ(c, -18, -h / 2 - 8, 7, '#fff'); circ(c, 16, -h / 2 - 12, 6, '#fff'); circ(c, -18, -h / 2 - 8, 3, '#111'); circ(c, 16, -h / 2 - 12, 3, '#111');
    for (let i = 0; i < 4; i++) circ(c, -30 + i * 20, -10 - ((t * 30 + i * 13) % 50), 4, 'rgba(210,255,160,.6)');
  } else { // a wyrm: a long neck and a horned head
    LW = 2.5; FSC = 1; const sw = Math.sin(t * 3) * 14;
    const neck = capsule(-20, -10, 26, 10 + sw, -150, 16, 6, 6); ink(c, neck, th.foe);
    ink(c, pEl(-10, -20, 60, 34), th.foe);
    const hx = 10 + sw, hy = -160; ink(c, pEl(hx - 22, hy, 36, 20, -.2), tint(th.foe, .12));
    for (const s of [-1, 1]) ink(c, pPoly([[hx - 4 + s * 8, hy - 16], [hx + 8 + s * 14, hy - 44], [hx + 6 + s * 4, hy - 14]]), '#efe6cf', 0, true);
    circ(c, hx - 30, hy - 4, 4, th.light); for (let i = 0; i < 4; i++) tri(c, [hx - 52 + i * 8, hy + 10], [hx - 46 + i * 8, hy + 10], [hx - 49 + i * 8, hy + 18], '#fff');
  }
  c.restore();
}
function burst(c, x, y, k, col) { for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, d = 12 + 40 * k; c.strokeStyle = col; c.globalAlpha = 1 - k; c.lineWidth = 3; c.beginPath(); c.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); c.lineTo(x + Math.cos(a) * (d + 14), y + Math.sin(a) * (d + 14)); c.stroke(); } c.globalAlpha = 1; }
function coins(c, x, y, k, n = 14) { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / n - .5) * 1.8, v = 140 + (i % 4) * 30, px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k + 260 * k * k; if (py > FLOOR + 20) continue; ell(c, px, py, 6, 4.5, '#ffd35a'); ell(c, px - 1, py - 1, 3, 2, '#fff2b0'); } }
function floatText(c, s, x, y, k, col) { if (k <= 0) return; c.save(); c.globalAlpha = Math.min(1, k * 3) * (k > .8 ? (1 - k) * 5 : 1); txt(c, s, x, y - 30 * k, F_DSP(34), col, 'center'); c.restore(); }
function diceBox(c, check, ok, k) {
  if (!check || k <= 0) return; const m = /d20 (\d+) \+ (\d+).*vs (\d+)/.exec(check); if (!m) return;
  c.save(); c.globalAlpha = Math.min(1, k * 4); rr(c, DW - 250, 22, 228, 64, 8); c.fillStyle = 'rgba(10,8,14,.9)'; c.fill(); c.strokeStyle = k < .35 ? '#a88cff' : ok ? '#8fe38a' : '#ff6a5a'; c.lineWidth = 2; c.stroke();
  const spin = k < .35; txt(c, spin ? String(1 + ((performance.now() / 40) | 0) % 20) : m[1], DW - 220, 66, F_HUD(34), '#fff', 'center');
  txt(c, `d20 + ${m[2]} vs ${m[3]}`, DW - 190, 50, F_HUD(18), COL.faint); if (!spin) txt(c, ok ? 'Success' : 'Failed', DW - 190, 74, F_DSP(22), ok ? '#8fe38a' : '#ff6a5a');
  c.restore();
}
function dmgOf(e) { const m = /−(\d+)/.exec(e && e.txt || ''); return m ? m[1] : ''; }

function drawScene(c, s, t) {
  const r = DA.res, th = DTHEME[r.dungeonId] || DTHEME.crypt;
  c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, DW, DH);
  const room = Math.max(0, DA.i);
  drawBackdrop(c, th, t, room);
  const e = s.e || {}, ok = s.ok, extra = s.extra;
  if (s.k === 'enter') {
    drawParty(c, t, { dx: -360 + 360 * seg(t, 0, 1.8), walk: t < 1.8 });
    c.save(); c.globalAlpha = seg(t, .2, .8) * (1 - seg(t, 2.4, 3)); txt(c, r.dungeon, DW / 2, 120, F_DSP(56), th.light, 'center'); txt(c, `${'★'.repeat(r.diff)}${'☆'.repeat(5 - r.diff)} · ${r.approach}`, DW / 2, 156, F_HUD(24), '#ede4cd', 'center'); c.restore();
  } else if (s.k === 'fight') {
    const win = ok, hitK = win ? 0 : seg(t, 2.3, 2.8), lunge = win ? 160 * seg(t, 1.2, 1.7) * (1 - seg(t, 3, 3.6)) : 90 * seg(t, 1.2, 1.6) * (1 - seg(t, 1.9, 2.3));
    drawParty(c, t, { dx: -200 + 200 * seg(t, 0, .7), walk: t < .7, actor: e.who, lunge, victim: e.victim || (extra && extra.victim), hit: win ? (extra ? seg(t, 2.6, 3) : 0) : hitK, down: !!(e.down || (extra && extra.down)), dmg: dmgOf(win ? extra : e) });
    drawFoe(c, e.foe || '', th, 700, t, { fade: seg(t, .5, 1) * (win ? 1 - seg(t, 2.4, 3.2) : 1), sink: win ? seg(t, 2.4, 3.2) : 0, hurt: win ? seg(t, 1.6, 1.8) * (1 - seg(t, 2.2, 2.4)) : 0, charge: !win && t > 1.9 && t < 2.4 });
    if (t > 1.5 && t < 2.1) burst(c, 560, FLOOR - 70, (t - 1.5) / .6, '#ffe7a0');
    if (!win && t > 2.3 && t < 2.8) { c.fillStyle = `rgba(255,40,40,${.25 * (1 - (t - 2.3) / .5)})`; c.fillRect(0, 0, DW, DH); }
    diceBox(c, e.check, win, seg(t, .8, 2.2));
    if (win) { coins(c, 700, FLOOR - 60, seg(t, 2.6, 3.8)); floatText(c, `+${e.gold || ''}g`, 700, FLOOR - 170, seg(t, 2.6, 4), '#ffd35a'); }
  } else if (s.k === 'trap') {
    const tr = e.trap || 'spike pit', x = 520, trig = ok ? seg(t, 2.2, 2.6) : seg(t, 1.8, 2.2);
    drawParty(c, t, { dx: -200 + 200 * seg(t, 0, .8) + (ok ? 120 * seg(t, 2.6, 3.6) : 0), walk: t < .8 || (ok && t > 2.6), mark: ok && t > 1 && t < 2.2 ? e.who : null, hop: ok ? seg(t, 2.6, 3.4) : 0, victim: !ok ? e.victim : null, hit: !ok ? seg(t, 2.2, 2.7) : 0, down: e.down, dmg: dmgOf(e) });
    drawTrap(c, tr, x, t, trig, th);
    diceBox(c, e.check, ok, seg(t, .6, 1.8));
  } else if (s.k === 'puzzle') {
    const k = seg(t, .9, 2.4);
    drawDoor(c, th, t, k, ok ? seg(t, 2.4, 3) : 0, !ok && t > 2.4);
    drawParty(c, t, { dx: -200 + 200 * seg(t, 0, .8), walk: t < .8, actor: e.who, lunge: 60 * seg(t, .9, 1.3), victim: !ok ? e.victim : null, hit: !ok ? seg(t, 2.6, 3.1) : 0, down: e.down, dmg: dmgOf(e) });
    if (!ok && t > 2.4 && t < 3) { c.strokeStyle = `rgba(255,70,70,${1 - (t - 2.4) / .6})`; c.lineWidth = 6; c.beginPath(); c.moveTo(640, 250); const vi = DA.res.party.findIndex(p => p.n === e.victim); c.lineTo(140 + Math.max(0, vi) * 120, FLOOR - 90); c.stroke(); }
    if (ok) floatText(c, `+${e.ess || 1} ✧`, 640, 200, seg(t, 2.6, 3.8), '#d6c4ff');
    diceBox(c, e.check, ok, seg(t, .8, 2.2));
  } else if (s.k === 'treasure' || s.k === 'mimic') {
    const mim = s.k === 'mimic', open = mim ? seg(t, 1.8, 2.1) : seg(t, 1.8, 2.3);
    drawParty(c, t, { dx: -200 + 200 * seg(t, 0, .8), walk: t < .8, actor: e.who, lunge: 150 * seg(t, .9, 1.6) * (mim ? 1 - seg(t, 2.1, 2.4) : 1), victim: mim ? e.victim : null, hit: mim ? seg(t, 2.2, 2.7) : 0, down: e.down, dmg: dmgOf(e) });
    drawChest(c, 600, open, mim, t);
    if (!mim) { coins(c, 600, FLOOR - 40, seg(t, 2.1, 3.3), 18); floatText(c, `+${e.gold || ''}g`, 600, FLOOR - 160, seg(t, 2.2, 3.6), '#ffd35a'); if (e.extra) floatText(c, e.extra, 600, FLOOR - 200, seg(t, 2.6, 3.6), '#f0dca8'); }
    diceBox(c, e.check, !mim, seg(t, .8, 1.8));
  } else if (s.k === 'shrine') {
    drawAltar(c, 600, t, th);
    drawParty(c, t, { dx: -200 + 200 * seg(t, 0, .8), walk: t < .8 });
    const k = seg(t, 1, 2.6); for (let i = 0; i < 24; i++) { const px = 140 + (i % 3) * 120 + Math.sin(t * 3 + i) * 20, py = FLOOR - 20 - ((t * 60 + i * 23) % 160); if (k > 0) circ(c, px, py, 3, `rgba(143,227,138,${.7 * k})`); }
    floatText(c, `+${e.heal || ''} health`, 255, FLOOR - 190, seg(t, 1.4, 2.9), '#8fe38a');
  } else if (s.k === 'turn') {
    drawParty(c, t, { dx: -260 * seg(t, .6, 2.4), walk: t > .6 });
    c.save(); c.globalAlpha = seg(t, .2, .6); txt(c, 'The party turns back', DW / 2, 130, F_DSP(44), th.light, 'center'); c.restore();
  } else if (s.k === 'hoard') {
    const k = seg(t, .4, 1.6);
    for (let i = 0; i < 40; i++) { const r2 = daRand(i)(); ell(c, 620 + (r2 - .5) * 180 * (1 - i / 40), FLOOR - i * 1.6, 7, 4.5, i % 3 ? '#ffd35a' : '#f0b030'); }
    for (let i = 0; i < 6; i++) { const a = t * 2 + i; circ(c, 620 + Math.cos(a) * 80, FLOOR - 50 + Math.sin(a * 1.3) * 30, 2 + Math.sin(t * 8 + i), '#fff6c8'); }
    drawParty(c, t, { dx: -200 + 200 * seg(t, 0, .9), walk: t < .9, hop: seg(t, 1.2, 1.8) });
    floatText(c, `Bonus hoard +${e.gold || ''}g`, 620, FLOOR - 170, k, '#ffd35a');
  } else if (s.k === 'end') { drawEnd(c, th); }
  vignette(c);
  if (s.k !== 'end') {
    const n = DA.scenes.filter(x => x.e && x.e.room && x.k !== 'turn' && x.k !== 'hoard').indexOf(s);
    if (ROOM_TITLE[s.k]) { rr(c, 16, 16, 230, 38, 8); c.fillStyle = 'rgba(8,10,12,.78)'; c.fill(); txt(c, `${n >= 0 ? `ROOM ${n + 1} · ` : ''}${ROOM_TITLE[s.k].toUpperCase()}`, 30, 42, F_HUD(22), th.light); }
    // progress pips
    const tot = DA.scenes.length; for (let i = 0; i < tot; i++) circ(c, DW / 2 - (tot - 1) * 9 + i * 18, DH - 16, i === DA.i ? 5 : 3.5, i < DA.i ? th.accent : i === DA.i ? '#fff' : 'rgba(255,255,255,.25)');
  }
}
function drawTrap(c, kind, x, t, k, th) {
  LW = 2.5; FSC = 1;
  if (/spike/.test(kind)) { ell(c, x, FLOOR + 14, 90, 14, '#050404'); for (let i = 0; i < 9; i++) { const px = x - 72 + i * 18, h = 60 * k; tri(c, [px - 6, FLOOR + 14], [px + 6, FLOOR + 14], [px, FLOOR + 14 - h], '#b8c0ca'); } }
  else if (/blade/.test(kind)) { const a = Math.sin(t * 3.4) * (0.2 + 1.1 * k); c.save(); c.translate(x, 0); c.rotate(a); c.strokeStyle = '#555'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 300); c.stroke(); c.beginPath(); c.arc(0, 300, 60, .2, Math.PI - .2); c.closePath(); c.fillStyle = '#c9d0d6'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke(); c.restore(); }
  else if (/dart/.test(kind)) { for (const y of [260, 300, 340]) { c.fillStyle = '#111'; c.fillRect(DW - 150, y - 6, 20, 12); } if (k > 0) for (let i = 0; i < 3; i++) { const px = DW - 160 - k * 520, py = 260 + i * 40; c.strokeStyle = '#8fe04a'; c.lineWidth = 3; c.beginPath(); c.moveTo(px, py); c.lineTo(px + 26, py); c.stroke(); } }
  else { const y = -60 + (FLOOR + 60) * Math.min(1, k * 1.2); c.save(); c.fillStyle = '#3a3a3a'; for (let i = 0; i < 6; i++) c.fillRect(x - 90 + i * 34, y - 300, 10, 300); c.fillRect(x - 96, y - 300, 196, 12); c.fillRect(x - 96, y - 150, 196, 12); for (let i = 0; i < 6; i++) tri(c, [x - 92 + i * 34, y], [x - 78 + i * 34, y], [x - 85 + i * 34, y + 18], '#5a5a5a'); c.restore(); }
}
function drawDoor(c, th, t, k, open, bad) {
  const x = 560, w = 160, top = 150;
  c.fillStyle = '#07090a'; c.fillRect(x, top, w, FLOOR - top);
  c.save(); c.beginPath(); c.rect(x, top, w, FLOOR - top); c.clip();
  const off = open * w * .55; for (const s of [-1, 1]) { c.fillStyle = '#3a2c20'; c.fillRect(s < 0 ? x - off : x + w / 2 + off, top, w / 2, FLOOR - top); c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(s < 0 ? x - off : x + w / 2 + off, top, w / 2, FLOOR - top); }
  c.restore();
  c.strokeStyle = th.wall2; c.lineWidth = 10; c.strokeRect(x - 5, top - 5, w + 10, FLOOR - top + 5);
  for (let i = 0; i < 6; i++) { const lit = k * 6 > i, rx = x + 26 + (i % 3) * 54, ry = top + 60 + Math.floor(i / 3) * 80; c.save(); if (lit) { c.shadowColor = bad ? '#ff4a3a' : th.light; c.shadowBlur = 16; } txt(c, 'ᚠᚱᛟᚷᛞᛉ'[i], rx, ry, F_DSP(34), lit ? (bad ? '#ff6a5a' : th.light) : 'rgba(255,255,255,.18)', 'center'); c.restore(); }
}
function drawChest(c, x, open, mim, t) {
  LW = 2.5; FSC = 1; const y = FLOOR + 4;
  ink(c, pRR(x - 60, y - 60, 120, 60, 6), '#7a4a22'); c.fillStyle = '#d8b64a'; c.fillRect(x - 60, y - 36, 120, 6); c.fillRect(x - 6, y - 44, 12, 14);
  c.save(); c.translate(x - 60, y - 60); c.rotate(-open * (mim ? .9 : 1.9)); ink(c, pRR(0, -28, 120, 30, 10), '#8a5a2a'); c.fillStyle = '#d8b64a'; c.fillRect(0, -6, 120, 5); c.restore();
  if (open > 0) {
    if (mim) { for (let i = 0; i < 7; i++) tri(c, [x - 54 + i * 16, y - 60], [x - 42 + i * 16, y - 60], [x - 48 + i * 16, y - 44], '#fff'); circ(c, x - 24, y - 90 - open * 10, 7, '#ffe14a'); circ(c, x + 18, y - 92 - open * 10, 7, '#ffe14a'); circ(c, x - 24, y - 90 - open * 10, 3, '#111'); circ(c, x + 18, y - 92 - open * 10, 3, '#111'); c.strokeStyle = '#c83a4a'; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 10, y - 50); c.quadraticCurveTo(x - 80, y - 90 + Math.sin(t * 10) * 10, x - 150 * open, y - 50); c.stroke(); }
    else { const g = c.createRadialGradient(x, y - 60, 4, x, y - 60, 90); g.addColorStop(0, `rgba(255,220,120,${.7 * open})`); g.addColorStop(1, 'rgba(255,200,80,0)'); c.fillStyle = g; c.fillRect(x - 100, y - 160, 200, 140); }
  }
}
function drawAltar(c, x, t, th) {
  LW = 2.5; FSC = 1; const y = FLOOR + 4;
  ink(c, pRR(x - 50, y - 70, 100, 70, 4), th.wall2); ink(c, pRR(x - 64, y - 82, 128, 16, 4), tint(th.wall2, .1));
  const f = .8 + .2 * Math.sin(t * 4); c.save(); c.shadowColor = '#8fe38a'; c.shadowBlur = 30 * f; ink(c, pPoly([[x, y - 150], [x + 18, y - 116], [x, y - 86], [x - 18, y - 116]]), '#9ff0b0', 0, true); c.restore();
}
function drawEnd(c, th) {
  const r = DA.res; c.fillStyle = 'rgba(6,8,8,.72)'; c.fillRect(0, 0, DW, DH);
  txt(c, r.cleared ? 'Dungeon cleared!' : r.turned ? 'Back to the surface' : 'The crawl is over', DW / 2, 86, F_DSP(52), th.light, 'center');
  txt(c, `${r.rooms}/${r.of} rooms · +${r.loot.gold}g${r.loot.ess ? ` · +${r.loot.ess} essence` : ''}${r.loot.items.length ? ` · ${r.loot.items.map(k => ITEMS[k] ? ITEMS[k].name : k).join(', ')}` : ''}${r.loot.gear.length ? ` · ${r.loot.gear.map(k => GEAR[k] ? GEAR[k].name : k).join(', ')}` : ''}`, DW / 2, 124, F_TXT(18, 600), '#ede4cd', 'center');
  const team = partyTeam();
  r.lines.forEach((l, i) => {
    const p = r.party.find(q => q.n === l.n) || r.party[i], x = DW / 2 + (i - (r.lines.length - 1) / 2) * 260;
    if (p) { c.save(); c.translate(x, 356); if (l.out) c.rotate(-.12); drawFig(c, p.kind, 0, 0, 150, team, { num: p.num }); c.restore(); }
    txt(c, l.n, x, 392, F_TXT(20, 800), '#ede4cd', 'center');
    txt(c, `+${l.xp} XP${l.ups ? ` · level up!` : ''}`, x, 416, F_TXT(15, 600), l.ups ? '#ffd34a' : COL.dim, 'center');
    txt(c, `health ${l.hp}${l.hpLost > 0 ? ` (−${l.hpLost})` : ''}${l.out ? ` · out ${l.out} game${l.out > 1 ? 's' : ''}` : ''}`, x, 438, F_TXT(15, 600), l.out ? '#ff8a7a' : COL.dim, 'center');
  });
}

/* ---------- hooks: play after you send a party in; a Watch button on the report ---------- */
let DG_USER = false;
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-dg="go"]')) DG_USER = true; }, true);
{ const o = runCrawl; runCrawl = function () {
  const res = o.apply(this, arguments), mine = DG_USER; DG_USER = false;
  if (mine && SET.dgAnim !== false && res && res.party) setTimeout(() => openCrawlAnim(res), 60);
  return res;
}; }
{ const o = dungeonHTML; dungeonHTML = function () {
  let h = o.apply(this, arguments); const rep = S && S.crawl && S.crawl.last;
  if (h && rep && rep.party) h = h.replace('<details class="dg-rep"', `<p style="margin:10px 0 0"><button class="buy" type="button" data-dganim="1">▶ Watch the crawl</button></p><details class="dg-rep"`);
  return h;
}; }
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-dganim]'); if (!b) return; const rep = S && S.crawl && S.crawl.last; if (rep) openCrawlAnim(rep); });

{ const st = document.createElement('style'); st.textContent = `
.da-back{z-index:60}.da-dlg{width:min(1000px,100%);padding:14px 16px}.da-top{display:flex;justify-content:space-between;align-items:center;gap:10px}.da-top h2{margin:0}
.da-x{padding:4px 12px;font-size:18px}
#daCv{display:block;width:100%;height:auto;aspect-ratio:2/1;border-radius:8px;border:1px solid var(--line);background:#05080a;margin-top:8px}
.da-cap{min-height:2.8em;margin:8px 0}.da-ctl{gap:6px}
@media (max-width:700px){.da-dlg{padding:10px}.da-ctl .buy{flex:1 1 30%;font-size:15px;padding:6px 4px}}`; document.head.appendChild(st); }
try { if (PAGE === 'season') renderClub(); if (PAGE === 'settings') renderSettings(); } catch (e) { }
