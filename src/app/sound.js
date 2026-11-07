/* p7: sound, the arena scene, and the fight screen */
const SND = { on: true, ctx: null };
try { SND.on = localStorage.getItem('sd-sound') !== 'off'; } catch (e) { }
function actx() { if (!SND.ctx) { try { SND.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { SND.on = false; } } if (SND.ctx && SND.ctx.state === 'suspended') SND.ctx.resume(); return SND.ctx; }
function tone(f, d, type = 'square', vol = .08, slide = 0, delay = 0) {
  if (!SND.on || LAB) return; const c = actx(); if (!c) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(sfxOut(c)); o.start(t); o.stop(t + d + .02);
}
function noise(d, vol = .15, fq = 1200, q = 1, delay = 0, sweep = 0) {
  if (!SND.on || LAB) return; const c = actx(); if (!c) return;
  const t = c.currentTime + delay, n = Math.max(1, (c.sampleRate * d) | 0), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(fq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, fq + sweep), t + d);
  const g = c.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(sfxOut(c)); s.start(t);
}
const sfx = {
  card: () => noise(.06, .18, 2600, 2),
  hit: v => { noise(.1, .3 + v * .2, 300, 1.4); tone(90, .12, 'sine', .12, -30); },
  crunch: () => { noise(.16, .45, 280, 1); tone(60, .2, 'sawtooth', .09, -25); },
  block: () => noise(.08, .3, 1400, 3),
  hurt: () => { noise(.14, .4, 220, 1.2); tone(110, .2, 'sawtooth', .07, -50); },
  magic: () => { tone(520, .2, 'sine', .06, 400); tone(780, .25, 'sine', .04, 300, .06); },
  dice: () => { for (let i = 0; i < 5; i++) noise(.03, .2, 2000 + i * 300, 3, i * .07); },
  crit: () => { tone(880, .25, 'square', .06, 0); tone(1320, .4, 'square', .05, 0, .12); },
  whistle: () => { tone(2900, .35, 'sine', .07, 0); tone(3100, .35, 'sine', .04, 0); },
  horn: () => { for (const f of [233, 277, 349]) tone(f, 1, 'sawtooth', .045, 0); },
  crowd: (d = 1.4) => { noise(d, .14, 900, .4); noise(d, .09, 1700, .5, .1); },
  coin: () => { tone(1320, .08, 'square', .05); tone(1760, .12, 'square', .05, 0, .07); },
  bad: () => { tone(300, .2, 'sawtooth', .06, -120); tone(200, .3, 'sawtooth', .06, -80, .15); },
  die: () => { noise(.3, .3, 400, .8, 0, -300); },
};

