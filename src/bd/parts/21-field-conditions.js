/* ================= field conditions (zones left by ultimates) ================= */
// G.zones: { id, name, fx (the ULT zone spec), x, y, r, turns, side, seed }
function zoneAt(z, x, y, who) {
  const s = z.fx.shape;
  if (s === 'global') return true;
  if (s === 'paths') return who === 'runner';
  if (s === 'infield') return hyp(x, y - 60) < 100;
  if (s === 'outfield') return hyp(x, y) > 150 && y > 0;
  return hyp(x - z.x, y - z.y) < z.r;
}
const zones = () => (G.zones || []);
function zoneMult(key, x, y, who) { let m = typeof skyMod === 'function' && MOON ? skyMod(key) : 1; for (const z of zones()) if (z.fx[key] != null && zoneAt(z, x, y, who)) m *= z.fx[key]; return m; }
function zoneAdd(key, x, y, who) { let a = 0; for (const z of zones()) if (z.fx[key] != null && zoneAt(z, x, y, who)) a += z.fx[key]; return a; }
const zoneOn = key => zones().some(z => z.fx[key]);
function fenceH() { let h = FENCE_H; for (const z of zones()) if (z.fx.fence) h = Math.max(h, z.fx.fence); return h; }
function carryK() { let k = typeof skyMod === 'function' && MOON ? skyMod('carry') : 1; for (const z of zones()) if (z.fx.carry) k *= z.fx.carry; return k; }
function addZone(id, at, side) {
  const u = ULT[id]; if (!u) return;
  G.zones = (G.zones || []).filter(z => z.id !== id);
  const z = { id, name: u.name, fx: u.zone, turns: ULT_TURNS, side, seed: R() * 1000, x: 0, y: 0, r: u.zone.r || 0, born: G.time };
  if (u.zone.base != null) { z.x = BASE[u.zone.base].x; z.y = BASE[u.zone.base].y; }
  if (at) { z.x = at.x; z.y = at.y; }
  G.zones.push(z);
  logLine(`The ${u.name} takes hold of the field for ${ULT_TURNS} at-bats (or until the half-inning ends).`);
}
// at every new batter: zones and knockouts count down
function tickTurns() {
  for (const z of zones()) z.turns--;
  const gone = zones().filter(z => z.turns <= 0); if (gone.length) { G.zones = zones().filter(z => z.turns > 0); for (const z of gone) addFx('callout', { text: `${z.name} fades`, col: '#c9c2ad', small: true }); }
  for (const t of G.teams) for (const p of [...t.def.roster, ...t.pen]) if (p.ko > 0) { p.ko--; if (p.ko === 0) { p.hp = Math.max(p.hp, 35); logLine(`${p.n} comes to and is back in the game (health ${Math.round(p.hp)}).`); } }
}
function clearZones() { if (zones().length) G.zones = []; }

