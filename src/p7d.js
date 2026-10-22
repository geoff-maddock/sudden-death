/* p7d: the sky, seen through two skylights in the back wall, and as chips in the run bar */
function drawMoon(c, x, y, r, phase) {
  // phase 0..7: 0 new, 4 full. Lit fraction drawn with a terminator ellipse.
  c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#1a1c28'; c.fillRect(x - r, y - r, r * 2, r * 2);
  const t = phase / 8 * Math.PI * 2, k = Math.cos(t); // k: 1 new .. -1 full
  const waxing = phase <= 4, lit = '#f2ead0';
  c.fillStyle = lit;
  c.beginPath();
  // lit half
  c.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !waxing);
  // terminator
  c.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === waxing);
  c.fill();
  c.globalAlpha = .18; c.fillStyle = '#8a8070'; for (const [dx, dy, rr2] of [[-.3, -.2, .18], [.25, .3, .12], [.1, -.4, .09]]) { c.beginPath(); c.arc(x + dx * r, y + dy * r, rr2 * r, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
function drawConstellation(c, x, y, s, C, tw) {
  c.save(); c.strokeStyle = 'rgba(180,200,255,.45)'; c.lineWidth = 1;
  for (const [a, b] of C.lines) { c.beginPath(); c.moveTo(x + C.pts[a][0] * s, y + C.pts[a][1] * s); c.lineTo(x + C.pts[b][0] * s, y + C.pts[b][1] * s); c.stroke(); }
  C.pts.forEach(([px, py], i) => { const a = .65 + Math.sin(tw * 3 + i * 1.7) * .35; c.globalAlpha = a; circ(c, x + px * s, y + py * s, 1.8 + (i % 3 === 0 ? .8 : 0), '#e8f0ff'); });
  c.restore();
}
function skylight(c, x, y, r, draw) {
  c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
  const g = c.createRadialGradient(x, y - r * .3, 2, x, y, r); g.addColorStop(0, '#16203a'); g.addColorStop(1, '#070a14'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  for (let i = 0; i < 14; i++) { const a = ((i * 73) % 100) / 100, b = ((i * 41) % 100) / 100; c.globalAlpha = .4 + Math.sin(A.t * 2 + i) * .3; circ(c, x - r + a * r * 2, y - r + b * r * 2, .8, '#c8d4ff'); }
  c.globalAlpha = 1; draw(); c.restore();
  c.save(); c.strokeStyle = '#1a120e'; c.lineWidth = 5; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#6a5240'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r + 2, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; c.beginPath(); c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.lineTo(x + Math.cos(a) * (r * .2), y + Math.sin(a) * (r * .2)); c.strokeStyle = 'rgba(26,18,14,.55)'; c.lineWidth = 2; c.stroke(); }
  c.restore();
}
function drawSky(c) {
  if (!RUN) return;
  const s = skyNow(), pulseM = A.skyT && A.skyT.what === 'moon' && A.t - A.skyT.t < 1.4, pulseS = A.skyT && A.skyT.what === 'stars' && A.t - A.skyT.t < 1.4;
  const ry = 150;
  skylight(c, 236, ry, 30, () => drawMoon(c, 236, ry, 20, s.moon));
  if (pulseM) { c.save(); c.globalAlpha = 1 - (A.t - A.skyT.t) / 1.4; c.strokeStyle = '#f2ead0'; c.lineWidth = 3; c.beginPath(); c.arc(236, ry, 34 + (A.t - A.skyT.t) * 30, 0, Math.PI * 2); c.stroke(); c.restore(); }
  skylight(c, 724, ry, 30, () => { drawConstellation(c, 712, ry - 8, .62, STARS[s.stars[0]], A.t); drawConstellation(c, 736, ry + 10, .5, STARS[s.stars[1]], A.t + 2); });
  if (pulseS) { c.save(); c.globalAlpha = 1 - (A.t - A.skyT.t) / 1.4; c.strokeStyle = '#c8d4ff'; c.lineWidth = 3; c.beginPath(); c.arc(724, ry, 34 + (A.t - A.skyT.t) * 30, 0, Math.PI * 2); c.stroke(); c.restore(); }
}
// small SVG versions for the run bar and the map
function moonSVG(phase, size = 24) {
  const r = 9, k = Math.cos(phase / 8 * Math.PI * 2), waxing = phase <= 4, rx = Math.abs(k) * r;
  const sweepLit = waxing ? 1 : 0, sweepTerm = ((k > 0) === waxing) ? 0 : 1;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="${r}" fill="#1a1c28" stroke="#6a5240"/>${phase === 0 ? '' : phase === 4 ? `<circle cx="12" cy="12" r="${r}" fill="#f2ead0"/>` : `<path d="M12 3 A${r} ${r} 0 0 ${sweepLit} 12 21 A${rx} ${r} 0 0 ${sweepTerm} 12 3Z" fill="#f2ead0"/>`}</svg>`;
}
function starsSVG(C, size = 24) {
  const s = .45;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#0b1020" stroke="#3e4a6a"/>${C.lines.map(([a, b]) => `<line x1="${12 + C.pts[a][0] * s}" y1="${12 + C.pts[a][1] * s}" x2="${12 + C.pts[b][0] * s}" y2="${12 + C.pts[b][1] * s}" stroke="#8fa0d0" stroke-width=".7"/>`).join('')}${C.pts.map(([x, y]) => `<circle cx="${12 + x * s}" cy="${12 + y * s}" r="1.1" fill="#e8f0ff"/>`).join('')}</svg>`;
}
function skyTipHTML() {
  const s = skyNow();
  return esc(`<span class="t">Tonight’s sky</span><b>${MOON[s.moon].n}.</b> ${MOON[s.moon].desc} <i>(changes in ${s.moonIn})</i><br><b>${STARS[s.stars[0]].n}.</b> ${STARS[s.stars[0]].desc}<br><b>${STARS[s.stars[1]].n}.</b> ${STARS[s.stars[1]].desc} <i>(new stars in ${s.starsIn})</i><br><br>The sky moves with every turn you fight and every room you enter.`);
}
function skyChips() {
  const s = skyNow();
  return `<div class="skychips" tabindex="0" data-tip="${skyTipHTML()}" aria-label="Moon and stars">${moonSVG(s.moon)}${starsSVG(STARS[s.stars[0]])}${starsSVG(STARS[s.stars[1]])}</div>`;
}
function skyPanel() {
  const s = skyNow(), kinds = RUN.party.map(p => p.kind);
  const fits = e => { if (e.grp) { const who = RUN.party.filter(p => inGrp(e.grp, p.kind)).map(p => p.n); return who.length ? `Helps ${who.join(', ')}.` : ''; } return ''; };
  const row = (ico, e, when) => `<div class="skyrow">${ico}<p><b>${esc(e.n)}</b> <small>${when}</small><br>${esc(e.desc)} <span style="color:var(--torch)">${esc(fits(e))}</span></p></div>`;
  return `<section><h4>Tonight’s sky</h4><div>${row(moonSVG(s.moon, 30), MOON[s.moon], `changes in ${s.moonIn}`)}${row(starsSVG(STARS[s.stars[0]], 30), STARS[s.stars[0]], `rotates in ${s.starsIn}`)}${row(starsSVG(STARS[s.stars[1]], 30), STARS[s.stars[1]], '')}</div><p class="hint" style="margin:0;font-size:13px">One tick per fight turn and per room. Moon every ${MOON_EVERY} ticks, stars every ${STARS_EVERY}.</p></section>`;
}
