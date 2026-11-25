/* The Tilting Lists: the CPU's plan and its hands (issue #117, phase 1; the plan by its odds, phase 1's review).
   Before each course each CPU rider picks a plan (an aim, a guard and a pace), with the reason; then rides it with
   its skill's hands (JT_SKILL: how far its tip strays, how well it times the couch, how well it leans into a hit).

   The odds (jtOdds): what each plan is worth on the model itself, played out JT_ODDS.n times with a stream of its own
   (so working them out never touches the match's random numbers, and they are the same every time): for each aim and
   pace against each guard, the points it scores, its chance of a helm break and of an unhorsing; and for each guard
   (and a helm aim that misses, which leaves the rider reaching), the points the other rider scores on it and the
   chance of being unhorsed. They are kept by rider, mount, hands and the mount's wind, and not saved.
   - A Squire picks a plan at random.
   - A Knight plays the odds against either guard alike, and its own guard against a rider who aims for the shield
     or the body. It reads the score and the heat: behind by more than plain breaks can make up in the courses left
     (or behind at all in the match's last course), it rides for points (a helm break and an unhorsing count for
     more, the points against it for less); two or more ahead, it rides to keep its seat (the points against it and
     an unhorsing count double). It gallops whenever a gallop's odds are better now.
   - An Archmage reads the score as a Knight does and plays the odds too, but against the riders it is facing: how a
     rider of the other side's skill guards, aims and paces (JT_HABIT: a Squire's anything; a Knight's nearly always
     angled and mostly at the body). And it looks ahead at its mount's wind: a gallop now is worth what it costs
     the courses left in the heat, so it saves its gallop for when it pays. (Reading one rider's own habits comes in
     phase 4: G.plans keeps them.)
   In the tilt for the crown both ride the plan with the best expected margin over the other lance in the one course.
   Lab only: a side's plan can be made by another skill's logic (G.lab.planBy), ridden with another skill's hands
   (G.lab.handsBy) or held to one plan (G.lab.fix), so a lab can tell what a skill's plan is worth from its hands.
   A plan is { aim, guard, pace, why }, and its reason is what it did and why. */
const JT_SKILL = [
  { n: 'Squire', aim: 1.3, couch: .5, lean: .3 },
  { n: 'Knight', aim: 1, couch: .3, lean: .5 },
  { n: 'Archmage', aim: .85, couch: .2, lean: .62 }];
const JT_ODDS = { n: 700, seed: 117, winds: 5 };
// how a rider of each skill guards (the share angled) and aims, as the other side's Archmage reckons it
// (a Squire's are its random plan's; a Knight's what its odds make it ride, by the lab: nearly always angled, mostly at
// the body, a gallop more often than not; an Archmage's are more mixed, since it reads the side it faces)
const JT_HABIT = [{ angled: .5, gallop: .5, aim: { shield: .4, body: .35, helm: .25 } }, { angled: .95, gallop: .7, aim: { shield: .05, body: .85, helm: .1 } }, { angled: .6, gallop: .5, aim: { shield: .3, body: .4, helm: .3 } }];
const JT_ODDS_CACHE = new Map();
const JT_AIMS = ['shield', 'body', 'helm'], JT_PACES = ['canter', 'gallop'], JT_GUARDS = ['angled', 'square'];
// what side s needs: { lead (points ahead, + or -), left (courses still to ride for its riders, this one included), tilt, last, lastOfMatch, after (courses left in this heat after this one) }
function jtSituation(s) {
  const lead = jtTotal(s) - jtTotal(1 - s), tilt = jtInTilt();
  const left = tilt ? 1 : (G.courses - G.course) + (G.heat === 0 ? G.courses : 0);
  return { lead, left, tilt, last: !tilt && G.course === G.courses - 1, lastOfMatch: !tilt && G.heat === JT_RULES.heats - 1 && G.course === G.courses - 1, after: tilt ? 0 : G.courses - G.course - 1 };
}
const jtWindB = w => Math.round(clamp(w, 0, 1) * (JT_ODDS.winds - 1)) / (JT_ODDS.winds - 1);
/* the odds for a rider (rs, mount) with a skill's hands at a wind, against the other side's aims and paces (mix: { aim, gallop }): { mine:
   { 'aim|pace|guard': { pts, helm, unh } }, theirs: { 'guard|reach': { pts, unh } } } */
function jtOdds(rs, mount, hk, wind, mix) {
  const key = JSON.stringify([rs, mount, hk, jtWindB(wind), mix]);
  let O = JT_ODDS_CACHE.get(key); if (O) return O;
  const rnd = engRng(JT_ODDS.seed), H = JT_SKILL[hk], hands = { aim: H.aim, couch: H.couch }, other = jtRs(''), N = JT_ODDS.n, w = jtWindB(wind);
  const pts = (I, s) => I.res[s].unhorse ? JT_RULES.unhorse : JT_RULES.pts[I.res[s].at] || 0;
  O = { mine: {}, theirs: {} };
  for (const aim of JT_AIMS) for (const pace of JT_PACES) for (const g of JT_GUARDS) {
    let p = 0, hb = 0, un = 0, br = 0;
    for (let i = 0; i < N; i++) {
      const a = jtCharge({ plan: { aim, guard: 'square', pace }, rs, mount, wind: w, hands }, rnd), d = { guard: g, rs: other, mount: JT_MOUNT_DEF, aim: 'shield' };
      const st = jtStrike(a, d, rnd), se = jtSeat(st, d, .5, rnd);
      p += se.unhorse ? JT_RULES.unhorse : JT_RULES.pts[st.at] || 0; if (st.broke) br++; if (st.broke && st.zone === 'helm') hb++; if (se.unhorse) un++;
    }
    O.mine[`${aim}|${pace}|${g}`] = { pts: p / N, brk: br / N, helm: hb / N, unh: un / N };
  }
  for (const g of JT_GUARDS) for (const reach of [false, true]) {
    let p = 0, un = 0;
    for (let i = 0; i < N; i++) {
      const aim = wpickR(mix.aim, rnd), b = jtCharge({ plan: { aim, guard: 'square', pace: rnd() < mix.gallop ? 'gallop' : 'canter' }, rs: other, mount: JT_MOUNT_DEF, wind: 1, hands: { aim: 1, couch: .3 } }, rnd);
      const me = { guard: g, rs, mount, aim: reach ? 'helm' : 'shield' }, st = jtStrike(b, me, rnd), se = jtSeat(st, me, JT_SKILL[hk].lean, rnd, reach ? { broke: false } : null);
      p += se.unhorse ? JT_RULES.unhorse : JT_RULES.pts[st.at] || 0; if (se.unhorse) un++;
    }
    O.theirs[`${g}|${reach}`] = { pts: p / N, unh: un / N };
  }
  JT_ODDS_CACHE.set(key, O);
  return O;
}
// a weighted pick from rnd (not the engine's R)
function wpickR(w, rnd) { let t = 0; for (const k in w) t += Math.max(0, w[k]); let r = rnd() * t; for (const k in w) { r -= Math.max(0, w[k]); if (r <= 0) return k; } return Object.keys(w)[0]; }
// a plan's worth to side s: what it scores against the guards as reckoned, less what it concedes (with the weights
// the score calls for), and for an Archmage what the pace costs the courses left in the heat
function jtWorth(O, aim, pace, guard, angled, W) {
  const m = g => O.mine[`${aim}|${pace}|${g}`], mn = { pts: 0, brk: 0, helm: 0, unh: 0 };
  for (const [g, p] of [['angled', angled], ['square', 1 - angled]]) { const x = m(g); for (const k in mn) mn[k] += p * x[k]; }
  let th = O.theirs[`${guard}|false`];
  // (a helm aim that doesn't break leaves the rider reaching past the head: their lance is worth more against it)
  if (aim === 'helm') { const tr = O.theirs[`${guard}|true`], pm = clamp(1 - mn.brk, 0, 1); th = { pts: th.pts * (1 - pm) + tr.pts * pm, unh: th.unh * (1 - pm) + tr.unh * pm }; }
  return W.mine * mn.pts + W.helm * mn.helm + W.unh * mn.unh * JT_RULES.unhorse - W.theirs * th.pts - W.taken * th.unh * JT_RULES.unhorse;
}
function jtPlan(s) {
  const lab = G.lab || {}, sk = lab.planBy && lab.planBy[s] != null ? lab.planBy[s] : G.skill[s];
  if (lab.fix && lab.fix[s]) return Object.assign({ why: 'held to one plan (a lab)' }, lab.fix[s]);
  if (sk <= 0) {
    const aim = wpick({ shield: 4, body: 3.5, helm: 2.5 }), guard = R() < .5 ? 'angled' : 'square', pace = R() < .5 ? 'gallop' : 'canter';
    return { aim, guard, pace, why: 'a plan picked on a whim' };
  }
  const Q = jtSituation(s), ri = (jtRiders() || [])[s], rs = jtRsOf(s, ri), mount = jtMountOf(s), hk = jtHandsK(s), W0 = G.wind[s];
  const them = clamp(G.skill[1 - s] | 0, 0, 2), habit = sk >= 2 ? JT_HABIT[them] : { angled: .5, gallop: .5, aim: { shield: .5, body: .5, helm: 0 } };
  const O = jtOdds(rs, mount, hk, W0, { aim: habit.aim, gallop: habit.gallop });
  // the weights the score calls for
  const need = !Q.tilt && Q.lead < 0 && (-Q.lead > Q.left || Q.lastOfMatch), safe = !Q.tilt && Q.lead >= 2;
  const W = need ? { mine: 1, helm: 1, unh: 1.5, theirs: .4, taken: .4 } : safe ? { mine: 1, helm: 0, unh: 1, theirs: 2, taken: 2 } : { mine: 1, helm: 0, unh: 1, theirs: 1, taken: 1 };
  // an Archmage's pace looks ahead: the courses left in the heat ride on what wind this one leaves
  const ahead = (pace) => {
    if (sk < 2 || !Q.after) return 0;
    const M = jtMount(mount), w1 = clamp(W0 - jtWindCost(pace, rs) + M.rec * (.6 + .4 * (rs.ride ?? .5)), 0, 1), O1 = jtOdds(rs, mount, hk, w1, { aim: habit.aim, gallop: habit.gallop });
    let best = -9; for (const a of JT_AIMS) for (const p of JT_PACES) best = Math.max(best, jtWorth(O1, a, p, 'angled', habit.angled, W));
    return Q.after * best;
  };
  let pick = null;
  for (const aim of JT_AIMS) for (const pace of JT_PACES) for (const guard of JT_GUARDS) {
    const now = jtWorth(O, aim, pace, guard, habit.angled, W), v = now + ahead(pace);
    if (!pick || v > pick.v + 1e-9) pick = { aim, pace, guard, v, now };
  }
  // what the other pace would have been worth now, for the reason
  let otherNow = -9; for (const a of JT_AIMS) for (const g of JT_GUARDS) otherNow = Math.max(otherNow, jtWorth(O, a, pick.pace === 'gallop' ? 'canter' : 'gallop', g, habit.angled, W));
  return { aim: pick.aim, guard: pick.guard, pace: pick.pace, why: jtWhy(s, sk, Q, pick, otherNow, need, safe, them) };
}
// the reason, true to what the plan does and why
function jtWhy(s, sk, Q, P, otherNow, need, safe, them) {
  const aim = JT_PLAN.aim[P.aim].n, pace = JT_PLAN.pace[P.pace].n;
  let why = Q.tilt ? `the tilt for the crown: ${aim} at ${pace}, the best expected margin over their lance`
    : need ? `behind by ${-Q.lead} with ${Q.left === 1 ? 'one course' : Q.left + ' courses'} left: ${aim} at ${pace}, riding for the points`
    : safe ? `ahead by ${Q.lead}: weighing the points against it double, ${aim} at ${pace}`
    : sk >= 2 ? `against how ${JT_SKILL[them].n}s ride (${JT_HABIT[them].angled > .7 ? 'shields angled' : 'either guard'}, ${JT_HABIT[them].aim.body > .6 ? 'lances at the body' : 'lances anywhere'}): ${aim} at ${pace} has the best odds`
    : `the best odds against either guard: ${aim} at ${pace}`;
  if (sk >= 2 && !Q.tilt) {
    if (P.pace === 'canter' && otherNow > P.now + 1e-9) why += ', saving the mount\'s wind for the courses left in the heat';
    else if (P.pace === 'gallop' && !Q.after) why += ', with no more courses in the heat to save the wind for';
  }
  return why + (P.guard === 'angled' ? '; the shield angled to turn their lance' : '; the shield square to take it and stay on');
}
// side s's hands, by skill (a lab may ride a side with another skill's hands)
const jtHandsK = s => { const lab = G.lab || {}; return clamp((lab.handsBy && lab.handsBy[s] != null ? lab.handsBy[s] : G.skill[s]) | 0, 0, JT_SKILL.length - 1); };
const jtHands = s => JT_SKILL[jtHandsK(s)];
// side s's lean into a hit (0 to 1), by skill
const jtLean = s => clamp(jtHands(s).lean + .2 * gauss(), 0, 1);
