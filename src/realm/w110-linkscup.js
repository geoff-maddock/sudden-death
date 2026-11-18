/* w110: the Divot Cup, and league fixtures at Mossgate Links on the course (issue #92, phase 9).
   The Divot Cup is golf's own cup, as the Pond Kettle (w95) is hockey's: every week at Mossgate Links (ask Agatha Divot
   about the CUP, or use the button on the Links tab or the match card). Eight fours in a bracket: you, rival clubs and
   the regions' own sides, on the standing nine (the cup never plays a wild nine). Three rounds, each one harder (the
   tier, so their level and their caddie's skill, goes up with the round). You play your own matches (Play, Manage or
   Simulate, as any golf match) and the rest of each round is simulated on the same engine once yours is done. Nobody
   goes home level: a match still level goes to a playoff. Lose and you're out; the rest of the bracket is played to a
   champion. Win the final and Agatha hands over her Divot Cup for the week: gold, fans, a pick of golf cards, a piece of
   golf gear you don't have (W_LINKS_CUP.gear; gold once you have them all), a line in the journal and a place on the
   Wall of Awards.
   League fixtures at the Links (w24): your fixture there is a golf match on the course (Play, Manage or Simulate)
   instead of a card match, and the clubs' own fixtures there are played on the engine. A win is two points on the table
   and the fixture's fans, and either way the fixture is done.

   WG.lkcup  { week, field: [8 ids, 'me' first], round: 0..2, games: [[{ a, b, ra, rb, w, end }]] by round, pending,
               show, out, done, champ } or null; ra, rb: holes won; end: '' | 'po' (a playoff). A concede is a loss.
               Plain JSON, as WG.hkcup.
   WG.lkcupWins, WG.lkcupLog: [{ year, day }]
   W_DIVOT   the numbers; W_DIVOT.force ('win' | 'lose') settles your next cup match that way (tests and the bot)
   wDivotEnter(), wDivotPlay(how), wDivotCatchUp(), wOpenDivot(), wDivotWon(), wLinksSimClubs(a, b, tier),
   wLkfixPlay(how), W_ON_END.lkcup, W_ON_END.lkfix
   Wrapped: wNextPrompt (wW110NextPrompt: the rest of the round, then the bracket), wCampLinks and wRenderCamp
   (wW110CampLinks, wW110RenderCamp: a Divot Cup button), wOpenLinksCard (wW110OpenLinksCard: the cup and your fixture),
   wOpenGrdCard (wW110OpenGrdCard: the Links' fixture row plays on the course), wSimAt (wW110SimAt: the clubs' matches at
   the Links on the engine), wRunAct (wW110RunAct: 'lkcup'), wWallText (wW110WallText), renderHelp (wW110RenderHelp:
   #wHelpLinksCup). */

const W_DIVOT = {
  fee: 40, size: 8,
  tiers: [1, 2, 3],               // the tier of each round: the caddie a Squire, a Knight, an Archmage
  rounds: ['Quarter-final', 'Semi-final', 'Final'],
  prize: { gold: 150, fans: 20, pick: 3 },
  force: null
};
const W_LINKS_CUP = { gear: ['gl_putter', 'gl_wedge', 'gl_glove', 'gl_driver', 'gl_irons', 'gl_tee'], gold: 60 };
const W_LKFIX = { links: 'g_links', tier: 2 };

// the bracket itself is w45b's (issue #86): this cup's numbers and words, and its own names for the bracket's parts
W_BRACKETS.lkcup = { K: W_DIVOT, name: 'Divot Cup', me: 'your four', store: 'games', view: 'links', verb: 'held', busy: 'Finish the golf match you started first.',
  live: () => wLinksLive(), base: () => wLinksProblems(), sim: (a, b, tier) => wDivotSim(a, b, tier), won: () => wDivotWon(),
  mark: g => g.end === 'po' ? '†' : '', hint: 'The scores are holes won. † Won in a playoff.' };
function wDivot() { return wBrk('lkcup'); }
function wDivotOn() { return wBrkOn('lkcup'); }
function wDivotName(id) { return wBrkName('lkcup', id); }
function wDivotMine() { return wBrkMine('lkcup'); }
function wDivotProblems() { return wBrkProblems('lkcup'); }
function wDivotEnter() { return wBrkEnter('lkcup'); }
function wDivotCatchUp() { return wBrkCatchUp('lkcup'); }
function wDivotBracket() { return wBrkBracket('lkcup'); }

const wDivotLive = () => wLinksLive() && WG.lkg.live.world.kind === 'lkcup';

function wDivotPlay(how) {
  const D = wDivot(), opp = wDivotMine(); if (!opp) return '';
  return wStartLinks({ club: opp, how, tier: W_DIVOT.tiers[D.round], kind: 'lkcup', ref: { week: D.week, round: D.round }, cup: true });
}
// your match's result; the rest of the round waits until you are back in the world (wDivotCatchUp)
W_ON_END.lkcup = function (r, ref, W) {
  const D = wDivot(); if (!D || !ref || D.done || ref.week !== D.week || ref.round !== D.round) return;
  const forced = W_DIVOT.force; W_DIVOT.force = null;
  // (a win or a loss is the result: conceding loses whatever the holes)
  const rr = forced || r, win = rr === 'win', w = win ? 'me' : W.club, last = (WG.lkg.games[0] || {}).end || '';
  D.games[D.round].push({ a: 'me', b: W.club, ra: W.us, rb: W.them, w, end: last });
  if (!win) D.out = true;
  D.pending = true;
  const how = W.text && W.text !== 'conceded' ? ` ${W.text}` : last === 'po' ? ' in a playoff' : '';
  wLog(win ? `${W_DIVOT.rounds[D.round]} won${how} against ${wDivotName(W.club)}.` : `Out of the Divot Cup in the ${W_DIVOT.rounds[D.round].toLowerCase()}, beaten${how} by ${wDivotName(W.club)}.`, win ? 'g' : 'b');
};
// a match you are not in, on the same engine, both sides on their caddies (and your own match, if one is on, kept).
// The fours are made for this match only: the one a rival keeps for its matches against you (WG.lkg.opp) is left as it was
function wLinksSimClubs(a, b, tier) {
  const B = wLkg(), kept = Object.assign({}, B.opp), teams = [wLinksOpp(a, tier), wLinksOpp(b, tier)];
  B.opp = kept;
  const sk = wLinksSkill(tier)[1], s = wGL.simGame({ teams, skill: [sk, sk], holes: wLinksHoles(), weather: wLinksWeather(), wood: true, powers: true, enchant: true });
  return { ra: s.won[0], rb: s.won[1], w: s.win === 0 ? a : b, end: s.played > s.holes ? 'po' : '', text: s.text };
}
function wDivotSim(a, b, tier) { const s = wLinksSimClubs(a, b, tier); return { a, b, ra: s.ra, rb: s.rb, w: s.w, end: s.end }; }
function wDivotWon() {
  const P = W_DIVOT.prize, D = wDivot(), f = D.games[2][0];
  RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans;
  WG.lkcupWins = (WG.lkcupWins || 0) + 1;
  WG.lkcupLog = (WG.lkcupLog || []).concat({ year: WG.year, day: WG.day });
  wLog(`You win the Divot Cup! Agatha hands it over with a warning about fingerprints, your four keep it for the week, and your name goes up on the Wall of Awards. ${P.gold} gold and ${P.fans} fans.`, 'g');
  try { wJAddWin({ at: wJStamp(), where: wJWhere(), k: 'title', t: 'Won the Divot Cup', opp: wBrkTeamName(f.a === 'me' ? f.b : f.a), sport: 'golf', score: f.a === 'me' ? `${f.ra}–${f.rb}` : `${f.rb}–${f.ra}` }); } catch (e) { console.error(e); }
  // the first piece of golf gear you don't have yet
  const have = id => (WG.items[id] || 0) > 0 || wRoster().some(p => p.gear && p.gear.links === id);
  const id = W_LINKS_CUP.gear.find(x => !have(x));
  if (id) { wAddItem(id, 1); wLog(`The Cup comes with gear: the ${W_LINKS_GEAR[id].name}. ${W_LINKS_GEAR[id].desc}`, 'g'); }
  else { RUN.gold += W_LINKS_CUP.gold; wLog(`You have every piece of golf gear, so the Cup pays ${W_LINKS_CUP.gold} gold more instead.`, 'g'); }
  const pool = wSportPool(['golf']);
  wGainCard(pool.length >= P.pick ? { pick: P.pick, pool } : { pick: P.pick, rarity: 'r' }, 'the Divot Cup prize');
}

/* ---------- the card: entry, the bracket, your next match ---------- */
function wOpenDivot(msg) {
  if (LAB || !WG) return;
  wDivotCatchUp();
  if (WG.cardOffer) { if ($('modal').hidden) wShowCardOffer(); return; }
  if (WG.lkcup) WG.lkcup.show = false;
  const D = wDivot(), on = wDivotOn(), probs = wDivotProblems(), opp = on && wDivotMine(), live = wDivotLive();
  let body;
  if (!on) {
    body = `<p>Eight fours, three rounds: the quarter-finals, the semi-finals and the final. Captain's choice match play on Mossgate's standing nine. Rival clubs and the regions' own sides enter. Each round is harder than the last. Lose once and you're out; nobody goes home level, so a match still level goes to a playoff.</p>
      <p class="hint">Entry ${W_DIVOT.fee} gold. Win it and Agatha hands over her Divot Cup for the week: ${W_DIVOT.prize.gold} gold, ${W_DIVOT.prize.fans} fans, a pick of ${W_DIVOT.prize.pick} golf cards, a piece of golf gear and a place on the Wall of Awards. Every match also pays as a golf match does. One cup a week.${WG.lkcupWins ? ` You have won it ${WG.lkcupWins} time${WG.lkcupWins === 1 ? '' : 's'}.` : ''}</p>
      ${D && D.done ? `<h5>Last week's bracket</h5>${wDivotBracket()}` : ''}
      ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
      <div class="row"><button class="btn" id="wDivotEnter" ${probs.length ? 'disabled' : ''}>Enter (${W_DIVOT.fee} gold)</button></div>`;
  } else {
    const tier = W_DIVOT.tiers[D.round], h = opp && wLinksH2h(opp);
    const next = live ? `<p>Your ${W_DIVOT.rounds[D.round].toLowerCase()} against ${esc(wDivotName(WG.lkg.live.world.club))} is waiting.</p><div class="row"><button class="btn" id="wDivotRes">Resume the match</button></div>`
      : opp ? `<p><b>${W_DIVOT.rounds[D.round]}</b> against ${esc(wDivotName(opp))}: their players are level ${wBallOppLvl(tier)}, their caddie a ${W_BALL_SKILL[wLinksSkill(tier)[1]]}.${h ? ` Last golf match: ${h.r === 'win' ? 'won' : 'lost'}${h.text ? ' ' + esc(h.text) : ''}.` : ''}</p>
        ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
        <div class="row">${Object.keys(W_LKG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-divothow="${how}" ${probs.length ? 'disabled' : ''}>${W_LKG_HOW[how]}</button>`).join('')}</div>` : '';
    body = `${next}${wDivotBracket()}`;
  }
  const close = modal(`<header><h3>The Divot Cup</h3><button class="ghost" data-close>Done</button></header>${msg ? `<p class="wbad">${esc(msg)}</p>` : ''}${body}`, () => wDrain());
  const again = r => { close(); wOpenDivot(r); };
  if ($('wDivotEnter')) $('wDivotEnter').onclick = () => again(wDivotEnter());
  if ($('wDivotRes')) $('wDivotRes').onclick = () => { close(); wResumeLinks(); };
  $('modalBox').querySelectorAll('[data-divothow]').forEach(b => b.onclick = () => {
    // (after Simulate, the Final card first; closing it brings the bracket back, through wNextPrompt)
    close(); const r = wDivotPlay(b.dataset.divothow); if (r) wOpenDivot(r);
  });
}
// back in the world after your match: the rest of the round, then the bracket
const wW110NextPrompt = wNextPrompt;
wNextPrompt = function () {
  const D = wDivot();
  if (!LAB && D && (D.pending || D.show) && !wLinksLive() && UI.view !== 'links' && wActive() && !WG.cardOffer && !WG.event) { wOpenDivot(); return true; }
  if (LAB && D && D.pending) wDivotCatchUp();
  return wW110NextPrompt();
};

/* ---------- league fixtures at the Links, on the course ---------- */
const wLkfixHere = () => wFixHere(W_LKFIX.links) || null;
function wLkfixPlay(how) {
  const f = wLkfixHere(); if (!f) return 'Your league fixture is not at Mossgate Links.';
  return wStartLinks({ club: f.club, how, tier: wFixTier(f.club, W_LKFIX.links), kind: 'lkfix', ref: { g: W_LKFIX.links, club: f.club, day: f.day }, cup: true });
}
// the fixture's end: as a fixture at any ground (w24's W_ON_END.ground), with the holes won; a rival's league row, and
// the head to head of any club in CLUBS, are counted in wLinksSettle already
W_ON_END.lkfix = function (r, ref, W) {
  if (!ref) return;
  const L = wLeague(), F = wFixtures(), club = ref.club;
  const f = F.games.find(x => (x.a === club && x.b === 'me') || (x.a === 'me' && x.b === club));
  // a match saved and finished after its round day: the fixture was postponed, so it's a match like any other now
  if (F.day !== ref.day || !f || f.done) { wLog('That fixture was postponed on its round day, so this match is no longer the fixture: it counts as any other match.', 'd'); return; }
  f.done = 1;
  if (!wIsRival(club)) { wLeagueMine(r); if (!CLUBS[club]) wH2hRecord(club, r, { us: W.us, them: W.them, sport: 'golf' }); }
  if (L.table[club]) { if (r === 'win') L.table[club].l++; else L.table[club].w++; }
  const res = r === 'win' ? { a: 'me', b: club, sa: W.us, sb: W.them } : { a: club, b: 'me', sa: W.them, sb: W.us };
  L.results.unshift(Object.assign(res, { day: WG.dayAbs, sport: 'golf', g: ref.g }));
  L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  if (r === 'win') {
    RUN.fans = (RUN.fans || 0) + W_FIX.fans;
    wLog(`Two points on the table. The gallery applauds politely, and stays: ${W_FIX.fans} fans.`, 'g');
    wMaybeBid(club);
  }
};
// the clubs' own fixtures at the Links: played on the engine (nobody goes home level)
const wW110SimAt = wSimAt;
wSimAt = function (a, b, g) {
  if (g !== W_LKFIX.links || LAB) return wW110SimAt(a, b, g);
  const L = wLeague(), s = wLinksSimClubs(a, b, W_LKFIX.tier), w = s.w, l = w === a ? b : a;
  L.table[w].w++; L.table[l].l++;
  const res = { day: WG.dayAbs, a: w, b: l, sport: 'golf', sa: Math.max(s.ra, s.rb), sb: Math.min(s.ra, s.rb), g };
  L.results.unshift(res); L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  return res;
};
// the Links' ground card: the fixture row plays on the course, with Play, Manage and Simulate
const wW110OpenGrdCard = wOpenGrdCard;
wOpenGrdCard = function (id, msg) {
  wW110OpenGrdCard(id, msg);
  if (id !== W_LKFIX.links) return;
  const b = document.querySelector('#modalBox [data-gfix]'), f = wLkfixHere(); if (!b || !f) return;
  const probs = wLinksProblems().concat(wLinksLive() ? ['Finish the golf match you started first.'] : []), row = b.closest('.row');
  row.innerHTML = Object.keys(W_LKG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-lkfixhow="${how}" ${probs.length ? 'disabled' : ''}>${W_LKG_HOW[how]}</button>`).join('');
  const small = row.closest('li').querySelector('small'); if (small) small.insertAdjacentHTML('beforeend', ` Played on the course with your four.${probs.length ? ' ' + esc(probs[0]) : ''}`);
  row.querySelectorAll('[data-lkfixhow]').forEach(x => x.onclick = () => { $('modalBox').querySelector('[data-close]').click(); const r = wLkfixPlay(x.dataset.lkfixhow); if (r) wOpenGrdCard(id, r); });
};

/* ---------- where it is: the Links, the Links tab, the match card ---------- */
{
  const K = DB.chars.gk_links;
  if (K) { K.topics.cup = { t: 'The Divot Cup: eight fours and three rounds, every week, on my standing nine. Win the final and the Cup is yours until the next one. It is polished every Sunday. By me. I take the entries.', act: 'lkcup' }; K.topics.job.t += ' I run the Divot CUP too.'; }
}
const wW110RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'lkcup') return wOpenDivot(); return wW110RunAct.apply(this, arguments); };
const wDivotBtn = () => `<button class="ghost" data-lkcup>Divot Cup${wDivotOn() ? ` (${W_DIVOT.rounds[wDivot().round].toLowerCase()})` : ''}</button>`;
const wW110CampLinks = wCampLinks;
wCampLinks = function (C) { return wW110CampLinks(C).replace('<button class="ghost" data-gpractice', `${wDivotBtn()}<button class="ghost" data-gpractice`); };
const wW110RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW110RenderCamp();
  const b = $('wCampBody') && WCAMP.tab === 'links' && $('wCampBody').querySelector('[data-lkcup]');
  if (b) b.onclick = () => { WCAMP.close(); wOpenDivot(); };
};
const wW110OpenLinksCard = wOpenLinksCard;
wOpenLinksCard = function () {
  wW110OpenLinksCard();
  const list = document.querySelector('#modalBox .wbclubs'); if (!list) return;
  const f = wLkfixHere();
  list.insertAdjacentHTML('afterend', `<p class="hint">The Divot Cup: eight fours, every week. ${wDivotBtn()}${f ? ` Your league fixture against ${esc(wTheClub(f.club))} is here at Mossgate Links, by day ${f.day}: play it from the ground's GAME card.` : ''}</p>`);
  const b = $('modalBox').querySelector('[data-lkcup]'); if (b) b.onclick = () => { $('modalBox').querySelector('[data-close]').click(); wOpenDivot(); };
};
const wW110WallText = wWallText;
wWallText = function () {
  wW110WallText();
  if (WG.lkcupWins) wLog(`On a velvet cushion, polished: Agatha's Divot Cup${WG.lkcupWins > 1 ? `, won ${WG.lkcupWins} times` : ''}, with your four's names engraved, small, round the base.`, 'g');
};
const wW110RenderHelp = renderHelp;
renderHelp = function () {
  wW110RenderHelp();
  const g = $('wHelpLinksStars') || $('wHelpLinksKit') || $('wHelpLinksGame'); if (!g || $('wHelpLinksCup')) return;
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLinksCup"><b>The Divot Cup.</b> Golf's cup, every week at Mossgate Links: ask Agatha Divot about the CUP, or use the Divot Cup button on the Links tab. ${W_DIVOT.fee} gold to enter. Eight fours in a bracket on the standing nine, three rounds, each harder than the last; you play your own matches and the rest are played out once yours is done. Nobody goes home level: a playoff settles it. Lose and you're out. Win the final and Agatha hands over the Divot Cup for the week: ${W_DIVOT.prize.gold} gold, ${W_DIVOT.prize.fans} fans, a pick of golf cards, a piece of golf gear and a place on the Wall of Awards. League fixtures at Mossgate Links are golf matches on the course too: Play, Manage or Simulate, and a win is two points on the table.</p>`);
};
