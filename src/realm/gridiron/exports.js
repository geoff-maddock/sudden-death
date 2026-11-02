/* the end of the wGF scope: what the Realm may call (w19b-engines.js, w42-gridiron.js). Phase 1 plays one drive:
   start(opts) puts it on the field ({ teams: [2], mode: 'watch' | 'call', seed }), call(play) is your call in 'call'
   mode, sim(opts) plays a whole drive at once and returns its summary; onPhase hears each new beat of a drive on the
   field (call, pre, live, kick, post, over) and onOver its end.
   lineup() is who is on the field, kick() the field-goal try from here, why the last result's reason.
   box, audio, onQuit and onSnap come with the full game (phases 2 and 5). */
return {
  newGame: gfNewGame, spot: gfSpot, get G() { return G; }, rules: Object.assign({}, GF_RULES),
  start: gfStart, game: gfStartGame, simGame: gfSimGame, call: gfCall, sim: gfSim, show: gfShow, hide: gfHide, render: gfRender,
  get on() { return GFP.on; }, get live() { return !!GD && GD.ph !== 'over'; }, get phase() { return GD ? GD.ph : null; },
  get play() { return L; }, pause: on => { GFP.paused = !!on; }, setMode: m => { if (GD) { GD.mode = ['call', 'play'].includes(m) ? m : 'watch'; GD.pick = null; GD.pow = null; GD.auto = GD.mode === 'call'; } },
  // Play mode: the page's keys ({ steer, hold, pick, tap }), and what the field shows of them
  input: o => gfInput(o || {}), get hands() { return !!L && L.hands && GD.ph === 'live' && !L.done; }, get meter() { return GD && GD.meter ? Object.assign({ now: gfMeterNow() }, GD.meter) : null; }, set onOver(f) { GF_HOOK.onOver = f; }, set onPhase(f) { GF_HOOK.onPhase = f; }, set onSnap(f) { GF_HOOK.onSnap = f; }, set wantSnap(f) { GF_HOOK.wantSnap = f; },
  // box scores and saving (phase 5): the game's box lines, a snapshot between plays, and putting one back on the field
  box: () => gfBox(), snapshot: () => GD ? gfSnapshot() : null, resume: sn => { gfResume(sn); gfShow(); return G; },
  // the calls you may make now ('punt', 'fg' too), the field-goal try from here, and what the coach would do on fourth
  canCall: oc => !!GD && gfCanCall(oc), kick: () => G ? { dist: gfKickDist(), chance: gfKickChance(), inRange: gfKickDist() <= GF_FG_MAX, coach: gfFourth() } : null,
  // who is on the field: the drive's offense by position, and the other side's defense (r: the ratings they play on
  // now, worn when tired; base: their own)
  lineup: () => G ? [['off', G.drive.side], ['def', 1 - G.drive.side]].map(([m, s]) => ({ side: m === 'off' ? 0 : 1, team: G.teams[s].name, color: G.teams[s].color,
    players: Object.entries(G.teams[s][m]).map(([pos, i]) => Object.assign({ pos }, G.teams[s].roster[i], { r: gfRated(s, i), base: Object.assign({}, G.teams[s].roster[i].r), stam: G.stam ? Math.round(G.stam[s][i]) : 100 })),
    kicker: G.teams[s].roster[G.teams[s].kicker].n })) : [],
  get isGame() { return !!GD && GD.game; }, get yourBall() { return !!GD && G.poss === GD.you; }, clock: () => G && GD && GD.game ? { half: G.half, text: gfClockText(), name: GF_HALF_NAME[G.half] } : null,
  get why() { return GD ? GD.why : ''; }, get msg() { return GD ? GD.msg : ''; }, highlight: h => { GFT.hl = h || null; },
  edge: (oc, dc) => gfEdge(oc, dc).slice(), stats: GF_STATS.slice(),
  // ratings and positions for the Realm's players (phase 3): a kind's ratings, the positions, and the lineup the coaches
  // would pick for a roster of seven ({ off, def, kicker }, roster indices)
  // the playbook (phase 4): how fresh a side's calls are ({ off: { play: 0..1 }, def: {...} }), and what the other
  // coach has seen of them lately (shares of the last few calls)
  fresh: side => G && G.fresh ? JSON.parse(JSON.stringify(G.fresh[side])) : null, tendency: (side, kind) => G ? gfTendency(side, kind) : {},
  cpu: { off: () => gfCpuOffense(), def: () => gfCpuDefense() },
  // powers (phase 6): your side's mana and the powers it can cast with this call ({ key, name, n, cost, ult, fits,
  // desc, ok, why, stam, stamCost }), your pick and Auto powers, a power's tips ({ pro, con, note }), the zones on
  // the field, and every kind's powers (for How to play)
  powers: () => G && GD && G.mana ? { mana: G.mana[GD.you], their: G.mana[1 - GD.you], max: GF_MANA.max, role: gfRole(GD.you), auto: !!GD.auto, pick: GD.pow,
    list: gfPowerOptions(GD.you), cast: GD.cast ? JSON.parse(JSON.stringify(GD.cast)) : null } : null,
  pickPower: key => gfPickPower(key), cyclePower: () => gfCyclePower(), setAuto: on => { if (GD) { GD.auto = !!on; GD.pow = on ? null : GD.pow; } return GD ? GD.auto : false; },
  tip: key => G && GD ? gfPowerTip(key) : null, zones: () => (G && G.zones || []).map(z => ({ id: z.id, n: z.n, left: z.left, side: z.side, team: G.teams[z.side].name, desc: GF_ULT_BY[z.id].desc })),
  powerBook: gfPowerBook(), ultPlays: GF_ULT_PLAYS, ultCost: GF_ULT_COST, mana: Object.assign({}, GF_MANA),
  rate: kind => gfRate(kind), kinds: Object.keys(GF_KIND), offPos: GF_OFF_POS.slice(), defPos: GF_DEF_POS.slice(),
  auto: roster => { const T = gfTeam({ name: '', roster }); return { off: T.off, def: T.def, kicker: T.kicker }; },
  plays: Object.fromEntries(GF_OFF_IDS.map(k => [k, { n: GF_PLAYS[k].n, desc: GF_PLAYS[k].desc }])),
  defs: Object.fromEntries(GF_DEF_IDS.map(k => [k, { n: GF_DEFS[k].n, desc: GF_DEFS[k].desc }])),
  // the test's handle on the field: play one down from a spot, both calls given
  down: (oc, dc, opts) => { gfStart(opts); return gfPlayDown(oc, dc, opts && opts.st); },
  snap: (oc, dc, opts) => { gfStart(opts); return gfSnap(oc, dc); }, step: () => { if (L && !L.done) gfStep(GF_DT); return L; },
};
