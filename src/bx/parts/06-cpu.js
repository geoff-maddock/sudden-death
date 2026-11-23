/* The Anvil Ring: the fighters' heads, and the corner's plans (issue #23, phase 1). A plan is how a fighter boxes a
   round: the range they want (a share of their jab's reach), how often they throw, their mix of punches, and how
   readily they defend. The corner picks one between rounds (07-bout.js); a fighter starts on their kind's style.
   Thinking: once per punch on its way, a fighter in its range may see it coming (more often with guile and a careful
   plan) and slip it or cover up. Otherwise every fraction of a second (quicker with guile) they pick where to move (in
   or out to the plan's range, circling once there, off the ropes) and whether to punch, cover or clinch. A slip opens
   a counter window, and a counterpuncher waits for one. Tired fighters back off and throw less; hurt ones tie up.
   G.skill[side] (0 to 2) sharpens the reading and the timing. 3 is the Lich (the Umbral's tier U, issue #99): as
   sharp as an Archmage, but it decides better (BX_LICH; test/realm_ring_lab.py measures it against an Archmage): it slips body shots (a guard doesn't stop them), digs to the body of a fighter who
   covers up, steps on the gas when the other fighter is hurt, tired or on the ropes, saves its breath for the hooks
   that count, ties up sooner when hurt, and in the corner picks the plan that beats the other fighter's.
   A fighter boxed by hand (09-hands.js) does none of the thinking but the footwork, and only while you don't steer. */
const BX_PLAN = {
  press:   { n: 'Press',     desc: 'Walk them down and stay in their face.',          range: .55, rate: 1.15, mix: { jab: .35, hook: .4, body: .25 }, def: .7 },
  counter: { n: 'Counter',   desc: 'Let them lead, slip it and punish the miss.',     range: .92, rate: .75, mix: { jab: .35, hook: .5, body: .15 }, def: 1.3, slip: .3, wait: true },
  body:    { n: 'Body work', desc: 'Dig to the body: it drains them, and pays late.', range: .62, rate: .85,  mix: { jab: .35, hook: .2, body: .45 }, def: .8 },
  away:    { n: 'Stay away', desc: 'Keep them on the end of the jab, and move.',      range: 1,   rate: .85, mix: { jab: .75, hook: .1, body: .15 }, def: 1.1 },
  cover:   { n: 'Cover up',  desc: 'Hands high, tie them up, get your legs back.',    range: .9,  rate: .35, mix: { jab: .6, hook: .2, body: .2 }, def: 1.6, guard: .5, clinch: true },
};
const BX_PLAN_IDS = Object.keys(BX_PLAN);

function bxThink(f, o, dt) {
  // (a press made by hand ages whatever the fighter is doing, so it never waits out a clinch: 09-hands.js)
  if (bxHand(f) && BXI.q && (BXI.qt += dt) > BX_BUFFER) BXI.q = null;
  if (f.a.k === 'down' || f.a.k === 'clinch' || f.a.k === 'stun') { f.mv = [0, 0]; return; }
  if (bxHand(f)) return bxHandThink(f, o, dt);
  const skill = G.skill ? G.skill[f.side] : 1, P = BX_PLAN[f.plan] || BX_PLAN.press, lich = skill >= 3;
  // a punch on its way, seen once
  if (bxPunching(o) && !o.a.done && o.a.id !== f.seen && !bxBusy(f)) {
    f.seen = o.a.id;
    if (bxDist(f, o) < bxRange(o, o.a.k) + .4) {
      const p = bxFx(f).sight ? .9 : clamp((.1 + f.r.gui * .018 + Math.min(skill, 2) * .06) * P.def, 0, lich ? BX_LICH.read : .7);
      if (R() < p) {
        const slip = lich ? !BX_PUNCH[o.a.k].head || R() < BX_LICH.slip : R() < clamp(.3 + f.r.gui * .03 + (P.slip || 0) - (BX_PUNCH[o.a.k].head ? 0 : .3), .05, .9);
        bxAct(f, slip ? 'slip' : 'guard'); return;
      }
    }
  }
  f.think -= dt; if (f.think > 0) return;
  f.think = Math.max(.1, .3 - f.r.gui * .006 - Math.min(skill, 2) * .03) * (.8 + R() * .4);
  const tired = bxFrac(f) < .22, hurt = f.hp < f.hpMax * .3, { d, want } = bxFeet(f, o);
  if (bxBusy(f)) return;
  if (bxCpuCast(f, o)) return;
  // cover up, tie up
  if ((P.clinch || hurt || tired) && d < BX_CLINCH.near && R() < (P.clinch ? .3 : .15) + (hurt ? (lich ? BX_LICH.tie : .2) : 0)) { bxClinch(f, o); return; }
  if (P.guard && R() < P.guard * (tired ? 1.3 : 1)) { bxAct(f, 'guard'); return; }
  // a punch in range, at the plan's rate; a counter window says now
  // (a power punch only from well inside its range: it is slow enough that a fighter backing off gets out of it)
  const can = BX_PUNCH_IDS.filter(k => d <= bxRange(f, k) * (BX_PUNCH[k].power ? .95 : 1) + .05 && f.sta >= BX_PUNCH[k].sta);
  if (!can.length) { if (f.a.k === 'guard' && R() < .5) bxAct(f, 'idle'); return; }
  // still coming in to the plan's range: mostly moving, not punching
  // (a Lich steps on the gas when the other fighter is open: hurt, stunned, tired or on the ropes)
  const open = lich && (o.a.k === 'stun' || o.a.k === 'grab' || bxFrac(o) < .25 || o.hp < o.hpMax * .35 || bxOnRopes(o));
  const rate = P.rate * (.5 + f.r.spd * .015) * (tired ? .4 : 1) * (f.ctr > 0 ? 2.5 : 1) * (P.wait && !f.ctr && !bxPunching(o) ? .5 : 1) * (d > want + .45 ? .35 : 1) * (open ? BX_LICH.gas : 1);
  if (R() < rate) { const w = {}; for (const k of can) w[k] = P.mix[k] * (o.a.k === 'guard' && k === 'body' ? 2 : 1) * (lich ? bxLichMix(f, o, k, open) : 1); bxAct(f, wpick(w)); }
  else if (R() < .22 * P.def) bxAct(f, 'guard');
}
/* the Lich (skill 3): its numbers, and its mix: to the body of a fighter covering up (the guard stops none of it) and
   not into the guard upstairs, the hook when they are open, and few hooks (the dearest punch) when short of breath,
   unless it's a counter */
const BX_LICH = { read: .75, slip: .65, tie: .35, gas: 1.3, guardBody: 2, guardHook: .4, openHook: 1.4, saveHook: .35, save: .35, patch: .7, potion: 2.5 };
function bxLichMix(f, o, k, open) {
  let m = 1;
  if (o.a.k === 'guard') m *= k === 'body' ? BX_LICH.guardBody : k === 'hook' ? BX_LICH.guardHook : 1;
  if (open && k === 'hook') m *= BX_LICH.openHook;
  if (k === 'hook' && !f.ctr && bxFrac(f) < BX_LICH.save) m *= BX_LICH.saveHook;
  return m;
}
/* the Lich's read of the other fighter, for its plan in the corner: a presser is countered, a fighter who stays away
   is walked down, and a counterpuncher or one covering up is worked to the body. null: nothing to read */
function bxLichRead(f, o) {
  const p = o.plan;
  if (p === 'press' && f.r.gui >= 5) return { plan: 'counter', why: 'they come forward: make them miss and pay' };
  if (p === 'away') return { plan: 'press', why: 'they keep away: cut the ring off' };
  if (p === 'counter' || p === 'cover') return { plan: 'body', why: p === 'cover' ? 'they cover up: dig under the guard' : 'they wait to counter: go to the body' };
  return null;
}
/* the footwork: f.mv toward the range the plan wants (further when tired). Returns { d, want } */
function bxFeet(f, o) {
  const P = BX_PLAN[f.plan] || BX_PLAN.press, d = bxDist(f, o), dx = (o.x - f.x) / (d || 1), dy = (o.y - f.y) / (d || 1);
  const want = bxRange(f, 'jab') * (bxFrac(f) < .22 ? 1.25 : P.range);
  // where to: in or out to the plan's range, circling once there (now and then the other way), off the ropes
  // (the ropes where they are now: a hex can move them in, 14-hexes.js; k is 1 otherwise)
  let mx = 0, my = 0;
  const edge = Math.max(Math.abs(f.x), Math.abs(f.y)), k = bxRope() / BX_RING.rope;
  if (d > want + .25) { mx = dx; my = dy; } else if (d < want - .25) { mx = -dx; my = -dy; }
  if (Math.abs(d - want) < .6 || edge > 6.2 * k || R() < .3) {
    if (!f.n2 || R() < .08) f.n2 = R() < .5 ? 1 : -1;
    // near the ropes they pivot off them toward the middle; otherwise, lined up front to back, they circle back side
    // by side (the ring is seen from the side)
    if (edge > 6.2 * k) f.n2 = Math.sign(dy * f.x - dx * f.y) || f.n2;
    else if (Math.abs(dy) > .45) f.n2 = Math.sign(dx * dy) || f.n2;
    mx += -dy * f.n2 * .7; my += dx * f.n2 * .7;
  }
  // away from the ropes and corners, toward the middle (harder once they are on them)
  if (edge > 4 * k) { const k = bxOnRopes(f) ? .18 : .08; mx -= f.x * k; my -= f.y * k; }
  f.mv = [mx, my];
  return { d, want };
}
/* the corner's call for the next round: { plan, patch, why }. Cover up when badly hurt (unless it's the last round and
   they are behind), press in the last round when behind on the cards, stay safe when well ahead, go for the finish when
   the other fighter is fading; otherwise their own style. A patch (the cut-man) when they're down to two thirds. Before
   the first round it is their style. */
function bxCornerCpu(f) {
  const o = G.F[1 - f.side], lich = !!G.skill && G.skill[f.side] >= 3, T = bxTotals(), lead =T.reduce((n, t) => n + Math.sign(f.side ? t[1] - t[0] : t[0] - t[1]), 0), last = G.round === G.rounds;
  let plan = f.style, why = 'it suits them';
  if (!G.cards.length) why = 'it suits them';
  else if (last && lead < 0) { plan = 'press'; why = 'behind on the cards, last round'; }
  else if (f.hp < f.hpMax * .45 || f.hpMax < 55) { plan = 'cover'; why = 'hurt: get the legs back'; }
  else if (last && lead >= 2) { plan = f.style === 'press' ? 'counter' : 'away'; why = 'ahead on the cards: stay safe'; }
  else if (o.hpMax < 60 || o.hp < 40) { plan = 'press'; why = 'the other fighter is fading'; }
  else if (lich) { const L = bxLichRead(f, o); if (L) { plan = L.plan; why = L.why; } }
  return { plan, patch: f.patches > 0 && f.hp < f.hpMax * (lich ? BX_LICH.patch : .67), why };
}
