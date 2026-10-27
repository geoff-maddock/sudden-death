/* w12: renown and trophies (phase 7, balance). Loads after w11-cups.js; changes earlier parts only by reassignment
   (saved originals carry the wW12 prefix) and one fightStart hook.

   What the realm bot found (test/realm_lab.py, 100 runs a side; see docs/realm/BALANCE.md):
   - Every elite and rival win paid a trophy, as in Sudden Death, where a run meets a handful of elites. A realm journey
     plays about 25 of them, so a team held 8 trophies by the second dungeon and 23 by the Crown, and after the first
     cup nothing lost (100% from the second cup on, bosses cost under 20% of max HP). Trophies now come from bosses,
     strongboxes and lairs, not from ordinary elite and rival wins.
   - Enemies only grew by tier (1 to 3) and a small level, while the team kept growing (levels, max HP, gear). Renown
     closes that gap: every cup won and every boss beaten makes the next teams stronger, and the pre-game card says so.

   W_RENOWN    the numbers, for tuning
   wRenown()   cups won + alphas beaten (dungeon bosses and lairs)
   Wrapped: combatRewards (no trophy for a realm elite or rival win), wPreGame (the renown line), renderHelp. */

const W_RENOWN = {
  hpPer: .15,          // foes' HP: +15% for each point of renown
  strEvery: 2,         // and +1 Strength for every two points
};
function wRenown() {
  if (!WG) return 0;
  return wCupsWon() + Object.keys(WG.flags || {}).filter(f => /^alpha_/.test(f) && WG.flags[f]).length;
}
function wRenownText(n) {
  const s = Math.floor(n / W_RENOWN.strEvery);
  return `foes have +${Math.round(W_RENOWN.hpPer * n * 100)}% HP${s ? ` and ${s} Strength` : ''}`;
}

/* at kickoff: renown makes every realm team stronger (after the level, which w9-road.js applies first) */
onHook('fightStart', () => {
  if (!WG || !RUN || !B || !RUN.pending || !RUN.pending.world) return;
  const n = wRenown(); if (!n) return;
  const m = 1 + W_RENOWN.hpPer * n, s = Math.floor(n / W_RENOWN.strEvery);
  for (const e of alive()) { e.max = e.hp = Math.round(e.hp * m); if (s) addSt(e, 'str', s); }
  B.wRenown = n;
  log(`Renown ${n} (cups won and bosses beaten): ${wRenownText(n)}.`, 'bad');
});

/* trophies: Sudden Death pays one for every elite or rival win; in the realm only bosses, strongboxes and lairs do */
const wW12CombatRewards = combatRewards;
combatRewards = function () {
  const out = wW12CombatRewards();
  if (WG && B && B.type !== 'boss') out.relic = null;
  return out;
};

/* the pre-game card says what renown does to this match */
const wW12PreGame = wPreGame;
wPreGame = function (enc) {
  wW12PreGame(enc);
  const n = wRenown(), box = document.querySelector('#modalBox .wpgtxt'); if (!n || !box) return;
  box.insertAdjacentHTML('beforeend', `<p class="hint wrenown">Your renown is ${n} (cups won and bosses beaten): ${esc(wRenownText(n))}.</p>`);
};

const wW12RenderHelp = renderHelp;
renderHelp = function () {
  wW12RenderHelp();
  const sec = $('wHelp'); if (!sec || $('wHelpRenown')) return;
  sec.insertAdjacentHTML('beforeend', `<div id="wHelpRenown"><h4>Renown and trophies</h4>
    <p class="hint"><b>Renown.</b> Every cup you win and every boss you beat adds 1 renown, and the realm takes you more seriously: each point gives the teams you meet ${Math.round(W_RENOWN.hpPer * 100)}% more HP, and every ${W_RENOWN.strEvery} points 1 Strength. The pre-game card shows it.</p>
    <p class="hint"><b>Trophies.</b> In the realm, trophies come from bosses, strongboxes and lairs. An ordinary elite or rival win pays gold and cards.</p></div>`);
};
