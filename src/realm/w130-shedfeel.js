/* w130: the feel of curling (issue #102, phase 11), as w121 is bowling's. Sound at the Shed, tips, medals and the Quick
   start.

   Sound. Built from Sudden Death's own tone and noise (src/app/sound.js), following your Sound effects setting, only
   while the Shed is on screen, from the page's beats (wCR.onPhase), a short beat of our own while a stone slides, and
   the end (wCR.onOver):
   - a stone sliding: the granite's low rumble on the pebble, a clack each time it hits another stone (the clacks the
     run has counted), and the brooms' brush while it is swept;
   - the skip's call: "Hurry hard!" (two quick, rising notes over a shout of noise) and "Whoa!" (one falling note) as
     the call changes;
   - an end scored: the gallery when your rink scores (louder for two or more, and for a steal), a low note when they
     do, a soft chime for a blank;
   - the end of a game: the horn and the gallery when you win (or at the end of a game you only watch), a low note
     when you lose; your skip's call is heard on your own stones only.
   The realm's music plays on, as at any ground (the Shed's own track is w26's).
   Tips. TIPS.w_shed once your team can curl (W_SHG.minOwn players), TIPS.w_broom once you have won a curling match.
   Medals, on SD's ACH, from matches from the world (exhibitions and practice don't count; a conceded one doesn't):
   curling matches won (realmShedWins), Brass Brooms (realmBrooms), an end stolen by your rink (realmSteals), four or
   more in an end (realmFourEnders), and a draw to the button, a draw that comes to rest on the button itself
   (realmButtons, the engine's box score: st.buttons).
   The Quick start: curling's three steps are w112's (it loads after every sport: shed-aim, shed-weight, shed-sweep, the
   screenshots from test/realm_quick_shots.py), with its button beside How to play under the ice.
   wShedSlideBeat() one beat of a sliding stone's sound (the timer's), wShedEndSound() an end scored
   Wraps: wCR.onPhase (wW130OnPhase: the sounds), wCR.onOver (wW130OnOver: the end), wShedSettle (wW130ShedSettle: the
   medals), wBroomWon (wW130BroomWon), renderHelp (wW130RenderHelp: #wHelpShedFeel after #wHelpShedCup). */

const wShedSoundOn = () => !LAB && SET.sfx !== false && UI.view === 'shed' && !!wCR.G && !!wCR.G.teams;
const W_SHED_SND = { beat: 220, rumble: [110, .05], brush: [3200, .03] };
// (hits: the sliding stone's clacks so far, with the stone they belong to; end: the stone that ended the last end heard,
// with its game)
const WSHS = { hits: 0, stone: null, call: '', end: null };
// a stone sliding: the rumble, a clack for each new hit, and the brooms while it is swept (a beat, on a timer)
function wShedSlideBeat() {
  if (!wShedSoundOn() || wCR.paused || wCR.phase !== 'slide') return;
  const b = W_SHED_SND.beat / 1000, G = wCR.G;
  // (a new stone: its own hits from nothing)
  if (!WSHS.stone || WSHS.stone.g !== G || WSHS.stone.n !== G.n) { WSHS.stone = { g: G, n: G.n }; WSHS.hits = 0; }
  noise(b * 1.1, W_SHED_SND.rumble[1], W_SHED_SND.rumble[0], .5);
  const h = wCR.slideHits; if (h > WSHS.hits) { for (let i = 0; i < Math.min(3, h - WSHS.hits); i++) { noise(.06, .22, 2600, 2.5, i * .05); tone(520, .08, 'square', .05, -120, i * .05); } WSHS.hits = h; }
  if (wCR.sweep || wCR.slideSwept) noise(b, W_SHED_SND.brush[1], W_SHED_SND.brush[0], 1.2);
  // your skip's call, as it changes, on your own stones only
  const c = wCR.view && wCR.slideSide === wCR.view.you ? wCR.view.call || '' : '';
  if (c !== WSHS.call) { if (/Hurry/.test(c)) { noise(.18, .06, 900, .7); tone(392, .1, 'triangle', .07); tone(523, .14, 'triangle', .07, 0, .11); } else if (/Whoa/.test(c)) tone(330, .25, 'triangle', .06, -80); WSHS.call = c; }
}
setInterval(wShedSlideBeat, W_SHED_SND.beat);
// an end scored, from the stone that ended it
function wShedEndSound() {
  const L = wCR.last, V = wCR.view; if (!L || !V || !L.rule || !L.rule.end) return;
  const e = L.rule.end, G = wCR.G; if (WSHS.end && WSHS.end.g === G && WSHS.end.n === G.n) return; WSHS.end = { g: G, n: G.n };
  if (e.s < 0) { tone(880, .4, 'sine', .03); return; }
  // (a steal: scored by the side without the hammer; the stone's record says who had it)
  const mine = e.s === V.you, steal = L.ham != null && e.s !== L.ham;
  if (mine) { sfx.crowd(1 + Math.min(3, e.n - 1) * .4 + (steal ? .6 : 0)); if (e.n >= 3 || steal) sfx.coin(); } else tone(196, .35, 'triangle', .05, -40);
}
const wW130OnPhase = wCR.onPhase;
wCR.onPhase = ph => {
  if (wW130OnPhase) wW130OnPhase(ph);
  try { if (!wShedSoundOn()) return; if (ph === 'rest') wShedEndSound(); } catch (e) { console.error(e); }
};
const wW130OnOver = wCR.onOver;
wCR.onOver = s => {
  if (wW130OnOver) wW130OnOver(s);
  try { if (!wShedSoundOn() || !s) return;
    // (a game you only watch: the horn and the gallery; one you curled, the horn for a win)
    if (!(WCR && WCR.world) && wCR.mode === 'watch') { sfx.horn(); sfx.crowd(1.4); return; }
    if (s.win === wCR.view.you) { sfx.horn(); sfx.crowd(WCR && WCR.world ? 2 : 1.4); } else sfx.bad(); } catch (e) { console.error(e); }
};

Object.assign(TIPS, {
  w_shed: ['Curling', 'Your team is big enough for curling. Open the Team screen (C), then the Shed tab: set your four and their positions, then Curl a match against the local side or a rival club. Brush Hennock at the Curling Shed books matches too: ask for a MATCH.'],
  w_broom: ['The Brass Broom', 'Curling has its own cup, every week. Ask Brush Hennock at the Curling Shed about the CUP, or use the Brass Broom button on the Shed tab.'],
});
function wShedTips() {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world') return;
  if (wRoster().length >= W_SHG.minOwn) tip('w_shed');
  if (WG.shg && WG.shg.w > 0) tip('w_broom');
}
setInterval(wShedTips, 700);

ACH.push(
  { id: 'w_shed', n: 'Rock Steady', d: 'Win curling matches at the Curling Shed', stat: 'realmShedWins', at: [1, 10, 30] },
  { id: 'w_broom', n: 'Brass and Bristle', d: 'Win the Brass Broom', stat: 'realmBrooms', at: [1, 3, 8] },
  { id: 'w_steal', n: 'Thief on the Ice', d: 'Steal an end: score without the hammer', stat: 'realmSteals', at: [1, 10, 40] },
  { id: 'w_four', n: 'Four-Ender', d: 'Score four or more in one end of a curling match', stat: 'realmFourEnders', at: [1, 3, 10] },
  { id: 'w_button', n: 'On the Button', d: 'Draw a stone to rest on the button itself', stat: 'realmButtons', at: [1, 10, 50] },
);
const wW130ShedSettle = wShedSettle;
wShedSettle = function (sum) {
  const S = sum || {}, m = wW130ShedSettle.apply(this, arguments);
  if (LAB || S.text === 'conceded') return m;
  const st = (S.st || [])[0] || {}, sc = ((S.board && S.board.sc) || [])[0] || [];
  if (S.win === 0) achAdd('realmShedWins', 1);
  if (st.ends && st.ends.stolen) achAdd('realmSteals', st.ends.stolen);
  const four = sc.filter(n => n >= 4).length; if (four) achAdd('realmFourEnders', four);
  if (st.buttons) achAdd('realmButtons', st.buttons);
  return m;
};
const wW130BroomWon = wBroomWon;
wBroomWon = function () { wW130BroomWon(); if (!LAB) achAdd('realmBrooms', 1); };

const wW130RenderHelp = renderHelp;
renderHelp = function () {
  wW130RenderHelp();
  const d = $('wHelpShedCup'); if (!d || $('wHelpShedFeel')) return;
  d.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpShedFeel"><b>At the Shed</b> you hear the stone rumble down the pebble, a clack when it hits another, the brooms while it is swept, and your skip's call ("Hurry hard!" to sweep, "Whoa!" to let it go). The gallery cheers an end your rink scores, louder for a steal. Medals: curling matches won, Brass Brooms, ends stolen, four-enders, and a draw to rest on the button itself.</p>`);
};
