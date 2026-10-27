/* ================= ultimates: one field-changing power per creature (once per game, 3 mana) ================= */
// role: where it appears (bat = a stance, pitch = a pitch, run = the runner's spell list, field = the fielding list).
// zone: what it leaves on the field. It lasts for `turns` at-bats or until the half-inning ends, whichever comes first.
const ULT = {
  smoke:      { kind: 'goblin',   role: 'run',   name: 'Smoke Bomb',      desc: 'Hurls a smoke bomb over the infield. Infielders lose the ball in the haze: slower reactions, double the bobbles.', zone: { shape: 'infield', react: .45, bobble: 2.2, vis: 'smoke' } },
  howl:       { kind: 'werewolf', role: 'field', name: 'Blood Moon Howl', desc: 'A howl that chills the blood. Every opposing runner runs 22% slower in fear.', zone: { shape: 'global', rSpd: .78, vis: 'howl' } },
  fissure:    { kind: 'dwarf',    role: 'bat',   name: 'Earthshatter',    desc: 'Buries the axe in the ground before the pitch. The infield cracks open: infielders move 28% slower and grounders take bad hops.', zone: { shape: 'infield', fSpd: .72, bobble: 1.8, vis: 'fissure' } },
  crater:     { kind: 'ogre',     role: 'field', name: 'Crater Slam',     desc: 'Belly-flops onto third base. Runners wading through the crater go half speed, and may twist an ankle.', zone: { shape: 'circle', base: 3, r: 30, rSpd: .5, trip: 16, vis: 'crater' } },
  stampede:   { kind: 'minotaur', role: 'run',   name: 'Stampede',        desc: 'Charges: double speed and untaggable for 2 s, trampling any fielder in the way. The churned ground slows fielders around that base.', zone: { shape: 'circle', r: 30, fSpd: .7, vis: 'churn' }, instant: true },
  bog:        { kind: 'troll',    role: 'bat',   name: 'Bog Tide',        desc: 'Calls up the swamp. The outfield turns to bog: outfielders move 40% slower and the ball dies in the mud.', zone: { shape: 'outfield', fSpd: .6, roll: 2.6, vis: 'bog' } },
  rampart:    { kind: 'golem',    role: 'field', name: 'Rampart',         desc: 'The outfield wall grows from 11 ft to 26 ft. Home runs need a lot more hang time.', zone: { shape: 'global', fence: 26, vis: 'rampart' } },
  tempest:    { kind: 'harpy',    role: 'field', name: 'Tempest',         desc: 'A gale blows in from the outfield. Fly balls carry about 15% less.', zone: { shape: 'global', carry: .82, vis: 'tempest' } },
  inferno:    { kind: 'kobold',   role: 'pitch', name: 'Inferno',         desc: 'A pitch wreathed in fire. If it is hit, the ground bursts into flame where it lands. Anyone crossing the fire gets burned; catching it on the fly hurts too.', zone: { shape: 'circle', r: 26, burn: 22, fSpd: .85, vis: 'fire' }, onLand: true },
  overgrowth: { kind: 'elf',      role: 'bat',   name: 'Overgrowth',      desc: 'The infield grass grows knee-high. Grounders crawl, and infielders wade 20% slower.', zone: { shape: 'infield', fSpd: .8, roll: 2.2, vis: 'grass' } },
  fog:        { kind: 'wraith',   role: 'field', name: 'Fog of the Dead', desc: 'A grave-fog rolls over the field. Batters lose the pitch: no landing marker or timing ring, and the CPU reads pitches far worse.', zone: { shape: 'global', hideMarker: true, vis: 'fog' } },
  eclipse:    { kind: 'vampire',  role: 'run',   name: 'Eclipse',         desc: 'Blots out the torches. Fielders react slower in the dark and bobble almost twice as often.', zone: { shape: 'global', react: .4, bobble: 1.8, vis: 'eclipse' } },
  gravehands: { kind: 'lich',     role: 'field', name: 'Grave Hands',     desc: 'Skeletal hands claw up along the basepaths and grab passing runners, rooting them in place.', zone: { shape: 'paths', grab: .6, vis: 'hands' } },
  plague:     { kind: 'zombie',   role: 'bat',   name: 'Plague Cloud',    desc: 'Coughs up a cloud of grave gas over the infield. At the start of every play each infielder in it must resist (d20 + POW/2 vs 13) or be knocked out for 2 to 4 at-bats. The undead shrug it off.', zone: { shape: 'infield', gas: true, vis: 'gas' } },
  garden:     { kind: 'gorgon',   role: 'field', name: 'Stone Garden',    desc: 'Turns the ground around second base to crumbling stone statues. Runners there move at half speed.', zone: { shape: 'circle', base: 2, r: 34, rSpd: .5, vis: 'stones' } },
  webburst:   { kind: 'spider',   role: 'bat',   name: 'Web Burst',       desc: 'Sprays the outfield with webbing. Outfielders stick and move 45% slower.', zone: { shape: 'outfield', fSpd: .55, vis: 'web' } },
  bonestorm:  { kind: 'skeleton', role: 'run',   name: 'Bone Storm',      desc: 'Bursts apart and reassembles on the next base. Bones litter the infield: infielders stumble 22% slower.', zone: { shape: 'infield', fSpd: .78, vis: 'bones' }, instant: true },
  blizzard:   { kind: 'witch',    role: 'pitch', name: 'Blizzard',        desc: 'A frozen pitch that brings the snow. Runners slip (30% slower) and shivering batters get a 15% smaller swing circle.', zone: { shape: 'global', rSpd: .7, swing: .85, vis: 'snow' } },
};
const ULT_TURNS = 3, ULT_COST = 3, ULT_STAM = 6;
for (const [id, u] of Object.entries(ULT)) {
  AB[id] = { name: '★ ' + u.name, type: 'ult', role: u.role, cost: ULT_COST, ult: true, desc: u.desc };
  if (u.role === 'pitch') PITCHES[id] = id === 'inferno'
    ? { name: '★ Inferno', T: .41, bx: 0, bh: -.05, ctrl: .2, cost: ULT_COST, magic: true, ult: true, fx: 'fire', desc: u.desc }
    : { name: '★ Blizzard', T: .56, bx: .15, bh: -.2, ctrl: .16, cost: ULT_COST, magic: true, ult: true, fx: 'frost', desc: u.desc };
}
const ULT_BY_KIND = {}; for (const [id, u] of Object.entries(ULT)) ULT_BY_KIND[u.kind] = id;
for (const t of Object.values(TEAMS)) for (const p of t.roster) p.ult = ULT_BY_KIND[p.kind] || null;

