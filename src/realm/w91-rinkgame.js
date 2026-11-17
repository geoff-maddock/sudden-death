/* w91: hockey from the world (issue #83, phase 6). Your six plays a rival club, or the local side, at the Pond Rink,
   as basketball is played (w80): Play (you skate your six by hand, and call it), Manage (you call it, your six play)
   or Simulate (the result at once). Old Tove's SHINNY and the Rink tab open the game card: the clubs at your tier, each
   once a day, and the scrimmage as before. A game needs W_HKG.minOwn players of your own; call-ups fill the six. Every
   game at the Pond Rink has the pond's own ways (13-pond.js): snow building on the ice, the old boards, the ice that
   cracks under a big hit, and the bank's roar.
   Their squad: their six at your level plus the tier, with W_HKG.oppBonus points spread over each, and a bench of
   W_HKG.bench a level lower; a rival keeps the same squad until it would be a different level.
   The result: a win pays XP to everyone who played (half to the rest of the team), gold and fans by tier, and the
   player of the game a little more; a loss a quarter of the XP and costs nothing else (no Team HP on the ice). A
   hockey game never ends level. Every game adds your players' lines to WG.hkstats, and goes in the head to head and
   the league table. Save and leave keeps the game at its last whistle (pressed in live play, you leave at the next
   one, so the play counts), and it is waiting when you come back, after a reload too. Concede counts as a loss.

   WG.hkg     { live: null | { world, snap }, met: { club: dayAbs }, opp: { club: { lvl, team } }, games: [last W_HKG.keep], w, l }
              world = { kind: 'hkgame', ref, club, tier, how, day, name, ids, cup }, plain data; the end dispatches
              W_ON_END[kind] (which also gets us, them and shots: [yours, theirs]). ids: your squad's roster ids at
              the first face-off (the six, then the bench; null for a call-up)
   WG.hkstats { pid: { gg, sec, g, a, sog, hit, blk, take, pim, fow, fot, sa, sv } }, this journey
   wRinkProblems(), wStartRink({ club, how, tier?, kind?, ref?, cup? }), wResumeRink(), wRinkLeaveGame(),
   wRinkConcede(), wOpenRinkCard()
   Wraps: wRinkBarNote (wW91RinkBarNote: Save and leave and Concede in a real game), wLeaveRink (wW91LeaveRink),
   wHK.onOver (the end settles a real game), wRunAct (wW91RunAct: SHINNY opens the card), wNextPrompt (wW91NextPrompt: a
   game waiting after a reload), wCampRink and wRenderCamp (wW91CampRink, wW91RenderCamp: Play a game and Resume on
   the Rink tab), wCampStats (wW91CampStats: the Hockey view's lines), wStatsCard (wW91StatsCard: the lines in words),
   renderHelp (wW91RenderHelp: #wHelpRinkGame). */

const W_HKG = {
  minOwn: 3, xp: 12, gold: 15, fans: 3, lossShare: .25, benchShare: .5, mvpXp: 5,
  // extra rating points for each of their six, by tier, spread over the six ratings; first guesses, as the court's,
  // until test/realm_rink_lab.py measures them (phase 11)
  oppBonus: { 1: 0, 2: 2, 3: 5 },
  minutes: 90, keep: 10, saveMs: 12000, bench: 2,
};
const W_HKG_HOW = { play: 'Play', manage: 'Manage', sim: 'Simulate' };
const WHKG = { saved: 0, asked: false, msg: '', leaving: false };
const W_HK_LINE = ['sec', 'g', 'a', 'sog', 'hit', 'blk', 'take', 'pim', 'fow', 'fot', 'sa', 'sv'];

function wHkg() {
  const B = WG.hkg = WG.hkg || { live: null, met: {}, opp: {}, games: [], w: 0, l: 0 };
  B.met = B.met || {}; B.opp = B.opp || {}; B.games = B.games || [];
  return B;
}
function wRinkLive() { return !!(WG && WG.hkg && WG.hkg.live); }
// a real game is on the rink (not a scrimmage or a practice)
function wRinkWorld() { return !!(WHK && WHK.world && wRinkLive()); }
function wRinkProblems() {
  const n = wRoster().length;
  return n < W_HKG.minOwn ? [`Recruit ${W_HKG.minOwn - n} more player${W_HKG.minOwn - n === 1 ? '' : 's'}: a hockey game needs ${W_HKG.minOwn} of your own, and call-ups fill the rest of the six.`] : [];
}
// how well each side's CPU coaches: yours (Simulate) as a Knight, theirs by tier, as on the diamond
const wRinkSkill = tier => [1, W_BALL.diff[tier] != null ? W_BALL.diff[tier] : 1];
const wRinkResult = sc => sc[0] > sc[1] ? 'win' : 'lose';

/* a club's squad: its six, its own kinds first, at your level plus the tier with the bonus; then its bench a level
   lower. A rival keeps the same squad (the same names and ratings) until it would be a different level. */
function wRinkOpp(club, tier) {
  const B = wHkg(), lvl = wBallOppLvl(tier), C = club === 'apex' ? Object.assign({}, W_CUP.apexTeam) : wBallTeam(club), k = W_HKG.oppBonus[tier] || 0, n = wHK.pos.length;
  const cached = club !== 'local' && B.opp[club];
  let team;
  if (cached && cached.lvl === lvl) team = JSON.parse(JSON.stringify(cached.team));
  else {
    const rg = wBallRegion(club), own = rg ? (DB.regions[rg] || {}).kinds || [] : (C.roster || []).map(r => r[1]);
    const all = own.filter(x => wHK.kinds.includes(x)).concat(W_HKR.cuKinds).filter((x, i, a) => a.indexOf(x) === i);
    const kinds = all.slice(0, n).concat(Array.from({ length: W_HKG.bench }, (_, i) => all[(n + i) % all.length]));
    const names = new Set(), mk = (kind, i) => {
      const rn = (C.roster || []).find(r => r[1] === kind), free = (FA_NAMES[kind] || []).filter(x => !names.has(x));
      const p = wMakePlayer({ kind, lvl: i < n ? lvl : Math.max(1, lvl - 1), n: rn && !names.has(rn[0]) ? rn[0] : free.length ? pick(free) : undefined, num: rn ? rn[2] : undefined }, 'opp');
      names.add(p.n);
      return wRinkPlayer(p);
    };
    team = { name: C.name, short: C.short, color: C.color, light: C.light, roster: kinds.map(mk) };
    if (club !== 'local') B.opp[club] = { lvl, team: JSON.parse(JSON.stringify(team)) };
  }
  // the bonus on the six, in a fixed order over the ratings, so a rival plays the same each time
  if (k) team.roster.slice(0, n).forEach((p, j) => { const st = wHK.stats; for (let i = 0; i < k; i++) { const s = st[(i * 5 + j) % st.length]; p.r[s] = Math.min(W_HKR.cap, p.r[s] + 1); } });
  return team;
}
// your squad for a game: the six and your bench (call-ups fill the six), named apart from theirs; ids: roster ids
function wRinkSquad(vs) {
  const C = wSixSync(), team = wSixMine(), keys = wSixKeys(C);
  const ids = keys.map(k => typeof k === 'number' ? k : null), theirs = new Set(vs ? vs.roster.map(p => p.n) : []);
  // (a call-up who shares a name with one of theirs takes a number after it)
  team.roster.forEach((p, i) => { if (ids[i] == null && theirs.has(p.n)) p.n += ' II'; });
  return { team, ids };
}

/* ---------- starting, leaving, coming back ---------- */
function wStartRink(o) {
  if (!WG || !RUN) return '';
  const probs = wRinkProblems(); if (probs.length) return probs.join(' ');
  const B = wHkg(), club = o.club;
  if (B.live) return 'Finish the hockey game you started first.';
  if (!wBallRegion(club) && !CLUBS[club] && club !== 'apex') return '';
  if (!o.cup && B.met[club] === WG.dayAbs) return `${wCap(wBallName(club))} have already played you at hockey today. Come back tomorrow.`;
  const how = W_HKG_HOW[o.how] ? o.how : 'play', tier = o.tier || wBallTier(club);
  const opp = wRinkOpp(club, tier), sq = wRinkSquad(opp), mine = sq.team;
  const world = { kind: o.kind || 'hkgame', ref: o.ref || null, club, tier, how, day: WG.dayAbs, name: opp.name, ids: sq.ids, cup: !!o.cup };
  if (!o.cup) B.met[club] = WG.dayAbs;
  B.live = { world, snap: null };
  const opts = { teams: [mine, opp], skill: wRinkSkill(tier), mins: wRinkMins(), pond: true, snow: wRinkSnowing(), ordered: [true, false] };
  if (how === 'sim') {
    const s = wHK.simGame(opts);
    wRinkResultCard(wRinkSettle(wRinkResult(s.score), s.score[0], s.score[1], s.box, s));
    return '';
  }
  wRinkGame(Object.assign({}, opts, { mode: how === 'play' ? 'play' : 'manage', how: 'world', title: `${mine.name} against ${opp.name}` }));
  WHK.world = true;
  wRinkBarNote();
  wSave();
  return '';
}
function wResumeRink() {
  const L = wRinkLive() && WG.hkg.live;
  if (!L) return;
  if (!L.snap) { wRinkCallOff('The game had not reached its first whistle, so it is called off.'); return; }
  WHK = { over: null, how: 'world', world: true }; wRinkTick(true);
  wHK.resume(L.snap);
  $('wRinkTitle').textContent = `${L.snap.G.teams[0].name} against ${L.snap.G.teams[1].name}`;
  showView('rink');
  wRinkBarNote(); wRinkBox();
}
// Save and leave: the game stays at its last whistle. Pressed in live play, you leave at the next whistle
function wRinkLeaveGame() {
  const L = wRinkLive() && WG.hkg.live; if (!L) return wLeaveRink();
  const ph = wHK.phase;
  if (wRinkWorld() && L.snap && ph && !['dead', 'break', 'over'].includes(ph) && ph !== 'so') { WHKG.leaving = true; wRinkBarNote(); return; }
  WHKG.leaving = false;
  // (at a whistle, the game as it is now: changes and calls made in it, a timeout taken)
  if (L.snap && ['dead', 'break'].includes(ph)) L.snap = wHK.snapshot();
  const sn = L.snap;
  WHKG.asked = true;
  WHK = null; wW91LeaveRink();
  if (!sn) return wRinkCallOff(`You leave before the first whistle, so the game against ${wBallName(L.world.club)} is called off.`);
  wLog(`Your hockey game against ${wBallName(L.world.club)} is saved: ${wRinkScore(sn)}. Resume it from the Rink tab on the Team screen.`, 'd');
  wSave();
}
function wRinkCallOff(why) {
  const B = wHkg(), L = B.live; if (!L) return;
  B.live = null; if (!L.world.cup) delete B.met[L.world.club];
  wLog(why || `The hockey game against ${wBallName(L.world.club)} is called off. No result.`, 'd');
  wSave();
}
function wRinkConcede() {
  if (!wRinkWorld()) return;
  wHK.pause(true);
  askConfirm('Concede this game?', 'It counts as a loss. A loss on the ice costs nothing, but you only get a quarter of the XP.', 'Concede', () => {
    if (!wRinkLive()) return;
    const G = wHK.G, sc = G ? G.score : [0, 0];
    wRinkSettle('lose', sc[0], sc[1], wHK.box(), wHK.summary());
    WHK = null; wW91LeaveRink();
  }, () => { if (WHK) wHK.pause(false); });
  // (closed any way at all: carry on, if the game is still on)
  wAfterAsk(() => { if (WHK) wHK.pause(false); });
}
function wRinkScore(sn) { const G = sn.G, t = Math.max(0, G.clock), c = t < 10 ? t.toFixed(1) : `${Math.floor(Math.ceil(t) / 60)}:${String(Math.ceil(t) % 60).padStart(2, '0')}`; return `${G.teams[0].short || G.teams[0].name} ${G.score[0]}, ${G.teams[1].short || G.teams[1].name} ${G.score[1]}, ${wHK.periodName(G.p)} ${c}`; }
wHK.wantSnap = () => wRinkWorld();
wHK.onSnap = sn => {
  const L = wRinkWorld() && WG.hkg.live; if (!L) return;
  const first = !L.snap; L.snap = sn;
  if (WHKG.leaving) { WHKG.leaving = false; setTimeout(() => { if (wRinkWorld()) wRinkLeaveGame(); }, 0); return; }
  // (saved at most every W_HKG.saveMs, so a reload can come back a few whistles early; the first one always)
  const now = Date.now(); if (first || now - WHKG.saved > W_HKG.saveMs) { WHKG.saved = now; wSave(); }
};
// the end of a game on the rink: a scrimmage or a practice as before; a real game settles in the world
const wW91OnOver = wHK.onOver;
wHK.onOver = s => {
  if (WHK && WHK.world && wRinkLive()) WHK.msg = wRinkSettle(wRinkResult(s.score), s.score[0], s.score[1], s.box, s);
  wW91OnOver(s);
  wRinkBarNote();
};

/* ---------- the final ---------- */
function wRinkSettle(r, us, them, box, sum) {
  const B = wHkg(), L = B.live, W = L.world, win = r === 'win', S0 = sum || {};
  B.live = null;
  if (win) { B.w++; fire('matchWon', { engine: 'rink' }); } else B.l++;
  // lines for your own players (call-ups have no roster id), and who played
  const S = WG.hkstats = WG.hkstats || {}, line = {}, played = new Set();
  for (const row of (box && box[0] ? box[0].rows : [])) {
    const id = W.ids[row.ri]; if (typeof id !== 'number' || !wPlayer(id) || !(row.sec > 0)) continue;
    played.add(id);
    const T = S[id] = S[id] || { gg: 0 };
    T.gg++; line[id] = {};
    for (const k of W_HK_LINE) { T[k] = (T[k] || 0) + (row[k] || 0); line[id][k] = row[k] || 0; }
  }
  const mvp = wRinkMvp(line);
  const base = Math.round(W_HKG.xp * W.tier * (win ? 1 : W_HKG.lossShare));
  for (const p of wRoster()) { const n = played.has(p.id) ? base + (win && mvp === p.id ? W_HKG.mvpXp : 0) : Math.round(base * W_HKG.benchShare); if (n > 0) wGiveXp(p, n); }
  const bits = `XP +${base} for everyone who played${wRoster().some(p => !played.has(p.id)) ? `, +${Math.round(base * W_HKG.benchShare)} for those who didn't` : ''}`;
  let pay = '';
  if (win) { const g = W_HKG.gold * W.tier, f = W_HKG.fans * W.tier; RUN.gold += g; RUN.fans = (RUN.fans || 0) + f; pay = ` +${g} gold, +${f} fans.`; }
  if (CLUBS[W.club]) {
    const H = wH2h(), h = H[W.club] = H[W.club] || { w: 0, l: 0 };
    if (win) h.w++; else h.l++;
    h.last = { r, us, them, sport: 'hockey', day: WG.dayAbs };
    try { if (wIsRival(W.club)) wLeagueMine(r); } catch (e) { console.error(e); }
  }
  const how = S0.so ? 'so' : S0.ot ? 'ot' : '';
  B.games.unshift({ day: WG.dayAbs, club: W.club, name: W.name, tier: W.tier, how: W.how, r, us, them, end: how, mvp, line });
  B.games.length = Math.min(B.games.length, W_HKG.keep);
  WG.lastMatch = { kind: W.kind, result: r, day: WG.dayAbs, tier: W.tier };
  W.us = us; W.them = them; W.shots = S0.shots ? S0.shots.slice() : [0, 0];
  const f = W_ON_END[W.kind]; if (f) { try { f(r, W.ref, W); } catch (e) { console.error(e); } }
  wAdvance(W_HKG.minutes);
  const who = mvp != null && wPlayer(mvp);
  const msg = `Final: ${win ? 'you win' : 'you lose'} ${us}–${them} against ${wBallName(W.club)}${how === 'so' ? ', in a shootout' : how === 'ot' ? ', in sudden death' : ''}.${pay} ${bits}${win && who ? `, and +${W_HKG.mvpXp} for ${who.n}, player of the game` : ''}.`;
  wLog(msg, win ? 'g' : 'b');
  wSave();
  return msg;
}
// player of the game: the best line among your own players (goals and assists, and a share for the rest; a goalie's saves)
function wRinkMvp(lines) {
  let best = null, bs = 0;
  for (const id in lines) { const s = lines[id], v = s.g * 3 + s.a * 2 + s.sog * .3 + s.hit * .3 + s.blk * .5 + s.take * .4 - s.pim * .4 + (s.sa ? s.sv * .35 - (s.sa - s.sv) * 1.2 : 0); if (v > bs) { bs = v; best = +id; } }
  return best;
}
W_ON_END.hkgame = function () { }; // the log line and the rewards are paid in wRinkSettle; kinds built on it add theirs
function wRinkResultCard(msg) {
  if (LAB) return;
  const close = modal(`<header><h3>Final</h3></header><div class="wmsg"><p>${esc(msg)}</p></div><div class="row"><button class="btn" id="wRinkOk">Done</button></div>`, () => wDrain());
  $('wRinkOk').focus(); $('wRinkOk').onclick = () => close();
}

/* ---------- the bar in a real game ---------- */
$('wRinkBack').insertAdjacentHTML('beforebegin', '<button class="ghost" id="wRinkSave" hidden>Save and leave</button><button class="ghost" id="wRinkGive" hidden>Concede</button>');
$('wRinkSave').onclick = () => wRinkLeaveGame();
$('wRinkGive').onclick = () => wRinkConcede();
const wW91RinkBarNote = wRinkBarNote;
wRinkBarNote = function () {
  wW91RinkBarNote();
  const real = !!(WHK && WHK.world), live = real && wRinkLive();
  $('wRinkSave').hidden = $('wRinkGive').hidden = !live;
  if (!live) WHKG.leaving = false;
  $('wRinkSave').disabled = live && WHKG.leaving; $('wRinkSave').textContent = live && WHKG.leaving ? 'Leaving at the next whistle…' : 'Save and leave';
  $('wRinkAgain').hidden = real; $('wRinkBack').hidden = live; $('wRinkMins').parentElement.hidden = real;
  if (real && !live && WHK.msg) $('wRinkNote').textContent = WHK.msg;
};
// Back to the world (or the title) from a real game still on: Save and leave
const wW91LeaveRink = wLeaveRink;
wLeaveRink = function () { if (wRinkWorld()) return wRinkLeaveGame(); wW91LeaveRink(); if (WG) { wSave(); wDrain(); } };

/* ---------- picking a game ---------- */
function wRinkH2h(club) { const L = ((WG.h2h || {})[club] || {}).last; return L && L.sport === 'hockey' ? L : null; }
function wOpenRinkCard() {
  const probs = wRinkProblems(), B = wHkg(), live = wRinkLive();
  const rows = wBallClubs().map(c => {
    const T = wBallTeam(c), tier = wBallTier(c), met = B.met[c] === WG.dayAbs, last = wRinkH2h(c);
    const btns = Object.keys(W_HKG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-hkclub="${c}" data-hkhow="${how}" ${probs.length || met || live ? 'disabled' : ''}>${W_HKG_HOW[how]}</button>`).join('');
    return `<li class="wbcl"><span class="wbsw" style="background:${T.color}"></span><div><b>${esc(T.name)}</b>
      <small>Tier ${tier}: their players are level ${wBallOppLvl(tier)}, the coach a ${W_BALL_SKILL[wRinkSkill(tier)[1]]}.${last ? ` Last hockey game: ${last.r === 'win' ? 'won' : 'lost'} ${last.us}–${last.them}.` : ''}${met ? ' <b>Played you today.</b>' : ''}</small></div>
      <div class="row">${btns}</div></li>`;
  }).join('');
  const close = modal(`<header><h3>Play a hockey game</h3><button class="ghost" data-close>Done</button></header>
    ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}${WHKG.msg ? `<p class="wbad">${esc(WHKG.msg)}</p>` : ''}
    ${live ? `<p class="wbad">You have a hockey game waiting. <button class="btn" id="wHkResume">Resume it</button></p>` : ''}
    <p class="hint">A game at the Pond Rink with your six and your bench: three periods, ${wRinkMins()} minutes in all (Settings has the length). <b>Play</b>: you skate your six by hand, and call it. <b>Manage</b>: you call the systems, the lines, the timeout and the goalie, and your six play. <b>Simulate</b>: the result now. A win pays ${W_HKG.xp} XP to everyone who played, ${W_HKG.gold} gold and ${W_HKG.fans} fans, times the tier; a loss pays a quarter of the XP and costs nothing else. Nobody goes home level: sudden death, then a shootout. Each club plays you once a day, and a game takes an hour and a half or so.${wRinkSnowing() ? ' <b>It is snowing:</b> the pond will be slow by the end of each period.' : ''}</p>
    <ul class="wbclubs">${rows}</ul>
    <p class="hint">Or watch a scrimmage: <button class="ghost" id="wHkExhib">Rimewatch against Cinderhold</button></p>`);
  WHKG.msg = '';
  $('modalBox').querySelectorAll('[data-hkclub]').forEach(b => b.onclick = () => {
    close();
    const r = wStartRink({ club: b.dataset.hkclub, how: b.dataset.hkhow });
    if (r) { WHKG.msg = r; wOpenRinkCard(); }
  });
  const ex = $('wHkExhib'); if (ex) ex.onclick = () => { close(); wRinkGame(); };
  const rs = $('wHkResume'); if (rs) rs.onclick = () => { close(); wResumeRink(); };
}
// Old Tove's SHINNY opens the card (SCRIMMAGE stays the exhibition; GAME the card-game match)
(() => {
  const K = DB.chars.gk_rink; if (!K) return;
  K.topics.job.t += ' Bring your six for SHINNY and I will match you with a club for real.';
  K.topics.shinny = { t: 'Real hockey on the pond, your six against a club at your tier. The ice slows as the snow builds, some of the boards are older than others, and if you crack my ice I flood it at the break.', act: 'hkcard' };
})();
const wW91RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'hkcard') return wOpenRinkCard(); return wW91RunAct.apply(this, arguments); };

/* after a reload, a saved game is waiting: ask once */
const wW91NextPrompt = wNextPrompt;
wNextPrompt = function () {
  if (!LAB && wRinkLive() && !WHKG.asked && !WHK && !WD && !WG.cardOffer && !WG.event && wActive()) {
    WHKG.asked = true;
    const L = WG.hkg.live, sn = L.snap;
    const close = modal(`<header><h3>A hockey game is waiting</h3></header><div class="wmsg"><p>Your game against ${esc(wBallName(L.world.club))} is where you left it${sn ? `: ${esc(wRinkScore(sn))}` : ''}.</p><p class="hint">You can also pick it up later from the Rink tab on the Team screen.</p></div>
      <div class="row"><button class="btn" id="wHkRes">Resume</button><button class="ghost" id="wHkLater">Later</button></div>`, () => wDrain());
    $('wHkRes').focus();
    $('wHkRes').onclick = () => { close(); wResumeRink(); };
    $('wHkLater').onclick = () => close();
    return true;
  }
  return wW91NextPrompt();
};

/* ---------- the Rink tab: Play a game, Resume, and the last games ---------- */
const wW91CampRink = wCampRink;
wCampRink = function (C) {
  const html = wW91CampRink(C), probs = wRinkProblems(), live = wRinkLive();
  const play = live ? `<button class="btn" data-hkresume>Resume the game</button>` : `<button class="btn" data-hkplay ${probs.length ? 'disabled' : ''}>Play a game</button>`;
  const gate = !live && probs.length ? `<p class="hint wball">${esc(probs[0])}</p>` : '';
  return html.replace('<button class="btn" data-hpractice', `${play}<button class="ghost" data-hpractice`).replace(/<\/div>\s*$/, `</div>${gate}${wRinkRecent()}`);
};
function wRinkRecent() {
  const B = WG.hkg; if (!B || !B.games.length) return '';
  return `<h5 class="wbrh">Last hockey games: ${B.w}&ndash;${B.l}</h5><ol class="wstlog">${B.games.slice(0, 5).map(g => `<li><b class="${g.r === 'win' ? 'wgood' : 'wbad'}">${g.r === 'win' ? 'Won' : 'Lost'}</b> ${g.us}&ndash;${g.them} against ${esc(g.name)}${g.end === 'so' ? ' (shootout)' : g.end === 'ot' ? ' (sudden death)' : ''}<small>day ${g.day}${g.mvp != null && wPlayer(g.mvp) ? `, player of the game ${esc(wPlayer(g.mvp).n)}` : ''}</small></li>`).join('')}</ol>`;
}
const wW91RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW91RenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'rink') return;
  const p = body.querySelector('[data-hkplay]'); if (p) p.onclick = () => { WCAMP.close(); wOpenRinkCard(); };
  const r = body.querySelector('[data-hkresume]'); if (r) r.onclick = () => { WCAMP.close(); wResumeRink(); };
};

/* ---------- lines: the Stats tab's Hockey view (w89's) shows them, and where each plays; a player's card says them in
   words (the ratings stay on the card) ---------- */
function wRinkLine(pid) { return (WG.hkstats || {})[pid] || null; }
const W_HK_LCOLS = [['gg', 'GP', 'Hockey games'], ['min', 'Min', 'Minutes on the ice'], ['g', 'G', 'Goals'], ['a', 'A', 'Assists'], ['pts', 'Pts', 'Points: goals and assists'], ['sog', 'SOG', 'Shots on goal'], ['hit', 'Hits', 'Hits'],
  ['blk', 'Blk', 'Shots blocked'], ['pim', 'PIM', 'Penalty minutes'], ['fo', 'FO', 'Face-offs won of taken'], ['sv', 'Sv', 'A goalie\'s saves of shots faced']];
const wHkCell = (L, c) => !L ? null : c === 'min' ? Math.round((L.sec || 0) / 60) : c === 'pts' ? (L.g || 0) + (L.a || 0) : c === 'fo' ? (L.fot ? `${L.fow || 0}/${L.fot}` : '–') : c === 'sv' ? (L.sa ? `${L.sv || 0}/${L.sa}` : '–') : L[c] || 0;
const wHkSortVal = (L, c) => !L ? -1 : c === 'min' ? L.sec || 0 : c === 'pts' ? (L.g || 0) + (L.a || 0) : c === 'fo' ? L.fow || 0 : c === 'sv' ? L.sv || 0 : L[c] || 0;
const wW91CampStats = wCampStats;
wCampStats = function () {
  const html = wW91CampStats();
  if (WSTAT.view !== 'hockey') return html;
  const k = WSTAT.sort && W_HK_LCOLS.some(c => c[0] === WSTAT.sort) ? WSTAT.sort : null;
  const C = wSixSync(), rows = wRoster().map((p, i) => ({ p, i, L: wRinkLine(p.id), at: wSixSpotOf(p.id, C) }));
  if (k) rows.sort((a, b) => (wHkSortVal(b.L, k) - wHkSortVal(a.L, k)) || a.i - b.i);
  const head = `<th scope="col"><button class="wsth" data-wsort="" aria-pressed="${!k}">Player</button></th><th scope="col">Spot</th>` + W_HK_LCOLS.map(([c, s, l]) => `<th scope="col"><button class="wsth" data-wsort="${c}" title="${esc(l)}" aria-pressed="${k === c}">${s}</button></th>`).join('');
  const body = rows.map(({ p, L, at }) => `<tr data-wsp="${p.id}"${WSTAT.pid === p.id ? ' class="wsel"' : ''}><th scope="row"><button class="wsname" data-wsp-open aria-expanded="${WSTAT.pid === p.id}"><img src="${wPlayerPort(p, 40)}" alt=""><span><b>${esc(p.n)}</b><small>${esc(wKindName(p.kind))}</small></span></button></th>
    <td>${!at ? '&ndash;' : at.spot === 'bench' ? `Bench ${at.n}` : at.spot}</td>${W_HK_LCOLS.map(([c]) => { const v = wHkCell(L, c); return `<td>${v == null ? '<span class="dim">&ndash;</span>' : v}</td>`; }).join('')}</tr>`).join('');
  const sel = WSTAT.pid != null && wPlayer(WSTAT.pid);
  return html.replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Where each plays (set on the Rink tab), and every hockey game they played from the world on this journey (call-ups, scrimmages and practice games are not counted). Pick a heading to sort, a player to see their ratings.</small>')
    .replace(/<div class="tablewrap">[\s\S]*$/, `<div class="tablewrap"><table class="wstats"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${sel ? wStatsCard(sel) : ''}`);
};
const wW91StatsCard = wStatsCard;
wStatsCard = function (p) {
  const L = wRinkLine(p.id), html = wW91StatsCard(p);
  if (!L || !L.gg) return html;
  const bits = [`${L.gg} hockey game${L.gg === 1 ? '' : 's'}, ${Math.round(L.sec / 60)} minutes on the ice`, `${L.g} goal${L.g === 1 ? '' : 's'} and ${L.a} assist${L.a === 1 ? '' : 's'} on ${L.sog} shots`];
  if (L.hit || L.blk) bits.push(`${L.hit} hits, ${L.blk} blocks`);
  if (L.sa) bits.push(`${L.sv} saves of ${L.sa} in goal (${Math.round(L.sv / L.sa * 100)}%)`);
  if (L.pim) bits.push(`${L.pim} penalty minutes`);
  return html.replace('<div class="wbd wbkc whkc"><h5>Hockey</h5>', `<div class="wbd wbkc whkc"><h5>Hockey</h5><p class="wbdbox">${bits.join('; ')}.</p>`);
};

const wW91RenderHelp = renderHelp;
renderHelp = function () {
  wW91RenderHelp();
  const after = $('wHelpRinkTab'); if (!after || $('wHelpRinkGame')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpRinkGame"><b>Hockey games.</b> Once you have ${W_HKG.minOwn} players of your own, your six can play hockey for real: Play a game on the Rink tab, or ask Old Tove at the Pond Rink for SHINNY. Take on the local side or a rival club, once a day each. Play (you skate your six by hand, and call it), Manage (you call it, your six play) or Simulate. There is no Team HP on the ice. A win pays XP to everyone who played (half to the rest), gold and fans, and a little more to the player of the game; a loss pays a quarter of the XP. Nobody goes home level. Save and leave keeps a game at its last whistle. The Pond Rink has its own ways: it is a real pond, so snow builds on the ice through a period and slows the puck in the worst patches until Old Tove scrapes it at the break, faster when it is snowing; a few stretches of the old boards are dead, or lively; a big enough hit by the boards cracks the ice there, and skaters and the puck go badly over it until the break; and the town on the bank roars for a run of shots, a big hit or a goal, which lifts that side for a few seconds. The Stats tab's Hockey view has every player's line.</p>`);
};
