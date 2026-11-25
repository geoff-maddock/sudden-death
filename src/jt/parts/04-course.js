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
   strikes on it into glances; the helm is the smallest mark, and its curve turns a lance more often than the body
   does) with a chance that grows with the
   force (speed and mount, a clean couch) and falls toward the zone's edge and with the defender's shield rating; it
   doesn't break, it glances. A strike's rock is how hard it hits the other rider (JT_ROCK).
   The seat (jtSeat): a rider rocked by a broken lance leans against it. Their hold (JT_SEAT: the seat rating, the
   ride rating (a rider who drives a mount hard sits its hit as well: the speed a good ride gives and the seat to take
   the other's grow together; phase 12's follow-up), a square guard taking the hit, a steady mount, the lean) against the
   rock, shaken a little: short of it, they are unhorsed. A rider whose tip went high (at the head: JT_SEAT.high inches up or more) and didn't break has reached
   past the head, and sits the other lance worse (JT_SEAT.reach off the hold): a strike at the helm scores big but its
   misses cost, whatever the plan said (a hand that drags a shield plan onto the helm pays it too: phase 2's review);
   a lance never couched (a ride's up) points high but reaches for nothing, but one couched and let go (lowered, with
   reachY, the height its tip had) reaches as far as it went. On Play the lean is your balance moment (0 to 1); the CPU's comes from its skill (05-cpu.js). Only a
   broken lance can unhorse: a glance rocks, no more. */
const JT_SWAY = { base: 3.6, lance: .35, wind: .5, late: .9, early: .35, droop: 7 };
const JT_BREAK = { shield: { square: .9, angled: .45 }, body: { square: .95, angled: .95 }, helm: { square: .7, angled: .8 }, edge: .25, shieldR: .2, force: .3 };
const JT_ROCK = { shield: { square: .8, angled: .6 }, body: 1, helm: 1.15, glance: .3 };
const JT_SEAT = { reach: .3, high: 15, base: .55, seat: .45, ride: .35, square: .1, lean: .3, shake: .22, rocked: .7 };
const jtGauss = rnd => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// the tip's spread at impact (inches, one sigma) and its droop (inches down), from the pace, the mount and its wind,
// the lance and couch ratings and the couch's moment; hands scales the spread (a skill's, or 1 on Play)
// (phase 3: a tired arm (o.arm, 0 to 1) sways more and sags; a rider still shaken by a rocking hit (o.shaken, 0 to 1)
// sways more; pressure (o.press) sways them more by how little nerve they have: JT_ARM, JT_SHAKE and jtNerveK, 09-squad.js)
function jtSway(o) {
  const P = jtPace(o.pace), M = jtMount(o.mount), r = o.rs || {}, w = clamp(o.wind ?? 1, 0, 1), c = clamp(o.couch || 0, -1, 1);
  const lance = 1 + JT_SWAY.lance * (.5 - (r.lance ?? .5)) * 2, arm = 1.2 - .6 * (r.couch ?? .5), tired = 1 - clamp(o.arm ?? 1, 0, 1);
  const sigma = JT_SWAY.base * P.sway * M.sway * lance * (1 + JT_SWAY.wind * (1 - w)) * (1 + JT_SWAY.late * Math.max(0, c) + JT_SWAY.early * Math.max(0, -c)) * (o.hands ?? 1)
    * (1 + JT_ARM.sway * tired) * (1 + JT_SHAKE.sway * clamp(o.shaken || 0, 0, 1)) * jtNerveK(o.press || 0, r.nerve) * (o.fx ? o.fx.sway : 1);
  return { sigma, droop: JT_SWAY.droop * Math.max(0, -c) * arm * (1 + JT_ARM.droop * tired) + JT_ARM.sag * tired };
}
// the speed at impact: the pace, the mount, its wind (a blown mount slows) and the ride rating
function jtSpeed(o) {
  const P = jtPace(o.pace), M = jtMount(o.mount), r = o.rs || {}, w = clamp(o.wind ?? 1, 0, 1);
  return JT_LISTS.speed * P.speed * M.speed * (.8 + .2 * w) * (1 + .08 * ((r.ride ?? .5) - .5)) * (o.fx ? o.fx.speed : 1);
}
// the mount's wind a course spends at this pace (a good rider spends less)
// (and the mount: a heavy Charger blows sooner, a Courser runs on less; phase 3)
const jtWindCost = (pace, rs, mount) => jtPace(pace).wind * (1.15 - .3 * ((rs || {}).ride ?? .5)) * (mount == null ? 1 : jtMount(mount).wind ?? 1);

/* a CPU or sim rider's ride: o = { plan: { aim, guard, pace }, rs, mount, wind, hands: { aim, couch } (the skill's);
   phase 3: arm, shaken, press (the sway and, under pressure, the couch's timing), girth (the seat) } */
function jtCharge(o, rnd) {
  const p = o.plan || {}, plan = { aim: jtPick('aim', p.aim, 'shield'), guard: jtPick('guard', p.guard, 'square'), pace: jtPick('pace', p.pace, 'canter') };
  const H = o.hands || { aim: 1, couch: .3 }, rs = o.rs || {}, mount = jtOwn(JT_MOUNT, o.mount) ? o.mount : JT_MOUNT_DEF, x = { arm: o.arm, shaken: o.shaken, press: o.press };
  const fx = o.fx || null, speed = jtSpeed({ pace: plan.pace, mount, rs, wind: o.wind, fx }) * (1 + .03 * jtGauss(rnd));
  // (phase 6: a power's fx: a curse's late couch, its sway, its speed; the ride carries it to the strike and the seat)
  const couch = clamp(jtGauss(rnd) * H.couch * (1.3 - .6 * (rs.couch ?? .5)) * jtNerveK(o.press || 0, rs.nerve) + (fx ? fx.late : 0), -1, 1);
  const sw = jtSway(Object.assign({ pace: plan.pace, mount, rs, wind: o.wind, couch, hands: H.aim, fx }, x)), A = JT_PLAN.aim[plan.aim];
  const ride = { aim: plan.aim, guard: plan.guard, pace: plan.pace, mount, rs, speed, couch, tip: { x: A.x + jtGauss(rnd) * sw.sigma, y: A.y + jtGauss(rnd) * sw.sigma - sw.droop },
    girth: +o.girth || 0, shaken: clamp(+o.shaken || 0, 0, 1) };
  if (fx) ride.fx = fx;
  return ride;
}
// the force of a ride's strike: its speed against a gallop's, the mount's weight, and a clean couch (0.5 to 1.3 or so)
const jtForce = a => (a.speed / JT_LISTS.speed) * jtMount(a.mount).hit * (1 - .25 * Math.abs(a.couch || 0));

/* ride a's strike on rider d: { zone, at (for the rules: a zone, 'glance' or 'miss'), broke, force, rock, pb, high (the tip
   at the head, for the reach) } */
function jtStrike(a, d, rnd) {
  const g = d.guard === 'angled' ? 'angled' : 'square', zone = jtZoneAt(a.tip.x, a.tip.y, g), force = jtForce(a);
  // (a lance never couched points high but reaches for nothing: it costs the strike, not the seat; phase 3's review. A
  // lance couched and let go keeps the reach of where its tip was, or of its aim: phase 4's review)
  const high = a.up ? !!a.lowered && (a.reachY ?? (JT_PLAN.aim[jtPick('aim', a.aim, 'shield')].y)) >= JT_SEAT.high : a.tip.y >= JT_SEAT.high;
  if (!JT_RULES.fair.includes(zone)) return { zone, at: zone, broke: false, force, rock: 0, pb: 0, high };
  // (phase 6: a power's fx on the striker, fa, and the defender, fd: pierce breaks an angled shield as a square one,
  // brk and turn the chance (a Kite Shield's kite only on an angled shield the lance doesn't pass through: phase 7's
  // review), splinter any fair touch, rock and soak the rock, helmUn a helm break that unhorses)
  const fa = a.fx || null, fd = d.fx || null, gb = fa && fa.pierce && zone === 'shield' ? 'square' : g;
  const base = JT_BREAK[zone][gb], edge = jtEdge(zone, a.tip.x, a.tip.y, g);
  const shieldK = zone === 'shield' ? 1 + JT_BREAK.shieldR * (.5 - ((d.rs || {}).shield ?? .5)) * 2 : 1;
  let pb = clamp(base * (1 - JT_BREAK.force + JT_BREAK.force * Math.min(1.2, force)) * (1 - JT_BREAK.edge * edge) * shieldK * (fa ? fa.brk : 1) * (fd ? fd.turn : 1)
    * (fd && zone === 'shield' && gb === 'angled' ? fd.kite ?? 1 : 1) * (fd && zone === 'helm' ? fd.helmTurn ?? 1 : 1), 0, .98);
  if (fa && fa.splinter) pb = .98;
  const broke = rnd() < pb;
  const rock = force * (broke ? (zone === 'shield' ? JT_ROCK.shield[g] : JT_ROCK[zone]) : JT_ROCK.glance) * (fa ? fa.rock : 1) * (fd ? fd.soak : 1);
  const out = { zone, at: broke ? zone : 'glance', broke, force, rock, pb, high };
  if (fa && fa.helmUn && broke && zone === 'helm') out.helmUn = true;
  return out;
}
/* rider d's seat against a strike st: lean is their balance (0 to 1); own is d's own strike this course (a rider who
   struck high (own.high; with no tip known, a helm aim) and didn't break has reached past the head and sits the hit
   worse: JT_SEAT.reach off the hold).
   { unhorse, rocked, hold, margin, reach } */
function jtSeat(st, d, lean, rnd, own) {
  const r = d.rs || {}, M = jtMount(d.mount), reach = !!own && !own.broke && (own.high != null ? !!own.high : d.aim === 'helm');
  // (phase 3: a girth tightened between courses holds them on; a rider still shaken from a rocking hit sits worse)
  // (phase 12's follow-up: the ride rating holds them on too, from an average ride's 0.5, so two average riders are as before)
  const hold = JT_SEAT.base + JT_SEAT.seat * (r.seat ?? .5) + JT_SEAT.ride * ((r.ride ?? .5) - .5) + (d.guard === 'angled' ? 0 : JT_SEAT.square) + M.steady + JT_SEAT.lean * clamp(lean ?? .5, 0, 1) - (reach ? JT_SEAT.reach : 0)
    + clamp(+d.girth || 0, 0, .2) - JT_SHAKE.seat * clamp(+d.shaken || 0, 0, 1) + (d.fx ? d.fx.hold : 0);
  const hit = st.rock * (1 + JT_SEAT.shake * jtGauss(rnd)), margin = hold - hit;
  // (phase 6: a rider who can't be unhorsed this course (stay) isn't; a lance broken on the helm under a Grave Charge unhorses)
  return { unhorse: !!st.broke && (margin < 0 || !!st.helmUn) && !(d.fx && d.fx.stay), rocked: !!st.broke && st.rock >= JT_SEAT.rocked, hold, margin, reach };
}
/* a course on the model: rides [a0, a1] and leans [l0, l1] (each side's balance if rocked). Returns { res (for the
   rules: [{ at, unhorse }, ...]), st: [the strikes], seat: [each side's seat, against the other's strike] } */
function jtImpact(rides, leans, rnd) {
  const st = [jtStrike(rides[0], rides[1], rnd), jtStrike(rides[1], rides[0], rnd)];
  const seat = [jtSeat(st[1], rides[0], leans[0], rnd, st[0]), jtSeat(st[0], rides[1], leans[1], rnd, st[1])];
  return { res: [0, 1].map(s => ({ at: st[s].at, unhorse: seat[1 - s].unhorse })), st, seat };
}
