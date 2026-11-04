/* The Anvil Ring: boxing by hand (issue #23, phase 2). In 'play' mode your fighter (BD.you) throws what you press: a
   jab, a hook, a body shot, a slip or a clinch; holding the guard keeps it up. A press while they're still busy waits
   up to BX_BUFFER seconds for them to be free, so a quick one-two comes out as two punches. Steering moves them (screen
   right is the ring's +x, up is the far side); let go and their feet follow their plan, as a CPU fighter's would, so
   on a phone you can box with the buttons alone. Their instincts: with your hands free (nothing pressed, nothing
   waiting) they slip or cover up against a punch they see coming, BX_INSTINCT of the times a CPU fighter of theirs
   would. Pressing the keys yourself does better: it's every time you get it right.
   A press counts only in a round (a pad press in the corner is dropped), and ages from the moment it's made, even while
   your fighter is clinched, stunned or down (bxThink). The input is cleared at the bell, at a knockdown, at the start
   of a bout and when the mode changes, so nothing pressed before carries into what comes next.
   BXI is the page's input, not saved: { steer: [x, y], guard, q (the press waiting), qt (how long it has waited) }. */
const BX_BUFFER = .5, BX_INSTINCT = .6;
const BXI = { steer: [0, 0], guard: false, q: null, qt: 0 };
const bxHand = f => !!BD && BD.mode === 'play' && !BD.headless && f.side === BD.you;
// (and the powers: 'sp' the special, 'ult' the ultimate; 11-powers.js)
const BX_ACTS = ['jab', 'hook', 'body', 'slip', 'clinch', 'sp', 'ult'];
// the page's keys and buttons: { steer: [x, y], guard: true | false, act: 'jab' | 'hook' | 'body' | 'slip' | 'clinch' }
function bxInput(o) {
  if (o.steer) BXI.steer = [clamp(+o.steer[0] || 0, -1, 1), clamp(+o.steer[1] || 0, -1, 1)];
  if (o.guard != null) BXI.guard = !!o.guard;
  if (BX_ACTS.includes(o.act) && BD && (BD.ph === 'round' || BD.ph === 'rise')) { BXI.q = o.act; BXI.qt = 0; }
}
function bxInputClear() { BXI.steer = [0, 0]; BXI.guard = false; BXI.q = null; BXI.qt = 0; }
function bxHandThink(f, o, dt) {
  if (BXI.steer[0] || BXI.steer[1]) f.mv = BXI.steer.slice(); else bxFeet(f, o);
  if (bxBusy(f)) return;
  if (BXI.q) { const k = BXI.q; BXI.q = null; if (k === 'clinch') bxClinch(f, o); else if (k === 'sp' || k === 'ult') bxCast(f, k); else bxAct(f, k); return; }
  if (BXI.guard) { bxAct(f, 'guard'); return; }
  if (bxPunching(o) && !o.a.done && o.a.id !== f.seen) {
    f.seen = o.a.id;
    const P = BX_PLAN[f.plan] || BX_PLAN.press, skill = G.skill ? G.skill[f.side] : 1;
    if (bxDist(f, o) < bxRange(o, o.a.k) + .4 && R() < (bxFx(f).sight ? .9 : BX_INSTINCT * clamp((.1 + f.r.gui * .018 + skill * .06) * P.def, 0, .7)))
      bxAct(f, R() < clamp(.3 + f.r.gui * .03 + (P.slip || 0) - (BX_PUNCH[o.a.k].head ? 0 : .3), .05, .9) ? 'slip' : 'guard');
  }
}
