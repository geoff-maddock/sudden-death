/* w140: baseball gear and potions (issue #115, phase 1), by #61's conventions; the engine's side is
   src/bd/parts/51-kit.js, the plumbing (W_GEAR, W_POTIONS, the slot, the Bag) is w72.
   Gear (W_DIAMOND_GEAR, one piece a player, p.gear.diamond): Brimstone Diamond's own magic bats and balls, which the
   Realm left off (W_BALL.rules.gear stays false: no club lockers), are now a player's gear. A bat is the wearer's own
   ⚒ swing when they bat, a ball their own ⚒ pitch when they pitch, each with its uses a game (back every game). Three
   more: a Wyvern-Hide Glove (the field), a Rosin Bag (the mound) and Iron Spikes (+1 speed). The Graftonbury store
   sells six, chests hold seven, and the Diamond Cup adds the first piece you don't have. It reaches the engine through
   wNineBdPlayer (the player's gear and gx; a rating the piece adds goes on the player the engine gets), never by
   changing the player's own ratings (p.bd).
   Potions: the Stamina Draught (football's item, serving the diamond too: your pitcher's stamina), and a Brimstone
   Tonic, Owl-Eye Drops and Steadyhand Balm from the Graftonbury store. In a ball game you play (Play or Manage), between
   half-innings (from the last out until the first pitch of the next half), from the Bag row above the field, one a
   break, with your coach's word; each comes out of your bag when given. Your coach never gives one (Manage and Auto
   powers don't), and Simulate leaves the bag alone. The other nine brings W_DIAMOND_KIT.opp[tier] and gives at its
   skill, logged in the play-by-play with its reason (⚗); the game card says what each club brings.
   Wraps: wGearLive (wW140GearLive: the diamond), wNineBdPlayer (wW140NineBdPlayer: gear's ratings and the piece),
   wStartBall (wW140StartBall: their bag goes in), wResumeBall (wW140ResumeBall: an older save's bag), wNineStats
   (wW140NineStats: the gear on the Nine tab), wOpenBallCard (wW140OpenBallCard: the bags on the card), wDcupWon
   (wW140DcupWon: a piece of gear), renderHelp (wW140RenderHelp: #wHelpBallKit); and wBD.start, wBD.sim (the bags go
   in). */

W_GEAR_CFG.sports.diamond = 'baseball';
W_GEAR_STATN.diamond = { pow: 'power', con: 'contact', spd: 'speed', arm: 'arm', fld: 'fielding' };
const W_BD_ENGINE_GEAR = wBD.gear();
// the engine's bats and balls, by id, at Realm prices
const W_DIAMOND_MAGIC = { splinter: 35, hornet: 45, thunder: 55, lodestone: 90, dragonbone: 110, leaden: 35, ghost: 50, hellfire: 55, quicksilver: 95, wyrmeye: 85 };
const W_DIAMOND_GEAR = {};
for (const k of Object.keys(W_DIAMOND_MAGIC)) {
  const E = W_BD_ENGINE_GEAR[k]; if (!E) continue;
  const bat = E.type === 'bat';
  W_DIAMOND_GEAR['bd_' + k] = { sport: 'diamond', name: E.n, price: W_DIAMOND_MAGIC[k],
    desc: `${E.desc} Their own ⚒ ${bat ? 'swing when they bat' : 'pitch when they pitch'}: ${E.uses} a game.`, fx: bat ? { bat: k } : { ball: k } };
}
Object.assign(W_DIAMOND_GEAR, {
  bd_glove: { sport: 'diamond', name: 'Wyvern-Hide Glove', price: 50, desc: 'A deep pocket: in the field they reach a foot further for the ball, and bobble a third less.', fx: { reach: 1, bob: .67 } },
  bd_rosin: { sport: 'diamond', name: 'Rosin Bag', price: 40, desc: 'A dry grip on the mound: every pitch they throw scatters a tenth less.', fx: { ctrl: .9 } },
  bd_spikes: { sport: 'diamond', name: 'Iron Spikes', price: 45, desc: 'They bite the dirt: +1 speed, on the bases and in the field.', fx: { r: { spd: 1 } } },
});
for (const id of Object.keys(W_DIAMOND_GEAR)) wGearAdd(id, W_DIAMOND_GEAR[id]);
const W_DIAMOND_KIT = {
  potions: { bdtonic: 35, bdeye: 40, bdsteady: 40 }, // prices (the Stamina Draught's is football's: one item, every sport)
  store: ['bd_splinter', 'bd_hornet', 'bd_leaden', 'bd_ghost', 'bd_glove', 'bd_rosin'], // Graftonbury's (the hq shop)
  cup: ['bd_dragonbone', 'bd_quicksilver', 'bd_lodestone', 'bd_wyrmeye', 'bd_thunder', 'bd_hellfire', 'bd_spikes', 'bd_glove', 'bd_rosin', 'bd_hornet', 'bd_ghost', 'bd_splinter', 'bd_leaden'], cupGold: 60,
  // the other nine's bag by tier (4 is the Umbral's tier U)
  opp: { 1: { draught: 1 }, 2: { draught: 1, bdtonic: 1 }, 3: { draught: 1, bdtonic: 1, bdeye: 1, bdsteady: 1 }, 4: { draught: 2, bdtonic: 1, bdeye: 1, bdsteady: 1 } },
};
for (const id of Object.keys(wBD.potions)) {
  const P = wBD.potions[id];
  if (id === 'draught') {
    W_POTIONS[id].sports = (W_POTIONS[id].sports || ['grid']).concat('diamond');
    DB.items[id].desc += ` On the diamond: ${P.desc.charAt(0).toLowerCase()}${P.desc.slice(1)}`;
    DB.items[id].use += ' Or in a ball game, between half-innings, one a break.';
    continue;
  }
  wPotionAdd(id, { sport: 'diamond' });
  DB.items[id] = { name: P.n, desc: P.desc, use: 'In a ball game, between half-innings: the Bag row above the field. One potion a break.', price: W_DIAMOND_KIT.potions[id] };
}
if (DB.shops.hq) { for (const id of Object.keys(W_DIAMOND_KIT.potions)) DB.shops.hq[id] = W_DIAMOND_KIT.potions[id]; for (const id of W_DIAMOND_KIT.store) DB.shops.hq[id] = W_DIAMOND_GEAR[id].price; }
for (const [c, it] of [['deepseam_vault', 'bd_thunder'], ['emberdeep_vault', 'bd_hellfire'], ['genevault_vault', 'bd_lodestone'], ['hatchery_vault', 'bd_wyrmeye'], ['shrine_chest', 'bd_spikes'], ['emberdeep_prize', 'bd_dragonbone'], ['genevault_c6', 'bd_quicksilver'],
  ['marigold_chest', 'bdtonic'], ['cottage_chest', 'bdeye'], ['chapel_chest', 'bdsteady']]) {
  const C = DB.chests[c]; if (C) { C.items = C.items || {}; C.items[it] = (C.items[it] || 0) + 1; }
}
const wW140GearLive = wGearLive;
wGearLive = function (sport) { return sport === 'diamond' ? wBallLive() : wW140GearLive(sport); };
// a roster player's baseball gear: its ratings (past the cap by W_GEAR_CFG.over at most), and the piece (gear, gid, gx)
const wW140NineBdPlayer = wNineBdPlayer;
wNineBdPlayer = function (p, pos) {
  const g = wW140NineBdPlayer(p, pos), G = p && p.id != null && wPlayer(p.id) === p ? wGearOf(p, 'diamond') : null;
  if (G) {
    Object.assign(g, wGearRate(Object.fromEntries(wBD.stats.map(s => [s, g[s]])), G, W_BDR.cap));
    const gx = JSON.parse(JSON.stringify(G.fx || {})); delete gx.r;
    g.gear = G.name; g.gid = G.id; g.gx = gx;
  }
  return g;
};

/* ---------- the bags go in ---------- */
const WDK = { next: null };
let W_BALL_KITMSG = '', W_BALL_KITKEY = '';
const wBallBagMine = () => Object.fromEntries(wMatchBag('diamond').filter(x => wBD.potions[x.id]).map(x => [x.id, x.n]));
const wBallBagWords = bag => { const ks = Object.keys(bag).filter(id => bag[id] > 0 && wBD.potions[id]); return ks.length ? ks.map(id => `${bag[id]} ${wBD.potions[id].n}`).join(', ') : 'nothing'; };
const wBallBagTheirs = tier => Object.assign({}, W_DIAMOND_KIT.opp[tier] || {});
const wW140StartBall = wStartBall;
wStartBall = function (o) {
  W_BALL_KITMSG = '';
  const theirs = wBallBagTheirs((o && o.tier) || (o && o.club ? wBallTier(o.club) : 1));
  WDK.next = o && o.home ? [theirs, null] : [null, theirs];
  try { return wW140StartBall(o); } finally { WDK.next = null; }
};
// (only a game wStartBall starts: an exhibition, or a cup game between two other clubs, brings none)
const wW140Start = wBD.start, wW140Sim = wBD.sim;
// (taken once: a cup's other games, simulated when yours ends inside wStartBall, bring none)
const wBallBagsNext = o => { const b = WDK.next; WDK.next = null; return b ? Object.assign({}, o, { bags: b }) : o; };
wBD.start = o => wW140Start(wBallBagsNext(o));
wBD.sim = o => wW140Sim(wBallBagsNext(o));
// a game saved before bags came in: the other club's bag by its tier
const wW140ResumeBall = wResumeBall;
wResumeBall = function () {
  wW140ResumeBall();
  const L = wBallLive() && WG.ball.live, K = wBD.kit; if (!L || !K || !WD || !WD.ball) return;
  const them = L.world.home ? 0 : 1;
  if (!K.bags[them] && !K.pots.some(x => x.side === them)) K.bags[them] = wBallBagTheirs(L.world.tier || 1);
};

/* ---------- your Bag, between half-innings ---------- */
function wBallPotion(id) {
  const L = wBallLive() && WG.ball.live;
  if (!L || !WD || !WD.ball || L.world.how === 'sim' || !wBD.live) return 'Potions are for ball games you play, not exhibitions.';
  if (!wHas(id)) return `You have no ${(wBD.potions[id] || {}).n || 'such potion'}.`;
  const r = wBD.potion(id); if (r) return r;
  // (the save point is the start of this pitch with the potion given, when that is where the game is: a reload can't
  // give it back; given in the break itself, the next pitch's save point has it)
  wAddItem(id, -1); wBD.snapNow(); wSave(); return '';
}
$('wDiamondBar').insertAdjacentHTML('afterend', '<div id="wBallBagRow" class="wdbar wdbag" hidden><b>Bag</b><span id="wBallBag"></span></div>');
function wBallBagRows(force) {
  const row = $('wBallBagRow'), L = WD && WD.ball && wBallLive() && WG.ball.live, K = wBD.kit;
  const show = UI.view === 'diamond' && !!L && L.world.how !== 'sim' && wBD.live && !!K;
  if (row.hidden !== !show) row.hidden = !show;
  if (!show) { W_BALL_KITKEY = ''; return; }
  const you = L.world.home ? 1 : 0, bag = wBallBagMine(), ids = Object.keys(bag), given = K.open && K.used[you] === K.key, open = K.open && !given;
  const adv = open ? wBD.advice(bag) : null;
  const key = JSON.stringify([open, given, bag, adv && adv.id, W_BALL_KITMSG]);
  if (!force && key === W_BALL_KITKEY) return;
  W_BALL_KITKEY = key;
  $('wBallBag').innerHTML = (ids.length ? ids.map(id => { const P = wBD.potions[id];
      return `<button class="ghost${adv && adv.id === id ? ' on' : ''}" data-bkuse="${id}" ${open ? '' : 'disabled'} title="${esc(P.desc)}">${esc(P.n)} (${bag[id]})</button>`; }).join(' ')
    : '<small class="hint">No baseball potions in your bag. The Graftonbury store sells them.</small>')
    + ` <small class="hint">${open ? 'Between half-innings: one potion now, before the first pitch.' : given ? 'Given for this break.' : 'The next break is after the third out.'}</small>`
    + (W_BALL_KITMSG ? ` <small class="wbad">${esc(W_BALL_KITMSG)}</small>` : '')
    + (adv ? ` <small class="hint">Your coach says: <b>${esc(wBD.potions[adv.id].n)}</b>, ${esc(adv.why)}.</small>` : '');
}
$('wBallBagRow').addEventListener('click', e => {
  const b = e.target.closest('[data-bkuse]'); if (!b || b.disabled) return;
  W_BALL_KITMSG = wBallPotion(b.dataset.bkuse); b.blur(); wBallBagRows(true);
});
// (a refusal is for its break: the next one clears it)
let W_BALL_KITOPEN = false;
setInterval(() => { const K = wBD.kit, o = !!(K && K.open); if (o && !W_BALL_KITOPEN) W_BALL_KITMSG = ''; W_BALL_KITOPEN = o; wBallBagRows(); }, 250);

/* ---------- the Nine tab, the card and the cup ---------- */
const wW140NineStats = wNineStats;
wNineStats = function (p, pos) {
  const html = wW140NineStats(p, pos), g = p && p.id != null && wPlayer(p.id) === p ? wGearOf(p, 'diamond') : null;
  return g ? `${html} <small class="wnst" title="${esc(g.desc)}">Plays with the <b>${esc(g.name)}</b>.</small>` : html;
};
const wW140OpenBallCard = wOpenBallCard;
wOpenBallCard = function (o) {
  wW140OpenBallCard(o);
  const ul = document.querySelector('#modalBox .wbclubs'); if (!ul) return;
  ul.insertAdjacentHTML('afterend', `<p class="hint" data-bkbags>What their nines bring: ${[1, 2, 3].map(t => `tier ${t}, ${esc(wBallBagWords(W_DIAMOND_KIT.opp[t]))}`).join('; ')}. Yours is your bag (${esc(wBallBagWords(wBallBagMine()))}): give from it between half-innings, in the Bag row above the field, when you Play or Manage. Simulate leaves it alone.</p>`);
};
const wW140DcupWon = wDcupWon;
wDcupWon = function () {
  wW140DcupWon();
  const have = id => (WG.items[id] || 0) > 0 || wRoster().some(p => p.gear && p.gear.diamond === id);
  const id = W_DIAMOND_KIT.cup.find(x => !have(x));
  if (id) { wAddItem(id, 1); wLog(`The Cup comes with gear: the ${W_DIAMOND_GEAR[id].name}. ${W_DIAMOND_GEAR[id].desc}`, 'g'); }
  else { RUN.gold += W_DIAMOND_KIT.cupGold; wLog(`You have every piece of baseball gear, so the Cup pays ${W_DIAMOND_KIT.cupGold} gold more instead.`, 'g'); }
};

const wW140RenderHelp = renderHelp;
renderHelp = function () {
  wW140RenderHelp();
  const after = $('wHelpBall'); if (!after || $('wHelpBallKit')) return;
  const names = t => Object.values(W_DIAMOND_GEAR).filter(g => g.fx[t]).map(g => g.name);
  const list = a => a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpBallKit"><b>Baseball gear and potions.</b> Each player can wear one piece of baseball gear. A magic bat (${list(names('bat'))}) gives them their own ⚒ swing when they bat, and a magic ball (${list(names('ball'))}) their own ⚒ pitch when they pitch: each has a few uses a game, back every game. A Wyvern-Hide Glove helps in the field, a Rosin Bag on the mound, and Iron Spikes add speed. The Graftonbury store sells the cheaper pieces, chests hold more, and the Diamond Cup adds a piece you don't have. Put gear on from the Bag on the Team screen. In a game you play or manage, between half-innings (from the last out until the next half's first pitch), give one potion from the Bag row above the field: the Stamina Draught (your pitcher's stamina back), a Brimstone Tonic (two mana), Owl-Eye Drops (a bigger swing circle the next time you bat) or Steadyhand Balm (a tighter pitch the next time you field). Esc stops the game while you choose. Your coach says which suits the moment but never opens your bag, and Simulate leaves it alone. The other nine brings potions by tier and uses them: the play-by-play says when, and why (⚗).</p>`);
};
