/* The Saltmere Lanes: monster powers (issue #100, phase 6), as on the Links, for a game of single balls. A game has them
   when started with { powers: true } (the Realm's games do; the bare engine, its tests and the labs don't, unless asked;
   powers: [yours, theirs] gives one side only).
   - Team mana (G.mana, by side): BL_MANA.start to begin, up to BL_MANA.max. A strike fills it, a spare too, and a split
     converted twice over. A strike power costs BL_MANA.strike, a spare power BL_MANA.spare, a curse BL_MANA.curse.
   - Everyday powers: every kind has a strike power (for a ball at a full rack) and a spare power (for a ball at what is
     left), and a second of each (BL_POW, BL_POW2); a bowler brings one of each pair (m.pw: { strike, spare }, 0 or 1;
     picked on the Lanes tab). The bowler casts theirs before their ball, for mana; it works on that ball. A curse works
     on the other side's next ball instead. One everyday power a ball. A Drain works at once.
   - The roar (G.roar, by side, 0 to BL_ROAR.max): the gallery fills it on a double, more on a turkey, a little on every
     strike, and most on a split made. It pays for the ultimate (BL_ROAR.ult), or steadies a ball in the last frame
     (BL_ROAR.steady: no pressure on it).
   - The ultimate: one per kind (BL_ULT), once a game per side, for the roar, cast before a frame's first ball. It marks
     the lanes for that frame (G.mark): one set of effects on its side's balls (own), another on the other side's
     (rival), until both sides have bowled the frame.
   - Situation powers (BL_SIT), the team's, once a game each, for mana, when the moment fits: the Fill (in the last frame
     after a strike or a spare: the bowler's arm back), Clean Game (from the 8th frame with no open frame yet: the next
     ball a third truer) and Roll-off (in a roll-off: the next ball's miss halved).
   - Who casts (blCpuPower): the CPU by its skill (a Squire now and then at random; a Knight on the balls that matter,
     keeping a mana back; an Archmage when it is behind, late, or the moment is big, saving the roar for the
     ultimate); your side the same way under Auto powers in Manage, or what you press.
   Effects (BL_FX0): err (the release's miss), carry (how hard the ball drives through the pins), hook (the revs) and arm
   (what the ball costs the arm) multiply; skid (a curse: the oil plays heavier, so the ball skids long) multiplies the
   oil; nodefl (the ball barely deflects: it drives through like a heavier one), ghost (the ball passes through the
   headpin when it comes in light, and the pin takes the pocket's knock), web (a gutter ball is caught and set back on the lane, once), stone (a curse:
   the front pin of their rack turns to stone, three times as heavy and as hard to topple), wobble (after the ball, each
   pin left standing beside one that fell may go, by this chance) and nerve (no pressure) are the rest. */
const BL_MANA = { start: 2, max: 6, strike: 1, spare: 1, split: 1, costStrike: 2, costSpare: 1, curse: 2 };
const BL_ROAR = { max: 100, ult: 60, steady: 25, strike: 4, double: 15, turkey: 25, splitMade: 30 };
const BL_FX0 = { err: 1, carry: 1, hook: 1, arm: 1, skid: 1, nodefl: 0, ghost: 0, web: 0, stone: 0, wobble: 0, nerve: 0 };
const BL_FX_MUL = new Set(['err', 'carry', 'hook', 'arm', 'skid']);
const blP = (id, n, desc, fx, curse, now) => ({ id, n, desc, fx: fx || null, curse: curse || null, now: now || null });
// everyday powers by kind: [strike, spare]
const BL_POW = {
  goblin: [blP('scamper', 'Scamper Ball', 'A sly spin: a tenth more hook.', { hook: 1.1 }), blP('sticky', 'Sticky Fingers', 'Soft hands at a spare: the miss a third smaller.', { err: .65 })],
  kobold: [blP('emberball', 'Ember Ball', 'A coal in the ball: it drives a tenth harder.', { carry: 1.1 }), blP('fireread', 'Fire Read', 'The heat shows the line: the miss a quarter smaller.', { err: .75 })],
  werewolf: [blP('howl', 'Howl', 'Thrown with a howl: harder through the pins, and a little wilder.', { carry: 1.15, err: 1.1 }), blP('nose', 'Keen Nose', 'Smells the spare: the miss a quarter smaller.', { err: .75 })],
  dwarf: [blP('forged', 'Forged Ball', 'Hammered true: the miss a third smaller.', { err: .7 }), blP('stoneread', 'Stone Read', 'Reads the boards like rock: the miss a third smaller.', { err: .7 })],
  ogre: [blP('bigthrow', 'Big Throw', 'All of it: much harder through the pins, and wilder.', { carry: 1.2, err: 1.2 }), blP('thump', 'Thump', 'Thumped dead at the pin: the miss a quarter smaller.', { err: .75 })],
  minotaur: [blP('bullball', 'Bull Ball', 'Head down through it: harder through the pins.', { carry: 1.12 }), blP('horned', 'Horned Aim', 'Lowers its horns at the pin: the miss a fifth smaller.', { err: .8 })],
  troll: [blP('boulder', 'Boulder', 'A cannonball: it drives a quarter harder, and costs a third more arm.', { carry: 1.25, arm: 1.3 }), blP('mossy', 'Mossy Touch', 'Moss on the fingers: the miss a quarter smaller.', { err: .75 })],
  golem: [blP('stoneball', 'Stone Ball', 'A thrown rock: a fifth harder through the pins.', { carry: 1.2 }), blP('granite', 'Granite', 'Unmoving: no pressure on it, and truer.', { nerve: 1, err: .85 })],
  harpy: [blP('gust', 'Gust', 'A gust over the deck: every pin left standing beside one that fell may go.', { wobble: .18 }), blP('talon', 'Talon', 'Plucked and placed: the miss a third smaller.', { err: .7 })],
  elf: [blP('arrowline', 'Arrow Line', 'Like an arrow: the miss much smaller.', { err: .6 }), blP('elveneye', 'Elven Eye', 'Sees every board: the miss a third smaller.', { err: .65 })],
  wraith: [blP('ghostball', 'Ghost Ball', 'A light ball passes through the headpin like smoke, and the pin falls as if it had been hit in the pocket.', { ghost: 1 }), blP('coldhand', 'Cold Hand', 'Nothing to lose: no pressure on it, and truer.', { nerve: 1, err: .85 })],
  vampire: [blP('drain', 'Drain', 'Drinks the other side\'s gallery: 20 of their roar, now.', null, null, { drain: 20 }), blP('bloodread', 'Blood Read', 'Smells the line: the miss a quarter smaller.', { err: .75 })],
  lich: [blP('graveline', 'Grave Line', 'Cold and certain: the miss a quarter smaller.', { err: .75 }), blP('deadcalm', 'Dead Calm', 'No pressure on it, and truer.', { nerve: 1, err: .85 })],
  zombie: [blP('deadroll', 'Dead Roll', 'A dead ball: it barely deflects off the headpin and drives on through.', { nodefl: 1 }), blP('shamble', 'Shamble', 'Slow and sure: the miss a fifth smaller.', { err: .8 })],
  gorgon: [blP('serpent', 'Serpent Line', 'Snakes to the pocket: the miss a fifth smaller.', { err: .8 }), blP('stare', 'Stare', 'A curse: the front pin of their next rack turns to stone.', null, { stone: 1 })],
  spider: [blP('silkline', 'Silk Line', 'On a thread: the miss a fifth smaller.', { err: .8 }), blP('gutterweb', 'Gutter Web', 'A web in the gutters: a gutter ball is caught and set back on the lane, and the miss is smaller.', { web: 1, err: .9 })],
  skeleton: [blP('rattle', 'Rattle', 'The pins rattle: one left beside a fallen one may go.', { wobble: .2 }), blP('bonedry', 'Bone Dry', 'A dry, true ball: the miss a fifth smaller.', { err: .8 })],
  witch: [blP('broom', 'Broomstick', 'A broom\'s twist: more hook.', { hook: 1.12 }), blP('hex', 'Hex', 'A curse: the oil plays heavy for their next ball, and it skids long.', null, { skid: 1.06 })],
};
// the second of each, picked on the Lanes tab: [strike, spare]
const BL_POW2 = {
  goblin: [blP('sneak', 'Sneak Line', 'The miss a fifth smaller.', { err: .8 }), blP('pickpin', 'Pocket Pick', 'The miss a third smaller.', { err: .7 })],
  kobold: [blP('smoke', 'Smoke Screen', 'A curse: smoke over their next ball (a wilder miss).', null, { err: 1.3 }), blP('hothand', 'Hot Hand', 'The miss a fifth smaller.', { err: .8 })],
  werewolf: [blP('packhunt', 'Pack Hunt', 'Harder through the pins, and a little truer.', { carry: 1.1, err: .9 }), blP('moonlit', 'Moonlit', 'The miss a quarter smaller.', { err: .75 })],
  dwarf: [blP('lowroller', 'Low Roller', 'A straighter, truer roll.', { hook: .85, err: .8 }), blP('steadyhands', 'Steady Hands', 'No pressure on it.', { nerve: 1 })],
  ogre: [blP('clubthrow', 'Club Throw', 'Harder through the pins.', { carry: 1.15 }), blP('groundshake', 'Ground Shake', 'A curse: the floor shakes under their next ball (a wilder miss).', null, { err: 1.25 })],
  minotaur: [blP('labyrinth', 'Labyrinth', 'Knows the way: the miss a fifth smaller.', { err: .8 }), blP('charge', 'Charge', 'Charged at the pin: harder and truer.', { carry: 1.2, err: .85 })],
  troll: [blP('regrow', 'Regrow', 'A throw that hardly tires: no arm spent.', { arm: 0 }), blP('grumble', 'Grumble', 'The miss a little smaller.', { err: .85 })],
  golem: [blP('monoroll', 'Monolith Roll', 'It barely deflects, and drives on through.', { nodefl: 1 }), blP('unmoved', 'Unmoved', 'No pressure on it.', { nerve: 1 })],
  harpy: [blP('shriek', 'Shriek', 'A curse: a shriek as they release (a wilder miss).', null, { err: 1.3 }), blP('feather', 'Feather', 'The miss a fifth smaller.', { err: .8 })],
  elf: [blP('leafcurve', 'Leaf Curve', 'A late, sweeping hook, and truer.', { hook: 1.12, err: .9 }), blP('starlight', 'Starlight', 'The miss a third smaller.', { err: .7 })],
  wraith: [blP('fade', 'Fade', 'The miss a fifth smaller.', { err: .8 }), blP('chill', 'Chill', 'A curse: a chill on their next ball (wilder, and the oil plays heavier).', null, { err: 1.15, skid: 1.03 })],
  vampire: [blP('batflight', 'Bat Flight', 'More hook, and a little harder.', { hook: 1.1, carry: 1.05 }), blP('thirst', 'Thirst', 'The miss a fifth smaller.', { err: .8 })],
  lich: [blP('wither', 'Wither', 'A curse: their next ball withers (a wilder miss).', null, { err: 1.3 }), blP('boneread', 'Bone Read', 'The miss a quarter smaller.', { err: .75 })],
  zombie: [blP('rotroll', 'Rot Roll', 'Slow and steady: a little truer, and half the arm spent.', { err: .9, arm: .5 }), blP('groan', 'Groan', 'The miss a little smaller.', { err: .85 })],
  gorgon: [blP('hiss', 'Hiss', 'A curse: a hiss as they release (a wilder miss).', null, { err: 1.25 }), blP('scaled', 'Scaled', 'The miss a fifth smaller.', { err: .8 })],
  spider: [blP('eightarms', 'Eight Arms', 'Eight arms on the release: much more hook.', { hook: 1.15 }), blP('dropline', 'Drop Line', 'Lowered on a thread: the miss a third smaller.', { err: .7 })],
  skeleton: [blP('hollow', 'Hollow Line', 'The miss a little smaller.', { err: .85 }), blP('grin', 'Grin', 'Nothing to lose: no pressure on it.', { nerve: 1 })],
  witch: [blP('charm', 'Charm', 'The miss a fifth smaller.', { err: .8 }), blP('brew', 'Brew', 'A brew that shows the line: the miss a quarter smaller.', { err: .75 })],
};
// the ultimate by kind: a mark on the lanes for the frame (own: its side's balls; rival: the other side's)
const blU = (id, n, desc, own, rival) => ({ id, n, desc, own: own || null, rival: rival || null });
const BL_ULT = {
  goblin: blU('mischief', 'Mischief', 'Goblins in the pit: their every ball this frame a third wilder.', null, { err: 1.3 }),
  kobold: blU('wildfire', 'Wildfire', 'The lanes run hot: your balls this frame hook more and drive harder.', { hook: 1.1, carry: 1.08 }),
  werewolf: blU('fullmoon', 'Full Moon', 'Under the full moon: your balls this frame a fifth truer.', { err: .8 }),
  dwarf: blU('mountainhall', 'Mountain Hall', 'Your five dig in: truer, and half the arm spent, this frame.', { err: .85, arm: .5 }),
  ogre: blU('earthquake', 'Earthquake', 'The floor heaves: their balls this frame a third wilder.', null, { err: 1.3 }),
  minotaur: blU('stampede', 'Stampede', 'The herd runs: your balls this frame drive much harder.', { carry: 1.15 }),
  troll: blU('trollbridge', 'Troll Bridge', 'A troll under every gutter: your balls this frame drive harder, and a gutter ball comes back.', { carry: 1.2, web: 1 }),
  golem: blU('monolith', 'Monolith', 'Set like stone: your balls this frame a fifth truer, and steady.', { err: .8, nerve: 1 }),
  harpy: blU('stormwing', 'Storm Wing', 'She owns the air: pins wobble over for you this frame, and their balls go wild.', { wobble: .3 }, { err: 1.15 }),
  elf: blU('feylane', 'Fey Lane', 'The lanes favour you: your balls this frame a quarter truer.', { err: .75 }),
  wraith: blU('haunting', 'Haunting', 'The hall is haunted: their balls this frame a quarter wilder.', null, { err: 1.25 }),
  vampire: blU('eternalnight', 'Eternal Night', 'Night falls: your five spend no arm this frame, and throw truer.', { arm: 0, err: .9 }),
  lich: blU('phylactery', 'Phylactery', 'Death has no pressure: your balls this frame steady, and truer.', { nerve: 1, err: .8 }),
  zombie: blU('undying', 'Undying', 'The dead don\'t tire: no arm spent this frame, and the ball drives through.', { arm: 0, nodefl: 1 }),
  gorgon: blU('medusa', 'Medusa', 'Her gaze lies on the deck: the front pin of every rack they face this frame turns to stone.', null, { stone: 1 }),
  spider: blU('greatweb', 'Great Web', 'Webs in every gutter this frame: yours come back, and your balls are truer.', { web: 1, err: .85 }),
  skeleton: blU('bonepile', 'Bone Pile', 'Bones on the deck: their balls this frame carry less, and go wilder.', null, { carry: .85, err: 1.15 }),
  witch: blU('coven', 'Coven', 'Thirteen witches over the oil: it plays heavy for them this frame, and your balls are truer.', { err: .9 }, { skid: 1.06 }),
};
// situation powers: the team's, once a game each, for mana
const BL_SIT = {
  fill: { id: 'fill', n: 'The Fill', cost: 1, desc: 'In the last frame after a strike or a spare: the bowler\'s arm back for the fill balls.' },
  clean: { id: 'clean', n: 'Clean Game', cost: 1, desc: 'From the 8th frame, with no open frame yet: the next ball a third truer.' },
  rolloff: { id: 'rolloff', n: 'Roll-off', cost: 1, desc: 'In a roll-off: the next ball\'s miss halved.' },
};
const blPowOf = (kind, which, alt) => { const T = (alt ? BL_POW2 : BL_POW)[kind] || BL_POW.goblin; return T[which === 'strike' ? 0 : 1]; };

function blPowersStart(o) {
  G.powers = Array.isArray(o.powers) ? o.powers.some(Boolean) : !!o.powers;
  G.powSides = Array.isArray(o.powers) ? o.powers.map(Boolean) : [G.powers, G.powers];
  G.mana = [BL_MANA.start, BL_MANA.start]; G.roar = [0, 0]; G.fx = [null, null]; G.curse = [null, null]; G.mark = null;
  G.ultUsed = [false, false]; G.sitUsed = [{}, {}]; G.sitOn = [null, null]; G.steadyOn = [false, false]; G.casts = []; G.powBall = [-1, -1];
  G.powOnly = Array.isArray(o.powOnly) ? o.powOnly.map(x => x || null) : null;
}
const blRackFresh = s => G.stand[s].length === 10;
// the everyday power bowler ri of side s would cast for their next ball: the strike power at a full rack, else the spare
function blPowNow(s, ri) {
  const m = G.teams[s].roster[ri]; if (!m || !G.powers) return null;
  const which = blRackFresh(s) ? 'strike' : 'spare', pw = m.pw || {}, P = blPowOf(m.kind, which, pw[which] === 1);
  return Object.assign({ which }, P, { cost: P.curse ? BL_MANA.curse : which === 'strike' ? BL_MANA.costStrike : BL_MANA.costSpare });
}
function blPowIdOf(s, k, ri) {
  if (k === 'pow') { const P = blPowNow(s, ri); return P ? P.id : null; }
  if (k === 'ult') return blUltOf(s, ri == null ? blBowler(s) : ri).id;
  return k;
}
// the last frame's index on the sheet in play, and whether a side's frames so far are all marks
const blOpenSoFar = s => G.fr[s].some((fr, i) => blFrameDone(fr, i === G.frames - 1) && fr[0] !== 10 && fr[0] + (fr[1] || 0) < 10);
// why a power can't be cast now ('' if it can)
function blPowWhy(s, k, ri) {
  if (!G || !G.powers || !G.powSides[s]) return 'No powers in this game.';
  if (G.over) return 'The game is over.';
  if (blUp() !== s) return 'Not your ball.';
  if (G.powOnly && G.powOnly[s] && blPowIdOf(s, k, ri) !== G.powOnly[s]) return 'Not in this game.';
  if (k === 'pow') { const P = blPowNow(s, ri == null ? blBowler(s) : ri); if (!P) return 'No power.'; if (G.powBall[s] === G.n) return 'One power a ball.'; return G.mana[s] < P.cost ? `It costs ${P.cost} mana.` : ''; }
  if (k === 'ult') { if (G.ultUsed[s]) return 'Once a game.'; if (!blRackFresh(s) || G.rb[s] || (blSheet(s)[blCur(s)] || []).length) return 'Only before a frame\'s first ball.'; if (G.mark && G.mark.f === blSlot(s, blCur(s)) && G.mark.ro === G.ro) return 'This frame already bears a mark.'; return G.roar[s] < BL_ROAR.ult ? `It takes ${BL_ROAR.ult} roar.` : ''; }
  if (k === 'steady') { if (G.steadyOn[s]) return 'Already steady.'; if (!blPressure(s)) return 'Only in the last frame.'; return G.roar[s] < BL_ROAR.steady ? `It takes ${BL_ROAR.steady} roar.` : ''; }
  const S = BL_SIT[k]; if (!S) return 'No such power.';
  if (G.sitUsed[s][k]) return 'Once a game.'; if (G.mana[s] < S.cost) return `It costs ${S.cost} mana.`;
  const f = blCur(s), n = blSheetN(), sh = blSheet(s)[f] || [];
  if (k === 'fill') return f === n - 1 && sh.length && blRackFresh(s) ? '' : 'Only in the last frame, after a strike or a spare.';
  if (k === 'clean') return !G.ro && f >= 7 && !blOpenSoFar(s) ? '' : 'Only from the 8th frame, with no open frame yet.';
  if (k === 'rolloff') return G.ro ? '' : 'Only in a roll-off.';
  return '';
}
// cast: k 'pow' (the bowler's), 'ult', 'steady' or a situation power. Returns '' or why not
function blCast(s, k, ri) {
  const r = ri == null ? blBowler(s) : ri, why = blPowWhy(s, k, r); if (why) return why;
  const name = (G.teams[s].roster[r] || {}).n || 'Someone', rec = (id, n) => G.casts.push({ side: s, k, id, n, ri: r, frame: blFrameNo(s), ball: G.n });
  if (k === 'pow') {
    const P = blPowNow(s, r); G.mana[s] -= P.cost; G.powBall[s] = G.n;
    if (P.curse) G.curse[1 - s] = Object.assign({}, P.curse, { by: P.n });
    else if (P.now && P.now.drain) { const d = Math.min(G.roar[1 - s], P.now.drain); G.roar[1 - s] -= d; G.roar[s] = Math.min(BL_ROAR.max, G.roar[s] + d); }
    else G.fx[s] = Object.assign({}, P.fx, { n: P.n });
    rec(P.id, P.n); return '';
  }
  if (k === 'ult') {
    const U = blUltOf(s, r);
    G.roar[s] -= BL_ROAR.ult; G.ultUsed[s] = true; G.mark = { side: s, f: blSlot(s, blCur(s)), ro: G.ro, id: U.id, n: U.n, own: U.own, rival: U.rival, by: name };
    rec(U.id, U.n); return '';
  }
  if (k === 'steady') { G.roar[s] -= BL_ROAR.steady; G.steadyOn[s] = true; rec('steady', 'Steady'); return ''; }
  const S = BL_SIT[k]; G.mana[s] -= S.cost; G.sitUsed[s][k] = true;
  if (k === 'fill') G.arm[s][r] = 1; else G.sitOn[s] = { id: k };
  rec(k, S.n); return '';
}
// what side s's next ball has: its power, the frame's mark, a curse on it, a situation power, the roar's steadying
function blFxFor(s) {
  const f = Object.assign({}, BL_FX0);
  if (!G || !G.powers) return f;
  const add = x => { if (!x) return; for (const k in x) { if (!(k in BL_FX0)) continue; if (BL_FX_MUL.has(k)) f[k] *= x[k]; else f[k] = Math.max(f[k], x[k]); } };
  add(G.fx[s]); add(G.curse[s]);
  const M = G.mark; if (M && M.f === blSlot(s, blCur(s)) && M.ro === G.ro) add(M.side === s ? M.own : M.rival);
  const si = G.sitOn[s]; if (si) add(si.id === 'rolloff' ? { err: .5 } : { err: .67 });
  if (G.steadyOn[s]) f.nerve = 1;
  return f;
}
// after side s's ball: what it spent goes; the mana and the roar it earned come in; a mark ends when both have bowled
function blPowersAfter(s, roll, stand, streak) {
  if (!G.powers) return;
  G.fx[s] = null; G.curse[s] = null; G.steadyOn[s] = false; G.sitOn[s] = null;
  const mana = n => { G.mana[s] = Math.min(BL_MANA.max, G.mana[s] + n); }, roar = n => { G.roar[s] = Math.min(BL_ROAR.max, G.roar[s] + n); };
  if (roll.strike) { mana(BL_MANA.strike); roar(BL_ROAR.strike + (streak >= 3 ? BL_ROAR.turkey : streak === 2 ? BL_ROAR.double : 0)); }
  if (roll.spare) { mana(BL_MANA.spare); if (blIsSplit(stand) && stand.length < 10) { mana(BL_MANA.split); roar(BL_ROAR.splitMade); } }
  const M = G.mark; if (M && (M.ro !== G.ro || [0, 1].every(k => blSlot(k, blCur(k)) > M.f || G.over))) G.mark = null;
}
// the CPU's powers before its ball (and yours under Auto in Manage), by skill. Returns the casts' names, or []
function blCpuPower(s) {
  if (!G.powers || !G.powSides[s] || G.over) return [];
  const sk = G.skill[s], ri = blBowler(s), o = 1 - s, f = blCur(s), late = G.ro || f >= G.frames - 3, gap = blTotal(o) - blTotal(s), p = blPressure(s), out = [];
  const tryCast = k => { if (!blCast(s, k, ri)) out.push(G.casts[G.casts.length - 1].n); };
  if (sk >= 1) { for (const k of ['rolloff', 'clean']) if (!blPowWhy(s, k)) tryCast(k); if (!blPowWhy(s, 'fill') && G.arm[s][ri] < .75) tryCast('fill'); }
  // (a bowler who brings an ultimate of their own rings it, whoever is bowling; otherwise the bowler's kind's)
  const own = G.teams[s].roster.findIndex(m => m && m.ult && typeof BL_ULT_OWN !== 'undefined' && BL_ULT_OWN[m.ult]), ur = own >= 0 ? own : ri;
  if (!blPowWhy(s, 'ult', ur) && (sk === 0 ? R() < .5 : sk === 1 ? gap > 0 || late : (gap > 0 && late) || f === blSheetN() - 1)) { if (!blCast(s, 'ult', ur)) out.push(G.casts[G.casts.length - 1].n); }
  if (sk >= 1 && p && !blPowWhy(s, 'steady') && blRat(s, ri).nrv < .7 && G.roar[s] >= BL_ROAR.steady + (sk >= 2 && !G.ultUsed[s] ? BL_ROAR.ult : 0)) tryCast('steady');
  const P = blPowNow(s, ri); if (!P || blPowWhy(s, 'pow', ri)) return out;
  const st = G.stand[s], worth = P.which === 'strike' ? true : st.length <= 3 || blIsSplit(st);
  const go = sk === 0 ? R() < .3 : sk === 1 ? worth && G.mana[s] >= P.cost + 1 : worth && (p > 0 || late || gap > 0) && G.mana[s] >= P.cost;
  if (go) tryCast('pow');
  return out;
}
// the bench's tip for your ball ('' when nothing stands out)
function blPowerTip(s) {
  if (!G.powers) return '';
  const ri = blBowler(s), P = blPowNow(s, ri), st = G.stand[s];
  if (!blPowWhy(s, 'fill') && G.arm[s][ri] < .75) return 'Tip: the Fill gives your bowler their arm back for the fill balls.';
  if (!blPowWhy(s, 'clean')) return 'Tip: no open frame yet; Clean Game makes this ball a third truer.';
  if (blPressure(s) && !blPowWhy(s, 'steady') && blRat(s, ri).nrv < .6) return `Tip: the game hangs on this frame; ${BL_ROAR.steady} roar steadies the ball.`;
  if (P && !blPowWhy(s, 'pow', ri)) {
    if (P.fx && P.fx.ghost && blRackFresh(s)) return `Tip: ${P.n} saves a light ball: it goes through the headpin.`;
    if (P.fx && P.fx.wobble && st.length >= 4) return `Tip: ${P.n} can shake over what the ball leaves.`;
    if (P.curse) return `Tip: ${P.n} works on their next ball.`;
    if (blIsSplit(st)) return `Tip: a split; ${P.n} helps (${P.desc.toLowerCase()})`;
  }
  if (!blPowWhy(s, 'ult', ri)) { const U = blUltOf(s, ri); return `Tip: the roar is up; ${U.n} would mark this frame.`; }
  return '';
}
