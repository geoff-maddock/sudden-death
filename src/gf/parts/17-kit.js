/* Cinder Gridiron: gear and potions (issue #61, phase 3). The engine's side; the Realm's is src/realm/w74-gridkit.js.
   Gear: a player may wear one piece. A roster player sent with { gear: { id, name, fx } } keeps its name (gear) and
   the effects the engine reads (gx: fx without r; fx.r is laid on the ratings before the engine sees them), from
   gfTeam (04-teams.js). What gx may hold:
     spd: speed ×, turn: how sharply they change direction ×, fum: their fumbles as the carrier ×, catch: added to
     their catch chance, kick: yards off a field goal's distance (and onto the range), punt: yards onto a punt,
     blk: strength added in every block they are in (as the blocker or the one blocked).
   Potions (GF_POTIONS): one a play per side, between plays (gfBetween). G.bags = [bag or null, ...] by side: a null bag
   is kept by the page (the Realm keeps yours, and checks it), and a bag here ({ id: n }) is the CPU's, used by its
   coach at its skill (gfCpuPotion) at each call, after its swaps. Every use goes in the next play's log line with its
   reason (GD.notes), and in G.pots ({ side, id, ri, play }). What each one does, all plain data in G (so it is saved):
     draught, secondwind: stamina back (15-bench.js gfRestore); gfresin: G.drive.resin, no fumbles by that side for
     the drive; gfhaste: G.drive.haste [{ s, ri }], faster for the drive; gffog: G.fog, the other side reads nothing of
     the next call (12-playbook.js); gfsalve: G.salve[side] [ri], full ratings for the half (gfWorn), some stamina back. */
const GF_POTIONS = {
  draught: { n: 'Stamina Draught', one: true, rest: 40, desc: 'One tired player gets 40 stamina back.' },
  secondwind: { n: 'Second Wind', all: true, rest: 15, desc: 'The whole seven get 15 stamina back.' },
  gfresin: { n: 'Fumble Resin', desc: 'Pine resin on every hand: your side can\'t fumble for the rest of this drive. Only when you have the ball.' },
  gfhaste: { n: 'Speed Elixir', one: true, desc: 'One player runs 6% faster for the rest of this drive, on either side of the ball.' },
  gffog: { n: 'Fog Vial', desc: 'Smoke over your sideline: the other side can\'t read your next call. Their coach calls blind, and however often you have called it, they don\'t see it coming.' },
  gfsalve: { n: 'Mending Balm', one: true, rest: 15, desc: 'For a worn-down player: full ratings for the rest of the half, however tired, and 15 stamina back.' },
};
const GF_HASTE = 1.06;
// a CPU coach takes a potion worth this much (Knight, Archmage); a Squire, now and then, whatever comes first
const GF_KIT = { take: [99, 4.5, 3.5], squire: .25 };
const GF_GX0 = Object.freeze({});
// gear's effects, without the ratings (those are on r already)
function gfGx(fx) { if (!fx) return null; const o = JSON.parse(JSON.stringify(fx)); delete o.r; return Object.keys(o).length ? o : null; }
const gfGxOf = p => (p && p.gx) || GF_GX0;
// a player's speed and turn at the snap: their cleats, and a Speed Elixir this drive (team: their side of the game)
function gfKitMove(team, ri, m) {
  const g = gfGxOf(m), haste = G.drive && G.drive.haste && G.drive.haste.some(h => h.s === team && h.ri === ri);
  return { sm: (g.spd || 1) * (haste ? GF_HASTE : 1), tn: g.turn || 1 };
}
// the kicking tee: the kicker's yards off a field goal (side: the kicking side)
const gfTee = side => gfGxOf(G.teams[side].roster[G.teams[side].kicker]).kick || 0;
const gfTeePunt = side => gfGxOf(G.teams[side].roster[G.teams[side].kicker]).punt || 0;
// the carrier's fumbles: their helmet, and the side's Fumble Resin this drive (0: none)
function gfFumMul(side, m) { if (G.drive && G.drive.resin === side) return 0; return gfGxOf(m).fum != null ? gfGxOf(m).fum : 1; }
// G.salve: who plays on full ratings this half
const gfSalved = (side, ri) => !!(G.salve && G.salve[side] && G.salve[side].includes(ri));

function gfKitStart(bags) {
  G.bags = [0, 1].map(s => bags && bags[s] ? Object.assign({}, bags[s]) : null);
  G.pots = []; G.fog = null; G.salve = [[], []];
}
const gfPotUsed = s => !!(GD && (s === GD.you && GD.mode !== 'watch' ? GD.item : GD.cItem && GD.cItem[s]));
// whether side s may give potion id (to ri, for one player) now: '' when it may, or why not
function gfPotionWhy(s, id, ri) {
  const P = GF_POTIONS[id]; if (!P || !G || !GD) return 'That is not a football potion.';
  const bag = G.bags && G.bags[s];
  if (bag && !(bag[id] > 0)) return `No ${P.n} left.`;
  if (!gfBetween()) return 'Potions are given between plays, and not after the last one.';
  if (gfPotUsed(s)) return 'One potion a play.';
  if (P.one && !gfOnField(s).includes(ri)) return 'That player is not on the field.';
  if ((P.rest || id === 'gfsalve') && !G.stam) return 'There is no stamina in this game.';
  if (id === 'gfresin') { if (G.poss !== s) return 'Resin is for when you have the ball.'; if (G.drive.resin === s) return 'The resin is on already this drive.'; }
  if (id === 'gfhaste' && G.drive.haste && G.drive.haste.some(h => h.s === s && h.ri === ri)) return 'They have had one this drive.';
  if (id === 'gffog' && G.fog === s) return 'The fog is already out for the next call.';
  if (id === 'gfsalve' && gfSalved(s, ri)) return 'They are on the balm already this half.';
  return '';
}
// give it: the effect, the bag, the log; why: the coach's reason (the CPU's)
function gfPotionGive(s, id, ri, why) {
  const P = GF_POTIONS[id], T = G.teams[s], who = ri != null && T.roster[ri] ? T.roster[ri].n : '';
  // (a game saved before there were potions)
  if (!G.pots) { G.bags = G.bags || [null, null]; G.pots = []; G.salve = G.salve || [[], []]; }
  if (G.bags[s]) G.bags[s][id]--;
  if (s === GD.you && GD.mode !== 'watch') GD.item = true; else (GD.cItem = GD.cItem || [false, false])[s] = true;
  G.pots.push({ side: s, id, ri: ri != null ? ri : null, play: G.plays });
  let msg;
  if (id === 'draught') msg = gfRestore(s, ri, P.rest, P.n);
  else if (id === 'secondwind') msg = gfRestore(s, null, P.rest, P.n);
  else {
    if (id === 'gfresin') { G.drive.resin = s; msg = `${P.n}: no fumbles for the rest of the drive.`; }
    else if (id === 'gfhaste') { (G.drive.haste = G.drive.haste || []).push({ s, ri }); msg = `${P.n}: ${who} is faster for the rest of the drive.`; }
    else if (id === 'gffog') { G.fog = s; msg = `${P.n}: the next call is hidden from the other side.`; }
    else if (id === 'gfsalve') { G.salve[s].push(ri); G.stam[s][ri] = Math.min(100, G.stam[s][ri] + P.rest); msg = `${P.n}: ${who} plays on full ratings for the rest of the half, and gets ${P.rest} stamina back.`; }
    gfNote(s, 'pot', msg);
  }
  // (the coach's reason goes on the note it made)
  if (why && GD.notes && GD.notes.length) { const n = GD.notes[GD.notes.length - 1]; n.k = 'pot'; n.msg = n.msg.replace(/\.$/, '') + ` (${why}).`; }
  return msg;
}
// your potion: returns what happened, or '' when it can't (gfPotionWhy says why)
function gfPotion(id, ri) {
  if (!G || !GD) return '';
  const s = GD.you, one = GF_POTIONS[id] && GF_POTIONS[id].one;
  if (gfPotionWhy(s, id, one ? ri : null)) return '';
  return gfPotionGive(s, id, one ? ri : null, '');
}

/* what suits the moment for side s: [{ id, ri, v (how much it would help), why }], best first */
function gfPotionNeeds(s) {
  const bag = G.bags[s] || {};
  const T = G.teams[s], on = gfOnField(s), st = i => gfStamOf(s, i), out = [], role = gfRole(s);
  const m = G.score[s] - G.score[1 - s], late = !!GD.game && (G.half === 3 || (G.half === 2 && G.clock < 150));
  const ok = (id, ri) => bag[id] > 0 && !gfPotionWhy(s, id, ri);
  if (G.stam) {
    const tired = on.slice().sort((a, b) => st(a) - st(b)), t = tired[0], avg = on.reduce((a, i) => a + st(i), 0) / on.length;
    if (ok('draught', t) && st(t) < 40) out.push({ id: 'draught', ri: t, v: (50 - st(t)) / 4, why: `${T.roster[t].n} is out on their feet` });
    if (ok('secondwind', null) && avg < 62) out.push({ id: 'secondwind', ri: null, v: (72 - avg) / 3, why: 'the seven are tiring' });
    const key = [T.off.QB, T.off.RB].find(i => on.includes(i) && st(i) < 45 && ok('gfsalve', i));
    if (key != null && (!GD.game || G.half >= 2 || G.clock < 150)) out.push({ id: 'gfsalve', ri: key, v: 4 + (45 - st(key)) / 15, why: `${T.roster[key].n} is worn down, and they need them` });
  }
  if (role === 'off') {
    const fr = gfFumbleRisk(s);
    if (ok('gfresin', null) && (fr.x >= 1.6 || (late && m > 0))) out.push({ id: 'gfresin', ri: null, v: late && m > 0 ? 5 : 2 + fr.x, why: late && m > 0 ? 'holding on to a lead' : fr.why || 'the back could fumble' });
    if (!G.drive.plays.length) {
      const fast = [T.off.RB, T.off.X, T.off.Z].filter(i => on.includes(i) && ok('gfhaste', i)).sort((a, b) => T.roster[b].r.spd - T.roster[a].r.spd)[0];
      if (fast != null) out.push({ id: 'gfhaste', ri: fast, v: 3.6 + (late && m < 0 ? 2 : 0), why: late && m < 0 ? 'behind late, and they need a quick score' : `a new drive, and ${T.roster[fast].n} is their fastest` });
    }
    if (ok('gffog', null) && ((G.down >= 3 && G.togo >= 4) || G.ball >= 80)) out.push({ id: 'gffog', ri: null, v: G.ball >= 80 ? 4 : 3.6 + (late ? 1.5 : 0), why: G.ball >= 80 ? 'close to the goal line' : `${GF_ORD[G.down]} and long` });
  }
  return out.sort((a, b) => b.v - a.v);
}
// the CPU coach's potion at the call, by skill
function gfCpuPotion(s, skill) {
  const bag = G.bags && G.bags[s]; if (!bag || gfPotUsed(s) || !gfBetween()) return;
  if (!skill) {
    if (R() > GF_KIT.squire) return;
    const on = gfOnField(s);
    for (const id of Object.keys(bag)) { if (!(bag[id] > 0) || !GF_POTIONS[id]) continue; const ri = GF_POTIONS[id].one ? pick(on) : null; if (!gfPotionWhy(s, id, ri)) return void gfPotionGive(s, id, ri, 'their sideline reaches for the bag'); }
    return;
  }
  const top = gfPotionNeeds(s)[0];
  if (top && top.v >= GF_KIT.take[skill]) gfPotionGive(s, top.id, top.ri, top.why);
}
// what your sideline would give now from bag (the page's, for yours): { id, ri, why } or null
function gfPotionAdvice(bag) {
  if (!G || !GD || !G.bags) return null;
  const s = GD.you, save = G.bags[s];
  G.bags[s] = Object.assign({}, bag || save || {});
  try { const top = gfPotionNeeds(s)[0]; return top && top.v >= GF_KIT.take[1] ? { id: top.id, ri: top.ri, why: top.why } : null; } finally { G.bags[s] = save; }
}
