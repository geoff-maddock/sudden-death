/* w34: defend the title (epic 2, phase 11). Loads after w33-sinks.js; changes earlier parts only by reassignment
   (saved originals carry the wW34 prefix).

   Win the Crown and the journey goes on as a new season, with you as the champions:
   - Renown carries over and grows: each crown you hold counts W_DEF.renown towards it (foes have more HP and Strength).
   - The cups reopen. From the year after you won a cup, its registrar takes your entry again: a title defence, at
     W_DEF.lvUp more levels. Win it and it counts as defended that year, for the usual prize.
   - Every club is hunting you. Out in the world, any rival club may turn up for a game (W_DEF.huntP a step, from the
     day after your crown): a rival match at your level plus W_DEF.huntLv. Win for W_DEF.huntWin; it counts on the
     table and the head to head like any rival game.
   - The Crown gets harder: its rounds are a level up for each crown you already hold.

   WG.defend = { cups: { cupId: [years defended] }, hunted: n, beaten: n } and WG.crownDay (the day of your
   last crown), plain data. W_DEF, wChamps() (crowns held),
   wDefending(id), wHuntMatch(region)
   Wrapped: wRenown, wCupProblem, wCupEnter and wCupPlay (re-entry, marked as a defence), wCupMatch (defence and Crown levels), wCupWon (defended),
   wEncounterHook (the hunt), W_ON_END.event (the hunt's purse), wPreGame (lines), wCampTeam (the title), renderHelp
   (#wHelpDefend). */

const W_DEF = { renown: 2, lvUp: 1, huntP: .02, huntLv: 1, huntWin: { gold: 40, fans: 8 } };

function wChamps() { return ((WG && WG.crowns) || []).length; }
function wDef() { return (WG.defend = WG.defend || { cups: {}, hunted: 0, beaten: 0 }); }
/* a cup already on your wall that you may enter again this year */
function wDefending(id) {
  const C = DB.cups[id];
  return !!C && id !== 'crown' && wChamps() > 0 && wFlag(C.flag) && ((WG.cupLog || {})[id] || { year: 0 }).year < WG.year;
}

/* ---------- renown carries over ---------- */
const wW34Renown = wRenown;
wRenown = function () { return wW34Renown() + W_DEF.renown * wChamps(); };

/* ---------- the cups reopen ---------- */
const wW34CupProblem = wCupProblem;
wCupProblem = function (id) {
  const why = wW34CupProblem(id);
  if (!why || !wDefending(id)) return why;
  if (RUN.gold < W_CUP.fee) return `Entry is ${W_CUP.fee} gold, and you have ${RUN.gold}.`;
  return '';
};
const wW34CupEnter = wCupEnter;
wCupEnter = function (id, o) {
  const fresh = !WG.cup || WG.cup.id !== id;
  return wW34CupEnter(id, fresh && wDefending(id) ? Object.assign({}, o, { wDefence: 1 }) : o);
};
/* the cup state is made inside the original enter; mark the defence before round 1's match is built */
const wW34CupPlay = wCupPlay;
wCupPlay = function (o) {
  if (o && o.wDefence && WG.cup && WG.cup.round === 0 && !WG.cup.defence) { WG.cup.defence = 1; wLog(`A title defence: ${wCupThe(WG.cup.id)}, a level harder than before.`, 'b'); }
  return wW34CupPlay(o);
};
const wW34CupMatch = wCupMatch;
wCupMatch = function (id, i) {
  const o = wW34CupMatch(id, i);
  if (id === 'crown') o.lv = Math.min(W_ROAD.maxLv, o.lv + wChamps());
  else if (WG.cup && WG.cup.id === id && WG.cup.defence) o.lv = Math.min(W_ROAD.maxLv, o.lv + W_DEF.lvUp);
  return o;
};
const wW34CupWon = wCupWon;
wCupWon = function (id) {
  const def = WG.cup && WG.cup.id === id && WG.cup.defence;
  wW34CupWon(id);
  if (id === 'crown') WG.crownDay = WG.dayAbs;   // the hunt starts the next day
  if (def) { const D = wDef(); (D.cups[id] = D.cups[id] || []).push(WG.year); wLog(`${wCap(wCupThe(id))}: title defended.`, 'g'); }
};

/* ---------- every club is hunting you ---------- */
function wHuntClub() { const cl = Object.values(WG.rivals || {}).filter((c, i, a) => CLUBS[c] && a.indexOf(c) === i); return cl.length ? pick(cl) : null; }
function wHuntMatch(region, club) {
  club = club || wHuntClub(); if (!club) return null;
  wDef().hunted++;
  const L = wLevelInfo(false);
  return startMatch({ type: 'rival', tier: wTierHere(), lv: Math.min(W_ROAD.maxLv, L.lv + W_DEF.huntLv), ambush: false, name: wClubCaptain(club),
    world: { kind: 'event', ref: { rival: club, hunt: 1 }, region: region || wRegionHere() } });
}
const wW34EncounterHook = wEncounterHook;
wEncounterHook = function (region, tileCh, info) {
  const day = (WG && WG.crownDay) || 0;
  if (!info && WG && RUN && wChamps() && WG.dayAbs > day && wCurMap().kind === 'world' && !WG.event && !(WG.grace > 0) && !WG.grudge && Math.random() < W_DEF.huntP) {
    const club = wHuntClub();
    if (club) { wLog(`The ${wClubName(club)} have been looking for the champions. ${wClubCaptain(club)}: "Title's on the line. Here. Now."`, 'b'); return wHuntMatch(region, club); }
  }
  return wW34EncounterHook(region, tileCh, info);
};
const wW34OnEvent = W_ON_END.event;
W_ON_END.event = function (r, ref, W) {
  wW34OnEvent(r, ref, W);
  if (!ref || !ref.hunt) return;
  if (r === 'win') { const P = W_DEF.huntWin; wDef().beaten++; RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans; wLog(`The champions see off the ${wClubName(ref.rival)}. ${P.gold} gold and ${P.fans} fans.`, 'g'); }
  else wLog(`The ${wClubName(ref.rival)} beat the champions, and will be telling everyone.`, 'd');
};

/* ---------- words ---------- */
const wW34PreGame = wPreGame;
wPreGame = function (enc) {
  wW34PreGame(enc);
  const box = document.querySelector('#modalBox .wpgtxt'), W = enc.world, ref = W.ref || {}; if (!box) return;
  let t = '';
  if (W.kind === 'event' && ref.hunt) t = `They want the champions. Win for ${W_DEF.huntWin.gold} gold and ${W_DEF.huntWin.fans} fans.`;
  else if (W.kind === 'cup' && WG.cup && WG.cup.defence) t = `A title defence: a level harder than when you won it.`;
  else if (W.kind === 'cup' && ref.cup === 'crown' && wChamps()) t = `Defending the Crown: ${wChamps()} level${wChamps() === 1 ? '' : 's'} harder for every crown you hold.`;
  if (t) box.insertAdjacentHTML('afterbegin', `<p class="wtaunt">${esc(t)}</p>`);
};
const wW34CampTeam = wCampTeam;
wCampTeam = function () {
  const h = wW34CampTeam(); if (!wChamps()) return h;
  const D = wDef(), cups = Object.values(D.cups).reduce((n, y) => n + y.length, 0);
  return `<p class="wgood wchamps"><b>Champions of the realm</b> (${WG.crowns.join(', ').replace(/(\d+)/g, 'year $1')}). Every club is hunting you.${cups ? ` Titles defended: ${cups}.` : ''}${D.beaten ? ` Hunters seen off: ${D.beaten}.` : ''}</p>` + h;
};

/* ---------- How to play ---------- */
const wW34RenderHelp = renderHelp;
renderHelp = function () {
  wW34RenderHelp();
  const sec = $('wHelpCups'); if (!sec || $('wHelpDefend')) return;
  sec.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpDefend"><b>Defend the title.</b> Win the Crown and the journey goes on, with you as the champions. Each crown adds ${W_DEF.renown} to your renown. From the next year, every cup on your wall takes your entry again as a title defence, a level harder. Every rival club is hunting you: out in the world they turn up for a game, a level up, and a win pays ${W_DEF.huntWin.gold} gold and ${W_DEF.huntWin.fans} fans. The Crown itself is a level harder for every crown you already hold.</p>`);
};
