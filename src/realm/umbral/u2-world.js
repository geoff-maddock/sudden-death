/* u2: the Umbral world (issue #99, phase 2). Loads after u1-event.js; changes earlier parts only by reassignment (saved
   originals carry the wWU2 prefix).

   All five regions and six towns, transformed. The dark towns (W_UMB2.towns): Gravesbury, Mossgrave, Saltmourn,
   Cindergrave, Rimewake and the Hollow Coliseum, built from the light ones by u0's transform and then:
     mirrored    left for right: every building, street and person on the other side of town from where it was
     the counters and the signs stay (W_UMB2.keep); every sign's words gone wrong (wUmbWrong: a sign's name spelt
                 backwards, a longer one with one word turned)
     the people  each is their own dark double (wUmbDouble: DB.chars['u_' + id]): the same kind, the name misspelt,
                 every line with one word wrong; nothing they say gives, takes, sets or opens anything, except that a
                 shopkeeper keeps a dark shop and an innkeeper turns you away
   The dark towns build in their light towns' stone, drained and darkened (W_STYLE['u' + style]).
   The dark shops (wUmbShop) sell what the light shop sells, for fans or a player's XP (only XP toward their next
   level, so nobody loses a level), never gold.
   No inns: one lantern per region on the dark world (W_UMB2.lantern, the tile '¤'), beside the region's town. Rest by
   one (wUmbLantern): your team back to full, the night passed, the game saved, and you wake there after a blackout on
   this side (WG.umbral.lantern). Before any lantern, you wake by the dark road's portal.
   Each dark town has its own lines as you walk it (W_UMB2.ambient). The dark world's map (M) is its own, with its own
   fog (WG.fogs['u:world']) and the dark towns' names.
   The audit walks every dark map: every person, sign and lantern can be reached, and every place on the dark world.

   W_UMB2, wUmbWrong, wUmbDouble, wUmbShop, wUmbLantern
   Wraps: wUmbralMap (wWU2UmbralMap: the towns' counters, signs, doubles, the mirror), buildAllMaps (wWU2BuildAllMaps:
   the lanterns), wRunAct (wWU2RunAct: the dark shop), wUse (wWU2Use: a lantern), wBlackout (wWU2Blackout: waking on
   this side), wAmbient (wWU2Ambient: the dark towns' lines), wMapRevealHere (wWU2MapRevealHere: the dark fog),
   wMapHere (wWU2MapHere), wMapDraw (wWU2MapDraw: the dark world's map), wMapSeenCount (wWU2MapSeenCount), wAudit
   (wWU2Audit: the dark maps walked). */

const W_UMB2 = {
  towns: ['graftonbury', 'mossgate', 'saltmere', 'cinderhold', 'rimewatch', 'coliseum'],
  names: { graftonbury: 'Gravesbury', mossgate: 'Mossgrave', saltmere: 'Saltmourn', cinderhold: 'Cindergrave', rimewatch: 'Rimewake', coliseum: 'The Hollow Coliseum' },
  keep: ['counter', 'sign'],
  // a lantern for each region, beside its town on the dark world
  lantern: { plains: 'graftonbury', bloom: 'mossgate', tide: 'saltmere', ember: 'cinderhold', rime: 'rimewatch' },
  ch: '¤',
  // a dark shop's prices: a third of the gold price in fans, or twice it in XP
  fans: 1 / 3, xp: 2,
  // one word turned, either way: never a CAPITALISED one (keywords stay keywords)
  turn: [['light', 'dark'], ['day', 'night'], ['warm', 'cold'], ['good', 'bad'], ['always', 'never'], ['north', 'south'], ['east', 'west'], ['first', 'last'], ['open', 'shut'], ['win', 'lose'], ['won', 'lost'], ['welcome', 'unwelcome'], ['morning', 'evening'], ['alive', 'dead'], ['up', 'down'], ['left', 'right'], ['early', 'late'], ['full', 'empty'], ['safe', 'unsafe'], ['help', 'hinder'], ['friend', 'stranger'], ['yes', 'no'], ['more', 'less'], ['best', 'worst']],
  // what is wrong about a line with no word to turn
  after: ['Behind you, something agrees.', 'They say it twice, the second time slower.', 'They smile a moment too late.', 'Their shadow does not move when they do.', 'Nobody blinks.', 'Their eyes stay on the north road the whole time.', 'They are standing where they were not a moment ago.'],
  ambient: {
    all: ['A window you passed a moment ago is bricked up now.', 'Somebody laughs in an empty street.', 'Your shadow is a step behind you.', 'The bells ring thirteen.'],
    graftonbury: ['The League office has no door. There are voices inside.', 'A clerk sweeps the same cobble, over and over.'],
    mossgate: ['The trees lean in to listen.', 'The apiary is silent. The bees are all watching you.'],
    saltmere: ['The tide comes in without a sound.', 'The boats are moored keel up.'],
    cinderhold: ['The forges burn cold and black.', 'Hammers ring, and nobody is holding them.'],
    rimewatch: ['The snowmen have turned to face you.', 'The abbey bell rings once, very far away.'],
    coliseum: ['The stands are full, and nobody moves.', 'Somewhere a crowd is cheering for someone else.'],
  },
};
W_UMB.maps.push(...W_UMB2.towns);
Object.assign(W_UMB.names, W_UMB2.names);
// each dark town builds in its light town's stone, drained and darkened (W_STYLE['u' + style])
for (const sid of Object.keys(W_STYLE)) { const S0 = W_STYLE[sid], o = {}; for (const k in S0) o[k] = Array.isArray(S0[k]) ? S0[k].map(c => wUmbCol(c, .55)) : (k === 'face' || k === 'cap') ? S0[k] : wUmbCol(S0[k], .55); W_STYLE['u' + sid] = o; }
for (const id of W_UMB2.towns) if (W_PLACE_STYLE[id]) W_PLACE_STYLE['u:' + id] = 'u' + W_PLACE_STYLE[id];
DB.tiles[W_UMB2.ch] = { name: 'lantern', walk: 0, use: 'lantern', look: 'An iron lantern on a pole, burning with a cold violet flame. The dark keeps its distance from it.' };
W_MAP_COL[W_UMB2.ch] = '#b38cf0';

/* ---------- words gone wrong ---------- */
function wUmbHash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function wUmbWrong(text) {
  if (!text) return text;
  // a sign's short name (INN, LEAGUE OFFICE): spelt backwards
  if (text.length <= 24 && text === text.toUpperCase()) return text.split(' ').map(w => w.split('').reverse().join('')).join(' ');
  const hits = [];
  for (const [a, b] of W_UMB2.turn) for (const [w, to] of [[a, b], [b, a]]) {
    const re = new RegExp('\\b' + w + '\\b', 'gi'); let m;
    while ((m = re.exec(text))) { if (m[0] === m[0].toUpperCase() && m[0].length > 1) continue; hits.push([m.index, m[0], to]); }
  }
  if (!hits.length) return text + ' ' + W_UMB2.after[wUmbHash(text) % W_UMB2.after.length];
  hits.sort((x, y) => x[0] - y[0]);
  const [i, w, to] = hits[wUmbHash(text) % hits.length], out = w[0] === w[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to;
  return text.slice(0, i) + out + text.slice(i + w.length);
}
// a name misspelt: two letters of its longest word swapped
function wUmbMisspell(name) {
  const ws = name.split(' '), k = ws.reduce((b, w, i) => w.length > ws[b].length ? i : b, 0), w = ws[k];
  if (w.length < 4) return name + 'e';
  let i = 1; while (i < w.length - 2 && w[i] === w[i + 1]) i++;
  ws[k] = w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
  return ws.join(' ');
}

/* ---------- the doubles ---------- */
function wUmbDouble(id) {
  const ch = DB.chars[id]; if (!ch) return null;
  const did = 'u_' + id; if (DB.chars[did]) return did;
  const topics = {}, acts = (ch.topics ? Object.values(ch.topics) : []).map(t => t.act);
  for (const k in ch.topics || {}) {
    const t = ch.topics[k], d = { t: wUmbWrong(t.t) };
    if (t.need) { d.need = t.need; d.needNo = wUmbWrong(t.needNo || 'Not yet.'); }
    if (t.needNight) d.needNight = 1;
    if (t.act === 'shop') { d.t = 'I sell. Not for gold. Gold is no good here. Fans, or what your players have learned.'; d.act = 'ushop'; }
    else if (t.act === 'inn') d.t = 'Sleep? Not here. Nobody sleeps here. Find a LANTERN if you want to rest.';
    else if (t.act && /^cup/.test(t.act)) d.t = 'No cups here. Not any more. Not for you.';
    topics[k] = d;
  }
  if (acts.includes('inn') && !topics.lantern) topics.lantern = { t: 'There is one burning outside town. The dark does not go near it. Rest there, if you can bear the quiet.' };
  DB.chars[did] = { name: wUmbMisspell(ch.name), kind: ch.kind, look: ch.look, shop: ch.shop, greet: wUmbWrong(ch.greet || '...'), topics, double: id };
  return did;
}

/* ---------- the dark towns ---------- */
function wUmbMirror(u) {
  const W = u.w, fx = x => W - 1 - x, meta = {};
  u.t = u.t.map(r => r.slice().reverse());
  for (const k in u.meta) { const [x, y] = k.split(',').map(Number); meta[fx(x) + ',' + y] = u.meta[k]; }
  u.meta = meta;
  for (const n of u.npcs) n.x = fx(n.x);
  u.spawn = [fx(u.spawn[0]), u.spawn[1]];
  u.light = u.light.map(l => [fx(l[0]), l[1]].concat(l.slice(2)));
  u.blds = (u.blds || []).map(([bx, by, bw, bh]) => [W - bx - bw, by, bw, bh]);
  return u;
}
const wWU2UmbralMap = wUmbralMap;
wUmbralMap = function (m) {
  const u = wWU2UmbralMap.apply(this, arguments);
  if (!W_UMB2.towns.includes(m.id)) return u;
  // the counters and signs come back (the transform takes every use away), the signs' words gone wrong
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = m.t[y][x], td = DB.tiles[c] || {};
    if (!W_UMB2.keep.includes(td.use)) continue;
    u.t[y][x] = c;
    const mt = m.meta[x + ',' + y];
    if (td.use === 'sign' && mt) u.meta[x + ',' + y] = Object.assign({}, mt, { text: wUmbWrong(mt.text || '...') });
  }
  u.npcs = m.npcs.map(n => { const id = wUmbDouble(n.id); return id && { id, x: n.x, y: n.y, fixed: !!n.fixed }; }).filter(Boolean);
  u.light = (m.light || []).map(l => l.slice());
  wUmbMirror(u);
  wSettleSpawn(u);
  return u;
};

/* ---------- the dark shops ---------- */
const wUmbFans = g => Math.max(1, Math.ceil(g * W_UMB2.fans));
const wUmbXp = g => Math.max(1, Math.ceil(g * W_UMB2.xp));
// the player with the most XP toward their next level
const wUmbXpPlayer = () => wRoster().filter(p => p.lvl < W_PARTY.maxLvl).sort((a, b) => (b.xp || 0) - (a.xp || 0))[0] || null;
function wUmbBuy(shop, k, how) {
  const g = (DB.shops[shop] || {})[k], it = DB.items[k]; if (!g || !it) return 'Not sold here.';
  if (how === 'fans') { const n = wUmbFans(g); if ((RUN.fans || 0) < n) return `It costs ${n} fans.`; RUN.fans -= n; wLog(`You pay ${n} fans for a ${it.name}. Somewhere, people forget they ever cheered for you.`, 'd'); }
  else { const n = wUmbXp(g), p = wUmbXpPlayer(); if (!p || (p.xp || 0) < n) return `It costs ${n} XP from one player, and nobody has that much toward their next level.`; p.xp -= n; wLog(`${p.n} pays ${n} XP for a ${it.name}, and forgets something they had just learned.`, 'd'); }
  wAddItem(k, 1); wSave(); return '';
}
function wUmbShop(shop, who) {
  modal(`<header><h3>${esc(who || 'A dark shop')}</h3><button class="ghost" data-close>Done</button></header><div id="wUmbShopBody"></div>`);
  const render = msg => {
    const sh = DB.shops[shop] || DB.shops.general, p = wUmbXpPlayer(), body = $('wUmbShopBody'); if (!body) return;
    let h = `<p class="hint">No gold here. You have <b>${RUN.fans || 0} fans</b>${p ? `, and ${esc(p.n)} has ${p.xp || 0} XP toward their next level` : ''}.${msg ? ' <span class="wbad">' + esc(msg) + '</span>' : ''}</p><table class="wshop"><tbody>`;
    for (const k in sh) {
      const it = DB.items[k]; if (!it) continue;
      const f = wUmbFans(sh[k]), x = wUmbXp(sh[k]);
      h += `<tr><td><b>${esc(it.name)}</b><small>${esc(it.desc)}</small></td><td class="wnum dim">have ${WG.items[k] || 0}</td><td><button class="ghost" data-ubuy="${k}" data-how="fans" ${(RUN.fans || 0) < f ? 'disabled' : ''}>${f} fans</button></td><td><button class="ghost" data-ubuy="${k}" data-how="xp" ${!p || (p.xp || 0) < x ? 'disabled' : ''}>${x} XP</button></td></tr>`;
    }
    body.innerHTML = h + '</tbody></table>';
    body.querySelectorAll('[data-ubuy]').forEach(b => b.onclick = () => { render(wUmbBuy(shop, b.dataset.ubuy, b.dataset.how)); wDrain(); });
  };
  render('');
}
const wWU2RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'ushop') { const ch = wChar(id); WUI.held = null; wUmbShop(ch.shop || 'general', ch.name); return; }
  return wWU2RunAct.apply(this, arguments);
};

/* ---------- the lanterns ---------- */
function wUmbPlaceLanterns() {
  const m = MAPS['u:world'], den = DB.locs.find(l => l.id === 'umbralden'); if (!m || !den) return;
  const reach = () => bfsReach(m, den.x, den.y + 1), count = s => { let n = 0; for (let i = 0; i < s.length; i++) n += s[i]; return n; };
  for (const rg in W_UMB2.lantern) {
    const L = DB.locs.find(l => l.id === W_UMB2.lantern[rg]); if (!L) continue;
    let base = reach(), done = false;
    for (let r = 2; r <= 6 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = L.x + dx, y = L.y + dy, c = m.t[y] && m.t[y][x], td = c && DB.tiles[c];
      if (!td || !td.walk || !td.ground || td.enter || c === '=' || c === 'b' || m.meta[x + ',' + y] || !base[y * m.w + x]) continue;
      m.t[y][x] = W_UMB2.ch;
      // it must leave the ground as connected as it found it, and be reachable itself
      const s = reach(), side = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => s[(y + ay) * m.w + x + ax]);
      if (count(s) === count(base) - 1 && side) { m.meta[x + ',' + y] = { lantern: rg }; m.light.push([x, y, 3.4]); done = true; }
      else m.t[y][x] = c;
    }
  }
}
const wWU2BuildAllMaps = buildAllMaps;
buildAllMaps = function () { const r = wWU2BuildAllMaps.apply(this, arguments); wUmbPlaceLanterns(); return r; };
WOBJ[W_UMB2.ch] = (c, P, r, e) => {
  c.save();
  c.fillStyle = '#2a2230'; c.fillRect(14.5, 9, 3, 21);
  c.fillStyle = '#3a3044'; c.fillRect(11, 28, 10, 3);
  c.fillStyle = '#c8b8ff'; c.globalAlpha = .9; c.beginPath(); c.moveTo(16, 2); c.lineTo(21, 7); c.lineTo(19, 12); c.lineTo(13, 12); c.lineTo(11, 7); c.closePath(); c.fill();
  c.globalAlpha = 1; c.strokeStyle = WINKC; c.lineWidth = 1.2; c.stroke();
  c.restore();
};
function wUmbLantern(x, y) {
  const m = wCurMap(), mt = m.meta[x + ',' + y] || {}, U = wUmb(); if (!U) return;
  const close = modal(`<header><h3>The lantern</h3><button class="ghost" data-close>Not now</button></header>
    <p>An iron lantern, burning violet. The dark keeps its distance. Rest here until morning: your team back to full health (now ${RUN.hp}/${RUN.maxhp}), and the journey saved.</p>
    <p class="hint">If a match goes badly on this side, you wake by the last lantern you rested at${U.lantern ? `; now that is ${esc(W_UMB.regions[U.lantern.rg] || '')}'s` : ''}.</p>
    <div class="row"><button class="btn" id="wUmbRest">Rest</button></div>`);
  $('wUmbRest').onclick = () => {
    wAdvance((24 * 60 - WG.min) + 7 * 60); RUN.hp = RUN.maxhp;
    U.lantern = { map: m.id, x: WG.x, y: WG.y, rg: mt.lantern || wRegionHere() };
    wLog('You rest by the lantern. Nobody sleeps, quite, but the night passes and your team is whole again. You will wake here if a match goes badly on this side.', 'm');
    wSave(); close(); wDrain();
  };
}
const wWU2Use = wUse;
wUse = function (x, y) {
  const m = wCurMap(), c = m && wTileAt(m, x, y);
  if (c === W_UMB2.ch) return wUmbLantern(x, y);
  return wWU2Use.apply(this, arguments);
};

/* ---------- a blackout on this side: you wake by your lantern, or by the portal ---------- */
const wWU2Blackout = wBlackout;
wBlackout = function (W, result) {
  if (!wUmbDark()) return wWU2Blackout.apply(this, arguments);
  const U = wUmb(), lostG = Math.floor(RUN.gold * .1), lostF = Math.floor((RUN.fans || 0) * .25);
  RUN.gold -= lostG; RUN.fans = (RUN.fans || 0) - lostF;
  RUN.hp = Math.max(RUN.hp, Math.ceil(RUN.maxhp * .5));
  let where;
  if (U.lantern && MAPS[U.lantern.map]) { wEnterMap(U.lantern.map, U.lantern.x, U.lantern.y); where = `by the lantern in ${W_UMB.regions[U.lantern.rg] || 'the dark'}`; }
  else { const d = MAPS['u:umbralden'], p = Object.keys(d.meta).find(k => d.meta[k].portal).split(',').map(Number), [ax, ay] = wUmbBeside(d, p[0], p[1]); wEnterMap(d.id, ax, ay); where = 'by the portal, on the wrong side of it'; }
  WG.face = 'd'; wAdvance(240);
  WG.grace = W_ENC.grace; WG.blackouts = (WG.blackouts || 0) + 1;
  const how = result === 'quit' ? 'You walk off the field' : 'Your team goes down';
  const msg = `${how}, and the next thing you know you are waking up ${where}. You lost ${lostG} gold${lostF ? ` and ${lostF} fans` : ''}, and your team is back up to ${RUN.hp}/${RUN.maxhp} HP.`;
  wLog(msg, 'b');
  wDispatchEnd(W, 'lose');
  wSave();
  showView('world');
  if (!LAB) {
    const close = modal(`<header><h3>Blackout</h3></header><div class="wmsg"><p>${esc(msg)}</p><p class="hint">Rest by a lantern to heal fully, and to choose where you wake on this side.</p></div><div class="row"><button class="btn" id="wWake">Get up</button></div>`,
      () => { if (WG && WG.cardOffer) wShowCardOffer(); else wDrain(); });
    $('wWake').focus(); $('wWake').onclick = () => close();
  }
};

/* ---------- the dark towns' lines ---------- */
const wWU2Ambient = wAmbient;
wAmbient = function (m, preReg) {
  if (m && m.umbral && m.kind === 'town') { if (!LAB && WG.step % 9 === 0 && Math.random() < .4) wLog(pick((W_UMB2.ambient[m.id.slice(2)] || []).concat(W_UMB2.ambient.all)), 'd'); return; }
  return wWU2Ambient.apply(this, arguments);
};

/* ---------- the dark world's map ---------- */
const wWU2MapRevealHere = wMapRevealHere;
wMapRevealHere = function () {
  const m = WG && wCurMap();
  if (m && m.umbral) { wFogReveal(WG.x, WG.y, m.kind === 'world' ? W_MAP.see : (W_MAP.seeIn[m.kind] || W_MAP.seeIn.town), m.id); return; }
  return wWU2MapRevealHere.apply(this, arguments);
};
const wWU2MapHere = wMapHere;
wMapHere = function () {
  const m = WG && wCurMap();
  if (m && m.umbral && m.kind !== 'world') { const L = DB.locs.find(l => l.map === m.id.slice(2)); return L ? [L.x, L.y] : null; }
  return wWU2MapHere.apply(this, arguments);
};
const wWU2MapSeenCount = wMapSeenCount;
wMapSeenCount = function (id) { return wWU2MapSeenCount.call(this, id || (wUmbDark() ? 'u:world' : undefined)); };
const wWU2MapDraw = wMapDraw;
wMapDraw = function (cv) {
  if (!wUmbDark()) return wWU2MapDraw.apply(this, arguments);
  const S = W_MAP.px, c = cv.getContext('2d'), m = MAPS['u:world'];
  cv.width = WW * S; cv.height = WH * S;
  wMapPaint(c, m, S, 'u:world');
  c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = '#7a6a8c'; c.fillRect(0, 0, cv.width, cv.height); c.restore();
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const L of DB.locs) {
    if (!W_MAP_KIND[L.kind] || !wFogSeen(L.x, L.y, 'u:world') || (L.hidden && !wFlag(L.hidden))) continue;
    const cx = L.x * S + S / 2, cy = L.y * S + S / 2, open = !!MAPS['u:' + L.map];
    wMapMark(c, L.kind, cx, cy);
    wMapLabel(c, open ? (W_UMB.names[L.map] || L.name) : L.name + ' (shut)', cx, cy - 13, L.kind === 'ground' ? 11 : 13, open, open ? '#1a1020' : '#5a4a64');
  }
  for (const k in m.meta) if (m.meta[k].lantern) { const [x, y] = k.split(',').map(Number); if (wFogSeen(x, y, 'u:world')) wMapLabel(c, W_UMB2.ch + ' lantern', x * S + S / 2, y * S + S / 2, 11, true, '#3a2060'); }
  const h = wMapHere(); if (h) wMapYou(c, h[0] * S + S / 2, h[1] * S + S / 2);
  c.restore();
};

/* ---------- the audit walks the dark maps ---------- */
const wWU2Audit = wAudit;
wAudit = function () {
  const P = wWU2Audit.apply(this, arguments), sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const id of W_UMB2.towns) {
    const m = MAPS['u:' + id]; if (!m) { P.push('dark town u:' + id + ' was not built'); continue; }
    const s = bfsReach(m, m.spawn[0], m.spawn[1]), at = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && !!s[y * m.w + x];
    for (const n of m.npcs) {
      const across = sides.some(([dx, dy]) => m.t[n.y + dy] && m.t[n.y + dy][n.x + dx] === '-' && at(n.x + dx * 2, n.y + dy * 2));
      if (!at(n.x, n.y) && !sides.some(([dx, dy]) => at(n.x + dx, n.y + dy)) && !across) P.push(m.id + ': cannot reach ' + n.id);
    }
    for (const k in m.meta) { const [x, y] = k.split(',').map(Number); if (!sides.some(([dx, dy]) => at(x + dx, y + dy))) P.push(m.id + ': cannot reach ' + k); }
  }
  const w = MAPS['u:world'], den = DB.locs.find(l => l.id === 'umbralden');
  if (w && den) {
    const s = bfsReach(w, den.x, den.y + 1), near = (x, y) => !!s[y * w.w + x] || sides.some(([dx, dy]) => s[(y + dy) * w.w + x + dx]);
    for (const L of DB.locs) if (!near(L.x, L.y)) P.push('u:world: cannot walk to ' + L.id);
    const lan = Object.keys(w.meta).filter(k => w.meta[k].lantern);
    if (lan.length !== Object.keys(W_UMB2.lantern).length) P.push('u:world: ' + lan.length + ' lanterns, not ' + Object.keys(W_UMB2.lantern).length);
    for (const k of lan) { const [x, y] = k.split(',').map(Number); if (!near(x, y)) P.push('u:world: cannot reach the lantern at ' + k); }
  }
  return P;
};
