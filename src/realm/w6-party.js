/* w6: the party is the team. A roster of up to 8 players; the first 3 start, the rest sit on the bench.

   WG.roster   [{ id, n, kind, num, flav, lvl, xp, joined, from }] in lineup order: 0..2 start, 3.. are the bench.
               from: 'founder' | 'tavern' | 'postgame' | 'quest'. joined: the day (WG.dayAbs) they signed.
   WG.pid      the next player id.
   WG.rivals   { companyId: SD club id }: the four TC companies play as these SD clubs (never yours). Phase 6 uses it.
   WG.tavern   { townId: { week, list: [player + fee] } }: free agents, new every week.
   WG.wprompts [{ t: 'level', pid, lvl } | { t: 'recruit', p }]: things to show the player once the world is free.
   WG.wwait    quest companions who could not join a full roster; they wait at camp.

   Cards belong to players. RUN.deck is the whole collection while you are in the world. A card with `wp` (a player
   id) belongs to that player and only plays when they start; a card without one (league cards, and kind cards
   nobody on the roster plays) always plays. At kickoff the benched players' cards move to RUN.wbench, so the
   match, its mid-match saves and SD's reward panel all see just the match deck; when the match ends they come
   back. A card won in a match is tagged to the starter of its kind.

   Sudden Death functions reassigned here: renderDraft (the realm's new game), logGame and updateCareers (careers
   grow match by match, keyed club:name), deleteProfile (also deletes that profile's realm save).
   Realm functions wrapped here: wKickoff (the match deck), finishFight (who you beat, for post-game recruits),
   wDispatchEnd (XP, bench cards back, recruits), wGainCard (a card for a particular player), wRunAct (taverns). */

const W_PARTY = {
  max: 8, starters: 3, maxLvl: 10, hpPerLvl: 2,
  xp: { normal: 10, elite: 20, rival: 25, boss: 40 },   // a win at tier 1; times the tier
  lossShare: .25, benchShare: .5, mvpXp: 5,
  recruitOdds: { normal: .15, elite: .35, rival: .35, boss: .35 },
  force: false,                                            // tests: the next win always brings a recruit
};
const wXpNeed = lvl => 10 + 10 * lvl + 2 * lvl * lvl;     // level 1 to 2: 22 XP; 2 to 3: 38; 9 to 10: 262 (bot-tuned, phase 7)
const wFee = lvl => 30 + 30 * lvl;                         // a free agent's signing fee in gold

/* ---------- the roster ---------- */
function wRoster() { return (WG && WG.roster) || []; }
function wStarters() { return wRoster().slice(0, W_PARTY.starters); }
function wBenchList() { return wRoster().slice(W_PARTY.starters); }
function wPlayer(pid) { return wRoster().find(p => p.id === pid) || null; }
function wIsStarter(pid) { return wStarters().some(p => p.id === pid); }
function wPartyRow(p) { return { n: p.n, kind: p.kind, num: p.num, flav: p.flav }; }
function wKindName(k) { return KIND_NAME[k] || k; }

/* only one player of each kind can start (Sudden Death credits a match's stats by kind): move any second one of a
   kind down to the bench, keeping everyone else's order */
function wNormalizeLineup() {
  const R = wRoster(), st = [], rest = [];
  for (const p of R) (st.length < W_PARTY.starters && !st.some(s => s.kind === p.kind) ? st : rest).push(p);
  WG.roster = st.concat(rest);
}
function wLineupProblem(order) {
  const st = order.slice(0, W_PARTY.starters);
  const dup = st.find((p, i) => st.findIndex(q => q.kind === p.kind) !== i);
  return dup ? `Only one ${wKindName(dup.kind)} can start at a time.` : '';
}
/* RUN.party (who plays, for runKinds, cardPool, SIG, the HUD) is always the three starters */
function wSyncParty() {
  if (!RUN || !WG || !WG.roster || !WG.roster.length) return;
  RUN.party = wStarters().map(wPartyRow);
  const kinds = RUN.party.map(p => p.kind);
  for (const c of RUN.deck) if (c.own && c.own !== 'line' && !kinds.includes(c.own)) delete c.own;
  assignOwners();
}
/* every kind card belongs to a player: the starter of that kind, else anyone of that kind */
function wTagCards() {
  if (!RUN || !WG || !WG.roster) return;
  const R = wRoster(), st = wStarters();
  for (const c of RUN.deck.concat(RUN.wbench || [])) {
    if (c.wp != null && R.some(p => p.id === c.wp)) continue;
    const k = (CARDS[c.id] || {}).kind;
    const p = k && k !== 'any' && (st.find(q => q.kind === k) || R.find(q => q.kind === k));
    if (p) c.wp = p.id; else delete c.wp;
  }
}
function wAllCards() { return RUN ? RUN.deck.concat(RUN.wbench || []) : []; }
function wCardsOf(pid) { return wAllCards().filter(c => c.wp === pid); }
function wLeagueCards() { return wAllCards().filter(c => c.wp == null); }
/* the deck the next match would use */
function wNextMatchDeck() { const ids = new Set(wStarters().map(p => p.id)); return wAllCards().filter(c => c.wp == null || ids.has(c.wp)); }

/* set up the roster: a new journey (from RUN.party), or a save from before phase 3. Called by wStart. */
function wPartyInit() {
  if (!WG || !RUN) return;
  RUN.wbench = RUN.wbench || [];
  if (!WG.roster || !WG.roster.length) {
    WG.pid = 1;
    WG.roster = RUN.party.map(p => Object.assign(wPartyRow(p), { id: WG.pid++, lvl: 1, xp: 0, joined: WG.dayAbs || 1, from: 'founder' }));
  }
  WG.pid = Math.max(WG.pid || 1, ...WG.roster.map(p => p.id + 1));
  WG.rivals = WG.rivals || wRivalMap(RUN.club);
  WG.tavern = WG.tavern || {};
  WG.wprompts = WG.wprompts || [];
  WG.wwait = WG.wwait || [];
  UID = Math.max(UID, ...wAllCards().map(c => (c.uid || 0) + 1));
  // a match in progress keeps its deck as it is; otherwise the collection is whole
  if (!RUN.battle && !RUN.pending && !(RUN.panel && RUN.panel.t === 'reward')) wRestoreBench();
  wTagCards();
  if (!RUN.battle && !RUN.pending) { wNormalizeLineup(); wSyncParty(); }
}
/* the four TC companies play as SD clubs: never yours, never the same one twice */
function wRivalMap(club) {
  const ids = shuffle(CLUB_IDS.filter(c => c !== club && c !== 'free' && CLUBS[c]));
  const out = {}; Object.keys(DB.companies).forEach((k, i) => { out[k] = ids[i % ids.length]; });
  return out;
}

/* ---------- lineup changes (the camp calls these; each returns '' or a reason it cannot) ---------- */
function wSetOrder(pids) {
  const R = wRoster(), order = pids.map(wPlayer).filter(Boolean);
  if (order.length !== R.length) return 'Something went wrong with the lineup.';
  const why = wLineupProblem(order); if (why) return why;
  WG.roster = order; wSyncParty(); wTagCards(); wSave();
  return '';
}
function wMovePlayer(pid, to) {
  const R = wRoster().slice(), i = R.findIndex(p => p.id === pid); if (i < 0) return '';
  to = clamp(to, 0, R.length - 1); if (to === i) return '';
  const [p] = R.splice(i, 1); R.splice(to, 0, p);
  return wSetOrder(R.map(p => p.id));
}
/* swap a bench player with a starter */
function wSwap(a, b) {
  const R = wRoster().slice(), i = R.findIndex(p => p.id === a), j = R.findIndex(p => p.id === b);
  if (i < 0 || j < 0) return '';
  [R[i], R[j]] = [R[j], R[i]];
  return wSetOrder(R.map(p => p.id));
}

/* ---------- the match deck: benched players' cards sit out ---------- */
function wRestoreBench() {
  if (!RUN) return;
  if (RUN.wbench && RUN.wbench.length) { const have = new Set(RUN.deck.map(c => c.uid)); RUN.deck = RUN.deck.concat(RUN.wbench.filter(c => !have.has(c.uid))); }
  RUN.wbench = [];
}
function wBenchCards() {
  wRestoreBench(); wNormalizeLineup(); wSyncParty(); wTagCards();
  const ids = new Set(wStarters().map(p => p.id));
  RUN.wbench = RUN.deck.filter(c => c.wp != null && !ids.has(c.wp));
  RUN.deck = RUN.deck.filter(c => c.wp == null || ids.has(c.wp));
}
const wW5Kickoff = wKickoff;
wKickoff = function (enc) { if (WG && RUN && WG.roster) wBenchCards(); return wW5Kickoff(enc); };

/* who you beat, for the post-game recruit: kinds that play in the league (they have a signature card) */
const wW5FinishFight = finishFight;
finishFight = function () {
  if (WG && B && B.over === 'win' && RUN && RUN.pending && RUN.pending.world)
    WG.wfoes = { type: B.type, tier: RUN.pending.world.tier, kinds: B.enemies.map(e => e.kind).filter(k => SIG[k] && FA_NAMES[k]) };
  return wW5FinishFight();
};

/* the end of every match, win or lose: cards back from the bench, XP, and maybe a recruit */
const wW5DispatchEnd = wDispatchEnd;
wDispatchEnd = function (W, r) {
  wW5DispatchEnd(W, r);
  if (!W || !WG || !WG.roster) return;
  wRestoreBench(); wTagCards();
  try { wMatchXp(W, r); if (r === 'win') wPostGameRecruit(); } catch (e) { console.error(e); }
  WG.wfoes = null;
  wSave();
};

/* ---------- XP and levels ---------- */
function wMatchXp(W, r) {
  const g = (RUN.games || [])[RUN.games.length - 1] || {};
  const type = (WG.wfoes && WG.wfoes.type) || g.type || 'normal';
  const base = Math.round((W_PARTY.xp[type] || W_PARTY.xp.normal) * (W.tier || 1) * (r === 'win' ? 1 : W_PARTY.lossShare));
  if (base <= 0) return;
  const bits = [];
  for (const p of wStarters()) { const mvp = r === 'win' && g.mvp === p.kind; const n = base + (mvp ? W_PARTY.mvpXp : 0); wGiveXp(p, n); bits.push(`${p.n} +${n}${mvp ? ' (player of the game)' : ''}`); }
  const bn = Math.round(base * W_PARTY.benchShare);
  if (wBenchList().length && bn) { for (const p of wBenchList()) wGiveXp(p, bn); bits.push(`the bench +${bn} each`); }
  wLog('XP: ' + bits.join(', ') + '.', 'm');
}
function wGiveXp(p, n) {
  if (p.lvl >= W_PARTY.maxLvl) { p.xp = 0; return; }
  p.xp += n;
  while (p.lvl < W_PARTY.maxLvl && p.xp >= wXpNeed(p.lvl)) {
    p.xp -= wXpNeed(p.lvl); p.lvl++;
    RUN.maxhp += W_PARTY.hpPerLvl; RUN.hp += W_PARTY.hpPerLvl;
    wLog(`${p.n} reaches level ${p.lvl}. The team's max HP goes up by ${W_PARTY.hpPerLvl}.`, 'g');
    WG.wprompts.push({ t: 'level', pid: p.id, lvl: p.lvl });
  }
  if (p.lvl >= W_PARTY.maxLvl) p.xp = 0;
}
/* a level-up card comes from the player's own kind: commons and uncommons early, uncommons and rares later */
function wKindPool(kind, lvl) {
  const rars = lvl >= 6 ? ['u', 'r'] : lvl >= 3 ? ['c', 'u', 'r'] : ['c', 'u'];
  return Object.values(CARDS).filter(c => c.kind === kind && rars.includes(c.rar)).map(c => c.id);
}
/* a card for a particular player: { pick, pool, pid } or { id, pid }. The pick-one panel carries pid through. */
const wW5GainCard = wGainCard;
wGainCard = function (spec, why) {
  const r = wW5GainCard(spec, why);
  const pid = spec && typeof spec === 'object' ? spec.pid : null;
  if (r && pid != null) {
    if (Array.isArray(r)) { if (WG.cardOffer) { WG.cardOffer.pid = pid; wLevelBanner(pid); } }
    else r.wp = pid;
  }
  if (r && !Array.isArray(r)) wTagCards();
  if (r) wSave();
  return r;
};
function wLevelBanner(pid) {
  const p = wPlayer(pid), box = $('modalBox');
  if (LAB || !p || $('modal').hidden || !box || box.querySelector('.wlvl')) return;
  const hd = box.querySelector('header'); if (!hd) return;
  hd.insertAdjacentHTML('afterend', `<div class="wlvl"><img src="${portraitURL(p.kind, wPartyTeam(), p.num, 96)}" alt=""><div><small>Level up</small><b>${esc(p.n)} is level ${p.lvl}</b><span>The team's max HP is now ${RUN.maxhp}. Pick a ${esc(wKindName(p.kind))} card for ${esc(p.n)}.</span></div></div>`);
}

/* ---------- recruiting: every way in ends here ---------- */
function wMakePlayer(spec, from) {
  const kind = KIND_NAME[spec.kind] ? spec.kind : 'goblin';
  const taken = new Set(wRoster().map(p => p.n));
  const names = (FA_NAMES[kind] || ['Rookie']).filter(n => !taken.has(n));
  return { n: spec.n || pick(names.length ? names : FA_NAMES[kind] || ['Rookie']), kind, num: spec.num != null ? spec.num : ri(0, 99),
    flav: spec.flav || pick(FA_SCOUT[kind] || ['A new face.']), lvl: clamp(spec.lvl || 1, 1, W_PARTY.maxLvl), xp: 0, from: from || spec.from || 'tavern' };
}
/* adds a player with their signature card and 1-2 cards of their kind. A full roster asks who to release first:
   done(true) once they have joined, done(false) if you let them go. Returns the player, or null if it asked. */
function wRecruit(player, from, done) {
  const p = wMakePlayer(player, from);
  if (wRoster().length >= W_PARTY.max) { if (LAB) { done && done(false); return null; } wOfferRelease(p, done); return null; }
  wAddPlayer(p);
  if (done) done(true);
  return p;
}
function wAddPlayer(p) {
  p.id = WG.pid++; p.joined = WG.dayAbs; p.xp = p.xp || 0;
  WG.roster.push(p);
  wNormalizeLineup(); wSyncParty();
  wLog(`${p.n} the ${wKindName(p.kind)} joins the team${wIsStarter(p.id) ? ' and starts the next match' : ', on the bench for now'}.`, 'g');
  if (SIG[p.kind]) wGainCard({ id: SIG[p.kind], pid: p.id }, `${p.n}'s signature card`);
  for (const id of shuffle(wKindPool(p.kind, 1)).slice(0, ri(1, 2))) wGainCard({ id, pid: p.id }, `${p.n} brings it`);
  wSave();
  return p;
}
/* release: they leave, and so do their cards, unless someone else on the team plays that kind */
function wRelease(pid) {
  const p = wPlayer(pid); if (!p) return 'Nobody by that name.';
  if (wRoster().length <= W_PARTY.starters) return `You need at least ${W_PARTY.starters} players.`;
  WG.roster = WG.roster.filter(x => x.id !== pid);
  const heir = WG.roster.find(x => x.kind === p.kind), mine = c => c.wp === pid;
  let gone = 0;
  if (heir) for (const c of wAllCards()) { if (mine(c)) c.wp = heir.id; }
  else { gone = wAllCards().filter(mine).length; RUN.deck = RUN.deck.filter(c => !mine(c)); RUN.wbench = (RUN.wbench || []).filter(c => !mine(c)); }
  wNormalizeLineup(); wSyncParty(); wTagCards();
  wLog(`${p.n} leaves the team${gone ? ` and takes ${gone} card${gone === 1 ? '' : 's'} with them` : heir ? `. ${heir.n} keeps their cards` : ''}.`, 'd');
  wSave();
  return '';
}
function wPlayerPort(p, size) { return portraitURL(p.kind, wPartyTeam(), p.num, size || 76); }
function wOfferRelease(p, done) {
  const R = wRoster();
  const close = modal(`<header><h3>The roster is full</h3></header>
    <p>${esc(p.n)} the ${esc(wKindName(p.kind))} (level ${p.lvl}) wants to join, but you already have ${R.length} players. Release one to make room?</p>
    <div class="wrel">${R.map(x => `<button class="ghost wrelb" data-rel="${x.id}"><img src="${wPlayerPort(x, 64)}" alt=""><span><b>${esc(x.n)}</b><small>${esc(wKindName(x.kind))}, level ${x.lvl}${wIsStarter(x.id) ? ', starter' : ''}. ${wCardsOf(x.id).length} card${wCardsOf(x.id).length === 1 ? '' : 's'}</small></span></button>`).join('')}</div>
    <div class="row"><button class="ghost" id="wRelNo">Let ${esc(p.n)} go</button></div>`, () => { if (done) { const d = done; done = null; d(false); } });
  $('wRelNo').onclick = () => close();
  $('modalBox').querySelectorAll('[data-rel]').forEach(b => b.onclick = () => {
    const x = wPlayer(+b.dataset.rel), d = done; done = null; close(); if (!x) return;
    const heir = wRoster().find(y => y.id !== x.id && y.kind === x.kind);
    askConfirm(`Release ${x.n}?`, `${x.n} leaves the team${heir ? `, and ${heir.n} takes over their cards` : ` with their ${wCardsOf(x.id).length} cards`}. ${p.n} joins in their place.`, 'Release',
      () => { const why = wRelease(x.id); if (why) { wLog(why, 'b'); d && d(false); } else { wAddPlayer(p); d && d(true); } wDrain(); },
      () => { done = d; wOfferRelease(p, d); });
  });
}

/* ---------- post-game: one of the beaten players asks to join ---------- */
function wPostGameRecruit() {
  const F = WG.wfoes; if (!F || !F.kinds.length) return;
  const odds = W_PARTY.recruitOdds[F.type] != null ? W_PARTY.recruitOdds[F.type] : W_PARTY.recruitOdds.normal;
  if (!W_PARTY.force && Math.random() >= odds) return;
  W_PARTY.force = false;
  const st = wStarters(), avg = st.reduce((a, p) => a + p.lvl, 0) / Math.max(1, st.length);
  const p = wMakePlayer({ kind: pick(F.kinds), lvl: Math.max(1, Math.round(avg) - 1 + (F.type === 'normal' ? 0 : 1)) }, 'postgame');
  WG.wprompts.push({ t: 'recruit', p });
}

/* ---------- the prompt queue: level-up picks and recruits, one at a time, when the world is free ---------- */
function wNextPrompt() {
  // an open road event (w9-road.js) goes first; its card drains the queue once it closes
  if (!WG || !WG.wprompts || !WG.wprompts.length || WG.cardOffer || WG.event) return false;
  if (LAB) { while (WG.wprompts.length) wPromptLab(WG.wprompts.shift()); return true; }
  if (!wActive()) return false;
  const P = WG.wprompts.shift();
  if (P.t === 'level') {
    const p = wPlayer(P.pid), pool = p ? wKindPool(p.kind, P.lvl) : [];
    if (pool.length) wGainCard({ pick: 3, pool, pid: p.id }, `${p.n} reached level ${P.lvl}`);
  } else if (P.t === 'recruit') wShowRecruit(P.p, 'postgame');
  wSave();
  return true;
}
function wPromptLab(P) {
  const p = P.t === 'level' && wPlayer(P.pid);
  if (p) { const pool = wKindPool(p.kind, P.lvl); if (pool.length) wGainCard({ id: pick(pool), pid: p.id }, 'level up'); }
}
function wSigCard(kind) { return SIG[kind] ? cardHTML({ uid: 'wsig' + kind, id: SIG[kind] }, { flav: false }) : ''; }
/* the recruit card: portrait, kind, signature card. how: 'postgame' | 'quest' */
function wShowRecruit(p, how, done) {
  const lede = how === 'quest' ? `${esc(p.n)} the ${esc(wKindName(p.kind))} wants to come with you.`
    : `${esc(p.n)}, a ${esc(wKindName(p.kind))} from the team you just beat, asks to join.`;
  let chose = false;
  const close = modal(`<header><h3>${esc(p.n)} wants to join</h3></header>
    <div class="wrec">
      <img class="wrecport" src="${wPlayerPort(p, 120)}" alt="${esc(p.n)}">
      <div><p class="wrecwho">${lede}</p><p class="hint">${esc(wKindName(p.kind))}, #${p.num}, level ${p.lvl}. ${esc(p.flav)}</p>
      <p class="hint">Joins with this signature card, and a card or two of their kind.${wRoster().length >= W_PARTY.max ? ' <b class="wbad">Your roster is full: you would release someone.</b>' : ''}</p></div>
      <div class="wrecsig">${wSigCard(p.kind)}</div>
    </div>
    <div class="row"><button class="btn" id="wSign">Sign ${esc(p.n)}</button><button class="ghost" id="wPass">No thanks</button></div>`,
    () => { if (!chose) { chose = true; wPassRecruit(p, how); done && done(false); } });
  $('wSign').focus();
  $('wSign').onclick = () => { chose = true; close(); wRecruit(p, p.from || how, ok => { if (!ok) wPassRecruit(p, how); wDrain(); done && done(ok); }); wDrain(); };
  $('wPass').onclick = () => close();
}
function wPassRecruit(p, how) {
  if (how === 'quest') { if (!WG.wwait.some(x => x.n === p.n)) WG.wwait.push(p); wLog(`${p.n} will wait for you at camp, in case a place opens up.`, 'd'); }
  else wLog(`${p.n} shrugs and heads home.`, 'd');
  wSave();
}
/* a quest companion who waited at camp */
function wSignWaiting(i) {
  const p = WG.wwait[i]; if (!p) return;
  wRecruit(p, 'quest', ok => { if (ok) WG.wwait = WG.wwait.filter(x => x !== p); wSave(); wDrain(); });
}

/* ---------- quest companions: the sideplots whose eggs were dropped now give a named player ----------
   A topic with recruit: { kind, n, lvl, flav? } pays them out (wSay in w3 calls wRecruitTopic). */
const W_QUEST_MATES = {
  'tallow.trap': { kind: 'harpy', n: 'Lumen', lvl: 3, flav: 'A lamp moth, grown. Plays best after dark, and drinks the oil.', sp: 'rq_lumi3',
    t: 'Look, there, on the fountain lamp. It came, it laid, and the egg hatched in my hand before I could put it down. Pale wings, big eyes, and she has decided she is yours. Her name is Lumen, apparently. Mind the oil.' },
  'diver.clutch': { kind: 'gorgon', n: 'Marigold', lvl: 4, flav: 'A tidewyrm, gold on green. Bends the light on the way past.', sp: 'rq_serp3',
    t: 'Found it. One egg left in the clutch, under the old pearl bed, and it hatched on the swim up. A wyrmling, gold on green. The captain wants her called Marigold, and she wants to come with you. Tell him.' },
  'grit.inside': { kind: 'kobold', n: 'Pyra', lvl: 5, flav: 'A cindermane kit, out of the glass. Purrs. Burns.', sp: 'rq_cind2',
    t: 'Inside? It cracked last night. A kit came out of the glass, mane on fire, purring, and it will not leave me alone. It likes you better. Take her. Please. She answers to Pyra.' },
  'pell.capsule': { kind: 'golem', n: 'Specimen One', lvl: 5, flav: 'Pre-League stock, out of a capsule. Does not blink.', sp: 'rq_vault',
    t: 'A dormant capsule. Pre-League. Oh, you beautiful thing. Six Aether, straight into the cell, and let us see. ... There. It grew a shell, and something stepped out of it. It answers to Specimen One, and it wants to play. Take it before the League asks.' },
  'hermit.drake': { kind: 'troll', n: 'Bramblewick', lvl: 5, flav: 'The Elder\'s own line. Regrows. Remembers.', sp: 'rq_drake',
    t: 'Give it here. ... Listen. There. It came down out of the canopy, took the offering, and left its young in the leaves. The Elder\'s own line: Bramblewick. It will walk with you. Go carefully with it.' },
};
for (const k in W_QUEST_MATES) {
  const [c, tp] = k.split('.'), Q = W_QUEST_MATES[k], T = DB.chars[c] && DB.chars[c].topics[tp];
  if (!T) continue;
  T.recruit = { kind: Q.kind, n: Q.n, lvl: Q.lvl, flav: Q.flav };
  T.t = Q.t;
  const sp = DB.sideplots.find(s => s.id === Q.sp);
  if (sp) sp.pay = `${Q.n} joins the team (a level ${Q.lvl} ${wKindName(Q.kind)}).`;
}
function wRecruitTopic(spec) {
  const p = wMakePlayer(spec, 'quest');
  if (LAB) { wRecruit(p, 'quest'); return; }
  if (wRoster().length < W_PARTY.max) { wRecruit(p, 'quest'); return; }
  wShowRecruit(p, 'quest');
}

/* ---------- taverns: free agents at every inn, new each week ---------- */
const W_TAVERN_INNS = ['hq_inn', 'moss_inn', 'salt_inn', 'cind_inn', 'rime_inn'];
for (const id of W_TAVERN_INNS) {
  const ch = DB.chars[id]; if (!ch) continue;
  ch.topics.agents = { t: 'Over in the corner. Free agents, every one of them looking for a club. Talk to them yourself.', act: 'agents' };
  ch.topics.job.t += ' Free AGENTS drink in the corner, looking for a club.';
}
function wWeek() { return Math.floor(((WG.dayAbs || 1) - 1) / 7); }
function wTavern(town) {
  town = town || WG.map;
  const wk = wWeek(), T = WG.tavern[town];
  if (T && T.week === wk) return T;
  const region = wRegionHere(), kinds = (DB.regions[region] || DB.regions.plains).kinds, tier = W_TIER[region] || 1;
  const taken = new Set(wRoster().map(p => p.n));
  const list = shuffle(genDraftClass().filter(r => kinds.includes(r[1]) && !taken.has(r[0]))).slice(0, ri(1, 3)).map(([n, kind, num, flav]) => {
    const lvl = ri(1, 2) + (tier - 1) * 2;
    return { n, kind, num, flav, lvl, fee: wFee(lvl) };
  });
  return (WG.tavern[town] = { week: wk, list });
}
/* returns '' when signed (or the release question is open), else why not */
function wSignAgent(town, i, done) {
  const T = wTavern(town), a = T.list[i];
  if (!a) return 'They have gone.';
  if (RUN.gold < a.fee) return `You cannot afford ${a.n}'s fee.`;
  wRecruit(a, 'tavern', ok => {
    if (ok) { RUN.gold -= a.fee; T.list = T.list.filter(x => x !== a); wLog(`You pay ${a.fee} gold to sign ${a.n}.`, 'm'); wSave(); }
    done && done(ok);
  });
  return '';
}
const wW3RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'agents') { if (!LAB) wOpenTavern(WG.map, wChar(id).name); return; }
  return wW3RunAct(act, id);
};
function wOpenTavern(town, who) {
  const T = wTavern(town);
  const close = modal(`<header><h3>Free agents</h3><button class="ghost" data-close>Done</button></header><div id="wTavBody"></div>`);
  const render = msg => {
    const body = $('wTavBody'); if (!body) return;
    const next = (wWeek() + 1) * 7 + 1 - WG.dayAbs;
    body.innerHTML = `<p class="hint">${esc(who || 'The innkeeper')} points them out. You have <b class="wgold">${RUN.gold} gold</b> and ${wRoster().length}/${W_PARTY.max} players. New faces in ${next} day${next === 1 ? '' : 's'}.${msg ? ' <span class="wbad">' + esc(msg) + '</span>' : ''}</p>
      ${T.list.length ? `<div class="wtav">${T.list.map((a, i) => `<div class="wag"><img src="${wPlayerPort(a, 76)}" alt=""><div><b>${esc(a.n)}</b><span class="k">${esc(wKindName(a.kind))}, #${a.num}, level ${a.lvl}</span><p>${esc(a.flav)}</p>
        <div class="sig">Brings <b data-tip="${esc(SIG[a.kind] ? `<span class="t">${CARDS[SIG[a.kind]].n}</span>` + cardText({ id: SIG[a.kind] }, {}) : '')}">${esc(SIG[a.kind] ? CARDS[SIG[a.kind]].n : '')}</b></div></div>
        <button class="btn" data-sign="${i}" ${RUN.gold < a.fee ? 'disabled' : ''}>Sign, ${a.fee} gold</button></div>`).join('')}</div>` : '<p>The corner is empty this week. Come back next week.</p>'}`;
    body.querySelectorAll('[data-sign]').forEach(b => b.onclick = () => {
      const i = +b.dataset.sign, full = wRoster().length >= W_PARTY.max;
      if (full) close();
      const why = wSignAgent(town, i, () => { wDrain(); if (!full) render(''); });
      if (why) render(why);
    });
  };
  render('');
}

/* ---------- careers: Sudden Death's per-player careers, grown one match at a time ---------- */
function wCareerKey(p) { return `${RUN.club}:${p.n}`; }
function wCareer(p) { try { return loadCareers()[wCareerKey(p)] || null; } catch (e) { return null; } }
function wCareerGame(g) {
  const C = loadCareers();
  for (const p of RUN.party) {
    const key = wCareerKey(p), t = (g.ps || {})[p.kind] || {};
    const c = C[key] = C[key] || { n: p.n, kind: p.kind, club: RUN.club, num: p.num, runs: 1, cups: 0, games: 0, c: 0, d: 0, b: 0, k: 0, p: 0, mvp: 0, best: 0, hist: [] };
    c.games++;
    for (const s of Object.keys(STAT_KEYS)) c[s] += t[s] || 0;
    if (g.mvp === p.kind) c.mvp++;
    c.best = Math.max(c.best, t.d || 0);
  }
  try { localStorage.setItem(pkey('sd-players'), JSON.stringify(C)); } catch (e) { }
}
const wSdLogGame = logGame;
logGame = function (fell) {
  const n0 = (RUN && RUN.games || []).length;
  wSdLogGame(fell);
  if (WG && RUN && !LAB && (RUN.games || []).length > n0) { try { wCareerGame(RUN.games[RUN.games.length - 1]); } catch (e) { console.error(e); } }
};
// a realm journey's careers are already counted match by match; the Hardcore ending must not count them twice
const wSdUpdateCareers = updateCareers;
updateCareers = function (result) { if (WG) return; return wSdUpdateCareers(result); };

/* deleting a profile deletes its realm journey too */
const wSdDeleteProfile = deleteProfile;
deleteProfile = function (id) { try { localStorage.removeItem(`sd-realm@${id}`); } catch (e) { } return wSdDeleteProfile(id); };

/* ---------- a new journey: pick a club and three founders on Sudden Death's draft screen ---------- */
function wOpenDraft() {
  Object.assign(DR, { realm: true, mode: 'club', club: wDefaultClub(), picks: [0, 1, 2], cls: null, relic: null, wHard: false });
  showScreen('draft'); renderDraft();
}
const wSdRenderDraft = renderDraft;
renderDraft = function () {
  wSdRenderDraft();
  if (!DR.realm) return;
  const el = $('scr-draft'), free = DR.mode === 'free';
  el.querySelector('h2.pgh').textContent = 'Found your team';
  const lede = el.querySelector('.lede');
  if (lede && !free) lede.textContent = 'Pick a club, then three of its players. They are your founders: they walk the realm with you, and play every match. Each brings a signature card, and your club brings its trophy. More players join on the road, at tavern tables and after games.';
  const go = $('bGo'); if (!go) return;
  go.id = 'wGo'; go.textContent = 'Set out';
  go.insertAdjacentHTML('beforebegin', `<label class="whcbox wdhard"><input type="checkbox" id="wHard" ${DR.wHard ? 'checked' : ''}><span><b>Hardcore</b><small>Lose a match and the journey is over.</small></span></label>`);
  $('wHard').onchange = () => { DR.wHard = $('wHard').checked; };
  go.onclick = () => {
    const opts = { hardcore: !!DR.wHard, club: free ? 'free' : DR.club, picks: DR.picks.slice(), roster: free ? DR.cls : null, relic: free ? DR.relic : null };
    const diff = DR.diff != null ? DR.diff : SET.diff;
    DR.realm = false; DR.cls = null;
    wStart(null, opts);
    RUN.diff = diff; wSave();
  };
};
