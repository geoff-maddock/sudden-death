/* w47: the feel of football (issue #9, phase 9), as w20f is for baseball. Sound on the gridiron, coach's notes and
   medals.

   Sound. Sudden Death's own effects (sfx), following your Sound effects setting: a whistle at each kickoff (as the ball comes
   down; the game's first is set up before the field shows) and at the half, and at the end of each play a thud for a tackle, a crunch for a sack, a slap for an incompletion, the crowd
   for a big gain, a horn and the crowd for a touchdown or a field goal, and a groan when the ball is lost or the
   other side scores. The realm's music plays on, as it does at any ground.
   Tips. TIPS.w_grid once your team can play football (W_GFG.minOwn players), TIPS.w_gcup once you have won a
   football game, from a watcher like w20f's.
   Achievements. Football games won (realmGridWins) and Cinder Cups (realmGcups), on SD's ACH.

   Wrapped: wGF.onPhase (wW47OnPhase: the sounds), wGridSettle (wW47GridSettle), wGcupWon (wW47GcupWon), renderHelp
   (wW47RenderHelp: #wHelpGfFeel after #wHelpGcup). */

const WGSND = { score: null, ph: null };
// the end of a play (or a kick) on the field, by what happened: { what, gain, mine (your side had the ball) }
function wGridSound(ph) {
  const prev = WGSND.ph; WGSND.ph = ph;
  if (LAB || SET.sfx === false || UI.view !== 'gridiron' || !wGF.G) return;
  const G = wGF.G;
  if (ph === 'half') { sfx.whistle(); return; }
  if (ph === 'pre') { WGSND.score = G.score.slice(); return; }
  if (ph === 'kick') { WGSND.score = G.score.slice(); return; }
  if (ph === 'over') { const s = G.score; if (s[0] > s[1]) { sfx.horn(); sfx.crowd(2); } else if (s[0] < s[1]) sfx.bad(); else sfx.whistle(); return; }
  if (ph !== 'post') return;
  const s0 = WGSND.score || G.score, us = G.score[0] - s0[0], them = G.score[1] - s0[1];
  if (us > 0) { sfx.horn(); sfx.crowd(1.8); return; }
  if (them > 0) { sfx.bad(); return; }
  if (prev === 'kickoff') { sfx.whistle(); return; }
  if (prev === 'kick') return;
  const r = wGF.play && wGF.play.done; if (!r) return;
  if (r.what === 'int') { sfx.bad(); return; }
  if (r.what === 'sack') { sfx.crunch(); return; }
  if (r.what === 'inc') { sfx.block(); return; }
  if (r.what === 'tackle' || r.what === 'out') { if (r.gain >= 10) sfx.crowd(.9); else sfx.hit(.3); }
}
const wW47OnPhase = wGF.onPhase;
wGF.onPhase = ph => { if (wW47OnPhase) wW47OnPhase(ph); try { wGridSound(ph); } catch (e) { console.error(e); } };

Object.assign(TIPS, {
  w_grid: ['Football', 'Your team is big enough for football. Open the Team screen (C), then the Seven tab: set your seven, then Play a game against the local side or a rival club. Clinker Dunn at the Ash Bowl books games too.'],
  w_gcup: ['The Cinder Cup', 'Football has its own cup, every week. Ask Clinker Dunn at the Ash Bowl about the CINDER cup, or use the Cinder Cup button on the Seven tab.'],
});
function wGridTips() {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world') return;
  if (wRoster().length >= W_GFG.minOwn) tip('w_grid');
  if (WG.gfg && WG.gfg.w > 0) tip('w_gcup');
}
setInterval(wGridTips, 700);

ACH.push(
  { id: 'w_grid', n: 'Gridiron Grit', d: 'Win football games on the gridiron', stat: 'realmGridWins', at: [1, 10, 30] },
  { id: 'w_gcup', n: 'Cinder Crown', d: 'Win the Cinder Cup', stat: 'realmGcups', at: [1, 3, 8] },
);
const wW47GridSettle = wGridSettle;
wGridSettle = function (r, us, them, box, half) {
  const m = wW47GridSettle(r, us, them, box, half);
  if (!LAB && r === 'win') achAdd('realmGridWins', 1);
  return m;
};
const wW47GcupWon = wGcupWon;
wGcupWon = function () { wW47GcupWon(); if (!LAB) achAdd('realmGcups', 1); };

const wW47RenderHelp = renderHelp;
renderHelp = function () {
  wW47RenderHelp();
  const d = $('wHelpGcup'); if (!d || $('wHelpGfFeel')) return;
  d.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpGfFeel"><b>On the gridiron</b> you hear the whistle at each kickoff, the hits, and the crowd for a big gain or a score; sounds follow your Sound effects setting, and the realm's music plays on. Football games won and Cinder Cups have medals in the record book.</p>`);
};
