/* The Links' page in the Realm (issue #92, phase 2). A canvas in #v-links, after the rink's, and a frame loop that runs
   only while it is on screen (show/hide): it moves the game on (glTick) and draws it (glDraw). The engine's parts don't
   touch the page; this file is the only one that does. It draws at the screen's density, so it stays sharp.
   In You play it hears the keys, only while the course is on screen (not under How to play) and it is your shot or your
   choice, in the capture phase so nothing else on the page takes them: Space swings (each press: start, power, the
   mark; on a putt start, then the weight; while it is your shot or their putt to give it is the course's, so it never presses a focused button); the arrows aim (left and right turn it, up and down move the ring further
   or nearer); 1 to 4 pick the hitter; Q and E a longer or shorter club; Z the shape, X the height, C the spin; Y gives
   their putt and N makes them hole it.
   The mouse or a finger: a click or a drag on the course moves the aim; a drag that starts on your ball is a swing
   (pull back away from the target and let go: the pull is the power, a pull off the line a hook or a slice). */
const GLP = { on: false, paused: false, host: null, cv: null, c: null, raf: 0, last: 0, dpr: 1, speed: 1, ptr: null };
(() => {
  const h = document.createElement('div'); h.id = 'v-links'; h.hidden = true;
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 600;
  cv.style.cssText = 'display:block;width:100%;max-width:1180px;margin:0 auto;aspect-ratio:960/600;background:#243a20;border-radius:6px;touch-action:none';
  h.appendChild(cv);
  (document.getElementById('v-rink') || document.getElementById('v-court') || document.getElementById('v-world') || document.getElementById('v-panel')).insertAdjacentElement('afterend', h);
  Object.assign(GLP, { host: h, cv, c: cv.getContext('2d') });
})();
function glRender(dt) {
  const d = Math.min(2, window.devicePixelRatio || 1);
  if (d !== GLP.dpr || GLP.cv.width !== Math.round(960 * d)) { GLP.dpr = d; GLP.cv.width = Math.round(960 * d); GLP.cv.height = Math.round(600 * d); }
  const c = GLP.c; c.save(); c.setTransform(d, 0, 0, d, 0, 0); glDraw(c, dt || 0); c.restore();
}
function glFrame(now) {
  if (!GLP.on) return;
  const dt = Math.min(0.05, Math.max(0, (now - GLP.last) / 1000)); GLP.last = now;
  if (!GLP.paused) for (let i = 0; i < GLP.speed && !GLP.paused; i++) glTick(dt);
  glRender(GLP.paused ? 0 : dt);
  GLP.raf = requestAnimationFrame(glFrame);
}
function glShow() { GLP.host.hidden = false; if (GLP.on) return; GLP.on = true; GLP.last = performance.now(); GLP.raf = requestAnimationFrame(glFrame); }
function glHide() { GLP.ptr = null; if (GD) GD.drag = null; GLP.host.hidden = true; GLP.on = false; cancelAnimationFrame(GLP.raf); }

/* ---------- the keys ---------- */
function glKeyOk(e) {
  if (!GLP.on || !GD || GD.mode !== 'play' || GLP.paused || GLP.cv.offsetParent === null) return false;
  if (GD.ph !== 'aim' && GD.ph !== 'swing' && GD.ph !== 'offer') return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.target && e.target.closest && e.target.closest('input,textarea,select')) return false;
  const m = document.getElementById('modal'); if (m && !m.hidden) return false;
  return true;
}
function glKey(e) {
  if (!glKeyOk(e)) return;
  const k = e.key.toLowerCase(), S = GD.sel, putt = S && S.putt;
  let took = true;
  if (k === ' ') glPress();
  else if (GD.ph === 'offer' && (k === 'y' || k === 'n')) glOffer(k === 'y');
  else if (GD.ph !== 'aim') took = false;
  else if (k === 'arrowleft') glAimTurn(putt ? 0.6 : 1.5);
  else if (k === 'arrowright') glAimTurn(putt ? -0.6 : -1.5);
  else if (k === 'arrowup') glAimPush(putt ? 0.25 : 3);
  else if (k === 'arrowdown') glAimPush(putt ? -0.25 : -3);
  else if (k >= '1' && k <= '4') glSelect({ ri: +k - 1 });
  else if (k === 'q' || k === 'e') { const C = glClubsNow(), i = C.indexOf(S.club); glSelect({ club: C[clamp(i + (k === 'q' ? -1 : 1), 0, C.length - 1)] }); }
  else if (k === 'z') glSelect({ shape: S.shape === '' ? 'draw' : S.shape === 'draw' ? 'fade' : '' });
  else if (k === 'x') glSelect({ traj: S.traj === '' ? 'punch' : S.traj === 'punch' ? 'lob' : '' });
  else if (k === 'c') glSelect({ spin: S.spin === 0 ? -1 : S.spin < 0 ? 1 : 0 });
  else took = false;
  if (took) { e.preventDefault(); e.stopPropagation(); if (GL_HOOK.onPick) try { GL_HOOK.onPick(); } catch (er) { console.error(er); } }
}
window.addEventListener('keydown', glKey, true);

/* ---------- the pointer: aim, or a drag back from the ball to swing ---------- */
function glPtrAt(e) { const r = GLP.cv.getBoundingClientRect(); return { sx: (e.clientX - r.left) * 960 / r.width, sy: (e.clientY - r.top) * 600 / r.height }; }
GLP.cv.addEventListener('pointerdown', e => {
  if (!GD || GD.mode !== 'play' || GD.ph !== 'aim' || GLP.paused) return;
  const p = glPtrAt(e), b = G.ball[GD.you], [bx, by] = glScr(b.x, b.y);
  GLP.ptr = { swing: hyp(p.sx - bx, p.sy - by) < 26, id: e.pointerId };
  try { GLP.cv.setPointerCapture(e.pointerId); } catch (er) { /* a synthetic press */ }
  if (!GLP.ptr.swing) { const q = glUnscr(p.sx, p.sy); glAimAt(q.x, q.y); }
  else GD.drag = glUnscr(p.sx, p.sy);
  e.preventDefault();
});
GLP.cv.addEventListener('pointermove', e => {
  if (!GLP.ptr || !GD || GD.ph !== 'aim') return;
  const p = glPtrAt(e), q = glUnscr(p.sx, p.sy);
  if (GLP.ptr.swing) GD.drag = q; else glAimAt(q.x, q.y);
});
function glPtrUp(e) {
  const P = GLP.ptr; GLP.ptr = null; if (!P || !GD) return;
  if (P.swing && GD.ph === 'aim' && GD.drag) {
    const b = G.ball[GD.you], S = GD.sel, q = GD.drag, [bx, by] = glScr(b.x, b.y), [qx, qy] = glScr(q.x, q.y);
    const pull = hyp(qx - bx, qy - by) / GL_HANDS.drag, launch = Math.atan2(b.y - q.y, b.x - q.x), aim = Math.atan2(S.aim.y - b.y, S.aim.x - b.x);
    let deg = (launch - aim) * 180 / Math.PI; deg = ((deg + 540) % 360) - 180;
    GD.drag = null;
    if (pull > 0.08) glDrag(pull, deg);
  } else if (GD) GD.drag = null;
  if (GL_HOOK.onPick) try { GL_HOOK.onPick(); } catch (er) { console.error(er); }
}
for (const ev of ['pointerup', 'pointercancel']) GLP.cv.addEventListener(ev, glPtrUp);
