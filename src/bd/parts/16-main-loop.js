/* ================= main loop ================= */
function update(dt, rdt) {
  G.time += rdt;
  for (const e of G.fx) e.t += rdt; G.fx = G.fx.filter(e => e.t < 2.2);
  if (G.banner) G.banner.t += rdt;
  if (G.rolls.length) { G.rolls[0].t += rdt; if (G.rolls[0].t > 2) G.rolls.shift(); }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - rdt);
  if (G.phase === 'between') { G.betweenT -= dt; if (G.betweenT <= 0) startAtBat(); }
  else if (G.phase === 'plate') { if (G.hitstop > 0) G.hitstop -= rdt; else plateUpdate(dt); }
  else if (G.phase === 'play' && PL) {
    if (G.tutorial) { if (INP.p1.p.act || INP.p1.p.abil || INP.p2.p.act || INP.p2.p.abil || G.tutClick) { G.tutorial = null; G.tutClick = false; INP.p1.p = {}; INP.p2.p = {}; } return; }
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < n && G.phase === 'play' && PL; i++) { playUpdate(dt / n); if (i === 0) { INP.p1.p = {}; INP.p2.p = {}; } }
  }
}
let last = performance.now();
function frame(now) {
  syncPauseBtn(); if (typeof syncHeaderButtons === 'function' && GAMES) syncHeaderButtons(); if (typeof syncSpeedbar === 'function') syncSpeedbar();
  const rdt = Math.min(.05, (now - last) / 1000); last = now;
  pollPads();
  if (!G.paused && G.phase !== 'menu') {
    let dt = rdt; if (G.slow > 0) { G.slow -= rdt; dt *= .3; }
    if (G.phase !== 'over') { const k = G.speed > 1 && allCPU() ? G.speed : 1; for (let i = 0; i < k && G.phase !== 'over'; i++) update(dt, rdt); } else { G.time += rdt; for (const e of G.fx) e.t += rdt; if (G.banner) G.banner.t += rdt; }
  } else G.time += rdt;
  render();
  INP.p1.p = {}; INP.p2.p = {};
  requestAnimationFrame(frame);
}
renderBestiary();
showPage((location.hash || '#play').slice(1));
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { bgPlate = null; bgField = null; for (const k in PORT_CACHE) delete PORT_CACHE[k]; renderBestiary(); });
requestAnimationFrame(frame);
