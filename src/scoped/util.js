/* Utilities for the scoped engines (issue #86): boxing (src/bx), football (src/gf), basketball (src/bk), hockey
   (src/hk) and golf (src/gl, issue #92; engRng seeds its course) each load this inside their own scope, so each has its own random stream. R is the engine's random
   number: Math.random, or seeded (engSeed(n); engSeed(null) goes back) so a headless game can be played again exactly.
   pick is seeded too: the page has a name like it, and that one would be its own, unseeded. It names no engine. */
let engRand = Math.random;
// a seeded stream of its own (mulberry32): the engine's R when seeded, and any stream that must not touch R
function engRng(n) {
  let a = n >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function engSeed(n) {
  if (n == null) { engRand = Math.random; return; }
  engRand = engRng(n);
}
const R = () => engRand();
// is seat i in the stands taken? G.crowd (0 to 1, a start option; 1 when it isn't given) is how full they are. Drawing only
const engSeat = i => typeof G === 'undefined' || !G || G.crowd == null || ((Math.imul(Math.round(i) + 7, 2654435761) >>> 0) % 1000) / 1000 < G.crowd;
const engCrowd = o => o && o.crowd != null ? Math.max(0, Math.min(1, +o.crowd || 0)) : 1;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;
const pick = a => a[(R() * a.length) | 0];
// a weighted pick: { key: weight }
function wpick(w) { let s = 0; for (const k in w) s += Math.max(0, w[k]); let r = R() * s; for (const k in w) { r -= Math.max(0, w[k]); if (r <= 0) return k; } return Object.keys(w)[0]; }
function gauss() { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function txt(c, s, x, y, font, col, align = 'left', base = 'alphabetic') { c.font = font; c.fillStyle = col; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
