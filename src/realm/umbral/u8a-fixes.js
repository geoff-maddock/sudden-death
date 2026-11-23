/* u8a: the small things found along the way (issue #111, phase A). Loads after u7-feel.js; changes earlier parts only
   by reassignment (saved originals carry the wWU8A prefix). The fixes that live inside an engine are in its own
   Umbral part: curling's Hoarfrost said on the status line (src/cr/parts/15-umbral.js, crHexSay), hockey's
   interference under The Hollow Whistle (src/hk/parts/16-umbral.js, hkWhistleK). How to play's wide tables scroll
   inside themselves at phone width (src/realm/w0.css, .whelp table).

   Brakka's own nature on boxing's pairing: the pairing's line of ratings named the kind's nature (a minotaur's Charges
   In) for every boxer, Brakka too, though the engine boxes a champion with their own (f.tr: Cracked Bronze). A boxer
   who brings a nature of their own shows it there instead.
   A champion's game is the standard length: golf, bowling and basketball took their length from Settings (holes,
   frames, minutes), so a champion's game (and a round of the Seal in that sport) could be cut short. It is now always
   the engine's standard length, the one the labs measured (W_UMB8A.len), whatever Settings says, and the card says so.
   Curling's champion already plays six ends (u4h).

   W_UMB8A, W_UMB8A_BARS, wUmbFixedLen, wUmbLenNote, wUmbBarTrim
   Wraps: wRingPairing (wWU8ARingPairing: the champion's own nature), wUmbGlKick, wUmbBlKick and wUmbBkTip
   (wWU8AUmbGlKick, wWU8AUmbBlKick, wWU8AUmbBkTip: the standard length), wUmbGlCard, wUmbBlCard and wUmbBkCard
   (wWU8AUmbGlCard, wWU8AUmbBlCard, wWU8AUmbBkCard: the card says so), wLinksBarNote, wLanesBarNote and wShedBarNote
   (wWU8ALinksBarNote, wWU8ALanesBarNote, wWU8AShedBarNote: no "from the next game" length note during a champion's
   game), renderHelp (wWU8ARenderHelp: a sentence in the Umbral section). */

const W_UMB8A = {
  // each sport's length setting (SET key), the engine's standard length and its words
  len: {
    links: { set: 'linksHoles', std: () => wGL.rules.holes, words: n => `${n} holes` },
    lanes: { set: 'lanesFrames', std: () => wBL.rules.frames, words: n => `${n} frames` },
    court: { set: 'courtMins', std: () => wBK.rules.mins, words: n => `${n} minutes` },
  },
};

/* ---------- boxing: the champion's own nature on the pairing ---------- */
const wWU8ARingPairing = wRingPairing;
wRingPairing = function (o) {
  const r = wWU8ARingPairing.apply(this, arguments), T = $('wRingPairT');
  if (T && o && o.theirs) T.querySelectorAll('tr:not(.wrtape)').forEach((tr, i) => {
    const f = o.theirs.fighters[i]; if (!f || !f.tr) return;
    const sm = tr.querySelector('td small'), K = wBX.traits[f.kind]; if (!sm) return;
    const own = `<span data-u8anature title="${esc(f.tr.desc)}">${esc(f.tr.n)}</span>`;
    const sp = K && [...sm.querySelectorAll('span[title]')].find(e => e.textContent === K.n);
    if (sp) sp.outerHTML = own; else if (!sm.querySelector('[data-u8anature]')) sm.insertAdjacentHTML('beforeend', ` · ${own}`);
  });
  return r;
};

/* ---------- a champion's game is the standard length ---------- */
// run fn with sport e's length setting at its standard, and put the setting back after (whatever fn does)
function wUmbFixedLen(e, fn) {
  const L = W_UMB8A.len[e], was = SET[L.set];
  SET[L.set] = L.std();
  try { return fn(); } finally { if (was === undefined) delete SET[L.set]; else SET[L.set] = was; }
}
const wWU8AUmbGlKick = wUmbGlKick, wWU8AUmbBlKick = wUmbBlKick, wWU8AUmbBkTip = wUmbBkTip;
wUmbGlKick = function () { const a = arguments; return wUmbFixedLen('links', () => wWU8AUmbGlKick.apply(this, a)); };
wUmbBlKick = function () { const a = arguments; return wUmbFixedLen('lanes', () => wWU8AUmbBlKick.apply(this, a)); };
wUmbBkTip = function () { const a = arguments; return wUmbFixedLen('court', () => wWU8AUmbBkTip.apply(this, a)); };
// the card: its length, after the prize
function wUmbLenNote(e) {
  const box = $('modalBox'), L = W_UMB8A.len[e]; if (!box || box.querySelector('[data-u8alen]')) return;
  const ps = box.querySelectorAll('.wmsg p.hint'), p = ps[ps.length - 1]; if (!p) return;
  p.insertAdjacentHTML('afterbegin', `<span data-u8alen>Always ${esc(L.words(L.std()))}, the standard game, whatever Settings says. </span>`);
}
const wWU8AUmbGlCard = wUmbGlCard, wWU8AUmbBlCard = wUmbBlCard, wWU8AUmbBkCard = wUmbBkCard;
wUmbGlCard = function () { const r = wWU8AUmbGlCard.apply(this, arguments); wUmbLenNote('links'); return r; };
wUmbBlCard = function () { const r = wWU8AUmbBlCard.apply(this, arguments); wUmbLenNote('lanes'); return r; };
wUmbBkCard = function () { const r = wWU8AUmbBkCard.apply(this, arguments); wUmbLenNote('court'); return r; };

// the bar: a champion's game (or a round of the Seal) is not followed by a game of the Settings length, so the bar's
// "(Holes: 3 from the next game; this one is 9.)" is left off while one is on (curling's six ends too: u4h)
const W_UMB8A_BARS = [
  ['wLinksNote', () => W_UMB4F.kind, () => WG && WG.lkg && WG.lkg.live, /\s*\(Holes: \d+ from the next game; this one is \d+\.\)/],
  ['wLanesNote', () => W_UMB4G.kind, () => WG && WG.lng && WG.lng.live, /\s*\(Frames: \d+ from the next game; this one is \d+\.\)/],
  ['wShedNote', () => W_UMB4H.kind, () => WG && WG.shg && WG.shg.live, /\s*\(Ends: \d+ from the next game; this one is \d+\.\)/],
];
function wUmbBarTrim(i) {
  const [id, kind, live, re] = W_UMB8A_BARS[i], L = live(), el = $(id);
  if (el && L && L.world && L.world.kind === kind()) el.textContent = el.textContent.replace(re, '');
}
const wWU8ALinksBarNote = wLinksBarNote, wWU8ALanesBarNote = wLanesBarNote, wWU8AShedBarNote = wShedBarNote;
wLinksBarNote = function () { const r = wWU8ALinksBarNote.apply(this, arguments); wUmbBarTrim(0); return r; };
wLanesBarNote = function () { const r = wWU8ALanesBarNote.apply(this, arguments); wUmbBarTrim(1); return r; };
wShedBarNote = function () { const r = wWU8AShedBarNote.apply(this, arguments); wUmbBarTrim(2); return r; };

/* ---------- How to play ---------- */
const wWU8ARenderHelp = renderHelp;
renderHelp = function () {
  wWU8ARenderHelp.apply(this, arguments);
  const h = $('wHelpUmbral'); if (!h || h.tagName !== 'DIV' || $('wHelpU8aLen')) return;
  const L = W_UMB8A.len;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpU8aLen"><b>No short games.</b> A champion's game, and a round of the Seal, is always the standard length: ${esc(L.links.words(L.links.std()))} of golf, ${esc(L.lanes.words(L.lanes.std()))} of bowling, ${esc(L.court.words(L.court.std()))} of basketball, whatever Settings says.</p>`);
};
