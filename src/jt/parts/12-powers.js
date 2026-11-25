/* The Tilting Lists: monster powers (issue #117, phase 6), as at the Shed, for a joust. A match has them when started
   with { powers: true } (the Realm's matches do; the bare engine, its tests and the labs don't, unless asked; powers:
   [yours, theirs] gives one side only; the tilting yard never). With them off nothing here acts and nothing draws from
   the seeded stream, so a match plays exactly as before.
   - Team mana (G.mana, by side): JT_MANA.start to begin, up to JT_MANA.max. A lance broken fills it, and a seat kept
     after a rocking hit, and a clean course (a lance broken, and theirs didn't break on you). An everyday power costs
     JT_MANA.pow, a curse JT_MANA.curse (a power may name its own cost: a golem's Unmoved costs 3).
   - Everyday powers by role: every kind has a lance power (for your strike, or a curse on the other rider) and a
     shield power (for their strike on you, your seat, or their tip this course), and a second of each (JT_POW,
     JT_POW2). A rider brings one of each pair (m.pw: { lance, shield }, 0 or 1; picked on the Lists tab; a rider who
     brings none, as the CPU's clubs do, brings the pair their name picks, jtPwByName, the same every time). The side
     casts before a course, for mana, and it works on that course. One everyday power a course.
   - Curses (a power's curse): laid on the other rider for the rest of the heat (in the tilt for the crown, the rest of
     the tilt): a slower couch, a mount that tires faster, a tip that sways more, a worse seat. Not on a rider already
     cursed. Between courses a squire can lift it in place of one of their jobs (09-squad.js: the corner's fourth job,
     'lift', offered only while the rider is cursed), as boxing's cut-man washes one.
   - The gallery's cheer (G.cheer, by side, 0 to JT_CHEER.max): a lance broken fills it, a helm break more, an
     unhorsing most, and a rider who stays on after a rocking hit. It pays for the ultimate (JT_CHEER.ult).
   - The ultimate: one per kind (JT_ULT), once a match a side, cast before a course for the cheer. It marks the course
     (G.marks, a side each): one set of effects on its side's rider (own), another on the other's (rival), for that
     course. Both sides' ultimates may mark the same course, so whoever casts first never shuts the other out (phase 6's
     review).
   - Situation powers (JT_SIT), the side's, once a match each, for mana, when the moment fits: The Last Course (behind
     in the match, a heat's last course), Back in the Saddle (the course after keeping your seat from a rocking hit) and
     For the Crown (the tilt for the crown). One a course.
   - Who casts (jtCpuPower, before a course, after both plans are made): the CPU by its skill (a Squire now and then at
     random; a Knight when the course matters, keeping a mana back; an Archmage when behind, late or the moment is big,
     reading where their lances go and saving the cheer for the ultimate); your side the same under Auto powers in
     Manage, or what you press (jtCastMine) in your plan beat. On Play the CPU casts as the riders set off, once your
     plan is committed. Every cast is logged with its reason (G.casts).
   Effects (JT_FX0), read by the model (04-course.js) from a ride's fx (jtFxFor: the side's own power this course, what
   the other side laid on it this course, a curse on it, the course's mark, its situation power):
   - its own ride: sway (the tip's spread), speed (the mount's speed at impact) and wind (what the course costs the
     mount) multiply; late adds to the couch's error (later); nerve (the share of the pressure taken off: 1, none) and
     calm (any shake counts for nothing);
   - its strike: brk (the chance the lance breaks) and rock (how hard a broken lance rocks them) multiply; pierce (a
     strike on an angled shield breaks as on a square one), splinter (a fair touch always breaks), helmUn (a helm break
     unhorses) and drain (a lance broken drinks this much of their cheer);
   - their strike on it: hold adds to its seat; turn (their chance to break) and soak (how hard it rocks you) multiply;
     stay (it can't be unhorsed).
   The plan knows none of them: a power makes a lance truer or a seat firmer, never a different plan. */
const JT_MANA = { start: 2, max: 6, brk: 1, kept: 1, clean: 1, pow: 2, curse: 2 };
const JT_CHEER = { max: 100, ult: 50, brk: 10, helm: 10, unhorse: 30, kept: 15 };
// (phase 7's gear adds kite, a strike on an angled shield's chance to break, and helmTurn, a strike on the helm's)
const JT_FX0 = { sway: 1, speed: 1, wind: 1, late: 0, nerve: 0, calm: 0, brk: 1, rock: 1, pierce: 0, splinter: 0, helmUn: 0, drain: 0, hold: 0, turn: 1, soak: 1, stay: 0, kite: 1, helmTurn: 1 };
const JT_FX_MUL = new Set(['sway', 'speed', 'wind', 'brk', 'rock', 'turn', 'soak', 'kite', 'helmTurn']), JT_FX_ADD = new Set(['late', 'hold']);
const JT_PW_ROLES = ['lance', 'shield'];
// the squire's fourth job, only while their rider is cursed
const JT_LIFT = { n: 'Lift the curse', v: 'lifts the curse' };
// a power: fx on its own rider this course, on (laid on the other rider this course), curse (on the other rider for the
// rest of the heat), cost (when not the usual)
const jtP = (id, n, desc, o) => Object.assign({ id, n, desc, fx: null, on: null, curse: null, cost: null }, o || {});
// everyday powers by kind: [lance, shield]
const JT_POW = {
  goblin: [jtP('barbtip', 'Barbed Tip', 'A barbed tip bites the wood: your lance breaks a fifth more often this course.', { fx: { brk: 1.2 } }),
    jtP('duck', 'Duck and Weave', 'Ducked behind the shield: their lance breaks on you an eighth less often this course.', { fx: { turn: .88 } })],
  kobold: [jtP('firetip', 'Fire-Hardened Tip', 'Hardened in the forge-fire: your lance breaks more often, and rocks them a little harder, this course.', { fx: { brk: 1.16, rock: 1.06 } }),
    jtP('scales', 'Scale Shield', 'A shield of dragon scales: their lance breaks on you an eighth less often this course.', { fx: { turn: .89 } })],
  werewolf: [jtP('mooncharge', 'Moon Charge', 'Run like a wolf under the moon: a faster charge, and a broken lance rocks them harder, this course.', { fx: { speed: 1.05, rock: 1.12 } }),
    jtP('wolfseat', 'Wolf\'s Seat', 'Low and hard in the saddle: a firmer seat this course.', { fx: { hold: .1 } })],
  dwarf: [jtP('forged', 'Forged Lance', 'Dwarf-forged: your lance breaks a fifth more often this course.', { fx: { brk: 1.2 } }),
    jtP('ironshield', 'Iron Shield', 'Iron-faced: their lance breaks on you an eighth less often this course.', { fx: { turn: .88 } })],
  ogre: [jtP('clublance', 'Club Lance', 'A lance like a tree trunk: a broken one rocks them a quarter harder this course.', { fx: { rock: 1.25 } }),
    jtP('gutcheck', 'Gut Check', 'Takes it in the belly and doesn\'t budge: a much firmer seat this course.', { fx: { hold: .13 } })],
  minotaur: [jtP('bullcharge', 'Bull Charge', 'Head down, the bull runs it: the charge costs the mount no wind this course, and comes on a little faster.', { fx: { wind: 0, speed: 1.04 } }),
    jtP('hornsup', 'Horns Up', 'Braced on the horns: a firmer seat this course.', { fx: { hold: .1 } })],
  troll: [jtP('thicklance', 'Troll-Thick Lance', 'A troll\'s lance: a broken one rocks them a fifth harder this course.', { fx: { rock: 1.2 } }),
    jtP('regrow', 'Regrow', 'Troll flesh knits: any shake counts for nothing this course, and a little firmer seat.', { fx: { calm: 1, hold: .05 } })],
  golem: [jtP('stonearm', 'Stone Arm', 'An arm of stone holds the lance still: the tip a fifth steadier this course.', { fx: { sway: .8 } }),
    jtP('unmoved', 'Unmoved', 'Set like stone in the saddle: they can\'t be unhorsed this course.', { fx: { stay: 1 }, cost: 3 })],
  harpy: [jtP('dive', 'Dive', 'Stoops like a hawk: a faster charge, and your lance breaks a little more often, this course.', { fx: { speed: 1.06, brk: 1.08 } }),
    jtP('gust', 'Gust', 'A gust off the wings as they come: it throws their tip about, a third more sway this course.', { on: { sway: 1.3 } })],
  elf: [jtP('truelance', 'True Lance', 'An elf\'s eye down the lance: the tip a quarter steadier this course.', { fx: { sway: .75 } }),
    jtP('glamour', 'Glamour', 'A glamour on the shield: they can\'t settle on it, a quarter more sway on their tip this course.', { on: { sway: 1.25 } })],
  wraith: [jtP('ghostlance', 'Ghost Lance', 'It passes through an angled shield: a strike on one breaks as if the shield were square (a Kite Shield turns it no more), this course.', { fx: { pierce: 1 } }),
    jtP('fade', 'Fade', 'Half there: their lance breaks on you a seventh less often this course.', { fx: { turn: .86 } })],
  vampire: [jtP('thirst', 'Thirsty Lance', 'A lance broken drinks 15 of their gallery\'s cheer, and it breaks a little more often, this course.', { fx: { brk: 1.1, drain: 15 } }),
    jtP('mist', 'Mist', 'Turns to mist at the impact: their lance breaks on you an eighth less often this course.', { fx: { turn: .87 } })],
  lich: [jtP('gravelance', 'Grave Lance', 'Cold iron from the grave: your lance breaks more often, and rocks them harder, this course.', { fx: { brk: 1.14, rock: 1.1 } }),
    jtP('boneward', 'Bone Ward', 'A ward of bone on the shield: their lance breaks on you an eighth less often this course.', { fx: { turn: .88 } })],
  zombie: [jtP('deadarm', 'Dead Arm', 'An arm that feels nothing: the tip a sixth steadier this course.', { fx: { sway: .84 } }),
    jtP('numb', 'Numb', 'Feels nothing: their broken lance rocks you nearly a third softer this course.', { fx: { soak: .7 } })],
  gorgon: [jtP('stare', 'Stare', 'A curse: her stare stiffens their arm, and their couch comes late for the rest of the heat.', { curse: { late: .28 } }),
    jtP('petrify', 'Petrifying Shield', 'A face on the shield they can\'t look at: their lance breaks on you an eighth less often this course.', { fx: { turn: .87 } })],
  spider: [jtP('weblance', 'Web Lance', 'Webbed to the arm: the tip a sixth steadier this course.', { fx: { sway: .84 } }),
    jtP('eightlegs', 'Eight Legs', 'Eight legs grip the saddle: a much firmer seat this course.', { fx: { hold: .14 } })],
  skeleton: [jtP('bonelance', 'Bone Lance', 'A lance of old bone: it breaks more often this course.', { fx: { brk: 1.16 } }),
    jtP('hollow', 'Hollow Ribs', 'A lance through the ribs finds nothing: it breaks on you an eighth less often this course.', { fx: { turn: .88 } })],
  witch: [jtP('hextip', 'Hexed Tip', 'A hex on the tip: it breaks more often, and holds a little steadier, this course.', { fx: { brk: 1.14, sway: .92 } }),
    jtP('ward', 'Ward', 'A witch\'s ward on the shield: their lance breaks on you an eighth less often this course.', { fx: { turn: .88 } })],
};
// the second of each, picked on the Lists tab: [lance, shield]
const JT_POW2 = {
  goblin: [jtP('pebble', 'Pebble in the Hoof', 'A curse: a pebble in their mount\'s hoof, and it tires half again as fast for the rest of the heat.', { curse: { wind: 1.5 } }),
    jtP('grease', 'Greased Shield', 'Their lance slides off a greased shield: it breaks on you less often, and a softer hit, this course.', { fx: { turn: .9, soak: .9 } })],
  kobold: [jtP('smokepot', 'Smoke Pot', 'A curse: smoke in their visor, and their tip sways a sixth more for the rest of the heat.', { curse: { sway: 1.15 } }),
    jtP('tinder', 'Tinder Flash', 'A flash off the shield as they couch: their tip sways a third more this course.', { on: { sway: 1.3 } })],
  werewolf: [jtP('howl', 'Howl', 'A curse: a howl that spooks their mount, and it tires faster for the rest of the heat.', { curse: { wind: 1.4 } }),
    jtP('snarl', 'Snarl', 'A snarl over the shield rim: their tip sways a quarter more this course.', { on: { sway: 1.25 } })],
  dwarf: [jtP('headdown', 'Head Down', 'Head down behind the lance: the tip nearly a fifth steadier this course.', { fx: { sway: .82 } }),
    jtP('lowsaddle', 'Low Saddle', 'Sits low, as dwarves do: a much firmer seat this course.', { fx: { hold: .12 } })],
  ogre: [jtP('bellow', 'Bellow', 'A curse: an ogre\'s bellow rattles them, and they sit worse for the rest of the heat.', { curse: { hold: -.07 } }),
    jtP('barndoor', 'Barn-Door Shield', 'A shield the size of a barn door: their lance breaks on you less often, and a little firmer seat, this course.', { fx: { turn: .9, hold: .05 } })],
  minotaur: [jtP('gore', 'Gore', 'Horns behind the lance: a broken one rocks them harder, and it breaks a little more often, this course.', { fx: { rock: 1.18, brk: 1.06 } }),
    jtP('bullneck', 'Bull Neck', 'A neck like a bull\'s: their broken lance rocks you a quarter softer this course.', { fx: { soak: .75 } })],
  troll: [jtP('stink', 'Troll Stink', 'A curse: their mount can\'t stand the smell, and tires faster for the rest of the heat.', { curse: { wind: 1.4 } }),
    jtP('hide', 'Troll Hide', 'A hide like bark: their broken lance rocks you a quarter softer this course.', { fx: { soak: .75 } })],
  golem: [jtP('granitetip', 'Granite Tip', 'A tip of granite: a broken lance rocks them a fifth harder this course.', { fx: { rock: 1.22 } }),
    jtP('stoneshield', 'Stone Shield', 'A slab for a shield: their lance breaks on you an eighth less often this course.', { fx: { turn: .88 } })],
  harpy: [jtP('screech', 'Screech', 'A curse: a screech that makes them flinch, and their couch comes late for the rest of the heat.', { curse: { late: .18 } }),
    jtP('featherseat', 'Feather Seat', 'Rides the blow like a feather: their broken lance rocks you a fifth softer this course.', { fx: { soak: .8 } })],
  elf: [jtP('elfshot', 'Elf-Shot Tip', 'An elf-shot tip: your lance breaks more often this course.', { fx: { brk: 1.16 } }),
    jtP('lightseat', 'Light Seat', 'Light as a leaf in the saddle: a firmer seat this course.', { fx: { hold: .1 } })],
  wraith: [jtP('chill', 'Chill Touch', 'A curse: a chill in their arm, and their tip sways a sixth more for the rest of the heat.', { curse: { sway: 1.18 } }),
    jtP('coldseat', 'Cold Seat', 'Sits as still as the grave: a firmer seat this course.', { fx: { hold: .1 } })],
  vampire: [jtP('thrall', 'Thrall\'s Gaze', 'A curse: half in thrall, they sit worse for the rest of the heat.', { curse: { hold: -.07 } }),
    jtP('batcloak', 'Bat Cloak', 'A cloak of bats at the impact: their tip sways a third more this course.', { on: { sway: 1.3 } })],
  lich: [jtP('wither', 'Withering', 'A curse: their mount withers, and tires half again as fast for the rest of the heat.', { curse: { wind: 1.5 } }),
    jtP('deadcalm', 'Dead Calm', 'Death has no nerves: no pressure, any shake counts for nothing, and a little firmer seat, this course.', { fx: { calm: 1, nerve: 1, hold: .04 } })],
  zombie: [jtP('rot', 'Rot', 'A curse: the rot gets in their arm, and their couch comes late for the rest of the heat.', { curse: { late: .2 } }),
    jtP('shamble', 'Shamble Seat', 'Slumped in the saddle and hard to shift: a firmer seat this course.', { fx: { hold: .1 } })],
  gorgon: [jtP('serpenttip', 'Serpent Tip', 'A serpent\'s fang for a tip: your lance breaks more often this course.', { fx: { brk: 1.16 } }),
    jtP('mirror', 'Mirror Shield', 'They see themselves in it: their tip sways a third more this course.', { on: { sway: 1.3 } })],
  spider: [jtP('webstirrup', 'Webbed Stirrups', 'A curse: their stirrups webbed, and they sit worse for the rest of the heat.', { curse: { hold: -.07 } }),
    jtP('webshield', 'Web Shield', 'Their lance tangles in a web: it breaks on you an eighth less often this course.', { fx: { turn: .88 } })],
  skeleton: [jtP('rattle', 'Rattle', 'A curse: their teeth rattle, and their tip sways a sixth more for the rest of the heat.', { curse: { sway: 1.15 } }),
    jtP('loosebones', 'Loose Bones', 'The bones give and come back: their broken lance rocks you nearly a third softer this course.', { fx: { soak: .7 } })],
  witch: [jtP('evileye', 'Evil Eye', 'A curse: the evil eye on their mount, and it tires faster for the rest of the heat.', { curse: { wind: 1.4 } }),
    jtP('hex', 'Hex', 'A hex on their lance: its tip sways a third more this course.', { on: { sway: 1.3 } })],
};
// the ultimate by kind: a mark on the course (own: its side's rider; rival: the other's)
const jtU = (id, n, desc, own, rival) => ({ id, n, desc, own: own || null, rival: rival || null });
const JT_ULT = {
  goblin: jtU('goblinmob', 'Mob of Squires', 'A mob of goblin squires runs beside the mount, shouting: a faster charge, a lance that breaks more, and hands to hold you on, this course.', { speed: 1.06, brk: 1.2, hold: .06 }),
  kobold: jtU('firestorm', 'Firestorm', 'Kobold fires all down the barrier: their tip sways a third more this course.', null, { sway: 1.35 }),
  werewolf: jtU('fullmoon', 'Full Moon', 'Under the full moon: a faster charge, a broken lance rocks them a quarter harder, and a firmer seat, this course.', { speed: 1.08, rock: 1.25, hold: .08 }),
  dwarf: jtU('mountainhall', 'Mountain Hall', 'Rooted like a mountain: their lance breaks on you a fifth less often, and a much firmer seat, this course.', { turn: .8, hold: .14 }),
  ogre: jtU('splinterlance', 'Splintering Lance', 'A lance made to shatter: it breaks on any fair touch this course.', { splinter: 1 }),
  minotaur: jtU('stampede', 'Stampede', 'The herd runs: the charge costs no wind, comes on faster, and a broken lance rocks them a quarter harder, this course.', { wind: 0, speed: 1.1, rock: 1.25 }),
  troll: jtU('trollbridge', 'Troll Bridge', 'Planted like a troll under a bridge: they can\'t be unhorsed, and their lance rocks you a quarter softer, this course.', { stay: 1, soak: .75 }),
  golem: jtU('monolith', 'Monolith', 'Set like a standing stone: they can\'t be unhorsed, a much firmer seat, and a steadier tip, this course.', { stay: 1, hold: .12, sway: .85 }),
  harpy: jtU('stormwing', 'Storm Wing', 'She owns the air over the lists: their tip sways half again as much this course.', null, { sway: 1.5 }),
  elf: jtU('feylance', 'Fey Lance', 'The lance knows its mark: the tip two fifths steadier this course.', { sway: .6 }),
  wraith: jtU('haunting', 'Haunting', 'The lists are haunted: your lance passes through an angled shield (a Kite Shield turns it no more), and their tip sways a quarter more, this course.', { pierce: 1 }, { sway: 1.25 }),
  vampire: jtU('eternalnight', 'Eternal Night', 'Night falls on the lists: your lance breaks more often, and they sit worse, this course.', { brk: 1.22 }, { hold: -.1 }),
  lich: jtU('gravecharge', 'Grave Charge', 'The dead don\'t fall: they can\'t be unhorsed, and a lance broken on the helm unhorses, this course.', { stay: 1, helmUn: 1 }),
  zombie: jtU('undying', 'Undying', 'The dead don\'t fall: they can\'t be unhorsed, and any shake counts for nothing, this course.', { stay: 1, calm: 1 }),
  gorgon: jtU('medusa', 'Medusa', 'Her gaze turns their arm to stone: their couch comes very late this course.', null, { late: .45 }),
  spider: jtU('greatweb', 'Great Web', 'Webs across the lists: you sit firmer, and they sit much worse, this course.', { hold: .1 }, { hold: -.12 }),
  skeleton: jtU('bonestorm', 'Bone Storm', 'Bones in the air: their tip sways a third more, and their lance breaks on you less often, this course.', { turn: .9 }, { sway: 1.35 }),
  witch: jtU('coven', 'Coven', 'Thirteen witches at the rail: your lance breaks more often, and their tip sways a quarter more, this course.', { brk: 1.2 }, { sway: 1.25 }),
};
// situation powers: the side's, once a match each, for mana
const JT_SIT = {
  last: { id: 'last', n: 'The Last Course', cost: 1, desc: 'Behind in the match, in a heat\'s last course: no pressure on your rider, and the tip a fifth steadier.', fx: { nerve: 1, sway: .8 } },
  saddle: { id: 'saddle', n: 'Back in the Saddle', cost: 1, desc: 'The course after keeping your seat from a rocking hit: the shake counts for nothing, and a firmer seat.', fx: { calm: 1, hold: .1 } },
  crown: { id: 'crown', n: 'For the Crown', cost: 1, desc: 'In the tilt for the crown: no pressure on your rider, and your lance breaks more often.', fx: { nerve: 1, brk: 1.2 } },
};
// the CPU's chances, a Squire's (it casts on a whim), each course a moment fits or a power is affordable
const JT_POWK = { pow: .3, ult: .5, sit: .5 };
const JT_W6 = { start: jtStart, snapshot: jtSnapshot, resume: jtResume, summary: jtSummary, card: jtCard };

/* ---------- the picks ---------- */
// a rider's pick by their name, for a rider who brings none (the CPU's clubs): the same every time
function jtPwByName(n) { let h = 7; for (const ch of String(n || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return { lance: h & 1, shield: (h >> 1) & 1 }; }
const jtPwOf = m => m && m.pw && typeof m.pw === 'object' ? { lance: m.pw.lance === 1 ? 1 : 0, shield: m.pw.shield === 1 ? 1 : 0 } : jtPwByName(m && m.n);
// a kind's power for a role ('lance' or 'shield'), the first or the second (alt)
function jtPowOf(kind, role, alt) { const T = alt ? JT_POW2 : JT_POW, k = jtOwn(T, kind) ? kind : 'goblin'; return T[k][role === 'shield' ? 1 : 0]; }
const jtPowCost = P => P.cost || (P.curse ? JT_MANA.curse : JT_MANA.pow);
const jtRiderOf = (s, ri) => G.teams[s].roster[ri == null ? (jtRiders() || [])[s] : ri] || null;
// the everyday power side s's rider (or rider ri) brings for a role, with its cost
function jtPowNow(s, role, ri) {
  const m = jtRiderOf(s, ri); if (!m || !G.powers) return null;
  const r = role === 'shield' ? 'shield' : 'lance', P = jtPowOf(m.kind, r, jtPwOf(m)[r] === 1);
  return Object.assign({ role: r }, P, { cost: jtPowCost(P) });
}
function jtUltOf(s, ri) { const m = jtRiderOf(s, ri); return JT_ULT[m && jtOwn(JT_ULT, m.kind) ? m.kind : 'goblin']; }
const jtCursed = s => !!(G && G.powers && G.curse && G.curse[s]);

/* ---------- a match's powers ---------- */
function jtPowersStart(o) {
  const on = !o.yard && (Array.isArray(o.powers) ? o.powers.some(Boolean) : !!o.powers);
  if (!on) return;
  Object.assign(G, { powers: true, powSides: Array.isArray(o.powers) ? [0, 1].map(s => !!o.powers[s]) : [true, true], mana: [JT_MANA.start, JT_MANA.start], cheer: [0, 0],
    pfx: [null, null], ofx: [null, null], curse: [null, null], marks: [null, null], ultUsed: [false, false], sitUsed: [{}, {}], sitOn: [null, null], powCourse: [-1, -1], saddle: [false, false], casts: [],
    powOnly: Array.isArray(o.powOnly) ? [0, 1].map(s => typeof o.powOnly[s] === 'string' ? o.powOnly[s] : null) : null });
}
jtStart = function (opts) { const g = JT_W6.start(opts); jtPowersStart(opts || {}); return g; };
// what side s's rider has on this course: its own power, what the other side laid on it, a curse, the mark, a situation power
function jtFxFor(s) {
  const f = Object.assign({}, JT_FX0);
  if (!G || !G.powers) return f;
  const add = x => { if (!x) return; for (const k in x) { if (!jtOwn(JT_FX0, k)) continue; if (JT_FX_MUL.has(k)) f[k] *= x[k]; else if (JT_FX_ADD.has(k)) f[k] += x[k]; else f[k] = Math.max(f[k], x[k]); } };
  add(G.pfx[s]); add(G.ofx[s]); add(G.curse[s] && G.curse[s].fx);
  for (const M of G.marks || []) if (M && M.at === G.n) add(M.side === s ? M.own : M.rival);
  if (G.sitOn[s] && jtOwn(JT_SIT, G.sitOn[s])) add(JT_SIT[G.sitOn[s]].fx);
  return f;
}
// what side s's rider rides with this course, for the model: the powers' fx, or null without them (phase 7 adds gear and
// potions)
function jtRideFx(s) { return G && G.powers ? jtFxFor(s) : null; }
const jtPowIdOf = (s, k) => k === 'lance' || k === 'shield' ? (jtPowNow(s, k) || {}).id : k === 'ult' ? jtUltOf(s).id : k;
// '' when side s's moment fits situation power k, or why not
function jtSitMoment(s, k) {
  if (k === 'last') return !jtInTilt() && G.course === G.courses - 1 && jtTotal(s) < jtTotal(1 - s) ? '' : 'Only behind in the match, in a heat\'s last course.';
  if (k === 'saddle') return G.saddle[s] ? '' : 'Only the course after keeping your seat from a rocking hit.';
  if (k === 'crown') return jtInTilt() ? '' : 'Only in the tilt for the crown.';
  return 'No such power.';
}
const jtSitFits = (s, k) => !!(G && G.powers && G.powSides[s] && !G.over && jtOwn(JT_SIT, k) && !G.sitUsed[s][k] && !jtSitMoment(s, k));
// why side s can't cast k now ('lance', 'shield', 'ult' or a situation power), or ''
function jtPowWhy(s, k) {
  if (!G || !G.teams || !G.powers || !G.powSides[s]) return 'No powers in this match.';
  if (G.over) return 'The match is over.';
  if (!jtRiders()) return 'No course to ride.';
  if (G.powOnly && G.powOnly[s] && jtPowIdOf(s, k) !== G.powOnly[s]) return 'Not in this match.';
  if (k === 'lance' || k === 'shield') {
    const P = jtPowNow(s, k);
    if (G.powCourse[s] === G.n) return 'One power a course.';
    if (P.curse && G.curse[1 - s]) return 'They are cursed already.';
    return G.mana[s] < P.cost ? `It costs ${P.cost} mana.` : '';
  }
  if (k === 'ult') { if (G.ultUsed[s]) return 'Once a match.'; return G.cheer[s] < JT_CHEER.ult ? `It takes ${JT_CHEER.ult} cheer.` : ''; }
  if (!jtOwn(JT_SIT, k)) return 'No such power.';
  if (G.sitUsed[s][k]) return 'Once a match.';
  if (G.sitOn[s]) return 'One a course.';
  const m = jtSitMoment(s, k); if (m) return m;
  return G.mana[s] < JT_SIT[k].cost ? `It costs ${JT_SIT[k].cost} mana.` : '';
}
/* side s casts k before the course; why: the reason, for the log. Returns '' or why not */
function jtCast(s, k, why) {
  const w = jtPowWhy(s, k); if (w) return w;
  const ri = jtRiders()[s], name = jtName(s, ri), o = 1 - s;
  const rec = (id, n) => G.casts.push({ side: s, k, id, n, ri, heat: G.heat, course: G.course, tilt: jtInTilt(), at: G.n, why: why || '' });
  if (k === 'lance' || k === 'shield') {
    const P = jtPowNow(s, k); G.mana[s] -= P.cost; G.powCourse[s] = G.n;
    if (P.fx) G.pfx[s] = Object.assign({}, P.fx);
    if (P.on) G.ofx[o] = Object.assign({}, P.on);
    if (P.curse) G.curse[o] = { id: P.id, n: P.n, fx: Object.assign({}, P.curse), by: name, side: s, heat: G.heat };
    rec(P.id, P.n); return '';
  }
  if (k === 'ult') {
    const U = jtUltOf(s); G.cheer[s] -= JT_CHEER.ult; G.ultUsed[s] = true;
    G.marks = G.marks || [null, null]; G.marks[s] = { side: s, at: G.n, id: U.id, n: U.n, own: U.own, rival: U.rival, by: name };
    rec(U.id, U.n); return '';
  }
  const S = JT_SIT[k]; G.mana[s] -= S.cost; G.sitUsed[s][k] = true; G.sitOn[s] = k;
  rec(k, S.n); return '';
}
// after the course (06-game.js, before the course is counted): the mana and the cheer it earned, what was spent on it
// goes, the mark ends, Back in the Saddle's moment, and a heat's end lifts its curses
function jtPowersAfter(rides, imp, rule) {
  if (!G.powers) return;
  const mana = (k, n) => { G.mana[k] = Math.min(JT_MANA.max, G.mana[k] + n); }, cheer = (k, n) => { G.cheer[k] = clamp(G.cheer[k] + n, 0, JT_CHEER.max); };
  const ends = !!(rule.heatOver || rule.tiltNow || rule.over);
  for (const s of [0, 1]) {
    const o = 1 - s, st = imp.st[s], se = imp.seat[s], fx = rides[s].fx;
    if (st.broke) { mana(s, JT_MANA.brk); cheer(s, JT_CHEER.brk + (st.zone === 'helm' ? JT_CHEER.helm : 0)); if (!imp.st[o].broke) mana(s, JT_MANA.clean); }
    if (imp.res[s].unhorse) cheer(s, JT_CHEER.unhorse);
    if (se.rocked && !se.unhorse) { mana(s, JT_MANA.kept); cheer(s, JT_CHEER.kept); }
    if (st.broke && fx && fx.drain) { const d = Math.min(G.cheer[o], fx.drain); G.cheer[o] -= d; cheer(s, d); }
    G.saddle[s] = !ends && se.rocked && !se.unhorse;
  }
  G.pfx = [null, null]; G.ofx = [null, null]; G.sitOn = [null, null];
  G.marks = (G.marks || [null, null]).map(M => M && M.at > G.n ? M : null);
  if (ends) G.curse = [null, null];
}
// a situation power's moment, in words, for the log
function jtSitNow(s, k) {
  if (k === 'last') return `behind by ${jtTotal(1 - s) - jtTotal(s)} in the heat's last course`;
  if (k === 'saddle') return 'back in the saddle after that rocking hit';
  return 'the tilt for the crown';
}
/* the CPU's powers before a course (and yours under Auto powers in Manage), by skill, on the plan it has made. Returns
   the casts' names, or [] */
function jtCpuPower(s, plan) {
  if (!G || !G.powers || !G.powSides[s] || G.over || !jtRiders()) return [];
  const sk = clamp(G.skill[s] | 0, 0, 2), Q = jtSituation(s), out = [], late = Q.tilt || G.heat === JT_RULES.heats - 1;
  const go = (k, why) => { if (!jtCast(s, k, why)) out.push(G.casts[G.casts.length - 1].n); };
  // a situation power that fits (a Squire now and then)
  for (const k of Object.keys(JT_SIT)) if (!jtPowWhy(s, k) && (sk >= 1 || R() < JT_POWK.sit)) go(k, jtSitNow(s, k));
  // the ultimate: a Squire on a whim; a Knight when behind or level, or late; an Archmage saves it for the course that counts
  if (!jtPowWhy(s, 'ult')) {
    const want = sk === 0 ? R() < JT_POWK.ult : sk === 1 ? Q.lead <= 0 || late : Q.tilt || Q.lastOfMatch || (late && (Q.lead <= 0 || G.course >= G.courses - 2));
    if (want) go('ult', Q.tilt ? 'the tilt for the crown' : Q.lastOfMatch ? 'the last course of the match' : Q.lead < 0 ? `behind by ${-Q.lead}, with the gallery up` : late ? 'the second heat, with the gallery up' : 'the gallery is up');
  }
  const P = jtCpuPick(s, sk, Q, plan); if (P) go(P.k, P.why);
  return out;
}
// which everyday power the CPU casts now, and why (null: none)
function jtCpuPick(s, sk, Q, plan) {
  const ok = k => !jtPowWhy(s, k);
  if (sk === 0) { if (R() >= JT_POWK.pow) return null; const k = R() < .5 ? 'lance' : 'shield'; return ok(k) ? { k, why: 'on a whim' } : null; }
  const L = jtPowNow(s, 'lance'), S = jtPowNow(s, 'shield'), left = jtLeft(), keep = sk === 1 ? 1 : 0;
  const can = k => ok(k) && G.mana[s] >= jtPowNow(s, k).cost + keep;
  const big = Q.last || Q.tilt || Q.lastOfMatch;
  // a curse is worth most early in a heat: it lasts the heat
  if (L.curse && can('lance') && (Q.tilt || left >= 2)) return { k: 'lance', why: Q.tilt ? `${L.n} for the tilt` : `${L.n} with ${left} courses left in the heat, so it bites for longer` };
  // a Knight casts when the course matters (behind or level, the course that counts) or the mana is near full
  if (sk === 1 && !(big || Q.lead <= 0 || G.mana[s] >= JT_MANA.max - 1)) return null;
  const X = jtRideX(s), rs = jtRsOf(s, jtRiders()[s]), shaky = X.shaken > .1 || (rs.seat ?? .5) < .4;
  // an Archmage reads where their lances go: at the helm, it guards
  const h = sk >= 2 ? jtHabitOf(s) : null, helmy = !!h && h.aim.helm >= .4;
  let k = Q.lead >= 2 || shaky || helmy ? 'shield' : 'lance';
  // (a curse on a rider with too little heat left, or one already cursed, is wasted: the shield's instead)
  if (k === 'lance' && (L.curse || !can('lance'))) k = 'shield';
  if (!can(k)) return null;
  const why = k === 'shield' ? (Q.lead >= 2 ? `ahead by ${Q.lead}: ${S.n}, to keep it` : shaky ? `${S.n}: the rider is shaky in the saddle` : helmy ? `their lances go at the helm: ${S.n}` : `${S.n}, for the course that counts`)
    : Q.lead < 0 ? `behind by ${-Q.lead}: ${L.n}, for the points` : big ? `${L.n}, for the course that counts` : `level: ${L.n}`;
  return { k, why };
}
// on Play, as the riders set off: the CPU casts for its side (and your squire for yours, under Auto powers in Manage).
// Returns what was cast, in words ('' for nothing)
function jtPowersAtCharge(plans) {
  if (!G.powers) return '';
  const say = [];
  for (const s of [0, 1]) {
    const cpu = !jtCalls(s) && !(GP.mode === 'manage' && s === GP.you), auto = GP.mode === 'manage' && s === GP.you && GP.autoPow;
    if (!cpu && !auto) continue;
    const n = jtCpuPower(s, plans[s]); if (n.length) say.push(`${s === GP.you && auto ? 'Your squire casts' : `${jtSide(s)} cast`} ${n.join(' and ')}.`);
  }
  return say.length ? say.join(' ') + ' ' : '';
}
/* yours, pressed in your plan beat (k: 'lance', 'shield', 'ult' or a situation power; 'sit': the one that fits).
   Returns '' or why not */
function jtCastMine(k) {
  if (!GP || !G || !G.powers) return 'No powers in this match.';
  if (GP.ph !== 'plan' || !jtCalls(GP.you)) return 'Only before your course, in your plan.';
  if (k === 'sit') { k = Object.keys(JT_SIT).find(x => jtSitFits(GP.you, x)); if (!k) return 'No situation power fits this course.'; }
  const why = jtCast(GP.you, k, 'your call'); if (!why) { const c = G.casts[G.casts.length - 1]; GP.msg = `You cast ${c.n}.`; jtPicked(); }
  return why;
}
// your squire's tip for your plan beat ('' when nothing stands out)
function jtPowerTip(s) {
  if (!G || !G.powers || !G.powSides[s] || G.over) return '';
  const k = Object.keys(JT_SIT).find(x => !jtPowWhy(s, x)); if (k) return `Tip: ${JT_SIT[k].n} fits this course: ${JT_SIT[k].desc}`;
  if (jtCursed(s)) return `Tip: the ${G.curse[s].n} is on your rider; a squire can lift it between courses.`;
  if (!jtPowWhy(s, 'ult')) return `Tip: the gallery is up; ${jtUltOf(s).n} would mark this course.`;
  const L = jtPowNow(s, 'lance'); if (L && L.curse && !jtPowWhy(s, 'lance') && jtLeft() >= 2) return `Tip: ${L.n} now lasts the rest of the heat.`;
  return '';
}

/* ---------- kept, summed up, and on the card ---------- */
jtSnapshot = function () { const sn = JT_W6.snapshot(); if (sn) sn.autoPow = !!(GP && GP.autoPow); return sn; };
jtResume = function (sn) { const g = JT_W6.resume(sn); if (g && GP) GP.autoPow = !!(sn && sn.autoPow); return g; };
jtSummary = function () {
  const S = JT_W6.summary(); if (!S || !G.powers) return S;
  S.powers = JSON.parse(JSON.stringify({ casts: G.casts, mana: G.mana, cheer: G.cheer, ultUsed: G.ultUsed, sitUsed: G.sitUsed }));
  return S;
};
// the herald's card: the rider you're about to meet brings these powers, and any curse on them or on yours
jtCard = function (s) {
  const K = JT_W6.card(s); if (!K || !G.powers) return K;
  const o = 1 - s, ri = (jtRiders() || [])[o], P = r => { const x = ri == null ? null : jtPowNow(o, r, ri); return x ? { id: x.id, n: x.n, desc: x.desc, cost: x.cost, curse: !!x.curse } : null; };
  const U = ri == null ? null : jtUltOf(o, ri), cu = x => x ? { n: x.n, by: x.by, fx: Object.assign({}, x.fx) } : null;
  K.pow = { lance: P('lance'), shield: P('shield'), ult: U ? { id: U.id, n: U.n, desc: U.desc, used: !!G.ultUsed[o] } : null, mana: G.mana[o], cheer: G.cheer[o] };
  K.curse = { theirs: cu(G.curse[o]), yours: cu(G.curse[s]) };
  return K;
};

/* ---------- drawing ---------- */
// the course's mark and each rider's curse, under the board
function jtPowersDraw(c) {
  if (!G || !G.powers || G.yard) return;
  const L = GP && GP.last, after = GP && (GP.ph === 'after' || GP.ph === 'over');
  const Ms = (G.marks || []).filter(M => M && M.at === G.n), lines = [];
  for (const M of Ms) lines.push({ t: `✦ ${M.n} marks this course (${G.teams[M.side].short || G.teams[M.side].name})`, col: '#ffe08a' });
  if (Ms.length) { /* the marks above */ } else if (after && L && Array.isArray(G.casts)) { const u = G.casts.find(x => x.k === 'ult' && x.at === G.n - 1); if (u) lines.push({ t: `✦ ${u.n} marked that course`, col: '#ffe08a' }); }
  for (const s of [0, 1]) if (G.curse[s]) lines.push({ t: `☾ ${G.curse[s].n} on ${G.teams[s].short || G.teams[s].name}'s rider (to the end of the heat)`, col: '#d4b8ff' });
  if (!lines.length) return;
  c.save(); c.font = '700 12px "Alegreya Sans", sans-serif';
  const w = Math.max(...lines.map(l => c.measureText(l.t).width)) + 20, h = 6 + lines.length * 16;
  c.fillStyle = 'rgba(24,10,40,.72)'; rr(c, 10, 76, w, h, 6); c.fill();
  lines.forEach((l, i) => txt(c, l.t, 20, 90 + i * 16, '700 12px "Alegreya Sans", sans-serif', l.col));
  c.restore();
}
