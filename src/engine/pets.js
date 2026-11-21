/* Pets (issue #104, phase 0): a small monster companion at your side in a card battle. The rules; the pets themselves
   are data/pets.js. Pets are the Realm's (it sets RUN.pet before a match, phase 2); a run without one fights as ever.
   A pet has no hit points and is never knocked out. What it brings:
   - its trait, always on;
   - its powers, which fire on their own when their moment comes (each opens at a bond level: at);
   - its trick, once a fight, when you choose (petTrick).
   Bond (1 to 3) makes its numbers bigger (petPow: PET.bond); a hungry pet's are smaller (PET.hungry). A hit of
   PET.spook or more spooks it: its next power that would fire doesn't (a once-a-turn power is lost for that turn; a
   once-a-fight power waits for its next chance; the trait is never spooked).
   Declared, not checked by name: each pet's trait and powers carry on: { event: fn(arg, pet) | { when, then } } handlers, read through
   the hooks (onHook: one dispatcher an event), and mod: { name: fn(arg, pet) } sums (petMod, added to mod()). Its damage
   goes into atkDmg's breakdown under the pet's own name (petAtk). The moments a pet reads that the engine had no event
   for are fired in combat.js: playerAttacked (an enemy's hit on its way, with the enemy), playerHit ({ e, taken }),
   enemyBlock ({ e, n }: an enemy's Block from a move, a phase or its turn, through blockE; a hockey save isn't Block
   raised) and playerDebuff ({ k, n }: every debuff on you, through debuffP; a truthy return stops it). An ally a boss
   eats isn't a kill of yours, for a pet (its enemyFalls skips e.eaten; trophies are as they were).
   B.pet (plain data, kept in a mid-fight save): { kind, name, bond, hungry, used (the trick), spooked, t: { per-turn
   flags }, f: { per-fight flags } }. Effects say what they did with fx({ k: 'pet', t }) and the log. */
const PET = { bond: [1, 1.5, 2], hungry: .5, spook: 15, ctx: .25 };
const PET_EVENTS = ['fightStart', 'turnStart', 'turnEnd', 'cardPlayed', 'attackPlayed', 'enemyFalls', 'fightWon', 'playerAttacked', 'playerHit', 'enemyBlock', 'playerDebuff', 'highlight', 'score'];
const petDef = p => p && PETS[p.kind] || null;
const petName = () => (B && B.pet && (B.pet.name || (petDef(B.pet) || {}).n)) || 'Your pet';
// a pet's number at its bond, smaller when it is hungry (at least 1)
/* context (phase 6): a pet is a step stronger, PET.ctx a step, for each that fits the match: one of its sports
   (PETS[k].sports, the sport being played), one of its moons (PETS[k].moon, the sky's phase), its own ground (here: the
   element of the match's region, set by the Realm) and an element its own beats (foe: the other side's, PET_BEATS).
   Outside the Realm there is no ground or foe, so only the sport and the moon. It counts only for the pet in the fight
   (B.pet), or a copy of it that petText was given, and not once the fight is lost (a win's payouts, fightWon, still
   count it); anything else, the Pets tab or a shop, shows a pet's own numbers. The moon is read once, as the fight
   begins (B.pet.moonOn, set by petBegin; a B.pet without it has no moon, as a save from before context began fought
   without any), so what the pet gave at the start and what it says agree */
const petMoonOn = D => !!(D.moon && !window.SKY_OFF && typeof skyNow === 'function' && D.moon.includes(skyNow().moon));
const PET_BEATS = { ember: 'bloom', bloom: 'tide', tide: 'ember', aether: 'rime', rime: 'aether' };
const PET_CTX_NAME = { sport: 'its sport', moon: 'its moon', home: 'its home ground', foe: 'an element it beats' };
function petCtx(q) {
  const D = q && PETS[q.kind]; if (!D || !B || B.over === 'lose' || !(q === B.pet || q.inFight)) return [];
  const out = [];
  if (D.sports && D.sports.includes(B.sport)) out.push('sport');
  if (q.moonOn) out.push('moon');
  if (q.here && q.here === D.el) out.push('home');
  if (q.foe && PET_BEATS[D.el] === q.foe) out.push('foe');
  return out;
}
function petPow(n, p) { const q = p || (B && B.pet); if (!q) return n; return Math.max(1, Math.round(n * PET.bond[clamp((q.bond || 1) - 1, 0, 2)] * (q.hungry ? PET.hungry : 1) * (1 + PET.ctx * petCtx(q).length))); }
// the pet at a fight's start: from the run (the Realm's), as plain data
function petBegin() {
  foePetBegin();
  const rp = RUN && RUN.pet; B.pet = null;
  if (!rp || !PETS[rp.kind]) return;
  const D = PETS[rp.kind], moonOn = petMoonOn(D);
  B.pet = { kind: rp.kind, name: rp.name || D.n, bond: clamp(rp.bond || 1, 1, 3), hungry: !!rp.hungry, here: rp.here || null, foe: rp.foe || null, moonOn, used: false, spooked: false, t: {}, f: {} };
}
// a pet's effect said: on screen and in the log
function petSay(t) { fx({ k: 'pet', t: `${petName()}: ${t}` }); log(`${petName()}: ${t}`, 'good'); }
// the powers open at their bond levels
const petPowers = p => (petDef(p).powers || []).filter(w => (w.at || 1) <= (p.bond || 1));
// one event, to the pet at your side: its trait, then its powers. A handler is a function (it always fires) or
// { when(a, pet), then(a, pet), spend(a, pet) } (spend: what a once-a-turn power marks as used, before it fires): a spooked pet's first power that would fire doesn't, and the pet settles (the trait
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
    // (a once-a-turn power marks itself used (its spend) whether it fires or the spook stops it, so a spook costs it the
    // turn; a once-a-fight power has no spend here, and waits for its next chance: the spook's cost to it is that delay)
    if (h.spend) h.spend(a, p);
    if (p.spooked) { p.spooked = false; petSay(h.spend ? 'too spooked to help this turn.' : 'too spooked to help this time.'); continue; }
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
function petSpook(taken) { if (B && B.pet && !B.pet.spooked && taken >= PET.spook) { B.pet.spooked = true; petSay('spooked by that hit: it will hold back its next power.'); } }
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
// (st: the pet in a fight, whose ground and foe count; its numbers then include what suits it, ctx naming each)
function petText(kind, b, hungry, st) {
  const D = PETS[kind]; if (!D) return null;
  const p = { kind, bond: b || 1, hungry: !!hungry, here: st ? st.here : null, foe: st ? st.foe : null, moonOn: st ? !!st.moonOn : false, inFight: !!st }, say = x => typeof x === 'function' ? x(p) : x;
  return { n: D.n, from: D.from, el: D.el, ctx: st ? petCtx(p).map(k => PET_CTX_NAME[k]) : [], trait: say(D.trait.d), powers: (D.powers || []).map(w => ({ at: w.at || 1, d: say(w.d), open: (w.at || 1) <= p.bond })), trick: { n: D.trick.n, d: say(D.trick.d) } };
}

/* ---------- the other side's pet (phase 7): a rival club's special pet, set by the Realm in RUN.foePet ---------- */
// B.foePet = { kind, name, skill (1 to 3: when it throws its trick), used, t: {} (this turn), f: {} (this fight) }
function foePetBegin() {
  const rp = RUN && RUN.foePet; B.foePet = null;
  if (!rp || typeof FOE_PETS === 'undefined' || !FOE_PETS[rp.kind]) return;
  B.foePet = { kind: rp.kind, name: FOE_PETS[rp.kind].n, skill: clamp(rp.skill || 1, 1, 3), used: false, t: {}, f: {} };
}
function foeSay(t) { fx({ k: 'pet', side: 1, t: `${B.foePet.name}: ${t}` }); log(`Their ${B.foePet.name}: ${t}`, 'bad'); }
// a rival pet's fright: your pet's next power won't fire
function foeSpook() { if (B.pet && !B.pet.spooked) { B.pet.spooked = true; log(`${petName()} is spooked: its next power won't fire.`, 'bad'); } }
// when the CPU throws its trick: at skill 3 when it hurts (or from turn 5, whatever), at 2 now and then once it is
// ready, at 1 whenever
function foeTrickNow(F, p) {
  const ready = F.trick.when ? !!F.trick.when(p) : true;
  if (p.skill >= 3) return ready || B.turn >= 5;
  if (p.skill === 2) return B.turn >= 2 && R() < (ready ? .7 : .2);
  return R() < .3;
}
function foePetOn(ev, a) {
  if (!B || !B.foePet || B.over) return;
  const p = B.foePet, F = FOE_PETS[p.kind]; if (!F) return;
  if (ev === 'turnStart') p.t = {};
  // (atEnd: what it does as your turn ends, which foeDeb reads; put back as it was after, so a call inside another
  // leaves the outer one's alone, and never left set)
  const was = p.atEnd; p.atEnd = ev === 'turnEnd' || !!was;
  try {
    for (const h of [F.trait, F.power]) if (h && h.on && h.on[ev] && !B.over) h.on[ev](a, p);
    // (the trick: once a match, as your turn ends and theirs begins)
    if (ev === 'turnEnd' && !p.used && !B.over && F.trick && alive().length && foeTrickNow(F, p)) { p.used = true; foeSay(`${F.trick.n}!`); F.trick.go(p); }
  } finally { if (was) p.atEnd = was; else delete p.atEnd; }
}
for (const ev of ['fightStart', 'turnStart', 'turnEnd', 'cardPlayed', 'enemyFalls']) onHook(ev, a => foePetOn(ev, a));
