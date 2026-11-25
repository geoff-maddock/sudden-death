/* u8h: dark shops that take a trophy (issue #111, phase H). Loads after u8c-dread.js; changes earlier parts only by
   reassignment (saved originals carry the wWU8H prefix).

   Every dark shop has a second list, for a trophy (W_UMB8H.wares): the Umbral's own wares, which nothing else sells.
     Hex Ward      ready it from the Bag: the next Nadir game you play (a champion's, or a round of the Seal) draws one
                   hex fewer (WG.umbral.ward; used up when the game whose draw it trimmed ends, won or lost, WG.umbral.wardFor;
                   backing away keeps it, and a game drawn before it was readied never spends it)
     Lantern Oil   from the Bag, on the dark side: rest where you stand, once, as by a lantern (you wake by your last
                   lantern after a blackout, as before)
     Ichor Draught ready it from the Bag: your next card match on the dark side starts with 2 Strength (WG.umbral.ichor)
   Shadow Salt (u8c) is on the fans list. The price is one trophy (RUN.relics), chosen from the ones you can trade: not
   the Seal of the Crown, not a club's own trophy, not one that changed your team for good when you won it (R.gain).
   It is gone for good.
   The hex count: wUmbHexCut(id) is how many hexes come off a Nadir game's draw (the ward's one here; u8i's shards add
   theirs by wrapping it; u8j's well-won pieces take theirs off the Seal's round itself). Every way to play's hex draw is trimmed by it (the card game's wUmbHexes and each sport's),
   never below none, so a 1-hex champion with a ward plays with no hexes at all.

   W_UMB8H, wUmbHexCut, wUmbTradable, wUmbTrade
   Wraps: the hex draws wUmbHexes, wUmb4aHexes, wUmbGfHexes, wUmbRingHexes, wUmbBkHexes, wUmbHkHexes, wUmbGlHexes,
   wUmbBlHexes, wUmbCrHexes and wUmbJtHexes (wWU8H<Name>: trimmed), wUmbTollAtKickoff (wWU8HTollAtKickoff: the ward bound to the game that
   kicks off), W_ON_END.nadir (wWU8HOnNadir: the ward used up), wUseItem
   (wWU8HUseItem: the wares from the Bag), wCampBag (wWU8HCampBag: their buttons), wUmbShop (wWU8HUmbShop: the trophy
   list), wAudit (wWU8HAudit: the wares come from the dark shops), renderHelp (wWU8HRenderHelp). */

const W_UMB8H = {
  wares: ['uward', 'ulampoil', 'uichor'],
  str: 2,
  noTrade: ['umbseal', 'belt'],
  // each sport's Nadir game kind (a champion's and the Seal's round), to tell its saved game from another of that sport
  kindOf: { diamond: 'unadir_ball', gridiron: W_UMB4B.kind, ring: 'unbox', court: W_UMB4D.kind, rink: W_UMB4E.kind, links: W_UMB4F.kind, lanes: W_UMB4G.kind, shed: W_UMB4H.kind, lists: W_UMB4J.kind },   // (the Bandolier's tonic slot is added outside its gain, and would stay)
};
DB.items.uward = { name: 'Hex Ward', desc: 'A knot of black thread. Ready it from the Bag: the next Nadir game you play draws one hex fewer.', use: 'Bag → Ready. Used up when that game ends.', price: 0 };
DB.items.ulampoil = { name: 'Lantern Oil', desc: 'A flask of violet oil. On the dark side, rest where you stand, once, as by a lantern.', use: 'Bag → Rest, on the dark side.', price: 0 };
DB.items.uichor = { name: 'Ichor Draught', desc: `A black draught. Ready it from the Bag: your next card match on the dark side starts with ${W_UMB8H.str} Strength.`, use: 'Bag → Ready. Used up by that match.', price: 0 };

/* ---------- the hex count ---------- */
// how many hexes come off this Nadir game's draw (u8i's shards wrap it)
// (the ward is bound to the first game that really kicks off with it, WG.umbral.wardFor: from then it trims only that
// game's draw, and only that game's end uses it up. A game drawn before it was readied, left half-played and resumed,
// never kicked off with it, so it never spends it)
function wUmbHexCut(id) {
  const U = wUmb(); if (!U || !U.ward) return 0;
  // (a bound game called off without an end, or dropped on a reload, frees the ward for the next game)
  if (U.wardFor && !wUmbWardLive(U.wardFor)) U.wardFor = null;
  return !U.wardFor || U.wardFor === id ? 1 : 0;
}
// every game left half-played, by its own saved world (WG[k].live.world)
function wUmbLiveWorlds() {
  const out = []; if (!WG) return out;
  for (const k in WG) { const L = WG[k] && typeof WG[k] === 'object' && WG[k].live; if (L && L.world) out.push(L.world); }
  return out;
}
// the game a ward is bound to is still on: a sport's game half-played, or a card champion's match under way
function wUmbWardLive(id) {
  // (the Seal's round: always the current one, read from WG.umbral the way the game picks it, never a round cached
  // earlier, and without building it. A list that isn't settled can't be read: the ward stays bound)
  let e = null;
  if (id === 'finale') {
    // (a list never settled means the Seal never started: nothing of it can be live)
    const U = wUmb(), sp = U && U.finaleSports;
    if (!sp || sp.length !== W_UMB5.rounds) return false;
    e = W_UMB5.engine[sp[Math.min(U.finale || 0, W_UMB5.rounds - 1)]];
  } else { const C = W_NADIR[id]; if (!C) return false; e = C.engine; }
  if (e) {
    // (that sport's game must be live, and if its saved world is found, be this one: a Nadir game of that sport kicked
    // off for this champion, or the Seal. Another sport's game, or a light-side one, says nothing about it)
    const f = W_UMB4.live[e]; let on = true; try { on = f ? !!f() : true; } catch (err) { on = true; }
    if (!on) return false;
    const ws = wUmbLiveWorlds().filter(w => w.kind === W_UMB8H.kindOf[e]);
    return ws.length ? ws.some(w => w.ref && w.ref.id === id) : true;
  }
  const W = RUN && RUN.pending && RUN.pending.world; return !!(W && W.kind === 'nadir' && W.ref && W.ref.id === id);
}
const wUmbCutHexes = (id, hx) => { const n = Math.max(0, wUmbHexCut(id) || 0); return Array.isArray(hx) && n ? hx.slice(0, Math.max(0, hx.length - n)) : hx; };
const wUmbWardBind = id => { const U = wUmb(); if (U && U.ward && !U.wardFor && id) U.wardFor = id; };
// every sport's kickoff pays its toll here (a resume doesn't); a card champion's match starts at fightStart
const wWU8HTollAtKickoff = wUmbTollAtKickoff;
wUmbTollAtKickoff = function (id) { wUmbWardBind(id); return wWU8HTollAtKickoff.apply(this, arguments); };
onHook('fightStart', () => { const W = RUN && RUN.pending && RUN.pending.world; if (B && W && W.kind === 'nadir' && W.ref) wUmbWardBind(W.ref.id); });
const wWU8HHexes = wUmbHexes; wUmbHexes = function (id) { return wUmbCutHexes(id, wWU8HHexes.apply(this, arguments)); };
const wWU8HBallHexes = wUmb4aHexes; wUmb4aHexes = function (id) { return wUmbCutHexes(id, wWU8HBallHexes.apply(this, arguments)); };
const wWU8HGfHexes = wUmbGfHexes; wUmbGfHexes = function (id) { return wUmbCutHexes(id, wWU8HGfHexes.apply(this, arguments)); };
const wWU8HRingHexes = wUmbRingHexes; wUmbRingHexes = function (id) { return wUmbCutHexes(id, wWU8HRingHexes.apply(this, arguments)); };
const wWU8HBkHexes = wUmbBkHexes; wUmbBkHexes = function (id) { return wUmbCutHexes(id, wWU8HBkHexes.apply(this, arguments)); };
const wWU8HHkHexes = wUmbHkHexes; wUmbHkHexes = function (id) { return wUmbCutHexes(id, wWU8HHkHexes.apply(this, arguments)); };
const wWU8HGlHexes = wUmbGlHexes; wUmbGlHexes = function (id) { return wUmbCutHexes(id, wWU8HGlHexes.apply(this, arguments)); };
const wWU8HBlHexes = wUmbBlHexes; wUmbBlHexes = function (id) { return wUmbCutHexes(id, wWU8HBlHexes.apply(this, arguments)); };
const wWU8HCrHexes = wUmbCrHexes; wUmbCrHexes = function (id) { return wUmbCutHexes(id, wWU8HCrHexes.apply(this, arguments)); };
const wWU8HJtHexes = wUmbJtHexes; wUmbJtHexes = function (id) { return wUmbCutHexes(id, wWU8HJtHexes.apply(this, arguments)); };
// the ward is used up by the game it was readied for, won or lost (a game backed away from never ends: it keeps)
const wWU8HOnNadir = W_ON_END.nadir;
W_ON_END.nadir = function () {
  // (cleared first, so an error further down the chain can't leave it for the next game; said after the game's own lines)
  const U = wUmb(), ref = arguments[1], had = U && U.ward && ref && ref.id && U.wardFor === ref.id;
  if (had) { U.ward = 0; U.wardFor = null; }
  try { return wWU8HOnNadir.apply(this, arguments); } finally { if (had && !(RUN && RUN.over)) { if (!LAB) wLog('The Hex Ward unravels. It did its work.', 'd'); wSave(); } }
};

/* ---------- the draught ---------- */
onHook('fightStart', () => {
  const U = wUmb(), W = RUN && RUN.pending && RUN.pending.world;
  if (!B || !U || !U.ichor || !W || !W.umbral) return;
  U.ichor = 0; addSt(B.P, 'str', W_UMB8H.str);
  log(`The Ichor Draught: your team starts with ${W_UMB8H.str} Strength.`, 'sys');
});

/* ---------- from the Bag ---------- */
const wWU8HUseItem = wUseItem;
wUseItem = function (k) {
  if (!W_UMB8H.wares.includes(k)) return wWU8HUseItem.apply(this, arguments);
  const U = wUmb(); if (!U) return 'Only on a journey with the Umbral open.';
  if (B && !B.over && UI.view === 'fight') return 'Not during a match.';
  if (!wHas(k)) return `You have no ${DB.items[k].name}.`;
  if (k === 'uward') {
    if (U.ward) return 'A ward is already readied.'; wAddItem(k, -1); U.ward = 1; wLog('You knot the Hex Ward round your captain\'s wrist. The next Nadir game draws one hex fewer.', 'm'); }
  else if (k === 'uichor') { if (U.ichor) return 'A draught is already readied.'; wAddItem(k, -1); U.ichor = 1; wLog(`You pour the Ichor Draught. Your next card match on this side starts with ${W_UMB8H.str} Strength.`, 'm'); }
  else {
    if (!wUmbDark()) return 'Lantern Oil only burns on the dark side.';
    wAddItem(k, -1);
    wAdvance((24 * 60 - WG.min) + 7 * 60); RUN.hp = RUN.maxhp;
    if (typeof wRestLegs === 'function') wRestLegs(W_FAT.bed);
    WG.grace = W_ENC.grace;
    wUmbSound('rest');
    wLog('You light the oil where you stand. The dark keeps back from it all night, and your team is whole again by morning.', 'm');
  }
  wSave(); return '';
};
const wWU8HCampBag = wCampBag;
wCampBag = function () {
  let h = wWU8HCampBag.apply(this, arguments); const U = wUmb();
  for (const k of W_UMB8H.wares) {
    if (!wHas(k)) continue;
    const off = k === 'ulampoil' ? (wUmbDark() ? '' : 'disabled title="Only on the dark side"') : (k === 'uward' && U && U.ward) || (k === 'uichor' && U && U.ichor) ? 'disabled title="One is already readied"' : '';
    const re = new RegExp(`(<b>${DB.items[k].name}</b>[\\s\\S]*?<td class="wnum dim">have \\d+</td><td>)`);
    h = h.replace(re, `$1<button class="ghost" data-wuse="${k}" ${off}>${k === 'ulampoil' ? 'Rest' : 'Ready'}</button>`);
  }
  return h;
};

/* ---------- paying with a trophy ---------- */
const wUmbTradable = () => (RUN.relics || []).filter(id => { const R = RELICS[id]; return R && !R.gain && !R.club && !W_UMB8H.noTrade.includes(id); });
// trade a trophy for a ware: '' when done, or why not
function wUmbTrade(ware, relic) {
  if (!W_UMB8H.wares.includes(ware)) return 'Not sold here.';
  if (!wUmbTradable().includes(relic)) return 'That is not yours to trade.';
  RUN.relics.splice(RUN.relics.indexOf(relic), 1);
  wAddItem(ware, 1);
  wLog(`You hand over ${RELICS[relic].n}. The shopkeeper holds it up to the dark, and it goes grey in their hand. A ${DB.items[ware].name} is yours.`, 'd');
  wSave(); return '';
}
const wWU8HUmbShop = wUmbShop;
wUmbShop = function (shop, who) {
  const r = wWU8HUmbShop.apply(this, arguments), box = $('modalBox'); if (!box || !$('wUmbShopBody')) return r;
  const sec = document.createElement('div'); sec.id = 'wUmbTrade'; box.appendChild(sec);
  let want = null;
  const render = msg => {
    const tr = wUmbTradable();
    let h = `<h4>For a trophy</h4><p class="hint">Some things on this side are paid for with something you won. ${tr.length ? `You could trade: ${tr.map(id => esc(RELICS[id].n)).join(', ')}.` : 'You have no trophy you could trade.'}${msg ? ' <span class="wbad">' + esc(msg) + '</span>' : ''}</p>`;
    if (want) {
      h += `<p class="hint">Which trophy for the <b>${esc(DB.items[want].name)}</b>? It is gone for good.</p><div class="row">${tr.map(id => `<button class="ghost" data-utrade="${id}" title="${esc(RELICS[id].desc || '')}">${esc(RELICS[id].n)}</button>`).join('')}<button class="ghost" data-utrade="">Not now</button></div>`;
    } else {
      h += `<table class="wshop"><tbody>${W_UMB8H.wares.map(k => `<tr><td><b>${esc(DB.items[k].name)}</b><small>${esc(DB.items[k].desc)}</small></td><td class="wnum dim">have ${WG.items[k] || 0}</td><td><button class="ghost" data-uware="${k}" ${tr.length ? '' : 'disabled'}>1 trophy</button></td></tr>`).join('')}</tbody></table>`;
    }
    sec.innerHTML = h;
    sec.querySelectorAll('[data-uware]').forEach(b => b.onclick = () => { want = b.dataset.uware; render(''); });
    sec.querySelectorAll('[data-utrade]').forEach(b => b.onclick = () => { const id = b.dataset.utrade, w = want; want = null; render(id ? wUmbTrade(w, id) : ''); wDrain(); });
  };
  render('');
  return r;
};
// the wares come from the dark shops' trophy list, which the audit's own sources don't know
const wWU8HAudit = wAudit;
wAudit = function () { return wWU8HAudit.apply(this, arguments).filter(s => !W_UMB8H.wares.some(k => s === 'item ' + k + ' cannot be obtained')); };

/* ---------- How to play ---------- */
const wWU8HRenderHelp = renderHelp;
renderHelp = function () {
  wWU8HRenderHelp.apply(this, arguments);
  const h = $('wHelpUmbral'); if (!h || !wUmbOn() || $('wHelpUmbTrade')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpUmbTrade"><b>For a trophy.</b> The dark shops sell three things for one of your trophies, and nothing else will buy them: a <b>Hex Ward</b> (the next Nadir game draws one hex fewer), <b>Lantern Oil</b> (rest where you stand, once, on the dark side) and an <b>Ichor Draught</b> (your next card match there starts with ${W_UMB8H.str} Strength). The trophy is gone for good. The Seal of the Crown, a club's own trophy and one that changed your team for good can't be traded.</p>`);
};
