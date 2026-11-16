/* Black Ice: save points (issue #83, phase 6). At each whistle and each break between periods HK_HOOK.onSnap hears a
   snapshot of the game when wantSnap says so: { G, L, GD } as plain JSON (GD trimmed to what play needs to go on from
   there). hkResume puts one back at the same beat, on fresh random numbers and with no keys held. There is no save
   point inside the shootout: a game left there comes back at the last whistle before it. */
const HK_SNAP_AT = ['dead', 'break'];
const HK_GD_KEEP = ['ph', 't', 'mode', 'you', 'auto', 'msg', 'fo', 'set', 'next', 'deadT', 'delay', 'noChange', 'drew', 'autoPow', 'potUsed'];
function hkSnapshot() {
  const gd = {}; for (const k of HK_GD_KEEP) if (GD[k] !== undefined) gd[k] = GD[k];
  return JSON.parse(JSON.stringify({ G, L, GD: gd }));
}
function hkSnapHook(ph) {
  if (!HK_SNAP_AT.includes(ph) || !HK_HOOK.onSnap || (HK_HOOK.wantSnap && !HK_HOOK.wantSnap())) return;
  try { HK_HOOK.onSnap(hkSnapshot()); } catch (e) { console.error(e); }
}
function hkResume(sn) {
  const s = JSON.parse(JSON.stringify(sn));
  hkSeed(null);
  G = s.G; L = s.L;
  // (a save point from before powers: none of them, so play goes on as it was)
  if (!G.mana) Object.assign(G, { powers: false, powOn: [false, false], mana: [0, 0], spirit: [0, 0], fxs: [], marks: [], ultUsed: [false, false], sitUsed: [{}, {}], casts: [] });
  if (!G.bags) Object.assign(G, { bags: [null, null], pots: [], anti: [0, 0], cider: [null, null] });
  hkFxNow();
  GD = Object.assign({ acc: 0, autoPow: true, meter: null, rel: null, press: null, big: null, net: null, so: null, delay: null, noChange: -1 }, s.GD);
  hkInputClear();
  return G;
}
