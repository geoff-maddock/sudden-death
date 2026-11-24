/* The Tilting Lists: the rules (issue #117, phase 0), as pure functions on a plain-JSON match (G). The Realm takes the
   engine inside a scope (src/realm/lists/manifest.txt, through `scope wJT ...`), so none of these names reach the page.

   A match is a tourney between two clubs. Each side names two riders (the rest of its four squire). Each side's first
   rider meets the other side's first in a heat of JT_RULES.courses courses (3, or 5 by option), then the second riders
   ride the second heat. A course is one pass down the tilt: both riders strike in the same instant, so both can score.
   A strike is where the lance landed (JT_RULES.pts):
   - broken on the shield or the body: 1; broken on the helm: 2; a glance or a miss: nothing;
   - a foul (the mount, the barrier, or below the belt): a point off (-1), and it breaks nothing;
   - an unhorsing (a fair strike, on the shield, body or helm, that throws the other rider): 3 in place of the break's
     points, and the heat ends there. The unhorsed rider's remaining courses score nothing, and nor do the other's:
     the heat's courses not ridden stay empty (null). Both riders can be unhorsed in the same course.
   Points from both heats are added. Level after both heats: the tilt for the crown, one course at a time between
   each side's best rider (opts.best, or the side's rider who scored more in their heat, the first heat's on a tie),
   until a course leaves the totals apart. A match can't end level. The rules don't cap the tilt: the model (phase 1)
   makes a course that scores nothing rare, and the sim stops a runaway.

   G: { courses, riders: [2 × two roster indexes], roster: [2 × size], best: [2 × rider slot 0 | 1 | null], heat (0 or
   1; 2 in the tilt), course (0-based within the heat; the tilt's courses count on), sc: [side][heat] = [points by
   course, null when not ridden], tilt: [[points by tilt course], [...]], crown: [2 × roster index] in the tilt,
   ended: [per heat: null | { course (1-based), unhorsed: [sides] }], log: [{ heat, course, tilt, at: [2], unhorse:
   [2], pts: [2] }], over }. */
const JT_RULES = { heats: 2, courses: 3, coursesAt: [3, 5], riders: 2, side: 4, unhorse: 3,
  pts: { shield: 1, body: 1, helm: 2, glance: 0, miss: 0, mount: -1, barrier: -1, low: -1 },
  fair: ['shield', 'body', 'helm'], fouls: ['mount', 'barrier', 'low'] };
// what each strike is, in the herald's words
const JT_AT = { shield: 'a lance broken on the shield', body: 'a lance broken on the body', helm: 'a lance broken on the helm',
  glance: 'a glance', miss: 'a miss', mount: 'a foul: the mount struck', barrier: 'a foul: the barrier struck', low: 'a foul: a strike below the belt' };
let G = null;

function jtRidersOk(r, n) { return Array.isArray(r) && r.length === JT_RULES.riders && new Set(r).size === r.length && r.every(i => Number.isInteger(i) && i >= 0 && i < n); }
// a new match: { courses: 3 | 5, riders: [two roster indexes a side], roster: [two sizes], best: [the slot (0 or 1) of each side's best rider] }
function jtNewMatch(o) {
  o = o || {};
  const courses = JT_RULES.coursesAt.includes(o.courses) ? o.courses : JT_RULES.courses, roster = [0, 1].map(s => Math.max(JT_RULES.side, ((o.roster || [])[s]) | 0));
  const riders = [0, 1].map(s => jtRidersOk((o.riders || [])[s], roster[s]) ? o.riders[s].slice() : [0, 1]);
  const best = [0, 1].map(s => { const b = (o.best || [])[s]; return b === 0 || b === 1 ? b : null; });
  const heats = () => Array.from({ length: JT_RULES.heats }, () => Array(courses).fill(null));
  G = { courses, riders, roster, best, heat: 0, course: 0, sc: [heats(), heats()], tilt: [[], []], crown: null, ended: Array(JT_RULES.heats).fill(null), log: [], over: null };
  return G;
}
const jtInTilt = () => !!G && G.heat >= JT_RULES.heats;
// who rides the course now: [side 0's roster index, side 1's] (null before a match or once it is over)
const jtRiders = () => !G || G.over ? null : jtInTilt() ? G.crown.slice() : [G.riders[0][G.heat], G.riders[1][G.heat]];
const jtHeatTotal = (s, h) => G ? (h >= JT_RULES.heats ? G.tilt[s] : G.sc[s][h]).reduce((a, b) => a + (b || 0), 0) : 0;
const jtTotal = s => G ? G.sc[s].reduce((a, h) => a + h.reduce((x, y) => x + (y || 0), 0), 0) + G.tilt[s].reduce((a, b) => a + b, 0) : 0;
// the courses still to ride in this heat (0 in the tilt or when over)
const jtLeft = () => !G || G.over || jtInTilt() ? 0 : G.courses - G.course;

/* ---------- a strike ---------- */
const jtFair = at => JT_RULES.fair.includes(at);
const jtFoul = at => JT_RULES.fouls.includes(at);
// a strike's points: { at, unhorse } (an unhorsing scores JT_RULES.unhorse in place of the break)
const jtStrikePts = st => !st || !(st.at in JT_RULES.pts) ? 0 : st.unhorse && jtFair(st.at) ? JT_RULES.unhorse : JT_RULES.pts[st.at];
function jtStrikeWhy(st) {
  if (!st || typeof st !== 'object' || !(st.at in JT_RULES.pts)) return `A strike lands somewhere: ${Object.keys(JT_RULES.pts).join(', ')}.`;
  if (st.unhorse && !jtFair(st.at)) return 'Only a fair strike, on the shield, body or helm, can unhorse.';
  return '';
}
// why a course can't be scored ('' when it can): res is [side 0's strike, side 1's]
function jtWhyNot(res) {
  if (!G) return 'No match.';
  if (G.over) return 'The match is over.';
  if (!Array.isArray(res) || res.length !== 2) return 'A course is two strikes, one a side.';
  return jtStrikeWhy(res[0]) || jtStrikeWhy(res[1]);
}

/* ---------- a course ---------- */
/* the course ridden: res = [side 0's strike on side 1's rider, side 1's on side 0's], each { at, unhorse }. Scores
   both, ends the heat on an unhorsing or after its last course, starts the tilt when the heats leave it level, and
   ends the match when it is decided. Returns { ok, why?, heat, course, tilt, pts: [2], unhorsed: [sides], heatOver:
   { heat, tot, by: 'unhorse' | 'courses' } | null, tiltNow (the tilt for the crown begins), over } */
function jtCourse(res) {
  const why = jtWhyNot(res); if (why) return { ok: false, why };
  const at = res.map(st => st.at), un = res.map(st => !!st.unhorse && jtFair(st.at)), pts = res.map(jtStrikePts);
  const h = G.heat, k = G.course, tilt = jtInTilt(), unhorsed = [0, 1].filter(s => un[1 - s]);
  if (tilt) [0, 1].forEach(s => G.tilt[s].push(pts[s])); else [0, 1].forEach(s => { G.sc[s][h][k] = pts[s]; });
  G.log.push({ heat: h, course: k, tilt, at, unhorse: un, pts: pts.slice() });
  const out = { ok: true, heat: h, course: k, tilt, pts, unhorsed, heatOver: null, tiltNow: false, over: null };
  G.course++;
  if (tilt) { if (jtTotal(0) !== jtTotal(1)) jtDecide(); }
  else if (unhorsed.length || G.course >= G.courses) {
    if (unhorsed.length) G.ended[h] = { course: k + 1, unhorsed };
    out.heatOver = { heat: h, tot: [jtHeatTotal(0, h), jtHeatTotal(1, h)], by: unhorsed.length ? 'unhorse' : 'courses' };
    G.heat++; G.course = 0;
    if (G.heat >= JT_RULES.heats) {
      if (jtTotal(0) !== jtTotal(1)) jtDecide();
      else { G.crown = [0, 1].map(s => G.riders[s][jtBestSlot(s)]); out.tiltNow = true; }
    }
  }
  if (G.over) out.over = G.over;
  return out;
}
// each side's best rider for the tilt: the one named, else the one who scored more in their heat (the first on a tie)
function jtBestSlot(s) {
  if (G.best[s] === 0 || G.best[s] === 1) return G.best[s];
  return jtHeatTotal(s, 1) > jtHeatTotal(s, 0) ? 1 : 0;
}
function jtDecide() {
  const a = jtTotal(0), b = jtTotal(1), n = G.tilt[0].length;
  G.over = { win: a > b ? 0 : 1, tot: [a, b], tilt: n, text: `${Math.max(a, b)} to ${Math.min(a, b)}${n ? ' after the tilt for the crown' : ''}` };
}
// the tourney board: each side's points by heat and course (null not ridden), the tilt's, the totals, and where the match is
function jtBoard() {
  if (!G) return null;
  return { sc: G.sc.map(hs => hs.map(c => c.slice())), tilt: G.tilt.map(t => t.slice()), heat: G.heat, course: G.course, courses: G.courses,
    inTilt: jtInTilt(), ended: JSON.parse(JSON.stringify(G.ended)), tot: [jtTotal(0), jtTotal(1)] };
}
// the match from side s's point of view, in words
function jtMatchText(s) {
  if (!G) return '';
  const t = s ? 1 : 0, o = 1 - t, a = jtTotal(t), b = jtTotal(o);
  if (G.over) return `${G.over.win === t ? 'Won' : 'Lost'} ${G.over.tot[t]} to ${G.over.tot[o]}${G.over.tilt ? ' after the tilt for the crown' : ''}`;
  const where = jtInTilt() ? `in the tilt for the crown, course ${G.course + 1}` : `heat ${G.heat + 1}, course ${G.course + 1} of ${G.courses}`;
  return `${a === b ? 'Level' : a > b ? 'Ahead' : 'Behind'}, ${a} to ${b}, ${where}`;
}
// one strike in the herald's words ("a lance broken on the helm", "unhorsed!")
const jtAtText = st => !st ? '' : st.unhorse && jtFair(st.at) ? `${JT_AT[st.at]}, and unhorsed` : JT_AT[st.at] || '';
