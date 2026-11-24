/* The Tilting Lists: the course model (issue #117, phase 1). Pure: no game state is read or written, and every
   random number comes from rnd, the function passed in (the engine's seeded R in a game), so Play (phase 2), the CPU
   and the sim all ride the same model.

   A rider's ride is the numbers a course turns on: { aim, guard, pace, speed, couch, tip: { x, y }, rs, mount }.
   - speed: yards a second at impact (the pace, the mount, the mount's wind, the ride rating);
   - couch: when the lance came down, as an error from the right moment, -1 (far too early) to 1 (far too late). Too
     early and the arm tires: the tip droops (jtSway's droop) and wanders. Too late and the aim never settles;
   - tip: where the lance tip is at impact, in the target's inches (03-lists.js), the aim point plus the sway's miss.
   On Play these come from your hands: the spur's rhythm gives the speed, the couch its moment, and the tip is where
   you held it as the stride threw it about. The CPU and the sim draw them (jtCharge) from the ratings, the mount and
   their skill's hands, with jtSway's spread.
   The impact (jtStrike): the tip lands in a zone of the other rider (jtZoneAt, by their guard). A foul or a miss is
   that. On the shield, the body or the helm the lance breaks (JT_BREAK, by zone and guard: an angled shield turns most
   strikes on it into glances; the helm is the hardest mark and breaks surest) with a chance that grows with the
   force (speed and mount, a clean couch) and falls toward the zone's edge and with the defender's shield rating; it
   doesn't break, it glances. A strike's rock is how hard it hits the other rider (JT_ROCK).
   The seat (jtSeat): a rider rocked by a broken lance leans against it. Their hold (JT_SEAT: the seat rating, a
   square guard taking the hit, a steady mount, the lean) against the rock, shaken a little: short of it, they are
   unhorsed. On Play the lean is your balance moment (0 to 1); the CPU's comes from its skill (05-cpu.js). Only a
   broken lance can unhorse: a glance rocks, no more. */
const JT_SWAY = { base: 3.6, lance: .55, wind: .5, late: .9, early: .35, droop: 7 };
const JT_BREAK = { shield: { square: .9, angled: .45 }, body: { square: .88, angled: .88 }, helm: { square: .92, angled: .95 }, edge: .25, shieldR: .2, force: .3 };
const JT_ROCK = { shield: { square: .8, angled: .6 }, body: 1, helm: 1.3, glance: .3 };
const JT_SEAT = { base: .59, seat: .45, square: .1, lean: .3, shake: .22, rocked: .7 };
const jtGauss = rnd => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// the tip's spread at impact (inches, one sigma) and its droop (inches down), from the pace, the mount and its wind,
// the lance and couch ratings and the couch's moment; hands scales the spread (a skill's, or 1 on Play)
function jtSway(o) {
  const P = jtPace(o.pace), M = jtMount(o.mount), r = o.rs || {}, w = clamp(o.wind ?? 1, 0, 1), c = clamp(o.couch || 0, -1, 1);
  const lance = 1 + JT_SWAY.lance * (.5 - (r.lance ?? .5)) * 2, arm = 1.2 - .6 * (r.couch ?? .5);
  const sigma = JT_SWAY.base * P.sway * M.sway * lance * (1 + JT_SWAY.wind * (1 - w)) * (1 + JT_SWAY.late * Math.max(0, c) + JT_SWAY.early * Math.max(0, -c)) * (o.hands ?? 1);
  return { sigma, droop: JT_SWAY.droop * Math.max(0, -c) * arm };
}
// the speed at impact: the pace, the mount, its wind (a blown mount slows) and the ride rating
function jtSpeed(o) {
  const P = jtPace(o.pace), M = jtMount(o.mount), r = o.rs || {}, w = clamp(o.wind ?? 1, 0, 1);
  return JT_LISTS.speed * P.speed * M.speed * (.8 + .2 * w) * (1 + .08 * ((r.ride ?? .5) - .5));
}
// the mount's wind a course spends at this pace (a good rider spends less)
const jtWindCost = (pace, rs) => jtPace(pace).wind * (1.15 - .3 * ((rs || {}).ride ?? .5));

/* a CPU or sim rider's ride: o = { plan: { aim, guard, pace }, rs, mount, wind, hands: { aim, couch } (the skill's) } */
function jtCharge(o, rnd) {
  const p = o.plan || {}, plan = { aim: jtPick('aim', p.aim, 'shield'), guard: jtPick('guard', p.guard, 'square'), pace: jtPick('pace', p.pace, 'canter') };
  const H = o.hands || { aim: 1, couch: .3 }, rs = o.rs || {}, mount = jtOwn(JT_MOUNT, o.mount) ? o.mount : JT_MOUNT_DEF;
  const speed = jtSpeed({ pace: plan.pace, mount, rs, wind: o.wind }) * (1 + .03 * jtGauss(rnd));
  const couch = clamp(jtGauss(rnd) * H.couch * (1.3 - .6 * (rs.couch ?? .5)), -1, 1);
  const sw = jtSway({ pace: plan.pace, mount, rs, wind: o.wind, couch, hands: H.aim }), A = JT_PLAN.aim[plan.aim];
  return { aim: plan.aim, guard: plan.guard, pace: plan.pace, mount, rs, speed, couch, tip: { x: A.x + jtGauss(rnd) * sw.sigma, y: A.y + jtGauss(rnd) * sw.sigma - sw.droop } };
}
// the force of a ride's strike: its speed against a gallop's, the mount's weight, and a clean couch (0.5 to 1.3 or so)
const jtForce = a => (a.speed / JT_LISTS.speed) * jtMount(a.mount).hit * (1 - .25 * Math.abs(a.couch || 0));

/* ride a's strike on rider d: { zone, at (for the rules: a zone, 'glance' or 'miss'), broke, force, rock, pb } */
function jtStrike(a, d, rnd) {
  const g = d.guard === 'angled' ? 'angled' : 'square', zone = jtZoneAt(a.tip.x, a.tip.y, g), force = jtForce(a);
  if (!JT_RULES.fair.includes(zone)) return { zone, at: zone, broke: false, force, rock: 0, pb: 0 };
  const base = JT_BREAK[zone][g], edge = jtEdge(zone, a.tip.x, a.tip.y, g);
  const shieldK = zone === 'shield' ? 1 + JT_BREAK.shieldR * (.5 - ((d.rs || {}).shield ?? .5)) * 2 : 1;
  const pb = clamp(base * (1 - JT_BREAK.force + JT_BREAK.force * Math.min(1.2, force)) * (1 - JT_BREAK.edge * edge) * shieldK, 0, .98), broke = rnd() < pb;
  const rock = force * (broke ? (zone === 'shield' ? JT_ROCK.shield[g] : JT_ROCK[zone]) : JT_ROCK.glance);
  return { zone, at: broke ? zone : 'glance', broke, force, rock, pb };
}
/* rider d's seat against a strike st: lean is their balance (0 to 1). { unhorse, rocked, hold, margin } */
function jtSeat(st, d, lean, rnd) {
  const r = d.rs || {}, M = jtMount(d.mount);
  const hold = JT_SEAT.base + JT_SEAT.seat * (r.seat ?? .5) + (d.guard === 'angled' ? 0 : JT_SEAT.square) + M.steady + JT_SEAT.lean * clamp(lean ?? .5, 0, 1);
  const hit = st.rock * (1 + JT_SEAT.shake * jtGauss(rnd)), margin = hold - hit;
  return { unhorse: !!st.broke && margin < 0, rocked: !!st.broke && st.rock >= JT_SEAT.rocked, hold, margin };
}
/* a course on the model: rides [a0, a1] and leans [l0, l1] (each side's balance if rocked). Returns { res (for the
   rules: [{ at, unhorse }, ...]), st: [the strikes], seat: [each side's seat, against the other's strike] } */
function jtImpact(rides, leans, rnd) {
  const st = [jtStrike(rides[0], rides[1], rnd), jtStrike(rides[1], rides[0], rnd)];
  const seat = [jtSeat(st[1], rides[0], leans[0], rnd), jtSeat(st[0], rides[1], leans[1], rnd)];
  return { res: [0, 1].map(s => ({ at: st[s].at, unhorse: seat[1 - s].unhorse })), st, seat };
}
