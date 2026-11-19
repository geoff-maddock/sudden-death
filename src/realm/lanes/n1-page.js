/* The Lanes' page in the Realm (issue #100, phase 2). A canvas in #v-lanes, after the Links', and a frame loop that
   runs only while it is on screen (show/hide): it moves the game on (blTick) and draws it (blDraw), at the screen's
   density. The engine's parts don't touch the page; this file is the only one that does.
   In You play it hears the keys only while the lanes are on screen (not under How to play) and it is your ball, in the
   capture phase so nothing else on the page takes them: Space bowls (each press: start, the speed, the release); the
   left and right arrows move your feet a board, A and D (or the up and down arrows) your arrow; B the ball (strike or
   spare), R the revs (less, normal, more), G the coach's suggestion again.
   The mouse or a finger: a click on the lane sets your arrow (or your feet, near the foul line), on either view; a
   drag that starts at the bowler and goes up the lane is a throw (the pull is the speed, a pull off straight the
   miss, and a swipe that bends at the end the way the ball hooks puts on more revs, the other way less).
   Phase 4's keys: L the line, S convert or safe on a split, T the tempo, H heavy or light, W the coach's word, C the
   lane chart (the page opens it). Phase 6's: P the bowler's power, U the ultimate, K steady. */
const BLP = { on: false, paused: false, host: null, cv: null, c: null, raf: 0, last: 0, dpr: 1, speed: 1, ptr: null };
(() => {
  const h = document.createElement('div'); h.id = 'v-lanes'; h.hidden = true;
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 600;
  cv.style.cssText = 'display:block;width:100%;max-width:1180px;margin:0 auto;aspect-ratio:960/600;background:#2e2420;border-radius:6px;touch-action:none';
  h.appendChild(cv);
  (document.getElementById('v-links') || document.getElementById('v-rink') || document.getElementById('v-world') || document.getElementById('v-panel')).insertAdjacentElement('afterend', h);
  Object.assign(BLP, { host: h, cv, c: cv.getContext('2d') });
})();
function blRender(dt) {
  const d = Math.min(2, window.devicePixelRatio || 1);
  if (d !== BLP.dpr || BLP.cv.width !== Math.round(960 * d)) { BLP.dpr = d; BLP.cv.width = Math.round(960 * d); BLP.cv.height = Math.round(600 * d); }
  const c = BLP.c; c.save(); c.setTransform(d, 0, 0, d, 0, 0); blDraw(c, dt || 0); c.restore();
}
function blFrame(now) {
  if (!BLP.on) return;
  const dt = Math.min(.05, Math.max(0, (now - BLP.last) / 1000)); BLP.last = now;
  const md = document.getElementById('modal'), boxed = !!md && !md.hidden;
  if (!BLP.paused && !boxed) for (let i = 0; i < BLP.speed && !BLP.paused; i++) blTick(dt);
  blRender(BLP.paused ? 0 : dt);
  BLP.raf = requestAnimationFrame(blFrame);
}
function blShow() { BLP.host.hidden = false; if (BLP.on) return; BLP.on = true; BLP.last = performance.now(); BLP.raf = requestAnimationFrame(blFrame); }
function blHide() { BLP.ptr = null; BLP.host.hidden = true; BLP.on = false; cancelAnimationFrame(BLP.raf); }

/* ---------- the keys ---------- */
function blKeyOk(e) {
  if (!BLP.on || !GP || GP.mode !== 'play' || BLP.paused || BLP.cv.offsetParent === null) return false;
  // Space belongs to the lanes for the whole of a live game, so it never presses a focused bar button mid-game
  const live = !G.over || GP.ph === 'roll';
  if (e.key === ' ' ? !live : GP.ph !== 'aim') return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.target && e.target.closest && e.target.closest('input,textarea,select')) return false;
  const m = document.getElementById('modal'); if (m && !m.hidden) return false;
  return true;
}
function blKeyDown(e) {
  if (!blKeyOk(e)) return;
  if (e.repeat && e.key === ' ') { e.preventDefault(); e.stopPropagation(); return; }
  const k = e.key.toLowerCase(), S = GP.sel;
  let took = true;
  if (k === ' ') blPress();
  else if (GP.ph !== 'aim' || !S) took = false;
  // the boards count from the right, so the left arrow moves you up the boards
  else if (k === 'arrowleft') blSelect({ stand: S.stand + 1 });
  else if (k === 'arrowright') blSelect({ stand: S.stand - 1 });
  else if (k === 'a' || k === 'arrowup') blSelect({ arrow: S.arrow + .5 });
  else if (k === 'd' || k === 'arrowdown') blSelect({ arrow: S.arrow - .5 });
  else if (k === 'b') blSelect({ ball: S.ball === 'strike' ? 'spare' : 'strike' });
  else if (k === 'r') blSelect({ revs: S.revs === 'less' ? 'normal' : S.revs === 'normal' ? 'more' : 'less' });
  else if (k === 'g') blSelect({ suggest: true });
  else if (k === 'l') { const L = Object.keys(BL_LINES), i = L.indexOf(blLineOf(GP.you)); blSelect({ line: L[(i + 1) % L.length] }); }
  else if (k === 's') blSelect({ split: G.split[GP.you] === 'safe' ? 'convert' : 'safe' });
  else if (k === 't') blSelect({ tempo: blStanceOf(GP.you).tempo === 'quick' ? 'steady' : 'quick' });
  else if (k === 'h') blSelect({ weight: blStanceOf(GP.you).ball === 'heavy' ? 'light' : 'heavy' });
  else if (k === 'w') blSelect({ word: true });
  else if (k === 'p') blCastMine('pow');
  else if (k === 'u') blCastMine('ult');
  else if (k === 'k') blCastMine('steady');
  else if (k === 'c') { if (BL_HOOK.onChart) try { BL_HOOK.onChart(); } catch (er) { console.error(er); } }
  else took = false;
  if (took) { e.preventDefault(); e.stopPropagation(); }
}
window.addEventListener('keydown', blKeyDown, true);

/* ---------- the pointer: set the arrow or the feet, or drag a throw up the lane ---------- */
function blPtrAt(e) { const r = BLP.cv.getBoundingClientRect(); return { sx: (e.clientX - r.left) * 960 / r.width, sy: (e.clientY - r.top) * 600 / r.height }; }
// a point of the picture as a point on the lane (either view), or null off it
function blLaneAt(sx, sy) {
  if (sx >= BL_VIEW.ovX - 8 && sx <= BL_VIEW.ovX + BL_VIEW.ovW + 8 && sy >= BL_VIEW.ovTop && sy <= BL_VIEW.ovBot) return blOvUn(sx, sy);
  if (sx < 640) return blUnscr(sx, sy);
  return null;
}
function blPointSet(q) {
  if (!q || !GP.sel) return;
  const b = blXBoard(q.x);
  if (q.y < 70) blSelect({ stand: b }); else blSelect({ arrow: b });
}
BLP.cv.addEventListener('pointerdown', e => {
  if (!GP || GP.mode !== 'play' || GP.ph !== 'aim' || BLP.paused || !GP.sel) return;
  const p = blPtrAt(e), [bx, by] = blScr(blBoardX(GP.sel.stand), -26);
  BLP.ptr = { throw: p.sx < 640 && Math.abs(p.sx - bx) < 40 && p.sy > by - 70, x: p.sx, y: p.sy, id: e.pointerId, cur: p, pts: [p] };
  try { BLP.cv.setPointerCapture(e.pointerId); } catch (er) { /* a synthetic press */ }
  if (!BLP.ptr.throw) blPointSet(blLaneAt(p.sx, p.sy));
  e.preventDefault();
});
BLP.cv.addEventListener('pointermove', e => {
  if (!BLP.ptr || !GP || GP.ph !== 'aim') return;
  const p = blPtrAt(e); BLP.ptr.cur = p; BLP.ptr.pts.push(p);
  if (!BLP.ptr.throw) blPointSet(blLaneAt(p.sx, p.sy));
});
function blPtrUp(e) {
  const P = BLP.ptr; BLP.ptr = null; if (!P || !GP) return;
  if (e.type === 'pointercancel' || !P.throw || GP.ph !== 'aim') return;
  const q = P.cur, dx = q.sx - P.x, dy = P.y - q.sy, pull = Math.hypot(dx, dy) / BL_HANDS.drag;
  // the spin: a swipe that bends at the end, the way the bowler's ball hooks, puts on more revs; bent the other way, less
  const pts = P.pts, mid = pts[Math.floor(pts.length / 2)], a1 = Math.atan2(mid.sx - P.x, P.y - mid.sy), a2 = Math.atan2(q.sx - mid.sx, mid.sy - q.sy);
  const bend = ((a2 - a1) * 180 / Math.PI), hand = blStyleOf(GP.you, blBowler(GP.you)).hand, hookWay = -hand;   // a right-hander's ball hooks left: a bend to the left on screen
  if (pts.length >= 4 && GP.sel) { const b = bend * Math.sign(hookWay); if (b > BL_HANDS.bend) GP.sel.revs = 'more'; else if (b < -BL_HANDS.bend) GP.sel.revs = 'less'; }
  // up the lane is straight; off to the side is the miss (to the left is early, as a pull is)
  if (dy > 20 && pull > .2) blDrag(pull, Math.atan2(-dx, dy) * 180 / Math.PI);
}
for (const ev of ['pointerup', 'pointercancel']) BLP.cv.addEventListener(ev, blPtrUp);
