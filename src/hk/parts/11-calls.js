/* Black Ice: the call (issue #83, phase 5). Each side has a standing call (G.call[side]): a system with the puck
   (att), a system without it (def), a power-play and a penalty-kill setup (pp, pk), and two stances, Tempo and Edge.
   It stays until it's changed: yours by you (in Manage and You play), the CPU's by its coach at each face-off, by its
   skill (G.skill: 0 Squire, at random, whose skaters also chase the puck and pass on a guess; 1 Knight, who reads the
   score, the clock and the ratings; 2 Archmage, who also reads your call and answers it).
   - With the puck (HK_ATT): Cycle (work it low and wait for the look), Rush (carry it in at speed and shoot),
     Dump and chase (send it into the corner and go and get it), Point shots (feed the defenders, with a body in
     front) and Crash the net (shoot early, and everybody to the rebound).
   - Without it (HK_DEF): Forecheck (go at them in their own end), Trap (clog the middle of the ice), Box (guard the
     front of the net), Collapse (everyone low) and Man (each takes one).
   - HK_EDGE is the rock, paper, scissors: how a system does against the other side's, +1, 0 or -1: a little on every
     shot and every poke, with the ratings on top. hkEdgeNow(side) is the one in play for the side with the puck: the
     power-play and penalty-kill setups when a side is short (HK_PP against HK_PK).
   - The scout: a system kept on after a face-off is read a little better each time (G.scout, up to HK_SCOUT.max).
   - Tempo: Push (quicker, more shots, more giveaways, more tiring), Balanced, Sit on it (slower and safer, fewer
     shots, less tiring). Edge: Rough (more hits and pucks won, more penalties), Balanced, Clean.
   - The timeout: HK_TO.n a game, at a whistle. The skaters on the ice get their breath back: most use after an icing,
     when a tired line may not change.
   G.sysLog[side][att]: { t (seconds with the puck in it), sog, g } (how each system is going). opts.calls fixes both
   sides' calls for the lab ([{ att, def, pp, pk, tempo, edge } | null, ...]: a fixed side never changes its call). */
const HK_ATT = {
  cycle: { n: 'Cycle', desc: 'Work the puck low along the boards and wait for the look.', w: { pass: 1.5, carry: .8 }, at: .015 },
  rush: { n: 'Rush', desc: 'Carry it in at speed and shoot before they are set.', w: { carry: 1.7, pass: .8, dump: .3 }, at: -.012 },
  dump: { n: 'Dump and chase', desc: 'Send it into their corner and go and get it. Safe, and hard on their defenders.', w: { dump: 1.5, carry: .9 }, deep: 2, give: -.03 },
  point: { n: 'Point shots', desc: 'Feed the defenders at the blue line, with a body in front of the goalie.', w: { pass: 1.3 }, point: .6, front: 1 },
  crash: { n: 'Crash the net', desc: 'Shoot early and send everybody to the rebound.', w: { shoot: 1.3 }, at: -.012, front: 2, reb: 1.4, q: -.012 },
};
const HK_DEF = {
  fore: { n: 'Forecheck', desc: 'Go at them in their own end: pucks won high up the ice, and a rush given up if they get through. Tiring.', high: 99, tire: 1.12, wing: [2.5, 5] },
  trap: { n: 'Trap', desc: 'Clog the middle of the ice and wait: few rushes get through, but nobody goes and gets the puck.', high: 26, pick: 1.35, wing: [2.5, 5] },
  box: { n: 'Box', desc: 'Four in a box in front of the net: the front is safe, the points are open.', high: 13, block: 1.25, wing: [5, 3.2] },
  collapse: { n: 'Collapse', desc: 'Everyone low around the net: no room in close, and nobody near the points.', high: 11, block: 1.1, wing: [7.5, 2.4], slot: .02 },
  man: { n: 'Man', desc: 'Each skater takes one of theirs, everywhere.', high: 99, wing: [2.5, 5] },
};
const HK_PP = {
  umbrella: { n: 'Umbrella', desc: 'Three across the top: shots from the point and the half boards.', point: .9, w: { pass: 1.3 } },
  overload: { n: 'Overload', desc: 'Stack one side and move it fast: quick passes for the one-timer.', w: { pass: 1.8 }, one: .03 },
  front: { n: 'Net front', desc: 'A body in front of the goalie and everything at the net.', front: 2, w: { shoot: 1.3 }, reb: 1.3 },
};
const HK_PK = {
  box: { n: 'Box', desc: 'Four in a box in front: the front is safe, the top is open.', high: 10, block: 1.2, wing: [5, 3.2] },
  diamond: { n: 'Diamond', desc: 'One out high on the point man: point shots blocked, the slot a little softer.', high: 15, block: 1.35, slot: -.015, wing: [3.5, 4] },
  press: { n: 'Pressure', desc: 'Go at the puck everywhere: more pucks won, more open looks if it fails, and tiring.', high: 99, tire: 1.2, slot: -.02, poke: .04, wing: [2.5, 5] },
};
// a system against a system: [+1 | 0 | -1, why] for the side with the puck
const HK_EDGE = {
  'cycle/man': [1, 'The cycle drags man coverage round after it.'], 'cycle/collapse': [-1, 'With everyone collapsed there is no room down low.'], 'cycle/trap': [1, 'The trap has nobody down low to stop the cycle.'],
  'rush/fore': [1, 'A forecheck that is beaten gives up a rush.'], 'rush/trap': [-1, 'The trap clogs the middle the rush wants.'],
  'dump/trap': [1, 'A trap does nothing against a dump.'], 'dump/collapse': [-1, 'A collapse is already back to get the puck first.'], 'dump/fore': [-1, 'Their forecheckers are up the ice: their defenders get to the dump in peace.'],
  'point/collapse': [1, 'A collapse leaves the point open.'], 'point/box': [1, 'The box leaves the points alone.'], 'point/man': [-1, 'Man stays on the point men.'], 'point/fore': [-1, 'A forecheck never lets it get set at the point.'],
  'crash/man': [1, 'Man loses bodies in the scramble in front.'], 'crash/box': [-1, 'The box owns the front of the net.'], 'crash/collapse': [-1, 'A collapse has everyone at the net already.'],
};
const HK_EDGE_PP = {
  'umbrella/box': [1, 'The box leaves the top of the umbrella open.'], 'umbrella/diamond': [-1, 'The diamond\'s top man takes away the point.'],
  'overload/diamond': [1, 'The overload pulls the diamond apart.'], 'overload/press': [-1, 'Pressure jumps the quick passes.'],
  'front/box': [-1, 'The box clears the front of the net.'], 'front/press': [1, 'Pressure up high leaves the front of the net alone.'],
};
const HK_TEMPO = { push: { n: 'Push', desc: 'Quicker and more direct: more shots, more giveaways, and it tires your skaters.', think: .75, at: -.02, give: .025, tire: 1.15, carry: 1.3 },
  bal: { n: 'Balanced', desc: 'The usual.', think: 1, at: 0, give: 0, tire: 1, carry: 1 },
  sit: { n: 'Sit on it', desc: 'Slower and safer: fewer shots either way, and less tiring. For protecting a lead.', think: 1.2, at: .03, give: -.02, tire: .9, carry: .8, safe: 1 } };
const HK_EDGES = { rough: { n: 'Rough', desc: 'Finish every check: more hits and more pucks won, and more penalties.', hit: 1.5, battle: 1.3, foul: 1.5 },
  bal: { n: 'Balanced', desc: 'The usual.', hit: 1, battle: 1, foul: 1 },
  clean: { n: 'Clean', desc: 'Sticks down and skate: fewer penalties, fewer hits.', hit: .6, battle: .9, foul: .4 } };
const HK_TO = { n: 1, sta: .4, secs: 1.6 }, HK_SCOUT = { max: 2, q: .008 }, HK_CALL_Q = .016, HK_CALL_POKE = .02;
const HK_SKILL = ['Squire', 'Knight', 'Archmage'];
const HK_CALL_T = { att: HK_ATT, def: HK_DEF, pp: HK_PP, pk: HK_PK, tempo: HK_TEMPO, edge: HK_EDGES };
const HK_CALL0 = { att: 'cycle', def: 'man', pp: 'umbrella', pk: 'box', tempo: 'bal', edge: 'bal' };

function hkCallsStart(o) {
  // (a fixed call takes only the ids that exist; anything else keeps the default)
  const ok = c => Object.fromEntries(Object.entries(c || {}).filter(([k, v]) => HK_CALL_T[k] && HK_CALL_T[k][v]));
  G.call = [0, 1].map(s => Object.assign({}, HK_CALL0, ok(o.calls && o.calls[s])));
  G.fixed = [0, 1].map(s => !!(o.calls && o.calls[s]));
  G.skill = [0, 1].map(s => { const k = Array.isArray(o.skill) ? o.skill[s] : o.skill; return [0, 1, 2].includes(k) ? k : 1; });
  G.scout = G.call.map(c => ({ att: c.att, n: 0 })); G.to = [HK_TO.n, HK_TO.n];
  G.sysLog = [0, 1].map(() => Object.fromEntries(Object.keys(HK_ATT).map(k => [k, { t: 0, sog: 0, g: 0 }])));
}
// the CPU's coach makes side's calls: not a fixed side, and not yours unless you only watch
const hkCpuSide = side => !G.fixed[side] && !(GD.mode !== 'watch' && side === GD.you);
// a Squire's side: its skaters drift after the puck, and its passes are guesses (05-live.js, 06-cpu.js)
const hkDim = side => hkCpuSide(side) && G.skill[side] === 0;
// what that costs it: slower decisions (think), shots from worse looks (at), passes valued with this much guesswork
// (noise), and everyone drifting toward the puck out of their shape (drift). chase: a second skater at the carrier
// (off: measured, it helped them as often as it hurt)
const HK_DIM = { chase: 0, think: 1.2, at: .05, noise: .9, drift: .2 };
const hkTempo = side => HK_TEMPO[G.call[side].tempo] || HK_TEMPO.bal;
const hkEdgeSt = side => HK_EDGES[G.call[side].edge] || HK_EDGES.bal;
// the system side is in with the puck, and without it, as the strengths stand: the power-play and penalty-kill setups when one side is short
const hkAttNow = side => hkShort(1 - side) ? HK_PP[G.call[side].pp] : HK_ATT[G.call[side].att];
const hkDefNow = side => hkShort(side) ? HK_PK[G.call[side].pk] : HK_DEF[G.call[side].def];
// for the side with the puck: [+1 | 0 | -1, why], its system against theirs
function hkEdgeNow(side) {
  const A = G.call[side], D = G.call[1 - side];
  if (hkShort(1 - side)) return HK_EDGE_PP[A.pp + '/' + D.pk] || [0, ''];
  if (hkShort(side)) return [0, ''];
  return HK_EDGE[A.att + '/' + D.def] || [0, ''];
}
// what the calls add to the odds of a shot by side beating the goalie: the edge, less what the scout has read
const hkCallQ = side => hkEdgeNow(side)[0] * HK_CALL_Q + (hkAttNow(side).q || 0) - (hkShort(1 - side) || hkShort(side) ? 0 : G.scout[side].n * HK_SCOUT.q) - (hkDefNow(1 - side).slot || 0);
// and to a poke at side's carrier (their Tempo, the other side's setup, the edge the other way)
const hkCallPoke = side => hkTempo(side).give + (hkAttNow(side).give || 0) + (hkDefNow(1 - side).poke || 0) - hkEdgeNow(side)[0] * HK_CALL_POKE;
/* a face-off: the scout looks again (the same system as last time is read a little better), and each CPU coach makes
   its calls */
function hkCallsFaceoff() {
  // (the less skilled coach calls first, so the better one answers what is actually on)
  for (const s of G.skill[0] <= G.skill[1] ? [0, 1] : [1, 0]) { if (hkCpuSide(s)) hkCpuCall(s); }
  for (const s of [0, 1]) { const S = G.scout[s], a = G.call[s].att; if (S.att === a) S.n = Math.min(HK_SCOUT.max, S.n + 1); else { S.att = a; S.n = 0; } }
}
// your call, or the lab's: side's kind (att, def, pp, pk, tempo, edge) to id. '' when it took, or why not
function hkCall(side, kind, id) {
  if (!G || !G.call || !HK_CALL_T[kind] || !HK_CALL_T[kind][id]) return 'No such call.';
  G.call[side][kind] = id;
  if (kind === 'att' && G.scout[side].att !== id) G.scout[side] = { att: id, n: 0 };
  return '';
}
const hkMean = (side, k, roles) => { const T = G.teams[side], on = G.on[side].filter((ri, i) => HK_POS[i] !== 'G' && (!roles || roles.includes(HK_ROLE[HK_POS[i]]))); return on.reduce((a, ri) => a + T.roster[ri].r[k], 0) / Math.max(1, on.length); };
const hkLate = share => G.p >= HK_RULES.periods && G.clock < G.plen * share, hkLead = side => G.score[side] - G.score[1 - side];
/* the CPU coach's call. A Squire picks at random. A Knight picks by its skaters (fast ones rush, big ones crash, good
   shots at the back shoot from the point), and by the score and the clock (behind late: push and get it to the net;
   ahead late: sit on it and clog the ice). An Archmage also looks at the other side's call and answers it. */
function hkCpuCall(side) {
  const C = G.call[side], O = G.call[1 - side], sk = G.skill[side];
  if (sk === 0) {
    if (R() < .35) for (const k of Object.keys(HK_CALL_T)) C[k] = pick(Object.keys(HK_CALL_T[k]));
    return;
  }
  const spd = hkMean(side, 'spd'), siz = hkMean(side, 'siz'), hnd = hkMean(side, 'hnd'), dSht = hkMean(side, 'sht', ['defender']), def = hkMean(side, 'def');
  const lead = hkLead(side), late = hkLate(.35);
  const wa = { cycle: 1 + (hnd - 6) * .4, rush: 1 + (spd - 6) * .45, dump: .4 + (siz - 6) * .2, point: .6 + (dSht - 6) * .45, crash: .8 + (siz - 6) * .4 };
  const wd = { fore: 1 + (spd - 6) * .35, trap: .9, box: .8 + (siz - 6) * .2, collapse: .7, man: 1 + (def - 6) * .35 };
  if (late && lead < 0) { wa.rush *= 2; wa.crash *= 2.5; wa.dump *= .4; wd.fore *= 3; wd.trap *= .2; wd.collapse *= .3; }
  if (late && lead > 0) { wa.cycle *= 1.5; wd.trap *= 2; wd.fore *= .5; }
  // the Archmage: what beats their call is worth much more, and what loses to it much less
  if (sk >= 2) {
    for (const a of Object.keys(wa)) { const e = (HK_EDGE[a + '/' + O.def] || [0])[0]; wa[a] = Math.max(.05, wa[a]) * (e > 0 ? 3.5 : e < 0 ? .2 : 1); }
    for (const d of Object.keys(wd)) { const e = (HK_EDGE[O.att + '/' + d] || [0])[0]; wd[d] = Math.max(.05, wd[d]) * (e < 0 ? 3.5 : e > 0 ? .2 : 1); }
    const pp = Object.keys(HK_PP).map(k => [k, (HK_EDGE_PP[k + '/' + O.pk] || [0])[0]]).sort((a, b) => b[1] - a[1])[0], pk = Object.keys(HK_PK).map(k => [k, (HK_EDGE_PP[O.pp + '/' + k] || [0])[0]]).sort((a, b) => a[1] - b[1])[0];
    C.pp = pp[0]; C.pk = pk[0];
  } else { C.pp = dSht >= 7 ? 'umbrella' : siz >= 7 ? 'front' : 'overload'; C.pk = def >= 7 ? 'press' : 'box'; }
  // (it keeps what it has most of the time: a system needs a few shifts)
  if (R() < (sk >= 2 ? .6 : .4) || late) { C.att = wpick(wa); C.def = wpick(wd); }
  C.tempo = late && lead < 0 ? 'push' : hkLate(.12) && lead > 0 ? 'sit' : 'bal';
  C.edge = late && lead > 0 ? 'clean' : 'bal';
}
/* a timeout for side: at a whistle (a face-off pending), once a game. The skaters on the ice get their breath back.
   '' when it's taken, or why not */
function hkTimeout(side) {
  if (!G.to || G.to[side] <= 0) return 'No timeout left.';
  if (!['dead', 'set', 'drop'].includes(GD.ph)) return 'Only at a whistle.';
  G.to[side]--;
  for (const p of hkSk(side)) G.sta[side][p.ri] = Math.min(1, hkSta(p) + HK_TO.sta);
  GD.msg = `Timeout, ${G.teams[side].name}. Their skaters get their breath back.`;
  if (GD.ph === 'dead') GD.deadT = Math.max(GD.deadT, GD.t + HK_TO.secs); else { GD.ph = 'dead'; GD.t = 0; GD.deadT = HK_TO.secs; GD.next = { x: GD.fo.x, y: GD.fo.y }; }
  hkEv('timeout', G.teams[side].name);
  return '';
}
// the CPU's: a Knight or better, when its line is spent and may not change (it iced the puck), or late and a goal behind
function hkCpuTimeout() {
  for (const s of [0, 1]) {
    if (!hkCpuSide(s) || G.skill[s] < 1 || G.to[s] <= 0) continue;
    const sk = hkSk(s), tired = sk.length ? sk.reduce((a, p) => a + hkSta(p), 0) / sk.length : 1;
    if ((GD.noChange === s && tired < .45) || (hkLate(.12) && hkLead(s) === -1 && tired < .5)) hkTimeout(s);
  }
}
