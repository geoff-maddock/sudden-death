/* u4f: golf in the Umbral (issue #99, phase 4f). Loads after u4-grounds.js; changes earlier parts only by reassignment
   (saved originals carry the wWU4F prefix). The engine's side is src/gl/parts/14-umbral.js: the Lich (CPU skill 3)
   and the hexes (opts.hexes).

   Tier U on the course is tier 4 in golf's tables: W_LKG.oppBonus[4] rating points on each of their four, the Lich
   caddying for them (W_BALL.diff[4] = 3, the skill every engine reads by tier, named in W_BALL_SKILL), and a full bag
   (W_LINKS_KIT.opp[4]). Tiers 1 to 3 are as they were.
   The champion of the Hollow Links (u:g_links, the Rotwold): Sexton Vale, the Last Caddie, holds the Hollow Flag. Past
   the two guards and the gate (u4), PLAY opens the game card (wUmbGlCard): tier U, the Nadir four (W_UMB4F.four, at
   your team's level, the champion with an ultimate of their own, The Hollow Flag; W_UMB4F.champ.more points on top), the
   hexes for this try, and Play, Manage or Simulate. The match is the Realm's own golf match (wStartLinks: save and
   leave, resume after a reload, Concede, the scorecard) against club 'nadir:links' at tier 4 with kind 'unadirgl': its
   end goes to wUmbNadirEnd (a golf match never ends level: a playoff settles it). Your four are caddied as a Knight in
   Manage and Simulate, against the Lich, with the same hexes, so Simulate is no way round them. The toll, on a retry,
   is paid at the real start (wUmbTollAtKickoff); backing away from the card costs nothing.
   Hexes: golf's own (wGL.hexes, the engine's table), W_NADIR.links.hexes of them, drawn for each try by wUmbGlHexes
   (fixed for the try: a reload doesn't redraw them), named on the card, in the log, over the first tee, on the hole
   card all game and on the bar. In LAB mode PLAY skips the card and plays W_UMB4F.labHow (Simulate) at once.
   The finale (u5) drives the same adapter with id 'finale' (no piece, no toll).

   W_UMB4F, wUmbGlFour, wUmbGlHexes, wUmbGlCard, wUmbGlKick; W_NADIR.links, DB.chars.nadir_links, W_UMB4.start.links,
   W_UMB4.live.links (PLAY with a golf match left half-played resumes it), W_ON_END.unadirgl
   Wraps: wBallTeam (wWU4FBallTeam: the Nadir four's colours), wLinksOpp (wWU4FLinksOpp: the Nadir four), wGL.start and
   wGL.simGame (wWU4FStart, wWU4FSimGame: the hexes go in), wLinksBarNote (wWU4FLinksBarNote: the hexes on the bar),
   wLinksResultCard (wWU4FLinksResultCard: never over the end screen of a journey the finale ended). */

const W_UMB4F = {
  id: 'links', club: 'nadir:links', kind: 'unadirgl', tier: 4, labHow: 'sim',
  team: { name: 'Hollow Links Nadir', short: 'NDR', color: '#3a2a4a', light: '#b6ff6a' },
  // the four, in their roles' order (tee, approach, short game, putting); the champion's more points and own ultimate
  four: [{ n: 'Ashgrove', kind: 'vampire' }, { n: 'Sexton Vale', kind: 'wraith', champ: true }, { n: 'Old Loam', kind: 'witch' }, { n: 'Mirebell', kind: 'spider' }],
  champ: { more: 0, ult: 'hollowflag' },
};
// tier U in golf's tables (W_BALL.diff and W_BALL_SKILL are shared with the other sports' tier U: set once)
W_LKG.oppBonus[4] = 1;
W_LINKS_KIT.opp[4] = { draught: 2, glstill: 1, glmoss: 1, gloil: 1 };
if (W_BALL.diff[4] == null) W_BALL.diff[4] = 3;
if (!W_BALL_SKILL[3]) W_BALL_SKILL[3] = 'Lich';

W_NADIR.links = { piece: 'golf', char: 'nadir_links', ground: 'g_links', map: 'u:g_links', region: 'bloom', engine: 'links', hexes: 1, toll: 30, gold: 100 };
DB.chars.nadir_links = { name: 'Sexton Vale, the Last Caddie', kind: 'wraith', look: { coat: '#2e3a28', acc: 'hat' },
  greet: 'Nobody finishes a round here. They just stop playing. I keep the FLAG on the last green. Say PLAY when you want to try for it, and ask about the RULES first. They change.',
  topics: {
    job: { t: 'I caddied on these links when they were green. I still do. Every round on this side ends on my last hole.' },
    flag: { t: 'The Hollow Flag. One ninth of your Seal, and it flies on a green nobody has ever reached in regulation. Beat my four at golf and it is yours. Lose, and the next round costs a TOLL.' },
    rules: { t: 'Match play, captain\'s choice, your four against my four, one ball a side. My side plays at your level and better at everything, a Lich carries our bag and reads every green for us, and we bring a full bag of potions. Before the first tee I draw the HEXES.' },
    hexes: { t: 'A green that will not lie still. A cup that wanders off. Fog over the flag. A wind that turns while you swing. One of them, for you. You will hear which before the first tee.' },
    hollow: { t: 'Once a round I let the flag go hollow. Your reads come up short, and your hands shake on the putts. Mind it.' },
    toll: { t: 'Thirty gold a round, after the first. Paid on the first tee. Walking away from the card costs nothing.' },
    play: { t: 'Then pick your four.', act: 'unadir:links' },
  } };

/* ---------- the Nadir four ---------- */
// at your team's level (level parity), tier U's points on each (spread as wLinksOpp spreads a tier's), the champion
// with W_UMB4F.champ.more points more and their own ultimate
function wUmbGlFour(lvl) {
  const L = lvl != null ? lvl : Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier())), k = W_LKG.oppBonus[W_UMB4F.tier] || 0, X = W_UMB4F.champ;
  const roster = W_UMB4F.four.map((f, j) => {
    const p = wLinksPlayer(wMakePlayer({ kind: f.kind, lvl: L, n: f.n }, 'opp')), n = k + (f.champ ? X.more : 0);
    p.n = f.n;
    for (let i = 0; i < n; i++) { const s = wGL.stats[(i * 5 + j) % wGL.stats.length]; p.r[s] = Math.min(wGL.cap, p.r[s] + 1); }
    if (f.champ) p.ult = X.ult;
    return p;
  });
  const T = W_UMB4F.team;
  return { name: T.name, short: T.short, color: T.color, roster, roles: { tee: 0, approach: 1, short: 2, putt: 3 } };
}
const wWU4FBallTeam = wBallTeam;
wBallTeam = function (club) { if (club === W_UMB4F.club) { const T = W_UMB4F.team; return { name: T.name, short: T.short, color: T.color, dark: tint(T.color, -.6), light: T.light, motto: '' }; } return wWU4FBallTeam.apply(this, arguments); };
const wWU4FLinksOpp = wLinksOpp;
wLinksOpp = function (club, tier) { return club === W_UMB4F.club ? wUmbGlFour() : wWU4FLinksOpp.apply(this, arguments); };

/* ---------- the hexes ---------- */
const WU4F = { next: null };
const wWU4FStart = wGL.start, wWU4FSimGame = wGL.simGame;
wGL.start = o => wWU4FStart(WU4F.next ? Object.assign({}, o, { hexes: wUmbTakeHex(WU4F), hexOn: 0 }) : o);
wGL.simGame = o => wWU4FSimGame(WU4F.next ? Object.assign({}, o, { hexes: wUmbTakeHex(WU4F), hexOn: 0 }) : o);
// n of golf's hexes for this try of the champion: fixed for the try (the same draw after a reload)
function wUmbGlHexes(id, n) {
  const U = wUmb(), ks = Object.keys(wGL.hexes), r = mulberry(wUmbHash('gl:' + id) + 977 * ((U && U.tries[id]) || 0) + ((WG && WG.year) || 1));
  const out = []; while (out.length < Math.min(Math.max(0, n), ks.length)) { const k = ks[Math.floor(r() * ks.length)]; if (!out.includes(k)) out.push(k); }
  return out;
}
const wUmbGlHexWords = hx => hx.map(h => wGL.hexes[h]).filter(Boolean);

/* ---------- PLAY: the card, then the first tee ---------- */
function wUmbGlCard(C, id, hx) {
  const ch = DB.chars[C.char], U = wUmb(), tries = (U && U.tries[id]) || 0, lvl = Math.max(1, Math.min(W_PARTY.maxLvl, wNineTier()));
  const H = wUmbGlHexWords(hx), uo = wGL.ultOwn[W_UMB4F.champ.ult], champ = W_UMB4F.four.find(f => f.champ).n, piece = W_UMB_PIECES[C.piece];
  const toll = !C.toll ? '' : tries > 0 ? `This round costs the toll, ${C.toll} gold, on the first tee.` : `The first round is free; after a loss, each costs a toll of ${C.toll} gold.`;
  const close = modal(`<header><h3>${esc(ch.name)}</h3></header><div class="wmsg">
    <p><b>The Hollow Links: tier U.</b> Golf against the ${esc(W_UMB4F.team.name)}: level ${lvl}, in umbral form (${W_LKG.oppBonus[W_UMB4F.tier]} rating point${W_LKG.oppBonus[W_UMB4F.tier] === 1 ? "" : "s"} on each of their four), their bag carried by a ${esc(W_BALL_SKILL[wLinksSkill(W_UMB4F.tier)[1]])}, who weighs every shot before they play it and reads the greens better than any caddie you have met, and a full bag of potions. ${esc(champ)} plays for them, and once a round lets ${esc(uo.n)} fly: ${esc(uo.desc)}</p>
    <p class="hint wumbpg"><b>Hexes:</b> ${H.length ? H.map(h => `${esc(h.n)} (${esc(h.d)})`).join(' ') : 'none'}</p>
    <p class="hint">Win, and ${C.piece ? `${esc(piece.n)} is yours, with ${C.gold} gold` : `${esc(piece.n)} is yours`}. ${toll} A golf match never ends level. <b>Play</b>: you swing every shot. <b>Manage</b>: you call the line and the stances; your four swing. <b>Simulate</b>: the result now.</p></div>
    <div class="row"><button class="btn" data-ugl="play">Play</button><button class="ghost" data-ugl="manage">Manage</button><button class="ghost" data-ugl="sim">Simulate</button><button class="ghost" id="wUglNo">Not now</button></div>`, () => wDrain());
  $('modalBox').querySelectorAll('[data-ugl]').forEach(b => b.onclick = () => { close(); const why = wUmbGlKick(C, id, hx, b.dataset.ugl); if (why) wLog(why, 'b'); });
  $('wUglNo').onclick = () => close();
  const f = $('modalBox').querySelector('[data-ugl="play"]'); if (f) f.focus();
}
// why your team can't play the champion now, or ''
function wUmbGlWhy() { const probs = wLinksProblems(); if (probs.length) return probs.join(' '); return wLinksLive() ? 'Finish the golf match you started first.' : ''; }
// the first tee: the toll (on a retry), the hexes in the log, and the Realm's golf match at tier U ('' when it started)
function wUmbGlKick(C, id, hx, how) {
  const why = wUmbGlWhy(); if (why) return why;
  if (typeof wUmbTollAtKickoff === 'function') wUmbTollAtKickoff(id);
  const H = wUmbGlHexWords(hx);
  if (H.length) wLog(`${DB.chars[C.char].name.split(',')[0]} draws the hexes: ${H.map(h => `${h.n} (${h.d})`).join(' ')}`, 'b');
  WU4F.next = hx.slice();
  try { return wStartLinks({ club: W_UMB4F.club, how, tier: W_UMB4F.tier, kind: W_UMB4F.kind, ref: { id, hexes: hx.slice() }, cup: true }); } finally { WU4F.next = null; }
}
W_UMB4.live.links = () => wLinksLive();
W_UMB4.start.links = function (C, id) {
  // (a match left half-played picks up where it was, here as anywhere, and nothing else opens)
  if (wLinksLive()) { wResumeLinks(); return ''; }
  const why = wUmbGlWhy(); if (why) return why;
  const hx = wUmbGlHexes(id, C.hexes || 1);
  if (LAB) return wUmbGlKick(C, id, hx, W_UMB4F.labHow);
  wUmbGlCard(C, id, hx);
  return '';
};
// the end: the piece, or a try counted (the finale's entry is rebuilt by u5 after a reload, so no check on W_NADIR here)
W_ON_END[W_UMB4F.kind] = function (r, ref) { if (ref && ref.id) wUmbNadirEnd(ref.id, r === 'win' ? 'win' : 'lose'); };

/* ---------- on screen ---------- */
// the bar: the hexes, while a Nadir match is on
const wWU4FLinksBarNote = wLinksBarNote;
wLinksBarNote = function () {
  const r = wWU4FLinksBarNote.apply(this, arguments), L = WG && WG.lkg && WG.lkg.live, hx = L && L.world.kind === W_UMB4F.kind && wGL.hex();
  if (hx && WGL && !WGL.over && $('wLinksNote')) $('wLinksNote').textContent += ` The Umbral, tier U. Hexes: ${hx.ids.map(h => wGL.hexes[h].n).join(', ')}.`;
  return r;
};
// after a Hardcore journey ends on the finale's lost round, the golf result card stays off the end screen
const wWU4FLinksResultCard = wLinksResultCard;
wLinksResultCard = function () { if (RUN && RUN.over) return; return wWU4FLinksResultCard.apply(this, arguments); };
// (the Lich is the Umbral's only: the light-side caddie picker keeps its three)
{ const o = document.querySelector('#wLinksSkill option[value="3"]'); if (o) o.remove(); }
