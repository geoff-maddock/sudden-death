/* p2: data — clubs, statuses, cards, trophies, tonics */

/* ---------- clubs (the Brimstone League's four, from Black Ice) ---------- */
const CLUBS = {
  ironmaw: { id: 'ironmaw', name: 'Ironmaw Marauders', short: 'IRN', color: '#d9573b', light: '#f09a7f', dark: '#3a140c', motto: 'Break sticks. Break bones. Break for the pub.', relic: 'icepack',
    roster: [['Vexa', 'werewolf', 11, 'Scores more under a full moon. It is always a full moon somewhere.'], ['Snikt', 'goblin', 3, 'Has never been called for slashing. Has never been seen slashing.'], ['Horn', 'minotaur', 44, 'Goes to the net. Goes through the net. Goes on.'], ['Thrumgar', 'dwarf', 7, 'Was told a stick is a tool. Brought a better tool.'], ['Mawgrum', 'ogre', 99, 'Leads the league in hits and in forwards swallowed.'], ['Brakka', 'golem', 1, 'Not so much a goalie as a geological feature.']] },
  mirewood: { id: 'mirewood', name: 'Mirewood Hexers', short: 'MIR', color: '#3fbf9f', light: '#8ff0d8', dark: '#0c2a22', motto: 'The bog remembers every goal.', relic: 'lantern',
    roster: [['Lady Sanguine', 'vampire', 6, 'Only plays night games. Down here, they all are.'], ['Wisp', 'wraith', 13, 'Technically never been checked. Technically never been seen.'], ['Thistle', 'elf', 8, 'Can pick a top corner from the far blue line.'], ['Silk', 'spider', 88, 'Eight arms. Eight sticks, if the referee looks away.'], ['Grimsby', 'zombie', 31, 'Blocks shots with his face. Has spares.'], ['Ossuary', 'skeleton', 2, 'Two hundred and six bones between the puck and the net.']] },
  gallowmere: { id: 'gallowmere', name: 'Gallowmere Banshees', short: 'GAL', color: '#9b6bff', light: '#d2bcff', dark: '#1f1238', motto: 'The lake keeps what it takes.', relic: 'horn',
    roster: [['Morwen', 'witch', 13, 'Her wrist shot has a wrist shot.'], ['Kreel', 'harpy', 22, 'Has flown over three defensemen and one Zamboni.'], ['Sethra', 'gorgon', 9, 'Goalies will not make eye contact with her.'], ['Ashgrave', 'lich', 66, 'Keeps his plus-minus in a phylactery.'], ['Grukk', 'troll', 0, 'Regenerates between whistles. Also during them.'], ['Scorch', 'kobold', 31, 'Three feet tall, always on fire.']] },
  cragspire: { id: 'cragspire', name: 'Cragspire Tusks', short: 'CRG', color: '#e3b23c', light: '#ffe39a', dark: '#33250a', motto: 'Up the mountain, down the throat.', relic: 'boots',
    roster: [['Kordo', 'dwarf', 55, 'Forged his own skates. Forged his own birth certificate.'], ['Old Moss', 'troll', 33, 'Has been in this net since before the lake froze.'], ['Cairn', 'golem', 6, 'Rolled down the mountain into the crease. Stayed.'], ['Scree', 'gorgon', 24, 'Turns forwards into statues, and statues into defensemen.'], ['Gorrath', 'ogre', 88, 'Eats a forward a game, by contract.'], ['Ulla', 'harpy', 17, 'Shoots from above. Nobody has a rule about it.']] },
  frostfang: { id: 'frostfang', name: 'Frostfang Glaciers', short: 'FRS', color: '#4aa3ff', light: '#a8d4ff', dark: '#0b1c33', motto: 'First to the puck, first to the bar.', relic: 'skates',
    roster: [['Rime', 'witch', 5, 'Skates on ice she makes herself.'], ['Glint', 'elf', 19, 'Passes before the play exists.'], ['Squall', 'harpy', 27, 'Never touches the ice. Never needs to.'], ['Hoarfrost', 'skeleton', 8, 'Rattles down the wing at a full sprint.'], ['Pale Tom', 'wraith', 0, 'Blinks across the blue line. Literally.'], ['Kobb', 'kobold', 12, 'Fast hands, short fuse, shorter shifts.']] },
  duskhollow: { id: 'duskhollow', name: 'Duskhollow Feasters', short: 'DSK', color: '#e0457b', light: '#ffa6c6', dark: '#33091a', motto: 'We drink to every goal. Yours.', relic: 'chalice',
    roster: [['Count Carmine', 'vampire', 1, 'Never seen in daylight or in the penalty box.'], ['Howler', 'werewolf', 36, 'Hungriest player in the league, by any measure.'], ['Widow', 'spider', 80, 'Wraps the game up early.'], ['Gulch', 'zombie', 47, 'Eats on the bench. Eats the bench.'], ['Shriek', 'harpy', 14, 'Dives for the throat on every play.'], ['Sable', 'wraith', 29, 'Chills the blood, then drinks it.']] },
  rattlebone: { id: 'rattlebone', name: 'Rattlebone Rollers', short: 'RTB', color: '#d8cfb4', light: '#fffaf0', dark: '#2a2620', motto: 'Six on the ice. The ref counted eleven.', relic: 'towel',
    roster: [['Jangles', 'skeleton', 10, 'Runs the power play from the inside out.'], ['Pip', 'goblin', 2, 'Four shifts a minute.'], ['Cinder', 'kobold', 23, 'Small, hot, everywhere.'], ['Tangles', 'spider', 61, 'Has a hand in every play. Several.'], ['Moaner', 'zombie', 70, 'Slow, sure, and back again.'], ['Professor Marrow', 'lich', 99, 'Draws up forty plays a game. Runs all of them.']] },
  bramblegate: { id: 'bramblegate', name: 'Bramblegate Brutes', short: 'BRM', color: '#7ac23a', light: '#c4ef8f', dark: '#16290a', motto: 'Third period is our period.', relic: 'sled',
    roster: [['Big Thorne', 'ogre', 73, 'Gets meaner every shift.'], ['Bramblehoof', 'minotaur', 30, 'Warms up for two periods, then charges.'], ['Knotgrass', 'troll', 62, 'Grows back angrier.'], ['Ironbark', 'golem', 90, 'Started as a stump. Kept growing.'], ['Thornglare', 'gorgon', 41, 'The longer you look, the worse it gets.'], ['Burl', 'dwarf', 15, 'Lifts the Zamboni between periods, for warmth.']] },
};
const CLUB_IDS = Object.keys(CLUBS);
// each club's way of playing, shown in the draft
const CLUB_STYLE = {
  ironmaw: ['Bruisers', 'Hit hard, take hits, shake it off after every fight.'],
  mirewood: ['Rot', 'Plague from the opening whistle, and a roster that does not die quietly.'],
  gallowmere: ['Hexers', 'Weaken and expose everything, then punish it.'],
  cragspire: ['The Wall', 'Stone and stubbornness. Start behind a wall of Block and outlast them.'],
  frostfang: ['Run and gun', 'Speed and card flow. Your first card every turn draws another.'],
  duskhollow: ['Bloodsport', 'Drain to survive. Every fallen enemy heals you.'],
  rattlebone: ['Small ball', 'Cheap cards, and lots of them. Big turns get rewarded.'],
  bramblegate: ['Third period', 'Slow starters who get stronger the longer the fight goes.'],
};

