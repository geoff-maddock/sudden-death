/* ================= the Realm's powers on the diamond: situation powers and the crowd (issue #115, phase 2) ================= */
// Nothing here acts in the standalone game: it only wakes when a game's rules carry bdpow (the Realm sends it), and
// with G.bdp null every hook below passes straight through, so a seeded game plays exactly as before.
// rules.bdpow = { on: [bool, bool] (which sides have them; both when left out), sit, crowd (each on unless false) }
// G.bdp = { on, sitOn, crowdOn, crowd: [n, n], arm: [bool, bool], used: [{ k: true }, …], fc: side | null,
//           amp: { id, n } | null, ultAmp: [{ id, s, why }], casts: [{ side, k, id, inning, half, why }],
//           tally: { moment: times } (every moment the stands saw, for the checks and the lab) }, plain data.
// - Situation powers (BD_SIT), the team's, once a game each, for mana, when the moment fits (bdpMoment): Bases Loaded,
//   Last Licks, Extra Innings (at bat) and Full Count (in the field). A zone power leaves a field condition (G.zones,
//   as an ultimate does: it shows in the conditions list and fades on its at-bats). The CPU casts them by its skill at
//   the start of a pitch, and Auto powers casts yours as a Knight would; every cast is logged with its reason (✦).
// - The crowd: each side's stands fill it on big moments (a run, a home run, a strikeout, a double play, a stolen base),
//   up to BD_CROWD.max. At BD_CROWD.cost it can lift a cast: an everyday ability with a strength (BD_AMP) works half
//   again as strongly (abPow, through bdpAmpK), or an ultimate's zone lasts one more at-bat. You call for it (arm), the
//   CPU spends it by its skill, Auto powers does too (♪ in the play-by-play). Mana pays for everything, as before.
// The picks (each player bringing one of a pair) are made by the Realm before the game: a player who picks the
// physical skill goes in with that role's ability left off, so physOf gives them the skill, and a pitcher with a pair
// of magic pitches goes in with one of them.
const BD_CROWD = { max: 6, cost: 3, run: 1, hr: 2, k: 1, dp: 2, sb: 1, amp: 1.5 };
// per pitch while a situation power fits, and per cast while the crowd can lift it: the chance by CPU skill
const BD_POWK = { sit: [.25, .5, .75, 1], amp: [.3, .55, .8, 1] };
// the everyday abilities with a strength to lift (each reads abPow); the sure things (Shadowstep, Telekinesis…) have none
const BD_AMP = ['axe', 'crush', 'sticky', 'pact', 'dispel', 'gaze', 'shriek', 'sprint', 'fleet', 'glide', 'swarm', 'invis', 'bullrush', 'pounce', 'quake', 'flight', 'haunt', 'mesmer', 'petrify', 'web'];
const BD_SIT = {
  loaded: { n: 'Bases Loaded', side: 'bat', cost: 2, turns: 1, zone: { shape: 'global', swing: 1.2, rSpd: 1.2 }, desc: 'The bases are full and the stands are up: for this at-bat your batter\'s swing circle is a fifth bigger and every runner runs a fifth faster.' },
  lastlicks: { n: 'Last Licks', side: 'bat', cost: 2, turns: 3, zone: { shape: 'global', carry: 1.08, swing: 1.1 }, desc: 'The home side in the bottom of the last, behind or level: for three at-bats fly balls carry further and your batters\' swing circle is a tenth bigger.' },
  extra: { n: 'Extra Innings', side: 'bat', cost: 1, desc: 'Extra innings, nobody out and second base empty: the last batter up starts the half on second.' },
  fullcount: { n: 'Full Count', side: 'field', cost: 1, ctrl: .5, desc: 'Three balls and two strikes: your pitcher paints the corner. This pitch scatters half as much.' },
};
const bdpAmpK = (p, id) => G.bdp.amp.id === id && G.bdp.amp.n === p.n ? BD_CROWD.amp : 1;
function bdpNew(P) {
  if (!P) return null;
  return { on: Array.isArray(P.on) ? [!!P.on[0], !!P.on[1]] : [true, true], sitOn: P.sit !== false, crowdOn: P.crowd !== false, crowd: [0, 0], arm: [false, false], used: [{}, {}], fc: null, amp: null, ultAmp: [], casts: [], tally: { run: 0, hr: 0, k: 0, dp: 0, sb: 0 } };
}
const bdpKitStart0 = kitStart;
kitStart = function (opts) { bdpKitStart0.apply(this, arguments); G.bdp = bdpNew(G.rules && G.rules.bdpow); };

/* ---------- the crowd ---------- */
function bdpCrowd(s, k) {
  const B = G.bdp; if (!B) return;
  if (B.tally) B.tally[k] = (B.tally[k] || 0) + 1;
  if (!B.crowdOn || !B.on[s]) return;
  B.crowd[s] = Math.min(BD_CROWD.max, B.crowd[s] + (BD_CROWD[k] || 0));
}
// why side s lifts this cast ('' when it doesn't): you, when you called for it; the CPU and Auto powers by skill
function bdpAmpWant(s) {
  const B = G.bdp; if (!B || !B.crowdOn || !B.on[s] || B.crowd[s] < BD_CROWD.cost) return '';
  const T = G.teams[s], hum = isHuman(T);
  if (hum && B.arm[s]) return 'called for';
  if (hum && !AUTO) return '';
  if (B.crowd[s] >= BD_CROWD.max) return 'the stands are full';
  return R() < BD_POWK.amp[Math.min(3, hum ? 1 : dOf(T))] ? `the crowd at ${B.crowd[s]}` : '';
}
function bdpAmpSpend(s, what, why, k, id) {
  const B = G.bdp, T = G.teams[s];
  B.crowd[s] -= BD_CROWD.cost; B.arm[s] = false;
  B.casts.push({ side: s, k, id, inning: G.inning, half: G.half, why });
  logLine(`♪ ${T.def.short || T.def.name}: the crowd lifts ${what} (${why}).`);
  addFx('callout', { text: 'The crowd lifts it!', col: '#ffd34a', small: true });
}
// at the release: a bat ability or an ultimate in the stance, and an ultimate pitch
const bdpRelease0 = release;
release = function () {
  const B = G.bdp, P = G.P;
  if (B && P) {
    const bt = BT(), ft = FT(), bat = batter();
    let st = P.stances[P.si]; if (st && !affordable(st, bt)) st = P.stances[0];
    if (st && st.k === 'ab' && BD_AMP.includes(st.ab)) { const why = bdpAmpWant(G.half); if (why) { B.amp = { id: st.ab, n: bat.n }; bdpAmpSpend(G.half, `${shortName(bat)}'s ${AB[st.ab].name}`, why, 'amp', st.ab); } }
    else if (st && st.k === 'ult') { const why = bdpAmpWant(G.half); if (why) B.ultAmp.push({ id: st.ult, s: G.half, why }); }
    let pd = P.pitches[P.pi]; if (pd && !affordable(pd, ft)) pd = P.pitches[0];
    if (pd && pd.ult) { const why = bdpAmpWant(1 - G.half); if (why) B.ultAmp.push({ id: pd.k, s: 1 - G.half, why }); }
  }
  return bdpRelease0.apply(this, arguments);
};
const bdpCastRun0 = castRun;
castRun = function (r) {
  const B = G.bdp, ab = r && r.p && r.p.run;
  if (!B || !ab || !BD_AMP.includes(ab) || r.used || r.out || r.scored || BT().mana < abCost(r.p, ab)) return bdpCastRun0.apply(this, arguments);
  const why = bdpAmpWant(G.half); if (!why) return bdpCastRun0.apply(this, arguments);
  B.amp = { id: ab, n: r.p.n }; let ok;
  try { ok = bdpCastRun0.apply(this, arguments); } finally { B.amp = null; }
  if (ok) bdpAmpSpend(G.half, `${shortName(r.p)}'s ${AB[ab].name}`, why, 'amp', ab);
  return ok;
};
const bdpCastField0 = castField;
castField = function (o) {
  const B = G.bdp, s = 1 - G.half;
  if (!B || !o || !o.ok) return bdpCastField0.apply(this, arguments);
  if (o.ult) { const why = bdpAmpWant(s); if (why) B.ultAmp.push({ id: o.ab, s, why }); return bdpCastField0.apply(this, arguments); }
  if (o.team || o.phys || !o.f || !BD_AMP.includes(o.ab)) return bdpCastField0.apply(this, arguments);
  const why = bdpAmpWant(s); if (!why) return bdpCastField0.apply(this, arguments);
  B.amp = { id: o.ab, n: o.f.p.n };
  try { bdpCastField0.apply(this, arguments); } finally { B.amp = null; }
  bdpAmpSpend(s, `${shortName(o.f.p)}'s ${AB[o.ab].name}`, why, 'amp', o.ab);
};
// a magic steal, cast at the release without castRun: the crowd lifts its bonus (magicStealOpt reads abPow) the same way.
// (the batter's lifted swing, set a moment before in the release, is kept for the swing)
const bdpStealOnRelease0 = stealOnRelease;
stealOnRelease = function () {
  const B = G.bdp, S0 = G.run;
  if (!B || !S0 || S0.steal !== 2 || !stealOn()) return bdpStealOnRelease0.apply(this, arguments);
  const ch = stealChain(), r = ch.length ? G.bases[ch[0]] : null, m = r ? magicStealOpt(r) : null;
  if (!m || !m.ok || m.phys || m.club || !BD_AMP.includes(m.id)) return bdpStealOnRelease0.apply(this, arguments);
  const why = bdpAmpWant(G.half); if (!why) return bdpStealOnRelease0.apply(this, arguments);
  const was = B.amp; B.amp = { id: m.id, n: r.n }; let res;
  try { res = bdpStealOnRelease0.apply(this, arguments); } finally { B.amp = was; }
  const go = G.run && G.run.go; if (go && go.magic && go.magic.id === m.id) bdpAmpSpend(G.half, `${shortName(r)}'s ${AB[m.id].name} on the steal`, why, 'amp', m.id);
  return res;
};
const bdpCastRunUlt0 = castRunUlt;
castRunUlt = function (o, r) {
  const B = G.bdp; if (B && o && o.ok && r) { const why = bdpAmpWant(G.half); if (why) B.ultAmp.push({ id: o.id, s: G.half, why }); }
  return bdpCastRunUlt0.apply(this, arguments);
};
// an ultimate's zone, as it takes hold: one at-bat more, if the crowd lifted it (and still can)
const bdpAddZone0 = addZone;
addZone = function (id) {
  const r = bdpAddZone0.apply(this, arguments), B = G.bdp; if (!B || !B.ultAmp.length) return r;
  const i = B.ultAmp.findIndex(x => x.id === id), z = i >= 0 ? zones().find(q => q.id === id) : null; if (!z) return r;
  const u = B.ultAmp.splice(i, 1)[0];
  if (B.crowd[u.s] >= BD_CROWD.cost) { z.turns++; bdpAmpSpend(u.s, `the ${ULT[id].name} (an at-bat more)`, u.why, 'ultamp', id); }
  return r;
};

/* ---------- situation powers ---------- */
// '' when the moment fits side s for power k (mana and once a game aside), or why not
function bdpMoment(s, k) {
  const S = BD_SIT[k]; if (!S || !G.teams) return 'No such power.';
  const pre = G.phase === 'between' || (G.phase === 'plate' && G.P && (G.P.stage === 'select' || G.P.stage === 'windup'));
  if (!pre) return 'Only before a pitch.';
  const bat = s === G.half, T = G.teams[s], O = G.teams[1 - s];
  if (S.side === 'bat' && !bat) return 'Only at bat.';
  if (S.side === 'field' && bat) return 'Only in the field.';
  if (k === 'loaded') return G.phase === 'plate' && G.bases[1] && G.bases[2] && G.bases[3] ? '' : 'Only with the bases loaded.';
  if (k === 'lastlicks') return s === 1 && G.inning >= G.innings && T.R <= O.R ? '' : 'Only for the home side in the bottom of the last inning or later, behind or level.';
  if (k === 'extra') return G.inning > G.innings && G.outs === 0 && !G.bases[2] ? '' : 'Only in extra innings, with nobody out and second base empty.';
  if (k === 'fullcount') return G.phase === 'plate' && G.balls === 3 && G.strikes === 2 ? '' : 'Only on a full count.';
  return 'No such power.';
}
function bdpSitWhy(s, k) {
  const B = G.bdp, S = BD_SIT[k]; if (!S) return 'No such power.';
  if (!B || !B.sitOn || !B.on[s] || !gameOn()) return 'Situation powers are off.';
  if (B.used[s][k]) return 'Once a game.';
  const m = bdpMoment(s, k); if (m) return m;
  if (G.teams[s].mana < S.cost) return `Needs ${S.cost} mana.`;
  return '';
}
// the moment, in words, for the log
function bdpWhyNow(s, k) {
  const T = G.teams[s], O = G.teams[1 - s], d = T.R - O.R;
  if (k === 'loaded') return `bases loaded, ${G.outs} out`;
  if (k === 'lastlicks') return `${d < 0 ? `down by ${-d}` : 'level'} in the bottom of the ${ORD(G.inning)}`;
  if (k === 'extra') return `the ${ORD(G.inning)} inning`;
  if (k === 'fullcount') return 'three balls, two strikes';
  return '';
}
function bdpSitCast(s, k, why) {
  const B = G.bdp, S = BD_SIT[k], T = G.teams[s];
  T.mana -= S.cost; B.used[s][k] = true;
  if (S.zone) {
    // a field condition, as an ultimate leaves; cast before the half's first batter, it waits for them
    G.zones = zones().filter(z => z.id !== 'sit:' + k);
    G.zones.push({ id: 'sit:' + k, name: S.n, fx: S.zone, turns: S.turns + (G.phase === 'between' ? 1 : 0), side: s, seed: 0, x: 0, y: 0, r: 0, born: G.time });
  }
  if (k === 'extra') {
    // the last batter up who is fit and not already on base
    const ros = T.def.roster, on = new Set(G.bases.filter(Boolean));
    for (let j = 1; j < 9; j++) { const q = ros[(T.idx - j + 9) % 9]; if (q && !(q.ko > 0) && !on.has(q)) { G.bases[2] = q; logLine(`${q.n} starts the half on second.`); break; } }
    if (G.phase === 'plate' && !bdpInPrep) bdpStealPrep0(false);
  }
  if (k === 'fullcount') B.fc = s;
  B.casts.push({ side: s, k: 'sit', id: k, inning: G.inning, half: G.half, why: why || '' });
  logLine(`✦ ${T.def.short || T.def.name}: ${S.n}${why ? ` (${why})` : ''}.`);
  addFx('callout', { text: S.n + '!', col: '#ffd34a' });
  sfx.magic();
  return '';
}
// the CPU's, and yours with Auto powers on (as a Knight), at the start of each pitch
function bdpCpuSits() {
  for (const s of [G.half, 1 - G.half]) {
    const T = G.teams[s], hum = isHuman(T); if (hum && !AUTO) continue;
    const want = BD_POWK.sit[Math.min(3, hum ? 1 : dOf(T))];
    for (const k of Object.keys(BD_SIT)) if (!bdpSitWhy(s, k) && R() < want) bdpSitCast(s, k, bdpWhyNow(s, k));
  }
}
// Full Count, at the release (after gear and potions)
const bdpOnRelease0 = gearOnRelease;
gearOnRelease = function (pc, pd, st, ctrl) {
  ctrl = bdpOnRelease0.apply(this, arguments);
  const B = G.bdp; if (!B) return ctrl;
  if (B.fc === 1 - G.half) { ctrl *= BD_SIT.fullcount.ctrl; pc.bdpFc = true; }
  B.fc = null;
  return ctrl;
};

/* ---------- the moments ---------- */
const bdpScoreRun0 = scoreRun;
// (what the runs of this play added to the meter, PL.bdpUp: a full meter adds nothing, so a run taken back takes back only that)
scoreRun = function () {
  const r = bdpScoreRun0.apply(this, arguments), B = G.bdp; if (!B) return r;
  const was = B.crowd[G.half]; bdpCrowd(G.half, 'run'); if (PL) PL.bdpUp = (PL.bdpUp || 0) + B.crowd[G.half] - was;
  return r;
};
// a run taken back on a force for the third out: the stands take back what it added
const bdpOutRunner0 = outRunner;
outRunner = function () {
  const L = PL, was = L ? L.negated || 0 : 0, r = bdpOutRunner0.apply(this, arguments), B = G.bdp;
  const n = B && L ? (L.negated || 0) - was : 0;
  if (n > 0) { B.tally.run -= n; B.crowd[G.half] = Math.max(0, B.crowd[G.half] - (L.bdpUp || 0)); L.bdpUp = 0; }
  return r;
};
const bdpShowResult0 = showResult;
showResult = function (big, small, t, code) { if (G.bdp && code === 'K') bdpCrowd(1 - G.half, 'k'); return bdpShowResult0.apply(this, arguments); };
const bdpStatInPlay0 = statInPlay;
statInPlay = function (L, bat, batR, hit) {
  // (an inside-the-park home run is one too)
  if (G.bdp && L) { if (L.homer || (hit && batR && batR.scored)) bdpCrowd(G.half, 'hr'); if (L.outs && L.outs.length >= 2) bdpCrowd(1 - G.half, 'dp'); }
  return bdpStatInPlay0.apply(this, arguments);
};
// a new pitch: what lifted the last one is spent; the CPU's situation powers come before the steal plans and the save point
const bdpStartPitch0 = startPitch;
startPitch = function () { if (G.bdp) { G.bdp.amp = null; G.bdp.ultAmp = []; } return bdpStartPitch0.apply(this, arguments); };
const bdpStealPrep0 = stealPrep;
let bdpInPrep = false;
stealPrep = function () {
  if (G.bdp && G.teams && G.P && G.phase === 'plate') { bdpInPrep = true; try { bdpCpuSits(); } finally { bdpInPrep = false; } }
  return bdpStealPrep0.apply(this, arguments);
};
const bdpStartHalf0 = startHalf;
startHalf = function () { if (G.bdp) G.bdp.fc = null; return bdpStartHalf0.apply(this, arguments); };

/* ---------- yours, from the page ---------- */
function bdpYouSit(k) {
  const s = kitYou(); if (s < 0) return 'Nobody here is yours.';
  const why = bdpSitWhy(s, k); if (why) return why;
  return bdpSitCast(s, k, '');
}
function bdpArm(on) {
  const s = kitYou(), B = G.bdp; if (s < 0 || !B || !B.crowdOn || !B.on[s]) return 'The crowd is off.';
  if (on && B.crowd[s] < BD_CROWD.cost) return `The crowd needs ${BD_CROWD.cost} to lift a cast.`;
  B.arm[s] = !!on; return '';
}

/* ---------- the meter, under each side's mana ---------- */
const bdpManaGems0 = manaGems;
manaGems = function (c, x, y, n, team) {
  bdpManaGems0.apply(this, arguments);
  const B = G.bdp, s = G.teams ? G.teams.indexOf(team) : -1; if (!B || !B.crowdOn || s < 0 || !B.on[s]) return;
  const v = B.crowd[s], up = v >= BD_CROWD.cost;
  c.save();
  for (let i = 0; i < BD_CROWD.max; i++) { c.fillStyle = i < v ? (up ? '#ffd34a' : '#c99a4a') : 'rgba(255,211,74,.14)'; c.fillRect(x - 4 + i * 13, y + 7, 9, 3); }
  if (B.arm[s]) { c.strokeStyle = '#ffd34a'; c.lineWidth = 1; c.strokeRect(x - 6.5, y + 5.5, BD_CROWD.max * 13, 6); }
  c.restore();
};

/* ---------- saved with the game ---------- */
const bdpSnap0 = snapGame;
snapGame = function () {
  const sn = bdpSnap0.apply(this, arguments);
  // (with the field's conditions, which a snapshot otherwise leaves behind)
  if (sn && G.bdp) sn.bdp = JSON.parse(JSON.stringify(Object.assign({}, G.bdp, { amp: null, ultAmp: [], zones: zones() })));
  return sn;
};
const bdpResume0 = resumeSnap;
resumeSnap = function (sn) {
  const B = sn && sn.bdp ? JSON.parse(JSON.stringify(sn.bdp)) : null;
  if (B) { G.zones = B.zones || []; delete B.zones; B.amp = null; B.ultAmp = []; }
  // (a game saved before powers came in starts them fresh)
  G.bdp = B || bdpNew(sn && sn.rules && sn.rules.bdpow);
  return bdpResume0.apply(this, arguments);
};
