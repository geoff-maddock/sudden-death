/* Season goals: two per act, shown on the map. Each is a ladder of three tiers: finish one and the same goal
   climbs to a harder target with a bigger payout, until its third tier is done. Paid the moment you complete it.
   Fans come from sports wins and are spent at the pro shop's fan stand. */
const PAY = { rare: { t: 'card', n: 'A rare card choice' }, prac: { t: 'practice', n: 'Practice a card' }, hp5: { t: 'hp', v: 3, n: '+3 max HP' },
  gold: { t: 'gold', v: 40, n: '40 gold and 40 fans' }, fans120: { t: 'fans', v: 80, n: '80 fans' }, fans180: { t: 'fans', v: 120, n: '120 fans' } };
const GOALS = {
  wins: { n: (a, need) => `Win ${need} games this act`, tiers: [3, 5, 7], pay: [PAY.rare, PAY.prac, PAY.fans180], count: g => g.won ? 1 : 0 },
  variety: { n: (a, need) => `Win games in ${need} different sports`, tiers: [3, 4, 5], pay: [PAY.gold, PAY.fans120, PAY.rare], count: null },
  home: { n: (a, need) => `Win ${need} ${SPORT_NAME[ACT_HOME[a]].toLowerCase()} games`, tiers: [2, 3, 5], pay: [PAY.prac, PAY.prac, PAY.hp5], count: (g, a) => g.won && g.sport === ACT_HOME[a] ? 1 : 0 },
  reel: { n: (a, need) => `Make ${need} highlights`, tiers: [2, 4, 6], pay: [PAY.hp5, PAY.fans120, PAY.rare], count: g => (g.hl || []).length },
  clean: { n: (a, need) => need === 1 ? 'Win a game without them scoring' : `Win ${need} games without them scoring`, tiers: [1, 2, 3], pay: [PAY.fans120, PAY.prac, PAY.rare], count: g => g.won && !g.them && g.sport !== 'golf' && g.sport !== 'bowling' ? 1 : 0 },
};
const TIER_NAME = ['I', 'II', 'III'];
function setGoals(act) { RUN.goals = RUN.goals || {}; RUN.goals[act] = shuffle(Object.keys(GOALS)).slice(0, 2).map(id => ({ id, tier: 0, done: false })); }
function goalNeed(g) { return GOALS[g.id].tiers[Math.min(g.tier || 0, 2)]; }
function goalProgress(act, g) {
  const G = GOALS[g.id], games = (RUN.games || []).filter(x => x.act === act && !x.fell);
  const have = G.count ? games.reduce((s, x) => s + G.count(x, act), 0) : new Set(games.filter(x => x.won).map(x => x.sport)).size;
  const need = goalNeed(g); return [Math.min(have, need), need];
}
// called after every fight: pays and climbs every goal whose current tier is met (a big game can clear two)
function checkGoals() {
  if (!RUN.goals || !RUN.goals[RUN.act]) setGoals(RUN.act);
  const done = [];
  for (const g of RUN.goals[RUN.act]) {
    g.tier = g.tier || 0;
    while (!g.done) {
      const [h, n] = goalProgress(RUN.act, g); if (h < n) break;
      const G = GOALS[g.id], pay = G.pay[g.tier];
      done.push({ id: g.id, tier: g.tier, need: n, pay: pay.n, t: pay.t }); payGoal(pay);
      if (g.tier >= 2) g.done = true; else g.tier++;
    }
  }
  return done;
}
function payGoal(p) {
  if (p.t === 'gold') { gainGold(p.v); RUN.fans = (RUN.fans || 0) + 40; }
  if (p.t === 'hp') { RUN.maxhp += p.v; RUN.hp += p.v; }
  if (p.t === 'fans') RUN.fans = (RUN.fans || 0) + p.v;
  if (p.t === 'practice') RUN.pracTokens = (RUN.pracTokens || 0) + 1;
  if (p.t === 'card') RUN.rareTokens = (RUN.rareTokens || 0) + 1;
  achAdd('goals', 1);
}
function goalsPanel() {
  if (!RUN.goals || !RUN.goals[RUN.act]) setGoals(RUN.act);
  return `<section><h4>Season goals</h4>${RUN.goals[RUN.act].map(g => { const [h, n] = goalProgress(RUN.act, g), G = GOALS[g.id], t = Math.min(g.tier || 0, 2);
    return `<div class="goal${g.done ? ' done' : ''}"><b>${esc(G.n(RUN.act, n))} <span class="tier">${g.done ? 'complete' : 'Tier ' + TIER_NAME[t]}</span></b><div class="gbar"><i style="width:${100 * h / n}%"></i></div><div class="pips">${[0, 1, 2].map(k => `<i class="${k < t || g.done ? 'on' : k === t ? 'now' : ''}"></i>`).join('')}</div><small>${g.done ? 'All three tiers done.' : `${h}/${n}. Pays: ${esc(G.pay[t].n)}`}</small></div>`; }).join('')}
    <p class="hint" style="margin:6px 0 0;font-size:13px">Finish a goal and it climbs to a harder tier. Fans: <b style="color:var(--bone)">${RUN.fans || 0}</b>, from sports wins; spend them at the pro shop’s fan stand.</p></section>`;
}
// the fan stand at the pro shop
const FAN_STAND = [
  { id: 'practice', n: 'Practice session', d: 'Practice a card: ★, better at every sport.', cost: 120, ok: () => RUN.deck.some(practicable), go: done => pickFromDeck('practice', c => done(!!c)) },
  { id: 'hp', n: 'Fan favourite', d: '+3 max HP.', cost: 150, ok: () => true, go: done => { RUN.maxhp += 3; RUN.hp += 3; done(true); } },
  { id: 'mascot', n: 'Mascot', d: 'A random uncommon trophy.', cost: 260, ok: () => relicPool('u').length > 0, go: done => { gainRelic(pick(relicPool('u'))); done(true); } },
];
