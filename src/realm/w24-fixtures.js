/* w24: fixtures and the league at the grounds (issue #6, phase 5). Loads after w23-spots.js; changes earlier parts
   only by reassignment (saved originals carry the wW24 prefix).

   The fixture list. Every league round (W_LEAGUE.every days) is drawn up in advance: your four rival clubs, Apex
   Athletic and you, paired off, each game at one of the home side's grounds (a rival club's home is its cup town,
   Apex Athletic's is Graftonbury). When the round day comes, the clubs' games are played there: the result is
   chalked on that ground's scoreboard, the inns post it with the ground's name, and the table moves.

   Your fixture. You play away, at one of your opponent's city's grounds (never the Ballpark: that is a ball game),
   any day up to the round day. Ask the groundskeeper for a GAME: the card has a League fixture row. It is a rival
   match (Apex Athletic a tier up again), locked to the ground's sport, and the squad rule holds. Win or lose, it
   goes on your row of the table, the head to head, and the league's results; a win against a rival can bring a bid
   (w18), and the crowd adds W_FIX.fans fans. Miss it and it is postponed: no result.

   The crowd. The fans at the grounds greet you by your place in the table, and the pre-game card at a ground says
   how the crowd takes you there.

   WG.league.next = { day, games: [{ a, b, g, done? }] }   a/b: a club id, or 'me'; g: a ground id. Plain data.
   Results get g (the ground). wFixtures(), wMyFixture(), wOpenFixtures(groundId)
   Wrapped: wLeagueRound (wW24LeagueRound: play the drawn round, draw the next), wClubName ('me'), wResultText (at the
   ground), wLeagueHtml (the next round), wGrdProblems, wStartGrd and wOpenGrdCard (the fixture), wMatchTitle,
   wMatchTeam, wPreGame (the club, the head to head and the crowd), W_ON_END.ground (the league), wUse (the league
   result on the scoreboard), wSay (the fans' greeting), wRunAct ('fixtures'), renderHelp (#wHelpFixtures). */

const W_FIX = { fans: 5, tierUp: 1 };

/* ---------- where clubs play ---------- */
function wClubTown(c) {
  if (c === 'apex') return 'graftonbury';
  const slot = Object.keys(WG.rivals || {}).find(k => WG.rivals[k] === c), cup = slot && DB.companies[slot] && DB.companies[slot].cup;
  return (cup && DB.cups[cup] && DB.cups[cup].town) || 'graftonbury';
}
function wFixGround(host, mine) {
  const gs = wGrdsOf(wClubTown(host)).filter(g => !mine || g.sport !== 'baseball');
  return pick(gs.length ? gs : W_GRDS.filter(g => g.sport !== 'baseball')).id;
}
function wNextRoundDay() { const e = W_LEAGUE.every, d = WG.dayAbs + 1; return d + ((e - d % e) % e); }
function wDrawRound() {
  const cl = shuffle(wLeagueClubs().concat('me')), games = [];
  for (let i = 0; i + 1 < cl.length; i += 2) {
    let [a, b] = [cl[i], cl[i + 1]];
    if (a === 'me') [a, b] = [b, a];                       // you play away: the club is the home side
    games.push({ a, b, g: wFixGround(a, b === 'me') });
  }
  return { day: wNextRoundDay(), games };
}
function wFixtures() {
  const L = wLeague();
  if (!L.next || !L.next.games || L.next.day < WG.dayAbs) L.next = wDrawRound();
  return L.next;
}
function wMyFixture() { const F = wFixtures(), f = F.games.find(x => x.b === 'me' || x.a === 'me'); return f ? Object.assign({ day: F.day }, f, { club: f.a === 'me' ? f.b : f.a }) : null; }

/* the round day: the clubs' games at their grounds (yours is played already, or postponed), then the next draw */
function wSimAt(a, b, g) {
  const L = wLeague(), G = wGrd(g), pa = L.str[a] / (L.str[a] + L.str[b]), aWins = Math.random() < pa, sport = G ? G.sport : pick(wAllSports());
  const u = SPORT_UNIT[sport], k = ri(2, 5), lose = ri(0, k - 1), [w, l] = aWins ? [a, b] : [b, a];
  L.table[w].w++; L.table[l].l++;
  const res = { day: WG.dayAbs, a: w, b: l, sport, sa: u ? k * u : null, sb: u ? lose * u : null, g };
  L.results.unshift(res); L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  return res;
}
const wW24LeagueRound = wLeagueRound;
wLeagueRound = function () {
  const L = wLeague(), F = L.next;
  if (!F || !F.games) { const r = wW24LeagueRound(); L.next = wDrawRound(); return r; }
  const out = [];
  for (const f of F.games) {
    if (f.a === 'me' || f.b === 'me') { if (!f.done) wLog(`Your league game against ${wTheClub(f.a === 'me' ? f.b : f.a)} at ${wGrd(f.g).name} is postponed.`, 'd'); continue; }
    if (L.table[f.a] && L.table[f.b]) out.push(wSimAt(f.a, f.b, f.g));
  }
  L.next = wDrawRound();
  return out;
};

/* ---------- words ---------- */
const wW24ClubName = wClubName;
wClubName = function (c) { return c === 'me' ? wPartyTeam().name : wW24ClubName(c); };
const wW24ResultText = wResultText;
wResultText = function (r) { const G = r && r.g && wGrd(r.g); return wW24ResultText(r) + (G ? ` at ${G.name}` : ''); };
function wFixLine(f) { return `${wCap(wTheClub(f.a))} v ${wTheClub(f.b)}, at ${wGrd(f.g).name} (${SPORT_NAME[wGrd(f.g).sport].toLowerCase()})`; }
const wW24LeagueHtml = wLeagueHtml;
wLeagueHtml = function () {
  const F = wFixtures(), mine = wMyFixture();
  return wW24LeagueHtml() + `<h4>Next round, day ${F.day}</h4><ul class="wlgnext">${F.games.map(f => `<li class="${f.a === 'me' || f.b === 'me' ? 'wme' : ''}">${esc(wFixLine(f))}${f.done ? ' <small>(played)</small>' : ''}</li>`).join('')}</ul>
    ${mine && !mine.done ? `<p class="hint">Your fixture: go to ${esc(wGrd(mine.g).name)} by day ${mine.day} and ask the groundskeeper for a GAME. Miss it and it is postponed.</p>` : ''}`;
};
function wOpenFixtures(gid) {
  if (LAB) return;
  const F = wFixtures(), G = wGrd(gid), here = F.games.filter(f => f.g === gid), last = wLeague().results.find(r => r.g === gid);
  modal(`<header><h3>Fixtures${G ? ' at ' + esc(G.name) : ''}</h3><button class="ghost" data-close>Done</button></header>
    ${here.length ? `<p class="wmsg">Here on day ${F.day}: ${here.map(f => esc(wFixLine(f))).join('; ')}.</p>` : `<p class="hint">Nothing here in the next round (day ${F.day}).</p>`}
    ${last ? `<p class="hint">Last league game here: ${esc(wCap(wResultText(last)))}.</p>` : ''}
    <div class="wlgbox">${wLeagueHtml()}</div>`);
}
for (const g of W_GRDS) DB.chars['gk_' + g.id.slice(2)].topics.fixtures = { t: 'The League sends the fixtures down every round. Here is the list.', act: 'fixtures' };

/* ---------- playing your fixture ---------- */
function wFixHere(id) { const f = wMyFixture(); return f && !f.done && f.g === id ? f : null; }
const wW24GrdProblems = wGrdProblems;
wGrdProblems = function (id, mode) {
  const out = wW24GrdProblems(id);
  if (mode === 'fixture' && !wFixHere(id)) out.push('Your league fixture is not at this ground.');
  return out;
};
function wFixTier(club, id) { const g = wGrd(id); return clamp((W_TIER[W_GRD_REG[g.city]] || 1) + W_FIX.tierUp + (club === 'apex' ? 1 : 0), 1, 3); }
const wW24StartGrd = wStartGrd;
wStartGrd = function (id, mode) {
  if (mode !== 'fixture') return wW24StartGrd(id, mode);
  const g = wGrd(id), f = wFixHere(id); if (!g || !f) return 'Your league fixture is not at this ground.';
  const probs = wGrdProblems(id); if (probs.length) return probs[0];
  startMatch({ type: 'rival', sport: g.sport, tier: wFixTier(f.club, id), world: { kind: 'ground', ref: { g: id, mode: 'fixture', club: f.club, day: f.day }, region: W_GRD_REG[g.city] } });
  return '';
};
W_GRD_PLAY.fixture = { n: 'League fixture', type: 'rival', up: W_FIX.tierUp, what: 'your league opponents' };
const wW24OpenGrdCard = wOpenGrdCard;
wOpenGrdCard = function (id, msg) {
  wW24OpenGrdCard(id, msg);
  const f = wFixHere(id), list = document.querySelector('#modalBox .wbclubs'); if (!list) return;
  // the fixture row is the card's own: Friendly and Challenge stay as they are
  list.querySelectorAll('[data-gplay="fixture"]').forEach(b => b.closest('li').remove());
  const mine = wMyFixture();
  if (!f) {
    if (mine && !mine.done) list.insertAdjacentHTML('beforebegin', `<p class="hint">Your league fixture this round is at ${esc(wGrd(mine.g).name)}, by day ${mine.day}.</p>`);
    return;
  }
  const probs = wGrdProblems(id), h = wH2hLast(f.club);
  list.insertAdjacentHTML('afterbegin', `<li class="wbcl"><span class="wbsw" style="background:${wClubColor(f.club)}"></span><div><b>League fixture: ${esc(wTheClub(f.club))}</b>
    <small>Two points on the table for a win. Tier ${wFixTier(f.club, id)}. Play by day ${f.day}, or it is postponed.${h ? ' ' + esc(h) : ''}</small></div>
    <div class="row"><button class="btn" data-gfix="1" ${probs.length ? 'disabled' : ''}>Play</button></div></li>`);
  const b = list.querySelector('[data-gfix]');
  b.onclick = () => { $('modalBox').querySelector('[data-close]').click(); const r = wStartGrd(id, 'fixture'); if (r) wOpenGrdCard(id, r); };
};

/* ---------- the match's look ---------- */
const wW24MatchTitle = wMatchTitle;
wMatchTitle = function (enc) {
  const W = enc.world, ref = W.ref || {};
  if (W.kind !== 'ground' || ref.mode !== 'fixture' || !wGrd(ref.g)) return wW24MatchTitle(enc);
  return `League fixture at ${wGrd(ref.g).name}: ${wTheClub(ref.club)}`;
};
const wW24MatchTeam = wMatchTeam;
wMatchTeam = function (W) {
  const ref = W && W.ref;
  if (!W || W.kind !== 'ground' || !ref || ref.mode !== 'fixture') return wW24MatchTeam(W);
  if (ref.club === 'apex') return Object.assign({}, W_CUP.apexTeam);
  const c = CLUBS[ref.club]; return c ? { name: c.name, short: c.short, color: c.color, light: c.light } : wW24MatchTeam(W);
};
function wCrowdLine(gid) {
  const h = wGrdState().rec[gid], pos = wMyPlace();
  if (pos && pos.n === 1) return 'The crowd knows you: top of the table, and they want to see it.';
  if (h && h.w >= 3 && h.w > h.l) return 'The crowd cheers you on. You have won here before, more than once.';
  if (h && h.l > h.w) return 'The crowd jeers. The last time you were here, it did not go well.';
  return 'The crowd is curious. They have heard of you, a little.';
}
const wW24PreGame = wPreGame;
wPreGame = function (enc) {
  wW24PreGame(enc);
  const W = enc.world, ref = W.ref || {}, box = document.querySelector('#modalBox .wpgtxt'); if (W.kind !== 'ground' || !box || !wGrd(ref.g)) return;
  const who = box.querySelector('.wpgwho');
  if (ref.mode === 'fixture' && who) who.insertAdjacentHTML('afterend', `<p class="wpgfix">League fixture. ${esc(wH2hLast(ref.club) || 'Your first league game against them.')}</p>`);
  box.insertAdjacentHTML('beforeend', `<p class="hint wcrowd">${esc(wCrowdLine(ref.g))}</p>`);
};

/* ---------- the end of a fixture ---------- */
const wW24OnGround = W_ON_END.ground;
W_ON_END.ground = function (r, ref, W) {
  wW24OnGround(r, ref, W);
  if (!ref || ref.mode !== 'fixture') return;
  const L = wLeague(), F = wFixtures(), club = ref.club, g = (RUN.games || [])[RUN.games.length - 1] || {};
  const f = F.games.find(x => (x.a === club && x.b === 'me') || (x.a === 'me' && x.b === club)); if (f) f.done = 1;
  wLeagueMine(r);
  if (L.table[club]) { if (r === 'win') L.table[club].l++; else L.table[club].w++; }
  const us = typeof g.us === 'number' ? g.us : null, them = typeof g.them === 'number' ? g.them : null;
  const res = r === 'win' ? { a: 'me', b: club, sa: us, sb: them } : { a: club, b: 'me', sa: them, sb: us };
  L.results.unshift(Object.assign(res, { day: WG.dayAbs, sport: wGrd(ref.g).sport, g: ref.g }));
  L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  wH2hRecord(club, r);
  if (r === 'win') {
    RUN.fans = (RUN.fans || 0) + W_FIX.fans;
    wLog(`Two points on the table. The crowd at ${wGrd(ref.g).name} stays to sing: ${W_FIX.fans} fans.`, 'g');
    wMaybeBid(club);
  }
};

/* ---------- the scoreboard and the fans ---------- */
const wW24Use = wUse;
wUse = function (x, y) {
  const m = wCurMap(), g = m.grd && wGrd(m.grd);
  const r = wW24Use(x, y);
  if (g && wTileAt(m, x, y) === '%') { const last = wLeague().results.find(q => q.g === g.id); if (last) wLog(`Last league game here: ${wCap(wResultText(last))}.`, 'g'); }
  return r;
};
// your place in the table: { n, of, played }, or null before your first league game
function wMyPlace() {
  if (!WG || !WG.league || !RUN) return null;
  const rows = wLeagueRows(), i = rows.findIndex(r => r.me), me = rows[i];
  return me && me.w + me.l ? { n: i + 1, of: rows.length, played: me.w + me.l } : null;
}
const W_FAN_LINES = {
  top: 'Top of the table! I said you would be. I said it to everyone, and most of them listened.',
  high: n => `Number ${n} in the table. Keep going and they will be painting your name on the stands.`,
  low: 'Bottom half of the table. Never mind. I still clap. Somebody has to.',
};
const wW24Say = wSay;
wSay = function (id, kw) {
  const r = wW24Say(id, kw);
  if (String(id).startsWith('gf_') && !(kw || '').trim()) {
    const p = wMyPlace();
    if (p) r.text = p.n === 1 ? W_FAN_LINES.top : p.n <= Math.ceil(p.of / 2) ? W_FAN_LINES.high(p.n) : W_FAN_LINES.low;
  }
  return r;
};
const wW24RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'fixtures') { const gid = 'g_' + String(id || '').replace(/^gk_/, ''); return void wOpenFixtures(wGrd(gid) ? gid : WG.map); }
  return wW24RunAct(act, id);
};

/* ---------- How to play ---------- */
const wW24RenderHelp = renderHelp;
renderHelp = function () {
  wW24RenderHelp();
  const h = $('wHelpGrdPlay') || $('wHelp'); if (!h || $('wHelpFixtures')) return;
  h.insertAdjacentHTML(h.id === 'wHelp' ? 'beforeend' : 'afterend', `<p class="hint" id="wHelpFixtures"><b>League fixtures.</b> Every league round is drawn up in advance, and the clubs play at the grounds: each game at one of the home side's two grounds, and the result goes on that ground's scoreboard. You have a fixture every round too, away at your opponent's city. Go there by the round day and ask the groundskeeper for a GAME. It is a hard match in the ground's sport, and the squad rule holds. A win is two points on the table and ${W_FIX.fans} fans; miss it and it is postponed. Ask a groundskeeper about FIXTURES, or an innkeeper for the TABLE. The fans at the grounds know where you stand.</p>`);
};
