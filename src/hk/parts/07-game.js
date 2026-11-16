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
   - so: the shootout, a try a beat (phase 3 plays each one out on the ice).
   - over: the end; onOver hears the summary.
   Sudden death is HK_RULES.otSk skaters a side: the centre, a defender and a wing stay on (hkLines).
   The stats (G.stat, by side and roster index): g, a, sog (shots on goal), att (shots tried), hit, blk, give, take,
   fow and fot (face-offs won and taken), pim, sec (seconds on the ice), and for a goalie sa (shots faced) and sv
   (saves). G.log has every goal.
   GD is the game on show (not saved). The headless game (hkSimGame) runs this same flow with bigger steps, so the
   view and the bot can't drift apart. */
const HK_PACE = { intro: 1.3, set: .85, drop: .5, dead: 1, goal: 1.9, break: 2.4, so: 1 };
const HK_HOOK = { onOver: null, onPhase: null };
const HK_DOTS = { x: [8.5, HK_RULES.len - 8.5], y: 5.5 };
let GD = null;

function hkStart(opts) {
  const o = opts || {}, T = o.teams || [];
  hkSeed(o.seed);
  hkNewGame({ mins: o.mins });
  G.teams = [hkTeam(T[0] || HK_CLUBS.home), hkTeam(T[1] || HK_CLUBS.away)];
  G.on = G.teams.map(t => HK_POS.map(k => t.spot[k]));
  G.stat = G.teams.map(t => t.roster.map(() => ({ g: 0, a: 0, sog: 0, att: 0, hit: 0, blk: 0, give: 0, take: 0, fow: 0, fot: 0, pim: 0, sec: 0, sa: 0, sv: 0 })));
  G.log = []; G.secs = 0; G.poss = 0; G.drops = 0; G.icings = 0;
  hkNewPlay();
  GD = { ph: 'intro', t: 0, acc: 0, msg: `${G.teams[0].name} against ${G.teams[1].name}. The puck is about to drop.`, big: null, fo: null, set: null, next: null, deadT: HK_PACE.dead, so: null };
  hkLines(); hkFaceoffSpots(HK_RULES.len / 2, 0).forEach(([x, y], i) => { const p = L.pl[i]; p.x = x; p.y = y; p.vx = p.vy = 0; });
  GD.fo = { x: HK_RULES.len / 2, y: 0 }; hkPuckAt(GD.fo.x, GD.fo.y);
  return G;
}
function hkGo(ph) {
  GD.ph = ph; GD.t = 0;
  if (HK_HOOK.onPhase) try { HK_HOOK.onPhase(ph); } catch (e) { console.error(e); }
}
function hkBoxAdd(side, ri, k, n) { const b = G.stat[side][ri]; if (b) b[k] += n == null ? 1 : n; }
// the line under the rink: what just happened (GD.msg), from the play's events
const HK_SAY = {
  poke: e => `${e.s} pokes it off ${e.o}.`, hit: e => `${e.s} flattens ${e.o}!`, pick: e => `${e.s} picks off the pass.`,
  save: e => `Save by ${e.s}.`, rebound: e => `${e.s} stops it, and the rebound is loose.`, block: e => `${e.s} blocks the shot.`,
  wide: e => `${e.s} shoots wide.`, wind: e => `${e.s} winds up.`,
};
function hkSayEv(e) { if (GD && HK_SAY[e.k]) GD.msg = HK_SAY[e.k](e); if (GD && e.k === 'hit') GD.big = { k: 'hit' }; }
// the puck lies still at (x, y): nobody can take it until it is dropped
function hkPuckAt(x, y) { Object.assign(L.puck, { st: 'free', h: -1, x, y, vx: 0, vy: 0, k: 'in', to: -1, ice: -1, shot: null, tried: [], go: 0, skip: -1 }); L.wind = null; L.carry = null; }
// who is on the ice: each side's skaters by its strength now (02-rules.js), in the order they stay on
function hkLines() {
  const n = hkStrength();
  for (const p of L.pl) { if (p.pos === 'G') continue; p.off = ['C', 'LD', 'LW', 'RD', 'RW'].indexOf(p.pos) >= n[p.side]; }
}
// where everyone lines up for a face-off at (x, y): [x, y] by player
function hkFaceoffSpots(x, y) {
  const at = { C: [.8, 0], LW: [1.3, -3.2], RW: [1.3, 3.2], LD: [5, -2.2], RD: [5, 2.2] };
  return L.pl.map(p => {
    if (p.pos === 'G') return hkGoalSpot(p.side, x, y);
    const d = hkDir(p.side), [back, v] = at[p.pos], o = { x: x - d * back, y: y + v * d, vx: 0, vy: 0 };
    hkBound(o, .6, 0); hkNetOut(o, .5, 0); return [o.x, o.y];
  });
}
// play stops, and a face-off follows at (x, y)
function hkWhistle(x, y, msg, big, deadT) {
  const P = L.puck; P.vx = P.vy = 0; if (P.st === 'held') hkPuckAt(P.x, P.y); else P.k = 'in';
  GD.next = { x, y }; GD.deadT = deadT || HK_PACE.dead; if (msg) GD.msg = msg; if (big) GD.big = { k: big };
  for (const p of L.pl) { p.act = ''; p.actT = 0; }
  hkGo('dead');
}
function hkFaceoffAt(x, y) {
  hkLines();
  GD.fo = { x, y }; GD.set = { from: L.pl.map(p => [p.x, p.y]), to: hkFaceoffSpots(x, y) };
  for (const p of L.pl) { p.stun = 0; p.cd = 0; p.act = ''; }
  hkPuckAt(x, y); L.touch = []; L.oneT = null; L.press = -1;
  hkGo('set');
}
// the drop: hands and size against hands and size; the winner draws it back to whoever is furthest back
function hkDrop() {
  const c = [0, 1].map(s => L.pl[s * HK_POS.length]), val = p => p.r.hnd * .7 + p.r.siz * .3, win = R() < clamp(.5 + (val(c[0]) - val(c[1])) * .05, .2, .8) ? 0 : 1, w = c[win];
  for (const s of [0, 1]) { hkBoxAdd(s, c[s].ri, 'fot'); if (s === win) hkBoxAdd(s, c[s].ri, 'fow'); }
  G.drops++;
  for (const p of L.pl) { p.vx = p.vy = 0; }
  L.eye = [[GD.fo.x, GD.fo.y], [GD.fo.x, GD.fo.y]];
  const back = hkSk(win).filter(p => p !== w).sort((a, b) => hkUp(win, a.x) - hkUp(win, b.x))[0];
  hkEv('faceoff', w.n, c[1 - win].n);
  G.poss = 1 - win; hkGain(L.pl.indexOf(w), 'faceoff');
  GD.msg = `${w.n} wins the face-off for ${G.teams[win].name}.`;
  hkGo('live');
  if (back) hkPass(L.pl.indexOf(back));
}
function hkTick(dt) {
  if (!GD || GD.ph === 'over') return;
  GD.t += dt;
  if (GD.ph === 'intro') { if (GD.t >= HK_PACE.intro) hkGo('drop'); return; }
  if (GD.ph === 'live') {
    GD.acc += dt;
    while (GD.acc >= HK_DT && GD.ph === 'live') {
      GD.acc -= HK_DT; hkStep(HK_DT); if (GD.ph !== 'live') break;
      hkMinutes(Math.min(HK_DT, G.clock));
      const r = hkRun(HK_DT);
      if (r.out.length) hkLines();
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
  if (GD.ph === 'so') { if (GD.t >= HK_PACE.so) hkSoTry(); }
}
function hkMinutes(s) { for (const p of L.pl) if (!p.off) G.stat[p.side][p.ri].sec += s; G.secs += s; }
// a goal (05-live.js): the score, the scorer and up to two assists (the last two of their side to touch it before them)
function hkGoalScored(S) {
  const p = L.pl[S.i], n = hkStrength(), str = n[S.side] > n[1 - S.side] ? 'pp' : n[S.side] < n[1 - S.side] ? 'sh' : 'even';
  const r = hkGoal(S.side), as = S.touch.filter(i => i !== S.i && L.pl[i].side === S.side).reverse().slice(0, 2).map(i => L.pl[i]);
  hkBoxAdd(S.side, p.ri, 'g'); for (const a of as) hkBoxAdd(S.side, a.ri, 'a');
  G.log.push({ p: G.p, clock: Math.round(G.clock * 10) / 10, side: S.side, who: p.n, ri: p.ri, k: S.kind, a: as.map(a => a.n), str });
  hkEv('goal', p.n, S.kind);
  const how = S.kind === 'one' ? 'one-times it in' : S.kind === 'slap' ? `scores with a slap shot from ${S.dist} metres` : 'scores';
  const msg = `Goal! ${p.n} ${how} for ${G.teams[S.side].name}.${as.length ? ` From ${as.map(a => a.n).join(' and ')}.` : ''}`;
  hkPuckAt(S.gx + S.dir * .5, clamp(L.puck.y, -.8, .8)); GD.net = { end: S.gx > HK_RULES.len / 2 ? 1 : 0 };
  if (r.freed) hkLines();
  if (r.over) { GD.msg = msg; GD.big = { k: 'goal' }; return hkEnd(); }
  hkWhistle(HK_RULES.len / 2, 0, msg, 'goal', HK_PACE.goal);
}
// icing on side (05-live.js saw it cross): back to a face-off in that side's own end. True: play has stopped
function hkIcing(side) {
  const [x] = hkAt(side, HK_DOTS.x[0], 0);
  hkEv('icing', G.teams[side].name); G.icings++;
  hkWhistle(x, (L.puck.y < 0 ? -1 : 1) * HK_DOTS.y, `Icing on ${G.teams[side].name}. The face-off comes back to their end.`, 'icing');
  return true;
}
// the goalie covers the puck (06-cpu.js): a face-off beside that net
function hkFreeze(h) {
  const g = L.pl[h], x = g.x < HK_RULES.len / 2 ? HK_DOTS.x[0] : HK_DOTS.x[1];
  hkEv('freeze', g.n);
  hkWhistle(x, (L.eye[g.side][1] < 0 ? -1 : 1) * HK_DOTS.y, `${g.n} covers the puck. Face-off.`);
}
function hkPeriodOver() {
  const was = G.p, r = hkPeriodEnd();
  if (r === 'over') return hkEnd();
  hkPuckAt(L.puck.x, L.puck.y);
  if (r === 'shootout') {
    // each side's shooters, best shot first; they go round again if it lasts
    GD.so = { order: [0, 1].map(s => hkSk(s).concat(L.pl.filter(p => p.side === s && p.off)).sort((a, b) => b.r.sht - a.r.sht).map(p => L.pl.indexOf(p))) };
    GD.msg = `Still level at ${G.score[0]}. It goes to a shootout.`;
    return hkGo('so');
  }
  GD.msg = r === 'ot' ? `Level at ${G.score[0]} after three periods. Sudden death: the next goal wins.` : `End of the ${hkPeriodName(was)}: ${G.teams[0].name} ${G.score[0]}, ${G.teams[1].name} ${G.score[1]}.`;
  hkGo('break');
}
// one try in the shootout: the shooter's shot against the goalie's reflexes
function hkSoTry() {
  const s = hkSoTurn(), order = GD.so.order[s], p = L.pl[order[G.so.tries[s] % order.length]], g = L.pl[hkGk(1 - s)];
  const scored = R() < clamp(.32 + (p.r.sht - 5) * .03 - (g.r.ref - 5) * .03, .1, .65);
  hkBoxAdd(s, p.ri, 'att');
  if (scored) GD.so.last = { side: s, who: p.n, ri: p.ri };
  const win = hkSoShot(s, scored);
  GD.msg = `Shootout: ${p.n} ${scored ? 'scores' : `is stopped by ${g.n}`}. ${G.teams[0].name} ${G.so.goals[0]}, ${G.teams[1].name} ${G.so.goals[1]}.`;
  GD.t = 0;
  if (win != null) { const l = GD.so.last; G.log.push({ p: G.p, clock: 0, side: win, who: l.who, ri: l.ri, k: 'so', a: [], str: 'so' }); hkEnd(); }
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
    shots: G.sog.slice(), drops: G.drops, icings: G.icings, secs: Math.round(G.secs), box: hkBox(), log: G.log.slice() };
}
// the box score: by side, each player who played, with their line, and the team's totals
function hkBox() {
  const keys = ['g', 'a', 'sog', 'att', 'hit', 'blk', 'give', 'take', 'fow', 'fot', 'pim', 'sa', 'sv'];
  return G.teams.map((T, s) => {
    const rows = T.roster.map((m, i) => { const at = G.on[s].indexOf(i); return Object.assign({ n: m.n, kind: m.kind, num: m.num, ri: i, pos: at >= 0 ? HK_POS[at] : '' }, G.stat[s][i], { sec: Math.round(G.stat[s][i].sec) }); }).filter(r => r.sec > 0 || G.on[s].includes(r.ri));
    const tot = {}; for (const k of keys) tot[k] = rows.reduce((a, r) => a + r[k], 0);
    return { team: T.name, rows, tot };
  });
}
// a whole game at once, CPU against CPU, through the same flow; watch is the time it would take to watch
function hkSimGame(opts) {
  const hooks = Object.assign({}, HK_HOOK), was = opts && opts.keep ? { G, GD, L, rand: hkRand } : null;
  HK_HOOK.onOver = HK_HOOK.onPhase = null;
  let watch = 0, out;
  try {
    hkStart(opts);
    for (let i = 0; i < 400000 && GD.ph !== 'over'; i++) { hkTick(HK_DT * 4); watch += HK_DT * 4; }
    out = Object.assign(hkSummary(), { watch: Math.round(watch) });
  } finally { Object.assign(HK_HOOK, hooks); if (was) { G = was.G; GD = was.GD; L = was.L; hkRand = was.rand; } }
  return out;
}
