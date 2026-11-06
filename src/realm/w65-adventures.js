/* w65: adventures, phase 1 (issue #47): the plumbing. Long story lines across the Realm, in chapters of steps: talk
   to someone about a keyword, go somewhere, win a particular game, make a choice. The design is in
   docs/superpowers/specs/2026-11-05-realm-adventures-design.md.

   Settled with Geoff: progress belongs to the profile, not the journey (a journey that ends halfway leaves the
   adventure where it was, for the next journey on the same profile). A finished adventure stays finished and its
   reward is kept: a reward character lives in one place and recruits on any later journey. Most steps can be tried
   again; a pinnacle step can't, and failing it loses the adventure on that profile for good (the journal keeps it as
   a story that ended badly). An adventure starts only from the right conversation; rumours at the inns point there.

   W_ADV is the table of adventures (empty in this phase: the stories come in later phases; the test adds its own).
   Steps: { k: 'talk', who, kw, need?, tNo?, take?, give? }, { k: 'visit', loc, need?, tNo?, give? },
          { k: 'match', who, kw, engine: card|ball|grid|ring, tier, ids?, sport?, club?, cond?, win, lose },
          { k: 'choice', who, kw, q, opts, right, win, lose }, each with t?, learn?, pinnacle?.
   A chapter's steps go in order, or in any order with any: true. W_ADV_ITEMS are adventure items, kept on the
   profile (not WG.items, which every journey starts empty).

   Storage: pkey('sd-realm-adv') = { a: { advId: { st: 'active'|'won'|'lost', ch, done: [step], items: { id: n },
   learned: [{ t, d }], since, ended?, why? } }, rec: {} }, written the moment anything changes, so reloading a journey
   save can't undo a pinnacle. WG.advRec = { advId: 1 } marks a reward character recruited this journey. Nothing is
   stored in LAB.

   Matches start with kind 'adv' and ref '<advId>:<chapter>:<step>'; W_ON_END.adv checks the result against the
   step's conditions (every engine calls W_ON_END[W.kind]).

   Wraps: wSay (wW65Say: starters, talk steps, the match and choice triggers, reward recruits), wEnterMap
   (wW65EnterMap: visit steps), wMatchLost (wW65MatchLost: a hardcore loss, which ends the journey without the usual
   dispatch). A game whose night, weather or starter can't be met isn't offered; night and weather are judged as they
   were at kickoff (AS.kick). Calling a ball, football or ring game off before its first pitch, play or bout is no
   result, like "Not yet": not an attempt. The cards, the journal tab, the Bag, rumours and How to play are in w66. */

const W_ADV = [];
const W_ADV_ITEMS = {};
const W_ADV_CFG = { key: 'sd-realm-adv', engines: { card: 'the card game', ball: 'baseball', grid: 'football', ring: 'boxing' } };

/* ---------- the store ---------- */
function wAdvKey() { return pkey(W_ADV_CFG.key); }
function wAdvAll() {
  let S; try { S = JSON.parse(localStorage.getItem(wAdvKey()) || 'null'); } catch (e) { S = null; }
  S = S && typeof S === 'object' && !Array.isArray(S) ? S : {};
  return { a: S.a && typeof S.a === 'object' ? S.a : {}, rec: S.rec && typeof S.rec === 'object' ? S.rec : {} };
}
function wAdvSave(S) { if (LAB) return; try { localStorage.setItem(wAdvKey(), JSON.stringify(S)); } catch (e) { } }
function wAdvToday() { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; } // local, as w57 stamps unlocks
function wAdv(id) { return W_ADV.find(a => a.id === id) || null; }
function wAdvState(id, S) { return (S || wAdvAll()).a[id] || null; }
function wAdvEdit(id, fn) { const S = wAdvAll(), A = S.a[id]; if (!A) return null; fn(A, S); wAdvSave(S); return A; }

/* the steps you can do now: the first not done, or every one not done in an any-order chapter */
function wAdvLive(id, S) {
  const D = wAdv(id), A = wAdvState(id, S);
  if (!D || !A || A.st !== 'active') return [];
  const C = D.chapters[A.ch]; if (!C) return [];
  const open = C.steps.map((step, si) => ({ ch: A.ch, si, step })).filter(s => !A.done.includes(s.si));
  return C.any ? open : open.slice(0, 1);
}
function wAdvBegin(id) {
  const D = wAdv(id), S = wAdvAll();
  if (!D || S.a[id]) return false;
  S.a[id] = { st: 'active', ch: 0, done: [], items: {}, learned: [], since: wAdvToday() };
  if (D.starter && D.starter.learn) S.a[id].learned.push({ t: D.starter.learn, d: wAdvToday() });
  wAdvSave(S);
  if (WG && !LAB) wLog(`A new adventure: ${D.title}.`, 'g');
  return true;
}
function wAdvLearn(id, t) { if (t) wAdvEdit(id, A => A.learned.push({ t, d: wAdvToday() })); }
function wAdvPay(pay, from) {
  if (!pay || !RUN) return;
  if (pay.gold) { RUN.gold += pay.gold; wLog(`Received ${pay.gold} gold.`, 'm'); }
  if (pay.fans) { RUN.fans = (RUN.fans || 0) + pay.fans; wLog(`${pay.fans} new fans.`, 'm'); }
  if (pay.cards) wPayCards({ cards: pay.cards }, from);
  for (const k in pay.items || {}) { wAddItem(k, pay.items[k]); wLog(`Received ${pay.items[k]} ${(DB.items[k] || {}).name || k}.`, 'm'); }
}
function wAdvItemsMove(A, take, give) {
  for (const k in take || {}) { A.items[k] = (A.items[k] || 0) - take[k]; if (A.items[k] <= 0) delete A.items[k]; }
  for (const k in give || {}) A.items[k] = (A.items[k] || 0) + give[k];
}
function wAdvHas(A, take) { return Object.keys(take || {}).every(k => (A.items[k] || 0) >= take[k]); }
/* a step is done: its items move, the chapter (and then the adventure) completes once every step is done */
function wAdvDone(id, si) {
  const D = wAdv(id), A0 = wAdvState(id);
  if (!D || !A0 || A0.st !== 'active' || A0.done.includes(si)) return;
  const C = D.chapters[A0.ch], step = C.steps[si];
  let chDone = false, won = false;
  wAdvEdit(id, A => {
    wAdvItemsMove(A, step.take, step.give);
    for (const k in step.give || {}) if (WG && !LAB) wLog(`Found: ${(W_ADV_ITEMS[k] || {}).n || k}.`, 'm');
    if (step.learn) A.learned.push({ t: step.learn, d: wAdvToday() });
    A.done.push(si);
    if (A.done.length >= C.steps.length) { chDone = true; A.ch++; A.done = []; if (A.ch >= D.chapters.length) { won = true; A.st = 'won'; A.ended = wAdvToday(); } }
  });
  if (chDone) { wAdvPay(C.pay, D.title); if (!won && WG && !LAB) wLog(`${D.title}: chapter done. ${D.chapters[wAdvState(id).ch].t}.`, 'g'); }
  if (won) wAdvWin(id);
}
function wAdvWin(id) {
  const D = wAdv(id); if (!D) return;
  const E = D.end || {};
  if (WG && !LAB) wLog(`${D.title}: ${E.t || 'the end'}`, 'g');
  wAdvPay(E.pay, D.title);
  if (E.feat && typeof wStarsAll === 'function') { const S = wStarsAll(); if (!S.un[E.feat]) { S.un[E.feat] = wAdvToday(); wStarsSave(S); } }
}
function wAdvLose(id, why) {
  const D = wAdv(id);
  const A = wAdvEdit(id, A => { if (A.st !== 'active') return; A.st = 'lost'; A.ended = wAdvToday(); A.why = why || ''; });
  if (A && D && WG && !LAB) wLog(`${D.title}: ${D.lostText || 'it ended badly.'}`, 'd');
}

/* ---------- talk and places ---------- */
function wAdvNeedMet(need) {
  if (!need) return true;
  if (need.night && !wNightTalk()) return false;
  if (need.season && wSeason() !== need.season) return false;
  if (need.weather && wWeather(wRegionHere()) !== need.weather) return false;
  return true;
}
/* returns { text, act?, key } when an adventure answers, or null to let the character answer as usual */
function wAdvTalk(id, kw) {
  if (!WG || !kw) return null;
  const S = wAdvAll();
  for (const D of W_ADV) {
    const A = S.a[D.id] || null;
    // the reward character, once per journey
    const U = D.end && D.end.unlock;
    if (A && A.st === 'won' && U && U.at === id && wKwHit(U.kw, kw)) {
      WG.advRec = WG.advRec || {};
      if (WG.advRec[D.id]) return { text: `${U.recruit.n} is already with you.`, key: U.kw };
      // marked only once they join: with a full team they wait until you make room
      if (!LAB && wRoster().length >= W_PARTY.max) return { text: `${U.recruit.n} would join you, but your team is full. Make room and ask again.`, key: U.kw };
      WG.advRec[D.id] = 1;
      wRecruitTopic(U.recruit);
      return { text: U.t || `${U.recruit.n} joins you.`, key: U.kw };
    }
    // the start
    const St = D.starter;
    if (!A && St && St.who === id && wKwHit(St.kw, kw)) {
      if (St.need && [].concat(St.need).some(f => !wFlag(f))) continue;
      wAdvBegin(D.id);
      return { text: St.t || `${D.title}.`, key: St.kw };
    }
    // the live steps
    for (const L of wAdvLive(D.id, S)) {
      const s = L.step;
      if (s.k === 'visit' || s.who !== id || !wKwHit(s.kw, kw)) continue;
      if (s.k === 'match') return { text: s.t || 'A game, then. Here is what it takes.', act: `adv:${D.id}:${L.si}`, key: s.kw };
      if (s.k === 'choice') return { text: s.t || s.q || 'Think it over.', act: `adv:${D.id}:${L.si}`, key: s.kw };
      if (!wAdvNeedMet(s.need)) return { text: s.tNo || 'Not yet.', key: s.kw };
      if (s.take && !wAdvHas(A, s.take)) return { text: s.tNo || 'Not yet.', key: s.kw };
      wAdvDone(D.id, L.si);
      return { text: s.t || 'Good.', key: s.kw };
    }
  }
  return null;
}
function wAdvVisit(mapId) {
  if (!WG) return;
  const S = wAdvAll();
  for (const D of W_ADV) for (const L of wAdvLive(D.id, S)) {
    const s = L.step; if (s.k !== 'visit') continue;
    const loc = DB.locs.find(l => l.id === s.loc); if (!loc || loc.map !== mapId) continue;
    if (!wAdvNeedMet(s.need)) { if (s.tNo) wLog(s.tNo, 'd'); continue; }
    if (s.t) wLog(s.t, 'm');
    wAdvDone(D.id, L.si);
  }
}
const wW65Say = wSay;
wSay = function (id, kw) {
  const k = (kw || '').trim().toLowerCase();
  let r = null;
  try { r = wAdvTalk(id, k); } catch (e) { console.error(e); }
  if (!r) return wW65Say(id, kw);
  try { if (typeof wJHeard === 'function') wJHeard(id, k, r); } catch (e) { console.error(e); }
  return r;
};
const wW65EnterMap = wEnterMap;
wEnterMap = function (id, x, y) {
  const r = wW65EnterMap(id, x, y);
  try { wAdvVisit(id); } catch (e) { console.error(e); }
  return r;
};

/* ---------- matches ---------- */
function wAdvRef(ref) { const [id, ch, si] = String(ref || '').split(':'); return { id, ch: +ch, si: +si }; }
function wAdvStep(id, si) { const D = wAdv(id), A = wAdvState(id); return D && A && D.chapters[A.ch] ? D.chapters[A.ch].steps[si] || null : null; }
function wAdvCondText(step) {
  const c = step.cond || {}, out = [];
  if (c.margin) out.push(`Win by at least ${c.margin}.`);
  if (c.starter) {
    const who = c.starter.pid != null ? (wRoster().find(p => p.id === c.starter.pid) || {}).n : null;
    out.push(who ? `${who} must start.` : `A ${wKindName(c.starter.kind).toLowerCase()} must start.`);
  }
  if (c.night) out.push('At night.');
  if (c.weather) out.push(`In the ${c.weather}.`);
  if (!out.length) out.push('Win.');
  return out;
}
/* who starts in each engine: the card game's starters, the nine, the seven (not the bench), the card's fighters */
function wAdvStarted(cond, W, eng) {
  const hit = pid => { const p = wRoster().find(q => q.id === pid); return !!p && (cond.pid != null ? p.id === cond.pid : p.kind === cond.kind); };
  if (eng === 'grid') return W && Array.isArray(W.ids) ? W.ids.slice(0, W_GFR.side).some(hit) : wSevenSync().ids.slice(0, W_GFR.side).some(hit);
  if (eng === 'ring') return W && Array.isArray(W.ids) ? W.ids.some(hit) : true; // fighters are picked at the pairing, after the card
  if (eng === 'ball') return !!WG.nine && WG.nine.order.some(o => hit(o.id));
  return wStarters().some(p => hit(p.id));
}
/* what stops this game counting if you played it now: a game that can't be met isn't offered */
function wAdvUnmet(step) {
  const c = step.cond || {}, out = [], eng = step.engine || 'card';
  if (c.night && !wIsNight()) out.push('It has to be played at night. Come back after dark.');
  if (c.weather && wWeather(wRegionHere()) !== c.weather) out.push(`It has to be played in the ${c.weather}.`);
  if (c.starter && !wAdvStarted(c.starter, null, eng)) out.push(`${wAdvCondText({ cond: { starter: c.starter } })[0].replace(' must start.', '')} isn't starting. Change your lineup on the Team screen.`);
  return out;
}
function wAdvStartMatch(id, si, how) {
  const A = wAdvState(id), step = wAdvStep(id, si);
  if (!A || A.st !== 'active' || !step || step.k !== 'match') return 'That game is not on.';
  const unmet = wAdvUnmet(step); if (unmet.length) return unmet.join(' ');
  const ref = `${id}:${A.ch}:${si}`, tier = step.tier || 1, eng = step.engine || 'card';
  // night and weather are judged as they were at kickoff (the engines move the clock on before they report)
  wAdvEdit(id, A2 => { A2.kick = { ref, night: wIsNight() ? 1 : 0, wx: wWeather(wRegionHere()) || null }; });
  if (eng === 'card') {
    startMatch({ type: step.type || 'normal', tier, ids: step.ids, sport: step.sport, card: false, name: step.name, world: { kind: 'adv', ref } });
    return '';
  }
  const o = { club: step.club || 'local', how: how || 'play', tier, kind: 'adv', ref };
  const f = { ball: wStartBall, grid: wStartGrid, ring: wStartRing }[eng];
  return f ? f(o) || '' : 'That game is not on.';
}
function wAdvMatchFacts(r, W) {
  W = W || {};
  let us = W.us, them = W.them;
  if (us == null && RUN && RUN.games && RUN.games.length) { const g = RUN.games[RUN.games.length - 1]; us = g.us; them = g.them; }
  return { win: r === 'win', us: us || 0, them: them || 0 };
}
function wAdvCondMet(step, facts, W, kick) {
  if (!facts.win) return false;
  const c = step.cond || {}, eng = step.engine || 'card';
  if (c.margin && facts.us - facts.them < c.margin) return false;
  if (c.starter && !wAdvStarted(c.starter, W, eng)) return false;
  if (c.night && !(kick ? kick.night : wIsNight())) return false;
  if (c.weather && (kick ? kick.wx : wWeather(wRegionHere())) !== c.weather) return false;
  return true;
}
W_ON_END.adv = function (r, ref, W) {
  const R = wAdvRef(ref), A = wAdvState(R.id), D = wAdv(R.id);
  if (!A || !D || A.st !== 'active' || A.ch !== R.ch || !wAdvLive(R.id).some(L => L.si === R.si)) return;
  const step = D.chapters[R.ch].steps[R.si], kick = A.kick && A.kick.ref === ref ? A.kick : null;
  if (wAdvCondMet(step, wAdvMatchFacts(r, W), W, kick)) { if (step.win) wLog(step.win, 'g'); wAdvDone(R.id, R.si); return; }
  if (step.pinnacle) { wAdvLose(R.id, step.lose || 'You lost.'); return; }
  if (step.lose) wLog(step.lose, 'd');
};
/* hardcore: a lost card match ends the journey without the usual dispatch, so the adventure hears of it here */
const wW65MatchLost = wMatchLost;
wMatchLost = function (result) {
  const W = RUN && RUN.pending && RUN.pending.world;
  if (WG && WG.hardcore && W && W.kind === 'adv') { try { W_ON_END.adv('lose', W.ref, W); } catch (e) { console.error(e); } }
  return wW65MatchLost(result);
};
function wAdvChoose(id, si, i) {
  const A = wAdvState(id), step = wAdvStep(id, si);
  if (!A || A.st !== 'active' || !step || step.k !== 'choice' || !wAdvLive(id).some(L => L.si === si)) return;
  if (i === step.right) { if (step.win) wLog(step.win, 'g'); wAdvDone(id, si); return; }
  if (step.pinnacle) { wAdvLose(id, step.lose || 'That was wrong.'); return; }
  if (step.lose) wLog(step.lose, 'd');
}
