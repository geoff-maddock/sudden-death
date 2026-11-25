/* The Tilting Lists: the plan and the read (issue #117, phase 4). The plan is three choices that play off each other
   (04-course.js): an angled shield turns a strike on it into a glance but leaves the body beside it and the helm open;
   a square shield takes the hit and keeps you on; the helm is two points on a small mark, and a lance that misses it
   leaves you reaching; a gallop hits harder and rocks them more, but the tip sways more and the mount tires.
   The herald's card (jtCard): before each course, what the other side's riders have really ridden this match (each
   course's plan and where its lance went, and the counts of each guard, aim and pace), their usual mix (the mix their
   rider would ride by the odds; a Squire's anything) and the read an Archmage takes from both (jtHabitOf).
   The CPU's read by skill: a Squire reads nothing (a plan at random); a Knight rides its mix, which can't be read, and
   reads the score and the heat; an Archmage reads the other side's habits (jtHabitOf) and rides against them, so a
   rider who always rides the same plan is punished more by an Archmage than by a Knight.
   Your squire's word (jtSuggest, 05-cpu.js): the best plan by the odds against the read, and its reason in plain
   words (jtWordWhy): what they have ridden, and what that makes the plan. */

// what side o has ridden this match: the counts of each choice, and its last courses (newest last)
function jtCounts(o) {
  const P = (G && G.plans && G.plans[o]) || [], c = { n: P.length, angled: 0, square: 0, shield: 0, body: 0, helm: 0, canter: 0, gallop: 0 };
  for (const p of P) { c[p.guard]++; c[p.aim]++; c[p.pace]++; }
  return c;
}
/* the herald's card for side s: the other side's riders as side s's corner sees them */
function jtCard(s) {
  if (!G || !G.teams) return null;
  const o = 1 - s, ri = (jtRiders() || [])[o], m = ri != null ? G.teams[o].roster[ri] : null, slot = ri != null ? G.riders[o].indexOf(ri) : -1;
  const sk = clamp(G.skill[o] | 0, 0, 2), usual = jtUsual(o);
  const P = (G.plans[o] || []).slice(-4).map(p => ({ aim: p.aim, guard: p.guard, pace: p.pace, at: p.at, heat: p.heat, course: p.course, tilt: !!p.tilt, n: ri != null && p.ri === ri ? 'this rider' : (G.teams[o].roster[p.ri] || {}).n || '' }));
  const r2 = v => Math.round(v * 100) / 100;
  return { side: o, name: m ? m.n : '', kind: m ? m.kind || '' : '', mount: slot >= 0 ? JT_MOUNT[G.mounts[o][slot]].n : '', skill: JT_SKILL[sk].n, counts: jtCounts(o), last: P,
    usual: { angled: r2(usual.angled), gallop: r2(usual.gallop), aim: Object.fromEntries(JT_AIMS.map(a => [a, r2(usual.aim[a])])) }, read: jtHabitOf(s), text: jtCardText(s) };
}
// how side o's rider usually rides: the mix their rider would ride by the odds (a Squire's anything)
function jtUsual(o) { const sk = clamp(G.skill[o] | 0, 0, 2), mix = sk <= 0 ? null : jtMixOf(o); return mix ? jtMarg(mix) : JT_SQUIRE_HABIT; }
// a real lean, as the card reads one: a guard at .6 or more of the time ('angled' or 'square'; null for either), and an
// aim at least JT_LEAN.aim ahead of the next (null when none is)
const JT_LEAN = { guard: .6, aim: .15 };
const jtGuardLean = a => a >= JT_LEAN.guard ? 'angled' : a <= 1 - JT_LEAN.guard ? 'square' : null;
function jtAimLean(aim) { const A = JT_AIMS.slice().sort((x, y) => aim[y] - aim[x]); return aim[A[0]] - aim[A[1]] >= JT_LEAN.aim ? A[0] : null; }
// the card in the herald's words: one line on their guard, one on their aim, one on their pace
function jtCardText(s) {
  const o = 1 - s, C = jtCounts(o), n = C.n;
  if (!n) return 'Nothing ridden yet this match.';
  const most = (ks, w) => ks.slice().sort((a, b) => C[b] - C[a])[0], top = most(JT_AIMS);
  return `Their shield angled ${C.angled} of ${n}, square ${C.square}. Their lance at the ${top} ${C[top]} of ${n}${JT_AIMS.filter(a => a !== top && C[a]).map(a => `, the ${a} ${C[a]}`).join('')}. At a gallop ${C.gallop} of ${n}.`;
}
const jtTimes = (k, n) => k === n ? (n === 1 ? 'once' : n === 2 ? 'both times' : `all ${n} times`) : `${k} of ${n}`;
/* your squire's reason for plan P (the best by the odds against the read h), in plain words: what they have ridden,
   and what it makes each of your three choices */
function jtWordWhy(s, P, h, Q, need, safe) {
  const o = 1 - s, C = jtCounts(o), n = C.n, read = n > 0;
  // (before anything is ridden, only a real lean in their usual, as the card says it: phase 4's review)
  const U = read ? null : jtUsual(o), g = read ? (C.angled * 2 >= n ? 'angled' : 'square') : jtGuardLean(U.angled), aimL = read ? null : jtAimLean(U.aim);
  const say = [];
  if (!read) say.push(!g && !aimL ? 'nothing to read yet, and their rider has no habit to read' : `nothing to read yet: their rider ${[g ? `usually ${g === 'angled' ? 'angles' : 'squares'} the shield` : '', aimL ? `mostly aims at the ${aimL}` : ''].filter(Boolean).join(' and ')}`);
  // the aim, by their guard (none known: the plain reason)
  if (P.aim === 'body') say.push(g === 'angled' ? `${read ? `they've had the shield angled ${jtTimes(C.angled, n)}, so ` : ''}aim for the body, open beside an angled shield` : 'aim for the body, the surest break');
  else if (P.aim === 'shield') say.push(g === 'square' ? `${read ? `their shield has been square ${jtTimes(C.square, n)}, so ` : ''}aim for the shield: square, it breaks clean` : 'aim for the shield, the biggest mark');
  else say.push(need ? 'you need the points, and the helm is worth two' : g === 'angled' ? `${read ? `they've angled the shield ${jtTimes(C.angled, n)}, ` : ''}which leaves the helm open: go for it` : 'go for the helm');
  // the guard, by their aim
  const shieldAims = read ? C.shield / n : h.aim.shield;
  if (P.guard === 'angled') say.push(shieldAims >= .5 && read ? `they've aimed at your shield ${jtTimes(C.shield, n)}: angle it to turn their lance` : 'angle your shield to turn their lance');
  else say.push(read && C.body + C.helm > C.shield ? `they've gone past your shield ${jtTimes(C.body + C.helm, n)}: keep it square, take the hit and stay on` : 'keep your shield square, take the hit and stay on');
  // the pace
  if (Q.tilt) say.push(`at ${JT_PLAN.pace[P.pace].n}, for the crown`);
  else if (P.pace === 'gallop') say.push(Q.after ? 'gallop to hit harder' : 'gallop: no more courses this heat to save the wind for');
  else say.push(safe ? 'canter: you\'re ahead, keep it steady' : Q.after ? 'canter for a steadier tip, and save the wind' : 'canter for a steadier tip');
  const t = say.join('; ');
  return t[0].toUpperCase() + t.slice(1);
}
