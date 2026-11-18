/* Mossgate Links: the rules (issue #92, phase 0). Plain data and pure functions, no page: who may hit, who is away,
   strokes and penalty drops, a hole won or halved, match play's score and its early finish, and the playoff.

   Captain's choice, match play. Each side plays one ball with four players. Before every shot the side picks who
   hits it: until all four have hit this hole, it must be one who hasn't (so the first four shots of a hole are four
   different players, in the order the side chooses); after that, anyone but the player who hit the last shot. Nobody
   hits twice running.
   Whoever is farther from the hole plays next (glAway); on the tee, the side with the honour goes first. The honour is
   the side that won the last hole (a halved hole keeps it where it was).
   A stroke is one, a penalty drop adds one (water, a plugged ball in the bog, an unplayable lie). A ball is picked up
   at par + GL_RULES.cap strokes: it can no longer win the hole.
   A hole is won by the side that holes out in fewer strokes, or halved. It ends as soon as it is decided: both holed,
   or one holed and the other already on as many strokes (it can no longer halve), or both picked up. A side may
   concede the other's next putt: that putt counts as holed in one more stroke.
   Match play: the side more holes up than there are holes left has won ("3 and 2", or "1 up" at the last). Level after
   the last hole, a playoff: the 1st hole again, then the 2nd, and so on, until one side wins a hole ("won at the 19th").
   A game never ends level.

   G is the game, plain JSON (so a snapshot can be saved): { holes, pars, h, won, res, hole, honour, playoff, over }.
   hole: this hole's state { par, st: [strokes a side], done: [holed or picked up], up: [picked up], last: [last hitter],
   hit: [[players who have hit this hole], [..]] }. res: each hole's result, 0 or 1 (the side that won it) or -1
   (halved). won: holes won a side. over: null, or { win, text }. */
const GL_RULES = { side: 4, holes: 9, holesAt: [3, 6, 9, 18], cap: 4, par9: [4, 3, 5, 4, 4, 3, 4, 5, 4] };
let G = null;

// the pars for a game of n holes: the standing nine's, repeated for eighteen and cut short for fewer
function glPars(n) { const out = []; for (let i = 0; i < n; i++) out.push(GL_RULES.par9[i % GL_RULES.par9.length]); return out; }
function glHole(par) { return { par, st: [0, 0], done: [false, false], up: [false, false], last: [-1, -1], hit: [[], []] }; }
function glNewGame(opts) {
  const o = opts || {}, holes = GL_RULES.holesAt.includes(o.holes) ? o.holes : GL_RULES.holes;
  const pars = Array.isArray(o.pars) && o.pars.length === holes && o.pars.every(p => Number.isInteger(p) && p >= 3 && p <= 5) ? o.pars.slice() : glPars(holes);
  G = { holes, pars, h: 0, won: [0, 0], res: [], hole: glHole(pars[0]), honour: o.honour === 1 ? 1 : 0, playoff: 0, over: null };
  return G;
}
// the par of hole index h; playoff holes go round the course again from the 1st
const glParOf = h => G.pars[h % G.holes];
// the hole's number as said on the course: 1 to 18, then 19, 20 in a playoff
const glHoleNo = () => G.h + 1;

/* ---------- who may hit ---------- */
function glHitters(side) {
  const H = G.hole, used = H.hit[side];
  if (G.over || H.done[side]) return [];
  const all = []; for (let i = 0; i < GL_RULES.side; i++) all.push(i);
  if (used.length < GL_RULES.side) return all.filter(i => !used.includes(i));
  return all.filter(i => i !== H.last[side]);
}
const glCanHit = (side, ri) => glHitters(side).includes(ri);
// why player ri may not hit for side now ('' if they may): the words glStroke refuses with
function glWhyNot(side, ri) {
  const H = G.hole;
  if (G.over) return 'The game is over.';
  if (H.done[side]) return 'That side is done with this hole.';
  if (glCanHit(side, ri)) return '';
  return H.last[side] === ri ? 'Nobody hits twice running.' : 'Everyone hits once before anyone hits twice.';
}

/* ---------- who is away ---------- */
// dist: [side 0's distance to the hole, side 1's]; on the tee (no strokes yet) the side with the honour goes first.
// A side that has holed out or picked up doesn't play. Level distances: the honour side.
function glAway(dist) {
  const H = G.hole;
  if (G.over) return -1;
  const live = [0, 1].filter(s => !H.done[s]);
  if (!live.length) return -1;
  if (live.length === 1) return live[0];
  if (H.st[0] === 0 && H.st[1] === 0) return G.honour;
  if (H.st[G.honour] === 0) return G.honour;
  if (H.st[1 - G.honour] === 0) return 1 - G.honour;
  const d = dist || [0, 0];
  if (d[0] === d[1]) return G.honour;
  return d[0] > d[1] ? 0 : 1;
}

/* ---------- strokes ---------- */
// a stroke by player ri of a side. Returns { ok, why, picked } (picked: this stroke reached the cap and the ball is lifted)
function glStroke(side, ri) {
  const H = G.hole;
  if (G.over) return { ok: false, why: 'The game is over.' };
  if (H.done[side]) return { ok: false, why: 'That side is done with this hole.' };
  if (!glCanHit(side, ri)) return { ok: false, why: glWhyNot(side, ri) };
  H.st[side]++; H.last[side] = ri; H.hit[side].push(ri);
  return { ok: true, picked: glCapCheck(side) };
}
// a penalty drop: one more stroke, nobody's swing
function glDrop(side) {
  const H = G.hole;
  if (G.over || H.done[side]) return { ok: false };
  H.st[side]++;
  return { ok: true, picked: glCapCheck(side) };
}
function glCapCheck(side) {
  const H = G.hole;
  if (H.st[side] >= H.par + GL_RULES.cap && !H.done[side]) { H.done[side] = true; H.up[side] = true; return true; }
  return false;
}
// the ball dropped. Returns glDecide's verdict
function glHoled(side) {
  const H = G.hole;
  if (G.over || H.done[side]) return { ok: false };
  H.done[side] = true;
  return Object.assign({ ok: true }, glDecide());
}
// side concedes the other side's next putt: it counts as holed in one more stroke
function glConcede(side) {
  const o = 1 - side, H = G.hole;
  if (G.over || H.done[o]) return { ok: false };
  H.st[o]++; H.done[o] = true;
  return Object.assign({ ok: true }, glDecide());
}

/* ---------- a hole decided ---------- */
// is the hole decided yet? { end, res } where res is 0 or 1 (the winner) or -1 (halved)
function glHoleState() {
  const H = G.hole, score = s => H.up[s] ? Infinity : H.st[s];
  if (H.done[0] && H.done[1]) { const a = score(0), b = score(1); return { end: true, res: a === b ? -1 : a < b ? 0 : 1 }; }
  for (const s of [0, 1]) {
    const o = 1 - s;
    // s has holed out; o can only halve by holing its next stroke, so o is beaten once it already has as many
    if (H.done[s] && !H.up[s] && !H.done[o] && H.st[o] >= H.st[s]) return { end: true, res: s };
  }
  return { end: false, res: null };
}
// if the hole is decided, close it: the result, the honour, the match, the next hole. Returns { end, res, over }
function glDecide() {
  const S = glHoleState();
  if (!S.end) return { end: false };
  G.res.push(S.res);
  if (S.res >= 0) { G.won[S.res]++; G.honour = S.res; }
  glMatchCheck();
  if (!G.over) { G.h++; G.hole = glHole(glParOf(G.h)); }
  return { end: true, res: S.res, over: G.over };
}

/* ---------- the match ---------- */
// holes up for side 0 (negative: side 1 is up), and holes left to play in regulation
const glUp = () => G.won[0] - G.won[1];
const glLeft = () => Math.max(0, G.holes - G.res.length);
function glMatchCheck() {
  const up = glUp(), left = glLeft(), played = G.res.length;
  if (played > G.holes) {
    // the playoff: the first hole won settles it
    const last = G.res[played - 1];
    if (last >= 0) G.over = { win: last, text: 'at the ' + glOrd(played) };
    else G.playoff++;
    return;
  }
  if (Math.abs(up) > left) { G.over = { win: up > 0 ? 0 : 1, text: left ? Math.abs(up) + ' and ' + left : Math.abs(up) + ' up' }; return; }
  if (left === 0 && up === 0) G.playoff = 1;
}
const glOrd = n => engOrd(n);
// the match as said from a side's point of view: "2 up with 3 to play", "All square", "Dormie 2", "Won 3 and 2", "Won at the 19th"
function glMatchText(side) {
  const s = side === 1 ? 1 : 0;
  if (G.over) return (G.over.win === s ? 'Won ' : 'Lost ') + G.over.text;
  if (G.res.length >= G.holes) return 'All square: playoff, extra hole ' + G.playoff + ' (the ' + glOrd(G.h + 1) + ')';
  const up = s === 0 ? glUp() : -glUp(), left = glLeft();
  if (up === 0) return 'All square with ' + left + ' to play';
  if (Math.abs(up) === left) return (up > 0 ? 'Dormie ' + up : 'Dormie ' + -up + ' down');
  return Math.abs(up) + (up > 0 ? ' up' : ' down') + ' with ' + left + ' to play';
}
