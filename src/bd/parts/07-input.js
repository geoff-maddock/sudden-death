/* ================= input ================= */
const KEYS = {
  p1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], act: ['KeyF'], abil: ['KeyG'], prev: ['KeyQ'], next: ['KeyE'], back: ['KeyR'], pen: ['KeyC'], hus: ['KeyV'] },
  p2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], act: ['Enter', 'NumpadEnter', 'Numpad0'], abil: ['ShiftRight', 'NumpadDecimal'], prev: ['Period', 'Numpad1'], next: ['Slash', 'Numpad2'], back: ['Quote', 'Numpad3'], pen: ['Backslash', 'Numpad5'], hus: ['ControlRight', 'NumpadAdd'] },
};
const SOLO_EXTRA = { act: ['Space', 'Enter', 'KeyJ'], abil: ['ShiftRight', 'ShiftLeft', 'KeyK'], up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], prev: ['Period', 'Comma'], next: ['Slash'], back: ['Quote', 'Backspace'], pen: [], hus: ['KeyH'] };
const BTN = ['up', 'down', 'left', 'right', 'act', 'abil', 'prev', 'next', 'back', 'pen', 'hus'];
const INP = { p1: { h: {}, p: {} }, p2: { h: {}, p: {} } };
function keyTargets(code) {
  const out = [];
  for (const pl of ['p1', 'p2']) for (const b of BTN) if (KEYS[pl][b].includes(code)) out.push([pl, b]);
  if (G.mode === '1p') { for (const b of BTN) if (SOLO_EXTRA[b].includes(code)) out.push(['p1', b]); }
  return out;
}
function press(pl, b) { if (!INP[pl].h[b]) INP[pl].p[b] = true; INP[pl].h[b] = true; }
function keyRelease(pl, b) { INP[pl].h[b] = false; }
window.addEventListener('keydown', e => {
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (typeof PAGE !== 'undefined' && PAGE !== 'play') return;
  if (e.code === 'KeyT' && !e.ctrlKey && !e.metaKey && !e.repeat) { setAuto(!AUTO); e.preventDefault(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.phase !== 'menu' && G.phase !== 'over') { togglePause(); e.preventDefault(); } return; }
  if (G.phase === 'menu' || G.phase === 'over' || G.paused) return;
  if (/^Digit[1-6]$/.test(e.code)) { e.preventDefault(); if (!e.repeat) INP.p1.p.num = +e.code.slice(5) - 1; return; }
  const t = keyTargets(e.code); if (!t.length) return;
  e.preventDefault();
  if (e.repeat) return;
  for (const [pl, b] of t) press(pl, b);
});
window.addEventListener('keyup', e => { for (const [pl, b] of keyTargets(e.code)) keyRelease(pl, b); });
window.addEventListener('blur', () => { for (const pl of ['p1', 'p2']) INP[pl].h = {}; });
const PADPREV = [{}, {}];
function pollPads() {
  let pads = []; try { pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean); } catch (e) { }
  pads.slice(0, 2).forEach((gp, i) => {
    const pl = i === 0 ? 'p1' : 'p2';
    const ax = gp.axes || [], bt = gp.buttons || [];
    const bp = n => !!(bt[n] && bt[n].pressed);
    const st = {
      up: bp(12) || (ax[1] || 0) < -.5, down: bp(13) || (ax[1] || 0) > .5, left: bp(14) || (ax[0] || 0) < -.5, right: bp(15) || (ax[0] || 0) > .5,
      act: bp(0), abil: bp(1), back: bp(2), pen: bp(3), prev: bp(4), next: bp(5), hus: bp(6) || bp(7),
    };
    const prev = PADPREV[i];
    for (const b of BTN) { if (st[b] && !prev[b]) press(pl, b); if (!st[b] && prev[b]) keyRelease(pl, b); }
    PADPREV[i] = st;
    if (bp(9) && !prev.start) { if (G.phase !== 'menu' && G.phase !== 'over') togglePause(); }
    PADPREV[i].start = bp(9);
  });
}
document.querySelectorAll('#touch [data-k]').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); actx(); press('p1', k); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => keyRelease("p1", k)));
});

