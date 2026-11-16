/* The rink's page in the Realm (issue #83, phase 1). A canvas in #v-rink, after the court's, and a frame loop that
   runs only while it is on screen (show/hide): it moves the game on (hkTick) and draws it (hkDraw). The engine's parts
   don't touch the page; this file is the only one that does. It draws at the screen's density, so it stays sharp. */
// speed: steps a frame, 1 to watch; the tests raise it (wHK.speed)
const HKP = { on: false, paused: false, host: null, cv: null, c: null, raf: 0, last: 0, dpr: 1, speed: 1 };
(() => {
  const h = document.createElement('div'); h.id = 'v-rink'; h.hidden = true;
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 600;
  cv.style.cssText = 'display:block;width:100%;max-width:960px;margin:0 auto;aspect-ratio:960/600;background:#0b1016;border-radius:6px';
  h.appendChild(cv);
  (document.getElementById('v-court') || document.getElementById('v-ring') || document.getElementById('v-gridiron') || document.getElementById('v-world') || document.getElementById('v-panel')).insertAdjacentElement('afterend', h);
  Object.assign(HKP, { host: h, cv, c: cv.getContext('2d') });
})();
function hkRender() {
  const d = Math.min(2, window.devicePixelRatio || 1);
  // (whole pixels on both sides: at a fractional density the canvas would otherwise be resized, and cleared, every frame)
  if (d !== HKP.dpr || HKP.cv.width !== Math.round(960 * d)) { HKP.dpr = d; HKP.cv.width = Math.round(960 * d); HKP.cv.height = Math.round(600 * d); }
  const c = HKP.c; c.save(); c.setTransform(d, 0, 0, d, 0, 0); hkDraw(c); c.restore();
}
function hkFrame(now) {
  if (!HKP.on) return;
  const dt = Math.min(.05, Math.max(0, (now - HKP.last) / 1000)); HKP.last = now;
  if (!HKP.paused) for (let i = 0; i < HKP.speed && !HKP.paused; i++) { HKT.t += dt; hkTick(dt); }
  hkRender();
  HKP.raf = requestAnimationFrame(hkFrame);
}
function hkShow() { HKP.host.hidden = false; if (HKP.on) return; HKP.on = true; HKP.last = performance.now(); HKP.raf = requestAnimationFrame(hkFrame); }
function hkHide() { HKP.host.hidden = true; HKP.on = false; cancelAnimationFrame(HKP.raf); }
