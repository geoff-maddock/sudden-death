/* w53: boxing from the world (issue #23, phase 5). A card of three bouts against a rival club, or the local side, at
   the Anvil Ring, as football games are played (w44): Play (your corner, and you box the rounds), Manage (your corner;
   your fighters box) or Simulate (the result at once). Ma Gristle's CARD opens the card: the clubs at your tier, each
   once a day, and the exhibition against the Saltmere club as before. A card needs W_BXG.minOwn players of your own;
   call-ups make up three.
   Your players box on their own ratings (wBxOf: the kind's, give or take one, and a point a level weighted by the kind,
   kept on the player as p.bx, as their football ratings are), and so do theirs, at your level plus the tier, with
   W_BXG.oppBonus points spread over each.
   The result: a win pays XP to the three who boxed (half to the rest of the team), gold and fans by tier; a loss a
   quarter of the XP, and a drawn card half (questions 4 and 5 of #23, as on the gridiron). A fighter of yours knocked
   out or stopped costs W_BXG.koHp Team HP (question 4), and nothing more. Every bout adds to your boxers' lines
   (WG.bxstats), and the card to the head to head and the league table. Save and leave keeps the card at its last save
   point (a corner, or between bouts; pressed in a round, you leave at the next corner), and it is waiting when you
   come back, after a reload too. Concede counts as a loss.

   WG.bxg     { live: null | { world, snap }, met: { club: dayAbs }, opp: { club: { lvl, side } }, cards: [last W_BXG.keep],
              w, l, t }
              world = { kind: 'bxcard', ref, club, tier, how, day, name, ids, cup }, plain data; the end dispatches
              W_ON_END[kind]. ids: your side's fighters' roster ids (null for a call-up)
   WG.bxstats { pid: { bb (bouts), w, l, d, ko (wins inside the distance), kd (knockdowns scored), down, landed, thrown,
              pw (powers cast) } }, this journey
   Wraps: wRingBarNote (wW53RingBarNote: Save and leave and Concede in a real card), wRunAct (wW53RunAct: CARD opens the
   card), wNextPrompt (wW53NextPrompt: a card waiting after a reload), renderHelp (wW53RenderHelp: #wHelpRingGame). */

const W_BXG = {
  minOwn: 2, xp: 10, gold: 15, fans: 3, lossShare: .25, tieShare: .5, benchShare: .5, koHp: 5, cap: 12,
  // extra rating points for each of their fighters, by tier, spread over the six (6 is +1 to every one). Measured under
  // Simulate (test/realm_ring_lab.py, docs/realm/BALANCE.md): a card won about 52% of the time at tier 1, 39-44% at
  // tier 2 and 26% at tier 3, as on the gridiron. Tier 1 needs a bonus here where football's doesn't: your corner picks
  // the pairing against their order, and a Squire boxes worse than it plays football
  oppBonus: { 1: 2, 2: 1, 3: 2 },
  minutes: 90, keep: 10, saveMs: 10000,
};
const W_BXG_HOW = { play: 'Play', manage: 'Manage', sim: 'Simulate' };
const WBXG = { saved: 0, asked: false, msg: '', leaving: false };

function wBxg() {
  const B = WG.bxg = WG.bxg || { live: null, met: {}, opp: {}, cards: [], w: 0, l: 0, t: 0 };
  B.met = B.met || {}; B.opp = B.opp || {}; B.cards = B.cards || [];
  return B;
}
function wRingLive() { return !!(WG && WG.bxg && WG.bxg.live); }
// a real card is in the ring (not an exhibition)
function wRingWorld() { return !!(WBX && WBX.world && wRingLive()); }
function wRingProblems() {
  const n = wRoster().length;
  return n < W_BXG.minOwn ? [`Recruit ${W_BXG.minOwn - n} more player${W_BXG.minOwn - n === 1 ? '' : 's'}: a card needs ${W_BXG.minOwn} of your own, and call-ups make up three.`] : [];
}
// how well each side's CPU boxes (and casts): yours as a Knight, theirs by tier, as on the diamond and the gridiron
const wRingSkill = tier => [1, W_BALL.diff[tier] != null ? W_BALL.diff[tier] : 1];

/* ---------- ratings ---------- */
function wBxOf(p) {
  if (!p || !p.kind) return null;
  if (!p.bx) { const r = wBX.rate(p.kind); p.bx = { lv: 1, got: {} }; for (const s of wBX.stats) p.bx[s] = Math.max(1, Math.min(W_BXG.cap, r[s] + Math.floor(Math.random() * 3) - 1)); }
  const b = p.bx, lvl = p.lvl || 1;
  while (b.lv < lvl) { b.lv++; const s = wBxGrowStat(p); if (s) { b[s]++; b.got[s] = (b.got[s] || 0) + 1; } }
  return b;
}
// a level's point: any rating below the cap, weighted by the kind's own, so a harpy gets quicker and an ogre harder
function wBxGrowStat(p) {
  const K = wBX.rate(p.kind), open = wBX.stats.filter(s => p.bx[s] < W_BXG.cap);
  if (!open.length) return null;
  let r = Math.random() * open.reduce((a, s) => a + K[s], 0);
  for (const s of open) { r -= K[s]; if (r < 0) return s; }
  return open[open.length - 1];
}
function wBxFighter(p) { const b = wBxOf(p); return { n: p.n, kind: p.kind, num: p.num, lvl: p.lvl || 1, pid: p.id == null ? null : p.id, r: Object.fromEntries(wBX.stats.map(s => [s, b[s]])) }; }

/* ---------- the two sides ---------- */
// yours: your team in its order (by roster id), then call-ups at your level to make three
function wRingSide(taken) {
  const t = wPartyTeam(), F = wRoster().map(wBxFighter);
  for (const f of F) taken.add(f.n);
  for (let i = 0; F.length < wBX.rules.card; i++) { const p = wMakeCallUp(W_RING.home.kinds[i % W_RING.home.kinds.length], taken); F.push(Object.assign(wBxFighter(p), { pid: null, callup: true })); }
  return { name: t.name, short: t.short, color: W_RING.home.color, light: W_RING.home.light, fighters: F };
}
/* theirs: three of the club's kinds (its region's, then the visitors'), at your level plus the tier, with the tier's
   bonus points; a rival keeps the same three until they'd be a different level; the local side is new each time.
   Their order is new each card. */
function wRingOpp(club, tier, taken) {
  const B = wBxg(), lvl = wBallOppLvl(tier), C = club === 'apex' ? Object.assign({}, W_CUP.apexTeam) : wBallTeam(club), k = W_BXG.oppBonus[tier] || 0;
  const cached = club !== 'local' && B.opp[club];
  let side;
  if (cached && cached.lvl === lvl) side = JSON.parse(JSON.stringify(cached.side));
  else {
    const rg = wBallRegion(club), own = rg ? (DB.regions[rg] || {}).kinds || [] : (C.roster || []).map(r => r[1]);
    const kinds = own.filter(x => wBX.kinds.includes(x)).concat(W_RING.away.kinds).filter((x, i, a) => a.indexOf(x) === i).slice(0, wBX.rules.card);
    const fighters = kinds.map(kind => {
      const rn = (C.roster || []).find(r => r[1] === kind), free = (FA_NAMES[kind] || []).filter(n => !taken.has(n));
      const p = wMakePlayer({ kind, lvl, n: rn && !taken.has(rn[0]) ? rn[0] : free.length ? pick(free) : undefined }, 'opp');
      taken.add(p.n); const f = wBxFighter(p); f.pid = null; return f;
    });
    side = { name: C.name, short: C.short, color: W_RING.away.color, light: W_RING.away.light, fighters };
    if (club !== 'local') B.opp[club] = { lvl, side: JSON.parse(JSON.stringify(side)) };
  }
  for (const f of side.fighters) taken.add(f.n);
  if (k) side.fighters.forEach((f, j) => { for (let i = 0; i < k; i++) { const s = wBX.stats[(i * 5 + j) % wBX.stats.length]; f.r[s] = Math.min(W_BXG.cap, f.r[s] + 1); } });
  side.fighters = side.fighters.sort(() => Math.random() - .5);
  return side;
}

/* ---------- starting, leaving, coming back ---------- */
/* a real card: o { club, how, tier?, kind?, ref?, cup? }. Opens the pairing; the card starts from there. Returns a
   reason it can't, or '' */
function wStartRing(o) {
  if (!WG || !RUN) return '';
  const probs = wRingProblems(); if (probs.length) return probs.join(' ');
  const B = wBxg(), club = o.club;
  if (B.live) return 'Finish the card you started first.';
  if (!wBallRegion(club) && !CLUBS[club] && club !== 'apex') return '';
  if (!o.cup && B.met[club] === WG.dayAbs) return `${wCap(wBallName(club))} have already boxed you today. Come back tomorrow.`;
  const how = W_BXG_HOW[o.how] ? o.how : 'play', tier = o.tier || wBallTier(club), taken = new Set();
  const mine = wRingSide(taken), theirs = wRingOpp(club, tier, taken);
  // (the bot has no hands for the pairing: it boxes your corner's)
  if (LAB) { wRingGo(Object.assign({}, o, { how, tier }), mine, theirs, wBX.cardAuto(mine.fighters, theirs.fighters)); return ''; }
  wRingPairing({ mine, theirs, title: `A card against ${wBallName(club)}`, go: [[W_BXG_HOW[how], how]].concat(Object.keys(W_BXG_HOW).filter(h => h !== how).map(h => [W_BXG_HOW[h], h])),
    intro: `Three bouts, one fighter each, and each fighter boxes once. ${esc(wCap(wBallName(club)))} have named their order: tier ${tier}, level ${wBallOppLvl(tier)}. Pick who of yours faces each; your corner has picked to start with. <b>Play</b>: your corner, and you box the rounds. <b>Manage</b>: your corner; your fighters box. <b>Simulate</b>: the result now.`,
    onGo: (picks, h) => wRingGo(Object.assign({}, o, { how: h, tier }), mine, theirs, picks) });
  return '';
}
function wRingGo(o, mine, theirs, picks) {
  const B = wBxg(); if (B.live) return;
  const world = { kind: o.kind || 'bxcard', ref: o.ref || null, club: o.club, tier: o.tier, how: o.how, day: WG.dayAbs, name: theirs.name, ids: mine.fighters.map(f => f.pid), cup: !!o.cup };
  if (!o.cup) B.met[o.club] = WG.dayAbs;
  B.live = { world, snap: null };
  const skill = wRingSkill(o.tier);
  if (o.how === 'sim') {
    const r = wBX.simCard({ sides: [mine, theirs], picks, skill });
    wRingResultCard(wRingSettle(r.result, r.bouts.map(b => ({ over: b.over, stats: b.stats, kd: b.kd })), r.pairs));
    return;
  }
  WBX = { over: null, card: true, world: true, msg: '' }; WBXG.leaving = false;
  wBX.cardStart({ sides: [mine, theirs], picks, mode: o.how === 'play' ? 'play' : 'call', you: 0, skill });
  showView('ring');
  wRingBarNote();
  wSave();
}
function wResumeRing() {
  const L = wRingLive() && WG.bxg.live; if (!L) return;
  if (!L.snap) { wRingCallOff('The card had not reached its first bout, so it is called off.'); return; }
  const C = L.snap.CD, done = C && C.bouts[C.i];
  WBX = { over: L.snap.BD.ph === 'over' && done ? { verdict: done.verdict } : null, card: true, world: true, msg: '' }; WBXG.leaving = false;
  wBX.resume(L.snap);
  showView('ring');
  wRingBarNote();
}
// Save and leave: the card stays at its last save point. Pressed in a round, you leave at the next corner, so the round counts
function wRingLeave() {
  const L = wRingLive() && WG.bxg.live; if (!L) return wLeaveRing();
  const ph = wBX.phase;
  if (wRingWorld() && L.snap && (ph === 'round' || ph === 'kd' || ph === 'rise')) { WBXG.leaving = true; wRingBarNote(); return; }
  WBXG.leaving = false; WBXG.asked = true;
  const sn = L.snap;
  WBX = null; wLeaveRing();
  if (!sn) return wRingCallOff(`You leave before the first bout, so the card against ${wBallName(L.world.club)} is called off.`);
  wLog(`Your card against ${wBallName(L.world.club)} is saved${wRingScoreWords(sn)}. Ask Ma Gristle at the Anvil Ring to resume it.`, 'd');
  wSave();
}
function wRingCallOff(why) {
  const B = wBxg(), L = B.live; if (!L) return;
  B.live = null; if (!L.world.cup) delete B.met[L.world.club];
  wLog(why || `The card against ${wBallName(L.world.club)} is called off. No result.`, 'd');
  wSave();
}
function wRingConcede() {
  if (!wRingWorld()) return;
  wBX.pause(true);
  askConfirm('Concede the card?', 'It counts as a loss: a quarter of the XP. The bouts already boxed count in your lines, and so does the one on now, as a loss (a knockout if your fighter is being counted).', 'Concede', () => {
    if (!wRingLive()) return;
    const C = wBX.card, G = wBX.G, bouts = C ? C.bouts.slice(0, C.i + 1) : [];
    // the bout on now, unless it's over: lost, by knockout if your fighter is down, otherwise retired in the corner
    if (C && !bouts[C.i] && G && G.F) bouts[C.i] = { over: { how: G.down === 0 ? 'ko' : 'rtd', win: 1, kd: G.kd.slice(), pts: [0, 0] }, stats: G.F.map(f => { const s = Object.assign({}, f.bs); for (const k in f.rs) s[k] = (s[k] || 0) + f.rs[k]; return s; }), kd: G.kd.slice() };
    const won = [0, 0]; for (const b of bouts) if (b && (b.over.win === 0 || b.over.win === 1)) won[b.over.win]++;
    const msg = wRingSettle({ win: 1, by: 'conceded', won }, bouts, C ? C.pairs : []);
    WBXG.leaving = false; wBX.pause(false);
    WBX = null; wLeaveRing(); wRingResultCard(msg);
  }, () => wBX.pause(false));
  // (closed with Escape or a click outside: box on, as if you'd said no)
  wAfterAsk(() => { if (wRingLive() && WBX) wBX.pause(false); });
}
function wRingScoreWords(sn) {
  const C = sn.CD; if (!C) return '';
  const won = [0, 0]; for (const b of C.bouts) if (b && (b.over.win === 0 || b.over.win === 1)) won[b.over.win]++;
  return `: bout ${C.i + 1} of ${C.pairs.length}, ${C.sides[0].name} ${won[0]}, ${C.sides[1].name} ${won[1]}`;
}
wBX.wantSnap = () => wRingWorld();
wBX.onSnap = sn => {
  const L = wRingWorld() && WG.bxg.live; if (!L) return;
  L.snap = sn;
  // (Save and leave was pressed in a round: leave now, at the corner)
  if (WBXG.leaving) { WBXG.leaving = false; setTimeout(() => { if (wRingWorld()) wRingLeave(); }, 0); return; }
  // (the start and the end of a bout are always saved, so a result can't be undone by a reload; a corner at most every few seconds)
  const now = Date.now(); if (sn.BD.ph !== 'corner' || now - WBXG.saved > W_BXG.saveMs) { WBXG.saved = now; wSave(); }
};
// the end of a bout: on a real card, once the card is settled, the world pays it
const wW53OnOver = wBX.onOver;
wBX.onOver = s => {
  const C = WBX && WBX.world && wRingLive() ? wBX.card : null;
  if (C && C.result) WBX.msg = wRingSettle(C.result, C.bouts, C.pairs);
  wW53OnOver(s);
};

/* ---------- the result ---------- */
/* result: the card's ({ win, by, won }); bouts: [{ over, stats, kd }] in order; pairs: [[mine, theirs]]. Returns the
   message */
function wRingSettle(result, bouts, pairs) {
  const B = wBxg(), L = B.live, W = L.world, r = result.win === 0 ? 'win' : result.win === 1 ? 'lose' : 'tie', win = r === 'win', tie = r === 'tie';
  B.live = null;
  if (win) B.w++; else if (tie) B.t++; else B.l++;
  // your boxers' lines, and what a knockout costs
  const S = WG.bxstats = WG.bxstats || {}, boxed = new Set(); let kos = 0;
  bouts.forEach((b, i) => {
    if (!b || !pairs[i]) return;
    const v = b.over, id = W.ids[pairs[i][0]], mine = v.win === 0, theirs = v.win === 1;
    if (theirs && (v.how === 'ko' || v.how === 'tko')) kos++;
    if (typeof id !== 'number' || !wPlayer(id)) return;
    boxed.add(id);
    const T = S[id] = S[id] || { bb: 0, w: 0, l: 0, d: 0, ko: 0, kd: 0, down: 0, landed: 0, thrown: 0, pw: 0 }, st = (b.stats || [])[0] || {};
    T.bb++; if (mine) T.w++; else if (theirs) T.l++; else T.d++;
    if (mine && v.how !== 'dec') T.ko++;
    T.kd += (b.kd || v.kd)[1]; T.down += (b.kd || v.kd)[0]; T.landed += st.landed || 0; T.thrown += st.thrown || 0; T.pw += st.pw || 0;
  });
  if (kos) RUN.hp = Math.max(1, RUN.hp - kos * W_BXG.koHp);
  const base = Math.round(W_BXG.xp * W.tier * (win ? 1 : tie ? W_BXG.tieShare : W_BXG.lossShare));
  for (const p of wRoster()) { const n = boxed.has(p.id) ? base : Math.round(base * W_BXG.benchShare); if (n > 0) wGiveXp(p, n); }
  const bits = `XP +${base} for your fighters${wRoster().some(p => !boxed.has(p.id)) ? `, +${Math.round(base * W_BXG.benchShare)} for the rest` : ''}`;
  let pay = '';
  if (win) { const g = W_BXG.gold * W.tier, f = W_BXG.fans * W.tier; RUN.gold += g; RUN.fans = (RUN.fans || 0) + f; pay = ` +${g} gold, +${f} fans.`; }
  const won = result.won || [0, 0];
  if (CLUBS[W.club]) {
    const H = wH2h(), h = H[W.club] = H[W.club] || { w: 0, l: 0 };
    if (win) h.w++; else if (!tie) h.l++;
    h.last = { r, us: won[0], them: won[1], sport: 'boxing', day: WG.dayAbs };
    try { if (!tie && wIsRival(W.club)) wLeagueMine(r); } catch (e) { console.error(e); }
  }
  B.cards.unshift({ day: WG.dayAbs, club: W.club, name: W.name, tier: W.tier, how: W.how, r, us: won[0], them: won[1], by: result.by, kos });
  B.cards.length = Math.min(B.cards.length, W_BXG.keep);
  WG.lastMatch = { kind: W.kind, result: r, day: WG.dayAbs, tier: W.tier };
  W.us = won[0]; W.them = won[1];
  const f = W_ON_END[W.kind]; if (f) { try { f(r, W.ref, W); } catch (e) { console.error(e); } }
  wAdvance(W_BXG.minutes);
  const how = result.by && result.by !== 'bouts' && result.by !== 'draw' && result.by !== 'conceded' ? `, on ${result.by}` : '';
  const head = result.by === 'conceded' ? `you concede against ${wBallName(W.club)}, at ${won[0]}–${won[1]} in bouts` : `${win ? 'you win' : tie ? 'a draw' : 'you lose'} ${won[0]}–${won[1]} against ${wBallName(W.club)}${how}`;
  const msg = `The card: ${head}.${pay} ${bits}.${kos ? ` ${kos === 1 ? 'A knockout' : `${kos} knockouts`} cost ${kos * W_BXG.koHp} Team HP.` : ''}`;
  wLog(msg, win ? 'g' : 'b');
  wSave();
  return msg;
}
W_ON_END.bxcard = function () { }; // the log line and the rewards are paid in wRingSettle; kinds built on it add theirs
function wRingResultCard(msg) {
  if (LAB) return;
  const close = modal(`<header><h3>The card</h3></header><div class="wmsg"><p>${esc(msg)}</p></div><div class="row"><button class="btn" id="wRingOk">Done</button></div>`, () => wDrain());
  $('wRingOk').focus(); $('wRingOk').onclick = () => close();
}

/* ---------- the bar in a real card ---------- */
$('wRingBack').insertAdjacentHTML('beforebegin', '<button class="ghost" id="wRingSave" hidden>Save and leave</button><button class="ghost" id="wRingGive" hidden>Concede</button>');
$('wRingSave').onclick = () => wRingLeave();
$('wRingGive').onclick = () => wRingConcede();
const wW53RingBarNote = wRingBarNote;
wRingBarNote = function () {
  wW53RingBarNote();
  const real = !!(WBX && WBX.world), live = real && wRingLive();
  $('wRingSave').hidden = $('wRingGive').hidden = !live;
  if (!live) WBXG.leaving = false;
  $('wRingSave').disabled = live && WBXG.leaving; $('wRingSave').textContent = live && WBXG.leaving ? 'Leaving at the next corner…' : 'Save and leave';
  // (once a real card is settled it can't be boxed on in another mode)
  if (real) { $('wRingAgain').hidden = true; $('wRingBack').hidden = live; $('wRingModes').hidden = !live; }
  else $('wRingModes').hidden = false;
  if (real && !live && WBX.msg) $('wRingNote').textContent = WBX.msg;
};

/* ---------- picking a card ---------- */
function wRingH2h(club) { const L = ((WG.h2h || {})[club] || {}).last; return L && L.sport === 'boxing' ? L : null; }
function wOpenRingCard() {
  const probs = wRingProblems(), B = wBxg(), live = wRingLive();
  const rows = wBallClubs().map(c => {
    const T = wBallTeam(c), tier = wBallTier(c), met = B.met[c] === WG.dayAbs, last = wRingH2h(c);
    const btns = Object.keys(W_BXG_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-bxclub="${c}" data-bxhow="${how}" ${probs.length || met || live ? 'disabled' : ''}>${W_BXG_HOW[how]}</button>`).join('');
    return `<li class="wbcl"><span class="wbsw" style="background:${T.color}"></span><div><b>${esc(T.name)}</b>
      <small>Tier ${tier}: their fighters are level ${wBallOppLvl(tier)}, CPU skill ${W_BALL_SKILL[wRingSkill(tier)[1]]}.${last ? ` Last card: ${last.r === 'win' ? 'won' : last.r === 'tie' ? 'drawn' : 'lost'} ${last.us}–${last.them}.` : ''}${met ? ' They have boxed you today.' : ''}</small></div>
      <div class="row">${btns}</div></li>`;
  }).join('');
  const close = modal(`<header><h3>A card at the Anvil Ring</h3><button class="ghost" data-close>Done</button></header>
    ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}${WBXG.msg ? `<p class="wbad">${esc(WBXG.msg)}</p>` : ''}
    ${live ? `<p class="wbad">You have a card waiting. <button class="btn" id="wBxResume">Resume it</button></p>` : ''}
    <p class="hint">Three bouts, three of yours against three of theirs, one at a time. A win pays XP, gold and fans by tier; a loss a quarter of the XP, a drawn card half. A fighter of yours knocked out or stopped costs ${W_BXG.koHp} Team HP. Each club boxes you once a day.</p>
    <ul class="wbclubs">${rows}</ul>${wRingRecent()}
    <p class="hint">Or an exhibition, nothing won or lost: <button class="ghost" id="wBxExhib">against the Saltmere club</button></p>`);
  WBXG.msg = '';
  $('modalBox').querySelectorAll('[data-bxclub]').forEach(b => b.onclick = () => {
    close();
    const r = wStartRing({ club: b.dataset.bxclub, how: b.dataset.bxhow });
    if (r) { WBXG.msg = r; wOpenRingCard(); }
  });
  $('wBxExhib').onclick = () => { close(); wRingCard(); };
  const rs = $('wBxResume'); if (rs) rs.onclick = () => { close(); wResumeRing(); };
}
// your boxers' lines and the last cards
function wRingRecent() {
  const B = WG.bxg, S = WG.bxstats || {}, mine = wRoster().filter(p => S[p.id]);
  const lines = mine.length ? `<table class="wrcard"><tr><th>Boxer</th><th title="Bouts">B</th><th title="Won, lost, drawn">W–L–D</th><th title="Wins inside the distance">KO</th><th title="Knockdowns scored, and taken">KD</th><th title="Punches landed of thrown">Landed</th></tr>${mine.map(p => { const T = S[p.id]; return `<tr><td>${esc(p.n)}, ${esc(wKindName(p.kind))}</td><td>${T.bb}</td><td>${T.w}–${T.l}–${T.d}</td><td>${T.ko}</td><td>${T.kd} / ${T.down}</td><td>${T.landed}/${T.thrown}</td></tr>`; }).join('')}</table>` : '';
  const cards = B && B.cards.length ? `<h5 class="wbrh">Last cards: ${B.w}&ndash;${B.l}${B.t ? `&ndash;${B.t}` : ''}</h5><ol class="wstlog">${B.cards.slice(0, 5).map(g => `<li><b class="${g.r === 'win' ? 'wgood' : 'wbad'}">${g.r === 'win' ? 'Won' : g.r === 'tie' ? 'Drew' : 'Lost'} ${g.us}–${g.them}</b> against ${esc(g.name)}${g.by && g.by !== 'bouts' && g.by !== 'draw' ? `, on ${esc(g.by)}` : ''}</li>`).join('')}</ol>` : '';
  return lines + cards;
}
// Ma Gristle's CARD opens the card
(() => {
  const K = DB.chars.gk_ring; if (!K || !K.topics.card) return;
  K.topics.card.t = 'Three bouts, three of yours against three of theirs, one at a time. Box a club for real, at the tier you\'re at, or an exhibition against the Saltmere club.';
})();
const wW53RunAct = wRunAct;
wRunAct = function (act, id) { if (act === 'rcard') return wOpenRingCard(); return wW53RunAct.apply(this, arguments); };

/* after a reload, a saved card is waiting: ask once */
const wW53NextPrompt = wNextPrompt;
wNextPrompt = function () {
  if (!LAB && wRingLive() && !WBXG.asked && !WBX && !WD && !WG.cardOffer && !WG.event && wActive()) {
    WBXG.asked = true;
    const L = WG.bxg.live, sn = L.snap;
    const close = modal(`<header><h3>A card is waiting</h3></header><div class="wmsg"><p>Your card against ${esc(wBallName(L.world.club))} is where you left it${sn ? esc(wRingScoreWords(sn)) : ''}.</p><p class="hint">You can also pick it up from Ma Gristle at the Anvil Ring.</p></div>
      <div class="row"><button class="btn" id="wBxRes">Resume</button><button class="ghost" id="wBxLater">Later</button></div>`, () => wDrain());
    $('wBxRes').focus();
    $('wBxRes').onclick = () => { close(); wResumeRing(); };
    $('wBxLater').onclick = () => close();
    return true;
  }
  return wW53NextPrompt();
};

const wW53RenderHelp = renderHelp;
renderHelp = function () {
  wW53RenderHelp();
  const r = $('wHelpRing'); if (!r || $('wHelpRingGame')) return;
  r.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpRingGame"><b>Boxing for real.</b> Ask Ma Gristle for a CARD and box a club: three bouts, one fighter each, and each fighter boxes once. Play (your corner, and you box the rounds), Manage (your corner) or Simulate. Your players box on their own ratings, which grow with their level. A win pays XP, gold and fans by tier, a loss a quarter of the XP and a drawn card half; a fighter of yours knocked out or stopped costs ${W_BXG.koHp} Team HP. Each club boxes you once a day. Save and leave keeps the card at the next corner, and it waits for you.</p>`);
};
