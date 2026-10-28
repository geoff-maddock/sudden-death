/* p2d: hooks. Trophies say what they do and when, right next to their data, instead of being checked
   by name all over the engine. Two kinds:
     on:  { event: fn(arg) }  — things that happen (fightStart, turnStart, turnEnd, turnEndHeal, cardPlayed,
                                 attackPlayed, enemyFalls, lethal, fightWon). A truthy return is passed back
                                 (lethal uses it to cancel the knockout).
     mod: { name: n | fn(arg) } — numbers that add up (energy, draw, d20, atk, rewardGold, goldMult, choices).
   Game systems that are not trophies (the sky) register with onHook(event, fn). */
const SYS_HOOKS = {};
function onHook(ev, fn) { (SYS_HOOKS[ev] = SYS_HOOKS[ev] || []).push(fn); }
function fire(ev, a) {
  let r;
  if (RUN) for (const id of RUN.relics) { const f = RELICS[id] && RELICS[id].on && RELICS[id].on[ev]; if (f) { const v = f(a); if (v) { r = v; if (ev === 'lethal') return r; } } }
  for (const f of SYS_HOOKS[ev] || []) { const v = f(a); if (v) r = v; }
  return r;
}
function mod(name, a) {
  let n = 0;
  if (RUN) for (const id of RUN.relics) { const m = RELICS[id] && RELICS[id].mod && RELICS[id].mod[name]; if (m != null) n += (typeof m === 'function' ? m(a) : m) || 0; }
  return n;
}
const TROPHY_FX = {
  // the eight club trophies
  icepack: { on: { fightWon: () => { RUN.hp = Math.min(RUN.maxhp, RUN.hp + 4); } } },
  lantern: { on: { fightStart: () => { for (const e of alive()) addSt(e, 'psn', 3); } } },
  horn: { on: { fightStart: () => { for (const e of alive()) { addSt(e, 'weak', 2); addSt(e, 'vuln', 1); } } } },
  boots: { on: { fightStart: () => { B.P.block += 10; addSt(B.P, 'dex', 1); } } },
  skates: { on: { cardPlayed: () => { if (B.cardsThisTurn === 1) B.pendingDraw = (B.pendingDraw || 0) + 1; } } },
  chalice: { on: { enemyFalls: () => healP(3) } },
  towel: { on: { cardPlayed: () => { if (B.cardsThisTurn === 4 && !B.towel) { B.towel = 1; B.energy++; B.pendingDraw = (B.pendingDraw || 0) + 1; fx({ k: 'say2', t: 'Rally Towel: +1 Stamina, draw 1' }); } } } },
  sled: { on: { turnStart: () => { if (B.turn % 3 === 0) { addSt(B.P, 'str', 2); fx({ k: 'say2', t: 'Weighted Sled: +2 Strength' }); } } } },
  // everything else
  gauntlets: { on: { fightStart: () => addSt(B.P, 'str', 1) } },
  bracers: { on: { fightStart: () => addSt(B.P, 'dex', 1) } },
  whistle: { on: { fightStart: () => { for (const e of alive()) addSt(e, 'vuln', 1); } } },
  clipboard: { on: { fightStart: () => { for (const e of alive()) addSt(e, 'str', 1); } }, mod: { draw: 2 } },
  oldball: { on: { fightStart: () => { for (const e of alive()) hurtEnemy(e, 3, { raw: true }); } } },
  goldpuck: { on: { fightStart: () => B.hand.push(mkCard('frostbite')) } },
  speed: { mod: { energy: () => B.turn === 1 ? 1 : 0 } },
  playbook: { mod: { draw: 1 } },
  bag: { mod: { draw: () => B.turn === 1 ? 2 : 0 } },
  rallycap: { on: { turnEnd: () => { if (RUN.hp < RUN.maxhp / 2) gainBlock(6, true); } } },
  ring: { on: { turnEndHeal: () => healP(1) } },
  jersey: { on: { lethal: () => { if (B.jersey) return; B.jersey = true; RUN.hp = 15; fx({ k: 'banner', t: 'Lucky Jersey', sub: 'Back on your feet at 15 HP' }); log('The Lucky Jersey holds. 15 HP.', 'good'); return true; } } },
  goldenboot: { mod: { passes: () => B.sport === 'soccer' ? 1 : 0 } },
  bowling: { mod: { atk: () => B.bowlUsed ? 0 : 8 }, on: { attackPlayed: () => { B.bowlUsed = true; } } },
  foam: { on: { attackPlayed: () => { if (B.atkCount % 3 === 0) { for (const e of alive()) hurtEnemy(e, 5, { raw: true }); log('The crowd goes wild: 5 damage to every enemy.', 'good'); } } } },
  luckstone: { mod: { d20: 2 } },
  mitt: { mod: { rewardGold: 10 } },
  champring: { mod: { goldMult: .25 } },
  cupreplica: { mod: { choices: 1 } },
};
for (const [id, h] of Object.entries(TROPHY_FX)) { if (!RELICS[id]) { console.warn('hook for unknown trophy', id); continue; } Object.assign(RELICS[id], h); }
