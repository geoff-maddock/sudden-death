/* Black Ice: gear and potions (issue #83, phase 8), by #61's conventions; the Realm's side is w93-rinkkit.js.
   Gear: a player may wear one piece. A roster player sent with { gear: { id, name, fx } } keeps its name (gear) and the
   effects the engine reads (gx: fx without r; fx.r is laid on the ratings before the engine sees them, by the Realm).
   What gx may hold: accel (how fast they get going ×), shot (added to the odds of their shots beating the goalie),
   guard (added to the odds of a poke at them: negative is safer), blkSta (what blocking a shot costs them in stamina
   ×), save (in goal only: taken off the odds of a shot beating them), fo (added to their odds at a face-off).
   Blocking a shot hurts: it costs the blocker HK_BLOCK_STA of their stamina (less in Shin Pads).
   Potions (HK_POTIONS): at a whistle or a break (HK_POT_AT), one per side per whistle (GD.potUsed). G.bags = [bag or
   null, ...] by side: a null bag is kept by the page (the Realm keeps yours and takes each one out as you give it),
   and a bag here ({ id: n }) is the CPU's, given by its coach at its skill at each whistle (hkCpuPotion). Every use
   goes in the line under the rink with its reason and in G.pots ({ side, id, ri, p, why }). What each does, all plain
   data in G: draught: one skater HK_POTIONS.draught.rest of their stamina back; hkanti (Antifreeze): the side's
   skaters tire HK_POTIONS.hkanti.tire as fast for the rest of this period (G.anti[side]: the period); hkcider (Hot
   Cider): one player's shots are HK_POTIONS.hkcider.shot likelier for the rest of this period (G.cider[side]: { ri,
   p }); hkliniment (Tove's Liniment): the side's earliest penalty ends now. */
const HK_POTIONS = {
  draught: { n: 'Stamina Draught', one: true, rest: .4, desc: 'One tired skater gets two fifths of their stamina back.' },
  hkanti: { n: 'Antifreeze', tire: .6, desc: 'Your skaters tire much slower for the rest of this period: every shift lasts longer.' },
  hkcider: { n: 'Hot Cider', one: true, shot: .04, desc: 'One player\'s shots are harder to stop for the rest of this period.' },
  hkliniment: { n: 'Tove\'s Liniment', desc: 'A player in the box comes out now: your earliest penalty is over.' },
};
const HK_BLOCK_STA = .06;
// a CPU coach gives a potion worth this much (by skill: a Squire, now and then, whatever comes first)
const HK_KIT = { take: [99, 4, 3], squire: .25 };
const HK_GX0 = Object.freeze({});
function hkGx(fx) { if (!fx) return null; const o = JSON.parse(JSON.stringify(fx)); delete o.r; return Object.keys(o).length ? o : null; }
const hkGxOf = p => { if (!p || !G || !G.teams) return HK_GX0; const m = G.teams[p.side] && G.teams[p.side].roster[p.ri]; return (m && m.gx) || HK_GX0; };
function hkKitStart(bags) {
  G.bags = [0, 1].map(s => bags && bags[s] ? Object.assign({}, bags[s]) : null);
  G.pots = []; G.anti = [0, 0]; G.cider = [null, null];
}
// a side's skaters tire this much as fast on Antifreeze, this period
const hkAnti = side => G.anti && G.anti[side] === G.p ? HK_POTIONS.hkanti.tire : 1;
// what Hot Cider adds to this player's shots, this period
const hkCider = p => { const C = G.cider && G.cider[p.side]; return C && C.ri === p.ri && C.p === G.p ? HK_POTIONS.hkcider.shot : 0; };
const HK_POT_AT = ['dead', 'break'];
// why side can't give potion id (to player ri) now, or '' when it can
function hkPotionWhy(side, id, ri) {
  const P = HK_POTIONS[id]; if (!P) return 'No such potion.';
  if (!GD || !HK_POT_AT.includes(GD.ph)) return 'Only at a whistle, or a break between periods.';
  if (GD.potUsed && GD.potUsed[side]) return 'One potion a whistle.';
  if (P.one) {
    if (!G.teams[side].roster[ri]) return 'Pick a player.';
    if (id === 'draught' && G.sta[side][ri] >= .95) return 'They\'re fresh.';
    if (id === 'hkcider' && G.cider[side] && G.cider[side].p === G.p) return 'Somebody has had the cider this period.';
    if (id === 'hkcider' && ri === G.on[side][HK_POS.indexOf('G')]) return 'Not for the goalie.';
  }
  if (id === 'hkanti' && G.anti[side] === G.p) return 'Already on it this period.';
  if (id === 'hkanti' && hkOt()) return 'Not in sudden death: it is over too soon.';
  if (id === 'hkliniment' && !G.box.some(b => b.side === side)) return 'Nobody of yours is in the box.';
  return '';
}
// side gives potion id (to ri): its effect, the line and the record; the CPU's comes out of its bag here (yours, the page's)
function hkPotionGive(side, id, ri, why) {
  const P = HK_POTIONS[id], T = G.teams[side], m = P.one ? T.roster[ri] : null;
  if (id === 'draught') G.sta[side][ri] = Math.min(1, G.sta[side][ri] + P.rest);
  if (id === 'hkanti') G.anti[side] = G.p;
  if (id === 'hkcider') G.cider[side] = { ri, p: G.p };
  let who = '';
  if (id === 'hkliniment') { const b = G.box.find(x => x.side === side); if (b) { who = T.roster[b.ri].n; hkBoxOut(b); hkLines(); } }
  if (G.bags[side]) { G.bags[side][id]--; if (G.bags[side][id] <= 0) delete G.bags[side][id]; }
  GD.potUsed = GD.potUsed || [false, false]; GD.potUsed[side] = true;
  G.pots.push({ side, id, ri: P.one ? ri : -1, p: G.p, why: why || '' });
  GD.msg = `${T.name}: ${P.n}${m ? ` for ${m.n}` : who ? `, and ${who} is out of the box` : ''}${why ? ` (${why})` : ''}.`;
  hkEv('potion', P.n, T.name);
}
// your potion now: '' when given (the page takes it out of your bag), or why not
function hkPotion(id, ri) { const why = hkPotionWhy(GD.you, id, ri); if (why) return why; hkPotionGive(GD.you, id, ri); return ''; }
/* what a potion would be worth now, and to whom: [{ id, ri, v, why }] for the potions in bag (a CPU's, or the advice
   for yours). Stamina for the most tired skater; Antifreeze early in a period for a tired side with nobody fresh;
   Hot Cider for the best shot in a close game from the second period on; the Liniment whenever somebody is boxed */
function hkPotionValues(side, bag) {
  const out = [], T = G.teams[side], st = G.sta[side], on = G.on[side].slice(0, HK_POS.length - 1), close = Math.abs(hkLead(side)) <= 1;
  const tired = on.slice().sort((a, b) => st[a] - st[b])[0];
  if (bag.draught && st[tired] < .5) out.push({ id: 'draught', ri: tired, v: (.6 - st[tired]) * 12, why: `${T.roster[tired].n} is down to ${Math.round(st[tired] * 100)}%` });
  const avg = on.reduce((a, r) => a + st[r], 0) / on.length, fresh = hkBench(side).some(i => st[i] >= HK_STA.fresh);
  if (bag.hkanti && G.clock > G.plen * .5 && (avg < .6 || !hkBench(side).length)) out.push({ id: 'hkanti', ri: -1, v: (fresh ? 3 : 4.5) + (hkBench(side).length ? 0 : 1), why: hkBench(side).length ? `the line averages ${Math.round(avg * 100)}%` : 'nobody on the bench to change with' });
  if (bag.hkcider && G.p >= 2 && close && G.clock > G.plen * .4) { const best = on.slice().sort((a, b) => T.roster[b].r.sht - T.roster[a].r.sht)[0]; out.push({ id: 'hkcider', ri: best, v: G.p >= HK_RULES.periods ? 5 : 3.5, why: `a close game, and ${T.roster[best].n} has the best shot` }); }
  if (bag.hkliniment && G.box.some(b => b.side === side)) { const b = G.box.find(x => x.side === side); out.push({ id: 'hkliniment', ri: -1, v: 3 + b.t / hkMinor() * 3 + (close ? 1 : 0), why: `${T.roster[b.ri].n} has ${Math.ceil(b.t)} seconds left in the box` }); }
  return out.filter(o => !hkPotionWhy(side, o.id, o.ri)).sort((a, b) => b.v - a.v);
}
// your bench's advice: the potion from your bag worth most now ({ id, ri, why }), or null
function hkPotionAdvice(bag) { const o = G && GD ? hkPotionValues(GD.you, bag || {})[0] : null; return o && o.v >= HK_KIT.take[1] ? { id: o.id, ri: o.ri, why: o.why } : null; }
// the CPU's coach at a whistle: a Squire now and then whatever comes first; a Knight or an Archmage what's worth it.
// Never yours: your bag is your own, in Manage and You play (and the page's in Watch)
function hkCpuPotion() {
  for (const side of [0, 1]) {
    const bag = G.bags && G.bags[side]; if (!bag || !Object.keys(bag).length || (GD.potUsed && GD.potUsed[side])) continue;
    if (GD.mode !== 'watch' && side === GD.you) continue;
    const vals = hkPotionValues(side, bag); if (!vals.length) continue;
    const sk = G.skill[side];
    if (!sk) { if (R() < HK_KIT.squire) hkPotionGive(side, vals[0].id, vals[0].ri, vals[0].why); continue; }
    if (vals[0].v >= HK_KIT.take[sk]) hkPotionGive(side, vals[0].id, vals[0].ri, vals[0].why);
  }
}
