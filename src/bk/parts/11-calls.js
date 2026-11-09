/* The Charter Court: the call (issue #77, phase 4). Each side has a standing call: an offense set, a defense, and two
   stances, Pace on offense and Pressure on defense (G.call[side]: { off, def, pace, press }). It stays until it's
   changed: yours by you (in Manage and You play), the CPU's at the start of each of its possessions (and each of yours,
   for its defense), by its coach's skill (G.skill: 0 Squire, at random, stances too; 1 Knight; 2 Archmage).
   Each possession is played in the calls on at its start (G.cur: { off, def, side, stale, star }).
   - The sets move the five and steer the player with the ball (BK_SETS): Pick and roll (picks early and often), Post up
     (the bigs deep on the blocks, fed inside), Motion (cuts and passes), Isolation (the best scorer, the rest cleared
     out), Spread for three (four outside the arc) and Feed the hot hand (to whoever's on fire, or the best shooter).
   - The defenses (BK_DEFS): Man; Zone (areas, a 2-3: strong inside, soft on the perimeter); Press (full court: steals in
     the backcourt, a step lost if it's broken, and tiring); Switch everything (every pick is a switch: a mismatch to
     find); Pack the paint (sag off the shooters into the lane).
   - BK_EDGE is the rock, paper, scissors: how a set does against a defense, +1, 0 or -1, a few points on every shot,
     with the ratings on top.
   - The scout: a set run again on the next possession is guarded better, more again the third time (G.scout).
   - Pace: Push (quick shots, more fast breaks, more turnovers, more tiring), Balanced, Grind (work the clock: fewer,
     better shots, less tiring). Pressure: Gamble (more steals and blocks, more fouls), Balanced, Sit back (fewer
     fouls, more open shots).
   - Timeouts: BK_TO.n a half (and one in each overtime), at a stoppage or with your ball. Five seconds of rest: breath
     back for everyone, the other side's hot hand cools, and the play restarts with the ball where it was.
   G.setLog[side][set]: { n: possessions, pts } (how each set is going). opts.calls fixes both sides' calls for the
   lab ([{ off, def, pace, press } | null, ...]: a fixed side never changes its call). */
const BK_SETS = {
  pick: { n: 'Pick and roll', desc: 'A big screens for the player with the ball, again and again: they switch, go over or trap, and the big rolls.', w: { pick: 3.5 } },
  post: { n: 'Post up', desc: 'The bigs set up deep on the blocks and the ball goes inside to them.', w: { drive: 1.2 }, feed: 'big', inside: .07, spot: { C: [1.9, -1.5], PF: [2.3, 2.1] } },
  motion: { n: 'Motion', desc: 'Everyone moves: cuts to the rim, passes, and the open player shoots.', w: { pass: 1.3 }, cut: 2.4 },
  iso: { n: 'Isolation', desc: 'Clear out for your best scorer: one on one, the others spaced wide.', w: { pass: .6, move: 2 }, feed: 'star', cut: .3,
    spot: { SG: [1.0, -6.9], SF: [1.0, 6.9], PF: [5.6, 6.4], C: [5.6, -6.4] } },
  spread: { n: 'Spread for three', desc: 'Four outside the arc and one inside: the floor opens, and the threes fly.', w: { drive: 1.15 }, three: .12, spot: { SG: [7.7, -3.4], PF: [7.3, 3.9] } },
  hot: { n: 'Feed the hot hand', desc: 'Get it to whoever is on fire, or the best shooter: they shoot.', feed: 'hot' },
};
const BK_DEFS = {
  man: { n: 'Man', desc: 'Each player takes one man.' },
  zone: { n: 'Zone', desc: 'A 2-3 zone: each guards an area. Strong inside and on the boards, soft out at the arc.', zone: { PG: [6.3, 2.2], SG: [6.3, -2.2], SF: [2.6, 4.1], PF: [2.6, -4.1], C: [1.6, 0] }, reb: 1.15, lane: .5, inside: -.09 },
  press: { n: 'Press', desc: 'Pick them up full court: steals in the backcourt, layups if it is broken, and it tires your five.', back: 3, front: 1.6, lanes: 1.3, tire: 1.3 },
  switch: { n: 'Switch everything', desc: 'Every pick is a switch, and nobody gets lost: but a switch can leave a mismatch.', allSwitch: true, cut: .5 },
  pack: { n: 'Pack the paint', desc: 'Sag off the shooters into the lane: no room inside, but open threes.', sag: 1.2, lane: .4, inside: -.04 },
};
// a set against a defense: [+1 | 0 | -1, why]
const BK_EDGE = {
  'pick/man': [1, 'Two on two against man, the pick and roll gets someone open.'], 'pick/switch': [-1, 'They switch every pick, so nobody is ever open.'],
  'post/zone': [-1, 'The zone sits three deep in the paint.'], 'post/press': [1, 'The press leaves the bigs alone inside.'], 'post/switch': [1, 'A switch leaves a small guarding a big on the block.'], 'post/pack': [-1, 'The lane is packed.'],
  'motion/zone': [1, 'Cutters find the seams between the zone\'s areas.'], 'motion/press': [-1, 'The press jumps the passing lanes.'], 'motion/switch': [1, 'Constant cuts run the switchers ragged.'],
  'iso/man': [1, 'One on one against man is what Isolation wants.'], 'iso/zone': [-1, 'The zone shows a second defender on every drive.'], 'iso/press': [1, 'Beat the press one on one and it\'s a layup.'], 'iso/switch': [-1, 'They switch the best defender onto your scorer.'], 'iso/pack': [-1, 'Every drive runs into the packed paint.'],
  'spread/man': [-1, 'Man stays home on the shooters.'], 'spread/zone': [1, 'The zone is soft at the arc.'], 'spread/press': [-1, 'The press runs the shooters off the line.'], 'spread/pack': [1, 'Packing the paint leaves the shooters open.'],
};
const bkEdge = (o, d) => BK_EDGE[o + '/' + d] || [0, ''];
const BK_PACES = { push: { n: 'Push', desc: 'Quick shots and more fast breaks, but more turnovers, and it tires your five.', think: .7, shootAt: -.14, behind: 3, risk: 1.25, tire: 1.15 },
  bal: { n: 'Balanced', desc: 'The usual.', think: 1, shootAt: 0, behind: 2, risk: 1, tire: 1 },
  grind: { n: 'Grind', desc: 'Work the clock: fewer but better shots, and less tiring.', think: 1.25, shootAt: .14, behind: 1, risk: .9, tire: .9, look: .025, hold: 1.7 } };
const BK_PRESSES = { gamble: { n: 'Gamble', desc: 'More steals and blocks, and more fouls.', steal: 1.45, block: 1.3, foul: 1.6, con: 1 },
  bal: { n: 'Balanced', desc: 'The usual.', steal: 1, block: 1, foul: 1, con: 1 },
  sit: { n: 'Sit back', desc: 'Fewer fouls, but more open shots.', steal: .6, block: .85, foul: .55, con: .82 } };
const BK_TO = { n: 3, ot: 1, secs: 5, sta: 6 };
const BK_SKILL = ['Squire', 'Knight', 'Archmage'];
const BK_SET_IDS = Object.keys(BK_SETS), BK_DEF_IDS = Object.keys(BK_DEFS);

function bkCallsStart(o) {
  G.call = [0, 1].map(s => Object.assign({ off: 'motion', def: 'man', pace: 'bal', press: 'bal' }, (o.calls && o.calls[s]) || {}));
  G.fixed = [0, 1].map(s => !!(o.calls && o.calls[s]));
  G.scout = [{ last: '', n: 0 }, { last: '', n: 0 }]; G.seen = [[], []]; G.cur = null;
  G.setLog = [{}, {}]; G.to = [BK_TO.n, BK_TO.n]; G.toUsed = [0, 0]; G.toAt = [-9, -9]; G.run = { side: -1, pts: 0 };
  G.possScore = null;
}
const bkCpuSide = side => !G.fixed[side] && !(GD.mode !== 'watch' && side === GD.you);
const bkPace = side => BK_PACES[G.call ? G.call[side].pace : 'bal'] || BK_PACES.bal;
const bkPress = side => BK_PRESSES[G.call ? G.call[side].press : 'bal'] || BK_PRESSES.bal;
// the possession's set and defense (the calls on when it started)
const bkSetNow = () => (G.cur && BK_SETS[G.cur.off]) || BK_SETS.motion;
const bkDefNow = () => (G.cur && BK_DEFS[G.cur.def]) || BK_DEFS.man;
/* a possession starts for side: the CPU calls (by skill), the scout counts the set, and its points are credited to
   the last possession's set */
function bkPossStart(side) {
  bkPossEnd();
  // (the defense sets first, and the offense sees it: an Archmage runs what beats it)
  if (bkCpuSide(1 - side)) G.call[1 - side].def = bkCpuDef(1 - side);
  if (bkCpuSide(side)) G.call[side].off = bkCpuSet(side);
  for (const s of [0, 1]) if (bkCpuSide(s)) Object.assign(G.call[s], bkCpuStance(s));
  const off = G.call[side].off, sc = G.scout[side];
  if (sc.last === off) sc.n++; else { sc.last = off; sc.n = 1; }
  G.seen[side].push(off); if (G.seen[side].length > 8) G.seen[side].shift();
  G.cur = { side, off, def: G.call[1 - side].def, stale: Math.min(2, sc.n - 1), star: bkStar(side) };
  G.possScore = G.score[side];
}
function bkPossEnd() {
  const C = G.cur; if (!C || G.possScore == null) return;
  const L0 = G.setLog[C.side][C.off] || (G.setLog[C.side][C.off] = { n: 0, pts: 0 });
  L0.n++; L0.pts += G.score[C.side] - G.possScore; G.possScore = null;
}
// the offense's best scorer (Isolation's star): handle, touch and speed
function bkStar(side) { const on = G.on[side], T = G.teams[side]; return on.reduce((b, ri) => { const r = T.roster[ri].r, v = r.hnd + r.tch + r.spd * .5; return v > b[1] ? [ri, v] : b; }, [on[0], -1])[0]; }
// what the calls are worth on a shot by the offense: the matchup and the scout
function bkCallMod(p, dist) {
  const C = G.cur; if (!C || p.side !== C.side) return 0;
  const inside = dist != null && dist < 3 ? ((BK_SETS[C.off].inside && BK_ROLE[p.pos] === 'big' ? BK_SETS[C.off].inside : 0) + (BK_DEFS[C.def].inside || 0)) : 0;
  return bkEdge(C.off, C.def)[0] * .045 - C.stale * .03 + (bkPace(p.side).look || 0) + inside;
}
// where a player lines up in the set (the default spots, or the set's own)
function bkSpot(side, pos) { const S = G.cur && G.cur.side === side ? BK_SETS[G.cur.off] : null; return (S && S.spot && S.spot[pos]) || BK_SPOT[pos]; }
// a defender's spot in a zone: their area, leaning toward an attacker in it (tight on the ball)
function bkZoneSpot(p) {
  const D = bkDefNow(), side = 1 - p.side, at = bkAt(side, ...D.zone[p.pos]);
  const [a, ad] = bkNearest(at[0], at[1], bkOffense()); if (!a || ad > 3) return at;
  const onBall = L.pl.indexOf(a) === bkHand(), hx = bkHoopX(side), k = onBall ? 1 : .55, tx = lerp(at[0], a.x, k), ty = lerp(at[1], a.y, k);
  const d = hyp(hx - tx, ty) || 1; return [tx + (hx - tx) / d * .7, ty - ty / d * .7];
}
/* ---------- timeouts ---------- */
// side calls one: '' or why not. At a stoppage, or with their own ball in a live play
function bkTimeout(side) {
  if (!G.to || G.to[side] <= 0) return 'No timeouts left.';
  const ok = ['dead', 'walk'].includes(GD.ph) || (GD.ph === 'live' && G.poss === side && L.ball.st === 'held' && !L.shot);
  if (!ok) return GD.ph === 'live' ? 'Only with the ball in your hands.' : 'Not now.';
  G.to[side]--; G.toUsed[side]++; G.toAt[side] = G.poss0[0] + G.poss0[1];
  // (the run that may have brought it on is over as far as the coaches are concerned)
  if (G.run.side === 1 - side) G.run = { side: -1, pts: 0 };
  // breath back, the other side's hot hand cooled, and the bench gets a word in
  if (G.stam) { const k = Math.min(1, bkStamK()); for (const s of [0, 1]) G.stam[s] = G.stam[s].map(v => Math.min(100, v + BK_TO.sta * k)); }
  const hot = G.hot[1 - side], cooled = Object.keys(hot).filter(ri => hot[ri] >= BK_FIRE.n);
  for (const ri of cooled) hot[ri] = 0;
  GD.toWas = { ph: GD.ph, side, live: GD.ph === 'live' };
  GD.msg = `Timeout, ${G.teams[side].name}.${cooled.length ? ` ${cooled.map(ri => G.teams[1 - side].roster[ri].n).join(' and ')} cool${cooled.length === 1 ? 's' : ''} off.` : ''}`;
  bkInputClear(); bkEv('timeout', G.teams[side].name);
  bkGo('timeout');
  for (const s of [0, 1]) bkCoachSubs(s, false);
  return '';
}
// after a timeout: play restarts
function bkTimeoutOver() {
  const W = GD.toWas; GD.toWas = null;
  // (with the ball in a live play, or mid-walk, or after a reach: the same possession, the five walked back to the set
  // with the clocks stopped; after any other dead ball, the walk up the floor that was coming)
  if (W && (W.live || W.ph === 'walk' || GD.keep)) { GD.keep = false; GD.keepClock = true; return bkWalk(false); }
  bkWalk(true);
}
// the CPU's coach calls one: a Knight or better when the other side is on a run, or the five is spent with nobody fresh
// on the bench, or someone of theirs on the floor is on fire (never twice inside four possessions); an Archmage keeps one
// for the last minute
function bkCpuTimeout(side) {
  const sk = G.skill[side]; if (!sk || !G.to[side] || !bkCpuSide(side) || G.poss0[0] + G.poss0[1] - G.toAt[side] < 4) return false;
  // (tired: the five is spent and the bench has nobody fresh to bring on)
  const run = G.run.side === 1 - side ? G.run.pts : 0, tired = G.on[side].reduce((a, ri) => a + G.stam[side][ri], 0) / 5 < 45 && !bkBench(side).some(ri => G.stam[side][ri] >= BK_STAM.fresh);
  const fire = G.on[1 - side].some(ri => (G.hot[1 - side][ri] || 0) >= BK_FIRE.n), lastMin = G.q >= 4 && G.clock < 30;
  if (sk >= 2 && G.to[side] === 1 && !lastMin && G.q >= 3) return false;
  if (run >= 7 || tired || fire || (sk >= 2 && lastMin && Math.abs(G.score[0] - G.score[1]) <= 3 && G.poss === side)) return !bkTimeout(side);
  return false;
}
/* ---------- the CPU's calls by skill ---------- */
// mean of a rating over side's five, or over its players in some roles
function bkMean(side, k, roles) { const T = G.teams[side], on = G.on[side].filter((ri, i) => !roles || roles.includes(BK_ROLE[BK_POS[i]])); return on.reduce((a, ri) => a + T.roster[ri].r[k], 0) / Math.max(1, on.length); }
function bkCpuSet(side) {
  const sk = G.skill[side], them = 1 - side;
  if (!sk) return pick(BK_SET_IDS);
  const late = G.q >= 4 && G.clock < G.qlen * .4, diff = G.score[side] - G.score[them];
  const w = { pick: 1.2, post: .6 + Math.max(0, bkMean(side, 'siz', ['big']) + bkMean(side, 'hop', ['big']) - bkMean(them, 'siz', ['big']) - bkMean(them, 'hop', ['big'])) * .3,
    motion: 1, iso: .4 + Math.max(0, Math.max(...G.on[side].map(ri => G.teams[side].roster[ri].r.hnd)) - 7) * .4, spread: .5 + Math.max(0, bkMean(side, 'tch') - 6) * .5 + (late && diff < -5 ? 1.5 : 0),
    hot: Object.values(G.hot[side]).some(v => v >= BK_FIRE.n) ? 3 : .2 };
  // the scout: a set run twice is worth less a third time
  const sc = G.scout[side]; if (sc.last && sc.n >= 2) w[sc.last] *= .35;
  // a Knight leans to what beats the defense on the floor; an Archmage runs it
  { const d = G.call[them].def, k0 = sk >= 2 ? .9 : .45; for (const k in w) w[k] *= 1 + k0 * bkEdge(k, d)[0]; }
  return wpick(w);
}
function bkCpuDef(side) {
  const sk = G.skill[side], them = 1 - side;
  if (!sk) return pick(BK_DEF_IDS);
  const late = G.q >= 4 && G.clock < G.qlen * .4, diff = G.score[side] - G.score[them];
  const w = { man: 1.4, zone: .6 + Math.max(0, bkMean(them, 'siz', ['big']) - 6) * .4 + Math.max(0, 6 - bkMean(them, 'tch')) * .3,
    press: .3 + (late && diff < -5 ? 2 : 0) + Math.max(0, 6 - bkMean(them, 'hnd', ['guard'])) * .4, switch: .6, pack: .5 + Math.max(0, 6 - bkMean(them, 'tch')) * .5 };
  // an Archmage reads your habits: the set you run most, and the defense that beats it
  if (sk >= 2 && G.seen[them].length >= 3) {
    const n = {}; for (const s of G.seen[them]) n[s] = (n[s] || 0) + 1;
    const fav = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    for (const k in w) w[k] *= 1 - .8 * bkEdge(fav, k)[0];
  }
  return wpick(w);
}
function bkCpuStance(side) {
  // (a Squire's stances are as random as its calls)
  if (!G.skill[side]) return { pace: pick(Object.keys(BK_PACES)), press: pick(Object.keys(BK_PRESSES)) };
  const late = G.q >= 4 && G.clock < G.qlen * .5, diff = G.score[side] - G.score[1 - side];
  return { pace: late && diff < -4 ? 'push' : late && diff > 4 ? 'grind' : 'bal', press: late && diff < -4 ? 'gamble' : G.tf[side] > BK_RULES.limit ? 'sit' : 'bal' };
}
// your call: kind 'off' | 'def' | 'pace' | 'press', and its id; '' when it took
function bkCall(side, kind, id) {
  const T = { off: BK_SETS, def: BK_DEFS, pace: BK_PACES, press: BK_PRESSES }[kind];
  if (!T || !T[id] || !G.call) return 'No such call.';
  G.call[side][kind] = id;
  // a defense or a pressure change takes hold at once; a set from the next possession
  if (G.cur && kind === 'def' && G.cur.side !== side) G.cur.def = id;
  return '';
}
// a run: points scored by one side since the other last scored
function bkRunAdd(side, pts) { if (G.run.side === side) G.run.pts += pts; else G.run = { side, pts }; }
