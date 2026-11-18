/* Mossgate Links: monster powers (issue #92, phase 6), as on the court and the rink, for a game of single strokes.
   A game has them when started with { powers: true } (the Realm's games do; the bare engine and its tests don't).
   - Team mana (G.mana, by side): GL_MANA.start to begin, up to GL_MANA.max; good shots fill it: a tee shot on the
     fairway, an approach onto the green in regulation, a long putt or a chip that drops. A long-game power or a curse costs
     GL_MANA.long (or .curse), a short-game power GL_MANA.short.
   - Everyday powers: every kind has a long-game power (a full shot: the tee or an approach) and a short-game power (a
     chip or a putt), and a second of each (GL_POW, GL_POW2); a player brings one of each pair (m.pw: { long, short },
     0 or 1; picked on the Links tab). The hitter casts theirs before their stroke, for mana; it works on that stroke.
     A curse power works on the other side's next stroke instead. One everyday power a stroke.
   - The roar (G.roar, by side, 0 to GL_ROAR.max): the gallery fills it on a long drive, an approach close to the pin, a
     long putt or a chip that drops, and a birdie. It pays for the ultimate (GL_ROAR.ult), or steadies a nervy stroke
     (GL_ROAR.steady: no pressure on it).
   - The ultimate: one per kind (GL_ULT), once a game per side, for the roar. It leaves a mark on the hole (G.mark) for
     the rest of it: one set of effects on its side's strokes (own) and another on the other side's (rival).
   - Situation powers (GL_SIT), the team's, once a game each, for mana, when the moment fits: Dormie (one down with one
     to play: everyone's focus back), Playoff (in a playoff: the next swing's mark twice the size, its miss halved), Up
     and down (off the green, close by: the next chip and the putt after it truer).
   - Who casts (glCpuPower): the CPU by its skill (a Squire now and then at random; a Knight on the shots that matter,
     keeping a mana back; an Archmage only on strokes that win or halve, the late holes, or when behind, and saving the
     roar for then); your side the same way under Auto powers in Manage, or what you press.
   Effects (GL_FX0): dist, err, wind, roll and putt multiply (the putt's: its error); read multiplies the read line's
   length (and divides the CPU's read error); lip (yards: a putt from no further can't lip out), trees (a ball landing in
   the trees drops into the deep rough), water (a ball in the water comes back out to its edge, no stroke), nerve (no
   pressure on the stroke) and focus (what the stroke costs in focus, multiplied) are the rest; cross adds a crosswind
   (mph) across the line of the shot. glFxFor(side) merges what a side's next stroke has: its power, the hole's mark, a
   curse on it, and a situation power. */
const GL_MANA = { start: 1, max: 6, fw: 1, green: 1, holed: 1, long: 2, short: 1, curse: 2 };
const GL_ROAR = { max: 100, ult: 60, steady: 25, drive: 12, close: 15, putt: 25, chip: 30, birdie: 15, longDrive: 245, longPutt: 5 };
const GL_FX0 = { dist: 1, err: 1, wind: 1, roll: 1, putt: 1, read: 1, lip: 0, trees: 0, water: 0, nerve: 0, focus: 1, cross: 0 };
const GL_FX_MUL = new Set(['dist', 'err', 'wind', 'roll', 'putt', 'read', 'focus']);
const glP = (id, n, cost, desc, fx, curse) => ({ id, n, cost, desc, fx: fx || null, curse: curse || null });
// everyday powers by kind: [long, short]
const GL_POW = {
  goblin: [glP('scamper', 'Scamper Drive', 1, 'A low runner that scampers on: half again the roll.', { roll: 1.5 }), glP('sticky', 'Sticky Fingers', 1, 'Soft hands round the green: the chip or putt goes a third truer.', { err: .65, putt: .65 })],
  kobold: [glP('ember', 'Ember Drive', 1, 'A coal in the ball: it flies a little further.', { dist: 1.06 }), glP('fireread', 'Fire Read', 1, 'The heat shows the slope: the read line half again as long, and a truer putt.', { read: 1.5, putt: .85 })],
  werewolf: [glP('howl', 'Howl Drive', 1, 'Swung with a howl: further, and a little wilder.', { dist: 1.09, err: 1.1 }), glP('nose', 'Keen Nose', 1, 'Smells the line: the read line half again as long.', { read: 1.5, putt: .9 })],
  dwarf: [glP('forged', 'Forged Iron', 1, 'Hammered true: the miss a third smaller.', { err: .7 }), glP('stoneread', 'Stone Read', 1, 'Reads ground like rock: a far longer read line, a truer putt.', { read: 1.6, putt: .85 })],
  ogre: [glP('bigswing', 'Big Swing', 1, 'All of it: much further, and wilder.', { dist: 1.12, err: 1.2 }), glP('thump', 'Thump Chip', 1, 'A chip thumped dead: a third truer.', { err: .7, putt: .8 })],
  minotaur: [glP('bulldrive', 'Bull Drive', 1, 'Head down through it: further.', { dist: 1.09 }), glP('horned', 'Horned Read', 1, 'Lowers its horns to the green: a longer read line.', { read: 1.4, putt: .9 })],
  troll: [glP('underbridge', 'Under the Bridge', 1, 'Trolls know water: a ball in the water comes back out to its edge, with no stroke.', { water: 1 }), glP('mossy', 'Mossy Touch', 1, 'Moss on the fingers: the chip or putt truer.', { err: .7, putt: .8 })],
  golem: [glP('stonedrive', 'Stone Drive', 1, 'A drive like a thrown rock: through the branches (it drops into the rough), and the wind hardly moves it.', { trees: 1, wind: .5 }), glP('granite', 'Granite Putt', 1, 'Unmoving: a much truer putt.', { putt: .7 })],
  harpy: [glP('ridewind', 'Ride the Wind', 1, 'She rides it: no wind on this shot.', { wind: 0 }), glP('talon', 'Talon Chip', 1, 'Plucked and placed: the chip or putt a third truer.', { err: .7, putt: .8 })],
  elf: [glP('arrow', 'Arrow Line', 1, 'Like an arrow: the miss much smaller.', { err: .6 }), glP('elvenread', 'Elven Read', 1, 'Sees every blade: the read line twice as long.', { read: 2, putt: .9 })],
  wraith: [glP('throughtrunk', 'Through the Trunk', 1, 'The ball passes through a tree like smoke (it drops into the rough beyond).', { trees: 1 }), glP('coldputt', 'Cold Putt', 1, 'Nothing to lose: no pressure on it, and a truer putt.', { nerve: 1, putt: .9 })],
  vampire: [glP('backdeep', 'Back from the Deep', 1, 'A vampire\'s ball comes back out of the water to its edge, with no stroke.', { water: 1 }), glP('bloodread', 'Blood Read', 1, 'Smells the slope: a longer read line and a truer putt.', { read: 1.5, putt: .85 })],
  lich: [glP('graveline', 'Grave Line', 1, 'Cold and certain: the miss a quarter smaller.', { err: .75 }), glP('deadcalm', 'Dead Calm', 1, 'No pressure on it, and a truer putt.', { nerve: 1, putt: .85 })],
  zombie: [glP('shamble', 'Shamble Drive', 1, 'It keeps going: a third more roll.', { roll: 1.35 }), glP('brains', 'Brains', 1, 'A longer read line.', { read: 1.4, putt: .9 })],
  gorgon: [glP('serpent', 'Serpent Line', 1, 'Snakes to the target: the miss a fifth smaller.', { err: .8 }), glP('stare', 'Stare', 1, 'A curse: their next ball turns to stone where it lands (no roll), and their putt is shakier.', null, { roll: 0, putt: 1.25 })],
  spider: [glP('silkline', 'Silk Line', 1, 'On a thread: the miss a fifth smaller.', { err: .8 }), glP('webcup', 'Web the Cup', 1, 'A web over the cup: a putt from 2 yards or closer can\'t lip out, and it is truer.', { lip: 2, putt: .85 })],
  skeleton: [glP('rattle', 'Rattle Drive', 1, 'A little further.', { dist: 1.05 }), glP('bonedry', 'Bone Dry', 1, 'A dry, true putt.', { putt: .8 })],
  witch: [glP('broom', 'Broomstick', 1, 'On a broom: the wind barely moves it.', { wind: .4 }), glP('brew', 'Brew Read', 1, 'A brew that shows the slope: a far longer read line.', { read: 1.6, putt: .9 })],
};
// the second of each, picked on the Links tab: [long, short]
const GL_POW2 = {
  goblin: [glP('sneak', 'Sneak Line', 1, 'Sneaks round trouble: the miss smaller.', { err: .8 }), glP('pocket', 'Pocket Putt', 1, 'A much truer putt.', { putt: .7 })],
  kobold: [glP('smoke', 'Smoke Screen', 1, 'A curse: smoke over their next shot (a wilder miss).', null, { err: 1.3, putt: 1.2 }), glP('hotputt', 'Hot Putt', 1, 'A truer putt.', { putt: .8 })],
  werewolf: [glP('packline', 'Pack Line', 1, 'Hunts as a pack: the miss smaller.', { err: .85 }), glP('moonlit', 'Moonlit Putt', 1, 'A truer putt.', { putt: .75 })],
  dwarf: [glP('lowrunner', 'Low Runner', 1, 'Under the wind and running: less wind, more roll.', { wind: .4, roll: 1.3 }), glP('steady', 'Steady Hands', 1, 'No pressure on it.', { nerve: 1 })],
  ogre: [glP('clubtoss', 'Club Toss', 1, 'Further.', { dist: 1.08 }), glP('groundshake', 'Ground Shake', 1, 'A curse: the ground shakes under their next stroke (no roll, a shakier putt).', null, { roll: 0, putt: 1.4 })],
  minotaur: [glP('labyrinth', 'Labyrinth Line', 1, 'Knows the way: the miss a fifth smaller.', { err: .8 }), glP('charge', 'Charge Putt', 1, 'Charged at the hole: truer, and it won\'t lip out from 1 yard.', { putt: .85, lip: 1 })],
  troll: [glP('regrow', 'Regrow', 1, 'A swing that hardly tires: this stroke costs no focus.', { focus: 0 }), glP('grumble', 'Grumble Putt', 1, 'A truer putt.', { putt: .85 })],
  golem: [glP('boulder', 'Boulder', 1, 'Lands and keeps rolling: half again the roll.', { roll: 1.5 }), glP('unmoved', 'Unmoved', 1, 'No pressure on it.', { nerve: 1 })],
  harpy: [glP('gust', 'Gust', 1, 'A curse: a 12 mph gust across their next shot.', null, { cross: 12 }), glP('feather', 'Feather Putt', 1, 'A truer putt.', { putt: .8 })],
  elf: [glP('leaffade', 'Leaf Fade', 1, 'Floats down and sits: half the roll, the miss smaller.', { roll: .5, err: .85 }), glP('starlight', 'Starlight Putt', 1, 'A truer putt.', { putt: .75 })],
  wraith: [glP('fadeaway', 'Fade Away', 1, 'The miss a fifth smaller.', { err: .8 }), glP('chill', 'Chill', 1, 'A curse: a chill on their next stroke (a shakier putt, a wilder miss).', null, { putt: 1.3, err: 1.15 })],
  vampire: [glP('batflight', 'Bat Flight', 1, 'Flies on the night: further, and less wind.', { dist: 1.06, wind: .6 }), glP('thirst', 'Thirst', 1, 'A truer putt.', { putt: .8 })],
  lich: [glP('wither', 'Wither', 1, 'A curse: their next stroke withers (a wilder miss).', null, { err: 1.3, putt: 1.2 }), glP('boneread', 'Bone Read', 1, 'A far longer read line.', { read: 1.6 })],
  zombie: [glP('rotline', 'Rot Line', 1, 'Slow and steady: a smaller miss, and half the focus spent.', { err: .9, focus: .5 }), glP('groan', 'Groan Putt', 1, 'A truer putt.', { putt: .85 })],
  gorgon: [glP('hiss', 'Hiss', 1, 'A curse: a hiss as they swing (a wilder miss).', null, { err: 1.25, putt: 1.15 }), glP('scaled', 'Scaled Putt', 1, 'A truer putt.', { putt: .8 })],
  spider: [glP('dropline', 'Drop Line', 1, 'Lowered on a thread: it barely rolls.', { roll: .4, err: .9 }), glP('eightlegs', 'Eight Legs', 1, 'Braced on eight legs: no pressure on it.', { nerve: 1, putt: .9 })],
  skeleton: [glP('hollow', 'Hollow Line', 1, 'The wind goes through it: half the wind.', { wind: .5 }), glP('grin', 'Grin', 1, 'Nothing to lose: no pressure on it.', { nerve: 1 })],
  witch: [glP('hex', 'Hex', 1, 'A curse: a 12 mph crosswind on their next shot.', null, { cross: 12 }), glP('charm', 'Charm Putt', 1, 'A truer putt.', { putt: .75 })],
};
// the ultimate by kind: a mark on the hole for the rest of it (own: on its side's strokes; rival: on the other side's)
const glU = (id, n, desc, own, rival) => ({ id, n, desc, own: own || null, rival: rival || null });
const GL_ULT = {
  goblin: glU('mischief', 'Mischief', 'Goblins on the course: their every stroke this hole a third wilder.', null, { err: 1.3, putt: 1.3 }),
  kobold: glU('wildfire', 'Wildfire', 'The fairways burn fast: your every shot this hole further and running.', { dist: 1.06, roll: 1.3 }),
  werewolf: glU('fullmoon', 'Full Moon', 'Under the full moon: your every stroke this hole a fifth truer.', { err: .8, putt: .8 }),
  dwarf: glU('mountainhall', 'Mountain Hall', 'Your four dig in: truer, and half the focus spent, this hole.', { err: .85, focus: .5 }),
  ogre: glU('earthquake', 'Earthquake', 'The green heaves: their putts this hole half again as shaky.', null, { putt: 1.5 }),
  minotaur: glU('stampede', 'Stampede', 'The herd runs: your every shot this hole further and running.', { dist: 1.08, roll: 1.3 }),
  troll: glU('trollbridge', 'Troll Bridge', 'Every stream has a troll under it: your balls come back out of the water this hole.', { water: 1, err: .9 }),
  golem: glU('monolith', 'Monolith', 'Set like stone: your every stroke this hole a fifth truer, and steady.', { err: .8, nerve: 1 }),
  harpy: glU('stormwing', 'Storm Wing', 'She owns the sky: no wind on your shots this hole, and half again on theirs.', { wind: 0 }, { wind: 1.5 }),
  elf: glU('feyground', 'Fey Ground', 'The wood favours you: your every stroke this hole a quarter truer.', { err: .75, putt: .8 }),
  wraith: glU('haunting', 'Haunting', 'The course is haunted: their every stroke this hole a quarter wilder.', null, { err: 1.25, putt: 1.25 }),
  vampire: glU('eternalnight', 'Eternal Night', 'Night falls: your four spend no focus this hole, and swing truer.', { focus: 0, err: .9 }),
  lich: glU('phylactery', 'Phylactery', 'Death has no pressure: your strokes this hole steady, and your putts truer.', { nerve: 1, putt: .8 }),
  zombie: glU('undying', 'Undying', 'The dead don\'t tire: no focus spent this hole, and a third more roll.', { focus: 0, roll: 1.3 }),
  gorgon: glU('medusa', 'Medusa', 'Her gaze lies on the hole: their balls turn to stone where they land this hole.', null, { roll: 0 }),
  spider: glU('greatweb', 'Great Web', 'A web over the cup all hole: your putts from 3 yards can\'t lip out, and they are truer.', { lip: 3, putt: .8 }),
  skeleton: glU('bonepile', 'Bone Pile', 'Bones in the fairways: their shots this hole run a third less, and wilder.', null, { roll: .65, err: 1.15 }),
  witch: glU('coven', 'Coven', 'Thirteen witches read the green with you: your read lines this hole twice as long, and truer putts.', { read: 2, putt: .8 }),
};
// situation powers: the team's, once a game each, for mana
const GL_SIT = {
  dormie: { id: 'dormie', n: 'Dormie', cost: 1, desc: 'One down with one to play (or dormie down): everyone\'s focus back.' },
  playoff: { id: 'playoff', n: 'Playoff', cost: 1, desc: 'In the playoff: the next swing\'s mark twice the size, its miss halved.' },
  updown: { id: 'updown', n: 'Up and down', cost: 2, desc: 'Off the green and close by: the next chip, and the putt after it, a third truer.' },
};
const glPowOf = (kind, which, alt) => { const T = (alt ? GL_POW2 : GL_POW)[kind] || GL_POW.goblin; return T[which === 'long' ? 0 : 1]; };

function glPowersStart(o) {
  // (powers: true for both sides, or [yours, theirs] for one side's only: the lab's question)
  G.powers = Array.isArray(o.powers) ? o.powers.some(Boolean) : !!o.powers;
  G.powSides = Array.isArray(o.powers) ? o.powers.map(Boolean) : [G.powers, G.powers];
  G.mana = [GL_MANA.start, GL_MANA.start]; G.roar = [0, 0]; G.fx = [null, null]; G.curse = [null, null]; G.mark = null;
  G.ultUsed = [false, false]; G.sitUsed = [{}, {}]; G.sitOn = [null, null]; G.steadyOn = [false, false]; G.casts = [];
}
// the everyday power player ri of side s would cast for their next stroke: long or short by the shot
function glPowNow(s, ri) {
  const m = G.teams[s].roster[ri]; if (!m || !G.powers) return null;
  const kind = glShotKind(glHoleNow(), s), which = kind === 'tee' || kind === 'approach' ? 'long' : 'short', pw = m.pw || {};
  // (the cost: a long-game power or a curse GL_MANA.long or .curse, a short-game power GL_MANA.short)
  const P = glPowOf(m.kind, which, pw[which] === 1);
  return Object.assign({ which }, P, { cost: P.curse ? GL_MANA.curse : which === 'long' ? GL_MANA.long : GL_MANA.short });
}
// why a power can't be cast now ('' if it can)
function glPowWhy(s, k, ri) {
  if (!G.powers || !G.powSides[s]) return 'No powers in this game.';
  if (G.hole.done[s]) return 'Your side is done with this hole.';
  if (k === 'pow') { const P = glPowNow(s, ri); if (!P) return ''; if (G.fx[s]) return 'One power a stroke.'; return G.mana[s] < P.cost ? `It costs ${P.cost} mana.` : ''; }
  if (k === 'ult') { if (G.ultUsed[s]) return 'Once a game.'; if (G.mark && G.mark.h === G.h) return 'This hole already bears a mark.'; return G.roar[s] < GL_ROAR.ult ? `It takes ${GL_ROAR.ult} roar.` : ''; }
  if (k === 'steady') { if (G.steadyOn[s]) return 'Already steady.'; if (!glPressure(s)) return 'Nothing riding on this stroke.'; return G.roar[s] < GL_ROAR.steady ? `It takes ${GL_ROAR.steady} roar.` : ''; }
  const S = GL_SIT[k]; if (!S) return 'No such power.';
  if (G.sitUsed[s][k]) return 'Once a game.'; if (G.mana[s] < S.cost) return `It costs ${S.cost} mana.`;
  const up = s === 0 ? glUp() : -glUp(), left = glLeft(), H = glHoleNow(), kind = glShotKind(H, s);
  if (k === 'dormie') return (up === -1 && left === 1) || (up < 0 && -up === left) ? '' : 'Only one down with one to play, or dormie down.';
  if (k === 'playoff') return G.res.length >= G.holes ? '' : 'Only in a playoff.';
  if (k === 'updown') return kind === 'short' ? '' : 'Only off the green and close by.';
  return '';
}
// cast: k 'pow' (the hitter's), 'ult', 'steady' or a situation power. Returns '' or why not
function glCast(s, k, ri) {
  const why = glPowWhy(s, k, ri); if (why) return why;
  const H = G.hole, name = glName(s, ri == null ? 0 : ri);
  if (k === 'pow') {
    const P = glPowNow(s, ri); G.mana[s] -= P.cost;
    if (P.curse) G.curse[1 - s] = Object.assign({}, P.curse, { by: P.n }); else G.fx[s] = Object.assign({}, P.fx, { n: P.n });
    G.casts.push({ side: s, k, id: P.id, n: P.n, ri, h: G.h, st: H.st[s] });
    return '';
  }
  if (k === 'ult') {
    const m = G.teams[s].roster[ri == null ? 0 : ri], U = GL_ULT[m.kind] || GL_ULT.goblin;
    G.roar[s] -= GL_ROAR.ult; G.ultUsed[s] = true; G.mark = { side: s, h: G.h, id: U.id, n: U.n, own: U.own, rival: U.rival, by: name };
    G.casts.push({ side: s, k, id: U.id, n: U.n, ri, h: G.h, st: H.st[s] });
    return '';
  }
  if (k === 'steady') { G.roar[s] -= GL_ROAR.steady; G.steadyOn[s] = true; G.casts.push({ side: s, k, id: 'steady', n: 'Steady', ri, h: G.h, st: H.st[s] }); return ''; }
  const S = GL_SIT[k]; G.mana[s] -= S.cost; G.sitUsed[s][k] = true;
  if (k === 'dormie') G.focus[s] = G.focus[s].map(() => 1);
  else G.sitOn[s] = { id: k, left: k === 'updown' ? 2 : 1 };
  G.casts.push({ side: s, k, id: k, n: S.n, ri, h: G.h, st: H.st[s] });
  return '';
}
// what side s's next stroke has: its power, the hole's mark, a curse on it, a situation power, the roar's steadying
function glFxFor(s) {
  const f = Object.assign({}, GL_FX0);
  if (!G || !G.powers) return f;
  const add = x => { if (!x) return; for (const k in x) { if (!(k in GL_FX0)) continue; if (GL_FX_MUL.has(k)) f[k] *= x[k]; else f[k] = Math.max(f[k], x[k]); } };
  add(G.fx[s]); add(G.curse[s]);
  if (G.mark && G.mark.h === G.h) add(G.mark.side === s ? G.mark.own : G.mark.rival);
  const si = G.sitOn[s]; if (si) add(si.id === 'playoff' ? { err: .5 } : { err: .67, putt: .67 });
  if (G.steadyOn[s]) f.nerve = 1;
  return f;
}
// after side s's stroke: what it spent goes; the mana and the roar it earned come in. ev: the shot, r: the ball
function glPowersAfter(s, ev, plan) {
  if (!G.powers) return;
  G.fx[s] = null; G.curse[s] = null; G.steadyOn[s] = false;
  const si = G.sitOn[s]; if (si && --si.left <= 0) G.sitOn[s] = null;
  const mana = n => { G.mana[s] = Math.min(GL_MANA.max, G.mana[s] + n); }, roar = n => { G.roar[s] = Math.min(GL_ROAR.max, G.roar[s] + n); };
  if (ev.k !== 'shot') return;
  if (ev.lie0 === 'T' && ev.lie === 'F' && !ev.water) mana(GL_MANA.fw);
  // (on the green in regulation: in two shots fewer than par)
  if (ev.lie0 !== 'G' && ev.lie === 'G' && !ev.holed && ev.st <= G.hole.par - 2) mana(GL_MANA.green);
  if (ev.holed && (ev.club !== 'pt' || ev.d0 >= 3)) mana(GL_MANA.holed);
  if (ev.lie0 === 'T' && ev.d0 - ev.d1 >= GL_ROAR.longDrive && !ev.water) roar(GL_ROAR.drive);
  if (ev.club !== 'pt' && !ev.holed && ev.lie === 'G' && ev.d1 <= 3) roar(GL_ROAR.close);
  if (ev.holed) roar(ev.club === 'pt' ? (ev.d0 >= GL_ROAR.longPutt ? GL_ROAR.putt : 0) : GL_ROAR.chip);
  if (ev.holed && ev.st < G.hole.par) roar(GL_ROAR.birdie);
}
// the CPU's powers before its stroke (and yours under Auto in Manage), by skill. Returns the casts' names, or []
function glCpuPower(s, ri) {
  if (!G.powers || !G.powSides[s] || G.hole.done[s]) return [];
  const sk = G.skill[s], up = s === 0 ? glUp() : -glUp(), left = glLeft(), p = glPressure(s), late = left <= 3 || G.res.length >= G.holes, H = glHoleNow(), kind = glShotKind(H, s), out = [];
  const tryCast = (k, r) => { if (!glCast(s, k, r)) out.push(k === 'pow' ? glPowNow(s, r) && G.casts[G.casts.length - 1].n : G.casts[G.casts.length - 1].n); };
  // the situation powers first, when the moment fits
  if (sk >= 1) for (const k of ['dormie', 'playoff']) if (!glPowWhy(s, k)) tryCast(k);
  if (sk >= 1 && kind === 'short' && G.mana[s] >= 3 && !glPowWhy(s, 'updown')) tryCast('updown');
  // the ultimate: a Squire as soon as it can; a Knight behind or late; an Archmage behind late, or on a stroke that wins
  // or halves late in the game
  if (!glPowWhy(s, 'ult', ri) && G.hole.st[s] === 0 && (sk === 0 ? R() < 0.5 : sk === 1 ? up < 0 || late : (up < 0 && late) || (late && up <= 0))) tryCast('ult', ri);
  if (sk >= 1 && p && !glPowWhy(s, 'steady') && glRat(s, ri).nrv < 0.7 && G.roar[s] >= GL_ROAR.steady + (sk >= 2 && !G.ultUsed[s] ? GL_ROAR.ult : 0)) tryCast('steady');
  // the everyday power
  const P = glPowNow(s, ri); if (!P || glPowWhy(s, 'pow', ri)) return out;
  const d = glDistOf(H, s), worth = kind === 'tee' ? H.par > 3 : kind === 'approach' ? d > 110 : kind === 'putt' ? d >= 1.5 && d <= 10 : true;
  const go = sk === 0 ? R() < 0.3 : sk === 1 ? worth && G.mana[s] >= P.cost + 1 : worth && (p > 0 || late || up < 0) && G.mana[s] >= P.cost;
  if (go) tryCast('pow', ri);
  return out;
}
// the bench's tip for your stroke: the power worth casting now, in a few words ('' when nothing stands out)
function glPowerTip(s, ri) {
  if (!G.powers) return '';
  const P = glPowNow(s, ri), H = glHoleNow(), d = glDistOf(H, s), w = G.wind || { s: 0 }, p = glPressure(s);
  if (!glPowWhy(s, 'dormie')) return 'Tip: Dormie gives everyone their focus back.';
  if (p && !glPowWhy(s, 'steady') && glRat(s, ri).nrv < 0.6) return `Tip: this stroke wins or halves the hole; ${GL_ROAR.steady} roar steadies it.`;
  if (P && !glPowWhy(s, 'pow', ri)) {
    if (P.fx && P.fx.wind != null && P.fx.wind < 1 && w.s >= 8) return `Tip: ${P.n} takes the ${w.s} mph wind out of this shot.`;
    if (P.fx && P.fx.lip && d <= P.fx.lip) return `Tip: ${P.n} means this putt can't lip out.`;
    if (P.fx && (P.fx.read || 1) > 1 && d >= 3) return `Tip: ${P.n} shows more of this putt's break.`;
    if (P.fx && P.fx.water) { const b = G.ball[s]; if (glTrouble(H, b, H.pin)) return `Tip: water on the line; ${P.n} brings a wet ball back.`; }
    if (P.curse) return `Tip: ${P.n} works on their next stroke.`;
  }
  if (!glPowWhy(s, 'ult', ri)) { const U = GL_ULT[G.teams[s].roster[ri].kind] || GL_ULT.goblin; return `Tip: the roar is up; ${U.n} would mark this hole.`; }
  return '';
}
// the moment's pressure on side s's next stroke, after its powers (nerve: none)
const glPressFx = s => glFxFor(s).nerve ? 0 : glPressure(s);
// a stroke's effects as glFlight takes them: the wind (scaled, and a curse's crosswind across the line), the roll, the
// trees, the water, the lip
function glFxFlight(fx, aim, b) {
  let wind = G.wind;
  if (fx.wind !== 1 || fx.cross) {
    const w = G.wind || { s: 0, d: 0 }, wx = Math.cos(w.d) * w.s * fx.wind, wy = Math.sin(w.d) * w.s * fx.wind, a = Math.atan2(aim.y - b.y, aim.x - b.x) + Math.PI / 2;
    const x = wx + Math.cos(a) * fx.cross, y = wy + Math.sin(a) * fx.cross;
    wind = { s: hyp(x, y), d: Math.atan2(y, x) };
  }
  return { wind, rollK: fx.roll, trees: fx.trees, water: fx.water, lip: fx.lip };
}

