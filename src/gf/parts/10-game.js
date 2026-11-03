/* Cinder Gridiron: a full game (issue #9, phase 2). Two halves on a game clock, drive after drive, both sides.
   The clock (GF_RULES.half game seconds a half) runs through each play and a runoff between plays (GF_RULES.runoff),
   and stops on an incompletion, out of bounds, a score or a change of possession, as in real football. A game takes
   6 to 8 minutes to watch (question 1). A half ends when its clock runs out after a play; the drive on the field ends
   there. After a touchdown the extra point is kicked at once; after any score the side that scored kicks off, and the
   other side returns it. The second half opens with a kickoff the other way. A tie at the end goes to Sudden Death: a
   short extra period, and the first score wins it. Still tied when that runs out, the game is a tie.
   In 'call' mode you call your side's plays on offense and its defense when the other side has the ball.
   G gains { half (1, 2, 3 for Sudden Death), clock, recv (who took the opening kick), drives: [past drives] }. */
const GF_GAME = { half: 360, runoff: 15, ot: 180, pat: .94 };
const GF_HALF_NAME = ['', '1st half', '2nd half', 'Sudden Death'];

function gfStartGame(opts) {
  const o = opts || {};
  gfStart(o);
  Object.assign(G, { half: 1, clock: GF_GAME.half, recv: R() < .5 ? 0 : 1, drives: [] });
  GD.game = true;
  gfKickoffTo(G.recv);
  return G;
}
// the clock after a play: the play's own time, and the runoff unless the clock stopped
function gfRunClock(what, t) {
  if (!GD || !GD.game) return;
  const stop = ['inc', 'out', 'td', 'int', 'safety'].includes(what) || G.drive.end;
  G.clock = Math.max(0, G.clock - Math.round(t + (stop ? 0 : GF_GAME.runoff)));
}
function gfClockText() { const s = Math.max(0, Math.ceil(G.clock)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
// after a touchdown, the extra point
// (side: who scored; by default the side that just gave the ball up, as after a touchdown it has)
function gfExtraPoint(side) {
  if (!GD.game) return '';
  const s = side != null ? side : 1 - G.poss, k = G.teams[s].roster[G.teams[s].kicker], good = R() < clamp(GF_GAME.pat + (k.r.kck - 5) * .01, .5, .99);
  if (good) G.score[s]++;
  gfBoxAdd(s, G.teams[s].kicker, 'xpa'); if (good) gfBoxAdd(s, G.teams[s].kicker, 'xpm');
  return good ? ' Extra point good.' : ' The extra point is no good.';
}
// side receives a kickoff: the kickoff is its own beat, then a new drive from wherever the return ends
function gfKickoffTo(side) { G.poss = side; GD.kickoff = side; gfGo('kickoff'); }
function gfKickoff() {
  const side = GD.kickoff, T = G.teams[side], ret = gfOnField(side).map(i => T.roster[i]).reduce((b, p) => p.r.spd > b.r.spd ? p : b);
  G.poss = side; G.ball = Math.round(clamp(16 + ret.r.spd * 1.3 + gauss() * 6, 8, 45)); gfFirstDown(); GD.kickoff = null;
  GD.msg = `${ret.n} returns the kickoff to the ${gfSpotName(G.ball)}.`; GD.why = `${T.name} has the ball.`;
  gfNewDrive();
}
function gfNewDrive() { G.drive = { side: G.poss, from: G.ball, plays: [], end: null, yards: 0, half: G.half }; L = null; GD.kick = null; GD.pick = null; GD.pow = null; GD.big = null; if (G.zones) G.zones = []; gfPowersDrive(); }
/* a drive is over (or the clock ran out on it): true when the game goes on, false when it is over. Puts the next beat on:
   a kickoff after a score or a new half, halftime, or the next drive the other way. */
function gfGameNext() {
  const d = G.drive, scored = ['td', 'fg', 'safety', 'fumtd'].includes(d.end);
  G.drives.push(d);
  // Sudden Death: the first score wins
  if (G.half === 3 && scored) return false;
  if (G.clock <= 0) {
    if (G.half === 1) { G.half = 2; G.clock = GF_GAME.half; gfHalfRest(); gfPowersHalf(); GD.msg = `Halftime: ${gfScoreLine()}.`; GD.why = ''; GD.next = 1 - G.recv; gfGo('half'); return true; }
    if (G.score[0] !== G.score[1] || G.half === 3) return false;
    G.half = 3; G.clock = GF_GAME.ot; gfPowersHalf(); GD.msg = `Tied at ${G.score[0]}: Sudden Death. The first score wins.`; GD.why = ''; GD.next = G.recv; gfGo('half'); return true;
  }
  // after a score the other side receives: the side that scored kicks off, and after a safety the side scored on
  // (the drive's offense either way), and after a fumble run back for a touchdown the defense kicks to the drive's
  // offense; otherwise the ball has already changed hands
  if (scored) { gfKickoffTo(d.end === 'fumtd' ? d.side : 1 - d.side); return true; }
  gfNewDrive(); gfGo('call'); return true;
}
function gfScoreLine() { return G.teams.map((t, s) => `${t.name} ${G.score[s]}`).join(', '); }
function gfFinalLine() {
  const [a, b] = G.score;
  return a === b ? `Final: a tie, ${a} to ${b}.` : `Final: ${G.teams[a > b ? 0 : 1].name} win ${Math.max(a, b)} to ${Math.min(a, b)}${G.half === 3 ? ' in Sudden Death' : ''}.`;
}
function gfGameSummary() {
  const all = G.drives.flatMap(d => d.plays);
  return { score: G.score.slice(), teams: G.teams.map(t => t.name), drives: G.drives.length, plays: all.length, half: G.half,
    ends: G.drives.reduce((m, d) => (m[d.end] = (m[d.end] || 0) + 1, m), {}), stance: [gfStanceMost(0), gfStanceMost(1)] };
}
// a whole game at once, CPU against CPU, through the same flow; secs is the time it would take to watch
// (opts.keep: put the game that was on the field back afterwards, for a game simulated while another is being played)
function gfSimGame(opts) {
  const hooks = Object.assign({}, GF_HOOK), was = opts && opts.keep ? { G, GD, L, rand: gfRand } : null;
  GF_HOOK.onOver = GF_HOOK.onPhase = GF_HOOK.onSnap = null;
  let secs = 0, out;
  try {
    gfStartGame(Object.assign({}, opts, { mode: 'watch' })); for (let i = 0; i < 400000 && GD.ph !== 'over'; i++) { gfTick(GF_DT * 10); secs += GF_DT * 10; }
    out = Object.assign(gfGameSummary(), { secs: Math.round(secs), box: gfBox() });
  } finally { Object.assign(GF_HOOK, hooks); if (was) { G = was.G; GD = was.GD; L = was.L; gfRand = was.rand; } }
  return out;
}
