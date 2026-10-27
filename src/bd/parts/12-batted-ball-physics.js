/* ================= batted-ball physics ================= */
const TDT = 1 / 120;
function simTraj(x, y, z, vx, vy, vz) {
  const pts = []; let bounced = false, firstBounce = -1, hrAt = -1; const DRG = DRAG * (1 + (1 - carryK()) * 2.2), FH = fenceH();
  for (let i = 0; i < 2000; i++) {
    pts.push({ x, y, z, b: bounced });
    if (hrAt >= 0 && i > hrAt + 90) break;
    const sp = hyp(vx, vy, vz);
    if (z > 0 || vz > 0) { vx -= DRG * sp * vx * TDT; vy -= DRG * sp * vy * TDT; vz -= (GRAV + DRG * sp * vz) * TDT; }
    x += vx * TDT; y += vy * TDT; z += vz * TDT;
    if (z < 0) {
      z = 0; if (!bounced) { bounced = true; firstBounce = i + 1; }
      if (vz < -6) { vz = -vz * .36; vx *= .7; vy *= .7; } else vz = 0;
    }
    if (z === 0 && vz === 0) {
      const h = hyp(vx, vy), nh = Math.max(0, h - 22 * zoneMult('roll', x, y) * TDT);
      if (h > 0) { vx *= nh / h; vy *= nh / h; }
      if (nh === 0) { pts.push({ x, y, z, b: true }); break; }
    }
    const r = hyp(x, y), a = Math.atan2(x, y);
    if (hrAt < 0 && Math.abs(a) <= 46 * DEG && r >= fenceR(a)) {
      if (z > FH && !bounced) hrAt = i + 1;
      else { const nx = x / r, ny = y / r, vr = vx * nx + vy * ny; if (vr > 0) { vx -= 1.4 * vr * nx; vy -= 1.4 * vr * ny; } const fr = fenceR(a) - .6; x = nx * fr; y = ny * fr; }
    }
  }
  return { pts, firstBounce, hrAt };
}
function isFoul(tr) {
  const P = tr.pts, ang = p => Math.abs(Math.atan2(p.x, p.y)), F = 45 * DEG;
  if (tr.hrAt >= 0 && (tr.firstBounce < 0 || tr.hrAt < tr.firstBounce)) return ang(P[tr.hrAt]) > F;
  const i0 = tr.firstBounce >= 0 ? tr.firstBounce : P.length - 1;
  const p0 = P[i0];
  if (p0.y < 0) return true;
  if (hyp(p0.x, p0.y) > 100) return ang(p0) > F;
  for (let i = i0; i < P.length; i++) { const q = P[i], r = hyp(q.x, q.y); if (q.y < -1) return true; if (r >= 95) return ang(q) > F; if (r > 4 && ang(q) > F) return true; }
  const e = P[P.length - 1]; return hyp(e.x, e.y) > 4 ? ang(e) > F : false;
}

