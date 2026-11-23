/* u8j: feats, resonance and the Seal's edges (issue #111, phase G). Loads after u8h-market.js (it wraps wUmbHexCut);
   changes earlier parts only by reassignment (saved originals carry the wWU8J prefix).

   Feats: every champion has one (W_UMB8J.feats), optional, never a wall. Meet it, or win at the first try, and the
   piece is won WELL (WG.umbral.well[piece]). The kinds:
     brink     the card game: win with your team on its last legs (a quarter of its HP or less, as the match is won)
     margin    win by N or more (baseball by 4, hockey by 3: more than their condition asks)
     night     win after dark
     nopowers  win with your side's powers off (golf, bowling, curling: the champion's card has the choice; it reaches the
               engine as powers: [false, true], and the game remembers it in its ref)
     first     win at the first try
   A piece won before this part keeps the old rule (won at the first try), so no old save is worse off.
   Resonance: each piece held gives a boon on the dark side (W_UMB8J.boons), twice as strong when won well
   (wUmbResonance(piece): 0, 1 or 2). The journal's Umbral chapter lists them as the Seal panel.
   The Seal's edges: a round in a piece's way to play draws one hex fewer when that piece was won well (u5 already took
   one off for a first-try win; a piece won well by its feat alone gets it here), and a card round whose piece was won
   well starts with W_UMB8J.edgeBlock Block.

   W_UMB8J, wUmbFeat, wUmbFeatMet, wUmbWell, wUmbResonance, wUmbSealPanel
   Wraps: W_ON_END for each champion's game kind (wWU8JEnd: the feat judged with the game's own result), W_ON_END.nadir
   (wWU8JOnNadir: a piece won well), wNadirMatch (wWU8JNadirMatch: the feat on the card, and the no-powers choice),
   wStartLinks, wStartLanes and wStartShed (wWU8J<Name>: the choice into the game's ref), wGL/wBL/wCR start and simGame
   (wWU8J<Name>: powers off for your side), wUmbFinaleEntry (wWU8JFinaleEntry: a well-won piece's hex), wUmbSpikeHp,
   wUmbShadowSight, wUmbShadowStep, wUmbHazardStep, wUmbTollAtKickoff, wBlackout (wWU8J<Name>: the boons), W_JTAB_FN.umbral
   (wWU8JJournal: the Seal panel), wStart (wWU8JStart: an old journey's pieces keep the first-try rule), renderHelp
   (wWU8JRenderHelp). */

const W_UMB8J = {
  feats: {
    gate: { k: 'brink', at: .25, n: 'win it with your team on its last legs, a quarter of its HP or less' },
    diamond: { k: 'margin', by: 4, n: 'win by four runs or more' },
    rink: { k: 'margin', by: 3, n: 'win by three goals or more' },
    court: { k: 'first', n: 'win at the first try' },
    ring: { k: 'first', n: 'win at the first try' },
    gridiron: { k: 'night', n: 'win after dark' },
    links: { k: 'nopowers', n: 'win with your side\'s powers off' },
    lanes: { k: 'nopowers', n: 'win with your side\'s powers off' },
    shed: { k: 'nopowers', n: 'win with your side\'s powers off' },
  },
  kinds: ['unadir_ball', 'unadirgf', 'unbox', 'unadirbk', 'unadirhk', 'unadirgl', 'unadirbl', 'unadircr'],
  // each piece's boon on the dark side: [held, won well]
  boons: {
    card: { n: 'Every card match on this side starts with Block', v: [4, 8], u: 'Block' },
    baseball: { n: 'The shadows see you from fewer steps away', v: [1, 2], u: 'steps' },
    basketball: { n: 'Spikes cost less HP', v: [1, 2], u: 'HP' },
    golf: { n: 'A pit costs less HP', v: [1, 2], u: 'HP' },
    bowling: { n: 'The guards start with less HP', v: [10, 20], u: '%' },
    curling: { n: 'A shadow match starts with Block', v: [6, 12], u: 'Block' },
    football: { n: 'A blackout on this side costs less of your gold', v: [50, 100], u: '%' },
    boxing: { n: 'A champion\'s toll is cheaper', v: [10, 20], u: 'gold' },
    hockey: { n: 'The shadows never hunt two steps at a time', v: [1, 1], u: '' },
  },
  edgeBlock: 10,
  pend: null, nopowNext: 0, winHp: null,
};

const wUmbFeat = id => W_UMB8J.feats[id] || null;
// a piece won well: by its feat, or (for a piece won before this part) at the first try
function wUmbWell(piece) {
  const U = wUmb(); if (!U || !U.pieces.includes(piece)) return false;
  if (U.well && U.well[piece]) return true;
  const legacy = (U.wellLegacy || []).includes(piece), c = typeof wUmbChampOf === 'function' ? wUmbChampOf(piece) : null;
  return legacy && !!c && !U.tries[c];
}
const wUmbResonance = piece => { const U = wUmb(); return !U || !U.pieces.includes(piece) ? 0 : wUmbWell(piece) ? 2 : 1; };
const wUmbBoon = piece => { const r = wUmbResonance(piece), B8 = W_UMB8J.boons[piece]; return r && B8 ? B8.v[r - 1] : 0; };
// (a journey from before this part: the pieces it already holds keep the old first-try rule)
function wUmbWellInit() { const U = wUmb(); if (U && !U.well) { U.well = {}; U.wellLegacy = U.pieces.slice(); } }

/* ---------- judging a feat ---------- */
onHook('fightWon', () => { const W = RUN && RUN.pending && RUN.pending.world; if (W && W.kind === 'nadir') W_UMB8J.winHp = [RUN.hp, RUN.maxhp]; });
function wUmbFeatMet(id, r, W, ref) {
  const F = wUmbFeat(id), U = wUmb(); if (!F || !U || r !== 'win') return false;
  if (F.k === 'brink') { const h = W_UMB8J.winHp || [RUN.hp, RUN.maxhp]; return h[0] <= h[1] * F.at; }
  if (F.k === 'margin') return !!W && typeof W.us === 'number' && typeof W.them === 'number' && W.us - W.them >= F.by;
  if (F.k === 'night') return wIsNight();
  if (F.k === 'nopowers') return !!(ref && ref.nopow);
  if (F.k === 'first') return !U.tries[id];
  return false;
}
// each champion's game kind: the feat judged with its own result (the score in W), for W_ON_END.nadir to read
for (const kind of W_UMB8J.kinds) {
  const wWU8JEnd = W_ON_END[kind]; if (!wWU8JEnd) continue;
  W_ON_END[kind] = function (r, ref, W) {
    const id = ref && ref.id;
    if (id && id !== 'finale' && W_NADIR[id]) W_UMB8J.pend = { id, met: wUmbFeatMet(id, r, W, ref) };
    try { return wWU8JEnd.apply(this, arguments); } finally { W_UMB8J.pend = null; }
  };
}
const wWU8JOnNadir = W_ON_END.nadir;
W_ON_END.nadir = function (r, ref, W) {
  wUmbWellInit();
  const U = wUmb(), id = ref && ref.id, C = id && W_NADIR[id], had = !!(U && C && C.piece && U.pieces.includes(C.piece));
  // (a card champion's end comes straight here; a sport's came through its kind above)
  const met = W_UMB8J.pend && W_UMB8J.pend.id === id ? W_UMB8J.pend.met : (C && !C.engine && id !== 'finale' ? wUmbFeatMet(id, r, W, ref) : false);
  const first = !!(U && id && !U.tries[id]);
  W_UMB8J.winHp = null;
  const out = wWU8JOnNadir.apply(this, arguments);
  if (U && C && C.piece && !had && U.pieces.includes(C.piece)) {
    const F = wUmbFeat(id), well = met || first;
    if (well) { U.well[C.piece] = 1; if (!LAB) wLog(`${W_UMB_PIECES[C.piece].n} is won well${met && F ? ` (you ${F.n.replace(/^win /, 'won ')})` : ', at the first try'}. It sings in your captain's hands.`, 'g'); }
    else if (F && !LAB) wLog(`${W_UMB_PIECES[C.piece].n} is yours, but quiet: it would sing if you had ${F.n.replace(/^win /, 'won ')}, or won at the first try.`, 'd');
    wSave();
  }
  return out;
};

/* ---------- the feat on the card, and the no-powers choice ---------- */
const wWU8JNadirMatch = wNadirMatch;
wNadirMatch = function (id) {
  const C = W_NADIR[id], U = wUmb(), F = wUmbFeat(id), open0 = !$('modal').hidden;
  const why = wWU8JNadirMatch.apply(this, arguments);
  if (why || !F || !U || !C || U.pieces.includes(C.piece) || LAB || open0 || $('modal').hidden) return why;
  const box = $('modalBox'); if (!box || box.querySelector('.wumbfeat')) return why;
  const p = document.createElement('p'); p.className = 'hint wumbfeat';
  p.innerHTML = `<b>The feat:</b> ${esc(F.n)}, or win at the first try, and the piece is won well: it sings for you on this side, twice as strongly, and makes its game in the Seal kinder.${F.k === 'nopowers' ? ` <label><input type="checkbox" id="wUmbNoPow"> Play without powers</label>` : ''}`;
  const body = box.querySelector('.wmsg'), head = box.querySelector('header'), cond = box.querySelector('.wumbcond');
  if (cond) cond.after(p); else if (body) body.prepend(p); else if (head) head.after(p); else box.prepend(p);
  // (the choice is made fresh on each card: the bots, with no card, set WG.umbral.nopow themselves)
  if (F.k === 'nopowers') U.nopow = null;
  const cb = $('wUmbNoPow'); if (cb) cb.onchange = () => { U.nopow = cb.checked ? id : null; };
  return why;
};
// the choice reaches the game: its ref remembers it, and the engine starts with your powers off
const wUmbNoPowStart = (orig, kind) => function (o) {
  const U = wUmb(), id = o && o.ref && o.ref.id;
  if (!U || !o || o.kind !== kind || !id || id === 'finale' || U.nopow !== id) return orig.apply(this, arguments);
  const o2 = Object.assign({}, o, { ref: Object.assign({}, o.ref, { nopow: 1 }) });
  W_UMB8J.nopowNext = 1; U.nopow = null;
  if (!LAB) wLog('No powers for your side, this game. For the feat.', 'd');
  try { return orig.call(this, o2); } finally { W_UMB8J.nopowNext = 0; }
};
const wWU8JStartLinks = wStartLinks; wStartLinks = wUmbNoPowStart(wWU8JStartLinks, 'unadirgl');
const wWU8JStartLanes = wStartLanes; wStartLanes = wUmbNoPowStart(wWU8JStartLanes, 'unadirbl');
const wWU8JStartShed = wStartShed; wStartShed = wUmbNoPowStart(wWU8JStartShed, 'unadircr');
const wUmbNoPowOpts = o => { if (!W_UMB8J.nopowNext) return o; W_UMB8J.lastPowers = [false, true]; return Object.assign({}, o, { powers: [false, true] }); };
const wWU8JGlStart = wGL.start, wWU8JGlSim = wGL.simGame;
wGL.start = o => wWU8JGlStart(wUmbNoPowOpts(o)); wGL.simGame = o => wWU8JGlSim(wUmbNoPowOpts(o));
const wWU8JBlStart = wBL.start, wWU8JBlSim = wBL.simGame;
wBL.start = o => wWU8JBlStart(wUmbNoPowOpts(o)); wBL.simGame = o => wWU8JBlSim(wUmbNoPowOpts(o));
const wWU8JCrStart = wCR.start, wWU8JCrSim = wCR.simGame;
wCR.start = o => wWU8JCrStart(wUmbNoPowOpts(o)); wCR.simGame = o => wWU8JCrSim(wUmbNoPowOpts(o));

/* ---------- resonance: the boons ---------- */
onHook('fightStart', () => {
  const W = RUN && RUN.pending && RUN.pending.world; if (!B || !W || !W.umbral || !wUmb()) return;
  const card = wUmbBoon('card'); if (card) { gainBlock(card, true); log(`The Cracked Card: ${card} Block.`, 'sys'); }
  if (W.kind === 'shadow') { const c = wUmbBoon('curling'); if (c) { gainBlock(c, true); log(`The Sunken Stone: ${c} Block against the shadows.`, 'sys'); } }
  if (W.kind === 'uguard') { const k = wUmbBoon('bowling'); if (k) { for (const e of B.enemies) { e.hp = Math.max(1, Math.round(e.hp * (1 - k / 100))); } log(`The Drowned Pin: the guards start ${k}% down.`, 'sys'); } }
  // the Seal's card round: a card piece won well starts it with Block
  if (W.kind === 'nadir' && W.ref && W.ref.id === 'finale' && wUmbWell('card') && W_NADIR.finale && !W_NADIR.finale.engine) { gainBlock(W_UMB8J.edgeBlock, true); log(`The Cracked Card, won well: ${W_UMB8J.edgeBlock} Block.`, 'sys'); }
});
const wWU8JSpikeHp = wUmbSpikeHp; wUmbSpikeHp = function () { return Math.max(0, wWU8JSpikeHp.apply(this, arguments) - wUmbBoon('basketball')); };
const wWU8JShadowSight = wUmbShadowSight; wUmbShadowSight = function () { return Math.max(1, wWU8JShadowSight.apply(this, arguments) - wUmbBoon('baseball')); };
// (the Hollow Flag makes a pit cheaper: the pit's cost is read from W_UMB8C.pitHp at the fall)
const wWU8JHazardStep = wUmbHazardStep;
wUmbHazardStep = function () { const p0 = W_UMB8C.pitHp; W_UMB8C.pitHp = Math.max(0, p0 - wUmbBoon('golf')); try { return wWU8JHazardStep.apply(this, arguments); } finally { W_UMB8C.pitHp = p0; } };
// (the Dead Puck: no hunting two steps at a time)
const wWU8JShadowStep = wUmbShadowStep;
wUmbShadowStep = function () { const h0 = W_UMB8C.hunt; if (wUmbBoon('hockey')) W_UMB8C.hunt = 99; try { return wWU8JShadowStep.apply(this, arguments); } finally { W_UMB8C.hunt = h0; } };
// (the Broken Bell: the toll is cheaper; the champion's own number is left as it is)
const wWU8JTollAtKickoff = wUmbTollAtKickoff;
wUmbTollAtKickoff = function (id) {
  const C = W_NADIR[id], off = wUmbBoon('boxing'); if (!C || !off || !C.toll) return wWU8JTollAtKickoff.apply(this, arguments);
  const t0 = C.toll; C.toll = Math.max(0, t0 - off); try { return wWU8JTollAtKickoff.apply(this, arguments); } finally { C.toll = t0; }
};
onHook('fightStart', () => {   // (a card champion's toll is paid at fightStart in u3, from its ref: cheaper there too)
  const W = RUN && RUN.pending && RUN.pending.world, off = wUmbBoon('boxing');
  if (B && W && W.kind === 'nadir' && W.ref && W.ref.toll && off) { const back = Math.min(off, W.ref.toll); RUN.gold += back; log(`The Broken Bell: ${back} gold of the toll back.`, 'sys'); W.ref.toll = 0; }
});
// (the Ash Ball: a blackout on this side costs less of the gold)
const wWU8JBlackout = wBlackout;
wBlackout = function () {
  const k = wUmbDark() ? wUmbBoon('football') : 0; if (!k) return wWU8JBlackout.apply(this, arguments);
  const g0 = RUN.gold, r = wWU8JBlackout.apply(this, arguments), lost = g0 - RUN.gold;
  if (lost > 0) { const back = Math.round(lost * k / 100); RUN.gold += back; if (back) wLog(`The Ash Ball: ${back} of that gold is still in your pocket.`, 'g'); }
  return r;
};

/* ---------- the Seal's edges ---------- */
const wWU8JFinaleEntry = wUmbFinaleEntry;
wUmbFinaleEntry = function () {
  const C = wWU8JFinaleEntry.apply(this, arguments), U = wUmb(); if (!C || !U) return C;
  const piece = wUmbFinaleSports()[Math.min(U.finale || 0, W_UMB5.rounds - 1)];
  // (u5 took one off for a piece won at the first try; a piece won well by its feat alone gets it here)
  if (wUmbWell(piece) && !wUmbClean(piece)) C.hexes = Math.max(0, W_UMB5.hexes - 1);
  return C;
};

/* ---------- the Seal panel, in the journal ---------- */
function wUmbSealPanel() {
  const U = wUmb(); if (!U) return '';
  const rows = Object.keys(W_UMB_PIECES).map(p => {
    const r = wUmbResonance(p), B8 = W_UMB8J.boons[p], F = wUmbFeat(wUmbChampOf(p) || ''), v = r ? B8.v[r - 1] : 0;
    return `<li class="${r ? 'wfhave' : ''}"><b>${esc(W_UMB_PIECES[p].n)}</b> <small>${r === 2 ? 'won well' : r ? 'won' : 'still out'}. ${esc(B8.n)}${B8.u ? ` (${B8.v[0]}${B8.u === '%' ? '%' : ' ' + B8.u}, or ${B8.v[1]}${B8.u === '%' ? '%' : ' ' + B8.u} won well)` : ''}${r ? `: now ${v}${B8.u === '%' ? '%' : B8.u ? ' ' + B8.u : ''}` : ''}.${F && !r ? ` The feat: ${esc(F.n)}.` : ''}</small></li>`;
  });
  return `<h4>The Seal</h4><p class="hint">Each piece you hold sings for you on the dark side, twice as strongly if you won it well (by its champion's feat, or at the first try). In the Seal's final, a game whose piece you won well draws a hex fewer.</p><ul class="wumbseal">${rows.join('')}</ul>`;
}
// (the chapter's tab: the panel goes inside its page, under what the herald said)
const wWU8JJournal = W_JTAB_FN.umbral;
W_JTAB_FN.umbral = function () {
  const r = wWU8JJournal.apply(this, arguments), U = wUmb();
  if (!U || U.sealed || !Array.isArray(r) || typeof r[1] !== 'string') return r;
  return [r[0], r[1].replace(/<\/div>\s*$/, wUmbSealPanel() + '</div>')];
};
const wWU8JStart = wStart;
wStart = function () { const r = wWU8JStart.apply(this, arguments); wUmbWellInit(); return r; };

/* ---------- How to play ---------- */
const wWU8JRenderHelp = renderHelp;
renderHelp = function () {
  wWU8JRenderHelp.apply(this, arguments);
  const h = $('wHelpUmbral'); if (!h || !wUmbOn() || $('wHelpUmbFeats')) return;
  const b = W_UMB8J.boons;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpUmbFeats"><b>Feats and the pieces' songs.</b> Every champion has a feat, named on their card: win on the brink, by a wide margin, after dark, without your powers, or at the first try. It's never required. Meet it, or win at the first try, and the piece is <b>won well</b>.
    Each piece you hold sings for you on the dark side, twice as strongly when won well: ${Object.keys(b).map(p => `${esc(W_UMB_PIECES[p].n)}: ${esc(b[p].n.toLowerCase())}`).join('; ')}.
    In the Seal's final, a game whose piece you won well draws a hex fewer, and a card game whose piece you won well starts with ${W_UMB8J.edgeBlock} Block. The journal's Umbral chapter lists every piece and what it does for you now.</p>`);
};
