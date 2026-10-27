/* ================= health and injuries ================= */
// health 0-100, separate from stamina. Below 60 a player is hurt: slower, weaker, wilder. At 0 he is knocked out for a few at-bats.
const hurtF = p => p && p.hp != null && p.hp < 60 ? (60 - p.hp) / 60 : 0;
const hurtMul = (p, k) => 1 - k * hurtF(p);
const FIRE_RES = { kobold: 0, troll: 2, golem: .5, witch: 1.5, lich: .7 };
function hurt(p, dmg, why, o = {}) {
  if (!p || !G.teams || p.ko > 0 || !injOn()) return 0;
  let m = INJ.mult[injLevel()];
  if (!o.raw && R() >= INJ.gate[injLevel()]) return 0; // most knocks are shrugged off at the gentler levels
  if (o.fire) m *= FIRE_RES[p.kind] ?? 1;
  if (p.kind === 'golem' && !o.fire) m *= .6;
  if (p.item === 'amulet' || p.endure) m *= .9;
  const d = Math.round(dmg * m); if (d <= 0) return 0;
  p.hp = Math.max(o.noKO ? 5 : 0, (p.hp ?? 100) - d); if (!o.quiet) pst(p).inj++;
  if (!o.quiet) { addFx('callout', { text: `${shortName(p)} hurt: −${d}`, col: '#ff8a7a', small: true }); logLine(`${p.n} is hurt: ${why} (−${d} health, ${Math.round(p.hp)} left).`); useTag('hurt', `${shortName(p)} hurt`); }
  if (p.hp <= 0) knockOut(p, 2 + (R() * 3 | 0), why);
  return d;
}
function knockOut(p, n, why) {
  if (p.ko > 0 || !injOn()) return;
  p.ko = n; p.hp = 0; pst(p).ko++;
  banner('Knocked out!', `${p.n} ${why ? '· ' + why : ''}`, 1.8); sfx.bad(); G.shake = Math.max(G.shake, .25);
  logLine(`${p.n} is knocked out and will miss the next ${n} at-bats.`, true);
  useTag('hurt', `${shortName(p)} knocked out`);
  if (PL) {
    const r = PL.runners.find(x => x.p === p && !x.out && !x.scored); if (r) outRunner(r, 'ko', null);
    const f = PL.fielders.find(x => x.p === p);
    if (f) { f.stun = 1e3; if (PL.ball.holder === f) { PL.ball.st = 'loose'; PL.ball.holder = null; PL.ball.z = 0; } }
  }
}
// a knocked-out batter misses his turn; a knocked-out pitcher has to come out
function skipKOBatters() {
  const t = BT();
  for (let g = 0; g < 9 && batter().ko > 0; g++) { logLine(`${batter().n} is still out cold and misses the at-bat.`); t.idx = (t.idx + 1) % 9; }
}
function healHalf() { for (const t of G.teams) for (const p of [...t.def.roster, ...t.pen]) if (!(p.ko > 0) && p.hp != null) p.hp = Math.min(100, p.hp + (p.kind === 'troll' ? 8 : 3) + (p.regen ? 5 : 0)); }

/* per-frame hazards during a play: fire, grasping hands, the crater */
function tickHazards(dt) {
  const L = PL; if (!L || !zones().length) return;
  for (const z of zones()) {
    const fx = z.fx;
    if (fx.burn) {
      const scorch = (p, x, y, key) => { if (!zoneAt(z, x, y) || p.ko > 0) return; p.burnAcc = (p.burnAcc || 0) + fx.burn * dt; if (p.burnAcc >= 8) { p.burnAcc -= 8; const first = !L.burnLog?.[p.n]; (L.burnLog = L.burnLog || {})[p.n] = 1; hurt(p, 8, `burned crossing the ${z.name}`, { fire: true, quiet: !first }); } };
      for (const f of L.fielders) scorch(f.p, f.x, f.y);
      for (const r of alive()) { const q = runnerPos(r); scorch(r.p, q.x, q.y); }
    }
    if (fx.grab) for (const r of alive()) { if (!moving(r) || immune(r) || r.fx.roots > 0 || r.grabbed) continue; if (R() < fx.grab * dt) { r.fx.roots = 1.4; r.grabbed = true; addFx('callout', { text: `Grave Hands grab ${shortName(r.p)}!`, col: '#c9e0c0', small: true }); } }
    if (fx.trip) for (const r of alive()) { if (r.tripped || !moving(r)) continue; const q = runnerPos(r); if (zoneAt(z, q.x, q.y)) { r.tripped = true; if (R() < .35) { r.fx.stun = .8; hurt(r.p, fx.trip, 'twisted an ankle in the crater'); } } }
  }
}
// at the start of each play: grave gas
function gasCheck() {
  for (const z of zones()) if (z.fx.gas) for (const f of PL.fielders) {
    if (!zoneAt(z, f.x, f.y) || f.p.ko > 0 || TIRELESS.includes(f.p.kind)) continue;
    const bonus = Math.floor(f.p.pow / 2) + luck(f.p), roll = d20(), ok = roll + bonus >= 13;
    if (!ok) { addRoll(`${shortName(f.p)} breathes the Plague Cloud`, `d20 + ${bonus} ≥ 13`, roll, false, roll + bonus); knockOut(f.p, 2 + ((13 - roll - bonus) > 5 ? 2 : (R() * 2 | 0)), 'overcome by the Plague Cloud'); }
  }
}

