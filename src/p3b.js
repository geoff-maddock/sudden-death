/* p3b: the bosses. Three per act, one drawn at random each run. Each has a brain that reads the fight,
   phases that change it at half health (or lower), and signature effects (vfx) for the arena. */
Object.assign(ST, {
  charge: { n: 'Winding Up', col: '#ff6a3d', desc: 'Getting ready for something big. Watch its intent.' },
  air: { n: 'Airborne', col: '#9fd2ff', desc: 'Up in the rafters: Attacks deal half damage to it.' },
  soaked: { n: 'Soaked', col: '#7fb8e8', d: 1, desc: 'Draws 1 fewer card at the start of each turn, for that many turns.' },
  squad: { n: 'Squad Spirit', col: '#ffd166', desc: 'Gains 3 Block at the start of its turn for each cheerleader still standing.' },
  enraged: { n: 'Enraged', col: '#ff3a2a', desc: 'In its last phase. Hits harder.' },
});
// the act boss lists: one is drawn per run
ENCOUNTERS[0].boss = ['argus', 'groundskeeper', 'kqueen'];
ENCOUNTERS[1].boss = ['cube', 'zamboni', 'banshee'];
ENCOUNTERS[2].boss = ['baron', 'wyrm', 'mirror'];
function bossId() { RUN.bossIds = RUN.bossIds || [null, null, null]; if (!RUN.bossIds[RUN.act]) RUN.bossIds[RUN.act] = pick(ENCOUNTERS[RUN.act].boss); return RUN.bossIds[RUN.act]; }

/* ----- the old guard, smartened up ----- */
Object.assign(ENEMIES.argus.moves, {
  ray: { n: 'Eye Rays', ops: e => [['a', e.phase ? 5 : 7, e.phase ? 3 : 2]], vfx: 'beam' },
  balk: { n: 'Balk!', ops: [['stripblock'], ['a', 5]], vfx: 'beam' },
  review: { n: 'Under Review', ops: [['b', 18], ['s', 'str', 2]], vfx: 'shock' },
});
ENEMIES.argus.brain = e => {
  if (B.P.block >= 14 && e.hist[e.hist.length - 1] !== 'balk') return 'balk';           // you turtle, it calls a balk and wipes your Block
  if (RUN.hp <= RUN.maxhp * .25) return 'ray';                                          // smells blood
  return null;
};
ENEMIES.argus.phases = [{ at: .5, n: 'Video Review', sub: 'Every eye opens. Three rays now.', fn: e => { addSt(e, 'str', 1); e.block += 10; } }];
ENEMIES.argus.flav = 'He has never missed a call. He has never made a correct one. Wipes out a turtle’s Block, and goes for the kill when you are low.';

Object.assign(ENEMIES.cube.moves, {
  ooze: { n: 'Ooze Through', ops: [['a', 15, 1, 'pierce']], vfx: 'orb' },
  engulf: { n: 'Engulf', ops: [['engulf', 2], ['b', 10]], vfx: 'cards' },
});
ENEMIES.cube.brain = e => (B.P.block >= 15 ? 'ooze' : null); // too much Block? it seeps straight through
ENEMIES.cube.phases = [{ at: .5, n: 'Mitosis', sub: 'The cube splits in two.', fn: e => splitCube(e) }];
ENEMIES.cube.flav = 'Stops everything. Keeps everything. Seeps through a wall of Block, and splits in two when it is half gone.';
EN('cubelet', 'Gelatinous Half', 'cube', [1, 1], { slam: { n: 'Pad Slap', ops: [['a', 11]] }, jiggle: { n: 'Jiggle', ops: [['a', 5, 2]] }, engulf: { n: 'Swallow', ops: [['engulf', 1], ['b', 6]], vfx: 'cards' } }, { seq: ['slam', 'jiggle', 'engulf'] }, { team: ENEMIES.cube.team, small: 1, flav: 'Half a goaltender is still a goaltender.' });
function splitCube(e) {
  const half = Math.max(12, Math.floor(e.hp / 2)), at = B.enemies.indexOf(e);
  e.dead = true; e.hp = 0; e.split = 1; fx({ k: 'die', e: e.uid, quiet: 1 });
  for (const i of [0, 1]) { const c = spawn('cubelet', at + i); c.max = c.hp = half; c.st.str = sv(e, 'str'); fx({ k: 'spawn', e: c.uid }); }
  log('The cube splits into two halves.', 'foe');
}
ENEMIES.cubelet.boss = 0;

ENEMIES.baron.moves.check = { n: 'Hellfire Check', ops: e => [['a', 22, 1, B.P.block >= 20 ? 'pierce' : null]], vfx: 'shock' };
ENEMIES.baron.moves.dunk.vfx = 'shock'; ENEMIES.baron.moves.dunk.far = 1;
ENEMIES.baron.moves.pitch.vfx = 'orb'; ENEMIES.baron.moves.bean.vfx = 'orb'; ENEMIES.baron.moves.blitz.far = 1;
ENEMIES.baron.phases = [{ at: .25, n: 'Two-Minute Warning', sub: 'The Commissioner stops pretending to be fair.', fn: e => { addSt(e, 'str', 4); e.st.enraged = 1; e.block += 20; } }];
ENEMIES.baron.aura = 'embers';
ENEMIES.baron.flav = 'Owns the league, the pit, the refs and the concession stand. Changes sport every quarter, checks through a wall of Block, and loses his temper at the two-minute warning.';

/* ----- Act 1: the Sunken Dugout ----- */
cloneKind('bogtroll', 'troll', { skin: '#4f6a4a', h: 1.22, w: 1.5, eye: '#c9ff6a' }, { moss: true });
EN('groundskeeper', 'The Drowned Groundskeeper', 'bogtroll', [128, 128], {
  rake: { n: 'Rake the Infield', ops: [['a', 13]], far: 1 },
  drag: { n: 'Drag the Infield', ops: [['a', 5, 2], ['add', 'slimed', 2, 'draw']] },
  rain: { n: 'Rain Delay', ops: [['p', 'soaked', 1], ['p', 'weak', 1], ['a', 6]], vfx: 'rain' },
  tarp: { n: 'Roll Out the Tarp', ops: [['b', 14], ['s', 'regen', 3]], vfx: 'shock' },
}, { seq: ['rake', 'drag', 'rain'] }, { boss: 1, sport: 'baseball', team: { name: 'Grounds Crew', short: 'GRD', color: '#3f6a3a', light: '#cfe8a0' }, wpn: 'rake', flav: 'Has kept this field for four hundred seasons and resents every one of you. Calls a rain delay when you hide behind Block, tarps up when hurt, and floods the field at half health.' });
ENEMIES.groundskeeper.brain = e => {
  const last = e.hist[e.hist.length - 1], since = e.hist.length - e.hist.lastIndexOf('tarp');
  if (e.hp < e.max * .45 && since >= 4 && e.hist.filter(h => h === 'tarp').length < 2) return 'tarp';        // patches himself up, but not every turn
  if (B.lt && B.lt.blk >= 14 && last !== 'rain') return 'rain';                   // you blocked a lot: wash out your next hand
  return null;
};
ENEMIES.groundskeeper.phases = [{ at: .5, n: 'Flood the Field', sub: 'The infield turns to swamp. Things crawl out.', fn: e => { for (let i = 0; i < 1; i++) if (alive().length < 4) { const o = spawn('ooze', i ? undefined : 0); fx({ k: 'spawn', e: o.uid }); } addSt(B.P, 'soaked', 1); } }];

cloneKind('kqueen', 'kobold', { skin: '#d8743a', h: 1.02, w: 1.1, eye: '#fff07a' });
EN('kqueen', 'Queen Pompadour, Captain of Cheer', 'kqueen', [106, 106], {
  baton: { n: 'Flaming Baton Twirl', ops: [['a', 4, 3], ['p', 'burn', 1]], vfx: 'orb' },
  pyramid: { n: 'Human Pyramid', ops: [['ba', 7], ['sa', 'str', 1]], vfx: 'shock' },
  tryouts: { n: 'Tryouts!', ops: [['summon', 'cheer', 4], ['summon', 'cheer', 4]], vfx: 'summon' },
  snack: { n: 'Snack Break', ops: [['sacrifice', 22, 3]], vfx: 'chomp' },
  solo: { n: 'Solo Routine', ops: [['a', 17]], far: 1 },
}, { seq: ['baton', 'pyramid'] }, { boss: 1, escort: ['cheer', 'cheer'], team: { name: 'Spirit Squad', short: 'RAH', color: '#d9407a', light: '#ffd0e4' }, crown: 1, flav: 'Every cheerleader in the Dugout answers to her, and some of them she eats. Shielded by her squad; recruits when alone; snacks on a cheerleader when hurt.' });
ENEMIES.kqueen.brain = e => {
  const squad = alive().filter(o => o !== e).length, last = e.hist[e.hist.length - 1];
  if (!squad && last !== 'tryouts' && e.hist.filter(h => h === 'tryouts').length < 3) return 'tryouts'; // alone: hold tryouts
  if (!squad) return 'solo';
  if (e.hp < e.max * .5 && last !== 'snack') return 'snack';                    // hurt: eat a cheerleader
  return null;
};
ENEMIES.kqueen.onTurn = e => { const n = alive().filter(o => o !== e).length; if (n) { e.block += 3 * n; fx({ k: 'num', e: e.uid, t: `+${3 * n}`, col: '#9fd2ff' }); } };
ENEMIES.kqueen.phases = [{ at: .4, n: 'Halftime Show', sub: 'Pyrotechnics. Lots of them.', fn: e => { addSt(e, 'str', 3); e.st.enraged = 1; } }];

/* ----- Act 2: the Rimegrave Arena ----- */
EN('zamboni', 'Lord Resurfacer, the Zamboni Lich', 'zamboni', [200, 200], {
  resurface: { n: 'Resurface the Ice', ops: [['stripblock'], ['cleanse'], ['b', 14]], vfx: 'ice', far: 1 },
  freeze: { n: 'Freeze the Lines', ops: [['add', 'frostbite', 2, 'draw'], ['p', 'weak', 1], ['a', 8]], vfx: 'ice' },
  lap: { n: 'Victory Lap', ops: [['a', 6, 3]], far: 1 },
  fill: { n: 'Fill the Tank', ops: [['charge'], ['b', 16]], vfx: 'shock' },
  flood: { n: 'Flash Flood', ops: [['a', 24], ['p', 'soaked', 1]], vfx: 'ice', far: 1 },
}, { seq: ['lap', 'freeze', 'fill'] }, { boss: 1, sport: 'hockey', team: { name: 'Rimegrave Wardens', short: 'RIM', color: '#6f9fc8', light: '#e3f3ff' }, flav: 'Rides the machine that has resurfaced this rink since the dead first skated it. Wipes your Block and its own curses with one pass, and fills the tank before a flood.' });
ENEMIES.zamboni.brain = e => {
  const last = e.hist[e.hist.length - 1];
  if (sv(e, 'charge')) return 'flood';                                             // a full tank always floods
  if ((B.P.block >= 12 || sv(e, 'weak') + sv(e, 'vuln') + sv(e, 'psn') >= 4) && last !== 'resurface') return 'resurface';
  return null;
};
ENEMIES.zamboni.phases = [{ at: .5, n: 'Overtime Ice', sub: 'The ice gets faster. So does he.', fn: e => { addSt(e, 'str', 2); e.block += 15; } }];

cloneKind('banshee', 'wraith', { skin: '#d8e4f0', eye: '#7ff0ff', robe: '#4a5a7a' });
EN('banshee', 'Mordant, the Banshee Coach', 'banshee', [175, 175], {
  wail: { n: 'Banshee Wail', ops: [['a', 6, 2], ['p', 'vuln', 1]], vfx: 'wail' },
  spikes: { n: 'Spiked Pads', ops: [['s', 'thorns', 2], ['b', 12]], vfx: 'shock' },
  shatter: { n: 'Shatter the Shell', ops: [['stripblock'], ['a', 11]], vfx: 'wail' },
  unmake: { n: 'Wail of Unmaking', ops: [['dispel', 2], ['a', 8]], vfx: 'wail' },
  drill: { n: 'Two-Minute Drill', ops: [['s', 'str', 1], ['summon', 'harpyf', 2]], vfx: 'summon' },
}, { seq: ['wail', 'drill', 'wail'] }, { boss: 1, sport: 'hockey', team: { name: 'Gallowmere Ghosts', short: 'BAN', color: '#5a7ab8', light: '#d8e8ff' }, aura: 'wisps', flav: 'Watches tape on every opponent, living or dead. She reads your last turn and coaches against it: spikes for heavy hitters, a shattering wail for turtles, unmaking for anyone leaning on powers.' });
ENEMIES.banshee.brain = e => {
  const L = B.lt, last = e.hist[e.hist.length - 1];
  if (!L) return null;
  const powers = ['ritual', 'plate', 'barricade', 'haunt', 'kindle', 'nightgame', 'trollblood', 'spin', 'tempest', 'necro', 'basilisk', 'coldsnap', 'pads', 'helmet', 'shoulder', 'luckybat', 'sweat', 'ward', 'thorns', 'dex', 'str'].filter(k => sv(B.P, k) > 0).length;
  if (L.atk >= 3 && !sv(e, 'thorns')) return 'spikes';                             // you swung a lot: spiked pads
  if ((L.blk >= 14 || B.P.block >= 14) && last !== 'shatter') return 'shatter';     // you turtled: shatter it
  if (powers >= 3 && last !== 'unmake') return 'unmake';                          // you built an engine: unmake it
  return null;
};
ENEMIES.banshee.phases = [{ at: .5, n: 'Second-Half Adjustments', sub: 'She has seen enough tape.', fn: e => { addSt(e, 'thorns', 1); addSt(e, 'str', 1); } }];

/* ----- Act 3: the Brimstone Pit ----- */
EN('wyrm', 'Vharokk, the Sump Wyrm', 'wyrm', [290, 290], {
  claw: { n: 'Rake and Claw', ops: [['a', 10, 2]] },
  tail: { n: 'Tail Sweep', ops: [['stripblock'], ['a', 11], ['p', 'weak', 1]], vfx: 'shock' },
  inhale: { n: 'Deep Breath', ops: [['charge'], ['b', 22]], vfx: 'inhale' },
  breath: { n: 'Brimstone Breath', ops: [['a', 22], ['p', 'burn', 3]], vfx: 'breath' },
  wing: { n: 'Take Wing', ops: [['s', 'air', 2], ['b', 10]], vfx: 'wing' },
  dive: { n: 'Dive Bomb', ops: [['land'], ['a', 22]], vfx: 'shock', far: 1 },
}, { seq: ['claw', 'inhale', 'breath', 'tail'] }, { boss: 1, sport: 'football', team: { name: 'Pit Fiends', short: 'WYR', color: '#7a2a1a', light: '#ffb347' }, aura: 'smoke', flav: 'Older than the league and sleeping on its trophies. Breathes fire after a deep breath, unless you have built a wall for it, in which case it sweeps the wall away first. Takes wing at half health.' });
ENEMIES.wyrm.brain = e => {
  const last = e.hist[e.hist.length - 1];
  if (sv(e, 'charge')) return B.P.block >= 26 ? 'tail' : 'breath';                // breath into a shield wall is wasted: sweep it first, breathe later
  if (sv(e, 'air')) return 'dive';                                                // it never stays up long: it dives
  if (e.phase && last !== 'wing' && !sv(e, 'air') && e.hist.length % 3 === 0) return 'wing';
  return null;
};
ENEMIES.wyrm.phases = [{ at: .5, n: 'The Wyrm Takes Wing', sub: 'Your Attacks do half damage while it is airborne.', fn: e => { addSt(e, 'air', 2); addSt(e, 'str', 2); } }, { at: .2, n: 'Death Throes', sub: 'It has nothing left to lose.', fn: e => { addSt(e, 'str', 4); e.st.enraged = 1; } }];

EN('mirror', 'The Mirror Coach', 'mirror', [315, 315], {
  mirror: { n: 'Mirror Play', ops: e => [['a', clamp(Math.round(((B.lt && B.lt.top) || 18) * .8), 16, 44)]], vfx: 'mirror' },
  film: { n: 'Film Study', ops: [['stealbest'], ['s', 'str', 3], ['a', 8]], vfx: 'cards' },
  trash: { n: 'Trash Talk', ops: [['p', 'weak', 2], ['p', 'vuln', 2], ['a', 12]], vfx: 'wail' },
  copy: { n: 'Copycat', ops: [['mirrorstr'], ['b', 18]], vfx: 'mirror' },
}, { seq: ['mirror', 'film', 'trash'] }, { boss: 1, team: { name: 'The Other Side', short: 'MIR', color: '#2a1f3a', light: '#b494ff' }, aura: 'wisps', flav: 'Your own captain, in the other team’s colours. Hits back with your best shot from last turn, steals your best card off the top of the deck, and copies your Strength.' });
ENEMIES.mirror.brain = e => {
  const L = B.lt, last = e.hist[e.hist.length - 1];
  if (L && L.top >= 20 && last !== 'mirror') return 'mirror';                     // you hit hard: it hits back with your own shot
  if (sv(B.P, 'str') > sv(e, 'str') && last !== 'copy') return 'copy';             // you got stronger: so does it
  return null;
};
ENEMIES.mirror.phases = [{ at: .5, n: 'Through the Looking Glass', sub: 'It stops copying you and starts being you.', fn: e => { e.st.str = Math.max(sv(e, 'str'), sv(B.P, 'str')) + 3; e.block += 25; } }];
