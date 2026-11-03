/* w42: the gridiron (issue #9, phase 1). Cinder Gridiron, the football engine, runs in the wGF scope (src/gf/ and
   src/realm/gridiron/: a canvas in #v-gridiron, and none of its names reach ours). This part gives it a view beside the
   world, a bar above the field, and a way back.
   Phase 1 plays one drive: the Cinderhold Football Club has the ball on its own 25 against a visiting side. Ask Clinker
   Dunn at the Ash Bowl for a DRIVE. Phase 2 plays a whole game, GRIDIRON (10-game.js): two halves on the clock, and in Call the
   plays you pick your side's defense too when the other side has the ball. Three modes on the bar (W_GRID_MODES):
   Coaches, You call, and You play (11-play.js: you play your offense by hand; on defense you call and watch). The coaches call both sides, or you call Cinderhold's plays from the bar (the
   defense stays the coaches'; you may punt or kick on any down, and fourth down is yours). Under the field: who is on
   it with their ratings (hover a row to find them), the drive so far, play by play with why each went the way it did,
   and a button to How to play, where "Football: how it works" (#wGridHow) has the whole of it: each later part adds its
   piece to W_GRID_HOW. The game waits while How to play (or any page but Play) is up.
   Wraps: showView (wW42ShowView: the bar), openPause (wW42OpenPause: not on the gridiron), wRunAct (wW42RunAct: 'drive'),
   showPage (wW42ShowPage: the wait), renderHelp (wW42RenderHelp: #wHelpGridiron and #wGridHow). Leaving or starting
   over mid-game asks first (wGridForfeit). */

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
  <section><h4 id="wGridLogH">This drive</h4><table id="wGridStats" class="wgstats"></table><p id="wGridSeen" class="hint"></p><ol id="wGridLog" class="wglog"></ol></section>
  <p class="hint wghowlink">How the game works: the downs, the plays and defenses, powers and the bench. <button class="ghost" id="wGridHowBtn">How to play football</button> <small>The game waits while you read.</small></p></div>`);
$('wGridHowBtn').addEventListener('click', wGridOpenHow);
// How to play, at Football: how it works (the game waits; see showPage below)
function wGridOpenHow() {
  showPage('help');
  const h = $('wGridHow'); if (h) h.scrollIntoView({ block: 'start' });
}
$('wGridLineup').addEventListener('mouseover', e => { const r = e.target.closest('[data-gpos]'); wGF.highlight(r ? { side: +r.dataset.gside, pos: r.dataset.gpos } : null); });
$('wGridLineup').addEventListener('mouseleave', () => wGF.highlight(null));

// the playbook (phase 4): each call button shows how fresh the play is, as a bar along its foot and a word once it
// tires; and the panel says what the other coach has seen of your calls lately
function wGridFresh() {
  const F = wGF.fresh(0); if (!F) return;
  const mark = (b, f, what) => { const pct = Math.round(f * 100), word = f >= .8 ? '' : f >= .45 ? 'worn' : 'tired';
    b.style.setProperty('--fresh', pct + '%'); b.classList.toggle('wgtired', f < .45); b.classList.toggle('wgworn', f >= .45 && f < .8);
    b.dataset.fresh = word; b.title = `${what} Fresh: ${pct}%.${word ? ' Called a lot lately, so they see it coming.' : ''}`; };
  for (const b of $('wGridCalls').querySelectorAll('[data-gcall]')) mark(b, F.off[b.dataset.gcall], wGF.plays[b.dataset.gcall].desc + ' ' + wGridEdgeLine(b.dataset.gcall));
  for (const b of $('wGridDefs').querySelectorAll('[data-gdef]')) mark(b, F.def[b.dataset.gdef], wGF.defs[b.dataset.gdef].desc);
  const T = wGF.tendency(0, wGF.yourBall ? 'off' : 'def'), names = wGF.yourBall ? wGF.plays : wGF.defs;
  const seen = Object.entries(T).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${names[k].n} ${Math.round(v * 100)}%`);
  $('wGridSeen').textContent = WGF && WGF.mode !== 'watch' && seen.length ? `What they've seen of your ${wGF.yourBall ? 'plays' : 'defenses'} lately: ${seen.join(', ')}. Their coach calls to beat it.` : '';
}
// what a call is good and bad against, from the engine's matchups
function wGridEdgeLine(oc) {
  const by = g => Object.keys(wGF.defs).filter(d => wGF.edge(oc, d)[0] === g).map(d => wGF.defs[d].n).join(' and ');
  const good = by(1), bad = by(-1);
  return [good && `Good against ${good}.`, bad && `Weak against ${bad}.`].filter(Boolean).join(' ');
}
// Football: how it works, in How to play: this, then what each later part adds (w45 powers, w48 the bench)
const W_GRID_HOW = [() => wGridHowHTML()];
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
  <p class="hint"><b>Plays tire.</b> Calling a play tires it, and it recovers while you call others; the half freshens everything. A tired play is one they see coming: the defense jumps it and wins more blocks. The bar along the foot of each button is how fresh it is. Their coach also watches what you call and leans to what beats it, so mixing it up pays twice. Their calls tire too: a defense they keep calling is easier to beat.</p>
  <p class="hint"><b>The defenses.</b> In a game you pick one of these when they have the ball.</p><ul class="wghow">${Object.values(wGF.defs).map(d => li(d.n, d.desc)).join('')}</ul>
  <p class="hint"><b>Reading the field.</b> The blue line is the line of scrimmage; the orange line is the line to gain. The ring is around whoever has the ball, with their name over them. On a big play (a breakaway, a deep ball, a broken tackle, a run at the goal line, a touchdown, an interception or a fumble) the camera zooms in on the ball and says why. A spark between two players is a block: white while the blocker holds, red when the defender is winning. Between plays, each player's position is under them; hover a player in <b>On the field</b> to find them. After each play the bar says what happened and why, a banner on the grass calls a first down, a long gain, a sack, a fumble or a score, and <b>This drive</b> keeps every play, under each side's yards, passing, running, sacks, interceptions and fumbles lost so far and their leaders.</p>
  <p class="hint"><b>The ratings</b> (higher is better; your own players' run to 12): ${Object.values(W_GRID_STAT).map(([a, b]) => `<b>${a}</b> ${esc(b.replace(/:.*/, '').toLowerCase())}`).join(', ')}. The best arm throws, the strongest block, and the fastest cover.</p>`;
}
function wGridLineup() {
  const st = wGF.stats;
  return wGF.lineup().map(t => `<div class="tablewrap"><table class="wgline"><caption><i style="background:${t.color}"></i>${esc(t.team)}: ${t.side ? 'defense' : 'offense'}</caption>
    <thead><tr><th>Pos</th><th>Player</th>${st.map(k => `<th title="${esc(W_GRID_STAT[k][1])}">${W_GRID_STAT[k][0]}</th>`).join('')}<th title="Stamina: every play costs a little and casting a power a lot; below half a player is slower and weaker. The half gives plenty back.">Sta</th></tr></thead>
    <tbody>${t.players.map(p => { const P = W_GRID_POS[p.pos] || [p.pos, []], B = wGF.powerBook[p.kind] || {};
      const pw = [B.off && `${B.off.n} (offense)`, B.def && `${B.def.n} (defense)`, B.ult && `★ ${B.ult.n} (once a game)`].filter(Boolean).join(', ');
      return `<tr data-gside="${t.side}" data-gpos="${p.pos}"><td title="${esc(P[0])}"><b>${p.pos}</b></td><td title="${esc('Powers: ' + pw)}">${esc(p.n)} <small>#${p.num}</small></td>${st.map(k => `<td class="${P[1].includes(k) ? 'wgkey' : ''}">${p.r[k]}</td>`).join('')}<td class="${p.stam < 50 ? 'wgbad' : ''}">${p.stam}</td></tr>`; }).join('')}</tbody></table>
    ${t.side ? '' : `<p class="hint">Kicker: ${esc(t.kicker)}. The bold ratings matter most in each position. Point at a name for that player's powers.</p>`}</div>`).join('');
}
const W_GRID_ORD = ['', '1st', '2nd', '3rd', '4th'];
// a side's total of one stat in a box score, and its yards from scrimmage (passing and running); the panel and the
// game's settle (w44) both count yards this way
const wGridSum = (box, s, k) => box.filter(b => b.side === s).reduce((n, b) => n + (b.line[k] || 0), 0);
const wGridYards = (box, s) => wGridSum(box, s, 'py') + wGridSum(box, s, 'ry');
// the team stats so far, side by side, and each side's leaders, from the box score
function wGridStats() {
  const G = wGF.G, box = wGF.box(); if (!G || !box.length) return '';
  const sum = (s, k) => wGridSum(box, s, k);
  const top = (s, k) => box.filter(b => b.side === s && b.line[k] > 0).sort((a, b) => b.line[k] - a.line[k])[0];
  if (![0, 1].some(s => sum(s, 'pa') + sum(s, 'ra') + sum(s, 'fga'))) return '';
  const rows = [
    ['Total yards', s => wGridYards(box, s)],
    ['Passing', s => `${sum(s, 'pc')}/${sum(s, 'pa')} <small>for</small> ${sum(s, 'py')}`],
    ['Running', s => `${sum(s, 'ra')} <small>for</small> ${sum(s, 'ry')}`],
    ['Sacks made', s => sum(s, 'sk')],
    ['Interceptions', s => sum(s, 'ints')],
    ['Fumbles lost', s => sum(s, 'fuml')],
    ['Field goals', s => `${sum(s, 'fgm')}/${sum(s, 'fga')}`],
  ];
  const lead = s => [['py', 'passing', 'yd'], ['ry', 'running', 'yd'], ['recy', 'catching', 'yd'], ['tkl', 'tackles', '']]
    .map(([k, w, u]) => { const b = top(s, k); return b ? `${esc(b.n)} ${b.line[k]}${u ? ' ' + u : ''} <small>${w}</small>` : ''; }).filter(Boolean).join(', ');
  const name = s => `<i style="background:${esc(G.teams[s].color)}"></i>${esc(G.teams[s].short || G.teams[s].name)}`;
  return `<thead><tr><th></th><th>${name(0)}</th><th>${name(1)}</th></tr></thead><tbody>${rows.map(([l, f]) => `<tr><td>${l}</td><td>${f(0)}</td><td>${f(1)}</td></tr>`).join('')}
    ${[0, 1].map(s => lead(s) ? `<tr><td>Leaders</td><td colspan="2" style="text-align:left">${name(s)}: ${lead(s)}</td></tr>` : '').join('')}</tbody>`;
}
function wGridLog() {
  const G = wGF.G; if (!G || !G.drive) return '';
  const drives = (G.drives || []).concat((G.drives || []).includes(G.drive) ? [] : [G.drive]), game = wGF.isGame;
  if (!drives.some(d => d.plays.length)) return '<li class="hint">No plays yet.</li>';
  return drives.map(d => (game && d.plays.length ? `<li class="wghead"><b>${esc(G.teams[d.side].name)}</b> · ${['', '1st half', '2nd half', 'Sudden Death'][d.half] || ''}${d.end ? ` · ${esc(W_GRID_END[d.end] || d.end)}, ${d.plays.length} play${d.plays.length === 1 ? '' : 's'}, ${d.yards} yards` : ''}</li>` : '')
    + d.plays.map(e => wGridLogLine(e, d.side)).join('')).join('') + (wGF.phase === 'over' ? '' : wGridNotesLine(wGF.notes(), ['pre', 'live'].includes(wGF.phase) ? 'This play' : 'Before the next play'));
}
// the powers cast on a play, and the swaps, potions and stamina given back since the last one, each with its team
function wGridNotesLine(notes, head) {
  const G = wGF.G; if (!G || !notes || !notes.length) return '';
  const who = s => esc(G.teams[s] ? G.teams[s].short || G.teams[s].name : '');
  const ico = { swap: '⇄', rest: '✚', pow: '◆' };
  return (head ? `<li class="wgnote"><small>${esc(head)}</small>` : '') + notes.map(n => `<span class="wgnote${n.k}">${ico[n.k] || ''} <b>${who(n.side)}</b> ${esc(n.msg)}</span>`).join('') + (head ? '</li>' : '');
}
const W_GRID_END = { clock: 'the clock ran out', td: 'Touchdown', fg: 'Field goal', miss: 'Missed field goal', punt: 'Punt', downs: 'Turnover on downs', int: 'Interception', safety: 'Safety', fum: 'Fumble', fumtd: 'Fumble, run back for a touchdown' };
// a play in the log, marked green when it went your side's way and red when it didn't
function wGridLogLine(e, side) {
  { const kick = e.oc === 'punt' || e.oc === 'fg' || !e.dc, spot = e.ball < 50 ? 'own ' + e.ball : e.ball === 50 ? 'midfield' : 'their ' + (100 - e.ball);
    const tag = i => e.st && typeof wGridStanceTag === 'function' ? wGridStanceTag(e.st[i]) : '';
    const call = kick ? (e.oc === 'fg' ? 'Field goal' : 'Punt') : `${wGF.plays[e.oc].n}${tag(0)} vs ${wGF.defs[e.dc].n}${tag(1)}`, g = kick ? 0 : wGF.edge(e.oc, e.dc)[0] * (side ? -1 : 1);
    return `<li class="${g > 0 ? 'wggood' : g < 0 ? 'wgbad' : ''}"><small>${W_GRID_ORD[e.down] || ''}${e.togo ? ' & ' + e.togo : ''} · ${spot}</small> <b>${esc(call)}</b>${kick ? '' : ` <em>${e.gain > 0 ? '+' : ''}${e.gain}</em>`}<br>${esc(e.msg || '')}<span>${esc(e.why || '')}</span>${wGridNotesLine((e.pw || []).map(p => ({ side: p.side, k: 'pow', msg: `${p.ult ? '★ ' : ''}${p.name} (${p.n})` })).concat(e.notes || []))}</li>`; }
}
function wGridTeams() {
  const g = W_GRDS.find(x => x.id === 'g_bowl'), H = W_GRID.home, A = W_GRID.away;
  return [Object.assign({ name: wGrdClub(g) }, H), Object.assign({ name: `${W_GRD_CITY[A.city]} ${SPORT_NAME.football} Club` }, A)];
}
/* one drive, or a whole game, on the field. opts: { mode: 'watch' | 'call' | 'play', seed, teams?, skill? } (teams: the two
   sides, yours first; skill: the CPU's casting skill by side, 0 to 2; by default the Cinderhold Football Club against the visitors). Start over keeps the same sides. */
function wGridironDrive(opts) { return wGridStart('drive', opts); }
function wGridironGame(opts) { return wGridStart('game', opts); }
function wGridStart(kind, opts) {
  const o = Object.assign({ mode: (WGF && WGF.mode) || (kind === 'game' ? 'call' : 'watch') }, opts || {});
  const teams = o.teams || (WGF && WGF.kind === kind && WGF.teams) || wGridTeams(), skill = o.skill || (WGF && WGF.kind === kind && WGF.skill) || null;
  WGF = { kind, mode: o.mode, over: null, teams, skill };
  WGRID_HOLD.clear(); wGridHold();
  wGF[kind === 'game' ? 'game' : 'start']({ teams, mode: o.mode, seed: o.seed, skill });
  wGridChrome(kind);
  showView('gridiron');
  wGridBar();
}
// the bar's titles for a drive or a game
function wGridChrome(kind) {
  $('wGridLogH').textContent = kind === 'game' ? 'This game' : 'This drive';
  $('wGridTitle').textContent = kind === 'game' ? 'A game at the Ash Bowl' : 'A drive at the Ash Bowl';
  $('wGridModes').hidden = false;
}
function wGridBar() {
  if (!WGF) return;
  const call = WGF.mode !== 'watch', yours = call && wGF.phase === 'call', off = wGF.yourBall;
  for (const b of $('wGridModes').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.gmode === WGF.mode); b.setAttribute('aria-pressed', b.dataset.gmode === WGF.mode); }
  $('wGridCalls').hidden = !call || !off; $('wGridDefs').hidden = !call || off;
  for (const b of $('wGridDefs').querySelectorAll('button')) b.disabled = !yours || !wGF.canCall(b.dataset.gdef);
  for (const b of $('wGridCalls').querySelectorAll('button')) b.disabled = !yours || !wGF.canCall(b.dataset.gcall || b.dataset.gkick);
  wGridFresh();
  const k = wGF.kick(), fg = $('wGridCalls').querySelector('[data-gkick="fg"]');
  if (k) { fg.textContent = k.inRange ? `Field goal (${k.dist} yd, ${Math.round(k.chance * 100)}%)` : 'Field goal'; fg.title = k.inRange ? 'Kick it through the posts for 3 points.' : 'Too far out: get inside about 62 yards first.'; }
  const fourth = wGF.G && wGF.G.down === 4;
  const ck = wGF.clock();
  $('wGridNote').textContent = WGF.over ? (WGF.kind === 'game' ? 'The game is over.' : 'The drive is over.')
    : yours && !off ? `Your call: pick a defense.${ck ? ` ${ck.name}, ${ck.text} left.` : ''}`
    : yours && fourth ? `Fourth down: go for it, punt, or kick. The coach would ${k.coach === 'fg' ? 'kick the field goal' : k.coach === 'go' ? 'go for it' : 'punt'}${k.wary && k.coach !== 'fg' ? `, careful of a fumble: ${k.wary}${k.coach === 'go' ? ' (on Safe)' : ''}` : ''}.`
    : yours ? `Your call: pick a play, or kick.${ck ? ` ${ck.name}, ${ck.text} left.` : ''}`
    : WGF.mode === 'play' && off ? 'You play it: Space to throw (hold to lead) or stiff-arm, WASD to run, Q and E for another receiver.' : call ? (WGF.kind === 'game' ? 'You call your side\'s plays, on offense and on defense.' : 'You call the offense; the coaches call the defense.') : 'The coaches call both sides.';
  $('wGridLineup').innerHTML = wGridLineup();
  $('wGridStats').innerHTML = wGridStats();
  $('wGridLog').innerHTML = wGridLog();
  $('wGridLog').scrollTop = $('wGridLog').scrollHeight;
}
// leaving or starting over in the middle of a game forfeits it: ask first, with the field paused while you decide.
// A practice drive, or a game that's over, goes at once.
function wGridForfeit(title, go, ok) {
  if (!WGF || WGF.kind !== 'game' || WGF.over || !wGF.live) return go();
  wGridHold('ask', true);
  askConfirm(title, 'The game isn\'t over: leaving now forfeits it. Nothing is won or lost at the Ash Bowl yet, but the score is gone.', ok, () => { wGridHold('ask', false); go(); }, () => wGridHold('ask', false));
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
  document.body.classList.toggle('wgwide', v === 'gridiron');
  if (v === 'gridiron') { $('runbar').hidden = true;
    // the game fills the window: the bar at the top, the field under it (the field is sized to fit, g1-page.js)
    requestAnimationFrame(() => scrollTo({ top: Math.max(0, $('wGridBar').getBoundingClientRect().top + scrollY - 6) })); }
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

// the game waits while another page (How to play, the Bestiary, Records) is up
const wW42ShowPage = showPage;
showPage = function (p) {
  wW42ShowPage(p);
  if (WGF && UI.view === 'gridiron' && wGF.live) wGridHold('page', p !== 'play');
};
// why the field is held still: a question asked ('ask'), another page up ('page'); it runs when there's none
const WGRID_HOLD = new Set();
function wGridHold(why, on) { if (why) { if (on) WGRID_HOLD.add(why); else WGRID_HOLD.delete(why); } wGF.pause(WGRID_HOLD.size > 0); }
const wW42RenderHelp = renderHelp;
renderHelp = function () {
  wW42RenderHelp();
  const g = $('wHelpGrounds'); if (!g || $('wHelpGridiron')) return;
  $('wHelp').insertAdjacentHTML('beforeend', `<section id="wGridHow" class="wghelp"><h3>Football: how it works</h3>${W_GRID_HOW.map(f => f()).join('')}</section>`);
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpGridiron"><b>Real football.</b> The Ash Bowl is trying out a new game: football on the grass, seven a side, and the same seven play offense and defense. Ask Clinker Dunn for GRIDIRON (a whole game: two halves on the clock, about seven minutes, both sides' drives) or a DRIVE (one drive, to practise). Watch the Cinderhold Football Club, call its plays yourself, or play its offense by hand: hold Space to lead a receiver and let go to throw, steer with WASD, Space for a stiff-arm, and tap Space twice to kick. Four downs to gain 10 yards; a touchdown is 6 points and a field goal 3. Each down, pick Run, Short pass, Deep pass or Screen, or kick: a punt on any down, or a field goal in range (the button shows the distance and the chance). The other coach picks a defense at the same moment. In a game you pick a defense when they have the ball, and a tie at the end goes to Sudden Death: the first score wins. Each defense is good against some plays and weak against others: a blitz stops the run and the deep pass but loses to the screen, and a deep zone gives up runs. After each play the bar says what happened and why. Plays tire with use and recover while you call others, and their coach calls to beat what you keep calling. Under the field: who is on it with their ratings, every play of the drive, and the full rules. Nothing is won or lost yet.</p>`);
};
