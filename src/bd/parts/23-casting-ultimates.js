/* ================= casting ultimates ================= */
const ultUsed = (team, p) => !!(team.ultUsed && team.ultUsed[p.n]);
function markUlt(team, p, id) {
  abUse(p, id);
  (team.ultUsed = team.ultUsed || {})[p.n] = true;
  team.mana -= abCost(p, id); drain(p, ULT_STAM, 'spell', 'ult');
  useTag('ult', `${shortName(p)}: ${AB[id].name}`);
  banner(ULT[id].name, `${p.n} · ${AB[id].desc.split('. ')[0]}.`, 1.8);
  sfx.magic(); G.shake = Math.max(G.shake, .2); musicSting('rally');
}
function ultOption(p, team, role) {
  if (!p || !p.ult || ULT[p.ult].role !== role || ultUsed(team, p)) return null;
  return { id: p.ult, cost: abCost(p, p.ult) };
}
// batting stance: triggers at release, whatever happens to the pitch
function castBatUlt(bat, id) { const bt = BT(); markUlt(bt, bat, id); addZone(id, null, G.half); }
// pitch: blizzard at release; inferno arms the ball
function castPitchUlt(pt, id, pc) { const ft = FT(); (ft.ultUsed = ft.ultUsed || {})[pt.n] = true; useTag('ult', `${shortName(pt)}: ${AB[id].name}`); drain(pt, ULT_STAM, 'spell', 'ult'); banner(ULT[id].name, `${pt.n} · ${AB[id].desc.split('. ')[0]}.`, 1.6); G.shake = Math.max(G.shake, .15); if (id === 'blizzard') addZone(id, null, 1 - G.half); else pc.inferno = true; }
function castRunUlt(o, r) {
  const L = PL, bt = BT();
  if (!o || !o.ok || !r) { if (isHuman(bt)) tone(140, .1, 'square', .04); return false; }
  markUlt(bt, r.p, o.id);
  const here = runnerPos(r);
  if (o.id === 'stampede') {
    r.fx.spd = { t: 2, m: 2 }; r.fx.untag = 2; r.manual = true; sendForward(r);
    for (const f of L.fielders) { const d = hyp(f.x - here.x, f.y - here.y); if (d < 40 && !(f.p.ko > 0)) { f.stun = Math.max(f.stun, 1.2); if (R() < .5) hurt(f.p, 18, `trampled by ${r.p.n}`); } }
    addZone('stampede', here, G.half); addFx('ring', { x: here.x, y: here.y, col: '#8a5a34', r: 0, max: 120 });
  } else if (o.id === 'bonestorm') {
    const nb = Math.min(4, Math.floor(r.s + .02) + 1);
    if (!occupiedAhead(r, nb) && !r.mustReturn) { addFx('puff', { ...here, col: '#efe6cf' }); r.s = nb; r.target = Math.max(r.target, nb); r.manual = true; addFx('puff', { ...runnerPos(r), col: '#efe6cf' }); }
    addZone('bonestorm', null, G.half);
  } else addZone(o.id, null, G.half);
  return true;
}
function castFieldUlt(o) {
  const ft = FT();
  if (!o.ok) { if (isHuman(ft)) tone(140, .1, 'square', .04); return; }
  markUlt(ft, o.f.p, o.ab); addZone(o.ab, null, 1 - G.half);
  if (o.ab === 'crater') { G.shake = .6; addFx('ring', { x: BASE[3].x, y: BASE[3].y, col: '#6a5a3a', r: 0, max: 160 }); for (const r of alive()) { const q = runnerPos(r); if (hyp(q.x - BASE[3].x, q.y - BASE[3].y) < 30 && !immune(r)) r.fx.stun = 1; } }
}
// list entries for the running and fielding panels
function runUltEntry(r) {
  const L = PL, bt = BT(), u = r && ultOption(r.p, bt, 'run'); if (!u) return null;
  const still = settled(r), ok = bt.mana >= u.cost && !still && !L.homer && L.endT === null;
  return { id: u.id, own: true, ult: true, cost: u.cost, ok, why: bt.mana < u.cost ? 'need mana' : still ? 'runner standing' : '' };
}
function fieldUltEntries() {
  const L = PL, ft = FT(), out = [];
  for (const f of L.fielders) { const u = ultOption(f.p, ft, 'field'); if (!u) continue; const ok = ft.mana >= u.cost && f.stun <= 0 && !L.homer && L.endT === null; out.push({ f, ab: u.id, ult: true, cost: u.cost, ok, why: ft.mana < u.cost ? 'need mana' : f.stun > 0 ? 'dazed' : '' }); }
  return out;
}

