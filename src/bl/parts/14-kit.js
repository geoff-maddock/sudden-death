/* The Saltmere Lanes: gear and potions (issue #100, phase 7), by #61's conventions; the Realm's side is
   w118-laneskit.js.
   Gear: a bowler may wear one piece. A roster bowler sent with { gear: { id, name, fx } } keeps its name (gear) and the
   effects the engine reads (gx: fx without r; fx.r is laid on the ratings by the Realm before the engine sees them).
   What gx may hold: arm (what a ball costs them, ×), carry (how hard their ball drives through the pins, ×), press (how
   much a big moment weighs on them, ×) and err (their release's miss, ×).
   Potions (BL_POTIONS): one a side a frame (G.potFrame), before a ball of that side's. G.bags = [bag or null, ...] by
   side: a null bag is kept by the page (the Realm keeps yours and takes each one out as you give it), and a bag here
   ({ id: n }) is the CPU's, given at its skill before its balls (blCpuPotion). Every use goes in G.pots ({ side, id,
   ri, frame, why }). What each does, all plain data in G:
   draught (the Stamina Draught): one bowler BL_POTIONS.draught.arm of their arm back; blsteady (Steady Hand): no
   pressure on the side's next ball (G.still); blchalk (Grip Chalk): one bowler's release BL_POTIONS.blchalk.err as
   wide for the rest of this frame (G.chalk: { ri, f }); bloil (Moll's Lane Oil): a fresh stripe on the lane the side
   bowls next, the house pattern laid again (the transition starts over there, for both sides). */
const BL_POTIONS = {
  draught: { n: 'Stamina Draught', one: true, arm: .4, desc: 'One bowler gets two fifths of their arm back.' },
  blsteady: { n: 'Steady Hand', desc: 'Your next ball has no pressure on it, whatever rides on it.' },
  blchalk: { n: 'Grip Chalk', one: true, err: .75, desc: 'One bowler\'s release a quarter truer for the rest of this frame.' },
  bloil: { n: 'Moll\'s Lane Oil', desc: 'Moll lays a fresh stripe on the lane you bowl next: the house pattern again, the dry track gone (for both sides).' },
};
// a CPU gives a potion worth this much (by skill: a Squire, now and then, whatever comes first)
const BL_KIT = { take: [99, 2.5, 2], squire: .25 };
function blGx(fx) { if (!fx) return null; const o = JSON.parse(JSON.stringify(fx)); delete o.r; return Object.keys(o).length ? o : null; }
const blGxOf = (s, ri) => (G && G.teams && G.teams[s].roster[ri] && G.teams[s].roster[ri].gx) || {};
function blKitStart(bags) {
  G.bags = [0, 1].map(s => bags && bags[s] ? Object.assign({}, bags[s]) : null);
  G.pots = []; G.potFrame = ['', '']; G.still = [false, false]; G.chalk = [null, null];
}
const blFrameKey = blKey;
// the kit's part in how true side s's bowler ri is now (gear's err, the chalk), and how a moment weighs on them
function blKitErr(s, ri) { const C = G.chalk && G.chalk[s]; return (blGxOf(s, ri).err || 1) * (C && C.ri === ri && C.f === blFrameKey(s) ? BL_POTIONS.blchalk.err : 1); }
const blKitPress = (s, ri) => (G.still && G.still[s] ? 0 : 1) * (blGxOf(s, ri).press || 1);
function blPotionWhy(s, id, ri) {
  const P = BL_POTIONS[id]; if (!P) return 'No such potion.';
  if (!G || G.over) return 'The game is over.';
  if (blUp() !== s) return 'Not your ball.';
  if (G.potFrame[s] === blFrameKey(s)) return 'One potion a frame.';
  if (P.one && !G.teams[s].roster[ri]) return 'Pick a bowler.';
  if (id === 'draught' && G.arm[s][ri] >= .95) return 'Their arm is fresh.';
  if (id === 'blsteady' && G.still[s]) return 'Already steady.';
  if (id === 'blchalk' && G.chalk[s] && G.chalk[s].f === blFrameKey(s)) return 'Chalked already this frame.';
  return '';
}
function blPotionGive(s, id, ri, why) {
  const P = BL_POTIONS[id], T = G.teams[s], m = P.one ? T.roster[ri] : null;
  if (id === 'draught') G.arm[s][ri] = Math.min(1, +(G.arm[s][ri] + P.arm).toFixed(3));
  if (id === 'blsteady') G.still[s] = true;
  if (id === 'blchalk') G.chalk[s] = { ri, f: blFrameKey(s) };
  if (id === 'bloil') G.oil[blLane(s)] = G.oil0.slice();
  if (G.bags[s]) { G.bags[s][id]--; if (G.bags[s][id] <= 0) delete G.bags[s][id]; }
  G.potFrame[s] = blFrameKey(s);
  G.pots.push({ side: s, id, ri: P.one ? ri : -1, frame: blFrameNo(s), why: why || '' });
  return `${T.name}: ${P.n}${m ? ` for ${m.n}` : ''}${why ? ` (${why})` : ''}.`;
}
// your potion now: '' when given (the page takes it out of your bag), or why not
function blPotion(id, ri) {
  if (!GP) return 'No game.';
  const s = GP.you, why = blPotionWhy(s, id, ri); if (why) return why;
  GP.msg = blPotionGive(s, id, ri);
  if (GP.sel) GP.sel = Object.assign(blSelFromPlan(blSuggest(s)), { revs: GP.sel.revs });
  if (BL_HOOK.onPick) try { BL_HOOK.onPick(); } catch (e) { console.error(e); }
  return '';
}
/* what a potion would be worth now, and to whom: [{ id, ri, v, why }] for the potions in bag. ri: who bowls next. A
   draught for a tired arm; Steady Hand in the last frame for a nervy bowler; chalk at a split or a big spare; the oil
   when the track on the lane has dried */
function blPotionValues(s, bag, ri) {
  const out = [], T = G.teams[s], A = G.arm[s], st = G.stand[s], p = blPressure(s), m = T.roster[ri];
  const tired = A.map((a, i) => [a, i]).sort((x, y) => x[0] - y[0])[0];
  if (bag.draught && A[ri] < .6) out.push({ id: 'draught', ri, v: (.7 - A[ri]) * 10 + (p ? 1 : 0), why: `${m.n} is down to ${Math.round(A[ri] * 100)}% arm` });
  else if (bag.draught && tired[0] < .45) out.push({ id: 'draught', ri: tired[1], v: (.6 - tired[0]) * 8, why: `${T.roster[tired[1]].n} is down to ${Math.round(tired[0] * 100)}% arm` });
  if (bag.blsteady && p && m && m.rs.nrv < .75) out.push({ id: 'blsteady', ri: -1, v: 3 + p * 2 * (1 - m.rs.nrv), why: `${m.n} bowls the last frame` });
  if (bag.blchalk && st.length < 10 && st.length && (blIsSplit(st) || p || st.length >= 3)) out.push({ id: 'blchalk', ri, v: 2.4 + (p ? 1.2 : 0) + (blIsSplit(st) ? .6 : 0), why: `${m.n} has the ${st.join('-')} to pick up` });
  if (bag.bloil && st.length === 10 && blTrackDry(blLane(s), blStyleOf(s, ri).hand)) out.push({ id: 'bloil', ri: -1, v: 2.8 + (p ? 1 : 0), why: 'the track on this lane has dried' });
  return out.filter(o => !blPotionWhy(s, o.id, o.ri)).sort((a, c) => c.v - a.v);
}
function blPotionAdvice(bag, ri) { if (!G || !GP) return null; const o = blPotionValues(GP.you, bag || {}, ri == null ? blBowler(GP.you) : ri)[0]; return o && o.v >= BL_KIT.take[1] ? { id: o.id, ri: o.ri, why: o.why } : null; }
// the CPU before its ball. Never yours: your bag is your own (a null bag here). Returns the words, or ''
function blCpuPotion(s) {
  const bag = G.bags && G.bags[s]; if (!bag || !Object.keys(bag).length || G.over) return '';
  const vals = blPotionValues(s, bag, blBowler(s)); if (!vals.length) return '';
  const sk = G.skill[s];
  if (!sk) return R() < BL_KIT.squire ? blPotionGive(s, vals[0].id, vals[0].ri, vals[0].why) : '';
  return vals[0].v >= BL_KIT.take[sk] ? blPotionGive(s, vals[0].id, vals[0].ri, vals[0].why) : '';
}
// after side s's ball: Steady Hand is spent
function blKitAfter(s) { if (G && G.still) G.still[s] = false; }
