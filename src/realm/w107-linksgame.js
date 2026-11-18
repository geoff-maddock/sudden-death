/* w107: golf from the world (issue #92, phase 5). Your four plays a rival club, or the local side, at Mossgate Links,
   as hockey is played (w91): Play (you swing it), Manage (you call the line, the stances and the caddie's word, and
   pick the next hitter if you like; your four swing on their ratings) or Simulate (the result at once). Agatha Divot's
   MATCH and the Links tab open the match card: the clubs at your tier, each once a day, the round and the practice as
   before. A match needs W_LKG.minOwn players of your own; call-ups fill the four. Every game at the Links has the
   wood's own ways (09-wood.js): the day's weather (wLinksWeather), the bees and the Gloomcap.
   The standing nine plays every match unless you tick Wild nine on the card (a new course, seeded by the day and the
   club: the same for every match against that club today).
   Their four: at your level plus the tier, with W_LKG.oppBonus points spread over each; a rival keeps the same four
   until it would be a different level. Their caddie by tier (a Squire, a Knight, an Archmage), as on the diamond.
   The result: a win pays XP to everyone who played (half to the rest of the team), gold and fans by tier, and the
   player of the match a little more; a loss a quarter of the XP and costs nothing else (no Team HP on the course). A
   golf match never ends level. Every match adds your players' lines to WG.lkstats, and goes in the head to head and the
   league table. Save and leave keeps the match between shots, and it is waiting when you come back, after a reload too.
   Concede counts as a loss.

   WG.lkg     { live: null | { world, snap }, met: { club: dayAbs }, opp: { club: { lvl, team } }, games: [last W_LKG.keep], w, l }
              world = { kind: 'lkgame', ref, club, tier, how, day, name, ids, wild, weather }, plain data; the end
              dispatches W_ON_END[kind] (which also gets us and them: holes won, and text: "3 and 2"). ids: your four's
              roster ids in role order (null for a call-up)
   WG.lkstats { pid: { rd, shots, putts, holed } }, this journey
   wLinksProblems(), wStartLinks({ club, how, tier?, kind?, ref?, wild? }), wResumeLinks(), wLinksLeaveGame(),
   wLinksConcede(), wOpenLinksCard(), wLinksWeather()
   Wraps: wLinksBarNote (wW107LinksBarNote: Save and leave and Concede in a real match), wLeaveLinks (wW107LeaveLinks),
   wGL.onOver and wGL.onPhase (a real match settles, and is kept between shots), wLinksGame (wW107LinksGame: the day's
   weather and the wood), wRunAct (wW107RunAct: MATCH opens the card), wNextPrompt (wW107NextPrompt: a match waiting
   after a reload), wCampLinks and wRenderCamp (wW107CampLinks, wW107RenderCamp: Play a match and Resume on the Links
   tab), wCampStats (wW107CampStats: the Golf view's lines), wStatsCard (wW107StatsCard: the lines in words),
   renderHelp (wW107RenderHelp: #wHelpLinksGame). */

const W_LKG = {
  minOwn: 2, xp: 12, gold: 15, fans: 3, lossShare: .25, benchShare: .5, mvpXp: 5,
  // extra rating points for each of their four, by tier; first guesses until the lab measures them (phase 10)
  oppBonus: { 1: 0, 2: 2, 3: 5 },
  minutes: 120, keep: 10, saveMs: 12000,
};
const W_LKG_HOW = { play: 'Play', manage: 'Manage', sim: 'Simulate' };
const WLKG = { saved: 0, asked: false, msg: '', wild: false };

function wLkg() {
  const B = WG.lkg = WG.lkg || { live: null, met: {}, opp: {}, games: [], w: 0, l: 0 };
  B.met = B.met || {}; B.opp = B.opp || {}; B.games = B.games || [];
  return B;
}
function wLinksLive() { return !!(WG && WG.lkg && WG.lkg.live); }
// a real match is on the course (not a round or a practice)
function wLinksWorld() { return !!(WGL && WGL.world && wLinksLive()); }
function wLinksProblems() {
  const n = wRoster().length;
  return n < W_LKG.minOwn ? [`Recruit ${W_LKG.minOwn - n} more player${W_LKG.minOwn - n === 1 ? '' : 's'}: a golf match needs ${W_LKG.minOwn} of your own, and call-ups fill the rest of the four.`] : [];
}
const wLinksSkill = tier => [1, W_BALL.diff[tier] != null ? W_BALL.diff[tier] : 1];
// the weather of the wood today: the same all day, a new one tomorrow
function wLinksWeather() {
  const d = WG ? WG.dayAbs || 0 : 0, h = ((Math.imul(d + 11, 2654435761) >>> 0) % 100) / 100;
  return h < 0.3 ? 'still' : h < 0.65 ? 'breeze' : h < 0.83 ? 'drizzle' : 'haze';
}
// a wild nine's seed for a club today (the same for every match against them today)
const wLinksWildSeed = club => (Math.imul((WG.dayAbs || 0) + 1, 40503) ^ [...String(club)].reduce((a, ch) => Math.imul(a, 31) + ch.charCodeAt(0) | 0, 7)) >>> 0;

/* a club's four: its own kinds first, at your level plus the tier with the bonus. A rival keeps the same four (the same
   names and ratings) until it would be a different level */
function wLinksOpp(club, tier) {
  const B = wLkg(), lvl = wBallOppLvl(tier), C = club === 'apex' ? Object.assign({}, W_CUP.apexTeam) : wBallTeam(club), k = W_LKG.oppBonus[tier] || 0;
  const cached = club !== 'local' && B.opp[club];
  let team;
  if (cached && cached.lvl === lvl) team = JSON.parse(JSON.stringify(cached.team));
  else {
    const rg = wBallRegion(club), own = rg ? (DB.regions[rg] || {}).kinds || [] : (C.roster || []).map(r => r[1]);
    const all = own.filter(x => wGL.stats.some(s => wGL.rate(x)[s] !== 6.5)).concat(W_GLR.cuKinds).filter((x, i, a) => a.indexOf(x) === i);
    const names = new Set(), mk = kind => {
      const rn = (C.roster || []).find(r => r[1] === kind), free = (FA_NAMES[kind] || []).filter(x => !names.has(x));
      const p = wMakePlayer({ kind, lvl, n: rn && !names.has(rn[0]) ? rn[0] : free.length ? pick(free) : undefined }, 'opp');
      names.add(p.n);
      return wLinksPlayer(p);
    };
    team = { name: C.name, short: C.short, color: C.color, roster: all.slice(0, 4).map(mk) };
    if (club !== 'local') B.opp[club] = { lvl, team: JSON.parse(JSON.stringify(team)) };
  }
  // the bonus, in a fixed order over the ratings, so a rival plays the same each time
  if (k) team.roster.forEach((p, j) => { const st = wGL.stats; for (let i = 0; i < k; i++) { const s = st[(i * 5 + j) % st.length]; p.r[s] = Math.min(wGL.cap, p.r[s] + 1); } });
  return team;
}
// your four for a match, named apart from theirs; ids: roster ids in role order (null for a call-up)
function wLinksSquad(vs) {
  const C = wFourSync(), team = wFourMine(), ids = W_GL_ROLES.map(r => typeof C.four[r] === 'number' ? C.four[r] : null), theirs = new Set(vs ? vs.roster.map(p => p.n) : []);
  team.roster.forEach((p, i) => { if (ids[i] == null && theirs.has(p.n)) p.n += ' II'; });
  return { team, ids };
}

/* ---------- starting, leaving, coming back ---------- */
function wStartLinks(o) {
  if (!WG || !RUN) return '';
  const probs = wLinksProblems(); if (probs.length) return probs.join(' ');
  const B = wLkg(), club = o.club;
  if (B.live) return 'Finish the golf match you started first.';
  if (!wBallRegion(club) && !CLUBS[club] && club !== 'apex') return '';
  if (!o.cup && B.met[club] === WG.dayAbs) return `${wCap(wBallName(club))} have already played you at golf today. Come back tomorrow.`;
  const how = W_LKG_HOW[o.how] ? o.how : 'play', tier = o.tier || wBallTier(club), weather = wLinksWeather();
  const opp = wLinksOpp(club, tier), sq = wLinksSquad(opp), mine = sq.team, wild = !!o.wild;
  const world = { kind: o.kind || 'lkgame', ref: o.ref || null, club, tier, how, day: WG.dayAbs, name: opp.name, ids: sq.ids, wild, weather, cup: !!o.cup };
  if (!o.cup) B.met[club] = WG.dayAbs;
  B.live = { world, snap: null };
  const opts = { teams: [mine, opp], skill: wLinksSkill(tier), holes: wLinksHoles(), wild, course: wild ? wLinksWildSeed(club) : undefined, weather, wood: true, powers: true, enchant: true };
  if (how === 'sim') { const s = wGL.simGame(opts); wLinksResultCard(wLinksSettle(s)); return ''; }
  wLinksGame(Object.assign({}, opts, { mode: how, title: `${mine.name} against ${opp.name}` }));
  WGL.world = true;
  wLinksBarNote();
  wSave();
  return '';
}
function wResumeLinks() {
  const L = wLinksLive() && WG.lkg.live; if (!L) return;
  if (!L.snap) { wLinksCallOff('The match had not reached its first shot, so it is called off.'); return; }
  WGL = { over: null, world: true };
  wGL.resume(L.snap);
  $('wLinksTitle').textContent = `${L.snap.G.teams[0].name} against ${L.snap.G.teams[1].name}`;
  showView('links');
  wLinksBarNote(); wLinksRows(); wLinksCard();
}
// Save and leave: the match as it was before the shot under way (kept at every shot)
function wLinksLeaveGame() {
  const L = wLinksLive() && WG.lkg.live; if (!L) return wLeaveLinks();
  const sn = L.snap;
  WLKG.asked = true;
  WGL = null; wW107LeaveLinks();
  if (!sn) return wLinksCallOff(`You leave before the first shot, so the match against ${wBallName(L.world.club)} is called off.`);
  wLog(`Your golf match against ${wBallName(L.world.club)} is saved: ${wLinksScore(sn)}. Resume it from the Links tab on the Team screen.`, 'd');
  wSave();
}
function wLinksCallOff(why) {
  const B = wLkg(), L = B.live; if (!L) return;
  B.live = null; if (!L.world.cup) delete B.met[L.world.club];
  wLog(why || `The golf match against ${wBallName(L.world.club)} is called off. No result.`, 'd');
  wSave();
}
function wLinksConcede() {
  if (!wLinksWorld()) return;
  wGL.pause(true);
  askConfirm('Concede this match?', 'It counts as a loss. A loss on the course costs nothing, but you only get a quarter of the XP.', 'Concede', () => {
    if (!wLinksLive()) return;
    const s = wGL.summary() || {}; s.win = 1; s.text = 'conceded';
    wLinksSettle(s);
    WGL = null; wW107LeaveLinks();
  }, () => { if (WGL) wGL.pause(false); });
  wAfterAsk(() => { if (WGL) wGL.pause(false); });
}
function wLinksScore(sn) { const G = sn.G, up = G.won[0] - G.won[1], left = Math.max(0, G.holes - G.res.length); return `${up === 0 ? 'all square' : `${Math.abs(up)} ${up > 0 ? 'up' : 'down'}`}${left ? ` with ${left} to play` : ', a playoff'}, on the ${wOrd(G.h + 1)}`; }

/* ---------- kept between shots, and settled at the end ---------- */
const wW107OnPhase = wGL.onPhase;
wGL.onPhase = ph => {
  if (wW107OnPhase) wW107OnPhase(ph);
  if (ph !== 'next' || !wLinksWorld() || wGL.G.over) return;
  const L = WG.lkg.live, first = !L.snap; L.snap = wGL.snapshot();
  // (saved at most every W_LKG.saveMs, so a reload can come back a few shots early; the first one always)
  const now = Date.now(); if (first || now - WLKG.saved > W_LKG.saveMs) { WLKG.saved = now; wSave(); }
};
const wW107OnOver = wGL.onOver;
wGL.onOver = s => {
  if (WGL && WGL.world && wLinksLive()) WGL.msg = wLinksSettle(s);
  wW107OnOver(s);
  wLinksBarNote();
};
function wLinksSettle(sum) {
  const B = wLkg(), L = B.live, W = L.world, win = sum.win === 0, S0 = sum || {};
  B.live = null;
  const r = win ? 'win' : 'lose', us = (S0.won || [0, 0])[0], them = (S0.won || [0, 0])[1], text = S0.text || '';
  if (win) { B.w++; fire('matchWon', { engine: 'links' }); } else B.l++;
  // lines for your own players (call-ups have no roster id); everyone in the four played
  const S = WG.lkstats = WG.lkstats || {}, line = {}, played = new Set(), pst = (S0.pst || [[]])[0] || [];
  W.ids.forEach((id, ri) => {
    if (typeof id !== 'number' || !wPlayer(id)) return;
    played.add(id);
    const p = pst[ri] || { shots: 0, putts: 0, holed: 0 }, T = S[id] = S[id] || { rd: 0, shots: 0, putts: 0, holed: 0 };
    T.rd++; T.shots += p.shots; T.putts += p.putts; T.holed += p.holed;
    line[id] = { shots: p.shots, putts: p.putts, holed: p.holed };
  });
  const mvp = wLinksMvp(line);
  const base = Math.round(W_LKG.xp * W.tier * (win ? 1 : W_LKG.lossShare));
  for (const p of wRoster()) { const n = played.has(p.id) ? base + (win && mvp === p.id ? W_LKG.mvpXp : 0) : Math.round(base * W_LKG.benchShare); if (n > 0) wGiveXp(p, n); }
  const bits = `XP +${base} for everyone who played${wRoster().some(p => !played.has(p.id)) ? `, +${Math.round(base * W_LKG.benchShare)} for those who didn't` : ''}`;
  let pay = '';
  if (win) { const g = W_LKG.gold * W.tier, f = W_LKG.fans * W.tier; RUN.gold += g; RUN.fans = (RUN.fans || 0) + f; pay = ` +${g} gold, +${f} fans.`; }
  if (CLUBS[W.club]) {
    const H = wH2h(), h = H[W.club] = H[W.club] || { w: 0, l: 0 };
    if (win) h.w++; else h.l++;
    h.last = { r, us, them, sport: 'golf', day: WG.dayAbs, text };
    try { if (wIsRival(W.club)) wLeagueMine(r); } catch (e) { console.error(e); }
  }
  // (end: 'po' when it went to a playoff)
  const end = S0.played > S0.holes ? 'po' : '';
  B.games.unshift({ day: WG.dayAbs, club: W.club, name: W.name, tier: W.tier, how: W.how, r, us, them, text, end, wild: W.wild, weather: W.weather, mvp, line });
  B.games.length = Math.min(B.games.length, W_LKG.keep);
  WG.lastMatch = { kind: W.kind, result: r, day: WG.dayAbs, tier: W.tier };
  W.us = us; W.them = them; W.text = text;
  const f = W_ON_END[W.kind]; if (f) { try { f(r, W.ref, W); } catch (e) { console.error(e); } }
  wAdvance(W_LKG.minutes);
  const who = mvp != null && wPlayer(mvp), how = text === 'conceded' ? ', conceded' : text ? ` ${text}` : '';
  const msg = `Final: ${win ? 'you win' : 'you lose'}${how} against ${wBallName(W.club)}.${pay} ${bits}${win && who ? `, and +${W_LKG.mvpXp} for ${who.n}, player of the match` : ''}.`;
  wLog(msg, win ? 'g' : 'b');
  wSave();
  return msg;
}
// player of the match: the most holed (the shot that dropped), then the most shots carried
function wLinksMvp(lines) {
  let best = null, bs = -1;
  for (const id in lines) { const s = lines[id], v = s.holed * 3 + s.shots * 0.2; if (v > bs) { bs = v; best = +id; } }
  return best;
}
W_ON_END.lkgame = function () { }; // the log line and the rewards are paid in wLinksSettle; kinds built on it add theirs
function wLinksResultCard(msg) {
  if (LAB) return;
  const close = modal(`<header><h3>Final</h3></header><div class="wmsg"><p>${esc(msg)}</p></div><div class="row"><button class="btn" id="wLinksOk">Done</button></div>`, () => wDrain());
  $('wLinksOk').focus(); $('wLinksOk').onclick = () => close();
}

/* ---------- the bar in a real match ---------- */
$('wLinksBack').insertAdjacentHTML('beforebegin', '<button class="ghost" id="wLinksSave" hidden>Save and leave</button><button class="ghost" id="wLinksGive" hidden>Concede</button>');
$('wLinksSave').onclick = () => wLinksLeaveGame();
$('wLinksGive').onclick = () => wLinksConcede();
const wW107LinksBarNote = wLinksBarNote;
wLinksBarNote = function () {
  wW107LinksBarNote();
  const real = !!(WGL && WGL.world), live = real && wLinksLive();
  $('wLinksSave').hidden = $('wLinksGive').hidden = !live;
  $('wLinksAgain').hidden = real; $('wLinksBack').hidden = live; $('wLinksHoles').parentElement.hidden = real; $('wLinksSkill').parentElement.hidden = real;
  if (real && !live && WGL.msg) $('wLinksNote').textContent = WGL.msg;
};
const wW107LeaveLinks = wLeaveLinks;
wLeaveLinks = function () { if (wLinksWorld()) return wLinksLeaveGame(); wW107LeaveLinks(); if (WG) { wSave(); wDrain(); } };
// every game at the Links has the day's weather and the wood
const wW107LinksGame = wLinksGame;
wLinksGame = function (opts) { const o = Object.assign({ wood: true, powers: true, enchant: true }, opts || {}); if (o.weather === undefined && WG) o.weather = wLinksWeather(); return wW107LinksGame(o); };

/* ---------- picking a match ---------- */
function wLinksH2h(club) { const L = ((WG.h2h || {})[club] || {}).last; return L && L.sport === 'golf' ? L : null; }
function wOpenLinksCard() {
  const probs = wLinksProblems(), B = wLkg(), live = wLinksLive(), wx = wGL.weathers[wLinksWeather()];
  const rows = wBallClubs().map(c => {
    const T = wBallTeam(c), tier = wBallTier(c), met = B.met[c] === WG.dayAbs, last = wLinksH2h(c);
    const btns = Object.keys(W_LKG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-lkclub="${c}" data-lkhow="${how}" ${probs.length || met || live ? 'disabled' : ''}>${W_LKG_HOW[how]}</button>`).join('');
    return `<li class="wbcl"><span class="wbsw" style="background:${T.color}"></span><div><b>${esc(T.name)}</b>
      <small>Tier ${tier}: their players are level ${wBallOppLvl(tier)}, their caddie a ${W_BALL_SKILL[wLinksSkill(tier)[1]]}.${last ? ` Last golf match: ${last.r === 'win' ? 'won' : 'lost'}${last.text ? ' ' + esc(last.text) : ''}.` : ''}${met ? ' <b>Played you today.</b>' : ''}</small></div>
      <div class="row">${btns}</div></li>`;
  }).join('');
  const close = modal(`<header><h3>Play a golf match</h3><button class="ghost" data-close>Done</button></header>
    ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}${WLKG.msg ? `<p class="wbad">${esc(WLKG.msg)}</p>` : ''}
    ${live ? `<p class="wbad">You have a golf match waiting. <button class="btn" id="wLkResume">Resume it</button></p>` : ''}
    <p class="hint">A match at Mossgate Links with your four: captain's choice match play over ${wLinksHoles()} holes (Settings has the length). <b>Play</b>: you swing every shot. <b>Manage</b>: you call the line, the stances and the caddie's word, and pick the next hitter if you like; your four swing. <b>Simulate</b>: the result now. A win pays ${W_LKG.xp} XP to everyone who played, ${W_LKG.gold} gold and ${W_LKG.fans} fans, times the tier; a loss pays a quarter of the XP and costs nothing else. Nobody goes home level: a playoff round the course. Each club plays you once a day, and a match takes a couple of hours.</p>
    <p class="hint"><b>Today in the wood:</b> ${esc(wx.n)}. <label><input type="checkbox" id="wLkWild" ${WLKG.wild ? 'checked' : ''}> Play a wild nine (a new course) instead of the standing nine</label></p>
    <ul class="wbclubs">${rows}</ul>
    <p class="hint">Or watch a round: <button class="ghost" id="wLkExhib">Mossgate against Saltmere</button></p>`);
  WLKG.msg = '';
  $('wLkWild').onchange = e => { WLKG.wild = e.target.checked; };
  $('modalBox').querySelectorAll('[data-lkclub]').forEach(b => b.onclick = () => {
    close();
    const r = wStartLinks({ club: b.dataset.lkclub, how: b.dataset.lkhow, wild: WLKG.wild });
    if (r) { WLKG.msg = r; wOpenLinksCard(); }
  });
  const ex = $('wLkExhib'); if (ex) ex.onclick = () => { close(); wLinksGame(); };
  const rs = $('wLkResume'); if (rs) rs.onclick = () => { close(); wResumeLinks(); };
}
// Agatha Divot's MATCH opens the card (ROUND stays the exhibition; GAME the card-game match)
(() => {
  const K = DB.chars.gk_links; if (!K) return;
  K.topics.job.t += ' Bring your four for a MATCH and I will find you a club to play for real.';
  K.topics.match = { t: 'Real golf, your four against a club at your tier, one ball a side. Mind the bees by the fairway, and leave the Gloomcap on its stump alone. It never moves.', act: 'lkcard' };
})();
const wW107RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'lkcard') return wOpenLinksCard(); return wW107RunAct.apply(this, arguments); };

/* after a reload, a saved match is waiting: ask once */
const wW107NextPrompt = wNextPrompt;
wNextPrompt = function () {
  if (!LAB && wLinksLive() && !WLKG.asked && !WGL && !WD && !WG.cardOffer && !WG.event && wActive()) {
    WLKG.asked = true;
    const L = WG.lkg.live, sn = L.snap;
    const close = modal(`<header><h3>A golf match is waiting</h3></header><div class="wmsg"><p>Your match against ${esc(wBallName(L.world.club))} is where you left it${sn ? `: ${esc(wLinksScore(sn))}` : ''}.</p><p class="hint">You can also pick it up later from the Links tab on the Team screen.</p></div>
      <div class="row"><button class="btn" id="wLkRes">Resume</button><button class="ghost" id="wLkLater">Later</button></div>`, () => wDrain());
    $('wLkRes').focus();
    $('wLkRes').onclick = () => { close(); wResumeLinks(); };
    $('wLkLater').onclick = () => close();
    return true;
  }
  return wW107NextPrompt();
};

/* ---------- the Links tab: Play a match, Resume, and the last matches ---------- */
const wW107CampLinks = wCampLinks;
wCampLinks = function (C) {
  const html = wW107CampLinks(C), probs = wLinksProblems(), live = wLinksLive();
  const play = live ? `<button class="btn" data-lkresume>Resume the match</button>` : `<button class="btn" data-lkplay ${probs.length ? 'disabled' : ''}>Play a match</button>`;
  const gate = !live && probs.length ? `<p class="hint wball">${esc(probs[0])}</p>` : '';
  return html.replace('<button class="btn" data-gpractice', `${play}<button class="ghost" data-gpractice`).replace(/<\/div>\s*$/, `</div>${gate}${wLinksRecent()}`);
};
function wLinksRecent() {
  const B = WG.lkg; if (!B || !B.games.length) return '';
  return `<h5 class="wbrh">Last golf matches: ${B.w}&ndash;${B.l}</h5><ol class="wstlog">${B.games.slice(0, 5).map(g => `<li><b class="${g.r === 'win' ? 'wgood' : 'wbad'}">${g.r === 'win' ? 'Won' : 'Lost'}</b>${g.text ? ' ' + esc(g.text) : ''} against ${esc(g.name)}${g.wild ? ' (a wild nine)' : ''}<small>day ${g.day}${g.mvp != null && wPlayer(g.mvp) ? `, player of the match ${esc(wPlayer(g.mvp).n)}` : ''}</small></li>`).join('')}</ol>`;
}
const wW107RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW107RenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'links') return;
  const p = body.querySelector('[data-lkplay]'); if (p) p.onclick = () => { WCAMP.close(); wOpenLinksCard(); };
  const r = body.querySelector('[data-lkresume]'); if (r) r.onclick = () => { WCAMP.close(); wResumeLinks(); };
};

/* ---------- lines: the Stats tab's Golf view adds them after the ratings; a player's card says them in words ---------- */
function wLinksLine(pid) { return (WG.lkstats || {})[pid] || null; }
const W_LK_LCOLS = [['rd', 'Rds', 'Golf matches played'], ['shots', 'Shots', 'Shots hit'], ['putts', 'Putts', 'Putts'], ['holed', 'In', 'Holed: the shot that dropped']];
const wW107CampStats = wCampStats;
wCampStats = function () {
  const html = wW107CampStats();
  if (WSTAT.view !== 'golf') return html;
  // (each row gets the line's cells after the ratings; a player with no match yet shows dashes)
  const head = W_LK_LCOLS.map(([c, s, l]) => `<th scope="col" title="${esc(l)}">${s}</th>`).join('');
  return html.replace(/(<thead><tr>[\s\S]*?)(<\/tr><\/thead>)/, `$1${head}$2`)
    .replace(/(<tr data-wsp="(\d+)"[^>]*>[\s\S]*?)(<\/tr>)/g, (m, a, id, end) => { const L = wLinksLine(+id); return a + W_LK_LCOLS.map(([c]) => `<td>${L ? L[c] || 0 : '<span class="dim">&ndash;</span>'}</td>`).join('') + end; })
    .replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Every player\'s golf ratings, their role in your four (set on the Links tab), and every golf match they played from the world on this journey (rounds and practice are not counted). Pick a heading to sort, a player to see more.</small>');
};
const wW107StatsCard = wStatsCard;
wStatsCard = function (p) {
  const L = wLinksLine(p.id), html = wW107StatsCard(p);
  if (!L || !L.rd) return html;
  const bits = `${L.rd} golf match${L.rd === 1 ? '' : 'es'}: ${L.shots} shot${L.shots === 1 ? '' : 's'}, ${L.putts} putt${L.putts === 1 ? '' : 's'}, ${L.holed} holed`;
  return html.replace('<div class="wbd wbkc wglc"><h5>Golf</h5>', `<div class="wbd wbkc wglc"><h5>Golf</h5><p class="wbdbox">${bits}.</p>`);
};

const wW107RenderHelp = renderHelp;
renderHelp = function () {
  wW107RenderHelp();
  const after = $('wHelpLinksTab'); if (!after || $('wHelpLinksGame')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLinksGame"><b>Golf matches.</b> Once you have ${W_LKG.minOwn} players of your own, your four can play golf for real: Play a match on the Links tab, or ask Agatha Divot at Mossgate Links for a MATCH. Take on the local side or a rival club, once a day each, on the standing nine (or tick Wild nine for a new course). Play (you swing every shot), Manage (you call the line, the stances and the caddie's word, and pick the next hitter if you like; your four swing) or Simulate. There is no Team HP on the course. A win pays XP to everyone who played (half to the rest), gold and fans, and a little more to the player of the match; a loss pays a quarter of the XP. Nobody goes home level. Save and leave keeps a match between shots. The Links has its own ways: the weather of the wood changes by the day (a still morning, a breeze, a drizzle that softens the greens, or a spore haze that shortens your reads); a ball that stops by the bees' hive comes back with a sting (its hitter loses focus); and the Gloomcap on its stump never moves, so of course it moved your ball. The Stats tab's Golf view has every player's line.</p>`);
};
