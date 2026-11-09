/* w75: boxing powers, phase 4 of issue #61. The engine's side is src/bx/parts/11-powers.js (sp2 for every kind, the
   spirit meter); this is the Realm's.
   Settled with Geoff: the choice is set on the Team screen and kept until you change it (not picked per card), and
   powers run on a new spirit meter as well as stamina.
   p.bxSp: 'sp' or 'sp2', the special a boxer brings (plain JSON on the roster player; 'sp' when unset). The Ring tab
   has a Special list on each boxer whose kind has two (the superstars get their second in phase 6); it can't change
   while a card is on. A club's boxers bring one too, the same one each time (by their name), and the pairing and the
   tale of the tape show which.
   wRingSetSp(pid, which) returns '' when it worked, or why not.
   Wraps: wBxFighter (wW75BxFighter: the pick goes in), wRingOpp (wW75RingOpp: theirs), wRingTapeOf (wW75RingTapeOf:
   the special they bring), wRingPairing (wW75RingPairing: their specials on the pairing), wRingTabRow and
   wRenderCamp (wW75RingTabRow, wW75RenderCamp: the Special list), wBxCard (wW75BxCard: the special on the stats card),
   renderHelp (wW75RenderHelp: #wHelpRingSpirit). */

const W_RING_SP = { ids: ['sp', 'sp2'] };
const wRingHasTwo = kind => !!(wBX.powerBook[kind] && wBX.powerBook[kind].sp2);
const wRingSpOf = p => p && p.bxSp === 'sp2' && wRingHasTwo(p.kind) ? 'sp2' : 'sp';
// the special a fighter brings, from the book: { n, desc }
const wRingSpPow = f => { const B = wBX.powerBook[f.kind]; return B ? B[f.sp === 'sp2' && B.sp2 ? 'sp2' : 'sp'] : null; };
function wRingSetSp(pid, which) {
  const p = wPlayer(pid);
  if (!p) return 'Nobody by that name.';
  if (!W_RING_SP.ids.includes(which)) return '';
  if (!wRingHasTwo(p.kind)) return `${p.n} has only the one special.`;
  if (wRingLive()) return 'Not while a card is on: finish it first.';
  p.bxSp = which; wSave(); return '';
}

/* ---------- into the ring ---------- */
const wW75BxFighter = wBxFighter;
wBxFighter = function (p) { const f = wW75BxFighter(p); f.sp = wRingSpOf(p); return f; };
// a club's boxer: the same special every time, picked by their name
const wW75RingOpp = wRingOpp;
wRingOpp = function (club, tier, taken) {
  const side = wW75RingOpp(club, tier, taken);
  for (const f of side.fighters) f.sp = wRingHasTwo(f.kind) && seedHash(0x5b2, f.n + ':' + f.kind) % 2 ? 'sp2' : 'sp';
  return side;
};

/* ---------- on screen ---------- */
// the tape: the special they bring
const wW75RingTapeOf = wRingTapeOf;
wRingTapeOf = function (f) {
  const t = wW75RingTapeOf(f), sp = wRingSpPow(f);
  if (t.P && sp) t.P = Object.assign({}, t.P, { sp });
  return t;
};
// the pairing: the special each of theirs brings
const wW75RingPairing = wRingPairing;
wRingPairing = function (o) {
  const r = wW75RingPairing(o), T = $('wRingPairT');
  if (T && o && o.theirs) T.querySelectorAll('tr').forEach((tr, i) => { const f = o.theirs.fighters[i], sp = f && wRingSpPow(f), td = tr.querySelector('td');
    if (sp && td) td.insertAdjacentHTML('beforeend', `<br><small data-rsppair title="${esc(sp.desc)}">Special: <b>${esc(sp.n)}</b></small>`); });
  return r;
};
// the Ring tab: the Special list on each boxer whose kind has two
const wW75RingTabRow = wRingTabRow;
wRingTabRow = function (p) {
  const h = wW75RingTabRow(p); if (!wRingHasTwo(p.kind)) return h;
  const B = wBX.powerBook[p.kind], cur = wRingSpOf(p), live = wRingLive();
  const sel = `<label class="wsvl wrsp">Special <select data-rsp="${p.id}" aria-label="${esc(p.n)}'s special"${live ? ' disabled title="Not while a card is on"' : ''}>${W_RING_SP.ids.map(k => `<option value="${k}"${k === cur ? ' selected' : ''} title="${esc(B[k].desc)}">${esc(B[k].n)}</option>`).join('')}</select></label><small class="wrspd">${esc(B[cur].desc)}</small>`;
  return h.replace(/<\/div><\/li>\s*$/, `${sel}</div></li>`);
};
const wW75RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW75RenderCamp();
  if (WCAMP.tab !== 'ring') return;
  const body = $('wCampBody'); if (!body) return;
  body.querySelectorAll('[data-rsp]').forEach(s => s.onchange = () => { WCAMP.msg = wRingSetSp(+s.dataset.rsp, s.value); wRenderCamp(); });
  if (WCAMP.msg && !body.querySelector('.wcmsg')) body.insertAdjacentHTML('afterbegin', `<p class="wbad wcmsg" role="alert">${esc(WCAMP.msg)}</p>`);
  WCAMP.msg = '';
};
// the stats card's Boxing block: the special they bring
const wW75BxCard = wBxCard;
wBxCard = function (p) {
  const h = wW75BxCard(p), B = wBX.powerBook[p.kind]; if (!h || !B) return h;
  const sp = B[wRingSpOf(p)];
  return h.replace('<div class="wbdbars">', `<p class="wbdpos" data-rspcard>Special: <b>${esc(sp.n)}</b>. ${esc(sp.desc)}${wRingHasTwo(p.kind) ? ' (Change it on the Ring tab.)' : ''}</p><div class="wbdbars">`);
};

/* ---------- How to play ---------- */
const wW75RenderHelp = renderHelp;
renderHelp = function () {
  wW75RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpRingSpirit')) return;
  const S = wBX.spirit, rows = Object.entries(wBX.powerBook).filter(([, P]) => P.sp2).map(([k, P]) => `<tr><td>${esc(wKindName(k))}</td><td><b>${esc(P.sp.n)}</b>: ${esc(P.sp.desc)}</td><td><b>${esc(P.sp2.n)}</b>: ${esc(P.sp2.desc)}</td></tr>`).join('');
  h.insertAdjacentHTML('beforeend', `<div id="wHelpRingSpirit"><p class="hint"><b>Spirit, and a choice of special.</b> Every boxer has a spirit meter (the violet bar under their breath). It fills as they land clean punches and as they take punishment (a blocked punch counts a little), never from powers. A special needs ${S.sp} spirit and an ultimate ${S.ult}, spent when cast, as well as the stamina; each boxer starts a bout with ${S.start}. A round of hard work fills about a third of the bar, so a special most rounds, or save up for the ultimate. Every league kind has two specials: pick the one each boxer brings on the Ring tab of the Team screen, and it stays until you change it. The other club's boxers bring one too; the pairing and the tale of the tape say which.</p>
    <table class="wrsp2"><tr><th>Kind</th><th>First special</th><th>Second special</th></tr>${rows}</table></div>`);
};
