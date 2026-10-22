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

