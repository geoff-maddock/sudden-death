/* w45b: the weekly cup bracket, once (issue #86). The Cinder Cup (w46, football), the Anvil Belt (w54, boxing), the
   Charter Net (w84, basketball) and the Pond Kettle (w95, hockey) are the same cup in four sports: eight sides in a
   bracket, 'me' first, three rounds, your own game played and the rest of each round simulated, one cup a week. Each
   of those files keeps its numbers, its words, its game's result (W_ON_END), its prize and its card; the bracket
   itself is here, and their own functions (wGcupEnter, wBcupPairs, wNetCatchUp, wKettleBracket, ...) call it.

   W_BRACKETS[key], set by each cup's file (key is the cup's field on WG and its world-game kind: 'gcup', 'bcup',
   'bkcup', 'hkcup'):
     K        the cup's numbers: { fee, size, tiers, rounds, prize, force }
     name     'Pond Kettle'        me     'your six'
     store    the field the results are kept in, by round: 'games' ('cards' in boxing). Saves are as they were.
     view     the engine's view (UI.view), so the round isn't finished behind a game on screen
     verb     'held' ('boxed')     busy   'Finish the hockey game you started first.'
     live()   a game of this sport is on        base()  the sport's own reasons you can't play (a list)
     sim(a, b, tier)   one game between two others: a result row { a, b, ra, rb, w, ... }
     won()    you won the final: the prize
     mark(g)  what goes after the winner's score ('' | '*' | '†')      hint   the line that explains the marks
   Nothing here is stored: W_BRACKETS holds functions, WG holds only the cup's plain data. */
const W_BRACKETS = {};

function wBrk(key) { return (WG && WG[key]) || null; }
function wBrkOn(key) { const D = wBrk(key); return !!(D && !D.done); }
function wBrkName(key, id) { return id === 'me' ? W_BRACKETS[key].me : wBallName(id); }
function wBrkTeamName(id) { return id === 'me' ? wPartyTeam().name : (wBallTeam(id) || {}).name || id; }
// who meets whom in round r: the field in pairs, then the winners of the round before, in order
function wBrkPairs(key, r) {
  const D = wBrk(key), S = W_BRACKETS[key].store; let ids = D.field.slice();
  for (let i = 0; i < r; i++) ids = (D[S][i] || []).map(g => g.w);
  const out = []; for (let i = 0; i + 1 < ids.length; i += 2) out.push([ids[i], ids[i + 1]]);
  return out;
}
function wBrkGame(key, r, a, b) { return ((wBrk(key)[W_BRACKETS[key].store][r]) || []).find(g => (g.a === a && g.b === b) || (g.a === b && g.b === a)) || null; }
// who you play next (null when you're out, it's over, or your game this round is played)
function wBrkMine(key) { const D = wBrk(key); if (!D || D.out || D.done) return null; const p = wBrkPairs(key, D.round).find(x => x.includes('me')); return p && !wBrkGame(key, D.round, p[0], p[1]) ? p.find(x => x !== 'me') : null; }
function wBrkProblems(key) {
  const C = W_BRACKETS[key], D = wBrk(key), out = C.base();
  if (D && !D.done) return out;
  const left = 7 - ((WG.dayAbs - 1) % 7);
  if (D && D.week === wWeek()) out.push(`The ${C.name} is ${C.verb} once a week. The next one opens in ${left} day${left === 1 ? '' : 's'}.`);
  if (RUN.gold < C.K.fee) out.push(`The entry fee is ${C.K.fee} gold, and you have ${RUN.gold}.`);
  if (C.live()) out.push(C.busy);
  return out;
}
// the field: your rivals (four at most), then the regions' own sides, in a random draw with you at the top
function wBrkEnter(key) {
  const C = W_BRACKETS[key], probs = wBrkProblems(key); if (probs.length) return probs.join(' ');
  const rivals = shuffle(Object.values(WG.rivals || {}).filter((c, i, a) => CLUBS[c] && a.indexOf(c) === i)).slice(0, 4);
  const wild = shuffle(Object.keys(W_WILD_TEAM).map(r => 'wild:' + r));
  const others = shuffle(rivals.concat(wild).slice(0, C.K.size - 1));
  RUN.gold -= C.K.fee;
  WG[key] = { week: wWeek(), field: ['me'].concat(others), round: 0, [C.store]: [[], [], []], pending: false, show: false, out: false, done: false, champ: null };
  wLog(`You enter the ${C.name} (${C.K.fee} gold). ${C.K.rounds[0]}: ${wBrkName(key, wBrkMine(key))}.`, 'g');
  wSave();
  return '';
}
// the rest of the round: every game without a result; then the next round, and on to the final if you are out
function wBrkCatchUp(key) {
  const C = W_BRACKETS[key], D = wBrk(key); if (!D || !D.pending || C.live() || UI.view === C.view) return false;
  const S = C.store;
  for (;;) {
    for (const [a, b] of wBrkPairs(key, D.round)) if (!wBrkGame(key, D.round, a, b)) D[S][D.round].push(C.sim(a, b, C.K.tiers[D.round]));
    if (D.round === C.K.rounds.length - 1) { D.done = true; D.champ = D[S][D.round][0].w; break; }
    D.round++;
    if (!D.out) break;
  }
  D.pending = false; D.show = true;
  if (D.done && D.champ === 'me') C.won();
  else if (D.done) wLog(`${wCap(wBrkName(key, D.champ))} win the ${C.name}.`, 'd');
  else wLog(`The ${C.K.rounds[D.round - 1].toLowerCase()}s are in. ${C.K.rounds[D.round]}: ${wBrkName(key, wBrkMine(key))}.`, 'g');
  wSave();
  return true;
}
// the bracket, a column a round
function wBrkBracket(key) {
  const C = W_BRACKETS[key], D = wBrk(key);
  const cell = (r, a, b) => {
    const g = wBrkGame(key, r, a, b), mark = g ? C.mark(g) : '';
    const row = id => `<li class="${id === 'me' ? 'wme' : ''}${g && g.w === id ? ' wwon' : g ? ' wlost' : ''}"><span>${esc(wBrkTeamName(id))}</span><b>${g ? (g.a === id ? g.ra : g.rb) : ''}${g && g.w === id ? mark : ''}</b></li>`;
    return `<ol class="wdcg">${row(a)}${row(b)}</ol>`;
  };
  return `<div class="wdcb">${C.K.rounds.map((n, r) => `<div><h5>${n}</h5>${r <= D.round || D.done ? wBrkPairs(key, Math.min(r, 2)).map(([a, b]) => cell(r, a, b)).join('') : '<p class="dim">To come.</p>'}</div>`).join('')}</div>
    ${D[C.store].some(R => R.some(g => C.mark(g))) ? `<p class="hint">${C.hint}</p>` : ''}`;
}
