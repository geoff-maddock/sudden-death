/* The Saltmere Lanes in the Umbral (issue #99, phase 4g): the Lich, the hexes, and a bowler's own ultimate. Nothing here
   runs unless a game asks for it: with no hexes, no skill 3 and no bowler's own ultimate, the engine plays exactly as
   before (same seed, same game).

   The Lich (G.skill 3, above the Archmage; BL_SKILL's fourth row). Its release strays exactly as an Archmage's does; it
   decides better. It reads the lane as it is now, the tide and the transition and any curse on its ball (a Hex's
   heavy oil, a power's hook) included, and before every ball it weighs what it could bowl through the same pure ball
   model the game uses:
   - a strike ball: every stand across BL_LICH.stands spots (deep inside to up the boards), three aims in the pocket
     (light, flush, high) and, from the best of them, a touch slower and quicker. Each is thrown BL_LICH.z times in its
     head (its own miss at this moment, the line's and the tempo's part in it: a spread of fixed samples, so no random
     number is drawn) and scored at the pins by what that entry carries (blLichCarry: the strikes and splits of the
     ball at that place, angle and speed, from the pins themselves, worked once a page: blLichTable). The line follows
     from the stand it picks (G.line: deep inside, the pocket or up the boards). The Archmage's own plan is always one of
     those weighed, and another is played only when it scores better by BL_LICH.margin;
   - a spare: three aims across the pin and three places to stand, weighed the same way (a lone pin by whether the ball
     reaches it; more pins on the deck, from seeds of its own);
   - a split: convert or take the sure count by what each is worth (blLichCall: the chance of the spare times the frame
     it makes, against the pins of the safe side).
   It takes a potion worth 2 and casts as an Archmage.
   Hexes (opts.hexes: ids in BL_HEX; G.hex = { ids, on }, plain JSON, so a kept game keeps them). Each works against
   one side, G.hex.on (opts.hexOn, 0 by default: yours):
     ichor  The Ichor Oil: that side's balls take BL_HEX.ichor.k times as much oil off the lane (blWear's k): the track
            dries early and the lanes move under both sides, and the side that reads the oil as it is gains
     drown  The Waterlogged Pin: one pin of each of that side's frames (blHexPin: a pin from the frame, never R) is
            BL_HEX.drown.k times as heavy and as hard to topple (blDeck's drown)
     pull   The Hungry Gutters: within BL_HEX.pull.w inches of either edge that side's ball drifts toward the gutter
            (blBall's pull), BL_HEX.pull.k a step
     tide   The Black Tide: under that side's balls the oil plays BL_HEX.tide.k times as heavy as it looks (the ball's
            oilK); no read sees it, so the ball skids long and comes in light
   The hexes are named before the first frame, on the scoreboard all game, and the waterlogged pin before the frame.
   A bowler's own ultimate (a roster bowler sent with { ult: id }, an id in BL_ULT_OWN): used in place of their kind's
   (blUltOf). The Drowned Lanes' champion brings one. */
BL_SKILL.push({ n: 'Lich', ang: BL_SKILL[2].ang, mph: BL_SKILL[2].mph, rpm: BL_SKILL[2].rpm, read: 1, spare: true, learn: 0, stands: BL_SKILL[2].stands, lich: true });
BL_KIT.take[3] = 2;
const BL_LICH = {
  stands: 9, step: 1.4, aims: [-.8, 0, .8], speeds: [-.7, .7], margin: .012, gutter: -.5, splitCost: .5,
  // the samples of its miss it throws in its head: [ang z, mph z, weight]
  z: [[0, 0, .3], [.9, 0, .17], [-.9, 0, .17], [1.8, 0, .06], [-1.8, 0, .06], [0, 1.2, .12], [0, -1.2, .12]],
  spareZ: [[0, .34], [1, .24], [-1, .24], [2, .09], [-2, .09]], spareAims: [-1.5, 0, 1.5], spareStands: [0, -5, 5], bonus: 8,
  // the carry table: the place at the pins off the pocket (inches, plus toward the headpin), the entry angle, the speed
  // at the pins (mph), each from `seeds` racks of pins
  table: { dx: [-3, 3, .5], en: [2, 8, 2], v: [14.5, 16.5], seeds: 8, spin: .15, mass: 1.04 },
};
const BL_HEX = {
  ichor: { n: 'The Ichor Oil', d: 'The oil turns to ichor under your balls: each takes twice as much off the lane, so your track dries early and the lanes move under you.', k: 2 },
  drown: { n: 'The Waterlogged Pin', d: 'One pin of every frame you bowl is waterlogged: nearly four times as heavy, and as hard to knock down. You are told which before the frame.', k: 3.7 },
  pull: { n: 'The Hungry Gutters', d: 'The gutters pull at your ball: within three boards of either edge it drifts toward them.', w: 3, k: .0006 },
  tide: { n: 'The Black Tide', d: 'The tide runs black under your balls: the oil plays heavier than it looks, and no read sees it, so your ball skids long.', k: 1.012 },
};
const BL_ULT_OWN = {
  drownbell: blU('drownbell', 'The Drowning Bell', 'A bell rings under the floor: their balls this frame skid long on heavy oil, and carry less.', null, { skid: 1.05, carry: .92 }),
};
// the ultimate bowler ri of side s casts: their own, if they bring one, else their kind's
function blUltOf(s, ri) { const m = G.teams[s].roster[ri]; return (m && m.ult && BL_ULT_OWN[m.ult]) || BL_ULT[m && m.kind] || BL_ULT.goblin; }

/* ---------- the hexes ---------- */
function blHexStart(ids, on) { const hx = (ids || []).filter((k, i, a) => BL_HEX[k] && a.indexOf(k) === i); if (hx.length) G.hex = { ids: hx, on: on === 1 ? 1 : 0 }; }
const blHexOn = (id, s) => !!(G && G.hex && G.hex.ids.includes(id) && s === G.hex.on);
const blHexOilK = s => blHexOn('tide', s) ? BL_HEX.tide.k : 1;
const blHexWearK = s => blHexOn('ichor', s) ? BL_HEX.ichor.k : 1;
const blHexThrow = s => blHexOn('pull', s) ? { pull: { w: BL_HEX.pull.w, k: BL_HEX.pull.k } } : null;
// the waterlogged pin of side s's frame now: from the frame (the same for both its balls), never R
function blHexPin(s) {
  const key = 'drown:' + s + ':' + blKey(s) + ':' + G.frames + ':' + G.lead;
  let h = 2166136261; for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return 1 + ((h >>> 0) % 10);
}
const blHexDeck = s => blHexOn('drown', s) ? { drown: blHexPin(s), drownK: BL_HEX.drown.k } : null;
const blHexNames = () => G && G.hex ? G.hex.ids.map(k => BL_HEX[k].n).join(', ') : '';
const blHexLine = () => G && G.hex ? `Hexes on ${G.teams[G.hex.on].name}: ${blHexNames()}` : '';
// before a frame of the hexed side: which pin is waterlogged
function blHexSay(s) { return blHexOn('drown', s) && G.rb[s] === 0 && G.stand[s].length === 10 ? `The ${blHexPin(s)} is waterlogged this frame. ` : ''; }

/* ---------- the Lich ---------- */
const BLU = { table: null };
const blLichAxis = A => { const out = []; for (let v = A[0]; v <= A[1] + 1e-9; v += A[2]) out.push(+v.toFixed(3)); return out; };
// the carry table: for a ball at dx inches off the pocket, entry en degrees and v mph at the pins, the share of racks it
// strikes, and the share it splits (a right-hander's ball; a left-hander's is its mirror). Worked once a page, from
// seeds of its own (never R)
function blLichTable() {
  if (BLU.table) return BLU.table;
  const T = BL_LICH.table, dx = blLichAxis(T.dx), en = blLichAxis(T.en), v = T.v, cell = [];
  let k = 0;
  for (const vv of v) for (const e of en) for (const d of dx) {
    let st = 0, sp = 0;
    for (let i = 0; i < T.seeds; i++) {
      const r = blDeck(blRack(), { x: BL_POCKET + d, m: Math.tan(e * Math.PI / 180), v: vv * BL_MPH, spin: T.spin, hand: 1, mass: BL_PIN.mBall * T.mass }, 7919 * (i + 1) + 104729 * k);
      if (r.down.length === 10) st++; else if (blIsSplit(blRack().filter(p => !r.down.includes(p)))) sp++;
    }
    cell.push([st / T.seeds, sp / T.seeds]); k++;
  }
  return BLU.table = { dx, en, v, cell };
}
// what a ball carries at the pins (trilinear on the table; past its edge, less and less): [strike, split]
function blLichCarry(d, e, vm) {
  const T = blLichTable(), at = (A, x) => { const c = clamp(x, A[0], A[A.length - 1]); let i = 0; while (i < A.length - 2 && A[i + 1] <= c) i++; return [i, A.length > 1 ? (c - A[i]) / (A[i + 1] - A[i]) : 0]; };
  const [i, u] = at(T.dx, d), [j, w] = at(T.en, e), [l, y] = at(T.v, vm), nd = T.dx.length, ne = T.en.length;
  const get = (a, b, c) => T.cell[(c * ne + b) * nd + a];
  const out = [0, 0];
  for (const [a, fa] of [[i, 1 - u], [i + 1, u]]) for (const [b, fb] of [[j, 1 - w], [j + 1, w]]) for (const [c, fc] of [[l, 1 - y], [l + 1, y]]) {
    const f = fa * fb * fc; if (!f) continue; const C = get(Math.min(a, nd - 1), Math.min(b, ne - 1), Math.min(c, T.v.length - 1)); out[0] += f * C[0]; out[1] += f * C[1];
  }
  const past = Math.max(0, Math.abs(d) - T.dx[T.dx.length - 1]);
  if (past) out[0] *= Math.max(0, 1 - past / 1.5);
  return out;
}
// how good a strike ball t is for side s, thrown in its head with its miss at this moment (k): the weighted carry
function blLichWeigh(s, t, oil, k) {
  const sk = BL_SKILL[3], h = t.hand === -1 ? -1 : 1;
  let sum = 0;
  for (const [za, zm, wt] of BL_LICH.z) {
    const r = blBall(Object.assign({}, t, { ang: t.ang + za * sk.ang * k, mph: t.mph + zm * sk.mph * k }), oil, G.tide);
    if (r.gutter !== null) { sum += wt * BL_LICH.gutter; continue; }
    const C = blLichCarry(h * r.x - BL_POCKET, r.entry, r.v / BL_MPH);
    sum += wt * (C[0] - BL_LICH.splitCost * C[1]);
  }
  return sum;
}
// the angle that sends throw t to tx at the pins, from a guess a0 (the secant method, a few balls; blAimAt's bisection
// when it doesn't settle): null when nothing gets there
function blLichAim(t, tx, oil, a0) {
  const at = a => { const r = blBall(Object.assign({}, t, { ang: a }), oil, G.tide); return r.gutter !== null ? null : r.x; };
  if (a0 != null) {
    let a = a0, x = at(a), b = a0 + .05, y = at(b);
    for (let i = 0; i < 6 && x !== null && y !== null; i++) {
      if (Math.abs(y - tx) < .25) return +b.toFixed(4);
      if (Math.abs(y - x) < 1e-6) break;
      const c = b + (tx - y) * (b - a) / (y - x); if (!isFinite(c) || Math.abs(c) > 6) break;
      a = b; x = y; b = c; y = at(b);
    }
  }
  return blAimAt(t, tx, oil, G.tide);
}
// the line a stand is on, for a bowler whose best stand (the pocket line's) is base0
function blLichLineAt(x0, base0, h) { const off = h * (x0 - base0) / BL_LANE.bw; return off >= 1 ? 'deep' : off <= -1 ? 'boards' : 'pocket'; }
// the Lich's ball for side s (null to fall back on the Archmage's). On a full rack it also sets the line it picked
function blLichPlan(s) {
  const ri = blBowler(s), st = blStyleNow(s, ri), lane = blLane(s), stand = G.stand[s], oil = G.oil[lane], fx = blFxFor(s), h = st.hand;
  const base = { mph: st.mph, rpm: st.rpm, hand: h, oilK: fx.skid };
  // the Archmage's plan: the one to beat
  const kk = G.skill[s]; G.skill[s] = 2; let A; try { A = blPlan(s); } finally { G.skill[s] = kk; }
  if (stand.length < 10) return blLichSpare(s, A, base, oil);
  const errK = blErrK(s, ri, false) * BL_STANCE[blStanceOf(s).tempo].err, kOf = line => errK * BL_LINES[line].err;
  const base0 = blStand(st) + h * BL_LINE_BASE * BL_LANE.bw;
  let guess = A.ang;
  const weigh = (x0, mph, aim) => {
    const t = Object.assign({}, base, { x0, mph, ball: 'strike' }), tx = h * (BL_POCKET + aim), ang = blLichAim(t, tx, oil, guess);
    if (ang === null) return null;
    guess = ang;
    const line = blLichLineAt(x0, base0, h);
    return { x0, ang, mph, aim, tx, line, v: blLichWeigh(s, Object.assign(t, { ang }), oil, kOf(line)) };
  };
  // (the Archmage's own, as it would bowl it, on its line)
  const aLine = blLineOf(s), a0 = { x0: A.x0, ang: A.ang, mph: A.mph, aim: 0, tx: A.aim.x, line: aLine, v: blLichWeigh(s, Object.assign({}, base, { x0: A.x0, ang: A.ang, ball: 'strike' }), oil, kOf(aLine)) };
  let best = null;
  const n = BL_LICH.stands, m = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const x0 = base0 + h * (i - m) * BL_LICH.step; if (Math.abs(x0) > BL_LANE.edge - 2) continue;
    for (const aim of BL_LICH.aims) { const c = weigh(x0, st.mph, aim); if (c && (!best || c.v > best.v)) best = c; }
  }
  if (best) for (const d of BL_LICH.speeds) { const c = weigh(best.x0, +(st.mph + d).toFixed(2), best.aim); if (c && c.v > best.v) best = c; }
  const P = best && best.v > a0.v + BL_LICH.margin ? best : a0;
  G.line[s] = P.line;
  // (oilK goes no further: blRelease copies the plan, and blBowlBall sets the ball's own)
  return Object.assign({}, base, { x0: P.x0, ang: P.ang, mph: P.mph, ball: 'strike', aim: { x: P.tx, y: BL_LANE.len }, why: 'the pocket' + (P.line !== 'pocket' ? ', ' + BL_LINES[P.line].n.toLowerCase() : ''), weighed: +P.v.toFixed(3) });
}
// a spare: what side s's standing pins would give for a spare ball t, thrown in its head (k its miss): [chance of the
// spare, pins down on average]
function blLichSpareTry(s, pins, t, oil, k) {
  const sk = BL_SKILL[3], L = BL_LANE, one = pins.length === 1, spots = blHallSpots(s);
  let p = 0, n = 0, i = 0;
  for (const [za, wt] of BL_LICH.spareZ) {
    const r = blBall(Object.assign({}, t, { ang: t.ang + za * sk.ang * k }), oil, G.tide); i++;
    if (r.gutter !== null) continue;
    if (one) { const sp = (spots && spots[pins[0]]) || BL_SPOT[pins[0]], x = r.x + r.m * (sp[1] - L.len); if (Math.abs(x - sp[0]) < (L.ballR + L.pinR) * .92) { p += wt; n += wt; } continue; }
    const d = blDeck(pins, { x: r.x, m: r.m, v: r.v, spin: r.spin, hand: r.hand, mass: BL_PIN.mBall }, (Math.imul(G.n + 1, 2654435761) ^ (i * 40503)) >>> 0, spots);
    n += wt * d.down.length; if (d.down.length === pins.length) p += wt;
  }
  return [p, n];
}
// the best spare ball at pins (a group, or all that stand): { t, p, n }
function blLichSpareBest(s, pins, base, oil, k) {
  const T = blSpareTarget(pins), x00 = clamp(-T.x * .7, -14, 14);
  let best = null;
  // (more pins on the deck cost a rack of pins a throw in its head: three aims from the Archmage's stand; a lone pin, every
  // stand too)
  for (const dx0 of pins.length === 1 ? BL_LICH.spareStands : [0]) for (const a of BL_LICH.spareAims) {
    const x0 = clamp(x00 + dx0, -14, 14), t = Object.assign({}, base, { x0, ball: 'spare' }), tx = T.x + a;
    let ang = blAimAt(t, tx, oil, G.tide); if (ang === null) continue;
    const r = blBall(Object.assign({ ang }, t), oil, G.tide), a2 = blAimAt(t, tx - r.m * (T.y - BL_LANE.len), oil, G.tide); if (a2 !== null) ang = a2;
    const [p, n] = blLichSpareTry(s, pins, Object.assign({}, t, { ang }), oil, k), v = p + n / 100;
    if (!best || v > best.v + 1e-9) best = { t: Object.assign({}, t, { ang }), p, n, v, tx, ty: T.y };
  }
  return best;
}
function blLichSpare(s, A, base, oil) {
  const stand = G.stand[s], ri = blBowler(s), k = blErrK(s, ri, true) * blCallErr(s);
  const groups = blGroups(stand).sort((a, b) => b.length - a.length || Math.min(...a.map(p => Math.abs(BL_SPOT[p][0]))) - Math.min(...b.map(p => Math.abs(BL_SPOT[p][0]))));
  const conv = groups.length > 1 && G.split[s] === 'convert', pins = conv ? stand : groups[0];
  const B = blLichSpareBest(s, pins, base, oil, k); if (!B) return null;
  // (the Archmage's own spare ball is one of those weighed: another only when it is better)
  const [p0, n0] = blLichSpareTry(s, pins, Object.assign({}, base, { x0: A.x0, ang: A.ang, ball: 'spare' }), oil, k);
  if (B.v <= p0 + n0 / 100 + BL_LICH.margin) return A;
  return Object.assign({}, base, { x0: B.t.x0, ang: B.t.ang, ball: 'spare', aim: { x: B.tx, y: B.ty }, why: A.why, weighed: +B.p.toFixed(3) });
}
// the Lich's call before a ball: on a split, convert or take the sure count by what each is worth. Says what, or ''
function blLichCall(s) {
  const stand = G.stand[s];
  if (stand.length === 10 || !blIsSplit(stand)) return '';
  const groups = blGroups(stand).sort((a, b) => b.length - a.length || Math.min(...a.map(p => Math.abs(BL_SPOT[p][0]))) - Math.min(...b.map(p => Math.abs(BL_SPOT[p][0]))));
  if (groups.length < 2) return '';
  const ri = blBowler(s), st = blStyleNow(s, ri), fx = blFxFor(s), oil = G.oil[blLane(s)], base = { mph: st.mph, rpm: st.rpm, hand: st.hand, oilK: fx.skid };
  const k = blErrK(s, ri, true) * blCallErr(s), C = blLichSpareBest(s, stand, base, oil, k), S = blLichSpareBest(s, groups[0], base, oil, k);
  if (!C || !S) return '';
  // a spare is worth the pins and the next ball on top (about BL_LICH.bonus); the safe side's count is worth its pins
  const vc = C.p * (stand.length + BL_LICH.bonus) + (1 - C.p) * Math.min(C.n, stand.length - 1), vs = S.n;
  const was = G.split[s]; G.split[s] = vc > vs ? 'convert' : 'safe';
  return G.split[s] !== was ? (G.split[s] === 'convert' ? 'it goes for the split' : 'it takes the sure count') : '';
}
