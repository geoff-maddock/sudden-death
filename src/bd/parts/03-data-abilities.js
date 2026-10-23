/* ================= data: abilities ================= */
const AB = {
  // batting (chosen as a stance before the pitch)
  bunt:    { name: 'Dirty Bunt',   type: 'bat', cost: 1, desc: 'Squares around. Any swing in time drops a soft roller down the third-base line.' },
  axe:     { name: 'Battle Axe',   type: 'bat', cost: 2, desc: 'Swings the two-handed axe for real. Sweet spot ×1.6, power +25%.' },
  crush:   { name: 'Club Crush',   type: 'bat', cost: 1, desc: 'All or nothing. Power +50%, sweet spot −20%.' },
  seismic: { name: 'Seismic Swing',type: 'bat', cost: 2, desc: 'On a fair hit the ground heaves and every fielder staggers for 1.5 s.' },
  shriek:  { name: 'Shriek',       type: 'bat', cost: 1, desc: 'Screams at the mound. The pitch scatters three times as wide.' },
  eagle:   { name: 'Eagle Eye',    type: 'bat', cost: 1, desc: 'Marks where the pitch will cross the plate the moment it leaves the hand.' },
  dispel:  { name: 'Dispel',       type: 'bat', cost: 1, desc: 'Strips the magic off the pitch. Sweet spot +15%.' },
  undying: { name: 'Undying',      type: 'bat', cost: 1, desc: 'If this pitch would be strike three, it counts as a foul instead.' },
  gaze:    { name: 'Stone Gaze',   type: 'bat', cost: 1, desc: 'Stares down the ball: it slows 30% and loses most of its break.' },
  sticky:  { name: 'Sticky Bat',   type: 'bat', cost: 1, desc: 'Webbed barrel. Sweet spot +40%, power −20%.' },
  pact:    { name: 'Blood Pact',   type: 'bat', cost: 2, desc: 'Power +40%, sweet spot +10%.' },
  // running (cast during a play on the picked runner)
  shadowstep: { name: 'Shadowstep',  type: 'run', cost: 2, desc: 'Blinks instantly to the next base.' },
  sprint:     { name: 'Wolf Sprint', type: 'run', cost: 1, desc: 'Drops to all fours: speed ×2 for 2.5 s.' },
  bullrush:   { name: 'Bull Rush',   type: 'run', cost: 1, desc: 'For 4 s any tag must roll d20 11+ or the fielder is trampled and drops the ball.' },
  stoneskin:  { name: 'Stone Skin',  type: 'run', cost: 0, passive: true, desc: 'Passive. Immune to fielder spells, and far too crunchy to eat.' },
  fleet:      { name: 'Fleet Foot',  type: 'run', cost: 1, desc: 'Speed ×1.6 for 3 s.' },
  invis:      { name: 'Invisibility',type: 'run', cost: 2, desc: 'Vanishes for 3 s: cannot be tagged, forced or thrown at.' },
  swarm:      { name: 'Bat Swarm',   type: 'run', cost: 2, desc: 'Bursts into bats for 2.5 s: untaggable, speed ×1.4.' },
  glide:      { name: 'Glide',       type: 'run', cost: 1, desc: 'Spreads her wings: speed ×1.5 for 3 s.' },
  // fielding (cast during a play)
  devour:  { name: 'Devour',          type: 'field', cost: 3, desc: 'Eats a runner within 22 ft. d20 12+ between bases, 16+ on a base. On a miss he chokes, stunned 2.5 s. Once per inning.' },
  pounce:  { name: 'Pounce',          type: 'field', cost: 1, desc: 'Leaps 45 ft toward the ball.' },
  boulder: { name: 'Boulder Arm',     type: 'field', cost: 1, desc: 'The next throw by any fielder flies 2.2× faster.' },
  quake:   { name: 'Quake',           type: 'field', cost: 2, desc: 'Stomps. Every runner stumbles for 1.3 s.' },
  flight:  { name: 'Take Flight',     type: 'field', cost: 1, desc: 'Airborne for 4 s: double speed and can snatch balls 25 ft up, over the fence.' },
  haunt:   { name: 'Haunt',           type: 'field', cost: 1, desc: 'The nearest moving runner panics and runs backward for 1.2 s.' },
  mesmer:  { name: 'Mesmerize',       type: 'field', cost: 2, desc: 'Freezes a moving runner within 120 ft for 1.8 s.' },
  telek:   { name: 'Telekinesis',     type: 'field', cost: 1, desc: 'The next throw arrives instantly.' },
  petrify: { name: 'Petrify',         type: 'field', cost: 2, desc: 'Gazes at a moving runner: d20 10+ turns them to stone for 3 s.' },
  web:     { name: 'Web',             type: 'field', cost: 1, desc: 'Snares a moving runner within 140 ft: 30% speed for 3 s.' },
  block:   { name: 'Block the Plate', type: 'field', cost: 1, desc: 'For this play, a runner reaching home must roll d20 11+ or be tagged out.' },
  // physical skills: for players without magic of that kind. No mana, but they cost stamina.
  choke:     { name: 'Choke Up',       type: 'pbat',   stam: 6,  phys: true, desc: 'Shortens up on the handle: sweet spot +30%, power −10%.' },
  uppercut:  { name: 'Uppercut',       type: 'pbat',   stam: 8,  phys: true, desc: 'Swings up through the ball: launch +12°, power +15%. Built for fly balls.' },
  slap:      { name: 'Slap Hit',       type: 'pbat',   stam: 5,  phys: true, desc: 'Slaps it into the dirt: timing window +40%, power −30%, always on the ground.' },
  grip:      { name: 'Iron Grip',      type: 'pbat',   stam: 8,  phys: true, desc: 'Squeezes the handle to splinters: power +25%, sweet spot −5%.' },
  burst:     { name: 'Burst',          type: 'prun',   stam: 8,  phys: true, desc: 'Explosive strides: speed ×1.6 for 1.2 s.' },
  hookslide: { name: 'Hook Slide',     type: 'prun',   stam: 6,  phys: true, desc: 'Slides around the next tag within 2 s: the fielder needs d20 12+ to make it.' },
  barrel:    { name: 'Barrel Through', type: 'prun',   stam: 9,  phys: true, desc: 'Lowers a shoulder for 2 s: a tag must roll d20 9+ or the fielder drops the ball.' },
  dive:      { name: 'Diving Catch',   type: 'pfield', stam: 10, phys: true, desc: 'The fielder chasing the ball lays out 25 ft toward it.' },
  leap:      { name: 'Leaping Grab',   type: 'pfield', stam: 8,  phys: true, desc: 'For 2 s the fielder chasing the ball reaches 8 ft higher, enough to rob the wall.' },
  rocket:    { name: 'Rocket Arm',     type: 'pfield', stam: 8,  phys: true, desc: 'The fielder holding the ball puts everything into it: next throw ×1.5 speed.' },
  // club magic: every team can cast these, once per play, from the dugout (no stamina cost)
  haste:      { name: 'Haste',          type: 'trun',   cost: 1, club: true, desc: 'The dugout shaman quickens your picked runner: speed ×1.5 for 2.5 s.' },
  ghostslide: { name: 'Ghost Slide',    type: 'trun',   cost: 2, club: true, desc: 'Your picked runner turns to mist for 1.5 s and cannot be tagged.' },
  gust:       { name: 'Tailwind',       type: 'tfield', cost: 1, club: true, desc: 'The next throw by any fielder flies ×1.8 faster.' },
  roots:      { name: 'Grasping Roots', type: 'tfield', cost: 2, club: true, desc: 'Roots seize the lead runner who is advancing: 40% speed for 2 s.' },
};

/* ability tiers, costs and item perks (season upgrades) */
const tierOf = (p, type) => (p && p.tiers && p.tiers[type]) || 1;
function abCost(p, id) {
  const A = AB[id]; if (!A || !A.cost) return 0;
  let c = A.cost >= 2 ? Math.max(1, A.cost - (tierOf(p, A.type) - 1)) : A.cost;
  if (p && p.discount) c = Math.max(1, c - p.discount);
  return c;
}
const abPow = (p, id) => (1 + .3 * (tierOf(p, AB[id].type) - 1)) * (typeof moonSpell === 'function' && MOON ? moonSpell(id) : 1);
function pitchCost(p, pd) { if (!pd.cost) return 0; let c = Math.max(1, pd.cost - (tierOf(p, 'pitch') - 1)); if (p && p.discount) c = Math.max(1, c - p.discount); return c; }
const luck = p => (p && p.luck) || 0;
// which physical skill a player falls back on, by category, decided by their current stats
function physOf(p, cat) {
  if (!p) return null;
  if (cat === 'bat') { if (p.bat) return null; return p.pow >= 8 ? 'uppercut' : p.con >= 7 ? 'choke' : p.spd >= 8 ? 'slap' : 'grip'; }
  if (cat === 'run') { if (p.run && !AB[p.run].passive) return null; return p.spd >= 7 ? 'burst' : p.pow >= 8 ? 'barrel' : 'hookslide'; }
  if (cat === 'field') { if (p.field) return null; return p.arm >= 8 ? 'rocket' : (p.fld >= 8 || p.spd >= 8) ? 'dive' : 'leap'; }
  return null;
}

