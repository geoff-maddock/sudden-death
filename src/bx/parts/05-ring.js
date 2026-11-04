/* The Anvil Ring: the ring (issue #23, phase 1). Two fighters, moved on in steps of BX_DT seconds; no plays and no
   snaps, only a clock. Each fighter does one thing at a time (f.a): stands ready, throws a punch, keeps the guard up,
   slips, clinches, or is stunned or down. Moving goes on beside it, slower while punching or covering.
   Ring space: x and y in feet from the middle, the ropes at BX_RING.rope. Distance is the field: a punch lands only
   from inside its range, which is the fighter's reach times the punch's share (a jab reaches furthest, a body shot
   least). A punch takes time to wind up (hitAt) and to come back (dur), so it can be seen coming:
   - a slip (timed so the punch arrives while the head is out of the way) makes a head punch miss, and opens a counter
     window: the slipper's next punch lands more often and harder;
   - the guard (held high) takes most of a head punch, but none of a body shot, and recovers stamina slowly;
   - a clinch, from close in, ties both fighters up until the referee breaks them; nothing is thrown and the holder gets
     their breath back.
   A landed punch costs the other fighter health (more for a hard hitter, less against a good chin, less again from a
   tired arm); a power punch (hook, body shot) that lands also lowers their hpMax a little, and a hard one stuns.
   Zero health is a knockdown: G.down is set and the bout (07-bout.js) takes over. Body shots drain stamina too.
   Powers (11-powers.js) leave statuses that change all of this: quicker or slower, rooted, harder to hit, hitting
   harder, healing on what lands, and the rest (bxFx); a punch's damage goes through bxHurt, which knows them.
   Every punch, slip, block and knockdown is told to BXE ({ k, side, p, n, ctr }), which the page drains for its
   words and the bout for its log; it is not saved. */
const BX_DT = .05;
const BX_RING = { half: 9, rope: 8.3, body: 1.55, back: .6, ropes: .7 };
const BX_PUNCH = {
  jab:  { n: 'jab',       hit: .16, dur: .36, range: 1,   dmg: 2,   sta: 3,   acc: .66, head: true },
  hook: { n: 'hook',      hit: .3,  dur: .64, range: .82, dmg: 8.5, sta: 7,   acc: .48, head: true, power: true },
  body: { n: 'body shot', hit: .26, dur: .58, range: .78, dmg: 4.5, sta: 6,   acc: .58, drain: 4, power: true },
};
const BX_PUNCH_IDS = Object.keys(BX_PUNCH);
const BX_SLIP = { dur: .38, from: .03, to: .3, sta: 2.5, ctr: .55 };
const BX_GUARD = { min: .35, head: .18, power: .35 };
const BX_CLINCH = { max: 2.2, near: 2.2, sta: 2, gap: 2.7 };
let BXE = [];

const bxFrac = f => clamp(f.sta / f.staMax, 0, 1);
const bxDist = (a, b) => hyp(a.x - b.x, a.y - b.y);
const bxRange = (f, k) => (1.95 + f.r.reach * .18) * BX_PUNCH[k].range;
// how long everything takes: quicker for the fast, slower when tired
const bxTempo = f => (1.08 - f.r.spd * .015) * (1 + .5 * (1 - bxFrac(f))) / bxFx(f).spd;
const bxMoveSpd = f => (2.6 + f.r.spd * .2) * (.6 + .4 * bxFrac(f)) * bxFx(f).move;
const bxPunching = f => !!BX_PUNCH[f.a.k];
const bxBusy = f => f.a.k !== 'idle' && f.a.k !== 'guard';
const bxMass = f => { const K = KIND[f.kind] || KIND.goblin; return K.w * K.h; };
const bxOnRopes = f => Math.max(Math.abs(f.x), Math.abs(f.y)) > BX_RING.rope - .15;
function bxEv(k, side, o) {
  const e = Object.assign({ k, side, round: G.round }, o || {}); BXE.push(e); if (BXE.length > 60) BXE.shift();
  // (the page hears each one as it happens, for its sounds: never headless)
  if (BD && !BD.headless && BX_HOOK.onEv) try { BX_HOOK.onEv(e); } catch (er) { console.error(er); }
}

/* f starts something: a punch ('jab', 'hook', 'body'), 'slip', 'guard' (held for at least BX_GUARD.min; asking again
   keeps it up) or 'idle'. Returns false when it can't (no breath for the punch). */
function bxAct(f, k) {
  const P = BX_PUNCH[k], tm = bxTempo(f);
  if (P) {
    if (f.sta < P.sta * .5) return false;
    f.sta = Math.max(0, f.sta - P.sta); f.rs.thrown++;
    f.a = { k, t: 0, dur: P.dur * tm, hitAt: P.hit * tm, id: ++G.aid, done: false, ctr: f.ctr > 0 }; f.ctr = 0;
    return true;
  }
  if (k === 'guard' && f.a.k === 'guard') { f.a.dur = f.a.t + BX_GUARD.min; return true; }
  if (k === 'slip') { f.sta = Math.max(0, f.sta - BX_SLIP.sta); f.a = { k, t: 0, dur: BX_SLIP.dur * Math.min(1.2, tm), id: ++G.aid }; return true; }
  f.a = { k: k === 'guard' ? 'guard' : 'idle', t: 0, dur: k === 'guard' ? BX_GUARD.min : 0, id: ++G.aid };
  return true;
}
/* a tries to tie b up from close in: the craftier and the stronger get hold more often, and a fighter in the middle of
   a punch is easier to grab. A miss leaves a open for a moment ('grab'). */
function bxClinch(a, b) {
  if (bxDist(a, b) > BX_CLINCH.near || b.a.k === 'down') return false;
  a.sta = Math.max(0, a.sta - BX_CLINCH.sta); a.rs.clinch++;
  const p = clamp(.45 + (a.r.gui - b.r.gui) * .04 + (a.r.pow - b.r.pow) * .02 + (bxPunching(b) ? .1 : 0) - (b.a.k === 'slip' ? .2 : 0), .15, .85);
  if (R() < p) {
    const t = BX_CLINCH.max * (.6 + R() * .4);
    a.a = { k: 'clinch', t: 0, dur: t, id: ++G.aid, lead: true }; b.a = { k: 'clinch', t: 0, dur: t, id: ++G.aid };
    bxEv('clinch', a.side); return true;
  }
  a.a = { k: 'grab', t: 0, dur: .3, id: ++G.aid };
  return false;
}
// the referee breaks a clinch: both stand back to arm's length
function bxBreak() {
  const [A, B] = G.F; let dx = B.x - A.x, dy = B.y - A.y; const d = hyp(dx, dy) || 1; dx /= d; dy /= d;
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, h = BX_CLINCH.gap / 2;
  A.x = mx - dx * h; A.y = my - dy * h; B.x = mx + dx * h; B.y = my + dy * h;
  for (const f of G.F) { f.a = { k: 'idle', t: 0, dur: 0, id: ++G.aid }; f.x = clamp(f.x, -BX_RING.rope, BX_RING.rope); f.y = clamp(f.y, -BX_RING.rope, BX_RING.rope); }
  bxEv('break', -1);
}
/* a's punch k arrives: out of range, slipped, missed, blocked or landed */
function bxLand(a, b, k) {
  const P = BX_PUNCH[k], ctr = !!a.a.ctr;
  if (b.a.k === 'down' || b.a.k === 'clinch') return;
  if (bxDist(a, b) > bxRange(a, k) + .12) { bxEv('miss', a.side, { p: k, why: 'short' }); return; }
  const Fa = bxFx(a), Fb = bxFx(b);
  if (Fb.miss || (Fb.air && !P.head)) { bxEv('miss', a.side, { p: k, why: Fb.miss ? 'through' : 'over' }); return; }
  if (b.a.k === 'slip' && b.a.t >= BX_SLIP.from && b.a.t <= BX_SLIP.to && (P.head || R() < .5)) {
    b.rs.def++; b.rs.slips++; b.ctr = BX_SLIP.ctr; bxEv('slip', b.side, { p: k }); return;
  }
  let acc = P.acc + (a.r.spd - b.r.spd) * .008 + (a.r.gui - b.r.gui) * .006 - (1 - bxFrac(a)) * .22 + (1 - bxFrac(b)) * .12;
  const winding = bxPunching(b) && !b.a.done;
  if (winding) acc += .06;
  if (bxOnRopes(b)) acc += .08;
  if (ctr) acc += .2;
  if (b.a.k === 'stun' || b.a.k === 'grab') acc += .35;
  acc += Fa.acc;
  if (R() > clamp(acc, .08, .95)) { bxEv('miss', a.side, { p: k, why: 'missed' }); return; }
  // (Rampart takes a head punch whole: it scores nothing, and no buff is spent on it)
  if (Fb.rampart && P.head) { b.rs.def += .5; b.rs.blocks++; bxEv('block', a.side, { p: k, n: 0, ctr }); return; }
  const blocked = P.head && b.a.k === 'guard';
  let dmg = P.dmg * (.55 + a.r.pow * .09) * (.6 + .4 * bxFrac(a)) / (.4 + b.r.chin * .12);
  if (ctr) dmg *= 1.5;
  if (winding && !blocked) dmg *= 1.1;
  if (blocked) { dmg *= (P.power ? BX_GUARD.power : BX_GUARD.head) * (Fb.leaky ? 2 : 1); b.rs.def += .5; b.rs.blocks++; }
  else { a.rs.landed++; if (P.power) a.rs.power++; }
  dmg *= (.85 + R() * .3) * Fa.dmgOut * Fb.dmgIn;
  if (Fb.rampart) dmg *= .5;
  if (!blocked && P.power && Fa.nextMul !== 1) { dmg *= Fa.nextMul; a.fx = a.fx.filter(s => s.nextMul == null); }
  if (!blocked && P.power) b.hpMax = Math.max(35, b.hpMax - dmg * .2);
  if (P.drain) b.sta = Math.max(0, b.sta - P.drain * (.6 + a.r.pow * .06));
  bxEv(blocked ? 'block' : 'land', a.side, { p: k, n: Math.round(dmg * 10) / 10, ctr });
  bxHurt(a, b, dmg, !blocked);
  if (G.down != null) return;
  if (!blocked && dmg > 5 + b.r.chin * .7) { b.a = { k: 'stun', t: 0, dur: .35 + dmg * .025, id: ++G.aid }; bxEv('stun', b.side, { n: Math.round(dmg) }); }
}
// one fighter's action and breath move on by dt
function bxAdvance(f, o, dt) {
  f.a.t += dt;
  const P = BX_PUNCH[f.a.k];
  if (P && !f.a.done && f.a.t >= f.a.hitAt) { f.a.done = true; bxLand(f, o, f.a.k); }
  if (f.a.k !== 'clinch' && f.a.k !== 'down' && f.a.t >= f.a.dur) f.a = { k: 'idle', t: 0, dur: 0, id: f.a.id };
  const regen = (3.8 + f.r.sta * .3) * (f.a.k === 'guard' ? .55 : f.a.k === 'clinch' ? (f.a.lead ? 1.8 : 1.2) : P ? .3 : 1);
  if (!bxFx(f).noReg) f.sta = clamp(f.sta + regen * dt, 0, f.staMax);
  if (G.down == null) bxFxTick(f, dt);
  if (f.ctr > 0) f.ctr = Math.max(0, f.ctr - dt);
}
function bxMove(dt) {
  for (const f of G.F) {
    if (['clinch', 'down', 'stun', 'grab'].includes(f.a.k)) continue;
    const [mx, my] = f.mv, m = hyp(mx, my); if (m < .01) continue;
    const o = G.F[1 - f.side], before = bxDist(f, o), F = bxFx(f);
    if (F.root) continue;
    // backing up is slower than coming forward, and slower again along the ropes: so a presser can cut off the ring
    const fwd = ((o.x - f.x) * mx + (o.y - f.y) * my) / ((before || 1) * m), back = fwd < 0 ? lerp(1, BX_RING.back, -fwd) : 1;
    if (F.noBack && fwd < -.2) continue;
    const sp = bxMoveSpd(f) * back * (bxOnRopes(f) ? BX_RING.ropes : 1) * (bxPunching(f) ? (fwd > .3 ? .85 : .35) : f.a.k === 'guard' ? .55 : f.a.k === 'slip' ? .4 : 1) / Math.max(1, m);
    f.x += mx * sp * dt; f.y += my * sp * dt;
    if (bxDist(f, o) < before - .005) f.rs.press += dt;
  }
  // bodies don't overlap, and the ropes hold them in
  const [A, B] = G.F; let dx = B.x - A.x, dy = B.y - A.y; const d = hyp(dx, dy) || .001;
  // the bigger body gives less ground
  if (d < BX_RING.body) { const ma = bxMass(A), mb = bxMass(B), push = BX_RING.body - d; dx /= d; dy /= d; A.x -= dx * push * mb / (ma + mb); A.y -= dy * push * mb / (ma + mb); B.x += dx * push * ma / (ma + mb); B.y += dy * push * ma / (ma + mb); }
  for (const f of G.F) { f.x = clamp(f.x, -BX_RING.rope, BX_RING.rope); f.y = clamp(f.y, -BX_RING.rope, BX_RING.rope); }
}
/* one step of the round: both fighters think (06-cpu.js), act, breathe and move */
function bxStep(dt) {
  for (const f of G.F) bxThink(f, G.F[1 - f.side], dt);
  for (const f of G.F) { bxAdvance(f, G.F[1 - f.side], dt); if (G.down != null) return; }
  const [A, B] = G.F;
  if (A.a.k === 'clinch' && B.a.k === 'clinch' && (A.a.t >= A.a.dur || B.a.t >= B.a.dur)) bxBreak();
  else if ((A.a.k === 'clinch') !== (B.a.k === 'clinch')) for (const f of G.F) if (f.a.k === 'clinch') f.a = { k: 'idle', t: 0, dur: 0, id: ++G.aid };
  bxMove(dt);
}
