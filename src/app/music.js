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

