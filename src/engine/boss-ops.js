/* p4c: boss rules — phases and the extra moves the bosses use */
function bossPhaseCheck(e) {
  const D = ENEMIES[e.id];
  for (let i = 0; i < D.phases.length; i++) {
    const P = D.phases[i];
    if ((e.phase || 0) > i || e.hp > e.max * P.at || e.dead) continue;
    e.phase = i + 1;
    P.fn(e);
    fx({ k: 'phase', e: e.uid, t: P.n, sub: P.sub });
    log(`${e.n}: ${P.n}. ${P.sub}`, 'foe');
    if (!e.dead && B.phase === 'player') chooseIntent(e); // it changes its plan straight away
  }
}
function bossOp(e, op) {
  const P = B.P;
  switch (op[0]) {
    case 'stripblock': if (P.block) { fx({ k: 'num', p: 1, t: `Block wiped (${P.block})`, col: '#9fd2ff' }); log(`${e.n} wipes away your ${P.block} Block.`, 'bad'); } P.block = 0; break;
    case 'cleanse': for (const k of ['weak', 'vuln', 'psn', 'burn', 'stun']) delete e.st[k]; fx({ k: 'say', e: e.uid, t: 'Clean sheet' }); break;
    case 'dispel': { const pool = ['ritual', 'plate', 'barricade', 'haunt', 'kindle', 'nightgame', 'trollblood', 'spin', 'tempest', 'necro', 'basilisk', 'coldsnap', 'pads', 'helmet', 'shoulder', 'luckybat', 'sweat', 'ward', 'thorns'].filter(k => sv(P, k) > 0); const gone = shuffle(pool).slice(0, op[1]); for (const k of gone) delete P.st[k]; if (gone.length) { log(`Unmade: ${gone.map(k => ST[k].n).join(', ')}.`, 'bad'); fx({ k: 'num', p: 1, t: `Unmade: ${gone.map(k => ST[k].n).join(', ')}`, col: '#b494ff' }); } break; }
    case 'charge': addSt(e, 'charge', 1); break;
    case 'land': delete e.st.air; delete e.st.charge; break;
    case 'sacrifice': { const v = alive().filter(o => o !== e); if (!v.length) break; const o = pick(v); hurtEnemy(o, o.hp + o.block, { raw: true, noScore: 1 }); e.hp = Math.min(e.max, e.hp + op[1]); addSt(e, 'str', op[2]); fx({ k: 'num', e: e.uid, t: '+' + op[1], col: '#6fe08a' }); log(`${e.n} eats ${o.n}. Heals ${op[1]}, gains ${op[2]} Strength.`, 'foe'); break; }
    case 'stealbest': { const pile = B.draw.length ? B.draw : B.discard; if (!pile.length) break; let j = 0; pile.forEach((c, k) => { if (cardValue(c) > cardValue(pile[j])) j = k; }); const c = pile.splice(j, 1)[0]; (e.pocket = e.pocket || []).push(c); fx({ k: 'say', e: e.uid, t: `Stole ${def(c).n}` }); log(`${e.n} steals ${def(c).n} from your deck. Beat it to get it back.`, 'bad'); break; }
    case 'mirrorstr': { const n = Math.max(0, sv(P, 'str')); if (n > sv(e, 'str')) e.st.str = n; fx({ k: 'say', e: e.uid, t: `Copies your Strength (${n})` }); break; }
  }
}
