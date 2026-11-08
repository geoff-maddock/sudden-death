/* the end of the wBX scope: what the Realm may call (w19b-engines.js, w51-ring.js). Phase 0 is the rules; phase 1 boxes
   one bout, CPU against CPU; phase 2 gives you a corner and your hands. start(opts) puts a bout in the ring ({ fighters:
   [2], corners: [2], mode: 'watch' | 'call' | 'play', you, seed, skill }); simBout(opts) boxes one headless and returns its summary; onPhase hears each beat (intro, round, kd, rise,
   corner, over) and onOver the end, with the summary. The test's handles: G, rules and the pure rule functions, step
   (one beat), and act/clinch (a fighter's move, by side). */
return {
  newBout: bxNewBout, knockdown: bxKnockdown, countOut: bxCountOut, bell: bxBell, roundScore: bxRoundScore, decision: bxDecision,
  totals: c => bxTotals(c), cardResult: bxCardResult, get G() { return G; }, rules: Object.assign({}, BX_RULES),
  start: o => { CD = null; return bxStart(o); }, simBout: bxSimBout, show: bxShow, hide: bxHide, render: bxRender, summary: () => G && G.F ? bxSummary() : null,
  get on() { return BXP.on; }, get speed() { return BXP.speed; }, set speed(n) { BXP.speed = Math.max(1, Math.min(8, Math.round(n) || 1)); }, get live() { return !!BD && BD.ph !== 'over'; }, get phase() { return BD ? BD.ph : null; }, get count() { return BD && BD.ph === 'kd' ? BD.count : 0; },
  pause: on => { BXP.paused = !!on; }, get paused() { return BXP.paused; }, verdict: () => G && G.over ? bxVerdict() : '', intro: () => G && G.F ? bxIntroTape() : null,
  set onOver(f) { BX_HOOK.onOver = f; }, get onOver() { return BX_HOOK.onOver; }, set onSnap(f) { BX_HOOK.onSnap = f; }, set wantSnap(f) { BX_HOOK.wantSnap = f; }, set onEv(f) { BX_HOOK.onEv = f; }, get onEv() { return BX_HOOK.onEv; },
  // save points (phase 5): a snapshot now (between rounds or bouts), and putting one back in the ring
  snapshot: () => BD && G && G.F ? bxSnapshot() : null, resume: sn => { const g = bxResume(sn); bxShow(); return g; }, set onPhase(f) { BX_HOOK.onPhase = f; }, get onPhase() { return BX_HOOK.onPhase; },
  // your corner and your hands (phase 2): who boxes and corners your side ('watch', 'call', 'play'), the side that is
  // yours, what your corner would do while the bout waits for you ({ plan, patch, why }, or null), your plan, the
  // cut-man, and the keys or buttons ({ steer, guard, act })
  setMode: m => bxSetMode(m), get mode() { return BD ? BD.mode : null; }, get you() { return BD ? BD.you : 0; }, get wait() { return G && G.wait ? Object.assign({}, G.wait) : null; },
  call: plan => bxCall(plan), patch: () => bxPatch(), input: o => bxInput(o || {}), get inputState() { return JSON.parse(JSON.stringify(BXI)); }, buffer: BX_BUFFER,
  // the card (phase 3): a card in the ring ({ sides, picks, order, mode, you, seed }), the next bout on it, the card as
  // it stands (a copy), the score so far, the corner's pairing, and a whole card headless
  cardStart: o => { const c = bxCardStart(o); return JSON.parse(JSON.stringify(c)); }, cardNext: () => bxCardNext(),
  get card() { return CD ? JSON.parse(JSON.stringify(CD)) : null; }, cardScore: () => CD ? bxCardScore() : null,
  cardAuto: (mine, theirs) => bxCardAuto(mine.map(f => Object.assign(bxRate(f.kind), f.r || {})), theirs.map(f => Object.assign(bxRate(f.kind), f.r || {}))), simCard: o => bxSimCard(o),
  // powers (phase 4): a side's special and ultimate now ({ sp, ult, fx }), casting one (the tests' handle; in play, Q and R
  // or the pad through input), every kind's powers (for How to play), the stamina they cost, and a fighter's statuses
  powers: side => G && G.F ? bxPowState(G.F[side == null ? BD.you : side]) : null, cast: (side, which) => bxCast(G.F[side], which),
  powerBook: Object.fromEntries(Object.entries(BX_POW).map(([k, P]) => [k, { sp: { n: P.sp.n, desc: P.sp.desc }, ult: { n: P.ult.n, desc: P.ult.desc } }])),
  // each kind's nature in the ring (a trait for some, none for the rest): { kind: { n, desc } }
  traits: Object.fromEntries(Object.entries(BX_TRAIT).map(([k, t]) => [k, { n: t.n, desc: t.desc }])),
  powerData: JSON.parse(JSON.stringify(BX_POW)), powerCost: Object.assign({}, BX_POW_STA), fx: side => G && G.F ? JSON.parse(JSON.stringify(G.F[side].fx || [])) : [],
  // the ratings, plans, punches and judges, for the page and How to play
  rate: kind => bxRate(kind), style: kind => bxStyle(bxRate(kind)), styleOf: r => bxStyle(Object.assign(bxRate('goblin'), r)), staMax: r => bxStaMax(r), kinds: Object.keys(BX_KIND), stats: BX_STATS.slice(),
  plans: Object.fromEntries(BX_PLAN_IDS.map(k => [k, { n: BX_PLAN[k].n, desc: BX_PLAN[k].desc }])),
  punches: Object.fromEntries(BX_PUNCH_IDS.map(k => [k, { n: BX_PUNCH[k].n, head: !!BX_PUNCH[k].head, power: !!BX_PUNCH[k].power }])),
  judges: BX_JUDGES.map(J => ({ n: J.n, likes: J.likes })),
  // the test's handle on the ring: one beat, and a fighter's move
  step: () => { if (BD && BD.ph !== 'over') bxBeat(BX_DT); return BD ? BD.ph : null; }, act: (side, k) => bxAct(G.F[side], k), clinch: side => bxClinch(G.F[side], G.F[1 - side]),
  get ev() { return BXE; }, get rawCard() { return CD; },
  range: (side, k) => bxRange(G.F[side], k), dist: () => bxDist(G.F[0], G.F[1]), land: (side, k) => bxLand(G.F[side], G.F[1 - side], k),
};
