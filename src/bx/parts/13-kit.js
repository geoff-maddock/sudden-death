/* The Anvil Ring: gear and potions (issue #61, phase 2). The engine's side; the Realm's is src/realm/w73-ringkit.js.
   Gear: a fighter may wear one piece (from { gear: { id, name, fx } } on the fighter it is given; fx.r is laid on the
   ratings before the engine sees them). The engine reads the rest of fx (f.gx):
     dmg: damage out ×, cut: what their power punches take off the other fighter's most health ×, headIn: head
     punches to them ×, rise: seconds off every count, open: a status at the opening bell ({ t, acc?, dmgIn?, ... }).
   Potions: each side brings a bag ({ id: n }; G.bags, CD.bags on a card, so what is used in one bout is gone for the
   next). Between rounds, one a round, in the corner: yours with bxPotion (it waits for your call), theirs by the CPU
   corner at its skill (bxCornerPotion: the best of what suits the moment; a Squire picks worse and later). Every use
   goes in the log with its reason. BX_POTIONS: what each one does, all through the fighter's statuses or a number on
   the fighter, so it is all plain data and saved with the bout. */
const BX_POTIONS = {
  draught: { n: 'Stamina Draught', desc: 'Full breath now, and breath comes back faster for the first 15 seconds of the round.' },
  cutsalve: { n: 'Cut Salve', desc: 'Closes the cuts: 15 back on their most health, and 10 health.' },
  smellsalts: { n: 'Smelling Salts', desc: 'The next count this bout, they beat it 3 seconds sooner.' },
  ragetonic: { n: 'Rage Tonic', desc: 'For the next round, 20% more damage, and 15% more taken.' },
};
const BX_GX0 = Object.freeze({});
const BX_DRAUGHT = { t: 15, reg: 1.5 }; // the draught's faster breath: for t seconds, reg more a second (40 s at 2.5 cost a tier-3 card 14 points: test/realm_ring_kit.py's notes)
const bxGx = f => f.gx || BX_GX0;
// a potion now: on f, for the round to come
function bxPotionApply(f, id) {
  if (id === 'draught') { f.sta = f.staMax; f.fx.push({ id: 'p_draught', t: BX_DRAUGHT.t, regSta: BX_DRAUGHT.reg }); }
  else if (id === 'cutsalve') { f.hpMax = Math.min(BX_HP, f.hpMax + 15); f.hp = Math.round(Math.min(f.hpMax, f.hp + 10)); }
  else if (id === 'smellsalts') f.salts = 3;
  else if (id === 'ragetonic') f.fx.push({ id: 'p_rage', t: BX_RULES.secs, dmgOut: 1.2, dmgIn: 1.15 });
}
// whether side s may take a potion now: in the corner, one a round, from what is left in its bag
function bxPotionOk(s, id) {
  const f = G && G.F && G.F[s], bag = G && G.bags && G.bags[s];
  if (!f || !BX_POTIONS[id] || !bag || !(bag[id] > 0)) return false;
  return BD && BD.ph === 'corner' && f.potRound !== G.round;
}
function bxPotionUse(s, id, why) {
  if (!bxPotionOk(s, id)) return false;
  const f = G.F[s];
  G.bags[s][id]--; f.potRound = G.round; (G.pots = G.pots || []).push({ s, id, r: G.round });
  bxPotionApply(f, id);
  bxLog(`${G.corners[s].name}'s corner gives ${f.n} ${/^[aeiou]/i.test(BX_POTIONS[id].n) ? 'an' : 'a'} ${BX_POTIONS[id].n}${why ? `: ${why}` : ''}.`);
  return true;
}
// your potion, while the bout waits for your call between rounds
function bxPotion(id) {
  if (!G || !G.wait || !bxPotionOk(BD.you, id)) return false;
  bxPotionUse(BD.you, id, '');
  G.wait.pot = null;
  if (BX_HOOK.onPhase) BX_HOOK.onPhase(BD.ph);
  return true;
}
/* what suits the moment: [{ id, v (how much it would help), why }], best first */
function bxPotionNeeds(f) {
  const bag = (G.bags && G.bags[f.side]) || {}, T = bxTotals(), last = G.round === G.rounds;
  const lead = T.reduce((n, t) => n + Math.sign(f.side ? t[1] - t[0] : t[0] - t[1]), 0), o = G.F[1 - f.side], out = [];
  const has = id => bag[id] > 0;
  if (has('cutsalve') && f.hpMax < 80) out.push({ id: 'cutsalve', v: (BX_HP - f.hpMax) / 6, why: `cut up, their most health down to ${Math.round(f.hpMax)}` });
  if (has('smellsalts') && !f.salts && (G.kd[f.side] > 0 || f.hp < f.hpMax * .5)) out.push({ id: 'smellsalts', v: 3 + G.kd[f.side] * 2, why: G.kd[f.side] ? 'they have been down already' : 'hurt, and a knockdown could come' });
  if (has('ragetonic') && G.cards.length && (last ? lead <= 0 : lead < 0) && f.hp > f.hpMax * .5) out.push({ id: 'ragetonic', v: last ? 6 : 3, why: last ? 'behind or level going into the last round' : 'behind on the cards' });
  if (has('draught') && f.staMax < 115 && (f.plan === 'press' || o.plan === 'press' || bxFrac(f) < .9)) out.push({ id: 'draught', v: 2 + (115 - f.staMax) / 15, why: 'short of breath for the round to come' });
  return out.sort((a, b) => b.v - a.v);
}
// the CPU corner's potion: a Knight or Archmage takes the best when it is worth it; a Squire, now and then, whatever is first in the bag
function bxCornerPotion(f) {
  const skill = G.skill ? G.skill[f.side] : 1, bag = (G.bags && G.bags[f.side]) || {};
  if (skill === 0) { const any = Object.keys(bag).filter(id => bag[id] > 0 && BX_POTIONS[id]); if (any.length && R() < .35) bxPotionUse(f.side, any[0], 'their corner reaches for the bag'); return; }
  const N = bxPotionNeeds(f), top = N[0];
  if (top && top.v >= (skill === 2 ? 3 : 4.5)) bxPotionUse(f.side, top.id, top.why);
}
// what your corner would give, for the call (the Knight's choice)
function bxPotionAdvice(f) { const top = bxPotionNeeds(f)[0]; return top && top.v >= 3 ? { id: top.id, why: top.why } : null; }
// a side's bag, and what each potion does (for the page)
function bxBagOf(s) { return G && G.bags && G.bags[s] ? Object.assign({}, G.bags[s]) : {}; }
