/* w123: curling ratings, the four and their positions (issue #102, phase 3), as w114 is bowling's. Every Realm player
   has Curling Shed ratings, p.cr: draw, line, hit, sweep, nerve and read, 1 to 12. They are seeded from the kind's
   (wCR.rate), each moved by up to 1, and every level above 1 adds a point to one of them, weighted by what the kind is
   good at; an older save's players get theirs when it loads.
   The four: a rink is four (W_GRD_SQUAD.curling): the lead, the second, the third and the skip, each throwing two
   stones an end in that order. The Shed tab on the Team screen sets your four and their positions; the rest of your
   roster are reserves. Called-up players at your level fill the four when your roster is short. Left alone, the
   captain sets them from the ratings (the skip first: nerve, draw and read; then the lead: draw and line; the second:
   hit and sweep; the third). Practice game plays your four against Saltmere's at the Shed; nothing is won or lost. The
   Stats tab's Curling view shows the ratings and the positions.

   p.cr       { drw, lin, hit, swp, nrv, red, lv, got: { stat: points from levels } }
   WG.shed    { four: [4 keys, lead to skip], cu: [call-ups], seq, mine?: true once you've changed something }
              a key is a roster id, or a call-up's cid ('r1', 'r2', ...: not 'c', which the nine's call-ups use)
   wCrOf(p)           p's ratings, made or caught up first
   wFourSyncCr()      makes the four, or brings it up to date with the roster; returns WG.shed
   wFourMineCr()      your four as the Curling Shed takes a rink (roster in order, and the order)
   wFourSetPos(key, pos), wFourAutoCr()    changes; each returns a message, or '' when it worked (pos 0 to 3, or
                      'reserve': the best reserve for that position takes it)
   Wrapped: wMakePlayer (wW123MakePlayer), wGiveXp (wW123GiveXp), wStart (wW123Start), wStatsCard (wW123StatsCard: a
   Curling block), wCampStats (wW123CampStats: the Curling view), wOpenCamp (wW123OpenCamp: the Shed tab), wRenderCamp
   (wW123RenderCamp), wShedRows (wW123ShedRows: the curler up, their sweepers' legs, the moment), renderHelp
   (wW123RenderHelp: #wHelpShedTab), wShedHowHTML (wW123ShedHow: ratings, positions, legs and nerve). */

const W_CRR = {
  cuKinds: ['wraith', 'spider', 'troll', 'gorgon', 'zombie', 'dwarf'],
  stat: { drw: ['Drw', 'Draw: the touch on the weight of a draw, a guard and a freeze'], lin: ['Lin', 'Line: holding the broom\'s line'],
    hit: ['Hit', 'Hit: a takeout\'s weight and line'], swp: ['Swp', 'Sweep: how much a sweeper does, and how long their legs last'],
    nrv: ['Nrv', 'Nerve: steady with the last stones, when the end hangs on them'], red: ['Red', 'Read: how soon they see the ice change'] },
  pos: ['the lead', 'the second', 'the third', 'the skip'],
  short: ['Lead', '2nd', '3rd', 'Skip'],
};
const wCrCap = () => wCR.cap;

/* ---------- ratings ---------- */
function wCrOf(p) {
  if (!p || !p.kind) return null;
  if (!p.cr) { const r = wCR.rate(p.kind); p.cr = { lv: 1, got: {} }; for (const s of wCR.stats) p.cr[s] = Math.max(1, Math.min(wCrCap(), Math.round(r[s]) + Math.floor(Math.random() * 3) - 1)); }
  const b = p.cr, lvl = p.lvl || 1;
  while (b.lv < lvl) { b.lv++; const s = wCrGrowStat(p); if (s) { b[s]++; b.got[s] = (b.got[s] || 0) + 1; } }
  return b;
}
function wCrGrowStat(p) {
  const K = wCR.rate(p.kind), open = wCR.stats.filter(s => p.cr[s] < wCrCap());
  if (!open.length) return null;
  let r = Math.random() * open.reduce((a, s) => a + K[s], 0);
  for (const s of open) { r -= K[s]; if (r < 0) return s; }
  return open[open.length - 1];
}
function wCrAll() { if (!WG) return; for (const p of WG.roster || []) wCrOf(p); for (const p of WG.wwait || []) wCrOf(p); for (const c of (WG.shed && WG.shed.cu) || []) wCrOf(c); }
// how well a player suits a position, 0 to 1
const wCrFit = (p, pos) => wCR.fit(Object.fromEntries(wCR.stats.map(s => [s, (wCrOf(p)[s] - 1) / (wCrCap() - 1)])), pos);

const wW123MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW123MakePlayer.apply(this, arguments); wCrOf(p); return p; };
const wW123GiveXp = wGiveXp;
wGiveXp = function (p, n) { const r = wW123GiveXp(p, n); wCrOf(p); return r; };
const wW123Start = wStart;
wStart = function (save, opts) { const r = wW123Start(save, opts); wCrAll(); if (WG) wFourSyncCr(); if (save) wSave(); return r; };

/* ---------- the four ---------- */
const wFourCrCu = k => typeof k === 'string';
function wFourCrWho(k) { if (wFourCrCu(k)) return ((WG.shed && WG.shed.cu) || []).find(c => c.cid === k) || null; return wPlayer(k); }
function wFourCrCallUp(C) {
  const used = new Set(C.four.filter(k => k != null).map(k => (wFourCrWho(k) || {}).kind));
  const kind = W_CRR.cuKinds.find(k => !used.has(k)) || pick(W_CRR.cuKinds);
  const c = Object.assign(wMakeCallUp(kind, new Set(wRoster().map(p => p.n).concat(C.cu.map(c => c.n)))), { cid: 'r' + (C.seq++) });
  wCrOf(c); C.cu.push(c);
  return c;
}
// the captain's pick: the skip first, then the lead, the second and the third, each the best of those left
function wFourCrAutoPick(C) {
  const left = new Set(wRoster().map(p => p.id)), four = [null, null, null, null];
  for (const pos of [3, 0, 1, 2]) {
    const best = [...left].sort((a, b) => wCrFit(wFourCrWho(b), pos) - wCrFit(wFourCrWho(a), pos))[0];
    if (best == null) break;
    four[pos] = best; left.delete(best);
  }
  C.four = four;
  C.cu = C.cu.filter(c => four.includes(c.cid));
}
function wFourSyncCr() {
  if (!WG) return null;
  let fresh = false;
  if (!WG.shed || !Array.isArray(WG.shed.four)) { WG.shed = { four: [null, null, null, null], cu: [], seq: 1 }; fresh = true; }
  const C = WG.shed, before = JSON.stringify(C.four);
  C.four = C.four.map(k => k != null && wFourCrWho(k) ? k : null);
  C.cu = C.cu.filter(c => C.four.includes(c.cid));
  const tier = wNineTier();
  for (const c of C.cu) if (c.lvl < tier) { c.lvl = tier; wCrOf(c); }
  // a roster player not in the four takes a call-up's place
  for (const p of wRoster()) {
    if (C.four.includes(p.id)) continue;
    const at = C.four.findIndex(k => wFourCrCu(k)); if (at < 0) break;
    const old = C.four[at]; C.four[at] = p.id; C.cu = C.cu.filter(c => c.cid !== old);
  }
  // a gap: the best reserve for the position, or a call-up
  for (let i = 0; i < 4; i++) if (C.four[i] == null) {
    const res = wRoster().map(p => p.id).filter(id => !C.four.includes(id)).sort((a, b) => wCrFit(wPlayer(b), i) - wCrFit(wPlayer(a), i))[0];
    C.four[i] = res != null ? res : wFourCrCallUp(C).cid;
  }
  if (fresh || (!C.mine && JSON.stringify(C.four) !== before)) wFourCrAutoPick(C);
  for (let i = 0; i < 4; i++) if (C.four[i] == null) C.four[i] = wFourCrCallUp(C).cid;
  return C;
}
// a player as the Curling Shed takes one (ratings 1 to 12)
function wShedPlayer(p) { const b = wCrOf(p); return { n: p.n, kind: p.kind, r: Object.fromEntries(wCR.stats.map(s => [s, b[s]])) }; }
function wFourMineCr() {
  const C = wFourSyncCr(), t = wPartyTeam();
  return { name: t.name, short: t.short, color: t.color, roster: C.four.map(k => wShedPlayer(wFourCrWho(k))), order: [0, 1, 2, 3] };
}
const wFourCrPosOf = (k, C) => { const i = (C || wFourSyncCr()).four.indexOf(k); return i < 0 ? null : i; };
const wFourCrReserves = C => wRoster().map(p => p.id).filter(id => !C.four.includes(id));

/* ---------- changes ---------- */
function wFourCrDone() { WG.shed.mine = true; wSave(); return ''; }
function wFourSetPos(k, pos) {
  const C = wFourSyncCr(), at = wFourCrPosOf(k, C);
  if (pos === 'reserve') {
    if (at == null) return '';
    const res = wFourCrReserves(C).sort((a, b) => wCrFit(wPlayer(b), at) - wCrFit(wPlayer(a), at))[0];
    if (res == null) return 'No reserve to take their place.';
    C.four[at] = res; if (wFourCrCu(k)) C.cu = C.cu.filter(c => c.cid !== k);
    return wFourCrDone();
  }
  pos = +pos; if (!(pos >= 0 && pos < 4) || at === pos) return '';
  const other = C.four[pos];
  C.four[pos] = k;
  if (at != null) C.four[at] = other; else if (wFourCrCu(other)) C.cu = C.cu.filter(c => c.cid !== other);
  return wFourCrDone();
}
function wFourAutoCr() { WG.shed = null; wFourSyncCr(); wSave(); return ''; }
function wFourCrPractice() {
  if (WCAMP.close) WCAMP.close();
  const mine = wFourMineCr(), home = wShedTeams(mine.roster.map(m => m.n))[0];
  wShedGame({ teams: [mine, home], title: 'A practice game at the Curling Shed' });
}

/* ---------- the Curling block on a player's stats ---------- */
function wCrCard(p) {
  const b = wCrOf(p); if (!b) return '';
  // (the four is made when a save loads; here it is only brought up to date, and saved if that changed it)
  if (WG && WG.shed) { const before = JSON.stringify(WG.shed); wFourSyncCr(); if (JSON.stringify(WG.shed) !== before) wSave(); }
  const bars = wCR.stats.map(s => { const [ab, what] = W_CRR.stat[s], got = b.got[s] || 0;
    return `<div class="wbdr" title="${esc(what)}"><span>${ab}</span><i><em style="width:${Math.round(100 * b[s] / wCrCap())}%"></em></i><b>${b[s]}</b><small>${got ? `+${got}` : ''}</small></div>`; }).join('');
  const pos = WG && WG.shed ? wFourCrPosOf(p.cid || p.id, WG.shed) : null, other = p.cid && !(WG && WG.shed && WG.shed.cu.some(c => c.cid === p.cid));
  return `<div class="wbd wbkc wcrc"><h5>Curling</h5><p class="wbdpos">${pos != null ? `In your four, ${esc(W_CRR.pos[pos])}.` : WG && WG.shed && !other ? 'A reserve for your four.' : 'Not in your squad.'}</p>
    <div class="wbdbars">${bars}</div><p class="hint">Each level adds a point to one rating (shown as +), mostly to what their kind is good at. Ratings run from 1 to ${wCrCap()}.</p></div>`;
}
const wW123StatsCard = wStatsCard;
wStatsCard = function (p) { return wW123StatsCard(p).replace(/<\/section>\s*$/, wCrCard(p) + '</section>'); };

/* ---------- the Shed tab ---------- */
function wFourCrRow(k, C) {
  const p = wFourCrWho(k), b = wCrOf(p), cu = wFourCrCu(k), at = wFourCrPosOf(k, C), key = esc(String(k));
  const opts = W_CRR.pos.map((n, i) => `<option value="${i}"${at === i ? ' selected' : ''}>${esc(n[4].toUpperCase() + n.slice(5))}</option>`).join('') + `<option value="reserve"${at == null ? ' selected' : ''}>Reserve</option>`;
  const fits = [0, 1, 2, 3].map(i => `${W_CRR.pos[i].replace('the ', '')} ${Math.round(wCrFit(p, i) * 100)}`).join(', ');
  return `<li class="wpr wnr wcrt${cu ? ' wcu' : ''}" data-cid="${key}">
    <span class="wno">${at != null ? esc(W_CRR.short[at]) : '&ndash;'}</span><img src="${wPlayerPort(p, 64)}" alt="">
    <div class="wpi"><div class="wpn"><b>${esc(p.n)}</b><span class="k">${esc(wKindName(p.kind))}, level ${p.lvl}</span>${cu ? '<span class="wtag wb">Call-up</span>' : ''}</div>
      <small class="wnst" title="How well they suit each position: ${esc(fits)}">${wCR.stats.map(s => `<span title="${esc(W_CRR.stat[s][1])}">${W_CRR.stat[s][0]} <b>${b[s]}</b></span>`).join(' ')}</small></div>
    <div class="wpa"><label class="wsvl">Position <select data-cpos aria-label="${esc(p.n)}'s position">${opts}</select></label></div>
  </li>`;
}
function wCampShed(C) {
  const res = wFourCrReserves(C);
  return `<p class="hint">Your rink of four, in the order they throw: the lead throws the end's first two stones (the guards and the draws: draw and line), the second the next two (the takeouts: hit and sweep), the third the next two (hit, draw and read), and the skip the last two, where ends are won (nerve, draw and read). The two not throwing and not holding the broom sweep: good sweepers carry a stone further, and their legs tire over an end.</p>
    <h4>The four</h4><ol class="wroster wnine wcourt wshedfour">${C.four.map(k => wFourCrRow(k, C)).join('')}</ol>
    <h4>Reserves</h4>${res.length ? `<ol class="wroster wnine wcourtb wshedres">${res.map(k => wFourCrRow(k, C)).join('')}</ol>` : '<p class="hint">Nobody: every player you have is in the four.</p>'}
    <div class="row wnbtn"><button class="ghost" data-cauto>The captain's pick</button><button class="btn" data-cpractice>Practice game</button></div>`;
}
const wW123OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  wW123OpenCamp(want === 'shed' ? 'team' : tab);
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="shed"]')) return;
  tabs.lastElementChild.insertAdjacentHTML('afterend', '<button role="tab" data-ctab="shed">Shed</button>');
  tabs.querySelector('[data-ctab="shed"]').onclick = () => { WCAMP.tab = 'shed'; WCAMP.swap = null; WCAMP.msg = ''; wRenderCamp(); };
  if (want === 'shed') { WCAMP.tab = 'shed'; wRenderCamp(); }
};
const wW123RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'shed') return wW123RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="shed"]')) { WCAMP.tab = 'team'; return wRenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'shed'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  const before = JSON.stringify(WG.shed), C = wFourSyncCr(); if (JSON.stringify(C) !== before) wSave();
  body.innerHTML = `<div class="wcsum"><span>Players <b>${wRoster().length}/${W_PARTY.max}</b></span><span>Call-ups <b>${C.cu.length}</b> at level ${wNineTier()}</span></div>
    ${WCAMP.msg ? `<p class="wbad wcmsg" role="alert">${esc(WCAMP.msg)}</p>` : ''}` + wCampShed(C);
  const keyOf = el => { const k = el.closest('[data-cid]').dataset.cid; return /^\d+$/.test(k) ? +k : k; };
  body.querySelectorAll('[data-cpos]').forEach(s => s.onchange = () => wCampSay(wFourSetPos(keyOf(s), s.value)));
  const auto = body.querySelector('[data-cauto]'); if (auto) auto.onclick = () => wCampSay(wFourAutoCr());
  const pr = body.querySelector('[data-cpractice]'); if (pr) pr.onclick = () => wFourCrPractice();
};

/* ---------- the Curling view on the Stats tab ---------- */
const W_CR_COLS = () => wCR.stats.map(s => [s, W_CRR.stat[s][0], W_CRR.stat[s][1]]);
const wW123CampStats = wCampStats;
wCampStats = function () {
  const html = wW123CampStats().replace(/(<button data-wsview="career"[^>]*>Career<\/button>)/, `$1<button data-wsview="curling" aria-pressed="${WSTAT.view === 'curling'}">Curling</button>`);
  if (WSTAT.view !== 'curling') return html;
  const cols = W_CR_COLS(), k = WSTAT.sort && cols.some(c => c[0] === WSTAT.sort) ? WSTAT.sort : null;
  const C = wFourSyncCr(), rows = wRoster().map((p, i) => ({ p, i, b: wCrOf(p), pos: wFourCrPosOf(p.id, C) }));
  if (k) rows.sort((a, b) => (b.b[k] - a.b[k]) || a.i - b.i);
  const head = `<th scope="col"><button class="wsth" data-wsort="" aria-pressed="${!k}">Player</button></th><th scope="col">Position</th>` + cols.map(([c, s, l]) => `<th scope="col"><button class="wsth" data-wsort="${c}" title="${esc(l)}" aria-pressed="${k === c}">${s}</button></th>`).join('');
  const body = rows.map(({ p, b, pos }) => `<tr data-wsp="${p.id}"${WSTAT.pid === p.id ? ' class="wsel"' : ''}><th scope="row"><button class="wsname" data-wsp-open aria-expanded="${WSTAT.pid === p.id}"><img src="${wPlayerPort(p, 40)}" alt=""><span><b>${esc(p.n)}</b><small>${esc(wKindName(p.kind))}</small></span></button></th>
    <td>${pos != null ? esc(W_CRR.pos[pos].replace(/^the /, '')) : 'Reserve'}</td>${cols.map(([c]) => `<td>${b[c]}</td>`).join('')}</tr>`).join('');
  const sel = WSTAT.pid != null && wPlayer(WSTAT.pid);
  return html.replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Every player\'s curling ratings and their position in your four (set on the Shed tab). Pick a heading to sort, a player to see more.</small>')
    .replace(/<div class="tablewrap">[\s\S]*$/, `<div class="tablewrap"><table class="wstats"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${sel ? wStatsCard(sel) : ''}`);
};

// your stone's rows gain a line for the curler up: their position, the sweepers' legs, and the moment
$('wShedRows').insertAdjacentHTML('afterbegin', '<div class="wccrow" id="wShedRowUp"><span class="wccl">Curler</span><span id="wShedUp"></span></div>');
const wW123ShedRows = wShedRows;
wShedRows = function () {
  wW123ShedRows();
  const V = WCR && !WCR.over && wCR.G && wCR.G.teams ? wCR.view : null; if (!V || V.up !== V.you || !V.sel) return;
  const m = wCR.G.teams[V.you].roster[V.thrower], legs = Math.round(((wCR.G.legs || [1, 1])[V.you]) * 100), pr = wCR.pressure(V.you), sw = wCR.sweepers(V.you).map(ri => wCR.G.teams[V.you].roster[ri].n);
  $('wShedUp').innerHTML = `<b>${esc(m.n)}</b> <small>${esc(wKindName(m.kind) || '')}, ${esc(W_CRR.pos[V.pos] || '')}</small> · <span title="Sweeping spends their legs over an end; they are fresh again at the next. Tired legs do less.">Sweepers ${esc(sw.join(' and '))}, legs <b>${legs}%</b></span>${pr ? ` · <b class="wbad" title="The skip's stones in the last end: the release shakes, less for a steady nerve.">The last end${pr > 1 ? ', the hammer, and close' : ''}</b>` : ''}`;
};
// Curling: how it works gains the ratings, the positions, the legs and nerve
const wW123ShedHow = wShedHowHTML;
wShedHowHTML = function () {
  return wW123ShedHow() + `<p class="hint"><b>Ratings.</b> Each curler has six: <b>draw</b> (the touch on a draw's weight), <b>line</b> (holding the broom), <b>hit</b> (a takeout's weight and line), <b>sweep</b>, <b>nerve</b> and <b>read</b> (how soon they see the ice change). Each level adds a point, mostly to what their kind is good at.</p>
  <p class="hint"><b>The positions.</b> Your four are set on the Shed tab: the lead throws first (draws and guards), then the second (takeouts), the third and the skip, who throws the end's last stones.</p>
  <p class="hint"><b>The sweepers</b> are the two not throwing and not holding the broom. Good sweepers carry a stone further; sweeping spends their legs over an end, and tired legs do less. They are fresh again at the next end.</p>
  <p class="hint"><b>Nerve.</b> The skip's stones in the last end weigh on them, the hammer's stone most in a close game: the release shakes, less for a steady nerve. The CPU's curlers feel it too.</p>`;
};
const wW123RenderHelp = renderHelp;
renderHelp = function () {
  wW123RenderHelp();
  const after = $('wHelpShed'); if (!after || $('wHelpShedTab')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpShedTab"><b>Curling ratings, the four and their positions.</b> Every player also has curling ratings: draw, line, hit, sweep, nerve and read (1 to ${wCrCap()}). Each level adds a point, mostly to what their kind is good at; pick a player on the Stats tab to see them, or use its Curling view. The Shed tab on the Team screen sets your four and their positions (the lead, the second, the third and the skip). The two not throwing and not holding the broom sweep, and their legs tire over an end. The skip's last stones weigh on their nerve. Called-up players at your level fill the four when your roster is short. Practice game there plays your four against Saltmere's; nothing is won or lost.</p>`);
};
