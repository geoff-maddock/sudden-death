/* The Curling Shed in the Umbral (issue #99, phase 4h): the Lich, the hexes, and a champion's own ultimate. Nothing here
   runs unless a game asks for it: with no hexes, no skill 3 and no curler's own ultimate, the engine plays exactly as
   before (same seed, same game).
   The Lich (G.skill 3, above the Archmage: CR_LICH, its own row, so CR_SKILL and the exhibition's skills stay three;
   crSk reads either). It throws no better than an Archmage (the same miss); it decides better:
   - the shot: it looks at more shots (CR_LICH.draws and guards: more spots in and in front of the house; a takeout of
     each of their stones in the house hit a little thin either way, to roll the shooter or take a second), and weighs
     its best CR_LICH.top over CR_LICH.samples throws each and against the other rink's likeliest replies
     (CR_LICH.replies, replyMix) as an Archmage does (a wider search, its best six over six, was worse: it picked lucky
     candidates; docs/realm/BALANCE.md);
   - the broom: its sweepers read the stone as it goes (crLichSweeper). Every CR_LICH.sweepEvery seconds of the stone's
     run they play it on, alone on the ice as it is now (the pebble's wear, the frost, the stone's own drag and curl),
     swept not at all, half and hard, and sweep the way that brings it nearest the call: a draw's spot, or a hit's line
     where it meets its stone (sweeping a stone straightens it, so they can hold a hit's line, which no other skip's
     sweepers do). Within CR_LICH.sweepTol inches they sweep the least, to save their legs;
   - the ice and the end: it reads the ice as it is now (as an Archmage), weighs the hammer and the game as an Archmage,
     takes a potion worth CR_KIT.take[3] and casts as an Archmage.
   Hexes (opts.hexes: ids in CR_HEX; G.hex = { ids, on }, plain JSON, so a kept game keeps them). Each works against
   one side, G.hex.on (opts.hexOn, 0 by default: yours):
     rime    Rime on the Pebble: that side's stones curl CR_HEX.rime.curl times as much as its skip reads (no read sees
             it: the aim is worked out on the ice as it lies)
     lead    Leaden Brooms: that side's sweepers spend CR_HEX.lead.legs times the legs, and do CR_HEX.lead.sweep as much
     drift   The Drifting House: a stone of that side's that comes to rest in the house slides CR_HEX.drift.in inches
             further from the button (as a gust does: not into another stone, nor off the sheet)
     hoar    Hoarfrost: the first stone of the other rink's an end to lie in the four-foot (within CR_HEX.hoar.r inches
             and a stone of it) freezes where it lies: as heavy as granite for the rest of the end, so that side's hits
             barely move it (G.hex.froze: the end it froze in; one an end)
   The hexes are named before the first stone (the status line) and under the end board all game (crHexLine); the
   Drifting House and Hoarfrost say so on the status line after the stone they act on (crHexSay).
   A curler's own ultimate (a roster curler sent with { ult: id }, an id in CR_ULT_OWN): their rink casts it in place of
   the thrower's kind's (crUltOf). The Sunken Shed's champion brings one. */
const CR_LICH = { n: 'Lich', ang: .22, hitAng: .36, v: .011, samples: 5, top: 4, hammer: true, ice: 'now', sweepLate: 0, replies: 4, replyMix: .3,
  draws: [[20, -20], [-20, -20], [0, -60], [25, 12], [-25, 12]], guards: [[0, -230], [30, -150], [-30, -150]], thin: 4,
  sweepEvery: .25, sweepTol: 1.5, levels: [0, .5, 1], dt: .1 };
CR_KIT.take[3] = 2;
const CR_HEX = {
  rime: { n: 'Rime on the Pebble', d: 'Frost on the pebble under your stones: they curl more than your skip reads.', curl: 1.3 },
  lead: { n: 'Leaden Brooms', d: 'Your sweepers tire four times as fast, and their brooms do less.', legs: 4, sweep: .6 },
  drift: { n: 'The Drifting House', d: 'The house slips away from you: a stone of yours that comes to rest in it slides 4 inches further from the button.', in: 4 },
  hoar: { n: 'Hoarfrost', d: 'The first of their stones each end to lie in the four-foot freezes where it lies: your hits barely move it.', r: 24 },
};
const CR_ULT_OWN = {
  sunkenstone: crU('sunkenstone', 'The Sunken Stone', 'The house goes under for the other rink: their stones this end drag heavy, and hardly curl.', null, { heavy: 1.03, stiff: .7 }),
};

/* ---------- the Lich ---------- */
// its extra shots (crShots's draw and hit, so they are aimed and listed as every other)
function crLichShots(s, draw, hit) {
  const L = CR_LICH;
  for (const [x, y] of L.draws) draw('draw', x, y);
  for (const [x, y] of L.guards) draw('guard', x, y);
  if (L.thin) for (const o of G.stones.filter(o => o.s !== s && crInHouse(o))) { hit('takeout', o, CR_AIM.vHit, L.thin); hit('takeout', o, CR_AIM.vHit, -L.thin); }
}
// where a stone sliding now would go, alone on the ice as it is, swept at k (asked: times the side's sweepers and their
// legs, and the stone's own sweep); how far that is from what was called (inches; more when it would leave play)
function crLichProject(s, st, k, plan, eff) {
  const L = CR_LICH, P = { x: st.x, y: st.y, vx: st.vx, vy: st.vy, h: st.h, curlK: st.curlK, drag: st.drag }, sw = clamp(k * eff, 0, 1.5);
  const hit = CR_HIT.includes(plan.shot), tg = hit && G.stones.find(b => b.id === plan.target), ty = tg ? tg.y - CR_SHEET.stoneR * 1.6 : null, tx = tg ? tg.x + (plan.roll || 0) : null;
  for (let t = 0; t < 60; t += L.dt) {
    const [ax, ay] = crAccel(P, G.ice, G.cold, sw), vx = P.vx + ax * L.dt, vy = P.vy + ay * L.dt, py = P.y, px = P.x;
    const stop = vx * P.vx + vy * P.vy <= 0 || Math.hypot(vx, vy) < CR_STONE.stop;
    P.x += (P.vx + (stop ? 0 : vx)) / 2 * L.dt; P.y += (P.vy + (stop ? 0 : vy)) / 2 * L.dt; P.vx = stop ? 0 : vx; P.vy = stop ? 0 : vy;
    if (ty != null && P.y >= ty) { const u = (ty - py) / ((P.y - py) || 1e-6); return Math.abs(px + (P.x - px) * u - tx); }
    if (!crOnSheet(P)) return 500 + Math.abs(P.y - (plan.y || 0));
    if (stop) break;
  }
  // (a hit that stops short of its stone; a draw short of the hog line)
  if (ty != null) return 200 + (ty - P.y);
  if (!crPastHog(P)) return 300 + (-CR_SHEET.hog - P.y);
  return Math.hypot(P.x - plan.x, P.y - plan.y);
}
// the Lich's sweepers for a called shot: every CR_LICH.sweepEvery seconds, the sweeping that brings the stone nearest
function crLichSweeper(s, plan) {
  const L = CR_LICH, C = { t: -1, k: 0, eff: null };
  return (st, t) => {
    if (C.t >= 0 && t < C.t + L.sweepEvery) return C.k;
    if (C.eff == null) C.eff = crFxFor(s).sweep * (crHexOn('lead', s) ? CR_HEX.lead.sweep : 1);
    const eff = crSweepEff(s) * C.eff;
    let best = 0, bv = Infinity;
    for (const k of L.levels) { const v = crLichProject(s, st, k, plan, eff); if (v < bv - L.sweepTol) { bv = v; best = k; } }
    C.t = t; C.k = best; return best;
  };
}

/* ---------- the hexes ---------- */
function crHexStart(ids, on) { const hx = (ids || []).filter((k, i, a) => CR_HEX[k] && a.indexOf(k) === i); if (hx.length) G.hex = { ids: hx, on: on === 1 ? 1 : 0 }; }
const crHexHas = id => !!(G && G.hex && G.hex.ids.includes(id));
const crHexOn = (id, s) => crHexHas(id) && G.hex.on === s;
// a hexed side's stone, before it is thrown: rime on the pebble (it curls more), leaden brooms
function crHexFx(s, fx) {
  if (crHexOn('rime', s)) fx.stiff *= CR_HEX.rime.curl;
  if (crHexOn('lead', s)) { fx.legs *= CR_HEX.lead.legs; fx.sweep *= CR_HEX.lead.sweep; }
  return fx;
}
// The Drifting House: side s's thrown stone at rest in the house slides further out (the run's own copies, before the
// rules look, as a gust). Returns the inches, or 0
function crHexDrift(s, run) {
  if (!crHexOn('drift', s) || !run.stop) return 0;
  const st = run.stones.find(b => b.id === 'new'); if (!st || !crInHouse(st)) return 0;
  const d = crDist(st), ux = d > .5 ? st.x / d : 0, uy = d > .5 ? st.y / d : 1, D = CR_HEX.drift.in, to = { x: +(st.x + ux * D).toFixed(2), y: +(st.y + uy * D).toFixed(2) };
  if (!crOnSheet(to) || run.stones.some(o => o !== st && Math.hypot(o.x - to.x, o.y - to.y) < 2 * CR_SHEET.stoneR)) return 0;
  st.x = to.x; st.y = to.y; run.stop = { x: to.x, y: to.y };
  return D;
}
// Hoarfrost: after a stone, the other rink's stone nearest the button, on it, freezes where it lies (granite, for the
// end), the first such an end. True when one froze (the stone's event carries froze: the side whose stone it is, and
// the page says so: crHexSay)
function crHexFreeze() {
  if (!crHexHas('hoar') || G.hex.froze === G.end) return;
  const o = 1 - G.hex.on, lim = CR_HEX.hoar.r + CR_SHEET.stoneR, st = G.stones.filter(b => b.s === o && !b.g && crDist(b) <= lim).sort((a, b) => crDist(a) - crDist(b))[0];
  if (st) { st.g = 1; G.hex.froze = G.end; return true; }
  return false;
}
// what a hex did on a stone, for the page's line after it (the Drifting House and Hoarfrost), or ''
function crHexSay(ev) {
  if (!G || !G.hex || !ev) return '';
  let say = '';
  if (ev.drift) say += ` The house drifts: the stone slides ${ev.drift} inches further out.`;
  if (ev.froze != null) say += ` Hoarfrost: ${G.teams[ev.froze].name}'s stone in the four-foot freezes where it lies, as heavy as granite for the rest of the end.`;
  return say;
}
const crHexNames = () => G && G.hex ? G.hex.ids.map(k => CR_HEX[k].n).join(', ') : '';
const crHexLine = () => G && G.hex ? `Hexes on ${G.teams[G.hex.on].short || G.teams[G.hex.on].name}: ${crHexNames()}` : '';

/* ---------- a curler's own ultimate ---------- */
// the ultimate side s's rink would cast: a curler's own (any of the four who brings one), else the thrower's kind's
function crUltOf(s, ri) {
  const T = G.teams[s], own = T.roster.find(m => m && m.ult && CR_ULT_OWN[m.ult]);
  if (own) return CR_ULT_OWN[own.ult];
  const m = T.roster[ri == null ? crThrower(s) : ri];
  return CR_ULT[m && m.kind] || CR_ULT.goblin;
}
