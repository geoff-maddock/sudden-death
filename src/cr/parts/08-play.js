/* The Curling Shed: the game on show and throwing by hand (issue #102, phase 2). GP is the page's: the beat, your
   stone's call, the meter, the sweepers, the stone sliding now. It is not the game's state (G is) and never saved.

   The beat (GP.ph): next (whose stone, and who throws it) → aim (yours: the call, the broom and the handle) → swing
   (the weight meter) → slide (the stone on the ice: hold Space to sweep it) → rest (the stones settle; the end scored
   after its sixteenth) → next, and over at the end. A CPU stone goes next → addr (the skip calls it) → slide → rest.
   - The call (GP.sel): the shot (CR_SHOTS), the broom (where the skip holds it: x, y), the handle (h: +1 out-turn,
     curls left; -1 in-turn, curls right) and, for a hit, the stone it is to hit. Your skip suggests one (the CPU's
     call, as a Knight would make it) and puts the broom there; you can change any of it. The aim follows the call on
     the ice as a Knight reads it.
   - The weight: Space starts the meter, and the marker climbs from light to heavy; press again at the line (the
     call's weight). Early is light, late is heavy, by how far. The line off the broom is your curler's own miss.
   - Sweeping: hold Space while your stone slides (a phone: hold the Sweep button). The skip calls it as it goes: "Hurry
     hard!" when the stone would stop well short of the broom, "Sweep!" a little short, "Off!" when it has the weight,
     "Whoa!" when it is heavy. A hit needs no sweeping, and the skip says so.
   - Watch: the CPU throws both sides, its own sweepers sweeping. You play: your side's stones are yours.
   The stone moves on the page at CR_PLAY.speed times real time, a step at a time, the same steps the sim takes. */
const CR_PLAY = { speed: 2.5, pace: { addr: .9, rest: 1.4, end: 2.4, over: 2.6 }, meter: { low: .82, high: 1.22, rise: .3, line: 1, win: .02 }, you: { ang: .12 } };
const CR_HOOK = { onPhase: null, onPick: null, onOver: null };
const CR_MODES = ['watch', 'play'];
let GP = null;

function crPlayStart(o) {
  GP = { mode: CR_MODES.includes(o && o.mode) ? o.mode : 'watch', you: 0, ph: 'next', t: 0, wait: 0, msg: '', sel: null, meter: null, sweep: false, X: null, cpu: null, call: '', last: null };
  crGo('next');
  return GP;
}
function crGo(ph, wait, msg) {
  GP.ph = ph; GP.t = 0; GP.wait = wait || 0; if (msg != null) GP.msg = msg;
  if (CR_HOOK.onPhase) try { CR_HOOK.onPhase(ph); } catch (e) { console.error(e); }
}
const crName = (s, ri) => (G.teams[s].roster[ri] || {}).n || 'Someone';
const crYours = s => GP.mode === 'play' && s === GP.you;
const crPosName = s => CR_RULES.posN[crPos(s)];

/* ---------- your call ---------- */
// the aim for a call, on the ice as a Knight reads it (null if nothing gets there)
function crSelAim(S) {
  const ice = G.iceEnd || null, R = CR_SHEET.stoneR;
  if (['takeout', 'peel', 'hitroll'].includes(S.shot)) {
    const tg = G.stones.find(b => b.id === S.target); if (!tg) return null;
    const v = S.shot === 'peel' ? CR_AIM.vPeel : S.shot === 'hitroll' ? CR_AIM.vRoll : CR_AIM.vHit;
    return crSolveHit(tg.x + (S.shot === 'hitroll' ? (S.roll || 0) : 0), tg.y - R * 1.6, v, S.h, ice, G.cold);
  }
  return crSolveDraw(S.x, S.y, S.h, ice, G.cold);
}
// your skip's suggestion for your stone (the call a Knight would make)
function crSuggest(s) {
  const keep = G.skill[s]; G.skill[s] = 1; let P;
  try { P = crPlan(s); } finally { G.skill[s] = keep; }
  return { shot: P.shot, x: P.x, y: P.y, h: P.h, target: P.target || null, roll: P.roll || 0, why: P.why };
}
// your skip's call, aimed; one that won't solve on the ice falls back to a draw to the top of the house
function crSelReset() {
  GP.sel = crSuggest(GP.you); GP.sel.aim = crSelAim(GP.sel);
  for (const h of [1, -1]) { if (GP.sel.aim) break; const S = { shot: 'draw', x: 0, y: -40, h, target: null, roll: 0, why: 'a draw to the top of the four-foot' }; S.aim = crSelAim(S); if (S.aim) GP.sel = S; }
}
/* change your call: { shot, x, y, h, target, suggest }. A hit takes the stone nearest the broom as its target (theirs
   first); a draw keeps the broom where it is. Returns '' or why not */
function crSelect(o) {
  if (!GP || GP.ph !== 'aim' || !GP.sel) return 'Not now.';
  if (o.suggest) { crSelReset(); crPick(); return ''; }
  const S = Object.assign({}, GP.sel);
  if (o.shot && CR_SHOTS[o.shot]) S.shot = o.shot;
  if (o.h === 1 || o.h === -1) S.h = o.h;
  if (o.x != null) S.x = clamp(+o.x, -CR_SHEET.halfW + 8, CR_SHEET.halfW - 8);
  if (o.y != null) S.y = clamp(+o.y, -CR_SHEET.hog + 10, CR_SHEET.back - 8);
  if (['takeout', 'peel', 'hitroll'].includes(S.shot)) {
    if (o.target) S.target = o.target;
    else if (o.shot || o.x != null || o.y != null || !S.target) {
      // the stone nearest the broom (theirs first only when two are as near)
      const d = b => Math.hypot(b.x - S.x, b.y - S.y), near = G.stones.slice().sort((a, b) => (Math.round(d(a) / 4) - Math.round(d(b) / 4)) || (a.s === GP.you) - (b.s === GP.you))[0];
      if (!near) return 'There is nothing to hit.';
      S.target = near.id; S.x = near.x; S.y = near.y;
    }
  }
  if (S.shot === 'guard' && o.shot && o.x == null) { S.x = 0; S.y = -190; }
  // a freeze: the broom just in front of the stone of theirs nearest it (a small move keeps the same stone: say so)
  if (S.shot === 'freeze') { const R = CR_SHEET.stoneR, th = G.stones.filter(b => b.s !== GP.you).sort((a, b) => Math.hypot(a.x - S.x, a.y - S.y) - Math.hypot(b.x - S.x, b.y - S.y))[0];
    if (!th) return 'There is nothing of theirs to freeze to.';
    const was = GP.sel.shot === 'freeze' && Math.abs(GP.sel.x - th.x) < .01 && Math.abs(GP.sel.y - (th.y - 2 * R - .5)) < .01;
    S.x = th.x; S.y = th.y - 2 * R - .5;
    if (was && (o.x != null || o.y != null) && !o.shot) return 'A freeze rests just in front of the stone it freezes to: click another stone of theirs to freeze to that one.'; }
  if (!['takeout', 'peel', 'hitroll'].includes(S.shot)) { S.target = null; S.roll = 0; }
  const aim = crSelAim(S); if (!aim) return 'Nothing gets there from here: try the other handle, or another spot.';
  S.aim = aim; GP.sel = S; crPick(); return '';
}
function crPick() { if (CR_HOOK.onPick) try { CR_HOOK.onPick(); } catch (e) { console.error(e); } }

/* ---------- the weight meter ---------- */
function crPress() {
  if (!GP || GP.mode !== 'play') return false;
  if (GP.ph === 'aim' && GP.sel && GP.sel.aim) { GP.meter = { st: 'up', v: CR_PLAY.meter.low, p: null }; crGo('swing', 0, `${crName(GP.you, crThrower(GP.you))} in the hack: press again at the line for the weight.`); return true; }
  if (GP.ph === 'swing' && GP.meter && GP.meter.st === 'up') { crRelease(GP.meter.v); return true; }
  return false;
}
function crMeterTick(dt) {
  const M = GP.meter, K = CR_PLAY.meter; if (!M || M.st !== 'up') return;
  M.v += K.rise * dt; if (M.v >= K.high) crRelease(K.high);
}
// the weight: p (the meter's mark, 1 the call's own weight); the line: your curler's miss off the broom
function crRelease(p) {
  const M = GP.meter; if (!M || M.st === 'gone') return;
  M.st = 'gone'; M.p = p;
  const S = GP.sel, err = Math.abs(p - CR_PLAY.meter.line) <= CR_PLAY.meter.win ? 1 : p;
  // (your weight's miss is the meter's; the line's is your curler's, by their ratings and the moment)
  const rel = { ang: S.aim.ang + gauss() * CR_PLAY.you.ang * crErrK(GP.you, S.shot).ang, v: S.aim.v * err, h: S.h };
  crBegin(GP.you, Object.assign({}, S), rel, null);
}
// a phone's throw: the pull (1 the call's weight) and how far off the broom (degrees)
function crDrag(pull, deg) {
  if (!GP || GP.mode !== 'play' || GP.ph !== 'aim' || !GP.sel || !GP.sel.aim) return false;
  GP.meter = { st: 'gone', v: pull, p: pull };
  crBegin(GP.you, Object.assign({}, GP.sel), { ang: GP.sel.aim.ang + clamp(deg, -3, 3) * .15 + gauss() * CR_PLAY.you.ang * crErrK(GP.you, GP.sel.shot).ang, v: GP.sel.aim.v * clamp(pull, CR_PLAY.meter.low, CR_PLAY.meter.high), h: GP.sel.h }, null);
  return true;
}

/* ---------- the stone on the ice ---------- */
function crBegin(s, plan, rel, sweep) {
  let X = crThrowBegin(s, plan, rel, sweep); GP.call = ''; GP.sweep = false;
  // (a throw left holding the game that isn't the page's, a broken one: let it go and try once more)
  if (!X && !crWhyNot(s) && CR_LIVE && CR_LIVE.g === G && CR_LIVE !== GP.X) { CR_LIVE = null; X = crThrowBegin(s, plan, rel, sweep); }
  // (the game moved on under the page: say why for a moment, then whose stone it is now)
  if (!X) { GP.meter = null; crGo('rest', CR_PLAY.pace.rest, crWhyNot(s) || 'A stone is still sliding.'); return; }
  GP.X = X;
  crGo('slide', 0, `${crName(s, GP.X.ri)} (${G.teams[s].short || G.teams[s].name}) throws ${CR_SHOTS[plan.shot] || 'a stone'}…`);
}
// the skip's call as your stone slides, from where it would stop now against the broom
function crSkipCall(X) {
  const T = X.Q.T, P = X.plan; if (!['draw', 'guard', 'freeze'].includes(P.shot)) return X.Q.hits ? '' : 'Let it go: it has the weight.';
  const v = Math.hypot(T.vx, T.vy); if (!v) return '';
  const stopY = T.y + (T.vy / v) * v * v / (2 * CR_STONE.a * crIceAt(G.ice, T.x, T.y, G.cold)), short = P.y - stopY;
  return short > 30 ? 'Hurry hard!' : short > 8 ? 'Sweep!' : short > -20 ? 'Off!' : 'Whoa! It\'s heavy.';
}
// how hard you ask your sweepers to sweep: all they have while you hold Space
const crYourSweep = () => GP.sweep ? 1 : 0;
function crSlideTick(dt) {
  const X = GP.X; if (!X) return;
  const mine = crYours(X.s);
  // (your sweepers: how hard you hold them to it, times how good they are and their legs, which it spends)
  // (the run makes it how hard they really sweep, and spends their legs, only while the stone is on the sheet and moving)
  crRunTo(X.Q, X.Q.t + dt * CR_PLAY.speed, mine ? crYourSweep() : undefined);
  GP.call = crSkipCall(X);
  if (X.Q.done) crSettle();
}
function crSettle() {
  const X = GP.X; GP.X = null; GP.sweep = false;
  const ev = crThrowFinish(X);
  if (!ev.rule.ok) { crGo('rest', CR_PLAY.pace.rest, ev.rule.why); return; }
  GP.last = ev;
  const R = ev.rule, e = R.end;
  let say = `${crName(ev.side, ev.ri)}: ${CR_SHOTS[ev.plan.shot] || 'a stone'}${ev.made ? ', made' : ''}${R.fgz ? ': it took a guard out before the fifth stone, so the free guard zone puts it back and the stone is removed' : ''}.`;
  if (e) say += e.s < 0 ? ` End ${e.end}: a blank, nobody scores.` : ` End ${e.end}: ${G.teams[e.s].name} score ${e.n}${e.s !== X.ham ? ', a steal' : ''}.`;
  if (G.over) say += ` ${G.teams[G.over.win].name} win, ${G.over.text}.`;
  crGo('rest', G.over ? CR_PLAY.pace.over : e ? CR_PLAY.pace.end : CR_PLAY.pace.rest, say);
  if (G.over && CR_HOOK.onOver) try { CR_HOOK.onOver(crSummary()); } catch (er) { console.error(er); }
}

/* ---------- the beat ---------- */
function crTick(dt) {
  if (!GP || !G || !G.teams) return;
  GP.t += dt;
  const P = GP.ph;
  if (P === 'next') crPlayNext();
  else if (P === 'addr') { if (GP.t >= CR_PLAY.pace.addr) { const c = GP.cpu; GP.cpu = null; crBegin(c.s, c.plan, c.rel, crSweeper(c.s, c.plan)); } }
  else if (P === 'swing') crMeterTick(dt);
  else if (P === 'slide') crSlideTick(dt);
  else if (P === 'rest') { if (GP.t >= GP.wait) crGo(G.over ? 'over' : 'next'); }
}
function crPlayNext() {
  const s = crUp(); if (s < 0) { crGo('over'); return; }
  const ri = crThrower(s), no = crSideNo(s) + 1, e = G.end + 1, hm = G.hammer === s ? ', with the hammer' : '';
  if (crYours(s)) { crSelReset(); crGo('aim', 0, `End ${e}${G.end >= G.ends ? ' (an extra end)' : ''}, stone ${no} of 8${hm}: ${crName(s, ri)}, your ${crPosName(s)}. ${GP.sel.aim ? `Your skip calls ${GP.sel.why}. Change the call if you like, then Space.` : 'Your skip can\'t find a line for that on this ice: change the shot, the broom or the handle.'}`); return; }
  const plan = Object.assign(crPlan(s), { s }), rel = crMiss(s, plan.aim);
  GP.cpu = { s, plan, rel };
  crGo('addr', 0, `End ${e}, stone ${no} of 8${hm}: ${crName(s, ri)} (${G.teams[s].name}), ${crPosName(s)}: ${plan.why}.`);
}
function crSetMode(m) {
  if (!GP || !CR_MODES.includes(m)) return;
  GP.mode = m;
  // (a stone of yours sliding as you hand it to the CPU: its sweepers take it over)
  if (m !== 'play' && GP.ph === 'slide' && GP.X && GP.X.s === GP.you && !GP.X.Q.O.sweep) GP.X.Q.O.sweep = crSweeper(GP.X.s, GP.X.plan);
  // a stone you were setting up goes back to the CPU in Watch, and the next one is yours in You play
  if (m !== 'play' && (GP.ph === 'aim' || (GP.ph === 'swing' && GP.meter && GP.meter.st !== 'gone'))) { GP.meter = null; crGo('next'); }
}
// the page has a stone set up or sliding (turn() and throwStone() from outside wait)
const crPageBusy = () => !!GP && (GP.ph === 'slide' || (['aim', 'swing', 'addr'].includes(GP.ph) && typeof CRP !== 'undefined' && CRP.on));
// a stone thrown from outside while the page had one called (hidden, so not holding the game): the page's call is
// for a house that isn't there any more, so it lets it go and starts on whose stone it is now
function crPageStale() { if (GP && ['aim', 'swing', 'addr'].includes(GP.ph)) { GP.cpu = null; GP.sel = null; GP.meter = null; crGo('next'); } }
// what the page needs, as a copy
function crView() {
  if (!GP) return null;
  const s = crUp();
  return { mode: GP.mode, you: GP.you, ph: GP.ph, msg: GP.msg, up: s, thrower: s >= 0 ? crThrower(s) : null, pos: s >= 0 ? crPos(s) : null, end: G.end + 1, k: G.k,
    sel: GP.sel ? JSON.parse(JSON.stringify(GP.sel)) : null, meter: GP.meter ? Object.assign({}, GP.meter) : null, sweep: GP.sweep, call: GP.call, hammer: G.hammer };
}
