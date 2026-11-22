/* Mossgate Links in the Umbral (issue #99, phase 4f): the Lich, the hexes, and a champion's own ultimate. Nothing here
   runs unless a game asks for it: with no hexes, no skill 3 and no player's own ultimate, the engine plays exactly as
   before (same seed, same round).
   The Lich (G.skill 3, above the Archmage; GL_SKILL's fourth column). It swings no better than an Archmage; it decides
   better. Before each of its strokes it weighs every line it could play (go for it, the percentages, lay up) by
   hitting each one a few times in its head through the same pure shot model (GL_LICH.tries swings, its own errors at
   this moment, from a stream of its own so the round's random numbers are untouched) and plays the line that leaves
   the fewest strokes to hole out (glLichLeft: by the distance and the lie). On a stroke that must drop to halve the
   hole it plays for the drop instead. On the green it reads the slope far better (GL_SKILL.read[3]) and weighs each
   pace the same way. Behind late, it goes for everything (as the Knight and the Archmage do). It makes you putt more
   (give[3]), takes a potion worth 2 and casts as an Archmage.
   Hexes (opts.hexes: ids in GL_HEX; G.hex = { ids, on, pin }, plain JSON, so a kept game keeps them). Each works
   against one side, G.hex.on (opts.hexOn, 0 by default: yours):
     tilt     The Restless Green: every putt that side strikes breaks on an extra tilt of GL_HEX.tilt.g, a new way each
              putt; no read sees it (the read line and the caddie read the green as it lies)
     wander   The Wandering Cup: after each of that side's shots from off the green that stops within
              GL_HEX.wander.near yards of the cup, the cup creeps GL_HEX.wander.yd yards away from the ball, never off the green (G.hex.pin: this hole's
              offset; glHoleNow() is the hole with the cup where it is now)
     fog      The Grey Fog: off the green, that side sees the flag GL_HEX.fog.yd yards from where it is (a way and a
              distance fixed for the hole): its caddie plays to it, and the picture and the words show it there
     gust     The Turning Wind: on that side's full shots the wind swings GL_HEX.gust.turn from where it was read, and
              blows GL_HEX.gust.mph harder
   The hexes are named over the first tee, on the hole card all game, and the fogged flag is drawn where it is seen.
   A player's own ultimate (a roster player sent with { ult: id }, an id in GL_ULT_OWN): used in place of their kind's
   (glUltOf). The Hollow Links' champion brings one. */
GL_SKILL.names[3] = 'Lich'; GL_SKILL.err[3] = 0.85; GL_SKILL.read[3] = 0.06; GL_SKILL.wind[3] = 1; GL_SKILL.give[3] = 0.45;
GL_KIT.take[3] = 2;
const GL_LICH = { tries: 14, lines: ['go', 'pct', 'lay'], side: 0.035, margin: 0.03, lie: { T: 0, F: 0, r: 0.25, R: 0.5, S: 0.4, B: 0.6, O: 0.65 } };
const GL_HEX = {
  tilt: { n: 'The Restless Green', d: 'Between your putts the green tilts: every putt you strike breaks a little on a slope no read can see, a new way each time.', g: 0.003 },
  wander: { n: 'The Wandering Cup', d: 'The cup creeps away from you: when a shot of yours from off the green stops near the cup, it creeps most of a yard further from your ball.', yd: 0.75, near: 40 },
  fog: { n: 'The Grey Fog', d: 'Fog hides the flag from you until you reach the green: you see it two or three yards from where it is.', yd: [2, 3.5] },
  gust: { n: 'The Turning Wind', d: 'The wind turns as you swing: on your full shots it blows a twelfth of a turn from where you read it, and 1 mph harder.', turn: Math.PI / 6, mph: 1 },
};
const GL_ULT_OWN = {
  hollowflag: glU('hollowflag', 'The Hollow Flag', 'The flag goes hollow for the other side: their read lines this hole half as long, and their putts a third shakier.', { nerve: 1 }, { read: 0.5, putt: 1.35 }),
};
const glUltOf = (s, ri) => { const m = G.teams[s].roster[ri == null ? 0 : ri]; return (m && m.ult && GL_ULT_OWN[m.ult]) || GL_ULT[m && m.kind] || GL_ULT.goblin; };

/* ---------- the Lich ---------- */
// the strokes left to hole out from d yards in lie (0 holed); a strokes-gained table in a line
function glLichLeft(d, lie) {
  if (lie === 'G') return 1 + Math.min(1.35, 0.9 * (1 - Math.exp(-Math.max(0, d - 0.3) / 3)) + 0.012 * d);
  const base = 2 + 0.4 * (1 - Math.exp(-d / 40)) + d / 220;
  return base + (GL_LICH.lie[lie] != null ? GL_LICH.lie[lie] : 0.3);
}
// how good a ball r is for side s: strokes left (a drop counts one), or, when only holing it will do, the drop first
function glLichScore(s, r, must) {
  if (r.holed && !r.water) return must ? -10 : 0;
  const H = glHoleNow(), d = hyp(r.end.x - H.pin.x, r.end.y - H.pin.y);
  return glLichLeft(d, r.lie) + (r.water ? 1 : 0);
}
// a plan hit GL_LICH.tries times in the Lich's head, its own errors at this moment, from a stream of its own (seed: the
// same for every line it weighs, so they are compared on the same swings). Returns the mean score
function glLichTry(s, plan, seed, must) {
  const was = engRand; engRand = engRng(seed);
  let t = 0;
  try { for (let i = 0; i < GL_LICH.tries; i++) t += glLichScore(s, glHit(s, plan), must); } finally { engRand = was; }
  return t / GL_LICH.tries;
}
// the Lich's shot: every line weighed, the best played (behind late, the Knight's rule: everything at the pin)
function glLichPlan(s, ri, H, b, kind) {
  const Hs = G.hole, o = 1 - s, up = s === 0 ? glUp() : -glUp(), left = glLeft();
  if ((up <= -2 && left <= 4) || (up < 0 && left <= 2) || G.res.length >= G.holes) return null;
  const must = Hs.done[o] && !Hs.up[o] && Hs.st[s] + 1 === Hs.st[o];
  const seed = (Math.imul(G.log.length + 1, 2654435761) ^ Math.imul(G.h + 7, 40503) ^ (s + 1)) >>> 0;
  // the line the Archmage would play is the one to beat: another must be better by GL_LICH.margin of a stroke (a few
  // swings in the head are not the truth, and the closest call goes to the plain one)
  const line0 = glCpuLine(s);
  let best = null, bv = Infinity, base = null, b0 = Infinity;
  const weigh = (plan, line) => { const v = glLichTry(s, plan, seed, must); if (line === line0 && base == null) { base = plan; b0 = v; } if (v < bv - 1e-9) { bv = v; best = plan; } };
  if (kind === 'putt') {
    // one read (as well as a Lich reads), then each pace weighed on it
    const rat = glRat(s, ri), word = !!(G.wordOn && G.wordOn[s]), readK = word ? 1 : 1 + gauss() * GL_SKILL.read[3] * (1.4 - rat.put) / glHazeK();
    for (const line of GL_LICH.lines) weigh(Object.assign({ ri, kind, club: 'pt', putt: true, line }, glRead(H, b, readK, GL_LINES[line].putt)), line);
  } else {
    // each line's plan, and the same aimed a little left and right of it (away from whatever the miss would find)
    const seen = {};
    for (const line of [line0].concat(GL_LICH.lines.filter(l => l !== line0))) {
      const P0 = glPlan(s, ri, line), dx = P0.aim.x - b.x, dy = P0.aim.y - b.y, d = hyp(dx, dy) || 1, w = d * GL_LICH.side;
      for (const k of [0, -1, 1]) {
        const plan = k ? Object.assign({}, P0, { aim: { x: P0.aim.x - dy / d * w * k, y: P0.aim.y + dx / d * w * k } }) : P0;
        const key = plan.club + ':' + plan.aim.x.toFixed(1) + ':' + plan.aim.y.toFixed(1) + ':' + plan.pow.toFixed(3);
        if (seen[key]) continue; seen[key] = 1;
        weigh(plan, k ? null : line);
      }
    }
  }
  return base && bv > b0 - GL_LICH.margin ? base : best;
}

/* ---------- the hexes ---------- */
function glHexStart(ids, on) { const hx = (ids || []).filter((k, i, a) => GL_HEX[k] && a.indexOf(k) === i); if (hx.length) G.hex = { ids: hx, on: on === 1 ? 1 : 0, pin: null }; }
const glHexHas = id => !!(G && G.hex && G.hex.ids.includes(id));
const glHexOn = (id, s) => glHexHas(id) && s === G.hex.on;
// a number from the course, the hole and k, 0 to 1 (never R: the round's random numbers are untouched)
const glHexQ = k => ((Math.imul(((G.cs >>> 0) ^ Math.imul(G.h + 1, 2654435761)) + k, 40503) >>> 0) % 100000) / 100000;
// The Wandering Cup: the hole with the cup where it has crept to this hole
function glHexHole(H) {
  const P = G && G.hex && G.hex.pin; if (!P || P.h !== G.h || (!P.dx && !P.dy)) return H;
  return Object.assign({}, H, { pin: { x: H.pin.x + P.dx, y: H.pin.y + P.dy } });
}
// after side s's shot: the cup creeps away from a ball that stopped near it (kept on the green, inside its edge)
function glHexAfter(s, ev) {
  if (!glHexOn('wander', s) || ev.holed || ev.res != null || G.hole.done[s] || ev.lie0 === 'G') return;
  const H = glHoleNow(), b = G.ball[s], d = hyp(H.pin.x - b.x, H.pin.y - b.y);
  if (d > GL_HEX.wander.near) return;
  const base = glHoleAt(G.h), g = base.green, ux = (H.pin.x - b.x) / (d || 1), uy = (H.pin.y - b.y) / (d || 1);
  let x = H.pin.x + ux * GL_HEX.wander.yd, y = H.pin.y + uy * GL_HEX.wander.yd;
  const e = Math.sqrt(((x - g.x) / g.rx) ** 2 + ((y - g.y) / g.ry) ** 2), k = 0.8;
  if (e > k) { x = g.x + (x - g.x) * k / e; y = g.y + (y - g.y) * k / e; }
  G.hex.pin = { h: G.h, dx: +(x - base.pin.x).toFixed(2), dy: +(y - base.pin.y).toFixed(2) };
  ev.hex = 'wander';
}
// The Grey Fog: the hole as side s sees it off the green (the flag where the fog puts it)
function glHexSeen(H, s) {
  if (!glHexOn('fog', s)) return H;
  const a = glHexQ(11) * Math.PI * 2, F = GL_HEX.fog.yd, r = F[0] + glHexQ(23) * (F[1] - F[0]);
  return Object.assign({}, H, { pin: { x: H.pin.x + Math.cos(a) * r, y: H.pin.y + Math.sin(a) * r } });
}
// is side s in the fog now (off the green, its flag not where it is)?
const glHexFogged = s => glHexOn('fog', s) && glShotKind(glHoleNow(), s) !== 'putt';
// The Restless Green: the extra tilt under side s's putt now ([x, y] grade), a new way each putt
function glHexTilt(s) {
  if (!glHexOn('tilt', s)) return null;
  const a = glHexQ(101 + G.hole.st[s] * 17 + G.log.length) * Math.PI * 2, g = GL_HEX.tilt.g;
  return [g * Math.cos(a), g * Math.sin(a)];
}
// The Turning Wind: the wind side s's full shot really flies in (w: the wind it would have), a quarter turn either way
function glHexWind(s, w) {
  if (!glHexOn('gust', s)) return w;
  const W = w || { s: 0, d: 0 }, sg = glHexQ(211 + G.log.length) < 0.5 ? -1 : 1;
  return { s: (W.s || 0) + GL_HEX.gust.mph, d: (W.d || 0) + sg * GL_HEX.gust.turn };
}
const glHexNames = () => G && G.hex ? G.hex.ids.map(k => GL_HEX[k].n).join(', ') : '';
const glHexLine = () => G && G.hex ? `Hexes on ${G.teams[G.hex.on].name}: ${glHexNames()}` : '';
