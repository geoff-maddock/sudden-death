/* The Anvil Ring: a bout (issue #23, phase 1). BD runs it in beats (BD.ph): the intro, each round on the clock, the
   count after a knockdown, the fighter rising, the corner between rounds, and the end. The round clock stops for the
   count. The same beats run on the page (bxTick, in real time) and headless (bxSimBout, as fast as it goes), seeded.
   At the bell three judges score the round (BX_JUDGES), each from what they like: Brass power punches, Tally activity
   and Slate defense, with a little of their own eye in it, so close rounds can split them.
   A knockdown: the count runs to BX_RULES.count; how soon the fighter beats it comes from their chin, the health they
   have left to get back and how often they've been down. Counted out is a knockout; the third knockdown stops it. Up
   in time, they have back about half their most, and lose a little of it.
   Between rounds both get their breath back and some health, the corner picks the next round's plan (06-cpu.js), and
   the cut-man may use a patch (BX_RULES.patches a bout).
   Your corner (phase 2): in 'call' and 'play' (BD.mode) the side BD.you is yours. Before the first round and between
   rounds the bout waits for your plan (G.wait holds what your corner would do, and why); bxCall gives it, bxPatch has
   the cut-man work (once a break). In 'play' you box the rounds too (09-hands.js). Switching to 'watch' mid-break
   takes your corner's advice; switching from it asks you.
   G (02-rules.js) carries the fighters too: G.F, the corners G.corners, G.skill, each round's work as the judges saw it
   (G.work), each round's stats (G.rstats), the plans (G.plans), the log, and the seconds boxed (G.secs). All plain JSON.
   BD is the page's side: { ph, t, acc, mode, headless, count, getUp }. */
const BX_JUDGES = [
  { n: 'Brass', likes: 'power punches', w: { thrown: 0,  landed: .9,  power: 1.5, def: .25, press: .12, clinch: -.4,  dmg: .03 }, noise: 1.3 },
  { n: 'Tally', likes: 'activity',      w: { thrown: .12, landed: 1.2, power: .7, def: .15, press: .25, clinch: -.6,  dmg: 0 }, noise: 1.3 },
  { n: 'Slate', likes: 'defense',       w: { thrown: 0,  landed: 1.1, power: .8, def: .6,  press: 0,   clinch: -.15, dmg: 0 }, noise: 1.3 },
];
const BX_BEAT = { intro: 1.6, corner: 4, count: .55, rise: .9 };
// the two corners a bout uses when the Realm doesn't send its own: red and blue
const BX_CLUBS = [
  { name: 'Cinderhold', short: 'CND', color: '#b8231e', light: '#ffd0a0' },
  { name: 'Visitors', short: 'VIS', color: '#2a5fb8', light: '#d6e6ff' },
];
let BD = null;
const BX_HOOK = { onOver: null, onPhase: null, onSnap: null, wantSnap: null, onEv: null };

/* a bout in the ring. opts: { fighters: [2 × { n, kind, num, r?, style? }], corners: [2 × { name, short, color, light }],
   mode: 'watch' | 'call' | 'play', you: 0 | 1, seed, skill: [0..2, 0..2], powers (false: none), headless } */
const BX_MODES = ['watch', 'call', 'play'];
function bxStart(opts) {
  const o = opts || {};
  bxSeed(o.seed); bxNewBout(o); BXE = [];
  G.corners = (o.corners || BX_CLUBS).map((c, i) => Object.assign({}, BX_CLUBS[i], c));
  G.F = o.fighters.map((p, s) => bxFighter(p, s));
  for (const f of G.F) if (!BX_PLAN[o.fighters[f.side].style]) f.style = f.plan = bxStyle(f.r, G.F[1 - f.side].r);
  Object.assign(G, { powers: o.powers !== false, aid: 0, down: null, skill: (o.skill || [1, 1]).slice(), work: [], rstats: [], plans: [G.F.map(f => f.plan)], log: [], secs: 0 });
  BD = { ph: 'intro', t: 0, acc: 0, mode: !o.headless && BX_MODES.includes(o.mode) ? o.mode : 'watch', you: o.you === 1 ? 1 : 0, headless: !!o.headless, count: 0, getUp: 0 };
  G.wait = null; bxInputClear();
  bxCornerSpots();
  if (bxYourCorner()) bxAsk();
  return G;
}
function bxPh(ph) { BD.ph = ph; BD.t = 0; if (!BD.headless && BX_HOOK.onPhase) BX_HOOK.onPhase(ph); }
function bxLog(msg, big) { G.log.push({ r: G.round, t: Math.round((BX_RULES.secs - G.clock) * 10) / 10, msg, big: !!big }); }
// both fighters back in their corners, facing out of them
function bxCornerSpots() { const [A, B] = G.F; Object.assign(A, { x: -6.8, y: -5.6, mv: [0, 0] }); Object.assign(B, { x: 6.8, y: 5.6, mv: [0, 0] }); for (const f of G.F) f.a = { k: 'idle', t: 0, dur: 0, id: ++G.aid }; }
const bxName = s => G.F[s].n;

// the page's clock: real seconds into beats
function bxTick(dt) {
  if (!BD || BD.ph === 'over') return;
  BD.acc += dt;
  while (BD.acc >= BX_DT && BD.ph !== 'over') { BD.acc -= BX_DT; bxBeat(BX_DT); }
}
function bxBeat(dt) {
  BD.t += dt;
  switch (BD.ph) {
    case 'intro': if (BD.t >= BX_BEAT.intro && !G.wait) { bxLog(`Round 1. ${bxName(0)} against ${bxName(1)}.`); bxPh('round'); } break;
    case 'round':
      bxStep(dt); G.secs += dt; G.clock = Math.max(0, G.clock - dt);
      bxDrain();
      if (G.down != null) bxDown();
      else if (G.clock <= 0) bxRoundEnd();
      break;
    case 'kd':
      BD.count = Math.min(BX_RULES.count, Math.floor(BD.t / BX_BEAT.count) + 1);
      if (BD.t >= BD.getUp * BX_BEAT.count) {
        if (BD.getUp >= BX_RULES.count) { bxCountOut(G.down); bxLog(`${bxName(G.down)} is counted out!`, true); bxOver(); }
        else bxRise();
      }
      break;
    case 'rise': if (BD.t >= BX_BEAT.rise) bxPh('round'); break;
    case 'corner': if (BD.t >= BX_BEAT.corner && !G.wait) { bxLog(`Round ${G.round}.`); bxPh('round'); } break;
  }
}
// what happened this step, for the log (the page reads BXE itself first, for its words)
function bxDrain() {
  for (const e of BXE) {
    if (e.seen) continue; e.seen = true;
    const a = e.side >= 0 ? bxName(e.side) : '', b = e.side >= 0 ? bxName(1 - e.side) : '';
    if (e.k === 'land' && e.ctr) bxLog(`${a} slips and counters with a ${BX_PUNCH[e.p].n}!`, e.n >= 8);
    else if (e.k === 'land' && e.n >= 9) bxLog(`${a} lands a big ${BX_PUNCH[e.p].n}.`);
    else if (e.k === 'stun') bxLog(`${a} is hurt!`, true);
    else if (e.k === 'clinch') bxLog(`${a} ties ${b} up.`);
  }
  if (BD.headless) BXE.length = 0;
}
function bxDown() {
  const s = G.down, f = G.F[s], o = G.F[1 - s]; bxInputClear();
  if (o.a.k !== 'down') o.a = { k: 'idle', t: 0, dur: 0, id: ++G.aid };
  o.mv = [0, 0];
  bxLog(`${f.n} is down!`, true);
  if (bxKnockdown(s) === 'tko') { bxLog(`Three knockdowns: the referee stops it.`, true); bxOver(); return; }
  const n = G.kd[s], score = f.r.chin * .5 + f.hpMax / 25 - (n - 1) * 2.6 + gauss() * 1.6;
  BD.getUp = clamp(Math.round(10.5 - score), 2, BX_RULES.count); BD.count = 1;
  bxPh('kd');
}
function bxRise() {
  const s = G.down, f = G.F[s], o = G.F[1 - s];
  f.hp = Math.round(f.hpMax * .55); f.hpMax = Math.max(35, f.hpMax - 6); f.a = { k: 'idle', t: 0, dur: 0, id: ++G.aid };
  bxLog(`${f.n} is up at ${BD.getUp}.`);
  // the other fighter to a neutral corner's distance, and on again
  const dx = o.x - f.x, dy = o.y - f.y, d = hyp(dx, dy) || 1;
  o.x = clamp(f.x + dx / d * 3.2, -BX_RING.rope, BX_RING.rope); o.y = clamp(f.y + dy / d * 3.2, -BX_RING.rope, BX_RING.rope);
  G.down = null;
  bxPh('rise');
}
// the round's work as each judge sees it: side 0's less side 1's
function bxWork() {
  const [a, b] = G.F.map(f => f.rs);
  return BX_JUDGES.map(J => { const v = s => Object.keys(J.w).reduce((n, k) => n + J.w[k] * s[k], 0); return Math.round((v(a) - v(b) + gauss() * J.noise) * 10) / 10; });
}
function bxRoundEnd() {
  const work = bxWork(), n = G.round; bxInputClear();
  for (const f of G.F) f.fx = [];
  G.work.push(work); G.rstats.push(G.F.map(f => Object.assign({}, f.rs, { dmg: Math.round(f.rs.dmg) })));
  for (const f of G.F) { for (const k in f.rs) f.bs[k] += f.rs[k]; f.rs = bxStatsZero(); }
  const r = bxBell(work), sc = G.cards[G.cards.length - 1];
  bxLog(`End of round ${n}: ${sc.map((s, j) => `${BX_JUDGES[j].n} ${s[0]}-${s[1]}`).join(', ')}.`);
  if (r === 'over') { bxLog(bxVerdict(), true); bxOver(); } else bxCorner();
}
function bxCorner() {
  for (const f of G.F) {
    f.hp = Math.min(f.hpMax, f.hp + (f.hpMax - f.hp) * .35); f.sta = f.sta + (f.staMax - f.sta) * .75; f.ctr = 0;
    if (bxYourCorner() && f.side === BD.you) { f.hp = Math.round(f.hp); f.sta = Math.round(f.sta); continue; }
    const c = bxCornerCpu(f); f.plan = c.plan;
    if (c.patch && f.patches > 0) { f.patches--; f.patched = G.round; f.hpMax = Math.min(BX_HP, f.hpMax + 5); f.hp = Math.min(f.hpMax, f.hp + 18); bxLog(`The cut-man works on ${f.n}.`); }
    f.hp = Math.round(f.hp); f.sta = Math.round(f.sta);
  }
  G.plans.push(G.F.map(f => f.plan));
  bxCornerSpots();
  bxPh('corner');
  if (bxYourCorner()) bxAsk();
  bxSnapNow();
}
// your corner: whether you have one, asking you (what your corner would do goes in G.wait), your plan, the cut-man
const bxYourCorner = () => !!BD && BD.mode !== 'watch' && !BD.headless;
function bxAsk() {
  const f = G.F[BD.you], c = bxCornerCpu(f);
  G.wait = { plan: c.plan, patch: c.patch && G.cards.length > 0 && f.patched !== G.round, why: c.why };
  G.plans[G.plans.length - 1][BD.you] = f.plan;
  if (BX_HOOK.onPhase) BX_HOOK.onPhase(BD.ph);
}
function bxCall(plan) {
  if (!G || !G.wait || !BX_PLAN[plan]) return false;
  const f = G.F[BD.you]; f.plan = plan; G.plans[G.plans.length - 1][BD.you] = plan; G.wait = null; G.called = BD.ph + G.round;
  // a moment, then the bell
  BD.t = Math.max(BD.t, (BD.ph === 'intro' ? BX_BEAT.intro : BX_BEAT.corner) - .8);
  if (BX_HOOK.onPhase) BX_HOOK.onPhase(BD.ph);
  return true;
}
// the cut-man works on your fighter: between rounds, once a break, while patches last
function bxPatch() {
  const f = G && G.wait && BD.ph === 'corner' ? G.F[BD.you] : null;
  if (!f || f.patches <= 0 || f.patched === G.round) return false;
  f.patches--; f.patched = G.round; f.hpMax = Math.min(BX_HP, f.hpMax + 5); f.hp = Math.round(Math.min(f.hpMax, f.hp + 18));
  bxLog(`The cut-man works on ${f.n}.`); G.wait.patch = false;
  if (BX_HOOK.onPhase) BX_HOOK.onPhase(BD.ph);
  return true;
}
// who boxes and corners your side, without starting over
function bxSetMode(m) {
  if (!BD || !BX_MODES.includes(m) || BD.headless) return;
  BD.mode = m; if (CD) CD.mode = m; bxInputClear();
  if (m === 'watch' && G.wait) { const w = G.wait; if (w.patch) bxPatch(); bxCall(w.plan); }
  // (asked once a break: not again if you've already called it)
  else if (m !== 'watch' && !G.wait && (BD.ph === 'intro' || BD.ph === 'corner') && G.called !== BD.ph + G.round) bxAsk();
}
function bxOver() { for (const f of G.F) { for (const k in f.rs) f.bs[k] += f.rs[k]; f.rs = bxStatsZero(); f.bs.dmg = Math.round(f.bs.dmg); } BD.ph = 'over'; BD.t = 0; if (CD && G.card && !BD.headless) bxCardRecord(); if (CD && G.card && !BD.headless && !CD.result) bxSnapNow(); if (!BD.headless && BX_HOOK.onOver) BX_HOOK.onOver(bxSummary()); }
// the result in words: "Grub wins by knockout in round 2", "A split decision for Vex", "A draw"
function bxVerdict(over) {
  const v = over || G.over; if (!v) return '';
  const w = v.win == null ? '' : G.F[v.win].n;
  if (v.how === 'ko') return `${w} wins by knockout in round ${v.round}.`;
  if (v.how === 'tko') return `${w} wins by stoppage in round ${v.round}.`;
  if (v.win == null) return 'A draw on the cards.';
  return `${v.kind[0].toUpperCase() + v.kind.slice(1)} decision for ${w}.`;
}
function bxSummary() {
  return { over: Object.assign({}, G.over), verdict: bxVerdict(), cards: JSON.parse(JSON.stringify(G.cards)), totals: bxTotals(), work: G.work.slice(),
    rounds: JSON.parse(JSON.stringify(G.rstats)), stats: G.F.map(f => Object.assign({}, f.bs)), kd: G.kd.slice(), plans: JSON.parse(JSON.stringify(G.plans)),
    fighters: G.F.map(f => ({ n: f.n, kind: f.kind, style: f.style, hp: Math.round(f.hp), hpMax: Math.round(f.hpMax) })), secs: Math.round(G.secs * 10) / 10, log: G.log.slice() };
}
/* a whole bout headless and silent, seeded; the bout on the page (if any) is left as it was */
function bxSimBout(opts) {
  const keep = [G, BD, BXE, bxRand];
  try {
    bxStart(Object.assign({}, opts, { headless: true }));
    for (let n = 0; BD.ph !== 'over' && n < 400000; n++) bxBeat(BX_DT);
    return bxSummary();
  } finally { [G, BD, BXE, bxRand] = keep; }
}
