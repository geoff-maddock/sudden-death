/* Cinder Gridiron: monster powers (issue #9, phase 6). They work as they do on Brimstone Diamond, adapted to downs:
   - Team mana (G.mana, by side), as on the diamond where every inning brings some: 3 to start and back up to 3 at
     the half, 1 to both sides at every new drive, and 1 more each time the other side scores (up to 6).
   - Everyday powers: every kind has an offense power and a defense power (GF_POW), cast with the call. A side casts
     at most one a down. Each costs mana, and stamina from the player who casts it.
   - The ultimate: one per kind (GF_ULT), once a game, 3 mana. It leaves a zone on the field (G.zones) that lasts 3
     plays or the drive, whichever ends first; a few hit at once too (Stampede).
   - Stamina (G.stam, by side and roster index, 0 to 100): the same seven play both ways, so every play costs everyone
     a little (the undead and golems half as much); casting costs a lot more, and the half gives plenty back. Below
     half, a player is slower and weaker (gfWorn), and can't cast below GF_STAM.min. A player on the bench rests
     (GF_STAM.bench a play; 15-bench.js). A few powers give stamina back too (rest: { team } the seven, { tired: [n, k] }
     the n most tired; the Overgrowth zone, restZ, every play it lasts).
   - Your side: pick a power with the call (GD.pow), or let Auto powers (GD.auto, on in 'call', T on the page) cast
     the way the coaches would. The CPU casts at three skill levels (G.skill, by side: 0, 1, 2): a Squire casts at
     random, a Knight leans to powers that suit the call, and an Archmage casts only those, and saves its ultimates for
     the downs that matter. Their coach remembers the plays you cast on (12-playbook.js).
   - On the field every power is one set of effects (GF_FX0), merged into L.fx at the snap from both sides' powers and
     the zones (gfFx): multipliers multiply, the rest add. 06-live.js reads L.fx; what a power did goes in the play's
     events, and so in the reason after it.
   - Power tips (gfPowerTip): the pros and cons of a power for the down, the distance and the field.
   - Issue #61, phase 5: every kind has a second offense and defense power (GF_POW2); a player brings one of each pair
     (m.pw, gfPowFor). And the situation powers (GF_SIT): the team's, once a game each, when the moment fits (a
     Goal-line Wall inside your 10, which leaves a zone at the goal line; a Two-minute Drill late and not ahead, with no
     runoff before the next play, fx.hurry; a Fourth-down Gamble). G.sitUsed: which a side has used. */
const GF_MANA = { start: 3, max: 6, scored: 1, drive: 1 }, GF_STAM = { min: 20, per: 6, base: 14, ult: 30, play: 1, half: 50, bench: 4 };
const GF_ULT_COST = 3, GF_ULT_PLAYS = 3;
const GF_UNDEAD = ['zombie', 'skeleton', 'lich', 'wraith', 'vampire', 'golem'];
// the effects, at no effect. Speed: oSpd (the offense), dSpd (the defense), cSpd (the ball carrier), rSpd (receivers on
// their routes), rushSpd, coverSpd, and by where they are: backSpd (behind the line), midSpd (the middle past the
// line), deepSpd (receivers 8 yards out). Blocks: shed (how often a block is shed), blk and dStr (strength). Tackles:
// tkl (added to every try), cStr (the carrier's strength), breakN (tackles the carrier breaks outright), untag (seconds
// untackleable after taking the ball), nolose (a loss is no gain). The throw: read (seconds later the defense breaks on
// it), int, errM and errA (how far off it flies), ballV (its speed), catch, sure (no break-ups or picks). Kicks: kick
// (field goal chance), punt (yards). At the snap: snapStun (rushers down), snapAll (every defender), blkStun (every
// blocker), coverSlow, safetySlow, gas (Plague Cloud). With the ball: pounce (yards a tackler leaps), cStun and cStunP
// (frozen, and the chance), cSlow. At the throw: freezeNear (the defender nearest the target), tgtSlow (the target).
// The stances (16-stance.js): qbT (how long the quarterback waits), away (the chance to throw it away under pressure),
// deepW (how much the quarterback looks deep), fum (the fumble chance), cush (yards of cushion the coverage gives),
// jump (yards further a defender can get to a throw: more break-ups and picks), valve (on a long pass, the seconds
// before the blocking back slips out as a checkdown; 0 never).
const GF_FX0 = { oSpd: 1, dSpd: 1, cSpd: 1, rSpd: 1, rushSpd: 1, coverSpd: 1, backSpd: 1, midSpd: 1, deepSpd: 1, shed: 1, int: 1, errM: 1, ballV: 1,
  blk: 0, dStr: 0, tkl: 0, cStr: 0, breakN: 0, untag: 0, nolose: 0, read: 0, errA: 0, catch: 0, sure: 0, kick: 0, punt: 0,
  snapStun: 0, snapAll: 0, blkStun: 0, coverSlow: 0, safetySlow: 0, gas: 0, pounce: 0, cStun: 0, cStunP: 0, cSlow: 0, freezeNear: 0, tgtSlow: 0, stand: 0, hurry: 0,
  qbT: 1, away: 0, deepW: 0, fum: 1, cush: 0, jump: 0, valve: 0 };
const GF_FX_MUL = new Set(['oSpd', 'dSpd', 'cSpd', 'rSpd', 'rushSpd', 'coverSpd', 'backSpd', 'midSpd', 'deepSpd', 'shed', 'int', 'errM', 'ballV', 'qbT', 'fum']);
// everyday powers by kind: [offense, defense]. fits: the call it helps ('run', 'pass' or 'any')
const GF_POW = {
  goblin: [{ id: 'shadowstep', n: 'Shadowstep', cost: 1, fits: 'run', desc: 'The ball carrier blinks past the first tackle.', fx: { breakN: 1 } },
    { id: 'pickpocket', n: 'Pickpocket', cost: 1, fits: 'pass', desc: 'Quick hands: catches are harder, and a throw near a defender is picked off far more often.', fx: { int: 2.5, catch: -.12 } }],
  kobold: [{ id: 'sling', n: 'Sling Shot', cost: 1, fits: 'pass', desc: 'The throw flies 30% faster and much truer, so the defense has less time to break on it.', fx: { ballV: 1.3, errM: .6, catch: .06 } },
    { id: 'firebreath', n: 'Fire Breath', cost: 1, fits: 'pass', desc: 'The rushers breathe fire on the blockers: blocks are shed twice as often.', fx: { shed: 2 } }],
  werewolf: [{ id: 'sprint', n: 'Wolf Sprint', cost: 1, fits: 'run', desc: 'The ball carrier drops to all fours: 12% faster for the play.', fx: { cSpd: 1.12 } },
    { id: 'pounce', n: 'Pounce', cost: 1, fits: 'any', desc: 'When someone takes the ball, the nearest defender leaps 4 yards at them.', fx: { pounce: 4 } }],
  dwarf: [{ id: 'axe', n: 'Battle Axe', cost: 1, fits: 'run', desc: 'The ball carrier swings the axe through tackles: +2.5 strength against them.', fx: { cStr: 2.5 } },
    { id: 'holdline', n: 'Hold the Line', cost: 1, fits: 'run', desc: 'The defense digs in: +3 strength against blocks, and the ball carrier slows in the pile.', fx: { dStr: 3, cSpd: .95 } }],
  ogre: [{ id: 'crush', n: 'Club Crush', cost: 2, fits: 'any', desc: 'The line clubs the rush at the snap: the rushers go down for nearly two seconds.', fx: { snapStun: 1.8 } },
    { id: 'devour', n: 'Devour', cost: 2, fits: 'any', desc: 'A hungry defense: every tackle try is far likelier to hold.', fx: { tkl: .3 } }],
  minotaur: [{ id: 'bullrush', n: 'Bull Rush', cost: 1, fits: 'run', desc: 'The ball carrier lowers the horns: +2 strength against tackles.', fx: { cStr: 2 } },
    { id: 'gore', n: 'Gore', cost: 1, fits: 'any', desc: 'Horns first: tackles a little likelier, and +1 strength against blocks.', fx: { tkl: .12, dStr: 1 } }],
  troll: [{ id: 'seismic', n: 'Seismic Snap', cost: 2, fits: 'any', desc: 'The ground heaves at the snap: every defender staggers for a second and a half.', fx: { snapAll: 1.6 } },
    { id: 'boulder', n: 'Boulder', cost: 1, fits: 'run', rest: { tired: [2, 15] }, desc: 'Boulders for shoulders: tackles a little likelier, and +1.5 strength against blocks. Troll blood: the two most tired on the field get 15 stamina back.', fx: { tkl: .1, dStr: 1.5 } }],
  golem: [{ id: 'stoneskin', n: 'Stone Skin', cost: 1, fits: 'pass', desc: 'The pocket turns to stone: blocks hold about four times as long, and the throw goes truer.', fx: { shed: .25, errM: .8 } },
    { id: 'quake', n: 'Quake', cost: 2, fits: 'any', desc: 'A stomp at the snap: every blocker stumbles.', fx: { blkStun: .8 } }],
  harpy: [{ id: 'glide', n: 'Glide', cost: 1, fits: 'pass', desc: 'The receiver rises over the defender: no break-ups, no picks.', fx: { sure: 1 } },
    { id: 'flight', n: 'Take Flight', cost: 1, fits: 'pass', desc: 'The coverage takes wing: 6% faster, and picks off more throws.', fx: { coverSpd: 1.06, int: 1.5 } }],
  elf: [{ id: 'fleet', n: 'Fleet Foot', cost: 1, fits: 'pass', desc: 'The receivers run their routes 8% faster.', fx: { rSpd: 1.08 } },
    { id: 'eagle', n: 'Eagle Eye', cost: 1, fits: 'pass', desc: 'The defense reads the throw the moment it leaves the hand.', fx: { read: -.35 } }],
  wraith: [{ id: 'invis', n: 'Invisibility', cost: 2, fits: 'pass', desc: 'The receivers vanish off the line: the coverage loses them for a second and a half.', fx: { coverSlow: 1.6 } },
    { id: 'haunt', n: 'Haunt', cost: 1, fits: 'pass', desc: 'The receiver thrown to panics and loses a third of a step.', fx: { tgtSlow: .35 } }],
  vampire: [{ id: 'swarm', n: 'Bat Swarm', cost: 2, fits: 'run', desc: 'The ball carrier bursts into bats: no tackle holds for 1.5 seconds after taking the ball.', fx: { untag: 1.5 } },
    { id: 'mesmer', n: 'Mesmerize', cost: 2, fits: 'any', rest: { team: 6 }, desc: 'Whoever takes the ball freezes for a moment, and the vampire drinks: the seven get 6 stamina back.', fx: { cStun: .9, cStunP: 1 } }],
  lich: [{ id: 'telek', n: 'Telekinesis', cost: 1, fits: 'pass', desc: 'The throw is guided there: it flies almost true and lands soft.', fx: { errM: .25, catch: .1 } },
    { id: 'deflect', n: 'Deflect', cost: 1, fits: 'pass', desc: 'A ward in the air pushes the throw off line.', fx: { errA: 1.2 } }],
  zombie: [{ id: 'undying', n: 'Undying', cost: 1, fits: 'any', desc: 'Won\'t go down backwards: a loss of yards counts as no gain.', fx: { nolose: 1 } },
    { id: 'horde', n: 'Shambling Horde', cost: 1, fits: 'run', desc: 'They pile on: tackles a little likelier.', fx: { tkl: .12 } }],
  gorgon: [{ id: 'gaze', n: 'Stone Gaze', cost: 2, fits: 'pass', desc: 'At the throw, the defender nearest the receiver turns to stone for a moment.', fx: { freezeNear: .45 } },
    { id: 'petrify', n: 'Petrify', cost: 2, fits: 'any', desc: 'Whoever takes the ball may turn to stone (a bit better than even) for a second and a half.', fx: { cStun: 1.5, cStunP: .55 } }],
  spider: [{ id: 'sticky', n: 'Sticky Hands', cost: 1, fits: 'pass', desc: 'Webbed gloves: catches are likelier.', fx: { catch: .12 } },
    { id: 'web', n: 'Web', cost: 1, fits: 'run', desc: 'Whoever takes the ball is webbed: nearly half speed for 1.8 seconds.', fx: { cSlow: 1.8 } }],
  skeleton: [{ id: 'shieldwall', n: 'Shield Wall', cost: 1, fits: 'any', desc: 'The line locks shields around the ball: +2 blocking strength, blocks hold about twice as long, and the carrier +1 strength against tackles.', fx: { blk: 2, shed: .45, cStr: 1 } },
    { id: 'stand', n: 'Goal-line Stand', cost: 1, fits: 'any', desc: 'Tackles likelier, and much likelier with your goal line close (inside your 20).', fx: { stand: 1 } }],
  witch: [{ id: 'hex', n: 'Hex', cost: 1, fits: 'pass', rest: { team: 8 }, desc: 'Hexes their deep safety: nearly half speed for the first four seconds, and a draught from the cauldron: the seven get 8 stamina back.', fx: { safetySlow: 4 } },
    { id: 'frost', n: 'Frost Hex', cost: 2, fits: 'any', desc: 'A chill over the field: their whole offense 12% slower.', fx: { oSpd: .88 } }],
};
// second everyday powers (issue #61, phase 5): [offense, defense] by kind; a player brings one of each pair (m.pw:
// { off: 0 | 1, def: 0 | 1 }, 1 for these)
const GF_POW2 = {
  goblin: [{ id: 'trickplay', n: 'Trick Play', cost: 1, fits: 'pass', desc: 'A goblin trick at the snap: the coverage bites, and is a step slow off the line.', fx: { coverSlow: .8 } },
    { id: 'ambush', n: 'Ambush', cost: 1, fits: 'pass', desc: 'They come from nowhere: the rushers 8% faster.', fx: { rushSpd: 1.08 } }],
  kobold: [{ id: 'tunnel', n: 'Tunnel Run', cost: 1, fits: 'run', desc: 'Kobold tunnels behind the line: the offense 15% faster back there.', fx: { backSpd: 1.15 } },
    { id: 'trapline', n: 'Trap Line', cost: 1, fits: 'any', desc: 'Traps along the line: the blockers stumble at the snap.', fx: { blkStun: .5 } }],
  werewolf: [{ id: 'frenzy', n: 'Frenzy', cost: 1, fits: 'any', desc: 'The line goes wild: +1.5 blocking strength.', fx: { blk: 1.5 } },
    { id: 'hunt', n: 'The Hunt', cost: 1, fits: 'pass', desc: 'The coverage runs them down: 8% faster.', fx: { coverSpd: 1.08 } }],
  dwarf: [{ id: 'shieldline', n: 'Shield Line', cost: 1, fits: 'pass', desc: 'Shields up round the quarterback: blocks hold twice as long.', fx: { shed: .5 } },
    { id: 'anvil', n: 'Anvil Drop', cost: 1, fits: 'run', desc: 'Whoever takes the ball has an anvil to carry: slowed for 1.2 seconds.', fx: { cSlow: 1.2 } }],
  ogre: [{ id: 'trample', n: 'Trample', cost: 1, fits: 'run', desc: 'The carrier tramples: +3 strength against tackles, a little slower.', fx: { cStr: 3, cSpd: .95 } },
    { id: 'roar', n: 'Roar', cost: 1, fits: 'pass', desc: 'A roar that shakes the thrower: the throw goes off line.', fx: { errA: .8 } }],
  minotaur: [{ id: 'labyrinth', n: 'Labyrinth', cost: 1, fits: 'pass', desc: 'Routes like a maze: receivers past 8 yards 12% faster.', fx: { deepSpd: 1.12 } },
    { id: 'horncharge', n: 'Horn Charge', cost: 1, fits: 'pass', desc: 'The rush lowers its horns: 12% faster.', fx: { rushSpd: 1.12 } }],
  troll: [{ id: 'trollhide', n: 'Troll Hide', cost: 1, fits: 'run', rest: { tired: [2, 12] }, desc: 'Thick hide: the carrier +1 strength against tackles, and the two most tired on the field get 12 stamina back.', fx: { cStr: 1 } },
    { id: 'rockthrow', n: 'Rock Throw', cost: 1, fits: 'pass', desc: 'A rock at the receiver as the ball comes: they lose a step.', fx: { tgtSlow: .3 } }],
  golem: [{ id: 'ironmarch', n: 'Iron March', cost: 1, fits: 'run', desc: 'The line marches as one: +2.5 blocking strength, the offense a little slower.', fx: { blk: 2.5, oSpd: .96 } },
    { id: 'stonewall', n: 'Stone Wall', cost: 1, fits: 'run', desc: 'A wall of stone at the line: +2.5 strength against blocks.', fx: { dStr: 2.5 } }],
  harpy: [{ id: 'dive', n: 'Dive', cost: 1, fits: 'pass', desc: 'The ball dives from the sky: 20% faster through the air, and the deep men 5% faster.', fx: { ballV: 1.2, deepSpd: 1.05 } },
    { id: 'screech', n: 'Screech', cost: 2, fits: 'any', desc: 'A screech at the snap: every one of them staggers.', fx: { snapAll: .8 } }],
  elf: [{ id: 'arrowpass', n: 'Arrow Pass', cost: 1, fits: 'pass', desc: 'A throw like an arrow: it flies twice as true.', fx: { errM: .5 } },
    { id: 'thornhedge', n: 'Thorn Hedge', cost: 1, fits: 'run', desc: 'Thorns in the middle of the field: their players there 20% slower.', fx: { midSpd: .8 } }],
  wraith: [{ id: 'phasethrough', n: 'Phase Through', cost: 2, fits: 'run', desc: 'The carrier turns to mist: no tackle holds for nearly a second after taking the ball.', fx: { untag: .9 } },
    { id: 'gravechill', n: 'Grave Chill', cost: 1, fits: 'run', desc: 'A chill on the carrier: 12% slower.', fx: { cSpd: .88 } }],
  vampire: [{ id: 'nightfall', n: 'Nightfall', cost: 1, fits: 'pass', desc: 'Dark comes down: the coverage loses the receivers for a second.', fx: { coverSlow: 1 } },
    { id: 'thrall', n: 'Thrall', cost: 1, fits: 'pass', desc: 'The thrower is half in thrall: more throws picked off.', fx: { int: 1.8 } }],
  lich: [{ id: 'soulbind', n: 'Soul Bind', cost: 1, fits: 'pass', desc: 'The defense hesitates: they break on the throw a third of a second late, and it lands softer.', fx: { read: .3, catch: .06 } },
    { id: 'wither', n: 'Wither', cost: 1, fits: 'any', desc: 'Their legs wither: their offense 7% slower.', fx: { oSpd: .93 } }],
  zombie: [{ id: 'pileup', n: 'Pile Up', cost: 1, fits: 'run', desc: 'Bodies everywhere: +1.5 blocking strength, and the carrier +1 against tackles.', fx: { blk: 1.5, cStr: 1 } },
    { id: 'gravegrasp', n: 'Grasping Dead', cost: 1, fits: 'pass', desc: 'Hands from the ground: blocks are shed 40% more often.', fx: { shed: 1.4 } }],
  gorgon: [{ id: 'hiss', n: 'Hiss', cost: 1, fits: 'pass', desc: 'The snakes hiss: the coverage freezes off the line for a moment.', fx: { coverSlow: .6 } },
    { id: 'stoneline', n: 'Stone Line', cost: 1, fits: 'run', desc: 'Half to stone: +2 strength against blocks, and tackles a little likelier.', fx: { dStr: 2, tkl: .06 } }],
  spider: [{ id: 'silkline', n: 'Silk Line', cost: 1, fits: 'pass', desc: 'A silk line to the receiver: the ball 15% faster, and a little likelier caught.', fx: { ballV: 1.15, catch: .05 } },
    { id: 'trapdoor', n: 'Trapdoor', cost: 1, fits: 'run', desc: 'When someone takes the ball, the nearest defender springs 3 yards at them.', fx: { pounce: 3 } }],
  skeleton: [{ id: 'rattlebones', n: 'Rattle Bones', cost: 1, fits: 'run', desc: 'The carrier falls apart and back together: through the first tackle.', fx: { breakN: 1 } },
    { id: 'boneyard', n: 'Bone Yard', cost: 1, fits: 'pass', desc: 'Bones litter the deep field: receivers past 8 yards 15% slower.', fx: { deepSpd: .85 } }],
  witch: [{ id: 'broomstick', n: 'Broomstick', cost: 1, fits: 'pass', desc: 'Receivers on broomsticks: 6% faster on their routes, and the ball 10% faster.', fx: { rSpd: 1.06, ballV: 1.1 } },
    { id: 'curse', n: 'Curse', cost: 1, fits: 'run', desc: 'A curse on the carrier: −2 strength against tackles.', fx: { cStr: -2 } }],
};
/* situation powers (issue #61, phase 5): the team's, not a player's, once a game each, and only when the moment fits
   (ok(side)); no stamina, only mana. A zone, if it has one, lasts GF_ULT_PLAYS plays or the drive, as an ultimate's. */
const GF_SIT = {
  goalwall: { id: 'goalwall', n: 'Goal-line Wall', role: 'def', cost: 2, desc: 'On defense, with your goal line inside 10 yards: a wall at the goal line for 3 plays or the drive, tackles likelier and +1.5 strength against blocks.', zone: { tkl: .15, dStr: 1.5 }, vis: ['#d8b070', 'goal'],
    ok: s => G.poss !== s && G.ball >= 90, when: 'with your goal line inside 10 yards' },
  twominute: { id: 'twominute', n: 'Two-minute Drill', role: 'off', cost: 2, desc: 'Late in the game and not ahead: the offense hurries (5% faster, throws truer), and no clock runs off before the next play.', fx: { oSpd: 1.05, errM: .85, hurry: 1 },
    ok: s => G.poss === s && !!GD.game && G.half >= 2 && G.clock <= 120 && G.score[s] <= G.score[1 - s], when: 'in the last two minutes, not ahead' },
  gamble: { id: 'gamble', n: 'Fourth-down Gamble', role: 'off', cost: 2, desc: 'Going for it on fourth down: the carrier breaks the first tackle and is +1.5 strength, and catches are likelier.', fx: { breakN: 1, cStr: 1.5, catch: .08 },
    ok: s => G.poss === s && G.down === GF_RULES.downs, when: 'on fourth down' },
};
// ultimates by kind: role 'off' or 'def' (when it can be cast), zone: the effects the zone leaves for 3 plays or the
// drive, now: on the play it is cast only; vis: how the zone looks (09-draw.js)
const GF_ULT = {
  goblin: { id: 'smoke', n: 'Smoke Bomb', role: 'off', desc: 'Smoke over the field: the defense loses the receivers in the haze and breaks on the ball late.', zone: { read: 1.2 }, vis: ['#9a9488', 'all'] },
  kobold: { id: 'inferno', n: 'Inferno', role: 'off', desc: 'The line of scrimmage burns: the rushers wade through fire, 40% slower, and lose their blocks less.', zone: { rushSpd: .6, shed: .7 }, vis: ['#ff6a2a', 'line'] },
  werewolf: { id: 'howl', n: 'Blood Moon Howl', role: 'def', desc: 'A howl that chills the blood: their whole offense 15% slower in fear.', zone: { oSpd: .85 }, vis: ['#c23a3a', 'all'] },
  dwarf: { id: 'fissure', n: 'Earthshatter', role: 'off', desc: 'The axe cracks the line open: the rushers stumble in the cracks and shed blocks far less often.', zone: { shed: .3, blk: 2, dSpd: .96 }, vis: ['#7a5a34', 'line'] },
  ogre: { id: 'crater', n: 'Crater Slam', role: 'def', desc: 'A belly-flop leaves a crater: the ball carrier wades, 28% slower.', zone: { cSpd: .72 }, vis: ['#6a5a3a', 'mid'] },
  minotaur: { id: 'stampede', n: 'Stampede', role: 'off', desc: 'Charges up the middle: the ball carrier knocks over the first tackler, and the churned ground slows the defense.', now: { breakN: 1 }, zone: { dSpd: .97 }, vis: ['#8a5a34', 'mid'] },
  troll: { id: 'bog', n: 'Bog Tide', role: 'def', desc: 'Calls up the swamp: their backfield turns to bog, and everyone behind the line moves 35% slower.', zone: { backSpd: .65 }, vis: ['#4a6a3a', 'back'] },
  golem: { id: 'rampart', n: 'Rampart', role: 'off', desc: 'A wall grows along the line: hardly a rusher gets through.', zone: { shed: .05 }, vis: ['#9a9a9a', 'line'] },
  harpy: { id: 'tempest', n: 'Tempest', role: 'def', desc: 'A gale over the field: their kicks are pushed off line, and their long throws too.', zone: { kick: -.2, punt: -10, errA: 1 }, vis: ['#9ac8e8', 'all'] },
  elf: { id: 'overgrowth', n: 'Overgrowth', role: 'off', desc: 'The grass grows knee-high: the defense wades, 6% slower, and the elf\'s side rests in it: 4 stamina back each play it lasts.', zone: { dSpd: .94 }, restZ: 4, vis: ['#5aa04a', 'all'] },
  wraith: { id: 'fog', n: 'Fog of the Dead', role: 'off', desc: 'A grave-fog: the defense hardly picks a throw off, and misses more tackles.', zone: { int: .3, tkl: -.1 }, vis: ['#b8c0c8', 'all'] },
  vampire: { id: 'eclipse', n: 'Eclipse', role: 'off', desc: 'The torches go out: the defense misses tackles in the dark.', zone: { tkl: -.14 }, vis: ['#2a1a3a', 'all'] },
  lich: { id: 'gravehands', n: 'Grave Hands', role: 'def', desc: 'Skeletal hands claw at the ball carrier: 20% slower, and a little easier to bring down.', zone: { cSpd: .8, tkl: .05 }, vis: ['#d8d0b8', 'mid'] },
  zombie: { id: 'plague', n: 'Plague Cloud', role: 'off', desc: 'Grave gas over the line: at each snap a rusher may be knocked flat, and the coughing defense misses tackles (the undead shrug it off).', zone: { gas: 1.6, tkl: -.05 }, vis: ['#8ab04a', 'line'] },
  gorgon: { id: 'garden', n: 'Stone Garden', role: 'def', desc: 'Statues crowd the middle of the field: their players there move at 45% speed.', zone: { midSpd: .45 }, vis: ['#a8a090', 'mid'] },
  spider: { id: 'webburst', n: 'Web Burst', role: 'def', desc: 'Webbing over the deep field: receivers past 8 yards stick, at half speed.', zone: { deepSpd: .5 }, vis: ['#e8e8e0', 'deep'] },
  skeleton: { id: 'bonestorm', n: 'Bone Storm', role: 'off', desc: 'Bursts apart and comes back together: no tackle holds the ball carrier for a moment after taking the ball, and bones litter the field for the defense.', now: { untag: .8 }, zone: { dSpd: .97, tkl: -.04 }, vis: ['#efe6cf', 'all'] },
  witch: { id: 'blizzard', n: 'Blizzard', role: 'def', desc: 'Snow: their offense slips (15% slower), and throws fly off line.', zone: { oSpd: .85, errA: .4 }, vis: ['#e8f4ff', 'all'] },
};
const GF_POW_BY = {}; for (const k in GF_POW) for (const p of GF_POW[k]) GF_POW_BY[p.id] = p;
for (const k in GF_POW2) for (const p of GF_POW2[k]) GF_POW_BY[p.id] = p;
const GF_ULT_BY = {}; for (const k in GF_ULT) GF_ULT_BY[GF_ULT[k].id] = GF_ULT[k];
// (a situation power's zone is drawn and read as an ultimate's)
for (const k in GF_SIT) { GF_POW_BY[k] = GF_SIT[k]; if (GF_SIT[k].zone) GF_ULT_BY[k] = GF_SIT[k]; }
// the everyday power a player brings for a role: the first of their kind's, or the second (m.pw)
const gfPowFor = (m, role) => { const i = role === 'off' ? 0 : 1, two = GF_POW2[m.kind]; return two && m.pw && m.pw[role] === 1 ? two[i] : GF_POW[m.kind] && GF_POW[m.kind][i]; };
const gfPowName = id => (GF_POW_BY[id] || GF_ULT_BY[id] || {}).n || id;

function gfPowersStart() {
  G.mana = [GF_MANA.start, GF_MANA.start]; G.stam = G.teams.map(t => t.roster.map(() => 100)); G.zones = []; G.ultUsed = [{}, {}]; G.sitUsed = [{}, {}];
}
const gfMana = s => G.mana ? G.mana[s] : 0;
function gfManaAdd(s, n) { if (G.mana) G.mana[s] = clamp(G.mana[s] + n, 0, GF_MANA.max); }
// a worn player's ratings: below half stamina, down to 80% at none
function gfWorn(side, ri, r) {
  const st = G.stam ? G.stam[side][ri] : 100; if (st >= 50 || gfSalved(side, ri)) return r;
  const f = .8 + .2 * st / 50, o = Object.assign({}, r);
  for (const k of ['spd', 'str', 'hnd', 'arm', 'tkl']) o[k] = r[k] * f;
  return o;
}
// the ratings a player plays on now, rounded (the lineup shows these)
function gfRated(side, ri) { const r = gfWorn(side, ri, G.teams[side].roster[ri].r); return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v)])); }
// the half gives a lot back; every play costs everyone a little (the undead and golems tire at half the rate)
function gfRest(n) { if (G.stam) for (const s of G.stam) for (let i = 0; i < s.length; i++) s[i] = Math.min(100, s[i] + n); }
// (the bench rests instead; the stance sets how hard the seven go, 16-stance.js)
function gfTirePlay() { if (G.stam) G.stam.forEach((s, t) => { const on = gfOnField(t); s.forEach((v, i) => { s[i] = on.includes(i) ? Math.max(0, v - GF_STAM.play * gfStanceStam(t) * (GF_UNDEAD.includes(G.teams[t].roster[i].kind) ? .5 : 1)) : Math.min(100, v + GF_STAM.bench); }); }); }
const gfStamCost = (cost, ult) => ult ? GF_STAM.ult : GF_STAM.base + GF_STAM.per * cost;
const gfRole = side => side === G.poss ? 'off' : 'def';
/* the powers a side can cast now (with the call): each of its players' everyday power for the side of the ball they
   are on, and their kind's ultimate if it is that side's and unused. { key, id, ri, n (the player), name, cost, ult,
   fits, desc, ok, why } */
function gfPowerOptions(side) {
  if (!G.mana) return [];
  const role = gfRole(side), T = G.teams[side], out = [];
  const on = gfOnField(side);
  T.roster.forEach((m, ri) => {
    if (!on.includes(ri)) return;
    const pw = GF_POW[m.kind], u = GF_ULT[m.kind], st = G.stam[side][ri];
    const add = (p, ult) => {
      const cost = ult ? GF_ULT_COST : p.cost, used = ult && !!(G.ultUsed[side][m.kind] || G.ultUsed[side][ri]);
      const why = used ? 'used this game' : gfMana(side) < cost ? 'needs mana' : st < GF_STAM.min ? 'winded' : '';
      out.push({ key: ri + ':' + p.id, id: p.id, ri, n: m.n, kind: m.kind, name: p.n, cost, ult: !!ult, fits: ult ? 'any' : p.fits, desc: p.desc, ok: !why, why, stam: Math.round(st), stamCost: gfStamCost(cost, ult) });
    };
    if (pw) add(gfPowFor(m, role), false);
    if (u && u.role === role) add(u, true);
  });
  // the situation powers that fit the moment (the team's: ri null)
  G.sitUsed = G.sitUsed || [{}, {}];
  for (const id in GF_SIT) { const P = GF_SIT[id]; if (P.role !== role || !P.ok(side)) continue;
    const why = G.sitUsed[side][id] ? 'used this game' : gfMana(side) < P.cost ? 'needs mana' : '';
    out.push({ key: 'sit:' + id, id, ri: null, n: 'The team', kind: null, name: P.n, cost: P.cost, ult: false, sit: true, fits: 'any', desc: P.desc, ok: !why, why, stam: 100, stamCost: 0 }); }
  return out;
}
// a power is cast: mana, stamina, the ultimate used, its zone on the field. Returns what the play needs: { id, ri, n, name, ult }
function gfCast(side, o) {
  G.mana[side] -= o.cost; if (o.ri != null) G.stam[side][o.ri] = Math.max(0, G.stam[side][o.ri] - o.stamCost);
  if (o.sit) { G.sitUsed[side][o.id] = true; if (GF_SIT[o.id].zone) { G.zones = G.zones.filter(z => z.id !== o.id); G.zones.push({ id: o.id, n: o.name, side, left: GF_ULT_PLAYS }); } return { id: o.id, ri: null, n: o.n, name: o.name, ult: false, sit: true, side }; }
  if (o.ult) { G.ultUsed[side][o.kind] = true; G.zones = G.zones.filter(z => z.id !== o.id); G.zones.push({ id: o.id, n: o.name, side, left: GF_ULT_PLAYS }); }
  const P = GF_POW_BY[o.id]; if (P && P.rest) gfPowRest(side, P.rest, `${o.name} (${o.n})`);
  return { id: o.id, ri: o.ri, n: o.n, name: o.name, ult: o.ult, side };
}
// with the call: each side's power. Yours is your pick, or Auto powers', or none; the CPU's is the CPU's
function gfCastPowers(oc, dc) {
  const out = { off: null, def: null };
  if (!G.mana) return out;
  for (const side of [G.poss, 1 - G.poss]) {
    const role = gfRole(side), call = role === 'off' ? oc : dc, mine = GD.mode !== 'watch' && side === GD.you;
    let o = null;
    if (mine && GD.pow) o = gfPowerOptions(side).find(x => x.key === GD.pow && x.ok) || null;
    else if (!mine || GD.auto) o = gfCpuPower(side, call, mine ? 1 : (G.skill || [1, 1])[side]);
    if (o) out[role] = gfCast(side, o);
  }
  GD.pow = null;
  return out;
}
// how much is riding on this down: third or fourth down, near the goal line, or late in a close game
function gfLever() {
  return (G.down >= 3 ? .15 : 0) + (G.ball >= 80 ? .15 : 0) + (GD.game && G.half >= 2 && G.clock < 120 && Math.abs(G.score[0] - G.score[1]) <= 8 ? .15 : 0);
}
// what the defense expects: a pass on long yardage, a run on short
const gfExpect = () => G.togo >= 7 ? 'pass' : G.togo <= 3 ? 'run' : 'any';
function gfCpuPower(side, call, skill) {
  const opts = gfPowerOptions(side).filter(o => o.ok); if (!opts.length) return null;
  const role = gfRole(side), lever = gfLever(), full = gfMana(side) >= GF_MANA.max - 1;
  // what the play is: the offense knows; a defense guesses from the down (an Archmage reads their habits too)
  let kind = role === 'off' ? (GF_PLAYS[call] ? GF_PLAYS[call].kind : 'any') : skill >= 1 ? gfExpect() : 'any';
  if (role === 'def' && skill === 2) { const T = gfTendency(G.poss, 'off'), run = T.run || 0; if (Object.keys(T).length) kind = run >= .5 ? 'run' : run <= .2 ? 'pass' : kind; }
  // how often: a Squire now and then, a Knight more, an Archmage saves its mana for the downs that matter
  const p = skill === 2 ? (lever || full ? .85 : .2) : [.25, .4][skill] + lever + (gfMana(side) >= 5 ? .2 : 0);
  if (R() > p && !(skill >= 1 && opts.some(o => o.sit))) return null;
  const fit = o => o.fits === 'any' || kind === 'any' || o.fits === kind;
  const w = {};
  // (a situation power that fits the moment: a Knight or Archmage takes it most of the time)
  for (const o of opts) w[o.key] = o.sit ? [1, 6, 8][skill]
    : skill === 0 ? (o.ult ? .3 : 1)
    : skill === 1 ? (fit(o) ? 3 : 1) * (o.ult ? (lever ? 3 : 1.5) : 1)
    : (fit(o) ? 1 : 0) * o.cost * (o.ult ? (lever ? 3 : .15) : 1) * o.stam / 100;
  // a power that gives stamina back is worth more to a tired side (a Knight and an Archmage see it)
  const tired = gfTired(side);
  // (a weight, not a floor: an Archmage still casts only powers that fit, and still saves its ultimates)
  if (skill >= 1 && tired > .25) for (const o of opts) if ((GF_POW_BY[o.id] || {}).rest || (GF_ULT_BY[o.id] || {}).restZ) w[o.key] *= 1 + tired * 4;
  const k = wpick(w); return w[k] > 0 ? opts.find(o => o.key === k) : null;
}
// the play's effects: the zones on the field and both sides' powers (with an ultimate's effects on the play it is cast)
function gfFx(pw) {
  const F = Object.assign({}, GF_FX0);
  const add = fx => { for (const k in fx) if (k in F) F[k] = GF_FX_MUL.has(k) ? F[k] * fx[k] : F[k] + fx[k]; };
  for (const z of (G.zones || [])) if (GF_ULT_BY[z.id]) add(GF_ULT_BY[z.id].zone);
  for (const c of [pw && pw.off, pw && pw.def]) {
    if (!c) continue;
    if (GF_POW_BY[c.id]) add(GF_POW_BY[c.id].fx);
    // an ultimate cast this down: its zone is already on the field (the handle in tests may skip that)
    const u = GF_ULT_BY[c.id]; if (u) { if (u.now) add(u.now); if (!(G.zones || []).some(z => z.id === c.id)) add(u.zone); }
  }
  // Goal-line Stand: more with the goal line close
  if (F.stand) F.tkl += F.stand * (G.ball >= 80 ? .25 : .08);
  return F;
}
// which power (or zone) gave each effect on this play, by name, for the reason after it
function gfFxSrc(pw) {
  const S = {}, mark = (fx, n) => { for (const k in fx) S[k] = n; };
  for (const z of (G.zones || [])) if (GF_ULT_BY[z.id]) mark(GF_ULT_BY[z.id].zone, z.n);
  for (const c of [pw && pw.off, pw && pw.def]) {
    if (!c) continue;
    if (GF_POW_BY[c.id]) mark(GF_POW_BY[c.id].fx, c.name || gfPowName(c.id));
    const u = GF_ULT_BY[c.id]; if (u) { mark(u.zone, u.n); if (u.now) mark(u.now, u.n); }
  }
  return S;
}
// a zone effect summed over the field (the kicks read these), and the name of the zone that gives it
const gfZoneSum = k => (G && G.zones || []).reduce((a, z) => a + ((((GF_ULT_BY[z.id] || {}).zone || {})[k]) || 0), 0);
const gfZoneName = k => ((G.zones || []).find(z => ((GF_ULT_BY[z.id] || {}).zone || {})[k] != null) || {}).n || '';
// after a play: the zones count down, and the drive's end clears them; everyone tires a little
// a zone that gives stamina back does it for every play it is on the field, the last one too (called as the play is
// logged, so the note goes on that play's line)
function gfZoneRest() { for (const z of (G.zones || [])) { const u = GF_ULT_BY[z.id]; if (u && u.restZ) gfRestore(z.side, null, u.restZ, z.n); } }
function gfPowersAfter() {
  if (!G.zones) return;
  gfTirePlay();
  if (G.drive && G.drive.end) G.zones = [];
  else { for (const z of G.zones) z.left--; G.zones = G.zones.filter(z => z.left > 0); }
}
// a new half (or Sudden Death): mana for the half, and a long rest
function gfPowersHalf() { if (G.salve) G.salve = [[], []]; if (!G.mana) return; G.mana = G.mana.map(m => Math.max(m, GF_MANA.start)); gfRest(GF_STAM.half); }
// a new drive: mana for both sides
function gfPowersDrive() { if (G.mana) for (const s of [0, 1]) gfManaAdd(s, GF_MANA.drive); }
// a score: the side scored on gets mana back
function gfScoredOn(side) { gfManaAdd(side, GF_MANA.scored); }
// G cycles your pick through the powers you can cast now, then none
function gfCyclePower() {
  if (!GD || GD.ph !== 'call' || GD.mode === 'watch') return null;
  const list = gfPowerOptions(GD.you).filter(o => o.ok); if (!list.length) { GD.pow = null; return null; }
  const i = list.findIndex(o => o.key === GD.pow);
  GD.pow = i + 1 >= list.length ? null : list[i + 1].key;
  return GD.pow;
}
function gfPickPower(key) {
  if (!GD || GD.mode === 'watch') return false;
  if (!key) { GD.pow = null; return true; }
  const o = gfPowerOptions(GD.you).find(x => x.key === key && x.ok); if (!o) return false;
  GD.pow = key; return true;
}
// a power's pros and cons for this down, this distance and this spot on the field ({ pro, con, note })
function gfPowerTip(key) {
  const side = GD ? GD.you : 0, o = gfPowerOptions(side).find(x => x.key === key); if (!o) return null;
  const T = { pro: [o.desc], con: [], note: [] }, off = gfRole(side) === 'off', near = G.ball >= 80;
  const name = o.fits === 'run' ? 'a run' : 'a pass (short, deep or a screen)';
  if (o.fits !== 'any') {
    if (off) T.con.push(`Only helps ${name}: wasted on the other kind of play.`);
    else T.con.push(`Only helps against ${name}: wasted if they call the other.`);
  }
  if (off && o.fits === 'run' && G.togo <= 3) T.pro.push('Short yardage: a good down to run.');
  if (off && o.fits === 'pass' && G.togo >= 7) T.pro.push('Long yardage: a passing down.');
  if (!off && o.fits !== 'any' && gfExpect() === o.fits) T.pro.push(`${G.togo >= 7 ? 'Long' : 'Short'} yardage: they will probably ${o.fits === 'run' ? 'run' : 'pass'}.`);
  if (!off && o.fits !== 'any' && gfExpect() !== 'any' && gfExpect() !== o.fits) T.con.push(`${G.togo >= 7 ? 'Long' : 'Short'} yardage: they will probably ${gfExpect() === 'run' ? 'run' : 'pass'}.`);
  if (G.down >= 3) T.pro.push(`${GF_ORD[G.down]} down: a big one to spend on.`);
  if (near) T.pro.push(off ? 'Near their goal line: a touchdown is close.' : 'Near your goal line: every yard counts.');
  T.con.push(`${o.cost} mana (${Math.max(0, gfMana(side) - o.cost)} left after). Both sides get 1 at every new drive, and you get 1 more when they score.`);
  const rs = (GF_POW_BY[o.id] || {}).rest, rz = (GF_ULT_BY[o.id] || {}).restZ, tired = gfTired(side);
  if ((rs || rz) && tired > .25) T.pro.push(`Your seven are tired (${Math.round((1 - tired) * 100)}% stamina on average): this one gives some back.`);
  const after = o.stam - o.stamCost;
  if (o.sit) T.note.push(`The team's, not a player's: once a game, ${GF_SIT[o.id].when}. No stamina.`);
  else T.con.push(`${o.n} spends ${o.stamCost} stamina (now ${o.stam}%)${after < 50 ? ': then slower and weaker until rested' : ''}.`);
  if (o.ult || (o.sit && GF_SIT[o.id].zone)) {
    T.note.push(`Once a game. The zone lasts ${GF_ULT_PLAYS} plays or the drive, whichever ends first.`);
    if (G.down === GF_RULES.downs) T.con.push('Fourth down: if the drive ends here, the zone goes with it.');
  }
  if (!o.ok) T.con.unshift(`Can't cast now: ${o.why}.`);
  return T;
}
// what powers did on a play, for the reason after it
function gfPowWhy(pw) {
  const out = [], cast = [pw && pw.off, pw && pw.def].filter(Boolean);
  for (const c of cast) out.push(`${c.n} cast ${c.name}${c.ult ? ' (once a game)' : ''}.`);
  const seen = new Set();
  for (const e of (L ? L.ev : [])) if (e.k === 'pow' && !seen.has(e.o)) { seen.add(e.o); out.push(e.o); }
  const zones = (G.zones || []).filter(z => !cast.some(c => c.id === z.id)).map(z => z.n);
  if (zones.length) out.push(`On the field: ${zones.join(', ')}.`);
  return out.join(' ');
}
// the book of powers by kind, for How to play
function gfPowerBook() {
  return Object.fromEntries(Object.keys(GF_KIND).map(k => [k, Object.assign({ off: GF_POW[k] && GF_POW[k][0], def: GF_POW[k] && GF_POW[k][1], ult: GF_ULT[k] },
    GF_POW2[k] ? { off2: GF_POW2[k][0], def2: GF_POW2[k][1] } : {})]));
}
