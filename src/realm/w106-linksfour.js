/* w106: golf ratings, the four and their roles (issue #92, phase 3). Every Realm player has Mossgate Links ratings,
   p.gl, as they have hockey's p.hk (w89): power, accuracy, touch, putting, nerve and scrambling, 1 to 12. They are
   seeded from the kind's (wGL.rate), each moved by up to 1, and every level above 1 adds a point to one of them,
   weighted by what the kind is good at; an older save's players get theirs when it loads.
   The four: a golf side is four (W_GRD_SQUAD.golf), one ball, and you pick who hits each shot. The Links tab on the Team
   screen sets your four and a role for each: the tee, the approach, the short game and the green. The caddie gives each
   shot to its role's player when the hitter rule allows (nobody twice running; the first four shots of a hole four
   different players), and the hitter row starts on them in You play. The rest of your roster are reserves. Called-up
   players at your level fill the four when your roster is short. Left alone, the caddie picks the four and the roles
   from the ratings (the best putter on the green, then the tee, the short game, the approach). Practice round plays
   your four against the Saltmere Golf Club at Mossgate Links; nothing is won or lost. The Stats tab's Golf view shows
   the ratings and each role.

   p.gl       { pow, acc, tch, put, nrv, scr, lv, got: { stat: points from levels } }
   WG.links   { four: { tee: key, approach, short, putt }, cu: [call-ups], seq, mine?: true once you've changed something }
              a key is a roster id, or a call-up's cid ('g1', 'g2', ...)
   wGlOf(p)           p's ratings, made or caught up first
   wFourSync()        makes the four, or brings it up to date with the roster; returns WG.links
   wFourMine()        your four as Mossgate Links takes a team (roster in role order, and the roles)
   wFourSetRole(key, role), wFourAuto()    changes; each returns a message, or '' when it worked ('reserve' sends a
                      player out of the four, and the best reserve for that role takes it)
   Wrapped: wMakePlayer (wW106MakePlayer), wGiveXp (wW106GiveXp), wStart (wW106Start), wStatsCard (wW106StatsCard: a
   Golf block), wCampStats (wW106CampStats: the Golf view), wOpenCamp (wW106OpenCamp: the Links tab), wRenderCamp
   (wW106RenderCamp), renderHelp (wW106RenderHelp: #wHelpLinksTab). */

const W_GLR = {
  cuKinds: ['elf', 'spider', 'witch', 'gorgon', 'wraith', 'dwarf'],
  stat: { pow: ['Pow', 'Power: how far the ball goes, and the power shot'], acc: ['Acc', 'Accuracy: the size of the mark on the meter, and how far a miss strays'],
    tch: ['Tch', 'Touch: chips, pitches and spin'], put: ['Put', 'Putting: the read line\'s length, and the putts that drop'],
    nrv: ['Nrv', 'Nerve: steady under pressure, when a stroke wins or halves the hole'], scr: ['Scr', 'Scrambling: out of the rough, sand, bog and trees'] },
  role: { tee: 'the tee', approach: 'the approach', short: 'the short game', putt: 'the green' },
};
const wGlCap = () => wGL.cap;

/* ---------- ratings ---------- */
function wGlOf(p) {
  if (!p || !p.kind) return null;
  if (!p.gl) { const r = wGL.rate(p.kind); p.gl = { lv: 1, got: {} }; for (const s of wGL.stats) p.gl[s] = Math.max(1, Math.min(wGlCap(), Math.round(r[s]) + Math.floor(Math.random() * 3) - 1)); }
  const b = p.gl, lvl = p.lvl || 1;
  while (b.lv < lvl) { b.lv++; const s = wGlGrowStat(p); if (s) { b[s]++; b.got[s] = (b.got[s] || 0) + 1; } }
  return b;
}
// a level's point: any rating below the cap, weighted by the kind's own
function wGlGrowStat(p) {
  const K = wGL.rate(p.kind), open = wGL.stats.filter(s => p.gl[s] < wGlCap());
  if (!open.length) return null;
  let r = Math.random() * open.reduce((a, s) => a + K[s], 0);
  for (const s of open) { r -= K[s]; if (r < 0) return s; }
  return open[open.length - 1];
}
function wGlAll() { if (!WG) return; for (const p of WG.roster || []) wGlOf(p); for (const p of WG.wwait || []) wGlOf(p); for (const c of (WG.links && WG.links.cu) || []) wGlOf(c); }
const wGlFit = (p, role) => wGL.fit(wGlOf(p), role);

const wW106MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW106MakePlayer(spec, from); wGlOf(p); return p; };
const wW106GiveXp = wGiveXp;
wGiveXp = function (p, n) { const r = wW106GiveXp(p, n); wGlOf(p); return r; };
const wW106Start = wStart;
wStart = function (save, opts) { const r = wW106Start(save, opts); wGlAll(); if (save) wSave(); return r; };

/* ---------- the four ---------- */
const W_GL_ROLES = ['tee', 'approach', 'short', 'putt'];
const wFourCu = k => typeof k === 'string';
function wFourWho(k) {
  if (wFourCu(k)) return ((WG.links && WG.links.cu) || []).find(c => c.cid === k) || null;
  return wPlayer(k);
}
function wFourCallUp(C) {
  const used = new Set(Object.values(C.four).map(k => (wFourWho(k) || {}).kind));
  const kind = W_GLR.cuKinds.find(k => !used.has(k)) || pick(W_GLR.cuKinds);
  const c = Object.assign(wMakeCallUp(kind, new Set(wRoster().map(p => p.n).concat(C.cu.map(c => c.n)))), { cid: 'g' + (C.seq++) });
  wGlOf(c); C.cu.push(c);
  return c;
}
// the caddie's pick: a role at a time, the best for it of those left (the green first, then the tee, the short game,
// the approach); a call-up only for a role nobody on the roster is left for
function wFourAutoPick(C) {
  const left = new Set(wRoster().map(p => p.id)), four = {};
  for (const role of ['putt', 'tee', 'short', 'approach']) {
    const best = [...left].sort((a, b) => wGlFit(wFourWho(b), role) - wGlFit(wFourWho(a), role))[0];
    if (best == null) break;
    four[role] = best; left.delete(best);
  }
  C.four = four;
  C.cu = C.cu.filter(c => Object.values(four).includes(c.cid));
}
function wFourSync() {
  if (!WG) return null;
  let fresh = false;
  if (!WG.links || !WG.links.four) { WG.links = { four: {}, cu: [], seq: 1 }; fresh = true; }
  const C = WG.links, before = JSON.stringify(C.four);
  for (const role of W_GL_ROLES) if (C.four[role] != null && !wFourWho(C.four[role])) delete C.four[role];
  const inFour = new Set(Object.values(C.four));
  C.cu = C.cu.filter(c => inFour.has(c.cid));
  const tier = wNineTier();
  for (const c of C.cu) if (c.lvl < tier) { c.lvl = tier; wGlOf(c); }
  // a roster player not in the four takes a call-up's role
  for (const p of wRoster()) {
    if (inFour.has(p.id)) continue;
    const cuRole = W_GL_ROLES.find(r => wFourCu(C.four[r]));
    if (cuRole) { const old = C.four[cuRole]; C.four[cuRole] = p.id; C.cu = C.cu.filter(c => c.cid !== old); inFour.add(p.id); }
  }
  // a gap: the best reserve for the role, or a call-up
  for (const role of W_GL_ROLES) if (C.four[role] == null) {
    const res = wRoster().map(p => p.id).filter(id => !Object.values(C.four).includes(id)).sort((a, b) => wGlFit(wPlayer(b), role) - wGlFit(wPlayer(a), role))[0];
    C.four[role] = res != null ? res : wFourCallUp(C).cid;
  }
  if (fresh || (!C.mine && JSON.stringify(C.four) !== before)) wFourAutoPick(C);
  for (const role of W_GL_ROLES) if (C.four[role] == null) C.four[role] = wFourCallUp(C).cid;
  return C;
}
// a player as Mossgate Links takes one (ratings 1 to 12)
function wLinksPlayer(p) { return { n: p.n, kind: p.kind, r: Object.fromEntries(wGL.stats.map(s => [s, wGlOf(p)[s]])) }; }
function wFourMine() {
  const C = wFourSync(), t = wPartyTeam();
  return { name: t.name, short: t.short, color: t.color, roster: W_GL_ROLES.map(role => wLinksPlayer(wFourWho(C.four[role]))), roles: { tee: 0, approach: 1, short: 2, putt: 3 } };
}
const wFourRoleOf = (k, C) => W_GL_ROLES.find(r => (C || wFourSync()).four[r] === k) || null;
const wFourReserves = C => wRoster().map(p => p.id).filter(id => !Object.values(C.four).includes(id));

/* ---------- changes ---------- */
function wFourDone() { WG.links.mine = true; wSave(); return ''; }
// k to a role (whoever had it takes k's old role, or goes to the reserves), or to the reserves (the best reserve for
// k's role takes it)
function wFourSetRole(k, role) {
  const C = wFourSync(), at = wFourRoleOf(k, C);
  if (role === 'reserve') {
    if (!at) return '';
    const res = wFourReserves(C).sort((a, b) => wGlFit(wPlayer(b), at) - wGlFit(wPlayer(a), at))[0];
    if (res == null) return 'No reserve to take their place.';
    C.four[at] = res; if (wFourCu(k)) C.cu = C.cu.filter(c => c.cid !== k);
    return wFourDone();
  }
  if (!W_GL_ROLES.includes(role) || at === role) return '';
  const other = C.four[role];
  C.four[role] = k;
  if (at) C.four[at] = other; else if (wFourCu(other)) C.cu = C.cu.filter(c => c.cid !== other);
  return wFourDone();
}
function wFourAuto() { WG.links = null; wFourSync(); wSave(); return ''; }
function wFourPractice() {
  if (WCAMP.close) WCAMP.close();
  const mine = wFourMine();
  wLinksGame({ teams: [mine, wLinksTeams(mine.roster.map(m => m.n))[1]], title: 'A practice round at Mossgate Links' });
}

/* ---------- the Golf block on a player's stats ---------- */
function wGlCard(p) {
  const b = wGlOf(p); if (!b) return '';
  const bars = wGL.stats.map(s => { const [ab, what] = W_GLR.stat[s], got = b.got[s] || 0;
    return `<div class="wbdr" title="${esc(what)}"><span>${ab}</span><i><em style="width:${Math.round(100 * b[s] / wGlCap())}%"></em></i><b>${b[s]}</b><small>${got ? `+${got}` : ''}</small></div>`; }).join('');
  const role = WG && WG.links ? wFourRoleOf(p.cid || p.id, WG.links) : null;
  return `<div class="wbd wbkc wglc"><h5>Golf</h5><p class="wbdpos">${role ? `In your four, for ${esc(W_GLR.role[role])}.` : WG && WG.links ? 'A reserve for your four.' : 'Not in your squad.'}</p>
    <div class="wbdbars">${bars}</div><p class="hint">Each level adds a point to one rating (shown as +), mostly to what their kind is good at. Ratings run from 1 to ${wGlCap()}.</p></div>`;
}
const wW106StatsCard = wStatsCard;
wStatsCard = function (p) { return wW106StatsCard(p).replace(/<\/section>\s*$/, wGlCard(p) + '</section>'); };

/* ---------- the Links tab ---------- */
function wFourRow(k, C) {
  const p = wFourWho(k), b = wGlOf(p), cu = wFourCu(k), at = wFourRoleOf(k, C), key = esc(String(k));
  const opts = W_GL_ROLES.map(r => `<option value="${r}"${at === r ? ' selected' : ''}>${esc(W_GLR.role[r][0].toUpperCase() + W_GLR.role[r].slice(1))}</option>`).join('') + `<option value="reserve"${!at ? ' selected' : ''}>Reserve</option>`;
  const fits = W_GL_ROLES.map(r => `${W_GLR.role[r]} ${Math.round(wGlFit(p, r) * 100)}`).join(', ');
  return `<li class="wpr wnr wcrt${cu ? ' wcu' : ''}" data-gid="${key}">
    <span class="wno">${at ? esc({ tee: 'Tee', approach: 'App', short: 'Shrt', putt: 'Grn' }[at]) : '&ndash;'}</span><img src="${wPlayerPort(p, 64)}" alt="">
    <div class="wpi"><div class="wpn"><b>${esc(p.n)}</b><span class="k">${esc(wKindName(p.kind))}, level ${p.lvl}</span>${cu ? '<span class="wtag wb">Call-up</span>' : ''}</div>
      <small class="wnst" title="How well they suit each role: ${esc(fits)}">${wGL.stats.map(s => `<span title="${esc(W_GLR.stat[s][1])}">${W_GLR.stat[s][0]} <b>${b[s]}</b></span>`).join(' ')}</small></div>
    <div class="wpa"><label class="wsvl">Role <select data-grole aria-label="${esc(p.n)}'s role">${opts}</select></label></div>
  </li>`;
}
function wCampLinks(C) {
  const res = wFourReserves(C);
  return `<p class="hint">Your golf four, and a role for each: the tee (power), the approach (accuracy), the short game (touch) and the green (putting). One ball a side, and the caddie gives each shot to its role's player when the rule allows: nobody hits twice running, and the first four shots of a hole are four different players. In You play you pick the hitter, and the row starts on the role's player. Every shot costs the hitter some focus (a hard one more) and they get it back while the others hit, so sharing the shots keeps them sharp. Nerve steadies a stroke that wins or halves a hole. Until you change something, the caddie picks the four and the roles again whenever your squad changes.</p>
    <h4>The four</h4><ol class="wroster wnine wcourt wlinksfour">${W_GL_ROLES.map(r => wFourRow(C.four[r], C)).join('')}</ol>
    <h4>Reserves</h4>${res.length ? `<ol class="wroster wnine wcourtb wlinksres">${res.map(k => wFourRow(k, C)).join('')}</ol>` : '<p class="hint">Nobody: every player you have is in the four.</p>'}
    <div class="row wnbtn"><button class="ghost" data-gauto>The caddie's pick</button><button class="btn" data-gpractice>Practice round</button></div>`;
}
const wW106OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  wW106OpenCamp(want === 'links' ? 'team' : tab);
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="links"]')) return;
  tabs.lastElementChild.insertAdjacentHTML('afterend', '<button role="tab" data-ctab="links">Links</button>');
  tabs.querySelector('[data-ctab="links"]').onclick = () => { WCAMP.tab = 'links'; WCAMP.swap = null; WCAMP.msg = ''; wRenderCamp(); };
  if (want === 'links') { WCAMP.tab = 'links'; wRenderCamp(); }
};
const wW106RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'links') return wW106RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="links"]')) { WCAMP.tab = 'team'; return wRenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'links'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  const before = JSON.stringify(WG.links), C = wFourSync(); if (JSON.stringify(C) !== before) wSave();
  body.innerHTML = `<div class="wcsum"><span>Players <b>${wRoster().length}/${W_PARTY.max}</b></span><span>Call-ups <b>${C.cu.length}</b> at level ${wNineTier()}</span></div>
    ${WCAMP.msg ? `<p class="wbad wcmsg" role="alert">${esc(WCAMP.msg)}</p>` : ''}` + wCampLinks(C);
  const keyOf = el => { const k = el.closest('[data-gid]').dataset.gid; return /^g\d+$/.test(k) ? k : +k; };
  body.querySelectorAll('[data-grole]').forEach(s => s.onchange = () => wCampSay(wFourSetRole(keyOf(s), s.value)));
  const auto = body.querySelector('[data-gauto]'); if (auto) auto.onclick = () => wCampSay(wFourAuto());
  const pr = body.querySelector('[data-gpractice]'); if (pr) pr.onclick = () => wFourPractice();
};

/* ---------- the Golf view on the Stats tab ---------- */
const W_GL_COLS = () => wGL.stats.map(s => [s, W_GLR.stat[s][0], W_GLR.stat[s][1]]);
const wW106CampStats = wCampStats;
wCampStats = function () {
  const html = wW106CampStats().replace(/(<button data-wsview="career"[^>]*>Career<\/button>)/, `$1<button data-wsview="golf" aria-pressed="${WSTAT.view === 'golf'}">Golf</button>`);
  if (WSTAT.view !== 'golf') return html;
  const cols = W_GL_COLS(), k = WSTAT.sort && cols.some(c => c[0] === WSTAT.sort) ? WSTAT.sort : null;
  const C = wFourSync(), rows = wRoster().map((p, i) => ({ p, i, b: wGlOf(p), role: wFourRoleOf(p.id, C) }));
  if (k) rows.sort((a, b) => (b.b[k] - a.b[k]) || a.i - b.i);
  const head = `<th scope="col"><button class="wsth" data-wsort="" aria-pressed="${!k}">Player</button></th><th scope="col">Role</th>` + cols.map(([c, s, l]) => `<th scope="col"><button class="wsth" data-wsort="${c}" title="${esc(l)}" aria-pressed="${k === c}">${s}</button></th>`).join('');
  const body = rows.map(({ p, b, role }) => `<tr data-wsp="${p.id}"${WSTAT.pid === p.id ? ' class="wsel"' : ''}><th scope="row"><button class="wsname" data-wsp-open aria-expanded="${WSTAT.pid === p.id}"><img src="${wPlayerPort(p, 40)}" alt=""><span><b>${esc(p.n)}</b><small>${esc(wKindName(p.kind))}</small></span></button></th>
    <td>${role ? esc(W_GLR.role[role].replace(/^the /, '')) : 'Reserve'}</td>${cols.map(([c]) => `<td>${b[c]}</td>`).join('')}</tr>`).join('');
  const sel = WSTAT.pid != null && wPlayer(WSTAT.pid);
  return html.replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Every player\'s golf ratings and their role in your four (set on the Links tab). Pick a heading to sort, a player to see more.</small>')
    .replace(/<div class="tablewrap">[\s\S]*$/, `<div class="tablewrap"><table class="wstats"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${sel ? wStatsCard(sel) : ''}`);
};

const wW106RenderHelp = renderHelp;
renderHelp = function () {
  wW106RenderHelp();
  const after = $('wHelpLinks'); if (!after || $('wHelpLinksTab')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLinksTab"><b>Golf ratings, the four and their roles.</b> Every player also has golf ratings: power, accuracy, touch, putting, nerve and scrambling (1 to ${wGlCap()}). Each level adds a point, mostly to what their kind is good at; pick a player on the Stats tab to see them, or use its Golf view. The Links tab on the Team screen sets your four and a role for each (the tee, the approach, the short game, the green): the caddie gives each shot to its role's player when the hitter rule allows. A shot costs the hitter focus, and a tired player's mark is smaller; they get it back while the others hit. On a stroke to win or halve a hole the meter runs quicker and the mark shakes, less for a steady nerve. Called-up players at your level fill the four when your roster is short. Practice round there plays your four against the Saltmere Golf Club; nothing is won or lost.</p>`);
};
