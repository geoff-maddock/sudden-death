/* The Curling Shed: the call and the read (issue #102, phase 4).
   - The game in the end's value (crEndValue): an end's last stone is judged by what it does to the game. Before the last
     end, the points and who has the hammer next (a single with the hammer is worth little more than a blank that keeps
     it). In the last end (or an extra end), only whether it wins: ahead after it is a win, behind a loss, level an
     extra end with the hammer to whoever has it then. So tied in the last end with the hammer a single wins, and two
     down a single is no use.
   - The reason (crReason): your skip says why it calls a shot: they have shot stone, a guard to steal behind, the
     hammer and the house kept clean, a single to win it, and so on.
   - Two stones ahead (crReplyLikely): an Archmage plays each of its best shots on, against the other rink's likeliest
     reply (a takeout of each of its two nearest stones in the house, and a draw to the button): the mean of the two
     best for them, weighed in at CR_CALL.replyMix.
   - The ice chart (crChart): the sheet on its side, the pebble's wear as a stain where stones have run, and every
     stone's path this game, for as far back from the house as the side's skip can read it (crReadIn: a reader of 1
     sees the house and a few feet, of 12 all the way to the hog line); the rest is hatched. */
// (the reply weighs in at replyMix, averaged over the other rink's likeliest shots: the worst case alone made the
// Archmage timid; read: the least a skip reads, the house and two feet more)
const CR_CALL = { win: 4, xend: 1, replies: 4, replyMix: .3, read: 96 };
// what the end ending this way is worth to side s: pts (theirs, signed), the hammer next end
function crEndValue(s, pts, next, sk) {
  const S = CR_SKILL[clamp((sk ?? 1) | 0, 0, 2)];
  if (S.hammer && G.end >= G.ends - 1) {
    const m = crTotal(s) - crTotal(1 - s) + pts;
    return m > 0 ? CR_CALL.win + m * .05 : m < 0 ? -CR_CALL.win + m * .05 : next === s ? CR_CALL.xend : -CR_CALL.xend;
  }
  return pts + (S.hammer ? (next === s ? CR_VAL.hammer : -CR_VAL.hammer) : 0);
}
// the other rink's likeliest reply to stones after (kAfter into the end): what side s is left with, the mean of their
// two best shots (played out as a Knight would, no miss); null when the end is over
// draws: the other rink's draws to the button (the same whatever the shot before: worked out once a plan, crReplyDraws)
function crReplyDraws(s) { const o = 1 - s, ice = crIceRead(o), out = []; for (const h of [1, -1]) { const aim = crSolveDraw(0, 0, h, ice, G.cold); if (aim) out.push(aim); } return out; }
function crReplyLikely(s, after, kAfter, sk, draws) {
  if (kAfter >= crPerEnd()) return null;
  const o = 1 - s, keep = { stones: G.stones, k: G.k };
  G.stones = after; G.k = kAfter;
  try {
    const R = CR_SHEET.stoneR, hits = [], ice = crIceRead(o);
    // (a takeout of each of side s's two nearest stones, the first handle that gets there; and always their draws)
    for (const st of after.filter(b => b.s === s && crInHouse(b)).sort((a, b) => crDist(a) - crDist(b)).slice(0, Math.max(0, CR_CALL.replies - 2))) for (const h of [1, -1]) { const aim = crSolveHit(st.x, st.y - R * 1.6, CR_AIM.vHit, h, ice, G.cold); if (aim) { hits.push(aim); break; } }
    const list = hits.concat(draws || crReplyDraws(s));
    if (!list.length) return null;
    // their likeliest reply: the mean of their best two for them (worst two for side s)
    const vals = list.map(aim => crValue(crTry(o, aim), s, kAfter + 1, G.hammer, sk)).sort((a, b) => a - b), two = vals.slice(0, 2);
    return two.reduce((a, b) => a + b, 0) / two.length;
  } finally { G.stones = keep.stones; G.k = keep.k; }
}
// why the skip calls it, in a few words, worded for either rink (the CPU's status line and your skip alike)
function crReason(s, c) {
  const st = G.stones, H = st.filter(crInHouse).sort((a, b) => crDist(a) - crDist(b)), shot = H[0], hm = G.hammer === s, last = G.k === crPerEnd() - 1;
  const tied = crTotal(0) === crTotal(1), lastEnd = G.end >= G.ends - 1, tg = c.target && st.find(b => b.id === c.target);
  if (last && hm && lastEnd && tied && (c.shot === 'draw' || c.shot === 'hitroll')) return 'a single wins it';
  switch (c.shot) {
    case 'takeout': return tg && shot && tg.id === shot.id ? 'the other rink lies shot stone: take it out' : 'take out the other rink\'s stone in the house';
    case 'peel': return hm ? 'with the hammer: peel the guard and keep the house open' : 'peel the other rink\'s guard';
    case 'hitroll': return 'take the other rink\'s stone and roll into the house';
    case 'freeze': return 'freeze to the other rink\'s stone, so it can\'t be taken out cleanly';
    case 'guard': { const centre = Math.abs(c.x || 0) < 30; return centre ? (hm ? 'a centre guard, to keep the other rink out of the house' : 'a centre guard, to play for a steal') : (hm ? 'a corner guard, to set up two with the hammer' : 'a corner guard, to put a stone in play'); }
    case 'draw': {
      const cover = st.some(g => crInFgz(g) && Math.abs(g.x - c.x) < 18 && g.y < c.y);
      if (cover) return 'a draw round the guard, behind cover';
      if (!shot) return hm ? 'a draw into an empty house' : 'a draw for shot stone';
      return shot.s === s ? 'a draw to lie two' : 'a draw to sit closer than the other rink\'s';
    }
  }
  return CR_SHOTS[c.shot] || 'a stone';
}
/* ---------- the ice chart ---------- */
// how far back side s's skip reads the ice, in inches from the tee line toward the thrower (the house and two feet at
// the least, all the way to the hog line for the best reader)
function crReadIn(s) { const skip = G.order ? G.order[s][3] : 0, r = crRat(s, skip).red; return CR_CALL.read + (CR_SHEET.hog - CR_CALL.read) * r; }
// the chart: the sheet on its side (the thrower at the left, the house at the right), w by h, for side s; paths: every
// stone's path this game ([{ s, path }]), the last bold
function crChart(c, s, w, h, paths) {
  const S = CR_SHEET, C = CR_ICE, padL = 30, padR = 10, padT = 14, padB = 22, W = w - padL - padR, H = h - padT - padB, y0 = -S.hog, y1 = S.back + 30;
  const X = y => padL + (y - y0) / (y1 - y0) * W, Y = x => padT + H / 2 - x / S.halfW * H / 2, read = crReadIn(s);
  c.save(); c.fillStyle = '#16222a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#e9f2f6'; c.fillRect(X(y0), Y(S.halfW), X(y1) - X(y0), Y(-S.halfW) - Y(S.halfW));
  // the pebble's wear, a stain where stones have run
  const cw = (2 * S.halfW) / C.cols, ch = (C.y1 - C.y0) / C.rows;
  for (let r = 0; r < C.rows; r++) for (let k = 0; k < C.cols; k++) { const v = G.ice[r * C.cols + k], wear = (1 - v) / (1 - C.min); if (wear < .05) continue;
    const yy = C.y0 + r * ch, xx = -S.halfW + k * cw; if (yy + ch < y0) continue; c.fillStyle = `rgba(70,110,170,${Math.min(.7, wear * .7)})`; c.fillRect(X(Math.max(y0, yy)), Y(xx + cw), X(yy + ch) - X(Math.max(y0, yy)), Y(xx) - Y(xx + cw)); }
  // the house, the hog line, the tee line
  for (const [rr, col] of [[72, 'rgba(60,120,200,.35)'], [48, 'rgba(255,255,255,.6)'], [24, 'rgba(200,58,58,.35)']]) { c.fillStyle = col; c.beginPath(); c.ellipse(X(0), Y(0), (X(rr) - X(0)), (Y(-rr) - Y(0)), 0, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = '#c83a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(X(-S.hog), Y(S.halfW)); c.lineTo(X(-S.hog), Y(-S.halfW)); c.stroke();
  c.strokeStyle = '#2a3a48'; c.lineWidth = 1; c.beginPath(); c.moveTo(X(0), Y(S.halfW)); c.lineTo(X(0), Y(-S.halfW)); c.stroke();
  // every stone's path, each side in its colour, the last bold
  (paths || []).forEach((P, i) => { const last = i === paths.length - 1; c.strokeStyle = G.teams[P.s].color || '#888'; c.globalAlpha = last ? 1 : .5; c.lineWidth = last ? 2.2 : 1.1;
    c.beginPath(); let on = false; for (const [x, y] of P.path) { if (y < y0) continue; on ? c.lineTo(X(y), Y(x)) : c.moveTo(X(y), Y(x)); on = true; } c.stroke(); });
  c.globalAlpha = 1;
  // past what the skip reads: hatched
  if (read < S.hog - 1) { c.fillStyle = 'rgba(22,34,42,.62)'; c.fillRect(X(y0), Y(S.halfW), X(-read) - X(y0), Y(-S.halfW) - Y(S.halfW));
    c.fillStyle = '#eef4f6'; c.font = '12px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(`not read past ${Math.round(read / 12)} feet from the tee`, (X(y0) + X(-read)) / 2, padT + H / 2 + 4); }
  c.fillStyle = '#cfe2ec'; c.font = '10px system-ui, sans-serif'; c.textAlign = 'center';
  c.fillText('hog line', X(-S.hog), h - 6); c.fillText('tee', X(0), h - 6); c.fillText('back', X(S.back), h - 6);
  c.restore();
}
