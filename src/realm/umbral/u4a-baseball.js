/* u4a: baseball in the Umbral (issue #99, phase 4a): tier U, the Lich, the hexes, the Nadir champion and the piece.
   Loads after u4-grounds.js; changes earlier parts only by reassignment (saved originals carry the wWU4A prefix).

   Tier U on the diamond is tier 4 in the ball game's tables: W_BALL.diff[4] is the Lich (Brimstone Diamond's CPU skill
   3: it reads pitches sooner, chases less, times its releases, fields and runs sharper) and W_BALL.oppBonus[4] goes on
   every rating of the other nine. Tiers 1 to 3 are as they were.
   The champion of the Bone Diamond (W_NADIR.diamond) plays you there with the Bone Nine: at your nine's level (level
   parity), tier U, the Lich on their side only (in Simulate your side plays as an Archmage, W_UMB4A.mine, so Simulate
   is no easier than facing the Lich yourself), and the champion on the mound with her own pitch, the Dead Ball.
   Her game draws its hexes from baseball's own table (W_UMB4A.hexes, the engine's HEXES), fixed for each try as the
   card game's are; the game card names them before the first pitch and the scoreboard shows them all game.
   PLAY (u4's gate open) shows that card: Play, Manage or Simulate starts the game through wStartBall (Save and leave
   and Resume work as for any ball game; a game card you back out of costs nothing), the toll is taken at the first
   pitch (wUmbTollAtKickoff), and the final goes to wUmbNadirEnd through W_ON_END.unadir_ball.

   W_UMB4A, wUmb4aHexes, wUmb4aNine, wUmb4aCard, wUmb4aGo
   Wraps: wBallTeam (wWU4ABallTeam: the Bone Nine's colours), wBallOpp (wWU4ABallOpp: the Bone Nine), wNineDef
   (wWU4ANineDef: your side's CPU skill in a Nadir game), wBallBar (wWU4ABallBar: the hexes on the bar), wUmbPlaceGround
   (wWU4APlaceGround: every champion of a ground gets a spot, not only the first). */

const W_UMB4A = {
  club: 'wild:nadir', tier: 4, mine: 2, star: 2,
  team: { name: 'Bone Nine', short: 'BON', color: '#3a2a4a', light: '#c8b8ff', motto: 'Nobody leaves the Bone Diamond with the ball.' },
  // the Bone Nine's kinds, first choice at each position
  kinds: ['skeleton', 'zombie', 'spider', 'vampire', 'wraith', 'gorgon', 'lich', 'werewolf', 'witch'],
  hexes: ['phase', 'drift', 'font', 'chill'],
  going: null, // { id } while a Nadir game is being started
};
W_BALL.diff[4] = 3; W_BALL.oppBonus[4] = 1; W_BALL_SKILL[3] = 'Lich';

/* ---------- the champion ---------- */
W_NADIR.diamond = { piece: 'baseball', char: 'nadir_diamond', ground: 'g_ballpark', map: 'u:g_ballpark', region: 'plains', engine: 'diamond', hexes: 2, toll: 30, gold: 100,
  star: { kind: 'witch', n: 'Vesper Quill', num: 13, pitches: ['deadball'] } };
DB.chars.nadir_diamond = { name: 'Vesper Quill, the Stitcher', kind: 'witch', look: { coat: '#2e2438', acc: 'hat', hair: '#d8d0e8' },
  greet: 'Another nine through the door. I keep the STITCH, and I pitch for the Bone Nine. Say PLAY when you want to try to hit me. Ask about the RULES first. Everybody should.',
  topics: {
    job: { t: 'I pitch. I have pitched every game ever played on this diamond, and I have never once been taken out of one.' },
    stitch: { t: 'The Iron Stitch. One ninth of your Seal, sewn into the oldest ball on this side of the door. Beat my nine and it is yours. Lose, and the next game costs a TOLL.' },
    rules: { t: 'Three innings, our ground, our rules. My nine play at your level, a little better at everything, and they think faster than any coach you have met. Before the first pitch I draw the HEXES: two, for you.' },
    hexes: { t: 'A pitch that goes through the bat. Bases that will not stay put. A font that never runs dry. A chill in the hands. You will see which before we start, and they stay up on the scoreboard.' },
    dead: { t: 'The Dead Ball. It leaves my hand and it is not there, and then it is, and it is late. Nobody else throws it.' },
    toll: { t: 'Thirty gold a game, after the first. You pay it when the first pitch is thrown, not before.' },
    play: { t: 'Then pick up a bat.', act: 'unadir:diamond' },
  } };

// a champion's hexes for this try, from baseball's table: fixed for the try, so a reload doesn't redraw them
function wUmb4aHexes(id, n) {
  const U = wUmb(), ks = W_UMB4A.hexes, r = mulberry(wUmbHash('bd:' + id) + 977 * ((U && U.tries[id]) || 0) + (WG.year || 1));
  const out = []; while (out.length < Math.min(n, ks.length)) { const k = ks[Math.floor(r() * ks.length)]; if (!out.includes(k)) out.push(k); }
  return out;
}

/* ---------- the Bone Nine ---------- */
/* at your nine's level, W_BALL.oppBonus[tier] on every rating, the Lich (def.diff), dark kinds first, and the champion
   on the mound: W_UMB4A.star more on every rating and her own pitch */
function wUmb4aNine(tier, id) {
  // (the finale's round has no side of its own: it is Vesper Quill's Bone Nine, her star and all)
  const C0 = W_NADIR[id || 'diamond'], C = C0 && C0.star ? C0 : W_NADIR.diamond, S = C.star, lvl = wNineTier(), k = W_BALL.oppBonus[tier] || 0, T = W_UMB4A.team;
  const used = new Set(), names = new Set([S.n]);
  const mk = (pos, as) => {
    const ks = wBD.kindsAt(pos), kind = W_UMB4A.kinds.find(x => ks.includes(x) && !used.has(x)) || ks.find(x => !used.has(x)) || pick(ks);
    used.add(kind);
    const free = (FA_NAMES[kind] || []).filter(n => !names.has(n));
    const p = wMakePlayer({ kind, lvl, n: free.length ? pick(free) : undefined }, 'opp'); names.add(p.n);
    return Object.assign(wNineBdPlayer(p, as || pos), { rid: null });
  };
  const roster = W_NINE.pos.map(pos => pos === 'P' ? null : mk(pos));
  const star = Object.assign(wNineBdPlayer(wMakePlayer({ kind: S.kind, lvl, n: S.n, num: S.num, flav: 'Has pitched every game ever played on the Bone Diamond.' }, 'opp'), 'P'), { rid: null, nadir: id || 'diamond' });
  star.pitches = (star.pitches || ['heater', 'curve']).filter(x => !S.pitches.includes(x)).concat(S.pitches);
  roster[W_NINE.pos.indexOf('P')] = star;
  const def = { id: 'nadir', name: T.name, short: T.short, color: T.color, trim: tint(T.color, -.5), light: T.light, motto: T.motto, roster, pen: [mk('P', 'RP')], diff: W_BALL.diff[tier] };
  for (const p of def.roster.concat(def.pen)) for (const s of wBD.stats) p[s] = Math.min(W_BDR.cap, p[s] + k + (p === star ? W_UMB4A.star : 0));
  return def;
}
const wWU4ABallTeam = wBallTeam;
wBallTeam = function (club) {
  if (club !== W_UMB4A.club) return wWU4ABallTeam.apply(this, arguments);
  const T = W_UMB4A.team; return { name: T.name, short: T.short, color: T.color, dark: tint(T.color, -.5), light: T.light, motto: T.motto };
};
const wWU4ABallOpp = wBallOpp;
wBallOpp = function (club, tier) { return club === W_UMB4A.club ? wUmb4aNine(tier, W_UMB4A.going && W_UMB4A.going.id) : wWU4ABallOpp.apply(this, arguments); };
const wWU4ANineDef = wNineDef;
wNineDef = function () { const d = wWU4ANineDef.apply(this, arguments); if (W_UMB4A.going) d.diff = W_UMB4A.mine; return d; };

/* ---------- PLAY: the game card, and the game ---------- */
// why your team can't play the champion now, or ''
function wUmb4aWhy() {
  const probs = wBallProblems(); if (probs.length) return probs.join(' ');
  if (wBallLive()) return 'Finish the ball game you started first.';
  return '';
}
// start the champion's game: '' when it started (for Simulate: when it is over), or why not
function wUmb4aGo(id, hexes, how) {
  const why = wUmb4aWhy(); if (why) return why;
  // the toll, at the first pitch: once you have chosen to play, before any result
  if (typeof wUmbTollAtKickoff === 'function') wUmbTollAtKickoff(id);
  const keep = W_BALL.rules;
  W_UMB4A.going = { id }; W_UMB4A.keep = keep;
  // the hexes ride on the game's rules (kept in its snapshot); the Bone Nine are at home (side 1) and cast them
  W_BALL.rules = Object.assign({}, keep, { hexes: hexes.slice(), hexBy: 1 });
  try {
    return wStartBall({ club: W_UMB4A.club, how, home: false, tier: W_UMB4A.tier, kind: 'unadir_ball', ref: { id, hexes: hexes.slice() }, cup: true });
  } finally { W_BALL.rules = keep; W_UMB4A.going = null; W_UMB4A.keep = null; }
}
function wUmb4aCard(C0, id, hexes) {
  const C = C0.star ? C0 : Object.assign({}, W_NADIR.diamond, { char: C0.char, piece: C0.piece, toll: C0.toll }), ch = DB.chars[C.char], HX = wBD.hexes(), U = wUmb(), tries = (U && U.tries[id]) || 0;
  const close = modal(`<header><h3>${esc(ch.name)}</h3><button class="ghost" data-close>Not yet</button></header>
    <div class="wmsg"><p><b>The Bone Diamond: the ${esc(W_UMB4A.team.name)}.</b> ${W_BALL.innings} innings for ${esc(C.piece ? W_UMB_PIECES[C.piece].n : 'a round of the Seal')}.</p>
    <p class="hint wumbpg"><b>The Umbral: tier U.</b> Their players are level ${wNineTier()}, your nine's level, with ${W_BALL.oppBonus[W_UMB4A.tier]} more on every rating, and the CPU plays them as a ${W_BALL_SKILL[W_BALL.diff[W_UMB4A.tier]]}: it reads your pitches sooner, chases less and fields and runs sharper. ${esc(C.star.n)} pitches, with her own Dead Ball.</p>
    <p class="hint wumbpg" id="wUmbHexes"><b>Hexes:</b> ${hexes.map(h => `${esc(HX[h].n)} (${esc(HX[h].d)})`).join(' ')}</p>
    <p class="hint">${!C.toll ? '' : tries > 0 ? `This game costs the toll, ${C.toll} gold, at the first pitch. ` : 'The first game is free; the next costs a toll. '}<b>Play</b>: you pitch, swing and run. <b>Manage</b>: your players cast their own powers. <b>Simulate</b>: the result now.</p></div>
    <div class="row">${Object.keys(W_BALL_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-uhow="${how}">${W_BALL_HOW[how]}</button>`).join('')}</div>`);
  $('modalBox').querySelectorAll('[data-uhow]').forEach(b => b.onclick = () => {
    close();
    const why = wUmb4aGo(id, hexes, b.dataset.uhow); if (why) wLog(why, 'b');
  });
  const b0 = $('modalBox').querySelector('[data-uhow="play"]'); if (b0) b0.focus();
}
// u4's adapter: the card (or, for the bots, a Simulated game at once). The hexes u4 passes are the card game's: baseball draws its own.
W_UMB4.start.diamond = function (C, id) {
  // (a game left half-played picks up where it was, here as anywhere, and nothing else opens)
  if (wBallLive()) { wResumeBall(); return ''; }
  const why = wUmb4aWhy(); if (why) return why;
  const hx = wUmb4aHexes(id, C.hexes || 1);
  if (LAB) return wUmb4aGo(id, hx, 'sim');
  wUmb4aCard(C, id, hx);
  return '';
};
// the final: a win pays the piece, a loss counts a try (wBallSettle has paid the ball game's own XP, gold and fans)
W_ON_END.unadir_ball = function (r, ref) {
  // (always reported: the finale's entry is rebuilt by u5 if a reload lost it)
  if (!ref || !ref.id) return;
  wUmbNadirEnd(ref.id, r === 'win' ? 'win' : 'lose');
};
// after a Hardcore journey ends on the finale's lost round, the ball game's result card stays off the end screen
const wWU4ABallResultCard = wBallResultCard;
wBallResultCard = function () { if (RUN && RUN.over) return; return wWU4ABallResultCard.apply(this, arguments); };

/* ---------- the bar above the field ---------- */
const wWU4ABallBar = wBallBar;
wBallBar = function () {
  const r = wWU4ABallBar.apply(this, arguments), L = WG && WG.ball && WG.ball.live;
  if (L && L.world && L.world.kind === 'unadir_ball' && WD && WD.ball && wBD.G.teams) {
    const HX = wBD.hexes(), hx = (L.world.ref && L.world.ref.hexes) || [];
    $('wDiamondNote').textContent += ` The Umbral, tier U. Hexes: ${hx.map(h => HX[h] ? HX[h].n : h).join(', ')}.`;
  }
  return r;
};

/* ---------- more than one champion on a ground ---------- */
// u4 puts the first champion of a ground at its far end; any other stands beside them
const wWU4APlaceGround = wUmbPlaceGround;
wUmbPlaceGround = function (g) {
  const r = wWU4APlaceGround.apply(this, arguments), m = MAPS['u:' + g]; if (!m) return r;
  const champs = Object.keys(W_NADIR).filter(k => W_NADIR[k].ground === g), first = champs.length && m.npcs.find(n => n.id === W_NADIR[champs[0]].char);
  if (!first) return r;
  const taken = (x, y) => m.npcs.some(n => n.x === x && n.y === y), s = bfsReach(m, m.spawn[0], m.spawn[1]);
  const ok = (x, y) => { const c = m.t[y] && m.t[y][x], td = c && DB.tiles[c]; return td && td.walk && !td.enter && !taken(x, y) && !m.meta[x + ',' + y] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s[(y + dy) * m.w + x + dx]); };
  for (const k of champs.slice(1)) {
    const C = W_NADIR[k]; if (m.npcs.some(n => n.id === C.char)) continue;
    let at = null; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) if (!at && ok(first.x + dx, first.y + dy)) at = [first.x + dx, first.y + dy];
    if (at) m.npcs.push({ id: C.char, x: at[0], y: at[1], fixed: true });
  }
  return r;
};
// (the game's options carry the hexes from here: the shared rules go back the moment the engine starts, so a game the
// world plays in the same moment, a league or cup sim across a midnight, never picks them up)
const wWU4ABdSim = wBD.sim, wWU4ABdStart = wBD.start;
wBD.sim = function () { if (W_UMB4A.keep) { W_BALL.rules = W_UMB4A.keep; W_UMB4A.keep = null; } return wWU4ABdSim.apply(this, arguments); };
wBD.start = function () { if (W_UMB4A.keep) { W_BALL.rules = W_UMB4A.keep; W_UMB4A.keep = null; } return wWU4ABdStart.apply(this, arguments); };
