/* Mossgate Links: what's on the course, in plain words (the hole inspector). Point at anything on the course and the
   page says what it is and what it does to a ball: the ground (water, sand, rough, bog, trees), the enchantments
   (11-enchant.js: fairy rings, the mimic bunker, the troll's bridge, wisps, walking trees, the web, the runestone, the
   creeping bog) and the wood's ways (09-wood.js: the bees, the Gloomcap), each with the kind of player it spares. The
   reach of each is the same number its effect uses, so what it says is what happens.
   glLookAt(x, y): what is at that point of the hole now, [{ k, n, t, good }] (good: true a help, false a trouble, null
   either). glHoleGuide(): everything on this hole, the same shape, once each (for a list: a phone has no pointer).
   Reads G only; changes nothing. */
const GL_LOOK = {
  W: { n: 'Water', t: 'A ball that lands in it costs a stroke, and is dropped at the edge.', good: false },
  S: { n: 'Sand', t: 'Shots out of it go shorter and less straight, and a ball that lands in it stops dead.', good: false },
  B: { n: 'Moss bog', t: 'Shots out of it go about half as far.', good: false },
  R: { n: 'Deep rough', t: 'Shots from it go about two thirds as far and spray more; no driver or wood.', good: false },
  r: { n: 'Rough', t: 'Shots from it go a little shorter and spray a little more.', good: false },
  O: { n: 'Trees', t: 'A ball in the trees usually has to be punched out low.', good: false },
  F: { n: 'Fairway', t: 'A clean lie: every club but the driver.', good: true },
  G: { n: 'The green', t: 'Putt from here. The grain arrows show which way it slopes.', good: true },
  T: { n: 'The tee', t: 'Where each hole starts.', good: null },
  rings: { n: 'Fairy ring', t: 'A ball that stops in one is sent to the other ring. Good or bad, depending on where the other one is.', good: null, spare: 'elf', sp: 'an elf\'s ball only goes when that helps' },
  mimic: { n: 'Mimic bunker', t: 'This sand has teeth: a ball that stops in it may be swallowed (a drop and a stroke) or spat out nearby.', good: false, spare: 'ogre', sp: 'it always spits out an ogre\'s ball' },
  bridge: { n: 'The troll\'s bridge', t: 'The troll is home. The first ball each side hits over this water pays a toll: a mana (or a little focus). With nothing to pay, the ball is batted back to the near bank.', good: false, spare: 'troll', sp: 'a troll pays nothing' },
  wisp: { n: 'Will-o\'-wisp', t: 'A ball that comes down near it is carried a few yards the way it drifts. Wisps move a little after every shot.', good: null, spare: 'harpy', sp: 'never a harpy\'s ball' },
  ent: { n: 'Walking tree', t: 'A ball that stops near it lies in the trees. Walking trees move between shots.', good: false, spare: 'wraith', sp: 'a wraith\'s ball passes through' },
  web: { n: 'Web', t: 'A ball that stops in it is held: the next shot from there goes half as far.', good: false, spare: 'spider', sp: 'a spider walks straight out' },
  rune: { n: 'Runestone', t: 'A ball that stops beside it earns your side a mana (or focus back for your four).', good: true, spare: 'dwarf', sp: 'a dwarf earns two' },
  bog: { n: 'The creeping bog', t: 'It spreads a little further every hole. A ball that stops in its reach lies in the bog.', good: false, spare: 'zombie', sp: 'it lets a zombie\'s ball go' },
  bees: { n: 'Beehive', t: 'A ball that stops near it comes back with a sting: that player loses some focus.', good: false },
  cap: { n: 'The Gloomcap', t: 'It never moves, so of course it moved your ball: one that stops near this stump is nudged a few yards.', good: null },
  wyvern: { n: 'The wyvern', t: 'Now and then it swoops on a ball in the air and carries it off 20 to 40 yards.', good: false, spare: 'gorgon', sp: 'never a gorgon\'s ball' },
};
// one entry: its words, and who on your side it spares
function glLookItem(k) {
  const L = GL_LOOK[k]; let t = L.t;
  if (L.spare) {
    t += ` (${L.sp[0].toUpperCase()}${L.sp.slice(1)}.`;
    const you = GD ? GD.you : 0, m = G && G.teams ? G.teams[you].roster.find(p => p.kind === L.spare) : null;
    t += m ? ` ${m.n} is one of yours.)` : ')';
  }
  return { k, n: L.n, t, good: L.good };
}
// the things on this hole and where they reach now: [{ k, x, y, r }]
function glLookSpots() {
  if (!G || !G.teams) return [];
  const H = glHoleNow(), out = [];
  if (G.enchant) {
    const E = glEnchant(H), k = glEnchK();
    if (E.rings) for (const p of E.rings) out.push({ k: 'rings', x: p.x, y: p.y, r: GL_ENCH.ring });
    if (E.mimic) out.push({ k: 'mimic', x: E.mimic.x, y: E.mimic.y, r: GL_ENCH.mimicR });
    if (E.bridge) out.push({ k: 'bridge', x: E.bridge.x, y: E.bridge.y, r: 10 });
    for (const w of E.wisps || []) { const p = glWispAt(w, k); out.push({ k: 'wisp', x: p.x, y: p.y, r: GL_ENCH.wisp }); }
    for (const e of E.ents || []) { const p = glEntAt(e, k); out.push({ k: 'ent', x: p.x, y: p.y, r: GL_ENCH.ent }); }
    if (E.web) out.push({ k: 'web', x: E.web.x, y: E.web.y, r: GL_ENCH.web });
    if (E.rune) out.push({ k: 'rune', x: E.rune.x, y: E.rune.y, r: GL_ENCH.rune });
    if (E.bog) out.push({ k: 'bog', x: E.bog.x, y: E.bog.y, r: glBogReach(E) });
  }
  if (G.wood) {
    const W = glWood(H);
    out.push({ k: 'bees', x: W.bees.x, y: W.bees.y, r: GL_WOOD.bees });
    if (W.cap) out.push({ k: 'cap', x: W.cap.x, y: W.cap.y, r: GL_WOOD.cap });
  }
  return out;
}
// what is at (x, y): the things whose reach it is in, nearest first, then the ground under it
function glLookAt(x, y) {
  if (!G || !G.teams || !Number.isFinite(x) || !Number.isFinite(y)) return [];
  const H = glHoleNow(), seen = new Set(), out = [];
  const near = glLookSpots().map(s => Object.assign(s, { d: hyp(x - s.x, y - s.y) })).filter(s => s.d <= s.r).sort((a, b) => a.d - b.d);
  for (const s of near) if (!seen.has(s.k)) { seen.add(s.k); out.push(glLookItem(s.k)); }
  const lie = glLie(H, x, y);
  if (GL_LOOK[lie] && !(lie === 'S' && seen.has('mimic')) && !(lie === 'B' && seen.has('bog'))) out.push(glLookItem(lie));
  return out;
}
// everything on this hole, once each: the hazards in its ground, then its enchantments and the wood's ways
function glHoleGuide() {
  if (!G || !G.teams) return [];
  const H = glHoleNow(), out = [], has = ch => H.grid.some(row => row.includes(ch));
  for (const ch of ['W', 'S', 'B', 'O']) if (has(ch)) out.push(glLookItem(ch));
  const seen = new Set();
  for (const s of glLookSpots()) if (!seen.has(s.k)) { seen.add(s.k); out.push(glLookItem(s.k)); }
  if (G.enchant) out.push(glLookItem('wyvern'));
  return out;
}
