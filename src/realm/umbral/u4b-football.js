/* u4b: football in the Umbral (issue #99, phase 4b). Loads after u4-grounds.js; changes earlier parts only by
   reassignment (saved originals carry the wWU4B prefix).

   Tier U on the gridiron is tier 4 in the football tables: W_GFG.oppBonus[4] rating points on each of their seven (an
   umbral form changes only their ratings and start values, never yours), the Lich coaching them (W_BALL.diff[4] = 3,
   skill index 3, the engine's own decisions: src/gf/parts/18-umbral.js), and a full potion bag (W_GRID_KIT.opp[4]).
   Tiers 1 to 3 are as they were.
   The champion of the Cinder Pit (u:g_bowl, the Ashmaw): Ossian Pyre, the Ash Marshal, holds the Ash Ball. Past the two
   guards and the gate (u4), PLAY opens the game card (wUmbGfCard): tier U, the Nadir seven (W_UMB4B.seven, a lich at
   quarterback with an ultimate of his own, Eclipse), the hexes for this try, and Play, Manage or Simulate. The game is
   the Realm's own football game (wStartGrid: save and leave, resume after a reload, Concede, the box scores), against
   club 'nadir:gridiron' at tier 4, with kind 'unadirgf': its end goes to wUmbNadirEnd (a tie counts as a loss). The
   toll, when this is a retry, is paid at kickoff (wUmbTollAtKickoff, the frame's), never for backing away from the card.
   Hexes: football's own (wGF.hexes, the engine's table), W_NADIR.gridiron.hexes of them, drawn for each try by
   wUmbGfHexes (fixed for the try: a reload doesn't redraw them), named on the card, in the log and on the field.
   In LAB mode PLAY skips the card and plays W_UMB4B.labHow (Simulate) at once, for the realm bot.

   W_UMB4B, wUmbGfTeam, wUmbGfHexes, wUmbGfCard, wUmbGfKick
   Wraps: wBallRegion (wWU4BBallRegion), wBallTeam (wWU4BBallTeam), wGridOpp (wWU4BGridOpp): a 'nadir:<id>' club is the
   champion's region and the Nadir seven; and wGF.game and wGF.simGame (wWU4BGame, wWU4BSimGame: the hexes go in). */

const W_UMB4B = {
  id: 'gridiron', club: 'nadir:gridiron', kind: 'unadirgf', labHow: 'sim',
  team: { name: 'Cinder Pit Nadir', short: 'NDR', color: '#3a2a4a', light: '#c8b8ff' },
  // their level against your team's (0: level for level), and the seven, then the bench
  gap: 0,
  seven: [
    { n: 'Ossian Pyre', kind: 'lich', num: 1, ult: 'eclipse', qb: true }, { n: 'Cinderjaw', kind: 'minotaur', num: 33 }, { n: 'Slagheart', kind: 'golem', num: 70 },
    { n: 'Ashbone', kind: 'dwarf', num: 66 }, { n: 'Grue', kind: 'troll', num: 77 }, { n: 'Vesk', kind: 'wraith', num: 13 }, { n: 'Hollow Wren', kind: 'goblin', num: 81 },
    { n: 'Soot', kind: 'zombie', num: 52 }, { n: 'Rattlebrand', kind: 'skeleton', num: 4 }, { n: 'Emberfang', kind: 'werewolf', num: 28 },
  ],
};
// tier U in the football tables (W_BALL.diff and W_BALL_SKILL are shared with baseball's tier U: set once)
W_GFG.oppBonus[4] = 5;
W_GRID_KIT.opp[4] = { draught: 2, secondwind: 1, gfresin: 1, gfhaste: 1, gffog: 1, gfsalve: 1 };
if (W_BALL.diff[4] == null) W_BALL.diff[4] = 3;
if (!W_BALL_SKILL[3]) W_BALL_SKILL[3] = 'Lich';

W_NADIR.gridiron = { piece: 'football', char: 'nadir_gridiron', ground: 'g_bowl', map: 'u:g_bowl', region: 'ember', engine: 'gridiron', hexes: 1, toll: 30, gold: 100 };
DB.chars.nadir_gridiron = { name: 'Ossian Pyre, the Ash Marshal', kind: 'lich', look: { coat: '#3a2a4a', acc: 'hat' },
  greet: 'Another one who walked through the cold for a game. I captain the Nadir here, and I hold the BALL. Say PLAY when you are ready to lose it. Ask about the RULES first; nobody ever does.',
  topics: {
    job: { t: 'I call the plays in the Pit. I called them before the Ash Bowl had grass, and I will call them after it is ash.' },
    ball: { t: 'The Ash Ball. One ninth of your Seal, and still warm. Beat my seven at football and it is yours. Lose, and the next game costs a TOLL.' },
    rules: { t: 'Real football, seven a side, two halves, our field. My side plays harder than anything you have met, a Lich calls our plays, and our sideline carries a full bag. I keep an ECLIPSE for when it matters. Before kickoff I draw the HEXES.' },
    hexes: { t: 'The Pit has its moods. The end zone at your end creeps out, the ball rolls our way, the cold gets into your legs, the wind turns your kicks. You will hear which before kickoff.' },
    toll: { t: 'Thirty gold a game, after the first. Paid at kickoff. Walking away from the card costs nothing.' },
    eclipse: { t: 'Once a game I put the sun out. Your runners slow, your throws go wild. Enjoy the dark.' },
    play: { t: 'Then pick your seven.', act: 'unadir:gridiron' },
  } };

/* ---------- the Nadir seven ---------- */
// their seven and bench, as Cinder Gridiron takes a team: your team's level plus W_UMB4B.gap, tier U's points on each of
// the seven (spread as wGridOpp spreads a tier's), the captain at quarterback with his ultimate
function wUmbGfTeam(lvl) {
  const L = lvl != null ? lvl : Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + W_UMB4B.gap)), k = W_GFG.oppBonus[4] || 0;
  const roster = W_UMB4B.seven.map((s, i) => {
    const m = wSevenPlayer(wMakePlayer({ kind: s.kind, lvl: i < W_GFR.side ? L : Math.max(1, L - 1), n: s.n, num: s.num }, 'opp'));
    if (s.ult) m.ult = s.ult;
    if (wGridHasTwo(m.kind)) { const h = seedHash(0x6f1, m.n + ':' + m.kind); m.pw = { off: h & 1, def: (h >> 1) & 1 }; }
    return m;
  });
  if (k) for (const p of roster.slice(0, W_GFR.side)) { const st = Object.keys(p.r); for (let i = 0; i < k; i++) { const s = st[(i * 5 + (p.num || 0)) % st.length]; p.r[s] = Math.min(W_GFR.cap, p.r[s] + 1); } }
  const team = Object.assign({}, W_UMB4B.team, { roster }), auto = wGF.auto(roster.slice(0, W_GFR.side)), cap = W_UMB4B.seven.findIndex(s => s.qb);
  // the captain plays quarterback: whoever the coaches put there takes his place
  const was = Object.keys(auto.off).find(p => auto.off[p] === cap);
  if (was && was !== 'QB') { auto.off[was] = auto.off.QB; auto.off.QB = cap; }
  return Object.assign(team, { off: auto.off, def: auto.def, kicker: auto.kicker });
}
const wWU4BBallRegion = wBallRegion;
wBallRegion = function (club) { if (String(club).startsWith('nadir:')) { const C = W_NADIR[String(club).slice(6)]; return C ? C.region : null; } return wWU4BBallRegion.apply(this, arguments); };
const wWU4BBallTeam = wBallTeam;
wBallTeam = function (club) { if (club === W_UMB4B.club) { const T = W_UMB4B.team; return { name: T.name, short: T.short, color: T.color, dark: tint(T.color, -.6), light: T.light, motto: '' }; } return wWU4BBallTeam.apply(this, arguments); };
const wWU4BGridOpp = wGridOpp;
wGridOpp = function (club, tier) { return club === W_UMB4B.club ? wUmbGfTeam() : wWU4BGridOpp.apply(this, arguments); };

/* ---------- the hexes ---------- */
const WU4B = { next: null };
const wWU4BGame = wGF.game, wWU4BSimGame = wGF.simGame;
wGF.game = o => wWU4BGame(WU4B.next ? Object.assign({}, o, { hexes: WU4B.next.slice() }) : o);
wGF.simGame = o => wWU4BSimGame(WU4B.next && !(o && o.keep) ? Object.assign({}, o, { hexes: WU4B.next.slice() }) : o);
// n of football's hexes for this try of the champion: fixed for the try (the same draw after a reload)
function wUmbGfHexes(id, n) {
  const U = wUmb(), ks = Object.keys(wGF.hexes), r = mulberry(wUmbHash('gf:' + id) + 977 * ((U && U.tries[id]) || 0) + ((WG && WG.year) || 1));
  const out = []; while (out.length < Math.min(n, ks.length)) { const k = ks[Math.floor(r() * ks.length)]; if (!out.includes(k)) out.push(k); }
  return out;
}
const wUmbGfHexWords = hx => hx.map(h => wGF.hexes[h]).filter(Boolean);

/* ---------- PLAY: the card, then kickoff ---------- */
function wUmbGfCard(C, id, hx) {
  const ch = DB.chars[C.char], U = wUmb(), tries = (U && U.tries[id]) || 0, lvl = Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + W_UMB4B.gap));
  const eu = wGF.ult('eclipse'), H = wUmbGfHexWords(hx);
  // (the frame of phase 4 charged the toll as the card opened; it no longer does: then backing away gives it back)
  const oldFrame = typeof wUmbTollAtKickoff !== 'function' && tries > 0;
  let went = false;
  const close = modal(`<header><h3>${esc(ch.name)}</h3></header><div class="wmsg">
    <p><b>The Cinder Pit: tier U.</b> Football against ${esc(W_UMB4B.team.name)}: level ${lvl}, in umbral form (${W_GFG.oppBonus[4]} rating points on each of their seven), coached by a ${esc(W_BALL_SKILL[3])}, with a full potion bag. ${esc(ch.name.split(',')[0])} plays quarterback, and once a game casts ${esc(eu.n)}: ${esc(eu.desc)}</p>
    <p class="hint wumbpg"><b>Hexes:</b> ${H.map(h => `${esc(h.n)} (${esc(h.d)})`).join(' ')}</p>
    <p class="hint">Win, and ${esc(W_UMB_PIECES[C.piece].n)} is yours, with ${C.gold} gold. ${tries > 0 ? `This try costs the toll, ${C.toll} gold, at kickoff.` : 'The first game is free; after a loss, each costs a toll of ' + C.toll + ' gold.'} A tie counts as a loss.</p></div>
    <div class="row"><button class="btn" data-ugf="play">Play</button><button class="ghost" data-ugf="manage">Manage</button><button class="ghost" data-ugf="sim">Simulate</button><button class="ghost" id="wUgfNo">Not now</button></div>`,
    () => { if (!went && oldFrame) { RUN.gold += C.toll; wLog('You walk away from the card. You keep your toll.', 'd'); } wDrain(); });
  $('modalBox').querySelectorAll('[data-ugf]').forEach(b => b.onclick = () => { went = true; close(); const why = wUmbGfKick(C, id, hx, b.dataset.ugf); if (why) wLog(why, 'b'); });
  $('wUgfNo').onclick = () => close();
  const f = $('modalBox').querySelector('[data-ugf="play"]'); if (f) f.focus();
}
// kickoff: the toll (on a retry), the hexes in the log, and the Realm's football game at tier U ('' when it started)
function wUmbGfKick(C, id, hx, how) {
  const probs = wGridProblems(); if (probs.length) return probs.join(' ');
  if (wGridLive()) return 'Finish the football game you started first.';
  if (typeof wUmbTollAtKickoff === 'function') wUmbTollAtKickoff(id);
  const H = wUmbGfHexWords(hx);
  wLog(`${DB.chars[C.char].name.split(',')[0]} draws the hexes: ${H.map(h => `${h.n} (${h.d})`).join(' ')}`, 'b');
  WU4B.next = hx.slice();
  try { return wStartGrid({ club: W_UMB4B.club, how, tier: 4, kind: W_UMB4B.kind, ref: { id }, cup: true }); } finally { WU4B.next = null; }
}
W_UMB4.start.gridiron = function (C, id) {
  const probs = wGridProblems(); if (probs.length) return probs.join(' ');
  if (wGridLive()) return 'Finish the football game you started first.';
  const hx = wUmbGfHexes(id, C.hexes || 1);
  if (LAB) return wUmbGfKick(C, id, hx, W_UMB4B.labHow);
  wUmbGfCard(C, id, hx);
  return '';
};
// the end: the piece, or a try counted (a tie is not a win)
W_ON_END[W_UMB4B.kind] = function (r, ref) { if (ref && ref.id) wUmbNadirEnd(ref.id, r === 'win' ? 'win' : 'lose'); };
