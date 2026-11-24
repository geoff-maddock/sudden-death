/* The Curling Shed: the frozen deep (issue #108). Old Grey, a great pike, lives under the Shed's ice. A game started with
   { deep: true } has him (the Realm's wild club matches, about one in three: w139-sheddeep.js); the bare engine, its
   tests and the labs don't, unless asked. A game without him draws nothing from the random stream for him, so it is the
   same game as before.
   - He lies in the far end, in CR_DEEP.box (inside the boards, from just past the far hog line to just short of the
     back line), at (G.deep.x, G.deep.y). The ice over him is thin and keen: within CR_DEEP.reach inches a stone slides
     further (crDeepMu, in crIceAt) and curls less (crDeepCurl, in crAccel), most where he lies.
   - After every stone the rules take, he swims to his next spot (nx, ny: always known, and drawn as a ring), and picks
     the one after (crDeepSwim: a heading that turns a little each swim and turns back off the box's edges). Before the
     rules score the stones, every stone at rest within CR_DEEP.bumpR of that next spot is pushed straight away from it,
     more the nearer it lies (crDeepBump); a push that would put it off the sheet, back over the hog line or into
     another stone tries half the distance, then leaves it be.
   - The CPU reads him by skill (CR_DEEP_SEE, set round the skip's call by crDeepSight): a Squire not at all, a Knight
     the keen ice, an Archmage and the Lich the bumps too (its trial runs bump the stones as he will; its look at the
     other rink's reply doesn't bump them again: crDeepNoBump). A Granite Stone at rest he leaves be. The real stone
     always meets him, and so do your own guide and your captain's sweepers.
   G.deep = { x, y, nx, ny, hd, bumps, swings } (bumps: stones he has pushed; swings: pushes that changed the end's
   score as the stones lay), or null. Plain JSON, so a match kept between stones keeps him. G.deepSaid is Hennock's
   line at the start, for the page. */
const CR_DEEP = { reach: 30, keen: .1, curlCut: .4, bumpR: 20, bump: 6, minBump: 1.5, step: 40, turn: .9,
  box: { x: CR_SHEET.halfW - 24, y0: -CR_SHEET.hog + 24, y1: CR_SHEET.back - 12 },
  say: 'Old Grey\'s under the ice today: the ice runs keen over him, and he bumps whatever lies where he swims next.' };
// how much of him the skip planning a stone sees: 2 everything (the real stone, the page), 1 the keen ice, 0 nothing
let CR_DEEP_SEE = 2;
const crDeepSeeOf = s => { const sk = ((G && G.skill) || [])[s] ?? 1; return sk >= 2 ? 2 : sk === 1 ? 1 : 0; };
function crDeepSight(s, fn) { const k = CR_DEEP_SEE; CR_DEEP_SEE = crDeepSeeOf(s); try { return fn(); } finally { CR_DEEP_SEE = k; } }
// (an Archmage's look at the other rink's reply plays on stones its own trial has already bumped at his next spot, and by
// then he has swum there and his spot after is unknown: the reply's trials read the keen ice, not a second bump)
function crDeepNoBump(fn) { const k = CR_DEEP_SEE; CR_DEEP_SEE = Math.min(k, 1); try { return fn(); } finally { CR_DEEP_SEE = k; } }
const crR2 = v => +v.toFixed(2);
// his next spot from where he is: the heading turns a little, and turns back off the box's edges
function crDeepNext(d) {
  const B = CR_DEEP.box, S = CR_DEEP.step;
  d.hd += (R() - .5) * 2 * CR_DEEP.turn;
  if (Math.abs(d.x + Math.cos(d.hd) * S) > B.x) d.hd = Math.PI - d.hd;
  const y = d.y + Math.sin(d.hd) * S; if (y < B.y0 || y > B.y1) d.hd = -d.hd;
  d.hd = crR2(((d.hd % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
  d.nx = crR2(clamp(d.x + Math.cos(d.hd) * S, -B.x, B.x)); d.ny = crR2(clamp(d.y + Math.sin(d.hd) * S, B.y0, B.y1));
}
function crDeepStart(o) {
  G.deep = null; G.deepSaid = '';
  if (!o || !o.deep) return;
  const B = CR_DEEP.box, d = { x: crR2((R() * 2 - 1) * B.x), y: crR2(B.y0 + R() * (B.y1 - B.y0)), nx: 0, ny: 0, hd: R() * 2 * Math.PI, bumps: 0, swings: 0 };
  crDeepNext(d); G.deep = d; G.deepSaid = CR_DEEP.say;
}
// the keen ice over him at (x, y): friction times this (1 off his reach, or when he isn't seen)
const crDeepNear = (x, y, cut) => { const d = G && G.deep; if (!d || CR_DEEP_SEE < 1) return 1; const r = Math.hypot(x - d.x, y - d.y) / CR_DEEP.reach; return r >= 1 ? 1 : 1 - cut * (1 - r * r); };
const crDeepMu = (x, y) => crDeepNear(x, y, CR_DEEP.keen);
const crDeepCurl = (x, y) => crDeepNear(x, y, CR_DEEP.curlCut);
// the stones at rest near his next spot pushed away from it (mutates stones): [{ id, s, d }]
function crDeepBump(stones) {
  const D = CR_DEEP, d = G && G.deep, R2 = 2 * CR_SHEET.stoneR, out = []; if (!d) return out;
  for (const st of stones) {
    // (a Granite Stone at rest won't be moved: 13-powers.js)
    const dist = Math.hypot(st.x - d.nx, st.y - d.ny); if (dist >= D.bumpR || st.g) continue;
    const ux = dist > 1e-6 ? (st.x - d.nx) / dist : Math.cos(d.hd), uy = dist > 1e-6 ? (st.y - d.ny) / dist : Math.sin(d.hd), amt = Math.max(D.minBump, D.bump * (1 - dist / D.bumpR));
    for (const k of [amt, amt / 2]) {
      const m = { x: crR2(st.x + ux * k), y: crR2(st.y + uy * k) };
      if (!crOnSheet(m) || (crPastHog(st) && !crPastHog(m)) || stones.some(o => o !== st && Math.hypot(o.x - m.x, o.y - m.y) < R2)) continue;
      st.x = m.x; st.y = m.y; out.push({ id: st.id, s: st.s, d: +k.toFixed(1) }); break;
    }
  }
  return out;
}
// after a stone the rules took: he swims to his next spot, and picks the one after
function crDeepSwim() { const d = G && G.deep; if (!d) return; d.x = d.nx; d.y = d.ny; crDeepNext(d); }
// what the status line says of a bump
function crDeepSay(bumps) {
  if (!bumps.length) return '';
  if (bumps.length > 1) return `Old Grey turns under the ice and nudges ${bumps.length} stones.`;
  const b = bumps[0], T = G.teams[b.s] || {};
  return `Old Grey turns under the ice and nudges ${T.name || 'a'}'s stone ${Math.max(1, Math.round(b.d))} inch${Math.round(b.d) === 1 ? '' : 'es'}.`;
}
