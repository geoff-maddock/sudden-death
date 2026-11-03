/* Cinder Gridiron: stances and fumbles (issue #29). Beside the call, each side of the ball plays Safe, Balanced or
   Risky. The stance changes how the play is run, not which play:
   - Risky chases the big play: the quarterback holds it longer for the deep man (on the short pass, the seam over the
     in), throws longer and looser, carriers
     fight for every yard, blockers release early, the rush pins its ears back, the coverage jumps routes and tacklers
     go for the strip. More big plays, more sacks, picks and fumbles.
   - Safe guards against those: the quarterback throws early or throws it away rather than take a sack, the back slips
     out as a checkdown on the deep pass (valve), two hands on the ball, blocks that stay home, coverage that keeps it in front and tackles that wrap up.
   - Each stance is a set of effects (GF_STANCE[id].off / .def), merged into the play's L.fx at the snap like a power's
     (gfStanceFx), and sets how hard the seven go: stam is the stamina a play costs, against Balanced's.
   - Played by hand (Play mode, on offense), your hands decide most of the risk: the stance has about half its effect on
     the throw and the carrier (GF_ST_HANDS), and still its full effect on the blocking, the receivers and the energy.
   - Your stance stays until you change it (G.stance: { off, def }, for GD.you; saved with the game). The coaches pick
     one each down by skill (gfCpuStance): a Squire at random leaning to Balanced, a Knight by the down, the score and
     the clock, an Archmage by those, your habits and their own stamina. In 'watch' they pick for both sides.
   - GD.stc is the play's two stances ({ off, def }) from the call to the next one; G.stUse counts each side's downs by
     stance (the medals go to the stance a side used most, gfStanceMost).
   Fumbles (gfFumbleRoll, gfFumble): rare. A tackle that holds may knock the ball loose, more often from a weak or worn
   carrier and a strong tackler, and far more often when either side plays Risky. The nearest player falls on it, with
   the defense likelier; a defender who picks it up may run it back, even all the way. */
const GF_ST_IDS = ['safe', 'bal', 'risky'];
const GF_STANCE = {
  safe: { n: 'Safe', stam: .6, desc: 'Guard against the big mistake: fewer sacks, picks and fumbles, and fewer big plays. Half the stamina a play.',
    off: { qbT: .9, away: .4, errM: .85, int: .5, deepW: -.02, fum: .2, cStr: -1, shed: .85, valve: 1.3 },
    def: { rushSpd: .95, shed: .85, int: .55, read: .06, cush: 1.2, tkl: .03, fum: .6 } },
  bal: { n: 'Balanced', stam: 1, desc: 'Play it as called.', off: {}, def: {} },
  risky: { n: 'Risky', stam: 1.3, desc: 'Chase the big play: more big gains, more sacks, picks and fumbles. More stamina a play.',
    off: { qbT: 1.1, errM: 1.15, int: 2.2, deepW: .2, fum: 1.8, cStr: 1, rSpd: 1.05, shed: 1.1 },
    def: { rushSpd: 1.04, shed: 1.15, int: 3, jump: .5, read: -.12, cush: -1.5, tkl: -.07, fum: 1.8 } },
};
// the offense's effects that your hands take over in Play mode, at about half strength
const GF_ST_HANDS = ['errM', 'int', 'fum', 'cStr'];
// a fumble: the chance a tackle that holds knocks it loose (Balanced against Balanced), how often the defense falls on it
// wary: on fourth and short, a careful coach (a Knight or better) whose back is this much likelier than usual to fumble
// punts, or goes for it on fourth and 1 past midfield playing Safe
const GF_FUM = { base: .012, def: .6, wary: 2.2 };
const gfStanceOk = id => GF_ST_IDS.includes(id);

// (force: a stance by side that the coaches must play, for the balance bot: [id or null, id or null])
function gfStanceStart(force) { G.stance = { off: 'bal', def: 'bal' }; G.stUse = [{}, {}]; G.stForce = Array.isArray(force) ? force.map(id => gfStanceOk(id) ? id : null) : null; }
// your stance for one side of the ball; it stays until you change it
function gfSetStance(role, id) {
  if (!G || !GD || GD.mode === 'watch' || !gfStanceOk(id) || !['off', 'def'].includes(role)) return false;
  G.stance = G.stance || { off: 'bal', def: 'bal' }; G.stance[role] = id; return true;
}
// S steps the stance for the side of the ball you are on now
function gfCycleStance() {
  if (!G || !GD || GD.mode === 'watch') return null;
  const role = gfRole(GD.you), cur = (G.stance || {})[role] || 'bal', id = GF_ST_IDS[(GF_ST_IDS.indexOf(cur) + 1) % GF_ST_IDS.length];
  gfSetStance(role, id); return id;
}
// at the call: both sides' stances for the play (yours as you set it, unless the coaches call your side)
function gfPickStances() {
  const out = {};
  for (const side of [G.poss, 1 - G.poss]) {
    const role = gfRole(side), mine = GD.mode !== 'watch' && side === GD.you;
    const id = mine ? ((G.stance || {})[role] || 'bal') : (G.stForce && G.stForce[side]) || gfCpuStance(side, role, (G.skill || [1, 1])[side]);
    out[role] = id;
    if (G.stUse) G.stUse[side][id] = (G.stUse[side][id] || 0) + 1;
  }
  return out;
}
// what the situation asks for: Risky when behind late or on a long third or fourth down, Safe when ahead late or backed up,
// and Safe going for it on fourth down with a back likely to fumble
function gfStanceSit(side, role) {
  const m = G.score[side] - G.score[1 - side], late = !!GD.game && (G.half === 3 || (G.half === 2 && G.clock < 150));
  if (late && m < 0) return 'risky';
  if (late && m > 0) return 'safe';
  if (role === 'off' && G.down === GF_RULES.downs && gfFourthWary(side)) return 'safe';
  if (role === 'off') return G.down >= 3 && G.togo >= 8 ? 'risky' : G.ball <= 10 ? 'safe' : 'bal';
  return G.down >= 3 && G.togo >= 8 ? 'safe' : G.ball >= 90 || (G.down >= 3 && G.togo <= 2) ? 'risky' : 'bal';
}
function gfCpuStance(side, role, skill) {
  if (!skill) return wpick({ safe: 1, bal: 2, risky: 1 });
  const sit = gfStanceSit(side, role);
  if (skill === 1 || sit !== 'bal') return sit;
  // an Archmage: tired legs play Safe, and a defense reads the offense's habits (Safe against the deep ball, Risky
  // against a side that keeps running)
  if (gfTired(side) > .45) return 'safe';
  if (role === 'def') { const T = gfTendency(G.poss, 'off'); if ((T.deep || 0) >= .35) return 'safe'; if ((T.run || 0) >= .55) return 'risky'; }
  return 'bal';
}
// the stances' effects on top of the play's (the powers and zones), as a power's are merged; hands: Play mode
function gfStanceFx(F, stc, hands) {
  if (!stc) return F;
  for (const role of ['off', 'def']) {
    const S = GF_STANCE[stc[role]]; if (!S) continue;
    for (const k in S[role]) {
      if (!(k in F)) continue;
      const half = hands && role === 'off' && GF_ST_HANDS.includes(k), v = S[role][k];
      F[k] = GF_FX_MUL.has(k) ? F[k] * (half ? Math.sqrt(v) : v) : F[k] + (half ? v / 2 : v);
    }
  }
  return F;
}
// the stamina a play costs a side, by its stance on the play (1 without one)
function gfStanceStam(side) {
  const S = GD && GD.stc; if (!S || S.side == null) return 1;
  const id = side === S.side ? S.off : S.def; return (GF_STANCE[id] || GF_STANCE.bal).stam;
}
// the stance a side used on most of its downs (Balanced on a tie)
function gfStanceMost(side) {
  const u = (G && G.stUse && G.stUse[side]) || {}; let best = 'bal';
  for (const id of GF_ST_IDS) if ((u[id] || 0) > (u[best] || 0)) best = id;
  return best;
}

/* ---------- fumbles ---------- */
// how likely the back is to put it on the ground this down, against the usual (x: 1 is a fresh back's on Balanced
// against Balanced): his legs, strength and hands, the other side's tacklers, and the stance their coach would play
// (a Squire's could be anything). The coaches weigh it on fourth down (gfFourth).
function gfFumbleRisk(side) {
  const T = G.teams[side], D = G.teams[1 - side], ri = T.off.RB, c = gfWorn(side, ri, T.roster[ri].r);
  const tk = Object.values(D.def).reduce((a, j) => a + gfWorn(1 - side, j, D.roster[j].r).tkl, 0) / Object.keys(D.def).length;
  const dst = (G.skill || [1, 1])[1 - side] ? gfStanceSit(1 - side, 'def') : null, df = dst ? GF_STANCE[dst].def.fum || 1 : 1.1;
  const worn = gfStamOf(side, ri) < 50, x = df * (worn ? 1.4 : 1) * clamp(1 + (tk - c.str) * .06 + (6 - c.hnd) * .05, .4, 2);
  const why = [worn && `${T.roster[ri].n} is tired`, c.hnd <= 4 && `${T.roster[ri].n} has loose hands`, dst === 'risky' && 'their defense will go for the ball'].filter(Boolean);
  return { x, why: why.join(', and ') };
}
// does this tackle knock the ball loose: c the carrier, d the tackler
function gfFumbleRoll(c, d) {
  const F = L.fx || GF_FX0, worn = gfStamOf(G.poss, c.ri) < 50 ? 1.4 : 1;
  const p = GF_FUM.base * F.fum * worn * clamp(1 + (d.r.tkl - c.r.str) * .06 + (6 - c.r.hnd) * .05, .4, 2);
  return R() < p;
}
// the ball is out: the nearest players go for it, the defense likelier to come up with it; a defender may run it back
function gfFumble(c, d) {
  gfEv('fumble', c.n, d.n);
  const near = side => gfNearest(c.x, c.y, L.pl.filter(p => p.side === side && p !== c && !(p.stun > 0)));
  const [o, od] = near(0), [x, xd] = near(1), pd = clamp(GF_FUM.def + (od - xd) * .08, .3, .85);
  const lost = !!x && (!o || R() < pd), rec = lost ? x : (o || c);
  let ret = 0;
  if (lost && R() < .55) ret = Math.round(-Math.log(Math.max(.02, R())) * (2 + rec.r.spd * .6));
  gfEv('recover', rec.n, lost ? 'def' : 'off');
  const done = gfDead('fum', d.n, c.x, L.pl.indexOf(d));
  return Object.assign(done, { lost, rec: rec.n, reci: L.pl.indexOf(rec), ret });
}

/* ---------- the reason, and the coach's tips ---------- */
// what the stances did on this play, for the reason after it ('' when both played it as called)
function gfStanceWhy(r, stc) {
  if (!stc || (stc.off === 'bal' && stc.def === 'bal')) return '';
  const o = stc.off, d = stc.def, ev = L ? L.ev : [];
  if (r.what === 'fum') return o === 'risky' ? `Risky: ${r.who} fought for every yard, and the ball came out.` : d === 'risky' ? `Risky: ${r.by} went for the strip.` : '';
  if (r.what === 'inc' && r.by === 'thrown away') return 'Safe: the quarterback threw it away rather than take a sack.';
  if (r.what === 'sack') return o === 'risky' ? 'Risky: the quarterback held it for the deep man, and the rush got there.' : d === 'risky' ? 'Risky: the defense sent everyone, and got home.' : '';
  if (r.what === 'int') return d === 'risky' ? 'Risky: the coverage jumped the route.' : o === 'risky' ? 'Risky: a long, loose throw into coverage.' : '';
  if (r.gain >= 20) return d === 'risky' ? 'Risky: the defense gambled, and missed.' : o === 'risky' ? 'Risky: they took a shot, and it paid off.' : '';
  if (d === 'safe' && ev.some(e => e.k === 'catch') && r.gain > 0 && r.gain < 10) return 'Safe: the coverage kept it in front of them.';
  if (o === 'safe' && ev.some(e => e.k === 'throw') && r.gain > 0 && r.gain < 10) return 'Safe: the quarterback took the short, sure throw.';
  return '';
}
// a stance's pros and cons for your side, this down ({ pro, con, note })
function gfStanceTip(id) {
  const S = GF_STANCE[id]; if (!S || !G || !GD) return null;
  const side = GD.you, role = gfRole(side), off = role === 'off', T = { pro: [], con: [], note: [] };
  const m = G.score[side] - G.score[1 - side], late = !!GD.game && (G.half === 3 || (G.half === 2 && G.clock < 150)), st = Math.round((1 - gfTired(side)) * 100);
  const sit = `${GF_ORD[G.down]} and ${G.togo}${m ? `, ${m > 0 ? 'up' : 'down'} by ${Math.abs(m)}` : ''}`;
  if (id === 'risky') {
    T.pro.push(off ? 'The quarterback looks deep (on a short pass, up the seam), carriers fight for extra yards: more big plays.' : 'The rush comes harder and the coverage jumps routes: more sacks, picks and forced fumbles.');
    T.con.push(off ? 'More sacks, interceptions and fumbles.' : 'More missed tackles and long gains when they guess wrong.');
    T.con.push(`About ${S.stam}× the stamina a play.`);
    if (late && m < 0) T.pro.push(`${sit}, late: you need the big play.`);
    if (off && G.down >= 3 && G.togo >= 8) T.pro.push(`${sit}: Risky gives you the best shot at the first down.`);
    if (late && m > 0) T.con.push(`${sit}, late: a turnover now could cost the game.`);
  } else if (id === 'safe') {
    T.pro.push(off ? 'Short, sure throws (on a deep pass, the back slips out as a checkdown), two hands on the ball: almost no fumbles, far fewer picks and sacks.' : 'The coverage keeps it in front and tackles wrap up: few big plays.');
    T.con.push(off ? 'Fewer big plays: the quarterback takes what is there.' : 'Fewer sacks and turnovers: they will get short gains.');
    T.pro.push(`Half the stamina a play: your seven are at ${st}%.`);
    if (late && m > 0) T.pro.push(`${sit}, late: protect the lead.`);
    if (st < 55) T.pro.push(`Your seven are at ${st}% stamina: Safe saves energy for later.`);
  } else T.pro.push('Play it as called: no extra risk, the usual stamina.');
  if (off && GD.mode === 'play') T.note.push('Playing by hand, your throws and runs take about half the stance\'s effect; the blocking and the energy take all of it.');
  T.note.push('It stays until you change it.');
  return T;
}
