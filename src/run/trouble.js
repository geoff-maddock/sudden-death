/* p5d: two kinds of trouble, sprinkled in at random.
   Sport perks: some enemies are better at the game than at the fight. A perk is shown over the enemy and on
   its tooltip, and announced when the fight starts.
   High stakes: some fight rooms on the map carry a consequence for losing the game (not the fight).
   They are marked on the map, so you can see them coming and route around them or build for them. */
const SPORT_PERKS = {
  ace: { n: 'Ace', desc: 'Every score they make counts double.' },
  stopper: { n: 'Stopper', desc: 'Your scoring is harder: goals, baskets, lances and long drives need 3 more damage, hits go one base shorter, and yards come slower.' },
  headstart: { n: 'Hot start', desc: 'They open the game already a score ahead.' },
  clutch: { n: 'Clutch', desc: 'From turn 3 on, their hits that get through your Block score double.' },
};
// how often an enemy lineup gets a perk: rare in brawls, likely for elites and rivals, common for bosses
const PERK_ODDS = { normal: [.12, .2, .26], elite: [.4, .5, .6], rival: [.6, .7, .8], boss: [.5, .6, .7] };
function rollPerks() {
  if (!B || !B.sc || !RUN) return;
  const odds = (PERK_ODDS[B.type] || PERK_ODDS.normal)[Math.min(2, RUN.act)];
  if (R() >= odds) return;
  const al = alive(); if (!al.length) return;
  const e = al.find(x => isBoss(x)) || pick(al), id = pick(Object.keys(SPORT_PERKS));
  e.sp = id; B.sp = id;
  fx({ k: 'banner', t: `${e.n.split(',')[0]}: ${SPORT_PERKS[id].n}`, sub: SPORT_PERKS[id].desc, small: 1 });
  log(`Scouting report: ${e.n.split(',')[0]} is ${/^[AEIOU]/.test(SPORT_PERKS[id].n) ? 'an' : 'a'} ${SPORT_PERKS[id].n.toLowerCase()}. ${SPORT_PERKS[id].desc}`, 'bad');
  if (id === 'headstart' && SPORT_UNIT[B.sport]) { B.sc.them += SPORT_UNIT[B.sport]; momentumCheck(); }
}
// a perk counts while the enemy that has it is still standing
const perkOn = id => !!(B && B.enemies && B.enemies.some(e => e.sp === id && !e.dead && !e.fled));

/* High stakes: a consequence for losing the game. Rolled onto some fight rooms when the map is drawn. */
const STAKES = {
  grudge: { n: 'Grudge match', desc: 'Lose the game and a Pulled Hamstring goes into your deck.', icon: '!' },
  wager: { n: 'Side bet', desc: 'Win the game for 40 more gold; lose it and pay 40.', icon: '$' },
  brutal: { n: 'Bloodsport', desc: 'Lose the game and your line loses 3 max HP.', icon: '!' },
  ejection: { n: 'Hot-headed ref', desc: 'Lose the game and an Ejection Notice goes into your deck.', icon: '!' },
};
const STAKES_ODDS = [.14, .2, .26];
function stakeMap(nodes, act) {
  for (const n of Object.values(nodes)) if (n.t === 'fight' && !n.stakes && R() < STAKES_ODDS[act]) n.stakes = pick(Object.keys(STAKES));
  return nodes;
}
// settle the stakes when the fight is won (losing the fight ends the run anyway)
function settleStakes() {
  if (!B || !B.stakes || !B.sc) return null;
  const S = STAKES[B.stakes], won = !!B.sc.win;
  let what = '';
  if (B.stakes === 'wager') { if (won) { gainGold(40); what = 'You won the side bet: 40 gold.'; } else { RUN.gold = Math.max(0, RUN.gold - 40); what = 'You lost the side bet: 40 gold gone.'; } }
  else if (!won) {
    if (B.stakes === 'grudge') { RUN.deck.push(mkCard('injury')); what = 'They made it personal: a Pulled Hamstring is in your deck.'; }
    if (B.stakes === 'brutal') { RUN.maxhp = Math.max(20, RUN.maxhp - 3); RUN.hp = Math.min(RUN.hp, RUN.maxhp); what = 'A brutal game: your line loses 3 max HP.'; }
    if (B.stakes === 'ejection') { RUN.deck.push(mkCard('penalty')); what = 'The ref had it in for you: an Ejection Notice is in your deck.'; }
  } else what = `You won the game: the ${S.n.toLowerCase()} costs you nothing.`;
  return { id: B.stakes, won, what };
}
onHook('fightStart', () => { rollPerks(); if (B.stakes) { const S = STAKES[B.stakes]; fx({ k: 'banner', t: `High stakes: ${S.n}`, sub: S.desc, small: 1 }); log(`High stakes: ${S.desc}`, 'bad'); } });
