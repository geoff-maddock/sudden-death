/* The Saltmere Lanes: the rules (issue #100, phase 0). Plain data and pure functions, no page: ten-pin scoring, the
   Baker order, whose frame it is, the lane each frame is bowled on, splits, the roll-off, the re-rack and the pinch
   bowler.

   The Baker format. Each side is five bowlers and bowls one team game of ten frames on one sheet: the bowlers take
   the frames in the order the side sets, so the first bowls the 1st and the 6th, the second the 2nd and the 7th, and
   the fifth (the anchor) the 5th and the 10th. A game of 5 frames gives each bowler one, and the anchor the last.
   The sides take their frames in turn, the lead side first in each pair (side 0 unless the game says otherwise), on a
   pair of lanes: side 0 starts on lane 0 and side 1 on lane 1, and each side moves across every frame.

   Scoring is ten-pin's. A frame is two balls at ten pins, or one if the first is a strike. A strike scores 10 plus the
   next two balls, a spare 10 plus the next one, an open frame its pins. The last frame is the tenth: a strike or a
   spare in it earns fill balls (three balls in all, on a fresh rack after each strike or spare), so a perfect game is
   twelve strikes and 300.
   A split is left when the first ball on a rack takes the headpin and what stands is in two or more groups that no
   pin joins (pins touch their neighbours in the rack: BL_ADJ). The 7-10 is the famous one; the 2-3 isn't one.

   Level after the last frame, a roll-off: each side bowls a 9th and a 10th frame again, by the bowlers who bowled
   them, scored on their own (the 10th with its fills), and again if still level. A game never ends level.
   Once a game a side may call for a re-rack, and once a game it may send in a pinch bowler for a frame (any of its
   roster but the bowler the order names); both before the frame's first ball.

   G is the game, plain JSON (so a snapshot can be saved): { frames, order, roster, lead, fr, fs, stand, rb, ro, rfr,
   rfs, rerack, pinch, pinched, over }. fr: each side's frames, an array of balls each (the last may be in progress);
   fs: whether each frame's first ball left a split. stand: the pins standing for each side (numbers 1 to 10). rb: balls
   bowled on the rack in front of each side. ro: roll-offs started; rfr and rfs the roll-off's two frames. rerack:
   whether each side has called its re-rack. pinch: a side's pinch bowler for its frame in progress ({ at, ri }) or
   null; pinched: whether it has used it. over: null, or { win, tot, ro, text }. */
const BL_RULES = { side: 5, frames: 10, framesAt: [5, 10], pins: 10 };
// pins that touch in the rack: row by row the 1, the 2-3, the 4-5-6 and the 7-8-9-10, each touching its neighbours
// in its row and the two behind it
const BL_ADJ = [[1, 2], [1, 3], [2, 3], [2, 4], [2, 5], [3, 5], [3, 6], [4, 5], [5, 6], [4, 7], [4, 8], [5, 8], [5, 9], [6, 9], [6, 10], [7, 8], [8, 9], [9, 10]];
const blRack = () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
let G = null;

/* ---------- frames and the score (pure) ---------- */
// is a frame of balls finished? tenth: it is the game's last frame, with its fill balls
function blFrameDone(fr, tenth) {
  if (!fr.length) return false;
  if (!tenth) return fr[0] === 10 || fr.length >= 2;
  if (fr.length < 2) return false;
  return fr[0] === 10 || fr[0] + fr[1] === 10 ? fr.length >= 3 : true;
}
// the running total after each frame of a sheet of n frames (the nth is the tenth), or null where a strike or a spare
// still waits for its next balls (and after it)
function blScore(frames, n) {
  const balls = [], at = [];
  frames.forEach(fr => { at.push(balls.length); balls.push(...fr); });
  const out = []; let run = 0;
  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i], b = at[i]; let v = null;
    if (i === n - 1) { if (blFrameDone(fr, true)) v = fr.reduce((a, c) => a + c, 0); }
    else if (fr[0] === 10) { if (balls.length >= b + 3) v = 10 + balls[b + 1] + balls[b + 2]; }
    else if (fr.length >= 2) v = fr[0] + fr[1] === 10 ? (balls.length >= b + 3 ? 10 + balls[b + 2] : null) : fr[0] + fr[1];
    if (v === null) break;
    run += v; out.push(run);
  }
  while (out.length < frames.length) out.push(null);
  return out;
}
// a split: the headpin down, and the pins still standing in two or more groups that no standing pin joins
function blIsSplit(standing) {
  const st = standing.filter(p => Number.isInteger(p) && p >= 1 && p <= 10);
  if (st.length < 2 || st.includes(1)) return false;
  const seen = new Set([st[0]]), todo = [st[0]];
  while (todo.length) {
    const p = todo.pop();
    for (const [a, b] of BL_ADJ) { const q = a === p ? b : b === p ? a : 0; if (q && st.includes(q) && !seen.has(q)) { seen.add(q); todo.push(q); } }
  }
  return seen.size < st.length;
}
// a frame's marks as on the sheet: X a strike, / a spare, - a miss, else the pins
function blFrameMarks(fr) {
  const out = []; let left = 10, first = true;
  for (const b of fr) {
    if (first && b === 10) { out.push('X'); continue; }
    if (!first && b === left) out.push('/'); else out.push(b ? String(b) : '-');
    if (first) { left -= b; first = false; } else { left = 10; first = true; }
  }
  return out;
}

/* ---------- a game ---------- */
function blOrderOk(o, roster) {
  return Array.isArray(o) && o.length === BL_RULES.side && new Set(o).size === o.length && o.every(i => Number.isInteger(i) && i >= 0 && i < roster);
}
function blNewGame(opts) {
  const o = opts || {}, frames = BL_RULES.framesAt.includes(o.frames) ? o.frames : BL_RULES.frames;
  const roster = [0, 1].map(s => { const n = o.roster && o.roster[s]; return Number.isInteger(n) && n > BL_RULES.side ? n : BL_RULES.side; });
  const order = [0, 1].map(s => blOrderOk(o.order && o.order[s], roster[s]) ? o.order[s].slice() : [0, 1, 2, 3, 4]);
  G = { frames, order, roster, lead: o.lead === 1 ? 1 : 0, fr: [[], []], fs: [[], []], stand: [blRack(), blRack()], rb: [0, 0],
    ro: 0, rfr: [[], []], rfs: [[], []], rerack: [false, false], pinch: [null, null], pinched: [false, false], over: null };
  return G;
}
// the sheet a side is bowling on now (the game's, or the roll-off's two frames), how many frames it has, and its flags
const blSheet = s => G.ro ? G.rfr[s] : G.fr[s];
const blSheetN = () => G.ro ? 2 : G.frames;
const blFlags = s => G.ro ? G.rfs[s] : G.fs[s];
// how many frames of the sheet a side has finished
function blDone(s) { const sh = blSheet(s), n = blSheetN(); let d = 0; sh.forEach((fr, i) => { if (blFrameDone(fr, i === n - 1)) d++; }); return d; }
// the frame a side bowls next, or is bowling (0-based on its sheet; in a roll-off 0 is the 9th and 1 the 10th)
const blCur = s => blDone(s);
// that frame's place in the game's order: the roll-off's frames are the 9th and the 10th again
const blSlot = (s, f) => G.ro ? G.frames - 2 + f : f;
// a key for the frame in progress, so a pinch bowler is for that frame only
const blKey = s => (G.ro ? 'r' + G.ro + ':' : '') + blCur(s);
// whose ball it is: a side part way through a frame finishes it; else the side with fewer frames, the lead on level
function blUp() {
  if (!G || G.over) return -1;
  const n = blSheetN(), d = [blDone(0), blDone(1)];
  for (const s of [0, 1]) if (G.rb[s] > 0 || (blSheet(s).length > d[s] && blSheet(s)[d[s]].length)) return s;
  if (d[0] >= n && d[1] >= n) return -1;
  if (d[0] === d[1]) return G.lead;
  return d[0] < d[1] ? 0 : 1;
}
// who bowls a side's frame now: its pinch bowler for this frame, else the one the order names
function blScheduled(s) { return G.order[s][blSlot(s, blCur(s)) % BL_RULES.side]; }
function blBowler(s) { const P = G.pinch[s]; return P && P.at === blKey(s) ? P.ri : blScheduled(s); }
// the lane (0 or 1) a side bowls a frame on: across every frame, the sides on opposite lanes
function blLane(s, f) { const k = f == null ? blSlot(s, blCur(s)) : f; return (s + k) % 2; }
// the frame's number as said on the lanes: 1 to 10 (in a roll-off, 9 and 10)
const blFrameNo = s => blSlot(s, Math.min(blCur(s), blSheetN() - 1)) + 1;

// why side s may not bowl now ('' if it may): the words blRoll refuses with
function blWhyNot(s) {
  if (!G) return 'No game.';
  if (G.over) return 'The game is over.';
  const u = blUp();
  return u === s ? '' : 'It is the other side\'s frame.';
}
/* side s bowls a ball: pins is the list of pins it knocks down (numbers, all standing), or how many (the first that
   many of those standing). Says what happened: the pins, a strike, a spare, a split, the frame finished and its
   score, and the game's end or a roll-off. A refused ball says why and changes nothing. */
function blRoll(s, pins) {
  const why = blWhyNot(s); if (why) return { ok: false, why };
  const st = G.stand[s];
  let down;
  if (Number.isInteger(pins)) { if (pins < 0 || pins > st.length) return { ok: false, why: `Only ${st.length} pin${st.length === 1 ? '' : 's'} standing.` }; down = st.slice(0, pins); }
  else if (Array.isArray(pins)) {
    if (new Set(pins).size !== pins.length || !pins.every(p => st.includes(p))) return { ok: false, why: 'Those pins are not all standing.' };
    down = pins.slice().sort((a, b) => a - b);
  } else return { ok: false, why: 'Say which pins fell.' };
  const sh = blSheet(s), n = blSheetN(), f = blCur(s), tenth = f === n - 1, first = G.rb[s] === 0;
  if (sh.length <= f) sh.push([]);
  const fr = sh[f]; fr.push(down.length);
  G.stand[s] = st.filter(p => !down.includes(p)); G.rb[s]++;
  const strike = first && down.length === 10, spare = !first && G.stand[s].length === 0;
  const split = first && !strike && blIsSplit(G.stand[s]);
  // a frame is marked split if any first ball on a rack in it left one (the tenth can have two racks)
  const flags = blFlags(s); while (flags.length <= f) flags.push(false); flags[f] = flags[f] || split;
  const done = blFrameDone(fr, tenth);
  // a fresh rack after a finished frame, and inside the tenth after a strike or a spare
  if (done || strike || spare || G.rb[s] >= 2) { G.stand[s] = blRack(); G.rb[s] = 0; }
  if (done && G.pinch[s] && G.pinch[s].at === (G.ro ? 'r' + G.ro + ':' : '') + f) G.pinch[s] = null;
  const out = { ok: true, side: s, n: down.length, pins: down, strike, spare, split, done, frame: blSlot(s, f) + 1, score: done ? blScore(sh, n)[f] : null, over: null, rolloff: false };
  if (done) blEndCheck(out);
  return out;
}
// both sides through their sheet: the higher total wins; level, a roll-off
function blEndCheck(out) {
  const n = blSheetN();
  if (blDone(0) < n || blDone(1) < n) return;
  const tot = [blTotal(0), blTotal(1)];
  if (tot[0] !== tot[1]) {
    const win = tot[0] > tot[1] ? 0 : 1, game = G.ro ? [blTotalOf(G.fr[0], G.frames), blTotalOf(G.fr[1], G.frames)] : tot;
    G.over = { win, tot, ro: G.ro, game, text: G.ro ? `${Math.max(...tot)} to ${Math.min(...tot)} in the roll-off, after ${game[0]} all` : `${Math.max(...tot)} to ${Math.min(...tot)}` };
    out.over = G.over; return;
  }
  G.ro++; G.rfr = [[], []]; G.rfs = [[], []]; G.stand = [blRack(), blRack()]; G.rb = [0, 0];
  out.rolloff = true;
}
// a sheet's total so far: the last frame scored
function blTotalOf(sh, n) { const sc = blScore(sh, n).filter(v => v !== null); return sc.length ? sc[sc.length - 1] : 0; }
// a side's total on the sheet in play (the roll-off's own, in a roll-off)
function blTotal(s) { return G ? blTotalOf(blSheet(s), blSheetN()) : 0; }

/* ---------- the re-rack and the pinch bowler ---------- */
function blBeforeFrame(s) {
  const why = blWhyNot(s); if (why) return why;
  const sh = blSheet(s), f = blCur(s);
  return G.rb[s] || (sh[f] && sh[f].length) ? 'Only before the frame\'s first ball.' : '';
}
// call for a re-rack (once a game): Moll sets the rack again before this frame's first ball
function blRerack(s) {
  const why = blBeforeFrame(s) || (G.rerack[s] ? 'One re-rack a game.' : '');
  if (why) return { ok: false, why };
  G.rerack[s] = true; G.stand[s] = blRack();
  return { ok: true, side: s, frame: blFrameNo(s) };
}
// send in bowler ri for this frame (once a game): anyone on the roster but the bowler the order names
function blPinch(s, ri) {
  const why = blBeforeFrame(s) || (G.pinched[s] ? 'One pinch bowler a game.' : '') ||
    (!Number.isInteger(ri) || ri < 0 || ri >= G.roster[s] ? 'No such bowler.' : '') || (ri === blScheduled(s) ? 'That bowler is up anyway.' : '');
  if (why) return { ok: false, why };
  G.pinched[s] = true; G.pinch[s] = { at: blKey(s), ri };
  return { ok: true, side: s, ri, for: blScheduled(s), frame: blFrameNo(s) };
}

/* ---------- the sheet and the game in words ---------- */
// a side's sheet: each frame's marks, whether it left a split, and its running total (null while it waits)
function blMarks(s) {
  const row = (sh, fl, n) => { const sc = blScore(sh, n); return sh.map((fr, i) => ({ b: blFrameMarks(fr), split: !!fl[i], score: sc[i] })); };
  return { game: row(G.fr[s], G.fs[s], G.frames), ro: G.ro ? row(G.rfr[s], G.rfs[s], 2) : null };
}
// the game from side s's point of view
function blMatchText(s) {
  if (!G) return '';
  const t = s ? 1 : 0, o = 1 - t;
  if (G.over) { const w = G.over.win === t, a = G.over.tot[t], b = G.over.tot[o];
    return (w ? 'Won ' : 'Lost ') + `${a} to ${b}` + (G.over.ro ? ` in the roll-off, after ${G.over.game[0]} all` : ''); }
  const a = blTotal(t), b = blTotal(o), d = Math.min(blDone(0), blDone(1));
  const when = G.ro ? 'in the roll-off' : d ? `after ${d}` : '';
  if (!d && !G.ro) return 'Nothing down yet';
  return (a === b ? 'Level' : a > b ? `Up ${a - b}` : `Down ${b - a}`) + (when ? ' ' + when : '');
}
