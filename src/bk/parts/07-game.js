/* The Charter Court: a game (issue #77, phase 1). Tip-off, then possession after possession on the game clock, four
   quarters, until the end (or overtime). The beats (GD.ph):
   - intro: both fives at the centre circle, then the tip: the two centres jump, size and hops against size and hops.
   - live: the play (05-live.js) on the game clock and the shot clock.
   - dead: a moment after a basket, a violation or a foul away from the shot; then the walk.
   - walk: the side with the ball brings it up to its spots and the defense meets it, sped through (BK_PACE.walk
     seconds to watch, BK_PACE.walkSecs off the clocks; none after a break between periods).
   - ft: free throws, one beat each. A miss on the last one is a live rebound; a make gives the ball to the other side.
   - break: between periods (longer at halftime); the ball goes by the arrow.
   - over: the end; onOver hears the summary.
   A side whose player fouls out puts its best player from the bench on in that spot; with nobody on the bench the
   player stays on (02-rules.js). The box score (G.box, by side and roster index): pts, reb (oreb, dreb), ast, stl,
   blk, fgm, fga, tpm, tpa, ftm, fta, pf, tov and sec (seconds on the floor). G.log has every score.
   Phase 2: GD.mode 'watch' (the CPU plays both sides) or 'play' (you play side GD.you by hand, 09-hands.js); the release
   meter (GD.meter) moves with the play, and your free throws wait for it. The hot hand: G.hot, each player's makes in
   a row (three and they're on fire, until a miss).
   Phase 3: stamina and the bench (10-bench.js): the five drain through live play and the walk, everyone breathes at
   stoppages, and the coaches sub at each dead ball and break.
   GD is the game on show (not saved). The headless game (bkSimGame) runs this same flow with bigger steps, so the
   view and the bot can't drift apart. */
const BK_PACE = { intro: 1.4, dead: .9, walk: .9, walkSecs: 3, ft: 1.05, break: 2.2, half: 3.4 };
const BK_HOOK = { onOver: null, onPhase: null, onSnap: null, wantSnap: null };
let GD = null;

function bkStart(opts) {
  const o = opts || {}, T = o.teams || [];
  bkSeed(o.seed);
  bkNewGame({ mins: o.mins });
  G.teams = [bkTeam(T[0] || BK_CLUBS.home), bkTeam(T[1] || BK_CLUBS.away)];
  G.on = G.teams.map(t => BK_POS.map(k => t.spot[k]));
  G.skill = Array.isArray(o.skill) ? o.skill.map(n => clamp(n | 0, 0, 2)) : [1, 1];
  bkCallsStart(o);
  bkCourtStart(!!o.court); bkPowersStart(o.powers);
  bkStamStart(); G.ordered = Array.isArray(o.ordered) ? o.ordered.map(Boolean) : [false, false];
  G.box = G.teams.map(t => t.roster.map(() => ({ pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pf: 0, tov: 0, sec: 0 })));
  G.log = []; G.poss0 = [0, 0]; G.secs = 0; G.hot = [{}, {}];
  // how often the big plays came up (from the play's events): fast breaks, players on fire, picks set, lobs, moves that beat a man, goaltending, alley-oops made, and the Charter Court's slips, bent rims and roars
  G.tally = { break: 0, fire: 0, screen: 0, lob: 0, beat: 0, goaltend: 0, alley: 0, slip: 0, bent: 0, roar: 0, pow: 0, ult: 0, sit: 0 };
  bkNewPlay();
  GD = { ph: 'intro', t: 0, acc: 0, mode: ['play', 'manage'].includes(o.mode) ? o.mode : 'watch', you: 0, meter: null, auto: true, pow: null, msg: `${G.teams[0].name} against ${G.teams[1].name}. Tip-off.`, big: null, walk: null, ft: null };
  bkInputClear(); bkTipSet();
  return G;
}
function bkGo(ph) {
  GD.ph = ph; GD.t = 0; if (G.ver != null) G.ver++;
  // (a note, a foul-out or a sub, is for the stop in play it came with)
  if (ph === 'live') GD.notes = [];
  // the possession's start: its powers' freezes and stamina, as play goes live (14-powers.js)
  if (ph === 'live' && G.cur && G.cur.started === false) { bkFxStart(); G.cur.started = true; }
  // the coaches' subs at each stoppage (10-bench.js); a break gives everyone some breath back first
  if (ph === 'break') { bkStamBreak(GD.half); bkManaAdd(0, BK_MANA.brk); bkManaAdd(1, BK_MANA.brk); }
  if (ph === 'dead' || ph === 'break') for (const s of [0, 1]) bkCoachSubs(s, ph === 'break');
  // (the next period's first possession: its calls and powers now, with the break's mana in)
  if (ph === 'break' && G.pendingPoss != null) { const s = G.pendingPoss; G.pendingPoss = null; bkPossNew(s); }
  // a new half: timeouts again (one more in each overtime); a stoppage: the CPU's coaches may call one
  if (ph === 'break' && GD.half) G.to = [BK_TO.n, BK_TO.n];
  if (ph === 'break' && G.q > BK_RULES.quarters) G.to = G.to.map(n => n + BK_TO.ot);
  if (ph === 'dead') GD.toAsk = true;
  // (and each stoppage is a point to save the game at, 12-save.js)
  bkSnapHook(ph);
  if (BK_HOOK.onPhase) try { BK_HOOK.onPhase(ph); } catch (e) { console.error(e); }
}
function bkBoxAdd(side, ri, k, n) {
  const b = G.box[side][ri]; if (!b) return; const v = n == null ? 1 : n;
  b[k] += v; if (k === 'oreb' || k === 'dreb') b.reb += v;
}
// the line in the bar under the court: what just happened (GD.msg), from the play's events
const BK_SAY = {
  bent: () => { GD.big = { k: 'bent' }; return GD.msg; }, roar: () => { if (!GD.big) GD.big = { k: 'roar' }; return GD.msg; },
  steal: e => `${e.s} steals it from ${e.o}.`, block: e => `${e.s} blocks ${e.o}!`,
  reb: e => e.o === 'off' ? `${e.s} gets the offensive rebound.` : `${e.s} with the rebound.`,
};
function bkSayEv(e) { if (GD && BK_SAY[e.k]) GD.msg = BK_SAY[e.k](e); }
// where everyone stands for the tip: both fives around the centre circle, each on the side of the basket it defends
function bkTipSet() {
  const mid = BK_RULES.len / 2, at = { C: [.6, 0], PF: [2.4, 2.6], SF: [2.4, -2.6], SG: [4.5, 3.2], PG: [4.5, -3.2] };
  for (const p of L.pl) { const [dx, dy] = at[p.pos], back = -bkDir(p.side); p.x = mid + back * (p.pos === 'C' ? .6 : dx); p.y = dy * (p.side ? -1 : 1); p.vx = p.vy = 0; }
  Object.assign(L.ball, { st: 'tip', h: -1, x: mid, y: 0, z: 3 });
}
function bkTip() {
  const c = [0, 1].map(s => L.pl[s * 5 + BK_POS.indexOf('C')]), d = (c[0].r.siz + c[0].r.hop) - (c[1].r.siz + c[1].r.hop), win = R() < clamp(.5 + d * .04, .15, .85) ? 0 : 1;
  bkGive(win); G.arrow = 1 - win;
  const pg = L.pl[win * 5 + BK_POS.indexOf('PG')];
  Object.assign(L.ball, { st: 'held', h: L.pl.indexOf(pg) });
  GD.msg = `${c[win].n} wins the tip for ${G.teams[win].name}.`;
  bkGo('live');
}
function bkTick(dt) {
  if (!GD || GD.ph === 'over') return;
  GD.t += dt; BKI.now += dt;
  if (GD.ph === 'intro') { if (GD.t >= BK_PACE.intro) bkTip(); return; }
  if (GD.ph === 'live') {
    GD.acc += dt;
    while (GD.acc >= BK_DT && GD.ph === 'live') {
      GD.acc -= BK_DT; bkStep(BK_DT); if (GD.ph !== 'live') break;
      bkMeterStep(BK_DT); if (GD.ph !== 'live') break;
      // (a shot in the air when the clock runs out still counts: the period ends when it comes down)
      if (L.buzzer) continue;
      bkMinutes(Math.min(BK_DT, G.clock)); bkStamStep(BK_DT); bkCourtStep(BK_DT);
      const B = L.ball, r = bkRun(BK_DT, B.st === 'shot' || B.st === 'loose' || B.st === 'free');
      if (r === 'shot') { bkViolationNow(); break; }
      if (r === 'end') { if (B.st === 'shot') L.buzzer = true; else { bkPeriodOver(); break; } }
    }
    return;
  }
  // (after a reach the offense keeps it where it was, the ball with the player fouled: no walk up the floor)
  if (GD.ph === 'dead' || GD.ph === 'break') bkStamStop(dt);
  // (the CPU's coaches may call a timeout at a dead ball: asked once, on its first tick)
  if (GD.ph === 'dead' && GD.toAsk) { GD.toAsk = false; for (const s of [0, 1]) if (bkCpuTimeout(s)) return; }
  if (GD.ph === 'dead') { if (GD.t >= BK_PACE.dead) { if (GD.keep) { GD.keep = false; for (const p of L.pl) { p.vx = p.vy = 0; p.stun = 0; } L.drive = false; L.think = .4; bkGo('live'); } else bkWalk(true); } return; }
  if (GD.ph === 'walk') {
    const W = GD.walk, u = Math.min(1, GD.t / BK_PACE.walk), e = u * u * (3 - 2 * u);
    L.pl.forEach((p, i) => { const a = W.from[i], b = W.to[i]; const px = p.x, py = p.y; p.x = lerp(a[0], b[0], e); p.y = lerp(a[1], b[1], e); p.vx = (p.x - px) / Math.max(dt, 1e-3); p.vy = (p.y - py) / Math.max(dt, 1e-3); p.run += hyp(p.x - px, p.y - py) * 2.2; });
    bkBall(dt);
    if (W.clock) { const s = Math.min(G.clock, BK_PACE.walkSecs * e - (W.ran || 0)); W.ran = BK_PACE.walkSecs * e; bkMinutes(s); bkStamStep(s, true); if (bkRun(s) === 'end') { bkPeriodOver(); return; } }
    if (u >= 1) { for (const p of L.pl) { p.vx = p.vy = 0; } L.t = 0; L.got = 0; L.think = .4; bkGo('live'); }
    return;
  }
  // (yours wait at the line for the meter, while you're at the keys)
  if (GD.ph === 'ft') {
    const mine = bkHandsOn() && GD.ft && GD.ft.side === GD.you;
    if (GD.meter) { bkMeterStep(dt); return; }
    if (mine && BKI.now - BKI.last < BK_HANDS.ftWait + BK_PACE.ft && GD.t < BK_HANDS.ftWait) return;
    // (the usual beat at the line is a stoppage like any other; the time it waits for you isn't rest)
    if (GD.t <= BK_PACE.ft) bkStamStop(dt);
    if (GD.t >= BK_PACE.ft) bkFreeThrow();
    return;
  }
  if (GD.ph === 'break') { if (GD.t >= (GD.half ? BK_PACE.half : BK_PACE.break)) bkWalk(false); return; }
  if (GD.ph === 'timeout') { if (GD.t >= BK_TO.secs) bkTimeoutOver(); }
}
function bkMinutes(s) { for (const p of L.pl) G.box[p.side][p.ri].sec += s; G.secs += s; }
// the ball to side's point guard, and everyone to the set: the walk up the floor (clock: the clocks run through it)
function bkWalk(clock) {
  const side = G.poss, pg = L.pl.findIndex(p => p.side === side && p.pos === 'PG');
  // (the possession and its calls were set when the ball changed hands: bkGive)
  const at = bkSetSpots(side);
  // the set starts from wherever they are now; the inbound starts under the other basket
  GD.walk = { from: L.pl.map(p => [p.x, p.y]), to: L.pl.map((_, i) => at[i]), clock };
  Object.assign(L, { shot: null, drive: false, buzzer: false, last: null, pick: null, brk: true });
  for (const p of L.pl) { p.stun = 0; p.act = ''; p.cut = null; }
  bkMarks(); GD.meter = null;
  Object.assign(L.ball, { st: 'held', h: pg, to: -1 });
  bkGo('walk');
}
// a change of possession in the play (a steal, a defensive rebound, a loose ball): the play goes on the other way
function bkPossession(how) {
  const lost = 1 - G.poss;
  if (how === 'steal' && L.lost >= 0) { bkBoxAdd(lost, L.pl[L.lost].ri, 'tov'); L.lost = -1; bkSpiritAdd(1 - lost, BK_SPIRIT.steal); }
}
function bkViolationNow() {
  const side = G.poss, h = bkHand() >= 0 ? bkHand() : L.ball.st === 'pass' ? L.ball.from : -1;
  if (h >= 0) bkBoxAdd(side, L.pl[h].ri, 'tov');
  bkViolation();
  GD.msg = `Shot clock! ${G.teams[side].name} turn it over.`; GD.big = { k: 'clock' };
  bkGo('dead');
}
// the shot has come down (05-live.js): score it, and take any free throws
function bkShotDone(S) {
  const p = L.pl[S.i], three = S.pts === 3, D = 1 - S.side;
  // (a miss when fouled is no attempt: it's the free throws)
  if (S.made || !S.foul) { bkBoxAdd(S.side, p.ri, 'fga'); if (three) bkBoxAdd(S.side, p.ri, 'tpa'); }
  if (S.made) {
    bkScore(S.side, S.pts); bkRunAdd(S.side, S.pts); bkBoxAdd(S.side, p.ri, 'fgm'); bkBoxAdd(S.side, p.ri, 'pts', S.pts); if (three) bkBoxAdd(S.side, p.ri, 'tpm');
    const a = S.ast >= 0 ? L.pl[S.ast] : null; if (a) bkBoxAdd(S.side, a.ri, 'ast');
    G.log.push({ q: G.q, clock: Math.round(G.clock * 10) / 10, side: S.side, pts: S.pts, who: p.n, ri: p.ri, k: S.dunk ? 'dunk' : three ? 'three' : S.rim ? 'layup' : 'jumper', ast: a ? a.n : '' });
    GD.msg = (S.dunk ? `${p.n} throws it down!` : three ? `${p.n} for three: good!` : S.rim ? `${p.n} lays it in.` : `${p.n} hits from ${S.dist} metres.`) + (a ? ` ${a.n} with the pass.` : '');
    if (S.alley) G.tally.alley++;
    if (S.alley) GD.msg = `Alley-oop! ${p.n} throws it down.` + (a ? ` ${a.n} with the lob.` : '');
    if (S.goaltend) GD.msg = `Goaltending on ${L.pl[S.gt].n}: the basket counts for ${p.n}.`;
    GD.big = S.goaltend ? { k: 'goaltend' } : S.alley ? { k: 'alley' } : S.dunk ? { k: 'dunk' } : S.swish ? { k: 'swish' } : three ? { k: 'three' } : null; GD.net = { hoop: bkHoopX(S.side) > BK_RULES.len / 2 ? 1 : 0 };
  } else if (S.block) { GD.big = { k: 'block' }; }
  else GD.msg = `${p.n} misses${three ? ' from three' : S.rim ? ' at the rim' : ''}.`;
  bkCourtShot(S, p); bkSpiritShot(S);
  // the hot hand: makes in a row; the third sets them on fire, and a miss puts it out
  const hot = G.hot[S.side], was = bkOnFire(p);
  if (S.made) { hot[p.ri] = (hot[p.ri] || 0) + 1; if (hot[p.ri] === BK_FIRE.n) { if (G.kept) G.kept[S.side][p.ri] = false; GD.msg += ` ${p.n} is on fire!`; GD.big = { k: 'fire' }; bkEv('fire', p.n); } }
  // (a miss puts the fire out, unless the crowd's spirit keeps it going one more)
  else if (was && bkSpiritKeep(p)) GD.msg += ` The crowd keeps ${p.n} on fire.`;
  else { hot[p.ri] = 0; if (was) GD.msg += ` ${p.n} has cooled off.`; }
  if (S.foul) {
    const d = L.pl[S.by], who = d.n, f = bkFoulOn(D, d, { shooting: true, made: S.made, three });
    GD.msg += ` Foul on ${who}${S.made ? ': and one!' : `: ${f.shots} free throw${f.shots === 1 ? '' : 's'}.`}`;
    if (S.made) GD.big = { k: 'andone' };
    return bkFreeThrows(S.side, S.i, f.shots);
  }
  if (S.made) { bkGive(D); return L.buzzer ? bkPeriodOver() : bkGo('dead'); }
  // a miss or a block: the ball is loose and the play goes on (unless the clock has run out)
  if (L.buzzer) bkPeriodOver();
}
// a foul by side's player d (in L.pl): the box score, and off they come at five if there's anyone to come in
function bkFoulOn(side, d, o) {
  const bench = bkBench(side), f = bkFoul(side, d.ri, Object.assign({ benchLeft: bench.length }, o));
  bkBoxAdd(side, d.ri, 'pf');
  if (f.out) bkFoulOut(side, d, bench);
  return f;
}
// side's bench: roster indices not on the floor and not fouled out
function bkBench(side) { return G.teams[side].roster.map((_, i) => i).filter(i => !G.on[side].includes(i) && !bkFouledOut(side, i)); }
function bkFoulOut(side, d, bench) {
  // (yours: the next on your bench; the CPU's: whoever suits the spot)
  const T = G.teams[side], inn = bkOrdered(side) ? bench[0] : bench.slice().sort((a, b) => bkFit(T.roster[b].r, d.pos) - bkFit(T.roster[a].r, d.pos))[0], m = T.roster[inn];
  G.on[side][BK_POS.indexOf(d.pos)] = inn;
  GD.notes = (GD.notes || []).concat(`${d.n} fouls out; ${m.n} comes on.`);
  Object.assign(d, { ri: inn, kind: m.kind, n: m.n, num: m.num, r: Object.assign({}, m.r) });
}
// how well ratings r suit a spot
const bkFit = (r, pos) => BK_ROLE[pos] === 'guard' ? r.hnd * 2 + r.spd : BK_ROLE[pos] === 'wing' ? r.tch * 2 + r.hop : r.siz * 2 + r.def + r.hop * .5;
// a foul away from the shot (06-cpu.js): in the bonus it's two shots; otherwise the offense keeps it, on at least 8
function bkReach(d) {
  const h = bkHand(), p = L.pl[h], who = d.n, f = bkFoulOn(d.side, d, {});
  GD.msg = `Foul on ${who}, reaching in${f.shots ? `: ${f.bonus ? 'in the bonus, ' : ''}${f.shots} free throw${f.shots === 1 ? '' : 's'}.` : '.'}`;
  if (f.shots) return bkFreeThrows(p.side, h, f.shots);
  G.shot = Math.max(G.shot, 8); GD.keep = true;
  bkGo('dead');
}
// free throws: the shooter at the line, everyone else along the lane
function bkFreeThrows(side, i, n) {
  GD.ft = { side, i, n, made: 0, of: n };
  const hx = bkHoopX(side), dir = bkDir(side), lane = [[1.2, 2.4], [2.6, 2.4], [1.2, -2.4], [2.6, -2.4], [3.9, 2.4], [3.9, -2.4]];
  let k = 0;
  // the defense takes the spots nearest the rim
  const rest = L.pl.map((p, j) => j).filter(j => j !== i).sort((a, b) => (L.pl[a].side === side) - (L.pl[b].side === side));
  for (const j of rest) {
    const p = L.pl[j];
    if (k < lane.length && (p.pos === 'C' || p.pos === 'PF' || p.pos === 'SF')) { const [u, v] = lane[k++]; p.x = hx - dir * u; p.y = v; }
    else { p.x = hx - dir * (8 + (j % 3)); p.y = (j % 2 ? 1 : -1) * (2 + j % 4); }
    p.vx = p.vy = 0; p.act = ''; p.stun = 0;
  }
  const s = L.pl[i]; s.x = hx - dir * 4.225; s.y = 0; s.vx = s.vy = 0;
  Object.assign(L.ball, { st: 'held', h: i, to: -1 }); L.drive = false; L.shot = null; L.last = null;
  // (the other coach may ice them, Ice It, 14-powers.js: before the beat, so its save point has it)
  bkCpuIceAt(side);
  bkGo('ft');
}
// one free throw: touch, nothing else (nerve comes later); yours on the meter (o.e: how far from the top you let go)
function bkFreeThrow(o) {
  const F = GD.ft, p = L.pl[F.i], ch = clamp(bkFtChance(p) + (G.cur && G.cur.side === F.side ? bkFx('ft') : 0) + (F.ice || 0), .05, .98), e = o && o.e;
  const good = R() < (e == null ? ch : bkTimed(ch, e, bkFtWindow(p), BK_FT_TIMED));
  F.n--; bkBoxAdd(F.side, p.ri, 'fta');
  if (good) { F.made++; bkScore(F.side, 1); bkRunAdd(F.side, 1); bkBoxAdd(F.side, p.ri, 'ftm'); bkBoxAdd(F.side, p.ri, 'pts'); G.log.push({ q: G.q, clock: Math.round(G.clock * 10) / 10, side: F.side, pts: 1, who: p.n, ri: p.ri, k: 'ft', ast: '' }); }
  GD.msg = `${p.n} at the line: ${good ? 'good' : 'no good'} (${F.made} of ${F.of - F.n}).`; if (good) GD.net = { hoop: bkHoopX(F.side) > BK_RULES.len / 2 ? 1 : 0 };
  if (F.n > 0) { GD.t = 0; return; }
  GD.ft = null;
  if (G.clock <= 0) return bkPeriodOver();
  if (good) { bkGive(1 - F.side); return bkGo('dead'); }
  // a miss on the last one: a live rebound
  bkShotReset(); bkLoose(bkHoopX(F.side), 0, 3.05, 1.8); L.t = 0; bkGo('live');
}
const bkFtChance = p => clamp(.5 + p.r.tch * .04, .3, .95);
const bkFtWindow = p => BK_WIN.min + BK_WIN.per * bkFtChance(p);
// who plays it: the CPU both sides ('watch'), or you play your side by hand ('play'); the same game goes on
// (Manage: your calls and your bench, the CPU plays your five)
function bkSetMode(m) { if (!GD) return; GD.mode = ['play', 'manage'].includes(m) ? m : 'watch'; bkInputClear(); if (L) L.me = -1; }
function bkPeriodOver() {
  const was = G.q, r = bkPeriodEnd();
  L.buzzer = false;
  if (r === 'over') {
    bkPossEnd();
    const [a, b] = G.score, w = G.over.win;
    GD.msg = w == null ? `Final: a tie, ${a} all.` : `Final: ${G.teams[w].name} win ${Math.max(a, b)} to ${Math.min(a, b)}${G.over.ot ? ` in ${bkPeriodName(was)}` : ''}.`;
    bkGo('over');
    if (BK_HOOK.onOver) try { BK_HOOK.onOver(bkSummary()); } catch (e) { console.error(e); }
    return;
  }
  GD.half = r === 'half';
  GD.msg = r === 'ot' ? `Level at ${G.score[0]}: overtime.` : `End of the ${bkPeriodName(was)}: ${G.teams[0].name} ${G.score[0]}, ${G.teams[1].name} ${G.score[1]}.`;
  Object.assign(L, { shot: null, drive: false });
  bkGo('break');
}
// the game clock as it shows: m:ss, and tenths in the last ten seconds
function bkClockText() { const t = Math.max(0, G.clock); if (t < 10) return t.toFixed(1); const s = Math.ceil(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function bkSummary() {
  return { score: G.score.slice(), teams: G.teams.map(t => t.name), win: G.over ? G.over.win : null, q: G.q, ot: G.over ? G.over.ot : 0, mins: G.mins,
    poss: G.poss0.slice(), secs: Math.round(G.secs), box: bkBox(), log: G.log.slice(), tally: Object.assign({}, G.tally), subs: (G.subs || [0, 0]).slice(), sets: JSON.parse(JSON.stringify(G.setLog || [{}, {}])), timeouts: (G.toUsed || [0, 0]).slice() };
}
// the box score: by side, each player who played, with their line, and the team's totals
function bkBox() {
  return G.teams.map((T, s) => {
    const rows = T.roster.map((m, i) => Object.assign({ n: m.n, kind: m.kind, num: m.num, ri: i, out: bkFouledOut(s, i) && !G.on[s].includes(i) }, G.box[s][i], { sec: Math.round(G.box[s][i].sec) }));
    const tot = {}; for (const k of ['pts', 'reb', 'oreb', 'dreb', 'ast', 'stl', 'blk', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'pf', 'tov']) tot[k] = rows.reduce((a, r) => a + r[k], 0);
    return { team: T.name, rows, tot };
  });
}
// a whole game at once, CPU against CPU, through the same flow; watch is the time it would take to watch
function bkSimGame(opts) {
  const hooks = Object.assign({}, BK_HOOK), was = opts && opts.keep ? { G, GD, L, rand: bkRand, keys: JSON.parse(JSON.stringify(BKI)) } : null;
  BK_HOOK.onOver = BK_HOOK.onPhase = BK_HOOK.onSnap = null;
  let watch = 0, out;
  try {
    bkStart(Object.assign({}, opts, { mode: 'watch' }));
    for (let i = 0; i < 400000 && GD.ph !== 'over'; i++) { bkTick(BK_DT * 4); watch += BK_DT * 4; }
    out = Object.assign(bkSummary(), { watch: Math.round(watch) });
  } finally { Object.assign(BK_HOOK, hooks); if (was) { G = was.G; GD = was.GD; L = was.L; bkRand = was.rand; Object.assign(BKI, was.keys); } }
  return out;
}
