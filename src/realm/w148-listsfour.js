/* w148: jousting ratings, the four and their roles, the mounts and the squires (issue #117, phase 3), as w123 is
   curling's. Every Realm player has Tilting Lists ratings, p.jt: lance, couch, seat, shield, ride, nerve and care, 1 to
   12. They are seeded from the kind's (wJT.rate), each moved by up to 1, and every level above 1 adds a point to one of
   them, weighted by what the kind is good at; an older save's players get theirs when it loads.
   The four: a jousting side is four (W_GRD_SQUAD.jousting), two to ride and two to squire. The Lists tab on the Team
   screen sets who rides the first heat, who rides the second, and the two squires; the rest of your roster are
   reserves. Each rider rides a mount from Sir Ruddock's stable (Charger, Destrier or Courser), picked there and kept on
   the player (p.jtMount); left unpicked, the captain's choice by the ratings and the heat's length (wJT.mountFor).
   Called-up players at your level fill the four when your roster is short. Left alone, the captain sets the four from
   the ratings (wJT.autoSquad: the two best riders, the steadier nerve in the second heat, then the two best squires).
   Practice match plays your four against the Lists' own riders; nothing is won or lost. The Stats tab's Jousting view
   shows the ratings, the roles and the box lines; a player's card has a Jousting block.
   On the Lists, in You ride, your course's rows gain your rider (the mount, its wind, the arm, a shake, the pressure)
   and, between courses, your squires' jobs (your corner suggests; pick another job for either squire).

   p.jt       { lance, couch, seat, shield, ride, nerve, care, lv, got: { stat: points from levels } }
   p.jtMount  'charger' | 'destrier' | 'courser', or unset (the captain's)
   WG.lists   { four: [4 keys: heat 1's rider, heat 2's rider, the two squires], cu: [call-ups], seq, mine?: true once
              you've changed something }; a key is a roster id, or a call-up's cid ('j1', 'j2', ...)
   WG.jtstats { pid: { m, c, brk, helm, unh, unhd, kept, jobs } }: matches, courses ridden, lances broken, helm breaks,
              unhorsings, times unhorsed, seats kept after a rocking hit, squire's jobs done, this journey, from matches
              from the world (wJtRecord: Sir Ruddock's matches call it from phase 5; exhibitions and practice don't count)
   wJtOf(p)            p's ratings, made or caught up first
   wListsSync()        makes the four, or brings it up to date with the roster; returns WG.lists
   wListsMine()        your four as the Tilting Lists takes a side (roster, riders, squires, mounts, best)
   wListsSetRole(key, role), wListsSetMount(key, mount), wListsAuto()   changes; each returns a message, or '' when it
                       worked (role 0 or 1: a heat's rider; 2 or 3: a squire; 'reserve': the best reserve for it steps in)
   Wrapped: wMakePlayer (wW148MakePlayer), wGiveXp (wW148GiveXp), wStart (wW148Start), wStatsCard (wW148StatsCard: a
   Jousting block), wCampStats (wW148CampStats: the Jousting view), wOpenCamp (wW148OpenCamp: the Lists tab),
   wRenderCamp (wW148RenderCamp), wListsRows (wW148ListsRows: your rider and your squires), wListsHowHTML
   (wW148ListsHow: ratings, roles, mounts, the corner, pressure), renderHelp (wW148RenderHelp: #wHelpListsTab). */

const W_JTR = {
  cuKinds: ['spider', 'elf', 'golem', 'kobold', 'werewolf', 'witch'],
  stat: { lance: ['Lan', 'Lance: how little the tip sways'], couch: ['Cou', 'Couch: the moment to lower the lance, and how long the arm holds it'],
    seat: ['Sea', 'Seat: staying on after a hit'], shield: ['Shi', 'Shield: a lance on the shield breaks less'],
    ride: ['Rid', 'Ride: pace, the mount\'s wind, sitting a hit, and settling a Courser'], nerve: ['Ner', 'Nerve: steady in the last course when behind, and in the tilt for the crown'],
    care: ['Car', 'Care: how much a squire does between courses'] },
  role: ['the first heat\'s rider', 'the second heat\'s rider', 'a squire', 'a squire'],
  short: ['1st', '2nd', 'Sq', 'Sq'],
  roleN: ['Heat 1', 'Heat 2', 'Squire', 'Squire'],
  pick: [['0', 'Rides heat 1'], ['1', 'Rides heat 2'], ['2', 'Squire'], ['3', 'Squire']],
};
const wJtCap = () => wJT.cap;
const wJtMountOk = m => typeof m === 'string' && Object.prototype.hasOwnProperty.call(wJT.mounts, m);

/* ---------- ratings ---------- */
function wJtOf(p) {
  if (!p || !p.kind) return null;
  if (!p.jt) { const r = wJT.rate(p.kind); p.jt = { lv: 1, got: {} }; for (const s of wJT.stats) p.jt[s] = Math.max(1, Math.min(wJtCap(), Math.round(r[s]) + Math.floor(Math.random() * 3) - 1)); }
  const b = p.jt, lvl = p.lvl || 1;
  while (b.lv < lvl) { b.lv++; const s = wJtGrowStat(p); if (s) { b[s]++; b.got[s] = (b.got[s] || 0) + 1; } }
  return b;
}
function wJtGrowStat(p) {
  const K = wJT.rate(p.kind), open = wJT.stats.filter(s => p.jt[s] < wJtCap());
  if (!open.length) return null;
  let r = Math.random() * open.reduce((a, s) => a + K[s], 0);
  for (const s of open) { r -= K[s]; if (r < 0) return s; }
  return open[open.length - 1];
}
function wJtAll() { if (!WG) return; for (const p of WG.roster || []) wJtOf(p); for (const p of WG.wwait || []) wJtOf(p); for (const c of (WG.lists && WG.lists.cu) || []) wJtOf(c); }
// p's ratings as the engine reads them (0 to 1)
const wJtRs = p => Object.fromEntries(wJT.stats.map(s => [s, (wJtOf(p)[s] - 1) / (wJtCap() - 1)]));
// how well a player suits a role ('rider' or 'squire'), 0 to 1
const wJtFit = (p, role) => wJT.fit(wJtRs(p), role);
// the mount p rides: their own pick, or the captain's by their ratings and the heat's length
const wJtMountOf = p => wJtMountOk(p && p.jtMount) ? p.jtMount : wJT.mountFor(wJtRs(p), wListsCourses()).m;

const wW148MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW148MakePlayer.apply(this, arguments); wJtOf(p); return p; };
const wW148GiveXp = wGiveXp;
wGiveXp = function (p, n) { const r = wW148GiveXp(p, n); wJtOf(p); return r; };
const wW148Start = wStart;
wStart = function (save, opts) { const r = wW148Start(save, opts); wJtAll(); if (WG) wListsSync(); if (save) wSave(); return r; };

/* ---------- the four ---------- */
const wListsCu = k => typeof k === 'string';
function wListsWho(k) { if (wListsCu(k)) return ((WG.lists && WG.lists.cu) || []).find(c => c.cid === k) || null; return wPlayer(k); }
function wListsCallUp(C) {
  const used = new Set(C.four.filter(k => k != null).map(k => (wListsWho(k) || {}).kind));
  const kind = W_JTR.cuKinds.find(k => !used.has(k)) || pick(W_JTR.cuKinds);
  const c = Object.assign(wMakeCallUp(kind, new Set(wRoster().map(p => p.n).concat(C.cu.map(c => c.n)))), { cid: 'j' + (C.seq++) });
  wJtOf(c); C.cu.push(c);
  return c;
}
// the captain's pick from your roster: the engine's (the two best riders, the steadier nerve second, the two best squires)
function wListsAutoPick(C) {
  const ids = wRoster().map(p => p.id), A = wJT.autoSquad(ids.map(id => wListsPlayer(wPlayer(id))));
  const four = [A.riders[0], A.riders[1], A.squires[0], A.squires[1]].map(i => i == null ? null : ids[i]);
  C.four = four;
  C.cu = C.cu.filter(c => four.includes(c.cid));
}
function wListsSync() {
  if (!WG) return null;
  let fresh = false;
  if (!WG.lists || !Array.isArray(WG.lists.four)) { WG.lists = { four: [null, null, null, null], cu: [], seq: 1 }; fresh = true; }
  const C = WG.lists, before = JSON.stringify(C.four);
  C.four = C.four.map(k => k != null && wListsWho(k) ? k : null);
  C.cu = C.cu.filter(c => C.four.includes(c.cid));
  const tier = wNineTier();
  for (const c of C.cu) if (c.lvl < tier) { c.lvl = tier; wJtOf(c); }
  // a roster player not in the four takes a call-up's place
  for (const p of wRoster()) {
    if (C.four.includes(p.id)) continue;
    const at = C.four.findIndex(k => wListsCu(k)); if (at < 0) break;
    const old = C.four[at]; C.four[at] = p.id; C.cu = C.cu.filter(c => c.cid !== old);
  }
  // a gap: the best reserve for the role, or a call-up
  for (let i = 0; i < 4; i++) if (C.four[i] == null) {
    const role = i < 2 ? 'rider' : 'squire', res = wRoster().map(p => p.id).filter(id => !C.four.includes(id)).sort((a, b) => wJtFit(wPlayer(b), role) - wJtFit(wPlayer(a), role))[0];
    C.four[i] = res != null ? res : wListsCallUp(C).cid;
  }
  if (fresh || (!C.mine && JSON.stringify(C.four) !== before)) wListsAutoPick(C);
  for (let i = 0; i < 4; i++) if (C.four[i] == null) C.four[i] = wListsCallUp(C).cid;
  return C;
}
// a player as the Tilting Lists takes one (ratings 1 to 12)
function wListsPlayer(p) { const b = wJtOf(p); return { n: p.n, kind: p.kind, r: Object.fromEntries(wJT.stats.map(s => [s, b[s]])) }; }
function wListsMine() {
  const C = wListsSync(), t = wPartyTeam(), who = C.four.map(k => wListsWho(k)), roster = who.map(wListsPlayer);
  return { name: t.name, short: t.short, color: t.color, roster, riders: [0, 1], squires: [2, 3], mounts: [wJtMountOf(who[0]), wJtMountOf(who[1])], best: wJT.bestOf(roster, [0, 1]) };
}
const wListsRoleOf = (k, C) => { const i = (C || wListsSync()).four.indexOf(k); return i < 0 ? null : i; };
const wListsReserves = C => wRoster().map(p => p.id).filter(id => !C.four.includes(id));

/* ---------- changes ---------- */
function wListsDone() { WG.lists.mine = true; wSave(); return ''; }
function wListsSetRole(k, role) {
  const C = wListsSync(), at = wListsRoleOf(k, C);
  if (role === 'reserve') {
    if (at == null) return '';
    const want = at < 2 ? 'rider' : 'squire', res = wListsReserves(C).sort((a, b) => wJtFit(wPlayer(b), want) - wJtFit(wPlayer(a), want))[0];
    if (res == null) return 'No reserve to take their place.';
    C.four[at] = res; if (wListsCu(k)) C.cu = C.cu.filter(c => c.cid !== k);
    return wListsDone();
  }
  role = +role; if (!(role >= 0 && role < 4) || at === role) return '';
  const other = C.four[role];
  C.four[role] = k;
  if (at != null) C.four[at] = other; else if (wListsCu(other)) C.cu = C.cu.filter(c => c.cid !== other);
  return wListsDone();
}
// a rider's mount ('' or 'auto': the captain's again)
function wListsSetMount(k, m) {
  const p = wListsWho(k); if (!p) return 'Nobody by that name.';
  if (m === '' || m === 'auto') { delete p.jtMount; wSave(); return ''; }
  if (!wJtMountOk(m)) return 'Sir Ruddock\'s stable has a Charger, a Destrier and a Courser.';
  p.jtMount = m; wSave(); return '';
}
function wListsAuto() { WG.lists = null; wListsSync(); wSave(); return ''; }
function wListsPractice() {
  if (WCAMP.close) WCAMP.close();
  const mine = wListsMine(), home = wListsTeams(mine.roster.map(m => m.n))[0];
  wListsGame({ teams: [mine, home], mounts: [mine.mounts, null], best: [mine.best, null], title: 'A practice match at the Tilting Lists' });
}

/* ---------- the box lines (phase 5's matches call wJtRecord) ---------- */
// a match's summary (wJT.summary()) for your side s, keys: the roster keys in the engine's order (a call-up's is skipped)
function wJtRecord(sum, s, keys) {
  if (!WG || !sum || !sum.pst) return;
  const T = WG.jtstats || (WG.jtstats = {}), P = sum.pst[s] || [];
  (keys || []).forEach((k, i) => {
    if (typeof k !== 'number' || !wPlayer(k)) return;
    const x = P[i] || {}, L = T[k] || (T[k] = { m: 0, c: 0, brk: 0, helm: 0, unh: 0, unhd: 0, kept: 0, jobs: 0 });
    L.m++; L.c += x.courses || 0; L.brk += x.breaks || 0; L.helm += x.helms || 0; L.unh += x.unhorse || 0; L.unhd += x.unhorsed || 0; L.kept += x.kept || 0; L.jobs += x.jobs || 0;
  });
}
const wJtLine = pid => (WG.jtstats || {})[pid] || null;
const W_JT_LCOLS = [['m', 'M', 'Jousting matches'], ['c', 'Crs', 'Courses ridden'], ['brk', 'Brk', 'Lances broken'], ['helm', 'Helm', 'Helm breaks'], ['unh', 'Unh', 'Unhorsings'], ['kept', 'Kept', 'Seats kept after a rocking hit']];

/* ---------- the Jousting block on a player's stats ---------- */
function wJtCard(p) {
  const b = wJtOf(p); if (!b) return '';
  if (WG && WG.lists) { const before = JSON.stringify(WG.lists); wListsSync(); if (JSON.stringify(WG.lists) !== before) wSave(); }
  const bars = wJT.stats.map(s => { const [ab, what] = W_JTR.stat[s], got = b.got[s] || 0;
    return `<div class="wbdr" title="${esc(what)}"><span>${ab}</span><i><em style="width:${Math.round(100 * b[s] / wJtCap())}%"></em></i><b>${b[s]}</b><small>${got ? `+${got}` : ''}</small></div>`; }).join('');
  const key = p.cid || p.id, role = WG && WG.lists ? wListsRoleOf(key, WG.lists) : null, other = p.cid && !(WG && WG.lists && WG.lists.cu.some(c => c.cid === p.cid));
  const where = role != null ? `In your four, ${esc(W_JTR.role[role])}${role < 2 ? `, on a ${esc(wJT.mounts[wJtMountOf(p)].n)}` : ''}.` : WG && WG.lists && !other ? 'A reserve for your four.' : 'Not in your squad.';
  const L = wJtLine(p.id), line = L && L.m ? `<p class="wbdbox">${L.m} jousting match${L.m === 1 ? '' : 'es'}: ${L.c} course${L.c === 1 ? '' : 's'}, ${L.brk} lance${L.brk === 1 ? '' : 's'} broken, ${L.helm} on the helm, ${L.unh} unhorsing${L.unh === 1 ? '' : 's'}, ${L.kept} seat${L.kept === 1 ? '' : 's'} kept.</p>` : '';
  return `<div class="wbd wbkc wjtc"><h5>Jousting</h5>${line}<p class="wbdpos">${where}</p>
    <div class="wbdbars">${bars}</div><p class="hint">As a rider ${Math.round(100 * wJtFit(p, 'rider'))}, as a squire ${Math.round(100 * wJtFit(p, 'squire'))}. Each level adds a point to one rating (shown as +), mostly to what their kind is good at. Ratings run from 1 to ${wJtCap()}.</p></div>`;
}
const wW148StatsCard = wStatsCard;
wStatsCard = function (p) { return wW148StatsCard(p).replace(/<\/section>\s*$/, wJtCard(p) + '</section>'); };

/* ---------- the Lists tab ---------- */
function wListsRow(k, C) {
  const p = wListsWho(k), b = wJtOf(p), cu = wListsCu(k), at = wListsRoleOf(k, C), key = esc(String(k));
  const opts = W_JTR.pick.map(([v, n]) => `<option value="${v}"${at === +v ? ' selected' : ''}>${esc(n)}</option>`).join('') + `<option value="reserve"${at == null ? ' selected' : ''}>Reserve</option>`;
  const mine = wJtMountOk(p.jtMount), mount = wJtMountOf(p), cap = wJT.mountFor(wJtRs(p), wListsCourses());
  const mopts = `<option value="auto"${mine ? '' : ' selected'}>The captain's (${esc(wJT.mounts[cap.m].n)})</option>` + Object.entries(wJT.mounts).map(([m, M]) => `<option value="${m}"${mine && p.jtMount === m ? ' selected' : ''}>${esc(M.n)}</option>`).join('');
  return `<li class="wpr wnr wjtt${cu ? ' wcu' : ''}" data-cid="${key}">
    <span class="wno"${at != null ? ` title="${esc(W_JTR.roleN[at])}"` : ''}>${at != null ? esc(W_JTR.short[at]) : '&ndash;'}</span><img src="${wPlayerPort(p, 64)}" alt="">
    <div class="wpi"><div class="wpn"><b>${esc(p.n)}</b><span class="k">${esc(wKindName(p.kind))}, level ${p.lvl}</span>${cu ? '<span class="wtag wb">Call-up</span>' : ''}</div>
      <small class="wnst" title="How well they suit each role: rider ${Math.round(100 * wJtFit(p, 'rider'))}, squire ${Math.round(100 * wJtFit(p, 'squire'))}">${wJT.stats.map(s => `<span title="${esc(W_JTR.stat[s][1])}">${W_JTR.stat[s][0]} <b>${b[s]}</b></span>`).join(' ')} <span>Rider <b>${Math.round(100 * wJtFit(p, 'rider'))}</b></span> <span>Squire <b>${Math.round(100 * wJtFit(p, 'squire'))}</b></span></small></div>
    <div class="wpa"><label class="wsvl">Role <select data-jrole aria-label="${esc(p.n)}'s role">${opts}</select></label>${at != null && at < 2 ? `<label class="wsvl" title="${esc(`${wJT.mounts[mount].n}. The captain would pick the ${wJT.mounts[cap.m].n}: ${cap.why}.`)}">Mount <select data-jmount aria-label="${esc(p.n)}'s mount">${mopts}</select></label>` : ''}</div>
  </li>`;
}
function wCampLists(C) {
  const res = wListsReserves(C), M = wJT.mounts;
  return `<p class="hint">Your four at the Tilting Lists: two ride, one a heat (the first rider meets their first, then the second meets their second), and two squire. A rider wants a steady <b>lance</b>, a good <b>seat</b>, the <b>couch</b>, the <b>shield</b> and the <b>ride</b>; the second heat and the tilt for the crown want <b>nerve</b>. A squire wants <b>care</b>: between courses each squire does one job (tend the mount, steady the rider or tighten the girth), and care sets how much.</p>
    <p class="hint">Each rider rides a mount from Sir Ruddock's stable: the <b>${M.charger.n}</b> is fast, hits hard and carries its rider through a hit, but sways more (for a steady lance), the <b>${M.destrier.n}</b> is the easiest to aim from for most riders but hits softer (for a lance that sways), the <b>${M.courser.n}</b> is light: it hits softest and sways under an ordinary rider, but a good rider settles it, and it gets its wind back quickly (for a good <b>ride</b>, most of all in a long heat).</p>
    <h4>The four</h4><ol class="wroster wnine wcourt wlistsfour">${C.four.map(k => wListsRow(k, C)).join('')}</ol>
    <h4>Reserves</h4>${res.length ? `<ol class="wroster wnine wcourtb wlistsres">${res.map(k => wListsRow(k, C)).join('')}</ol>` : '<p class="hint">Nobody: every player you have is in the four.</p>'}
    <div class="row wnbtn"><button class="ghost" data-jauto>The captain's pick</button><button class="btn" data-jpractice>Practice match</button></div>`;
}
const wW148OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  wW148OpenCamp(want === 'lists' ? 'team' : tab);
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="lists"]')) return;
  tabs.lastElementChild.insertAdjacentHTML('afterend', '<button role="tab" data-ctab="lists">Lists</button>');
  tabs.querySelector('[data-ctab="lists"]').onclick = () => { WCAMP.tab = 'lists'; WCAMP.swap = null; WCAMP.msg = ''; wRenderCamp(); };
  if (want === 'lists') { WCAMP.tab = 'lists'; wRenderCamp(); }
};
const wW148RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'lists') return wW148RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="lists"]')) { WCAMP.tab = 'team'; return wRenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'lists'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  const before = JSON.stringify(WG.lists), C = wListsSync(); if (JSON.stringify(C) !== before) wSave();
  body.innerHTML = `<div class="wcsum"><span>Players <b>${wRoster().length}/${W_PARTY.max}</b></span><span>Call-ups <b>${C.cu.length}</b> at level ${wNineTier()}</span></div>
    ${WCAMP.msg ? `<p class="wbad wcmsg" role="alert">${esc(WCAMP.msg)}</p>` : ''}` + wCampLists(C);
  const keyOf = el => { const k = el.closest('[data-cid]').dataset.cid; return /^\d+$/.test(k) ? +k : k; };
  body.querySelectorAll('[data-jrole]').forEach(s => s.onchange = () => wCampSay(wListsSetRole(keyOf(s), s.value)));
  body.querySelectorAll('[data-jmount]').forEach(s => s.onchange = () => wCampSay(wListsSetMount(keyOf(s), s.value)));
  const auto = body.querySelector('[data-jauto]'); if (auto) auto.onclick = () => wCampSay(wListsAuto());
  const pr = body.querySelector('[data-jpractice]'); if (pr) pr.onclick = () => wListsPractice();
};

/* ---------- the Jousting view on the Stats tab ---------- */
const W_JT_COLS = () => wJT.stats.map(s => [s, W_JTR.stat[s][0], W_JTR.stat[s][1]]);
const wW148CampStats = wCampStats;
wCampStats = function () {
  const btn = `<button data-wsview="jousting" aria-pressed="${WSTAT.view === 'jousting'}">Jousting</button>`;
  let html = wW148CampStats();
  html = /data-wsview="curling"[^>]*>Curling<\/button>/.test(html) ? html.replace(/(<button data-wsview="curling"[^>]*>Curling<\/button>)/, `$1${btn}`) : html.replace(/(<button data-wsview="career"[^>]*>Career<\/button>)/, `$1${btn}`);
  if (WSTAT.view !== 'jousting') return html;
  const cols = W_JT_COLS(), lc = W_JT_LCOLS, k = WSTAT.sort && cols.some(c => c[0] === WSTAT.sort) ? WSTAT.sort : null;
  const C = wListsSync(), rows = wRoster().map((p, i) => ({ p, i, b: wJtOf(p), role: wListsRoleOf(p.id, C), L: wJtLine(p.id) }));
  if (k) rows.sort((a, b) => (b.b[k] - a.b[k]) || a.i - b.i);
  const head = `<th scope="col"><button class="wsth" data-wsort="" aria-pressed="${!k}">Player</button></th><th scope="col">Role</th>` + cols.map(([c, s, l]) => `<th scope="col"><button class="wsth" data-wsort="${c}" title="${esc(l)}" aria-pressed="${k === c}">${s}</button></th>`).join('')
    + lc.map(([c, s, l]) => `<th scope="col" title="${esc(l)}">${s}</th>`).join('');
  const body = rows.map(({ p, b, role, L }) => `<tr data-wsp="${p.id}"${WSTAT.pid === p.id ? ' class="wsel"' : ''}><th scope="row"><button class="wsname" data-wsp-open aria-expanded="${WSTAT.pid === p.id}"><img src="${wPlayerPort(p, 40)}" alt=""><span><b>${esc(p.n)}</b><small>${esc(wKindName(p.kind))}</small></span></button></th>
    <td>${role != null ? esc(W_JTR.roleN[role]) + (role < 2 ? ` <small>${esc(wJT.mounts[wJtMountOf(p)].n)}</small>` : '') : 'Reserve'}</td>${cols.map(([c]) => `<td>${b[c]}</td>`).join('')}${lc.map(([c]) => `<td>${L && L.m ? L[c] || 0 : '<span class="dim">&ndash;</span>'}</td>`).join('')}</tr>`).join('');
  const sel = WSTAT.pid != null && wPlayer(WSTAT.pid);
  return html.replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Every player\'s jousting ratings, their role in your four (set on the Lists tab), and their box lines from jousting matches from the world on this journey (exhibitions and practice are not counted). Pick a heading to sort, a player to see more.</small>')
    .replace(/<div class="tablewrap">[\s\S]*$/, `<div class="tablewrap"><table class="wstats"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${sel ? wStatsCard(sel) : ''}`);
};

/* ---------- on the Lists: your rider and your squires ---------- */
$('wListsRows').insertAdjacentHTML('afterbegin', '<div class="wccrow" id="wListsRowUp"><span class="wccl">Rider</span><span id="wListsUp"></span></div>');
$('wListsGo').closest('.wccrow').insertAdjacentHTML('beforebegin', '<div class="wccrow" id="wListsRowSq" hidden><span class="wccl">Squires</span><span id="wListsSq"></span></div>');
$('wListsRows').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  let why = '';
  if (b.dataset.jjob) why = wJT.select({ job: [+b.dataset.jsq, b.dataset.jjob] });
  else if (b.dataset.jcorner) why = wJT.select({ corner: true });
  else return;
  if (why) $('wListsNote').textContent = why;
});
const wW148ListsRows = wListsRows;
wListsRows = function () {
  wW148ListsRows();
  const V = WJT && !WJT.over && wJT.G && wJT.G.teams ? wJT.view : null; if (!V || V.mode === 'watch' || V.ph !== 'plan' || !V.sel || !V.squad || !V.riders) return;
  const s = V.you, Q = V.squad, G = wJT.G, m = G.teams[s].roster[V.riders[s]], slot = G.riders[s].indexOf(V.riders[s]), mount = wJT.mounts[Q.mounts[s][slot < 0 ? 0 : slot]] || {};
  const pct = v => Math.round(100 * v);
  $('wListsUp').innerHTML = `<b>${esc(m.n)}</b> <small>${esc(wKindName(m.kind) || '')}, on a ${esc(mount.n || '')}</small> · <span title="The mount's wind: a course spends some, a gallop most. A blown mount is slower and the tip sways more. A squire who tends the mount gets some back.">Wind <b>${pct(Q.wind[s])}%</b></span> · <span title="The lance arm: every couch tires it, an early one most. A tired arm sways and droops. A squire who steadies the rider gives some back.">Arm <b>${pct(Q.arm[s])}%</b></span>${Q.shaken[s] > .05 ? ' · <b class="wbad" title="Rocked by that hit: the tip sways more and the seat is worse. A squire can steady them.">Shaken</b>' : ''}${Q.girth[s] > 0 ? ' · <span title="The girth tightened: a better seat this course.">Girth tight</span>' : ''}${Q.press[s] ? ` · <b class="wbad" title="${esc(V.inTilt ? 'The tilt for the crown' : 'The last course of the heat, and behind')}: the tip sways more, less for a steady nerve.">${V.inTilt ? 'For the crown' : 'Behind, the last course'}</b>` : ''}`;
  const row = $('wListsRowSq'); row.hidden = !V.jobs;
  if (!V.jobs) return;
  const J = wJT.jobs;
  $('wListsSq').innerHTML = Q.squires[s].map((q, i) => `<span class="wjtsq"><b>${esc(q.n)}</b> ${Object.entries(J).map(([k, j]) => `<button class="ghost${V.jobs[i] === k ? ' on' : ''}" data-jsq="${i}" data-jjob="${k}" title="${esc(j.n)}">${esc(j.n.split(' ')[0])}</button>`).join(' ')}</span>`).join(' ')
    + ` <button class="ghost" data-jcorner="1" title="What your corner would do">Corner's word</button> <small class="hint">Two squires, two jobs: tend the mount (wind), steady the rider (a shake, the arm) or tighten the girth (the seat). They do them when you ride.</small>`;
};

/* ---------- How to play ---------- */
const wW148ListsHow = wListsHowHTML;
wListsHowHTML = function () {
  return wW148ListsHow() + `<p class="hint"><b>Ratings.</b> Each player has seven: <b>lance</b> (how little the tip sways), <b>couch</b> (the moment to lower it, and how long the arm holds it), <b>seat</b> (staying on after a hit), <b>shield</b> (a lance on the shield breaks less), <b>ride</b> (pace, the mount's wind, sitting a hit, and settling a Courser), <b>nerve</b> and <b>care</b> (a squire's). Each level adds a point, mostly to what their kind is good at.</p>
  <p class="hint"><b>Riders and squires.</b> The Lists tab on the Team screen sets your four: the first heat's rider, the second's, and two squires. Left alone, the captain picks the two best riders (the steadier nerve rides the second heat) and the two best squires. In the tilt for the crown your best rider by nerve and lance rides.</p>
  <p class="hint"><b>Mounts.</b> Each rider rides one of Sir Ruddock's: the <b>Charger</b> (fast, hits hard, carries you through a hit, sways more: for a steady lance in a short heat), the <b>Destrier</b> (the easiest to aim from for most riders, hits softer: for a lance that sways) or the <b>Courser</b> (light: hits softest and sways under an ordinary rider, but a good ride settles it, and it gets its wind back quickly: for a good rider, most of all in a long heat). Left alone, the captain picks by those. A course spends the mount's wind, a gallop most; a blown mount is slower and the tip sways more. Each heat's rider starts on a fresh mount.</p>
  <p class="hint"><b>The arm and the shake.</b> Every couch tires the lance arm, an early one most: a tired arm sways and the tip droops. A rider rocked by a broken lance who stays on is shaken for the next course: more sway and a worse seat.</p>
  <p class="hint"><b>Your squires.</b> Between courses each squire does one job, two of the three: <b>tend the mount</b> (some of its lost wind back), <b>steady the rider</b> (the shake gone, some of the arm back) or <b>tighten the girth</b> (a better seat next course). Their care sets how much. In You ride you pick the jobs before you ride (your corner suggests); the CPU's corner picks by its skill.</p>
  <p class="hint"><b>Nerve.</b> The last course of a heat when you're behind, and every course of the tilt for the crown, weigh on a rider: the tip sways more and the couch is harder to time, less for a steady nerve. The CPU's riders feel it too.</p>`;
};
const wW148RenderHelp = renderHelp;
renderHelp = function () {
  wW148RenderHelp();
  const after = $('wHelpLists'); if (!after || $('wHelpListsTab')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpListsTab"><b>Jousting ratings, riders and squires.</b> Every player also has jousting ratings: lance, couch, seat, shield, ride, nerve and care (1 to ${wJtCap()}). Each level adds a point, mostly to what their kind is good at; pick a player on the Stats tab to see them, or use its Jousting view. The Lists tab on the Team screen sets your four (two riders, a heat each, and two squires) and each rider's mount (Charger, Destrier or Courser). Between courses your squires tend the mount, steady the rider or tighten the girth. The last course when behind, and the tilt for the crown, weigh on a rider's nerve. Practice match there plays your four against the Lists' own riders; nothing is won or lost.</p>`);
};
