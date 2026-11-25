/* The Lists' page in the Realm (issue #117, phase 2). A canvas in #v-lists, after the Shed's, and a frame loop that
   runs only while it is on screen (show/hide): it moves the match on (jtTick) and draws it (jtDraw), at the screen's
   density. The engine's parts don't touch the page; this file is the only one that does.
   In You ride it hears the keys only while the Lists are on screen (not under How to play), in the capture phase:
   - your plan: 1, 2, 3 the aim (shield, body, helm); Q and W the guard (angled, square); E and R the pace (canter,
     gallop); G your squire's plan again; Space rides;
   - the charge: Space tapped with the hoofbeats spurs; after the spur, Space held couches the lance (let go and it
     comes up); the arrows move your hand on the lance to hold the tip on your mark;
   - the seat: the left and right arrows lean.
   The mouse or a finger: a tap on the lists spurs; after the spur a press held couches, and dragging while you hold
   moves the tip (the drag is your hand); in the balance moment a drag left or right leans. */
const JTP = { on: false, paused: false, host: null, cv: null, c: null, raf: 0, last: 0, dpr: 1, speed: 1, ptr: null, keys: {} };
(() => {
  const h = document.createElement('div'); h.id = 'v-lists'; h.hidden = true;
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 600;
  cv.style.cssText = 'display:block;width:100%;max-width:1180px;margin:0 auto;aspect-ratio:960/600;background:#c9a46c;border-radius:6px;touch-action:none';
  h.appendChild(cv);
  (document.getElementById('v-shed') || document.getElementById('v-lanes') || document.getElementById('v-world') || document.getElementById('v-panel')).insertAdjacentElement('afterend', h);
  Object.assign(JTP, { host: h, cv, c: cv.getContext('2d') });
})();
function jtRender(dt) {
  const d = Math.min(2, window.devicePixelRatio || 1);
  if (d !== JTP.dpr || JTP.cv.width !== Math.round(960 * d)) { JTP.dpr = d; JTP.cv.width = Math.round(960 * d); JTP.cv.height = Math.round(600 * d); }
  const c = JTP.c; c.save(); c.setTransform(d, 0, 0, d, 0, 0); jtDraw(c, dt || 0); c.restore();
}
// the arrows and a held button (the Lean buttons: jtHold) move your hand or your lean
function jtKeysV() {
  const K = JTP.keys, B = JTP.btn || { x: 0, y: 0 }, x = (K.arrowright ? 1 : 0) - (K.arrowleft ? 1 : 0) + B.x, y = (K.arrowup ? 1 : 0) - (K.arrowdown ? 1 : 0) + B.y;
  if (!JTP.ptr) jtNudge(x, y);
}
function jtHold(vx, vy) { JTP.btn = { x: clamp(+vx || 0, -1, 1), y: clamp(+vy || 0, -1, 1) }; }
// (a throw in one frame is logged and the next frame still comes: phase 2's review)
function jtFrame(now) {
  if (!JTP.on) return;
  try {
    const dt = Math.min(.05, Math.max(0, (now - JTP.last) / 1000)); JTP.last = now;
    const md = document.getElementById('modal'), boxed = !!md && !md.hidden;
    jtKeysV();
    if (!JTP.paused && !boxed) for (let i = 0; i < JTP.speed && !JTP.paused; i++) jtTick(dt);
    jtRender(JTP.paused ? 0 : dt);
  } catch (e) { console.warn('The Lists: a frame threw', e); }
  finally { if (JTP.on) JTP.raf = requestAnimationFrame(jtFrame); }
}
function jtShow() { JTP.host.hidden = false; if (JTP.on) return; JTP.on = true; JTP.last = performance.now(); JTP.raf = requestAnimationFrame(jtFrame); }
function jtHide() { JTP.ptr = null; JTP.keys = {}; JTP.btn = null; if (GP) jtNudge(0, 0); JTP.host.hidden = true; JTP.on = false; cancelAnimationFrame(JTP.raf); }

/* ---------- the keys ---------- */
const JT_KEYS = { 1: ['aim', 'shield'], 2: ['aim', 'body'], 3: ['aim', 'helm'], q: ['guard', 'angled'], w: ['guard', 'square'], e: ['pace', 'canter'], r: ['pace', 'gallop'] };
function jtKeyOk(e) {
  if (!e.key) return false;
  if (!JTP.on || !GP || GP.mode === 'watch' || JTP.paused || JTP.cv.offsetParent === null) return false;
  // (Manage, phase 5: only your plan beat's keys)
  if (!['plan', 'charge', 'seat'].includes(GP.ph) || (GP.mode !== 'play' && GP.ph !== 'plan')) return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.target && e.target.closest && e.target.closest('input,textarea,select')) return false;
  const m = document.getElementById('modal'); if (m && !m.hidden) return false;
  return true;
}
function jtKeyDown(e) {
  if (!jtKeyOk(e)) return;
  const k = e.key.toLowerCase(); let took = true;
  if (k === ' ') { if (!e.repeat) jtPress(); }
  else if (k.startsWith('arrow')) { if (GP.ph === 'plan') took = false; else JTP.keys[k] = true; }
  else if (GP.ph === 'plan' && JT_KEYS[k]) { const [f, v] = JT_KEYS[k]; jtSelSay(jtSelect({ [f]: v })); }
  else if (GP.ph === 'plan' && k === 'g') jtSelSay(jtSelect({ suggest: true }));
  else took = false;
  if (took) { e.preventDefault(); e.stopPropagation(); }
}
function jtSelSay(why) { if (why && GP) { GP.msg = why; jtPicked(); } }
function jtKeyUp(e) {
  const k = (e.key || '').toLowerCase();
  if (k.startsWith('arrow')) { delete JTP.keys[k]; }
  if (k === ' ' && GP && GP.ph === 'charge' && GP.ch && GP.ch.down) { jtCouch(false); e.preventDefault(); e.stopPropagation(); }
}
window.addEventListener('keydown', jtKeyDown, true);
window.addEventListener('keyup', jtKeyUp, true);
window.addEventListener('blur', () => { JTP.keys = {}; JTP.btn = null; if (GP) jtNudge(0, 0); });

/* ---------- the pointer: tap to spur, hold to couch, drag to aim and to lean ---------- */
function jtPtrAt(e) { const r = JTP.cv.getBoundingClientRect(); return { sx: (e.clientX - r.left) * 960 / r.width, sy: (e.clientY - r.top) * 600 / r.height }; }
JTP.cv.addEventListener('pointerdown', e => {
  if (!GP || GP.mode !== 'play' || JTP.paused) return;
  const p = jtPtrAt(e), C = GP.ch;
  if (GP.ph === 'charge' && C && C.mine) {
    if (C.p < JT_PLAY.spur.until) { jtSpur(); e.preventDefault(); return; }
    jtCouch(true); JTP.ptr = { x: p.sx, y: p.sy, hand: Object.assign({}, C.hand), kind: 'aim' };
  } else if (GP.ph === 'seat' && GP.seatM) JTP.ptr = { x: p.sx, y: p.sy, lean: GP.seatM.lean, kind: 'lean' };
  else return;
  try { JTP.cv.setPointerCapture(e.pointerId); } catch (er) { /* a synthetic press */ }
  e.preventDefault();
});
JTP.cv.addEventListener('pointermove', e => {
  const P = JTP.ptr; if (!P || !GP) return;
  const q = jtPtrAt(e), dx = q.sx - P.x, dy = q.sy - P.y;
  // (a drag of a picture-pixel moves the tip a third of an inch; up the picture is up the target)
  if (P.kind === 'aim') jtAim(P.hand.x + dx / 3, P.hand.y - dy / 3);
  else if (P.kind === 'lean') jtLeanTo(P.lean + dx / 90);
});
function jtPtrUp() {
  const P = JTP.ptr; JTP.ptr = null;
  if (P && P.kind === 'aim' && GP && GP.ph === 'charge') jtCouch(false);
}
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) JTP.cv.addEventListener(ev, jtPtrUp);
