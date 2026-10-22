/* p4e: the sky over the Brimstone League. A clock ticks every turn you take in a fight and every room you move
   to, across the whole run. The moon changes phase every 3 ticks (8 phases); the constellations rotate every 5
   (10 of them, two up at a time), so the pairings drift. Every effect is small. */
const SKY_GROUPS = {
  beast: ['werewolf', 'minotaur', 'harpy', 'spider', 'bugbear'],
  undead: ['zombie', 'skeleton', 'lich', 'wraith', 'vampire', 'ghoul', 'banshee'],
  stone: ['golem', 'dwarf', 'troll', 'gorgon', 'bogtroll'],
  fey: ['elf', 'witch', 'lich', 'kobold', 'drow'],
  brute: ['ogre', 'troll', 'minotaur', 'hobgoblin', 'fiend'],
  trick: ['goblin', 'kobold', 'harpy', 'imp'],
};
const GROUP_NAME = { beast: 'Beasts', undead: 'Undead', stone: 'Stoneborn', fey: 'Spellcasters', brute: 'Brutes', trick: 'Tricksters' };
// 'hit N harder' applies to the first hit of each card
const MOON = [
  { n: 'New Moon', desc: 'Undead cards hit 1 harder and give 1 more Block.', grp: 'undead', atk: 1, blk: 1 },
  { n: 'Waxing Crescent', desc: 'Every Skill gives 1 more Block.', skl: 1 },
  { n: 'First Quarter', desc: 'Trickster cards hit 1 harder.', grp: 'trick', atk: 1 },
  { n: 'Waxing Gibbous', desc: 'Healing in a fight heals 2 more.', heal: 2 },
  { n: 'Full Moon', desc: 'Beast cards hit 3 harder. Werewolves on either side start fights with 1 Strength.', grp: 'beast', atk: 3, wolves: 1 },
  { n: 'Waning Gibbous', desc: 'Plague and Burn you apply are 1 higher.', rot: 1 },
  { n: 'Last Quarter', desc: 'Stoneborn cards give 2 more Block.', grp: 'stone', blk: 2 },
  { n: 'Waning Crescent', desc: 'The shadows lengthen: undead enemies hit 1 harder.', foeUndead: 1 },
];
const STARS = [
  { n: 'The Slugger', desc: 'Baseball cards hit 1 harder.', sport: 'baseball', atk: 1, pts: [[-18, 8], [-8, -2], [2, -10], [12, -16], [-4, 12], [10, 10]], lines: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5]] },
  { n: 'The Goalmouth', desc: 'Hockey cards hit 1 harder.', sport: 'hockey', atk: 1, pts: [[-16, -8], [16, -8], [-16, 10], [16, 10], [0, 2]], lines: [[0, 1], [0, 2], [1, 3]] },
  { n: 'The Hoop', desc: 'Basketball cards hit 1 harder.', sport: 'basketball', atk: 1, pts: [[-12, -4], [-4, -10], [6, -10], [13, -3], [6, 4], [-5, 4], [0, 14]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]] },
  { n: 'The Gridiron', desc: 'Football cards hit 1 harder.', sport: 'football', atk: 1, pts: [[-18, 0], [-8, -8], [8, -8], [18, 0], [8, 8], [-8, 8]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 3]] },
  { n: 'The Ogre’s Belly', desc: 'Brute cards hit 1 harder.', grp: 'brute', atk: 1, pts: [[-14, -10], [-16, 4], [-6, 14], [8, 14], [16, 2], [12, -10], [0, -14]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]] },
  { n: 'The Spinner', desc: 'Weak you apply is 1 higher.', weak: 1, pts: [[0, 0], [-14, -12], [14, -12], [-16, 6], [16, 6], [-8, 16], [8, 16]], lines: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]] },
  { n: 'The Lantern', desc: 'Spellcaster cards hit 1 harder.', grp: 'fey', atk: 1, pts: [[0, -16], [-8, -6], [8, -6], [-8, 10], [8, 10], [0, 16]], lines: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5]] },
  { n: 'The Anvil', desc: 'Stoneborn cards hit 1 harder.', grp: 'stone', atk: 1, pts: [[-18, -6], [10, -6], [18, -12], [6, 4], [-6, 4], [-10, 14], [10, 14]], lines: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 0], [4, 5], [3, 6]] },
  { n: 'The Twin Dice', desc: '+1 to every d20 you roll.', dice: 1, pts: [[-16, -6], [-6, -6], [-6, 4], [-16, 4], [6, -2], [16, -2], [16, 8], [6, 8]], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4]] },
  { n: 'The Huntsman', desc: 'Beast cards hit 1 harder.', grp: 'beast', atk: 1, pts: [[-16, 12], [-6, 2], [4, -6], [16, -14], [-2, -12], [8, 6]], lines: [[0, 1], [1, 2], [2, 3], [2, 4], [2, 5]] },
];
const MOON_EVERY = 3, STARS_EVERY = 5;
function skyAt(clock) {
  const m = Math.floor(clock / MOON_EVERY) % MOON.length, s = Math.floor(clock / STARS_EVERY) % STARS.length;
  return { moon: m, stars: [s, (s + 4) % STARS.length], moonIn: MOON_EVERY - clock % MOON_EVERY, starsIn: STARS_EVERY - clock % STARS_EVERY };
}
const skyNow = () => skyAt(RUN ? RUN.clock || 0 : 0);
function skyTick() {
  if (!RUN) return;
  const before = skyAt(RUN.clock || 0);
  RUN.clock = (RUN.clock || 0) + 1;
  const now = skyAt(RUN.clock);
  if (now.moon !== before.moon) { if (B && !B.over) { fx({ k: 'sky', what: 'moon' }); fx({ k: 'banner', t: MOON[now.moon].n, sub: MOON[now.moon].desc, small: 1 }); } if (B) log(`The moon turns: ${MOON[now.moon].n}. ${MOON[now.moon].desc}`, 'sys'); }
  if (now.stars[0] !== before.stars[0]) { if (B && !B.over) fx({ k: 'sky', what: 'stars' }); if (B) log(`New stars rise: ${now.stars.map(i => STARS[i].n).join(' and ')}.`, 'sys'); }
}
const inGrp = (g, kind) => g && SKY_GROUPS[g].includes(kind);
// a card's kind for sky purposes: league cards count as their owner's kind
const skyKind = card => { const d = def(card); return d.kind === 'any' || d.kind === 'none' ? (card.own || 'any') : d.kind; };
function skyEffects() { if (window.SKY_OFF) return []; const s = skyNow(); return [MOON[s.moon], STARS[s.stars[0]], STARS[s.stars[1]]]; }
function skyAtk(card) { if (!card) return 0; const k = skyKind(card), d = def(card); let n = 0; for (const e of skyEffects()) { if (!e.atk) continue; if (e.grp && inGrp(e.grp, k)) n += e.atk; else if (e.sport && d.sport === e.sport) n += e.atk; } return n; }
function skyBlk(card) { if (!card) return 0; const k = skyKind(card), d = def(card); let n = 0; for (const e of skyEffects()) { if (e.blk && e.grp && inGrp(e.grp, k)) n += e.blk; if (e.skl && d.type === 'skl') n += e.skl; } return n; }
const skyHas = key => skyEffects().reduce((s, e) => s + (e[key] || 0), 0);
// kind effects cut both ways: enemies of a favoured kind hit 1 harder too (never more than 1 from the sky)
function skyFoeBonus(e) { if (window.SKY_OFF) return 0; return skyEffects().some(x => (x.grp && x.atk && inGrp(x.grp, e.kind)) || (x.foeUndead && inGrp('undead', e.kind))) ? 1 : 0; }
for (const x of MOON.concat(STARS)) if (x.grp && x.atk) x.desc += ` ${GROUP_NAME[x.grp]} enemies hit 1 harder too.`;
function skyCombatStart() {
  if (!MOON[skyNow().moon].wolves) return;
  if (RUN.party.some(p => p.kind === 'werewolf')) addSt(B.P, 'str', 1);
  for (const e of B.enemies) if (e.kind === 'werewolf' || e.kind === 'bugbear') addSt(e, 'str', 1);
}

// the sky as a system hook: it acts at the start of every fight
onHook('fightStart', skyCombatStart);
