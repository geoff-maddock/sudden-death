/* u4h: curling in the Umbral (issue #99, phase 4h). Loads after u4-grounds.js; changes earlier parts only by
   reassignment (saved originals carry the wWU4H prefix). The engine's side is src/cr/parts/15-umbral.js: the Lich (CPU
   skill 3), the hexes (opts.hexes) and a curler's own ultimate.

   Tier U at the Shed is tier 4 in curling's tables: W_SHG.oppBonus[4] rating points on each of their four (an umbral
   form changes only their ratings, never yours), the Lich skipping them (W_BALL.diff[4] = 3, the skill every engine
   reads by tier, named in W_BALL_SKILL) and a full bag (W_SHED_KIT.opp[4]). Tiers 1 to 3 are as they were.
   The champion of the Sunken Shed (u:g_shed, the Drownfen): Grisel Mourne, the Sunken Skip, holds the Sunken Stone. Past
   the two guards and the gate (u4), PLAY opens the game card (wUmbCrCard): tier U, the Nadir rink (W_UMB4H.four, at your
   team's level, the champion skipping with an ultimate of their own, The Sunken Stone), the hexes for this try, and
   Play, Manage or Simulate. The match is the Realm's own curling match (wStartShed: save and leave, resume after a
   reload, Concede, the end board) against club 'nadir:shed' (or 'nadir:shed:finale', Nadir Athletic, for a round of
   the Seal) at tier 4 with kind 'unadircr': its end goes to wUmbNadirEnd (a curling match never ends level: an extra
   end settles it, and Simulate's wShedDecide one the engine stopped). Your four curl as a Knight in Manage and Simulate,
   against the Lich, with the same hexes, so Simulate is no way round them. The toll, on a retry, is paid at the first
   stone (wUmbTollAtKickoff); backing away from the card costs nothing.
   Hexes: curling's own (wCR.hexes, the engine's table), W_NADIR.shed.hexes of them (a finale round its own count, drawn
   exactly), drawn for each try by wUmbCrHexes (fixed for the try: a reload doesn't redraw them), named on the card, in
   the log, before the first stone, under the end board all game, on the bar and in the board's caption.
   In LAB mode PLAY skips the card and plays W_UMB4H.labHow (Simulate) at once. A match left half-played (W_UMB4.live.shed)
   is picked up by PLAY where it was, with no card and no toll.
   The finale (u5) drives the same adapter with id 'finale' (no piece, no toll).

   W_UMB4H, wUmbCrClub, wUmbCrFour, wUmbCrHexes, wUmbCrCard, wUmbCrKick; W_NADIR.shed, DB.chars.nadir_shed,
   W_UMB4.start.shed, W_UMB4.live.shed, W_ON_END.unadircr
   Wraps: wBallRegion (wWU4HBallRegion), wBallTeam (wWU4HBallTeam), wShedOpp (wWU4HShedOpp): the Nadir's clubs are the
   Drownfen's and the Nadir four; wCR.start and wCR.simGame (wWU4HStart, wWU4HSimGame: the hexes go in); wShedBarNote
   (wWU4HShedBarNote: the hexes on the bar), wShedBoard (wWU4HShedBoard: and in the board's caption), wShedResultCard
   (wWU4HShedResultCard: never over the end screen of a journey the finale ended). */

const W_UMB4H = {
  id: 'shed', club: 'nadir:shed', finaleClub: 'nadir:shed:finale', kind: 'unadircr', tier: 4, labHow: 'sim',
  team: { name: 'Sunken Shed Nadir', short: 'NDR', color: '#24384a', light: '#9fe8ff' },
  finaleTeam: { name: 'Nadir Athletic', short: 'NDR', color: '#2a1e34', light: '#e4defa' },
  // the four, lead to skip (they curl in this order); the champion skips, with more points and an ultimate of their own
  four: [{ n: 'Silt', kind: 'zombie' }, { n: 'Weir', kind: 'spider' }, { n: 'Knucklebone', kind: 'skeleton' }, { n: 'Grisel Mourne', kind: 'lich', champ: true }],
  champ: { more: 0, ult: 'sunkenstone' },
};
// tier U in curling's tables (W_BALL.diff and W_BALL_SKILL are shared with the other sports' tier U: set once)
W_SHG.oppBonus[4] = 0; // (1 at first: the journey lab, phase 7, found the champion at 4% in a real journey; 0 brought it to about 10%)
W_SHED_KIT.opp[4] = { draught: 2, crwarm: 1, crsalt: 2, crpebble: 1 };
if (W_BALL.diff[4] == null) W_BALL.diff[4] = 3;
if (!W_BALL_SKILL[3]) W_BALL_SKILL[3] = 'Lich';

W_NADIR.shed = { piece: 'curling', char: 'nadir_shed', ground: 'g_shed', map: 'u:g_shed', region: 'tide', engine: 'shed', hexes: 1, toll: 20, gold: 100 };
DB.chars.nadir_shed = { name: 'Grisel Mourne, the Sunken Skip', kind: 'lich', look: { coat: '#24384a', acc: 'scarf' },
  greet: 'The tide came in over this sheet a long time ago, and nobody told the stones. I skip the Nadir here, and I keep the STONE at the bottom of the house. Say PLAY when you want to curl for it. Ask about the RULES first. The ice here has its own.',
  topics: {
    job: { t: 'I skipped at the Shed when the pebble was water and the windows had glass. I still call every stone. The sea never asked me to stop.' },
    stone: { t: 'The Sunken Stone. One piece of your Seal, and it has sat on the button so long the button has forgotten it is there. Beat my four at curling and it is yours. Lose, and the next match costs a TOLL.' },
    rules: { t: 'Real curling, your four against my four, six ends, nobody goes home level. My side curls at your level and a little better at everything, a Lich calls our stones and reads every pebble as it is, our sweepers know where a stone is going before it does, and we bring a full bag. Before the first stone I draw the HEXES.' },
    hexes: { t: 'Rime on your pebble, so your stones curl past where your skip reads them. Brooms that weigh like lead. A house that slides away from you. Frost that sets my stones in the four-foot like rock. One of them, for you. You will hear which before the first stone.' },
    sunken: { t: 'Once a match I let the house go under. Your stones drag in the cold water, and they hardly curl. Mind the end I choose.' },
    toll: { t: 'Twenty gold a match, after the first. Paid at the first stone. Walking away from the card costs nothing.' },
    play: { t: 'Then pick your four.', act: 'unadir:shed' },
  } };

/* ---------- the Nadir four ---------- */
// which of the Nadir's clubs this is: 'champ', 'finale', or ''
const wUmbCrClub = club => club === W_UMB4H.club ? 'champ' : club === W_UMB4H.finaleClub ? 'finale' : '';
// at your team's level (level parity), tier U's points on each (spread as wShedOpp spreads a tier's), the champion
// skipping with W_UMB4H.champ.more points more and their own ultimate; they curl in the order given
function wUmbCrFour(lvl, finale) {
  const L = lvl != null ? lvl : Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier())), k = W_SHG.oppBonus[W_UMB4H.tier] || 0, X = W_UMB4H.champ;
  const roster = W_UMB4H.four.map((f, j) => {
    const p = wShedPlayer(wMakePlayer({ kind: f.kind, lvl: L, n: f.n }, 'opp')), n = k + (f.champ ? X.more : 0);
    p.n = f.n;
    for (let i = 0; i < n; i++) { const s = wCR.stats[(i * 5 + j) % wCR.stats.length]; p.r[s] = Math.min(wCR.cap, p.r[s] + 1); }
    if (f.champ) p.ult = X.ult;
    return p;
  });
  const T = finale ? W_UMB4H.finaleTeam : W_UMB4H.team;
  return { name: T.name, short: T.short, color: T.color, roster, order: [0, 1, 2, 3] };
}
const wWU4HBallRegion = wBallRegion;
wBallRegion = function (club) { return wUmbCrClub(club) ? W_NADIR.shed.region : wWU4HBallRegion.apply(this, arguments); };
const wWU4HBallTeam = wBallTeam;
wBallTeam = function (club) {
  const f = wUmbCrClub(club); if (!f) return wWU4HBallTeam.apply(this, arguments);
  const T = f === 'finale' ? W_UMB4H.finaleTeam : W_UMB4H.team;
  return { name: T.name, short: T.short, color: T.color, dark: tint(T.color, -.6), light: T.light, motto: '' };
};
const wWU4HShedOpp = wShedOpp;
wShedOpp = function (club, tier) { const f = wUmbCrClub(club); return f ? wUmbCrFour(null, f === 'finale') : wWU4HShedOpp.apply(this, arguments); };

/* ---------- the hexes ---------- */
const WU4H = { next: null };
const wWU4HStart = wCR.start, wWU4HSimGame = wCR.simGame;
wCR.start = o => wWU4HStart(WU4H.next ? Object.assign({}, o, { hexes: wUmbTakeHex(WU4H), hexOn: 0 }) : o);
wCR.simGame = o => wWU4HSimGame(WU4H.next ? Object.assign({}, o, { hexes: wUmbTakeHex(WU4H), hexOn: 0 }) : o);
// n of curling's hexes for this try of the champion (or this round of the finale): fixed for the try (the same draw
// after a reload)
function wUmbCrHexes(id, n) {
  const U = wUmb(), ks = Object.keys(wCR.hexes);
  const r = mulberry(wUmbHash('cr:' + id) + 977 * ((U && U.tries[id]) || 0) + ((WG && WG.year) || 1) + (id === 'finale' && U ? 1013 * (U.finale || 0) : 0));
  const out = []; while (out.length < Math.min(Math.max(0, n), ks.length)) { const k = ks[Math.floor(r() * ks.length)]; if (!out.includes(k)) out.push(k); }
  return out;
}
const wUmbCrHexWords = hx => hx.map(h => wCR.hexes[h]).filter(Boolean);

/* ---------- PLAY: the card, then the first stone ---------- */
function wUmbCrCard(C, id, hx) {
  const ch = DB.chars[C.char], U = wUmb(), tries = (U && U.tries[id]) || 0, lvl = Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier()));
  const fin = id === 'finale' || !C.piece, T = fin ? W_UMB4H.finaleTeam : W_UMB4H.team, H = wUmbCrHexWords(hx), uo = wCR.ultOwn[W_UMB4H.champ.ult], champ = W_UMB4H.four.find(f => f.champ).n;
  // (a round of the Seal holds no piece and costs no toll)
  const toll = !C.toll ? '' : tries > 0 ? ` This match costs the toll, ${C.toll} gold, at the first stone.` : ` The first match is free; after a loss, each costs a toll of ${C.toll} gold.`;
  const prize = fin ? `Win, and ${esc(W_UMB_PIECES[C.piece].n)} is yours.` : `Win, and ${esc(W_UMB_PIECES[C.piece].n)} is yours, with ${C.gold} gold.${toll}`;
  const close = modal(`<header><h3>${esc(ch.name)}</h3></header><div class="wmsg">
    <p><b>${fin ? 'The Seal: curling' : 'The Sunken Shed'}: tier U.</b> Curling against ${esc(T.name)}: level ${lvl}, in umbral form${W_SHG.oppBonus[W_UMB4H.tier] ? ` (${W_SHG.oppBonus[W_UMB4H.tier]} rating point${W_SHG.oppBonus[W_UMB4H.tier] === 1 ? '' : 's'} on each of their four)` : ''}, their stones called by a ${esc(W_BALL_SKILL[wShedSkillOf(W_UMB4H.tier)[1]])}, who weighs more shots than any skip you have met and whose sweepers read every stone as it runs, and a full bag of potions. ${esc(champ)} skips them, and once a match lets ${esc(uo.n)} take the end: ${esc(uo.desc)}</p>
    <p class="hint wumbpg"><b>Hexes:</b> ${H.length ? H.map(h => `${esc(h.n)} (${esc(h.d)})`).join(' ') : 'none'}</p>
    <p class="hint">${prize} Nobody goes home level: an extra end. <b>Play</b>: you throw and sweep every stone of yours. <b>Manage</b>: you set your rink's game; your four throw. <b>Simulate</b>: the result now.</p></div>
    <div class="row"><button class="btn" data-ucr="play">Play</button><button class="ghost" data-ucr="manage">Manage</button><button class="ghost" data-ucr="sim">Simulate</button><button class="ghost" id="wUcrNo">Not now</button></div>`, () => wDrain());
  $('modalBox').querySelectorAll('[data-ucr]').forEach(b => b.onclick = () => { close(); const why = wUmbCrKick(C, id, hx, b.dataset.ucr); if (why) wLog(why, 'b'); });
  $('wUcrNo').onclick = () => close();
  const f = $('modalBox').querySelector('[data-ucr="play"]'); if (f) f.focus();
}
// why your team can't curl the champion now, or ''
function wUmbCrWhy() { const probs = wShedProblems(); if (probs.length) return probs.join(' '); return wShedLive() ? 'Finish the curling match you started first.' : ''; }
// the first stone: the toll (on a retry), the hexes in the log, and the Realm's curling match at tier U ('' when it started)
function wUmbCrKick(C, id, hx, how) {
  const why = wUmbCrWhy(); if (why) return why;
  wUmbTollAtKickoff(id);
  const H = wUmbCrHexWords(hx);
  if (H.length) wLog(`${DB.chars[C.char].name.split(',')[0]} draws the hexes: ${H.map(h => `${h.n} (${h.d})`).join(' ')}`, 'b');
  WU4H.next = hx.slice();
  // (the champion's match is six ends, whatever the Shed tab is set to: as the rules say and the lab measured)
  const ends0 = SET.shedEnds; SET.shedEnds = wCR.rules.ends;
  try { return wStartShed({ club: id === 'finale' ? W_UMB4H.finaleClub : W_UMB4H.club, how, tier: W_UMB4H.tier, kind: W_UMB4H.kind, ref: { id }, cup: true }); } finally { WU4H.next = null; SET.shedEnds = ends0; }
}
W_UMB4.live.shed = () => wShedLive();
W_UMB4.start.shed = function (C, id) {
  // (a match left half-played picks up where it was, here as anywhere, and nothing else opens)
  if (wShedLive()) { wResumeShed(); return ''; }
  const why = wUmbCrWhy(); if (why) return why;
  // (a round of the Seal draws exactly its own count)
  const hx = wUmbCrHexes(id, C.hexes != null ? C.hexes : 1);
  if (LAB) return wUmbCrKick(C, id, hx, W_UMB4H.labHow);
  wUmbCrCard(C, id, hx);
  return '';
};
// the end: the piece (or the finale's round), or a try counted (the finale's entry is rebuilt by u5 after a reload, so
// no check on W_NADIR here)
W_ON_END[W_UMB4H.kind] = function (r, ref) { if (ref && ref.id) wUmbNadirEnd(ref.id, r === 'win' ? 'win' : 'lose'); };

/* ---------- on screen ---------- */
// the hexes on the bar and in the board's caption, while a Nadir match is on
const wUmbCrLiveHex = () => { const L = WG && WG.shg && WG.shg.live; return L && L.world.kind === W_UMB4H.kind && WCR && !WCR.over ? wCR.hex() : null; };
const wWU4HShedBarNote = wShedBarNote;
wShedBarNote = function () {
  const r = wWU4HShedBarNote.apply(this, arguments), hx = wUmbCrLiveHex();
  if (hx) $('wShedNote').textContent += ` The Umbral, tier U. Hexes: ${hx.ids.map(h => wCR.hexes[h].n).join(', ')}.`;
  return r;
};
const wWU4HShedBoard = wShedBoard;
wShedBoard = function () {
  const r = wWU4HShedBoard.apply(this, arguments), hx = wUmbCrLiveHex(), cap = hx && document.querySelector('#wShedBoard caption');
  if (cap) cap.insertAdjacentHTML('beforeend', ` <small class="wumbpg">${esc(wCR.hexLine())}</small>`);
  return r;
};
// after a Hardcore journey ends on the finale's lost round, the curling result card stays off the end screen
const wWU4HShedResultCard = wShedResultCard;
wShedResultCard = function () { if ((RUN && RUN.over) || UI.screen === 'end') return; return wWU4HShedResultCard.apply(this, arguments); };
