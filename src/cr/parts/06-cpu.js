/* The Curling Shed: the CPU's skip (issue #102, phase 1). Before each stone the skip looks at the house, lists the shots
   worth a look, plays each one out on the stone model (the stones as they lie, no miss), and calls the one whose
   result is worth most; the curler then throws it with their own miss, and the sweepers sweep it home.
   The shots (CR_SHOTS): a draw (to the button, the top of the four-foot, either side, the back of the house), a guard
   (centre or corner), a freeze (to rest just in front of one of theirs), a takeout (one of theirs in play out, a guard
   at peel weight), and a hit and roll (the hit, rolling into the house).
   What a result is worth (crValue): the end's score if it stopped there, less as more stones are to come; stones in
   the house; and, for a Knight and up, the hammer: the side without it wants guards in the centre, the side with it
   wants the middle open and corner guards, and at the end of an end what the hammer is worth next.
   The skills (CR_SKILL): a Squire looks at fewer shots (only one handle), doesn't think about the hammer, misses more
   and sweeps late; a Knight looks at them all and plays the likeliest result over a few throws with its own miss; an
   Archmage also looks at draws round the guards, at more throws, misses least and reads the ice as it is now.
   The sweepers (crSweeper): on a draw, a guard and a freeze they sweep whenever the stone would stop short of where
   it was called (by its speed now), harder the further short; on a hit they don't.
   The ice a skip reads (crIceRead, CR_SKILL's ice): an Archmage the pebble as it is now, a Knight as it was when the end
   began, a Squire the fresh pebble; it aims on it and judges its shots on it, so a misread costs it. Its shots know the
   free guard zone: no peel of a guard of theirs before the fifth stone. */
const CR_SKILL = [
  { n: 'Squire', ang: .45, v: .022, samples: 1, top: 1, hammer: false, ice: 'fresh', sweepLate: 600 },
  { n: 'Knight', ang: .28, v: .013, samples: 3, top: 3, hammer: true, ice: 'end', sweepLate: 0 },
  { n: 'Archmage', ang: .2, v: .009, samples: 5, top: 4, hammer: true, ice: 'now', sweepLate: 0 }];
const CR_SHOTS = { draw: 'a draw', guard: 'a guard', freeze: 'a freeze', takeout: 'a takeout', peel: 'a peel', hitroll: 'a hit and roll' };
const CR_VAL = { left: .45, house: .22, cguard: .35, kguard: .4, hammer: .6 };
// the ice the side's skip reads: an Archmage the ice as it is now, a Knight as it was when the end began (it has seen
// the last end's stones), a Squire the fresh pebble on the day
// (a Knight whose skip reads the ice well, CR_READ.now and up, sees it as it is now)
const CR_READ = { now: .7 };
const crIceRead = s => { const I = CR_SKILL[clamp(((G.skill || [])[s] ?? 1) | 0, 0, 2)].ice, skip = G.order ? G.order[s][3] : 0;
  return I === 'now' || (I === 'end' && crRat(s, skip).red >= CR_READ.now) ? G.ice : I === 'end' ? G.iceEnd || null : null; };
// what the stones after a shot are worth to side s, kAfter stones into the end
function crValue(stones, s, kAfter, hammer, sk) {
  const R = crScoreEnd(stones), pts = R.s === s ? R.n : R.s === 1 - s ? -R.n : 0, S = CR_SKILL[clamp((sk ?? 1) | 0, 0, 2)];
  // (the end's last stone: what it does to the game, crEndValue in 11-call.js)
  if (kAfter >= crPerEnd()) { const next = R.s >= 0 ? 1 - R.s : hammer; return crEndValue(s, pts, next, sk); }
  const left = (crPerEnd() - kAfter) / crPerEnd(); let v = pts * (1 - CR_VAL.left * left);
  for (const st of stones) {
    const mine = st.s === s ? 1 : -1;
    if (crInHouse(st)) v += mine * CR_VAL.house;
    else if (S.hammer && crInFgz(st) && st.y > -CR_SHEET.hog + 30) {
      const centre = Math.abs(st.x) < 30, ham = st.s === hammer;
      // a guard is worth its side something: the centre to the side without the hammer, the corners to the side with it
      if (centre && !ham) v += mine * CR_VAL.cguard * left; else if (!centre && ham) v += mine * CR_VAL.kguard * left; else v -= mine * .05 * left;
    }
  }
  return v;
}
// the shots worth a look for side s now: [{ shot, x, y, v?, h, aim: { ang, v, h }, target? }]
function crShots(s, sk) {
  const S = CR_SKILL[sk], R = CR_SHEET.stoneR, ice = crIceRead(s), cold = G.cold, st = G.stones, out = [];
  const hs = S.top > 1 ? [1, -1] : [1];
  const draw = (shot, x, y) => { for (const h of hs) { const aim = crSolveDraw(x, y, h, ice, cold); if (aim) out.push({ shot, x, y, h, aim }); } };
  const hit = (shot, o, v, dx) => { for (const h of hs) { const aim = crSolveHit(o.x + (dx || 0), o.y - R * 1.6, v, h, ice, cold); if (aim) out.push({ shot, x: o.x, y: o.y, h, aim, target: o.id, roll: dx || 0 }); } };
  draw('draw', 0, 0); draw('draw', 0, -40); draw('draw', 40, -8); draw('draw', -40, -8); draw('draw', 0, 34);
  draw('guard', 0, -190); draw('guard', 52, -175); draw('guard', -52, -175);
  for (const o of st.filter(o => o.s !== s)) {
    if (crInHouse(o)) { draw('freeze', o.x, o.y - 2 * R - .5); hit('takeout', o, CR_AIM.vHit); if (S.top > 1) { hit('hitroll', o, CR_AIM.vRoll, 3); hit('hitroll', o, CR_AIM.vRoll, -3); } }
    // (a guard of theirs can't be taken out before the fifth stone: the free guard zone)
    else if (crInFgz(o) && G.k >= G.fgz) hit('peel', o, CR_AIM.vPeel);
  }
  // an Archmage also draws round the guards (behind each one, at the top of the house)
  if (sk >= 2) for (const g of st.filter(crInFgz)) draw('draw', g.x, Math.max(-60, g.y + 150));
  return out;
}
// side s's release of a shot: its aim, with the curler's miss (heading and weight)
function crMiss(s, aim, shot) { const S = CR_SKILL[clamp(((G.skill || [])[s] ?? 1) | 0, 0, 2)], k = crErrK(s, shot); return { ang: aim.ang + gauss() * S.ang * k.ang, v: aim.v * (1 + gauss() * S.v * k.v), h: aim.h }; }
// play a shot out on the model (no sweeping, the stones as they lie, on the ice the skip reads): the stones after, as the
// rules leave them (the free guard zone puts a taken guard back and removes the stone)
function crTry(s, aim) {
  const r = crRun(G.stones, { id: 'try', s, x0: 0, ang: aim.ang, v: aim.v, h: aim.h }, { ice: crIceRead(s), cold: G.cold, plan: true });
  if (G.k < G.fgz && G.stones.some(b => b.s !== s && crInFgz(b) && !r.stones.some(a => a.id === b.id))) return G.stones.slice();
  return r.stones;
}
// the skip's call for side s: { shot, x, y, h, aim, target, why, val }
// style: your rink's game under Manage ('draw' or 'hit': a little more for those shots), or none
const CR_STYLE = { bonus: .3, draw: ['draw', 'guard', 'freeze'], hit: ['takeout', 'peel', 'hitroll'] };
function crPlan(s, style) {
  const sk = clamp(((G.skill || [])[s] ?? 1) | 0, 0, 2), S = CR_SKILL[sk], kAfter = G.k + 1, list = crShots(s, sk);
  if (!list.length) return { shot: 'draw', x: 0, y: 0, h: 1, aim: { ang: 0, v: CR_AIM.vDraw, h: 1 }, why: 'the button', val: 0 };
  for (const c of list) c.val = crValue(crTry(s, c.aim), s, kAfter, G.hammer, sk) + (CR_STYLE[style] && CR_STYLE[style].includes(c.shot) ? CR_STYLE.bonus : 0);
  list.sort((a, b) => b.val - a.val);
  // the best few, played a few times with the curler's own miss: the likeliest result wins
  const top = list.slice(0, S.top);
  if (S.samples > 1) for (const c of top) { let sum = 0; for (let i = 0; i < S.samples; i++) sum += crValue(crTry(s, crMiss(s, c.aim, c.shot)), s, kAfter, G.hammer, sk); c.exp = sum / S.samples; }
  // an Archmage plays its best few on against the other rink's likeliest reply (crReplyLikely), and weighs that in
  if (sk >= 2) { const draws = crReplyDraws(s); for (const c of top) { const w = crReplyLikely(s, crTry(s, c.aim), kAfter, sk, draws); if (w !== null) c.exp = (c.exp ?? c.val) * (1 - CR_CALL.replyMix) + w * CR_CALL.replyMix; } }
  const best = top.slice().sort((a, b) => (b.exp ?? b.val) - (a.exp ?? a.val))[0];
  return Object.assign({}, best, { why: crWhy(best), reason: crReason(s, best) });
}
function crWhy(c) {
  const where = c.shot === 'guard' ? (Math.abs(c.x) < 30 ? 'in the centre' : 'on the corner') : c.shot === 'draw' ? (Math.hypot(c.x, c.y) < 10 ? 'to the button' : c.y > 20 ? 'to the back of the house' : c.y < -30 ? 'to the top of the four-foot' : 'to the side of the house') : '';
  return `${CR_SHOTS[c.shot]}${where ? ' ' + where : ''}, ${c.h > 0 ? 'out-turn' : 'in-turn'}`;
}
// the sweepers for a called shot: sweep while the stone would stop short of the call (its speed now), harder the
// further short, from the release (a Squire's only from halfway down the sheet: sweepLate)
function crSweeper(s, plan) {
  if (!plan || !['draw', 'guard', 'freeze'].includes(plan.shot)) return null;
  const S = CR_SKILL[G.skill[s]];
  return st => {
    if (st.y < CR_STONE.y0 + S.sweepLate) return 0;
    const v = Math.hypot(st.vx, st.vy), stopY = st.y + (st.vy / Math.max(v, 1e-6)) * v * v / (2 * CR_STONE.a * crIceAt(G.ice, st.x, st.y, G.cold));
    const short = plan.y - stopY; return short > 8 ? clamp(short / 50, .3, 1) : 0;
  };
}
