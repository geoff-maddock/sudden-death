/* w125: curling from the world (issue #102, phase 5), as w116 is bowling's. Your four curl a rival club, or the local
   side, at the Curling Shed: Play (you throw every stone of yours), Manage (you set your rink's game, the draw game or
   the hitting game, or leave it to your captain; your four throw on their ratings) or Simulate (the result at once).
   Brush Hennock's MATCH and the Shed tab open the match card: the clubs at your tier, each once a day, the exhibition
   and the practice as before. A match needs W_SHG.minOwn players of your own; call-ups fill the four. Every game at the
   Shed has its ways (12-shed.js): the day's cold (wShedColdNow, by the day), the frost creeping in from the windows,
   the frost sprites and Hennock's pebble at the half.
   Their four: at your level plus the tier, with W_SHG.oppBonus points spread over each; a rival keeps the same four
   until it would be a different level. Their rink by tier (a Squire, a Knight, an Archmage), as on the lanes.
   The result: a win pays XP to everyone who curled (half to the rest of the team), gold and fans by tier, and the player
   of the match a little more; a loss a quarter of the XP and costs nothing else. A curling match never ends level (the
   extra end). Every match adds your curlers' lines to WG.crstats, and goes in the head to head and the league table.
   Save and leave keeps the match between stones, and it is waiting when you come back, after a reload too. The match
   is kept from its first stone, and saved at once as each stone is released (with its release: a reload mid-slide
   brings it to rest on that release, without your sweeping) and as it comes to rest (issue #120): a reload never brings
   a stone back, and a match that has begun is never called off. It is saved at once, too, as you cast a power before
   your stone (wCR.onCommit): a reload doesn't give it back. A match kept after the stone that decided it (or with a
   stone left sliding that decides it) is settled as the page comes back (wShedKeptEnd, called by w159), its result
   card shown, never left waiting. Concede counts as a loss.

   WG.shg     { live: null | { world, snap }, met: { club: dayAbs }, opp: { club: { lvl, team } }, games: [last W_SHG.keep], w, l }
              world = { kind: 'shgame', ref, club, tier, how, day, name, ids, cold }, plain data; the end dispatches
              W_ON_END[kind] (which also gets us and them: the totals, and text: "6 to 4"). ids: your four's roster ids
              in order (null for a call-up)
   WG.crstats { pid: { g, stones, made, ends } }, this journey
   wShedProblems(), wStartShed({ club, how, tier?, kind?, ref? }), wResumeShed(), wShedLeaveGame(), wShedConcede(),
   wOpenShedCard(), wShedKeptOver(), wShedKeptEnd()
   Wraps: wShedBarNote (wW125ShedBarNote: Save and leave and Concede in a real match), wLeaveShed (wW125LeaveShed),
   wCR.onOver and wCR.onPhase (a real match settles, and is kept between stones), wCR.onCommit (kept as a power is
   cast), wShedGame (wW125ShedGame: the Shed's
   ways), wShedRows (wW125ShedRows: Manage's row), wRunAct (wW125RunAct: MATCH opens the card), wNextPrompt
   (wW125NextPrompt: a match waiting after a reload), wCampShed and wRenderCamp (wW125CampShed, wW125RenderCamp: Curl a
   match and Resume on the Shed tab), wCampStats (wW125CampStats: the Curling view's lines), wStatsCard (wW125StatsCard:
   the lines in words), wShedHowHTML (wW125ShedHow), renderHelp (wW125RenderHelp: #wHelpShedGame). */

const W_SHG = {
  minOwn: 2, xp: 12, gold: 15, fans: 3, lossShare: .25, benchShare: .5, mvpXp: 5,
  // extra rating points for each of their four, by tier; first guesses until the lab measures them (phase 10)
  oppBonus: { 1: 1, 2: 1, 3: 1 },
  minutes: 120, keep: 10, saveMs: 12000,
  // the beats a stone is settled in: released (kept with its release, wCR.snapshot) and come to rest; kept and saved at once
  settled: ['slide', 'rest'],
};
const W_SHG_HOW = { play: 'Play', manage: 'Manage', sim: 'Simulate' };
const WSHG = { saved: 0, asked: false, msg: '', card: '' };
W_SHED_MODES.manage = { n: 'Manage', title: 'Your captain throws your side by your call: the draw game or the hitting game, in the row under the ice. Your four throw on their ratings.' };
(() => { const play = $('wShedModes').querySelector('[data-cmode="play"]'); play.insertAdjacentHTML('beforebegin', `<button class="ghost" data-cmode="manage" title="${esc(W_SHED_MODES.manage.title)}">Manage</button>`); })();

function wShg() {
  const B = WG.shg = WG.shg || { live: null, met: {}, opp: {}, games: [], w: 0, l: 0 };
  B.met = B.met || {}; B.opp = B.opp || {}; B.games = B.games || [];
  return B;
}
function wShedLive() { return !!(WG && WG.shg && WG.shg.live); }
function wShedWorld() { return !!(WCR && WCR.world && wShedLive()); }
function wShedProblems() {
  const n = wRoster().length;
  return n < W_SHG.minOwn ? [`Recruit ${W_SHG.minOwn - n} more player${W_SHG.minOwn - n === 1 ? '' : 's'}: a curling match needs ${W_SHG.minOwn} of your own, and call-ups fill the rest of the four.`] : [];
}
const wShedSkillOf = tier => [1, W_BALL.diff[tier] != null ? W_BALL.diff[tier] : 1];
// the day's cold at the Shed, the same all day: heavy, as Hennock likes it, or keen
const wShedColdNow = () => !WG ? 'mid' : ['mid', 'heavy', 'mid', 'keen'][(WG.dayAbs * 7 + 3) % 4];

// a club's four: its own kinds first, at your level plus the tier with the bonus; a rival keeps the same four
function wShedOpp(club, tier) {
  const B = wShg(), lvl = wBallOppLvl(tier), C = club === 'apex' ? Object.assign({}, W_CUP.apexTeam) : wBallTeam(club), k = W_SHG.oppBonus[tier] || 0;
  const cached = club !== 'local' && B.opp[club];
  let team;
  if (cached && cached.lvl === lvl) team = JSON.parse(JSON.stringify(cached.team));
  else {
    const rg = wBallRegion(club), own = rg ? (DB.regions[rg] || {}).kinds || [] : (C.roster || []).map(r => r[1]);
    const all = own.filter(x => wCR.stats.some(s => wCR.rate(x)[s] !== 6.5)).concat(W_CRR.cuKinds).filter((x, i, a) => a.indexOf(x) === i);
    const names = new Set(), mk = kind => {
      const rn = (C.roster || []).find(r => r[1] === kind), free = (FA_NAMES[kind] || []).filter(x => !names.has(x));
      const p = wMakePlayer({ kind, lvl, n: rn && !names.has(rn[0]) ? rn[0] : free.length ? pick(free) : undefined }, 'opp');
      names.add(p.n);
      return wShedPlayer(p);
    };
    team = { name: C.name, short: C.short, color: C.color, roster: all.slice(0, 4).map(mk) };
    if (club !== 'local') B.opp[club] = { lvl, team: JSON.parse(JSON.stringify(team)) };
  }
  if (k) team.roster.forEach((p, j) => { const st = wCR.stats; for (let i = 0; i < k; i++) { const s = st[(i * 5 + j) % st.length]; p.r[s] = Math.min(wCR.cap, p.r[s] + 1); } });
  return team;
}
// your four for a match, named apart from theirs; ids: roster ids in order (null for a call-up)
function wShedSquad(vs) {
  const C = wFourSyncCr(), team = wFourMineCr(), ids = C.four.map(k => typeof k === 'number' ? k : null), theirs = new Set(vs ? vs.roster.map(p => p.n) : []);
  team.roster.forEach((p, i) => { if (ids[i] == null && theirs.has(p.n)) p.n += ' II'; });
  return { team, ids };
}

/* ---------- starting, leaving, coming back ---------- */
function wStartShed(o) {
  if (!WG || !RUN) return '';
  const probs = wShedProblems(); if (probs.length) return probs.join(' ');
  const B = wShg(), club = o.club;
  if (B.live) return 'Finish the curling match you started first.';
  if (!wBallRegion(club) && !CLUBS[club] && club !== 'apex') return '';
  if (!o.cup && B.met[club] === WG.dayAbs) return `${wCap(wBallName(club))} have already curled you today. Come back tomorrow.`;
  const how = W_SHG_HOW[o.how] ? o.how : 'play', tier = o.tier || wBallTier(club), cold = wShedColdNow();
  const opp = wShedOpp(club, tier), sq = wShedSquad(opp), mine = sq.team;
  const world = { kind: o.kind || 'shgame', ref: o.ref || null, club, tier, how, day: WG.dayAbs, name: opp.name, ids: sq.ids, cold, cup: !!o.cup };
  if (!o.cup) B.met[club] = WG.dayAbs;
  B.live = { world, snap: null };
  // (your own Shed mode, back when the match is settled or you leave: wShedModeBack)
  if (how !== 'sim' && WSHG.keepMode == null) WSHG.keepMode = W_SHED_MODE;
  const opts = { teams: [mine, opp], skill: wShedSkillOf(tier), ends: wShedEnds(), cold, hall: true, powers: true, hammer: Math.random() < .5 ? 0 : 1 };
  if (how === 'sim') { const seed = (Math.random() * 1e9) | 0, s = wShedDecide(wCR.simGame(Object.assign({ seed }, opts)), seed); wShedResultCard(wShedSettle(s)); return ''; }
  wShedGame(Object.assign({}, opts, { mode: how, title: `${mine.name} against ${opp.name}` }));
  WCR.world = true;
  // (kept from the first stone: a reload before it brings the match back, never calls it off: #120)
  B.live.snap = wCR.snapshot();
  wShedBarNote();
  wSave();
  return '';
}
function wResumeShed() {
  const L = wShedLive() && WG.shg.live; if (!L) return;
  if (!L.snap) { wShedCallOff('The match had not reached its first stone, so it is called off.'); return; }
  WCR = { over: null, world: true };
  // (the match's own mode while it is on, and yours back when you leave the Shed: wShedModeBack)
  if (WSHG.keepMode == null) WSHG.keepMode = W_SHED_MODE;
  W_SHED_MODE = L.snap.mode || W_SHED_MODE;
  wCR.resume(L.snap);
  // (a stone left sliding has come to rest on its release: kept and saved at once, so a second reload can't throw it again)
  if (L.snap.slide) { L.snap = wCR.snapshot(); wSave(); }
  $('wShedTitle').textContent = `${L.snap.G.teams[0].name} against ${L.snap.G.teams[1].name}`;
  showView('shed');
  wShedBarNote(); wShedRows(); wShedBoard();
}
function wShedLeaveGame() {
  const L = wShedLive() && WG.shg.live; if (!L) return wLeaveShed();
  // a stone sliding (or resting) counts: a game it decided is played out and settled, any other is kept after it
  if (wShedWorld() && (wCR.phase === 'slide' || wCR.phase === 'rest')) {
    let n = 0; while (wShedLive() && wCR.phase === 'slide' && n++ < 20000) wCR.tick(0.1);
    if (!wShedLive()) { WCR = null; wShedModeBack(); wW125LeaveShed(); wSave(); return; }
    if (wCR.G.over) { n = 0; while (wShedLive() && wCR.phase !== 'over' && n++ < 4000) wCR.tick(0.1); if (!wShedLive()) { WCR = null; wShedModeBack(); wW125LeaveShed(); wSave(); return; } }
    else L.snap = wCR.snapshot();
  }
  const sn = L.snap;
  WSHG.asked = true;
  WCR = null; wShedModeBack(); wW125LeaveShed();
  if (!sn) return wShedCallOff(`You leave before the first stone, so the match against ${wBallName(L.world.club)} is called off.`);
  wLog(`Your curling match against ${wBallName(L.world.club)} is saved: ${wShedScore(sn)}. Resume it from the Shed tab on the Team screen.`, 'd');
  wSave();
}
function wShedModeBack() { if (WSHG.keepMode != null) { W_SHED_MODE = WSHG.keepMode; WSHG.keepMode = null; } }
function wShedCallOff(why) {
  const B = wShg(), L = B.live; if (!L) return;
  B.live = null; if (!L.world.cup) delete B.met[L.world.club];
  wLog(why || `The curling match against ${wBallName(L.world.club)} is called off. No result.`, 'd');
  wSave();
}
function wShedConcede() {
  if (!wShedWorld()) return;
  wCR.pause(true);
  askConfirm('Concede this match?', 'It counts as a loss. A loss at the Shed costs nothing, but you only get a quarter of the XP.', 'Concede', () => {
    if (!wShedLive()) return;
    const s = wCR.summary() || {}; s.win = 1; s.text = 'conceded';
    wShedSettle(s);
    WCR = null; wShedModeBack(); wW125LeaveShed();
  }, () => { if (WCR) wCR.pause(false); });
  wAfterAsk(() => { if (WCR) wCR.pause(false); });
}
function wShedScore(sn) {
  const G = sn.G, t = s => G.sc[s].reduce((a, b) => a + (b || 0), 0), e = G.end;
  // (a match its last stone decided is finished: who won it)
  if (G.over) return `finished: ${G.teams[G.over.win].name} won${G.over.text ? `, ${G.over.text}` : ''}`;
  return `${t(0)} to ${t(1)}${e ? ` after ${e} end${e === 1 ? '' : 's'}` : ''}`;
}

/* ---------- kept between stones, and settled at the end ---------- */
const wW125OnPhase = wCR.onPhase;
wCR.onPhase = ph => {
  wW125OnPhase(ph);
  if (!wShedWorld() || !wCR.G) return;
  const settled = W_SHG.settled.includes(ph);
  if (!settled && (ph !== 'next' || wCR.G.over)) return;
  const L = WG.shg.live, first = !L.snap; L.snap = wCR.snapshot();
  // (a stone released, and come to rest, is saved at once, the deciding one too: a reload never brings a stone back. The
  // next beat is saved at most every W_SHG.saveMs: nothing new is settled in it, #120)
  const now = Date.now(); if (first || settled || now - WSHG.saved > W_SHG.saveMs) { WSHG.saved = now; wSave(); }
};
// a power cast before your stone is kept and saved at once (#120)
const wW125OnCommit = wCR.onCommit;
wCR.onCommit = () => {
  if (wW125OnCommit) wW125OnCommit();
  if (!wShedWorld() || !wCR.G) return;
  WG.shg.live.snap = wCR.snapshot(); WSHG.saved = Date.now(); wSave();
};
// a match kept after the stone that decided it, or with a stone left sliding (the page went as it slid): the stone comes
// to rest on its release first, and a match it decided is settled now, never left waiting; its result card waits for
// the world (wNextPrompt). One it didn't decide is kept with the stone at rest, waiting. Returns the result's words, or ''
function wShedKeptOver() { const L = wShedLive() && WG.shg.live; return !!(L && L.snap && L.snap.G && (L.snap.G.over || L.snap.slide)); }
function wShedKeptEnd() {
  if (WCR || !wShedKeptOver()) return '';
  const L = WG.shg.live;
  wCR.resume(L.snap);
  if (!wCR.G.over) { L.snap = wCR.snapshot(); wSave(); return ''; }
  const s = wCR.summary(); if (!s) return '';
  const msg = wShedSettle(s);
  WSHG.asked = true; if (!LAB) WSHG.card = msg;
  return msg;
}
const wW125OnOver = wCR.onOver;
wCR.onOver = s => {
  if (WCR && WCR.world && wShedLive()) { WCR.msg = wShedSettle(s); WCR.endMode = wCR.mode; wShedModeBack(); }
  wW125OnOver(s);
  wShedBarNote();
};
function wShedSettle(sum) {
  const B = wShg(), L = B.live, W = L.world, S0 = sum || {}, win = (S0.win != null ? S0.win : S0.over ? S0.over.win : -1) === 0;
  B.live = null;
  const r = win ? 'win' : 'lose', tot = S0.tot || [0, 0], us = tot[0], them = tot[1], text = S0.text || (S0.over && S0.over.text) || `${us} to ${them}`;
  if (win) { B.w++; fire('matchWon', { engine: 'shed' }); } else B.l++;
  const S = WG.crstats = WG.crstats || {}, line = {}, played = new Set(), pst = (S0.pst || [[]])[0] || [], ends = (S0.board && S0.board.sc && S0.board.sc[0]) ? S0.board.sc[0].filter(v => v > 0).length : 0;
  W.ids.forEach((id, ri) => {
    if (typeof id !== 'number' || !wPlayer(id)) return;
    played.add(id);
    const p = pst[ri] || { stones: 0, made: 0 }, T = S[id] = S[id] || { g: 0, stones: 0, made: 0, ends: 0 };
    T.g++; T.stones += p.stones || 0; T.made += p.made || 0; T.ends += ends;
    line[id] = { stones: p.stones || 0, made: p.made || 0 };
  });
  const mvp = wShedMvp(line);
  const base = Math.round(W_SHG.xp * W.tier * (win ? 1 : W_SHG.lossShare));
  for (const p of wRoster()) { const n = played.has(p.id) ? base + (win && mvp === p.id ? W_SHG.mvpXp : 0) : Math.round(base * W_SHG.benchShare); if (n > 0) wGiveXp(p, n); }
  const bits = `XP +${base} for everyone who curled${wRoster().some(p => !played.has(p.id)) ? `, +${Math.round(base * W_SHG.benchShare)} for those who didn't` : ''}`;
  let pay = '';
  if (win) { const g = W_SHG.gold * W.tier, f = W_SHG.fans * W.tier; RUN.gold += g; RUN.fans = (RUN.fans || 0) + f; pay = ` +${g} gold, +${f} fans.`; }
  if (CLUBS[W.club]) {
    const H = wH2h(), h = H[W.club] = H[W.club] || { w: 0, l: 0 };
    if (win) h.w++; else h.l++;
    h.last = { r, us, them, sport: 'curling', day: WG.dayAbs, text };
    try { if (wIsRival(W.club)) wLeagueMine(r); } catch (e) { console.error(e); }
  }
  const extra = S0.extra ? 'xe' : '';
  B.games.unshift({ day: WG.dayAbs, club: W.club, name: W.name, tier: W.tier, how: W.how, r, us, them, text, end: extra, cold: W.cold, mvp, line });
  B.games.length = Math.min(B.games.length, W_SHG.keep);
  WG.lastMatch = { kind: W.kind, result: r, day: WG.dayAbs, tier: W.tier };
  W.us = us; W.them = them; W.text = text;
  const f = W_ON_END[W.kind]; if (f) { try { f(r, W.ref, W); } catch (e) { console.error(e); } }
  wAdvance(W_SHG.minutes);
  const who = mvp != null && wPlayer(mvp), how = text === 'conceded' ? ', conceded' : text ? `, ${text}` : '';
  const msg = `Final: ${win ? 'you win' : 'you lose'}${how}${extra ? ' (an extra end)' : ''} against ${wBallName(W.club)}.${pay} ${bits}${win && who ? `, and +${W_SHG.mvpXp} for ${who.n}, player of the match` : ''}.`;
  wLog(msg, win ? 'g' : 'b');
  wSave();
  return msg;
}
// a game the engine stopped before it was decided (it never should): the side ahead wins it; level, it is settled as an
// extra end would be, one more point for the side it falls to (by the game's seed, when it had one: the same game
// settles the same way), and that end goes on the board. s: a summary, changed in place
function wShedDecide(s, seed) {
  if (!s || s.win === 0 || s.win === 1) return s;
  const t = (s.tot || [0, 0]).slice(), k = t[0] === t[1] ? (seed != null ? Math.abs(seed | 0) % 2 : Math.random() < .5 ? 0 : 1) : t[0] > t[1] ? 0 : 1;
  if (t[0] === t[1]) { t[k]++; s.extra = (s.extra || 0) + 1; if (s.board && s.board.sc) { s.board.sc[k].push(1); s.board.sc[1 - k].push(0); } }
  s.tot = t; s.win = k; s.text = `${Math.max(t[0], t[1])} to ${Math.min(t[0], t[1])}${s.extra ? ' after an extra end' : ''}`;
  return s;
}
// player of the match: the shots made count most, then the share made
function wShedMvp(lines) {
  let best = null, bs = -1;
  for (const id in lines) { const s = lines[id], v = s.made * 2 + (s.stones ? s.made / s.stones : 0); if (v > bs) { bs = v; best = +id; } }
  return best;
}
W_ON_END.shgame = function () { };
function wShedResultCard(msg) {
  if (LAB) return;
  const close = modal(`<header><h3>Final</h3></header><div class="wmsg"><p>${esc(msg)}</p></div><div class="row"><button class="btn" id="wShedOk">Done</button></div>`, () => wDrain());
  $('wShedOk').focus(); $('wShedOk').onclick = () => close();
}

/* ---------- the bar in a real match, and Manage's row ---------- */
$('wShedBack').insertAdjacentHTML('beforebegin', '<button class="ghost" id="wShedSave" hidden>Save and leave</button><button class="ghost" id="wShedGive" hidden>Concede</button>');
$('wShedSave').onclick = () => wShedLeaveGame();
$('wShedGive').onclick = () => wShedConcede();
const wW125ShedBarNote = wShedBarNote;
wShedBarNote = function () {
  wW125ShedBarNote();
  const real = !!(WCR && WCR.world), live = real && wShedLive();
  $('wShedSave').hidden = $('wShedGive').hidden = !live;
  $('wShedAgain').hidden = real; $('wShedBack').hidden = live; $('wShedEnds').parentElement.hidden = real; $('wShedSkill').parentElement.hidden = real;
  if (real && !live && WCR.msg) $('wShedNote').textContent = WCR.msg;
  // (a settled match still shows the mode it was played in; your own is back for the next game)
  if (real && WCR.over && WCR.endMode) for (const b of $('wShedModes').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.cmode === WCR.endMode); b.setAttribute('aria-pressed', b.dataset.cmode === WCR.endMode); }
};
const wW125LeaveShed = wLeaveShed;
wLeaveShed = function () { if (wShedWorld()) return wShedLeaveGame(); wShedModeBack(); wW125LeaveShed(); if (WG) { wSave(); wDrain(); } };
// every game at the Shed has its ways, on the day's cold
const wW125ShedGame = wShedGame;
wShedGame = function (opts) { const o = Object.assign({ hall: true }, opts || {}); if (!o.cold) o.cold = wShedColdNow(); return wW125ShedGame(o); };
$('wShedRows').insertAdjacentHTML('afterend', '<div id="wShedMgrRow" class="wccalls" hidden><div class="wccrow"><span class="wccl">Your call</span><span id="wShedMgr"></span></div></div>');
$('wShedMgrRow').addEventListener('click', e => { const b = e.target.closest('[data-cstyle]'); if (!b) return; wCR.manage({ style: b.dataset.cstyle }); wShedRows(); });
const wW125ShedRows = wShedRows;
wShedRows = function () {
  wW125ShedRows();
  const V = WCR && !WCR.over && wCR.G && wCR.G.teams ? wCR.view : null, mgr = !!V && V.mode === 'manage';
  $('wShedMgrRow').hidden = !mgr; if (!mgr) return;
  const M = wCR.mgr || { style: 'auto' };
  $('wShedMgr').innerHTML = [['auto', 'Auto', 'Your captain reads the house and the score'], ['draw', 'The draw game', 'Guards and draws: keep stones in play, and come round'], ['hit', 'The hitting game', 'Takeouts and peels: keep the house clean']]
    .map(([k, n, t]) => `<button class="ghost${M.style === k ? ' on' : ''}" data-cstyle="${k}" title="${esc(t)}">${n}</button>`).join(' ') + ' <small class="hint">Your four throw on their ratings, and their sweepers sweep.</small>';
};

/* ---------- picking a match ---------- */
function wShedH2h(club) { const L = ((WG.h2h || {})[club] || {}).last; return L && L.sport === 'curling' ? L : null; }
function wOpenShedCard() {
  const probs = wShedProblems(), B = wShg(), live = wShedLive(), cold = wShedColdNow();
  const rows = wBallClubs().map(c => {
    const T = wBallTeam(c), tier = wBallTier(c), met = B.met[c] === WG.dayAbs, last = wShedH2h(c);
    const btns = Object.keys(W_SHG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-shclub="${c}" data-shhow="${how}" ${probs.length || met || live ? 'disabled' : ''}>${W_SHG_HOW[how]}</button>`).join('');
    return `<li class="wbcl"><span class="wbsw" style="background:${T.color}"></span><div><b>${esc(T.name)}</b>
      <small>Tier ${tier}: their curlers are level ${wBallOppLvl(tier)}, and their skip plays like a ${W_BALL_SKILL[wShedSkillOf(tier)[1]]}.${last ? ` Last curling match: ${last.r === 'win' ? 'won' : 'lost'}${last.text ? ' ' + esc(last.text) : ''}.` : ''}${met ? ' <b>Curled you today.</b>' : ''}</small></div>
      <div class="row">${btns}</div></li>`;
  }).join('');
  const close = modal(`<header><h3>Curl a match</h3><button class="ghost" data-close>Done</button></header>
    ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}${WSHG.msg ? `<p class="wbad">${esc(WSHG.msg)}</p>` : ''}
    ${live ? `<p class="wbad">You have a curling match waiting. <button class="btn" id="wShResume">Resume it</button></p>` : ''}
    <p class="hint">A match at the Curling Shed with your four: ${wShedEnds()} ends (Settings has the length). <b>Play</b>: you throw every stone of yours, and sweep it. <b>Manage</b>: you set your rink's game, the draw game or the hitting game, or leave it to your captain; your four throw. <b>Simulate</b>: the result now. A win pays ${W_SHG.xp} XP to everyone who curled, ${W_SHG.gold} gold and ${W_SHG.fans} fans, times the tier; a loss pays a quarter of the XP and costs nothing else. Nobody goes home level: an extra end. Each club curls you once a day, and a match takes a couple of hours.</p>
    <p class="hint"><b>The ice today:</b> ${cold === 'heavy' ? 'heavy (a warm day off the sea: frost on the pebble, the stones drag)' : cold === 'keen' ? 'keen (a hard frost last night: the stones run)' : 'as Hennock likes it'}. The frost creeps in from the windows as a game goes on.</p>
    <ul class="wbclubs">${rows}</ul>
    <p class="hint">Or watch a game: <button class="ghost" id="wShExhib">Saltmere against Rimewatch</button></p>`);
  WSHG.msg = '';
  $('modalBox').querySelectorAll('[data-shclub]').forEach(b => b.onclick = () => {
    close();
    const r = wStartShed({ club: b.dataset.shclub, how: b.dataset.shhow });
    if (r) { WSHG.msg = r; wOpenShedCard(); }
  });
  const ex = $('wShExhib'); if (ex) ex.onclick = () => { close(); wShedGame(); };
  const rs = $('wShResume'); if (rs) rs.onclick = () => { close(); wResumeShed(); };
}
(() => {
  const K = DB.chars.gk_shed; if (!K) return;
  K.topics.job.t += ' Bring your four for a MATCH and I will find you a club to curl for real.';
  K.topics.match = { t: 'Real curling, your four against a club at your tier. Mind the frost along the boards late on, and if a stone creeps on its own, that is the sprites. They mean no harm. Mostly.', act: 'shcard' };
})();
const wW125RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'shcard') return wOpenShedCard(); return wW125RunAct.apply(this, arguments); };

const wW125NextPrompt = wNextPrompt;
wNextPrompt = function () {
  // (a decided match is settled, not waiting: its result card, settled here if the page came back somewhere else first)
  if (!LAB && !WCR && !WD && !WG.cardOffer && !WG.event && wActive()) {
    if (!WKEPT.loading && wShedKeptOver()) wKeptOne(wShedKeptEnd);
    if (WSHG.card) { const m = WSHG.card; WSHG.card = ''; wShedResultCard(m); if (!$('modal').hidden) return true; }
  }
  if (!LAB && wShedLive() && !WSHG.asked && !wShedKeptOver() && !WCR && !WD && !WG.cardOffer && !WG.event && wActive()) {
    WSHG.asked = true;
    const L = WG.shg.live, sn = L.snap;
    const close = modal(`<header><h3>A curling match is waiting</h3></header><div class="wmsg"><p>Your match against ${esc(wBallName(L.world.club))} is where you left it${sn ? `: ${esc(wShedScore(sn))}` : ''}.</p><p class="hint">You can also pick it up later from the Shed tab on the Team screen.</p></div>
      <div class="row"><button class="btn" id="wShRes">Resume</button><button class="ghost" id="wShLater">Later</button></div>`, () => wDrain());
    $('wShRes').focus();
    $('wShRes').onclick = () => { close(); wResumeShed(); };
    $('wShLater').onclick = () => close();
    return true;
  }
  return wW125NextPrompt();
};

/* ---------- the Shed tab: Curl a match, Resume, and the last matches ---------- */
const wW125CampShed = wCampShed;
wCampShed = function (C) {
  const html = wW125CampShed(C), probs = wShedProblems(), live = wShedLive();
  const play = live ? `<button class="btn" data-shresume>Resume the match</button>` : `<button class="btn" data-shplay ${probs.length ? 'disabled' : ''}>Curl a match</button>`;
  const gate = !live && probs.length ? `<p class="hint wball">${esc(probs[0])}</p>` : '';
  return html.replace('<button class="btn" data-cpractice', `${play}<button class="ghost" data-cpractice`).replace(/<\/div>\s*$/, `</div>${gate}${wShedRecent()}`);
};
function wShedRecent() {
  const B = WG.shg; if (!B || !B.games.length) return '';
  return `<h5 class="wbrh">Last curling matches: ${B.w}&ndash;${B.l}</h5><ol class="wstlog">${B.games.slice(0, 5).map(g => `<li><b class="${g.r === 'win' ? 'wgood' : 'wbad'}">${g.r === 'win' ? 'Won' : 'Lost'}</b>${g.text ? ' ' + esc(g.text) : ''} against ${esc(g.name)}${g.end === 'xe' ? ' (an extra end)' : ''}<small>day ${g.day}${g.mvp != null && wPlayer(g.mvp) ? `, player of the match ${esc(wPlayer(g.mvp).n)}` : ''}</small></li>`).join('')}</ol>`;
}
const wW125RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW125RenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'shed') return;
  const p = body.querySelector('[data-shplay]'); if (p) p.onclick = () => { WCAMP.close(); wOpenShedCard(); };
  const r = body.querySelector('[data-shresume]'); if (r) r.onclick = () => { WCAMP.close(); wResumeShed(); };
};

/* ---------- lines ---------- */
function wShedLine(pid) { return (WG.crstats || {})[pid] || null; }
const W_CR_LCOLS = [['g', 'G', 'Curling matches'], ['stones', 'St', 'Stones thrown'], ['made', 'Made', 'Shots made'], ['ends', 'Ends', 'Ends scored in']];
const wW125CampStats = wCampStats;
wCampStats = function () {
  const html = wW125CampStats();
  if (WSTAT.view !== 'curling') return html;
  const head = W_CR_LCOLS.map(([c, s, l]) => `<th scope="col" title="${esc(l)}">${s}</th>`).join('');
  return html.replace(/(<thead><tr>[\s\S]*?)(<\/tr><\/thead>)/, `$1${head}$2`)
    .replace(/(<tr data-wsp="(\d+)"[^>]*>[\s\S]*?)(<\/tr>)/g, (m, a, id, end) => { const L = wShedLine(+id); return a + W_CR_LCOLS.map(([c]) => `<td>${L ? L[c] || 0 : '<span class="dim">&ndash;</span>'}</td>`).join('') + end; })
    .replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Every player\'s curling ratings, their position in your four (set on the Shed tab), and every curling match they curled from the world on this journey (exhibitions and practice are not counted). Pick a heading to sort, a player to see more.</small>');
};
const wW125StatsCard = wStatsCard;
wStatsCard = function (p) {
  const L = wShedLine(p.id), html = wW125StatsCard(p);
  if (!L || !L.g) return html;
  const bits = `${L.g} curling match${L.g === 1 ? '' : 'es'}: ${L.stones} stone${L.stones === 1 ? '' : 's'}, ${L.made} made${L.stones ? ` (${Math.round(100 * L.made / L.stones)}%)` : ''}`;
  return html.replace('<div class="wbd wbkc wcrc"><h5>Curling</h5>', `<div class="wbd wbkc wcrc"><h5>Curling</h5><p class="wbdbox">${bits}.</p>`);
};

const wW125ShedHow = wShedHowHTML;
wShedHowHTML = function () {
  return wW125ShedHow() + `<p class="hint"><b>Matches.</b> Ask Brush Hennock for a MATCH, or use the Shed tab: your four against a club at your tier, once a day each. <b>Manage</b> lets your captain throw by your call (the draw game, the hitting game, or Auto); <b>Simulate</b> gives the result at once. Save and leave keeps the match between stones.</p>
  <p class="hint"><b>The Shed.</b> The day's cold sets the ice: heavy on a warm day off the sea, keen after a hard frost. The frost creeps in from the windows as a game goes on, and the ice along the boards plays heavy late. Now and then a frost sprite breathes on a stone and it creeps an inch or two. At the half Hennock pebbles the sheet again, and the worn ice is half fresh.</p>`;
};
const wW125RenderHelp = renderHelp;
renderHelp = function () {
  wW125RenderHelp();
  const after = $('wHelpShedTab'); if (!after || $('wHelpShedGame')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpShedGame"><b>Curling matches.</b> Brush Hennock's MATCH, or Curl a match on the Shed tab: your four against a club at your tier, once a day each, in Play, Manage or Simulate. A win pays XP, gold and fans by the tier; a loss pays a quarter of the XP and costs nothing else. Save and leave keeps the match for later.</p>`);
};
