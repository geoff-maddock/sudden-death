/* ---------- cards ---------- */
// fx ops: ['d',n,hits,scope] damage | ['b',n] block | ['s',status,n,scope] | ['draw',n] | ['nrg',n] | ['heal',n] | ['lose',n]
// ['roll',dc,yes,no] d20 | ['kill',ops] if this card kills its target | ['add',id,n,where] | ['ifst',status,yes,no]
// scope: 'one' (chosen target), 'all', 'rand', 'self'. Default comes from the card's tgt.
const CARDS = {};
function K(id, n, kind, type, cost, rar, tgt, fx, extra = {}) { CARDS[id] = Object.assign({ id, n, kind, type, cost, rar, tgt, fx }, extra); }
// starters, any club
K('check', 'Body Check', 'any', 'atk', 1, 's', 'one', [['d', 6]], { fl: 'Finish your check.', sport: 'hockey' });
K('hold', 'Hold the Line', 'any', 'skl', 1, 's', 'self', [['b', 5]], { fl: 'Fourth and goal. Nobody gets through.', sport: 'football' });

// goblin — the pickpocket middle infielder
K('gob_steal', 'Steal Second', 'goblin', 'atk', 0, 's', 'one', [['d', 3], ['draw', 1]], { fl: 'Gone before the throw.', sport: 'baseball' });
K('gob_pick', 'Pickpocket', 'goblin', 'atk', 1, 'c', 'one', [['d', 6], ['kill', [['gold', 12]]]], { fl: 'Lifts a wallet on the way past.' });
K('gob_bunt', 'Squeeze Bunt', 'goblin', 'atk', 1, 'c', 'one', [['d', 4], ['s', 'weak', 2]], { sport: 'baseball' });
K('gob_smoke', 'Smoke Bomb', 'goblin', 'skl', 1, 'u', 'self', [['b', 8], ['s', 'weak', 1, 'all']], { fl: 'What goblin?' });
K('gob_five', 'Five-Hole Flurry', 'goblin', 'atk', 1, 'u', 'one', [['d', 2, 4]], { sport: 'hockey' });
K('gob_trick', 'Hidden Ball Trick', 'goblin', 'atk', 0, 'r', 'one', [['ifst', 'weak', [['d', 13]], [['d', 4]]]], { fl: 'Check your glove.', sport: 'baseball' });
// kobold — the pyromancer pitcher
K('kob_fire', 'Fireball Pitch', 'kobold', 'atk', 1, 's', 'one', [['d', 5], ['s', 'burn', 3]], { fl: 'Ninety miles an hour, nine hundred degrees.', sport: 'baseball' });
K('kob_heat', 'High Heat', 'kobold', 'atk', 1, 'c', 'one', [['d', 9]], { sport: 'baseball' });
K('kob_brush', 'Brushback', 'kobold', 'atk', 1, 'c', 'one', [['d', 4], ['s', 'vuln', 2]], { sport: 'baseball' });
K('kob_melt', 'Meltwater', 'kobold', 'skl', 1, 'u', 'all', [['s', 'burn', 4, 'all']], { fl: 'The crease is always slush.' });
K('kob_kindle', 'Kindling', 'kobold', 'pow', 1, 'u', 'self', [['s', 'kindle', 2, 'self']]);
K('kob_meteor', 'Meteor Fastball', 'kobold', 'atk', 3, 'r', 'one', [['d', 26], ['s', 'burn', 6]], { sport: 'baseball' });
// werewolf — the captain who bites
K('wlf_pounce', 'Pounce', 'werewolf', 'atk', 1, 's', 'one', [['d', 9]], { fl: 'Thirty feet, all teeth.' });
K('wlf_swipe', 'Feral Swipe', 'werewolf', 'atk', 1, 'c', 'one', [['d', 4, 2]]);
K('wlf_pack', 'Pack Hunt', 'werewolf', 'atk', 2, 'c', 'all', [['d', 8]]);
K('wlf_howl', 'Blood Moon Howl', 'werewolf', 'skl', 1, 'u', 'all', [['s', 'weak', 2, 'all']], { ex: 1 });
K('wlf_moon', 'Full Moon', 'werewolf', 'pow', 2, 'u', 'self', [['s', 'ritual', 1, 'self']], { fl: 'It is always a full moon somewhere.' });
K('wlf_frenzy', 'Feeding Frenzy', 'werewolf', 'atk', 2, 'r', 'one', [['d', 5, 4]]);
// dwarf — the berserker on the blue line
K('dwf_axe', 'Axe Slapshot', 'dwarf', 'atk', 2, 's', 'one', [['d', 14]], { fl: 'Was told a stick is a tool.', sport: 'hockey' });
K('dwf_bash', 'Shield Bash', 'dwarf', 'atk', 1, 'c', 'one', [['d', 6], ['b', 6]]);
K('dwf_ale', 'Ale Break', 'dwarf', 'skl', 1, 'c', 'self', [['heal', 3], ['b', 6]], { fl: 'Between periods. Also during them.' });
K('dwf_forge', 'Forge Ahead', 'dwarf', 'pow', 1, 'u', 'self', [['s', 'plate', 3, 'self']]);
K('dwf_cleave', 'Cleave', 'dwarf', 'atk', 1, 'u', 'all', [['d', 7]]);
K('dwf_rage', 'Berserker Rage', 'dwarf', 'skl', 1, 'r', 'self', [['s', 'str', 3, 'self'], ['lose', 5]], { ex: 1 });
// ogre — the defenseman who eats forwards
K('ogr_log', 'Log Swing', 'ogre', 'atk', 2, 's', 'one', [['d', 15]], { fl: 'Grip it and rip it.', sport: 'baseball' });
K('ogr_slam', 'Belly Slam', 'ogre', 'atk', 1, 'c', 'one', [['bodyslam']], { fl: 'All of him, at once.' });
K('ogr_tuck', 'Tuck In', 'ogre', 'skl', 1, 'c', 'self', [['b', 9]]);
K('ogr_crater', 'Crater Slam', 'ogre', 'atk', 2, 'u', 'all', [['d', 10], ['s', 'weak', 1, 'all']]);
K('ogr_bulk', 'Second Helping', 'ogre', 'pow', 1, 'u', 'self', [['s', 'str', 2, 'self']]);
K('ogr_devour', 'Devour', 'ogre', 'atk', 2, 'r', 'one', [['roll', 11, [['devour', 30, 10]], [['d', 8]]]], { ex: 1, fl: 'The referee may object.' });
// minotaur — the right wing who goes through the net
K('min_gore', 'Gore', 'minotaur', 'atk', 1, 's', 'one', [['d', 7], ['s', 'vuln', 1]]);
K('min_stamp', 'Stampede', 'minotaur', 'atk', 2, 'c', 'all', [['d', 9]]);
K('min_horns', 'Horns Down', 'minotaur', 'skl', 1, 'c', 'one', [['b', 7], ['s', 'vuln', 1]]);
K('min_red', 'Seeing Red', 'minotaur', 'pow', 1, 'u', 'self', [['s', 'rage', 1, 'self']]);
K('min_run', 'Run Through', 'minotaur', 'atk', 2, 'u', 'one', [['d', 18], ['kill', [['nrg', 1]]]], { sport: 'football' });
K('min_bulls', 'Running of the Bulls', 'minotaur', 'atk', 3, 'r', 'rand', [['d', 7, 5]]);
// troll — the grinder who regrows
K('trl_regen', 'Regenerate', 'troll', 'skl', 1, 's', 'self', [['b', 5], ['s', 'regen', 3, 'self']], { fl: 'Between whistles. Also during them.' });
K('trl_boulder', 'Boulder Toss', 'troll', 'atk', 1, 'c', 'one', [['d', 9]]);
K('trl_grind', 'Grind It Out', 'troll', 'atk', 1, 'c', 'one', [['d', 5], ['b', 5]], { sport: 'hockey' });
K('trl_bog', 'Bog Tide', 'troll', 'skl', 2, 'u', 'all', [['s', 'weak', 2, 'all'], ['s', 'vuln', 2, 'all']], { ex: 1 });
K('trl_skull', 'Thick Skull', 'troll', 'pow', 1, 'u', 'self', [['s', 'thorns', 3, 'self']]);
K('trl_blood', 'Troll Blood', 'troll', 'pow', 2, 'r', 'self', [['s', 'trollblood', 3, 'self']]);
// golem — the goalie who is a cliff
K('glm_wall', 'Stone Wall', 'golem', 'skl', 1, 's', 'self', [['b', 9]], { fl: 'In net, he fills it.', sport: 'hockey' });
K('glm_pillar', 'Pillar Swing', 'golem', 'atk', 2, 'c', 'one', [['d', 12], ['b', 5]]);
K('glm_ramp', 'Rampart', 'golem', 'skl', 2, 'c', 'self', [['b', 16]]);
K('glm_bed', 'Bedrock', 'golem', 'pow', 2, 'u', 'self', [['s', 'barricade', 1, 'self']]);
K('glm_quake', 'Quake', 'golem', 'atk', 2, 'u', 'all', [['d', 6], ['roll', 14, [['s', 'stun', 1, 'all']], []]]);
K('glm_mono', 'Monolith', 'golem', 'skl', 3, 'r', 'self', [['b', 30]], { ex: 1 });
// harpy — the winger who flies
K('hrp_swoop', 'Swoop', 'harpy', 'atk', 1, 's', 'one', [['d', 4, 2]], { fl: 'Over every stick and body.' });
K('hrp_rake', 'Talon Rake', 'harpy', 'atk', 1, 'c', 'one', [['d', 3, 3]]);
K('hrp_shriek', 'Shriek', 'harpy', 'skl', 1, 'c', 'all', [['s', 'weak', 1, 'all'], ['draw', 1]]);
K('hrp_flight', 'Take Flight', 'harpy', 'skl', 1, 'u', 'self', [['b', 8], ['s', 'drawnext', 2, 'self']]);
K('hrp_tempest', 'Tempest', 'harpy', 'pow', 2, 'u', 'self', [['s', 'tempest', 4, 'self']]);
K('hrp_hail', 'Hail Mary', 'harpy', 'atk', 2, 'r', 'one', [['roll', 11, [['d', 32]], [['d', 5]]]], { fl: 'From the far end of the dungeon.', sport: 'football' });
// elf — the sniper
K('elf_top', 'Top Shelf', 'elf', 'atk', 1, 's', 'one', [['d', 7], ['s', 'vuln', 1]], { fl: 'Where Grandma keeps the cookies.', sport: 'hockey' });
K('elf_volley', 'Arrow Volley', 'elf', 'atk', 1, 'c', 'all', [['d', 3, 2]]);
K('elf_fleet', 'Fleet Foot', 'elf', 'skl', 0, 'c', 'self', [['b', 4], ['draw', 1]]);
K('elf_thorn', 'Thornwood', 'elf', 'skl', 1, 'u', 'all', [['s', 'weak', 2, 'all'], ['s', 'thorns', 2, 'self']]);
K('elf_read', 'Perfect Read', 'elf', 'pow', 1, 'u', 'self', [['s', 'dex', 2, 'self']]);
K('elf_bull', 'Bullseye', 'elf', 'atk', 2, 'r', 'one', [['d', 22]]);
// wraith
K('wrt_phase', 'Phase Shift', 'wraith', 'skl', 1, 's', 'self', [['b', 7], ['draw', 1]], { fl: 'Technically never been checked.' });
K('wrt_chill', 'Soul Chill', 'wraith', 'atk', 1, 'c', 'one', [['d', 6], ['s', 'weak', 1]]);
K('wrt_whisper', 'Grave Whisper', 'wraith', 'skl', 0, 'c', 'one', [['s', 'vuln', 2], ['draw', 1]]);
K('wrt_haunt', 'Haunt', 'wraith', 'pow', 1, 'u', 'self', [['s', 'haunt', 1, 'self']]);
K('wrt_pass', 'Ghostly Passage', 'wraith', 'skl', 2, 'u', 'self', [['s', 'intang', 1, 'self']], { ex: 1 });
K('wrt_fog', 'Fog of the Dead', 'wraith', 'skl', 1, 'r', 'all', [['s', 'weak', 3, 'all'], ['s', 'vuln', 3, 'all']], { ex: 1 });
// vampire
K('vmp_bite', 'Bite', 'vampire', 'atk', 1, 's', 'one', [['drain', 6]], { fl: 'Only plays night games.' });
K('vmp_mez', 'Mesmerize', 'vampire', 'skl', 1, 'c', 'one', [['roll', 10, [['s', 'stun', 1]], [['s', 'weak', 2]]]]);
K('vmp_bats', 'Bat Swarm', 'vampire', 'atk', 1, 'c', 'rand', [['d', 2, 4]]);
K('vmp_let', 'Bloodletting', 'vampire', 'skl', 0, 'u', 'self', [['lose', 3], ['nrg', 2]]);
K('vmp_night', 'Night Game', 'vampire', 'pow', 1, 'u', 'self', [['s', 'nightgame', 5, 'self']]);
K('vmp_drain', 'Exsanguinate', 'vampire', 'atk', 2, 'r', 'one', [['drain', 15]]);
// lich
K('lch_tk', 'Telekinesis', 'lich', 'skl', 1, 's', 'self', [['draw', 2]], { fl: 'Pulls the puck to her blade.' });
K('lch_bolt', 'Hex Bolt', 'lich', 'atk', 1, 'c', 'one', [['d', 7], ['s', 'psn', 3]]);
K('lch_phyl', 'Phylactery', 'lich', 'skl', 1, 'c', 'self', [['b', 6], ['s', 'psn', 2, 'all']], { fl: 'Keeps his plus-minus in it.' });
K('lch_hands', 'Grave Hands', 'lich', 'skl', 1, 'u', 'one', [['s', 'vuln', 2], ['s', 'psn', 4]]);
K('lch_necro', 'Necromancy', 'lich', 'pow', 2, 'u', 'self', [['s', 'necro', 2, 'self']]);
K('lch_timeout', 'Power Word: Timeout', 'lich', 'skl', 0, 'r', 'self', [['nrg', 2], ['draw', 2]], { ex: 1, sport: 'basketball' });
// zombie
K('zmb_grip', 'Grave Grip', 'zombie', 'atk', 1, 's', 'one', [['d', 5], ['s', 'weak', 2]], { fl: 'Latches on. Does not let go.' });
K('zmb_shamble', 'Shamble', 'zombie', 'skl', 1, 'c', 'one', [['b', 7], ['s', 'psn', 2]]);
K('zmb_stone', 'Headstone Swing', 'zombie', 'atk', 2, 'c', 'one', [['d', 15]], { sport: 'baseball' });
K('zmb_cloud', 'Plague Cloud', 'zombie', 'skl', 1, 'u', 'all', [['s', 'psn', 3, 'all']]);
K('zmb_undying', 'Undying', 'zombie', 'pow', 2, 'u', 'self', [['s', 'undying', 1, 'self']]);
K('zmb_brains', 'Brains!', 'zombie', 'atk', 1, 'r', 'one', [['d', 10], ['kill', [['maxhp', 3]]]], { ex: 1 });
// gorgon
K('grg_gaze', 'Stone Gaze', 'gorgon', 'skl', 1, 's', 'one', [['roll', 12, [['s', 'stun', 1]], [['s', 'weak', 1]]]], { fl: 'Goalies will not make eye contact with her.' });
K('grg_bite', 'Snake Bite', 'gorgon', 'atk', 1, 'c', 'one', [['d', 5], ['s', 'psn', 3]]);
K('grg_coil', 'Serpent Coil', 'gorgon', 'skl', 1, 'c', 'one', [['b', 6], ['s', 'weak', 2]]);
K('grg_garden', 'Stone Garden', 'gorgon', 'skl', 2, 'u', 'all', [['b', 12], ['s', 'weak', 1, 'all']]);
K('grg_eye', 'Basilisk Eye', 'gorgon', 'pow', 1, 'u', 'self', [['s', 'basilisk', 1, 'self']]);
K('grg_petrify', 'Petrify', 'gorgon', 'atk', 2, 'r', 'one', [['roll', 12, [['petrify', 0.5]], [['d', 12]]]], { ex: 1 });
// spider
K('spd_web', 'Web', 'spider', 'skl', 1, 's', 'one', [['b', 4], ['s', 'weak', 2]], { fl: 'Turns two with eight arms.' });
K('spd_eight', 'Eight-Arm Check', 'spider', 'atk', 2, 'c', 'one', [['d', 2, 7]], { sport: 'hockey' });
K('spd_fang', 'Venom Fang', 'spider', 'atk', 1, 'c', 'one', [['d', 4], ['s', 'psn', 4]]);
K('spd_burst', 'Web Burst', 'spider', 'skl', 1, 'u', 'all', [['s', 'weak', 2, 'all']]);
K('spd_spin', 'Web Spinner', 'spider', 'pow', 1, 'u', 'self', [['s', 'spin', 1, 'self']]);
K('spd_brood', 'Brood', 'spider', 'skl', 2, 'r', 'self', [['add', 'spiderling', 3, 'hand']], { ex: 1 });
// skeleton
K('skl_bar', 'Bone Barricade', 'skeleton', 'skl', 1, 's', 'self', [['b', 8]], { fl: 'Two hundred and six bones between you and harm.' });
K('skl_rattle', 'Rattle', 'skeleton', 'atk', 1, 'c', 'one', [['d', 4, 2]]);
K('skl_toss', 'Bone Toss', 'skeleton', 'atk', 0, 'c', 'one', [['d', 4]]);
K('skl_re', 'Reassemble', 'skeleton', 'skl', 1, 'u', 'self', [['b', 9], ['s', 'nrgnext', 1, 'self']]);
K('skl_storm', 'Bone Storm', 'skeleton', 'atk', 2, 'u', 'all', [['d', 4, 2]]);
K('skl_206', '206 Bones', 'skeleton', 'skl', 2, 'r', 'self', [['bones', 2]]);
// witch
K('wch_hex', 'Frost Hex', 'witch', 'atk', 1, 's', 'one', [['d', 6], ['roll', 15, [['s', 'stun', 1]], []]], { fl: 'Her wrist shot has a wrist shot.' });
K('wch_shard', 'Ice Shard', 'witch', 'atk', 0, 'c', 'one', [['d', 4]]);
K('wch_rime', 'Rime Ward', 'witch', 'skl', 1, 'c', 'one', [['b', 7], ['s', 'weak', 1]]);
K('wch_bliz', 'Blizzard', 'witch', 'atk', 2, 'u', 'all', [['d', 5], ['s', 'weak', 2, 'all']]);
K('wch_snap', 'Cold Snap', 'witch', 'pow', 1, 'u', 'self', [['s', 'coldsnap', 2, 'self']]);
K('wch_zero', 'Absolute Zero', 'witch', 'skl', 3, 'r', 'all', [['s', 'stun', 1, 'all']], { ex: 1 });

// the league's playbook: sports cards any party can learn
K('dunk', 'Slam Dunk', 'any', 'atk', 2, 'c', 'one', [['dunk', 14, 24]], { sport: 'basketball' });
K('hattrick', 'Hat Trick', 'any', 'atk', 1, 'c', 'one', [['d', 3, 3]], { fl: 'Throw your helmets.', sport: 'hockey' });
K('blitz', 'Blitz', 'any', 'atk', 1, 'c', 'rand', [['d', 5, 2]], { sport: 'football' });
K('press', 'Full-Court Press', 'any', 'skl', 1, 'u', 'all', [['s', 'weak', 1, 'all'], ['s', 'vuln', 1, 'all']], { sport: 'basketball' });
K('timeout', 'Timeout', 'any', 'skl', 0, 'c', 'self', [['draw', 2]], { ex: 1, sport: 'basketball' });
K('sacfly', 'Sacrifice Fly', 'any', 'skl', 0, 'c', 'self', [['lose', 3], ['draw', 2]], { sport: 'baseball' });
K('pk', 'Penalty Kill', 'any', 'skl', 2, 'u', 'self', [['b', 13], ['s', 'weak', 1, 'all']], { sport: 'hockey' });
K('pickroll', 'Pick and Roll', 'any', 'skl', 1, 'c', 'self', [['b', 6], ['draw', 1]], { sport: 'basketball' });
K('bunt', 'Drag Bunt', 'any', 'atk', 0, 'c', 'one', [['d', 3]], { sport: 'baseball' });
K('drill', 'Two-Minute Drill', 'any', 'skl', 1, 'u', 'self', [['nrg', 1], ['draw', 2]], { ex: 1, sport: 'football' });
K('oop', 'Alley-Oop', 'any', 'atk', 1, 'u', 'one', [['d', 5], ['s', 'oop', 7, 'self']], { sport: 'basketball' });
K('audible', 'Audible', 'any', 'skl', 0, 'u', 'self', [['audible']], { fl: 'Omaha! Omaha!', sport: 'football' });
K('homefield', 'Home Field Advantage', 'any', 'pow', 2, 'r', 'self', [['s', 'str', 1, 'self'], ['s', 'dex', 1, 'self'], ['s', 'ward', 3, 'self']], { sport: 'baseball' });
K('replay', 'Instant Replay', 'any', 'skl', 1, 'r', 'self', [['s', 'double', 1, 'self']], { ex: 1, fl: 'After further review…', sport: 'football' });
K('grandslam', 'Grand Slam', 'any', 'atk', 3, 'r', 'rand', [['d', 9, 4]], { sport: 'baseball' });
K('suddendeath', 'Sudden Death', 'any', 'atk', 2, 'r', 'one', [['d', 30], ['lose', 6]], { ex: 1, fl: 'Next goal wins. Next goal, anyway.', sport: 'hockey' });
// easter eggs from the minor sports
K('holeinone', 'Hole in One', 'any', 'atk', 1, 'r', 'one', [['roll', 20, [['execute']], [['d', 5]]]], { fl: 'It has happened. Twice.', sport: 'golf' });
K('strike10', 'Strike!', 'any', 'atk', 2, 'u', 'all', [['d', 9], ['allkilled', [['nrg', 2]]]], { fl: 'All ten.', sport: 'bowling' });
K('lance', 'Couched Lance', 'any', 'atk', 2, 'u', 'one', [['d', 20]], { fl: 'Three passes at the lists.', sport: 'jousting' });
K('sweep', 'Hurry Hard', 'any', 'skl', 1, 'c', 'self', [['b', 4], ['s', 'drawnext', 1, 'self'], ['s', 'nrgnext', 1, 'self']], { fl: 'SWEEP! SWEEP!', sport: 'curling' });
K('stretch', 'Seventh-Inning Stretch', 'any', 'skl', 1, 'u', 'self', [['heal', 7]], { ex: 1, sport: 'baseball' });

// cards the dungeon puts in your deck
K('spiderling', 'Spiderling', 'spider', 'atk', 0, 'x', 'one', [['d', 4]], { ex: 1 });
K('slimed', 'Slimed', 'none', 'junk', 1, 'x', 'self', [], { ex: 1, fl: 'Somebody wipe this off.' });
K('strikecard', 'Strike', 'none', 'junk', 1, 'x', 'self', [], { ex: 1, fl: 'Hold three at the start of a turn and you are struck out: one less Stamina.' });
K('frostbite', 'Frostbite', 'none', 'junk', -1, 'x', 'self', [], { eth: 1, fl: 'Unplayable. Melts away at the end of your turn.' });
K('injury', 'Pulled Hamstring', 'none', 'curse', -1, 'x', 'self', [], { fl: 'Unplayable. A Locker Room trainer can tape it out of your deck.' });
K('penalty', 'Ejection Notice', 'none', 'curse', -1, 'x', 'self', [], { endHurt: 2, fl: 'Unplayable. While in hand at the end of your turn, lose 2 HP.' });

const KIND_CARDS = {}; for (const c of Object.values(CARDS)) { (KIND_CARDS[c.kind] = KIND_CARDS[c.kind] || []).push(c.id); }
const SIG = {}; for (const c of Object.values(CARDS)) if (c.rar === 's' && c.kind !== 'any') SIG[c.kind] = c.id;
const SPORT_NAME = { baseball: 'Baseball', football: 'Football', hockey: 'Hockey', basketball: 'Basketball', golf: 'Golf', bowling: 'Bowling', jousting: 'Jousting', curling: 'Curling', boxing: 'Boxing', soccer: 'Soccer' };

/* ---------- upgrades: one pass in the film room ---------- */
function upFx(fx) {
  return fx.map(op => {
    const o = op.slice();
    switch (o[0]) {
      case 'd': { const h = o[2] || 1; o[1] += h >= 4 ? 1 : h >= 2 ? 2 : 3; break; }
      case 'b': o[1] += 3; break;
      case 's': if (o[1] !== 'stun' && o[1] !== 'barricade' && o[1] !== 'undying' && o[1] !== 'double' && o[1] !== 'intang') o[2] += ['str', 'dex', 'ritual', 'haunt', 'spin', 'basilisk', 'rage', 'nrgnext'].includes(o[1]) ? 1 : o[1] === 'oop' || o[1] === 'nightgame' ? 3 : o[1] === 'tempest' || o[1] === 'plate' || o[1] === 'ward' ? 2 : 1; break;
      case 'drain': case 'heal': o[1] += 3; break;
      case 'dunk': o[1] += 4; o[2] += 6; break;
      case 'roll': o[1] = Math.max(2, o[1] - 3); o[2] = upFx(o[2]); o[3] = upFx(o[3]); break;
      case 'ifst': o[2] = upFx(o[2]); o[3] = upFx(o[3]); break;
      case 'devour': o[1] += 10; break;
      case 'bones': o[1] += 1; break;
      case 'add': o[2] += 1; break;
      case 'draw': o[1] += 1; break;
    }
    return o;
  });
}
const UP_OVERRIDE = { glm_bed: { cost: 1 }, replay: { ex: 0 }, wrt_pass: { cost: 1 }, timeout: { fx: [['draw', 3]] }, audible: { fx: [['audible'], ['draw', 1]] }, wch_zero: { cost: 2 }, lch_timeout: { fx: [['nrg', 2], ['draw', 3]] }, zmb_undying: { cost: 1 }, homefield: { cost: 1 }, kob_kindle: { fx: [['s', 'kindle', 3, 'self']] }, trl_blood: { fx: [['s', 'trollblood', 4, 'self']] }, drill: { fx: [['nrg', 2], ['draw', 2]] }, grg_petrify: { fx: [['roll', 9, [['petrify', 0.6]], [['d', 15]]]] }, holeinone: { fx: [['roll', 18, [['execute']], [['d', 8]]]] } };
function cardDef(card) {
  const b = CARDS[card.id]; if (!card.up) return b;
  const key = b.id + '+'; if (cardDef.cache[key]) return cardDef.cache[key];
  const o = Object.assign({}, b, { n: b.n + '+', fx: upFx(b.fx) }, UP_OVERRIDE[b.id] || {});
  // upgrades soften the extra costs and sharpen the extras
  if (b.toll) o.toll = Math.max(0, b.toll - 2);
  if (b.fatigue) o.fatigue = Math.max(0, b.fatigue - 1);
  if (b.goldc) o.goldc = Math.round(b.goldc * .6);
  if (b.grow) o.grow = b.grow + 2;
  if (b.home) o.home = upFx(b.home);
  if (b.combo) o.combo = { t: b.combo.t, fx: upFx(b.combo.fx) };
  if (b.mom) o.mom = { n: b.mom.n, fx: upFx(b.mom.fx) };
  if (b.rar === 'l' && b.cost >= 2 && !(UP_OVERRIDE[b.id] || {}).cost) o.cost = b.cost - 1;
  return (cardDef.cache[key] = o);
}
cardDef.cache = {};
const upgradable = card => !card.up && !['junk', 'curse'].includes(CARDS[card.id].type) && CARDS[card.id].rar !== 'x';

