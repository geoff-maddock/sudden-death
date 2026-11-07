/* p5: the run — drafting, the map, rewards, shops, locker rooms, events, saves and records */
const START_HP = 75, FLOORS = 13; // rows 0..12, then the boss
function newRun(clubId, picks, roster, relic, seed) {
  B = null; // a fight left from an earlier run must not lend its stream to this one (see R in core/util.js)
  const club = CLUBS[clubId], R0 = roster || club.roster;
  const party = picks.map(i => { const [n, kind, num, flav] = R0[i]; return { n, kind, num, flav }; });
  RUN = { v: 1, club: clubId, party, extra: [], hp: START_HP, maxhp: START_HP, gold: 99, relics: [relic || club.relic], tonics: [null, null], deck: [], act: 0, map: null, pos: null, floor: 0,
    stats: { fights: 0, elites: 0, bosses: 0, cards: 0, dmg: 0, turns: 0, gold: 0, sportsWins: 0, highlights: 0 }, style: 0, luck: 0, removeCost: 75, practiceCost: 50, tonicOdds: 40, pending: null, started: Date.now(), seen: {} };
  if (seed != null) RUN.seed = seed >>> 0; // a seeded run (see R in core/util.js); the Realm and older saves have none
  for (let i = 0; i < 4; i++) RUN.deck.push(mkCard('check'));
  for (let i = 0; i < 4; i++) RUN.deck.push(mkCard('hold'));
  for (const p of party) RUN.deck.push(mkCard(SIG[p.kind]));
  RUN.map = genMap(0); setGoals(0);
  saveRun();
  return RUN;
}
const runKinds = () => [...new Set(RUN.party.map(p => p.kind).concat(RUN.extra))];
function clubTeam() { const c = CLUBS[RUN.club]; return { color: c.color, light: c.light, short: c.short, dark: c.dark }; }
const memberOf = kind => RUN.party.find(p => p.kind === kind);

