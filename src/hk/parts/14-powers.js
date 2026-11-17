/* Black Ice: monster powers (issue #83, phase 7), as on the court, adapted to play that never stops.
   - Team mana (G.mana, by side): HK_MANA.start to begin, up to HK_MANA.max; one comes back every HK_MANA.every
     seconds of play, a side gets HK_MANA.scored each time it is scored on, and both get HK_MANA.brk at each break.
   - Everyday powers: every kind has a puck power and a checking power (HK_POW), and a second of each (HK_POW2); a
     player brings one of each pair (m.pw: { puck, chk }, 0 or 1; picked on the Rink tab). A skater on the ice casts
     theirs in live play: the puck power while their side has the puck, the checking power while it doesn't. It costs
     mana, and stamina from the caster (HK_POW_STA; a skater below HK_POW_STA.min can't), and lasts HK_POW_SECS seconds
     of play. A side has one everyday power going at a time.
   - Spirit (G.spirit, by side, 0 to HK_SPIRIT.max): the bank's roar fills it on shots on goal, hits, saves and goals,
     and on the Pond Rink's own roar. It pays for the ultimate (HK_SPIRIT.ult), or lifts a spent line for one more
     shift (HK_SPIRIT.lift, spent by itself when the skaters on the ice are spent and nobody fresh is waiting).
   - The ultimate: one per kind (HK_ULT), once a game per side, for spirit, no mana. It leaves a mark on the ice
     (G.marks) for HK_ULT_SECS seconds of play; while it lasts its side has one set of effects with the puck (o) and
     another without it (d).
   - Situation powers (HK_SIT), the team's, once a game each, for mana, when the moment fits: Man up (on the power
     play), Kill it (a skater short), Empty net (your goalie pulled: the skaters on the ice get their legs back) and
     Sudden death (overtime: everyone fresh).
   - Who casts: the CPU by its skill (a Squire now and then at random; a Knight when the puck is in the right end,
     what suits its system first, keeping a mana back early; an Archmage only then, and saving spirit for a close
     finish or when behind); your side the same way under Auto powers (GD.autoPow, on unless you turn it off), or the
     power you press.
   - On the ice every power is one set of effects (HK_FX0), merged for each side from what it has going (hkFxMerge:
     multipliers multiply, the rest add). hkFx(side, k) reads it.
   G.fxs: [{ side, k: 'pow' | 'ult' | 'sit', id, n, ri, t, role }], what is going now. G.casts: every cast, for the
   line and the lab. The superstars' ratings and powers are added after these parts load (src/realm/rink/k0-stars.js). */
const HK_MANA = { start: 4, max: 8, scored: 1, brk: 2, every: 30 };
// how strong every power is: each effect is this many times as far from doing nothing as its table says (1.5 since
// the first games by hand: powers were worth too little to notice)
const HK_POW_K = 1.5;
const HK_POW_STA = { min: .25, base: .06, per: .04, ult: .18 };
const HK_POW_SECS = 10, HK_ULT_SECS = 16;
const HK_SPIRIT = { max: 100, ult: 50, lift: 25, liftSta: .3, sog: 5, hit: 7, save: 4, goal: 18, roar: 14 };
/* the effects at none. Added: shot (this side's shots beat the goalie more), miss (they miss the net more: negative is
   truer), one (its one-timers), save (their shots beat this side's goalie less), wild (their shots miss more), guard
   (pokes at this side's carrier: negative is safer), poke (this side's pokes). Multiplied: spd (this side's speed),
   slow (theirs), safe (how often this side's passes are picked off), pick (how often it picks theirs off), hit (its
   body checks land), wall (theirs land on its carrier), block (its shot blocks), reb (loose pucks it wins), tire (how
   fast it tires), blind (how well their goalie is set for its shots). */
const HK_FX0 = { shot: 0, miss: 0, one: 0, save: 0, wild: 0, guard: 0, poke: 0, spd: 1, slow: 1, safe: 1, pick: 1, hit: 1, wall: 1, block: 1, reb: 1, tire: 1, blind: 1 };
const HK_FX_MUL = new Set(['spd', 'slow', 'safe', 'pick', 'hit', 'wall', 'block', 'reb', 'tire', 'blind']);
const hkP = (id, n, cost, fits, desc, fx) => ({ id, n, cost, fits, desc, fx });
// fits: the systems a power suits (with the puck: an HK_ATT id; without it: an HK_DEF id; 'any')
// everyday powers by kind: [puck, checking]
const HK_POW = {
  goblin: [hkP('string', 'Puck on a String', 1, 'cycle', 'Quick hands: the puck is much harder to poke away, and passes get through.', { guard: -.08, safe: .6 }), hkP('pickpocket', 'Pickpocket', 1, 'fore', 'Quick fingers: pokes come off far more often.', { poke: .08 })],
  kobold: [hkP('ember', 'Ember Shot', 1, 'point', 'A puck with a coal in it: every shot a little harder to stop.', { shot: .03 }), hkP('firebreath', 'Fire Breath', 1, 'fore', 'A breath of fire in their faces: they are slower, and easier to poke.', { slow: .93, poke: .03 })],
  werewolf: [hkP('stride', 'Wolf Stride', 1, 'rush', 'On all fours: your skaters are clearly faster.', { spd: 1.1 }), hkP('pounce', 'Pounce', 1, 'fore', 'The pack closes: faster, and their checks land more.', { spd: 1.07, hit: 1.3 })],
  dwarf: [hkP('hammer', 'Hammer Shot', 1, 'point', 'Hard hands, true aim: shots miss the net less, and beat the goalie a little more.', { miss: -.04, shot: .02 }), hkP('shieldline', 'Shield Line', 1, 'box', 'Shields in the shooting lanes: half again the blocks.', { block: 1.5 })],
  ogre: [hkP('bulldoze', 'Bulldoze', 1, 'crash', 'Through them like a cart: checks bounce off your carrier, and loose pucks in front are yours.', { wall: .4, reb: 1.3 }), hkP('smother', 'Smother', 2, 'collapse', 'A wall of ogre in front of your net: their shots stopped more, and blocked more.', { save: .03, block: 1.25 })],
  minotaur: [hkP('bullrush', 'Bull Rush', 1, 'rush', 'Horns down: faster, and hard to knock off the puck.', { spd: 1.07, wall: .5 }), hkP('gore', 'Gore', 1, 'man', 'Horns up: body checks land far more often.', { hit: 1.6 })],
  troll: [hkP('longreach', 'Long Reach', 1, 'crash', 'Arms like oars: loose pucks and rebounds are yours.', { reb: 1.6 }), hkP('regen', 'Regenerate', 1, 'any', 'Troll blood: your skaters tire much slower.', { tire: .5 })],
  golem: [hkP('standing', 'Standing Stone', 1, 'point', 'A boulder in front of their goalie: they cannot see the shot.', { blind: .75 }), hkP('crease', 'Stand in the Crease', 2, 'box', 'The golem fills the net: their shots are stopped far more.', { save: .05 })],
  harpy: [hkP('endtoend', 'End to End', 1, 'rush', 'Nobody catches her: your skaters are much faster.', { spd: 1.15 }), hkP('swoop', 'Swoop', 1, 'trap', 'Down on every pass from above: far more are picked off.', { pick: 1.6 })],
  elf: [hkP('trueaim', 'True Aim', 1, 'cycle', 'Every shot on the net, and a little better.', { miss: -.06, shot: .02 }), hkP('eagleeye', 'Eagle Eye', 1, 'trap', 'Reads every pass: half again as many picked off.', { pick: 1.5 })],
  wraith: [hkP('phase', 'Phase', 1, 'rush', 'Through a check like smoke: body checks hardly ever land, and pokes miss more.', { wall: .2, guard: -.04 }), hkP('chill', 'Chill Touch', 1, 'trap', 'A cold hand on every skater: they are clearly slower.', { slow: .9 })],
  vampire: [hkP('mesmer', 'Mesmerize', 1, 'cycle', 'Their goalie follows the wrong thing: set late for every shot.', { blind: .7 }), hkP('drain', 'Drain', 1, 'man', 'Feeds on them: they are a little slower, and yours tire slower.', { slow: .94, tire: .7 })],
  lich: [hkP('telekinesis', 'Telekinesis', 1, 'cycle', 'The puck is guided: passes are hardly picked off, and one-timers are better.', { safe: .4, one: .03 }), hkP('frost', 'Frost', 1, 'collapse', 'A frost on the ice: they are much slower.', { slow: .88 })],
  zombie: [hkP('relentless', 'Relentless', 1, 'dump', 'They keep coming: loose pucks are theirs, and they hardly tire.', { reb: 1.4, tire: .6 }), hkP('horde', 'Horde', 1, 'collapse', 'Bodies everywhere: more blocks, and more checks land.', { block: 1.3, hit: 1.2 })],
  gorgon: [hkP('stare', 'Stare', 2, 'any', 'Their goalie freezes for the length of a wind-up: hardly set at all.', { blind: .5 }), hkP('glance', 'Stone Glance', 1, 'box', 'A look that stiffens the shooter: their shots beat your goalie less.', { save: .04 })],
  spider: [hkP('silk', 'Silk Pass', 1, 'cycle', 'A thread on every pass: almost none are picked off.', { safe: .3 }), hkP('web', 'Web', 1, 'trap', 'Threads across the ice: they are slower, and passes stick.', { slow: .92, pick: 1.3 })],
  skeleton: [hkP('rattle', 'Rattle Shot', 1, 'crash', 'It rattles in off anything: shots are truer and a little harder to stop.', { shot: .025, miss: -.03 }), hkP('boneblock', 'Bone Block', 1, 'box', 'Rattling shins in every lane: far more blocks.', { block: 1.7 })],
  witch: [hkP('blackice', 'Black Ice', 1, 'rush', 'A patch with no grip at all under their skates: they are much slower.', { slow: .88 }), hkP('hex', 'Hex', 1, 'any', 'A word on their sticks: their shots miss the net more.', { wild: .06 })],
};
// the second of each: [puck, checking]
const HK_POW2 = {
  goblin: [hkP('scamper', 'Scamper', 1, 'rush', 'Under everybody\'s reach: faster, and safer on the puck.', { spd: 1.06, guard: -.04 }), hkP('anklebite', 'Ankle Biter', 1, 'man', 'Underfoot everywhere: they are slower, and pokes come off more.', { slow: .95, poke: .04 })],
  kobold: [hkP('sling', 'Sling Pass', 1, 'cycle', 'Passes zip: half as many are picked off.', { safe: .5 }), hkP('smoke', 'Smoke', 1, 'collapse', 'Smoke in front of your net: their shots miss more.', { wild: .05 })],
  werewolf: [hkP('howl', 'Howl', 1, 'crash', 'The pack answers: loose pucks are yours, and your skaters tire slower.', { reb: 1.3, tire: .75 }), hkP('hunt', 'Hunt', 1, 'trap', 'They read where it is going: more passes picked off, more pokes.', { pick: 1.3, poke: .03 })],
  dwarf: [hkP('anvil', 'Anvil', 1, 'crash', 'Planted in front: cannot be moved off the puck, and wins what comes loose.', { wall: .4, reb: 1.25 }), hkP('ironwall', 'Iron Wall', 2, 'collapse', 'A dwarf in every lane and one in the crease: blocks and saves both.', { block: 1.3, save: .03 })],
  ogre: [hkP('cannon', 'Cannon', 2, 'point', 'The hardest shot on the pond: every shot beats the goalie more.', { shot: .05 }), hkP('crush', 'Crush', 1, 'man', 'Every check is a wall falling on them.', { hit: 1.7 })],
  minotaur: [hkP('charge', 'Charge', 1, 'crash', 'Head down to the net: nothing knocks them off it, and the rebound is theirs.', { wall: .3, reb: 1.2 }), hkP('pin', 'Pin', 1, 'box', 'Pinned on the boards: they are slower, and blocks come easier.', { slow: .94, block: 1.2 })],
  troll: [hkP('club', 'Club Shot', 1, 'point', 'A swing like a falling tree: shots beat the goalie more, and miss a little more.', { shot: .045, miss: .03 }), hkP('bridge', 'Bridge Toll', 1, 'trap', 'Nothing crosses the middle free: more picked off, more checks.', { pick: 1.3, hit: 1.2 })],
  golem: [hkP('roll', 'Rolling Stone', 1, 'dump', 'Slow to start and impossible to stop: checks bounce off.', { wall: .2 }), hkP('gravel', 'Gravel', 1, 'trap', 'Grit thrown on the ice: they are clearly slower.', { slow: .9 })],
  harpy: [hkP('dive', 'Dive', 1, 'crash', 'In from above: one-timers are much better.', { one: .05 }), hkP('shriek', 'Shriek', 1, 'fore', 'A cry in the carrier\'s ear: pokes come off more, and their shots miss more.', { poke: .05, wild: .03 })],
  elf: [hkP('threadneedle', 'Thread the Needle', 1, 'cycle', 'A pass through anything, onto the tape: fewer picked off, better one-timers.', { safe: .5, one: .04 }), hkP('longstick', 'Long Stick', 1, 'box', 'A reach into every lane: more blocks, more pokes.', { block: 1.3, poke: .03 })],
  wraith: [hkP('haunt', 'Haunt', 1, 'cycle', 'Their goalie keeps looking behind him: set late.', { blind: .75 }), hkP('fade', 'Fade', 1, 'collapse', 'There and not there: their shots miss more, and yours tire slower.', { wild: .04, tire: .8 })],
  vampire: [hkP('bat', 'Bat Wing', 1, 'rush', 'A glide nobody matches: faster, and harder to check.', { spd: 1.08, wall: .7 }), hkP('thrall', 'Thrall', 2, 'man', 'The shooter hesitates: their shots beat your goalie much less.', { save: .05 })],
  lich: [hkP('curse', 'Cursed Puck', 1, 'point', 'It swerves late: the goalie is set for where it was.', { blind: .78, shot: .01 }), hkP('ward', 'Ward', 1, 'box', 'A circle round your net: their shots are stopped more.', { save: .035 })],
  zombie: [hkP('shamble', 'Shamble', 1, 'dump', 'Slow, and never off the puck: pokes and checks both fail more.', { guard: -.05, wall: .6 }), hkP('grasp', 'Grasp', 1, 'man', 'Hands on everything: more pokes come off, more passes stick.', { poke: .05, pick: 1.2 })],
  gorgon: [hkP('serpent', 'Serpent Shot', 1, 'cycle', 'It finds the gap: shots are truer and beat the goalie more.', { miss: -.03, shot: .03 }), hkP('petrifypuck', 'Stone Legs', 1, 'trap', 'Their legs go heavy: much slower.', { slow: .88 })],
  spider: [hkP('eightarms', 'Eight Arms', 1, 'crash', 'A hand for every loose puck: rebounds are yours, and nothing pokes it away.', { reb: 1.5, guard: -.04 }), hkP('webnet', 'Web Net', 1, 'box', 'A net in front of the net: more blocks, and their shots are stopped more.', { block: 1.4, save: .02 })],
  skeleton: [hkP('quickrelease', 'Quick Release', 1, 'rush', 'Gone before the goalie moves: set late for it.', { blind: .8, shot: .015 }), hkP('scatter', 'Scatter', 1, 'fore', 'Falls apart under a check and gets up behind it: pokes come off more, and they hardly tire.', { poke: .04, tire: .75 })],
  witch: [hkP('broom', 'Broomstick', 1, 'cycle', 'A stick with ideas of its own: passes and one-timers both better.', { safe: .6, one: .035 }), hkP('fog', 'Fog', 1, 'collapse', 'They cannot see the net: their shots miss much more.', { wild: .08 })],
};
// the ultimates: { id, n, desc, o (with the puck), d (without it), at: where the mark goes ('crease': your net, 'slot': their slot, 'mid') }
const hkU0 = (id, n, desc, o, d, at) => ({ id, n, desc, o: o || {}, d: d || {}, at: at || 'mid' });
const HK_ULT = {
  goblin: hkU0('swarm', 'Swarm', 'Goblins everywhere: nobody takes the puck off you, and you take it off everybody.', { guard: -.1, safe: .5 }, { poke: .1 }),
  kobold: hkU0('bonfire', 'Bonfire', 'A fire at centre ice: they skate round it slowly, and your shots carry its heat.', { shot: .03 }, { slow: .86 }),
  werewolf: hkU0('fullmoon', 'Full Moon', 'The moon comes out: your skaters are much faster, with or without the puck.', { spd: 1.12 }, { spd: 1.12, hit: 1.3 }),
  dwarf: hkU0('forgewall', 'Forge Wall', 'An iron wall across your slot: far more blocks, and what gets through is stopped more.', {}, { block: 1.8, save: .03 }, 'crease'),
  ogre: hkU0('earthshaker', 'Earthshaker', 'The pond shakes: your checks flatten everything, and nothing moves your carrier.', { wall: .3 }, { hit: 2 }),
  minotaur: hkU0('stampede', 'Stampede', 'The whole line with its head down: faster and unstoppable going in, heavy coming back.', { spd: 1.1, wall: .3 }, { hit: 1.5 }),
  troll: hkU0('thickhide', 'Thick Hide', 'Nothing hurts and nothing tires: your skaters barely tire, and win every loose puck.', { tire: .4, reb: 1.5 }, { tire: .4, reb: 1.5 }),
  golem: hkU0('rampart', 'Rampart', 'A rampart of stone in your crease: their shots are stopped far more.', {}, { save: .08 }, 'crease'),
  harpy: hkU0('tailwind', 'Tailwind', 'A wind at your backs: much faster with the puck, and passes ride it.', { spd: 1.18, safe: .7 }, { spd: 1.06 }),
  elf: hkU0('moonlit', 'Moonlit Ice', 'Every line on the ice is clear to you: shots on the net, and better.', { miss: -.08, shot: .03 }, { pick: 1.3 }, 'slot'),
  wraith: hkU0('fogbank', 'Fog Bank', 'Fog rolls over their end: their goalie can\'t find the puck, and their own shots go astray.', { blind: .6 }, { wild: .06 }, 'slot'),
  vampire: hkU0('eclipse', 'Eclipse', 'The light goes: their goalie is set late for everything.', { blind: .5 }, { slow: .94 }, 'slot'),
  lich: hkU0('deepfreeze', 'Deep Freeze', 'The cold comes down: they are far slower.', {}, { slow: .8 }),
  zombie: hkU0('risingtide', 'Rising Tide', 'More of them every second: they never tire, and every loose puck is theirs.', { tire: .3, reb: 1.6 }, { tire: .3, reb: 1.6 }),
  gorgon: hkU0('petrify', 'Petrify', 'Their goalie turns to stone where they stand.', { blind: .4 }, { save: .03 }, 'slot'),
  spider: hkU0('greatweb', 'Great Web', 'A web from board to board: they are slower, and their passes stick in it.', {}, { slow: .86, pick: 1.6 }),
  skeleton: hkU0('bonestorm', 'Bone Storm', 'Bones in the air: your shots are harder to stop, and theirs hit shins.', { shot: .04 }, { block: 1.6 }),
  witch: hkU0('greathex', 'Great Hex', 'Black ice under them and a word on their sticks: slower, and wild.', {}, { slow: .82, wild: .05 }),
};
// the team's situation powers: { n, cost, desc, fx (while it lasts), secs, sta (stamina back for the skaters on the ice), when(side) }
const HK_SIT = {
  manup: { n: 'Man up', cost: 1, desc: 'On the power play: the puck moves faster. Passes get through, and shots are better, until the penalty ends.', fx: { safe: .6, shot: .03 }, when: s => hkShort(1 - s) },
  killit: { n: 'Kill it', cost: 1, desc: 'A skater short: quicker sticks. More pokes come off and more shots are blocked, until the penalty ends.', fx: { poke: .06, block: 1.4 }, when: s => hkShort(s) },
  empty: { n: 'Empty net', cost: 1, desc: 'Your goalie pulled: the skaters on the ice get their legs back, and skate a little faster.', fx: { spd: 1.06 }, secs: 12, sta: .3, when: s => !hkInNet(s) && !L.pl[hkGk(s)].off },
  sudden: { n: 'Sudden death', cost: 2, desc: 'In overtime: everyone on your side is fresh.', fx: {}, secs: 1, sta: 1, when: () => hkOt() },
};
const HK_POW_BY = {}; for (const T of [HK_POW, HK_POW2]) for (const k in T) for (const p of T[k]) HK_POW_BY[p.id] = p;
const HK_ULT_BY = {}; for (const k in HK_ULT) HK_ULT_BY[HK_ULT[k].id] = HK_ULT[k];
// the power a player brings: role 'puck' or 'chk'
const hkPowFor = (m, role) => { const i = role === 'puck' ? 0 : 1, two = HK_POW2[m.kind]; return two && m.pw && m.pw[role] === 1 ? two[i] : HK_POW[m.kind] && HK_POW[m.kind][i]; };
let HK_FXNOW = [Object.assign({}, HK_FX0), Object.assign({}, HK_FX0)];

// on: false for none; [yours, theirs] to give them to one side only (the lab's powers on and off)
function hkPowersStart(on) {
  G.powOn = Array.isArray(on) ? [!!on[0], !!on[1]] : [on !== false, on !== false];
  G.powers = G.powOn[0] || G.powOn[1];
  G.mana = [HK_MANA.start, HK_MANA.start]; G.spirit = [0, 0]; G.fxs = []; G.marks = []; G.ultUsed = [false, false]; G.sitUsed = [{}, {}]; G.casts = [];
  hkFxNow();
}
const hkManaAdd = (s, n) => { if (G.mana && G.powers && G.powOn[s]) G.mana[s] = clamp(G.mana[s] + n, 0, HK_MANA.max); };
function hkSpiritAdd(s, n) { if (G.spirit && G.powers && G.powOn[s]) G.spirit[s] = clamp(G.spirit[s] + n, 0, HK_SPIRIT.max); }
function hkFxMerge(F, fx) { for (const k in fx || {}) { if (!(k in HK_FX0)) continue; F[k] = HK_FX_MUL.has(k) ? F[k] * Math.max(.05, 1 + (fx[k] - 1) * HK_POW_K) : F[k] + fx[k] * HK_POW_K; } return F; }
// the effects of what is going now, for each side: an ultimate's by whether its side has the puck
function hkFxNow() {
  HK_FXNOW = [0, 1].map(s => {
    const F = Object.assign({}, HK_FX0);
    for (const e of (G && G.fxs) || []) { if (e.side !== s) continue; const U = e.k === 'ult' && HK_ULT_BY[e.id]; hkFxMerge(F, U ? (G.poss === s ? U.o : U.d) : e.k === 'sit' ? HK_SIT[e.id].fx : (HK_POW_BY[e.id] || {}).fx); }
    return F;
  });
}
const hkFx = (side, k) => HK_FXNOW[side][k];
// play goes on dt seconds: what is going runs down (a situation power for a penalty ends with it), and spirit lifts a spent line
function hkPowersStep(dt) {
  if (!G.powers) return;
  // mana comes back as the game goes on: one every HK_MANA.every seconds of play
  for (const s of [0, 1]) hkManaAdd(s, dt / HK_MANA.every);
  let ch = false;
  for (const e of G.fxs.slice()) {
    e.t -= dt;
    const done = e.t <= 0 || (e.id === 'manup' && !hkShort(1 - e.side)) || (e.id === 'killit' && !hkShort(e.side));
    if (done) { G.fxs.splice(G.fxs.indexOf(e), 1); if (e.k === 'ult') G.marks = G.marks.filter(m => m.id !== e.id || m.side !== e.side); ch = true; }
  }
  if (ch || G.fxs.some(e => e.k === 'ult')) hkFxNow();
  for (const s of [0, 1]) {
    if (G.spirit[s] < HK_SPIRIT.lift) continue;
    const sk = hkSk(s).filter(p => p.pos !== 'G'); if (!sk.length) continue;
    const avg = sk.reduce((a, p) => a + hkSta(p), 0) / sk.length, fresh = hkBench(s).some(i => G.sta[s][i] >= HK_STA.fresh);
    if (avg < .32 && !fresh) { G.spirit[s] -= HK_SPIRIT.lift; for (const p of sk) G.sta[s][p.ri] = Math.min(1, hkSta(p) + HK_SPIRIT.liftSta); hkEv('lift', G.teams[s].name); GD.msg = `The bank lifts ${G.teams[s].name}: their line finds one more shift.`; }
  }
}
// spirit from the play (05-live.js, 07-game.js)
function hkSpiritEv(side, k) { hkSpiritAdd(side, HK_SPIRIT[k] || 0); }
// which power a side's skaters could cast now: [{ i (in L.pl), ri, n (the player), role, id, name, cost, desc, fits, ok, why }]
function hkPowerOptions(side) {
  if (!G.powers || !G.powOn[side] || !L) return [];
  const role = G.poss === side ? 'puck' : 'chk', busy = G.fxs.some(e => e.side === side && e.k === 'pow'), live = GD.ph === 'live';
  return hkSk(side).filter(p => p.pos !== 'G').map(p => {
    const m = G.teams[side].roster[p.ri], P = hkPowFor(m, role); if (!P) return null;
    const why = !live ? 'Only in live play.' : busy ? 'One power at a time.' : G.mana[side] < P.cost ? 'Not enough mana.' : hkSta(p) < HK_POW_STA.min ? `${p.n} is too tired.` : '';
    return { i: L.pl.indexOf(p), ri: p.ri, n: p.n, role, id: P.id, name: P.n, cost: P.cost, desc: P.desc, fits: P.fits, ok: !why, why };
  }).filter(Boolean);
}
function hkUltOptions(side) {
  if (!G.powers || !G.powOn[side] || !L) return [];
  const live = GD.ph === 'live';
  return hkSk(side).filter(p => p.pos !== 'G').map(p => {
    const U = HK_ULT[p.kind]; if (!U) return null;
    const why = !live ? 'Only in live play.' : G.ultUsed[side] ? 'One ultimate a game.' : G.spirit[side] < HK_SPIRIT.ult ? 'Not enough spirit.' : hkSta(p) < HK_POW_STA.min ? `${p.n} is too tired.` : '';
    return { i: L.pl.indexOf(p), ri: p.ri, n: p.n, id: U.id, name: U.n, desc: U.desc, ok: !why, why };
  }).filter(Boolean);
}
function hkSitOptions(side) {
  if (!G.powers || !G.powOn[side] || !L) return [];
  return Object.entries(HK_SIT).map(([id, S]) => {
    const why = GD.ph !== 'live' ? 'Only in live play.' : G.sitUsed[side][id] ? 'Once a game.' : !S.when(side) ? 'Not the moment for it.' : G.mana[side] < S.cost ? 'Not enough mana.' : '';
    return { id, name: S.n, cost: S.cost, desc: S.desc, ok: !why, why };
  });
}
// a side's skater (index in L.pl) casts their power for the moment. '' when cast, or why not
function hkCast(side, i) {
  const o = hkPowerOptions(side).find(x => x.i === i); if (!o) return 'No power to cast.'; if (!o.ok) return o.why;
  const p = L.pl[i];
  G.mana[side] -= o.cost; G.sta[side][p.ri] = Math.max(HK_STA.floor, hkSta(p) - HK_POW_STA.base - HK_POW_STA.per * o.cost);
  G.fxs.push({ side, k: 'pow', id: o.id, n: o.name, ri: p.ri, t: HK_POW_SECS, role: o.role });
  G.casts.push({ p: G.p, clock: Math.round(G.clock), side, id: o.id, k: 'pow' });
  hkFxNow(); hkEv('power', p.n, o.name);
  GD.msg = `${p.n} casts ${o.name}.`; GD.big = { k: 'power', w: o.name };
  return '';
}
function hkCastUlt(side, i) {
  const o = hkUltOptions(side).find(x => x.i === i); if (!o) return 'No ultimate to cast.'; if (!o.ok) return o.why;
  const p = L.pl[i], U = HK_ULT_BY[o.id];
  G.spirit[side] -= HK_SPIRIT.ult; G.ultUsed[side] = true; G.sta[side][p.ri] = Math.max(HK_STA.floor, hkSta(p) - HK_POW_STA.ult);
  G.fxs.push({ side, k: 'ult', id: o.id, n: o.name, ri: p.ri, t: HK_ULT_SECS });
  // the mark: in your crease, in their slot, or at centre ice
  const own = hkGoalX(1 - side), x = U.at === 'crease' ? own + hkDir(side) * 1.5 : U.at === 'slot' ? hkGoalX(side) - hkDir(side) * 6 : HK_RULES.len / 2;
  G.marks.push({ side, id: o.id, n: o.name, x, y: 0, r: U.at === 'mid' ? 4.5 : 3 });
  G.casts.push({ p: G.p, clock: Math.round(G.clock), side, id: o.id, k: 'ult' });
  hkFxNow(); hkEv('ult', p.n, o.name);
  GD.msg = `${p.n} casts ${o.name}!`; GD.big = { k: 'ult', w: o.name };
  return '';
}
function hkCastSit(side, id) {
  const o = hkSitOptions(side).find(x => x.id === id); if (!o) return 'No such power.'; if (!o.ok) return o.why;
  const S = HK_SIT[id];
  G.mana[side] -= S.cost; G.sitUsed[side][id] = true;
  if (S.sta) for (const p of (id === 'sudden' ? L.pl.filter(q => q.side === side) : hkSk(side))) G.sta[side][p.ri] = Math.min(1, G.sta[side][p.ri] + S.sta);
  if (id === 'sudden') G.sta[side] = G.sta[side].map(() => 1);
  G.fxs.push({ side, k: 'sit', id, n: S.n, ri: -1, t: S.secs || 99 });
  G.casts.push({ p: G.p, clock: Math.round(G.clock), side, id, k: 'sit' });
  hkFxNow(); hkEv('sit', G.teams[side].name, S.n);
  GD.msg = `${G.teams[side].name}: ${S.n}.`; GD.big = { k: 'power', w: S.n };
  return '';
}
// does a power suit the system its side is in now
const hkFits = (P, side, role) => P.fits === 'any' || P.fits === (role === 'puck' ? G.call[side].att : G.call[side].def);
/* a side's casting, a couple of times a second: the CPU's by its skill, and yours under Auto powers. sk: 0 a Squire
   (now and then, anything), 1 a Knight (when the puck is in the right end, what suits the system first, a mana kept
   back before the third), 2 an Archmage (only what suits, or with mana to spare; spirit saved for a close finish) */
function hkCpuPowers(dt) {
  if (!G.powers || GD.ph !== 'live') return;
  L.powT = (L.powT || 0) - dt; if (L.powT > 0) return; L.powT = .5;
  for (const s of [0, 1]) {
    const mine = GD.mode !== 'watch' && s === GD.you; if (mine && !GD.autoPow) continue;
    const sk = mine ? 1 : G.skill[s], up = hkUp(s, L.puck.x), has = G.poss === s, role = has ? 'puck' : 'chk';
    // situation powers: when the moment is there
    for (const o of hkSitOptions(s)) if (o.ok && (sk > 0 || R() < .2)) { hkCastSit(s, o.id); break; }
    // the ultimate: a Knight when it has the spirit and the puck is in the right end; an Archmage in a close third, or behind
    const right = has ? up > HK_RULES.len - HK_RULES.blue : up < HK_RULES.blue + 2;
    const us = hkUltOptions(s).filter(o => o.ok);
    if (us.length && right && (sk === 0 ? R() < .1 : sk === 1 ? true : (G.p >= HK_RULES.periods && Math.abs(hkLead(s)) <= 1) || hkLead(s) < 0 || hkOt())) { hkCastUlt(s, pick(us).i); continue; }
    const os = hkPowerOptions(s).filter(o => o.ok); if (!os.length) continue;
    if (sk === 0) { if (R() < .06) hkCast(s, pick(os).i); continue; }
    if (!right) continue;
    const keep = G.p < HK_RULES.periods ? 1 : 0, fit = os.filter(o => hkFits(HK_POW_BY[o.id], s, role) && G.mana[s] - o.cost >= keep);
    const any = sk === 1 ? os.filter(o => G.mana[s] - o.cost >= keep + 1) : os.filter(o => G.mana[s] >= HK_MANA.max - 1);
    const from = fit.length ? fit : any; if (from.length && R() < (fit.length ? .7 : .35)) hkCast(s, pick(from).i);
  }
}
