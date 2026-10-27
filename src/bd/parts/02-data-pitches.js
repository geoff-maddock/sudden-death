/* ================= data: pitches ================= */
// times in seconds from release to plate; breaks in feet (sign flips for lefties)
const PITCHES = {
  heater:   { name: 'Heater',       T: .47, bx: .06, bh: -.05, ctrl: .13, cost: 0, desc: 'Straight gas.' },
  slider:   { name: 'Slider',       T: .57, bx: .55, bh: -.25, ctrl: .16, cost: 0, desc: 'Late, hard sideways bite.' },
  change:   { name: 'Changeup',     T: .80, bx: .12, bh: -.35, ctrl: .14, cost: 0, desc: 'Looks like a heater, arrives next week.' },
  fireball: { name: 'Fireball',     T: .39, bx: 0,   bh: 0,    ctrl: .22, cost: 2, magic: true, fx: 'fire', desc: 'Fastest pitch in the league. Any contact risks a scorched bat: d20 + CON vs 16 or power is halved.' },
  meteor:   { name: 'Meteor',       T: .66, bx: 0,   bh: -.1,  ctrl: .20, cost: 2, magic: true, fx: 'meteor', desc: 'Called down from the sky. Plunges almost straight through the zone.' },
  fastball: { name: 'Fastball',     T: .50, bx: .05, bh: -.05, ctrl: .12, cost: 0, desc: 'Cold and straight.' },
  curve:    { name: 'Curveball',    T: .72, bx: .35, bh: -.80, ctrl: .17, cost: 0, desc: 'Big twelve-to-six drop.' },
  frost:    { name: 'Frost Orb',    T: .55, bx: .1,  bh: -.1,  ctrl: .15, cost: 1, magic: true, fx: 'frost', desc: 'Numbs the hitter: the swing cursor crawls at 35% speed, and the orb brakes late.' },
  hex:      { name: 'Hex Knuckler', T: .62, bx: 0,   bh: 0,    ctrl: .10, cost: 1, magic: true, fx: 'hex', desc: 'A cursed wobble. Even the witch does not know where it lands.' },
  phantom:  { name: 'Phantom',      T: .52, bx: .1,  bh: -.1,  ctrl: .14, cost: 2, magic: true, fx: 'phantom', desc: 'Vanishes after release and reappears just before the plate.' },
};

