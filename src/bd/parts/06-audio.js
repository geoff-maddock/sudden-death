/* ================= audio ================= */
const SND = { on: true, ctx: null };
function actx() { if (!SND.ctx) { try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { SND.on = false; } } return SND.ctx; }
function tone(f, d, type = 'square', vol = .08, slide = 0, delay = 0) {
  if (!SND.on) return; const c = actx(); if (!c) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .02);
}
function noise(d, vol = .15, fq = 1200, q = 1, delay = 0, sweep = 0) {
  if (!SND.on) return; const c = actx(); if (!c) return;
  const t = c.currentTime + delay, n = Math.max(1, (c.sampleRate * d) | 0), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < n; i++) a[i] = (R() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(fq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, fq + sweep), t + d);
  const g = c.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(c.destination); s.start(t);
}
const sfx = {
  crack: q => { noise(.09, .5, 2400, .8); tone(180 + q * 300, .08, 'triangle', .2, -80); },
  mitt: () => { noise(.06, .35, 500, 1.5); },
  whoosh: () => noise(.25, .12, 700, 1, 0, 1500),
  fire: () => { noise(.5, .2, 400, .6, 0, 1200); tone(90, .4, 'sawtooth', .05, 60); },
  frost: () => { tone(1800, .3, 'sine', .05, 900); tone(2400, .3, 'sine', .03, -600, .05); },
  magic: () => { tone(520, .2, 'sine', .06, 400); tone(780, .25, 'sine', .04, 300, .06); },
  ump: () => { tone(330, .12, 'square', .06); tone(247, .18, 'square', .06, 0, .12); },
  dice: () => { for (let i = 0; i < 6; i++) noise(.03, .25, 3000, 3, i * .07); },
  good: () => { tone(523, .12, 'square', .06); tone(659, .12, 'square', .06, 0, .1); tone(784, .2, 'square', .06, 0, .2); },
  bad: () => { tone(300, .2, 'sawtooth', .06, -120); tone(200, .3, 'sawtooth', .06, -80, .15); },
  chomp: () => { noise(.12, .5, 300, 2); noise(.12, .5, 250, 2, .18); tone(80, .3, 'sawtooth', .1, -30, .1); },
  crowd: (d = 1.8) => { noise(d, .18, 900, .4); noise(d, .12, 1600, .5, .1); },
  out: () => tone(196, .25, 'triangle', .1, -60),
};

