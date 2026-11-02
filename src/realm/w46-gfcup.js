/* w46: the Cinder Cup, and league fixtures at the Ash Bowl on the gridiron (issue #9, phase 7).
   The Cinder Cup is football's own cup, as the Diamond Cup (w20e) is baseball's: every week at the Ash Bowl (ask
   Clinker Dunn about the CINDER cup, or use the button on the Seven tab or the game card). Eight sevens in a bracket:
   you, rival clubs and the regions' own sides. Three rounds, each one harder (the tier, so their level and their CPU
   skill, goes up with the round). You play your own games (Play, Manage or Simulate, as any football game) and the
   rest of each round is simulated on the same engine once yours is done. A tie after Sudden Death goes to the side
   with more yards from scrimmage. Lose and you're out; the rest of the bracket is played to a champion. Win the final
   for gold, fans, a pick of football cards, a line in the journal and a place on the Wall of Awards.
   League fixtures at the Bowl (w24): your fixture there is a football game on the gridiron (Play, Manage or Simulate)
   instead of a card match, and the clubs' own fixtures there are played on the engine, with real scores. A win is
   two points on the table and the fixture's fans, a tie is no points, and either way the fixture is done.

   WG.gcup  { week, field: [8 ids, 'me' first], round: 0..2, games: [[{ a, b, ra, rb, w, ya?, yb?, yd }]] by round,
              pending, show, out, done, champ } or null; yd: settled on the yards (a tie). A concede is a loss. Plain JSON, as WG.dcup.
   W_GCUP   the numbers; W_GCUP.force ('win' | 'lose') settles your next cup game that way (tests and the bot)
   wGcupEnter(), wGcupPlay(how), wGcupCatchUp(), wOpenGcup(), wGfixPlay(how), W_ON_END.gcup, W_ON_END.gfix
   Wrapped: wNextPrompt (wW46NextPrompt: the rest of the round, then the bracket), wCampSeven and wRenderCamp
   (wW46CampSeven, wW46RenderCamp: a Cinder Cup button), wOpenGridCard (wW46OpenGridCard: the cup and your fixture),
   wOpenGrdCard (wW46OpenGrdCard: the Bowl's fixture row plays on the gridiron), wSimAt (wW46SimAt: the clubs' games
   at the Bowl on the engine), wRunAct (wW46RunAct: 'gcup'), wWallText, renderHelp (#wHelpGcup). */

const W_GCUP = {
  fee: 40, size: 8,
  tiers: [1, 2, 3],               // the tier of each round: CPU skill Squire, Knight, Archmage
  rounds: ['Quarter-final', 'Semi-final', 'Final'],
  prize: { gold: 150, fans: 20, pick: 3 },
  force: null
};
const W_GFIX = { bowl: 'g_bowl', tier: 2 };

function wGcup() { return (WG && WG.gcup) || null; }
function wGcupOn() { const D = wGcup(); return !!(D && !D.done); }
function wGcupName(id) { return id === 'me' ? 'your seven' : wBallName(id); }
function wGcupTeamName(id) { return id === 'me' ? wPartyTeam().name : (wBallTeam(id) || {}).name || id; }
function wGcupPairs(r) {
  const D = wGcup(); let ids = D.field.slice();
  for (let i = 0; i < r; i++) ids = (D.games[i] || []).map(g => g.w);
  const out = []; for (let i = 0; i + 1 < ids.length; i += 2) out.push([ids[i], ids[i + 1]]);
  return out;
}
function wGcupGame(r, a, b) { return ((wGcup().games[r]) || []).find(g => (g.a === a && g.b === b) || (g.a === b && g.b === a)) || null; }
function wGcupMine() { const D = wGcup(); if (!D || D.out || D.done) return null; const p = wGcupPairs(D.round).find(x => x.includes('me')); return p && !wGcupGame(D.round, p[0], p[1]) ? p.find(x => x !== 'me') : null; }
const wGcupLive = () => wGridLive() && WG.gfg.live.world.kind === 'gcup';

function wGcupProblems() {
  const D = wGcup(), out = wGridProblems();
  if (D && !D.done) return out;
  const left = 7 - ((WG.dayAbs - 1) % 7);
  if (D && D.week === wWeek()) out.push(`The Cinder Cup is held once a week. The next one opens in ${left} day${left === 1 ? '' : 's'}.`);
  if (RUN.gold < W_GCUP.fee) out.push(`The entry fee is ${W_GCUP.fee} gold, and you have ${RUN.gold}.`);
  if (wGridLive()) out.push('Finish the football game you started first.');
  return out;
}
// the field: your rivals (four at most), then the regions' own sides, in a random draw with you at the top
function wGcupEnter() {
  const probs = wGcupProblems(); if (probs.length) return probs.join(' ');
  const rivals = shuffle(Object.values(WG.rivals || {}).filter((c, i, a) => CLUBS[c] && a.indexOf(c) === i)).slice(0, 4);
  const wild = shuffle(Object.keys(W_WILD_TEAM).map(r => 'wild:' + r));
  const others = shuffle(rivals.concat(wild).slice(0, W_GCUP.size - 1));
  RUN.gold -= W_GCUP.fee;
  WG.gcup = { week: wWeek(), field: ['me'].concat(others), round: 0, games: [[], [], []], pending: false, show: false, out: false, done: false, champ: null };
  wLog(`You enter the Cinder Cup (${W_GCUP.fee} gold). ${W_GCUP.rounds[0]}: ${wGcupName(wGcupMine())}.`, 'g');
  wSave();
  return '';
}
function wGcupPlay(how) {
  const D = wGcup(), opp = wGcupMine(); if (!opp) return '';
  return wStartGrid({ club: opp, how, tier: W_GCUP.tiers[D.round], kind: 'gcup', ref: { week: D.week, round: D.round }, cup: true });
}
// who goes through: the score, then (a tie after Sudden Death) the yards from scrimmage, then the toss of a coin
const wGcupWinner = (a, b, ra, rb, ya, yb) => ra !== rb ? (ra > rb ? a : b) : ya !== yb ? (ya > yb ? a : b) : (Math.random() < .5 ? a : b);
// your game's result; the rest of the round waits until you are back in the world (wGcupCatchUp)
W_ON_END.gcup = function (r, ref, W) {
  const D = wGcup(); if (!D || !ref || D.done || ref.week !== D.week || ref.round !== D.round) return;
  const forced = W_GCUP.force; W_GCUP.force = null;
  const [ya, yb] = W.yards || [0, 0];
  // (a win or a loss is the result: conceding loses whatever the score; only a tie goes to the yards)
  const rr = forced || r, yd = rr === 'tie';
  const w = rr === 'win' ? 'me' : rr === 'lose' ? W.club : wGcupWinner('me', W.club, W.us, W.them, ya, yb), win = w === 'me';
  D.games[D.round].push({ a: 'me', b: W.club, ra: W.us, rb: W.them, ya, yb, w, yd });
  if (!win) D.out = true;
  D.pending = true;
  const tb = yd ? ` (tied, and ${win ? 'you' : 'they'} had more yards)` : '';
  wLog(win ? `${W_GCUP.rounds[D.round]} won: ${W.us}–${W.them} against ${wGcupName(W.club)}${tb}.` : `Out of the Cinder Cup in the ${W_GCUP.rounds[D.round].toLowerCase()}, ${W.us}–${W.them} to ${wGcupName(W.club)}${tb}.`, win ? 'g' : 'b');
};
// a game you are not in, on the same engine, both sides on the coaches (and your own game, if one is on, kept)
function wGridSimClubs(a, b, tier) {
  const sk = wGridSkill(tier)[1], g = wGF.simGame({ teams: [wGridOpp(a, tier), wGridOpp(b, tier)], skill: [sk, sk], keep: true });
  const yd = s => g.box.filter(x => x.side === s).reduce((t, x) => t + (x.line.py || 0) + (x.line.ry || 0), 0);
  return { ra: g.score[0], rb: g.score[1], ya: yd(0), yb: yd(1) };
}
function wGcupSim(a, b, tier) {
  const s = wGridSimClubs(a, b, tier);
  return { a, b, ra: s.ra, rb: s.rb, ya: s.ya, yb: s.yb, w: wGcupWinner(a, b, s.ra, s.rb, s.ya, s.yb), yd: s.ra === s.rb };
}
// the rest of the round: every game without a result; then the next round, and on to the final if you are out
function wGcupCatchUp() {
  const D = wGcup(); if (!D || !D.pending || wGridLive() || UI.view === 'gridiron') return false;
  for (;;) {
    for (const [a, b] of wGcupPairs(D.round)) if (!wGcupGame(D.round, a, b)) D.games[D.round].push(wGcupSim(a, b, W_GCUP.tiers[D.round]));
    if (D.round === W_GCUP.rounds.length - 1) { D.done = true; D.champ = D.games[D.round][0].w; break; }
    D.round++;
    if (!D.out) break;
  }
  D.pending = false; D.show = true;
  if (D.done && D.champ === 'me') wGcupWon();
  else if (D.done) wLog(`${wCap(wGcupName(D.champ))} win the Cinder Cup.`, 'd');
  else wLog(`The ${W_GCUP.rounds[D.round - 1].toLowerCase()}s are in. ${W_GCUP.rounds[D.round]}: ${wGcupName(wGcupMine())}.`, 'g');
  wSave();
  return true;
}
function wGcupWon() {
  const P = W_GCUP.prize, D = wGcup(), f = D.games[2][0];
  RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans;
  WG.gcupWins = (WG.gcupWins || 0) + 1;
  WG.gcupLog = (WG.gcupLog || []).concat({ year: WG.year, day: WG.day });
  wLog(`You win the Cinder Cup! It goes up on the Wall of Awards. ${P.gold} gold and ${P.fans} fans.`, 'g');
  try { wJAddWin({ at: wJStamp(), where: wJWhere(), k: 'title', t: 'Won the Cinder Cup', opp: wGcupTeamName(f.b), sport: 'football', score: `${f.ra}–${f.rb}` }); } catch (e) { console.error(e); }
  const pool = wSportPool(['football']);
  wGainCard(pool.length >= P.pick ? { pick: P.pick, pool } : { pick: P.pick, rarity: 'r' }, 'the Cinder Cup prize');
}

/* ---------- the card: entry, the bracket, your next game ---------- */
function wGcupBracket() {
  const D = wGcup();
  const cell = (r, a, b) => {
    const g = wGcupGame(r, a, b), tie = g && g.yd;
    const row = id => `<li class="${id === 'me' ? 'wme' : ''}${g && g.w === id ? ' wwon' : g ? ' wlost' : ''}"><span>${esc(wGcupTeamName(id))}</span><b>${g ? (g.a === id ? g.ra : g.rb) : ''}${tie && g.w === id ? '*' : ''}</b></li>`;
    return `<ol class="wdcg">${row(a)}${row(b)}</ol>`;
  };
  return `<div class="wdcb">${W_GCUP.rounds.map((n, r) => `<div><h5>${n}</h5>${r <= D.round || D.done ? wGcupPairs(Math.min(r, 2)).map(([a, b]) => cell(r, a, b)).join('') : '<p class="dim">To come.</p>'}</div>`).join('')}</div>
    ${D.games.some(R => R.some(g => g.yd)) ? '<p class="hint">* Tied after Sudden Death: through on yards from scrimmage.</p>' : ''}`;
}
function wOpenGcup(msg) {
  if (LAB || !WG) return;
  wGcupCatchUp();
  if (WG.cardOffer) { if ($('modal').hidden) wShowCardOffer(); return; }
  if (WG.gcup) WG.gcup.show = false;
  const D = wGcup(), on = wGcupOn(), probs = wGcupProblems(), opp = on && wGcupMine(), live = wGcupLive();
  let body;
  if (!on) {
    body = `<p>Eight sevens, three rounds: the quarter-finals, the semi-finals and the final. Football on the gridiron at the Ash Bowl, with your seven. Rival clubs and the regions' own sides enter. Each round is harder than the last. Lose once and you're out; a tie after Sudden Death goes to the side with more yards.</p>
      <p class="hint">Entry ${W_GCUP.fee} gold. Win it for ${W_GCUP.prize.gold} gold, ${W_GCUP.prize.fans} fans, a pick of ${W_GCUP.prize.pick} football cards and a place on the Wall of Awards. Every game also pays as a football game does. One cup a week.${WG.gcupWins ? ` You have won it ${WG.gcupWins} time${WG.gcupWins === 1 ? '' : 's'}.` : ''}</p>
      ${D && D.done ? `<h5>Last week's bracket</h5>${wGcupBracket()}` : ''}
      ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
      <div class="row"><button class="btn" id="wGcupEnter" ${probs.length ? 'disabled' : ''}>Enter (${W_GCUP.fee} gold)</button></div>`;
  } else {
    const tier = W_GCUP.tiers[D.round], h = opp && wGridH2h(opp);
    const next = live ? `<p>Your ${W_GCUP.rounds[D.round].toLowerCase()} against ${esc(wGcupName(WG.gfg.live.world.club))} is waiting.</p><div class="row"><button class="btn" id="wGcupRes">Resume the game</button></div>`
      : opp ? `<p><b>${W_GCUP.rounds[D.round]}</b> against ${esc(wGcupName(opp))}: their players are level ${wGridOppLvl(tier)}, CPU skill ${W_BALL_SKILL[wGridSkill(tier)[1]]}.${h ? ` Last football game: ${h.r === 'win' ? 'won' : h.r === 'tie' ? 'tied' : 'lost'} ${h.us}–${h.them}.` : ''}</p>
        ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
        <div class="row">${Object.keys(W_GFG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-gchow="${how}" ${probs.length ? 'disabled' : ''}>${W_GFG_HOW[how]}</button>`).join('')}</div>` : '';
    body = `${next}${wGcupBracket()}`;
  }
  const close = modal(`<header><h3>The Cinder Cup</h3><button class="ghost" data-close>Done</button></header>${msg ? `<p class="wbad">${esc(msg)}</p>` : ''}${body}`, () => wDrain());
  const again = r => { close(); wOpenGcup(r); };
  if ($('wGcupEnter')) $('wGcupEnter').onclick = () => again(wGcupEnter());
  if ($('wGcupRes')) $('wGcupRes').onclick = () => { close(); wResumeGrid(); };
  $('modalBox').querySelectorAll('[data-gchow]').forEach(b => b.onclick = () => {
    // (after Simulate, the Final card first; closing it brings the bracket back, through wNextPrompt)
    close(); const r = wGcupPlay(b.dataset.gchow); if (r) wOpenGcup(r);
  });
}
// back in the world after your game: the rest of the round, then the bracket
const wW46NextPrompt = wNextPrompt;
wNextPrompt = function () {
  const D = wGcup();
  if (!LAB && D && (D.pending || D.show) && !wGridLive() && UI.view !== 'gridiron' && wActive() && !WG.cardOffer && !WG.event) { wOpenGcup(); return true; }
  if (LAB && D && D.pending) wGcupCatchUp();
  return wW46NextPrompt();
};

/* ---------- league fixtures at the Bowl, on the gridiron ---------- */
const wGfixHere = () => { const f = wFixHere(W_GFIX.bowl); return f || null; };
function wGfixPlay(how) {
  const f = wGfixHere(); if (!f) return 'Your league fixture is not at the Ash Bowl.';
  return wStartGrid({ club: f.club, how, tier: wFixTier(f.club, W_GFIX.bowl), kind: 'gfix', ref: { g: W_GFIX.bowl, club: f.club, day: f.day }, cup: true });
}
// the fixture's end: as a fixture at any ground (w24's W_ON_END.ground), with the football score; a rival's league
// row, and the head to head of any club in CLUBS, are counted in wGridSettle already
W_ON_END.gfix = function (r, ref, W) {
  if (!ref) return;
  const L = wLeague(), F = wFixtures(), club = ref.club, tie = r === 'tie';
  const f = F.games.find(x => (x.a === club && x.b === 'me') || (x.a === 'me' && x.b === club)); if (f) f.done = 1;
  if (tie) { wLog(`A tie in the league at the Ash Bowl: no points for either side.`, 'd'); return; }
  if (!wIsRival(club)) { wLeagueMine(r); if (!CLUBS[club]) wH2hRecord(club, r); }
  if (L.table[club]) { if (r === 'win') L.table[club].l++; else L.table[club].w++; }
  const res = r === 'win' ? { a: 'me', b: club, sa: W.us, sb: W.them } : { a: club, b: 'me', sa: W.them, sb: W.us };
  L.results.unshift(Object.assign(res, { day: WG.dayAbs, sport: 'football', g: ref.g }));
  L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  if (r === 'win') {
    RUN.fans = (RUN.fans || 0) + W_FIX.fans;
    wLog(`Two points on the table. The crowd at the Ash Bowl stays to sing: ${W_FIX.fans} fans.`, 'g');
    wMaybeBid(club);
  }
};
// the clubs' own fixtures at the Bowl: played on the engine, a tie going to the yards
const wW46SimAt = wSimAt;
wSimAt = function (a, b, g) {
  if (g !== W_GFIX.bowl || LAB) return wW46SimAt(a, b, g);
  const L = wLeague(), s = wGridSimClubs(a, b, W_GFIX.tier), w = wGcupWinner(a, b, s.ra, s.rb, s.ya, s.yb), l = w === a ? b : a;
  L.table[w].w++; L.table[l].l++;
  const res = { day: WG.dayAbs, a: w, b: l, sport: 'football', sa: Math.max(s.ra, s.rb), sb: Math.min(s.ra, s.rb), g };
  L.results.unshift(res); L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  return res;
};
// the Bowl's ground card: the fixture row plays on the gridiron, with Play, Manage and Simulate
const wW46OpenGrdCard = wOpenGrdCard;
wOpenGrdCard = function (id, msg) {
  wW46OpenGrdCard(id, msg);
  if (id !== W_GFIX.bowl) return;
  const b = document.querySelector('#modalBox [data-gfix]'), f = wGfixHere(); if (!b || !f) return;
  const probs = wGridProblems().concat(wGridLive() ? ['Finish the football game you started first.'] : []), row = b.closest('.row');
  row.innerHTML = Object.keys(W_GFG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-gfixhow="${how}" ${probs.length ? 'disabled' : ''}>${W_GFG_HOW[how]}</button>`).join('');
  const small = row.closest('li').querySelector('small'); if (small) small.insertAdjacentHTML('beforeend', ` Played on the gridiron with your seven.${probs.length ? ' ' + esc(probs[0]) : ''}`);
  row.querySelectorAll('[data-gfixhow]').forEach(x => x.onclick = () => { $('modalBox').querySelector('[data-close]').click(); const r = wGfixPlay(x.dataset.gfixhow); if (r) wOpenGrdCard(id, r); });
};

/* ---------- where it is: the Bowl, the Seven tab, the game card ---------- */
{
  const K = DB.chars.gk_bowl;
  if (K) { K.topics.cinder = { t: 'The Cinder Cup: football on the gridiron, eight sevens and three rounds, every week, right here. Your own seven, mind. I take the entries.', act: 'gcup' }; K.topics.job.t += ' I run the CINDER Cup too.'; }
}
const wW46RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'gcup') return wOpenGcup(); return wW46RunAct.apply(this, arguments); };
const wGcupBtn = () => `<button class="ghost" data-gcup>Cinder Cup${wGcupOn() ? ` (${W_GCUP.rounds[wGcup().round].toLowerCase()})` : ''}</button>`;
const wW46CampSeven = wCampSeven;
wCampSeven = function () { return wW46CampSeven().replace('<button class="ghost" data-gpractice', `${wGcupBtn()}<button class="ghost" data-gpractice`); };
const wW46RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW46RenderCamp();
  const b = $('wCampBody') && WCAMP.tab === 'seven' && $('wCampBody').querySelector('[data-gcup]');
  if (b) b.onclick = () => { WCAMP.close(); wOpenGcup(); };
};
const wW46OpenGridCard = wOpenGridCard;
wOpenGridCard = function () {
  wW46OpenGridCard();
  const list = document.querySelector('#modalBox .wbclubs'); if (!list) return;
  const f = wGfixHere(), mine = !f && wMyFixture();
  list.insertAdjacentHTML('afterend', `<p class="hint">The Cinder Cup: eight sevens, every week. ${wGcupBtn()}${f ? ` Your league fixture against ${esc(wTheClub(f.club))} is here at the Ash Bowl, by day ${f.day}: play it from the ground's GAME card.` : ''}</p>`);
  const b = $('modalBox').querySelector('[data-gcup]'); if (b) b.onclick = () => { $('modalBox').querySelector('[data-close]').click(); wOpenGcup(); };
};
const wW46WallText = wWallText;
wWallText = function () {
  wW46WallText();
  if (WG.gcupWins) wLog(`On its own hook: the Cinder Cup${WG.gcupWins > 1 ? `, ${WG.gcupWins} times` : ''}.`, 'g');
};
const wW46RenderHelp = renderHelp;
renderHelp = function () {
  wW46RenderHelp();
  const g = $('wHelpGfPowers') || $('wHelpGridiron'); if (!g || $('wHelpGcup')) return;
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpGcup"><b>The Cinder Cup.</b> Football's cup, every week at the Ash Bowl: ask Clinker Dunn about the CINDER cup, or use the Cinder Cup button on the Seven tab. ${W_GCUP.fee} gold to enter. Eight sevens in a bracket, three rounds, each harder than the last; you play your own games and the rest are played out on the gridiron once yours is done. A tie after Sudden Death goes to the side with more yards. Lose and you're out. Win the final for ${W_GCUP.prize.gold} gold, ${W_GCUP.prize.fans} fans, a pick of football cards and a place on the Wall of Awards. League fixtures at the Ash Bowl are football games on the gridiron too: Play, Manage or Simulate, a win is two points on the table, and a tie none.</p>`);
};
