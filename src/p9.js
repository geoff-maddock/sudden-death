/* p9: settings, and the music. Every place has a theme; in a fight, when either side is close to elimination,
   the theme kicks into its exciting version: faster, with a driving arpeggio and full drums. */
const SET = Object.assign({ music: true, sfx: true, mvol: .55, svol: .8, diff: 1 }, (() => { try { return JSON.parse(localStorage.getItem('sd-settings') || '{}'); } catch (e) { return {}; } })());
SND.on = SET.sfx;
function saveSettings() { try { localStorage.setItem('sd-settings', JSON.stringify(SET)); localStorage.setItem('sd-sound', SET.sfx ? 'on' : 'off'); } catch (e) { } }
let SFX_BUS = null, MUS_BUS = null;
function sfxOut(c) { if (!SFX_BUS || SFX_BUS.context !== c) { SFX_BUS = c.createGain(); SFX_BUS.gain.value = SET.svol; SFX_BUS.connect(c.destination); } return SFX_BUS; }
function musOut(c) { if (!MUS_BUS || MUS_BUS.context !== c) { MUS_BUS = c.createGain(); MUS_BUS.gain.value = 0; MUS_BUS.connect(c.destination); } return MUS_BUS; }

/* ---------- the themes ---------- */
const SCALES = { aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], mixo: [0, 2, 4, 5, 7, 9, 10] };
const _ = null;
const THEMES = {
  title: { name: 'The Brimstone League', bpm: 92, root: 50, scale: 'aeolian', prog: [0, 5, 3, 4], lead: 'triangle', bass: 'sine', pad: 'triangle',
    mel: [7, _, _, 9, 10, _, 9, 7, 5, _, _, _, 4, _, 5, _, 7, _, _, 7, 9, _, 10, _, 12, _, _, _, 11, _, _, _, 10, _, _, 9, 7, _, 5, _, 7, _, _, 5, 3, _, 2, _, 4, _, _, 5, 4, _, 2, _, 1, _, _, _, _, _, _, _],
    bassPat: 'x.......x...x...', drums: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' } },
  act0: { name: 'The Sunken Dugout', bpm: 104, root: 45, scale: 'mixo', prog: [0, 3, 4, 0], lead: 'square', bass: 'triangle', pad: 'square', organ: 1,
    // a ballpark organ riff, drowned
    mel: [0, _, 2, 4, 7, _, 4, _, 7, _, _, _, _, _, _, _, 5, _, 4, _, 2, _, 4, _, 0, _, _, _, _, _, _, _, 0, _, 2, 4, 7, _, 9, _, 7, _, 4, _, 5, _, 4, _, 2, _, _, 4, 2, _, 1, _, 0, _, _, _, _, _, _, _],
    bassPat: 'x...x.x.x...x.x.', drums: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
  act1: { name: 'The Rimegrave Arena', bpm: 112, root: 52, scale: 'harmonic', prog: [0, 5, 3, 4], lead: 'sine', bass: 'triangle', pad: 'sine', bell: 1,
    mel: [7, _, 6, _, 7, _, 9, _, 7, _, _, _, 4, _, _, _, 5, _, 4, _, 2, _, 4, _, 0, _, _, _, _, _, _, _, 7, _, 9, _, 10, _, 11, _, 12, _, _, _, 11, _, 9, _, 7, _, 6, _, 4, _, 6, _, 7, _, _, _, _, _, _, _],
    bassPat: 'x.......x.x.....', drums: { k: 'x.......x.......', s: '........x.......', h: '..x...x...x...x.' } },
  act2: { name: 'The Brimstone Pit', bpm: 120, root: 40, scale: 'phrygian', prog: [0, 1, 0, 6], lead: 'sawtooth', bass: 'sawtooth', pad: 'sawtooth', heavy: 1,
    mel: [7, _, 8, _, 7, _, _, 5, 7, _, _, _, _, _, 3, _, 4, _, 3, _, 1, _, 0, _, 1, _, _, _, _, _, _, _, 7, _, 8, _, 10, _, 8, _, 7, _, 5, _, 3, _, 1, _, 0, _, _, _, 1, _, 3, _, 0, _, _, _, _, _, _, _],
    bassPat: 'x.x...x.x.x...x.', drums: { k: 'x...x...x...x...', s: '....x.......x..x', h: 'x.xxx.xxx.xxx.xx' } },
};
const MODE_VOL = { calm: .75, fight: 1, hype: 1.05 };

/* ---------- the sequencer ---------- */
const MUS = { theme: null, mode: null, want: null, wantMode: null, step: 0, next: 0, timer: null, fading: 0, label: '' };
function noteHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function degNote(T, deg, oct = 0) { const sc = SCALES[T.scale], n = sc.length, o = Math.floor(deg / n), i = ((deg % n) + n) % n; return T.root + sc[i] + 12 * (o + oct); }
function mnote(c, t, m, dur, type, vol, opts = {}) {
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(noteHz(m), t);
  if (opts.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = 4; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + .1); }
  const a = opts.attack || .01, rel = opts.release || .08;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + Math.max(a, dur - rel)); g.gain.exponentialRampToValueAtTime(.0001, t + dur + rel);
  let out = g;
  if (opts.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; g.connect(f); out = f; }
  o.connect(g); out.connect(musOut(c)); o.start(t); o.stop(t + dur + rel + .05);
}
function mdrum(c, t, kind, vol) {
  if (kind === 'k') { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .14); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .2); o.connect(g).connect(musOut(c)); o.start(t); o.stop(t + .22); return; }
  const len = kind === 's' ? .14 : .04, n = Math.max(1, (c.sampleRate * len) | 0), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = kind === 's' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 's' ? 1800 : 7000;
  const g = c.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(musOut(c)); s.start(t);
}
function playStep(c, T, mode, step, t, spb) {
  const s16 = step % 16, bar = Math.floor(step / 16) % 4, chord = T.prog[bar], hype = mode === 'hype', calm = mode === 'calm';
  const st = spb / 4; // seconds per 16th
  // pad: the chord, a bar long
  if (s16 === 0) for (const d of [0, 2, 4]) mnote(c, t, degNote(T, chord + d, 0), st * 16 * .95, T.pad, T.organ ? .018 : .022, { attack: T.organ ? .02 : .25, release: .3, lp: T.heavy ? 900 : 2200 });
  // bass
  const bp = hype ? 'x.x.x.x.x.x.x.x.' : T.bassPat;
  if (bp[s16] === 'x') mnote(c, t, degNote(T, chord, -1) + (hype && s16 % 4 === 2 ? 12 : 0), st * 1.6, T.bass, T.heavy ? .07 : .08, { lp: T.heavy ? 500 : 900, release: .05 });
  // lead melody: an octave up when it's tense
  const m = T.mel[step % 64];
  if (m != null && !(calm && step % 2)) { let len = 1; while (len < 6 && T.mel[(step + len) % 64] === null) len++; mnote(c, t, degNote(T, m, hype ? 1 : 0) + 12, st * len * .9, T.lead, T.bell ? .05 : T.lead === 'sawtooth' ? .03 : .045, { vib: T.organ || T.lead === 'triangle', release: T.bell ? .4 : .08, lp: T.lead === 'sawtooth' ? 1800 : 5000 }); if (T.bell) mnote(c, t, degNote(T, m, hype ? 2 : 1) + 12, st * .5, 'sine', .015, { release: .5 }); }
  // the exciting version: a running arpeggio over the chord
  if (hype) { const arp = [0, 2, 4, 7][s16 % 4]; mnote(c, t, degNote(T, chord + arp, 1), st * .8, 'square', .018, { lp: 3000, release: .03 }); }
  // drums
  if (!calm) { const D = T.drums; if ((hype ? 'x...x...x...x...' : D.k)[s16] === 'x') mdrum(c, t, 'k', .22); if ((hype ? '....x.......x.x.' : D.s)[s16] === 'x') mdrum(c, t, 's', .09); if ((hype ? 'xxxxxxxxxxxxxxxx' : D.h)[s16] === 'x') mdrum(c, t, 'h', hype ? .035 : .03); }
  else if (s16 % 8 === 4) mdrum(c, t, 'h', .02);
}
function musicTick() {
  const c = SND.ctx; if (!c || !MUS.theme) return;
  const T = THEMES[MUS.theme], spb = 60 / (T.bpm * (MUS.mode === 'hype' ? 1.22 : MUS.mode === 'calm' ? .9 : 1));
  while (MUS.next < c.currentTime + .15) {
    // switch themes or modes only on a bar line
    if (MUS.step % 16 === 0 && (MUS.wantMode !== MUS.mode)) MUS.mode = MUS.wantMode;
    playStep(c, T, MUS.mode, MUS.step, MUS.next, spb);
    MUS.next += spb / 4; MUS.step++;
  }
}
function musicSet(theme, mode) {
  MUS.wantMode = mode;
  if (!SET.music || LAB) { if (MUS.timer) musicStop(); return; }
  const c = SND.ctx; if (!c || c.state !== 'running') return;
  if (MUS.switching) return;
  if (theme === MUS.theme && MUS.timer) { musOut(c).gain.setTargetAtTime(SET.mvol * .9 * MODE_VOL[mode], c.currentTime, .5); return; }
  const start = () => {
    MUS.switching = false; MUS.theme = theme; MUS.mode = mode; MUS.step = 0; MUS.next = c.currentTime + .05;
    const g = musOut(c); g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(SET.mvol * .9 * MODE_VOL[mode], c.currentTime + 1.2);
    clearInterval(MUS.timer); MUS.timer = setInterval(musicTick, 30);
  };
  if (MUS.timer) { MUS.switching = true; const g = musOut(c), now = c.currentTime; g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0, now + .6); setTimeout(() => { clearInterval(MUS.timer); MUS.timer = null; start(); }, 650); }
  else start();
}
function musicStop() { clearInterval(MUS.timer); MUS.timer = null; if (SND.ctx && MUS_BUS) { MUS_BUS.gain.cancelScheduledValues(SND.ctx.currentTime); MUS_BUS.gain.setTargetAtTime(0, SND.ctx.currentTime, .15); } MUS.theme = null; MUS.mode = null; }
// near elimination: your line at 30% HP or less, or the other side down to its last quarter
function nearElimination() {
  if (!B || B.over || !RUN) return false;
  if (RUN.hp <= RUN.maxhp * .3) return true;
  const al = B.enemies.filter(e => !e.fled && !e.split), hp = al.reduce((s, e) => s + Math.max(0, e.hp), 0), max = al.reduce((s, e) => s + e.max, 0);
  return max > 0 && hp > 0 && hp <= max * .25;
}
function musicWanted() {
  if (UI.screen === 'title' || UI.screen === 'draft' || UI.screen === 'end' || !RUN) return ['title', UI.screen === 'end' ? 'calm' : 'fight'];
  const th = 'act' + Math.min(2, RUN.act);
  if (UI.view === 'fight' && B && !B.over) return [th, nearElimination() ? 'hype' : 'fight'];
  return [th, 'calm'];
}
setInterval(() => { if (LAB) return; const [t, m] = musicWanted(); musicSet(t, m); }, 400);
// browsers only allow audio after a click or key
const unlock = () => { if (LAB) return; actx(); const [t, m] = musicWanted(); musicSet(t, m); };
document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);

/* ---------- the settings panel ---------- */
function showSettings() {
  const draw = () => {
    const T = MUS.theme ? THEMES[MUS.theme] : null;
    $('modalBox').innerHTML = `<header><h3>Settings</h3><button class="ghost" data-close>Close</button></header>
      <div class="setgrid">
        <label class="tog"><input type="checkbox" id="sMusic" ${SET.music ? 'checked' : ''}><span><b>Music</b><small>A theme for each act, plus a title theme. In a fight it speeds up when either side is near elimination.</small></span></label>
        <label class="rng"><span>Music volume</span><input type="range" id="sMvol" min="0" max="1" step=".05" value="${SET.mvol}" ${SET.music ? '' : 'disabled'}></label>
        <label class="tog"><input type="checkbox" id="sSfx" ${SET.sfx ? 'checked' : ''}><span><b>Sound effects</b><small>Hits, cards, dice, whistles, the crowd.</small></span></label>
        <label class="rng"><span>Difficulty for new runs</span><select id="sDiff">${DIFFS.map((D, k) => `<option value="${k}" ${SET.diff === k ? 'selected' : ''}>${D.n}</option>`).join('')}</select></label>
        <p class="hint" style="margin:-6px 12px 0;font-size:14px">${esc(DIFFS[SET.diff].desc)} You can also change it on the draft screen. A run keeps the difficulty it started on.</p>
        <label class="tog"><input type="checkbox" id="sTips" ${SET.tips ? 'checked' : ''}><span><b>Coach’s notes</b><small>One-time tips the first time each part of the game comes up. <button class="ghost" id="sTipsReset" style="font-size:15px;padding:2px 8px">Show them all again</button></small></span></label>
        <label class="rng"><span>Effects volume</span><input type="range" id="sSvol" min="0" max="1" step=".05" value="${SET.svol}" ${SET.sfx ? '' : 'disabled'}></label>
      </div>
      <p class="hint">${SET.music ? (T ? `Now playing: <b>${esc(T.name)}</b>${MUS.mode === 'hype' ? ' (exciting)' : MUS.mode === 'calm' ? ' (calm)' : ''}.` : 'Music starts after your next click or key press.') : 'Music is off.'} Settings are saved in this browser.</p>`;
    $('sMusic').onchange = e => { SET.music = e.target.checked; saveSettings(); if (!SET.music) musicStop(); else unlock(); draw(); syncSetBtn(); };
    $('sSfx').onchange = e => { SET.sfx = e.target.checked; SND.on = SET.sfx; saveSettings(); if (SET.sfx) sfx.coin(); draw(); syncSetBtn(); };
    $('sDiff').onchange = e => { SET.diff = +e.target.value; DR.diff = null; saveSettings(); draw(); };
    $('sTips').onchange = e => { SET.tips = e.target.checked; saveSettings(); };
    $('sTipsReset').onclick = e => { e.preventDefault(); TIPS_SEEN.length = 0; try { localStorage.removeItem(pkey('sd-tips')); } catch (x) { } SET.tips = true; saveSettings(); draw(); };
    $('sMvol').oninput = e => { SET.mvol = +e.target.value; saveSettings(); if (SND.ctx && MUS_BUS && MUS.timer) MUS_BUS.gain.setTargetAtTime(SET.mvol * .9 * MODE_VOL[MUS.mode || 'fight'], SND.ctx.currentTime, .1); };
    $('sSvol').oninput = e => { SET.svol = +e.target.value; saveSettings(); if (SFX_BUS) SFX_BUS.gain.value = SET.svol; };
    $('sSvol').onchange = () => sfx.card();
  };
  modal(''); draw();
}
function syncSetBtn() { const b = $('bSound'); if (!b) return; b.textContent = 'Settings'; b.setAttribute('aria-pressed', 'true'); b.title = `Music ${SET.music ? 'on' : 'off'}, sound effects ${SET.sfx ? 'on' : 'off'}`; }
(() => { const b = $('bSound'); if (b) { b.onclick = showSettings; syncSetBtn(); } })();

/* ---------- coach's notes: one-time tips, shown the first time each system matters ---------- */
const TIPS = {
  fight: ['Your first fight', 'Drag a card onto an enemy, or click a card and then the enemy. Each card costs Stamina (top of the hand). The icon over each enemy is what it will do next turn. When you are out of moves, End Turn.'],
  sport: ['Every fight is also a game', 'The scoreboard shows this fight’s sport. Its rule, shown on the scoreboard, changes what your cards do; the full rules for all nine sports are on the How to play page. Win the fight and the game for a sports win: bonus gold, style and a Highlight Reel.'],
  why: ['Why a hit does what it does', 'When you hover or select an attack, the bar at the bottom of the arena breaks its first hit down: base damage, then every bonus and multiplier that applies right now.'],
  momentum: ['Momentum', 'The bar under the scoreboard is a tug of war. Lead by enough and your hits land harder; fall behind and theirs do, until you are far enough behind that you draw an extra card each turn.'],
  sky: ['The sky moved', 'The skylights in the arena wall show the moon and two constellations. They shift as you play and give small boosts to certain kinds. Hover the moon and stars in the top bar for what is up now.'],
  map: ['The map', 'Pick a room on the next row. Hover a room to see everywhere it leads. Elites drop trophies, locker rooms heal or upgrade, and the boss waits at the top.'],
  elite: ['An elite', 'Elites hit harder and start stronger, but they always drop a trophy. Worth it when your HP can take it.'],
  boss: ['A boss', 'Bosses change as they lose health: watch for the phase banner. Their intents can depend on what you did last turn, so the icon over them is worth reading every turn.'],
};
const TIPS_SEEN = (() => { try { return JSON.parse(localStorage.getItem(pkey('sd-tips')) || '[]'); } catch (e) { return []; } })();
if (SET.tips == null) SET.tips = true;
const tipQ = [];
function tip(id) {
  if (LAB || !SET.tips || TIPS_SEEN.includes(id) || tipQ.includes(id)) return;
  tipQ.push(id); if (tipQ.length === 1) showCoach();
}
function showCoach() {
  const id = tipQ[0]; if (!id) return;
  let el = $('coach'); if (!el) { el = document.createElement('aside'); el.id = 'coach'; el.className = 'coach'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  const [t, body] = TIPS[id];
  el.innerHTML = `<b>Coach’s note: ${esc(t)}</b><p>${esc(body)}</p><div class="row"><button class="btn" id="cOk">Got it</button><button class="ghost" id="cOff">No more tips</button></div>`;
  el.hidden = false;
  const done = () => { TIPS_SEEN.push(id); try { localStorage.setItem(pkey('sd-tips'), JSON.stringify(TIPS_SEEN)); } catch (e) { } tipQ.shift(); el.hidden = true; if (tipQ.length) setTimeout(showCoach, 400); };
  $('cOk').onclick = done;
  $('cOff').onclick = () => { SET.tips = false; saveSettings(); tipQ.length = 0; el.hidden = true; };
}
// hooks: watch the game rather than threading tip calls through the engine
setInterval(() => {
  if (LAB || !SET.tips || !RUN) return;
  if (UI.view === 'map') tip('map');
  if (UI.view === 'fight' && B && !B.over) {
    tip('fight'); if (B.turn >= 2) tip('sport');
    if (UI.why) tip('why');
    if (B.sc && B.sc.tier) tip('momentum');
    if (A.skyT) tip('sky');
    if (B.type === 'elite') tip('elite');
    if (B.type === 'boss') tip('boss');
  }
}, 700);

/* ---------- pause, and saving a fight to come back to ---------- */
// A fight is saved whole: the hand, the piles, every enemy's HP, statuses and intent, the score, the sky.
// It is only taken when nothing is mid-animation (your turn, nothing resolving), so it always restores cleanly.
const safeToSnap = () => B && !B.over && B.phase === 'player' && !UI.busy && !UI.disc;
function snapBattle() {
  if (!RUN || !safeToSnap()) return false;
  const snap = JSON.parse(JSON.stringify(B, (k, v) => k === 'fx' ? [] : typeof v === 'function' ? undefined : v));
  RUN.battle = snap; saveRun(); return true;
}
function restoreBattle(snap) {
  A.ent = {}; A.pops = []; A.dice = null; A.vfx = []; A.banner = null; A.spops = [];
  UI.sel = -1; UI.busy = false; UI.kbTarget = null; UI.disc = null; sprClear();
  B = JSON.parse(JSON.stringify(snap)); B.fx = [];
  for (const e of B.enemies) if (!e.dead && e.intent) { try { e.plan = planOps(e); } catch (x) { e.plan = null; } }
  const uids = [].concat(B.draw, B.hand, B.discard, B.exhaust || [], B.engulfed || []).map(c => c.uid || 0).concat(B.enemies.map(e => +String(e.uid).replace(/\D/g, '') || 0));
  UID = Math.max(UID, ...uids, ...RUN.deck.map(c => c.uid)) + 1;
  showView('fight');
  B.fx.push({ k: 'banner', t: 'Back in the game', sub: `Turn ${B.turn}, right where you left it`, small: 1 });
  consumeFx(); renderFightHUD(); renderRunBar();
}
// save at the top of every turn, and when the page is closed during your turn
setInterval(() => { if (LAB || UI.view !== 'fight' || !safeToSnap()) return; if (RUN.battle && RUN.battle.turn === B.turn && RUN.battle.cardsThisTurn === B.cardsThisTurn) return; snapBattle(); }, 1000);
window.addEventListener('pagehide', () => { if (!LAB && !window.__switching && RUN && UI.view === 'fight') snapBattle(); });
window.addEventListener('beforeunload', () => { if (!LAB && !window.__switching && RUN && UI.view === 'fight') snapBattle(); });

function openPause() {
  if (!RUN || UI.paused) return;
  UI.paused = true;
  if (SND.ctx && MUS_BUS && MUS.timer) MUS_BUS.gain.setTargetAtTime(SET.mvol * .3, SND.ctx.currentTime, .2);
  const inFight = UI.view === 'fight' && B && !B.over, canSave = !inFight || safeToSnap();
  let el = $('pause'); if (!el) { el = document.createElement('div'); el.id = 'pause'; el.className = 'pause'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'pauseH'); document.body.appendChild(el); }
  const where = inFight ? `Turn ${B.turn} of a ${SPORT_NAME[B.sport].toLowerCase()} game against ${esc(alive().map(e => e.n.split(',')[0]).join(', '))}.` : `Act ${RUN.act + 1}, floor ${RUN.floor + 1}.`;
  el.innerHTML = `<div class="pbox"><h2 id="pauseH">Paused</h2><p class="hint">${where} ${RUN.hp}/${RUN.maxhp} HP, ${RUN.gold} gold.</p>
    <div class="pbtns"><button class="btn" id="pResume">Resume</button>
    <button class="ghost" id="pSave" ${canSave ? '' : 'disabled'}>Save and quit to title</button>
    <button class="ghost" id="pSettings">Settings</button></div>
    <p class="hint" style="font-size:14px">${canSave ? 'Your run is saved in this browser. Continue it from the title screen any time, and a fight picks up on the same turn with the same hand.' : 'Wait for the enemy turn to finish to save mid-fight.'}</p></div>`;
  el.hidden = false; $('pResume').focus();
  $('pResume').onclick = closePause;
  $('pSettings').onclick = () => { el.hidden = true; showSettings(); const back = () => { if (!$('modal').hidden) return setTimeout(back, 200); if (UI.paused) el.hidden = false; }; setTimeout(back, 200); };
  $('pSave').onclick = () => {
    if (inFight && !snapBattle()) return;
    if (!inFight) saveRun();
    closePause(); musicStop(); B = null; RUN = null; UI.view = null; showScreen('title'); renderTitle();
  };
}
function closePause() { UI.paused = false; const el = $('pause'); if (el) el.hidden = true; if (SND.ctx && MUS_BUS && MUS.timer) MUS_BUS.gain.setTargetAtTime(SET.mvol * .9 * MODE_VOL[MUS.mode || 'fight'], SND.ctx.currentTime, .2); }
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape' && ev.key !== 'p' && ev.key !== 'P') return;
  if (ev.target.closest('input,textarea') || !$('modal').hidden) return;
  if (UI.paused) { if (ev.key === 'Escape' || ev.key.toLowerCase() === 'p') { closePause(); ev.preventDefault(); } return; }
  if (!RUN || UI.screen === 'title' || UI.screen === 'end') return;
  if (ev.key === 'Escape' && (UI.sel >= 0 || UI.disc)) return; // Escape first cancels a selected card
  openPause(); ev.preventDefault();
});

/* ---------- profiles on the title screen ---------- */
function profileChip() {
  let el = $('profRow');
  if (!el) { el = document.createElement('div'); el.id = 'profRow'; el.className = 'profrow'; const rr = $('resumeRow'); rr.parentNode.insertBefore(el, rr); }
  const n = ACH.filter(a => ACHS.got[a.id] != null).length;
  el.innerHTML = `<span>Playing as <b>${esc(profileName())}</b>${PROFILES.cur === 'guest' ? ' <small>(no profile)</small>' : ''} · ${n}/${ACH.length} achievements</span><button class="ghost" id="bProfile">${PROFILES.cur === 'guest' && !PROFILES.list.length ? 'Create a profile' : 'Switch player'}</button>`;
  $('bProfile').onclick = showProfiles;
}
function showProfiles() {
  const row = (id, name, sub) => `<div class="profline${PROFILES.cur === id ? ' cur' : ''}"><div><b>${esc(name)}</b><small>${sub}</small></div>${PROFILES.cur === id ? '<span class="hint">Playing now</span>' : `<button class="ghost" data-play="${id}">Play as ${esc(name)}</button>`}${id !== 'guest' ? `<button class="ghost" data-del="${id}" title="Delete this profile and all its progress" aria-label="Delete ${esc(name)}">✕</button>` : ''}</div>`;
  modal(`<header><h3>Who’s playing?</h3><button class="ghost" data-close>Close</button></header>
    <p class="hint">Each profile keeps its own run in progress, record book, player careers, achievements and coach’s notes on this device. Guest plays without a profile and keeps everything from before profiles existed.</p>
    <div class="proflist">${row('guest', 'Guest', 'No profile')}${PROFILES.list.map(p => row(p.id, p.name, 'Since ' + new Date(p.created).toLocaleDateString())).join('')}</div>
    <div class="row" style="margin-top:12px"><input id="newProf" maxlength="24" placeholder="New player name" aria-label="New player name" style="flex:1;font:inherit;padding:8px 10px;background:var(--stone2);color:var(--bone);border:1px solid var(--seam);border-radius:4px"><button class="btn" id="bMkProf" style="font-size:20px">Create and play</button></div>`);
  const box = $('modalBox');
  box.querySelectorAll('[data-play]').forEach(b => b.onclick = () => switchProfile(b.dataset.play));
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const p = PROFILES.list.find(x => x.id === b.dataset.del); if (p) askConfirm(`Delete ${p.name}?`, `All of ${p.name}’s progress on this device goes with it: the run in progress, record book, careers and achievements. This cannot be undone.`, 'Delete', () => { const wasCur = PROFILES.cur === p.id; deleteProfile(p.id); if (wasCur) location.reload(); else showProfiles(); }, showProfiles); });
  const mk = () => { const id = createProfile($('newProf').value); if (id) switchProfile(id); else $('newProf').focus(); };
  $('bMkProf').onclick = mk; $('newProf').onkeydown = e => { if (e.key === 'Enter') mk(); };
  setTimeout(() => $('newProf') && $('newProf').focus(), 50);
}
(() => { const _rt = renderTitle; renderTitle = function () { _rt(); profileChip(); }; if (UI.screen === 'title') profileChip(); })();

// who is playing, always visible in the header
(() => { const b = $('bWho'); if (!b) return; $('whoName').textContent = profileName(); b.setAttribute('aria-label', `Playing as ${profileName()}. Switch or create a profile`); b.onclick = showProfiles; })();

/* An in-game confirmation. The browser's own confirm() is blocked inside the claude.ai page frame (it returns
   false without showing anything), so every yes/no question goes through this instead. */
function askConfirm(title, body, okLabel, onYes, onNo) {
  const close = modal(`<header><h3>${esc(title)}</h3></header><p>${esc(body)}</p><div class="row"><button class="btn" id="cfYes" style="font-size:22px">${esc(okLabel || 'Yes')}</button><button class="ghost" id="cfNo">Cancel</button></div>`);
  $('cfNo').focus();
  $('cfYes').onclick = () => { close(); onYes && onYes(); };
  $('cfNo').onclick = () => { close(); onNo && onNo(); };
}
