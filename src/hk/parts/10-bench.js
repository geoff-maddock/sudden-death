/* Black Ice: stamina, shifts and the bench (issue #83, phase 4). Skating is hard work. Every skater has stamina
   (G.sta, by side and roster index, 0 to 1): it runs down on the ice, faster the faster they skate, and comes back on
   the bench. A tired skater is slower, turns wider and takes longer to get going (hkStaK), and shoots a little worse.
   So a line is good for a short shift, and then needs the bench.
   The bench is the rest of the roster after the six (up to HK_RULES.bench), in order. Changes:
   - on the fly: a tired skater heads for their bench's door on the far boards and, there, the next fresh player comes
     over the boards in their spot (hkChangeStep). While they skate off their side is short around the puck, so the
     coach sends them only when their side has the puck or it is in the other half (hkCoach). By hand, one key sends
     everybody who is tired now (hkChangeNow): do it at the wrong moment and you give up a rush.
   - at a whistle: everybody tired changes at once (hkChangeWhistle), except the side that iced the puck, which may not.
   Who comes on: for a side in the order it was given (opts.ordered: yours), the first fresh player on the bench;
   otherwise the fresh player who suits the spot best. The goalie stays in all game.
   With nobody on the bench the six play on: they get a breather at each whistle and a rest between periods.
   Each time on is a shift (G.stat sh). */
const HK_STA = { drain: .011, fast: .013, bench: .05, box: .05, whistle: .06, tired: .45, fresh: .8, floor: .15, slow: .2, door: 1.4 };
// the bench doors, on the far boards either side of centre: [x, y] by side
const hkDoor = side => [HK_RULES.len / 2 + (side ? 5 : -5), -HK_RULES.wid / 2 + .7];
const hkSta = p => G.sta[p.side][p.ri];
// how much of their speed and push a skater has left: 1 fresh, down to 1 - HK_STA.slow when spent
const hkStaK = p => p.pos === 'G' && !p.pulled ? 1 : 1 - HK_STA.slow * clamp(1 - hkSta(p) / .6, 0, 1);
// side's bench: roster indices not on the ice and not in the box, in order
function hkBench(side) {
  const boxed = new Set(G.box.concat(G.wait).filter(b => b.side === side).map(b => b.ri));
  return G.teams[side].roster.map((_, i) => i).filter(i => !G.on[side].includes(i) && !boxed.has(i));
}
// who comes on for the skater at pos: the first fresh player in a side's own order, or the fresh one who fits best
function hkNextOn(side, pos) {
  const fresh = hkBench(side).filter(i => G.sta[side][i] >= HK_STA.fresh); if (!fresh.length) return -1;
  if (G.ordered[side]) return fresh[0];
  const T = G.teams[side]; return fresh.slice().sort((a, b) => hkFit(T.roster[b].r, pos) - hkFit(T.roster[a].r, pos))[0];
}
// stamina moves on dt seconds of play
function hkStaStep(dt) {
  for (const p of L.pl) {
    if (p.off || (p.pos === 'G' && !p.pulled)) continue;
    const top = 5.4 + p.r.spd * .42, k = clamp(hyp(p.vx, p.vy) / top, 0, 1);
    G.sta[p.side][p.ri] = Math.max(HK_STA.floor, hkSta(p) - (HK_STA.drain + HK_STA.fast * k) * dt);
  }
  for (const s of [0, 1]) {
    for (const i of hkBench(s)) G.sta[s][i] = Math.min(1, G.sta[s][i] + HK_STA.bench * dt);
    for (const b of G.box) if (b.side === s) G.sta[s][b.ri] = Math.min(1, G.sta[s][b.ri] + HK_STA.box * dt);
  }
}
// the swap: the player in spot p goes off and roster index inn comes on in their place, where p stands
function hkSwap(p, inn) {
  const T = G.teams[p.side], m = T.roster[inn], at = HK_POS.indexOf(p.pos);
  G.on[p.side][at] = inn;
  hkBoxAdd(p.side, inn, 'sh');
  hkEv('change', 'line', m.n);
  Object.assign(p, { ri: inn, kind: m.kind, n: m.n, num: m.num, r: Object.assign({}, m.r), chg: null, stun: 0, cd: 0 });
}
/* the coach, a few times a second: a tired skater with a fresh player waiting is sent off, when it's safe (their side
   has the puck, or it is in the other half), one or two at a time. Not a side you are changing by hand (auto off). */
function hkCoach(dt) {
  L.coachT = (L.coachT || 0) - dt; if (L.coachT > 0) return; L.coachT = .4;
  for (const s of [0, 1]) {
    if (hkHandsOn() && s === GD.you && !GD.auto) continue;
    const safe = G.poss === s || hkUp(s, L.puck.x) > HK_RULES.len / 2 + 2;
    if (!safe) continue;
    const going = hkSk(s).filter(p => p.chg).length; if (going >= 2) continue;
    const tired = hkSk(s).filter(p => p.pos !== 'G' && !p.chg && hkSta(p) < HK_STA.tired && L.pl.indexOf(p) !== hkHand()).sort((a, b) => hkSta(a) - hkSta(b));
    for (const p of tired.slice(0, 2 - going)) { const inn = hkNextOn(s, p.pos); if (inn >= 0 && !hkSk(s).some(q => q.chg && q.chg.to === inn)) p.chg = { to: inn }; }
  }
}
// by hand: everybody on your side who is tired, and has a fresh player to come on, goes now. Returns how many
function hkChangeNow(side) {
  let n = 0; const taken = new Set(hkSk(side).filter(p => p.chg).map(p => p.chg.to));
  for (const p of hkSk(side).filter(q => q.pos !== 'G' && !q.chg && hkSta(q) < .7).sort((a, b) => hkSta(a) - hkSta(b))) {
    const fresh = hkBench(side).filter(i => G.sta[side][i] >= HK_STA.fresh && !taken.has(i)); if (!fresh.length) break;
    const inn = G.ordered[side] ? fresh[0] : fresh.slice().sort((a, b) => hkFit(G.teams[side].roster[b].r, p.pos) - hkFit(G.teams[side].roster[a].r, p.pos))[0];
    p.chg = { to: inn }; taken.add(inn); n++;
  }
  return n;
}
// a skater on their way off: at the door, the swap. With the puck they keep it and stay on
function hkChangeStep() {
  for (const p of L.pl) {
    if (!p.chg || p.off) continue;
    if (L.pl.indexOf(p) === hkHand() || G.on[p.side].includes(p.chg.to) || G.sta[p.side][p.chg.to] == null) { p.chg = null; continue; }
    const [x, y] = hkDoor(p.side);
    if (hyp(p.x - x, p.y - y) < HK_STA.door) hkSwap(p, p.chg.to);
  }
}
/* a whistle: everybody tired changes at once, the freshest on (not: the side that iced the puck, which may not change).
   Everyone on the ice gets a breather. rest: a break between periods, when everyone is fresh again */
function hkChangeWhistle(not, rest) {
  for (const p of L.pl) p.chg = null;
  if (rest) { for (const s of [0, 1]) G.sta[s] = G.sta[s].map(() => 1); return; }
  for (const s of [0, 1]) {
    for (const p of hkSk(s)) G.sta[s][p.ri] = Math.min(1, hkSta(p) + HK_STA.whistle);
    if (s === not) continue;
    for (const p of hkSk(s).filter(q => q.pos !== 'G' && hkSta(q) < .7).sort((a, b) => hkSta(a) - hkSta(b))) { const inn = hkNextOn(s, p.pos); if (inn >= 0) hkSwap(p, inn); }
  }
}
