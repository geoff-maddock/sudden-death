/* p6: the interface — icons, cards, the run bar and the map */

/* ---------- small SVG icon set (trophies, tonics, map nodes) ---------- */
const ICO = {
  skate: '<path d="M5 6h7l1 6h5a2 2 0 0 1 2 2v2H5z" fill="#4aa3ff" stroke="#21160f" stroke-width="1.5"/><path d="M3 19h18" stroke="#dfe8f0" stroke-width="2"/><path d="M6 16v3M18 16v3" stroke="#21160f" stroke-width="1.5"/>',
  chalice: '<path d="M6 4h12c0 6-3 9-6 9s-6-3-6-9z" fill="#c9a94a" stroke="#21160f" stroke-width="1.5"/><path d="M7.5 7h9c-.5 3-2.3 4.5-4.5 4.5S8 10 7.5 7z" fill="#c2264a"/><path d="M12 13v5M8 20h8" stroke="#21160f" stroke-width="2"/>',
  towel: '<path d="M5 5h14v4c-2 1-2 3 0 4v6H5v-6c2-1 2-3 0-4z" fill="#f2ead8" stroke="#21160f" stroke-width="1.5"/><path d="M5 8h14M5 16h14" stroke="#d8cfb4" stroke-width="2"/>',
  sled: '<path d="M3 16h15c2 0 3-1 3-3" fill="none" stroke="#21160f" stroke-width="2"/><rect x="6" y="9" width="10" height="5" rx="1" fill="#7ac23a" stroke="#21160f" stroke-width="1.5"/><circle cx="9" cy="7" r="2" fill="#8a8a8a" stroke="#21160f"/><circle cx="14" cy="7" r="2" fill="#8a8a8a" stroke="#21160f"/>',
  pack: '<rect x="4" y="7" width="16" height="12" rx="3" fill="#8fc2e8" stroke="#21160f" stroke-width="1.5"/><path d="M8 7V5h8v2" fill="none" stroke="#21160f" stroke-width="1.5"/><path d="M12 10v6M9 13h6" stroke="#fff" stroke-width="2"/>',
  lantern: '<path d="M8 6h8l1 3v8l-2 3H9l-2-3V9z" fill="#3fbf9f" stroke="#21160f" stroke-width="1.5"/><circle cx="12" cy="13" r="3" fill="#d9ff7a"/><path d="M10 6V3h4v3" fill="none" stroke="#21160f" stroke-width="1.5"/>',
  horn: '<path d="M3 15c6 0 10-6 15-9l2 2c-2 4-4 10-10 11-3 .5-6-1-7-4z" fill="#d2bcff" stroke="#21160f" stroke-width="1.5"/>',
  boot: '<path d="M7 3h6v10l6 3v4H5V13z" fill="#e3b23c" stroke="#21160f" stroke-width="1.5"/><path d="M5 18h14" stroke="#21160f" stroke-width="1.5"/>',
  fist: '<rect x="5" y="8" width="14" height="10" rx="3" fill="#8f9d58" stroke="#21160f" stroke-width="1.5"/><path d="M9 8v4M13 8v4M17 9v3" stroke="#21160f" stroke-width="1.2"/><rect x="6" y="17" width="12" height="4" fill="#6b4a2a" stroke="#21160f" stroke-width="1.2"/>',
  bracer: '<path d="M6 5h12l-1 14H7z" fill="#c9d0d6" stroke="#21160f" stroke-width="1.5"/><path d="M7 9h10M7 14h10" stroke="#6b4a2a" stroke-width="2"/>',
  bag: '<path d="M8 6c-4 3-5 13 4 14 9-1 8-11 4-14z" fill="#a0784a" stroke="#21160f" stroke-width="1.5"/><path d="M8 6h8M10 3l2 3 2-3" fill="none" stroke="#21160f" stroke-width="1.5"/>',
  ring: '<circle cx="12" cy="14" r="6" fill="none" stroke="#ffd166" stroke-width="3"/><path d="M9 6l3-3 3 3-3 3z" fill="#e0533a" stroke="#21160f"/>',
  gem: '<path d="M12 3l7 7-7 11-7-11z" fill="#9f7aff" stroke="#21160f" stroke-width="1.5"/><path d="M5 10h14M12 3v18" stroke="#d2bcff" stroke-width=".8"/>',
  finger: '<path d="M9 21V11H7V8h2V3h4v5h3v3h-1v10z" fill="#ffd166" stroke="#21160f" stroke-width="1.5"/>',
  cap: '<path d="M4 15c0-6 4-9 8-9s8 3 8 9z" fill="#e0533a" stroke="#21160f" stroke-width="1.5"/><path d="M12 15h10v2H12z" fill="#a8321e" stroke="#21160f"/>',
  whistle: '<circle cx="9" cy="14" r="5" fill="#c9d0d6" stroke="#21160f" stroke-width="1.5"/><path d="M12 10h9v4h-7" fill="#c9d0d6" stroke="#21160f" stroke-width="1.5"/>',
  mitt: '<path d="M5 13c0-7 4-10 8-10s6 3 6 7l-1 6c-1 3-4 5-7 5s-6-3-6-8z" fill="#b8763a" stroke="#21160f" stroke-width="1.5"/><path d="M8 11h8M8 15h8" stroke="#21160f" stroke-width="1"/>',
  belt: '<rect x="2" y="9" width="20" height="7" rx="2" fill="#6b4a2a" stroke="#21160f" stroke-width="1.5"/><rect x="6" y="6" width="3" height="7" fill="#ff6a6a" stroke="#21160f"/><rect x="11" y="6" width="3" height="7" fill="#7fd6ff" stroke="#21160f"/><rect x="16" y="6" width="3" height="7" fill="#7fe08a" stroke="#21160f"/>',
  ball: '<circle cx="12" cy="12" r="8" fill="#f2ead8" stroke="#21160f" stroke-width="1.5"/><path d="M7 6c2 3 2 9 0 12M17 6c-2 3-2 9 0 12" fill="none" stroke="#d83a3a" stroke-width="1.2"/>',
  tooth: '<path d="M6 4c3-2 9-2 12 0 1 5-2 7-2 12l-2 5-2-6-2 6-2-5c0-5-3-7-2-12z" fill="#f2ead8" stroke="#21160f" stroke-width="1.5"/>',
  cup: '<path d="M6 3h12v6c0 4-3 6-6 6s-6-2-6-6z" fill="#c9d0d6" stroke="#21160f" stroke-width="1.5"/><path d="M10 15h4v3h3v3H7v-3h3z" fill="#9aa4ac" stroke="#21160f" stroke-width="1.5"/>',
  jersey: '<path d="M8 3l-5 3 2 5 2-1v11h10V10l2 1 2-5-5-3c-1 2-3 2-4 2s-3 0-4-2z" fill="#d9573b" stroke="#21160f" stroke-width="1.5"/><text x="12" y="17" font-size="7" text-anchor="middle" fill="#fff" font-family="Jersey 10">13</text>',
  book: '<path d="M4 4h7c1 0 1 1 1 1v15c0-1-1-1-1-1H4zM20 4h-7c-1 0-1 1-1 1v15c0-1 1-1 1-1h7z" fill="#e9dcc0" stroke="#21160f" stroke-width="1.5"/><path d="M6 8l3 3M9 8l-3 3M15 9a2 2 0 1 0 .1 0" stroke="#a8321e" fill="none"/>',
  puck: '<ellipse cx="12" cy="14" rx="9" ry="4" fill="#1d1b1c" stroke="#ffd166" stroke-width="1.5"/><ellipse cx="12" cy="11" rx="9" ry="4" fill="#d8b64a" stroke="#21160f" stroke-width="1.2"/>',
};
const NODE_ICO = {
  fight: '<path d="M5 5l14 14M19 5L5 19" stroke="#efe4cc" stroke-width="3" stroke-linecap="round"/><circle cx="5" cy="5" r="2.2" fill="#efe4cc"/><circle cx="19" cy="5" r="2.2" fill="#efe4cc"/>',
  elite: '<path d="M5 9c0-5 14-5 14 0v5l-2 3H7l-2-3z" fill="#e0533a"/><path d="M5 8L2 2l6 4M19 8l3-6-6 4" fill="#e0533a"/><circle cx="9" cy="11" r="2" fill="#140f0c"/><circle cx="15" cy="11" r="2" fill="#140f0c"/><path d="M9 16h6" stroke="#140f0c" stroke-width="1.5"/>',
  rest: '<rect x="6" y="3" width="12" height="18" rx="1" fill="none" stroke="#8fc2e8" stroke-width="2"/><path d="M9 7h6M9 9h6M9 11h6" stroke="#8fc2e8" stroke-width="1.4"/><circle cx="15" cy="15" r="1.4" fill="#8fc2e8"/>',
  shop: '<path d="M4 10L12 3h8v8l-8 8z" fill="none" stroke="#ffb347" stroke-width="2"/><circle cx="16" cy="7" r="1.6" fill="#ffb347"/><text x="11" y="15" font-size="7" fill="#ffb347" font-family="Jersey 10">$</text>',
  rival: '<path d="M12 2c3 4 7 6 7 12a7 7 0 0 1-14 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4 1-6 2-9z" fill="#ff6a3d"/><path d="M12 11c2 2 3 3 3 5a3 3 0 0 1-6 0c0-2 2-3 3-5z" fill="#ffd166"/>',
  event: '<text x="12" y="19" font-size="20" text-anchor="middle" fill="#b494ff" font-family="Grenze Gotisch, Georgia, serif" font-weight="700">?</text>',
  chest: '<rect x="4" y="9" width="16" height="11" rx="1" fill="#a0784a" stroke="#ffd166" stroke-width="1.5"/><path d="M4 9c0-5 16-5 16 0" fill="#8a5630" stroke="#ffd166" stroke-width="1.5"/><rect x="10" y="11" width="4" height="4" fill="#ffd166"/>',
};
const NODE_NAME = { rival: 'Rivalry game', fight: 'Brawl', elite: 'Elite', rest: 'Locker room', shop: 'Pro shop', event: 'Unknown', chest: 'Treasure', boss: 'Boss' };
const svgI = (body, vb = 24) => `<svg viewBox="0 0 ${vb} ${vb}" aria-hidden="true">${body}</svg>`;
const flaskI = (col, empty) => `<svg viewBox="0 0 24 26" aria-hidden="true"><path d="M9 2h6v6l5 9c1 3-1 7-4 7H8c-3 0-5-4-4-7l5-9z" fill="${empty ? 'none' : 'rgba(255,255,255,.08)'}" stroke="${empty ? '#7f6d5a' : '#efe4cc'}" stroke-width="1.5"/>${empty ? '' : `<path d="M5.5 15h13l1 2c1 3-1 6-4 6H8c-3 0-4-3-3-6z" fill="${col}"/>`}</svg>`;
const relicI = id => svgI(ICO[RELICS[id].ico] || ICO.gem);

/* ---------- sport emblems for league playbook cards ---------- */
const EMB = {};
function emblemURL(sport, col) {
  const key = sport + col; if (EMB[key]) return EMB[key];
  const cv = document.createElement('canvas'); cv.width = 300; cv.height = 150; const c = cv.getContext('2d');
  const g = c.createRadialGradient(150, 70, 4, 150, 75, 170); g.addColorStop(0, tint(col, -.15)); g.addColorStop(1, '#0d0907'); c.fillStyle = g; c.fillRect(0, 0, 300, 150);
  c.globalAlpha = .1; c.fillStyle = '#fff'; for (let i = -2; i < 10; i++) { c.beginPath(); c.moveTo(i * 40, 150); c.lineTo(i * 40 + 18, 150); c.lineTo(i * 40 + 88, 0); c.lineTo(i * 40 + 70, 0); c.fill(); } c.globalAlpha = 1;
  c.translate(150, 78); LW = 3;
  const O = (p, f) => { c.fillStyle = f; c.fill(p); c.lineWidth = 4; c.strokeStyle = INK; c.stroke(p); };
  switch (sport) {
    case 'baseball': { O(pEl(0, 0, 46, 46), '#f2ead8'); c.strokeStyle = '#d83a3a'; c.lineWidth = 3; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 66, 0, 46, Math.PI - .9, Math.PI + .9); if (s < 0) { c.beginPath(); c.arc(-66, 0, 46, -.9, .9); } c.stroke(); for (let i = -3; i <= 3; i++) { const a = (s < 0 ? 0 : Math.PI) + i * .22, x = s * 66 + Math.cos(a) * 46 * (s < 0 ? 1 : 1), y = Math.sin(a) * 46; c.beginPath(); c.moveTo(x - 5, y - 2); c.lineTo(x + 5, y + 2); c.stroke(); } } break; }
    case 'football': { c.rotate(-.35); O(pEl(0, 0, 62, 36), '#8a4a22'); c.strokeStyle = '#f2ead8'; c.lineWidth = 4; c.beginPath(); c.moveTo(-26, 0); c.lineTo(26, 0); c.stroke(); for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 9, -7); c.lineTo(i * 9, 7); c.stroke(); } c.beginPath(); c.moveTo(-44, -22); c.lineTo(-44, 22); c.moveTo(44, -22); c.lineTo(44, 22); c.stroke(); break; }
    case 'hockey': { c.save(); c.rotate(.6); O(pRR(-8, -70, 12, 110, 4), '#d8c49a'); O(pRR(-8, 34, 46, 14, 6), '#1d1b1c'); c.restore(); O(pEl(0, 22, 40, 14), '#1d1b1c'); O(pEl(0, 12, 40, 14), '#2a2829'); break; }
    case 'basketball': { O(pEl(0, 0, 50, 50), '#e0742a'); c.strokeStyle = INK; c.lineWidth = 3.5; c.beginPath(); c.moveTo(-50, 0); c.lineTo(50, 0); c.moveTo(0, -50); c.lineTo(0, 50); c.stroke(); c.beginPath(); c.arc(-62, 0, 40, -.95, .95); c.stroke(); c.beginPath(); c.arc(62, 0, 40, Math.PI - .95, Math.PI + .95); c.stroke(); break; }
    case 'golf': { O(pRR(30, -60, 5, 110, 2), '#efe4cc'); O(pPoly([[35, -60], [80, -46], [35, -32]]), '#e0533a'); O(pEl(-30, 30, 22, 22), '#f8f4ea'); for (let i = 0; i < 8; i++) circ(c, -38 + (i % 3) * 8, 22 + ((i / 3) | 0) * 8, 2, '#c8c0b0'); O(pEl(-30, 56, 30, 6), '#2f6a2a'); break; }
    case 'bowling': { const pin = new Path2D(); pin.moveTo(0, -64); pin.bezierCurveTo(16, -64, 16, -36, 8, -28); pin.bezierCurveTo(28, -6, 26, 40, 14, 60); pin.lineTo(-14, 60); pin.bezierCurveTo(-26, 40, -28, -6, -8, -28); pin.bezierCurveTo(-16, -36, -16, -64, 0, -64); O(pin, '#f2ead8'); c.fillStyle = '#d83a3a'; c.fillRect(-11, -26, 22, 5); c.fillRect(-12, -18, 24, 5); circ(c, -4, -50, 3, INK); circ(c, 5, -50, 3, INK); break; }
    case 'jousting': { c.save(); c.rotate(-.5); O(pPoly([[-90, -4], [70, -12], [96, 0], [70, 12], [-90, 4]]), '#c9a24a'); c.restore(); O(pPoly([[-40, -40], [10, -40], [10, 0], [-15, 34], [-40, 0]]), '#3a5a9a'); c.strokeStyle = '#ffd166'; c.lineWidth = 4; c.beginPath(); c.moveTo(-15, -40); c.lineTo(-15, 30); c.moveTo(-40, -12); c.lineTo(10, -12); c.stroke(); break; }
    case 'curling': { O(pEl(0, 24, 54, 22), '#7a7a80'); O(pEl(0, 12, 54, 22), '#a8a8b0'); O(pRR(-6, -38, 12, 40, 4), '#d83a3a'); O(pRR(-6, -42, 40, 12, 5), '#d83a3a'); break; }
    case 'boxing': { const g2 = new Path2D(); g2.moveTo(-34, 30); g2.bezierCurveTo(-44, -10, -36, -52, 4, -52); g2.bezierCurveTo(40, -52, 50, -16, 40, 12); g2.bezierCurveTo(34, 30, 20, 34, 18, 34); g2.lineTo(-30, 34); g2.closePath(); O(g2, '#c2264a'); O(pRR(-32, 34, 52, 22, 5), '#f2ead8'); const th = new Path2D(); th.moveTo(-36, -2); th.bezierCurveTo(-58, -2, -58, 26, -30, 22); O(th, '#a81e3e'); break; }
    default: { O(pEl(0, 0, 40, 40), '#c9a24a'); }
  }
  return (EMB[key] = cv.toDataURL());
}
function junkURL() { if (EMB.junk) return EMB.junk; const cv = document.createElement('canvas'); cv.width = 300; cv.height = 150; const c = cv.getContext('2d'); c.fillStyle = '#3a3634'; c.fillRect(0, 0, 300, 150); c.strokeStyle = '#6b6560'; c.lineWidth = 8; c.beginPath(); c.moveTo(110, 35); c.lineTo(190, 115); c.moveTo(190, 35); c.lineTo(110, 115); c.stroke(); return (EMB.junk = cv.toDataURL()); }

/* ---------- card text ---------- */
const KW = /\b(Block|Weak|Exposed|Plague|Burn|Stun|Stunned|Strength|Footwork|Spikes|Regen|Exhaust|Stamina|Bedrock|Haunt|Kindling|Retain|Innate|Combo|Momentum|Home|Fatigue|Exert|Foul|Grows)\b/g;
const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function numSpan(v, base) { return v > base ? `<span class="hi">${v}</span>` : v < base ? `<span class="lo">${v}</span>` : `${v}`; }
const SELF_TXT = {
  str: n => `Gain ${n} Strength.`, dex: n => `Gain ${n} Footwork.`, ritual: n => `At the start of each turn, gain ${n} Strength.`, plate: n => `At the end of each turn, gain ${n} Block.`,
  barricade: () => 'Block no longer drains away between turns (Bedrock).', haunt: n => `Whenever you play a card, deal ${n} damage to a random enemy.`, kindle: n => `Burn you apply is increased by ${n}.`,
  nightgame: n => `Whenever an enemy falls, heal ${n}.`, trollblood: n => `At the start of each turn, heal ${n}.`, spin: n => `At the start of each turn, apply ${n} Weak to ALL enemies.`,
  tempest: n => `At the start of each turn, deal ${n} damage to a random enemy.`, necro: n => `At the start of each turn, apply ${n} Plague to ALL enemies.`, basilisk: n => `At the start of each turn, apply ${n} Exposed to a random enemy.`,
  coldsnap: n => `Whenever you play a Skill, gain ${n} Block.`, undying: () => 'The first time you would fall this fight, heal to 12 instead.', rage: n => `Whenever an attack hits you, gain ${n} Strength.`,
  drawnext: n => `Next turn, draw ${n} more.`, nrgnext: n => `Next turn, gain ${n} Stamina.`, oop: n => `Your next Attack this turn deals ${n} more damage.`, double: () => 'Your next card this turn is played twice.',
  intang: () => 'Until your next turn, every hit on you deals at most 1 damage.',
  pads: n => `Goalie Pads, ${n} charges: before an attack hits you, gain 5 Block.`, helmet: n => `Helmet, ${n} charges: each hit on you deals 3 less.`, shoulder: n => `Shoulder Pads, ${n} charges: when an attack hits you, deal 6 back.`,
  luckybat: n => `Lucky Bat, ${n} charges: your next Attacks deal 4 more per hit.`, cleats: n => `Cleats, ${n} charges: your next Skills give 4 more Block.`, sweat: n => `Sweatband, ${n} charges: draw 1 more each turn.`,
  called: () => 'Your next Attack this turn deals triple damage.', phyl: () => 'The first time you would fall this fight, heal to 30 instead.', pulled: () => 'Your next damaging Attack scores a goal (in hockey).', exert: n => `Exert ${n}.`, thorns: n => `Gain ${n} Spikes.`, regen: n => `Gain ${n} Regen.`, ward: n => `At the start of each turn, gain ${n} Block.`,
};
function opText(op, d, ctx) {
  const live = ctx && ctx.live, card = ctx && ctx.card, tg = ctx && ctx.tgt;
  const scope = op[0] === 's' ? (op[3] || (d.tgt === 'self' ? 'self' : d.tgt === 'all' ? 'all' : 'one')) : (op[3] || d.tgt);
  const dmgS = base => live ? numSpan(atkDmg(base, tg, card), base) : base;
  switch (op[0]) {
    case 'd': { const h = op[2] || 1, t = h > 1 ? ` ${h} times` : ''; return scope === 'all' ? `Deal ${dmgS(op[1])} damage to ALL enemies${t}.` : scope === 'rand' ? `Deal ${dmgS(op[1])} damage to a random enemy${t}.` : `Deal ${dmgS(op[1])} damage${t}.`; }
    case 'b': { const v = op[1] + (live ? sv(B.P, 'dex') + skyBlk(card) : 0); return `Gain ${live ? numSpan(v, op[1]) : op[1]} Block.`; }
    case 's': {
      if (scope === 'self') return (SELF_TXT[op[1]] || (n => `Gain ${n} ${ST[op[1]].n}.`))(op[2]);
      const nm = op[1] === 'stun' ? null : ST[op[1]].n;
      const extra = op[1] === 'burn' && live && sv(B.P, 'kindle') ? ` (+${sv(B.P, 'kindle')})` : '';
      if (op[1] === 'stun') return scope === 'all' ? 'Stun ALL enemies.' : 'Stun the target.';
      return scope === 'all' ? `Apply ${op[2]}${extra} ${nm} to ALL enemies.` : scope === 'rand' ? `Apply ${op[2]} ${nm} to a random enemy.` : `Apply ${op[2]}${extra} ${nm}.`;
    }
    case 'draw': return `Draw ${pl(op[1], 'card')}.`;
    case 'nrg': return `Gain ${op[1]} Stamina.`;
    case 'heal': return `Heal ${op[1]} HP.`;
    case 'lose': return `Lose ${op[1]} HP.`;
    case 'gold': return `gain ${op[1]} gold.`;
    case 'maxhp': return `raise your max HP by ${op[1]} for good.`;
    case 'roll': { const y = op[2].map(o => opText(o, d, ctx)).join(' '), n = op[3].map(o => opText(o, d, ctx)).join(' '); return `d20, ${op[1]}+${RUN && mod('d20') ? ` (+${mod('d20')})` : ''}. Hit: ${y}${n ? ` Miss: ${n}` : ''}`; }
    case 'kill': return `If this kills, ${op[1].map(o => opText(o, d, ctx)).join(' ')}`;
    case 'allkilled': return `If that clears the field, ${op[1].map(o => opText(o, d, ctx).replace(/^G/, 'g')).join(' ')}`;
    case 'ifst': return `If the target is ${ST[op[1]].n}: ${op[2].map(o => opText(o, d, ctx)).join(' ')} Otherwise: ${op[3].map(o => opText(o, d, ctx)).join(' ')}`;
    case 'add': return `Add ${op[2]} ${CARDS[op[1]].n}${op[2] > 1 ? 's' : ''} to your hand.`;
    case 'audible': return 'Discard your hand, then draw that many.';
    case 'devour': return `a non-boss enemy at ${op[1]} HP or less is eaten whole and you heal ${op[2]}; otherwise ${dmgS(16)} damage.`;
    case 'petrify': return `a non-boss enemy at ${Math.round(op[1] * 100)}% HP or less turns to stone; otherwise ${dmgS(18)} damage.`;
    case 'execute': return `A non-boss enemy dies outright; a boss takes ${dmgS(40)}.`;
    case 'bones': return `Gain ${op[1]} Block for each card in your draw pile${live ? ` (${Math.min(36, op[1] * B.draw.length)})` : ''}, up to 36.`;
    case 'bodyslam': return `Deal damage equal to your Block${live ? ` (${atkDmg(B.P.block - sv(B.P, 'str'), tg, card)})` : ''}.`;
    case 'drain': return `Deal ${dmgS(op[1])} damage. Heal what gets through.`;
    case 'dunk': return `Deal ${dmgS(op[1])} damage, or ${dmgS(op[2])} if the target is below half HP.`;
    case 'luck': return 'Your next d20 is a natural 20.';
    case 'loseblock': return 'Lose all your Block.';
    case 'strip': return 'Every enemy loses its Block and Strength.';
    case 'drainall': return `Deal ${dmgS(op[1])} damage to ALL enemies. Heal what gets through.`;
    case 'split': return `Deal ${dmgS(op[1])} damage to the enemies on each end.`;
    case 'petrifyall': return `Every non-boss enemy at ${Math.round(op[1] * 100)}% HP or less turns to stone; the rest take ${dmgS(op[2])}.`;
    case 'bonestorm': return `Deal ${op[1]} damage to ALL enemies for each card in your discard pile${live ? ` (${atkDmg(op[1] * B.discard.length, tg, card)})` : ''}.`;
    case 'freeatk': return 'Attacks cost 0 for the rest of the turn.';
    case 'runners': return 'Every runner on base scores.';
    case 'advance': return `Every runner moves up ${op[1]} base.`;
    case 'putOn': return 'Put a runner on first.';
    case 'yards': return `Gain ${op[1]} yards.`;
    case 'ifyards': return `Past midfield: touchdown. Otherwise gain ${op[3][0][1]} yards.`;
    case 'td': return 'Touchdown.';
    case 'atkcount': return 'Counts as an extra Attack toward On Fire.';
    case 'freestroke': return 'This turn does not count as a stroke.';
    case 'lance': return 'Shatters a lance: a point.';
  }
  return '';
}
function costList(d) {
  const c = [];
  if (d.toll) c.push(`${d.toll} HP`); if (d.disc) c.push(`discard ${d.disc}`); if (d.fatigue) c.push(`${d.fatigue} Fatigue`);
  if (d.exert) c.push(`Exert ${d.exert}`); if (d.foul) c.push(`Foul ${d.foul}`); if (d.goldc) c.push(`${d.goldc} gold`);
  return c.join(', ');
}
function cardText(card, ctx) {
  const d = def(card);
  if (d.type === 'junk' || d.type === 'curse') return d.fl || '';
  let t = d.fx.map(o => opText(o, d, ctx)).join(' ');
  if (d.pierce) t += ' Ignores Block.';
  if (d.grow) t += ` Grows ${d.grow} damage each time you play it this fight${ctx && ctx.live && B.grow[card.uid] ? ` (+${B.grow[card.uid]})` : ''}.`;
  if (d.combo) t += ` Combo, after ${d.combo.t === 'atk' ? 'an Attack' : 'a Skill'}: ${d.combo.fx.map(o => opText(o, d, ctx)).join(' ')}`;
  if (d.mom) t += ` Momentum ${d.mom.n}: ${d.mom.fx.map(o => opText(o, d, ctx)).join(' ')}`;
  if (d.home) t += ` Home, in ${SPORT_NAME[d.sport].toLowerCase()}: ${d.home.map(o => opText(o, d, ctx)).join(' ')}`;
  if (d.retain) t += ' Retain.';
  if (d.innate) t += ' Innate.';
  if (d.ex) t += ' Exhaust.';
  t = t.replace(KW, '<b>$1</b>');
  const costs = costList(d);
  return (costs ? `<span class="cl">Costs ${costs}.</span> ` : '') + t;
}
const TYPE_NAME = { atk: 'attack', skl: 'skill', pow: 'power', play: 'set play', gear: 'gear', junk: 'status', curse: 'curse' };
function cardArt(card) {
  const d = def(card);
  if (d.type === 'junk' || d.type === 'curse') return junkURL();
  const team = RUN ? clubTeam() : { color: '#8a6a4a', light: '#e8d8a8', short: 'BRM' };
  if (d.kind === 'any') return emblemURL(d.sport || 'baseball', team.color);
  const m = RUN && memberOf(d.kind);
  return portraitURL(d.kind, team, m ? m.num : '', 120);
}
function cardHTML(card, o = {}) {
  const d = def(card), cost = d.cost;
  const kindLabel = d.kind === 'any' ? 'League' : d.kind === 'none' ? '' : (KIND_NAME[d.kind] || d.kind);
  const ownName = RUN && d.kind === 'any' && card.own ? memberName(card.own) : '';
  const ty = d.type === 'junk' || d.type === 'curse' ? (d.type === 'curse' ? 'Curse' : 'Status') : `${kindLabel} ${TYPE_NAME[d.type]}${ownName ? `, ${ownName}` : ''}`;
  const lcost = o.live && B ? cardCost(card) : cost;
  const cheap = o.live && B && lcost >= 0 && lcost < CARDS[card.id].cost;
  const badge = o.live && B ? sportBadge(card, o.tgt) : '';
  const tl = cardText(card, {}).replace(/<[^>]+>/g, '').length;
  return `<div class="card ${d.type}${d.rar === 'l' ? ' leg' : ''}${tl > 120 ? ' vlong' : tl > 80 ? ' long' : ''}${card.up ? ' up' : ''}${o.cls ? ' ' + o.cls : ''}" data-uid="${card.uid || ''}" data-id="${card.id}" ${o.attrs || ''} role="button" tabindex="0" aria-label="${esc(d.n)}, ${RAR_NAME[d.rar] || ''} ${TYPE_NAME[d.type] || ''}, costs ${cost < 0 ? 'nothing, unplayable' : cost} Stamina. ${esc(cardText(card, {}).replace(/<[^>]+>/g, ''))}">
    ${o.key ? `<span class="key">${o.key}</span>` : ''}
    <div class="art" style="background-image:url(${cardArt(card)})">${cost >= 0 ? `<span class="cost${cheap ? ' cheap' : ''}">${lcost}</span>` : ''}${['u', 'r', 'l'].includes(d.rar) ? `<span class="rar ${d.rar}" title="${RAR_NAME[d.rar]}"></span>` : ''}${d.sport ? `<span class="sp${B && o.live && d.sport === B.sport ? ' home' : ''}">${SPORT_NAME[d.sport]}</span>` : ''}${badge ? `<span class="bd">${esc(badge)}</span>` : ''}${d.rar === 'l' ? '<span class="hof">Hall of Fame</span>' : ''}</div>
    <div class="nm">${card.sk ? '<span class="skstar" title="Practiced: better at every sport">★</span>' : ''}${esc(d.n)}</div><div class="ty">${esc(ty)}</div>
    <div class="tx">${cardText(card, o.live ? { live: true, card, tgt: o.tgt } : {})}</div>
    ${(() => { const f = sportFits(d); return f.length ? `<div class="fits" title="Good for: ${f.map(s => SPORT_NAME[s]).join(', ')}">${f.map(s => sportSVG(s, 13)).join('')}</div>` : ''; })()}
    ${o.flav !== false && d.fl && d.type !== 'junk' && d.type !== 'curse' ? `<div class="fl">${esc(d.fl)}</div>` : ''}
  </div>`;
}

/* ---------- tooltips ---------- */
const tipEl = () => $('tip');
function showTip(html, x, y) { const t = tipEl(); t.innerHTML = html; t.hidden = false; const w = t.offsetWidth, h = t.offsetHeight; t.style.left = clamp(x + 14, 6, innerWidth - w - 6) + 'px'; t.style.top = clamp(y + 14, 6, innerHeight - h - 6) + 'px'; }
function hideTip() { tipEl().hidden = true; }
document.addEventListener('mouseover', e => { const el = e.target.closest('[data-tip]'); if (el) { const r = el.getBoundingClientRect(); showTip(el.dataset.tip, r.left, r.bottom); } });
document.addEventListener('mouseout', e => { if (e.target.closest('[data-tip]')) hideTip(); });
document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) { const r = el.getBoundingClientRect(); showTip(el.dataset.tip, r.left, r.bottom); } });
document.addEventListener('focusout', e => { if (e.target.closest('[data-tip]')) hideTip(); });
const relicTip = id => esc(`<span class="t">${RELICS[id].n}</span>${RELICS[id].desc}`);
const tonicTip = id => esc(`<span class="t">${TONICS[id].n}</span>${TONICS[id].desc}`);

/* ---------- the run bar ---------- */
function renderRunBar() {
  if (!RUN) return;
  const T = clubTeam(), club = CLUBS[RUN.club];
  const inFight = B && !B.over && UI.view === 'fight';
  $('runbar').innerHTML = `
    <div class="party" style="--cc:${club.color}">${RUN.party.map(p => `<img src="${portraitURL(p.kind, T, p.num, 76)}" alt="${esc(p.n)}, ${KIND_NAME[p.kind]}" data-tip="${esc(`<span class="t">${p.n}</span>${KIND_NAME[p.kind]}, #${p.num}. ${p.flav}`)}" tabindex="0">`).join('')}</div>
    <div class="stat hp"><small>HP</small><b>${RUN.hp}/${RUN.maxhp}</b></div>
    <div class="stat gold"><small>Gold</small><b>${RUN.gold}</b></div>
    <div class="stat" title="Fans: earned by sports wins, spent at the pro shop’s fan stand"><small>Fans</small><b style="color:#d2a6ff">${RUN.fans || 0}</b></div>
    <div class="stat"><small>Act</small><b>${RUN.act + 1}</b><small>Floor</small><b>${RUN.floor + (RUN.pos ? 1 : 0)}</b></div>
    <div class="relics" style="--cc:${club.color}">${RUN.relics.map(id => `<button class="relic${RELICS[id].boss ? ' boss' : ''}${RELICS[id].club ? ' club' : ''}" data-tip="${relicTip(id)}" aria-label="${esc(RELICS[id].n)}">${relicI(id)}</button>`).join('')}</div>
    <div class="tonics">${RUN.tonics.map((id, i) => id ? `<button class="tonic full" data-tonic="${i}" data-tip="${tonicTip(id)}${esc(inFight ? '<br><b>Click to drink.</b>' : '')}" aria-label="${esc(TONICS[id].n)}" ${inFight ? '' : 'disabled'}>${flaskI(TONICS[id].col)}</button>` : `<button class="tonic" disabled aria-label="Empty tonic slot">${flaskI('', 1)}</button>`).join('')}</div>
    ${skyChips()}
    <span class="spacer"></span>
    <button class="ghost" id="bStats" title="Stats for the line and each player">Stats</button>
    <button class="ghost" id="bSeason" title="Every game this run, and the score">Season ${gameRecord(RUN.games)}</button>
    <button class="ghost" id="bDeck">Deck ${RUN.deck.length}</button>
    <button class="ghost" id="bPause" title="Pause, or save and come back later (Esc)">Pause</button>
    <button class="ghost" id="bAbandon" title="Give up this run">Forfeit</button>`;
  $('bDeck').onclick = () => showDeck();
  $('bStats').onclick = () => showStats(RUN.games || [], RUN.party, CLUBS[RUN.club].short, 'Player stats this run');
  $('bSeason').onclick = () => (MVP_NAMES = null, showSeason(RUN.games || [], CLUBS[RUN.club].short, 'This season'));
  $('bPause').onclick = () => openPause();
  $('bAbandon').onclick = () => askConfirm('Forfeit this run?', 'It goes in the record book as a loss, and the run in progress is gone.', 'Forfeit', () => { if (UI.paused) closePause(); recordRun('quit'); showEnd('quit'); });
  document.querySelectorAll('[data-tonic]').forEach(b => b.onclick = () => drinkTonic(+b.dataset.tonic));
}
function sortDeck(cards) { const ord = { atk: 0, play: 1, skl: 2, pow: 3, gear: 4, junk: 5, curse: 6 }; return cards.slice().sort((a, b) => ord[def(a).type] - ord[def(b).type] || def(a).cost - def(b).cost || def(a).n.localeCompare(def(b).n)); }
function modal(html, onClose) {
  const m = $('modal'); $('modalBox').innerHTML = html; m.hidden = false;
  const close = () => { m.hidden = true; m.onclick = null; document.removeEventListener('keydown', esc1); if (onClose) onClose(); };
  const esc1 = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc1);
  m.onclick = e => { if (e.target === m || e.target.closest('[data-close]')) close(); };
  const f = $('modalBox').querySelector('button,[tabindex]'); if (f) f.focus();
  return close;
}
function showDeck(cards, title) {
  cards = cards || RUN.deck;
  modal(`<header><h3>${esc(title || `Your deck (${cards.length})`)}</h3><button class="ghost" data-close>Close</button></header><div class="cardgrid">${sortDeck(cards).map(c => cardHTML(c, { flav: false })).join('') || '<p class="hint">Empty.</p>'}</div>`);
}
// choose cards from the deck: mode 'remove' | 'upgrade'
function pickFromDeck(mode, done) {
  const list = mode === 'upgrade' ? RUN.deck.filter(upgradable) : mode === 'practice' ? RUN.deck.filter(practicable) : RUN.deck.slice();
  const close = modal(`<header><h3>${mode === 'upgrade' ? 'Upgrade a card' : mode === 'practice' ? 'Practice a card' : 'Remove a card'}</h3><button class="ghost" data-close>Cancel</button></header>
    <p class="hint">${mode === 'upgrade' ? 'Hover a card to see what the upgrade does.' : mode === 'practice' ? 'A practiced card (★) gets better at every sport without changing its fight stats. Practice and upgrades stack.' : 'It leaves your deck for the rest of the run.'}</p>${mode === 'practice' ? `<p class="hint" style="font-size:14px;columns:2">${practiceTip()}</p>` : ''}
    <div class="cardgrid pickable">${sortDeck(list).map(c => cardHTML(c, { flav: false })).join('')}</div>`, () => done && done(null));
  $('modalBox').querySelectorAll('.card').forEach(el => {
    const card = RUN.deck.find(c => c.uid == el.dataset.uid);
    if (mode === 'upgrade') { el.addEventListener('mouseenter', () => { el.outerHTML; const tmp = Object.assign({}, card, { up: true }); el.querySelector('.tx').innerHTML = cardText(tmp, {}); el.querySelector('.nm').textContent = def(tmp).n; el.classList.add('up'); }); el.addEventListener('mouseleave', () => { el.querySelector('.tx').innerHTML = cardText(card, {}); el.querySelector('.nm').textContent = def(card).n; el.classList.remove('up'); }); }
    const go = () => { const cb = done; done = null; close(); if (mode === 'upgrade') card.up = true; else if (mode === 'practice') { card.sk = 1; achAdd('practice', 1); } else RUN.deck.splice(RUN.deck.indexOf(card), 1); saveRun(); renderRunBar(); cb && cb(card); };
    el.onclick = go; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
}

/* ---------- the map ---------- */
const UI = { view: 'map', sel: -1, tsel: 0, busy: false, speed: 1 };
function nodeXY(n) {
  if (n.k === 'boss') return { x: 340, y: 62 };
  let h = 0; for (const ch of n.k + RUN.act) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { x: 70 + n.c * 90 + ((h % 21) - 10), y: 160 + (FLOORS - 1 - n.r) * 76 + (((h >> 5) % 13) - 6) };
}
function renderMap() {
  const M = RUN.map, can = nextNodes().map(n => n.k), A = ACTS[RUN.act];
  const H = 160 + FLOORS * 76 + 10;
  const path = RUN.path || [];
  let edges = '', nodes = '';
  for (const n of Object.values(M.nodes)) for (const k of n.next) {
    const a = nodeXY(n), b = nodeXY(M.nodes[k]); const walked = path.includes(n.k) && (path.includes(k) || RUN.pos === n.k && false);
    const onPath = path.indexOf(k) === path.indexOf(n.k) + 1 && path.includes(n.k);
    edges += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${onPath ? '#ffb347' : '#5a4636'}" stroke-width="${onPath ? 3.5 : 2}" stroke-dasharray="${onPath ? '' : '5 6'}"/>`;
  }
  for (const n of Object.values(M.nodes)) {
    const p = nodeXY(n), isCan = can.includes(n.k), done = path.includes(n.k), cur = RUN.pos === n.k;
    if (n.t === 'boss') {
      const bid = bossId(), BD = ENEMIES[bid];
      nodes += `<g class="mnode${isCan ? ' can' : ''}" data-node="boss" ${isCan ? 'tabindex="0" role="button"' : ''} aria-label="Boss: ${esc(BD.n)}"><circle class="ring" cx="${p.x}" cy="${p.y}" r="50" fill="none" stroke="#ffb347" stroke-width="2"/><clipPath id="bclip"><circle cx="${p.x}" cy="${p.y}" r="44"/></clipPath><image href="${portraitURL(BD.kind, BD.team, '', 120)}" x="${p.x - 44}" y="${p.y - 44}" width="88" height="88" clip-path="url(#bclip)"/><circle cx="${p.x}" cy="${p.y}" r="44" fill="none" stroke="#e0533a" stroke-width="3"/><text x="${p.x + 60}" y="${p.y - 4}" fill="#efe4cc" font-family="Grenze Gotisch, Georgia, serif" font-weight="700" font-size="24">${esc(BD.n.split(',')[0])}</text><text x="${p.x + 60}" y="${p.y + 18}" fill="#b8a68c" font-family="Alegreya Sans, sans-serif" font-size="15">${esc((BD.n.split(', ')[1] || '').replace(/^the /, 'The '))}</text></g>`;
      continue;
    }
    nodes += `<g class="mnode${isCan ? ' can' : ''}" data-node="${n.k}" ${isCan ? 'tabindex="0" role="button"' : ''} aria-label="${NODE_NAME[n.t]}${n.sport ? `, ${SPORT_NAME[n.sport]}` : ''}${n.stakes ? `, high stakes: ${STAKES[n.stakes].n}` : ''}${n.trait ? `, ${ELITE_TRAITS[n.trait].n}` : ''}${isCan ? ', available' : done ? ', visited' : ''}" ${!done && (n.trait || n.sport || n.stakes) ? `data-tip="${esc((n.sport ? `<span class=\"t\">${SPORT_NAME[n.sport]}</span>${SPORTS[n.sport].desc}` : '') + (n.trait ? '<br><br>' + traitTip(n.trait) : '') + (n.stakes ? `<br><br><b style="color:#ff8a7a">High stakes: ${STAKES[n.stakes].n}.</b> ${STAKES[n.stakes].desc}` : ''))}"` : ''}>
      <circle class="ring" cx="${p.x}" cy="${p.y}" r="21" fill="${done ? '#3a2c22' : '#1c1511'}" stroke="${cur ? '#ffb347' : isCan ? '#ffb347' : done ? '#7f6d5a' : '#4a3a2e'}" stroke-width="${cur ? 3 : 2}" ${isCan ? '' : ''}/>
      <svg x="${p.x - 13}" y="${p.y - 13}" width="26" height="26" viewBox="0 0 24 24" opacity="${done || isCan || !RUN.pos ? 1 : .55}">${NODE_ICO[n.t]}</svg>
      ${n.sport && !done ? `<g aria-hidden="true" transform="translate(${p.x - 26} ${p.y + 6})"><circle cx="9" cy="9" r="10" fill="#1c1511" stroke="#5a4636"/><svg x="1" y="1" width="16" height="16" viewBox="0 0 24 24">${SPORT_GLYPH[n.sport]}</svg></g>` : ''}
      ${n.stakes && !done ? `<g aria-hidden="true"><circle cx="${p.x + 17}" cy="${p.y - 15}" r="9" fill="#3a0e0a" stroke="#ff6a5a" stroke-width="1.5"/><text x="${p.x + 17}" y="${p.y - 11}" text-anchor="middle" font-size="12" font-family="Jersey 10, monospace" fill="#ff6a5a">${STAKES[n.stakes].icon}</text></g>` : ''}
      ${n.trait && !done ? `<g aria-hidden="true"><circle cx="${p.x + 17}" cy="${p.y - 15}" r="9" fill="#1c1511" stroke="${['#7fe08a', '#ffd166', '#ffb347', '#ff6a5a'][ELITE_TRAITS[n.trait].risk]}" stroke-width="1.5"/><text x="${p.x + 17}" y="${p.y - 11}" text-anchor="middle" font-size="11" font-family="Jersey 10, monospace" fill="${['#7fe08a', '#ffd166', '#ffb347', '#ff6a5a'][ELITE_TRAITS[n.trait].risk]}">${ELITE_TRAITS[n.trait].n[0]}</text></g>` : ''}
      ${done && !cur ? `<path d="M${p.x - 15} ${p.y + 15}L${p.x + 15} ${p.y - 15}" stroke="#ffb347" stroke-width="2" opacity=".7"/>` : ''}</g>`;
  }
  $('v-map').innerHTML = `<div class="mapwrap">
    <div><div class="maphead"><h2 class="pgh">Act ${['I', 'II', 'III'][RUN.act]}: ${esc(A.n)}</h2><p class="lede">${esc(A.sub)}. Pick where your line goes next. You can only move up the paths; hover a room to see everywhere it leads.</p></div>
    <div class="mapscroll" id="mapScroll"><svg viewBox="0 0 680 ${H}" role="group" aria-label="Dungeon map">${edges}${nodes}</svg></div></div>
    <div class="side">
      <section><h4>The map</h4><div class="legend">${['fight', 'elite', 'rival', 'event', 'rest', 'shop', 'chest'].map(t => `<div>${svgI(NODE_ICO[t])}<span><b style="color:var(--bone)">${NODE_NAME[t]}</b>. ${{ fight: 'A brawl; the badge shows which sport.', elite: 'A tougher foe. Drops a trophy.', rival: 'One per act: a souped-up elite. Bigger purse and a Hall of Fame card on offer. You can route around it.', event: 'Something strange. Usually a d20 is involved.', rest: 'Heal up or study film to upgrade a card.', shop: 'Cards, trophies, tonics, and card removal.', chest: 'A trophy and some gold.' }[t]}</span></div>`).join('')}</div></section>
      ${goalsPanel()}
      <section><h4>The schedule</h4><p class="hint" style="margin:0 0 8px;font-size:14px">Home sport this act: <b style="color:var(--bone)">${SPORT_NAME[ACT_HOME[RUN.act]]}</b>. Every fight room shows the game it will be.</p><div class="sched">${scheduleCounts().map(([s, n]) => `<span>${sportSVG(s, 20)} ${SPORT_NAME[s]} <b>${n}</b></span>`).join('')}</div></section>
      ${skyPanel()}
      <section><h4>Your line</h4>${RUN.party.map(p => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><img src="${portraitURL(p.kind, clubTeam(), p.num, 76)}" alt="" width="40" height="40" style="border-radius:6px"><div><b style="font-family:var(--display);font-size:20px">${esc(p.n)}</b><br><small style="color:var(--dim)">${KIND_NAME[p.kind]}, #${p.num}</small></div></div>`).join('')}${RUN.extra.length ? `<p class="hint" style="margin:4px 0 0">Practice squad: ${RUN.extra.map(k => KIND_NAME[k]).join(', ')}.</p>` : ''}</section>
    </div></div>`;
  const reach = k => { const out = new Set([k]), st = [k]; while (st.length) { const n = M.nodes[st.pop()]; if (n) for (const x of n.next) if (!out.has(x)) { out.add(x); st.push(x); } } return out; };
  const dim = set => $('v-map').querySelectorAll('.mnode').forEach(g => g.style.opacity = !set || set.has(g.dataset.node) || path.includes(g.dataset.node) ? '' : '.28');
  $('v-map').querySelectorAll('.mnode.can').forEach(g => { g.addEventListener('mouseenter', () => dim(reach(g.dataset.node))); g.addEventListener('focus', () => dim(reach(g.dataset.node))); g.addEventListener('mouseleave', () => dim(null)); g.addEventListener('blur', () => dim(null)); });
  $('v-map').querySelectorAll('.mnode.can').forEach(g => { const go = () => enterNode(g.dataset.node); g.addEventListener('click', go); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); });
  // scroll so the next choices are in view
  requestAnimationFrame(() => { const sc = $('mapScroll'); if (!sc) return; const nx = nextNodes()[0]; if (!nx) return; const svg = sc.querySelector('svg'); const k = svg.clientHeight / H; sc.scrollTop = Math.max(0, nodeXY(nx).y * k - sc.clientHeight * .6); });
}
