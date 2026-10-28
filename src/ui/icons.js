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
    case 'soccer': { O(pEl(0, 0, 50, 50), '#f2ead8'); O(pPoly([[0, -17], [16, -5], [10, 14], [-10, 14], [-16, -5]]), '#21160f'); break; }
    case 'curling': { O(pEl(0, 24, 54, 22), '#7a7a80'); O(pEl(0, 12, 54, 22), '#a8a8b0'); O(pRR(-6, -38, 12, 40, 4), '#d83a3a'); O(pRR(-6, -42, 40, 12, 5), '#d83a3a'); break; }
    case 'boxing': { const g2 = new Path2D(); g2.moveTo(-34, 30); g2.bezierCurveTo(-44, -10, -36, -52, 4, -52); g2.bezierCurveTo(40, -52, 50, -16, 40, 12); g2.bezierCurveTo(34, 30, 20, 34, 18, 34); g2.lineTo(-30, 34); g2.closePath(); O(g2, '#c2264a'); O(pRR(-32, 34, 52, 22, 5), '#f2ead8'); const th = new Path2D(); th.moveTo(-36, -2); th.bezierCurveTo(-58, -2, -58, 26, -30, 22); O(th, '#a81e3e'); break; }
    default: { O(pEl(0, 0, 40, 40), '#c9a24a'); }
  }
  return (EMB[key] = cv.toDataURL());
}
function junkURL() { if (EMB.junk) return EMB.junk; const cv = document.createElement('canvas'); cv.width = 300; cv.height = 150; const c = cv.getContext('2d'); c.fillStyle = '#3a3634'; c.fillRect(0, 0, 300, 150); c.strokeStyle = '#6b6560'; c.lineWidth = 8; c.beginPath(); c.moveTo(110, 35); c.lineTo(190, 115); c.moveTo(190, 35); c.lineTo(110, 115); c.stroke(); return (EMB.junk = cv.toDataURL()); }

