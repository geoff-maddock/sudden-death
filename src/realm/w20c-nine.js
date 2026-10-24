/* w20c: the nine (issue #4, phase 3). A baseball team needs nine players at nine positions; the Realm roster is up to
   eight. So every player on the roster takes a position (their own if it is free), and generated call-ups at your
   level fill the rest. A new player takes a call-up's place; a released one leaves a gap a call-up fills. Only a
   player with pitches can take the mound (Brimstone Diamond's rule), so most teams start with a called-up pitcher.
   Out of position a player fields 2 worse, as in Brimstone Diamond. A Nine tab on the Team screen sets the batting
   order and the positions; Watch them play runs an exhibition with your nine.

   WG.nine  { order: [{ id, pos }] (the batting order: a roster id, or a call-up's cid), cu: [call-ups], seq, add?: [new ids] }
            a call-up is a player made by wMakePlayer (so it has p.bd) with cid 'c<n>' instead of an id
   wNineSync()       makes the nine, or brings it up to date with the roster; returns WG.nine
   wNineDef()        the nine as a Brimstone Diamond team (phase 4 plays it), with your pitchers who sit out in the pen
   wNineProblems()   what stops the nine taking the field, as sentences (empty when it can play)
   wNineMove(id, i), wNineSetPos(id, pos), wNineSit(id), wNinePutIn(pid, id), wNineAuto()   changes; each returns a
                     message for the player, or '' when it worked
   Wrapped: wOpenCamp (wW20OpenCamp: the Nine tab), wRenderCamp (wW20RenderCamp), renderHelp (wW20cRenderHelp). */

const W_NINE = { pos: ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P'], offField: 2 };
const WNINE = { swap: null };

function wNineKey(id) { return String(id); }
function wNineWho(id) {
  if (typeof id === 'string') return ((WG.nine && WG.nine.cu) || []).find(c => c.cid === id) || null;
  return wPlayer(id);
}
function wNineCanPitch(p) { const b = wBdOf(p); return !!(b && b.pitches && b.pitches.length); }
// call-ups play at your level: the roster's average, rounded down
function wNineTier() { const R = wRoster(); return R.length ? Math.max(1, Math.floor(R.reduce((a, p) => a + (p.lvl || 1), 0) / R.length)) : 1; }
function wNineCallUp(pos) {
  const N = WG.nine, used = new Set(N.order.map(r => (wNineWho(r.id) || {}).kind));
  const kinds = wBD.kindsAt(pos), kind = kinds.find(k => !used.has(k)) || pick(kinds);
  const taken = new Set(wRoster().map(p => p.n).concat(N.cu.map(c => c.n)));
  const names = (FA_NAMES[kind] || []).filter(n => !taken.has(n));
  const c = Object.assign(wMakePlayer({ kind, lvl: wNineTier(), n: names.length ? pick(names) : undefined }, 'callup'), { cid: 'c' + (N.seq++) });
  N.cu.push(c);
  return c;
}
// top of the order: the two quickest contact hitters; then power; the pitcher bats last
function wNineSortOrder() {
  const N = WG.nine, b = r => wBdOf(wNineWho(r.id));
  const field = N.order.filter(r => r.pos !== 'P'), P = N.order.filter(r => r.pos === 'P');
  const lead = field.slice().sort((x, y) => (b(y).spd + b(y).con) - (b(x).spd + b(x).con)).slice(0, 2);
  const rest = field.filter(r => !lead.includes(r)).sort((x, y) => b(y).pow - b(x).pow);
  N.order = [...lead, ...rest, ...P];
}

function wNineSync() {
  if (!WG) return null;
  let fresh = false;
  if (!WG.nine || !Array.isArray(WG.nine.order)) { WG.nine = { order: [], cu: [], seq: 1 }; fresh = true; }
  const N = WG.nine;
  // drop anyone who has left, and any second player at a position
  const seen = new Set();
  N.order = N.order.filter(r => { if (!wNineWho(r.id) || seen.has(r.pos) || !W_NINE.pos.includes(r.pos)) return false; seen.add(r.pos); return true; });
  N.cu = N.cu.filter(c => N.order.some(r => r.id === c.cid));
  // call-ups keep up with the team
  const tier = wNineTier();
  for (const c of N.cu) if (c.lvl < tier) { c.lvl = tier; wBdOf(c); }
  // roster players sitting out take a call-up's place: their own position first, then any spot they can play
  const inNine = new Set(N.order.map(r => wNineKey(r.id)));
  const out = wRoster().filter(p => !inNine.has(wNineKey(p.id)) && (fresh || (N.add || []).includes(p.id)));
  const held = pos => N.order.find(r => r.pos === pos);
  const take = (p, pos) => {
    const r = held(pos);
    if (r && typeof r.id !== 'string') return false;
    if (pos === 'P' && !wNineCanPitch(p)) return false;
    if (r) { N.cu = N.cu.filter(c => c.cid !== r.id); r.id = p.id; } else N.order.push({ id: p.id, pos });
    return true;
  };
  const left = out.filter(p => !take(p, wBdOf(p).pos));
  for (const p of left) W_NINE.pos.some(pos => take(p, pos));
  delete N.add;
  // call-ups for every position nobody holds
  for (const pos of W_NINE.pos) if (!held(pos)) N.order.push({ id: wNineCallUp(pos).cid, pos });
  if (fresh) wNineSortOrder();
  return N;
}
// players who joined since you last set the nine go straight into it, as call-ups make room
const wW20cAddPlayer = wAddPlayer;
wAddPlayer = function (p) { const r = wW20cAddPlayer(p); if (WG && WG.nine) WG.nine.add = (WG.nine.add || []).concat(p.id); return r; };

function wNineProblems() {
  const N = wNineSync(), probs = [];
  for (const pos of W_NINE.pos) if (!N.order.some(r => r.pos === pos)) probs.push(`Nobody is playing ${W_BDR.pos[pos]}.`);
  const P = N.order.find(r => r.pos === 'P'), pw = P && wNineWho(P.id);
  if (pw && !wNineCanPitch(pw)) probs.push(`${pw.n} has no pitches and can't take the mound.`);
  return probs;
}
/* a player as Brimstone Diamond's game wants them; out of position they field worse */
function wNineBdPlayer(p, pos) {
  const b = wBdOf(p);
  const g = { n: p.n, kind: p.kind, race: wKindName(p.kind), pos, num: p.num, hand: b.hand, wpn: b.wpn, bat: b.bat, run: b.run, field: b.field,
    pitches: b.pitches ? b.pitches.slice() : null, ult: b.ult, flav: p.flav, lvl: p.lvl, tiers: { bat: 1, run: 1, field: 1, pitch: 1 },
    rid: p.cid || p.id };
  for (const s of wBD.stats) g[s] = b[s];
  if (pos !== 'RP' && pos !== b.pos) g.fld = Math.max(1, g.fld - W_NINE.offField);
  return g;
}
function wNineDef() {
  const N = wNineSync(), t = wPartyTeam();
  const roster = N.order.map(r => wNineBdPlayer(wNineWho(r.id), r.pos));
  const pen = wRoster().filter(p => !N.order.some(r => r.id === p.id) && wNineCanPitch(p)).map(p => wNineBdPlayer(p, 'RP'));
  return { id: 'realm', name: t.name, short: t.short, color: t.color, trim: t.dark, light: t.light, motto: t.motto, roster, pen };
}

/* ---------- changes ---------- */
function wNineDone() { wSave(); return ''; }
function wNineMove(id, to) {
  const N = wNineSync(), i = N.order.findIndex(r => r.id === id);
  if (i < 0 || to < 0 || to >= N.order.length) return '';
  const [r] = N.order.splice(i, 1); N.order.splice(to, 0, r);
  return wNineDone();
}
function wNineSetPos(id, pos) {
  const N = wNineSync(), r = N.order.find(x => x.id === id), p = wNineWho(id);
  if (!r || !p || r.pos === pos || !W_NINE.pos.includes(pos)) return '';
  const o = N.order.find(x => x.pos === pos), q = o && wNineWho(o.id);
  if (pos === 'P' && !wNineCanPitch(p)) return `${p.n} has no pitches, so can't pitch.`;
  if (o && r.pos === 'P' && !wNineCanPitch(q)) return `${q.n} has no pitches, so can't take ${p.n}'s place on the mound.`;
  if (o) o.pos = r.pos;
  r.pos = pos;
  return wNineDone();
}
// a roster player sits out; a call-up takes their spot in the order
function wNineSit(id) {
  const N = wNineSync(), r = N.order.find(x => x.id === id), p = wNineWho(id);
  if (!r || !p || typeof id === 'string') return '';
  const c = wNineCallUp(r.pos); r.id = c.cid;
  wSave();
  return `${p.n} sits out; ${c.n} is called up to play ${W_BDR.pos[r.pos]}.`;
}
// a roster player who sits out takes id's spot (and position)
function wNinePutIn(pid, id) {
  const N = wNineSync(), r = N.order.find(x => x.id === id), p = wPlayer(pid);
  if (!r || !p || N.order.some(x => x.id === pid)) return '';
  if (r.pos === 'P' && !wNineCanPitch(p)) return `${p.n} has no pitches, so can't pitch.`;
  if (typeof r.id === 'string') N.cu = N.cu.filter(c => c.cid !== r.id);
  r.id = pid;
  return wNineDone();
}
function wNineAuto() { WG.nine = null; wNineSync(); return wNineDone(); }
function wNineWatch() {
  if (wNineProblems().length) return;
  const opp = pick(wBD.teams().filter(id => id === 'ironmaw' || id === 'mirewood'));
  WCAMP.close();
  wDiamondExhibition({ defs: [wNineDef(), wBD.club(opp, W_DIAMOND.innings)] });
}

/* ---------- the Nine tab ---------- */
function wNineStats(p, pos) {
  const b = wBdOf(p), off = pos !== b.pos;
  return `<small class="wnst">${wBD.stats.map(s => `${W_BDR.stat[s][0]} <b>${s === 'fld' && off ? Math.max(1, b.fld - W_NINE.offField) : b[s]}</b>`).join(' ')}${off ? ` <em class="wbad">out of position: FLD &minus;${W_NINE.offField}</em>` : ''}</small>`;
}
function wNineRow(r, i, n, out) {
  const p = wNineWho(r.id), b = wBdOf(p), cu = typeof r.id === 'string', key = esc(wNineKey(r.id)), swapping = WNINE.swap === wNineKey(r.id);
  const opts = W_NINE.pos.map(pos => `<option value="${pos}"${pos === r.pos ? ' selected' : ''}${pos === 'P' && !wNineCanPitch(p) ? ' disabled' : ''}>${pos}</option>`).join('');
  return `<li class="wpr wnr${cu ? ' wcu' : ''}" data-nid="${key}">
    <span class="wno">${i + 1}</span><img src="${wPlayerPort(p, 64)}" alt="">
    <div class="wpi"><div class="wpn"><b>${esc(p.n)}</b><span class="k">${esc(wKindName(p.kind))}, level ${p.lvl}, plays ${esc(W_BDR.pos[b.pos])}</span>${cu ? '<span class="wtag wb">Call-up</span>' : ''}</div>
      ${wNineStats(p, r.pos)}</div>
    <div class="wpa"><select data-npos aria-label="${esc(p.n)}'s position">${opts}</select>
      <button class="ghost" data-nup aria-label="Bat ${esc(p.n)} earlier" ${i === 0 ? 'disabled' : ''}>&#9650;</button><button class="ghost" data-ndn aria-label="Bat ${esc(p.n)} later" ${i === n - 1 ? 'disabled' : ''}>&#9660;</button>
      ${cu ? `<button class="ghost" data-nswap aria-expanded="${swapping}" ${out.length ? '' : 'disabled title="Your whole team is playing"'}>Replace</button>` : `<button class="ghost" data-nsit>Sit out</button>`}</div>
    ${swapping ? `<div class="wswap"><span>Put in for ${esc(p.n)}:</span>${out.map(q => `<button class="ghost" data-nin="${q.id}">${esc(q.n)} <small>${esc(wKindName(q.kind))}</small></button>`).join('')}</div>` : ''}
  </li>`;
}
function wCampNine() {
  const N = wNineSync(), probs = wNineProblems();
  const out = wRoster().filter(p => !N.order.some(r => r.id === p.id));
  return `<p class="hint">Your baseball nine: the batting order, top to bottom, and each player's position. Your players fill the spots they can; called-up players at your level fill the rest. Only a player with pitches can pitch. Out of position, a player fields ${W_NINE.offField} worse.</p>
    ${probs.length ? `<p class="wbad" role="alert">${probs.map(esc).join(' ')}</p>` : ''}
    <ol class="wroster wnine">${N.order.map((r, i) => wNineRow(r, i, N.order.length, out)).join('')}</ol>
    ${out.length ? `<h4>Sitting out</h4><p class="hint">${out.map(p => `${esc(p.n)} (${esc(wKindName(p.kind))}, plays ${esc(W_BDR.pos[wBdOf(p).pos])}${wNineCanPitch(p) ? ', in the bullpen' : ''})`).join(', ')}. Use Replace on a call-up to put them in.</p>` : ''}
    <div class="row wnbtn"><button class="ghost" data-nauto>Reset the nine</button><button class="btn" data-nwatch ${probs.length ? 'disabled' : ''}>Watch them play</button></div>`;
}

const wW20OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  wW20OpenCamp(want === 'nine' ? 'team' : tab);
  WNINE.swap = null;
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="nine"]')) return;
  tabs.lastElementChild.insertAdjacentHTML('afterend', '<button role="tab" data-ctab="nine">Nine</button>');
  tabs.querySelector('[data-ctab="nine"]').onclick = () => { WCAMP.tab = 'nine'; WCAMP.swap = null; WCAMP.msg = ''; WNINE.swap = null; wRenderCamp(); };
  if (want === 'nine') { WCAMP.tab = 'nine'; wRenderCamp(); }
};
const wW20RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'nine') return wW20RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="nine"]')) { WCAMP.tab = 'team'; return wRenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'nine'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  body.innerHTML = `<div class="wcsum"><span>Players <b>${wRoster().length}/${W_PARTY.max}</b></span><span>Call-ups <b>${wNineSync().cu.length}</b> at level ${wNineTier()}</span></div>
    ${WCAMP.msg ? `<p class="wbad wcmsg" role="alert">${esc(WCAMP.msg)}</p>` : ''}` + wCampNine();
  const idOf = el => { const k = el.closest('[data-nid]').dataset.nid; return /^c\d+$/.test(k) ? k : +k; };
  const say = m => { WNINE.swap = null; wCampSay(m); };
  const N = WG.nine, at = id => N.order.findIndex(r => r.id === id);
  body.querySelectorAll('[data-npos]').forEach(s => s.onchange = () => say(wNineSetPos(idOf(s), s.value)));
  body.querySelectorAll('[data-nup]').forEach(b => b.onclick = () => { const id = idOf(b); say(wNineMove(id, at(id) - 1)); });
  body.querySelectorAll('[data-ndn]').forEach(b => b.onclick = () => { const id = idOf(b); say(wNineMove(id, at(id) + 1)); });
  body.querySelectorAll('[data-nsit]').forEach(b => b.onclick = () => say(wNineSit(idOf(b))));
  body.querySelectorAll('[data-nswap]').forEach(b => b.onclick = () => { const k = wNineKey(idOf(b)); WNINE.swap = WNINE.swap === k ? null : k; wCampSay(''); });
  body.querySelectorAll('[data-nin]').forEach(b => b.onclick = () => say(wNinePutIn(+b.dataset.nin, idOf(b))));
  const auto = body.querySelector('[data-nauto]'); if (auto) auto.onclick = () => say(wNineAuto());
  const w = body.querySelector('[data-nwatch]'); if (w) w.onclick = () => wNineWatch();
};

const wW20cRenderHelp = renderHelp;
renderHelp = function () {
  wW20cRenderHelp();
  const bb = $('wHelpBaseball'); if (!bb || $('wHelpNine')) return;
  bb.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpNine"><b>The nine.</b> A baseball team needs nine players. The Nine tab on the Team screen sets the batting order and positions. Your players fill the spots they can, and called-up players at your level fill the rest. Only players with pitches can pitch, so most teams start with a called-up pitcher. Out of position, a player fields ${W_NINE.offField} worse.</p>`);
};
