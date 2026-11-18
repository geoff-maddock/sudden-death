/* w105: the Links (issue #92, phase 2). Mossgate Links, the golf engine, runs in the wGL scope (src/gl/ and
   src/realm/links/: a canvas in #v-links, and none of its names reach ours). This part gives it a view beside the
   world, laid out as the other sports' pages are (w87): the bar with the status line under it, the course, the coach's
   rows (your shot), the scorecard and each side's players side by side, then This game (every hole).
   A game is four of Mossgate's against four visitors from Saltmere, captain's choice match play on the standing nine
   (or 3, 6 or 18 holes: SET.linksHoles, on the bar and the Settings panel). Ask Agatha Divot at the Links for a ROUND
   (GAME and GOLF stay the card-game match and how it scores). Nothing is won or lost, and nothing is saved.
   Two modes on the bar (W_LINKS_MODES): Watch (the CPU plays both sides) and You play (your shot is yours: the keys
   are in l1-page.js, and the rows under the course do the same with a mouse or a finger). Switching goes on with the
   same game; the last one picked is kept for the next (not saved).
   The rows, in You play on your shot: Hitter (the four, those who may not hit greyed with why), Club (what the lie
   allows), Shot (draw, straight or fade; normal, punch or lob; backspin, none or topspin), and Swing. On their short
   putt: Give it, or Make them putt.
   On a phone the scoreboard strip (w86) covers the Links too: W_SB_VIEWS.links and W_SB_HTML.links.
   Wraps: showView (wW105ShowView: the bar), openPause (wW105OpenPause: not on the Links), wRunAct (wW105RunAct:
   'linksround'), showPage (wW105ShowPage: the game waits while another page is up), renderHelp (wW105RenderHelp:
   #wHelpLinks and #wLinksHow). The Settings row goes in by an observer on the modal, as w88's does. */

const W_LINKS = {
  home: { kinds: ['elf', 'spider', 'witch', 'gorgon'], color: '#d8a03a', short: 'MGL' },
  away: { city: 'saltmere', kinds: ['minotaur', 'spider', 'elf', 'lich'], color: '#7a5ad0', short: 'SGC' },
};
const W_LINKS_MODES = {
  watch: { n: 'Watch', title: 'The CPU plays both sides. Switching goes on with the same game.' },
  manage: { n: 'Manage', title: 'Your caddie plays your side by your call: the line, the stances, the caddie\'s word, and the next hitter if you like, in the rows under the course. Your four swing on their ratings.' },
  play: { n: 'You play', title: 'You play Mossgate: pick the hitter, the club and the shot, aim, and swing (Space three times, or drag back from the ball). Their short putts are yours to give.' },
};
let W_LINKS_MODE = 'play', W_LINKS_SPEED = 1, W_LINKS_SKILL = 1;
const wLinksSkillNames = () => wGL.skills.names;
const wLinksHoles = () => wGL.rules.holesAt.includes(SET.linksHoles) ? SET.linksHoles : wGL.rules.holes;
// the game on the course: plain data, never saved
let WGL = null;

$('v-links').insertAdjacentHTML('beforebegin', `<div id="wLinksBar" class="wdbar" hidden>
  <b id="wLinksTitle">A round at Mossgate Links</b><span id="wLinksNote" class="hint wsnote"></span>
  <span id="wLinksModes" class="wgmodes" role="group" aria-label="Who plays it">${Object.entries(W_LINKS_MODES).map(([k, m]) => `<button class="ghost" data-lmode="${k}" title="${esc(m.title)}">${esc(m.n)}</button>`).join('')}</span>
  <label class="hint" title="How many holes a game is: the standing nine, cut short or played twice. Also on the Settings panel.">Holes <select id="wLinksHoles">${wGL.rules.holesAt.map(m => `<option value="${m}">${m}</option>`).join('')}</select></label>
 <label class="hint" title="How well the other side's caddie plays: a Squire misses the meter often, ignores the wind and takes the driver; a Knight reads the wind, the lie and the match; an Archmage also reads greens, lays up when it should and reads your habits.">Their caddie <select id="wLinksSkill">${wLinksSkillNames().map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select></label>
  <label class="hint" id="wLinksSpeedL" title="How fast the game runs while you watch. In You play it is always 1.">Speed <select id="wLinksSpeed"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
  <button class="ghost" id="wLinksAgain">Another game</button>
  <button class="ghost" id="wLinksBack">Back to the world</button></div>`);
$('wLinksBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.lmode) { W_LINKS_MODE = b.dataset.lmode; if (WGL && !WGL.over) wGL.setMode(W_LINKS_MODE); wLinksBarNote(); wLinksRows(); }
  else if (b.id === 'wLinksAgain') wLinksGame();
  else if (b.id === 'wLinksBack') wLeaveLinks();
});
function wLinksSpeedSet() { const play = wGL.mode === 'play'; wGL.speed = play ? 1 : W_LINKS_SPEED; $('wLinksSpeedL').hidden = play || !WGL || !!WGL.over; $('wLinksSpeed').value = String(W_LINKS_SPEED); }
$('wLinksSkill').addEventListener('change', e => { W_LINKS_SKILL = +e.target.value; e.target.blur(); $('wLinksNote').textContent = `Their caddie: a ${wLinksSkillNames()[W_LINKS_SKILL]}, from the next game.`; });
$('wLinksSpeed').addEventListener('change', e => { W_LINKS_SPEED = +e.target.value || 1; wLinksSpeedSet(); e.target.blur(); });
$('wLinksHoles').addEventListener('change', e => { SET.linksHoles = +e.target.value; saveSettings(); wLinksBarNote(); e.target.blur(); });

// under the course: your shot's rows, the scorecard and the players, this game, and How golf works
$('v-links').insertAdjacentHTML('beforeend', `<div id="wLinksRows" class="wccalls wscoach" hidden>
  <div class="wccrow" id="wLinksRowWho"><span class="wccl">Hitter</span><span id="wLinksWho"></span></div>
  <div class="wccrow" id="wLinksRowClub"><span class="wccl">Club</span><span id="wLinksClub"></span></div>
  <div class="wccrow" id="wLinksRowLine"><span class="wccl">Line</span><span id="wLinksLine"></span></div>
  <div class="wccrow" id="wLinksRowShot"><span class="wccl">Shot</span><span id="wLinksShot"></span></div>
  <div class="wccrow" id="wLinksRowStance"><span class="wccl">Stance</span><span id="wLinksStance"></span></div>
  <div class="wccrow" id="wLinksRowPow" hidden><span class="wccl">Powers</span><span id="wLinksPow"></span></div>
  <div class="wccrow" id="wLinksRowGo"><span class="wccl">Swing</span><span id="wLinksGo"></span></div>
  <div class="wccrow" id="wLinksRowMgr" hidden><span class="wccl">Your call</span><span id="wLinksMgr"></span></div>
  <div class="wccrow" id="wLinksRowNext" hidden><span class="wccl">Next hitter</span><span id="wLinksNext"></span></div>
  <div class="wccrow" id="wLinksRowGive" hidden><span class="wccl">Their putt</span><span><button class="ghost" data-lgive="1" title="Y: it counts as holed in one more">Give it</button> <button class="ghost" data-lgive="0" title="N: they must hole it">Make them putt</button></span></div></div>
  <h4 class="wsh">Scorecard</h4><div id="wLinksCard" class="wcbox"></div>
  <h4 class="wsh">This game</h4><ol id="wLinksLog" class="wglog wslog"></ol>
  <p class="hint wghowlink">How golf works here: the turn, the hitter rule, the swing, the wind, the lie and the green. <button class="ghost" id="wLinksHowBtn">How to play golf</button> <small>The game waits while you read.</small></p>`);
$('wLinksHowBtn').addEventListener('click', () => { showPage('help'); const h = $('wLinksHow'); if (h) h.scrollIntoView({ block: 'start' }); });
$('wLinksRows').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.lri != null) wGL.select({ ri: +d.lri });
  else if (d.lclub) wGL.select({ club: d.lclub });
  else if (d.lshape != null) wGL.select({ shape: d.lshape });
  else if (d.ltraj != null) wGL.select({ traj: d.ltraj });
  else if (d.lspin != null) wGL.select({ spin: +d.lspin });
  else if (d.lgo) wGL.press();
  else if (d.lline) wGL.select({ line: d.lline });
  else if (d.ltempo) wGL.select({ tempo: d.ltempo });
  else if (d.lmood) wGL.select({ mood: d.lmood });
  else if (d.lword) wGL.select({ word: true });
  else if (d.lpow) { const why = wGL.castMine(d.lpow); if (why) $('wLinksNote').textContent = why; }
  else if (d.lauto) wGL.autoPow = !wGL.autoPow;
  else if (d.lgive != null) wGL.offer(d.lgive === '1');
  else if (d.mline) wGL.manage({ line: d.mline });
  else if (d.mtempo) wGL.manage({ tempo: d.mtempo });
  else if (d.mmood) wGL.manage({ mood: d.mmood });
  else if (d.mword) wGL.manage({ word: true });
  else if (d.mnext != null) wGL.manage({ ri: d.mnext === '' ? null : +d.mnext });
  wLinksRows(); wLinksBarNote();
});

// why a player can't hit now
 // Manage's rows: your call (the line, with Auto for the caddie's own; the stances; the caddie's word) and the next
// hitter (the caddie's pick, or one of your four, once, if the rule allows)
function wLinksMgrRows(V) {
  const G = wGL.G, M = wGL.mgr, st = G.stance[V.you], on = (a, b) => a === b ? ' on' : '', L = wGL.lines, wl = G.word[V.you], won = G.wordOn[V.you];
  $('wLinksMgr').innerHTML = [['auto', 'Auto', 'The caddie reads the match and picks the line']].concat(Object.keys(L).map(k => [k, L[k].n, ''])).map(([k, n, t]) => `<button class="ghost${on(k, M.line)}" data-mline="${k}" title="${esc(t || 'Every shot on this line until you change it')}">${esc(n)}</button>`).join(' ') + ' · '
    + [['quick', 'Quick'], ['steady', 'Steady']].map(([k, n]) => `<button class="ghost${on(k, st.tempo)}" data-mtempo="${k}">${n}</button>`).join(' ') + ' · '
    + [['bold', 'Bold'], ['careful', 'Careful']].map(([k, n]) => `<button class="ghost${on(k, st.mood)}" data-mmood="${k}">${n}</button>`).join(' ') + ' · '
    + `<button class="ghost${won ? ' on' : ''}" data-mword="1" ${wl > 0 && !won ? '' : 'disabled'} title="Once a game: the next stroke read in full">${won ? 'Caddie\'s word: on' : `Caddie's word (${wl} left)`}</button>`;
  const T = G.teams[V.you];
  $('wLinksNext').innerHTML = `<button class="ghost${on(null, M.ri)}" data-mnext="">The caddie's pick</button> ` + T.roster.map((m, i) => `<button class="ghost${on(i, M.ri)}" data-mnext="${i}" title="Takes the next shot if the rule allows (then back to the caddie's pick)">${esc(m.n)} <small>${wGL.focus ? Math.round(wGL.focus[V.you][i] * 100) : 100}%</small></button>`).join(' ');
}
// the Powers row: mana and the roar, the hitter's power (or the caddie's pick's, in Manage), the ultimate, Steady, the
// situation powers that fit, Auto powers in Manage, and the bench's tip
function wLinksPowRow(V, show) {
  const G = wGL.G, row = $('wLinksRowPow');
  row.hidden = !show || !G || !G.powers;
  if (row.hidden) return;
  const s = V.you, ri = V.sel ? V.sel.ri : 0, P = wGL.powNow(s, ri), btn = (k, label, title) => { const why = wGL.powWhy(s, k, ri); return `<button class="ghost" data-lpow="${k}" ${why ? 'disabled' : ''} title="${esc(why ? `${title} (${why})` : title)}">${esc(label)}</button>`; };
  const U = wGL.ult[(G.teams[s].roster[ri] || {}).kind] || wGL.ult.goblin, sits = Object.keys(wGL.sit).filter(k => !wGL.powWhy(s, k, ri)); // (a situation power shows only when it can be cast)
  const tip = wGL.tip(s, ri);
  $('wLinksPow').innerHTML = `<small class="hint" title="Mana: good shots fill it. The roar: the gallery fills it.">Mana <b>${G.mana[s]}</b>/${wGL.manaRules.max} · Roar <b>${G.roar[s]}</b></small> `
    + (P ? btn('pow', `${P.n} (${P.cost})`, `P: ${P.desc}`) : '') + ' ' + btn('ult', `${U.n} (ultimate)`, `U: ${U.desc} Takes ${wGL.roarRules.ult} roar, once a game.`) + ' ' + btn('steady', 'Steady', `K: ${wGL.roarRules.steady} roar: no pressure on this stroke.`)
    + sits.map(k => ' ' + btn(k, wGL.sit[k].n, wGL.sit[k].desc)).join('')
    + (V.mode === 'manage' ? ` <button class="ghost${wGL.autoPow ? ' on' : ''}" data-lauto="1" title="Your caddie casts your side's powers by the moment, as a Knight would">Auto powers</button>` : '')
    + (tip ? ` <small class="hint">${esc(tip)}</small>` : '');
}
const wLinksWhyNot = (V, ri) => V.ph === 'swing' ? 'The swing is under way: the hitter is picked.' : wGL.whyNot(V.you, ri) || 'May hit.';
// the rows: drawn for the beat (your shot, their putt, or nothing to do)
function wLinksRows() {
  const box = $('wLinksRows'), V = WGL && !WGL.over && wGL.G && wGL.G.teams ? wGL.view : null, mine = V && V.mode === 'play' && (V.ph === 'aim' || V.ph === 'swing') && V.sel, offer = V && V.ph === 'offer';
  const mgr = !!V && V.mode === 'manage';
  box.hidden = !mine && !offer && !mgr;
  $('wLinksRowGive').hidden = !offer;
  $('wLinksRowMgr').hidden = $('wLinksRowNext').hidden = !mgr;
  if (mgr) wLinksMgrRows(V);
  wLinksPowRow(V, mine || mgr);
  for (const id of ['wLinksRowWho', 'wLinksRowClub', 'wLinksRowLine', 'wLinksRowShot', 'wLinksRowStance', 'wLinksRowGo']) $(id).hidden = !mine;
  if (!mine) return;
  const S = V.sel, G = wGL.G, T = G.teams[V.you], aim = V.ph === 'aim', on = (a, b) => a === b ? ' on' : '';
  $('wLinksWho').innerHTML = T.roster.map((m, i) => {
    // the player's role (if they have one), their focus, and their ratings on 1 to 12
    const role = Object.keys(T.roles || {}).find(k => T.roles[k] === i), f = wGL.focus ? Math.round(wGL.focus[V.you][i] * 100) : 100;
    const r12 = wGL.stats.map(s => `${s} ${Math.round(1 + m.r[s] * (wGL.cap - 1))}`).join(', ');
    const ok = V.hitters.includes(i) || i === S.ri, why = ok ? `${i + 1}: ${m.n} (${wKindName(m.kind)})${role ? ', for ' + ({ tee: 'the tee', approach: 'the approach', short: 'the short game', putt: 'the green' })[role] : ''}. Focus ${f}%. ${r12}` : wLinksWhyNot(V, i);
    return `<button class="ghost${on(i, S.ri)}" data-lri="${i}" ${ok && aim ? '' : 'disabled'} title="${esc(why)}">${esc(m.n)} <small>${f}%</small></button>`;
  }).join(' ');
  $('wLinksClub').innerHTML = (aim ? V.clubs : [S.club]).map(c => `<button class="ghost${on(c, S.club)}" data-lclub="${c}" ${aim ? '' : 'disabled'} title="Q and E: a longer or a shorter club. ${esc(wGL.clubs[c].n)}${c === 'pt' ? '' : `: about ${Math.round(wGL.reach(c, G.ball[V.you].lie, G.teams[V.you].roster[S.ri].r, 1).carry)} yards carried from here`}">${esc(wGL.clubs[c].n)}</button>`).join(' ');
  $('wLinksRowShot').hidden = S.putt;
  const lie = G.ball[V.you].lie, punchOnly = lie === 'O';
  $('wLinksShot').innerHTML = [['lshape', '', 'Straight'], ['lshape', 'draw', 'Draw', 'Starts right and curves back to the ring, then runs out more'], ['lshape', 'fade', 'Fade', 'Starts left and curves back to the ring, then stops sooner']].map(([k, v, n, t]) => `<button class="ghost${on(v, S.shape)}" data-${k}="${v}" ${aim ? '' : 'disabled'} title="Z: the shape. ${esc(t || 'No shape')}">${n}</button>`).join(' ') + ' · '
    + [['', 'Normal'], ['punch', 'Punch', 'Low under the wind and the branches, and runs'], ['lob', 'Lob', 'High: drifts in the wind, and sits down where it lands']].map(([v, n, t]) => `<button class="ghost${on(v, S.traj)}" data-ltraj="${v}" ${aim && (!punchOnly || v === 'punch') ? '' : 'disabled'} title="X: the height. ${esc(punchOnly ? 'From the trees, only a punch' : t || 'A full shot')}">${n}</button>`).join(' ') + ' · '
    + [[-1, 'Backspin', 'Stops it sooner'], [0, 'No spin', ''], [1, 'Topspin', 'Runs it out']].map(([v, n, t]) => `<button class="ghost${on(v, S.spin)}" data-lspin="${v}" ${aim ? '' : 'disabled'} title="C: the spin. ${esc(t)}">${n}</button>`).join(' ');
  // the line, the stance (the side's, kept from shot to shot) and the caddie's word
  const L = wGL.lines, lineT = { go: S.putt ? 'Charge it: past the hole if it misses' : 'The pin, over the trouble (out of reach: straight at it)', pct: S.putt ? 'Finish it a little past the hole' : 'The fat of the green, or the safe fairway', lay: S.putt ? 'Die it at the hole: it won\'t lip out, and short never drops' : 'Short of the trouble, leaving a full wedge' };
  $('wLinksLine').innerHTML = Object.keys(L).map(k => `<button class="ghost${on(k, S.line)}" data-lline="${k}" ${aim ? '' : 'disabled'} title="L: the line. ${esc(lineT[k])}">${esc(L[k].n)}</button>`).join(' ');
  const stc = G.stance[V.you], wl = G.word[V.you], won = G.wordOn[V.you];
  $('wLinksStance').innerHTML = [['quick', 'Quick', 'T: a quicker meter and less focus spent, a touch less true'], ['steady', 'Steady', 'T: the meter at its own pace']].map(([k, n, t]) => `<button class="ghost${on(k, stc.tempo)}" data-ltempo="${k}" ${aim ? '' : 'disabled'} title="${esc(t)}">${n}</button>`).join(' ') + ' · '
    + [['bold', 'Bold', 'M: a little longer, more shape and spin, and a bigger miss'], ['careful', 'Careful', 'M: as it comes']].map(([k, n, t]) => `<button class="ghost${on(k, stc.mood)}" data-lmood="${k}" ${aim ? '' : 'disabled'} title="${esc(t)}">${n}</button>`).join(' ') + ' · '
    + `<button class="ghost${won ? ' on' : ''}" data-lword="1" ${aim && wl > 0 && !won ? '' : 'disabled'} title="W: once a game. The next stroke read in full: a putt's read line all the way, and the wind exactly">${won ? 'Caddie\'s word: on' : `Caddie's word (${wl} left)`}</button>`;
  const M = V.meter, st = V.ph !== 'swing' || !M ? 'Start' : S.putt ? 'Weight' : M.st === 'up' ? 'Power' : 'Mark';
  $('wLinksGo').innerHTML = `<button class="ghost on" data-lgo="1" title="Space">${st}</button> <small class="hint">${S.putt ? 'Two presses: start, then stop the bar at the weight (the gold tick rolls it to your aim on a flat green).' : 'Three presses: start, the power (the gold tick lands it on the ring), then the green mark.'} Or drag back from the ball and let go.</small>`;
}
// the two clubs; taken: names already in the game (your four's, in a practice round), so nobody shares one
function wLinksTeams(taken) {
  const g = W_GRDS.find(x => x.id === 'g_links'), H = W_LINKS.home, A = W_LINKS.away, used = new Set(taken || []);
  return [Object.assign({ name: wGrdClub(g) }, H), Object.assign({ name: `${W_GRD_CITY[A.city]} ${SPORT_NAME.golf} Club` }, A)].map(t => ({
    name: t.name, short: t.short, color: t.color, roster: t.kinds.map(kind => ({ n: wRinkName(kind, used), kind })),
  }));
}
/* one game at the Links. opts: { teams, holes, seed, mode, title, how, wild } */
function wLinksGame(opts) {
  const o = opts || {};
  WGL = { over: null };
  $('wLinksTitle').textContent = o.title || 'A round at Mossgate Links';
  wGL.start({ teams: o.teams || wLinksTeams(), holes: o.holes || wLinksHoles(), seed: o.seed, mode: o.mode || W_LINKS_MODE, wild: !!o.wild, course: o.course, weather: o.weather, wood: !!o.wood, enchant: !!o.enchant, powers: o.powers, autoPow: o.autoPow, skill: o.skill || [1, W_LINKS_SKILL] });
  showView('links');
  wLinksBarNote(); wLinksRows(); wLinksCard();
}
function wLinksBarNote() {
  if (!WGL) return;
  const mode = WGL.over ? W_LINKS_MODE : wGL.mode || W_LINKS_MODE;
  for (const b of $('wLinksModes').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.lmode === mode); b.setAttribute('aria-pressed', b.dataset.lmode === mode); }
  wLinksSpeedSet();
  const G = wGL.G, later = !WGL.over && G && G.holes !== wLinksHoles();
  $('wLinksNote').textContent = (wGL.msg || '') + (later ? ` (Holes: ${wLinksHoles()} from the next game; this one is ${G.holes}.)` : '');
  $('wLinksHoles').value = String(wLinksHoles());
  $('wLinksSkill').value = String(W_LINKS_SKILL);
}
// the scorecard (a column a hole: par, each side's strokes, who won it) and each side's players
function wLinksCard() {
  const G = wGL.G; if (!G || !G.teams) { $('wLinksCard').innerHTML = ''; $('wLinksLog').innerHTML = ''; return; }
  const n = Math.max(G.holes, G.card.length + (G.over ? 0 : 1)), cols = []; for (let i = 0; i < n; i++) cols.push(i);
  const cell = (i, s) => { const c = G.card[i]; if (!c) return i === G.h ? `<td>${G.hole.st[s] || ''}</td>` : '<td></td>'; const t = c.up[s] ? '×' : c.done[s] ? c.st[s] : c.st[s] + '+'; return `<td${c.res === s ? ' style="font-weight:700;color:var(--gold,#ffb02e)"' : ''}>${t}</td>`; };
  const pars = cols.map(i => `<td>${wGL.parOf(i)}</td>`).join('');
  const card = `<table class="wrpow wcboxt"><caption>${esc(G.teams[0].name)}: ${esc(wGL.matchText(0))}</caption><tr><th>Hole</th>${cols.map(i => `<th>${i + 1}</th>`).join('')}</tr><tr><td>Par</td>${pars}</tr>${[0, 1].map(s => `<tr><td style="border-left:4px solid ${G.teams[s].color || '#888'}">${esc(G.teams[s].name)}</td>${cols.map(i => cell(i, s)).join('')}</tr>`).join('')}</table>`;
  const players = [0, 1].map(s => `<table class="wrpow wcboxt"><caption>${esc(G.teams[s].name)}</caption><tr><th>Player</th><th title="Shots hit">Shots</th><th title="Putts">Putts</th><th title="Holed: the shot that dropped">In</th><th title="Focus now: each shot costs some, and it comes back while the others hit">Focus</th></tr>${G.teams[s].roster.map((m, i) => `<tr><td>${esc(m.n)} <small>${esc(wKindName(m.kind))}</small></td><td>${G.pst[s][i].shots}</td><td>${G.pst[s][i].putts}</td><td>${G.pst[s][i].holed}</td><td>${G.focus ? Math.round(G.focus[s][i] * 100) + '%' : ''}</td></tr>`).join('')}<tr><td><b>Side</b></td><td>${G.pst[s].reduce((a, p) => a + p.shots, 0)}</td><td title="The players' putts, and the putts given">${G.stat[s].putts - (G.stat[s].given || 0)}${G.stat[s].given ? ` <small>+${G.stat[s].given} given</small>` : ''}</td><td></td><td></td></tr></table>`).join('');
  $('wLinksCard').innerHTML = `<div style="overflow-x:auto;max-width:100%">${card}</div><div class="wcbox">${players}</div>`;
  $('wLinksLog').innerHTML = wLinksLogHTML();
}
// every hole so far, with what decided it
function wLinksLogHTML() {
  const G = wGL.G; if (!G.card.length) return '<li class="hint">No holes finished yet.</li>';
  const score = (c, s) => c.up[s] ? 'picked up' : c.done[s] ? `${c.st[s]}` : `${c.st[s]}, not holed`;
  return G.card.map(c => `<li style="border-left-color:${c.res < 0 ? '#888' : G.teams[c.res].color}"><small>Hole ${c.no} · par ${c.par}</small> ${esc(G.teams[0].name)} ${score(c, 0)}, ${esc(G.teams[1].name)} ${score(c, 1)}. <b>${c.res < 0 ? 'Halved' : esc(G.teams[c.res].name) + ' win it'}</b>.</li>`).join('');
}
function wLeaveLinks() {
  WGL = null; wGL.pause(false);
  if (WG) showView('world');
  else { wGL.hide(); showScreen('title'); renderTitle(); }
}
// the scorecard is drawn again only when a stroke or a hole has changed it, and never while the ball is moving
let W_LINKS_CARDKEY = '';
wGL.onPhase = ph => {
  if (!WGL) return; wLinksBarNote(); wLinksRows();
  if (ph === 'fly') return;   // (the card waits for the ball to stop, as the status line does)
  const G = wGL.G, key = G ? [G.card.length, G.h, G.hole.st.join('-'), !!G.over].join('|') : '';
  if (key !== W_LINKS_CARDKEY) { W_LINKS_CARDKEY = key; wLinksCard(); }
};
wGL.onPick = () => { if (WGL) { wLinksRows(); wLinksBarNote(); } };
wGL.onOver = s => { if (WGL) { WGL.over = s; wLinksBarNote(); wLinksRows(); wLinksCard(); $('wLinksAgain').focus(); } };

// the scoreboard strip on a phone (w86): both sides, holes won, and the match
W_SB_VIEWS.links = 'wSbLinks';
W_SB_HTML.links = function () {
  // (the match as drawn: it waits for the ball to stop, as the picture and the card do)
  const G = wGL.G, D = wGL.shown; if (!G || !G.teams || !D) return '';
  return wSbSide(G.teams[0].name, G.teams[0].color, D.won[0], false, '<small>holes</small>') + `<div class="wsbmid"><b>${D.over ? 'Final' : 'Hole ' + (D.h + 1)}</b><small>${esc(D.match)}</small></div>` + wSbSide(G.teams[1].name, G.teams[1].color, D.won[1], false, '<small>holes</small>');
};

const wW105ShowView = showView;
showView = function (v) {
  wW105ShowView(v);
  $('wLinksBar').hidden = v !== 'links';
  if (v === 'links') $('runbar').hidden = true;
};
const wW105OpenPause = openPause;
openPause = function () { if (UI.view === 'links') return; return wW105OpenPause.apply(this, arguments); };
const wW105ShowPage = showPage;
showPage = function (p) {
  wW105ShowPage(p);
  if (WGL && UI.view === 'links') wGL.pause(p !== 'play');
};

// Agatha Divot at the Links puts on a round (not GOLF or GAME: those are how card-game golf scores, and the match)
(() => {
  const K = DB.chars.gk_links; if (!K) return;
  K.topics.job.t += ' And we play it for real now, on the course itself, four a side: ask me for a ROUND.';
  K.topics.round = { t: 'Four of ours against four from Saltmere. One ball a side, and you pick who hits every shot. Match play, and nobody goes home level. Replace your divots.', act: 'linksround' };
})();
const wW105RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'linksround') return wLinksGame(); return wW105RunAct.apply(this, arguments); };

// the Settings panel: how many holes a game is (the observer puts the row back whenever the panel redraws)
function wLinksSetRow() {
  const g = document.querySelector('#modalBox .setgrid'); if (!g || $('sLinksHoles')) return;
  g.insertAdjacentHTML('beforeend', `<label class="rng"><span>Golf holes</span><select id="sLinksHoles">${wGL.rules.holesAt.map(m => `<option value="${m}" ${wLinksHoles() === m ? 'selected' : ''}>${m} holes</option>`).join('')}</select></label>`);
  $('sLinksHoles').onchange = e => { SET.linksHoles = +e.target.value; saveSettings(); if (WGL) wLinksBarNote(); };
}
new MutationObserver(wLinksSetRow).observe($('modalBox'), { childList: true });

// How to play: Golf, how it works
function wLinksHowHTML() {
  const R = wGL.rules, M = wGL.meterRules;
  return `<p class="hint">A game is four players a side, <b>captain's choice match play</b>: each side plays one ball, and picks who hits every shot. ${R.holes} holes unless you change it in Settings (${R.holesAt.join(', ')}). The standing nine is the same every week, par ${R.par9.reduce((a, b) => a + b, 0)}.</p>
  <p class="hint"><b>Who hits.</b> The first four shots of a hole are four different players, in the order you choose. After that, anyone but the player who hit last: nobody hits twice running. So the order is the choice: who drives, who goes for the green, who chips and who putts.</p>
  <p class="hint"><b>The turn.</b> The side with the honour tees off first (the side that won the last hole; a halved hole keeps it). Then whoever is farther from the hole plays next, so you see where their ball ends up before you choose your shot.</p>
  <p class="hint"><b>Match play.</b> Each hole goes to the side that holes out in fewer strokes, or is halved. The game is won once a side is more holes up than there are holes left ("3 and 2"), or "1 up" at the last. Level after the last hole, it goes to a playoff: the 1st again, then the 2nd, until a side wins a hole. A ball still out after par and ${R.cap} more is picked up. A golf game never ends level.</p>
  <p class="hint"><b>Giving a putt.</b> A side may give the other its next short putt: it counts as holed in one more stroke. Their short putts are yours to give or not (<b>Give it</b> or <b>Make them putt</b>; Y or N). Theirs are given by the CPU's caddie, by skill, and not always.</p>
  <p class="hint"><b>The swing.</b> Space three times: once to start, once at the top for the <b>power</b>, and once on the way back on the green <b>mark</b>. The gold tick is the power that lands a perfect swing on the ring. Past the end of the bar is a <b>power shot</b>: longer, and the mark is smaller. On the mark the ball flies nearly straight. Early, it hooks left; late, it slices right, by how far you missed. Miss the mark altogether and the swing goes off at the bottom, very late. A more accurate player has a wider mark. On a phone, drag back from your ball away from the target and let go: how far you pull is the power, and a pull off the line hooks or slices it.</p>
  <p class="hint"><b>Aiming.</b> The ring is where a perfect swing at the tick lands, without the wind. Click or drag on the course to move it, or the arrows: left and right turn it, up and down move it further or nearer. Pick the club (Q and E), the hitter (1 to 4), the shape (Z: a <b>draw</b> starts right and curves back to the ring, then runs out more; a <b>fade</b> starts left, curves back and stops sooner), the height (X: a <b>punch</b> flies low under the wind and runs, a <b>lob</b> climbs and sits down where it lands) and the spin (C: <b>backspin</b> stops it sooner, <b>topspin</b> runs it out).</p>
  <p class="hint"><b>The wind</b> blows a strength and a way for each hole, shown on the arrow at the top right. It moves a high ball far more than a low one, and a headwind costs more than a tailwind gives.</p>
  <p class="hint"><b>The lie.</b> The driver is for the tee only. The rough costs distance and the ball runs (no spin), deep rough more. Sand takes the wedge: anything else barely moves it. A ball in the moss bog plugs and comes out short. In the trees it lies on a root, and only a punch will do. The water is a drop on the line, back where it went in, and a stroke.</p>
  <p class="hint"><b>The green.</b> A putt is two presses: start, then stop the bar at the weight (the gold tick rolls it to your aim on a flat green). The green slopes: the grain arrows drift downhill, and the <b>read line</b> shows the first few yards of your putt as you would strike it now, longer for a better putter, so you can see the break and aim off for it. Too fast and it lips out or runs past; short never drops.</p>
  <p class="hint"><b>Ratings and roles.</b> Each player has six ratings: <b>power</b> (distance), <b>accuracy</b> (the size of the mark, and how far a miss strays), <b>touch</b> (chips and pitches), <b>putting</b> (the read line's length, and putts that drop), <b>nerve</b> and <b>scrambling</b> (out of the rough, sand, bog and trees). Your four's roles (the tee, the approach, the short game, the green) are set on the Links tab: the caddie gives each shot to its role's player when the rule allows, and in You play the hitter row starts on them.</p>
  <p class="hint"><b>Focus.</b> Every shot costs the hitter some focus, a hard one more (a power shot, or out of the rough, sand, bog or trees). It comes back while the others hit, and a little at each new hole. A tired player's mark is smaller and their misses wider: share the shots. The hitter row shows each player's focus.</p>
  <p class="hint"><b>Nerve.</b> On a stroke that wins or halves the hole (more on the last hole, dormie, or in a playoff), the meter runs quicker and the mark shakes (a putt's weight wobbles), less for a player with nerve. The CPU's players feel it too.</p>
  <p class="hint"><b>The line</b> (L), before every shot. <b>Go for it</b>: at the pin, over the trouble (out of reach, straight at it). <b>Percentages</b>: the fat of the green when the pin is tucked by sand or water, or the safe fairway. <b>Lay up</b>: short of the trouble, leaving a full wedge in. On a putt the line is the weight: charge it, finish it a little past, or die it at the hole (it won't lip out, but short never drops). Picking a line plans the shot again: the club and the ring move.</p>
  <p class="hint"><b>Stances</b>, your side's, kept from shot to shot. <b>Tempo</b> (T): Quick runs the meter quicker and spends less focus, a touch less true; Steady is the meter's own pace. <b>Mood</b> (M): Bold goes a little longer with more shape and spin, and the mark is smaller; Careful plays it as it comes.</p>
  <p class="hint"><b>The turn.</b> After the ${Math.max(1, Math.round(R.holes * 5 / 9))}th hole of ${R.holes} (and halfway through other lengths) everyone's focus comes back. <b>The caddie's word</b> (W), once a game: the next stroke is read in full: a putt's read line runs all the way, and the wind shows exactly. Otherwise the wind on the arrow is rough (to 5 mph, and 8 ways).</p>
  <p class="hint"><b>Powers.</b> Every kind has its own magic: a long-game power (for a full shot) and a short-game power (a chip or a putt), and a second of each to pick on the Links tab. The hitter casts theirs before their stroke (P) for team <b>mana</b>, which good shots fill: a tee shot on the fairway, the green in regulation, a long putt or a chip that drops. Some powers are curses on the other side's next stroke. The gallery's <b>roar</b> fills on long drives, close approaches, long putts and birdies: ${wGL.roarRules.ult} of it pays for the hitter's kind's <b>ultimate</b> (U, once a game), which marks the hole for the rest of it, and ${wGL.roarRules.steady} steadies a stroke that wins or halves (K: no pressure on it). <b>Situation powers</b>, once a game each: Dormie (one down with one to play: everyone's focus back), Playoff (the next swing's mark twice the size) and Up and down (the next chip and putt truer). In Manage, <b>Auto powers</b> lets your caddie cast for you. The tip on the Powers row says what is worth casting now.</p>
  <p class="hint"><b>The enchanted course.</b> The Links is an old wood, and not all of it sits still. <b>Fairy rings</b>: a ball that stops in one comes up in the other (an elf's only when that helps). <b>The mimic</b>: one bunker on some holes has teeth; it swallows the ball (a drop and a stroke) or spits it out (an ogre's it always spits out). <b>The troll bridge</b>: when the troll is home, the first ball each side carries over the stream pays him a mana, or with none to pay it is batted back to the near bank (a troll pays no toll). <b>Will-o'-wisps</b> drift over the fairway and carry off a ball that comes down near one (never a harpy's). <b>Walking trees</b> move between strokes, and a ball among them lies in the trees (a wraith's passes through). <b>The bog creeps</b> out a little with every hole played (a zombie's ball it lets go). <b>Webs</b> at the tree line hold a ball: the next shot goes half as far (a spider walks out). <b>A runestone</b> by every fairway gives a mana to a ball that stops beside it (a dwarf's, two). And now and then <b>a wyvern</b> swoops and carries a ball off (never a gorgon's). Each hole's are always the same on the standing nine, so they can be learned.</p>
  <p class="hint"><b>Their caddie</b> (on the bar): a <b>Squire</b> misses the meter often, ignores the wind, takes the driver and goes for everything; a <b>Knight</b> reads the wind, the lie and the match (behind late, it goes for everything; well up, it lays up short of trouble); an <b>Archmage</b> also reads greens well, lays up short of water and reads your habits: go for it and find trouble twice and it plays safe and lets you.</p>
  <p class="hint"><b>Watch</b> hands both sides to the CPU, and Speed on the bar runs it at 2 or 4 times. The CPU's caddie picks the hitter by the shot (power off the tee, accuracy for an approach, touch for a chip, the best putter on the green), the club for the distance, aims off for the wind (a Knight or an Archmage), and lays up short of trouble.</p>`;
}
const wW105RenderHelp = renderHelp;
renderHelp = function () {
  wW105RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpLinks') || !$('wHelpGrounds')) return;
  const after = $('wHelpRink') || $('wHelpCourt') || [...h.querySelectorAll('[id^="wHelpG"], #wHelpRing')].pop();
  h.insertAdjacentHTML('beforeend', `<section id="wLinksHow" class="wghelp"><h3>Golf: how it works</h3>${wLinksHowHTML()}</section>`);
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLinks"><b>Real golf.</b> Mossgate Links is trying out golf on the course itself, four a side. Ask Agatha Divot for a ROUND: captain's choice match play on the standing nine (or set the holes in Settings). Pick the hitter, the club and the shot, aim, and swing, or watch the two clubs play it out, with a scorecard under the course (see Golf: how it works). A ROUND is an exhibition: nothing is won or lost.</p>`);
};
