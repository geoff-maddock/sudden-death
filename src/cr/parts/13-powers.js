/* The Curling Shed: monster powers (issue #102, phase 6), as on the Lanes, for a game of stones. A game has them when
   started with { powers: true } (the Realm's games do; the bare engine, its tests and the labs don't, unless asked;
   powers: [yours, theirs] gives one side only).
   - Team mana (G.mana, by side): CR_MANA.start to begin, up to CR_MANA.max. A shot made fills it, and an end scored
     (more for two or more, and a steal). A power costs CR_MANA.pow, a curse CR_MANA.curse.
   - Everyday powers: every kind has a draw power (for a draw, a guard or a freeze) and a hit power (for a takeout, a
     peel or a hit and roll), and a second of each (CR_POW, CR_POW2); a curler brings one of each pair (m.pw: { draw,
     hit }, 0 or 1; picked on the Shed tab). The thrower casts theirs before their stone, for mana, on the shot called;
     it works on that stone. A curse works on the other rink's next stone instead. One everyday power a stone. A Drain
     works at once.
   - The roar (G.roar, by side, 0 to CR_ROAR.max): the gallery fills it on a shot made, more on a double takeout, a two
     or more, a big end and most on a steal. It pays for the ultimate (CR_ROAR.ult), or steadies the skip's stone in the
     last end (CR_ROAR.steady: no pressure on it).
   - The ultimate: one per kind (CR_ULT), once a game per side, for the roar, cast at the start of an end (before
     either rink's second stone). It marks the end (G.mark): one set of effects on its side's stones (own), another on
     the other rink's (rival), until the end is scored.
   - Situation powers (CR_SIT), the team's, once a game each, for mana, when the moment fits: the Hammer (the end's last
     stone, with the hammer: a third truer), the Steal (the last stone of yours in an end without the hammer, lying
     shot: a third truer) and the Extra End (in an extra end: the stone's miss halved).
   - Who casts (crCpuPower): the CPU by its skill (a Squire now and then at random; a Knight on the stones that matter,
     keeping a mana back; an Archmage when it is behind, late, or the moment is big, saving the roar for the
     ultimate); your side the same way under Auto powers in Manage, or what you press.
   Effects (CR_FX0): err (the release's miss, line and weight), line (the line's alone), wt (the weight's alone), sweep
   (how much the sweepers do) and legs (what sweeping costs their legs) multiply; heavy (a curse: the stone drags, and
   comes up short) and stiff (a curse: the stone hardly curls) multiply the thrown stone's friction and curl; granite
   (once at rest, the stone is three times as heavy: a hit barely moves it, for the rest of the end), ghost (the stone
   slides through the first guard it meets, like smoke), gust (as the stone comes to rest, the other rink's stone
   nearest the button is pushed back this many inches) and nerve (no pressure) are the rest. The thrower's aim knows
   none of them: a power makes the stone truer, or the sweepers stronger, never a different shot. */
const CR_MANA = { start: 2, max: 6, made: 1, end: 1, two: 1, steal: 1, pow: 2, curse: 2 };
const CR_ROAR = { max: 100, ult: 60, steady: 25, made: 5, double: 15, two: 15, big: 30, steal: 25 };
const CR_FX0 = { err: 1, line: 1, wt: 1, sweep: 1, legs: 1, heavy: 1, stiff: 1, granite: 0, ghost: 0, gust: 0, nerve: 0 };
const CR_FX_MUL = new Set(['err', 'line', 'wt', 'sweep', 'legs', 'heavy', 'stiff']);
// granite's weight against an ordinary stone
const CR_GRANITE = 3;
const crP = (id, n, desc, fx, curse, now) => ({ id, n, desc, fx: fx || null, curse: curse || null, now: now || null });
// everyday powers by kind: [draw, hit]
const CR_POW = {
  goblin: [crP('slyslide', 'Sly Slide', 'A sly release: the miss a fifth smaller.', { err: .8 }), crP('sneakhit', 'Sneaky Hit', 'Down the line unseen: the line\'s miss a fifth smaller.', { line: .8 })],
  kobold: [crP('emberstone', 'Ember Stone', 'A warm stone: the sweepers do a fifth more on it.', { sweep: 1.2 }), crP('fireline', 'Fire Line', 'The heat shows the line: its miss a quarter smaller.', { line: .75 })],
  werewolf: [crP('packsweep', 'Pack Sweep', 'The pack sweeps it: a quarter more from the brooms.', { sweep: 1.25 }), crP('moonhit', 'Moon Hit', 'Thrown by moonlight: the weight\'s miss nearly a third smaller.', { wt: .7 })],
  dwarf: [crP('forgeddraw', 'Forged Draw', 'Hammered true: the weight\'s miss nearly a third smaller.', { wt: .7 }), crP('stoneread', 'Stone Read', 'Reads the ice like rock: the line\'s miss nearly a third smaller.', { line: .7 })],
  ogre: [crP('thumpdraw', 'Thump Draw', 'Set down dead: the miss a little smaller.', { err: .85 }), crP('smash', 'Smash', 'All of it: the weight\'s miss nearly a third smaller, the line a little.', { wt: .7, line: .9 })],
  minotaur: [crP('labline', 'Labyrinth Line', 'Knows the way in: the line\'s miss a fifth smaller.', { line: .8 }), crP('hornhit', 'Horned Hit', 'Head down at it: the miss a quarter smaller.', { err: .75 })],
  troll: [crP('mossystone', 'Mossy Stone', 'Moss on the handle: the sweepers don\'t tire on it.', { legs: 0 }), crP('boulder', 'Boulder', 'A troll\'s stone: once at rest, a hit barely moves it.', { granite: 1 })],
  golem: [crP('granitestone', 'Granite Stone', 'Once at rest it won\'t be moved: three times as heavy, for the end.', { granite: 1 }), crP('monohit', 'Monolith Hit', 'Unmoving hands: the miss a quarter smaller.', { err: .75 })],
  harpy: [crP('gust', 'Gust', 'A gust as it settles: the other rink\'s stone nearest the button is pushed back 8 inches.', { gust: 8 }), crP('talon', 'Talon', 'Plucked and placed: the line\'s miss nearly a third smaller.', { line: .7 })],
  elf: [crP('elveneye', 'Elven Eye', 'Sees every pebble: the miss nearly a third smaller.', { err: .7 }), crP('arrowline', 'Arrow Line', 'Like an arrow: the line\'s miss much smaller.', { line: .65 })],
  wraith: [crP('smokestone', 'Smoke Stone', 'It slides through the first guard it meets like smoke.', { ghost: 1 }), crP('coldhand', 'Cold Hand', 'Nothing to lose: no pressure on it, and truer.', { nerve: 1, err: .85 })],
  vampire: [crP('drain', 'Drain', 'Drinks the other rink\'s gallery: 20 of their roar, now.', null, null, { drain: 20 }), crP('bloodread', 'Blood Read', 'Smells the line: its miss a quarter smaller.', { line: .75 })],
  lich: [crP('deadcalm', 'Dead Calm', 'No pressure on it, and truer.', { nerve: 1, err: .85 }), crP('graveline', 'Grave Line', 'Cold and certain: the line\'s miss a quarter smaller.', { line: .75 })],
  zombie: [crP('shamble', 'Shamble', 'Slow and sure: the weight\'s miss a fifth smaller.', { wt: .8 }), crP('rothit', 'Rot Hit', 'It doesn\'t flinch: the miss a fifth smaller.', { err: .8 })],
  gorgon: [crP('serpentline', 'Serpent Line', 'Snakes round the guard: the line\'s miss a fifth smaller.', { line: .8 }), crP('stare', 'Stare', 'A curse: the other rink\'s next stone turns stiff, and hardly curls.', null, { stiff: .6 })],
  spider: [crP('eightlegs', 'Eight-Leg Sweep', 'Eight legs on the brooms: the sweepers do nearly a third more.', { sweep: 1.3 }), crP('silkline', 'Silk Line', 'On a thread: the line\'s miss a fifth smaller.', { line: .8 })],
  skeleton: [crP('bonedry', 'Bone Dry', 'A dry, true stone: the miss a fifth smaller.', { err: .8 }), crP('rattle', 'Rattle', 'The house rattles as it settles: their stone nearest the button is pushed back 6 inches.', { gust: 6 })],
  witch: [crP('broomstick', 'Broomstick', 'A witch\'s broom: the sweepers do a fifth more.', { sweep: 1.2 }), crP('frosthex', 'Frost Hex', 'A curse: frost on the other rink\'s next stone, and it drags heavy.', null, { heavy: 1.04 })],
};
// the second of each, picked on the Shed tab: [draw, hit]
const CR_POW2 = {
  goblin: [crP('pocketdraw', 'Pocket Draw', 'The weight\'s miss a fifth smaller.', { wt: .8 }), crP('jostle', 'Jostle', 'A curse: a goblin at their elbow (their next stone a third wilder).', null, { err: 1.3 })],
  kobold: [crP('hothand', 'Hot Hand', 'The miss a fifth smaller.', { err: .8 }), crP('smokescreen', 'Smoke Screen', 'A curse: smoke over the sheet (their next stone a third wilder).', null, { err: 1.3 })],
  werewolf: [crP('moonlit', 'Moonlit', 'The weight\'s miss a quarter smaller.', { wt: .75 }), crP('howl', 'Howl', 'A curse: a howl as they release (their next stone a quarter wilder).', null, { err: 1.25 })],
  dwarf: [crP('steadyhands', 'Steady Hands', 'No pressure on it.', { nerve: 1 }), crP('lowline', 'Low Line', 'A straight, sure hit: the line\'s miss a fifth smaller, the weight a little.', { line: .8, wt: .9 })],
  ogre: [crP('groundshake', 'Ground Shake', 'A curse: the ice shakes under their next stone (a quarter wilder).', null, { err: 1.25 }), crP('clubhit', 'Club Hit', 'The miss a fifth smaller.', { err: .8 })],
  minotaur: [crP('charge', 'Charge', 'The weight\'s miss a fifth smaller.', { wt: .8 }), crP('bullline', 'Bull Line', 'The line\'s miss a quarter smaller.', { line: .75 })],
  troll: [crP('regrow', 'Regrow', 'The sweepers don\'t tire on it, and it goes a little truer.', { legs: 0, err: .9 }), crP('grumble', 'Grumble', 'The miss a little smaller.', { err: .85 })],
  golem: [crP('unmoved', 'Unmoved', 'No pressure on it.', { nerve: 1 }), crP('stonewall', 'Stone Wall', 'Once at rest, a hit barely moves it.', { granite: 1 })],
  harpy: [crP('feather', 'Feather', 'The weight\'s miss a fifth smaller.', { wt: .8 }), crP('shriek', 'Shriek', 'A curse: a shriek as they release (their next stone a third wilder).', null, { err: 1.3 })],
  elf: [crP('starlight', 'Starlight', 'The weight\'s miss nearly a third smaller.', { wt: .7 }), crP('leafline', 'Leaf Line', 'The line\'s miss a fifth smaller.', { line: .8 })],
  wraith: [crP('fade', 'Fade', 'The miss a fifth smaller.', { err: .8 }), crP('chill', 'Chill', 'A curse: a chill on their next stone (it drags a little, and goes wilder).', null, { heavy: 1.03, err: 1.1 })],
  vampire: [crP('batflight', 'Bat Flight', 'Bats on the brooms: the sweepers do more, and it goes a little truer.', { sweep: 1.15, err: .9 }), crP('thirst', 'Thirst', 'The miss a fifth smaller.', { err: .8 })],
  lich: [crP('boneread', 'Bone Read', 'The miss a quarter smaller.', { err: .75 }), crP('wither', 'Wither', 'A curse: their next stone withers (a third wilder).', null, { err: 1.3 })],
  zombie: [crP('groan', 'Groan', 'The miss a little smaller.', { err: .85 }), crP('deadweight', 'Dead Weight', 'Once at rest, a hit barely moves it.', { granite: 1 })],
  gorgon: [crP('scaled', 'Scaled', 'The weight\'s miss a fifth smaller.', { wt: .8 }), crP('hiss', 'Hiss', 'A curse: a hiss as they release (their next stone a quarter wilder).', null, { err: 1.25 })],
  spider: [crP('dropline', 'Drop Line', 'Lowered on a thread: the weight\'s miss nearly a third smaller.', { wt: .7 }), crP('webbed', 'Webbed', 'The line\'s miss nearly a third smaller.', { line: .7 })],
  skeleton: [crP('grin', 'Grin', 'Nothing to lose: no pressure on it.', { nerve: 1 }), crP('hollowline', 'Hollow Line', 'The line\'s miss a little smaller.', { line: .85 })],
  witch: [crP('charm', 'Charm', 'The miss a fifth smaller.', { err: .8 }), crP('brew', 'Brew', 'A brew that shows the line: the miss a quarter smaller.', { err: .75 })],
};
// the ultimate by kind: a mark on the end (own: its side's stones; rival: the other rink's)
const crU = (id, n, desc, own, rival) => ({ id, n, desc, own: own || null, rival: rival || null });
const CR_ULT = {
  goblin: crU('mischief', 'Mischief', 'Goblins under the ice: the other rink\'s every stone this end a third wilder.', null, { err: 1.3 }),
  kobold: crU('wildfire', 'Wildfire', 'The ice runs warm for you: your sweepers do a fifth more this end, and your stones go truer.', { sweep: 1.2, err: .9 }),
  werewolf: crU('fullmoon', 'Full Moon', 'Under the full moon: your stones this end a fifth truer.', { err: .8 }),
  dwarf: crU('mountainhall', 'Mountain Hall', 'Your four dig in: truer, and half the legs spent sweeping, this end.', { err: .85, legs: .5 }),
  ogre: crU('earthquake', 'Earthquake', 'The ice heaves: the other rink\'s stones this end a third wilder.', null, { err: 1.3 }),
  minotaur: crU('stampede', 'Stampede', 'The herd runs: your stones this end go truer, the weight most.', { err: .85, wt: .9 }),
  troll: crU('trollbridge', 'Troll Bridge', 'Every stone of yours this end sets like a troll under a bridge: once at rest, a hit barely moves it.', { granite: 1 }),
  golem: crU('monolith', 'Monolith', 'Set like stone: your stones this end a fifth truer, and steady.', { err: .8, nerve: 1 }),
  harpy: crU('stormwing', 'Storm Wing', 'She owns the air: as your stones settle this end they push the other rink\'s back, and theirs go wild.', { gust: 6 }, { err: 1.15 }),
  elf: crU('feysheet', 'Fey Sheet', 'The ice favours you: your stones this end a quarter truer.', { err: .75 }),
  wraith: crU('haunting', 'Haunting', 'The Shed is haunted: the other rink\'s stones this end a quarter wilder.', null, { err: 1.25 }),
  vampire: crU('eternalnight', 'Eternal Night', 'Night falls: your sweepers don\'t tire this end, and your stones go truer.', { legs: 0, err: .9 }),
  lich: crU('phylactery', 'Phylactery', 'Death has no pressure: your stones this end steady, and truer.', { nerve: 1, err: .8 }),
  zombie: crU('undying', 'Undying', 'The dead don\'t tire: your sweepers spend no legs this end, and the weight goes truer.', { legs: 0, wt: .85 }),
  gorgon: crU('medusa', 'Medusa', 'Her gaze lies on the ice: the other rink\'s stones this end turn stiff, and hardly curl.', null, { stiff: .6 }),
  spider: crU('greatweb', 'Great Web', 'Webs on every broom this end: your sweepers do nearly a third more, and your stones go truer.', { sweep: 1.3, err: .9 }),
  skeleton: crU('bonepile', 'Bone Pile', 'Bones under the pebble: the other rink\'s stones this end drag, and go wilder.', null, { heavy: 1.03, err: 1.1 }),
  witch: crU('coven', 'Coven', 'Thirteen witches over the ice: frost on the other rink\'s stones this end, and yours go truer.', { err: .9 }, { heavy: 1.04 }),
};
// situation powers: the team's, once a game each, for mana
const CR_SIT = {
  hammer: { id: 'hammer', n: 'The Hammer', cost: 1, desc: 'The end\'s last stone, with the hammer: a third truer.' },
  steal: { id: 'steal', n: 'The Steal', cost: 1, desc: 'Your last stone of an end without the hammer, while you lie shot: a third truer.' },
  extra: { id: 'extra', n: 'Extra End', cost: 1, desc: 'In an extra end: the stone\'s miss halved.' },
};
const CR_HIT = ['takeout', 'peel', 'hitroll'];
const crPowOf = (kind, which, alt) => { const T = (alt ? CR_POW2 : CR_POW)[kind] || CR_POW.goblin; return T[which === 'draw' ? 0 : 1]; };

function crPowersStart(o) {
  G.powers = Array.isArray(o.powers) ? o.powers.some(Boolean) : !!o.powers;
  G.powSides = Array.isArray(o.powers) ? o.powers.map(Boolean) : [G.powers, G.powers];
  G.mana = [CR_MANA.start, CR_MANA.start]; G.roar = [0, 0]; G.fx = [null, null]; G.curse = [null, null]; G.mark = null;
  G.ultUsed = [false, false]; G.sitUsed = [{}, {}]; G.sitOn = [null, null]; G.steadyOn = [false, false]; G.casts = []; G.powStone = [-1, -1];
  G.powOnly = Array.isArray(o.powOnly) ? o.powOnly.map(x => x || null) : null;
}
// the shot side s is about to throw: the one a cast is weighed for, the page's call for your stone, the CPU's (or
// Manage's) plan for the rest
// (G.callNow: the shot a cast is being weighed for, set while the CPU casts)
function crShotNow(s) {
  if (G.callNow && G.callNow.s === s) return G.callNow.shot;
  if (typeof GP !== 'undefined' && GP) {
    if (GP.sel && GP.sel.shot && ['aim', 'swing'].includes(GP.ph) && crYours(s)) return GP.sel.shot;
    if (GP.cpu && GP.cpu.s === s) return GP.cpu.plan.shot;
  }
  return 'draw';
}
// the everyday power curler ri of side s would cast on their next stone: the hit power for a hit, else the draw power
function crPowNow(s, ri, shot) {
  const m = G.teams[s].roster[ri == null ? crThrower(s) : ri]; if (!m || !G.powers) return null;
  const which = CR_HIT.includes(shot || crShotNow(s)) ? 'hit' : 'draw', pw = m.pw || {}, P = crPowOf(m.kind, which, pw[which] === 1);
  return Object.assign({ which }, P, { cost: P.curse ? CR_MANA.curse : CR_MANA.pow });
}
function crPowIdOf(s, k, ri) {
  if (k === 'pow') { const P = crPowNow(s, ri); return P ? P.id : null; }
  if (k === 'ult') { const m = G.teams[s].roster[ri == null ? crThrower(s) : ri]; return (CR_ULT[m && m.kind] || CR_ULT.goblin).id; }
  return k;
}
// side s lies shot (its stone nearest the button, in the house)
function crLiesShot(s) { const h = G.stones.filter(crInHouse).sort((a, b) => crDist(a) - crDist(b)); return !!h.length && h[0].s === s; }
// why a power can't be cast now ('' if it can)
function crPowWhy(s, k, ri) {
  if (!G || !G.powers || !G.powSides[s]) return 'No powers in this game.';
  if (G.over) return 'The game is over.';
  if (crUp() !== s) return 'Not your stone.';
  if (G.powOnly && G.powOnly[s] && crPowIdOf(s, k, ri) !== G.powOnly[s]) return 'Not in this game.';
  if (k === 'pow') { const P = crPowNow(s, ri); if (!P) return 'No power.'; if (G.powStone[s] === G.n) return 'One power a stone.'; return G.mana[s] < P.cost ? `It costs ${P.cost} mana.` : ''; }
  if (k === 'ult') { if (G.ultUsed[s]) return 'Once a game.'; if (G.k > 1) return 'Only at the start of an end.'; if (G.mark && G.mark.end === G.end) return 'This end already bears a mark.'; return G.roar[s] < CR_ROAR.ult ? `It takes ${CR_ROAR.ult} roar.` : ''; }
  if (k === 'steady') { if (G.steadyOn[s]) return 'Already steady.'; if (!crPressure(s)) return 'Only for the skip, in the last end.'; return G.roar[s] < CR_ROAR.steady ? `It takes ${CR_ROAR.steady} roar.` : ''; }
  const S = CR_SIT[k]; if (!S) return 'No such power.';
  if (G.sitUsed[s][k]) return 'Once a game.'; if (G.sitOn[s]) return 'One a stone.'; if (G.mana[s] < S.cost) return `It costs ${S.cost} mana.`;
  const per = crPerEnd();
  if (k === 'hammer') return G.hammer === s && G.k === per - 1 ? '' : 'Only on the end\'s last stone, with the hammer.';
  if (k === 'steal') return G.hammer !== s && G.k === per - 2 && crLiesShot(s) ? '' : 'Only on your last stone of an end without the hammer, lying shot.';
  if (k === 'extra') return G.end >= G.ends ? '' : 'Only in an extra end.';
  return '';
}
// cast: k 'pow' (the thrower's), 'ult', 'steady' or a situation power. Returns '' or why not
function crCast(s, k, ri) {
  const r = ri == null ? crThrower(s) : ri, why = crPowWhy(s, k, r); if (why) return why;
  const name = (G.teams[s].roster[r] || {}).n || 'Someone', rec = (id, n) => G.casts.push({ side: s, k, id, n, ri: r, end: G.end + 1, stone: G.n });
  if (k === 'pow') {
    const P = crPowNow(s, r); G.mana[s] -= P.cost; G.powStone[s] = G.n;
    if (P.curse) G.curse[1 - s] = Object.assign({}, P.curse, { by: P.n });
    else if (P.now && P.now.drain) { const d = Math.min(G.roar[1 - s], P.now.drain); G.roar[1 - s] -= d; G.roar[s] = Math.min(CR_ROAR.max, G.roar[s] + d); }
    else G.fx[s] = Object.assign({}, P.fx, { n: P.n });
    rec(P.id, P.n); return '';
  }
  if (k === 'ult') {
    const m = G.teams[s].roster[r], U = CR_ULT[m.kind] || CR_ULT.goblin;
    G.roar[s] -= CR_ROAR.ult; G.ultUsed[s] = true; G.mark = { side: s, end: G.end, id: U.id, n: U.n, own: U.own, rival: U.rival, by: name };
    rec(U.id, U.n); return '';
  }
  if (k === 'steady') { G.roar[s] -= CR_ROAR.steady; G.steadyOn[s] = true; rec('steady', 'Steady'); return ''; }
  const S = CR_SIT[k]; G.mana[s] -= S.cost; G.sitUsed[s][k] = true; G.sitOn[s] = { id: k };
  rec(k, S.n); return '';
}
// what side s's next stone has: its power, the end's mark, a curse on it, a situation power, the roar's steadying
function crFxFor(s) {
  const f = Object.assign({}, CR_FX0);
  if (!G || !G.powers) return f;
  const add = x => { if (!x) return; for (const k in x) { if (!(k in CR_FX0)) continue; if (CR_FX_MUL.has(k)) f[k] *= x[k]; else f[k] = Math.max(f[k], x[k]); } };
  add(G.fx[s]); add(G.curse[s]);
  const M = G.mark; if (M && M.end === G.end) add(M.side === s ? M.own : M.rival);
  const si = G.sitOn[s]; if (si) add(si.id === 'extra' ? { err: .5 } : { err: .67 });
  if (G.steadyOn[s]) f.nerve = 1;
  return f;
}
// as the thrown stone comes to rest (before the rules): a gust pushes the other rink's stone nearest the button back
function crGust(s, stones, f) {
  if (!f || !f.gust) return '';
  const R = CR_SHEET.stoneR, theirs = stones.filter(b => b.s !== s && crInHouse(b)).sort((a, b) => crDist(a) - crDist(b))[0]; if (!theirs) return '';
  const d = crDist(theirs) || 1, ux = d > .5 ? theirs.x / d : 0, uy = d > .5 ? theirs.y / d : 1, to = { x: +(theirs.x + ux * f.gust).toFixed(2), y: +(theirs.y + uy * f.gust).toFixed(2) };
  if (!crOnSheet(to) || stones.some(o => o !== theirs && Math.hypot(o.x - to.x, o.y - to.y) < 2 * R)) return '';
  theirs.x = to.x; theirs.y = to.y; return f.gust;
}
// after side s's stone: what it spent goes; the mana and the roar it earned come in; the mark ends with its end
function crPowersAfter(s, ev, endNo, ham) {
  if (!G.powers) return;
  G.fx[s] = null; G.curse[s] = null; G.steadyOn[s] = false; G.sitOn[s] = null;
  const mana = (k, n) => { G.mana[k] = Math.min(CR_MANA.max, G.mana[k] + n); }, roar = (k, n) => { G.roar[k] = Math.min(CR_ROAR.max, G.roar[k] + n); };
  if (ev.made) { mana(s, CR_MANA.made); roar(s, CR_ROAR.made); }
  if ((ev.out || []).filter(id => id !== 'new' && !String(id).startsWith(s + ':')).length >= 2) roar(s, CR_ROAR.double);
  const e = ev.rule && ev.rule.end;
  if (e && e.s >= 0) {
    mana(e.s, CR_MANA.end + (e.n >= 2 ? CR_MANA.two : 0) + (e.s !== ham ? CR_MANA.steal : 0));
    roar(e.s, (e.n >= 3 ? CR_ROAR.big : e.n >= 2 ? CR_ROAR.two : 0) + (e.s !== ham ? CR_ROAR.steal : 0));
  }
  if (G.mark && G.mark.end !== G.end) G.mark = null;
}
// the CPU's powers before its stone (and yours under Auto in Manage), by skill, on the shot it has called. Returns the
// casts' names, or []
function crCpuPower(s, shot) {
  if (!G.powers || !G.powSides[s] || G.over) return [];
  const sk = G.skill[s], ri = crThrower(s), o = 1 - s, late = G.end >= G.ends - 2, gap = crTotal(o) - crTotal(s), p = crPressure(s), out = [], keep = G.callNow;
  G.callNow = { s, shot };
  try {
    const tryCast = k => { if (!crCast(s, k, ri)) out.push(G.casts[G.casts.length - 1].n); };
    if (sk >= 1) for (const k of ['extra', 'hammer', 'steal']) if (!crPowWhy(s, k)) tryCast(k);
    if (!crPowWhy(s, 'ult', ri) && (sk === 0 ? R() < .5 : sk === 1 ? gap > 0 || late : (gap > 0 && late) || G.end >= G.ends - 1 || (G.hammer === s && gap >= 0 && late))) tryCast('ult');
    if (sk >= 1 && p && !crPowWhy(s, 'steady') && crRat(s, ri).nrv < .7 && G.roar[s] >= CR_ROAR.steady + (sk >= 2 && !G.ultUsed[s] ? CR_ROAR.ult : 0)) tryCast('steady');
    const P = crPowNow(s, ri, shot); if (!P || crPowWhy(s, 'pow', ri)) return out;
    // (a stone worth it: the skip's and the third's, or any stone late in a close game)
    const big = crPos(s) >= 2 || (late && Math.abs(gap) <= 2);
    const go = sk === 0 ? R() < .3 : sk === 1 ? big && G.mana[s] >= P.cost + 1 : (big || p > 0 || gap > 0) && G.mana[s] >= P.cost;
    if (go) tryCast('pow');
    return out;
  } finally { G.callNow = keep; }
}
// the bench's tip for your stone ('' when nothing stands out)
function crPowerTip(s) {
  if (!G.powers) return '';
  const ri = crThrower(s), P = crPowNow(s, ri);
  if (!crPowWhy(s, 'hammer')) return 'Tip: the end\'s last stone, with the hammer: the Hammer makes it a third truer.';
  if (!crPowWhy(s, 'steal')) return 'Tip: you lie shot without the hammer: the Steal makes this stone a third truer.';
  if (!crPowWhy(s, 'extra')) return 'Tip: an extra end; Extra End halves this stone\'s miss.';
  if (crPressure(s) && !crPowWhy(s, 'steady') && crRat(s, ri).nrv < .6) return `Tip: the game hangs on this stone; ${CR_ROAR.steady} roar steadies it.`;
  if (P && !crPowWhy(s, 'pow', ri)) {
    if (P.fx && P.fx.ghost && G.stones.some(crInFgz)) return `Tip: a guard in the way; ${P.n} slides through it.`;
    if (P.fx && P.fx.gust && G.stones.some(b => b.s !== s && crInHouse(b))) return `Tip: ${P.n} pushes their stone nearest the button back.`;
    if (P.fx && P.fx.granite && !CR_HIT.includes(crShotNow(s))) return `Tip: ${P.n} sets your stone like granite: hard to take out.`;
    if (P.curse) return `Tip: ${P.n} works on their next stone.`;
  }
  if (!crPowWhy(s, 'ult', ri)) { const U = CR_ULT[G.teams[s].roster[ri].kind] || CR_ULT.goblin; return `Tip: the roar is up; ${U.n} would mark this end.`; }
  return '';
}
