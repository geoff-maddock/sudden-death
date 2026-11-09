/* w76: football powers, phase 5 of issue #61. The engine's side is src/gf/parts/14-powers.js (GF_POW2, GF_SIT); this
   is the Realm's.
   p.gfPw: { off: 0 | 1, def: 0 | 1 }, the offense and defense power a player brings (0 the first of their kind's, 1
   the second; plain JSON on the roster player, set on the Seven tab and kept, as the special is for boxing on the Ring
   tab, w75). It can't change while a game is on. A club's players bring one of each too, the same each time (by their
   name), and the lineup on the field names them. The situation powers need nothing: they show in the powers row when
   the moment fits (w45 lists them like any other).
   wSevenSetPw(pid, role, which) returns '' when it worked, or why not.
   Wraps: wSevenPlayer (wW76SevenPlayer: the picks go in), wGridOpp (wW76GridOpp: theirs), wSevenRow and wRenderCamp
   (wW76SevenRow, wW76RenderCamp: the two lists), renderHelp (wW76RenderHelp: #wHelpGfPow2). wGridPowNames is w42's
   lineup hook. */

const wGridHasTwo = kind => !!(wGF.powerBook[kind] && wGF.powerBook[kind].off2);
const wGfPwOf = p => ({ off: p && p.gfPw && p.gfPw.off === 1 ? 1 : 0, def: p && p.gfPw && p.gfPw.def === 1 ? 1 : 0 });
// the powers a player brings, from the book: { off, def, ult }
function wGridPowNames(p) {
  const B = wGF.powerBook[p.kind] || {}, pw = p.pw || wGfPwOf(p);
  return { off: pw.off === 1 && B.off2 ? B.off2 : B.off, def: pw.def === 1 && B.def2 ? B.def2 : B.def, ult: B.ult };
}
function wSevenSetPw(pid, role, which) {
  const p = wPlayer(pid);
  if (!p) return 'Nobody by that name.';
  if (!['off', 'def'].includes(role) || ![0, 1].includes(which)) return '';
  if (!wGridHasTwo(p.kind)) return `${p.n} has only the one power each way.`;
  if (wGridLive()) return 'Not while a football game is on: finish it first.';
  p.gfPw = Object.assign(wGfPwOf(p), { [role]: which }); wSave(); return '';
}

/* ---------- onto the field ---------- */
const wW76SevenPlayer = wSevenPlayer;
wSevenPlayer = function (p) { const s = wW76SevenPlayer(p); if (p && wGridHasTwo(p.kind)) s.pw = wGfPwOf(p); return s; };
// a club's players: the same picks every time, by their name
const wW76GridOpp = wGridOpp;
wGridOpp = function (club, tier) {
  const team = wW76GridOpp(club, tier);
  for (const m of team.roster) if (wGridHasTwo(m.kind)) { const h = seedHash(0x6f1, m.n + ':' + m.kind); m.pw = { off: h & 1, def: (h >> 1) & 1 }; }
  return team;
};

/* ---------- the Seven tab ---------- */
const wW76SevenRow = wSevenRow;
wSevenRow = function (k, out) {
  const h = wW76SevenRow(k, out), p = typeof k === 'number' ? wPlayer(k) : null;
  if (!p || !wGridHasTwo(p.kind)) return h;
  const B = wGF.powerBook[p.kind], cur = wGfPwOf(p), live = wGridLive();
  const sel = (role, a, b) => `<label class="wsvl wgpw">${role === 'off' ? 'Offense power' : 'Defense power'} <select data-gpw="${role}" data-gpwid="${p.id}" aria-label="${esc(p.n)}'s ${role === 'off' ? 'offense' : 'defense'} power"${live ? ' disabled title="Not while a game is on"' : ''}>
    ${[a, b].map((P, i) => `<option value="${i}"${cur[role] === i ? ' selected' : ''} title="${esc(P.desc)}">${esc(P.n)} (${P.cost}◆)</option>`).join('')}</select></label>`;
  return h.replace(/(<div class="wpa">)/, `$1${sel('off', B.off, B.off2)}${sel('def', B.def, B.def2)}`);
};
const wW76RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW76RenderCamp();
  if (WCAMP.tab !== 'seven') return;
  const body = $('wCampBody'); if (!body) return;
  body.querySelectorAll('[data-gpw]').forEach(s => s.onchange = () => { const m = wSevenSetPw(+s.dataset.gpwid, s.dataset.gpw, +s.value); wCampSay(m); });
};

/* ---------- How to play ---------- */
function wGridPow2HowHTML(id) {
  const B = wGF.powerBook, S = wGF.situations;
  const rows = Object.keys(B).filter(k => B[k].off2).map(k => `<tr><td>${esc(wCap(k))}</td><td><b>${esc(B[k].off2.n)}</b> <small>${B[k].off2.cost}◆</small>: ${esc(B[k].off2.desc)}</td><td><b>${esc(B[k].def2.n)}</b> <small>${B[k].def2.cost}◆</small>: ${esc(B[k].def2.desc)}</td></tr>`).join('');
  const sit = Object.values(S).map(P => `<b>${esc(P.n)}</b> (${P.cost}◆, ${esc(P.when)}): ${esc(P.desc.replace(/^[^:]*: /, ''))}`).join(' ');
  return `<div${id ? ` id="${id}"` : ''}><p class="hint"><b>Second powers, and situation powers.</b> Every league kind has a second power on offense and on defense. Pick the one each of your players brings, each way, on the Seven tab of the Team screen; it stays until you change it (not during a game). The other club's players bring theirs, named in the lineup on the field. And three powers belong to the team, not a player: once a game each, no stamina, and only when the moment fits, when they appear in the powers row. ${sit} The coaches use them too.</p>
    <table class="wrsp2"><tr><th>Kind</th><th>Second offense power</th><th>Second defense power</th></tr>${rows}</table></div>`;
}
W_GRID_HOW.push(() => wGridPow2HowHTML(''));
const wW76RenderHelp = renderHelp;
renderHelp = function () {
  wW76RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpGfPow2')) return;
  h.insertAdjacentHTML('beforeend', wGridPow2HowHTML('wHelpGfPow2'));
};
