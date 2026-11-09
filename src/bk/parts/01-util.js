/* The Charter Court: utilities (issue #77). R is the engine's random number: Math.random, or seeded (bkSeed) so a
   headless game can be played again exactly. */
let bkRand = Math.random;
function bkSeed(n) {
  if (n == null) { bkRand = Math.random; return; }
  let a = n >>> 0;
  bkRand = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const R = () => bkRand();
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;
// (seeded, as everything here is: a name the page also has would otherwise be its own, unseeded one)
const pick = a => a[(R() * a.length) | 0];
// a weighted pick: { key: weight }
function wpick(w) { let s = 0; for (const k in w) s += Math.max(0, w[k]); let r = R() * s; for (const k in w) { r -= Math.max(0, w[k]); if (r <= 0) return k; } return Object.keys(w)[0]; }
function txt(c, s, x, y, font, col, align = 'left', base = 'alphabetic') { c.font = font; c.fillStyle = col; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y); }
