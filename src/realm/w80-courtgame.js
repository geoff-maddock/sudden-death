/* w80: basketball from the world (issue #77, phase 5). Your five plays a rival club, or the local side, at the Charter
   Court, as football is played (w44): Play (you play your five by hand, and call it), Manage (you call it, your five
   play) or Simulate (the result at once). Nim Hoopwright's HOOPS and the Court tab open the game card: the clubs at
   your tier, each once a day, and the scrimmage as before. A game needs W_BKG.minOwn players of your own; call-ups
   fill the five. Every game at the Charter Court has the ground's own touches (13-court.js): the waxed boards, the bent
   rim, the walled yard's roar.
   Their squad: their five at your level plus the tier, with W_BKG.oppBonus points spread over each, and a bench of
   W_BKG.bench a level lower; a rival keeps the same squad until it would be a different level.
   The result: a win pays XP to everyone who played (half to the rest of the team), gold and fans by tier, and the player
   of the game a little more; a loss a quarter of the XP and costs nothing else (no Team HP on the court); a tie (still
   level after three overtimes) half. Every game adds your players' box lines to WG.bkstats, and goes in the head to
   head and the league table. Save and leave keeps the game at its last stoppage (pressed in live play, you leave at
   the next one, so the play counts), and it is waiting when you come back, after a reload too. Concede counts as a
   loss.

   WG.bkg     { live: null | { world, snap }, met: { club: dayAbs }, opp: { club: { lvl, team } }, games: [last W_BKG.keep], w, l, t }
              world = { kind: 'bkgame', ref, club, tier, how, day, name, ids, cup }, plain data; the end dispatches
              W_ON_END[kind] (which also gets us, them and reb: [yours, theirs] rebounds). ids: your squad's roster
              ids at tip-off (the five, then the bench; null for a call-up)
   WG.bkstats { pid: { gg, sec, pts, reb, ast, stl, blk, fgm, fga, tpm, tpa, ftm, fta, pf, tov } }, this journey
   wCourtProblems(), wStartCourt({ club, how, tier?, kind?, ref?, cup? }), wResumeCourt(), wCourtLeaveGame(),
   wCourtConcede(), wOpenCourtCard()
   Wraps: wCourtBarNote (wW80CourtBarNote: Save and leave and Concede in a real game), wLeaveCourt (wW80LeaveCourt),
   wBK.onOver (the end settles a real game), wRunAct (wW80RunAct: HOOPS opens the card), wNextPrompt (wW80NextPrompt: a
   game waiting after a reload), wCampCourt and wRenderCamp (wW80CampCourt, wW80RenderCamp: Play a game and Resume on
   the Court tab), wCampStats (wW80CampStats: the Basketball view's box lines), wStatsCard (wW80StatsCard: the box lines
   in words), renderHelp (wW80RenderHelp: #wHelpCourtGame). */

const W_BKG = {
  minOwn: 3, xp: 12, gold: 15, fans: 3, lossShare: .25, tieShare: .5, benchShare: .5, mvpXp: 5,
  // extra rating points for each of their five, by tier, spread over the six (6 is +1 to every one); measured in phase 10
  oppBonus: { 1: 0, 2: 1, 3: 3 },
  minutes: 90, keep: 10, saveMs: 12000, bench: 2,
};
const W_BKG_HOW = { play: 'Play', manage: 'Manage', sim: 'Simulate' };
const WBKG = { saved: 0, asked: false, msg: '', leaving: false };
const W_BK_LINE = ['sec', 'pts', 'reb', 'oreb', 'ast', 'stl', 'blk', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'pf', 'tov'];

function wBkg() {
  const B = WG.bkg = WG.bkg || { live: null, met: {}, opp: {}, games: [], w: 0, l: 0, t: 0 };
  B.met = B.met || {}; B.opp = B.opp || {}; B.games = B.games || [];
  return B;
}
function wCourtLive() { return !!(WG && WG.bkg && WG.bkg.live); }
// a real game is on the court (not a scrimmage or a practice)
function wCourtWorld() { return !!(WBK && WBK.world && wCourtLive()); }
function wCourtProblems() {
  const n = wRoster().length;
  return n < W_BKG.minOwn ? [`Recruit ${W_BKG.minOwn - n} more player${W_BKG.minOwn - n === 1 ? '' : 's'}: a basketball game needs ${W_BKG.minOwn} of your own, and call-ups fill the rest of the five.`] : [];
}
// how well each side's CPU coaches: yours (Watch, and Simulate) as a Knight, theirs by tier, as on the diamond
const wCourtSkill = tier => [1, W_BALL.diff[tier] != null ? W_BALL.diff[tier] : 1];
const wCourtResult = sc => sc[0] > sc[1] ? 'win' : sc[0] < sc[1] ? 'lose' : 'tie';

/* a club's squad: its five, its own kinds first, at your level plus the tier with the bonus; then its bench a level
   lower. A rival keeps the same squad (the same names and ratings) until it would be a different level. */
function wCourtOpp(club, tier) {
  const B = wBkg(), lvl = wBallOppLvl(tier), C = club === 'apex' ? Object.assign({}, W_CUP.apexTeam) : wBallTeam(club), k = W_BKG.oppBonus[tier] || 0;
  const cached = club !== 'local' && B.opp[club];
  let team;
  if (cached && cached.lvl === lvl) team = JSON.parse(JSON.stringify(cached.team));
  else {
    const rg = wBallRegion(club), own = rg ? (DB.regions[rg] || {}).kinds || [] : (C.roster || []).map(r => r[1]);
    const all = own.filter(x => wBK.kinds.includes(x)).concat(W_BKR.cuKinds).filter((x, i, a) => a.indexOf(x) === i);
    const kinds = all.slice(0, 5).concat(Array.from({ length: W_BKG.bench }, (_, i) => all[(5 + i) % all.length]));
    const names = new Set(), mk = (kind, i) => {
      const rn = (C.roster || []).find(r => r[1] === kind), free = (FA_NAMES[kind] || []).filter(n => !names.has(n));
      const p = wMakePlayer({ kind, lvl: i < 5 ? lvl : Math.max(1, lvl - 1), n: rn && !names.has(rn[0]) ? rn[0] : free.length ? pick(free) : undefined, num: rn ? rn[2] : undefined }, 'opp');
      names.add(p.n);
      return wCourtPlayer(p);
    };
    team = { name: C.name, short: C.short, color: C.color, light: C.light, roster: kinds.map(mk) };
    if (club !== 'local') B.opp[club] = { lvl, team: JSON.parse(JSON.stringify(team)) };
  }
  // the bonus on the five, in a fixed order over the six, so a rival plays the same each time
  if (k) team.roster.slice(0, 5).forEach((p, j) => { const st = wBK.stats; for (let i = 0; i < k; i++) { const s = st[(i * 5 + j) % st.length]; p.r[s] = Math.min(W_BKR.cap, p.r[s] + 1); } });
  return team;
}
// your squad for a game: the five and your bench (call-ups fill the five), named apart from theirs; ids: roster ids
function wCourtSquad(vs) {
  const C = wCourtSync(), team = wCourtMine(), keys = wCourtKeys(C);
  const ids = keys.map(k => typeof k === 'number' ? k : null), theirs = new Set(vs ? vs.roster.map(p => p.n) : []);
  // (a call-up who shares a name with one of theirs takes a number after it)
  team.roster.forEach((p, i) => { if (ids[i] == null && theirs.has(p.n)) p.n += ' II'; });
  return { team, ids };
}

/* ---------- starting, leaving, coming back ---------- */
function wStartCourt(o) {
  if (!WG || !RUN) return '';
  const probs = wCourtProblems(); if (probs.length) return probs.join(' ');
  const B = wBkg(), club = o.club;
  if (B.live) return 'Finish the basketball game you started first.';
  if (!wBallRegion(club) && !CLUBS[club] && club !== 'apex') return '';
  if (!o.cup && B.met[club] === WG.dayAbs) return `${wCap(wBallName(club))} have already played you at basketball today. Come back tomorrow.`;
  const how = W_BKG_HOW[o.how] ? o.how : 'play', tier = o.tier || wBallTier(club);
  const opp = wCourtOpp(club, tier), sq = wCourtSquad(opp), mine = sq.team;
  const world = { kind: o.kind || 'bkgame', ref: o.ref || null, club, tier, how, day: WG.dayAbs, name: opp.name, ids: sq.ids, cup: !!o.cup };
  if (!o.cup) B.met[club] = WG.dayAbs;
  B.live = { world, snap: null };
  const opts = { teams: [mine, opp], skill: wCourtSkill(tier), mins: wCourtMins(), court: true, ordered: [true, false] };
  if (how === 'sim') {
    const s = wBK.simGame(opts);
    wCourtResultCard(wCourtSettle(wCourtResult(s.score), s.score[0], s.score[1], s.box, s.ot));
    return '';
  }
  wCourtGame(Object.assign({}, opts, { mode: how === 'play' ? 'play' : 'manage', how: 'world', title: `${mine.name} against ${opp.name}` }));
  WBK.world = true;
  wCourtBarNote();
  wSave();
  return '';
}
function wResumeCourt() {
  const L = wCourtLive() && WG.bkg.live;
  if (!L) return;
  if (!L.snap) { wCourtCallOff('The game had not reached its first stoppage, so it is called off.'); return; }
  WBK = { over: null, how: 'world', world: true }; wCourtTick(true);
  wBK.resume(L.snap);
  $('wCourtTitle').textContent = `${L.snap.G.teams[0].name} against ${L.snap.G.teams[1].name}`;
  showView('court');
  wCourtBarNote(); wCourtBox();
}
// Save and leave: the game stays at its last stoppage. Pressed in live play, you leave at the next stoppage
function wCourtLeaveGame() {
  const L = wCourtLive() && WG.bkg.live; if (!L) return wLeaveCourt();
  const ph = wBK.phase;
  if (wCourtWorld() && L.snap && ph && !['dead', 'break', 'ft', 'over', 'timeout'].includes(ph)) { WBKG.leaving = true; wCourtBarNote(); return; }
  WBKG.leaving = false;
  // (at a stoppage, the game as it is now: subs and calls made in it, a free throw already taken, a timeout called)
  if (L.snap && ['dead', 'break', 'ft', 'timeout'].includes(ph)) L.snap = wBK.snapshot();
  const sn = L.snap;
  WBKG.asked = true;
  WBK = null; wW80LeaveCourt();
  if (!sn) return wCourtCallOff(`You leave before the first stoppage, so the game against ${wBallName(L.world.club)} is called off.`);
  wLog(`Your basketball game against ${wBallName(L.world.club)} is saved: ${wCourtScore(sn)}. Resume it from the Court tab on the Team screen.`, 'd');
  wSave();
}
function wCourtCallOff(why) {
  const B = wBkg(), L = B.live; if (!L) return;
  B.live = null; if (!L.world.cup) delete B.met[L.world.club];
  wLog(why || `The basketball game against ${wBallName(L.world.club)} is called off. No result.`, 'd');
  wSave();
}
function wCourtConcede() {
  if (!wCourtWorld()) return;
  wBK.pause(true);
  askConfirm('Concede this game?', 'It counts as a loss. A loss on the court costs nothing, but you only get a quarter of the XP.', 'Concede', () => {
    if (!wCourtLive()) return;
    const G = wBK.G, sc = G ? G.score : [0, 0];
    wCourtSettle('lose', sc[0], sc[1], wBK.box(), G && G.q > 4 ? G.q - 4 : 0);
    WBK = null; wW80LeaveCourt();
  }, () => { if (WBK) wBK.pause(false); });
  // (closed any way at all: carry on, if the game is still on)
  wAfterAsk(() => { if (WBK) wBK.pause(false); });
}
function wCourtScore(sn) { const G = sn.G, t = Math.max(0, G.clock), c = t < 10 ? t.toFixed(1) : `${Math.floor(Math.ceil(t) / 60)}:${String(Math.ceil(t) % 60).padStart(2, '0')}`; return `${G.teams[0].short || G.teams[0].name} ${G.score[0]}, ${G.teams[1].short || G.teams[1].name} ${G.score[1]}, ${wBK.periodName(G.q)} ${c}`; }
wBK.wantSnap = () => wCourtWorld();
wBK.onSnap = sn => {
  const L = wCourtWorld() && WG.bkg.live; if (!L) return;
  const first = !L.snap; L.snap = sn;
  if (WBKG.leaving) { WBKG.leaving = false; setTimeout(() => { if (wCourtWorld()) wCourtLeaveGame(); }, 0); return; }
  // (saved at most every W_BKG.saveMs, so a reload can come back a few stoppages early; the first one always)
  const now = Date.now(); if (first || now - WBKG.saved > W_BKG.saveMs) { WBKG.saved = now; wSave(); }
};
// the end of a game on the court: a scrimmage or a practice as before; a real game settles in the world
const wW80OnOver = wBK.onOver;
wBK.onOver = s => {
  if (WBK && WBK.world && wCourtLive()) WBK.msg = wCourtSettle(wCourtResult(s.score), s.score[0], s.score[1], s.box, s.ot);
  wW80OnOver(s);
  wCourtBarNote();
};

/* ---------- the final ---------- */
function wCourtSettle(r, us, them, box, ot) {
  const B = wBkg(), L = B.live, W = L.world, win = r === 'win', tie = r === 'tie';
  B.live = null;
  if (win) { B.w++; fire('matchWon', { engine: 'court' }); } else if (tie) B.t++; else B.l++;
  // box lines for your own players (call-ups have no roster id), and who played
  const S = WG.bkstats = WG.bkstats || {}, line = {}, played = new Set();
  for (const row of (box && box[0] ? box[0].rows : [])) {
    const id = W.ids[row.ri]; if (typeof id !== 'number' || !wPlayer(id) || !(row.sec > 0)) continue;
    played.add(id);
    const T = S[id] = S[id] || { gg: 0 };
    T.gg++; line[id] = {};
    for (const k of W_BK_LINE) { T[k] = (T[k] || 0) + (row[k] || 0); line[id][k] = row[k] || 0; }
  }
  const mvp = wCourtMvp(line);
  const base = Math.round(W_BKG.xp * W.tier * (win ? 1 : tie ? W_BKG.tieShare : W_BKG.lossShare));
  for (const p of wRoster()) { const n = played.has(p.id) ? base + (win && mvp === p.id ? W_BKG.mvpXp : 0) : Math.round(base * W_BKG.benchShare); if (n > 0) wGiveXp(p, n); }
  const bits = `XP +${base} for everyone who played${wRoster().some(p => !played.has(p.id)) ? `, +${Math.round(base * W_BKG.benchShare)} for those who didn't` : ''}`;
  let pay = '';
  if (win) { const g = W_BKG.gold * W.tier, f = W_BKG.fans * W.tier; RUN.gold += g; RUN.fans = (RUN.fans || 0) + f; pay = ` +${g} gold, +${f} fans.`; }
  if (CLUBS[W.club]) {
    const H = wH2h(), h = H[W.club] = H[W.club] || { w: 0, l: 0 };
    if (win) h.w++; else if (!tie) h.l++;
    h.last = { r, us, them, sport: 'basketball', day: WG.dayAbs };
    try { if (!tie && wIsRival(W.club)) wLeagueMine(r); } catch (e) { console.error(e); }
  }
  B.games.unshift({ day: WG.dayAbs, club: W.club, name: W.name, tier: W.tier, how: W.how, r, us, them, ot: ot || 0, mvp, line });
  B.games.length = Math.min(B.games.length, W_BKG.keep);
  WG.lastMatch = { kind: W.kind, result: r, day: WG.dayAbs, tier: W.tier };
  W.us = us; W.them = them; W.reb = box && box[0] && box[1] ? [box[0].tot.reb, box[1].tot.reb] : [0, 0];
  const f = W_ON_END[W.kind]; if (f) { try { f(r, W.ref, W); } catch (e) { console.error(e); } }
  wAdvance(W_BKG.minutes);
  const who = mvp != null && wPlayer(mvp);
  const msg = `Final: ${win ? 'you win' : tie ? 'a tie' : 'you lose'} ${us}–${them} against ${wBallName(W.club)}${ot ? `, in ${ot > 1 ? `${ot} overtimes` : 'overtime'}` : ''}.${pay} ${bits}${win && who ? `, and +${W_BKG.mvpXp} for ${who.n}, player of the game` : ''}.`;
  wLog(msg, win ? 'g' : 'b');
  wSave();
  return msg;
}
// player of the game: the best line among your own players (points, and a share for the rest of the game)
function wCourtMvp(lines) {
  let best = null, bs = 0;
  for (const id in lines) { const s = lines[id], v = s.pts + s.reb * .6 + s.ast * .8 + s.stl * 1.2 + s.blk * 1.2 - s.tov * .8; if (v > bs) { bs = v; best = +id; } }
  return best;
}
W_ON_END.bkgame = function () { }; // the log line and the rewards are paid in wCourtSettle; kinds built on it add theirs
function wCourtResultCard(msg) {
  if (LAB) return;
  const close = modal(`<header><h3>Final</h3></header><div class="wmsg"><p>${esc(msg)}</p></div><div class="row"><button class="btn" id="wCourtOk">Done</button></div>`, () => wDrain());
  $('wCourtOk').focus(); $('wCourtOk').onclick = () => close();
}

/* ---------- the bar in a real game ---------- */
$('wCourtBack').insertAdjacentHTML('beforebegin', '<button class="ghost" id="wCourtSave" hidden>Save and leave</button><button class="ghost" id="wCourtGive" hidden>Concede</button>');
$('wCourtSave').onclick = () => wCourtLeaveGame();
$('wCourtGive').onclick = () => wCourtConcede();
const wW80CourtBarNote = wCourtBarNote;
wCourtBarNote = function () {
  wW80CourtBarNote();
  const real = !!(WBK && WBK.world), live = real && wCourtLive();
  $('wCourtSave').hidden = $('wCourtGive').hidden = !live;
  if (!live) WBKG.leaving = false;
  $('wCourtSave').disabled = live && WBKG.leaving; $('wCourtSave').textContent = live && WBKG.leaving ? 'Leaving at the next stoppage…' : 'Save and leave';
  $('wCourtAgain').hidden = real; $('wCourtBack').hidden = live; $('wCourtMins').parentElement.hidden = real;
  $('wCourtSkill').parentElement.hidden = real;
  if (real && !live && WBK.msg) $('wCourtNote').textContent = WBK.msg;
};
// Back to the world (or the title) from a real game still on: Save and leave
const wW80LeaveCourt = wLeaveCourt;
wLeaveCourt = function () { if (wCourtWorld()) return wCourtLeaveGame(); wW80LeaveCourt(); if (WG) { wSave(); wDrain(); } };

/* ---------- picking a game ---------- */
function wCourtH2h(club) { const L = ((WG.h2h || {})[club] || {}).last; return L && L.sport === 'basketball' ? L : null; }
function wOpenCourtCard() {
  const probs = wCourtProblems(), B = wBkg(), live = wCourtLive();
  const rows = wBallClubs().map(c => {
    const T = wBallTeam(c), tier = wBallTier(c), met = B.met[c] === WG.dayAbs, last = wCourtH2h(c);
    const btns = Object.keys(W_BKG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-bkclub="${c}" data-bkhow="${how}" ${probs.length || met || live ? 'disabled' : ''}>${W_BKG_HOW[how]}</button>`).join('');
    return `<li class="wbcl"><span class="wbsw" style="background:${T.color}"></span><div><b>${esc(T.name)}</b>
      <small>Tier ${tier}: their players are level ${wBallOppLvl(tier)}, the coach a ${W_BALL_SKILL[wCourtSkill(tier)[1]]}.${last ? ` Last basketball game: ${last.r === 'win' ? 'won' : last.r === 'tie' ? 'tied' : 'lost'} ${last.us}–${last.them}.` : ''}${met ? ' <b>Played you today.</b>' : ''}</small></div>
      <div class="row">${btns}</div></li>`;
  }).join('');
  const close = modal(`<header><h3>Play a basketball game</h3><button class="ghost" data-close>Done</button></header>
    ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}${WBKG.msg ? `<p class="wbad">${esc(WBKG.msg)}</p>` : ''}
    ${live ? `<p class="wbad">You have a basketball game waiting. <button class="btn" id="wBkResume">Resume it</button></p>` : ''}
    <p class="hint">A game at the Charter Court with your five and your bench: four quarters, ${wCourtMins()} minutes in all (Settings has the length). <b>Play</b>: you play your five by hand, and call it. <b>Manage</b>: you call the sets, the defense, timeouts and subs, and your five play. <b>Simulate</b>: the result now. A win pays ${W_BKG.xp} XP to everyone who played, ${W_BKG.gold} gold and ${W_BKG.fans} fans, times the tier; a loss pays a quarter of the XP and costs nothing else, and a tie half. Each club plays you once a day, and a game takes an hour and a half or so.</p>
    <ul class="wbclubs">${rows}</ul>
    <p class="hint">Or watch a scrimmage: <button class="ghost" id="wBkExhib">Graftonbury against Saltmere</button></p>`);
  WBKG.msg = '';
  $('modalBox').querySelectorAll('[data-bkclub]').forEach(b => b.onclick = () => {
    close();
    const r = wStartCourt({ club: b.dataset.bkclub, how: b.dataset.bkhow });
    if (r) { WBKG.msg = r; wOpenCourtCard(); }
  });
  const ex = $('wBkExhib'); if (ex) ex.onclick = () => { close(); wCourtGame(); };
  const rs = $('wBkResume'); if (rs) rs.onclick = () => { close(); wResumeCourt(); };
}
// Nim Hoopwright's HOOPS opens the card (SCRIMMAGE stays the exhibition; GAME the card-game match)
(() => {
  const K = DB.chars.gk_court; if (!K) return;
  K.topics.job.t += ' Bring your five for HOOPS and I will match you with a club for real.';
  K.topics.hoops = { t: 'Real basketball on these boards, your five against a club at your tier. Mind the wax, and if you bend my rim, I re-hang it at the next timeout.', act: 'bkcard' };
})();
const wW80RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'bkcard') return wOpenCourtCard(); return wW80RunAct.apply(this, arguments); };

/* after a reload, a saved game is waiting: ask once */
const wW80NextPrompt = wNextPrompt;
wNextPrompt = function () {
  if (!LAB && wCourtLive() && !WBKG.asked && !WBK && !WD && !WG.cardOffer && !WG.event && wActive()) {
    WBKG.asked = true;
    const L = WG.bkg.live, sn = L.snap;
    const close = modal(`<header><h3>A basketball game is waiting</h3></header><div class="wmsg"><p>Your game against ${esc(wBallName(L.world.club))} is where you left it${sn ? `: ${esc(wCourtScore(sn))}` : ''}.</p><p class="hint">You can also pick it up later from the Court tab on the Team screen.</p></div>
      <div class="row"><button class="btn" id="wBkRes">Resume</button><button class="ghost" id="wBkLater">Later</button></div>`, () => wDrain());
    $('wBkRes').focus();
    $('wBkRes').onclick = () => { close(); wResumeCourt(); };
    $('wBkLater').onclick = () => close();
    return true;
  }
  return wW80NextPrompt();
};

/* ---------- the Court tab: Play a game, Resume, and the last games ---------- */
const wW80CampCourt = wCampCourt;
wCampCourt = function (C) {
  const html = wW80CampCourt(C), probs = wCourtProblems(), live = wCourtLive();
  const play = live ? `<button class="btn" data-bkresume>Resume the game</button>` : `<button class="btn" data-bkplay ${probs.length ? 'disabled' : ''}>Play a game</button>`;
  const gate = !live && probs.length ? `<p class="hint wball">${esc(probs[0])}</p>` : '';
  return html.replace('<button class="btn" data-kpractice', `${play}<button class="ghost" data-kpractice`).replace(/<\/div>\s*$/, `</div>${gate}${wCourtRecent()}`);
};
function wCourtRecent() {
  const B = WG.bkg; if (!B || !B.games.length) return '';
  return `<h5 class="wbrh">Last basketball games: ${B.w}&ndash;${B.l}${B.t ? `&ndash;${B.t}` : ''}</h5><ol class="wstlog">${B.games.slice(0, 5).map(g => `<li><b class="${g.r === 'win' ? 'wgood' : 'wbad'}">${g.r === 'win' ? 'Won' : g.r === 'tie' ? 'Tied' : 'Lost'}</b> ${g.us}&ndash;${g.them} against ${esc(g.name)}<small>day ${g.day}${g.mvp != null && wPlayer(g.mvp) ? `, player of the game ${esc(wPlayer(g.mvp).n)}` : ''}</small></li>`).join('')}</ol>`;
}
const wW80RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW80RenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'court') return;
  const p = body.querySelector('[data-bkplay]'); if (p) p.onclick = () => { WCAMP.close(); wOpenCourtCard(); };
  const r = body.querySelector('[data-bkresume]'); if (r) r.onclick = () => { WCAMP.close(); wResumeCourt(); };
};

/* ---------- box lines: the Stats tab's Basketball view (w78's) shows them, and where each plays; a player's card says
   them in words (the ratings stay on the card) ---------- */
function wCourtLine(pid) { return (WG.bkstats || {})[pid] || null; }
const W_BK_LCOLS = [['gg', 'G', 'Basketball games'], ['min', 'Min', 'Minutes'], ['pts', 'Pts', 'Points'], ['reb', 'Reb', 'Rebounds'], ['ast', 'Ast', 'Assists'], ['stl', 'Stl', 'Steals'], ['blk', 'Blk', 'Blocks'],
  ['fg', 'FG', 'Field goals made of tried'], ['tp', '3PT', 'Threes made of tried'], ['ft', 'FT', 'Free throws made of tried']];
const wBkCell = (L, c) => !L ? null : c === 'min' ? Math.round((L.sec || 0) / 60) : c === 'fg' ? `${L.fgm || 0}/${L.fga || 0}` : c === 'tp' ? `${L.tpm || 0}/${L.tpa || 0}` : c === 'ft' ? `${L.ftm || 0}/${L.fta || 0}` : L[c] || 0;
const wBkSortVal = (L, c) => !L ? -1 : c === 'min' ? L.sec || 0 : c === 'fg' ? L.fgm || 0 : c === 'tp' ? L.tpm || 0 : c === 'ft' ? L.ftm || 0 : L[c] || 0;
const wW80CampStats = wCampStats;
wCampStats = function () {
  const html = wW80CampStats();
  if (WSTAT.view !== 'basketball') return html;
  const k = WSTAT.sort && W_BK_LCOLS.some(c => c[0] === WSTAT.sort) ? WSTAT.sort : null;
  const C = wCourtSync(), rows = wRoster().map((p, i) => ({ p, i, L: wCourtLine(p.id), at: wCourtSpotOf(p.id, C) }));
  if (k) rows.sort((a, b) => (wBkSortVal(b.L, k) - wBkSortVal(a.L, k)) || a.i - b.i);
  const head = `<th scope="col"><button class="wsth" data-wsort="" aria-pressed="${!k}">Player</button></th><th scope="col">Spot</th>` + W_BK_LCOLS.map(([c, s, l]) => `<th scope="col"><button class="wsth" data-wsort="${c}" title="${esc(l)}" aria-pressed="${k === c}">${s}</button></th>`).join('');
  const body = rows.map(({ p, L, at }) => `<tr data-wsp="${p.id}"${WSTAT.pid === p.id ? ' class="wsel"' : ''}><th scope="row"><button class="wsname" data-wsp-open aria-expanded="${WSTAT.pid === p.id}"><img src="${wPlayerPort(p, 40)}" alt=""><span><b>${esc(p.n)}</b><small>${esc(wKindName(p.kind))}</small></span></button></th>
    <td>${!at ? '&ndash;' : at.spot === 'bench' ? `Bench ${at.n}` : at.spot}</td>${W_BK_LCOLS.map(([c]) => { const v = wBkCell(L, c); return `<td>${v == null ? '<span class="dim">&ndash;</span>' : v}</td>`; }).join('')}</tr>`).join('');
  const sel = WSTAT.pid != null && wPlayer(WSTAT.pid);
  return html.replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Where each plays (set on the Court tab), and every basketball game they played from the world on this journey (call-ups, scrimmages and practice games are not counted). Pick a heading to sort, a player to see their ratings.</small>')
    .replace(/<div class="tablewrap">[\s\S]*$/, `<div class="tablewrap"><table class="wstats"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${sel ? wStatsCard(sel) : ''}`);
};
const wW80StatsCard = wStatsCard;
wStatsCard = function (p) {
  const L = wCourtLine(p.id), html = wW80StatsCard(p);
  if (!L || !L.gg) return html;
  const pct = (m, a) => a ? ` (${Math.round(m / a * 100)}%)` : '';
  const bits = [`${L.gg} basketball game${L.gg === 1 ? '' : 's'}, ${Math.round(L.sec / 60)} minutes`, `${L.pts} points, ${L.reb} rebounds, ${L.ast} assists`, `${L.fgm} of ${L.fga} from the field${pct(L.fgm, L.fga)}, ${L.tpm} of ${L.tpa} threes, ${L.ftm} of ${L.fta} free throws`];
  if (L.stl || L.blk) bits.push(`${L.stl} steals, ${L.blk} blocks`);
  return html.replace('<div class="wbd wbkc"><h5>Basketball</h5>', `<div class="wbd wbkc"><h5>Basketball</h5><p class="wbdbox">${bits.join('; ')}.</p>`);
};

const wW80RenderHelp = renderHelp;
renderHelp = function () {
  wW80RenderHelp();
  const after = $('wHelpCourtCall'); if (!after || $('wHelpCourtGame')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpCourtGame"><b>Basketball games.</b> Once you have ${W_BKG.minOwn} players of your own, your five can play basketball for real: Play a game on the Court tab, or ask Nim Hoopwright at the Charter Court for HOOPS. Take on the local side or a rival club, once a day each. Play (you play your five by hand, and call it), Manage (you call it, your five play) or Simulate. There is no Team HP on the court. A win pays XP to everyone who played (half to the rest), gold and fans, and a little more to the player of the game; a loss pays a quarter of the XP, and a tie half. Save and leave keeps a game at its last stoppage. The Charter Court has its own ways: two patches of the boards are still waxed, so cuts slide there and a driver can slip; a big dunk bends the rim, and shots on it rattle until Nim re-hangs it at the next timeout; and the walled yard roars for a run, a dunk or a block, lifting that side for a few seconds. The Stats tab's Basketball view has every player's box score.</p>`);
};
