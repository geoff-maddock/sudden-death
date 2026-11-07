/* p8c: opening an equipment trunk — the lock pops, the lid swings up, gold sprays out and the trophy rises */
const svgImg = (() => { const cache = {}; return (key, inner) => { if (cache[key]) return cache[key]; const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96">${inner}</svg>`); return cache[key] = im; }; })();
function trunkScene(cv, P) {
  const c = cv.getContext('2d'), W = 520, H = 300, dpr = 2;
  cv.width = W * dpr; cv.height = H * dpr; c.scale(dpr, dpr);
  const relicIm = P.relic ? svgImg(P.relic, ICO[RELICS[P.relic].ico] || ICO.gem) : null;
  const S = { t0: P.opened && !P.anim ? -10 : null, coins: [], sparks: [] };
  const cx = 260, by = 240, bw = 190, bh = 92; // body box
  const stencil = P.stencil || (P.stencil = ((a) => a[(Math.random() * a.length) | 0])(['AWAY', 'VISITORS', 'PROPERTY OF', 'DO NOT OPEN', 'EQUIP. ROOM 4']));
  function lidQuad(a) { // a: 0 closed .. 1 open. lid hinges at the back top edge
    const h = 34, ang = a * Math.PI * .62, top = by - bh;
    const dy = Math.cos(ang) * h, back = top - Math.sin(ang) * 26;
    return { top, back, dy };
  }
  function draw(now) {
    const t = S.t0 == null ? 0 : (now - S.t0) / 1000;
    c.clearRect(0, 0, W, H);
    const g = c.createRadialGradient(cx, 150, 20, cx, 160, 300); g.addColorStop(0, '#3a2a1c'); g.addColorStop(1, '#0b0806'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // floor
    c.fillStyle = '#1a120c'; c.fillRect(0, by + 8, W, H - by); ell(c, cx, by + 10, bw * .62, 14, 'rgba(0,0,0,.5)');
    const opening = S.t0 != null, shake = opening && t < .45 ? Math.sin(t * 70) * 3 * (1 - t / .45) : 0;
    const a = opening ? clamp((t - .4) / .45, 0, 1) : 0, ea = 1 - Math.pow(1 - a, 3);
    c.save(); c.translate(shake, 0);
    // glow from inside
    if (ea > 0) { c.save(); c.globalAlpha = ea * (.7 + Math.sin(now / 200) * .1); const lg = c.createLinearGradient(0, by - bh - 160, 0, by - bh); lg.addColorStop(0, 'rgba(255,209,102,0)'); lg.addColorStop(1, 'rgba(255,209,102,.55)'); c.fillStyle = lg; c.beginPath(); c.moveTo(cx - bw / 2 + 14, by - bh); c.lineTo(cx + bw / 2 - 14, by - bh); c.lineTo(cx + bw / 2 + 50, by - bh - 170); c.lineTo(cx - bw / 2 - 50, by - bh - 170); c.fill(); c.restore(); }
    // inside (visible when open)
    c.fillStyle = '#120b06'; c.fillRect(cx - bw / 2 + 6, by - bh - 4, bw - 12, 10);
    // body
    c.fillStyle = '#6b3f22'; c.strokeStyle = '#21160f'; c.lineWidth = 3; c.beginPath(); c.rect(cx - bw / 2, by - bh, bw, bh); c.fill(); c.stroke();
    c.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 1; i < 4; i++) c.fillRect(cx - bw / 2, by - bh + i * bh / 4, bw, 2);
    for (const x of [-bw / 2 + 22, bw / 2 - 30]) { c.fillStyle = '#8a8a8a'; c.fillRect(cx + x, by - bh, 8, bh); c.strokeRect(cx + x, by - bh, 8, bh); }
    txt(c, stencil, cx, by - 30, F_HUD(22), 'rgba(242,234,216,.55)', 'center');
    // lid
    const L = lidQuad(ea);
    c.fillStyle = '#7a4a28'; c.beginPath(); c.moveTo(cx - bw / 2 - 4, L.top); c.lineTo(cx + bw / 2 + 4, L.top);
    c.lineTo(cx + bw / 2 + 4, L.top - L.dy - (L.top - L.back) * 0); c.lineTo(cx - bw / 2 - 4, L.top - L.dy); c.closePath();
    if (ea > .55) { // lid flipped past vertical: draw it behind as a dark slab rising from the back edge
      c.fillStyle = '#4a2c18'; c.beginPath(); c.moveTo(cx - bw / 2 - 4, L.back + 4); c.lineTo(cx + bw / 2 + 4, L.back + 4); c.lineTo(cx + bw / 2 + 4, L.back - 30 * ea); c.lineTo(cx - bw / 2 - 4, L.back - 30 * ea); c.closePath();
    }
    c.fill(); c.stroke();
    if (ea < .55) { c.fillStyle = '#8a8a8a'; for (const x of [-bw / 2 + 22, bw / 2 - 30]) c.fillRect(cx + x, L.top - L.dy, 8, L.dy); }
    // padlock: pops off and tumbles
    const lk = opening ? clamp(t / .5, 0, 1) : 0;
    const lx = cx + lk * 120, ly = by - bh + 10 + lk * lk * 150 - Math.sin(lk * Math.PI) * 60;
    if (lk < 1 || ly < H) { c.save(); c.translate(lx, ly); c.rotate(lk * 6); c.strokeStyle = '#21160f'; c.lineWidth = 3; c.beginPath(); c.arc(0, -10, 8, Math.PI, 0); c.strokeStyle = '#c0c0c0'; c.lineWidth = 4; c.stroke(); c.fillStyle = '#d9b24a'; c.strokeStyle = '#21160f'; c.lineWidth = 2; c.beginPath(); c.rect(-12, -10, 24, 20); c.fill(); c.stroke(); circ(c, 0, 0, 3, '#21160f'); c.restore(); }
    c.restore();
    // coins
    if (opening && t > .7 && !S.burst) { S.burst = 1; const n = Math.min(40, 10 + P.gold / 2); for (let i = 0; i < n; i++) S.coins.push({ x: cx + (Math.random() - .5) * 80, y: by - bh, vx: (Math.random() - .5) * 260, vy: -260 - Math.random() * 240, r: Math.random() * 6, rv: (Math.random() - .5) * 20, d: Math.random() * .3 }); sfx.coin(); setTimeout(() => sfx.coin(), 120); setTimeout(() => sfx.coin(), 260); }
    const dt = S.last ? Math.min(.05, (now - S.last) / 1000) : 0; S.last = now;
    for (const k of S.coins) {
      if (t < .7 + k.d) continue;
      k.vy += 620 * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.r += k.rv * dt;
      if (k.y > by + 4) { k.y = by + 4; k.vy *= -.35; k.vx *= .7; k.rv *= .6; }
      const sx = Math.abs(Math.cos(k.r)) * 7 + 1.5;
      c.save(); c.translate(k.x, k.y); ell(c, 0, 0, sx, 7, '#ffd166'); c.strokeStyle = '#8a5a14'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 0, sx, 7, 0, 0, Math.PI * 2); c.stroke(); c.restore();
    }
    // the trophy rises
    if (relicIm && opening && t > .9) {
      const k = clamp((t - .9) / .8, 0, 1), e = 1 - Math.pow(1 - k, 3), y = by - bh - 14 - e * 86 + Math.sin(now / 400) * 4 * k, s = 30 + e * 34;
      c.save(); c.globalAlpha = e; const rg = c.createRadialGradient(cx, y, 4, cx, y, s * 1.6); rg.addColorStop(0, 'rgba(255,230,150,.75)'); rg.addColorStop(1, 'rgba(255,209,102,0)'); c.fillStyle = rg; c.beginPath(); c.arc(cx, y, s * 1.6, 0, Math.PI * 2); c.fill();
      c.translate(cx, y); c.rotate(Math.sin(now / 600) * .06);
      for (let i = 0; i < 8; i++) { const an = now / 900 + i * Math.PI / 4; c.strokeStyle = 'rgba(255,230,150,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(Math.cos(an) * s * .8, Math.sin(an) * s * .8); c.lineTo(Math.cos(an) * s * 1.35, Math.sin(an) * s * 1.35); c.stroke(); }
      if (relicIm.complete) c.drawImage(relicIm, -s / 2, -s / 2, s, s);
      c.restore();
    }
    // sparkles
    if (opening && t > .8 && Math.random() < .5) S.sparks.push({ x: cx + (Math.random() - .5) * bw, y: by - bh - Math.random() * 150, t: now });
    S.sparks = S.sparks.filter(p => now - p.t < 700);
    for (const p of S.sparks) { const k = (now - p.t) / 700; c.save(); c.globalAlpha = 1 - k; c.translate(p.x, p.y - k * 20); c.fillStyle = '#fff3c4'; c.beginPath(); for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2; c.lineTo(Math.cos(an) * 5, Math.sin(an) * 5); c.lineTo(Math.cos(an + Math.PI / 4) * 1.5, Math.sin(an + Math.PI / 4) * 1.5); } c.fill(); c.restore(); }
    if (cv.isConnected) requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  return { open: () => { if (S.t0 == null) { S.t0 = performance.now(); noise(.35, .12, 300, .5); } } };
}
function renderChest() {
  const P = RUN.panel, el = $('v-panel');
  el.innerHTML = `<div class="panel"><div class="chestwrap"><canvas id="trunk" class="trunk" aria-label="An equipment trunk${P.opened ? ', opened' : ''}"></canvas>
    <div style="display:grid;gap:12px;align-content:start"><h2>An equipment trunk</h2><p class="story">A battered away-team equipment trunk, padlocked, stencilled with a club name nobody remembers.</p><div id="loot" class="loot"></div><div class="row" id="trunkBtns"></div></div></div></div>`;
  const scene = trunkScene($('trunk'), P);
  const loot = (animate) => {
    $('loot').innerHTML = `<div class="lootc gold" style="${animate ? 'animation-delay:.9s' : 'animation:none'}"><svg viewBox="0 0 24 24" width="54" height="54" aria-hidden="true"><ellipse cx="9" cy="15" rx="7" ry="4" fill="#d9a83a" stroke="#21160f" stroke-width="1.2"/><ellipse cx="9" cy="13" rx="7" ry="4" fill="#ffd166" stroke="#21160f" stroke-width="1.2"/><ellipse cx="15" cy="10" rx="7" ry="4" fill="#d9a83a" stroke="#21160f" stroke-width="1.2"/><ellipse cx="15" cy="8" rx="7" ry="4" fill="#ffd166" stroke="#21160f" stroke-width="1.2"/></svg><div><b id="goldN">${animate ? 0 : P.gold}</b><span>gold</span></div></div>
      ${P.relic ? `<div class="lootc rel" style="${animate ? 'animation-delay:1.5s' : 'animation:none'}">${relicI(P.relic).replace('<svg', '<svg width="54" height="54"')}<div><b>${esc(RELICS[P.relic].n)}</b><span>${esc(RELICS[P.relic].desc)}</span><small>${RELICS[P.relic].rar === 'r' ? 'Rare trophy' : RELICS[P.relic].rar === 'u' ? 'Uncommon trophy' : 'Trophy'}</small></div></div>` : ''}`;
    if (animate) { const t0 = performance.now() + 900; const tick = now => { const k = clamp((now - t0) / 700, 0, 1), n = $('goldN'); if (!n) return; n.textContent = Math.round(P.gold * k); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    $('trunkBtns').innerHTML = `<button class="btn" id="bLeave2">Back to the map</button>`; $('bLeave2').onclick = backToMap;
  };
  if (!P.opened) {
    $('trunkBtns').innerHTML = `<button class="btn" id="bOpen">Pry it open</button><button class="ghost" id="bLeave2">Leave it</button>`;
    $('bOpen').onclick = () => { P.opened = 1; P.anim = 1; if (P.relic) gainRelic(P.relic); gainGold(P.gold); saveRun(); scene.open(); $('trunkBtns').innerHTML = ''; loot(true); setTimeout(() => { delete P.anim; renderRunBar(); }, 1600); };
    $('bLeave2').onclick = backToMap;
  } else loot(false);
}
