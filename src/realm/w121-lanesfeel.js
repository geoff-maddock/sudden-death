/* w121: the feel of bowling (issue #100, phase 11), as w111 is golf's. Sound at the Lanes, tips and medals.

   Sound. Built from Sudden Death's own tone and noise (src/app/sound.js), following your Sound effects setting, only
   while the lanes are on screen, from the page's beats (wBL.onPhase) and the end (wBL.onOver):
   - the ball released: the roll on the wood, as long as the ball takes down the lane (wBL.anim.tLane, at the game's
     speed), and when it gets there the pins: a crash for a strike, a clatter by how many fell, a dull thunk in the
     gutter;
   - the pins at rest: the gallery for a strike (louder for a double, a turkey and on), a bright pair of notes for a
     spare or a split made, a low note for a split left, and the ring of a lone corner pin that won't fall (the 10, or
     the 7 for a left-hander's ball);
   - the sea under the floor: a soft swell every few seconds, louder at high tide;
   - the end: the horn and the gallery when you win (or at the end of a game you only watch), a low note when you lose.
   The ground's own tune plays on this view (w160), as on the ground's map (the Lanes' own track, Strike Lamps, is w26's).
   Tips. TIPS.w_lanes once your team can bowl (W_LNG.minOwn players), TIPS.w_gutter once you have won a bowling match.
   Medals, on SD's ACH, from matches from the world (exhibitions and practice don't count): bowling matches won
   (realmLanesWins), Gutter Cups (realmGutters), a turkey by your side (realmTurkeys), a clean game, every frame a mark
   (realmCleanGames), the 7-10 converted (realmSevenTens), and a 300 (realmPerfect).

   wLanesTurkey(marks), wLanesClean(marks): from a side's sheet ({ game: [{ b: ['X'] | ['7', '/'] | ... }] })
   Wraps: wBL.onPhase (wW121OnPhase: the sounds), wBL.onOver (wW121OnOver: the end), wLanesSettle
   (wW121LanesSettle: the medals), wGutterWon (wW121GutterWon), renderHelp (wW121RenderHelp: #wHelpLanesFeel after
   #wHelpLanesCup). */

const wLanesSoundOn = () => !LAB && SET.sfx !== false && UI.view === 'lanes' && !!wBL.G && !!wBL.G.teams;
const W_LANES_SND = { roll: [140, .1], crash: [900, .5], sea: 3600 };
// the roll and, when the ball gets there, the pins: scheduled together, at the game's speed
function wLanesRollSound() {
  const A = wBL.anim, L = wBL.last; if (!A || !L) return;
  const sp = Math.max(1, wBL.speed || 1), d = A.tLane / sp, R = L.roll, n = (L.down || []).length;
  noise(d, W_LANES_SND.roll[1], W_LANES_SND.roll[0], .6); noise(d, .04, 380, .9);
  if (L.ball && L.ball.gutter != null) { noise(.25, .12, 180, .8, d * .55); return; }
  if (R.strike) { noise(.55, W_LANES_SND.crash[1], W_LANES_SND.crash[0], .6, d); noise(.4, .3, 2300, 1, d + .02); tone(140, .25, 'sine', .1, -60, d); }
  else if (n) { noise(.18 + n * .02, .12 + n * .03, 1300, .9, d); for (let i = 0; i < Math.min(4, n); i++) noise(.05, .12, 2400 + i * 260, 3, d + .05 + i * .06); }
}
function wLanesRestSound() {
  const L = wBL.last, V = wBL.view; if (!L || !V) return;
  const R = L.roll, mine = L.side === V.you;
  if (R.strike) { const st = (V.streak || [])[L.side] || 1; sfx.crowd(mine ? 1 + Math.min(3, st) * .5 : .6); if (mine && st >= 3) sfx.crit(); return; }
  if (R.spare) { if (mine) sfx.coin(); else sfx.card(); return; }
  if (R.split) { tone(196, .35, 'triangle', .06, -40); return; }
  // a lone corner pin left on a first ball: it rings, and stays up
  const st = wBL.standing(L.side);
  if (R.n === 9 && st.length === 1 && (st[0] === 10 || st[0] === 7)) { tone(1480, .9, 'sine', .05); tone(2220, .7, 'sine', .025, 0, .02); }
}
// the sea under the floor, now and then
setInterval(() => { if (!wLanesSoundOn() || (wBL.paused)) return; const hi = wBL.G.tide === 'high'; noise(3.2, hi ? .045 : .025, 220, .5, 0, 160); }, W_LANES_SND.sea);
const wW121OnPhase = wBL.onPhase;
wBL.onPhase = ph => {
  if (wW121OnPhase) wW121OnPhase(ph);
  try { if (!wLanesSoundOn()) return; if (ph === 'roll') wLanesRollSound(); else if (ph === 'rest') wLanesRestSound(); } catch (e) { console.error(e); }
};
const wW121OnOver = wBL.onOver;
wBL.onOver = s => {
  if (wW121OnOver) wW121OnOver(s);
  try { if (!wLanesSoundOn() || !s) return;
    if (!(WBL && WBL.world)) { sfx.horn(); sfx.crowd(1.4); return; }
    if (s.win === wBL.view.you) { sfx.horn(); sfx.crowd(2); } else sfx.bad(); } catch (e) { console.error(e); }
};

Object.assign(TIPS, {
  w_lanes: ['Bowling', 'Your team is big enough for bowling. Open the Team screen (C), then the Lanes tab: set your five and their order, then Bowl a match against the local side or a rival club. Moll Gutter at the Saltmere Lanes books matches too: ask for a MATCH.'],
  w_gutter: ['The Gutter Cup', 'Bowling has its own cup, every week. Ask Moll Gutter at the Saltmere Lanes about the CUP, or use the Gutter Cup button on the Lanes tab. The final is best of three.'],
});
function wLanesTips() {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world') return;
  if (wRoster().length >= W_LNG.minOwn) tip('w_lanes');
  if (WG.lng && WG.lng.w > 0) tip('w_gutter');
}
setInterval(wLanesTips, 700);

ACH.push(
  { id: 'w_lanes', n: 'Pin Pals', d: 'Win bowling matches at the Saltmere Lanes', stat: 'realmLanesWins', at: [1, 10, 30] },
  { id: 'w_gutter', n: 'Gutter Keepers', d: 'Win the Gutter Cup', stat: 'realmGutters', at: [1, 3, 8] },
  { id: 'w_turkey', n: 'Talking Turkey', d: 'Your side bowls three strikes in a row in a bowling match', stat: 'realmTurkeys', at: [1, 5, 20] },
  { id: 'w_clean', n: 'Clean Sheet', d: 'Your side marks every frame of a ten-frame bowling match', stat: 'realmCleanGames', at: [1, 3, 10] },
  { id: 'w_seventen', n: 'The Impossible', d: 'Convert the 7-10 split in a bowling match', stat: 'realmSevenTens', at: [1, 2, 5] },
  { id: 'w_perfect', n: 'Three Hundred', d: 'Bowl a perfect game: twelve strikes, 300', stat: 'realmPerfect', at: [1, 2, 3] },
);
// a side's sheet: the longest run of strikes, and whether every frame was a mark
function wLanesTurkey(marks) { let run = 0, best = 0; for (const f of (marks && marks.game) || []) for (const b of f.b) { if (b === 'X') { run++; best = Math.max(best, run); } else run = 0; } return best; }
function wLanesClean(marks) { const g = (marks && marks.game) || []; return g.length === 10 && g.every(f => f.b.includes('X') || f.b.includes('/')); }
const wW121LanesSettle = wLanesSettle;
wLanesSettle = function (sum) {
  const S = sum || {}, m = wW121LanesSettle.apply(this, arguments);
  if (LAB || S.text === 'conceded') return m;
  const M = (S.marks || [])[0];
  if (S.win === 0) achAdd('realmLanesWins', 1);
  if (wLanesTurkey(M) >= 3) achAdd('realmTurkeys', 1);
  if (wLanesClean(M)) achAdd('realmCleanGames', 1);
  const st = (S.st || [])[0]; if (st && st.sevenTenMade) achAdd('realmSevenTens', st.sevenTenMade);
  if (M && M.game.length === 10 && (S.game || [])[0] === 300) achAdd('realmPerfect', 1);
  return m;
};
const wW121GutterWon = wGutterWon;
wGutterWon = function () { wW121GutterWon(); if (!LAB) achAdd('realmGutters', 1); };

const wW121RenderHelp = renderHelp;
renderHelp = function () {
  wW121RenderHelp();
  const d = $('wHelpLanesCup'); if (!d || $('wHelpLanesFeel')) return;
  d.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLanesFeel"><b>At the lanes</b> you hear the ball roll down the wood and the pins when it gets there (a crash for a strike), the gallery for a strike (louder for a double and a turkey), a bright pair of notes for a spare, the ring of a lone corner pin that won't fall, and the sea under the floor; sounds follow your Sound effects setting, and the ground's own tune plays. Bowling matches won, Gutter Cups, a turkey, a clean game, the 7-10 converted and a 300 have medals in the record book.</p>`);
};
