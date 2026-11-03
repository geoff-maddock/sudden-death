/* w44: playing football from the world (issue #9, phase 5). Your seven plays a rival club, or the local side, on
   Cinder Gridiron, as your nine plays baseball (w20d): Play (you call the plays and play your offense by hand),
   Manage (you call them, and your players run them), or Simulate (the result at once). A football game needs
   W_GFG.minOwn players of your own (call-ups fill the seven), and each club plays you once a day. A loss costs
   nothing but the XP you would have won (question 5), as on the diamond; a tie after Sudden Death pays half. A win
   pays XP to the seven (half to your players who sat out), gold and fans by tier; every game records the box score
   for your players, the head to head and the league table. Save and leave keeps the game at its last call (pressed during a play, you leave at the next one), and it is
   waiting when you come back, after a reload too. Clinker Dunn's GRIDIRON at the Ash Bowl, and the Seven tab, open
   the game card.

   WG.gfg     { live: null | { world, snap }, met: { club: dayAbs }, opp: { club: { lvl, team } }, games: [last W_GFG.keep], w, l, t }
              world = { kind: 'gfgame', ref, club, tier, how, day, name, ids, cup }, plain data; the end dispatches
              W_ON_END[kind]. ids: the squad's keys at kick-off (the seven, then the bench; null for a bench call-up),
              so the box lines find your players
   The bench (w48): each side brings W_GFG.bench players who sit at kick-off and come on for tired ones. Yours is your
   players who sit out, then call-ups at your level; theirs is more of their kinds.
              snap = the engine's snapshot at a call (plain JSON)
   WG.gfstats { pid: summed box lines, plus gg (games) }, this journey
   wGridProblems(), wStartGrid({ club, how, tier?, kind?, ref?, cup? }), wResumeGrid(), wGridLeave(), wGridConcede(),
   wOpenGridCard()
   Wrapped: wGridBar (wW44GridBar: Save and leave and Concede in a real game), wLeaveGridiron (wW44LeaveGridiron),
   wRunAct (wW44RunAct: GRIDIRON opens the card), wNextPrompt (wW44NextPrompt: a game waiting after a reload),
   wCampSeven and wRenderCamp (wW44CampSeven, wW44RenderCamp: Play a game and Resume on the Seven tab), wCampStats and
   wStatsCard (wW44CampStats, wW44StatsCard: the Football view and box lines), renderHelp (wW44RenderHelp: #wHelpGfGame). */

const W_GFG = {
  minOwn: 5, xp: 12, gold: 15, fans: 3, lossShare: .25, tieShare: .5, benchShare: .5, mvpXp: 5,
  // extra rating points for each of the other side's players, by tier, spread over their ratings (6 is +1 to every
  // one). Measured under the coaches (Simulate, test/realm_gridiron_lab.py, docs/realm/BALANCE.md): a win about 49%
  // of the time at tier 1, 44% at tier 2 and 25% at tier 3, as on the diamond
  oppBonus: { 1: 0, 2: 1, 3: 4 },
  minutes: 150, keep: 10, saveMs: 15000, bench: 3,
};
const W_GFG_HOW = { play: 'Play', manage: 'Manage', sim: 'Simulate' };
const WGFG = { saved: 0, asked: false, msg: '', leaving: false };

function wGfg() {
  const B = WG.gfg = WG.gfg || { live: null, met: {}, opp: {}, games: [], w: 0, l: 0, t: 0 };
  B.met = B.met || {}; B.opp = B.opp || {}; B.games = B.games || []; B.t = B.t || 0;
  return B;
}
function wGridLive() { return !!(WG && WG.gfg && WG.gfg.live); }
// a real game is on the field (not a practice or an exhibition)
function wGridWorld() { return !!(WGF && WGF.world && wGridLive()); }
function wGridProblems() {
  const n = wRoster().length;
  return n < W_GFG.minOwn ? [`Recruit ${W_GFG.minOwn - n} more player${W_GFG.minOwn - n === 1 ? '' : 's'}: a football game needs ${W_GFG.minOwn} of your own, and call-ups fill the rest of the seven.`] : [];
}
// (the diamond's formula: one curve for both sports)
const wGridOppLvl = tier => wBallOppLvl(tier);
/* a club's squad: its seven, its own kinds first, at your level plus the tier, and W_GFG.oppBonus on every rating; then
   its bench of W_GFG.bench, reserves a level lower and without the bonus. A rival keeps the same squad until it would
   be a different level; the local side is new each time. */
function wGridOpp(club, tier) {
  const B = wGfg(), lvl = wGridOppLvl(tier), C = club === 'apex' ? Object.assign({}, W_CUP.apexTeam) : wBallTeam(club), k = W_GFG.oppBonus[tier] || 0;
  const cached = club !== 'local' && B.opp[club];
  let team;
  if (cached && cached.lvl === lvl && cached.team.roster.length > W_GFR.side) team = JSON.parse(JSON.stringify(cached.team));
  else {
    const rg = wBallRegion(club), own = rg ? (DB.regions[rg] || {}).kinds || [] : (C.roster || []).map(r => r[1]);
    // the seven's kinds, then the bench's (more of the same once they run out)
    const all = own.filter(x => wGF.kinds.includes(x)).concat(W_GFR.cuKinds).filter((x, i, a) => a.indexOf(x) === i);
    const kinds = all.slice(0, W_GFR.side).concat(Array.from({ length: W_GFG.bench }, (_, i) => all[(W_GFR.side + i) % all.length]));
    const names = new Set();
    const roster = kinds.map((kind, i) => {
      const rn = (C.roster || []).find(r => r[1] === kind), free = (FA_NAMES[kind] || []).filter(n => !names.has(n));
      const p = wMakePlayer({ kind, lvl: i < W_GFR.side ? lvl : Math.max(1, lvl - 1), n: rn && !names.has(rn[0]) ? rn[0] : free.length ? pick(free) : undefined, num: rn ? rn[2] : undefined }, 'opp');
      names.add(p.n);
      return wSevenPlayer(p);
    });
    team = { name: C.name, short: C.short, color: C.color, light: C.light, roster };
    if (club !== 'local') B.opp[club] = { lvl, team: JSON.parse(JSON.stringify(team)) };
  }
  // the same ratings each time for the same club (a fixed order over the six), so a rival doesn't change between games
  wGridNums(team.roster);
  if (k) for (const p of team.roster.slice(0, W_GFR.side)) { const st = Object.keys(p.r); for (let i = 0; i < k; i++) { const s = st[(i * 5 + (p.num || 0)) % st.length]; p.r[s] = Math.min(W_GFR.cap, p.r[s] + 1); } }
  return team;
}

/* your squad for a game: the seven, then a bench of W_GFG.bench: your players sitting out first (the highest level
   first), then call-ups at your level, named apart from the other side (vs: their team). { team (as Cinder Gridiron
   takes one), ids (roster ids; null for a call-up) } */
function wGridSquad(vs) {
  const S = wSevenSync(), team = wSevenTeam(), ids = S.ids.slice();
  const out = wRoster().filter(p => !S.ids.includes(p.id)).sort((a, b) => b.lvl - a.lvl).slice(0, W_GFG.bench);
  for (const p of out) { team.roster.push(wSevenPlayer(p)); ids.push(p.id); }
  const used = new Set(team.roster.map(p => p.n).concat(vs ? vs.roster.map(p => p.n) : []));
  for (let i = 0; team.roster.length < W_GFR.side + W_GFG.bench; i++) { team.roster.push(wSevenPlayer(wMakeCallUp(W_GFR.cuKinds[i % W_GFR.cuKinds.length], used))); ids.push(null); }
  wGridNums(team.roster);
  return { team, ids };
}
// no two on a side wear the same number: the first to have it keeps it, the rest move up to a free one
function wGridNums(roster) {
  const seen = new Set();
  for (const p of roster) { let n = p.num || 1; while (seen.has(n)) n = n % 99 + 1; p.num = n; seen.add(n); }
  return roster;
}

/* ---------- starting, leaving, coming back ---------- */
function wStartGrid(o) {
  if (!WG || !RUN) return '';
  const probs = wGridProblems(); if (probs.length) return probs.join(' ');
  const B = wGfg(), club = o.club;
  if (B.live) return 'Finish the football game you started first.';
  if (!wBallRegion(club) && !CLUBS[club] && club !== 'apex') return '';
  if (!o.cup && B.met[club] === WG.dayAbs) return `${wCap(wBallName(club))} have already played you at football today. Come back tomorrow.`;
  const how = W_GFG_HOW[o.how] ? o.how : 'play', tier = o.tier || wBallTier(club);
  const opp = wGridOpp(club, tier), sq = wGridSquad(opp), mine = sq.team;
  const world = { kind: o.kind || 'gfgame', ref: o.ref || null, club, tier, how, day: WG.dayAbs, name: opp.name, ids: sq.ids, cup: !!o.cup };
  if (!o.cup) B.met[club] = WG.dayAbs;
  B.live = { world, snap: null };
  if (how === 'sim') {
    const g = wGF.simGame({ teams: [mine, opp], skill: wGridSkill(tier) });
    const msg = wGridSettle(wGridResult(g.score), g.score[0], g.score[1], g.box, g.half);
    wGridResultCard(msg);
    return '';
  }
  wGridironGame({ mode: how === 'play' ? 'play' : 'call', teams: [mine, opp], skill: wGridSkill(tier) });
  WGF.world = true;
  $('wGridTitle').textContent = `${mine.name} against ${opp.name}`;
  wGridBar();
  wSave();
  return '';
}
// how well each side casts its powers when the coaches cast them: yours (Auto powers, and Simulate) as a Knight, theirs
// by tier, as on the diamond (W_BALL.diff: Squire, Knight, Archmage)
const wGridSkill = tier => [1, W_BALL.diff[tier] != null ? W_BALL.diff[tier] : 1];
const wGridResult = sc => sc[0] > sc[1] ? 'win' : sc[0] < sc[1] ? 'lose' : 'tie';
function wResumeGrid() {
  const L = wGridLive() && WG.gfg.live;
  if (!L) return;
  if (!L.snap) { wGridCallOff('The game had not reached its first play, so it is called off.'); return; }
  WGF = { kind: 'game', mode: L.snap.GD.mode, over: null, teams: L.snap.G.teams, world: true };
  wGF.resume(L.snap);
  showView('gridiron');
  wGridChrome('game');
  $('wGridTitle').textContent = `${L.snap.G.teams[0].name} against ${L.snap.G.teams[1].name}`;
  wGridBar();
}
// Save and leave: the game stays at its last call in WG.gfg.live. Pressed during a play (or the beat after it), you
// leave at the next call, so the play counts: leaving can't take back an interception
function wGridLeave() {
  const L = wGridLive() && WG.gfg.live; if (!L) return wLeaveGridiron();
  const ph = wGF.phase;
  if (wGridWorld() && L.snap && ph && ph !== 'call' && ph !== 'over') { WGFG.leaving = true; wGridBar(); return; }
  WGFG.leaving = false;
  const sn = L.snap;
  WGFG.asked = true;
  WGF = null; wLeaveGridiron();
  if (!sn) return wGridCallOff(`You leave before the first play, so the game against ${wBallName(L.world.club)} is called off.`);
  wLog(`Your football game against ${wBallName(L.world.club)} is saved: ${wGridScore(sn)}. Resume it from the Seven tab on the Team screen.`, 'd');
  wSave();
}
function wGridCallOff(why) {
  const B = wGfg(), L = B.live; if (!L) return;
  B.live = null; if (!L.world.cup) delete B.met[L.world.club];
  wLog(why || `The football game against ${wBallName(L.world.club)} is called off. No result.`, 'd');
  wSave();
}
function wGridConcede() {
  if (!wGridWorld()) return;
  wGF.pause(true);
  askConfirm('Concede this game?', 'It counts as a loss. A loss on the gridiron costs nothing, but you only get a quarter of the XP.', 'Concede', () => {
    if (!wGridLive()) return;
    wGF.pause(false);
    const G = wGF.G, sc = G ? G.score : [0, 0];
    wGridSettle('lose', sc[0], sc[1], wGF.box(), G ? G.half : 1);
    WGF = null; wLeaveGridiron();
  }, () => wGF.pause(false));
}
function wGridScore(sn) { const G = sn.G, c = G.clock, m = `${Math.floor(c / 60)}:${String(Math.ceil(c) % 60).padStart(2, '0')}`; return `${G.teams[0].short || G.teams[0].name} ${G.score[0]}, ${G.teams[1].short || G.teams[1].name} ${G.score[1]}, ${['', '1st half', '2nd half', 'Sudden Death'][G.half] || ''} ${m}`; }
wGF.wantSnap = () => wGridWorld();
wGF.onSnap = sn => {
  const L = wGridWorld() && WG.gfg.live; if (!L) return;
  L.snap = sn;
  // (Save and leave was pressed during the play: leave now, after the engine's call beat is set)
  if (WGFG.leaving) { WGFG.leaving = false; setTimeout(() => { if (wGridWorld()) wGridLeave(); }, 0); return; }
  const now = Date.now(); if (now - WGFG.saved > W_GFG.saveMs) { WGFG.saved = now; wSave(); }
};
// the end of a game on the field: an exhibition as before; a real game settles in the world
wGF.onOver = s => {
  if (!WGF) return;
  WGF.over = s;
  if (WGF.world && wGridLive()) { const G = wGF.G; WGF.msg = wGridSettle(wGridResult(G.score), G.score[0], G.score[1], wGF.box(), G.half); }
  wGridBar();
  const f = WGF.world ? $('wGridBack') : $('wGridAgain'); if (f) f.focus();
};

/* ---------- the final ---------- */
function wGridSettle(r, us, them, box, half) {
  const B = wGfg(), L = B.live, W = L.world, win = r === 'win', tie = r === 'tie';
  B.live = null;
  if (win) B.w++; else if (tie) B.t++; else B.l++;
  // box lines for your own players: side 0, by the seven at kick-off (call-ups have no roster id)
  const S = WG.gfstats = WG.gfstats || {}, line = {};
  for (const b of box) {
    if (b.side !== 0 || b.played === false) continue;
    const id = W.ids[b.ri]; if (typeof id !== 'number' || !wPlayer(id)) continue;
    const T = S[id] = S[id] || { gg: 0 };
    T.gg++;
    for (const k in b.line) T[k] = (T[k] || 0) + b.line[k];
    line[id] = Object.assign({}, b.line);
  }
  const mvp = wGridMvp(line);
  const base = Math.round(W_GFG.xp * W.tier * (win ? 1 : tie ? W_GFG.tieShare : W_GFG.lossShare)), inSeven = new Set(box.filter(b => b.side === 0 && b.played).map(b => W.ids[b.ri]).filter(id => typeof id === 'number'));
  for (const p of wRoster()) {
    const n = inSeven.has(p.id) ? base + (win && mvp === p.id ? W_GFG.mvpXp : 0) : Math.round(base * W_GFG.benchShare);
    if (n > 0) wGiveXp(p, n);
  }
  const bits = `XP +${base} for everyone who played${wRoster().some(p => !inSeven.has(p.id)) ? `, +${Math.round(base * W_GFG.benchShare)} for those who sat out` : ''}`;
  let pay = '';
  if (win) { const g = W_GFG.gold * W.tier, f = W_GFG.fans * W.tier; RUN.gold += g; RUN.fans = (RUN.fans || 0) + f; pay = ` +${g} gold, +${f} fans.`; }
  if (CLUBS[W.club]) {
    const H = wH2h(), h = H[W.club] = H[W.club] || { w: 0, l: 0 };
    if (win) h.w++; else if (!tie) h.l++;
    h.last = { r, us, them, sport: 'football', day: WG.dayAbs };
    try { if (!tie && wIsRival(W.club)) wLeagueMine(r); } catch (e) { console.error(e); }
  }
  B.games.unshift({ day: WG.dayAbs, club: W.club, name: W.name, tier: W.tier, how: W.how, r, us, them, half, mvp, line });
  B.games.length = Math.min(B.games.length, W_GFG.keep);
  WG.lastMatch = { kind: W.kind, result: r, day: WG.dayAbs, tier: W.tier };
  // (and each side's yards from scrimmage: a knockout settles a tie on them)
  W.us = us; W.them = them; W.yards = [0, 1].map(s => wGridYards(box, s));
  const f = W_ON_END[W.kind]; if (f) { try { f(r, W.ref, W); } catch (e) { console.error(e); } }
  // the clock after the game's own end: a fixture played late on the eve of a round counts in its round, not as postponed
  wAdvance(W_GFG.minutes);
  const who = mvp != null && wPlayer(mvp);
  const msg = `Final: ${win ? 'you win' : tie ? 'a tie' : 'you lose'} ${us}–${them} against ${wBallName(W.club)}${half === 3 ? ', in Sudden Death' : ''}.${pay} ${bits}${win && who ? `, and +${W_GFG.mvpXp} for ${who.n}, player of the game` : ''}.`;
  wLog(msg, win ? 'g' : 'b');
  wSave();
  return msg;
}
// player of the game: the best line among your own players
function wGridMvp(lines) {
  let best = null, bs = 0;
  for (const id in lines) {
    const s = lines[id], v = (s.py || 0) / 25 + (s.ptd || 0) * 4 - (s.pint || 0) * 2 + (s.ry || 0) / 10 + (s.recy || 0) / 10 + (s.td || 0) * 6 + (s.tkl || 0) + (s.sk || 0) * 2 + (s.ints || 0) * 4 + (s.fgm || 0) * 3;
    if (v > bs) { bs = v; best = +id; }
  }
  return best;
}
W_ON_END.gfgame = function () { }; // the log line and the rewards are paid in wGridSettle; kinds built on it add theirs
function wGridResultCard(msg) {
  if (LAB) return;
  const close = modal(`<header><h3>Final</h3></header><div class="wmsg"><p>${esc(msg)}</p></div><div class="row"><button class="btn" id="wGridOk">Done</button></div>`, () => wDrain());
  $('wGridOk').focus(); $('wGridOk').onclick = () => close();
}

/* ---------- the bar in a real game ---------- */
$('wGridBack').insertAdjacentHTML('beforebegin', '<button class="ghost" id="wGridSave" hidden>Save and leave</button><button class="ghost" id="wGridGive" hidden>Concede</button>');
$('wGridSave').onclick = () => wGridLeave();
$('wGridGive').onclick = () => wGridConcede();
const wW44GridBar = wGridBar;
wGridBar = function () {
  wW44GridBar();
  const real = !!(WGF && WGF.world), live = real && wGridLive();
  $('wGridSave').hidden = $('wGridGive').hidden = !live;
  if (!live) WGFG.leaving = false;
  $('wGridSave').disabled = live && WGFG.leaving; $('wGridSave').textContent = live && WGFG.leaving ? 'Leaving at the next call…' : 'Save and leave';
  $('wGridAgain').hidden = real;
  $('wGridBack').hidden = live;
  // once a real game is over, it can't be played on as an exhibition
  $('wGridModes').hidden = real && !live;
  if (real && !live && WGF.msg) $('wGridNote').textContent = WGF.msg;
};
const wW44LeaveGridiron = wLeaveGridiron;
wLeaveGridiron = function () { wW44LeaveGridiron(); if (WG) { wSave(); wDrain(); } };

/* ---------- picking a game ---------- */
function wGridH2h(club) { const L = ((WG.h2h || {})[club] || {}).last; return L && L.sport === 'football' ? L : null; }
function wOpenGridCard() {
  const probs = wGridProblems(), B = wGfg(), live = wGridLive();
  const rows = wBallClubs().map(c => {
    const T = wBallTeam(c), tier = wBallTier(c), met = B.met[c] === WG.dayAbs, last = wGridH2h(c);
    const btns = Object.keys(W_GFG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-gfclub="${c}" data-gfhow="${how}" ${probs.length || met || live ? 'disabled' : ''}>${W_GFG_HOW[how]}</button>`).join('');
    return `<li class="wbcl"><span class="wbsw" style="background:${T.color}"></span><div><b>${esc(T.name)}</b>
      <small>Tier ${tier}: their players are level ${wGridOppLvl(tier)}, CPU skill ${W_BALL_SKILL[wGridSkill(tier)[1]]}.${last ? ` Last football game: ${last.r === 'win' ? 'won' : last.r === 'tie' ? 'tied' : 'lost'} ${last.us}–${last.them}.` : ''}${met ? ' <b>Played you today.</b>' : ''}</small></div>
      <div class="row">${btns}</div></li>`;
  }).join('');
  const close = modal(`<header><h3>Play a football game</h3><button class="ghost" data-close>Done</button></header>
    ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}${WGFG.msg ? `<p class="wbad">${esc(WGFG.msg)}</p>` : ''}
    ${live ? `<p class="wbad">You have a football game waiting. <button class="btn" id="wGfResume">Resume it</button></p>` : ''}
    <p class="hint">A game on the gridiron with your seven: two halves, about seven minutes. <b>Play</b>: you call the plays and play your offense by hand. <b>Manage</b>: you call them and your players run them. <b>Simulate</b>: the result now. A win pays ${W_GFG.xp} XP to the seven, ${W_GFG.gold} gold and ${W_GFG.fans} fans, times the tier; a loss pays a quarter of the XP and costs nothing else, and a tie half. Each club plays you once a day, and a game takes ${W_GFG.minutes / 60 | 0} hours or so.</p>
    <ul class="wbclubs">${rows}</ul>
    <p class="hint">Or watch an exhibition: <button class="ghost" id="wGfExhib">Cinderhold against Mossgate</button></p>`);
  WGFG.msg = '';
  $('modalBox').querySelectorAll('[data-gfclub]').forEach(b => b.onclick = () => {
    close();
    const r = wStartGrid({ club: b.dataset.gfclub, how: b.dataset.gfhow });
    if (r) { WGFG.msg = r; wOpenGridCard(); }
  });
  const ex = $('wGfExhib'); if (ex) ex.onclick = () => { close(); wGridironGame({ mode: 'watch' }); };
  const rs = $('wGfResume'); if (rs) rs.onclick = () => { close(); wResumeGrid(); };
}
// Clinker Dunn's GRIDIRON opens the card
(() => {
  const K = DB.chars.gk_bowl; if (!K || !K.topics.gridiron) return;
  K.topics.gridiron.t = 'Real football on the grass, seven a side and the same seven both ways: two halves, about seven minutes. Play a club for real, at the tier you\'re at, or watch an exhibition.';
})();
const wW44RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'ggame') return wOpenGridCard(); return wW44RunAct.apply(this, arguments); };

/* after a reload, a saved game is waiting: ask once */
const wW44NextPrompt = wNextPrompt;
wNextPrompt = function () {
  if (!LAB && wGridLive() && !WGFG.asked && !WGF && !WD && !WG.cardOffer && !WG.event && wActive()) {
    WGFG.asked = true;
    const L = WG.gfg.live, sn = L.snap;
    const close = modal(`<header><h3>A football game is waiting</h3></header><div class="wmsg"><p>Your game against ${esc(wBallName(L.world.club))} is where you left it${sn ? `: ${esc(wGridScore(sn))}` : ''}.</p><p class="hint">You can also pick it up later from the Seven tab on the Team screen.</p></div>
      <div class="row"><button class="btn" id="wGfRes">Resume</button><button class="ghost" id="wGfLater">Later</button></div>`, () => wDrain());
    $('wGfRes').focus();
    $('wGfRes').onclick = () => { close(); wResumeGrid(); };
    $('wGfLater').onclick = () => close();
    return true;
  }
  return wW44NextPrompt();
};

/* ---------- the Seven tab ---------- */
const wW44CampSeven = wCampSeven;
wCampSeven = function () {
  const html = wW44CampSeven(), probs = wGridProblems(), live = wGridLive();
  const play = live ? `<button class="btn" data-gfresume>Resume the game</button>` : `<button class="btn" data-gfplay ${probs.length ? 'disabled' : ''}>Play a game</button>`;
  const gate = !live && probs.length ? `<p class="hint wball">${esc(probs[0])}</p>` : '';
  return html.replace('<button class="btn" data-gpractice', `${play}<button class="ghost" data-gpractice`).replace(/<\/div>\s*$/, `</div>${gate}${wGridRecent()}`);
};
function wGridRecent() {
  const B = WG.gfg; if (!B || !B.games.length) return '';
  return `<h5 class="wbrh">Last football games: ${B.w}&ndash;${B.l}${B.t ? `&ndash;${B.t}` : ''}</h5><ol class="wstlog">${B.games.slice(0, 5).map(g => `<li><b class="${g.r === 'win' ? 'wgood' : 'wbad'}">${g.r === 'win' ? 'Won' : g.r === 'tie' ? 'Tied' : 'Lost'}</b> ${g.us}&ndash;${g.them} against ${esc(g.name)}<small>day ${g.day}${g.mvp != null && wPlayer(g.mvp) ? `, player of the game ${esc(wPlayer(g.mvp).n)}` : ''}</small></li>`).join('')}</ol>`;
}
const wW44RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW44RenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'seven') return;
  const p = body.querySelector('[data-gfplay]'); if (p) p.onclick = () => { WCAMP.close(); wOpenGridCard(); };
  const r = body.querySelector('[data-gfresume]'); if (r) r.onclick = () => { WCAMP.close(); wResumeGrid(); };
};

/* ---------- box scores on the Stats tab ---------- */
const W_GFG_COLS = [['gg', 'G', 'Football games'], ['pc', 'Cmp', 'Passes completed'], ['pa', 'Att', 'Passes thrown'], ['py', 'PYd', 'Passing yards'], ['ptd', 'PTD', 'Touchdown passes'],
  ['ry', 'RYd', 'Rushing yards'], ['rec', 'Rec', 'Catches'], ['recy', 'RecYd', 'Receiving yards'], ['td', 'TD', 'Touchdowns scored'], ['tkl', 'Tkl', 'Tackles'], ['sk', 'Sk', 'Sacks'], ['ints', 'Int', 'Interceptions'], ['fgm', 'FG', 'Field goals made']];
function wGridLine(pid) { return (WG.gfstats || {})[pid] || null; }
const wW44CampStats = wCampStats;
wCampStats = function () {
  const html = wW44CampStats().replace(/(<button data-wsview="career"[^>]*>Career<\/button>)/, `$1<button data-wsview="football" aria-pressed="${WSTAT.view === 'football'}">Football</button>`);
  if (WSTAT.view !== 'football') return html;
  const k = WSTAT.sort && W_GFG_COLS.some(c => c[0] === WSTAT.sort) ? WSTAT.sort : null;
  const rows = wRoster().map((p, i) => ({ p, i, L: wGridLine(p.id) }));
  if (k) rows.sort((a, b) => (((b.L || {})[k] || 0) - ((a.L || {})[k] || 0)) || a.i - b.i);
  const head = `<th scope="col"><button class="wsth" data-wsort="" aria-pressed="${!k}">Player</button></th>` + W_GFG_COLS.map(([c, s, l]) => `<th scope="col"><button class="wsth" data-wsort="${c}" title="${esc(l)}" aria-pressed="${k === c}">${s}</button></th>`).join('');
  const body = rows.map(({ p, L }) => { const at = WG.seven && WG.seven.ids.includes(p.id) ? wSevenPosOf(p.id) : null;
    return `<tr data-wsp="${p.id}"${WSTAT.pid === p.id ? ' class="wsel"' : ''}><th scope="row"><button class="wsname" data-wsp-open aria-expanded="${WSTAT.pid === p.id}"><img src="${wPlayerPort(p, 40)}" alt=""><span><b>${esc(p.n)}</b><small>${at ? `${at.off} / ${at.def}, ` : ''}Lv ${p.lvl}</small></span></button></th>
    ${W_GFG_COLS.map(([c]) => `<td>${L ? L[c] || 0 : '<span class="dim">&ndash;</span>'}</td>`).join('')}</tr>`; }).join('');
  const sel = WSTAT.pid != null && wPlayer(WSTAT.pid);
  return html.replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Every football game they played on this journey (call-ups are not counted). Pick a heading to sort, a player to see more.</small>')
    .replace(/<div class="tablewrap">[\s\S]*$/, `<div class="tablewrap"><table class="wstats"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${sel ? wStatsCard(sel) : ''}`);
};
const wW44StatsCard = wStatsCard;
wStatsCard = function (p) {
  const L = wGridLine(p.id), html = wW44StatsCard(p);
  if (!L || !L.gg) return html;
  const bits = [`${L.gg} football game${L.gg === 1 ? '' : 's'}`];
  if (L.pa) bits.push(`passing ${L.pc || 0} of ${L.pa} for ${L.py || 0} yards, ${L.ptd || 0} TD, ${L.pint || 0} picked off`);
  if (L.ra) bits.push(`${L.ra} carries for ${L.ry || 0} yards`);
  if (L.rec) bits.push(`${L.rec} catches for ${L.recy || 0} yards`);
  if (L.td) bits.push(`${L.td} touchdown${L.td === 1 ? '' : 's'}`);
  if (L.tkl || L.sk || L.ints) bits.push(`${L.tkl || 0} tackles, ${L.sk || 0} sacks, ${L.ints || 0} interceptions`);
  if (L.fga) bits.push(`${L.fgm || 0} of ${L.fga} field goals`);
  return html.replace('<div class="wbd wgfc"><h5>Football</h5>', `<div class="wbd wgfc"><h5>Football</h5><p class="wbdbox">${bits.join('; ')}.</p>`);
};

const wW44RenderHelp = renderHelp;
renderHelp = function () {
  wW44RenderHelp();
  const after = $('wHelpSeven'); if (!after || $('wHelpGfGame')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpGfGame"><b>Football games.</b> Once you have ${W_GFG.minOwn} players of your own, your seven can play football: Play a game on the Seven tab, or ask Clinker Dunn at the Ash Bowl for GRIDIRON. Take on the local side or a rival club, once a day each. Play (you call the plays and play your offense by hand), Manage (you call them, your players run them), or Simulate for the result at once. There is no team HP on the gridiron. A win pays XP to the seven (half to players who sat out), gold and fans; a loss pays a quarter of the XP, and a tie half. Save and leave keeps a game at its last call; pressed during a play, you leave at the next call, so the play counts. The Stats tab's Football view has every player's box score.</p>`);
};
