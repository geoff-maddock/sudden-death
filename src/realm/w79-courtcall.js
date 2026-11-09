/* w79: the call (issue #77, phase 4). The bar gains a third way to play, Manage (W_COURT_MODES: Watch, Manage, You
   play): you call the sets, the defense, the stances, timeouts and subs, and the CPU plays your five. In Manage and
   You play the calls panel under the court (#wCourtCalls) has:
   - your offense set and your defense (each button's tip says what it beats and what beats it), and Pace and Pressure;
     a call stays until you change it (a set or a defense from the next possession: nobody switches once they've seen
     the other side's);
   - this possession's matchup and why, the scout (a set run again is guarded better), and how each of your sets has
     gone (points a trip);
   - Timeout, with how many are left (T in You play; at a dead ball or with the ball in your hands), and Subs: at a
     stoppage (a dead ball, a break or a timeout), who comes off for whom.
   A CPU picker on the bar sets the other coach's skill (Squire, Knight or Archmage; not saved); games from the world
   set it by tier (phase 5). How to play gains the sets, the defenses and their matchups, the scout, the stances,
   timeouts and the coaches.
   Wraps: wCourtGame (wW79CourtGame: the skill), wCourtPad (wW79CourtPad: the panel on the ticker), wCourtBarNote (wW79CourtBarNote: the panel), wCourtHowHTML
   (wW79CourtHowHTML: the call), renderHelp (wW79RenderHelp: #wHelpCourtCall). */

// Manage between Watch and You play
(() => {
  const play = W_COURT_MODES.play; delete W_COURT_MODES.play;
  W_COURT_MODES.manage = { n: 'Manage', title: 'You call the sets, the defense, the stances, timeouts and subs from the panel under the court; your five play them.' };
  W_COURT_MODES.play = play;
  $('wCourtModes').innerHTML = Object.entries(W_COURT_MODES).map(([k, m]) => `<button class="ghost" data-cmode="${k}" title="${esc(m.title)}">${esc(m.n)}</button>`).join('');
})();
let W_COURT_SKILL = 1;
$('wCourtModes').insertAdjacentHTML('afterend', `<label class="hint" title="How good the other coach is: a Squire calls at random and never reads you, a Knight reads the score, the clock and the matchups, an Archmage also reads your habits and runs what beats your defense.">CPU <select id="wCourtSkill">${wBK.skills.map((n, i) => `<option value="${i}"${i === W_COURT_SKILL ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`);
$('wCourtSkill').addEventListener('change', e => { W_COURT_SKILL = +e.target.value; });
const wW79CourtGame = wCourtGame;
wCourtGame = function (opts) { const o = Object.assign({}, opts); if (!o.skill) o.skill = [W_COURT_SKILL, W_COURT_SKILL]; return wW79CourtGame(o); };

// what a set beats and what beats it, and the same for a defense, in words
function wCourtEdgeLine(kind, id) {
  const ids = Object.keys(kind === 'off' ? wBK.defs : wBK.sets), good = [], bad = [];
  for (const o of ids) { const e = kind === 'off' ? wBK.edge(id, o)[0] : -wBK.edge(o, id)[0]; (e > 0 ? good : e < 0 ? bad : []).push((kind === 'off' ? wBK.defs : wBK.sets)[o].n); }
  const list = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0];
  return [good.length ? `${kind === 'off' ? 'Good against' : 'Stops'} ${list(good)}.` : '', bad.length ? `${kind === 'off' ? 'Struggles against' : 'Gives up to'} ${list(bad)}.` : ''].filter(Boolean).join(' ');
}
$('wCourtPad').insertAdjacentHTML('beforebegin', `<div id="wCourtCalls" class="wccalls" hidden></div>`);
$('wCourtCalls').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ccall) wBK.call(b.dataset.ccall, b.dataset.cid);
  else if (b.id === 'wCourtTO') { const r = wBK.timeout(); if (r) wCourtCallSay(r); }
  else if (b.id === 'wCourtSubGo') { const out = +$('wCourtSubOut').value, inn = +$('wCourtSubIn').value, r = wBK.sub(wBK.you, out, inn); if (r) wCourtCallSay(r); }
  wCourtCalls(true);
});
let W_COURT_CALLMSG = '', W_COURT_MSGVER = -1, W_COURT_ROWKEY = '', W_COURT_NOWKEY = '', W_COURT_DOWN = false;
// a word for you in the panel (why a timeout or a sub can't happen): it stays until play moves on (the engine's version)
function wCourtCallSay(m) { W_COURT_CALLMSG = m || ''; W_COURT_MSGVER = wBK.ver; }
// (a press in the panel isn't redrawn out from under the pointer)
$('wCourtCalls').addEventListener('pointerdown', () => { W_COURT_DOWN = true; });
window.addEventListener('pointerup', () => { W_COURT_DOWN = false; });
// the four rows of calls: built again only when one of your calls changes
function wCourtCallRows(mine) {
  const row = (kind, T, lab) => `<div class="wccrow"><span class="wccl">${lab}</span>${Object.entries(T).map(([k, v]) => `<button class="ghost${mine[kind] === k ? ' on' : ''}" aria-pressed="${mine[kind] === k}" data-ccall="${kind}" data-cid="${k}" title="${esc(v.desc + (kind === 'off' || kind === 'def' ? ' ' + wCourtEdgeLine(kind, k) : ''))}">${esc(v.n)}</button>`).join('')}</div>`;
  return `${row('off', wBK.sets, 'Offense')}${row('def', wBK.defs, 'Defense')}${row('pace', wBK.paces, 'Pace')}${row('press', wBK.presses, 'Pressure')}`;
}
/* the panel: the call rows when your calls change; the rest (the matchup, timeouts, subs, how your sets are going) when
   any of it changes, keyed without the stamina numbers that move every frame at a stoppage (they're read fresh each
   time it is drawn) */
function wCourtCalls(force) {
  // (read live, not copied: the panel only reads; the engine's version says when anything in it may have changed)
  const G0 = wBK.G, C = WBK && !WBK.over && wBK.mode !== 'watch' && G0 && G0.call ? { call: G0.call, cur: G0.cur, to: G0.to, sets: G0.setLog } : null, box = $('wCourtCalls');
  box.hidden = !C; if (!C) { W_COURT_ROWKEY = W_COURT_NOWKEY = ''; return; }
  if (!force && (W_COURT_DOWN || (box.contains(document.activeElement) && document.activeElement.tagName === 'SELECT'))) return;
  if (!box.querySelector('.wccrows')) box.innerHTML = '<div class="wccrows"></div><div class="wccnowbox"></div>';
  const you = wBK.you, mine = C.call[you], cur = C.cur, G = wBK.G, ph = wBK.phase;
  const rk = JSON.stringify(mine);
  if (force || rk !== W_COURT_ROWKEY) { W_COURT_ROWKEY = rk; box.querySelector('.wccrows').innerHTML = wCourtCallRows(mine); }
  const stop = ['dead', 'timeout', 'intro', 'break'].includes(ph), on = wBK.onFloor()[you], bench = wBK.bench(you), sets = C.sets[you] || {};
  if (W_COURT_CALLMSG && wBK.ver > W_COURT_MSGVER + 1) W_COURT_CALLMSG = '';
  // (at a stoppage the subs show stamina, which comes back every frame: it's in the key, whole numbers, then)
  const nk = `${wBK.ver}|${wBK.mode}|${W_COURT_CALLMSG}|${stop ? on.concat(bench).map(ri => Math.round(G.stam[you][ri])).join() : ''}`;
  if (!force && nk === W_COURT_NOWKEY) return;
  W_COURT_NOWKEY = nk;
  const ours = cur && cur.side === you, e = cur ? wBK.edge(cur.off, cur.def) : [0, ''], R = G.teams[you].roster, st = ri => Math.round(G.stam[you][ri]);
  const match = cur ? `${ours ? 'Your' : 'Their'} ${wBK.sets[cur.off].n} against ${ours ? 'their' : 'your'} ${wBK.defs[cur.def].n}: ${e[0] ? (e[0] > 0 === ours ? 'good for you. ' : 'good for them. ') + e[1] : 'an even matchup.'}${cur.stale ? ` ${ours ? 'They' : 'You'}'ve seen ${wBK.sets[cur.off].n} ${cur.stale + 1} times running, and guard it better.` : ''}` : '';
  const log = Object.entries(sets).filter(([, v]) => v.n).map(([k, v]) => `${wBK.sets[k].n} ${(v.pts / v.n).toFixed(2)} a trip (${v.n})`).join(', ');
  const subs = stop && bench.length ? `<div class="wccrow"><span class="wccl">Subs</span><select id="wCourtSubOut" aria-label="Who comes off">${on.map(ri => `<option value="${ri}">${esc(R[ri].n)} (${st(ri)})</option>`).join('')}</select> for <select id="wCourtSubIn" aria-label="Who comes on">${bench.map(ri => `<option value="${ri}">${esc(R[ri].n)} (${st(ri)})</option>`).join('')}</select><button class="ghost" id="wCourtSubGo">Swap</button></div>`
    : `<div class="wccrow"><span class="wccl">Subs</span><small class="hint">${bench.length ? 'At a stoppage: a dead ball, a break or a timeout.' : 'Nobody on the bench.'}</small></div>`;
  box.querySelector('.wccnowbox').innerHTML = `<div class="wccrow"><span class="wccl">Timeouts</span><button class="ghost" id="wCourtTO" ${C.to[you] ? '' : 'disabled'} title="Five seconds: breath back for everyone, their hot hand cools, and you can sub. At a dead ball or with the ball in your hands.${wBK.mode === 'play' ? ' T on the keyboard.' : ''}">Timeout (${C.to[you]} left)</button><small class="hint">Theirs: ${C.to[1 - you]} left.</small></div>${subs}
    <p class="hint wccnow">${esc(match)}</p>${log ? `<p class="hint">Your sets so far: ${esc(log)}.</p>` : ''}${W_COURT_CALLMSG ? `<p class="wbad">${esc(W_COURT_CALLMSG)}</p>` : ''}`;
}
// (kept up by the court's ticker, which runs only while a game is on: w77's wCourtPad)
const wW79CourtPad = wCourtPad;
wCourtPad = function () { wW79CourtPad(); wCourtCalls(false); };
const wW79CourtBarNote = wCourtBarNote;
wCourtBarNote = function () {
  wW79CourtBarNote();
  if (WBK && !WBK.over && (wBK.mode || W_COURT_MODE) === 'manage') $('wCourtNote').textContent = 'You manage: call the sets, the defense and the stances below the court, take timeouts, and sub at stoppages. Your five play it.';
  W_COURT_CALLMSG = ''; wCourtCalls(true);
};

// How to play: the call
const wW79CourtHowHTML = wCourtHowHTML;
wCourtHowHTML = function () {
  const S = wBK.sets, D = wBK.defs, cell = (o, d) => { const e = wBK.edge(o, d)[0]; return `<td title="${esc(wBK.edge(o, d)[1])}">${e > 0 ? '<b class="wgood">+</b>' : e < 0 ? '<b class="wbad">&minus;</b>' : '&middot;'}</td>`; };
  return wW79CourtHowHTML() + `<p class="hint"><b>The call.</b> Each side has an offense set and a defense, and they stay until changed; a new set or defense takes hold from the next possession, so nobody can switch once they've seen the other side's. The sets: ${Object.values(S).map(s => `<b>${esc(s.n)}</b> (${esc(s.desc.toLowerCase().replace(/\.$/, ''))})`).join('; ')}. The defenses: ${Object.values(D).map(d => `<b>${esc(d.n)}</b> (${esc(d.desc.toLowerCase().replace(/\.$/, ''))})`).join('; ')}.</p>
  <p class="hint">Some sets beat some defenses, a few points on every shot, with the ratings on top: + is good for the offense, &minus; good for the defense (hover a mark for why).</p>
  <table class="wrpow wcedge"><tr><th>Set</th>${Object.values(D).map(d => `<th>${esc(d.n)}</th>`).join('')}</tr>${Object.keys(S).map(o => `<tr><td>${esc(S[o].n)}</td>${Object.keys(D).map(d => cell(o, d)).join('')}</tr>`).join('')}</table>
  <p class="hint"><b>The scout.</b> The other coach reads your habits: a set run again on the next possession is guarded better, and better again a third time. Mix it up.</p>
  <p class="hint"><b>Stances.</b> Pace on offense: ${Object.values(wBK.paces).map(p => `<b>${esc(p.n)}</b> (${esc(p.desc.toLowerCase().replace(/\.$/, ''))})`).join(', ')}. Pressure on defense: ${Object.values(wBK.presses).map(p => `<b>${esc(p.n)}</b> (${esc(p.desc.toLowerCase().replace(/\.$/, ''))})`).join(', ')}.</p>
  <p class="hint"><b>Timeouts.</b> ${wBK.toRules.n} a half, and one more in overtime, at a dead ball or with the ball in your hands. A timeout gives everyone some breath back, cools the other side's hot hand, and lets you sub; play restarts with the ball where it was.</p>
  <p class="hint"><b>The other coach.</b> A <b>Squire</b> calls at random and never reads you. A <b>Knight</b> reads the score, the clock and the matchups, and leans to what beats your defense. An <b>Archmage</b> also reads your habits, defends the set you run most, and runs what beats your defense.</p>
  <p class="hint"><b>Manage.</b> Pick Manage on the bar to call it from the bench: the panel under the court has your set, your defense, Pace, Pressure, timeouts and subs, the matchup on each possession and how your sets are going. Your five play it. In You play the same panel is there while you play.</p>`;
};
const wW79RenderHelp = renderHelp;
renderHelp = function () {
  wW79RenderHelp();
  const after = $('wHelpCourtTab'); if (!after || $('wHelpCourtCall')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpCourtCall"><b>Calling a basketball game.</b> On the court you can Watch, Manage (call the sets, the defense, Pace, Pressure, timeouts and subs, and your five play it) or play it yourself. Six offense sets and five defenses beat and lose to each other, a set run again is guarded better, and timeouts give breath back and cool a hot hand (see Basketball: how it works). The other coach is a Squire, a Knight or an Archmage.</p>`);
};
