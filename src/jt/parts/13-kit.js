/* The Tilting Lists: gear and potions (issue #117, phase 7), by #61's conventions; the Realm's side is w154-listskit.js.
   Gear: a rider may wear one piece. A roster member sent with { gear: { id, name, fx } } keeps its name (gear) and the
   effects the engine reads (gx: fx without r; fx.r is laid on the ratings by the Realm before the engine sees them).
   gx is in the powers' vocabulary (JT_FX0, 12-powers.js) and joins the rider's fx each course they ride (jtRideFx):
   sway (the tip's spread, ×), speed (×) and wind (what a course costs the mount, ×), hold (the seat, +), nerve (the
   share of the pressure taken off), kite (a strike on their angled shield breaks less often, ×) and helmTurn (a strike
   on their helm breaks less often, ×). A squire's gear does nothing at the tilt: only the rider rides.
   Potions (JT_POTIONS): one a side a course (G.potCourse), before it. A match has potions when started with bags:
   G.bags = [bag or null, ...] by side: a null bag is kept by the page (the Realm keeps yours and takes each one out as
   you give it), and a bag here ({ id: n }) is the CPU's, given at its skill before its courses (jtCpuPotions, after
   the corner: between courses, as the squires work). A match started without bags has no potions (the exhibition, the
   bare engine), and nothing here acts or draws from the stream. Every use goes in G.pots ({ side, id, heat, course,
   tilt, at, why }). What each does, all plain data in G:
   draught (the Stamina Draught): the mount gets JT_POTIONS.draught.wind of its wind back; jttonic (a Steadying Tonic):
   no pressure on the rider this course (G.tonic, the course's number); jtliniment (Ruddock's Liniment): the lance arm
   gets JT_POTIONS.jtliniment.arm of its strength back; jtoil (Squire's Oil): the lance hardly ever glances this course
   (its chance to break × JT_POTIONS.jtoil.brk; measured: a lance that always broke decided matches) (G.oil, the course's
   number). */
const JT_POTIONS = {
  draught: { n: 'Stamina Draught', wind: .35, desc: 'The mount gets back over a third of its wind.' },
  jttonic: { n: 'Steadying Tonic', desc: 'For a course that weighs on your rider (the last course of a heat when behind, or the tilt for the crown): no pressure on them this course.' },
  jtliniment: { n: 'Ruddock\'s Liniment', arm: .4, desc: 'Rubbed into the lance arm: two fifths of its strength back.' },
  jtoil: { n: 'Squire\'s Oil', brk: 1.3, desc: 'Oil on the tip: your lance hardly ever glances this course (a third likelier to break).' },
};
// a CPU gives a potion worth this much (by skill: a Squire, now and then, whatever comes first)
const JT_KIT = { take: [99, 2.5, 2], squire: .25 };
const JT_W7 = { rosterOne: jtRosterOne, start: jtStart, rideFx: jtRideFx, corners: jtCornersDue };
function jtGx(fx) { if (!fx || typeof fx !== 'object') return null; const o = JSON.parse(JSON.stringify(fx)); delete o.r; for (const k in o) if (!jtOwn(JT_FX0, k) || !Number.isFinite(+o[k])) delete o[k]; return Object.keys(o).length ? o : null; }
jtRosterOne = function (p) { const m = JT_W7.rosterOne(p); const gx = p && p.gear ? jtGx(p.gear.fx) : null; if (gx) m.gx = gx; else delete m.gx; return m; };
jtStart = function (opts) {
  const g = JT_W7.start(opts), o = opts || {};
  if (Array.isArray(o.bags) && !G.yard) Object.assign(G, { bags: [0, 1].map(s => o.bags[s] && typeof o.bags[s] === 'object' ? Object.assign({}, o.bags[s]) : null), pots: [], potCourse: [-1, -1], potAsk: [-1, -1], tonic: [-1, -1], oil: [-1, -1] });
  return g;
};
const jtGxOf = (s, ri) => { const m = G && G.teams && ri != null ? G.teams[s].roster[ri] : null; return (m && m.gx) || null; };
// the rider's fx: the powers', then their gear's and the course's potions (null when there is nothing at all)
jtRideFx = function (s) {
  const pf = JT_W7.rideFx(s), gx = jtGxOf(s, (jtRiders() || [])[s]), tonic = !!(G.tonic && G.tonic[s] === G.n), oil = !!(G.oil && G.oil[s] === G.n);
  if (!gx && !tonic && !oil) return pf;
  const f = pf || Object.assign({}, JT_FX0);
  if (gx) for (const k in gx) { if (JT_FX_MUL.has(k)) f[k] *= gx[k]; else if (JT_FX_ADD.has(k)) f[k] += gx[k]; else f[k] = Math.max(f[k], gx[k]); }
  if (tonic) f.nerve = 1;
  if (oil) f.brk *= JT_POTIONS.jtoil.brk;
  return f;
};

/* ---------- potions ---------- */
function jtPotionWhy(s, id) {
  if (!jtOwn(JT_POTIONS, id)) return 'No such potion.';
  if (!G || !G.teams || !G.bags) return 'No potions in this match.';
  if (G.over || !jtRiders()) return 'The match is over.';
  if (G.potCourse[s] === G.n) return 'One potion a course.';
  if (id === 'draught' && G.wind[s] >= .95) return 'The mount has its wind.';
  if (id === 'jtliniment' && jtSq('arm', s, 1) >= .95) return 'The lance arm is fresh.';
  if (id === 'jttonic' && !jtPressure(s)) return 'Nothing weighs on them this course.';
  if (id === 'jttonic' && G.tonic[s] === G.n) return 'Already steady.';
  return '';
}
function jtPotionGive(s, id, why) {
  const P = JT_POTIONS[id], T = G.teams[s];
  if (id === 'draught') G.wind[s] = Math.min(1, +(G.wind[s] + P.wind).toFixed(3));
  if (id === 'jtliniment') G.arm[s] = Math.min(1, +(G.arm[s] + P.arm).toFixed(3));
  if (id === 'jttonic') G.tonic[s] = G.n;
  if (id === 'jtoil') G.oil[s] = G.n;
  if (G.bags[s]) { G.bags[s][id]--; if (G.bags[s][id] <= 0) delete G.bags[s][id]; }
  G.potCourse[s] = G.n;
  G.pots.push({ side: s, id, heat: G.heat, course: G.course, tilt: jtInTilt(), at: G.n, why: why || '' });
  return `${T.name}: ${P.n}${why ? ` (${why})` : ''}.`;
}
// your potion now, in your plan beat: '' when given (the page takes it out of your bag), or why not
function jtPotion(id) {
  if (!GP || !G || !G.teams) return 'No match.';
  if (GP.ph !== 'plan' || !jtCalls(GP.you)) return 'Only before your course, in your plan.';
  const s = GP.you, why = jtPotionWhy(s, id); if (why) return why;
  GP.msg = jtPotionGive(s, id); jtPicked();
  return '';
}
/* what each potion in bag would be worth to side s now: [{ id, v, why }], best first. A draught when the mount is
   blown, the liniment when the arm is tired, the tonic for a nervy rider when the course weighs on them, the oil for the
   course that counts (the heat's last when not ahead, the match's last, the tilt) */
function jtPotionValues(s, bag) {
  const out = [], ri = (jtRiders() || [])[s], m = ri != null ? G.teams[s].roster[ri] : null, w = G.wind[s], arm = jtSq('arm', s, 1), Q = jtSituation(s), nerve = (m && m.rs && m.rs.nerve) ?? .5;
  if (bag.draught && w < .6) out.push({ id: 'draught', v: (.7 - w) * 10 + (Q.after ? .5 : 0), why: `the mount's wind is down to ${Math.round(w * 100)}%` });
  if (bag.jtliniment && arm < .7) out.push({ id: 'jtliniment', v: (.8 - arm) * 10, why: `the lance arm is down to ${Math.round(arm * 100)}%` });
  if (bag.jttonic && jtPressure(s) && nerve < .75) out.push({ id: 'jttonic', v: 3 + 2 * (1 - clamp(nerve, 0, 1)), why: `${m ? m.n : 'their rider'} rides with the match on it` });
  if (bag.jtoil && (Q.tilt || Q.lastOfMatch || (Q.last && Q.lead <= 0))) out.push({ id: 'jtoil', v: 2.6 + (Q.tilt ? 1 : 0), why: Q.tilt ? 'the tilt for the crown' : Q.lastOfMatch ? 'the last course of the match' : 'the heat\'s last course, and not ahead' });
  return out.filter(o => !jtPotionWhy(s, o.id)).sort((a, c) => c.v - a.v);
}
// your squire's advice for your bag (null: nothing worth it)
function jtPotionAdvice(bag) { if (!G || !GP || !G.bags) return null; const o = jtPotionValues(GP.you, bag || {})[0]; return o && o.v >= JT_KIT.take[1] ? { id: o.id, why: o.why } : null; }
// the CPU before a course, once a course a side (G.potAsk). Never yours: your bag is your own (a null bag here).
// Returns the words, or ''
function jtCpuPotion(s) {
  const bag = G.bags && G.bags[s]; if (!bag || !Object.keys(bag).length || G.over || G.potAsk[s] === G.n) return '';
  G.potAsk[s] = G.n;
  const vals = jtPotionValues(s, bag); if (!vals.length) return '';
  const sk = clamp(G.skill[s] | 0, 0, 2);
  if (!sk) return R() < JT_KIT.squire ? jtPotionGive(s, vals[0].id, vals[0].why) : '';
  return vals[0].v >= JT_KIT.take[sk] ? jtPotionGive(s, vals[0].id, vals[0].why) : '';
}
// after the corner, before every course: the CPU's potions
jtCornersDue = function (skip) {
  JT_W7.corners(skip);
  if (G && G.teams && G.bags && !G.over && jtRiders()) for (const s of [0, 1]) jtCpuPotion(s);
};
