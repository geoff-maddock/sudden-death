/* w49: stances on the gridiron (issue #29; the engine's side is src/gf/parts/16-stance.js). Beside the call, your side
   plays Safe, Balanced or Risky, on offense and on defense: Risky chases the big play (more sacks, picks and fumbles,
   more stamina a play), Safe guards against them (fewer big plays, less stamina). Fumbles come with it: rare, and
   likelier the riskier either side plays.
   On the bar, in You call and You play: three buttons for the side of the ball you are on. Your stance stays until you
   change it (S steps it, except while you steer a play by hand); point at one for its tips in the tip box (w45). The
   coaches pick theirs each down, and yours under Coaches and in Simulate. The scoreboard, the play log and the reason
   after each play show the stances. Medals: Gunslinger (football games won on Risky) and Grinder (on Safe), counted by
   the stance your side used on most of its downs.
   Wraps: wGridBar (wW49GridBar: the stance buttons), wGridTip (wW49GridTip: a stance's tips), wGridSettle
   (wW49GridSettle: the medals), renderHelp (wW49RenderHelp: #wHelpGfStance). */

// the stance you point at, for the tip box
const WGST = { tip: null };
$('wGridModes').insertAdjacentHTML('beforebegin', `<span id="wGridStance" class="wgmodes wgstance" role="group" aria-label="Your stance" hidden><b id="wGridStanceL"></b>${Object.entries(wGF.stances).map(([k, s]) => `<button class="ghost" data-gstance="${k}" title="${esc(s.desc + ' S steps it.')}">${esc(s.n)}</button>`).join('')}</span>`);
$('wGridStance').addEventListener('click', e => {
  const b = e.target.closest('[data-gstance]'); if (!b) return;
  const S = wGF.stance(); if (S) wGF.setStance(S.role, b.dataset.gstance);
  wGridBar();
});
$('wGridStance').addEventListener('mouseover', e => { const b = e.target.closest('[data-gstance]'), k = b ? b.dataset.gstance : null; if (k !== WGST.tip) { WGST.tip = k; wGridTip(); } });
$('wGridStance').addEventListener('mouseleave', () => { WGST.tip = null; wGridTip(); });

function wGridStanceBar() {
  const S = wGF.stance(), show = !!S && !!WGF && WGF.mode !== 'watch' && !WGF.over && wGF.live;
  $('wGridStance').hidden = !show; if (!show) return;
  const cur = S.mine[S.role];
  $('wGridStanceL').textContent = S.role === 'off' ? 'Offense:' : 'Defense:';
  for (const b of $('wGridStance').querySelectorAll('[data-gstance]')) { const on = b.dataset.gstance === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
}
const wW49GridBar = wGridBar;
wGridBar = function () {
  wW49GridBar();
  wGridStanceBar();
  if (WGF && WGF.mode !== 'watch' && !WGF.over && wGF.phase === 'call') $('wGridNote').textContent += ' S: your stance.';
};
const wW49GridTip = wGridTip;
wGridTip = function () {
  wW49GridTip();
  const T = WGST.tip && !$('wGridStance').hidden ? wGF.stanceTip(WGST.tip) : null; if (!T) return;
  const S = wGF.stance(), li = (cls, a) => a.map(x => `<li class="${cls}">${esc(x)}</li>`).join(''), box = $('wGridTip');
  box.hidden = false;
  box.innerHTML = `<b>${esc(wGF.stances[WGST.tip].n)}</b> <small>${S.role === 'off' ? 'on offense' : 'on defense'}${S.mine[S.role] === WGST.tip ? ' · your stance' : ''}</small><ul>${li('wgpro', T.pro)}${li('wgcon', T.con)}${li('wgnote', T.note)}</ul>`;
};

// a stance's name in the log and the box (Balanced is how it is called, so it isn't named)
const wGridStanceTag = id => id && id !== 'bal' && wGF.stances[id] ? ` (${wGF.stances[id].n})` : '';

/* ---------- medals ---------- */
ACH.push(
  { id: 'w_gsling', n: 'Gunslinger', d: 'Win football games playing Risky (on most of your downs)', stat: 'realmGridRisky', at: [1, 5, 15] },
  { id: 'w_ggrind', n: 'Grinder', d: 'Win football games playing Safe (on most of your downs)', stat: 'realmGridSafe', at: [1, 5, 15] },
);
// most: the stance your side used on most of its downs
const wW49GridSettle = wGridSettle;
wGridSettle = function (r, us, them, box, half, most) {
  const m = wW49GridSettle.apply(this, arguments);
  if (!LAB && r === 'win' && most === 'risky') achAdd('realmGridRisky', 1);
  if (!LAB && r === 'win' && most === 'safe') achAdd('realmGridSafe', 1);
  return m;
};

/* ---------- How to play ---------- */
W_GRID_HOW.push(() => {
  const S = wGF.stances;
  return `<p class="hint"><b>Stances.</b> Beside the call, your side plays <b>Safe</b>, <b>Balanced</b> or <b>Risky</b>, on offense and on defense. It changes how the play is run, not which play. <b>Risky</b> chases the big play: the quarterback holds it for the deep man and throws longer (on a short pass, he looks for the receiver up the seam rather than the one cutting in), ball carriers fight for every yard, the rush comes harder and the coverage jumps routes. Expect more big gains, sacks, interceptions and fumbles, on both sides. <b>Safe</b> guards against those: short, sure throws (the quarterback throws it away rather than take a sack, and on a deep pass the back slips out as a checkdown), two hands on the ball, and coverage that keeps it in front. Expect fewer big plays. The stance also sets how hard your seven go: Risky costs about ${S.risky.stam}× the stamina a play, and Safe about ${S.safe.stam}×. Your stance stays until you change it: the buttons beside the modes, or <b>S</b>. Point at one for its pros and cons this down. Playing by hand, your throws and runs take about half its effect, because your hands decide most of the risk. The coaches pick a stance each down: Risky when behind late or on a long third down, Safe when ahead late or backed up. On fourth and short, a careful coach weighs the fumble too: with a tired back, or one with loose hands, against a defense going for the ball, they punt, or go for it on fourth and 1 past midfield playing Safe. The fourth-down hint says when. The scoreboard shows both sides' stances at the snap, and the log and the reason say what they did.</p>
  <p class="hint"><b>Fumbles</b> are rare: a hard tackle can knock the ball loose, more often from a tired or weak ball carrier, and far more often when either side plays Risky. Whoever is nearest falls on it, the defense more often than not, and a defender who picks it up may run it back. Lost, it ends the drive like an interception.</p>`;
});
const wW49RenderHelp = renderHelp;
renderHelp = function () {
  wW49RenderHelp();
  const g = $('wHelpGfBench') || $('wHelpGfPowers') || $('wHelpGridiron'); if (!g || $('wHelpGfStance')) return;
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpGfStance"><b>Stances on the gridiron.</b> Beside each call your side plays Safe, Balanced or Risky, on offense and on defense (the buttons on the bar, or S). Risky chases big plays and risks sacks, interceptions and fumbles, and tires your seven faster; Safe gives up the big play to avoid them, and saves stamina. It stays until you change it. Fumbles are rare, and likelier the riskier either side plays. Win games playing mostly Risky for the Gunslinger medal, or mostly Safe for the Grinder.</p>`);
};
