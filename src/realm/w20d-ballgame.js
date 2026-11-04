/* w20d: playing baseball from the world (issue #4, phase 4). Your nine plays a rival club, or the local nine, on the
   diamond: you play every pitch (Play), let your players cast their own powers while you swing and pitch (Manage), or
   get the result at once (Simulate). A ball game needs W_BALL.minOwn players of your own, and each club plays you
   once a day. There is no team HP on the diamond: a loss costs nothing but the XP you would have won. A win pays XP
   to the nine (half to your players who sat out), gold and fans by tier; every game records the box score for your
   players, the head to head and the league table. Save and leave keeps the game where it is (the snapshot from the
   start of the pitch), and it is waiting when you come back, after a reload too.

   WG.ball   { live: null | { world, snap }, met: { club: dayAbs }, opp: { club: def }, games: [last W_BALL.keep], w, l }
             world = { kind: 'ball', ref, club, tier, home, how, day }, plain data; the end dispatches W_ON_END[kind]
             snap = Brimstone Diamond's own snapshot (plain JSON); opp caches each club's nine at the level it was made
   WG.bstats { pid: Brimstone Diamond box line, plus bg (games) }, this journey
   clubs     a rival's id, 'local' (the region you're in) or 'wild:<region>' (that region's nine)
   wBallProblems()           what stops your team playing a ball game, as sentences (empty when it can)
   wStartBall({ club, how, home?, tier?, kind?, ref?, cup? })   '' when it started, or why not; cup: true skips the
                             once-a-day rule (a bracket says who plays whom)
   wResumeBall(), wBallLeave(), wBallConcede(), wOpenBallCard({ home? })
   Wrapped: wDiamondOver and wLeaveDiamond (w20), wNextPrompt (a game waiting after a reload), modal (wSdModal: a card
   pick it opens on top of comes back later), wCampNine and
   wRenderCamp (the Play buttons on the Nine tab), wOpenGround (Host a ball game), wCampStats and wStatsCard (the
   Baseball view and box lines), renderHelp (#wHelpBall). */

const W_BALL = {
  minOwn: 5, innings: 3,
  diff: { 1: 0, 2: 1, 3: 2 },     // CPU skill by tier: Squire, Knight, Archmage
  // Brimstone Diamond's optional rules in the Realm: no injuries (nothing in the Realm heals them), no magic bats and
  // balls (the Realm's gear is cards), no pitch clock or brawls; stealing and the moon and stars stay on
  rules: { injuries: false, gear: false, clock: 0, brawl: false, steal: true, sky: true },
  // the other nine's ratings, + this to each by tier. A level is one rating point, which hardly moves a game (bot,
  // docs/realm/BALANCE.md): +1 to every rating takes an even game from about 50% to about 31% for your side
  oppBonus: { 1: 0, 2: 0, 3: 1 },
  xp: 12, gold: 15, fans: 3,      // a win, times the tier
  lossShare: .25, benchShare: .5, mvpXp: 5,
  minutes: 150, keep: 10, saveMs: 15000
};
const W_BALL_HOW = { play: 'Play', manage: 'Manage', sim: 'Simulate' };
const W_BALL_SKILL = ['Squire', 'Knight', 'Archmage'];
const WBALL = { saved: 0, asked: false, msg: '', buried: null, later: 0 };

function wBall() {
  const B = WG.ball = WG.ball || { live: null, met: {}, opp: {}, games: [], w: 0, l: 0 };
  B.met = B.met || {}; B.opp = B.opp || {}; B.games = B.games || [];
  return B;
}
function wBallLive() { return !!(WG && WG.ball && WG.ball.live); }
function wBallProblems() {
  const n = wRoster().length, out = [];
  if (n < W_BALL.minOwn) out.push(`Recruit ${W_BALL.minOwn - n} more player${W_BALL.minOwn - n === 1 ? '' : 's'}: a ball game needs ${W_BALL.minOwn} of your own, and call-ups fill the rest of the nine.`);
  return out.concat(n ? wNineProblems() : []);
}
// who you can play: the local nine of the region you're in, and your rival clubs
function wBallClubs() { return ['local'].concat(Object.values(WG.rivals || {}).filter((c, i, a) => CLUBS[c] && a.indexOf(c) === i)); }
// the local nine is the region you're in; 'wild:<region>' is that region's nine wherever you are (the Diamond Cup)
function wBallRegion(club) { return club === 'local' ? wRegionHere() : String(club).startsWith('wild:') ? club.slice(5) : null; }
function wBallTeam(club) {
  const rg = wBallRegion(club);
  if (!rg) return CLUBS[club];
  const w = W_WILD_TEAM[rg] || W_WILD_TEAM.plains;
  return { name: w.name, short: w.short, color: w.color, dark: tint(w.color, -.6), light: w.light, motto: '' };
}
function wBallName(club) { return wBallRegion(club) ? 'the ' + wBallTeam(club).name : wTheClub(club); }
function wBallTier(club) { return Math.max(1, Math.min(3, wTierHere() + (club === 'local' ? 0 : 1))); }
function wBallOppLvl(tier) { return Math.min(W_PARTY.maxLvl, wNineTier() + tier - 1); }
/* a club's nine: a player at every position, its own kinds first, at your level plus the tier, and W_BALL.oppBonus on
   every rating. Rivals keep the same nine until it would be a different level; the local nine is new each time. */
function wBallOpp(club, tier) {
  const def = wBallOppBase(club, tier), k = W_BALL.oppBonus[tier] || 0;
  if (k) for (const p of def.roster.concat(def.pen)) for (const s of wBD.stats) p[s] = Math.min(W_BDR.cap, p[s] + k);
  return def;
}
function wBallOppBase(club, tier) {
  const B = wBall(), lvl = wBallOppLvl(tier), C = wBallTeam(club);
  const cached = club !== 'local' && B.opp[club];
  if (cached && cached.lvl === lvl) return JSON.parse(JSON.stringify(cached.def));
  const rg = wBallRegion(club), own = rg ? (DB.regions[rg] || {}).kinds || [] : (C.roster || []).map(r => r[1]);
  const used = new Set(), names = new Set();
  const mk = (pos, as) => {
    const ks = wBD.kindsAt(pos), kind = ks.find(k => own.includes(k) && !used.has(k)) || ks.find(k => !used.has(k)) || pick(ks);
    used.add(kind);
    const rn = (C.roster || []).find(r => r[1] === kind), free = (FA_NAMES[kind] || []).filter(n => !names.has(n));
    const p = wMakePlayer({ kind, lvl, n: rn && !names.has(rn[0]) ? rn[0] : free.length ? pick(free) : undefined, num: rn ? rn[2] : undefined }, 'opp');
    names.add(p.n);
    return Object.assign(wNineBdPlayer(p, as || pos), { rid: null });
  };
  const roster = W_NINE.pos.map(pos => mk(pos));
  const def = { id: 'opp', name: C.name, short: C.short, color: C.color, trim: C.dark, light: C.light, motto: C.motto || '', roster, pen: [mk('P', 'RP')] };
  if (club !== 'local') B.opp[club] = { lvl, def: JSON.parse(JSON.stringify(def)) };
  return def;
}

/* ---------- starting, leaving, coming back ---------- */
function wStartBall(o) {
  if (!WG || !RUN) return '';
  const probs = wBallProblems(); if (probs.length) return probs.join(' ');
  const B = wBall(), club = o.club;
  if (B.live) return 'Finish the game you started first.';
  if (!wBallRegion(club) && !CLUBS[club]) return '';
  if (!o.cup && B.met[club] === WG.dayAbs) return `${wCap(wBallName(club))} have already played you today. Come back tomorrow.`;
  const how = W_BALL_HOW[o.how] ? o.how : 'play', tier = o.tier || wBallTier(club), home = !!o.home;
  const nine = wNineDef(), opp = wBallOpp(club, tier);
  const world = { kind: o.kind || 'ball', ref: o.ref || null, club, tier, home, how, day: WG.dayAbs, name: opp.name, cup: !!o.cup };
  const opts = { mode: how === 'sim' ? 'demo' : '1p', defs: home ? [opp, nine] : [nine, opp], humanSide: home ? 1 : 0,
    innings: W_BALL.innings, diff: W_BALL.diff[tier] != null ? W_BALL.diff[tier] : 1, rules: Object.assign({}, W_BALL.rules, { auto: how === 'manage' }) };
  if (!o.cup) B.met[club] = WG.dayAbs;
  B.live = { world, snap: null };
  WD = { opts, over: null, from: UI.view, ball: true };
  try {
    if (how === 'sim') { wBD.sim(opts); return ''; } // the final has been settled (wBallSettle) by the time this returns
    showView('diamond');
    wBD.start(opts);
  } catch (e) {
    // the game never got going: no game, and the club can play you today after all
    console.error(e); B.live = null; if (!o.cup) delete B.met[club];
    if (UI.view === 'diamond') wLeaveDiamond(); else WD = null;
    return 'The game could not start.';
  }
  wBallBar();
  wSave();
  return '';
}
function wResumeBall() {
  const L = wBallLive() && WG.ball.live;
  if (!L) return;
  if (!L.snap) { wBallCallOff('The game had not reached its first pitch, so it is called off.'); return; }
  WD = { opts: L.snap.opts || {}, over: null, from: UI.view, ball: true };
  showView('diamond');
  wBD.resume(JSON.parse(JSON.stringify(L.snap)));
  wBallBar();
}
// Save and leave: the snapshot from the start of this pitch stays in WG.ball.live
function wBallLeave() {
  const L = wBallLive() && WG.ball.live;
  if (!L) return wLeaveDiamond();
  const sn = L.snap;
  WBALL.asked = true;
  wLeaveDiamond();
  // before the first pitch there is nothing to keep: the game is called off, and the club can play you again today
  if (!sn) return wBallCallOff(`You leave before the first pitch, so the game against ${wBallName(L.world.club)} is called off.`);
  wLog(`Your game against ${wBallName(L.world.club)} is saved: ${wBallScore(sn)}. Resume it from the Nine tab on the Team screen.`, 'd');
  wSave();
}
// Brimstone Diamond's own End game (don't save): no result, and the club can play you again today
function wBallCallOff(why) {
  const B = wBall(), L = B.live; if (!L) return;
  B.live = null; if (!L.world.cup) delete B.met[L.world.club];
  wLog(why || `The game against ${wBallName(L.world.club)} is called off. No result.`, 'd');
  wSave();
}
function wBallConcede() {
  const L = wBallLive() && WG.ball.live; if (!L) return;
  // the game stops while you decide (its Time out), and goes on if you don't
  wBD.pause(true);
  askConfirm('Concede this game?', 'It counts as a loss. A loss on the diamond costs nothing, but you only get a quarter of the XP.', 'Concede', () => {
    if (!wBallLive()) return;
    wBD.pause(false);
    const sn = L.snap, me = L.world.home ? 1 : 0;
    wBallSettle('lose', sn ? sn.teams[me].R : 0, sn ? sn.teams[1 - me].R : 0, [], sn ? sn.inning : 1);
    wLeaveDiamond();
  }, () => { wBD.pause(false); wBallFocusField(); });
  // (closed with Escape or a click outside: go on, as if you'd said no)
  wAfterAsk(() => { if (wBallLive() && wBD.paused) wBD.pause(false); });
}
// after a button on the bar, the keys go back to the field (Space would press the button again, and swing)
function wBallFocusField() { const a = document.activeElement; if (a && a.blur && $('wDiamondBar').contains(a)) a.blur(); }
function wBallScore(sn) {
  const [a, h] = sn.defs, [ta, th] = sn.teams;
  return `${a.short || a.name} ${ta.R}, ${h.short || h.name} ${th.R}, ${sn.half ? 'bottom' : 'top'} of the ${wOrd(sn.inning)}`;
}
function wOrd(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

/* ---------- the final ---------- */
const wW20dDiamondOver = wDiamondOver;
wDiamondOver = function () {
  if (!(WD && WD.ball && wBallLive())) return wW20dDiamondOver();
  const G = wBD.G, L = WG.ball.live, me = L.world.home ? 1 : 0, us = G.teams[me].R, them = G.teams[1 - me].R;
  WD.over = { runs: [G.teams[0].R, G.teams[1].R], win: us > them ? me : 1 - me };
  const box = wBD.box().filter(b => b.side === me);
  const msg = wBallSettle(us > them ? 'win' : 'lose', us, them, box, G.inning);
  if (L.world.how === 'sim') { WD = null; wBallResultCard(msg); return; }
  $('wDiamondNote').textContent = msg;
  wBallBar();
  $('wDiamondBack').focus();
};
/* the result in the world: box lines, XP, gold and fans, head to head, the league table. Returns the line to show. */
function wBallSettle(r, us, them, box, inning) {
  const B = wBall(), L = B.live, W = L.world, win = r === 'win';
  B.live = null;
  if (win) B.w++; else B.l++;
  // box scores, for your own players (call-ups and the other side have no rid that is yours)
  const S = WG.bstats = WG.bstats || {}, line = {};
  for (const b of box) {
    if (typeof b.rid !== 'number' || !wPlayer(b.rid)) continue;
    const T = S[b.rid] = S[b.rid] || { bg: 0 };
    T.bg++;
    for (const k in b.line) if (typeof b.line[k] === 'number') T[k] = (T[k] || 0) + b.line[k];
    line[b.rid] = { ab: b.line.ab, h: b.line.h, hr: b.line.hr, rbi: b.line.rbi, r: b.line.r, sb: b.line.sb, outsP: b.line.outsP, k: b.line.k, ra: b.line.ra };
  }
  const mvp = wBallMvp(box);
  // XP: the nine in full, your players who sat out a share; nothing for call-ups
  const base = Math.round(W_BALL.xp * W.tier * (win ? 1 : W_BALL.lossShare)), bits = [];
  const N = WG.nine || { order: [] }, inNine = new Set(N.order.map(o => o.id));
  for (const p of wRoster()) {
    const n = inNine.has(p.id) ? base + (win && mvp === p.id ? W_BALL.mvpXp : 0) : Math.round(base * W_BALL.benchShare);
    if (n > 0) wGiveXp(p, n);
  }
  bits.push(`XP +${base} for the nine${wRoster().some(p => !inNine.has(p.id)) ? `, +${Math.round(base * W_BALL.benchShare)} for those who sat out` : ''}`);
  let pay = '';
  if (win) {
    const g = W_BALL.gold * W.tier, f = W_BALL.fans * W.tier;
    RUN.gold += g; RUN.fans = (RUN.fans || 0) + f; pay = ` +${g} gold, +${f} fans.`;
  }
  // head to head, and the league table when it's a rival
  if (CLUBS[W.club]) {
    const H = wH2h(), h = H[W.club] = H[W.club] || { w: 0, l: 0 };
    if (win) h.w++; else h.l++;
    h.last = { r: win ? 'win' : 'lose', us, them, sport: 'baseball', day: WG.dayAbs };
    try { if (wIsRival(W.club)) wLeagueMine(r); } catch (e) { console.error(e); }
  }
  B.games.unshift({ day: WG.dayAbs, club: W.club, name: W.name, tier: W.tier, home: W.home, how: W.how, r, us, them, inn: inning, mvp, line });
  B.games.length = Math.min(B.games.length, W_BALL.keep);
  wAdvance(W_BALL.minutes);
  WG.lastMatch = { kind: W.kind, result: r, day: WG.dayAbs, tier: W.tier };
  W.us = us; W.them = them;
  const f = W_ON_END[W.kind]; if (f) { try { f(r, W.ref, W); } catch (e) { console.error(e); } }
  const who = mvp != null && wPlayer(mvp);
  const msg = `Final: ${win ? 'you win' : 'you lose'} ${us}–${them} against ${wBallName(W.club)}.${pay} ${bits.join('')}${win && who ? `, and +${W_BALL.mvpXp} for ${who.n}, player of the game` : ''}.`;
  wLog(msg, win ? 'g' : 'b');
  wSave();
  return msg;
}
// player of the game: the best line among your own players (hits and power, runs, steals; outs and strikeouts pitched)
function wBallMvp(box) {
  let best = null, bs = 0;
  for (const b of box) {
    if (typeof b.rid !== 'number' || !wPlayer(b.rid)) continue;
    const s = b.line, v = (s.h || 0) + (s.d || 0) + 2 * (s.t || 0) + 3 * (s.hr || 0) + (s.rbi || 0) + (s.r || 0) + (s.sb || 0) + (s.outsP || 0) / 3 + (s.k || 0) / 2 - (s.ra || 0);
    if (v > bs) { bs = v; best = b.rid; }
  }
  return best;
}
W_ON_END.ball = function () { }; // the log line and the rewards are paid in wBallSettle; kinds built on it add theirs
function wBallResultCard(msg) {
  if (LAB) return;
  const close = modal(`<header><h3>Final</h3></header><div class="wmsg"><p>${esc(msg)}</p></div><div class="row"><button class="btn" id="wBallOk">Done</button></div>`, () => wDrain());
  $('wBallOk').focus(); $('wBallOk').onclick = () => close();
}
const wW20dLeaveDiamond = wLeaveDiamond;
wLeaveDiamond = function () { const back = !!WD; wW20dLeaveDiamond(); if (back && WG) { wSave(); wDrain(); } };
wBD.onQuit = () => {
  if (UI.view !== 'diamond') return;
  if (WD && WD.ball && wBallLive()) wBallCallOff();
  wLeaveDiamond();
};
wBD.onSnap = sn => {
  const L = WD && WD.ball && wBallLive() && WG.ball.live; if (!L) return;
  L.snap = JSON.parse(JSON.stringify(sn));
  const now = Date.now(); if (now - WBALL.saved > W_BALL.saveMs) { WBALL.saved = now; wSave(); }
};

/* ---------- the bar above the field ---------- */
$('wDiamondBack').insertAdjacentHTML('beforebegin', '<button class="ghost" id="wBallSave" hidden>Save and leave</button><button class="ghost" id="wBallGive" hidden>Concede</button>');
$('wBallSave').onclick = () => wBallLeave();
$('wBallGive').onclick = () => { wBallFocusField(); wBallConcede(); };
function wBallBar() {
  const live = !!(WD && WD.ball && wBallLive());
  $('wBallSave').hidden = $('wBallGive').hidden = !live; $('wDiamondBack').hidden = live;
  if (!live || !wBD.G.teams) return; // showView comes before the game is on the field: the caller draws the bar again
  const W = WG.ball.live.world, [a, h] = wBD.G.teams;
  $('wDiamondTitle').textContent = `${a.def.name} at ${h.def.name}`;
  $('wDiamondNote').textContent = `${W.how === 'manage' ? 'Managing: your players cast their own powers' : 'You play every pitch'}. ${W_BALL.innings} innings, CPU skill ${W_BALL_SKILL[W_BALL.diff[W.tier]] || 'Knight'}. Space to swing or pitch, WASD to aim and run, G for powers, T for Auto powers, Esc for Time out.`;
}
// T on the diamond switches Auto powers for the game: Play becomes Manage and back, and the bar says so
wBD.onAuto = on => { const L = WG && WG.ball && WG.ball.live; if (!L || !L.world || L.world.how === 'sim') return; L.world.how = on ? 'manage' : 'play'; wBallBar(); };
const wW20dShowView = showView;
showView = function (v) { wW20dShowView(v); if (v === 'diamond') wBallBar(); else { $('wBallSave').hidden = $('wBallGive').hidden = true; $('wDiamondBack').hidden = false; } };

/* ---------- picking a game ---------- */
function wBallH2h(club) { const L = ((WG.h2h || {})[club] || {}).last; return L && L.sport === 'baseball' ? L : null; }
function wOpenBallCard(o) {
  o = o || {};
  const probs = wBallProblems(), B = wBall();
  const rows = wBallClubs().map(c => {
    const T = wBallTeam(c), tier = wBallTier(c), met = B.met[c] === WG.dayAbs, last = wBallH2h(c), h = (WG.h2h || {})[c];
    const btns = Object.keys(W_BALL_HOW).map(how => `<button class="${how === 'play' ? 'btn' : 'ghost'}" data-bclub="${c}" data-bhow="${how}" ${probs.length || met ? 'disabled' : ''}>${W_BALL_HOW[how]}</button>`).join('');
    return `<li class="wbcl"><span class="wbsw" style="background:${T.color}"></span><div><b>${esc(T.name)}</b>
      <small>Tier ${tier}: their players are level ${wBallOppLvl(tier)}, CPU skill ${W_BALL_SKILL[W_BALL.diff[tier]]}.${last ? ` Last game: ${last.r === 'win' ? 'won' : 'lost'} ${last.us}–${last.them}.` : ''}${h && c !== 'local' ? ` Head to head (every sport) ${h.w}–${h.l}.` : ''}${met ? ' <b>Played you today.</b>' : ''}</small></div>
      <div class="row">${btns}</div></li>`;
  }).join('');
  const close = modal(`<header><h3>${o.home ? 'Host a ball game' : 'Play a ball game'}</h3><button class="ghost" data-close>Done</button></header>
    ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}${WBALL.msg ? `<p class="wbad">${esc(WBALL.msg)}</p>` : ''}
    <p class="hint">${W_BALL.innings} innings on the diamond with your nine${o.home ? ', at your ground' : ''}. <b>Play</b>: you pitch, swing and run. <b>Manage</b>: you do too, but your players cast their own powers. <b>Simulate</b>: the result now. Press T during a game to switch between Play and Manage. A win pays ${W_BALL.xp} XP to the nine, ${W_BALL.gold} gold and ${W_BALL.fans} fans, times the tier; a loss pays a quarter of the XP and costs nothing else. Each club plays you once a day, and a game takes ${W_BALL.minutes / 60 | 0} hours or so.</p>
    <ul class="wbclubs">${rows}</ul>`);
  WBALL.msg = '';
  $('modalBox').querySelectorAll('[data-bclub]').forEach(b => b.onclick = () => {
    close();
    const r = wStartBall({ club: b.dataset.bclub, how: b.dataset.bhow, home: !!o.home });
    if (r) { WBALL.msg = r; wOpenBallCard(o); }
  });
}
/* a card pick that another panel opened on top of (a click that closes one panel and opens the next, while closing it
   raised the pick) comes back once the world is free, rather than holding up every prompt after it */
const wSdModal = modal;
modal = function (html, onClose) {
  if (WG && WG.cardOffer && !$('modal').hidden && $('modalBox').querySelector('[data-wco]')) WBALL.buried = WG.cardOffer;
  return wSdModal(html, onClose);
};
/* after a reload, a saved game is waiting: ask once */
const wW20dNextPrompt = wNextPrompt;
wNextPrompt = function () {
  if (!LAB && WG && WBALL.buried) {
    // a tick later, so whatever the click that freed the world opens next (a game, another panel) goes first
    if (WG.cardOffer !== WBALL.buried) WBALL.buried = null;
    else {
      if (wActive() && !WBALL.later) WBALL.later = setTimeout(() => { WBALL.later = 0; if (WG && WBALL.buried && WG.cardOffer === WBALL.buried && wActive()) { WBALL.buried = null; wShowCardOffer(); } }, 0);
      return true;
    }
  }
  if (!LAB && wBallLive() && !WBALL.asked && !WD && !WG.cardOffer && !WG.event && wActive()) {
    WBALL.asked = true;
    const L = WG.ball.live, sn = L.snap;
    const close = modal(`<header><h3>A game is waiting</h3></header><div class="wmsg"><p>Your game against ${esc(wBallName(L.world.club))} is where you left it${sn ? `: ${esc(wBallScore(sn))}` : ''}.</p><p class="hint">You can also pick it up later from the Nine tab on the Team screen.</p></div>
      <div class="row"><button class="btn" id="wBallRes">Resume</button><button class="ghost" id="wBallLater">Later</button></div>`, () => wDrain());
    $('wBallRes').focus();
    $('wBallRes').onclick = () => { close(); wResumeBall(); };
    $('wBallLater').onclick = () => close();
    return true;
  }
  return wW20dNextPrompt();
};

/* ---------- the Nine tab and the home ground ---------- */
const wW20dCampNine = wCampNine;
wCampNine = function () {
  const html = wW20dCampNine(), probs = wBallProblems(), live = wBallLive();
  const play = live ? `<button class="btn" data-nresume>Resume the game</button>` : `<button class="btn" data-nplay ${probs.length ? 'disabled' : ''}>Play a game</button>`;
  const gate = !live && wRoster().length < W_BALL.minOwn ? `<p class="hint wball">${esc(probs[0])}</p>` : '';
  return html.replace('<button class="btn" data-nwatch', `${play}<button class="ghost" data-nwatch`).replace(/<\/div>\s*$/, `</div>${gate}${wBallRecent()}`);
};
function wBallRecent() {
  const B = WG.ball; if (!B || !B.games.length) return '';
  return `<h5 class="wbrh">Last ball games: ${B.w}&ndash;${B.l}</h5><ol class="wstlog">${B.games.slice(0, 5).map(g => `<li><b class="${g.r === 'win' ? 'wgood' : 'wbad'}">${g.r === 'win' ? 'Won' : 'Lost'}</b> ${g.us}&ndash;${g.them} against ${esc(g.name)}<small>day ${g.day}${g.mvp != null && wPlayer(g.mvp) ? `, player of the game ${esc(wPlayer(g.mvp).n)}` : ''}</small></li>`).join('')}</ol>`;
}
const wW20dRenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW20dRenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'nine') return;
  const p = body.querySelector('[data-nplay]'); if (p) p.onclick = () => { WCAMP.close(); wOpenBallCard(); };
  const r = body.querySelector('[data-nresume]'); if (r) r.onclick = () => { WCAMP.close(); wResumeBall(); };
};
const wW20dOpenGround = wOpenGround;
wOpenGround = function (town, msg) {
  wW20dOpenGround(town, msg);
  const G = wHomeGround(), sl = $('wGroundSleep');
  if (!G || G.town !== (town || WG.map) || !sl) return;
  sl.insertAdjacentHTML('afterend', `<button class="ghost" id="wGroundBall">Host a ball game</button>`);
  $('wGroundBall').onclick = () => { $('modalBox').querySelector('[data-close]').click(); if (wBallLive()) wResumeBall(); else wOpenBallCard({ home: true }); };
};

/* ---------- box scores on the Stats tab ---------- */
const W_BALL_COLS = [['bg', 'G', 'Ball games'], ['ab', 'AB', 'At bats'], ['h', 'H', 'Hits'], ['hr', 'HR', 'Home runs'], ['rbi', 'RBI', 'Runs batted in'],
  ['avg', 'AVG', 'Batting average'], ['sb', 'SB', 'Stolen bases'], ['ip', 'IP', 'Innings pitched'], ['era', 'ERA', 'Earned run average (runs per 9 innings)'], ['k', 'K', 'Strikeouts pitched']];
function wBallLine(pid) { return (WG.bstats || {})[pid] || null; }
function wBallVal(L, c) {
  if (!L) return null;
  if (c === 'avg') return L.ab ? L.h / L.ab : null;
  if (c === 'ip') return L.outsP ? L.outsP / 3 : null;
  if (c === 'era') return L.outsP ? L.ra * 27 / L.outsP : null;
  return L[c] || 0;
}
function wBallFmt(v, c) {
  if (v == null) return '<span class="dim">&ndash;</span>';
  if (c === 'avg') return v.toFixed(3).replace(/^0/, '');
  if (c === 'ip') { const o = Math.round(v * 3); return `${Math.floor(o / 3)}.${o % 3}`; }
  if (c === 'era') return v.toFixed(2);
  return v;
}
const wW20dCampStats = wCampStats;
wCampStats = function () {
  const html = wW20dCampStats().replace(/(<button data-wsview="career"[^>]*>Career<\/button>)/, `$1<button data-wsview="baseball" aria-pressed="${WSTAT.view === 'baseball'}">Baseball</button>`);
  if (WSTAT.view !== 'baseball') return html;
  const k = WSTAT.sort && W_BALL_COLS.some(c => c[0] === WSTAT.sort) ? WSTAT.sort : null;
  const rows = wRoster().map((p, i) => ({ p, i, L: wBallLine(p.id) }));
  if (k) rows.sort((a, b) => ((wBallVal(b.L, k) ?? -1) - (wBallVal(a.L, k) ?? -1)) || a.i - b.i);
  const head = `<th scope="col"><button class="wsth" data-wsort="" aria-pressed="${!k}">Player</button></th>` + W_BALL_COLS.map(([c, s, l]) => `<th scope="col"><button class="wsth" data-wsort="${c}" title="${esc(l)}" aria-pressed="${k === c}">${s}</button></th>`).join('');
  const body = rows.map(({ p, L }) => `<tr data-wsp="${p.id}"${WSTAT.pid === p.id ? ' class="wsel"' : ''}><th scope="row"><button class="wsname" data-wsp-open aria-expanded="${WSTAT.pid === p.id}"><img src="${wPlayerPort(p, 40)}" alt=""><span><b>${esc(p.n)}</b><small>${esc(W_BDR.pos[wBdOf(p).pos] || '')}, Lv ${p.lvl}</small></span></button></th>
    ${W_BALL_COLS.map(([c]) => `<td>${wBallFmt(wBallVal(L, c), c)}</td>`).join('')}</tr>`).join('');
  const sel = WSTAT.pid != null && wPlayer(WSTAT.pid);
  return html.replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Every ball game they played on this journey (call-ups are not counted). Pick a heading to sort, a player to see more.</small>')
    .replace(/<div class="tablewrap">[\s\S]*$/, `<div class="tablewrap"><table class="wstats"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${sel ? wStatsCard(sel) : ''}`);
};
const wW20dStatsCard = wStatsCard;
wStatsCard = function (p) {
  const L = wBallLine(p.id), html = wW20dStatsCard(p);
  if (!L || !L.bg) return html;
  const v = c => wBallFmt(wBallVal(L, c), c);
  const bat = `${L.bg} ball game${L.bg === 1 ? '' : 's'}: ${v('avg')} AVG, ${L.h || 0} hits in ${L.ab || 0} at bats, ${L.hr || 0} HR, ${L.rbi || 0} RBI, ${L.sb || 0} stolen.`;
  const pit = L.outsP ? ` Pitching: ${v('ip')} innings, ${v('era')} ERA, ${L.k || 0} strikeouts, ${L.w || 0}&ndash;${L.l || 0}.` : '';
  return html.replace('<div class="wbd"><h5>Baseball</h5>', `<div class="wbd"><h5>Baseball</h5><p class="wbdbox">${bat}${pit}</p>`);
};

const wW20dRenderHelp = renderHelp;
renderHelp = function () {
  wW20dRenderHelp();
  const nine = $('wHelpNine'); if (!nine || $('wHelpBall')) return;
  nine.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpBall"><b>Ball games.</b> Once you have ${W_BALL.minOwn} players of your own, your nine can play baseball: Play a game on the Nine tab, or Host a ball game at your ground. Take on the local nine or a rival club, once a day each. Play every pitch, Manage (your players cast their own powers), or Simulate for the result at once. On the field: Space to swing or pitch, WASD or the arrows to aim and run, G for powers, T to switch Auto powers, Esc for Time out. There is no team HP on the diamond. A win pays XP to the nine (half to players who sat out), gold and fans; a loss pays a quarter of the XP. Save and leave keeps a game where it is. The Stats tab's Baseball view has every player's box score.</p>`);
};
