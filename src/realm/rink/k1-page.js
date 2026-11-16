/* The rink's page in the Realm (issue #83, phase 1). A canvas in #v-rink, after the court's, and a frame loop that
   runs only while it is on screen (show/hide): it moves the game on (hkTick) and draws it (hkDraw). The engine's parts
   don't touch the page; this file is the only one that does. It draws at the screen's density, so it stays sharp.
   In You play (phase 2) it hears the keys: WASD or the arrows to steer, Space to shoot (a tap, or hold to wind up) or
   check or take the face-off, J to pass (hold to send it hard) or poke, E to switch skaters, Shift held to lift your
   stick, G to pull your goalie or send them back; only while the rink is on screen (not under How to play), in a live play or at a face-off, in the capture
   phase so nothing else on the page takes them. A key taken stays taken until it's let go; releases are always heard. */
const HK_KEYS = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
const HKK = new Set(), HKHELD = new Set();
function hkKeySteer() { let x = 0, y = 0; for (const k of HKK) if (HK_KEYS[k]) { x += HK_KEYS[k][0]; y += HK_KEYS[k][1]; } return [x, y]; }
function hkKey(e, down) {
  if (!HKP.on || !GD) return;
  const k = e.key.toLowerCase(), ours = !!HK_KEYS[k] || k === ' ' || k === 'j' || k === 'shift' || k === 'e' || k === 'g';
  if (!ours) return;
  const swallow = () => { e.preventDefault(); e.stopPropagation(); };
  if (!down) {
    const held = HKHELD.delete(k);
    if (HK_KEYS[k]) { HKK.delete(k); hkInput({ steer: hkKeySteer() }); } else if (k === ' ') hkInput({ shoot: false }); else if (k === 'j') hkInput({ pass: false }); else if (k === 'shift') hkInput({ lift: false });
    if (held) swallow(); return;
  }
  if (HKHELD.has(k)) { swallow(); return; }
  const live = GD.mode === 'play' && HKP.cv.offsetParent !== null && (GD.ph === 'live' || GD.ph === 'drop' || GD.ph === 'set' || GD.ph === 'so');
  if (!live || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input,textarea,select')) return;
  if (document.getElementById('modal') && !document.getElementById('modal').hidden) return;
  HKHELD.add(k);
  if (HK_KEYS[k]) { HKK.add(k); hkInput({ steer: hkKeySteer() }); }
  else if (k === ' ') hkInput({ shoot: true });
  else if (k === 'j') hkInput({ pass: true });
  else if (k === 'shift') hkInput({ lift: true });
  else hkInput({ act: k === 'g' ? 'pull' : 'switch' });
  swallow();
}
window.addEventListener('keydown', e => hkKey(e, true), true);
window.addEventListener('keyup', e => hkKey(e, false), true);
window.addEventListener('blur', () => { HKK.clear(); HKHELD.clear(); if (GD) hkInputClear(); });
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
function hkHide() { HKK.clear(); HKHELD.clear(); if (GD) hkInputClear(); HKP.host.hidden = true; HKP.on = false; cancelAnimationFrame(HKP.raf); }
