/* ================= game state & flow ================= */
const G = { phase: 'menu', mode: '1p', paused: false, log: [], banner: null, rolls: [], fx: [], slow: 0, shake: 0, time: 0 };
const BT = () => G.teams[G.half];
const FT = () => G.teams[1 - G.half];
const batter = () => BT().def.roster[BT().idx];
const pitcher = () => FT().def.roster.find(p => p.pos === 'P');
const ctlOf = t => t.ctl;               // 'p1' | 'p2' | 'cpu'
const isHuman = t => t.ctl !== 'cpu';
const shortName = p => p.n.split(' ').slice(-1)[0];

function newGame(opts) {
  G.opts = opts;
  G.rules = takeRules(opts); AUTO = !!G.rules.auto;
  G.mode = opts.mode; G.innings = G.rules.innings; G.diff = G.rules.diff;
  const [a, h] = opts.defs || [getTeam(opts.team), getTeam(opts.opp && opts.opp !== opts.team ? opts.opp : opts.team === 'ironmaw' ? 'mirewood' : 'ironmaw')].map(cloneDef);
  let ctl = opts.mode === '1p' ? ['p1', 'cpu'] : opts.mode === '2p' ? ['p1', 'p2'] : ['cpu', 'cpu'];
  if (opts.humanSide === 1 && opts.mode !== 'demo') ctl = ['cpu', 'p1'];
  if (!opts.defs) for (const d of [a, h]) d.pen = quickPen(d, opts.innings);
  G.season = !!opts.season; G.pstats = new Map(); G.committed = false;
  G.teams = [a, h].map((def, i) => ({ def, ctl: ctl[i], mana: 2 + (def.manaBonus || 0), idx: 0, line: [], R: 0, H: 0, devourUsed: false, pen: (def.pen || []).slice(), used: [] }));
  G.starters = G.teams.map(t => t.def.roster.find(p => p.pos === 'P'));
  for (const t of G.teams) attachGear(t);
  if (typeof skyStart === 'function' && MOON) skyStart();
  if (typeof takeStart === 'function' && TAKE !== undefined) takeStart();
  for (const t of G.teams) for (const p of [...t.def.roster, ...t.pen]) initStamina(p);
  G.inning = 1; G.half = 0; G.outs = 0; G.balls = 0; G.strikes = 0;
  G.bases = [null, null, null, null];
  G.log = []; G.full = []; G.archived = false; G.gameId = null; G.rolls = []; G.fx = []; G.banner = null; G.paused = false; G.slow = 0; G.lastPitch = null; G.abPitches = []; G.abTags = []; G.zones = [];
  renderLog(); renderLineScore(); if (typeof renderReadout === 'function') renderReadout();
  logLine(`${a.name} at ${h.name}. ${G.innings} innings. First pitch under the torches.`, true);
  if (typeof leagueLine === 'function' && LEAGUES) leagueLine();
  startHalf();
}

function cloneDef(d) { return { ...d, roster: d.roster.map(p => ({ ...p })), pen: [] }; }
const TIRELESS = ['golem', 'skeleton', 'zombie', 'lich', 'wraith'];
// every swing, pitch and spell costs stamina; undead and constructs tire at half rate; items can soften or skip it
function drain(p, amt, kind, type) {
  if (!p || !p.maxStam || amt <= 0) return;
  if (kind === 'spell' && type && tierOf(p, type) >= 3) return;
  if (p.noTire && (kind === 'swing' || kind === 'spell')) return;
  let m = 1; if (p.tireless) m *= .5; if (p.endure) m *= .6;
  p.stam -= amt * m;
  if (p.pos !== 'P' && fatigue(p) < .5 && !p.bwarn && G.phase !== 'menu') { p.bwarn = 1; addFx('callout', { text: `${shortName(p)} is winded`, col: '#ffd27a', small: true }); }
}
// hustle: each tap pours stamina into the current action (0..1 charge); a winded player gets less out of it
function tapEffort(holder, key, p) {
  if (!p) return;
  if (fatigue(p) < .06) { if (!holder.exhaustedNote) { holder.exhaustedNote = 1; addFx('callout', { text: `${shortName(p)} has nothing left`, col: '#ff8a7a', small: true }); } return; }
  const was = holder[key] || 0;
  holder[key] = Math.min(1, was + .16 * (1 - .5 * fk(p)));
  drain(p, .8, 'effort');
  tone(300 + holder[key] * 500, .035, 'square', .025);
  if (was < .75 && holder[key] >= .75) { addFx('callout', { text: `${shortName(p)}: full effort!`, col: '#ffb547', small: true }); if (key === 'eff') { useTag('hustle', `${shortName(p)} went all out`); abUse(p, 'hustle'); } }
}
const fk = p => { const f = fatigue(p); return f < .5 ? (.5 - f) / .5 : 0; };
function initStamina(p) { p.tireless = TIRELESS.includes(p.kind); p.bwarn = 0; p.maxStam = 45 + p.arm * 4 + p.pow * 1.5 + (p.endure ? 25 : 0); p.stam = p.maxStam * (p.fresh != null ? p.fresh : 1); p.pc = 0; p.warned = 0; if (p.hp == null) p.hp = 100; p.ko = 0; p.burnAcc = 0; }
const fatigue = p => p && p.maxStam ? clamp(p.stam / p.maxStam, 0, 1) : 1;
function pst(p) { if (!G.pstats) G.pstats = new Map(); let s = G.pstats.get(p); if (!s) { s = blankLine(); G.pstats.set(p, s); } return s; }
function bullpen(team) {
  if (!team.pen || !team.pen.length) { if (isHuman(team)) addFx('callout', { text: 'Nobody warming up in the bullpen', col: '#ffd27a', small: true }); return false; }
  const ros = team.def.roster, i = ros.findIndex(p => p.pos === 'P'); if (i < 0) return false;
  team.pen.sort((a, b) => fatigue(b) - fatigue(a));
  const np = team.pen.shift(), old = ros[i];
  np.pos = 'P'; ros[i] = np; team.used.push(old);
  banner('Pitching change', `${np.n} takes the ball from ${shortName(old)}`, 1.8); sfx.good();
  logLine(`Pitching change: ${np.n} (${np.race}) relieves ${old.n} after ${old.pc} pitches.`);
  startPitch(false);
  return true;
}
function startHalf() {
  G.outs = 0; G.bases = [null, null, null, null];
  BT().line[G.inning - 1] = BT().line[G.inning - 1] || 0;
  for (const t of G.teams) t.mana = Math.min(6, t.mana + 1);
  FT().devourUsed = false; G.rallyHalf = false; clearZones(); healHalf();
  if (G.half === 1 && G.innings > 1 && G.inning === Math.min(7, G.innings)) { seventhInningStretch(); logLine(`${G.innings >= 7 ? 'Seventh-inning' : 'Last-inning'} stretch. The organist plays the old tune, badly on purpose.`); }
  G.phase = 'between'; G.betweenT = 2.0;
  banner(`${G.half ? 'Bottom' : 'Top'} of the ${ORD(G.inning)}`, `${BT().def.name} bat · ${ctlLabel(BT())}`, 2.0);
  renderLineScore();
}
function ctlLabel(t) { return t.ctl === 'cpu' ? 'CPU' : t.ctl === 'p1' ? 'Player 1' : 'Player 2'; }

function startAtBat() {
  G.balls = 0; G.strikes = 0;
  if (typeof skyTick === 'function' && MOON) skyTick();
  tickTurns(); skipKOBatters();
  if (G.bases[3] && !G.rallyHalf && isHuman(BT())) { G.rallyHalf = true; musicSting('rally'); }
  startPitch(true);
}

function stanceOpts(p, team) {
  const o = [{ k: 'normal', name: 'Normal' }, { k: 'power', name: 'Power swing' }, { k: 'contact', name: 'Contact swing' }];
  const ph = physOf(p, 'bat'); if (ph) o.push({ k: 'phys', ph, name: AB[ph].name, stam: AB[ph].stam });
  if (p.bat) o.push({ k: 'ab', ab: p.bat, name: AB[p.bat].name + (tierOf(p, 'bat') > 1 ? ' ' + 'I'.repeat(tierOf(p, 'bat')) : ''), cost: abCost(p, p.bat) });
  const u = ultOption(p, team, 'bat'); if (u) o.push({ k: 'ult', ult: u.id, name: AB[u.id].name, cost: u.cost });
  const gs = gearStance(team); if (gs) o.push(gs);
  return o;
}
function affordable(opt, team) { if (opt.stam && G.P !== undefined && typeof batter === 'function' && G.teams && fatigue(batter()) < .08) return false; return !opt.cost || team.mana >= opt.cost; }

function startPitch(newBatter) {
  G.phase = 'plate';
  const prev = G.P;
  { const p0 = pitcher(); if (p0.ko > 0) { if (FT().pen.length && bullpen(FT())) return; p0.ko = 0; p0.hp = Math.max(p0.hp, 20); logLine(`${p0.n} staggers back to the mound.`); } }
  const pt = pitcher(), bt = FT(), bat = batter();
  const pitches = pt.pitches.map(k => ({ k, ...PITCHES[k], cost: pitchCost(pt, PITCHES[k]) }));
  { const up = ultOption(pt, FT(), 'pitch'); if (up) pitches.push({ k: up.id, ...PITCHES[up.id], cost: pitchCost(pt, PITCHES[up.id]) }); }
  { const gp = gearPitch(FT()); if (gp) pitches.push(gp); }
  G.P = {
    stage: 'select', t: 0, pitches, pi: 0,
    aim: { x: 0, h: 2.5 }, stances: stanceOpts(bat, BT()), si: 0,
    pci: newBatter || !prev ? { x: 0, h: 2.5 } : prev.pci,
    swing: null, pitch: null, result: null, cpuT: .8 + R() * .9, fired: false, swingAnim: -1,
  };
  if (!newBatter && prev && prev.si < 3) G.P.si = prev.si;
  if (!isHuman(BT())) cpuChooseStance(); else if (AUTO) autoStance();
  if (isHuman(FT()) && AUTO) autoPitch();
  if (!isHuman(FT()) && fatigue(pt) < .22 && FT().pen.length && !G.P.penTried) { G.P.penTried = true; if (bullpen(FT())) return; }
  if (newBatter) {
    G.P.intro = 1.4; G.abPitches = []; G.abTags = [];
  }
  stealPrep(newBatter);
  if (G.season && typeof seasonLiveSave === 'function') seasonLiveSave(); else if (typeof exhSnap === 'function' && GAMES) exhSnap();
}

/* ---------- plate phase ---------- */
const PCI_SPEED = 4.2, AIM_SPEED = 3.2, SWING_DELAY = 0, PITCH_SCALE = 1.3;
function plateUpdate(dt) {
  const P = G.P; P.t += dt; if (P.intro > 0) P.intro -= dt; if (P.swingAnim >= 0) P.swingAnim += dt;
  if (!P.swing) P.beff = Math.max(0, (P.beff || 0) - .28 * dt); if (P.stage === 'select' || P.stage === 'windup') P.peff = Math.max(0, (P.peff || 0) - .28 * dt);
  if (P.rel != null) P.rel += dt; if (P.bb) P.bb.age += dt; if (P.pop) P.pop.age += dt;
  const bt = BT(), ft = FT();
  const bi = isHuman(bt) ? INP[bt.ctl] : null, pi = isHuman(ft) ? INP[ft.ctl] : null;
  // batter cursor + stance (before swing)
  if (!P.swing && P.stage !== 'result') {
    let mul = 1; if (P.stage === 'flight' && P.pitch.fx === 'frost') mul = .35;
    if (bi) {
      if (P.stage !== 'flight') {
        if (bi.p.prev) cycleStance(-1); if (bi.p.next) cycleStance(1);
        if (bi.p.num != null && P.stances[bi.p.num]) { if (affordable(P.stances[bi.p.num], bt)) { P.si = bi.p.num; tone(660, .04, 'square', .03); } else tone(140, .08, 'square', .04); }
      }
      const dx = (bi.h.right ? 1 : 0) - (bi.h.left ? 1 : 0), dh = (bi.h.up ? 1 : 0) - (bi.h.down ? 1 : 0);
      P.pci.x = clamp(P.pci.x + dx * PCI_SPEED * mul * dt, -1.4, 1.4);
      P.pci.h = clamp(P.pci.h + dh * PCI_SPEED * mul * dt, .9, 4.2);
    } else if (P.stage === 'flight' && P.cpu) {
      if (P.t > P.cpu.react) {
        const tx = P.cpu.gx, th = P.cpu.gh, sp = PCI_SPEED * 1.2 * mul * dt;
        P.pci.x += clamp(tx - P.pci.x, -sp, sp); P.pci.h += clamp(th - P.pci.h, -sp, sp);
      }
    } else if (P.stage === 'select' && !bi) {
      P.pci.x += (0 - P.pci.x) * dt * 2; P.pci.h += (2.5 - P.pci.h) * dt * 2;
    }
  }
  if (bi && bi.p.act && (P.stage === 'select' || P.stage === 'windup')) P.earlyNote = .9;
  if (bi && bi.p.hus && !P.swing && P.stage !== 'result' && P.stage !== 'hit') tapEffort(P, 'beff', batter());
  if (pi && pi.p.hus && (P.stage === 'select' || P.stage === 'windup')) tapEffort(P, 'peff', pitcher());
  if (P.earlyNote > 0) P.earlyNote -= dt;
  if (stealUpdate(dt, bi, pi)) return;
  if (P.stage === 'select') {
    if (pi) {
      if (pi.p.pen) { if (bullpen(ft)) return; }
      if (pi.p.prev) cyclePitch(-1); if (pi.p.next) cyclePitch(1);
      if (pi.p.num != null) { const j = pi.p.num; if (P.pitches[j] && affordable(P.pitches[j], ft)) { P.pi = j; tone(520, .04, 'square', .03); } else tone(140, .08, 'square', .04); }
      const dx = (pi.h.right ? 1 : 0) - (pi.h.left ? 1 : 0), dh = (pi.h.up ? 1 : 0) - (pi.h.down ? 1 : 0);
      P.aim.x = clamp(P.aim.x + dx * AIM_SPEED * dt, -1.5, 1.5);
      P.aim.h = clamp(P.aim.h + dh * AIM_SPEED * dt, .8, 4.3);
      if (pi.p.act && P.t > .15) { P.stage = 'windup'; P.t = 0; }
    } else {
      P.cpuT -= dt; if (P.cpuT <= 0) { cpuChoosePitch(); P.stage = 'windup'; P.t = 0; }
    }
  } else if (P.stage === 'windup') {
    if (pi && pi.p.act && P.t > .1 && P.relT == null) gradeRelease(P, pitcher());
    if (P.t >= .75) release();
  } else if (P.stage === 'flight') {
    const pc = P.pitch;
    if (!P.swing) {
      if (bi && bi.p.act) doSwing();
      else if (!bi && P.cpu && P.cpu.swing && P.t >= P.cpu.swingT) doSwing();
    }
    if (P.swing && !P.swing.done && P.t >= P.swing.tc) { P.swing.done = true; resolveSwing(); }
    else if (!P.swing && P.t >= pc.Ta + .16) resolveTake();
    else if (P.swing && P.swing.done && P.swing.miss && P.t >= pc.Ta + .16) finishMiss();
  } else if (P.stage === 'hit') {
    if (P.bb && P.bb.age >= .55) startPlay(P.pending.tr, P.pending.hit);
  } else if (P.stage === 'result') {
    if (P.t >= P.resT) afterResult();
  }
}
function cycleStance(d) {
  const P = G.P, n = P.stances.length;
  for (let i = 1; i <= n; i++) { const j = (P.si + d * i + n * 4) % n; if (affordable(P.stances[j], BT())) { P.si = j; tone(660, .04, 'square', .03); return; } }
}
function cyclePitch(d) {
  const P = G.P, n = P.pitches.length;
  for (let i = 1; i <= n; i++) { const j = (P.pi + d * i + n * 4) % n; if (affordable(P.pitches[j], FT())) { P.pi = j; tone(520, .04, 'square', .03); return; } }
}

// release meter: a second press during the windup, timed to the gold band, tightens the pitch
const REL_C = .66;
function relBand(pt) { const h = .03 * (1 - .4 * fk(pt)); return { perfect: h, good: h * 2.2 }; }
function gradeRelease(P, pt) {
  P.relT = P.t; const b = relBand(pt), e = P.t - REL_C;
  P.relGrade = Math.abs(e) <= b.perfect ? 'perfect' : Math.abs(e) <= b.good ? 'good' : e < 0 ? 'early' : 'late';
  const G2 = { perfect: ['Perfect release!', '#ffd34a'], good: ['Good release', '#8fe38a'], early: ['Released early', '#ff8a7a'], late: ['Released late', '#ff8a7a'] }[P.relGrade];
  if (P.relGrade === 'perfect') { tone(988, .06, 'square', .05); tone(1319, .09, 'square', .05, 0, .06); } else if (P.relGrade === 'good') tone(784, .07, 'square', .04); else tone(160, .1, 'square', .05);
}
const REL_MULT = { perfect: .55, good: .8, early: 1.4, late: 1.4 };
// how widely a pitch scatters around the aim (feet, one standard deviation), before batter magic and release timing
function baseCtrl(pd, pt, pe) {
  const f = fk(pt);
  let ctrl = pd.ctrl * (1 + (10 - pt.arm) * .04) * (1 + 1.8 * f);
  if (pd.magic && tierOf(pt, 'pitch') >= 3) ctrl *= .75;
  if (pe > 0) ctrl *= 1 + .6 * pe;
  return ctrl * (1 + .6 * weakK(pt, 'arm'));
}
// the batter's reach (circle radius, ft) and timing window (s) for a stance
function swingMods(bat, k, ab, sk, be) {
  const bk = fk(bat); let r = (.3 + bat.con * .022) * (1 - .25 * bk), win = (.085 + bat.con * .007) * (1 - .2 * bk);
  if (sk === 'choke') r *= 1.3; if (sk === 'slap') win *= 1.4; if (sk === 'grip') r *= .95;
  if (be > 0 && ab !== 'bunt') r *= 1 - .12 * be;
  if (k === 'power') r *= .78; if (k === 'contact') r *= 1.25;
  const pm = ab ? abPow(bat, ab) : 1;
  if (ab === 'axe') r *= 1 + .6 * pm; if (ab === 'crush') r *= .8; if (ab === 'sticky') r *= 1 + .4 * pm; if (ab === 'pact') r *= 1 + .1 * pm; if (ab === 'dispel') r *= 1 + .15 * pm;
  if (ab === 'bunt') { r *= 1.7; win *= 1.9; }
  r *= zoneMult('swing', 0, 0) * hurtMul(bat, .2) * (1 - .25 * weakK(bat, 'con'));
  { const gr = gearReach(k); r *= gr.r; win *= gr.win; }
  return { r, win };
}
// magic, skills, hustle and dice used during the current at-bat; they ride along on its play-by-play line
function useTag(k, t) { if (!G.teams) return; const L = G.abTags || (G.abTags = []); const f = L.find(x => x.k === k && x.t === t); if (f) f.n++; else L.push({ k, t, n: 1 }); }
function takeTags() { const t = G.abTags || []; G.abTags = []; return t.length ? t : null; }
function release() {
  const P = G.P, pt = pitcher(), bat = batter(), ft = FT(), bt = BT();
  let pd = P.pitches[P.pi]; if (!affordable(pd, ft)) { P.pi = 0; pd = P.pitches[0]; }
  if (pd.cost) ft.mana -= pd.cost;
  let st = P.stances[P.si]; if (!affordable(st, bt)) { P.si = 0; st = P.stances[0]; }
  const ab = st.k === 'ab' ? st.ab : null, skill = st.k === 'phys' ? st.ph : null;
  if (skill) abUse(bat, skill); if (ab) abUse(bat, ab); pst(pt).pc++;
  if (skill) { useTag('skill', `${shortName(bat)}: ${AB[skill].name}`); drain(bat, AB[skill].stam, 'skill'); addFx('abil', { text: AB[skill].name, side: 'bat' }); tone(220, .08, 'triangle', .06); }
  if (st.k === 'ult') castBatUlt(bat, st.ult);
  if (ab) { useTag('magic', `${shortName(bat)}: ${AB[ab].name}`); drain(bat, 4 * abCost(bat, ab), 'spell', 'bat'); bt.mana -= abCost(bat, ab); addFx('abil', { text: AB[ab].name, side: 'bat' }); sfx.magic(); }
  const hs = pt.hand === 'R' ? 1 : -1;
  const pc = { skill, key: pd.k, name: pd.name, T: pd.T * PITCH_SCALE, bx: pd.bx * hs, bh: pd.bh, fx: pd.fx || null, magic: !!pd.magic, ab, stance: st.k };
  pc.sx = -.75 * hs; pc.sh = 5.3; // leaves the pitcher's hand
  if (pc.fx === 'meteor') { pc.sx = 0; pc.sh = 22; }
  if (ab === 'dispel' && pc.magic) { pc.fx = null; pc.magic = false; pc.T = .53 * PITCH_SCALE; pc.bx = 0; pc.bh = 0; pc.dispelled = true; pc.sh = 5.3; pc.sx = -.75 * hs; }
  if (ab === 'gaze') { pc.T *= 1 + .3 * abPow(bat, 'gaze'); pc.bx *= .3; pc.bh *= .3; pc.gazed = true; }
  // fatigue: a tired arm throws slower, flatter and wilder
  const fg = fatigue(pt), fk = fg < .5 ? (.5 - fg) / .5 : 0;
  pc.T *= 1 + .22 * fk; pc.bx *= 1 - .4 * fk; pc.bh *= 1 - .4 * fk; pc.tired = fk;
  drain(pt, 1 + (pd.T < .5 ? .6 : pd.T < .6 ? .3 : 0), 'pitch'); if (pd.magic) drain(pt, 1.6 * pd.cost, 'spell', 'pitch'); pt.pc = (pt.pc || 0) + 1;
  const f2 = fatigue(pt);
  if (f2 < .5 && pt.warned < 1) { pt.warned = 1; addFx('callout', { text: `${shortName(pt)} is tiring`, col: '#ffd27a', small: true }); }
  if (f2 < .2 && pt.warned < 2) { pt.warned = 2; addFx('callout', { text: `${shortName(pt)} is gassed`, col: '#ff8a7a', small: true }); }
  let ctrl = pd.ctrl * (1 + (10 - pt.arm) * .04) * (1 + 1.8 * fk); if (ab === 'shriek') ctrl *= 1 + 2 * abPow(bat, 'shriek'); if (pd.magic && tierOf(pt, 'pitch') >= 3) ctrl *= .75; ctrl *= 1 + .6 * weakK(pt, 'arm');
  // max-effort pitches arrive faster but spray more
  const pe = P.peff || 0; if (pe > 0) { pc.T *= 1 - .13 * pe; ctrl *= 1 + .6 * pe; pc.eff = pe; }
  if (pd.magic) abUse(pt, pd.k);
  if (pd.ult) castPitchUlt(pt, pd.k, pc); else if (pd.magic) useTag('magic', `${shortName(pt)}: ${pd.name}`);
  if (pe > .5) abUse(pt, 'hustle');
  if (pe > .5) useTag('hustle', `${shortName(pt)}: max-effort pitch`);
  if (P.relGrade) { ctrl *= REL_MULT[P.relGrade]; if (P.relGrade === 'perfect') pc.T *= .97; pc.rel = P.relGrade; }
  ctrl = gearOnRelease(pc, pd, st, ctrl);
  pc.fx0 = P.aim.x + gauss() * ctrl; pc.fh0 = P.aim.h + gauss() * ctrl;
  if (pc.fx === 'hex') { pc.fx0 += gauss() * .3; pc.fh0 += gauss() * .3; }
  pc.fh0 = clamp(pc.fh0, .3, 5.2); pc.fx0 = clamp(pc.fx0, -2.2, 2.2);
  pc.Ta = pc.fx === 'frost' ? pc.T * 1.25 : pc.T;
  pc.ph = R() * 6; pc.mph = R() * 6;
  P.pitch = pc; P.stage = 'flight'; P.t = 0; P.rel = 0;
  if (pc.fx === 'fire') sfx.fire(); else if (pc.fx === 'frost') sfx.frost(); else if (pc.magic) sfx.magic(); else sfx.whoosh();
  if (pc.magic) addFx('callout', { text: pc.name + '!', col: pc.fx === 'fire' || pc.fx === 'meteor' ? '#ff9a3a' : pc.fx === 'frost' ? '#9fe6ff' : '#c9a4ff' });
  if (pc.dispelled) addFx('callout', { text: 'Dispelled!', col: '#c9a4ff' });
  stealOnRelease(pc);
  if (!isHuman(bt)) cpuPlanSwing();
}
function pitchProg(pc, t) { let x = t / pc.Ta; if (pc.fx === 'frost') x = x < .6 ? x * 1.25 : .75 + (x - .6) * .625; return x; }
function pitchPos(pc, p) {
  const q = Math.min(p, 1.2);
  let x = lerp(pc.sx, pc.fx0 - pc.bx, q) + pc.bx * q * q;
  let h;
  if (pc.fx === 'meteor') h = pc.fh0 + (pc.sh - pc.fh0) * (1 - q * q) + (q > 1 ? -(q - 1) * 6 : 0);
  else h = lerp(pc.sh, pc.fh0 - pc.bh, q) + pc.bh * q * q;
  if (pc.fx === 'hex') { const w = q * (1 - q) * 4; x += Math.sin(q * 19 + pc.ph) * .38 * w; h += Math.cos(q * 13 + pc.ph) * .26 * w; }
  return { x, h, d: 55 * (1 - q) };
}
function doSwing() { const P = G.P; const sb = batter(), stk = P.stances[P.si] ? P.stances[P.si].k : 'normal'; drain(sb, stk === 'power' ? 4.5 : stk === 'contact' ? 2.5 : 3.5, 'swing'); P.swing = { t: P.t, tc: P.t + SWING_DELAY, done: false }; P.swingAnim = 0; sfx.whoosh(); }
function inZone(x, h) { return Math.abs(x) <= .83 && h >= 1.48 && h <= 3.52; }

function resolveSwing() {
  const P = G.P, pc = P.pitch, bat = batter(), bt = BT();
  const bk = fk(bat); let r = (.3 + bat.con * .022) * (1 - .25 * bk), pw = (.55 + bat.pow * .06) * (1 - .2 * bk); let win = (.085 + bat.con * .007) * (1 - .2 * bk);
  const wC = weakK(bat, 'con'), wP = weakK(bat, 'pow'); r *= 1 - .25 * wC; pw *= 1 - .2 * wP;
  const sk = pc.skill;
  if (sk === 'choke') { r *= 1.3; pw *= .9; } if (sk === 'uppercut') pw *= 1.15; if (sk === 'slap') { win *= 1.4; pw *= .7; } if (sk === 'grip') { pw *= 1.25; r *= .95; }
  r *= zoneMult('swing', 0, 0) * hurtMul(bat, .2); pw *= hurtMul(bat, .2);
  const be = P.beff || 0; if (be > .5) abUse(bat, 'hustle'); if (be > .5) useTag('hustle', `${shortName(bat)}: max-effort swing`); if (be > 0 && pc.ab !== 'bunt') { pw *= 1 + .3 * be; r *= 1 - .12 * be; }
  if (pc.stance === 'power') { r *= .78; pw *= 1.25; }
  if (pc.stance === 'contact') { r *= 1.25; pw *= .8; }
  const ab = pc.ab, pm = ab ? abPow(bat, ab) : 1;
  if (ab === 'axe') { r *= 1 + .6 * pm; pw *= 1 + .25 * pm; } if (ab === 'crush') { pw *= 1 + .5 * pm; r *= .8; }
  if (ab === 'sticky') { r *= 1 + .4 * pm; pw *= .8; } if (ab === 'pact') { pw *= 1 + .4 * pm; r *= 1 + .1 * pm; } if (ab === 'dispel') r *= 1 + .15 * pm;
  { const gm = gearSwing(pc); r *= gm.r; pw *= gm.pw; win *= gm.win; P.gearLaunch = gm.launch; }
  const e = P.swing.tc - pc.Ta;
  const dx = pc.fx0 - P.pci.x, dh = pc.fh0 - P.pci.h, d = hyp(dx, dh);
  P.swingE = e; P.swingWin = win; P.swingR = r; P.swingD = d; P.swingDX = dx; P.swingDH = dh;
  if (ab === 'bunt' && Math.abs(e) <= win * 1.9 && d <= r * 1.7) {
    sfx.crack(.1);
    const v = 38 + R() * 14, th = -9 + R() * 6, ph = -27 + gauss() * 6;
    return contactMade(v, th, ph, .2, true);
  }
  if (Math.abs(e) <= win && d <= r) {
    if (wC && R() < .25 * wC) { P.swing.miss = true; P.swing.why = `Whiffed: poor contact (CON ${bat.con})`; if (isHuman(bt) || G.mode === 'demo') addFx('callout', { text: 'Whiff!', col: '#ff8a7a', small: true }); return; }
    const q = .55 * (1 - d / r) + .45 * (1 - Math.abs(e) / win);
    if (q < .08) { sfx.crack(.1); return foul('Foul tip'); }
    if (pc.fx === 'fire') {
      const roll = d20(), bonus = bat.con + luck(bat); const ok = roll + bonus >= 16;
      addRoll(`${shortName(bat)} vs the Fireball`, `d20 + ${bonus} ≥ 16`, roll, ok, roll + bonus);
      if (!ok) { pw *= .5; addFx('callout', { text: 'Bat scorched!', col: '#ff9a3a' }); if (R() < .5) hurt(bat, 8, 'hands singed by the fire', { fire: true, noKO: true }); }
    }
    let v = Math.min(178, 72 + 104 * Math.pow(q, .55) * pw);
    let th = 11 + clamp(dh / r, -1.2, 1.2) * 27 + gauss() * 6;
    if (sk === 'uppercut') th += 12; th += P.gearLaunch || 0; if (sk === 'slap') th = Math.min(th, 2);
    const hs = bat.hand === 'R' ? 1 : -1;
    const ph = clamp(e / win, -1.3, 1.3) * 50 * hs + gauss() * 8;
    if (wP && R() < .3 * wP) { v = Math.min(v, 58); th = Math.min(th, -4); addFx('callout', { text: 'Feeble dribbler', col: '#ff8a7a', small: true }); }
    sfx.crack(q);
    return contactMade(v, th, ph, q, false);
  }
  P.swing.miss = true;
  P.swing.why = missReason(e, win, dx, dh, r, bat);
}
function missReason(e, win, dx, dh, r, bat) {
  if (e < -win) return `Too early by ${Math.round((-e - win) * 1000)} ms`;
  if (e > win) return `Too late by ${Math.round((e - win) * 1000)} ms`;
  if (Math.abs(dh) >= Math.abs(dx)) return dh > 0 ? 'Swung under it: ball was higher' : 'Swung over it: ball was lower';
  const inside = bat.hand === 'R' ? dx < 0 : dx > 0;
  return inside ? 'Ball was further inside' : 'Ball was further outside';
}
function contactMade(v, th, ph, q, bunt) {
  const P = G.P;
  const vx = v * Math.cos(th * DEG) * Math.sin(ph * DEG), vy = v * Math.cos(th * DEG) * Math.cos(ph * DEG), vz = v * Math.sin(th * DEG);
  const tr = simTraj(0, 2, 3, vx, vy, vz);
  P.bb = { tr, age: 0 }; G.hitstop = .05 + q * .05; if (q > .7) G.shake = Math.max(G.shake, .18);
  P.contact = { q, mph: Math.round(v * .6818), launch: Math.round(th), bunt };
  if (Math.abs(ph) > 100 || isFoul(tr)) return foul(Math.abs(ph) > 100 ? 'Fouled back' : 'Foul ball');
  P.stage = 'hit'; P.t = 0; recordPitch('In play', '');
  P.pending = { tr, hit: { v, th, ph, q, bunt, ab: P.pitch.ab, bgear: P.pitch.bgear } };
}
function foul(txt) {
  const P = G.P;
  if (G.strikes < 2) G.strikes++;
  P.fouled = true;
  showResult(txt, `${G.balls}-${G.strikes}`, .9);
  sfx.ump();
}
function strike(txt) {
  const P = G.P;
  if (G.strikes === 2 && P.pitch.ab === 'undying') { addFx('callout', { text: 'Undying!', col: '#9fe38a' }); return foul('Rises again: foul'); }
  G.strikes++;
  sfx.ump();
  if (G.strikes >= 3) {
    const bat = batter();
    FT().mana = Math.min(6, FT().mana + 1); pst(pitcher()).k++; musicSting('k'); { const bs = pst(batter()), ps = pst(pitcher()); bs.pa++; bs.ab++; bs.so++; ps.bf++; ps.outsP++; }
    logLine(`${bat.n} strikes out ${P.swing ? 'swinging' : 'looking'} on a ${P.pitch.name.toLowerCase()}.`, false, takeTags());
    showResult('Strike three', P.swing ? 'swinging' : 'looking', 1.3, 'K');
  } else showResult(P.swing ? 'Swing and a miss' : 'Strike', `${pitchReveal()} · ${G.balls}-${G.strikes}`, P.swing ? 1.1 : .8);
}
function pitchReveal() { return G.P.pitch.name; }
function resolveTake() {
  const P = G.P, pc = P.pitch;
  sfx.mitt(); P.pop = { x: pc.fx0, h: pc.fh0, age: 0 };
  const bat = batter(), inside = bat.hand === 'R' ? pc.fx0 < -1.35 : pc.fx0 > 1.35;
  if (inside && Math.abs(pc.fx0) < 2.3 && pc.fh0 > .5 && pc.fh0 < 5.2) {
    const why = pc.fx === 'fire' ? 'plunked by a fireball' : pc.fx === 'meteor' ? 'hit by a falling meteor' : pc.fx === 'frost' ? 'frostbitten by the pitch' : pc.fx === 'hex' ? 'hexed by the pitch' : 'hit by the pitch';
    hurt(bat, pc.fx === 'meteor' ? 26 : pc.fx === 'fire' ? 22 : pc.magic ? 16 : 10 + (pc.T < .6 ? 4 : 0), why, { fire: pc.fx === 'fire', noKO: true });
    sfx.bad(); G.shake = Math.max(G.shake, .2);
    return showResult('Hit by pitch', 'take your base', 1.3, 'HBP');
  }
  if (inZone(pc.fx0, pc.fh0)) strike('Strike');
  else {
    G.balls++;
    if (G.balls >= 4) { showResult('Ball four', 'take your base', 1.2, 'BB'); }
    else showResult('Ball', `${pitchReveal()} · ${G.balls}-${G.strikes}`, .8);
  }
}
function finishMiss() { sfx.mitt(); G.P.pop = { x: G.P.pitch.fx0, h: G.P.pitch.fh0, age: 0 }; G.P.missWhy = G.P.swing.why; strike('Swing and a miss'); }
function showResult(big, small, t, code) { const P = G.P; P.stage = 'result'; P.t = 0; P.resT = t; P.result = { big, small, code }; recordPitch(big, small); stealMark(P, code); }
// everything the data bar under the field needs about the pitch that just finished
function recordPitch(big, small) {
  const P = G.P, pc = P && P.pitch; if (!pc) return;
  const bt = BT(), ft = FT(), pt = pitcher(), bat = batter(), bunt = pc.ab === 'bunt';
  const rec = {
    n: (G.abPitches || []).length + 1, pitch: pc.name, magic: pc.magic, mph: Math.round(60.5 / (pc.T / PITCH_SCALE) * .6818),
    big, small, balls: G.balls, strikes: G.strikes, outs: G.outs, why: P.missWhy || '', batter: bat.n, pitcher: pt.n, hand: bat.hand,
    aim: isHuman(ft) || G.mode === 'demo' ? { x: P.aim.x, h: P.aim.h } : null,
    cross: { x: pc.fx0, h: pc.fh0 }, zone: inZone(pc.fx0, pc.fh0),
    rel: isHuman(ft) ? { t: P.relT, grade: P.relGrade || null, band: relBand(pt) } : null,
    swing: P.swing && P.swingE != null ? { e: P.swingE, win: P.swingWin * (bunt ? 1.9 : 1), d: P.swingD, r: P.swingR * (bunt ? 1.7 : 1), cx: P.pci.x, ch: P.pci.h, dx: P.swingDX, dh: P.swingDH } : null,
    Ta: pc.Ta, contact: P.contact || null, batHuman: isHuman(bt), pitHuman: isHuman(ft), outcome: '',
  };
  G.lastPitch = rec; (G.abPitches = G.abPitches || []).push({ n: rec.n, pitch: rec.pitch, big });
  if (typeof renderReadout === 'function') renderReadout();
}
function afterResult() {
  const P = G.P, code = P.result.code;
  if (stealAfter(code)) return;
  if (code === 'K') { recordOut(); if (G.outs >= 3) return endHalf(); return nextBatter(); }
  if (code === 'BB' || code === 'HBP') {
    const b = G.bases, bat = batter(); let scored = 0;
    if (b[1]) { if (b[2]) { if (b[3]) { scoreRun(b[3]); scored++; } b[3] = b[2]; } b[2] = b[1]; } b[1] = bat;
    { const bs = pst(bat), ps = pst(pitcher()); bs.pa++; bs.rbi += scored; ps.bf++; ps.ra += scored; if (code === 'HBP') { bs.hbp++; ps.hbpP++; } else { bs.bb++; ps.bba++; } }
    logLine(`${bat.n} ${code === 'HBP' ? 'is hit by the pitch and takes first' : 'draws a walk'}${scored ? '. A run is forced home' : ''}.`, false, takeTags());
    if (checkWalkoff()) return;
    return nextBatter();
  }
  startPitch(false);
}
function recordOut() { G.outs++; }
function scoreRun(p) { if (p) pst(p).r++; const t = BT(); t.R++; t.line[G.inning - 1] = (t.line[G.inning - 1] || 0) + 1; renderLineScore(); }
function nextBatter() { const t = BT(); t.idx = (t.idx + 1) % 9; startAtBat(); }
function checkWalkoff() {
  if (G.half === 1 && G.inning >= G.innings && G.teams[1].R > G.teams[0].R) { gameOver(true); return true; }
  return false;
}
function endHalf() {
  const bt = BT();
  logLine(`End of the ${G.half ? 'bottom' : 'top'} of the ${ORD(G.inning)}. ${G.teams[0].def.short} ${G.teams[0].R}, ${G.teams[1].def.short} ${G.teams[1].R}.`, true);
  if (G.half === 0 && G.inning >= G.innings && G.teams[1].R > G.teams[0].R) return gameOver(false);
  if (G.half === 1 && G.inning >= G.innings && G.teams[1].R !== G.teams[0].R) return gameOver(false);
  if (G.half === 1) { G.half = 0; G.inning++; } else G.half = 1;
  startHalf();
}
function gameOver(walkoff) {
  G.phase = 'over';
  try { commitCareer(); } catch (e) { }
  try { gearAfterGame(); } catch (e) { }
  try { skyEnd(); } catch (e) { }
  const [a, h] = G.teams; const w = a.R > h.R ? a : h;
  logLine(`${walkoff ? 'Walk-off! ' : ''}Final: ${a.def.name} ${a.R}, ${h.def.name} ${h.R}.`, true);
  try { G.gameId = archiveGame(walkoff); } catch (e) { }
  try { if (LEAGUES) recordClubResult(); } catch (e) { }
  renderLineScore();
  sfx.crowd(2.5);
  { const hum = G.teams.find(t => t.ctl !== 'cpu'); musicSting(!hum || hum === w ? 'win' : 'loss'); }
  if (G.season) { if (G.sim) seasonAfterGame(); else setTimeout(() => seasonAfterGame(), 1400); return; }
  setTimeout(() => {
    document.getElementById('overTitle').textContent = `${w.def.name} win`;
    document.getElementById('overSub').textContent = `${walkoff ? 'A walk-off in the bog. ' : ''}${a.def.short} ${a.R} · ${h.def.short} ${h.R}. ${w.ctl === 'cpu' ? 'The CPU manager takes it.' : ctlLabel(w) + ' takes it.'}`;
    document.getElementById('overLS').innerHTML = lineScoreHTML();
    document.getElementById('over').hidden = false;
  }, 1400);
}

/* ---------- CPU at the plate ---------- */
function cpuChoosePitch() {
  const P = G.P, ft = FT(), diff = G.diff;
  if (G.strikes === 2 && fatigue(pitcher()) > .45 && R() < .35 + diff * .1) { P.peff = .5 + R() * .4; drain(pitcher(), 4, 'effort'); }
  const opts = P.pitches.map((p, i) => ({ p, i })).filter(o => affordable(o.p, ft));
  const ultP = opts.find(o => o.p.ult), magic = opts.filter(o => o.p.magic && !o.p.ult);
  let choice;
  if (ultP && R() < .3 + diff * .08) choice = ultP;
  else if (magic.length && R() < .28 + diff * .08) choice = pick(magic);
  else choice = pick(opts.filter(o => !o.p.magic && !o.p.gear));
  P.pi = choice.i; gearCpuPitch();
  let x, h;
  if (G.balls === 3) { x = (R() - .5) * 1.5; h = 1.8 + R() * 1.4; }
  else if (G.strikes === 2 && R() < .4) { x = (R() < .5 ? -1 : 1) * (1 + R() * .4); h = 1.1 + R() * .5; }
  else { x = (R() < .5 ? -1 : 1) * (.3 + R() * .7); h = 1.7 + R() * 1.6; if (R() < .18) h = R() < .5 ? 1.2 : 3.9; }
  P.aim = { x, h };
}
// Auto powers: a human side's batter picks a spell or skill stance and its pitcher a magic pitch, the way the CPU would.
// The player can still change either before the pitch.
function autoStance() {
  const P = G.P, bt = BT(), b = batter(), ab = P.stances.find(s => s.k === 'ab'), phs = P.stances.find(s => s.k === 'phys');
  let pickI = -1;
  if (ab && bt.mana >= ab.cost) {
    let want = .45;
    if (ab.ab === 'undying') want = G.strikes === 2 ? .9 : 0;
    if (ab.ab === 'bunt') want = (G.bases[1] || G.bases[2]) && G.outs < 2 ? .6 : .08;
    if (bt.mana >= 5) want += .2;
    if (R() < want) pickI = P.stances.indexOf(ab);
  }
  if (pickI < 0 && phs && fatigue(b) > .45 && R() < .35) pickI = P.stances.indexOf(phs);
  { const us = P.stances.find(s => s.k === 'ult'); if (us && bt.mana >= us.cost && R() < .3 + (bt.mana >= 5 ? .25 : 0)) pickI = P.stances.indexOf(us); }
  if (pickI >= 0) { P.si = pickI; P.autoPick = true; }
  gearCpuStance();
}
function autoPitch() {
  const P = G.P, ft = FT(), magic = P.pitches.map((p, i) => ({ p, i })).filter(o => o.p.magic && affordable(o.p, ft));
  if (magic.length && R() < .4 + (ft.mana >= 5 ? .2 : 0)) { P.pi = pick(magic).i; P.autoPick = true; }
  gearCpuPitch();
}
function cpuChooseStance() {
  const P = G.P, bt = BT(), b = batter();
  if (fatigue(b) > .5 && R() < .2 + G.diff * .1) { P.beff = .4 + R() * .4; drain(b, 4, 'effort'); }
  let si = 0;
  if (G.strikes === 2 && R() < .5) si = 2; else if (G.strikes === 0 && G.balls >= 1 && R() < .35) si = 1;
  const ab = P.stances.find(s => s.k === 'ab'), phs = P.stances.find(s => s.k === 'phys');
  if (phs && si === 0 && fatigue(b) > .45 && R() < .18 + G.diff * .08) si = P.stances.indexOf(phs);
  if (ab && bt.mana >= ab.cost) {
    let want = .22 + G.diff * .08;
    if (ab.ab === 'undying') want = G.strikes === 2 ? .7 : 0;
    if (ab.ab === 'bunt') want = (G.bases[1] || G.bases[2]) && G.outs < 2 ? .45 : .12;
    if (bt.mana >= 5) want += .2;
    if (R() < want) si = P.stances.indexOf(ab);
  }
  const us = P.stances.find(s => s.k === 'ult'); if (us && bt.mana >= us.cost && R() < .35 + (bt.mana >= 5 ? .25 : 0) + G.diff * .05) si = P.stances.indexOf(us);
  P.si = si; gearCpuStance();
}
function cpuPlanSwing() {
  const P = G.P, pc = P.pitch, diff = G.diff;
  let sl = [.36, .26, .19][diff], stt = [.085, .065, .048][diff];
  if (zoneOn('hideMarker')) { sl *= 1.6; stt *= 1.3; }
  if (pc.fx === 'phantom') sl *= 1.6; if (pc.fx === 'hex') sl *= 1.35; if (pc.fx === 'fire') stt += .02; if (pc.key === 'change') stt += .02;
  if (pc.ab === 'eagle') sl *= .4;
  const gx = pc.fx0 + gauss() * sl, gh = pc.fh0 + gauss() * sl;
  const zone = inZone(gx, gh);
  let sp = zone ? .88 : [.3, .22, .14][diff] + (G.strikes === 2 ? .2 : 0);
  if (G.balls === 3 && !zone) sp *= .5;
  const swing = R() < sp;
  P.cpu = { gx, gh, swing, swingT: pc.Ta - SWING_DELAY + gauss() * stt, react: .12 + R() * .06 };
}
