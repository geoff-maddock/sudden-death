/* Cinder Gridiron: box scores, and a game to save and come back to (issue #9, phase 5).
   The box: every play adds to the lines of the players in it, by side and roster index (G.box = [[line], [line]]).
   A line counts passing (pa attempts, pc completions, py yards, ptd touchdowns, pint interceptions thrown, sacked),
   running (ra carries, ry yards), catching (rec, recy), touchdowns scored (td), defense (tkl tackles, sk sacks, ints
   interceptions) and kicking (fga, fgm field goals tried and made, xpa, xpm extra points).
   The snapshot: between plays, at each call, the game is G and GD as plain JSON, and GF_HOOK.onSnap hears it. A saved
   game comes back on the field at that call (gfResume): the play that was running is played again. */
function gfBoxStart() { G.box = G.teams.map(t => t.roster.map(() => ({}))); }
function gfBoxAdd(side, ri, k, n) { if (!G.box || ri == null || ri < 0 || !G.box[side][ri]) return; const b = G.box[side][ri]; b[k] = (b[k] || 0) + (n == null ? 1 : n); }
// a play is over: off had the ball; r is the play's end (L.done)
function gfBoxPlay(off, r) {
  if (!L || !G.box) return;
  const def = 1 - off, ri = i => i >= 0 && L.pl[i] ? L.pl[i].ri : -1, qb = ri(L.id.QB), by = ri(r.byi), car = ri(r.ci);
  const caught = L.ev.some(e => e.k === 'catch'), td = r.what === 'td';
  if (L.thrown) {
    gfBoxAdd(off, qb, 'pa');
    if (r.what === 'int') { gfBoxAdd(off, qb, 'pint'); gfBoxAdd(def, by, 'ints'); }
    else if (caught) { gfBoxAdd(off, qb, 'pc'); gfBoxAdd(off, qb, 'py', r.gain); gfBoxAdd(off, car, 'rec'); gfBoxAdd(off, car, 'recy', r.gain); if (td) { gfBoxAdd(off, qb, 'ptd'); gfBoxAdd(off, car, 'td'); } }
  } else if (r.what === 'sack') { gfBoxAdd(off, qb, 'sacked'); gfBoxAdd(def, by, 'sk'); }
  else if (car >= 0) { gfBoxAdd(off, car, 'ra'); gfBoxAdd(off, car, 'ry', r.gain); if (td) gfBoxAdd(off, car, 'td'); }
  if ((r.what === 'tackle' || r.what === 'sack') && by >= 0) gfBoxAdd(def, by, 'tkl');
}
// the box as lines with names: [{ side, ri, n, kind, line }]
function gfBox() { return G && G.box ? G.box.flatMap((b, s) => b.map((line, ri) => ({ side: s, ri, n: G.teams[s].roster[ri].n, kind: G.teams[s].roster[ri].kind, line: Object.assign({}, line) }))) : []; }
function gfSnapshot() {
  const D = Object.assign({}, GD, { ph: 'call', t: 0, pick: null, meter: null, stale: null, kick: null, acc: 0 });
  return JSON.parse(JSON.stringify({ G, GD: D }));
}
function gfResume(sn) {
  const s = JSON.parse(JSON.stringify(sn));
  G = s.G; GD = s.GD; L = null; gfSeed(null);
  return G;
}
