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

