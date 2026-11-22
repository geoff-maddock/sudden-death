/* Black Ice in the Umbral (issue #99, phase 4e): the Lich, the hexes and a captain's own ultimate. Nothing here runs
   unless a game asks for it: with no hexes and no skill 3, the engine plays exactly as before (same seed, same game).
   The Lich (G.skill 3, above the Archmage; the Realm names it, W_BALL_SKILL[3]: HK_SKILL keeps its three). Everywhere else it is an Archmage (every check of skill >= 2
   holds for it), and on top:
   - its call (hkLichCall): it answers your call at every face-off, not now and then; what beats your systems is worth
     far more to it than to the Archmage and what loses to them far less (HK_LICH.counter), and it leaves a system you
     have scouted (HK_LICH.scouted) rather than let you read it. Its power-play and penalty-kill setups answer yours, its
     Tempo pushes from further out when behind and sits on a lead sooner, and its Edge goes Rough when it is the bigger
     side and a goal or more behind, Clean when ahead.
   - the skater who goes at your carrier goes for where they will be, not where they are (HK_LICH.lead seconds ahead,
     the others' .22: fewer carriers skate round the check); its skaters look harder for the pass across the front
     (HK_LICH.across); its coach changes a line sooner (HK_LICH.tired), so its skaters are fresher; it pulls its goalie
     sooner when behind (HK_LICH.pull) and gives a potion worth HK_LICH.take (HK_KIT.take[3]).
   Hexes (opts.hexes: ids in HK_HEX; G.hex = { ids, on, slide, holes }, plain JSON, so a saved game keeps them). Each
   works against one side, G.hex.on (opts.hexOn, 0 by default: yours):
     holes    The Ice Opens: HK_HEX.holes.n holes of open water in the end that side attacks (new ones each period, as
              the ends swap); a puck sliding free (a pass, a dump, a rebound, a loose one: not a shot in the air) into
              one is swallowed, and the face-off goes back to centre ice
     slide    The Wandering Net: the net that side shoots at slides along its goal line away from the puck, up to
              HK_HEX.slide.max metres either way, at HK_HEX.slide.v metres a second; the goalie goes with it. Shots from
              the wings come at a worse angle (hkNetOff, read by hkShotOdds, hkRelease, hkGoalSpot and hkNets)
     cold     Grave Cold: that side's skaters tire HK_HEX.cold.k times as fast
     whistle  The Hollow Whistle: the referee is the other side's: that side's fouls are called HK_HEX.whistle.k times as
              often (hkFoulK)
   The hexes are named over the opening face-off (the intro beat, and the line under the rink) and under the score bar
   all game; the holes are drawn on the ice and the net is drawn where it has slid.
   A captain's own ultimate: a roster player sent with { ult: id } brings that one (HK_ULT_BY) instead of their kind's
   (hkTeam keeps it, hkUltOptions reads it; HK_ULT_OWN, apart from the kinds' HK_ULT_BY): the Nadir captain's The Long Night is the first. */
const HK_LICH = { counter: [6, .12], change: .9, scouted: .35, across: .13, lead: .4, tired: .55, take: 2.5, pull: 1.6 };
HK_KIT.take[3] = HK_LICH.take;
const HK_HEX = {
  holes: { n: 'The Ice Opens', d: 'Holes of open water in the end you attack, new ones each period: a puck that slides into one is gone, and the face-off goes back to centre ice.', count: 2, r: .9 },
  slide: { n: 'The Wandering Net', d: 'The net you shoot at slides along its goal line away from the puck, and the goalie goes with it: shots from the wings come at a worse angle.', max: 1.8, v: 1.6, k: .4 },
  cold: { n: 'Grave Cold', d: 'The cold of the pond gets into your skaters: they tire 30% faster.', k: 1.3 },
  whistle: { n: 'The Hollow Whistle', d: 'The referee skates for them: your fouls are called twice as often.', k: 2 },
};
// the Nadir captain's own ultimate
HK_ULT_OWN.longnight = hkU0('longnight', 'The Long Night', 'The lamps go out over the pond: their goalie is set late for everything, and they skate as if through deep snow.', { blind: .6, shot: .02 }, { slow: .86 }, 'slot');

/* ---------- the Lich ---------- */
function hkLichCall(side) {
  const C = G.call[side], O = G.call[1 - side], [up, down] = HK_LICH.counter;
  const spd = hkMean(side, 'spd'), siz = hkMean(side, 'siz'), hnd = hkMean(side, 'hnd'), dSht = hkMean(side, 'sht', ['defender']), def = hkMean(side, 'def');
  const lead = hkLead(side), late = hkLate(.45), sizeEdge = siz - hkMean(1 - side, 'siz');
  const wa = { cycle: 1 + (hnd - 6) * .4, rush: 1 + (spd - 6) * .45, dump: .4 + (siz - 6) * .2, point: .6 + (dSht - 6) * .45, crash: .8 + (siz - 6) * .4 };
  const wd = { fore: 1 + (spd - 6) * .35, trap: .9, box: .8 + (siz - 6) * .2, collapse: .7, man: 1 + (def - 6) * .35 };
  if (late && lead < 0) { wa.rush *= 2; wa.crash *= 2.5; wa.dump *= .4; wd.fore *= 3; wd.trap *= .2; wd.collapse *= .3; }
  if (late && lead > 0) { wa.cycle *= 1.5; wd.trap *= 2.5; wd.fore *= .4; }
  for (const a of Object.keys(wa)) { const e = (HK_EDGE[a + '/' + O.def] || [0])[0]; wa[a] = Math.max(.05, wa[a]) * (e > 0 ? up : e < 0 ? down : 1); }
  for (const d of Object.keys(wd)) { const e = (HK_EDGE[O.att + '/' + d] || [0])[0]; wd[d] = Math.max(.05, wd[d]) * (e < 0 ? up : e > 0 ? down : 1); }
  // (a system the other side has read is worth less: it moves on rather than be read)
  if (G.scout[side].n >= 1) wa[C.att] *= HK_LICH.scouted;
  const pp = Object.keys(HK_PP).map(k => [k, (HK_EDGE_PP[k + '/' + O.pk] || [0])[0]]).sort((a, b) => b[1] - a[1])[0], pk = Object.keys(HK_PK).map(k => [k, (HK_EDGE_PP[O.pp + '/' + k] || [0])[0]]).sort((a, b) => a[1] - b[1])[0];
  C.pp = pp[0]; C.pk = pk[0];
  if (R() < HK_LICH.change || late) { C.att = wpick(wa); C.def = wpick(wd); }
  C.tempo = late && lead < 0 ? 'push' : hkLate(.2) && lead > 0 ? 'sit' : 'bal';
  C.edge = lead > 0 && hkLate(.45) ? 'clean' : lead < 0 && sizeEdge > .5 ? 'rough' : 'bal';
}

/* ---------- the hexes ---------- */
function hkHexStart(ids, on) {
  const hx = (ids || []).filter((k, i, a) => HK_HEX[k] && a.indexOf(k) === i); if (!hx.length) { G.hex = null; return; }
  G.hex = { ids: hx, on: on === 1 ? 1 : 0, slide: 0, holes: [] };
  hkHexHoles();
}
const hkHexHas = id => !!(G && G.hex && G.hex.ids.includes(id));
const hkHexOn = (id, side) => hkHexHas(id) && side === G.hex.on;
// the holes for this period: in the end G.hex.on attacks, between its blue line and the goal line, clear of the crease
function hkHexHoles() {
  if (!hkHexHas('holes')) return;
  const H = HK_HEX.holes, on = G.hex.on, out = [];
  for (let k = 0; k < 40 && out.length < H.count; k++) {
    const u = HK_RULES.len - HK_RULES.goal - 1.5 - R() * (HK_RULES.blue - HK_RULES.goal - 2.5), v = (R() - .5) * (HK_RULES.wid - 4), [x, y] = hkAt(on, u, v);
    if (hyp(x - hkGoalX(on), y) < 3.2 || out.some(h => hyp(h.x - x, h.y - y) < 3)) continue;
    out.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, r: H.r });
  }
  G.hex.holes = out;
}
// how far side's net (the one side defends) has slid off the middle of its goal line
const hkNetOff = side => G && G.hex && G.hex.slide && side === 1 - G.hex.on ? G.hex.slide : 0;
// the same, for the net whose goal line is near x (the nets' boxes, 05-live.js)
function hkNetOffX(x) { if (!G || !G.hex || !G.hex.slide) return 0; const d = 1 - G.hex.on; return (hkGoalX(1 - d) < HK_RULES.len / 2) === (x < HK_RULES.len / 2) ? G.hex.slide : 0; }
const hkHexTire = side => hkHexOn('cold', side) ? HK_HEX.cold.k : 1;
// how often side's fouls are called: its Edge, and the Hollow Whistle
const hkFoulK = side => hkEdgeSt(side).foul * (hkHexOn('whistle', side) ? HK_HEX.whistle.k : 1);
// each step: the net slides away from the puck
function hkHexStep(dt) {
  if (!hkHexHas('slide')) return;
  const S = HK_HEX.slide, P = L.puck, tgt = clamp(-P.y * S.k, -S.max, S.max), d = tgt - G.hex.slide;
  G.hex.slide = Math.abs(d) <= S.v * dt ? tgt : G.hex.slide + Math.sign(d) * S.v * dt;
}
// a free puck in a hole is swallowed: a face-off at centre ice. True: play has stopped
function hkHexHole(P) {
  if (!hkHexHas('holes') || GD.ph !== 'live' || P.st !== 'free' || P.k === 'shot' || P.k === 'in') return false;
  const h = G.hex.holes.find(o => hyp(P.x - o.x, P.y - o.y) < o.r); if (!h) return false;
  if (GD.delay) { hkPenaltyCall(); return true; }
  hkEv('hole', G.teams[G.hex.on].name);
  hkWhistle(HK_RULES.len / 2, 0, 'The ice opens and swallows the puck. The face-off goes back to centre ice.', 'hole', HK_PACE.dead);
  return true;
}
// a break between periods: new holes at the new end, and the net back in the middle
function hkHexBreak() { if (!G.hex) return; G.hex.slide = 0; hkHexHoles(); }
const hkHexNames = () => G && G.hex ? G.hex.ids.map(k => HK_HEX[k].n).join(', ') : '';
const hkHexLine = () => G && G.hex ? '☾ Hexes: ' + G.hex.ids.map(k => HK_HEX[k].n).join('  ·  ') : '';
// the holes on the ice: black water with a pale rim of broken ice
function hkHexDrawIce(c) {
  if (!G.hex || !G.hex.holes.length) return;
  c.save();
  for (const h of G.hex.holes) {
    const p = hkScr(h.x, h.y), rx = h.r * HK_PX, ry = h.r * HK_PY;
    c.fillStyle = 'rgba(214,226,236,.9)'; c.beginPath(); c.ellipse(p.x, p.y, rx * 1.18, ry * 1.18, 0, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(p.x, p.y, 1, p.x, p.y, rx); g.addColorStop(0, '#05080c'); g.addColorStop(.8, '#0e1a26'); g.addColorStop(1, '#2a3f52');
    c.fillStyle = g; c.beginPath(); c.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(200,184,255,.55)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(p.x, p.y, rx * .6, ry * .6, Math.sin(HKT.t * .7) * .4, 0, Math.PI * 2); c.stroke();
  }
  c.restore();
}
// the line under the score bar (under the power-play pill when there is one)
function hkHexDrawHud(c, y) {
  if (!G.hex) return;
  const t = hkHexLine(); c.save(); c.font = `700 12px ${HK_FONT}`; const w = c.measureText(t).width + 20;
  rr(c, 480 - w / 2, y, w, 19, 5); c.fillStyle = 'rgba(30,18,44,.86)'; c.fill(); c.restore();
  txt(c, t, 480, y + 13.5, `700 12px ${HK_FONT}`, '#c8b8ff', 'center');
}
// the goalie stands in front of the net where it has slid to (wraps 05-live.js's hkGoalSpot, saved as hkGoalSpot0)
const hkGoalSpot0 = hkGoalSpot;
hkGoalSpot = function (side, px, py) { const oy = hkNetOff(side); if (!oy) return hkGoalSpot0(side, px, py); const s = hkGoalSpot0(side, px, py - oy); return [s[0], s[1] + oy]; };
