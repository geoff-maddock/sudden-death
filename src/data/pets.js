/* The pets (issue #104): small monsters from the D&D 5e SRD (5.1, CC-BY-4.0) or common myth, with a little whimsy. The
   rules are engine/pets.js. Each pet: n (its name), from (what it is), el (its element), rar (c common, u uncommon, r
   rare), how (where you get one: 'shop', 'keeper', 'egg'), trait { d, on, mod, atk }, powers [{ at (the bond it opens
   at), d, on, mod, atk }], trick { n, d, tgt, ops(pet) } (card ops, resolved like a tonic's). A d is words, or a
   function of the pet (its numbers at its bond). Handlers: on: { event: fn(arg, pet) | { when, then } } (see
   engine/pets.js), mod: { name: fn(arg, pet) }, atk: fn(card, enemy, pet) (more damage on a hit).
   Words: a pet is of a kind, never a species. */
const pv = (n, p) => petPow(n, p);
const petBelow = f => RUN.hp < RUN.maxhp * f;
const PETS = {
  blinkpup: { n: 'Blinkpup', from: 'blink dog', el: 'aether', rar: 'c', how: 'shop',
    trait: { d: p => `Starts each fight with ${pv(1, p)} Footwork.`, on: { fightStart: (a, p) => addSt(B.P, 'dex', pv(1, p)) } },
    powers: [
      { at: 1, d: p => `The first attack aimed at you each turn: it blinks you aside, ${pv(4, p)} Block.`, on: { playerAttacked: { when: (e, p) => !p.t.blink, then: (e, p) => { p.t.blink = 1; B.P.block += pv(4, p); petSay(`blinks you aside: +${pv(4, p)} Block.`); } } } },
      { at: 2, d: 'Your third card in a turn: draw 1.', on: { cardPlayed: { when: () => B.cardsThisTurn === 3, then: () => { B.pendingDraw = (B.pendingDraw || 0) + 1; petSay('fetches you a card.'); } } } },
    ],
    trick: { n: 'Blink Shuffle', tgt: 'self', d: 'Your hand blinks away, and as many new cards blink in.', ops: () => [['audible']] } },
  pseudodragon: { n: 'Pocket Pseudodragon', from: 'pseudodragon', el: 'aether', rar: 'u', how: 'egg',
    trait: { d: p => `Starts each fight with ${pv(1, p)} Regen.`, on: { fightStart: (a, p) => addSt(B.P, 'regen', pv(1, p)) } },
    powers: [
      { at: 1, d: p => `Once a fight, at the start of a turn below half HP: ${pv(3, p)} Regen.`, on: { turnStart: { when: (a, p) => petBelow(.5) && !p.f.warm, then: (a, p) => { p.f.warm = 1; addSt(B.P, 'regen', pv(3, p)); petSay(`curls round you, warm: ${pv(3, p)} Regen.`); } } } },
      { at: 2, d: p => `When an enemy falls: heal ${pv(2, p)}.`, on: { enemyFalls: (e, p) => healP(pv(2, p)) } },
    ],
    trick: { n: 'Sting', d: p => `${pv(6, p)} damage and Weak ${pv(2, p)} to one enemy.`, ops: p => [['d', pv(6, p)], ['s', 'weak', pv(2, p)]] } },
  axebeak: { n: 'Axebeak Chick', from: 'axe beak', el: 'aether', rar: 'c', how: 'shop',
    // (its first hit only: counted on a real hit in a card, which sets the flag, and in the breakdown (WHY), which explains
    // a card's first hit; a card face or a forecast leaves it out, rather than count it on every hit)
    trait: { d: p => `Your first attack each fight deals ${pv(3, p)} more (its first hit).`, atk: (card, e, p) => { if (p.f.peck1 || !card || def(card).type !== 'atk') return 0; if (WHY) return pv(3, p); if (!B.inCard) return 0; p.f.peck1 = 1; return pv(3, p); } },
    powers: [
      { at: 1, d: p => `The first attack each turn: it pecks another enemy for ${pv(3, p)}.`, on: { attackPlayed: { when: (c, p) => !p.t.peck && alive().length > 0, then: (c, p) => { p.t.peck = 1; const others = alive().filter(e => e.uid !== B.lastTgt), t = pick(others.length ? others : alive()); if (t) { hurtEnemy(t, pv(3, p), { raw: true, src: 'Peck' }); petSay(`pecks ${t.n} for ${pv(3, p)}.`); } } } } },
      { at: 2, d: p => `Once a fight, your second attack in a turn: ${pv(1, p)} Strength.`, on: { attackPlayed: { when: (c, p) => B.atkCount === 2 && !p.f.str, then: (c, p) => { p.f.str = 1; addSt(B.P, 'str', pv(1, p)); petSay(`squawks you on: +${pv(1, p)} Strength.`); } } } },
    ],
    trick: { n: 'Charge', d: p => `${pv(10, p)} damage to one enemy.`, ops: p => [['d', pv(10, p)]] } },
  hootling: { n: 'Hootling', from: 'owlbear cub', el: 'bloom', rar: 'u', how: 'keeper',
    trait: { d: p => `Starts each fight with ${pv(1, p)} Strength.`, on: { fightStart: (a, p) => addSt(B.P, 'str', pv(1, p)) } },
    powers: [
      { at: 1, d: p => `Your third attack in a turn: ${pv(1, p)} Strength.`, on: { attackPlayed: { when: () => B.atkCount === 3, then: (c, p) => { addSt(B.P, 'str', pv(1, p)); petSay(`hoots: +${pv(1, p)} Strength.`); } } } },
      { at: 2, d: p => `Below half HP, your attacks deal ${pv(2, p)} more.`, atk: (card, e, p) => card && def(card).type === 'atk' && petBelow(.5) ? pv(2, p) : 0 },
    ],
    trick: { n: 'Bear Hug', d: p => `${pv(14, p)} damage to one enemy. It hugs too hard.`, ops: p => [['d', pv(14, p)]] } },
  sprite: { n: 'Sprite in a Jar', from: 'sprite', el: 'bloom', rar: 'u', how: 'egg',
    trait: { d: p => `Draw ${pv(1, p)} more card on the first turn.`, mod: { draw: (a, p) => B && B.turn === 1 ? pv(1, p) : 0 } },
    powers: [
      { at: 1, d: p => `Your fourth card in a turn: ${pv(1, p)} more Stamina next turn.`, on: { cardPlayed: { when: (c, p) => B.cardsThisTurn === 4 && !p.t.four, then: (c, p) => { p.t.four = 1; addSt(B.P, 'nrgnext', pv(1, p)); petSay(`keeps count: +${pv(1, p)} Stamina next turn.`); } } } },
      { at: 2, d: p => `A debuff lands on you: ${pv(3, p)} Block.`, on: { playerDebuff: (a, p) => { B.P.block += pv(3, p); petSay(`argues the call: +${pv(3, p)} Block.`); } } },
    ],
    trick: { n: 'Recount', tgt: 'self', d: p => `Draw ${pv(2, p)}.`, ops: p => [['draw', pv(2, p)]] } },
  bogfrog: { n: 'Bog Frog', from: 'giant frog', el: 'bloom', rar: 'c', how: 'egg',
    trait: { d: p => `Starts each fight with ${pv(5, p)} Block.`, on: { fightStart: (a, p) => { B.P.block += pv(5, p); } } },
    powers: [
      { at: 1, d: p => `The first time each turn an enemy gains Block: its tongue takes ${pv(3, p)} of it, for you.`, on: { enemyBlock: { when: (a, p) => !p.t.tongue && a.e && a.e.block > 0, then: (a, p) => { p.t.tongue = 1; const n = Math.min(a.e.block, pv(3, p)); a.e.block -= n; B.P.block += n; petSay(`snaps ${n} Block off ${a.e.n}.`); } } } },
      { at: 2, d: 'When an enemy falls: draw 1 (on their turn, one more next turn).', on: { enemyFalls: () => { if (B.phase === 'player' && !B.ending) drawCards(1); else addSt(B.P, 'drawnext', 1); } } },
    ],
    trick: { n: 'Gulp', d: p => `Swallows an enemy (not a boss) with ${pv(12, p)} HP or less; any other takes 16 damage.`, ops: p => [['devour', pv(12, p), 0]] } },
  chestnut: { n: 'Chestnut', from: 'mimic', el: 'tide', rar: 'u', how: 'shop',
    trait: { d: p => `After a fight you win: ${pv(6, p)} gold (it was holding it).`, on: { fightWon: (a, p) => { RUN.gold += pv(6, p); } } },
    powers: [
      { at: 1, d: p => `A turn with no attack played: it bites a random enemy for ${pv(5, p)}.`, on: { turnEnd: { when: () => B.tt && !B.tt.atk && alive().length > 0, then: (a, p) => { const t = pick(alive()); hurtEnemy(t, pv(5, p), { raw: true, src: 'Chestnut' }); petSay(`bites ${t.n} for ${pv(5, p)}.`); } } } },
      { at: 2, d: p => `When an enemy falls: ${pv(3, p)} gold.`, on: { enemyFalls: (e, p) => { RUN.gold += pv(3, p); } } },
    ],
    trick: { n: 'Lid Snap', d: p => `${pv(12, p)} damage to one enemy.`, ops: p => [['d', pv(12, p)]] } },
  jellycube: { n: 'Jellycube', from: 'gelatinous cube', el: 'tide', rar: 'u', how: 'shop',
    trait: { d: 'The first debuff on you each fight sticks to it instead.', on: { playerDebuff: { when: (a, p) => !p.f.sticky, then: (a, p) => { p.f.sticky = 1; petSay(`swallows the ${(ST[a.k] || {}).n || a.k}.`); return true; } } } },
    powers: [
      // (one more than it says: Weak goes down at the end of the attacker's own turn, so the said amount reaches its next attack)
      { at: 1, d: p => `The first enemy to attack you each turn: Weak ${pv(1, p) + 1}, enough to last through its next attack.`, on: { playerAttacked: { when: (e, p) => !p.t.wob && e && !e.dead, then: (e, p) => { p.t.wob = 1; addSt(e, 'weak', pv(1, p) + 1); petSay(`wobbles at ${e.n}: Weak ${pv(1, p) + 1}.`); } } } },
      { at: 2, d: p => `End your turn with no cards in hand: ${pv(4, p)} Block.`, on: { turnEnd: { when: () => !B.hand.length, then: (a, p) => { gainBlock(pv(4, p), true); } } } },
    ],
    trick: { n: 'Engulf', d: p => `Weak ${pv(2, p)} and Exposed ${pv(2, p)} to one enemy.`, ops: p => [['s', 'weak', pv(2, p)], ['s', 'vuln', pv(2, p)]] } },
  hippogriff: { n: 'Hatchling Hippogriff', from: 'hippogriff', el: 'tide', rar: 'u', how: 'egg',
    trait: { d: p => `${pv(1, p)} more Stamina on the first turn.`, mod: { energy: (a, p) => B && B.turn === 1 ? pv(1, p) : 0 } },
    powers: [
      { at: 1, d: p => `From the fourth turn on, each turn: ${pv(3, p)} Block.`, on: { turnStart: { when: () => B.turn >= 4, then: (a, p) => { gainBlock(pv(3, p), true); } } } },
      { at: 2, d: p => `Your first attack each turn deals ${pv(3, p)} more to the enemy with the most HP.`, atk: (card, e, p) => card && e && def(card).type === 'atk' && !B.firstAtk && alive().every(o => o.hp <= e.hp) ? pv(3, p) : 0 },
    ],
    trick: { n: 'Swoop', d: p => `${pv(5, p)} damage, twice, to one enemy.`, ops: p => [['d', pv(5, p), 2]] } },
  glowbeetle: { n: 'Glowbeetle', from: 'giant fire beetle', el: 'ember', rar: 'c', how: 'shop',
    trait: { d: p => `A lantern: draw ${pv(2, p)} more on the first turn.`, mod: { draw: (a, p) => B && B.turn === 1 ? pv(2, p) : 0 } },
    powers: [
      { at: 1, d: p => `At the start of each turn: Burn ${pv(1, p)} on a random enemy.`, on: { turnStart: { when: () => alive().length > 0, then: (a, p) => { addSt(pick(alive()), 'burn', pv(1, p)); } } } },
      { at: 2, d: p => `Your first Power each turn: ${pv(1, p)} Stamina.`, on: { cardPlayed: { when: (c, p) => def(c).type === 'pow' && !p.t.pow, then: (c, p) => { p.t.pow = 1; B.energy += pv(1, p); petSay(`glows brighter: +${pv(1, p)} Stamina.`); } } } },
    ],
    trick: { n: 'Flare', tgt: 'all', d: p => `Burn ${pv(4, p)} on every enemy.`, ops: p => [['s', 'burn', pv(4, p), 'all']] } },
  rustnibbler: { n: 'Rustnibbler', from: 'rust monster', el: 'ember', rar: 'u', how: 'shop',
    trait: { d: 'The first enemy to gain Block each fight loses all of it.', on: { enemyBlock: { when: (a, p) => !p.f.rust && a.e && a.e.block > 0, then: (a, p) => { p.f.rust = 1; const n = a.e.block; a.e.block = 0; petSay(`eats all ${n} of ${a.e.n}'s Block.`); } } } },
    powers: [
      { at: 1, d: p => `Whenever an enemy gains Block: it nibbles ${pv(2, p)} of it.`, on: { enemyBlock: { when: a => a.e && a.e.block > 0, then: (a, p) => { a.e.block = Math.max(0, a.e.block - pv(2, p)); } } } },
      { at: 2, d: p => `Your first attack each turn on an enemy with no Block deals ${pv(3, p)} more.`, atk: (card, e, p) => card && e && def(card).type === 'atk' && !B.firstAtk && !e.block ? pv(3, p) : 0 },
    ],
    trick: { n: 'Rust', tgt: 'all', d: 'Every enemy loses its Block and its Strength.', ops: () => [['strip']] } },
  imp: { n: 'Imp-in-Waiting', from: 'imp', el: 'ember', rar: 'u', how: 'egg',
    trait: { d: p => `${pv(1, p)} Spikes all fight.`, on: { fightStart: (a, p) => addSt(B.P, 'thorns', pv(1, p)) } },
    powers: [
      { at: 1, d: p => `Hit for 6 or more: the attacker takes ${pv(3, p)}.`, on: { playerHit: { when: a => a.e && !a.e.dead && a.taken >= 6, then: (a, p) => { hurtEnemy(a.e, pv(3, p), { raw: true, src: 'Imp' }); petSay(`curses ${a.e.n}: ${pv(3, p)} damage.`); } } } },
      { at: 2, d: p => `When an enemy falls: Burn ${pv(2, p)} on another.`, on: { enemyFalls: { when: () => alive().length > 0, then: (e, p) => { addSt(pick(alive()), 'burn', pv(2, p)); } } } },
    ],
    trick: { n: 'Curse', d: p => `Plague ${pv(5, p)} on one enemy.`, ops: p => [['s', 'psn', pv(5, p)]] } },
  frostpup: { n: 'Frostpup', from: 'winter wolf cub', el: 'rime', rar: 'u', how: 'keeper',
    trait: { d: p => `At the start of each fight, the enemy with the most HP is Weak ${pv(1, p)}.`, on: { fightStart: (a, p) => { const t = alive().slice().sort((x, y) => y.hp - x.hp)[0]; if (t) addSt(t, 'weak', pv(1, p)); } } },
    powers: [
      { at: 1, d: 'Every third turn, its breath Stuns a random enemy (a boss is Weak 2 instead).', on: { turnStart: { when: () => B.turn % 3 === 0 && alive().length > 0, then: () => { const t = pick(alive()); resolve([['s', 'stun', 1]], { card: null, tgt: t, d: { tgt: 'one', n: 'Snow Breath', type: 'pet' } }); petSay(`breathes snow on ${t.n}.`); } } } },
      { at: 2, d: p => `Below half HP, each turn: ${pv(4, p)} Block.`, on: { turnStart: { when: () => petBelow(.5), then: (a, p) => { gainBlock(pv(4, p), true); } } } },
    ],
    trick: { n: 'Snow Breath', d: 'Stuns one enemy (a boss is Weak 2 instead).', ops: () => [['s', 'stun', 1]] } },
  mephitling: { n: 'Mephitling', from: 'ice mephit', el: 'rime', rar: 'c', how: 'egg',
    trait: { d: p => `Once a fight, hit for 10 or more: it sulks you up to ${pv(2, p)} Strength.`, on: { playerHit: { when: (a, p) => a.taken >= 10 && !p.f.sulk, then: (a, p) => { p.f.sulk = 1; addSt(B.P, 'str', pv(2, p)); petSay(`sulks beautifully: +${pv(2, p)} Strength.`); } } } },
    powers: [
      { at: 1, d: p => `End your turn: ${pv(2, p)} Block for each card left in hand (at most ${pv(6, p)}).`, on: { turnEnd: { when: () => B.hand.length > 0, then: (a, p) => { gainBlock(Math.min(pv(6, p), B.hand.length * pv(2, p)), true); } } } },
      { at: 2, d: p => `When an enemy falls: every enemy is Weak ${pv(1, p)}.`, on: { enemyFalls: { when: () => alive().length > 0, then: (e, p) => { for (const o of alive()) addSt(o, 'weak', pv(1, p)); } } } },
    ],
    trick: { n: 'Frost Puff', tgt: 'all', d: p => `Every enemy is Weak ${pv(2, p)}, and you gain ${pv(6, p)} Block.`, ops: p => [['s', 'weak', pv(2, p), 'all'], ['b', pv(6, p)]] } },
  cockatrice: { n: 'Cockatrice Chick', from: 'cockatrice', el: 'rime', rar: 'r', how: 'egg',
    trait: { d: p => `At the start of each fight, a random enemy is Weak ${pv(2, p)}.`, on: { fightStart: (a, p) => { const t = pick(alive()); if (t) addSt(t, 'weak', pv(2, p)); } } },
    powers: [
      { at: 1, d: p => `Your first attack each turn on an enemy still standing leaves it Exposed ${pv(1, p)}.`, on: { attackPlayed: { when: (c, p) => !p.t.stare && alive().some(e => e.uid === B.lastTgt), then: (c, p) => { p.t.stare = 1; addSt(alive().find(e => e.uid === B.lastTgt), 'vuln', pv(1, p)); } } } },
      { at: 2, d: 'Once a fight, at the end of your turn, an enemy (not a boss) at a quarter of its HP or less turns to stone.', on: { turnEnd: { when: (a, p) => !p.f.stone && alive().some(e => !isBoss(e) && e.hp <= e.max * .25), then: (a, p) => { p.f.stone = 1; const t = alive().find(e => !isBoss(e) && e.hp <= e.max * .25); petSay(`stares ${t.n} to stone.`); hurtEnemy(t, t.hp + t.block, { raw: true, src: 'Stare' }); } } } },
    ],
    trick: { n: 'Petrifying Glare', d: 'An enemy (not a boss) at 30% of its HP or less turns to stone; any other takes 18 damage.', ops: () => [['petrify', .3]] } },
};
