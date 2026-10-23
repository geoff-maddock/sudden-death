/* ================= Power tips: pros and cons of whatever you have picked ================= */
// When a human side picks a batting stance, a pitch, a runner spell or a fielding spell, a small box beside
// that panel lists what it's good for (green +) and what it costs or risks (red −), with notes (☾, tiers) in grey.
// Tips read the situation: the count, the runners, fatigue, mana left, the moon. Bright for a moment after a
// change, then they dim. Settings > Power tips, or press I, turns them on and off.
PREF_DEFS.push({ k: 'tips', label: 'Power tips', opts: [[true, 'On'], [false, 'Off']], help: 'A small box beside the batting, pitching, running and fielding panels with the pros and cons of what you have picked, for this situation. I toggles it in a game.' });
{ const g = prefGet, s = prefSet;
  prefGet = function (k) { return k === 'tips' ? SET.tips !== false : g.apply(this, arguments); };
  prefSet = function (k, v) { if (k === 'tips') { SET.tips = v; saveSettings(); return; } return s.apply(this, arguments); }; }
const tipsOn = () => SET.tips !== false;

const pct = x => Math.round(x * 100);
const inj = () => typeof injOn === 'function' && injOn();
function moonNote(id, T) { try { if (MOON && skyOn() && MOON_SPELL[id] != null && MOON_SPELL[id] === moonIdx()) T.note.push(`☾ ${MOON[moonIdx()]}: 25% stronger right now`); } catch (e) { } }
function tierNote(p, type, T) { const t = tierOf(p, type); if (t > 1) T.note.push(`Tier ${'I'.repeat(t)}: stronger${t >= 3 ? ', no stamina cost' : ''}`); }
function manaCon(cost, team, T) { if (cost) T.con.push(`${cost} mana (${Math.max(0, team.mana - cost)} left after)`); }
const shortDesc = s => { const f = String(s).split('. ')[0]; return f.length > 78 ? f.slice(0, 75) + '…' : f; };

/* ---------- batting stances ---------- */
const BAT_TIP = {
  bunt: (p, m) => [['Huge reach and timing window', 'Soft roller down the 3B line'], ['Almost no power']],
  axe: (p, m) => [[`Sweet spot +${pct(.6 * m)}%, power +${pct(.25 * m)}%`], []],
  crush: (p, m) => [[`Power +${pct(.5 * m)}%: extra-base hits`], ['Sweet spot −20%: more whiffs']],
  seismic: () => [['A fair hit staggers every fielder 1.5 s: extra bases'], []],
  shriek: (p, m) => [[`Pitch scatters ×${(1 + 2 * m).toFixed(1)}: more balls and walks`], ['A wild one can hit the batter']],
  eagle: () => [['Marks where the pitch will cross', 'Beats Phantom and Hex pitches'], ['No extra power or reach']],
  dispel: (p, m) => [['Turns a magic pitch into a plain one', `Sweet spot +${pct(.15 * m)}%`], []],
  undying: () => [['Strike three becomes a foul'], []],
  gaze: (p, m) => [[`Pitch ${pct(.3 * m)}% slower, break mostly gone`], []],
  sticky: (p, m) => [[`Sweet spot +${pct(.4 * m)}%`], ['Power −20%']],
  pact: (p, m) => [[`Power +${pct(.4 * m)}%, sweet spot +${pct(.1 * m)}%`], []],
  choke: () => [['Sweet spot +30%'], ['Power −10%']],
  uppercut: () => [['Launch +12°, power +15%: fly balls and homers'], ['More pop-ups']],
  slap: () => [['Timing window +40%, always on the ground'], ['Power −30%']],
  grip: () => [['Power +25%'], ['Sweet spot −5%']],
};
function stanceTip(s, bat, bt) {
  const T = { pro: [], con: [], note: [] }, two = G.strikes === 2, on = G.bases[1] || G.bases[2] || G.bases[3];
  if (s.k === 'normal') { T.pro.push('Balanced reach and power'); if (fatigue(bat) < .35) T.con.push('Winded: smaller circle, less power'); }
  else if (s.k === 'power') { T.pro.push('Power +25%: extra-base hits'); T.con.push('Swing circle −22%'); if (two) T.con.push('2 strikes: a miss is strike three'); if (bat.con <= 4) T.con.push(`Low CON (${bat.con}): hard to connect`); }
  else if (s.k === 'contact') { T.pro.push('Swing circle +25%: more contact'); if (two) T.pro.push('Protects the plate with 2 strikes'); T.con.push('Power −20%'); }
  else if (s.k === 'phys') { const [p, c] = BAT_TIP[s.ph](); T.pro.push(...p); T.con.push(...c, `⚡${s.stam} stamina${fatigue(bat) < .35 ? ' (he is winded)' : ''}`); if (inj()) T.con.push('Small strain risk'); }
  else if (s.k === 'ab') {
    const f = BAT_TIP[s.ab], m = abPow(bat, s.ab); if (f) { const [p, c] = f(bat, m); T.pro.push(...p); T.con.push(...c); } else T.pro.push(shortDesc(AB[s.ab].desc));
    if (s.ab === 'bunt') { if (on && G.outs < 2) T.pro.unshift('Moves the runners up'); else if (bat.spd < 7) T.con.push('No runners to move, and he is no burner'); }
    if (s.ab === 'undying' && !two) T.con.unshift('Only matters with 2 strikes');
    if (s.ab === 'dispel' && !(pitcher().pitches || []).some(k => PITCHES[k] && PITCHES[k].magic)) T.con.push('This pitcher has no magic pitches');
    if (s.ab === 'pact' && inj()) T.con.push('Blood can bite back: injury risk');
    manaCon(s.cost, bt, T); tierNote(bat, 'bat', T); moonNote(s.ab, T);
  } else if (s.k === 'ult') { T.pro.push(shortDesc(ULT[s.ult].desc)); T.con.push('Once a game · 3 mana'); T.note.push(`Lasts ${ULT_TURNS} at-bats or the half-inning`); }
  else if (s.k === 'gear') {
    const g = GEAR[s.gear], it = s.it;
    if (g.pw) T.pro.push(`Power +${pct(g.pw - 1)}%${g.moonPw ? ` (+${pct(g.moonPw - 1)}% at the full moon)` : ''}`); if (g.r) T.pro.push(`Sweet spot +${pct(g.r - 1)}%`); if (g.win) T.pro.push(`Timing window +${pct(g.win - 1)}%`);
    if (g.launch) T.pro.push(`Launch +${g.launch}°`); if (g.stagger) T.pro.push('Fair hits stagger the fielders');
    T.con.push(g.recharge ? `${it.uses} use${it.uses === 1 ? '' : 's'} left this game` : `${it.uses} charge${it.uses === 1 ? '' : 's'} left, then gone`);
  }
  return T;
}

/* ---------- pitches ---------- */
const PITCH_TIP = {
  fireball: ['Contact risks a scorched bat (d20 + CON vs 16)'], meteor: ['Plunges almost straight down'], frost: ["The batter's cursor crawls at 35%"],
  hex: ['Wobbles unpredictably in flight'], phantom: ['Vanishes mid-flight: no marker to read'], change: ['Looks like a heater, arrives late'],
  slider: ['Late sideways bite'], curve: ['Big twelve-to-six drop'],
};
function pitchTip(p, pt, ft) {
  const T = { pro: [], con: [], note: [] }, bat = batter(), last = (G.abPitches || []).slice(-1)[0];
  if (p.ult) { T.pro.push(shortDesc(ULT[p.k] ? ULT[p.k].desc : p.desc)); T.con.push('Once a game · 3 mana'); return T; }
  const g = p.gear ? GEAR[p.gear] : null, t = p.T * PITCH_SCALE * (g && g.fast ? g.fast : 1);
  if (PITCH_TIP[p.fx] || PITCH_TIP[p.k]) T.pro.push(...(PITCH_TIP[p.fx] || PITCH_TIP[p.k]));
  if (t <= .66) T.pro.push(`Fast: ${t.toFixed(2)} s to the plate`);
  else if (t >= .9 && !(p.k === 'change' && last && /heater|fastball|fireball/i.test(last.pitch))) T.con.push(`Slow: ${t.toFixed(2)} s, easier to time`);
  if (p.k === 'change' && last && /heater|fastball|fireball/i.test(last.pitch)) T.pro.unshift('After a fastball: wrecks his timing');
  const brk = Math.abs(p.bx) + Math.abs(p.bh); if (brk > .5 && !PITCH_TIP[p.k]) T.pro.push('Big break');
  let ctrl = p.ctrl * (g && g.ctrl ? g.ctrl : 1);
  if (ctrl <= .12) T.pro.push('Pinpoint control'); else if (ctrl >= .18) T.con.push('Wild: scatters more than most');
  if (g) { if (g.dead) T.pro.push(`Anything hit off it loses ${pct(1 - g.dead)}% power`); if (g.fast) T.pro.push(`${pct(1 - g.fast)}% quicker`); if (g.ctrl) T.pro.push(`Scatter −${pct(1 - g.ctrl)}%`); T.con.push(g.recharge ? `${p.it.uses} use${p.it.uses === 1 ? '' : 's'} left this game` : `${p.it.uses} charge${p.it.uses === 1 ? '' : 's'} left, then gone`); }
  // the situation
  if (p.fx === 'fire' && bat.con >= 8) T.con.push(`${shortName(bat)} has CON ${bat.con}: often beats the scorch`);
  if ((p.fx === 'phantom' || p.fx === 'hex') && bat.bat === 'eagle' && BT().mana >= 1) T.con.push(`${shortName(bat)} can Eagle Eye it`);
  if (p.magic && bat.bat === 'dispel' && BT().mana >= 1) T.con.push(`${shortName(bat)} can Dispel it`);
  if (G.balls === 3 && ctrl >= .16) T.con.push('3 balls: a miss walks him');
  if (fatigue(pt) < .5) T.con.push(`${shortName(pt)} is tired: ~${pct(1.8 * fk(pt))}% more scatter`);
  if (p.T >= .62 && typeof stealOn === 'function' && stealOn() && (G.bases[1] || G.bases[2])) T.con.push('Slow to the plate: helps base stealers');
  if (p.magic && p.cost) { manaCon(p.cost, ft, T); if (inj()) T.note.push('Magic can bite back: tiny injury risk'); tierNote(pt, 'pitch', T); }
  if (!T.pro.length && !T.con.length) T.pro.push('A plain, dependable pitch');
  return T;
}

/* ---------- running and fielding spells ---------- */
const RUN_TIP = {
  shadowstep: () => [['Blinks to the next base instantly'], ['Next base must be empty']],
  sprint: (m) => [[`Speed ×2 for ${(2.5 * m).toFixed(1)} s`], []], fleet: (m) => [[`Speed ×1.6 for ${(3 * m).toFixed(1)} s`], []], glide: (m) => [[`Speed ×1.5 for ${(3 * m).toFixed(1)} s`], []],
  swarm: (m) => [[`Untaggable, speed ×1.4 for ${(2.5 * m).toFixed(1)} s`], []], invis: (m) => [[`Can't be tagged, forced or thrown at for ${(3 * m).toFixed(1)} s`], []],
  bullrush: () => [['A tag needs d20 11+ or the fielder is trampled'], ['Collisions can injure']],
  burst: () => [['Speed ×1.6 for 1.2 s'], ['Needs him already running']], hookslide: () => [['Next tag needs d20 12+'], []], barrel: () => [['Next tag needs d20 9+ or the ball drops'], []],
  haste: () => [['Speed ×1.5 for 2.5 s'], ['Once per play']], ghostslide: () => [['Untaggable for 1.5 s'], ['Once per play']],
};
function runTip(o, r, bt) {
  const T = { pro: [], con: [], note: [] };
  if (o.ult) { T.pro.push(shortDesc(AB[o.id].desc)); T.con.push('Once a game · 3 mana'); }
  else { const f = RUN_TIP[o.id], m = o.own && !o.phys ? abPow(r.p, o.id) : 1; if (f) { const [p, c] = f(m); T.pro.push(...p); T.con.push(...c); } else T.pro.push(shortDesc(AB[o.id].desc)); }
  if (o.phys) { T.con.push(`⚡${o.stam} stamina`); if (inj()) T.con.push('Small strain risk'); } else if (!o.ult) manaCon(o.cost, bt, T);
  if (!o.ok && o.why) T.con.unshift(`Not now: ${o.why}`);
  if (o.own && !o.phys && !o.ult) moonNote(o.id, T);
  return T;
}
const FIELD_TIP = {
  devour: () => [['Eats the runner: he is out'], ['Needs d20 12+ (16+ on a base); a miss stuns the ogre']],
  pounce: (m) => [[`Leaps ${Math.round(45 * m)} ft toward the ball`], []], boulder: () => [['Next throw flies 2.2× faster'], []],
  quake: (m) => [[`Every runner stumbles ${(1.3 * m).toFixed(1)} s`], ['Stone Skin and invisible runners shrug it off']],
  flight: (m) => [[`Airborne ${(4 * m).toFixed(1)} s: double speed, can rob homers`], []], haunt: (m) => [[`Nearest runner flees backward ${(1.2 * m).toFixed(1)} s`], []],
  mesmer: (m) => [[`Freezes a runner ${(1.8 * m).toFixed(1)} s`], ['Range 120 ft']], telek: () => [['Next throw arrives instantly'], []],
  petrify: (m) => [[`Turns a runner to stone for ${(3 * m).toFixed(1)} s`], ['Needs d20 10+']], web: (m) => [[`Runner slowed to 30% for ${(3 * m).toFixed(1)} s`], ['Range 140 ft']],
  block: () => [['A runner scoring needs d20 11+ or is out'], ['Lasts this play only']],
  dive: () => [['Lays out 25 ft toward the ball'], ['Can jam a shoulder']], leap: () => [['Reaches 8 ft higher for 2 s: rob the wall'], []], rocket: () => [['Next throw ×1.5 speed'], []],
  gust: () => [['Next throw ×1.8 speed'], ['Once per play']], roots: () => [['Lead advancing runner at 40% for 2 s'], ['Once per play']],
};
function fieldTip(o, ft) {
  const T = { pro: [], con: [], note: [] };
  if (o.ult) { T.pro.push(shortDesc(AB[o.ab].desc)); T.con.push('Once a game · 3 mana'); }
  else { const f = FIELD_TIP[o.ab], m = o.f && !o.phys && !o.team ? abPow(o.f.p, o.ab) : 1; if (f) { const [p, c] = f(m); T.pro.push(...p); T.con.push(...c); } else T.pro.push(shortDesc(AB[o.ab].desc)); }
  if (o.target) T.note.push(`Target: ${shortName(o.target.p)}`);
  if (o.phys) T.con.push(`⚡${o.stam} stamina`); else if (!o.ult) manaCon(o.cost, ft, T);
  if (!o.ok && o.why) T.con.unshift(`Not now: ${o.why}`);
  if (o.f && !o.phys && !o.team && !o.ult) moonNote(o.ab, T);
  return T;
}

/* ---------- drawing: a small box above the panel ---------- */
const TIPSEEN = {};
function tipAlpha(slot, key) { const s = TIPSEEN[slot]; if (!s || s.k !== key) { TIPSEEN[slot] = { k: key, t: G.time }; return 1; } const a = G.time - s.t; return a < 2.5 ? 1 : a < 3.1 ? 1 - (a - 2.5) / .6 * .42 : .58; }
// short on purpose: situation first, generic traits next, mana last (the gems already show it)
const conRank = t => /^Not now/.test(t) ? 0 : /mana \(/.test(t) ? 3 : /^(Wild|Slow|Power|Sweet|Swing|Almost|Only|No extra|More pop|⚡)/.test(t) ? 2 : 1;
function tipLines(T) { const con = T.con.slice().sort((a, b) => conRank(a) - conRank(b)); return [...T.pro.slice(0, 2).map(t => ['+', t, '#9fe38a']), ...con.slice(0, 2).map(t => ['−', t, '#ff9a8a']), ...T.note.slice(0, 1).map(t => ['·', t, '#c9c2ad'])]; }
function drawTipBox(c, x, yBottom, w, T, alpha, alt) {
  const lines = tipLines(T); if (!lines.length) return;
  c.save(); c.font = F_TXT(12.5, 600);
  const rows = [];
  for (const [mk, t, col] of lines) { let m = mk, line = ''; for (const wd of t.split(' ')) { const tl = line ? line + ' ' + wd : wd; if (c.measureText(tl).width > w - 30 && line) { rows.push([m, line, col]); line = wd; m = ''; } else line = tl; } rows.push([m, line, col]); }
  const h = 10 + rows.length * 15; let y = yBottom - h;
  if (alt && y < 132) { x = alt.x; y = alt.top; } // no room above the panel: sit beside it
  c.globalAlpha = alpha; rr(c, x, y, w, h, 5); c.fillStyle = 'rgba(8,10,12,.74)'; c.fill(); c.strokeStyle = 'rgba(239,230,207,.12)'; c.lineWidth = 1; c.stroke();
  rows.forEach(([m, t, col], i) => { const yy = y + 17 + i * 15; if (m) txt(c, m, x + 9, yy, F_TXT(13, 800), col); txt(c, t, x + 21, yy, F_TXT(12.5, 600), i && !m ? 'rgba(236,228,205,.82)' : 'rgba(236,228,205,.92)'); });
  c.restore();
}
const tipsCanvas = () => tipsOn() && G.teams && !(typeof MP_Q !== 'undefined' && MP_Q.matches);
function plateTips(c) {
  const P = G.P; if (!P || !tipsCanvas()) return;
  const pre = P.stage === 'select' || P.stage === 'windup', bt = BT(), ft = FT();
  if (pre && isHuman(bt)) { const s = P.stances[P.si]; if (s) drawTipBox(c, 10, 312, 226, stanceTip(s, batter(), bt), tipAlpha('bat', s.name + G.strikes + G.balls)); }
  if (P.stage === 'select' && isHuman(ft)) { const p = P.pitches[P.pi]; if (p) drawTipBox(c, W - 236, 312, 226, pitchTip(p, pitcher(), ft), tipAlpha('pit', p.name + G.balls)); }
}
function fieldTips(c) {
  const L = PL; if (!L || L.endT !== null || !tipsCanvas()) return;
  const bt = BT(), ft = FT();
  if (isHuman(bt)) {
    const list = alive().sort((a, b) => b.s - a.s), r = list[clamp(L.sel, 0, Math.max(0, list.length - 1))];
    if (r) { const sp = runSpells(r), o = sp[clamp(L.selR || 0, 0, sp.length - 1)];
      if (o) { const h = 32 + list.length * 38 + 18 + sp.length * 22 + 36; drawTipBox(c, 10, H - h - 16, 236, runTip(o, r, bt), tipAlpha('run', o.id + r.p.n + o.ok), { x: 254, top: H - h - 10 }); } }
  }
  if (isHuman(ft) && L.fabs && L.fabs.length) {
    const fl = L.fabs, o = fl[clamp(L.selF, 0, fl.length - 1)];
    if (o) { const fh = 34 + fl.length * 35 + 40; drawTipBox(c, W - 260, H - fh - 16, 250, fieldTip(o, ft), tipAlpha('fld', o.ab + (o.f ? o.f.p.n : '') + o.ok), { x: W - 528, top: H - fh - 10 }); }
  }
}
{ const o = drawPlateHud; drawPlateHud = function (c) { o.apply(this, arguments); try { plateTips(c); } catch (e) { } }; }
{ const o = drawFieldHud; drawFieldHud = function (c) { o.apply(this, arguments); try { fieldTips(c); } catch (e) { } }; }

/* ---------- the phone panel: one line of tips under the buttons ---------- */
{ const o = mpRender; mpRender = function () {
  o.apply(this, arguments);
  try {
    let el = mpEl.querySelector('.mp-tip');
    const P = G.P, show = tipsOn() && !mpEl.hidden && P && G.teams;
    let T = null;
    if (show) { if (isHuman(BT()) && (P.stage === 'select' || P.stage === 'windup')) T = stanceTip(P.stances[P.si], batter(), BT()); else if (isHuman(FT()) && P.stage === 'select') T = pitchTip(P.pitches[P.pi], pitcher(), FT()); }
    if (!T) { if (el) el.remove(); return; }
    const html = tipLines(T).map(([m, t, col]) => `<span style="color:${col}">${m}</span> ${esc(t)}`).join('<br>');
    if (!el) { el = document.createElement('p'); el.className = 'mp-tip'; const ex = mpEl.querySelector('.mp-extra'); if (ex) mpEl.insertBefore(el, ex); else mpEl.appendChild(el); }
    if (el.innerHTML !== html) el.innerHTML = html;
  } catch (e) { }
}; }
{ const st = document.createElement('style'); st.textContent = '.mp-tip{margin:0;font-size:13px;line-height:1.4;color:var(--dim);background:rgba(0,0,0,.2);border-radius:6px;padding:6px 8px}'; document.head.appendChild(st); }

/* ---------- toggles ---------- */
window.addEventListener('keydown', e => {
  if (e.code !== 'KeyI' || e.repeat || e.ctrlKey || e.metaKey || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) || PAGE !== 'play') return;
  SET.tips = !tipsOn(); saveSettings(); for (const k in TIPSEEN) delete TIPSEEN[k];
  if (G.teams && G.phase !== 'menu') addFx('callout', { text: `Power tips ${tipsOn() ? 'on' : 'off'} · I`, col: '#d6c4ff', small: true });
});
try { const b = document.getElementById('bTips'); if (b) b.closest('p').insertAdjacentHTML('afterend', '<p class="hint"><b>Power tips</b> (on by default; <kbd>I</kbd> or <a href="#settings" data-page="settings">Settings</a> to switch off): when you pick a batting stance, a pitch, a runner spell or a fielding spell, a small box beside that panel lists its pros (green +) and cons (red −) for this situation: the count, the runners, fatigue, mana left, the moon. It dims after a moment so it stays out of the way.</p>'); } catch (e) { }
try { if (PAGE === 'settings') renderSettings(); } catch (e) { }
