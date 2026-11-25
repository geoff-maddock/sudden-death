/* w157: the Gilded Lance, the weekly jousting cup (issue #117, phase 10), as w129 is the Shed's Brass Broom. League
   fixtures at the Lists are already jousted on the engine (w150). Every week at the Tilting Lists (ask Sir Ruddock about
   the CUP, or use the button on the Lists tab or the match card). Eight clubs in a bracket: you, rival clubs and the
   regions' own sides, through w45b's bracket. Three rounds of one match each (the final too): a weaker four in the
   quarter-final, then fours at your own level (the tier: their level and how well they ride). You joust your own matches
   (Play, Manage or Simulate, as any jousting match: save and leave between courses, resume, concede) and the rest of each
   round is jousted on the same engine once yours is done. Nobody goes home level: the tilt for the crown. Lose and
   you're out; the rest of the bracket is jousted to a champion. Win the final and Sir Ruddock hands over the Gilded
   Lance for the week: gold, fans, a pick of jousting cards, a piece of jousting gear you don't have from W_LISTS_KIT.prize
   (w154; gold once you have them all) and one of each potion in that list (a Squire's Oil), a line in the journal and a place
   on the Wall of Awards.
   The cup's key is 'jtcup' (WG.jtcup, the world-game kind and W_BRACKETS.jtcup), as the other cups' are: WG.lists is
   already the four (w148).

   WG.jtcup  { week, field: [8 ids, 'me' first], round: 0..2, games: [[{ a, b, ra, rb, w, end }]] by round, pending, show,
               out, done, champ } or null. ra, rb: the points; end: '' | 'tc' (the tilt for the crown decided it, the
               marshal's count included: a level score there is then possible) | 'c' (conceded: the score when it was
               given up). Plain JSON, as WG.crcup.
   WG.jtcupWins, WG.jtcupLog: [{ year, day }]
   W_LANCE   the numbers; W_LANCE.force ('win' | 'lose') settles your next cup match that way in the bracket (its row's
             score turned round to fit); the match's own record (the log, the head to head, the XP) keeps the real
             result. For tests and the bot
   wLanceEnter(), wLancePlay(how), wLanceCatchUp(), wOpenLance(), wLanceWon(), wLanceSim(a, b, tier), W_ON_END.jtcup
   Wrapped: wNextPrompt (wW157NextPrompt: the rest of the round, then the bracket), wCampLists and wRenderCamp
   (wW157CampLists, wW157RenderCamp: a Gilded Lance button), wOpenListsCard (wW157OpenListsCard: the cup), wRunAct
   (wW157RunAct: 'jtcup'), wWallText (wW157WallText), wListsHowHTML (wW157ListsHow: #wListsHowCup), renderHelp
   (wW157RenderHelp: #wHelpListsCup). */

const W_LANCE = {
  fee: 40, size: 8,
  tiers: [1, 2, 2],               // the tier of each round: they ride like a Squire, then a Knight (as the Brass Broom; phase 12's lab measures it)
  rounds: ['Quarter-final', 'Semi-final', 'Final'],
  prize: { gold: 150, fans: 20, pick: 3 },
  force: null
};
// the gear prize: the first piece of W_LISTS_KIT.prize you don't have (gold once you have them all); its potions, one each
const W_LISTS_CUP = { gold: 60 };
const wLanceGear = () => W_LISTS_KIT.prize.filter(id => W_LISTS_GEAR[id]);
const wLancePots = () => W_LISTS_KIT.prize.filter(id => !W_LISTS_GEAR[id] && DB.items[id]);
const wLancePotN = () => wLancePots().map(id => `a ${DB.items[id].name}`).join(' and ');
W_BRACKETS.jtcup = { K: W_LANCE, name: 'Gilded Lance', me: 'your four', store: 'games', view: 'lists', verb: 'held', busy: 'Finish the jousting match you started first.',
  live: () => wListsLive(), base: () => wListsProblems(), sim: (a, b, tier) => wLanceSim(a, b, tier), won: () => wLanceWon(),
  mark: g => g.end === 'tc' ? '†' : g.end === 'c' ? '‡' : '', hint: 'The scores are points. † Settled in the tilt for the crown (level after it, on Sir Ruddock\'s count of lances broken). ‡ Won by concession (the score when the other four gave up).' };
function wLance() { return wBrk('jtcup'); }
function wLanceOn() { return wBrkOn('jtcup'); }
function wLanceName(id) { return wBrkName('jtcup', id); }
function wLanceMine() { return wBrkMine('jtcup'); }
function wLanceProblems() { return wBrkProblems('jtcup'); }
function wLanceEnter() { return wBrkEnter('jtcup'); }
function wLanceCatchUp() { return wBrkCatchUp('jtcup'); }
function wLanceBracket() { return wBrkBracket('jtcup'); }

const wLanceLive = () => wListsLive() && WG.jtg.live.world.kind === 'jtcup';
function wLancePlay(how) {
  const D = wLance(), opp = wLanceMine(); if (!opp) return '';
  return wStartLists({ club: opp, how, tier: W_LANCE.tiers[D.round], kind: 'jtcup', ref: { week: D.week, round: D.round }, cup: true });
}
// your match's result; the rest of the round waits until you are back in the world (wLanceCatchUp)
W_ON_END.jtcup = function (r, ref, W) {
  const D = wLance(); if (!D || !ref || D.done || ref.week !== D.week || ref.round !== D.round) return;
  const forced = W_LANCE.force; W_LANCE.force = null;
  const win = (forced || r) === 'win', conceded = W.text === 'conceded', end = forced ? '' : conceded ? 'c' : ((WG.jtg.games[0] || {}).end) || '', rd = W_LANCE.rounds[D.round];
  // (a forced result's score is turned round to fit it, for the tests and the bot)
  let ra = W.us, rb = W.them; if (forced && (win ? ra <= rb : rb <= ra)) { [ra, rb] = ra === rb ? (win ? [ra + 1, rb] : [ra, rb + 1]) : [rb, ra]; }
  D.games[D.round].push({ a: 'me', b: W.club, ra, rb, w: win ? 'me' : W.club, end });
  if (!win) D.out = true;
  D.pending = true;
  // (the engine's text already says "after the tilt for the crown"; a forced result's line says the score turned round)
  const said = forced ? ` ${Math.max(ra, rb)} to ${Math.min(ra, rb)}` : conceded ? ', conceded' : W.text ? ` ${W.text}` : '';
  wLog(win ? `${rd} won${said} against ${wLanceName(W.club)}.` : `Out of the Gilded Lance in the ${rd.toLowerCase()}, beaten${said} by ${wLanceName(W.club)}.`, win ? 'g' : 'b');
};
// a match you are not in, on the same engine (w150's wListsSimClubs: both fours at the tier; a rival's four for its
// matches against you is left as it was)
function wLanceSim(a, b, tier) { const s = wListsSimClubs(a, b, tier); return { a, b, ra: s.ra, rb: s.rb, w: s.w, end: s.end }; }
function wLanceWon() {
  const P = W_LANCE.prize, D = wLance(), f = D.games[2][0];
  RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans;
  WG.jtcupWins = (WG.jtcupWins || 0) + 1;
  WG.jtcupLog = (WG.jtcupLog || []).concat({ year: WG.year, day: WG.day });
  wLog(`You win the Gilded Lance! Sir Ruddock hands it over (gold leaf from the vamplate to the tip, too fine to couch), your four keep it for the week, and your name goes up on the Wall of Awards. ${P.gold} gold and ${P.fans} fans.`, 'g');
  try { wJAddWin({ at: wJStamp(), where: wJWhere(), k: 'title', t: 'Won the Gilded Lance', opp: wBrkTeamName(f.a === 'me' ? f.b : f.a), sport: 'jousting', score: f.a === 'me' ? `${f.ra}–${f.rb}` : `${f.rb}–${f.ra}` }); } catch (e) { console.error(e); }
  const have = id => (WG.items[id] || 0) > 0 || wRoster().some(p => p.gear && p.gear.lists === id);
  const id = wLanceGear().find(x => !have(x));
  if (id) { wAddItem(id, 1); wLog(`The Lance comes with gear: the ${W_LISTS_GEAR[id].name}. ${W_LISTS_GEAR[id].desc}`, 'g'); }
  else { RUN.gold += W_LISTS_CUP.gold; wLog(`You have every piece of jousting gear the Lance hands out, so it pays ${W_LISTS_CUP.gold} gold more instead.`, 'g'); }
  for (const pot of wLancePots()) { wAddItem(pot, 1); wLog(`And a bottle from Sir Ruddock's own rack: ${DB.items[pot].name}.`, 'g'); }
  const pool = wSportPool(['jousting']);
  wGainCard(pool.length >= P.pick ? { pick: P.pick, pool } : { pick: P.pick, rarity: 'r' }, 'the Gilded Lance prize');
}

/* ---------- the card: entry, the bracket, your next match ---------- */
function wOpenLance(msg) {
  if (LAB || !WG) return;
  wLanceCatchUp();
  if (WG.cardOffer) { if ($('modal').hidden) wShowCardOffer(); return; }
  if (WG.jtcup) WG.jtcup.show = false;
  const D = wLance(), on = wLanceOn(), live = wLanceLive(), probs = wLanceProblems().concat(on && wListsLive() && !live ? [W_BRACKETS.jtcup.busy] : []), opp = on && wLanceMine();
  let body;
  if (!on) {
    body = `<p>Eight clubs, three rounds, one match each, the final too. Rival clubs and the regions' own sides enter. A weaker four in the quarter-final, then fours at your own level, and they bring their bags. Joust your own matches (Play, Manage or Simulate); the rest of each round is jousted on the sand once yours is done. Nobody goes home level: the tilt for the crown.</p>
      <p class="hint">Entry ${W_LANCE.fee} gold. Win it and Sir Ruddock hands over the Gilded Lance for the week: ${W_LANCE.prize.gold} gold, ${W_LANCE.prize.fans} fans, a pick of ${W_LANCE.prize.pick} jousting cards, a piece of jousting gear, ${wLancePotN()} and a place on the Wall of Awards.</p>
      ${D && D.done ? `<h5>Last week's bracket</h5>${wLanceBracket()}` : ''}
      ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
      <div class="row"><button class="btn" id="wLanceEnter" ${probs.length ? 'disabled' : ''}>Enter (${W_LANCE.fee} gold)</button></div>`;
  } else {
    const tier = W_LANCE.tiers[D.round], h = opp && wListsH2h(opp);
    const next = live ? `<p>Your ${W_LANCE.rounds[D.round].toLowerCase()} against ${esc(wLanceName(WG.jtg.live.world.club))} is waiting.</p><div class="row"><button class="btn" id="wLanceRes">Resume the match</button></div>`
      : opp ? `<p><b>${W_LANCE.rounds[D.round]}</b> against ${esc(wLanceName(opp))}: their riders are level ${wBallOppLvl(tier)}, and ride like a ${W_BALL_SKILL[wListsSkillOf(tier)[1]]}.${h ? ` Last jousting match: ${h.r === 'win' ? 'won' : 'lost'}${h.text ? ' ' + esc(h.text) : ''}.` : ''}</p>
        ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
        <div class="row">${Object.keys(W_JTG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-lancehow="${how}" ${probs.length ? 'disabled' : ''}>${W_JTG_HOW[how]}</button>`).join('')}</div>` : '';
    body = `${next}${wLanceBracket()}`;
  }
  const close = modal(`<header><h3>The Gilded Lance</h3><button class="ghost" data-close>Done</button></header>${msg ? `<p class="wbad">${esc(msg)}</p>` : ''}${body}`, () => wDrain());
  const again = r => { close(); wOpenLance(r); };
  if ($('wLanceEnter')) $('wLanceEnter').onclick = () => again(wLanceEnter());
  if ($('wLanceRes')) $('wLanceRes').onclick = () => { close(); wResumeLists(); };
  $('modalBox').querySelectorAll('[data-lancehow]').forEach(b => b.onclick = () => { close(); const r = wLancePlay(b.dataset.lancehow); if (r) wOpenLance(r); });
}
const wW157NextPrompt = wNextPrompt;
wNextPrompt = function () {
  const D = wLance();
  if (!LAB && D && (D.pending || D.show) && !wListsLive() && UI.view !== 'lists' && wActive() && !WG.cardOffer && !WG.event) { wOpenLance(); return true; }
  if (LAB && D && D.pending) wLanceCatchUp();
  return wW157NextPrompt();
};

/* ---------- where it is: Sir Ruddock, the Lists tab, the match card ---------- */
(() => {
  const K = DB.chars.gk_lists; if (!K) return;
  K.topics.cup = { t: 'The Gilded Lance: eight clubs and three rounds, every week, here on my sand. One match a round, the final too, and nobody goes home level. Win it and the Lance hangs over your hearth till the next one. It is gilt over pine. Do not couch it.', act: 'jtcup' };
  K.topics.job.t += ' And every week there is the Gilded Lance: ask me about the CUP.';
})();
const wW157RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'jtcup') return wOpenLance(); return wW157RunAct.apply(this, arguments); };
const wLanceBtn = () => `<button class="ghost" data-jtcup>Gilded Lance${wLanceOn() ? ` (${W_LANCE.rounds[wLance().round].toLowerCase()})` : ''}</button>`;
const wW157CampLists = wCampLists;
wCampLists = function (C) { return wW157CampLists(C).replace('<button class="ghost" data-jpractice', `${wLanceBtn()}<button class="ghost" data-jpractice`); };
const wW157RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW157RenderCamp();
  const b = $('wCampBody') && WCAMP.tab === 'lists' && $('wCampBody').querySelector('[data-jtcup]');
  if (b) b.onclick = () => { WCAMP.close(); wOpenLance(); };
};
const wW157OpenListsCard = wOpenListsCard;
wOpenListsCard = function () {
  wW157OpenListsCard();
  const list = document.querySelector('#modalBox .wbclubs'); if (!list) return;
  list.insertAdjacentHTML('afterend', `<p class="hint">The Gilded Lance: eight clubs, every week, one match a round. ${wLanceBtn()}</p>`);
  const b = $('modalBox').querySelector('[data-jtcup]'); if (b) b.onclick = () => { $('modalBox').querySelector('[data-close]').click(); wOpenLance(); };
};
const wW157WallText = wWallText;
wWallText = function () {
  wW157WallText();
  if (WG.jtcupWins) wLog(`On two pegs over the hearth: Sir Ruddock's Gilded Lance${WG.jtcupWins > 1 ? `, won ${WG.jtcupWins} times` : ''}, gold leaf from the vamplate to the tip, your four's names tooled down the grip.`, 'g');
};
const wW157ListsHow = wListsHowHTML;
wListsHowHTML = function () {
  return wW157ListsHow() + `<p class="hint" id="wListsHowCup"><b>The Gilded Lance.</b> The weekly cup at the Lists: ask Sir Ruddock about the CUP. ${W_LANCE.fee} gold to enter; eight clubs, three rounds of one match each (the final too). The quarter-final is against a weaker four, then fours at your level. Joust your matches in Play, Manage or Simulate; the rest of each round is jousted once yours is done. A level match goes to the tilt for the crown, so every match has a winner. Lose and you're out. Win it for ${W_LANCE.prize.gold} gold, ${W_LANCE.prize.fans} fans, a pick of jousting cards, a piece of jousting gear and ${wLancePotN()}.</p>`;
};
const wW157RenderHelp = renderHelp;
renderHelp = function () {
  wW157RenderHelp();
  const g = $('wHelpListsStars') || $('wHelpListsGround') || $('wHelpListsKit') || $('wHelpListsGame'); if (!g || $('wHelpListsCup')) return;
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpListsCup"><b>The Gilded Lance.</b> Jousting's cup, every week at the Tilting Lists: ask Sir Ruddock about the CUP, or use the Gilded Lance button on the Lists tab. ${W_LANCE.fee} gold to enter. Eight clubs, three rounds of one match each, the final too; nobody goes home level (the tilt for the crown, marked †), and lose and you're out. Win it for ${W_LANCE.prize.gold} gold, ${W_LANCE.prize.fans} fans, a pick of cards, a piece of jousting gear and ${wLancePotN()}. Save and leave keeps a cup match for later. A match you concede is a loss at the score when you gave up: marked ‡ in the bracket.</p>`);
};
