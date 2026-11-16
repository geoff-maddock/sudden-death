/* w95: the Pond Kettle, and league fixtures at the Pond Rink on the ice (issue #83, phase 10).
   The Pond Kettle is hockey's own cup, as the Charter Net (w84) is basketball's: every week at the Pond Rink (ask Old
   Tove about the KETTLE, or use the button on the Rink tab or the game card). Eight sixes in a bracket: you, rival
   clubs and the regions' own sides. Three rounds, each one harder (the tier, so their level and their coach's skill,
   goes up with the round). You play your own games (Play, Manage or Simulate, as any hockey game) and the rest of
   each round is simulated on the same engine once yours is done. Nobody goes home level, so every game has a winner.
   Lose and you're out; the rest of the bracket is played to a champion. Win the final and you drink from Old Tove's
   kettle and keep it for the week: gold, fans, a pick of hockey cards, a piece of rink gear you don't have
   (W_RINK_KIT.cup; gold once you have them all), a line in the journal and a place on the Wall of Awards.
   League fixtures at the Rink (w24): your fixture there is a hockey game on the ice (Play, Manage or Simulate)
   instead of a card match, and the clubs' own fixtures there are played on the engine, with real scores. A win is two
   points on the table and the fixture's fans, and either way the fixture is done.

   WG.hkcup  { week, field: [8 ids, 'me' first], round: 0..2, games: [[{ a, b, ra, rb, w, end }]] by round, pending,
               show, out, done, champ } or null; end: '' | 'ot' | 'so'. A concede is a loss. Plain JSON, as WG.bkcup.
   WG.hkcupWins, WG.hkcupLog: [{ year, day }]
   W_KETTLE  the numbers; W_KETTLE.force ('win' | 'lose') settles your next cup game that way (tests and the bot)
   wKettleEnter(), wKettlePlay(how), wKettleCatchUp(), wOpenKettle(), wKettleWon(), wRinkSimClubs(a, b, tier),
   wHkfixPlay(how), W_ON_END.hkcup, W_ON_END.hkfix
   Wrapped: wNextPrompt (wW95NextPrompt: the rest of the round, then the bracket), wCampRink and wRenderCamp
   (wW95CampRink, wW95RenderCamp: a Pond Kettle button), wOpenRinkCard (wW95OpenRinkCard: the cup and your fixture),
   wOpenGrdCard (wW95OpenGrdCard: the Rink's fixture row plays on the ice), wSimAt (wW95SimAt: the clubs' games at
   the Rink on the engine), wRunAct (wW95RunAct: 'hkkettle'), wWallText (wW95WallText), renderHelp (wW95RenderHelp:
   #wHelpRinkKettle). */

const W_KETTLE = {
  fee: 40, size: 8,
  tiers: [1, 2, 3],               // the tier of each round: the coach a Squire, a Knight, an Archmage
  rounds: ['Quarter-final', 'Semi-final', 'Final'],
  prize: { gold: 150, fans: 20, pick: 3 },
  force: null
};
const W_HKFIX = { rink: 'g_rink', tier: 2 };

function wKettle() { return (WG && WG.hkcup) || null; }
function wKettleOn() { const D = wKettle(); return !!(D && !D.done); }
function wKettleName(id) { return id === 'me' ? 'your six' : wBallName(id); }
function wKettleTeamName(id) { return id === 'me' ? wPartyTeam().name : (wBallTeam(id) || {}).name || id; }
function wKettlePairs(r) {
  const D = wKettle(); let ids = D.field.slice();
  for (let i = 0; i < r; i++) ids = (D.games[i] || []).map(g => g.w);
  const out = []; for (let i = 0; i + 1 < ids.length; i += 2) out.push([ids[i], ids[i + 1]]);
  return out;
}
function wKettleGame(r, a, b) { return ((wKettle().games[r]) || []).find(g => (g.a === a && g.b === b) || (g.a === b && g.b === a)) || null; }
function wKettleMine() { const D = wKettle(); if (!D || D.out || D.done) return null; const p = wKettlePairs(D.round).find(x => x.includes('me')); return p && !wKettleGame(D.round, p[0], p[1]) ? p.find(x => x !== 'me') : null; }
const wKettleLive = () => wRinkLive() && WG.hkg.live.world.kind === 'hkcup';

function wKettleProblems() {
  const D = wKettle(), out = wRinkProblems();
  if (D && !D.done) return out;
  const left = 7 - ((WG.dayAbs - 1) % 7);
  if (D && D.week === wWeek()) out.push(`The Pond Kettle is held once a week. The next one opens in ${left} day${left === 1 ? '' : 's'}.`);
  if (RUN.gold < W_KETTLE.fee) out.push(`The entry fee is ${W_KETTLE.fee} gold, and you have ${RUN.gold}.`);
  if (wRinkLive()) out.push('Finish the hockey game you started first.');
  return out;
}
// the field: your rivals (four at most), then the regions' own sides, in a random draw with you at the top
function wKettleEnter() {
  const probs = wKettleProblems(); if (probs.length) return probs.join(' ');
  const rivals = shuffle(Object.values(WG.rivals || {}).filter((c, i, a) => CLUBS[c] && a.indexOf(c) === i)).slice(0, 4);
  const wild = shuffle(Object.keys(W_WILD_TEAM).map(r => 'wild:' + r));
  const others = shuffle(rivals.concat(wild).slice(0, W_KETTLE.size - 1));
  RUN.gold -= W_KETTLE.fee;
  WG.hkcup = { week: wWeek(), field: ['me'].concat(others), round: 0, games: [[], [], []], pending: false, show: false, out: false, done: false, champ: null };
  wLog(`You enter the Pond Kettle (${W_KETTLE.fee} gold). ${W_KETTLE.rounds[0]}: ${wKettleName(wKettleMine())}.`, 'g');
  wSave();
  return '';
}
function wKettlePlay(how) {
  const D = wKettle(), opp = wKettleMine(); if (!opp) return '';
  return wStartRink({ club: opp, how, tier: W_KETTLE.tiers[D.round], kind: 'hkcup', ref: { week: D.week, round: D.round }, cup: true });
}
// your game's result; the rest of the round waits until you are back in the world (wKettleCatchUp)
W_ON_END.hkcup = function (r, ref, W) {
  const D = wKettle(); if (!D || !ref || D.done || ref.week !== D.week || ref.round !== D.round) return;
  const forced = W_KETTLE.force; W_KETTLE.force = null;
  // (a win or a loss is the result: conceding loses whatever the score)
  const rr = forced || r, win = rr === 'win', w = win ? 'me' : W.club, last = (WG.hkg.games[0] || {}).end || '';
  D.games[D.round].push({ a: 'me', b: W.club, ra: W.us, rb: W.them, w, end: last });
  if (!win) D.out = true;
  D.pending = true;
  const how = last === 'so' ? ' in a shootout' : last === 'ot' ? ' in sudden death' : '';
  wLog(win ? `${W_KETTLE.rounds[D.round]} won: ${W.us}–${W.them} against ${wKettleName(W.club)}${how}.` : `Out of the Pond Kettle in the ${W_KETTLE.rounds[D.round].toLowerCase()}, ${W.us}–${W.them} to ${wKettleName(W.club)}${how}.`, win ? 'g' : 'b');
};
// a game you are not in, on the same engine, both sides on the coaches (and your own game, if one is on, kept). The
// squads are made for this game only: the one a rival keeps for its games against you (WG.hkg.opp) is left as it was
function wRinkSimClubs(a, b, tier) {
  const B = wHkg(), kept = Object.assign({}, B.opp), teams = [wRinkOpp(a, tier), wRinkOpp(b, tier)];
  B.opp = kept;
  const sk = wRinkSkill(tier)[1], s = wHK.simGame({ teams, skill: [sk, sk], mins: wRinkMins(), pond: true, snow: wRinkSnowing(), keep: true });
  return { ra: s.score[0], rb: s.score[1], w: s.win === 0 ? a : b, end: s.so ? 'so' : s.ot ? 'ot' : '' };
}
function wKettleSim(a, b, tier) { const s = wRinkSimClubs(a, b, tier); return { a, b, ra: s.ra, rb: s.rb, w: s.w, end: s.end }; }
// the rest of the round: every game without a result; then the next round, and on to the final if you are out
function wKettleCatchUp() {
  const D = wKettle(); if (!D || !D.pending || wRinkLive() || UI.view === 'rink') return false;
  for (;;) {
    for (const [a, b] of wKettlePairs(D.round)) if (!wKettleGame(D.round, a, b)) D.games[D.round].push(wKettleSim(a, b, W_KETTLE.tiers[D.round]));
    if (D.round === W_KETTLE.rounds.length - 1) { D.done = true; D.champ = D.games[D.round][0].w; break; }
    D.round++;
    if (!D.out) break;
  }
  D.pending = false; D.show = true;
  if (D.done && D.champ === 'me') wKettleWon();
  else if (D.done) wLog(`${wCap(wKettleName(D.champ))} win the Pond Kettle.`, 'd');
  else wLog(`The ${W_KETTLE.rounds[D.round - 1].toLowerCase()}s are in. ${W_KETTLE.rounds[D.round]}: ${wKettleName(wKettleMine())}.`, 'g');
  wSave();
  return true;
}
function wKettleWon() {
  const P = W_KETTLE.prize, D = wKettle(), f = D.games[2][0];
  RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans;
  WG.hkcupWins = (WG.hkcupWins || 0) + 1;
  WG.hkcupLog = (WG.hkcupLog || []).concat({ year: WG.year, day: WG.day });
  wLog(`You win the Pond Kettle! Your six drink from Old Tove's kettle and keep it for the week, and your name goes up on the Wall of Awards. ${P.gold} gold and ${P.fans} fans.`, 'g');
  try { wJAddWin({ at: wJStamp(), where: wJWhere(), k: 'title', t: 'Won the Pond Kettle', opp: wKettleTeamName(f.a === 'me' ? f.b : f.a), sport: 'hockey', score: f.a === 'me' ? `${f.ra}–${f.rb}` : `${f.rb}–${f.ra}` }); } catch (e) { console.error(e); }
  // the first piece of rink gear you don't have yet
  const have = id => (WG.items[id] || 0) > 0 || wRoster().some(p => p.gear && p.gear.rink === id);
  const id = W_RINK_KIT.cup.find(x => !have(x));
  if (id) { wAddItem(id, 1); wLog(`The Kettle comes with gear: the ${W_RINK_GEAR[id].name}. ${W_RINK_GEAR[id].desc}`, 'g'); }
  else { RUN.gold += W_RINK_KIT.cupGold; wLog(`You have every piece of rink gear, so the Kettle pays ${W_RINK_KIT.cupGold} gold more instead.`, 'g'); }
  const pool = wSportPool(['hockey']);
  wGainCard(pool.length >= P.pick ? { pick: P.pick, pool } : { pick: P.pick, rarity: 'r' }, 'the Pond Kettle prize');
}

/* ---------- the card: entry, the bracket, your next game ---------- */
function wKettleBracket() {
  const D = wKettle();
  const cell = (r, a, b) => {
    const g = wKettleGame(r, a, b), mark = g && g.end === 'so' ? '*' : g && g.end === 'ot' ? '†' : '';
    const row = id => `<li class="${id === 'me' ? 'wme' : ''}${g && g.w === id ? ' wwon' : g ? ' wlost' : ''}"><span>${esc(wKettleTeamName(id))}</span><b>${g ? (g.a === id ? g.ra : g.rb) : ''}${g && g.w === id ? mark : ''}</b></li>`;
    return `<ol class="wdcg">${row(a)}${row(b)}</ol>`;
  };
  return `<div class="wdcb">${W_KETTLE.rounds.map((n, r) => `<div><h5>${n}</h5>${r <= D.round || D.done ? wKettlePairs(Math.min(r, 2)).map(([a, b]) => cell(r, a, b)).join('') : '<p class="dim">To come.</p>'}</div>`).join('')}</div>
    ${D.games.some(R => R.some(g => g.end)) ? '<p class="hint">† Won in sudden death. * Won in a shootout.</p>' : ''}`;
}
function wOpenKettle(msg) {
  if (LAB || !WG) return;
  wKettleCatchUp();
  if (WG.cardOffer) { if ($('modal').hidden) wShowCardOffer(); return; }
  if (WG.hkcup) WG.hkcup.show = false;
  const D = wKettle(), on = wKettleOn(), probs = wKettleProblems(), opp = on && wKettleMine(), live = wKettleLive();
  let body;
  if (!on) {
    body = `<p>Eight sixes, three rounds: the quarter-finals, the semi-finals and the final. Hockey at the Pond Rink, with your six and your bench. Rival clubs and the regions' own sides enter. Each round is harder than the last. Lose once and you're out; nobody goes home level, so a game still level goes to sudden death and then a shootout.</p>
      <p class="hint">Entry ${W_KETTLE.fee} gold. Win it and your six drink from Old Tove's kettle and keep it for the week: ${W_KETTLE.prize.gold} gold, ${W_KETTLE.prize.fans} fans, a pick of ${W_KETTLE.prize.pick} hockey cards, a piece of rink gear and a place on the Wall of Awards. Every game also pays as a hockey game does. One cup a week.${WG.hkcupWins ? ` You have won it ${WG.hkcupWins} time${WG.hkcupWins === 1 ? '' : 's'}.` : ''}</p>
      ${D && D.done ? `<h5>Last week's bracket</h5>${wKettleBracket()}` : ''}
      ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
      <div class="row"><button class="btn" id="wKettleEnter" ${probs.length ? 'disabled' : ''}>Enter (${W_KETTLE.fee} gold)</button></div>`;
  } else {
    const tier = W_KETTLE.tiers[D.round], h = opp && wRinkH2h(opp);
    const next = live ? `<p>Your ${W_KETTLE.rounds[D.round].toLowerCase()} against ${esc(wKettleName(WG.hkg.live.world.club))} is waiting.</p><div class="row"><button class="btn" id="wKettleRes">Resume the game</button></div>`
      : opp ? `<p><b>${W_KETTLE.rounds[D.round]}</b> against ${esc(wKettleName(opp))}: their players are level ${wBallOppLvl(tier)}, the coach a ${W_BALL_SKILL[wRinkSkill(tier)[1]]}.${h ? ` Last hockey game: ${h.r === 'win' ? 'won' : 'lost'} ${h.us}–${h.them}.` : ''}</p>
        ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
        <div class="row">${Object.keys(W_HKG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-kettlehow="${how}" ${probs.length ? 'disabled' : ''}>${W_HKG_HOW[how]}</button>`).join('')}</div>` : '';
    body = `${next}${wKettleBracket()}`;
  }
  const close = modal(`<header><h3>The Pond Kettle</h3><button class="ghost" data-close>Done</button></header>${msg ? `<p class="wbad">${esc(msg)}</p>` : ''}${body}`, () => wDrain());
  const again = r => { close(); wOpenKettle(r); };
  if ($('wKettleEnter')) $('wKettleEnter').onclick = () => again(wKettleEnter());
  if ($('wKettleRes')) $('wKettleRes').onclick = () => { close(); wResumeRink(); };
  $('modalBox').querySelectorAll('[data-kettlehow]').forEach(b => b.onclick = () => {
    // (after Simulate, the Final card first; closing it brings the bracket back, through wNextPrompt)
    close(); const r = wKettlePlay(b.dataset.kettlehow); if (r) wOpenKettle(r);
  });
}
// back in the world after your game: the rest of the round, then the bracket
const wW95NextPrompt = wNextPrompt;
wNextPrompt = function () {
  const D = wKettle();
  if (!LAB && D && (D.pending || D.show) && !wRinkLive() && UI.view !== 'rink' && wActive() && !WG.cardOffer && !WG.event) { wOpenKettle(); return true; }
  if (LAB && D && D.pending) wKettleCatchUp();
  return wW95NextPrompt();
};

/* ---------- league fixtures at the Rink, on the ice ---------- */
const wHkfixHere = () => wFixHere(W_HKFIX.rink) || null;
function wHkfixPlay(how) {
  const f = wHkfixHere(); if (!f) return 'Your league fixture is not at the Pond Rink.';
  return wStartRink({ club: f.club, how, tier: wFixTier(f.club, W_HKFIX.rink), kind: 'hkfix', ref: { g: W_HKFIX.rink, club: f.club, day: f.day }, cup: true });
}
// the fixture's end: as a fixture at any ground (w24's W_ON_END.ground), with the hockey score; a rival's league row,
// and the head to head of any club in CLUBS, are counted in wRinkSettle already
W_ON_END.hkfix = function (r, ref, W) {
  if (!ref) return;
  const L = wLeague(), F = wFixtures(), club = ref.club;
  const f = F.games.find(x => (x.a === club && x.b === 'me') || (x.a === 'me' && x.b === club));
  // a game saved and finished after its round day: the fixture was postponed, so it's a game like any other now
  if (F.day !== ref.day || !f || f.done) { wLog('That fixture was postponed on its round day, so this game is no longer the fixture: it counts as any other game.', 'd'); return; }
  f.done = 1;
  if (!wIsRival(club)) { wLeagueMine(r); if (!CLUBS[club]) wH2hRecord(club, r, { us: W.us, them: W.them, sport: 'hockey' }); }
  if (L.table[club]) { if (r === 'win') L.table[club].l++; else L.table[club].w++; }
  const res = r === 'win' ? { a: 'me', b: club, sa: W.us, sb: W.them } : { a: club, b: 'me', sa: W.them, sb: W.us };
  L.results.unshift(Object.assign(res, { day: WG.dayAbs, sport: 'hockey', g: ref.g }));
  L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  if (r === 'win') {
    RUN.fans = (RUN.fans || 0) + W_FIX.fans;
    wLog(`Two points on the table. The bank stays to sing: ${W_FIX.fans} fans.`, 'g');
    wMaybeBid(club);
  }
};
// the clubs' own fixtures at the Rink: played on the engine (nobody goes home level)
const wW95SimAt = wSimAt;
wSimAt = function (a, b, g) {
  if (g !== W_HKFIX.rink || LAB) return wW95SimAt(a, b, g);
  const L = wLeague(), s = wRinkSimClubs(a, b, W_HKFIX.tier), w = s.w, l = w === a ? b : a;
  L.table[w].w++; L.table[l].l++;
  const res = { day: WG.dayAbs, a: w, b: l, sport: 'hockey', sa: Math.max(s.ra, s.rb), sb: Math.min(s.ra, s.rb), g };
  L.results.unshift(res); L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  return res;
};
// the Rink's ground card: the fixture row plays on the ice, with Play, Manage and Simulate
const wW95OpenGrdCard = wOpenGrdCard;
wOpenGrdCard = function (id, msg) {
  wW95OpenGrdCard(id, msg);
  if (id !== W_HKFIX.rink) return;
  const b = document.querySelector('#modalBox [data-gfix]'), f = wHkfixHere(); if (!b || !f) return;
  const probs = wRinkProblems().concat(wRinkLive() ? ['Finish the hockey game you started first.'] : []), row = b.closest('.row');
  row.innerHTML = Object.keys(W_HKG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-hkfixhow="${how}" ${probs.length ? 'disabled' : ''}>${W_HKG_HOW[how]}</button>`).join('');
  const small = row.closest('li').querySelector('small'); if (small) small.insertAdjacentHTML('beforeend', ` Played on the ice with your six.${probs.length ? ' ' + esc(probs[0]) : ''}`);
  row.querySelectorAll('[data-hkfixhow]').forEach(x => x.onclick = () => { $('modalBox').querySelector('[data-close]').click(); const r = wHkfixPlay(x.dataset.hkfixhow); if (r) wOpenGrdCard(id, r); });
};

/* ---------- where it is: the Rink, the Rink tab, the game card ---------- */
{
  const K = DB.chars.gk_rink;
  if (K) { K.topics.kettle = { t: 'The Pond Kettle: eight sixes and three rounds, every week, on this ice. Win the final and you drink from my kettle, and it is yours until the next one. I want it back clean. I take the entries.', act: 'hkkettle' }; K.topics.job.t += ' I run the Pond KETTLE too.'; }
}
const wW95RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'hkkettle') return wOpenKettle(); return wW95RunAct.apply(this, arguments); };
const wKettleBtn = () => `<button class="ghost" data-hkkettle>Pond Kettle${wKettleOn() ? ` (${W_KETTLE.rounds[wKettle().round].toLowerCase()})` : ''}</button>`;
const wW95CampRink = wCampRink;
wCampRink = function (C) { return wW95CampRink(C).replace('<button class="ghost" data-hpractice', `${wKettleBtn()}<button class="ghost" data-hpractice`); };
const wW95RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW95RenderCamp();
  const b = $('wCampBody') && WCAMP.tab === 'rink' && $('wCampBody').querySelector('[data-hkkettle]');
  if (b) b.onclick = () => { WCAMP.close(); wOpenKettle(); };
};
const wW95OpenRinkCard = wOpenRinkCard;
wOpenRinkCard = function () {
  wW95OpenRinkCard();
  const list = document.querySelector('#modalBox .wbclubs'); if (!list) return;
  const f = wHkfixHere();
  list.insertAdjacentHTML('afterend', `<p class="hint">The Pond Kettle: eight sixes, every week. ${wKettleBtn()}${f ? ` Your league fixture against ${esc(wTheClub(f.club))} is here at the Pond Rink, by day ${f.day}: play it from the ground's GAME card.` : ''}</p>`);
  const b = $('modalBox').querySelector('[data-hkkettle]'); if (b) b.onclick = () => { $('modalBox').querySelector('[data-close]').click(); wOpenKettle(); };
};
const wW95WallText = wWallText;
wWallText = function () {
  wW95WallText();
  if (WG.hkcupWins) wLog(`On a shelf, scrubbed clean: Old Tove's kettle${WG.hkcupWins > 1 ? `, won ${WG.hkcupWins} times` : ''}, with your six's names scratched on the lid.`, 'g');
};
const wW95RenderHelp = renderHelp;
renderHelp = function () {
  wW95RenderHelp();
  const g = $('wHelpRinkStars') || $('wHelpRinkKit') || $('wHelpRinkGame'); if (!g || $('wHelpRinkKettle')) return;
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpRinkKettle"><b>The Pond Kettle.</b> Hockey's cup, every week at the Pond Rink: ask Old Tove about the KETTLE, or use the Pond Kettle button on the Rink tab. ${W_KETTLE.fee} gold to enter. Eight sixes in a bracket, three rounds, each harder than the last; you play your own games and the rest are played out on the ice once yours is done. Nobody goes home level. Lose and you're out. Win the final and your six drink from Old Tove's kettle and keep it for the week: ${W_KETTLE.prize.gold} gold, ${W_KETTLE.prize.fans} fans, a pick of hockey cards, a piece of rink gear and a place on the Wall of Awards. League fixtures at the Pond Rink are hockey games on the ice too: Play, Manage or Simulate, and a win is two points on the table.</p>`);
};
