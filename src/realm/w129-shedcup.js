/* w129: the Brass Broom, and league fixtures at the Curling Shed on the ice (issue #102, phase 9), as w120 is the
   Lanes'. The Brass Broom is curling's own cup: every week at the Curling Shed (ask Brush Hennock about the CUP, or use
   the button on the Shed tab or the match card). Eight rinks in a bracket: you, rival clubs and the regions' own sides.
   Three rounds of one game each: a weaker rink in the quarter-final, then rinks at your own level (the tier: their
   level and how well they curl). You curl your own games (Play, Manage or Simulate, as any curling match) and the rest
   of each round is simulated on the same engine once yours is done. Nobody goes home level: an extra end. Lose and
   you're out; the rest of the bracket is played to a champion. Win the final and Hennock hands over the Brass Broom for
   the week: gold, fans, a pick of cards, a piece of curling gear you don't have (W_SHED_CUP.gear; gold once you have
   them all), a line in the journal and a place on the Wall of Awards.
   League fixtures at the Shed (w24): your fixture there is a curling match (Play, Manage or Simulate) instead of a card
   match, and the clubs' own fixtures there are played on the engine. A win is two points on the table and the
   fixture's fans, and either way the fixture is done.

   WG.crcup  { week, field: [8 ids, 'me' first], round: 0..2, games: [[{ a, b, ra, rb, w, end }]] by round, pending, show,
               out, done, champ } or null. ra, rb: the points; end: '' | 'xe' (an extra end decided it). Plain JSON, as
               WG.lncup.
   WG.crcupWins, WG.crcupLog: [{ year, day }]
   W_BROOM   the numbers; W_BROOM.force ('win' | 'lose') settles your next cup match that way (tests and the bot)
   wBroomEnter(), wBroomPlay(how), wBroomCatchUp(), wOpenBroom(), wBroomWon(), wShedSimClubs(a, b, tier),
   wCrfixPlay(how), W_ON_END.crcup, W_ON_END.crfix
   Wrapped: wNextPrompt (wW129NextPrompt: the rest of the round, then the bracket), wCampShed and wRenderCamp
   (wW129CampShed, wW129RenderCamp: a Brass Broom button), wOpenShedCard (wW129OpenShedCard: the cup and your fixture),
   wOpenGrdCard (wW129OpenGrdCard: the Shed's fixture row plays on the ice), wSimAt (wW129SimAt: the clubs' matches at
   the Shed on the engine), wRunAct (wW129RunAct: 'crcup'), wWallText (wW129WallText), renderHelp (wW129RenderHelp:
   #wHelpShedCup). */

const W_BROOM = {
  fee: 40, size: 8,
  tiers: [1, 2, 2],               // the tier of each round: they curl like a Squire, then a Knight (to be measured: phase 10)
  rounds: ['Quarter-final', 'Semi-final', 'Final'],
  prize: { gold: 150, fans: 20, pick: 3 },
  force: null
};
const W_SHED_CUP = { gear: ['cr_broom', 'cr_slider', 'cr_gripper', 'cr_charm', 'cr_polish', 'cr_stopwatch'], gold: 60 };
const W_CRFIX = { g: 'g_shed', tier: 2 };
W_BRACKETS.crcup = { K: W_BROOM, name: 'Brass Broom', me: 'your four', store: 'games', view: 'shed', verb: 'held', busy: 'Finish the curling match you started first.',
  live: () => wShedLive(), base: () => wShedProblems(), sim: (a, b, tier) => wBroomSim(a, b, tier), won: () => wBroomWon(),
  mark: g => g.end === 'xe' ? '†' : g.end === 'c' ? '‡' : '', hint: 'The scores are points. † Settled in an extra end. ‡ Conceded (the score when it was given up).' };
function wBroom() { return wBrk('crcup'); }
function wBroomOn() { return wBrkOn('crcup'); }
function wBroomName(id) { return wBrkName('crcup', id); }
function wBroomMine() { return wBrkMine('crcup'); }
function wBroomProblems() { return wBrkProblems('crcup'); }
function wBroomEnter() { return wBrkEnter('crcup'); }
function wBroomCatchUp() { return wBrkCatchUp('crcup'); }
function wBroomBracket() { return wBrkBracket('crcup'); }

const wBroomLive = () => wShedLive() && WG.shg.live.world.kind === 'crcup';
function wBroomPlay(how) {
  const D = wBroom(), opp = wBroomMine(); if (!opp) return '';
  return wStartShed({ club: opp, how, tier: W_BROOM.tiers[D.round], kind: 'crcup', ref: { week: D.week, round: D.round }, cup: true });
}
// your game's result; the rest of the round waits until you are back in the world (wBroomCatchUp)
W_ON_END.crcup = function (r, ref, W) {
  const D = wBroom(); if (!D || !ref || D.done || ref.week !== D.week || ref.round !== D.round) return;
  const forced = W_BROOM.force; W_BROOM.force = null;
  const win = (forced || r) === 'win', end = forced ? '' : ((WG.shg.games[0] || {}).end) || '', rd = W_BROOM.rounds[D.round];
  const how = W.text && W.text !== 'conceded' ? ` ${W.text}` : W.text === 'conceded' ? ', conceded' : '';
  // (a forced result's score is turned round to fit it, for the tests and the bot; a concede is marked)
  let ra = W.us, rb = W.them; if (forced && (win ? ra <= rb : rb <= ra)) { [ra, rb] = ra === rb ? (win ? [ra + 1, rb] : [ra, rb + 1]) : [rb, ra]; }
  const row = { a: 'me', b: W.club, ra, rb, w: win ? 'me' : W.club, end: W.text === 'conceded' && !forced ? 'c' : end };
  D.games[D.round].push(row);
  if (!win) D.out = true;
  D.pending = true;
  const said = how + (end === 'xe' ? ' in an extra end' : '');
  wLog(win ? `${rd} won${said} against ${wBroomName(W.club)}.` : `Out of the Brass Broom in the ${rd.toLowerCase()}, beaten${said} by ${wBroomName(W.club)}.`, win ? 'g' : 'b');
};
// a game you are not in, on the same engine, both rinks curling at the tier. Their fours are made for this game only:
// the one a rival keeps for its games against you (WG.shg.opp) is left as it was
function wShedSimClubs(a, b, tier) {
  const B = wShg(), kept = JSON.parse(JSON.stringify(B.opp)), teams = [wShedOpp(a, tier), wShedOpp(b, tier)];
  B.opp = kept;
  const sk = wShedSkillOf(tier)[1], s = wCR.simGame({ teams, skill: [sk, sk], ends: wShedEnds(), cold: wShedColdNow(), hall: true, powers: true, seed: (Math.random() * 1e9) | 0 });
  const t = (s.tot || [0, 0]).slice();
  // (a game still level when the engine stops is settled as an extra end would be: one more for the side it falls to)
  if (s.win !== 0 && s.win !== 1) { const k = Math.random() < .5 ? 0 : 1; t[k]++; return { ra: t[0], rb: t[1], w: k === 0 ? a : b, end: 'xe' }; }
  return { ra: t[0], rb: t[1], w: s.win === 0 ? a : b, end: s.extra ? 'xe' : '' };
}
function wBroomSim(a, b, tier) { const s = wShedSimClubs(a, b, tier); return { a, b, ra: s.ra, rb: s.rb, w: s.w, end: s.end }; }
function wBroomWon() {
  const P = W_BROOM.prize, D = wBroom(), f = D.games[2][0];
  RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans;
  WG.crcupWins = (WG.crcupWins || 0) + 1;
  WG.crcupLog = (WG.crcupLog || []).concat({ year: WG.year, day: WG.day });
  wLog(`You win the Brass Broom! Brush Hennock hands it over (polished till you can see your face in it, and warm from the stove), your four keep it for the week, and your name goes up on the Wall of Awards. ${P.gold} gold and ${P.fans} fans.`, 'g');
  try { wJAddWin({ at: wJStamp(), where: wJWhere(), k: 'title', t: 'Won the Brass Broom', opp: wBrkTeamName(f.a === 'me' ? f.b : f.a), sport: 'curling', score: f.a === 'me' ? `${f.ra}–${f.rb}` : `${f.rb}–${f.ra}` }); } catch (e) { console.error(e); }
  const have = id => (WG.items[id] || 0) > 0 || wRoster().some(p => p.gear && p.gear.shed === id);
  const id = W_SHED_CUP.gear.find(x => !have(x));
  if (id) { wAddItem(id, 1); wLog(`The Broom comes with gear: the ${W_SHED_GEAR[id].name}. ${W_SHED_GEAR[id].desc}`, 'g'); }
  else { RUN.gold += W_SHED_CUP.gold; wLog(`You have every piece of curling gear, so the Broom pays ${W_SHED_CUP.gold} gold more instead.`, 'g'); }
  const pool = wSportPool(['curling']);
  wGainCard(pool.length >= P.pick ? { pick: P.pick, pool } : { pick: P.pick, rarity: 'r' }, 'the Brass Broom prize');
}

/* ---------- the card: entry, the bracket, your next game ---------- */
function wOpenBroom(msg) {
  if (LAB || !WG) return;
  wBroomCatchUp();
  if (WG.cardOffer) { if ($('modal').hidden) wShowCardOffer(); return; }
  if (WG.crcup) WG.crcup.show = false;
  const D = wBroom(), on = wBroomOn(), live = wBroomLive(), probs = wBroomProblems().concat(on && wShedLive() && !live ? [W_BRACKETS.crcup.busy] : []), opp = on && wBroomMine();
  let body;
  if (!on) {
    body = `<p>Eight rinks, three rounds, one game each. Rival clubs and the regions' own sides enter. A weaker rink in the quarter-final, then rinks at your own level, and they bring their bags. Curl your own games (Play, Manage or Simulate); the rest of each round plays out on the ice once yours is done. Nobody goes home level: an extra end.</p>
      <p class="hint">Entry ${W_BROOM.fee} gold. Win it and Hennock hands over the Brass Broom for the week: ${W_BROOM.prize.gold} gold, ${W_BROOM.prize.fans} fans, a pick of ${W_BROOM.prize.pick} cards, a piece of curling gear and a place on the Wall of Awards.</p>
      ${D && D.done ? `<h5>Last week's bracket</h5>${wBroomBracket()}` : ''}
      ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
      <div class="row"><button class="btn" id="wBroomEnter" ${probs.length ? 'disabled' : ''}>Enter (${W_BROOM.fee} gold)</button></div>`;
  } else {
    const tier = W_BROOM.tiers[D.round], h = opp && wShedH2h(opp);
    const next = live ? `<p>Your ${W_BROOM.rounds[D.round].toLowerCase()} against ${esc(wBroomName(WG.shg.live.world.club))} is waiting.</p><div class="row"><button class="btn" id="wBroomRes">Resume the match</button></div>`
      : opp ? `<p><b>${W_BROOM.rounds[D.round]}</b> against ${esc(wBroomName(opp))}: their curlers are level ${wBallOppLvl(tier)}, and their skip plays like a ${W_BALL_SKILL[wShedSkillOf(tier)[1]]}.${h ? ` Last curling match: ${h.r === 'win' ? 'won' : 'lost'}${h.text ? ' ' + esc(h.text) : ''}.` : ''}</p>
        ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
        <div class="row">${Object.keys(W_SHG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-broomhow="${how}" ${probs.length ? 'disabled' : ''}>${W_SHG_HOW[how]}</button>`).join('')}</div>` : '';
    body = `${next}${wBroomBracket()}`;
  }
  const close = modal(`<header><h3>The Brass Broom</h3><button class="ghost" data-close>Done</button></header>${msg ? `<p class="wbad">${esc(msg)}</p>` : ''}${body}`, () => wDrain());
  const again = r => { close(); wOpenBroom(r); };
  if ($('wBroomEnter')) $('wBroomEnter').onclick = () => again(wBroomEnter());
  if ($('wBroomRes')) $('wBroomRes').onclick = () => { close(); wResumeShed(); };
  $('modalBox').querySelectorAll('[data-broomhow]').forEach(b => b.onclick = () => { close(); const r = wBroomPlay(b.dataset.broomhow); if (r) wOpenBroom(r); });
}
const wW129NextPrompt = wNextPrompt;
wNextPrompt = function () {
  const D = wBroom();
  if (!LAB && D && (D.pending || D.show) && !wShedLive() && UI.view !== 'shed' && wActive() && !WG.cardOffer && !WG.event) { wOpenBroom(); return true; }
  if (LAB && D && D.pending) wBroomCatchUp();
  return wW129NextPrompt();
};

/* ---------- league fixtures at the Shed, on the ice ---------- */
const wCrfixHere = () => wFixHere(W_CRFIX.g) || null;
function wCrfixPlay(how) {
  const f = wCrfixHere(); if (!f) return 'Your league fixture is not at the Curling Shed.';
  return wStartShed({ club: f.club, how, tier: wFixTier(f.club, W_CRFIX.g), kind: 'crfix', ref: { g: W_CRFIX.g, club: f.club, day: f.day }, cup: true });
}
// the fixture's end: as a fixture at any ground (w24's W_ON_END.ground), with the points; a rival's league row, and the
// head to head of any club in CLUBS, are counted in wShedSettle already
W_ON_END.crfix = function (r, ref, W) {
  if (!ref) return;
  const L = wLeague(), F = wFixtures(), club = ref.club;
  const f = F.games.find(x => (x.a === club && x.b === 'me') || (x.a === 'me' && x.b === club));
  if (F.day !== ref.day || !f || f.done) { wLog('That fixture was postponed on its round day, so this match is no longer the fixture: it counts as any other match.', 'd'); return; }
  f.done = 1;
  if (!wIsRival(club)) { wLeagueMine(r); if (!CLUBS[club]) wH2hRecord(club, r, { us: W.us, them: W.them, sport: 'curling' }); }
  if (L.table[club]) { if (r === 'win') L.table[club].l++; else L.table[club].w++; }
  const res = r === 'win' ? { a: 'me', b: club, sa: W.us, sb: W.them } : { a: club, b: 'me', sa: W.them, sb: W.us };
  L.results.unshift(Object.assign(res, { day: WG.dayAbs, sport: 'curling', g: ref.g }, W.text === 'conceded' ? { cd: 1 } : {}));
  L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  if (r === 'win') {
    RUN.fans = (RUN.fans || 0) + W_FIX.fans;
    wLog(`Two points on the table. The gallery stamps its boots on the boards, and stays: ${W_FIX.fans} fans.`, 'g');
    wMaybeBid(club);
  }
};
const wW129SimAt = wSimAt;
wSimAt = function (a, b, g) {
  if (g !== W_CRFIX.g || LAB) return wW129SimAt(a, b, g);
  const L = wLeague(), s = wShedSimClubs(a, b, W_CRFIX.tier), w = s.w, l = w === a ? b : a;
  L.table[w].w++; L.table[l].l++;
  const res = { day: WG.dayAbs, a: w, b: l, sport: 'curling', sa: Math.max(s.ra, s.rb), sb: Math.min(s.ra, s.rb), g };
  L.results.unshift(res); L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  return res;
};
const wW129OpenGrdCard = wOpenGrdCard;
wOpenGrdCard = function (id, msg) {
  wW129OpenGrdCard(id, msg);
  if (id !== W_CRFIX.g) return;
  const b = document.querySelector('#modalBox [data-gfix]'), f = wCrfixHere(); if (!b || !f) return;
  const probs = wShedProblems().concat(wShedLive() ? ['Finish the curling match you started first.'] : []), row = b.closest('.row');
  row.innerHTML = Object.keys(W_SHG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-crfixhow="${how}" ${probs.length ? 'disabled' : ''}>${W_SHG_HOW[how]}</button>`).join('');
  const small = row.closest('li').querySelector('small'); if (small) small.insertAdjacentHTML('beforeend', ` Curled on the ice with your four.${probs.length ? ' ' + esc(probs[0]) : ''}`);
  row.querySelectorAll('[data-crfixhow]').forEach(x => x.onclick = () => { $('modalBox').querySelector('[data-close]').click(); const r = wCrfixPlay(x.dataset.crfixhow); if (r) wOpenGrdCard(id, r); });
};

/* ---------- where it is: the Shed, the Shed tab, the match card ---------- */
{
  const K = DB.chars.gk_shed;
  if (K) { K.topics.cup = { t: 'The Brass Broom: eight rinks and three rounds, every week, right here on my ice. One game a round, and nobody goes home level. Win it and the Broom hangs over your fire till the next one. Don\'t sweep with it. People try.', act: 'crcup' }; K.topics.job.t += ' And every week there\'s the Brass Broom: ask me about the CUP.'; }
}
const wW129RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'crcup') return wOpenBroom(); return wW129RunAct.apply(this, arguments); };
const wBroomBtn = () => `<button class="ghost" data-crcup>Brass Broom${wBroomOn() ? ` (${W_BROOM.rounds[wBroom().round].toLowerCase()})` : ''}</button>`;
const wW129CampShed = wCampShed;
wCampShed = function (C) { return wW129CampShed(C).replace('<button class="ghost" data-cpractice', `${wBroomBtn()}<button class="ghost" data-cpractice`); };
const wW129RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW129RenderCamp();
  const b = $('wCampBody') && WCAMP.tab === 'shed' && $('wCampBody').querySelector('[data-crcup]');
  if (b) b.onclick = () => { WCAMP.close(); wOpenBroom(); };
};
const wW129OpenShedCard = wOpenShedCard;
wOpenShedCard = function () {
  wW129OpenShedCard();
  const list = document.querySelector('#modalBox .wbclubs'); if (!list) return;
  const f = wCrfixHere();
  list.insertAdjacentHTML('afterend', `<p class="hint">The Brass Broom: eight rinks, every week, one game a round. ${wBroomBtn()}${f ? ` Your league fixture against ${esc(wTheClub(f.club))} is here at the Curling Shed, by day ${f.day}: curl it from the ground's card.` : ''}</p>`);
  const b = $('modalBox').querySelector('[data-crcup]'); if (b) b.onclick = () => { $('modalBox').querySelector('[data-close]').click(); wOpenBroom(); };
};
const wW129WallText = wWallText;
wWallText = function () {
  wW129WallText();
  if (WG.crcupWins) wLog(`On two hooks over the fire: Hennock's Brass Broom${WG.crcupWins > 1 ? `, won ${WG.crcupWins} times` : ''}, its head polished bright, your four's names engraved down the handle.`, 'g');
};
const wW129RenderHelp = renderHelp;
renderHelp = function () {
  wW129RenderHelp();
  const g = $('wHelpShedStars') || $('wHelpShedKit') || $('wHelpShedGame'); if (!g || $('wHelpShedCup')) return;
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpShedCup"><b>The Brass Broom.</b> Curling's cup, every week at the Curling Shed: ask Brush Hennock about the CUP, or use the Brass Broom button on the Shed tab. ${W_BROOM.fee} gold to enter. Eight rinks, three rounds of one game each; nobody goes home level (an extra end), and lose and you're out. Win it for ${W_BROOM.prize.gold} gold, ${W_BROOM.prize.fans} fans, a pick of cards and a piece of curling gear. Your league fixture at the Shed is curled on the ice too.</p>`);
};
