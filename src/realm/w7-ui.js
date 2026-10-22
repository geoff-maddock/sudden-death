/* w7: Realm UI: world view DOM, HUD, log, talk panel, shop and inn panels, input, and drawing the world each frame.
   The model is w3 (WG, wTryMove, wSay ...). This part only reads it, calls it, and drains its event queue WQ.
   Every listener does nothing unless the world view is showing and no modal or pause screen is open. */

// the world view sits beside Sudden Death's map, fight and panel views
$('v-map').insertAdjacentHTML('afterend', '<div id="v-world" hidden></div>');

const WSTEP_MS = 150;           // one step per 150 ms while a direction is held
const WUI = {
  built: false, cv: null, c: null, cssW: 0, cssH: 0, r: 1, s: 1, zoom: 1, vw: 0, vh: 0,
  cam: null, held: null, lastStep: 0, goto: null, talk: null, hudKey: '', logDirty: true, last: 0,
  party: [],                    // [{ fx, fy, tx, ty, t0 }] for the leader and the two followers
  face: 'r',                    // the last left/right facing (sprites only face left or right)
};
const WKEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0] };

function wActive() { return UI.view === 'world' && !!WG && $('modal').hidden && !UI.paused && !$('pg-play').hidden; }

function wBuildView() {
  if (WUI.built) return;
  WUI.built = true;
  $('v-world').innerHTML = `
    <div class="whud" id="wHud"></div>
    <div class="wmain">
      <div class="wstage" id="wStage">
        <canvas id="wcv" aria-label="The realm, seen from above. Your party is in the middle."></canvas>
        <div class="wplace" id="wPlace" aria-live="polite"></div>
        <div class="wtalk" id="wTalk" hidden role="dialog" aria-label="Conversation"></div>
        <div class="wpad" id="wPad" aria-label="Movement">
          <div class="wdpad">
            <button class="wpb up" data-dir="0,-1" aria-label="Walk up">&#9650;</button>
            <button class="wpb lf" data-dir="-1,0" aria-label="Walk left">&#9664;</button>
            <button class="wpb rt" data-dir="1,0" aria-label="Walk right">&#9654;</button>
            <button class="wpb dn" data-dir="0,1" aria-label="Walk down">&#9660;</button>
          </div>
          <div class="wacts"><button class="wpb act" id="wActBtn" aria-label="Talk or use">Use</button><button class="wpb look" id="wLookBtn" aria-label="Look">Look</button></div>
        </div>
      </div>
      <aside class="wside">
        <div class="wlog" id="wLog" aria-live="polite"></div>
        <p class="wkeys"><kbd>&#8592;&#8593;&#8594;&#8595;</kbd> or <kbd>WASD</kbd> walk &middot; <kbd>Space</kbd> talk or use &middot; <kbd>L</kbd> look &middot; <kbd>Esc</kbd> close. Click a spot to walk there. Walk into people to talk.</p>
      </aside>
    </div>`;
  WUI.cv = $('wcv'); WUI.c = WUI.cv.getContext('2d');
  WUI.cv.addEventListener('click', wCanvasClick);
  // the on-screen pad: hold to keep walking
  $('wPad').querySelectorAll('[data-dir]').forEach(b => {
    const dir = b.dataset.dir.split(',').map(Number);
    const down = e => { e.preventDefault(); if (!wActive()) return; WUI.goto = null; WUI.held = dir; wDoStep(dir[0], dir[1]); };
    const up = () => { if (WUI.held === dir) WUI.held = null; };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  });
  $('wActBtn').onclick = () => { if (wActive()) { wInteract(); wDrain(); } };
  $('wLookBtn').onclick = () => { if (wActive()) { wLook(); wDrain(); } };
}

/* called by showView('world') */
function wShowWorld() {
  wBuildView();
  WUI.cam = null; WUI.hudKey = ''; WUI.logDirty = true; WUI.held = null; WUI.goto = null;
  wResetParty();
  wCloseTalk();
  wDrain();
  wRenderHud(); wRenderLog();
}

/* ---------- the party on screen ---------- */
function wResetParty() { const now = performance.now(); WUI.party = [0, 1, 2].map(() => ({ fx: WG.x, fy: WG.y, tx: WG.x, ty: WG.y, t0: now })); }
function wPartyMoved(px, py) {
  const now = performance.now(), P = WUI.party, prev = P.map(p => [p.tx, p.ty]);
  P[0] = { fx: px, fy: py, tx: WG.x, ty: WG.y, t0: now };
  for (let i = 1; i < P.length; i++) P[i] = { fx: prev[i][0], fy: prev[i][1], tx: prev[i - 1][0], ty: prev[i - 1][1], t0: now };
}
function wLerpPos(p, now) { const k = Math.min(1, (now - p.t0) / WSTEP_MS); return [p.fx + (p.tx - p.fx) * k, p.fy + (p.ty - p.fy) * k, k < 1]; }

/* one step, from a key, the pad, a click path or a test */
function wDoStep(dx, dy) {
  if (!WG) return false;
  if (WUI.talk) wCloseTalk();
  const map0 = WG.map, px = WG.x, py = WG.y;
  const moved = wTryMove(dx, dy);
  if (dx) WUI.face = dx < 0 ? 'l' : 'r';
  WUI.lastStep = performance.now();
  if (moved && WG.map === map0 && (WG.x !== px || WG.y !== py)) {
    if (Math.abs(WG.x - px) + Math.abs(WG.y - py) === 1) wPartyMoved(px, py); else wResetParty();
  }
  wDrain();
  return moved;
}

/* ---------- the model's event queue ---------- */
function wDrain() {
  while (WQ.length) {
    const e = WQ.shift();
    if (e.k === 'log') WUI.logDirty = true;
    else if (e.k === 'map') { WUI.cam = null; WUI.goto = null; WUI.held = null; if (WUI.built) { wResetParty(); wShowPlace(); } }
    else if (e.k === 'talk') { WUI.goto = null; WUI.held = null; wOpenTalk(e.id, e.text); }
    else if (e.k === 'shop') { WUI.held = null; wOpenShop(e.shop, e.who, e.id); }
    else if (e.k === 'inn') { WUI.held = null; wOpenInn(e.price, e.who); }
  }
  if (WUI.built && UI.view === 'world') { if (WUI.logDirty) wRenderLog(); wRenderHud(); }
}

/* ---------- HUD and log ---------- */
function wRegionName() { const R = DB.regions[wRegionHere()]; return R ? R.name : ''; }
function wPartyTeam() { return CLUBS[(RUN && RUN.club) || WG.club] || CLUBS[CLUB_IDS[0]]; }
function wRenderHud() {
  if (!WUI.built || !WG) return;
  const m = wCurMap(), crown = wChampWeek() ? 'Championship week' : 'Crown in ' + wDaysToChamp() + ' days';
  const key = [WG.map, m.kind === 'world' ? wRegionHere() : '', WG.day, WG.year, WG.min, RUN.gold, RUN.hp, RUN.maxhp, RUN.fans || 0, WG.hardcore ? 1 : 0, wParty().map(p => p.kind).join()].join('|');
  if (key === WUI.hudKey) return;
  WUI.hudKey = key;
  const team = wPartyTeam();
  const party = wParty().map(p => `<img src="${portraitURL(p.kind, team, p.num, 64)}" alt="${esc(p.n)}, ${esc(KIND_NAME[p.kind] || p.kind)}" title="${esc(p.n)} (${esc(KIND_NAME[p.kind] || p.kind)})">`).join('');
  const low = RUN.hp < RUN.maxhp * .3;
  $('wHud').innerHTML = `<div class="wwhere"><b>${esc(m.name)}</b><small>${esc(wRegionName())}${WG.hardcore ? ' &middot; <span class="whard" title="A lost match ends this journey">Hardcore</span>' : ''}</small></div>
    <div class="stat"><small>${esc(wSeason())}, day ${WG.day}</small><b>${esc(wPartOfDay())} ${wTimeStr()}</b></div>
    <div class="stat"><small>Year ${WG.year}</small><b class="wcrown">${crown}</b></div>
    <div class="stat hp${low ? ' wlow' : ''}" title="Your team's health. It carries from match to match; a night at an inn restores it."><small>Team HP</small><b>${RUN.hp}/${RUN.maxhp}</b></div>
    <div class="stat gold"><small>Gold</small><b>${RUN.gold}</b></div>
    <div class="stat wfans" title="Fans: earned by sports wins"><small>Fans</small><b>${RUN.fans || 0}</b></div>
    <div class="party wparty" title="${esc(team.name)}">${party}</div>`;
}
function wRenderLog() {
  if (!WUI.built) return;
  WUI.logDirty = false;
  const el = $('wLog');
  el.innerHTML = WLOG.slice(-40).map(l => `<p class="wl-${l[1] || 'n'}">${esc(l[0])}</p>`).join('');
  el.scrollTop = el.scrollHeight;
}
function wShowPlace() {
  const el = $('wPlace'); if (!el) return;
  const m = wCurMap();
  el.innerHTML = `<b>${esc(m.name)}</b>${m.kind === 'world' ? `<small>${esc(wRegionName())}</small>` : ''}`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

/* ---------- talk ---------- */
function wNpcTeam(kind) { const col = wActorCol(kind); return { color: col, light: tint(col, .55), dark: tint(col, -.6), short: '' }; }
function wOpenTalk(id, text) {
  WUI.talk = { id, text, seen: [] };
  wRenderTalk();
}
function wCloseTalk() { WUI.talk = null; const el = $('wTalk'); if (el) { el.hidden = true; el.innerHTML = ''; } }
function wTalkSay(kw) {
  const T = WUI.talk; if (!T) return;
  const r = wSay(T.id, kw);
  if (r.text == null) { wCloseTalk(); wDrain(); return; }
  T.text = r.text; T.asked = kw;
  wRenderTalk();
  if (r.act) wRunAct(r.act, T.id);
  wDrain();
}
function wRenderTalk() {
  const T = WUI.talk, el = $('wTalk'); if (!T || !el) return;
  const ch = wChar(T.id);
  // TC's keyword links: an ALL-CAPS word somebody answers to becomes a link
  const text = esc(T.text || '').replace(/\b[A-Z]{3,}\b/g, w => {
    const k = wFindTopic(ch, w.toLowerCase());
    if (!k) return w;
    if (!T.seen.includes(k)) T.seen.push(k);
    return `<button class="wkw" data-kw="${k}">${w}</button>`;
  });
  const chips = ['name', 'job', ...T.seen.filter(k => k !== 'job'), 'bye'];
  el.innerHTML = `<img class="wtport" src="${portraitURL(ch.kind, wNpcTeam(ch.kind), '', 96)}" alt="">
    <div class="wtbody">
      <header><h3>${esc(ch.name)}</h3><button class="ghost wtx" data-kw="bye" aria-label="Close the conversation">Bye</button></header>
      <p class="wsay">${text}</p>
      <div class="wtchips">${chips.map(k => `<button class="ghost" data-kw="${k}">${esc(wCap(k))}</button>`).join('')}
        <input id="wAsk" placeholder="Ask about&hellip;" aria-label="Ask about a word" autocomplete="off" enterkeyhint="send"></div>
      <p class="hint wthint">Click a <span class="wkwh">CAPITALISED</span> word, or type one, to ask about it.</p>
    </div>`;
  el.hidden = false;
  el.querySelectorAll('[data-kw]').forEach(b => b.onclick = () => wTalkSay(b.dataset.kw));
  const inp = $('wAsk');
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { const v = inp.value; inp.value = ''; wTalkSay(v || 'bye'); } else if (e.key === 'Escape') wCloseTalk(); };
}

/* ---------- shop and inn, in Sudden Death's modal ---------- */
function wOpenShop(shop, who, id) {
  const ch = id ? wChar(id) : null;
  modal(`<header><div class="row">${ch ? `<img class="wmport" src="${portraitURL(ch.kind, wNpcTeam(ch.kind), '', 96)}" alt="">` : ''}<h3>${esc(who || 'Shop')}</h3></div><button class="ghost" data-close>Done</button></header>
    <div id="wShopBody"></div>`);
  const render = msg => {
    const sh = DB.shops[shop] || DB.shops.general;
    let h = `<p class="hint">You have <b class="wgold">${RUN.gold} gold</b>.${msg ? ' <span class="wbad">' + esc(msg) + '</span>' : ''}</p><table class="wshop"><tbody>`;
    for (const k in sh) {
      const it = DB.items[k]; if (!it) continue;
      h += `<tr><td><b>${esc(it.name)}</b><small>${esc(it.desc)}</small></td><td class="wnum">${sh[k]}g</td><td class="wnum dim">have ${WG.items[k] || 0}</td><td><button class="ghost" data-buy="${k}" ${RUN.gold < sh[k] ? 'disabled' : ''}>Buy</button></td></tr>`;
    }
    const sellable = Object.keys(WG.items).filter(k => wSellPrice(k));
    if (sellable.length) h += `<tr class="wsellh"><td colspan="4"><h4>Sell, at half price</h4></td></tr>${sellable.map(k => `<tr><td>${esc(DB.items[k].name)}</td><td class="wnum">${wSellPrice(k)}g</td><td class="wnum dim">have ${WG.items[k]}</td><td><button class="ghost" data-sell="${k}">Sell one</button></td></tr>`).join('')}`;
    h += '</tbody></table>';
    const body = $('wShopBody'); if (!body) return;
    body.innerHTML = h;
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const r = wBuy(shop, b.dataset.buy); if (!r) wLog('Bought a ' + DB.items[b.dataset.buy].name + '.', 'm'); render(r); wDrain(); });
    body.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const nm = DB.items[b.dataset.sell].name, r = wSell(b.dataset.sell); if (!r) wLog('Sold a ' + nm + '.', 'm'); render(r); wDrain(); });
  };
  render('');
}
function wOpenInn(price, who) {
  const town = wCurMap().name;
  const close = modal(`<header><h3>${esc(who || 'The inn')}</h3><button class="ghost" data-close>Not now</button></header>
    <p>A room for the night is <b class="wgold">${price} gold</b>. You have ${RUN.gold}. Your team wakes at full health (now ${RUN.hp}/${RUN.maxhp}).</p>
    <p class="hint">You sleep until 7 in the morning. If a match goes badly later, you wake up here in ${esc(town)}.${WG.home ? ` Right now you would wake in ${esc((MAPS[WG.home] || {}).name || WG.home)}.` : ''}</p>
    <div class="row"><button class="btn" id="wSleep" ${RUN.gold < price ? 'disabled' : ''}>Sleep (${price} gold)</button></div>`);
  $('wSleep').onclick = () => { const r = wSleepInn(price); if (r) wLog(r, 'b'); close(); wCloseTalk(); wDrain(); };
}

/* ---------- input ---------- */
document.addEventListener('keydown', e => {
  if (!wActive()) return;
  if (e.target.closest && e.target.closest('input,textarea,select')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const dir = WKEYS[e.key];
  if (dir) {
    e.preventDefault();
    WUI.goto = null; WUI.held = dir;
    if (!e.repeat && performance.now() - WUI.lastStep > WSTEP_MS * .5) wDoStep(dir[0], dir[1]);
    return;
  }
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') { e.preventDefault(); if (WUI.talk) return; wInteract(); wDrain(); return; }
  if (e.key === 'l' || e.key === 'L') { e.preventDefault(); wLook(); wDrain(); return; }
});
document.addEventListener('keyup', e => { const dir = WKEYS[e.key]; if (dir && WUI.held && WUI.held[0] === dir[0] && WUI.held[1] === dir[1]) WUI.held = null; });
window.addEventListener('blur', () => { WUI.held = null; });
// Escape closes the talk panel. Sudden Death's pause key is for runs, which the world view does not have yet:
// swallow Escape and P here (capture phase, before its listener) unless a modal wants Escape itself.
window.addEventListener('keydown', e => {
  if (UI.view !== 'world' || !$('modal').hidden) return;
  if (e.key === 'Escape') { if (WUI.talk) wCloseTalk(); e.stopPropagation(); e.preventDefault(); }
  else if ((e.key === 'p' || e.key === 'P') && !(e.target.closest && e.target.closest('input,textarea'))) e.stopPropagation();
}, true);

function wCanvasClick(e) {
  if (!wActive() || !WUI.cam) return;
  const r = WUI.cv.getBoundingClientRect();
  const tx = Math.floor(WUI.cam[0] + (e.clientX - r.left) / WUI.zoom / WTILE), ty = Math.floor(WUI.cam[1] + (e.clientY - r.top) / WUI.zoom / WTILE);
  const d = Math.abs(tx - WG.x) + Math.abs(ty - WG.y);
  if (d === 0) { wInteract(); wDrain(); return; }
  if (d === 1) { WUI.goto = null; wDoStep(tx - WG.x, ty - WG.y); return; }
  WUI.goto = [tx, ty];
  if (performance.now() - WUI.lastStep > WSTEP_MS) wGotoStep();
}
function wGotoStep() {
  const g = WUI.goto; if (!g) return;
  const st = wPathStep(g[0], g[1]);
  if (!st) { WUI.goto = null; return; }
  const last = Math.abs(g[0] - WG.x) + Math.abs(g[1] - WG.y) === 1;
  wDoStep(st[0], st[1]);
  if (last || (WG.x === g[0] && WG.y === g[1])) WUI.goto = null;
}

/* ---------- drawing, once a frame (w8's frame wrapper calls this) ---------- */
function wFit() {
  const st = $('wStage'), cssW = st.clientWidth, cssH = st.clientHeight;
  if (!cssW || !cssH) return false;
  const dpr = window.devicePixelRatio || 1;
  const across = cssW < 520 ? 10 : cssW < 860 ? 13 : 16;
  const zoom = cssW / (across * WTILE);
  // device pixels per logical pixel, kept to whole 1/32 steps so a tile is a whole number of device pixels,
  // and capped at 4 so the renderer's cached chunks stay a sensible size on big retina screens
  const s = Math.max(1, Math.round(Math.min(4, dpr * zoom) * 32) / 32);
  const r = s / zoom;
  const W = Math.round(cssW * r), H = Math.round(cssH * r);
  if (WUI.cv.width !== W || WUI.cv.height !== H) { WUI.cv.width = W; WUI.cv.height = H; }
  WUI.cv.style.width = cssW + 'px'; WUI.cv.style.height = cssH + 'px';
  Object.assign(WUI, { cssW, cssH, zoom, s, r, vw: W / s, vh: H / s });
  return true;
}
function wRender(now) {
  if (!WUI.built || !WG || !MAPS[WG.map]) return;
  const dt = Math.min(.1, (now - (WUI.last || now)) / 1000); WUI.last = now;
  // held keys and click paths step at a steady rate
  if (wActive()) {
    if (WUI.held && now - WUI.lastStep >= WSTEP_MS) wDoStep(WUI.held[0], WUI.held[1]);
    else if (WUI.goto && now - WUI.lastStep >= WSTEP_MS) wGotoStep();
  }
  if (!wFit()) return;
  const c = WUI.c, m = wCurMap(), t = G.time, T = WTILE;
  const lead = wLerpPos(WUI.party[0], now);
  // the camera follows the leader smoothly, and stops at the edge of a town or dungeon
  const vwT = WUI.vw / T, vhT = WUI.vh / T;
  const clampC = (v, size, view) => size <= view ? (size - view) / 2 : Math.max(0, Math.min(size - view, v));
  const want = [clampC(lead[0] + .5 - vwT / 2, m.w, vwT), clampC(lead[1] + .5 - vhT / 2, m.h, vhT)];
  if (!WUI.cam) WUI.cam = want.slice();
  else { const k = 1 - Math.exp(-dt * 9); WUI.cam[0] += (want[0] - WUI.cam[0]) * k; WUI.cam[1] += (want[1] - WUI.cam[1]) * k; if (Math.abs(want[0] - WUI.cam[0]) < .002) WUI.cam[0] = want[0]; if (Math.abs(want[1] - WUI.cam[1]) < .002) WUI.cam[1] = want[1]; }
  // whole device pixels: snap the camera to the device grid
  const snap = v => Math.round(v * T * WUI.s) / (T * WUI.s);
  const camX = snap(WUI.cam[0]), camY = snap(WUI.cam[1]);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, WUI.cv.width, WUI.cv.height);
  c.setTransform(WUI.s, 0, 0, WUI.s, 0, 0);
  // the map without its night: actors go under the darkness, so night is drawn after them
  wDrawMap(c, WG.map, camX, camY, WUI.vw, WUI.vh, t, { noNight: true });
  // actors, back to front
  c.setTransform(WUI.s, 0, 0, WUI.s, -Math.round(camX * T * WUI.s), -Math.round(camY * T * WUI.s));
  const acts = [];
  const x0 = camX - 2, y0 = camY - 2, x1 = camX + vwT + 2, y1 = camY + vhT + 3;
  for (const n of m.npcs || []) {
    if (n.x < x0 || n.x > x1 || n.y < y0 || n.y > y1) continue;
    const ch = DB.chars[n.id]; if (!ch || !ch.kind) continue;
    let nx = n.x, ny = n.y, moving = false;
    if (n.mt && now - n.mt < WSTEP_MS * 1.6) { const k = (now - n.mt) / (WSTEP_MS * 1.6); nx = n.px + (n.x - n.px) * k; ny = n.py + (n.y - n.py) * k; moving = true; }
    const near = Math.abs(n.x - WG.x) + Math.abs(n.y - WG.y) <= 3;
    const face = near ? (WG.x < n.x ? 'l' : 'r') : (((n.x * 7 + n.y * 3) & 1) ? 'l' : 'r');
    acts.push({ y: ny, x: nx, who: { kind: ch.kind, face, walk: moving ? t * 12 : 0, seed: n.x * 3 + n.y }, size: 30 });
  }
  const team = wPartyTeam(), drawn = new Set();
  WUI.party.forEach((p, i) => {
    const pos = i === 0 ? lead : wLerpPos(p, now), key = Math.round(pos[0] * 4) + ',' + Math.round(pos[1] * 4);
    if (i > 0 && (drawn.has(key) || (p.tx === WG.x && p.ty === WG.y && !pos[2]))) return;
    drawn.add(key);
    const pm = wParty()[i]; if (!pm) return;
    const moving = pos[2] || (i === 0 && !!WUI.held);
    const face = i === 0 ? WUI.face : (p.tx < p.fx ? 'l' : p.tx > p.fx ? 'r' : WUI.face);
    acts.push({ y: pos[1] + (i === 0 ? .01 : 0), x: pos[0], who: { kind: pm.kind, team: { color: team.color, light: team.light, short: team.short }, num: pm.num, face, walk: moving ? t * 12 + i : 0, seed: i }, size: i === 0 ? 32 : 28, alpha: i === 0 ? 1 : .96 });
  });
  acts.sort((a, b) => a.y - b.y);
  for (const a of acts) wDrawActor(c, a.who, a.x * T + T / 2, a.y * T + T - 3, t, { size: a.size, alpha: a.alpha });
  c.restore();
  // night: always in dungeons, by the clock everywhere else, with a light around the party
  const night = m.kind === 'dungeon' ? .8 : wDarkness() * 1.15;
  if (night > .02) {
    const lights = [[lead[0], lead[1], m.kind === 'dungeon' ? 3.6 : 2.8]];
    for (const l of m.light || []) lights.push([l[0], l[1], l[2] || 2.6]);
    if (m.kind === 'world') for (const L of DB.locs) if (L.kind !== 'lair' && !(L.hidden && !wFlag(L.hidden))) lights.push([L.x, L.y, 2.2]);
    const s = Math.round(WUI.s * 100) / 100;
    c.save();
    try { wNight(c, 0, 0, WUI.cv.width, WUI.cv.height, -Math.round(camX * T * s), -Math.round(camY * T * s), s, night, lights, m); }
    finally { c.restore(); }
  }
  wRenderHud();
}
