/* The Charter Court: monster powers (issue #77, phase 6), as on the gridiron, adapted to possessions.
   - Team mana (G.mana, by side): BK_MANA.start to begin, up to BK_MANA.max; a side gets BK_MANA.scored (half a mana:
     it builds over two scores) each time the other side scores on a possession, and both get BK_MANA.brk at each break
     between periods. Shown whole: a half doesn't buy anything yet.
   - Everyday powers: every kind has an offense power and a defense power (BK_POW), and a second of each (BK_POW2); a
     player brings one of each pair (m.pw: { off, def }, 0 or 1; picked on the Court tab). A side casts at most one a
     possession, at its start: the offense one of its five's offense powers, the defense one of theirs. Each costs mana,
     and stamina from the player who casts it (BK_POW_STA); a player below BK_POW_STA.min can't.
   - Spirit (G.spirit, by side, 0 to BK_SPIRIT.max): the crowd's roar fills it on big plays (a dunk, a three, a block, a
     steal), on a run, and on the Charter Court's own roar. It pays for the ultimate (BK_SPIRIT.ult), or keeps a hot
     hand burning one miss longer (BK_SPIRIT.keep, spent by itself when someone on fire misses).
   - The ultimate: one per kind (BK_ULT), once a game per side, for spirit, no mana. It leaves a zone on the floor
     (G.zones) for BK_ULT_POSS possessions it acts on (one with effects only on defense, say, lasts three of the
     other side's possessions); a zone acts at the end its side is at (o: on offense, d: on defense).
   - Situation powers (BK_SIT), the team's, once a game each, for mana, when the moment fits: Clutch (the last 30
     seconds of a close game: every shot a little better to the end), Full-court press (behind by 8 or more: a zone of
     pressure for three possessions), Ice it (their free throws, once: every one less likely). G.sitUsed by side.
   - Who casts: the CPU by its skill (a Squire now and then at random, a Knight what suits its set, or anything with
     mana to spare, keeping a mana back early; an Archmage only
     that, saving spirit for a close finish or a run against it); your side the same way under Auto powers (GD.auto, on
     unless you turn it off), or the power you queue (GD.pow, for your next possession at that end), and your ultimate
     when you press it.
   - On the floor every power is one set of effects (BK_FX0), merged at the start of each possession into G.cur.fx (from
     both sides' casts and the zones): multipliers multiply, the rest add. bkFx(k) reads it.
   G.cur.cast: [{ side, ri, id, n, ult?, sit? }, ...] what was cast on this possession, for the line and the panel.
   The superstars' ratings and powers are added after these parts load (src/realm/court/c0-stars.js). */
const BK_MANA = { start: 2, max: 6, scored: .5, brk: 1 };
const BK_POW_STA = { min: 20, base: 10, per: 5, ult: 25 };
const BK_SPIRIT = { max: 100, ult: 60, keep: 25, dunk: 12, three: 8, block: 10, steal: 5, run: 2, runAt: 5, roar: 12 };
const BK_ULT_POSS = 3;
/* the effects at none: shot, three, rim, ft (added to the offense's odds), con (the defense's contest), stl (steals off
   passes and the dribble), blk (blocks), lane (how wide a defender blocks a drive), oSpd and dSpd (speed), reb and dreb
   (each side's rebounding), beat (beating a man off the dribble), cut (cuts to the rim), oop (alley-oops from anywhere
   inside the arc), wall (screens nobody gets over), fade (screens that fail: the defender floats through), stunD and
   stunO (seconds the defense or the offense is frozen at the start), staO and staD (stamina back for the five) */
const BK_FX0 = { shot: 0, three: 0, rim: 0, ft: 0, con: 1, stl: 1, blk: 1, lane: 0, oSpd: 1, dSpd: 1, reb: 1, dreb: 1, beat: 0, cut: 1, oop: 0, wall: 0, fade: 0, stunD: 0, stunO: 0, staO: 0, staD: 0 };
const BK_FX_MUL = new Set(['con', 'stl', 'blk', 'oSpd', 'dSpd', 'reb', 'dreb', 'cut']);
const bkP = (id, n, cost, fits, desc, fx) => ({ id, n, cost, fits, desc, fx });
// fits: the sets a power suits ('shot': Spread, Motion and Feed the hot hand; 'drive': Isolation, Post up and Pick and
// roll; 'pass': Motion and Pick and roll; 'any')
const BK_FITS = { shot: ['spread', 'motion', 'hot'], drive: ['iso', 'post', 'pick'], pass: ['motion', 'pick'], any: null };
// everyday powers by kind: [offense, defense]
const BK_POW = {
  goblin: [bkP('sleight', 'Sleight of Hand', 1, 'drive', 'The dribble on a string: half as likely to be picked, and moves beat a man more often.', { stl: .5, beat: .12 }), bkP('pickpocket', 'Pickpocket', 1, 'any', 'Quick fingers: 70% more steals, off passes and the dribble.', { stl: 1.7 })],
  kobold: [bkP('sling', 'Sling Pass', 1, 'pass', 'Passes zip: half as many are picked off.', { stl: .5 }), bkP('firebreath', 'Fire Breath', 1, 'shot', 'A breath of fire on every shooter: the contest a fifth stronger.', { con: 1.2 })],
  werewolf: [bkP('sprint', 'Wolf Sprint', 1, 'drive', 'On all fours: the offense is 10% faster.', { oSpd: 1.1 }), bkP('pounce', 'Pounce', 1, 'any', 'The defense springs: 10% faster, and more steals.', { dSpd: 1.1, stl: 1.3 })],
  dwarf: [bkP('deeprange', 'Deep Range', 1, 'shot', 'Hard hands, true aim: threes 6 points likelier.', { three: .06 }), bkP('shieldline', 'Shield Line', 1, 'drive', 'Shields across the lane: drives run into a defender far more.', { lane: .5 })],
  ogre: [bkP('bulldoze', 'Bulldoze', 2, 'drive', 'Through the lane like a cart: shots at the rim 10 points likelier.', { rim: .1 }), bkP('smother', 'Smother', 2, 'any', 'A wall of ogre on every shot: the contest a third stronger.', { con: 1.33 })],
  minotaur: [bkP('bulldrive', 'Bull Drive', 1, 'drive', 'Horns down: beat a man more often, and finish a little better at the rim.', { beat: .15, rim: .04 }), bkP('gore', 'Gore', 1, 'any', 'Horns up at the rim: half again as many blocks.', { blk: 1.5 })],
  troll: [bkP('putback', 'Putback', 1, 'any', 'Long arms on the offensive glass: half again the rebounds there.', { reb: 1.5 }), bkP('regen', 'Regenerate', 1, 'any', 'Troll blood: the five get 8 stamina back, and block a little more.', { staD: 8, blk: 1.2 })],
  golem: [bkP('rampart', 'Rampart', 1, 'pass', 'A screen nobody can go over: every pick leaves the defender stuck behind it.', { wall: 1 }), bkP('stonewall', 'Stone Wall', 2, 'drive', 'The paint turns to stone: drives blocked, and shots at the rim 6 points harder.', { lane: .4, rim: -.06 })],
  harpy: [bkP('skyhook', 'Skyhook', 2, 'pass', 'An alley-oop from anywhere inside the arc, to anyone.', { oop: 1 }), bkP('swoop', 'Swoop', 1, 'shot', 'Down from above on the shooters: half again the blocks.', { blk: 1.6 })],
  elf: [bkP('trueaim', 'True Aim', 1, 'shot', 'Every shot 5 points likelier.', { shot: .05 }), bkP('eagleeye', 'Eagle Eye', 1, 'pass', 'Reads every pass: 40% more steals.', { stl: 1.4 })],
  wraith: [bkP('phase', 'Phase', 1, 'pass', 'Cutters slip through bodies: twice the cuts, and the contest a fifth weaker.', { cut: 2, con: .8 }), bkP('fade', 'Fade', 1, 'pass', 'Through every screen like smoke: their picks get nobody open.', { fade: 1 })],
  vampire: [bkP('mesmer', 'Mesmerize', 2, 'drive', 'The defense freezes for a second at the start.', { stunD: 1 }), bkP('drain', 'Drain', 1, 'any', 'Feeds on the offense: the defense gets 6 stamina back, and the offense is a little slower.', { staD: 6, oSpd: .95 })],
  lich: [bkP('telekinesis', 'Telekinesis', 1, 'shot', 'The ball is guided in: jumpers and threes 4 points likelier.', { shot: .04 }), bkP('chill', 'Chill', 1, 'any', 'A frost on the floor: the offense is 12% slower.', { oSpd: .88 })],
  zombie: [bkP('relentless', 'Relentless', 1, 'any', 'They keep coming: offensive rebounds 40% likelier.', { reb: 1.4 }), bkP('horde', 'Horde', 1, 'any', 'Bodies everywhere: the contest a little stronger, and the boards.', { con: 1.15, dreb: 1.2 })],
  gorgon: [bkP('glance', 'Stone Glance', 2, 'shot', 'A look that stiffens defenders: the contest 40% weaker.', { con: .6 }), bkP('stare', 'Stare', 2, 'shot', 'The shooter freezes mid-release: every shot 8 points less likely.', { shot: -.08 })],
  spider: [bkP('sticky', 'Sticky Hands', 1, 'pass', 'Webbed fingers: passes are hardly ever picked off.', { stl: .4 }), bkP('web', 'Web', 1, 'pass', 'Threads across the floor: the offense slower, and far fewer cuts.', { oSpd: .92, cut: .4 })],
  skeleton: [bkP('rattle', 'Rattle', 1, 'any', 'Bones knock the rim kindly: free throws 15 points likelier, every shot a little.', { ft: .15, shot: .02 }), bkP('boneblock', 'Bone Block', 1, 'any', 'Rattling arms: nearly twice the blocks.', { blk: 1.8 })],
  witch: [bkP('hex', 'Hex', 1, 'shot', 'A hex on the defense: the contest 30% weaker.', { con: .7 }), bkP('curse', 'Curse', 1, 'shot', 'A curse on the ball: every shot 5 points less likely.', { shot: -.05 })],
};
// the second powers (issue #61's choice): [offense, defense]
const BK_POW2 = {
  goblin: [bkP('scurry', 'Scurry', 1, 'drive', 'Darting everywhere: the offense 8% faster.', { oSpd: 1.08 }), bkP('trip', 'Trip Wire', 1, 'drive', 'A foot in the lane: drives stopped more often.', { lane: .35 })],
  kobold: [bkP('blastjump', 'Blast Jump', 1, 'drive', 'Up on a puff of smoke: shots at the rim 7 points likelier.', { rim: .07 }), bkP('smoke', 'Smokescreen', 1, 'pass', 'Smoke over the floor: passes picked off a third more.', { stl: 1.35 })],
  werewolf: [bkP('howl', 'Howl', 1, 'any', 'A howl that shakes the defense: the contest a fifth weaker.', { con: .8 }), bkP('hunt', 'Hunt', 1, 'drive', 'Run them down: the defense 12% faster.', { dSpd: 1.12 })],
  dwarf: [bkP('anvil', 'Anvil Hands', 1, 'any', 'Nothing gets loose: half as many steals, and free throws better.', { stl: .5, ft: .08 }), bkP('dig', 'Dig In', 1, 'any', 'Feet planted: the contest a little stronger, and the boards.', { con: 1.12, dreb: 1.25 })],
  ogre: [bkP('stomp', 'Stomp', 2, 'any', 'A stomp at the start: the defense frozen for a second.', { stunD: 1 }), bkP('fling', 'Fling', 2, 'any', 'Bodies thrown off the glass: the defense takes far more rebounds.', { dreb: 1.6 })],
  minotaur: [bkP('charge', 'Charge', 1, 'drive', 'Head down for the rim: beat a man far more often.', { beat: .22 }), bkP('maze', 'Maze', 1, 'drive', 'The lane winds and narrows: drives blocked more.', { lane: .45 })],
  troll: [bkP('lumber', 'Lumber', 1, 'any', 'Slow and huge: offensive rebounds, and the five get 6 stamina back.', { reb: 1.3, staO: 6 }), bkP('club', 'Club Swing', 1, 'any', 'A swing at the ball: more blocks and more steals.', { blk: 1.3, stl: 1.2 })],
  golem: [bkP('cornerstone', 'Cornerstone', 1, 'drive', 'Planted under the rim: shots there 6 points likelier, and the boards.', { rim: .06, reb: 1.2 }), bkP('weight', 'Dead Weight', 1, 'any', 'Leaning on everyone: the offense 8% slower.', { oSpd: .92 })],
  harpy: [bkP('gust', 'Gust', 1, 'shot', 'A tailwind for the shot: threes 5 points likelier.', { three: .05 }), bkP('talons', 'Talons', 1, 'pass', 'Snatching from the air: steals a third more.', { stl: 1.33 })],
  elf: [bkP('swift', 'Swift', 1, 'drive', 'Light feet: the offense 8% faster, and better off the dribble.', { oSpd: 1.08, beat: .06 }), bkP('thorns', 'Thorn Ward', 1, 'drive', 'Thorns in the paint: shots at the rim 7 points harder.', { rim: -.07 })],
  wraith: [bkP('wail', 'Wail', 2, 'any', 'A wail at the start: the defense frozen for a second.', { stunD: 1 }), bkP('chillgrip', 'Chill Grip', 1, 'any', 'Cold hands on every ball: steals a quarter more, and the offense slower.', { stl: 1.25, oSpd: .95 })],
  vampire: [bkP('blooddrive', 'Blood Drive', 1, 'drive', 'Faster for the feast: the offense 10% faster.', { oSpd: 1.1 }), bkP('batcloud', 'Bat Cloud', 1, 'shot', 'Bats around every shooter: the contest a fifth stronger.', { con: 1.2 })],
  lich: [bkP('arcane', 'Arcane Arc', 1, 'shot', 'The ball curves home: threes 6 points likelier.', { three: .06 }), bkP('ward', 'Ward', 1, 'drive', 'A ward over the rim: shots there 6 points harder.', { rim: -.06 })],
  zombie: [bkP('grab', 'Grab', 1, 'drive', 'Hold on and pull through: shots at the rim 6 points likelier.', { rim: .06 }), bkP('shamble', 'Shamble', 1, 'any', 'Slow bodies in the way: the offense 7% slower.', { oSpd: .93 })],
  gorgon: [bkP('serpent', 'Serpent Strike', 1, 'drive', 'Snakes lash the defender: beat a man more often, at the rim better.', { beat: .12, rim: .04 }), bkP('coil', 'Coil', 1, 'any', 'Coils on the ball: steals a third more.', { stl: 1.33 })],
  spider: [bkP('silk', 'Silk Line', 1, 'pass', 'A thread to the cutter: twice the cuts.', { cut: 2 }), bkP('venom', 'Venom', 1, 'any', 'A bite in the lane: the offense frozen at the start for a moment.', { stunO: .6 })],
  skeleton: [bkP('rattlebones', 'Rattlebones', 1, 'shot', 'A clatter that rattles the defense: the contest a fifth weaker.', { con: .8 }), bkP('marrow', 'Marrow Chill', 1, 'any', 'A chill in the bones: every shot 4 points less likely.', { shot: -.04 })],
  witch: [bkP('brew', 'Brew', 1, 'any', 'A sip for the five: 8 stamina back, and a little on every shot.', { staO: 8, shot: .02 }), bkP('jinx', 'Jinx', 1, 'any', 'A jinx at the line and everywhere: free throws 12 points less likely, shots a little.', { ft: -.12, shot: -.02 })],
};
// the ultimates: { o: effects while its side has the ball, d: while it defends }, and how its zone looks [colour, area]
const bkU0 = (id, n, desc, o, d, vis) => ({ id, n, desc, o: o || {}, d: d || {}, vis });
const BK_ULT = {
  goblin: bkU0('den', 'Thieves\' Den', 'Every ball is up for grabs: their passes and dribbles picked off twice as often.', null, { stl: 2.2 }, ['#7fae4e', 'half']),
  kobold: bkU0('firewall', 'Firewall', 'Fire across the paint: their shots at the rim 12 points harder.', null, { rim: -.12 }, ['#ff6a2a', 'paint']),
  werewolf: bkU0('fullmoon', 'Full Moon', 'Under the moon your five are 12% faster, at both ends, and own the boards.', { oSpd: 1.12, reb: 1.3 }, { dSpd: 1.12, dreb: 1.3 }, ['#d9d2a8', 'all']),
  dwarf: bkU0('forge', 'Forge Floor', 'A forge-warm floor: every shot 6 points likelier for your side.', { shot: .06 }, null, ['#ffb070', 'half']),
  ogre: bkU0('quake', 'Earthquake', 'The floor heaves at every start: their five frozen for a second.', { stunD: 1 }, { stunO: 1 }, ['#8f9d58', 'all']),
  minotaur: bkU0('labyrinth', 'Labyrinth', 'Walls in their lane: drives blocked far more often.', null, { lane: .8 }, ['#70442a', 'paint']),
  troll: bkU0('regrowth', 'Regrowth', 'Moss and blood: your five get 6 stamina back every possession.', { staO: 6 }, { staD: 6 }, ['#5f7f8a', 'all']),
  golem: bkU0('stonecircle', 'Stone Circle', 'Standing stones round the rim: your shots there 12 points likelier, and the boards are yours.', { rim: .12, reb: 1.4 }, { dreb: 1.4 }, ['#8e8d86', 'paint']),
  harpy: bkU0('gale', 'Gale', 'A wind for your shooters: threes 8 points likelier.', { three: .08 }, null, ['#dcc3a2', 'arc']),
  elf: bkU0('moonlit', 'Moonlit Court', 'Silver light on your shots: every shot 5 points likelier, free throws 10.', { shot: .05, ft: .1 }, null, ['#bfe0ff', 'all']),
  wraith: bkU0('mist', 'Mist', 'A mist they can\'t see through: their contest 40% weaker.', { con: .6 }, null, ['#9ff6ff', 'all']),
  vampire: bkU0('nightfeast', 'Night Feast', 'Your defense feeds: steals far more often, and 5 stamina back each time.', null, { stl: 1.8, staD: 5 }, ['#a0203a', 'half']),
  lich: bkU0('frostring', 'Frost Ring', 'Frost on the floor: they are 15% slower.', null, { oSpd: .85 }, ['#7fd4ff', 'all']),
  zombie: bkU0('graverise', 'Grave Rise', 'Hands from the boards: your side takes far more rebounds, both ends.', { reb: 1.6 }, { dreb: 1.6 }, ['#7f9c79', 'paint']),
  gorgon: bkU0('stonecourt', 'Stone Court', 'Statues where they shoot: every shot of theirs 6 points less likely.', null, { shot: -.06 }, ['#6fa57d', 'half']),
  spider: bkU0('webpaint', 'Web', 'A web over the paint: they are a fifth slower and hardly cut.', null, { oSpd: .8, cut: .2 }, ['#c9c0d8', 'paint']),
  skeleton: bkU0('bonewall', 'Bone Wall', 'A wall of bones under the rim: twice the blocks.', null, { blk: 2 }, ['#ebe5d2', 'paint']),
  witch: bkU0('hexhoop', 'Hex Hoop', 'Their hoop is hexed: every shot of theirs 8 points less likely.', null, { shot: -.08 }, ['#6ad8ff', 'half']),
};
// the situation powers: the team's, once a game each, for mana, when the moment fits
const BK_SIT = {
  clutch: { id: 'clutch', n: 'Clutch', cost: 2, desc: 'The last 30 seconds of a close game: every shot a little better, to the end.', when: 'In the last 30 seconds, within 4.', o: { shot: .06 }, poss: 99 },
  fullpress: { id: 'fullpress', n: 'Full-court Press', cost: 1, desc: 'Behind by 8 or more: pressure all over the floor for three of their possessions, steals twice as likely and the offense slower.', when: 'Behind by 8 or more.', d: { stl: 2, oSpd: .9 }, poss: 3 },
  iceit: { id: 'iceit', n: 'Ice It', cost: 1, desc: 'Their free throws, once a game: every one of the trip 20 points less likely.', when: 'At their free throws.', ft: -.2 },
};
const BK_POW_BY = {}; for (const T of [BK_POW, BK_POW2]) for (const k in T) for (const p of T[k]) BK_POW_BY[p.id] = p;
const BK_ULT_BY = {}; for (const k in BK_ULT) BK_ULT_BY[BK_ULT[k].id] = BK_ULT[k];
// the power a player brings for a role ('off' | 'def'): the first of the pair, or the second if they picked it
const bkPowFor = (m, role) => { const i = role === 'off' ? 0 : 1, two = BK_POW2[m.kind]; return two && m.pw && m.pw[role] === 1 ? two[i] : BK_POW[m.kind] && BK_POW[m.kind][i]; };

function bkPowersStart(on) {
  G.powers = on !== false;
  G.mana = [BK_MANA.start, BK_MANA.start]; G.spirit = [0, 0]; G.zones = []; G.ultUsed = [false, false]; G.sitUsed = [{}, {}]; G.kept = [{}, {}];
}
const bkManaAdd = (s, n) => { if (G.mana && G.powers) G.mana[s] = clamp(G.mana[s] + n, 0, BK_MANA.max); };
// (spirit belongs to powers: a game without them has none)
function bkSpiritAdd(s, n) { if (G.spirit && G.powers) G.spirit[s] = clamp(G.spirit[s] + n, 0, BK_SPIRIT.max); }
// the merged effects for this possession (G.cur.fx), or one of them
function bkFx(k) { const F = G.cur && G.cur.fx; return F && F[k] != null ? F[k] : BK_FX0[k]; }
function bkFxMerge(F, fx) { for (const k in fx || {}) { if (!(k in BK_FX0)) continue; F[k] = BK_FX_MUL.has(k) ? F[k] * fx[k] : F[k] + fx[k]; } return F; }
/* the powers a side could cast now, at the start of a possession at its end of the floor: one per player on the floor
   (their kind's power for the role), and whether each can go ({ ri, id, n, cost, fits, desc, ok, why }) */
function bkPowerOptions(side) { return G.powers && G.cur ? bkPowerList(side, G.cur.side === side ? 'off' : 'def') : []; }
// a side's ultimate now: the best one on its floor (the CPU's choice), or the one of player ri; { ri, id, n, desc, ok, why }
function bkUltOptions(side) {
  if (!G.powers) return [];
  const T = G.teams[side];
  return G.on[side].map(ri => { const m = T.roster[ri], u = BK_ULT[m.kind]; if (!u) return null;
    const why = G.ultUsed[side] ? 'used this game' : G.spirit[side] < BK_SPIRIT.ult ? `the crowd needs to be louder (spirit ${Math.round(G.spirit[side])} of ${BK_SPIRIT.ult})` : '';
    return { ri, id: u.id, n: u.n, desc: u.desc, who: m.n, ok: !why, why }; }).filter(Boolean);
}
// the situation powers a side may cast now: { id, n, desc, cost, ok, why }
function bkSitOptions(side) {
  if (!G.powers || !G.cur) return [];
  const lead = bkLead(side), close = G.q >= BK_RULES.quarters && G.clock <= 30 && Math.abs(lead) <= 4;
  const ok = { clutch: close && G.cur.side === side, fullpress: lead <= -8 && G.cur.side !== side, iceit: GD.ph === 'ft' && GD.ft && GD.ft.side !== side };
  return Object.values(BK_SIT).map(s => { const why = G.sitUsed[side][s.id] ? 'used this game' : !ok[s.id] ? s.when : G.mana[side] < s.cost ? 'not enough mana' : '';
    return { id: s.id, n: s.n, desc: s.desc, cost: s.cost, ok: !why, why }; });
}
/* the start of a possession (from bkPossStart, after the calls): each side casts (the CPU, Auto powers, or your queued
   power), the zones tick down, and the possession's effects are merged */
function bkPowersPoss() {
  const C = G.cur; C.cast = []; C.fx = Object.assign({}, BK_FX0);
  if (!G.powers) return;
  // (a zone counts the possessions it acted on: one with effects only at one end lasts that many of those)
  for (const z of G.zones) if (z.acted) { z.left--; z.acted = false; }
  G.zones = G.zones.filter(z => z.left > 0);
  for (const side of [C.side, 1 - C.side]) {
    const mine = GD.mode !== 'watch' && side === GD.you;
    // your queued power (it waits for a possession at its end), or the coach's choice
    const role = side === C.side ? 'off' : 'def', q = mine && GD.pow && GD.pow[role];
    if (q && !G.on[side].includes(q.ri)) GD.pow[role] = null;
    if (q) { const o = bkPowerOptions(side).find(x => x.id === q.id && x.ri === q.ri && x.ok); if (o) { bkCast(side, o); GD.pow[role] = null; continue; } }
    if (mine && !GD.auto) continue;
    const sk = mine ? 1 : G.skill[side];
    const sit = bkCpuSit(side, sk); if (sit) bkCastSit(side, sit);
    const u = bkCpuUlt(side, sk); if (u) bkCastUlt(side, u);
    const o = bkCpuPower(side, sk); if (o) bkCast(side, o);
  }
  bkFxNow();
  // (the start's freezes and stamina: now if play is already live, a steal or a rebound; else when it goes live)
  if (GD.ph === 'live') { bkFxStart(); C.started = true; } else C.started = false;
}
// the possession's effects again (pure: a cast mid-possession merges again, nothing fires twice): both casts, then every
// zone at the end its side is at
function bkFxNow() {
  const C = G.cur, F = Object.assign({}, BK_FX0);
  for (const c of C.cast) { const p = c.sit ? null : !c.ult && BK_POW_BY[c.id]; if (p) bkFxMerge(F, p.fx); }
  for (const z of G.zones) { const U0 = BK_ULT_BY[z.id] || BK_SIT[z.id], e = U0 && (z.side === C.side ? U0.o : U0.d); if (e && Object.keys(e).length) { bkFxMerge(F, e); z.acted = true; } }
  C.fx = F;
}
// the start of a possession: frozen bodies and stamina back, once
function bkFxStart() {
  const C = G.cur, F = C.fx;
  if (L && L.pl) for (const p of L.pl) { const off = p.side === C.side; if (off && F.stunO) p.stun = Math.max(p.stun, F.stunO); if (!off && F.stunD) p.stun = Math.max(p.stun, F.stunD); }
  if (G.stam) for (const s of [0, 1]) { const add = s === C.side ? F.staO : F.staD; if (add) for (const ri of G.on[s]) G.stam[s][ri] = Math.min(100, G.stam[s][ri] + add); }
}
function bkCast(side, o) {
  const p = BK_POW_BY[o.id]; if (!p) return false;
  G.mana[side] -= p.cost; if (G.stam) G.stam[side][o.ri] = Math.max(0, G.stam[side][o.ri] - (BK_POW_STA.base + BK_POW_STA.per * p.cost));
  G.cur.cast.push({ side, ri: o.ri, id: p.id, n: p.n, who: G.teams[side].roster[o.ri].n });
  bkEv('pow', p.n, G.teams[side].roster[o.ri].n);
  return true;
}
function bkCastUlt(side, o) {
  const u = BK_ULT_BY[o.id]; if (!u || G.ultUsed[side] || G.spirit[side] < BK_SPIRIT.ult) return false;
  G.spirit[side] -= BK_SPIRIT.ult; G.ultUsed[side] = true;
  if (G.stam) G.stam[side][o.ri] = Math.max(0, G.stam[side][o.ri] - BK_POW_STA.ult);
  G.zones.push({ id: u.id, side, left: BK_ULT_POSS, n: u.n, acted: false });
  G.cur.cast.push({ side, ri: o.ri, id: u.id, n: u.n, who: G.teams[side].roster[o.ri].n, ult: true })
  GD.msg = `${GD.msg ? GD.msg + ' ' : ''}${G.teams[side].roster[o.ri].n}: ${u.n}! ${u.desc}`; if (!GD.big) GD.big = { k: 'ult' };
  bkEv('ult', u.n, G.teams[side].name);
  return true;
}
function bkCastSit(side, id) {
  const s = BK_SIT[id]; if (!s || G.sitUsed[side][id] || G.mana[side] < s.cost) return false;
  G.mana[side] -= s.cost; G.sitUsed[side][id] = true;
  if (s.o || s.d) G.zones.push({ id, side, left: s.poss, n: s.n, acted: false });
  if (s.ft && GD.ft) GD.ft.ice = s.ft;
  if (G.cur) G.cur.cast.push({ side, id, n: s.n, who: G.teams[side].name, sit: true })
  GD.msg = `${GD.msg ? GD.msg + ' ' : ''}${G.teams[side].name}: ${s.n}. ${s.desc}`;
  bkEv('sit', s.n, G.teams[side].name);
  return true;
}
// (a zone cast mid-possession: it acts at once, but the rest of this possession isn't one of its three)
function bkFreshZone() { const z = G.zones[G.zones.length - 1]; if (z) z.acted = false; }
// your side, by hand: queue a power for the next possession at its end (ri and id from bkPowerOptions), cast your
// ultimate now (it starts with the next possession), or a situation power now ('' or why not)
function bkPowQueue(role, ri, id) {
  if (!G.powers) return 'Powers are off.'; if (role !== 'off' && role !== 'def') return 'No such end.';
  GD.pow = GD.pow || {}; GD.pow[role] = ri == null ? null : { ri, id }; return '';
}
// side's powers for an end, whatever end it's at now (the panel lists both; bkPowerOptions is the end it's at)
function bkPowerList(side, role) {
  if (!G.powers) return [];
  const T = G.teams[side];
  return G.on[side].map(ri => { const m = T.roster[ri], p = bkPowFor(m, role); if (!p) return null;
    const st = G.stam ? G.stam[side][ri] : 100, why = G.mana[side] < p.cost ? 'not enough mana' : st < BK_POW_STA.min ? `${m.n} is too tired` : '';
    return { ri, id: p.id, n: p.n, cost: p.cost, fits: p.fits, desc: p.desc, who: m.n, kind: m.kind, ok: !why, why }; }).filter(Boolean);
}
function bkUltNow(side, ri) {
  const o = bkUltOptions(side).find(x => x.ri === ri) || bkUltOptions(side)[0]; if (!o) return 'No ultimate.';
  if (!o.ok) return o.why;
  bkCastUlt(side, o); bkFxNow(); bkFreshZone(); return '';
}
function bkSitNow(side, id) {
  const o = bkSitOptions(side).find(x => x.id === id); if (!o) return 'No such power.';
  if (!o.ok) return o.why;
  bkCastSit(side, id); bkFxNow(); bkFreshZone(); return '';
}
/* ---------- the coaches cast ---------- */
const bkFits = (p, set) => !BK_FITS[p.fits] || BK_FITS[p.fits].includes(set);
function bkCpuPower(side, sk) {
  const opts = bkPowerOptions(side).filter(o => o.ok); if (!opts.length) return null;
  // (a defense power suits the set it defends against; an offense power the set it runs)
  const set = G.cur.off;
  if (!sk) return R() < .3 ? pick(opts) : null;
  // a Knight casts what suits the set, or anything when it has mana to spare, keeping a mana back early; an Archmage
  // only what suits it, keeping enough back to cast it again
  const fit = opts.filter(o => bkFits(o, set)), pool = sk >= 2 ? fit : fit.length ? fit : opts.filter(o => G.mana[side] - o.cost >= 2);
  if (!pool.length) return null;
  const keep = sk >= 2 ? Math.min(...pool.map(o => o.cost)) : 1;
  const can = pool.filter(o => G.mana[side] - o.cost >= (bkLate(.5) ? 0 : keep));
  if (!can.length || R() < (sk >= 2 ? .15 : .35)) return null;
  return can.sort((a, b) => b.cost - a.cost)[0];
}
function bkCpuUlt(side, sk) {
  const opts = bkUltOptions(side).filter(o => o.ok); if (!opts.length) return null;
  if (!sk) return R() < .5 ? pick(opts) : null;
  const lead = bkLead(side), late = bkLate(.6), run = G.run.side === 1 - side ? G.run.pts : 0;
  // a Knight whenever it can once it's behind or late; an Archmage for a close finish or to stop a run
  if (sk >= 2 ? ((late && Math.abs(lead) <= 6) || run >= 8) : (lead < 0 || late)) return opts.sort((a, b) => (G.teams[side].roster[b.ri].r.siz) - (G.teams[side].roster[a.ri].r.siz))[0];
  return null;
}
function bkCpuSit(side, sk) {
  if (!sk) return null;
  const o = bkSitOptions(side).filter(x => x.ok && x.id !== 'iceit');
  return o.length ? o[0].id : null;
}
// at their free throws a Knight or better ices them (when it can), yours under Auto powers; called as the trip is set up,
// before its beat (GD.ft is there; the phase isn't 'ft' yet)
function bkCpuIceAt(shooter) {
  const side = 1 - shooter, mine = GD.mode !== 'watch' && side === GD.you, sk = mine ? (GD.auto ? 1 : 0) : G.skill[side];
  if (!sk || !G.powers) return;
  if (G.sitUsed[side].iceit || G.mana[side] < BK_SIT.iceit.cost || !GD.ft) return;
  if (sk >= 2 || bkLate(.5)) bkCastSit(side, 'iceit');
}
/* ---------- spirit ---------- */
// a big play fills its side's spirit; so does a run, a point a time past BK_SPIRIT.runAt
function bkSpiritShot(S) {
  if (!G.spirit) return;
  if (S.made && S.dunk) bkSpiritAdd(S.side, BK_SPIRIT.dunk);
  if (S.made && S.pts === 3) bkSpiritAdd(S.side, BK_SPIRIT.three);
  if (S.block) bkSpiritAdd(1 - S.side, BK_SPIRIT.block);
  if (S.made && G.run.side === S.side && G.run.pts >= BK_SPIRIT.runAt) bkSpiritAdd(S.side, BK_SPIRIT.run * S.pts);
}
// someone on fire misses: their side's spirit keeps the fire going, once a streak (G.kept), if there is enough of it,
// and never when it would leave too little for an ultimate it could pay for now
function bkSpiritKeep(p) {
  const s = p.side, sp = G.spirit ? G.spirit[s] : 0;
  if (!G.powers || sp < BK_SPIRIT.keep || (G.kept && G.kept[s][p.ri])) return false;
  if (!G.ultUsed[s] && sp >= BK_SPIRIT.ult && sp - BK_SPIRIT.keep < BK_SPIRIT.ult) return false;
  G.spirit[s] -= BK_SPIRIT.keep; G.kept[s][p.ri] = true; bkEv('keep', p.n); return true;
}
