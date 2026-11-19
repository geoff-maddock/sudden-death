/* w120: the Gutter Cup, and league fixtures at the Saltmere Lanes on the lanes (issue #100, phase 9), as w110 is golf's.
   The Gutter Cup is bowling's own cup: every week at the Saltmere Lanes (ask Moll Gutter about the CUP, or use the button
   on the Lanes tab or the match card). Eight fives in a bracket: you, rival clubs and the regions' own sides. Three
   rounds: a weaker side in the quarter-final, then sides at your own level (the tier: their level and how well they
   bowl), the final best of three (the phase 10 lab: at tier 3 a best of three was won 8% of the time). The quarter- and
   semi-finals are one team game; the final is best of three games. You bowl your own games (Play, Manage or Simulate,
   as any bowling match) and the rest of each round is simulated on the same engine once yours is done. Nobody goes home
   level: a roll-off. Lose and you're out; the rest of the bracket is played to a champion. Win the final and Moll hands
   over her Gutter Cup for the week: gold, fans, a pick of cards, a piece of bowling gear you don't have
   (W_LANES_CUP.gear; gold once you have them all), a line in the journal and a place on the Wall of Awards.
   League fixtures at the Lanes (w24): your fixture there is a bowling match (Play, Manage or Simulate) instead of a card
   match, and the clubs' own fixtures there are played on the engine. A win is two points on the table and the
   fixture's fans, and either way the fixture is done.

   WG.lncup  { week, field: [8 ids, 'me' first], round: 0..2, games: [[{ a, b, ra, rb, w, end, gs? }]] by round, pending,
               show, out, done, champ, ser } or null. ra, rb: the pins in a one-game round, the games won in the final
               (gs: each game's pins, [[a, b], ...]); end: '' | 'ro' (a roll-off decided it). ser: your final so far,
               { opp, gs: [[us, them, w]] }, until one side has two. A concede loses that game. Plain JSON, as WG.lkcup.
   WG.lncupWins, WG.lncupLog: [{ year, day }]
   W_GUTTER  the numbers; W_GUTTER.force ('win' | 'lose') settles your next cup match (the whole final) that way (tests
             and the bot)
   wGutterEnter(), wGutterPlay(how), wGutterCatchUp(), wOpenGutter(), wGutterWon(), wLanesSimClubs(a, b, tier, games),
   wLnfixPlay(how), W_ON_END.lncup, W_ON_END.lnfix
   Wrapped: wNextPrompt (wW120NextPrompt: the next game of the final, the rest of the round, then the bracket), wCampLanes
   and wRenderCamp (wW120CampLanes, wW120RenderCamp: a Gutter Cup button), wOpenLanesCard (wW120OpenLanesCard: the cup
   and your fixture), wOpenGrdCard (wW120OpenGrdCard: the Lanes' fixture row plays on the lanes), wSimAt (wW120SimAt: the
   clubs' matches at the Lanes on the engine), wRunAct (wW120RunAct: 'lncup'), wWallText (wW120WallText), renderHelp
   (wW120RenderHelp: #wHelpLanesCup). */

const W_GUTTER = {
  fee: 40, size: 8,
  tiers: [1, 2, 2],               // the tier of each round: they bowl like a Squire, then a Knight (the final is best of three)
  rounds: ['Quarter-final', 'Semi-final', 'Final'],
  bestOf: [1, 1, 3],
  prize: { gold: 150, fans: 20, pick: 3 },
  force: null
};
const W_LANES_CUP = { gear: ['bl_reactive', 'bl_brace', 'bl_rosin', 'bl_urethane', 'bl_shoes', 'bl_luckypin'], gold: 60 };
const W_LNFIX = { g: 'g_lanes', tier: 2 };

W_BRACKETS.lncup = { K: W_GUTTER, name: 'Gutter Cup', me: 'your five', store: 'games', view: 'lanes', verb: 'held', busy: 'Finish the bowling match you started first.',
  live: () => wLanesLive(), base: () => wLanesProblems(), sim: (a, b, tier) => wGutterSim(a, b, tier), won: () => wGutterWon(),
  mark: g => g.end === 'ro' ? '†' : '', hint: 'The scores are pins, and games won in the final (best of three). † Settled in a roll-off.' };
function wGutter() { return wBrk('lncup'); }
function wGutterOn() { return wBrkOn('lncup'); }
function wGutterName(id) { return wBrkName('lncup', id); }
function wGutterMine() { return wBrkMine('lncup'); }
function wGutterProblems() { return wBrkProblems('lncup'); }
function wGutterEnter() { return wBrkEnter('lncup'); }
function wGutterCatchUp() { return wBrkCatchUp('lncup'); }
function wGutterBracket() { return wBrkBracket('lncup'); }

const wGutterLive = () => wLanesLive() && WG.lng.live.world.kind === 'lncup';
const wGutterBest = r => W_GUTTER.bestOf[r] || 1;
// your final so far: the games, and how many each side has
function wGutterSer() {
  const D = wGutter(), opp = wGutterMine(); if (!D || !opp || D.round !== 2) return null;
  if (!D.ser || D.ser.opp !== opp) D.ser = { opp, gs: [] };
  const S = D.ser; return { opp, gs: S.gs, us: S.gs.filter(g => g[2] === 'me').length, them: S.gs.filter(g => g[2] !== 'me').length };
}

function wGutterPlay(how) {
  const D = wGutter(), opp = wGutterMine(); if (!opp) return '';
  return wStartLanes({ club: opp, how, tier: W_GUTTER.tiers[D.round], kind: 'lncup', ref: { week: D.week, round: D.round }, cup: true });
}
// your game's result. In a one-game round it is the match; in the final, a game of the series, and the match once one
// side has two. The rest of the round waits until you are back in the world (wGutterCatchUp)
W_ON_END.lncup = function (r, ref, W) {
  const D = wGutter(); if (!D || !ref || D.done || ref.week !== D.week || ref.round !== D.round) return;
  const forced = W_GUTTER.force; W_GUTTER.force = null;
  const rr = forced || r, win = rr === 'win', end = ((WG.lng.games[0] || {}).end) || '', rd = W_GUTTER.rounds[D.round];
  const how = W.text && W.text !== 'conceded' ? ` ${W.text}` : W.text === 'conceded' ? ', conceded' : '';
  let row;
  if (wGutterBest(D.round) > 1 && !forced) {
    const S = wGutterSer(); D.ser.gs.push([W.us, W.them, win ? 'me' : W.club]);
    const us = S.us + (win ? 1 : 0), them = S.them + (win ? 0 : 1), need = Math.ceil(wGutterBest(D.round) / 2), n = D.ser.gs.length;
    if (us < need && them < need) {
      D.show = true;
      wLog(`Game ${n} of the final ${win ? 'won' : 'lost'}${how}. The series stands ${us}–${them}${win ? '' : ' against you'}: game ${n + 1} is next.`, win ? 'g' : 'b');
      return;
    }
    row = { a: 'me', b: W.club, ra: us, rb: them, w: us > them ? 'me' : W.club, end: '', gs: D.ser.gs.map(g => [g[0], g[1]]) };
    D.ser = null;
  } else row = { a: 'me', b: W.club, ra: W.us, rb: W.them, w: win ? 'me' : W.club, end: forced ? '' : end };
  D.games[D.round].push(row);
  const won = row.w === 'me';
  if (!won) D.out = true;
  D.pending = true;
  const said = row.gs ? ` ${row.ra}–${row.rb} in games` : how + (row.end === 'ro' ? ' in a roll-off' : '');
  wLog(won ? `${rd} won${said} against ${wGutterName(W.club)}.` : `Out of the Gutter Cup in the ${rd.toLowerCase()}, beaten${said} by ${wGutterName(W.club)}.`, won ? 'g' : 'b');
};
// a game (or a series of them) you are not in, on the same engine, both sides bowling at the tier. Their fives are made
// for this game only: the one a rival keeps for its games against you (WG.lng.opp) is left as it was
function wLanesSimClubs(a, b, tier, games) {
  const B = wLng(), kept = JSON.parse(JSON.stringify(B.opp)), teams = [wLanesOpp(a, tier), wLanesOpp(b, tier)];
  B.opp = kept;
  const sk = wLanesSkillOf(tier)[1], need = Math.ceil((games || 1) / 2), gs = []; let wa = 0, wb = 0, ro = false;
  while (wa < need && wb < need) {
    const s = wBL.simGame({ teams, skill: [sk, sk], frames: wLanesFrames(), tide: wLanesTideNow(), hall: true, powers: true, seed: (Math.random() * 1e9) | 0 });
    const t = s.game || s.tot || [0, 0]; gs.push([t[0], t[1]]); if (s.ro) ro = true;
    if (s.win === 0) wa++; else wb++;
  }
  const one = games > 1 ? null : gs[0];
  return { ra: one ? one[0] : wa, rb: one ? one[1] : wb, w: wa > wb ? a : b, end: one && ro ? 'ro' : '', gs };
}
// (the round is the bracket's own, as it plays the round out: two rounds share a tier, so the tier can't say which)
function wGutterSim(a, b, tier, round) {
  const D = wGutter(), r = round != null ? round : D && !D.done ? D.round : 0, n = wGutterBest(r), s = wLanesSimClubs(a, b, tier, n);
  return Object.assign({ a, b, ra: s.ra, rb: s.rb, w: s.w, end: s.end }, n > 1 ? { gs: s.gs } : {});
}
function wGutterWon() {
  const P = W_GUTTER.prize, D = wGutter(), f = D.games[2][0];
  RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans;
  WG.lncupWins = (WG.lncupWins || 0) + 1;
  WG.lncupLog = (WG.lncupLog || []).concat({ year: WG.year, day: WG.day });
  wLog(`You win the Gutter Cup! Moll hands it over (it smells faintly of lane oil and herring), your five keep it for the week, and your name goes up on the Wall of Awards. ${P.gold} gold and ${P.fans} fans.`, 'g');
  try { wJAddWin({ at: wJStamp(), where: wJWhere(), k: 'title', t: 'Won the Gutter Cup', opp: wBrkTeamName(f.a === 'me' ? f.b : f.a), sport: 'bowling', score: f.a === 'me' ? `${f.ra}–${f.rb}` : `${f.rb}–${f.ra}` }); } catch (e) { console.error(e); }
  const have = id => (WG.items[id] || 0) > 0 || wRoster().some(p => p.gear && p.gear.lanes === id);
  const id = W_LANES_CUP.gear.find(x => !have(x));
  if (id) { wAddItem(id, 1); wLog(`The Cup comes with gear: the ${W_LANES_GEAR[id].name}. ${W_LANES_GEAR[id].desc}`, 'g'); }
  else { RUN.gold += W_LANES_CUP.gold; wLog(`You have every piece of bowling gear, so the Cup pays ${W_LANES_CUP.gold} gold more instead.`, 'g'); }
  const pool = wSportPool(['bowling']);
  wGainCard(pool.length >= P.pick ? { pick: P.pick, pool } : { pick: P.pick, rarity: 'r' }, 'the Gutter Cup prize');
}

/* ---------- the card: entry, the bracket, your next game ---------- */
function wOpenGutter(msg) {
  if (LAB || !WG) return;
  wGutterCatchUp();
  if (WG.cardOffer) { if ($('modal').hidden) wShowCardOffer(); return; }
  if (WG.lncup) WG.lncup.show = false;
  const D = wGutter(), on = wGutterOn(), probs = wGutterProblems(), opp = on && wGutterMine(), live = wGutterLive();
  let body;
  if (!on) {
    body = `<p>Eight fives, three rounds: the quarter-finals and the semi-finals are one team game each, and the final is best of three. Rival clubs and the regions' own sides enter. A weaker side in the quarter-final, then sides at your own level, and they bring their best to the final. Lose once and you're out; nobody goes home level, so a tied game goes to a roll-off.</p>
      <p class="hint">Entry ${W_GUTTER.fee} gold. Win it and Moll hands over her Gutter Cup for the week: ${W_GUTTER.prize.gold} gold, ${W_GUTTER.prize.fans} fans, a pick of ${W_GUTTER.prize.pick} cards, a piece of bowling gear and a place on the Wall of Awards. Every game also pays as a bowling match does. One cup a week.${WG.lncupWins ? ` You have won it ${WG.lncupWins} time${WG.lncupWins === 1 ? '' : 's'}.` : ''}</p>
      ${D && D.done ? `<h5>Last week's bracket</h5>${wGutterBracket()}` : ''}
      ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
      <div class="row"><button class="btn" id="wGutterEnter" ${probs.length ? 'disabled' : ''}>Enter (${W_GUTTER.fee} gold)</button></div>`;
  } else {
    const tier = W_GUTTER.tiers[D.round], h = opp && wLanesH2h(opp), S = wGutterSer();
    const ser = S ? ` Best of three: game ${S.gs.length + 1}${S.gs.length ? `, and the series stands ${S.us}–${S.them} (${S.gs.map(g => `${g[0]}–${g[1]}`).join(', ')})` : ''}.` : '';
    const next = live ? `<p>Your ${W_GUTTER.rounds[D.round].toLowerCase()} against ${esc(wGutterName(WG.lng.live.world.club))} is waiting.</p><div class="row"><button class="btn" id="wGutterRes">Resume the match</button></div>`
      : opp ? `<p><b>${W_GUTTER.rounds[D.round]}</b> against ${esc(wGutterName(opp))}: their bowlers are level ${wBallOppLvl(tier)}, and bowl like a ${W_BALL_SKILL[wLanesSkillOf(tier)[1]]}.${ser}${h ? ` Last bowling match: ${h.r === 'win' ? 'won' : 'lost'}${h.text ? ' ' + esc(h.text) : ''}.` : ''}</p>
        ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
        <div class="row">${Object.keys(W_LNG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-gutterhow="${how}" ${probs.length ? 'disabled' : ''}>${W_LNG_HOW[how]}</button>`).join('')}</div>` : '';
    body = `${next}${wGutterBracket()}`;
  }
  const close = modal(`<header><h3>The Gutter Cup</h3><button class="ghost" data-close>Done</button></header>${msg ? `<p class="wbad">${esc(msg)}</p>` : ''}${body}`, () => wDrain());
  const again = r => { close(); wOpenGutter(r); };
  if ($('wGutterEnter')) $('wGutterEnter').onclick = () => again(wGutterEnter());
  if ($('wGutterRes')) $('wGutterRes').onclick = () => { close(); wResumeLanes(); };
  $('modalBox').querySelectorAll('[data-gutterhow]').forEach(b => b.onclick = () => {
    // (after Simulate, the Final card first; closing it brings the bracket back, through wNextPrompt)
    close(); const r = wGutterPlay(b.dataset.gutterhow); if (r) wOpenGutter(r);
  });
}
const wW120NextPrompt = wNextPrompt;
wNextPrompt = function () {
  const D = wGutter();
  if (!LAB && D && (D.pending || D.show) && !wLanesLive() && UI.view !== 'lanes' && wActive() && !WG.cardOffer && !WG.event) { wOpenGutter(); return true; }
  if (LAB && D && D.pending) wGutterCatchUp();
  return wW120NextPrompt();
};

/* ---------- league fixtures at the Lanes, on the lanes ---------- */
const wLnfixHere = () => wFixHere(W_LNFIX.g) || null;
function wLnfixPlay(how) {
  const f = wLnfixHere(); if (!f) return 'Your league fixture is not at the Saltmere Lanes.';
  return wStartLanes({ club: f.club, how, tier: wFixTier(f.club, W_LNFIX.g), kind: 'lnfix', ref: { g: W_LNFIX.g, club: f.club, day: f.day }, cup: true });
}
// the fixture's end: as a fixture at any ground (w24's W_ON_END.ground), with the pins; a rival's league row, and the
// head to head of any club in CLUBS, are counted in wLanesSettle already
W_ON_END.lnfix = function (r, ref, W) {
  if (!ref) return;
  const L = wLeague(), F = wFixtures(), club = ref.club;
  const f = F.games.find(x => (x.a === club && x.b === 'me') || (x.a === 'me' && x.b === club));
  if (F.day !== ref.day || !f || f.done) { wLog('That fixture was postponed on its round day, so this match is no longer the fixture: it counts as any other match.', 'd'); return; }
  f.done = 1;
  if (!wIsRival(club)) { wLeagueMine(r); if (!CLUBS[club]) wH2hRecord(club, r, { us: W.us, them: W.them, sport: 'bowling' }); }
  if (L.table[club]) { if (r === 'win') L.table[club].l++; else L.table[club].w++; }
  const res = r === 'win' ? { a: 'me', b: club, sa: W.us, sb: W.them } : { a: club, b: 'me', sa: W.them, sb: W.us };
  L.results.unshift(Object.assign(res, { day: WG.dayAbs, sport: 'bowling', g: ref.g }));
  L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  if (r === 'win') {
    RUN.fans = (RUN.fans || 0) + W_FIX.fans;
    wLog(`Two points on the table. The Brinepup barks, and the gallery stays: ${W_FIX.fans} fans.`, 'g');
    wMaybeBid(club);
  }
};
const wW120SimAt = wSimAt;
wSimAt = function (a, b, g) {
  if (g !== W_LNFIX.g || LAB) return wW120SimAt(a, b, g);
  const L = wLeague(), s = wLanesSimClubs(a, b, W_LNFIX.tier, 1), w = s.w, l = w === a ? b : a;
  L.table[w].w++; L.table[l].l++;
  const res = { day: WG.dayAbs, a: w, b: l, sport: 'bowling', sa: Math.max(s.ra, s.rb), sb: Math.min(s.ra, s.rb), g };
  L.results.unshift(res); L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  return res;
};
const wW120OpenGrdCard = wOpenGrdCard;
wOpenGrdCard = function (id, msg) {
  wW120OpenGrdCard(id, msg);
  if (id !== W_LNFIX.g) return;
  const b = document.querySelector('#modalBox [data-gfix]'), f = wLnfixHere(); if (!b || !f) return;
  const probs = wLanesProblems().concat(wLanesLive() ? ['Finish the bowling match you started first.'] : []), row = b.closest('.row');
  row.innerHTML = Object.keys(W_LNG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-lnfixhow="${how}" ${probs.length ? 'disabled' : ''}>${W_LNG_HOW[how]}</button>`).join('');
  const small = row.closest('li').querySelector('small'); if (small) small.insertAdjacentHTML('beforeend', ` Bowled on the lanes with your five.${probs.length ? ' ' + esc(probs[0]) : ''}`);
  row.querySelectorAll('[data-lnfixhow]').forEach(x => x.onclick = () => { $('modalBox').querySelector('[data-close]').click(); const r = wLnfixPlay(x.dataset.lnfixhow); if (r) wOpenGrdCard(id, r); });
};

/* ---------- where it is: the Lanes, the Lanes tab, the match card ---------- */
{
  const K = DB.chars.gk_lanes;
  if (K) { K.topics.cup = { t: 'The Gutter Cup: eight fives and three rounds, every week, right here. The final is best of three, because one game is luck and two is a habit. Win it and the Cup sits on your shelf till the next one. Mind the herring smell. I take the entries.', act: 'lncup' }; K.topics.job.t += ' I run the Gutter CUP too.'; }
}
const wW120RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'lncup') return wOpenGutter(); return wW120RunAct.apply(this, arguments); };
const wGutterBtn = () => `<button class="ghost" data-lncup>Gutter Cup${wGutterOn() ? ` (${W_GUTTER.rounds[wGutter().round].toLowerCase()})` : ''}</button>`;
const wW120CampLanes = wCampLanes;
wCampLanes = function (C) { return wW120CampLanes(C).replace('<button class="ghost" data-npractice', `${wGutterBtn()}<button class="ghost" data-npractice`); };
const wW120RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW120RenderCamp();
  const b = $('wCampBody') && WCAMP.tab === 'lanes' && $('wCampBody').querySelector('[data-lncup]');
  if (b) b.onclick = () => { WCAMP.close(); wOpenGutter(); };
};
const wW120OpenLanesCard = wOpenLanesCard;
wOpenLanesCard = function () {
  wW120OpenLanesCard();
  const list = document.querySelector('#modalBox .wbclubs'); if (!list) return;
  const f = wLnfixHere();
  list.insertAdjacentHTML('afterend', `<p class="hint">The Gutter Cup: eight fives, every week, the final best of three. ${wGutterBtn()}${f ? ` Your league fixture against ${esc(wTheClub(f.club))} is here at the Saltmere Lanes, by day ${f.day}: bowl it from the ground's GAME card.` : ''}</p>`);
  const b = $('modalBox').querySelector('[data-lncup]'); if (b) b.onclick = () => { $('modalBox').querySelector('[data-close]').click(); wOpenGutter(); };
};
const wW120WallText = wWallText;
wWallText = function () {
  wW120WallText();
  if (WG.lncupWins) wLog(`On a shelf of driftwood: Moll's Gutter Cup, a brass bowl with a pin for a handle${WG.lncupWins > 1 ? `, won ${WG.lncupWins} times` : ''}, your five's names scratched round the rim.`, 'g');
};
const wW120RenderHelp = renderHelp;
renderHelp = function () {
  wW120RenderHelp();
  const g = $('wHelpLanesStars') || $('wHelpLanesKit') || $('wHelpLanesGame'); if (!g || $('wHelpLanesCup')) return;
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLanesCup"><b>The Gutter Cup.</b> Bowling's cup, every week at the Saltmere Lanes: ask Moll Gutter about the CUP, or use the Gutter Cup button on the Lanes tab. ${W_GUTTER.fee} gold to enter. Eight fives in a bracket, three rounds, a weaker side first and then sides at your own level: one team game in the quarter- and semi-finals, and the final best of three. You bowl your own games and the rest are played out once yours is done. Nobody goes home level: a roll-off settles a tied game. Lose and you're out. Win the final and Moll hands over the Gutter Cup for the week: ${W_GUTTER.prize.gold} gold, ${W_GUTTER.prize.fans} fans, a pick of cards, a piece of bowling gear and a place on the Wall of Awards. League fixtures at the Saltmere Lanes are bowling matches too: Play, Manage or Simulate, and a win is two points on the table.</p>`);
};
