/* w20f: the feel of baseball (issue #4, phase 7). Sound on the diamond, coach's notes and medals.

   Sound. Brimstone Diamond has its own music (a ballpark organ) and sound effects. On the diamond, Sudden Death's
   music stops, and Brimstone Diamond's follow your Music and Sound effects settings (SET.music, SET.sfx); its own
   settings live in memory inside its scope, so they would otherwise always start on.
   Tips. TIPS.w_ball once your team can play ball (W_BALL.minOwn players), TIPS.w_dcup once you have won a ball game,
   from a watcher like w13's.
   Achievements. Ball games won (realmBallWins) and Diamond Cups (realmDcups), on SD's ACH.

   Wrapped: musicSet (wSdMusicSet: quiet on the diamond), showView (wW20fShowView), wBallSettle (wW20fBallSettle),
   wDcupWon (wW20fDcupWon), renderHelp (wW20fRenderHelp: the medals line in #wHelpBall). */

const wSdMusicSet = musicSet;
musicSet = function (theme, mode) {
  if (UI.view === 'diamond') { if (MUS.timer) musicStop(); return; }
  return wSdMusicSet(theme, mode);
};
const wW20fShowView = showView;
showView = function (v) {
  if (v === 'diamond' && !LAB) wBD.audio(SET.music !== false, SET.sfx !== false);
  return wW20fShowView(v);
};

Object.assign(TIPS, {
  w_ball: ['Play ball', 'Your team is big enough for baseball. Open the Team screen (C), then the Nine tab: set the batting order, then Play a game against the local nine or a rival club.'],
  w_dcup: ['The Diamond Cup', 'Baseball has its own cup, every week. Ask Imelda Foss at the League office in Graftonbury about the DIAMOND cup, or use the Diamond Cup button on the Nine tab.'],
});
function wBallTips() {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world') return;
  if (wRoster().length >= W_BALL.minOwn) tip('w_ball');
  if (WG.ball && WG.ball.w > 0) tip('w_dcup');
}
setInterval(wBallTips, 700);

ACH.push(
  { id: 'w_ball', n: 'Play Ball', d: 'Win ball games on the diamond', stat: 'realmBallWins', at: [1, 10, 30] },
  { id: 'w_dcup', n: 'Diamond Cutter', d: 'Win the Diamond Cup', stat: 'realmDcups', at: [1, 3, 8] },
);
const wW20fBallSettle = wBallSettle;
wBallSettle = function (r, us, them, box, inning) {
  const m = wW20fBallSettle(r, us, them, box, inning);
  if (!LAB && r === 'win') achAdd('realmBallWins', 1);
  return m;
};
const wW20fDcupWon = wDcupWon;
wDcupWon = function () { wW20fDcupWon(); if (!LAB) achAdd('realmDcups', 1); };

const wW20fRenderHelp = renderHelp;
renderHelp = function () {
  wW20fRenderHelp();
  const d = $('wHelpDcup'); if (!d || $('wHelpBallFeel')) return;
  d.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpBallFeel"><b>On the diamond</b> the ballpark organ plays instead of the realm's music, and both follow your Music and Sound settings. Ball games won and Diamond Cups have medals in the record book.</p>`);
};
