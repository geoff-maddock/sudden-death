/* The court's page in the Realm (issue #77, phase 1). A canvas in #v-court, after the ring's, and a frame loop that
   runs only while it is on screen (show/hide): it moves the game on (bkTick) and draws it (bkDraw). The engine's parts
   don't touch the page; this file is the only one that does. It draws at the screen's density, so it stays sharp.
   In You play (phase 2) it hears the keys: WASD or the arrows to steer, Space to shoot (hold, let go at the top) or
   jump, J to pass (hold to lob) or swipe, E for the pick or to switch players, Q a crossover, R a spin, Shift held to
   box out, T a timeout (phase 4); only while the court is on screen (not under How to play), in a live play or at the line, in the capture
   phase so nothing else on the page takes them. A key taken stays taken until it's let go; releases are always heard. */
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
const BK_KEYS = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
const BK_KEY_ACT = { e: 'pick', q: 'cross', r: 'spin' };
const BKK = new Set(), BKHELD = new Set();
function bkKeySteer() { let x = 0, y = 0; for (const k of BKK) if (BK_KEYS[k]) { x += BK_KEYS[k][0]; y += BK_KEYS[k][1]; } return [x, y]; }
function bkKey(e, down) {
  if (!BKP.on || !GD) return;
  const k = e.key.toLowerCase(), ours = !!BK_KEYS[k] || k === ' ' || k === 'j' || k === 'shift' || k === 't' || !!BK_KEY_ACT[k];
  if (!ours) return;
  const swallow = () => { e.preventDefault(); e.stopPropagation(); };
  if (!down) {
    const held = BKHELD.delete(k);
    if (BK_KEYS[k]) { BKK.delete(k); bkInput({ steer: bkKeySteer() }); } else if (k === ' ') bkInput({ shoot: false }); else if (k === 'j') bkInput({ pass: false }); else if (k === 'shift') bkInput({ box: false });
    if (held) swallow(); return;
  }
  if (BKHELD.has(k)) { swallow(); return; }
  // T: a timeout, whatever is happening (it says why not, when it can't)
  if (k === 't' && GD.mode === 'play' && BKP.cv.offsetParent !== null && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target.closest && e.target.closest('input,textarea,select'))) {
    BKHELD.add(k); const r = bkTimeout(GD.you); if (r) GD.msg = r; swallow(); return;
  }
  const live = GD.mode === 'play' && BKP.cv.offsetParent !== null && (GD.ph === 'live' || GD.ph === 'ft');
  if (!live || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input,textarea,select')) return;
  if (document.getElementById('modal') && !document.getElementById('modal').hidden) return;
  BKHELD.add(k);
  if (BK_KEYS[k]) { BKK.add(k); bkInput({ steer: bkKeySteer() }); }
  else if (k === ' ') bkInput({ shoot: true });
  else if (k === 'j') bkInput({ pass: true });
  else if (k === 'shift') bkInput({ box: true });
  else bkInput({ act: k === 'e' && !bkOffenseMine() ? 'switch' : BK_KEY_ACT[k] });
  swallow();
}
window.addEventListener('keydown', e => bkKey(e, true), true);
window.addEventListener('keyup', e => bkKey(e, false), true);
window.addEventListener('blur', () => { BKK.clear(); BKHELD.clear(); bkInputClear(); });
function bkShow() { BKP.host.hidden = false; if (BKP.on) return; BKP.on = true; BKP.last = performance.now(); BKP.raf = requestAnimationFrame(bkFrame); }
function bkHide() { BKK.clear(); BKHELD.clear(); bkInputClear(); BKP.host.hidden = true; BKP.on = false; cancelAnimationFrame(BKP.raf); }
