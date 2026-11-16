/* Black Ice: the Pond Rink itself (issue #83, phase 6). Only in games at the Pond Rink (opts.pond: G.pond):
   - Pond ice. It is a real pond: snow and skate cuts build up through a period in a few patches (HK_POND.snow), and a
     puck sliding through one slows more the deeper it is. Old Tove scrapes it at each break, and it starts again.
     In falling snow (opts.snow) it builds HK_POND.snowing times as fast.
   - The old boards ("older than the abbey"): HK_POND.boards stretches of them a game, each either dead (a puck drops
     off them) or lively (it comes off harder than it should).
   - The ice groans: a big enough hit by the boards cracks a patch there. Skaters crossing it are slowed and a puck
     crossing it skips off line, until the break.
   - The bank. There are no stands, only a snowbank with the town on it. A run of shots on goal with no answer, a big
     hit or a goal brings a roar for that side (never over one already going): for HK_POND.roar.secs seconds of play
     its skaters tire slower and its shots are a little better (phase 7 turns the roar into a meter).
   G.pond: { snow: [{ x, y, r, d (0 to 1) }], boards: [{ wall: 'top' | 'bot', x, w, e }], crack: null | { x, y, r },
   roar: null | { side, t }, run: { side, n } } */
const HK_POND = { snow: 4, snowR: [2, 3.4], build: .8, snowing: 2.2, drag: 2.2, boards: 3, boardW: [3, 5], dead: .15, lively: .95,
  crack: 4.2, crackR: 1.6, slow: .7, skip: .5, wall: 2.2, roar: { run: 3, secs: 7, q: .015, tire: .75 } };
function hkPondStart(on, snowing) {
  if (!on) { G.pond = null; return; }
  const snow = [], boards = [];
  for (let i = 0; i < HK_POND.snow; i++) snow.push({ x: 5 + R() * (HK_RULES.len - 10), y: (R() - .5) * (HK_RULES.wid - 5), r: lerp(HK_POND.snowR[0], HK_POND.snowR[1], R()), d: 0 });
  for (let i = 0; i < HK_POND.boards; i++) boards.push({ wall: R() < .5 ? 'top' : 'bot', x: 6 + R() * (HK_RULES.len - 12), w: lerp(HK_POND.boardW[0], HK_POND.boardW[1], R()), e: i % 2 ? HK_POND.lively : HK_POND.dead });
  G.pond = { snow, boards, crack: null, roar: null, run: { side: -1, n: 0 }, snowing: !!snowing };
}
// play goes on dt seconds: the snow builds, and a roar runs down
function hkPondStep(dt) {
  const D = G.pond; if (!D) return;
  const k = HK_POND.build * (D.snowing ? HK_POND.snowing : 1) * dt / G.plen;
  for (const s of D.snow) s.d = Math.min(1, s.d + k);
  if (D.roar && (D.roar.t -= dt) <= 0) D.roar = null;
}
// a break between periods: Old Tove scrapes the ice, and the crack is flooded over
function hkPondBreak() { const D = G.pond; if (!D) return; for (const s of D.snow) s.d = 0; D.crack = null; }
// how much more a puck at (x, y) slows: 1 on clean ice, up to 1 + HK_POND.drag in the deepest snow
function hkPondDrag(x, y) {
  const D = G && G.pond; if (!D) return 1;
  let d = 0; for (const s of D.snow) if (hyp(x - s.x, y - s.y) < s.r) d = Math.max(d, s.d);
  return 1 + HK_POND.drag * d;
}
// how a puck comes off the boards at (x, y): the usual bounce, or an old stretch's
function hkPondBounce(x, y, e) {
  const D = G && G.pond; if (!D) return e;
  const wall = y < -HK_RULES.wid / 2 + 1 ? 'top' : y > HK_RULES.wid / 2 - 1 ? 'bot' : '';
  if (!wall) return e;
  const b = D.boards.find(q => q.wall === wall && Math.abs(x - q.x) < q.w / 2);
  return b ? b.e : e;
}
const hkOnCrack = (x, y) => { const C = G && G.pond && G.pond.crack; return !!C && hyp(x - C.x, y - C.y) < C.r; };
// a puck crossing the crack skips off line (once each time it gets to it)
function hkPondPuck(P) {
  const on = hkOnCrack(P.x, P.y);
  if (on && !P.onCrack && P.k !== 'shot') { const v = hyp(P.vx, P.vy), a = Math.atan2(P.vy, P.vx) + (R() - .5) * HK_POND.skip * 2; P.vx = Math.cos(a) * v * .85; P.vy = Math.sin(a) * v * .85; hkEv('skip'); }
  P.onCrack = on;
}
// a hit (05-live.js): a big one by the boards cracks the ice there, and brings a roar
function hkPondHit(d, c, closing) {
  const D = G.pond; if (!D) return;
  const wall = Math.abs(c.y) > HK_RULES.wid / 2 - HK_POND.wall || c.x < HK_POND.wall || c.x > HK_RULES.len - HK_POND.wall;
  if (wall && closing >= HK_POND.crack && !D.crack) { D.crack = { x: c.x, y: c.y, r: HK_POND.crackR }; hkEv('crack', d.n); GD.msg = `${d.n} flattens ${c.n}, and the ice groans and cracks under them.`; }
  if (closing >= HK_POND.crack) hkRoar(d.side);
}
// a shot on goal by side: three with no answer is a run, and a roar. A goal always is
function hkPondShot(side, goal) {
  const D = G.pond; if (!D) return;
  if (D.run.side === side) D.run.n++; else D.run = { side, n: 1 };
  if (goal || D.run.n >= HK_POND.roar.run) { hkRoar(side); D.run.n = 0; }
}
function hkRoar(side) { const D = G.pond; if (!D || D.roar) return; D.roar = { side, t: HK_POND.roar.secs }; hkEv('roar', G.teams[side].name); hkSpiritEv(side, 'roar'); }
const hkRoaring = side => !!(G && G.pond && G.pond.roar && G.pond.roar.side === side);
