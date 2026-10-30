/* Cinder Gridiron: the playbook (issue #9, phase 4). Plays tire with use and recover (question 4); nothing is spent.
   Every side has a freshness for each of its plays and each of its defenses, 0 to 1 (G.fresh). Calling one costs
   GF_TIRE; every other one recovers GF_REST each down that side's offense (or defense) is on the field, and the half
   makes them all fresh again. A stale call is one the other side has seen coming:
   - a stale play (L.read): the defenders jump the snap, read the throw sooner and win their blocks more often;
   - a stale defense (L.tell): the offense knows what's coming, and blocks and gets open more easily.
   The coaches' counter-calls: each coach reads the other side's recent calls this game (the last GF_SEEN) and leans
   to the call that beats what they keep doing, and away from their own stale ones. So calling the same play every
   down stops working twice over: it tires, and they see it coming.
   G.fresh = [{ off: { play: f }, def: { defense: f } }, ...] by side, and G.seen = [[{ oc, dc }], ...]: each side's
   recent calls, as the other coach saw them. Plain JSON. */
const GF_TIRE = .4, GF_REST = .15, GF_SEEN = 8;
function gfFreshAll() { return { off: Object.fromEntries(GF_OFF_IDS.map(k => [k, 1])), def: Object.fromEntries(GF_DEF_IDS.map(k => [k, 1])) }; }
function gfPlaybookStart() { G.fresh = [gfFreshAll(), gfFreshAll()]; G.seen = [[], []]; }
// how fresh side's call is, 1 when it has never been called
const gfFresh = (side, kind, id) => G.fresh ? G.fresh[side][kind][id] : 1;
// a call is made: it tires, and the others on that side rest
function gfTire(side, kind, id) {
  if (!G.fresh) return;
  const F = G.fresh[side][kind];
  for (const k in F) F[k] = k === id ? Math.max(0, F[k] - GF_TIRE) : Math.min(1, F[k] + GF_REST);
}
// a down is called: how stale each side's call is (for the live play), then both tire, and the coaches see them
// (a play cast on is remembered: it counts half again in what the other coach has seen)
function gfCallsMade(oc, dc, cast) {
  const off = G.poss, def = 1 - G.poss;
  const st = { read: 1 - gfFresh(off, 'off', oc), tell: 1 - gfFresh(def, 'def', dc) };
  gfTire(off, 'off', oc); gfTire(def, 'def', dc);
  if (G.seen) { G.seen[off].push(cast && cast.off ? { oc, pw: 1 } : { oc }); G.seen[def].push({ dc }); for (const s of G.seen) if (s.length > GF_SEEN * 2) s.splice(0, s.length - GF_SEEN * 2); }
  return st;
}
function gfHalfRest() { if (G.fresh) G.fresh = [gfFreshAll(), gfFreshAll()]; }
// what share of side's last calls of a kind were each one
function gfTendency(side, kind) {
  const key = kind === 'off' ? 'oc' : 'dc', list = ((G.seen && G.seen[side]) || []).filter(x => x[key]).slice(-GF_SEEN), out = {};
  const W = list.reduce((a, x) => a + (x.pw ? 1.5 : 1), 0);
  for (const x of list) out[x[key]] = (out[x[key]] || 0) + (x.pw ? 1.5 : 1) / W;
  return out;
}
// the counter-call: weight up the defenses that beat what this offense keeps calling, down the ones it beats
function gfCounterDefense(w) {
  const T = gfTendency(G.poss, 'off');
  for (const dc in w) { for (const oc in T) w[dc] += -gfEdge(oc, dc)[0] * T[oc] * 2.5; w[dc] = Math.max(.15, w[dc]) * (.3 + .7 * gfFresh(1 - G.poss, 'def', dc)); }
  return w;
}
function gfCounterOffense(w) {
  const T = gfTendency(1 - G.poss, 'def');
  for (const oc in w) { for (const dc in T) w[oc] += gfEdge(oc, dc)[0] * T[dc] * 2.5; w[oc] = Math.max(.15, w[oc]) * (.3 + .7 * gfFresh(G.poss, 'off', oc)); }
  return w;
}
