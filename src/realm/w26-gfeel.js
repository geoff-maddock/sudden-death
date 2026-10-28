/* w26: the feel of the grounds (issue #6, phase 7, polish). Loads after w25-home.js; changes earlier parts only by
   reassignment (saved originals carry the wW26 prefix, Sudden Death's the wSd prefix) and by adding to SD's tables.

   Music. Every ground has its own theme (THEMES.wg_<ground>), in SD's theme format: it plays while you walk the
   ground (calm) and in a match there (fight and hype). Elsewhere, w13's themes as before.
   Tips. Coach's notes for the grounds, the squad rule, your league fixture and the training spots, from a watcher
   like w13's (never in LAB).
   Achievements. Groundhopper (a game at every ground: a set of ground ids, the Ballpark's from a ball game played
   there), Fixture List (league fixtures won) and Top of the Class (coaches' challenges answered right).
   The League shop. Bunty Pennant sells team kit in Graftonbury, in place of a house on the south row: one kit per
   region and an away black, bought once and worn when you like. The kit is your team's colours in a match (clubTeam).
   WG.kit = { own: [kit ids], on: kit id }. 'home' is your club's own colours, always owned.
   Old saves: Graftonbury's saved townsfolk places (WG.npc.graftonbury, kept by index) are dropped once, since the
   shop adds a character; the marker is WG.kit.
   Ambient. Match days at the cities and grounds: posters for tomorrow's league games there, and today's results.

   Wrapped: wMusicHere (wW26MusicHere), wMusicMatch (wW26MusicMatch), W_ON_END.ground (wW26OnGround), wBallSettle
   (wW26BallSettle), wSpotAnswer (wW26SpotAnswer), clubTeam (wSdClubTeam), wRunAct (wW26RunAct), wStart (wW26Start),
   wAmbient (wW26Ambient), renderHelp (wW26RenderHelp: #wHelpGrdFeel and #wHelpKit). */

/* ---------- music: one theme per ground ---------- */
// a melody as text: one character a step, a digit (or a letter, base 36) for a scale degree, '.' to hold
const wMel = (...bars) => bars.join('').split('').map(c => c === '.' ? null : parseInt(c, 36));
const W_GRD_THEMES = {
  g_ballpark: { name: 'Seventh-Inning Organ', bpm: 112, root: 53, scale: 'ionian', prog: [0, 3, 4, 0], lead: 'square', bass: 'triangle', pad: 'square', organ: 1,
    // the ballpark organ: a climb to the top and a walk home
    mel: wMel('0...2...4...7...', '5...4...2.......', '4...5...7...9...', '7...5...4...0...'),
    bassPat: 'x...x...x...x...', drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
  g_court: { name: 'Chain Nets', bpm: 120, root: 45, scale: 'dorian', prog: [0, 3, 0, 4], lead: 'sawtooth', bass: 'sawtooth', pad: 'triangle',
    // a bouncing bass, like a ball on the boards
    mel: wMel('0.0.3...0.0.5...', '4...3...0.......', '7.7.5...3.3.4...', '3...2...0.......'),
    bassPat: 'x..x..x.x..x..x.', drums: { k: 'x...x...x...x...', s: '....x.......x..x', h: '..x...x...x...x.' } },
  g_links: { name: 'The Long Fairway', bpm: 76, root: 52, scale: 'lydian', prog: [0, 4, 3, 0], lead: 'sine', bass: 'triangle', pad: 'sine', bell: 1,
    // quiet, please: a long walk between shots
    mel: wMel('4.......5...4...', '2.......0.......', '2...4...5...7...', '4.......2.......'),
    bassPat: 'x.......x.......', drums: { k: 'x...............', s: '................', h: '....x.......x...' } },
  g_lists: { name: 'Fanfare at the Lists', bpm: 104, root: 48, scale: 'mixo', prog: [0, 6, 3, 4], lead: 'square', bass: 'triangle', pad: 'sawtooth',
    // trumpets for the riders, a snare roll for the charge
    mel: wMel('0...0.4.7.......', '6...4...5.......', '7...7.8.9...8...', '7...6...4...0...'),
    bassPat: 'x...x...x...x...', drums: { k: 'x.......x.......', s: 'x.x.....x.x.....', h: '................' } },
  g_lanes: { name: 'Strike Lamps', bpm: 96, root: 43, scale: 'aeolian', prog: [0, 5, 3, 4], lead: 'triangle', bass: 'sine', pad: 'sine',
    // the roll down the lane, and the clatter at the end
    mel: wMel('0.2.4.......4.2.', '0.......2.......', '4.5.7.......7.5.', '4.....2.0.......'),
    bassPat: 'x.....x.x.......', drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x...x...x...x...' } },
  g_shed: { name: 'The Curling Shed', bpm: 84, root: 50, scale: 'dorian', prog: [0, 3, 6, 0], lead: 'sine', bass: 'triangle', pad: 'sine', bell: 1,
    // brooms on the ice for hats
    mel: wMel('2.......4.......', '3...2...0.......', '5.......7.......', '6...4...2.......'),
    bassPat: 'x...........x...', drums: { k: 'x...............', s: '................', h: 'x.x.x.x.x.x.x.x.' } },
  g_bowl: { name: 'Ash Bowl Terraces', bpm: 128, root: 41, scale: 'phrygian', prog: [0, 1, 0, 4], lead: 'sawtooth', bass: 'sawtooth', pad: 'sawtooth', heavy: 1,
    // a terrace chant over a stamping bass
    mel: wMel('0...0...1...0...', '3...1...0.......', '4...4...5...4...', '3...1...0.......'),
    bassPat: 'x.x.x.x.x.x.x.x.', drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' } },
  g_ring: { name: 'Round One', bpm: 140, root: 38, scale: 'harmonic', prog: [0, 5, 4, 0], lead: 'square', bass: 'sawtooth', pad: 'sawtooth', heavy: 1,
    // the bell, a jab and a jab
    mel: wMel('0.......0...1...', '0.......6...7...', '4...4...3...2...', '1...0...........'),
    bassPat: 'x..x....x..x....', drums: { k: 'x..x....x..x....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
  g_rink: { name: 'Rink Organ', bpm: 108, root: 57, scale: 'lydian', prog: [0, 1, 0, 4], lead: 'square', bass: 'triangle', pad: 'sine', organ: 1,
    // the rink organ runs up and down the scale between whistles
    mel: wMel('0.2.4.6.7.......', '6.4.2...0.......', '7.6.4.2.4.......', '3.2.1...0.......'),
    bassPat: 'x...x...x...x...', drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x...x...x...x...' } },
  g_sheet: { name: 'Hoarfrost Pitch', bpm: 80, root: 55, scale: 'aeolian', prog: [0, 5, 3, 4], lead: 'sine', bass: 'sine', pad: 'sine', bell: 1,
    // a long ball through the cold air (the tune of the old curling sheet)
    mel: wMel('7.......6.......', '4...3...2.......', '4.......5.......', '3...2...0.......'),
    bassPat: 'x...............', drums: { k: 'x.......x.......', s: '................', h: '........x.......' } },
};
for (const id in W_GRD_THEMES) THEMES['wg_' + id] = W_GRD_THEMES[id];
function wGrdTheme(id) { return W_GRD_THEMES[id] ? 'wg_' + id : null; }

const wW26MusicHere = wMusicHere;
wMusicHere = function () {
  const m = wCurMap();
  return (m && m.grd && wGrdTheme(m.grd)) || wW26MusicHere();
};
const wW26MusicMatch = wMusicMatch;
wMusicMatch = function (W) {
  if (W && W.kind === 'ground' && !(B && B.type === 'boss')) { const t = wGrdTheme(W.ref && W.ref.g); if (t) return t; }
  return wW26MusicMatch(W);
};

/* ---------- tips ---------- */
Object.assign(TIPS, {
  w_grounds: ['A sports ground', 'Every city has two grounds outside the gate, one for each sport its region plays. Talk to the groundskeeper: ask about a GAME, the FIXTURES, or a HOME ground.'],
  w_squad: ['Too few players', 'A ground wants a full squad before it will put on a game, and the number depends on the sport. Recruit at taverns and after matches; the groundskeeper says how many more you need.'],
  w_fixture: ['Your league fixture', 'Your league game this round is at this ground. Play it any day up to the round day through the groundskeeper\'s GAME card: it counts on the table, and a win brings fans.'],
  w_spot: ['A training spot', 'This city has two training spots, each with a coach. Once a week, DRILL a card that suits the sport for a free Practice star, and take the coach\'s CHALLENGE for gold and fans.'],
});
function wGrdTips() {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world') return;
  const m = wCurMap(); if (!m) return;
  if (m.grd) {
    tip('w_grounds');
    const g = wGrd(m.grd);
    if (g && g.sport !== 'baseball' && wRoster().length < wGrdNeed(g.id)) tip('w_squad');
    const f = wLeague().next && wMyFixture();
    if (f && f.g === m.grd && !f.done) tip('w_fixture');
  } else if (m.kind === 'town' && W_SPOTS.some(s => s.city === m.id)) tip('w_spot');
}
setInterval(wGrdTips, 700);

/* ---------- achievements ---------- */
ACH.push(
  { id: 'w_grounds', n: 'Groundhopper', d: 'Play a game at every sports ground', stat: 'realmGrounds', set: 1, at: [3, 6, 10] },
  { id: 'w_fixtures', n: 'Fixture List', d: 'Win league fixtures at the grounds', stat: 'realmFixWins', at: [1, 5, 15] },
  { id: 'w_coach', n: 'Top of the Class', d: 'Answer a coach\'s challenge right', stat: 'realmSpotWins', at: [1, 5, 10] },
);
const wW26OnGround = W_ON_END.ground;
W_ON_END.ground = function (r, ref, W) {
  wW26OnGround(r, ref, W);
  if (LAB || !ref || !wGrd(ref.g)) return;
  achSet('realmGrounds', ref.g);
  if (r === 'win' && ref.mode === 'fixture') achAdd('realmFixWins', 1);
};
// a ball game played at the Ballpark counts for it
const wW26BallSettle = wBallSettle;
wBallSettle = function (r, us, them, box, inning) {
  const out = wW26BallSettle(r, us, them, box, inning);
  if (!LAB && WG && WG.map === 'g_ballpark') achSet('realmGrounds', 'g_ballpark');
  return out;
};
const wW26SpotAnswer = wSpotAnswer;
wSpotAnswer = function (id, sport) {
  const r = wW26SpotAnswer(id, sport);
  if (r.ok && !LAB) achAdd('realmSpotWins', 1);
  return r;
};

/* ---------- the League shop: team kit ---------- */
const W_KIT = { price: 40 };
const W_KITS = {
  home: { name: 'Home kit', d: 'Your club\'s own colours.' },
  charter: { name: 'Charter gold', col: '#d9a63a', d: 'The League\'s own gold, as worn on the Charter Plains.' },
  moss: { name: 'Mosswold green', col: '#4f9a3a', d: 'Leaf green, with bark trim.' },
  brine: { name: 'Brinefen teal', col: '#2f8a9a', d: 'Sea teal. Does not show the salt.' },
  cinder: { name: 'Cindermaw red', col: '#c4462a', d: 'Furnace red, and fireproof, mostly.' },
  rime: { name: 'Frostspire white', col: '#b8d8ee', d: 'Ice white and pale blue.' },
  away: { name: 'Away black', col: '#3a3a42', d: 'Black, for nights on the road.' },
};
function wKit() { return (WG.kit = WG.kit || { own: ['home'], on: 'home' }); }
function wKitTeam(id) {
  const K = W_KITS[id]; if (!K || !K.col) return null;
  return { color: K.col, light: tint(K.col, .55), dark: tint(K.col, -.6) };
}
/* buy (or wear, if you own it): '' when it worked, or why not */
function wBuyKit(id) {
  const K = W_KITS[id], S = wKit(); if (!K) return 'There is no kit like that.';
  if (!S.own.includes(id)) {
    if (RUN.gold < W_KIT.price) return 'You cannot afford that.';
    RUN.gold -= W_KIT.price; S.own.push(id);
    wLog(`Bought the ${K.name} kit.`, 'm');
  }
  S.on = id; wSave();
  return '';
}
const wSdClubTeam = clubTeam;
clubTeam = function () {
  const t = wSdClubTeam();
  const k = typeof WG !== 'undefined' && WG && WG.kit && wKitTeam(WG.kit.on);
  return k ? Object.assign({}, t, k) : t;
};
function wOpenKit(msg) {
  const S = wKit(), ch = DB.chars.lg_shop, home = CLUBS[(RUN && RUN.club) || WG.club] || {};
  const row = id => {
    const K = W_KITS[id], own = S.own.includes(id), on = S.on === id, col = K.col || home.color;
    return `<li class="wbcl"><span class="wbsw" style="background:${col}"></span><div><b>${esc(K.name)}</b><small>${esc(K.d)}${on ? ' You are wearing it.' : ''}</small></div>
      <div class="row">${on ? '<button class="ghost" disabled>Wearing</button>' : `<button class="ghost" data-wkit="${id}" ${!own && RUN.gold < W_KIT.price ? 'disabled' : ''}>${own ? 'Wear it' : `Buy (${W_KIT.price} gold)`}</button>`}</div></li>`;
  };
  const close = modal(`<header><div class="row"><img class="wmport" src="${portraitURL(ch.kind, wNpcTeam(ch.kind), '', 96)}" alt=""><h3>The League shop</h3></div><button class="ghost" data-close>Done</button></header>
    ${msg ? `<p class="wbad">${esc(msg)}</p>` : ''}<p>Team kit, ${W_KIT.price} gold a set. You have <b class="wgold">${RUN.gold} gold</b>. A kit you have bought is yours to wear again, free.</p>
    <p class="hint">Your team plays in the kit you wear: it is your colours on the field in every match.</p>
    <ul class="wbclubs">${Object.keys(W_KITS).map(row).join('')}</ul>`);
  $('modalBox').querySelectorAll('[data-wkit]').forEach(b => b.onclick = () => { const r = wBuyKit(b.dataset.wkit); close(); wDrain(); wOpenKit(r); });
}
DB.chars.lg_shop = { name: 'Bunty Pennant', kind: 'goblin', look: { coat: '#d9a63a', acc: 'scarf', hair: '#5e4026' },
  greet: 'The League shop! Scarves, flags, and team KIT in every colour the League allows.',
  topics: {
    job: { t: 'I sell team KIT, a set for every region and an away black. Your team plays in whatever you buy.' },
    kit: { t: 'Here is the rail.', act: 'kit' },
    buy: { t: 'Have a look at the KIT.', act: 'kit' },
  } };
{ // the shop takes the house at the east end of the south row
  const Bs = W_CITIES.graftonbury.buildings, i = Bs.findIndex(b => b.x === 32 && b.y === 21);
  Bs[i] = { x: 32, y: 21, w: 5, h: 6, door: 's', npc: 'lg_shop', sign: 'LEAGUE SHOP. Team kit.', furn: [['K', 1, 1, { text: 'Scarves in every club\'s colours. The Apex Athletic ones are on the bottom shelf, with a discount sticker.' }]] };
}
const wW26RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'kit') return LAB ? null : void wOpenKit();
  return wW26RunAct(act, id);
};
const wW26Start = wStart;
wStart = function (save, opts) {
  if (save && save.WG && !save.WG.kit && save.WG.npc) delete save.WG.npc.graftonbury;
  const r = wW26Start(save, opts);
  if (WG) wKit();
  return r;
};

/* ---------- match days in the cities ---------- */
function wGrdCityOf(m) { return m.grd ? (wGrd(m.grd) || {}).city : m.id; }
function wMatchDayLine(city) {
  const L = wLeague(), here = g => { const G = wGrd(g); return G && G.city === city; };
  const out = [];
  for (const r of L.results || []) if (r.day === WG.dayAbs && r.g && here(r.g) && r.a !== 'me' && r.b !== 'me') out.push(`Word from ${wGrd(r.g).name}: ${wTheClub(r.a)} beat ${wTheClub(r.b)} today.`);
  const F = L.next;
  if (F && F.day === WG.dayAbs + 1) for (const f of F.games) if (here(f.g) && f.a !== 'me' && f.b !== 'me') out.push(`A poster on a wall: ${wClubName(f.a)} against ${wClubName(f.b)}, at ${wGrd(f.g).name}, tomorrow.`);
  return out.length ? pick(out) : '';
}
const wW26Ambient = wAmbient;
wAmbient = function (m, preReg) {
  wW26Ambient(m, preReg);
  if (m.kind !== 'town' || WG.step % 13 !== 0 || Math.random() >= .5) return;
  const line = wMatchDayLine(wGrdCityOf(m));
  if (line) wLog(line, 'd');
};

/* ---------- How to play ---------- */
const wW26RenderHelp = renderHelp;
renderHelp = function () {
  wW26RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpGrdFeel')) return;
  const after = $('wHelpFixtures') || $('wHelpGrdPlay') || $('wHelpGrounds');
  const html = `<p class="hint" id="wHelpGrdFeel"><b>At the grounds</b> every ground plays its own music, on the field and in a match. The day before a league round, posters in the city say who plays at its grounds, and the town talks about the results on the day. Medals: Groundhopper (a game at every ground, the Ballpark's a ball game), Fixture List (league fixtures won) and Top of the Class (coaches' challenges).</p>
    <p class="hint" id="wHelpKit"><b>Team kit.</b> The League shop in Graftonbury sells a kit for every region and an away black, ${W_KIT.price} gold a set. Your team plays every match in the kit you wear; a kit you own is free to wear again. Ask Bunty Pennant about KIT.</p>`;
  if (after) after.insertAdjacentHTML('afterend', html); else h.insertAdjacentHTML('beforeend', html);
};
