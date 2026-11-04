/* The Anvil Ring: utilities (issue #23). Copied from Cinder Gridiron's (src/gf/parts/01-util.js) and adapted, not
   shared. R is the engine's random number: Math.random, or seeded (bxSeed) so a headless bout can be boxed again
   exactly. */
let bxRand = Math.random;
function bxSeed(n) {
  if (n == null) { bxRand = Math.random; return; }
  let a = n >>> 0;
  bxRand = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const R = () => bxRand();
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;
const pick = a => a[(R() * a.length) | 0];
// a weighted pick: { key: weight }
function wpick(w) { let s = 0; for (const k in w) s += Math.max(0, w[k]); let r = R() * s; for (const k in w) { r -= Math.max(0, w[k]); if (r <= 0) return k; } return Object.keys(w)[0]; }
function gauss() { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function txt(c, s, x, y, font, col, align = 'left', base = 'alphabetic') { c.font = font; c.fillStyle = col; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
