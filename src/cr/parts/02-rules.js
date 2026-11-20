/* The Curling Shed: the rules (issue #102, phase 0), as pure functions on a plain-JSON game (G). The Realm takes the
   engine inside a scope (src/realm/shed/manifest.txt, through `scope wCR ...`), so none of these names reach the page.

   A game is two rinks of four (lead, second, third, skip). An end is sixteen stones: each curler throws two, the sides
   alternating, the side without the hammer first; a side's stones go lead, lead, second, second, third, third, skip,
   skip. After the sixteenth the end is scored: the side with the stone nearest the button scores one for each of its
   stones nearer than the other side's nearest; only stones touching the house count; none in the house is a blank end.
   The side that scores gives up the hammer (the last stone) for the next end; after a blank the hammer stays. Level
   after the last end: an extra end, and another, until one side is ahead.
   The free guard zone (CR_RULES.fgz stones, on unless the game says otherwise): until the fifth stone of an end, a
   stone may not take the other side's guard out of play. If it does, the thrown stone is removed and the stones it
   moved go back where they were.

   The sheet in inches, from the thrower's end: x across (0 is the centre line, + to the thrower's left), y along the
   sheet with 0 at the tee (the button) and negative toward the thrower: the far hog line at y = -CR_SHEET.hog, the
   back line at y = +CR_SHEET.back. A stone is { id, s, x, y } (id 's:j', its side and its number for that side this end).
   - in the house: some part of it inside the 12-foot ring (its centre within houseR + stoneR of the button);
   - a guard (in the free guard zone): past the hog line, short of the tee line, and not in the house;
   - in play: not wholly past the back line, clear of the side boards, and wholly past the hog line (the thrown stone:
     one short of it is removed, unless it hit a stone in play; a stone already in play knocked back short of it stays). The physics
     (phase 1) says where stones stop; these rules only read where they are.

   G: { ends, order: [2 × four roster indexes], roster: [2 × size], fgz, hammer (side), end (0-based), k (stones thrown
   this end), stones (in play), sc: [[points by end], [points by end]], log: [{ end, s, n }], extra, over }. */
const CR_RULES = { side: 4, stones: 2, ends: 6, endsAt: [4, 6, 8], fgz: 4, posN: ['lead', 'second', 'third', 'skip'] };
// (a 12-foot house, a 36-inch stone; the hog line 21 feet before the tee, the back line 6 feet behind it; 15'7" wide)
const CR_SHEET = { houseR: 72, stoneR: 5.75, hog: 252, back: 72, halfW: 93.5, rings: [72, 48, 24, 6] };
let G = null;

const crPerEnd = () => CR_RULES.side * CR_RULES.stones * 2;
function crOrderOk(o, n) { return Array.isArray(o) && o.length === CR_RULES.side && new Set(o).size === o.length && o.every(i => Number.isInteger(i) && i >= 0 && i < n); }
// a new game: { ends, order, roster, hammer (the side with the hammer in the first end, 1 if not given), fgz }
function crNewGame(o) {
  o = o || {};
  const ends = CR_RULES.endsAt.includes(o.ends) ? o.ends : CR_RULES.ends, roster = [0, 1].map(s => o.roster && o.roster[s] != null ? o.roster[s] | 0 : CR_RULES.side);
  if (roster.some(n => n < CR_RULES.side)) throw new Error(`A rink is ${CR_RULES.side}: a roster of ${Math.min(...roster)} can't play.`);
  const order = [0, 1].map(s => crOrderOk((o.order || [])[s], roster[s]) ? o.order[s].slice() : [0, 1, 2, 3]);
  G = { ends, order, roster, fgz: o.fgz === false ? 0 : CR_RULES.fgz, hammer: o.hammer === 0 ? 0 : 1, end: 0, k: 0, stones: [], sc: [[], []], log: [], extra: 0, over: null };
  return G;
}
// whose stone it is (-1 when the game is over): the side without the hammer throws the even stones of an end
const crUp = () => !G || G.over ? -1 : (G.k % 2 === 0 ? 1 - G.hammer : G.hammer);
// side s's stone number this end (0 to 7: how many it has thrown), and who throws it: a position's two stones in turn
function crSideNo(s) { if (!G) return -1; const first = 1 - G.hammer; return s === first ? Math.ceil(G.k / 2) : Math.floor(G.k / 2); }
const crPos = s => !G ? -1 : Math.min(CR_RULES.side - 1, Math.floor(crSideNo(s) / CR_RULES.stones));
const crThrower = s => G ? G.order[s][crPos(s)] : -1;
const crEndsNow = () => G.ends + G.extra;
const crTotal = s => G ? G.sc[s].reduce((a, b) => a + b, 0) : 0;

/* ---------- where a stone is ---------- */
const crDist = st => Math.hypot(st.x, st.y);
const crInHouse = st => crDist(st) <= CR_SHEET.houseR + CR_SHEET.stoneR;
// wholly past the far hog line (a stone still touching it is out, as the rule has it): the one test the guard zone and
// play share
const crPastHog = st => st.y - CR_SHEET.stoneR > -CR_SHEET.hog;
const crInFgz = st => crPastHog(st) && st.y < 0 && !crInHouse(st);
// on the sheet: not wholly past the back line, clear of the side boards. A stone already in play stays in play short of
// the hog line (knocked back); the hog-line rule is for the stone just thrown (crThrow)
const crOnSheet = st => st.y - CR_SHEET.stoneR <= CR_SHEET.back && Math.abs(st.x) + CR_SHEET.stoneR < CR_SHEET.halfW;
const crInPlay = st => crPastHog(st) && crOnSheet(st);
// an end's score from the stones in play: { s: the side that scores (-1 for a blank), n, shot: the nearest stone's id }
function crScoreEnd(stones) {
  const H = (stones || []).filter(crInHouse).sort((a, b) => crDist(a) - crDist(b));
  if (!H.length) return { s: -1, n: 0, shot: null };
  const s = H[0].s, other = H.find(st => st.s !== s), lim = other ? crDist(other) : Infinity, n = H.filter(st => st.s === s && crDist(st) < lim).length;
  // (the two sides' nearest stones measure the same: nobody scores, a blank)
  return n ? { s, n, shot: H[0].id } : { s: -1, n: 0, shot: null };
}

/* ---------- a stone ---------- */
function crWhyNot(s) {
  if (!G) return 'No game.';
  if (G.over) return 'The game is over.';
  if (s !== crUp()) return 'Not their stone.';
  return '';
}
/* side s's stone thrown: after is every stone in play once it has stopped ({ id, s, x, y }; the thrown one with
   id 's:j' for its number this end, or left out if it didn't stay in play); o.hit: it touched a stone in play (so the
   hog-line rule spares it). The free guard zone is applied, the stones out of play are dropped, and after the end's
   last stone the end is scored. Returns { ok, why?, fgz (the rule took the stone back), end: { s, n } when the end was
   scored, over when the game was decided } */
function crThrow(s, after, o) {
  const why = crWhyNot(s); if (why) return { ok: false, why };
  const id = `${s}:${crSideNo(s)}`, before = G.stones.map(st => Object.assign({}, st));
  // every stone after is one already in play (the same id and side) or the one just thrown (side s's, new: it takes
  // its id here); anything else is refused
  const old = new Map(before.map(b => [b.id, b.s])), fresh = (after || []).filter(st => !old.has(st.id));
  const ids = (after || []).map(st => st.id);
  if (new Set(ids).size !== ids.length || (after || []).some(st => old.has(st.id) && old.get(st.id) !== st.s) || fresh.length > 1 || (fresh[0] && fresh[0].s !== s)) return { ok: false, why: 'Those stones are not the ones in play.' };
  const hit = !!(o && o.hit);
  let now = (after || []).filter(st => crOnSheet(st) && (old.has(st.id) || hit || crPastHog(st))).map(st => ({ id: old.has(st.id) ? st.id : id, s: st.s, x: st.x, y: st.y }));
  // the free guard zone: one of the other side's guards gone from play before the fifth stone
  let fgz = false;
  if (G.k < G.fgz) {
    const gone = before.filter(b => b.s !== s && crInFgz(b) && !now.some(n => n.id === b.id));
    if (gone.length) { fgz = true; now = before.map(b => Object.assign({}, b)); }
  }
  G.stones = now; G.k++;
  const out = { ok: true, side: s, id, fgz, stones: G.stones.length, end: null, over: null };
  if (G.k >= crPerEnd()) out.end = crEndOf();
  if (G.over) out.over = G.over;
  return out;
}
// the end's sixteen stones are thrown: score it, give up the hammer (or keep it on a blank), and on to the next end
function crEndOf() {
  const R = crScoreEnd(G.stones), e = G.end;
  [0, 1].forEach(s => { G.sc[s][e] = R.s === s ? R.n : 0; });
  G.log.push({ end: e + 1, s: R.s, n: R.n, extra: e >= G.ends });
  if (R.s >= 0) G.hammer = 1 - R.s;
  G.end++; G.k = 0; G.stones = [];
  if (G.end >= crEndsNow()) {
    const a = crTotal(0), b = crTotal(1);
    if (a === b) G.extra++;
    else G.over = { win: a > b ? 0 : 1, tot: [a, b], extra: G.extra, text: `${Math.max(a, b)} to ${Math.min(a, b)}${G.extra ? ' after an extra end' : ''}` };
  }
  return { s: R.s, n: R.n, shot: R.shot, end: e + 1 };
}
// the board, as a curling scoreboard keeps it: each side's points by end, and the hammer
function crBoard() { if (!G) return null; return { sc: G.sc.map(r => r.slice()), ends: crEndsNow(), end: G.end, hammer: G.hammer, tot: [crTotal(0), crTotal(1)] }; }
// the game from side s's point of view, in words
function crMatchText(s) {
  if (!G) return '';
  const t = s ? 1 : 0, o = 1 - t;
  if (G.over) return `${G.over.win === t ? 'Won' : 'Lost'} ${G.over.tot[t]} to ${G.over.tot[o]}${G.over.extra ? ' after an extra end' : ''}`;
  const a = crTotal(t), b = crTotal(o), e = G.end;
  return `${a === b ? 'Level' : a > b ? 'Ahead' : 'Behind'}, ${a} to ${b}, ${e ? `after ${e} end${e === 1 ? '' : 's'}` : 'before the first end'}${G.hammer === t ? ', with the hammer' : ''}`;
}
