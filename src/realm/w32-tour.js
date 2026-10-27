/* w32: the travelling exhibition team (epic 2, phase 9). Loads after w31-name.js; changes earlier parts only by
   reassignment (saved originals carry the wW32 prefix).

   The Barnstormers, a famous show team, tour the realm: W_TOUR.stay days in one region, then on to another. Nobody
   knows exactly where they are; you track them by rumour. Innkeepers have heard (ask about the BARNSTORMERS), and the
   notice boards carry their posters. Rumours lag: for a day after the Barnstormers move on, people still tell you where
   they were (they are on the road between regions). Once you hold W_TOUR.cups cup, walk the open country of their
   region and they may turn up (W_TOUR.p a step): a boss match, two levels up. Beat them and their ringmaster hands
   over Showstopper, a Hall of Fame card no one else has, with gold and fans; then they go home for the year. Next year they tour again, for a purse only. Lose
   and they pack up and move on.

   WG.tour = { region, prev, since, beat: [years], played }, plain data. W_TOUR, wTour(), wTourRumour(), wTourMatch()
   Wrapped: wNewDay (the tour moves), wEncounterHook (they turn up), wMatchTeam (their colours), wPreGame (the line),
   wOpenBoard (the poster), renderHelp (#wHelpTour). W_ON_END.tour settles it.
   A fightStart hook puts every enemy, the boss too, in their kit.
   Also a medal (w_tour, Showstoppers: realmTour). */

const W_TOUR = {
  name: 'The Barnstormers', ring: 'Ringmaster Pell', start: 3, stay: 4, p: .045, cups: 1, lvUp: 2,
  type: 'boss', tier: 2,   // a boss with its brains: as an elite at tier 3 the bot beat them 44 times in 44 (docs/realm/BALANCE.md)
  team: { name: 'The Barnstormers', short: 'BRN', color: '#d8472e', light: '#ffe2a8' },
  prize: { gold: 150, fans: 40 }, again: { gold: 80, fans: 20 }, card: 'tour_showstop',
};
K('tour_showstop', 'Showstopper', 'none', 'atk', 2, 'l', 'all', [['d', 8, 2, 'all'], ['b', 8]], { fl: 'The Barnstormers\' closing number. Now it is yours.' });

function wTourRegions() { return Object.keys(DB.regions); }
function wTour() {
  if (!WG) return null;
  if (!WG.tour) WG.tour = { region: pick(wTourRegions().filter(r => r !== 'plains')), prev: null, since: W_TOUR.start, beat: [], played: 0 };
  return WG.tour;
}
function wTourBeaten() { const T = wTour(); return !!T && T.beat.includes(WG.year); }
function wTourOn() { const T = wTour(); return !!T && WG.dayAbs >= T.since && !wTourBeaten(); }
/* move on to another region */
function wTourMove(why) {
  const T = wTour();
  T.prev = T.region; T.region = pick(wTourRegions().filter(r => r !== T.region)); T.since = WG.dayAbs + 1;
  if (why) wLog(why, 'd');
}
const wW32NewDay = wNewDay;
wNewDay = function () {
  wW32NewDay();
  const T = WG && WG.tour; if (!T) return;
  if (WG.dayAbs >= T.since + W_TOUR.stay) wTourMove();
};
/* what people say: where they are, or for a day after a move, where they were */
function wTourRumour() {
  const T = wTour();
  if (wTourBeaten()) return `${W_TOUR.name}? Gone home for the year, after somebody beat them. Was that you?`;
  if (WG.dayAbs < W_TOUR.start) return `${W_TOUR.name} are coming: a show team, the best in the realm. Their tour starts any day.`;
  const fresh = WG.dayAbs < T.since && T.prev;   // on the road between regions
  const where = wRegThe(fresh ? T.prev : T.region);
  return fresh ? `${W_TOUR.name} were playing in ${where}, last anybody heard. Find them out in the open country, off the roads.`
    : `${W_TOUR.name} are touring ${where} this week. Walk the open country there and they will find you. They play for a Hall of Fame card.`;
}

/* ---------- they turn up ---------- */
function wTourMatch(region) {
  const T = wTour(), L = wLevelInfo(false);
  T.played++;
  return startMatch({ type: W_TOUR.type, tier: W_TOUR.tier, lv: Math.min(W_ROAD.maxLv, L.lv + W_TOUR.lvUp), ambush: false, name: W_TOUR.ring,
    world: { kind: 'tour', ref: { year: WG.year }, region: region || T.region } });
}
const wW32EncounterHook = wEncounterHook;
wEncounterHook = function (region, tileCh, info) {
  if (!info && WG && RUN && wCurMap().kind === 'world' && !WG.event && !(WG.grace > 0) && wTourOn() && wCupsWon() >= W_TOUR.cups && region === wTour().region && Math.random() < W_TOUR.p) {
    wLog(`A painted wagon blocks the way, and ${W_TOUR.ring} tips a tall hat: "${W_TOUR.name}! One game, friends. Winner takes the show."`, 'b');
    return wTourMatch(region);
  }
  return wW32EncounterHook(region, tileCh, info);
};
// everyone in their kit, the boss too (w9 leaves a boss in its own)
onHook('fightStart', () => {
  const W = RUN && RUN.pending && RUN.pending.world;
  if (!WG || !B || !W || W.kind !== 'tour') return;
  for (const e of B.enemies) e.team = Object.assign({}, W_TOUR.team);
});
W_ON_END.tour = function (r, ref, W) {
  const T = wTour();
  if (r !== 'win') { wTourMove(`${W_TOUR.name} take a bow, pack the wagon and move on.`); return; }
  const first = !T.beat.length;
  T.beat.push(WG.year);
  const P = first ? W_TOUR.prize : W_TOUR.again;
  RUN.gold += P.gold; RUN.fans = (RUN.fans || 0) + P.fans;
  wLog(`You beat ${W_TOUR.name}! ${P.gold} gold and ${P.fans} fans.${first ? '' : ' They go home for the year.'}`, 'g');
  if (first) { wLog(`${W_TOUR.ring} hands over the show's closing number: Showstopper.`, 'g'); wGainCard(W_TOUR.card, W_TOUR.name); }
  achAdd('realmTour', 1);
};

/* ---------- words ---------- */
const wW32MatchTeam = wMatchTeam;
wMatchTeam = function (W) { return W && W.kind === 'tour' ? W_TOUR.team : wW32MatchTeam(W); };
const wW32PreGame = wPreGame;
wPreGame = function (enc) {
  wW32PreGame(enc);
  const box = document.querySelector('#modalBox .wpgtxt'); if (!box || enc.world.kind !== 'tour') return;
  const first = !wTour().beat.length;
  box.insertAdjacentHTML('afterbegin', `<p class="wtaunt">${esc(W_TOUR.name)}, the touring show team. Win for ${first ? `Showstopper (a Hall of Fame card nobody else has), ${W_TOUR.prize.gold} gold and ${W_TOUR.prize.fans} fans` : `${W_TOUR.again.gold} gold and ${W_TOUR.again.fans} fans`}. Lose, and they move on.</p>`);
};
for (const id of W_TAVERN_INNS) {
  const ch = DB.chars[id]; if (!ch) continue;
  ch.topics.barnstormers = { t: 'A show team, touring the realm. Ask anyone where they were last seen.', act: 'tour' };
  if (ch.topics.notices) ch.topics.notices.t += ' And posters for the BARNSTORMERS.';
}
const wW32RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'tour') { wLog(`${wChar(id).name}: "${wTourRumour()}"`, 'm'); return null; }
  return wW32RunAct(act, id);
};
const wW32OpenBoard = wOpenBoard;
wOpenBoard = function (city, msg) {
  wW32OpenBoard(city, msg);
  const h = document.querySelector('#modalBox header'); if (!h || LAB) return;
  h.insertAdjacentHTML('afterend', `<p class="wtour"><b>Poster:</b> ${esc(wTourRumour())}</p>`);
};

/* ---------- a medal, How to play ---------- */
ACH.push({ id: 'w_tour', n: 'Showstoppers', d: 'Beat the Barnstormers, the touring show team', stat: 'realmTour', at: [1, 2, 3] });
const wW32RenderHelp = renderHelp;
renderHelp = function () {
  wW32RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpTour')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpTour"><b>The Barnstormers.</b> A famous show team tours the realm, ${W_TOUR.stay} days in each region. Track them by rumour: ask any innkeeper about the BARNSTORMERS, or read the posters on the notice boards (rumours can be a day behind). Once you hold a cup, walk the open country of their region and they may turn up: a boss match, two levels up. Beat them for Showstopper, a Hall of Fame card nobody else has, ${W_TOUR.prize.gold} gold and ${W_TOUR.prize.fans} fans; then they go home until next year. Lose, and they move on.</p>`);
};
