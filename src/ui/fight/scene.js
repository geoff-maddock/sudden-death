/* ---------- drawing a scene: used by the title card and the fight ---------- */
const A = { ent: {}, pops: [], banner: null, dice: null, shake: 0, t: 0, swirl: [] };
const entA = k => A.ent[k] || (A.ent[k] = { lunge: -9, hit: -9, die: -9, born: -9, x: null, say: null, glow: -9 });
const PARTY_POS = [{ x: 318, y: 392 }, { x: 210, y: 352 }, { x: 118, y: 412 }];
function hpxOf(kind, boss, elite) { if (kind === 'wyrm') return 205; if (kind === 'zamboni') return 175; if (kind === 'orb') return 170; if (kind === 'cube') return 205; if (kind === 'mimic') return 130; if (kind === 'slime') return 96; return boss ? 150 : elite ? 128 : 110; }
function enemyLayout(list) {
  const n = list.length, out = [];
  const xs = n === 1 ? [710] : n === 2 ? [630, 820] : n === 3 ? [575, 720, 865] : n === 4 ? [560, 665, 770, 875] : [540, 625, 710, 795, 880];
  list.forEach((e, i) => out.push({ x: xs[i], y: n === 1 ? 404 : i % 2 ? 360 : 402 }));
  return out;
}
function figHeight(kind, hpx) { if (kind === 'mirror') return hpx * .95 * ((KIND[RUN && RUN.party ? RUN.party[0].kind : 'goblin'] || KIND.goblin).h); if (BESPOKE.has(kind)) return kind === 'wyrm' ? hpx * .9 : kind === 'zamboni' ? hpx * .95 : kind === 'orb' ? hpx * 1.15 : kind === 'cube' ? hpx * .95 : kind === 'mimic' ? hpx * .8 : hpx * .6; return hpx * ((KIND[kind] || KIND.goblin).h) * .95; }
/* Creature sprites. Drawing a creature is most of a frame's cost, and an idle creature only changes slowly
   (breathing, capes, wings). So each idle entity is drawn into its own offscreen canvas at most SPR_FPS times a
   second and blitted every frame. Anything in motion (lunging, a pose, breathing fire, charging) draws live. */
const SPR = new Map(), SPR_FPS = 20;
let SPR_ON = true;
function drawWho(c, kind, x, y, hpx, team, o) {
  const id = o.sid;
  if (!SPR_ON || !id || !o.idle || BESPOKE.has(kind) || o.pose || o.run || o.lift) { if (id) SPR.delete(id); drawAny(c, kind, x, y, hpx, team, o); return; }
  const m = c.getTransform(), sc = Math.max(1, Math.min(3, Math.hypot(m.a, m.b)));
  const W = Math.ceil(hpx * 2.6), H = Math.ceil(hpx * 2.1), ox = Math.round(W / 2), oy = Math.round(H * .86);
  const key = [kind, team.color, team.light, team.short, o.num, hpx, o.flip ? 1 : 0, o.wpn, o.disguised ? 1 : 0, o.crown ? 1 : 0, o.seed || 0, o.stone ? 1 : 0, sc.toFixed(2)].join('|');
  const bucket = Math.floor(G.time * SPR_FPS);
  let s = SPR.get(id);
  if (!s || s.key !== key) { const cv2 = s && s.cv || document.createElement('canvas'); cv2.width = Math.ceil(W * sc); cv2.height = Math.ceil(H * sc); s = { cv: cv2, key, bucket: -1 }; SPR.set(id, s); }
  if (s.bucket !== bucket) {
    const g = s.cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, s.cv.width, s.cv.height); g.setTransform(sc, 0, 0, sc, 0, 0);
    drawAny(g, kind, ox, oy, hpx, team, Object.assign({}, o, { alpha: null }));
    s.bucket = bucket;
  }
  c.save(); if (o.alpha != null) c.globalAlpha *= o.alpha;
  // unrotated (nearly always): blit pixel-for-pixel on whole device pixels, so sprites stay as crisp as a live draw
  if (!m.b && !m.c) { const px = Math.round(m.a * (x - ox) + m.e), py = Math.round(m.d * (y - oy) + m.f); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(s.cv, px, py); }
  else c.drawImage(s.cv, x - ox, y - oy, W, H);
  c.restore();
}
function sprClear() { SPR.clear(); }
function drawStatusPills(c, st, x, y) {
  const keys = Object.keys(st).filter(k => st[k] && ST[k] && ST[k].n && k !== 'foamfinger'); if (!keys.length) return;
  c.font = F_HUD(15); let w = 0; const items = keys.map(k => { const s = `${ST[k].n.split(' ')[0]} ${st[k]}`; const tw = c.measureText(s).width + 8; w += tw + 3; return [k, s, tw]; });
  let cx = x - w / 2;
  for (const [k, s, tw] of items) { rr(c, cx, y, tw, 16, 3); c.fillStyle = 'rgba(16,11,8,.85)'; c.fill(); c.strokeStyle = ST[k].col; c.lineWidth = 1; c.stroke(); txt(c, s, cx + tw / 2, y + 13, F_HUD(15), ST[k].col, 'center'); cx += tw + 3; }
}
function intentGlyph(c, kind, x, y, col) {
  c.save(); c.translate(x, y); c.fillStyle = col; c.strokeStyle = '#140f0c'; c.lineWidth = 2;
  if (kind === 'atk') { c.beginPath(); c.moveTo(-9, 9); c.lineTo(7, -7); c.lineTo(10, -10); c.lineTo(9, -5); c.lineTo(-7, 11); c.closePath(); c.stroke(); c.fill(); c.fillRect(-11, 5, 7, 3); }
  else if (kind === 'def') { c.beginPath(); c.moveTo(0, -11); c.lineTo(10, -7); c.quadraticCurveTo(10, 6, 0, 12); c.quadraticCurveTo(-10, 6, -10, -7); c.closePath(); c.stroke(); c.fill(); }
  else if (kind === 'buff') { c.beginPath(); c.moveTo(0, -11); c.lineTo(10, 1); c.lineTo(4, 1); c.lineTo(4, 10); c.lineTo(-4, 10); c.lineTo(-4, 1); c.lineTo(-10, 1); c.closePath(); c.stroke(); c.fill(); }
  else if (kind === 'debuff') { c.lineWidth = 3; c.strokeStyle = col; c.beginPath(); for (let t = 0; t < 14; t += .3) { const r = t * .8; c.lineTo(Math.cos(t) * r, Math.sin(t) * r); } c.stroke(); }
  else if (kind === 'flee') { c.beginPath(); c.moveTo(-8, -6); c.lineTo(4, -6); c.lineTo(4, -11); c.lineTo(12, 0); c.lineTo(4, 11); c.lineTo(4, 6); c.lineTo(-8, 6); c.closePath(); c.stroke(); c.fill(); }
  else { txt(c, '?', 0, 8, F_DSP(24), col, 'center'); }
  c.restore();
}
function drawIntent(c, e, x, y) {
  if (sv(e, 'stun')) { txt(c, 'Stunned', x, y, F_HUD(20), '#ffe17a', 'center'); return; }
  const I = intentInfo(e); if (!I.kinds.length) return;
  const main = I.kinds[0], col = { atk: '#ff7a5a', def: '#8fc2e8', buff: '#ffd166', debuff: '#b494ff', flee: '#ffd166', unknown: '#b8a68c' }[main];
  let gx = x - (main === 'atk' ? 18 : 0) - (I.kinds.length > 1 ? 12 : 0);
  intentGlyph(c, main, gx, y - 8, col);
  if (main === 'atk') txt(c, I.hits > 1 ? `${I.dmg}×${I.hits}` : `${I.dmg}`, gx + 16, y, F_HUD(24), '#fff0e0');
  const rest = [...new Set(I.kinds.slice(1))];
  rest.forEach((k, i) => intentGlyph(c, k, x + 30 + i * 22 + (main === 'atk' ? 14 : 0), y - 8, { atk: '#ff7a5a', def: '#8fc2e8', buff: '#ffd166', debuff: '#b494ff', flee: '#ffd166' }[k] || '#ccc'));
  c.save(); c.globalAlpha = .85; txt(c, I.n, x, y + 16, F_TXT(13, 500), '#e9dcc0', 'center'); c.restore();
}

/* the fight scene */
function drawFight(c, dt) {
  const act = RUN.act, team = clubTeam();
  c.drawImage(arenaBG(B.sport, act), 0, 0, SW, SH);
  flames(c, act);
  drawSky(c);
  drawCrowd(c);
  drawFieldState(c);
  scoreboard(c, B.sport, sportLine());
  drawMomentum(c);
  if (A.scoreFlash && A.t - A.scoreFlash.t < .9) { const k = A.t - A.scoreFlash.t; c.save(); c.globalAlpha = 1 - k / .9; rr(c, 480 - (A.sbw || 128), 8, (A.sbw || 128) * 2, MOM[B.sport] ? 64 : 54, 4); c.strokeStyle = A.scoreFlash.side ? '#ff6a5a' : '#7fe08a'; c.lineWidth = 4; c.stroke(); c.restore(); }
  if (B.sport === 'football') { txt(c, `Ball on the ${B.yards < 50 ? 'own ' + B.yards : B.yards === 50 ? '50' : 'their ' + (100 - B.yards)}${B.yards >= 75 ? ': RED ZONE' : B.yards <= 10 ? ': PINNED DEEP' : B.yards >= 60 ? ': field goal range' : ''}`, 480, 92, F_HUD(16), B.yards >= 75 ? '#ff8a6a' : '#b8a68c', 'center'); }
  if (B.sport === 'baseball' && B.sc) { const cx = 480 + (A.sbw || 128) + 32, cy = 36; rr(c, cx - 26, cy - 26, 52, 54, 4); c.fillStyle = '#16100c'; c.fill(); for (const [i, dx, dy] of [[0, 14, 0], [1, 0, -14], [2, -14, 0]]) { c.save(); c.translate(cx + dx, cy + dy); c.rotate(Math.PI / 4); c.fillStyle = B.sc.bases[i] ? '#ffd166' : 'rgba(255,255,255,.15)'; c.fillRect(-5, -5, 10, 10); c.restore(); } c.save(); c.translate(cx, cy + 14); c.rotate(Math.PI / 4); c.fillStyle = '#efe4cc'; c.fillRect(-4, -4, 8, 8); c.restore(); }
  const sh = A.shake > 0 ? (Math.random() - .5) * A.shake * 14 : 0; A.shake = Math.max(0, A.shake - dt * 2.5);
  c.save(); c.translate(sh, sh * .4);
  // party, back to front
  const party = RUN.party.map((p, i) => ({ p, i, pos: PARTY_POS[i] })).sort((a, b) => a.pos.y - b.pos.y);
  const now = A.t;
  // enemies and party sorted together by depth
  const list = B.enemies.filter(e => !(e.dead && now - entA(e.uid).die > .9) && !(e.fled && now - entA(e.uid).die > .9));
  const lay = enemyLayout(list);
  UI.hit = [];
  const draws = [];
  for (const { p, i, pos } of party) draws.push({ y: pos.y, f: () => {
    const a = entA('p:' + p.kind), lt = now - a.lunge, ht = now - a.hit;
    const lk = lt < .45 ? Math.sin(Math.min(1, lt / .45) * Math.PI) : 0;
    const x = pos.x + lk * (a.lungeAtk ? 90 : 20), y = pos.y;
    const wang = lt < .45 ? lerp(-2.2, .9, Math.min(1, lt / .32)) : -1.15 + Math.sin(now * 2 + i) * .06;
    if (now - a.glow < .7) { const g = c.createRadialGradient(x, y - 50, 4, x, y - 50, 70); g.addColorStop(0, `rgba(180,148,255,${.45 * (1 - (now - a.glow) / .7)})`); g.addColorStop(1, 'rgba(180,148,255,0)'); c.fillStyle = g; c.fillRect(x - 70, y - 120, 140, 140); }
    c.save(); if (ht < .3) { c.translate(-Math.sin(ht * 40) * 5, 0); }
    drawWho(c, p.kind, x, y, 108, team, { num: p.num, wpn: KIND_WPN[p.kind], wang, alpha: RUN.hp <= 0 ? .4 : null, sid: 'p:' + p.kind, idle: lt >= .45 });
    if (ht < .18) { c.globalCompositeOperation = 'source-atop'; }
    c.restore();
  } });
  list.forEach((e, i) => {
    const L = lay[i], a = entA(e.uid);
    if (a.x == null) a.x = L.x; a.x = lerp(a.x, L.x, Math.min(1, dt * 6)); a.y = L.y;
    const boss = isBoss(e), elite = !!ENEMIES[e.id].elite, hpx = hpxOf(e.kind, boss, elite);
    const hgt = figHeight(e.kind, hpx);
    UI.hit.push({ e, idx: B.enemies.indexOf(e), x0: a.x - 62, x1: a.x + 62, y0: L.y - hgt - 10, y1: L.y + 40 });
    draws.push({ y: L.y, f: () => {
      const lt = now - a.lunge, ht = now - a.hit, dt2 = now - a.die, bt = now - a.born;
      const lk = lt < .45 ? Math.sin(Math.min(1, lt / .45) * Math.PI) : 0;
      let x = a.x - lk * (a.lungeAtk ? (a.far ? 300 : 80) : 15), y = L.y;
      const et = now - (a.enter || -9); if (et < 1) y -= (1 - Math.min(1, et / .8) ** 2) * 320 * (et < .8 ? 1 : 0);
      if (et >= .8 && !a.landed && a.enter) { a.landed = 1; A.shake = 1; A.vfx.push({ k: 'shock', x: a.x, y: L.y, t0: A.t, life: .7, col: '#ffb347', r: 160 }); sfx.crunch(); }
      if (sv(e, 'air')) y -= 70 + Math.sin(now * 3) * 8;
      if (isBoss(e) || ENEMIES[e.id].aura) bossBack(c, e, x, y, hpx, hgt);
      let alpha = 1; if (e.dead || e.fled) alpha = Math.max(0, 1 - dt2 / .8); if (bt < .6) alpha = Math.min(alpha, bt / .6);
      if (e.fled) x += dt2 * 500;
      const sel = UI.sel >= 0 && needsTarget(B.hand[UI.sel] || {}) && UI.hover === e && !e.dead;
      if (sel || (UI.sel >= 0 && UI.kbTarget === e && !e.dead)) { c.save(); c.strokeStyle = '#ffb347'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 2, 54, 13, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = .18; c.fillStyle = '#ffb347'; c.fill(); c.restore(); }
      c.save(); if (ht < .3) c.translate(Math.sin(ht * 50) * 6, 0);
      if (e.dead && !e.fled) { c.translate(x, y); c.rotate(Math.min(1, dt2 / .5) * -.9 * (e.kind === 'orb' || e.kind === 'cube' ? 0 : 1)); c.translate(-x, -y + dt2 * 30); }
      const wang = lt < .45 ? lerp(-2.2, .9, Math.min(1, lt / .32)) : -1.15 + Math.sin(now * 2 + i * 1.3) * .06;
      drawWho(c, e.kind, x, y, hpx, e.team, { num: e.num, wpn: ENEMIES[e.id].wpn || KIND_WPN[e.kind], wang, flip: true, alpha, disguised: e.disguised, seed: i * 2, mouth: e.intent === 'breath' || (now - a.lunge < .8 && e.hist[e.hist.length - 1] === 'breath'), charging: !!sv(e, 'charge'), crown: ENEMIES[e.id].crown, sid: e.uid, idle: lt >= .45 && !sv(e, 'charge') && e.intent !== 'breath' && !(now - a.lunge < .8) });
      if (isBoss(e) || ENEMIES[e.id].aura) bossFront(c, e, x, y, hpx, hgt);
      c.restore();
      if (ht < .14 && !e.dead) { c.save(); c.globalAlpha = .5 * (1 - ht / .14); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y - hgt * .5, 46, hgt * .55, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
      if (e.dead || e.fled) return;
      // health, block, statuses, intent
      const bw = 112, bx = x - bw / 2, by = y + 14;
      rr(c, bx, by, bw, 12, 3); c.fillStyle = '#2a1712'; c.fill();
      rr(c, bx, by, Math.max(0, bw * e.hp / e.max), 12, 3); c.fillStyle = sv(e, 'psn') >= e.hp ? '#8ad65a' : '#d8432a'; c.fill();
      const pv = UI.preview && UI.preview.per[e.uid];
      if (pv > 0) { const left = Math.max(0, e.hp - pv), x1 = bx + bw * left / e.max, w1 = bw * (e.hp - left) / e.max; c.save(); c.globalAlpha = .6 + Math.sin(A.t * 8) * .25; c.fillStyle = '#fff2c8'; c.fillRect(x1, by, w1, 12); c.restore(); if (left <= 0) { txt(c, 'LETHAL', x, by - 6, F_HUD(18), '#ffd166', 'center'); } }
      txt(c, `${e.hp}/${e.max}`, x, by + 11, F_HUD(15), '#fff', 'center');
      if (e.sp && !e.dead) { const lab = SPORT_PERKS[e.sp].n.toUpperCase(); c.save(); c.font = F_HUD(14); const w = c.measureText(lab).width + 12; rr(c, x - w / 2, by - 22, w, 16, 3); c.fillStyle = '#3a2a06'; c.fill(); c.strokeStyle = '#ffd166'; c.lineWidth = 1; c.stroke(); txt(c, lab, x, by - 9, F_HUD(14), '#ffd166', 'center'); c.restore(); }
      if (e.block) { c.save(); c.translate(bx - 6, by + 6); c.fillStyle = '#8fc2e8'; c.beginPath(); c.moveTo(0, -11); c.lineTo(10, -7); c.quadraticCurveTo(10, 6, 0, 12); c.quadraticCurveTo(-10, 6, -10, -7); c.closePath(); c.fill(); txt(c, e.block, 0, 5, F_HUD(16), '#0c1a26', 'center'); c.restore(); }
      if (B.sport === 'baseball') for (let k = 0; k < 3; k++) circ(c, bx + bw + 8 + k * 9, by + 6, 3.4, (B.hits[e.uid] || 0) > k ? '#ffe17a' : 'rgba(255,255,255,.18)');
      drawStatusPills(c, e.st, x, by + 16);
      if (B.phase !== 'done') drawIntent(c, e, x, y - hgt - 18 + (e.kind === 'orb' ? -10 : 0));
      if (a.say && now - a.say.t < 1.5) { const k = now - a.say.t; c.save(); c.globalAlpha = Math.min(1, (1.5 - k) * 3); c.font = F_TXT(15); const w = c.measureText(a.say.text).width + 16; rr(c, x - w / 2, y - hgt - 62 - k * 8, w, 22, 5); c.fillStyle = 'rgba(239,228,204,.95)'; c.fill(); txt(c, a.say.text, x, y - hgt - 46 - k * 8, F_TXT(15), '#21160f', 'center'); c.restore(); }
    } });
  });
  draws.sort((a, b) => a.y - b.y).forEach(d => d.f());
  drawPartyFire(c);
  drawSportPops(c);
  drawVfx(c);
  drawWhy(c);
  // engulfed cards shown inside the cube
  c.restore();
  drawPops(c);
  drawBanner(c); drawDice(c);
}
function drawPops(c) {
  A.pops = A.pops.filter(p => A.t - p.t0 < p.life);
  for (const p of A.pops) {
    const k = A.t - p.t0; if (k < 0) continue;
    c.save(); c.globalAlpha = Math.min(1, (p.life - k) * 2.5);
    const s = p.size || 28, y = p.y - k * 46;
    c.font = F_HUD(s); c.lineWidth = 4; c.strokeStyle = '#140f0c'; c.textAlign = 'center'; c.strokeText(p.t, p.x, y); c.fillStyle = p.col; c.fillText(p.t, p.x, y);
    c.restore();
  }
}
function drawBanner(c) {
  const b = A.banner; if (!b) return; const k = A.t - b.t0; if (k > b.life) { A.banner = null; return; } if (k < 0) return;
  const al = Math.min(1, k * 5, (b.life - k) * 3);
  c.save(); c.globalAlpha = al; const y = b.small ? 150 : 190;
  c.fillStyle = 'rgba(14,9,7,.82)'; c.fillRect(0, y - 48, SW, b.sub ? 86 : 64);
  c.fillStyle = '#ffb347'; c.fillRect(0, y - 48, SW, 2); c.fillRect(0, y + (b.sub ? 36 : 14), SW, 2);
  txt(c, b.t, 480 + (1 - Math.min(1, k * 4)) * -60, y, F_DSP(b.small ? 38 : 50), '#efe4cc', 'center');
  if (b.sub) { let fs = 17; c.font = F_TXT(fs, 500); while (c.measureText(b.sub).width > 900 && fs > 12) { fs--; c.font = F_TXT(fs, 500); } txt(c, b.sub, 480, y + 26, F_TXT(fs, 500), '#b8a68c', 'center'); }
  c.restore();
}
function drawDice(c) {
  const d = A.dice; if (!d) return; const k = A.t - d.t0; if (k > 2.1) { A.dice = null; return; } if (k < 0) return;
  const rolling = k < .65, val = rolling ? 1 + ((k * 30) | 0) % 20 : d.r;
  c.save(); c.translate(480, 140 + (rolling ? Math.abs(Math.sin(k * 14)) * -18 : 0)); c.globalAlpha = Math.min(1, (2.1 - k) * 3); c.rotate(rolling ? k * 9 : 0);
  const pts = []; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; pts.push([Math.cos(a) * 42, Math.sin(a) * 42]); }
  c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  c.fillStyle = d.crit && !rolling ? '#ffd166' : '#efe4cc'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#21160f'; c.stroke();
  c.beginPath(); c.moveTo(0, -42); c.lineTo(-36, 21); c.lineTo(36, 21); c.closePath(); c.lineWidth = 1.5; c.stroke();
  c.rotate(rolling ? -k * 9 : 0); txt(c, String(val), 0, 13, F_HUD(34), '#21160f', 'center');
  c.restore();
  if (!rolling) { c.save(); c.globalAlpha = Math.min(1, (2.1 - k) * 3); txt(c, `${d.label ? d.label + ': ' : ''}${d.r}${d.bonus ? ' + ' + d.bonus : ''} vs ${d.dc}  ${d.crit ? 'CRITICAL' : d.r === 1 ? 'FUMBLE' : d.ok ? 'HIT' : 'MISS'}`, 480, 210, F_HUD(24), d.ok ? '#7fe08a' : '#ff8a7a', 'center'); c.restore(); }
}
// turn engine events into animation
function consumeFx() {
  if (!B) return;
  let delay = 0;
  const partyPt = () => ({ x: 240, y: 236 });
  const ep = uid => { const a = A.ent[uid]; const e = B.enemies.find(x => x.uid === uid); if (!a || !e) return { x: 720, y: 220 }; return { x: a.x, y: a.y - figHeight(e.kind, hpxOf(e.kind, isBoss(e), ENEMIES[e.id].elite)) - 4 }; };
  while (B.fx.length) {
    const f = B.fx.shift(), t0 = A.t + delay;
    switch (f.k) {
      case 'play': { const who = RUN.party.find(p => p.kind === f.kind) || RUN.party[0]; const a = entA('p:' + who.kind); if (f.atk) { a.lunge = A.t; a.lungeAtk = 1; sfx.card(); } else { a.glow = A.t; sfx.magic(); } break; }
      case 'hit': { const a = entA(f.e); a.hit = t0 + .08; const p = ep(f.e); if (f.amt > 0) A.pops.push({ x: p.x + (Math.random() - .5) * 30, y: p.y, t: String(f.amt), col: f.col || '#ffe0d0', t0: t0 + .08, life: 1.1, size: f.amt >= 20 ? 40 : 30 }); else if (f.blk) A.pops.push({ x: p.x, y: p.y, t: 'Blocked', col: '#8fc2e8', t0: t0 + .08, life: .9, size: 22 }); setTimeout(() => f.blk && !f.amt ? sfx.block() : sfx.hit(Math.min(1, f.amt / 20)), delay * 1000 + 80); delay += .09; break; }
      case 'die': entA(f.e).die = A.t + delay; if (!f.quiet) setTimeout(sfx.die, delay * 1000); else A.vfx.push({ k: 'shock', x: entA(f.e).x || 700, y: entA(f.e).y || 400, t0: A.t, life: .7, col: '#7fe0b8', r: 180 }); break;
      case 'dice': A.dice = { r: f.r, bonus: f.bonus, dc: f.dc, ok: f.ok, crit: f.crit, label: f.label, t0: A.t }; sfx.dice(); if (f.crit) setTimeout(sfx.crit, 650); break;
      case 'lunge': { const a = entA(f.e); a.lunge = A.t; a.lungeAtk = f.atk; a.far = f.far; break; }
      case 'vfx': spawnVfx(f.v, f.e); break;
      case 'phase': { const a = entA(f.e); a.phaseT = A.t; A.shake = 1.2; A.vfx.push({ k: 'flash', t0: A.t, life: .5, col: '#ffffff' }); A.vfx.push({ k: 'shock', x: a.x || 720, y: a.y || 400, t0: A.t, life: .9, col: '#ff6a3d', r: 260 }); A.banner = { t: f.t, sub: f.sub, t0: A.t + .25, life: 2.2 }; sfx.horn(); setTimeout(() => sfx.crunch(), 120); break; }
      case 'hitP': { if (f.amt > 0) { A.shake = Math.min(1, .3 + f.amt / 30); for (const p of RUN.party) entA('p:' + p.kind).hit = A.t; sfx.hurt(); } else sfx.block(); break; }
      case 'num': { const p = f.p ? partyPt() : ep(f.e); A.pops.push({ x: p.x + (f.p ? (Math.random() - .5) * 60 : 0), y: p.y + (f.small ? 20 : 0), t: f.t, col: f.col, t0: A.t + delay * .5, life: 1.2, size: f.small ? 20 : 26 }); break; }
      case 'say': { const a = entA(f.e); a.say = { text: f.t, t: A.t }; break; }
      case 'banner': A.banner = { t: f.t, sub: f.sub, t0: A.t + delay, life: f.small ? 1.3 : 1.9, small: f.small }; if (/Touchdown|Strike!|on fire/i.test(f.t)) sfx.crowd(); else sfx.whistle(); break;
      case 'pst': { const p = partyPt(); const s = ST[f.st]; if (s && s.n) A.pops.push({ x: p.x, y: p.y + 30, t: `${s.n} ${f.n > 0 ? '+' : ''}${f.n}`, col: s.col, t0: A.t + delay, life: 1.2, size: 20 }); break; }
      case 'addcard': { const p = partyPt(); A.pops.push({ x: p.x, y: p.y + 50, t: `+${f.n} ${CARDS[f.id].n}`, col: '#b8a68c', t0: A.t + delay, life: 1.4, size: 20 }); break; }
      case 'spawn': entA(f.e).born = A.t; break;
      case 'flee': entA(f.e).die = A.t; break;
      case 'score': A.scoreFlash = { t: A.t, side: f.side }; if (f.n) { A.crowd = { t: A.t, side: f.side }; if (!f.side) sfx.coin(); else noise(.5, .06, 400, .5); } if (B.sport === 'hockey' && !f.side && f.what === 'goal') A.lamp = A.t; if (!f.side && f.n) sportPop(f); break;
      case 'sky': A.skyT = { what: f.what, t: A.t }; tone(f.what === 'moon' ? 660 : 990, .6, 'sine', .04, 0); tone(f.what === 'moon' ? 990 : 1320, .8, 'sine', .03, 0, .15); break;
      case 'mom': case 'save': case 'swish': case 'bases': sportFx(f); break;
      case 'bat': case 'drive': case 'strike': case 'bell': sportPop(f); break;
      case 'say2': A.pops.push({ x: 480, y: 250, t: f.t, col: '#ffd166', t0: A.t + delay, life: 1.1, size: 30 }); delay += .1; break;
    }
  }
}

