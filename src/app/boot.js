/* ---------- boot ---------- */
let last = performance.now();
const tcv = $('tcv'), tctx = tcv.getContext('2d');
// a draw that throws part-way can leave save() unmatched, and with it a shadow blur, filter or alpha that then
// applies to every later frame. Start each frame from a clean context.
function cleanCtx(c) {
  if (frame.dirty && c.reset) { c.reset(); frame.dirty = 0; return; }
  c.shadowBlur = 0; c.shadowColor = 'transparent'; c.filter = 'none'; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
function frame(now) {
  const dt = UI.paused ? 0 : Math.min(.05, (now - last) / 1000); last = now; G.time += dt; A.t += dt;
  try {
    if (UI.screen === 'title' && !$('pg-play').hidden) { const d = Math.min(2, Math.max(1, (window.devicePixelRatio || 1) * tcv.clientWidth / SW)); if (Math.abs((tcv._d || 0) - d) > .05) { tcv.width = Math.round(SW * d); tcv.height = Math.round(SH * d); tcv._d = d; } tctx.setTransform(d, 0, 0, d, 0, 0); drawTitle(tctx); }
    if (UI.view === 'fight' && B && !$('pg-play').hidden) { if (!cv._d) fitStage(); consumeFx(); cleanCtx(ctx); ctx.setTransform(cv._d || 1, 0, 0, cv._d || 1, 0, 0); drawFight(ctx, dt); }
  } catch (e) { console.error(e); if (!frame.err) { frame.err = 1; window.__sdErrs.push(String(e && e.stack || e)); } frame.dirty = 1; }
  requestAnimationFrame(frame);
}
function boot() {
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => showPage(t.dataset.pg));
  document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) showPage(g.dataset.goto); });
  // the Settings button (#bSound) is wired by app/settings.js, which loads after this file
  $('bNew').onclick = () => { DR.club = null; DR.picks = []; showScreen('draft'); renderDraft(); };
  window.addEventListener('resize', () => { if (UI.view === 'fight') fitStage(); });
  renderTitle();
  requestAnimationFrame(frame);
  // fonts land after first paint; repaint the portrait caches and the screens that use them
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const k in PORT) delete PORT[k]; for (const k in EMB) delete EMB[k]; for (const k in BGC) delete BGC[k]; if (UI.screen === 'draft') renderDraft(); if (UI.view === 'map') renderMap(); if (UI.view === 'fight') renderFightHUD(); });
}
if (!window.__SD_LAB && !window.__SD_REALM) boot();
