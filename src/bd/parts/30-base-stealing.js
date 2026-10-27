/* ================= Leads, pickoffs and stolen bases (rule: "Base stealing") ================= */
RULE_DEFS.push({ k: 'steal', label: 'Base stealing', opts: [[true, 'On'], [false, 'Off']], def: true, help: 'Runners take leads, pitchers throw over to pick them off, and runners can steal. Off: runners stay on the bag until the ball is hit.' });

const LEAD_S = [0, .075, .14];                 // lead distance, in base paths (a path is 90 ft)
const LEAD_TXT = ['on the bag', 'lead', 'big lead'];
const BNAME = ['home', 'first', 'second', 'third', 'home'];
const BAG_POS = [null, '1B', 'SS', '3B'];      // who covers each bag on a throw
// bonus a steal gets from the runner's power (shadowstep can't be thrown out)
const STEAL_MAGIC = { shadowstep: 99, invis: 6, swarm: 6, sprint: 5, fleet: 4, glide: 4, bullrush: 3, hookslide: 4, burst: 3, barrel: 2, haste: 3 };
const HOLD_MAGIC = ['mesmer', 'petrify', 'web', 'haunt'];   // a pitcher with one of these stares runners close
const ARM_MAGIC = ['telek', 'boulder'];                     // a catcher with one of these throws harder

const stealOn = () => !!rule('steal');
const anyRunner = () => !!(G.bases && (G.bases[1] || G.bases[2] || G.bases[3]));
function basesSig() { return G.bases.map(p => p ? p.n + '#' + p.num : '-').join('|'); }
// G.run: leads per base, the steal called for this pitch, a steal in progress (go), pickoff throws this at-bat
function runState() {
  const sig = basesSig();
  if (!G.run || G.run.sig !== sig) G.run = { sig, lead: [0, 0, 0, 0], steal: 0, late: 0, go: null, picks: G.run ? G.run.picks : 0, pickAt: null };
  return G.run;
}
function fielderAt(ft, b) { const pos = b === 4 || b === 0 ? 'C' : BAG_POS[b]; return ft.def.roster.find(p => p.pos === pos) || pitcher(); }
const catcherOf = ft => ft.def.roster.find(p => p.pos === 'C') || pitcher();
// a runner's speed on the path from base b, with fatigue, injury, weak legs and anything on the field (webs, ice)
function runSpd(p, b) {
  const a = BASE[b], c = BASE[(b + 1) % 4], mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
  return p.spd * (1 - .25 * fk(p)) * zoneMult('rSpd', mx, my, 'runner') * hurtMul(p, .3) * (1 - .15 * weakK(p, 'spd'));
}
const holdMagic = pt => HOLD_MAGIC.includes(pt.field) ? pt.field : null;
const armMagic = c => ARM_MAGIC.includes(c.field) ? c.field : physOf(c, 'field') === 'rocket' ? 'rocket' : null;
// who goes on a steal: the lead runner with an open base ahead, plus the runners right behind him
function stealChain() {
  const b = G.bases;
  for (const k of [2, 1]) if (b[k] && !b[k + 1]) { const ch = []; for (let j = k; j >= 1 && b[j]; j--) ch.push(j); return ch; }
  if (b[3]) { const ch = []; for (let j = 3; j >= 1 && b[j]; j--) ch.push(j); return ch; }
  return [];
}
function magicStealOpt(p) {
  const bt = BT();
  if (p.run && !AB[p.run].passive && STEAL_MAGIC[p.run]) { const cost = abCost(p, p.run); return { id: p.run, cost, bonus: STEAL_MAGIC[p.run] >= 99 ? 99 : Math.round(STEAL_MAGIC[p.run] * abPow(p, p.run)), ok: bt.mana >= cost }; }
  const ph = physOf(p, 'run'); if (ph && STEAL_MAGIC[ph]) return { id: ph, phys: true, stam: AB[ph].stam, bonus: STEAL_MAGIC[ph], ok: fatigue(p) > .08 };
  return { id: 'haste', club: true, cost: AB.haste.cost, bonus: STEAL_MAGIC.haste, ok: bt.mana >= AB.haste.cost };
}
// the steal roll: d20 + runner bonus against the catcher's number (pitch-specific parts added when it happens)
function stealNums(r, from, lead, late) {
  const ft = FT(), cat = catcherOf(ft), tgt = from + 1, bag = tgt === 4 ? cat : fielderAt(ft, tgt), pt = pitcher();
  const rb = Math.round(runSpd(r, from)) - 3 + [0, 1, 3][lead] - late + luck(r) - (holdMagic(pt) ? 1 : 0);
  const dc = 10 + Math.floor(cat.arm / 2) + Math.floor(bag.fld / 4) + (tgt === 4 ? 5 : tgt === 3 ? 1 : 0) - Math.round(3 * weakK(cat, 'arm')) - Math.round(2 * fk(cat)) - Math.round(3 * hurtF(cat)) + (armMagic(cat) ? 2 : 0);
  return { rb, dc, cat, bag, tgt };
}
const oddsOf = (bonus, need) => clamp((21 - (need - bonus)) / 20, .05, .95);
// tags from steals and pickoffs go on their own play-by-play line, not the batter's
function withTags(arr, fn) { const keep = G.abTags, t = arr || []; G.abTags = t; try { fn(); } finally { G.abTags = keep; } return t.length ? t : null; }

/* ---------- each pitch ---------- */
function stealPrep(newBatter) {
  if (!G.teams || !G.P) return;
  const S0 = runState(); S0.steal = 0; S0.late = 0; S0.go = null; S0.pickAt = null;
  if (newBatter) S0.picks = 0;
  if (!stealOn() || !anyRunner()) { S0.lead = [0, 0, 0, 0]; return; }
  if (!isHuman(BT())) cpuRunners(S0);
  if (!isHuman(FT())) cpuHold(S0);
}
function cpuRunners(S0) {
  const pt = pitcher();
  for (let b = 1; b <= 3; b++) {
    const r = G.bases[b]; if (!r) { S0.lead[b] = 0; continue; }
    const s = runSpd(r, b); let l = s >= 8 ? 2 : s >= 3.5 ? 1 : 0;
    if (l === 2 && (pt.arm >= 8 || holdMagic(pt)) && R() < .5) l = 1;
    if (R() < .15) l = Math.max(0, l - 1);
    if (b === 3 && l === 2 && R() < .5) l = 1;
    S0.lead[b] = l;
  }
  const ch = stealChain(); if (!ch.length || G.strikes === 2 && G.outs === 2) return;
  const r = G.bases[ch[0]], n = stealNums(r, ch[0], S0.lead[ch[0]], 0), p = oddsOf(n.rb, n.dc);
  const home = n.tgt === 4, want = home ? (p > .75 && R() < .12) : (p >= .55 && R() < (p - .45) * .8 * (G.outs === 2 && n.tgt === 3 ? .4 : 1));
  if (!want) return;
  S0.steal = 1;
  const m = magicStealOpt(r); if (m && m.ok && p < .8 && R() < .45 && (m.phys || BT().mana >= (m.cost || 0) + 1)) S0.steal = 2;
}
function cpuHold(S0) {
  let best = 0, bb = 0; for (let b = 1; b <= 3; b++) if (G.bases[b] && S0.lead[b] >= best) { best = S0.lead[b]; bb = b; }
  if (!bb || !best) return;
  let ch = best === 2 ? .3 : runSpd(G.bases[bb], bb) >= 6 ? .12 : .04;
  if (S0.picks >= 2) ch *= .4; ch *= .8 + .15 * G.diff;
  if (R() < ch) S0.pickAt = G.P.cpuT * (.25 + R() * .5);
}
function pickBase() { const S0 = G.run; let bb = 0, best = -1; for (let b = 3; b >= 1; b--) if (G.bases[b] && S0.lead[b] > best) { best = S0.lead[b]; bb = b; } return bb; }

// called every plate frame before the pitch logic; returns true while a throw-over or steal throw has the stage
function stealUpdate(dt, bi, pi) {
  const P = G.P; if (!G.run || !P) return false;
  if (P.stage === 'pickoff') { pickoffTick(); return true; }
  if (P.stage === 'steal') { stealTick(); return true; }
  if (!stealOn() || !anyRunner()) return false;
  const S0 = runState(), pre = P.stage === 'select' || P.stage === 'windup';
  if (pre && bi) {
    if (bi.p.abil) {
      let top = 0; for (let b = 1; b <= 3; b++) if (G.bases[b]) top = Math.max(top, S0.lead[b]);
      const nl = (top + 1) % 3; for (let b = 1; b <= 3; b++) if (G.bases[b]) S0.lead[b] = nl;
      tone(440 + nl * 120, .05, 'square', .03);
      addFx('callout', { text: nl ? (nl === 2 ? 'Big lead' : 'Taking a lead') : 'Back to the bag', col: '#ffd27a', small: true });
    }
    if (bi.p.back) {
      const ch = stealChain();
      if (!ch.length) tone(140, .08, 'square', .04);
      else {
        const m = magicStealOpt(G.bases[ch[0]]);
        S0.steal = S0.steal === 0 ? 1 : S0.steal === 1 && m && m.ok ? 2 : 0;
        S0.late = P.stage === 'windup' && P.t > .35 ? 1 : 0;
        tone(S0.steal ? 700 + S0.steal * 150 : 200, .06, 'square', .04);
        addFx('callout', { text: S0.steal === 2 ? `Magic steal: ${AB[m.id].name}` : S0.steal ? `Steal ${BNAME[ch[0] + 1]}${S0.late ? ' (late jump)' : ''}` : 'Steal called off', col: S0.steal ? '#8fe38a' : '#c9c2ad', small: true });
      }
    }
  }
  if (P.stage === 'select' && pi && pi.p.abil && P.t > .15) { startPickoff(pickBase()); return true; }
  if (P.stage === 'select' && !pi && S0.pickAt != null) { S0.pickAt -= dt; if (S0.pickAt <= 0) { S0.pickAt = null; startPickoff(pickBase()); return true; } }
  return false;
}

/* ---------- pickoffs ---------- */
function startPickoff(b) {
  const P = G.P, S0 = G.run;
  if (!b) { tone(140, .08, 'square', .04); return; }
  if (S0.picks >= 4) { addFx('callout', { text: 'Umpire: enough throws over', col: '#c9c2ad', small: true }); tone(140, .08, 'square', .04); return; }
  S0.picks++; P.stage = 'pickoff'; P.t = 0; P.pick = { b, done: false };
  drain(pitcher(), 1.2, 'pitch'); sfx.whoosh();
  addFx('callout', { text: `Throw over to ${BNAME[b]}!`, col: '#ffd27a', small: true });
}
function pickoffTick() {
  const P = G.P;
  if (!P.pick.done && P.t >= .5) { P.pick.done = true; resolvePickoff(); if (G.phase === 'over') return; }
  if (P.t >= 1.05) {
    if (G.outs >= 3) { P.pick = null; endHalf(); return; }
    P.stage = 'select'; P.t = .2; P.pick = null; P.cpuT = .5 + R() * .7;
    const S0 = runState();
    if (!isHuman(BT())) for (let b = 1; b <= 3; b++) if (S0.lead[b] === 2 && R() < .4) S0.lead[b] = 1;
    if (!isHuman(FT())) cpuHold(S0);
  }
}
function resolvePickoff() {
  const P = G.P, b = P.pick.b, r = G.bases[b], S0 = G.run; if (!r) return;
  const pt = pitcher(), ft = FT(), bag = fielderAt(ft, b), lead = S0.lead[b] | 0, hold = holdMagic(pt);
  const pb = Math.floor(pt.arm / 2) + Math.floor(bag.fld / 3) + (hold ? 2 : 0) + luck(pt) - Math.round(3 * weakK(pt, 'arm')) - Math.round(2 * fk(pt));
  const rb = Math.floor(runSpd(r, b) / 2) + luck(r), mod = [-6, 1, 4][lead], need = 25 + rb;
  let roll, out, wild = false;
  const tags = withTags([], () => {
    if (hold) useTag('magic', `${shortName(pt)}: ${AB[hold].name} holds the runner close`);
    roll = d20(); out = roll !== 1 && roll + pb + mod >= need;
    if (lead > 0 || out) addRoll(`${shortName(pt)} throws over to ${BNAME[b]}`, `d20 + ${pb + mod} ≥ ${need}`, roll, out, roll + pb + mod);
    if (!out) wild = R() < .02 + .25 * weakK(pt, 'arm') + .05 * fk(pt);
  });
  if (out) {
    G.bases[b] = null; G.outs++;
    pst(r).pko++; pst(pt).pk++; pst(pt).a++; pst(bag).po++; pst(pt).outsP++;
    banner('Picked off!', `${r.n} caught leaning off ${BNAME[b]}`, 1.4); sfx.bad(); G.shake = Math.max(G.shake, .12);
    logLine(`Pickoff! ${pt.n} catches ${r.n} leaning off ${BNAME[b]}${G.outs >= 3 ? ' to end the inning' : ''}.`, false, tags);
  } else if (wild) {
    pst(pt).e++;
    const moved = advanceAll(pt);
    banner('Wild throw!', `The pickoff sails away · runners move up`, 1.4); sfx.bad();
    logLine(`${pt.n}'s pickoff throw sails past ${bag.n}. ${moved}`, false, tags);
    checkWalkoff();
  } else {
    addFx('callout', { text: `${shortName(r)} dives back`, col: '#c9c2ad', small: true }); sfx.mitt();
  }
  runState();
}
// every runner moves up a base (wild throws); returns a sentence
function advanceAll(pt) {
  const b = G.bases, names = []; let runs = 0;
  if (b[3]) { scoreRun(b[3]); pst(pt).ra++; runs++; names.push(`${b[3].n} scores`); b[3] = null; }
  for (const k of [2, 1]) if (b[k]) { b[k + 1] = b[k]; names.push(`${b[k + 1].n} to ${BNAME[k + 1]}`); b[k] = null; }
  return names.length ? names.join(', ') + '.' : '';
}

/* ---------- steals ---------- */
function stealOnRelease(pc) {
  const S0 = G.run; if (!S0 || !stealOn() || !S0.steal) return;
  const chain = stealChain(); if (!chain.length) { S0.steal = 0; return; }
  const r = G.bases[chain[0]], go = { chain, magic: null, tags: [], cancel: false };
  if (S0.steal === 2) {
    const m = magicStealOpt(r);
    if (m && m.ok) withTags(go.tags, () => {
      if (m.phys) { drain(r, m.stam, 'skill'); useTag('skill', `${shortName(r)}: ${AB[m.id].name}`); }
      else { BT().mana -= m.cost; drain(r, 4 * m.cost, 'spell', 'run'); useTag('magic', `${shortName(r)}: ${AB[m.id].name}`); }
      abUse(r, m.id); go.magic = m;
    });
    if (go.magic) addFx('abil', { text: AB[go.magic.id].name, side: 'bat' });
  }
  S0.go = go;
  if (isHuman(FT()) || G.mode === 'demo') addFx('callout', { text: chain.length > 1 ? 'Double steal!' : `${shortName(r)} is going!`, col: '#8fe38a', small: true });
}
// when the pitch is settled: a foul, walk or hit batter calls the steal off; otherwise shorten the pause before the throw
function stealMark(P, code) {
  const go = G.run && G.run.go; if (!go) return;
  if (P.fouled || code === 'BB' || code === 'HBP' || (code === 'K' && G.outs + 1 >= 3)) {
    go.cancel = true; if (P.fouled) addFx('callout', { text: 'Foul: runners go back', col: '#c9c2ad', small: true });
  } else P.resT = Math.min(P.resT, .5);
}
function stealAfter(code) {
  if (code === 'CS3') { endHalf(); return true; }
  const S0 = G.run, go = S0 && S0.go; if (!go) return false;
  if (go.cancel) { S0.go = null; return false; }
  const P = G.P; P.stage = 'steal'; P.t = 0; P.stl = { code, go, done: false };
  return true;
}
function stealTick() {
  const P = G.P, st = P.stl;
  if (!st.done && P.t >= .55) { st.done = true; resolveSteal(); if (G.phase === 'over') return; }
  if (P.t >= 1.05) {
    const code = G.outs >= 3 && st.code !== 'K' ? 'CS3' : st.code;
    P.stage = 'result'; P.t = 0; P.resT = 1.1; P.result = { big: st.big, small: st.small, code };
  }
}
function resolveSteal() {
  const P = G.P, st = P.stl, go = st.go, S0 = G.run, pc = P.pitch, pt = pitcher();
  const from = go.chain[0], r = G.bases[from], lead = S0.lead[from] | 0; S0.go = null;
  if (!r) { st.big = 'Steal'; st.small = ''; return; }
  const n = stealNums(r, from, lead, S0.late | 0); let rb = n.rb; const { dc, cat, bag, tgt } = n;
  let roll, safe, wild = false, auto = false;
  const tags = withTags(go.tags, () => {
    if (pc && pc.fx === 'frost') { rb += 2; useTag('magic', `${pc.name}: slow to the plate`); }
    if (pc && pc.fx === 'meteor') { rb += 3; useTag('magic', `${pc.name}: a long way down`); }
    if (pc && pc.T / PITCH_SCALE >= .62 && pc.fx !== 'frost') rb += 1;
    if (pc && pc.T / PITCH_SCALE < .5) rb -= 1;
    if (pc && pc.fh0 < 1.2) rb += 2;
    if (go.magic) { if (go.magic.bonus >= 99) auto = true; else rb += go.magic.bonus; }
    const am = armMagic(cat); if (am) useTag(AB[am].phys ? 'skill' : 'magic', `${shortName(cat)}: ${AB[am].name} on the throw`);
    if (holdMagic(pt)) useTag('magic', `${shortName(pt)}: ${AB[holdMagic(pt)].name} slows the jump`);
    if (auto) { safe = true; useTag('magic', `${shortName(r)} blinks to ${BNAME[tgt]}`); }
    else {
      roll = d20(); safe = roll === 20 || (roll !== 1 && roll + rb >= dc);
      addRoll(`${shortName(r)} steals ${BNAME[tgt]}`, `d20 + ${rb} ≥ ${dc}`, roll, safe, roll + rb);
      if (tgt !== 4) wild = R() < .05 + .25 * weakK(cat, 'arm') + .04 * fk(cat);
    }
  });
  const b = G.bases, trail = go.chain.slice(1); let text, runs = 0;
  b[from] = null;
  if (safe || wild) {
    const dest = wild && tgt < 4 ? tgt + 1 : tgt;
    if (dest >= 4) { scoreRun(r); pst(pt).ra++; runs++; } else b[dest] = r;
    pst(r).sb++;
    text = wild ? `${r.n} steals ${BNAME[tgt]} and takes ${BNAME[dest]} when ${cat.n}'s throw gets away` : tgt === 4 ? `${r.n} steals home!` : `${r.n} steals ${BNAME[tgt]}`;
    if (wild) pst(cat).e++;
    st.big = tgt === 4 ? 'Steal of home!' : wild ? 'Stolen base + error' : 'Stolen base!'; st.small = `${shortName(r)} is safe at ${BNAME[dest]}`;
    if (go.magic) text += ` with ${AB[go.magic.id].name}`;
    sfx.crowd(1.2); if (tgt === 4) musicSting('run');
  } else {
    G.outs++; pst(r).cs++; pst(cat).a++; pst(bag).po++; pst(pt).outsP++;
    text = `${r.n} is caught stealing ${BNAME[tgt]}, ${shortName(cat)} to ${shortName(bag)}`;
    st.big = 'Caught stealing!'; st.small = `${shortName(cat)} guns down ${shortName(r)}`;
    sfx.bad(); G.shake = Math.max(G.shake, .12);
  }
  for (const k of trail) { const p = b[k], d = k + 1; if (!p) continue; if (d >= 4) { b[k] = null; scoreRun(p); pst(pt).ra++; runs++; } else if (!b[d]) { b[k] = null; b[d] = p; } else continue; pst(p).sb++; text += `; ${p.n} takes ${BNAME[d]}`; }
  logLine(`${text}${G.outs >= 3 && !safe && !wild ? ' to end the inning' : ''}.`, false, tags);
  banner(st.big, st.small, 1.2);
  runState();
  if (runs) checkWalkoff();
}
// hit-and-run: runners who were going get a head start on a ball in play; leads help everyone
function stealInPlay(runners) {
  const S0 = G.run; if (!S0 || !stealOn()) { if (S0) S0.go = null; return; }
  const go = S0.go; S0.go = null;
  for (const r of runners) {
    if (r.origin < 1) continue;
    const lead = S0.lead[r.origin] | 0, going = go && go.chain.includes(r.origin);
    r.s = r.origin + LEAD_S[lead] + (going ? .22 : 0);
    if (going) { r.target = Math.max(r.target, r.origin + 1); r.holdAt = null; if (go.magic) r.fx.spd = { t: 2, m: 1.4 }; }
  }
}

/* ---------- drawing ---------- */
// runners in the distance on the plate view: off the bag by their lead, sprinting on a steal
function runnerDrawS(b) {
  const S0 = G.run, P = G.P; if (!S0 || !stealOn()) return { s: 0, mv: false };
  let s = LEAD_S[S0.lead[b] | 0], mv = false;
  const go = S0.go || (P && P.stl && !P.stl.done ? P.stl.go : null);
  if (go && go.chain.includes(b) && P) {
    if (P.stage === 'flight') { s += .4 * clamp(P.t / P.pitch.Ta, 0, 1); mv = true; }
    else if (P.stage === 'result') { s += .4 + .1 * clamp(P.t / .5, 0, 1); mv = true; }
    else if (P.stage === 'steal') { s += .5 + .5 * clamp(P.t / .55, 0, 1); mv = P.t < .55; }
  }
  if (P && P.stage === 'pickoff' && P.pick && P.pick.b === b) s *= 1 - clamp((P.t - .15) / .3, 0, 1);
  return { s: Math.min(s, 1), mv };
}
function drawPlateRunners(c, bt) {
  for (let b = 1; b <= 3; b++) {
    const p = G.bases[b]; if (!p) continue;
    const { s, mv } = runnerDrawS(b), A = BASE[b], B = BASE[(b + 1) % 4];
    const ox = (b === 2 ? 4 : b === 1 ? -3 : 3) * (1 - s), x = lerp(A.x, B.x, s) + ox, y = lerp(A.y, B.y, s) - 2 * (1 - s);
    const q = proj(x, y, 0);
    drawFig(c, p.kind, q.x, q.y, 6.4 * PXF * q.k, bt.def, { num: p.num, run: mv ? G.time * 20 : 0, flip: B.x < A.x });
  }
  const P = G.P; if (!P) return;
  // the ball on a throw-over or on the catcher's throw
  let from, to, u = -1;
  if (P.stage === 'pickoff' && P.pick && P.t < .5) { from = { x: -.75, y: 60.5, h: 5.5 }; const B = BASE[P.pick.b]; to = { x: B.x, y: B.y, h: 4 }; u = P.t / .5; }
  if (P.stage === 'steal' && P.stl && P.t < .55) { const tgt = P.stl.go.chain[0] + 1; if (tgt < 4) { from = { x: 0, y: 4, h: 5.5 }; const B = BASE[tgt]; to = { x: B.x, y: B.y, h: 3 }; u = P.t / .55; } }
  if (u >= 0) {
    const q = proj(lerp(from.x, to.x, u), lerp(from.y, to.y, u), lerp(from.h, to.h, u) + Math.sin(u * Math.PI) * 4);
    circ(c, q.x, q.y, Math.max(2.2, 3.4 * q.k * PXF / 6), '#f4ecd8');
  }
}
// lead ticks on the count diamond, and a small runner panel under the count
function drawRunPanel(c, px, pw, x0, y0, s) {
  if (!G.teams || !G.P || G.phase !== 'plate' || !stealOn() || !anyRunner()) return;
  const S0 = runState(), bt = BT(), ft = FT();
  const dirs = [null, [-1, -1], [-1, 1], [1, 1]], at = [null, [x0 + s, y0], [x0, y0 - s], [x0 - s, y0]];
  for (let b = 1; b <= 3; b++) if (G.bases[b]) for (let i = 0; i < (S0.lead[b] | 0); i++) circ(c, at[b][0] + dirs[b][0] * (11 + 5 * i), at[b][1] + dirs[b][1] * (11 + 5 * i), 2.2, '#ffd27a');
  const hb = isHuman(bt) ? keyHints(bt.ctl) : null, hp = isHuman(ft) ? keyHints(ft.ctl) : null;
  const leads = []; for (let b = 1; b <= 3; b++) if (G.bases[b]) leads.push(`${['', '1B', '2B', '3B'][b]} ${LEAD_TXT[S0.lead[b] | 0]}`);
  const lines = [leads.join(' · ')];
  if (hb) { const ch = stealChain(), m = ch.length ? magicStealOpt(G.bases[ch[0]]) : null; lines.push(S0.steal ? (S0.steal === 2 ? `STEAL · ${AB[m.id].name}` : `STEAL ${BNAME[ch[0] + 1]}`).toUpperCase() : `${hb.ab} lead · ${hb.back} steal${m && m.ok ? ` (${hb.back}×2 magic)` : ''}`); }
  else if (hp) lines.push(`${hp.ab} throw over · ${Math.max(0, 4 - S0.picks)} left`);
  c.font = F_HUD(16); let w = 0; lines.forEach((l, i) => { c.font = i === 0 ? F_TXT(12, 600) : F_HUD(16); w = Math.max(w, c.measureText(l).width); });
  const h = 12 + lines.length * 17, qw = Math.ceil(w) + 22, qx = px - qw - 8;
  panel(c, qx, 10, qw, h);
  lines.forEach((l, i) => txt(c, l, qx + 10, 26 + i * 17, i === 0 ? F_TXT(12, 600) : F_HUD(16), i === 0 ? COL.dim : S0.steal && hb ? '#8fe38a' : COL.faint));
}
