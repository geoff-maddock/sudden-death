/* w84: the Charter Net, and league fixtures at the Charter Court on the court (issue #77, phase 9).
   The Charter Net is basketball's own cup, as the Cinder Cup (w46) is football's: every week at the Charter Court (ask
   Nim Hoopwright about the NET, or use the button on the Court tab or the game card). Eight fives in a bracket: you,
   rival clubs and the regions' own sides. Three rounds, each one harder (the tier, so their level and their coach's
   skill, goes up with the round). You play your own games (Play, Manage or Simulate, as any basketball game) and the
   rest of each round is simulated on the same engine once yours is done. A game still level after three overtimes goes
   to the side with more rebounds. Lose and you're out; the rest of the bracket is played to a champion. Win the final
   and you cut down the net and keep it: gold, fans, a pick of basketball cards, a piece of court gear you don't have
   (W_COURT_KIT.cup; gold once you have them all), a line in the journal and a place on the Wall of Awards.
   League fixtures at the Court (w24): your fixture there is a basketball game on the court (Play, Manage or Simulate)
   instead of a card match, and the clubs' own fixtures there are played on the engine, with real scores. A win is two
   points on the table and the fixture's fans, a tie is no points, and either way the fixture is done.

   WG.bkcup  { week, field: [8 ids, 'me' first], round: 0..2, games: [[{ a, b, ra, rb, w, ba?, bb?, tb }]] by round,
               pending, show, out, done, champ } or null; ba, bb: each side's rebounds; tb: level at the end, settled
               on the rebounds. A concede is a loss. Plain JSON, as WG.gcup.
   WG.bkcupWins, WG.bkcupLog: [{ year, day }]
   W_NET     the numbers; W_NET.force ('win' | 'lose') settles your next cup game that way (tests and the bot)
   wNetEnter(), wNetPlay(how), wNetCatchUp(), wOpenNet(), wNetWon(), wCourtSimClubs(a, b, tier), wBkfixPlay(how),
   W_ON_END.bkcup, W_ON_END.bkfix
   Wrapped: wNextPrompt (wW84NextPrompt: the rest of the round, then the bracket), wCampCourt and wRenderCamp
   (wW84CampCourt, wW84RenderCamp: a Charter Net button), wOpenCourtCard (wW84OpenCourtCard: the cup and your fixture),
   wOpenGrdCard (wW84OpenGrdCard: the Court's fixture row plays on the court), wSimAt (wW84SimAt: the clubs' games at
   the Court on the engine), wRunAct (wW84RunAct: 'bknet'), wWallText (wW84WallText), renderHelp (wW84RenderHelp:
   #wHelpCourtNet). */

const W_NET = {
  fee: 40, size: 8,
  tiers: [1, 2, 3],               // the tier of each round: the coach a Squire, a Knight, an Archmage
  rounds: ['Quarter-final', 'Semi-final', 'Final'],
  prize: { gold: 150, fans: 20, pick: 3 },
  force: null
};
const W_BKFIX = { court: 'g_court', tier: 2 };

function wNet() { return (WG && WG.bkcup) || null; }
function wNetOn() { const D = wNet(); return !!(D && !D.done); }
function wNetName(id) { return id === 'me' ? 'your five' : wBallName(id); }
function wNetTeamName(id) { return id === 'me' ? wPartyTeam().name : (wBallTeam(id) || {}).name || id; }
function wNetPairs(r) {
  const D = wNet(); let ids = D.field.slice();
  for (let i = 0; i < r; i++) ids = (D.games[i] || []).map(g => g.w);
  const out = []; for (let i = 0; i + 1 < ids.length; i += 2) out.push([ids[i], ids[i + 1]]);
  return out;
}
function wNetGame(r, a, b) { return ((wNet().games[r]) || []).find(g => (g.a === a && g.b === b) || (g.a === b && g.b === a)) || null; }
function wNetMine() { const D = wNet(); if (!D || D.out || D.done) return null; const p = wNetPairs(D.round).find(x => x.includes('me')); return p && !wNetGame(D.round, p[0], p[1]) ? p.find(x => x !== 'me') : null; }
const wNetLive = () => wCourtLive() && WG.bkg.live.world.kind === 'bkcup';

function wNetProblems() {
  const D = wNet(), out = wCourtProblems();
  if (D && !D.done) return out;
  const left = 7 - ((WG.dayAbs - 1) % 7);
  if (D && D.week === wWeek()) out.push(`The Charter Net is held once a week. The next one opens in ${left} day${left === 1 ? '' : 's'}.`);
  if (RUN.gold < W_NET.fee) out.push(`The entry fee is ${W_NET.fee} gold, and you have ${RUN.gold}.`);
  if (wCourtLive()) out.push('Finish the basketball game you started first.');
  return out;
}
// the field: your rivals (four at most), then the regions' own sides, in a random draw with you at the top
function wNetEnter() {
  const probs = wNetProblems(); if (probs.length) return probs.join(' ');
  const rivals = shuffle(Object.values(WG.rivals || {}).filter((c, i, a) => CLUBS[c] && a.indexOf(c) === i)).slice(0, 4);
  const wild = shuffle(Object.keys(W_WILD_TEAM).map(r => 'wild:' + r));
  const others = shuffle(rivals.concat(wild).slice(0, W_NET.size - 1));
  RUN.gold -= W_NET.fee;
  WG.bkcup = { week: wWeek(), field: ['me'].concat(others), round: 0, games: [[], [], []], pending: false, show: false, out: false, done: false, champ: null };
  wLog(`You enter the Charter Net (${W_NET.fee} gold). ${W_NET.rounds[0]}: ${wNetName(wNetMine())}.`, 'g');
  wSave();
  return '';
}
function wNetPlay(how) {
  const D = wNet(), opp = wNetMine(); if (!opp) return '';
  return wStartCourt({ club: opp, how, tier: W_NET.tiers[D.round], kind: 'bkcup', ref: { week: D.week, round: D.round }, cup: true });
}
// who goes through: the score, then (still level after three overtimes) the rebounds, then the toss of a coin
const wNetWinner = (a, b, ra, rb, ba, bb) => ra !== rb ? (ra > rb ? a : b) : ba !== bb ? (ba > bb ? a : b) : (Math.random() < .5 ? a : b);
// your game's result; the rest of the round waits until you are back in the world (wNetCatchUp)
W_ON_END.bkcup = function (r, ref, W) {
  const D = wNet(); if (!D || !ref || D.done || ref.week !== D.week || ref.round !== D.round) return;
  const forced = W_NET.force; W_NET.force = null;
  const [ba, bb] = W.reb || [0, 0];
  // (a win or a loss is the result: conceding loses whatever the score; only a tie goes to the rebounds)
  const rr = forced || r, tb = rr === 'tie';
  const w = rr === 'win' ? 'me' : rr === 'lose' ? W.club : wNetWinner('me', W.club, W.us, W.them, ba, bb), win = w === 'me';
  D.games[D.round].push({ a: 'me', b: W.club, ra: W.us, rb: W.them, ba, bb, w, tb });
  if (!win) D.out = true;
  D.pending = true;
  const how = tb ? ` (level, and ${win ? 'you' : 'they'} had more rebounds)` : '';
  wLog(win ? `${W_NET.rounds[D.round]} won: ${W.us}–${W.them} against ${wNetName(W.club)}${how}.` : `Out of the Charter Net in the ${W_NET.rounds[D.round].toLowerCase()}, ${W.us}–${W.them} to ${wNetName(W.club)}${how}.`, win ? 'g' : 'b');
};
// a game you are not in, on the same engine, both sides on the coaches (and your own game, if one is on, kept). The
// squads are made for this game only: the one a rival keeps for its games against you (WG.bkg.opp) is left as it was
function wCourtSimClubs(a, b, tier) {
  const B = wBkg(), kept = Object.assign({}, B.opp), teams = [wCourtOpp(a, tier), wCourtOpp(b, tier)];
  B.opp = kept;
  const sk = wCourtSkill(tier)[1], s = wBK.simGame({ teams, skill: [sk, sk], mins: wCourtMins(), court: true, keep: true });
  return { ra: s.score[0], rb: s.score[1], ba: s.box[0].tot.reb, bb: s.box[1].tot.reb };
}
function wNetSim(a, b, tier) {
  const s = wCourtSimClubs(a, b, tier);
  return { a, b, ra: s.ra, rb: s.rb, ba: s.ba, bb: s.bb, w: wNetWinner(a, b, s.ra, s.rb, s.ba, s.bb), tb: s.ra === s.rb };
}
// the rest of the round: every game without a result; then the next round, and on to the final if you are out
function wNetCatchUp() {
  const D = wNet(); if (!D || !D.pending || wCourtLive() || UI.view === 'court') return false;
  for (;;) {
    for (const [a, b] of wNetPairs(D.round)) if (!wNetGame(D.round, a, b)) D.games[D.round].push(wNetSim(a, b, W_NET.tiers[D.round]));
    if (D.round === W_NET.rounds.length - 1) { D.done = true; D.champ = D.games[D.round][0].w; break; }
    D.round++;
    if (!D.out) break;
  }
  D.pending = false; D.show = true;
  if (D.done && D.champ === 'me') wNetWon();
  else if (D.done) wLog(`${wCap(wNetName(D.champ))} win the Charter Net.`, 'd');
  else wLog(`The ${W_NET.rounds[D.round - 1].toLowerCase()}s are in. ${W_NET.rounds[D.round]}: ${wNetName(wNetMine())}.`, 'g');
  wSave();
  return true;
}
function wNetWon() {
  const P = W_NET.prize, D = wNet(), f = D.games[2][0];
  RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans;
  WG.bkcupWins = (WG.bkcupWins || 0) + 1;
  WG.bkcupLog = (WG.bkcupLog || []).concat({ year: WG.year, day: WG.day });
  wLog(`You win the Charter Net! Your five cut it down and keep it, and it goes up on the Wall of Awards. ${P.gold} gold and ${P.fans} fans.`, 'g');
  try { wJAddWin({ at: wJStamp(), where: wJWhere(), k: 'title', t: 'Won the Charter Net', opp: wNetTeamName(f.a === 'me' ? f.b : f.a), sport: 'basketball', score: f.a === 'me' ? `${f.ra}–${f.rb}` : `${f.rb}–${f.ra}` }); } catch (e) { console.error(e); }
  // the first piece of court gear you don't have yet
  const have = id => (WG.items[id] || 0) > 0 || wRoster().some(p => p.gear && p.gear.court === id);
  const id = W_COURT_KIT.cup.find(x => !have(x));
  if (id) { wAddItem(id, 1); wLog(`The Net comes with gear: the ${W_COURT_GEAR[id].name}. ${W_COURT_GEAR[id].desc}`, 'g'); }
  else { RUN.gold += W_COURT_KIT.cupGold; wLog(`You have every piece of court gear, so the Net pays ${W_COURT_KIT.cupGold} gold more instead.`, 'g'); }
  const pool = wSportPool(['basketball']);
  wGainCard(pool.length >= P.pick ? { pick: P.pick, pool } : { pick: P.pick, rarity: 'r' }, 'the Charter Net prize');
}

/* ---------- the card: entry, the bracket, your next game ---------- */
function wNetBracket() {
  const D = wNet();
  const cell = (r, a, b) => {
    const g = wNetGame(r, a, b), tie = g && g.tb;
    const row = id => `<li class="${id === 'me' ? 'wme' : ''}${g && g.w === id ? ' wwon' : g ? ' wlost' : ''}"><span>${esc(wNetTeamName(id))}</span><b>${g ? (g.a === id ? g.ra : g.rb) : ''}${tie && g.w === id ? '*' : ''}</b></li>`;
    return `<ol class="wdcg">${row(a)}${row(b)}</ol>`;
  };
  return `<div class="wdcb">${W_NET.rounds.map((n, r) => `<div><h5>${n}</h5>${r <= D.round || D.done ? wNetPairs(Math.min(r, 2)).map(([a, b]) => cell(r, a, b)).join('') : '<p class="dim">To come.</p>'}</div>`).join('')}</div>
    ${D.games.some(R => R.some(g => g.tb)) ? '<p class="hint">* Level after three overtimes: through on rebounds.</p>' : ''}`;
}
function wOpenNet(msg) {
  if (LAB || !WG) return;
  wNetCatchUp();
  if (WG.cardOffer) { if ($('modal').hidden) wShowCardOffer(); return; }
  if (WG.bkcup) WG.bkcup.show = false;
  const D = wNet(), on = wNetOn(), probs = wNetProblems(), opp = on && wNetMine(), live = wNetLive();
  let body;
  if (!on) {
    body = `<p>Eight fives, three rounds: the quarter-finals, the semi-finals and the final. Basketball at the Charter Court, with your five and your bench. Rival clubs and the regions' own sides enter. Each round is harder than the last. Lose once and you're out; a game still level after three overtimes goes to the side with more rebounds.</p>
      <p class="hint">Entry ${W_NET.fee} gold. Win it and your five cut down the net and keep it: ${W_NET.prize.gold} gold, ${W_NET.prize.fans} fans, a pick of ${W_NET.prize.pick} basketball cards, a piece of court gear and a place on the Wall of Awards. Every game also pays as a basketball game does. One cup a week.${WG.bkcupWins ? ` You have won it ${WG.bkcupWins} time${WG.bkcupWins === 1 ? '' : 's'}.` : ''}</p>
      ${D && D.done ? `<h5>Last week's bracket</h5>${wNetBracket()}` : ''}
      ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
      <div class="row"><button class="btn" id="wNetEnter" ${probs.length ? 'disabled' : ''}>Enter (${W_NET.fee} gold)</button></div>`;
  } else {
    const tier = W_NET.tiers[D.round], h = opp && wCourtH2h(opp);
    const next = live ? `<p>Your ${W_NET.rounds[D.round].toLowerCase()} against ${esc(wNetName(WG.bkg.live.world.club))} is waiting.</p><div class="row"><button class="btn" id="wNetRes">Resume the game</button></div>`
      : opp ? `<p><b>${W_NET.rounds[D.round]}</b> against ${esc(wNetName(opp))}: their players are level ${wBallOppLvl(tier)}, the coach a ${W_BALL_SKILL[wCourtSkill(tier)[1]]}.${h ? ` Last basketball game: ${h.r === 'win' ? 'won' : h.r === 'tie' ? 'tied' : 'lost'} ${h.us}–${h.them}.` : ''}</p>
        ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
        <div class="row">${Object.keys(W_BKG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-nethow="${how}" ${probs.length ? 'disabled' : ''}>${W_BKG_HOW[how]}</button>`).join('')}</div>` : '';
    body = `${next}${wNetBracket()}`;
  }
  const close = modal(`<header><h3>The Charter Net</h3><button class="ghost" data-close>Done</button></header>${msg ? `<p class="wbad">${esc(msg)}</p>` : ''}${body}`, () => wDrain());
  const again = r => { close(); wOpenNet(r); };
  if ($('wNetEnter')) $('wNetEnter').onclick = () => again(wNetEnter());
  if ($('wNetRes')) $('wNetRes').onclick = () => { close(); wResumeCourt(); };
  $('modalBox').querySelectorAll('[data-nethow]').forEach(b => b.onclick = () => {
    // (after Simulate, the Final card first; closing it brings the bracket back, through wNextPrompt)
    close(); const r = wNetPlay(b.dataset.nethow); if (r) wOpenNet(r);
  });
}
// back in the world after your game: the rest of the round, then the bracket
const wW84NextPrompt = wNextPrompt;
wNextPrompt = function () {
  const D = wNet();
  if (!LAB && D && (D.pending || D.show) && !wCourtLive() && UI.view !== 'court' && wActive() && !WG.cardOffer && !WG.event) { wOpenNet(); return true; }
  if (LAB && D && D.pending) wNetCatchUp();
  return wW84NextPrompt();
};

/* ---------- league fixtures at the Court, on the court ---------- */
const wBkfixHere = () => wFixHere(W_BKFIX.court) || null;
function wBkfixPlay(how) {
  const f = wBkfixHere(); if (!f) return 'Your league fixture is not at the Charter Court.';
  return wStartCourt({ club: f.club, how, tier: wFixTier(f.club, W_BKFIX.court), kind: 'bkfix', ref: { g: W_BKFIX.court, club: f.club, day: f.day }, cup: true });
}
// the fixture's end: as a fixture at any ground (w24's W_ON_END.ground), with the basketball score; a rival's league
// row, and the head to head of any club in CLUBS, are counted in wCourtSettle already
W_ON_END.bkfix = function (r, ref, W) {
  if (!ref) return;
  const L = wLeague(), F = wFixtures(), club = ref.club, tie = r === 'tie';
  const f = F.games.find(x => (x.a === club && x.b === 'me') || (x.a === 'me' && x.b === club));
  // a game saved and finished after its round day: the fixture was postponed, so it's a game like any other now
  if (F.day !== ref.day || !f || f.done) { wLog('That fixture was postponed on its round day, so this game is no longer the fixture: it counts as any other game.', 'd'); return; }
  f.done = 1;
  if (tie) { wLog('A tie in the league at the Charter Court: no points for either side.', 'd'); return; }
  if (!wIsRival(club)) { wLeagueMine(r); if (!CLUBS[club]) wH2hRecord(club, r, { us: W.us, them: W.them, sport: 'basketball' }); }
  if (L.table[club]) { if (r === 'win') L.table[club].l++; else L.table[club].w++; }
  const res = r === 'win' ? { a: 'me', b: club, sa: W.us, sb: W.them } : { a: club, b: 'me', sa: W.them, sb: W.us };
  L.results.unshift(Object.assign(res, { day: WG.dayAbs, sport: 'basketball', g: ref.g }));
  L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  if (r === 'win') {
    RUN.fans = (RUN.fans || 0) + W_FIX.fans;
    wLog(`Two points on the table. The walled yard stays to sing: ${W_FIX.fans} fans.`, 'g');
    wMaybeBid(club);
  }
};
// the clubs' own fixtures at the Court: played on the engine, a level game going to the rebounds
const wW84SimAt = wSimAt;
wSimAt = function (a, b, g) {
  if (g !== W_BKFIX.court || LAB) return wW84SimAt(a, b, g);
  const L = wLeague(), s = wCourtSimClubs(a, b, W_BKFIX.tier), w = wNetWinner(a, b, s.ra, s.rb, s.ba, s.bb), l = w === a ? b : a;
  L.table[w].w++; L.table[l].l++;
  const res = { day: WG.dayAbs, a: w, b: l, sport: 'basketball', sa: Math.max(s.ra, s.rb), sb: Math.min(s.ra, s.rb), g };
  L.results.unshift(res); L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  return res;
};
// the Court's ground card: the fixture row plays on the court, with Play, Manage and Simulate
const wW84OpenGrdCard = wOpenGrdCard;
wOpenGrdCard = function (id, msg) {
  wW84OpenGrdCard(id, msg);
  if (id !== W_BKFIX.court) return;
  const b = document.querySelector('#modalBox [data-gfix]'), f = wBkfixHere(); if (!b || !f) return;
  const probs = wCourtProblems().concat(wCourtLive() ? ['Finish the basketball game you started first.'] : []), row = b.closest('.row');
  row.innerHTML = Object.keys(W_BKG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-bkfixhow="${how}" ${probs.length ? 'disabled' : ''}>${W_BKG_HOW[how]}</button>`).join('');
  const small = row.closest('li').querySelector('small'); if (small) small.insertAdjacentHTML('beforeend', ` Played on the court with your five.${probs.length ? ' ' + esc(probs[0]) : ''}`);
  row.querySelectorAll('[data-bkfixhow]').forEach(x => x.onclick = () => { $('modalBox').querySelector('[data-close]').click(); const r = wBkfixPlay(x.dataset.bkfixhow); if (r) wOpenGrdCard(id, r); });
};

/* ---------- where it is: the Court, the Court tab, the game card ---------- */
{
  const K = DB.chars.gk_court;
  if (K) { K.topics.net = { t: 'The Charter Net: eight fives and three rounds, every week, on these boards. Win the final and you cut the net down yourselves and take it home. I hang a new one. I take the entries.', act: 'bknet' }; K.topics.job.t += ' I run the Charter NET too.'; }
}
const wW84RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'bknet') return wOpenNet(); return wW84RunAct.apply(this, arguments); };
const wNetBtn = () => `<button class="ghost" data-bknet>Charter Net${wNetOn() ? ` (${W_NET.rounds[wNet().round].toLowerCase()})` : ''}</button>`;
const wW84CampCourt = wCampCourt;
wCampCourt = function (C) { return wW84CampCourt(C).replace('<button class="ghost" data-kpractice', `${wNetBtn()}<button class="ghost" data-kpractice`); };
const wW84RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW84RenderCamp();
  const b = $('wCampBody') && WCAMP.tab === 'court' && $('wCampBody').querySelector('[data-bknet]');
  if (b) b.onclick = () => { WCAMP.close(); wOpenNet(); };
};
const wW84OpenCourtCard = wOpenCourtCard;
wOpenCourtCard = function () {
  wW84OpenCourtCard();
  const list = document.querySelector('#modalBox .wbclubs'); if (!list) return;
  const f = wBkfixHere();
  list.insertAdjacentHTML('afterend', `<p class="hint">The Charter Net: eight fives, every week. ${wNetBtn()}${f ? ` Your league fixture against ${esc(wTheClub(f.club))} is here at the Charter Court, by day ${f.day}: play it from the ground's GAME card.` : ''}</p>`);
  const b = $('modalBox').querySelector('[data-bknet]'); if (b) b.onclick = () => { $('modalBox').querySelector('[data-close]').click(); wOpenNet(); };
};
const wW84WallText = wWallText;
wWallText = function () {
  wW84WallText();
  if (WG.bkcupWins) wLog(`Hung from a nail: the Charter Net${WG.bkcupWins > 1 ? `, ${WG.bkcupWins} of them` : ''}, cut down by your own five.`, 'g');
};
const wW84RenderHelp = renderHelp;
renderHelp = function () {
  wW84RenderHelp();
  const g = $('wHelpCourtStars') || $('wHelpCourtKit') || $('wHelpCourtGame'); if (!g || $('wHelpCourtNet')) return;
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpCourtNet"><b>The Charter Net.</b> Basketball's cup, every week at the Charter Court: ask Nim Hoopwright about the NET, or use the Charter Net button on the Court tab. ${W_NET.fee} gold to enter. Eight fives in a bracket, three rounds, each harder than the last; you play your own games and the rest are played out on the court once yours is done. A game still level after three overtimes goes to the side with more rebounds. Lose and you're out. Win the final and your five cut down the net and keep it: ${W_NET.prize.gold} gold, ${W_NET.prize.fans} fans, a pick of basketball cards, a piece of court gear and a place on the Wall of Awards. League fixtures at the Charter Court are basketball games on the court too: Play, Manage or Simulate, a win is two points on the table, and a tie none.</p>`);
};
