/* w27: notice boards (epic 2, phase 4). Loads after w26-gfeel.js; changes earlier parts only by reassignment (saved
   originals carry the wW27 prefix).

   Every city's inn has a notice board: ask the innkeeper about the NOTICES, or the Notice board button in the room
   menu. Each week the board posts W_NOTICE.posted contracts for its region. Take up to W_NOTICE.max at once; a taken
   contract runs W_NOTICE.days days, then lapses (no penalty). A contract is done the moment a match you win meets it,
   anywhere, and pays at once: gold and fans, and for the harder ones a pick of cards for the region's sports.

     sport    win a <sport> game in the region
     night    win a <sport> game in the region at night
     margin   win a <sport> game in the region by <n> or more (the sports with a running score)
     club     beat the region's rival club (Apex Athletic for the Charter Plains), anywhere
     ground   win a game at one of the city's grounds (not the Ballpark)
     seeded   beat a seeded team (a scouting report) in the region
     count    win <n> games in the region

   WG.notice = { boards: { city: { week, list: [contract] } }, taken: [contract], done, lapsed }, plain data.
   A contract: { id, city, region, t, sport?, n?, club?, g?, pay: { gold, fans, card? }, prog, until? }
   W_NOTICE, wBoard(city), wTakeNotice(city, id), wDropNotice(id), wNoticeText(c), wNoticeMet(c, M), wOpenBoard(city)
   Also a tip (w_notice) and a medal (w_notices, Odd Jobs: realmNotices).
   Wrapped: wDispatchEnd (contracts met by a win), wNewDay (lapsing), wRunAct (act 'board'), wOpenInn (the Notice
   board button), wJQuests (contracts in the journal), renderHelp (#wHelpNotices). */

const W_NOTICE = {
  posted: 3, max: 3, days: 7,
  // gold by type at tier 1; times 1.5 in a tier 2 region. Fans are two fifths of the gold. Kept small: the bot finishes
  // about a dozen a journey, and gold already piles up (docs/realm/BALANCE.md)
  gold: { sport: 20, night: 30, margin: 30, club: 45, ground: 25, seeded: 30, count: 35 },
  card: { club: 1, count: 1, margin: 1 },     // these also pay a pick of 3 cards for the region's sports
  margin: { baseball: 3, basketball: 6, hockey: 2, football: 7, jousting: 2, curling: 2 },
  count: 3,
};
const W_NOTICE_CITY = { graftonbury: 'hq_inn', mossgate: 'moss_inn', saltmere: 'salt_inn', cinderhold: 'cind_inn', rimewatch: 'rime_inn' };
const W_NOTICE_CUP = { bloom: 'moss', tide: 'salt', ember: 'cind', rime: 'rime' };

function wNotices() { return (WG.notice = WG.notice || { boards: {}, taken: [], done: 0, lapsed: 0 }); }
/* 'the Charter Plains', 'the Mosswold' */
function wRegThe(r) { const n = (DB.regions[r] || {}).name || r; return 'the ' + n.replace(/^The /, ''); }
function wNoticeRegion(city) { return W_GRD_REG[city] || 'plains'; }
function wNoticeClub(region) { return region === 'plains' ? 'apex' : wCupRival(W_NOTICE_CUP[region]); }
function wNoticePay(t, region) {
  const g = Math.round(W_NOTICE.gold[t] * ((W_TIER[region] || 1) > 1 ? 1.5 : 1) / 5) * 5;
  return { gold: g, fans: Math.round(g * 2 / 5), card: W_NOTICE.card[t] ? 1 : 0 };
}
/* a fresh contract of type t for a city's board, or null if that type has nothing to offer there */
function wMakeNotice(city, t) {
  const region = wNoticeRegion(city), sports = DB.regions[region].sports.map(s => s[0]);
  const c = { id: 'n' + WG.dayAbs + '_' + Math.floor(Math.random() * 1e6), city, region, t, prog: 0, pay: wNoticePay(t, region) };
  if (t === 'sport' || t === 'night') c.sport = pick(sports);
  else if (t === 'margin') { const ok = sports.filter(s => W_NOTICE.margin[s]); if (!ok.length) return null; c.sport = pick(ok); c.n = W_NOTICE.margin[c.sport]; }
  else if (t === 'club') { c.club = wNoticeClub(region); if (!c.club) return null; }
  else if (t === 'ground') { const gs = wGrdsOf(city).filter(g => g.sport !== 'baseball'); if (!gs.length) return null; c.g = pick(gs).id; }
  else if (t === 'count') c.n = W_NOTICE.count;
  return c;
}
/* this week's board for a city: posted once a week, minus what you have taken */
function wBoard(city) {
  const N = wNotices(), wk = wWeek();
  let b = N.boards[city];
  if (!b || b.week !== wk) {
    const list = [];
    for (const t of shuffle(Object.keys(W_NOTICE.gold))) {
      if (list.length >= W_NOTICE.posted) break;
      const c = wMakeNotice(city, t); if (c) list.push(c);
    }
    b = N.boards[city] = { week: wk, list };
  }
  return b;
}
function wNoticeTaken(id) { return wNotices().taken.find(c => c.id === id) || null; }
/* take one: '' or why not */
function wTakeNotice(city, id) {
  const N = wNotices(), b = wBoard(city), c = b.list.find(x => x.id === id);
  if (!c) return 'That notice has gone.';
  if (N.taken.length >= W_NOTICE.max) return `You can take ${W_NOTICE.max} contracts at a time. Finish or drop one first.`;
  b.list = b.list.filter(x => x !== c);
  c.until = WG.dayAbs + W_NOTICE.days;
  N.taken.push(c);
  wLog(`You take a contract from the board: ${wNoticeText(c)}.`, 'm');
  wSave();
  return '';
}
function wDropNotice(id) {
  const N = wNotices(), c = wNoticeTaken(id); if (!c) return;
  N.taken = N.taken.filter(x => x !== c);
  wLog(`You drop a contract: ${wNoticeText(c)}.`, 'd');
  wSave();
}

/* ---------- words ---------- */
function wNoticeText(c) {
  const R = wRegThe(c.region), sp = c.sport ? (SPORT_NAME[c.sport] || c.sport).toLowerCase() : '';
  switch (c.t) {
    case 'sport': return `win a ${sp} game in ${R}`;
    case 'night': return `win a ${sp} game in ${R} at night`;
    case 'margin': return `win a ${sp} game in ${R} by ${c.n} or more`;
    case 'club': return `beat ${wTheClub(c.club)}`;
    case 'ground': return `win a game at ${((wGrd(c.g) || {}).name || 'the ground').replace(/^The /, 'the ')}`;
    case 'seeded': return `beat a seeded team in ${R}`;
    case 'count': return `win ${c.n} games in ${R}`;
  }
  return 'a job';
}
function wNoticeHow(c) {
  switch (c.t) {
    case 'night': return 'Night games are out in the wild after dark.';
    case 'margin': return 'You must win the game on the scoreboard too, by that much.';
    case 'club': return 'In a cup, a fixture or a grudge match, wherever they turn up.';
    case 'ground': return 'A Friendly, a Challenge or your fixture there. The ground wants a full squad.';
    case 'seeded': return 'Seeded teams have a scouting report: a Challenge at a ground, a cup\'s second round, an alpha.';
    case 'count': return 'Any games you win in the region count.';
  }
  return 'Any match in the region counts: wild, cup, ground or dungeon.';
}
function wNoticePayText(p) { return `${p.gold} gold, ${p.fans} fans${p.card ? ', and a pick of cards' : ''}`; }

/* ---------- does a won match meet a contract? M: { region, sport, night, us, them, won, club, g, type } ---------- */
function wNoticeMet(c, M) {
  const here = M.region === c.region;
  switch (c.t) {
    case 'sport': return here && M.sport === c.sport;
    case 'night': return here && M.sport === c.sport && !!M.night;
    case 'margin': return here && M.sport === c.sport && M.won && M.us - M.them >= c.n;
    case 'club': return !!M.club && M.club === c.club;
    case 'ground': return M.g === c.g;
    case 'seeded': return here && M.type === 'elite';
    case 'count': return here;
  }
  return false;
}
function wNoticeFacts(W) {
  const g = (RUN.games || [])[RUN.games.length - 1] || {}, ref = W.ref || {};
  return { region: W.region, sport: g.sport, night: !!W.night, us: +g.us || 0, them: +g.them || 0, won: !!g.won, type: g.type,
    club: ref.club || ref.rival || null, g: W.kind === 'ground' ? ref.g : null };
}
function wNoticePayOut(c) {
  const p = c.pay;
  RUN.gold += p.gold; RUN.fans = (RUN.fans || 0) + p.fans; achAdd('realmNotices', 1);
  wLog(`Contract done: ${wNoticeText(c)}. ${p.gold} gold and ${p.fans} fans.`, 'g');
  if (p.card) wGainCard({ pick: 3, pool: wSportPool(DB.regions[c.region].sports.map(s => s[0])) }, 'a contract');
}
function wNoticeWin(W) {
  const N = wNotices(); if (!N.taken.length) return;
  const M = wNoticeFacts(W);
  for (const c of N.taken.slice()) {
    if (!wNoticeMet(c, M)) continue;
    if (c.t === 'count' && ++c.prog < c.n) { wLog(`Contract: ${c.prog} of ${c.n} wins in ${wRegThe(c.region)}.`, 'm'); continue; }
    N.taken = N.taken.filter(x => x !== c); N.done++;
    wNoticePayOut(c);
  }
}
const wW27DispatchEnd = wDispatchEnd;
wDispatchEnd = function (W, r) {
  wW27DispatchEnd(W, r);
  if (W && r === 'win' && WG) { try { wNoticeWin(W); } catch (e) { console.error(e); } }
};
const wW27NewDay = wNewDay;
wNewDay = function () {
  wW27NewDay();
  const N = WG && WG.notice; if (!N || !N.taken.length) return;
  for (const c of N.taken.filter(c => WG.dayAbs > c.until)) { N.lapsed++; wLog(`A contract lapses: ${wNoticeText(c)}.`, 'd'); }
  N.taken = N.taken.filter(c => WG.dayAbs <= c.until);
};

/* ---------- the board ---------- */
function wNoticeRow(c, taken, full) {
  const left = taken ? c.until - WG.dayAbs : 0;
  return `<li class="wbcl"><span class="wbsw" style="background:${c.sport ? W_GRD_COL[c.sport] : c.club ? wClubColor(c.club) : '#8a6a3a'}"></span>
    <div><b>${esc(wCap(wNoticeText(c)))}</b>${c.t === 'count' && taken ? ` <small>(${c.prog} of ${c.n})</small>` : ''}
    <small>${esc(wNoticeHow(c))} Pays ${esc(wNoticePayText(c.pay))}.${taken ? ` ${left <= 0 ? 'Lapses tonight.' : `${left} day${left === 1 ? '' : 's'} left.`} From ${esc(wTownName(c.city))}.` : ` ${W_NOTICE.days} days once taken.`}</small></div>
    <div class="row">${taken ? `<button class="ghost" data-ndrop="${c.id}">Drop</button>` : `<button class="btn" data-ntake="${c.id}" ${full ? 'disabled' : ''}>Take</button>`}</div></li>`;
}
function wOpenBoard(city, msg) {
  if (LAB) return;
  city = city || wCurMap().id;
  if (!W_NOTICE_CITY[city]) return;
  const N = wNotices(), b = wBoard(city), full = N.taken.length >= W_NOTICE.max;
  const close = modal(`<header><h3>The notice board, ${esc(wTownName(city))}</h3><button class="ghost" data-close>Done</button></header>
    ${msg ? `<p class="${msg.ok ? 'wgood' : 'wbad'}" role="status">${esc(msg.t)}</p>` : ''}
    <p class="hint">Contracts for ${esc(wRegThe(wNoticeRegion(city)))}, pinned up fresh every week. Take up to ${W_NOTICE.max}; each is done the moment you win a match that meets it, and pays at once.</p>
    ${b.list.length ? `<ul class="wbclubs">${b.list.map(c => wNoticeRow(c, false, full)).join('')}</ul>` : '<p class="hint">Nothing left on the board this week. New notices go up next week.</p>'}
    <h4>Your contracts (${N.taken.length} of ${W_NOTICE.max})</h4>${full && b.list.length ? '<p class="hint">You hold as many as you can. Finish or drop one to take another.</p>' : ''}
    ${N.taken.length ? `<ul class="wbclubs">${N.taken.map(c => wNoticeRow(c, true)).join('')}</ul>` : '<p class="hint">None taken.</p>'}
    ${N.done ? `<p class="hint">Contracts done this journey: ${N.done}.</p>` : ''}`);
  $('modalBox').querySelectorAll('[data-ntake]').forEach(e => { e.onclick = () => { const r = wTakeNotice(city, e.dataset.ntake); close(); wDrain(); wOpenBoard(city, { ok: !r, t: r || 'Taken.' }); }; });
  $('modalBox').querySelectorAll('[data-ndrop]').forEach(e => e.onclick = () => { wDropNotice(e.dataset.ndrop); close(); wDrain(); wOpenBoard(city); });
}
for (const city in W_NOTICE_CITY) {
  const ch = DB.chars[W_NOTICE_CITY[city]]; if (!ch) continue;
  ch.topics.notices = { t: 'The board by the stairs. Folk pin up jobs for teams: win this, beat them. They pay when it is done.', act: 'board' };
  ch.greet += ' NOTICES on the board, if you want work.';
}
const wW27RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'board') return wOpenBoard(wCurMap().id);
  return wW27RunAct(act, id);
};
const wW27OpenInn = wOpenInn;
wOpenInn = function (price, who) {
  wW27OpenInn(price, who);
  const row = $('wSleep') && $('wSleep').parentNode; if (!row || $('wInnBoard') || !W_NOTICE_CITY[wCurMap().id]) return;
  row.insertAdjacentHTML('beforeend', '<button class="ghost" id="wInnBoard">Notice board</button>');
  $('wInnBoard').onclick = () => wOpenBoard(wCurMap().id);
};

/* ---------- the journal ---------- */
const wW27JQuests = wJQuests;
wJQuests = function () {
  const [n, h] = wW27JQuests(), N = WG && WG.notice;
  if (!N || !N.taken.length) return [n, h];
  const rows = N.taken.filter(c => wJPass('quest', c.id, wNoticeText(c))).map(c => `<div class="wjq"><b>Contract: ${esc(wCap(wNoticeText(c)))}</b> <small>from the board at ${esc(wTownName(c.city))} &middot; ${Math.max(0, c.until - WG.dayAbs)} days left${c.t === 'count' ? ` &middot; ${c.prog} of ${c.n}` : ''}</small>
    <p>${esc(wNoticeHow(c))}</p><p class="hint">Reward: ${esc(wNoticePayText(c.pay))}</p></div>`);
  if (!rows.length) return [n, h];
  return [n + rows.length, `<h4>Contracts</h4>${rows.join('')}${n ? h : ''}`];
};

/* ---------- a tip and a medal ---------- */
Object.assign(TIPS, { w_notice: ['The notice board', 'The inn here has a notice board. Ask the innkeeper about the NOTICES: contracts for the region that pay gold and fans the moment you win a match that meets them.'] });
setInterval(() => {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world') return;
  const m = wCurMap(); if (m && m.kind === 'town' && W_NOTICE_CITY[m.id] && WG.dayAbs >= 2) tip('w_notice');
}, 900);
ACH.push({ id: 'w_notices', n: 'Odd Jobs', d: 'Finish contracts from the notice boards', stat: 'realmNotices', at: [1, 10, 25] });

/* ---------- How to play ---------- */
const wW27RenderHelp = renderHelp;
renderHelp = function () {
  wW27RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpNotices')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpNotices"><b>Notice boards.</b> Every city's inn has one: ask the innkeeper about the NOTICES. Each week it posts ${W_NOTICE.posted} contracts for its region, such as "win a hockey game in the Frostspire at night" or "beat the rival club". Take up to ${W_NOTICE.max} at a time; each runs ${W_NOTICE.days} days. A contract is done the moment you win a match that meets it, wherever you are, and pays gold and fans at once; the harder ones add a pick of cards for the region's sports.</p>`);
};
