/* u4g: bowling in the Umbral (issue #99, phase 4g). Loads after u4-grounds.js; changes earlier parts only by
   reassignment (saved originals carry the wWU4G prefix). The engine's side is src/bl/parts/16-umbral.js: the Lich (CPU
   skill 3), the hexes (opts.hexes) and a bowler's own ultimate.

   Tier U at the lanes is tier 4 in bowling's tables: W_LNG.oppBonus[4] rating points on each of their five (an umbral
   form changes only their ratings, never yours), the Lich bowling for them (W_BALL.diff[4] = 3, the skill every engine
   reads by tier, named in W_BALL_SKILL: it weighs every stand, aim and speed through the ball model and the pins, and
   a split by what it is worth), and a full potion bag (W_LANES_KIT.opp[4]). Tiers 1 to 3 are as they were.
   The champion of the Drowned Lanes (u:g_lanes, the Tidelands): Ossery Brine, the Drowned Pinsetter, keeps the Drowned
   Pin. Past the two guards and the gate (u4), PLAY opens the game card (wUmbBlCard): tier U, the Nadir five
   (W_UMB4G.five, at your team's level, the champion with an ultimate of their own, The Drowning Bell), the hexes for
   this try, and Play, Manage or Simulate. The game is the Realm's own bowling match (wStartLanes: save and leave,
   resume after a reload, Concede, the sheet) against club 'nadir:lanes' at tier 4 with kind 'unadirbl': its end goes
   to wUmbNadirEnd (a bowling game never ends level: the roll-off; a game that never finished, or a concession, is a
   loss). Your five bowl as a Knight in Manage and Simulate, against the Lich, with the same hexes, so Simulate is no
   way round them. The toll, on a retry, is paid at the first ball's setup (wUmbTollAtKickoff); backing away from the
   card costs nothing.
   The finale (u5) plays a bowling round through the same adapter, id 'finale': the same five as Nadir Athletic (club
   'nadir:lanes:finale'), no toll, no piece, its own count of hexes; its end goes to W_ON_END.nadir as the finale's.
   Hexes: bowling's own (wBL.hexes, the engine's table), W_NADIR.lanes.hexes of them (the finale's round its own
   count), drawn for each try by wUmbBlHexes (fixed for the try: a reload doesn't redraw them), named on the card, in
   the log, before the first frame, on the scoreboard all game and on the bar. In LAB mode PLAY skips the card and plays
   W_UMB4G.labHow (Simulate) at once. A bowling match left half-played (W_UMB4.live.lanes) is picked up by PLAY where it
   was, with no card and no toll.

   W_UMB4G, wUmbBlClub, wUmbBlFive, wUmbBlHexes, wUmbBlCard, wUmbBlKick; W_NADIR.lanes, DB.chars.nadir_lanes,
   W_UMB4.start.lanes, W_UMB4.live.lanes, W_ON_END.unadirbl
   Wraps: wBallRegion (wWU4GBallRegion), wBallTeam (wWU4GBallTeam), wLanesOpp (wWU4GLanesOpp): the Nadir's clubs are the
   Tidelands' and the Nadir five; wBL.start and wBL.simGame (wWU4GStart, wWU4GSimGame: the hexes go in); wLanesBarNote
   (wWU4GLanesBarNote: the hexes on the bar); and wLanesResultCard (wWU4GLanesResultCard: no card over the end screen
   when a Hardcore journey has just ended, RUN.over). */

const W_UMB4G = {
  id: 'lanes', club: 'nadir:lanes', finaleClub: 'nadir:lanes:finale', kind: 'unadirbl', tier: 4, labHow: 'sim',
  team: { name: 'Drowned Lanes Nadir', short: 'NDR', color: '#1e3a44', light: '#9fe8e0' },
  finaleTeam: { name: 'Nadir Athletic', short: 'NDR', color: '#2a1e34', light: '#e4defa' },
  // their level against your team's (0: level for level), the five (the order is set by their ratings), and the
  // champion's more points and own ultimate
  gap: 0,
  five: [{ n: 'Ossery Brine', kind: 'zombie', champ: true }, { n: 'Hagwrack', kind: 'witch' }, { n: 'Pale Tallow', kind: 'wraith' }, { n: 'Saltbones', kind: 'skeleton' }, { n: 'Marrowlamp', kind: 'lich' }],
  champ: { more: 0, ult: 'drownbell' },
};
// tier U in bowling's tables (W_BALL.diff and W_BALL_SKILL are shared with the other engines' tier U: set once)
W_LNG.oppBonus[4] = 1;
W_LANES_KIT.opp[4] = { draught: 2, blsteady: 2, blchalk: 2, bloil: 1 };
if (W_BALL.diff[4] == null) W_BALL.diff[4] = 3;
if (!W_BALL_SKILL[3]) W_BALL_SKILL[3] = 'Lich';

W_NADIR.lanes = { piece: 'bowling', char: 'nadir_lanes', ground: 'g_lanes', map: 'u:g_lanes', region: 'tide', engine: 'lanes', hexes: 1, toll: 20, gold: 100 };
DB.chars.nadir_lanes = { name: 'Ossery Brine, the Drowned Pinsetter', kind: 'zombie', look: { coat: '#1e3a44', acc: 'hat' },
  greet: 'The sea came in under these lanes a long time ago, and we kept bowling. I set the pins down here, and I keep the PIN. Say PLAY when you want to bowl for it. Ask about the RULES first; the water changes them.',
  topics: {
    job: { t: 'I set the pins on the Drowned Lanes. I set them when the lamps were lit and the floor was dry, and I set them now. Every one of them comes up wet.' },
    pin: { t: 'The Drowned Pin. One piece of your Seal, and it has never once gone down clean. Beat my five at bowling and it is yours. Lose, and the next game costs a TOLL.' },
    rules: { t: 'One team game, ten frames, the Baker format, your five against mine. My side bowls at your level and better at everything, a Lich reads the oil for us and weighs every ball before it leaves the hand, and we bring a full bag. Nobody goes home level: a roll-off. Before the first frame I draw the HEXES.' },
    hexes: { t: 'The water has its moods. Oil that turns to ichor under your ball, a pin too heavy to fall, gutters that pull, a black tide under your lane. You will hear which before the first frame.' },
    bell: { t: 'Once a game I ring the bell under the floor. The oil goes heavy for your five, and your ball carries less. Mind it.' },
    toll: { t: 'Twenty gold a game, after the first. Paid at the first ball. Walking away from the card costs nothing.' },
    play: { t: 'Then bring your five.', act: 'unadir:lanes' },
  } };

/* ---------- the Nadir five ---------- */
// which of the Nadir's clubs this is: 'champ', 'finale', or ''
const wUmbBlClub = club => club === W_UMB4G.club ? 'champ' : club === W_UMB4G.finaleClub ? 'finale' : '';
// their five, as the lanes take a team: your team's level plus W_UMB4G.gap, tier U's points on each (spread as
// wLanesOpp spreads a tier's), the champion with W_UMB4G.champ.more points more and their own ultimate
function wUmbBlFive(lvl, finale) {
  const L = lvl != null ? lvl : Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + W_UMB4G.gap)), k = W_LNG.oppBonus[W_UMB4G.tier] || 0, X = W_UMB4G.champ;
  const roster = W_UMB4G.five.map((f, j) => {
    const p = wLanesPlayer(wMakePlayer({ kind: f.kind, lvl: L, n: f.n }, 'opp')), n = k + (f.champ ? X.more : 0);
    p.n = f.n;
    for (let i = 0; i < n; i++) { const s = wBL.stats[(i * 5 + j) % wBL.stats.length]; p.r[s] = Math.min(wBL.cap, p.r[s] + 1); }
    if (f.champ) p.ult = X.ult;
    return p;
  });
  const T = finale ? W_UMB4G.finaleTeam : W_UMB4G.team;
  return { name: T.name, short: T.short, color: T.color, roster };
}
const wWU4GBallRegion = wBallRegion;
wBallRegion = function (club) { return wUmbBlClub(club) ? W_NADIR.lanes.region : wWU4GBallRegion.apply(this, arguments); };
const wWU4GBallTeam = wBallTeam;
wBallTeam = function (club) {
  const f = wUmbBlClub(club); if (!f) return wWU4GBallTeam.apply(this, arguments);
  const T = f === 'finale' ? W_UMB4G.finaleTeam : W_UMB4G.team;
  return { name: T.name, short: T.short, color: T.color, dark: tint(T.color, -.6), light: T.light, motto: '' };
};
const wWU4GLanesOpp = wLanesOpp;
wLanesOpp = function (club, tier) { const f = wUmbBlClub(club); return f ? wUmbBlFive(null, f === 'finale') : wWU4GLanesOpp.apply(this, arguments); };

/* ---------- the hexes ---------- */
const WU4G = { next: null };
const wWU4GStart = wBL.start, wWU4GSimGame = wBL.simGame;
wBL.start = o => wWU4GStart(WU4G.next ? Object.assign({}, o, { hexes: wUmbTakeHex(WU4G), hexOn: 0 }) : o);
wBL.simGame = o => wWU4GSimGame(WU4G.next ? Object.assign({}, o, { hexes: wUmbTakeHex(WU4G), hexOn: 0 }) : o);
// n of bowling's hexes for this try of the champion (or this round of the finale): fixed for the try (the same draw
// after a reload)
function wUmbBlHexes(id, n) {
  const U = wUmb(), ks = Object.keys(wBL.hexes);
  const r = mulberry(wUmbHash('bl:' + id) + 977 * ((U && U.tries[id]) || 0) + ((WG && WG.year) || 1) + (id === 'finale' && U ? 1013 * (U.finale || 0) : 0));
  const out = []; while (out.length < Math.min(Math.max(0, n), ks.length)) { const k = ks[Math.floor(r() * ks.length)]; if (!out.includes(k)) out.push(k); }
  return out;
}
const wUmbBlHexWords = hx => hx.map(h => wBL.hexes[h]).filter(Boolean);

/* ---------- PLAY: the card, then the first frame ---------- */
function wUmbBlCard(C, id, hx) {
  const ch = DB.chars[C.char], U = wUmb(), tries = (U && U.tries[id]) || 0, lvl = Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + W_UMB4G.gap));
  const fin = id === 'finale' || !C.piece, T = fin ? W_UMB4G.finaleTeam : W_UMB4G.team, uo = wBL.ultOwn[W_UMB4G.champ.ult], champ = W_UMB4G.five.find(f => f.champ).n, H = wUmbBlHexWords(hx);
  // (a round of the Seal holds no piece and costs no toll)
  const toll = !C.toll ? '' : tries > 0 ? ` This game costs the toll, ${C.toll} gold, at the first ball.` : ` The first game is free; after a loss, each costs a toll of ${C.toll} gold.`;
  const prize = fin ? `Win, and ${esc(W_UMB_PIECES[null].n)} is yours.` : `Win, and ${esc(W_UMB_PIECES[C.piece].n)} is yours, with ${C.gold} gold.${toll}`;
  const close = modal(`<header><h3>${esc(ch.name)}</h3></header><div class="wmsg">
    <p><b>${fin ? 'The Seal: bowling' : 'The Drowned Lanes'}: tier U.</b> Bowling against ${esc(T.name)}: level ${lvl}, in umbral form (${W_LNG.oppBonus[W_UMB4G.tier]} rating point${W_LNG.oppBonus[W_UMB4G.tier] === 1 ? '' : 's'} on each of their five), bowling as a ${esc(W_BALL_SKILL[wLanesSkillOf(W_UMB4G.tier)[1]])}, who reads the oil as it is and weighs every ball before it leaves the hand, with a full potion bag. ${esc(champ)} bowls for them, and once a game rings ${esc(uo.n)}: ${esc(uo.desc)}</p>
    <p class="hint wumbpg"><b>Hexes:</b> ${H.length ? H.map(h => `${esc(h.n)} (${esc(h.d)})`).join(' ') : 'none'}</p>
    <p class="hint">${prize} Nobody goes home level: a roll-off. <b>Play</b>: you bowl every ball. <b>Manage</b>: you call the line, the tempo and the ball; your five bowl. <b>Simulate</b>: the result now.</p></div>
    <div class="row"><button class="btn" data-ubl="play">Play</button><button class="ghost" data-ubl="manage">Manage</button><button class="ghost" data-ubl="sim">Simulate</button><button class="ghost" id="wUblNo">Not now</button></div>`, () => wDrain());
  $('modalBox').querySelectorAll('[data-ubl]').forEach(b => b.onclick = () => { close(); const why = wUmbBlKick(C, id, hx, b.dataset.ubl); if (why) wLog(why, 'b'); });
  $('wUblNo').onclick = () => close();
  const f = $('modalBox').querySelector('[data-ubl="play"]'); if (f) f.focus();
}
// why your team can't bowl the champion now, or ''
function wUmbBlWhy() { const probs = wLanesProblems(); if (probs.length) return probs.join(' '); return wLanesLive() ? 'Finish the bowling match you started first.' : ''; }
// the first frame: the toll (on a retry), the hexes in the log, and the Realm's bowling match at tier U ('' when it
// started)
function wUmbBlKick(C, id, hx, how) {
  const why = wUmbBlWhy(); if (why) return why;
  wUmbTollAtKickoff(id);
  const H = wUmbBlHexWords(hx);
  if (H.length) wLog(`${DB.chars[C.char].name.split(',')[0]} draws the hexes: ${H.map(h => `${h.n} (${h.d})`).join(' ')}`, 'b');
  WU4G.next = hx.slice();
  try { return wStartLanes({ club: id === 'finale' ? W_UMB4G.finaleClub : W_UMB4G.club, how, tier: W_UMB4G.tier, kind: W_UMB4G.kind, ref: { id }, cup: true }); } finally { WU4G.next = null; }
}
// (a bowling match left half-played: u4 skips the toll's gold check, and PLAY picks it up)
W_UMB4.live.lanes = () => wLanesLive();
W_UMB4.start.lanes = function (C, id) {
  // (a match left half-played picks up where it was, here as anywhere, and nothing else opens)
  if (wLanesLive()) { wResumeLanes(); return ''; }
  const why = wUmbBlWhy(); if (why) return why;
  const hx = wUmbBlHexes(id, C.hexes || 1);
  if (LAB) return wUmbBlKick(C, id, hx, W_UMB4G.labHow);
  wUmbBlCard(C, id, hx);
  return '';
};
// the end: the piece (or the finale's round), or a try counted (the finale's entry is rebuilt by u5 after a reload, so
// no check on W_NADIR here)
W_ON_END[W_UMB4G.kind] = function (r, ref) { if (ref && ref.id) wUmbNadirEnd(ref.id, r === 'win' ? 'win' : 'lose'); };

/* ---------- on screen ---------- */
// the bar: the hexes, while a Nadir match is on
const wWU4GLanesBarNote = wLanesBarNote;
wLanesBarNote = function () {
  const r = wWU4GLanesBarNote.apply(this, arguments), L = WG && WG.lng && WG.lng.live, hx = L && L.world.kind === W_UMB4G.kind && wBL.hex();
  if (hx && WBL && !WBL.over && $('wLanesNote')) $('wLanesNote').textContent += ` The Umbral, tier U. Hexes: ${hx.ids.map(h => wBL.hexes[h].n).join(', ')}.`;
  return r;
};
// after a Hardcore journey ends on the finale's lost round, the bowling result card stays off the end screen
const wWU4GLanesResultCard = wLanesResultCard;
wLanesResultCard = function () { if ((RUN && RUN.over) || UI.screen === 'end') return; return wWU4GLanesResultCard.apply(this, arguments); };
// (the Lich is the Umbral's only: the light-side "Their bowlers" picker keeps its three)
{ const o = document.querySelector('#wLanesSkill option[value="3"]'); if (o) o.remove(); }
