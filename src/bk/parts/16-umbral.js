/* The Charter Court in the Umbral (issue #99, phase 4d): the Lich, the hexes, and the Nadir captain's ultimate. Nothing
   here runs unless a game asks for it: with no hexes and no skill 3, the engine plays exactly as before (same seed, same
   game).
   The Lich (G.skill 3, above the Archmage). The Archmage reads the set you run most and plays the defense that beats it;
   the Lich reads the whole possession. On defense it weighs each defense by what your offense will really run against
   it: a coach calling by hand keeps the set it has called, a CPU coach leans to what beats that defense as its skill
   does, blended with what you have really run lately (BK_LICH.see; the later the more it counts). Each defense is then
   weighed down by the edge that leaves you (BK_LICH.edge), so it stays mixed and can't be read, but rarely gives you the
   matchup. On offense it runs what beats the defense on the floor, counting the scout too: a set run again is scouted,
   so it changes sets before the defense catches up (BK_LICH.stale, in the edge's terms). Its stances read the game:
   Push when its five are fresher by BK_LICH.fresh, Gamble against loose-handling guards, Sit back in foul trouble. On
   the floor its defenders have scouted your shooters: each plays a good shooter tighter and a poor one further off,
   helping inside (bkLichGap, by BK_LICH.close; 05-live.js), and reads the shot, up in time a share BK_LICH.jump more
   often (the timed jump's block and spoiled make). It calls a timeout and casts its ultimate against a run of
   BK_LICH.run, holds a power back less often (BK_LICH.hold), subs a player under BK_LICH.sub (10-bench.js) and gives
   a potion worth 2.5 (15-kit.js).
   Hexes (opts.hexes: ids in BK_HEX; G.hex = { ids, on, sq, shadows }, plain JSON, so a saved game keeps them). Each
   works against one side, G.hex.on (opts.hexOn, 0 by default: yours):
     drift   The Rim Drifts: the rim that side shoots at swings on its bracket (a slow sway through the game clock,
             BK_HEX.drift.period seconds of play a swing): its jump shots up to BK_HEX.drift.p less likely, as far as the
             rim is out, at the rim a share of that, and its misses come off wild, as off a bent rim
     shadow  The Shadow Sixth: once a quarter (and once an overtime), on that side's first possession past the middle of
             the period, a sixth defender made of shadow comes out for the one trip: BK_HEX.shadow.fx on it (shots
             harder, the contest closer, drives stopped, passes picked off)
     whistle The Crooked Whistle: fouls on that side's defenders (on shots and reaching in) BK_HEX.whistle.k as likely
     cold    Cold Hands: that side's free throws BK_HEX.cold.ft less likely, all game
   The hexes are named before the tip (in the line under the court, and HEXES on the floor), and under the score bar all
   game; the drifting rim hangs off to one side, and the Shadow Sixth stands between the ball and the basket while it is
   out. */
const BK_LICH = { n: 'Lich', see: .5, edge: 2.5, stale: .67, run: 6, sub: 50, hold: .05, fresh: 12, loose: 5.5, close: 1, jump: .3 };
// how close a Lich's defender plays man m, against the usual: by m's touch
const bkLichGap = m => clamp(1 - BK_LICH.close * (m.r.tch - 6) * .1, .6, 1.4);
const BK_HEX = {
  drift: { n: 'The Rim Drifts', d: 'The rim you shoot at swings on its bracket: your jump shots up to 8 points less likely when it is furthest out (layups a third of that), and your misses come off wild.', p: .08, rim: .35, period: 24, draw: .55 },
  shadow: { n: 'The Shadow Sixth', d: 'Once a quarter a sixth defender made of shadow comes out for one of your possessions: every shot of that trip harder, drives stopped, passes picked off.', at: .5, fx: { shot: -.08, con: 1.35, lane: .6, stl: 1.6, blk: 1.4, dreb: 1.3 } },
  whistle: { n: 'The Crooked Whistle', d: 'A shadow referee calls the game: fouls on your five called half again as often, on shots and reaching in.', k: 1.5 },
  cold: { n: 'Cold Hands', d: 'The cold gets into your fingers: your free throws 15 points less likely, all game.', ft: .15 },
};
// the Nadir captain's own ultimate (a player brings it as { ult: 'lightsout' }, 04-teams.js)
BK_ULT_BY.lightsout = bkU0('lightsout', 'Lights Out', 'The torches on the wall gutter out: every shot of theirs 7 points less likely, and their passes picked off a third more.', null, { shot: -.07, stl: 1.3 }, ['#3a2a4a', 'all']);
BK_BIG.hex = ['HEXES', '#c8b8ff'];
BK_BIG.shadow = ['THE SHADOW SIXTH', '#c8b8ff'];

/* ---------- the Lich ---------- */
// a weights table as shares
function bkLichShares(w) { let s = 0; for (const k in w) s += Math.max(0, w[k]); const o = {}; for (const k in w) o[k] = s ? Math.max(0, w[k]) / s : 0; return o; }
// what side has really run lately, as shares (the later the more it counts; {} with nothing seen)
function bkLichSeen(side) { const S = G.seen[side], o = {}; S.forEach((k, i) => { o[k] = (o[k] || 0) + i + 1; }); return S.length ? bkLichShares(o) : {}; }
// what side's offense will run against defense d, as shares: a coach by hand keeps the set it has called; a CPU coach
// leans to what beats d as its skill does; blended with what side has really run
function bkLichOffP(side, d) {
  let M;
  if (!bkCpuSide(side)) M = { [G.call[side].off]: 1 };
  else if (!G.skill[side]) M = Object.fromEntries(BK_SET_IDS.map(k => [k, 1]));
  else {
    M = bkSetLean(side);
    const sc = G.scout[side]; if (sc.last && sc.n >= 2) M[sc.last] *= .35;
    const k0 = G.skill[side] >= 2 ? .9 : .45; for (const k in M) M[k] *= 1 + k0 * bkEdge(k, d)[0];
  }
  const P = bkLichShares(M), T = bkLichSeen(side);
  if (!Object.keys(T).length) return P;
  for (const k of BK_SET_IDS) P[k] = (1 - BK_LICH.see) * (P[k] || 0) + BK_LICH.see * (T[k] || 0);
  return P;
}
function bkLichDef(side) {
  const w = bkDefLean(side);
  for (const d in w) { const P = bkLichOffP(1 - side, d); let e = 0; for (const k in P) e += P[k] * bkEdge(k, d)[0]; w[d] *= Math.exp(-BK_LICH.edge * e); }
  return wpick(w);
}
function bkLichSet(side) {
  const w = bkSetLean(side), d = G.call[1 - side].def, sc = G.scout[side];
  for (const k in w) { const stale = sc.last === k ? Math.min(2, sc.n) : 0; w[k] *= Math.exp(BK_LICH.edge * (bkEdge(k, d)[0] - stale * BK_LICH.stale)); }
  return wpick(w);
}
function bkLichStance(side) {
  const them = 1 - side, late = bkLate(.5), diff = bkLead(side), st = s => G.on[s].reduce((a, ri) => a + G.stam[s][ri], 0) / G.on[s].length;
  const fresh = G.stam ? st(side) - st(them) : 0, trouble = G.on[side].some(ri => (G.pf[side][ri] || 0) >= BK_RULES.out - 1);
  return { pace: late && diff < -4 ? 'push' : late && diff > 4 ? 'grind' : fresh >= BK_LICH.fresh ? 'push' : 'bal',
    press: late && diff < -4 ? 'gamble' : G.tf[side] > BK_RULES.limit || trouble ? 'sit' : bkMean(them, 'hnd', ['guard']) < BK_LICH.loose ? 'gamble' : 'bal' };
}

/* ---------- the hexes ---------- */
function bkHexStart(ids, on) { const hx = (ids || []).filter((k, i, a) => BK_HEX[k] && a.indexOf(k) === i); if (hx.length) G.hex = { ids: hx, on: on === 1 ? 1 : 0, sq: 0, shadows: 0 }; }
const bkHexHas = id => !!(G && G.hex && G.hex.ids.includes(id));
const bkHexOn = (id, side) => bkHexHas(id) && side === G.hex.on;
// how far out the drifting rim is now: -1 to 1, on the game seconds played
const bkHexDrift = () => Math.sin(2 * Math.PI * (G.secs || 0) / BK_HEX.drift.period);
// what a hex takes off p's shot (from rim: at the rim)
function bkHexShot(p, rim) { return bkHexOn('drift', p.side) ? Math.abs(bkHexDrift()) * BK_HEX.drift.p * (rim ? BK_HEX.drift.rim : 1) : 0; }
const bkHexWild = side => bkHexOn('drift', side);
// a foul by side's defenders, how much likelier
const bkHexFoul = side => bkHexOn('whistle', side) ? BK_HEX.whistle.k : 1;
const bkHexFt = side => bkHexOn('cold', side) ? BK_HEX.cold.ft : 0;
// the drawn rim's offset across, in metres (hoop s: 0 the left, 1 the right)
const bkHexRimOff = s => bkHexHas('drift') && s === bkHoopOf(G.hex.on) ? bkHexDrift() * BK_HEX.drift.draw : 0;
// a new possession for side: the Shadow Sixth comes out on its first past the middle of the period, once a period
function bkHexPoss(side) {
  if (!bkHexOn('shadow', side) || G.hex.sq === G.q || !G.cur) return;
  const len = G.q > BK_RULES.quarters ? BK_RULES.ot : G.qlen;
  if (G.clock > len * BK_HEX.shadow.at) return;
  G.hex.sq = G.q; G.hex.shadows++; G.cur.shadow = true; bkFxNow();
  GD.big = { k: 'shadow' }; bkEv('shadow', G.teams[1 - side].name, G.teams[side].name);
}
const bkHexNames = () => G && G.hex ? G.hex.ids.map(k => BK_HEX[k].n).join(', ') : '';
const bkHexLine = () => !G || !G.hex ? '' : 'Hexes: ' + G.hex.ids.map(k => k === 'shadow' && G.cur && G.cur.shadow ? `${BK_HEX[k].n} (out now)` : BK_HEX[k].n).join('  ·  ');
// the Shadow Sixth, while it is out: a dark figure between the ball and the basket it guards
function bkHexDraw(c) {
  if (!G.cur || !G.cur.shadow || !['live', 'walk'].includes(GD.ph)) return;
  const hx = bkHoopX(G.cur.side), B = L.ball, x = lerp(hx, B.x, .42), y = B.y * .42, s = bkScr(x, y);
  c.save(); bkZoomAt(c, s);
  c.save(); c.globalAlpha = .35 + .1 * Math.sin(BKT.t * 3); c.fillStyle = '#1a1022'; c.beginPath(); c.ellipse(s.x, s.y + 1, 18, 6, 0, 0, Math.PI * 2); c.fill(); c.restore();
  drawFig(c, 'wraith', s.x, s.y, 54, { color: '#1a1022', light: '#c8b8ff', short: 'N' }, { num: 6, flip: bkDir(G.cur.side) > 0, alpha: .55 + .1 * Math.sin(BKT.t * 2.3), lift: 2 + Math.sin(BKT.t * 2) * 2 });
  c.restore();
}
