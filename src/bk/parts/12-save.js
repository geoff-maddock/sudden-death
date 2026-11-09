/* The Charter Court: save points (issue #77, phase 5). At each stoppage (a dead ball, a break between periods, a
   timeout, and the start of free throws) BK_HOOK.onSnap hears a snapshot of the game when wantSnap says so: { G, L, GD } as plain JSON
   (GD trimmed to what play needs to go on from there). bkResume puts one back at the same beat, on fresh random
   numbers and with no keys held. */
const BK_SNAP_AT = ['dead', 'break', 'ft', 'timeout'];
const BK_GD_KEEP = ['ph', 't', 'mode', 'you', 'msg', 'walk', 'ft', 'half', 'keep', 'notes', 'toAsk', 'toWas'];
function bkSnapshot() {
  const gd = {}; for (const k of BK_GD_KEEP) if (GD[k] !== undefined) gd[k] = GD[k];
  return JSON.parse(JSON.stringify({ G, L, GD: gd }));
}
function bkSnapHook(ph) {
  if (!BK_SNAP_AT.includes(ph) || !BK_HOOK.onSnap || (BK_HOOK.wantSnap && !BK_HOOK.wantSnap())) return;
  try { BK_HOOK.onSnap(bkSnapshot()); } catch (e) { console.error(e); }
}
function bkResume(sn) {
  const s = JSON.parse(JSON.stringify(sn));
  bkSeed(null);
  G = s.G; L = s.L;
  GD = Object.assign({ acc: 0, meter: null, big: null, net: null, rel: null }, s.GD);
  bkInputClear();
  return G;
}
