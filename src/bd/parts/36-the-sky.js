/* ================= The sky: moon phases and constellations (rule: "Moon and stars") ================= */
// The moon turns a phase every 9 at-bats; the constellation overhead changes every 15.
// Each creature has a phase: in it, +1 to its two best-loved stats (werewolves +2 POW at the full moon);
// at the opposite phase, -1 to the first. A few spells are stronger in their phase, and some items only wake
// under theirs. Constellations nudge one part of the game by a few percent.
RULE_DEFS.push({ k: 'sky', label: 'Moon and stars', opts: [[true, 'On'], [false, 'Off']], def: true, help: 'The moon changes phase every 9 at-bats and the constellations every 15. Each creature is a little stronger in its phase and a little weaker in the opposite one; the constellation overhead nudges one part of the game. Off: a plain full moon.' });

var MOON = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
var MOON_AB = 9, STAR_AB = 15;
// creature -> [phase, stats boosted in phase (first one also drops at the opposite phase)]
var MOON_KIND = {
  goblin: [0, ['spd', 'con']], kobold: [0, ['arm', 'spd']], zombie: [0, ['pow', 'con']],
  elf: [1, ['con', 'fld']], harpy: [1, ['spd', 'arm']],
  dwarf: [2, ['pow', 'fld']], golem: [2, ['arm', 'fld']],
  ogre: [3, ['pow', 'arm']], minotaur: [3, ['pow', 'spd']], troll: [3, ['pow', 'fld']],
  werewolf: [4, ['pow', 'spd']], witch: [4, ['arm', 'con']],
  vampire: [5, ['con', 'spd']], gorgon: [5, ['arm', 'con']],
  lich: [6, ['arm', 'con']], skeleton: [6, ['spd', 'fld']],
  wraith: [7, ['spd', 'con']], spider: [7, ['fld', 'con']],
};
// spells that run 25% stronger in their phase
var MOON_SPELL = { shadowstep: 0, glide: 1, bullrush: 3, pact: 4, mesmer: 5, haunt: 6, invis: 7 };
// constellations: each nudges one thing a few percent (zone keys the game already reads)
var STARS_C = [
  { name: 'The Hound', say: 'runners 3% faster', mod: { rSpd: 1.03 }, pts: [[0, 30], [18, 22], [34, 26], [52, 14], [70, 18], [58, 34], [40, 40]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 6], [6, 5]] },
  { name: 'The Anvil', say: 'fly balls carry 3% less', mod: { carry: .97 }, pts: [[0, 10], [70, 10], [60, 24], [44, 26], [44, 40], [26, 40], [26, 26], [10, 24]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]] },
  { name: 'The Serpent', say: 'swings reach 3% farther', mod: { swing: 1.03 }, pts: [[0, 36], [14, 20], [28, 30], [42, 16], [56, 26], [70, 10]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]] },
  { name: 'The Broken Crown', say: 'fielders bobble 12% more', mod: { bobble: 1.12 }, pts: [[0, 36], [0, 14], [18, 26], [35, 8], [52, 26], [70, 14], [70, 36]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]] },
  { name: 'The Widow', say: 'fielders move 3% slower', mod: { fSpd: .97 }, pts: [[35, 22], [14, 6], [56, 6], [8, 34], [62, 34], [35, 40]], lines: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]] },
  { name: 'The Cauldron', say: 'every spell 5% stronger', mod: { spell: 1.05 }, pts: [[10, 14], [60, 14], [66, 30], [50, 42], [20, 42], [4, 30], [35, 2]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 1]] },
];
// moon items for the season market, and a moon bat for the Armory
ITEMS.moonstone = { name: 'Moonstone Pendant', price: 35, desc: '+2 CON and +1 FLD while the moon is full.', lunar: { phase: 4, mod: { con: 2, fld: 1 } } };
ITEMS.nightshard = { name: 'Nightshard Ring', price: 35, desc: '+2 SPD and +1 ARM under the new moon.', lunar: { phase: 0, mod: { spd: 2, arm: 1 } } };
ITEMS.sickle = { name: 'Silver Sickle Charm', price: 40, desc: '+2 POW under either crescent moon.', lunar: { phase: [1, 7], mod: { pow: 2 } } };
if (typeof GEAR !== 'undefined' && GEAR) GEAR.moonsilver = { name: 'Moonsilver Bat', type: 'bat', price: 45, uses: 3, desc: 'Power +15%, or +45% under the full moon.', pw: 1.15, moonPw: 1.45 };

function skyOn() { return !!rule('sky'); }
function moonIdx() { return ((G.moon0 || 0) + Math.floor((G.abN || 0) / MOON_AB)) % 8; }
function starIdx() { return ((G.star0 || 0) + Math.floor((G.abN || 0) / STAR_AB)) % STARS_C.length; }
function inPhase(ph) { const m = moonIdx(); return Array.isArray(ph) ? ph.includes(m) : ph === m; }
// multipliers the game reads through zoneMult / carryK, and spell power through abPow
function skyMod(key) { if (!G.teams || !skyOn()) return 1; const c = STARS_C[starIdx()]; return (c && c.mod[key]) || 1; }
function moonSpell(id) { if (!G.teams || !skyOn()) return 1; let m = skyMod('spell'); if (MOON_SPELL[id] != null && MOON_SPELL[id] === moonIdx()) m *= 1.25; return m; }
function moonTag(p) { const k = MOON_KIND[p.kind]; return k ? MOON[k[0]] : ''; }

// stat changes from the moon, on the in-game copies of the players (reverted and re-applied at each phase)
function skyDelta(p) {
  const d = {}; if (!skyOn()) return d;
  const k = MOON_KIND[p.kind], m = moonIdx();
  if (k) {
    if (k[0] === m) { for (const s of k[1]) d[s] = (d[s] || 0) + 1; if (p.kind === 'werewolf' && m === 4) d.pow = (d.pow || 0) + 1; }
    else if ((k[0] + 4) % 8 === m) d[k[1][0]] = (d[k[1][0]] || 0) - 1;
  }
  const it = p.item && ITEMS[p.item]; if (it && it.lunar && inPhase(it.lunar.phase)) for (const s in it.lunar.mod) d[s] = (d[s] || 0) + it.lunar.mod[s];
  return d;
}
function skyApply() {
  if (!G.teams) return;
  for (const t of G.teams) for (const p of [...t.def.roster, ...t.pen, ...t.used]) {
    if (!p) continue;
    if (p.skyB) for (const s in p.skyB) p[s] -= p.skyB[s];
    const d = skyDelta(p); for (const s in d) p[s] += d[s];
    p.skyB = Object.keys(d).length ? d : null;
  }
}
// at every at-bat: count it, and announce a new phase or constellation
function skyTick() {
  if (!G.teams) return;
  const was = [moonIdx(), starIdx()];
  G.abN = (G.abN || 0) + 1;
  const now = [moonIdx(), starIdx()];
  if (!skyOn()) return;
  if (now[0] !== was[0]) {
    skyApply();
    const PL_ = { werewolf: 'werewolves', dwarf: 'dwarves', elf: 'elves', harpy: 'harpies', witch: 'witches' };
    const kinds = Object.entries(MOON_KIND).filter(([k, v]) => v[0] === now[0]).map(([k]) => PL_[k] || k + 's');
    const here = G.teams.flatMap(t => t.def.roster).filter(p => MOON_KIND[p.kind] && MOON_KIND[p.kind][0] === now[0]).map(p => shortName(p));
    logLine(`The moon turns: ${MOON[now[0]]}. ${kinds.join(', ')} grow stronger${here.length ? ` (${here.slice(0, 4).join(', ')})` : ''}.`);
    addFx('callout', { text: MOON[now[0]], col: '#f6e7c8', small: true });
  }
  if (now[1] !== was[1]) { const c = STARS_C[now[1]]; logLine(`${c.name} rises: ${c.say}.`); }
}
// a new game: where the sky starts (a season carries on from the last game)
function skyStart() {
  G.abN = 0;
  if (G.season && S) { const n = S.skyAB || 0; G.moon0 = (Math.floor(n / MOON_AB)) % 8; G.star0 = Math.floor(n / STAR_AB) % STARS_C.length; }
  else { G.moon0 = R() * 8 | 0; G.star0 = R() * STARS_C.length | 0; }
  skyApply();
}
function skyEnd() { if (G.season && S && G.teams) { S.skyAB = (S.skyAB || 0) + (G.abN || 0); } }

/* ---------- drawing: the moon's phase over the painted moon, and the constellation ---------- */
function drawSky(c) {
  if (!G.teams || !skyOn()) return;
  const m = moonIdx(), x = 640, y = 64, r = 24.6;
  if (m !== 4) {
    // shadow = the unlit part; lit fraction from the phase
    const k = Math.cos(m / 8 * Math.PI * 2); // 1 new, -1 full
    c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(7,10,16,.93)';
    c.beginPath();
    const waxing = m < 4, rx = Math.max(.01, Math.abs(k) * (r + 1)), crescent = k > 0, R1 = r + 1, H = Math.PI / 2;
    // the dark half-disc, then back along the terminator (bulging into the lit side for a crescent)
    if (m === 0) { c.arc(x, y, R1, 0, Math.PI * 2); }
    else if (waxing) { c.arc(x, y, R1, -H, H, true); if (crescent) c.ellipse(x, y, rx, R1, 0, H, -H, true); else c.ellipse(x, y, rx, R1, 0, H, 3 * H, false); }
    else { c.arc(x, y, R1, -H, H, false); if (crescent) c.ellipse(x, y, rx, R1, 0, H, 3 * H, false); else c.ellipse(x, y, rx, R1, 0, H, -H, true); }
    c.fill();
    if (m === 0) { c.strokeStyle = 'rgba(240,181,138,.25)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, r - 1, 0, Math.PI * 2); c.stroke(); }
    c.restore();
  }
  // constellation, upper middle
  const C = STARS_C[starIdx()], ox = 318, oy = 20;
  c.save(); c.strokeStyle = 'rgba(190,210,255,.28)'; c.lineWidth = 1;
  for (const [a, b] of C.lines) { c.beginPath(); c.moveTo(ox + C.pts[a][0], oy + C.pts[a][1]); c.lineTo(ox + C.pts[b][0], oy + C.pts[b][1]); c.stroke(); }
  for (const [px, py] of C.pts) { circ(c, ox + px, oy + py, 2.2, 'rgba(230,238,255,.95)'); circ(c, ox + px, oy + py, 4.5, 'rgba(200,215,255,.12)'); }
  c.restore();
  txt(c, `${MOON[m].toUpperCase()} · ${C.name.toUpperCase()}`, ox + 35, oy + 60, F_HUD(14), 'rgba(236,228,205,.55)', 'center');
}
