/* the end of the wGF scope: what the Realm may call (w19b-engines.js, w42-gridiron.js). Phase 1 plays one drive:
   start(opts) puts it on the field ({ teams: [2], mode: 'watch' | 'call', seed }), call(play) is your call in 'call'
   mode, sim(opts) plays a whole drive at once and returns its summary; onPhase hears each new beat of a drive on the
   field (call, pre, live, kick, post, over) and onOver its end.
   lineup() is who is on the field, kick() the field-goal try from here, why the last result's reason.
   box, audio, onQuit and onSnap come with the full game (phases 2 and 5). */
return {
  newGame: gfNewGame, spot: gfSpot, get G() { return G; }, rules: Object.assign({}, GF_RULES),
  start: gfStart, call: gfCall, sim: gfSim, show: gfShow, hide: gfHide, render: gfRender,
  get on() { return GFP.on; }, get live() { return !!GD && GD.ph !== 'over'; }, get phase() { return GD ? GD.ph : null; },
  get play() { return L; }, pause: on => { GFP.paused = !!on; }, set onOver(f) { GF_HOOK.onOver = f; }, set onPhase(f) { GF_HOOK.onPhase = f; },
  // the calls you may make now ('punt', 'fg' too), the field-goal try from here, and what the coach would do on fourth
  canCall: oc => !!GD && gfCanCall(oc), kick: () => G ? { dist: gfKickDist(), chance: gfKickChance(), inRange: gfKickDist() <= GF_FG_MAX, coach: gfFourth() } : null,
  // who is on the field: the drive's offense by position, and the other side's defense
  lineup: () => G ? [['off', G.drive.side], ['def', 1 - G.drive.side]].map(([m, s]) => ({ side: m === 'off' ? 0 : 1, team: G.teams[s].name, color: G.teams[s].color,
    players: Object.entries(G.teams[s][m]).map(([pos, i]) => Object.assign({ pos }, G.teams[s].roster[i], { r: Object.assign({}, G.teams[s].roster[i].r) })),
    kicker: G.teams[s].roster[G.teams[s].kicker].n })) : [],
  get why() { return GD ? GD.why : ''; }, get msg() { return GD ? GD.msg : ''; }, highlight: h => { GFT.hl = h || null; },
  edge: (oc, dc) => gfEdge(oc, dc).slice(), stats: GF_STATS.slice(),
  plays: Object.fromEntries(GF_OFF_IDS.map(k => [k, { n: GF_PLAYS[k].n, desc: GF_PLAYS[k].desc }])),
  defs: Object.fromEntries(GF_DEF_IDS.map(k => [k, { n: GF_DEFS[k].n, desc: GF_DEFS[k].desc }])),
  // the test's handle on the field: play one down from a spot, both calls given
  down: (oc, dc, opts) => { gfStart(opts); return gfPlayDown(oc, dc); },
  snap: (oc, dc, opts) => { gfStart(opts); return gfSnap(oc, dc); }, step: () => { if (L && !L.done) gfStep(GF_DT); return L; },
};
