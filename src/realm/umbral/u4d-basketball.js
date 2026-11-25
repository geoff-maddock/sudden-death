/* u4d: basketball in the Umbral (issue #99, phase 4d). Loads after u4-grounds.js; changes earlier parts only by
   reassignment (saved originals carry the wWU4D prefix).

   Tier U on the court is tier 4 in the basketball tables: W_BKG.oppBonus[4] rating points on each of their five (an
   umbral form changes only their ratings and start values, never yours), the Lich coaching them (W_BALL.diff[4] = 3,
   skill index 3, shared with the other engines' tier U: set once; the engine's own decisions, src/bk/parts/16-umbral.js),
   and a full potion bag (W_COURT_KIT.opp[4]). Tiers 1 to 3 are as they were.
   The champion of the Black Court (u:g_court, the Severed Plains): Vesper Gloam, the Night Warden, holds the Black Net.
   Past the two guards and the gate (u4), PLAY opens the game card (wUmbBkCard): tier U, the Nadir five (W_UMB4D.five,
   a vampire at the point with an ultimate of her own, Lights Out), the hexes for this try, and Play, Manage or Simulate.
   The game is the Realm's own basketball game (wStartCourt: save and leave, resume after a reload, Concede, the box
   scores), against club 'nadir:court' at tier 4, with kind 'unadirbk': its end goes to wUmbNadirEnd (a tie, still
   level after the overtimes, counts as a loss). The toll, when this is a retry, is paid at tip-off
   (wUmbTollAtKickoff, the frame's), never for backing away from the card.
   The finale (u5) plays a basketball round through the same adapter, id 'finale': the same five as Nadir Athletic
   (club 'nadir:court:finale'), no toll, no piece; its end goes to W_ON_END.nadir as the finale's.
   Hexes: basketball's own (wBK.hexes, the engine's table), W_NADIR.court.hexes of them (the finale's round its own
   count), drawn for each try by wUmbBkHexes (fixed for the try: a reload doesn't redraw them), named on the card, in
   the log, before the tip and on the scoreboard.
   In LAB mode PLAY skips the card and plays W_UMB4D.labHow (Simulate) at once, for the realm bot. A game left
   half-played (W_UMB4.live.court) is picked up by PLAY where it was, with no card and no toll.

   W_UMB4D, wUmbBkTeam, wUmbBkClub, wUmbBkHexes, wUmbBkCard, wUmbBkTip
   Wraps: wBallRegion (wWU4DBallRegion), wBallTeam (wWU4DBallTeam), wCourtOpp (wWU4DCourtOpp): the Nadir's clubs are
   the Severed Plains' and the Nadir five; wBK.start and wBK.simGame (wWU4DStart, wWU4DSimGame: the hexes go in); and
   wCourtResultCard (wWU4DCourtResultCard: no card over the end screen when a Hardcore journey has just ended, RUN.over). */

const W_UMB4D = {
  id: 'court', club: 'nadir:court', finaleClub: 'nadir:court:finale', kind: 'unadirbk', labHow: 'sim',
  team: { name: 'Black Court Nadir', short: 'NDR', color: '#2e2440', light: '#c8b8ff' },
  finaleTeam: { name: 'Nadir Athletic', short: 'NDR', color: '#2a1e34', light: '#e4defa' },
  // their level against your team's (0: level for level), and the five, then the bench
  gap: 0,
  five: [
    { n: 'Vesper Gloam', kind: 'vampire', num: 0, ult: 'lightsout', cap: true }, { n: 'Hush', kind: 'skeleton', num: 13 }, { n: 'Sable Thorn', kind: 'skeleton', num: 22 },
    { n: 'Weft', kind: 'zombie', num: 8 }, { n: 'Cairn', kind: 'golem', num: 50 },
    { n: 'Mortlake', kind: 'zombie', num: 44 }, { n: 'Grieve', kind: 'witch', num: 3 },
  ],
};
// tier U in the basketball tables (W_BALL.diff and W_BALL_SKILL are shared with the other engines' tier U: set once)
W_BKG.oppBonus[4] = 6;
W_COURT_KIT.opp[4] = { draught: 2, secondwind: 2, bksteady: 1, bkhot: 2 };
if (W_BALL.diff[4] == null) W_BALL.diff[4] = 3;
if (!W_BALL_SKILL[3]) W_BALL_SKILL[3] = 'Lich';

W_NADIR.court = { piece: 'basketball', char: 'nadir_court', ground: 'g_court', map: 'u:g_court', region: 'plains', engine: 'court', hexes: 1, toll: 20, gold: 100 };
DB.chars.nadir_court = { name: 'Vesper Gloam, the Night Warden', kind: 'vampire', look: { coat: '#2e2440', acc: 'scarf' },
  greet: 'You walked all the way through the cold for a game of basketball. I captain the Nadir on the Black Court, and I keep the NET. Say PLAY when you want to lose it. Ask about the RULES first, if you like; nobody listens.',
  topics: {
    job: { t: 'I run the point on the Black Court. I was running it when the torches on that wall were lit, and I will be running it when the last one goes out.' },
    net: { t: 'The Black Net. One piece of your Seal, and it has never once let a ball through cleanly. Beat my five at basketball and it is yours. Lose, and the next game costs a TOLL.' },
    rules: { t: 'Real basketball, five on five, four quarters, our boards. My side plays harder than anything you have met, a Lich calls our sets, and our bench carries a full bag. I keep the LIGHTS for when it matters. Before the tip I draw the HEXES.' },
    hexes: { t: 'The Black Court has its moods. Your rim drifts on its bracket, a shadow comes out to guard you, a crooked whistle calls every touch against you, the cold gets into your fingers at the line. You will hear which before the tip.' },
    toll: { t: 'Twenty gold a game, after the first. Paid at the tip. Walking away from the card costs nothing.' },
    lights: { t: 'Once a game I put the torches out. Your shots go dark, and my five take the ball off you in the gloom.' },
    play: { t: 'Then bring your five.', act: 'unadir:court' },
  } };

/* ---------- the Nadir five ---------- */
// which of the Nadir's clubs this is: 'champ', 'finale', or ''
const wUmbBkClub = club => club === W_UMB4D.club ? 'champ' : club === W_UMB4D.finaleClub ? 'finale' : '';
// their five and bench, as the court takes a team: your team's level plus W_UMB4D.gap, tier U's points on each of the
// five (spread as wCourtOpp spreads a tier's), the captain at the point with her own ultimate
function wUmbBkTeam(lvl, finale) {
  const L = lvl != null ? lvl : Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + W_UMB4D.gap)), k = W_BKG.oppBonus[4] || 0;
  const roster = W_UMB4D.five.map((s, i) => {
    const t = wCourtPlayer(wMakePlayer({ kind: s.kind, lvl: i < 5 ? L : Math.max(1, L - 1), n: s.n, num: s.num }, 'opp'));
    if (s.ult) t.ult = s.ult;
    return t;
  });
  if (k) roster.slice(0, 5).forEach((p, j) => { const st = wBK.stats; for (let i = 0; i < k; i++) { const s = st[(i * 5 + j) % st.length]; p.r[s] = Math.min(W_BKR.cap, p.r[s] + 1); } });
  const T = Object.assign({}, finale ? W_UMB4D.finaleTeam : W_UMB4D.team, { roster });
  // the captain plays the point: whoever the coaches put there takes her spot
  const spot = wBK.team(T).spot, cap = W_UMB4D.five.findIndex(s => s.cap), was = Object.keys(spot).find(p => spot[p] === cap);
  if (was && was !== 'PG') { spot[was] = spot.PG; spot.PG = cap; }
  return Object.assign(T, { spot });
}
const wWU4DBallRegion = wBallRegion;
wBallRegion = function (club) { return wUmbBkClub(club) ? W_NADIR.court.region : wWU4DBallRegion.apply(this, arguments); };
const wWU4DBallTeam = wBallTeam;
wBallTeam = function (club) {
  const f = wUmbBkClub(club); if (!f) return wWU4DBallTeam.apply(this, arguments);
  const T = f === 'finale' ? W_UMB4D.finaleTeam : W_UMB4D.team;
  return { name: T.name, short: T.short, color: T.color, dark: tint(T.color, -.6), light: T.light, motto: '' };
};
const wWU4DCourtOpp = wCourtOpp;
wCourtOpp = function (club, tier) { const f = wUmbBkClub(club); return f ? wUmbBkTeam(null, f === 'finale') : wWU4DCourtOpp.apply(this, arguments); };

/* ---------- the hexes ---------- */
const WU4D = { next: null };
const wWU4DStart = wBK.start, wWU4DSimGame = wBK.simGame;
wBK.start = o => wWU4DStart(WU4D.next ? Object.assign({}, o, { hexes: wUmbTakeHex(WU4D) }) : o);
wBK.simGame = o => wWU4DSimGame(WU4D.next && !(o && o.keep) ? Object.assign({}, o, { hexes: wUmbTakeHex(WU4D) }) : o);
// n of basketball's hexes for this try of the champion (or this round of the finale): fixed for the try (the same draw
// after a reload)
function wUmbBkHexes(id, n) {
  const U = wUmb(), ks = Object.keys(wBK.hexes);
  const r = mulberry(wUmbHash('bk:' + id) + 977 * ((U && U.tries[id]) || 0) + ((WG && WG.year) || 1) + (id === 'finale' && U ? 1013 * (U.finale || 0) : 0));
  const out = []; while (out.length < Math.min(n, ks.length)) { const k = ks[Math.floor(r() * ks.length)]; if (!out.includes(k)) out.push(k); }
  return out;
}
const wUmbBkHexWords = hx => hx.map(h => wBK.hexes[h]).filter(Boolean);
// (a Hardcore journey that has just ended on this game's loss: no result card over the end screen)
const wWU4DCourtResultCard = wCourtResultCard;
wCourtResultCard = function () { if ((RUN && RUN.over) || UI.screen === 'end') return; return wWU4DCourtResultCard.apply(this, arguments); };

/* ---------- PLAY: the card, then the tip ---------- */
function wUmbBkCard(C, id, hx) {
  const ch = DB.chars[C.char], U = wUmb(), tries = (U && U.tries[id]) || 0, lvl = Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier() + W_UMB4D.gap));
  const fin = id === 'finale' || !C.piece, T = fin ? W_UMB4D.finaleTeam : W_UMB4D.team, lu = wBK.ultBook('lightsout'), H = wUmbBkHexWords(hx);
  // (a round of the Seal holds no piece and costs no toll)
  const toll = !C.toll ? '' : tries > 0 ? ` This try costs the toll, ${C.toll} gold, at the tip.` : ` The first game is free; after a loss, each costs a toll of ${C.toll} gold.`;
  const prize = fin ? 'Win, and this round of the Seal is yours.' : `Win, and ${esc(W_UMB_PIECES[C.piece].n)} is yours, with ${C.gold} gold.${toll}`;
  const close = modal(`<header><h3>${esc(ch.name)}</h3></header><div class="wmsg">
    <p><b>${fin ? 'The Seal: basketball' : 'The Black Court'}: tier U.</b> Basketball against ${esc(T.name)}: level ${lvl}, in umbral form (${W_BKG.oppBonus[4]} rating points on each of their five), coached by a ${esc(W_BALL_SKILL[3])}, with a full potion bag. ${esc(W_UMB4D.five[0].n)} plays the point, and once a game casts ${esc(lu.n)}: ${esc(lu.desc)}</p>
    <p class="hint wumbpg"><b>Hexes:</b> ${H.map(h => `${esc(h.n)} (${esc(h.d)})`).join(' ')}</p>
    <p class="hint">${prize} A tie counts as a loss.</p></div>
    <div class="row"><button class="btn" data-ubk="play">Play</button><button class="ghost" data-ubk="manage">Manage</button><button class="ghost" data-ubk="sim">Simulate</button><button class="ghost" id="wUbkNo">Not now</button></div>`,
    () => wDrain());
  $('modalBox').querySelectorAll('[data-ubk]').forEach(b => b.onclick = () => { close(); const why = wUmbBkTip(C, id, hx, b.dataset.ubk); if (why) wLog(why, 'b'); });
  $('wUbkNo').onclick = () => close();
  const f = $('modalBox').querySelector('[data-ubk="play"]'); if (f) f.focus();
}
// the tip: the toll (on a retry), the hexes in the log, and the Realm's basketball game at tier U ('' when it started)
function wUmbBkTip(C, id, hx, how) {
  const probs = wCourtProblems(); if (probs.length) return probs.join(' ');
  if (wCourtLive()) return 'Finish the basketball game you started first.';
  wUmbTollAtKickoff(id);
  const H = wUmbBkHexWords(hx);
  wLog(`${DB.chars[C.char].name.split(',')[0]} draws the hexes: ${H.map(h => `${h.n} (${h.d})`).join(' ')}`, 'b');
  WU4D.next = hx.slice();
  try { return wStartCourt({ club: id === 'finale' ? W_UMB4D.finaleClub : W_UMB4D.club, how, tier: 4, kind: W_UMB4D.kind, ref: { id }, cup: true }); } finally { WU4D.next = null; }
}
// (a basketball game left half-played: u4 skips the toll's gold check, and PLAY picks it up)
W_UMB4.live.court = () => wCourtLive();
W_UMB4.start.court = function (C, id) {
  // (a game left half-played picks up where it was, here as anywhere, and nothing else opens)
  if (wCourtLive()) { wResumeCourt(); return ''; }
  const probs = wCourtProblems(); if (probs.length) return probs.join(' ');
  const hx = wUmbBkHexes(id, C.hexes || 1);
  if (LAB) return wUmbBkTip(C, id, hx, W_UMB4D.labHow);
  wUmbBkCard(C, id, hx);
  return '';
};
// the end: the piece (or the finale's round), or a try counted (a tie is not a win)
W_ON_END[W_UMB4D.kind] = function (r, ref) { if (ref && ref.id) wUmbNadirEnd(ref.id, r === 'win' ? 'win' : 'lose'); };
