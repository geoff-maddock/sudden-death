/* w71: the Realm daily (issue #60, phase 4). One match a day, the same for everyone: the game (the card game, baseball,
   football or boxing), the club you face, and for the card game the sport and the side they put out, all from the local
   date. Not a journey: your own team plays it, on the journey you have on. Difficulty rises through the week, as
   Sudden Death's daily does: tier 1 on Sunday and Monday, 2 from Tuesday to Thursday, 3 on Friday and Saturday (the
   engines scale a tier to your level; the card game's tier is the act's foes).

   One attempt a day, per profile and across journeys: the day is used at kickoff (the card game's first hand, a ball or
   football game's first pitch or play, a card at the Ring once its pairing is boxed), and written at once, so loading an
   older journey save can't give it back. Calling the Ring's pairing off before it starts isn't an attempt. A missed day
   can't be played later. A daily started before midnight can be finished after it.
   A win pays the engine's usual pay plus W_RDAILY.gold and .fans times the tier.

   Storage: pkey('sd-realm-daily') = { days: { 'YYYY-MM-DD': { st: 'on'|'win'|'lose'|'tie', eng, club, sport, tier, us?,
   them?, t } } }. Nothing is stored in LAB.
   Matches start with kind 'rdaily' and ref the day's key; W_ON_END.rdaily writes the result.

   Wraps: wRingGo (wW71RingGo: a card at the Ring is the attempt once its pairing is boxed), wMatchLost (wW71MatchLost:
   a Hardcore loss, which ends the journey without the usual dispatch), wStart (wW71Start: the day's daily in the log),
   wOpenCamp and wRenderCamp (wW71OpenCamp, wW71RenderCamp: the Daily tab), renderHelp (wW71RenderHelp: #wHelpRDaily).
   Replaces renderDaily (Sudden Death's Daily page, ui/screens/daily.js): in the Realm the top bar's Daily is this daily. */

const W_RDAILY = {
  key: 'sd-realm-daily',
  tiers: [1, 1, 2, 2, 2, 3, 3], // Sunday to Saturday
  engines: ['card', 'ball', 'grid', 'ring'],
  names: { card: 'the card game', ball: 'baseball', grid: 'football', ring: 'boxing' },
  how: { card: [['play', 'Play']], ball: [['play', 'Play'], ['manage', 'Manage'], ['sim', 'Simulate']], grid: [['play', 'Play'], ['manage', 'Manage'], ['sim', 'Simulate']], ring: [['play', 'Play']] },
  gold: 25, fans: 5, // a win's extra, times the tier
  shown: 14,         // past days on the tab
};
const W_RDAILY_TIER = { 1: 'an easy game', 2: 'a tough game', 3: 'a very hard game' };

// today, by the local date (a function of its own, so the test can move the day)
function wRdailyToday() { return dayKey(); }
// the day's match, from the date alone. mine: your club, which never faces itself (the day's second club stands in)
function wRdailyOf(key = wRdailyToday(), mine) {
  const s = { rng: seedHash(0x5d0d, 'realm-daily:' + key) }, r = () => rngStep(s, 'rng'), at = a => a[(r() * a.length) | 0];
  const dow = dayDate(key).getDay(), tier = W_RDAILY.tiers[dow], eng = at(W_RDAILY.engines);
  const first = at(CLUB_IDS), others = CLUB_IDS.filter(c => c !== first), second = at(others);
  const club = mine && first === mine ? second : first;
  let sport = { ball: 'baseball', grid: 'football', ring: 'boxing' }[eng] || null, ids = null;
  if (eng === 'card') {
    // the club's side, as a rival game is: one of the tier's elite sides that plays the day's sport
    const want = at(Object.keys(SPORTS)), pool = ENCOUNTERS[tier - 1].elite;
    const fits = pool.filter(p => !ENEMIES[p[0]].sport || ENEMIES[p[0]].sport === want);
    ids = at(fits.length ? fits : pool).slice();
    sport = ENEMIES[ids[0]].sport || want;
  }
  return { key, dow, tier, eng, club, sport, ids };
}
function wRdailyMine() { return (RUN && RUN.club) || (WG && WG.club) || null; }
function wRdailyDay(key = wRdailyToday()) { return wRdailyOf(key, wRdailyMine()); }

/* ---------- the record ---------- */
function wRdailyAll() { try { const d = JSON.parse(localStorage.getItem(pkey(W_RDAILY.key)) || 'null'); return d && d.days ? d : { days: {} }; } catch (e) { return { days: {} }; } }
function wRdailySave(d) { if (LAB) return; try { localStorage.setItem(pkey(W_RDAILY.key), JSON.stringify(d)); } catch (e) { } }
function wRdailyMark(D) {
  const rec = wRdailyAll(); if (rec.days[D.key]) return;
  rec.days[D.key] = { st: 'on', eng: D.eng, club: D.club, sport: D.sport, tier: D.tier, t: Date.now() };
  wRdailySave(rec);
}
// days in a row with a daily played, up to today (or up to yesterday, while today's is still to play)
function wRdailyStreak(days, today = wRdailyToday()) {
  let k = days[today] ? today : dayBefore(today), n = 0;
  while (days[k]) { n++; k = dayBefore(k); }
  return n;
}

/* ---------- the match ---------- */
function wRdailyWhat(D) {
  const club = wBallName(D.club);
  if (D.eng === 'card') return `${SPORT_NAME[D.sport]} in the card game against ${club}: ${wClubCaptain(D.club)} and ${D.ids.map(id => ENEMIES[id].n).join(', ')}`;
  return `${wCap(W_RDAILY.names[D.eng])} against ${club}`;
}
function wRdailyProblems(D) {
  if (!WG || !RUN) return ['Start a journey first.'];
  if (D.eng === 'ball') return wBallProblems();
  if (D.eng === 'grid') return wGridProblems();
  if (D.eng === 'ring') return wRingProblems();
  return [];
}
// the engine whose game is waiting, if it's today's daily
function wRdailyLive(key) {
  const L = [WG.ball, WG.gfg, WG.bxg].map(S => S && S.live).find(L => L && L.world && L.world.kind === 'rdaily');
  return L && (!key || L.world.ref === key) ? L : null;
}
function wRdailyStart(how) {
  if (!WG || !RUN) return 'Start a journey first.';
  const D = wRdailyDay();
  if (wRdailyAll().days[D.key]) return 'You have played today’s daily. Come back tomorrow.';
  const probs = wRdailyProblems(D); if (probs.length) return probs.join(' ');
  if (D.eng === 'card') {
    if (RUN.pending) return 'Finish the match you are in first.';
    wRdailyMark(D);
    startMatch({ type: 'rival', tier: D.tier, ids: D.ids, sport: D.sport, card: false, name: wClubCaptain(D.club), world: { kind: 'rdaily', ref: D.key } });
    return '';
  }
  const St = { ball: wBall, grid: wGfg, ring: wBxg }[D.eng]();
  // the daily is on whatever else you've played today (an engine otherwise turns away a second game with a club in a day)
  delete St.met[D.club];
  const o = { club: D.club, how: how || 'play', tier: D.tier, kind: 'rdaily', ref: D.key };
  const why = ({ ball: wStartBall, grid: wStartGrid, ring: wStartRing }[D.eng])(o) || '';
  // baseball and football are on now; the Ring marks the day when its pairing is boxed (wRingGo)
  if (!why && D.eng !== 'ring' && St.live && St.live.world.kind === 'rdaily') wRdailyMark(D);
  return why;
}
const wW71RingGo = wRingGo;
wRingGo = function (o, mine, theirs, picks) {
  if (o && o.kind === 'rdaily' && !wBxg().live) { const D = wRdailyOf(o.ref, wRdailyMine()); wRdailyMark(D); }
  return wW71RingGo(o, mine, theirs, picks);
};
W_ON_END.rdaily = function (r, ref, W) {
  // (a simulated game settles inside its start, before the day is marked: the day's facts come from the date)
  const rec = wRdailyAll(), D = wRdailyOf(ref, wRdailyMine());
  const e = rec.days[ref] || (rec.days[ref] = { eng: D.eng, club: D.club, sport: D.sport, tier: D.tier, t: Date.now() });
  if (e.st && e.st !== 'on') return; // written once
  const f = wAdvMatchFacts(r, W);
  e.st = r === 'win' ? 'win' : r === 'tie' ? 'tie' : 'lose'; e.us = f.us; e.them = f.them;
  if (W && W.tier) e.tier = W.tier;
  wRdailySave(rec);
  let line;
  if (e.st === 'win' && !WG.advDead) {
    const t = e.tier || 1, g = W_RDAILY.gold * t, fa = W_RDAILY.fans * t;
    RUN.gold += g; RUN.fans = (RUN.fans || 0) + fa;
    line = [`You win the daily! +${g} gold and +${fa} fans on top of the usual pay.`, 'g'];
  } else line = [e.st === 'tie' ? 'The daily ends level. Come back tomorrow for the next one.' : 'You lose the daily. Come back tomorrow for the next one.', 'd'];
  // after the engine's own final line, which it logs once this returns
  Promise.resolve().then(() => wLog(line[0], line[1]));
};
/* Hardcore: a lost card match ends the journey without the usual dispatch, so the daily hears of it here */
const wW71MatchLost = wMatchLost;
wMatchLost = function (result) {
  const W = RUN && RUN.pending && RUN.pending.world;
  if (WG && WG.hardcore && W && W.kind === 'rdaily') { WG.advDead = 1; try { W_ON_END.rdaily('lose', W.ref, W); } catch (e) { console.error(e); } finally { delete WG.advDead; } }
  return wW71MatchLost(result);
};
const wW71Start = wStart;
wStart = function (save, opts) {
  const r = wW71Start(save, opts);
  try { if (WG && !LAB && !wRdailyAll().days[wRdailyToday()]) wLog(`Today’s daily: ${wRdailyWhat(wRdailyDay())}. Play it from the Team screen’s Daily tab.`); } catch (e) { console.error(e); }
  return r;
};

/* ---------- the Daily tab on the Team screen ---------- */
function wRdailyResult(e) {
  if (!e || e.st === 'on') return 'Started';
  const sc = e.us != null && e.them != null && (e.us || e.them) ? ` ${e.us}–${e.them}` : '';
  return (e.st === 'win' ? 'Won' : e.st === 'tie' ? 'Drew' : 'Lost') + sc;
}
function wCampDaily() {
  const D = wRdailyDay(), rec = wRdailyAll(), e = rec.days[D.key], live = wRdailyLive(D.key), probs = e ? [] : wRdailyProblems(D);
  const head = `<h5 class="wbrh">${esc(dayName(D.key, true))}: tier ${D.tier}, ${W_RDAILY_TIER[D.tier]}</h5>
    <p class="wrdwhat" data-rdwhat><b>${esc(wRdailyWhat(D))}.</b></p>`;
  let act;
  if (live) act = `<p class="hint">Your daily is waiting.</p><div class="row wnbtn"><button class="btn" data-rdresume>Resume the daily</button></div>`;
  else if (e) act = `<p class="hint" data-rdst="${e.st}">${e.st === 'on' ? 'You have started today’s daily.' : `Today’s daily: <b class="${e.st === 'win' ? 'wgood' : 'wbad'}">${esc(wRdailyResult(e))}</b>.`} The next one is tomorrow.</p>`;
  else act = `${probs.length ? `<p class="hint wball">${esc(probs[0])}</p>` : ''}<p class="hint">One attempt: the day is used once the game starts. A win pays the usual, plus ${W_RDAILY.gold * D.tier} gold and ${W_RDAILY.fans * D.tier} fans.</p>
    <div class="row wnbtn">${W_RDAILY.how[D.eng].map(([h, n], i) => `<button class="${i ? 'ghost' : 'btn'}" data-rdgo="${h}" ${probs.length ? 'disabled' : ''}>${n}</button>`).join('')}</div>`;
  const keys = Object.keys(rec.days).filter(k => k !== D.key).sort().reverse().slice(0, W_RDAILY.shown);
  const past = keys.length ? `<h5 class="wbrh">Past days</h5><ol class="wstlog" data-rdpast>${keys.map(k => { const x = rec.days[k];
    return `<li><b class="${x.st === 'win' ? 'wgood' : 'wbad'}">${esc(wRdailyResult(x))}</b> ${esc(dayName(k))}: ${esc(x.eng === 'card' && x.sport ? SPORT_NAME[x.sport].toLowerCase() : W_RDAILY.names[x.eng] || '')} against ${esc(x.club ? wBallName(x.club) : '')}, tier ${x.tier || 1}</li>`; }).join('')}</ol>` : '';
  return `<p class="hint">One match a day, the same for everyone: the game, the club and the difficulty come from the date. It gets harder through the week, from Sunday to Saturday. Your own team plays it, once.</p>${head}${act}${past}`;
}
const wW71OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  wW71OpenCamp(want === 'daily' ? 'team' : tab);
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="daily"]')) return;
  tabs.lastElementChild.insertAdjacentHTML('afterend', '<button role="tab" data-ctab="daily">Daily</button>');
  tabs.querySelector('[data-ctab="daily"]').onclick = () => { WCAMP.tab = 'daily'; WCAMP.swap = null; WCAMP.msg = ''; wRenderCamp(); };
  if (want === 'daily') { WCAMP.tab = 'daily'; wRenderCamp(); }
};
const wW71RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'daily') return wW71RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="daily"]')) { WCAMP.tab = 'team'; return wRenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'daily'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  body.innerHTML = wRdailySum() + (WCAMP.msg ? `<p class="hint wball">${esc(WCAMP.msg)}</p>` : '') + wCampDaily();
  wRdailyWire(body, () => WCAMP.close(), why => { WCAMP.msg = why; wOpenCamp('daily'); });
};
function wRdailySum() {
  const rec = wRdailyAll();
  return `<div class="wcsum"><span>Streak <b data-rdstreak>${wRdailyStreak(rec.days)}</b></span><span>Dailies won <b>${Object.values(rec.days).filter(x => x.st === 'win').length}</b></span></div>`;
}
// the buttons, on the Team screen's tab or the Daily page: leave() first, then the game; refused(why) if it won't start
function wRdailyWire(root, leave, refused) {
  root.querySelectorAll('[data-rdgo]').forEach(b => b.onclick = () => {
    leave();
    const why = wRdailyStart(b.dataset.rdgo);
    if (why) refused(why);
  });
  const r = root.querySelector('[data-rdresume]'); if (r) r.onclick = () => {
    const L = wRdailyLive(); leave();
    if (L === (WG.ball && WG.ball.live)) wResumeBall(); else if (L === (WG.gfg && WG.gfg.live)) wResumeGrid(); else wResumeRing();
  };
}

/* ---------- the Daily page (the top bar's Daily: Sudden Death's daily run has no place in the Realm) ---------- */
const WRDP = { msg: '' };
renderDaily = function () {
  const el = $('pg-daily'); if (!el) return;
  const head = `<h2 class="pgh">The Daily <small style="font-size:.4em;color:var(--dim)">${esc(profileName())}</small></h2>`;
  if (!WG || !RUN) {
    const D = wRdailyOf();
    el.innerHTML = `${head}<p class="lede">One match a day, the same for everyone. Your own team plays it, so start or continue a journey first (Play).</p>
      <p class="hint" data-rdwhat>Today: <b>${esc(wCap(D.eng === 'card' ? SPORT_NAME[D.sport] + ' in the card game' : W_RDAILY.names[D.eng]))}</b>, tier ${D.tier}.</p>${wRdailySum()}`;
    return;
  }
  el.innerHTML = `${head}<div class="wrdpage">${wRdailySum()}${WRDP.msg ? `<p class="hint wball">${esc(WRDP.msg)}</p>` : ''}${wCampDaily()}</div>`;
  WRDP.msg = '';
  wRdailyWire(el, () => showPage('play'), why => { WRDP.msg = why; showPage('daily'); });
};

/* ---------- How to play ---------- */
const wW71RenderHelp = renderHelp;
renderHelp = function () {
  wW71RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpRDaily')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpRDaily"><b>The daily.</b> One match a day, the same for everyone who plays that day: the game (the card game, baseball, football or boxing), the club you face and, for the card game, the sport and their side all come from the date. It gets harder through the week: tier 1 on Sunday and Monday, tier 2 from Tuesday to Thursday, tier 3 on Friday and Saturday. Your own team plays it, from the Daily tab on the Team screen or the Daily page in the top bar. You get one attempt: the day is used once the game starts, even on another journey, and a missed day can't be played later. A win pays the usual, plus ${W_RDAILY.gold} gold and ${W_RDAILY.fans} fans a tier. The tab keeps your streak and your past days.</p>`);
};
