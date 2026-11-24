/* ================= Gear a player wears, and potions between half-innings (the Realm, issue #115) ================= */
// Nothing here acts in the standalone game: it sends no gear on its players and no bags, and its club lockers (Magic
// gear, above) are untouched. The Realm's side is src/realm/w140-diamondkit.js.
// Gear: one piece a player, sent on the player itself: gear (its name) and gx (what it does, plain data):
//   bat: a GEAR id. The wearer's own ⚒ batting stance, as a club's magic bat is, with its uses a game (they come back
//        every game, kept on the player as p.kit = { id, uses } so a snapshot keeps them)
//   ball: a GEAR id. The wearer's own ⚒ pitch when they pitch, the same way
//   reach (feet more on their catch, in the field) and bob (× their bobble chance): a glove
//   ctrl (× the scatter of every pitch they throw): a rosin bag
// A rating a piece adds (its fx.r) is laid on the player by the Realm before the engine sees them.
// Potions (BD_POTIONS): a side may give one at each break between half-innings, from the last out of a half to the
// first pitch of the next (G.kit.open). G.kit.bags = [bag or null] by side: a null bag is kept by the page (the Realm
// keeps yours and takes each one out as you give it), a bag here ({ id: n }) is the CPU's, given at its skill when the
// break starts (kitCpuPotion). Every use goes in G.kit.pots ({ side, id, inning, half, why }) and the play-by-play (⚗).
const BD_POTIONS = {
  draught: { n: 'Stamina Draught', sta: .4, desc: 'Your pitcher gets two fifths of their stamina back.' },
  bdtonic: { n: 'Brimstone Tonic', mana: 2, desc: 'Two mana for your side, now (up to six).' },
  bdeye: { n: 'Owl-Eye Drops', r: 1.2, desc: 'Your batters\' swing circle a fifth bigger, the next time you bat (the whole half).' },
  bdsteady: { n: 'Steadyhand Balm', ctrl: .8, desc: 'Your pitcher\'s scatter a fifth tighter, the next time you take the field (the whole half).' },
};
// a CPU gives a potion worth at least this much (by skill: a Squire now and then, whatever comes first)
const BD_KIT = { take: [99, 2.5, 2, 1.8], squire: .3 };
const kitPitcherOf = s => G.teams[s].def.roster.find(p => p.pos === 'P');
const kitKey = () => G.inning * 2 + G.half;
const kitGx = p => (p && p.gx) || {};
function kitNew(bags) {
  return { bags: [0, 1].map(s => bags && bags[s] ? Object.assign({}, bags[s]) : null), pots: [], open: true, key: 0, used: [-1, -1], eye: [false, false], steady: [false, false] };
}
// a bat's or a ball's uses for the game, on the player who wears it
function kitArm(p) { const g = kitGx(p), id = g.bat || g.ball; p.kit = id && GEAR[id] ? { id, uses: GEAR[id].uses } : null; }
function kitStart(opts) {
  G.kit = kitNew(opts && opts.bags);
  for (const t of G.teams) for (const p of [...t.def.roster, ...t.pen]) kitArm(p);
}

/* ---------- gear ---------- */
// the wearer's own stance and pitch (a club's locker, when the rule has one, comes first)
function kitStance(p) {
  const it = p && p.kit, g = it && GEAR[it.id]; if (!g || g.type !== 'bat' || it.uses <= 0) return null;
  return { k: 'gear', gear: it.id, it, kit: true, name: `⚒ ${g.name} ×${it.uses}` };
}
function kitPitch(p) {
  const it = p && p.kit, g = it && GEAR[it.id]; if (!g || g.type !== 'ball' || it.uses <= 0) return null; const b = PITCHES[g.base];
  return { ...b, k: 'gear:' + it.id, name: `⚒ ${g.name} ×${it.uses}`, cost: 0, magic: false, ult: false, fx: g.fx || b.fx, gear: it.id, it, kit: true };
}
const kitGearStance0 = gearStance, kitGearPitch0 = gearPitch;
gearStance = function (team, p) { return kitGearStance0(team) || kitStance(p); };
gearPitch = function (team, p) { return kitGearPitch0(team) || kitPitch(p); };
// a glove: more reach, fewer bobbles
const kitReach = p => kitGx(p).reach || 0;
const kitBob = p => kitGx(p).bob || 1;
// Owl-Eye Drops on the side at bat: the swing circle, on screen and when it swings
const kitEye = () => G.kit && G.kit.eye[G.half] ? BD_POTIONS.bdeye.r : 1;
const kitGearReach0 = gearReach, kitGearSwing0 = gearSwing;
gearReach = function (k) { const o = kitGearReach0(k); return { ...o, r: o.r * kitEye() }; };
gearSwing = function (pc) { const o = kitGearSwing0(pc); return { ...o, r: o.r * kitEye() }; };
// at the release: the break is over, and a rosin bag and the Steadyhand Balm tighten the pitch
const kitOnRelease0 = gearOnRelease;
gearOnRelease = function (pc, pd, st, ctrl) {
  ctrl = kitOnRelease0(pc, pd, st, ctrl);
  let m = kitGx(pitcher()).ctrl || 1;
  if (G.kit) { G.kit.open = false; if (G.kit.steady[1 - G.half]) m *= BD_POTIONS.bdsteady.ctrl; }
  // (what gear and the balm did to this pitch's scatter, on the pitch: plain data)
  if (m !== 1) pc.kitCtrl = +m.toFixed(4);
  return ctrl * m;
};

/* ---------- potions ---------- */
// why side s can't give potion id now ('' when it can)
function kitWhy(s, id) {
  const P = BD_POTIONS[id]; if (!P) return 'No such potion.';
  if (!G.kit || !gameOn()) return 'There is no game on.';
  const K = G.kit, T = G.teams[s], pt = kitPitcherOf(s);
  if (!K.open) return 'Only between half-innings: from the last out until the first pitch of the next half.';
  if (K.used[s] === K.key) return 'One potion a break.';
  if (id === 'draught' && fatigue(pt) > .9) return `${shortName(pt)} is fresh.`;
  if (id === 'bdtonic' && T.mana >= 6) return 'Your mana is full.';
  if (id === 'bdeye' && K.eye[s]) return 'Your batters have the drops in already.';
  if (id === 'bdsteady' && K.steady[s]) return 'Your pitcher has the balm on already.';
  return '';
}
function kitGive(s, id, why) {
  const P = BD_POTIONS[id], T = G.teams[s], K = G.kit, pt = kitPitcherOf(s);
  if (id === 'draught') { pt.stam = Math.min(pt.maxStam, pt.stam + pt.maxStam * P.sta); if (fatigue(pt) >= .5) pt.warned = 0; }
  if (id === 'bdtonic') T.mana = Math.min(6, T.mana + P.mana);
  if (id === 'bdeye') K.eye[s] = true;
  if (id === 'bdsteady') K.steady[s] = true;
  if (K.bags[s]) { K.bags[s][id]--; if (K.bags[s][id] <= 0) delete K.bags[s][id]; }
  K.used[s] = K.key;
  K.pots.push({ side: s, id, inning: G.inning, half: G.half, why: why || '' });
  logLine(`⚗ ${T.def.short || T.def.name}: ${P.n}${why ? ` (${why})` : ''}.`);
  addFx('callout', { text: P.n, col: '#a8e6a0', small: true });
  return '';
}
/* what each potion in bag would be worth to side s at this break: [{ id, v, why }], best first. A draught when their
   pitcher is tiring; the tonic when mana is low; the drops when they bat next and the bats matter (late and close, or
   behind); the balm when they take the field and a run matters (late and close, or ahead) */
function kitValues(s, bag) {
  const out = [], T = G.teams[s], bats = G.half === s, pt = kitPitcherOf(s), fat = fatigue(pt);
  const late = G.inning >= G.innings - 1, d = T.R - G.teams[1 - s].R, close = Math.abs(d) <= 2;
  if (bag.draught && fat < .6) out.push({ id: 'draught', v: (.7 - fat) * 8 + (bats ? 0 : 1), why: `${shortName(pt)} is down to ${Math.round(fat * 100)}% of their stamina` });
  if (bag.bdtonic && T.mana <= 2) out.push({ id: 'bdtonic', v: 2 + (3 - T.mana) * .5 + (late && close ? .5 : 0), why: `only ${T.mana} mana` });
  if (bag.bdeye && bats) out.push({ id: 'bdeye', v: 1.8 + (late && close ? 1 : 0) + (d < 0 ? .6 : 0), why: late && close ? 'late in a close game, at bat' : d < 0 ? `behind by ${-d}, at bat` : 'at bat' });
  if (bag.bdsteady && !bats) out.push({ id: 'bdsteady', v: 1.8 + (late && close ? 1 : 0) + (d > 0 ? .6 : 0), why: late && close ? 'late in a close game, in the field' : d > 0 ? `ahead by ${d}, in the field` : 'in the field' });
  return out.filter(o => !kitWhy(s, o.id)).sort((a, b) => b.v - a.v);
}
// a CPU's bag at the break, by its skill. Never yours: your bag is your own (a null bag here)
function kitCpuPotion(s) {
  const bag = G.kit && G.kit.bags[s]; if (!bag || !Object.keys(bag).length) return '';
  const vals = kitValues(s, bag); if (!vals.length) return '';
  const sk = dOf(G.teams[s]);
  if (!sk) return R() < BD_KIT.squire ? kitGive(s, vals[0].id, vals[0].why) || vals[0].id : '';
  return vals[0].v >= BD_KIT.take[Math.min(sk, 3)] ? kitGive(s, vals[0].id, vals[0].why) || vals[0].id : '';
}
// a new half: what the last one was for is spent (the drops on the side that batted, the balm on the side that
// fielded), the break opens, and each CPU with a bag may give
function kitHalf() {
  const K = G.kit; if (!K) return;
  if (K.key) { K.eye[1 - G.half] = false; K.steady[G.half] = false; }
  K.open = true; K.key = kitKey();
  for (const s of [0, 1]) kitCpuPotion(s);
}
const kitStartHalf0 = startHalf;
startHalf = function () { const r = kitStartHalf0.apply(this, arguments); kitHalf(); return r; };
// the page's side (yours): your potion now, '' when given (the page takes it out of your bag), or why not
const kitYou = () => G.teams ? G.teams.findIndex(t => t.ctl !== 'cpu') : -1;
function kitPotion(id) {
  const s = kitYou(); if (s < 0) return 'Nobody here is yours.';
  const why = kitWhy(s, id); if (why) return why;
  return kitGive(s, id);
}
// what your coach would give from bag now: { id, why } or null (your coach says; they never give it)
function kitAdvice(bag) { const s = kitYou(); if (s < 0 || !G.kit || !G.kit.open) return null; const o = kitValues(s, bag || {})[0]; return o && o.v >= BD_KIT.take[1] ? { id: o.id, why: o.why } : null; }

/* ---------- saved with the game ---------- */
const kitSnap0 = snapGame;
snapGame = function () { const sn = kitSnap0.apply(this, arguments); if (sn && G.kit) sn.kit = JSON.parse(JSON.stringify(G.kit)); return sn; };
const kitResume0 = resumeSnap;
resumeSnap = function (sn) {
  // (a game saved before potions came in resumes mid-half: the break is shut until the next one opens)
  G.kit = sn && sn.kit ? JSON.parse(JSON.stringify(sn.kit)) : Object.assign(kitNew(sn && sn.opts && sn.opts.bags), { open: false });
  const r = kitResume0.apply(this, arguments);
  // (a game saved before gear came in: its bats and balls are armed now)
  for (const t of G.teams) for (const p of [...t.def.roster, ...t.pen, ...t.used]) if (p.kit === undefined) kitArm(p);
  return r;
};
