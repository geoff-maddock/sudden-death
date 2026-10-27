/* ================= Injuries: rare, sometimes serious, set by level ================= */
// Rule "injuries": off / rare (default) / normal / frequent. It scales health damage and the odds of an injury.
// Injuries come from risky moves: physical skills, max effort, gassed pitchers, collisions at the bag,
// spells biting back on their caster, and spells that hit a runner (webs, petrify, haunting, sleep).
// A minor injury costs some health. A major one costs a lot, and in a season the player sits out 1-3 games.
// In a season, anyone under SIT_HP health also has to sit until he heals.
var INJ = {
  mult: { off: 0, rare: .7, normal: 1, frequent: 1.3 },      // health damage
  odds: { off: 0, rare: .25, normal: .6, frequent: 1.2 },
  gate: { off: 0, rare: .35, normal: .7, frequent: 1 },      // share of knocks (pitches, fire, trampling) that actually hurt        // chance of an injury from a risky moment
  major: { off: 0, rare: .08, normal: .2, frequent: .3 },    // share of injuries that are major
  heal: { off: 100, rare: 45, normal: 35, frequent: 25 },    // health back after a season game played
};
var SIT_HP = 30;
function injLevel() { const v = rule('injuries'); return v === true ? 'rare' : v === false || v == null ? 'off' : INJ.mult[v] != null ? v : 'rare'; }
function injOn() { return injLevel() !== 'off'; }
// rule definition: replace the old on/off switch with a level
{ const d = RULE_DEFS.find(x => x.k === 'injuries');
  if (d) Object.assign(d, { label: 'Injuries', opts: [['off', 'Off'], ['rare', 'Rare'], ['normal', 'Occasional'], ['frequent', 'Frequent']], def: 'rare',
    help: 'How often players get hurt: by fire, gas, collisions, big efforts, and spells that bite back or hit them. A major injury sidelines a season player for 1-3 games. Off: nobody gets hurt.' });
  if (SET.injuries === true) SET.injuries = 'rare'; else if (SET.injuries === false) SET.injuries = 'off';
  if (NEXT && typeof NEXT.injuries === 'boolean') NEXT.injuries = NEXT.injuries ? 'rare' : 'off';
}
const INJ_PARTS = {
  strain: ['pulls a hamstring', 'tweaks a knee', 'strains a calf', 'rolls an ankle', 'wrenches a shoulder'],
  swing: ['tweaks a wrist', 'wrenches his back', 'strains an oblique'],
  arm: ['feels a twinge in the elbow', 'strains the shoulder', 'blisters the throwing claw'],
  backlash: ['is burned by his own spell', 'takes the spell\'s backlash', 'is drained by the casting'],
  collide: ['takes a knee to the ribs at the bag', 'jams a wrist sliding in', 'is spiked on the tag'],
};
// roll for an injury: base chance, scaled by the level and by fatigue
function injRisk(p, base, kind, why) {
  if (!p || !G.teams || !injOn() || p.ko > 0) return false;
  const tired = 1 + 1.5 * (1 - fatigue(p));
  if (R() >= base * INJ.odds[injLevel()] * tired) return false;
  injure(p, kind, why);
  return true;
}
function injure(p, kind, why) {
  const lv = injLevel(), major = R() < INJ.major[lv];
  const what = pick(INJ_PARTS[kind] || INJ_PARTS.strain);
  if (major) {
    const games = 1 + (R() * 3 | 0);
    p.major = { games, what };
    const d = hurt(p, 32 + R() * 14, what, { noKO: true, raw: true, quiet: true }); pst(p).inj++;
    useTag('hurt', `${shortName(p)}: major injury`); addFx('callout', { text: `${shortName(p)}: major injury −${d}`, col: '#ff6a5a' });
    banner('Major injury', `${p.n} ${what}${G.season ? ` · out ${games} game${games > 1 ? 's' : ''} after this one` : ''}`, 1.8);
    logLine(`${p.n} ${what}${why ? ' (' + why + ')' : ''}: a major injury (−${d} health, ${Math.round(p.hp)} left)${G.season ? `. He will sit out ${games} game${games > 1 ? 's' : ''} after this one` : ''}.`, true);
  } else hurt(p, 8 + R() * 8, `${what}${why ? ' (' + why + ')' : ''}`, { noKO: true, raw: true });
}

/* ---------- where the risk comes from ---------- */
const abCount = (p, id) => (G.pstats && G.pstats.get(p) && G.pstats.get(p).abil[id]) || 0;
// physical skills during a play
const PHYS_RISK = { burst: .04, barrel: .05, hookslide: .035, dive: .03, leap: .035, rocket: .035 };
{ const o = castPhysRun; castPhysRun = function (ob, r) { const ok = o.apply(this, arguments); if (ok && r) injRisk(r.p, PHYS_RISK[ob.id] || .05, 'strain', AB[ob.id].name); return ok; }; }
{ const o = castPhysField; castPhysField = function (ob) { const f = ob && ob.f, n0 = f ? abCount(f.p, ob.ab) : 0; o.apply(this, arguments); if (f && abCount(f.p, ob.ab) > n0) injRisk(f.p, PHYS_RISK[ob.ab] || .05, ob.ab === 'rocket' ? 'arm' : 'strain', AB[ob.ab].name); }; }
// runner spells: backlash on the caster; the physical ones can strain
{ const o = castRun; castRun = function (r) { const ok = o.apply(this, arguments); if (ok && r) { const ab = r.p.run; if (ab === 'bullrush') injRisk(r.p, .05, 'collide', 'Bull Rush'); else if (['sprint', 'fleet', 'glide'].includes(ab)) injRisk(r.p, .03, 'strain', AB[ab].name); else injRisk(r.p, .012 * abCost(r.p, ab), 'backlash', AB[ab].name); } return ok; }; }
// fielder spells: backlash, and spells that hit a runner can hurt him
const HIT_SPELL = { web: [.14, 'tangled in the web', 7], petrify: [.2, 'a chunk chipped off while he was stone', 10], haunt: [.1, 'fell over fleeing the ghost', 7], mesmer: [.06, 'dropped face-first while mesmerized', 6] };
{ const o = castField; castField = function (ob) {
  if (!ob || ob.ult || ob.team || ob.phys) return o.apply(this, arguments);
  const f = ob.f, n0 = f ? abCount(f.p, ob.ab) : 0; o.apply(this, arguments);
  if (!f || abCount(f.p, ob.ab) <= n0) return;
  injRisk(f.p, .012 * (ob.cost || 1), 'backlash', AB[ob.ab].name);
  const h = HIT_SPELL[ob.ab], t = ob.target;
  if (h && t && injOn() && (ob.ab !== 'petrify' || t.fx.stone > 0) && R() < h[0] * INJ.odds[injLevel()]) hurt(t.p, h[2], h[1]);
  if (ob.ab === 'pounce' || ob.ab === 'flight') injRisk(f.p, .04, 'strain', AB[ob.ab].name);
}; }
// ultimates bite back a little more often
{ const o = castRunUlt; castRunUlt = function (ob, r) { const res = o.apply(this, arguments); if (r && r.p) injRisk(r.p, .04, 'backlash', 'an ultimate'); return res; }; }
{ const o = castFieldUlt; castFieldUlt = function (ob) { const who = ob && ob.f ? ob.f.p : null; const res = o.apply(this, arguments); if (who) injRisk(who, .04, 'backlash', 'an ultimate'); return res; }; }
// at the release: batting skills and spells, the pitcher's effort, gassed arms, magic pitches
{ const o = release; release = function () {
  o.apply(this, arguments);
  const P = G.P, pc = P && P.pitch; if (!pc || !G.teams) return;
  const bat = batter(), pt = pitcher();
  if (pc.skill) injRisk(bat, .03, 'swing', AB[pc.skill].name);
  if (pc.ab) injRisk(bat, pc.ab === 'pact' ? .06 : .01 * abCost(bat, pc.ab), 'backlash', AB[pc.ab].name);
  if (pc.stance === 'ult') injRisk(bat, .04, 'backlash', 'an ultimate');
  if (pc.ab === 'axe' || pc.ab === 'crush') { const c = FT().def.roster.find(x => x.pos === 'C'); if (c && injOn() && R() < .04 * INJ.odds[injLevel()]) hurt(c, 8, `clipped by ${shortName(bat)}'s backswing`); }
  if (pc.ab === 'shriek' && injOn() && R() < .06 * INJ.odds[injLevel()]) hurt(pt, 6, 'ears ringing from the shriek');
  if (pc.eff > .5) injRisk(pt, .02, 'arm', 'a max-effort pitch');
  if (fatigue(pt) < .2) injRisk(pt, .03, 'arm', 'pitching gassed');
  if (pc.magic && !pc.ult) injRisk(pt, .01 * (PITCHES[pc.key] ? PITCHES[pc.key].cost || 1 : 1), 'backlash', pc.name);
}; }
// collisions on tag plays
{ const o = outRunner; outRunner = function (r, how, f) { const was = r && r.out; o.apply(this, arguments); if (!was && r && r.out && how === 'tag' && f && injOn() && R() < .03 * INJ.odds[injLevel()]) injure(R() < .6 ? r.p : f.p, 'collide', 'a play at the bag'); }; }

/* ---------- a season: sitting out ---------- */
function injuredOut(p) { return p && ((p.out && p.out.games > 0) || (injOn() && (p.hp ?? 100) < SIT_HP)); }
function injuryNote(p) { if (!p) return ''; if (p.out && p.out.games > 0) return `injured (${p.out.what}): out ${p.out.games} more game${p.out.games > 1 ? 's' : ''}`; if (injOn() && (p.hp ?? 100) < SIT_HP) return `too hurt to play (health ${Math.round(p.hp)})`; return ''; }
// after a season game: record major injuries and count down the ones on the bench
function injAfterSeasonGame(played) {
  for (const sp of S.players) {
    const g = played.get(sp.id);
    if (g && g.major) { sp.out = { games: g.major.games, what: g.major.what }; sp.hp = Math.min(sp.hp ?? 100, 40); seasonLog(`${sp.n} ${g.major.what} and is out for ${g.major.games} game${g.major.games > 1 ? 's' : ''}.`); }
    else if (sp.out && sp.out.games > 0) { sp.out.games--; if (!sp.out.games) { seasonLog(`${sp.n} is healthy again.`); sp.out = null; } }
  }
}
// lineup check: an injured starter must be swapped out, if there's anyone healthy to take his place
{ const o = lineupProblems; lineupProblems = function () {
  const probs = o.apply(this, arguments);
  if (!injOn()) return probs;
  for (const l of S.lineup) {
    const p = SP(l.id); if (!injuredOut(p)) continue;
    const bp = S.bench.map(SP).filter(q => q.pitches).length;
    const subs = S.bench.map(SP).filter(b => !injuredOut(b) && (l.pos === 'P' ? b.pitches : !b.pitches || bp > 1));
    if (subs.length) probs.push(`${p.n} is ${injuryNote(p)}. Sub someone in at ${l.pos}.`);
  }
  return probs;
}; }
