/* w20e: the Diamond Cup (issue #4, phase 5). Baseball's own cup, held every week through the League office in
   Graftonbury (ask Imelda Foss about the DIAMOND cup), or from the Nine tab. Eight nines in a bracket: you, rival
   clubs and the regions' own nines. Three rounds, each one harder (CPU skill and the other side's level go up with
   the round). You play your own games (Play, Manage or Simulate, as any ball game) and the rest of each round is
   simulated on the same engine once yours is done. Lose and you're out; the rest of the bracket is played to a
   champion. Win the final for gold, fans, a pick of baseball cards, a line in the journal and a place on the Wall of
   Awards. One cup a week, entered or not.

   WG.dcup  { week, field: [8 ids, 'me' first], round: 0..2, games: [[{ a, b, ra, rb, w }]] by round, pending (the
              rest of the round is to play), show (the bracket is to show), out, done, champ } or null. Plain JSON. The pairings of a round are its winners in order, 2 by 2.
   W_DCUP   the numbers; W_DCUP.force ('win' | 'lose') settles your next cup game that way (tests and the bot)
   wDcupEnter(), wDcupPlay(how), wDcupCatchUp() (plays the rest of a round), wOpenDcup()
   Wrapped: wNextPrompt (the rest of the round, then the bracket), wCampNine (a Diamond Cup button), wRenderCamp,
   wRunAct (act 'dcup'), wWallText, renderHelp (#wHelpDcup). Adds the DIAMOND topic to the clerk. */

const W_DCUP = {
  fee: 40, size: 8,
  tiers: [1, 2, 3],               // the tier of each round: CPU skill Squire, Knight, Archmage
  rounds: ['Quarter-final', 'Semi-final', 'Final'],
  prize: { gold: 150, fans: 20, pick: 3 },
  force: null
};

function wDcup() { return (WG && WG.dcup) || null; }
function wDcupOn() { const D = wDcup(); return !!(D && !D.done); }
function wDcupName(id) { return id === 'me' ? 'your nine' : wBallName(id); }
function wDcupTeamName(id) { return id === 'me' ? wPartyTeam().name : (wBallTeam(id) || {}).name || id; }
// the pairings of round r: the field, then each round's winners in order, two by two
function wDcupPairs(r) {
  const D = wDcup(); let ids = D.field.slice();
  for (let i = 0; i < r; i++) ids = (D.games[i] || []).map(g => g.w);
  const out = []; for (let i = 0; i + 1 < ids.length; i += 2) out.push([ids[i], ids[i + 1]]);
  return out;
}
function wDcupGame(r, a, b) { return ((wDcup().games[r]) || []).find(g => (g.a === a && g.b === b) || (g.a === b && g.b === a)) || null; }
function wDcupMine() { const D = wDcup(); if (!D || D.out || D.done) return null; const p = wDcupPairs(D.round).find(x => x.includes('me')); return p && !wDcupGame(D.round, p[0], p[1]) ? p.find(x => x !== 'me') : null; }

function wDcupProblems() {
  const D = wDcup(), out = wBallProblems();
  if (D && !D.done) return out;
  if (D && D.week === wWeek()) out.push(`The Diamond Cup is held once a week. The next one opens in ${7 - ((WG.dayAbs - 1) % 7)} day${7 - ((WG.dayAbs - 1) % 7) === 1 ? '' : 's'}.`);
  if (RUN.gold < W_DCUP.fee) out.push(`The entry fee is ${W_DCUP.fee} gold, and you have ${RUN.gold}.`);
  if (wBallLive()) out.push('Finish the ball game you started first.');
  return out;
}
/* the field: your rivals (four at most), then the regions' nines, in a random draw with you at the top */
function wDcupEnter() {
  const probs = wDcupProblems(); if (probs.length) return probs.join(' ');
  const rivals = shuffle(Object.values(WG.rivals || {}).filter((c, i, a) => CLUBS[c] && a.indexOf(c) === i)).slice(0, 4);
  const wild = shuffle(Object.keys(W_WILD_TEAM).map(r => 'wild:' + r));
  const others = shuffle(rivals.concat(wild).slice(0, W_DCUP.size - 1));
  RUN.gold -= W_DCUP.fee;
  WG.dcup = { week: wWeek(), field: ['me'].concat(others), round: 0, games: [[], [], []], pending: false, out: false, done: false, champ: null };
  wLog(`You enter the Diamond Cup (${W_DCUP.fee} gold). ${W_DCUP.rounds[0]}: ${wDcupName(wDcupMine())}.`, 'g');
  wSave();
  return '';
}
function wDcupPlay(how) {
  const D = wDcup(), opp = wDcupMine(); if (!opp) return '';
  return wStartBall({ club: opp, how, tier: W_DCUP.tiers[D.round], kind: 'dcup', ref: { week: D.week, round: D.round }, cup: true });
}
/* your game's result: the rest of the round waits until you are back in the world (wDcupCatchUp), since this runs
   inside the engine's final */
W_ON_END.dcup = function (r, ref, W) {
  const D = wDcup(); if (!D || !ref || D.done || ref.week !== D.week || ref.round !== D.round) return;
  const forced = W_DCUP.force; W_DCUP.force = null;
  const win = forced ? forced === 'win' : r === 'win';
  D.games[D.round].push({ a: 'me', b: W.club, ra: W.us, rb: W.them, w: win ? 'me' : W.club });
  if (!win) D.out = true;
  D.pending = true;
  wLog(win ? `${W_DCUP.rounds[D.round]} won: ${W.us}–${W.them} against ${wDcupName(W.club)}.` : `Out of the Diamond Cup in the ${W_DCUP.rounds[D.round].toLowerCase()}, ${W.us}–${W.them} to ${wDcupName(W.club)}.`, win ? 'g' : 'b');
};
/* a game you are not in, on the same engine, both sides on the CPU */
function wDcupSim(a, b, tier) {
  const A = Object.assign(wBallOpp(a, tier), { id: 'dcupA' }), Bd = Object.assign(wBallOpp(b, tier), { id: 'dcupB' });
  wBD.sim({ defs: [A, Bd], innings: W_BALL.innings, diff: W_BALL.diff[tier], rules: W_BALL.rules });
  const [ta, tb] = wBD.G.teams;
  return { a, b, ra: ta.R, rb: tb.R, w: ta.R > tb.R ? a : b };
}
/* the rest of the round: every game without a result; then the next round, and on to the final if you are out */
function wDcupCatchUp() {
  const D = wDcup(); if (!D || !D.pending || WD || wBallLive() || UI.view === 'diamond') return false;
  for (;;) {
    for (const [a, b] of wDcupPairs(D.round)) if (!wDcupGame(D.round, a, b)) D.games[D.round].push(wDcupSim(a, b, W_DCUP.tiers[D.round]));
    if (D.round === W_DCUP.rounds.length - 1) { D.done = true; D.champ = D.games[D.round][0].w; break; }
    D.round++;
    if (!D.out) break;
  }
  D.pending = false; D.show = true;
  if (D.done && D.champ === 'me') wDcupWon();
  else if (D.done) wLog(`${wCap(wDcupName(D.champ))} win the Diamond Cup.`, 'd');
  else wLog(`The ${W_DCUP.rounds[D.round - 1].toLowerCase()}s are in. ${W_DCUP.rounds[D.round]}: ${wDcupName(wDcupMine())}.`, 'g');
  wSave();
  return true;
}
function wDcupWon() {
  const P = W_DCUP.prize, D = wDcup(), f = D.games[2][0];
  RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans;
  WG.dcupWins = (WG.dcupWins || 0) + 1;
  WG.dcupLog = (WG.dcupLog || []).concat({ year: WG.year, day: WG.day });
  wLog(`You win the Diamond Cup! It goes up on the Wall of Awards. ${P.gold} gold and ${P.fans} fans.`, 'g');
  try { wJAddWin({ at: wJStamp(), where: wJWhere(), k: 'title', t: 'Won the Diamond Cup', opp: wDcupTeamName(f.b), sport: 'baseball', score: `${f.ra}–${f.rb}` }); } catch (e) { console.error(e); }
  const pool = wSportPool(['baseball']);
  wGainCard(pool.length >= P.pick ? { pick: P.pick, pool } : { pick: P.pick, rarity: 'r' }, 'the Diamond Cup prize');
}

/* ---------- the card: entry, the bracket, your next game ---------- */
function wDcupBracket() {
  const D = wDcup();
  const cell = (r, a, b) => {
    const g = wDcupGame(r, a, b);
    const row = id => `<li class="${id === 'me' ? 'wme' : ''}${g && g.w === id ? ' wwon' : g ? ' wlost' : ''}"><span>${esc(wDcupTeamName(id))}</span><b>${g ? (g.a === id ? g.ra : g.rb) : ''}</b></li>`;
    return `<ol class="wdcg">${row(a)}${row(b)}</ol>`;
  };
  return `<div class="wdcb">${W_DCUP.rounds.map((n, r) => `<div><h5>${n}</h5>${r <= D.round || D.done ? wDcupPairs(Math.min(r, 2)).map(([a, b]) => cell(r, a, b)).join('') : '<p class="dim">To come.</p>'}</div>`).join('')}</div>`;
}
function wOpenDcup(msg) {
  if (LAB || !WG) return;
  wDcupCatchUp();
  // a prize pick came up: it goes first, and the bracket after it (wNextPrompt, D.show)
  if (WG.cardOffer) { if ($('modal').hidden) wShowCardOffer(); return; }
  if (WG.dcup) WG.dcup.show = false;
  const D = wDcup(), on = wDcupOn(), probs = wDcupProblems(), opp = on && wDcupMine();
  const live = wBallLive() && WG.ball.live.world.kind === 'dcup';
  let body;
  if (!on) {
    body = `<p>Eight nines, three rounds: the quarter-finals, the semi-finals and the final. Baseball on the diamond, with your nine. Rival clubs and the regions' best nines enter. Each round is harder than the last. Lose once and you're out.</p>
      <p class="hint">Entry ${W_DCUP.fee} gold. Win it for ${W_DCUP.prize.gold} gold, ${W_DCUP.prize.fans} fans, a pick of ${W_DCUP.prize.pick} baseball cards and a place on the Wall of Awards. Every game also pays as a ball game does. One cup a week.${WG.dcupWins ? ` You have won it ${WG.dcupWins} time${WG.dcupWins === 1 ? '' : 's'}.` : ''}</p>
      ${D && D.done ? `<h5>Last week's bracket</h5>${wDcupBracket()}` : ''}
      ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
      <div class="row"><button class="btn" id="wDcupEnter" ${probs.length ? 'disabled' : ''}>Enter (${W_DCUP.fee} gold)</button></div>`;
  } else {
    const tier = W_DCUP.tiers[D.round], h = opp && CLUBS[opp] && wBallH2h(opp);
    const next = live ? `<p>Your ${W_DCUP.rounds[D.round].toLowerCase()} against ${esc(wDcupName(WG.ball.live.world.club))} is waiting.</p><div class="row"><button class="btn" id="wDcupRes">Resume the game</button></div>`
      : opp ? `<p><b>${W_DCUP.rounds[D.round]}</b> against ${esc(wDcupName(opp))}: their players are level ${wBallOppLvl(tier)}, CPU skill ${W_BALL_SKILL[W_BALL.diff[tier]]}.${h ? ` Last time you ${h.r === 'win' ? 'won' : 'lost'} ${h.us}–${h.them}.` : ''}</p>
        ${h && h.r === 'lose' ? `<p class="hint">"${esc(pick(W_TAUNTS))}"</p>` : ''}
        ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
        <div class="row">${Object.keys(W_BALL_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-dchow="${how}" ${probs.length ? 'disabled' : ''}>${W_BALL_HOW[how]}</button>`).join('')}</div>` : '';
    body = `${next}${wDcupBracket()}`;
  }
  const close = modal(`<header><h3>The Diamond Cup</h3><button class="ghost" data-close>Done</button></header>${msg ? `<p class="wbad">${esc(msg)}</p>` : ''}${body}`, () => wDrain());
  const again = r => { close(); wOpenDcup(r); };
  if ($('wDcupEnter')) $('wDcupEnter').onclick = () => again(wDcupEnter());
  if ($('wDcupRes')) $('wDcupRes').onclick = () => { close(); wResumeBall(); };
  $('modalBox').querySelectorAll('[data-dchow]').forEach(b => b.onclick = () => { close(); const r = wDcupPlay(b.dataset.dchow); if (r) wOpenDcup(r); });
}
/* back in the world after your game: the rest of the round, then the bracket */
const wW20eNextPrompt = wNextPrompt;
wNextPrompt = function () {
  const D = wDcup();
  if (!LAB && D && (D.pending || D.show) && !WD && !wBallLive() && wActive() && !WG.cardOffer && !WG.event) { wOpenDcup(); return true; }
  if (LAB && D && D.pending) wDcupCatchUp();
  return wW20eNextPrompt();
};

/* ---------- where it is: the League office and the Nine tab ---------- */
{
  const C = DB.chars.clerk;
  C.topics.diamond = { t: 'The Diamond Cup: baseball, on the diamond, eight nines and three rounds, every week. Your own nine, mind, so you need a proper squad first. I take the entries here.', act: 'dcup' };
  C.topics.job.t += ' I also run the DIAMOND Cup.';
}
const wW20eRunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'dcup') return wOpenDcup(); return wW20eRunAct(act, id); };
const wW20eCampNine = wCampNine;
wCampNine = function () { return wW20eCampNine().replace('<button class="ghost" data-nwatch', `<button class="ghost" data-ndcup>Diamond Cup${wDcupOn() ? ` (${W_DCUP.rounds[wDcup().round].toLowerCase()})` : ''}</button><button class="ghost" data-nwatch`); };
const wW20eRenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW20eRenderCamp();
  const b = $('wCampBody') && WCAMP.tab === 'nine' && $('wCampBody').querySelector('[data-ndcup]');
  if (b) b.onclick = () => { WCAMP.close(); wOpenDcup(); };
};
const wW20eWallText = wWallText;
wWallText = function () {
  wW20eWallText();
  if (WG.dcupWins) wLog(`On its own hook: the Diamond Cup${WG.dcupWins > 1 ? `, ${WG.dcupWins} times` : ''}.`, 'g');
};
const wW20eRenderHelp = renderHelp;
renderHelp = function () {
  wW20eRenderHelp();
  const ball = $('wHelpBall'); if (!ball || $('wHelpDcup')) return;
  ball.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpDcup"><b>The Diamond Cup.</b> Baseball's cup, every week: ask the League clerk in Graftonbury about the DIAMOND cup, or use the Diamond Cup button on the Nine tab. ${W_DCUP.fee} gold to enter. Eight nines in a bracket, three rounds, each harder than the last; you play your own games and the rest are played out once yours is done. Lose and you're out. Win the final for ${W_DCUP.prize.gold} gold, ${W_DCUP.prize.fans} fans, a pick of baseball cards and a place on the Wall of Awards.</p>`);
};
