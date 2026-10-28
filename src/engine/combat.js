/* p4: the combat engine. Pure rules: no drawing here. The UI reads B and plays back B.fx. */
var RUN = null, B = null, LAB = false;
let UID = 1;
/* difficulty in one place. hp/dmg are per act (index 0 = Act 1). */
// Difficulty levels, chosen per run (RUN.diff). They adjust the Contender baseline in TUNE.
//   draw: cards per turn   hp: enemy HP multiplier   dmg: added to every enemy hit   heal: share of missing HP healed between acts
const DIFFS = [
  { id: 'rookie', n: 'Rookie', desc: 'Enemies have 15% less HP and hit 1 softer. Heal 65% between acts.', draw: 0, hp: .85, dmg: -1, heal: .65, score: .7 },
  { id: 'contender', n: 'Contender', desc: 'The standard game.', draw: 0, hp: 1, dmg: 0, heal: .45, score: 1 },
  { id: 'allstar', n: 'All-Star', desc: 'Enemies have 10% more HP and hit 1 harder. Heal 35% between acts.', draw: 0, hp: 1.1, dmg: 1, heal: .35, score: 1.25 },
  { id: 'hof', n: 'Hall of Fame', desc: 'Draw 4 cards a turn instead of 5. Enemies have 10% more HP and hit 1 harder. Heal 30% between acts.', draw: -1, hp: 1.1, dmg: 1, heal: .3, score: 1.6 },
];
const diffOf = r => DIFFS[r && r.diff != null ? r.diff : r && r.hard ? 3 : 1];
const TUNE = { draw: 5, hp: [1.24, 1.26, 1.36], dmg: [1, 2, 3], eliteHp: [1.12, 1.26, 1.28], bossHp: [1.05, 1.15, 1.25], actHeal: .45 };
const uid = () => UID++;
const mkCard = (id, up = false) => ({ uid: uid(), id, up });
const def = card => cardDef(card);
const hasRelic = id => RUN && RUN.relics.includes(id);
const sv = (o, k) => (o.st[k] || 0);
const addSt = (o, k, n) => { o.st[k] = (o.st[k] || 0) + n; if (o.st[k] <= 0 && k !== 'str' && k !== 'dex') delete o.st[k]; };
const alive = () => B.enemies.filter(e => !e.dead && !e.fled);
const isBoss = e => !!ENEMIES[e.id].boss;
function fx(ev) { if (!LAB) B.fx.push(ev); }
function log(t, cls) { B.log.push({ t, cls, turn: B.turn }); if (B.log.length > 200) B.log.shift(); }

/* ---------- start of a fight ---------- */
function startCombat(ids, type, sport, trait) {
  const act = RUN.act;
  B = { type, sport, enemies: [], draw: [], hand: [], discard: [], exhaust: [], engulfed: [], turn: 0, energy: 0, maxE: 3, P: { block: 0, st: {} },
    yards: 0, downs: 0, hits: {}, outThisTurn: {}, atkCount: 0, firstAtk: false, bowlUsed: false, jersey: false, killsThisTurn: 0, aliveAtTurnStart: 0,
    fx: [], log: [], over: null, phase: 'player', quarter: 0, gold: 0, luck: RUN.luck || 0, lastRoll: null, totalDmg: 0, grow: {}, cardsThisTurn: 0, lastType: null, freeAtk: false };
  sportInit();
  ids.forEach(id => spawn(id));
  B.nStart = ids.length;
  if (type === 'rival') for (const e of B.enemies) { e.max = e.hp = Math.round(e.hp * (RUN.act ? 1.2 : 1.1)); addSt(e, 'str', 1 + RUN.act); e.n = 'Rival ' + e.n.replace(/^The /, ''); }
  if (ids.some(id => ENEMIES[id].ai.quarters)) { B.sport = QUARTER_SPORT[0]; }
  assignOwners();
  B.draw = shuffle(RUN.deck.map(c => ({ uid: c.uid, id: c.id, up: c.up, own: c.own, sk: c.sk })));
  B.ps = {};
  B.draw.sort((a, b) => (def(a).innate ? 1 : 0) - (def(b).innate ? 1 : 0)); // innate cards go on top
  // relics
  const P = B.P;
  B.trait = trait || null; B.stakes = (RUN.pending && RUN.pending.stakes) || null;
  fire('fightStart');
  log(`${SPORTS[B.sport].n} rules: ${SPORTS[B.sport].rule}.`, 'sys');
  playerTurnStart();
}
function spawn(id, at) {
  const D = ENEMIES[id], hp = Math.round(ri(D.hp[0], D.hp[1]) * (D.boss ? TUNE.bossHp[RUN.act] : TUNE.hp[RUN.act]) * (D.elite ? TUNE.eliteHp[RUN.act] : 1) * diffOf(RUN).hp);
  const team = D.team || ACTS[RUN.act].team;
  const e = { uid: uid(), id, n: D.n, kind: D.kind, hp, max: hp, block: 0, st: {}, intent: null, hist: [], num: ri(2, 99), team, dead: false, fled: false, stolen: 0, born: B.turn, step: 0, flash: 0, disguised: id === 'mascot' };
  if (D.elite && RUN.act) e.st.str = RUN.act + 1; // elites deeper down come in stronger
  if (at != null) B.enemies.splice(at, 0, e); else B.enemies.push(e);
  chooseIntent(e);
  return e;
}
function chooseIntent(e) {
  const A = ENEMIES[e.id].ai;
  let k;
  if (A.quarters) { const q = A.quarters[Math.min(B.quarter, 3)]; k = q[e.step % q.length]; if (B.quarter > 3) k = pick(Object.keys(ENEMIES[e.id].moves)); }
  else if (A.first && !e.hist.length) k = A.first;
  else if (A.seq) k = A.seq[(e.hist.length - (A.first ? 1 : 0)) % A.seq.length];
  else {
    const w = Object.assign({}, A.rand);
    const h = e.hist; if (h.length >= 2 && h[h.length - 1] === h[h.length - 2]) delete w[h[h.length - 1]];
    if (w.play && alive().length >= 3) delete w.play;
    if (!Object.keys(w).length) Object.assign(w, A.rand);
    k = wpick(w);
  }
  if (e.id === 'lichoc' && k === 'play' && alive().length >= 3) k = 'bolt';
  if (ENEMIES[e.id].brain) { const b = ENEMIES[e.id].brain(e); if (b) k = b; }
  e.intent = k;
  e.plan = planOps(e);
}
function planOps(e) { const m = ENEMIES[e.id].moves[e.intent]; if (!m) return []; return typeof m.ops === 'function' ? m.ops(e) : m.ops; }
// what an intent will do, for the icons over each enemy
function intentInfo(e) {
  const m = ENEMIES[e.id].moves[e.intent]; if (!m) return { kinds: [], n: '' };
  const out = { n: e.disguised ? '???' : m.n, kinds: [], dmg: 0, hits: 0 };
  for (const op of (e.plan || planOps(e))) {
    if (op[0] === 'a') { out.dmg = enemyHitDmg(e, op[1]); out.hits = op[2] || 1; out.kinds.push('atk'); if (op[3] === 'pierce') out.pierce = 1; }
    else if (op[0] === 'stripblock' || op[0] === 'dispel' || op[0] === 'stealbest') out.kinds.push('debuff');
    else if (op[0] === 'charge' || op[0] === 'sacrifice' || op[0] === 'cleanse' || op[0] === 'mirrorstr') out.kinds.push('buff');
    else if (op[0] === 'b' || op[0] === 'ba') out.kinds.push('def');
    else if (op[0] === 's' || op[0] === 'sa' || op[0] === 'heal' || op[0] === 'summon') out.kinds.push('buff');
    else if (op[0] === 'p' || op[0] === 'add' || op[0] === 'steal' || op[0] === 'engulf') out.kinds.push('debuff');
    else if (op[0] === 'flee') out.kinds.push('flee');
  }
  if (e.disguised) out.kinds = ['unknown'];
  return out;
}
function enemyHitDmg(e, base) {
  let d = base + sv(e, 'str') + TUNE.dmg[RUN.act] + diffOf(RUN).dmg + (ENEMIES[e.id].elite ? 1 : 0) + sportEnemyBonus() + skyFoeBonus(e);
  if (sv(e, 'weak')) d *= .75;
  if (sv(B.P, 'vuln')) d *= 1.5;
  return Math.max(0, Math.floor(d));
}

/* ---------- turns ---------- */
function playerTurnStart() {
  const P = B.P;
  skyTick();
  B.turn++; B.phase = 'player';
  fire('turnStart'); B.atkCount = 0; B.firstAtk = false; B.hits = {}; B.outThisTurn = {}; B.killsThisTurn = 0; B.aliveAtTurnStart = alive().length;
  B.cardsThisTurn = 0; B.lastType = null; B.freeAtk = false; B.tt = { atk: 0, skl: 0, pow: 0, blk: 0, top: 0, dmg: 0 };
  delete P.st.hot; delete P.st.oop; delete P.st.double; delete P.st.called;
  sportTurnStart();
  if (sv(P, 'intang')) addSt(P, 'intang', -1);
  // block drains, unless the ice or bedrock keeps it
  if (!sv(P, 'barricade') && B.turn > 1) P.block = B.sport === 'hockey' ? Math.floor(P.block / 2) : 0;
  // the Ash Baron runs the clock: a new quarter every three turns
  const baron = B.enemies.find(e => e.id === 'baron' && !e.dead);
  if (baron && B.turn > 1 && (B.turn - 1) % 3 === 0) {
    B.quarter++; baron.step = 0;
    if (B.quarter <= 3) { B.sport = QUARTER_SPORT[B.quarter]; fx({ k: 'banner', t: `${['First', 'Second', 'Third', 'Fourth'][B.quarter]} quarter: ${SPORTS[B.sport].n}`, sub: SPORTS[B.sport].rule }); log(`Quarter ${B.quarter + 1}. ${SPORTS[B.sport].n} rules: ${SPORTS[B.sport].rule}.`, 'sys'); B.yards = 0; }
    else { fx({ k: 'banner', t: 'Overtime', sub: 'Anything goes' }); log('Overtime. Anything goes.', 'sys'); }
    chooseIntent(baron);
  }
  // boxing: the bell
  if (B.sport === 'boxing' && B.turn > 1 && B.turn % 3 === 1) { healP(4); delete P.st.weak; delete P.st.vuln; fx({ k: 'banner', t: 'Ding ding', sub: 'Heal 4, shake off Weak and Exposed' }); log('The bell rings. You catch your breath.', 'good'); }
  // your own lingering effects
  if (sv(P, 'psn')) { loseHP(sv(P, 'psn'), 'Plague'); addSt(P, 'psn', -1); }
  if (sv(P, 'burn')) { const b = sv(P, 'burn'); loseHP(b, 'Burn'); P.st.burn = Math.floor(b / 2); if (!P.st.burn) delete P.st.burn; }
  if (B.over) return;
  if (sv(P, 'ritual')) addSt(P, 'str', sv(P, 'ritual'));
  if (sv(P, 'trollblood')) healP(sv(P, 'trollblood'));
  if (sv(P, 'ward')) gainBlock(sv(P, 'ward'), true);
  if (sv(P, 'tempest')) { const t = pick(alive()); if (t) hurtEnemy(t, sv(P, 'tempest'), { raw: true, src: 'Tempest' }); }
  if (sv(P, 'necro')) for (const e of alive()) addSt(e, 'psn', sv(P, 'necro'));
  if (sv(P, 'spin')) for (const e of alive()) addSt(e, 'weak', sv(P, 'spin'));
  if (sv(P, 'basilisk')) { const t = pick(alive()); if (t) addSt(t, 'vuln', sv(P, 'basilisk')); }
  if (checkWin()) return;
  B.maxE = 3 + ['ioun', 'goldpuck', 'cursedjersey'].filter(hasRelic).length;
  B.energy = B.maxE + sv(P, 'nrgnext') - sv(P, 'drained') - sv(P, 'exert') + mod('energy');
  B.energy = Math.max(0, B.energy);
  delete P.st.nrgnext; delete P.st.drained; delete P.st.exert;
  const sw = sv(P, 'sweat') ? 1 : 0; if (sw) addSt(P, 'sweat', -1);
  const soak = sv(P, 'soaked') ? 1 : 0; if (soak) addSt(P, 'soaked', -1);
  sportTurnBegin();
  let n = TUNE.draw + diffOf(RUN).draw + sw - soak + sportDrawBonus() + sv(P, 'drawnext') + mod('draw');
  delete P.st.drawnext;
  drawCards(n);
  // three strikes in hand: you're struck out
  if (B.hand.filter(c => c.id === 'strikecard').length >= 3) { B.energy = Math.max(0, B.energy - 1); fx({ k: 'banner', t: 'Struck out', sub: 'One less Stamina this turn' }); log('Three strikes in hand. Struck out: one less Stamina.', 'bad'); }
}
function drawCards(n) {
  for (let i = 0; i < n; i++) {
    if (B.hand.length >= 10) break;
    if (!B.draw.length) { if (!B.discard.length) break; B.draw = shuffle(B.discard); B.discard = []; fx({ k: 'shuffle' }); }
    B.hand.push(B.draw.pop());
  }
}
function endTurn() {
  if (B.phase !== 'player' || B.over) return [];
  const P = B.P;
  if (B.sport === 'curling' && B.hand.length) { gainBlock(B.hand.length * 2, true); log(`Sweep! ${B.hand.length} cards left in hand: +${B.hand.length * 2} Block.`, 'good'); }
  if (sv(P, 'plate')) gainBlock(sv(P, 'plate'), true);
  fire('turnEnd');
  for (const c of B.hand) { const d = def(c); if (d.endHurt) loseHP(d.endHurt, d.n); }
  if (B.over) return [];
  if (sv(P, 'regen')) { healP(sv(P, 'regen')); addSt(P, 'regen', -1); }
  fire('turnEndHeal');
  sportTurnEnd();
  B.lt = B.tt || null;
  if (B.over) return [];
  const keep = [];
  for (const c of B.hand) { const d = def(c); if (d.retain) keep.push(c); else if (d.eth) B.exhaust.push(c); else B.discard.push(c); }
  B.hand = keep;
  for (const k of ['weak', 'vuln']) if (sv(P, k)) addSt(P, k, -1);
  B.phase = 'enemy';
  return enemyTurnSteps();
}
// the enemy turn as a list of steps, so the UI can pace it and the lab can run it flat out
function enemyTurnSteps() {
  const steps = [];
  for (const e of B.enemies.slice()) {
    steps.push(() => {
      if (e.dead || e.fled || B.over) return false;
      // start of its turn: shields drop, poisons bite
      e.block = 0;
      if (ENEMIES[e.id].onTurn) ENEMIES[e.id].onTurn(e);
      if (sv(e, 'psn')) { hurtEnemy(e, sv(e, 'psn'), { raw: true, src: 'Plague', psn: 1 }); if (!e.dead) addSt(e, 'psn', -1); }
      if (!e.dead && sv(e, 'burn')) { const b = sv(e, 'burn'); hurtEnemy(e, b, { raw: true, src: 'Burn', burn: 1 }); if (!e.dead) e.st.burn = Math.floor(b / 2) || undefined; if (!e.st.burn) delete e.st.burn; }
      if (e.dead) { checkWin(); return true; }
      if (sv(e, 'ritual')) addSt(e, 'str', sv(e, 'ritual'));
      if (sv(e, 'stun')) { delete e.st.stun; fx({ k: 'say', e: e.uid, t: 'Stunned' }); log(`${e.n} is stunned and loses the turn.`); }
      else { doMove(e); e.hist.push(e.intent); e.step++; if (!e.dead && !e.fled) chooseIntent(e); }
      if (!e.dead && sv(e, 'regen')) { e.hp = Math.min(e.max, e.hp + sv(e, 'regen')); addSt(e, 'regen', -1); }
      for (const k of ['weak', 'vuln']) if (sv(e, k)) addSt(e, k, -1);
      return true;
    });
  }
  steps.push(() => { if (B.over) return false; B.enemies = B.enemies.filter(e => !e.fled && !(e.dead && e.goneT)); if (!checkWin()) playerTurnStart(); return true; });
  return steps;
}
function runSteps(steps) { for (const s of steps) { s(); if (B.over) break; } }

/* ---------- enemy moves ---------- */
function doMove(e) {
  const m = ENEMIES[e.id].moves[e.intent]; if (!m) return;
  e.disguised = false;
  const ops = e.plan || (typeof m.ops === 'function' ? m.ops(e) : m.ops);
  fx({ k: 'lunge', e: e.uid, atk: ops.some(o => o[0] === 'a'), far: m.far });
  fx({ k: 'say', e: e.uid, t: m.n });
  if (m.vfx) fx({ k: 'vfx', v: m.vfx, e: e.uid });
  log(`${e.n}: ${m.n}.`, 'foe');
  for (const op of ops) {
    if (B.over || e.dead) break;
    switch (op[0]) {
      case 'a': for (let i = 0; i < (op[2] || 1); i++) { if (B.over || e.dead) break; const dealt = hurtPlayer(enemyHitDmg(e, op[1]), e, { pierce: op[3] === 'pierce' }); if (op[3] === 'drain' && dealt > 0) { e.hp = Math.min(e.max, e.hp + dealt); fx({ k: 'num', e: e.uid, t: '+' + dealt, col: '#6fe08a' }); } } break;
      case 'b': e.block += op[1]; fx({ k: 'num', e: e.uid, t: '+' + op[1], col: '#9fd2ff', blk: 1 }); break;
      case 'ba': for (const o of alive()) { o.block += op[1]; fx({ k: 'num', e: o.uid, t: '+' + op[1], col: '#9fd2ff', blk: 1 }); } break;
      case 's': addSt(e, op[1], op[2]); break;
      case 'sa': for (const o of alive()) addSt(o, op[1], op[2]); break;
      case 'p': addSt(B.P, op[1], op[2]); fx({ k: 'pst', st: op[1], n: op[2] }); break;
      case 'add': for (let i = 0; i < op[2]; i++) { const c = mkCard(op[1]); if (op[3] === 'draw') B.draw.splice((R() * (B.draw.length + 1)) | 0, 0, c); else B.discard.push(c); } fx({ k: 'addcard', id: op[1], n: op[2] }); log(`${op[2]} × ${CARDS[op[1]].n} shuffled into your ${op[3] === 'draw' ? 'draw pile' : 'discard pile'}.`, 'bad'); break;
      case 'heal': e.hp = Math.min(e.max, e.hp + op[1]); break;
      case 'steal': { const t = Math.min(RUN.gold, op[1]); RUN.gold -= t; e.stolen += t; if (t) { fx({ k: 'num', p: 1, t: `−${t} gold`, col: '#ffd166' }); log(`${e.n} lifts ${t} gold.`, 'bad'); } break; }
      case 'flee': e.fled = true; fx({ k: 'flee', e: e.uid }); log(`${e.n} steals home${e.stolen ? ` with ${e.stolen} of your gold` : ''}.`, 'bad'); checkWin(); break;
      case 'summon': if (alive().length < op[2] && B.enemies.length < 5) { const n = spawn(op[1], 0); fx({ k: 'spawn', e: n.uid }); log(`${n.n} takes the field.`, 'foe'); } break;
      default: bossOp(e, op); break;
      case 'engulf': { for (let i = 0; i < op[1]; i++) { const pile = B.draw.length ? B.draw : B.discard; if (!pile.length) break; const c = pile.splice((R() * pile.length) | 0, 1)[0]; B.engulfed.push(c); } fx({ k: 'say', e: e.uid, t: `${B.engulfed.length} cards inside` }); log(`The cube swallows ${op[1]} of your cards. Beat it to get them back.`, 'bad'); break; }
    }
  }
}
function hurtPlayer(dmg, e, o = {}) {
  const P = B.P;
  if (sv(P, 'intang')) dmg = Math.min(dmg, 1);
  if (sv(P, 'pads')) { P.block += 5; addSt(P, 'pads', -1); fx({ k: 'num', p: 1, t: 'Pad save +5', col: '#9fd2ff', small: 1 }); }
  if (sv(P, 'helmet')) { dmg = Math.max(0, dmg - 3); addSt(P, 'helmet', -1); }
  let taken = dmg;
  const blocked = o.pierce ? 0 : Math.min(P.block, taken); P.block -= blocked; taken -= blocked;
  if (blocked) fx({ k: 'num', p: 1, t: 'blocked ' + blocked, col: '#9fd2ff', small: 1 });
  if (taken > 0) loseHP(taken, e ? e.n : '', true);
  fx({ k: 'hitP', amt: taken });
  if (e && sv(P, 'thorns') && !e.dead) hurtEnemy(e, sv(P, 'thorns'), { raw: true, src: 'Spikes' });
  if (e && sv(P, 'shoulder') && !e.dead) { hurtEnemy(e, 6, { raw: true, src: 'Shoulder Pads', noScore: 1 }); addSt(P, 'shoulder', -1); }
  if (sv(P, 'rage')) addSt(P, 'str', sv(P, 'rage'));
  sportEnemyHit(taken, dmg);
  return taken;
}
function loseHP(n, src, fromHit) {
  RUN.hp -= n; if (!fromHit) fx({ k: 'num', p: 1, t: '−' + n, col: '#ff6a6a' });
  else fx({ k: 'num', p: 1, t: '−' + n, col: '#ff6a6a' });
  if (RUN.hp <= 0) {
    if (sv(B.P, 'phyl')) { delete B.P.st.phyl; RUN.hp = 30; fx({ k: 'banner', t: 'Phylactery', sub: 'Back on your feet at 30 HP' }); log('The phylactery cracks, and you get up.', 'good'); return; }
    if (sv(B.P, 'undying')) { delete B.P.st.undying; RUN.hp = 12; fx({ k: 'banner', t: 'Undying', sub: 'Back on your feet at 12 HP' }); log('Undying: you refuse to stay down.', 'good'); return; }
    if (fire('lethal')) return;
    RUN.hp = 0; B.over = 'lose'; B.phase = 'done'; log('Your line falls.', 'bad');
  }
}
function healP(n) { if (n > 0 && B && B.inCard) n += skyHas('heal'); const h = Math.min(n, RUN.maxhp - RUN.hp); if (h > 0) { RUN.hp += h; fx({ k: 'num', p: 1, t: '+' + h, col: '#6fe08a' }); } }
function gainBlock(n, raw) { let b = Math.max(0, n + (raw ? 0 : sv(B.P, 'dex') + (B.inCard && B.curType === 'skl' && sv(B.P, 'cleats') ? 4 : 0) + (B.inCard && B.curCard ? skyBlk(B.curCard) : 0))); B.P.block += b; credit('b', b); if (B.inCard && B.cd) B.cd.blk += b; if (b) fx({ k: 'num', p: 1, t: '+' + b, col: '#9fd2ff', blk: 1 }); return b; }

/* ---------- hitting enemies ---------- */
// one hit's damage. When WHY is an array, every modifier is also recorded there so the fight can explain the number.
let WHY = null;
function atkDmg(base, e, card, extra = 0) {
  const P = B.P, W = WHY, add = (n, label) => { if (n && W) W.push([label, '+', n]); return n || 0; }, mul = (on, m, label) => { if (on && W) W.push([label, '×', m]); return on ? m : 1; };
  if (W) W.push(['Base', '', base]);
  let d = base + add(sv(P, 'str'), 'Strength') + add(extra, 'Bonus');
  if (card && B.inCard && B.cardBonus) d += add(B.cardBonus, 'Grows');
  if (card && !B.inCard && def(card).grow) d += add(B.grow[card.uid] || 0, 'Grows');
  if (card && def(card).type === 'atk') {
    d += add(sv(P, 'luckybat') ? 4 : 0, 'Lucky Bat');
    d += sportAtkBonus(e);
    if (!B.passHit) { const pb = passBonus(); if (pb) { d += add(pb, 'Passes'); B.passHit = 1; } } // soccer: the passes add to a shot once
    if (!B.inCard || !B.skyHit) { d += add(skyAtk(card), 'The sky'); if (B.inCard) B.skyHit = 1; } // the sky adds to a card's first hit only
    if (B.sport === 'basketball' && (sv(P, 'hot') || (!B.inCard && B.atkCount >= 2))) d += add(3, 'On Fire');
    d += add(sv(P, 'oop'), 'Alley-oop');
    d += add(mod('atk', card), 'Trophies');
    if (B.sport === 'bowling' && card.sk) d += add(2, 'Practiced');
  }
  if (sv(P, 'weak')) d *= mul(1, .75, 'You are Weak');
  if (e) { if (sv(e, 'vuln')) d *= mul(1, 1.5, 'Exposed'); if (B.sport === 'hockey' && sv(e, 'stun')) d *= mul(1, 1.5, 'Stunned (hockey)'); }
  if (card && def(card).type === 'atk' && B.sport === 'jousting' && (B.inCard ? B.joustNow : !B.firstAtk)) d *= mul(1, 2, 'Tilt');
  if (card && def(card).type === 'atk' && sv(P, 'called')) d *= mul(1, 3, 'Called Shot');
  return Math.max(0, Math.floor(d));
}
// the first hit of a card against a target, explained: [{label, op, n}], plus the total
function dmgWhy(card, e) {
  const d = def(card), op = (d.fx || []).find(o => ['d', 'drain', 'dunk', 'drainall'].includes(o[0]));
  if (!op || !e) return null;
  WHY = []; let n; const ph = B.passHit; B.passHit = 0;
  try { n = atkDmg(op[0] === 'dunk' && e.hp < e.max / 2 ? op[2] : op[1], e, card); } finally { var parts = WHY; WHY = null; B.passHit = ph; }
  return parts.length > 1 ? { parts, n, hits: op[0] === 'd' ? op[2] || 1 : 1 } : null;
}
function hurtEnemy(e, dmg, o = {}) {
  if (!e || e.dead || e.fled) return 0;
  let blk = 0;
  if (sv(e, 'air') && !o.psn && !o.burn && !o.raw) dmg = Math.floor(dmg / 2);
  if (!o.psn && !o.burn && !o.pierce) { blk = Math.min(e.block, dmg); e.block -= blk; }
  const taken = dmg - blk;
  credit('d', Math.max(0, taken));
  if (B.inCard && B.cd && !o.noScore) { B.cd.dmg += taken; B.cd.tg[e.uid] = (B.cd.tg[e.uid] || 0) + taken; }
  e.hp -= taken; e.flash = 1; B.totalDmg += taken;
  fx({ k: 'hit', e: e.uid, amt: taken, blk, col: o.psn ? '#8ad65a' : o.burn ? '#ff9a2a' : null });
  if (e.hp <= 0) killEnemy(e);
  else if (ENEMIES[e.id].phases) bossPhaseCheck(e);
  if (B.inCard && !o.raw && !o.noScore && !e.dead && sv(e, 'thorns') && B.phase === 'player') hurtPlayer(sv(e, 'thorns'), null, { pierce: false, spikes: 1 });
  return taken;
}
function killEnemy(e) {
  if (e.dead) return;
  e.hp = 0; e.dead = true; B.killsThisTurn++; credit('k', 1); if (e !== B.P) fire('enemyFalls', e); if (B.inCard && B.cd) B.cd.kills++;
  fx({ k: 'die', e: e.uid });
  log(`${e.n} goes down.`, 'good');
  if (e.stolen) { RUN.gold += e.stolen; log(`You get your ${e.stolen} gold back.`, 'good'); e.stolen = 0; }
  if (e.pocket && e.pocket.length) { B.discard.push(...e.pocket); log(`You get back ${e.pocket.length} stolen card${e.pocket.length > 1 ? 's' : ''}.`, 'good'); e.pocket = []; }
  if ((e.id === 'cube' || e.id === 'cubelet') && B.engulfed.length && !alive().some(o => o.id === 'cube' || o.id === 'cubelet')) { B.discard.push(...B.engulfed); log(`The cube gives back ${B.engulfed.length} cards.`, 'good'); B.engulfed = []; }
  if (sv(B.P, 'nightgame')) healP(sv(B.P, 'nightgame'));
  if (e.id === 'baron') for (const o of alive()) killEnemy(o);
}
function checkWin() {
  if (B.over) return true;
  if (!alive().length) {
    if (B.sport === 'bowling' && B.phase === 'player' && B.killsThisTurn >= B.nStart) { healP(10); B.strike = B.strike || B.turn; fx({ k: 'strike' }); potg('strike', 10); fx({ k: 'banner', t: 'Strike!', sub: 'All pins down: heal 10' }); log('Strike! Heal 10.', 'good'); }
    B.over = 'win'; B.phase = 'done';
    sportFinal();
    return true;
  }
  return false;
}

/* ---------- playing cards ---------- */
function cardCost(card) { const d = def(card); return B && B.freeAtk && d.type === 'atk' ? 0 : d.cost; }
function canPlay(card) {
  const d = def(card);
  if (B.phase !== 'player' || B.over) return false;
  if (d.cost < 0) return false;
  if (d.goldc && RUN.gold < d.goldc) return false;
  if (d.disc && B.hand.length < 2) return false;
  return cardCost(card) <= B.energy;
}
const needsTarget = card => { const d = def(card); return d.tgt === 'one' && (d.type === 'atk' || d.fx.some(o => (o[0] === 's' && (!o[3] || o[3] === 'one')))); };
function playCard(i, ti, opt = {}) {
  const card = B.hand[i]; if (!card || !canPlay(card)) return false;
  const d = def(card);
  let tgt = ti != null ? B.enemies[ti] : null;
  if (needsTarget(card)) { if (!tgt || tgt.dead || tgt.fled) tgt = alive()[0]; if (!tgt) return false; }
  B.energy -= cardCost(card);
  B.hand.splice(i, 1);
  // extra costs, paid up front
  if (d.disc) { let j = B.hand.findIndex(c => c.uid === opt.disc); if (j < 0) j = B.hand.reduce((bj, c, k) => cardValue(c) < cardValue(B.hand[bj]) ? k : bj, 0); const dc = B.hand.splice(j, 1)[0]; if (dc) { B.discard.push(dc); log(`You discard ${def(dc).n}.`); } }
  if (d.toll) loseHP(d.toll, d.n);
  if (B.over) return true;
  if (d.goldc) { RUN.gold -= d.goldc; fx({ k: 'num', p: 1, t: `−${d.goldc} gold`, col: '#ffd166' }); }
  if (d.fatigue) { for (let k = 0; k < d.fatigue; k++) B.discard.push(mkCard('fatigue')); fx({ k: 'addcard', id: 'fatigue', n: d.fatigue }); }
  if (d.exert) addSt(B.P, 'exert', d.exert);
  if (d.foul) { for (const e of alive()) addSt(e, 'str', d.foul); sportFoul(d.foul); log(`Foul! Every enemy gains ${d.foul} Strength.`, 'bad'); fx({ k: 'banner', t: 'Foul', sub: `Enemies gain ${d.foul} Strength${SPORT_UNIT[B.sport] ? ' and score' : ''}`, small: 1 }); }
  B.cardsThisTurn++;
  fire('cardPlayed', card);
  const comboHit = d.combo && B.lastType === d.combo.t;
  const momHit = d.mom && B.cardsThisTurn >= d.mom.n;
  B.cardBonus = d.grow ? (B.grow[card.uid] || 0) : 0;
  B.who = ownerOf(card); credit('c', 1); B.curCard = card; B.skyHit = 0; B.passHit = 0;
  B.curType = d.type;
  sportCardStart(d);
  const times = sv(B.P, 'double') && d.type !== 'pow' ? 2 : 1;
  if (times === 2) delete B.P.st.double;
  if (d.type === 'atk') { B.atkCount++; if (B.sport === 'basketball' && B.atkCount === 3) { B.P.st.hot = 1; fx({ k: 'banner', t: 'He’s on fire', sub: '+3 damage per hit this turn', small: 1 }); log('On Fire: +3 damage per hit for the rest of the turn.', 'good'); } }
  fx({ k: 'play', card: card.id, up: card.up, kind: d.kind, tgt: tgt && tgt.uid, atk: d.type === 'atk' });
  log(`You play ${d.n}${tgt && d.tgt === 'one' ? ` on ${tgt.n}` : ''}.`, 'me');
  for (let r = 0; r < times; r++) {
    if (r && tgt && (tgt.dead || tgt.fled)) tgt = alive()[0];
    if (B.over && B.over !== 'win') break;
    B.inCard = true; B.joustNow = d.type === 'atk' && !B.firstAtk;
    resolve(d.fx, { card, tgt, d });
    if (comboHit && !B.over) { log('Combo!', 'good'); fx({ k: 'say2', t: 'Combo' }); resolve(d.combo.fx, { card, tgt: tgt && !tgt.dead ? tgt : alive()[0], d }); }
    if (momHit && !B.over) { log('Momentum!', 'good'); resolve(d.mom.fx, { card, tgt: tgt && !tgt.dead ? tgt : alive()[0], d }); }
    if (d.home && d.sport === B.sport && !B.over) { log('Home field: the play is on.', 'good'); fx({ k: 'banner', t: d.n, sub: `Home field: a ${SPORTS[B.sport].n.toLowerCase()} play`, small: 1 }); resolve(d.home, { card, tgt: tgt && !tgt.dead ? tgt : alive()[0], d }); }
    B.inCard = false;
    if (B.over) break;
  }
  if (B.tt && B.cd) { B.tt.dmg += B.cd.dmg; B.tt.top = Math.max(B.tt.top, B.cd.dmg); B.tt.blk += B.cd.blk; B.tt[d.type === 'atk' || d.type === 'play' ? 'atk' : d.type === 'skl' ? 'skl' : 'pow']++; }
  sportCardEnd(card, d, tgt);
  if (d.grow) B.grow[card.uid] = (B.grow[card.uid] || 0) + d.grow;
  B.lastType = d.type; B.cardBonus = 0; B.curType = null; B.who = null; B.curCard = null;
  if (B.pendingDraw && !B.over) { drawCards(B.pendingDraw); } B.pendingDraw = 0;
  if (d.type === 'skl' && sv(B.P, 'cleats')) addSt(B.P, 'cleats', -1);
  if (d.type === 'atk') { B.firstAtk = true; if (sv(B.P, 'oop') && d.id !== 'oop') delete B.P.st.oop; if (sv(B.P, 'luckybat')) addSt(B.P, 'luckybat', -1); if (sv(B.P, 'called')) delete B.P.st.called;
    fire('attackPlayed', card); }
  if (d.type === 'skl' && sv(B.P, 'coldsnap')) gainBlock(sv(B.P, 'coldsnap'), true);
  if (sv(B.P, 'haunt')) { const t = pick(alive()); if (t) hurtEnemy(t, sv(B.P, 'haunt'), { raw: true }); }
  // where the card goes
  if (d.type === 'pow' || d.type === 'gear') { /* powers and gear stay in play */ }
  else if (d.ex) B.exhaust.push(card); else B.discard.push(card);
  checkWin();
  if (B.over === 'win') sportFinal();
  return true;
}
function rollD20(dc, label) {
  let r;
  if (B.luck) { r = 20; B.luck = 0; RUN.luck = 0; }
  else r = d20();
  const bonus = mod('d20') + skyHas('dice'), tot = r + bonus;
  const ok = r === 20 || (r !== 1 && tot >= dc);
  B.lastRoll = { r, bonus, dc, ok, crit: r === 20 };
  fx({ k: 'dice', r, bonus, dc, ok, crit: r === 20, label });
  log(`${label || 'Roll'}: d20 ${r}${bonus ? `+${bonus}` : ''} vs ${dc} — ${r === 20 ? 'natural 20!' : r === 1 ? 'natural 1' : ok ? 'success' : 'fail'}.`, ok ? 'good' : 'bad');
  return { ok, crit: r === 20 };
}
function resolve(ops, ctx) {
  const P = B.P, d = ctx.d;
  for (const op of ops) {
    if (B.over && B.over !== 'win') return;
    const scope = op[0] === 's' ? (op[3] || (d.tgt === 'self' ? 'self' : d.tgt === 'all' ? 'all' : 'one')) : (op[3] || d.tgt);
    switch (op[0]) {
      case 'd': {
        const hits = op[2] || 1, mult = ctx.crit ? 2 : 1;
        for (let h = 0; h < hits; h++) {
          if (!alive().length) break;
          const targets = scope === 'all' ? alive() : scope === 'rand' ? [pick(alive())] : [ctx.tgt && !ctx.tgt.dead ? ctx.tgt : null].filter(Boolean);
          for (const e of targets) { hurtEnemy(e, atkDmg(op[1], e, ctx.card) * mult, { pierce: d.pierce }); countHit(e); }
        }
        break;
      }
      case 'drain': { const e = ctx.tgt; if (e && !e.dead) { const t = hurtEnemy(e, atkDmg(op[1], e, ctx.card)); countHit(e); healP(t); } break; }
      case 'dunk': { const e = ctx.tgt; if (e && !e.dead) { hurtEnemy(e, atkDmg(e.hp < e.max / 2 ? op[2] : op[1], e, ctx.card)); countHit(e); } break; }
      case 'bodyslam': { const e = ctx.tgt; if (e && !e.dead) { hurtEnemy(e, atkDmg(P.block - sv(P, 'str'), e, ctx.card)); countHit(e); } break; }
      case 'b': gainBlock(op[1] * (ctx.crit ? 2 : 1)); break;
      case 'bones': gainBlock(Math.min(36, op[1] * B.draw.length)); break;
      case 's': {
        let n = op[2] * (ctx.crit ? 2 : 1); const k = op[1];
        const apply = e => { if (!e || e.dead) return; if (k === 'stun' && isBoss(e)) { addSt(e, 'weak', 2); fx({ k: 'say', e: e.uid, t: 'Too big to stun: Weak 2' }); return; } addSt(e, k, k === 'burn' ? n + sv(P, 'kindle') + skyHas('rot') : k === 'psn' ? n + skyHas('rot') : k === 'weak' ? n + skyHas('weak') : k === 'stun' ? 1 : n); if (k === 'stun') fx({ k: 'say', e: e.uid, t: 'Stunned!' }); };
        if (scope === 'self') { addSt(P, k, n); fx({ k: 'pst', st: k, n }); }
        else if (scope === 'all') alive().forEach(apply);
        else if (scope === 'rand') apply(pick(alive()));
        else apply(ctx.tgt);
        break;
      }
      case 'draw': drawCards(op[1]); break;
      case 'nrg': B.energy += op[1]; break;
      case 'heal': healP(op[1]); break;
      case 'lose': loseHP(op[1], 'self'); break;
      case 'gold': RUN.gold += op[1]; fx({ k: 'num', p: 1, t: `+${op[1]} gold`, col: '#ffd166' }); break;
      case 'maxhp': RUN.maxhp += op[1]; RUN.hp += op[1]; fx({ k: 'num', p: 1, t: `+${op[1]} max HP`, col: '#6fe08a' }); break;
      case 'roll': { const r = rollD20(op[1], d.n); resolve(r.ok ? op[2] : op[3], Object.assign({}, ctx, { crit: r.crit })); break; }
      case 'kill': if (ctx.tgt && ctx.tgt.dead) resolve(op[1], ctx); break;
      case 'allkilled': if (!alive().length) resolve(op[1], ctx); break;
      case 'ifst': resolve(ctx.tgt && sv(ctx.tgt, op[1]) ? op[2] : op[3], ctx); break;
      case 'add': for (let i = 0; i < op[2]; i++) { if (op[3] === 'hand' && B.hand.length < 10) B.hand.push(mkCard(op[1])); else B.discard.push(mkCard(op[1])); } break;
      case 'audible': { const n = B.hand.length; B.discard.push(...B.hand); B.hand = []; drawCards(n); break; }
      case 'devour': { const e = ctx.tgt; if (!e || e.dead) break; if (!isBoss(e) && e.hp <= op[1]) { fx({ k: 'say', e: e.uid, t: 'Devoured!' }); log(`${e.n} is eaten whole.`, 'good'); hurtEnemy(e, e.hp + e.block, { raw: true }); healP(op[2]); } else { hurtEnemy(e, atkDmg(16, e, ctx.card)); countHit(e); } break; }
      case 'petrify': { const e = ctx.tgt; if (!e || e.dead) break; if (!isBoss(e) && e.hp <= e.max * op[1]) { fx({ k: 'say', e: e.uid, t: 'Turned to stone' }); log(`${e.n} turns to stone.`, 'good'); hurtEnemy(e, e.hp + e.block, { raw: true }); } else { hurtEnemy(e, atkDmg(18, e, ctx.card)); countHit(e); } break; }
      case 'execute': { const e = ctx.tgt; if (!e || e.dead) break; if (!isBoss(e)) { fx({ k: 'say', e: e.uid, t: 'Hole in one!' }); hurtEnemy(e, e.hp + e.block, { raw: true }); } else hurtEnemy(e, atkDmg(40, e, ctx.card)); break; }
      case 'luck': B.luck = 1; RUN.luck = 1; break;
      case 'loseblock': P.block = 0; break;
      case 'strip': for (const e of alive()) { e.block = 0; if (sv(e, 'str') > 0) delete e.st.str; } log('Every enemy is stripped of Block and Strength.', 'good'); break;
      case 'drainall': { let tot = 0; for (const e of alive()) tot += hurtEnemy(e, atkDmg(op[1], e, ctx.card)); healP(tot); break; }
      case 'split': { const al = alive(); const ends = al.length > 1 ? [al[0], al[al.length - 1]] : al; for (const e of ends) hurtEnemy(e, atkDmg(op[1], e, ctx.card)); break; }
      case 'petrifyall': for (const e of alive()) { if (!isBoss(e) && e.hp <= e.max * op[1]) { fx({ k: 'say', e: e.uid, t: 'Turned to stone' }); hurtEnemy(e, e.hp + e.block, { raw: true }); } else hurtEnemy(e, atkDmg(op[2], e, ctx.card)); } break;
      case 'bonestorm': { const n = op[1] * B.discard.length; for (const e of alive()) hurtEnemy(e, atkDmg(n, e, ctx.card)); break; }
      case 'freeatk': B.freeAtk = true; log('Every Attack costs 0 for the rest of the turn.', 'good'); break;
      case 'runners': case 'advance': case 'putOn': case 'yards': case 'ifyards': case 'td': case 'atkcount': case 'freestroke': case 'lance': case 'passes':
        sportOp(op, ctx); break;
    }
    if (checkWin()) return;
  }
}
// baseball: three hits on one enemy in one turn
function countHit(e) {
  if (B.sport !== 'baseball' || e.dead || B.outThisTurn[e.uid]) return;
  B.hits[e.uid] = (B.hits[e.uid] || 0) + 1;
  if (B.hits[e.uid] >= 3) {
    B.outThisTurn[e.uid] = 1;
    if (isBoss(e)) { addSt(e, 'weak', 2); fx({ k: 'say', e: e.uid, t: 'Strike three! Weak 2' }); }
    else { addSt(e, 'stun', 1); fx({ k: 'say', e: e.uid, t: 'Strike three! Struck out' }); }
    log(`Strike three on ${e.n}.`, 'good');
  }
}
function useTonic(slot, ti) {
  const id = RUN.tonics[slot]; if (!id || !B || B.phase !== 'player' || B.over) return false;
  const T = TONICS[id];
  RUN.tonics[slot] = null;
  const tgt = ti != null ? B.enemies[ti] : alive()[0];
  log(`You drink ${T.n}.`, 'me');
  resolve(T.fx, { card: null, tgt, d: { tgt: 'self', n: T.n, type: 'tonic' } });
  checkWin();
  return true;
}
