/* The Tilting Lists: the lists, the mounts, the plan and the riders' ratings (issue #117, phase 1).

   The lists (JT_LISTS): a sand yard JT_LISTS.yards long with the tilt (the barrier) down the middle. The riders start
   at opposite ends and pass left side to left side, so each meets the other halfway: a charge is half the yard.
   Speed is in yards a second (a canter about 8, a gallop about 12; the mount scales it).
   The target (JT_ZONE), as the oncoming lance tip sees the other rider at the moment of impact: inches across (x,
   + to the rider's right, away from the shield) and up (y) from the middle of the chest. The shield hangs on the left;
   the helm is small and high; the body is the part of the torso the shield leaves open. The guard moves the shield:
   - square: the shield faces the lance and covers more of the torso (a strike on it is likely to break, but the rider
     takes it and stays on);
   - angled: the shield is turned edge-on to deflect (a strike on it mostly glances), it covers less of the torso,
     and the head is out from behind it (the helm is a bigger mark: 4.6 inches round against 3.2 behind a square one).
   Below the torso is below the belt (a foul, 'low'); lower again, the mount's neck (a foul, 'mount'); low and across
   to the left, the barrier (a foul, 'barrier'); anywhere else, a miss.
   The plan (JT_PLAN): an aim (shield, body or helm, each with its aim point), a guard (angled or square) and a pace
   (canter or gallop). A gallop hits harder and spends more of the mount's wind, but the tip sways more.
   The mounts (JT_MOUNT): Charger (fast, hits hard, sways more, and its weight carries its rider through a hit),
   Destrier (steady, easy to aim, hits softer), Courser (light: it hits softest and sways under an ordinary rider, but
   settles under a good one (ridden, the ride rating), gets its wind back quickly and is easy on it at a gallop). Each rider rides one
   (opts.mounts, picked on the Lists tab in the Realm); left out, JT_MOUNT_DEF.
   The ratings (JT_STATS, 1 to 12, worked on as 0 to 1): lance (the sway), couch (the couch window, and how long the
   arm holds it), seat (the balance after a hit), shield (a strike on the shield breaks less), ride (pace, the seat a little, and the
   mount's wind), nerve (the pressure: the last course of a heat when behind, the tilt for the crown), care (a squire's
   jobs between courses). A row of seven by kind (JT_KIND, phase 3); a rider of no kind is JT_KIND._ . A roster
   member may carry its own (r, 1 to 12, the rest from its kind; or rs, 0 to 1), as the Realm sends. */
const JT_LISTS = { yards: 60, speed: 12 };
const JT_STATS = ['lance', 'couch', 'seat', 'shield', 'ride', 'nerve', 'care'];
// by kind: lance, couch, seat, shield, ride, nerve, care. An elf's lance barely sways; a golem sits like a rock and
// rides like one; a minotaur charges hard and has no patience for a horse's hooves; a harpy is light in the saddle; a
// gorgon reads where a lance is going; a spider squires with eight hands, a kobold fusses over every buckle and a
// witch has a salve for everything; a lich and a zombie feel nothing when it matters
const JT_KIND = { _: [6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5],
  goblin: [6, 6, 5, 6, 8, 5, 8], kobold: [6, 7, 5, 6, 6, 5, 10], werewolf: [6, 6, 8, 6, 10, 7, 5], dwarf: [7, 7, 9, 9, 4, 8, 7],
  ogre: [4, 5, 10, 5, 6, 7, 4], minotaur: [5, 6, 8, 5, 12, 7, 3], troll: [4, 5, 10, 6, 6, 7, 6], golem: [6, 5, 12, 9, 3, 10, 3],
  harpy: [8, 8, 3, 7, 9, 5, 6], elf: [11, 9, 5, 7, 8, 7, 6], wraith: [8, 9, 6, 8, 6, 9, 5], vampire: [8, 8, 7, 7, 7, 8, 6],
  lich: [8, 8, 6, 8, 5, 11, 6], zombie: [5, 4, 9, 5, 5, 10, 5], gorgon: [7, 8, 7, 10, 6, 8, 6], spider: [7, 6, 8, 6, 6, 6, 12],
  skeleton: [7, 7, 4, 7, 6, 9, 7], witch: [7, 7, 5, 7, 6, 7, 10] };
const JT_RCAP = 12;
const jtScale = v => clamp((v - 1) / (JT_RCAP - 1), 0, 1.2);
// a kind's ratings, 1 to 12, and as the model reads them (0 to 1)
function jtRate(kind) { const k = jtOwn(JT_KIND, kind) ? JT_KIND[kind] : JT_KIND._; return Object.fromEntries(JT_STATS.map((s, i) => [s, k[i]])); }
function jtRs(kind) { const r = jtRate(kind); return Object.fromEntries(JT_STATS.map(s => [s, jtScale(r[s])])); }

const JT_PLAN = {
  aim: { shield: { n: 'the shield', x: -4, y: 4 }, body: { n: 'the body', x: 6.5, y: 2 }, helm: { n: 'the helm', x: 0, y: 20 } },
  guard: { angled: { n: 'angled' }, square: { n: 'square' } },
  pace: { canter: { n: 'a canter', speed: .68, sway: 1, wind: .12 }, gallop: { n: 'a gallop', speed: 1, sway: 1.35, wind: .3 } }
};
// (phase 12's lab: as first set, a Charger (hit 1.08, steady 0) and a Courser (steady 0) left their riders unhorsed in 85
// to 96% of matches against 37% on Destriers. A Charger and a Courser now steady the seat a little, and the
// Charger hits a little softer (1.02) and sways a little less (1.2). Each is still the best pick somewhere.
// Phase 12's follow-up: a four with a steady lance on a Charger (an elf: seat 5) still saw an unhorsing in 72% of its
// matches, where fours without one saw 11 to 42%: a Charger's broken lance at a gallop threw its rider 29% of the time
// against a Destrier's 16%, and the CPU gallops on it in 93% of courses. A Charger's weight now carries its own rider
// through a hit (steady 0.06 to 0.2), and the ride rating sits a hit too (JT_SEAT.ride, 04-course.js): 42%, its case for
// an elf in a short heat kept)
// #120, phase 4: each mount the clear pick somewhere, on paired seeds at six seed bases (realm_lists_mounts, _destrier,
// _courser). The Courser was the safe pick almost everywhere (it never blows), so the Destrier had no case of its own and
// the Courser's was thin. A Courser is now light in a rider's hands: it sways more (0.97 to 1.1) under an ordinary
// rider and less under a good one (ridden: the ride rating takes up to 0.28 of its sway, from an average ride's 0.5; a
// ride of 12 sways 0.79, a troll's 6 1.11), and it hits softer (0.93 to 0.9). So a steady lance does best on a Charger,
// a lance that sways on a Destrier, and a hard rider on a Courser, more so in a long heat. The Charger and the Destrier
// are as they were (plain Knights on Destriers play exactly as before)
const JT_MOUNT = {
  charger: { n: 'Charger', speed: 1.06, hit: 1.02, sway: 1.2, steady: .2, rec: .12, wind: 1.3 },
  destrier: { n: 'Destrier', speed: .95, hit: .95, sway: .82, steady: .07, rec: .12, wind: 1 },
  courser: { n: 'Courser', speed: 1.02, hit: .9, sway: 1.1, ridden: .28, steady: .06, rec: .3, wind: .65 }
};
const JT_MOUNT_DEF = 'destrier';
const jtMount = id => JT_MOUNT[jtOwn(JT_MOUNT, id) ? id : JT_MOUNT_DEF];
// a plan's choice, or the default when it isn't one of the table's own (aim, guard, pace)
const jtPick = (kind, k, def) => jtOwn(JT_PLAN[kind], k) ? k : def;
const jtPace = p => JT_PLAN.pace[jtPick('pace', p, 'canter')];

// the target, by the defender's guard: the shield and the torso as boxes, the helm as a circle
const JT_ZONE = {
  torso: { x0: -8, x1: 10, y0: -10, y1: 14 },
  shield: { square: { x0: -11, x1: 3, y0: -6, y1: 14 }, angled: { x0: -11, x1: -.5, y0: -4, y1: 12 } },
  helm: { x: 0, y: 20, square: 3.2, angled: 4.6 },
  low: -22, barrier: { x: -15, y: -6 }, mount: 15
};
const jtIn = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
// where a tip at (x, y) lands on a rider holding guard: shield, body, helm, low, mount, barrier or miss
function jtZoneAt(x, y, guard) {
  const Z = JT_ZONE, g = guard === 'angled' ? 'angled' : 'square';
  if (Math.hypot(x - Z.helm.x, y - Z.helm.y) <= Z.helm[g]) return 'helm';
  if (jtIn(Z.shield[g], x, y)) return 'shield';
  if (jtIn(Z.torso, x, y)) return 'body';
  if (x <= Z.barrier.x && y <= Z.barrier.y) return 'barrier';
  if (y < Z.torso.y0 && y >= Z.low && Math.abs(x) <= Z.torso.x1 + 2) return 'low';
  if (y < Z.low && Math.abs(x) <= Z.mount) return 'mount';
  return 'miss';
}
// how near the edge of its zone a tip is: 0 in the middle, 1 on the edge (a strike near the edge glances more)
function jtEdge(zone, x, y, guard) {
  const Z = JT_ZONE, g = guard === 'angled' ? 'angled' : 'square';
  if (zone === 'helm') return clamp(Math.hypot(x - Z.helm.x, y - Z.helm.y) / Z.helm[g], 0, 1);
  const b = zone === 'shield' ? Z.shield[g] : zone === 'body' ? { x0: g === 'angled' ? Z.shield.angled.x1 : Z.shield.square.x1, x1: Z.torso.x1, y0: Z.torso.y0, y1: Z.torso.y1 } : null;
  if (!b) return 1;
  const ex = Math.abs(x - (b.x0 + b.x1) / 2) / ((b.x1 - b.x0) / 2), ey = Math.abs(y - (b.y0 + b.y1) / 2) / ((b.y1 - b.y0) / 2);
  return clamp(Math.max(ex, ey), 0, 1);
}
