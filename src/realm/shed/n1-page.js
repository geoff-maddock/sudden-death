/* The Shed's page in the Realm (issue #102, phase 2). A canvas in #v-shed, after the Lanes', and a frame loop that runs
   only while it is on screen (show/hide): it moves the game on (crTick) and draws it (crDraw), at the screen's density.
   The engine's parts don't touch the page; this file is the only one that does.
   In You play it hears the keys only while the Shed is on screen (not under How to play), in the capture phase so
   nothing else takes them: Space throws (a press to start, a press at the line for the weight), and while your stone
   slides, holding Space sweeps it; the arrows move the broom (left and right a few inches, up and down a foot); I and
   O the handle (in-turn, out-turn); 1 to 6 the shot (draw, guard, freeze, takeout, peel, hit and roll); G your skip's
   call again.
   The mouse or a finger: a click on the house (either view) puts the broom there (for a hit, on the stone nearest it);
   a drag that starts at the hack (the bottom of the left view) and pulls back is a throw (the pull is the weight, a
   pull off straight the miss); and while your stone slides, holding a finger or the button down on the canvas
   sweeps. */
const CRP = { on: false, paused: false, host: null, cv: null, c: null, raf: 0, last: 0, dpr: 1, speed: 1, ptr: null, sweepKey: false, sweepPtr: false, sweepBtn: false };
(() => {
  const h = document.createElement('div'); h.id = 'v-shed'; h.hidden = true;
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 600;
  cv.style.cssText = 'display:block;width:100%;max-width:1180px;margin:0 auto;aspect-ratio:960/600;background:#16222a;border-radius:6px;touch-action:none';
  h.appendChild(cv);
  (document.getElementById('v-lanes') || document.getElementById('v-links') || document.getElementById('v-world') || document.getElementById('v-panel')).insertAdjacentElement('afterend', h);
  Object.assign(CRP, { host: h, cv, c: cv.getContext('2d') });
})();
function crRender(dt) {
  const d = Math.min(2, window.devicePixelRatio || 1);
  if (d !== CRP.dpr || CRP.cv.width !== Math.round(960 * d)) { CRP.dpr = d; CRP.cv.width = Math.round(960 * d); CRP.cv.height = Math.round(600 * d); }
  const c = CRP.c; c.save(); c.setTransform(d, 0, 0, d, 0, 0); crDraw(c, dt || 0); c.restore();
}
function crFrame(now) {
  if (!CRP.on) return;
  const dt = Math.min(.05, Math.max(0, (now - CRP.last) / 1000)); CRP.last = now;
  const md = document.getElementById('modal'), boxed = !!md && !md.hidden;
  // (sweeping is only ever for the stone sliding now: anything held over from before is let go)
  // (and only your own stone is swept: Space, a finger on the canvas and the Sweep button each hold it on their own)
  const yours = GP && GP.ph === 'slide' && GP.X && crYours(GP.X.s);
  if (GP && !yours) CRP.sweepKey = CRP.sweepPtr = CRP.sweepBtn = false;
  if (GP) GP.sweep = !!yours && (CRP.sweepKey || CRP.sweepPtr || CRP.sweepBtn);
  if (!CRP.paused && !boxed) for (let i = 0; i < CRP.speed && !CRP.paused; i++) crTick(dt);
  crRender(CRP.paused ? 0 : dt);
  CRP.raf = requestAnimationFrame(crFrame);
}
function crShow() { CRP.host.hidden = false; if (CRP.on) return; CRP.on = true; CRP.last = performance.now(); CRP.raf = requestAnimationFrame(crFrame); }
function crHide() { CRP.ptr = null; CRP.sweepKey = CRP.sweepPtr = CRP.sweepBtn = false; CRP.host.hidden = true; CRP.on = false; cancelAnimationFrame(CRP.raf); }

/* ---------- the keys ---------- */
const CR_SHOT_KEYS = { 1: 'draw', 2: 'guard', 3: 'freeze', 4: 'takeout', 5: 'peel', 6: 'hitroll' };
function crKeyOk(e) {
  if (!CRP.on || !GP || GP.mode !== 'play' || CRP.paused || CRP.cv.offsetParent === null) return false;
  // Space belongs to the Shed for the whole of a live game, so it never presses a focused bar button mid-game
  if (e.key === ' ' ? !!G.over && GP.ph !== 'slide' : GP.ph !== 'aim') return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.target && e.target.closest && e.target.closest('input,textarea,select')) return false;
  const m = document.getElementById('modal'); if (m && !m.hidden) return false;
  return true;
}
function crKeyDown(e) {
  if (!crKeyOk(e)) return;
  const k = e.key.toLowerCase(), S = GP.sel;
  let took = true;
  // (a press held on from the weight's press doesn't sweep: sweeping starts with a fresh press)
  if (k === ' ') { if (GP.ph === 'slide') { if (!e.repeat && GP.X && crYours(GP.X.s)) CRP.sweepKey = true; } else if (!e.repeat) crPress(); }
  else if (GP.ph !== 'aim' || !S) took = false;
  else if (k === 'arrowleft') crSelSay(crSelect({ x: S.x + 3 }));
  else if (k === 'arrowright') crSelSay(crSelect({ x: S.x - 3 }));
  else if (k === 'arrowup') crSelSay(crSelect({ y: S.y + 12 }));
  else if (k === 'arrowdown') crSelSay(crSelect({ y: S.y - 12 }));
  else if (k === 'i') crSelSay(crSelect({ h: -1 }));
  else if (k === 'o') crSelSay(crSelect({ h: 1 }));
  else if (CR_SHOT_KEYS[k]) crSelSay(crSelect({ shot: CR_SHOT_KEYS[k] }));
  else if (k === 'g') crSelSay(crSelect({ suggest: true }));
  else if (k === 'c') { if (CR_HOOK.onChart) try { CR_HOOK.onChart(); } catch (er) { console.error(er); } }
  else took = false;
  if (took) { e.preventDefault(); e.stopPropagation(); }
}
// why a change to your call didn't take, on the status line
function crSelSay(why) { if (why && GP) { GP.msg = why; crPick(); } }
function crKeyUp(e) { if (e.key === ' ' && CRP.sweepKey) { CRP.sweepKey = false; e.preventDefault(); e.stopPropagation(); } }
window.addEventListener('keydown', crKeyDown, true);
window.addEventListener('keyup', crKeyUp, true);
window.addEventListener('blur', () => { CRP.sweepKey = CRP.sweepPtr = CRP.sweepBtn = false; });

/* ---------- the pointer: the broom, a drag throw, and holding to sweep ---------- */
function crPtrAt(e) { const r = CRP.cv.getBoundingClientRect(); return { sx: (e.clientX - r.left) * 960 / r.width, sy: (e.clientY - r.top) * 600 / r.height }; }
// a point of the picture as a point on the ice (the house view or the sheet), or null off it
function crIceAtPt(sx, sy) {
  if (sx >= CR_VIEW.w + 10 && sy >= 18 && sy <= 318) return crHouseUn(sx, sy);
  if (sx < CR_VIEW.w) return crUnscr(sx, sy);
  return null;
}
CRP.cv.addEventListener('pointerdown', e => {
  if (!GP || GP.mode !== 'play' || CRP.paused) return;
  const p = crPtrAt(e);
  if (GP.ph === 'slide' && GP.X && crYours(GP.X.s)) { CRP.sweepPtr = true; try { CRP.cv.setPointerCapture(e.pointerId); } catch (er) { /* a synthetic press */ } e.preventDefault(); return; }
  if (GP.ph !== 'aim' || !GP.sel) return;
  CRP.ptr = { throw: p.sx < CR_VIEW.w && p.sy > 520, x: p.sx, y: p.sy, cur: p };
  try { CRP.cv.setPointerCapture(e.pointerId); } catch (er) { /* a synthetic press */ }
  if (!CRP.ptr.throw) { const q = crIceAtPt(p.sx, p.sy); if (q) crSelSay(crSelect({ x: q.x, y: q.y })); }
  e.preventDefault();
});
CRP.cv.addEventListener('pointermove', e => { if (CRP.ptr) CRP.ptr.cur = crPtrAt(e); });
function crPtrUp(e) {
  CRP.sweepPtr = false;
  const P = CRP.ptr; CRP.ptr = null; if (!P || !GP || e.type === 'pointercancel' || !P.throw || GP.ph !== 'aim') return;
  const q = P.cur, dx = q.sx - P.x, dy = q.sy - P.y;
  // pulled back (down the picture) is the weight: about 110 pixels is the call's own; off to the side is the miss
  if (dy > 25) crDrag(CR_PLAY.meter.low + (CR_PLAY.meter.high - CR_PLAY.meter.low) * clamp(dy / 240, 0, 1), Math.atan2(dx, dy) * 180 / Math.PI);
}
for (const ev of ['pointerup', 'pointercancel']) CRP.cv.addEventListener(ev, crPtrUp);
for (const ev of ['pointerleave', 'lostpointercapture']) CRP.cv.addEventListener(ev, () => { CRP.sweepPtr = false; });
window.addEventListener('pointerup', () => { CRP.sweepPtr = false; });
