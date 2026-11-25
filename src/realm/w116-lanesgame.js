/* w116: bowling from the world (issue #100, phase 5). Your five bowl a rival club, or the local side, at the Saltmere
   Lanes, as golf is played (w107): Play (you bowl every ball), Manage (you call the line, the tempo and the ball, or
   leave them to your captain; your five bowl on their ratings) or Simulate (the result at once). Moll Gutter's MATCH
   and the Lanes tab open the match card: the clubs at your tier, each once a day, the exhibition and the practice as
   before. A match needs W_LNG.minOwn players of your own; call-ups fill the five. Every game at the Lanes has the hall
   (12-hall.js): the tide under the floor (the Realm's tide, wTide), Moll's hand-set racks, the swell, the gutter crabs,
   the gull and the Brinepup.
   Their five: at your level plus the tier, with W_LNG.oppBonus points spread over each; a rival keeps the same five
   until it would be a different level. Their bowlers by tier (a Squire, a Knight, an Archmage), as on the diamond.
   The result: a win pays XP to everyone who bowled (half to the rest of the team), gold and fans by tier, and the
   player of the match a little more; a loss a quarter of the XP and costs nothing else (no Team HP at the lanes). A
   bowling match never ends level (the roll-off). Every match adds your bowlers' lines to WG.lnstats, and goes in the
   head to head and the league table. Save and leave keeps the match between balls, and it is waiting when you come
   back, after a reload too. The match is kept from its first ball, and saved at once as each ball is bowled (issue
   #120): a reload never brings a ball back, and a match that has begun is never called off. It is saved at once, too,
   as you press a ball's speed (a reload before the mark bowls that ball, released late at the bottom of the meter),
   call the coach's word, the pinch bowler or the re-rack, or cast a power (wBL.onCommit): a reload gives none of them
   back. A match kept after the ball that decided it is settled as the page comes back (wLanesKeptEnd, called by w159),
   its result card shown, never left waiting. Concede counts as a loss.

   WG.lng     { live: null | { world, snap }, met: { club: dayAbs }, opp: { club: { lvl, team } }, games: [last W_LNG.keep], w, l }
              world = { kind: 'lngame', ref, club, tier, how, day, name, ids, tide }, plain data; the end dispatches
              W_ON_END[kind] (which also gets us and them: the totals, and text: "212 to 198"). ids: your five's roster
              ids in order (null for a call-up)
   WG.lnstats { pid: { g, frames, balls, strikes, spares, pins } }, this journey
   wLanesProblems(), wStartLanes({ club, how, tier?, kind?, ref? }), wResumeLanes(), wLanesLeaveGame(), wLanesConcede(),
   wOpenLanesCard(), wLanesKeptOver(), wLanesKeptEnd()
   Wraps: wLanesBarNote (wW116LanesBarNote: Save and leave and Concede in a real match), wLeaveLanes (wW116LeaveLanes),
   wBL.onOver and wBL.onPhase (a real match settles, and is kept between balls), wBL.onCommit (kept as a choice is
   committed), wLanesGame (wW116LanesGame: the hall),
   wLanesRows (wW116LanesRows: Manage's row; wW116LanesRows2: the re-rack), wRunAct (wW116RunAct: MATCH opens the card), wNextPrompt (wW116NextPrompt:
   a match waiting after a reload), wCampLanes and wRenderCamp (wW116CampLanes, wW116RenderCamp: Play a match and
   Resume on the Lanes tab), wCampStats (wW116CampStats: the Bowling view's lines), wStatsCard (wW116StatsCard: the
   lines in words), renderHelp (wW116RenderHelp: #wHelpLanesGame). */

const W_LNG = {
  minOwn: 2, xp: 12, gold: 15, fans: 3, lossShare: .25, benchShare: .5, mvpXp: 5,
  // extra rating points for each of their five, by tier (measured in phase 10: docs/realm/BALANCE.md)
  oppBonus: { 1: 1, 2: 1, 3: 1 },
  minutes: 120, keep: 10, saveMs: 12000,
  // the beats a ball is settled in (bowled and counted, still rolling): kept and saved at once
  settled: ['roll'],
};
const W_LNG_HOW = { play: 'Play', manage: 'Manage', sim: 'Simulate' };
const WLNG = { saved: 0, asked: false, msg: '', card: '' };
W_LANES_MODES.manage = { n: 'Manage', title: 'Your captain bowls your side by your call: the line, the tempo and the ball, in the row under the lanes. Your five bowl on their ratings.' };
(() => { const play = $('wLanesModes').querySelector('[data-nmode="play"]'); play.insertAdjacentHTML('beforebegin', `<button class="ghost" data-nmode="manage" title="${esc(W_LANES_MODES.manage.title)}">Manage</button>`); })();

function wLng() {
  const B = WG.lng = WG.lng || { live: null, met: {}, opp: {}, games: [], w: 0, l: 0 };
  B.met = B.met || {}; B.opp = B.opp || {}; B.games = B.games || [];
  return B;
}
function wLanesLive() { return !!(WG && WG.lng && WG.lng.live); }
function wLanesWorld() { return !!(WBL && WBL.world && wLanesLive()); }
function wLanesProblems() {
  const n = wRoster().length;
  return n < W_LNG.minOwn ? [`Recruit ${W_LNG.minOwn - n} more player${W_LNG.minOwn - n === 1 ? '' : 's'}: a bowling match needs ${W_LNG.minOwn} of your own, and call-ups fill the rest of the five.`] : [];
}
const wLanesSkillOf = tier => [1, W_BALL.diff[tier] != null ? W_BALL.diff[tier] : 1];
const wLanesTideNow = () => typeof wTide === 'function' ? wTide() : 'mid';

// a club's five: its own kinds first, at your level plus the tier with the bonus; a rival keeps the same five
function wLanesOpp(club, tier) {
  const B = wLng(), lvl = wBallOppLvl(tier), C = club === 'apex' ? Object.assign({}, W_CUP.apexTeam) : wBallTeam(club), k = W_LNG.oppBonus[tier] || 0;
  const cached = club !== 'local' && B.opp[club];
  let team;
  if (cached && cached.lvl === lvl) team = JSON.parse(JSON.stringify(cached.team));
  else {
    const rg = wBallRegion(club), own = rg ? (DB.regions[rg] || {}).kinds || [] : (C.roster || []).map(r => r[1]);
    const all = own.filter(x => wBL.stats.some(s => wBL.rate(x)[s] !== 6.5)).concat(W_BLR.cuKinds).filter((x, i, a) => a.indexOf(x) === i);
    const names = new Set(), mk = kind => {
      const rn = (C.roster || []).find(r => r[1] === kind), free = (FA_NAMES[kind] || []).filter(x => !names.has(x));
      const p = wMakePlayer({ kind, lvl, n: rn && !names.has(rn[0]) ? rn[0] : free.length ? pick(free) : undefined }, 'opp');
      names.add(p.n);
      return wLanesPlayer(p);
    };
    team = { name: C.name, short: C.short, color: C.color, roster: all.slice(0, 5).map(mk) };
    if (club !== 'local') B.opp[club] = { lvl, team: JSON.parse(JSON.stringify(team)) };
  }
  if (k) team.roster.forEach((p, j) => { const st = wBL.stats; for (let i = 0; i < k; i++) { const s = st[(i * 5 + j) % st.length]; p.r[s] = Math.min(wBL.cap, p.r[s] + 1); } });
  return team;
}
// your five for a match, named apart from theirs; ids: roster ids in order (null for a call-up)
function wLanesSquad(vs) {
  const C = wFiveSync(), team = wFiveMine(), ids = C.five.map(k => typeof k === 'number' ? k : null), theirs = new Set(vs ? vs.roster.map(p => p.n) : []);
  team.roster.forEach((p, i) => { if (ids[i] == null && theirs.has(p.n)) p.n += ' II'; });
  return { team, ids };
}

/* ---------- starting, leaving, coming back ---------- */
function wStartLanes(o) {
  if (!WG || !RUN) return '';
  const probs = wLanesProblems(); if (probs.length) return probs.join(' ');
  const B = wLng(), club = o.club;
  if (B.live) return 'Finish the bowling match you started first.';
  if (!wBallRegion(club) && !CLUBS[club] && club !== 'apex') return '';
  if (!o.cup && B.met[club] === WG.dayAbs) return `${wCap(wBallName(club))} have already bowled you today. Come back tomorrow.`;
  const how = W_LNG_HOW[o.how] ? o.how : 'play', tier = o.tier || wBallTier(club), tide = wLanesTideNow();
  const opp = wLanesOpp(club, tier), sq = wLanesSquad(opp), mine = sq.team;
  const world = { kind: o.kind || 'lngame', ref: o.ref || null, club, tier, how, day: WG.dayAbs, name: opp.name, ids: sq.ids, tide, cup: !!o.cup };
  if (!o.cup) B.met[club] = WG.dayAbs;
  B.live = { world, snap: null };
  const opts = { teams: [mine, opp], skill: wLanesSkillOf(tier), frames: wLanesFrames(), tide, hall: true, powers: true };
  if (how === 'sim') { const s = wBL.simGame(Object.assign({ seed: (Math.random() * 1e9) | 0 }, opts)); wLanesResultCard(wLanesSettle(s)); return ''; }
  wLanesGame(Object.assign({}, opts, { mode: how, title: `${mine.name} against ${opp.name}` }));
  WBL.world = true;
  // (kept from the first ball: a reload before it brings the match back, never calls it off: #120)
  B.live.snap = wBL.snapshot();
  wLanesBarNote();
  wSave();
  return '';
}
function wResumeLanes() {
  const L = wLanesLive() && WG.lng.live; if (!L) return;
  if (!L.snap) { wLanesCallOff('The match had not reached its first ball, so it is called off.'); return; }
  WBL = { over: null, world: true };
  wBL.resume(L.snap);
  $('wLanesTitle').textContent = `${L.snap.G.teams[0].name} against ${L.snap.G.teams[1].name}`;
  showView('lanes');
  wLanesBarNote(); wLanesRows(); wLanesSheet();
}
function wLanesLeaveGame() {
  const L = wLanesLive() && WG.lng.live; if (!L) return wLeaveLanes();
  // a ball bowled and still rolling (or resting) counts: a game it decided is played out and settled, and any other is
  // kept as it stands after that ball, so leaving can never bowl it again
  if (wLanesWorld() && (wBL.phase === 'roll' || wBL.phase === 'rest')) {
    if (wBL.G.over) { let n = 0; while (wLanesLive() && wBL.phase !== 'over' && n++ < 4000) wBL.tick(0.1); if (!wLanesLive()) { WBL = null; wW116LeaveLanes(); wSave(); return; } }
    else L.snap = wBL.snapshot();
  }
  const sn = L.snap;
  WLNG.asked = true;
  WBL = null; wW116LeaveLanes();
  if (!sn) return wLanesCallOff(`You leave before the first ball, so the match against ${wBallName(L.world.club)} is called off.`);
  wLog(`Your bowling match against ${wBallName(L.world.club)} is saved: ${wLanesScore(sn)}. Resume it from the Lanes tab on the Team screen.`, 'd');
  wSave();
}
function wLanesCallOff(why) {
  const B = wLng(), L = B.live; if (!L) return;
  B.live = null; if (!L.world.cup) delete B.met[L.world.club];
  wLog(why || `The bowling match against ${wBallName(L.world.club)} is called off. No result.`, 'd');
  wSave();
}
function wLanesConcede() {
  if (!wLanesWorld()) return;
  wBL.pause(true);
  askConfirm('Concede this match?', 'It counts as a loss. A loss at the lanes costs nothing, but you only get a quarter of the XP.', 'Concede', () => {
    if (!wLanesLive()) return;
    const s = wBL.summary() || {}; s.win = 1; s.text = 'conceded';
    wLanesSettle(s);
    WBL = null; wW116LeaveLanes();
  }, () => { if (WBL) wBL.pause(false); });
  wAfterAsk(() => { if (WBL) wBL.pause(false); });
}
function wLanesScore(sn) {
  const G = sn.G, sc = s => { const a = G.fr[s], n = G.frames; let t = 0; try { const v = wBL.score(a, n).filter(x => x != null); t = v.length ? v[v.length - 1] : 0; } catch (e) { /* */ } return t; };
  const done = Math.min(G.fr[0].length, G.fr[1].length), a = sc(0), b = sc(1);
  // (a match its last ball decided is finished: who won it)
  if (G.over) return `finished: ${G.teams[G.over.win].name} won${G.over.text ? `, ${G.over.text}` : ''}`;
  return `${a} to ${b}${done ? ` after ${done} frame${done === 1 ? '' : 's'}` : ''}`;
}

/* ---------- kept between balls, and settled at the end ---------- */
const wW116OnPhase = wBL.onPhase;
wBL.onPhase = ph => {
  wW116OnPhase(ph);
  if (!wLanesWorld() || !wBL.G) return;
  const settled = W_LNG.settled.includes(ph);
  if (!settled && (ph !== 'next' || wBL.G.over)) return;
  const L = WG.lng.live, first = !L.snap; L.snap = wBL.snapshot();
  // (a ball bowled is saved at once, the deciding one too: a reload never brings a ball back, and a match it decided is
  // settled on Resume (the engine says its end). The next beat is saved at most every W_LNG.saveMs: nothing new is
  // settled in it, #120)
  const now = Date.now(); if (first || settled || now - WLNG.saved > W_LNG.saveMs) { WLNG.saved = now; wSave(); }
};
// a choice committed (a ball's speed pressed, the word, the pinch bowler, the re-rack, a power cast) is kept and saved at
// once (#120)
const wW116OnCommit = wBL.onCommit;
wBL.onCommit = () => {
  if (wW116OnCommit) wW116OnCommit();
  if (!wLanesWorld() || !wBL.G) return;
  WG.lng.live.snap = wBL.snapshot(); WLNG.saved = Date.now(); wSave();
};
// a match kept after the ball that decided it (the page went as it rolled): settled now, as that ball would have settled
// it, never left waiting; its result card waits for the world (wNextPrompt). Returns the result's words, or ''
function wLanesKeptOver() { const L = wLanesLive() && WG.lng.live; return !!(L && L.snap && L.snap.G && L.snap.G.over); }
function wLanesKeptEnd() {
  if (WBL || !wLanesKeptOver()) return '';
  wBL.resume(WG.lng.live.snap);
  const s = wBL.summary(); if (!s) return '';
  const msg = wLanesSettle(s);
  WLNG.asked = true; if (!LAB) WLNG.card = msg;
  return msg;
}
const wW116OnOver = wBL.onOver;
wBL.onOver = s => {
  if (WBL && WBL.world && wLanesLive()) WBL.msg = wLanesSettle(s);
  wW116OnOver(s);
  wLanesBarNote();
};
function wLanesSettle(sum) {
  const B = wLng(), L = B.live, W = L.world, S0 = sum || {}, win = S0.win === 0;
  B.live = null;
  const r = win ? 'win' : 'lose', tot = S0.game || S0.tot || [0, 0], us = tot[0], them = tot[1], text = S0.text || (S0.over && S0.over.text) || '';
  if (win) { B.w++; fire('matchWon', { engine: 'lanes' }); } else B.l++;
  const S = WG.lnstats = WG.lnstats || {}, line = {}, played = new Set(), pst = (S0.pst || [[]])[0] || [];
  W.ids.forEach((id, ri) => {
    if (typeof id !== 'number' || !wPlayer(id)) return;
    played.add(id);
    const p = pst[ri] || { frames: 0, balls: 0, strikes: 0, spares: 0, pins: 0 }, T = S[id] = S[id] || { g: 0, frames: 0, balls: 0, strikes: 0, spares: 0, pins: 0 };
    T.g++; for (const k of ['frames', 'balls', 'strikes', 'spares', 'pins']) T[k] += p[k] || 0;
    line[id] = { frames: p.frames || 0, strikes: p.strikes || 0, spares: p.spares || 0, pins: p.pins || 0 };
  });
  const mvp = wLanesMvp(line);
  const base = Math.round(W_LNG.xp * W.tier * (win ? 1 : W_LNG.lossShare));
  for (const p of wRoster()) { const n = played.has(p.id) ? base + (win && mvp === p.id ? W_LNG.mvpXp : 0) : Math.round(base * W_LNG.benchShare); if (n > 0) wGiveXp(p, n); }
  const bits = `XP +${base} for everyone who bowled${wRoster().some(p => !played.has(p.id)) ? `, +${Math.round(base * W_LNG.benchShare)} for those who didn't` : ''}`;
  let pay = '';
  if (win) { const g = W_LNG.gold * W.tier, f = W_LNG.fans * W.tier; RUN.gold += g; RUN.fans = (RUN.fans || 0) + f; pay = ` +${g} gold, +${f} fans.`; }
  if (CLUBS[W.club]) {
    const H = wH2h(), h = H[W.club] = H[W.club] || { w: 0, l: 0 };
    if (win) h.w++; else h.l++;
    h.last = { r, us, them, sport: 'bowling', day: WG.dayAbs, text };
    try { if (wIsRival(W.club)) wLeagueMine(r); } catch (e) { console.error(e); }
  }
  const end = S0.ro ? 'ro' : '';
  B.games.unshift({ day: WG.dayAbs, club: W.club, name: W.name, tier: W.tier, how: W.how, r, us, them, text, end, tide: W.tide, mvp, line });
  B.games.length = Math.min(B.games.length, W_LNG.keep);
  WG.lastMatch = { kind: W.kind, result: r, day: WG.dayAbs, tier: W.tier };
  W.us = us; W.them = them; W.text = text;
  const f = W_ON_END[W.kind]; if (f) { try { f(r, W.ref, W); } catch (e) { console.error(e); } }
  wAdvance(W_LNG.minutes);
  const who = mvp != null && wPlayer(mvp), how = text === 'conceded' ? ', conceded' : text ? `, ${text}` : '';
  const msg = `Final: ${win ? 'you win' : 'you lose'}${how}${end ? ' (a roll-off)' : ''} against ${wBallName(W.club)}.${pay} ${bits}${win && who ? `, and +${W_LNG.mvpXp} for ${who.n}, player of the match` : ''}.`;
  wLog(msg, win ? 'g' : 'b');
  wSave();
  return msg;
}
// player of the match: strikes count most, then spares, then pins
function wLanesMvp(lines) {
  let best = null, bs = -1;
  for (const id in lines) { const s = lines[id], v = s.strikes * 3 + s.spares * 1.5 + s.pins / 30; if (v > bs) { bs = v; best = +id; } }
  return best;
}
W_ON_END.lngame = function () { };
function wLanesResultCard(msg) {
  if (LAB) return;
  const close = modal(`<header><h3>Final</h3></header><div class="wmsg"><p>${esc(msg)}</p></div><div class="row"><button class="btn" id="wLanesOk">Done</button></div>`, () => wDrain());
  $('wLanesOk').focus(); $('wLanesOk').onclick = () => close();
}

/* ---------- the bar in a real match, and Manage's row ---------- */
$('wLanesBack').insertAdjacentHTML('beforebegin', '<button class="ghost" id="wLanesSave" hidden>Save and leave</button><button class="ghost" id="wLanesGive" hidden>Concede</button>');
$('wLanesSave').onclick = () => wLanesLeaveGame();
$('wLanesGive').onclick = () => wLanesConcede();
const wW116LanesBarNote = wLanesBarNote;
wLanesBarNote = function () {
  wW116LanesBarNote();
  const real = !!(WBL && WBL.world), live = real && wLanesLive();
  $('wLanesSave').hidden = $('wLanesGive').hidden = !live;
  $('wLanesAgain').hidden = real; $('wLanesBack').hidden = live; $('wLanesFrames').parentElement.hidden = real; $('wLanesSkill').parentElement.hidden = real;
  if (real && !live && WBL.msg) $('wLanesNote').textContent = WBL.msg;
};
const wW116LeaveLanes = wLeaveLanes;
wLeaveLanes = function () { if (wLanesWorld()) return wLanesLeaveGame(); wW116LeaveLanes(); if (WG) { wSave(); wDrain(); } };
// every game at the Lanes has the hall, on the Realm's tide
const wW116LanesGame = wLanesGame;
wLanesGame = function (opts) { const o = Object.assign({ hall: true }, opts || {}); if (!o.tide) o.tide = wLanesTideNow(); return wW116LanesGame(o); };
$('wLanesRows').insertAdjacentHTML('beforeend', '<div class="wccrow" id="wLanesRowMgr" hidden><span class="wccl">Your call</span><span id="wLanesMgr"></span></div>');
$('wLanesRows').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.mline) wBL.manage({ line: d.mline }); else if (d.mtempo) wBL.manage({ tempo: d.mtempo }); else if (d.mweight) wBL.manage({ weight: d.mweight }); else return;
  wLanesRows();
});
const wW116LanesRows = wLanesRows;
wLanesRows = function () {
  wW116LanesRows();
  const V = WBL && !WBL.over && wBL.G && wBL.G.teams ? wBL.view : null, mgr = !!V && V.mode === 'manage';
  $('wLanesRowMgr').hidden = !mgr;
  if (!mgr) return;
  $('wLanesRows').hidden = false;
  for (const r of $('wLanesRows').querySelectorAll('.wccrow')) if (r.id !== 'wLanesRowMgr') r.hidden = true;
  const M = wBL.mgr, on = (a, b) => a === b ? ' on' : '', L = wBL.lines;
  $('wLanesMgr').innerHTML = [['auto', 'Auto', 'The captain reads the sheet and the lane']].concat(Object.keys(L).map(k => [k, L[k].n, 'Every first ball on this line until you change it'])).map(([k, n, t]) => `<button class="ghost${on(k, M.line)}" data-mline="${k}" title="${esc(t)}">${esc(n)}</button>`).join(' ') + ' · '
    + [['auto', 'Auto'], ['quick', 'Quick'], ['steady', 'Steady']].map(([k, n]) => `<button class="ghost${on(k, M.tempo)}" data-mtempo="${k}">${n}</button>`).join(' ') + ' · '
    + [['auto', 'Auto'], ['heavy', 'Heavy'], ['light', 'Light']].map(([k, n]) => `<button class="ghost${on(k, M.weight)}" data-mweight="${k}">${n}</button>`).join(' ');
};

// Moll's off-spot pin on your rack: a Re-rack button beside the pinch (once a game, before the frame's first ball)
$('wLanesRows').addEventListener('click', e => { const b = e.target.closest('[data-nrerack]'); if (!b || b.disabled) return; const r = wBL.select({ rerack: true }); if (typeof r === 'string') $('wLanesNote').textContent = r; wLanesRows(); wLanesBarNote(); });
const wW116LanesRows2 = wLanesRows;
wLanesRows = function () {
  wW116LanesRows2();
  const V = WBL && !WBL.over && wBL.G && wBL.G.teams ? wBL.view : null; if (!V || V.mode !== 'play' || V.up !== V.you || !V.sel) return;
  const O = wBL.offspot && wBL.offspot[V.you], G = wBL.G; if (!O || G.rb[V.you] || G.stand[V.you].length < 10 || wBL.beforeFrame(V.you)) return;
  $('wLanesRowPinch').hidden = false;
  $('wLanesPinch').insertAdjacentHTML('beforeend', ` · <button class="ghost" data-nrerack="1" ${G.rerack[V.you] || V.ph !== 'aim' ? 'disabled' : ''} title="Once a game, before the frame's first ball: Moll sets the rack again">Re-rack (the ${O.n} is off its spot)</button>`);
};

/* ---------- picking a match ---------- */
function wLanesH2h(club) { const L = ((WG.h2h || {})[club] || {}).last; return L && L.sport === 'bowling' ? L : null; }
function wOpenLanesCard() {
  const probs = wLanesProblems(), B = wLng(), live = wLanesLive(), tide = wLanesTideNow();
  const rows = wBallClubs().map(c => {
    const T = wBallTeam(c), tier = wBallTier(c), met = B.met[c] === WG.dayAbs, last = wLanesH2h(c);
    const btns = Object.keys(W_LNG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-lnclub="${c}" data-lnhow="${how}" ${probs.length || met || live ? 'disabled' : ''}>${W_LNG_HOW[how]}</button>`).join('');
    return `<li class="wbcl"><span class="wbsw" style="background:${T.color}"></span><div><b>${esc(T.name)}</b>
      <small>Tier ${tier}: their bowlers are level ${wBallOppLvl(tier)}, and bowl like a ${W_BALL_SKILL[wLanesSkillOf(tier)[1]]}.${last ? ` Last bowling match: ${last.r === 'win' ? 'won' : 'lost'}${last.text ? ' ' + esc(last.text) : ''}.` : ''}${met ? ' <b>Bowled you today.</b>' : ''}</small></div>
      <div class="row">${btns}</div></li>`;
  }).join('');
  const close = modal(`<header><h3>Bowl a match</h3><button class="ghost" data-close>Done</button></header>
    ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}${WLNG.msg ? `<p class="wbad">${esc(WLNG.msg)}</p>` : ''}
    ${live ? `<p class="wbad">You have a bowling match waiting. <button class="btn" id="wLnResume">Resume it</button></p>` : ''}
    <p class="hint">A match at the Saltmere Lanes with your five: one team game of ${wLanesFrames()} frames in the Baker format (Settings has the length). <b>Play</b>: you bowl every ball. <b>Manage</b>: you call the line, the tempo and the ball, or leave them to your captain; your five bowl. <b>Simulate</b>: the result now. A win pays ${W_LNG.xp} XP to everyone who bowled, ${W_LNG.gold} gold and ${W_LNG.fans} fans, times the tier; a loss pays a quarter of the XP and costs nothing else. Nobody goes home level: a roll-off. Each club bowls you once a day, and a match takes a couple of hours.</p>
    <p class="hint"><b>The tide is ${esc(tide)}:</b> ${tide === 'high' ? 'the lanes sweat and play heavy' : tide === 'low' ? 'the lanes play dry' : 'the lanes play as they are dressed'}. It may turn mid-game.</p>
    <ul class="wbclubs">${rows}</ul>
    <p class="hint">Or watch a game: <button class="ghost" id="wLnExhib">Saltmere against Graftonbury</button></p>`);
  WLNG.msg = '';
  $('modalBox').querySelectorAll('[data-lnclub]').forEach(b => b.onclick = () => {
    close();
    const r = wStartLanes({ club: b.dataset.lnclub, how: b.dataset.lnhow });
    if (r) { WLNG.msg = r; wOpenLanesCard(); }
  });
  const ex = $('wLnExhib'); if (ex) ex.onclick = () => { close(); wLanesGame(); };
  const rs = $('wLnResume'); if (rs) rs.onclick = () => { close(); wResumeLanes(); };
}
(() => {
  const K = DB.chars.gk_lanes; if (!K) return;
  K.topics.job.t += ' Bring your five for a MATCH and I will find you a club to bowl for real.';
  K.topics.match = { t: 'Real bowling, your five against a club at your tier, one team game. Mind the gull, and do not feed the Brinepup. It bites the pins.', act: 'lncard' };
})();
const wW116RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'lncard') return wOpenLanesCard(); return wW116RunAct.apply(this, arguments); };

const wW116NextPrompt = wNextPrompt;
wNextPrompt = function () {
  // (a decided match is settled, not waiting: its result card, settled here if the page came back somewhere else first)
  if (!LAB && !WBL && !WD && !WG.cardOffer && !WG.event && wActive()) {
    if (!WKEPT.loading && wLanesKeptOver()) wKeptOne(wLanesKeptEnd);
    if (WLNG.card) { const m = WLNG.card; WLNG.card = ''; wLanesResultCard(m); if (!$('modal').hidden) return true; }
  }
  if (!LAB && wLanesLive() && !WLNG.asked && !wLanesKeptOver() && !WBL && !WD && !WG.cardOffer && !WG.event && wActive()) {
    WLNG.asked = true;
    const L = WG.lng.live, sn = L.snap;
    const close = modal(`<header><h3>A bowling match is waiting</h3></header><div class="wmsg"><p>Your match against ${esc(wBallName(L.world.club))} is where you left it${sn ? `: ${esc(wLanesScore(sn))}` : ''}.</p><p class="hint">You can also pick it up later from the Lanes tab on the Team screen.</p></div>
      <div class="row"><button class="btn" id="wLnRes">Resume</button><button class="ghost" id="wLnLater">Later</button></div>`, () => wDrain());
    $('wLnRes').focus();
    $('wLnRes').onclick = () => { close(); wResumeLanes(); };
    $('wLnLater').onclick = () => close();
    return true;
  }
  return wW116NextPrompt();
};

/* ---------- the Lanes tab: Play a match, Resume, and the last matches ---------- */
const wW116CampLanes = wCampLanes;
wCampLanes = function (C) {
  const html = wW116CampLanes(C), probs = wLanesProblems(), live = wLanesLive();
  const play = live ? `<button class="btn" data-lnresume>Resume the match</button>` : `<button class="btn" data-lnplay ${probs.length ? 'disabled' : ''}>Bowl a match</button>`;
  const gate = !live && probs.length ? `<p class="hint wball">${esc(probs[0])}</p>` : '';
  return html.replace('<button class="btn" data-npractice', `${play}<button class="ghost" data-npractice`).replace(/<\/div>\s*$/, `</div>${gate}${wLanesRecent()}`);
};
function wLanesRecent() {
  const B = WG.lng; if (!B || !B.games.length) return '';
  return `<h5 class="wbrh">Last bowling matches: ${B.w}&ndash;${B.l}</h5><ol class="wstlog">${B.games.slice(0, 5).map(g => `<li><b class="${g.r === 'win' ? 'wgood' : 'wbad'}">${g.r === 'win' ? 'Won' : 'Lost'}</b>${g.text ? ' ' + esc(g.text) : ''} against ${esc(g.name)}${g.end === 'ro' ? ' (a roll-off)' : ''}<small>day ${g.day}${g.mvp != null && wPlayer(g.mvp) ? `, player of the match ${esc(wPlayer(g.mvp).n)}` : ''}</small></li>`).join('')}</ol>`;
}
const wW116RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW116RenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'lanes') return;
  const p = body.querySelector('[data-lnplay]'); if (p) p.onclick = () => { WCAMP.close(); wOpenLanesCard(); };
  const r = body.querySelector('[data-lnresume]'); if (r) r.onclick = () => { WCAMP.close(); wResumeLanes(); };
};

/* ---------- lines ---------- */
function wLanesLine(pid) { return (WG.lnstats || {})[pid] || null; }
const W_LN_LCOLS = [['g', 'G', 'Bowling matches bowled'], ['strikes', 'X', 'Strikes'], ['spares', '/', 'Spares'], ['pins', 'Pins', 'Pins knocked down']];
const wW116CampStats = wCampStats;
wCampStats = function () {
  const html = wW116CampStats();
  if (WSTAT.view !== 'bowling') return html;
  const head = W_LN_LCOLS.map(([c, s, l]) => `<th scope="col" title="${esc(l)}">${s}</th>`).join('');
  return html.replace(/(<thead><tr>[\s\S]*?)(<\/tr><\/thead>)/, `$1${head}$2`)
    .replace(/(<tr data-wsp="(\d+)"[^>]*>[\s\S]*?)(<\/tr>)/g, (m, a, id, end) => { const L = wLanesLine(+id); return a + W_LN_LCOLS.map(([c]) => `<td>${L ? L[c] || 0 : '<span class="dim">&ndash;</span>'}</td>`).join('') + end; })
    .replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Every player\'s bowling ratings, their place in your five (set on the Lanes tab), and every bowling match they bowled from the world on this journey (exhibitions and practice are not counted). Pick a heading to sort, a player to see more.</small>');
};
const wW116StatsCard = wStatsCard;
wStatsCard = function (p) {
  const L = wLanesLine(p.id), html = wW116StatsCard(p);
  if (!L || !L.g) return html;
  const bits = `${L.g} bowling match${L.g === 1 ? '' : 'es'}: ${L.frames} frame${L.frames === 1 ? '' : 's'}, ${L.strikes} strike${L.strikes === 1 ? '' : 's'}, ${L.spares} spare${L.spares === 1 ? '' : 's'}, ${L.pins} pins`;
  return html.replace('<div class="wbd wbkc wblc"><h5>Bowling</h5>', `<div class="wbd wbkc wblc"><h5>Bowling</h5><p class="wbdbox">${bits}.</p>`);
};

const wW116LanesHow = wLanesHowHTML;
wLanesHowHTML = function () {
  return wW116LanesHow() + `<p class="hint"><b>Matches.</b> Ask Moll Gutter for a MATCH, or use the Lanes tab: your five against a club at your tier, once a day each. <b>Manage</b> lets your captain bowl by your call (the line, the tempo and the ball, or Auto); <b>Simulate</b> gives the result at once. Save and leave keeps the match between balls.</p>
  <p class="hint"><b>The hall.</b> The tide under the floor may turn mid-game: the lamps sway, and the lanes play heavier or drier for both sides. Moll sets the pins by hand, and now and then one stands off its spot (ringed on the rack): call a re-rack, once a game, before your first ball. The sea's swell can wobble a pin over before the sweep comes down, and it counts. Very rarely a gutter crab clips a gutter ball back onto the lane for the corner pin, and the gull comes in through the high window and knocks a pin over. The Brinepup in the pit barks at a pin left standing; it only barks.</p>`;
};
const wW116RenderHelp = renderHelp;
renderHelp = function () {
  wW116RenderHelp();
  const after = $('wHelpLanesTab'); if (!after || $('wHelpLanesGame')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLanesGame"><b>Bowling matches.</b> Moll Gutter's MATCH, or Bowl a match on the Lanes tab: your five against a club at your tier, once a day each, in Play, Manage or Simulate. A win pays XP, gold and fans by the tier; a loss pays a quarter of the XP and costs nothing else. Save and leave keeps the match for later.</p>`);
};
