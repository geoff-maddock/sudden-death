/* w114: bowling ratings, the five and their order (issue #100, phase 3). Every Realm player has Saltmere Lanes ratings,
   p.bl, as they have golf's p.gl (w106): power, revs, accuracy, spare, nerve and read, 1 to 12, and a bowling hand.
   They are seeded from the kind's (wBL.rate), each moved by up to 1, and every level above 1 adds a point to one of
   them, weighted by what the kind is good at; an older save's players get theirs when it loads.
   The five: a bowling side is five (W_GRD_SQUAD.bowling), one team game in the Baker format, the five taking the
   frames in turn. The Lanes tab on the Team screen sets your five and their order: the leadoff (the 1st and the 6th),
   the 2nd, 3rd and 4th, and the anchor (the 5th and the 10th). The rest of your roster are reserves. Called-up players
   at your level fill the five when your roster is short. Left alone, the captain sets the five and the order from the
   ratings (the anchor first: nerve and spares; then the leadoff: power, revs and accuracy). Practice game plays your
   five against Saltmere's at the Lanes; nothing is won or lost. The Stats tab's Bowling view shows the ratings and the
   order.

   p.bl       { pow, rev, acc, spr, nrv, red, hand: 1 | -1, lv, got: { stat: points from levels } }
   WG.lanes   { five: [5 keys, in order], cu: [call-ups], seq, mine?: true once you've changed something }
              a key is a roster id, or a call-up's cid ('n1', 'n2', ...)
   wBlOf(p)           p's ratings, made or caught up first
   wFiveSync()        makes the five, or brings it up to date with the roster; returns WG.lanes
   wFiveMine()        your five as the Saltmere Lanes takes a team (roster in order, and the order)
   wFiveSetSlot(key, slot), wFiveAuto()    changes; each returns a message, or '' when it worked (slot 0 to 4, or
                      'reserve': the best reserve for that slot takes it)
   Wrapped: wMakePlayer (wW114MakePlayer), wGiveXp (wW114GiveXp), wStart (wW114Start), wStatsCard (wW114StatsCard: a
   Bowling block), wCampStats (wW114CampStats: the Bowling view), wOpenCamp (wW114OpenCamp: the Lanes tab), wRenderCamp
   (wW114RenderCamp), wLanesRows (wW114LanesRows: the bowler, their arm, the moment), renderHelp (wW114RenderHelp: #wHelpLanesTab), wLanesHowHTML (wW114LanesHow: ratings, the order, arm and nerve). */

const W_BLR = {
  cuKinds: ['zombie', 'gorgon', 'wraith', 'spider', 'troll', 'dwarf'],
  stat: { pow: ['Pow', 'Power: the ball\'s speed, and how hard it drives through the pins'], rev: ['Rev', 'Revs: side spin, so hook and the angle into the pocket'],
    acc: ['Acc', 'Accuracy: how true the strike ball goes (the mark on the meter is wider)'], spr: ['Spr', 'Spare: how true a ball at a spare goes'],
    nrv: ['Nrv', 'Nerve: steady in the last frame, when the game hangs on it'], red: ['Red', 'Read: how soon they see the oil change and move'] },
  slot: ['the leadoff', 'the 2nd', 'the 3rd', 'the 4th', 'the anchor'],
  short: ['Lead', '2nd', '3rd', '4th', 'Anch'],
};
const wBlCap = () => wBL.cap;
const wBlRole = i => wBL.roles[i];

/* ---------- ratings ---------- */
function wBlOf(p) {
  if (!p || !p.kind) return null;
  if (!p.bl) { const r = wBL.rate(p.kind); p.bl = { lv: 1, got: {}, hand: Math.random() < .15 ? -1 : 1 }; for (const s of wBL.stats) p.bl[s] = Math.max(1, Math.min(wBlCap(), Math.round(r[s]) + Math.floor(Math.random() * 3) - 1)); }
  const b = p.bl, lvl = p.lvl || 1;
  if (b.hand !== 1 && b.hand !== -1) b.hand = 1;
  while (b.lv < lvl) { b.lv++; const s = wBlGrowStat(p); if (s) { b[s]++; b.got[s] = (b.got[s] || 0) + 1; } }
  return b;
}
function wBlGrowStat(p) {
  const K = wBL.rate(p.kind), open = wBL.stats.filter(s => p.bl[s] < wBlCap());
  if (!open.length) return null;
  let r = Math.random() * open.reduce((a, s) => a + K[s], 0);
  for (const s of open) { r -= K[s]; if (r < 0) return s; }
  return open[open.length - 1];
}
function wBlAll() { if (!WG) return; for (const p of WG.roster || []) wBlOf(p); for (const p of WG.wwait || []) wBlOf(p); for (const c of (WG.lanes && WG.lanes.cu) || []) wBlOf(c); }
// how well a player suits a slot of the order, 0 to 1
const wBlFit = (p, slot) => wBL.fit(Object.fromEntries(wBL.stats.map(s => [s, (wBlOf(p)[s] - 1) / (wBlCap() - 1)])), wBlRole(slot));

const wW114MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW114MakePlayer(spec, from); wBlOf(p); return p; };
const wW114GiveXp = wGiveXp;
wGiveXp = function (p, n) { const r = wW114GiveXp(p, n); wBlOf(p); return r; };
const wW114Start = wStart;
wStart = function (save, opts) { const r = wW114Start(save, opts); wBlAll(); if (save) wSave(); return r; };

/* ---------- the five ---------- */
const wFiveCu = k => typeof k === 'string';
function wFiveWho(k) { if (wFiveCu(k)) return ((WG.lanes && WG.lanes.cu) || []).find(c => c.cid === k) || null; return wPlayer(k); }
function wFiveCallUp(C) {
  const used = new Set(C.five.filter(k => k != null).map(k => (wFiveWho(k) || {}).kind));
  const kind = W_BLR.cuKinds.find(k => !used.has(k)) || pick(W_BLR.cuKinds);
  const c = Object.assign(wMakeCallUp(kind, new Set(wRoster().map(p => p.n).concat(C.cu.map(c => c.n)))), { cid: 'n' + (C.seq++) });
  wBlOf(c); C.cu.push(c);
  return c;
}
// the captain's pick: the anchor first, then the leadoff, then the middle three, each the best of those left
function wFiveAutoPick(C) {
  const left = new Set(wRoster().map(p => p.id)), five = [null, null, null, null, null];
  for (const slot of [4, 0, 3, 2, 1]) {
    const best = [...left].sort((a, b) => wBlFit(wFiveWho(b), slot) - wBlFit(wFiveWho(a), slot))[0];
    if (best == null) break;
    five[slot] = best; left.delete(best);
  }
  C.five = five;
  C.cu = C.cu.filter(c => five.includes(c.cid));
}
function wFiveSync() {
  if (!WG) return null;
  let fresh = false;
  if (!WG.lanes || !Array.isArray(WG.lanes.five)) { WG.lanes = { five: [null, null, null, null, null], cu: [], seq: 1 }; fresh = true; }
  const C = WG.lanes, before = JSON.stringify(C.five);
  C.five = C.five.map(k => k != null && wFiveWho(k) ? k : null);
  C.cu = C.cu.filter(c => C.five.includes(c.cid));
  const tier = wNineTier();
  for (const c of C.cu) if (c.lvl < tier) { c.lvl = tier; wBlOf(c); }
  // a roster player not in the five takes a call-up's slot
  for (const p of wRoster()) {
    if (C.five.includes(p.id)) continue;
    const at = C.five.findIndex(k => wFiveCu(k)); if (at < 0) break;
    const old = C.five[at]; C.five[at] = p.id; C.cu = C.cu.filter(c => c.cid !== old);
  }
  // a gap: the best reserve for the slot, or a call-up
  for (let i = 0; i < 5; i++) if (C.five[i] == null) {
    const res = wRoster().map(p => p.id).filter(id => !C.five.includes(id)).sort((a, b) => wBlFit(wPlayer(b), i) - wBlFit(wPlayer(a), i))[0];
    C.five[i] = res != null ? res : wFiveCallUp(C).cid;
  }
  if (fresh || (!C.mine && JSON.stringify(C.five) !== before)) wFiveAutoPick(C);
  for (let i = 0; i < 5; i++) if (C.five[i] == null) C.five[i] = wFiveCallUp(C).cid;
  return C;
}
// a player as the Saltmere Lanes takes one (ratings 1 to 12, and their hand)
function wLanesPlayer(p) { const b = wBlOf(p); return { n: p.n, kind: p.kind, r: Object.fromEntries(wBL.stats.map(s => [s, b[s]])), hand: b.hand }; }
function wFiveMine() {
  const C = wFiveSync(), t = wPartyTeam();
  return { name: t.name, short: t.short, color: t.color, roster: C.five.map(k => wLanesPlayer(wFiveWho(k))), order: [0, 1, 2, 3, 4] };
}
const wFiveSlotOf = (k, C) => { const i = (C || wFiveSync()).five.indexOf(k); return i < 0 ? null : i; };
const wFiveReserves = C => wRoster().map(p => p.id).filter(id => !C.five.includes(id));

/* ---------- changes ---------- */
function wFiveDone() { WG.lanes.mine = true; wSave(); return ''; }
function wFiveSetSlot(k, slot) {
  const C = wFiveSync(), at = wFiveSlotOf(k, C);
  if (slot === 'reserve') {
    if (at == null) return '';
    const res = wFiveReserves(C).sort((a, b) => wBlFit(wPlayer(b), at) - wBlFit(wPlayer(a), at))[0];
    if (res == null) return 'No reserve to take their place.';
    C.five[at] = res; if (wFiveCu(k)) C.cu = C.cu.filter(c => c.cid !== k);
    return wFiveDone();
  }
  slot = +slot; if (!(slot >= 0 && slot < 5) || at === slot) return '';
  const other = C.five[slot];
  C.five[slot] = k;
  if (at != null) C.five[at] = other; else if (wFiveCu(other)) C.cu = C.cu.filter(c => c.cid !== other);
  return wFiveDone();
}
function wFiveAuto() { WG.lanes = null; wFiveSync(); wSave(); return ''; }
function wFivePractice() {
  if (WCAMP.close) WCAMP.close();
  const mine = wFiveMine(), home = wLanesTeams(mine.roster.map(m => m.n))[0];
  wLanesGame({ teams: [mine, home], title: 'A practice game at the Saltmere Lanes' });
}

/* ---------- the Bowling block on a player's stats ---------- */
function wBlCard(p) {
  const b = wBlOf(p); if (!b) return '';
  const bars = wBL.stats.map(s => { const [ab, what] = W_BLR.stat[s], got = b.got[s] || 0;
    return `<div class="wbdr" title="${esc(what)}"><span>${ab}</span><i><em style="width:${Math.round(100 * b[s] / wBlCap())}%"></em></i><b>${b[s]}</b><small>${got ? `+${got}` : ''}</small></div>`; }).join('');
  const slot = WG && WG.lanes ? wFiveSlotOf(p.cid || p.id, WG.lanes) : null;
  return `<div class="wbd wbkc wblc"><h5>Bowling</h5><p class="wbdpos">${slot != null ? `In your five, ${esc(W_BLR.slot[slot])}.` : WG && WG.lanes ? 'A reserve for your five.' : 'Not in your squad.'} ${b.hand < 0 ? 'Left-handed.' : 'Right-handed.'}</p>
    <div class="wbdbars">${bars}</div><p class="hint">Each level adds a point to one rating (shown as +), mostly to what their kind is good at. Ratings run from 1 to ${wBlCap()}.</p></div>`;
}
const wW114StatsCard = wStatsCard;
wStatsCard = function (p) { return wW114StatsCard(p).replace(/<\/section>\s*$/, wBlCard(p) + '</section>'); };

/* ---------- the Lanes tab ---------- */
function wFiveRow(k, C) {
  const p = wFiveWho(k), b = wBlOf(p), cu = wFiveCu(k), at = wFiveSlotOf(k, C), key = esc(String(k));
  const opts = W_BLR.slot.map((n, i) => `<option value="${i}"${at === i ? ' selected' : ''}>${esc(n[4].toUpperCase() + n.slice(5))}</option>`).join('') + `<option value="reserve"${at == null ? ' selected' : ''}>Reserve</option>`;
  const fits = [0, 2, 4].map(i => `${W_BLR.slot[i].replace('the ', '')} ${Math.round(wBlFit(p, i) * 100)}`).join(', ');
  return `<li class="wpr wnr wcrt${cu ? ' wcu' : ''}" data-nid="${key}">
    <span class="wno">${at != null ? esc(W_BLR.short[at]) : '&ndash;'}</span><img src="${wPlayerPort(p, 64)}" alt="">
    <div class="wpi"><div class="wpn"><b>${esc(p.n)}</b><span class="k">${esc(wKindName(p.kind))}, level ${p.lvl}, ${b.hand < 0 ? 'left' : 'right'}-handed</span>${cu ? '<span class="wtag wb">Call-up</span>' : ''}</div>
      <small class="wnst" title="How well they suit the order: ${esc(fits)}">${wBL.stats.map(s => `<span title="${esc(W_BLR.stat[s][1])}">${W_BLR.stat[s][0]} <b>${b[s]}</b></span>`).join(' ')}</small></div>
    <div class="wpa"><label class="wsvl">Order <select data-nslot aria-label="${esc(p.n)}'s place in the order">${opts}</select></label></div>
  </li>`;
}
function wCampLanes(C) {
  const res = wFiveReserves(C);
  return `<p class="hint">Your bowling five, in their order. One team game: the five take the frames in turn, so the leadoff bowls the 1st and the 6th and the anchor the 5th and the 10th, where close games are won. A leadoff wants power, revs and accuracy; an anchor wants nerve and spares. Every ball costs the bowler some arm, and they get it back while the others bowl, so it tells in the tenth frame. Until you change something, the captain sets the five and the order again whenever your squad changes.</p>
    <h4>The five</h4><ol class="wroster wnine wcourt wlanesfive">${C.five.map(k => wFiveRow(k, C)).join('')}</ol>
    <h4>Reserves</h4>${res.length ? `<ol class="wroster wnine wcourtb wlanesres">${res.map(k => wFiveRow(k, C)).join('')}</ol>` : '<p class="hint">Nobody: every player you have is in the five.</p>'}
    <div class="row wnbtn"><button class="ghost" data-nauto>The captain's pick</button><button class="btn" data-npractice>Practice game</button></div>`;
}
const wW114OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  wW114OpenCamp(want === 'lanes' ? 'team' : tab);
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="lanes"]')) return;
  tabs.lastElementChild.insertAdjacentHTML('afterend', '<button role="tab" data-ctab="lanes">Lanes</button>');
  tabs.querySelector('[data-ctab="lanes"]').onclick = () => { WCAMP.tab = 'lanes'; WCAMP.swap = null; WCAMP.msg = ''; wRenderCamp(); };
  if (want === 'lanes') { WCAMP.tab = 'lanes'; wRenderCamp(); }
};
const wW114RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'lanes') return wW114RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="lanes"]')) { WCAMP.tab = 'team'; return wRenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'lanes'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  const before = JSON.stringify(WG.lanes), C = wFiveSync(); if (JSON.stringify(C) !== before) wSave();
  body.innerHTML = `<div class="wcsum"><span>Players <b>${wRoster().length}/${W_PARTY.max}</b></span><span>Call-ups <b>${C.cu.length}</b> at level ${wNineTier()}</span></div>
    ${WCAMP.msg ? `<p class="wbad wcmsg" role="alert">${esc(WCAMP.msg)}</p>` : ''}` + wCampLanes(C);
  const keyOf = el => { const k = el.closest('[data-nid]').dataset.nid; return /^n\d+$/.test(k) ? k : +k; };
  body.querySelectorAll('[data-nslot]').forEach(s => s.onchange = () => wCampSay(wFiveSetSlot(keyOf(s), s.value)));
  const auto = body.querySelector('[data-nauto]'); if (auto) auto.onclick = () => wCampSay(wFiveAuto());
  const pr = body.querySelector('[data-npractice]'); if (pr) pr.onclick = () => wFivePractice();
};

/* ---------- the Bowling view on the Stats tab ---------- */
const W_BL_COLS = () => wBL.stats.map(s => [s, W_BLR.stat[s][0], W_BLR.stat[s][1]]);
const wW114CampStats = wCampStats;
wCampStats = function () {
  const html = wW114CampStats().replace(/(<button data-wsview="career"[^>]*>Career<\/button>)/, `$1<button data-wsview="bowling" aria-pressed="${WSTAT.view === 'bowling'}">Bowling</button>`);
  if (WSTAT.view !== 'bowling') return html;
  const cols = W_BL_COLS(), k = WSTAT.sort && cols.some(c => c[0] === WSTAT.sort) ? WSTAT.sort : null;
  const C = wFiveSync(), rows = wRoster().map((p, i) => ({ p, i, b: wBlOf(p), slot: wFiveSlotOf(p.id, C) }));
  if (k) rows.sort((a, b) => (b.b[k] - a.b[k]) || a.i - b.i);
  const head = `<th scope="col"><button class="wsth" data-wsort="" aria-pressed="${!k}">Player</button></th><th scope="col">Order</th><th scope="col" title="Bowling hand">Hand</th>` + cols.map(([c, s, l]) => `<th scope="col"><button class="wsth" data-wsort="${c}" title="${esc(l)}" aria-pressed="${k === c}">${s}</button></th>`).join('');
  const body = rows.map(({ p, b, slot }) => `<tr data-wsp="${p.id}"${WSTAT.pid === p.id ? ' class="wsel"' : ''}><th scope="row"><button class="wsname" data-wsp-open aria-expanded="${WSTAT.pid === p.id}"><img src="${wPlayerPort(p, 40)}" alt=""><span><b>${esc(p.n)}</b><small>${esc(wKindName(p.kind))}</small></span></button></th>
    <td>${slot != null ? esc(W_BLR.slot[slot].replace(/^the /, '')) : 'Reserve'}</td><td>${b.hand < 0 ? 'L' : 'R'}</td>${cols.map(([c]) => `<td>${b[c]}</td>`).join('')}</tr>`).join('');
  const sel = WSTAT.pid != null && wPlayer(WSTAT.pid);
  return html.replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Every player\'s bowling ratings and their place in your five (set on the Lanes tab). Pick a heading to sort, a player to see more.</small>')
    .replace(/<div class="tablewrap">[\s\S]*$/, `<div class="tablewrap"><table class="wstats"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${sel ? wStatsCard(sel) : ''}`);
};

// your ball's rows gain a line for the bowler up: their arm, and the moment
$('wLanesRows').insertAdjacentHTML('afterbegin', '<div class="wccrow" id="wLanesRowUp"><span class="wccl">Bowler</span><span id="wLanesUp"></span></div>');
const wW114LanesRows = wLanesRows;
wLanesRows = function () {
  wW114LanesRows();
  const V = WBL && !WBL.over && wBL.G && wBL.G.teams ? wBL.view : null; if (!V || V.up !== V.you || !V.sel) return;
  const m = wBL.G.teams[V.you].roster[V.bowler], arm = wBL.arm ? Math.round(wBL.arm[V.you][V.bowler] * 100) : 100, pr = wBL.pressure(V.you);
  $('wLanesUp').innerHTML = `<b>${esc(m.n)}</b> <small>${esc(wKindName(m.kind) || '')}, ${m.style.hand < 0 ? 'left' : 'right'}-handed, ${m.style.mph} mph</small> · <span title="Each ball costs some arm; it comes back while the others bowl. A tired arm's mark is smaller.">Arm <b>${arm}%</b></span>${pr ? ` · <b class="wbad" title="The last frame: the meter falls quicker and the mark shakes, less for a steady nerve">${pr > 1 ? 'The game hangs on it' : 'The last frame'}</b>` : ''}`;
};
// Bowling: how it works gains the ratings, the order, arm and nerve
const wW114LanesHow = wLanesHowHTML;
wLanesHowHTML = function () {
  return wW114LanesHow() + `<p class="hint"><b>Ratings.</b> Each bowler has six: <b>power</b> (the ball's speed, and how hard it drives through the pins), <b>revs</b> (side spin: hook and the angle into the pocket), <b>accuracy</b> (how true the strike ball goes: your mark on the meter is wider), <b>spare</b> (the same at a spare), <b>nerve</b> and <b>read</b> (how soon they see the oil change). A bowler's speed and revs follow their power and revs, and each has their own hand.</p>
  <p class="hint"><b>The order.</b> Your five are set on the Lanes tab: the leadoff bowls the 1st and the 6th, the anchor the 5th and the 10th. A leadoff wants power, revs and accuracy; an anchor nerve and spares.</p>
  <p class="hint"><b>Arm.</b> Every ball costs the bowler some arm, a power ball more, and they get it back while the rest of the side bowls. A tired arm is less true: it tells in the tenth frame, with its three balls, and in a roll-off.</p>
  <p class="hint"><b>Nerve.</b> In a side's last frame, and more when the other side has finished and the game hangs on it, the meter falls quicker and the mark is smaller and shakes, less for a steady nerve. The CPU's bowlers feel it too.</p>`;
};
const wW114RenderHelp = renderHelp;
renderHelp = function () {
  wW114RenderHelp();
  const after = $('wHelpLanes'); if (!after || $('wHelpLanesTab')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpLanesTab"><b>Bowling ratings, the five and their order.</b> Every player also has bowling ratings: power, revs, accuracy, spare, nerve and read (1 to ${wBlCap()}), and a bowling hand. Each level adds a point, mostly to what their kind is good at; pick a player on the Stats tab to see them, or use its Bowling view. The Lanes tab on the Team screen sets your five and their order (the leadoff, the 2nd, 3rd and 4th, and the anchor). Every ball costs some arm, and a tired bowler's mark is smaller. In the last frame the meter falls quicker and the mark shakes, less for a steady nerve. Called-up players at your level fill the five when your roster is short. Practice game there plays your five against Saltmere's; nothing is won or lost.</p>`);
};
