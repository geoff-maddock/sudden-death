/* ---------- trophies (relics) ---------- */
// hooks are read by name in the engine: start (combat start), turn (start of your turn), win (after a fight),
// gain (on pickup), attacks3 (third attack in a turn), roll (bonus to d20), gold (gold multiplier)
const RELICS = {
  icepack: { n: 'Post-Game Ice Pack', club: 1, desc: 'Heal 4 HP after every fight.', ico: 'pack' },
  lantern: { n: 'Bog Lantern', club: 1, desc: 'At the start of each fight, apply 3 Plague to every enemy.', ico: 'lantern' },
  horn: { n: 'Banshee Wail Horn', club: 1, desc: 'At the start of each fight, apply 2 Weak and 1 Exposed to every enemy.', ico: 'horn' },
  boots: { n: 'Mountain Boots', club: 1, desc: 'Start each fight with 10 Block and 1 Footwork.', ico: 'boot' },
  skates: { n: 'Glacier Skates', club: 1, desc: 'The first card you play each turn draws a card.', ico: 'skate' },
  chalice: { n: 'Blood Chalice', club: 1, desc: 'Whenever an enemy falls, heal 3 HP.', ico: 'chalice' },
  towel: { n: 'Rally Towel', club: 1, desc: 'The first time each fight you play 4 cards in one turn, gain 1 Stamina and draw a card.', ico: 'towel' },
  sled: { n: 'Weighted Sled', club: 1, desc: 'On every third turn of a fight, gain 2 Strength.', ico: 'sled' },
  gauntlets: { n: 'Gauntlets of Ogre Power', rar: 'u', desc: 'Start each fight with 1 Strength.', ico: 'fist' },
  bracers: { n: 'Bracers of Defense', rar: 'c', desc: 'Start each fight with 1 Footwork.', ico: 'bracer' },
  bag: { n: 'Bag of Holding', rar: 'c', desc: 'Draw 2 extra cards on the first turn of each fight.', ico: 'bag' },
  ring: { n: 'Ring of Regeneration', rar: 'u', desc: 'Heal 1 HP at the end of each of your turns.', ico: 'ring' },
  speed: { n: 'Boots of Speed', rar: 'c', desc: 'Gain 1 extra Stamina on the first turn of each fight.', ico: 'boot' },
  champring: { n: 'Championship Ring', rar: 'c', desc: 'Gain 25% more gold.', ico: 'ring' },
  luckstone: { n: 'Luckstone', rar: 'c', desc: '+2 to every d20 you roll.', ico: 'gem' },
  foam: { n: 'Foam Finger', rar: 'u', desc: 'Every third Attack you play in a turn also deals 5 damage to all enemies.', ico: 'finger' },
  rallycap: { n: 'Rally Cap', rar: 'c', desc: 'If you end your turn below half HP, gain 6 Block.', ico: 'cap' },
  whistle: { n: 'Referee’s Whistle', rar: 'c', desc: 'At the start of each fight, apply 1 Exposed to every enemy.', ico: 'whistle' },
  mitt: { n: 'Sticky Mitt', rar: 'c', desc: 'Fights drop 10 more gold.', ico: 'mitt' },
  belt: { n: 'Bandolier', rar: 'c', desc: 'Carry one more tonic.', ico: 'belt' },
  oldball: { n: 'Signed Game Ball', rar: 'u', desc: 'At the start of each fight, deal 3 damage to all enemies.', ico: 'ball' },
  tooth: { n: 'Mimic Tooth', rar: 'c', desc: 'Raise max HP by 8 when picked up.', ico: 'tooth', gain: r => { r.maxhp += 8; r.hp += 8; } },
  cupreplica: { n: 'Black Ice Cup (replica)', rar: 'u', desc: 'Card rewards offer one more card.', ico: 'cup' },
  goldenboot: { n: 'Golden Boot', rar: 'u', desc: 'In soccer, start every turn with a pass already made.', ico: 'ball' },
  bowling: { n: 'Bowling Ball of Doom', rar: 'u', desc: 'The first Attack you play each fight deals 8 more damage per hit.', ico: 'ball' },
  jersey: { n: 'Lucky Jersey', rar: 'r', desc: 'Once per fight, the first time you would die, heal to 15 HP instead.', ico: 'jersey' },
  playbook: { n: 'Coach’s Playbook', rar: 'r', desc: 'Draw 1 extra card each turn.', ico: 'book' },
  // boss trophies: +1 Stamina each turn, with a catch
  ioun: { n: 'Ioun Stone of Stamina', boss: 1, desc: '+1 Stamina each turn. Locker Rooms no longer heal you.', ico: 'gem' },
  goldpuck: { n: 'Golden Puck', boss: 1, desc: '+1 Stamina each turn. Fights start with a Frostbite in your hand.', ico: 'puck' },
  cursedjersey: { n: 'Cursed Away Jersey', boss: 1, desc: '+1 Stamina each turn. Lose 10 max HP when you take it.', ico: 'jersey', gain: r => { r.maxhp -= 10; r.hp = Math.min(r.hp, r.maxhp); } },
  clipboard: { n: 'Coach’s Clipboard', boss: 1, desc: 'Draw 2 extra cards each turn. Enemies start each fight with 1 Strength.', ico: 'book' },
};

/* ---------- tonics (potions) ---------- */
const TONICS = {
  heal: { n: 'Potion of Healing', col: '#ff6a6a', desc: 'Heal 15 HP.', fx: [['heal', 15]] },
  electro: { n: 'Electrolyte Elixir', col: '#ffd166', desc: 'Gain 2 Stamina.', fx: [['nrg', 2]] },
  giant: { n: 'Giant Strength Draught', col: '#ff8a5a', desc: 'Gain 2 Strength.', fx: [['s', 'str', 2, 'self']] },
  fire: { n: 'Flask of Dragonfire', col: '#ff9a2a', desc: 'Deal 12 damage to all enemies.', fx: [['d', 12, 1, 'all']] },
  oil: { n: 'Oil of Slipperiness', col: '#7fd6ff', desc: 'Gain 14 Block.', fx: [['b', 14]] },
  salts: { n: 'Smelling Salts', col: '#e9dcc0', desc: 'Draw 3 cards.', fx: [['draw', 3]] },
  luck: { n: 'Liquid Luck', col: '#7fe08a', desc: 'Your next d20 rolls a natural 20.', fx: [['luck']] },
};
