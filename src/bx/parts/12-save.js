/* The Anvil Ring: save points (issue #23, phase 5). A bout (and the card it is on) can be kept and put back at three
   moments: the start of a bout on a card, each corner between rounds, and the end of a bout on a card (between bouts).
   At each one, when the page wants it (BX_HOOK.wantSnap), BX_HOOK.onSnap hears a snapshot: { G, BD (its plain parts),
   CD }, plain JSON. bxResume puts one back: the same bout at the same beat (waiting for your call if it was), with
   fresh random numbers and no input held. Mid-round there is no save point: leaving then waits for the next corner. */
function bxSnapshot() {
  return JSON.parse(JSON.stringify({ G, BD: { ph: BD.ph, t: BD.t, mode: BD.mode, you: BD.you, count: BD.count, getUp: BD.getUp }, CD }));
}
function bxResume(sn) {
  const s = JSON.parse(JSON.stringify(sn));
  G = s.G; CD = s.CD || null; BD = Object.assign({ acc: 0, headless: false }, s.BD); BXE = [];
  bxSeed(null); bxInputClear();
  return G;
}
function bxSnapNow() {
  if (!BD || BD.headless || !BX_HOOK.onSnap || (BX_HOOK.wantSnap && !BX_HOOK.wantSnap())) return;
  BX_HOOK.onSnap(bxSnapshot());
}
