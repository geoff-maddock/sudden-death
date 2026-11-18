/* Mossgate Links: gear and potions (issue #92, phase 7), by #61's conventions; the Realm's side is w108-linkskit.js.
   Gear: a player may wear one piece. A roster player sent with { gear: { id, name, fx } } keeps its name (gear) and the
   effects the engine reads (gx: fx without r; fx.r is laid on the ratings by the Realm before the engine sees them).
   What gx may hold: focus (what a stroke costs them in focus, ×) and pshot (how much a power shot shrinks their mark, ×
   towards none: 1.3 is a third less shrink).
   Potions (GL_POTIONS): one a side a hole (G.potHole), before a stroke of that side's. G.bags = [bag or null, ...] by
   side: a null bag is kept by the page (the Realm keeps yours and takes each one out as you give it), and a bag here
   ({ id: n }) is the CPU's, given by its caddie at its skill before its strokes (glCpuPotion). Every use goes in the line
   under the bar with its reason and in G.pots ({ side, id, ri, h, why }). What each does, all plain data in G:
   draught: one player GL_POTIONS.draught.focus of their focus back; glstill (Still Water): no pressure on the side's
   next stroke (G.still); glmoss (Moss Tonic): one player scrambles GL_POTIONS.glmoss.scr better for the rest of this
   hole (G.moss: { ri, h }); gloil (Agatha's Oil): the side's next putt GL_POTIONS.gloil.putt as shaky, its read line
   half again as long (G.oil). */
const GL_POTIONS = {
  draught: { n: 'Stamina Draught', one: true, focus: 0.4, desc: 'One player gets two fifths of their focus back.' },
  glstill: { n: 'Still Water', desc: 'Your next stroke has no pressure on it, whatever rides on it.' },
  glmoss: { n: 'Moss Tonic', one: true, scr: 0.3, desc: 'One player scrambles much better for the rest of this hole: out of the rough, sand, bog and trees.' },
  gloil: { n: 'Agatha\'s Oil', putt: 0.6, read: 1.5, desc: 'Your next putt runs truer, and its read line is half again as long.' },
};
// a CPU caddie gives a potion worth this much (by skill: a Squire, now and then, whatever comes first)
const GL_KIT = { take: [99, 2.5, 2], squire: 0.25 };
function glGx(fx) { if (!fx) return null; const o = JSON.parse(JSON.stringify(fx)); delete o.r; return Object.keys(o).length ? o : null; }
const glGxOf = (s, ri) => (G && G.teams && G.teams[s].roster[ri] && G.teams[s].roster[ri].gx) || {};
function glKitStart(bags) {
  G.bags = [0, 1].map(s => bags && bags[s] ? Object.assign({}, bags[s]) : null);
  G.pots = []; G.potHole = [-1, -1]; G.still = [false, false]; G.oil = [false, false]; G.moss = [null, null];
}
// why side can't give potion id (to player ri) now, or '' when it can
function glPotionWhy(s, id, ri) {
  const P = GL_POTIONS[id]; if (!P) return 'No such potion.';
  if (!G || G.over) return 'The game is over.';
  if (G.hole.done[s]) return 'Your side is done with this hole.';
  if (G.potHole[s] === G.h) return 'One potion a hole.';
  if (P.one && !G.teams[s].roster[ri]) return 'Pick a player.';
  if (id === 'draught' && G.focus[s][ri] >= 0.95) return 'They\'re fresh.';
  if (id === 'glstill' && G.still[s]) return 'Already still.';
  if (id === 'gloil' && G.oil[s]) return 'Already oiled.';
  if (id === 'glmoss' && G.moss[s] && G.moss[s].h === G.h) return 'Somebody has had the tonic this hole.';
  return '';
}
// side gives potion id (to ri): its effect, the line and the record; the CPU's comes out of its bag here (yours, the page's)
function glPotionGive(s, id, ri, why) {
  const P = GL_POTIONS[id], T = G.teams[s], m = P.one ? T.roster[ri] : null;
  if (id === 'draught') G.focus[s][ri] = Math.min(1, G.focus[s][ri] + P.focus);
  if (id === 'glstill') G.still[s] = true;
  if (id === 'gloil') G.oil[s] = true;
  if (id === 'glmoss') G.moss[s] = { ri, h: G.h };
  if (G.bags[s]) { G.bags[s][id]--; if (G.bags[s][id] <= 0) delete G.bags[s][id]; }
  G.potHole[s] = G.h;
  G.pots.push({ side: s, id, ri: P.one ? ri : -1, h: G.h, why: why || '' });
  return `${T.name}: ${P.n}${m ? ` for ${m.n}` : ''}${why ? ` (${why})` : ''}.`;
}
// your potion now: '' when given (the page takes it out of your bag), or why not
function glPotion(id, ri) {
  if (!GD) return 'No game.';
  const s = GD.you, why = glPotionWhy(s, id, ri); if (why) return why;
  GD.msg = glPotionGive(s, id, ri) + (GD.sel ? ' ' + glAimMsg() : '');
  if (GD.sel) glSelFix();
  return '';
}
/* what a potion would be worth now, and to whom: [{ id, ri, v, why }] for the potions in bag (a CPU's, or the advice for
   yours). ri: who hits next. A draught for the most tired player; Still Water on a stroke that wins or halves for a
   nervy hitter; Moss Tonic for a poor scrambler in a bad lie; the Oil on a putt that matters */
function glPotionValues(s, bag, ri) {
  const out = [], T = G.teams[s], f = G.focus[s], H = glHoleNow(), b = G.ball[s], kind = glShotKind(H, s), p = glPressure(s), d = glDistOf(H, s), late = glLeft() <= 3;
  const tired = [0, 1, 2, 3].sort((a, c) => f[a] - f[c])[0];
  if (bag.draught && f[tired] < 0.55) out.push({ id: 'draught', ri: tired, v: (0.65 - f[tired]) * 12, why: `${T.roster[tired].n} is down to ${Math.round(f[tired] * 100)}% focus` });
  if (bag.glstill && p && T.roster[ri]) { const nrv = T.roster[ri].r.nrv; if (nrv < 0.75) out.push({ id: 'glstill', ri: -1, v: 3 + p * 2 * (1 - nrv), why: `${T.roster[ri].n} has a stroke to ${G.hole.st[s] + 1 < G.hole.st[1 - s] ? 'win' : 'halve'} the hole` }); }
  if (bag.glmoss && ['r', 'R', 'S', 'B', 'O'].includes(b.lie) && T.roster[ri] && T.roster[ri].r.scr < 0.65) out.push({ id: 'glmoss', ri, v: 2.5 + (0.65 - T.roster[ri].r.scr) * 6 + (late ? 1 : 0), why: `${T.roster[ri].n} is in the ${GL_TER[b.lie]}` });
  if (bag.gloil && kind === 'putt' && d >= 1.5 && d <= 10 && (p || late)) out.push({ id: 'gloil', ri: -1, v: 3 + (p ? 1.5 : 0) + (late ? 0.5 : 0), why: `a ${glYards(d)} putt that matters` });
  return out.filter(o => !glPotionWhy(s, o.id, o.ri)).sort((a, c) => c.v - a.v);
}
// your caddie's advice: the potion from your bag worth most now ({ id, ri, why }), or null
function glPotionAdvice(bag, ri) { if (!G || !GD) return null; const o = glPotionValues(GD.you, bag || {}, ri)[0]; return o && o.v >= GL_KIT.take[1] ? { id: o.id, ri: o.ri, why: o.why } : null; }
// the CPU's caddie before its stroke: a Squire now and then whatever comes first; a Knight or an Archmage what's worth
// it. Never yours: your bag is your own (a null bag here). Returns the line's words, or ''
function glCpuPotion(s, ri) {
  const bag = G.bags && G.bags[s]; if (!bag || !Object.keys(bag).length) return '';
  const vals = glPotionValues(s, bag, ri); if (!vals.length) return '';
  const sk = G.skill[s];
  if (!sk) return R() < GL_KIT.squire ? glPotionGive(s, vals[0].id, vals[0].ri, vals[0].why) : '';
  return vals[0].v >= GL_KIT.take[sk] ? glPotionGive(s, vals[0].id, vals[0].ri, vals[0].why) : '';
}
// what a side's potions put on its next stroke (glFxFor adds it): Still Water's nerve, the Oil on a putt
function glKitFx(s, f) {
  if (!G || !G.still) return;
  if (G.still[s]) f.nerve = 1;
  if (G.oil[s] && glShotKind(glHoleNow(), s) === 'putt') { f.putt *= GL_POTIONS.gloil.putt; f.read *= GL_POTIONS.gloil.read; }
}
// after side s's stroke: Still Water is spent, and the Oil on a putt
function glKitAfter(s, plan) { if (!G || !G.still) return; G.still[s] = false; if (plan.putt) G.oil[s] = false; }
