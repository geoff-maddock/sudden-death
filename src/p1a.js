/* ================= Sudden Death — a Brimstone League dungeon card battler ================= */
/* p1: utilities and the league's creature renderer (shared with Brimstone Diamond and Black Ice) */
const R = Math.random;
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
