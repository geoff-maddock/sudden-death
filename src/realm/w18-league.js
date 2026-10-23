/* w18: the league table and rivals who act (epic 2, phase 3). Loads after w17-bonds.js; changes earlier parts only by
   reassignment (saved originals carry the wW18 prefix).

   The league. Your four rival clubs and Apex Athletic play each other while you travel: a round every
   W_LEAGUE.every days (one club sits out). Inns post the table and the latest results (ask the innkeeper about the
   TABLE, or the League table button in the room menu). Your own row counts your cup games and your games against
   rival clubs.

   Rivals who act.
   - Poaching. Every second win against a rival club, they try to sign your best bench player. Sell them for the
     fee, or refuse, and they come for a grudge match on the road (WG.grudge).
   - Grudges. While a grudge stands, the club can turn up on any step out in the world from the next day: a rival
     match, a level up. Win to settle it for gold and fans; lose and they have had their revenge. Either way it ends.
   - Taunts. Enter a cup whose rival beat you last time and their captain taunts you at the sign-up (WG.cup.revenge).
     Beat them in round 3 for a revenge bonus.

   WG.league  { str: { club: strength }, table: { club: { w, l } }, me: { w, l }, results: [{ day, a, b, sa, sb, sport }],
                poached: { club: wins at the last bid } }
   WG.grudge  { club, day, n } or null   n: the name of the player you would not sell

   Wrapped: wNewDay (the league's rounds), W_ON_END.cup and W_ON_END.event (your row, bids, revenge, grudges),
   wEncounterHook (a grudge on the road), wCupEnter (the taunt), wPreGame (taunt, revenge and grudge lines),
   wNextPrompt and wPromptLab (the bid), wRunAct (act 'league'), wOpenInn (the League table button), renderHelp. */

const W_LEAGUE = {
  every: 2, keep: 8,          // a round every 2 days; the inns post the last 8 results
  apexStr: 1.5, str: [.8, 1.2],
  bidEvery: 2,                // a rival bids after every 2nd win against them
  fee: lvl => 60 + 40 * lvl,  // what they offer for a player
  grudgeP: .06, grudgeLv: 1,  // a grudge match turns up on this share of world steps, a level up
  grudgeWin: { gold: 60, fans: 10 },
  revenge: 50,                // gold for beating, in round 3, the rival who taunted you
};

/* ---------- the table ---------- */
function wLeagueClubs() { const rv = Object.values((WG && WG.rivals) || {}).filter((c, i, a) => CLUBS[c] && a.indexOf(c) === i); return rv.concat('apex'); }
function wLeague() {
  const L = WG.league = WG.league || { str: {}, table: {}, me: { w: 0, l: 0 }, results: [], poached: {} };
  for (const c of wLeagueClubs()) {
    if (L.str[c] == null) L.str[c] = c === 'apex' ? W_LEAGUE.apexStr : +(W_LEAGUE.str[0] + Math.random() * (W_LEAGUE.str[1] - W_LEAGUE.str[0])).toFixed(2);
    L.table[c] = L.table[c] || { w: 0, l: 0 };
  }
  return L;
}
function wClubName(c) { return c === 'apex' ? DB.apex.name : CLUBS[c] ? CLUBS[c].name : c; }
function wClubColor(c) { return c === 'apex' ? '#f2c14e' : CLUBS[c] ? CLUBS[c].color : '#888'; }
function wAllSports() { return [...new Set(Object.values(DB.regions).flatMap(R => R.sports.map(s => s[0])))]; }
/* one game between two clubs: the stronger usually wins; a score where the sport keeps one */
function wSimGame(a, b) {
  const L = wLeague(), pa = L.str[a] / (L.str[a] + L.str[b]), aWins = Math.random() < pa, sport = pick(wAllSports());
  const u = SPORT_UNIT[sport], k = ri(2, 5), lose = ri(0, k - 1);
  const [w, l] = aWins ? [a, b] : [b, a];
  L.table[w].w++; L.table[l].l++;
  const res = { day: WG.dayAbs, a: w, b: l, sport, sa: u ? k * u : null, sb: u ? lose * u : null };
  L.results.unshift(res); L.results.length = Math.min(L.results.length, W_LEAGUE.keep);
  return res;
}
function wLeagueRound() {
  const cl = shuffle(wLeagueClubs().slice()), out = [];
  for (let i = 0; i + 1 < cl.length; i += 2) out.push(wSimGame(cl[i], cl[i + 1]));
  return out;
}
const wW18NewDay = wNewDay;
wNewDay = function () {
  wW18NewDay();
  if (WG && WG.rivals && WG.dayAbs % W_LEAGUE.every === 0) { try { wLeagueRound(); } catch (e) { console.error(e); } }
};
/* rows, best first: { club, name, w, l, pts, me } */
function wLeagueRows() {
  const L = wLeague(), rows = wLeagueClubs().map(c => ({ club: c, name: wClubName(c), w: L.table[c].w, l: L.table[c].l }));
  rows.push({ club: RUN.club, name: wPartyTeam().name, w: L.me.w, l: L.me.l, me: true });
  for (const r of rows) r.pts = 2 * r.w;
  return rows.sort((x, y) => y.pts - x.pts || x.l - y.l || (y.me ? 1 : 0) - (x.me ? 1 : 0));
}
/* 'the Ironmaw Marauders', but 'Apex Athletic' */
function wTheClub(c) { return c === 'apex' ? wClubName(c) : 'the ' + wClubName(c); }
function wResultText(r) {
  const sc = r.sa != null && r.sb != null ? ` ${r.sa}–${r.sb}` : '';
  return `${wTheClub(r.a)} beat ${wTheClub(r.b)}${sc} (${(SPORT_NAME[r.sport] || r.sport).toLowerCase()})`;
}
function wLeagueHtml() {
  const L = wLeague(), rows = wLeagueRows();
  return `<table class="wlg"><thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>L</th><th>Pts</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr class="${r.me ? 'wme' : ''}"><td>${i + 1}</td><th><i style="background:${r.me ? wPartyTeam().color : wClubColor(r.club)}"></i>${esc(r.name)}${r.me ? ' <small>(you)</small>' : ''}</th><td>${r.w + r.l}</td><td>${r.w}</td><td>${r.l}</td><td><b>${r.pts}</b></td></tr>`).join('')}
    </tbody></table>
    <p class="hint">Two points a win. Your row counts your cup games and your games against rival clubs. The others play a round every ${W_LEAGUE.every} days.</p>
    <h4>Latest results</h4>${L.results.length ? `<ul class="wlgres">${L.results.map(r => `<li><small>Day ${r.day}</small> ${esc(wCap(wResultText(r)))}.</li>`).join('')}</ul>` : '<p class="hint">No games yet this season.</p>'}
    ${WG.grudge ? `<p class="wbad">The ${esc(wClubName(WG.grudge.club))} have a grudge against you. Watch the roads.</p>` : ''}`;
}
function wOpenLeague(who) {
  if (LAB) return;
  modal(`<header><h3>The League table</h3><button class="ghost" data-close>Done</button></header>
    <p class="hint">${esc(who || 'The innkeeper')} points at the board by the door.</p><div class="wlgbox">${wLeagueHtml()}</div>`);
}

/* ---------- the inns post it ---------- */
for (const id of W_TAVERN_INNS) {
  const ch = DB.chars[id]; if (!ch) continue;
  ch.topics.table = { t: 'The League board, by the door. Every result the coaches bring in, and the table, chalked up fresh.', act: 'league' };
  ch.greet += ' The League TABLE is by the door.';
}
const wW18RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'league') return wOpenLeague(wChar(id).name);
  return wW18RunAct(act, id);
};
const wW18OpenInn = wOpenInn;
wOpenInn = function (price, who) {
  wW18OpenInn(price, who);
  const row = $('wSleep') && $('wSleep').parentNode; if (!row || $('wInnLeague')) return;
  row.insertAdjacentHTML('beforeend', '<button class="ghost" id="wInnLeague">League table</button>');
  $('wInnLeague').onclick = () => wOpenLeague(who);
};

/* ---------- your row, bids, revenge, grudges: when a match against a club ends ---------- */
function wIsRival(c) { return Object.values((WG && WG.rivals) || {}).includes(c); }
function wLeagueMine(r) { const L = wLeague(); if (r === 'win') L.me.w++; else L.me.l++; }
/* after a win against a rival club: every second one, they bid for your best bench player */
function wMaybeBid(club) {
  const h = (WG.h2h || {})[club], L = wLeague();
  if (!h || !wIsRival(club) || WG.grudge || h.w < W_LEAGUE.bidEvery || h.w - (L.poached[club] || 0) < W_LEAGUE.bidEvery) return;
  if ((WG.wprompts || []).some(P => P.t === 'bid')) return;
  const p = wBenchList().slice().sort((a, b) => b.lvl - a.lvl || a.id - b.id)[0]; if (!p) return;
  L.poached[club] = h.w;
  WG.wprompts.push({ t: 'bid', club, pid: p.id });
  wLog(`The ${wClubName(club)} have noticed ${p.n}.`, 'm');
}
const wW18OnCup = W_ON_END.cup;
W_ON_END.cup = function (r, ref, W) {
  const rev = WG.cup && ref && WG.cup.id === ref.cup && WG.cup.revenge;
  wW18OnCup(r, ref, W);
  if (!ref) return;
  wLeagueMine(r);
  if (r === 'win' && rev && ref.club === rev) { RUN.gold += W_LEAGUE.revenge; wLog(`Revenge on the ${wClubName(rev)}: ${W_LEAGUE.revenge} gold.`, 'g'); }
  if (r === 'win' && ref.club) wMaybeBid(ref.club);
};
const wW18OnEvent = W_ON_END.event;
W_ON_END.event = function (r, ref, W) {
  wW18OnEvent(r, ref, W);
  if (!ref || !ref.rival) return;
  wLeagueMine(r);
  if (ref.grudge) {
    WG.grudge = null;
    if (r === 'win') { const P = W_LEAGUE.grudgeWin; RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans; wLog(`Grudge settled: the ${wClubName(ref.rival)} go home beaten. ${P.gold} gold and ${P.fans} fans.`, 'g'); }
    else wLog(`The ${wClubName(ref.rival)} have had their revenge. That is the end of it.`, 'd');
  }
  if (r === 'win') wMaybeBid(ref.rival);
};

/* ---------- the bid ---------- */
function wBidPlayer(P) { const p = wPlayer(P.pid); return p && !wIsStarter(p.id) ? p : wBenchList().slice().sort((a, b) => b.lvl - a.lvl)[0] || null; }
/* sell: '' or why not */
function wBidSell(club, pid) {
  const p = wPlayer(pid); if (!p) return 'They have gone.';
  const fee = W_LEAGUE.fee(p.lvl), why = wRelease(pid); if (why) return why;
  RUN.gold += fee;
  wLog(`You sell ${p.n} to the ${wClubName(club)} for ${fee} gold.`, 'm');
  wSave();
  return '';
}
function wBidRefuse(club, pid) {
  const p = wPlayer(pid);
  WG.grudge = { club, day: WG.dayAbs + 1, n: p ? p.n : '' };
  wLog(`You turn the ${wClubName(club)} down. They do not take it well: watch the roads.`, 'b');
  wSave();
}
function wShowBid(P) {
  const p = wBidPlayer(P); if (!p) return false;
  const club = P.club, c = CLUBS[club], fee = W_LEAGUE.fee(p.lvl), cap = wClubCaptain(club);
  let chose = false;
  const close = modal(`<header><h3>An offer from the ${esc(wClubName(club))}</h3></header>
    <div class="wrec"><img class="wrecport" src="${c ? portraitURL(c.roster[0][1], c, c.roster[0][2], 120) : wPlayerPort(p, 120)}" alt="">
      <div><p class="wrecwho">${esc(cap)} has a pen out. "Twice you beat us. Fine. We will have ${esc(p.n)} instead. ${fee} gold, today."</p>
      <p class="hint">${esc(p.n)}, ${esc(wKindName(p.kind))}, level ${p.lvl}, on your bench, with ${wCardsOf(p.id).length} card${wCardsOf(p.id).length === 1 ? '' : 's'}. Sell, and they leave with their cards. Refuse, and the ${esc(wClubName(club))} will come for a grudge match on the road.</p></div></div>
    <div class="row"><button class="btn" id="wBidSell">Sell ${esc(p.n)}, ${fee} gold</button><button class="ghost" id="wBidNo">Refuse</button></div>`,
    () => { if (!chose) { chose = true; wBidRefuse(club, p.id); wDrain(); } });
  $('wBidNo').focus();
  $('wBidSell').onclick = () => { chose = true; close(); const why = wBidSell(club, p.id); if (why) wLog(why, 'b'); wDrain(); };
  $('wBidNo').onclick = () => close();
  return true;
}
const wW18NextPrompt = wNextPrompt;
wNextPrompt = function () {
  const P = WG && WG.wprompts && WG.wprompts[0];
  if (P && P.t === 'bid' && !LAB && !WG.cardOffer && !WG.event && !(typeof W11 !== 'undefined' && W11.ending) && wActive()) {
    WG.wprompts.shift(); if (!wShowBid(P)) wDrain(); wSave(); return true;
  }
  return wW18NextPrompt();
};
/* the bot refuses (W_LEAGUE.labSell to sell instead) */
const wW18PromptLab = wPromptLab;
wPromptLab = function (P) {
  if (!P || P.t !== 'bid') return wW18PromptLab(P);
  const p = wBidPlayer(P); if (!p) return;
  if (W_LEAGUE.labSell) wBidSell(P.club, p.id); else wBidRefuse(P.club, p.id);
};

/* ---------- a grudge on the road ---------- */
function wGrudgeMatch(region) {
  const G = WG.grudge; if (!G) return null;
  region = region || wRegionHere();
  const L = wLevelInfo(false);
  return startMatch({ type: 'rival', tier: wTierHere(), lv: Math.min(W_ROAD.maxLv, L.lv + W_LEAGUE.grudgeLv), ambush: false, name: wClubCaptain(G.club),
    world: { kind: 'event', ref: { rival: G.club, grudge: 1 }, region } });
}
const wW18EncounterHook = wEncounterHook;
wEncounterHook = function (region, tileCh, info) {
  const G = WG && WG.grudge;
  if (G && !info && RUN && wCurMap().kind === 'world' && !WG.event && !(WG.grace > 0) && WG.dayAbs >= G.day && Math.random() < W_LEAGUE.grudgeP) {
    wLog(`The ${wClubName(G.club)} block the road. They have not forgotten ${G.n || 'the offer you turned down'}.`, 'b');
    return wGrudgeMatch(region);
  }
  return wW18EncounterHook(region, tileCh, info);
};

/* ---------- the taunt: a cup whose rival beat you last ---------- */
const W_TAUNTS = ['Back for more? We still talk about last time.', 'Bring the same lineup. Please.', 'We saved you a seat. On the bench.', 'You again. This will not take long.'];
const wW18CupEnter = wCupEnter;
wCupEnter = function (id, o) {
  const fresh = !WG.cup || WG.cup.id !== id;
  if (fresh && id !== 'crown' && !wCupProblem(id)) {
    const club = wCupRival(id), h = club && (WG.h2h || {})[club];
    if (h && h.last && h.last.r === 'lose') {
      const t = pick(W_TAUNTS);
      wLog(`${wClubCaptain(club)} of the ${wClubName(club)} is at the sign-up desk: "${t}"`, 'b');
      const why = wW18CupEnter(id, Object.assign({}, o, { wTaunt: { club, t } }));
      return why;
    }
  }
  return wW18CupEnter(id, o);
};
/* the cup state is made inside the original; mark the revenge round once it exists */
const wW18CupPlay = wCupPlay;
wCupPlay = function (o) {
  if (o && o.wTaunt && WG.cup && WG.cup.round === 0) { WG.cup.revenge = o.wTaunt.club; WG.cup.taunt = o.wTaunt.t; }
  return wW18CupPlay(o);
};
const wW18PreGame = wPreGame;
wPreGame = function (enc) {
  wW18PreGame(enc);
  const W = enc.world, ref = W.ref || {}, box = document.querySelector('#modalBox .wpgtxt'); if (!box) return;
  let t = '';
  if (W.kind === 'cup' && WG.cup && WG.cup.revenge) {
    if (ref.round === 0 && WG.cup.taunt) t = `${wClubCaptain(WG.cup.revenge)} of the ${wClubName(WG.cup.revenge)}, at the sign-up: "${WG.cup.taunt}" Beat them in round 3 for ${W_LEAGUE.revenge} gold more.`;
    else if (ref.club === WG.cup.revenge) t = `Revenge: win this for ${W_LEAGUE.revenge} gold more.`;
  } else if (W.kind === 'event' && ref.grudge) t = `A grudge match: you would not sell them ${WG.grudge && WG.grudge.n ? WG.grudge.n : 'your player'}. Win and it is settled, for ${W_LEAGUE.grudgeWin.gold} gold and ${W_LEAGUE.grudgeWin.fans} fans.`;
  if (t) box.insertAdjacentHTML('afterbegin', `<p class="wtaunt">${esc(t)}</p>`);
};

/* ---------- How to play ---------- */
const wW18RenderHelp = renderHelp;
renderHelp = function () {
  wW18RenderHelp();
  const sec = $('wHelpCups'); if (!sec || $('wHelpLeague')) return;
  sec.insertAdjacentHTML('beforeend', `<div id="wHelpLeague"><p class="hint"><b>The League table.</b> Your rivals and Apex Athletic play each other while you travel, a round every ${W_LEAGUE.every} days. Every inn posts the table and the latest results: ask the innkeeper about the TABLE. Your row counts your cup games and your games against rival clubs.</p>
    <p class="hint"><b>Rivals act.</b> Beat a rival club twice and they bid for your best bench player. Sell them for the fee, or refuse and the club comes for a grudge match on the road: win it for gold and fans. A rival who beat you last time taunts you when you enter their town's cup; beat them in round 3 for ${W_LEAGUE.revenge} gold more.</p></div>`);
};
