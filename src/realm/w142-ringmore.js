/* w142: boxing's situation powers and curses (issue #115, phase 3), by the shape of the later sports; the engine's side
   is src/bx/parts/15-more.js, and the superstars' curses are at the foot of ring/r0-stars.js.
   On in every bout the Realm boxes (Play, Manage, Simulate, the Anvil Belt, the Umbral, the exhibition BOUT); in LAB mode
   off unless the lab sets W_BXPOW.lab (the bxpow it boxes), so the other balance numbers stand. A bout whose options
   already say (bxpow, even null) boxes them.
   Situation powers (Off the Canvas, the Last Round, Saved by the Bell): your corner's, once a bout each, for spirit,
   when the moment fits. In You box they light up on the pad when it is their moment; in You corner your fighter calls
   them as a Knight would. Curses: seven league kinds and the six superstars have one, cast on the other fighter for
   spirit (C, or Curse on the pad); in You corner your fighter casts it as a Knight would. Between rounds, Wash the
   curse on the bar has the cut-man wash it off your fighter in place of a patch (your corner says which).
   Wraps: wRingBarNote (wW142RingBarNote: the wash and the pad), wBxCard (wW142BxCard: the curse on the stats card),
   renderHelp (wW142RenderHelp: #wHelpRingMore, and a section in Boxing: how it works); and wBX.start, wBX.cardStart,
   wBX.simCard, wBX.simBout (bxpow goes in). */

const W_BXPOW = { on: true, lab: null };
function wBxPowRules() {
  if (!W_BXPOW.on) return null;
  if (LAB) return W_BXPOW.lab ? JSON.parse(JSON.stringify(W_BXPOW.lab)) : null;
  return { sit: true, curse: true };
}
const wBxPowNext = o => { if (!o || o.bxpow !== undefined) return o; const P = wBxPowRules(); return P ? Object.assign({}, o, { bxpow: P }) : o; };
const wW142Start = wBX.start, wW142CardStart = wBX.cardStart, wW142SimCard = wBX.simCard, wW142SimBout = wBX.simBout;
wBX.start = o => wW142Start(wBxPowNext(o));
wBX.cardStart = o => wW142CardStart(wBxPowNext(o));
wBX.simCard = o => wW142SimCard(wBxPowNext(o));
wBX.simBout = o => wW142SimBout(wBxPowNext(o));
// a kind's curse (the superstars' too), or null
const wRingCurseOf = kind => wBX.curses[kind] || null;

/* ---------- the bar and the pad ---------- */
$('wRingPatch').insertAdjacentHTML('afterend', '<button class="ghost" id="wRingWash" hidden></button>');
$('wRingWash').addEventListener('click', () => { wBX.wash(); wRingBarNote(); });
$('wRingPad').insertAdjacentHTML('beforeend', '<button class="ghost" data-rpad="cu" data-key="C" title="C" hidden>Curse</button><span id="wRingSits"></span>');
$('wRingSits').addEventListener('click', e => { const b = e.target.closest('[data-rsit]'); if (!b || b.disabled) return; const why = wBX.castSit(b.dataset.rsit); if (why) b.title += ` (${why})`; W_RING_SITKEY = ''; wRingMorePad(); });
let W_RING_SITKEY = '';
function wRingMorePad() {
  const G = wBX.G, M = G && G.F && wBX.bxp ? wBX.more(wBX.you) : null, cu = $('wRingPad').querySelector('[data-rpad="cu"]'), box = $('wRingSits');
  cu.hidden = !M || !M.cu;
  if (M && M.cu) { cu.textContent = M.cu.n; cu.disabled = !M.cu.ok; cu.title = `Curse (C, once a bout, ${wBX.spirit.cu} spirit): ${M.cu.desc} It lasts the rest of the round and the next, unless their cut-man washes it off.${M.cu.ok ? '' : ` (${M.cu.why})`}`; }
  // the situation powers whose moment it is
  const sits = M ? M.sit.filter(s => s.fits) : [], key = JSON.stringify(sits.map(s => [s.k, s.ok]));
  if (key === W_RING_SITKEY) return;
  W_RING_SITKEY = key;
  box.innerHTML = sits.map(s => { const S = wBX.sits[s.k]; return `<button class="ghost wrsit" data-rsit="${s.k}" ${s.ok ? '' : 'disabled'} title="${esc(`${S.desc} Once a bout, ${S.cost.spirit} spirit${S.cost.sta ? ` and ${S.cost.sta} stamina` : ''}.${s.ok ? '' : ` (${s.why})`}`)}">✦ ${esc(S.n)}</button>`; }).join('');
}
setInterval(() => { if (WBX && UI.view === 'ring' && wBX.mode === 'play' && !$('wRingPad').hidden) wRingMorePad(); }, 250);
const wW142RingBarNote = wRingBarNote;
wRingBarNote = function () {
  wW142RingBarNote();
  if (!WBX) return;
  const G = wBX.G, w = wBX.wait, me = G && G.F ? G.F[wBX.you] : null, b = $('wRingWash'), on = me && me.curse;
  b.hidden = !on;
  if (on) {
    b.textContent = `Wash off the ${on.n}`;
    b.disabled = !w || wBX.phase !== 'corner' || me.patched === G.round;
    b.title = `The cut-man washes the ${on.n} off your fighter, in place of a patch this break (it would last all of round ${on.until} otherwise).${w && w.wash ? ' Your corner says now.' : ''}`;
    b.classList.toggle('on', !!w && !!w.wash);
    if (w && w.wash) $('wRingNote').textContent += ` And wash off the ${on.n}.`;
  }
  W_RING_SITKEY = ''; wRingMorePad();
};

/* ---------- the stats card ---------- */
const wW142BxCard = wBxCard;
wBxCard = function (p) {
  const h = wW142BxCard(p), C = p && wRingCurseOf(p.kind); if (!h || !C) return h;
  return h.replace('<div class="wbdbars">', `<p class="wbdpos" data-rcucard>Curse: <b>${esc(C.n)}</b>. ${esc(C.desc)}</p><div class="wbdbars">`);
};

/* ---------- How to play ---------- */
function wRingMoreHTML(id) {
  const S = wBX.sits, sp = wBX.spirit, C = Object.entries(wBX.curses);
  return `<div${id ? ` id="${id}"` : ''}><p class="hint"><b>Situation powers.</b> Your corner's, once a bout each, paid with spirit, and only when the moment fits: ${Object.values(S).map(x => `<b>${esc(x.n)}</b> (${x.cost.spirit} spirit${x.cost.sta ? `, ${x.cost.sta} stamina` : ''}): ${esc(x.desc.charAt(0).toLowerCase() + x.desc.slice(1))}`).join(' ')} In You box they light up on the pad under the ring when it's their moment; in You corner your fighter calls them, as the other corner does.</p>
  <p class="hint"><b>Curses.</b> Some kinds have a curse, a third power beside the special and the ultimate: once a bout, ${sp.cu} spirit and no stamina, cast on the other fighter. It stays on them for the rest of the round and all of the next (one cast in the last round lasts the bout), and shows over them in violet. A curse makes their punches slower, their guard leakier, their breath slower to come back, or their next special or ultimate dearer. Between rounds the cut-man can wash a curse off instead of patching a cut, so the corner chooses: <b>Wash off</b> on the bar, beside the cut-man (your corner says which). Press C or Curse on the pad to cast yours.</p>
  <table class="wrsp2"><tr><th>Kind</th><th>Curse</th></tr>${C.map(([k, c]) => `<tr><td>${esc(wKindName(k))}</td><td><b>${esc(c.n)}</b>: ${esc(c.desc)}</td></tr>`).join('')}</table></div>`;
}
const wW142RenderHelp = renderHelp;
renderHelp = function () {
  wW142RenderHelp();
  const how = $('wRingHow'); if (how && !$('wRingHowMore')) how.insertAdjacentHTML('beforeend', wRingMoreHTML('wRingHowMore'));
  const h = $('wHelp'); if (!h || $('wHelpRingMore')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpRingMore"><b>Boxing: situation powers and curses.</b> Three powers belong to your corner, once a bout each, for spirit, when the moment fits: Off the Canvas just up from a knockdown, the Last Round when behind or level on the cards, and Saved by the Bell when hurt with the bell close. Seven kinds and the superstars also have a curse, cast on the other fighter for spirit: it lasts the rest of the round and the next, unless their cut-man washes it off between rounds in place of a patch. Boxing: how it works has them all.</p>`);
};
