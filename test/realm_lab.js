// headless realm runs: the realm's own match flow (startMatch, cups, rooms, alphas, rewards, XP, recruits), with the
// fight played by the model only. A scripted route stands in for walking: wild games, the four cups, the dungeons and
// lairs as they open, then the Crown. Between matches the bot rests, signs players, eats and enchants like a player.
window.REALMLAB = function (opts = {}) {
  LAB = true;
  // the model only: no fight scene, no reward panel (the bot takes the rewards itself, as test/lab.js does)
  beginFight = enc => { UI.busy = false; startCombat(enc.ids, enc.type, enc.sport, enc.trait); };
  renderPanel = () => { };
  const est = (c, tgt) => { const d = def(c); let dmg = 0, blk = 0; const walk = ops => { for (const o of ops) { if (o[0] === 'd') { const n = (o[3] || d.tgt) === 'all' ? alive().length : 1; dmg += atkDmg(o[1], tgt, c) * (o[2] || 1) * n; } else if (o[0] === 'drain' || o[0] === 'dunk') dmg += atkDmg(o[1], tgt, c); else if (o[0] === 'b') blk += o[1] + sv(B.P, 'dex'); else if (o[0] === 'bodyslam') dmg += B.P.block; else if (o[0] === 'roll') { walk(o[2].map(x => x)); } else if (o[0] === 'bones') blk += Math.min(36, o[1] * B.draw.length); } }; walk(d.fx); return { dmg, blk }; };
  // the same two players as test/lab.js: skilled, or careless (opts.dumb)
  function botTurn() {
    let guard = 0;
    if (opts.dumb) {
      while (B.phase === 'player' && !B.over && guard++ < 30) { const al = alive(); if (!al.length) break; const ok = B.hand.map((c, i) => [c, i]).filter(([c]) => canPlay(c) && def(c).type !== 'junk'); if (!ok.length) break; const [c, i] = pick(ok); playCard(i, B.enemies.indexOf(pick(al))); }
      return;
    }
    while (B.phase === 'player' && !B.over && guard++ < 30) {
      const al = alive(); if (!al.length) break;
      let incoming = 0; for (const e of al) { if (sv(e, 'stun')) continue; const I = intentInfo(e); if (I.kinds.includes('atk')) incoming += I.dmg * I.hits; }
      const need = Math.max(0, incoming - B.P.block);
      const tgt = al.slice().sort((a, b) => (a.hp + a.block) - (b.hp + b.block))[0];
      let best = null, bs = 0;
      B.hand.forEach((c, i) => {
        if (!canPlay(c)) return; const d = def(c);
        let s = 0;
        if (d.type === 'pow') s = B.turn <= 3 ? 40 : 6;
        else if (d.type === 'junk') s = .5;
        else { const { dmg, blk } = est(c, tgt); s = dmg * (need > 0 ? .8 : 1.2) + Math.min(blk, need) * 1.3 + blk * .15; if (dmg >= tgt.hp + tgt.block) s += 12;
          for (const o of d.fx) { if (o[0] === 's' && ['weak', 'vuln', 'psn', 'burn', 'stun'].includes(o[1])) s += 5 + (o[1] === 'stun' ? 8 : 0); if (o[0] === 's' && (o[3] === 'self')) s += 6; if (o[0] === 'draw') s += 4 * o[1]; if (o[0] === 'nrg') s += 7 * o[1]; if (o[0] === 'lose') s -= o[1] * (RUN.hp < 25 ? 3 : .8); if (o[0] === 'heal') s += Math.min(o[1], RUN.maxhp - RUN.hp); if (o[0] === 'roll') s += 6; if (o[0] === 'audible') s += 2; if (o[0] === 'add') s += 8; } }
        s -= (d.toll || 0) * (RUN.hp < 30 ? 3 : 1) + (d.foul || 0) * 4 + (d.exert || 0) * 5 + (d.fatigue || 0) * 2 + (d.goldc ? 4 : 0);
        if (d.type === 'play' || d.type === 'gear') s += 6 + (d.sport === B.sport ? 6 : 0);
        const v = s / (d.cost + .6);
        if (s > 0 && v > bs) { bs = v; best = i; }
      });
      if (best == null) break;
      playCard(best, B.enemies.indexOf(tgt));
      if (RUN.hp < RUN.maxhp * .3) { const k = RUN.tonics.findIndex(t => t === 'heal'); if (k >= 0) useTonic(k); }
    }
    if ((B.type !== 'normal') && B.turn === 1) RUN.tonics.forEach((t, k) => { if (t && t !== 'heal') useTonic(k, B.enemies.indexOf(alive()[0])); });
  }

  /* ---------- a new journey ---------- */
  const club = opts.club || pick(CLUB_IDS);
  wStart(null, { club, hardcore: !!opts.hardcore });
  RUN.diff = opts.diff != null ? opts.diff : RUN.diff;
  const log = { club, result: null, stage: null, matches: [], stages: [], blackouts: 0, days: 0, crownTries: 0 };
  let stage = '';

  /* ---------- where the party stands ---------- */
  const loc = id => DB.locs.find(l => l.id === id);
  const atWorld = (locId, night) => { const L = loc(locId); WG.map = 'world'; WG.x = L.x; WG.y = L.y; WG.min = night ? 23 * 60 : 12 * 60; };
  const atMap = id => { WG.map = id; WG.min = 12 * 60; };
  const TOWN = { plains: 'graftonbury', bloom: 'mossgate', tide: 'saltmere', ember: 'cinderhold', rime: 'rimewatch' };
  const INN = { plains: 'hq_inn', bloom: 'moss_inn', tide: 'salt_inn', ember: 'cind_inn', rime: 'rime_inn' };

  /* ---------- a match: start it with the realm's own call, play it, settle it the realm's way ---------- */
  function play(go, what) {
    const hp0 = RUN.hp, max0 = RUN.maxhp;
    RUN.pending = null; B = null;
    go();
    if (!B || !RUN.pending || !RUN.pending.world) return null; // refused (a gate, a cup rule)
    const W = RUN.pending.world, enc = RUN.pending;
    let g = 0;
    while (!B.over && g++ < 80) { botTurn(); if (B.over) break; runSteps(endTurn()); }
    const stall = !B.over;
    if (stall) { B.over = 'lose'; B.phase = 'done'; }
    const res = B.over, m = { home: !!B.wHome, stage, what, kind: W.kind, type: enc.type, tier: W.tier, lv: W.lv || 0, sport: B.sport, ids: enc.ids.join('+'), res, lost: hp0 - RUN.hp, hp0, max0, turns: B.turn, stall, meal: !!B.wMeal, ambush: !!W.ambush };
    finishFight();
    if (res === 'win') {
      const rw = RUN.panel && RUN.panel.rw;
      if (rw) {
        if (rw.reel) RUN.deck.push(mkCard(rw.reel[0].id)); gainGold(rw.gold); if (rw.relic) gainRelic(rw.relic); if (rw.tonic) gainTonic(rw.tonic); if (rw.boss) gainRelic(rw.boss[0]);
        if (RUN.deck.length < 30 && rw.cards && rw.cards.length) { const c = rw.cards.slice().sort((a, b) => ({ r: 3, u: 2, c: 1 }[CARDS[b.id].rar] || 0) - ({ r: 3, u: 2, c: 1 }[CARDS[a.id].rar] || 0))[0]; RUN.deck.push(mkCard(c.id, c.up)); }
      }
      while ((RUN.rareTokens || 0) > 0) { RUN.deck.push(mkCard(pick(cardPool('r')).id)); RUN.rareTokens--; }
      while ((RUN.pracTokens || 0) > 0) { const pc = RUN.deck.filter(practicable)[0]; if (pc) pc.sk = 1; RUN.pracTokens--; }
      backToMap(); // the realm's Continue: XP, recruits, the world's own ending for this match
    } else log.blackouts++;
    settle();
    log.matches.push(m);
    if (opts.hardcore && res !== 'win') RUN.over = true;
    if (RUN.over) { log.result = 'dead'; log.stage = stage; }
    return res;
  }

  /* ---------- between matches: what a player does with what the realm gives ---------- */
  const rar = { l: 5, r: 3, u: 2, c: 1 };
  function settle() {
    for (let guard = 0; guard < 20; guard++) {
      if (WG.cardOffer) { const O = WG.cardOffer, c = O.list.slice().sort((a, b) => (rar[CARDS[b.id].rar] || 0) - (rar[CARDS[a.id].rar] || 0))[0]; WG.cardOffer = null; wGainCard({ id: c.id, up: c.up, pid: O.pid }, O.why); continue; }
      const k = (WG.wprompts || []).findIndex(P => P.t === 'recruit');
      if (k >= 0) { const P = WG.wprompts.splice(k, 1)[0]; if (opts.recruit !== false) signIfBetter(P.p); continue; }
      if ((WG.wprompts || []).length) { wNextPrompt(); continue; }
      break;
    }
    bestLineup();
  }
  // a new player joins if there is room, or if they beat the weakest bench player (who is let go)
  function signIfBetter(p) {
    if (wRoster().length >= W_PARTY.max) {
      const worst = wBenchList().slice().sort((a, b) => a.lvl - b.lvl)[0];
      if (!worst || worst.lvl >= p.lvl) return false;
      wRelease(worst.id);
    }
    wAddPlayer(wMakePlayer(p, p.from || 'postgame'));
    return true;
  }
  // the three highest levels start, one of each kind
  function bestLineup() {
    const R = wRoster().slice().sort((a, b) => b.lvl - a.lvl || a.id - b.id), st = [];
    for (const p of R) if (st.length < W_PARTY.starters && !st.some(q => q.kind === p.kind)) st.push(p);
    const order = st.concat(R.filter(p => !st.includes(p)));
    if (order.map(p => p.id).join() !== wRoster().map(p => p.id).join()) wSetOrder(order.map(p => p.id));
  }
  // sleep at an inn when hurt (a player walks back to town for it)
  function rest(region) {
    const price = 12;
    if (RUN.hp < RUN.maxhp * (opts.restAt || .7) && RUN.gold >= price) { const m = WG.map; WG.map = TOWN[region] || 'graftonbury'; wSleepInn(price); WG.map = m; }
  }
  // the tavern: sign the best free agent who outranks a starter, keeping 40 gold back
  function tavern(region) {
    if (opts.recruit === false) return;
    const town = TOWN[region]; const m = WG.map; WG.map = town;
    try {
      const T = wTavern(town), weakest = Math.min(...wStarters().map(p => p.lvl));
      const a = T.list.filter(a => RUN.gold >= a.fee + 40 && (wRoster().length < W_PARTY.max || a.lvl > weakest)).sort((x, y) => y.lvl - x.lvl)[0];
      if (a && (a.lvl > weakest || wRoster().length < 5)) { if (signIfBetter(Object.assign({}, a, { from: 'tavern' }))) { RUN.gold -= a.fee; T.list = T.list.filter(x => x !== a); } }
    } finally { WG.map = m; }
    bestLineup();
  }
  // Brother Quill: spend energy on upgrades, then stars
  function enchant() {
    for (let g = 0; g < 10; g++) {
      const up = wEnchList('up').sort((a, b) => (CARDS[b.id].type === 'atk') - (CARDS[a.id].type === 'atk'))[0];
      if (up && wEnergyTotal() >= wEnchCost('up')) { wEnchant('up', up); continue; }
      const st = wEnchList('star')[0];
      if (st && wEnergyTotal() >= wEnchCost('star')) { wEnchant('star', st); continue; }
      break;
    }
  }
  // the card vendors: the region's own, or Graftonbury's on the way through. Uncommons and rares, keeping 150 gold back,
  // and one trade a week to thin a basic card out of a fat deck
  const SHOP = { plains: 'hq_shop', tide: 'netter', ember: 'smith' };
  function shop(region) {
    if (opts.shop === false) return;
    const id = SHOP[region] || 'hq_shop', st = wShopStock(id);
    st.cards.forEach((w, i) => { if (!w.sold && CARDS[w.id].rar !== 'c' && RUN.gold >= w.price + 150) wBuyCard(id, i); });
    const basic = RUN.deck.find(c => !c.wp && /^(check|hold)$/.test(c.id));
    if (basic && !st.removed && RUN.gold >= RUN.removeCost + 150) wRemoveCard(id, basic);
  }
  // a meal before a big match: the strongest the region's inn serves, if it is affordable
  function eat(region) {
    if (!opts.meals || WG.meal) return;
    const menu = DB.innMenu[INN[region]] || {}, best = Object.keys(menu).filter(id => id !== 'hash').sort((a, b) => menu[b] - menu[a])[0];
    if (best && RUN.gold >= menu[best] + 30) { wBuyMeal(INN[region], best); wEat(best); }
  }
  const prep = (region, big) => { rest(region); if (big) eat(region); };
  // the home ground (epic 2): bought at the first cup or dungeon stop with 250 gold to spare (opts.groundSpare; or opts.groundAt), then a trip home once a
  // stage to build it up (keeping 150 gold back), drill cards, sign the scouts' agents, and sleep and eat for free
  const GROUND_ORDER = ['stands', 'kitchen', 'pitch', 'scouts', 'stands', 'pitch', 'kitchen', 'scouts'];
  function ground(region) {
    if (opts.ground === false) return;
    const town = TOWN[region];
    if (!WG.ground && town && (!opts.groundAt || opts.groundAt === town) && RUN.gold >= W_GROUND.price + (opts.groundSpare != null ? opts.groundSpare : 250)) wBuyGround(town);
    if (!WG.ground) return;
    const m = WG.map; WG.map = WG.ground.town;
    try {
      for (const k of opts.groundOrder || GROUND_ORDER) { const c = wGroundCost(k); if (c != null && RUN.gold >= c + 150) wUpgradeGround(k); }
      for (let g = 0; g < 2 && wDrillsLeft(); g++) { const c = RUN.deck.filter(practicable).sort((a, b) => (CARDS[b.id].type === 'atk') - (CARDS[a.id].type === 'atk'))[0]; if (!c) break; wDrill(c); }
      if (RUN.hp < RUN.maxhp) wSleepGround();
    } finally { WG.map = m; }
    const home = Object.keys(TOWN).find(r => TOWN[r] === WG.ground.town);
    if (home && home !== region && opts.groundTavern !== false) tavern(home);
  }

  /* ---------- the route ---------- */
  function wild(region, n) {
    const town = TOWN[region];
    for (let i = 0; i < n && !RUN.over; i++) {
      prep(region);
      atWorld(town, Math.random() < (opts.night != null ? opts.night : .25));
      play(() => wWildMatch(region), 'wild ' + region);
    }
  }
  // a cup: enter, play rounds until it is won; a knockout means rest, a couple of wild games, and enter again
  function cup(id) {
    const C = DB.cups[id], region = C.elem in DB.regions ? C.elem : 'plains';
    for (let t = 0; t <= (opts.retries != null ? opts.retries : 3) && !RUN.over; t++) {
      if (id === 'crown') { log.crownTries++; for (let d = 0; d < 200 && !wChampWeek(); d++) wAdvance(24 * 60); }
      atMap(C.town);
      ground(region); tavern(region); enchant(); shop(region);
      if (RUN.gold < W_CUP.fee && id !== 'crown') RUN.gold = W_CUP.fee; // a player would grind the fee; not the point
      while (!RUN.over) {
        prep(region, true);
        atMap(C.town);
        const r = play(() => { if (WG.cup && WG.cup.id === id) wCupPlay({ card: false }); else wCupEnter(id, { card: false }); }, (id === 'crown' ? 'crown' : 'cup ' + id) + ' r' + ((WG.cup ? WG.cup.round : 0) + 1));
        if (r == null) return false;
        if (wFlag(C.flag)) return true;
        if (r !== 'win') break;
      }
      if (RUN.over) return false;
      wild(region, 2);
    }
    return false;
  }
  // a dungeon: every room, then the alpha, then the strongbox; a blackout means rest and go back in
  function dungeon(id) {
    const dg = DB.dungeons.find(d => d.id === id), L = loc(id), region = L ? regionAt(L.x, L.y) : 'plains';
    if (!wGateCheck(id).ok) return false;
    ground(region); shop(region); enchant();
    for (let t = 0; t <= (opts.retries != null ? opts.retries : 3) && !RUN.over; t++) {
      for (const R of wDungeonRooms(id)) {
        if (wFlag(R.flag) || RUN.over) continue;
        prep(region); atMap(id);
        if (play(() => wStartRoom(R, { card: false }), 'room ' + id + ' ' + (R.d + 1)) !== 'win') break;
      }
      if (RUN.over) return false;
      if (wRoomsLeft(id).length) { wild(region, 1); continue; }
      prep(region, true); atMap(id);
      const r = play(() => wStartAlpha({ kind: 'alpha', alpha: dg.alpha }), 'boss ' + id);
      if (r === 'win') { const ch = id + '_prize'; if (DB.chests[ch] && !wFlag('chest_' + ch)) { wGiveLoot(DB.chests[ch]); wSetFlag('chest_' + ch); settle(); } return true; }
      if (RUN.over) return false;
      wild(region, 1);
    }
    return false;
  }
  function lair(locId) {
    const L = loc(locId); if (!L || !wGateCheck(locId).ok) return false;
    const region = regionAt(L.x, L.y);
    for (let t = 0; t <= 1 && !RUN.over; t++) {
      prep(region, true); atWorld(locId);
      const r = play(() => wStartAlpha({ kind: 'lair', loc: locId, alpha: L.alpha }), 'lair ' + locId);
      if (r === 'win') { settle(); return true; }
    }
    return false; // a player can leave a lair for later
  }
  if (opts.keycard !== false) wAddItem('keycard', 1); // Gant Vesper hands it over after two cups; the route only goes there then

  const ROUTE = opts.route || [
    ['wild', 'plains', 4], ['wild', 'bloom', 2], ['cup', 'moss'],
    ['dungeon', 'hatchery'], ['lair', 'eldergrove'],
    ['wild', 'tide', 2], ['cup', 'salt'], ['dungeon', 'emberdeep'], ['lair', 'auroraroost'],
    ['wild', 'ember', 2], ['cup', 'cind'], ['dungeon', 'genevault'],
    ['wild', 'rime', 2], ['cup', 'rime'], ['dungeon', 'deepseam'],
    ['cup', 'crown'],
  ];
  for (const [k, a, n] of ROUTE) {
    stage = k + ' ' + a;
    const before = { stage, day: WG.dayAbs, hp: RUN.hp, maxhp: RUN.maxhp, gold: RUN.gold, deck: RUN.deck.length, lvls: wStarters().map(p => p.lvl), roster: wRoster().length, relics: RUN.relics.length };
    let ok = true;
    if (k === 'wild') wild(a, n);
    else if (k === 'cup') ok = cup(a);
    else if (k === 'dungeon') ok = dungeon(a);
    else if (k === 'lair') ok = lair(a);
    log.stages.push(Object.assign(before, { ok }));
    if (RUN.over) break;
    if (!ok && (k === 'cup' || k === 'dungeon')) { log.result = 'stuck'; log.stage = stage; break; }
  }
  if (!log.result) log.result = wFlag('champion') ? 'champion' : 'stuck';
  log.ground = WG.ground ? { town: WG.ground.town, parts: WG.ground.parts } : null;
  log.days = WG.dayAbs; log.gold = RUN.gold; log.maxhp = RUN.maxhp; log.deck = RUN.deck.length; log.lvls = wRoster().map(p => p.lvl); log.relics = RUN.relics.length;
  return log;
};
