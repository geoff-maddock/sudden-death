/* w50: ambient music out in the world (issue #28, phases 1 and 2). Beside Sudden Death's sequencer (app/music.js, left
   alone for matches, the title and the other places), a generative engine plays slow layers for where you stand:
   a drone (root and fifth, slow swells under a slow filter), a pad (a chord every 2 to 4 bars, on a weighted random
   walk), a texture (filtered noise: a breeze), motif fragments (2 to 5 notes of the region's tune, varied, with long
   rests) and accents (a bell, a lark). One shared reverb and a soft master filter make the space.
   The music is planned by wAmbGen(pal, seed): a seeded stream of events in time order, so a stretch is the same in a
   test and differs from day to day. The live engine only plays that stream; it reads the world and never changes it.
   The mood (wMusicMood) reads the world: the place, the time, the weather, the team (low HP is a danger, tired legs
   thin the sound) and threats (the odds of a wild team on this tile, an alpha or a lair nearby, a dungeon, a grudge,
   fog by day, night off the road). They make one number, the intensity (0 calm to 1 danger), which eases toward its
   target (up in seconds, down slower). As it rises the tempo picks up, chords change sooner and fill out, the motif
   comes oftener and shorter, a pulse comes in (a heartbeat, then a beat on the grid), the drone deepens, the breeze
   thins and the birds go quiet. Night lowers the pad and swaps the lark for an owl.
   So far the Charter Plains have a palette; every other place keeps its tune, until it has one (W_AMB_THEME).
   Settings: Music style, Ambient (default) or Classic (the old tunes everywhere), in SET.mstyle. No music in LAB, and
   none with Music off.
   Wraps: musicSet (wW50MusicSet: the ambient bed instead of a calm tune), musicStop (wW50MusicStop: stops the bed
   too), renderHelp (wW50RenderHelp: #wHelpAmb). The Music style row joins the Settings panel through an observer on
   #modalBox, since the panel redraws itself. */

/* ---------- the numbers ---------- */
const W_AMB = {
  vol: .8,               // the bed's level against SET.mvol (the tunes play at about .9 of it)
  fade: 6,               // seconds for the bed to fade in; out takes a third of that
  voices: 24,            // live voices at most (the drone and the texture are not counted)
  look: 1.5,             // seconds of events scheduled ahead
  motifGap: [20, 60],    // seconds between motif fragments when calm
  answer: .35,           // chance a fragment is answered (played again, a third lower)
  verb: 5,               // reverb tail, seconds
  lp: 4200,              // the soft master filter, Hz
  pulseAt: .35, gridAt: .7,  // the pulse comes in (a heartbeat), and then a beat on the grid
  quietAt: .6,           // above this the accents stop
  ease: [4, 10],         // seconds for the intensity to ease up toward its target, and down
};
const W_AMB_MOOD = {
  wild: [.12, .55],      // a tile's wild-match odds at which the threat is full, and what full is worth
  near: 6, alpha: .9,    // an alpha or lair within this many tiles; worth this at its door
  dungeon: .45, grudge: .4, fog: .3, night: .2,
  hurt: [.5, .9],        // team HP below this share is a danger, worth this at 0 HP
  tired: .5,             // this share of the starters tired or spent thins the sound
};
// A palette: the scale and register, the sounds, the chord walk (a chord's degree to the ones it may go to next, the
// first ones likelier), the texture, the accents and the tune the motifs come from.
const W_AMB_PAL = {
  plains: { name: 'The Charter Plains', theme: 'w_plains', root: 43, scale: 'ionian', bpm: 60,
    bpmHi: 96, drone: 'sine', pad: 'triangle', lead: 'triangle', padLp: 1600,
    walk: { 0: [3, 4, 5], 3: [0, 4, 1], 4: [0, 3, 5], 5: [3, 4, 0], 1: [4, 3] },
    tex: { f: 650, q: .7, vol: .05 }, acc: ['bell', 'lark'], accNight: ['owl', 'bell'], accGap: [25, 70] },
};
const W_AMB_THEME = { w_plains: 'plains' };   // a calm tune out in the world that has an ambient palette
if (SET.mstyle == null) SET.mstyle = 'ambient';
const WAMB = { i: 0, mood: null, moodKey: '', moodAt: 0, pal: null, timer: null, gen: null, ev: null, t0: 0, ch: null, ringing: 0, peak: 0, log: [], noise: null, ir: null };
// live voices are counted per bed (ch.live), so a stopped bed's tails never hold the next one back; ringing counts all
Object.defineProperty(WAMB, 'live', { get: () => WAMB.ch ? WAMB.ch.live : 0, enumerable: true });

/* ---------- the plan: a seeded stream of events ---------- */
// the tune's notes as [degree, length in 16ths]
function wAmbNotes(T) {
  const out = [];
  T.mel.forEach((m, i) => { if (m == null) { if (out.length) out[out.length - 1][1]++; } else out.push([m, 1]); });
  return out;
}
const W_AMB_VARS = ['plain', 'up', 'down', 'inv', 'slow', 'back'];
function wAmbVary(fr, v) {
  const d0 = fr[0][0];
  if (v === 'up') return fr.map(([d, l]) => [d + 2, l]);
  if (v === 'down') return fr.map(([d, l]) => [d - 3, l]);
  if (v === 'inv') return fr.map(([d, l]) => [d0 - (d - d0), l]);
  if (v === 'slow') return fr.map(([d, l]) => [d, l * 2]);
  if (v === 'back') return fr.slice().reverse();
  return fr;
}
// mood() gives { i, night } as each event is planned: the intensity and the time of day
function wAmbGen(key, seed, mood) {
  const P = W_AMB_PAL[key], r = wRng(seed), notes = wAmbNotes(THEMES[P.theme]), M = mood || (() => ({ i: 0 }));
  const pick = a => a[Math.floor(r() * a.length)], span = ([a, b]) => a + r() * (b - a), mix = (a, b, i) => a + (b - a) * i;
  // the walk leans to the first choices: weights 3, 2, 1
  const walk = d => { const o = (P.walk[d] || [0]).filter(x => x !== d), w = o.map((x, i) => Math.max(1, 3 - i)), s = w.reduce((a, b) => a + b, 0); let x = r() * s; for (let i = 0; i < o.length; i++) if ((x -= w[i]) < 0) return o[i]; return o[0]; };
  const S = { t: { chord: 0, motif: 6 + r() * 8, acc: span(P.accGap) * .5, gust: 0, pulse: 0 }, chord: null, last: '', lastAt: -1 };
  return function next() { for (;;) {
    const k = Object.keys(S.t).reduce((a, b) => S.t[a] <= S.t[b] ? a : b), t = S.t[k], m = M(), I = m.i || 0;
    const beat = 60 / mix(P.bpm, P.bpmHi, I), bar = beat * 4, step = beat / 4 * 1.6;
    if (k === 'chord') {
      const deg = S.chord == null ? 0 : walk(S.chord), dur = bar * (I < .5 ? pick([2, 3, 4]) : pick([1, 2]));
      const ds = [0, 2, 4].concat(r() < .3 + .4 * I ? [6] : []).concat(r() < .3 * I ? [8] : []), ns = ds.map(d => degNote(P, deg + d, m.night ? 0 : 1));
      if (r() < .3) ns[ns.length - 1] += 12;
      S.chord = deg; S.t.chord += dur;
      return { k, t, dur, deg, notes: ns };
    }
    if (k === 'pulse') {
      if (I < W_AMB.pulseAt) { S.t.pulse += bar; continue; }
      S.t.pulse += beat;
      return { k, t, grid: I >= W_AMB.gridAt, hz: noteHz(degNote(P, S.chord || 0, -1)), beat };
    }
    if (k === 'motif') {
      let i, L, v, key, n = 0;
      const gap = [mix(W_AMB.motifGap[0], 5, I), mix(W_AMB.motifGap[1], 12, I)].map(g => g * (m.night ? 1.4 : 1));
      do { L = 2 + Math.floor(r() * (I > .6 ? 2 : 4)); i = Math.floor(r() * Math.max(1, notes.length - L)); v = pick(W_AMB_VARS); key = `${i}.${L}.${v}`; } while ((key === S.last || i === S.lastAt) && ++n < 8);
      const fr = wAmbVary(notes.slice(i, i + L), v), ans = r() < W_AMB.answer, play = [];
      let at = 0;
      const lay = f => f.forEach(([d, l]) => { const len = Math.min(l, 8) * step; play.push([degNote(P, d, 2), at, len]); at += len; });
      lay(fr); if (ans) { at += beat * 2; lay(fr.map(([d, l]) => [d - 2, l])); }
      S.last = key; S.lastAt = i; S.t.motif += at + span(gap);
      return { k, t, frag: key, answer: ans, notes: play, dur: at };
    }
    if (k === 'acc') {
      S.t.acc += span(P.accGap);
      if (I > W_AMB.quietAt) continue;
      const a = pick(m.night && P.accNight ? P.accNight : P.acc);
      return a === 'bell' ? { k, a, t, hz: noteHz(degNote(P, pick([0, 4, 7]), 2)) } : a === 'owl' ? { k, a, t, hz: 380 + r() * 60 } : { k, a, t, hz: 2600 + r() * 1400, n: 3 + Math.floor(r() * 4) };
    }
    // a gust: the breeze moves its pitch and level, thinner when it is tense
    S.t.gust += span([3, 7]);
    return { k: 'gust', t, f: P.tex.f * span([.6, 1.5]), v: P.tex.vol * span([.5, 1.2]) * (1 - .6 * I) };
  } };
}
// the first secs seconds of a palette's music, for tests: at a fixed intensity, by day or night
function wAmbPlan(key, seed, secs, i, night) { const g = wAmbGen(key, seed, () => ({ i: i || 0, night: !!night })), out = []; let e; while ((e = g()).t < secs) out.push(e); return out; }
function wAmbSeed(key) { let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h ^ ((WG ? WG.dayAbs : 0) * 7919) ^ (WG ? Math.floor(WG.min / 60) * 131 : 0)) >>> 0; }

/* ---------- the sound ---------- */
function wAmbBufs(c) {
  if (!WAMB.noise || WAMB.noise.sampleRate !== c.sampleRate) {
    const n = c.sampleRate * 4, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const m = Math.floor(c.sampleRate * W_AMB.verb), ir = c.createBuffer(2, m, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const e = ir.getChannelData(ch); for (let i = 0; i < m; i++) e[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / m, 3); }
    WAMB.noise = b; WAMB.ir = ir;
  }
}
// the chain: voices go dry and through the reverb, then the master filter, the fade and the volume
function wAmbChain(c) {
  wAmbBufs(c);
  const ch = { dry: c.createGain(), wet: c.createGain(), verb: c.createConvolver(), lp: c.createBiquadFilter(), fade: c.createGain(), vol: c.createGain(), hold: [], live: 0, voices: new Set() };
  ch.dry.gain.value = .45; ch.wet.gain.value = .8; ch.verb.buffer = WAMB.ir;
  ch.lp.type = 'lowpass'; ch.lp.frequency.value = W_AMB.lp; ch.fade.gain.value = 0; ch.vol.gain.value = SET.mvol * W_AMB.vol;
  ch.dry.connect(ch.lp); ch.wet.connect(ch.verb).connect(ch.lp); ch.lp.connect(ch.fade).connect(ch.vol).connect(c.destination);
  return ch;
}
function wAmbOut(g) { g.connect(WAMB.ch.dry); g.connect(WAMB.ch.wet); }
// one voice: an oscillator with an envelope; counted against the cap
function wAmbVoice(c, t, hz, dur, type, vol, o = {}) {
  const ch = WAMB.ch; if (!ch || ch.live >= W_AMB.voices) return false;
  const os = c.createOscillator(), g = c.createGain(), a = o.a || .02, rel = o.r || .3;
  os.type = type; os.frequency.setValueAtTime(hz, t);
  if (o.glide) os.frequency.exponentialRampToValueAtTime(o.glide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + Math.max(a, dur));
  g.gain.exponentialRampToValueAtTime(.0001, t + dur + rel);
  let out = g;
  if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
  os.connect(g); wAmbOut(out);
  ch.live++; WAMB.ringing++; ch.voices.add(os); WAMB.peak = Math.max(WAMB.peak, ch.live);
  os.onended = () => { ch.live--; WAMB.ringing--; ch.voices.delete(os); try { out.disconnect(); } catch (e) { } };
  os.start(t); os.stop(t + dur + rel + .05);
  return true;
}
// the drone and the texture run for as long as the bed does
function wAmbHold(c, P) {
  const ch = WAMB.ch, t = c.currentTime;
  const lp = c.createBiquadFilter(), sw = c.createOscillator(), swg = c.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 420; sw.frequency.value = .025; swg.gain.value = 180; sw.connect(swg).connect(lp.frequency);
  const dg = c.createGain(), sl = c.createOscillator(), slg = c.createGain();
  dg.gain.value = .05; sl.frequency.value = .04; slg.gain.value = .02; sl.connect(slg).connect(dg.gain);
  for (const [m, dt] of [[P.root, 0], [P.root + 7, 3], [P.root + 12, -4]]) { const o = c.createOscillator(); o.type = P.drone; o.frequency.value = noteHz(m); o.detune.value = dt; o.connect(dg); o.start(t); ch.hold.push(o); }
  // under it, an octave down that comes in with danger
  const sub = c.createOscillator(), sg = c.createGain(); sub.type = 'sine'; sub.frequency.value = noteHz(P.root - 12); sg.gain.value = 0; sub.connect(sg).connect(lp); sub.start(t); ch.hold.push(sub);
  dg.connect(lp); wAmbOut(lp); ch.drone = { g: dg, sub: sg, lp, sl };
  const n = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain();
  n.buffer = WAMB.noise; n.loop = true; bp.type = 'bandpass'; bp.frequency.value = P.tex.f; bp.Q.value = P.tex.q; ng.gain.value = P.tex.vol;
  n.connect(bp).connect(ng); ng.connect(ch.dry); n.start(t);
  ch.hold.push(sw, sl, n); sw.start(t); sl.start(t);
  ch.tex = { bp, g: ng };
}
function wAmbPlay(c, e, t) {
  const P = W_AMB_PAL[WAMB.pal];
  if (e.k === 'chord') e.notes.forEach((m, i) => wAmbVoice(c, t + i * .15, noteHz(m), e.dur * .55, P.pad, .022, { a: e.dur * .4, r: e.dur * .5, lp: P.padLp }));
  else if (e.k === 'motif') e.notes.forEach(([m, at, len]) => wAmbVoice(c, t + at, noteHz(m), len * .85, P.lead, .035, { a: .06, r: .9, lp: 2600 }));
  else if (e.k === 'acc' && e.a === 'bell') [[1, .03], [2.76, .012], [5.4, .006]].forEach(([p, v]) => wAmbVoice(c, t, e.hz * p, .05, 'sine', v, { a: .005, r: 3.5 / p }));
  else if (e.k === 'acc' && e.a === 'owl') [0, .45, .62].forEach((d, i) => wAmbVoice(c, t + d, e.hz * (i ? .94 : 1), i ? .12 : .32, 'sine', .014, { a: .06, r: .25, glide: e.hz * .9, lp: 900 }));
  else if (e.k === 'pulse') { wAmbVoice(c, t, e.hz, .12, 'sine', e.grid ? .07 : .05, { a: .005, r: .2, glide: e.hz * .6, lp: 300 }); if (!e.grid) wAmbVoice(c, t + e.beat * .3, e.hz, .1, 'sine', .03, { a: .005, r: .18, glide: e.hz * .6, lp: 300 }); else wAmbVoice(c, t + e.beat / 2, e.hz * 2, .08, 'triangle', .012, { a: .005, r: .12, lp: 900 }); }
  else if (e.k === 'acc') for (let i = 0; i < e.n; i++) wAmbVoice(c, t + i * .13, e.hz * (1 + (i % 2) * .12), .07, 'sine', .006, { a: .01, r: .05, glide: e.hz * 1.3 });
  else if (e.k === 'gust' && WAMB.ch.tex) { WAMB.ch.tex.bp.frequency.setTargetAtTime(e.f, t, 1.5); WAMB.ch.tex.g.gain.setTargetAtTime(e.v, t, 1.5); }
  WAMB.log.push({ k: e.k, a: e.a, t: e.t, frag: e.frag, deg: e.deg }); if (WAMB.log.length > 200) WAMB.log.shift();
}
function wAmbTick() {
  const c = SND.ctx; if (!c || !WAMB.pal || !WAMB.ch) return;
  const now = c.currentTime, dt = Math.min(1, Math.max(0, now - (WAMB.at || now))); WAMB.at = now;
  // the mood changes when you step, the clock moves or HP changes; otherwise once a second is plenty
  const key = [WG.map, WG.x, WG.y, WG.min, RUN.hp, RUN.maxhp, WG.dayAbs].join();
  if (key !== WAMB.moodKey || now - WAMB.moodAt > 1) { WAMB.mood = wMusicMood(); WAMB.moodKey = key; WAMB.moodAt = now; }
  wAmbEase(WAMB.mood.intensity, dt);
  const ch = WAMB.ch, I = WAMB.i, tired = WAMB.mood.tint.tired, night = WAMB.mood.tint.night;
  ch.vol.gain.setTargetAtTime(SET.mvol * W_AMB.vol, now, .2);
  ch.drone.g.gain.setTargetAtTime(.05 + .035 * I, now, 1); ch.drone.sub.gain.setTargetAtTime(.06 * I, now, 1);
  ch.drone.lp.frequency.setTargetAtTime(tired ? 300 : 420, now, 2); ch.drone.sl.frequency.setTargetAtTime(tired ? .02 : .04, now, 2);
  ch.lp.frequency.setTargetAtTime(W_AMB.lp * (tired ? .6 : 1) * (night ? .75 : 1), now, 2);
  // after the tab slept, drop what is long past rather than play it all at once: only the latest chord and gust
  // catch up
  const caught = {};
  while (WAMB.ev && WAMB.t0 + WAMB.ev.t < now + W_AMB.look) {
    const e = WAMB.ev, at = WAMB.t0 + e.t;
    if (now - at < 3) wAmbPlay(c, e, Math.max(at, now + .02)); else if (e.k === 'chord' || e.k === 'gust') caught[e.k] = e;
    WAMB.ev = WAMB.gen();
  }
  for (const k in caught) wAmbPlay(c, caught[k], now + .02);
}
function wAmbStart(key) {
  const c = SND.ctx; if (!c || c.state !== 'running' || !SET.music || LAB) return;
  if (WAMB.pal === key && WAMB.ch) return;
  if (WAMB.pal) wAmbStop();
  WAMB.ch = wAmbChain(c); WAMB.pal = key; WAMB.gen = wAmbGen(key, wAmbSeed(key), () => ({ i: WAMB.i, night: !!(WAMB.mood && WAMB.mood.tint.night) })); WAMB.mood = wMusicMood(); WAMB.moodKey = ''; WAMB.i = WAMB.mood.intensity; WAMB.at = c.currentTime; WAMB.ev = WAMB.gen(); WAMB.t0 = c.currentTime + .1; WAMB.log = [];
  WAMB.ch.fade.gain.setValueAtTime(0, c.currentTime); WAMB.ch.fade.gain.linearRampToValueAtTime(1, c.currentTime + W_AMB.fade);
  wAmbHold(c, W_AMB_PAL[key]);
  clearInterval(WAMB.timer); WAMB.timer = setInterval(wAmbTick, 200); wAmbTick();
}
function wAmbStop() {
  clearInterval(WAMB.timer); WAMB.timer = null;
  const c = SND.ctx, ch = WAMB.ch;
  WAMB.pal = null; WAMB.ch = null; WAMB.gen = null; WAMB.ev = null;
  if (!c || !ch) return;
  const out = W_AMB.fade / 3, now = c.currentTime;
  ch.fade.gain.cancelScheduledValues(now); ch.fade.gain.setValueAtTime(ch.fade.gain.value, now); ch.fade.gain.linearRampToValueAtTime(0, now + out);
  // after the fade: the drone and texture stop, and so do the voices still ringing or scheduled ahead
  setTimeout(() => { ch.hold.concat([...ch.voices]).forEach(o => { try { o.stop(); } catch (e) { } }); try { ch.vol.disconnect(); } catch (e) { } }, out * 1000 + 300);
}

/* ---------- the mood ---------- */
// the intensity eases toward its target: up quickly, down slowly, so a threat swells and then settles
function wAmbEase(target, dt) {
  const tau = W_AMB.ease[target > WAMB.i ? 0 : 1];
  WAMB.i += (target - WAMB.i) * (1 - Math.exp(-dt / tau));
  return WAMB.i;
}
// the nearest unbeaten alpha or lair on this map, in tiles
function wAmbAlphaNear(m) {
  const R = W_AMB_MOOD.near; let best = null;
  for (let y = WG.y - R; y <= WG.y + R; y++) for (let x = WG.x - R; x <= WG.x + R; x++) {
    const c = m.t[y] && m.t[y][x]; if (c !== 'M' && c !== 'Z') continue;
    const mt = m.meta[x + ',' + y] || {}, L = mt.loc && DB.locs.find(l => l.id === mt.loc), a = c === 'M' ? mt.alpha : L && L.alpha;
    if (!a || wFlag('alpha_' + a)) continue;
    const d = Math.hypot(x - WG.x, y - WG.y); if (d <= R && (!best || d < best.d)) best = { d, lair: c === 'Z', alpha: a };
  }
  return best;
}
/* What the music should say here: { place, palette, intensity, tint, why }. place is world, town, dungeon, site,
   ground or lair; intensity the target (0 to 1); tint { night, wx, tired, hurt }; why the threats, by name. */
function wMusicMood() {
  const M = W_AMB_MOOD, m = WG && wCurMap();
  if (!m || !RUN) return { place: 'world', palette: null, intensity: 0, tint: {}, why: [] };
  const world = m.kind === 'world', site = DB.locs.find(l => l.kind === 'site' && l.map === WG.map), night = wIsNight(), road = world && wOnRoad();
  const wx = world ? wWeather(wRegionHere()) : null, hp = RUN.maxhp ? RUN.hp / RUN.maxhp : 1;
  const st = wStarters(), tired = st.length > 0 && st.filter(p => wLegsState(p) !== 'fresh').length / st.length >= M.tired;
  const src = {}, near = m.kind !== 'town' ? wAmbAlphaNear(m) : null;
  const p = wEncounterP(m, wTileAt(m, WG.x, WG.y)); if (p > 0) src.wild = clamp(p / M.wild[0], 0, 1) * M.wild[1];
  if (near) src[near.lair ? 'lair' : 'alpha'] = (1 - near.d / (M.near + 1)) * M.alpha;
  if (m.kind === 'dungeon') src.dungeon = M.dungeon;
  if (world && WG.grudge && WG.dayAbs >= WG.grudge.day) src.grudge = M.grudge;
  if (world && !road && wx === 'fog' && !night) src.fog = M.fog;
  if (world && !road && night) src.night = M.night;
  if (hp < M.hurt[0]) src.hurt = (M.hurt[0] - hp) / M.hurt[0] * M.hurt[1];
  const intensity = 1 - Object.values(src).reduce((a, s) => a * (1 - s), 1);
  const place = m.grd ? 'ground' : site ? 'site' : m.kind === 'town' || m.kind === 'dungeon' ? m.kind : near && near.lair && near.d <= 3 ? 'lair' : 'world';
  return { place, site: site ? site.id : null, palette: wAmbPalFor(wMusicHere()), intensity: Math.round(intensity * 1000) / 1000,
    tint: { night, wx, tired, hurt: hp < M.hurt[0] }, why: Object.keys(src).filter(k => src[k] > .05) };
}

/* ---------- when it plays ---------- */
// a tune's palette; the night road (off the road after dark) plays its region's, tinted for night, so stepping on
// and off a road at night never swaps the bed for the tune
function wAmbPalFor(theme) {
  if (theme === 'w_night') return WG ? W_AMB_THEME[W_MUSIC_REGION[wRegionHere()]] || null : null;
  return W_AMB_THEME[theme] || null;
}
// the bed replaces a calm tune out in the world, for the places that have a palette
function wAmbWants(theme, mode) {
  return SET.music && !LAB && SET.mstyle !== 'classic' && mode === 'calm' && WG && RUN && UI.screen === 'run' && (UI.view === 'world' || UI.view === 'panel') ? wAmbPalFor(theme) : null;
}
const wW50MusicStop = musicStop;
musicStop = function () { wAmbStop(); return wW50MusicStop(); };
const wW50MusicSet = musicSet;
musicSet = function (theme, mode) {
  const key = wAmbWants(theme, mode);
  if (!key) { if (WAMB.pal) wAmbStop(); return wW50MusicSet(theme, mode); }
  MUS.wantMode = mode;
  // a tune's crossfade is under way (it starts in 650 ms): start the bed now, and stop that tune as soon as it starts
  if (MUS.switching) { wAmbStart(key); setTimeout(() => { if (WAMB.pal && MUS.timer) wW50MusicStop(); }, 700); return; }
  if (MUS.timer) wW50MusicStop();
  wAmbStart(key);
};

/* ---------- settings ---------- */
function wAmbSettingsRow() {
  const box = $('modalBox'), mv = box && box.querySelector('#sMvol'); if (!mv || box.querySelector('#wMstyle')) return;
  const amb = SET.mstyle !== 'classic';
  mv.closest('label').insertAdjacentHTML('afterend', `<label class="rng"><span>Music style</span><select id="wMstyle"><option value="ambient" ${amb ? 'selected' : ''}>Ambient</option><option value="classic" ${amb ? '' : 'selected'}>Classic</option></select></label>
    <p class="hint" id="wMstyleHint" style="margin:-6px 12px 0;font-size:14px">${amb ? 'Out in the world: slow, quiet music for the place, with the tune heard now and then. It builds when danger is near. So far the Charter Plains; other places play their tunes.' : 'Every place plays its tune, as before.'} Matches always play their tunes.</p>`);
  $('wMstyle').onchange = e => { SET.mstyle = e.target.value; saveSettings(); const [t, m] = musicWanted(); musicSet(t, m); const r = $('wMstyle').closest('label'), h = $('wMstyleHint'); r.remove(); h.remove(); wAmbSettingsRow(); };
  const hint = [...box.querySelectorAll('p.hint')].pop();
  if (WAMB.pal && hint && /Music starts after/.test(hint.innerHTML)) hint.innerHTML = hint.innerHTML.replace('Music starts after your next click or key press.', `Now playing: <b>${esc(W_AMB_PAL[WAMB.pal].name)}</b> (ambient).`);
}
(() => { const box = $('modalBox'); if (box) new MutationObserver(wAmbSettingsRow).observe(box, { childList: true }); })();

/* ---------- How to play ---------- */
const wW50RenderHelp = renderHelp;
renderHelp = function () {
  wW50RenderHelp();
  const sec = $('wHelp'); if (!sec || $('wHelpAmb')) return;
  sec.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpAmb"><b>Music style.</b> Out in the world the music is ambient: slow and quiet, made fresh as you walk, with bits of the region's tune now and then. It also tells you how things are: it builds, with a heartbeat and then a beat, when you are in danger (off the road where wild teams roam, at night, near an alpha or a lair, in a dungeon, with a grudge after you, or with your team low on HP), and settles after. It goes thinner when your starters are tired, and lower at night. So far that is the Charter Plains; other places play their tunes. Matches always play their tunes. Pick Classic in Settings for the tunes everywhere.</p>`);
};
