/* Cinder Gridiron: the roar (issue #115, phase 3), a crowd meter that lifts a cast, as baseball's crowd does. Nothing
   here acts unless a game is started with opts.roar (true, or { on: [bool, bool] }: which sides have it; the Realm sends
   it): with G.roar unset every hook passes straight through and nothing draws from the seeded stream, so a game plays
   exactly as before.
   G.roar = { on: [bool, bool], v: [n, n], arm: [bool, bool], casts: [{ side, id, k: 'amp' | 'ult', play, why }],
   tally: { moment: times } (every moment the stands saw, for the checks and the lab) }, plain data in G, so the snapshot
   keeps it.
   - The stands fill each side's roar on its big moments (gfRoarAfter, after each play and kick): a gain of GF_ROAR.big
     yards or more, a sack, a turnover (an interception or a fumble taken; on downs a little), and a score (a touchdown,
     a field goal, a safety), up to GF_ROAR.max.
   - Mana and stamina still pay for every power and the ultimate (GF_MANA, GF_ULT_COST, GF_STAM). At GF_ROAR.cost the roar
     can lift a cast (gfCast, wrapped): an everyday power works half again as strongly (its effects on the play, c.amp:
     gfFx reads gfRoarAmp; a multiplier goes to its power of 1.5, an added number half again; flags and counts, such as a
     tackle broken or no break-ups, can't be lifted, so a power that is only those isn't), or the ultimate's zone lasts a
     play more. Situation powers aren't lifted. You call for it (gfRoarArm); the CPU spends it by its skill, and Auto
     powers does too, as a Knight. Each lift goes in the play's log line with its reason (♪, GD.notes).
   The meter is drawn under each side's mana. */
const GF_ROAR = { max: 6, cost: 3, big: 15, gain: 1, sack: 1, to: 2, downs: 1, td: 2, fg: 1, safety: 2, amp: 1.5 };
// the chance, by CPU skill (Squire, Knight, Archmage, Lich), that a side lifts a cast it can
const GF_ROARK = [.3, .55, .8, 1];
// what can't be lifted: a flag, a count, a chance
const GF_ROAR_FLAT = new Set(['breakN', 'sure', 'nolose', 'hurry', 'cStunP']);

function gfRoarNew(P) {
  if (!P) return null;
  return { on: P.on && Array.isArray(P.on) ? [!!P.on[0], !!P.on[1]] : [true, true], v: [0, 0], arm: [false, false], casts: [], tally: { gain: 0, sack: 0, to: 0, downs: 0, td: 0, fg: 0, safety: 0 } };
}
const gfRoarStart0 = gfStart;
gfStart = function (opts) { const g = gfRoarStart0.apply(this, arguments), R0 = gfRoarNew(opts && opts.roar); if (R0) G.roar = R0; return g; };

/* ---------- the stands ---------- */
function gfRoarAdd(s, k) {
  const Q = G.roar; if (!Q) return;
  Q.tally[k] = (Q.tally[k] || 0) + 1;
  if (Q.on[s]) Q.v[s] = Math.min(GF_ROAR.max, Q.v[s] + GF_ROAR[k]);
}
// after a play: off had the ball, r is how the play ended (and G.drive.end what came of it)
function gfRoarAfter(off, r) {
  const def = 1 - off, end = G.drive.end;
  if (r.what === 'sack') gfRoarAdd(def, 'sack');
  if (r.what === 'int' || (r.what === 'fum' && r.lost)) gfRoarAdd(def, 'to');
  else if (r.gain >= GF_ROAR.big) gfRoarAdd(off, 'gain');
  if (end === 'downs') gfRoarAdd(def, 'downs');
  if (end === 'td') gfRoarAdd(off, 'td');
  if (end === 'fumtd') gfRoarAdd(def, 'td');
  if (end === 'safety') gfRoarAdd(def, 'safety');
}
const gfRoarResult0 = gfResult;
gfResult = function (r) { const off = G.poss, out = gfRoarResult0.apply(this, arguments); if (G.roar) gfRoarAfter(off, r); return out; };
const gfRoarKick0 = gfKick;
gfKick = function () { const off = G.poss, out = gfRoarKick0.apply(this, arguments); if (G.roar && G.drive.end === 'fg') gfRoarAdd(off, 'fg'); return out; };

/* ---------- the lift ---------- */
// an everyday power's effects, half again as strong
function gfRoarAmp(fx) {
  const o = {};
  for (const k in fx) o[k] = GF_ROAR_FLAT.has(k) ? fx[k] : GF_FX_MUL.has(k) ? Math.pow(fx[k], GF_ROAR.amp) : fx[k] * GF_ROAR.amp;
  return o;
}
// whether a cast can be lifted: an ultimate with a zone, or an everyday power with something to lift (never a situation power)
function gfRoarLifts(o) {
  if (!o || o.sit) return false;
  if (o.ult) return !!(GF_ULT_BY[o.id] && GF_ULT_BY[o.id].zone);
  const P = GF_POW_BY[o.id]; return !!(P && P.fx && Object.keys(P.fx).some(k => !GF_ROAR_FLAT.has(k)));
}
// why side s lifts this cast ('' when it doesn't): you, when you called for it; the CPU and Auto powers by skill
function gfRoarWant(s) {
  const Q = G.roar; if (!Q || !Q.on[s] || Q.v[s] < GF_ROAR.cost) return '';
  const mine = GD.mode !== 'watch' && s === GD.you;
  if (mine && Q.arm[s]) return 'called for';
  if (mine && !GD.auto) return '';
  if (Q.v[s] >= GF_ROAR.max) return 'the stands are full';
  const sk = mine ? 1 : clamp((G.skill || [1, 1])[s] | 0, 0, 3);
  return R() < GF_ROARK[sk] ? `the roar at ${Q.v[s]}` : '';
}
const gfRoarCast0 = gfCast;
gfCast = function (side, o) {
  const c = gfRoarCast0.apply(this, arguments), Q = G.roar;
  if (!Q || !c || !gfRoarLifts(o)) return c;
  const why = gfRoarWant(side); if (!why) return c;
  if (o.ult) { const z = (G.zones || []).find(x => x.id === o.id); if (!z) return c; z.left++; }
  else c.amp = true;
  Q.v[side] -= GF_ROAR.cost; Q.arm[side] = false;
  Q.casts.push({ side, id: o.id, k: o.ult ? 'ult' : 'amp', play: G.plays, why });
  gfNote(side, 'roar', `♪ The roar lifts ${o.name}${o.ult ? ': its zone a play longer' : ''} (${why}).`);
  return c;
};

/* ---------- yours, from the page ---------- */
function gfRoarArm(on) {
  const Q = G && G.roar, s = GD ? GD.you : 0;
  if (!Q || !Q.on[s] || !GD || GD.mode === 'watch') return 'The roar is off.';
  if (on && Q.v[s] < GF_ROAR.cost) return `The roar needs ${GF_ROAR.cost} to lift a cast.`;
  Q.arm[s] = !!on; return '';
}

/* ---------- the meter, under each side's mana ---------- */
const gfRoarHud0 = gfDrawHud;
gfDrawHud = function (c) {
  gfRoarHud0.apply(this, arguments);
  const Q = G && G.roar; if (!Q || !G.mana) return;
  c.save();
  for (const s of [0, 1]) {
    if (!Q.on[s]) continue;
    const v = Q.v[s], up = v >= GF_ROAR.cost;
    for (let i = 0; i < GF_ROAR.max; i++) { const px = s ? 940 - 108.5 - i * 13 : 20 + 99.5 + i * 13; c.fillStyle = i < v ? (up ? '#ffd34a' : '#c99a4a') : 'rgba(255,211,74,.14)'; c.fillRect(px, 52, 9, 3); }
    if (Q.arm[s]) { c.strokeStyle = '#ffd34a'; c.lineWidth = 1; c.strokeRect(s ? 940 - 108.5 - (GF_ROAR.max - 1) * 13 - 2.5 : 20 + 97, 50.5, GF_ROAR.max * 13, 6); }
    txt(c, 'ROAR', s ? 940 - 62 : 20 + 62, 57, '800 8px "Alegreya Sans", system-ui, sans-serif', up ? 'rgba(255,211,74,.95)' : 'rgba(255,211,74,.6)', s ? 'right' : 'left');
  }
  c.restore();
};
