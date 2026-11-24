/* u4e: hockey in the Umbral (issue #99, phase 4e). Loads after u4-grounds.js; changes earlier parts only by
   reassignment (saved originals carry the wWU4E prefix).

   Tier U on the ice is tier 4 in the hockey tables: W_HKG.oppBonus[4] rating points on each of their six (an umbral
   form changes only their ratings and start values, never yours), the Lich coaching them (W_BALL.diff[4] = 3, read by
   wRinkSkill; the engine's own decisions: src/hk/parts/16-umbral.js) and a full potion bag (W_RINK_KIT.opp[4]). Tiers
   1 to 3 are as they were. Your side keeps the coach it always has in Simulate (a Knight), so Simulate is no way round
   the Lich: it is your own skating and calling, in Play and Manage, that beats it.
   The champion of the Dead Pond (u:g_rink, the Deadspire): Hollis Grael, the Drowned Captain, holds the Dead Puck. Past
   the two guards and the gate (u4), PLAY opens the game card (wUmbHkCard): tier U, the Nadir six (W_UMB4E.six: Grael
   at centre with his own ultimate, The Long Night), the hexes for this try, and Play, Manage or Simulate. The game is
   the Realm's own hockey game (wStartRink: Save and leave, Resume after a reload, Concede, the box scores) against club
   'nadir:rink' at tier 4, with kind 'unadirhk'; its end goes to wUmbNadirEnd. A hockey game never ends level. The
   toll, when this is a retry, is paid as the game starts (wUmbTollAtKickoff), never for backing away from the card.
   Hexes: hockey's own (wHK.hexes, the engine's table: The Ice Opens, The Wandering Net, Grave Cold, The Hollow
   Whistle), C.hexes of them, drawn for each try by wUmbHkHexes (fixed for the try: a reload doesn't redraw them),
   named on the card, in the log, over the opening face-off and under the score bar, and kept in the game's snapshot.
   The finale (u5) plays a hockey round through the same adapter, with id 'finale' (W_NADIR.finale: no piece, no toll).
   PLAY with a hockey game left half-played (any, saved at a whistle) resumes it instead (W_UMB4.live.rink).
   In LAB mode PLAY skips the card and Simulates at once, for the realm bot.

   W_UMB4E, wUmbHkTeam, wUmbHkHexes, wUmbHkCard, wUmbHkKick
   Wraps: wBallTeam (wWU4EBallTeam: the Nadir six's colours), wRinkOpp (wWU4ERinkOpp: club 'nadir:rink' is the Nadir
   six), wRinkBarNote (wWU4ERinkBarNote: tier U and the hexes in the line under the bar), wRinkResultCard
   (wWU4ERinkResultCard: not over the end of a Hardcore journey), and wHK.start and wHK.simGame (wWU4EStart,
   wWU4ESimGame: the hexes go in). */

const W_UMB4E = {
  id: 'rink', club: 'nadir:rink', kind: 'unadirhk', labHow: 'sim',
  team: { name: 'Dead Pond Nadir', short: 'NDR', color: '#2c2a44', light: '#c8b8ff' },
  // their level against your team's (0: level for level), and the six, then the bench; the captain at centre
  gap: 0,
  six: [
    { n: 'Hollis Grael', kind: 'wraith', num: 9, ult: 'longnight', cap: true }, { n: 'Stillwater', kind: 'gorgon', num: 1 }, { n: 'Knell', kind: 'skeleton', num: 13 },
    { n: 'Rime-Eye', kind: 'vampire', num: 21 }, { n: 'Sallow', kind: 'zombie', num: 44 }, { n: 'Hollow Tam', kind: 'witch', num: 6 },
    { n: 'Drowned Jack', kind: 'werewolf', num: 31 }, { n: 'Pale Wick', kind: 'lich', num: 17 },
  ],
  next: null, // the hexes, while the champion's game is being started
};
// tier U in the hockey tables (W_BALL.diff and W_BALL_SKILL are shared with baseball's tier U: set once)
W_HKG.oppBonus[4] = 6;
W_RINK_KIT.opp[4] = { draught: 3, hkanti: 2, hkcider: 2, hkliniment: 1 };
if (W_BALL.diff[4] == null) W_BALL.diff[4] = 3;
if (!W_BALL_SKILL[3]) W_BALL_SKILL[3] = 'Lich';

W_NADIR.rink = { piece: 'hockey', char: 'nadir_rink', ground: 'g_rink', map: 'u:g_rink', region: 'rime', engine: 'rink', hexes: 1, toll: 20, gold: 100 };
DB.chars.nadir_rink = { name: 'Hollis Grael, the Drowned Captain', kind: 'wraith', look: { coat: '#2c2a44', acc: 'scarf', hair: '#d8e4f0' },
  greet: 'You crossed the cold for a game. I captain the Nadir on this pond, and I hold the PUCK. Say PLAY when you want to try to take it off me. Ask about the RULES first. The ice here has opinions.',
  topics: {
    job: { t: 'I went through the ice on this pond one winter, and I came up captain. I have not lost a game on it since.' },
    puck: { t: 'The Dead Puck. One ninth of your Seal, frozen through. Beat my six at hockey and it is yours. Lose, and the next game costs a TOLL.' },
    rules: { t: 'Real hockey, five skaters and a goalie, three periods, our pond. My six skate harder than anything you have met, a Lich calls our lines, and our bench carries a full bag. I keep a NIGHT of my own for when it matters. Before the puck drops I draw the HEXES.' },
    hexes: { t: 'The pond has moods. It opens under the puck and gives it back at centre ice. The net wanders off its line. The cold gets into your legs. The whistle forgets whose side it is on. You will hear which before the puck drops, and they stay up on the board.' },
    toll: { t: 'Twenty gold a game, after the first. Paid when the puck drops. Walking away from the card costs nothing.' },
    night: { t: 'The Long Night. Once a game I put the lamps out. Your goalie cannot find the puck, and your skaters wade.' },
    play: { t: 'Then lace up.', act: 'unadir:rink' },
  } };

/* ---------- the Nadir six ---------- */
// their six and bench, as Black Ice takes a team: your team's level plus W_UMB4E.gap, tier U's points spread over each
// of the six (as wRinkOpp spreads a tier's), the captain at centre with his own ultimate
function wUmbHkTeam(lvl) {
  const L = lvl != null ? lvl : Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + W_UMB4E.gap)), k = W_HKG.oppBonus[4] || 0, n = wHK.pos.length;
  const roster = W_UMB4E.six.map((s, i) => {
    const m = wRinkPlayer(wMakePlayer({ kind: s.kind, lvl: i < n ? L : Math.max(1, L - 1), n: s.n, num: s.num }, 'opp'));
    if (s.ult) m.ult = s.ult;
    return m;
  });
  if (k) roster.slice(0, n).forEach((p, j) => { const st = wHK.stats; for (let i = 0; i < k; i++) { const s = st[(i * 5 + j) % st.length]; p.r[s] = Math.min(W_HKR.cap, p.r[s] + 1); } });
  // the captain at centre; the rest of the six as the engine's coach picks spots (the best reflexes in goal, then the
  // defenders and the wings)
  const cap = W_UMB4E.six.findIndex(s => s.cap), free = new Set(roster.slice(0, n).map((_, i) => i).filter(i => i !== cap)), spot = { C: cap };
  for (const pos of ['G', 'LD', 'RD', 'LW', 'RW']) { const i = [...free].sort((a, b) => wHK.fit(roster[b].r, pos) - wHK.fit(roster[a].r, pos))[0]; free.delete(i); spot[pos] = i; }
  return Object.assign({}, W_UMB4E.team, { roster, spot });
}
const wWU4EBallTeam = wBallTeam;
wBallTeam = function (club) { if (club === W_UMB4E.club) { const T = W_UMB4E.team; return { name: T.name, short: T.short, color: T.color, dark: tint(T.color, -.6), light: T.light, motto: '' }; } return wWU4EBallTeam.apply(this, arguments); };
const wWU4ERinkOpp = wRinkOpp;
wRinkOpp = function (club, tier) { return club === W_UMB4E.club ? wUmbHkTeam() : wWU4ERinkOpp.apply(this, arguments); };

/* ---------- the hexes ---------- */
const wWU4EStart = wHK.start, wWU4ESimGame = wHK.simGame;
wHK.start = o => wWU4EStart(W_UMB4E.next ? Object.assign({}, o, { hexes: wUmbTakeHex(W_UMB4E) }) : o);
wHK.simGame = o => wWU4ESimGame(W_UMB4E.next && !(o && o.keep) ? Object.assign({}, o, { hexes: wUmbTakeHex(W_UMB4E) }) : o);
// n of hockey's hexes for this try of the champion (or of the finale's round): fixed for the try, the same after a reload
function wUmbHkHexes(id, n) {
  const U = wUmb(), ks = Object.keys(wHK.hexes), r = mulberry(wUmbHash('hk:' + id) + 977 * ((U && U.tries[id]) || 0) + ((U && id === 'finale' ? 31 * (U.finale || 0) : 0)) + ((WG && WG.year) || 1));
  const out = []; while (out.length < Math.min(n, ks.length)) { const k = ks[Math.floor(r() * ks.length)]; if (!out.includes(k)) out.push(k); }
  return out;
}
const wUmbHkHexWords = hx => hx.map(h => wHK.hexes[h]).filter(Boolean);

/* ---------- PLAY: the card, then the face-off ---------- */
function wUmbHkCard(C, id, hx) {
  const ch = DB.chars[C.char], U = wUmb(), tries = (U && U.tries[id]) || 0, lvl = Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + W_UMB4E.gap)), H = wUmbHkHexWords(hx);
  const ult = wHK.pows.wraith ? 'The Long Night' : '', prize = C.piece ? `Win, and ${esc(W_UMB_PIECES[C.piece].n)} is yours, with ${C.gold} gold.` : 'Win, and the round is yours.';
  const toll = !C.toll ? '' : tries > 0 ? ` This try costs the toll, ${C.toll} gold, as the puck drops.` : ` The first game is free; after a loss, each costs a toll of ${C.toll} gold.`;
  const close = modal(`<header><h3>${esc(ch.name)}</h3></header><div class="wmsg">
    <p><b>The Dead Pond: tier U.</b> Hockey against ${esc(W_UMB4E.team.name)}: level ${lvl}, in umbral form (${W_HKG.oppBonus[4]} rating points on each of their six), coached by a ${esc(W_BALL_SKILL[3])}, with a full bag (${esc(wRinkBagWords(W_RINK_KIT.opp[4]))}). Hollis Grael plays centre, and once a game casts ${esc(ult)}: your goalie set late for everything, and you skate as if through deep snow.</p>
    <p class="hint wumbpg" id="wUhkHexes"><b>Hexes:</b> ${H.map(h => `${esc(h.n)} (${esc(h.d)})`).join(' ')}</p>
    <p class="hint">${prize}${toll} Nobody goes home level: sudden death, then a shootout. <b>Play</b>: you skate your six by hand, and call it. <b>Manage</b>: you call it, your six play. <b>Simulate</b>: the result now.</p></div>
    <div class="row"><button class="btn" data-uhk="play">Play</button><button class="ghost" data-uhk="manage">Manage</button><button class="ghost" data-uhk="sim">Simulate</button><button class="ghost" id="wUhkNo">Not now</button></div>`, () => wDrain());
  $('modalBox').querySelectorAll('[data-uhk]').forEach(b => b.onclick = () => { close(); const why = wUmbHkKick(C, id, hx, b.dataset.uhk); if (why) wLog(why, 'b'); });
  $('wUhkNo').onclick = () => close();
  const f = $('modalBox').querySelector('[data-uhk="play"]'); if (f) f.focus();
}
// why your team can't play the champion now, or ''
function wUmbHkWhy() {
  const probs = wRinkProblems(); if (probs.length) return probs.join(' ');
  if (wRinkLive()) return 'Finish the hockey game you started first.';
  return '';
}
// the face-off: the toll (on a retry), the hexes in the log, and the Realm's hockey game at tier U ('' when it started)
function wUmbHkKick(C, id, hx, how) {
  const why = wUmbHkWhy(); if (why) return why;
  wUmbTollAtKickoff(id);
  const H = wUmbHkHexWords(hx);
  wLog(`${DB.chars[C.char].name.split(',')[0]} draws the hexes: ${H.map(h => `${h.n} (${h.d})`).join(' ')}`, 'b');
  W_UMB4E.next = hx.slice();
  try { return wStartRink({ club: W_UMB4E.club, how, tier: 4, kind: W_UMB4E.kind, ref: { id, hexes: hx.slice() }, cup: true }); } finally { W_UMB4E.next = null; }
}
// a hockey game half-played (u4 asks no toll to go back to one)
W_UMB4.live.rink = () => wRinkLive();
// u4's adapter (and u5's, for a hockey round): the card, or for the bots a Simulated game at once. The hexes u4
// passes are the card game's: hockey draws its own.
W_UMB4.start.rink = function (C, id) {
  // (a hockey game left half-played picks up where it was, here as anywhere, and nothing else opens)
  if (wRinkLive()) { wResumeRink(); return ''; }
  const why = wUmbHkWhy(); if (why) return why;
  const hx = wUmbHkHexes(id, C.hexes || 1);
  if (LAB) return wUmbHkKick(C, id, hx, W_UMB4E.labHow);
  wUmbHkCard(C, id, hx);
  return '';
};
// the end (wRinkSettle has paid the hockey game's own XP, gold and fans): the piece, or a try counted
W_ON_END[W_UMB4E.kind] = function (r, ref) { if (ref && ref.id) wUmbNadirEnd(ref.id, r === 'win' ? 'win' : 'lose'); };

/* ---------- the line under the bar, and the end ---------- */
const wWU4ERinkBarNote = wRinkBarNote;
wRinkBarNote = function () {
  const r = wWU4ERinkBarNote.apply(this, arguments), L = WG && WG.hkg && WG.hkg.live;
  if (L && L.world && L.world.kind === W_UMB4E.kind && WHK && WHK.world) {
    const hx = (L.world.ref && L.world.ref.hexes) || [];
    $('wRinkNote').textContent += ` The Umbral, tier U: a ${W_BALL_SKILL[3]} coaches them. Hexes: ${wUmbHkHexWords(hx).map(h => h.n).join(', ')}.`;
  }
  return r;
};
// a Hardcore journey that ended on this game (the finale's) keeps its end screen
const wWU4ERinkResultCard = wRinkResultCard;
wRinkResultCard = function () { if ((RUN && RUN.over) || (typeof UI !== 'undefined' && UI.screen === 'end')) return; return wWU4ERinkResultCard.apply(this, arguments); };
