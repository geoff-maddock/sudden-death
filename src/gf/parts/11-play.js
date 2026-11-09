/* Cinder Gridiron: Play mode (issue #9, phase 2). In 'play' you call your side's plays as in 'call', and then play the
   offense by hand. On defense you call the defense and watch (question 3).
   - Throw: the quarterback waits for you. The target receiver has a ring (the one with the most room, until
     you pick another with Q or E). Hold Space to lead them: a marker runs out ahead along their path, further the longer
     you hold, and the rush keeps coming while you do. Let go to throw to the marker. Arm and pressure still decide how
     true it flies.
   - Run: once your player has the ball (after the handoff or the catch, or the quarterback before a throw), WASD or the
     arrows steer them; let go and they find their own lane. A quarterback who crosses the line can't throw any more.
     Space once a play is a stiff-arm: the next tackle in the next .7 seconds is shrugged off.
   - Kick: your punts and field goals are a two-tap meter. The first tap sets the power, the second the aim. A field goal
     needs the power for its distance and the aim inside a window that narrows with distance; a punt goes further with
     power and loses some with a wild aim.
   The page writes the keys with gfInput (no DOM here); L.ctl holds them for the live play, as plain data. */
const GF_LEAD = 1.6, GF_ARM = .7;
const gfHands = () => !!GD && GD.mode === 'play' && G.poss === GD.you;
// the page's keys: { steer: [sx, sy] on screen, hold: true | false (Space), pick: +1 | -1, tap: true (the kick meter) }
function gfInput(o) {
  if (!GD) return;
  if (GD.ph === 'kick' && GD.meter && o.tap) return gfMeterTap();
  // (only a play still going: between plays L is the last one, done)
  if (!L || !L.hands || L.done) return;
  const C = L.ctl, dir = gfDir();
  if (o.steer) C.steer = [o.steer[0] * dir, o.steer[1] * dir];
  if (o.pick) gfPickTarget(o.pick);
  if (o.hold === true) {
    // with the ball after the throw (or on a run): Space is the stiff-arm
    if (L.carrier >= 0 && (L.carrier !== L.id.QB || GF_PLAYS[L.oc].kind === 'run' || L.pl[L.id.QB].x > 0)) { if (!L.armUsed && L.carrier >= 0) { L.armUsed = true; L.arm = GF_ARM; gfEv('stiff', L.pl[L.carrier].n); } }
    else if (gfCanThrow()) C.hold = L.t;
  }
  if (o.hold === false && C.hold != null) { const held = L.t - C.hold; C.hold = null; if (gfCanThrow()) gfThrowTo(C.tgt, Math.min(GF_LEAD, .15 + held * 1.1)); }
}
const gfCanThrow = () => L && !L.thrown && L.carrier === L.id.QB && GF_PLAYS[L.oc].kind === 'pass' && L.pl[L.id.QB].x < 0;
const gfReceivers = () => L.pl.map((p, i) => i).filter(i => L.pl[i].side === 0 && L.pl[i].job === 'route');
// the receiver with the most room, as the quarterback would pick
function gfOpenest() {
  const free = L.pl.filter(p => p.side === 1 && p.stun <= 0);
  let best = -1, bs = -1e9;
  for (const i of gfReceivers()) { const [, sep] = gfNearest(L.pl[i].x, L.pl[i].y, free); if (sep > bs) { bs = sep; best = i; } }
  return best;
}
function gfPickTarget(d) { const r = gfReceivers(); if (!r.length) return; const k = r.indexOf(L.ctl.tgt); L.ctl.tgt = r[(k + d + r.length) % r.length]; L.ctl.picked = true; }
// where the lead marker is: the receiver's spot that many seconds on, at their pace
function gfLeadSpot(i, lead) { const p = L.pl[i]; return [p.x + p.vx * lead, p.y + p.vy * lead]; }
function gfThrowTo(i, lead) {
  const qb = L.pl[L.id.QB], rc = L.pl[i]; if (!rc) return;
  const [, press] = gfNearest(qb.x, qb.y, gfFree()), hurry = press < 1.8, v = gfThrowV(15 + qb.r.arm * 1.3);
  let [tx, ty] = gfLeadSpot(i, lead);
  const e = gfThrowErr(Math.max(.1, (10 - qb.r.arm) * .1) + (hurry ? 1.4 : .2) + hyp(tx - qb.x, ty - qb.y) * .03);
  tx += gauss() * e; ty += gauss() * e;
  Object.assign(L.ball, { st: 'air', h: -1, fx: qb.x, fy: qb.y, tx, ty, bt: 0, T: Math.max(.25, hyp(tx - qb.x, ty - qb.y) / v), tgt: i });
  L.thrown = true; L.carrier = -1;
  gfEv('throw', hurry ? 'hurried' : '', rc.n); gfAtThrow(i);
}
// each step of a hands-on play: keep the ring on the open receiver until you pick one
function gfHandsStep() { if (!L.ctl.picked || L.ctl.tgt < 0) L.ctl.tgt = gfOpenest(); if (L.arm > 0) L.arm -= GF_DT; }
// where the steered carrier is going: a few yards along the keys
function gfSteerAim(p) { const s = L.ctl.steer; if (!s || (!s[0] && !s[1])) return null; const n = hyp(s[0], s[1]); return [p.x + s[0] / n * 5, p.y + s[1] / n * 5]; }

/* ---------- the kick meter ---------- */
// a triangle wave, 0 to 1 and back, per period
const gfTri = (t, per) => { const u = (t / per) % 1; return u < .5 ? u * 2 : 2 - u * 2; };
function gfMeterStart() { GD.meter = { st: 0, t0: GD.t, pw: null, aim: null }; }
function gfMeterNow() { const M = GD.meter, t = GD.t - M.t0; return M.st === 0 ? gfTri(t, 1.3) : gfTri(t, .9) * 2 - 1; }
function gfMeterTap() {
  const M = GD.meter;
  if (M.st === 0) { M.pw = gfMeterNow(); M.st = 1; M.t0 = GD.t; return; }
  if (M.st === 1) { M.aim = gfMeterNow(); M.st = 2; }
}
// what the meter says: a field goal is good or not, a punt goes so far
function gfFgWindow(k) { return clamp(.1 + k.r.kck * .022 - (gfKickDist() - 20) * .003, .05, .32); }
function gfFgReach(k) { return 34 + k.r.kck * 2.6 + (gfGxOf(k).kick || 0); }
function gfMeterFg(k) { const M = GD.meter; return M.pw * gfFgReach(k) >= gfKickDist() && Math.abs(M.aim) <= gfFgWindow(k); }
function gfMeterPunt(k) { const M = GD.meter; return Math.max(8, Math.round((22 + M.pw * (22 + k.r.kck * 2.2) + (gfGxOf(k).punt || 0)) * (1 - Math.abs(M.aim) * .35))); }
