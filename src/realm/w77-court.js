/* w77: the court (issue #77, phases 0 and 1). The Charter Court, the basketball engine, runs in the wBK scope (src/bk/
   and src/realm/court/: a canvas in #v-court, and none of its names reach ours). This part gives it a view beside the
   world, a bar above the court, a box score under it, and a way back.
   Phase 1 plays one game, CPU against CPU: the Graftonbury Basketball Club against a visiting five from Saltmere, four
   quarters on the game clock, a 14-second shot clock, fouls and free throws. Ask Nim Hoopwright at the Charter Court
   for a SCRIMMAGE (GAME and BASKETBALL stay the card-game match and how it scores). Nothing is won or lost, and nothing
   is saved. Playing it by hand, the five and the calls come in later phases.
   The game length is a setting (SET.courtMins: 3, 5, 8 or 12 minutes; 5 by default), on the Settings panel and on the
   bar; the shot clock is 14 seconds whatever the length.
   Phase 2, by hand: two modes on the bar (W_COURT_MODES): Watch (the CPU plays both sides) and You play (you play the
   Graftonbury five: the keys are in c1-page.js, and under the court a pad of buttons does the same on a phone, its
   labels following whether you have the ball). Switching goes on with the same game; the last one picked is kept
   for the next (not saved). How to play adds the controls, the pick, the lob, moves, the hot hand and fast breaks.
   Wraps: showView (wW77ShowView: the bar), openPause (wW77OpenPause: not on the court), wRunAct (wW77RunAct:
   'scrimmage'), showPage (wW77ShowPage: the game waits while another page is up), renderHelp (wW77RenderHelp:
   #wHelpCourt and #wCourtHow). The Settings row goes in by an observer on the modal, as w50's and w70's do. */

const W_COURT = {
  home: { kinds: ['goblin', 'elf', 'werewolf', 'minotaur', 'troll', 'kobold', 'zombie'], color: '#e0742a', light: '#fff0d8', short: 'GBC' },
  away: { city: 'saltmere', kinds: ['kobold', 'vampire', 'gorgon', 'spider', 'golem', 'harpy', 'skeleton'], color: '#3a6fb0', light: '#e2eeff', short: 'SBC' },
};
// who plays it: the CPU both sides, or you play your five by hand
const W_COURT_MODES = {
  watch: { n: 'Watch', title: 'The CPU plays both sides. Switching goes on with the same game.' },
  play: { n: 'You play', title: 'You play Graftonbury by hand: WASD to move, Space to shoot (hold, let go at the top) or jump, J to pass (hold to lob) or swipe, E for a pick or to switch players, Q crossover, R spin, Shift to box out. Let go of the keys and your player plays on.' },
};
let W_COURT_MODE = 'play';
// the pad under the court: on offense and on defense, [key for bkInput, label, the key it stands for, held?]
const W_COURT_PAD = {
  off: [['shoot', 'Shoot', 'Space: hold, let go at the top', 1], ['pass', 'Pass', 'J: tap to pass, hold to lob', 1], ['pick', 'Pick', 'E: a big sets a screen on your man', 0], ['cross', 'Crossover', 'Q', 0], ['spin', 'Spin', 'R', 0]],
  def: [['shoot', 'Jump', 'Space: in time with the shot', 1], ['pass', 'Swipe', 'J: go for the steal', 1], ['box', 'Box out', 'Shift, held', 1], ['switch', 'Switch', 'E: play the next player nearest the ball', 0]],
};
const wCourtMins = () => wBK.rules.minsAt.includes(SET.courtMins) ? SET.courtMins : wBK.rules.mins;
// the game on the court: plain data, never saved
let WBK = null;

$('v-court').insertAdjacentHTML('beforebegin', `<div id="wCourtBar" class="wdbar" hidden>
  <b id="wCourtTitle">A scrimmage at the Charter Court</b><span id="wCourtNote" class="hint"></span>
  <label class="hint" title="How long a game is on the game clock: four quarters of a quarter of it each. The shot clock is 14 seconds whatever the length. Also on the Settings panel.">Length <select id="wCourtMins">${wBK.rules.minsAt.map(m => `<option value="${m}">${m} min</option>`).join('')}</select></label>
  <span id="wCourtModes" class="wgmodes" role="group" aria-label="Who plays it">${Object.entries(W_COURT_MODES).map(([k, m]) => `<button class="ghost" data-cmode="${k}" title="${esc(m.title)}">${esc(m.n)}</button>`).join('')}</span>
  <button class="ghost" id="wCourtAgain">Another game</button>
  <button class="ghost" id="wCourtBack">Back to the world</button></div>`);
$('wCourtBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.cmode) { W_COURT_MODE = b.dataset.cmode; if (WBK && !WBK.over) wBK.setMode(W_COURT_MODE); wCourtBarNote(); }
  else if (b.id === 'wCourtAgain') { if (WBK && WBK.how === 'practice') wCourtPractice(); else wCourtGame(); }
  else if (b.id === 'wCourtBack') wLeaveCourt();
});
$('wCourtMins').addEventListener('change', e => { SET.courtMins = +e.target.value; saveSettings(); wCourtBarNote(); });
// under the court: the box score, and How basketball works
$('v-court').insertAdjacentHTML('beforeend', `<div id="wCourtPad" class="wrpad" hidden role="group" aria-label="Play"></div><div id="wCourtBox" class="wcbox"></div>
  <p class="hint wghowlink">How basketball works: the clocks, shots, rebounds and fouls. <button class="ghost" id="wCourtHowBtn">How to play basketball</button> <small>The game waits while you read.</small></p>`);
$('wCourtHowBtn').addEventListener('click', () => { showPage('help'); const h = $('wCourtHow'); if (h) h.scrollIntoView({ block: 'start' }); });

// the pad: held buttons (shoot, pass, box) send down and up; the rest a tap
$('wCourtPad').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-cpad]'); if (!b) return;
  e.preventDefault();
  const k = b.dataset.cpad;
  if (b.dataset.hold) { wBK.input({ [k]: true }); W_COURT_HELD.add(k); try { b.setPointerCapture(e.pointerId); } catch (er) { /* no live pointer (a synthetic press) */ } }
  else wBK.input({ act: k });
});
// (a release heard twice, pointerup then lostpointercapture, does nothing the second time)
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) $('wCourtPad').addEventListener(ev, e => { const b = e.target.closest('[data-cpad]'); if (b && b.dataset.hold) wCourtPadUp(b.dataset.cpad); });
// the held pad buttons (shoot, pass, box) now down, so a redraw or leaving never strands one
const W_COURT_HELD = new Set();
function wCourtPadUp(k) { if (W_COURT_HELD.delete(k)) wBK.input({ [k]: false }); }
function wCourtPadRelease() { for (const k of [...W_COURT_HELD]) wCourtPadUp(k); }
// the pad's buttons for the side of the ball you're on: your side's possession (a pass or shot in the air included) is
// offense. Drawn again only when that changes, letting go of any held button first
function wCourtPad() {
  const pad = $('wCourtPad'), show = !!WBK && !WBK.over && wBK.mode === 'play';
  if (!show) wCourtPadRelease();
  pad.hidden = !show; if (!show) return;
  const side = wBK.G && wBK.G.poss === wBK.you ? 'off' : 'def';
  if (pad.dataset.side === side) return;
  wCourtPadRelease();
  pad.dataset.side = side;
  pad.innerHTML = W_COURT_PAD[side].map(([k, n, key, hold]) => `<button class="ghost" data-cpad="${k}" ${hold ? 'data-hold="1"' : ''} title="${esc(key)}">${esc(n)}</button>`).join('');
}
// (kept up a few times a second while a game is on the court, and stopped when it's left)
let W_COURT_TICK = 0;
function wCourtTick(on) { clearInterval(W_COURT_TICK); W_COURT_TICK = on ? setInterval(() => { if (WBK && UI.view === 'court') wCourtPad(); }, 120) : 0; }
function wCourtTeams() {
  const g = W_GRDS.find(x => x.id === 'g_court'), H = W_COURT.home, A = W_COURT.away, used = new Set();
  return [Object.assign({ name: wGrdClub(g) }, H), Object.assign({ name: `${W_GRD_CITY[A.city]} ${SPORT_NAME.basketball} Club` }, A)].map(t => ({
    name: t.name, short: t.short, color: t.color, light: t.light, roster: t.kinds.map((kind, i) => ({ n: wCourtName(kind, used), kind, num: 2 + i * 6 })),
  }));
}
// a player's name from the free agents' names for their kind, one nobody else in the game has (used: the names taken)
function wCourtName(kind, used) {
  const base = kind[0].toUpperCase() + kind.slice(1), L = (FA_NAMES[kind] || []).filter(n => !used.has(n));
  let n = L.length ? L[(Math.random() * L.length) | 0] : base;
  for (let k = 2; used.has(n); k++) n = `${base} ${k}`;
  used.add(n); return n;
}
/* one game on the court. opts: { teams, mins, seed, mode, title, how ('practice': Another game plays another, w78),
   ordered (sides whose coach follows the bench order) } (the two clubs and the length setting when not given) */
function wCourtGame(opts) {
  const o = opts || {};
  WBK = { over: null, how: o.how || 'scrimmage' }; wCourtTick(true);
  $('wCourtTitle').textContent = o.title || 'A scrimmage at the Charter Court';
  wBK.start({ teams: o.teams || wCourtTeams(), mins: o.mins || wCourtMins(), seed: o.seed, mode: o.mode || W_COURT_MODE, ordered: o.ordered, skill: o.skill });
  showView('court');
  wCourtBarNote(); wCourtBox();
}
function wCourtBarNote() {
  if (!WBK) return;
  const ck = wBK.clock(), G = wBK.G;
  const mode = wBK.mode || W_COURT_MODE;
  $('wCourtNote').textContent = WBK.over ? wBK.msg : !ck ? '' : mode === 'play'
    ? `You play ${G.teams[0].name}: WASD to move, Space to shoot (let go at the top) or jump, J to pass (hold to lob) or swipe, E pick or switch, Q crossover, R spin, Shift box out.`
    : `${G.teams[0].name} against ${G.teams[1].name}: ${G.mins} minutes, four quarters, a ${wBK.rules.shot}-second shot clock. A scrimmage: nothing is won or lost.`;
  $('wCourtMins').value = String(wCourtMins());
  for (const b of $('wCourtModes').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.cmode === mode); b.setAttribute('aria-pressed', b.dataset.cmode === mode); }
  $('wCourtPad').dataset.side = ''; wCourtPad();
}
// the box score under the court: each side's players with their lines
function wCourtBox() {
  const B = wBK.box(); if (!B) { $('wCourtBox').innerHTML = ''; return; }
  // (stamina now, phase 3; on the floor marked)
  const ST = wBK.stam(), ON = wBK.onFloor(), sta = (s, ri) => ST ? `<td class="${ST[s][ri] < wBK.stamRules.sub ? 'wbad' : ''}">${Math.round(ST[s][ri])}</td>` : '<td></td>';
  const pct = (m, a) => a ? `${m}/${a}` : '–', mins = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  $('wCourtBox').innerHTML = B.map((b, s) => `<table class="wrpow wcboxt"><caption>${esc(b.team)}</caption><tr><th>Player</th><th title="Minutes on the floor">Min</th><th title="Stamina now, out of 100: tired below ${wBK.stamRules.tired}, the coach looks for a sub below ${wBK.stamRules.sub}">Sta</th><th>Pts</th><th title="Rebounds (offensive)">Reb</th><th>Ast</th><th>Stl</th><th>Blk</th><th title="Field goals made of tried">FG</th><th title="Threes made of tried">3PT</th><th title="Free throws made of tried">FT</th><th title="Personal fouls">PF</th></tr>${b.rows.map(r => `<tr><td>${ON && ON[s].includes(r.ri) && !WBK.over ? '<b title="On the floor">&bull;</b> ' : ''}${esc(r.n)} <small>${esc(wKindName(r.kind))}</small>${r.out ? ' <small>(fouled out)</small>' : ''}</td><td>${mins(r.sec)}</td>${sta(s, r.ri)}<td>${r.pts}</td><td>${r.reb}${r.oreb ? ` <small>(${r.oreb})</small>` : ''}</td><td>${r.ast}</td><td>${r.stl}</td><td>${r.blk}</td><td>${pct(r.fgm, r.fga)}</td><td>${pct(r.tpm, r.tpa)}</td><td>${pct(r.ftm, r.fta)}</td><td>${r.pf}</td></tr>`).join('')}<tr><td><b>Team</b></td><td></td><td></td><td><b>${b.tot.pts}</b></td><td>${b.tot.reb}</td><td>${b.tot.ast}</td><td>${b.tot.stl}</td><td>${b.tot.blk}</td><td>${pct(b.tot.fgm, b.tot.fga)}</td><td>${pct(b.tot.tpm, b.tot.tpa)}</td><td>${pct(b.tot.ftm, b.tot.fta)}</td><td>${b.tot.pf}</td></tr></table>`).join('');
}
function wLeaveCourt() {
  wCourtPadRelease(); wCourtTick(false);
  WBK = null; wBK.pause(false);
  if (WG) showView('world');
  else { wBK.hide(); showScreen('title'); renderTitle(); }
}
// the box score keeps up at each break in play, not every frame
wBK.onPhase = ph => { if (WBK && UI.view === 'court' && ['dead', 'break', 'ft', 'over'].includes(ph)) wCourtBox(); };
wBK.onOver = s => { if (WBK) { WBK.over = s; wCourtBarNote(); wCourtBox(); $('wCourtAgain').focus(); } };

const wW77ShowView = showView;
showView = function (v) {
  wW77ShowView(v);
  $('wCourtBar').hidden = v !== 'court';
  if (v === 'court') $('runbar').hidden = true;
};
const wW77OpenPause = openPause;
openPause = function () { if (UI.view === 'court') return; return wW77OpenPause.apply(this, arguments); };
const wW77ShowPage = showPage;
showPage = function (p) {
  wW77ShowPage(p);
  if (WBK && UI.view === 'court') wBK.pause(p !== 'play');
};

// Nim Hoopwright at the Charter Court puts on a scrimmage (not BASKETBALL or GAME: those are how card-game basketball
// scores, and the match)
(() => {
  const K = DB.chars.gk_court; if (!K) return;
  K.topics.job.t += ' And we play it for real now, five on five on these boards: ask me for a SCRIMMAGE.';
  K.topics.scrimmage = { t: 'Five of ours against five from Saltmere, four quarters, a fourteen-second shot clock. Watch from the wall. Mind the boards.', act: 'scrimmage' };
})();
const wW77RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'scrimmage') return wCourtGame(); return wW77RunAct.apply(this, arguments); };

// the Settings panel: the game length, under the rest (the panel draws itself again on some changes, so an observer on
// the modal puts the row back whenever it does; it does nothing in any other modal)
function wCourtSetRow() {
  const g = document.querySelector('#modalBox .setgrid'); if (!g || $('sCourtMins')) return;
  g.insertAdjacentHTML('beforeend', `<label class="rng"><span>Basketball game length</span><select id="sCourtMins">${wBK.rules.minsAt.map(m => `<option value="${m}" ${wCourtMins() === m ? 'selected' : ''}>${m} minutes</option>`).join('')}</select></label>`);
  $('sCourtMins').onchange = e => { SET.courtMins = +e.target.value; saveSettings(); if (WBK) wCourtBarNote(); };
}
new MutationObserver(wCourtSetRow).observe($('modalBox'), { childList: true });

// How to play: Basketball, how it works
function wCourtHowHTML() {
  const R = wBK.rules;
  return `<p class="hint">A game is five on five on a full court, four quarters on the game clock (${R.mins} minutes in all unless you change it in Settings: ${R.minsAt.join(', ')}). Each trip down the floor is one possession against a <b>shot clock</b> of ${R.shot} seconds. A shot that hits the rim resets it, and a clock that runs out turns the ball over. After a basket the other side brings it up; the walk up the floor is sped through.</p>
  <p class="hint"><b>Shots.</b> A basket is 2, or 3 from beyond the arc, and a free throw is 1. How likely a shot goes in comes from the distance, the shooter's touch, and the <b>contest</b>: how close the nearest defender is, and how good. At the rim size and hops count, and a big leaper dunks. A defender close to the shot can block it, or foul.</p>
  <p class="hint"><b>The player with the ball</b> weighs what's on: a good look gets shot, a defender in the lane gets beaten off the dribble (handle and speed against defense and speed) or the ball gets moved to the teammate with the best look. A pass thrown into a defender's lane can be stolen, and a defender up close can pick the dribble. After a steal or a defensive rebound the play goes straight the other way: a side slow to get back gives up a fast break.</p>
  <p class="hint"><b>Rebounds.</b> A miss comes off the rim, further on a three. Whoever is nearest where it comes down has the best of it, with size and hops, and the defense has inside position.</p>
  <p class="hint"><b>Fouls.</b> A foul on a shot gives two free throws, three on a three-point try, and one more if it went in anyway (an and-one). Past ${R.limit} team fouls in a quarter a side is in the <b>bonus</b>: every foul gives two. ${R.out} personal fouls and a player is out of the game, and the best player on the bench comes on; with nobody left to come on, they stay in, but every foul after that gives one free throw more. A free throw is touch alone.</p>
  <p class="hint"><b>Ratings.</b> Six for each player: speed, size (height and reach), hops, touch (shooting), handle and defense. Size counts, but it is one of six: a goblin handles the ball like it's on a string, an ogre is all size and no handle, and a harpy is all hops and no size. Level after four quarters, it goes to overtime.</p>
  <p class="hint"><b>The spots.</b> Two guards handle it, a wing shoots, and two bigs work inside: they rebound and block. The five line up from their ratings for now.</p>
  <p class="hint"><b>The pick and roll.</b> A big sets a screen on the defender guarding the ball. The defense then <b>switches</b> (the big's defender takes the ball: a mismatch, maybe), goes <b>over</b> the screen (a step behind: an open lane) or <b>traps</b> (two on the ball: the big rolls to the rim open). Either way the big rolls.</p>
  <p class="hint"><b>The lob and the alley-oop.</b> A lob is slow and high, so only a defender near where it comes down can get it. Thrown to a leaper near the rim, it's caught and dunked in one go.</p>
  <p class="hint"><b>Moves.</b> A <b>crossover</b> or a <b>spin</b> on the defender in front: handle against defense. Beat them and they're left behind; fail and you lose a step, or the ball. A spin beats them by more and risks more.</p>
  <p class="hint"><b>The hot hand.</b> Three makes in a row from one player and they're <b>on fire</b>: every look is better (and by hand, the release window is wider) until they miss.</p>
  <p class="hint"><b>Fast breaks.</b> After a steal or a defensive rebound, push it: across half court with more of you than them back, it's a fast break.</p>
  <p class="hint"><b>Playing it by hand.</b> Pick <b>You play</b> on the bar to play Graftonbury. On offense you play whoever has the ball: WASD or the arrows to move; <b>Space</b> to shoot: hold to rise and let go at the top of the jump. The meter beside your shooter shows the window (green, its heart brighter): its width comes from the look (the distance, your touch, the defender, the hot hand). Dead on is a swish, in the window it's a good shot, just outside it might still drop off the rim, and well off it won't. Hold too long and it goes up late. <b>J</b> passes to the teammate you're moving toward (or the best look if you aren't moving); hold it for a lob. <b>E</b> calls a pick, <b>Q</b> is a crossover and <b>R</b> a spin. At the free-throw line, Space works the same way, with no defender: touch alone. On defense you play the player nearest the ball (marked): move them, <b>J</b> to swipe at the ball (a miss up close can be a foul), <b>Space</b> to jump (just before the shot goes up is a far better contest; too early and you land off balance; on a ball already coming down at the rim it's goaltending, and the basket counts), hold <b>Shift</b> to box out for the rebound, and <b>E</b> to switch to the next player nearest the ball. Let go of the keys for a couple of seconds and your player plays on their own, so you can also play from the buttons under the court.</p>`;
}
const wW77RenderHelp = renderHelp;
renderHelp = function () {
  wW77RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpCourt') || !$('wHelpGrounds')) return;
  const G = [...h.querySelectorAll('[id^="wHelpG"], #wHelpRing')], after = G[G.length - 1];
  h.insertAdjacentHTML('beforeend', `<section id="wCourtHow" class="wghelp"><h3>Basketball: how it works</h3>${wCourtHowHTML()}</section>`);
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpCourt"><b>Real basketball.</b> The Charter Court is trying out basketball on the boards themselves, five on five. Ask Nim Hoopwright for a SCRIMMAGE: four quarters on the game clock (five minutes in all, or set the length in Settings) and a ${wBK.rules.shot}-second shot clock. Play Graftonbury by hand, or watch the two clubs run it end to end: shots, drives, passes, rebounds, steals, blocks, fouls and free throws, with a box score under the court (see Basketball: how it works). A SCRIMMAGE is an exhibition: nothing is won or lost.</p>`);
};
