/* The court's page in the Realm (issue #77, phase 1). A canvas in #v-court, after the ring's, and a frame loop that
   runs only while it is on screen (show/hide): it moves the game on (bkTick) and draws it (bkDraw). The engine's parts
   don't touch the page; this file is the only one that does. It draws at the screen's density, so it stays sharp. */
// speed: steps a frame, 1 to watch; the tests raise it (wBK.speed)
const BKP = { on: false, paused: false, host: null, cv: null, c: null, raf: 0, last: 0, dpr: 1, speed: 1 };
(() => {
  const h = document.createElement('div'); h.id = 'v-court'; h.hidden = true;
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 600;
  cv.style.cssText = 'display:block;width:100%;max-width:960px;margin:0 auto;aspect-ratio:960/600;background:#120d0a;border-radius:6px';
  h.appendChild(cv);
  (document.getElementById('v-ring') || document.getElementById('v-gridiron') || document.getElementById('v-world') || document.getElementById('v-panel')).insertAdjacentElement('afterend', h);
  Object.assign(BKP, { host: h, cv, c: cv.getContext('2d') });
})();
function bkRender() {
  const d = Math.min(2, window.devicePixelRatio || 1);
  // (whole pixels on both sides: at a fractional density the canvas would otherwise be resized, and cleared, every frame)
  if (d !== BKP.dpr || BKP.cv.width !== Math.round(960 * d)) { BKP.dpr = d; BKP.cv.width = Math.round(960 * d); BKP.cv.height = Math.round(600 * d); }
  const c = BKP.c; c.save(); c.setTransform(d, 0, 0, d, 0, 0); bkDraw(c); c.restore();
}
function bkFrame(now) {
  if (!BKP.on) return;
  const dt = Math.min(.05, Math.max(0, (now - BKP.last) / 1000)); BKP.last = now;
  if (!BKP.paused) for (let i = 0; i < BKP.speed && !BKP.paused; i++) { BKT.t += dt; bkTick(dt); }
  bkRender();
  BKP.raf = requestAnimationFrame(bkFrame);
}
function bkShow() { BKP.host.hidden = false; if (BKP.on) return; BKP.on = true; BKP.last = performance.now(); BKP.raf = requestAnimationFrame(bkFrame); }
function bkHide() { BKP.host.hidden = true; BKP.on = false; cancelAnimationFrame(BKP.raf); }
