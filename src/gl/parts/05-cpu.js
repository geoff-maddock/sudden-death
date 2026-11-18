/* Mossgate Links: the CPU's caddie (issue #92, phase 1). For a side to play: who hits (glPickHitter), and the shot
   (glPlan). It aims through the same pure model the ball flies by (04-shot.js), so it can only know what a player could.
   - The hitter: by the shot. The tee shot goes to the most powerful player who may hit, an approach to the most
     accurate, a chip (45 yards or less, off the green) to the best touch, a putt to the best putter.
   - A full shot: the shortest club that gets to the pin from the lie. Out of reach, the longest, down the hole's line
     as far as it goes; a Knight or an Archmage picks a spot on the fairway clear of the water, the sand and the bog.
     A Squire takes the driver off every tee it can and doesn't read the wind; the others aim off for it and club up or
     down. The swing's power is found for the distance (carry and roll) by glReach.
   - A putt (or from the fringe close by): glRead aims and weighs it by rolling it in its head on the green as it reads
     it (the slope times a read error, smaller for a better putter and a better caddie), to pass over the cup and finish just past it.
   - The concede (glCpuConcede): a short putt for the other side, by skill. A Squire always gives it; an Archmage makes
     you putt more often. Never when the putt would decide the hole against it (it has holed out already).
   The swing's errors (glHit, 06-game.js) are the hitter's and the skill's (GL_SKILL.err), drawn from R, so a seeded
   game plays the same.
   Ratings, roles, focus and nerve (phase 3). A player's six ratings (GL_STATS: power, accuracy, touch, putting, nerve,
   scrambling) run 1 to 12, seeded by kind (GL_KIND, glRate); the game works on them as 0 to 1 (glScale). A team may name
   its roles (tee, approach, short, putt: a player each): the caddie gives a shot to its role's player when the hitter
   rule allows, else to the best fit for it who may hit (glFit). Focus (G.focus, 0 to 1 a player): each shot costs the
   hitter some (a hard one more: a power shot, or out of the rough, sand, bog or trees), and it comes back while the
   others hit and at a new hole; low focus makes the swing less true (glFocusK). Pressure (glPressure, 0 to 2): a stroke
   to win or halve the hole, and more on the last hole, dormie or in a playoff; nerve takes it off (glNerveK).
   The call (phase 4). The line (GL_LINES), before every shot: go (the pin, over the trouble; out of reach, straight at
   it), pct (the fat of the green; out of reach, the safe fairway) or lay (short of the trouble, to the side's wedge
   range). On a putt: go charges it, pct finishes a little past, lay dies it at the hole. The CPU's line (glCpuLine): a
   Squire always goes for it; a Knight reads the match (behind late, it goes for everything; well up, it lays up short
   of trouble); an Archmage also lays up when the way to the green crosses the water, and reads you (the scout,
   G.scout: when you keep going for it and finding trouble, it plays safe and lets you). Stances (G.stance, a side's):
   tempo quick (a quicker meter and swing, less focus spent, a touch less true) or steady; mood bold (a little longer,
   more shape and spin, a bigger miss) or careful. The caddie's word (G.word, once a game a side): the next stroke is
   read in full (the putt's read line to the cup, the wind exactly; the CPU reads it without error). */
const GL_SKILL = { names: ['Squire', 'Knight', 'Archmage'], err: [1.05, 1, 0.85], read: [0.5, 0.25, 0.12], wind: [0.4, 0.85, 1], give: [1, 0.75, 0.6], giveIn: 0.6 };
const GL_DEF_RAT = { pow: 0.5, acc: 0.5, tch: 0.5, put: 0.5, nrv: 0.5, scr: 0.5 };
const GL_STATS = ['pow', 'acc', 'tch', 'put', 'nrv', 'scr'];
// by kind, 1 to 12: power, accuracy, touch, putting, nerve, scrambling. An ogre hits it a mile and nobody knows where;
// an elf threads it through the trees; a spider putts with eight legs braced; a lich has no nerves left to lose
const GL_KIND = {
  goblin: [5, 6, 7, 6, 5, 8], kobold: [5, 6, 6, 6, 5, 7], werewolf: [8, 5, 5, 5, 6, 7], dwarf: [6, 7, 6, 7, 7, 6],
  ogre: [11, 2, 3, 4, 5, 6], minotaur: [9, 4, 4, 5, 6, 6], troll: [9, 3, 3, 4, 6, 7], golem: [10, 4, 3, 5, 9, 4],
  harpy: [7, 6, 6, 5, 4, 6], elf: [6, 10, 8, 7, 6, 6], wraith: [6, 7, 7, 7, 8, 7], vampire: [7, 7, 7, 7, 7, 6],
  lich: [5, 7, 7, 8, 12, 5], zombie: [6, 3, 3, 4, 10, 5], gorgon: [6, 7, 6, 8, 8, 6], spider: [5, 6, 8, 11, 7, 8],
  skeleton: [5, 6, 6, 6, 9, 6], witch: [6, 6, 9, 7, 6, 7],
};
const GL_RCAP = 12;
function glRate(kind) { const k = GL_KIND[kind]; return Object.fromEntries(GL_STATS.map((s, i) => [s, k ? k[i] : 6.5])); }
// 1 to 12 as the game works on it, 0 to 1
const glScale = v => clamp((v - 1) / (GL_RCAP - 1), 0, 1);
// how well ratings (0 to 1) suit a role
const glFit = (r, role) => role === 'tee' ? r.pow * 0.7 + r.acc * 0.3 : role === 'approach' ? r.acc * 0.6 + r.pow * 0.2 + r.scr * 0.2
  : role === 'short' ? r.tch * 0.7 + r.scr * 0.3 : r.put * 0.8 + r.nrv * 0.2;
// the roles for a roster by the ratings: the best putter on the green first, then the tee, the short game, the approach
function glAutoRoles(roster) {
  const left = new Set(roster.map((_, i) => i)), out = {};
  for (const role of ['putt', 'tee', 'short', 'approach']) { const i = [...left].sort((a, b) => glFit(roster[b].r, role) - glFit(roster[a].r, role) || a - b)[0]; out[role] = i; left.delete(i); }
  return out;
}
const GL_LINES = { go: { n: 'Go for it', putt: 0.6 }, pct: { n: 'Percentages', putt: 0.35 }, lay: { n: 'Lay up', putt: 0.12 } };
const GL_STANCE = { quick: { meter: 1.2, focus: 0.75, err: 1.03 }, steady: { meter: 1, focus: 1, err: 1 }, bold: { dist: 1.05, err: 1.03, shape: 1.5 }, careful: { dist: 1, err: 1, shape: 1 } };
const glStanceOf = s => (G.stance && G.stance[s]) || { tempo: 'steady', mood: 'careful' };
// a side's error from its stance (1 is none)
const glStanceErr = s => { const st = glStanceOf(s); return GL_STANCE[st.tempo].err * GL_STANCE[st.mood].err; };
// does the way from b to a point cross water (or a carry over sand by the green)?
function glTrouble(H, b, p) {
  const d = hyp(p.x - b.x, p.y - b.y), n = Math.ceil(d / 3);
  for (let i = 1; i < n; i++) { const l = glLie(H, b.x + (p.x - b.x) * i / n, b.y + (p.y - b.y) * i / n); if (l === 'W') return true; }
  return false;
}
// the CPU's line for side s now
function glCpuLine(s) {
  const sk = G.skill[s], H = glHoleNow(), b = G.ball[s], kind = glShotKind(H, s);
  if (sk === 0) return 'go';
  const up = s === 0 ? glUp() : -glUp(), left = glLeft(), Hs = G.hole, o = 1 - s;
  const trouble = kind === 'approach' && glTrouble(H, b, H.pin) && hyp(b.x - H.pin.x, b.y - H.pin.y) > 120;
  // the scout: an Archmage that has seen you go for it and find trouble twice plays safe and lets you (unless it is
  // three down or worse)
  if (sk >= 2 && kind !== 'putt' && G.scout && G.scout[o].bad >= 2 && up > -3) return trouble ? 'lay' : 'pct';
  // behind late: everything at the pin; on a putt, charge it when only holing it will do
  if ((up <= -2 && left <= 4) || (up < 0 && left <= 2) || G.res.length >= G.holes) return kind === 'putt' ? (Hs.done[o] ? 'go' : 'pct') : 'go';
  if (kind === 'putt') return Hs.done[o] || hyp(b.x - H.pin.x, b.y - H.pin.y) < 6 ? 'pct' : up >= 2 ? 'lay' : 'pct';
  if (up >= 2 && trouble) return 'lay';
  if (sk >= 2 && trouble) return 'lay';
  return 'pct';
}
// the green's fat: the pin itself, unless it is tucked by trouble (sand or water within 8 yards of it), then a point
// halfway back toward the middle of the green
function glFat(H) {
  const g = H.green, p = H.pin;
  let tucked = false;
  for (let a = 0; a < Math.PI * 2 && !tucked; a += Math.PI / 8) for (const r of [4, 8]) { const l = glLie(H, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); if (l === 'S' || l === 'W') { tucked = true; break; } }
  if (!tucked) return { x: p.x, y: p.y };
  return { x: p.x + (g.x - p.x) * 0.5, y: p.y + (g.y - p.y) * 0.5 };
}
const GL_FOCUS = { shot: 0.12, hard: 0.22, back: 0.06, hole: 0.1, k: 0.8 };
// how much less true a swing is at this focus (1 at full)
const glFocusK = f => 1 + (1 - clamp(f, 0, 1)) * GL_FOCUS.k;
// how big the moment is for side s's next stroke: 1 if holing it wins or halves the hole, and half as much again on the
// last hole, dormie, or in a playoff (0 when it decides nothing)
function glPressure(s) {
  const H = G.hole, o = 1 - s;
  if (!H || H.done[s] || !H.done[o] || H.up[o] || H.st[s] + 1 > H.st[o]) return 0;
  const left = glLeft(), late = G.res.length >= G.holes || left <= 1 || Math.abs(glUp()) === left;
  return 1 + (late ? 0.5 : 0);
}
// what a moment does to a hitter of nerve nrv (0 to 1): 1 is nothing
const glNerveK = (p, nrv) => 1 + 0.6 * p * (1 - clamp(nrv, 0, 1));

// a player's ratings (0 to 1) as they play now: their own, and a Moss Tonic's scrambling this hole
function glRat(side, ri) {
  const r = (G.teams[side].roster[ri] || {}).r || GL_DEF_RAT, M = G.moss && G.moss[side];
  return M && M.ri === ri && M.h === G.h ? Object.assign({}, r, { scr: Math.min(1, r.scr + GL_POTIONS.glmoss.scr) }) : r;
}
const glDistOf = (H, s) => hyp(G.ball[s].x - H.pin.x, G.ball[s].y - H.pin.y);
// what kind of shot a side faces: tee, approach, short (a chip) or putt
function glShotKind(H, s) {
  const b = G.ball[s], d = glDistOf(H, s);
  if (b.lie === 'G' || (b.lie === 'F' && d < 16 && glPuttable(H, b))) return 'putt';
  if (b.lie === 'T') return 'tee';
  return d <= 45 ? 'short' : 'approach';
}
// a putt from off the green only when the way to the cup is short grass
function glPuttable(H, b) {
  const d = hyp(H.pin.x - b.x, H.pin.y - b.y), n = Math.ceil(d * 2);
  for (let i = 1; i < n; i++) { const l = glLie(H, b.x + (H.pin.x - b.x) * i / n, b.y + (H.pin.y - b.y) * i / n); if (l !== 'G' && l !== 'F') return false; }
  return true;
}
const GL_ROLE_KEY = { tee: 'pow', approach: 'acc', short: 'tch', putt: 'put' };
function glPickHitter(side, kind) {
  const can = glHitters(side), T = G.teams[side], role = T.roles && T.roles[kind];
  // the role's player, if the hitter rule allows; else the best fit who may hit (focus counts)
  if (role != null && can.includes(role)) return role;
  let best = can[0], bv = -1;
  for (const ri of can) { const f = G.focus ? G.focus[side][ri] : 1, v = glFit(glRat(side, ri), kind === 'putt' ? 'putt' : kind) * (0.7 + 0.3 * f); if (v > bv + 1e-9) { bv = v; best = ri; } }
  return best;
}

// the power that sends club from lie dist yards (carry and roll together), or the carry alone; capped at full
function glPowFor(club, lie, rat, dist, carryOnly) {
  // (carry and roll together need not rise with power: from the trees the punch's carry is capped while a softer swing
  // runs further. So the nearest on a fine sweep, then a closer look round it)
  const f = p => { const r = glReach(club, lie, rat, p); return carryOnly ? r.carry : r.carry + r.roll; };
  let best = 1, be = Math.abs(f(1) - dist);
  for (let p = 0.03; p < 1; p += 0.01) { const e = Math.abs(f(p) - dist); if (e < be - 1e-9) { be = e; best = p; } }
  for (let p = Math.max(0.03, best - 0.01); p <= Math.min(1, best + 0.01); p += 0.0005) { const e = Math.abs(f(p) - dist); if (e < be - 1e-9) { be = e; best = p; } }
  return best;
}
// out of reach: the spot down the hole's line, at most reach yards away, to play to
function glLayTarget(H, b, reach, careful, rollFrac) {
  let best = null, bestF = null;
  const bad = l => l === 'W' || l === 'S' || l === 'B' || l === 'O';
  for (const p of H.line) {
    const d = hyp(p.x - b.x, p.y - b.y);
    if (d > reach || p.y < b.y - 5) continue;
    const l = glLie(H, p.x, p.y);
    if (careful && bad(l)) continue;
    // (careful: where it lands, short of the spot by the roll, and every yard it runs over to get there, are clear too)
    if (careful && rollFrac) { const run = d * rollFrac, ux = (p.x - b.x) / (d || 1), uy = (p.y - b.y) / (d || 1); let ok = true; for (let t = 0; t <= run && ok; t += 2) if (bad(glLie(H, p.x - ux * t, p.y - uy * t))) ok = false; if (!ok) continue; }
    if (!best || p.t > best.t) best = p;
    if (l === 'F' && (!bestF || p.t > bestF.t)) bestF = p;
  }
  // a careful caddie prefers the fairway unless it gives away more than 25 yards
  if (careful && bestF && best && best.t - bestF.t < 25) best = bestF;
  if (best) return { x: best.x, y: best.y };
  const a = Math.atan2(H.pin.y - b.y, H.pin.x - b.x);
  return { x: b.x + Math.cos(a) * reach, y: b.y + Math.sin(a) * reach };
}

// the shot for side s, hit by ri: { ri, kind, club, aim, pow, spin } or a putt { ri, kind, putt: true, a, v }
function glPlan(s, riIn, lineIn) {
  const H = glHoleNow(), b = G.ball[s], sk = G.skill[s], kind = glShotKind(H, s), ri = riIn == null ? glPickHitter(s, kind) : riIn, rat = glRat(s, ri);
  const line = GL_LINES[lineIn] ? lineIn : G.fixLine && G.fixLine[s] ? G.fixLine[s] : glCpuLine(s), word = !!(G.wordOn && G.wordOn[s]);
  if (kind === 'putt') {
    // (the caddie's word: read without error)
    // (in a spore haze the greens read worse)
    const readK = word ? 1 : 1 + gauss() * GL_SKILL.read[sk] * (1.4 - rat.put) / glHazeK();
    return Object.assign({ ri, kind, club: 'pt', putt: true, line }, glRead(H, b, readK, GL_LINES[line].putt));
  }
  const clubs = glClubsFrom(b.lie, rat), tot = c => { const r = glReach(c, b.lie, rat, 1); return r.carry + r.roll; };
  const d = glDistOf(H, s), longest = clubs[0];
  let club, target;
  const shortest = dd => GL_BAG.filter(c => clubs.includes(c)).reverse().find(c => tot(c) >= dd) || longest, wedge = tot(clubs.includes('we') ? 'we' : clubs[clubs.length - 1]);
  if (sk === 0 && b.lie === 'T' && glClubOk('dr', 'T') && d > tot('dr') * 0.6) { club = 'dr'; target = d > tot('dr') ? glLayTarget(H, b, tot('dr'), false) : H.pin; }
  else if (d > tot(longest) * 0.98) {
    club = longest; const R = glReach(club, b.lie, rat, 1), rf = R.roll / (R.carry + R.roll || 1);
    if (line === 'go') { const a = Math.atan2(H.pin.y - b.y, H.pin.x - b.x), L = tot(longest); target = { x: b.x + Math.cos(a) * L, y: b.y + Math.sin(a) * L }; }
    // lay up: safe ground that leaves a full wedge in, if that is a real shot short of the longest club's reach
    else if (line === 'lay' && d - wedge > 60) { const L = Math.min(tot(longest), d - wedge); target = glLayTarget(H, b, L, true, rf); club = shortest(hyp(target.x - b.x, target.y - b.y)); }
    else target = glLayTarget(H, b, tot(longest), sk > 0, rf);
  }
  else if (line === 'lay' && glTrouble(H, b, H.pin) && d - wedge > 40) {
    // short of the trouble, leaving the wedge in; if there is no safe spot it plays the percentages
    const T = glLayTarget(H, b, d - wedge, true, 0.15);
    if (glTrouble(H, b, T) || hyp(T.x - b.x, T.y - b.y) < 30) { target = glFat(H); club = shortest(hyp(target.x - b.x, target.y - b.y)); }
    else { target = T; club = shortest(hyp(T.x - b.x, T.y - b.y)); }
  }
  else { target = line === 'go' ? H.pin : glFat(H); club = shortest(hyp(target.x - b.x, target.y - b.y)); }
  // the landing spot: short of the target by the roll; then aim off for the wind
  const dir0 = Math.atan2(target.y - b.y, target.x - b.x), dist = hyp(target.x - b.x, target.y - b.y);
  let pow = glPowFor(club, b.lie, rat, dist), R1 = glReach(club, b.lie, rat, pow);
  let land = { x: target.x - Math.cos(dir0) * R1.roll, y: target.y - Math.sin(dir0) * R1.roll }, aim = land;
  // (its own powers: a shot that flies further needs less, one the wind moves less needs less aiming off)
  const fxp = glFxFor(s), wk = (word ? 1 : GL_SKILL.wind[sk]) * fxp.wind;
  if (wk && G.wind && G.wind.s) {
    const windAim = () => { let a = land; for (let i = 0; i < 3; i++) { const dir = Math.atan2(a.y - b.y, a.x - b.x), carry = hyp(a.x - b.x, a.y - b.y), push = glWindPush(club, carry, G.wind, dir); a = { x: land.x - push[0] * wk, y: land.y - push[1] * wk }; } return a; };
    aim = windAim();
    let need = hyp(aim.x - b.x, aim.y - b.y);
    // club up into the wind if the club can't carry it; the longer club rolls its own way, so its landing spot and
    // its aim off for the wind are worked out again
    if (glReach(club, b.lie, rat, 1).carry < need) {
      const up = clubs.slice().reverse().find(c => glReach(c, b.lie, rat, 1).carry >= need);
      if (up) { club = up; R1 = glReach(club, b.lie, rat, glPowFor(club, b.lie, rat, dist)); land = { x: target.x - Math.cos(dir0) * R1.roll, y: target.y - Math.sin(dir0) * R1.roll }; aim = windAim(); need = hyp(aim.x - b.x, aim.y - b.y); }
    }
    pow = glPowFor(club, b.lie, rat, need, true);
  } else pow = glPowFor(club, b.lie, rat, hyp(land.x - b.x, land.y - b.y), true);
  // (its swing goes as far as its powers, its mood and a web say: Bold a little further, a webbed ball half as far)
  const goes = fxp.dist * GL_STANCE[glStanceOf(s).mood].dist * (G.webbed && G.webbed[s] ? GL_ENCH.webK : 1);
  return { ri, kind, club, aim: { x: aim.x, y: aim.y }, pow: Math.min(1, pow / goes), spin: 0, line };
}

// read a putt: the angle and speed that finish it just past the cup, on the green as read (slopeK)
function glRead(H, from, slopeK, past) {
  const pin = H.pin, d = hyp(pin.x - from.x, pin.y - from.y), ux = (pin.x - from.x) / (d || 1), uy = (pin.y - from.y) / (d || 1);
  const want = d + (past == null ? 0.35 : past);
  const fk = glWetK();
  let a = Math.atan2(uy, ux), v = Math.sqrt(2 * GL_PUTT.fric * fk * want) * (glLie(H, from.x, from.y) === 'G' ? 1 : 1.3);
  for (let i = 0; i < 10; i++) {
    const P = glPutt({ hole: H, from, a, v, slopeK, noCup: true, fk });
    // (the trial roll stopped in sand, bog or the trees: more pace would only smash it on, so the read keeps what it has)
    if (P.lie !== 'G' && P.lie !== 'F' && P.lie !== 'T') break;
    const ex = P.end.x - from.x, ey = P.end.y - from.y, al = ex * ux + ey * uy, lat = P.cross != null ? P.cross : -ex * uy + ey * ux;
    a -= Math.atan2(lat, Math.max(0.5, d)) * 0.9;
    v *= Math.sqrt(want / Math.max(0.15, al));
    v = clamp(v, 0.2, 30);
  }
  return { a, v };
}

// does side by (the CPU) give side s its next putt, d yards long?
// may side by give side s its next putt, d yards long? (on the green, short, and neither side done with the hole)
function glMayGive(by, s, d) { const H = G.hole; return G.ball[s].lie === 'G' && d <= GL_SKILL.giveIn && !H.done[by] && !H.done[s]; }
function glCpuConcede(by, s, d) {
  const H = G.hole;
  if (!glMayGive(by, s, d)) return false;
  // never the putt that hands over the hole: given, s is holed in one more, and by, already on as many, is beaten
  if (H.st[by] >= H.st[s] + 1) return false;
  return R() < GL_SKILL.give[G.skill[by]];
}
