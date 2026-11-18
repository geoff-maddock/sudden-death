/* Mossgate Links: the enchanted course (issue #92, phase 6b), a second layer of traps and fantasy on top of the wood's
   (09-wood.js). A game has it when started with { enchant: true } (the Realm's games do; the bare engine doesn't).
   Every hole's enchantments come from its seed by a stream of their own (glEnchant), so the standing nine's can be
   learned and the course's own holes are unchanged; a wild nine has new ones. After a shot (glEnchantAfter), in order:
   - The wyvern (rarely, GL_ENCH.wyvern of the shots in the air): it swoops and carries the ball off, 20 to 40 yards.
     A gorgon's ball it won't touch (it knows that stare).
   - Will-o'-wisps (two a hole, drifting a little with every stroke): a ball that comes down near one is carried off a
     few yards the way it drifts. Never a harpy's (she flies with them).
   - The troll bridge: on some holes with a stream the troll is home under the bridge, and takes a toll from the first
     ball each side carries over the water: a mana (with powers; else a little of the hitter's focus). With no mana to
     pay, the ball is batted back to the near bank (no stroke). A troll pays no toll.
   - The mimic bunker (on some holes, one of the bunkers): a ball that stops in it is swallowed (a drop at the edge and
     a stroke) or spat out somewhere near. An ogre's ball it always spits out (it tried once).
   - Fairy rings (two on some holes): a ball that stops in one is sent to the other. An elf's ball only when that helps
     (elves read them).
   - Walking trees (two a hole, moving between strokes): a ball that stops among one lies in the trees. A wraith's ball
     passes through them.
   - The creeping bog: on a hole with a moss bog, it creeps out a little more with every hole played (GL_ENCH.creep
     yards a hole); a ball that stops in its reach lies in the bog. A zombie's ball it lets go (it knows its own).
   - Webs (one a hole, at the tree line): a ball that stops in one is held: the next shot from it goes half as far. A
     spider walks out of a web.
   - The runestone (one a hole): a ball that stops beside it gives its side a mana (with powers; else focus back for
     the four). A dwarf reads it twice.
   Each gives words for the line under the bar, and the log entry says which (ev.ench). Drawn on the course (08-draw.js). */
const GL_ENCH = { wyvern: 0.01, wyvernFar: [20, 40], wisp: 7, wispCarry: [6, 12], ring: 6.5, mimicR: 8, swallow: 0.5, spit: [10, 20], ent: 7, creep: 1.5, web: 9, webK: 0.5, rune: 10, toll: 1, tollFocus: 0.15, trollHome: 0.3, bridgeNear: 30 };
const GLEN = {};
function glEnchant(H) {
  const key = H.seed + ':' + H.par; if (GLEN[key]) return GLEN[key];
  const q = engRng(H.seed ^ 0xe7c4), cand = H.line.filter(p => p.t > 50 && p.t < H.len - 35);
  const at = () => cand[(q() * cand.length) | 0] || H.line[(H.line.length / 2) | 0];
  const side = (p, off, want) => { const s = q() < 0.5 ? -1 : 1; for (let k = 0; k < 14; k++) { const x = p.x + s * (off + k * 1.5), l = glLie(H, x, p.y); if (!want || want.includes(l)) return { x, y: p.y }; } return { x: p.x + s * off, y: p.y }; };
  const cells = ch => { const out = []; for (let r = 0; r < H.h; r++) for (let c = 0; c < H.w; c++) if (H.grid[r][c] === ch) out.push({ x: (c + 0.5) * H.cell, y: (r + 0.5) * H.cell }); return out; };
  const E = {};
  // fairy rings: two, apart, on short grass or rough (about half the holes)
  if (q() < 0.55) { const a = side(at(), q() * 10, ['F', 'r']); let b = null; for (let k = 0; k < 12 && !b; k++) { const c = side(at(), q() * 10, ['F', 'r']); if (hyp(c.x - a.x, c.y - a.y) > 45) b = c; } if (b) E.rings = [a, b]; }
  // the mimic: one of the bunkers (about half the holes that have sand)
  const sand = cells('S'); if (sand.length && q() < 0.5) E.mimic = sand[(q() * sand.length) | 0];
  // the troll bridge: where the hole's line crosses the stream
  const wetLine = H.line.find((p, i) => i && glLie(H, p.x, p.y) === 'W' && H.line[i - 1] && glLie(H, H.line[i - 1].x, H.line[i - 1].y) !== 'W');
  // (the troll is home under it on some holes only)
  if (wetLine && q() < GL_ENCH.trollHome) E.bridge = { x: wetLine.x, y: wetLine.y };
  // will-o'-wisps, walking trees, a web and the runestone: on every hole
  E.wisps = [0, 1].map(() => { const p = at(); return { x: p.x + (q() - 0.5) * 20, y: p.y, ph: q() * 6 }; });
  E.ents = [0, 1].map(() => Object.assign(side(at(), 18 + q() * 8, ['r', 'R']), { ph: q() * 6 }));
  // (the web and the runestone by the drive zone, where tee shots come down; on a par 3, by the green)
  const zone = H.line.filter(p => H.par > 3 ? p.t > 200 && p.t < 270 : p.t > H.len - 50), atZ = () => zone[(q() * zone.length) | 0] || at();
  E.web = side(atZ(), 16 + q() * 6, ['R', 'r']);
  E.rune = side(atZ(), 4 + q() * 8, ['r', 'F']);
  // the creeping bog: from the middle of the hole's moss bog, as wide as it is
  const bog = cells('B'); if (bog.length) { const cx = bog.reduce((a, c) => a + c.x, 0) / bog.length, cy = bog.reduce((a, c) => a + c.y, 0) / bog.length; E.bog = { x: cx, y: cy, r: Math.sqrt(bog.length) * H.cell * 0.55 }; }
  if (Object.keys(GLEN).length > 60) for (const k in GLEN) delete GLEN[k];
  GLEN[key] = E;
  return E;
}
// where the wisps and the walking trees are now: they move a little with every stroke of the hole (k: strokes so far)
const glEnchK = () => (G && G.hole ? G.hole.st[0] + G.hole.st[1] : 0);
const glWispAt = (w, k) => ({ x: w.x + Math.sin(k * 1.3 + w.ph) * 12, y: w.y + Math.cos(k * 0.9 + w.ph) * 9 });
const glEntAt = (e, k) => ({ x: e.x + Math.sin(k * 0.8 + e.ph) * 9, y: e.y + Math.cos(k * 0.6 + e.ph) * 6 });
const glBogReach = E => E.bog ? E.bog.r + GL_ENCH.creep * (G ? G.res.length : 0) : 0;
// a dry spot about d yards from p (never water, never the green), for a ball that is carried, spat out or batted
function glDrySpot(H, p, d0, d1) {
  for (let k = 0; k < 12; k++) { const a = R() * Math.PI * 2, d = d0 + R() * (d1 - d0), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d, l = glLie(H, x, y); if (l !== 'W' && l !== 'G') return { x, y, lie: l === 'T' ? 'r' : l }; }
  return null;
}
// after a shot by side s, hitter ri: the enchantments on the ball. r: the flight or the roll. Returns words, or ''
function glEnchantAfter(s, ri, ev, r, plan) {
  if (!G.enchant || ev.holed) return '';
  const H = glHoleNow(), E = glEnchant(H), kind = (G.teams[s].roster[ri] || {}).kind, put = (x, y, lie) => { G.ball[s] = { x: +x.toFixed(2), y: +y.toFixed(2), lie }; ev.lie = lie; };
  const air = !plan.putt && r && r.path && r.path.length, out = [];
  // the wyvern, now and then, on a ball in the air
  if (air && !ev.water && kind !== 'gorgon' && R() < GL_ENCH.wyvern) {
    const p = glDrySpot(H, G.ball[s], GL_ENCH.wyvernFar[0], GL_ENCH.wyvernFar[1]);
    if (p) { put(p.x, p.y, p.lie); ev.ench = 'wyvern'; return ' A wyvern swoops out of the wood and carries the ball off!'; }
  }
  // the troll's toll on a ball that carried the stream
  // (once a side a hole: paid, the troll lets that side by for the rest of it)
  if (air && E.bridge && !ev.water && kind !== 'troll' && !(G.tolled && G.tolled[s] === G.h)) {
    const from = r.path[0], land = r.land, n = Math.ceil(hyp(land.x - from.x, land.y - from.y) / 3);
    // (over the water within GL_ENCH.bridgeNear yards of the bridge: the troll's own stretch of the stream)
    let crossed = false; for (let i = 1; i < n && !crossed; i++) { const x = from.x + (land.x - from.x) * i / n, y = from.y + (land.y - from.y) * i / n; if (glLie(H, x, y) === 'W' && hyp(x - E.bridge.x, y - E.bridge.y) < GL_ENCH.bridgeNear) crossed = true; }
    if (crossed && glLie(H, land.x, land.y) !== 'W') {
      G.tolled = G.tolled || [-1, -1]; G.tolled[s] = G.h;
      if (G.powers && G.mana && G.mana[s] >= GL_ENCH.toll) { G.mana[s] -= GL_ENCH.toll; out.push(' The troll under the bridge takes his toll: a mana.'); ev.ench = 'toll'; }
      else if (!G.powers) { if (G.focus) G.focus[s][ri] = Math.max(0, G.focus[s][ri] - GL_ENCH.tollFocus); out.push(` The troll under the bridge takes his toll from ${glName(s, ri)}.`); ev.ench = 'toll'; }
      else {
        // back to the near bank: three yards short of where the line first meets the water, on the side it was hit from
        const d = hyp(land.x - from.x, land.y - from.y), ux = (land.x - from.x) / (d || 1), uy = (land.y - from.y) / (d || 1);
        let t = 0; while (t < d && glLie(H, from.x + ux * t, from.y + uy * t) !== 'W') t += 1;
        t = Math.max(0, t - 3); const x = from.x + ux * t, y = from.y + uy * t, l = glLie(H, x, y);
        put(x, y, l === 'W' || l === 'G' ? 'r' : l === 'T' ? 'r' : l); ev.ench = 'troll'; return ' No mana for the troll: he bats the ball back to the near bank.';
      }
    }
  }
  // the wisps on a ball coming down
  if (air && !ev.water && kind !== 'harpy') {
    const k = glEnchK(), b = G.ball[s];
    for (const w of E.wisps) { const at = glWispAt(w, k); if (hyp(b.x - at.x, b.y - at.y) < GL_ENCH.wisp) {
      const a = Math.atan2(Math.cos((k + 1) * 0.9 + w.ph) * 9 - Math.cos(k * 0.9 + w.ph) * 9, Math.sin((k + 1) * 1.3 + w.ph) * 12 - Math.sin(k * 1.3 + w.ph) * 12), d = GL_ENCH.wispCarry[0] + R() * (GL_ENCH.wispCarry[1] - GL_ENCH.wispCarry[0]);
      const x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d, l = glLie(H, x, y);
      if (l !== 'W') { put(x, y, l === 'T' ? 'r' : l); out.push(' A will-o\'-wisp carries it off a little.'); ev.ench = 'wisp'; }
      break; } }
  }
  if (ev.water) return out.join('');
  const b = G.ball[s];
  // the mimic: a ball in its sand
  if (E.mimic && b.lie === 'S' && hyp(b.x - E.mimic.x, b.y - E.mimic.y) < GL_ENCH.mimicR) {
    if (kind !== 'ogre' && R() < GL_ENCH.swallow) { const D = glWaterDrop(H, r && r.path ? r.path[0] : b, b); put(D.end.x, D.end.y, D.lie === 'S' ? 'r' : D.lie); glDrop(s); ev.ench = 'mimic'; return out.join('') + ' The bunker has teeth: it swallows the ball. A drop, and a stroke.'; }
    const p = glDrySpot(H, b, GL_ENCH.spit[0], GL_ENCH.spit[1]); if (p) { put(p.x, p.y, p.lie); ev.ench = 'spat'; return out.join('') + ' The bunker has teeth, and it spits the ball out.'; }
  }
  // fairy rings
  if (E.rings) for (let i = 0; i < 2; i++) { const A = E.rings[i], B = E.rings[1 - i]; if (hyp(b.x - A.x, b.y - A.y) < GL_ENCH.ring) {
    const helps = hyp(B.x - H.pin.x, B.y - H.pin.y) < hyp(b.x - H.pin.x, b.y - H.pin.y);
    if (kind === 'elf' && !helps) { out.push(` ${glName(s, ri)} reads the fairy ring and steps out of it.`); break; }
    put(B.x, B.y, glLie(H, B.x, B.y)); ev.ench = 'ring'; return out.join('') + ' A fairy ring! The ball comes up in the other one.'; } }
  // walking trees
  if (kind !== 'wraith') { const k = glEnchK(); for (const e of E.ents) { const at = glEntAt(e, k); if (hyp(b.x - at.x, b.y - at.y) < GL_ENCH.ent) { put(b.x, b.y, 'O'); ev.ench = 'ent'; return out.join('') + ' The trees have walked: the ball is among them.'; } } }
  // the creeping bog
  if (E.bog && kind !== 'zombie' && b.lie !== 'B' && b.lie !== 'G' && hyp(b.x - E.bog.x, b.y - E.bog.y) < glBogReach(E)) { put(b.x, b.y, 'B'); ev.ench = 'bog'; return out.join('') + ' The bog has crept out this far: the ball sits in moss.'; }
  // a web
  if (kind !== 'spider' && hyp(b.x - E.web.x, b.y - E.web.y) < GL_ENCH.web) { G.webbed[s] = true; ev.ench = 'web'; return out.join('') + ' Caught in a web: the next shot goes half as far.'; }
  // the runestone
  if (hyp(b.x - E.rune.x, b.y - E.rune.y) < GL_ENCH.rune) {
    const n = kind === 'dwarf' ? 2 : 1; ev.ench = 'rune';
    if (G.powers && G.mana) { G.mana[s] = Math.min(GL_MANA.max, G.mana[s] + n); return out.join('') + ` A runestone glows: +${n} mana.`; }
    if (G.focus) G.focus[s] = G.focus[s].map(v => Math.min(1, v + 0.1 * n)); return out.join('') + ' A runestone glows: the four feel sharper.';
  }
  return out.join('');
}
