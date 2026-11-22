/* u7: the Umbral's feel (issue #99, phase 8). Loads after u6-rewards.js and the sports' parts; changes earlier parts
   only by reassignment (saved originals carry the wWU7 prefix).

   Sound, from Sudden Death's own tone and noise, following your Sound effects setting: crossing the portal (a falling
   hum, or a rising one coming home), resting by a lantern (a low chime), a piece of the Seal won (three bells), the
   Seal forged (a long chord). The scene in the Coliseum has its own (u1).
   The dark world talks to itself as you walk it: now and then a line of its own (W_UMB7.world), as the light
   world's regions have theirs.

   W_UMB7, wUmbSound
   Wraps: wUmbCross (wWU7Cross: the hum), W_ON_END.nadir (wWU7OnNadir: the bells), wUmbSeal (wWU7Seal: the chord),
   wAmbient (wWU7Ambient: the dark world's lines), WGND.d and WOBJ.J (wWU7GndD, wWU7ObjJ: a dark ground's field and stands
   darkened). The lantern's chime is called from u2's rest. */

const W_UMB7 = {
  world: ['Something keeps pace with you on the other side of the hedge. There is no hedge.', 'A bird sings one note, backwards.',
    'Your footprints fill in behind you, slowly, as if the ground forgets.', 'A signpost points the way you came, whichever way you go.',
    'Far off, a crowd roars for a goal nobody scored.', 'The sky is the colour of a bruise healing.'],
  every: 13, p: .3,
};
function wUmbSound(k) {
  if (LAB || !SET.sfx) return;
  try {
    if (k === 'cross') { tone(330, .9, 'sine', .05, -120); tone(165, 1.1, 'triangle', .04, -60, .1); noise(.6, .05, 400, 1, .05); }
    else if (k === 'home') { tone(220, .7, 'sine', .05, 200); tone(440, .6, 'sine', .04, 200, .2); }
    else if (k === 'rest') { tone(196, .9, 'sine', .04, 0); tone(294, 1, 'sine', .03, 0, .25); }
    else if (k === 'piece') { tone(523, .3, 'triangle', .05, 0); tone(659, .3, 'triangle', .05, 0, .18); tone(784, .6, 'triangle', .05, 0, .36); }
    else if (k === 'seal') { for (const [f, d] of [[262, 0], [330, .1], [392, .2], [523, .35]]) tone(f, 2.2, 'sine', .04, 0, d); }
  } catch (e) { console.error(e); }
}
const wWU7Cross = wUmbCross;
wUmbCross = function () { const r = wWU7Cross.apply(this, arguments); if (r) wUmbSound(wUmbDark() ? 'cross' : 'home'); return r; };
const wWU7OnNadir = W_ON_END.nadir;
W_ON_END.nadir = function (r, ref) {
  const U = wUmb(), n0 = U ? U.pieces.length : 0, out = wWU7OnNadir.apply(this, arguments);
  if (U && U.pieces.length > n0) wUmbSound('piece');
  return out;
};
const wWU7Seal = wUmbSeal;
wUmbSeal = function () { const r = wWU7Seal.apply(this, arguments); wUmbSound('seal'); return r; };
const wWU7Ambient = wAmbient;
wAmbient = function (m, preReg) {
  const r = wWU7Ambient.apply(this, arguments);
  if (!LAB && m && m.umbral && m.kind === 'world' && regionAt(WG.x, WG.y) === preReg && WG.step % W_UMB7.every === 0 && Math.random() < W_UMB7.p) wLog(pick(W_UMB7.world), 'd');
  return r;
};

// a dark ground's field and stands are painted in the light's colours (w21): on this side they are drained and darkened
const wUmbDim = c => { c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = '#6e6080'; c.fillRect(0, 0, 32, 32); c.restore(); };
const wWU7GndD = WGND.d, wWU7ObjJ = WOBJ.J;
WGND.d = function (c, P, r, e) { wWU7GndD.apply(this, arguments); if (e && e.m && e.m.umbral && e.m.field) wUmbDim(c); };
WOBJ.J = function (c, P, r, e) { wWU7ObjJ.apply(this, arguments); if (e && e.m && e.m.umbral) wUmbDim(c); };

