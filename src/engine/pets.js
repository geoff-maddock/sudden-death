/* Pets (issue #104, phase 0): a small monster companion at your side in a card battle. The rules; the pets themselves
   are data/pets.js. Pets are the Realm's (it sets RUN.pet before a match, phase 2); a run without one fights as ever.
   A pet has no hit points and is never knocked out. What it brings:
   - its trait, always on;
   - its powers, which fire on their own when their moment comes (each opens at a bond level: at);
   - its trick, once a fight, when you choose (petTrick).
   Bond (1 to 3) makes its numbers bigger (petPow: PET.bond); a hungry pet's are smaller (PET.hungry). A hit of
   PET.spook or more spooks it: its next power doesn't fire (the trait still does).
   Declared, not checked by name: each pet's trait and powers carry on: { event: fn(arg, pet) | { when, then } } handlers, read through
   the hooks (onHook: one dispatcher an event), and mod: { name: fn(arg, pet) } sums (petMod, added to mod()). Its damage
   goes into atkDmg's breakdown under the pet's own name (petAtk). The moments a pet reads that the engine had no event
   for are fired in combat.js: playerAttacked (an enemy's hit on its way, with the enemy), playerHit ({ e, taken }),
   enemyBlock ({ e, n }: every enemy Block, through blockE) and playerDebuff ({ k, n }: every debuff on you, through
   debuffP; a truthy return stops it). An ally a boss eats isn't a kill of yours (enemyFalls skips it: e.eaten).
   B.pet (plain data, kept in a mid-fight save): { kind, name, bond, hungry, used (the trick), spooked, t: { per-turn
   flags }, f: { per-fight flags } }. Effects say what they did with fx({ k: 'pet', t }) and the log. */
const PET = { bond: [1, 1.5, 2], hungry: .5, spook: 15 };
const PET_EVENTS = ['fightStart', 'turnStart', 'turnEnd', 'cardPlayed', 'attackPlayed', 'enemyFalls', 'fightWon', 'playerAttacked', 'playerHit', 'enemyBlock', 'playerDebuff'];
const petDef = p => p && PETS[p.kind] || null;
const petName = () => (B && B.pet && (B.pet.name || (petDef(B.pet) || {}).n)) || 'Your pet';
// a pet's number at its bond, smaller when it is hungry (at least 1)
function petPow(n, p) { const q = p || (B && B.pet); if (!q) return n; return Math.max(1, Math.round(n * PET.bond[clamp((q.bond || 1) - 1, 0, 2)] * (q.hungry ? PET.hungry : 1))); }
// the pet at a fight's start: from the run (the Realm's), as plain data
function petBegin() {
  const rp = RUN && RUN.pet; B.pet = null;
  if (!rp || !PETS[rp.kind]) return;
  B.pet = { kind: rp.kind, name: rp.name || PETS[rp.kind].n, bond: clamp(rp.bond || 1, 1, 3), hungry: !!rp.hungry, used: false, spooked: false, t: {}, f: {} };
}
// a pet's effect said: on screen and in the log
function petSay(t) { fx({ k: 'pet', t: `${petName()}: ${t}` }); log(`${petName()}: ${t}`, 'good'); }
// the powers open at their bond levels
const petPowers = p => (petDef(p).powers || []).filter(w => (w.at || 1) <= (p.bond || 1));
// one event, to the pet at your side: its trait, then its powers. A handler is a function (it always fires) or
// { when(a, pet), then(a, pet) }: a spooked pet's first power that would fire doesn't, and the pet settles (the trait
// is never spooked). A truthy return is passed back (playerDebuff uses it to stop the debuff)
const petH = h => typeof h === 'function' ? { when: () => true, then: h } : h;
function petOn(ev, a) {
  if (!B || !B.pet || B.over === 'lose') return;
  const p = B.pet, D = petDef(p); if (!D) return;
  // (an ally a boss eats isn't a kill of yours)
  if (ev === 'enemyFalls' && a && a.eaten) return;
  if (ev === 'turnStart') p.t = {};
  let r;
  const T = D.trait && D.trait.on && D.trait.on[ev]; if (T) { const h = petH(T); if (h.when(a, p)) { const v = h.then(a, p); if (v) r = v; } }
  for (const w of petPowers(p)) {
    const f = w.on && w.on[ev]; if (!f) continue;
    const h = petH(f); if (!h.when(a, p)) continue;
    if (p.spooked) { p.spooked = false; petSay('too spooked to help this time.'); continue; }
    const v = h.then(a, p); if (v) r = v;
  }
  return r;
}
for (const ev of PET_EVENTS) onHook(ev, a => petOn(ev, a));
// the pet's sums (draw, energy, and the like), added to the trophies' in mod()
function petMod(name, a) {
  if (!B || !B.pet) return 0;
  const p = B.pet, D = petDef(p); if (!D) return 0;
  let n = 0; const add = m => { if (m == null) return; n += (typeof m === 'function' ? m(a, p) : m) || 0; };
  add(D.trait && D.trait.mod && D.trait.mod[name]);
  for (const w of petPowers(p)) add(w.mod && w.mod[name]);
  return n;
}
const sdMod = mod;
mod = function (name, a) { return sdMod(name, a) + petMod(name, a); };
// what the pet adds to a hit (atkDmg shows it under the pet's name)
function petAtk(card, e) {
  if (!B || !B.pet) return 0;
  const p = B.pet, D = petDef(p); if (!D) return 0;
  let n = 0; const add = f => { if (f) n += f(card, e, p) || 0; };
  add(D.trait && D.trait.atk);
  for (const w of petPowers(p)) add(w.atk);
  return n;
}
// a hit big enough spooks it
function petSpook(taken) { if (B && B.pet && !B.pet.spooked && taken >= PET.spook) { B.pet.spooked = true; petSay('spooked by that hit: its next power won\'t fire.'); } }
// why the trick can't be used now ('' if it can)
function petTrickWhy() {
  if (!B || !B.pet || !petDef(B.pet)) return 'No pet.';
  if (B.over || B.phase !== 'player') return 'Only on your turn.';
  if (B.pet.used) return 'Once a fight.';
  return '';
}
// the trick, once a fight: ti the target (an enemy's index), or the first standing
function petTrick(ti) {
  if (petTrickWhy()) return false;
  const p = B.pet, D = petDef(p), K = D.trick, tgt = ti != null && B.enemies[ti] && !B.enemies[ti].dead && !B.enemies[ti].fled ? B.enemies[ti] : alive()[0];
  p.used = true;
  petSay(`${K.n}!`);
  resolve(K.ops(p), { card: null, tgt, d: { tgt: K.tgt || 'one', n: K.n, type: 'pet' } });
  checkWin();
  return true;
}
// what a pet does, in words (the trait, each power with the bond it opens at, the trick), its numbers at bond b
function petText(kind, b, hungry) {
  const D = PETS[kind]; if (!D) return null;
  const p = { kind, bond: b || 1, hungry: !!hungry }, say = x => typeof x === 'function' ? x(p) : x;
  return { n: D.n, from: D.from, el: D.el, trait: say(D.trait.d), powers: (D.powers || []).map(w => ({ at: w.at || 1, d: say(w.d), open: (w.at || 1) <= p.bond })), trick: { n: D.trick.n, d: say(D.trick.d) } };
}
