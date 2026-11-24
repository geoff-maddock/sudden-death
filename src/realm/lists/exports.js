/* the end of the wJT scope: what the Realm may call (w19b-engines.js). Phase 0 is the rules: newMatch(opts) starts a
   match ({ courses: 3 | 5, riders: [each side's two riders, as roster indexes], roster: [two roster sizes], best:
   [the slot, 0 or 1, of each side's rider for the tilt for the crown; left out, the one who scored more] }); riders()
   (who rides the course now, a roster index a side; null when over), inTilt, left (courses still to ride this heat),
   course([side 0's strike, side 1's]) scores a course (a strike is { at, unhorse }: at one of rules.pts' keys; ends a
   heat on an unhorsing or its last course, starts the tilt when level, ends the match, and says so), whyNot(res);
   strikePts, fair, foul and atText read a strike; heatTotal(s, h), total(s), board() (the tourney board), matchText(s).
   rules and at (the herald's words) are the tables. G is the match, plain JSON. The page comes in phase 2: until then
   the lists are never on. */
return {
  rules: JSON.parse(JSON.stringify(JT_RULES)), at: JSON.parse(JSON.stringify(JT_AT)), get G() { return G; },
  newMatch: o => jtNewMatch(o), riders: () => jtRiders(), inTilt: () => jtInTilt(), left: () => jtLeft(),
  course: res => jtCourse(res), whyNot: res => jtWhyNot(res),
  strikePts: st => jtStrikePts(st), fair: at => jtFair(at), foul: at => jtFoul(at), atText: st => jtAtText(st),
  heatTotal: (s, h) => jtHeatTotal(s, h), total: s => jtTotal(s), board: () => jtBoard(), matchText: s => jtMatchText(s),
  show: () => {}, hide: () => {}, get on() { return false; }
};
