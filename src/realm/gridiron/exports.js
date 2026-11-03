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
  get play() { return L; }, pause: on => { GFP.paused = !!on; }, get paused() { return GFP.paused; }, setMode: m => { if (GD) { GD.mode = ['call', 'play'].includes(m) ? m : 'watch'; GD.pick = null; GD.pow = null; GD.auto = GD.mode === 'call'; } },
  // Play mode: the page's keys ({ steer, hold, pick, tap }), and what the field shows of them
  input: o => gfInput(o || {}), get hands() { return !!L && L.hands && GD.ph === 'live' && !L.done; }, get meter() { return GD && GD.meter ? Object.assign({ now: gfMeterNow() }, GD.meter) : null; }, set onOver(f) { GF_HOOK.onOver = f; }, set onPhase(f) { GF_HOOK.onPhase = f; }, get onPhase() { return GF_HOOK.onPhase; }, set onSnap(f) { GF_HOOK.onSnap = f; }, set wantSnap(f) { GF_HOOK.wantSnap = f; },
  // box scores and saving (phase 5): the game's box lines, a snapshot between plays, and putting one back on the field
  box: () => gfBox(), snapshot: () => GD ? gfSnapshot() : null, resume: sn => { gfResume(sn); gfShow(); return G; },
  // the calls you may make now ('punt', 'fg' too), the field-goal try from here, and what the coach would do on fourth
  canCall: oc => !!GD && gfCanCall(oc), kick: () => G ? { dist: gfKickDist(), chance: gfKickChance(), inRange: gfKickDist() <= GF_FG_MAX, coach: gfFourth(), wary: G.down === GF_RULES.downs ? gfFourthWary(G.poss) : '' } : null,
  // who is on the field: the drive's offense by position, and the other side's defense (r: the ratings they play on
  // now, worn when tired; base: their own)
  lineup: () => G ? [['off', G.drive.side], ['def', 1 - G.drive.side]].map(([m, s]) => ({ side: m === 'off' ? 0 : 1, team: G.teams[s].name, color: G.teams[s].color,
    players: Object.entries(G.teams[s][m]).map(([pos, i]) => Object.assign({ pos }, G.teams[s].roster[i], { r: gfRated(s, i), base: Object.assign({}, G.teams[s].roster[i].r), stam: G.stam ? Math.round(G.stam[s][i]) : 100 })),
    kicker: G.teams[s].roster[G.teams[s].kicker].n })) : [],
  get isGame() { return !!GD && GD.game; }, get yourBall() { return !!GD && G.poss === GD.you; }, clock: () => G && GD && GD.game ? { half: G.half, text: gfClockText(), name: GF_HALF_NAME[G.half] } : null,
  // the camera and the banner: how far in it has zoomed (1 is the whole width), the big play it zoomed for, the last result's banner
  view: () => ({ zoom: GFT.zoom, why: GFT.why, big: GD && GD.big ? Object.assign({}, GD.big) : null, px: GFP.dpr }),
  // the bench (15-bench.js): your seven and your bench with their stamina, whether a swap or a potion can happen now,
  // a swap (out comes off, inn comes on; returns what happened, or ''), a potion (ri, or null for the seven), and the
  // notes waiting for the next play's log line
  bench: () => G && GD ? { on: gfOnField(GD.you).map(i => gfBenchRow(GD.you, i)), bench: gfBench(GD.you).map(i => gfBenchRow(GD.you, i)), between: gfBetween(), item: !!GD.item, stam: !!G.stam } : null,
  swap: (out, inn) => G && GD ? gfSwapYours(out, inn) : '', useItem: (ri, n, name) => G && GD ? gfUseItem(ri, n, name) : '',
  notes: () => GD && GD.notes ? JSON.parse(JSON.stringify(GD.notes)) : [], swapRules: Object.assign({}, GF_SWAP, { lim: GF_SWAP.lim.slice() }), stamRules: Object.assign({}, GF_STAM),
  // stances (16-stance.js): yours for each side of the ball ({ off, def }, they stay until changed), the side of the ball
  // you are on, both sides' stances on the play on show, setting one, S's step, a stance's tips, and the rules
  stance: () => G && GD ? { mine: Object.assign({ off: 'bal', def: 'bal' }, G.stance), role: gfRole(GD.you), play: GD.stc ? Object.assign({}, GD.stc) : null, used: G.stUse ? JSON.parse(JSON.stringify(G.stUse)) : null } : null,
  setStance: (role, id) => gfSetStance(role, id), cycleStance: () => gfCycleStance(), stanceTip: id => gfStanceTip(id), stanceMost: side => G ? gfStanceMost(side) : 'bal',
  stances: Object.fromEntries(GF_ST_IDS.map(k => [k, { n: GF_STANCE[k].n, desc: GF_STANCE[k].desc, stam: GF_STANCE[k].stam, off: Object.assign({}, GF_STANCE[k].off), def: Object.assign({}, GF_STANCE[k].def) }])),
  // (the fumble rules themselves, not a copy: a test may raise the chance to see one)
  fumRules: GF_FUM, fumRisk: side => G ? gfFumbleRisk(side) : null,
  get why() { return GD ? GD.why : ''; }, get msg() { return GD ? GD.msg : ''; }, highlight: h => { GFT.hl = h || null; },
  edge: (oc, dc) => gfEdge(oc, dc).slice(), stats: GF_STATS.slice(),
  // ratings and positions for the Realm's players (phase 3): a kind's ratings, the positions, and the lineup the coaches
  // would pick for a roster of seven ({ off, def, kicker }, roster indices)
  // the playbook (phase 4): how fresh a side's calls are ({ off: { play: 0..1 }, def: {...} }), and what the other
  // coach has seen of them lately (shares of the last few calls)
  fresh: side => G && G.fresh ? JSON.parse(JSON.stringify(G.fresh[side])) : null, tendency: (side, kind) => G ? gfTendency(side, kind) : {},
  cpu: { off: () => gfCpuOffense(), def: () => gfCpuDefense(), stance: (side, role, skill) => gfCpuStance(side, role, skill) },
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
  snap: (oc, dc, opts) => { gfStart(opts); return gfSnap(oc, dc, opts && opts.st); }, step: () => { if (L && !L.done) gfStep(GF_DT); return L; },
};
