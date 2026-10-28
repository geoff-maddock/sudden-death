/* w35: the Hall of Legends (epic 2, phase 12). Loads after w34-defend.js; changes earlier parts only by reassignment
   (saved originals carry the wW35 prefix).

   Win the Crown and your team goes into the Hall of Legends: its name, colours and starting three, kept per profile
   outside the journey's save (pkey('sd-realm-legends'), the latest W_LEG.keep). In every later journey those past
   champions are famous teams:
   - At the Crown Coliseum, Steward Crane keeps the Hall: ask about the LEGENDS and challenge any of them, once a
     journey each. A hard match at the top tier against their starting three, by name, in their colours.
   - Out in the world, once you hold W_LEG.roadCups cups, a legend you have not beaten may turn up (W_LEG.roadP a step).
   Beat a legend for W_LEG.prize and a pick of rare cards. A journey never meets its own legend.

   wLegendsAll() (the Hall, from storage), WG.legends (this journey's copy, taken at the start), WG.legBeat = { id: day },
   WG.legId (this journey's own entry, once it has won the Crown). Plain data.
   W_LEG, wLegendMatch(id), wOpenLegends()
   Wrapped: wStart (copy the Hall in), wCupWon (into the Hall), wEncounterHook (on the road), wMatchTeam (their
   colours), wPreGame (the line), wRunAct (act 'legends'), renderHelp (#wHelpLegends). W_ON_END.legend settles it.
   A fightStart hook names their players. Also a medal (w_legends, Legend Slayer: realmLegends). */

const W_LEG = { keep: 10, roadCups: 2, roadP: .012, tier: 3, lv: 2, prize: { gold: 120, fans: 30, pick: 3, rarity: 'r' } };
function wLegKey() { return pkey('sd-realm-legends'); }
function wLegendsAll() { try { return JSON.parse(localStorage.getItem(wLegKey()) || '[]') || []; } catch (e) { return []; } }
function wLegendsSave(list) { if (LAB) return; try { localStorage.setItem(wLegKey(), JSON.stringify(list.slice(-W_LEG.keep))); } catch (e) { } }
function wLegends() { return (WG && WG.legends) || []; }
function wLegend(id) { return wLegends().find(l => l.id === id) || null; }
function wLegBeaten(id) { return !!(WG.legBeat && WG.legBeat[id]); }

/* ---------- into the Hall: on a Crown, this journey's team (one entry a journey, updated by later crowns) ---------- */
function wLegendOfJourney() {
  const team = wPartyTeam(), cap = typeof wCaptain === 'function' && wCaptain();
  return { id: WG.legId, name: team.name, short: team.short, color: team.color, light: team.light, year: WG.year, crowns: (WG.crowns || []).length,
    hard: WG.hardcore ? 1 : 0, at: new Date().toISOString().slice(0, 10), cap: cap ? cap.n : (wStarters()[0] || {}).n,
    players: wStarters().map(p => ({ n: p.n, kind: p.kind, lvl: p.lvl, num: p.num })) };
}
const wW35CupWon = wCupWon;
wCupWon = function (id) {
  wW35CupWon(id);
  if (id !== 'crown' || LAB) return;
  WG.legId = WG.legId || 'L' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
  const all = wLegendsAll().filter(l => l.id !== WG.legId);
  all.push(wLegendOfJourney());
  wLegendsSave(all);
  wLog('Your team goes into the Hall of Legends at the Crown Coliseum. Later journeys will have to beat you.', 'g');
};
/* a new journey takes a copy of the Hall */
const wW35Start = wStart;
wStart = function (a, b) {
  const r = wW35Start(a, b);
  if (WG && !WG.legends) { WG.legends = wLegendsAll().filter(l => l.id !== WG.legId); WG.legBeat = WG.legBeat || {}; }
  return r;
};

/* ---------- a legend's match ---------- */
function wLegendIds(L) {
  const plain = id => !ENEMIES[id].boss && !ENEMIES[id].team && !ENEMIES[id].ai.quarters;
  let elites = 0;
  return L.players.map(p => {
    const mine = Object.keys(ENEMIES).filter(id => plain(id) && ENEMIES[id].kind === p.kind);
    const reg = mine.filter(id => !ENEMIES[id].elite);
    if (reg.length) return pick(reg);
    if (mine.length && !elites++) return pick(mine);
    return pick(Object.keys(ENEMIES).filter(id => plain(id) && !ENEMIES[id].elite));
  });
}
function wLegendMatch(id, region) {
  const L = wLegend(id); if (!L || wLegBeaten(id)) return null;
  return startMatch({ type: 'rival', ids: wLegendIds(L), tier: W_LEG.tier, lv: Math.min(W_ROAD.maxLv, W_LEG.lv + (L.crowns || 1) - 1), ambush: false, name: L.cap,
    world: { kind: 'legend', ref: { id }, region: region || wRegionHere() } });
}
onHook('fightStart', () => {
  const W = RUN && RUN.pending && RUN.pending.world, L = W && W.kind === 'legend' && wLegend(W.ref && W.ref.id);
  if (!WG || !B || !L) return;
  B.enemies.forEach((e, i) => { const p = L.players[i]; if (p) { e.n = p.n; e.num = p.num || e.num; } });
  log(`${L.name}, champions of year ${L.year}${L.crowns > 1 ? `, ${L.crowns} crowns` : ''}. A legend.`, 'sys');
});
W_ON_END.legend = function (r, ref, W) {
  const L = ref && wLegend(ref.id); if (!L) return;
  if (r !== 'win') { wLog(`${L.name} are still legends. Come back when you are ready.`, 'd'); return; }
  (WG.legBeat = WG.legBeat || {})[L.id] = WG.dayAbs;
  const P = W_LEG.prize; RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans;
  wLog(`You beat ${L.name}, champions of year ${L.year}! ${P.gold} gold and ${P.fans} fans.`, 'g');
  wGainCard({ pick: P.pick, rarity: P.rarity }, `beating ${L.name}`);
  achAdd('realmLegends', 1);
};
const wW35MatchTeam = wMatchTeam;
wMatchTeam = function (W) {
  const L = W && W.kind === 'legend' && wLegend(W.ref && W.ref.id);
  return L ? { name: L.name, short: L.short, color: L.color, light: L.light } : wW35MatchTeam(W);
};
const wW35PreGame = wPreGame;
wPreGame = function (enc) {
  wW35PreGame(enc);
  const W = enc.world, L = W.kind === 'legend' && wLegend(W.ref && W.ref.id), box = document.querySelector('#modalBox .wpgtxt'); if (!box || !L) return;
  box.insertAdjacentHTML('afterbegin', `<p class="wtaunt">${esc(L.name)}, from the Hall of Legends: champions of year ${L.year} on ${esc(L.at)}${L.hard ? ', in Hardcore' : ''}. ${esc(L.players.map(p => `${p.n} (${wKindName(p.kind)}, level ${p.lvl})`).join(', '))}. Win for ${W_LEG.prize.gold} gold, ${W_LEG.prize.fans} fans and a pick of rare cards.</p>`);
};

/* ---------- on the road ---------- */
const wW35EncounterHook = wEncounterHook;
wEncounterHook = function (region, tileCh, info) {
  if (!info && WG && RUN && wCurMap().kind === 'world' && !WG.event && !(WG.grace > 0) && wCupsWon() >= W_LEG.roadCups && Math.random() < W_LEG.roadP) {
    const L = wLegends().filter(l => !wLegBeaten(l.id))[0];
    if (L) { wLog(`A team in old-fashioned kit stops on the road. It is ${L.name}, champions of year ${L.year}. "We heard you were good."`, 'b'); return wLegendMatch(L.id, region); }
  }
  return wW35EncounterHook(region, tileCh, info);
};

/* ---------- the Hall, at the Crown Coliseum ---------- */
function wOpenLegends() {
  if (LAB) return;
  const list = wLegends();
  const rows = list.map(L => `<li class="wbcl"><span class="wbsw" style="background:${L.color}"></span><div><b>${esc(L.name)}</b> <small>champions of year ${L.year}${L.crowns > 1 ? `, ${L.crowns} crowns` : ''}, ${esc(L.at)}${L.hard ? ', Hardcore' : ''}</small>
    <small>${esc(L.players.map(p => `${p.n} (${wKindName(p.kind)} ${p.lvl})`).join(', '))}</small></div>
    <div class="row">${wLegBeaten(L.id) ? '<b class="wgood">Beaten</b>' : `<button class="btn" data-legend="${esc(L.id)}">Challenge</button>`}</div></li>`).join('');
  const close = modal(`<header><h3>The Hall of Legends</h3><button class="ghost" data-close>Done</button></header>
    <p class="hint">Steward Crane walks you past the portraits. Every team that won the Crown on this profile hangs here. Each will play you once a journey: a hard game at the top tier.</p>
    ${list.length ? `<ul class="wbclubs">${rows}</ul>` : '<p class="hint">The walls are bare. Win the Crown and yours will be the first portrait.</p>'}`);
  $('modalBox').querySelectorAll('[data-legend]').forEach(b => b.onclick = () => { close(); wCloseTalk(); wLegendMatch(b.dataset.legend, 'plains'); wDrain(); });
}
if (DB.chars.steward) {
  DB.chars.steward.topics.legends = { t: 'The Hall of Legends: every team that ever won the Crown, on the wall where Apex Athletic cannot take them down. They will still play you.', act: 'legends' };
  DB.chars.steward.greet += ' The Hall of LEGENDS is through the arch.';
}
const wW35RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'legends') return wOpenLegends();
  return wW35RunAct(act, id);
};

/* ---------- a medal, How to play ---------- */
ACH.push({ id: 'w_legends', n: 'Legend Slayer', d: 'Beat a past champion team from the Hall of Legends', stat: 'realmLegends', at: [1, 3, 6] });
const wW35RenderHelp = renderHelp;
renderHelp = function () {
  wW35RenderHelp();
  const sec = $('wHelpCups'); if (!sec || $('wHelpLegends')) return;
  sec.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpLegends"><b>The Hall of Legends.</b> Every team that wins the Crown on your profile goes into the Hall at the Crown Coliseum, with its starting three. In later journeys they are famous teams: ask Steward Crane about the LEGENDS to challenge one (once a journey each), and once you hold ${W_LEG.roadCups} cups they may stop you on the road. Beat a legend for ${W_LEG.prize.gold} gold, ${W_LEG.prize.fans} fans and a pick of rare cards.</p>`);
};
