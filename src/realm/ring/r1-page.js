/* The ring's page in the Realm (issue #23, phase 1). A canvas in #v-ring, after the gridiron's, and a frame loop that
   runs only while it is on screen (show/hide): it moves the bout on (bxTick) and draws it (bxDraw). The engine's parts
   don't touch the page; this file is the only one that does. */
const BXP = { on: false, paused: false, host: null, cv: null, c: null, raf: 0, last: 0, dpr: 1 };
(() => {
  const h = document.createElement('div'); h.id = 'v-ring'; h.hidden = true;
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 600;
  cv.style.cssText = 'display:block;width:100%;max-width:960px;margin:0 auto;aspect-ratio:960/600;background:#0b0807;border-radius:6px';
  h.appendChild(cv);
  (document.getElementById('v-gridiron') || document.getElementById('v-world') || document.getElementById('v-panel')).insertAdjacentElement('afterend', h);
  Object.assign(BXP, { host: h, cv, c: cv.getContext('2d') });
})();
function bxRender() {
  const d = Math.min(2, window.devicePixelRatio || 1);
  if (d !== BXP.dpr || BXP.cv.width !== 960 * d) { BXP.dpr = d; BXP.cv.width = 960 * d; BXP.cv.height = 600 * d; }
  const c = BXP.c; c.save(); c.setTransform(d, 0, 0, d, 0, 0); bxDraw(c); c.restore();
}
function bxFrame(now) {
  if (!BXP.on) return;
  const dt = Math.min(.05, Math.max(0, (now - BXP.last) / 1000)); BXP.last = now;
  if (!BXP.paused) { BXT.t += dt; bxTick(dt); }
  bxRender();
  BXP.raf = requestAnimationFrame(bxFrame);
}
function bxShow() { BXP.host.hidden = false; if (BXP.on) return; BXP.on = true; BXP.last = performance.now(); BXP.raf = requestAnimationFrame(bxFrame); }
function bxHide() { BXP.host.hidden = true; BXP.on = false; cancelAnimationFrame(BXP.raf); }
