/* u4c: boxing in the Umbral (issue #99, phase 4c). Loads after u4-grounds.js; changes earlier parts only by
   reassignment (saved originals carry the wWU4C prefix). The engine's side is src/bx/: the Lich (06-cpu.js, CPU skill
   3) and the hexes (14-hexes.js, opts.hexes).

   Tier U is tier 4 in the ring's tables: the other corner's rating bonus (W_BXG.oppBonus[4]), a full bag
   (W_RING_KIT.opp[4]) and the Lich in their corner (W_BALL.diff[4] = 3, the skill every engine reads by tier; named
   in W_BALL_SKILL). Tiers 1 to 3 are as they were.
   The champion: Brakka Knell, the Broken Bell, at the far end of the Broken Ring (u:g_ring, the Ashmaw), holds the
   Broken Bell. PLAY (past the guards, with an Emberpepper handed over: u4) opens a card of three bouts against the
   Nadir, as a card against a club opens (the pairing; Play, Manage or Simulate; save and resume as any card): two
   Nadir boxers and Brakka in the main event, every one in umbral form (drawn in shadow) at tier U, with the Lich in
   their corner. Brakka brings their own powers and nature (W_UMB4C.champ: the engine's f.pw and f.tr) and more on
   their ratings. The card draws its hexes from the engine's table (wUmbRingHexes: fixed for the try, so a reload
   doesn't redraw them), named on the pairing, in the log before the first bell and on the scoreboard. The toll for a
   retry is paid at the real kickoff (Play, Manage or Simulate picked); backing out of the pairing costs nothing.
   The card is settled as any card (XP, gold and fans by tier 4), then W_ON_END.unbox reports it to wUmbNadirEnd: a
   won card pays the piece, a lost or drawn one counts a try.

   W_UMB4C, wUmbRingHexes, wUmbRingSide; W_NADIR.ring, DB.chars.nadir_ring, W_UMB4.start.ring, W_ON_END.unbox
   Wraps: wBX.cardStart and wBX.simCard (wWU4CCardStart, wWU4CSimCard: the hexes go in), wBallName (wWU4CBallName:
   the Nadir by name), wRingTapeOf (wWU4CRingTapeOf: a champion's own powers and nature on the tape), wRingPairing
   (wWU4CRingPairing: the same on the pairing), wRingBarNote (wWU4CRingBarNote: the hexes on the ring bar). */

const W_UMB4C = {
  tier: 4,
  // the Nadir's corner, and its two boxers before the main event
  side: { name: 'The Nadir', short: 'NDR', color: '#3a2a4a', light: '#c8b8ff' },
  seconds: [['Old Clapper', 'ogre'], ['Soot Wick', 'dwarf']],
  // the champion: their kind, the points on top of tier U's, and what is theirs alone (the engine's pw and tr)
  champ: { n: 'Brakka Knell', kind: 'minotaur', more: 0,
    pw: {
      sp: { id: 'deathknell', n: 'Death Knell', when: 'close', desc: 'A blow that rings through the guard (8), and they reel for half a second.', now: { dmg: 8, stun: .5 } },
      ult: { id: 'lastbell', n: 'The Last Bell', when: 'any', desc: 'The bell tolls for them: for 6 seconds they get no breath back, and punches at them do 20% more.', fx: { who: 'them', t: 6, noReg: 1, dmgIn: 1.2 } },
    },
    tr: { n: 'Cracked Bronze', desc: 'Rings, but never breaks: it beats every count a second sooner, and counters hurt it less.', rise: -1, ctrTaken: .85 } },
};
// tier U in the ring's tables (W_BALL's are shared by every engine: set once, by whichever sport loads first)
if (W_BALL.diff[W_UMB4C.tier] == null) W_BALL.diff[W_UMB4C.tier] = 3;
if (W_BALL_SKILL[3] == null) W_BALL_SKILL[3] = 'Lich';
W_BXG.oppBonus[W_UMB4C.tier] = 3;
W_RING_KIT.opp[W_UMB4C.tier] = { draught: 1, cutsalve: 1, smellsalts: 1, ragetonic: 1 };

/* ---------- the champion ---------- */
W_NADIR.ring = { piece: 'boxing', char: 'nadir_ring', ground: 'g_ring', map: 'u:g_ring', region: 'ember', engine: 'ring', hexes: 2, toll: 30, gold: 100 };
DB.chars.nadir_ring = { name: 'Brakka Knell, the Broken Bell', kind: 'minotaur', look: { coat: '#3a2a4a' },
  greet: 'Every bell on this side rang once for somebody, and then it cracked. I hold the BELL. Say PLAY when you want to hear it ring for you. Ask about the RULES first, if you like.',
  topics: {
    job: { t: 'I box. I have boxed every fool who walked down this ring since the bell broke. None of them heard the end of the third round.' },
    bell: { t: 'The Broken Bell. One ninth of your Seal. Win the card and it is yours. Lose, and the next card costs you a TOLL.' },
    rules: { t: 'Three bouts, as in your Anvil Ring: two of my Nadir, then me. Everything here is harder. My boxers are stronger than yours, my corner is cleverer than any you have met, and before the bell I draw the HEXES. One or two, for you.' },
    hexes: { t: 'A ring that closes in. Bad water in your bucket. Heavy gloves. A quick count. You will hear which before the bell.' },
    toll: { t: 'Thirty gold a card, after the first. The first is free. The bell does not ring for nothing twice.' },
    play: { t: 'Then glove up.', act: 'unadir:ring' },
  } };

// a try's hexes: one or two (up to n) from the engine's table, fixed for the try (so a reload doesn't redraw them)
function wUmbRingHexes(id, n) {
  const U = wUmb(), ks = Object.keys(wBX.hexes), r = mulberry(wUmbHash(id + ':ring') + 977 * ((U && U.tries[id]) || 0) + ((WG && WG.year) || 1));
  // (one or two for Brakka's own card; a round of the Seal draws exactly its count)
  const many = id === 'finale' ? Math.min(ks.length, n) : Math.min(ks.length, 1 + Math.floor(r() * Math.max(1, n)));
  const out = []; while (out.length < many) { const k = ks[Math.floor(r() * ks.length)]; if (!out.includes(k)) out.push(k); }
  return out;
}
// the Nadir's three, at your team's level (level parity) with tier U's points, in umbral form; the champion last
function wUmbRingSide(C, taken) {
  const lvl = wNineTier(), k = W_BXG.oppBonus[W_UMB4C.tier] || 0, X = W_UMB4C.champ;
  const fighters = W_UMB4C.seconds.concat([[X.n, X.kind]]).map(([n, kind], j) => {
    const p = wMakePlayer({ kind, lvl, n }, 'opp'), f = wBxFighter(p), more = j === 2 ? X.more : 0;
    taken.add(f.n); f.pid = null; f.umb = 1;
    for (let i = 0; i < k + more; i++) { const s = wBX.stats[(i * 5 + j) % wBX.stats.length]; f.r[s] = Math.min(W_BXG.cap, f.r[s] + 1); }
    if (j === 2) { f.pw = JSON.parse(JSON.stringify(X.pw)); f.tr = JSON.parse(JSON.stringify(X.tr)); f.sp = 'sp'; f.champ = 1; }
    return f;
  });
  return Object.assign({}, W_UMB4C.side, { fighters });
}

/* ---------- the adapter: PLAY ---------- */
const WU4C = { hexes: null };
W_UMB4.start.ring = function (C, id) {
  const probs = wRingProblems(); if (probs.length) return probs.join(' ');
  if (wBxg().live) { wResumeRing(); return ''; } // (a card left half-fought picks up where it was)
  const hexes = wUmbRingHexes(id, C.hexes || 1), taken = new Set(), mine = wRingSide(taken), theirs = wUmbRingSide(C, taken), ch = DB.chars[C.char];
  const o = { club: 'nadir', tier: W_UMB4C.tier, kind: 'unbox', ref: { id }, cup: true };
  // the real kickoff: the toll for a retry (once a try), then the card, with its hexes
  const go = (picks, how) => {
    if (wBxg().live) return;
    if (typeof wUmbTollAtKickoff === 'function') wUmbTollAtKickoff(id);
    WU4C.hexes = hexes;
    try { wRingGo(Object.assign({}, o, { how }), mine, theirs, picks); } finally { WU4C.hexes = null; }
  };
  if (LAB) { go(wBX.cardAuto(mine.fighters, theirs.fighters), 'sim'); return ''; }
  const hx = hexes.map(h => `<b>${esc(wBX.hexes[h].n)}</b> (${esc(wBX.hexes[h].desc)})`).join(' ');
  WRK.tier = W_UMB4C.tier;
  try {
    wRingPairing({ mine, theirs, title: `${ch.name}: a card for ${W_UMB_PIECES[C.piece].n}`, go: [['Play', 'play'], ['Manage', 'manage'], ['Simulate', 'sim']],
      intro: `Three bouts, one fighter each, and each fighter boxes once: two of the Nadir, then ${esc(ch.name)} in the main event. <b>The Umbral: tier U.</b> Their boxers are level ${wNineTier()} with more on every rating, in umbral form, and their corner is a ${W_BALL_SKILL[wRingSkill(W_UMB4C.tier)[1]]}. <span data-umbhex><b>Hexes:</b> ${hx}</span> Win the card and ${esc(W_UMB_PIECES[C.piece].n)} is yours. <b>Play</b>: your corner, and you box the rounds. <b>Manage</b>: your corner; your fighters box. <b>Simulate</b>: the result now.`,
      onGo: go });
  } finally { WRK.tier = null; }
  return '';
};
// the end of the card: the piece, or a try counted (a drawn card is not a win)
W_ON_END.unbox = function (r, ref) { if (ref && ref.id) wUmbNadirEnd(ref.id, r === 'win' ? 'win' : 'lose'); };

// the hexes go in with the card, and the card in the world keeps them
const wWU4CCardStart = wBX.cardStart, wWU4CSimCard = wBX.simCard;
wBX.cardStart = o => {
  if (!WU4C.hexes) return wWU4CCardStart(o);
  const L = wBxg().live; if (L) L.world.hexes = WU4C.hexes.slice();
  return wWU4CCardStart(Object.assign({}, o, { hexes: WU4C.hexes.slice(), hexOn: 0 }));
};
wBX.simCard = o => WU4C.hexes ? wWU4CSimCard(Object.assign({}, o, { hexes: WU4C.hexes.slice(), hexOn: 0 })) : wWU4CSimCard(o);

/* ---------- on screen ---------- */
const wWU4CBallName = wBallName;
wBallName = function (club) { return club === 'nadir' ? 'the Nadir' : wWU4CBallName.apply(this, arguments); };
// the tape: a champion's own powers and nature
const wWU4CRingTapeOf = wRingTapeOf;
wRingTapeOf = function (f) {
  const t = wWU4CRingTapeOf(f);
  if (f && f.pw) t.P = Object.assign({}, t.P, { sp: { n: f.pw.sp.n, desc: f.pw.sp.desc }, ult: { n: f.pw.ult.n, desc: f.pw.ult.desc } });
  if (f && f.tr) t.T = { n: f.tr.n, desc: f.tr.desc };
  return t;
};
// the pairing: the same, in the champion's row
const wWU4CRingPairing = wRingPairing;
wRingPairing = function (o) {
  const r = wWU4CRingPairing(o), T = $('wRingPairT');
  if (T && o && o.theirs) T.querySelectorAll('tr:not(.wrtape)').forEach((tr, i) => {
    const f = o.theirs.fighters[i]; if (!f || !f.pw) return;
    const td = tr.querySelector('td'); if (!td) return;
    td.querySelectorAll('[data-rsppair]').forEach(e => e.remove());
    td.insertAdjacentHTML('beforeend', `<br><small data-umbchamp title="${esc(f.tr.desc)}">${esc(f.tr.n)}. Special: <b title="${esc(f.pw.sp.desc)}">${esc(f.pw.sp.n)}</b>, ultimate: <b title="${esc(f.pw.ult.desc)}">${esc(f.pw.ult.n)}</b></small>`);
  });
  return r;
};
// the ring bar: the hexes, while a Nadir card is on
const wWU4CRingBarNote = wRingBarNote;
wRingBarNote = function () {
  wWU4CRingBarNote();
  const L = wRingLive() && WG.bxg.live, H = L && L.world.hexes;
  if (WBX && H && H.length && !WBX.over) $('wRingNote').textContent += ` Hexes: ${H.map(h => wBX.hexes[h].n).join(', ')}.`;
};
// after a Hardcore journey ends on the finale's lost round, the card's result stays off the end screen
const wWU4CRingResultCard = wRingResultCard;
wRingResultCard = function () { if (RUN && RUN.over) return; return wWU4CRingResultCard.apply(this, arguments); };
