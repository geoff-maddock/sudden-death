/* ================= Sudden Death — a Brimstone League dungeon card battler ================= */
/* p1: utilities and the league's creature renderer (shared with Brimstone Diamond and Black Ice) */
/* Randomness. A run with a seed (RUN.seed, set by newRun) is the same for everyone who plays that seed:
   - the run stream (map, encounters, rewards, shops, events) is reseeded from the seed and the room (act:pos) the
     first time it is used in each room, and each act's map from 'map:<act>', so how you played earlier rooms does
     not change later ones;
   - the fight stream lives in B.rng, seeded from the seed and the room at startCombat, so it is saved with B;
   - anything cosmetic (shake, pops, sounds, the title screen) calls Math.random directly and never takes from either.
   A run without a seed (older saves, the Realm, most tests) uses Math.random, as before. */
const RND0 = Math.random; // kept at load, as the old `const R = Math.random` was, so a stubbed Math.random (tests) doesn't reach R
function seedHash(seed, key) { let h = (seed ^ 0x9e3779b9) >>> 0; key = String(key); for (let i = 0; i < key.length; i++) { h = Math.imul(h ^ key.charCodeAt(i), 0x85ebca6b); h ^= h >>> 13; } h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; }
function rngStep(o, k) { let t = (o[k] = (o[k] + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function newSeed() { return (RND0() * 4294967296) >>> 0; }
function R() {
  if (!RUN || RUN.seed == null) return RND0();
  if (B && !B.over && B.rng != null) return rngStep(B, 'rng');
  if (!RUN.rngPin) { const key = RUN.act + ':' + RUN.pos; if (RUN.rngAt !== key) { RUN.rngAt = key; RUN.rng = seedHash(RUN.seed, key); } }
  return rngStep(RUN, 'rng');
}
// run fn on its own run stream (e.g. 'map:1'), then put the room's stream back as it was
function rngWith(key, fn) {
  if (!RUN || RUN.seed == null) return fn();
  const s = [RUN.rngAt, RUN.rng, RUN.rngPin]; RUN.rngAt = key; RUN.rng = seedHash(RUN.seed, key); RUN.rngPin = 1;
  try { return fn(); } finally { [RUN.rngAt, RUN.rng, RUN.rngPin] = s; }
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const pick = a => a[(R() * a.length) | 0];
const d20 = () => 1 + (R() * 20 | 0);
const ri = (a, b) => a + ((R() * (b - a + 1)) | 0);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const $ = id => document.getElementById(id);
var G = { time: 0 };
function txt(c, s, x, y, font, col, align = 'left', base = 'alphabetic') { c.font = font; c.fillStyle = col; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const F_HUD = s => `${s}px "Jersey 10", "Courier New", monospace`;
const F_DSP = s => `700 ${s}px "Grenze Gotisch", Georgia, serif`;
const F_TXT = (s, w = 700) => `${w} ${s}px "Alegreya Sans", system-ui, sans-serif`;
const INK = '#17100e';
