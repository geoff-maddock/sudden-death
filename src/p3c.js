/* p3c: the sports front office. Sport glyphs, the published schedule, and the Practice track. */
// tiny glyphs for each sport (24×24 viewBox), used on the map, cards and panels
const SPORT_GLYPH = {
  baseball: '<circle cx="12" cy="12" r="8" fill="#f2ead8" stroke="#21160f" stroke-width="1.5"/><path d="M7 7c2 3 2 7 0 10M17 7c-2 3-2 7 0 10" fill="none" stroke="#c2264a" stroke-width="1.3"/>',
  football: '<ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-30 12 12)" fill="#8a4a22" stroke="#21160f" stroke-width="1.5"/><path d="M9 14l6-4M10 11.5l1 1.5M12 10.5l1 1.5M14 9.5l1 1.5" stroke="#f2ead8" stroke-width="1.2"/>',
  hockey: '<path d="M6 4l5 12h7" fill="none" stroke="#c9a36a" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="17" cy="19" rx="4" ry="1.8" fill="#21160f"/>',
  basketball: '<circle cx="12" cy="12" r="8" fill="#e0742a" stroke="#21160f" stroke-width="1.5"/><path d="M4 12h16M12 4v16M6.5 6.5c3 3 3 8 0 11M17.5 6.5c-3 3-3 8 0 11" fill="none" stroke="#21160f" stroke-width="1"/>',
  golf: '<path d="M8 20V4" stroke="#efe4cc" stroke-width="1.8"/><path d="M8 4l9 3-9 3z" fill="#e0533a"/><circle cx="15" cy="19" r="2.2" fill="#f2ead8" stroke="#21160f"/>',
  bowling: '<path d="M12 3c2 0 2.5 2 1.8 4-.6 1.6 2.7 3.8 2.7 8 0 3.5-2 6-4.5 6s-4.5-2.5-4.5-6c0-4.2 3.3-6.4 2.7-8C9.5 5 10 3 12 3z" fill="#f2ead8" stroke="#21160f" stroke-width="1.4"/><path d="M10.3 8.5h3.4" stroke="#c2264a" stroke-width="1.4"/>',
  jousting: '<path d="M3 21L17 7" stroke="#c9a36a" stroke-width="2.4" stroke-linecap="round"/><path d="M15 5l5-2-2 5z" fill="#efe4cc" stroke="#21160f"/><path d="M6 15l3 3" stroke="#21160f" stroke-width="3"/>',
  curling: '<ellipse cx="12" cy="16" rx="8" ry="4" fill="#8a8a92" stroke="#21160f" stroke-width="1.4"/><path d="M12 12V7h5" fill="none" stroke="#e0533a" stroke-width="2.2" stroke-linecap="round"/>',
  boxing: '<path d="M7 9c0-3 2-5 6-5s6 3 6 7c0 3-1 5-3 6v3H9v-3c-2-1-2-3-2-5z" fill="#c2264a" stroke="#21160f" stroke-width="1.4"/><path d="M7 11c-2 0-3 1-3 2s1 2 3 2" fill="#c2264a" stroke="#21160f" stroke-width="1.2"/>',
};
const sportSVG = (s, size = 18) => SPORT_GLYPH[s] ? `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${SPORT_GLYPH[s]}</svg>` : '';
const ACT_HOME = ['baseball', 'hockey', 'football'];

/* The schedule: every fight room has its sport decided when the map is drawn, so you can route toward the
   games your deck is built for. Each act leans on its home sport. */
function scheduleMap(nodes, act) {
  for (const n of Object.values(nodes)) if (['fight', 'elite', 'rival'].includes(n.t) && !n.sport) n.sport = wpick(ACT_SPORTS[act]);
  return nodes;
}
function scheduleCounts() {
  const c = {}; for (const n of Object.values(RUN.map.nodes)) if (n.sport && !RUN.path.includes(n.k)) c[n.sport] = (c[n.sport] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}

/* Practice: a second, separate upgrade track. A practiced card (★) is better at the game, not the fight:
   what that means depends on the sport. */
const PRACTICE = {
  baseball: 'Hits go one base further (an out with any damage is a single).',
  football: 'Gains 50% more yards.',
  hockey: 'Scores a goal at 9+ damage (5+ on a Stunned enemy).',
  basketball: 'Scores at 6+ damage, and 10+ is a three from any distance.',
  golf: 'A long drive at 14+ damage.',
  bowling: 'Attacks deal 2 more damage per hit (pin action).',
  jousting: 'Shatters a lance at 9+ damage.',
  curling: 'Each practiced Skill this turn lowers the house to 3 less Block (down to 6).',
  boxing: 'Damage counts 50% more on the judges’ cards.',
};
const practicable = c => !c.sk && !['junk', 'curse', 'status'].includes(CARDS[c.id].type);
const SKT = c => {
  const T = c && c.sk
    ? { hit: 1, yards: 1.5, goal: 9, pp: 5, bk: 6, three: 10, threeAny: true, drive: 14, lance: 9, box: 1.5, bowl: 2 }
    : { hit: 0, yards: 1, goal: 12, pp: 6, bk: 8, three: 12, threeAny: false, drive: 20, lance: 12, box: 1, bowl: 0 };
  // an enemy Stopper makes every way of scoring harder
  if (typeof perkOn === 'function' && perkOn('stopper')) { T.hit -= 1; T.yards *= .75; T.goal += 3; T.pp += 2; T.bk += 3; T.three += 3; T.drive += 4; T.lance += 3; T.box *= .8; }
  return T;
};
function practiceTip() { return Object.entries(PRACTICE).map(([s, t]) => `<b>${SPORT_NAME[s]}</b>: ${t}`).join('<br>'); }

/* Archetype cards for the sports that had almost none. Each sport now has a way to build for it. */
// golf: few, efficient turns: big single hits and draw
K('golf_driver', 'Driver', 'any', 'atk', 2, 'u', 'one', [['d', 22]], { sport: 'golf', home: [['freestroke']], fl: 'Fore. Mostly.' });
K('golf_chip', 'Chip Shot', 'any', 'skl', 0, 'c', 'self', [['draw', 2]], { sport: 'golf', fl: 'Soft hands.' });
K('golf_putt', 'Lag Putt', 'any', 'atk', 1, 'c', 'one', [['d', 8], ['draw', 1]], { sport: 'golf', fl: 'Inside the leather.' });
K('golf_caddie', 'Caddie’s Read', 'any', 'skl', 1, 'u', 'self', [['b', 6], ['s', 'drawnext', 2, 'self']], { sport: 'golf', fl: 'Breaks left. Everything breaks left.' });
K('golf_eagle', 'Eagle Eye', 'any', 'atk', 1, 'r', 'one', [['d', 14], ['s', 'vuln', 2]], { sport: 'golf', home: [['freestroke']], fl: 'Two under, and smug about it.' });
// bowling: hit the whole lineup
K('bwl_roll', 'Rolling Thunder', 'any', 'atk', 1, 'c', 'all', [['d', 5]], { sport: 'bowling', fl: 'Heard it from the parking lot.' });
K('bwl_hook', 'Hook Shot', 'any', 'atk', 2, 'u', 'all', [['d', 7], ['s', 'weak', 1, 'all']], { sport: 'bowling', fl: 'Breaks late into the pocket.' });
K('bwl_pinsetter', 'Pinsetter', 'any', 'skl', 1, 'c', 'self', [['b', 6], ['draw', 1]], { sport: 'bowling', fl: 'Reset. Again.' });
K('bwl_spare', 'Pick Up the Spare', 'any', 'atk', 1, 'u', 'all', [['d', 4, 2]], { sport: 'bowling', home: [['nrg', 1]], fl: 'Nobody cheers for a spare. Nobody.' });
K('bwl_gutter', 'Gutter Ball', 'any', 'atk', 0, 'c', 'all', [['d', 3]], { sport: 'bowling', fl: 'Still counts as a roll.' });
// jousting: one huge opener each turn (the tilt doubles your first Attack)
K('jst_gallop', 'Full Gallop', 'any', 'atk', 2, 'c', 'one', [['d', 16]], { sport: 'jousting', fl: 'The ground shakes. So does the knight.' });
K('jst_visor', 'Lower the Visor', 'any', 'skl', 1, 'c', 'self', [['b', 8]], { sport: 'jousting', fl: 'Eyes on the lance.' });
K('jst_couched', 'Couched Charge', 'any', 'atk', 1, 'u', 'one', [['d', 11], ['s', 'weak', 1]], { sport: 'jousting', fl: 'Braced, aimed, delivered.' });
K('jst_champion', 'Tourney Champion', 'any', 'pow', 2, 'r', 'self', [['s', 'str', 2, 'self']], { sport: 'jousting', fl: 'Ribbons on the lance, blood on the sand.' });
K('jst_unhorse', 'Unhorse', 'any', 'atk', 2, 'u', 'one', [['d', 12], ['s', 'stun', 1]], { sport: 'jousting', fl: 'Down in the dirt, armour and all.' });
// curling: hold cards, keep Block, build the house
K('crl_guard', 'Guard Stone', 'any', 'skl', 1, 'c', 'self', [['b', 8]], { sport: 'curling', retain: 1, fl: 'Sits in front. Waits.' });
K('crl_takeout', 'Takeout', 'any', 'atk', 1, 'c', 'one', [['d', 6], ['b', 4]], { sport: 'curling', fl: 'Knocked clean out of the house.' });
K('crl_button', 'Draw to the Button', 'any', 'skl', 2, 'u', 'self', [['b', 14]], { sport: 'curling', fl: 'Dead centre.' });
K('crl_hammer', 'Last Rock', 'any', 'atk', 2, 'r', 'one', [['d', 10], ['b', 10]], { sport: 'curling', retain: 1, fl: 'You have the hammer.' });
K('crl_broom', 'Broom Work', 'any', 'skl', 0, 'c', 'self', [['b', 3], ['draw', 1]], { sport: 'curling', fl: 'Heat the ice. Guide the stone.' });
// boxing: steady damage and taking rounds
K('box_jab', 'Jab', 'any', 'atk', 0, 'c', 'one', [['d', 4]], { sport: 'boxing', fl: 'Keep it working.' });
K('box_onetwo', 'One-Two', 'any', 'atk', 1, 'c', 'one', [['d', 5, 2]], { sport: 'boxing', fl: 'Textbook.' });
K('box_clinch', 'Clinch', 'any', 'skl', 1, 'c', 'one', [['b', 7], ['s', 'weak', 1]], { sport: 'boxing', fl: 'Tie them up. Catch your breath.' });
K('box_uppercut', 'Uppercut', 'any', 'atk', 2, 'u', 'one', [['d', 14], ['s', 'vuln', 1]], { sport: 'boxing', fl: 'From the floorboards.' });
K('box_rope', 'Rope-a-Dope', 'any', 'skl', 1, 'u', 'self', [['b', 12], ['s', 'drawnext', 1, 'self']], { sport: 'boxing', fl: 'Let them punch themselves out.' });

/* What a card is good at, worked out from what it does. Shown on the card as small sport glyphs. */
function sportFits(d) {
  if (!d || ['junk', 'curse', 'status'].includes(d.type)) return [];
  let top = 0, hits = 0, all = false, blk = 0, draw = 0;
  const walk = ops => { for (const o of ops || []) {
    if (o[0] === 'd') { top = Math.max(top, o[1] * (o[2] || 1)); hits += o[2] || 1; if ((o[3] || d.tgt) === 'all') all = true; }
    if (o[0] === 'b') blk += o[1]; if (o[0] === 'draw') draw += o[1];
    if (o[0] === 'roll') { walk(o[2]); } } };
  walk(d.fx);
  const score = {};
  const add = (s, n) => score[s] = (score[s] || 0) + n;
  if (d.sport) add(d.sport, 6);
  if (all) add('bowling', 5);
  if (top >= 20) add('golf', 4);
  if (top >= 12) { add('hockey', 4); add('jousting', 3); }
  if (top >= 8) add('basketball', 2);
  if (top > 0 && d.cost <= 1) { add('baseball', 3); add('basketball', 2); }
  if (hits >= 2) add('boxing', 3);
  if (top > 0) add('boxing', 1);
  if (blk >= 6) { add('football', 3); add('curling', 3); }
  if (d.retain) add('curling', 3);
  if (draw) add('golf', 2);
  if (top >= 14) add('football', 2);
  return Object.entries(score).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);
}
