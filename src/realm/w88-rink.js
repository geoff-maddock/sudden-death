/* w88: the rink (issue #83, phases 0 and 1). Black Ice, the hockey engine, runs in the wHK scope (src/hk/ and
   src/realm/rink/: a canvas in #v-rink, and none of its names reach ours). This part gives it a view beside the
   world, laid out as the court's and the gridiron's pages are (w87): the bar with the status line under it, the rink,
   the two sides' box scores side by side, then This game (every goal).
   Phase 1 plays one game, CPU against CPU: the Rimewatch Hockey Club against a visiting six from Cinderhold, three
   periods on the game clock, face-offs, icing, sudden death and a shootout. Ask Old Tove at the Pond Rink for a
   SCRIMMAGE (GAME and HOCKEY stay the card-game match and how it scores). Nothing is won or lost, and nothing is
   saved. Penalties, the six and the calls come in later phases.
   Phase 2, by hand: two modes on the bar (W_RINK_MODES): Watch (the CPU plays both sides) and You play (you play the
   Rimewatch skaters: the keys are in k1-page.js, and under the rink a pad of buttons does the same on a phone, its
   labels following whether you have the puck). Switching goes on with the same game; the last one picked is kept for
   the next (not saved). How to play adds the controls, aiming, the one-timer and the face-off.
   The game length is a setting (SET.rinkMins: 3, 6, 9 or 12 minutes; 6 by default), on the Settings panel and on the
   bar.
   On a phone the scoreboard strip (w86) covers the rink too: W_SB_VIEWS.rink and W_SB_HTML.rink are added here.
   Wraps: showView (wW88ShowView: the bar), openPause (wW88OpenPause: not on the rink), wRunAct (wW88RunAct:
   'rinkscrim'), showPage (wW88ShowPage: the game waits while another page is up), renderHelp (wW88RenderHelp:
   #wHelpRink and #wRinkHow). The Settings row goes in by an observer on the modal, as w77's does. */

const W_RINK = {
  home: { kinds: ['vampire', 'harpy', 'witch', 'werewolf', 'troll', 'wraith', 'skeleton', 'lich'], color: '#3a6ab8', light: '#e2eeff', short: 'RHC' },
  away: { city: 'cinderhold', kinds: ['elf', 'goblin', 'kobold', 'minotaur', 'golem', 'gorgon', 'dwarf', 'ogre'], color: '#b8443a', light: '#ffe6e0', short: 'CHC' },
};
const W_RINK_SHOT = { wrist: 'scores', slap: 'scores with a slap shot', one: 'one-times it in', so: 'wins the shootout' };
const W_RINK_GOALIE = ['pull', 'Goalie', 'G: pull your goalie for an extra skater, or send them back', 0];
const W_RINK_STR = { pp: ' on the power play', sh: ' short-handed', even: '', so: '' };
// who plays it: the CPU both sides, or you play your skaters by hand
const W_RINK_MODES = {
  watch: { n: 'Watch', title: 'The CPU plays both sides. Switching goes on with the same game.' },
  play: { n: 'You play', title: 'You play Rimewatch by hand: WASD to skate, Space to shoot (tap, or hold to wind up a slap shot) or check, J to pass (hold to send it hard) or poke, E to switch skaters, Shift to lift your stick. Let go of the keys and your skater plays on.' },
};
let W_RINK_MODE = 'play';
// the pad under the rink: with the puck and without it, [key for wHK.input, label, the key it stands for, held?]
const W_RINK_PAD = {
  puck: [['shoot', 'Shoot', 'Space: tap for a wrist shot, hold to wind up', 1], ['pass', 'Pass', 'J: tap to pass, hold to send it hard', 1], W_RINK_GOALIE],
  none: [['shoot', 'Check', 'Space: lunge at the carrier, or take the face-off', 1], ['pass', 'Poke', 'J: go for the puck', 1], ['lift', 'Lift stick', 'Shift, held: into the passing lane', 1], ['switch', 'Switch', 'E: play the next skater nearest the puck', 0], W_RINK_GOALIE],
};
const wRinkMins = () => wHK.rules.minsAt.includes(SET.rinkMins) ? SET.rinkMins : wHK.rules.mins;
// the game on the rink: plain data, never saved
let WHK = null;

$('v-rink').insertAdjacentHTML('beforebegin', `<div id="wRinkBar" class="wdbar" hidden>
  <b id="wRinkTitle">A scrimmage at the Pond Rink</b><span id="wRinkNote" class="hint wsnote"></span>
  <span id="wRinkModes" class="wgmodes" role="group" aria-label="Who plays it">${Object.entries(W_RINK_MODES).map(([k, m]) => `<button class="ghost" data-kmode="${k}" title="${esc(m.title)}">${esc(m.n)}</button>`).join('')}</span>
  <label class="hint" title="How long a game is on the game clock: three periods of a third of it each. The clock stops at every whistle. Also on the Settings panel.">Length <select id="wRinkMins">${wHK.rules.minsAt.map(m => `<option value="${m}">${m} min</option>`).join('')}</select></label>
  <button class="ghost" id="wRinkAgain">Another game</button>
  <button class="ghost" id="wRinkBack">Back to the world</button></div>`);
$('wRinkBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.kmode) { W_RINK_MODE = b.dataset.kmode; if (WHK && !WHK.over) wHK.setMode(W_RINK_MODE); wRinkBarNote(); }
  else if (b.id === 'wRinkAgain') wRinkGame();
  else if (b.id === 'wRinkBack') wLeaveRink();
});
$('wRinkMins').addEventListener('change', e => { SET.rinkMins = +e.target.value; saveSettings(); wRinkBarNote(); });
// under the rink: the box score, every goal, and How hockey works
$('v-rink').insertAdjacentHTML('beforeend', `<div id="wRinkPad" class="wrpad" hidden role="group" aria-label="Play"></div><h4 class="wsh">Box score</h4><div id="wRinkBox" class="wcbox"></div>
  <h4 class="wsh">This game</h4><ol id="wRinkLog" class="wglog wslog"></ol>
  <h4 class="wsh">Penalties</h4><ol id="wRinkPens" class="wglog wslog"></ol>
  <p class="hint wghowlink">How hockey works: skating, shots and saves, checks, face-offs and icing. <button class="ghost" id="wRinkHowBtn">How to play hockey</button> <small>The game waits while you read.</small></p>`);
$('wRinkHowBtn').addEventListener('click', () => { showPage('help'); const h = $('wRinkHow'); if (h) h.scrollIntoView({ block: 'start' }); });

// the pad: held buttons (shoot, pass, lift) send down and up; Switch is a tap
const W_RINK_HELD = new Set();
function wRinkPadUp(k) { if (W_RINK_HELD.delete(k)) wHK.input({ [k]: false }); }
function wRinkPadRelease() { for (const k of [...W_RINK_HELD]) wRinkPadUp(k); }
$('wRinkPad').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-kpad]'); if (!b) return;
  e.preventDefault();
  const k = b.dataset.kpad;
  if (b.dataset.hold) { wHK.input({ [k]: true }); W_RINK_HELD.add(k); try { b.setPointerCapture(e.pointerId); } catch (er) { /* no live pointer (a synthetic press) */ } }
  else wHK.input({ act: k });
});
// (a release heard twice, pointerup then lostpointercapture, does nothing the second time)
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) $('wRinkPad').addEventListener(ev, e => { const b = e.target.closest('[data-kpad]'); if (b && b.dataset.hold) wRinkPadUp(b.dataset.kpad); });
// the pad's buttons for whether you have the puck (a pass of yours on its way counts). Drawn again only when that
// changes, letting go of any held button first, so a redraw never strands one
function wRinkPad() {
  const pad = $('wRinkPad'), show = !!WHK && !WHK.over && wHK.mode === 'play';
  if (!show) wRinkPadRelease();
  pad.hidden = !show; if (!show) return;
  const P = wHK.play && wHK.play.puck, side = wHK.puckMine || (P && P.st === 'free' && P.k === 'pass' && P.to === wHK.me) ? 'puck' : 'none';
  if (pad.dataset.side === side) return;
  wRinkPadRelease();
  pad.dataset.side = side;
  pad.innerHTML = W_RINK_PAD[side].map(([k, n, key, hold]) => `<button class="ghost" data-kpad="${k}" ${hold ? 'data-hold="1"' : ''} data-key="${esc(key.split(/[,:]/)[0])}" title="${esc(key)}">${esc(n)}</button>`).join('');
}
// (kept up a few times a second while a game is on the rink, and stopped when it's left)
let W_RINK_TICK = 0;
function wRinkTick(on) { clearInterval(W_RINK_TICK); W_RINK_TICK = on ? setInterval(() => { if (WHK && UI.view === 'rink') wRinkPad(); }, 120) : 0; }

// a player's name from the free agents' names for their kind, one nobody else in the game has (used: the names taken)
function wRinkName(kind, used) {
  const base = kind[0].toUpperCase() + kind.slice(1), N = (FA_NAMES[kind] || []).filter(n => !used.has(n));
  let n = N.length ? N[(Math.random() * N.length) | 0] : base;
  for (let k = 2; used.has(n); k++) n = `${base} ${k}`;
  used.add(n); return n;
}
function wRinkTeams() {
  const g = W_GRDS.find(x => x.id === 'g_rink'), H = W_RINK.home, A = W_RINK.away, used = new Set();
  return [Object.assign({ name: wGrdClub(g) }, H), Object.assign({ name: `${W_GRD_CITY[A.city]} ${SPORT_NAME.hockey} Club` }, A)].map(t => ({
    name: t.name, short: t.short, color: t.color, light: t.light, roster: t.kinds.map((kind, i) => ({ n: wRinkName(kind, used), kind, num: 2 + i * 7 })),
  }));
}
/* one game on the rink. opts: { teams, mins, seed, mode } (the two clubs, the length setting and the mode on the bar
   when not given) */
function wRinkGame(opts) {
  const o = opts || {};
  WHK = { over: null }; wRinkTick(true);
  wHK.start({ teams: o.teams || wRinkTeams(), mins: o.mins || wRinkMins(), seed: o.seed, mode: o.mode || W_RINK_MODE });
  showView('rink');
  wRinkBarNote(); wRinkBox();
}
function wRinkBarNote() {
  if (!WHK) return;
  const G = wHK.G, mode = wHK.mode || W_RINK_MODE;
  for (const b of $('wRinkModes').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.kmode === mode); b.setAttribute('aria-pressed', b.dataset.kmode === mode); }
  $('wRinkPad').dataset.side = ''; wRinkPad();
  $('wRinkNote').textContent = WHK.over ? wHK.msg : !G ? '' : mode === 'play'
    ? `You play ${G.teams[0].name}: WASD to skate, Space to shoot (tap, or hold to wind up) or check, J to pass (hold to send it hard) or poke, E to switch, Shift to lift your stick. At a face-off, Space as the puck drops.`
    : `${G.teams[0].name} against ${G.teams[1].name}: ${G.mins} minutes in three periods. Level at the end, it goes to sudden death and then a shootout. A scrimmage: nothing is won or lost.`;
  $('wRinkMins').value = String(wRinkMins());
}
// every goal so far, oldest first, with the score after it
function wRinkLogHTML() {
  const G = wHK.G, log = G && G.log; if (!log || !log.length) return '<li class="hint">No goals yet.</li>';
  const sc = [0, 0], t = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return log.map(e => { sc[e.side]++; const T = G.teams[e.side];
    return `<li style="border-left-color:${T.color}"><small>${e.k === 'so' ? 'Shootout' : `${esc(wHK.periodName(e.p))} ${t(e.clock)}`} · ${sc[0]}–${sc[1]}</small> <b>${esc(e.who)}</b> ${e.en ? 'scores into the empty net' : W_RINK_SHOT[e.k] || 'scores'} for ${esc(T.name)}${W_RINK_STR[e.str] || ''}${e.a && e.a.length ? `, from ${e.a.map(esc).join(' and ')}` : ''}.</li>`; }).join('');
}
// the box score under the rink: each side's skaters with their lines, and the goalie's saves
function wRinkBox() {
  const B = wHK.box(); if (!B) { $('wRinkBox').innerHTML = ''; $('wRinkLog').innerHTML = ''; $('wRinkPens').innerHTML = ''; return; }
  const mins = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`, of = (m, a) => a ? `${m}/${a}` : '–';
  $('wRinkBox').innerHTML = B.map(b => `<table class="wrpow wcboxt"><caption>${esc(b.team)}</caption><tr><th>Player</th><th title="Time on the ice">TOI</th><th title="Goals">G</th><th title="Assists">A</th><th title="Shots on goal">SOG</th><th>Hits</th><th title="Shots blocked">Blk</th><th title="Takeaways">Tk</th><th title="Penalty minutes: two for each minor">PIM</th><th title="Face-offs won of taken">FO</th><th title="A goalie's saves of shots faced">Sv</th></tr>${b.rows.map(r => `<tr><td>${esc(r.n)} <small>${esc(r.pos)} · ${esc(wKindName(r.kind))}</small></td><td>${mins(r.sec)}</td><td>${r.g}</td><td>${r.a}</td><td>${r.sog}</td><td>${r.hit}</td><td>${r.blk}</td><td>${r.take}</td><td>${r.pim}</td><td>${of(r.fow, r.fot)}</td><td>${r.pos === 'G' ? of(r.sv, r.sa) : ''}</td></tr>`).join('')}<tr><td><b>Team</b></td><td></td><td><b>${b.tot.g}</b></td><td>${b.tot.a}</td><td>${b.tot.sog}</td><td>${b.tot.hit}</td><td>${b.tot.blk}</td><td>${b.tot.take}</td><td>${b.tot.pim}</td><td>${of(b.tot.fow, b.tot.fot)}</td><td>${of(b.tot.sv, b.tot.sa)}</td></tr></table>`).join('');
  $('wRinkLog').innerHTML = wRinkLogHTML();
  $('wRinkPens').innerHTML = wRinkPensHTML();
}
// every penalty so far
function wRinkPensHTML() {
  const G = wHK.G, P = G && G.pens; if (!P || !P.length) return '<li class="hint">No penalties yet.</li>';
  const t = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return P.map(e => `<li style="border-left-color:${G.teams[e.side].color}"><small>${esc(wHK.periodName(e.p))} ${t(e.clock)}</small> <b>${esc(e.who)}</b> (${esc(G.teams[e.side].name)}), ${esc(e.k)}${e.on ? ` on ${esc(e.on)}` : ''}.</li>`).join('');
}
function wLeaveRink() {
  wRinkPadRelease(); wRinkTick(false);
  WHK = null; wHK.pause(false);
  if (WG) showView('world');
  else { wHK.hide(); showScreen('title'); renderTitle(); }
}
// the box score keeps up at each whistle, not every frame
wHK.onPhase = ph => { if (WHK && UI.view === 'rink' && ['dead', 'break', 'so', 'over'].includes(ph)) wRinkBox(); };
wHK.onOver = s => { if (WHK) { WHK.over = s; wRinkBarNote(); wRinkBox(); wRinkPad(); $('wRinkAgain').focus(); } };

// the scoreboard strip on a phone (w86): both sides and the score, the period and the clock, and shots on goal
W_SB_VIEWS.rink = 'wSbRink';
W_SB_HTML.rink = function () {
  const G = wHK.G; if (!G || !G.teams) return '';
  const C = wHK.clock(), over = wHK.phase === 'over', live = wHK.phase === 'live';
  return wSbSide(G.teams[0].name, G.teams[0].color, G.score[0], live && G.poss === 0, `<small>Shots ${G.sog[0]}</small>`) + `<div class="wsbmid"><b>${over ? 'Final' : C ? esc(C.name) : ''}</b><small>${over || !C ? '' : esc(C.text)}</small></div>` + wSbSide(G.teams[1].name, G.teams[1].color, G.score[1], live && G.poss === 1, `<small>Shots ${G.sog[1]}</small>`);
};

const wW88ShowView = showView;
showView = function (v) {
  wW88ShowView(v);
  $('wRinkBar').hidden = v !== 'rink';
  if (v === 'rink') $('runbar').hidden = true;
};
const wW88OpenPause = openPause;
openPause = function () { if (UI.view === 'rink') return; return wW88OpenPause.apply(this, arguments); };
const wW88ShowPage = showPage;
showPage = function (p) {
  wW88ShowPage(p);
  if (WHK && UI.view === 'rink') wHK.pause(p !== 'play');
};

// Old Tove at the Pond Rink puts on a scrimmage (not HOCKEY or GAME: those are how card-game hockey scores, and the match)
(() => {
  const K = DB.chars.gk_rink; if (!K) return;
  K.topics.job.t += ' And we play it for real now, on the ice itself, six a side: ask me for a SCRIMMAGE.';
  K.topics.scrimmage = { t: 'Six of ours against six from Cinderhold. Three periods, and nobody goes home level. Watch from the bank. Mind the puck.', act: 'rinkscrim' };
})();
const wW88RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'rinkscrim') return wRinkGame(); return wW88RunAct.apply(this, arguments); };

// the Settings panel: the game length, under the rest (the panel draws itself again on some changes, so an observer on
// the modal puts the row back whenever it does; it does nothing in any other modal)
function wRinkSetRow() {
  const g = document.querySelector('#modalBox .setgrid'); if (!g || $('sRinkMins')) return;
  g.insertAdjacentHTML('beforeend', `<label class="rng"><span>Hockey game length</span><select id="sRinkMins">${wHK.rules.minsAt.map(m => `<option value="${m}" ${wRinkMins() === m ? 'selected' : ''}>${m} minutes</option>`).join('')}</select></label>`);
  $('sRinkMins').onchange = e => { SET.rinkMins = +e.target.value; saveSettings(); if (WHK) wRinkBarNote(); };
}
new MutationObserver(wRinkSetRow).observe($('modalBox'), { childList: true });

// How to play: Hockey, how it works
function wRinkHowHTML() {
  const R = wHK.rules;
  return `<p class="hint">A game is five skaters and a goalie a side, three periods on the game clock (${R.mins} minutes in all unless you change it in Settings: ${R.minsAt.join(', ')}). The clock stops at every whistle. Play starts, and starts again, with a <b>face-off</b>: the two centres go for the dropped puck, hands and size against hands and size, and the winner draws it back.</p>
  <p class="hint"><b>Skating.</b> Nobody stops on ice. Players build speed, turn in arcs and glide, so a skater who misses is out of the play for a moment.</p>
  <p class="hint"><b>The puck</b> is loose a lot: off a stick, off the boards, out of a corner. Whoever gets there first has it, and two who arrive together fight for it on hands and size. A pass through a defender's reach can be picked off.</p>
  <p class="hint"><b>Shots.</b> The wrist shot is quick. The slap shot is harder, but takes a wind-up, and a checker can take the puck during it. The one-timer, shot as a pass arrives, is the hardest to stop. A shot can be blocked by a skater in its way, miss the net, be saved, or go in. A save is held, or comes loose in front as a <b>rebound</b>.</p>
  <p class="hint"><b>The goalie</b> stands on the line between the puck and the net, but follows the puck a moment late. A shot from where they are set is hard to score on. A pass <b>across the front of the net</b> and a quick shot finds them out of place, and that is how most goals come. A teammate standing in front of the goalie hides the shot.</p>
  <p class="hint"><b>Checks.</b> The skater nearest the puck carrier goes at them. Up close they poke at the puck (defense against hands), or, closing fast, throw a body check (size and speed) that knocks the carrier off it.</p>
  <p class="hint"><b>Icing.</b> A puck sent from a side's own half that crosses the far goal line untouched comes back for a face-off in that side's end. There is no offside.</p>
  <p class="hint"><b>Penalties.</b> A poke that misses up close can trip. A beaten checker reaching back can hook. A hit from behind into the boards is boarding, and now and then a hit is just too much (roughing). The player goes to the <b>box</b> behind the far boards for a minor (${Math.round(R.mins * 60 / R.periods / R.minorOf)} seconds at this length), and their side skates one short: the other side is on the <b>power play</b>. The penalty ends early if the power play scores. A side is never below ${R.minSk} skaters: a third penalty waits its turn. A side that is short may ice the puck freely, and sits back in a box in front of its net.</p>
  <p class="hint"><b>The delayed penalty.</b> When the side that was fouled has the puck, play goes on until the fouling side touches it. Meanwhile the fouled side's goalie comes off for an extra skater: the whistle will go before anyone can shoot at the empty net. A goal in that time wipes the penalty out.</p>
  <p class="hint"><b>Pulling the goalie.</b> Late in the third period, a goal or two behind, a side takes its goalie off for an extra skater when it has the puck up the ice. The net is empty until a face-off in its own half sends the goalie back. By hand, <b>G</b> pulls your goalie or sends them back, at any time.</p>
  <p class="hint"><b>Level after three periods,</b> it goes to sudden death at three skaters a side, half a period long: the next goal wins. Still level, a <b>shootout</b>: ${R.so} tries each, then one each until it is settled. Each try starts at centre: the shooter alone on the goalie. By hand you skate in, aim and shoot your side's tries, and against theirs you may take your goalie: steer up and down the screen to move them along the line, or leave them to it. A hockey game never ends level.</p>
  <p class="hint"><b>Playing it by hand.</b> Pick <b>You play</b> on the bar to play Rimewatch. With the puck you play whoever has it: WASD or the arrows to skate (let go and they glide on). <b>Space</b> shoots: a tap is a wrist shot; hold it to wind up a slap shot (the bar beside your shooter fills, and the shot gets harder), then let go. A checker can take the puck off a wind-up. <b>J</b> passes to the teammate you're skating toward (or the best one if you aren't steering); hold it to send the puck hard the way you steer, into a corner or out of your end. Without the puck you play the skater nearest it (marked): <b>J</b> pokes at the puck, <b>Space</b> lunges at the carrier (a hit if you reach them, and out of the play for a moment if you don't), <b>Shift</b> held lifts your stick into the passing lane, and <b>E</b> switches to the next skater. The goalie is never yours. Let go of the keys for ${wHK.hands.idle} seconds and your skater plays on by themselves. On a phone, the buttons under the rink do the same.</p>
  <p class="hint"><b>Aiming.</b> The way you steer as you let a shot go picks the target, marked on the net while you wind up: up or down the screen for that post, with the way to the goal held as well for the top corner, and nothing held for between the pads. The goalie covers what they can reach: the post they have moved away from is open and the one they stand at is shut. The top corners score more and miss more. Between the pads is good on a goalie who is sliding across.</p>
  <p class="hint"><b>The one-timer by hand.</b> Press Space while a pass is on its way to you. Inside the last ${Math.round(wHK.hands.oneT * 100) / 100} seconds before it arrives, it is shot as it lands. Earlier than that and you fan on it.</p>
  <p class="hint"><b>The face-off by hand.</b> Press Space as the puck drops: a ring closes on the dot and turns green in the moment to press. Close to the drop wins more of them; too early and you've jumped it, and win fewer.</p>
  <p class="hint"><b>The camera.</b> The picture shows the whole sheet through the middle, and pushes in on an end once the puck is in it.</p>
  <p class="hint"><b>Ratings.</b> Six for each player: speed, size, hands, shot, defense and reflexes. An ogre hits like a wall and skates like one, a harpy is the fastest thing on the ice, and a spider in goal has eight ways to stop a puck. <b>The spots:</b> a centre, two wings, two defenders and the goalie, picked from the ratings for now.</p>`;
}
const wW88RenderHelp = renderHelp;
renderHelp = function () {
  wW88RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpRink') || !$('wHelpGrounds')) return;
  const after = $('wHelpCourt') || [...h.querySelectorAll('[id^="wHelpG"], #wHelpRing')].pop();
  h.insertAdjacentHTML('beforeend', `<section id="wRinkHow" class="wghelp"><h3>Hockey: how it works</h3>${wRinkHowHTML()}</section>`);
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpRink"><b>Real hockey.</b> The Pond Rink is trying out hockey on the ice itself, five skaters and a goalie a side. Ask Old Tove for a SCRIMMAGE: three periods on the game clock (six minutes in all, or set the length in Settings). Play Rimewatch by hand, or watch the two clubs skate it end to end: passes, shots and saves, rebounds, checks, face-offs and icing, with a box score under the rink (see Hockey: how it works). A SCRIMMAGE is an exhibition: nothing is won or lost.</p>`);
};
