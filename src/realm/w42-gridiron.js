/* w42: the gridiron (issue #9, phase 1). Cinder Gridiron, the football engine, runs in the wGF scope (src/gf/ and
   src/realm/gridiron/: a canvas in #v-gridiron, and none of its names reach ours). This part gives it a view beside the
   world, a bar above the field, and a way back.
   Phase 1 plays one drive: the Cinderhold Football Club has the ball on its own 25 against a visiting side. Ask Clinker
   Dunn at the Ash Bowl for a DRIVE. Phase 2 plays a whole game, GRIDIRON (10-game.js): two halves on the clock, and in Call the
   plays you pick your side's defense too when the other side has the ball. Three modes on the bar (W_GRID_MODES):
   Coaches, You call, and You play (11-play.js: you play your offense by hand; on defense you call and watch). The coaches call both sides, or you call Cinderhold's plays from the bar (the
   defense stays the coaches'; you may punt or kick on any down, and fourth down is yours). Under the field: who is on
   it with their ratings (hover a row to find them), the drive so far, play by play with why each went the way it did,
   and how it works. Nothing is won or lost, and nothing is saved. Games at the Bowl come in phase 5.
   Wraps: showView (wW42ShowView: the bar), openPause (wW42OpenPause: not on the gridiron), wRunAct (wW42RunAct: 'drive'),
   renderHelp (wW42RenderHelp: #wHelpGridiron). Leaving or starting over mid-game asks first (wGridForfeit). */

// who plays it: the coaches, you calling the plays, or you calling them and playing your offense by hand
const W_GRID_MODES = {
  watch: { n: 'Coaches', title: 'The coaches call every play, both sides. Switching goes on with the same game.' },
  call: { n: 'You call', title: 'You call your side\'s plays from the bar, and its defense in a game. Your players run them.' },
  play: { n: 'You play', title: 'You call the plays, then play your offense by hand: Space to throw or stiff-arm, WASD to run, Space twice to kick. On defense you call and watch.' },
};
// a position's name and the ratings that matter most there
const W_GRID_POS = {
  QB: ['Quarterback', ['arm']], RB: ['Running back', ['spd', 'str']], C: ['Center', ['str']], LG: ['Left guard', ['str']], RG: ['Right guard', ['str']],
  X: ['Receiver', ['spd', 'hnd']], Z: ['Receiver', ['spd', 'hnd']], DT: ['Tackle', ['str', 'tkl']], DL: ['End', ['str', 'tkl']], DR: ['End', ['str', 'tkl']],
  LB: ['Linebacker', ['tkl', 'spd']], CL: ['Corner', ['spd']], CR: ['Corner', ['spd']], S: ['Safety', ['spd', 'tkl']],
};
const W_GRID_STAT = { spd: ['Spd', 'Speed'], str: ['Str', 'Strength: blocking, shedding blocks, breaking tackles'], hnd: ['Hnd', 'Hands: catching'],
  arm: ['Arm', 'Arm: how far and how true the throw'], kck: ['Kck', 'Kicking'], tkl: ['Tkl', 'Tackling'] };
const W_GRID = {
  home: { kinds: ['kobold', 'minotaur', 'golem', 'ogre', 'dwarf', 'goblin', 'troll'], color: '#c8461e', light: '#ffd08a', short: 'CFC' },
  away: { city: 'mossgate', kinds: ['harpy', 'elf', 'golem', 'zombie', 'troll', 'skeleton', 'goblin'], color: '#3f8a5a', light: '#e8f4c8', short: 'MFC' },
};
// the drive on the field: plain data, never saved
let WGF = null;

$('v-gridiron').insertAdjacentHTML('beforebegin', `<div id="wGridBar" class="wdbar" hidden>
  <b id="wGridTitle">A drive at the Ash Bowl</b><span id="wGridNote" class="hint"></span>
  <span id="wGridDefs" hidden>${Object.entries(wGF.defs).map(([k, d]) => `<button class="ghost" data-gdef="${k}" title="${esc(d.desc)}">${esc(d.n)}</button>`).join('')}</span>
  <span id="wGridCalls">${Object.entries(wGF.plays).map(([k, p]) => `<button class="ghost" data-gcall="${k}" title="${esc(p.desc + ' ' + wGridEdgeLine(k))}">${esc(p.n)}</button>`).join('')}<button class="ghost" data-gkick="punt" title="Kick it away: the other side gets the ball far from your goal line.">Punt</button><button class="ghost" data-gkick="fg"></button></span>
  <span id="wGridModes" class="wgmodes" role="group" aria-label="Who plays it">${Object.entries(W_GRID_MODES).map(([k, m]) => `<button class="ghost" data-gmode="${k}" title="${esc(m.title)}">${esc(m.n)}</button>`).join('')}</span><button class="ghost" id="wGridAgain" title="Throw this one away and start again.">Start over</button>
  <button class="ghost" id="wGridBack">Back to the world</button></div>`);
$('wGridBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.gcall || b.dataset.gkick || b.dataset.gdef) { wGF.call(b.dataset.gcall || b.dataset.gkick || b.dataset.gdef); wGridBar(); }
  // switching who calls it doesn't restart: the drive (or the game) goes on, or a new one starts once it is over
  else if (b.dataset.gmode) { if (b.dataset.gmode === WGF.mode) return; WGF.mode = b.dataset.gmode; if (WGF.over) (WGF.kind === 'game' ? wGridironGame : wGridironDrive)({ mode: WGF.mode }); else { wGF.setMode(WGF.mode); wGridBar(); } }
  else if (b.id === 'wGridAgain') wGridForfeit('Start over?', () => (WGF.kind === 'game' ? wGridironGame : wGridironDrive)({ mode: WGF.mode }), 'Start over');
  else if (b.id === 'wGridBack') wGridForfeit('Forfeit the game?', wLeaveGridiron, 'Forfeit and leave');
});

// under the field: who is on it, the drive so far, and how it works
$('v-gridiron').insertAdjacentHTML('beforeend', `<div id="wGridPanel" class="wgp">
  <section><h4>On the field</h4><div id="wGridLineup"></div></section>
  <section><h4 id="wGridLogH">This drive</h4><ol id="wGridLog" class="wglog"></ol></section>
  <details id="wGridHow" open><summary>How it works</summary>${wGridHowHTML()}</details></div>`);
$('wGridLineup').addEventListener('mouseover', e => { const r = e.target.closest('[data-gpos]'); wGF.highlight(r ? { side: +r.dataset.gside, pos: r.dataset.gpos } : null); });
$('wGridLineup').addEventListener('mouseleave', () => wGF.highlight(null));

// what a call is good and bad against, from the engine's matchups
function wGridEdgeLine(oc) {
  const by = g => Object.keys(wGF.defs).filter(d => wGF.edge(oc, d)[0] === g).map(d => wGF.defs[d].n).join(' and ');
  const good = by(1), bad = by(-1);
  return [good && `Good against ${good}.`, bad && `Weak against ${bad}.`].filter(Boolean).join(' ');
}
function wGridHowHTML() {
  const li = (n, d, x) => `<li><b>${esc(n)}</b>: ${esc(d)}${x ? ` <i>${esc(x)}</i>` : ''}</li>`;
  return `<p class="hint">You have four downs to gain 10 yards. Make them and the downs start over; reach the end zone for a touchdown (6 points, and the extra point makes 7). If you're stuck, punt the ball away or kick a field goal (3 points). Seven a side, and the same seven play offense and defense.</p>
  <p class="hint"><b>A game</b> is two halves on the clock. The clock runs through each play and between plays, and stops on an incompletion, out of bounds, a score or a change of possession. After a score the side that scored kicks off. Tied at the end, it goes to <b>Sudden Death</b>: the first score wins.</p>
  <p class="hint"><b>Your calls.</b> Pick a play each down; the other coach picks a defense at the same moment, and you see both at the snap.</p>
  <p class="hint"><b>Who plays it.</b> <b>Coaches</b>: they call every play. <b>You call</b>: you pick your side's plays from the bar (and its defense, in a game), and your players run them. <b>You play</b>: you call them, then play your offense by hand. Switch any time; the game goes on.</p>
  <p class="hint"><b>Playing it by hand.</b> On a pass the quarterback waits for you. The dashed ring is your receiver (the one with the most room, or press Q or E for another). Hold <b>Space</b> and a marker runs out ahead of them, further the longer you hold, while the rush keeps coming; let go to throw there. With the ball, <b>WASD</b> or the arrows steer (let go and they find their own lane), and <b>Space</b> once a play is a stiff-arm that shrugs off the next tackle. The quarterback can scramble too, but can't throw once past the line. Your punts and field goals are a meter: tap <b>Space</b> for the power (a field goal needs the white mark), then again for the aim (inside the green). On defense you call the defense and watch.</p>
  <p class="hint"><b>The bar.</b> <b>Start over</b> begins again, and <b>Back to the world</b> leaves; in the middle of a game both ask first, because leaving forfeits it.</p>
  <ul class="wghow">${Object.keys(wGF.plays).map(k => li(wGF.plays[k].n, wGF.plays[k].desc, wGridEdgeLine(k))).join('')}
  ${li('Punt', 'Kick it away on any down. The drive ends, but the other side starts far from your goal line.')}
  ${li('Field goal', 'Kick it through the posts for 3 points. The button shows the distance and the chance; the longest try is about 62 yards.')}</ul>
  <p class="hint"><b>The defenses.</b> In a game you pick one of these when they have the ball.</p><ul class="wghow">${Object.values(wGF.defs).map(d => li(d.n, d.desc)).join('')}</ul>
  <p class="hint"><b>Reading the field.</b> The blue line is the line of scrimmage; the orange line is the line to gain. The ring is around whoever has the ball. A spark between two players is a block: white while the blocker holds, red when the defender is winning. Between plays, each player's position is under them; hover a player in <b>On the field</b> to find them. After each play the bar says what happened and why, and <b>This drive</b> keeps every play.</p>
  <p class="hint"><b>The ratings</b>, 1 to 10: ${Object.values(W_GRID_STAT).map(([a, b]) => `<b>${a}</b> ${esc(b.replace(/:.*/, '').toLowerCase())}`).join(', ')}. The best arm throws, the strongest block, and the fastest cover.</p>`;
}
function wGridLineup() {
  const st = wGF.stats;
  return wGF.lineup().map(t => `<div class="tablewrap"><table class="wgline"><caption><i style="background:${t.color}"></i>${esc(t.team)}: ${t.side ? 'defense' : 'offense'}</caption>
    <thead><tr><th>Pos</th><th>Player</th>${st.map(k => `<th title="${esc(W_GRID_STAT[k][1])}">${W_GRID_STAT[k][0]}</th>`).join('')}</tr></thead>
    <tbody>${t.players.map(p => { const P = W_GRID_POS[p.pos] || [p.pos, []];
      return `<tr data-gside="${t.side}" data-gpos="${p.pos}"><td title="${esc(P[0])}"><b>${p.pos}</b></td><td>${esc(p.n)} <small>#${p.num}</small></td>${st.map(k => `<td class="${P[1].includes(k) ? 'wgkey' : ''}">${p.r[k]}</td>`).join('')}</tr>`; }).join('')}</tbody></table>
    ${t.side ? '' : `<p class="hint">Kicker: ${esc(t.kicker)}. The bold ratings matter most in each position.</p>`}</div>`).join('');
}
const W_GRID_ORD = ['', '1st', '2nd', '3rd', '4th'];
function wGridLog() {
  const G = wGF.G; if (!G || !G.drive) return '';
  const drives = (G.drives || []).concat((G.drives || []).includes(G.drive) ? [] : [G.drive]), game = wGF.isGame;
  if (!drives.some(d => d.plays.length)) return '<li class="hint">No plays yet.</li>';
  return drives.map(d => (game && d.plays.length ? `<li class="wghead"><b>${esc(G.teams[d.side].name)}</b> · ${['', '1st half', '2nd half', 'Sudden Death'][d.half] || ''}${d.end ? ` · ${esc(W_GRID_END[d.end] || d.end)}, ${d.plays.length} play${d.plays.length === 1 ? '' : 's'}, ${d.yards} yards` : ''}</li>` : '')
    + d.plays.map(e => wGridLogLine(e, d.side)).join('')).join('');
}
const W_GRID_END = { clock: 'the clock ran out', td: 'Touchdown', fg: 'Field goal', miss: 'Missed field goal', punt: 'Punt', downs: 'Turnover on downs', int: 'Interception', safety: 'Safety' };
// a play in the log, marked green when it went your side's way and red when it didn't
function wGridLogLine(e, side) {
  { const kick = e.oc === 'punt' || e.oc === 'fg' || !e.dc, spot = e.ball < 50 ? 'own ' + e.ball : e.ball === 50 ? 'midfield' : 'their ' + (100 - e.ball);
    const call = kick ? (e.oc === 'fg' ? 'Field goal' : 'Punt') : `${wGF.plays[e.oc].n} vs ${wGF.defs[e.dc].n}`, g = kick ? 0 : wGF.edge(e.oc, e.dc)[0] * (side ? -1 : 1);
    return `<li class="${g > 0 ? 'wggood' : g < 0 ? 'wgbad' : ''}"><small>${W_GRID_ORD[e.down] || ''}${e.togo ? ' & ' + e.togo : ''} · ${spot}</small> <b>${esc(call)}</b>${kick ? '' : ` <em>${e.gain > 0 ? '+' : ''}${e.gain}</em>`}<br>${esc(e.msg || '')}<span>${esc(e.why || '')}</span></li>`; }
}
function wGridTeams() {
  const g = W_GRDS.find(x => x.id === 'g_bowl'), H = W_GRID.home, A = W_GRID.away;
  return [Object.assign({ name: wGrdClub(g) }, H), Object.assign({ name: `${W_GRD_CITY[A.city]} ${SPORT_NAME.football} Club` }, A)];
}
/* one drive, or a whole game, on the field. opts: { mode: 'watch' | 'call', seed } */
function wGridironDrive(opts) { return wGridStart('drive', opts); }
function wGridironGame(opts) { return wGridStart('game', opts); }
function wGridStart(kind, opts) {
  const o = Object.assign({ mode: (WGF && WGF.mode) || (kind === 'game' ? 'call' : 'watch') }, opts || {});
  WGF = { kind, mode: o.mode, over: null };
  wGF[kind === 'game' ? 'game' : 'start']({ teams: wGridTeams(), mode: o.mode, seed: o.seed });
  $('wGridLogH').textContent = kind === 'game' ? 'This game' : 'This drive';
  $('wGridTitle').textContent = kind === 'game' ? 'A game at the Ash Bowl' : 'A drive at the Ash Bowl';
  showView('gridiron');
  wGridBar();
}
function wGridBar() {
  if (!WGF) return;
  const call = WGF.mode !== 'watch', yours = call && wGF.phase === 'call', off = wGF.yourBall;
  for (const b of $('wGridModes').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.gmode === WGF.mode); b.setAttribute('aria-pressed', b.dataset.gmode === WGF.mode); }
  $('wGridCalls').hidden = !call || !off; $('wGridDefs').hidden = !call || off;
  for (const b of $('wGridDefs').querySelectorAll('button')) b.disabled = !yours || !wGF.canCall(b.dataset.gdef);
  for (const b of $('wGridCalls').querySelectorAll('button')) b.disabled = !yours || !wGF.canCall(b.dataset.gcall || b.dataset.gkick);
  const k = wGF.kick(), fg = $('wGridCalls').querySelector('[data-gkick="fg"]');
  if (k) { fg.textContent = k.inRange ? `Field goal (${k.dist} yd, ${Math.round(k.chance * 100)}%)` : 'Field goal'; fg.title = k.inRange ? 'Kick it through the posts for 3 points.' : 'Too far out: get inside about 62 yards first.'; }
  const fourth = wGF.G && wGF.G.down === 4;
  const ck = wGF.clock();
  $('wGridNote').textContent = WGF.over ? (WGF.kind === 'game' ? 'The game is over.' : 'The drive is over.')
    : yours && !off ? `Your call: pick a defense.${ck ? ` ${ck.name}, ${ck.text} left.` : ''}`
    : yours && fourth ? `Fourth down: go for it, punt, or kick. The coach would ${k.coach === 'fg' ? 'kick the field goal' : k.coach === 'go' ? 'go for it' : 'punt'}.`
    : yours ? `Your call: pick a play, or kick.${ck ? ` ${ck.name}, ${ck.text} left.` : ''}`
    : WGF.mode === 'play' && off ? 'You play it: Space to throw (hold to lead) or stiff-arm, WASD to run, Q and E for another receiver.' : call ? (WGF.kind === 'game' ? 'You call your side\'s plays, on offense and on defense.' : 'You call the offense; the coaches call the defense.') : 'The coaches call both sides.';
  $('wGridLineup').innerHTML = wGridLineup();
  $('wGridLog').innerHTML = wGridLog();
  $('wGridLog').scrollTop = $('wGridLog').scrollHeight;
}
// leaving or starting over in the middle of a game forfeits it: ask first, with the field paused while you decide.
// A practice drive, or a game that's over, goes at once.
function wGridForfeit(title, go, ok) {
  if (!WGF || WGF.kind !== 'game' || WGF.over || !wGF.live) return go();
  wGF.pause(true);
  askConfirm(title, 'The game isn\'t over: leaving now forfeits it. Nothing is won or lost at the Ash Bowl yet, but the score is gone.', ok, () => { wGF.pause(false); go(); }, () => wGF.pause(false));
}
function wLeaveGridiron() {
  WGF = null;
  if (WG) showView('world');
  else { showScreen('title'); renderTitle(); }
}
wGF.onPhase = () => { if (UI.view === 'gridiron') wGridBar(); };
wGF.onOver = s => { if (WGF) { WGF.over = s; wGridBar(); $('wGridAgain').focus(); } };

const wW42ShowView = showView;
showView = function (v) {
  wW42ShowView(v);
  $('wGridBar').hidden = v !== 'gridiron';
  if (v === 'gridiron') $('runbar').hidden = true;
};
const wW42OpenPause = openPause;
openPause = function () { if (UI.view === 'gridiron') return; return wW42OpenPause.apply(this, arguments); };

// Clinker Dunn at the Ash Bowl puts on a drive
(() => {
  const K = DB.chars.gk_bowl; if (!K) return;
  K.topics.job.t += ' And come and see the new game on the grass: ask me for a DRIVE, or a whole game on the GRIDIRON.';
  // (not GAME or FOOTBALL: those are the card-game match and how card-game football scores)
  K.topics.gridiron = { t: 'Two halves on the clock, about seven minutes, and nothing riding on it. Call your side\'s plays on offense and its defense when they have the ball, or let the coaches have it.', act: 'ggame' };
  K.topics.drive = { t: 'Real football, seven a side and the same seven both ways. Our club has the ball on its own 25: four downs to make ten yards. Watch them go, or call the plays yourself, kicks and all. How it works is under the field.', act: 'drive' };
})();
const wW42RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'drive') return wGridironDrive(); if (act === 'ggame') return wGridironGame(); return wW42RunAct.apply(this, arguments); };

const wW42RenderHelp = renderHelp;
renderHelp = function () {
  wW42RenderHelp();
  const g = $('wHelpGrounds'); if (!g || $('wHelpGridiron')) return;
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpGridiron"><b>Real football.</b> The Ash Bowl is trying out a new game: football on the grass, seven a side, and the same seven play offense and defense. Ask Clinker Dunn for GRIDIRON (a whole game: two halves on the clock, about seven minutes, both sides' drives) or a DRIVE (one drive, to practise). Watch the Cinderhold Football Club, call its plays yourself, or play its offense by hand: hold Space to lead a receiver and let go to throw, steer with WASD, Space for a stiff-arm, and tap Space twice to kick. Four downs to gain 10 yards; a touchdown is 6 points and a field goal 3. Each down, pick Run, Short pass, Deep pass or Screen, or kick: a punt on any down, or a field goal in range (the button shows the distance and the chance). The other coach picks a defense at the same moment. In a game you pick a defense when they have the ball, and a tie at the end goes to Sudden Death: the first score wins. Each defense is good against some plays and weak against others: a blitz stops the run and the deep pass but loses to the screen, and a deep zone gives up runs. After each play the bar says what happened and why. Under the field: who is on it with their ratings, every play of the drive, and the full rules. Nothing is won or lost yet.</p>`);
};
