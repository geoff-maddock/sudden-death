/* Black Ice: by hand (issue #83, phase 2). In 'play' (GD.mode) you play your side (GD.you): with the puck whoever has
   it, without it the skater you're on (L.me: the one nearest the puck, until you switch). The goalie is the CPU's.
   With the puck:
   - steer them (WASD); let go and they glide on. Idle for HK_HANDS.idle seconds and they play on their own;
   - shoot (Space): a tap is a wrist shot; held, it winds up a slap shot (the bar beside them fills: more wind-up, a
     harder shot), let go to shoot. A checker can take the puck off a wind-up. Held too long, it goes on its own;
   - aim: the way you steer as you let go picks the target (hkAimTarget): up or down the screen for that post, with
     the way to the goal held as well for the top corner; nothing held is between the pads. The goalie covers what
     they can reach (hkAimFx): the post they have moved away from is open, the one they stand at is shut; the top
     corners score more and miss more; between the pads is good on a goalie who is sliding across;
   - the one-timer: press Space while a pass is on its way to you, within HK_HANDS.oneT seconds of it arriving, and
     it's shot as it lands. Earlier than that and you fan on it: a weak wrist shot;
   - pass (J): a tap passes to the teammate you're steering toward (or the best one when you aren't); held, it's sent
     hard the way you steer (a dump into the corner, or a clear).
   Without the puck:
   - steer your skater; poke (J) at the puck up close (your defense against their hands); check (Space): a lunge at
     the carrier, a hit if you reach them, and out of the play for a moment if you don't; hold Shift to lift your
     stick into the passing lane (more passes picked off, a little slower); E switches you to the next skater nearest
     the puck.
   G pulls your goalie for an extra skater, or sends them back. In the shootout you shoot your own tries (skate in,
   aim, shoot), and may take your goalie against theirs by steering up and down the screen (hkGoalieHand).
   The face-off: press Space as the puck drops. In the last HK_HANDS.drop seconds before it lands you win more of
   them, more the closer you are; earlier than that and you've jumped it, and win fewer. Don't press and it's the
   centres' ratings alone.
   HKI is your keys (not saved). */
const HK_HANDS = { idle: 2, tap: .18, full: .5, late: 1.3, dump: .28, oneT: .35, fan: .8, pokeCd: .6, hitCd: .9, lunge: .4, drop: .3, aimHold: .4 };
const HKI = { steer: [0, 0], aim: [0, 0], aimAt: -99, shoot: false, shootAt: 0, pass: false, passAt: 0, lift: false, last: -99, now: 0, oneAt: -99 };
const hkHandsOn = () => !!GD && GD.mode === 'play';
// you're at the keys: something pressed or held in the last few seconds
const hkActive = () => hkHandsOn() && (HKI.now - HKI.last < HK_HANDS.idle || HKI.shoot || HKI.pass || HKI.lift || !!(HKI.steer[0] || HKI.steer[1]));
const hkMine = i => i >= 0 && L.pl[i].side === GD.you && L.pl[i].pos !== 'G' && !L.pl[i].off;
// the skater you play now (an index in L.pl), or -1
function hkMe() {
  if (!L || !hkHandsOn()) return -1;
  const h = hkHand(), P = L.puck;
  if (hkMine(h)) return h;
  if (P.st === 'free' && P.k === 'pass' && hkMine(P.to) && L.pl[P.from].side === GD.you) return P.to;
  if (!hkMine(L.me == null ? -1 : L.me)) L.me = hkNearMine(-1);
  return L.me;
}
// your skater nearest the puck, after the one at `after` in that order (E: switch)
function hkNearMine(after) {
  const P = L.puck, mine = L.pl.map((p, i) => i).filter(hkMine).sort((a, b) => hyp(L.pl[a].x - P.x, L.pl[a].y - P.y) - hyp(L.pl[b].x - P.x, L.pl[b].y - P.y));
  if (!mine.length) return -1;
  return mine[(mine.indexOf(after) + 1) % mine.length];
}
// is skater i yours and are you playing them right now (so the CPU keeps its hands off)
const hkYoursNow = i => i >= 0 && hkActive() && hkMe() === i;
// where your skater goes while you steer: a few metres the way you push; null when you aren't steering (they glide)
function hkSteerAim(p) {
  const [sx, sy] = HKI.steer, n = hyp(sx, sy); if (!n) return null;
  return [p.x + sx / n * 4, p.y + sy / n * 4];
}
// the puck is in play: a live play, or a try in the shootout under way
const hkInPlay = () => GD.ph === 'live' || (GD.ph === 'so' && !!GD.so.cur && GD.so.cur.st === 'go');
// you have the puck, in play
const hkPuckMine = () => hkInPlay() && hkHand() >= 0 && hkHand() === hkMe();
/* the target from the way you steer (or last steered, a moment ago): { y: -1 | 1 (which post), hi } or 'five'
   (between the pads). dir: the way the shooter's side attacks */
function hkAimTarget(dir) {
  const [sx, sy] = HKI.steer[0] || HKI.steer[1] ? HKI.steer : HKI.now - HKI.aimAt < HK_HANDS.aimHold ? HKI.aim : [0, 0];
  if (Math.abs(sy) < .3) return 'five';
  return { y: sy < 0 ? -1 : 1, hi: sx * dir > .3 };
}
/* what aiming at t does against the goalie of `side`, as it stands: { f (times the odds of beating them), miss (added
   to the odds of missing the net) }. No target (the CPU, the headless game) is the plain roll: f 1, miss 0. */
function hkAimFx(side, t) {
  const g = L.pl[hkGk(side)]; if (!t || !hkInNet(side)) return { f: 1, miss: 0 };
  if (t === 'five') return { f: .75 + Math.min(1, hyp(g.vx, g.vy) / 2.5) * .8, miss: -.06 };
  const open = clamp(Math.abs(t.y * HK_RULES.net - g.y) / (2 * HK_RULES.net), 0, 1);
  return { f: (.55 + open * .9) * (t.hi ? 1.15 : .95), miss: t.hi ? .09 : .02 };
}
/* your keys: { steer: [x, y], shoot: true | false (Space down and up), pass: true | false (J), lift: true | false
   (Shift), act: 'switch' }. Returns what happened, or '' */
function hkInput(o) {
  if (!hkHandsOn() || !L) return '';
  HKI.last = HKI.now;
  if (o.steer) { HKI.steer = [clamp(+o.steer[0] || 0, -1, 1), clamp(+o.steer[1] || 0, -1, 1)]; if (HKI.steer[0] || HKI.steer[1]) { HKI.aim = HKI.steer.slice(); HKI.aimAt = HKI.now; } }
  if ('lift' in o) HKI.lift = !!o.lift;
  let r = '';
  if ('shoot' in o) {
    if (o.shoot && !HKI.shoot) { HKI.shoot = true; HKI.shootAt = HKI.now; r = hkSpaceDown(); }
    else if (!o.shoot && HKI.shoot) { HKI.shoot = false; r = GD.meter ? hkLetGo() : ''; }
  }
  if ('pass' in o) {
    if (o.pass && !HKI.pass) { HKI.pass = true; HKI.passAt = HKI.now; if (!hkPuckMine()) r = hkHandPoke(); }
    else if (!o.pass && HKI.pass) { HKI.pass = false; if (hkPuckMine() && !GD.meter) r = hkHandPass(HKI.now - HKI.passAt >= HK_HANDS.dump); }
  }
  if (o.act === 'switch') { if (GD.ph === 'live' && !hkPuckMine()) { L.me = hkNearMine(hkMe()); r = 'switch'; } }
  if (['pull', 'change', 'auto', 'timeout', 'autopow'].includes(o.act)) r = hkBenchAct(o.act);
  // Q: the power of the skater you play, for the moment; R: their ultimate
  if (o.act === 'power') r = GD.ph === 'live' && !hkCast(GD.you, hkMe()) ? 'power' : '';
  if (o.act === 'ult') r = GD.ph === 'live' && !hkCastUlt(GD.you, hkMe()) ? 'ult' : '';
  return r;
}
function hkInputClear() {
  Object.assign(HKI, { steer: [0, 0], aim: [0, 0], aimAt: -99, shoot: false, pass: false, lift: false, last: -99, oneAt: -99 });
  // (a shooter in the middle of a wind-up lets it go, free to move)
  const M = GD && GD.meter; if (M) { GD.meter = null; const p = L && L.pl[M.i]; if (p && p.act === 'wind') { p.act = ''; p.actT = 0; } }
}
function hkSpaceDown() {
  if (GD.meter) return '';
  if (GD.ph === 'drop') { if (GD.press == null) GD.press = GD.t; return 'draw'; }
  if (!hkInPlay()) return '';
  const P = L.puck, me = hkMe();
  if (hkPuckMine()) { const p = L.pl[me]; GD.meter = { i: me, t: 0 }; p.act = 'wind'; p.actT = 9; return 'wind'; }
  if (P.st === 'free' && P.k === 'pass' && P.to === me) { HKI.oneAt = HKI.now; return 'ready'; }
  const h = hkHand();
  if (GD.ph === 'live' && h >= 0 && L.pl[h].side !== GD.you) return hkHandCheck();
  return '';
}
// the wind-up moves on (07-game.js calls this each step of a live play); held too long, it goes on its own
function hkMeterStep(dt) {
  const M = GD.meter; if (!M) return;
  if (!hkInPlay() || hkHand() !== M.i) { GD.meter = null; const p = L.pl[M.i]; if (p && p.act === 'wind') { p.act = ''; p.actT = 0; } return; }
  M.t += dt;
  if (M.t >= HK_HANDS.late) hkLetGo();
}
// how hard a slap shot wound up for t seconds is: from a little over a wrist shot to the full thing
const hkPower = t => clamp(t / HK_HANDS.full, .35, 1);
function hkLetGo() {
  const M = GD.meter; GD.meter = null; if (!M) return '';
  const p = L.pl[M.i]; if (p.act === 'wind') { p.act = ''; p.actT = 0; }
  if (!hkInPlay() || hkHand() !== M.i) return '';
  const kind = M.t < HK_HANDS.tap ? 'wrist' : 'slap', aim = hkAimTarget(hkDir(p.side));
  hkRelease(M.i, kind, { aim, pow: kind === 'slap' ? hkPower(M.t) : 1 });
  GD.rel = { kind, aim, pow: kind === 'slap' ? Math.round(hkPower(M.t) * 100) / 100 : 1, t: Math.round(M.t * 1000) / 1000 };
  return kind;
}
// a pass has just landed on your stick (05-live.js): if you pressed Space for it in time, it's shot as it lands
function hkHandOneTimer(i) {
  if (!hkHandsOn() || !hkMine(i) || GD.ph !== 'live') return false;
  const e = HKI.now - HKI.oneAt; if (e > HK_HANDS.fan) return false;
  HKI.oneAt = -99;
  const clean = e <= HK_HANDS.oneT, aim = hkAimTarget(hkDir(L.pl[i].side));
  hkRelease(i, clean ? 'one' : 'wrist', { aim, pow: 1, fan: !clean });
  GD.rel = { kind: clean ? 'one' : 'fan', aim, pow: 1, t: Math.round(e * 1000) / 1000 };
  if (!clean) GD.msg = `${L.pl[i].n} is early on it, and fans on the shot.`;
  return true;
}
// a pass to the teammate you're steering toward (the one most that way, nearer breaking ties), or the best one; held,
// the puck goes hard the way you steer (up the ice when you aren't steering)
function hkHandPass(hard) {
  const h = hkHand(), p = L.pl[h], aimed = HKI.now - HKI.aimAt < HK_HANDS.aimHold + .1, [sx, sy] = HKI.steer[0] || HKI.steer[1] ? HKI.steer : aimed ? HKI.aim : [0, 0], n = hyp(sx, sy);
  if (hard) { hkSend(n ? sx / n : hkDir(p.side), n ? sy / n : (p.y < 0 ? -.5 : .5)); return 'dump'; }
  const mates = hkSk(p.side).filter(q => q !== p).map(q => L.pl.indexOf(q)); if (!mates.length) return '';
  let j;
  if (n) j = mates.map(i => { const q = L.pl[i], dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy) || 1; return [i, (dx * sx + dy * sy) / (d * n) - d * .012]; }).sort((a, b) => b[1] - a[1])[0][0];
  else j = mates.map(i => [i, hkPassValue(h, i)]).sort((a, b) => b[1] - a[1])[0][0];
  hkPass(j);
  return 'pass';
}
// your poke at the puck: up close it's the same poke the CPU makes, a little better for being yours
function hkHandPoke() {
  if (GD.ph !== 'live') return '';
  const me = hkMe(), d = L.pl[me], h = hkHand(); if (!d || d.stun > 0 || (L.pokeAt != null && HKI.now - L.pokeAt < HK_HANDS.pokeCd)) return '';
  L.pokeAt = HKI.now; d.act = 'poke'; d.actT = .25;
  if (h < 0 || L.pl[h].side === d.side || hkIsGk(L.pl[h])) return 'miss';
  const c = L.pl[h]; if (hyp(c.x - d.x, c.y - d.y) > 1.4) return 'miss';
  d.cd = .5;
  return hkPoke(d, c, .08) ? 'poke' : 'miss';
}
// your check: a lunge at the carrier. Reach them inside HK_HANDS.lunge seconds and it's a hit (05-live.js: hkLunge)
function hkHandCheck() {
  const me = hkMe(), d = L.pl[me], h = hkHand(); if (!d || d.stun > 0 || L.lunge || (L.hitAt != null && HKI.now - L.hitAt < HK_HANDS.hitCd)) return '';
  const c = L.pl[h]; if (hkIsGk(c)) return '';
  L.hitAt = HKI.now;
  // (straight at where the carrier is going, at a little over top speed)
  const dx = c.x + c.vx * .15 - d.x, dy = c.y + c.vy * .15 - d.y, dist = hyp(dx, dy) || 1, v = hkTop(d, -1) * 1.15;
  d.vx = dx / dist * v; d.vy = dy / dist * v;
  d.act = 'hit'; d.actT = HK_HANDS.lunge; d.cd = HK_HANDS.lunge + .1;
  L.lunge = { i: me, t: HK_HANDS.lunge };
  return 'check';
}
// the lunge runs (each step): contact with the carrier is a hit, settled as any body check; time out and you've missed
function hkLunge(dt) {
  const U = L.lunge; if (!U) return;
  const d = L.pl[U.i], h = hkHand(), c = h >= 0 ? L.pl[h] : null;
  if (c && c.side !== d.side && !hkIsGk(c)) {
    const dx = c.x - d.x, dy = c.y - d.y, dist = hyp(dx, dy);
    if (dist < 1.05) { L.lunge = null; const closing = ((d.vx - c.vx) * dx + (d.vy - c.vy) * dy) / (dist || 1); return hkHit(d, c, Math.max(closing, 3.5) + 1); }
  }
  if ((U.t -= dt) > 0) return;
  L.lunge = null; d.stun = .3; hkEv('hitmiss', d.n, c ? c.n : '');
  // you ran into somebody who doesn't have the puck: interference, more often than not
  const [o, od] = hkNearest(d.x, d.y, hkSk(1 - d.side).filter(q => L.pl.indexOf(q) !== h));
  if (o && od < .9 && R() < HK_FOUL.interfere) hkFoul(d, 'interference', o);
}
/* your press at the face-off, as an edge on the roll: in the last HK_HANDS.drop seconds before the puck lands, up to
   +.3 (the closer the better); earlier, you've jumped it: -.15. No press: 0. */
function hkDrawEdge() {
  if (!hkHandsOn() || GD.press == null) return 0;
  const e = HK_PACE.drop - GD.press;
  return e <= HK_HANDS.drop ? .08 + (1 - e / HK_HANDS.drop) * .22 : -.15;
}
/* the bench's calls, yours in Manage as in You play: 'pull' (the goalie off for an extra skater, or back), 'change'
   (your tired skaters off now), 'auto' (the coach changes your lines, or leaves them to you), 'timeout'. Returns what
   happened, or '' */
function hkBenchAct(act) {
  if (!GD || GD.mode === 'watch') return '';
  if (act === 'pull') return hkHandPull();
  if (act === 'change') return GD.ph === 'live' && hkChangeNow(GD.you) ? 'change' : '';
  if (act === 'auto') { GD.auto = !GD.auto; return GD.auto ? 'auto' : 'manual'; }
  if (act === 'timeout') return hkTimeout(GD.you) ? '' : 'timeout';
  if (act === 'autopow') { GD.autoPow = !GD.autoPow; return GD.autoPow ? 'autopow' : 'handpow'; }
  return '';
}
// your goalie, pulled for an extra skater or sent back (G): only in a live play, and not while they hold the puck
function hkHandPull() {
  if (GD.ph !== 'live') return '';
  const g = L.pl[hkGk(GD.you)];
  if (g.pulled) { if (g.pulled === 'delay') return ''; g.pulled = false; hkEv('back', g.n); GD.msg = `${g.n} is back in the net.`; return 'back'; }
  return hkPull(GD.you, 'hand') ? 'pull' : '';
}
/* in the shootout, with the CPU shooting, the goalie is yours while you steer them: up and down the screen along the
   goal line, as fast as they can move, with no moment's lag. Let go and they play it themselves. Returns where they
   are going, or null */
function hkGoalieHand(g) {
  if (GD.ph !== 'so' || !hkHandsOn() || g.side !== GD.you || !hkActive() || !HKI.steer[1]) return null;
  const [x] = hkGoalSpot(g.side, L.puck.x, L.puck.y);
  return [x, clamp(g.y + HKI.steer[1] * 2, -HK_RULES.net, HK_RULES.net)];
}
function hkSetMode(m) {
  if (!GD || !['watch', 'manage', 'play'].includes(m)) return GD ? GD.mode : null;
  GD.mode = m; hkInputClear();
  return m;
}
