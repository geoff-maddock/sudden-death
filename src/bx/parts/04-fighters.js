/* The Anvil Ring: the fighters (issue #23, phase 1). Six ratings, 1 to 10 (the Realm's own run to 12): reach (how far
   their punches land from), pow (how hard they hit), spd (how fast they move and punch), chin (how much they take),
   sta (how long their stamina lasts) and gui (guile: reading the other fighter, slipping and timing). BX_KIND seeds
   them by kind; size shows here rather than in weight classes (question 3), so a golem hits like a wall and moves like
   one, and a harpy is all speed and no chin.
   A fighter in the ring, plain JSON: { side, n, kind, num, r, style, x, y, hp, hpMax, sta, staMax, a, mv, plan, ... }.
   hp falls when they're hit and zero is a knockdown; big shots also lower hpMax, the most they can get back, so each
   knockdown comes easier than the last. sta pays for punches and comes back off the gas. a is what they're doing now
   ({ k, t, dur, hitAt, id }), mv where they want to move. */
const BX_STATS = ['reach', 'pow', 'spd', 'chin', 'sta', 'gui'];
const BX_KIND = {
  goblin: [4, 5, 8, 4, 7, 8], kobold: [4, 5, 7, 5, 8, 7], werewolf: [6, 8, 8, 4, 6, 4], dwarf: [3, 7, 4, 7, 7, 5],
  ogre: [8, 10, 2, 8, 5, 2], minotaur: [6, 9, 5, 7, 5, 3], troll: [8, 8, 3, 7, 6, 3], golem: [6, 10, 1, 10, 6, 2],
  harpy: [7, 4, 10, 3, 6, 7], elf: [8, 4, 7, 4, 6, 7], wraith: [6, 4, 8, 3, 6, 9], vampire: [6, 6, 7, 5, 6, 7],
  lich: [7, 5, 4, 4, 5, 9], zombie: [5, 6, 2, 9, 9, 1], gorgon: [5, 5, 6, 6, 6, 7], spider: [9, 5, 7, 4, 5, 6],
  skeleton: [7, 4, 6, 4, 8, 6], witch: [5, 4, 6, 4, 7, 9],
};
function bxRate(kind) { const k = BX_KIND[kind] || BX_KIND.goblin; return Object.fromEntries(BX_STATS.map((s, i) => [s, k[i]])); }
/* how a fighter boxes when nobody tells them otherwise: the long-armed stay away (against a shorter fighter, o), the
   guileful counter, the heavy hitters press, and the iron-chinned grinders work the body */
function bxStyle(r, o) {
  if (o ? r.reach >= o.reach + 2 && r.spd >= 3 : r.reach >= 7 && r.spd >= 6) return 'away';
  if (r.gui >= 8) return 'counter';
  if (r.pow >= 8) return 'press';
  if (r.chin >= 8 && r.sta >= 8) return 'body';
  return r.spd >= 7 ? 'counter' : 'press';
}
const BX_HP = 100;
// the fighter for side from { n, kind, num, r?, style? } (r: ratings to lay over the kind's; style: a plan to box to)
function bxFighter(p, side) {
  const r = Object.assign(bxRate(p.kind), p.r || {}), staMax = Math.round(68 + r.sta * 4.5), style = BX_PLAN[p.style] ? p.style : bxStyle(r);
  return { side, n: p.n || p.kind, kind: p.kind, num: p.num ?? '', r, style, plan: style,
    x: side ? 5 : -5, y: side ? 1 : -1, hp: BX_HP, hpMax: BX_HP, sta: staMax, staMax, patches: BX_RULES.patches,
    a: { k: 'idle', t: 0, dur: 0, hitAt: 0, id: 0 }, mv: [0, 0], think: 0, seen: -1, ctr: 0, n2: 0,
    rs: bxStatsZero(), bs: bxStatsZero() };
}
// a round's (rs) or bout's (bs) work: punches thrown and landed, power punches landed, damage done, defense as the
// judges count it (a slip 1, a block half), punches slipped and blocked, seconds pressing forward, clinches started
function bxStatsZero() { return { thrown: 0, landed: 0, power: 0, dmg: 0, def: 0, slips: 0, blocks: 0, press: 0, clinch: 0 }; }
