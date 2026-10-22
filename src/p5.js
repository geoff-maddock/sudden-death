/* p5: the run — drafting, the map, rewards, shops, locker rooms, events, saves and records */
const START_HP = 75, FLOORS = 13; // rows 0..12, then the boss
function newRun(clubId, picks, roster, relic) {
  const club = CLUBS[clubId], R0 = roster || club.roster;
  const party = picks.map(i => { const [n, kind, num, flav] = R0[i]; return { n, kind, num, flav }; });
  RUN = { v: 1, club: clubId, party, extra: [], hp: START_HP, maxhp: START_HP, gold: 99, relics: [relic || club.relic], tonics: [null, null], deck: [], act: 0, map: null, pos: null, floor: 0,
    stats: { fights: 0, elites: 0, bosses: 0, cards: 0, dmg: 0, turns: 0, gold: 0, sportsWins: 0, highlights: 0 }, style: 0, luck: 0, removeCost: 75, practiceCost: 50, tonicOdds: 40, pending: null, started: Date.now(), seen: {} };
  for (let i = 0; i < 4; i++) RUN.deck.push(mkCard('check'));
  for (let i = 0; i < 4; i++) RUN.deck.push(mkCard('hold'));
  for (const p of party) RUN.deck.push(mkCard(SIG[p.kind]));
  RUN.map = genMap(0); setGoals(0);
  saveRun();
  return RUN;
}
const runKinds = () => [...new Set(RUN.party.map(p => p.kind).concat(RUN.extra))];
const clubTeam = () => { const c = CLUBS[RUN.club]; return { color: c.color, light: c.light, short: c.short, dark: c.dark }; };
const memberOf = kind => RUN.party.find(p => p.kind === kind);

/* ---------- the map: StS-style branching paths, bottom to top ---------- */
const MAP_W = 7;
// The map is built in two passes. First the shape: six walks up the grid that may merge but never cross,
// spread across at least three starting columns. Then the rooms: typed by floor band, then checked path by
// path and repaired until every route is fair (enough rests, fights, shops or events; a sane number of
// elites) while the routes still differ (one safe-ish, one greedy). A map that cannot be repaired is redrawn.
function mapShape() {
  const nodes = {}, key = (r, c) => r + '_' + c, edges = [];
  const crosses = (r, a, b) => edges.some(([r2, c1, c2]) => r2 === r && ((c1 < a && c2 > b) || (c1 > a && c2 < b)));
  let starts;
  do { starts = []; for (let i = 0; i < 6; i++) starts.push((R() * MAP_W) | 0); } while (new Set(starts).size < 3 || starts[0] === starts[1]);
  const use = {};
  for (const s of starts) {
    let c = s;
    for (let r = 0; r < FLOORS; r++) {
      const k = key(r, c); nodes[k] = nodes[k] || { k, r, c, t: null, next: [] };
      use[k] = (use[k] || 0) + 1;
      if (r === FLOORS - 1) { if (!nodes[k].next.includes('boss')) nodes[k].next.push('boss'); break; }
      // drift, nudged away from crowded columns so paths spread out, and kept off the edges a little
      const opts = [-1, 0, 1].map(d => clamp(c + d, 0, MAP_W - 1)).filter((v, i, a) => a.indexOf(v) === i);
      const w = opts.map(nc => (use[key(r + 1, nc)] ? .45 : 1) * (nc === 0 || nc === MAP_W - 1 ? .7 : 1) * (nc === c ? .8 : 1));
      let nc = opts[0], t = R() * w.reduce((x, y) => x + y, 0); for (let i = 0; i < opts.length; i++) { t -= w[i]; if (t <= 0) { nc = opts[i]; break; } }
      if (crosses(r, c, nc)) nc = c;
      const nk = key(r + 1, nc);
      if (!nodes[k].next.includes(nk)) { nodes[k].next.push(nk); edges.push([r, c, nc]); }
      c = nc;
    }
  }
  nodes.boss = { k: 'boss', r: FLOORS, c: 3, t: 'boss', next: [] };
  return nodes;
}
const MAP_RULES = act => ({ restMin: 1, sevMin: 2, fightMin: 4, eliteMax: 3, eliteMin: act ? 1 : 0, greedyMin: 2 + (act ? 1 : 0) });
function mapPaths(nodes) {
  const out = [], walk = (k, acc) => { if (k === 'boss') { out.push(acc); return; } if (out.length > 4000) return; const a = acc.concat(nodes[k]); for (const nx of nodes[k].next) walk(nx, a); };
  for (const n of Object.values(nodes)) if (n.r === 0) walk(n.k, []);
  return out;
}
function bandType(n, act) {
  if (n.r === 0) return 'fight';
  if (n.r === 6) return 'chest';
  if (n.r === FLOORS - 1) return 'rest';
  if (n.r <= 2) return wpick({ fight: 60, event: 32, shop: 8 });
  if (n.r <= 4) return wpick({ fight: 48, event: 26, shop: 10, elite: act ? 8 : 0, rest: 8 });
  return wpick({ fight: 40, event: 20, elite: 14 + act * 2, rest: 14, shop: 9 });
}
const isEl = n => n.t === 'elite' || n.t === 'rival';
function mapProblems(nodes, act) {
  const P = mapPaths(nodes), rule = MAP_RULES(act), probs = [];
  for (const n of Object.values(nodes)) if (['elite', 'rest', 'shop', 'rival'].includes(n.t)) for (const nx of n.next) { const m = nodes[nx]; if (m && (m.t === n.t || (isEl(m) && isEl(n)))) probs.push({ fix: 'adjacent', node: m }); }
  let greedy = 0;
  for (const p of P) {
    const c = t => p.filter(n => n.t === t).length, el = p.filter(isEl).length;
    if (c('rest') < rule.restMin + 1) probs.push({ fix: 'rest', path: p });
    if (c('shop') + c('event') < rule.sevMin) probs.push({ fix: 'sev', path: p });
    if (c('fight') < rule.fightMin) probs.push({ fix: 'fight', path: p });
    if (el > rule.eliteMax) probs.push({ fix: 'tooElite', path: p });
    if (el < rule.eliteMin) probs.push({ fix: 'elite', path: p });
    greedy = Math.max(greedy, el);
  }
  if (!Object.values(nodes).some(n => n.t === 'shop')) probs.push({ fix: 'shop', path: pick(P) });
  if (greedy < rule.greedyMin) probs.push({ fix: 'greedy', path: P.slice().sort((a, b) => b.filter(isEl).length - a.filter(isEl).length)[0] });
  return { probs, paths: P };
}
function okFor(nodes, n, t) {
  if (n.r === 0 || n.r === 6 || n.r >= FLOORS - 1) return false;
  if (t === 'rest' && (n.r < 3 || n.r >= FLOORS - 2)) return false;
  if ((t === 'elite') && n.r < (RUN && RUN.act ? 3 : 4)) return false;
  const near = Object.values(nodes).filter(m => m.next.includes(n.k)).concat(n.next.map(k => nodes[k]).filter(Boolean));
  return !near.some(m => m.t === t || (t === 'elite' && isEl(m)));
}
function repair(nodes, act) {
  for (let it = 0; it < 80; it++) {
    const { probs } = mapProblems(nodes, act);
    if (!probs.length) return true;
    const pr = probs[(R() * probs.length) | 0];
    if (pr.fix === 'adjacent') { pr.node.t = 'fight'; continue; }
    const p = shuffle(pr.path.slice());
    const want = { shop: 'shop', rest: 'rest', sev: R() < .5 ? 'event' : 'shop', fight: 'fight', elite: 'elite', greedy: 'elite', tooElite: 'fight' }[pr.fix];
    const from = { shop: ['fight', 'event'], rest: ['fight', 'event'], sev: ['fight'], fight: ['event', 'shop'], elite: ['fight', 'event'], greedy: ['fight', 'event'], tooElite: ['elite'] }[pr.fix];
    const n = p.find(n => from.includes(n.t) && (want === 'fight' || okFor(nodes, n, want)));
    if (n) n.t = want;
  }
  return !mapProblems(nodes, act).probs.length;
}
function genMap(act) {
  for (let tries = 0; tries < 30; tries++) {
    const nodes = mapShape();
    for (const n of Object.values(nodes).filter(n => n.k !== 'boss').sort((a, b) => a.r - b.r)) {
      let t = bandType(n, act);
      for (let k = 0; k < 6 && !['fight', 'chest'].includes(t) && n.r !== FLOORS - 1 && !okFor(nodes, n, t); k++) t = bandType(n, act);
      n.t = t;
    }
    if (!repair(nodes, act)) continue;
    // one rivalry game per act: a souped-up elite on floors 8-10 that at least one route can skip
    const { paths } = mapProblems(nodes, act);
    const cand = shuffle(Object.values(nodes).filter(n => n.t === 'elite' && n.r >= 7 && n.r <= 10));
    for (const n of cand) { n.t = 'rival'; if (paths.some(p => !p.includes(n)) && !mapProblems(nodes, act).probs.length) break; n.t = 'elite'; }
    // routes should differ: a gap between the gentlest and the most dangerous
    const d = paths.map(p => p.filter(isEl).length * 3 + p.filter(n => n.t === 'fight').length - p.filter(n => n.t === 'rest').length * 2);
    if (Math.max(...d) - Math.min(...d) < 4 && tries < 25) continue;
    return { act, nodes: stakeMap(scheduleMap(assignTraits(nodes), act), act) };
  }
  const nodes = mapShape(); for (const n of Object.values(nodes)) if (n.k !== 'boss') n.t = n.r === 0 ? 'fight' : n.r === FLOORS - 1 ? 'rest' : n.r === 6 ? 'chest' : 'fight';
  return { act, nodes: stakeMap(scheduleMap(assignTraits(nodes), act), act) };
}
function nextNodes() {
  const M = RUN.map;
  if (!RUN.pos) return Object.values(M.nodes).filter(n => n.r === 0);
  return M.nodes[RUN.pos].next.map(k => M.nodes[k]);
}

/* ---------- encounters ---------- */
function rollEncounter(type, want) {
  const E = ENCOUNTERS[RUN.act];
  let ids;
  if (type === 'boss') { const b = bossId(), es = ENEMIES[b].escort || []; ids = es.length === 2 ? [es[0], b, es[1]] : [b].concat(es); }
  else {
    const pool = type === 'elite' || type === 'rival' ? E.elite : (RUN.act === 0 && RUN.stats.fights < 2) || (RUN.act > 0 && RUN.actFights < 2) ? E.easy : E.normal;
    // a published sport: pick an encounter that plays it (some enemies only play their own game)
    const fits = want ? pool.filter(p => !ENEMIES[p[0]].sport || ENEMIES[p[0]].sport === want) : pool, P2 = fits.length ? fits : pool;
    let tries = 0; do { ids = pick(P2).slice(); } while (tries++ < 6 && ids.join() === RUN.lastEnc);
  }
  RUN.lastEnc = ids.join();
  const fixed = ENEMIES[ids[0]].sport;
  const sport = fixed || want || wpick(ACT_SPORTS[RUN.act]);
  return { ids, type, sport };
}

/* ---------- rewards ---------- */
function rarityRoll(type) {
  if (type === 'boss') return 'r';
  const r = R() * 100;
  if (type === 'elite' || type === 'rival') return r < 2 ? 'l' : r < 12 ? 'r' : r < 50 ? 'u' : 'c';
  if (type === 'reel') return r < 12 ? 'l' : r < 40 ? 'r' : 'u';
  return r < 3 + RUN.act ? 'r' : r < 37 + RUN.act * 3 ? 'u' : 'c';
}
function cardPool(rar) {
  const kinds = runKinds();
  return Object.values(CARDS).filter(c => c.rar === rar && (c.kind === 'any' || kinds.includes(c.kind)));
}
function cardChoices(type, n) {
  n = n || 3 + mod('choices');
  const out = [];
  for (let i = 0; i < n; i++) {
    let tries = 0, c;
    do { const pool = cardPool(rarityRoll(type)); c = pick(pool); } while (tries++ < 20 && out.some(o => o.id === c.id));
    // the league's playbook is broad; favour the party's own cards two to one
    if (c.kind === 'any' && R() < .4) { const own = cardPool(c.rar).filter(x => x.kind !== 'any' && !out.some(o => o.id === x.id)); if (own.length) c = pick(own); }
    out.push({ id: c.id, up: RUN.act >= 1 && R() < .08 * RUN.act });
  }
  // the schedule: one choice is often a card for a sport you are about to play
  const up = upcomingSports();
  if (up.length && R() < .6) { const s = pick(up), opts = cardPool(rarityRoll(type)).concat(cardPool('c')).filter(c => c.sport === s && !out.some(o => o.id === c.id)); if (opts.length) out[out.length - 1] = { id: pick(opts).id, up: false, sched: s }; }
  if (type === 'rival') { const L = cardPool('l').filter(c => !out.some(o => o.id === c.id)); if (L.length) out[0] = { id: pick(L).id, up: false }; }
  if (type === 'boss' && R() < .4) { const L = cardPool('l').filter(c => !out.some(o => o.id === c.id)); if (L.length) out[out.length - 1] = { id: pick(L).id, up: false }; }
  return out;
}
// sports of the rooms you can reach in the next three floors
function upcomingSports() {
  if (!RUN || !RUN.map) return [];
  const N = RUN.map.nodes, seen = new Set(), out = []; let front = RUN.pos ? N[RUN.pos].next.slice() : Object.values(N).filter(n => n.r === 0).map(n => n.k);
  for (let d = 0; d < 3 && front.length; d++) { const nx = []; for (const k of front) { if (seen.has(k)) continue; seen.add(k); const n = N[k]; if (!n) continue; if (n.sport) out.push(n.sport); nx.push(...(n.next || [])); } front = nx; }
  return out;
}
function relicPool(rar) { return Object.keys(RELICS).filter(k => !RELICS[k].club && !RELICS[k].boss && (!rar || RELICS[k].rar === rar) && !RUN.relics.includes(k)); }
function randomRelic() { const r = R() * 100, rar = r < 50 ? 'c' : r < 85 ? 'u' : 'r'; let p = relicPool(rar); if (!p.length) p = relicPool(); return p.length ? pick(p) : null; }
function gainRelic(id) {
  if (!id || RUN.relics.includes(id)) return;
  RUN.relics.push(id);
  const R2 = RELICS[id]; if (R2.gain) R2.gain(RUN);
  if (id === 'belt') RUN.tonics.push(null);
}
function gainGold(n) { const g = Math.round(n * (1 + mod('goldMult'))); RUN.gold += g; RUN.stats.gold += g; return g; }
function gainTonic(id) { const i = RUN.tonics.indexOf(null); if (i < 0) return false; RUN.tonics[i] = id; return true; }
function combatRewards() {
  const t = B.type, out = { gold: 0, cards: cardChoices(t), relic: null, tonic: null, boss: null };
  out.gold = t === 'boss' ? ri(70, 90) : t === 'rival' ? ri(45, 60) : t === 'elite' ? ri(25, 35) : ri(10, 20);
  out.gold += mod('rewardGold');
  for (const e of B.enemies) if (ENEMIES[e.id].gold) out.gold += ENEMIES[e.id].gold;
  if (B.trait && ELITE_TRAITS[B.trait]) { ELITE_TRAITS[B.trait].reward(out); out.trait = B.trait; }
  if (B.sport === 'golf') { const st = B.turn - (B.sc ? B.sc.free : 0); if (st <= 3) { out.gold += 30; out.golf = 'Eagle! 30 bonus gold'; } else if (st <= 4) { out.gold += 15; out.golf = 'Birdie. 15 bonus gold'; } }
  if (B.sc && B.sc.win) {
    const hl = B.sc.hl.slice();
    out.sports = { sport: B.sport, us: B.sc.us, them: B.sc.them, hl, style: 50 + 25 * hl.length };
    out.gold += 15 + 10 * hl.length;
    // the highlight reel: a pick between a card upgrade, a set play (maybe a Hall of Famer), or a bit more HP
    const plays = Object.values(CARDS).filter(c => (c.type === 'play' || c.type === 'gear') && c.rar !== 'l' && (c.sport === B.sport || !c.sport));
    const pool = plays.length >= 3 ? plays : Object.values(CARDS).filter(c => c.type === 'play' || c.type === 'gear');
    const reel = shuffle(pool.slice()).slice(0, 3).map(c => ({ id: c.id, up: false }));
    const lchance = .06 + .14 * hl.length + (t === 'elite' ? .1 : 0) + (t === 'boss' ? .2 : 0);
    if (R() < lchance) { const L = cardPool('l'); const own = L.filter(c => c.sport === B.sport || c.kind !== 'any'); const src = own.length ? own : L; if (src.length) reel[0] = { id: pick(src).id, up: false }; }
    out.reel = reel;
  }
  if (t === 'elite' || t === 'rival') out.relic = randomRelic();
  if (t === 'boss') out.boss = shuffle(Object.keys(RELICS).filter(k => RELICS[k].boss && !RUN.relics.includes(k))).slice(0, 3);
  if (R() * 100 < RUN.tonicOdds) { out.tonic = pick(Object.keys(TONICS)); RUN.tonicOdds -= 10; } else RUN.tonicOdds += 10;
  return out;
}
// the season: every fight is also a game, logged with its score
function logGame(fell) {
  if (!B || !B.sc || !RUN) return;
  const S = B.sc, foes = [...new Set(B.enemies.filter(e => e.id !== 'cubelet' || !B.enemies.some(o => o.id === 'cube')).map(e => e.n.replace(/^Rival /, '')))];
  const g = { act: RUN.act, floor: RUN.floor, type: B.type, sport: B.sport, us: S.us, them: S.them, turns: B.turn, hl: S.hl.slice(), foes: foes.slice(0, 3),
    opp: (B.enemies[0] && B.enemies[0].team && B.enemies[0].team.short) || 'OPP', fell: !!fell, won: !fell && !!S.win, ps: JSON.parse(JSON.stringify(B.ps || {})) };
  const mvp = mvpOf(g.ps); if (mvp) g.mvp = mvp;
  if (B.sport === 'golf') { g.strokes = B.turn - S.free; g.par = parFor(); }
  if (B.sport === 'boxing') { g.us = S.rounds[0]; g.them = S.rounds[1]; }
  if (B.sport === 'bowling') g.strike = !!B.strike;
  if (B.enemies.some(e => e.id === 'baron')) g.q = 1;
  (RUN.games = RUN.games || []).push(g);
}
const gameRecord = games => { const w = (games || []).filter(g => g.won).length; return `${w}–${(games || []).length - w}`; };
function gameScore(g, me) {
  me = me || (RUN ? CLUBS[RUN.club].short : 'YOU');
  if (g.sport === 'golf') return `${g.strokes} stroke${g.strokes === 1 ? '' : 's'}, par ${g.par}`;
  if (g.sport === 'bowling') return g.strike ? 'Strike' : `Cleared in frame ${g.turns}`;
  if (g.sport === 'boxing') return `Cards ${g.us}–${g.them}${g.hl.includes('ko') ? ', KO' : ''}`;
  return `${me} ${g.us}, ${g.opp} ${g.them}`;
}
function afterCombat() {
  logGame(false);
  RUN.stats.fights++; RUN.actFights = (RUN.actFights || 0) + 1;
  if (B.type === 'elite' || B.type === 'rival') RUN.stats.elites++;
  if (B.type === 'rival') RUN.stats.rivals = (RUN.stats.rivals || 0) + 1;
  if (B.type === 'boss') RUN.stats.bosses++;
  if (B.sc && B.sc.win) { RUN.stats.sportsWins = (RUN.stats.sportsWins || 0) + 1; RUN.stats.highlights = (RUN.stats.highlights || 0) + B.sc.hl.length; RUN.style = (RUN.style || 0) + 50 + 25 * B.sc.hl.length; RUN.fans = (RUN.fans || 0) + 30 + 15 * B.sc.hl.length; }
  RUN.goalsDone = checkGoals();
  achFight();
  RUN.stats.dmg += B.totalDmg; RUN.stats.turns += B.turn;
  fire('fightWon');
  RUN.luck = B.luck ? 1 : 0;
  for (const e of B.enemies) RUN.seen[e.id] = 1;
}

/* ---------- shop: the Pro Shop ---------- */
const PRICE = { c: 50, u: 75, r: 150, l: 240 };
function makeShop() {
  const cards = [];
  const kinds = runKinds();
  for (let i = 0; i < 5; i++) { const rar = i === 4 ? 'r' : wpick({ c: 6, u: 3, r: 1 }); let pool = cardPool(rar).filter(c => !cards.some(o => o.id === c.id)); if (i < 3) { const own = pool.filter(c => kinds.includes(c.kind)); if (own.length) pool = own; } if (!pool.length) pool = cardPool('c'); const c = pick(pool); cards.push({ id: c.id, price: Math.round(PRICE[c.rar] * (.9 + R() * .2)), sold: false }); }
  if (R() < .22) { const L = cardPool('l'); if (L.length) { const c = pick(L); cards[4] = { id: c.id, price: PRICE.l + ri(-20, 20), sold: false }; } }
  const relics = shuffle(relicPool()).slice(0, 3).map(id => ({ id, price: { c: 150, u: 220, r: 280 }[RELICS[id].rar] + ri(-15, 15), sold: false }));
  const tonics = shuffle(Object.keys(TONICS)).slice(0, 3).map(id => ({ id, price: ri(50, 75), sold: false }));
  return { cards, relics, tonics, removed: false };
}

/* ---------- events: the dungeon between fights ---------- */
// each option returns an outcome: { text, then?: 'remove'|'upgrade'|{cards}|{relic}|{fight} }
const EVENTS = [
  { id: 'deck', t: 'The Deck of Many Fates', art: { kind: 'goblin', team: { color: '#7a5a34', light: '#e8c27a', short: 'BKE' }, num: 7 }, acts: [0, 1, 2],
    text: 'A goblin bookie with a green visor fans a deck of glowing cards across an overturned beer keg. "Pick one, any one. The house always pays out. Mostly."',
    opts: () => [
      { label: 'Draw one card', desc: 'A boon or a bane, at random.', go: () => fate() },
      { label: 'Draw two cards', desc: 'Twice the fate. Twice the fun.', go: () => { const a = fate(), b = fate(); return { text: a.text + ' ' + b.text, then: a.then || b.then }; } },
      { label: 'Walk away', desc: '', go: () => ({ text: 'The bookie shrugs and shuffles. "Your loss. Literally, usually."' }) },
    ] },
  { id: 'bowling', t: 'The Ogre’s Bowling Alley', art: { kind: 'ogre', team: { color: '#c94a3a', light: '#ffd9a0', short: 'LNS' }, num: 300 }, acts: [0, 1, 2],
    text: 'Mawgrum’s cousin runs four lanes in a limestone cavern. The pins are skulls. The ball is also a skull, but bigger. "One frame. Strike pays big. Gutter pays nothing. Dropping it on your foot is free."',
    opts: () => [
      { label: 'Bowl a frame', desc: 'Roll a d20.', go: () => { const r = evRoll(); if (r === 20) { gainGold(90); return { text: `Natural 20. STRIKE. The skulls explode outward and the ogre weeps with joy. +90 gold, and he insists you keep the lucky ball.`, then: { relic: RUN.relics.includes('bowling') ? randomRelic() : 'bowling' } }; } if (r >= 14) { const g = gainGold(50); return { text: `You roll ${r}. Spare! +${g} gold.` }; } if (r >= 7) { const g = gainGold(15); return { text: `You roll ${r}. Seven pins. +${g} gold for effort.` }; } if (r > 1) return { text: `You roll ${r}. Gutter ball. The ogre laughs for a very long time.` }; RUN.hp = Math.max(1, RUN.hp - 9); return { text: 'Natural 1. You drop the skull on your foot. −9 HP.' }; } },
      { label: 'Just watch', desc: 'Heal 5.', go: () => { RUN.hp = Math.min(RUN.maxhp, RUN.hp + 5); return { text: 'You sit on the bench and eat stale cavern pretzels. +5 HP.' }; } },
    ] },
  { id: 'golf', t: 'The Lich’s Nine Holes', art: { kind: 'lich', team: { color: '#3d6a3a', light: '#cfe8a0', short: 'GLF' }, num: 9 }, acts: [0, 1, 2],
    text: 'A lich in plaid trousers is playing through a graveyard. "Par three, over the open grave. Care to make it interesting?"',
    opts: () => [
      { label: 'Play the hole (bet 25 gold)', desc: 'Roll a d20. 12+ wins.', ok: () => RUN.gold >= 25, go: () => { const r = evRoll(); RUN.gold -= 25; if (r === 20) { gainGold(100); return { text: 'Hole in one. The lich drops his club, then teaches you the shot. +100 gold.', then: { cards: [{ id: 'holeinone', up: false }] } }; } if (r >= 12) { const g = gainGold(60); return { text: `You roll ${r}. Birdie. +${g} gold.` }; } RUN.hp = Math.max(1, RUN.hp - 6); return { text: `You roll ${r}. Into the grave. Something in it does not want the ball back. −25 gold, −6 HP.` }; } },
      { label: 'Caddy for him', desc: 'Gain 30 gold. Pull a hamstring.', go: () => { gainGold(30); RUN.deck.push(mkCard('injury')); return { text: 'Eighteen holes carrying a bag of femurs. +30 gold, and a Pulled Hamstring in your deck.' }; } },
      { label: 'Keep walking', desc: '', go: () => ({ text: '"Fore," he calls after you, for no reason.' }) },
    ] },
  { id: 'collector', t: 'The Card Collector', art: { kind: 'spider', team: { color: '#5a4a7a', light: '#d2c4f2', short: 'TCG' }, num: 1 }, acts: [0, 1, 2],
    text: 'In a web strung with sleeved trading cards, a spider sorts her collection with all eight arms. "I trade. Fair trades. Mostly fair."',
    opts: () => [
      { label: 'Trade away a card', desc: 'Remove a card from your deck.', go: () => ({ text: 'She looks at your deck and sniffs. "Which one do you hate?"', then: 'remove' }) },
      { label: 'Buy a pack (60 gold)', desc: 'Choose one of three uncommon or rare cards.', ok: () => RUN.gold >= 60, go: () => { RUN.gold -= 60; return { text: 'She slits a foil pack with a fang.', then: { cards: [0, 1, 2].map(() => ({ id: pick(cardPool(R() < .35 ? 'r' : 'u')).id, up: false })) } }; } },
      { label: 'Leave', desc: '', go: () => ({ text: 'She is already back to sorting.' }) },
    ] },
  { id: 'shrine', t: 'Shrine of the Patron Saint of Lost Causes', art: { kind: 'skeleton', team: { color: '#8a7a4a', light: '#f2e6b8', short: 'STL' }, num: 0 }, acts: [0, 1, 2],
    text: 'A skeleton in a faded jersey sits on a throne of broken trophies. Candles burn in old helmets. Someone has left a foam finger as an offering.',
    opts: () => [
      { label: 'Pray', desc: 'Roll a d20. 10+ heals 20 and upgrades a random card; under 10 adds an Ejection Notice.', go: () => { const r = evRoll(); if (r >= 10) { RUN.hp = Math.min(RUN.maxhp, RUN.hp + 20); const c = shuffle(RUN.deck.filter(upgradable))[0]; if (c) c.up = true; return { text: `You roll ${r}. The candles flare. +20 HP${c ? `, and ${CARDS[c.id].n} is upgraded` : ''}.` }; } RUN.deck.push(mkCard('penalty')); return { text: `You roll ${r}. The skeleton points at you, then at the exit. An Ejection Notice is added to your deck.` }; } },
      { label: 'Leave an offering (50 gold)', desc: 'Raise max HP by 7.', ok: () => RUN.gold >= 50, go: () => { RUN.gold -= 50; RUN.maxhp += 7; RUN.hp += 7; return { text: 'You tuck the coins into a helmet. You feel sturdier. +7 max HP.' }; } },
      { label: 'Move along', desc: '', go: () => ({ text: 'The candles gutter as you pass.' }) },
    ] },
  { id: 'cooler', t: 'The Victory Cooler', art: null, scene: 'cooler', acts: [0, 1, 2],
    text: 'An enormous cooler sits on a plinth, sweating, full of something glowing green and fizzing. Tradition is clear on what to do with a cooler like this.',
    opts: () => [
      { label: 'Dump it over your heads', desc: 'Heal 30% of max HP.', go: () => { const h = Math.round(RUN.maxhp * .3); RUN.hp = Math.min(RUN.maxhp, RUN.hp + h); return { text: `The traditional shower. It is freezing and it stings and it is wonderful. +${h} HP.` }; } },
      { label: 'Drink it', desc: 'Lose 6 HP. Raise max HP by 5. Gain a tonic.', go: () => { RUN.hp = Math.max(1, RUN.hp - 6); RUN.maxhp += 5; RUN.hp += 5; const t = pick(Object.keys(TONICS)); const ok = gainTonic(t); return { text: `It tastes like a battery. −6 HP, +5 max HP${ok ? `, and you bottle the rest as ${TONICS[t].n}` : ''}.` }; } },
    ] },
  { id: 'lists', t: 'The Jousting Lists', art: { kind: 'skeleton', team: { color: '#3a5a9a', light: '#c8d8ff', short: 'KNT' }, num: 1 }, acts: [1, 2],
    text: 'A skeleton knight on a skeleton horse waits at the end of a tilt rail, lance couched. "Three passes, stranger. Unhorse me and the lance is yours."',
    opts: () => [
      { label: 'Take up the lance', desc: 'Roll a d20. 11+ wins Couched Lance and 40 gold. Lose and take 12 damage.', go: () => { const r = evRoll(); if (r >= 11) { const g = gainGold(40); return { text: `You roll ${r}. The knight goes over the back of his horse in a clatter of ribs. +${g} gold.`, then: { cards: [{ id: 'lance', up: r === 20 }] } }; } RUN.hp = Math.max(1, RUN.hp - 12); return { text: `You roll ${r}. You are unhorsed, though you did not have a horse. −12 HP.` }; } },
      { label: 'Decline', desc: '', go: () => ({ text: 'He lowers his lance, disappointed. His horse is too.' }) },
    ] },
  { id: 'scalper', t: 'The Scalper Imp', art: { kind: 'imp', team: { color: '#3a3a3a', light: '#ffd166', short: 'TIX' }, num: 0 }, acts: [0, 1, 2],
    text: 'An imp in a trench coat flashes the lining: trophies, tickets, an autographed something. "Who needs gear? I got gear. Prices are prices."',
    opts: () => { const rid = RUN.scalper || (RUN.scalper = randomRelic()); return [
      { label: `Buy ${rid ? RELICS[rid].n : 'nothing'} (130 gold)`, desc: rid ? RELICS[rid].desc : '', ok: () => rid && RUN.gold >= 130, go: () => { RUN.gold -= 130; RUN.scalper = null; return { text: 'He counts every coin twice.', then: { relic: rid } }; } },
      { label: 'Rob him', desc: 'Roll a d20. 14+ takes it free; otherwise lose 10 HP and he bolts.', ok: () => !!rid, go: () => { const r = evRoll(); RUN.scalper = null; if (r >= 14) return { text: `You roll ${r}. You come away with the coat.`, then: { relic: rid } }; RUN.hp = Math.max(1, RUN.hp - 10); return { text: `You roll ${r}. The coat is full of pitchforks. −10 HP.` }; } },
      { label: 'Wave him off', desc: '', go: () => { RUN.scalper = null; return { text: '"Your loss, pal."' }; } },
    ]; } },
  { id: 'film', t: 'Coach’s Film Room', art: { kind: 'minotaur', team: { color: '#6a5a3a', light: '#e8d8a8', short: 'CCH' }, num: 0 }, acts: [0, 1, 2],
    text: 'An old minotaur coach runs grainy footage on a cave wall with a lantern and a lot of patience. "Again. Watch your feet. Again."',
    opts: () => [
      { label: 'Watch the tape', desc: 'Upgrade a card.', ok: () => RUN.deck.some(upgradable), go: () => ({ text: 'You watch until your eyes hurt. Then once more.', then: 'upgrade' }) },
      { label: 'Fall asleep in the back', desc: 'Heal 12.', go: () => { RUN.hp = Math.min(RUN.maxhp, RUN.hp + 12); return { text: 'Best sleep you have had in years. +12 HP.' }; } },
    ] },
  { id: 'tryouts', t: 'Open Tryouts', art: null, scene: 'tryouts', acts: [0, 1],
    text: '', opts: () => { const k = RUN.tryout || (RUN.tryout = pick(Object.keys(KIND_NAME).filter(k => !runKinds().includes(k)))); return [
      { label: `Sign the ${KIND_NAME[k]}`, desc: `Add ${CARDS[SIG[k]].n} to your deck. ${KIND_NAME[k]} cards join your rewards.`, go: () => { RUN.extra.push(k); RUN.deck.push(mkCard(SIG[k])); RUN.tryout = null; return { text: `The ${KIND_NAME[k]} signs on the practice squad, with a clause about snacks.` }; } },
      { label: 'Run cuts', desc: 'Remove two basic cards from your deck.', ok: () => RUN.deck.filter(c => c.id === 'check' || c.id === 'hold').length >= 2, go: () => { for (let i = 0; i < 2; i++) { const j = RUN.deck.findIndex(c => (c.id === 'check' || c.id === 'hold') && !c.up); if (j >= 0) RUN.deck.splice(j, 1); } RUN.tryout = null; return { text: 'You trim the roster. Two basics go home.' }; } },
      { label: 'No thanks', desc: '', go: () => { RUN.tryout = null; return { text: 'You keep the line as it is.' }; } },
    ]; } },
  { id: 'boxing', t: 'The Pit Boxing Ring', art: { kind: 'bugbear', team: { color: '#9a1a1a', light: '#ffc8a8', short: 'BOX' }, num: 0 }, acts: [1, 2],
    text: 'A bugbear in satin trunks bounces in a ring roped with chain. "Three rounds. Go the distance and the purse is yours."',
    opts: () => [
      { label: 'Go three rounds', desc: 'Lose 15 HP. Gain 100 gold.', ok: () => RUN.hp > 15, go: () => { RUN.hp -= 15; const g = gainGold(100); return { text: `You go the distance. Barely. −15 HP, +${g} gold.` }; } },
      { label: 'Spar one round', desc: 'Lose 5 HP. Upgrade a random card.', ok: () => RUN.hp > 5, go: () => { RUN.hp -= 5; const c = shuffle(RUN.deck.filter(upgradable))[0]; if (c) c.up = true; return { text: `A good workout. −5 HP${c ? `, ${CARDS[c.id].n} upgraded` : ''}.` }; } },
      { label: 'Skip it', desc: '', go: () => ({ text: 'He shadowboxes at your back as you leave.' }) },
    ] },
  { id: 'curling', t: 'The Underground Lake', art: { kind: 'witch', team: { color: '#4a7ab8', light: '#d8ecff', short: 'CRL' }, num: 4 }, acts: [1, 2],
    text: 'Morwen’s aunt is curling alone on a frozen black lake, sweeping like her life depends on it. "Throw one stone. Land it in the house and I will make it worth your while."',
    opts: () => [
      { label: 'Throw the stone', desc: 'Roll a d20. 16+ wins a trophy, 8+ wins 30 gold, under 8 you fall through the ice (−8 HP).', go: () => { const r = evRoll(); if (r >= 16) return { text: `You roll ${r}. Button. Dead centre.`, then: { relic: randomRelic() } }; if (r >= 8) { const g = gainGold(30); return { text: `You roll ${r}. In the house. +${g} gold.` }; } RUN.hp = Math.max(1, RUN.hp - 8); return { text: `You roll ${r}. The ice cracks. −8 HP.` }; } },
      { label: 'Help her sweep', desc: 'Add Hurry Hard to your deck.', go: () => ({ text: '"HARD! HARD!" She is pleased with you.', then: { cards: [{ id: 'sweep', up: false }] } }) },
    ] },
];
function evRoll() { let r = d20(); if (RUN.luck) { r = 20; RUN.luck = 0; } return Math.min(20, r + (r !== 20 ? mod('d20') : 0)); }
function fate() {
  const f = ri(1, 9);
  switch (f) {
    case 1: { const g = gainGold(80); return { text: `The Sun: +${g} gold.` }; }
    case 2: return { text: 'The Star: choose a rare card.', then: { cards: [0, 1, 2].map(() => ({ id: pick(cardPool('r')).id, up: false })) } };
    case 3: return { text: 'The Key: a trophy.', then: { relic: randomRelic() } };
    case 4: { RUN.maxhp += 8; RUN.hp += 8; return { text: 'The Throne: +8 max HP.' }; }
    case 5: { const cs = shuffle(RUN.deck.filter(upgradable)).slice(0, 2); cs.forEach(c => c.up = true); return { text: `The Moon: ${cs.map(c => CARDS[c.id].n).join(' and ') || 'nothing'} upgraded.` }; }
    case 6: { const l = Math.floor(RUN.gold * .3); RUN.gold -= l; return { text: `The Rogue: −${l} gold.` }; }
    case 7: RUN.deck.push(mkCard('injury')); return { text: 'The Skull: a Pulled Hamstring joins your deck.' };
    case 8: RUN.hp = Math.max(1, RUN.hp - 10); return { text: 'The Flames: −10 HP.' };
    default: { const ok = gainTonic(pick(Object.keys(TONICS))); return { text: ok ? 'The Fool: a free tonic.' : 'The Fool: a free tonic, but your belt is full.' }; }
  }
}
function pickEvent() {
  const seenE = RUN.events || (RUN.events = []);
  let pool = EVENTS.filter(e => e.acts.includes(RUN.act) && !seenE.includes(e.id));
  if (!pool.length) pool = EVENTS.filter(e => e.acts.includes(RUN.act));
  const e = pick(pool); seenE.push(e.id); return e;
}

/* ---------- saves and records ---------- */
function saveRun() { if (LAB) return; try { localStorage.setItem(pkey('sd-run'), JSON.stringify(RUN)); } catch (e) { } }
function loadRun() { try { const r = JSON.parse(localStorage.getItem(pkey('sd-run')) || 'null'); return r && r.v === 1 && !r.over ? r : null; } catch (e) { return null; } }
function clearRun() { try { localStorage.removeItem(pkey('sd-run')); } catch (e) { } }
function loadRecords() { try { return JSON.parse(localStorage.getItem(pkey('sd-records')) || 'null') || { runs: [] }; } catch (e) { return { runs: [] }; } }
function runScore(r) { return Math.round(diffOf(r).score * ((r.floorsCleared || r.act * (FLOORS + 1) + r.floor) * 5 + r.stats.elites * 25 + r.stats.bosses * 100 + Math.floor(r.stats.gold / 10) + (r.style || 0) + (r.over === 'win' ? 250 : 0))); }
function recordRun(result) {
  try { achRun(result); } catch (e) { console.error(e); }
  if (!LAB) try { updateCareers(result); } catch (e) { console.error(e); }
  RUN.over = result; RUN.floorsCleared = RUN.act * (FLOORS + 1) + RUN.floor;
  if (LAB) return;
  const rec = loadRecords();
  rec.runs.unshift({ when: Date.now(), diff: diffOf(RUN) === DIFFS[1] ? undefined : DIFFS.indexOf(diffOf(RUN)), club: RUN.club, party: RUN.party.map(p => [p.n, p.kind]), result, act: RUN.act, floor: RUN.floor, score: runScore(RUN), killer: result === 'lose' && B ? B.enemies.filter(e => !e.dead).map(e => e.n).join(', ') : '', relics: RUN.relics.slice(), deck: RUN.deck.length, sportsWins: RUN.stats.sportsWins || 0, style: RUN.style || 0, games: (RUN.games || []).map(g => ({ a: g.act, s: g.sport, t: g.type, u: g.us, h: g.them, o: g.opp, w: g.won ? 1 : 0, f: g.fell ? 1 : 0, l: g.hl, st: g.strokes, p: g.par, k: g.strike ? 1 : 0, n: g.turns, x: g.foes, q: g.q, ps: g.ps, m: g.mvp })) });
  rec.runs = rec.runs.slice(0, 50);
  try { localStorage.setItem(pkey('sd-records'), JSON.stringify(rec)); } catch (e) { }
  clearRun();
}
