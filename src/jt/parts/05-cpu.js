/* The Tilting Lists: the CPU's plan and its hands (issue #117, phase 1; the plan by its odds, phase 1's review).
   Before each course each CPU rider picks a plan (an aim, a guard and a pace), with the reason; then rides it with
   its skill's hands (JT_SKILL: how far its tip strays, how well it times the couch, how well it leans into a hit).

   The odds and the course as a game: below (phase 2's review). Every skill reads the score and the heat: behind by
   more than plain breaks can make up in the courses left (or behind at all in the match's last course), it rides for
   points (a helm break and an unhorsing count for more, the points against it for less); two or more ahead, it rides
   to keep its seat (the points against it and an unhorsing count double).
   - A Squire picks a plan at random.
   - A Knight rides the course's mix (jtEquil): no plan always ridden beats it.
   - An Archmage reads the riders it faces and rides the best plan against its read, looking ahead at its mount's
     wind (a gallop now is worth what it costs the courses left in the heat, so it saves its gallop for when it pays).
   In the tilt for the crown both ride for the best expected margin over the other lance in the one course.
   Lab only: a side's plan can be made by another skill's logic (G.lab.planBy; 'word', your squire's), ridden with another skill's hands
   (G.lab.handsBy), held to one plan (G.lab.fix) or to one guard (G.lab.guard), so a lab can tell what a skill's plan
   is worth from its hands.
   A plan is { aim, guard, pace, why }, and its reason is what it did and why. */
const JT_SKILL = [
  { n: 'Squire', aim: 1.3, couch: .5, lean: .3 },
  { n: 'Knight', aim: 1, couch: .3, lean: .5 },
  { n: 'Archmage', aim: .85, couch: .2, lean: .62 }];
const JT_ODDS = { n: 400, seed: 117, winds: 5 };
/* The course as a game (phase 2's review). Both riders pick a plan at once, so a plan is only as good as what it
   meets: the odds (jtOdds) are a rider's strike on a plain rider (A: its points, breaks, helm breaks and unhorsings
   by its aim and pace against each guard, the other reaching or not) and a plain Knight's strike on them (B), each
   cell played out JT_ODDS.n times on a stream of its own (the same numbers for every cell, so cells compare fairly;
   the match's random numbers are never touched). jtVal is one plan against another (points less points against,
   weighted as the score calls for, JT_W: a helm aim that doesn't break leaves its rider reaching). jtEquil solves the
   course as a game between the two (fictitious play): the mix of plans nobody can beat by always riding one plan.
   - A Knight rides that mix (plans under JT_READ.min left out), drawn from the engine's stream: it can't be read, and
     no plan always ridden beats it.
   - An Archmage reads the riders it faces (jtHabitOf): from the mix their own rider would ride (a Squire's anything)
     and what they have really ridden in the match, and rides the plan with the best odds against that read, looking
     ahead at its mount's wind for the courses left in the heat.
   - Your squire's word on Play (jtSuggest) is the Archmage's read with a Knight's hands: the best plan by the odds
     against how the other side rides. */
const JT_ODDS_CACHE = new Map(), JT_MIX_CACHE = new Map();
// the odds and the mixes are kept by the rider's ratings, the mount's id and the hands' index, not the model's numbers:
// a lab that changes a model table (wJT.model) clears them with this, or the CPU plans on the old numbers
function jtClearOdds() { JT_ODDS_CACHE.clear(); JT_MIX_CACHE.clear(); }
const JT_AIMS = ['shield', 'body', 'helm'], JT_PACES = ['canter', 'gallop'], JT_GUARDS = ['angled', 'square'];
const JT_PLANS = []; for (const aim of JT_AIMS) for (const pace of JT_PACES) for (const guard of JT_GUARDS) JT_PLANS.push({ aim, pace, guard });
// how much an Archmage's read leans on what it expects (prior courses' worth), the step its read is rounded to, the
// least share of a Knight's mix it rides, and how long the game is solved for
const JT_READ = { prior: 2, step: .1, min: .04, iters: 3000, look: .8 };
// a Squire's plan, as an Archmage reckons it (its random plan's shares)
const JT_SQUIRE_HABIT = { angled: .5, gallop: .5, aim: { shield: .4, body: .35, helm: .25 } };
// the weights the score calls for: even, behind with too few courses left (riding for the points), well ahead
const JT_W = { even: { mine: 1, helm: 0, unh: .25, theirs: 1, taken: .25, shake: .25 }, need: { mine: 1, helm: 5, unh: 2, theirs: .3, taken: .3, shake: 0 }, safe: { mine: 1, helm: 0, unh: 1, theirs: 2, taken: 2, shake: .5 } };
// what side s needs: { lead (points ahead, + or -), left (courses still to ride for its riders, this one included), tilt, last, lastOfMatch, after (courses left in this heat after this one) }
function jtSituation(s) {
  const lead = jtTotal(s) - jtTotal(1 - s), tilt = jtInTilt();
  const left = tilt ? 1 : (G.courses - G.course) + (G.heat === 0 ? G.courses : 0);
  return { lead, left, tilt, last: !tilt && G.course === G.courses - 1, lastOfMatch: !tilt && G.heat === JT_RULES.heats - 1 && G.course === G.courses - 1, after: tilt ? 0 : G.courses - G.course - 1 };
}
const jtWindB = w => Math.round(clamp(w, 0, 1) * (JT_ODDS.winds - 1)) / (JT_ODDS.winds - 1);
const jtCell = (aim, pace, g, reach) => `${aim}|${pace}|${g}|${reach}`;
/* the odds for a rider (rs, mount) with a skill's hands at a wind, and as they set off (X: the arm, a shake, the girth
   and the pressure, jtRideX, each rounded): { A, B }, each { 'aim|pace|guard|reach': { pts, brk, helm, unh } } */
const jtXB = X => { const q = (v, d, k) => Math.round((v ?? d) * k) / k; X = X || {}; return { arm: q(X.arm, 1, 4), shaken: q(X.shaken, 0, 4), girth: q(X.girth, 0, 20), press: X.press ? 1 : 0 }; };
function jtOdds(rs, mount, hk, wind, X0) {
  const w = jtWindB(wind), X = jtXB(X0), key = JSON.stringify([rs, mount, hk, w, X]);
  let O = JT_ODDS_CACHE.get(key); if (O) return O;
  const H = JT_SKILL[hk], hands = { aim: H.aim, couch: H.couch }, other = jtRs(''), N = JT_ODDS.n, own = r => r ? { broke: false, high: true } : { broke: true };
  O = { A: {}, B: {} };
  for (const aim of JT_AIMS) for (const pace of JT_PACES) for (const g of JT_GUARDS) for (const reach of [false, true]) {
    const a = { pts: 0, brk: 0, helm: 0, unh: 0 }, b = { pts: 0, brk: 0, helm: 0, unh: 0 };
    let rnd = engRng(JT_ODDS.seed);
    const xP = jtChargePrep({ plan: { aim, guard: 'square', pace }, rs, mount, wind: w, hands, arm: X.arm, shaken: X.shaken, press: X.press });
    for (let i = 0; i < N; i++) {
      const x = xP(rnd), d = { guard: g, rs: other, mount: JT_MOUNT_DEF };
      const st = jtStrike(x, d, rnd), se = jtSeat(st, d, .5, rnd, own(reach));
      a.pts += se.unhorse ? JT_RULES.unhorse : JT_RULES.pts[st.at] || 0; if (st.broke) a.brk++; if (st.broke && st.zone === 'helm') a.helm++; if (se.unhorse) a.unh++;
    }
    rnd = engRng(JT_ODDS.seed + 1);
    const yP = jtChargePrep({ plan: { aim, guard: 'square', pace }, rs: other, mount: JT_MOUNT_DEF, wind: 1, hands: { aim: 1, couch: .3 } });
    for (let i = 0; i < N; i++) {
      const y = yP(rnd), me = { guard: g, rs, mount, girth: X.girth, shaken: X.shaken };
      const st = jtStrike(y, me, rnd), se = jtSeat(st, me, H.lean, rnd, own(reach));
      b.pts += se.unhorse ? JT_RULES.unhorse : JT_RULES.pts[st.at] || 0; if (st.broke) b.brk++; if (st.broke && st.zone === 'helm') b.helm++; if (se.unhorse) b.unh++;
    }
    for (const k in a) { a[k] /= N; b[k] /= N; }
    O.A[jtCell(aim, pace, g, reach)] = a; O.B[jtCell(aim, pace, g, reach)] = b;
  }
  JT_ODDS_CACHE.set(key, O);
  return O;
}
// plan i against plan j, on the odds O, with the weights W: what i scores less what it lets in
function jtVal(O, i, j, W) {
  const A = r => O.A[jtCell(i.aim, i.pace, j.guard, r)], B = r => O.B[jtCell(j.aim, j.pace, i.guard, r)];
  const reachI = i.aim === 'helm' ? 1 - A(false).brk : 0, reachJ = j.aim === 'helm' ? 1 - B(false).brk : 0;
  const mix = (x, y, p) => ({ pts: x.pts * (1 - p) + y.pts * p, brk: x.brk * (1 - p) + y.brk * p, helm: x.helm * (1 - p) + y.helm * p, unh: x.unh * (1 - p) + y.unh * p });
  const m = mix(A(false), A(true), reachJ), t = mix(B(false), B(true), reachI);
  // (a lance broken on a rider who stays on leaves them shaken for the next course: W.shake a break, either way)
  return W.mine * m.pts + W.helm * m.helm + W.unh * m.unh * JT_RULES.unhorse - W.theirs * t.pts - W.taken * t.unh * JT_RULES.unhorse + W.shake * (m.brk - m.unh - t.brk + t.unh);
}
// the course as a game on the odds O with the weights W: the mix of plans (a share each of JT_PLANS) nobody beats by always riding one
// pc: what each pace is worth beyond the course (the wind it leaves for the courses after, as both riders reckon it);
// the mix comes back with its value to the rider (x.v)
function jtEquil(O, W, wk, pc) {
  const key = jtOddsKey(O) + '|' + wk + (pc ? '|' + pc.canter.toFixed(3) + '|' + pc.gallop.toFixed(3) : '');
  let x = JT_MIX_CACHE.get(key); if (x) return x;
  const n = JT_PLANS.length, f = p => pc ? pc[p.pace] : 0, V = JT_PLANS.map(i => JT_PLANS.map(j => jtVal(O, i, j, W) + f(i) - f(j))), cr = Array(n).fill(0), cc = Array(n).fill(1);
  for (let t = 0; t < JT_READ.iters; t++) {
    let bi = 0, bv = -1e9; for (let i = 0; i < n; i++) { let v = 0; for (let j = 0; j < n; j++) v += cc[j] * V[i][j]; if (v > bv + 1e-12) { bv = v; bi = i; } } cr[bi]++;
    let bj = 0, bw = 1e9; for (let j = 0; j < n; j++) { let v = 0; for (let i = 0; i < n; i++) v += cr[i] * V[i][j]; if (v < bw - 1e-12) { bw = v; bj = j; } } cc[bj]++;
  }
  const tot = cr.reduce((a, b) => a + b, 0), ct = cc.reduce((a, b) => a + b, 0);
  x = cr.map(c => c / tot);
  let v = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) v += x[i] * (cc[j] / ct) * V[i][j];
  x.v = v;
  JT_MIX_CACHE.set(key, x);
  return x;
}
// (each odds table gets a short name, for the mixes kept)
const JT_ODDS_ID = new WeakMap(); let JT_ODDS_N = 0;
const jtOddsKey = O => { if (!JT_ODDS_ID.has(O)) JT_ODDS_ID.set(O, ++JT_ODDS_N); return JT_ODDS_ID.get(O); };
// the shares of a mix by aim, guard and pace: { angled, gallop, aim: { shield, body, helm } }
function jtMarg(x) {
  const out = { angled: 0, gallop: 0, aim: { shield: 0, body: 0, helm: 0 } };
  JT_PLANS.forEach((p, i) => { if (p.guard === 'angled') out.angled += x[i]; if (p.pace === 'gallop') out.gallop += x[i]; out.aim[p.aim] += x[i]; });
  return out;
}
// a weighted pick from rnd (not the engine's R)
function wpickR(w, rnd) { let t = 0; for (const k in w) t += Math.max(0, w[k]); let r = rnd() * t; for (const k in w) { r -= Math.max(0, w[k]); if (r <= 0) return k; } return Object.keys(w)[0]; }
// (lab only: a side's guard held, whatever its plan: G.lab.guard)
function jtPlan(s) {
  const P = jtPlanOwn(s), g = ((G.lab || {}).guard || [])[s];
  if (g && P.guard !== g) { P.guard = g; P.why += ` (a lab: the shield held ${g})`; }
  return P;
}
// the mix a Knight riding for side s would ride now (the weights its situation calls for): a share each of JT_PLANS
function jtMixNow(s, hk) {
  const ri = (jtRiders() || [])[s]; if (ri == null) return null;
  const Q = jtSituation(s), need = !Q.tilt && Q.lead < 0 && (-Q.lead > Q.left || Q.lastOfMatch), wk = need ? 'need' : !Q.tilt && Q.lead >= 2 ? 'safe' : 'even';
  const rs = jtRsOf(s, ri), mount = jtMountOf(s), W0 = G.wind[s], X = jtRideX(s), W = JT_W[wk];
  hk = hk != null ? hk : jtHandsK(s);
  // (a gallop costs what the wind it spends is worth in the courses after: pc)
  const pc = Q.after ? Object.fromEntries(JT_PACES.map(p => { const M = jtMount(mount), w1 = clamp(W0 - jtWindCost(p, rs, mount) + M.rec * (.6 + .4 * (rs.ride ?? .5)), 0, 1);
    return [p, JT_READ.look * Math.min(Q.after, 2) * jtEquil(jtOdds(rs, mount, hk, w1, { arm: X.arm }), W, wk).v]; })) : null;
  return jtEquil(jtOdds(rs, mount, hk, W0, X), W, wk, pc);
}
// the mix side s's rider would ride now, by the course as a game (even weights)
function jtMixOf(s) {
  const ri = (jtRiders() || [])[s]; if (ri == null) return null;
  return jtEquil(jtOdds(jtRsOf(s, ri), jtMountOf(s), jtHandsK(s), G.wind[s], jtRideX(s)), JT_W.even, 'even');
}
/* what side s reckons the other side's rider rides: { angled, gallop, aim: { shield, body, helm }, n, read }: the mix
   that rider would ride by the odds (a Squire's anything), then what the other side has really ridden in the match
   (G.plans), JT_READ.prior courses' worth of the first against every course of the second (phase 4 builds the
   herald's card on it) */
function jtHabitOf(s) {
  const o = 1 - s, sk = clamp(G.skill[o] | 0, 0, 2), lab = G.lab || {};
  const H = sk <= 0 && !(lab.planBy && lab.planBy[o] >= 1) ? JT_SQUIRE_HABIT : jtMarg(jtMixOf(o) || JT_PLANS.map(() => 1 / JT_PLANS.length));
  const P = (G.plans && G.plans[o]) || [], k = JT_READ.prior, n = P.length, q = v => Math.round(v / JT_READ.step) * JT_READ.step;
  const sh = (f, prior) => (prior * k + P.filter(f).length) / (k + n);
  const aim = Object.fromEntries(JT_AIMS.map(a => [a, q(sh(p => p.aim === a, H.aim[a]))]));
  return { angled: q(sh(p => p.guard === 'angled', H.angled)), gallop: q(sh(p => p.pace === 'gallop', H.gallop)), aim, n, read: n > 0 };
}
// a plan's worth against a read habit h (the other side's plans taken as aim, guard and pace each by their shares)
function jtAgainst(O, i, h, W) {
  let v = 0, t = 0;
  for (const j of JT_PLANS) { const q = (h.aim[j.aim] || 0) * (j.guard === 'angled' ? h.angled : 1 - h.angled) * (j.pace === 'gallop' ? h.gallop : 1 - h.gallop); if (q > 0) { v += q * jtVal(O, i, j, W); t += q; } }
  return t ? v / t : 0;
}
/* side s's plan: o = { sk: the logic (a skill, or 'word': your squire's), hk: the hands it reckons with, det: no
   random draw (a Knight rides its likeliest plan; for the corner's sums) } */
function jtPlanOwn(s, o) {
  o = o || {};
  const lab = G.lab || {}, sk = o.sk != null ? o.sk : lab.planBy && lab.planBy[s] != null ? lab.planBy[s] : G.skill[s];
  if (lab.fix && lab.fix[s] && o.sk == null) return Object.assign({ why: 'held to one plan (a lab)' }, lab.fix[s]);
  if (sk === 0 || sk === '0') {
    if (o.det) return Object.assign({ why: 'a plan picked on a whim' }, JT_CORNER.plain);
    const aim = wpick({ shield: 4, body: 3.5, helm: 2.5 }), guard = R() < .5 ? 'angled' : 'square', pace = R() < .5 ? 'gallop' : 'canter';
    return { aim, guard, pace, why: 'a plan picked on a whim' };
  }
  const Q = jtSituation(s), ri = (jtRiders() || [])[s], rs = jtRsOf(s, ri), mount = jtMountOf(s), hk = o.hk != null ? o.hk : jtHandsK(s), W0 = G.wind[s];
  const need = !Q.tilt && Q.lead < 0 && (-Q.lead > Q.left || Q.lastOfMatch), safe = !Q.tilt && Q.lead >= 2, wk = need ? 'need' : safe ? 'safe' : 'even', W = JT_W[wk];
  const X = jtRideX(s), O = jtOdds(rs, mount, hk, W0, X), them = clamp(G.skill[1 - s] | 0, 0, 2);
  if (sk === 1) {
    // a Knight rides the course's mix (jtMixNow: a gallop costing what the wind it spends is worth in the courses after)
    const x = jtMixNow(s, hk), keep = x.map(v => v >= JT_READ.min ? v : 0), tot = keep.reduce((a, b) => a + b, 0) || 1;
    let at = keep.indexOf(Math.max(...keep));
    if (!o.det) { let r = R() * tot; for (let i = 0; i < keep.length; i++) { r -= keep[i]; if (r <= 0 && keep[i] > 0) { at = i; break; } } }
    const P = JT_PLANS[at];
    return { aim: P.aim, guard: P.guard, pace: P.pace, why: jtWhy(s, 1, Q, { aim: P.aim, pace: P.pace, guard: P.guard, share: keep[at] / tot }, need, safe, them, null) };
  }
  // an Archmage (and your squire's word): the best odds against the read, looking ahead at the mount's wind
  const h = jtHabitOf(s), look = sk === 2;
  const ahead = pace => {
    if (!look || !Q.after) return 0;
    const M = jtMount(mount), w1 = clamp(W0 - jtWindCost(pace, rs, mount) + M.rec * (.6 + .4 * (rs.ride ?? .5)), 0, 1), O1 = jtOdds(rs, mount, hk, w1, { arm: X.arm });
    let best = -9; for (const i of JT_PLANS) best = Math.max(best, jtAgainst(O1, i, h, W));
    return Q.after * best;
  };
  const aheadP = { canter: ahead('canter'), gallop: ahead('gallop') };
  let pick = null;
  for (const i of JT_PLANS) { const now = jtAgainst(O, i, h, W), v = now + aheadP[i.pace]; if (!pick || v > pick.v + 1e-9) pick = { aim: i.aim, pace: i.pace, guard: i.guard, v, now }; }
  let otherNow = -9; for (const i of JT_PLANS) if (i.pace !== pick.pace) otherNow = Math.max(otherNow, jtAgainst(O, i, h, W));
  Object.assign(pick, { otherNow });
  return { aim: pick.aim, guard: pick.guard, pace: pick.pace, why: look ? jtWhy(s, 2, Q, pick, need, safe, them, h) : jtWordWhy(s, pick, h, Q, need, safe) };
}
// the reason, true to what the plan does and why
function jtWhy(s, sk, Q, P, need, safe, them, H) {
  const aim = JT_PLAN.aim[P.aim].n, pace = JT_PLAN.pace[P.pace].n;
  const read = H ? `${H.read ? `reading their riders (${H.n} course${H.n === 1 ? '' : 's'} so far: ` : `against how their rider rides (`}${H.angled > .7 ? 'shields mostly angled' : H.angled < .3 ? 'shields mostly square' : 'either guard'}, ${H.aim.body > .6 ? 'lances at the body' : H.aim.shield > .6 ? 'lances at the shield' : H.aim.helm > .45 ? 'lances at the helm' : 'lances anywhere'})` : '';
  const mixed = sk === 1 ? ` (mixing its plans by the odds, so it can't be read: this one ${Math.round(100 * P.share)}% of the time)` : '';
  let why = Q.tilt ? `the tilt for the crown: ${aim} at ${pace}, the best expected margin over their lance${mixed || (read ? ', ' + read : '')}`
    : need ? `behind by ${-Q.lead} with ${Q.left === 1 ? 'one course' : Q.left + ' courses'} left: ${aim} at ${pace}, riding for the points${mixed}`
    : safe ? `ahead by ${Q.lead}: weighing the points against it double, ${aim} at ${pace}${mixed}`
    : sk === 1 ? `the best odds against any rider: ${aim} at ${pace}${mixed}`
    : `${read}: ${aim} at ${pace} has the best odds`;
  if (sk === 2 && !Q.tilt) {
    if (P.pace === 'canter' && P.otherNow > P.now + 1e-9) why += ', saving the mount\'s wind for the courses left in the heat';
    else if (P.pace === 'gallop' && !Q.after) why += ', with no more courses in the heat to save the wind for';
  }
  return why + (P.guard === 'angled' ? '; the shield angled to turn their lance' : '; the shield square to take it and stay on');
}
// side s's hands, by skill (a lab may ride a side with another skill's hands)
const jtHandsK = s => { const lab = G.lab || {}; return clamp((lab.handsBy && lab.handsBy[s] != null ? lab.handsBy[s] : G.skill[s]) | 0, 0, JT_SKILL.length - 1); };
// (phase 11: a Lich's side, G.lich, rides with its own row, JT_LICH in 15-umbral.js: sharper hands than an Archmage's, and a surer lean)
const jtHands = s => { const lab = G.lab || {}; return G.lich && G.lich[s] && !(lab.handsBy && lab.handsBy[s] != null) ? JT_LICH : JT_SKILL[jtHandsK(s)]; };
// side s's lean into a hit (0 to 1), by skill
const jtLean = s => clamp(jtHands(s).lean + .2 * gauss(), 0, 1);
