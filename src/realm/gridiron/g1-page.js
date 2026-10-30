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
// Play mode's keys, only while the field is up and there's something to do with them; in the capture phase, so nothing
// else on the page takes them. G and T (powers) work in You call too
const GF_KEYS = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
const GFK = new Set();
function gfKeySteer() { let x = 0, y = 0; for (const k of GFK) if (GF_KEYS[k]) { x += GF_KEYS[k][0]; y += GF_KEYS[k][1]; } return [x, y]; }
function gfKey(e, down) {
  if (!GFP.on || !GD || GD.mode === 'watch' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input,textarea,select')) return;
  if (document.getElementById('modal') && !document.getElementById('modal').hidden) return;
  const k = e.key.toLowerCase();
  // powers, in You call and You play: G picks the next one you can cast with this call (then none), T switches Auto
  // powers; the page hears it as a new beat, to show it
  if (k === 'g' || k === 't') {
    if (down && !e.repeat) { if (k === 'g') gfCyclePower(); else { GD.auto = !GD.auto; if (GD.auto) GD.pow = null; } if (GF_HOOK.onPhase) try { GF_HOOK.onPhase(GD.ph); } catch (er) { console.error(er); } }
    e.preventDefault(); e.stopPropagation(); return;
  }
  if (GD.mode !== 'play') return;
  const live = L && L.hands && GD.ph === 'live' && !L.done, kick = GD.ph === 'kick' && GD.meter;
  if (!live && !kick) return;
  if (GF_KEYS[k]) { if (down) GFK.add(k); else GFK.delete(k); gfInput({ steer: gfKeySteer() }); }
  else if (k === ' ') { if (kick) { if (down && !e.repeat) gfInput({ tap: true }); } else if (!e.repeat || !down) gfInput({ hold: down }); }
  else if ((k === 'q' || k === 'e') && down) gfInput({ pick: k === 'q' ? -1 : 1 });
  else return;
  e.preventDefault(); e.stopPropagation();
}
window.addEventListener('keydown', e => gfKey(e, true), true);
window.addEventListener('keyup', e => gfKey(e, false), true);
window.addEventListener('blur', () => { GFK.clear(); if (L && L.hands) gfInput({ steer: [0, 0] }); });
function gfShow() { GFP.host.hidden = false; if (GFP.on) return; GFP.on = true; GFP.last = performance.now(); GFP.raf = requestAnimationFrame(gfFrame); }
function gfHide() { GFK.clear(); GFP.host.hidden = true; GFP.on = false; cancelAnimationFrame(GFP.raf); }
