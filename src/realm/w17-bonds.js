/* w17: personal quests and bonds (epic 2, phase 2). Loads after w16-stats.js; changes earlier parts only by
   reassignment (saved originals carry the wW17 prefix).

   Hometowns and personal quests. Every player comes from one of the five towns (p.home): a free agent from the
   town where you signed them, anyone else from a town whose region their kind lives in. Talk to a player from the
   Team screen. Once they reach level 2, ask them about HOME and they tell you what they want to do; say YES and it
   is their quest (p.pq). When it is done, take them home and talk to them there: they earn a nickname (p.nick) and
   their kind's Hall of Fame card, upgraded, as their own signature card.

   p.home   a town id (a key of W_GROUND.inns)
   p.pq     { t: a key of W_PQ, sport?, n, need, st: 'offer' | 'go' | 'home' | 'done' }
   p.nick   a nickname, once the quest is done (p.n never changes: careers are keyed by it)

   Bonds. Two players who start a match together build chemistry: 2 points for a win, 1 for a loss (WG.bonds).
   At W_BOND.strong points the pair is strong and picks a combo card. A combo card (c.wb = [pid, pid]) belongs to
   both of them and plays only when both start; release either and it goes.

   WG.bonds  { 'a-b' (lower id first): { n, combo } }   combo: true once the pair has been offered its card
   WG.wbondOffer  [a, b] while a combo card offer is open

   Wrapped: wChar and wSay (a player is someone you can talk to, id 'p:<pid>'), wRenderTalk (their own portrait),
   wDispatchEnd (quest progress, chemistry), wNextPrompt and wPromptLab and wShowCardOffer (the combo card offer), wGainCard (a combo
   card belongs to the pair), wAddPlayer (a hometown), wRelease (the pair's combo cards go), wBenchCards and
   wNextMatchDeck and wLeagueCards (combo cards sit out unless both start), wRenderCamp (Talk buttons, quests,
   nicknames, chemistry), wCampDeck (the combo cards), renderHelp. Sudden Death's RAR_NAME gets 'b', a combo. */

const W_BOND = {
  questLvl: 2,        // a player tells you about home from this level
  good: 4, strong: 12, // chemistry points: a win together is 2, a loss 1
};

/* ---------- combo cards: kind 'any', rarity 'b', so no reward, shop or library pool ever offers them ---------- */
RAR_NAME.b = 'Combo';
K('wb_onetwo', 'One-Two', 'any', 'atk', 1, 'b', 'one', [['d', 5, 2], ['draw', 1]], { fl: 'You go, I go. Combo: plays when both are on the field.' });
K('wb_cover', 'Cover for Me', 'any', 'skl', 1, 'b', 'self', [['b', 10], ['draw', 1]], { fl: 'I have your back. Combo: plays when both are on the field.' });
K('wb_alley', 'Alley-Oop', 'any', 'atk', 2, 'b', 'one', [['d', 16], ['nrg', 1]], { sport: 'basketball', fl: 'Up, and in. Combo: plays when both are on the field.' });
K('wb_wall', 'Two-Man Wall', 'any', 'skl', 1, 'b', 'self', [['b', 7], ['s', 'weak', 1, 'all']], { sport: 'football', fl: 'Nobody through. Combo: plays when both are on the field.' });
K('wb_giveandgo', 'Give and Go', 'any', 'atk', 0, 'b', 'one', [['d', 4], ['draw', 2]], { sport: 'hockey', fl: 'Pass, run, take it back. Combo: plays when both are on the field.' });
const W_COMBOS = ['wb_onetwo', 'wb_cover', 'wb_alley', 'wb_wall', 'wb_giveandgo'];

/* ---------- personal quests ---------- */
const W_PQ = {
  home: { need: 1, nick: (p, q) => `the Pride of ${wTownName(p.home)}`,
    goal: (p, q) => `Win a match in ${wPqRegion(p)} with ${p.n} starting`,
    ask: (p, q) => `${wTownName(p.home)}, in ${wPqRegion(p)}. They all said I would never make a team. Win a match in ${wPqRegion(p)} with me starting, and they will hear about it. Then take me home to see their faces. Say YES and I will hold you to it.` },
  mvp: { need: 2, nick: () => pick(['Big Game', 'Clutch', 'Showtime', 'Prime Time']),
    goal: (p, q) => `${p.n} is player of the game in ${q.need} wins`,
    ask: (p, q) => `${wTownName(p.home)}. My family keeps a scrapbook, and it is empty. Make me player of the game twice and I will have something to send them. Then take me home with the clippings. Say YES and I will hold you to it.` },
  sport: { need: 2, nick: (p, q) => `${SPORT_NAME[q.sport]} ${pick(['Ace', 'Star', 'Legend'])}`,
    goal: (p, q) => `Win ${q.need} ${SPORT_NAME[q.sport].toLowerCase()} matches with ${p.n} starting`,
    ask: (p, q) => `${wTownName(p.home)}. Everybody there plays ${SPORT_NAME[q.sport].toLowerCase()}, and I was the worst of them. Win two ${SPORT_NAME[q.sport].toLowerCase()} matches with me starting, then take me home so I can tell them myself. Say YES and I will hold you to it.` },
  big: { need: 1, nick: () => pick(['Giant-Killer', 'Upset', 'No Fear']),
    goal: (p, q) => `Beat an elite, rival or boss team with ${p.n} starting`,
    ask: (p, q) => `${wTownName(p.home)}. My old coach cut me for being soft. Beat an elite or rival team with me starting, then take me home. I want to tell him to his face. Say YES and I will hold you to it.` },
};
function wTowns() { return Object.keys(W_GROUND.inns); }
function wPqRegion(p) { return DB.regions[wTownRegion(p.home)].name; }
/* a hometown: kept once set; else a town whose region their kind lives in */
function wEnsureHome(p) {
  if (!p) return null;
  if (p.home && W_GROUND.inns[p.home]) return p.home;
  const towns = wTowns(), fit = towns.filter(t => (DB.regions[wTownRegion(t)] || {}).kinds.includes(p.kind));
  return (p.home = pick(fit.length ? fit : towns));
}
function wNameOf(p) { return !p ? '' : !p.nick ? p.n : /^the /.test(p.nick) ? `${p.n}, ${p.nick}` : `${p.n} "${p.nick}"`; }
/* their quest, made up the first time they get to tell you about it */
function wQuestOffer(p) {
  if (!p) return null;
  wEnsureHome(p);
  if (p.pq) return p.pq;
  if (p.lvl < W_BOND.questLvl) return null;
  const t = pick(Object.keys(W_PQ));
  p.pq = { t, n: 0, need: W_PQ[t].need, st: 'offer' };
  if (t === 'sport') p.pq.sport = DB.regions[wTownRegion(p.home)].sports[0][0];
  wSave();
  return p.pq;
}
function wQuestGoal(p) { return p && p.pq ? W_PQ[p.pq.t].goal(p, p.pq) : ''; }
function wQuestAccept(p) {
  const q = wQuestOffer(p); if (!q || q.st !== 'offer') return false;
  q.st = 'go';
  wLog(`${p.n}'s quest: ${wQuestGoal(p)}, then take them home to ${wTownName(p.home)}.`, 'g');
  wSave();
  return true;
}
/* a match just ended: every starter with a quest under way checks it */
function wQuestTick(starters, W, r, g, type) {
  if (r !== 'win') return;
  for (const p of starters) {
    const q = p.pq; if (!q || q.st !== 'go') continue;
    const hit = q.t === 'home' ? W.region === wTownRegion(wEnsureHome(p))
      : q.t === 'mvp' ? g.mvp === p.kind
      : q.t === 'sport' ? g.sport === q.sport
      : q.t === 'big' ? ['elite', 'rival', 'boss'].includes(type) : false;
    if (!hit) continue;
    q.n++;
    if (q.n >= q.need) { q.st = 'home'; wLog(`${p.n} did it. Take them home to ${wTownName(p.home)} and talk to them there.`, 'g'); }
    else wLog(`${p.n}'s quest: ${q.n} of ${q.need}.`, 'g');
  }
}
/* home, with the quest done: a nickname and their Hall of Fame card. Returns '' or why not. */
function wQuestTurnIn(p) {
  const q = p && p.pq;
  if (!q || q.st !== 'home') return 'Not yet.';
  if (WG.map !== p.home) return `Take ${p.n} home to ${wTownName(p.home)} first.`;
  q.st = 'done';
  p.nick = W_PQ[q.t].nick(p, q);
  const id = CARDS['hof_' + p.kind] ? 'hof_' + p.kind : (wKindPool(p.kind, 6).filter(i => CARDS[i].rar === 'r')[0] || SIG[p.kind]);
  wLog(`${p.n} is ${wNameOf(p)} now.`, 'g');
  if (id) wGainCard({ id, up: true, pid: p.id }, `${p.n}'s signature card`);
  wSave();
  return '';
}
function wQuestLine(p) {
  const q = p.pq, town = wTownName(wEnsureHome(p));
  if (!q) return p.lvl >= W_BOND.questLvl ? `From ${town}. Has something to ask you.` : `From ${town}.`;
  if (q.st === 'offer') return `From ${town}. Has something to ask you.`;
  if (q.st === 'go') return `Quest: ${wQuestGoal(p)} (${q.n}/${q.need}).`;
  if (q.st === 'home') return `Quest: take ${p.n} home to ${town}.`;
  return `From ${town}. Quest done.`;
}
/* someone to talk to: an exclamation on the row when they have something new to say */
function wQuestNews(p) { const q = p.pq; return (!q && p.lvl >= W_BOND.questLvl) || (q && q.st === 'offer') || (q && q.st === 'home' && WG.map === p.home); }

/* ---------- talking to your own players: id 'p:<pid>' ---------- */
function wTalkPid(id) { return typeof id === 'string' && id.slice(0, 2) === 'p:' ? +id.slice(2) : null; }
const wW17Char = wChar;
wChar = function (id) {
  const pid = wTalkPid(id); if (pid == null) return wW17Char(id);
  const p = wPlayer(pid); if (!p) return { name: 'Somebody', greet: '...', topics: {}, kind: 'goblin' };
  const topics = { job: {}, home: {} };
  if (p.pq && p.pq.st === 'offer') topics.yes = {};
  return { name: wNameOf(p), kind: p.kind, greet: wPlayerSay(p, '').text, topics };
};
const wW17Say = wSay;
wSay = function (id, kw) {
  const pid = wTalkPid(id); if (pid == null) return wW17Say(id, kw);
  return wPlayerSay(wPlayer(pid), kw);
};
function wPlayerSay(p, kw) {
  if (!p) return { text: null };
  kw = (kw || '').trim().toLowerCase();
  const town = wTownName(wEnsureHome(p)), q = p.pq;
  if (!kw) return { text: q && q.st === 'done' ? `Coach. Thanks again for taking me HOME.` : q && q.st === 'home' ? `Coach. We did it. Now take me HOME.` : `Coach. Ask me about my JOB, or where I call HOME.` };
  if (kw === 'name') return { text: `I am ${wNameOf(p)}.` };
  if (kw === 'bye') return { text: null };
  if (kw === 'job') return { text: `${wKindName(p.kind)}, number ${p.num}. ${p.flav || ''}`.trim(), key: 'job' };
  if (kw.startsWith('home')) {
    const o = wQuestOffer(p);
    if (!o) return { text: `${town}, in ${wPqRegion(p)}. There is something I want to do there. Ask me again when we have played a few more games.`, key: 'home' };
    if (o.st === 'offer') return { text: W_PQ[o.t].ask(p, o), key: 'home' };
    if (o.st === 'go') return { text: `${wQuestGoal(p)}: ${o.n} of ${o.need} so far. Then home to ${town}.`, key: 'home' };
    if (o.st === 'home') {
      if (wQuestTurnIn(p)) return { text: `We did it, Coach. Now take me home to ${town}, and talk to me there.`, key: 'home' };
      return { text: `${town}. It is good to be back. They have a new name for me here: ${p.nick}. And I have been working on something for you.`, key: 'home' };
    }
    return { text: `${town} still talks about it. Thank you, Coach.`, key: 'home' };
  }
  if (kw === 'yes' && q && q.st === 'offer') { wQuestAccept(p); return { text: `Then it is a deal. ${wQuestGoal(p)}, and then home to ${town}.`, key: 'yes' }; }
  return { text: pick(['Ask me about HOME, Coach.', 'I would not know about that.']) };
}
function wTalkPlayer(pid) {
  const p = wPlayer(pid); if (!p) return;
  if (WCAMP.close && !$('modal').hidden) WCAMP.close();
  wOpenTalk('p:' + pid, wSay('p:' + pid, '').text);
}
const wW17RenderTalk = wRenderTalk;
wRenderTalk = function () {
  wW17RenderTalk();
  const T = WUI.talk, pid = T && wTalkPid(T.id), p = pid != null && wPlayer(pid), img = p && document.querySelector('#wTalk .wtport');
  if (img) img.src = wPlayerPort(p, 96);
};

/* ---------- bonds ---------- */
function wBondKey(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }
function wBond(a, b) { return ((WG && WG.bonds) || {})[wBondKey(a, b)] || null; }
function wBondLevel(n) { return n >= W_BOND.strong ? 'Strong' : n >= W_BOND.good ? 'Good' : 'New'; }
function wBondTick(starters, r) {
  WG.bonds = WG.bonds || {};
  for (let i = 0; i < starters.length; i++) for (let j = i + 1; j < starters.length; j++) {
    const a = starters[i], b = starters[j], k = wBondKey(a.id, b.id);
    const B0 = WG.bonds[k] = WG.bonds[k] || { n: 0, combo: false };
    const was = B0.n; B0.n += r === 'win' ? 2 : 1;
    if (was < W_BOND.strong && B0.n >= W_BOND.strong && !B0.combo) {
      B0.combo = true;
      wLog(`${a.n} and ${b.n} play like one player now. They have a combo card for you.`, 'g');
      WG.wprompts.push({ t: 'bond', a: a.id, b: b.id });
    } else if (was < W_BOND.good && B0.n >= W_BOND.good) wLog(`${a.n} and ${b.n} are getting the hang of each other.`, 'm');
  }
}
/* the combo cards a pair owns */
function wComboCards(pid) { return wAllCards().filter(c => c.wb && (pid == null || c.wb.includes(pid))); }
function wComboOn(c) { return !c.wb || c.wb.every(wIsStarter); }

const wW17DispatchEnd = wDispatchEnd;
wDispatchEnd = function (W, r) {
  const st = WG && WG.roster ? wStarters().slice() : [], type = WG && WG.wfoes ? WG.wfoes.type : null;
  wW17DispatchEnd(W, r);
  if (!W || !WG || !WG.roster) return;
  try {
    const gs = RUN.games || [], g = gs[gs.length - 1] || {};
    const live = st.filter(p => wPlayer(p.id));
    wQuestTick(live, W, r, g, type || g.type || 'normal');
    wBondTick(live, r);
  } catch (e) { console.error(e); }
  wSave();
};

/* the combo card offer: a pick of three, owned by the pair */
function wBondOffer(P) {
  const a = wPlayer(P.a), b = wPlayer(P.b); if (!a || !b) return false;
  WG.wbondOffer = [a.id, b.id];
  if (LAB) { wGainCard({ id: pick(W_COMBOS) }, 'combo'); return true; }
  const r = wGainCard({ pick: 3, pool: W_COMBOS }, `${a.n} and ${b.n}'s combo`);
  if (r && WG.cardOffer) { WG.cardOffer.bond = [a.id, b.id]; wBondBanner(WG.cardOffer); wSave(); }
  return true;
}
function wBondBanner(O) {
  const a = wPlayer(O.bond[0]), b = wPlayer(O.bond[1]), box = $('modalBox'), hd = box && box.querySelector('header');
  if (LAB || !a || !b || $('modal').hidden || !hd || box.querySelector('.wlvl')) return;
  hd.insertAdjacentHTML('afterend', `<div class="wlvl wbondb"><span class="wbps"><img src="${wPlayerPort(a, 64)}" alt=""><img src="${wPlayerPort(b, 64)}" alt=""></span><div><small>Chemistry</small><b>${esc(a.n)} and ${esc(b.n)}</b><span>Pick their combo card. It plays only when both of them start.</span></div></div>`);
}
/* an offer shown again (after a blackout, or a reload) keeps its banner: the pair's, or a level up's */
const wW17ShowCardOffer = wShowCardOffer;
wShowCardOffer = function () {
  wW17ShowCardOffer();
  const O = WG && WG.cardOffer; if (!O) return;
  if (O.bond) { WG.wbondOffer = O.bond.slice(); wBondBanner(O); }
  else if (O.pid != null && /reached level/.test(O.why || '')) wLevelBanner(O.pid);
};
const wW17NextPrompt = wNextPrompt;
wNextPrompt = function () {
  const P = WG && WG.wprompts && WG.wprompts[0];
  if (P && P.t === 'bond' && !LAB && !WG.cardOffer && !WG.event && !(typeof W11 !== 'undefined' && W11.ending) && wActive()) {
    WG.wprompts.shift(); wBondOffer(P); wSave(); return true;
  }
  return wW17NextPrompt();
};
const wW17PromptLab = wPromptLab;
wPromptLab = function (P) { if (P && P.t === 'bond') return wBondOffer(P); return wW17PromptLab(P); };

const wW17GainCard = wGainCard;
wGainCard = function (spec, why) {
  const r = wW17GainCard(spec, why);
  if (r && !Array.isArray(r) && CARDS[r.id] && CARDS[r.id].rar === 'b' && WG.wbondOffer) {
    r.wb = WG.wbondOffer.slice(); delete r.wp; WG.wbondOffer = null; wSave();
  }
  return r;
};

/* a free agent comes from the town you signed them in */
const wW17AddPlayer = wAddPlayer;
wAddPlayer = function (p) {
  if (p && !p.home && p.from === 'tavern' && W_GROUND.inns[WG.map]) p.home = WG.map;
  const out = wW17AddPlayer(p);
  wEnsureHome(p);
  return out;
};
/* release either half of a pair and their combo cards go with them */
const wW17Release = wRelease;
wRelease = function (pid) {
  const why = wW17Release(pid);
  if (why) return why;
  const gone = c => c.wb && c.wb.includes(pid), n = wComboCards(pid).length;
  RUN.deck = RUN.deck.filter(c => !gone(c)); RUN.wbench = (RUN.wbench || []).filter(c => !gone(c));
  for (const k of Object.keys(WG.bonds || {})) if (k.split('-').map(Number).includes(pid)) delete WG.bonds[k];
  if (n) wLog(`Their combo card${n === 1 ? '' : 's'} go${n === 1 ? 'es' : ''} too.`, 'd');
  wSave();
  return '';
};
/* combo cards sit out unless both of the pair start */
const wW17BenchCards = wBenchCards;
wBenchCards = function () {
  wW17BenchCards();
  const off = RUN.deck.filter(c => !wComboOn(c));
  if (off.length) { RUN.wbench = RUN.wbench.concat(off); RUN.deck = RUN.deck.filter(wComboOn); }
};
const wW17NextMatchDeck = wNextMatchDeck;
wNextMatchDeck = function () { return wW17NextMatchDeck().filter(wComboOn); };
const wW17LeagueCards = wLeagueCards;
wLeagueCards = function () { return wW17LeagueCards().filter(c => !c.wb); };

/* ---------- the Team screen: Talk, the quest line, nicknames, chemistry, combo cards ---------- */
function wChemHtml() {
  const R = wRoster(), st = wStarters(), pairs = [];
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) pairs.push([st[i], st[j]]);
  for (const k of Object.keys(WG.bonds || {})) {
    const [a, b] = k.split('-').map(n => wPlayer(+n));
    if (a && b && !pairs.some(([x, y]) => wBondKey(x.id, y.id) === k) && WG.bonds[k].n >= W_BOND.good) pairs.push([a, b]);
  }
  if (!pairs.length) return '';
  return `<h4>Chemistry</h4><p class="hint">Players who start together build chemistry. A strong pair picks a combo card that plays when both start.</p>
    <ul class="wchem">${pairs.map(([a, b]) => {
      const n = (wBond(a.id, b.id) || {}).n || 0, lv = wBondLevel(n), on = wIsStarter(a.id) && wIsStarter(b.id), combos = wComboCards(a.id).filter(c => c.wb.includes(b.id));
      return `<li class="${on ? '' : 'wout'}"><span class="wbps"><img src="${wPlayerPort(a, 40)}" alt=""><img src="${wPlayerPort(b, 40)}" alt=""></span>
        <span class="wchn"><b>${esc(a.n)} and ${esc(b.n)}</b><small>${lv}${combos.length ? `: ${combos.map(c => esc(def(c).n)).join(', ')}` : n < W_BOND.strong ? `, ${n}/${W_BOND.strong}` : ''}${on ? '' : '. Not both starting'}</small></span>
        <span class="wxp" role="progressbar" aria-label="${esc(a.n)} and ${esc(b.n)}'s chemistry" aria-valuemin="0" aria-valuemax="${W_BOND.strong}" aria-valuenow="${Math.min(n, W_BOND.strong)}"><i style="width:${Math.round(100 * Math.min(n, W_BOND.strong) / W_BOND.strong)}%"></i></span></li>`;
    }).join('')}</ul>`;
}
const wW17RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW17RenderCamp();
  const body = $('wCampBody');
  if (WCAMP.tab !== 'team' || !body) return;
  body.querySelectorAll('li[data-pid]').forEach(li => {
    const p = wPlayer(+li.dataset.pid); if (!p) return;
    const nm = li.querySelector('.wpn b'); if (nm) nm.textContent = wNameOf(p);
    const car = li.querySelector('.wcar');
    if (car && !li.querySelector('.wpq')) car.insertAdjacentHTML('beforebegin', `<small class="wpq${p.pq && p.pq.st === 'home' ? ' wgood' : ''}">${esc(wQuestLine(p))}</small>`);
    const pa = li.querySelector('.wpa');
    if (pa && !pa.querySelector('[data-ptalk]')) {
      const b = document.createElement('button'); b.className = 'ghost' + (wQuestNews(p) ? ' wnews' : ''); b.dataset.ptalk = '';
      b.textContent = 'Talk'; b.setAttribute('aria-label', `Talk to ${p.n}${wQuestNews(p) ? ': they have something to say' : ''}`);
      b.onclick = () => wTalkPlayer(p.id);
      pa.insertBefore(b, pa.querySelector('[data-pstats]') || pa.querySelector('[data-rel]'));
    }
  });
  const ol = body.querySelectorAll('ol.wroster');
  if (ol.length && !body.querySelector('.wchem')) ol[0].insertAdjacentHTML('afterend', wChemHtml());
};
const wW17CampDeck = wCampDeck;
wCampDeck = function () {
  const combos = wComboCards();
  if (!combos.length) return wW17CampDeck();
  const by = {};
  for (const c of combos) (by[wBondKey(c.wb[0], c.wb[1])] = by[wBondKey(c.wb[0], c.wb[1])] || []).push(c);
  return wW17CampDeck() + Object.keys(by).map(k => {
    const [a, b] = k.split('-').map(n => wPlayer(+n)), on = by[k].every(wComboOn);
    return `<section class="wdk${on ? '' : ' wout'}"><h4>Combo: ${esc(a ? a.n : '?')} and ${esc(b ? b.n : '?')} (${by[k].length})${on ? ': both start' : ': sits out unless both start'}</h4><div class="cardgrid">${by[k].map(c => cardHTML(c, { flav: false })).join('')}</div></section>`;
  }).join('');
};

/* ---------- How to play ---------- */
const wW17RenderHelp = renderHelp;
renderHelp = function () {
  wW17RenderHelp();
  const team = $('wHelpTeam'); if (!team || $('wHelpBonds')) return;
  team.insertAdjacentHTML('beforeend', `<div id="wHelpBonds"><p class="hint"><b>Hometowns and quests.</b> Every player comes from one of the five towns. Talk to them from the Team screen. From level ${W_BOND.questLvl}, ask about HOME and they tell you what they want to do there; say YES and it is their quest. When it is done, take them home and talk to them there. They earn a nickname and their kind's Hall of Fame card, upgraded, as their own signature card.</p>
    <p class="hint"><b>Chemistry.</b> Two players who start a match together build chemistry: more for a win than a loss. A strong pair picks a combo card. It belongs to both of them and plays only when both start. Release either one and it goes.</p></div>`);
};
