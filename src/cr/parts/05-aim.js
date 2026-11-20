/* The Curling Shed: the aim (issue #102, phase 1). Where to send a stone, found by running the stone model alone on
   the ice, as a skip reads the curl: shared by the CPU, your coach's broom (phase 2) and the guide.
   crSolveDraw(x, y, h, ice, cold): the heading and the weight that bring a stone to rest at (x, y) with handle h.
   crSolveHit(x, y, v, h, ice, cold): the heading that sends a stone of weight v through (x, y) (a takeout: it meets
   the stone there). Both start from a straight line and the plain distance, then correct by where the model says
   the stone really goes, a few times over. null when no throw gets there (it would curl into the boards first). */
const CR_AIM = { tries: 8, tol: 1, vDraw: 141.7, vHit: 205, vPeel: 250, vRoll: 165 };
// a lone stone's x as it crosses y (yT), integrated without the others: the line a takeout runs on
function crPathX(th, yT, ice, cold) {
  const dt = CR_STONE.planDt, a = th.ang * Math.PI / 180, st = { x: th.x0 || 0, y: CR_STONE.y0, vx: th.v * Math.sin(a), vy: th.v * Math.cos(a), h: th.h || 0 };
  for (let t = 0; t < 60; t += dt) {
    const [ax, ay] = crAccel(st, ice, cold, 0), vx = st.vx + ax * dt, vy = st.vy + ay * dt, px = st.x, py = st.y;
    if (vy <= 0) return null;
    st.x += (st.vx + vx) / 2 * dt; st.y += (st.vy + vy) / 2 * dt; st.vx = vx; st.vy = vy;
    if (st.y >= yT) { const u = (yT - py) / (st.y - py); return px + (st.x - px) * u; }
    if (Math.abs(st.x) > CR_SHEET.halfW) return null;
  }
  return null;
}
function crSolveDraw(x, y, h, ice, cold) {
  const d0 = y - CR_STONE.y0; if (d0 <= 0) return null;
  let v = Math.sqrt(2 * CR_STONE.a * crIceAt(ice, x / 2, (y + CR_STONE.y0) / 2, cold) * d0), ang = Math.atan2(x, d0) * 180 / Math.PI;
  for (let i = 0; i < CR_AIM.tries; i++) {
    const r = crAlone({ x0: 0, ang, v, h }, ice, cold);
    // (out of play: through the back line is too heavy, short of the hog line too light, into the boards too wide)
    if (!r.stop) { const L = r.last; if (L.y > CR_SHEET.back) v *= .97; else if (Math.abs(L.x) + CR_SHEET.stoneR >= CR_SHEET.halfW) ang -= Math.sign(L.x) * .3; else v *= 1.02; continue; }
    const ex = x - r.x, ey = y - r.y;
    if (Math.abs(ex) < CR_AIM.tol && Math.abs(ey) < CR_AIM.tol) return { ang: +ang.toFixed(4), v: +v.toFixed(3), h };
    v *= Math.sqrt(Math.max(.25, (y - CR_STONE.y0) / Math.max(1, r.y - CR_STONE.y0)));
    ang += Math.atan2(ex, d0) * 180 / Math.PI;
  }
  const r = crAlone({ x0: 0, ang, v, h }, ice, cold);
  return r.stop && Math.hypot(r.x - x, r.y - y) < 12 ? { ang: +ang.toFixed(4), v: +v.toFixed(3), h } : null;
}
function crSolveHit(x, y, v, h, ice, cold) {
  const d0 = y - CR_STONE.y0; let ang = Math.atan2(x, d0) * 180 / Math.PI;
  for (let i = 0; i < CR_AIM.tries; i++) {
    const px = crPathX({ x0: 0, ang, v, h }, y, ice, cold); if (px === null) return null;
    const ex = x - px; if (Math.abs(ex) < .3) return { ang: +ang.toFixed(4), v, h };
    ang += Math.atan2(ex, d0) * 180 / Math.PI;
  }
  const px = crPathX({ x0: 0, ang, v, h }, y, ice, cold);
  return px !== null && Math.abs(px - x) < 2 ? { ang: +ang.toFixed(4), v, h } : null;
}
