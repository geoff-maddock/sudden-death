/* the end of the wBD scope: what the Realm may call (w20-diamond.js, w20d-ballgame.js). gameOver, showMenu and exhSnap
   are wrapped here, inside the scope, so the Realm hears about a final, a game given up from the Time out box (its End
   game goes back to the setup menu, which the Realm does not show) and the snapshot taken at the start of each pitch,
   without reading Brimstone Diamond's page. */
const bdxGameOver = gameOver;
// the final card shows after a delay, so a game's card can come up during the next one: it only shows between games
gameOver = function (walkoff) { BDX.page.classList.remove('bdlive'); const r = bdxGameOver(walkoff); try { if (BDX.onOver) BDX.onOver(); } catch (e) { console.error(e); } return r; };
const bdxShowMenu = showMenu;
showMenu = function () { const r = bdxShowMenu.apply(this, arguments); try { if (BDX.onQuit) BDX.onQuit(); } catch (e) { console.error(e); } return r; };
const bdxExhSnap = exhSnap;
exhSnap = function () { bdxExhSnap(); try { if (BDX.onSnap && EXH_SNAP && gameOn()) BDX.onSnap(EXH_SNAP); } catch (e) { console.error(e); } };
/* start a game straight onto the field, skipping its setup menu: opts as newGame takes them, plus rules: { key: value }
   over Brimstone Diamond's own defaults for this game only (newGame takes them through takeRules) */
function bdxStart(opts) {
  actx(); document.getElementById('menu').hidden = true; document.getElementById('over').hidden = true; PL = null;
  if (opts.rules) Object.assign(nextRules(), opts.rules);
  // its play help (a prompt bar with your next key, tip cards the first time you run or field) starts on in the Realm
  BDX.page.classList.add('bdlive');
  if (!BDX.hinted) { BDX.hinted = true; try { setHints(true); } catch (e) { } }
  newGame(opts);
}
// T (or the Settings page) switches Auto powers: onAuto hears the new value, mid-game too
const bdxSetAuto = setAuto;
setAuto = function () { const r = bdxSetAuto.apply(this, arguments); try { if (BDX.onAuto) BDX.onAuto(AUTO); } catch (e) { console.error(e); } return r; };
// a snapshot from onSnap, back on the field where it was taken
function bdxResume(sn) { actx(); BDX.page.classList.add('bdlive'); resumeSnap(sn, false); }
// a whole game at once, CPU against CPU and silent: onOver hears the final before this returns
function bdxSim(opts) {
  const snd = SND.on; SND.on = false;
  try { bdxStart(Object.assign({}, opts, { mode: 'demo' })); simToEnd(true); } finally { SND.on = snd; }
}
// the box score: each player who appeared (by the rid the Realm gave them) and their line
function bdxBox() {
  const out = [];
  if (G.pstats) G.teams.forEach((t, side) => { for (const p of [...t.def.roster, ...t.used, ...t.pen]) { const s = G.pstats.get(p); if (s && p.rid != null) out.push({ side, rid: p.rid, n: p.n, line: { ...s, abil: undefined } }); } });
  return out;
}
/* a Realm player's baseball ratings, seeded from their kind's player on the two founding clubs (TEMPL: every kind plays
   once, so the kind also gives the position), each of the five stats moved by up to 1 either way */
function bdxRate(kind) {
  const T = TEMPL[kind] || TEMPL.goblin;
  const r = { pos: T.pos, hand: T.hand, wpn: T.wpn, bat: T.bat || null, run: T.run || null, field: T.field || null, ult: ULT_BY_KIND[T.kind] || null, pitches: T.pitches ? T.pitches.slice() : null };
  for (const s of STATS5) r[s] = clamp(T[s] + Math.floor(Math.random() * 3) - 1, 1, 10);
  return r;
}
function bdxTempl(kind) { const T = TEMPL[kind]; return T ? Object.fromEntries(STATS5.map(s => [s, T[s]])) : null; }
// the names and one-line descriptions the Realm shows for powers, ultimates and pitches
function bdxNames() {
  const o = (src, f) => Object.fromEntries(Object.entries(src).map(([k, v]) => [k, f(v)]));
  return { ab: o(AB, v => ({ n: v.name, type: v.type, desc: v.desc, cost: v.cost || 0, stam: v.stam || 0, passive: !!v.passive })), ult: o(ULT, v => ({ n: v.name, role: v.role, desc: v.desc })),
    pitch: o(PITCHES, v => ({ n: v.name, magic: !!v.magic, desc: v.desc, cost: v.cost || 0 })) };
}
/* the Umbral (issue #99, 4a): the hexes a game can carry (opts.hexes, or rules.hexes, with hexBy the side casting them),
   and the Nadir champion's own pitch, the Dead Ball (the Phantom's vanish, faster and tighter; nobody else throws it) */
PITCHES.deadball = { name: 'Dead Ball', T: .46, bx: .2, bh: -.3, ctrl: .11, cost: 2, magic: true, fx: 'phantom', desc: 'Thrown from a dead hand. It vanishes after release, comes back just before the plate, and comes back fast.' };
function bdxHexes() { return Object.fromEntries(Object.entries(HEXES).map(([k, v]) => [k, { n: v.name, d: v.desc }])); }
// the kinds whose player on the founding clubs plays pos (two each), for call-ups
function bdxKindsAt(pos) { return KINDS.filter(k => TEMPL[k].pos === pos); }
// a founding club to play against, with a reliever warming up as a quick game gets one
function bdxClub(id, innings) { const d = cloneDef(getTeam(id)); d.pen = quickPen(d, innings || 3); return d; }
/* gear and potions (issue #115, phase 1; 51-kit.js): the magic bats and balls the Realm turns into a player's gear, the
   potions, your potion now (potion), why a side can't (potionWhy), your coach's word (advice), the game as it is now
   saved through onSnap (snapNow: only at the start of a pitch, where a snapshot resumes) */
function bdxGear() { return Object.fromEntries(Object.entries(GEAR).map(([k, g]) => [k, { n: g.name, type: g.type, uses: g.uses, desc: g.desc, base: g.base || null }])); }
/* powers (issue #115, phase 2; 52-powers.js): the situation powers and the crowd's numbers, why side s can't cast power k
   now (sitWhy), whether its moment fits (sitFit: unused, and the moment is right, mana aside), your cast (castSit), calling
   for the crowd on your next cast (arm), which abilities it can lift (ampable), a role's physical skill (physOf), a line in
   the play-by-play (say) */
const bdxPow = { sit: JSON.parse(JSON.stringify(BD_SIT)), crowd: JSON.parse(JSON.stringify(BD_CROWD)), amp: BD_AMP.slice() };
function bdxSitFit(s, k) { return !!(G.bdp && G.bdp.sitOn && G.bdp.on[s] && gameOn() && !G.bdp.used[s][k] && !bdpMoment(s, k)); }
function bdxSnapNow() { if (gameOn() && G.phase === 'plate' && G.P && G.P.stage === 'select') exhSnap(); }
/* the ground's own ways (issue #115, phase 4; 53-ground.js): Graftonbury Ballpark's numbers (ground), the game's mound
   grass and dim patch (gd), and for the checks: the grass now, a field point in the patch, a fly into it, what the
   ground draws on a blank canvas (paint: the pixels it touches in the field and plate views) */
function bdxPaint() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), out = {};
  for (const [k, f] of [['field', gdDrawField], ['plate', gdDrawPlate], ['hud', gdDrawHud]]) {
    c.clearRect(0, 0, W, H); f(c); const d = c.getImageData(0, 0, W, H).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; out[k] = n;
  }
  const D = G.gd, at = (x, y) => { c.clearRect(0, 0, W, H); gdDrawField(c); const p = fp(x, y); return c.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data[3]; };
  out.dimAt = D && D.dim ? at(D.dim.x, D.dim.y) : 0; out.offAt = D && D.dim ? at(-D.dim.x * .2, 150) : 0;
  return out;
}
return {
  G, newGame, simToEnd, start: bdxStart, resume: bdxResume, sim: bdxSim, box: bdxBox, show: bdxShow, hide: bdxHide,
  get on() { return BDX.on; }, set onOver(f) { BDX.onOver = f; }, set onQuit(f) { BDX.onQuit = f; }, set onSnap(f) { BDX.onSnap = f; }, get onSnap() { return BDX.onSnap; }, set onAuto(f) { BDX.onAuto = f; },
  // where a point of the field is drawn, in the canvas's own pixels (x across, d out from the plate, h up): read only, as golf's
  // wGL.scr (the Quick start's screenshots label things by it)
  scr: (x, d, h) => { const p = proj(x, d || 0, h); return [p.x, p.y]; },
  get live() { return gameOn(); }, audio: (music, sfx) => { if (MUS.on !== !!music) setMusic(!!music, true); SND.on = !!sfx; }, get sound() { return { music: !!MUS.on, sfx: !!SND.on }; }, pause: on => { if (gameOn() && !!G.paused !== !!on) togglePause(); },
  teams: () => Object.keys(TEAMS), rate: bdxRate, templ: bdxTempl, names: bdxNames, stats: STATS5.slice(),
  kindsAt: bdxKindsAt, club: bdxClub, positions: POSITIONS.slice(), hexes: bdxHexes, skills: ['Squire', 'Knight', 'Archmage', 'Lich'],
  gear: bdxGear, potions: JSON.parse(JSON.stringify(BD_POTIONS)), kitRules: JSON.parse(JSON.stringify(BD_KIT)), potion: id => kitPotion(id), potionWhy: (s, id) => kitWhy(s, id),
  advice: bag => kitAdvice(bag), snapNow: bdxSnapNow, get kit() { return G.kit || null; },
  sit: bdxPow.sit, crowdRules: bdxPow.crowd, ampable: id => bdxPow.amp.includes(id), get bdp() { return G.bdp || null; },
  sitWhy: (s, k) => bdpSitWhy(s, k), sitFit: bdxSitFit, castSit: k => bdpYouSit(k), arm: on => bdpArm(on),
  physOf: (p, cat) => physOf(p, cat), say: t => logLine(t), abPow: (p, id) => abPow(p, id),
  ground: JSON.parse(JSON.stringify(Object.assign({}, GD, { say: undefined }))), get gd() { return G.gd || null; },
  groundProbe: { grass: () => gdGrass(), inDim: (x, y) => gdInDim(x, y), where: () => G.gd && G.gd.dim ? gdWhere(G.gd.dim) : '', fly: (vx, vy, vz) => gdDimFly(simTraj(0, 2, 3, vx, vy, vz)), paint: bdxPaint,
    // a fielder at (x, y) reading a fly into the patch (or not) t seconds in: their speed, and the chance they bobble a catch there
    read: (dim, t, x, y) => { const pl = PL, f = { p: G.teams[1 - G.half].def.roster.find(p => p.pos === 'CF'), x, y, spd: 20, stun: 0, flight: 0 };
      PL = { t, gdDim: dim, ball: { st: 'batted', holder: null, x, y } }; try { return { spd: fSpeed(f), react: zoneAdd('react', x, y) }; } finally { PL = pl; } },
    bob: (x, y) => { const D = G.gd, was = gdBobK; gdBobK = D && D.dim && gdInDim(x, y) ? GD.bob : 1; try { return zoneMult('bobble', x, y); } finally { gdBobK = was; } } },
  // for the checks: n frames of the game (1/30 s each), and what a player's gear and the drops do (test/realm_diamond_kit.py)
  step: n => { for (let i = 0; i < (n || 1) && gameOn(); i++) { update(1 / 30, 1 / 30); INP.p1.p = {}; INP.p2.p = {}; } },
  kitProbe: { reach: p => reachR({ p, big: false }), bob: p => kitBob(p), eye: () => kitEye() },
  powProbe: { zone: id => addZone(id, null, G.half),
    // (a run scored with the batting side's crowd at c, then taken back on a force for the third out: the crowd after each)
    runBack: c => { const pl = PL, outs = G.outs, B = G.bdp; B.crowd[G.half] = c; PL = { outs: [], runsThisPlay: 1 }; G.outs = 2;
      try { scoreRun(null); const up = B.crowd[G.half]; outRunner({ p: G.teams[G.half].def.roster[0] }, 'force'); return [up, B.crowd[G.half]]; } finally { PL = pl; G.outs = outs; } } }
};
