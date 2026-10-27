/* ================= data: teams ================= */
const TEAMS = {
  ironmaw: {
    id: 'ironmaw', name: 'Ironmaw Marauders', short: 'IRN', css: 'iron',
    color: '#d9573b', trim: '#1d1210', light: '#f09a7f',
    motto: 'Break bats. Break bones. Break for the pub.',
    roster: [
      { n: 'Snikt', kind: 'goblin', race: 'Goblin Rogue', pos: '2B', num: 3, hand: 'L', pow: 3, con: 7, spd: 9, arm: 5, fld: 7, wpn: 'bat', bat: 'bunt', run: 'shadowstep', field: null, flav: 'Leads the league in stolen wallets.' },
      { n: 'Vexa', kind: 'werewolf', race: 'Werewolf', pos: 'SS', num: 11, hand: 'R', pow: 6, con: 6, spd: 9, arm: 7, fld: 8, wpn: 'spiked', bat: null, run: 'sprint', field: 'pounce', flav: 'Hits .340 under a full moon, .220 otherwise.' },
      { n: 'Thrumgar', kind: 'dwarf', race: 'Dwarf Berserker', pos: 'RF', num: 7, hand: 'R', pow: 9, con: 5, spd: 4, arm: 7, fld: 5, wpn: 'axe', bat: 'axe', run: null, field: null, flav: 'Was told a bat is a tool. Brought a better tool.' },
      { n: 'Mawgrum', kind: 'ogre', race: 'Ogre', pos: '3B', num: 99, hand: 'R', pow: 10, con: 3, spd: 3, arm: 8, fld: 4, wpn: 'log', bat: 'crush', run: null, field: 'devour', flav: 'Guards the hot corner. Also eats there.' },
      { n: 'Horn', kind: 'minotaur', race: 'Minotaur', pos: 'CF', num: 44, hand: 'R', pow: 8, con: 5, spd: 7, arm: 7, fld: 6, wpn: 'hammer', bat: null, run: 'bullrush', field: null, flav: 'Never lost in the outfield. Never lost anywhere.' },
      { n: 'Grukk', kind: 'troll', race: 'Cave Troll', pos: 'C', num: 0, hand: 'R', pow: 8, con: 4, spd: 2, arm: 9, fld: 5, wpn: 'tree', bat: 'seismic', run: null, field: 'boulder', flav: 'Regenerates foul tips. Gnaws on the catcher’s mask.' },
      { n: 'Brakka', kind: 'golem', race: 'Stone Golem', pos: '1B', num: 1, hand: 'L', pow: 7, con: 5, spd: 1, arm: 5, fld: 6, wpn: 'pillar', bat: null, run: 'stoneskin', field: 'quake', flav: 'Slowest runner alive, if alive is the word.' },
      { n: 'Kreel', kind: 'harpy', race: 'Harpy', pos: 'LF', num: 22, hand: 'L', pow: 4, con: 6, spd: 8, arm: 6, fld: 9, wpn: 'bat', bat: 'shriek', run: 'glide', field: 'flight', flav: 'Has robbed nine home runs and one bakery.' },
      { n: 'Scorch', kind: 'kobold', race: 'Kobold Pyromancer', pos: 'P', num: 13, hand: 'R', pow: 3, con: 4, spd: 5, arm: 8, fld: 5, wpn: 'bat', bat: null, run: null, field: null, pitches: ['heater', 'slider', 'change', 'fireball', 'meteor'], flav: 'Three feet tall, ninety-nine miles an hour, always on fire.' },
    ],
  },
  mirewood: {
    id: 'mirewood', name: 'Mirewood Hexers', short: 'MIR', css: 'mire',
    color: '#3fbf9f', trim: '#0e1f1b', light: '#8ff0d8',
    motto: 'The bog remembers every out.',
    roster: [
      { n: 'Thistle', kind: 'elf', race: 'Elf Ranger', pos: 'CF', num: 8, hand: 'L', pow: 4, con: 9, spd: 8, arm: 6, fld: 8, wpn: 'bat', bat: 'eagle', run: 'fleet', field: null, flav: 'Can read a curveball from four hundred feet.' },
      { n: 'Wisp', kind: 'wraith', race: 'Wraith', pos: 'SS', num: 13, hand: 'R', pow: 3, con: 6, spd: 8, arm: 6, fld: 8, wpn: 'scythe', bat: null, run: 'invis', field: 'haunt', flav: 'Technically never been tagged. Technically never been seen.' },
      { n: 'Lady Sanguine', kind: 'vampire', race: 'Vampire', pos: '3B', num: 6, hand: 'R', pow: 6, con: 7, spd: 7, arm: 7, fld: 7, wpn: 'cane', bat: 'pact', run: 'swarm', field: 'mesmer', flav: 'Only plays night games. Insists on it in her contract.' },
      { n: 'Ashgrave', kind: 'lich', race: 'Lich', pos: 'RF', num: 66, hand: 'L', pow: 8, con: 6, spd: 3, arm: 6, fld: 5, wpn: 'staff', bat: 'dispel', run: null, field: 'telek', flav: 'Keeps his batting average in a phylactery.' },
      { n: 'Grimsby', kind: 'zombie', race: 'Zombie Brute', pos: '1B', num: 31, hand: 'R', pow: 9, con: 4, spd: 2, arm: 5, fld: 4, wpn: 'tomb', bat: 'undying', run: null, field: null, flav: 'Swings his own headstone. Refuses to strike out, or die.' },
      { n: 'Sethra', kind: 'gorgon', race: 'Gorgon', pos: 'LF', num: 9, hand: 'R', pow: 6, con: 5, spd: 6, arm: 6, fld: 7, wpn: 'bat', bat: 'gaze', run: null, field: 'petrify', flav: 'Umpires will not make eye contact with her.' },
      { n: 'Silk', kind: 'spider', race: 'Spider Queen', pos: '2B', num: 88, hand: 'R', pow: 5, con: 7, spd: 6, arm: 6, fld: 9, wpn: 'bat', bat: 'sticky', run: null, field: 'web', flav: 'Turns two with eight arms.' },
      { n: 'Ossuary', kind: 'skeleton', race: 'Skeleton Knight', pos: 'C', num: 2, hand: 'R', pow: 5, con: 5, spd: 4, arm: 8, fld: 6, wpn: 'bone', bat: null, run: null, field: 'block', flav: 'Blocks the plate with 206 bones and a grudge.' },
      { n: 'Morwen', kind: 'witch', race: 'Frost Witch', pos: 'P', num: 13, hand: 'R', pow: 2, con: 4, spd: 5, arm: 7, fld: 6, wpn: 'broom', bat: null, run: null, field: null, pitches: ['fastball', 'curve', 'change', 'frost', 'hex', 'phantom'], flav: 'Her changeup has a changeup.' },
    ],
  },
};

