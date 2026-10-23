/* ================= music: a haunted ballpark, played live on harpsichord and pipe organ ================= */
const MUS = { on: true, ready: false, want: null, cur: null, track: null, i: 0, loop: 0, t0: 0, timer: null, stretchUntil: 0, ducked: 1 };
try { MUS.on = localStorage.getItem('bd-music') !== 'off'; } catch (e) { }
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

function musInit() {
  const c = actx(); if (!c || MUS.ready) return !!MUS.ready;
  MUS.master = c.createGain(); MUS.master.gain.value = MUS.on ? .42 : 0;
  MUS.bed = c.createGain(); MUS.bed.gain.value = 1;       // the looping score (ducked under stingers)
  MUS.bus = c.createGain();                                // everything musical lands here
  const rev = c.createConvolver(), len = c.sampleRate * 2.6, ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (i < 400 ? i / 400 : 1); }
  rev.buffer = ir;
  const dry = c.createGain(), wet = c.createGain(); dry.gain.value = .85; wet.gain.value = .38;
  MUS.bed.connect(MUS.bus); MUS.bus.connect(dry).connect(MUS.master); MUS.bus.connect(rev).connect(wet).connect(MUS.master);
  MUS.master.connect(c.destination);
  MUS.ready = true;
  MUS.timer = setInterval(musTick, 40);
  return true;
}

/* ---------- instruments ---------- */
function hc(t, n, dur, v, out) { // harpsichord: bright pluck, 8' and 4' stops, filter closes as the string rings
  const c = SND.ctx, f = mtof(n), len = Math.min(2.4, dur + .45);
  const g = c.createGain(), lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(Math.min(10000, f * 16), t); lp.frequency.exponentialRampToValueAtTime(Math.max(500, f * 2.2), t + .4);
  const o1 = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain();
  o1.type = 'sawtooth'; o1.frequency.value = f; o2.type = 'square'; o2.frequency.value = f * 2; o2.detune.value = 5; g2.gain.value = .22;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .2, t + .003); g.gain.exponentialRampToValueAtTime(v * .07, t + .14); g.gain.exponentialRampToValueAtTime(.0001, t + len);
  o1.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(out);
  o1.start(t); o2.start(t); o1.stop(t + len + .05); o2.stop(t + len + .05);
}
function organ(t, n, dur, v, out, stops) { // pipe organ: stacked sine ranks with a slow tremulant
  const c = SND.ctx, f = mtof(n), g = c.createGain(), end = t + dur;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .09, t + .05); g.gain.setValueAtTime(v * .09, end); g.gain.exponentialRampToValueAtTime(.0001, end + .25);
  const trem = c.createOscillator(), tg = c.createGain(); trem.frequency.value = 5.2; tg.gain.value = v * .012; trem.connect(tg).connect(g.gain); trem.start(t); trem.stop(end + .3);
  for (const [m, a] of stops || [[1, 1], [2, .55], [3, .18], [4, .3], [6, .06], [8, .08]]) {
    const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = f * m; o.detune.value = (m - 1) * 1.5; og.gain.value = a;
    o.connect(og).connect(g); o.start(t); o.stop(end + .3);
  }
  g.connect(out);
}
const pedal = (t, n, dur, v, out) => organ(t, n, dur, v * 1.3, out, [[1, 1], [2, .7], [3, .15], [.5, .5]]);
function bell(t, n, dur, v, out) { // celesta / music box
  const c = SND.ctx, f = mtof(n);
  for (const [m, a, d] of [[1, 1, 1.6], [2.76, .35, .6], [5.4, .12, .3]]) {
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * m;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * .12 * a, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(out); o.start(t); o.stop(t + d + .05);
  }
}
const INST = { hc, organ, pedal, bell };

/* ---------- the score ---------- */
// events: [beat, midi, beats, instrument, velocity]
const CHORD = { Cm: [60, 63, 67], G7: [59, 62, 65, 67], Ab: [60, 63, 68], Fm: [60, 65, 68], G: [59, 62, 67], Bd7: [59, 62, 65, 68] };
const ROOT = { Cm: 48, G7: 43, Ab: 44, Fm: 41, G: 43, Bd7: 47 };
function withMordent(ev, b, n, d, inst, v) { // baroque ornament on long notes: note, lower neighbour, note
  if (d >= 2 && inst === 'hc') { const s = .12; ev.push([b, n, s, inst, v], [b + s, n - 1, s, inst, v * .8], [b + 2 * s, n, d - 2 * s, inst, v]); }
  else ev.push([b, n, d, inst, v]);
}
// "Take Me Out to the Ball Game" (Von Tilzer, 1908, public domain) in C harmonic minor, as a waltz
function ballgameWaltz(lead) {
  const mel = [
    [72, 2], [84, 1], [80, 1], [79, 1], [75, 1], [79, 3], [74, 3],
    [72, 2], [84, 1], [80, 1], [79, 1], [75, 1], [79, 6],
    [80, 1], [79, 1], [80, 1], [75, 1], [77, 1], [79, 1], [80, 2], [77, 1], [74, 3],
    [80, 1], [80, 1], [80, 1], [83, 1], [84, 1], [86, 1], [83, 1], [80, 1], [79, 1], [75, 1], [74, 2],
  ];
  const bars = ['Cm', 'Cm', 'Cm', 'G7', 'Cm', 'Ab', 'Cm', 'Cm', 'Fm', 'Cm', 'Fm', 'G7', 'Fm', 'G', 'Bd7', 'G7'];
  const ev = []; let b = 0;
  for (const [n, d] of mel) { withMordent(ev, b, n, d, lead, lead === 'organ' ? .75 : .95); if (lead === 'hc' && b >= 24) ev.push([b, n + 12, d, 'bell', .35]); b += d; }
  bars.forEach((ch, i) => {
    const bb = i * 3;
    ev.push([bb, ROOT[ch], 1, 'pedal', .8]);
    for (const k of [1, 2]) for (const n of CHORD[ch]) ev.push([bb + k, n, .8, 'hc', .42]);
  });
  return { bpm: lead === 'organ' ? 112 : 124, len: 48, events: ev.sort((a, b) => a[0] - b[0]) };
}
// Toccata of the Diamond: original harpsichord arpeggios over a descending lament bass, D minor
function toccata() {
  const prog = [
    ['D', [62, 65, 69, 74, 77], 38], ['C', [60, 64, 67, 72, 76], 36], ['Bb', [58, 62, 65, 70, 74], 34], ['A', [57, 61, 64, 69, 73], 33],
    ['Gm', [55, 58, 62, 67, 70], 31], ['Dm/F', [57, 62, 65, 69, 74], 29], ['Eb', [55, 58, 63, 67, 70], 27], ['A7', [57, 61, 64, 67, 73], 33],
  ];
  const pat = [0, 2, 1, 3, 2, 4, 3, 2, 0, 2, 1, 3, 2, 4, 3, 1];
  const ev = [];
  for (let pass = 0; pass < 2; pass++) prog.forEach(([, T, bass], i) => {
    const b0 = (pass * 8 + i) * 4;
    pat.forEach((k, j) => ev.push([b0 + j / 4, T[k], .3, 'hc', j % 4 === 0 ? .5 : .34]));
    ev.push([b0, bass, 4, 'pedal', .55]);
    ev.push([b0, bass + 12, 1.5, 'hc', .38], [b0 + 2, bass + 12, 1.5, 'hc', .3]);
    if (pass === 1) { ev.push([b0, T[4] + 12, 2, 'organ', .32], [b0 + 2, T[3] + 12, 2, 'organ', .28]); }
    if (i === 0 || i === 4) ev.push([b0, T[4] + 24, 1, 'bell', .3]);
  });
  return { bpm: 84, len: 64, events: ev.sort((a, b) => a[0] - b[0]) };
}
const TRACKS = { menu: ballgameWaltz('hc'), game: toccata(), stretch: Object.assign(ballgameWaltz('organ'), { once: true }) };
const STINGS = {
  hr: { bpm: 120, events: [[0, 60, .3, 'organ', .9], [.3, 63, .3, 'organ', .9], [.6, 67, .3, 'organ', .9], [.9, 72, 3, 'organ', 1], [.9, 75, 3, 'organ', .8], [.9, 79, 3, 'organ', .8], [.9, 36, 3, 'pedal', 1], [.9, 96, 1, 'bell', .6], [1.2, 91, 1, 'bell', .5], [1.5, 84, 1, 'bell', .5]] },
  k: { bpm: 150, events: [84, 83, 82, 81, 80, 79, 78, 77].map((n, i) => [i * .25, n, .25, 'hc', .8]).concat([[2, 48, 1.5, 'hc', .9], [2, 54, 1.5, 'hc', .8], [2, 36, 1.5, 'pedal', .7]]) },
  devour: { bpm: 90, events: [[0, 36, 2.5, 'pedal', 1], [0, 37, 2.5, 'pedal', .8], [0, 60, 2.5, 'organ', .7], [0, 66, 2.5, 'organ', .7], [0, 71, 2.5, 'organ', .5]] },
  rally: { bpm: 140, events: [[0, 62, .5, 'organ', .8], [.5, 65, .5, 'organ', .8], [1, 69, .5, 'organ', .8], [1.5, 74, 1.5, 'organ', .9], [1.5, 38, 1.5, 'pedal', .8], [1.5, 70, 1.5, 'organ', .6]] },
  win: { bpm: 100, events: [[0, 67, .5, 'organ', .9], [.5, 72, .5, 'organ', .9], [1, 75, .5, 'organ', .9], [1.5, 79, 1, 'organ', 1], [2.5, 77, .5, 'organ', .9], [3, 76, 3, 'organ', 1], [3, 72, 3, 'organ', .8], [3, 67, 3, 'organ', .8], [3, 64, 3, 'organ', .7], [3, 36, 3, 'pedal', 1], [3, 96, 1, 'bell', .6]] },
  loss: { bpm: 70, events: [[0, 72, 1, 'organ', .8], [0, 48, 1, 'pedal', .8], [1, 70, 1, 'organ', .8], [1, 46, 1, 'pedal', .8], [2, 68, 1, 'organ', .8], [2, 44, 1, 'pedal', .8], [3, 67, 2, 'organ', .9], [3, 43, 2, 'pedal', .9], [5, 63, 3, 'organ', .8], [5, 60, 3, 'organ', .8], [5, 36, 3, 'pedal', .9]] },
};

/* ---------- scheduler ---------- */
function musTick() {
  const c = SND.ctx; if (!c || !MUS.ready) return;
  // choose what should be playing
  const inGame = G.teams && PAGE === 'play' && (G.phase === 'plate' || G.phase === 'play' || G.phase === 'between');
  let want = !MUS.on ? null : c.currentTime < MUS.stretchUntil ? 'stretch' : inGame ? 'game' : 'menu';
  if (want !== MUS.want) { MUS.want = want; startTrack(want); }
  // pause and stingers duck the bed
  const target = (G.paused ? .45 : 1) * MUS.ducked;
  MUS.bed.gain.setTargetAtTime(target, c.currentTime, .15);
  const tr = MUS.track; if (!tr) return;
  const spb = 60 / tr.bpm, horizon = c.currentTime + .3;
  for (let guard = 0; guard < 400; guard++) {
    const ev = tr.events[MUS.i]; if (!ev) break;
    const t = MUS.t0 + (MUS.loop * tr.len + ev[0]) * spb;
    if (t > horizon) break;
    if (t > c.currentTime - .03) INST[ev[3]](t, ev[1], ev[2] * spb, ev[4], MUS.bed);
    MUS.i++;
    if (MUS.i >= tr.events.length) { MUS.i = 0; MUS.loop++; if (tr.once) { MUS.track = null; MUS.stretchUntil = 0; break; } }
  }
}
function startTrack(name) {
  const c = SND.ctx; MUS.track = name ? TRACKS[name] : null; MUS.i = 0; MUS.loop = 0; MUS.t0 = c.currentTime + .15;
  if (name === 'stretch') MUS.stretchUntil = c.currentTime + TRACKS.stretch.len * 60 / TRACKS.stretch.bpm + .5;
}
function musicSting(name) {
  if (!MUS.on || !MUS.ready || !STINGS[name]) return;
  const c = SND.ctx, s = STINGS[name], spb = 60 / s.bpm, t0 = c.currentTime + .05;
  let end = 0;
  for (const [b, n, d, inst, v] of s.events) { INST[inst](t0 + b * spb, n, d * spb, v, MUS.bus); end = Math.max(end, (b + d) * spb); }
  MUS.ducked = .25; clearTimeout(MUS.duckT); MUS.duckT = setTimeout(() => { MUS.ducked = 1; }, (end + .3) * 1000);
}
function seventhInningStretch() {
  if (!MUS.on || !MUS.ready) return;
  MUS.want = 'stretch'; startTrack('stretch');
}
function setMusic(on, init = true) {
  MUS.on = on; try { localStorage.setItem('bd-music', on ? 'on' : 'off'); } catch (e) { }
  const b = document.getElementById('bMusic'); if (b) { b.textContent = `Music: ${on ? 'on' : 'off'}`; b.setAttribute('aria-pressed', on); }
  if (on && init) musInit();
  try { if (PAGE === 'settings') renderSettings(); } catch (e) { }
  if (MUS.ready) { const c = SND.ctx; MUS.master.gain.setTargetAtTime(on ? .42 : 0, c.currentTime, .2); if (!on) { MUS.want = null; MUS.track = null; } }
}
setMusic(MUS.on, false);
// browsers only start audio after a gesture: the first click or key brings the music in
const firstGesture = () => { if (MUS.on) musInit(); const c = SND.ctx; if (c && c.state === 'suspended') c.resume(); };
window.addEventListener('pointerdown', firstGesture, { passive: true });
window.addEventListener('keydown', e => { if (e.code === 'KeyM' && !(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) && !e.ctrlKey && !e.metaKey) setMusic(!MUS.on); firstGesture(); });
