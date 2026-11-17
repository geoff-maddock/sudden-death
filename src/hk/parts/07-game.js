/* Black Ice: a game (issue #83, phase 1). A face-off at centre, then play on the game clock, three periods, until the
   end (or sudden death, and a shootout). The clock runs only while the puck is in play. The beats (GD.ph):
   - intro: both sides lined up at centre.
   - set: after a whistle, everyone skates to the face-off (HK_PACE.set seconds to watch; nothing off the clock).
   - drop: the puck is dropped. The two centres go for it, hands and size against hands and size; the winner draws it
     back to a defender.
   - live: the play (05-live.js) on the game clock.
   - dead: a whistle: a goal, icing, or the goalie covering the puck. Then the face-off: at centre after a goal, in
     the icing side's end after icing, beside the net after a cover.
   - break: between periods. The sides swap ends.
   - so: the shootout, a try at a time, played out on the ice: the shooter from centre, alone on the goalie
     (GD.so.cur: ready, go, done). A try ends when the shot does, or after HK_PACE.soMax seconds.
   - over: the end; onOver hears the summary.
   Penalties (phase 3). A foul in the play (05-live.js) is called here (hkFoul). If the fouling side has the puck the
   whistle goes at once; otherwise the penalty is delayed (GD.delay): play goes on until that side touches the puck
   (hkTouched), and meanwhile the other side's goalie comes off for an extra skater. A goal in that time wipes the
   penalty out. Called, the player goes to the box (G.box, 02-rules.js) and the face-off is in their end. Who is on the
   ice follows the box and each side's strength (hkLines): boxed players are off, and in sudden death three skaters
   stay on. A player whose time is up comes out of the box onto the ice (hkFromBox).
   The goalie can be pulled for an extra skater (hkPull: 'delay', 'late' by the CPU when behind late in the third,
   'hand' by you): they skate as the extra one, the net is empty, and a face-off in their own half sends them back.
   The stats (G.stat, by side and roster index): g, a, sog (shots on goal), att (shots tried), hit, blk, give, take,
   fow and fot (face-offs won and taken), pim, sec (seconds on the ice), and for a goalie sa (shots faced) and sv
   (saves). G.log has every goal.
   GD is the game on show (not saved). The headless game (hkSimGame) runs this same flow with bigger steps, so the
   view and the bot can't drift apart. */
const HK_PACE = { intro: 1.3, set: .85, drop: .9, dead: 1, goal: 1.9, pen: 1.5, break: 2.4, so: 1.1, soGap: .5, soReady: .8, soMax: 7 };
const HK_HOOK = { onOver: null, onPhase: null, onSnap: null, wantSnap: null, onEv: null };
const HK_DOTS = { x: [8.5, HK_RULES.len - 8.5], y: 5.5 };
let GD = null;

function hkStart(opts) {
  const o = opts || {}, T = o.teams || [];
  engSeed(o.seed);
  hkNewGame({ mins: o.mins });
  G.teams = [hkTeam(T[0] || HK_CLUBS.home), hkTeam(T[1] || HK_CLUBS.away)];
  G.on = G.teams.map(t => HK_POS.map(k => t.spot[k]));
  G.stat = G.teams.map(t => t.roster.map(() => ({ g: 0, a: 0, sog: 0, att: 0, hit: 0, blk: 0, give: 0, take: 0, fow: 0, fot: 0, pim: 0, sec: 0, sa: 0, sv: 0, sh: 0 })));
  G.sta = G.teams.map(t => t.roster.map(() => 1)); G.ordered = [0, 1].map(s => !!(o.ordered && o.ordered[s]));
  for (const s of [0, 1]) for (const i of G.on[s]) G.stat[s][i].sh = 1;
  GD = { mode: ['play', 'manage'].includes(o.mode) ? o.mode : 'watch', you: o.you === 1 ? 1 : 0 };
  hkCallsStart(o); hkPondStart(!!o.pond, !!o.snow); hkPowersStart(o.powers); hkFansStart(o.fans); G.crowd = engCrowd(o); hkKitStart(o.bags);
  G.log = []; G.pens = []; G.secs = 0; G.poss = 0; G.drops = 0; G.icings = 0;
  hkNewPlay();
  GD = { ph: 'intro', t: 0, acc: 0, mode: GD.mode, you: GD.you, auto: o.auto !== false, autoPow: o.autoPow !== false, meter: null, rel: null, press: null, msg: `${G.teams[0].name} against ${G.teams[1].name}. The puck is about to drop.`, big: null, fo: null, set: null, next: null, deadT: HK_PACE.dead, so: null, delay: null };
  hkInputClear();
  hkLines(); hkFaceoffSpots(HK_RULES.len / 2, 0).forEach(([x, y], i) => { const p = L.pl[i]; p.x = x; p.y = y; p.vx = p.vy = 0; });
  GD.fo = { x: HK_RULES.len / 2, y: 0 }; hkPuckAt(GD.fo.x, GD.fo.y);
  return G;
}
function hkGo(ph) {
  GD.ph = ph; GD.t = 0;
  // (a new drop waits for a new press)
  if (ph === 'drop') GD.press = null;
  // (one potion a side a whistle: a new whistle, a new one)
  if (ph === 'dead' || ph === 'break') GD.potUsed = [false, false];
  if (HK_HOOK.onPhase) try { HK_HOOK.onPhase(ph); } catch (e) { console.error(e); }
  hkSnapHook(ph);
}
function hkBoxAdd(side, ri, k, n) { const b = G.stat[side][ri]; if (b) b[k] += n == null ? 1 : n; }
// the line under the rink: what just happened (GD.msg), from the play's events
const HK_SAY = {
  poke: e => `${e.s} pokes it off ${e.o}.`, hit: e => `${e.s} flattens ${e.o}!`, pick: e => `${e.s} picks off the pass.`,
  save: e => `Save by ${e.s}.`, rebound: e => `${e.s} stops it, and the rebound is loose.`, block: e => `${e.s} blocks the shot.`,
  wide: e => `${e.s} shoots wide.`, wind: e => `${e.s} winds up.`, pull: e => e.o === 'delay' ? '' : `${e.s} pull their goalie for an extra skater.`,
};
function hkSayEv(e) { if (GD && HK_SAY[e.k]) { const m = HK_SAY[e.k](e); if (m) GD.msg = m; } if (GD && e.k === 'hit') GD.big = { k: 'hit' }; }
// the puck lies still at (x, y): nobody can take it until it is dropped
function hkPuckAt(x, y) { Object.assign(L.puck, { st: 'free', h: -1, x, y, vx: 0, vy: 0, k: 'in', to: -1, ice: -1, shot: null, tried: [], go: 0, skip: -1 }); L.wind = null; L.carry = null; }
/* who is on the ice: a player in the box is off, and of the rest each side keeps as many as its strength now
   (02-rules.js), in the order they stay on. One who was off and is on again in a live play has come out of the box. */
function hkLines() {
  const n = hkStrength();
  for (const s of [0, 1]) {
    const boxed = new Set(G.box.filter(b => b.side === s).map(b => b.ri));
    let left = n[s];
    for (const pos of ['C', 'LD', 'LW', 'RD', 'RW']) {
      const p = L.pl[s * HK_POS.length + HK_POS.indexOf(pos)], was = p.box;
      p.box = boxed.has(p.ri); p.off = p.box || left <= 0; if (!p.off) left--;
      if (was && !p.box && !p.off && GD && GD.ph === 'live') hkFromBox(p);
    }
  }
}
// out of the box and onto the ice, at its door on the far boards
function hkFromBox(p) {
  p.x = HK_RULES.len / 2 + (p.side ? 1.6 : -1.6); p.y = -HK_RULES.wid / 2 + .7; p.vx = p.vy = 0; p.stun = 0; p.cd = 0;
  hkEv('back', p.n);
  const n = hkStrength(); GD.msg = `${p.n} is out of the box. ${n[0] === n[1] ? 'The sides are even.' : `${n[0]} on ${n[1]}.`}`;
}
// who takes side's face-offs: the centre, or with them in the box the next skater on the ice
function hkTaker(side) { for (const pos of ['C', 'LW', 'RW', 'LD', 'RD']) { const i = side * HK_POS.length + HK_POS.indexOf(pos); if (!L.pl[i].off) return i; } return side * HK_POS.length; }
/* a foul by d (k: what for; on: who it was on). Their side has the puck: the whistle now. Otherwise it's delayed: play
   on until they touch it, and the other side's goalie comes off for an extra skater. One penalty at a time. */
function hkFoul(d, k, on) {
  // (a goalie skating as the extra man takes no penalty: they have a net to go back to, not a box)
  if (!GD || GD.ph !== 'live' || GD.delay || d.box || L.pl.indexOf(d) === hkGk(d.side)) return;
  const h = hkHand();
  GD.delay = { side: d.side, i: L.pl.indexOf(d), ri: d.ri, k, on: on ? on.n : '' };
  hkEv('foul', d.n, k);
  if (h >= 0 && L.pl[h].side === d.side) return hkPenaltyCall();
  GD.msg = `A penalty is coming on ${d.n} for ${k}. Play on until ${G.teams[d.side].name} touch the puck.`;
  hkPull(1 - d.side, 'delay');
}
// side has the puck (05-live.js: hkGain): if it has a penalty coming, that's the whistle
function hkTouched(side) { if (GD && GD.ph === 'live' && GD.delay && GD.delay.side === side) hkPenaltyCall(); }
// the penalty is given: into the box (or to wait its turn), and a face-off in their end. quiet: no whistle (a break)
function hkPenaltyCall(quiet) {
  const D = GD.delay; GD.delay = null; if (!D) return;
  hkPullBack(1 - D.side, 'delay');
  const p = L.pl[D.i], e = hkPenalty(D.side, D.ri, D.k), other = G.teams[1 - D.side].name;
  hkBoxAdd(D.side, D.ri, 'pim', 2);
  G.pens.push({ p: G.p, clock: Math.round(G.clock * 10) / 10, side: D.side, who: p.n, ri: D.ri, k: D.k, on: D.on });
  const n = hkStrength(), msg = `${p.n} goes to the box for ${D.k}${e.waits ? ', once there is room in it' : ''}. ${n[0] === n[1] ? `${n[0]} on ${n[1]}.` : `${other} on the power play.`}`;
  if (quiet) { GD.msg += ` ${msg}`; return; }
  const [x] = hkAt(D.side, HK_DOTS.x[0], 0);
  hkWhistle(x, (L.puck.y < 0 ? -1 : 1) * HK_DOTS.y, msg, 'penalty', HK_PACE.pen);
}
// side's goalie comes off for an extra skater (why: 'delay', 'late' or 'hand'). Not while they hold the puck
function hkPull(side, why) {
  const g = L.pl[hkGk(side)]; if (g.pulled || g.off || hkHand() === hkGk(side)) return false;
  g.pulled = why; g.vx = g.vy = 0;
  hkEv('pull', G.teams[side].name, why);
  return true;
}
// and goes back (why: only if that is why they came off; nothing: whatever the reason)
function hkPullBack(side, why) { const g = L.pl[hkGk(side)]; if (g.pulled && (!why || g.pulled === why)) g.pulled = false; }
// where everyone lines up for a face-off at (x, y): [x, y] by player
function hkFaceoffSpots(x, y) {
  const at = { C: [.8, 0], LW: [1.3, -3.2], RW: [1.3, 3.2], LD: [5, -2.2], RD: [5, 2.2] };
  const take = [hkTaker(0), hkTaker(1)];
  return L.pl.map((p, i) => {
    if (hkIsGk(p)) return hkGoalSpot(p.side, x, y);
    // (the taker stands in for a centre in the box; an extra skater lines up behind the dot)
    const d = hkDir(p.side), [back, v] = i === take[p.side] ? at.C : p.pos === 'G' ? [3, 0] : at[p.pos], o = { x: x - d * back, y: y + v * d, vx: 0, vy: 0 };
    hkBound(o, .6, 0); hkNetOut(o, .5, 0); return [o.x, o.y];
  });
}
// play stops, and a face-off follows at (x, y)
function hkWhistle(x, y, msg, big, deadT, noChange) {
  const P = L.puck; P.vx = P.vy = 0; if (P.st === 'held') hkPuckAt(P.x, P.y); else P.k = 'in';
  GD.noChange = noChange == null ? -1 : noChange;
  GD.next = { x, y }; GD.deadT = deadT || HK_PACE.dead; if (msg) GD.msg = msg; if (big) GD.big = { k: big };
  for (const p of L.pl) { p.act = ''; p.actT = 0; }
  hkGo('dead');
  hkCpuTimeout(); hkCpuPotion();
}
function hkFaceoffAt(x, y) {
  // a goalie pulled for an extra skater stays off for a face-off in the other half, and goes back for one in their own
  for (const s of [0, 1]) { const g = L.pl[hkGk(s)]; if (g.pulled && (g.pulled === 'delay' || hkUp(s, x) < HK_RULES.len / 2)) g.pulled = false; }
  hkLines();
  // the coaches make their calls, and the lines change at the whistle (not the side that iced it)
  // (not a second time for the same whistle, after a timeout taken while they lined up: GD.again)
  const again = GD.again; GD.again = false;
  if (!again) { hkCallsFaceoff(); if (GD.ph !== 'break') hkChangeWhistle(GD.noChange == null ? -1 : GD.noChange); } GD.noChange = -1;
  GD.fo = { x, y }; GD.set = { from: L.pl.map(p => [p.x, p.y]), to: hkFaceoffSpots(x, y) };
  for (const p of L.pl) { p.stun = 0; p.cd = 0; p.act = ''; }
  hkPuckAt(x, y); L.touch = []; L.oneT = null; L.press = -1;
  hkGo('set');
}
// the drop: hands and size against hands and size, and by hand your press (09-hands.js); the winner draws it back to
// whoever is furthest back
function hkDrop() {
  const c = [0, 1].map(s => L.pl[hkTaker(s)]), val = p => p.r.hnd * .7 + p.r.siz * .3, edge = hkDrawEdge() * (GD.you === 0 ? 1 : -1) + (hkGxOf(c[0]).fo || 0) - (hkGxOf(c[1]).fo || 0), win = R() < clamp(.5 + (val(c[0]) - val(c[1])) * .05 + edge, .1, .9) ? 0 : 1, w = c[win];
  for (const s of [0, 1]) { hkBoxAdd(s, c[s].ri, 'fot'); if (s === win) hkBoxAdd(s, c[s].ri, 'fow'); }
  G.drops++;
  for (const p of L.pl) { p.vx = p.vy = 0; }
  L.eye = [[GD.fo.x, GD.fo.y], [GD.fo.x, GD.fo.y]];
  const back = hkSk(win).filter(p => p !== w).sort((a, b) => hkUp(win, a.x) - hkUp(win, b.x))[0];
  hkEv('faceoff', w.n, c[1 - win].n);
  G.poss = 1 - win; hkGain(L.pl.indexOf(w), 'faceoff');
  const mine = hkHandsOn() ? (GD.press == null ? ' You didn\'t press: Space as the puck lands.' : hkDrawEdge() > 0 ? (hkDrawEdge() > .2 ? ' Your timing: dead on.' : ' Your timing: good.') : ' You pressed too early.') : '';
  GD.msg = `${w.n} wins the face-off for ${G.teams[win].name}.${mine}`; GD.drew = { edge: Math.round(edge * 100) / 100, win };
  hkGo('live');
  if (back) hkPass(L.pl.indexOf(back));
}
function hkTick(dt) {
  if (!GD || GD.ph === 'over') return;
  GD.t += dt; HKI.now += dt;
  if (GD.ph === 'intro') { if (GD.t >= HK_PACE.intro) hkGo('drop'); return; }
  if (GD.ph === 'live') {
    GD.acc += dt;
    while (GD.acc >= HK_DT && GD.ph === 'live') {
      GD.acc -= HK_DT; hkStep(HK_DT); if (GD.ph !== 'live') break;
      hkMinutes(Math.min(HK_DT, G.clock));
      const r = hkRun(HK_DT);
      if (r.out.length) hkLines();
      hkPullThink();
      if (r.end) { hkPeriodOver(); break; }
    }
    return;
  }
  if (GD.ph === 'dead') { if (GD.t >= GD.deadT) hkFaceoffAt(GD.next.x, GD.next.y); return; }
  if (GD.ph === 'set') {
    const W = GD.set, u = Math.min(1, GD.t / HK_PACE.set), e = u * u * (3 - 2 * u);
    L.pl.forEach((p, i) => { const a = W.from[i], b = W.to[i], px = p.x, py = p.y; p.x = lerp(a[0], b[0], e); p.y = lerp(a[1], b[1], e); const v = hyp(p.x - px, p.y - py); p.run += v * 1.6; if (v > 1e-3) { p.fx = (p.x - px) / v; p.fy = (p.y - py) / v; } });
    if (u >= 1) { for (const p of L.pl) { p.vx = p.vy = 0; if (p.pos !== 'G') { p.fx = hkDir(p.side); p.fy = 0; } } hkGo('drop'); }
    return;
  }
  if (GD.ph === 'drop') { if (GD.t >= HK_PACE.drop) hkDrop(); return; }
  if (GD.ph === 'break') { if (GD.t >= HK_PACE.break) hkFaceoffAt(HK_RULES.len / 2, 0); return; }
  if (GD.ph === 'so') hkSoTick(dt);
}
function hkMinutes(s) { for (const p of L.pl) if (!p.off) G.stat[p.side][p.ri].sec += s; G.secs += s; }
// a goal (05-live.js): the score, the scorer and up to two assists (the last two of their side to touch it before them)
function hkGoalScored(S) {
  const p = L.pl[S.i], n = hkStrength(), str = n[S.side] > n[1 - S.side] ? 'pp' : n[S.side] < n[1 - S.side] ? 'sh' : 'even';
  // (a goal while a penalty was coming on the other side wipes it out)
  const wiped = GD.delay && GD.delay.side !== S.side ? L.pl[GD.delay.i].n : ''; if (wiped) { hkPullBack(S.side, 'delay'); GD.delay = null; }
  const r = hkGoal(S.side), as = S.touch.filter(i => i !== S.i && L.pl[i].side === S.side).reverse().slice(0, 2).map(i => L.pl[i]);
  hkBoxAdd(S.side, p.ri, 'g'); for (const a of as) hkBoxAdd(S.side, a.ri, 'a');
  if (str === 'even') G.sysLog[S.side][G.call[S.side].att].g++;
  hkManaAdd(1 - S.side, HK_MANA.scored);
  G.log.push({ p: G.p, clock: Math.round(G.clock * 10) / 10, side: S.side, who: p.n, ri: p.ri, k: S.kind, a: as.map(a => a.n), str, en: !!S.en });
  hkEv('goal', p.n, S.kind);
  const how = S.en ? 'scores into the empty net' : S.kind === 'one' ? 'one-times it in' : S.kind === 'slap' ? `scores with a slap shot from ${S.dist} metres` : 'scores';
  const msg = `Goal! ${p.n} ${how} for ${G.teams[S.side].name}${str === 'pp' ? ' on the power play' : str === 'sh' ? ', short-handed' : ''}.${as.length ? ` From ${as.map(a => a.n).join(' and ')}.` : ''}${r.freed ? ' The penalty is over.' : ''}${wiped ? ` The penalty on ${wiped} is wiped out.` : ''}`;
  hkPuckAt(S.gx + S.dir * .5, clamp(L.puck.y, -.8, .8)); GD.net = { end: S.gx > HK_RULES.len / 2 ? 1 : 0 };
  if (r.over) { GD.msg = msg; GD.big = { k: 'goal' }; return hkEnd(); }
  hkWhistle(HK_RULES.len / 2, 0, msg, 'goal', HK_PACE.goal);
}
// icing on side (05-live.js saw it cross): back to a face-off in that side's own end. True: play has stopped
function hkIcing(side) {
  // a penalty that was waiting is called at any whistle: its face-off, not this one
  if (GD.delay) { hkPenaltyCall(); return true; }
  const [x] = hkAt(side, HK_DOTS.x[0], 0);
  hkEv('icing', G.teams[side].name); G.icings++;
  hkWhistle(x, (L.puck.y < 0 ? -1 : 1) * HK_DOTS.y, `Icing on ${G.teams[side].name}. The face-off comes back to their end, and they may not change.`, 'icing', 0, side);
  return true;
}
// the goalie covers the puck (06-cpu.js): a face-off beside that net
function hkFreeze(h) {
  if (GD.delay) return hkPenaltyCall();
  const g = L.pl[h], x = g.x < HK_RULES.len / 2 ? HK_DOTS.x[0] : HK_DOTS.x[1];
  hkEv('freeze', g.n);
  hkWhistle(x, (L.eye[g.side][1] < 0 ? -1 : 1) * HK_DOTS.y, `${g.n} covers the puck. Face-off.`);
}
function hkPeriodOver() {
  const was = G.p, r = hkPeriodEnd();
  for (const g of [L.pl[hkGk(0)], L.pl[hkGk(1)]]) g.pulled = false;
  if (r === 'over') { GD.delay = null; return hkEnd(); }
  hkPuckAt(L.puck.x, L.puck.y);
  if (r === 'shootout') {
    // each side's shooters, best shot first; they go round again if it lasts. Penalties are over
    GD.delay = null; G.box = []; G.wait = [];
    GD.so = { order: [0, 1].map(s => L.pl.map((p, i) => i).filter(i => L.pl[i].side === s && L.pl[i].pos !== 'G').sort((a, b) => L.pl[b].r.sht - L.pl[a].r.sht)), cur: null, last: null };
    GD.msg = `Still level at ${G.score[0]}. It goes to a shootout.`;
    return hkGo('so');
  }
  GD.msg = r === 'ot' ? `Level at ${G.score[0]} after three periods. Sudden death: the next goal wins.` : `End of the ${hkPeriodName(was)}: ${G.teams[0].name} ${G.score[0]}, ${G.teams[1].name} ${G.score[1]}.`;
  if (r === 'period' && G.p === HK_RULES.periods) for (const s of hkFansLate()) GD.msg += ` ${G.teams[s].name}'s fans are still singing.`;
  // (a penalty that was coming when the period ended is served from the start of the next)
  if (GD.delay) hkPenaltyCall(true);
  // everyone rests between periods, the ice is scraped, and both sides get a mana
  hkChangeWhistle(-1, true); hkPondBreak(); for (const s of [0, 1]) hkManaAdd(s, HK_MANA.brk);
  hkGo('break');
  hkCpuPotion();
}
/* ---------- the shootout ---------- */
// the next try: the shooter at centre with the puck, the goalie in the net, everyone else off
function hkSoNext() {
  const s = hkSoTurn(), order = GD.so.order[s], i = order[G.so.tries[s] % order.length], sh = L.pl[i], gi = hkGk(1 - s), g = L.pl[gi];
  for (const p of L.pl) { p.off = true; p.box = false; p.pulled = false; p.vx = p.vy = 0; p.stun = 0; p.cd = 0; p.act = ''; p.actT = 0; }
  sh.off = false; g.off = false;
  sh.x = HK_RULES.len / 2; sh.y = 0; sh.fx = hkDir(s); sh.fy = 0;
  [g.x, g.y] = hkGoalSpot(1 - s, sh.x, sh.y); L.eye[1 - s] = [sh.x, sh.y];
  L.lunge = null; L.wind = null; GD.meter = null; G.poss = 1 - s; hkGain(i, 'so');
  GD.so.cur = { side: s, i, gi, st: 'ready', t: 0, scored: false, win: null, deke: R() < .5 ? -1 : 1, shotAt: 5 + R() * 2.5, wait: .22 + R() * .25, cut: 0 };
  GD.msg = `Shootout: ${sh.n} for ${G.teams[s].name}, against ${g.n}.`;
  GD.t = 0;
}
function hkSoTick(dt) {
  const C = GD.so.cur;
  if (!C) { if (GD.t >= HK_PACE.soGap) hkSoNext(); return; }
  if (C.st === 'ready') { if (GD.t >= HK_PACE.soReady) { C.st = 'go'; GD.acc = 0; } return; }
  if (C.st === 'go') {
    GD.acc += dt;
    while (GD.acc >= HK_DT && C.st === 'go') {
      GD.acc -= HK_DT; hkStep(HK_DT); C.t += HK_DT;
      if (C.st !== 'go') break;
      // out of time, or the puck has got away from them and stopped, or gone behind the net
      const P = L.puck, sh = L.pl[C.i], lost = P.st === 'free' && P.k !== 'shot' && hyp(P.vx, P.vy) < .5;
      if (C.t >= HK_PACE.soMax || lost || (P.st === 'held' && (P.h !== C.i || (sh.x - hkGoalX(C.side)) * hkDir(C.side) > .5))) hkSoResult(false, 'runs out of room');
    }
    return;
  }
  if (GD.t >= HK_PACE.so) { if (C.win != null) return hkEnd(); GD.so.cur = null; GD.t = 0; }
}
// the shot in a try has reached the goal line (05-live.js)
function hkSoLanded(S) {
  const g = L.pl[GD.so.cur.gi];
  if (S.res !== 'goal' && S.res !== 'miss') { g.act = 'save'; g.actT = .35; }
  hkSoResult(S.res === 'goal', S.res === 'miss' ? 'shoots wide' : `is stopped by ${g.n}`);
}
function hkSoResult(scored, how) {
  const C = GD.so.cur, p = L.pl[C.i];
  C.st = 'done'; C.scored = scored; GD.t = 0; GD.meter = null;
  if (scored) { GD.so.last = { side: C.side, who: p.n, ri: p.ri }; (GD.so.lasts = GD.so.lasts || {})[C.side] = GD.so.last; hkPuckAt(hkGoalX(C.side) + hkDir(C.side) * .5, clamp(L.puck.y, -.8, .8)); GD.net = { end: hkGoalX(C.side) > HK_RULES.len / 2 ? 1 : 0 }; }
  else hkPuckAt(L.puck.x, L.puck.y);
  hkEv(scored ? 'sogoal' : 'sosave', p.n);
  C.win = hkSoShot(C.side, scored);
  GD.big = { k: scored ? 'goal' : 'nogoal' };
  GD.msg = `Shootout: ${p.n} ${scored ? 'scores' : how}. ${G.teams[0].name} ${G.so.goals[0]}, ${G.teams[1].name} ${G.so.goals[1]}.`;
  if (C.win != null) { const l = (GD.so.lasts || {})[C.win] || GD.so.last; G.log.push({ p: G.p, clock: 0, side: C.win, who: l.who, ri: l.ri, k: 'so', a: [], str: 'so', en: false }); }
  if (HK_HOOK.onPhase) try { HK_HOOK.onPhase('so'); } catch (e) { console.error(e); }
}
function hkEnd() {
  const [a, b] = G.score, w = G.over.win;
  GD.msg = `Final: ${G.teams[w].name} win ${Math.max(a, b)} to ${Math.min(a, b)}${G.over.so ? ' in a shootout' : G.over.ot ? ' in sudden death' : ''}.`;
  hkGo('over');
  if (HK_HOOK.onOver) try { HK_HOOK.onOver(hkSummary()); } catch (e) { console.error(e); }
}
// the game clock as it shows: m:ss, and tenths in the last ten seconds
function hkClockText() { const t = Math.max(0, G.clock); if (t < 10) return t.toFixed(1); const s = Math.ceil(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function hkSummary() {
  return { score: G.score.slice(), teams: G.teams.map(t => t.name), win: G.over ? G.over.win : null, p: G.p, ot: G.over ? G.over.ot : 0, so: !!(G.over && G.over.so), mins: G.mins,
    shots: G.sog.slice(), drops: G.drops, icings: G.icings, pens: G.pens.slice(), calls: G.call.map(c => Object.assign({}, c)), skill: G.skill.slice(), sysLog: JSON.parse(JSON.stringify(G.sysLog)), to: G.to.slice(), casts: (G.casts || []).slice(), pots: (G.pots || []).slice(), mana: (G.mana || [0, 0]).slice(), spirit: (G.spirit || [0, 0]).map(Math.round), secs: Math.round(G.secs), box: hkBox(), log: G.log.slice() };
}
// the box score: by side, each player who played, with their line, and the team's totals
function hkBox() {
  const keys = ['g', 'a', 'sog', 'att', 'hit', 'blk', 'give', 'take', 'fow', 'fot', 'pim', 'sa', 'sv', 'sh'];
  return G.teams.map((T, s) => {
    const rows = T.roster.map((m, i) => { const at = G.on[s].indexOf(i); return Object.assign({ n: m.n, kind: m.kind, num: m.num, ri: i, pos: at >= 0 ? HK_POS[at] : '' }, G.stat[s][i], { sec: Math.round(G.stat[s][i].sec), sta: Math.round(G.sta[s][i] * 100) / 100, on: at >= 0 }); }).filter(r => r.sec > 0 || G.on[s].includes(r.ri));
    const tot = {}; for (const k of keys) tot[k] = rows.reduce((a, r) => a + r[k], 0);
    return { team: T.name, rows, tot };
  });
}
// a whole game at once, CPU against CPU, through the same flow; watch is the time it would take to watch
function hkSimGame(opts) {
  const hooks = Object.assign({}, HK_HOOK), was = opts && opts.keep ? { G, GD, L, rand: engRand } : null;
  HK_HOOK.onOver = HK_HOOK.onPhase = HK_HOOK.onSnap = HK_HOOK.onEv = null;
  let watch = 0, out;
  try {
    hkStart(opts);
    for (let i = 0; i < 400000 && GD.ph !== 'over'; i++) { hkTick(HK_DT * 4); watch += HK_DT * 4; }
    out = Object.assign(hkSummary(), { watch: Math.round(watch) });
  } finally { Object.assign(HK_HOOK, hooks); if (was) { G = was.G; GD = was.GD; L = was.L; engRand = was.rand; } }
  return out;
}
