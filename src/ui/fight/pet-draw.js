/* Pets on the field (issue #104): your pet in front of your team, and a rival club's pet in front of theirs, facing each
   other like two mascots. Drawn in the arena's ink style from a few parts a kind (PET_LOOK: its body, ears, wings, beak,
   horns, tail and colours), bobbing when idle, hopping when it acts (A.ent.pet / A.ent.foepet .act, set by the 'pet' fx),
   and trembling when spooked. The canvas state is wrapped in save()/restore(). */
const PET_INK = '#1d140f';
const PET_LOOK = {
  blinkpup: { body: 'dog', col: '#c9b8f0', ears: 'pointy', tail: 'wag', glow: '#d8c8ff' },
  pseudodragon: { body: 'drake', col: '#b5523a', wings: 'bat', horns: 1, tail: 'sting' },
  axebeak: { body: 'bird', col: '#d8b860', beak: 'axe', legs: 'long' },
  hootling: { body: 'bear', col: '#8a6a42', ears: 'round', beak: 'owl', face: '#e8d8b0' },
  sprite: { body: 'jar', col: '#bfe8a0', wings: 'fly', glow: '#c8ff9a' },
  bogfrog: { body: 'frog', col: '#5d8a3a', belly: '#d8e8a0' },
  chestnut: { body: 'chest', col: '#8a5a2a', teeth: 1 },
  jellycube: { body: 'cube', col: 'rgba(120,210,200,.55)' },
  hippogriff: { body: 'bird', col: '#d8d0c0', wings: 'feather', beak: 'hook', back: '#8a6a42' },
  glowbeetle: { body: 'beetle', col: '#5a2a1a', glow: '#ffb35a' },
  rustnibbler: { body: 'bug', col: '#c96a3a', antennae: 1 },
  imp: { body: 'imp', col: '#c94a3a', horns: 1, wings: 'bat', tail: 'sting' },
  frostpup: { body: 'dog', col: '#e8f2f6', ears: 'pointy', tail: 'bush', glow: '#bfe8ff' },
  mephitling: { body: 'imp', col: '#9ad0ec', wings: 'bat', glow: '#cfeaf4' },
  cockatrice: { body: 'bird', col: '#e8e0cc', beak: 'hook', comb: '#c94a3a', tail: 'snake' },
  // the rival clubs' own
  wyvern: { body: 'drake', col: '#6a8a3a', wings: 'bat', tail: 'sting', big: 1 },
  wisp: { body: 'orb', col: 'rgba(216,200,255,.7)', glow: '#d8c8ff' },
  shrieker: { body: 'shroom', col: '#9a6aa8' },
  basilisk: { body: 'lizard', col: '#7a8a6a', big: 1 },
  remorhaz: { body: 'grub', col: '#d8c0a0', glow: '#ff8a3c' },
  darkmantle: { body: 'mantle', col: '#3a3440' },
  claw: { body: 'claw', col: '#e8e0d0' },
  griffon: { body: 'bird', col: '#c9a040', wings: 'feather', beak: 'hook', back: '#8a5a2a', big: 1 },
};
const petPath = (c, f) => { c.beginPath(); f(); };
function petInk(c, fill, w) { c.fillStyle = fill; c.fill(); c.lineWidth = w || 2.2; c.strokeStyle = PET_INK; c.stroke(); }
function petEll(c, x, y, rx, ry, fill, w) { petPath(c, () => c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)); petInk(c, fill, w); }
function petEyes(c, x, y, gap, r, look) {
  for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * gap, y, r, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = PET_INK; c.stroke();
    c.beginPath(); c.arc(x + s * gap + (look || 0), y + .5, r * .55, 0, Math.PI * 2); c.fillStyle = PET_INK; c.fill(); }
}
// one pet, standing at (x, y) on the ground, about s tall, at time t
function drawPetFig(c, kind, x, y, t, o = {}) {
  const L = PET_LOOK[kind]; if (!L) return;
  const s = (o.size || 46) * (L.big ? 1.2 : 1) / 46, act = o.act != null && o.act < .5 ? Math.sin(o.act / .5 * Math.PI) : 0;
  const bob = Math.sin(t * 3.2 + (o.flip ? 1.7 : 0)) * 1.6, hop = act * 16, shake = o.spooked ? Math.sin(t * 40) * 1.4 : 0;
  c.save();
  // (its shadow, flat on the ground)
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, y + 2, 22 * s, 6 * s, 0, 0, Math.PI * 2); c.fill();
  c.translate(x + shake, y - hop - bob); c.scale(o.flip ? -s : s, s);
  if (L.glow) { const g = c.createRadialGradient(0, -20, 2, 0, -20, 34); g.addColorStop(0, L.glow + '66'); g.addColorStop(1, L.glow + '00'); c.fillStyle = g; c.fillRect(-36, -56, 72, 72); }
  if (o.foe) { c.setLineDash([3, 2]); }
  const B0 = L.body, col = L.col;
  // wings and tails behind the body
  if (L.wings === 'bat') for (const k of [-1, 1]) { petPath(c, () => { c.moveTo(k * 6, -26); c.quadraticCurveTo(k * 26, -44, k * 24, -20); c.quadraticCurveTo(k * 16, -24, k * 8, -16); c.closePath(); }); petInk(c, col, 1.8); }
  if (L.wings === 'feather') for (const k of [-1, 1]) { petPath(c, () => { c.moveTo(k * 4, -24); c.quadraticCurveTo(k * 24, -38, k * 22, -14); c.lineTo(k * 6, -14); c.closePath(); }); petInk(c, L.back || col, 1.8); }
  if (L.wings === 'fly') for (const k of [-1, 1]) { c.save(); c.globalAlpha = .6 + .3 * Math.sin(t * 30); petEll(c, k * 14, -34, 8, 12, '#e8fff0', 1.2); c.restore(); }
  if (L.tail === 'wag' || L.tail === 'bush') { const w = Math.sin(t * 9) * 5; petPath(c, () => { c.moveTo(-14, -14); c.quadraticCurveTo(-26, -22 + w, -24, -32 + w); }); c.lineWidth = L.tail === 'bush' ? 7 : 4; c.strokeStyle = PET_INK; c.stroke(); c.lineWidth = L.tail === 'bush' ? 4.5 : 2; c.strokeStyle = col; c.stroke(); }
  if (L.tail === 'sting' || L.tail === 'snake') { petPath(c, () => { c.moveTo(-12, -10); c.quadraticCurveTo(-28, -6, -30, -20); }); c.lineWidth = 4; c.strokeStyle = PET_INK; c.stroke(); c.lineWidth = 2; c.strokeStyle = L.tail === 'snake' ? '#5d8a3a' : col; c.stroke(); petPath(c, () => { c.moveTo(-30, -20); c.lineTo(-34, -26); c.lineTo(-26, -24); c.closePath(); }); petInk(c, PET_INK, 1); }
  // the body
  if (B0 === 'dog' || B0 === 'bear') {
    for (const k of [-8, 8]) { petPath(c, () => c.rect(k - 3, -10, 6, 10)); petInk(c, col, 1.6); }
    petEll(c, 0, -16, 16, 11, col); petEll(c, 10, -28, 11, 10, L.face && B0 === 'bear' ? col : col);
    if (L.ears === 'pointy') for (const k of [4, 15]) { petPath(c, () => { c.moveTo(k - 4, -34); c.lineTo(k, -46); c.lineTo(k + 4, -34); c.closePath(); }); petInk(c, col, 1.6); }
    if (L.ears === 'round') for (const k of [3, 17]) petEll(c, k, -37, 4, 4, col, 1.6);
    if (L.face) petEll(c, 12, -26, 7, 6, L.face, 1.2);
    petEyes(c, 11, -30, 4, 2.4, 1);
    if (L.beak === 'owl') { petPath(c, () => { c.moveTo(11, -26); c.lineTo(14, -23); c.lineTo(11, -21); c.closePath(); }); petInk(c, '#e0b84a', 1); }
    else { c.beginPath(); c.arc(19, -27, 1.6, 0, Math.PI * 2); c.fillStyle = PET_INK; c.fill(); }
  } else if (B0 === 'bird') {
    for (const k of [-5, 5]) { petPath(c, () => { c.moveTo(k, -12); c.lineTo(k, L.legs === 'long' ? 0 : -2); }); c.lineWidth = 2.4; c.strokeStyle = '#c98a3a'; c.stroke(); }
    petEll(c, 0, -22, 14, 13, col); petEll(c, 8, -38, 9, 9, col);
    if (L.comb) petEll(c, 6, -48, 4, 3, L.comb, 1.2);
    petPath(c, () => { if (L.beak === 'axe') { c.moveTo(15, -42); c.lineTo(28, -38); c.lineTo(15, -32); } else { c.moveTo(15, -40); c.quadraticCurveTo(24, -38, 19, -32); c.lineTo(15, -34); } c.closePath(); }); petInk(c, '#e0b84a', 1.6);
    petEyes(c, 9, -40, 0.01, 2.6, 1);
  } else if (B0 === 'drake' || B0 === 'imp' || B0 === 'lizard') {
    const lz = B0 === 'lizard';
    for (const k of [-7, 7]) { petPath(c, () => c.rect(k - 3, -9, 6, 9)); petInk(c, col, 1.6); }
    petEll(c, 0, -17, lz ? 20 : 12, lz ? 9 : 12, col); petEll(c, lz ? 18 : 7, lz ? -24 : -33, lz ? 10 : 9, lz ? 7 : 9, col);
    if (L.horns) for (const k of [3, 11]) { petPath(c, () => { c.moveTo(k - 2, -40); c.lineTo(k - 1, -48); c.lineTo(k + 2, -40); c.closePath(); }); petInk(c, '#f2e6c8', 1.2); }
    petEyes(c, lz ? 19 : 8, lz ? -26 : -35, 3.4, lz ? 2.8 : 2.2, 1);
    if (lz) { c.save(); c.globalAlpha = .5 + .3 * Math.sin(t * 2); petEyes(c, 19, -26, 3.4, 2.8, 1); c.restore(); }
  } else if (B0 === 'jar') {
    petPath(c, () => c.rect(-11, -34, 22, 32)); petInk(c, 'rgba(220,240,230,.55)', 2);
    petPath(c, () => c.rect(-13, -38, 26, 5)); petInk(c, '#8a6a42', 1.6);
    petEll(c, 0, -20, 6, 7, col, 1.4); petEyes(c, 0, -21, 2.4, 1.4, 0);
  } else if (B0 === 'frog') {
    petEll(c, 0, -12, 18, 11, col); petEll(c, 0, -9, 11, 6, L.belly, 1.2);
    for (const k of [-8, 8]) petEll(c, k, -22, 5, 5, col, 1.6); petEyes(c, 0, -22, 8, 2.6, 0);
    petPath(c, () => { c.moveTo(-8, -14); c.quadraticCurveTo(0, -10, 8, -14); }); c.lineWidth = 1.4; c.strokeStyle = PET_INK; c.stroke();
  } else if (B0 === 'chest') {
    const open = 4 + Math.max(0, Math.sin(t * 2.2)) * 5 + act * 8;
    petPath(c, () => c.rect(-17, -18, 34, 18)); petInk(c, col);
    c.save(); c.translate(-17, -18); c.rotate(-open * .04); petPath(c, () => c.rect(0, -12, 34, 12)); petInk(c, '#a06a32'); c.restore();
    c.fillStyle = '#fff'; for (let i = -12; i <= 12; i += 6) { c.beginPath(); c.moveTo(i, -18); c.lineTo(i + 3, -13); c.lineTo(i + 6, -18); c.fill(); }
    petEyes(c, 0, -26 - open * .6, 5, 2.2, 1); petPath(c, () => c.rect(-3, -12, 6, 5)); petInk(c, '#e0b84a', 1);
  } else if (B0 === 'cube') {
    const w = 1 + Math.sin(t * 4) * .05;
    c.save(); c.scale(w, 2 - w); petPath(c, () => c.rect(-17, -32, 34, 32)); petInk(c, col); c.restore();
    c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(-12, -27, 6, 4); petPath(c, () => c.rect(-6, -18, 6, 6)); petInk(c, '#e0b84a', 1);
    petEyes(c, 0, -22, 6, 2.4, 1);
  } else if (B0 === 'beetle' || B0 === 'bug') {
    for (const k of [-10, -2, 6]) { petPath(c, () => { c.moveTo(k, -8); c.lineTo(k - 3, 0); }); c.lineWidth = 2; c.strokeStyle = PET_INK; c.stroke(); }
    petEll(c, 0, -14, 17, 11, col); if (B0 === 'beetle') { petPath(c, () => { c.moveTo(0, -25); c.lineTo(0, -4); }); c.lineWidth = 1.4; c.strokeStyle = PET_INK; c.stroke(); c.save(); c.globalAlpha = .6 + .3 * Math.sin(t * 3); petEll(c, -11, -14, 6, 5, L.glow, 1); c.restore(); }
    petEll(c, 15, -16, 7, 6, col, 1.6); petEyes(c, 16, -18, 2.6, 1.8, 1);
    if (L.antennae) for (const k of [-1, 1]) { petPath(c, () => { c.moveTo(18, -21); c.quadraticCurveTo(24 + k * 2, -34, 28 + k * 3, -32); }); c.lineWidth = 1.6; c.strokeStyle = PET_INK; c.stroke(); petEll(c, 28 + k * 3, -32, 2, 2, '#e8a060', 1); }
  } else if (B0 === 'orb') {
    const r = 12 + Math.sin(t * 5) * 1.5; petEll(c, 0, -30, r, r, col, 1.4); petEyes(c, 0, -31, 4, 2, 0);
  } else if (B0 === 'shroom') {
    petPath(c, () => c.rect(-5, -16, 10, 16)); petInk(c, '#e8dcc0', 1.6);
    petEll(c, 0, -20, 18, 9, col); c.fillStyle = '#f2e6c8'; for (const [a, b] of [[-8, -22], [4, -24], [9, -19]]) { c.beginPath(); c.arc(a, b, 1.8, 0, 7); c.fill(); }
    petEyes(c, 0, -9, 2.6, 1.6, 0); if (act || Math.sin(t * 1.3) > .95) { c.beginPath(); c.ellipse(0, -4, 3, 2.4, 0, 0, 7); c.fillStyle = PET_INK; c.fill(); }
  } else if (B0 === 'grub') {
    for (let i = 0; i < 4; i++) petEll(c, -15 + i * 9, -9 - (i === 3 ? 3 : 0), 7, 7 - i * .3, i === 3 ? col : col, 1.6);
    c.save(); c.globalAlpha = .5 + .3 * Math.sin(t * 4); c.fillStyle = L.glow; for (let i = 0; i < 3; i++) c.fillRect(-17 + i * 9, -15, 4, 2); c.restore();
    petEyes(c, 13, -13, 2.4, 1.6, 1);
  } else if (B0 === 'mantle') {
    petPath(c, () => { c.moveTo(-18, -4); c.quadraticCurveTo(0, -40, 18, -4); for (let i = 18; i >= -18; i -= 6) c.lineTo(i - 3, -1 - (i % 12 ? 0 : 3)); c.closePath(); }); petInk(c, col);
    petEyes(c, 0, -20, 5, 2, 0);
  } else if (B0 === 'claw') {
    petEll(c, 0, -8, 11, 7, col, 1.8);
    for (let i = 0; i < 4; i++) { const a = -2.4 + i * .5 + Math.sin(t * 6 + i) * .08; petPath(c, () => { c.moveTo(Math.cos(a) * 8, -8 + Math.sin(a) * 5); c.lineTo(Math.cos(a) * 18, -8 + Math.sin(a) * 14); }); c.lineWidth = 5; c.strokeStyle = PET_INK; c.stroke(); c.lineWidth = 3; c.strokeStyle = col; c.stroke(); }
    petEyes(c, 0, -10, 3, 1.6, 0);
  }
  c.restore();
}
