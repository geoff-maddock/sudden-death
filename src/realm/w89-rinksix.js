/* w89: hockey ratings, the six and the lines (issue #83, phase 4). Every Realm player has Black Ice ratings, p.hk, as
   they have basketball's p.bk (w78), football's p.gf (w43) and boxing's p.bx (w53): speed, size, hands, shot, defense
   and reflexes, 1 to 12. They are seeded from the kind's hockey ratings (wHK.rate), each moved by up to 1, and every
   level above 1 adds a point to one of them, weighted by what the kind is good at; an older save's players get theirs
   when it loads.
   The six: hockey is five skaters and a goalie, and a Realm squad for it is six (W_GRD_SQUAD.hockey). The Rink tab on
   the Team screen sets who plays which spot (C, LW, RW, LD, RD, G) and the order of the bench: the rest of your roster,
   who come over the boards as your skaters tire, first in line first. The goalie plays the whole game. Called-up
   players at your level fill the six when your roster is short. Left alone, the coach picks the six and the spots from
   the ratings (the best reflexes in goal, the best defenders at the back, the best hands at centre, the best shots on
   the wings) and puts the bench in order of who's best. Practice game plays your six against the Cinderhold Hockey
   Club at the Pond Rink; nothing is won or lost. The Stats tab's Hockey view shows the ratings and where each plays.

   p.hk       { spd, siz, hnd, sht, def, ref, lv, got: { stat: points from levels } }
   WG.rink    { six: { C: key, LW, RW, LD, RD, G }, bench: [keys, in order], cu: [call-ups], seq, mine?: true once
                you've changed something (until then the coach picks again whenever the squad changes) }; a player who
                joins takes a call-up's spot, or the end of the bench, the next time it syncs
              a key is a roster id, or a call-up's cid ('h1', 'h2', ...)
   wHkOf(p)          p's ratings, made or caught up first
   wSixSync()        makes the six, or brings it up to date with the roster; returns WG.rink
   wSixMine()        your six and bench as Black Ice takes a team (through wRinkPlayer)
   wSixSetSpot(key, spot), wSixMove(key, dir), wSixAuto()   changes; each returns a message, or '' when it worked
   Wrapped: wMakePlayer (wW89MakePlayer), wGiveXp (wW89GiveXp), wStart (wW89Start), wStatsCard (wW89StatsCard: a Hockey
   block), wCampStats (wW89CampStats: the Hockey view), wOpenCamp (wW89OpenCamp: the Rink tab), wRenderCamp
   (wW89RenderCamp), renderHelp (wW89RenderHelp: #wHelpRinkTab). */

const W_HKR = {
  cap: 12, cuKinds: ['skeleton', 'witch', 'vampire', 'harpy', 'troll', 'lich'],
  stat: { spd: ['Spd', 'Speed: top speed on the ice, and getting to it'], siz: ['Siz', 'Size: checks given and taken, screens, battles on the boards'],
    hnd: ['Hnd', 'Hands: keeping the puck, passing, and face-offs'], sht: ['Sht', 'Shot: how hard and how true'],
    def: ['Def', 'Defense: pokes, picking off passes, blocking shots'], ref: ['Ref', 'Reflexes: stopping the puck in goal'] },
  pos: { C: 'centre', LW: 'left wing', RW: 'right wing', LD: 'left defender', RD: 'right defender', G: 'goalie' },
};

/* ---------- ratings ---------- */
function wHkOf(p) {
  if (!p || !p.kind) return null;
  if (!p.hk) { const r = wHK.rate(p.kind); p.hk = { lv: 1, got: {} }; for (const s of wHK.stats) p.hk[s] = Math.max(1, Math.min(W_HKR.cap, r[s] + Math.floor(Math.random() * 3) - 1)); }
  const b = p.hk, lvl = p.lvl || 1;
  while (b.lv < lvl) { b.lv++; const s = wHkGrowStat(p); if (s) { b[s]++; b.got[s] = (b.got[s] || 0) + 1; } }
  return b;
}
// a level's point: any rating below the cap, weighted by the kind's own
function wHkGrowStat(p) {
  const K = wHK.rate(p.kind), open = wHK.stats.filter(s => p.hk[s] < W_HKR.cap);
  if (!open.length) return null;
  let r = Math.random() * open.reduce((a, s) => a + K[s], 0);
  for (const s of open) { r -= K[s]; if (r < 0) return s; }
  return open[open.length - 1];
}
function wHkAll() { if (!WG) return; for (const p of WG.roster || []) wHkOf(p); for (const p of WG.wwait || []) wHkOf(p); for (const c of (WG.rink && WG.rink.cu) || []) wHkOf(c); }
const wHkSum = p => { const b = wHkOf(p); return wHK.stats.reduce((a, s) => a + b[s], 0); };

const wW89MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW89MakePlayer(spec, from); wHkOf(p); return p; };
const wW89GiveXp = wGiveXp;
wGiveXp = function (p, n) { const r = wW89GiveXp(p, n); wHkOf(p); return r; };
const wW89Start = wStart;
wStart = function (save, opts) { const r = wW89Start(save, opts); wHkAll(); if (save) wSave(); return r; };

/* ---------- the six ---------- */
const wSixCu = k => typeof k === 'string';
function wSixWho(k) {
  if (wSixCu(k)) return ((WG.rink && WG.rink.cu) || []).find(c => c.cid === k) || null;
  return wPlayer(k);
}
const wSixKeys = C => wHK.pos.map(pos => C.six[pos]).filter(k => k != null).concat(C.bench);
function wSixCallUp(C) {
  const used = new Set(wSixKeys(C).map(k => (wSixWho(k) || {}).kind));
  const kind = W_HKR.cuKinds.find(k => !used.has(k)) || pick(W_HKR.cuKinds);
  const c = Object.assign(wMakeCallUp(kind, new Set(wRoster().map(p => p.n).concat(C.cu.map(c => c.n)))), { cid: 'h' + (C.seq++) });
  C.cu.push(c);
  return c;
}
// the coach's pick: the six who suit the spots best (the goalie and the defenders first), then the bench by who's best
function wSixAutoPick(C) {
  const all = wRoster().map(p => p.id).concat(C.cu.map(c => c.cid)), left = new Set(all), six = {};
  for (const pos of ['G', 'LD', 'RD', 'C', 'LW', 'RW']) {
    const best = [...left].sort((a, b) => wHK.fit(wHkOf(wSixWho(b)), pos) - wHK.fit(wHkOf(wSixWho(a)), pos))[0];
    if (best == null) break;
    six[pos] = best; left.delete(best);
  }
  C.six = six;
  C.bench = [...left].filter(k => !wSixCu(k)).sort((a, b) => wHkSum(wSixWho(b)) - wHkSum(wSixWho(a)));
  C.cu = C.cu.filter(c => Object.values(six).includes(c.cid));
}
function wSixSync() {
  if (!WG) return null;
  let fresh = false;
  if (!WG.rink || !WG.rink.six) { WG.rink = { six: {}, bench: [], cu: [], seq: 1 }; fresh = true; }
  const C = WG.rink, before = JSON.stringify([C.six, C.bench]);
  for (const pos of wHK.pos) if (C.six[pos] != null && !wSixWho(C.six[pos])) delete C.six[pos];
  const inSix = new Set(Object.values(C.six));
  C.bench = C.bench.filter((k, i) => !wSixCu(k) && wSixWho(k) && !inSix.has(k) && C.bench.indexOf(k) === i);
  C.cu = C.cu.filter(c => inSix.has(c.cid));
  const tier = wNineTier();
  for (const c of C.cu) if (c.lvl < tier) { c.lvl = tier; wHkOf(c); }
  // anyone missing: a call-up's spot if there is one, else the end of the bench
  for (const p of wRoster()) {
    if (wSixKeys(C).includes(p.id)) continue;
    const cuPos = wHK.pos.find(pos => wSixCu(C.six[pos]));
    if (cuPos) { const old = C.six[cuPos]; C.six[cuPos] = p.id; C.cu = C.cu.filter(c => c.cid !== old); }
    else C.bench.push(p.id);
  }
  // a gap in the six: the first on the bench, or a call-up
  for (const pos of wHK.pos) if (C.six[pos] == null) C.six[pos] = C.bench.length ? C.bench.shift() : wSixCallUp(C).cid;
  if (fresh || (!C.mine && JSON.stringify([C.six, C.bench]) !== before)) wSixAutoPick(C);
  for (const pos of wHK.pos) if (C.six[pos] == null) C.six[pos] = wSixCallUp(C).cid;
  return C;
}
// a player as Black Ice takes one
function wRinkPlayer(p) { return { n: p.n, kind: p.kind, num: p.num, r: Object.fromEntries(wHK.stats.map(s => [s, wHkOf(p)[s]])) }; }
function wSixMine() {
  const C = wSixSync(), t = wPartyTeam(), keys = wSixKeys(C);
  return { name: t.name, short: t.short, color: t.color, light: t.light, roster: keys.map(k => wRinkPlayer(wSixWho(k))),
    spot: Object.fromEntries(wHK.pos.map((pos, i) => [pos, i])) };
}
// where a player plays: a spot, 'bench' (with their place in line), or null (C: the rink, synced once by the caller)
function wSixSpotOf(k, C) {
  C = C || wSixSync(); const pos = wHK.pos.find(x => C.six[x] === k);
  if (pos) return { spot: pos };
  const i = C.bench.indexOf(k); return i >= 0 ? { spot: 'bench', n: i + 1 } : null;
}

/* ---------- changes ---------- */
function wSixDone() { WG.rink.mine = true; wSave(); return ''; }
// k to a spot (whoever was there takes k's old place) or to the bench (the first on the bench takes their spot)
function wSixSetSpot(k, spot) {
  const C = wSixSync(), at = wSixSpotOf(k, C); if (!at || at.spot === spot) return '';
  if (spot === 'bench') {
    if (!C.bench.length) return 'Nobody on the bench to take their spot.';
    if (wSixCu(k)) return 'A call-up only plays in the six.';
    C.six[at.spot] = C.bench.shift(); C.bench.unshift(k);
    return wSixDone();
  }
  if (!wHK.pos.includes(spot)) return '';
  const other = C.six[spot];
  if (at.spot === 'bench') {
    const i = C.bench.indexOf(k); C.six[spot] = k;
    if (wSixCu(other)) { C.bench.splice(i, 1); C.cu = C.cu.filter(c => c.cid !== other); } else C.bench[i] = other;
  } else { C.six[spot] = k; C.six[at.spot] = other; }
  return wSixDone();
}
// a bench player up (-1) or down (+1) the order
function wSixMove(k, dir) {
  const C = wSixSync(), i = C.bench.indexOf(k), j = i + dir;
  if (i < 0 || j < 0 || j >= C.bench.length) return '';
  [C.bench[i], C.bench[j]] = [C.bench[j], C.bench[i]];
  return wSixDone();
}
function wSixAuto() { WG.rink = null; wSixSync(); wSave(); return ''; }
// a practice game: your six against the Cinderhold Hockey Club, nothing riding on it
function wSixPractice() {
  if (WCAMP.close) WCAMP.close();
  wRinkGame({ teams: [wSixMine(), wRinkTeams()[1]], title: 'A practice game at the Pond Rink', how: 'practice', ordered: [true, false] });
}

/* ---------- the Hockey block on a player's stats ---------- */
function wHkCard(p) {
  const b = wHkOf(p); if (!b) return '';
  const bars = wHK.stats.map(s => { const [ab, what] = W_HKR.stat[s], got = b.got[s] || 0;
    return `<div class="wbdr" title="${esc(what)}"><span>${ab}</span><i><em style="width:${Math.round(100 * b[s] / W_HKR.cap)}%"></em></i><b>${b[s]}</b><small>${got ? `+${got}` : ''}</small></div>`; }).join('');
  const at = WG && WG.rink ? wSixSpotOf(p.cid || p.id, WG.rink) : null;
  return `<div class="wbd wbkc whkc"><h5>Hockey</h5><p class="wbdpos">${!at ? 'Not in your squad.' : at.spot === 'bench' ? `On your bench, ${wOrd(at.n)} in line.` : at.spot === 'G' ? 'Your goalie.' : `In your six at ${esc(W_HKR.pos[at.spot])}.`}</p>
    <div class="wbdbars">${bars}</div><p class="hint">Each level adds a point to one rating (shown as +), mostly to what their kind is good at. Ratings run from 1 to ${W_HKR.cap}.</p></div>`;
}
const wW89StatsCard = wStatsCard;
wStatsCard = function (p) { return wW89StatsCard(p).replace(/<\/section>\s*$/, wHkCard(p) + '</section>'); };

/* ---------- the Rink tab ---------- */
function wSixRow(k, C) {
  const p = wSixWho(k), b = wHkOf(p), cu = wSixCu(k), at = wSixSpotOf(k, C), key = esc(String(k));
  const opts = wHK.pos.map(pos => `<option value="${pos}"${at.spot === pos ? ' selected' : ''}>${pos}: ${esc(W_HKR.pos[pos])}</option>`).join('') + (cu ? '' : `<option value="bench"${at.spot === 'bench' ? ' selected' : ''}>Bench</option>`);
  const i = at.spot === 'bench' ? at.n - 1 : -1;
  return `<li class="wpr wnr wcrt${cu ? ' wcu' : ''}" data-hid="${key}">
    <span class="wno">${at.spot === 'bench' ? at.n : esc(at.spot)}</span><img src="${wPlayerPort(p, 64)}" alt="">
    <div class="wpi"><div class="wpn"><b>${esc(p.n)}</b><span class="k">${esc(wKindName(p.kind))}, level ${p.lvl}</span>${cu ? '<span class="wtag wb">Call-up</span>' : ''}</div>
      <small class="wnst">${wHK.stats.map(s => `<span title="${esc(W_HKR.stat[s][1])}">${W_HKR.stat[s][0]} <b>${b[s]}</b></span>`).join(' ')}</small></div>
    <div class="wpa"><label class="wsvl">Spot <select data-hspot aria-label="${esc(p.n)}'s spot">${opts}</select></label>
      ${i >= 0 ? `<button class="ghost" data-hmove="-1" ${i === 0 ? 'disabled' : ''} aria-label="Up the bench">&uarr;</button><button class="ghost" data-hmove="1" ${i === C.bench.length - 1 ? 'disabled' : ''} aria-label="Down the bench">&darr;</button>` : ''}</div>
  </li>`;
}
function wCampRink(C) {
  return `<p class="hint">Your hockey six, and the bench. Five skaters and a goalie. Skating is hard work, so a skater is good for a short shift: when one tires, the first fresh player on your bench comes over the boards in their spot, and they rest. The goalie plays the whole game, so reflexes matter there and little else. Change a spot and whoever had it swaps with them; send a player to the bench and the first on the bench takes their spot. Called-up players at your level fill the six when your roster is short. Until you change something, the coach picks the six again whenever your squad changes: the best reflexes in goal, the best defenders at the back, the best hands at centre, the best shots on the wings.</p>
    <h4>The six</h4><ol class="wroster wnine wcourt wrinksix">${wHK.pos.map(pos => wSixRow(C.six[pos], C)).join('')}</ol>
    <h4>The bench</h4>${C.bench.length ? `<ol class="wroster wnine wcourtb wrinkbench">${C.bench.map(k => wSixRow(k, C)).join('')}</ol>` : '<p class="hint">Nobody: every player you have is in the six. With nobody to change with, your skaters play on tired, with a breather at each whistle.</p>'}
    <div class="row wnbtn"><button class="ghost" data-hauto>The coach's pick</button><button class="btn" data-hpractice>Practice game</button></div>`;
}
const wW89OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  wW89OpenCamp(want === 'rink' ? 'team' : tab);
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="rink"]')) return;
  tabs.lastElementChild.insertAdjacentHTML('afterend', '<button role="tab" data-ctab="rink">Rink</button>');
  tabs.querySelector('[data-ctab="rink"]').onclick = () => { WCAMP.tab = 'rink'; WCAMP.swap = null; WCAMP.msg = ''; wRenderCamp(); };
  if (want === 'rink') { WCAMP.tab = 'rink'; wRenderCamp(); }
};
const wW89RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'rink') return wW89RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="rink"]')) { WCAMP.tab = 'team'; return wRenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'rink'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  // (synced once for the whole tab, and saved if that changed anything: a call-up, a new player placed)
  const before = JSON.stringify(WG.rink), C = wSixSync(); if (JSON.stringify(C) !== before) wSave();
  body.innerHTML = `<div class="wcsum"><span>Players <b>${wRoster().length}/${W_PARTY.max}</b></span><span>Call-ups <b>${C.cu.length}</b> at level ${wNineTier()}</span></div>
    ${WCAMP.msg ? `<p class="wbad wcmsg" role="alert">${esc(WCAMP.msg)}</p>` : ''}` + wCampRink(C);
  const keyOf = el => { const k = el.closest('[data-hid]').dataset.hid; return /^h\d+$/.test(k) ? k : +k; };
  body.querySelectorAll('[data-hspot]').forEach(s => s.onchange = () => wCampSay(wSixSetSpot(keyOf(s), s.value)));
  body.querySelectorAll('[data-hmove]').forEach(b => b.onclick = () => wCampSay(wSixMove(keyOf(b), +b.dataset.hmove)));
  const auto = body.querySelector('[data-hauto]'); if (auto) auto.onclick = () => wCampSay(wSixAuto());
  const pr = body.querySelector('[data-hpractice]'); if (pr) pr.onclick = () => wSixPractice();
};

/* ---------- the Hockey view on the Stats tab: ratings now; games from the world add their lines (phase 6) ---------- */
const W_HK_COLS = () => wHK.stats.map(s => [s, W_HKR.stat[s][0], W_HKR.stat[s][1]]);
const wW89CampStats = wCampStats;
wCampStats = function () {
  const html = wW89CampStats().replace(/(<button data-wsview="career"[^>]*>Career<\/button>)/, `$1<button data-wsview="hockey" aria-pressed="${WSTAT.view === 'hockey'}">Hockey</button>`);
  if (WSTAT.view !== 'hockey') return html;
  const cols = W_HK_COLS(), k = WSTAT.sort && cols.some(c => c[0] === WSTAT.sort) ? WSTAT.sort : null;
  const C = wSixSync(), rows = wRoster().map((p, i) => ({ p, i, b: wHkOf(p), at: wSixSpotOf(p.id, C) }));
  if (k) rows.sort((a, b) => (b.b[k] - a.b[k]) || a.i - b.i);
  const head = `<th scope="col"><button class="wsth" data-wsort="" aria-pressed="${!k}">Player</button></th><th scope="col">Spot</th>` + cols.map(([c, s, l]) => `<th scope="col"><button class="wsth" data-wsort="${c}" title="${esc(l)}" aria-pressed="${k === c}">${s}</button></th>`).join('');
  const body = rows.map(({ p, b, at }) => `<tr data-wsp="${p.id}"${WSTAT.pid === p.id ? ' class="wsel"' : ''}><th scope="row"><button class="wsname" data-wsp-open aria-expanded="${WSTAT.pid === p.id}"><img src="${wPlayerPort(p, 40)}" alt=""><span><b>${esc(p.n)}</b><small>${esc(wKindName(p.kind))}</small></span></button></th>
    <td>${!at ? '&ndash;' : at.spot === 'bench' ? `Bench ${at.n}` : at.spot}</td>${cols.map(([c]) => `<td>${b[c]}</td>`).join('')}</tr>`).join('');
  const sel = WSTAT.pid != null && wPlayer(WSTAT.pid);
  return html.replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Every player\'s hockey ratings and where they play (set on the Rink tab). Pick a heading to sort, a player to see more.</small>')
    .replace(/<div class="tablewrap">[\s\S]*$/, `<div class="tablewrap"><table class="wstats"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${sel ? wStatsCard(sel) : ''}`);
};

const wW89RenderHelp = renderHelp;
renderHelp = function () {
  wW89RenderHelp();
  const after = $('wHelpRink'); if (!after || $('wHelpRinkTab')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpRinkTab"><b>Hockey ratings, the six and the lines.</b> Every player also has hockey ratings: speed, size, hands, shot, defense and reflexes (1 to ${W_HKR.cap}). Each level adds a point, mostly to what their kind is good at; pick a player on the Stats tab to see them, or use its Hockey view. The Rink tab on the Team screen sets your six (centre, left and right wing, left and right defender, and the goalie) and the order of your bench. In a game stamina runs down fast: a tired skater is slower and shoots worse, so skaters play short shifts, and the first fresh player on your bench comes over the boards for a tired one. The goalie plays the whole game. Called-up players at your level fill the six when your roster is short. Practice game there plays your six against the Cinderhold Hockey Club; nothing is won or lost.</p>`);
};
