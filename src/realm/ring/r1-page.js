/* The ring's page in the Realm (issue #23, phase 1). A canvas in #v-ring, after the gridiron's, and a frame loop that
   runs only while it is on screen (show/hide): it moves the bout on (bxTick) and draws it (bxDraw). The engine's parts
   don't touch the page; this file is the only one that does. In You box (phase 2) it hears the keys: WASD or the arrows
   to move, J jab, K hook, L body shot, hold Space to guard, Shift to slip, E to clinch, Q the special and R the
   ultimate (phase 4); only during a round and while
   the ring is on screen (not under How to play), in the capture phase, so nothing else on the page takes them. A key taken in a round stays
   taken until it is let go, wherever the bout has got to: held through the bell, its repeats and its release don't
   reach the bar (a held Space would otherwise click the button that has focus). Releases are always heard, so nothing
   stays held after a change of mode. */
// speed: steps a frame, 1 in play; the tests raise it (wBX.speed)
const BXP = { on: false, paused: false, host: null, cv: null, c: null, raf: 0, last: 0, dpr: 1, speed: 1 };
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
  if (!BXP.paused) for (let i = 0; i < BXP.speed && !BXP.paused; i++) { BXT.t += dt; bxTick(dt); }
  bxRender();
  BXP.raf = requestAnimationFrame(bxFrame);
}
const BX_KEYS = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
const BX_KEY_ACT = { j: 'jab', k: 'hook', l: 'body', shift: 'slip', e: 'clinch', q: 'sp', r: 'ult' };
const BXK = new Set(), BXHELD = new Set();
function bxKeySteer() { let x = 0, y = 0; for (const k of BXK) if (BX_KEYS[k]) { x += BX_KEYS[k][0]; y += BX_KEYS[k][1]; } return [x, y]; }
function bxKey(e, down) {
  if (!BXP.on || !BD) return;
  const k = e.key.toLowerCase(), ours = !!BX_KEYS[k] || k === ' ' || !!BX_KEY_ACT[k];
  if (!ours) return;
  const swallow = () => { e.preventDefault(); e.stopPropagation(); };
  // a key let go: always heard (steering and the guard end), and kept from the page if a round took it
  if (!down) { const held = BXHELD.delete(k); if (BX_KEYS[k]) { BXK.delete(k); bxInput({ steer: bxKeySteer() }); } else if (k === ' ') bxInput({ guard: false }); if (held) swallow(); return; }
  if (BXHELD.has(k)) { swallow(); return; }
  // (the ring on screen: How to play or another page over it hides the canvas, and the keys are the page's again)
  const live = BD.mode === 'play' && BXP.cv.offsetParent !== null && (BD.ph === 'round' || BD.ph === 'rise');
  if (!live || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input,textarea,select')) return;
  if (document.getElementById('modal') && !document.getElementById('modal').hidden) return;
  BXHELD.add(k);
  if (BX_KEYS[k]) { BXK.add(k); bxInput({ steer: bxKeySteer() }); }
  else if (k === ' ') bxInput({ guard: true });
  else bxInput({ act: BX_KEY_ACT[k] });
  swallow();
}
window.addEventListener('keydown', e => bxKey(e, true), true);
window.addEventListener('keyup', e => bxKey(e, false), true);
window.addEventListener('blur', () => { BXK.clear(); BXHELD.clear(); bxInputClear(); });
function bxShow() { BXP.host.hidden = false; if (BXP.on) return; BXP.on = true; BXP.last = performance.now(); BXP.raf = requestAnimationFrame(bxFrame); }
function bxHide() { BXK.clear(); BXHELD.clear(); bxInputClear(); BXP.host.hidden = true; BXP.on = false; cancelAnimationFrame(BXP.raf); }
