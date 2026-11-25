/* u6: the rewards and the after (issue #99, phase 6). Loads after u5-finale.js; changes earlier parts only by
   reassignment (saved originals carry the wWU6 prefix).

   Forge the Seal and:
     the Seal of the Crown   a trophy for the rest of the journey (RELICS.umbseal): every match starts with 6 Block,
                             and your first hand has a card more
     a recruit               the Nadir captain you beat most cleanly (the fewest tries) joins the team, redeemed, at
                             your team's best level (WG.umbral.redeemed)
     a legend mark           your team's portrait in the Hall of Legends says so (the profile's legend entry, sealed:
                             the year), for every later journey to see
     a medal                 on the profile (ACH w_umbral, stat realmUmbral): bronze for the first piece, silver for
                             four, gold for the Seal (pieces won, and one more for the Seal)
     New Game+               the profile remembers (pkey('sd-realm-umbral')): the next journey starts with a rumour
                             that the door is closed, but not locked
   How to play: an Umbral section (#wHelpUmbral) once it is open; before that, one closed line. The Quick start gains a
   tab of every way to play's hexes (wUmbQuick) once it is open.

   W_UMB6, wUmbAch
   Wraps: wUmbSeal (wWU6Seal: the rewards; the recruit is asked once the world is free), W_ON_END.nadir (wWU6OnNadir:
   the medal as pieces come in), wLegendOfJourney (wWU6LegendOfJourney: the mark survives a later Crown), wOpenLegends
   (wWU6OpenLegends: the mark), wStart (wWU6Start: the rumour on a new journey), renderHelp (wWU6RenderHelp), wQuickHTML (wWU6QuickHTML: the hexes tab). */

const W_UMB6 = { block: 6, draw: 1, key: () => pkey('sd-realm-umbral') };
RELICS.umbseal = { n: 'The Seal of the Crown', adv: 1, desc: 'Start each card match with 6 Block, and your first hand there has a card more.', ico: 'gem' };
TROPHY_FX.umbseal = { on: { fightStart: () => { gainBlock(W_UMB6.block, true); } }, mod: { draw: () => (B && B.turn <= 1 ? W_UMB6.draw : 0) } };
Object.assign(RELICS.umbseal, TROPHY_FX.umbseal); // (core/hooks.js copied TROPHY_FX into RELICS at its load, before this part)
ACH.push({ id: 'w_umbral', n: 'The Door Shut', d: 'Win back the pieces of the Seal of the Crown, and forge it', stat: 'realmUmbral', at: [1, 4, 10] });

// the medal's stat: pieces won, and gold for the Seal (it only ever goes up). Gold is the Seal itself: the pieces
// count up to one under gold (a tenth piece, jousting's, issue #117 phase 11, mustn't reach it unsealed), and the Seal
// is gold however many pieces it took (the nine of an Umbral opened before jousting's champion)
function wUmbAch() {
  const U = wUmb(); if (!U || LAB) return;
  const gold = ACH.find(a => a.id === 'w_umbral').at[2], v = U.sealed ? gold : Math.min(U.pieces.length, gold - 1), cur = ACHS.stats.realmUmbral || 0;
  if (v > cur) achAdd('realmUmbral', v - cur);
}
const wWU6OnNadir = W_ON_END.nadir;
W_ON_END.nadir = function () { const r = wWU6OnNadir.apply(this, arguments); wUmbAch(); return r; };

const wWU6Seal = wUmbSeal;
wUmbSeal = function () {
  const r = wWU6Seal.apply(this, arguments), U = wUmb();
  // the trophy
  if (!RUN.relics.includes('umbseal')) gainRelic('umbseal');
  // the recruit: the champion beaten most cleanly
  const won = Object.keys(W_NADIR).filter(k => W_NADIR[k].piece && U.beaten[k]).sort((a, b) => (U.tries[a] || 0) - (U.tries[b] || 0) || U.beaten[a] - U.beaten[b]);
  const C = won.length && W_NADIR[won[0]], ch = C && DB.chars[C.char];
  if (ch && !U.redeemed) {
    U.redeemed = won[0];
    const lvl = Math.max(1, ...wRoster().map(p => p.lvl || 1));
    wLog(`${ch.name.split(',')[0]} walks out of the Hollow Coliseum behind you. "You beat me fairly," they say. "Nobody ever did, over there."`, 'g');
    // (asked once the world is free, after the closing scene: a full roster's question never covers it)
    WG.wprompts = WG.wprompts || []; WG.wprompts.push({ t: 'recruit', p: wMakePlayer({ kind: ch.kind, n: ch.name.split(',')[0], lvl }, 'quest') });
  }
  // the legend mark, on the profile
  if (!LAB) {
    if (WG.legId) { const all = wLegendsAll(), L = all.find(l => l.id === WG.legId); if (L) { L.sealed = WG.year; wLegendsSave(all); } }
    try { localStorage.setItem(W_UMB6.key(), JSON.stringify({ sealed: 1, year: WG.year })); } catch (e) { }
  }
  wUmbAch(); wSave();
  return r;
};
// the mark survives a later Crown, which writes the journey's portrait again
const wWU6LegendOfJourney = wLegendOfJourney;
wLegendOfJourney = function () { const L = wWU6LegendOfJourney.apply(this, arguments), U = wUmb(); if (U && U.sealed) L.sealed = U.sealedYear || WG.year; return L; };
const wWU6OpenLegends = wOpenLegends;
wOpenLegends = function () {
  const r = wWU6OpenLegends.apply(this, arguments), list = wLegends();
  document.querySelectorAll('#modalBox .wbclubs li').forEach((li, i) => { const L = list[i]; if (L && L.sealed) li.querySelector('div small').insertAdjacentHTML('beforeend', `, sealed the Umbral in year ${L.sealed}`); });
  return r;
};
// a new journey on a profile that sealed it once hears the rumour
const wWU6Start = wStart;
wStart = function (save) {
  const r = wWU6Start.apply(this, arguments);
  if (!save && !LAB) { let s = null; try { s = JSON.parse(localStorage.getItem(W_UMB6.key()) || 'null'); } catch (e) { } if (s && s.sealed) wLog('A rumour on the road: the door at the end of the Road to Nowhere is closed again. Closed, they say, but not locked.', 'b'); }
  return r;
};

/* ---------- How to play ---------- */
const wWU6RenderHelp = renderHelp;
renderHelp = function () {
  wWU6RenderHelp.apply(this, arguments);
  const h = $('wHelp'); if (!h || $('wHelpUmbral')) return;
  if (!wUmbOn()) { h.insertAdjacentHTML('beforeend', '<p class="hint" id="wHelpUmbral"><b>After the Crown.</b> There is more to the Realm after you win the Crown. Nobody in the league will say what.</p>'); return; }
  h.insertAdjacentHTML('beforeend', `<div id="wHelpUmbral"><h3>The Umbral Realm</h3>
    <p class="hint"><b>The door.</b> Winning the Crown broke the Seal of the Crown into ${wUmbNum(wUmbNeed().length)} pieces, ${wUmbWays()}, and opened a portal at the end of the Road to Nowhere, north of the Roost. Through it is the Umbral: the same Realm, wrong. Same roads, the towns mirrored and dark, the people their own doubles. Time runs on both sides, and the portal works both ways.</p>
    <p class="hint"><b>Harder everywhere.</b> Every match on the dark side is tier U: tier 3 and more (the other side has a quarter more HP and a point more Strength, and you draw a card fewer), and every player has its kind's dark trait. There are no inns: rest by a lantern, one in each region, and a match that goes badly wakes you by the last one you rested at. The dark shops sell for fans or a player's XP, never gold.</p>
    <p class="hint"><b>The pieces.</b> ${wUmbShort() ? `Ten Nadir champions hold pieces, and your Seal asks for ${wUmbNum(wUmbNeed().length)} of them.` : 'Ten Nadir champions hold them.'} The Gatekeeper, just through the portal, plays the card game. The others wait at the far end of their sport's dark ground, past the cold, two guards (each a card match) and a gate: bring them something from the light side of their region. Their games are at tier U, with one or two hexes (dark twists, named before you start). Some want more than a win: two play only after dark, and two want it won by two or more (a narrower win pays as a win, but they keep the piece). Lose, and the next try costs a toll.</p>
    ${wUmbJtHelp()}
    <p class="hint"><b>The Seal.</b> ${wUmbShort() ? `With all ${wUmbNum(wUmbNeed().length)} (your Umbral opened before the Hollow Lists had its champion, so its Seal asks for the ${wUmbNum(wUmbNeed().length)} it opened with)` : 'With all ten (an Umbral opened before the Hollow Lists had its champion asks only for the nine it opened with)'}, Hollow Aurelia plays you for the Seal in the Hollow Coliseum: three games, in your three weakest ways to play on that side. A piece you won at the first try takes a hex off its game. Lose a game and you try that one again. Win all three and the door shuts.</p>
    <p class="hint"><b>When it shuts.</b> Forge the Seal and you keep it, a trophy: every card match starts with 6 Block and a card more in your first hand. The Nadir captain you beat most cleanly asks to join you. Your team's portrait in the Hall of Legends says you sealed it, for every later journey to see, and your profile's medal (The Door Shut) fills: bronze for the first piece, silver for four, gold for the Seal.</p>
    <p class="hint"><b>On the light side.</b> While the portal stands open, the sun goes out at midday once a week, and more often the longer it stays open. The Pale Herald, by the statue in the Coliseum, will tell you anything twice.</p></div>`);
};

/* ---------- Quick start: the hexes, sport by sport (only once the Umbral is open) ---------- */
const W_UMB6_SPORTS = [['diamond', 'Baseball', 'The Bone Diamond'], ['gridiron', 'Football', 'The Cinder Pit'], ['ring', 'Boxing', 'The Broken Ring'], ['court', 'Basketball', 'The Black Court'],
  ['rink', 'Hockey', 'The Dead Pond'], ['links', 'Golf', 'The Hollow Links'], ['lanes', 'Bowling', 'The Drowned Lanes'], ['shed', 'Curling', 'The Sunken Shed'], ['lists', 'Jousting', 'The Hollow Lists']];
function wUmbQuick() {
  const steps = W_UMB6_SPORTS.map(([e, n, g]) => {
    const E = W_ENGINES[e], h = E && E.api.hexes, t = (typeof h === 'function' ? h() : h) || {};
    return { h: `${n}, at ${g}`, t: Object.keys(t).map(k => `<b>${esc(t[k].n)}</b>: ${esc(t[k].d || t[k].desc || '')}`).join(' ') };   // (boxing's table says desc)
  });
  steps.unshift({ h: 'The card game, everywhere', t: Object.values(W_UMB3.hexes).map(H => `<b>${esc(H.n)}</b>: ${esc(H.d)}`).join(' ') });
  return { id: 'umbral', n: 'The Umbral', where: 'the other side of the portal', more: 'wHelpUmbral',
    lede: 'Every game on this side is tier U, and a Nadir champion\'s game draws one or two hexes, named before it starts and shown on the scoreboard. These are the hexes each way to play can draw.',
    steps, tip: 'A piece won at the first try takes a hex off its game in the Seal\'s final.', keys: [], phone: '',
    foot: 'Everything else about the Umbral is further down: <a href="#" data-wqmore="wHelpUmbral">The Umbral Realm</a>.' };
}
const wWU6QuickHTML = wQuickHTML;
wQuickHTML = function () {
  if (!wUmbOn()) return wWU6QuickHTML.apply(this, arguments);
  W_QUICK.push(wUmbQuick());
  try { return wWU6QuickHTML.apply(this, arguments); } finally { W_QUICK.pop(); }
};
