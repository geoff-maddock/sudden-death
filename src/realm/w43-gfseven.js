/* w43: football ratings and the seven (issue #9, phase 3). Every Realm player has Cinder Gridiron ratings, p.gf, as
   they have baseball's p.bd (w20b): speed, strength, hands, arm, kicking and tackling, 1 to 12. They are seeded from
   the kind's football ratings (wGF.rate), each moved by up to 1, and every level above 1 adds a point to one of them,
   weighted by what the kind is good at. So a recruit who joins at level 5 has had 4 points, and an older save's
   players get theirs when it loads.
   The seven: football is seven a side, and the same seven play both ways (question 2). The Seven tab on the Team screen
   picks who plays and where, on offense and on defense; called-up players at your level fill any gap (a roster is up
   to eight, so one sits out once it is full). Left alone, positions are the coaches' pick from the ratings. Practice
   game plays your seven against the Cinderhold Football Club on the gridiron; nothing is won or lost.

   p.gf      { spd, str, hnd, arm, kck, tkl, lv, got: { stat: points from levels } }; lv is the level they've caught up to
   WG.seven  { ids: [7 keys: a roster id, or a call-up's cid], cu: [call-ups], seq, off: { pos: key }, def: { pos: key }, add?: [new ids],
               mine?: true once you've set a position (until then the coaches re-pick them whenever the seven changes) }
   wGfOf(p)          p's ratings, made or caught up first
   wSevenSync()      makes the seven, or brings it up to date with the roster; returns WG.seven
   wSevenTeam()      the seven as Cinder Gridiron takes a team (yours, with your positions)
   wSevenSetPos(key, side, pos), wSevenSit(key), wSevenPutIn(pid, key), wSevenAuto()   changes; each returns a
                     message for the player, or '' when it worked
   Wrapped: wMakePlayer (wW43MakePlayer), wGiveXp (wW43GiveXp), wStart (wW43Start), wAddPlayer (wW43AddPlayer),
   wStatsCard (wW43StatsCard: a Football block), wOpenCamp (wW43OpenCamp: the Seven tab), wRenderCamp (wW43RenderCamp),
   renderHelp (wW43RenderHelp: #wHelpSeven). */

const W_GFR = {
  cap: 12, side: 7, cuKinds: ['kobold', 'minotaur', 'dwarf', 'goblin', 'elf', 'harpy', 'troll'],
  stat: { spd: ['Spd', 'Speed: running, covering and chasing'], str: ['Str', 'Strength: blocking, shedding blocks and breaking tackles'],
    hnd: ['Hnd', 'Hands: catching'], arm: ['Arm', 'Arm: how far and how true the throw'], kck: ['Kck', 'Kicking: field goals and punts'], tkl: ['Tkl', 'Tackling'] },
  pos: { QB: 'quarterback', RB: 'running back', C: 'center', LG: 'left guard', RG: 'right guard', X: 'receiver (left)', Z: 'receiver (right)',
    DT: 'tackle', DL: 'left end', DR: 'right end', CL: 'left corner', CR: 'right corner', LB: 'linebacker', S: 'safety' },
};
const WSEVEN = { swap: null };

/* ---------- ratings ---------- */
function wGfOf(p) {
  if (!p || !p.kind) return null;
  if (!p.gf) { const r = wGF.rate(p.kind); p.gf = { lv: 1, got: {} }; for (const s of wGF.stats) p.gf[s] = Math.max(1, Math.min(W_GFR.cap, r[s] + Math.floor(Math.random() * 3) - 1)); }
  const g = p.gf, lvl = p.lvl || 1;
  while (g.lv < lvl) { g.lv++; const s = wGfGrowStat(p); if (s) { g[s]++; g.got[s] = (g.got[s] || 0) + 1; } }
  return g;
}
// a level's point: any rating below the cap, weighted by the kind's own, so a harpy gets quicker and an ogre stronger
function wGfGrowStat(p) {
  const K = wGF.rate(p.kind), open = wGF.stats.filter(s => p.gf[s] < W_GFR.cap);
  if (!open.length) return null;
  let r = Math.random() * open.reduce((a, s) => a + K[s], 0);
  for (const s of open) { r -= K[s]; if (r < 0) return s; }
  return open[open.length - 1];
}
function wGfAll() { if (!WG) return; for (const p of WG.roster || []) wGfOf(p); for (const p of WG.wwait || []) wGfOf(p); for (const c of (WG.seven && WG.seven.cu) || []) wGfOf(c); }

const wW43MakePlayer = wMakePlayer;
wMakePlayer = function (spec, from) { const p = wW43MakePlayer(spec, from); wGfOf(p); return p; };
const wW43GiveXp = wGiveXp;
wGiveXp = function (p, n) { const r = wW43GiveXp(p, n); wGfOf(p); return r; };
const wW43Start = wStart;
wStart = function (save, opts) { const r = wW43Start(save, opts); wGfAll(); if (save) wSave(); return r; };
// players who join go straight into the seven, as a call-up makes room
const wW43AddPlayer = wAddPlayer;
wAddPlayer = function (p) { const r = wW43AddPlayer(p); if (WG && WG.seven) WG.seven.add = (WG.seven.add || []).concat(p.id); return r; };

/* ---------- the seven ---------- */
function wSevenWho(k) {
  if (typeof k === 'string') return ((WG.seven && WG.seven.cu) || []).find(c => c.cid === k) || null;
  return wPlayer(k);
}
function wSevenCallUp() {
  const S = WG.seven, used = new Set(S.ids.map(k => (wSevenWho(k) || {}).kind));
  const kind = W_GFR.cuKinds.find(k => !used.has(k)) || pick(W_GFR.cuKinds);
  const taken = new Set(wRoster().map(p => p.n).concat(S.cu.map(c => c.n)));
  const names = (FA_NAMES[kind] || []).filter(n => !taken.has(n));
  const c = Object.assign(wMakePlayer({ kind, lvl: wNineTier(), n: names.length ? pick(names) : undefined }, 'callup'), { cid: 'g' + (S.seq++) });
  S.cu.push(c);
  return c;
}
// a position map is good when every position has a different one of the seven
function wSevenMapOk(m, pos, ids) { return !!m && pos.every(k => ids.includes(m[k])) && new Set(pos.map(k => m[k])).size === pos.length; }
// the coaches' positions for the seven, from the ratings
function wSevenAutoPos() {
  const S = WG.seven, a = wGF.auto(S.ids.map(k => wSevenPlayer(wSevenWho(k))));
  S.off = Object.fromEntries(Object.entries(a.off).map(([pos, i]) => [pos, S.ids[i]]));
  S.def = Object.fromEntries(Object.entries(a.def).map(([pos, i]) => [pos, S.ids[i]]));
}
function wSevenSync() {
  if (!WG) return null;
  let fresh = false;
  if (!WG.seven || !Array.isArray(WG.seven.ids)) { WG.seven = { ids: [], cu: [], seq: 1, off: null, def: null }; fresh = true; }
  const S = WG.seven, before = S.ids.join();
  S.ids = S.ids.filter((k, i) => wSevenWho(k) && S.ids.indexOf(k) === i);
  S.cu = S.cu.filter(c => S.ids.includes(c.cid));
  const tier = wNineTier();
  for (const c of S.cu) if (c.lvl < tier) { c.lvl = tier; wGfOf(c); }
  // your own players come first: everyone on a new seven, and anyone who joined since, in a call-up's place
  const want = wRoster().filter(p => !S.ids.includes(p.id) && (fresh || (S.add || []).includes(p.id)));
  for (const p of want) {
    if (S.ids.length < W_GFR.side) { S.ids.push(p.id); continue; }
    const cu = S.ids.find(k => typeof k === 'string'); if (!cu) break;
    S.ids[S.ids.indexOf(cu)] = p.id; S.cu = S.cu.filter(c => c.cid !== cu);
    for (const m of [S.off, S.def]) if (m) for (const pos in m) if (m[pos] === cu) m[pos] = p.id;
  }
  delete S.add;
  while (S.ids.length < W_GFR.side) S.ids.push(wSevenCallUp().cid);
  if ((S.ids.join() !== before && !S.mine) || !wSevenMapOk(S.off, wGF.offPos, S.ids) || !wSevenMapOk(S.def, wGF.defPos, S.ids)) wSevenAutoPos();
  return S;
}
// a player as Cinder Gridiron takes one
function wSevenPlayer(p) { return { n: p.n, kind: p.kind, num: p.num, r: Object.fromEntries(wGF.stats.map(s => [s, wGfOf(p)[s]])) }; }
function wSevenTeam() {
  const S = wSevenSync(), t = wPartyTeam(), ix = k => S.ids.indexOf(k);
  return { name: t.name, short: t.short, color: t.color, light: t.light, roster: S.ids.map(k => wSevenPlayer(wSevenWho(k))),
    off: Object.fromEntries(Object.entries(S.off).map(([pos, k]) => [pos, ix(k)])), def: Object.fromEntries(Object.entries(S.def).map(([pos, k]) => [pos, ix(k)])) };
}
// where a player plays: { off, def } positions
function wSevenPosOf(k) { const S = wSevenSync(), f = m => Object.keys(m).find(pos => m[pos] === k) || null; return { off: f(S.off), def: f(S.def) }; }
// the kicker is the seven's best boot
function wSevenKicker() { const S = wSevenSync(); return S.ids.reduce((b, k) => wGfOf(wSevenWho(k)).kck > wGfOf(wSevenWho(b)).kck ? k : b, S.ids[0]); }

/* ---------- changes ---------- */
function wSevenDone() { wSave(); return ''; }
// put k at pos on one side; whoever was there takes k's old place
function wSevenSetPos(k, side, pos) {
  const S = wSevenSync(), m = side === 'def' ? S.def : S.off, list = side === 'def' ? wGF.defPos : wGF.offPos;
  if (!S.ids.includes(k) || !list.includes(pos)) return '';
  const was = Object.keys(m).find(x => m[x] === k); if (was === pos) return '';
  const other = m[pos]; m[pos] = k; if (was) m[was] = other;
  S.mine = true;
  return wSevenDone();
}
// a roster player sits out; a call-up takes their places
function wSevenSit(k) {
  const S = wSevenSync(), p = wSevenWho(k);
  if (!p || typeof k === 'string' || !S.ids.includes(k)) return '';
  const c = wSevenCallUp();
  S.ids[S.ids.indexOf(k)] = c.cid;
  for (const m of [S.off, S.def]) for (const pos in m) if (m[pos] === k) m[pos] = c.cid;
  if (!S.mine) wSevenAutoPos();
  wSave();
  return `${p.n} sits out; ${c.n} is called up in their place.`;
}
// a roster player sitting out takes k's place, both ways
function wSevenPutIn(pid, k) {
  const S = wSevenSync(), p = wPlayer(pid);
  if (!p || S.ids.includes(pid) || !S.ids.includes(k)) return '';
  S.ids[S.ids.indexOf(k)] = pid;
  if (typeof k === 'string') S.cu = S.cu.filter(c => c.cid !== k);
  for (const m of [S.off, S.def]) for (const pos in m) if (m[pos] === k) m[pos] = pid;
  if (!S.mine) wSevenAutoPos();
  return wSevenDone();
}
function wSevenAuto() { WG.seven = null; wSevenSync(); return wSevenDone(); }
// a practice game: your seven against the Cinderhold Football Club, nothing riding on it
function wSevenPractice() {
  const home = wGridTeams()[0];
  if (WCAMP.close) WCAMP.close();
  wGridironGame({ mode: 'call', teams: [wSevenTeam(), home] });
}

/* ---------- the Football block on a player's stats ---------- */
function wGfCard(p) {
  const g = wGfOf(p); if (!g) return '';
  const bars = wGF.stats.map(s => { const [ab, what] = W_GFR.stat[s], got = g.got[s] || 0;
    return `<div class="wbdr" title="${esc(what)}"><span>${ab}</span><i><em style="width:${Math.round(100 * g[s] / W_GFR.cap)}%"></em></i><b>${g[s]}</b><small>${got ? `+${got}` : ''}</small></div>`; }).join('');
  const k = p.cid || p.id, S = WG && WG.seven, inS = S && S.ids.includes(k), at = inS ? wSevenPosOf(k) : null;
  return `<div class="wbd wgfc"><h5>Football</h5><p class="wbdpos">${inS ? `In your seven: ${esc(W_GFR.pos[at.off])} on offense, ${esc(W_GFR.pos[at.def])} on defense.` : 'Not in your seven.'}</p>
    <div class="wbdbars">${bars}</div><p class="hint">Each level adds a point to one rating (shown as +). Ratings run from 1 to ${W_GFR.cap}.</p></div>`;
}
const wW43StatsCard = wStatsCard;
wStatsCard = function (p) { return wW43StatsCard(p).replace(/<\/section>\s*$/, wGfCard(p) + '</section>'); };

/* ---------- the Seven tab ---------- */
function wSevenRow(k, out) {
  const p = wSevenWho(k), g = wGfOf(p), cu = typeof k === 'string', key = esc(String(k)), at = wSevenPosOf(k), kick = wSevenKicker() === k;
  const sel = (side, list, cur) => `<select data-gpos="${side}" aria-label="${esc(p.n)}'s ${side === 'off' ? 'offense' : 'defense'} position">${list.map(pos => `<option value="${pos}"${pos === cur ? ' selected' : ''}>${pos}: ${esc(W_GFR.pos[pos])}</option>`).join('')}</select>`;
  const swapping = WSEVEN.swap === String(k);
  return `<li class="wpr wnr wsvr${cu ? ' wcu' : ''}" data-gid="${key}">
    <span class="wno">${esc(at.off)}</span><img src="${wPlayerPort(p, 64)}" alt="">
    <div class="wpi"><div class="wpn"><b>${esc(p.n)}</b><span class="k">${esc(wKindName(p.kind))}, level ${p.lvl}${kick ? ', the kicker' : ''}</span>${cu ? '<span class="wtag wb">Call-up</span>' : ''}</div>
      <small class="wnst">${wGF.stats.map(s => `${W_GFR.stat[s][0]} <b>${g[s]}</b>`).join(' ')}</small></div>
    <div class="wpa"><label class="wsvl">Offense ${sel('off', wGF.offPos, at.off)}</label><label class="wsvl">Defense ${sel('def', wGF.defPos, at.def)}</label>
      ${cu ? `<button class="ghost" data-gswap aria-expanded="${swapping}" ${out.length ? '' : 'disabled title="Your whole team is playing"'}>Replace</button>` : `<button class="ghost" data-gsit>Sit out</button>`}</div>
    ${swapping ? `<div class="wswap"><span>Put in for ${esc(p.n)}:</span>${out.map(q => `<button class="ghost" data-gin="${q.id}">${esc(q.n)} <small>${esc(wKindName(q.kind))}</small></button>`).join('')}</div>` : ''}
  </li>`;
}
function wCampSeven() {
  const S = wSevenSync(), out = wRoster().filter(p => !S.ids.includes(p.id));
  const order = S.ids.slice().sort((a, b) => wGF.offPos.indexOf(wSevenPosOf(a).off) - wGF.offPos.indexOf(wSevenPosOf(b).off));
  return `<p class="hint">Your football seven. The same seven play offense and defense, so each has a place on both. Change a position and whoever had it swaps with them; until you do, the coaches pick the positions again whenever the seven changes. Called-up players at your level fill any gap. The best kicker kicks. The coaches' pick puts the best arm at quarterback, the strongest on the line, and the fastest at corner.</p>
    <ol class="wroster wnine wseven">${order.map(k => wSevenRow(k, out)).join('')}</ol>
    ${out.length ? `<h4>Sitting out</h4><p class="hint">${out.map(p => `${esc(p.n)} (${esc(wKindName(p.kind))})`).join(', ')}. Use Replace on a call-up to put them in.</p>` : ''}
    <div class="row wnbtn"><button class="ghost" data-gauto>The coaches' pick</button><button class="btn" data-gpractice>Practice game</button></div>`;
}

const wW43OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  wW43OpenCamp(want === 'seven' ? 'team' : tab);
  WSEVEN.swap = null;
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="seven"]')) return;
  tabs.lastElementChild.insertAdjacentHTML('afterend', '<button role="tab" data-ctab="seven">Seven</button>');
  tabs.querySelector('[data-ctab="seven"]').onclick = () => { WCAMP.tab = 'seven'; WCAMP.swap = null; WCAMP.msg = ''; WSEVEN.swap = null; wRenderCamp(); };
  if (want === 'seven') { WCAMP.tab = 'seven'; wRenderCamp(); }
};
const wW43RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'seven') return wW43RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="seven"]')) { WCAMP.tab = 'team'; return wRenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'seven'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  body.innerHTML = `<div class="wcsum"><span>Players <b>${wRoster().length}/${W_PARTY.max}</b></span><span>Call-ups <b>${wSevenSync().cu.length}</b> at level ${wNineTier()}</span></div>
    ${WCAMP.msg ? `<p class="wbad wcmsg" role="alert">${esc(WCAMP.msg)}</p>` : ''}` + wCampSeven();
  const keyOf = el => { const k = el.closest('[data-gid]').dataset.gid; return /^g\d+$/.test(k) ? k : +k; };
  const say = m => { WSEVEN.swap = null; wCampSay(m); };
  body.querySelectorAll('[data-gpos]').forEach(s => s.onchange = () => say(wSevenSetPos(keyOf(s), s.dataset.gpos, s.value)));
  body.querySelectorAll('[data-gsit]').forEach(b => b.onclick = () => say(wSevenSit(keyOf(b))));
  body.querySelectorAll('[data-gswap]').forEach(b => b.onclick = () => { const k = String(keyOf(b)); WSEVEN.swap = WSEVEN.swap === k ? null : k; wCampSay(''); });
  body.querySelectorAll('[data-gin]').forEach(b => b.onclick = () => say(wSevenPutIn(+b.dataset.gin, keyOf(b))));
  const auto = body.querySelector('[data-gauto]'); if (auto) auto.onclick = () => say(wSevenAuto());
  const pr = body.querySelector('[data-gpractice]'); if (pr) pr.onclick = () => wSevenPractice();
};

const wW43RenderHelp = renderHelp;
renderHelp = function () {
  wW43RenderHelp();
  const after = $('wHelpNine') || $('wHelpGridiron'); if (!after || $('wHelpSeven')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpSeven"><b>Football ratings and the seven.</b> Every player also has football ratings: speed, strength, hands, arm, kicking and tackling (1 to ${W_GFR.cap}). Each level adds a point, mostly to what their kind is good at; pick a player on the Stats tab to see them. Football is seven a side, and the same seven play offense and defense. The Seven tab on the Team screen picks who plays and where on both sides; called-up players at your level fill any gap. Practice game there plays your seven against the Cinderhold Football Club; nothing is won or lost.</p>`);
};
