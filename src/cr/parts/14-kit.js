/* The Curling Shed: gear and potions (issue #102, phase 7), by #61's conventions; the Realm's side is w127-shedkit.js.
   Gear: a curler may wear one piece. A roster curler sent with { gear: { id, name, fx } } keeps its name (gear) and the
   effects the engine reads (gx: fx without r; fx.r is laid on the ratings by the Realm before the engine sees them).
   What gx may hold: err (their release's miss, line and weight, ×), wt (the weight's miss alone, ×), press (how much a
   big moment weighs on them, ×) and legs (what sweeping costs their legs when they sweep, ×: the side's legs pay the
   mean of its two sweepers').
   Potions (CR_POTIONS): one a side an end (G.potEnd), before a stone of that side's. G.bags = [bag or null, ...] by
   side: a null bag is kept by the page (the Realm keeps yours and takes each one out as you give it), and a bag here
   ({ id: n }) is the CPU's, given at its skill before its stones (crCpuPotion). Every use goes in G.pots ({ side, id,
   end, why }). What each does, all plain data in G:
   draught (the Stamina Draught): the side's sweepers CR_POTIONS.draught.legs of their legs back; crwarm (a Warming
   Draught): no pressure on the side's next stone (G.still); crsalt (Frost Salt): salt on the other rink's line, so
   their next stone drags heavy (G.salt, as a curse); crpebble (Hennock's Pebble): Hennock pebbles the sheet, and the
   worn ice is fresh again (for both rinks). */
const CR_POTIONS = {
  draught: { n: 'Stamina Draught', legs: .4, desc: 'Your sweepers get two fifths of their legs back.' },
  crwarm: { n: 'Warming Draught', desc: 'For the skip\'s stones in the last end: the next one has no pressure on it, whatever rides on it.' },
  crsalt: { n: 'Frost Salt', heavy: 1.03, desc: 'Salt on the other rink\'s line: their next stone this end drags heavy, and comes up short.' },
  crpebble: { n: 'Hennock\'s Pebble', desc: 'Hennock pebbles the sheet: the worn ice is fresh again, for both rinks.' },
};
// a CPU gives a potion worth this much (by skill: a Squire, now and then, whatever comes first)
const CR_KIT = { take: [99, 2.5, 2], squire: .25 };
function crGx(fx) { if (!fx) return null; const o = JSON.parse(JSON.stringify(fx)); delete o.r; return Object.keys(o).length ? o : null; }
const crGxOf = (s, ri) => (G && G.teams && G.teams[s].roster[ri] && G.teams[s].roster[ri].gx) || {};
function crKitStart(bags) {
  G.bags = [0, 1].map(s => bags && bags[s] ? Object.assign({}, bags[s]) : null);
  G.pots = []; G.potEnd = [-1, -1]; G.still = [false, false]; G.salt = [false, false];
}
// the kit's part in side s's curler ri's miss: { ang, v } multipliers (gear's err and wt)
function crKitErr(s, ri) { const g = crGxOf(s, ri), e = g.err || 1; return { ang: e, v: e * (g.wt || 1) }; }
// how a big moment weighs on them (a Warming Draught takes it away; gear lightens it)
const crKitPress = (s, ri) => (G.still && G.still[s] ? 0 : 1) * (crGxOf(s, ri).press || 1);
// what sweeping costs side s's legs, by its sweepers' gear (the mean of the two)
function crKitLegs(s) { const sw = crSweepers(s); return sw.length ? sw.reduce((a, ri) => a + (crGxOf(s, ri).legs || 1), 0) / sw.length : 1; }
// how worn the sheet is: the share of the pebble worn past a little
const crIceWorn = () => G.ice.filter(v => v < 1 - (1 - CR_ICE.min) * .3).length / G.ice.length;
function crPotionWhy(s, id) {
  const P = CR_POTIONS[id]; if (!P) return 'No such potion.';
  if (!G || G.over) return 'The game is over.';
  if (crUp() !== s) return 'Not your stone.';
  if (G.potEnd[s] === G.end) return 'One potion an end.';
  if (id === 'draught' && (G.legs ? G.legs[s] : 1) >= .95) return 'Their legs are fresh.';
  if (id === 'crwarm' && G.still[s]) return 'Already warm.';
  if (id === 'crwarm' && !crPressure(s)) return 'Only for the skip, in the last end.';
  if (id === 'crsalt' && G.salt[1 - s]) return 'Their line is salted already.';
  if (id === 'crsalt' && G.k >= crPerEnd() - 1) return 'They have no stone left this end.';
  if (id === 'crpebble' && !crIceWorn()) return 'The ice is fresh.';
  return '';
}
function crPotionGive(s, id, why) {
  const P = CR_POTIONS[id], T = G.teams[s];
  if (id === 'draught' && G.legs) G.legs[s] = Math.min(1, +(G.legs[s] + P.legs).toFixed(3));
  if (id === 'crwarm') G.still[s] = true;
  if (id === 'crsalt') G.salt[1 - s] = true;
  if (id === 'crpebble') { G.ice = crIceNew(); G.iceEnd = G.ice.slice(); }
  if (G.bags[s]) { G.bags[s][id]--; if (G.bags[s][id] <= 0) delete G.bags[s][id]; }
  G.potEnd[s] = G.end;
  G.pots.push({ side: s, id, end: G.end + 1, why: why || '' });
  return `${T.name}: ${P.n}${why ? ` (${why})` : ''}.`;
}
// your potion now: '' when given (the page takes it out of your bag), or why not
function crPotion(id) {
  if (!GP) return 'No game.';
  // (before the swing: not with the meter going)
  const s = GP.you; if (GP.ph !== 'aim') return 'Only before your stone, before the swing.';
  const why = crPotionWhy(s, id); if (why) return why;
  GP.msg = crPotionGive(s, id);
  // (fresh ice runs differently: your skip's aim is worked out again on it)
  // (fresh ice runs differently: your call is aimed again on it, or, when no line gets there now, your skip calls again)
  if (id === 'crpebble' && GP.sel) { GP.sel.aim = crSelAim(GP.sel); if (!GP.sel.aim) { crSelReset(); GP.msg += ` On the fresh ice that line doesn't get there: your skip calls ${GP.sel.why}.`; } }
  crPick();
  return '';
}
/* what a potion would be worth now: [{ id, v, why }] for the potions in bag, for side s's next stone. A draught when
   the sweepers' legs are going and the stone is a draw; the warming draught for a nervy skip in the last end; the salt
   when the other rink's next stone is a big one (late in the end, theirs the hammer); the pebble when the sheet is worn */
function crPotionValues(s, bag, shot) {
  const out = [], T = G.teams[s], legs = G.legs ? G.legs[s] : 1, p = crPressure(s), ri = crThrower(s), m = T.roster[ri], late = G.k >= crPerEnd() - 4;
  const draw = !['takeout', 'peel', 'hitroll'].includes(shot || 'draw');
  if (bag.draught && legs < .6) out.push({ id: 'draught', v: (.7 - legs) * 10 + (draw ? 1 : 0) + (p ? 1 : 0), why: `the sweepers are down to ${Math.round(legs * 100)}% of their legs` });
  if (bag.crwarm && p && m && m.rs.nrv < .75) out.push({ id: 'crwarm', v: 3 + p * 2 * (1 - clamp(m.rs.nrv, 0, 1)), why: `${m.n} throws the last end` });
  if (bag.crsalt && late && G.hammer !== s) out.push({ id: 'crsalt', v: 2.2 + (G.end >= G.ends - 1 ? 1 : 0) + (G.k === crPerEnd() - 2 ? .8 : 0), why: 'their last stones are coming, and they have the hammer' });
  const worn = crIceWorn(); if (bag.crpebble && worn > .08) out.push({ id: 'crpebble', v: 2 + worn * 8, why: `${Math.round(worn * 100)}% of the pebble is worn` });
  return out.filter(o => !crPotionWhy(s, o.id)).sort((a, c) => c.v - a.v);
}
function crPotionAdvice(bag) { if (!G || !GP) return null; const sh = GP.sel ? GP.sel.shot : 'draw', o = crPotionValues(GP.you, bag || {}, sh)[0]; return o && o.v >= CR_KIT.take[1] ? { id: o.id, why: o.why } : null; }
// the CPU before its stone. Never yours: your bag is your own (a null bag here). Returns the words, or ''
function crCpuPotion(s, shot) {
  const bag = G.bags && G.bags[s]; if (!bag || !Object.keys(bag).length || G.over) return '';
  const vals = crPotionValues(s, bag, shot); if (!vals.length) return '';
  const sk = G.skill[s];
  if (!sk) return R() < CR_KIT.squire ? crPotionGive(s, vals[0].id, vals[0].why) : '';
  return vals[0].v >= CR_KIT.take[sk] ? crPotionGive(s, vals[0].id, vals[0].why) : '';
}
// after side s's stone: the warming draught is spent, and the salt on its line; at an end's end, all of it
function crKitAfter(s, endDone) { if (G && G.still) { G.still[s] = false; G.salt[s] = false; if (endDone) { G.still = [false, false]; G.salt = [false, false]; } } }
// a CPU's potion, and its plan made again if the potion changed the ice under it (Hennock's Pebble). The pebble is
// given for the worn ice, whatever the shot, so a new shot on the fresh ice still suits it; the page and a headless game
// both go this way, so a seeded game plays the same either way
function crCpuPotionPlan(s, plan, again) { const n = G.pots.length, pot = crCpuPotion(s, plan.shot); return { pot, plan: pot && G.pots[n] && G.pots[n].id === 'crpebble' ? Object.assign(again(), { s }) : plan }; }
