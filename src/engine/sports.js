/* p4b: the sports layer. Every fight keeps score. Cards score by type and by how hard they hit;
   enemy attacks that get through your Block score for them. Win the fight AND the game for a sports win. */
const SPORT_UNIT = { baseball: 1, football: 3, hockey: 1, basketball: 2, jousting: 1, curling: 1, soccer: 1 };
const HIT_NAME = ['Out', 'Single', 'Double', 'Triple', 'Home run'];
const hitBases = dmg => dmg <= 0 ? 0 : dmg < 10 ? 1 : dmg < 18 ? 2 : dmg < 25 ? 3 : 4;
const PAR = 4;
const parFor = () => 1 + (B.nStart || 1) + (B.type === 'elite' ? 2 : 0) + (B.type === 'boss' ? 5 : 0);
const HL_NAME = { walkoff: 'Walk-off', grandslam: 'Grand slam', tdfinish: 'Game-winning touchdown', twotd: 'Two touchdowns', hattrick: 'Hat trick', shutout: 'Shutout', buzzer: 'Buzzer beater', thirty: 'Thirty-point night', eagle: 'Eagle', strike: 'Strike', unhorsed: 'Unhorsed', button: 'Three in the house', ko: 'Knockout', golazo: 'Golazo', cleansheet: 'Clean sheet', brickwall: 'Brick wall' };
function sportInit() { B.sc = { us: 0, them: 0, bases: [0, 0, 0], outs: 0, goals: 0, pts: 0, td: 0, lances: 0, stones: 0, free: 0, rounds: [0, 0], rd: [0, 0], hl: [], win: false, done: false, passes: 0, saves: 0 }; B.yards = 20; }
const scored = () => !!SPORT_UNIT[B.sport];
function cardHasDmg(d) { const has = ops => ops.some(o => ['d', 'drain', 'dunk', 'bodyslam', 'split', 'drainall', 'bonestorm', 'devour', 'petrify', 'petrifyall', 'execute'].includes(o[0]) || (o[0] === 'roll' && (has(o[2]) || has(o[3])))); return has(d.fx); }
function cardValue(c) { const d = def(c); if (d.type === 'junk' || d.type === 'curse') return -10; return ({ s: 1, c: 2, u: 3, r: 4, l: 6 }[d.rar] || 1) + (c.up ? 1 : 0) - (d.id === 'check' || d.id === 'hold' ? 1 : 0); }
function addHL(id) { if (B.sc.hl.includes(id)) return; B.sc.hl.push(id); fx({ k: 'banner', t: HL_NAME[id], sub: 'Highlight: bonus style points', small: 1 }); log(`Highlight: ${HL_NAME[id]}.`, 'good'); }
function scoreUs(n, what) { B.sc.us += n; credit('p', n); potg(what, n); fx({ k: 'score', side: 0, n, what }); momentumCheck(); }
function scoreThem(n) { if (n && perkOn('ace')) n *= 2; B.sc.them += n; fx({ k: 'score', side: 1, n }); momentumCheck(); }
/* momentum: the score margin pushes the fight. Lead and your hits land harder; trail and theirs do,
   until you are far enough behind that desperation kicks in (Comeback: an extra card every turn). */
const MOM = { baseball: [2, 4], football: [7, 14], hockey: [2, 3], basketball: [6, 12], jousting: [2, 3], curling: [2, 3], boxing: [1, 2], soccer: [2, 3] };
const MOM_NAME = { 2: 'Rout', 1: 'Crowd on its feet', 0: 'Even game', '-1': 'Their momentum', '-2': 'Comeback mode' };
const MOM_SUB = { 2: 'Your hits deal 2 more damage', 1: 'Your hits deal 1 more damage', 0: '', '-1': 'Their hits deal 1 more damage', '-2': 'Their hits deal 1 more, but you draw an extra card each turn' };
function momMargin() { if (!B || !B.sc) return 0; if (B.sport === 'boxing') return B.sc.rounds[0] - B.sc.rounds[1]; if (B.sport === 'golf') return B.turn > parFor() ? -(B.turn - parFor()) * 7 : 0; return B.sc.us - B.sc.them; }
function momTier() { const T = MOM[B && B.sport]; if (!T) return 0; const m = momMargin(); return m >= T[1] ? 2 : m >= T[0] ? 1 : m <= -T[1] ? -2 : m <= -T[0] ? -1 : 0; }
function momentumCheck() {
  const t = momTier(); if (B.sc.tier === t) return;
  const up = t > (B.sc.tier || 0); B.sc.tier = t;
  fx({ k: 'mom', tier: t, up });
  if (t) { fx({ k: 'banner', t: MOM_NAME[t], sub: MOM_SUB[t], small: 1 }); log(`${MOM_NAME[t]}: ${MOM_SUB[t].toLowerCase()}.`, t > 0 ? 'good' : 'bad'); }
}
// what the state of the game adds to your hits, their hits, and your draw
function sportAtkBonus(e) {
  if (!B || !B.sc) return 0;
  const t = momTier(), W = WHY, add = (n, l) => { if (n && W) W.push([l, '+', n]); return n; };
  let d = add(t > 0 ? t : 0, MOM_NAME[t]);
  if (B.sport === 'baseball') d += add(Math.min(3, B.sc.bases.filter(Boolean).length), 'Runners on');   // runners on: pressure
  if (B.sport === 'football' && B.yards >= 75) d += add(2, 'Red zone');                                // the red zone
  if (B.sport === 'soccer' && (B.sc.passes || 0) >= 3) d += add(Math.min(6, B.sc.passes), 'Passes');        // the shot after the passes
  return d;
}
function sportEnemyBonus() {
  if (!B || !B.sc) return 0;
  const t = momTier(); let d = t < 0 ? 1 : 0;
  if (B.sport === 'football' && B.yards <= 10) d += 1;                               // pinned deep
  return d;
}
const sportDrawBonus = () => (B && B.sc && momTier() === -2 ? 1 : 0);
function sportTurnBegin() {
  // curling: every stone already in the house guards you
  if (B.sport === 'curling' && B.sc.stones) { gainBlock(2 * B.sc.stones, true); }
  // golf: past par, the rough bites
  if (B.sport === 'golf' && B.turn > parFor()) { for (const e of alive()) addSt(e, 'str', 1); fx({ k: 'banner', t: 'In the rough', sub: 'Past par: every enemy gains 1 Strength', small: 1 }); momentumCheck(); }
  B.sc.basket = false; B.sc.played = 0; B.sc.curlP = 0;
  // soccer: the passes start again, with one from the keeper after a save
  if (B.sport === 'soccer') { B.sc.passes = B.sc.keep ? 1 : 0; B.sc.keep = 0; }
}
function sportFoul(n) { if (scored()) { scoreThem(SPORT_UNIT[B.sport]); log(`The foul gives them ${SPORT_UNIT[B.sport]}.`, 'bad'); } }
function splash(n, why) { for (const e of alive()) hurtEnemy(e, n, { raw: true, noScore: 1 }); }

/* baseball: every damaging card is an at-bat; how hard it hits decides how far the batter gets */
function runHome(r, how) {
  if (!r) return;
  scoreUs(r, 'run');
  fx({ k: 'banner', t: r === 1 ? 'Run scores' : `${r} runs score`, sub: `${3 * r} damage to every enemy`, small: 1 });
  log(`${r} run${r > 1 ? 's' : ''} score${r > 1 ? '' : 's'}: ${3 * r} damage to every enemy.`, 'good');
  const before = alive().length, behind = B.sc.us - r <= B.sc.them;
  splash(3 * r);
  if (before && !alive().length && behind) addHL('walkoff');
}
function advance(n, batter) {
  const b = B.sc.bases, nb = [0, 0, 0]; let runs = 0;
  fx({ k: 'bases', before: b.slice(), n, batter });
  for (let i = 2; i >= 0; i--) if (b[i]) { const p = i + n; if (p >= 3) runs++; else nb[p] = 1; }
  if (batter) { if (n >= 4) runs++; else nb[n - 1] = 1; }
  B.sc.bases = nb; return runs;
}
function walkBatter() { const b = B.sc.bases; let runs = 0; fx({ k: 'bases', before: b.slice(), n: 1, batter: true, walk: true }); if (b[0]) { if (b[1]) { if (b[2]) runs++; b[2] = 1; } b[1] = 1; } b[0] = 1; return runs; }

/* football: Attacks throw for yards, Skills run for half their Block, Plays do both */
function yards(n) {
  if (n <= 0) return;
  const before = B.yards; B.yards = Math.min(100, B.yards + n);
  const d0 = Math.floor(before / 25), d1 = Math.floor(Math.min(99, B.yards) / 25);
  if (B.yards >= 100) touchdown();
  else if (d1 > d0) { fx({ k: 'banner', t: 'First down', sub: 'Draw a card', small: 1 }); log('First down: draw a card.', 'good'); drawCards(1); }
}
function touchdown() {
  B.sc.td++; B.yards = 20; scoreUs(7, 'touchdown');
  fx({ k: 'banner', t: 'Touchdown', sub: '12 damage to every enemy' }); log('Touchdown! 12 damage to every enemy.', 'good');
  const before = alive().length; splash(12);
  if (before && !alive().length) addHL('tdfinish');
  if (B.sc.td >= 2) addHL('twotd');
}

function sportCardStart(d) { B.cd = { dmg: 0, tg: {}, blk: 0, kills: 0, joust: d.type === 'atk' && !B.firstAtk, nrg0: null }; }
function sportCardEnd(card, d, tgt) {
  const C = B.cd; if (!C) return; B.cd = null;
  if (C.dmg >= 15) potg('hit', C.dmg, card);
  const top = Math.max(0, ...Object.values(C.tg)), dmgCard = cardHasDmg(d) && (d.type === 'atk' || d.type === 'play');
  const lastKill = B.over === 'win' || !alive().length;
  switch (B.sport) {
    case 'baseball': {
      if (!dmgCard) break;
      const T = SKT(card), n0 = hitBases(C.dmg), n = T.hit > 0 ? (n0 ? Math.min(4, n0 + 1) : C.dmg > 0 ? 1 : 0) : T.hit < 0 ? Math.max(0, n0 - 1) : n0;
      if (!n) { B.sc.outs++; fx({ k: 'say2', t: 'Out' }); if (B.sc.outs >= 3) { B.sc.outs = 0; B.sc.bases = [0, 0, 0]; log('Three outs: the bases clear.', 'bad'); fx({ k: 'say2', t: 'Side retired' }); } break; }
      const loaded = B.sc.bases.every(Boolean);
      const r = advance(n, true);
      fx({ k: 'say2', t: HIT_NAME[n] }); fx({ k: 'bat', n }); log(`${HIT_NAME[n]}!`, 'good');
      if (n === 4 && loaded) addHL('grandslam');
      if (n === 4 && lastKill && B.sc.us <= B.sc.them) addHL('walkoff');
      runHome(r);
      break;
    }
    case 'football': {
      const y = Math.floor(((d.type === 'atk' || d.type === 'play' ? C.dmg : 0) + (d.type === 'skl' || d.type === 'play' || d.type === 'gear' ? Math.floor(C.blk / 2) : 0)) * SKT(card).yards);
      if (y > 0) { fx({ k: 'say2', t: `+${y} yards` }); yards(y); }
      break;
    }
    case 'hockey': {
      if (!dmgCard || top <= 0) break;
      const t = tgt || null, pp = t && sv(t, 'stun');
      const T = SKT(card);
      if (top >= T.goal || (pp && top >= T.pp) || sv(B.P, 'pulled')) {
        delete B.P.st.pulled; B.sc.goals++; scoreUs(1, 'goal');
        fx({ k: 'banner', t: 'Goal', sub: pp ? 'Power-play goal: draw a card' : 'Draw a card', small: 1 }); log('GOAL! Draw a card.', 'good'); drawCards(1);
        if (B.sc.goals >= 3) addHL('hattrick');
      } else { const g = t && !t.dead ? t : alive()[0]; if (g) { g.block += 2; fx({ k: 'save', e: g.uid }); } fx({ k: 'say2', t: 'Saved (+2 Block)' }); }
      break;
    }
    case 'basketball': {
      const T = SKT(card);
      if (!dmgCard || top < T.bk) { if (dmgCard) fx({ k: 'say2', t: 'Off the rim' }); break; }
      let p = (T.threeAny || def(card).cost >= 2) && top >= T.three ? 3 : 2; if (d.type === 'play' && d.sport === 'basketball') p++;
      B.sc.pts += p; B.sc.basket = true; fx({ k: 'swish', n: p }); scoreUs(p, 'basket'); fx({ k: 'say2', t: p >= 3 ? `+${p}! From downtown` : `+${p}` });
      if (p >= 3 && tgt && !tgt.dead) addSt(tgt, 'vuln', 1);
      if (lastKill && B.energy === 0) addHL('buzzer');
      if (B.sc.pts >= 30) addHL('thirty');
      break;
    }
    case 'jousting': if (C.joust && dmgCard) { if (top >= SKT(card).lance) { B.sc.lances++; scoreUs(1, 'lance'); fx({ k: 'banner', t: 'Lance shattered', sub: 'A point in the lists', small: 1 }); } if (lastKill) addHL('unhorsed'); } break;
    case 'golf': if (top >= SKT(card).drive && B.sc.free < B.turn) { fx({ k: 'drive' }); B.sc.free++; fx({ k: 'banner', t: 'Long drive', sub: 'This turn does not count as a stroke', small: 1 }); } break;
    case 'boxing': B.sc.rd[0] += Math.round(C.dmg * SKT(card).box); break;
    case 'curling': if (card.sk && d.type !== 'atk') B.sc.curlP = (B.sc.curlP || 0) + 1; break;
    case 'soccer': {
      const n = B.sc.passes || 0;
      if (d.type !== 'atk' || !dmgCard || n < 3) { B.sc.passes = n + 1; break; }
      // a shot: the passes are spent, scored or saved
      B.sc.passes = 0;
      if (top >= SKT(card).kick) {
        B.sc.goals++; scoreUs(1, 'goal');
        fx({ k: 'banner', t: 'Goal', sub: n >= 6 ? `After ${n} passes: draw a card` : 'Draw a card', small: 1 }); log(`GOAL after ${n} passes! Draw a card.`, 'good'); drawCards(1);
        if (n >= 6) addHL('golazo');
        if (B.sc.goals >= 3) addHL('hattrick');
      } else { fx({ k: 'say2', t: 'Saved' }); log('The shot is saved. The passes start again.', 'bad'); }
      break;
    }
  }
}
function sportOp(op, ctx) {
  switch (op[0]) {
    case 'runners': { if (B.sport !== 'baseball') break; const r = B.sc.bases.filter(Boolean).length; fx({ k: 'bases', before: B.sc.bases.slice(), n: 4, batter: false }); B.sc.bases = [0, 0, 0]; runHome(r); break; }
    case 'advance': if (B.sport === 'baseball') runHome(advance(op[1], false)); break;
    case 'putOn': if (B.sport === 'baseball') { runHome(walkBatter()); fx({ k: 'say2', t: 'Ball four' }); } break;
    case 'yards': if (B.sport === 'football') yards(op[1]); break;
    case 'ifyards': if (B.sport === 'football') resolve(B.yards >= op[1] ? op[2] : op[3], ctx); break;
    case 'td': if (B.sport === 'football') touchdown(); break;
    case 'atkcount': B.atkCount += op[1]; if (B.sport === 'basketball' && B.atkCount >= 3 && !sv(B.P, 'hot')) { B.P.st.hot = 1; fx({ k: 'banner', t: 'He’s on fire', sub: '+3 damage per hit this turn', small: 1 }); } break;
    case 'freestroke': if (B.sport === 'golf') B.sc.free++; break;
    case 'lance': if (B.sport === 'jousting') { B.sc.lances++; scoreUs(1, 'lance'); } break;
    case 'passes': if (B.sport === 'soccer') { B.sc.passes = (B.sc.passes || 0) + op[1]; fx({ k: 'say2', t: `+${op[1]} passes` }); } break;
  }
}
function sportEnemyHit(taken, raw) {
  if (B.sport === 'boxing') B.sc.rd[1] += raw;
  if (B.sport === 'soccer') { B.sc.eh = (B.sc.eh || 0) + 1; if (taken > 0) B.sc.et = 1; } // for the save: hits, and whether any got through
  if (taken <= 0) return;
  if (B.sport === 'football') { B.yards = Math.max(0, B.yards - taken); if (taken >= 8) { scoreThem(3); if (perkOn('clutch') && B.turn >= 3) scoreThem(3); } return; }
  if (B.sport === 'hockey' && taken < 3) return;
  if (B.sport === 'soccer' && taken < 5) return;
  if (scored()) { scoreThem(SPORT_UNIT[B.sport]); if (perkOn('clutch') && B.turn >= 3) scoreThem(SPORT_UNIT[B.sport]); }
}
function sportTurnEnd() {
  const P = B.P;
  if (B.turn === 1 && B.sc.us < B.sc.them) B.sc.trailedT1 = 1;
  // basketball: a turn with no basket is a shot-clock violation
  if (B.sport === 'basketball' && B.cardsThisTurn > 0 && !B.sc.basket && alive().length) { scoreThem(2); fx({ k: 'banner', t: 'Shot clock violation', sub: 'No basket this turn: 2 points to them', small: 1 }); log('Shot clock violation: 2 points to them.', 'bad'); }
  if (B.sport === 'curling' && P.block >= Math.max(6, 12 - 3 * (B.sc.curlP || 0))) { B.sc.stones++; scoreUs(1, 'stone'); fx({ k: 'banner', t: 'In the house', sub: '12+ Block at the end of your turn', small: 1 }); if (B.sc.stones >= 3) addHL('button'); }
  if (B.sport === 'football' && B.yards >= 60) {
    scoreUs(3, 'field goal'); B.yards = 20;
    fx({ k: 'banner', t: 'Field goal', sub: '5 damage to every enemy', small: 1 }); log('Field goal: 5 damage to every enemy.', 'good');
    splash(5); checkWin();
  }
}
function sportTurnStart() {
  // soccer: an enemy turn of hits that all came off your Block is a goal prevented
  if (B.sport === 'soccer' && B.turn > 1) {
    if (B.sc.eh && !B.sc.et) {
      B.sc.saves = (B.sc.saves || 0) + 1; B.sc.keep = 1;
      fx({ k: 'banner', t: 'Goal prevented', sub: 'You blocked every hit: start this turn with a pass', small: 1 }); log('Goal prevented: every hit blocked. The keeper starts the counter (1 pass).', 'good');
      if (B.sc.saves >= 3) addHL('brickwall');
    }
    B.sc.eh = 0; B.sc.et = 0;
  }
  if (B.sport === 'boxing' && B.turn > 1) {
    const [u, t] = B.sc.rd; fx({ k: 'bell', win: u > t }); if (u > t) { B.sc.rounds[0]++; scoreUs(0); } else if (t > u) { B.sc.rounds[1]++; scoreThem(0); }
    if (u - t >= 15) { for (const e of alive()) addSt(e, 'weak', 1); fx({ k: 'banner', t: 'They’re rocked', sub: 'You took the round by 15+: every enemy is Weak', small: 1 }); }
    else if (t - u >= 15) { addSt(B.P, 'weak', 1); fx({ k: 'banner', t: 'You’re rocked', sub: 'They took the round by 15+: you are Weak', small: 1 }); }
    B.sc.rd = [0, 0];
  }
}
function sportFinal() {
  const S = B.sc; if (!S || S.done) return; S.done = true;
  let win = false;
  if (scored()) win = S.us > S.them;
  if (B.sport === 'hockey' && S.them === 0 && S.goals > 0) addHL('shutout');
  if (B.sport === 'soccer' && S.them === 0 && S.goals > 0 && win) addHL('cleansheet');
  if (B.sport === 'golf') { const strokes = B.turn - S.free; win = strokes <= parFor(); if (strokes <= parFor() - 2) addHL('eagle'); }
  if (B.sport === 'bowling') { win = !!B.strike && B.strike <= 4; if (B.strike && B.turn === 1) addHL('strike'); }
  if (B.sport === 'boxing') { const [u, t] = S.rd; if (u > t) S.rounds[0]++; else if (t > u) S.rounds[1]++; win = S.rounds[0] > S.rounds[1]; if (B.turn <= 2 && B.type !== 'normal') addHL('ko'); }
  if (S.hl.some(h => ['walkoff', 'tdfinish', 'strike', 'eagle'].includes(h))) win = true;
  S.win = win;
  if (win) log(`You won the ${SPORTS[B.sport].n.toLowerCase()} game too.`, 'good');
}
// what the scoreboard says
function sportLine() {
  const S = B.sc, T = B.enemies[0] && B.enemies[0].team ? B.enemies[0].team.short : 'PIT', me = RUN ? CLUBS[RUN.club].short : 'YOU';
  switch (B.sport) {
    case 'golf': return `Stroke ${Math.max(0, B.turn - S.free)} of par ${parFor()}`;
    case 'bowling': return `Frame ${B.turn}: ${B.nStart} pin${B.nStart > 1 ? 's' : ''} to drop in one turn${B.turn > 4 ? ' (too late for the win)' : ', a strike by frame 4 wins'}`;
    case 'boxing': return `Round ${B.turn}  Cards ${S.rounds[0]}–${S.rounds[1]}`;
    case 'baseball': return `${me} ${S.us}  ${T} ${S.them}   Outs ${S.outs}`;
    case 'basketball': return `${me} ${S.us}  ${T} ${S.them}${sv(B.P, 'hot') ? '   ON FIRE' : ''}`;
    case 'soccer': return `${me} ${S.us}  ${T} ${S.them}   Passes ${S.passes || 0}`;
    default: return `${me} ${S.us}  ${T} ${S.them}`;
  }
}
// a forecast of what a card will do for the game, shown on the card in your hand
function sportBadge(card, tgt) {
  if (!B || !B.sc) return '';
  const d = def(card); if (d.type === 'junk' || d.type === 'curse') return '';
  const t = tgt || alive()[0]; if (!t) return '';
  const est = estDamage(card, t), dmgCard = cardHasDmg(d) && (d.type === 'atk' || d.type === 'play');
  switch (B.sport) {
    case 'baseball': { if (!dmgCard) return ''; const T = SKT(card), n0 = est.total > 0 ? hitBases(est.total) : 0, n = T.hit > 0 ? (n0 ? Math.min(4, n0 + 1) : est.total > 0 ? 1 : 0) : T.hit < 0 ? Math.max(0, n0 - 1) : n0; return n ? HIT_NAME[n] : 'Out'; }
    case 'football': { const y = Math.floor(((d.type === 'atk' || d.type === 'play' ? est.total : 0) + (d.type !== 'atk' ? Math.floor(est.blk / 2) : 0)) * SKT(card).yards); return y > 0 ? `+${y} yds` : ''; }
    case 'hockey': { const T = SKT(card); return dmgCard && est.top > 0 ? (est.top >= T.goal || sv(B.P, 'pulled') || (sv(t, 'stun') && est.top >= T.pp) ? 'Goal' : 'Shot') : ''; }
    case 'basketball': { const T = SKT(card); return dmgCard ? (est.top < T.bk ? 'Brick' : `+${((T.threeAny || d.cost >= 2) && est.top >= T.three ? 3 : 2) + (d.type === 'play' && d.sport === 'basketball' ? 1 : 0)}`) : ''; }
    case 'jousting': return d.type === 'atk' && !B.firstAtk ? 'Tilt ×2' : '';
    case 'golf': return est.top >= SKT(card).drive ? 'Long drive' : '';
    case 'soccer': return d.type === 'atk' && dmgCard && (B.sc.passes || 0) >= 3 ? (est.top >= SKT(card).kick ? 'Goal' : 'Shot') : 'Pass';
  }
  return '';
}
// rough damage forecast (no dice): per target and total
function estDamage(card, tgt) {
  const d = def(card), out = { total: 0, top: 0, blk: 0, per: {} };
  const add = (e, n) => { if (!e || e.dead) return; const after = d.pierce ? n : Math.max(0, n - e.block); out.per[e.uid] = (out.per[e.uid] || 0) + after; out.total += after; out.top = Math.max(out.top, out.per[e.uid]); };
  const walk = ops => { for (const o of ops) {
    const scope = o[3] || d.tgt;
    if (o[0] === 'd') { for (let h = 0; h < (o[2] || 1); h++) { if (scope === 'all') alive().forEach(e => add(e, atkDmg(o[1], e, card))); else if (scope === 'rand') out.total += atkDmg(o[1], null, card) / 1; else add(tgt, atkDmg(o[1], tgt, card)); } }
    else if (o[0] === 'drain') add(tgt, atkDmg(o[1], tgt, card));
    else if (o[0] === 'dunk') add(tgt, atkDmg(tgt && tgt.hp < tgt.max / 2 ? o[2] : o[1], tgt, card));
    else if (o[0] === 'bodyslam') add(tgt, atkDmg(B.P.block - sv(B.P, 'str'), tgt, card));
    else if (o[0] === 'drainall') alive().forEach(e => add(e, atkDmg(o[1], e, card)));
    else if (o[0] === 'bonestorm') alive().forEach(e => add(e, atkDmg(o[1] * B.discard.length, e, card)));
    else if (o[0] === 'b') out.blk += o[1] + sv(B.P, 'dex');
    else if (o[0] === 'bones') out.blk += Math.min(36, o[1] * B.draw.length);
  } };
  walk(d.fx);
  out.total = Math.round(out.total);
  return out;
}

// the play of the game: the biggest scoring moment, credited to the card (and player) that made it
const POTG_W = { touchdown: 3, 'field goal': 1.5, run: 2.2, goal: 4, basket: 1.6, lance: 3, stone: 2.5, strike: 1.2, hit: .25 };
const POTG_TXT = { touchdown: 'a touchdown', 'field goal': 'a field goal', goal: 'a goal', lance: 'a shattered lance', stone: 'a stone in the house', strike: 'a strike' };
function potg(what, n, card) {
  if (!B || !B.sc || !what) return;
  card = card || B.curCard; if (!card) return;
  const v = (POTG_W[what] || 1) * n; if (B.sc.potg && B.sc.potg.v >= v) return;
  const txt = what === 'run' ? (n >= 4 ? 'a grand slam' : n > 1 ? `${n} runs home` : 'a run home') : what === 'basket' ? (n >= 3 ? 'a three from downtown' : 'a basket') : what === 'hit' ? `a ${n}-damage hit` : POTG_TXT[what] || what;
  B.sc.potg = { v, card: def(card).n, who: ownerOf(card), what: txt, sport: B.sport };
}
