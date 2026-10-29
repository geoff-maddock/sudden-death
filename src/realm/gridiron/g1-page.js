/* The gridiron's page in the Realm (issue #9, phase 1). A canvas in #v-gridiron, after the world view, and a frame
   loop that runs only while it is on screen (show/hide): it moves the drive on (gfTick) and draws it (gfDraw). The
   engine's parts don't touch the page; this file is the only one that does. */
const GFP = { on: false, paused: false, host: null, cv: null, c: null, raf: 0, last: 0, dpr: 1 };
(() => {
  const h = document.createElement('div'); h.id = 'v-gridiron'; h.hidden = true;
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 600;
  cv.style.cssText = 'display:block;width:100%;max-width:960px;margin:0 auto;aspect-ratio:960/600;background:#0b0907;border-radius:6px';
  h.appendChild(cv);
  (document.getElementById('v-world') || document.getElementById('v-panel')).insertAdjacentElement('afterend', h);
  Object.assign(GFP, { host: h, cv, c: cv.getContext('2d') });
})();
function gfRender() {
  const d = Math.min(2, window.devicePixelRatio || 1);
  if (d !== GFP.dpr || GFP.cv.width !== 960 * d) { GFP.dpr = d; GFP.cv.width = 960 * d; GFP.cv.height = 600 * d; }
  const c = GFP.c; c.save(); c.setTransform(d, 0, 0, d, 0, 0); gfDraw(c); c.restore();
}
function gfFrame(now) {
  if (!GFP.on) return;
  const dt = Math.min(.05, Math.max(0, (now - GFP.last) / 1000)); GFP.last = now;
  if (!GFP.paused) { GFT.t += dt; gfTick(dt); }
  gfRender();
  GFP.raf = requestAnimationFrame(gfFrame);
}
function gfShow() { GFP.host.hidden = false; if (GFP.on) return; GFP.on = true; GFP.last = performance.now(); GFP.raf = requestAnimationFrame(gfFrame); }
function gfHide() { GFP.host.hidden = true; GFP.on = false; cancelAnimationFrame(GFP.raf); }
