/* u4j: jousting in the Umbral (issue #117, phase 11), as u4h is curling's. Loads after u4h-curling.js; changes earlier
   parts only by reassignment (saved originals carry the wWU4J prefix). The engine's side is src/jt/parts/15-umbral.js:
   the Lich (CPU skill 3), the hexes (opts.hexes) and a rider's own ultimate. The dark ground itself, the Hollow Lists
   (u:g_lists, on the dark Mossgate's side of the Rotwold), is u4's: W_UMB4.grounds lists it, so u0's transform builds
   it, u4 sets its two guards and its gate (the Rotwold's mossberry) and places its champion, and u8d walls it.

   Tier U at the Lists is tier 4 in jousting's tables: W_JTG.oppBonus[4] rating points on each of their four (an umbral
   form changes only their ratings, never yours), the Lich riding for them (W_BALL.diff[4] = 3, the skill every engine
   reads by tier, named in W_BALL_SKILL: the engine's sharper hands, a surer lean, and odds reckoned against the rider it
   meets) and a full bag (W_LISTS_KIT.opp[4]). Tiers 1 to 3 are as they were.
   The champion of the Hollow Lists: Isolde Grave, the Pale Rider, holds the Splintered Lance. Past the two guards and the
   gate (u4), PLAY opens the game card (wUmbJtCard): tier U, the Nadir four (W_UMB4J.four, at your team's level: a
   wraith rides the first heat, the champion the second and the tilt for the crown, with an ultimate of her own, The
   Pale Charge; a spider and a witch squire), the hexes for this try, and Play, Manage or Simulate. The match is the
   Realm's own jousting match (wStartLists: save and leave, resume after a reload, Concede, the result) against club
   'nadir:lists' (or 'nadir:lists:finale', Nadir Athletic, for a round of the Seal) at tier 4 with kind 'unadirjt': its
   end goes to wUmbNadirEnd (a joust never ends level: the tilt for the crown). Always two heats of three courses,
   whatever Settings says (the standard match), and the Lists' own ways are off (ground: false: the Hollow Lists'
   sand is never raked and no pennant flies; the Umbral's other grounds turn their layers off too). Your four ride as a
   Knight in Manage and Simulate, against the Lich, with the same hexes, so Simulate is no way round them. The toll, on
   a retry, is paid as the match starts (wUmbTollAtKickoff); backing away from the card costs nothing.
   Hexes: jousting's own (wJT.hexes, the engine's table), W_NADIR.lists.hexes of them (a finale round its own count),
   drawn for each try by wUmbJtHexes (fixed for the try: a reload doesn't redraw them), named on the card, in the log,
   before the first course, on the lists all match, on the bar and in the board's caption.
   In LAB mode PLAY skips the card and plays W_UMB4J.labHow (Simulate) at once. A match left half-played
   (W_UMB4.live.lists) is picked up by PLAY where it was, with no card and no toll.
   The finale (u5) drives the same adapter with id 'finale' (no piece, no toll).
   The Seal's count: a journey whose Umbral opened before this part (WG.umbral without need) asks for the nine pieces
   it opened with (u3's W_UMB_NINE): set on loading it (wStart), so a save mid-Umbral, or mid-Seal, finishes as it
   would have. Its jousting champion still plays, and the piece still sings (u8j), but the Seal never waits for it.

   W_UMB4J, wUmbJtClub, wUmbJtFour, wUmbJtHexes, wUmbJtCard, wUmbJtKick, wUmbJtHelp (u6's How to play); W_NADIR.lists, DB.chars.nadir_lists,
   W_UMB4.start.lists, W_UMB4.live.lists, W_ON_END.unadirjt
   Wraps: wBallRegion (wWU4JBallRegion), wBallTeam (wWU4JBallTeam), wListsOpp (wWU4JListsOpp): the Nadir's clubs are the
   Rotwold's and the Nadir four; wListsOpts (wWU4JListsOpts: tier U jousts with the ground off); wJT.start and
   wJT.simMatch (wWU4JStart, wWU4JSimMatch: the hexes go in); wListsBarNote (wWU4JListsBarNote: the hexes on the bar,
   and no "from the next match" length note), wListsBoard (wWU4JListsBoard: and in the board's caption),
   wListsResultCard (wWU4JListsResultCard: never over the end screen of a journey the finale ended), wStart (wWU4JStart2: an older Umbral's count of pieces). */

const W_UMB4J = {
  id: 'lists', club: 'nadir:lists', finaleClub: 'nadir:lists:finale', kind: 'unadirjt', tier: 4, labHow: 'sim',
  team: { name: 'Hollow Lists Nadir', short: 'NDR', color: '#2e2438', light: '#d8c8ff', shade: 1 },
  finaleTeam: { name: 'Nadir Athletic', short: 'NDR', color: '#2a1e34', light: '#e4defa', shade: 1 },
  // the four: the first heat's rider, the second's (the champion, and the tilt for the crown), then the two squires
  four: [{ n: 'Sir Hollowmere', kind: 'wraith' }, { n: 'Isolde Grave', kind: 'vampire', champ: true }, { n: 'Weft', kind: 'spider' }, { n: 'Hemlock', kind: 'witch' }],
  champ: { more: 0, ult: 'palecharge' },
};
// tier U in jousting's tables (W_BALL.diff and W_BALL_SKILL are shared with the other sports' tier U: set once)
W_JTG.oppBonus[4] = 1;
W_LISTS_KIT.opp[4] = { draught: 2, jtliniment: 1, jttonic: 1, jtoil: 2 };
if (W_BALL.diff[4] == null) W_BALL.diff[4] = 3;
if (!W_BALL_SKILL[3]) W_BALL_SKILL[3] = 'Lich';

W_NADIR.lists = { piece: 'jousting', char: 'nadir_lists', ground: 'g_lists', map: 'u:g_lists', region: 'bloom', engine: 'lists', hexes: 1, toll: 20, gold: 100 };
DB.chars.nadir_lists = { name: 'Isolde Grave, the Pale Rider', kind: 'vampire', look: { coat: '#2e2438', acc: 'helmet' },
  greet: 'Nobody rakes this sand any more. Nobody needs to. I ride for the Nadir here, and I keep the LANCE. Say PLAY when you want to ride for it. Ask about the RULES first. Our tilt has its own.',
  topics: {
    job: { t: 'I rode the Tilting Lists when the pennants still had colours. I unhorsed everyone who came, and then there was nobody left to come, and I kept riding.' },
    lance: { t: 'The Splintered Lance. One piece of your Seal, and it broke on a shield so long ago that the shield is dust. Beat my four at jousting and it is yours. Lose, and the next match costs a TOLL.' },
    rules: { t: 'Real jousting, your four against my four: two heats of three courses, and the tilt for the crown if we are level. My side rides at your level and a little better at everything, a Lich calls our courses and steadies our hands, and our squires bring a full bag. No wind here, and the sand never ruts. Before the first course I draw the HEXES.' },
    hexes: { t: 'A grave mist on the tilt, so your tip wanders. Mounts that are half shadow, and blow too soon. Frost on your saddles. Shields on my side that drink your lance. One of them, for you. You will hear which before the first course.' },
    charge: { t: 'Once a match I ride the Pale Charge. My lance breaks on anything it touches, and your rider\'s tip goes looking for something to hold on to. Mind the course I choose.' },
    toll: { t: 'Twenty gold a match, after the first. Paid as the match starts. Walking away from the card costs nothing.' },
    play: { t: 'Then pick your four.', act: 'unadir:lists' },
  } };

/* ---------- the Nadir four ---------- */
// which of the Nadir's clubs this is: 'champ', 'finale', or ''
const wUmbJtClub = club => club === W_UMB4J.club ? 'champ' : club === W_UMB4J.finaleClub ? 'finale' : '';
// at your team's level (level parity), tier U's points on each (spread as wListsOpp spreads a tier's), the champion
// riding the second heat with W_UMB4J.champ.more points more and her own ultimate; each rider on the mount that suits
// them, the champion the best for the tilt
function wUmbJtFour(lvl, finale) {
  const L = lvl != null ? lvl : Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier())), k = W_JTG.oppBonus[W_UMB4J.tier] || 0, X = W_UMB4J.champ, st = wJT.stats;
  const roster = W_UMB4J.four.map((f, j) => {
    const p = wListsPlayer(wMakePlayer({ kind: f.kind, lvl: L, n: f.n }, 'opp')), n = k + (f.champ ? X.more : 0);
    p.n = f.n; p.pw = wJT.pwByName(f.n);
    for (let i = 0; i < n; i++) { const s = st[(i * 3 + j) % st.length]; p.r[s] = Math.min(wJT.cap, p.r[s] + 1); }
    if (f.champ) p.ult = X.ult;
    delete p.gear;
    return p;
  });
  const T = finale ? W_UMB4J.finaleTeam : W_UMB4J.team, riders = [0, 1], n = wListsCourses();
  return { name: T.name, short: T.short, color: T.color, shade: 1, roster, riders, squires: [2, 3],
    mounts: riders.map(i => wJT.mountFor(wJtRsOfR(roster[i].r), n).m), best: W_UMB4J.four.findIndex(f => f.champ) === 1 ? 1 : 0 };
}
const wWU4JBallRegion = wBallRegion;
wBallRegion = function (club) { return wUmbJtClub(club) ? W_NADIR.lists.region : wWU4JBallRegion.apply(this, arguments); };
const wWU4JBallTeam = wBallTeam;
wBallTeam = function (club) {
  const f = wUmbJtClub(club); if (!f) return wWU4JBallTeam.apply(this, arguments);
  const T = f === 'finale' ? W_UMB4J.finaleTeam : W_UMB4J.team;
  return { name: T.name, short: T.short, color: T.color, dark: tint(T.color, -.6), light: T.light, motto: '' };
};
const wWU4JListsOpp = wListsOpp;
wListsOpp = function (club, tier) { const f = wUmbJtClub(club); return f ? wUmbJtFour(null, f === 'finale') : wWU4JListsOpp.apply(this, arguments); };
// tier U jousts with the Lists' ways off (as the Umbral's other grounds turn their layers off): w155 respects a match
// whose options already say
const wWU4JListsOpts = wListsOpts;
wListsOpts = function (mine, opp, tier) { const o = wWU4JListsOpts.apply(this, arguments); return tier === W_UMB4J.tier ? Object.assign(o, { ground: false }) : o; };

/* ---------- the hexes ---------- */
const WU4J = { next: null };
const wWU4JStart = wJT.start, wWU4JSimMatch = wJT.simMatch;
wJT.start = o => wWU4JStart(WU4J.next ? Object.assign({}, o, { hexes: wUmbTakeHex(WU4J), hexOn: 0 }) : o);
wJT.simMatch = o => wWU4JSimMatch(WU4J.next ? Object.assign({}, o, { hexes: wUmbTakeHex(WU4J), hexOn: 0 }) : o);
// n of jousting's hexes for this try of the champion (or this round of the finale): fixed for the try (the same draw
// after a reload)
function wUmbJtHexes(id, n) {
  const U = wUmb(), ks = Object.keys(wJT.hexes);
  const r = mulberry(wUmbHash('jt:' + id) + 977 * ((U && U.tries[id]) || 0) + ((WG && WG.year) || 1) + (id === 'finale' && U ? 1013 * (U.finale || 0) : 0));
  const out = []; while (out.length < Math.min(Math.max(0, n), ks.length)) { const k = ks[Math.floor(r() * ks.length)]; if (!out.includes(k)) out.push(k); }
  return out;
}
const wUmbJtHexWords = hx => hx.map(h => wJT.hexes[h]).filter(Boolean);

/* ---------- PLAY: the card, then the first course ---------- */
function wUmbJtCard(C, id, hx) {
  const ch = DB.chars[C.char], U = wUmb(), tries = (U && U.tries[id]) || 0, lvl = Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier()));
  const fin = id === 'finale' || !C.piece, T = fin ? W_UMB4J.finaleTeam : W_UMB4J.team, H = wUmbJtHexWords(hx), uo = wJT.ultOwn[W_UMB4J.champ.ult], champ = W_UMB4J.four.find(f => f.champ).n;
  const k = W_JTG.oppBonus[W_UMB4J.tier] || 0;
  // (a round of the Seal holds no piece and costs no toll)
  const toll = !C.toll ? '' : tries > 0 ? ` This match costs the toll, ${C.toll} gold, as it starts.` : ` The first match is free; after a loss, each costs a toll of ${C.toll} gold.`;
  const prize = fin ? `Win, and ${esc(W_UMB_PIECES[C.piece].n)} is yours.` : `Win, and ${esc(W_UMB_PIECES[C.piece].n)} is yours, with ${C.gold} gold.${toll}`;
  const close = modal(`<header><h3>${esc(ch.name)}</h3></header><div class="wmsg">
    <p><b>${fin ? 'The Seal: jousting' : 'The Hollow Lists'}: tier U.</b> Jousting against ${esc(T.name)}: level ${lvl}, in umbral form${k ? ` (${k} rating point${k === 1 ? '' : 's'} on each of their four)` : ''}, their courses called by a ${esc(W_BALL_SKILL[wListsSkillOf(W_UMB4J.tier)[1]])}, who reads the rider in front of it as they are and rides with surer hands than any Archmage, and a full bag of potions. ${esc(champ)} rides the second heat and the tilt for the crown, and once a match rides ${esc(uo.n)}: ${esc(uo.desc)} No wind on the Hollow Lists, and the sand never ruts.</p>
    <p class="hint wumbpg"><b>Hexes:</b> ${H.length ? H.map(h => `${esc(h.n)} (${esc(h.d)})`).join(' ') : 'none'}</p>
    <p class="hint">${prize} Always two heats of ${wJT.rules.courses} courses, and the tilt for the crown if level. <b>Play</b>: you ride every course of yours. <b>Manage</b>: your riders ride on their ratings; the plan and your squires' jobs are your calls. <b>Simulate</b>: the result now.</p></div>
    <div class="row"><button class="btn" data-ujt="play">Play</button><button class="ghost" data-ujt="manage">Manage</button><button class="ghost" data-ujt="sim">Simulate</button><button class="ghost" id="wUjtNo">Not now</button></div>`, () => wDrain());
  $('modalBox').querySelectorAll('[data-ujt]').forEach(b => b.onclick = () => { close(); const why = wUmbJtKick(C, id, hx, b.dataset.ujt); if (why) wLog(why, 'b'); });
  $('wUjtNo').onclick = () => close();
  const f = $('modalBox').querySelector('[data-ujt="play"]'); if (f) f.focus();
}
// why your team can't joust the champion now, or ''
function wUmbJtWhy() { const probs = wListsProblems(); if (probs.length) return probs.join(' '); return wListsLive() ? 'Finish the jousting match you started first.' : ''; }
// the first course: the toll (on a retry), the hexes in the log, and the Realm's jousting match at tier U ('' when it started)
function wUmbJtKick(C, id, hx, how) {
  const why = wUmbJtWhy(); if (why) return why;
  wUmbTollAtKickoff(id);
  const H = wUmbJtHexWords(hx);
  if (H.length) wLog(`${DB.chars[C.char].name.split(',')[0]} draws the hexes: ${H.map(h => `${h.n} (${h.d})`).join(' ')}`, 'b');
  WU4J.next = hx.slice();
  // (the champion's match is the standard length, whatever Settings says: as the rules say and the lab measured)
  const c0 = SET.listsCourses; SET.listsCourses = wJT.rules.courses;
  try { return wStartLists({ club: id === 'finale' ? W_UMB4J.finaleClub : W_UMB4J.club, how, tier: W_UMB4J.tier, kind: W_UMB4J.kind, ref: { id }, cup: true }); }
  finally { WU4J.next = null; if (c0 === undefined) delete SET.listsCourses; else SET.listsCourses = c0; }
}
W_UMB4.live.lists = () => wListsLive();
W_UMB4.start.lists = function (C, id) {
  // (a match left half-played picks up where it was, here as anywhere, and nothing else opens)
  if (wListsLive()) { wResumeLists(); return ''; }
  const why = wUmbJtWhy(); if (why) return why;
  // (a round of the Seal draws exactly its own count)
  const hx = wUmbJtHexes(id, C.hexes != null ? C.hexes : 1);
  if (LAB) return wUmbJtKick(C, id, hx, W_UMB4J.labHow);
  wUmbJtCard(C, id, hx);
  return '';
};
// the end: the piece (or the finale's round), or a try counted (the finale's entry is rebuilt by u5 after a reload, so
// no check on W_NADIR here)
W_ON_END[W_UMB4J.kind] = function (r, ref) { if (ref && ref.id) wUmbNadirEnd(ref.id, r === 'win' ? 'win' : 'lose'); };

/* ---------- on screen ---------- */
// the hexes on the bar and in the board's caption, while a Nadir match is on
// (the match is the live one from the moment it is put on the lists: the board is first drawn before WJT.world is set)
const wUmbJtLiveHex = () => { const L = WG && WG.jtg && WG.jtg.live; return L && L.world.kind === W_UMB4J.kind && WJT && !WJT.over ? wJT.hex() : null; };
const wWU4JListsBarNote = wListsBarNote;
wListsBarNote = function () {
  const r = wWU4JListsBarNote.apply(this, arguments), hx = wUmbJtLiveHex(), el = $('wListsNote');
  if (hx && el) el.textContent = el.textContent.replace(/\s*\(Courses: \d+ a heat from the next match; this one is \d+\.\)/, '') + ` The Umbral, tier U. Hexes: ${hx.ids.map(h => wJT.hexes[h].n).join(', ')}.`;
  return r;
};
const wWU4JListsBoard = wListsBoard;
wListsBoard = function () {
  const r = wWU4JListsBoard.apply(this, arguments), hx = wUmbJtLiveHex(), cap = hx && document.querySelector('#wListsBoard caption');
  if (cap) cap.insertAdjacentHTML('beforeend', ` <small class="wumbpg">${esc(wJT.hexLine())}</small>`);
  return r;
};
// after a Hardcore journey ends on the finale's lost round, the jousting result card stays off the end screen
const wWU4JListsResultCard = wListsResultCard;
wListsResultCard = function () { if ((RUN && RUN.over) || UI.screen === 'end') return; return wWU4JListsResultCard.apply(this, arguments); };

/* ---------- How to play: a line in the Umbral's section (u6 writes the section, after this part: it calls this) ---------- */
const wUmbJtHelp = () => `<p class="hint" id="wHelpUmbLists"><b>The Hollow Lists.</b> The Tilting Lists' dark mirror, by Mossgrave: Isolde Grave, the Pale Rider, holds the Splintered Lance. Her side jousts at your level with a point more on every rider, a full bag, and a Lich calling their courses, with surer hands than an Archmage and odds reckoned against the rider in front of it. Always two heats of ${wJT.rules.courses} courses; no wind, and the sand never ruts. She rides the second heat and the tilt for the crown, and once a match the Pale Charge. Her hexes: ${Object.values(wJT.hexes).map(x => `<b>${esc(x.n)}</b> (${esc(x.d)})`).join(' ')} An Umbral opened before she came asks only for the nine pieces it opened with: her lance can still be won, and sings like the rest.</p>`;

/* ---------- an Umbral opened before jousting's champion: the nine it opened with ---------- */
const wWU4JStart2 = wStart;
wStart = function (save) {
  const r = wWU4JStart2.apply(this, arguments), U = WG && WG.umbral;
  if (U && !Array.isArray(U.need)) { U.need = W_UMB_NINE.slice(); wSave(); }
  return r;
};
