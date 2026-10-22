/* p2c: the open draft. Free agents: one prospect of every kind, no club, no colours but the league's own sand. */
CLUBS.free = { id: 'free', name: 'Free Agents', short: 'FA', color: '#c2a46a', light: '#f4e8c4', dark: '#2a2216', motto: 'No club. No contract. No mercy.', relic: null, roster: [] };
const FA_NAMES = {
  goblin: ['Skrit', 'Nubbins', 'Grizzle', 'Pock', 'Wizzle', 'Tamsk', 'Fidget'], kobold: ['Ember', 'Snik', 'Cinderjaw', 'Pyrrix', 'Tikk', 'Smolder', 'Kibble'],
  werewolf: ['Grayhowl', 'Lupa', 'Fangs Malone', 'Ash', 'Thorne', 'Rook', 'Selene'], dwarf: ['Brannoc', 'Hilde', 'Gruff', 'Torva', 'Bramm', 'Odda', 'Kettle'],
  ogre: ['Big Lumpy', 'Gnash', 'Borra', 'Munch', 'Thudd', 'Hulga', 'Sloop'], minotaur: ['Taurus', 'Asterion', 'Bram', 'Ox', 'Helga Horns', 'Mazey', 'Brisket'],
  troll: ['Mossback', 'Grubb', 'Bridgette', 'Uldo', 'Sludge', 'Ivy', 'Grimble'], golem: ['Slab', 'Cobble', 'Monument', 'Quarry', 'Basalt', 'Pebbles', 'Lintel'],
  harpy: ['Shrike', 'Gale', 'Pinion', 'Screech', 'Zephyra', 'Talonna', 'Squall'], elf: ['Linden', 'Aerith', 'Quill', 'Fennel', 'Sorrel', 'Ithil', 'Brindle'],
  wraith: ['Hollow', 'Murk', 'Whisper', 'Pall', 'Shroud', 'Vesper', 'Nobody'], vampire: ['Count Penalty', 'Velka', 'Crimson', 'Lucan', 'Morrow', 'Ilsa', 'Drake'],
  lich: ['Mortimer', 'Ossian', 'Vex', 'Grimoire', 'Dusk', 'Hexley', 'Sepulchre'], zombie: ['Shamble', 'Rot', 'Gary', 'Lurch', 'Moldy Pete', 'Gristle', 'Patches'],
  gorgon: ['Medea', 'Stheno', 'Basilia', 'Vipra', 'Glare', 'Quartzia', 'Hiss'], spider: ['Weaver', 'Arachne', 'Spindle', 'Nettie', 'Eightball', 'Silkie', 'Trapdoor'],
  skeleton: ['Rattles', 'Femur', 'Clavicle', 'Bones', 'Marrow', 'Tibia', 'Skelly'], witch: ['Hagatha', 'Rime', 'Frostine', 'Bellatrix', 'Mildred', 'Sleet', 'Corvina'],
};
const FA_SCOUT = {
  goblin: ['Fastest first step in the class.', 'Will steal anything not nailed down. Has stolen nails.', 'Undersized, over-motivated.'],
  kobold: ['Throws heat, literally.', 'Short fuse, long range.', 'Has never been cold. Has never been asked.'],
  werewolf: ['Two players in one, depending on the sky.', 'Elite motor after dark.', 'Chews mouthguards. And opponents.'],
  dwarf: ['Low centre of gravity, high opinion of himself.', 'Heavy hitter, slow skater.', 'Brings her own axe. Leaves with yours.'],
  ogre: ['Takes up two lanes.', 'Raw strength, raw everything.', 'Coachable, if the coach is edible.'],
  minotaur: ['Goes straight ahead. Only straight ahead.', 'Elite in a phone booth. Elite through the phone booth.', 'Never lost a footrace in a maze.'],
  troll: ['Heals between plays.', 'Durable to a fault.', 'Hard to knock down, harder to keep down.'],
  golem: ['Plays like a wall because it is one.', 'Zero speed, zero fear.', 'Scouts disagree on whether it is alive.'],
  harpy: ['Plays above the rim. Above the arena.', 'Hard to cover, harder to hear yourself near.', 'Raw, loud, airborne.'],
  elf: ['Picks corners from impossible angles.', 'Quiet, precise, a little smug.', 'Sees the whole field. Some of it twice.'],
  wraith: ['Hard to hit. Hard to find.', 'Excellent at disappearing in the clutch, in a good way.', 'Does not appear on film.'],
  vampire: ['Night games only, which down here is all of them.', 'Drains the opposition. Literally.', 'High ceiling, long sleeves.'],
  lich: ['Ancient football IQ.', 'Slow, clever, cursed.', 'Has scouted this draft class for nine hundred years.'],
  zombie: ['Relentless. Unbothered by injury.', 'Will not stop. Cannot be told to stop.', 'Spare parts on the bench.'],
  gorgon: ['Opponents will not make eye contact.', 'Elite stopper, literally.', 'Hair has a mind of its own. Several.'],
  spider: ['Eight-way versatility.', 'Sets traps in the neutral zone.', 'Can play every position at once.'],
  skeleton: ['Light frame, long reach.', 'Rebuilds after every hit.', 'Nothing to bruise.'],
  witch: ['Freezes defenders, sometimes on purpose.', 'Brings her own weather.', 'Cold-blooded closer.'],
};
function genDraftClass() {
  const used = new Set();
  return Object.keys(KIND_NAME).map(kind => {
    let n; do { n = pick(FA_NAMES[kind]); } while (used.has(n)); used.add(n);
    return [n, kind, ri(0, 99), pick(FA_SCOUT[kind])];
  });
}
const kindGroups = kind => Object.keys(SKY_GROUPS).filter(g => SKY_GROUPS[g].includes(kind)).map(g => GROUP_NAME[g]);
