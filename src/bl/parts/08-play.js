/* The Saltmere Lanes: the game on show, and bowling it by hand (issue #100, phase 2). GP is the game on the page (not
   saved; G is the game). The same turn as the sim (07-game.js), a beat at a time so it can be watched (GP.ph):
   - next: whose ball (blUp). Your side's in You play: aim. The CPU's: it sets up (addr) and bowls.
   - aim: your ball, set up. It starts on the coach's suggestion (a Knight's read of the lane): where you stand (the
     board you release from), the arrow you roll over (15 feet down), the ball (strike or spare) and the revs (less,
     normal or more). Change any of them (blSelect), and the guide line shows where a perfect ball goes on a fresh lane:
     the oil moves as the game goes, so it is a guide, not a promise. Space (blPress) starts the approach.
   - swing: the release meter (BL_METER), three presses: start; the speed, at the top (the yellow line is the bowler's
     own speed; past it, to the red end, is a power ball: faster, more revs, and a smaller mark); then the mark at the
     foul line on the way down. Early on the mark pulls the ball (a right-hander's to the left), late pushes it, by
     how much you missed; inside the mark it goes nearly where it was aimed. Miss the mark altogether and the ball is
     released late at the bottom. On a phone, drag up from the bowler and let go (blDrag): the pull is the speed, and
     a pull off straight is the miss. Both give the same two numbers.
   - roll: the ball down the lane, then the pins (GP.anim); the ball is counted when it leaves the hand (blBowlBall),
     and the picture catches up.
   - rest: a beat to read it; over: the end.
   In Watch the CPU bowls both sides. GP.msg is the last thing that happened, said plainly. BL_HOOK's onPhase, onPick
   and onOver hear a new beat, a change to your ball and the end. */
const BL_METER = { rise: .95, top: 1.1, fall: 1.25, low: -.22, win: .045, pwin: .6, inDeg: .14, outDeg: 2.6 };
const BL_PACE = { addr: .8, rest: 1.1, mark: 1.9, strike: 2.3, lane: 2.3, over: 2.6 };
const BL_REVS = { less: .8, normal: 1, more: 1.2 };
const BL_HANDS = { drag: 220, dragDeg: 10, bend: 14 };
const BL_HOOK = { onPhase: null, onPick: null, onOver: null, onChart: null, onCommit: null };
const BL_MODES = ['watch', 'manage', 'play'];
let GP = null;

function blPlayStart(o) {
  GP = { mode: o && BL_MODES.includes(o.mode) ? o.mode : 'watch', you: 0, ph: 'next', t: 0, wait: 0, msg: '', sel: null, meter: null, anim: null, cpu: null, streak: [0, 0], said: '',
    mgr: { line: 'auto', tempo: 'auto', weight: 'auto' }, autoPow: !(o && o.autoPow === false) };
  BLC.tracks = [[], []]; BLC.camY = -40; GP.tracks = [[], []];
  GP.msg = `${G.teams[0].name} against ${G.teams[1].name}: ${G.frames} frames, the Baker format. ${G.teams[G.lead].name} bowl first.`;
  // (the Umbral's hexes, named before the first frame: 16-umbral.js)
  if (G.hex) GP.msg += ` ${blHexLine()}.`;
}
function blGo(ph, wait, msg) {
  if (msg != null) GP.msg = msg;
  GP.ph = ph; GP.t = 0; GP.wait = wait || 0;
  if (BL_HOOK.onPhase) try { BL_HOOK.onPhase(ph); } catch (e) { console.error(e); }
}
// a choice a reload must not take back (a ball's speed pressed, the coach's word, the pinch bowler, the re-rack, a power
// cast): onCommit hears it, so the page can keep the game as it stands (issue #120)
function blCommit() { if (BL_HOOK.onCommit) try { BL_HOOK.onCommit(); } catch (e) { console.error(e); } }
const blName = (s, ri) => (G.teams[s].roster[ri] || {}).n || 'Someone';
const blYours = s => GP && GP.mode === 'play' && s === GP.you;

/* ---------- your ball: the setup ---------- */
// the coach's suggestion, as a setup: a Knight's plan for this ball, in boards
function blSelFromPlan(plan) {
  return { stand: +blXBoard(plan.x0).toFixed(1), arrow: +blXBoard(plan.x0 + Math.tan(plan.ang * Math.PI / 180) * BL_LANE.arrows).toFixed(1), ball: plan.ball, revs: 'normal' };
}
function blSuggest(s) { const k = G.skill[s]; G.skill[s] = 1; const p = blPlan(s); G.skill[s] = k; return p; }
function blSelReset() { GP.sel = blSelFromPlan(blSuggest(GP.you)); GP.meter = null; }
// change your setup: { stand, arrow, ball, revs } (boards are kept on the lane, to a tenth); and the call: { line,
// split, tempo, weight: 'heavy' | 'light', word: true, pinch: ri } (a new line, split or word puts the coach's
// suggestion for it on your setup; the word and the pinch bowler are once a game, before a frame's first ball for the
// pinch). Returns false, or a reason a part of it couldn't be done (a string), or true
function blSelect(o) {
  if (!GP || GP.ph !== 'aim' || !GP.sel) return false;
  const S = GP.sel, b = v => clamp(Math.round(v * 10) / 10, 1, BL_LANE.boards), s = GP.you;
  let why = '', again = false, spent = false;
  if (o.stand != null) S.stand = b(o.stand);
  if (o.arrow != null) S.arrow = b(o.arrow);
  if (o.ball === 'strike' || o.ball === 'spare') S.ball = o.ball;
  if (BL_REVS[o.revs]) S.revs = o.revs;
  if (BL_LINES[o.line] && G.stand[s].length === 10) { G.line[s] = o.line; again = true; }
  if (o.split === 'safe' || o.split === 'convert') { G.split[s] = o.split; again = true; }
  if (o.tempo === 'quick' || o.tempo === 'steady') G.stance[s].tempo = o.tempo;
  if (o.weight === 'heavy' || o.weight === 'light') { G.stance[s].ball = o.weight; again = true; }
  if (o.word) { if (G.word[s] > 0 && !G.wordOn[s]) { G.word[s]--; G.wordOn[s] = true; again = spent = true; } else why = G.wordOn[s] ? 'The coach\'s word is on for this ball.' : 'One coach\'s word a game.'; }
  if (o.rerack) { const r = blRerack(s); if (r.ok) { if (G.offspot) G.offspot[s] = null; GP.msg = 'Moll sets the rack again, every pin on its spot.'; spent = true; } else why = r.why; }
  if (o.pinch != null) { const r = blPinch(s, o.pinch); if (r.ok) { again = spent = true; GP.msg = `${blName(s, o.pinch)} bowls this frame for ${blName(s, r.for)}.`; } else why = r.why; }
  if (o.suggest) GP.sel = blSelFromPlan(blSuggest(s));
  else if (again) GP.sel = Object.assign(blSelFromPlan(blSuggest(s)), { revs: S.revs });
  if (BL_HOOK.onPick) try { BL_HOOK.onPick(); } catch (e) { console.error(e); }
  if (spent) blCommit();
  return why || true;
}
// cast one of your side's powers before your ball: k 'pow', 'ult', 'steady' or a situation power. '' or why not
function blCastMine(k) {
  if (!GP || GP.mode !== 'play' || GP.ph !== 'aim') return 'Only while you set up your ball.';
  const why = blCast(GP.you, k); if (why) return why;
  const c = G.casts[G.casts.length - 1]; GP.msg = `${c.n}!` + (k === 'ult' ? ` ${G.mark.n} marks this frame.` : '');
  // a power that changes the ball (more hook) changes the coach's setup too
  GP.sel = Object.assign(blSelFromPlan(blSuggest(GP.you)), { revs: GP.sel.revs });
  if (BL_HOOK.onPick) try { BL_HOOK.onPick(); } catch (e) { console.error(e); }
  blCommit();
  return '';
}
// a setup and a release (p the speed on the meter, err how far off the mark) as a throw the ball model takes
// (win: the mark's half-width for this bowler now, before a power ball shrinks it)
function blSelThrow(S, st, p, err, win0) {
  const x0 = blBoardX(S.stand), ax = blBoardX(S.arrow);
  let ang = Math.atan((ax - x0) / BL_LANE.arrows) * 180 / Math.PI;
  const power = Math.max(0, p - 1), M = BL_METER, win = (win0 || M.win) * (power > 0 ? M.pwin : 1);
  if (err) { const a = Math.abs(err), deg = a <= win ? a / win * M.inDeg : M.inDeg + (a - win) * M.outDeg; ang += Math.sign(err) * st.hand * deg; }
  const mph = st.mph * (.8 + .2 * Math.min(1, p)) * (1 + power * 1.2), rpm = Math.round(st.rpm * BL_REVS[S.revs] * (1 + power * .5));
  return { x0, ang: +ang.toFixed(4), mph: +mph.toFixed(2), rpm, ball: S.ball, hand: st.hand, power: power > 0 };
}
// the guide: where a perfect ball from this setup goes on a fresh lane
function blGuide() {
  if (!GP || !GP.sel) return null;
  const s = GP.you, st = blStyleNow(s, blBowler(s));
  return blBall(blSelThrow(GP.sel, st, 1, 0), G.wordOn[s] ? G.oil[blLane(s)] : G.oil0, G.tide);
}

/* ---------- the meter ---------- */
// your mark now: wider for an accurate bowler (a spare bowler, at a spare), narrower for a tired arm or a big moment;
// and the meter falls quicker under pressure
function blMeterFor(s) {
  const ri = blBowler(s), r = blRat(s, ri), spare = G.stand[s].length < 10, fx = blFxFor(s), pr = fx.nerve ? 0 : blPressure(s) * blKitPress(s, ri);
  const win = BL_METER.win / Math.sqrt(blRateErr(r, spare)) / blArmK(G.arm ? G.arm[s][ri] : 1) / blNerveK(pr, r.nrv);
  const tm = BL_STANCE[blStanceOf(s).tempo].meter;
  return { win: +(win / blCallErr(s) / fx.err / blKitErr(s, ri)).toFixed(4), fall: BL_METER.fall * (1 + .25 * pr) * tm, rise: BL_METER.rise * tm, shake: pr * (1 - r.nrv) };
}
function blPress() {
  if (!GP || GP.mode !== 'play') return false;
  if (GP.ph === 'aim') { GP.meter = Object.assign({ st: 'up', v: 0, p: null }, blMeterFor(GP.you)); blGo('swing', 0, `${blName(GP.you, blBowler(GP.you))} on the approach…`); return true; }
  if (GP.ph !== 'swing' || !GP.meter) return false;
  const M = GP.meter;
  if (M.st === 'up') { M.p = M.v; M.st = 'down'; blCommit(); return true; }
  if (M.st === 'down') { blRelease3(M.v); return true; }
  return false;
}
function blMeterTick(dt) {
  const M = GP.meter, K = BL_METER; if (!M) return;
  if (M.st === 'up') { M.v += (M.rise || K.rise) * dt; if (M.v >= K.top) { M.v = K.top; M.p = K.top; M.st = 'down'; blCommit(); } }
  else if (M.st === 'down') { M.v -= (M.fall || K.fall) * dt; if (M.v <= K.low) blRelease3(K.low); }
}
// the third press (or the bottom of the meter): the ball leaves the hand
function blRelease3(v) {
  const M = GP.meter; if (!M || M.st === 'gone') return;
  M.st = 'gone'; M.err = v;
  blFireMine(M.p == null ? 1 : M.p, v);
}
// a phone's throw: pull is the speed (1 the bowler's own), deg how far off straight the pull went (plus is early)
function blDrag(pull, deg) {
  if (!GP || GP.mode !== 'play' || GP.ph !== 'aim') return false;
  const F = blMeterFor(GP.you), p = clamp(pull, .3, BL_METER.top), err = deg / BL_HANDS.dragDeg * BL_METER.win;
  GP.meter = Object.assign(F, { st: 'gone', v: err, p, err });
  blFireMine(p, err);
  return true;
}
// the two numbers behind your release: { p, err, win }
function blSwingNums() { const M = GP && GP.meter; if (!M) return null; const p = M.p == null ? M.v : M.p; return { p, err: M.err == null ? null : M.err, win: (M.win || BL_METER.win) * (p > 1 ? BL_METER.pwin : 1) }; }
function blFireMine(p, err) {
  const s = GP.you, st = blStyleNow(s, blBowler(s)), S = GP.sel, win = GP.meter && GP.meter.win, rel = blSelThrow(S, st, p, err, win);
  const plan = { x0: rel.x0, ang: blSelThrow(S, st, p, 0, win).ang, ball: S.ball, aim: { x: blBoardX(S.arrow), y: BL_LANE.arrows }, why: 'yours' };
  blFire(s, plan, rel);
}

/* ---------- a ball bowled: down the lane, into the pins ---------- */
function blFire(s, plan, rel) {
  const before = G.stand[s].slice(), spots = G.hall ? blHallSpots(s) : null, ev = blBowlBall(s, plan, rel), B = GB;
  const v = Math.max(10, rel.mph) * BL_MPH, tLane = clamp(BL_LANE.len / v * 1.0, 1.4, 3.2) * (BL_PACE.lane / 2.3);
  const last = B.deck.trace.length ? B.deck.trace[B.deck.trace.length - 1][0] : 0;
  GP.anim = { s, path: B.ball.path, gutter: B.ball.gutter, trace: B.deck.trace, before, spots, tLane, tDeck: B.ball.gutter === null ? Math.max(.6, last + .35) : .6, t: 0 };
  GP.last = ev;
  GP.said = (B.said ? B.said + ' ' : '') + blSay(s, ev, before) + (B.tide ? ' ' + B.tide : '');
  blGo('roll', 0, `${blName(s, ev.ri)} (${G.teams[s].short || G.teams[s].name}) bowls…`);
}
// what happened, said plainly: a strike (a double, a turkey), a spare, a split, the gutter, or the count and the leave
function blSay(s, ev, before) {
  const R = ev.roll, nm = blName(s, ev.ri);
  if (R.strike) GP.streak[s]++; else GP.streak[s] = 0;
  const left = before.filter(p => !R.pins.includes(p)), ls = left.join('-');
  let t;
  if (R.strike) t = GP.streak[s] >= 3 ? `TURKEY! ${nm}: ${GP.streak[s] > 3 ? GP.streak[s] + ' strikes in a row' : 'three strikes in a row'}.` : GP.streak[s] === 2 ? `A double! ${nm} strikes again.` : `Strike! ${nm}.`;
  else if (R.spare) t = left.length === 0 && before.length > 1 && blIsSplit(before) ? `${nm} converts the ${before.join('-')} split!` : `Spare. ${nm} picks up the ${before.join('-')}.`;
  else if (ev.ball.gutter !== null) t = `${nm}: in the gutter.`;
  else if (before.length === 10) t = R.split ? `${R.n}, and a split: the ${ls}.` : `${nm}: ${R.n}, the ${ls} left.`;
  else t = `${nm}: ${R.n ? R.n + ' more' : 'nothing'}${R.done ? ', an open frame' : ''}.`;
  if (R.rolloff) t += ' Level after the last frame: a roll-off, the 9th and the 10th again.';
  if (R.over) t += ` ${G.teams[R.over.win].name} win, ${G.over.text}.`;
  else if (R.done) t += ` ${G.teams[s].short || G.teams[s].name} ${blTotal(s)}.`;
  return t;
}
// where the ball is drawn now, { x, y } in lane inches (null when nothing is moving), and the pins (from the trace)
function blAnimNow() {
  const A = GP && GP.anim; if (!A || GP.ph !== 'roll') return null;
  if (A.t < A.tLane) {
    const P = A.path, f = clamp(A.t / A.tLane, 0, 1) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(f)), u = f - i;
    if (P.length < 2) return { ball: { x: P[0][0], y: P[0][1] }, pins: null };
    return { ball: { x: lerp(P[i][0], P[i + 1][0], u), y: lerp(P[i][1], P[i + 1][1], u) }, pins: null, lane: true };
  }
  const T = A.trace, dt = A.t - A.tLane; if (!T.length) return { ball: A.gutter !== null ? null : null, pins: null };
  let k = 0; while (k < T.length - 1 && T[k + 1][0] <= dt) k++;
  const fr = T[k];
  return { ball: { x: fr[1][0], y: fr[1][1] }, pins: fr[2], lane: false };
}

/* ---------- the beat ---------- */
function blTick(dt) {
  if (!GP || !G || !G.teams) return;
  GP.t += dt;
  const P = GP.ph;
  if (P === 'next') blPlayNext();
  else if (P === 'addr') { if (GP.t >= BL_PACE.addr) { const c = GP.cpu; GP.cpu = null; blFire(c.s, c.plan, c.rel); } }
  else if (P === 'swing') blMeterTick(dt);
  else if (P === 'roll') { const A = GP.anim; A.t += dt; if (A.t >= A.tLane + A.tDeck) blAnimDone(); }
  else if (P === 'rest') { if (GP.t >= GP.wait) blGo(G.over ? 'over' : 'next'); }
}
function blPlayNext() {
  const s = blUp();
  // (a game kept after the ball that decided it, and resumed, says its end here: a game played on says it as that
  // ball comes to rest, blAnimDone, and goes from its rest to over, never through next)
  if (s < 0) { blGo('over'); if (G.over && BL_HOOK.onOver) try { BL_HOOK.onOver(blSummary()); } catch (e) { console.error(e); } return; }
  const ri = blBowler(s), fr = blFrameNo(s), now = blSheet(s)[blCur(s)] || [], tenth = blCur(s) === blSheetN() - 1;
  const ball = !now.length ? 'first ball' : tenth && (now.length === 2 || now[0] === 10) ? 'fill ball' : 'second ball';
  const chant = G.rb[s] === 0 && G.stand[s].length === 10 && GP.streak[s] === 2 ? 'The gallery chants: TUR-KEY! TUR-KEY! ' : '';
  const off = (G.hall && G.offspot && G.offspot[s] && G.rb[s] === 0 && G.stand[s].length === 10 ? `Moll has set the ${G.offspot[s].n} a touch off its spot. ` : '') + (G.hex ? blHexSay(s) : '');
  if (GP.mode === 'manage' && s === GP.you) { const said = [blManageCall(s)].concat(GP.autoPow ? blCpuPower(s) : []).filter(Boolean).join(', '), plan = blPlan(s), rel = blRelease(plan, s), who = blBowler(s);
    GP.cpu = { s, plan, rel }; blGo('addr', 0, `${chant}${off}Frame ${fr}: ${blName(s, who)}, ${ball}, going for ${plan.why}${said ? ` (${said})` : ''}.`); return; }
  if (blYours(s)) { blSelReset(); blGo('aim', 0, `${chant}${off}${blTurnBall(s) ? 'The turn: the lanes are re-read, and the chart shows all the oil for this ball. ' : ''}Frame ${fr}, your ${ball}: ${blName(s, ri)} is up. Set your feet and your arrow, then Space.`); return; }
  const said = [blCpuCall(s), blCpuPotion(s)].concat(blCpuPower(s)).filter(Boolean).join(', '), plan = blPlan(s), rel = blRelease(plan, s), who = blBowler(s);
  GP.cpu = { s, plan, rel };
  blGo('addr', 0, `${chant}${off}Frame ${fr}: ${blName(s, who)} (${G.teams[s].name}), ${ball}, going for ${plan.why}${said ? ` (${said})` : ''}.`);
}
function blAnimDone() {
  const over = !!G.over, R = GP.last && GP.last.roll;
  GP.msg = GP.said || GP.msg;
  blTrackKeep();
  // Moll's glass plays a cartoon of a mark (15-screen.js): a strike's longest, a spare, a split or the gutter a little less
  const mark = R && (R.spare || R.split || (GP.last.ball && GP.last.ball.gutter != null));
  blGo('rest', over ? BL_PACE.over : R && R.strike ? BL_PACE.strike : mark ? BL_PACE.mark : BL_PACE.rest);
  if (over && BL_HOOK.onOver) try { BL_HOOK.onOver(blSummary()); } catch (e) { console.error(e); }
}
// Manage: your captain bowls your side by your call (GP.mgr: the line, the tempo and the ball, each 'auto' for the
// captain's own); the rest of the call is the captain's, as a Knight's
function blManageCall(s) {
  const M = GP.mgr, said = blCpuCall(s);
  if (M.line !== 'auto' && G.stand[s].length === 10) G.line[s] = M.line;
  if (M.tempo !== 'auto') G.stance[s].tempo = M.tempo;
  if (M.weight !== 'auto') G.stance[s].ball = M.weight;
  return said;
}
function blManage(o) {
  if (!GP) return false;
  const M = GP.mgr;
  if (o.line === 'auto' || BL_LINES[o.line]) M.line = o.line;
  if (['auto', 'quick', 'steady'].includes(o.tempo)) M.tempo = o.tempo;
  if (['auto', 'heavy', 'light'].includes(o.weight)) M.weight = o.weight;
  if (BL_HOOK.onPick) try { BL_HOOK.onPick(); } catch (e) { console.error(e); }
  return true;
}
function blSetMode(m) {
  if (!GP || !BL_MODES.includes(m)) return;
  GP.mode = m;
  // a ball you were setting up goes back to the CPU in Watch or Manage, and the next one is yours in You play
  if (m !== 'play' && (GP.ph === 'aim' || (GP.ph === 'swing' && GP.meter && GP.meter.st !== 'gone'))) { GP.meter = null; blGo('next'); }
}
// what the page needs, as a copy
function blView() {
  if (!GP) return null;
  const s = blUp();
  return { mode: GP.mode, you: GP.you, ph: GP.ph, msg: GP.msg, up: s, bowler: s >= 0 ? blBowler(s) : null, frame: s >= 0 ? blFrameNo(s) : null,
    sel: GP.sel ? Object.assign({}, GP.sel) : null, meter: GP.meter ? Object.assign({}, GP.meter) : null, streak: GP.streak.slice() };
}
