/* w78: basketball ratings and the five (issue #77, phase 3). Every Realm player has Charter Court ratings, p.bk, as
   they have football's p.gf (w43) and boxing's p.bx (w53): speed, size, hops, touch, handle and defense, 1 to 12. They
   are seeded from the kind's basketball ratings (wBK.rate), each moved by up to 1, and every level above 1 adds a point
   to one of them, weighted by what the kind is good at; an older save's players get theirs when it loads.
   The five: basketball is five a side, and a Realm squad for it is five (W_GRD_SQUAD.basketball), the whole squad on the
   floor at once. The Court tab on the Team screen sets who plays which spot (PG, SG, SF, PF, C) and the order of the
   bench: the rest of your roster, who come on as the coach subs tired players and when a player fouls out, first in
   line first. Called-up players at your level fill the five when your roster is short. Left alone, the coach picks the
   five and the spots from the ratings (the best handler at the point, the biggest inside, the best shooter on the wing)
   and puts the bench in order of who's best. Practice game plays your five against the Saltmere Basketball Club at the
   Charter Court; nothing is won or lost. The Stats tab's Basketball view shows the ratings and where each plays; games
   from the world (w80) turn it into their box lines.

   p.bk       { spd, siz, hop, tch, hnd, def, lv, got: { stat: points from levels } }
   WG.court   { five: { PG: key, SG, SF, PF, C }, bench: [keys, in order], cu: [call-ups], seq, mine?: true once you've
                changed something (until then the coach picks again whenever the squad changes) }; a player who joins takes a
                call-up's spot, or the end of the bench, the next time it syncs
              a key is a roster id, or a call-up's cid ('k1', 'k2', ...)
   wBkOf(p)          p's ratings, made or caught up first
   wCourtSync()      makes the five, or brings it up to date with the roster; returns WG.court
   wCourtMine()      your five and bench as the Charter Court takes a team
   wCourtSetSpot(key, spot), wCourtMove(key, dir), wCourtAuto()   changes; each returns a message, or '' when it worked
   Wrapped: wMakePlayer (wW78MakePlayer), wGiveXp (wW78GiveXp), wStart (wW78Start),
   wStatsCard (wW78StatsCard: a Basketball block), wCampStats (wW78CampStats: the Basketball view), wOpenCamp
   (wW78OpenCamp: the Court tab), wRenderCamp (wW78RenderCamp), renderHelp (wW78RenderHelp: #wHelpCourtTab). */

const W_BKR = {
  cap: 12, cuKinds: ['goblin', 'troll', 'elf', 'werewolf', 'minotaur'],
  stat: { spd: ['Spd', 'Speed: getting up the floor, cutting, chasing'], siz: ['Siz', 'Size: height and reach, for blocks, rebounds and shots at the rim'],
    hop: ['Hop', 'Hops: jumping, for rebounds, blocks, dunks and lobs'], tch: ['Tch', 'Touch: shooting, and free throws'],
    hnd: ['Hnd', 'Handle: dribbling, passing and moves'], def: ['Def', 'Defense: staying in front, contesting, steals'] },
  pos: { PG: 'point guard', SG: 'shooting guard', SF: 'small forward', PF: 'power forward', C: 'center' },
};

/* ---------- ratings ---------- */
function wBkOf(p) {
  if (!p || !p.kind) return null;
  if (!p.bk) { const r = wBK.rate(p.kind); p.bk = { lv: 1, got: {} }; for (const s of wBK.stats) p.bk[s] = Math.max(1, Math.min(W_BKR.cap, r[s] + Math.floor(Math.random() * 3) - 1)); }
  const b = p.bk, lvl = p.lvl || 1;
  while (b.lv < lvl) { b.lv++; const s = wBkGrowStat(p); if (s) { b[s]++; b.got[s] = (b.got[s] || 0) + 1; } }
  return b;
}
// a level's point: any rating below the cap, weighted by the kind's own
function wBkGrowStat(p) {
  const K = wBK.rate(p.kind), open = wBK.stats.filter(s => p.bk[s] < W_BKR.cap);
  if (!open.length) return null;
  let r = Math.random() * open.reduce((a, s) => a + K[s], 0);
  for (const s of open) { r -= K[s]; if (r < 0) return s; }
  return open[open.length - 1];
}
function wBkAll() { if (!WG) return; for (const p of WG.roster || []) wBkOf(p); for (const p of WG.wwait || []) wBkOf(p); for (const c of (WG.court && WG.court.cu) || []) wBkOf(c); }
const wBkSum = p => { const b = wBkOf(p); return wBK.stats.reduce((a, s) => a + b[s], 0); };

const wW78MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW78MakePlayer(spec, from); wBkOf(p); return p; };
const wW78GiveXp = wGiveXp;
wGiveXp = function (p, n) { const r = wW78GiveXp(p, n); wBkOf(p); return r; };
const wW78Start = wStart;
wStart = function (save, opts) { const r = wW78Start(save, opts); wBkAll(); if (save) wSave(); return r; };

/* ---------- the five ---------- */
function wCourtWho(k) {
  if (typeof k === 'string') return ((WG.court && WG.court.cu) || []).find(c => c.cid === k) || null;
  return wPlayer(k);
}
const wCourtKeys = C => wBK.pos.map(pos => C.five[pos]).filter(k => k != null).concat(C.bench);
function wCourtCallUp(C) {
  const used = new Set(wCourtKeys(C).map(k => (wCourtWho(k) || {}).kind));
  const kind = W_BKR.cuKinds.find(k => !used.has(k)) || pick(W_BKR.cuKinds);
  const c = Object.assign(wMakeCallUp(kind, new Set(wRoster().map(p => p.n).concat(C.cu.map(c => c.n)))), { cid: 'k' + (C.seq++) });
  C.cu.push(c);
  return c;
}
// the coach's pick: the five who suit the spots best (the scarcest spots first), then the bench by who's best
function wCourtAutoPick(C) {
  const all = wRoster().map(p => p.id).concat(C.cu.map(c => c.cid)), left = new Set(all), five = {};
  for (const pos of ['C', 'PG', 'PF', 'SF', 'SG']) {
    const best = [...left].sort((a, b) => wBK.fit(wBkOf(wCourtWho(b)), pos) - wBK.fit(wBkOf(wCourtWho(a)), pos))[0];
    if (best == null) break;
    five[pos] = best; left.delete(best);
  }
  C.five = five;
  C.bench = [...left].filter(k => typeof k !== 'string').sort((a, b) => wBkSum(wCourtWho(b)) - wBkSum(wCourtWho(a)));
  C.cu = C.cu.filter(c => Object.values(five).includes(c.cid));
}
function wCourtSync() {
  if (!WG) return null;
  let fresh = false;
  if (!WG.court || !WG.court.five) { WG.court = { five: {}, bench: [], cu: [], seq: 1 }; fresh = true; }
  const C = WG.court, before = JSON.stringify([C.five, C.bench]);
  for (const pos of wBK.pos) if (C.five[pos] != null && !wCourtWho(C.five[pos])) delete C.five[pos];
  const inFive = new Set(Object.values(C.five));
  C.bench = C.bench.filter((k, i) => typeof k !== 'string' && wCourtWho(k) && !inFive.has(k) && C.bench.indexOf(k) === i);
  C.cu = C.cu.filter(c => inFive.has(c.cid));
  const tier = wNineTier();
  for (const c of C.cu) if (c.lvl < tier) { c.lvl = tier; wBkOf(c); }
  // anyone missing: a call-up's spot if there is one, else the end of the bench
  for (const p of wRoster()) {
    if (wCourtKeys(C).includes(p.id)) continue;
    const cuPos = wBK.pos.find(pos => typeof C.five[pos] === 'string');
    if (cuPos) { const old = C.five[cuPos]; C.five[cuPos] = p.id; C.cu = C.cu.filter(c => c.cid !== old); }
    else C.bench.push(p.id);
  }
  // a gap in the five: the first on the bench, or a call-up
  for (const pos of wBK.pos) if (C.five[pos] == null) C.five[pos] = C.bench.length ? C.bench.shift() : wCourtCallUp(C).cid;
  if (fresh || (!C.mine && JSON.stringify([C.five, C.bench]) !== before)) wCourtAutoPick(C);
  for (const pos of wBK.pos) if (C.five[pos] == null) C.five[pos] = wCourtCallUp(C).cid;
  return C;
}
// a player as the Charter Court takes one
function wCourtPlayer(p) { return { n: p.n, kind: p.kind, num: p.num, r: Object.fromEntries(wBK.stats.map(s => [s, wBkOf(p)[s]])) }; }
function wCourtMine() {
  const C = wCourtSync(), t = wPartyTeam(), keys = wCourtKeys(C);
  return { name: t.name, short: t.short, color: t.color, light: t.light, roster: keys.map(k => wCourtPlayer(wCourtWho(k))),
    spot: Object.fromEntries(wBK.pos.map((pos, i) => [pos, i])) };
}
// where a player plays: a spot, 'bench' (with their place in line), or null (C: the court, synced once by the caller)
function wCourtSpotOf(k, C) {
  C = C || wCourtSync(); const pos = wBK.pos.find(x => C.five[x] === k);
  if (pos) return { spot: pos };
  const i = C.bench.indexOf(k); return i >= 0 ? { spot: 'bench', n: i + 1 } : null;
}

/* ---------- changes ---------- */
function wCourtDone() { WG.court.mine = true; wSave(); return ''; }
// k to a spot (whoever was there takes k's old place) or to the bench (the first on the bench takes their spot)
function wCourtSetSpot(k, spot) {
  const C = wCourtSync(), at = wCourtSpotOf(k, C); if (!at || at.spot === spot) return '';
  if (spot === 'bench') {
    if (!C.bench.length) return 'Nobody on the bench to take their spot.';
    if (typeof k === 'string') return 'A call-up only plays in the five.';
    C.five[at.spot] = C.bench.shift(); C.bench.unshift(k);
    return wCourtDone();
  }
  if (!wBK.pos.includes(spot)) return '';
  const other = C.five[spot];
  if (at.spot === 'bench') {
    const i = C.bench.indexOf(k); C.five[spot] = k;
    if (typeof other === 'string') { C.bench.splice(i, 1); C.cu = C.cu.filter(c => c.cid !== other); } else C.bench[i] = other;
  } else { C.five[spot] = k; C.five[at.spot] = other; }
  return wCourtDone();
}
// a bench player up (-1) or down (+1) the order
function wCourtMove(k, dir) {
  const C = wCourtSync(), i = C.bench.indexOf(k), j = i + dir;
  if (i < 0 || j < 0 || j >= C.bench.length) return '';
  [C.bench[i], C.bench[j]] = [C.bench[j], C.bench[i]];
  return wCourtDone();
}
function wCourtAuto() { WG.court = null; wCourtSync(); wSave(); return ''; }
// a practice game: your five against the Saltmere Basketball Club, nothing riding on it
function wCourtPractice() {
  if (WCAMP.close) WCAMP.close();
  wCourtGame({ teams: [wCourtMine(), wCourtTeams()[1]], title: 'A practice game at the Charter Court', how: 'practice', ordered: [true, false] });
}

/* ---------- the Basketball block on a player's stats ---------- */
function wBkCard(p) {
  const b = wBkOf(p); if (!b) return '';
  const bars = wBK.stats.map(s => { const [ab, what] = W_BKR.stat[s], got = b.got[s] || 0;
    return `<div class="wbdr" title="${esc(what)}"><span>${ab}</span><i><em style="width:${Math.round(100 * b[s] / W_BKR.cap)}%"></em></i><b>${b[s]}</b><small>${got ? `+${got}` : ''}</small></div>`; }).join('');
  const at = WG && WG.court ? wCourtSpotOf(p.cid || p.id, WG.court) : null;
  return `<div class="wbd wbkc"><h5>Basketball</h5><p class="wbdpos">${!at ? 'Not in your squad.' : at.spot === 'bench' ? `On your bench, ${wOrd(at.n)} in line.` : `In your five at ${esc(W_BKR.pos[at.spot])}.`}</p>
    <div class="wbdbars">${bars}</div><p class="hint">Each level adds a point to one rating (shown as +), mostly to what their kind is good at. Ratings run from 1 to ${W_BKR.cap}.</p></div>`;
}
const wW78StatsCard = wStatsCard;
wStatsCard = function (p) { return wW78StatsCard(p).replace(/<\/section>\s*$/, wBkCard(p) + '</section>'); };

/* ---------- the Court tab ---------- */
function wCourtRow(k, C) {
  const p = wCourtWho(k), b = wBkOf(p), cu = typeof k === 'string', at = wCourtSpotOf(k, C), key = esc(String(k));
  const opts = wBK.pos.map(pos => `<option value="${pos}"${at.spot === pos ? ' selected' : ''}>${pos}: ${esc(W_BKR.pos[pos])}</option>`).join('') + (cu ? '' : `<option value="bench"${at.spot === 'bench' ? ' selected' : ''}>Bench</option>`);
  const i = at.spot === 'bench' ? at.n - 1 : -1;
  return `<li class="wpr wnr wcrt${cu ? ' wcu' : ''}" data-kid="${key}">
    <span class="wno">${at.spot === 'bench' ? at.n : esc(at.spot)}</span><img src="${wPlayerPort(p, 64)}" alt="">
    <div class="wpi"><div class="wpn"><b>${esc(p.n)}</b><span class="k">${esc(wKindName(p.kind))}, level ${p.lvl}</span>${cu ? '<span class="wtag wb">Call-up</span>' : ''}</div>
      <small class="wnst">${wBK.stats.map(s => `<span title="${esc(W_BKR.stat[s][1])}">${W_BKR.stat[s][0]} <b>${b[s]}</b></span>`).join(' ')}</small></div>
    <div class="wpa"><label class="wsvl">Spot <select data-kspot aria-label="${esc(p.n)}'s spot">${opts}</select></label>
      ${i >= 0 ? `<button class="ghost" data-kmove="-1" ${i === 0 ? 'disabled' : ''} aria-label="Up the bench">&uarr;</button><button class="ghost" data-kmove="1" ${i === C.bench.length - 1 ? 'disabled' : ''} aria-label="Down the bench">&darr;</button>` : ''}</div>
  </li>`;
}
function wCampCourt(C) {
  return `<p class="hint">Your basketball five, and the bench. Five a side, the whole five on the floor at both ends, so stamina runs down: when a player tires the coach brings on the first fresh player on your bench, and the next in line comes on if someone fouls out. Change a spot and whoever had it swaps with them; send a player to the bench and the first on the bench takes their spot. Called-up players at your level fill the five when your roster is short. Until you change something, the coach picks the five again whenever your squad changes: the best handler at the point, the biggest inside, the best shooter on the wing.</p>
    <h4>The five</h4><ol class="wroster wnine wcourt">${wBK.pos.map(pos => wCourtRow(C.five[pos], C)).join('')}</ol>
    <h4>The bench</h4>${C.bench.length ? `<ol class="wroster wnine wcourtb">${C.bench.map(k => wCourtRow(k, C)).join('')}</ol>` : '<p class="hint">Nobody: every player you have is in the five. A tired five plays on tired.</p>'}
    <div class="row wnbtn"><button class="ghost" data-kauto>The coach's pick</button><button class="btn" data-kpractice>Practice game</button></div>`;
}
const wW78OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  wW78OpenCamp(want === 'court' ? 'team' : tab);
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="court"]')) return;
  tabs.lastElementChild.insertAdjacentHTML('afterend', '<button role="tab" data-ctab="court">Court</button>');
  tabs.querySelector('[data-ctab="court"]').onclick = () => { WCAMP.tab = 'court'; WCAMP.swap = null; WCAMP.msg = ''; wRenderCamp(); };
  if (want === 'court') { WCAMP.tab = 'court'; wRenderCamp(); }
};
const wW78RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'court') return wW78RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="court"]')) { WCAMP.tab = 'team'; return wRenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'court'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  // (synced once for the whole tab, and saved if that changed anything: a call-up, a new player placed)
  const before = JSON.stringify(WG.court), C = wCourtSync(); if (JSON.stringify(C) !== before) wSave();
  body.innerHTML = `<div class="wcsum"><span>Players <b>${wRoster().length}/${W_PARTY.max}</b></span><span>Call-ups <b>${C.cu.length}</b> at level ${wNineTier()}</span></div>
    ${WCAMP.msg ? `<p class="wbad wcmsg" role="alert">${esc(WCAMP.msg)}</p>` : ''}` + wCampCourt(C);
  const keyOf = el => { const k = el.closest('[data-kid]').dataset.kid; return /^k\d+$/.test(k) ? k : +k; };
  body.querySelectorAll('[data-kspot]').forEach(s => s.onchange = () => wCampSay(wCourtSetSpot(keyOf(s), s.value)));
  body.querySelectorAll('[data-kmove]').forEach(b => b.onclick = () => wCampSay(wCourtMove(keyOf(b), +b.dataset.kmove)));
  const auto = body.querySelector('[data-kauto]'); if (auto) auto.onclick = () => wCampSay(wCourtAuto());
  const pr = body.querySelector('[data-kpractice]'); if (pr) pr.onclick = () => wCourtPractice();
};

/* ---------- the Basketball view on the Stats tab: ratings now; games from the world add their lines (phase 5) ---------- */
const W_BK_COLS = () => wBK.stats.map(s => [s, W_BKR.stat[s][0], W_BKR.stat[s][1]]);
const wW78CampStats = wCampStats;
wCampStats = function () {
  const html = wW78CampStats().replace(/(<button data-wsview="career"[^>]*>Career<\/button>)/, `$1<button data-wsview="basketball" aria-pressed="${WSTAT.view === 'basketball'}">Basketball</button>`);
  if (WSTAT.view !== 'basketball') return html;
  const cols = W_BK_COLS(), k = WSTAT.sort && cols.some(c => c[0] === WSTAT.sort) ? WSTAT.sort : null;
  const C = wCourtSync(), rows = wRoster().map((p, i) => ({ p, i, b: wBkOf(p), at: wCourtSpotOf(p.id, C) }));
  if (k) rows.sort((a, b) => (b.b[k] - a.b[k]) || a.i - b.i);
  const head = `<th scope="col"><button class="wsth" data-wsort="" aria-pressed="${!k}">Player</button></th><th scope="col">Spot</th>` + cols.map(([c, s, l]) => `<th scope="col"><button class="wsth" data-wsort="${c}" title="${esc(l)}" aria-pressed="${k === c}">${s}</button></th>`).join('');
  const body = rows.map(({ p, b, at }) => `<tr data-wsp="${p.id}"${WSTAT.pid === p.id ? ' class="wsel"' : ''}><th scope="row"><button class="wsname" data-wsp-open aria-expanded="${WSTAT.pid === p.id}"><img src="${wPlayerPort(p, 40)}" alt=""><span><b>${esc(p.n)}</b><small>${esc(wKindName(p.kind))}</small></span></button></th>
    <td>${!at ? '&ndash;' : at.spot === 'bench' ? `Bench ${at.n}` : at.spot}</td>${cols.map(([c]) => `<td>${b[c]}</td>`).join('')}</tr>`).join('');
  const sel = WSTAT.pid != null && wPlayer(WSTAT.pid);
  return html.replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Every player\'s basketball ratings and where they play (set on the Court tab). Pick a heading to sort, a player to see more.</small>')
    .replace(/<div class="tablewrap">[\s\S]*$/, `<div class="tablewrap"><table class="wstats"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${sel ? wStatsCard(sel) : ''}`);
};

const wW78RenderHelp = renderHelp;
renderHelp = function () {
  wW78RenderHelp();
  const after = $('wHelpCourt'); if (!after || $('wHelpCourtTab')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpCourtTab"><b>Basketball ratings and the five.</b> Every player also has basketball ratings: speed, size, hops, touch, handle and defense (1 to ${W_BKR.cap}). Each level adds a point, mostly to what their kind is good at; pick a player on the Stats tab to see them, or use its Basketball view. The Court tab on the Team screen sets your five (who plays point guard, shooting guard, small forward, power forward and center) and the order of your bench. In a game stamina runs down; tired players are slower and shoot worse, and the coach brings on the first fresh player on your bench, and the next in line if someone fouls out. Called-up players at your level fill the five when your roster is short. Practice game there plays your five against the Saltmere Basketball Club; nothing is won or lost.</p>`);
};
