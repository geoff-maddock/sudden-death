/* The Charter Court: gear and potions (issue #77, phase 7), by #61's conventions; the Realm's side is w82-courtkit.js.
   Gear: a player may wear one piece. A roster player sent with { gear: { id, name, fx } } keeps its name (gear) and the
   effects the engine reads (gx: fx without r; fx.r is laid on the ratings before the engine sees them, by the Realm).
   What gx may hold: spd (speed ×), turn (how sharply they change direction ×), win (their release window wider by
   this, and the CPU's shots by them half as much likelier), reb (rebound as if this much bigger), move (what a move
   costs them in stamina ×), ft (added to their free throws).
   Nerve: in the last BK_NERVE.secs of the fourth quarter or overtime, within BK_NERVE.close points, free throws are
   BK_NERVE.p less likely (and a hand's window narrower with them), unless the side took Steady Drops this half.
   Potions (BK_POTIONS): at a stoppage (a dead ball, a break, a timeout, the start of free throws), one per side per
   stoppage (GD.potUsed). G.bags = [bag or null, ...] by side: a null bag is kept by the page (the Realm keeps yours and
   takes each one out as you give it), and a bag here ({ id: n }) is the CPU's, given by its coach at its skill at each
   stoppage (bkCpuPotion). Every use goes in the line under the court with its reason (GD.notes) and in G.pots
   ({ side, id, ri, q, why }). What each does, all plain data in G: draught: one player 40 stamina back; bkhot: one
   player starts on fire (G.hot); bksteady: G.steady[side] set for the half (no nerve; from the second half on, and an
   overtime is a half of its own); secondwind: the whole five 20
   stamina back, at a timeout only. */
const BK_POTIONS = {
  draught: { n: 'Stamina Draught', one: true, rest: 40, desc: 'One tired player gets 40 stamina back.' },
  bkhot: { n: 'Hot Hand Elixir', one: true, desc: 'One player starts on fire: every look better until they miss.' },
  bksteady: { n: 'Steady Drops', desc: 'No nerves at the free-throw line for the rest of this half, however close the finish.' },
  secondwind: { n: 'Second Wind', all: true, rest: 20, desc: 'At a timeout: the whole five get 20 stamina back.' },
};
const BK_NERVE = { secs: 60, close: 5, p: .07 };
// a CPU coach gives a potion worth this much (by skill: a Squire, now and then, whatever comes first)
const BK_KIT = { take: [99, 4, 3], squire: .25 };
const BK_GX0 = Object.freeze({});
function bkGx(fx) { if (!fx) return null; const o = JSON.parse(JSON.stringify(fx)); delete o.r; return Object.keys(o).length ? o : null; }
const bkGxOf = p => { if (!p) return BK_GX0; const m = G.teams[p.side] && G.teams[p.side].roster[p.ri]; return (m && m.gx) || BK_GX0; };
// the nerve a side's free throws carry now
function bkNerve(side) {
  if (G.steady && G.steady[side]) return 0;
  return G.q >= BK_RULES.quarters && G.clock <= BK_NERVE.secs && Math.abs(G.score[0] - G.score[1]) <= BK_NERVE.close ? BK_NERVE.p : 0;
}
function bkKitStart(bags) {
  G.bags = [0, 1].map(s => bags && bags[s] ? Object.assign({}, bags[s]) : null);
  G.pots = []; G.steady = [false, false];
}
const BK_POT_AT = ['dead', 'break', 'timeout', 'ft'];
// why side can't give potion id (to player ri) now, or '' when it can
function bkPotionWhy(side, id, ri) {
  const P = BK_POTIONS[id]; if (!P) return 'No such potion.';
  if (!GD || !BK_POT_AT.includes(GD.ph)) return 'Only at a stoppage: a dead ball, a break, a timeout or free throws.';
  if (GD.potUsed && GD.potUsed[side]) return 'One potion a stoppage.';
  if (id === 'secondwind' && GD.ph !== 'timeout') return 'Second Wind is for a timeout.';
  if (P.one) {
    if (!G.teams[side].roster[ri]) return 'Pick a player.';
    if (id === 'bkhot' && !G.on[side].includes(ri)) return 'Only for someone on the floor.';
    if (id === 'bkhot' && (G.hot[side][ri] || 0) >= BK_FIRE.n) return 'They\'re already on fire.';
    if (id === 'draught' && G.stam[side][ri] >= 95) return 'They\'re fresh.';
    if (!G.on[side].includes(ri) && bkFouledOut(side, ri)) return 'They\'ve fouled out.';
  }
  if (id === 'bksteady' && G.steady[side]) return 'Already steady this half.';
  if (id === 'bksteady' && G.q < 3) return 'Steady Drops are for the second half: the nerves come at the end.';
  return '';
}
// side gives potion id (to ri): its effect, the note and the record; the CPU's comes out of its bag here (yours, the page's)
function bkPotionGive(side, id, ri, why) {
  const P = BK_POTIONS[id], T = G.teams[side], m = P.one ? T.roster[ri] : null;
  if (id === 'draught') G.stam[side][ri] = Math.min(100, G.stam[side][ri] + P.rest);
  if (id === 'secondwind') for (const r of G.on[side]) G.stam[side][r] = Math.min(100, G.stam[side][r] + P.rest);
  if (id === 'bkhot') { G.hot[side][ri] = BK_FIRE.n; if (G.kept) G.kept[side][ri] = false; }
  if (id === 'bksteady') G.steady[side] = true;
  if (G.bags[side]) { G.bags[side][id]--; if (G.bags[side][id] <= 0) delete G.bags[side][id]; }
  GD.potUsed = GD.potUsed || [false, false]; GD.potUsed[side] = true;
  G.pots.push({ side, id, ri: P.one ? ri : -1, q: G.q, why: why || '' });
  GD.notes = (GD.notes || []).concat(`${T.name}: ${P.n}${m ? ` for ${m.n}` : ''}${why ? ` (${why})` : ''}.`);
  bkEv('potion', P.n, T.name);
}
// your potion now: '' when given (the page takes it out of your bag), or why not
function bkPotion(id, ri) { const why = bkPotionWhy(GD.you, id, ri); if (why) return why; bkPotionGive(GD.you, id, ri); return ''; }
/* what a potion would be worth now, and to whom: [{ id, ri, v, why }] for the potions in bag (a CPU's, or the advice for
   yours). Stamina for the most tired on the floor; Second Wind at a timeout for a tired five; the Hot Hand Elixir for
   the best shooter late in a close game; Steady Drops before free throws in a close finish */
function bkPotionValues(side, bag) {
  const out = [], on = G.on[side], st = G.stam[side], T = G.teams[side], lead = bkLead(side), close = Math.abs(lead) <= 6, late = bkLate(.6);
  const tired = on.slice().sort((a, b) => st[a] - st[b])[0];
  if (bag.draught && st[tired] < 50) out.push({ id: 'draught', ri: tired, v: (60 - st[tired]) / 6, why: `${T.roster[tired].n} is down to ${Math.round(st[tired])}` });
  if (bag.secondwind && GD.ph === 'timeout') { const avg = on.reduce((a, r) => a + st[r], 0) / on.length; if (avg < 65) out.push({ id: 'secondwind', ri: -1, v: (75 - avg) / 3, why: `the five average ${Math.round(avg)}` }); }
  if (bag.bkhot && late && close) { const best = on.filter(r => (G.hot[side][r] || 0) < BK_FIRE.n).sort((a, b) => T.roster[b].r.tch - T.roster[a].r.tch)[0]; if (best != null) out.push({ id: 'bkhot', ri: best, v: 5, why: `a close finish, and ${T.roster[best].n} shoots best` }); }
  if (bag.bksteady && !G.steady[side] && G.q >= BK_RULES.quarters && close) out.push({ id: 'bksteady', ri: -1, v: GD.ph === 'ft' && GD.ft && GD.ft.side === side ? 6 : 3.5, why: 'a close finish, and free throws to come' });
  return out.filter(o => !bkPotionWhy(side, o.id, o.ri)).sort((a, b) => b.v - a.v);
}
// your bench's advice: the potion from your bag worth most now ({ id, ri, why }), or null
function bkPotionAdvice(bag) { const o = G && GD ? bkPotionValues(GD.you, bag || {})[0] : null; return o && o.v >= BK_KIT.take[1] ? { id: o.id, ri: o.ri, why: o.why } : null; }
// the CPU's coach at a stoppage: a Squire now and then whatever comes first; a Knight or an Archmage what's worth it
function bkCpuPotion(side, sk) {
  const bag = G.bags && G.bags[side]; if (!bag || !Object.keys(bag).length || (GD.potUsed && GD.potUsed[side])) return;
  if (GD.mode !== 'watch' && side === GD.you) return;
  const vals = bkPotionValues(side, bag); if (!vals.length) return;
  if (!sk) { if (R() < BK_KIT.squire) bkPotionGive(side, vals[0].id, vals[0].ri, vals[0].why); return; }
  if (vals[0].v >= BK_KIT.take[sk]) bkPotionGive(side, vals[0].id, vals[0].ri, vals[0].why);
}
