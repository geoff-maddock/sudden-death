/* The pets (issue #104): small monsters from the D&D 5e SRD (5.1, CC-BY-4.0) or common myth, with a little whimsy. The
   rules are engine/pets.js. Each pet: n (its name), from (what it is), el (its element), rar (c common, u uncommon, r
   rare), how (where you get one: 'shop', 'keeper', 'egg'), trait { d, on, mod, atk }, powers [{ at (the bond it opens
   at), d, on, mod, atk }], trick { n, d, tgt, ops(pet) } (card ops, resolved like a tonic's). A d is words, or a
   function of the pet (its numbers at its bond). Handlers: on: { event: fn(arg, pet) | { when, then } } (see
   engine/pets.js), mod: { name: fn(arg, pet) }, atk: fn(card, enemy, pet) (more damage on a hit). A pet that takes an
   enemy's Block takes only what it just gained (enemyBlock's n), less what the pet has taken of it already (a.ate).
   Words: a pet is of a kind, never a species. */
const pv = (n, p) => petPow(n, p);
const petBelow = f => RUN.hp < RUN.maxhp * f;
const PETS = {
  blinkpup: { n: 'Blinkpup', from: 'blink dog', el: 'aether', rar: 'c', how: 'shop', sports: ['soccer', 'basketball'],
    trait: { d: p => `Starts each fight with ${pv(1, p)} Footwork.`, on: { fightStart: (a, p) => addSt(B.P, 'dex', pv(1, p)) } },
    powers: [
      { at: 1, d: p => `The first attack aimed at you each turn: it blinks you aside, ${pv(2, p)} Block.`, on: { playerAttacked: { when: (e, p) => !p.t.blink, spend: (a, p) => { p.t.blink = 1; }, then: (e, p) => { B.P.block += pv(2, p); petSay(`blinks you aside: +${pv(2, p)} Block.`); } } } },
      { at: 2, d: 'Your third card in a turn: draw 1 (twice a fight).', on: { cardPlayed: { when: (c, p) => B.cardsThisTurn === 3 && (p.f.fetch || 0) < 2, then: (c, p) => { p.f.fetch = (p.f.fetch || 0) + 1; B.pendingDraw = (B.pendingDraw || 0) + 1; petSay('fetches you a card.'); } } } },
    ],
    trick: { n: 'Blink Shuffle', tgt: 'self', d: 'Your hand blinks away, and as many new cards blink in.', ops: () => [['audible']] } },
  pseudodragon: { n: 'Pocket Pseudodragon', from: 'pseudodragon', el: 'aether', rar: 'u', how: 'egg', sports: ['jousting'], moon: [2],
    trait: { d: p => `Starts each fight with ${pv(1, p)} Regen.`, on: { fightStart: (a, p) => addSt(B.P, 'regen', pv(1, p)) } },
    powers: [
      { at: 1, d: p => `Once a fight, at the start of a turn below half HP: ${pv(3, p)} Regen.`, on: { turnStart: { when: (a, p) => petBelow(.5) && !p.f.warm, then: (a, p) => { p.f.warm = 1; addSt(B.P, 'regen', pv(3, p)); petSay(`curls round you, warm: ${pv(3, p)} Regen.`); } } } },
      { at: 2, d: p => `When an enemy falls: heal ${pv(2, p)}.`, on: { enemyFalls: (e, p) => healP(pv(2, p)) } },
    ],
    trick: { n: 'Sting', d: p => `${pv(6, p)} damage and Weak ${pv(2, p)} to one enemy.`, ops: p => [['d', pv(6, p)], ['s', 'weak', pv(2, p)]] } },
  axebeak: { n: 'Axebeak Chick', from: 'axe beak', el: 'aether', rar: 'c', how: 'shop', sports: ['football'],
    // (every hit of the first attack card: spent once that card has resolved, so a forecast and the hits agree)
    trait: { d: p => `Your first attack card each fight: each of its hits deals ${pv(3, p)} more.`, atk: (card, e, p) => !p.f.peck1 && card && def(card).type === 'atk' ? pv(3, p) : 0, on: { attackPlayed: (c, p) => { p.f.peck1 = 1; } } },
    powers: [
      { at: 1, d: p => `The first attack each turn: it pecks another enemy for ${pv(3, p)}.`, on: { attackPlayed: { when: (c, p) => !p.t.peck && alive().length > 0, spend: (a, p) => { p.t.peck = 1; }, then: (c, p) => { const others = alive().filter(e => e.uid !== B.lastTgt), t = pick(others.length ? others : alive()); if (t) { hurtEnemy(t, pv(3, p), { raw: true, src: 'Peck' }); petSay(`pecks ${t.n} for ${pv(3, p)}.`); } } } } },
      { at: 1, d: p => `In football, your first touchdown each fight: ${pv(1, p)} Strength.`, on: { score: { when: (a, p) => B.sport === 'football' && a && a.side === 0 && a.what === 'touchdown' && !p.f.td, then: (a, p) => { p.f.td = 1; addSt(B.P, 'str', pv(1, p)); petSay(`struts after the touchdown: +${pv(1, p)} Strength.`); } } } },
      { at: 2, d: p => `Once a fight, your second attack in a turn: ${pv(1, p)} Strength.`, on: { attackPlayed: { when: (c, p) => B.atkCount === 2 && !p.f.str, then: (c, p) => { p.f.str = 1; addSt(B.P, 'str', pv(1, p)); petSay(`squawks you on: +${pv(1, p)} Strength.`); } } } },
    ],
    trick: { n: 'Charge', d: p => `${pv(10, p)} damage to one enemy.`, ops: p => [['d', pv(10, p)]] } },
  hootling: { n: 'Hootling', from: 'owlbear cub', el: 'bloom', rar: 'u', how: 'keeper', sports: ['golf'], moon: [4],
    trait: { d: p => `The first enemy hit that leaves you below half HP each fight: ${pv(2, p)} Strength.`, on: { playerHit: { when: (a, p) => !p.f.roar && a && a.taken > 0 && RUN.hp > 0 && petBelow(.5), then: (a, p) => { p.f.roar = 1; addSt(B.P, 'str', pv(2, p)); petSay(`roars: +${pv(2, p)} Strength.`); } } } },
    powers: [
      { at: 1, d: p => `Once a fight, your third attack in a turn: ${pv(1, p)} Strength.`, on: { attackPlayed: { when: (c, p) => B.atkCount === 3 && !p.f.hoot, then: (c, p) => { p.f.hoot = 1; addSt(B.P, 'str', pv(1, p)); petSay(`hoots: +${pv(1, p)} Strength.`); } } } },
      { at: 2, d: p => `Below half HP, your attacks deal ${pv(2, p)} more.`, atk: (card, e, p) => card && def(card).type === 'atk' && petBelow(.5) ? pv(2, p) : 0 },
    ],
    trick: { n: 'Bear Hug', d: p => `${pv(14, p)} damage to one enemy. It hugs too hard.`, ops: p => [['d', pv(14, p)]] } },
  sprite: { n: 'Sprite in a Jar', from: 'sprite', el: 'bloom', rar: 'u', how: 'egg', sports: ['golf', 'bowling'],
    trait: { d: p => `Draw ${pv(1, p)} more card on the first turn.`, mod: { draw: (a, p) => B && B.turn === 1 ? pv(1, p) : 0 } },
    powers: [
      { at: 1, d: p => `Your fourth card in a turn: ${pv(1, p)} more Stamina next turn (twice a fight).`, on: { cardPlayed: { when: (c, p) => B.cardsThisTurn === 4 && !p.t.four && (p.f.four || 0) < 2, spend: (a, p) => { p.t.four = 1; }, then: (c, p) => { p.f.four = (p.f.four || 0) + 1; addSt(B.P, 'nrgnext', pv(1, p)); petSay(`keeps count: +${pv(1, p)} Stamina next turn.`); } } } },
      { at: 2, d: p => `A debuff lands on you: ${pv(3, p)} Block.`, on: { playerDebuff: (a, p) => { B.P.block += pv(3, p); petSay(`argues the call: +${pv(3, p)} Block.`); } } },
    ],
    trick: { n: 'Recount', tgt: 'self', d: p => `Draw ${pv(2, p)}.`, ops: p => [['draw', pv(2, p)]] } },
  bogfrog: { n: 'Bog Frog', from: 'giant frog', el: 'bloom', rar: 'c', how: 'egg', sports: ['golf'],
    trait: { d: p => `Starts each fight with ${pv(5, p)} Block.`, on: { fightStart: (a, p) => { B.P.block += pv(5, p); } } },
    powers: [
      { at: 1, d: p => `The first time each turn an enemy gains Block: its tongue takes ${pv(3, p)} of it, for you.`, on: { enemyBlock: { when: (a, p) => !p.t.tongue && a.e && a.e.block > 0 && a.n - (a.ate || 0) > 0, spend: (a, p) => { p.t.tongue = 1; }, then: (a, p) => { const n = Math.max(0, Math.min(a.e.block, a.n - (a.ate || 0), pv(3, p))); a.e.block -= n; a.ate = (a.ate || 0) + n; B.P.block += n; petSay(`snaps ${n} Block off ${a.e.n}.`); } } } },
      { at: 2, d: 'When an enemy falls: draw 1 (on their turn, one more next turn), twice a fight.', on: { enemyFalls: (e, p) => { if ((p.f.tongue || 0) >= 2) return; p.f.tongue = (p.f.tongue || 0) + 1; if (B.phase === 'player' && !B.ending) drawCards(1); else addSt(B.P, 'drawnext', 1); } } },
    ],
    trick: { n: 'Gulp', d: p => `Swallows an enemy (not a boss) with ${pv(12, p)} HP or less; any other takes 16 damage.`, ops: p => [['devour', pv(12, p), 0]] } },
  chestnut: { n: 'Chestnut', from: 'mimic', el: 'tide', rar: 'u', how: 'shop', sports: ['bowling'],
    trait: { d: p => `After a fight you win: ${pv(6, p)} gold (it was holding it).`, on: { fightWon: (a, p) => { RUN.gold += pv(6, p); } } },
    powers: [
      { at: 1, d: p => `A turn with no attack played: it bites a random enemy for ${pv(5, p)}.`, on: { turnEnd: { when: () => B.tt && !B.tt.atk && alive().length > 0, then: (a, p) => { const t = pick(alive()); hurtEnemy(t, pv(5, p), { raw: true, src: 'Chestnut' }); petSay(`bites ${t.n} for ${pv(5, p)}.`); } } } },
      { at: 2, d: p => `When an enemy falls: ${pv(3, p)} gold.`, on: { enemyFalls: (e, p) => { RUN.gold += pv(3, p); } } },
    ],
    trick: { n: 'Lid Snap', d: p => `${pv(12, p)} damage to one enemy.`, ops: p => [['d', pv(12, p)]] } },
  jellycube: { n: 'Jellycube', from: 'gelatinous cube', el: 'tide', rar: 'u', how: 'shop', sports: ['curling'],
    trait: { d: 'The first debuff on you each fight sticks to it instead.', on: { playerDebuff: { when: (a, p) => !p.f.sticky, then: (a, p) => { p.f.sticky = 1; petSay(`swallows the ${(ST[a.k] || {}).n || a.k}.`); return true; } } } },
    powers: [
      // (one more than its base: Weak goes down at the end of the attacker's own turn, so this much reaches its next attack)
      { at: 1, d: p => `Every second turn, the first enemy to attack you: Weak ${pv(1, p) + 1}, enough to last through its next attack.`, on: { playerAttacked: { when: (e, p) => !p.t.wob && B.turn % 2 === 1 && e && !e.dead, spend: (a, p) => { p.t.wob = 1; }, then: (e, p) => { addSt(e, 'weak', pv(1, p) + 1); petSay(`wobbles at ${e.n}: Weak ${pv(1, p) + 1}.`); } } } },
      { at: 2, d: p => `End your turn with no cards in hand: ${pv(4, p)} Block.`, on: { turnEnd: { when: () => !B.hand.length, then: (a, p) => { gainBlock(pv(4, p), true); } } } },
    ],
    trick: { n: 'Engulf', d: p => `Weak ${pv(2, p)} and Exposed ${pv(2, p)} to one enemy.`, ops: p => [['s', 'weak', pv(2, p)], ['s', 'vuln', pv(2, p)]] } },
  hippogriff: { n: 'Hatchling Hippogriff', from: 'hippogriff', el: 'tide', rar: 'u', how: 'egg', sports: ['jousting', 'soccer'],
    trait: { d: p => `${pv(1, p)} more Stamina on the first turn.`, mod: { energy: (a, p) => B && B.turn === 1 ? pv(1, p) : 0 } },
    powers: [
      { at: 1, d: p => `From the fourth turn on, each turn: ${pv(2, p)} Block.`, on: { turnStart: { when: () => B.turn >= 4, then: (a, p) => { gainBlock(pv(2, p), true); } } } },
      { at: 2, d: p => `Your first attack each turn deals ${pv(3, p)} more to the enemy with the most HP.`, atk: (card, e, p) => card && e && def(card).type === 'atk' && !B.firstAtk && alive().every(o => o.hp <= e.hp) ? pv(3, p) : 0 },
    ],
    trick: { n: 'Swoop', d: p => `${pv(5, p)} damage, twice, to one enemy.`, ops: p => [['d', pv(5, p), 2]] } },
  glowbeetle: { n: 'Glowbeetle', from: 'giant fire beetle', el: 'ember', rar: 'c', how: 'shop', sports: ['boxing'],
    trait: { d: p => `A lantern: draw ${pv(2, p)} more on the first turn.`, mod: { draw: (a, p) => B && B.turn === 1 ? pv(2, p) : 0 } },
    powers: [
      { at: 1, d: p => `At the start of each turn: Burn ${pv(1, p)} on a random enemy.`, on: { turnStart: { when: () => alive().length > 0, then: (a, p) => { addSt(pick(alive()), 'burn', pv(1, p)); } } } },
      { at: 2, d: p => `Your first Power each turn: ${pv(1, p)} Stamina.`, on: { cardPlayed: { when: (c, p) => def(c).type === 'pow' && !p.t.pow, spend: (a, p) => { p.t.pow = 1; }, then: (c, p) => { B.energy += pv(1, p); petSay(`glows brighter: +${pv(1, p)} Stamina.`); } } } },
    ],
    trick: { n: 'Flare', tgt: 'all', d: p => `Burn ${pv(4, p)} on every enemy.`, ops: p => [['s', 'burn', pv(4, p), 'all']] } },
  rustnibbler: { n: 'Rustnibbler', from: 'rust monster', el: 'ember', rar: 'u', how: 'shop', sports: ['boxing', 'football'],
    trait: { d: 'The first enemy to gain Block each fight loses what it gained.', on: { enemyBlock: { when: (a, p) => !p.f.rust && a.e && a.e.block > 0, then: (a, p) => { p.f.rust = 1; const n = Math.min(a.e.block, a.n); a.e.block -= n; a.ate = (a.ate || 0) + n; petSay(`eats the ${n} Block ${a.e.n} just raised.`); } } } },
    powers: [
      { at: 1, d: p => `Whenever an enemy gains Block: it nibbles ${pv(2, p)} of what it gained.`, on: { enemyBlock: { when: a => a.e && a.e.block > 0 && a.n - (a.ate || 0) > 0, then: (a, p) => { const n = Math.min(a.e.block, a.n - (a.ate || 0), pv(2, p)); if (n > 0) { a.e.block -= n; a.ate = (a.ate || 0) + n; } } } } },
      { at: 2, d: p => `Your first attack each turn on an enemy with no Block deals ${pv(3, p)} more.`, atk: (card, e, p) => card && e && def(card).type === 'atk' && !B.firstAtk && !e.block ? pv(3, p) : 0 },
    ],
    trick: { n: 'Rust', tgt: 'all', d: 'Every enemy loses its Block.', ops: () => [['unblock']] } },
  imp: { n: 'Imp-in-Waiting', from: 'imp', el: 'ember', rar: 'u', how: 'egg', sports: ['basketball'], moon: [0],
    trait: { d: p => `${pv(1, p)} Spikes all fight.`, on: { fightStart: (a, p) => addSt(B.P, 'thorns', pv(1, p)) } },
    powers: [
      { at: 1, d: p => `Hit for 6 or more: the attacker takes ${pv(3, p)}.`, on: { playerHit: { when: a => a.e && !a.e.dead && a.taken >= 6, then: (a, p) => { hurtEnemy(a.e, pv(3, p), { raw: true, src: 'Imp' }); petSay(`curses ${a.e.n}: ${pv(3, p)} damage.`); } } } },
      { at: 2, d: p => `When an enemy falls: Burn ${pv(2, p)} on another.`, on: { enemyFalls: { when: () => alive().length > 0, then: (e, p) => { addSt(pick(alive()), 'burn', pv(2, p)); } } } },
    ],
    trick: { n: 'Curse', d: p => `Plague ${pv(5, p)} on one enemy.`, ops: p => [['s', 'psn', pv(5, p)]] } },
  frostpup: { n: 'Frostpup', from: 'winter wolf cub', el: 'rime', rar: 'u', how: 'keeper', sports: ['hockey', 'curling'], moon: [4],
    trait: { d: p => `At the start of each fight, the enemy with the most HP is Weak ${pv(1, p)}.`, on: { fightStart: (a, p) => { const t = alive().slice().sort((x, y) => y.hp - x.hp)[0]; if (t) addSt(t, 'weak', pv(1, p)); } } },
    powers: [
      { at: 1, d: 'Every fourth turn, its breath Stuns a random enemy (a boss is Weak 2 instead).', on: { turnStart: { when: () => B.turn % 4 === 0 && alive().length > 0, then: () => { const t = pick(alive()); resolve([['s', 'stun', 1]], { card: null, tgt: t, d: { tgt: 'one', n: 'Snow Breath', type: 'pet' } }); petSay(`breathes snow on ${t.n}.`); } } } },
      { at: 2, d: p => `Below half HP, each turn: ${pv(4, p)} Block.`, on: { turnStart: { when: () => petBelow(.5), then: (a, p) => { gainBlock(pv(4, p), true); } } } },
    ],
    trick: { n: 'Snow Breath', d: 'Stuns one enemy (a boss is Weak 2 instead).', ops: () => [['s', 'stun', 1]] } },
  mephitling: { n: 'Mephitling', from: 'ice mephit', el: 'rime', rar: 'c', how: 'egg', sports: ['hockey'], moon: [7],
    trait: { d: p => `Once a fight, hit for 10 or more: it sulks you up to ${pv(1, p)} Strength.`, on: { playerHit: { when: (a, p) => a.taken >= 10 && !p.f.sulk, then: (a, p) => { p.f.sulk = 1; addSt(B.P, 'str', pv(1, p)); petSay(`sulks beautifully: +${pv(1, p)} Strength.`); } } } },
    powers: [
      { at: 1, d: p => `End your turn: ${pv(1, p)} Block for each card left in hand (at most ${pv(4, p)}).`, on: { turnEnd: { when: () => B.hand.length > 0, then: (a, p) => { gainBlock(Math.min(pv(4, p), B.hand.length * pv(1, p)), true); } } } },
      { at: 2, d: p => `The first enemy to fall each fight: every other enemy is Weak ${pv(1, p)}.`, on: { enemyFalls: { when: (e, p) => alive().length > 0 && !p.f.frost, then: (e, p) => { p.f.frost = 1; for (const o of alive()) addSt(o, 'weak', pv(1, p)); } } } },
    ],
    trick: { n: 'Frost Puff', tgt: 'all', d: p => `Every enemy is Weak ${pv(1, p)}, and you gain ${pv(4, p)} Block.`, ops: p => [['s', 'weak', pv(1, p), 'all'], ['b', pv(4, p)]] } },
  cockatrice: { n: 'Cockatrice Chick', from: 'cockatrice', el: 'rime', rar: 'r', how: 'egg', sports: ['jousting'], moon: [6],
    trait: { d: p => `At the start of each fight, a random enemy is Weak ${pv(2, p)}.`, on: { fightStart: (a, p) => { const t = pick(alive()); if (t) addSt(t, 'weak', pv(2, p)); } } },
    powers: [
      { at: 1, d: p => `Every second turn, your first attack on an enemy still standing leaves it Exposed ${pv(1, p)}.`, on: { attackPlayed: { when: (c, p) => !p.t.stare && B.turn % 2 === 1 && alive().some(e => e.uid === B.lastTgt), spend: (a, p) => { p.t.stare = 1; }, then: (c, p) => { addSt(alive().find(e => e.uid === B.lastTgt), 'vuln', pv(1, p)); } } } },
      { at: 2, d: 'Once a fight, at the end of your turn, an enemy (not a boss) at a quarter of its HP or less turns to stone.', on: { turnEnd: { when: (a, p) => !p.f.stone && alive().some(e => !isBoss(e) && e.hp <= e.max * .25), then: (a, p) => { p.f.stone = 1; const t = alive().find(e => !isBoss(e) && e.hp <= e.max * .25); petSay(`stares ${t.n} to stone.`); hurtEnemy(t, t.hp + t.block, { raw: true, src: 'Stare' }); } } } },
    ],
    trick: { n: 'Petrifying Glare', d: 'An enemy (not a boss) at 30% of its HP or less turns to stone; any other takes 18 damage.', ops: () => [['petrify', .3]] } },
};

/* rivals' special pets (phase 7): one for each rival club, never hatched or bought, across the table in that club's
   matches (the Realm sets RUN.foePet). Each has a trait and a power (on the hooks, from the other side) and a trick the
   CPU uses once a match, when its skill says (foeTrickNow: skill 3 waits for when it hurts, 1 throws it whenever).
   They are stronger than a shop pet. Their Block and debuffs go through blockE and debuffP, so your own pet answers
   them (the Rustnibbler eats the Block, the Jellycube swallows a debuff). */
const foeLead = () => alive().slice().sort((a, b) => (b.st.str || 0) - (a.st.str || 0) || b.hp - a.hp)[0];
const foeHurt = () => alive().slice().sort((a, b) => (b.max - b.hp) - (a.max - a.hp))[0];
// a rival pet's hit: plain damage, not an attack (no gear, Spikes, Seeing Red or score is set off by it, nor your
// pet's answers to an attack), though a big one spooks your pet as any big hit does
const foeHit = n => { const t = hurtPlayer(n, null, { plain: 1 }); petSpook(t); return t; };
// its debuff: Weak and Vulnerable laid as your turn ends (B.foePet.atEnd, set by foePetOn) would lose a turn at once,
// so they get that turn back
const foeDeb = (k, n) => debuffP(k, n + ((k === 'weak' || k === 'vuln') && B.foePet && B.foePet.atEnd ? 1 : 0));
const FOE_PETS = {
  wyvern: { n: 'Wyvern Hatchling', from: 'wyvern', el: 'ember', club: 'ironmaw',
    trait: { d: 'Their strongest player starts with 2 Strength.', on: { fightStart: () => { const e = foeLead(); if (e) addSt(e, 'str', 2); } } },
    power: { d: 'Every third turn, its tail flicks you for 4.', on: { turnEnd: () => { if (B.turn % 3 === 0) { foeSay('a tail flick, for 4.'); foeHit(4); } } } },
    trick: { n: 'Venom Sting', d: '9 damage, and you are Weak 1.', when: () => (B.P.block || 0) <= 3, go: () => { foeHit(9); foeDeb('weak', 1); } } },
  wisp: { n: 'Will-o\'-Wisp', from: 'will-o\'-wisp', el: 'aether', club: 'mirewood',
    trait: { d: 'You start each match Weak 1.', on: { fightStart: () => foeDeb('weak', 1) } },
    power: { d: 'At the end of each of your turns, it mends their most hurt player by 3.', on: { turnEnd: () => { const e = foeHurt(); if (e && e.hp < e.max) { const h = Math.min(3, e.max - e.hp); e.hp += h; foeSay(`mends ${e.n} by ${h}.`); } } } },
    trick: { n: 'Lure', d: 'You are Vulnerable 2, and have 1 less Stamina next turn.', when: () => B.turn >= 2, go: () => { foeDeb('vuln', 2); debuffP('drained', 1); } } },
  shrieker: { n: 'Shrieker Sprout', from: 'shrieker', el: 'bloom', club: 'gallowmere',
    trait: { d: 'Every one of their players starts with 4 Block.', on: { fightStart: () => { for (const e of alive()) blockE(e, 4); } } },
    power: { d: 'The fourth card you play in a turn sets it off: you are Weak 1.', on: { cardPlayed: (c, p) => { if (B.cardsThisTurn === 4 && !p.t.shriek) { p.t.shriek = 1; foeSay('SHRIEKS.'); foeDeb('weak', 1); } } } },
    trick: { n: 'Wail', d: 'You are Weak 2 and Vulnerable 2, and your pet is spooked.', when: () => B.turn <= 2, go: () => { foeDeb('weak', 2); foeDeb('vuln', 2); foeSpook(); } } },
  basilisk: { n: 'Basilisk Hatchling', from: 'basilisk', el: 'rime', club: 'cragspire',
    trait: { d: 'As each of your turns begins, their players gain 2 Block.', on: { turnStart: () => { for (const e of alive()) blockE(e, 2); } } },
    power: { d: 'Its first glare each match: you have 1 less Stamina next turn.', on: { turnEnd: (a, p) => { if (!p.f.glare && B.turn >= 2) { p.f.glare = 1; foeSay('glares.'); debuffP('drained', 1); } } } },
    trick: { n: 'Stony Gaze', d: 'You have 2 less Stamina next turn, and your pet is spooked.', when: () => B.turn >= 3, go: () => { debuffP('drained', 2); foeSpook(); } } },
  remorhaz: { n: 'Remorhaz Grub', from: 'remorhaz', el: 'ember', club: 'frostfang',
    trait: { d: 'Their players have 2 Spikes: hit them and you take 2.', on: { fightStart: () => { for (const e of alive()) addSt(e, 'thorns', 2); } } },
    power: { d: 'Every second turn its back glows: you take 3.', on: { turnEnd: () => { if (B.turn % 2 === 0) { foeSay('glows red-hot: 3.'); foeHit(3); } } } },
    trick: { n: 'Searing Coil', d: '12 damage.', when: () => (B.P.block || 0) <= 4, go: () => { foeHit(12); } } },
  darkmantle: { n: 'Darkmantle', from: 'darkmantle', el: 'tide', club: 'duskhollow',
    trait: { d: 'Their smallest player starts with 6 Block.', on: { fightStart: () => { const e = alive().slice().sort((a, b) => a.max - b.max)[0]; if (e) blockE(e, 6); } } },
    power: { d: 'The first time you end a turn with no Block, it squeezes you for 5.', on: { turnEnd: (a, p) => { if (!p.f.sq && !(B.P.block > 0)) { p.f.sq = 1; foeSay('drops on you: 5.'); foeHit(5); } } } },
    trick: { n: 'Darkness', d: 'You are Weak 2, and your pet is spooked.', when: () => B.turn >= 2, go: () => { foeDeb('weak', 2); foeSpook(); } } },
  claw: { n: 'Hand of Glory', from: 'hand of glory', el: 'rime', club: 'rattlebone',
    trait: { d: 'When one of their players falls, the rest gain 1 Strength.', on: { enemyFalls: (e) => { if (e && e.eaten) return; const rest = alive(); if (rest.length) { for (const x of rest) addSt(x, 'str', 1); foeSay('scuttles to the next one: +1 Strength.'); } } } },
    power: { d: 'Every third turn it grabs your guard: you lose 4 Block.', on: { turnEnd: () => { if (B.turn % 3 === 0 && B.P.block > 0) { const n = Math.min(4, B.P.block); B.P.block -= n; foeSay(`grabs ${n} Block.`); } } } },
    trick: { n: 'Throttle', d: '7 damage, and you have 1 less Stamina next turn.', when: () => (B.P.block || 0) <= 3, go: () => { foeHit(7); debuffP('drained', 1); } } },
  griffon: { n: 'Griffon Chick', from: 'griffon', el: 'aether', club: 'bramblegate',
    trait: { d: 'Their strongest player starts with 2 Strength.', on: { fightStart: () => { const e = foeLead(); if (e) addSt(e, 'str', 2); } } },
    power: { d: 'Every second turn it dives at you for 3.', on: { turnEnd: () => { if (B.turn % 2 === 0) { foeSay('dives: 3.'); foeHit(3); } } } },
    trick: { n: 'Dive', d: '14 damage, and your pet is spooked.', when: () => (B.P.block || 0) <= 5, go: () => { foeHit(14); foeSpook(); } } },
};
