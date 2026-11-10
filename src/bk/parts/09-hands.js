/* The Charter Court: by hand (issue #77, phase 2). In 'play' (GD.mode) you play your side (GD.you): on offense
   whoever has the ball, on defense the player you're on (L.me: the one nearest the ball, until you switch).
   Offense:
   - steer them (WASD); let go of everything for BK_HANDS.idle seconds and they play on their own, as the CPU would;
   - shoot (Space): hold to rise, let go at the top. The release meter shows the window: its width comes from the look
     (bkShotP: distance, touch, the contest; the hot hand widens it). Dead on the top is a swish; in the window, better
     than the CPU would shoot it; just outside, it may still go in off the rim; well off, it won't (bkHandMake). Hold
     too long and it goes up late on its own;
   - pass (J): a tap passes to the teammate you're steering toward (or the best look when you aren't); held, it's a lob;
   - the pick (E): the nearest big screens your man (bkPick);
   - moves: a crossover (Q) or a spin (R) on the nearest defender: your handle against their defense; a spin beats them
     by more and risks more, and a bad one gets the ball picked (bkMoveTry, which the CPU uses too).
   Free throws: your shooter waits at the line for Space, held and let go on the meter (touch only: no contest).
   Defense:
   - steer your player; swipe (J) at the ball (a steal, or a foul if you miss up close); jump (Space) to contest or
     block, in time with the shot (just before the release: early and you land off balance; late, on a ball coming
     down at the rim, it's goaltending: the basket counts); hold Shift to box out for the rebound; E switches you to
     the next player nearest the ball.
   BKI is your keys (not saved). */
const BK_HANDS = { idle: 2, lob: .25, late: 1.45, ftWait: 6, moveCd: .9, swipeCd: .7 };
// the window: its width as a share of the rise (min, per point of the look, on fire), the swish's share of it
const BK_WIN = { min: .1, per: .3, fire: .06, perfect: .35 };
const BKI = { steer: [0, 0], aim: [0, 0], aimAt: -99, shoot: false, pass: false, passAt: 0, box: false, last: -99, now: 0 };
const bkHandsOn = () => !!GD && GD.mode === 'play';
// you're at the keys: something pressed or held in the last few seconds
const bkActive = () => bkHandsOn() && (BKI.now - BKI.last < BK_HANDS.idle || BKI.shoot || BKI.pass || BKI.box || !!(BKI.steer[0] || BKI.steer[1]));
// the player you play now (an index in L.pl), or -1
function bkMe() {
  if (!L || !bkHandsOn()) return -1;
  const h = bkHand(), you = GD.you;
  if (h >= 0 && L.pl[h].side === you) return h;
  if (L.ball.st === 'pass' && L.pl[L.ball.from] && L.pl[L.ball.from].side === you && L.pl[L.ball.to].side === you) return L.ball.to;
  if (!(L.me >= 0) || L.pl[L.me].side !== you) L.me = bkNearMine(-1);
  return L.me;
}
// your player nearest the ball, after the one at `after` in that order (E: switch)
function bkNearMine(after) {
  const B = L.ball, mine = L.pl.map((p, i) => i).filter(i => L.pl[i].side === GD.you).sort((a, b) => hyp(L.pl[a].x - B.x, L.pl[a].y - B.y) - hyp(L.pl[b].x - B.x, L.pl[b].y - B.y));
  const k = mine.indexOf(after); return mine[(k + 1) % mine.length];
}
// is player i yours and are you playing them right now (so the CPU keeps its hands off)
const bkYoursNow = i => i >= 0 && bkActive() && bkMe() === i;
// where your player goes while you steer: a couple of metres the way you push
function bkSteerAim(p, i) {
  if (!bkYoursNow(i)) return null;
  const [sx, sy] = BKI.steer, n = hyp(sx, sy); if (!n) return null;
  return [p.x + sx / n * 2.5, p.y + sy / n * 2.5];
}
const bkWindow = (pr, p) => BK_WIN.min + BK_WIN.per * pr + (p && bkOnFire(p) ? BK_WIN.fire : 0) + (p ? bkGxOf(p).win || 0 : 0);
// a shot let go e from the top (a share of the rise): dead on is a swish, in the window better than the CPU's look,
// just outside it might drop off the rim, well off it won't
// a release e from the top with window w: the tiers, by { perfect: [add, cap], good: [add, cap], off: share, way: odds }
const BK_SHOT_TIMED = { perfect: [.35, .97], good: [.15, .95], off: .55, way: .04 }, BK_FT_TIMED = { perfect: [.2, .98], good: [.08, .96], off: .5, way: .05 };
function bkTimed(pr, e, w, T) { return e <= w * BK_WIN.perfect ? Math.min(T.perfect[1], pr + T.perfect[0]) : e <= w / 2 ? Math.min(T.good[1], pr + T.good[0]) : e <= w ? pr * T.off : T.way; }
const bkHandMake = (pr, e, p) => bkTimed(pr, e, bkWindow(pr, p), BK_SHOT_TIMED);
// the box-out: your player holding Shift gets more of the rebounds near them, and anyone within a stride or two of them less
function bkBoxOut(p) {
  if (!BKI.box || !bkHandsOn()) return 1;
  const me = L.pl[bkMe()]; if (!me) return 1;
  if (me === p) return 1.6;
  return p.side !== me.side && hyp(p.x - me.x, p.y - me.y) < 1.8 ? .6 : 1;
}
/* your keys: { steer: [x, y], shoot: true | false (Space down and up), pass: true | false (J), box: true | false
   (Shift), act: 'pick' | 'cross' | 'spin' | 'switch' }. Returns what happened, or '' */
function bkInput(o) {
  if (!bkHandsOn() || !L) return '';
  BKI.last = BKI.now;
  if (o.steer) { BKI.steer = [clamp(+o.steer[0] || 0, -1, 1), clamp(+o.steer[1] || 0, -1, 1)]; if (BKI.steer[0] || BKI.steer[1]) { BKI.aim = BKI.steer.slice(); BKI.aimAt = BKI.now; } }
  if ('box' in o) BKI.box = !!o.box;
  let r = '';
  if ('shoot' in o) { BKI.shoot = !!o.shoot; r = o.shoot ? bkSpaceDown() : bkSpaceUp(); }
  if ('pass' in o) {
    if (o.pass && !BKI.pass) { BKI.pass = true; BKI.passAt = BKI.now; if (!bkOffenseMine()) r = bkSwipe(); }
    else if (!o.pass && BKI.pass) { BKI.pass = false; if (bkOffenseMine()) r = bkHandPass(BKI.now - BKI.passAt >= BK_HANDS.lob); }
  }
  if (o.act) r = bkHandAct(o.act);
  return r;
}
function bkInputClear() {
  Object.assign(BKI, { steer: [0, 0], aim: [0, 0], aimAt: -99, shoot: false, pass: false, box: false, last: -99 });
  // (a shooter halfway up comes back down, free to move)
  const M = GD && GD.meter; if (M && GD.ph !== 'ft') { GD.meter = null; const p = L && L.pl[M.i]; if (p && p.act === 'rise') { p.act = ''; p.actT = 0; } }
}
// you have the ball, in a live play
const bkOffenseMine = () => GD.ph === 'live' && bkHand() >= 0 && bkHand() === bkMe();
function bkSpaceDown() {
  if (GD.meter) return '';
  // at the line
  if (GD.ph === 'ft' && GD.ft && GD.ft.side === GD.you) { GD.meter = { t: 0, T: .7, ft: true }; return 'rise'; }
  if (GD.ph !== 'live') return '';
  if (bkOffenseMine()) {
    const p = L.pl[bkHand()], d = bkRimDist(p.side, p.x, p.y);
    if (L.shot) return '';
    GD.meter = { t: 0, T: d < 1.6 ? .38 : .5 + Math.min(d, 9) * .02, i: bkHand(), pr: bkShotP(p, p.x, p.y).p };
    p.act = 'rise'; p.actT = 9; L.drive = false;
    return 'rise';
  }
  // (your side has it, in the air or loose: nothing to jump at)
  if (G.poss === GD.you) return '';
  return bkJump();
}
function bkSpaceUp() { return GD.meter ? bkLetGo() : ''; }
// the meter moves on (07-game.js calls this each step of a live play or a free throw); held too long, it goes up late
function bkMeterStep(dt) {
  const M = GD.meter; if (!M) return;
  if (!M.ft && (GD.ph !== 'live' || bkHand() !== M.i)) { GD.meter = null; if (L.pl[M.i] && L.pl[M.i].act === 'rise') L.pl[M.i].act = ''; return; }
  M.t += dt;
  // (the window follows the look: a defender closing out during the rise narrows it)
  if (!M.ft) { const p = L.pl[M.i]; M.pr = bkShotP(p, p.x, p.y).p; }
  if (M.t / M.T >= BK_HANDS.late) bkLetGo();
}
function bkLetGo() {
  const M = GD.meter; GD.meter = null; if (!M) return '';
  const e = Math.abs(M.t / M.T - 1);
  GD.rel = { e: Math.round(e * 1000) / 1000, w: M.ft ? bkFtWindow(L.pl[GD.ft ? GD.ft.i : 0]) : bkWindow(M.pr, L.pl[M.i]), at: null };
  if (M.ft) { if (GD.ph === 'ft') bkFreeThrow({ e }); return 'ft'; }
  if (GD.ph !== 'live' || bkHand() !== M.i) return '';
  L.pl[M.i].act = '';
  bkShoot({ e });
  return 'shot';
}
// a pass to the teammate you're steering toward (the one most that way, nearer breaking ties), or the best look. The
// way you last pushed while J was down (or just before) counts, so letting go of the direction first doesn't lose it
function bkHandPass(lob) {
  const h = bkHand(), p = L.pl[h], aimed = BKI.aimAt >= BKI.passAt - .5, [sx, sy] = BKI.steer[0] || BKI.steer[1] ? BKI.steer : aimed ? BKI.aim : [0, 0], n = hyp(sx, sy);
  const mates = bkOffense().filter(q => q !== p).map(q => L.pl.indexOf(q));
  let j;
  if (n) j = mates.map(i => { const q = L.pl[i], dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy) || 1; return [i, (dx * sx + dy * sy) / (d * n) - d * .015]; }).sort((a, b) => b[1] - a[1])[0][0];
  else j = mates.map(i => [i, bkPassValue(h, i)]).sort((a, b) => b[1] - a[1])[0][0];
  bkPass(j, lob);
  return lob ? 'lob' : 'pass';
}
function bkHandAct(k) {
  if (GD.ph !== 'live') return '';
  if (k === 'switch') { if (bkOffenseMine()) return ''; L.me = bkNearMine(bkMe()); return 'switch'; }
  if (!bkOffenseMine()) return '';
  if (k === 'pick') return bkPick(bkHand()) ? 'pick' : '';
  if (k === 'cross' || k === 'spin') return bkMoveTry(bkHand(), k);
  return '';
}
/* a move on the nearest defender (within reach): your handle against their defense. It works: they're left behind (a
   spin by more). It doesn't: a spin is picked more often than a crossover; otherwise you lose a step. Returns 'beat',
   'stripped', 'stumble' or '' (nothing to beat, or too soon after the last) */
const BK_MOVES = { cross: { n: 'crossover', beat: .42, stun: .55, strip: .16 }, spin: { n: 'spin', beat: .5, stun: .75, strip: .3 } };
function bkMoveTry(h, k) {
  const p = L.pl[h], M = BK_MOVES[k];
  if (!p || !M || L.moveCd > 0) return '';
  L.moveCd = BK_HANDS.moveCd;
  const [d, dd] = bkNearest(p.x, p.y, bkDefense().filter(q => q.stun <= 0));
  if (!d || dd > 1.6) return '';
  bkStamCost(p, BK_STAM.move * (bkGxOf(p).move || 1));
  if (R() < clamp(M.beat + (p.r.hnd - 2 * bkTired(p) - d.r.def) * .06, .1, .88) + bkFx('beat')) { d.stun = M.stun; bkEv('beat', p.n, d.n); GD.msg = `${p.n}'s ${M.n} leaves ${d.n} behind.`; L.drive = true; return 'beat'; }
  if (R() < M.strip * clamp(1 + (d.r.def - p.r.hnd) * .1, .4, 2)) { GD.msg = `${p.n} tries a ${M.n}, and ${d.n} picks it.`; bkPicked(d); return 'stripped'; }
  p.stun = .25; GD.msg = `${p.n}'s ${M.n} doesn't fool ${d.n}.`; return 'stumble';
}
// your swipe at the ball: a steal by your defense against their handle (better while they rise to shoot); a miss up
// close may be a foul, and either way it leaves you off balance
function bkSwipe() {
  if (GD.ph !== 'live') return '';
  const me = bkMe(), d = L.pl[me], h = bkHand(); if (!d || L.swipeAt != null && BKI.now - L.swipeAt < BK_HANDS.swipeCd) return '';
  L.swipeAt = BKI.now;
  if (h < 0 || L.pl[h].side === d.side) return '';
  const p = L.pl[h], dd = hyp(p.x - d.x, p.y - d.y);
  if (dd <= 1.2 && R() < clamp(.14 + (d.r.def - p.r.hnd) * .03 + (p.act === 'rise' ? .1 : 0), .03, .4)) { bkPicked(d); return 'steal'; }
  if (dd < .9 && R() < .3) { bkReach(d); return 'foul'; }
  d.stun = .25; return 'miss';
}
// your jump: in the air for half a second. A shot going up now meets it (bkShoot); a ball already coming down at the
// rim is goaltending, and counts; nothing to meet and you land off balance
function bkJump() {
  const me = bkMe(), d = L.pl[me]; if (!d || d.act === 'jump' || d.stun > 0) return '';
  d.act = 'jump'; d.actT = .55; d.jumpAt = L.t; d.early = 1;
  const B = L.ball, S = L.shot;
  if (S && B.st === 'shot' && S.side !== d.side && !S.block && B.t / B.T > .5 && bkRimDist(S.side, d.x, d.y) < 1.3) {
    // (the basket counts; a foul on the shot still stands, on whoever made it)
    d.early = 0; S.goaltend = true; S.gt = me; S.made = true;
    bkEv('goaltend', d.n); return 'goaltend';
  }
  return 'jump';
}
