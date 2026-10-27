/* ================= Close-play zoom: the camera leans in on a bang-bang play at a base ================= */
// During a play, when a runner and the ball are due at the same bag within about four tenths of a second of each other,
// the overhead field view eases in (about 1.9x) on that base, the action slows a touch, and a small
// "Close play at second" tag shows. It eases back out after the tag, the force, or the runner reaching safely.
// Settings > Close-play zoom, or Z in a game, turns it on and off. Off while CPU games run at 2x or faster.
PREF_DEFS.push({ k: 'zoom', label: 'Close-play zoom', opts: [[true, 'On'], [false, 'Off']], help: 'When a runner and the ball are about to reach the same base, the field view zooms in on the bag and the action slows slightly. Z toggles it in a game.' });
{ const g = prefGet, s = prefSet;
  prefGet = function (k) { return k === 'zoom' ? SET.zoom !== false : g.apply(this, arguments); };
  prefSet = function (k, v) { if (k === 'zoom') { SET.zoom = v; saveSettings(); return; } return s.apply(this, arguments); }; }
const zoomOn = () => SET.zoom !== false && !(G.speed > 1) && !G.sim;

const ZM = { z: 1, fx: 480, fy: 300, hold: 0, base: -1, t: 0, play: null, lastRunner: null, eps: 0, plays: 0 };
const BASE_WORD = ['home', 'first', 'second', 'third'];
const ZOOM_MAX = 1.9, CLOSE_GAP = .42, SOON = 1.45;

// the closest race between a runner and the ball to a base, if any is close enough to call
function closePlay() {
  const L = PL; if (!L || L.homer || L.endT !== null || L.ball.st === 'gone') return null;
  let best = null;
  for (const r of alive()) {
    if (settled(r) || r.fx.invis > 0 || r.fx.untag > 0) continue;
    const toward = r.target !== r.s ? r.target : null; if (toward == null) continue;
    const sp = effSpeed(r); if (sp <= 0) continue;
    const rt = Math.abs(toward - r.s) * 90 / sp; if (rt > SOON) continue;
    const b = toward % 4, bt = ballTimeTo(b); if (!isFinite(bt) || bt > SOON + .3) continue;
    const gap = Math.abs(rt - bt); if (gap > CLOSE_GAP) continue;
    if (!best || rt < best.rt) best = { r, b, rt, bt, gap };
  }
  return best;
}
function zoomStep() {
  const dt = clamp(G.time - ZM.t, 0, .1); ZM.t = G.time; // game time: freezes on pause, keeps pace with the speed-up
  if (ZM.play !== PL) { ZM.play = PL; ZM.hold = 0; ZM.base = -1; ZM.lastRunner = null; ZM.z = 1; ZM.live = false; if (PL) ZM.plays++; }
  let want = false;
  if (zoomOn() && PL) {
    const cp = closePlay();
    if (cp) {
      const B = BASE[cp.b], rp = runnerPos(cp.r), f = fp(B.x * .7 + rp.x * .3, B.y * .7 + rp.y * .3);
      if (!ZM.live) { ZM.eps++; ZM.fx = f.x; ZM.fy = f.y; } ZM.live = true; ZM.tx = f.x; ZM.ty = f.y; ZM.base = cp.b; ZM.lastRunner = cp.r; ZM.hold = .7; want = true;
    } else if (ZM.hold > 0) { ZM.hold -= dt; want = ZM.hold > 0; }
    if (!want) ZM.live = false;
  }
  if (!PL && ZM.hold > 0) ZM.hold = 0;
  const target = want ? ZOOM_MAX : 1, k = Math.min(1, dt * (want ? 5 : 3.5));
  ZM.z += (target - ZM.z) * k;
  if (want) { ZM.fx += ((ZM.tx ?? 480) - ZM.fx) * Math.min(1, dt * 7); ZM.fy += ((ZM.ty ?? 300) - ZM.fy) * Math.min(1, dt * 7); }
  if (ZM.z < 1.005 && !want) { ZM.z = 1; ZM.base = -1; }
  return want;
}
// the camera: zoom about the focus, pulled toward the middle, never showing past the edge of the field picture
function zoomXform(c) {
  const z = ZM.z, k = (z - 1) / (ZOOM_MAX - 1), ax = lerp(ZM.fx, 480, .55 * k), ay = lerp(ZM.fy, 300, .55 * k);
  const tx = clamp(ax - ZM.fx * z, W - W * z, 0), ty = clamp(ay - ZM.fy * z, H - H * z, 0);
  c.translate(tx, ty); c.scale(z, z);
}
{ const o = drawField; drawField = function (c) {
  let live = false; try { live = zoomStep(); } catch (e) { ZM.z = 1; }
  if (ZM.z <= 1.001) return o.apply(this, arguments);
  c.save(); zoomXform(c);
  try { o.apply(this, arguments); } finally { c.restore(); }
  // a soft vignette and the call, in screen space
  const k = (ZM.z - 1) / (ZOOM_MAX - 1);
  c.save(); const g = c.createRadialGradient(480, 300, 240, 480, 300, 620); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${.45 * k})`); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
  if (live && ZM.base >= 0 && k > .5) { c.save(); c.globalAlpha = Math.min(1, (k - .5) * 3); pill(c, `Close play at ${BASE_WORD[ZM.base]}`, 590, '#ffd34a', 18); c.restore(); }
}; }
// a touch of slow motion while the camera is in close
{ const o = update; update = function (dt, rdt) { if (G.phase === 'play' && ZM.z > 1.3 && zoomOn()) dt *= .65; return o.call(this, dt, rdt); }; }

/* ---------- toggles and help ---------- */
window.addEventListener('keydown', e => {
  if (e.code !== 'KeyZ' || e.repeat || e.ctrlKey || e.metaKey || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) || PAGE !== 'play') return;
  SET.zoom = SET.zoom === false; saveSettings();
  if (G.teams && G.phase !== 'menu') addFx('callout', { text: `Close-play zoom ${SET.zoom !== false ? 'on' : 'off'} · Z`, col: '#d6c4ff', small: true });
});
try { const b = document.getElementById('bTips'); if (b) b.closest('p').insertAdjacentHTML('afterend', '<p class="hint"><b>Close-play zoom</b> (on by default; <kbd>Z</kbd> or <a href="#settings" data-page="settings">Settings</a> to switch off): when a runner and the ball are about to reach the same base, the field view zooms in on the bag and the action slows slightly until the call. It stays off while CPU games run at 2× or faster.</p>'); } catch (e) { }
try { if (PAGE === 'settings') renderSettings(); } catch (e) { }
