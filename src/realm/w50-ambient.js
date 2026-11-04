/* w50: ambient music out in the world (issue #28, phases 1 to 4). Beside Sudden Death's sequencer (app/music.js, left
   alone for matches, the title and the other places), a generative engine plays slow layers for where you stand:
   a drone (root and fifth, slow swells under a slow filter), a pad (a chord every 2 to 4 bars, on a weighted random
   walk), a texture (filtered noise: a breeze), motif fragments (2 to 5 notes of the region's tune, varied, with long
   rests), grains (crackle, crickets, drips) and accents (a bell, a lark, a foghorn, an anvil...). One shared reverb
   and a soft master filter make the space.
   The music is planned by wAmbGen(pal, seed): a seeded stream of events in time order, so a stretch is the same in a
   test and differs from day to day. The live engine only plays that stream; it reads the world and never changes it (it may be
   the first to look at the day's weather, which rolls it, as the HUD's look would).
   The mood (wMusicMood) reads the world: the place, the time, the weather, the team (low HP is a danger, tired legs
   thin the sound) and threats (the odds of a wild team on this tile, an alpha or a lair nearby, a dungeon, a grudge,
   fog by day, night off the road). They make one number, the intensity (0 calm to 1 danger), which eases toward its
   target (up in seconds, down slower). As it rises the tempo picks up, chords change sooner and fill out, the motif
   comes oftener and shorter, a pulse comes in (a heartbeat, then a beat on the grid), the drone deepens, the breeze
   thins and the birds go quiet. Night lowers the pad, takes its fragments from The Night Road, and brings night
   sounds (an owl, crickets).
   Palettes (W_AMB_PAL): each region, the towns and the dungeons, so you know where you are with your eyes shut. A
   region's weather has its own layer: fog muffles the Brinefen and sounds the foghorn, an ash storm crackles and
   rumbles in the Cindermaw, a blizzard howls and glitters in the Frostspire. Walking from one to the next crossfades
   them. Special places have their own (W_AMB_PLACE): the five secret sites (the wreck creaks, the chapel and the
   abbey have a choir, the shrine and the Road to Nowhere rise and shimmer), the Hall of Legends at the Coliseum (a
   slow, grand drone on the League's own tune), and a lair's door. Every ground's map plays a quiet bed between games
   with the ground's tune as its motif (a far whistle, a clap). A calm tune with no palette keeps playing as it was.
   The full tune: now and then a palette states its whole tune, slowly: arriving in a region, at dawn, and by chance
   every 5 to 10 minutes (never in danger), so the tunes still mean something.
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
  cross: 4,              // seconds for one palette to fade out as the next fades in
  tex: 2,                // the texture's level against its palette's vol (it is the main colour when calm)
  keep: 8,               // voices kept back for the pad, the motif and the pulse: accents and grains stop short of them
  late: .25,             // after a stall or a sleeping tab this late, the plan picks up where it was (nothing bursts out)
  settle: 1.2,           // seconds a new palette must be wanted before the bed changes (no flapping at a border)
  pause: .33,            // the bed's level while the game is paused (the tunes drop to .3 of .9)
  theme: [300, 600],     // seconds between chance statements of the whole tune
  arrive: 8, dawn: [6, 8],  // a statement this many seconds after reaching a region; at dawn, between these hours
  lair: 3,               // a lair's own bed within this many tiles of its door
};
const W_AMB_MOOD = {
  wild: [.12, .55],      // a tile's wild-match odds at which the threat is full, and what full is worth
  near: 6, alpha: .9,    // an alpha or lair within this many tiles; worth this at its door
  dungeon: .45, grudge: .4, fog: .3, night: .2,
  hurt: [.5, .9],        // team HP below this share is a danger, worth this at 0 HP
  tired: .5,             // this share of the starters tired or spent thins the sound
};
/* A palette: the scale and root (the drone's note), the tempo calm and in danger, the sounds (drone, pad and lead
   waveforms; their filters; droneVol; gain, the palette's level, set so each plays about as loud as the next; oct [pad, lead] octaves above the root; pluck, waver or bellLead for the
   lead), the chord walk (a chord's degree to the ones it may go to next, the first ones likelier), the texture
   (filtered noise: type, f, q, vol, and a slow swell), grains, the accents (by day, at night, how far apart), the
   tunes the motifs come from (theme, and nightTheme after dark), and its weather (wx: the kind, a texture, grains,
   accents, and how far it closes the master filter). */
const W_AMB_PAL = {
  plains: { name: 'The Charter Plains', theme: 'w_plains', nightTheme: 'w_night', root: 43, scale: 'ionian', bpm: 60, bpmHi: 96,
    drone: 'sine', pad: 'triangle', lead: 'triangle', padLp: 1600,
    walk: { 0: [3, 4, 5], 3: [0, 4, 1], 4: [0, 3, 5], 5: [3, 4, 0], 1: [4, 3] },
    tex: { f: 650, q: .7, vol: .05 }, nightGrain: { a: 'cricket', gap: [.3, 1.6] },
    acc: ['bell', 'lark'], accNight: ['owl', 'bell'], accGap: [25, 70] },
  // wooden plucks and soft flutes under the canopy; chimes, birds and drips
  bloom: { name: 'The Mosswold', theme: 'w_bloom', nightTheme: 'w_night', root: 38, scale: 'dorian', bpm: 56, bpmHi: 92,
    drone: 'sine', pad: 'sine', lead: 'sine', pluck: 1, padLp: 1400,
    walk: { 0: [3, 6, 4], 3: [0, 4, 6], 4: [0, 3], 6: [3, 0, 4] },
    tex: { f: 1700, q: .5, vol: .03, swell: .13, depth: .5 }, nightGrain: { a: 'cricket', gap: [.4, 2] },
    acc: ['chime', 'lark', 'drip'], accNight: ['owl', 'drip'], accGap: [18, 50] },
  // low drones and a wavering lead over the surf; a buoy bell, gulls, the foghorn
  tide: { name: 'The Brinefen', theme: 'w_tide', nightTheme: 'w_night', root: 31, scale: 'aeolian', bpm: 50, bpmHi: 88,
    drone: 'sine', pad: 'sine', lead: 'sine', waver: 1, padLp: 1100,
    walk: { 0: [5, 3, 4], 5: [3, 0], 3: [4, 0, 5], 4: [0, 5] },
    tex: { type: 'lowpass', f: 520, q: .4, vol: .07, swell: .09, depth: .85 }, nightGrain: { a: 'cricket', gap: [.6, 2.5] },
    acc: ['buoy', 'gull', 'foghorn'], accNight: ['foghorn', 'buoy'], accGap: [22, 60],
    wx: { kind: 'fog', lp: .5, tex: { type: 'lowpass', f: 300, q: .3, vol: .12 }, acc: ['foghorn'] } },
  // dark saws through a low filter, a far rumble and crackle; an anvil now and then, a hiss
  ember: { name: 'The Cindermaw', theme: 'w_ember', nightTheme: 'w_night', gain: 2, root: 26, scale: 'phrygian', bpm: 46, bpmHi: 104,
    drone: 'sawtooth', droneLp: 260, droneVol: .7, pad: 'sawtooth', lead: 'triangle', padLp: 650,
    walk: { 0: [1, 4, 6], 1: [0, 4], 4: [0, 1, 6], 6: [0, 4] },
    tex: { type: 'lowpass', f: 140, q: .6, vol: .08, swell: .05, depth: .5 }, grain: { a: 'crackle', gap: [.15, 1.2] },
    acc: ['anvil', 'hiss'], accNight: ['anvil', 'hiss'], accGap: [20, 55],
    wx: { kind: 'ash', lp: .8, tex: { type: 'lowpass', f: 90, q: .8, vol: .25 }, grain: { a: 'crackle', gap: [.04, .3] }, acc: ['hiss', 'anvil'] } },
  // high glassy bells over snow hiss; ice cracking, sleigh bells far off
  rime: { name: 'The Frostspire', theme: 'w_rime', nightTheme: 'w_night', gain: 1.25, root: 45, scale: 'lydian', bpm: 58, bpmHi: 96,
    drone: 'sine', pad: 'sine', lead: 'sine', bellLead: 1, padLp: 3000, oct: [2, 3],
    walk: { 0: [1, 4, 5], 1: [0, 4], 4: [0, 1, 5], 5: [1, 0] },
    tex: { type: 'highpass', f: 5500, q: .5, vol: .025 },
    acc: ['icecrack', 'sleigh', 'shimmer'], accNight: ['shimmer', 'icecrack'], accGap: [22, 60],
    wx: { kind: 'blizzard', lp: .9, tex: { type: 'bandpass', f: 420, q: .7, vol: .2, swell: .2, depth: .6 }, acc: ['shimmer', 'icecrack'] } },
  // warmer and busier: the market's murmur, a street organ, the church bell
  town: { name: 'Market Day', theme: 'w_town', gain: 1.4, root: 36, scale: 'mixo', bpm: 66, bpmHi: 96,
    drone: 'triangle', droneVol: .6, pad: 'triangle', lead: 'square', leadLp: 1800, padLp: 1800, motifGap: [12, 30],
    walk: { 0: [3, 4, 6], 3: [0, 4], 4: [0, 3, 6], 6: [3, 0] },
    tex: { f: 480, q: .9, vol: .035, swell: 1.3, depth: .35 },
    acc: ['organ', 'bell'], accNight: ['bell'], accGap: [25, 60] },
  // low and cold: a deep hum, drips, stone shifting, a growl far off
  dungeon: { name: 'Below the Vaults', theme: 'w_dungeon', gain: 1.15, root: 28, scale: 'harmonic', bpm: 50, bpmHi: 100,
    drone: 'sine', pad: 'sine', lead: 'triangle', padLp: 900,
    walk: { 0: [5, 4, 3], 5: [4, 0], 4: [0, 5], 3: [4, 0] },
    tex: { type: 'lowpass', f: 110, q: .7, vol: .06 }, grain: { a: 'drip', gap: [1.5, 6] },
    acc: ['stone', 'growl'], accNight: ['stone', 'growl'], accGap: [25, 70] },
};
// a calm tune that has an ambient palette
const W_AMB_THEME = { w_plains: 'plains', w_bloom: 'bloom', w_tide: 'tide', w_ember: 'ember', w_rime: 'rime', w_town: 'town', w_dungeon: 'dungeon' };
/* Special places. Their motifs come from their region's tune (the Hall: the League's own). choir: the pad sung, two
   detuned voices a note with a slow vibrato. */
Object.assign(W_AMB_PAL, {
  // the Wreck of the Marigold: timbers creaking in the swell, low brass, the buoy
  wreck: { name: 'The Wreck of the Marigold', theme: 'w_tide', root: 33, scale: 'aeolian', bpm: 48, bpmHi: 84,
    drone: 'sine', pad: 'sine', lead: 'sawtooth', leadLp: 700, padLp: 900,
    walk: { 0: [5, 3, 6], 5: [3, 0], 3: [6, 0, 5], 6: [0, 3] },
    tex: { type: 'lowpass', f: 450, q: .4, vol: .06, swell: .08, depth: .8 },
    acc: ['creak', 'creak', 'buoy', 'gull'], accNight: ['creak', 'buoy'], accGap: [12, 35] },
  // the Frozen Chapel: a choir under the snow, a bell
  chapel: { name: 'The Frozen Chapel', theme: 'w_rime', gain: .8, root: 40, scale: 'dorian', bpm: 50, bpmHi: 84, choir: 1,
    drone: 'sine', pad: 'sawtooth', lead: 'sine', bellLead: 1, padLp: 1100,
    walk: { 0: [3, 4, 6], 3: [0, 4], 4: [0, 3], 6: [3, 0] },
    tex: { type: 'highpass', f: 6000, q: .5, vol: .015 },
    acc: ['bell', 'shimmer'], accNight: ['bell', 'shimmer'], accGap: [25, 60] },
  // the Abbey of the Last Lamp, in Rimewatch: the monks' choir, indoors
  abbey: { name: 'The Abbey of the Last Lamp', theme: 'w_rime', root: 43, scale: 'aeolian', bpm: 46, bpmHi: 80, choir: 1,
    drone: 'sine', pad: 'sawtooth', lead: 'sine', padLp: 1000,
    walk: { 0: [5, 3], 5: [3, 0], 3: [4, 0], 4: [0, 5] },
    tex: { type: 'lowpass', f: 220, q: .5, vol: .02 },
    acc: ['bell'], accNight: ['bell'], accGap: [35, 80] },
  // the Hollow Shrine, deep in the Mosswold: chimes, drips, a rising shimmer
  shrine: { name: 'The Hollow Shrine', theme: 'w_bloom', root: 38, scale: 'dorian', bpm: 52, bpmHi: 88,
    drone: 'sine', pad: 'sine', lead: 'sine', pluck: 1, padLp: 1600, oct: [1, 3],
    walk: { 0: [3, 6], 3: [0, 6], 6: [0, 3] },
    tex: { f: 2000, q: .6, vol: .025, swell: .1, depth: .5 },
    acc: ['chime', 'rise', 'drip'], accNight: ['rise', 'owl'], accGap: [20, 50] },
  // Vesper's Cottage: a fire in the grate, an old coach's evenings
  cottage: { name: "Vesper's Cottage", theme: 'w_plains', gain: .6, root: 41, scale: 'mixo', bpm: 54, bpmHi: 88,
    drone: 'sine', pad: 'triangle', lead: 'triangle', padLp: 1300,
    walk: { 0: [3, 6, 4], 3: [0, 4], 4: [0, 3], 6: [3, 0] },
    tex: { f: 500, q: .7, vol: .025 }, grain: { a: 'crackle', gap: [.5, 2.5] },
    acc: ['bell', 'owl'], accNight: ['owl'], accGap: [30, 70] },
  // the Road to Nowhere: wind on a road that ends, something rising
  nowhere: { name: 'The Road to Nowhere', theme: 'w_night', root: 38, scale: 'harmonic', bpm: 44, bpmHi: 84,
    drone: 'sine', pad: 'sine', lead: 'sine', waver: 1, padLp: 1200,
    walk: { 0: [5, 4], 5: [4, 0], 4: [0, 5] },
    tex: { f: 300, q: .7, vol: .05, swell: .1, depth: .7 },
    acc: ['rise', 'shimmer', 'growl'], accNight: ['rise', 'growl'], accGap: [20, 55] },
  // the Hall of Legends at the Crown Coliseum: a slow, grand drone on the League's tune
  hall: { name: 'The Hall of Legends', theme: 'title', gain: 1.7, root: 38, scale: 'aeolian', bpm: 46, bpmHi: 80,
    drone: 'sawtooth', droneLp: 500, droneVol: .8, pad: 'sawtooth', lead: 'sawtooth', leadLp: 1500, padLp: 1400, choir: 1,
    walk: { 0: [5, 3, 4], 5: [3, 4], 3: [4, 0], 4: [0, 5] },
    tex: { f: 450, q: .9, vol: .02, swell: 1.1, depth: .4 },
    acc: ['bell', 'rise'], accNight: ['bell'], accGap: [30, 70] },
  // a lair's door: low, a growl in the dark
  lair: { name: "A Lair's Door", theme: 'w_dungeon', gain: 1.65, root: 26, scale: 'harmonic', bpm: 48, bpmHi: 110,
    drone: 'sawtooth', droneLp: 220, droneVol: .8, pad: 'sine', lead: 'triangle', padLp: 700,
    walk: { 0: [5, 4], 5: [4, 0], 4: [0, 5] },
    tex: { type: 'lowpass', f: 90, q: .8, vol: .07 }, grain: { a: 'drip', gap: [2, 7] },
    acc: ['growl', 'stone'], accNight: ['growl', 'stone'], accGap: [15, 40] },
});
// the secret sites' palettes, by location id
const W_AMB_PLACE = { marigold: 'wreck', frozenchapel: 'chapel', hollowshrine: 'shrine', cottage: 'cottage', umbralden: 'nowhere' };
/* Every ground's map, between games: a quiet bed on the ground's own tune, its scale and its chords, a far crowd and
   a far whistle. Built from the grounds' themes (w26), so a new ground gets one. Their levels, measured as the rest:
   about 0.019 RMS (a new ground starts at .9). */
const W_AMB_GRD_GAIN = { g_ballpark: .59, g_court: .97, g_links: .78, g_lists: .79, g_lanes: 1.02, g_shed: .97, g_bowl: .89, g_ring: 1.06, g_rink: 1.2, g_sheet: .98 };
for (const id in W_GRD_THEMES) {
  const T = W_GRD_THEMES[id], prog = [...new Set(T.prog)], walk = {};
  for (const d of prog.concat(prog.includes(0) ? [] : [0])) walk[d] = prog.filter(x => x !== d).concat(d === 0 ? [] : [0]).filter((x, i, a) => a.indexOf(x) === i);
  W_AMB_PAL['grd_' + id] = { name: T.name, theme: 'wg_' + id, ground: id, root: T.root - 12, scale: T.scale, bpm: 56, bpmHi: 92,
    drone: 'sine', pad: T.pad === 'square' ? 'triangle' : T.pad, lead: T.lead, leadLp: 1800, padLp: 1400, gain: W_AMB_GRD_GAIN[id] || .9,
    walk, tex: { f: 480, q: .8, vol: .02, swell: .5, depth: .4 },
    acc: ['whistle', 'clap', 'bell'], accNight: ['owl', 'whistle'], accGap: [25, 60] };
}
const W_AMB_REGIONS = Object.keys(W_MUSIC_REGION);   // a region palette's key is its region's
if (SET.mstyle == null) SET.mstyle = 'ambient';
const WAMB = { i: 0, region: null, dawnDay: null, mood: null, moodKey: '', moodAt: 0, pal: null, low: false, starts: 0, want: null, killT: 0, timer: null, gen: null, ev: null, t0: 0, ch: null, ringing: 0, peak: 0, log: [], noise: null, ir: null };
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
// mood() gives { i, night, wx } as each event is planned: the intensity, the time of day and the weather
function wAmbGen(key, seed, mood) {
  const P = W_AMB_PAL[key], r = wRng(seed), M = mood || (() => ({ i: 0 }));
  const tunes = { day: wAmbNotes(THEMES[P.theme]), night: wAmbNotes(THEMES[P.nightTheme || P.theme]) };
  const [po, lo] = P.oct || [1, 2], mg = P.motifGap || W_AMB.motifGap;
  const pick = a => a[Math.floor(r() * a.length)], span = ([a, b]) => a + r() * (b - a), mix = (a, b, i) => a + (b - a) * i;
  // the walk leans to the first choices: weights 3, 2, 1
  const walk = d => { const o = (P.walk[d] || [0]).filter(x => x !== d), w = o.map((x, i) => Math.max(1, 3 - i)), s = w.reduce((a, b) => a + b, 0); let x = r() * s; for (let i = 0; i < o.length; i++) if ((x -= w[i]) < 0) return o[i]; return o[0]; };
  const S = { t: { chord: 0, motif: 6 + r() * 8, acc: span(P.accGap) * .5, gust: 0, pulse: 0, grain: 0, theme: span(W_AMB.theme) }, chord: null, last: '', lastAt: -1 };
  const next = function () { for (;;) {
    const k = Object.keys(S.t).reduce((a, b) => S.t[a] <= S.t[b] ? a : b), t = S.t[k], m = M(), I = m.i || 0;
    const wx = P.wx && m.wx === P.wx.kind ? P.wx : null;
    const beat = 60 / mix(P.bpm, P.bpmHi, I), bar = beat * 4, step = beat / 4 * 1.6;
    if (k === 'chord') {
      const deg = S.chord == null ? 0 : walk(S.chord), dur = bar * (I < .5 ? pick([2, 3, 4]) : pick([1, 2]));
      const ds = [0, 2, 4].concat(r() < .3 + .4 * I ? [6] : []).concat(r() < .3 * I ? [8] : []), ns = ds.map(d => degNote(P, deg + d, po - (m.night ? 1 : 0)));
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
      const notes = m.night ? tunes.night : tunes.day, src = m.night ? P.nightTheme || P.theme : P.theme;
      let i, L, v, key, n = 0;
      const gap = [mix(mg[0], 5, I), mix(mg[1], 12, I)].map(g => g * (m.night ? 1.4 : 1));
      do { L = 2 + Math.floor(r() * (I > .6 ? 2 : 4)); i = Math.floor(r() * Math.max(1, notes.length - L)); v = pick(W_AMB_VARS); key = `${i}.${L}.${v}`; } while ((key === S.last || i === S.lastAt) && ++n < 8);
      const fr = wAmbVary(notes.slice(i, i + L), v), ans = r() < W_AMB.answer, play = [];
      let at = 0;
      const lay = f => f.forEach(([d, l]) => { const len = Math.min(l, 8) * step; play.push([degNote(P, d, lo), at, len]); at += len; });
      lay(fr); if (ans) { at += beat * 2; lay(fr.map(([d, l]) => [d - 2, l])); }
      S.last = key; S.lastAt = i; S.t.motif += at + span(gap);
      return { k, t, frag: key, src, answer: ans, notes: play, dur: at };
    }
    if (k === 'theme') {
      // the whole tune, slowly, on the lead; not in danger (it waits a minute and tries again)
      if (I > W_AMB.quietAt) { S.t.theme = t + 60; continue; }
      const play = []; let at = 0;
      tunes.day.forEach(([d, l]) => { const len = Math.min(l, 8) * step; play.push([degNote(P, d, lo), at, len]); at += len; });
      S.t.theme = t + at + span(W_AMB.theme); S.t.motif = Math.max(S.t.motif, t + at + 8);
      return { k, t, src: P.theme, notes: play, dur: at };
    }
    if (k === 'acc') {
      S.t.acc += span(P.accGap) * (wx ? .6 : 1);
      if (I > W_AMB.quietAt) continue;
      const a = wx && wx.acc && r() < .6 ? pick(wx.acc) : pick(m.night && P.accNight ? P.accNight : P.acc);
      return { k, a, t, x: r() };
    }
    if (k === 'grain') {
      // the weather's grains, or the night's, or the place's own
      const G = (wx && wx.grain) || (m.night && P.nightGrain) || P.grain;
      if (!G) { S.t.grain += 1; continue; }
      S.t.grain += span(G.gap);
      return { k, a: G.a, t, x: r() };
    }
    // a gust: the texture moves its pitch and level, thinner when it is tense
    S.t.gust += span([3, 7]);
    return { k: 'gust', t, f: P.tex.f * span([.6, 1.5]), v: P.tex.vol * W_AMB.tex * span([.5, 1.2]) * (1 - .6 * I) };
  } };
  // ask for the whole tune at plan time t (arriving, dawn), unless it is due sooner anyway
  next.soon = t => { S.t.theme = Math.min(S.t.theme, t); };
  next.S = S;
  return next;
}
// the first secs seconds of a palette's music, for tests: at a fixed intensity, by day or night, in weather
function wAmbPlan(key, seed, secs, i, night, wx) { const g = wAmbGen(key, seed, () => ({ i: i || 0, night: !!night, wx: wx || null })), out = []; let e; while ((e = g()).t < secs) out.push(e); return out; }
function wAmbSeed(key) { let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h ^ ((WG ? WG.dayAbs : 0) * 7919) ^ (WG ? Math.floor(WG.min / 60) * 131 : 0)) >>> 0; }

/* ---------- the sound ---------- */
function wAmbBufs(c) {
  if (!WAMB.noise || WAMB.noise.sampleRate !== c.sampleRate) {
    // seeded, so the room (and so every pitch's loudness through it) is the same every session
    const r = wRng(2805), n = c.sampleRate * 4, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    // the room is drawn at 44.1 kHz and resampled, so it is the same room at any sample rate (48 kHz on most Macs)
    const B = 44100, mb = Math.floor(B * W_AMB.verb), m = Math.floor(c.sampleRate * W_AMB.verb), ir = c.createBuffer(2, m, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const q = wRng(9091 + ch), base = new Float32Array(mb + 1); for (let i = 0; i < mb; i++) base[i] = (q() * 2 - 1) * Math.pow(1 - i / mb, 3);
      const e = ir.getChannelData(ch), k = B / c.sampleRate;
      for (let i = 0; i < m; i++) { const x = i * k, j = Math.floor(x), f = x - j; e[i] = (base[j] * (1 - f) + base[Math.min(mb, j + 1)] * f) * k; }
    }
    WAMB.noise = b; WAMB.ir = ir;
  }
}
// the chain: voices go dry and through the reverb, then the master filter, the fade and the volume
function wAmbChain(c) {
  wAmbBufs(c);
  const ch = { dry: c.createGain(), wet: c.createGain(), verb: c.createConvolver(), lp: c.createBiquadFilter(), fade: c.createGain(), vol: c.createGain(), hold: [], live: 0, voices: new Set() };
  ch.dry.gain.value = .45; ch.wet.gain.value = .8; ch.verb.buffer = WAMB.ir;
  ch.lp.type = 'lowpass'; ch.lp.frequency.value = W_AMB.lp; ch.fade.gain.value = 0; ch.vol.gain.value = SET.mvol * W_AMB.vol * ((WAMB.pal && W_AMB_PAL[WAMB.pal].gain) || 1);
  ch.dry.connect(ch.lp); ch.wet.connect(ch.verb).connect(ch.lp); ch.lp.connect(ch.fade).connect(ch.vol).connect(c.destination);
  return ch;
}
function wAmbOut(g) { g.connect(WAMB.ch.dry); g.connect(WAMB.ch.wet); }
// one voice: an oscillator with an envelope; counted against the cap
function wAmbCap() { return W_AMB.voices - (WAMB.low ? W_AMB.keep : 0); }
function wAmbVoice(c, t, hz, dur, type, vol, o = {}) {
  const ch = WAMB.ch; if (!ch || ch.live >= wAmbCap()) return false;
  const os = c.createOscillator(), g = c.createGain(), a = o.a || .02, rel = o.r || .3;
  os.type = type; os.frequency.setValueAtTime(hz, t);
  if (o.glide) os.frequency.exponentialRampToValueAtTime(o.glide, t + dur);
  if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 4.5; lg.gain.value = hz * o.vib; l.connect(lg).connect(os.frequency); l.start(t); l.stop(t + dur + rel + .05); }
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
// a noise voice: a burst of filtered noise with an envelope (hisses, cracks, crackle, stone); counted like the rest
// where a noise voice starts in the 4 s buffer: from its seed (0 to 1), leaving room for all of it
function wAmbNoiseAt(off, len) { return Math.max(0, (WAMB.noise ? WAMB.noise.duration : 4) - len - .05) * (off || 0); }
function wAmbNoise(c, t, dur, type, f, q, vol, o = {}) {
  const ch = WAMB.ch; if (!ch || ch.live >= wAmbCap()) return false;
  const n = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(), a = o.a || .005, rel = o.r || .1;
  n.buffer = WAMB.noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + Math.max(a, dur)); g.gain.exponentialRampToValueAtTime(.0001, t + dur + rel);
  n.connect(fl).connect(g); wAmbOut(g);
  ch.live++; WAMB.ringing++; ch.voices.add(n); WAMB.peak = Math.max(WAMB.peak, ch.live);
  n.onended = () => { ch.live--; WAMB.ringing--; ch.voices.delete(n); try { g.disconnect(); } catch (e) { } };
  n.start(t, wAmbNoiseAt(o.off, dur + rel + .05)); n.stop(t + dur + rel + .05);
  return true;
}
// a looped noise through a filter, with a slow swell: the texture, and the weather's layer. g is the level (gusts,
// danger and the weather move it); the swell multiplies it by 1 ± depth, so it rises and falls with whatever the
// level is, and never goes below zero
function wAmbBed(c, T, out, vol) {
  const ch = WAMB.ch, t = c.currentTime, n = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(), sw = c.createGain();
  n.buffer = WAMB.noise; n.loop = true; fl.type = T.type || 'bandpass'; fl.frequency.value = T.f; fl.Q.value = T.q; g.gain.value = vol; sw.gain.value = 1;
  n.connect(fl).connect(g).connect(sw); sw.connect(out); n.start(t); ch.hold.push(n);
  if (T.swell) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = T.swell; lg.gain.value = Math.min(.95, T.depth || .5); l.connect(lg).connect(sw.gain); l.start(t); ch.hold.push(l); }
  return { bp: fl, g, sw };
}
// the drone and the texture run for as long as the bed does
function wAmbHold(c, P) {
  const ch = WAMB.ch, t = c.currentTime;
  const lp = c.createBiquadFilter(), sw = c.createOscillator(), swg = c.createGain();
  lp.type = 'lowpass'; lp.frequency.value = P.droneLp || 420; sw.frequency.value = .025; swg.gain.value = 180; sw.connect(swg).connect(lp.frequency);
  const dg = c.createGain(), sl = c.createOscillator(), slg = c.createGain();
  dg.gain.value = .05 * (P.droneVol || 1); sl.frequency.value = .04; slg.gain.value = .02; sl.connect(slg).connect(dg.gain);
  for (const [m, dt] of [[P.root, 0], [P.root + 7, 3], [P.root + 12, -4]]) { const o = c.createOscillator(); o.type = P.drone; o.frequency.value = noteHz(m); o.detune.value = dt; o.connect(dg); o.start(t); ch.hold.push(o); }
  // under it, an octave down that comes in with danger
  const sub = c.createOscillator(), sg = c.createGain(); sub.type = 'sine'; sub.frequency.value = noteHz(P.root - 12); sg.gain.value = 0; sub.connect(sg).connect(lp); sub.start(t); ch.hold.push(sub);
  dg.connect(lp); wAmbOut(lp); ch.drone = { g: dg, sub: sg, lp, sl };
  ch.hold.push(sw, sl); sw.start(t); sl.start(t);
  ch.tex = wAmbBed(c, P.tex, ch.dry, P.tex.vol * W_AMB.tex);
  ch.wx = P.wx ? wAmbBed(c, P.wx.tex, ch.dry, 0) : null;
}
/* The accents and grains, by name: each plays from its event's seed (e.x), so the same plan sounds the same. */
const W_AMB_SND = {
  bell: (c, e, t, P, r) => { const hz = noteHz(degNote(P, [0, 4, 7][Math.floor(r() * 3)], (P.oct || [1, 2])[1])); [[1, .03], [2.76, .012], [5.4, .006]].forEach(([p, v]) => wAmbVoice(c, t, hz * p, .05, 'sine', v, { a: .005, r: 3.5 / p })); },
  buoy: (c, e, t, P, r) => { const hz = noteHz(P.root + 24); for (const d of r() < .5 ? [0] : [0, 1.3]) [[1, .025], [2.76, .01], [5.4, .004]].forEach(([p, v]) => wAmbVoice(c, t + d, hz * p, .05, 'sine', v, { a: .005, r: 6 / p })); },
  lark: (c, e, t, P, r) => { const hz = 2600 + r() * 1400, n = 3 + Math.floor(r() * 4); for (let i = 0; i < n; i++) wAmbVoice(c, t + i * .13, hz * (1 + (i % 2) * .12), .07, 'sine', .006, { a: .01, r: .05, glide: hz * 1.3 }); },
  owl: (c, e, t, P, r) => { const hz = 380 + r() * 60; [0, .45, .62].forEach((d, i) => wAmbVoice(c, t + d, hz * (i ? .94 : 1), i ? .12 : .32, 'sine', .014, { a: .06, r: .25, glide: hz * .9, lp: 900 })); },
  chime: (c, e, t, P, r) => { const n = 2 + Math.floor(r() * 3); let at = 0; for (let i = 0; i < n; i++) { wAmbVoice(c, t + at, noteHz(degNote(P, [0, 2, 4, 7, 9][Math.floor(r() * 5)], 3)), .03, 'sine', .01, { a: .003, r: 2.5 }); at += .25 + r() * .35; } },
  drip: (c, e, t, P, r) => { const hz = 1200 + r() * 1000; wAmbVoice(c, t, hz, .04, 'sine', .018, { a: .002, r: .15, glide: hz * 1.7 }); },
  foghorn: (c, e, t, P) => { const hz = noteHz(P.root + 12); [1, 1.006].forEach(m => wAmbVoice(c, t, hz * m, 2.4, 'sawtooth', .028, { a: .5, r: 1.5, lp: 350 })); },
  gull: (c, e, t, P, r) => { for (const d of r() < .5 ? [0, .3] : [0, .3, .55]) wAmbVoice(c, t + d, 1500, .22, 'triangle', .007, { a: .02, r: .08, glide: 950 }); },
  anvil: (c, e, t, P, r) => { const hz = 600 + r() * 300, n = 1 + Math.floor(r() * 3); let at = 0; for (let i = 0; i < n; i++) { [[1, .02], [2.41, .012], [3.87, .008], [5.3, .005]].forEach(([p, v]) => wAmbVoice(c, t + at, hz * p, .02, 'sine', v, { a: .002, r: 1.2 / p, lp: 4000 })); at += .35 + r() * .35; } },
  hiss: (c, e, t, P, r) => wAmbNoise(c, t, .9, 'highpass', 3200, .5, .012, { a: .3, r: .5, off: r() }),
  icecrack: (c, e, t, P, r) => { const n = 2 + Math.floor(r() * 2); for (let i = 0; i < n; i++) wAmbNoise(c, t + i * .04, .02, 'bandpass', 2600, 3, .05, { a: .001, r: .04, off: r() }); wAmbVoice(c, t, 3200, .06, 'sine', .006, { a: .002, r: .05, glide: 1400 }); },
  sleigh: (c, e, t, P, r) => { const n = 6 + Math.floor(r() * 5); for (let i = 0; i < n; i++) wAmbVoice(c, t + i * .08, 4200 + r() * 1500, .015, 'sine', .003, { a: .002, r: .12 }); },
  shimmer: (c, e, t, P) => [0, 4, 7].forEach((d, i) => wAmbVoice(c, t + i * .4, noteHz(degNote(P, d, 4)), 1, 'sine', .004, { a: 1.5, r: 2.5 })),
  organ: (c, e, t, P, r) => { const ns = wAmbNotes(THEMES[P.theme]), i = Math.floor(r() * Math.max(1, ns.length - 4)); ns.slice(i, i + 4).forEach(([d], k) => wAmbVoice(c, t + k * .32, noteHz(degNote(P, d, 2)), .26, 'square', .009, { a: .02, r: .1, lp: 1800, vib: .004 })); },
  stone: (c, e, t, P, r) => wAmbNoise(c, t, .35, 'lowpass', 180, .7, .06, { a: .02, r: .3, off: r() }),
  growl: (c, e, t, P) => { const hz = noteHz(P.root + 12); wAmbVoice(c, t, hz, 1.6, 'sawtooth', .02, { a: .5, r: .8, lp: 260, glide: hz * .85 }); },
  cricket: (c, e, t, P, r) => { const hz = 4300 + r() * 400; for (let i = 0; i < 3; i++) wAmbVoice(c, t + i * .045, hz, .018, 'sine', .0035, { a: .003, r: .01 }); },
  // timbers: a slow sawtooth buzz through a narrow band, bending down
  creak: (c, e, t, P, r) => { const n = 1 + Math.floor(r() * 2); for (let i = 0; i < n; i++) { const f = 700 + r() * 500; wAmbVoice(c, t + i * .7, 30 + r() * 20, .5 + r() * .4, 'sawtooth', .05, { a: .1, r: .25, glide: 24, lp: f }); } },
  // a rising shimmer: a high note sliding up an octave, and a few sparkles
  rise: (c, e, t, P, r) => { const hz = noteHz(degNote(P, [0, 4][Math.floor(r() * 2)], 3)); wAmbVoice(c, t, hz, 3, 'sine', .006, { a: 1.2, r: 2, glide: hz * 2, vib: .01 }); for (let i = 0; i < 3; i++) wAmbVoice(c, t + 1 + i * .5, hz * (2 + r()), .02, 'sine', .004, { a: .003, r: .8 }); },
  // a ground between games: a far whistle, and a few hands clapping
  whistle: (c, e, t, P, r) => { const hz = 2600 + r() * 600; for (const d of r() < .5 ? [0] : [0, .5]) wAmbVoice(c, t + d, hz, .28, 'sine', .006, { a: .01, r: .05, vib: .02, lp: 5000 }); },
  clap: (c, e, t, P, r) => { const n = 3 + Math.floor(r() * 6); for (let i = 0; i < n; i++) wAmbNoise(c, t + i * (.12 + r() * .1), .01, 'bandpass', 1400 + r() * 600, 1.2, .03, { a: .001, r: .05, off: r() }); },
  crackle: (c, e, t, P, r) => wAmbNoise(c, t, .008, 'bandpass', 2500 + r() * 2500, 1.5, .025, { a: .001, r: .02, off: r() }),
};
function wAmbPlay(c, e, t) {
  const P = W_AMB_PAL[WAMB.pal];
  // the pad: a voice a note, or sung (two detuned voices with a slow vibrato)
  if (e.k === 'chord') e.notes.forEach((m, i) => { const o = { a: e.dur * .4, r: e.dur * .5, lp: P.padLp };
    if (P.choir) [-7, 7].forEach(dt => wAmbVoice(c, t + i * .15, noteHz(m) * Math.pow(2, dt / 1200), e.dur * .55, P.pad, .012, Object.assign({ vib: .004 }, o)));
    else wAmbVoice(c, t + i * .15, noteHz(m), e.dur * .55, P.pad, .022, o); });
  else if (e.k === 'theme') e.notes.forEach(([m, at, len]) => { wAmbVoice(c, t + at, noteHz(m), len * .9, P.lead, .03, { a: .08, r: 1.2, lp: P.leadLp || 2600, vib: P.waver ? .006 : 0 }); wAmbVoice(c, t + at, noteHz(m) / 2, len * .9, 'sine', .012, { a: .1, r: 1.2 }); });
  else if (e.k === 'motif') e.notes.forEach(([m, at, len]) => {
    // a pluck (wood), a waver (over water) or a bell (an octave above): the lead's colour
    const hz = noteHz(m), env = P.pluck ? { a: .005, r: .7 } : { a: .06, r: .9 };
    wAmbVoice(c, t + at, hz, P.pluck ? .05 : len * .85, P.lead, .035, Object.assign(env, { lp: P.leadLp || 2600, vib: P.waver ? .006 : 0 }));
    if (P.bellLead) wAmbVoice(c, t + at, hz * 2, .04, 'sine', .01, { a: .003, r: 1.6 });
  });
  else if ((e.k === 'acc' || e.k === 'grain') && W_AMB_SND[e.a]) { WAMB.low = true; try { W_AMB_SND[e.a](c, e, t, P, wRng(Math.floor(e.x * 4294967296))); } finally { WAMB.low = false; } }
  else if (e.k === 'pulse') { wAmbVoice(c, t, e.hz, .12, 'sine', e.grid ? .07 : .05, { a: .005, r: .2, glide: e.hz * .6, lp: 300 }); if (!e.grid) wAmbVoice(c, t + e.beat * .3, e.hz, .1, 'sine', .03, { a: .005, r: .18, glide: e.hz * .6, lp: 300 }); else wAmbVoice(c, t + e.beat / 2, e.hz * 2, .08, 'triangle', .012, { a: .005, r: .12, lp: 900 }); }
  else if (e.k === 'gust' && WAMB.ch.tex) { WAMB.ch.tex.bp.frequency.setTargetAtTime(e.f, t, 1.5); WAMB.ch.tex.g.gain.setTargetAtTime(e.v, t, 1.5); }
  if (e.k !== 'grain') { WAMB.log.push({ k: e.k, a: e.a, t: e.t, frag: e.frag, src: e.src, deg: e.deg }); if (WAMB.log.length > 200) WAMB.log.shift(); }
}
function wAmbTick() {
  const c = SND.ctx; if (!c || !WAMB.pal || !WAMB.ch || !WG || !RUN) return;
  const now = c.currentTime, dt = Math.min(1, Math.max(0, now - (WAMB.at || now))); WAMB.at = now;
  // the mood changes when you step, the clock moves or HP changes; otherwise once a second is plenty
  const key = [WG.map, WG.x, WG.y, WG.min, RUN.hp, RUN.maxhp, WG.dayAbs].join();
  if (key !== WAMB.moodKey || now - WAMB.moodAt > 1) { WAMB.mood = wMusicMood(); WAMB.moodKey = key; WAMB.moodAt = now; }
  wAmbEase(WAMB.mood.intensity, dt);
  const ch = WAMB.ch, P = W_AMB_PAL[WAMB.pal], I = WAMB.i, tired = WAMB.mood.tint.tired, night = WAMB.mood.tint.night, wx = wAmbWx();
  // dawn in a region: its whole tune, once a day
  const h = wHour();
  if (W_AMB_REGIONS.includes(WAMB.pal) && h >= W_AMB.dawn[0] && h < W_AMB.dawn[1] && WAMB.dawnDay !== WG.dayAbs) { WAMB.dawnDay = WG.dayAbs; WAMB.gen.soon(now - WAMB.t0 + W_AMB.look + 2); }
  // a parameter only gets a new target when it moves (not 40 times a second toward the same value)
  const to = (prm, v, tau) => { if (prm.wAmbTo === undefined || Math.abs(prm.wAmbTo - v) > Math.abs(v) * .01 + 1e-5) { prm.setTargetAtTime(v, now, tau); prm.wAmbTo = v; } };
  to(ch.vol.gain, SET.mvol * W_AMB.vol * (P.gain || 1) * (UI.paused ? W_AMB.pause : 1), .2);
  to(ch.drone.g.gain, (.05 + .035 * I) * (P.droneVol || 1), 1); to(ch.drone.sub.gain, .06 * I, 1);
  to(ch.drone.lp.frequency, (P.droneLp || 420) * (tired ? .7 : 1), 2); to(ch.drone.sl.frequency, tired ? .02 : .04, 2);
  if (ch.wx) to(ch.wx.g.gain, wx ? P.wx.tex.vol * W_AMB.tex * (1 - .3 * I) : 0, 3);
  to(ch.lp.frequency, W_AMB.lp * (tired ? .6 : 1) * (night ? .75 : 1) * (wx ? P.wx.lp : 1), 2);
  // after a stall or a sleeping tab, the plan picks up where it was: its clock moves on by the lag, in one step, so
  // nothing late bursts out and an hour asleep costs nothing to catch up (the drone and the texture played on)
  if (WAMB.ev && now - (WAMB.t0 + WAMB.ev.t) > W_AMB.late) WAMB.t0 = now + .02 - WAMB.ev.t;
  while (WAMB.ev && WAMB.t0 + WAMB.ev.t < now + W_AMB.look) {
    const e = WAMB.ev, at = WAMB.t0 + e.t;
    wAmbPlay(c, e, Math.max(at, now + .02));
    WAMB.ev = WAMB.gen();
  }
}
function wAmbStart(key) {
  const c = SND.ctx; if (!c || c.state !== 'running' || !SET.music || LAB) return;
  if (WAMB.pal === key && WAMB.ch) return;
  // another palette: it fades out while this one fades in, over the same time
  const cross = !!WAMB.pal, fin = cross ? W_AMB.cross : W_AMB.fade;
  if (cross) wAmbStop(W_AMB.cross);
  // the seed is the palette, the day and the hour, and how many beds have started, so coming back is never a replay
  WAMB.pal = key; WAMB.ch = wAmbChain(c); WAMB.gen = wAmbGen(key, (wAmbSeed(key) ^ Math.imul(++WAMB.starts, 104729)) >>> 0, () => ({ i: WAMB.i, night: !!(WAMB.mood && WAMB.mood.tint.night), wx: wAmbWx() })); WAMB.mood = wMusicMood(); WAMB.moodKey = ''; WAMB.at = c.currentTime; WAMB.ev = WAMB.gen(); WAMB.t0 = c.currentTime + .1; WAMB.log = [];
  WAMB.ch.fade.gain.setValueAtTime(0, c.currentTime); WAMB.ch.fade.gain.linearRampToValueAtTime(1, c.currentTime + fin); WAMB.lastIn = fin;
  // arriving in a region (not coming back to it after a match): its whole tune, soon
  if (W_AMB_REGIONS.includes(key) && WAMB.region !== key) { WAMB.gen.soon(W_AMB.arrive); WAMB.region = key; }
  wAmbHold(c, W_AMB_PAL[key]);
  clearInterval(WAMB.timer); WAMB.timer = setInterval(wAmbTick, 200); wAmbTick();
}
function wAmbStop(fade) {
  clearInterval(WAMB.timer); WAMB.timer = null;
  const c = SND.ctx, ch = WAMB.ch;
  WAMB.pal = null; WAMB.ch = null; WAMB.gen = null; WAMB.ev = null; WAMB.want = null;
  if (!c || !ch) return;
  const out = fade || W_AMB.fade / 3, now = c.currentTime; WAMB.lastFade = out;
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
// a special place's palette, or null: a secret site, a ground's map, the Hall of Legends (the Coliseum), the abbey
// (inside it, in Rimewatch), or a lair's door
function wAmbPlace() {
  if (!WG) return null;
  const m = wCurMap(); if (!m) return null;
  const site = wAmbSite(); if (site) return W_AMB_PLACE[site.id] || null;
  if (m.grd) return W_AMB_PAL['grd_' + m.grd] ? 'grd_' + m.grd : null;
  if (WG.map === 'coliseum') return 'hall';
  if (WG.map === 'rimewatch') { const b = wAmbAbbey(); if (b && WG.x > b.x && WG.x < b.x + b.w - 1 && WG.y > b.y && WG.y < b.y + b.h - 1) return 'abbey'; }
  if (m.kind === 'world') { const L = wAmbLairNear(); if (L) return 'lair'; }
  return null;
}
function wAmbAbbey() { const d = DB.towns.find(t => t.id === 'rimewatch'); return d && (d.buildings || []).find(b => /ABBEY/.test(b.sign || '')) || null; }
// an unbeaten, found lair within W_AMB.lair tiles of where you stand
function wAmbLairNear() {
  return DB.locs.find(l => l.kind === 'lair' && !(l.hidden && !wFlag(l.hidden)) && !wFlag('alpha_' + l.alpha) && Math.hypot(l.x - WG.x, l.y - WG.y) <= W_AMB.lair) || null;
}
// the site whose map you are in (the wreck, the cottage, the chapel...), or null
function wAmbSite() { return WG ? DB.locs.find(l => l.kind === 'site' && l.map === WG.map) || null : null; }
// the nearest unbeaten alpha or lair on this map, in tiles
function wAmbAlphaNear(m) {
  const R = W_AMB_MOOD.near; let best = null;
  for (let y = WG.y - R; y <= WG.y + R; y++) for (let x = WG.x - R; x <= WG.x + R; x++) {
    if (!m.t[y] || m.t[y][x] == null) continue;
    const c = wTileAt(m, x, y); if (c !== 'M' && c !== 'Z') continue;  // as the map shows it: a hidden lair stays hidden
    const mt = m.meta[x + ',' + y] || {}, L = mt.loc && DB.locs.find(l => l.id === mt.loc), a = c === 'M' ? mt.alpha : L && L.alpha;
    if (!a || wFlag('alpha_' + a)) continue;
    const d = Math.hypot(x - WG.x, y - WG.y); if (d <= R && (!best || d < best.d)) best = { d, lair: c === 'Z', alpha: a };
  }
  return best;
}
/* What the music should say here: { place, palette, intensity, tint, why }. place is world, town, dungeon, site,
   ground, hall, abbey or lair; intensity the target (0 to 1); tint { night, wx, tired, hurt }; why the threats, by name. */
function wMusicMood() {
  const M = W_AMB_MOOD, m = WG && wCurMap();
  if (!m || !RUN) return { place: 'world', palette: null, intensity: 0, tint: {}, why: [] };
  const world = m.kind === 'world', site = wAmbSite(), night = wIsNight(), road = world && wOnRoad();
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
  const pl = wAmbPlace(), place = m.grd ? 'ground' : site ? 'site' : pl === 'hall' ? 'hall' : pl === 'abbey' ? 'abbey' : m.kind === 'town' || m.kind === 'dungeon' ? m.kind : pl === 'lair' ? 'lair' : 'world';
  return { place, site: site ? site.id : null, palette: wAmbPalFor(wMusicHere()), intensity: Math.round(intensity * 1000) / 1000,
    tint: { night, wx, tired, hurt: hp < M.hurt[0] }, why: Object.keys(src).filter(k => src[k] > .05) };
}

/* ---------- when it plays ---------- */
// a tune's palette; the night road (off the road after dark) plays its region's, tinted for night, so stepping on
// and off a road at night never swaps the bed for the tune
function wAmbPalFor(theme) {
  const pl = wAmbPlace(); if (pl) return pl;
  if (theme === 'w_night') return WG ? W_AMB_THEME[W_MUSIC_REGION[wRegionHere()]] || null : null;
  return W_AMB_THEME[theme] || null;
}
// the palette's weather, when it is blowing here
function wAmbWx() { const P = WAMB.pal && W_AMB_PAL[WAMB.pal]; return P && P.wx && WAMB.mood && WAMB.mood.tint.wx === P.wx.kind ? P.wx.kind : null; }
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
  // a different palette must be wanted for a moment first, so walking along a border never flaps between beds
  if (WAMB.pal && WAMB.ch && key !== WAMB.pal) {
    const now = performance.now();
    if (!WAMB.want || WAMB.want.key !== key) WAMB.want = { key, at: now };
    if (now - WAMB.want.at < W_AMB.settle * 1000) return;
  }
  WAMB.want = null;
  // a tune's crossfade is under way (it starts in 650 ms): start the bed now, and stop that tune as soon as it starts
  if (MUS.switching) { wAmbStart(key); if (!WAMB.killT) WAMB.killT = setTimeout(() => { WAMB.killT = 0; if (WAMB.pal && MUS.timer) wW50MusicStop(); }, 700); return; }
  if (MUS.timer) wW50MusicStop();
  wAmbStart(key);
};

/* ---------- settings ---------- */
function wAmbSettingsRow() {
  const box = $('modalBox'), mv = box && box.querySelector('#sMvol'); if (!mv || box.querySelector('#wMstyle')) return;
  const amb = SET.mstyle !== 'classic';
  mv.closest('label').insertAdjacentHTML('afterend', `<label class="rng"><span>Music style</span><select id="wMstyle"><option value="ambient" ${amb ? 'selected' : ''}>Ambient</option><option value="classic" ${amb ? '' : 'selected'}>Classic</option></select></label>
    <p class="hint" id="wMstyleHint" style="margin:-6px 12px 0;font-size:14px">${amb ? 'Out in the world: slow, quiet music for the place, with the tune heard now and then. It builds when danger is near. Every region, town, dungeon, special place and ground has its own.' : 'Every place plays its tune, as before.'} Matches always play their tunes.</p>`);
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
  sec.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpAmb"><b>Music style.</b> Out in the world the music is ambient: slow and quiet, made fresh as you walk, with bits of the region's tune now and then. It also tells you how things are: it builds, with a heartbeat and then a beat, when you are in danger (off the road where wild teams roam, at night, near an alpha or a lair, in a dungeon, with a grudge after you, or with your team low on HP), and settles after. It goes thinner when your starters are tired, and lower at night. Every region sounds like itself (a breeze on the plains, chimes in the Mosswold, surf and a foghorn on the Brinefen, crackle and a far anvil in the Cindermaw, bells and ice in the Frostspire), and so do the towns and the dungeons; fog, ash and blizzards can be heard. Special places have their own: the creaking wreck, the chapel's and the abbey's choirs, the shrine, the Hall of Legends, a lair's door, and every ground between games. Now and then you hear a place's whole tune, slowly: when you reach a region, at dawn, and once in a while. Matches always play their tunes. Pick Classic in Settings for the tunes everywhere.</p>`);
};
