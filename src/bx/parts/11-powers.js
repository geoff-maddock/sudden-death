/* The Anvil Ring: monster powers (issue #23, phase 4). Every kind has a special, once a round, and an ultimate, once a
   bout (BX_POW), adapted from what the powers do in Brimstone Diamond's brawls (swallow, stomp, stone, charge, vanish,
   heal and the rest). Casting costs stamina (BX_POW_STA), and a fighter can't cast down, stunned, clinched or while
   busy with a punch.
   A power does something now (now: damage that goes through the guard, a stun, a push back toward the ropes, a dash in,
   stamina off them, health back, a counter window) and may leave a status for a few seconds (fx, on the caster or on
   the other fighter: who). A fighter's statuses (f.fx, plain JSON: [{ id, n, t, ...effects }]) wear off with time, and
   their effects combine (bxFx): multipliers multiply, the rest add, flags are on if any is.
   The effects: spd (how quick their punches and slips are), move (how fast they move; root stops them), noBack (they
   can't back away), acc (added to their punches' accuracy), miss (punches at them miss), dmgIn and dmgOut (damage
   taken and dealt), rampart (head punches at them do nothing, body shots half), leaky (their guard lets twice as much
   through), regSta and regHp (stamina and health a second, either way), noReg (no stamina back), heal (health back for
   the damage they land, as a share), sight (they see every punch coming), undying (the next knockdown this round they
   stay up on 1), nextMul (their next power punch that lands does this much more), air (body shots at them miss).
   The CPU casts by its skill and the moment (bxCpuCast): a special when it suits (in range, hurt, tired), an ultimate
   when the bout turns (badly hurt, the other fighter hurt, or late in the last round). Your fighter: in You box with Q
   (special) and R (ultimate) or the pad; in You corner they cast as a CPU fighter would. G.powers false boxes without.
   Two specials (issue #61, phase 4): every kind has sp and sp2, and a fighter brings one (f.spPick, from { sp: 'sp2' }
   on the fighter it is given); bxPowOf(f, 'sp') is the one it brought. now.mySta is stamina back for the caster, and a
   negative push pulls them in.
   Spirit (BX_SPIRIT): a meter from 0 to max, filled by landing clean punches and by taking punishment (blocked punches
   count a little), never by powers. A special needs BX_SPIRIT.sp of it and an ultimate BX_SPIRIT.ult, spent when cast,
   as well as the stamina; each fighter starts a bout with BX_SPIRIT.start. f.spirit, plain data. */
const BX_POW_STA = { sp: 8, ult: 15 };
// (a fighter deals and takes about 50 damage a round, so a round of work fills about 35: a special most rounds, or an
// ultimate saved for)
const BX_SPIRIT = { max: 100, start: 10, sp: 25, ult: 60, land: .3, take: .4, block: .12 };
const BX_POW = {
  goblin:   { sp: { id: 'shadowstep', n: 'Shadowstep', when: 'close', desc: 'Blinks to their open side: the next punch is a counter, and for 2 seconds punches find them more often.', now: { ctr: 1.2 }, fx: { who: 'self', t: 2, acc: .2 } },
              ult: { id: 'flurry', n: 'Flurry', when: 'close', desc: 'Four quick jabs that all land, and a counter after.', now: { hits: 4, ctr: .8 } },
              sp2: { id: 'dirtytrick', n: 'Dirty Trick', when: 'close', desc: 'A thumb to the eye: for 3 seconds their punches find you 20% less often.', fx: { who: 'them', t: 3, acc: -.2 } } },
  kobold:   { sp: { id: 'firebreath', n: 'Fire Breath', when: 'close', desc: 'A burst of flame through the guard (7), and their guard leaks for 4 seconds.', now: { dmg: 7 }, fx: { who: 'them', t: 4, leaky: 1 } },
              ult: { id: 'inferno', n: 'Inferno', when: 'any', desc: 'The canvas burns under them: 3 health a second for 5 seconds, and their guard leaks.', fx: { who: 'them', t: 5, regHp: -3, leaky: 1 } },
              sp2: { id: 'emberdance', n: 'Ember Dance', when: 'mid', desc: 'Hot coals underfoot: for 4 seconds, 20% quicker to punch and to move.', fx: { who: 'self', t: 4, spd: 1.2, move: 1.2 } } },
  werewolf: { sp: { id: 'pounce', n: 'Pounce', when: 'mid', desc: 'Leaps in and knocks them off balance: in close, they stagger, and the next punch is a counter.', now: { dash: 2.5, stun: .6, ctr: .8 } },
              ult: { id: 'bloodmoon', n: 'Blood Moon', when: 'any', desc: 'For 7 seconds: 35% quicker and 35% harder.', fx: { who: 'self', t: 7, spd: 1.35, dmgOut: 1.35 } },
              sp2: { id: 'howl', n: 'Howl', when: 'mid', desc: 'A howl that chills them: 6 stamina off, and for 3 seconds their punches do 20% less.', now: { sta: 6 }, fx: { who: 'them', t: 3, dmgOut: .8 } } },
  dwarf:    { sp: { id: 'axe', n: 'Battle Axe', when: 'close', desc: 'Winds up the axe arm: the next power punch that lands does 80% more.', fx: { who: 'self', t: 5, nextMul: 1.8 } },
              ult: { id: 'earthshatter', n: 'Earthshatter', when: 'close', desc: 'Stamps the canvas: they stumble for over a second.', now: { stun: 1.2 } },
              sp2: { id: 'stoutale', n: 'Stout Ale', when: 'tired', desc: 'A swig from the flask: 14 stamina and 5 health back.', now: { mySta: 14, hp: 5 } } },
  ogre:     { sp: { id: 'crush', n: 'Club Crush', when: 'close', desc: 'A clubbing blow through the guard (6).', now: { dmg: 6 } },
              ult: { id: 'bellyflop', n: 'Belly Flop', when: 'close', desc: 'Falls on them: 13 through the guard, and they stagger.', now: { dmg: 13, stun: .5 } },
              sp2: { id: 'bearhug', n: 'Bear Hug', when: 'close', desc: 'Squeezes the breath out of them: 12 stamina off, and they stagger.', now: { sta: 12, stun: .4 } } },
  minotaur: { sp: { id: 'bullrush', n: 'Bull Rush', when: 'mid', desc: 'Charges them back toward the ropes, and they stagger.', now: { dash: 2, push: 3, stun: .5 } },
              ult: { id: 'stampede', n: 'Stampede', when: 'mid', desc: 'Runs them over: 12 through the guard, and pinned on the ropes.', now: { dash: 3, push: 5, dmg: 12, stun: .8 } },
              sp2: { id: 'gore', n: 'Gore', when: 'close', desc: 'The horns: 5 through the guard, and their guard leaks for 3 seconds.', now: { dmg: 5 }, fx: { who: 'them', t: 3, leaky: 1 } } },
  troll:    { sp: { id: 'regen', n: 'Troll Blood', when: 'hurt', desc: '15 health back.', now: { hp: 15 } },
              ult: { id: 'bog', n: 'Bog Tide', when: 'any', desc: 'The canvas turns to bog under them: they move at 40% for 6 seconds.', fx: { who: 'them', t: 6, move: .4 } },
              sp2: { id: 'groundsmash', n: 'Ground Smash', when: 'mid', desc: 'Pounds the canvas: they stumble, and their feet are slow (60%) for 3 seconds.', now: { stun: .6 }, fx: { who: 'them', t: 3, move: .6 } } },
  golem:    { sp: { id: 'stoneskin', n: 'Stone Skin', when: 'close', desc: 'For 4 seconds, punches do 60% less.', fx: { who: 'self', t: 4, dmgIn: .4 } },
              ult: { id: 'rampart', n: 'Rampart', when: 'any', desc: 'For 6 seconds, head punches do nothing and body shots half.', fx: { who: 'self', t: 6, rampart: 1 } },
              sp2: { id: 'lodestone', n: 'Lodestone', when: 'mid', desc: 'Drags them in close, and the next power punch that lands does 50% more.', now: { push: -2.5 }, fx: { who: 'self', t: 4, nextMul: 1.5 } } },
  harpy:    { sp: { id: 'flight', n: 'Take Flight', when: 'close', desc: 'For 3 seconds: up off the canvas, so body shots miss, and 30% quicker on the wing.', fx: { who: 'self', t: 3, air: 1, move: 1.3 } },
              ult: { id: 'tempest', n: 'Tempest', when: 'any', desc: 'A gale blows them onto the ropes and takes 15 stamina.', now: { push: 6, sta: 15 } },
              sp2: { id: 'shriek', n: 'Shriek', when: 'mid', desc: 'A scream that rattles them: they flinch, and lose 8 stamina.', now: { stun: .5, sta: 8 } } },
  elf:      { sp: { id: 'eagle', n: 'Eagle Eye', when: 'close', desc: 'For 3 seconds they see every punch coming.', fx: { who: 'self', t: 3, sight: 1 } },
              ult: { id: 'overgrowth', n: 'Overgrowth', when: 'tired', desc: 'For 5 seconds: 6 stamina and 1.5 health back a second.', fx: { who: 'self', t: 5, regSta: 6, regHp: 1.5 } },
              sp2: { id: 'swiftarrow', n: 'Swift Arrow', when: 'any', desc: 'A shot from anywhere in the ring: 6 through the guard.', now: { dmg: 6 } } },
  wraith:   { sp: { id: 'vanish', n: 'Vanish', when: 'close', desc: 'For 1.2 seconds, punches pass straight through.', fx: { who: 'self', t: 1.2, miss: 1 } },
              ult: { id: 'fog', n: 'Fog of the Dead', when: 'any', desc: 'For 4 seconds their punches find you far less often.', fx: { who: 'them', t: 4, acc: -.25 } },
              sp2: { id: 'soulsiphon', n: 'Soul Siphon', when: 'close', desc: 'Drinks their breath: 8 stamina off them, and 8 back for you.', now: { sta: 8, mySta: 8 } } },
  vampire:  { sp: { id: 'drain', n: 'Drain', when: 'close', desc: 'For 5 seconds, 60% of what lands comes back as health.', fx: { who: 'self', t: 5, heal: .6 } },
              ult: { id: 'eclipse', n: 'Eclipse', when: 'any', desc: 'For 6 seconds: all of what lands comes back as health, and punches find them more often.', fx: { who: 'self', t: 6, heal: 1, acc: .2 } },
              sp2: { id: 'batswarm', n: 'Bat Swarm', when: 'mid', desc: 'Bats round their head for 3 seconds: their punches find you less often, and their feet slow.', fx: { who: 'them', t: 3, acc: -.15, move: .7 } } },
  lich:     { sp: { id: 'weakness', n: 'Hex of Weakness', when: 'close', desc: 'For 5 seconds their punches do half.', fx: { who: 'them', t: 5, dmgOut: .5 } },
              ult: { id: 'gravehands', n: 'Grave Hands', when: 'any', desc: 'Hands from the canvas hold them for 5 seconds: rooted, and slow to punch.', fx: { who: 'them', t: 5, root: 1, spd: .6 } },
              sp2: { id: 'soulbolt', n: 'Soul Bolt', when: 'any', desc: 'A bolt from anywhere in the ring: 7 through the guard.', now: { dmg: 7 } } },
  zombie:   { sp: { id: 'undying', n: 'Undying', when: 'hurt', desc: 'The next knockdown this round, they stay up on 1 health.', fx: { who: 'self', t: 40, undying: 1 } },
              ult: { id: 'plague', n: 'Plague Cloud', when: 'any', desc: 'Grave gas: for 6 seconds they lose 2 health and 4 stamina a second.', fx: { who: 'them', t: 6, regHp: -2, regSta: -4 } },
              sp2: { id: 'rotgrip', n: 'Rotting Grip', when: 'close', desc: 'Grabs hold: for 2 seconds they can\'t move, and lose 2 health a second.', fx: { who: 'them', t: 2, root: 1, regHp: -2 } } },
  gorgon:   { sp: { id: 'petrify', n: 'Petrify', when: 'mid', desc: 'A stony stare: they freeze for a second.', now: { stun: 1 } },
              ult: { id: 'garden', n: 'Stone Garden', when: 'any', desc: 'They turn to stone for over two seconds.', now: { stun: 2.2 } },
              sp2: { id: 'serpenthair', n: 'Serpent Hair', when: 'close', desc: 'The snakes strike: two quick hits that land, and their guard leaks for 2 seconds.', now: { hits: 2 }, fx: { who: 'them', t: 2, leaky: 1 } } },
  spider:   { sp: { id: 'web', n: 'Web', when: 'mid', desc: 'Webs their feet for 4 seconds: they move at a third of their speed and can\'t back away.', fx: { who: 'them', t: 4, move: .35, noBack: 1 } },
              ult: { id: 'webburst', n: 'Web Burst', when: 'any', desc: 'Wrapped up for 6 seconds: rooted, and punching at half speed.', fx: { who: 'them', t: 6, root: 1, spd: .5 } },
              sp2: { id: 'venom', n: 'Venom Bite', when: 'close', desc: 'A bite through the guard (4), and venom: 1.5 health a second for 5 seconds.', now: { dmg: 4 }, fx: { who: 'them', t: 5, regHp: -1.5 } } },
  skeleton: { sp: { id: 'rattle', n: 'Rattle', when: 'close', desc: 'Clatters apart and back: punches miss for a second, and the next is a counter.', now: { ctr: .9 }, fx: { who: 'self', t: 1, miss: 1 } },
              ult: { id: 'bonestorm', n: 'Bone Storm', when: 'any', desc: 'Bursts into a storm of bones: punches miss for 4 seconds.', fx: { who: 'self', t: 4, miss: 1 } },
              sp2: { id: 'bonethrow', n: 'Bone Throw', when: 'any', desc: 'Throws a rib from anywhere in the ring: 5 through the guard, and they flinch.', now: { dmg: 5, stun: .3 } } },
  witch:    { sp: { id: 'hex', n: 'Hex', when: 'mid', desc: 'A drain on their breath: 8 stamina off, and none back for 2 seconds.', now: { sta: 8 }, fx: { who: 'them', t: 2, noReg: 1 } },
              ult: { id: 'blizzard', n: 'Blizzard', when: 'any', desc: 'Snow on them: 20% slower at everything for 3 seconds.', fx: { who: 'them', t: 3, spd: .8, move: .8 } },
              sp2: { id: 'brew', n: 'Witch\'s Brew', when: 'tired', desc: 'A swig from the cauldron: 12 stamina back, and 2 more a second for 4 seconds.', now: { mySta: 12 }, fx: { who: 'self', t: 4, regSta: 2 } } },
};
const BX_FX_MUL = ['spd', 'move', 'dmgIn', 'dmgOut', 'nextMul'], BX_FX_ADD = ['acc', 'regSta', 'regHp', 'heal'], BX_FX_FLAG = ['root', 'noBack', 'miss', 'rampart', 'leaky', 'noReg', 'sight', 'undying', 'air'];
// a fighter's statuses, combined (most of the time there are none: the same no-effect answer, built once)
const BX_FX_NONE = (() => { const o = {}; for (const k of BX_FX_MUL) o[k] = 1; for (const k of BX_FX_ADD) o[k] = 0; for (const k of BX_FX_FLAG) o[k] = 0; return Object.freeze(o); })();
function bxFx(f) {
  if (!f.fx || !f.fx.length) return BX_FX_NONE;
  const o = {}; for (const k of BX_FX_MUL) o[k] = 1; for (const k of BX_FX_ADD) o[k] = 0; for (const k of BX_FX_FLAG) o[k] = 0;
  for (const s of f.fx || []) { for (const k of BX_FX_MUL) if (s[k] != null) o[k] *= s[k]; for (const k of BX_FX_ADD) if (s[k] != null) o[k] += s[k]; for (const k of BX_FX_FLAG) if (s[k]) o[k] = 1; }
  return o;
}
const bxPowOn = () => !G || G.powers !== false;
const bxPowOf = (f, which) => { const P = bxPowOn() && BX_POW[f.kind]; if (!P) return null; return which === 'sp' && f.spPick === 'sp2' && P.sp2 ? P.sp2 : P[which] || null; };
// spirit (a bout saved before there was any has a full meter)
const bxSpirit = f => f.spirit == null ? BX_SPIRIT.max : f.spirit;
// a punch landed (a: who threw it, b: who took it; blocked or clean): spirit for both
function bxSpiritGain(a, b, dmg, blocked) {
  if (!bxPowOn()) return;
  if (!blocked) a.spirit = Math.min(BX_SPIRIT.max, bxSpirit(a) + dmg * BX_SPIRIT.land);
  b.spirit = Math.min(BX_SPIRIT.max, bxSpirit(b) + dmg * BX_SPIRIT.take * (blocked ? BX_SPIRIT.block / BX_SPIRIT.take : 1));
}
/* whether f can cast its special ('sp') or ultimate ('ult') now: { ok, why } */
function bxCanCast(f, which) {
  const P = bxPowOf(f, which), o = G.F[1 - f.side];
  if (!P) return { ok: false, why: 'no power' };
  if (which === 'sp' ? f.spUsed === G.round : f.ultUsed) return { ok: false, why: which === 'sp' ? 'used this round' : 'used this bout' };
  if (BD.ph !== 'round') return { ok: false, why: 'only in a round' };
  if (['down', 'stun', 'clinch', 'grab'].includes(f.a.k) || bxPunching(f)) return { ok: false, why: 'busy' };
  if (o.a.k === 'down') return { ok: false, why: 'they are down' };
  if (f.sta < BX_POW_STA[which]) return { ok: false, why: 'no breath' };
  if (bxSpirit(f) < BX_SPIRIT[which]) return { ok: false, why: 'needs spirit' };
  return { ok: true, why: '' };
}
// a power with wishes (a superstar's: the Djinn's Three Wishes) grants the first that suits the moment: { when: 'hurt'
// (the caster under 45% health), 'theyHurt' (the other fighter under 45%) or 'else', now, fx, n }
function bxWish(f, o, P) {
  if (!P.wish) return P;
  const W = P.wish.find(w => w.when === 'hurt' ? f.hp < f.hpMax * .45 : w.when === 'theyHurt' ? o.hp < o.hpMax * .45 : true) || P.wish[P.wish.length - 1];
  bxLog(`${f.n} wishes for ${W.n}.`);
  return Object.assign({}, P, { now: W.now, fx: W.fx });
}
function bxCast(f, which) {
  if (!bxCanCast(f, which).ok) return false;
  const o = G.F[1 - f.side], P = bxWish(f, o, bxPowOf(f, which)), N = P.now || {};
  f.sta -= BX_POW_STA[which]; f.spirit = bxSpirit(f) - BX_SPIRIT[which]; if (which === 'sp') f.spUsed = G.round; else f.ultUsed = true;
  f.a = { k: 'idle', t: 0, dur: 0, id: ++G.aid };
  const d = bxDist(f, o), ux = (o.x - f.x) / (d || 1), uy = (o.y - f.y) / (d || 1);
  if (N.dash) { const step = Math.max(0, Math.min(N.dash, d - BX_RING.body)); f.x += ux * step; f.y += uy * step; }
  if (N.push) { const pu = Math.max(N.push, -Math.max(0, bxDist(f, o) - BX_RING.body)); o.x = clamp(o.x + ux * pu, -BX_RING.rope, BX_RING.rope); o.y = clamp(o.y + uy * pu, -BX_RING.rope, BX_RING.rope); }
  if (N.mySta) f.sta = Math.min(f.staMax, f.sta + N.mySta);
  if (N.hp) f.hp = Math.min(f.hpMax, f.hp + N.hp);
  if (N.sta) o.sta = Math.max(0, o.sta - N.sta);
  if (N.ctr) f.ctr = Math.max(f.ctr, N.ctr);
  let dmg = 0;
  if (N.hits) for (let i = 0; i < N.hits; i++) dmg += BX_PUNCH.jab.dmg * (.55 + f.r.pow * .09) / (.4 + o.r.chin * .12);
  if (N.dmg) dmg += N.dmg;
  // (a power's hit passes through a fighter punches pass through, and Rampart takes half of it)
  const Fo = bxFx(o);
  if (dmg && Fo.miss) bxEv('miss', f.side, { p: 'power', why: 'through' });
  else if (dmg) { dmg *= Fo.dmgIn * bxFx(f).dmgOut * (Fo.rampart ? .5 : 1); bxHurt(f, o, dmg, true); bxEv('zap', f.side, { n: Math.round(dmg * 10) / 10, pw: P.n }); }
  if (N.stun && o.a.k !== 'down' && G.down == null) o.a = { k: 'stun', t: 0, dur: N.stun, id: ++G.aid, stone: P.id === 'petrify' || P.id === 'garden' };
  if (P.fx) { const who = P.fx.who === 'self' ? f : o, s = Object.assign({ id: P.id, n: P.n, from: f.side }, P.fx); delete s.who; who.fx = (who.fx || []).filter(x => x.id !== P.id).concat([s]); }
  f.rs.pw++;
  bxEv('cast', f.side, { id: P.id, n: P.n, ult: which === 'ult' });
  bxLog(`${f.n} casts ${P.n}${which === 'ult' ? ', the ultimate' : ''}!`, which === 'ult');
  // (the page hears it as a beat, so the power's button goes out)
  if (!BD.headless && BX_HOOK.onPhase) BX_HOOK.onPhase(BD.ph);
  return true;
}
// damage from a power (or a punch, from bxLand): health off, the hit counted, a knockdown at zero (unless undying)
function bxHurt(a, b, dmg, landed) {
  b.hp -= dmg; a.rs.dmg += dmg;
  // (Drain and Eclipse heal on what lands: a punch through the guard or a power's hit, not a block or a status's tick)
  const H = bxFx(a).heal; if (H && landed) a.hp = Math.min(a.hpMax, a.hp + dmg * H);
  if (b.hp <= 0) {
    // one knockdown at a time: if the other fighter went down this step, this one stays up on the last of their health
    if (G.down != null && G.down !== b.side) { b.hp = .01; return; }
    const F = bxFx(b);
    if (F.undying) { b.hp = 1; b.fx = b.fx.filter(s => !s.undying); bxEv('undying', b.side); bxLog(`${b.n} will not go down!`, true); return; }
    b.hp = 0; b.a = { k: 'down', t: 0, dur: 0, id: ++G.aid }; G.down = b.side; bxEv('kd', b.side);
  }
}
// statuses wear off; health and stamina a second from them
function bxFxTick(f, dt) {
  if (!f.fx || !f.fx.length) return;
  const F = bxFx(f);
  if (F.regHp && f.a.k !== 'down') { const o = G.F[1 - f.side]; if (F.regHp > 0) f.hp = Math.min(f.hpMax, f.hp + F.regHp * dt); else bxHurt(o, f, -F.regHp * dt, false); }
  if (F.regSta) f.sta = clamp(f.sta + F.regSta * dt, 0, f.staMax);
  for (const s of f.fx) s.t -= dt;
  f.fx = f.fx.filter(s => s.t > 0);
}
/* the CPU's casting: a special when the moment suits it, an ultimate when the bout turns. Better skill casts at better
   moments and less often at bad ones. */
function bxCpuCast(f, o) {
  const skill = G.skill ? G.skill[f.side] : 1, d = bxDist(f, o), hurt = f.hp < f.hpMax * .45, tired = bxFrac(f) < .35;
  const suits = w => w === 'any' || (w === 'close' && d <= bxRange(f, 'hook')) || (w === 'mid' && d <= bxRange(f, 'jab') + 1.5) || (w === 'hurt' && hurt) || (w === 'tired' && (tired || hurt));
  for (const which of ['ult', 'sp']) {
    const P = bxPowOf(f, which); if (!P || !bxCanCast(f, which).ok) continue;
    const late = G.round === G.rounds && G.clock < 15, turn = hurt || o.hp < o.hpMax * .4 || late;
    if (which === 'ult' && !turn && skill > 0) continue;
    // (a Knight or better keeps the spirit for its ultimate in the last round, unless the special would turn it)
    if (which === 'sp' && skill > 0 && !f.ultUsed && G.round === G.rounds && bxSpirit(f) - BX_SPIRIT.sp < BX_SPIRIT.ult && !hurt) continue;
    const p = suits(P.when) ? .05 + skill * .04 : skill === 0 ? .02 : 0;
    if (R() < p) return bxCast(f, which);
  }
  return false;
}
// what the page shows of a fighter's powers: { sp, ult } with name, description and whether it can go now
function bxPowState(f) {
  const one = which => { const P = bxPowOf(f, which); if (!P) return null; const c = bxCanCast(f, which); return { id: P.id, n: P.n, desc: P.desc, ok: c.ok, why: c.why, used: which === 'sp' ? f.spUsed === G.round : !!f.ultUsed }; };
  return { sp: one('sp'), ult: one('ult'), pick: f.spPick || 'sp', spirit: Math.round(bxSpirit(f)), need: Object.assign({}, { sp: BX_SPIRIT.sp, ult: BX_SPIRIT.ult }), max: BX_SPIRIT.max,
    fx: (f.fx || []).map(s => ({ id: s.id, n: s.n, t: Math.round(s.t * 10) / 10 })) };
}
