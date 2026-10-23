/* ================= the live play ================= */
let PL = null;
function runnerPos(r) { const s = Math.min(r.s, 4), i = Math.min(3, Math.floor(s)), f = s - i, a = BASE[i], b = BASE[(i + 1) % 4]; return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) }; }
const touching = r => Math.abs(r.s - Math.round(r.s)) < .012;
const settled = r => touching(r) && Math.round(r.s) === r.target;
const alive = () => PL.runners.filter(r => !r.out && !r.scored);
const moving = r => !settled(r);

function startPlay(tr, hit) {
  const ft = FT(), bt = BT();
  const fielders = ft.def.roster.map(p => {
    const h = POSN[p.pos];
    return { p, x: h.x, y: h.y, hx: h.x, hy: h.y, spd: 13 + p.spd * 1.25, arm: 74 + p.arm * 7, stun: 0, flight: 0, big: p.kind === 'ogre' || p.kind === 'golem' || p.kind === 'troll' };
  });
  const runners = [];
  const bat = batter();
  runners.push(mkRunner(bat, 0));
  for (let b = 1; b <= 3; b++) if (G.bases[b]) runners.push(mkRunner(G.bases[b], b));
  PL = {
    t: 0, tr, hit, fielders, runners, bat,
    ball: { st: 'batted', bt: 0, x: 0, y: 2, z: 3, holder: null, thr: null },
    chaser: null, chasePt: null, chaseT: 0, chaseCD: 0, flyPending: false, caughtInAir: false, catchDist: 0, homer: false,
    holdT: 0, decideCD: 0, settleT: 0, endT: null, runsThisPlay: 0, outs: [], sel: 0, selF: 0,
    usedF: {}, usedT: {}, usedP: {}, selR: 0, gust: false, readyNote: {}, boost: false, telek: false, block: false, cpuCD: .6, cpuRunCD: .3, events: [], firstFielder: null, bobbled: false,
  };
  if (hit.bgear && GEAR[hit.bgear] && GEAR[hit.bgear].stagger) { fielders.forEach(f => f.stun = Math.max(f.stun, GEAR[hit.bgear].stagger)); G.shake = Math.max(G.shake, .4); addFx('callout', { text: 'Thunderclap!', col: '#ffe27a' }); }
  if (hit.ab === 'seismic') { fielders.forEach(f => f.stun = 1.5); G.shake = .6; addFx('ring', { x: 0, y: 0, col: '#c8a36a', r: 0, max: 260 }); addFx('callout', { text: 'Seismic swing!', col: '#e8c07a' }); }
  computeChaser();
  if (PL.chaser && PL.chaseSample && !PL.chaseSample.b && tr.pts[Math.min(tr.pts.length - 1, 8)].z > 0) PL.flyPending = true;
  // initial runner intent
  for (const r of runners) runnerInit(r);
  stealInPlay(runners);
  for (const r of runners) { const w = weakK(r.p, 'spd'); if (w && R() < .25 * w) { r.fx.stun = .9; addFx('callout', { text: `${shortName(r.p)} stumbles!`, col: '#ff8a7a', small: true }); } }
  PL.sel = 0;
  G.phase = 'play';
  for (const f of fielders) if (f.p.ko > 0) f.stun = 1e3;
  PL.inferno = !!(G.P && G.P.pitch && G.P.pitch.inferno);
  gasCheck();
  maybeTutorial();
}
function mkRunner(p, base) {
  return { p, s: base, origin: base, target: base === 0 ? 1 : base, spd: 17 + p.spd * 1.5, manual: false, mustReturn: false, out: false, scored: false, fx: {}, used: false, delay: base === 0 ? .28 : 0, holdAt: null };
}
function forcedChain(r) {
  if (PL.caughtInAir) return false;
  if (r.origin === 0) return !r.out;
  const behind = PL.runners.find(o => o.origin === r.origin - 1 && !o.out);
  return !!behind && forcedChain(behind);
}
const isForcedNow = r => forcedChain(r) && r.s < r.origin + 1 - .001;
function runnerInit(r) {
  if (r.origin === 0) { r.target = 1; return; }
  if (isForcedNow(r)) { r.target = r.origin + 1; if (PL.flyPending) r.holdAt = r.origin + .45; return; }
  if (PL.flyPending) { r.target = r.origin + 1; r.holdAt = r.origin + .4; return; }
  const deep = PL.chasePt && hyp(PL.chasePt.x, PL.chasePt.y) > 150;
  if (r.origin === 2 && (deep || (PL.chasePt && PL.chasePt.x > 10))) r.target = 3;
  if (r.origin === 3 && deep) r.target = 4;
}

function effSpeed(r) {
  const f = r.fx; let m = 1;
  if (f.stone > 0 || f.stun > 0) return 0;
  if (f.spd && f.spd.t > 0) m *= f.spd.m;
  if (f.slow > 0) m *= .3;
  if (f.roots > 0) m *= .4;
  const q = runnerPos(r);
  return r.spd * m * (1 - .25 * fk(r.p)) * (1 + .45 * (r.eff || 0)) * zoneMult('rSpd', q.x, q.y, 'runner') * hurtMul(r.p, .3) * (1 - .15 * weakK(r.p, 'spd'));
}
function fSpeed(f) { if (f.stun > 0) return 0; return f.spd * (f.flight > 0 ? 2 : 1) * (1 - .2 * fk(f.p)) * (1 + .35 * (f.eff || 0)) * (f.flight > 0 ? 1 : zoneMult('fSpd', f.x, f.y)) * hurtMul(f.p, .25) * (1 - .12 * weakK(f.p, 'spd')); }
function reachZ(f) { return (f.flight > 0 ? 25 : f.big ? 9.5 : 8) + (f.leapT > 0 ? 8 : 0); }
function reachR(f) { return f.big ? 4.2 : 3.2; }

function trAt(t) { const P = PL.tr.pts, i = clamp(Math.floor(t / TDT), 0, P.length - 1); return P[i]; }

function computeChaser() {
  const b = PL.ball; let best = null, bt = 1e9, bpt = null, bs = null;
  if (b.st === 'batted') {
    const P = PL.tr.pts, i0 = Math.floor(b.bt / TDT), lim = PL.tr.hrAt >= 0 ? PL.tr.hrAt : P.length - 1;
    for (const f of PL.fielders) {
      const sp = f.spd * (f.flight > 0 ? 2 : 1);
      const react = Math.max(0, (f.p.pos === 'P' ? .7 : .5) + zoneAdd('react', f.x, f.y) + .25 * weakK(f.p, 'spd') - PL.t) + Math.max(0, f.stun);
      for (let i = i0; i <= lim; i += 2) {
        const q = P[i], tt = (i - i0) * TDT; if (tt > bt) break;
        if (q.z > reachZ(f)) continue;
        if (hyp(q.x - f.x, q.y - f.y) <= sp * Math.max(0, tt - react) + reachR(f)) { if (tt < bt) { bt = tt; best = f; bpt = { x: q.x, y: q.y }; bs = q; } break; }
      }
    }
    if (!best) { // nobody gets there in time: whoever is closest to where it ends up
      const e = P[lim]; for (const f of PL.fielders) { const tt = hyp(e.x - f.x, e.y - f.y) / Math.max(1, fSpeed(f)); if (tt < bt) { bt = tt; best = f; bpt = { x: e.x, y: e.y }; bs = e; } }
    }
  } else if (b.st === 'loose') {
    for (const f of PL.fielders) { const tt = hyp(b.x - f.x, b.y - f.y) / Math.max(1, fSpeed(f)) + Math.max(0, f.stun); if (tt < bt) { bt = tt; best = f; bpt = { x: b.x, y: b.y }; } }
  }
  PL.chaser = best; PL.chasePt = bpt; PL.chaseT = bt; PL.chaseSample = bs;
}
function coverers() {
  const byPos = {}; PL.fielders.forEach(f => byPos[f.p.pos] = f);
  const used = new Set(); const busy = f => f === PL.chaser || (PL.ball.holder === f) || used.has(f);
  const cov = [];
  const choose = (b, list) => { for (const pos of list) { const f = byPos[pos]; if (f && !busy(f)) { cov[b] = f; used.add(f); return; } } cov[b] = null; };
  const right = PL.chasePt ? PL.chasePt.x >= 0 : true;
  choose(0, ['C', 'P']);
  choose(1, ['1B', '2B', 'P']);
  choose(2, right ? ['SS', '2B', 'P'] : ['2B', 'SS', 'P']);
  choose(3, ['3B', 'SS', 'P']);
  return cov;
}

function playUpdate(dt) {
  const L = PL; L.t += dt;
  const b = L.ball;
  // timers on fielders/runners
  for (const f of L.fielders) { if (f.leapT > 0) f.leapT -= dt; if (f.stun > 0) f.stun -= dt; if (f.flight > 0) f.flight -= dt; if (f.eff > 0) f.eff = Math.max(0, f.eff - .4 * dt); }
  for (const r of L.runners) if (r.eff > 0) r.eff = Math.max(0, r.eff - .4 * dt);
  for (const r of L.runners) { const x = r.fx; for (const k of ['stun', 'stone', 'slow', 'invis', 'untag', 'bull', 'flee', 'roots', 'mist', 'slide']) if (x[k] > 0) x[k] -= dt; if (x.spd && x.spd.t > 0) x.spd.t -= dt; }
  if (L.endT !== null) { L.endT -= dt; moveRunners(dt); if (L.endT <= 0) finishPlay(); return; }

  // --- ball ---
  if (b.st === 'batted') {
    b.bt += dt; const q = trAt(b.bt); b.x = q.x; b.y = q.y; b.z = q.z;
    if (q.b && L.inferno && !L.infernoLit) { L.infernoLit = true; addZone('inferno', { x: q.x, y: q.y }, 1 - G.half); addFx('burst', { x: q.x, y: q.y, col: '#ff8a2a' }); G.shake = Math.max(G.shake, .3); }
    if (q.b && L.flyPending) { L.flyPending = false; for (const r of L.runners) r.holdAt = null; }
    if (L.tr.hrAt >= 0 && b.bt / TDT >= L.tr.hrAt) homeRun();
    else if (Math.floor(b.bt / TDT) >= L.tr.pts.length - 1) { b.st = 'loose'; }
  } else if (b.st === 'thrown') {
    const th = b.thr; th.t += dt; const k = Math.min(1, th.t / th.T);
    b.x = lerp(th.x0, th.x1, k); b.y = lerp(th.y0, th.y1, k); b.z = 4 + Math.sin(Math.PI * k) * th.arc;
    if (k >= 1) {
      const cov = coverers(), rec = cov[th.base];
      if (rec && rec.stun <= 0 && hyp(rec.x - th.x1, rec.y - th.y1) < 10) { takeBall(rec); sfx.mitt(); }
      else { b.st = 'loose'; b.z = 0; }
    }
  } else if (b.st === 'held') { const f = b.holder; b.x = f.x; b.y = f.y + .5; b.z = 4; }

  // --- fielders ---
  const cov = coverers();
  if (b.st === 'batted' || b.st === 'loose') { L.chaseCD -= dt; if (L.chaseCD <= 0) { L.chaseCD = .2; computeChaser(); } }
  for (const f of L.fielders) {
    if (f.stun > 0) continue;
    let tx = f.hx, ty = f.hy, sp = fSpeed(f) * .6;
    const bi = cov.indexOf(f);
    if (b.holder === f) { if (f.goal) { tx = f.goal.x; ty = f.goal.y; sp = fSpeed(f); } else { tx = f.x; ty = f.y; } }
    else if (f === L.chaser && (b.st === 'batted' || b.st === 'loose') && L.chasePt) { tx = L.chasePt.x; ty = L.chasePt.y; sp = fSpeed(f); }
    else if (bi >= 0 && !L.homer) { tx = BASE[bi].x + (bi === 0 ? 0 : 0); ty = BASE[bi].y; sp = fSpeed(f); }
    else if (L.homer) { sp = fSpeed(f) * .3; }
    if (L.t < (f.p.pos === 'P' ? .7 : .5) && b.holder !== f) sp = 0;
    const dx = tx - f.x, dy = ty - f.y, d = hyp(dx, dy);
    if (d > .3) { const m = Math.min(d, sp * dt); f.x += dx / d * m; f.y += dy / d * m; }
  }
  // catch / pick up
  if (b.st === 'batted' || b.st === 'loose') {
    for (const f of L.fielders) {
      if (f.stun > 0) continue;
      if (hyp(b.x - f.x, b.y - f.y) <= reachR(f) && b.z <= reachZ(f)) { fieldBall(f); break; }
    }
  }
  // holder AI
  if (b.st === 'held') holderThink(b.holder, dt);

  // --- runners ---
  L.cpuRunCD -= dt;
  runnerControl(dt);
  moveRunners(dt);
  checkOuts();
  tickHazards(dt);
  fieldAbilityControl(dt);

  // --- end conditions ---
  if (G.outs >= 3 && L.endT === null) { L.endT = 1.1; return; }
  if (L.homer) { if (!alive().length) L.endT = .6; return; }
  const all = alive();
  if (b.st === 'held' && all.every(settled)) { L.settleT += dt; const inf = hyp(b.holder.x, b.holder.y - 60) < 110; if (L.settleT > (inf ? .45 : 1.4)) L.endT = .35; }
  else L.settleT = 0;
  if (L.t > 40) L.endT = .1;
}

function homeRun() {
  const L = PL; L.homer = true; L.ball.st = 'gone'; L.flyPending = false;
  for (const r of L.runners) { r.target = 4; r.manual = true; r.holdAt = null; r.fx = {}; }
  banner('Home run!', `${L.bat.n} clears the wall`, 2.2); musicSting('hr');
  sfx.crowd(2.2); sfx.good(); G.shake = .3;
  addFx('burst', { x: L.ball.x, y: L.ball.y, col: '#ffb547' });
}
function takeBall(f) { const b = PL.ball; b.st = 'held'; b.holder = f; b.thr = null; b.z = 4; PL.holdT = 0; PL.decideCD = 0; f.goal = null; if (!PL.firstFielder) PL.firstFielder = f; }
function fieldBall(f) {
  const L = PL, b = L.ball;
  const air = b.st === 'batted' && !trAt(b.bt).b && b.z > .4;
  const bob = (10 - f.p.fld) * (air ? .011 : .006) * zoneMult('bobble', f.x, f.y) * (1 + hurtF(f.p)) * (1 + 2 * weakK(f.p, 'fld'));
  if (R() < bob) {
    b.st = 'loose'; b.z = 0; f.stun = .6; L.bobbled = true; pst(f.p).e++;
    addFx('callout', { text: `${shortName(f.p)} bobbles it`, col: '#ffd27a', small: true });
    return;
  }
  sfx.mitt();
  const wasFly = air;
  if (wasFly && L.inferno && !L.infernoLit) { L.infernoLit = true; hurt(f.p, 12, 'burned catching the Inferno', { fire: true }); }
  takeBall(f);
  if (wasFly) {
    L.caughtInAir = true; L.flyPending = false; L.catchDist = hyp(f.x, f.y);
    const batR = L.runners.find(r => r.origin === 0);
    const robbed = L.tr.hrAt >= 0 && hyp(f.x, f.y) > fenceR(Math.atan2(f.x, f.y)) - 8;
    if (batR) outRunner(batR, robbed ? 'robbed' : 'fly', f);
    if (robbed) { banner('Robbed!', `${f.p.n} snatches it over the wall`, 2); sfx.crowd(1.5); if (R() < .2) hurt(f.p, 14, 'crashed into the wall making the catch'); }
    for (const r of L.runners) if (!r.out && !r.scored) { r.holdAt = null; if (r.s > r.origin + .001) { r.mustReturn = true; r.target = r.origin; } }
  }
}

/* ---------- fielder with the ball ---------- */
function ballTimeTo(base) {
  const L = PL, b = L.ball, P = BASE[base], cov = coverers();
  const covT = c => c ? hyp(c.x - P.x, c.y - P.y) / Math.max(1, fSpeed(c)) : 3;
  if (b.st === 'gone') return 1e9;
  if (b.st === 'held') {
    const f = b.holder, d = hyp(f.x - P.x, f.y - P.y);
    if (d < 28) return d / Math.max(1, fSpeed(f)) + .1;
    return Math.max(.35 + d / f.arm, covT(cov[base]));
  }
  if (b.st === 'thrown') {
    const th = b.thr, rem = th.T - th.t;
    if (th.base === base) return rem;
    const rec = cov[th.base] || L.fielders[0];
    return rem + .35 + hyp(th.x1 - P.x, th.y1 - P.y) / rec.arm;
  }
  const c = L.chaser; if (!c || !L.chasePt) return 3;
  const tt = hyp(c.x - L.chasePt.x, c.y - L.chasePt.y) / Math.max(1, fSpeed(c)) + Math.max(0, c.stun);
  const rest = (L.ball.st === 'batted') ? Math.max(0, L.chaseT) : 0;
  return Math.max(tt, rest) + .45 + hyp(L.chasePt.x - P.x, L.chasePt.y - P.y) / c.arm;
}
function holderThink(f, dt) {
  const L = PL, ft = FT(); L.holdT += dt;
  if (f.stun > 0) return;
  if (isHuman(ft)) {
    const I = INP[ft.ctl];
    const dir = I.p.up ? 2 : I.p.right ? 1 : I.p.left ? 3 : I.p.down ? 0 : -1;
    if (dir >= 0) { I.p.up = I.p.right = I.p.left = I.p.down = false; const d = hyp(f.x - BASE[dir].x, f.y - BASE[dir].y); if (d < 10) { f.goal = { ...BASE[dir] }; } else throwTo(f, dir); return; }
  }
  const delay = isHuman(ft) ? .6 : [.3, .2, .12][G.diff];
  if (L.holdT < delay) return;
  L.decideCD -= dt; if (L.decideCD > 0) return; L.decideCD = .12;
  const plan = bestPlay(f);
  if (plan) { if (plan.run) f.goal = { ...BASE[plan.base] }; else throwTo(f, plan.base); return; }
  f.goal = null;
  const out = hyp(f.x, f.y) > 135;
  if (out) {
    const mov = alive().filter(r => moving(r) && !(r.fx.invis > 0)).sort((a, b) => b.s - a.s)[0];
    throwTo(f, mov ? mov.target % 4 : 2);
  } else {
    // chase a nearby runner caught between bases
    const near = alive().filter(r => !touching(r) && !(r.fx.invis > 0)).map(r => ({ r, p: runnerPos(r) })).filter(o => hyp(o.p.x - f.x, o.p.y - f.y) < (L.holdT > 2 ? 400 : 26)).sort((a, b) => hyp(a.p.x - f.x, a.p.y - f.y) - hyp(b.p.x - f.x, b.p.y - f.y))[0];
    if (near) f.goal = { x: near.p.x, y: near.p.y };
  }
}
function bestPlay(f) {
  const L = PL, cov = coverers(); let best = null, bestScore = .06;
  for (let base = 0; base < 4; base++) {
    const P = BASE[base], d = hyp(f.x - P.x, f.y - P.y), run = d < 28;
    const c = cov[base];
    let bt;
    if (run) bt = d / Math.max(1, fSpeed(f)) + .05;
    else { if (!c && !run) continue; bt = Math.max(.15 + d / (f.arm * (L.boost ? 2.2 : 1)), c ? hyp(c.x - P.x, c.y - P.y) / Math.max(1, fSpeed(c)) : 9); if (L.telek) bt = Math.max(.05, c ? hyp(c.x - P.x, c.y - P.y) / Math.max(1, fSpeed(c)) : 9); }
    for (const r of alive()) {
      if (r.fx.invis > 0) continue;
      if (r.target % 4 !== base || settled(r)) continue;
      const toward = r.target > r.s ? 1 : -1;
      const rem = Math.abs(r.target - r.s) * 90, sp = effSpeed(r);
      const rt = sp > 0 ? rem / sp : 9;
      const margin = rt - bt;
      const pri = (base === 0 ? .25 : base === 3 ? .12 : 0) + (r.mustReturn ? .1 : 0);
      const sc = margin + pri;
      if (margin > .06 && sc > bestScore) { bestScore = sc; best = { base, run, r }; }
    }
  }
  return best;
}
function throwTo(f, base) {
  const L = PL, b = L.ball, P = BASE[base];
  const d = hyp(f.x - P.x, f.y - P.y);
  let sp = f.arm * (1 + .3 * (f.eff || 0)) * (1 - .15 * weakK(f.p, 'arm')); if (L.boost) { sp *= 2.2; L.boost = false; } if (f.rocket) { sp *= 1.5; f.rocket = false; } if (L.gust) { sp *= 1.8; L.gust = false; addFx('callout', { text: 'Tailwind', col: '#c9a4ff', small: true }); }
  let T = .08 + d / sp; if (L.telek) { T = .05; L.telek = false; addFx('callout', { text: 'Telekinesis', col: '#c9a4ff', small: true }); }
  b.st = 'thrown'; b.holder = null; f.goal = null;
  let tx = P.x, ty = P.y; const wA = weakK(f.p, 'arm');
  noteThrow(f);
  if (wA && d > 20 && R() < .25 * wA) { pst(f.p).e++; const a = R() * Math.PI * 2, m = 16 + R() * 14; tx += Math.cos(a) * m; ty += Math.sin(a) * m; addFx('callout', { text: 'Wild throw!', col: '#ff8a7a', small: true }); }
  b.thr = { x0: f.x, y0: f.y, x1: tx, y1: ty, t: 0, T, base, arc: Math.min(14, d * .05) };
  L.holdT = 0;
  tone(900, .05, 'triangle', .04);
}

/* ---------- runners ---------- */
function occupiedAhead(r, nb) {
  if (nb >= 4) return false;
  return PL.runners.some(o => o !== r && !o.out && !o.scored && (o.target === nb || (settled(o) && Math.round(o.s) === nb)));
}
function sendForward(r) {
  if (r.out || r.scored) return false;
  const nb = Math.min(4, Math.floor(r.s + .02) + 1);
  if (r.target >= nb && r.target > r.s) return false;
  if (occupiedAhead(r, nb)) return false;
  if (r.mustReturn && r.s > r.origin + .01) return false;
  r.target = nb; r.holdAt = null; r.manual = true; return true;
}
function sendBack(r) {
  if (r.out || r.scored) return false;
  if (isForcedNow(r)) return false;
  const pb = Math.max(r.origin === 0 ? 1 : r.origin, Math.ceil(r.s - .02) - 1);
  if (pb >= r.s - .001 && r.target <= r.s) return false;
  if (PL.runners.some(o => o !== r && !o.out && !o.scored && o.target === pb && o.s < r.s)) return false;
  r.target = Math.min(r.target, pb); if (r.target < r.s - 1) r.target = pb; r.manual = true; return true;
}
function runnerControl(dt) {
  const L = PL, bt = BT(), list = alive().sort((a, b) => b.s - a.s);
  if (!list.length) return;
  L.sel = clamp(L.sel, 0, list.length - 1);
  if (isHuman(bt)) {
    const I = INP[bt.ctl];
    if (I.p.left) L.sel = (L.sel + 1) % list.length;
    if (I.p.right) L.sel = (L.sel - 1 + list.length) % list.length;
    const r = list[L.sel];
    if (I.p.up) sendForward(r);
    if (I.p.down) sendBack(r);
    if (I.p.act) for (const x of list) sendForward(x);
    if (I.p.back) for (const x of list.slice().reverse()) sendBack(x);
    const sp = runSpells(r); L.selR = clamp(L.selR || 0, 0, sp.length - 1);
    if (I.p.prev) { L.selR = (L.selR - 1 + sp.length) % sp.length; tone(520, .03, 'square', .02); }
    if (I.p.next) { L.selR = (L.selR + 1) % sp.length; tone(520, .03, 'square', .02); }
    if (I.p.abil) { const o = sp[L.selR]; if (o.ult) castRunUlt(o, r); else if (o.phys) castPhysRun(o, r); else if (o.own) castRun(r); else castClubRun(o, r); }
    if (I.p.hus) tapEffort(r, 'eff', r.p);
  }
  // the CPU's runner magic; with Auto powers on it also runs for a human's runners
  if ((!isHuman(bt) || AUTO) && L.cpuRunCD <= 0) {
    L.cpuRunCD = .25; const ad = isHuman(bt) ? 2 : G.diff;
    for (const r of list) { const e = runUltEntry(r); if (e && e.ok && r.target > r.s && R() < .3 + ad * .1) { castRunUlt(e, r); break; } }
    for (const r of list) {
      const ab = r.p.run; if (!ab || r.used || AB[ab].passive || bt.mana < abCost(r.p, ab) || settled(r)) continue;
      const bt2 = ballTimeTo(r.target % 4), rt = Math.abs(r.target - r.s) * 90 / Math.max(1, effSpeed(r));
      if (rt > bt2 - .15 && r.target > r.s && R() < .5 + ad * .15) { castRun(r); break; }
    }
    for (const r of list) {
      if (settled(r) || r.target <= r.s || r.usedPhys) continue;
      const bt2 = ballTimeTo(r.target % 4), rt = Math.abs(r.target - r.s) * 90 / Math.max(1, effSpeed(r));
      if (Math.abs(rt - bt2) < .5 && fatigue(r.p) > .35 && R() < .3 + ad * .1) { const o = runSpells(r).find(x => x.phys && x.ok); if (o) { castPhysRun(o, r); break; } }
    }
    // club magic: a quickening charm when a runner is in a close race
    for (const r of list) {
      if (settled(r) || r.target <= r.s) continue;
      const bt2 = ballTimeTo(r.target % 4), rt = Math.abs(r.target - r.s) * 90 / Math.max(1, effSpeed(r));
      if (Math.abs(rt - bt2) < .45 && R() < .25 + ad * .1) {
        const sp = runSpells(r).filter(o => !o.own && o.ok && bt.mana - o.cost >= 1);
        if (sp.length) { castClubRun(sp[rt > bt2 && sp.find(o => o.id === 'ghostslide') ? sp.length - 1 : 0], r); break; }
      }
    }
  }
  for (const r of list) if (!r.manual || r.mustReturn) runnerAI(r);
}
function runnerAI(r) {
  const L = PL;
  if (r.mustReturn) { if (r.s <= r.origin + .005) r.mustReturn = false; else { r.target = r.origin; return; } }
  if (L.homer) { r.target = 4; return; }
  if (isForcedNow(r) && r.target < r.origin + 1) r.target = r.origin + 1;
  if (L.flyPending && r.origin > 0) return;
  const aggr = [.45, .35, .25][G.diff];
  if (settled(r)) {
    const cur = Math.round(r.s), nb = cur + 1; if (nb > 4) return;
    if (occupiedAhead(r, nb)) return;
    const rt = 90 / Math.max(1, effSpeed(r)), bt = ballTimeTo(nb % 4);
    if (rt + aggr < bt) r.target = nb;
  } else if (r.target > r.s && !isForcedNow(r)) {
    const prev = Math.ceil(r.s - .001) - 1, prog = r.s - prev;
    const rt = (r.target - r.s) * 90 / Math.max(1, effSpeed(r)), bt = ballTimeTo(r.target % 4);
    if (!isHuman(BT()) && !r.cpuHustled && Math.abs(rt - bt) < .5 && fatigue(r.p) > .3) { r.cpuHustled = true; r.eff = .7; drain(r.p, 5, 'effort'); useTag('hustle', `${shortName(r.p)} went all out`); }
    if (bt + .12 < rt && prog < .5 && prev >= 1 && !occupiedAhead(r, prev)) r.target = prev;
    if (bt + .12 < rt && prog < .5 && prev === 0 && r.origin === 0) { /* batter keeps running */ }
  }
}
function moveRunners(dt) {
  const L = PL;
  const list = L.runners.filter(r => !r.out && !r.scored).sort((a, b) => b.s - a.s);
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (r.delay > 0) { r.delay -= dt; continue; }
    const sp = effSpeed(r) / 90 * dt;
    if (r.fx.flee > 0) { const back = Math.max(r.origin === 0 ? 0 : r.origin - 0, Math.ceil(r.s - .001) - 1); r.s = Math.max(back, r.s - sp); continue; }
    if (r.target > r.s) { r.s = Math.min(r.target, r.s + sp); if (r.holdAt != null && L.flyPending) r.s = Math.min(r.s, r.holdAt); }
    else if (r.target < r.s) r.s = Math.max(r.target, r.s - sp);
    if (r.mustReturn && r.s <= r.origin + .005) r.mustReturn = false;
    if (i > 0) { const lead = list[i - 1]; if (!lead.out && !lead.scored && r.s > lead.s - .12 && lead.s < 4) r.s = Math.max(Math.min(r.s, lead.s - .12), Math.min(r.s, lead.s - .12)); }
    if (r.s >= 3.999 && r.target >= 4) {
      if (L.block && !L.blockUsed && !L.homer) {
        L.blockUsed = true; const roll = d20(), ok = roll >= 11;
        addRoll(`${shortName(r.p)} vs Block the Plate`, 'd20 ≥ 11 to score', roll, ok);
        if (!ok) { outRunner(r, 'blocked', null); hurt(r.p, 12, 'flattened at the plate'); continue; }
      }
      r.scored = true; r.s = 4; L.runsThisPlay++; scoreRun(r.p); tone(880, .08, 'square', .05); tone(1175, .12, 'square', .05, 0, .08);
      addFx('callout', { text: `${shortName(r.p)} scores`, col: BT().def.light, small: true });
    }
  }
}
function checkOuts() {
  const L = PL, b = L.ball; if (b.st !== 'held') return;
  const f = b.holder; if (f.stun > 0) return;
  for (const r of alive()) {
    if (r.fx.invis > 0) continue;
    // force outs and tag-up appeals
    if (isForcedNow(r)) { const nb = r.origin + 1, P = BASE[nb % 4]; if (hyp(f.x - P.x, f.y - P.y) < 5) { outRunner(r, r.origin === 0 ? 'ground' : 'force', f); continue; } }
    if (r.mustReturn && r.s > r.origin + .005) { const P = BASE[r.origin % 4]; if (hyp(f.x - P.x, f.y - P.y) < 5) { outRunner(r, 'doubled', f); continue; } }
    // tags
    if (!touching(r)) {
      const p = runnerPos(r);
      if (hyp(p.x - f.x, p.y - f.y) < 5.5) {
        if (r.fx.untag > 0) continue;
        if (r.fx.slide > 0) {
          r.fx.slide = 0; const need = Math.max(2, 12 - luck(f.p)), roll = d20(), ok = roll >= need;
          addRoll(`${shortName(f.p)} tags ${shortName(r.p)} (Hook Slide)`, `d20 ≥ ${need} to get the tag`, roll, ok);
          if (!ok) { r.fx.untag = .6; addFx('callout', { text: 'Slid around the tag!', col: '#ffd27a' }); continue; }
        }
        if (r.fx.bull > 0) {
          r.fx.bull = 0; const need = Math.max(2, (r.fx.bullNeed || 11) - luck(f.p)), roll = d20(), ok = roll >= need;
          addRoll(`${shortName(f.p)} tags ${shortName(r.p)} (Bull Rush)`, `d20 ≥ ${need} to hold on`, roll, ok);
          if (!ok) { f.stun = 1.6; b.st = 'loose'; b.holder = null; b.z = 0; addFx('callout', { text: 'Trampled!', col: '#ff9a3a' }); G.shake = .3; hurt(f.p, 18, `trampled by ${r.p.n}`); return; }
        }
        outRunner(r, 'tag', f);
      }
    }
  }
}
function outRunner(r, how, f) {
  const L = PL; if (r.out || r.scored) return;
  r.out = true; G.outs++; L.outs.push({ r, how, f }); if (f) { pst(f.p).outs++; creditOut(f, how); }
  if (G.outs >= 3 && (how === 'force' || how === 'ground') && L.runsThisPlay > 0) {
    const t = BT(); t.R -= L.runsThisPlay; t.line[G.inning - 1] -= L.runsThisPlay; L.negated = L.runsThisPlay; L.runsThisPlay = 0; renderLineScore();
  }
  sfx.out();
  const words = { ko: 'Carried off', fly: 'Caught', robbed: 'Robbed', tag: 'Tagged out', force: 'Forced out', ground: 'Out at first', doubled: 'Doubled off', devoured: 'Devoured', blocked: 'Out at the plate' };
  addFx('callout', { text: `${words[how] || 'Out'}: ${shortName(r.p)}`, col: '#ff8a7a', small: how !== 'devoured' });
  if (L.outs.length === 2 && G.outs <= 3) banner('Double play', '', 1.3);
  if (L.outs.length === 3) banner('Triple play!', 'the bog erupts', 2);
}

/* ---------- abilities during the play ---------- */
// the batting side's spell list for the picked runner: their own spell (if any), then club magic
function runSpells(r) {
  const L = PL, bt = BT(), out = [];
  if (r && r.p.run && !AB[r.p.run].passive) { const cost = abCost(r.p, r.p.run); out.push({ id: r.p.run, own: true, cost, ok: !r.used && bt.mana >= cost, why: r.used ? 'used' : bt.mana < cost ? 'need mana' : '' }); }
  const phr = r ? physOf(r.p, 'run') : null;
  if (phr) { const tired = fatigue(r.p) <= .08, still = phr === 'burst' && settled(r); out.push({ id: phr, own: true, phys: true, cost: 0, stam: AB[phr].stam, ok: !r.usedPhys && !tired && !still, why: r.usedPhys ? 'used' : tired ? 'exhausted' : still ? 'runner standing' : '' }); }
  for (const id of ['haste', 'ghostslide']) {
    const cost = AB[id].cost, used = L.usedT[id], still = !r || settled(r);
    out.push({ id, own: false, cost, ok: !used && bt.mana >= cost && !still, why: used ? 'used' : bt.mana < cost ? 'need mana' : still ? 'runner standing' : '' });
  }
  { const ue = runUltEntry(r); if (ue) out.push(ue); }
  return out;
}
function castPhysRun(o, r) {
  const bt = BT();
  if (!o || !o.ok || !r) { if (isHuman(bt)) tone(140, .1, 'square', .04); return false; }
  drain(r.p, o.stam, 'skill'); r.usedPhys = true; abUse(r.p, o.id); useTag('skill', `${shortName(r.p)}: ${AB[o.id].name}`);
  if (o.id === 'burst') r.fx.spd = { t: 1.2, m: 1.6 };
  else if (o.id === 'hookslide') r.fx.slide = 2;
  else if (o.id === 'barrel') { r.fx.bull = 2; r.fx.bullNeed = 9; }
  tone(180, .09, 'triangle', .07); addFx('puff', { ...runnerPos(r), col: '#c8a36a' });
  addFx('callout', { text: `${shortName(r.p)}: ${AB[o.id].name}`, col: '#ffd27a', small: true });
  return true;
}
function castPhysField(o) {
  const L = PL, ft = FT(), f = o.f;
  if (!o.ok || !f) { if (isHuman(ft)) tone(140, .1, 'square', .04); return; }
  drain(f.p, o.stam, 'skill'); L.usedP[f.p.n] = true; abUse(f.p, o.ab); useTag('skill', `${shortName(f.p)}: ${AB[o.ab].name}`);
  if (o.ab === 'dive') { const tx = L.chasePt ? L.chasePt.x : L.ball.x, ty = L.chasePt ? L.chasePt.y : L.ball.y, dx = tx - f.x, dy = ty - f.y, d = hyp(dx, dy), m = Math.min(25, d); addFx('puff', { x: f.x, y: f.y, col: '#b9a07a' }); if (d > 0) { f.x += dx / d * m; f.y += dy / d * m; } L.chaseCD = 0; if (R() < .12) hurt(f.p, 10, 'jammed a shoulder on the dive'); }
  else if (o.ab === 'leap') { f.leapT = 2; L.chaseCD = 0; }
  else if (o.ab === 'rocket') f.rocket = true;
  tone(180, .09, 'triangle', .07);
  addFx('callout', { text: `${shortName(f.p)}: ${AB[o.ab].name}`, col: '#ffd27a', small: true });
}
function castClubRun(o, r) {
  const bt = BT();
  if (!o || !o.ok || !r) { if (isHuman(bt)) tone(140, .1, 'square', .04); return false; }
  bt.mana -= o.cost; PL.usedT[o.id] = true; abUse(r.p, o.id); useTag('club', `${AB[o.id].name} on ${shortName(r.p)}`);
  if (o.id === 'haste') r.fx.spd = { t: 2.5, m: 1.5 };
  else { r.fx.untag = Math.max(r.fx.untag || 0, 1.5); r.fx.mist = 1.5; }
  sfx.magic(); addFx('puff', { ...runnerPos(r), col: '#b9a6ff' });
  addFx('callout', { text: `Club magic: ${AB[o.id].name} on ${shortName(r.p)}`, col: '#c9a4ff', small: true });
  return true;
}
function castClubField(o) {
  const L = PL, ft = FT();
  if (!o.ok) { if (isHuman(ft)) tone(140, .1, 'square', .04); return; }
  ft.mana -= o.cost; L.usedT['f' + o.ab] = true; sfx.magic(); useTag('club', AB[o.ab].name + (o.target ? ` on ${shortName(o.target.p)}` : ''));
  addFx('callout', { text: `Club magic: ${AB[o.ab].name}`, col: '#c9a4ff', small: true });
  if (o.ab === 'gust') L.gust = true;
  else if (o.target) { o.target.fx.roots = 2; addFx('roots', { r: o.target }); }
}

function castRun(r) {
  const L = PL, bt = BT(), ab = r.p.run;
  if (!ab || r.used || r.out || r.scored) return false;
  const A = AB[ab], cost = abCost(r.p, ab), pm = abPow(r.p, ab); if (A.passive || bt.mana < cost) { if (isHuman(bt)) tone(140, .1, 'square', .04); return false; }
  if (ab === 'shadowstep') {
    const nb = Math.min(4, Math.floor(r.s + .02) + 1);
    if (occupiedAhead(r, nb) || (r.mustReturn)) return false;
    const from = runnerPos(r); r.s = nb; r.target = Math.max(r.target, nb); r.manual = true;
    addFx('puff', { ...from, col: '#7a5cff' }); addFx('puff', { ...runnerPos(r), col: '#7a5cff' });
  } else if (ab === 'sprint') r.fx.spd = { t: 2.5 * pm, m: 2 };
  else if (ab === 'fleet') r.fx.spd = { t: 3 * pm, m: 1.6 };
  else if (ab === 'glide') r.fx.spd = { t: 3 * pm, m: 1.5 };
  else if (ab === 'swarm') { r.fx.untag = 2.5 * pm; r.fx.spd = { t: 2.5 * pm, m: 1.4 }; }
  else if (ab === 'invis') r.fx.invis = 3 * pm;
  else if (ab === 'bullrush') { r.fx.bull = 4 * pm; r.fx.bullNeed = 11 + 2 * (tierOf(r.p, 'run') - 1); }
  bt.mana -= cost; r.used = true; drain(r.p, 3 * cost, 'spell', 'run'); abUse(r.p, ab); useTag('magic', `${shortName(r.p)}: ${A.name}`);
  sfx.magic();
  addFx('callout', { text: `${shortName(r.p)}: ${A.name}`, col: '#c9a4ff', small: true });
  return true;
}
const immune = r => r.p.run === 'stoneskin' || r.fx.invis > 0;
function nearestMoving(f, range) {
  let best = null, bd = range;
  for (const r of alive()) { if (!moving(r) || immune(r)) continue; const p = runnerPos(r), d = hyp(p.x - f.x, p.y - f.y); if (d < bd) { bd = d; best = r; } }
  return best;
}
function fieldAbilities() {
  const L = PL, ft = FT(), out = [];
  for (const f of L.fielders) {
    const ab = f.p.field; if (!ab) continue;
    const A = AB[ab], cost = abCost(f.p, ab); let ok = !L.usedF[ab] && ft.mana >= cost && f.stun <= 0 && !L.homer && L.endT === null, target = null, why = '';
    const b = L.ball;
    if (ab === 'devour') {
      if (ft.devourUsed) { ok = false; why = 'full'; }
      let bd = 22; for (const r of alive()) { if (immune(r)) continue; const p = runnerPos(r), d = hyp(p.x - f.x, p.y - f.y); if (d < bd) { bd = d; target = r; } }
      if (!target) { ok = false; why = why || 'no one in reach'; }
    } else if (ab === 'pounce') { if (!(b.st === 'batted' || b.st === 'loose') || !L.chasePt) { ok = false; why = 'ball not loose'; } }
    else if (ab === 'boulder') { if (L.boost) { ok = false; why = 'ready'; } }
    else if (ab === 'telek') { if (L.telek) { ok = false; why = 'ready'; } }
    else if (ab === 'quake') { if (!alive().some(r => moving(r) && !immune(r))) { ok = false; why = 'no runners moving'; } }
    else if (ab === 'flight') { if (!(b.st === 'batted') || f.flight > 0) { ok = false; why = 'ball not in the air'; } }
    else if (ab === 'haunt') { target = nearestMoving(f, 260); if (!target) { ok = false; why = 'no runners moving'; } }
    else if (ab === 'mesmer') { target = nearestMoving(f, 120); if (!target) { ok = false; why = 'out of range'; } }
    else if (ab === 'petrify') { target = nearestMoving(f, 330); if (!target) { ok = false; why = 'out of range'; } }
    else if (ab === 'web') { target = nearestMoving(f, 140); if (!target) { ok = false; why = 'out of range'; } }
    else if (ab === 'block') { if (L.block || !alive().some(r => r.origin > 0 || r.s > 1)) { ok = false; why = L.block ? 'set' : 'no threat'; } }
    if (L.usedF[ab]) why = 'used';
    out.push({ f, ab, ok, target, why, cost });
  }
  // physical skills of the fielder on the ball (chaser) or holding it
  {
    const bl = L.ball, cands = [];
    if (L.chaser && (bl.st === 'batted' || bl.st === 'loose')) cands.push(L.chaser);
    if (bl.holder && !cands.includes(bl.holder)) cands.push(bl.holder);
    for (const f of cands) {
      const ph = physOf(f.p, 'field'); if (!ph) continue;
      if (ph === 'rocket' ? bl.holder !== f : f !== L.chaser) continue;
      const used = L.usedP[f.p.n], tired = fatigue(f.p) <= .08;
      let ok = !used && !tired && f.stun <= 0 && L.endT === null && !L.homer, why = '';
      if (ph === 'leap' && bl.st !== 'batted') { ok = false; why = 'ball not in the air'; }
      if (used) why = 'used'; else if (tired) why = 'exhausted';
      out.push({ f, ab: ph, ok, why, cost: 0, stam: AB[ph].stam, phys: true, target: null });
    }
  }
  // club magic every team carries
  for (const ab of ['gust', 'roots']) {
    const cost = AB[ab].cost, used = L.usedT['f' + ab]; let ok = !used && ft.mana >= cost && !L.homer && L.endT === null, target = null, why = '';
    if (ab === 'roots') { target = alive().filter(r => moving(r) && !immune(r) && r.target > r.s).sort((a, b) => b.s - a.s)[0] || null; if (!target) { ok = false; why = 'no runner advancing'; } }
    if (ab === 'gust' && L.gust) { ok = false; why = 'ready'; }
    if (used) why = 'used'; else if (ft.mana < cost && !why) why = 'need mana';
    out.push({ f: null, ab, ok, target, why, cost, team: true });
  }
  out.push(...fieldUltEntries());
  return out;
}
function castField(o) {
  if (o.ult) return castFieldUlt(o);
  if (o.team) return castClubField(o);
  if (o.phys) return castPhysField(o);
  const L = PL, ft = FT(), A = AB[o.ab], f = o.f, t = o.target, pm = abPow(f.p, o.ab), tb = tierOf(f.p, 'field') - 1;
  if (!o.ok) { if (isHuman(ft)) tone(140, .1, 'square', .04); return; }
  ft.mana -= o.cost; L.usedF[o.ab] = true; drain(f.p, 3 * o.cost, 'spell', 'field'); abUse(f.p, o.ab); useTag('magic', `${shortName(f.p)}: ${A.name}` + (t ? ` on ${shortName(t.p)}` : ''));
  sfx.magic();
  addFx('callout', { text: `${shortName(f.p)}: ${A.name}`, col: '#c9a4ff', small: true });
  if (o.ab === 'devour') {
    ft.devourUsed = true; const onBase = touching(t), need = Math.max(2, (onBase ? 16 : 12) - 2 * tb - luck(f.p)), roll = d20(), ok = roll >= need;
    addRoll(`${shortName(f.p)} tries to eat ${shortName(t.p)}`, `d20 ≥ ${need}${onBase ? ' (on base)' : ''}`, roll, ok);
    addFx('chomp', { ...runnerPos(t), ok });
    if (ok) { sfx.chomp(); musicSting('devour'); outRunner(t, 'devoured', f); banner('Devoured!', `${t.p.n} is gone. Mawgrum looks pleased.`, 2); G.shake = .4; hurt(t.p, 35, 'half-digested before being spat out'); }
    else { sfx.bad(); f.stun = 2.5; t.fx.spd = { t: 2, m: 1.5 }; addFx('callout', { text: 'He chokes!', col: '#ffd27a' }); hurt(f.p, 8, 'choked on a runner'); }
  } else if (o.ab === 'pounce') {
    const dx = L.chasePt.x - f.x, dy = L.chasePt.y - f.y, d = hyp(dx, dy), m = Math.min(45 * pm, d);
    addFx('puff', { x: f.x, y: f.y, col: '#b9a07a' }); if (d > 0) { f.x += dx / d * m; f.y += dy / d * m; }
    L.chaseCD = 0;
  } else if (o.ab === 'boulder') L.boost = true;
  else if (o.ab === 'telek') L.telek = true;
  else if (o.ab === 'quake') { for (const r of alive()) if (!immune(r)) { r.fx.stun = 1.3 * pm; if (R() < .15) hurt(r.p, 8, 'tumbled in the quake'); } G.shake = .7; addFx('ring', { x: f.x, y: f.y, col: '#b8a88a', r: 0, max: 220 }); }
  else if (o.ab === 'flight') { f.flight = 4 * pm; L.chaseCD = 0; }
  else if (o.ab === 'haunt') { t.fx.flee = 1.2 * pm; addFx('ghost', { r: t }); }
  else if (o.ab === 'mesmer') { t.fx.stun = 1.8 * pm; addFx('beam', { f, r: t, col: '#ff4d6d', t: 0 }); }
  else if (o.ab === 'petrify') {
    const need = Math.max(2, 10 - 2 * tb - luck(f.p)), roll = d20(), ok = roll >= need; addRoll(`${shortName(f.p)} gazes at ${shortName(t.p)}`, `d20 ≥ ${need}`, roll, ok);
    addFx('beam', { f, r: t, col: '#9fe38a', t: 0 }); if (ok) t.fx.stone = 3 * pm; else addFx('callout', { text: 'Looked away!', col: '#ffd27a', small: true });
  } else if (o.ab === 'web') { t.fx.slow = 3 * pm; addFx('beam', { f, r: t, col: '#e8e8f0', t: 0, web: true }); }
  else if (o.ab === 'block') L.block = true;
}
function fieldAbilityControl(dt) {
  const L = PL, ft = FT(), list = fieldAbilities();
  L.fabs = list;
  if (HINTS && isHuman(ft)) for (const o of list) { const k = o.ab + (o.f ? o.f.p.n : ''); if (o.ok && !L.readyNote[k] && o.ab !== 'gust' && o.ab !== 'boulder' && o.ab !== 'telek' && o.ab !== 'block') { L.readyNote[k] = true; if (o.ab === 'devour' || o.ab === 'petrify' || o.ab === 'mesmer' || o.ab === 'web' || o.ab === 'roots') addFx('callout', { text: `${AB[o.ab].name} is in range: ${keyHints(ft.ctl).cyc} to pick it, ${keyHints(ft.ctl).ab} to cast`, col: '#d6c4ff', small: true }); } }
  if (isHuman(ft)) { const I = INP[ft.ctl]; if (I.p.hus) { const f = L.ball.holder || L.chaser; if (f) tapEffort(f, 'eff', f.p); } }
  else if (L.chaser && !L.chaser.cpuHustled && (L.ball.st === 'batted' || L.ball.st === 'loose') && G.diff >= 1 && fatigue(L.chaser.p) > .4) { L.chaser.cpuHustled = true; L.chaser.eff = .3 + .2 * G.diff; drain(L.chaser.p, 3, 'effort'); }
  if (!list.length) return;
  L.selF = clamp(L.selF, 0, list.length - 1);
  if (isHuman(ft)) {
    const I = INP[ft.ctl];
    if (I.p.prev) L.selF = (L.selF - 1 + list.length) % list.length;
    if (I.p.next) L.selF = (L.selF + 1) % list.length;
    if (I.p.abil) castField(list[L.selF]);
  }
  if (!isHuman(ft) || AUTO) { // the CPU's fielding magic; with Auto powers on it also casts for a human's fielders
    L.cpuCD -= dt; if (L.cpuCD > 0) return; L.cpuCD = .3;
    const want = [.18, .28, .4][isHuman(ft) ? 2 : G.diff];
    for (const o of [...list].sort((a, b) => (b.ult ? 1 : 0) - (a.ult ? 1 : 0))) {
      if (!o.ok) continue;
      if (o.ab === 'block' || o.ab === 'boulder' || o.ab === 'telek' || o.ab === 'gust') { if (!(L.ball.st === 'held' || L.ball.st === 'loose')) continue; }
      if (o.ab === 'devour' && touching(o.target) && R() > .25) continue;
      if (o.ab === 'dive' && !(L.chasePt && hyp(o.f.x - L.chasePt.x, o.f.y - L.chasePt.y) > 12)) continue;
      if (o.ab === 'leap' && !(L.tr.hrAt >= 0)) continue;
      if (o.ab === 'flight' && !(L.tr.hrAt >= 0 || hyp(L.chasePt ? L.chasePt.x : 0, L.chasePt ? L.chasePt.y : 0) > 250)) continue;
      if (R() < (o.ult ? .45 : want)) { castField(o); break; }
    }
  }
}

/* ---------- wrapping up the play ---------- */
function finishPlay() {
  const L = PL, bat = L.bat, bt = BT();
  const batR = L.runners.find(r => r.origin === 0);
  // commit bases
  G.bases = [null, null, null, null];
  for (const r of alive()) { let b = clamp(Math.round(r.s), 1, 3); while (G.bases[b] && b < 3) b++; G.bases[b] = r.p; }
  // narrative
  const where = hitWhere(L);
  let line = '', hit = false;
  if (L.homer) { line = `${bat.n} homers ${where}`; hit = true; }
  else if (batR.out) {
    const o = L.outs.find(o => o.r === batR);
    const fp = o && o.f ? o.f.p.pos : '';
    line = o.how === 'ko' ? `${bat.n} is carried off the field` : o.how === 'fly' ? `${bat.n} flies out to ${fp}` : o.how === 'robbed' ? `${bat.n} is robbed of a homer by ${o.f.p.n}` : o.how === 'devoured' ? `${bat.n} is eaten on the base paths` : o.how === 'ground' ? `${bat.n} grounds out${L.firstFielder ? ' to ' + L.firstFielder.p.pos : ''}` : `${bat.n} is thrown out trying for more`;
  } else if (batR.scored) { line = `${bat.n} circles the bases: inside-the-park home run ${where}`; hit = true; }
  else {
    const b = Math.round(batR.s); const other = L.outs.length > 0;
    if (other && b === 1) line = `${bat.n} reaches on a fielder's choice`;
    else { line = `${bat.n} ${['', 'singles', 'doubles', 'triples'][b] || 'reaches'} ${where}`; hit = true; }
  }
  if (L.bobbled && !hit && !batR.out) line += ' (bobbled)';
  const extra = [];
  for (const o of L.outs) if (o.r !== batR) extra.push(o.how === 'devoured' ? `${o.r.p.n} is devoured` : o.how === 'ko' ? `${o.r.p.n} is carried off the field` : `${o.r.p.n} ${o.how === 'doubled' ? 'is doubled off' : o.how === 'blocked' ? 'is cut down at the plate' : 'is out'}`);
  if (L.runsThisPlay) extra.push(`${L.runsThisPlay} run${L.runsThisPlay > 1 ? 's' : ''} score${L.runsThisPlay > 1 ? '' : 's'}`);
  if (L.negated) extra.push(`the run doesn't count on the force`);
  logLine(line + (extra.length ? '. ' + extra.join('. ') : '') + '.', L.homer || L.runsThisPlay > 0 || L.outs.some(o => o.how === 'devoured'), takeTags());
  if (G.lastPitch && typeof renderReadout === 'function') { G.lastPitch.outcome = G.log[0].text; renderReadout(); }
  statInPlay(L, bat, batR, hit);
  if (hit) { pst(bat).h++; if (L.homer) pst(bat).hr++; bt.H++; bt.mana = Math.min(6, bt.mana + 1); if (!L.homer) banner(['', 'Single', 'Double', 'Triple', 'Inside the park!'][batR.scored ? 4 : Math.round(batR.s)] || 'Hit', '', 1.1); }
  PL = null;
  if (G.outs >= 3) return endHalf();
  if (checkWalkoff()) return;
  nextBatter();
}
function hitWhere(L) {
  const p = L.chasePt || L.ball, a = Math.atan2(p.x, p.y) / DEG, d = hyp(p.x, p.y);
  if (d < 140) return a < -22 ? 'to the left side' : a > 22 ? 'to the right side' : 'up the middle';
  return a < -27 ? 'to left' : a < -9 ? 'to left-center' : a < 9 ? 'to center' : a < 27 ? 'to right-center' : 'to right';
}
