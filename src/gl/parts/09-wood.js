/* Mossgate Links: the wood's own ways (issue #92, phase 5). Only Mossgate Links has these; a game has them when it is
   started with { wood: true } (the Realm's games do; the bare engine and its tests don't), and its weather when it is
   given one ({ weather }).
   - The weather of the wood (GL_WEATHER, G.weather): a still morning (barely a breath), a breeze (the wind up), a
     drizzle (soft greens: the ball sits down where it lands and putts run slower, glWetK), or a spore haze (the read
     line is half as long, and the CPU reads greens worse).
   - The bees (glWood: a hive in the rough by every fairway): a ball that stops within GL_WOOD.bees yards of the hive
     comes back with a sting, and its hitter loses GL_WOOD.sting focus.
   - The Gloomcap (on a stump by some holes): it never moves, so of course it moved your ball: one that stops within
     GL_WOOD.cap yards of the stump is nudged a few yards, never into the water.
   - The gallery: a hush on the tee, polite applause for a ball close to the pin, a roar for a long putt or a chip that
     drops (glGallery: words for the line under the bar; the roar's meter comes with the powers).
   The hive and the stump come from the hole's seed by a stream of their own, so the course's own holes are unchanged. */
const GL_WEATHER = {
  still: { n: 'A still morning', wind: [0, 3] }, breeze: { n: 'A breeze', wind: [6, 16] },
  drizzle: { n: 'A drizzle: the greens are soft', wind: [0, 8], wet: 1.25 }, haze: { n: 'A spore haze: the reads are short', wind: [0, 6], haze: 0.5 },
};
const GL_WOOD = { bees: 14, sting: 0.2, cap: 12, nudge: [3, 6] };
const GLWD = {};
// the hole's hive and stump (stump: about half the holes), from the hole's seed
function glWood(H) {
  const key = H.seed + ':' + H.par; if (GLWD[key]) return GLWD[key];
  const q = engRng(H.seed ^ 0xbee5), cand = H.line.filter(p => p.t > 60 && p.t < H.len - 40);
  const spot = (off0, off1) => { const p = cand[(q() * cand.length) | 0] || H.line[(H.line.length / 2) | 0], s = q() < 0.5 ? -1 : 1, o = off0 + q() * (off1 - off0);
    for (let k = 0; k < 12; k++) { const x = p.x + s * (o + k), l = glLie(H, x, p.y); if (l === 'r' || l === 'R') return { x, y: p.y }; } return { x: p.x + s * o, y: p.y }; };
  const W = { bees: spot(15, 22), cap: q() < 0.5 ? spot(12, 18) : null };
  if (Object.keys(GLWD).length > 60) for (const k in GLWD) delete GLWD[k];
  GLWD[key] = W;
  return W;
}
// the greens' friction now (1 dry; a drizzle makes them soft)
const glWetK = () => (G && G.weather && GL_WEATHER[G.weather] && GL_WEATHER[G.weather].wet) || 1;
// the read line's share in the haze
const glHazeK = () => (G && G.weather && GL_WEATHER[G.weather] && GL_WEATHER[G.weather].haze) || 1;
// after a shot: the bees and the Gloomcap, on a ball that has stopped (not holed, not in the water). Returns words, or ''
function glWoodAfter(s, ri, ev) {
  if (!G.wood || ev.holed || ev.water) return '';
  const H = glHoleNow(), W = glWood(H), b = G.ball[s];
  if (hyp(b.x - W.bees.x, b.y - W.bees.y) < GL_WOOD.bees) {
    if (G.focus) G.focus[s][ri] = Math.max(0, G.focus[s][ri] - GL_WOOD.sting);
    ev.bees = true; return ` It stops by the bees, and ${glName(s, ri)} comes back with a sting.`;
  }
  if (W.cap && hyp(b.x - W.cap.x, b.y - W.cap.y) < GL_WOOD.cap) {
    for (let k = 0; k < 8; k++) {
      const a = R() * Math.PI * 2, d = GL_WOOD.nudge[0] + R() * (GL_WOOD.nudge[1] - GL_WOOD.nudge[0]), x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d, l = glLie(H, x, y);
      if (l !== 'W' && l !== 'G') { G.ball[s] = { x: +x.toFixed(2), y: +y.toFixed(2), lie: l === 'T' ? 'r' : l }; ev.cap = true; ev.lie = G.ball[s].lie; return ' The Gloomcap on the stump never moves. Your ball did.'; }
    }
  }
  return '';
}
// the gallery's words for a shot (on show only)
function glGallery(ev) {
  if (!ev || ev.k !== 'shot') return '';
  if (ev.holed && (ev.club !== 'pt' || ev.d0 >= 5)) return ' A roar from the gallery!';
  if (ev.holed) return ' Applause.';
  if (ev.lie0 === 'T' && ev.lie === 'F') return ' A murmur from the tee.';
  if (ev.lie === 'G' && ev.d1 <= 3 && ev.club !== 'pt') return ' Polite applause from the gallery.';
  return '';
}
