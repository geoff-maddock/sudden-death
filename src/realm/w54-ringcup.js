/* w54: the Anvil Belt, and league fixtures at the Anvil Ring in the ring (issue #23, phase 6), as w46 is for football.
   The Anvil Belt is boxing's own cup: every week at the Anvil Ring (ask Ma Gristle about the BELT, or use the button
   on the card). Eight clubs in a bracket: you, rival clubs and the regions' own sides. Three rounds, each one harder
   (the tier, so their level and their CPU skill, goes up with the round). You box your own cards (Play, Manage or
   Simulate, as any card) and the rest of each round is boxed headless on the same engine once yours is done. A drawn
   card (level on bouts, knockdowns and points) goes to the toss of a coin. Lose and you're out; the rest of the
   bracket is boxed to a champion. Win the final for gold, fans, a pick of boxing cards, a line in the journal and a
   place on the Wall of Awards.
   League fixtures at the Ring (w24): your fixture there is a card in the ring instead of a card-game match, and the
   clubs' own fixtures there are boxed on the engine, with real results (bouts won). A win is two points on the table
   and the fixture's fans, a drawn card no points, and either way the fixture is done.

   WG.bcup  { week, field: [8 ids, 'me' first], round: 0..2, cards: [[{ a, b, ra, rb, w, toss }]] by round, pending,
              show, out, done, champ } or null; ra, rb: bouts won; toss: a drawn card settled by the coin. A concede is
              a loss. Plain JSON, as WG.gcup.
   W_BCUP   the numbers; W_BCUP.force ('win' | 'lose') settles your next cup card that way (tests and the bot)
   wBcupEnter(), wBcupPlay(how), wBcupCatchUp(), wOpenBcup(), wBfixPlay(how), W_ON_END.bcup, W_ON_END.bfix
   Wraps: wNextPrompt (wW54NextPrompt: the rest of the round, then the bracket), wOpenRingCard (wW54OpenRingCard: the
   Belt and your fixture), wOpenGrdCard (wW54OpenGrdCard: the Ring's fixture row boxes in the ring), wSimAt (wW54SimAt:
   the clubs' cards at the Ring on the engine), wRunAct (wW54RunAct: 'bcup'), wWallText, renderHelp (#wHelpBcup). */

const W_BCUP = {
  fee: 40, size: 8,
  tiers: [1, 2, 3],               // the tier of each round: CPU skill Squire, Knight, Archmage
  rounds: ['Quarter-final', 'Semi-final', 'Final'],
  prize: { gold: 150, fans: 20, pick: 3 },
  force: null
};
const W_BFIX = { ring: 'g_ring', tier: 2 };

function wBcup() { return (WG && WG.bcup) || null; }
function wBcupOn() { const D = wBcup(); return !!(D && !D.done); }
function wBcupName(id) { return id === 'me' ? 'your team' : wBallName(id); }
function wBcupTeamName(id) { return id === 'me' ? wPartyTeam().name : (wBallTeam(id) || {}).name || id; }
function wBcupPairs(r) {
  const D = wBcup(); let ids = D.field.slice();
  for (let i = 0; i < r; i++) ids = (D.cards[i] || []).map(g => g.w);
  const out = []; for (let i = 0; i + 1 < ids.length; i += 2) out.push([ids[i], ids[i + 1]]);
  return out;
}
function wBcupCard(r, a, b) { return ((wBcup().cards[r]) || []).find(g => (g.a === a && g.b === b) || (g.a === b && g.b === a)) || null; }
function wBcupMine() { const D = wBcup(); if (!D || D.out || D.done) return null; const p = wBcupPairs(D.round).find(x => x.includes('me')); return p && !wBcupCard(D.round, p[0], p[1]) ? p.find(x => x !== 'me') : null; }
const wBcupLive = () => wRingLive() && WG.bxg.live.world.kind === 'bcup';

function wBcupProblems() {
  const D = wBcup(), out = wRingProblems();
  if (D && !D.done) return out;
  const left = 7 - ((WG.dayAbs - 1) % 7);
  if (D && D.week === wWeek()) out.push(`The Anvil Belt is boxed once a week. The next one opens in ${left} day${left === 1 ? '' : 's'}.`);
  if (RUN.gold < W_BCUP.fee) out.push(`The entry fee is ${W_BCUP.fee} gold, and you have ${RUN.gold}.`);
  if (wRingLive()) out.push('Finish the card you started first.');
  return out;
}
// the field: your rivals (four at most), then the regions' own sides, in a random draw with you at the top
function wBcupEnter() {
  const probs = wBcupProblems(); if (probs.length) return probs.join(' ');
  const rivals = shuffle(Object.values(WG.rivals || {}).filter((c, i, a) => CLUBS[c] && a.indexOf(c) === i)).slice(0, 4);
  const wild = shuffle(Object.keys(W_WILD_TEAM).map(r => 'wild:' + r));
  const others = shuffle(rivals.concat(wild).slice(0, W_BCUP.size - 1));
  RUN.gold -= W_BCUP.fee;
  WG.bcup = { week: wWeek(), field: ['me'].concat(others), round: 0, cards: [[], [], []], pending: false, show: false, out: false, done: false, champ: null };
  wLog(`You enter the Anvil Belt (${W_BCUP.fee} gold). ${W_BCUP.rounds[0]}: ${wBcupName(wBcupMine())}.`, 'g');
  wSave();
  return '';
}
function wBcupPlay(how) {
  const D = wBcup(), opp = wBcupMine(); if (!opp) return '';
  return wStartRing({ club: opp, how, tier: W_BCUP.tiers[D.round], kind: 'bcup', ref: { week: D.week, round: D.round }, cup: true });
}
// who goes through: the card's result, and a drawn card (level on bouts, knockdowns and points) on the toss of a coin
const wBcupWinner = (a, b, R) => R.win === 0 ? a : R.win === 1 ? b : (Math.random() < .5 ? a : b);
// your card's result; the rest of the round waits until you are back in the world (wBcupCatchUp)
W_ON_END.bcup = function (r, ref, W) {
  const D = wBcup(); if (!D || !ref || D.done || ref.week !== D.week || ref.round !== D.round) return;
  const forced = W_BCUP.force; W_BCUP.force = null;
  const rr = forced || r, toss = rr === 'tie';
  const w = rr === 'win' ? 'me' : rr === 'lose' ? W.club : (Math.random() < .5 ? 'me' : W.club), win = w === 'me';
  D.cards[D.round].push({ a: 'me', b: W.club, ra: W.us, rb: W.them, w, toss });
  if (!win) D.out = true;
  D.pending = true;
  const tb = toss ? ` (a drawn card, and the coin fell ${win ? 'your' : 'their'} way)` : '';
  wLog(win ? `${W_BCUP.rounds[D.round]} won: ${W.us}–${W.them} against ${wBcupName(W.club)}${tb}.` : `Out of the Anvil Belt in the ${W_BCUP.rounds[D.round].toLowerCase()}, ${W.us}–${W.them} to ${wBcupName(W.club)}${tb}.`, win ? 'g' : 'b');
};
// a card you are not on, on the same engine, both corners the CPU's at the tier's skill (your own card, if one is on, kept)
function wRingSimClubs(a, b, tier) {
  const sk = wRingSkill(tier)[1], taken = new Set(), A = wRingOpp(a, tier, taken), B = wRingOpp(b, tier, taken);
  const r = wBX.simCard({ sides: [A, B], skill: [sk, sk] });
  return { ra: r.result.won[0], rb: r.result.won[1], result: r.result };
}
function wBcupSim(a, b, tier) {
  const s = wRingSimClubs(a, b, tier);
  return { a, b, ra: s.ra, rb: s.rb, w: wBcupWinner(a, b, s.result), toss: s.result.win == null };
}
// the rest of the round: every card without a result; then the next round, and on to the final if you are out
function wBcupCatchUp() {
  const D = wBcup(); if (!D || !D.pending || wRingLive() || UI.view === 'ring') return false;
  for (;;) {
    for (const [a, b] of wBcupPairs(D.round)) if (!wBcupCard(D.round, a, b)) D.cards[D.round].push(wBcupSim(a, b, W_BCUP.tiers[D.round]));
    if (D.round === W_BCUP.rounds.length - 1) { D.done = true; D.champ = D.cards[D.round][0].w; break; }
    D.round++;
    if (!D.out) break;
  }
  D.pending = false; D.show = true;
  if (D.done && D.champ === 'me') wBcupWon();
  else if (D.done) wLog(`${wCap(wBcupName(D.champ))} win the Anvil Belt.`, 'd');
  else wLog(`The ${W_BCUP.rounds[D.round - 1].toLowerCase()}s are in. ${W_BCUP.rounds[D.round]}: ${wBcupName(wBcupMine())}.`, 'g');
  wSave();
  return true;
}
function wBcupWon() {
  const P = W_BCUP.prize, D = wBcup(), f = D.cards[2][0];
  RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans;
  WG.bcupWins = (WG.bcupWins || 0) + 1;
  WG.bcupLog = (WG.bcupLog || []).concat({ year: WG.year, day: WG.day });
  wLog(`You win the Anvil Belt! It goes up on the Wall of Awards. ${P.gold} gold and ${P.fans} fans.`, 'g');
  try { wJAddWin({ at: wJStamp(), where: wJWhere(), k: 'title', t: 'Won the Anvil Belt', opp: wBcupTeamName(f.b), sport: 'boxing', score: `${f.ra}–${f.rb}` }); } catch (e) { console.error(e); }
  const pool = wSportPool(['boxing']);
  wGainCard(pool.length >= P.pick ? { pick: P.pick, pool } : { pick: P.pick, rarity: 'r' }, 'the Anvil Belt prize');
}

/* ---------- the Belt's card: entry, the bracket, your next card ---------- */
function wBcupBracket() {
  const D = wBcup();
  const cell = (r, a, b) => {
    const g = wBcupCard(r, a, b), toss = g && g.toss;
    const row = id => `<li class="${id === 'me' ? 'wme' : ''}${g && g.w === id ? ' wwon' : g ? ' wlost' : ''}"><span>${esc(wBcupTeamName(id))}</span><b>${g ? (g.a === id ? g.ra : g.rb) : ''}${toss && g.w === id ? '*' : ''}</b></li>`;
    return `<ol class="wdcg">${row(a)}${row(b)}</ol>`;
  };
  return `<div class="wdcb">${W_BCUP.rounds.map((n, r) => `<div><h5>${n}</h5>${r <= D.round || D.done ? wBcupPairs(Math.min(r, 2)).map(([a, b]) => cell(r, a, b)).join('') : '<p class="dim">To come.</p>'}</div>`).join('')}</div>
    ${D.cards.some(R => R.some(g => g.toss)) ? '<p class="hint">* A drawn card: through on the toss of a coin.</p>' : ''}`;
}
function wOpenBcup(msg) {
  if (LAB || !WG) return;
  wBcupCatchUp();
  if (WG.cardOffer) { if ($('modal').hidden) wShowCardOffer(); return; }
  if (WG.bcup) WG.bcup.show = false;
  const D = wBcup(), on = wBcupOn(), probs = wBcupProblems(), opp = on && wBcupMine(), live = wBcupLive();
  let body;
  if (!on) {
    body = `<p>Eight clubs, three rounds: the quarter-finals, the semi-finals and the final. Each is a card of three bouts in the Anvil Ring, with your fighters. Rival clubs and the regions' own sides enter. Each round is harder than the last. Lose once and you're out; the rest of the bracket is boxed to a champion.</p>
      <p class="hint">Entry ${W_BCUP.fee} gold. Win it for ${W_BCUP.prize.gold} gold, ${W_BCUP.prize.fans} fans, a pick of ${W_BCUP.prize.pick} boxing cards and a place on the Wall of Awards. Every card also pays as a card does. One Belt a week.${WG.bcupWins ? ` You have won it ${WG.bcupWins === 1 ? 'once' : `${WG.bcupWins} times`}.` : ''}</p>
      ${D && D.done ? `<h5>Last week's bracket</h5>${wBcupBracket()}` : ''}
      ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
      <div class="row"><button class="btn" id="wBcupEnter" ${probs.length ? 'disabled' : ''}>Enter (${W_BCUP.fee} gold)</button></div>`;
  } else {
    const tier = W_BCUP.tiers[D.round], h = opp && wRingH2h(opp);
    const next = live ? `<p>Your ${W_BCUP.rounds[D.round].toLowerCase()} against ${esc(wBcupName(WG.bxg.live.world.club))} is waiting.</p><div class="row"><button class="btn" id="wBcupRes">Resume the card</button></div>`
      : opp ? `<p><b>${W_BCUP.rounds[D.round]}</b> against ${esc(wBcupName(opp))}: their fighters are level ${wBallOppLvl(tier)}, CPU skill ${W_BALL_SKILL[wRingSkill(tier)[1]]}.${h ? ` Last card: ${h.r === 'win' ? 'won' : h.r === 'tie' ? 'drawn' : 'lost'} ${h.us}–${h.them}.` : ''}</p>
        ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
        <div class="row">${Object.keys(W_BXG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-bchow="${how}" ${probs.length ? 'disabled' : ''}>${W_BXG_HOW[how]}</button>`).join('')}</div>` : '';
    body = `${next}${wBcupBracket()}`;
  }
  const close = modal(`<header><h3>The Anvil Belt</h3><button class="ghost" data-close>Done</button></header>${msg ? `<p class="wbad">${esc(msg)}</p>` : ''}${body}`, () => wDrain());
  const again = r => { close(); wOpenBcup(r); };
  if ($('wBcupEnter')) $('wBcupEnter').onclick = () => again(wBcupEnter());
  if ($('wBcupRes')) $('wBcupRes').onclick = () => { close(); wResumeRing(); };
  $('modalBox').querySelectorAll('[data-bchow]').forEach(b => b.onclick = () => {
    // (the pairing comes up next; after Simulate the result card, and closing it brings the bracket back, through wNextPrompt)
    close(); const r = wBcupPlay(b.dataset.bchow); if (r) wOpenBcup(r);
  });
}
// back in the world after your card: the rest of the round, then the bracket
const wW54NextPrompt = wNextPrompt;
wNextPrompt = function () {
  const D = wBcup();
  if (!LAB && D && (D.pending || D.show) && !wRingLive() && UI.view !== 'ring' && wActive() && !WG.cardOffer && !WG.event && $('modal').hidden) { wOpenBcup(); return true; }
  if (LAB && D && D.pending) wBcupCatchUp();
  return wW54NextPrompt();
};

/* ---------- league fixtures at the Ring, in the ring ---------- */
const wBfixHere = () => wFixHere(W_BFIX.ring) || null;
function wBfixPlay(how) {
  const f = wBfixHere(); if (!f) return 'Your league fixture is not at the Anvil Ring.';
  return wStartRing({ club: f.club, how, tier: wFixTier(f.club, W_BFIX.ring), kind: 'bfix', ref: { g: W_BFIX.ring, club: f.club, day: f.day }, cup: true });
}
// the fixture's end: as a fixture at any ground (w24's W_ON_END.ground), with the bouts won; a rival's league row, and
// the head to head of any club in CLUBS, are counted in wRingSettle already
W_ON_END.bfix = function (r, ref, W) {
  if (!ref) return;
  const L = wLeague(), F = wFixtures(), club = ref.club, tie = r === 'tie';
  const f = F.games.find(x => (x.a === club && x.b === 'me') || (x.a === 'me' && x.b === club)); if (f) f.done = 1;
  if (tie) { wLog(`A drawn card in the league at the Anvil Ring: no points for either side.`, 'd'); return; }
  if (!wIsRival(club)) { wLeagueMine(r); if (!CLUBS[club]) wH2hRecord(club, r, { us: W.us, them: W.them, sport: 'boxing' }); }
  if (L.table[club]) { if (r === 'win') L.table[club].l++; else L.table[club].w++; }
  const res = r === 'win' ? { a: 'me', b: club, sa: W.us, sb: W.them } : { a: club, b: 'me', sa: W.them, sb: W.us };
  L.results.unshift(Object.assign(res, { day: WG.dayAbs, sport: 'boxing', g: ref.g }));
  L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  if (r === 'win') {
    RUN.fans = (RUN.fans || 0) + W_FIX.fans;
    wLog(`Two points on the table. The crowd at the Anvil Ring stamps on the boards: ${W_FIX.fans} fans.`, 'g');
    wMaybeBid(club);
  }
};
// the clubs' own fixtures at the Ring: boxed on the engine, a drawn card going to the coin
const wW54SimAt = wSimAt;
wSimAt = function (a, b, g) {
  if (g !== W_BFIX.ring || LAB) return wW54SimAt(a, b, g);
  const L = wLeague(), s = wRingSimClubs(a, b, W_BFIX.tier), w = wBcupWinner(a, b, s.result), l = w === a ? b : a;
  L.table[w].w++; L.table[l].l++;
  const res = { day: WG.dayAbs, a: w, b: l, sport: 'boxing', sa: Math.max(s.ra, s.rb), sb: Math.min(s.ra, s.rb), g };
  L.results.unshift(res); L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  return res;
};
// the Ring's ground card: the fixture row boxes in the ring, with Play, Manage and Simulate
const wW54OpenGrdCard = wOpenGrdCard;
wOpenGrdCard = function (id, msg) {
  wW54OpenGrdCard(id, msg);
  if (id !== W_BFIX.ring) return;
  const b = document.querySelector('#modalBox [data-gfix]'), f = wBfixHere(); if (!b || !f) return;
  const probs = wRingProblems().concat(wRingLive() ? ['Finish the card you started first.'] : []), row = b.closest('.row');
  row.innerHTML = Object.keys(W_BXG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-bfixhow="${how}" ${probs.length ? 'disabled' : ''}>${W_BXG_HOW[how]}</button>`).join('');
  const small = row.closest('li').querySelector('small'); if (small) small.insertAdjacentHTML('beforeend', ` Boxed in the ring: a card of three bouts with your fighters.${probs.length ? ' ' + esc(probs[0]) : ''}`);
  row.querySelectorAll('[data-bfixhow]').forEach(x => x.onclick = () => { $('modalBox').querySelector('[data-close]').click(); const r = wBfixPlay(x.dataset.bfixhow); if (r) wOpenGrdCard(id, r); });
};

/* ---------- where it is: Ma Gristle, the card ---------- */
{
  const K = DB.chars.gk_ring;
  if (K) { K.topics.belt = { t: 'The Anvil Belt: eight clubs, three rounds of cards, every week, here in the ring. Your own fighters, mind. I take the entries.', act: 'bcup' }; K.topics.job.t += ' I run the BELT too.'; }
}
const wW54RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'bcup') return wOpenBcup(); return wW54RunAct.apply(this, arguments); };
const wBcupBtn = () => `<button class="ghost" data-bcup>Anvil Belt${wBcupOn() ? ` (${W_BCUP.rounds[wBcup().round].toLowerCase()})` : ''}</button>`;
const wW54OpenRingCard = wOpenRingCard;
wOpenRingCard = function () {
  wW54OpenRingCard();
  const list = document.querySelector('#modalBox .wbclubs'); if (!list) return;
  const f = wBfixHere();
  list.insertAdjacentHTML('afterend', `<p class="hint">The Anvil Belt: eight clubs, every week. ${wBcupBtn()}${f ? ` Your league fixture against ${esc(wTheClub(f.club))} is here at the Anvil Ring, by day ${f.day}: box it from the ground's GAME card.` : ''}</p>`);
  const b = $('modalBox').querySelector('[data-bcup]'); if (b) b.onclick = () => { $('modalBox').querySelector('[data-close]').click(); wOpenBcup(); };
};
const wW54WallText = wWallText;
wWallText = function () {
  wW54WallText();
  if (WG.bcupWins) wLog(`On its own hook: the Anvil Belt${WG.bcupWins > 1 ? `, ${WG.bcupWins} times` : ''}.`, 'g');
};
const wW54RenderHelp = renderHelp;
renderHelp = function () {
  wW54RenderHelp();
  const g = $('wHelpRingGame') || $('wHelpRing'); if (!g || $('wHelpBcup')) return;
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpBcup"><b>The Anvil Belt.</b> Boxing's cup, every week at the Anvil Ring: ask Ma Gristle about the BELT, or use the Anvil Belt button on the card. ${W_BCUP.fee} gold to enter. Eight clubs, three rounds of cards, each harder than the last; lose and you're out. A drawn card goes to the toss of a coin. Win it for ${W_BCUP.prize.gold} gold, ${W_BCUP.prize.fans} fans and a pick of boxing cards. Your league fixture at the Anvil Ring is a card in the ring too (Play, Manage or Simulate), and the clubs' own fixtures there are boxed on the same engine.</p>`);
};
