/* w150: jousting from the world (issue #117, phase 5), as w125 is curling's. Your four joust a rival club, or the local
   side, at the Tilting Lists: Play (You ride: every course of yours by hand), Manage (your riders ride on their
   ratings; before each of your courses the plan and your squires' jobs are your calls, your squire's word first, or
   leave it all to your squires; You ride on the bar takes the reins at any time) or Simulate (the result at once).
   Sir Ruddock's MATCH and the Lists tab open the match card: the clubs at your tier, each once a day, and the
   exhibition (JOUST) as before. A match needs W_JTG.minOwn players of your own; call-ups fill the four.
   Their four: at your level plus the tier, with W_JTG.oppBonus points spread over each; a rival keeps the same four
   until it would be a different level. The captain's pick rides their two best riders, each on the mount that suits
   them (wJT.mountFor). Their corner and their riders by tier (a Squire, a Knight, an Archmage), as on the sheet.
   The result: a win pays XP to everyone in the four (half to the rest of the team), gold and fans by tier, and the
   player of the match a little more; a loss a quarter of the XP and costs nothing else. A match never ends level (the
   tilt for the crown). Every match adds your four's box lines to WG.jtstats (wJtRecord, w148: courses, lances broken,
   helm breaks, unhorsings, seats kept, squire's jobs), and goes in the head to head and the league table.
   Save and leave keeps the match between courses (a course being ridden is ridden out first, by your side's own
   hands), and it is waiting when you come back, after a reload too. The match is saved at once as each course sets
   off and as it closes (phase 5's review): a reload never brings an earlier course back, a course being ridden is
   ridden out on the plans committed, and a match that has begun is never called off. Concede counts as a loss.
   League fixtures at the Lists (w24): your fixture there is a jousting match (Play, Manage or Simulate) instead of a
   card match, and the clubs' own fixtures there are jousted on the engine. A win is two points on the table and the
   fixture's fans, and either way the fixture is done. (The Gilded Lance, the weekly cup, is phase 10.)

   WG.jtg     { live: null | { world, snap }, met: { club: dayAbs }, opp: { club: { lvl, team } }, games: [last W_JTG.keep], w, l }
              world = { kind: 'jtgame' | 'jtfix', ref, club, tier, how, day, name, ids, cup }, plain data; the end
              dispatches W_ON_END[kind] (which also gets us and them: the totals, and text: "5 to 3"). ids: your four's
              roster ids in the engine's order (heat 1's rider, heat 2's, the squires; null for a call-up)
   wListsProblems(), wStartLists({ club, how, tier?, kind?, ref?, cup? }), wResumeLists(), wListsLeaveGame(),
   wListsConcede(), wOpenListsCard(), wListsSimClubs(a, b, tier), wJtfixPlay(how), W_ON_END.jtgame, W_ON_END.jtfix
   Wraps: wListsBarNote (wW150ListsBarNote: Save and leave and Concede in a real match), wLeaveLists (wW150LeaveLists),
   wListsRows (wW150ListsRows: Manage's row), wJT.onOver and wJT.onPhase (a real match settles, and is kept between
   courses), wRunAct (wW150RunAct: MATCH opens the card), wNextPrompt (wW150NextPrompt: a match waiting after a reload),
   wCampLists and wRenderCamp (wW150CampLists, wW150RenderCamp: Joust a match, Resume and the last matches on the Lists
   tab), wOpenGrdCard (wW150OpenGrdCard: the Lists' fixture row jousts on the engine), wSimAt (wW150SimAt: the clubs'
   matches at the Lists on the engine), wListsHowHTML (wW150ListsHow), renderHelp (wW150RenderHelp: #wHelpListsGame). */

const W_JTG = {
  minOwn: 2, xp: 12, gold: 15, fans: 3, lossShare: .25, benchShare: .5, mvpXp: 5,
  // extra rating points for each of their four, by tier; first guesses until the lab measures them (phase 12)
  oppBonus: { 1: 1, 2: 1, 3: 1 },
  minutes: 120, keep: 10, saveMs: 12000,
};
const W_JTG_HOW = { play: 'Play', manage: 'Manage', sim: 'Simulate' };
const W_JTFIX = { g: 'g_lists', tier: 2 };
const WJTG = { saved: 0, asked: false, msg: '', keepMode: null };
W_LISTS_MODES.manage = { n: 'Manage', title: 'Your riders ride on their ratings. Before each of your courses the plan and your squires\' jobs are your calls (or leave it to your squires). You ride takes the reins.' };
(() => { const play = $('wListsModes').querySelector('[data-jmode="play"]'); play.insertAdjacentHTML('beforebegin', `<button class="ghost" data-jmode="manage" title="${esc(W_LISTS_MODES.manage.title)}">Manage</button>`); })();

function wJtg() {
  const B = WG.jtg = WG.jtg || { live: null, met: {}, opp: {}, games: [], w: 0, l: 0 };
  B.met = B.met || {}; B.opp = B.opp || {}; B.games = B.games || [];
  return B;
}
function wListsLive() { return !!(WG && WG.jtg && WG.jtg.live); }
function wListsWorld() { return !!(WJT && WJT.world && wListsLive()); }
function wListsProblems() {
  const n = wRoster().length;
  return n < W_JTG.minOwn ? [`Recruit ${W_JTG.minOwn - n} more player${W_JTG.minOwn - n === 1 ? '' : 's'}: a jousting match needs ${W_JTG.minOwn} of your own, and call-ups fill the rest of the four.`] : [];
}
// the CPU's skill by tier: your side's hands are a Knight's (Manage), theirs a Squire's, a Knight's or an Archmage's
const wListsSkillOf = tier => [1, W_BALL.diff[tier] != null ? W_BALL.diff[tier] : 1];
const wJtRsOfR = r => Object.fromEntries(wJT.stats.map(s => [s, (r[s] - 1) / (wJT.cap - 1)]));

// a club's four: its own kinds first, at your level plus the tier with the bonus; a rival keeps the same four. The
// captain's pick rides its two best riders, each on the mount that suits them
function wListsOpp(club, tier) {
  const B = wJtg(), lvl = wBallOppLvl(tier), C = club === 'apex' ? Object.assign({}, W_CUP.apexTeam) : wBallTeam(club), k = W_JTG.oppBonus[tier] || 0;
  const cached = club !== 'local' && B.opp[club];
  let team;
  if (cached && cached.lvl === lvl) team = JSON.parse(JSON.stringify(cached.team));
  else {
    const rg = wBallRegion(club), own = rg ? (DB.regions[rg] || {}).kinds || [] : (C.roster || []).map(r => r[1]);
    const all = own.filter(x => Object.prototype.hasOwnProperty.call(wJT.kinds, x)).concat(W_JTR.cuKinds).filter((x, i, a) => a.indexOf(x) === i);
    const names = new Set(), mk = kind => {
      const rn = (C.roster || []).find(r => r[1] === kind), free = (FA_NAMES[kind] || []).filter(x => !names.has(x));
      const p = wMakePlayer({ kind, lvl, n: rn && !names.has(rn[0]) ? rn[0] : free.length ? pick(free) : undefined }, 'opp');
      names.add(p.n);
      return wListsPlayer(p);
    };
    team = { name: C.name, short: C.short, color: C.color, roster: all.slice(0, 4).map(mk) };
    if (club !== 'local') B.opp[club] = { lvl, team: JSON.parse(JSON.stringify(team)) };
  }
  if (k) team.roster.forEach((p, j) => { const st = wJT.stats; for (let i = 0; i < k; i++) { const s = st[(i * 3 + j) % st.length]; p.r[s] = Math.min(wJT.cap, p.r[s] + 1); } });
  const A = wJT.autoSquad(team.roster), n = wListsCourses();
  return Object.assign(team, { riders: A.riders, squires: A.squires, mounts: A.riders.map(i => wJT.mountFor(wJtRsOfR(team.roster[i].r), n).m), best: wJT.bestOf(team.roster, A.riders) });
}
// your four for a match, named apart from theirs; ids: roster ids in the engine's order (null for a call-up)
function wListsSquad(vs) {
  const C = wListsSync(), team = wListsMine(), ids = C.four.map(k => typeof k === 'number' ? k : null), theirs = new Set(vs ? vs.roster.map(p => p.n) : []);
  team.roster.forEach((p, i) => { if (ids[i] == null && theirs.has(p.n)) p.n += ' II'; });
  return { team, ids };
}
// the match's options for the engine: both sides' four, riders, squires, mounts and best, their skill by tier
function wListsOpts(mine, opp, tier) {
  return { teams: [mine, opp], riders: [mine.riders, opp.riders], squires: [mine.squires, opp.squires], mounts: [mine.mounts, opp.mounts], best: [mine.best, opp.best], skill: wListsSkillOf(tier), courses: wListsCourses() };
}

/* ---------- starting, leaving, coming back ---------- */
function wStartLists(o) {
  if (!WG || !RUN) return '';
  const probs = wListsProblems(); if (probs.length) return probs.join(' ');
  const B = wJtg(), club = o.club;
  if (B.live) return 'Finish the jousting match you started first.';
  if (!wBallRegion(club) && !CLUBS[club] && club !== 'apex') return '';
  if (!o.cup && B.met[club] === WG.dayAbs) return `${wCap(wBallName(club))} have already jousted you today. Come back tomorrow.`;
  const how = W_JTG_HOW[o.how] ? o.how : 'play', tier = o.tier || wBallTier(club);
  const opp = wListsOpp(club, tier), sq = wListsSquad(opp), mine = sq.team;
  const world = { kind: o.kind || 'jtgame', ref: o.ref || null, club, tier, how, day: WG.dayAbs, name: opp.name, ids: sq.ids, cup: !!o.cup };
  if (!o.cup) B.met[club] = WG.dayAbs;
  B.live = { world, snap: null };
  const opts = wListsOpts(mine, opp, tier);
  if (how === 'sim') { const seed = (Math.random() * 1e9) | 0, s = wListsDecide(wJT.simMatch(Object.assign({ seed }, opts)), seed); wListsResultCard(wListsSettle(s)); return ''; }
  // (your own Lists mode, back when the match is settled or you leave: wListsModeBack)
  if (WJTG.keepMode == null) WJTG.keepMode = W_LISTS_MODE;
  W_LISTS_MODE = how;
  wListsGame(Object.assign({}, opts, { mode: how, title: `${mine.name} against ${opp.name}` }));
  WJT.world = true;
  wListsBarNote(); wListsRows();
  wSave();
  return '';
}
function wResumeLists() {
  const L = wListsLive() && WG.jtg.live; if (!L) return;
  if (!L.snap) { wListsCallOff('The match had not reached its first course, so it is called off.'); return; }
  WJT = { over: null, world: true };
  if (WJTG.keepMode == null) WJTG.keepMode = W_LISTS_MODE;
  W_LISTS_MODE = L.snap.mode || W_LISTS_MODE;
  wJT.resume(L.snap);
  $('wListsTitle').textContent = `${L.snap.G.teams[0].name} against ${L.snap.G.teams[1].name}`;
  showView('lists');
  wListsBarNote(); wListsRows(); wListsBoard();
}
function wListsLeaveGame() {
  const L = wListsLive() && WG.jtg.live; if (!L) return wLeaveLists();
  if (wListsWorld()) {
    // a course being ridden is ridden out (a match it decided is settled), any other is kept after it
    wJT.finishCourse();
    if (!wListsLive()) { WJT = null; wListsModeBack(); wW150LeaveLists(); wSave(); return; }
    if (!wJT.G.over) L.snap = wJT.snapshot();
  }
  const sn = L.snap;
  WJTG.asked = true;
  WJT = null; wListsModeBack(); wW150LeaveLists();
  if (!sn) return wListsCallOff(`You leave before the first course, so the match against ${wBallName(L.world.club)} is called off.`);
  wLog(`Your jousting match against ${wBallName(L.world.club)} is saved: ${wListsScore(sn)}. Resume it from the Lists tab on the Team screen.`, 'd');
  wSave();
}
function wListsModeBack() { if (WJTG.keepMode != null) { W_LISTS_MODE = WJTG.keepMode; WJTG.keepMode = null; } }
function wListsCallOff(why) {
  const B = wJtg(), L = B.live; if (!L) return;
  B.live = null; if (!L.world.cup) delete B.met[L.world.club];
  wLog(why || `The jousting match against ${wBallName(L.world.club)} is called off. No result.`, 'd');
  wSave();
}
function wListsConcede() {
  if (!wListsWorld()) return;
  wJT.pause(true);
  askConfirm('Concede this match?', 'It counts as a loss. A loss at the Lists costs nothing, but you only get a quarter of the XP.', 'Concede', () => {
    if (!wListsLive()) return;
    const s = wJT.summary() || {}; s.win = 1; s.text = 'conceded';
    wListsSettle(s);
    WJT = null; wListsModeBack(); wW150LeaveLists();
  }, () => { if (WJT) wJT.pause(false); });
  wAfterAsk(() => { if (WJT) wJT.pause(false); });
}
// the score in a snapshot, in words
function wListsScore(sn) {
  const G = sn.G, t = s => G.sc[s].reduce((a, h) => a + h.reduce((x, y) => x + (y || 0), 0), 0) + (G.tilt[s] || []).reduce((a, b) => a + b, 0);
  const where = G.heat >= 2 ? 'in the tilt for the crown' : `heat ${G.heat + 1}, after ${G.course} course${G.course === 1 ? '' : 's'}`;
  return `${t(0)} to ${t(1)}, ${where}`;
}

/* ---------- kept between courses, and settled at the end ---------- */
const wW150OnPhase = wJT.onPhase;
wJT.onPhase = ph => {
  wW150OnPhase(ph);
  if (!['next', 'plan', 'herald', 'charge', 'seat', 'after'].includes(ph) || !wListsWorld() || !wJT.G || wJT.G.over) return;
  const L = WG.jtg.live, first = !L.snap; L.snap = wJT.snapshot();
  // (the beat before a course (your plan, or the herald's: what was decided for it, their plan, corner and potion,
  // comes back on a reload; phase 7's review), a course set off, its lances met (the balance moment: phase 6's review),
  // or closed, is saved at once: a reload never brings an earlier course back, nor rides one twice,
  // nor calls off a match that has begun; the course being ridden is kept with the plans committed: phase 5's review)
  const now = Date.now(); if (first || ph !== 'next' || now - WJTG.saved > W_JTG.saveMs) { WJTG.saved = now; wSave(); }
};
const wW150OnOver = wJT.onOver;
wJT.onOver = s => {
  if (WJT && WJT.world && wListsLive()) { WJT.msg = wListsSettle(s); WJT.endMode = wJT.mode; wListsModeBack(); }
  wW150OnOver(s);
  wListsBarNote();
};
function wListsSettle(sum) {
  const B = wJtg(), L = B.live, W = L.world, S0 = sum || {}, win = (S0.win != null ? S0.win : S0.over ? S0.over.win : -1) === 0;
  B.live = null;
  const r = win ? 'win' : 'lose', tot = S0.tot || [0, 0], us = tot[0], them = tot[1], text = S0.text || (S0.over && S0.over.text) || `${us} to ${them}`;
  if (win) { B.w++; fire('matchWon', { engine: 'lists' }); } else B.l++;
  const pst = (S0.pst || [[]])[0] || [], line = {}, played = new Set();
  W.ids.forEach((id, i) => {
    if (typeof id !== 'number' || !wPlayer(id)) return;
    played.add(id);
    const p = pst[i] || {};
    line[id] = { courses: p.courses || 0, breaks: p.breaks || 0, helms: p.helms || 0, unhorse: p.unhorse || 0, kept: p.kept || 0, jobs: p.jobs || 0 };
  });
  wJtRecord(S0, 0, W.ids);
  const mvp = wListsMvp(line);
  const base = Math.round(W_JTG.xp * W.tier * (win ? 1 : W_JTG.lossShare));
  for (const p of wRoster()) { const n = played.has(p.id) ? base + (win && mvp === p.id ? W_JTG.mvpXp : 0) : Math.round(base * W_JTG.benchShare); if (n > 0) wGiveXp(p, n); }
  const bits = `XP +${base} for everyone in the four${wRoster().some(p => !played.has(p.id)) ? `, +${Math.round(base * W_JTG.benchShare)} for those who weren't` : ''}`;
  let pay = '';
  if (win) { const g = W_JTG.gold * W.tier, f = W_JTG.fans * W.tier; RUN.gold += g; RUN.fans = (RUN.fans || 0) + f; pay = ` +${g} gold, +${f} fans.`; }
  if (CLUBS[W.club]) {
    const H = wH2h(), h = H[W.club] = H[W.club] || { w: 0, l: 0 };
    if (win) h.w++; else h.l++;
    h.last = { r, us, them, sport: 'jousting', day: WG.dayAbs, text };
    try { if (wIsRival(W.club)) wLeagueMine(r); } catch (e) { console.error(e); }
  }
  const tilt = S0.tilt || (S0.over && S0.over.tilt) ? 'tc' : '';
  B.games.unshift({ day: WG.dayAbs, club: W.club, name: W.name, tier: W.tier, how: W.how, r, us, them, text, end: tilt, mvp, line });
  B.games.length = Math.min(B.games.length, W_JTG.keep);
  WG.lastMatch = { kind: W.kind, result: r, day: WG.dayAbs, tier: W.tier };
  W.us = us; W.them = them; W.text = text;
  const f = W_ON_END[W.kind]; if (f) { try { f(r, W.ref, W); } catch (e) { console.error(e); } }
  wAdvance(W_JTG.minutes);
  const who = mvp != null && wPlayer(mvp), how = text === 'conceded' ? ', conceded' : text ? `, ${text}` : '';
  const msg = `Final: ${win ? 'you win' : 'you lose'}${how} against ${wBallName(W.club)}.${pay} ${bits}${win && who ? `, and +${W_JTG.mvpXp} for ${who.n}, player of the match` : ''}.`;
  wLog(msg, win ? 'g' : 'b');
  wSave();
  return msg;
}
// a match the engine stopped before it was decided (it never should: the tilt for the crown has the marshal's count at
// its end): the side ahead wins it; level, the side it falls to by the match's seed
function wListsDecide(s, seed) {
  if (!s || s.win === 0 || s.win === 1) return s;
  const t = (s.tot || [0, 0]).slice(), k = t[0] === t[1] ? (seed != null ? Math.abs(seed | 0) % 2 : Math.random() < .5 ? 0 : 1) : t[0] > t[1] ? 0 : 1;
  s.win = k; s.tot = t; s.text = `${Math.max(t[0], t[1])} to ${Math.min(t[0], t[1])}, on the marshal's count`;
  return s;
}
// player of the match: an unhorsing counts most, then the lances broken (a helm break twice), the seats kept, and a
// squire's jobs a little
function wListsMvp(lines) {
  let best = null, bs = 0;
  for (const id in lines) { const s = lines[id], v = 3 * s.unhorse + s.breaks + s.helms + .5 * s.kept + .25 * s.jobs; if (v > bs + 1e-9) { bs = v; best = +id; } }
  return best;
}
W_ON_END.jtgame = function () { };
function wListsResultCard(msg) {
  if (LAB) return;
  const close = modal(`<header><h3>Final</h3></header><div class="wmsg"><p>${esc(msg)}</p></div><div class="row"><button class="btn" id="wListsOk">Done</button></div>`, () => wDrain());
  $('wListsOk').focus(); $('wListsOk').onclick = () => close();
}

/* ---------- the bar in a real match, and Manage's row ---------- */
$('wListsBack').insertAdjacentHTML('beforebegin', '<button class="ghost" id="wListsSave" hidden>Save and leave</button><button class="ghost" id="wListsGive" hidden>Concede</button>');
$('wListsSave').onclick = () => wListsLeaveGame();
$('wListsGive').onclick = () => wListsConcede();
const wW150ListsBarNote = wListsBarNote;
wListsBarNote = function () {
  wW150ListsBarNote();
  const real = !!(WJT && WJT.world), live = real && wListsLive();
  $('wListsSave').hidden = $('wListsGive').hidden = !live;
  $('wListsAgain').hidden = real; $('wListsBack').hidden = live; $('wListsCourses').parentElement.hidden = real; $('wListsSkill').parentElement.hidden = real;
  if (real && !live && WJT.msg) $('wListsNote').textContent = WJT.msg;
  // (a settled match still shows the mode it was played in; your own is back for the next game)
  if (real && WJT.over && WJT.endMode) for (const b of $('wListsModes').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.jmode === WJT.endMode); b.setAttribute('aria-pressed', b.dataset.jmode === WJT.endMode); }
};
const wW150LeaveLists = wLeaveLists;
wLeaveLists = function () { if (wListsWorld()) return wListsLeaveGame(); wListsModeBack(); wW150LeaveLists(); if (WG) { wSave(); wDrain(); } };
$('wListsRows').insertAdjacentHTML('beforebegin', '<div id="wListsMgrRow" class="wccalls" hidden><div class="wccrow"><span class="wccl">Your calls</span><span id="wListsMgr"></span></div></div>');
$('wListsMgrRow').addEventListener('click', e => { const b = e.target.closest('[data-jauto2]'); if (!b) return; wJT.manage({ auto: b.dataset.jauto2 === '1' }); wListsRows(); wListsBarNote(); });
const wW150ListsRows = wListsRows;
wListsRows = function () {
  wW150ListsRows();
  const V = WJT && !WJT.over && wJT.G && wJT.G.teams ? wJT.view : null, mgr = !!V && V.mode === 'manage' && !V.yard;
  $('wListsMgrRow').hidden = !mgr; if (!mgr) return;
  const A = !!V.mgrAuto;
  $('wListsMgr').innerHTML = `<button class="ghost${A ? '' : ' on'}" data-jauto2="0" title="Before each of your courses, set the plan and your squires' jobs, then Send them">Mine</button> <button class="ghost${A ? ' on' : ''}" data-jauto2="1" title="Your squire's word for the plan and your corner's word for the jobs, every course">Leave it to your squires</button> <small class="hint">Your riders ride on their ratings. You ride on the bar takes the reins.</small>`;
};

/* ---------- picking a match ---------- */
function wListsH2h(club) { const L = ((WG.h2h || {})[club] || {}).last; return L && L.sport === 'jousting' ? L : null; }
function wOpenListsCard() {
  const probs = wListsProblems(), B = wJtg(), live = wListsLive(), f = wJtfixHere();
  const rows = wBallClubs().map(c => {
    const T = wBallTeam(c), tier = wBallTier(c), met = B.met[c] === WG.dayAbs, last = wListsH2h(c);
    const btns = Object.keys(W_JTG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-jtclub="${c}" data-jthow="${how}" ${probs.length || met || live ? 'disabled' : ''}>${W_JTG_HOW[how]}</button>`).join('');
    return `<li class="wbcl"><span class="wbsw" style="background:${T.color}"></span><div><b>${esc(T.name)}</b>
      <small>Tier ${tier}: their riders are level ${wBallOppLvl(tier)}, and ride like a ${W_BALL_SKILL[wListsSkillOf(tier)[1]]}.${last ? ` Last jousting match: ${last.r === 'win' ? 'won' : 'lost'}${last.text ? ' ' + esc(last.text) : ''}.` : ''}${met ? ' <b>Jousted you today.</b>' : ''}</small></div>
      <div class="row">${btns}</div></li>`;
  }).join('');
  const close = modal(`<header><h3>Joust a match</h3><button class="ghost" data-close>Done</button></header>
    ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}${WJTG.msg ? `<p class="wbad">${esc(WJTG.msg)}</p>` : ''}
    ${live ? `<p class="wbad">You have a jousting match waiting. <button class="btn" id="wJtResume">Resume it</button></p>` : ''}
    <p class="hint">A tourney at the Tilting Lists with your four (the Lists tab sets who rides and who squires): two heats of ${wListsCourses()} courses (Settings has the length), and the tilt for the crown if level. <b>Play</b>: you ride every course of yours. <b>Manage</b>: your riders ride on their ratings; the plan and your squires' jobs are your calls, or leave them to your squires. <b>Simulate</b>: the result now. A win pays ${W_JTG.xp} XP to everyone in the four, ${W_JTG.gold} gold and ${W_JTG.fans} fans, times the tier; a loss pays a quarter of the XP and costs nothing else. Each club jousts you once a day, and a match takes a couple of hours.</p>
    <ul class="wbclubs">${rows}</ul>
    ${f ? `<p class="hint">Your league fixture against ${esc(wTheClub(f.club))} is here at the Tilting Lists, by day ${f.day}: joust it from the ground's card.</p>` : ''}
    <p class="hint">Or watch a tourney: <button class="ghost" id="wJtExhib">Mossgate against Cinderhold</button></p>`);
  WJTG.msg = '';
  $('modalBox').querySelectorAll('[data-jtclub]').forEach(b => b.onclick = () => {
    close();
    const r = wStartLists({ club: b.dataset.jtclub, how: b.dataset.jthow });
    if (r) { WJTG.msg = r; wOpenListsCard(); }
  });
  const ex = $('wJtExhib'); if (ex) ex.onclick = () => { close(); wListsGame(); };
  const rs = $('wJtResume'); if (rs) rs.onclick = () => { close(); wResumeLists(); };
}
(() => {
  const K = DB.chars.gk_lists; if (!K) return;
  K.topics.job.t += ' Bring your four for a MATCH and I will find you a club to joust for real.';
  K.topics.match = { t: 'Real jousting, your four against a club at your tier. Two ride, two squire. I judge every course, and I see everything. Strike the barrier and it is a point off, and I make you mend it.', act: 'jtcard' };
})();
const wW150RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'jtcard') return wOpenListsCard(); return wW150RunAct.apply(this, arguments); };

const wW150NextPrompt = wNextPrompt;
wNextPrompt = function () {
  if (!LAB && wListsLive() && !WJTG.asked && !WJT && !WD && !WG.cardOffer && !WG.event && wActive()) {
    WJTG.asked = true;
    const L = WG.jtg.live, sn = L.snap;
    const close = modal(`<header><h3>A jousting match is waiting</h3></header><div class="wmsg"><p>Your match against ${esc(wBallName(L.world.club))} is where you left it${sn ? `: ${esc(wListsScore(sn))}` : ''}.</p><p class="hint">You can also pick it up later from the Lists tab on the Team screen.</p></div>
      <div class="row"><button class="btn" id="wJtRes">Resume</button><button class="ghost" id="wJtLater">Later</button></div>`, () => wDrain());
    $('wJtRes').focus();
    $('wJtRes').onclick = () => { close(); wResumeLists(); };
    $('wJtLater').onclick = () => close();
    return true;
  }
  return wW150NextPrompt();
};

/* ---------- the Lists tab: Joust a match, Resume, and the last matches ---------- */
const wW150CampLists = wCampLists;
wCampLists = function (C) {
  const html = wW150CampLists(C), probs = wListsProblems(), live = wListsLive();
  const play = live ? `<button class="btn" data-jtresume>Resume the match</button>` : `<button class="btn" data-jtplay ${probs.length ? 'disabled' : ''}>Joust a match</button>`;
  const gate = !live && probs.length ? `<p class="hint wball">${esc(probs[0])}</p>` : '';
  return html.replace('<button class="btn" data-jpractice', `${play}<button class="ghost" data-jpractice`).replace(/<\/div>\s*$/, `</div>${gate}${wListsRecent()}`);
};
function wListsRecent() {
  const B = WG.jtg; if (!B || !B.games.length) return '';
  return `<h5 class="wbrh">Last jousting matches: ${B.w}&ndash;${B.l}</h5><ol class="wstlog">${B.games.slice(0, 5).map(g => `<li><b class="${g.r === 'win' ? 'wgood' : 'wbad'}">${g.r === 'win' ? 'Won' : 'Lost'}</b>${g.text ? ' ' + esc(g.text) : ''} against ${esc(g.name)}<small>day ${g.day}${g.mvp != null && wPlayer(g.mvp) ? `, player of the match ${esc(wPlayer(g.mvp).n)}` : ''}</small></li>`).join('')}</ol>`;
}
const wW150RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW150RenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'lists') return;
  const p = body.querySelector('[data-jtplay]'); if (p) p.onclick = () => { WCAMP.close(); wOpenListsCard(); };
  const r = body.querySelector('[data-jtresume]'); if (r) r.onclick = () => { WCAMP.close(); wResumeLists(); };
};

/* ---------- league fixtures at the Lists, on the sand ---------- */
const wJtfixHere = () => wFixHere(W_JTFIX.g) || null;
function wJtfixPlay(how) {
  const f = wJtfixHere(); if (!f) return 'Your league fixture is not at the Tilting Lists.';
  return wStartLists({ club: f.club, how, tier: wFixTier(f.club, W_JTFIX.g), kind: 'jtfix', ref: { g: W_JTFIX.g, club: f.club, day: f.day }, cup: true });
}
// the fixture's end: as a fixture at any ground (w24's W_ON_END.ground), with the points; a rival's league row, and the
// head to head of any club in CLUBS, are counted in wListsSettle already. (A conceded fixture says so in the results:
// w129's wResultText reads cd for every sport.)
W_ON_END.jtfix = function (r, ref, W) {
  if (!ref) return;
  const L = wLeague(), F = wFixtures(), club = ref.club;
  const f = F.games.find(x => (x.a === club && x.b === 'me') || (x.a === 'me' && x.b === club));
  if (F.day !== ref.day || !f || f.done) { wLog('That fixture was postponed on its round day, so this match is no longer the fixture: it counts as any other match.', 'd'); return; }
  f.done = 1;
  if (!wIsRival(club)) { wLeagueMine(r); if (!CLUBS[club]) wH2hRecord(club, r, { us: W.us, them: W.them, sport: 'jousting' }); }
  if (L.table[club]) { if (r === 'win') L.table[club].l++; else L.table[club].w++; }
  const res = r === 'win' ? { a: 'me', b: club, sa: W.us, sb: W.them } : { a: club, b: 'me', sa: W.them, sb: W.us };
  L.results.unshift(Object.assign(res, { day: WG.dayAbs, sport: 'jousting', g: ref.g }, W.text === 'conceded' ? { cd: 1 } : {}));
  L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  if (r === 'win') {
    RUN.fans = (RUN.fans || 0) + W_FIX.fans;
    wLog(`Two points on the table. The gallery throws its favours onto the sand, and stays: ${W_FIX.fans} fans.`, 'g');
    wMaybeBid(club);
  }
};
// two clubs' match at the Lists on the engine, both at a tier's level and skill: { ra, rb, w, end ('tc': the tilt) }
function wListsSimClubs(a, b, tier) {
  const B = wJtg(), kept = JSON.parse(JSON.stringify(B.opp)), A = wListsOpp(a, tier), Bt = wListsOpp(b, tier);
  B.opp = kept;
  const sk = wListsSkillOf(tier)[1], seed = (Math.random() * 1e9) | 0, o = wListsOpts(A, Bt, tier);
  const s = wListsDecide(wJT.simMatch(Object.assign(o, { skill: [sk, sk], seed })), seed), t = s.tot || [0, 0];
  return { ra: t[0], rb: t[1], w: s.win === 0 ? a : b, end: s.tilt ? 'tc' : '' };
}
const wW150SimAt = wSimAt;
wSimAt = function (a, b, g) {
  if (g !== W_JTFIX.g || LAB) return wW150SimAt(a, b, g);
  const L = wLeague(), s = wListsSimClubs(a, b, W_JTFIX.tier), w = s.w, l = w === a ? b : a;
  L.table[w].w++; L.table[l].l++;
  const res = { day: WG.dayAbs, a: w, b: l, sport: 'jousting', sa: Math.max(s.ra, s.rb), sb: Math.min(s.ra, s.rb), g };
  L.results.unshift(res); L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  return res;
};
const wW150OpenGrdCard = wOpenGrdCard;
wOpenGrdCard = function (id, msg) {
  wW150OpenGrdCard(id, msg);
  if (id !== W_JTFIX.g) return;
  const b = document.querySelector('#modalBox [data-gfix]'), f = wJtfixHere(); if (!b || !f) return;
  const probs = wListsProblems().concat(wListsLive() ? ['Finish the jousting match you started first.'] : []), row = b.closest('.row');
  row.innerHTML = Object.keys(W_JTG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-jtfixhow="${how}" ${probs.length ? 'disabled' : ''}>${W_JTG_HOW[how]}</button>`).join('');
  const small = row.closest('li').querySelector('small'); if (small) small.insertAdjacentHTML('beforeend', ` Jousted on the sand with your four.${probs.length ? ' ' + esc(probs[0]) : ''}`);
  row.querySelectorAll('[data-jtfixhow]').forEach(x => x.onclick = () => { $('modalBox').querySelector('[data-close]').click(); const r = wJtfixPlay(x.dataset.jtfixhow); if (r) wOpenGrdCard(id, r); });
};

/* ---------- How to play ---------- */
const wW150ListsHow = wListsHowHTML;
wListsHowHTML = function () {
  return wW150ListsHow() + `<p class="hint" id="wListsHowGame"><b>Matches.</b> Ask Sir Ruddock for a MATCH, or use the Lists tab: your four against a club at your tier, once a day each. <b>Play</b> is You ride. <b>Manage</b>: your riders ride on their ratings, and before each of your courses the plan and your squires' jobs are your calls (your squire's word first), or leave it all to your squires; You ride on the bar takes the reins at any time. <b>Simulate</b> gives the result at once. Their riders ride like a Squire, a Knight or an Archmage by the tier. A win pays XP, gold and fans by the tier; a loss pays a quarter of the XP and costs nothing else. <b>Save and leave</b> keeps the match between courses (a course being ridden is ridden out first), and it waits for you, after a reload too; <b>Concede</b> counts as a loss. Your league fixture at the Lists is jousted on the sand too.</p>`;
};
const wW150RenderHelp = renderHelp;
renderHelp = function () {
  wW150RenderHelp();
  const after = $('wHelpListsCall') || $('wHelpListsTab') || $('wHelpLists'); if (!after || $('wHelpListsGame')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpListsGame"><b>Jousting matches.</b> Sir Ruddock's MATCH, or Joust a match on the Lists tab: your four against a club at your tier, once a day each, in Play, Manage or Simulate. A win pays XP, gold and fans by the tier; a loss pays a quarter of the XP and costs nothing else. Save and leave keeps the match for later, and your league fixture at the Lists is jousted on the sand.</p>`);
};
