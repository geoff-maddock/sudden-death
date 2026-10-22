/* w14: your home ground (epic 2, phase 1). Loads after w13-feel.js; changes earlier parts only by reassignment
   (saved originals carry the wW14 prefix), one fightStart hook, and a topic added to each innkeeper.

   Buy the old ground behind any town's inn (one per journey), then build it up. It is the realm's main gold sink:
   the balance bot ended journeys with about 800 gold it had no use for (docs/realm/BALANCE.md).

   WG.ground   { town, parts: { stands, pitch, kitchen, scouts } (levels 0..2), drill: { week, n } } or null.

   Home. The ground's region is home. Every match there, except the Crown (neutral ground), has the home crowd:
   the stands give Block at kickoff, and at level 2 Strength too. The pre-game card says so.
   The training pitch drills cards (Practice ★) for free, a few a week. The kitchen puts a free meal in your pantry
   each morning you wake at the ground. The scout's office brings better and more free agents to that town's inn.
   The ground has beds: sleep there for free, and it becomes where you wake after a blackout, like any inn.

   W_GROUND   the numbers
   Wrapped: wRunAct (act 'ground'), wOpenInn (the Your ground button), wSleepInn (the kitchen), wTavern (the scouts),
   wPreGame (the home line), renderHelp. */

const W_GROUND = {
  price: 150,
  inns: { graftonbury: 'hq_inn', mossgate: 'moss_inn', saltmere: 'salt_inn', cinderhold: 'cind_inn', rimewatch: 'rime_inn' },
  parts: {
    stands: { name: 'The stands', costs: [100, 200], does: ['Home matches start with 6 Block.', 'Home matches start with 6 Block and 1 Strength.'] },
    pitch: { name: 'Training pitch', costs: [120, 240], does: ['Drill 1 card a week (Practice ★), free.', 'Drill 2 cards a week (Practice ★), free.'] },
    kitchen: { name: 'The kitchen', costs: [80, 160], does: ['Wake at the ground to a free hash.', 'Wake at the ground to a free hash and the town\'s best dish.'] },
    scouts: { name: 'Scout\'s office', costs: [100, 200], does: ['Free agents at this inn are a level higher, and at least 2 come each week.', 'Free agents at this inn are two levels higher, and 3 come each week.'] },
  },
  block: 6,
  pantryCap: 2,   // the kitchen stops cooking a dish you already have this many of
};

/* ---------- the model ---------- */
function wHomeGround() { return (WG && WG.ground) || null; }
function wGroundLv(part) { const G = wHomeGround(); return G ? G.parts[part] || 0 : 0; }
function wTownRegion(town) { const L = DB.locs.find(l => l.map === town); return L ? regionAt(L.x, L.y) : 'plains'; }
function wHomeRegion() { const G = wHomeGround(); return G ? wTownRegion(G.town) : null; }
function wTownName(town) { return (MAPS[town] || {}).name || town; }
/* a match is at home in the ground's region; the Crown is played on neutral ground */
function wIsHome(W) {
  if (!W || !wHomeGround()) return false;
  if (W.kind === 'cup' && W.ref && W.ref.cup === 'crown') return false;
  return W.region === wHomeRegion();
}
function wBuyGround(town) {
  town = town || WG.map;
  if (wHomeGround()) return `You already have a ground, in ${wTownName(WG.ground.town)}.`;
  if (!W_GROUND.inns[town]) return 'There is no ground for sale here.';
  if (RUN.gold < W_GROUND.price) return 'You cannot afford it.';
  RUN.gold -= W_GROUND.price;
  WG.ground = { town, parts: { stands: 0, pitch: 0, kitchen: 0, scouts: 0 }, drill: { week: -1, n: 0 } };
  achAdd('realmGroundWork', 1);
  wLog(`You buy the old ground in ${wTownName(town)} for ${W_GROUND.price} gold. ${DB.regions[wHomeRegion()].name} is home now.`, 'g');
  wSave();
  return '';
}
function wGroundCost(part) { const P = W_GROUND.parts[part], lv = wGroundLv(part); return P && lv < P.costs.length ? P.costs[lv] : null; }
function wUpgradeGround(part) {
  const G = wHomeGround(), P = W_GROUND.parts[part];
  if (!G) return 'You have no ground.';
  if (!P) return 'There is nothing like that to build.';
  const cost = wGroundCost(part);
  if (cost == null) return `${P.name} is as good as it gets.`;
  if (RUN.gold < cost) return 'You cannot afford that.';
  RUN.gold -= cost; G.parts[part]++;
  achAdd('realmGroundWork', 1);
  wLog(`You build up ${P.name.toLowerCase()} (level ${G.parts[part]}) for ${cost} gold. ${P.does[G.parts[part] - 1]}`, 'g');
  wSave();
  return '';
}
/* the training pitch: free drills, a few a week */
function wDrillsLeft() {
  const G = wHomeGround(), lv = wGroundLv('pitch'); if (!G || !lv) return 0;
  if (G.drill.week !== wWeek()) G.drill = { week: wWeek(), n: 0 };
  return Math.max(0, lv - G.drill.n);
}
function wDrill(card) {
  if (!wDrillsLeft()) return 'No drills left this week.';
  if (!card || !RUN.deck.includes(card) || !practicable(card)) return 'That card cannot take a drill.';
  card.sk = 1; WG.ground.drill.n++;
  achAdd('practice', 1);
  wAdvance(60);
  wLog(`Your team drills ${wCardName(card.id, card.up)} on the training pitch (★).`, 'm');
  wSave();
  return '';
}
/* the kitchen: a free meal each morning you wake at the ground */
function wGroundBreakfast() {
  const lv = wGroundLv('kitchen'); if (!lv) return [];
  const menu = DB.innMenu[W_GROUND.inns[WG.ground.town]] || {};
  const best = Object.keys(menu).filter(id => id !== 'hash').sort((a, b) => menu[b] - menu[a])[0];
  const dishes = ['hash'].concat(lv >= 2 && best ? [best] : []), got = [];
  for (const id of dishes) {
    if (!DB.meals[id] || (wPantry()[id] || 0) >= W_GROUND.pantryCap) continue;
    WG.pantry[id] = (WG.pantry[id] || 0) + 1; got.push(DB.meals[id].name);
  }
  if (got.length) wLog(`The ground's kitchen packs ${got.join(' and ')} for you. It is in your pantry.`, 'm');
  return got;
}
function wSleepGround() {
  if (!wHomeGround() || WG.map !== WG.ground.town) return 'Your ground is not here.';
  const r = wSleepInn(0);
  if (!r) wGroundBreakfast();
  wSave();
  return r;
}

/* ---------- at kickoff: the home crowd ---------- */
onHook('fightStart', () => {
  if (!WG || !RUN || !B || !RUN.pending || !wIsHome(RUN.pending.world)) return;
  const lv = wGroundLv('stands');
  B.wHome = 1;
  if (lv) { B.P.block += W_GROUND.block; if (lv >= 2) addSt(B.P, 'str', 1); }
  log(`Home crowd, ${wTownName(WG.ground.town)}${lv ? `: ${W_GROUND.block} Block${lv >= 2 ? ' and 1 Strength' : ''}` : ''}.`, 'good');
  if (!LAB) fx({ k: 'banner', t: 'Home crowd', sub: lv ? W_GROUND.parts.stands.does[lv - 1] : 'Build the stands for a real home advantage.', small: 1 });
});

/* ---------- the scouts: a better corner at the ground's own inn ---------- */
const wW14Tavern = wTavern;
wTavern = function (town) {
  town = town || WG.map;
  const old = WG.tavern[town], fresh = !old || old.week !== wWeek();
  const T = wW14Tavern(town), lv = wHomeGround() && WG.ground.town === town ? wGroundLv('scouts') : 0;
  if (!fresh || !lv) return T;
  const want = lv + 1;
  for (let g = 0; T.list.length < want && g < 10; g++) {
    const kinds = (DB.regions[wTownRegion(town)] || DB.regions.plains).kinds, taken = new Set(wRoster().map(p => p.n).concat(T.list.map(a => a.n)));
    const r = shuffle(genDraftClass().filter(r => kinds.includes(r[1]) && !taken.has(r[0])))[0];
    if (!r) break;
    const tier = W_TIER[wTownRegion(town)] || 1, l = ri(1, 2) + (tier - 1) * 2;
    T.list.push({ n: r[0], kind: r[1], num: r[2], flav: r[3], lvl: l, fee: wFee(l) });
  }
  for (const a of T.list) { a.lvl = clamp(a.lvl + lv, 1, W_PARTY.maxLvl); a.fee = wFee(a.lvl); }
  return T;
};

/* ---------- the ground screen ---------- */
function wOpenGround(town, msg) {
  town = town || WG.map;
  const G = wHomeGround(), here = G && G.town === town;
  let body;
  if (!G) {
    const rg = DB.regions[wTownRegion(town)];
    body = `<p>The old ground behind the inn is for sale: <b class="wgold">${W_GROUND.price} gold</b>. You have ${RUN.gold}.</p>
      <p class="hint">Buy it and ${esc(rg.name)} is home: every match in the region has your crowd behind it (not the Crown, which is neutral ground). Build stands, a training pitch, a kitchen and a scout's office. The ground has beds, free. You can only own one ground, so choose the region you will play in most.</p>
      <div class="row"><button class="btn" id="wBuyGround" ${RUN.gold < W_GROUND.price ? 'disabled' : ''}>Buy the ground (${W_GROUND.price} gold)</button></div>`;
  } else if (!here) {
    body = `<p>Your ground is in ${esc(wTownName(G.town))}. ${esc(DB.regions[wHomeRegion()].name)} is home.</p><p class="hint">Build it up there.</p>`;
  } else {
    const drills = wDrillsLeft();
    body = `<p class="hint">${esc(DB.regions[wHomeRegion()].name)} is home: matches there have your crowd (not the Crown). You have <b class="wgold">${RUN.gold} gold</b>.</p>
      <table class="wshop"><tbody>${Object.keys(W_GROUND.parts).map(k => {
        const P = W_GROUND.parts[k], lv = G.parts[k], cost = wGroundCost(k);
        return `<tr><td><b>${esc(P.name)}</b> <span class="dim">level ${lv} of ${P.costs.length}</span><small>${esc(lv ? P.does[lv - 1] : 'Not built.')}${cost != null ? ' Next: ' + esc(P.does[lv]) : ''}</small></td><td class="wnum">${cost != null ? cost + 'g' : ''}</td><td>${cost != null ? `<button class="ghost" data-wgup="${k}" ${RUN.gold < cost ? 'disabled' : ''}>${lv ? 'Upgrade' : 'Build'}</button>` : '<span class="dim">Done</span>'}</td></tr>`;
      }).join('')}</tbody></table>
      <div class="row"><button class="btn" id="wGroundSleep">Sleep here (free)</button>${G.parts.pitch ? `<button class="ghost" id="wGroundDrill" ${drills ? '' : 'disabled'}>Drill a card (${drills} left this week)</button>` : ''}</div>`;
  }
  const close = modal(`<header><h3>${here || !G ? 'Your ground, ' + esc(wTownName(town)) : 'Your ground'}</h3><button class="ghost" data-close>Done</button></header>${msg ? `<p class="wbad">${esc(msg)}</p>` : ''}${body}`);
  const again = r => { close(); wDrain(); wOpenGround(town, r); };
  if ($('wBuyGround')) $('wBuyGround').onclick = () => again(wBuyGround(town));
  $('modalBox').querySelectorAll('[data-wgup]').forEach(b => b.onclick = () => again(wUpgradeGround(b.dataset.wgup)));
  if ($('wGroundSleep')) $('wGroundSleep').onclick = () => { const r = wSleepGround(); close(); if (typeof wCloseTalk === 'function') wCloseTalk(); if (r) wLog(r, 'b'); wDrain(); };
  if ($('wGroundDrill')) $('wGroundDrill').onclick = () => { close(); wPickCard(RUN.deck.filter(practicable), 'Drill a card', 'It gains Practice ★. Free, an hour.', card => { const r = card ? wDrill(card) : ''; wDrain(); wOpenGround(town, r); }); };
}

/* ---------- the innkeepers sell it ---------- */
for (const town in W_GROUND.inns) {
  const ch = DB.chars[W_GROUND.inns[town]]; if (!ch) continue;
  ch.topics.ground = { t: 'The old ground out back? Seats a fair crowd, if somebody fixed the stands. It is yours for the right price, and a team plays better at home.', act: 'ground' };
  ch.topics.job.t += ' The old GROUND out back is for sale.';
}
const wW14RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'ground') return LAB ? null : wOpenGround(WG.map);
  return wW14RunAct(act, id);
};
const wW14OpenInn = wOpenInn;
wOpenInn = function (price, who) {
  wW14OpenInn(price, who);
  const row = $('wSleep') && $('wSleep').parentNode; if (!row || !W_GROUND.inns[WG.map]) return;
  const G = wHomeGround(), label = !G ? 'The ground (for sale)' : G.town === WG.map ? 'Your ground' : '';
  if (!label) return;
  row.insertAdjacentHTML('beforeend', `<button class="ghost" id="wInnGround">${label}</button>`);
  $('wInnGround').onclick = () => wOpenGround(WG.map);
};

/* ---------- the pre-game card ---------- */
const wW14PreGame = wPreGame;
wPreGame = function (enc) {
  wW14PreGame(enc);
  const box = document.querySelector('#modalBox .wpgtxt'); if (!box || !wHomeGround()) return;
  const W = enc.world, lv = wGroundLv('stands');
  let t = '';
  if (wIsHome(W)) t = `A home game: your crowd is here.${lv ? ' ' + W_GROUND.parts.stands.does[lv - 1] : ' Build the stands for Block at kickoff.'}`;
  else if (W.kind === 'cup' && W.ref && W.ref.cup === 'crown') t = 'The Crown is neutral ground: no home crowd.';
  if (t) box.insertAdjacentHTML('beforeend', `<p class="hint wground">${esc(t)}</p>`);
};

/* ---------- a tip, an achievement, How to play ---------- */
TIPS.w_ground = ['A ground of your own', 'Every inn has an old ground out back for sale. Buy one and its region is home: your crowd at every match there, free beds, and upgrades to spend your gold on. Ask the innkeeper about the GROUND.'];
setInterval(() => {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world' || wHomeGround()) return;
  if (W_GROUND.inns[WG.map] && RUN.gold >= W_GROUND.price + 50 && $('modal').hidden) tip('w_ground');
}, 900);
ACH.push({ id: 'w_ground', n: 'Home Ground', d: 'Buy a ground and build it up (each buy or upgrade counts)', stat: 'realmGroundWork', at: [1, 5, 9] });
const wW14RenderHelp = renderHelp;
renderHelp = function () {
  wW14RenderHelp();
  const sec = $('wHelp'); if (!sec || $('wHelpGround')) return;
  const P = W_GROUND.parts;
  // in journey order: straight after Towns
  const towns = $('wHelpTowns');
  (towns || sec).insertAdjacentHTML(towns ? 'afterend' : 'beforeend', `<div id="wHelpGround"><h4>Your home ground</h4>
    <p class="hint">Every inn has an old ground out back, for ${W_GROUND.price} gold (ask the innkeeper about the GROUND, or use the inn's Your ground button). You can own one. Its region is <b>home</b>: every match there has your crowd behind it, except the Crown, which is neutral ground. The ground has beds, free, and you wake there after a blackout if you slept there last.</p>
    <p class="hint">Build it up, two levels each: <b>${P.stands.name}</b> (${esc(P.stands.does[1].toLowerCase())}), <b>${P.pitch.name}</b> (free Practice ★ drills each week), <b>${P.kitchen.name}</b> (a free meal when you wake there) and the <b>${P.scouts.name.toLowerCase()}</b> (better free agents at that inn).</p></div>`);
};
