/* w81: powers on the court (issue #77, phase 6), the Realm's side of 14-powers.js.
   - Each player brings one of their kind's two offense powers and one of its two defense powers (p.bkPw: { off, def },
     0 or 1), picked on the Court tab and kept; it reaches the engine through wCourtPlayer. Call-ups and the clubs'
     players bring the first of each.
   - In Manage and You play the calls panel gains a Powers block: your mana and spirit; Auto powers (on: your coach casts
     as a Knight would; off: only what you queue); the power you queue for your next possession at each end (from your
     five, with what it does and whether it suits your set: the power tips); your ultimate (once a game, when the
     crowd's spirit is high enough), which leaves a zone for three possessions; and the situation powers when the moment
     fits (Clutch, Full-court Press, Ice It).
   - How to play: how powers work, and every kind's powers in a table (#wCourtPowHow inside Basketball: how it works;
     #wHelpCourtPow).
   Wraps: wCourtPlayer (wW81CourtPlayer: pw), wCourtRow (wW81CourtRow: the two picks), wRenderCamp (wW81RenderCamp: their
   handlers), wCourtCalls (wW81CourtCalls: the Powers block), wCourtHowHTML (wW81CourtHowHTML), renderHelp
   (wW81RenderHelp). */

const wBkPw = p => Object.assign({ off: 0, def: 0 }, p && p.bkPw);
const wW81CourtPlayer = wCourtPlayer;
wCourtPlayer = function (p) { const t = wW81CourtPlayer(p); if (p && p.bkPw) t.pw = wBkPw(p); return t; };
// a player's pick for an end (key: a roster id; call-ups don't choose): '' when it took
function wCourtSetPw(key, role, i) {
  const p = typeof key === 'number' ? wPlayer(key) : null; if (!p || !['off', 'def'].includes(role)) return '';
  p.bkPw = Object.assign(wBkPw(p), { [role]: i === 1 ? 1 : 0 }); wSave(); return '';
}
const wW81CourtRow = wCourtRow;
wCourtRow = function (k, C) {
  const html = wW81CourtRow(k, C), p = wCourtWho(k), B = p && wBK.powerBook[p.kind]; if (!B || typeof k !== 'number') return html;
  const pw = wBkPw(p), sel = (role, a, b) => `<label class="wsvl">${role === 'off' ? 'Offense power' : 'Defense power'} <select data-kpw="${role}" aria-label="${esc(p.n)}'s ${role === 'off' ? 'offense' : 'defense'} power">${[a, b].map((x, i) => `<option value="${i}" title="${esc(x.desc)}"${pw[role] === i ? ' selected' : ''}>${esc(x.n)} (${x.cost})</option>`).join('')}</select></label>`;
  return html.replace('<div class="wpa">', `<div class="wpa">${sel('off', B.off, B.off2)}${sel('def', B.def, B.def2)}`);
};
const wW81RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW81RenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'court') return;
  body.querySelectorAll('[data-kpw]').forEach(s => s.onchange = () => { const k = s.closest('[data-kid]').dataset.kid; wCampSay(wCourtSetPw(/^k\d+$/.test(k) ? k : +k, s.dataset.kpw, +s.value)); });
};

/* ---------- the Powers block in the calls panel ---------- */
const W_BK_FITN = { shot: 'Spread for three, Motion and Feed the hot hand', drive: 'Isolation, Post up and Pick and roll', pass: 'Motion and Pick and roll' };
// a power's tip: what it does, what it costs, the sets it suits, and whether it suits yours now
function wCourtPowTip(o, set) {
  const fits = wBK.fits[o.fits], now = !fits || fits.includes(set);
  return `${o.desc} ${o.cost} mana, and stamina from ${o.who}. ${fits ? `Suits ${W_BK_FITN[o.fits]}.` : 'Suits any set.'} ${now ? 'It suits your set now.' : 'It doesn\'t suit your set now.'}${o.ok ? '' : ` Not now: ${o.why}.`}`;
}
let W_COURT_POWKEY = '';
const wW81CourtCalls = wCourtCalls;
wCourtCalls = function (force) {
  wW81CourtCalls(force);
  const box = $('wCourtCalls'); if (box.hidden || !box.querySelector('.wccrows')) { W_COURT_POWKEY = ''; return; }
  const you = wBK.you, G = wBK.G; if (!G || !G.powers || !G.mana) return;
  if (!box.querySelector('.wccpow')) box.insertAdjacentHTML('beforeend', '<div class="wccpow"></div>');
  // (the key, read live: what the block shows, and what decides the situation powers: the beat, the clock, the score)
  const q0 = wBK.queued, key = `${wBK.ver}|${wBK.phase}|${Math.floor(G.clock / 5)}|${G.score}|${Math.floor(G.mana[you] + 1e-9)}|${Math.round(G.spirit[you])}|${wBK.auto}|${JSON.stringify(q0)}|${G.on[you].map(ri => Math.round(G.stam[you][ri] / 10)).join()}`;
  if (!force && key === W_COURT_POWKEY) return;
  if (!force && (W_COURT_DOWN || (box.contains(document.activeElement) && document.activeElement.tagName === 'SELECT'))) return;
  W_COURT_POWKEY = key;
  const P = wBK.powers(you), mine = G.call[you], q = q0 || {};
  const list = role => { const L = wBK.powerList(you, role), cur = q[role], set = role === 'off' ? mine.off : (G.cur && G.cur.side !== you ? G.cur.off : '');
    return `<select data-cpow="${role}" aria-label="Your ${role === 'off' ? 'offense' : 'defense'} power for the next possession"><option value="">${wBK.auto ? 'Your coach picks' : 'None'}</option>${L.map(o => `<option value="${o.ri}:${o.id}" title="${esc(wCourtPowTip(o, set))}"${cur && cur.ri === o.ri && cur.id === o.id ? ' selected' : ''}${o.ok ? '' : ' disabled'}>${esc(o.n)} (${esc(o.who)}, ${o.cost})</option>`).join('')}</select>`; };
  const ults = wBK.ultOptions(you), sits = wBK.sitOptions(you).filter(s => s.ok);
  const cast = (P.cast || []).filter(c => c.side === you).map(c => c.n);
  box.querySelector('.wccpow').innerHTML = `<div class="wccrow"><span class="wccl">Powers</span><span class="hint">Mana <b>${P.mana}</b> of ${wBK.powerRules.mana.max} · spirit <b>${P.spirit}</b>${P.ultUsed ? ' · ultimate used' : ` (the ultimate needs ${wBK.powerRules.spirit.ult})`}${cast.length ? ` · cast this possession: ${esc(cast.join(', '))}` : ''}</span>
      <label class="hint"><input type="checkbox" id="wCourtAuto" ${wBK.auto ? 'checked' : ''}> Auto powers</label></div>
    <div class="wccrow"><span class="wccl"></span><label class="hint">Next offense ${list('off')}</label> <label class="hint">Next defense ${list('def')}</label></div>
    <div class="wccrow"><span class="wccl">Ultimate</span>${ults.map(u => `<button class="ghost" data-cult="${u.ri}" ${u.ok ? '' : 'disabled'} title="${esc(`${u.desc} A zone for ${wBK.powerRules.ultPoss} possessions. ${u.ok ? '' : `Not now: ${u.why}.`}`)}">${esc(u.n)} <small>${esc(u.who)}</small></button>`).join('')}</div>
    ${sits.length ? `<div class="wccrow"><span class="wccl">Now</span>${sits.map(s => `<button class="ghost" data-csit="${s.id}" title="${esc(s.desc)}">${esc(s.n)} (${s.cost})</button>`).join('')}</div>` : ''}`;
};
$('wCourtCalls').addEventListener('change', e => {
  const s = e.target; if (s.id === 'wCourtAuto') { wBK.auto = s.checked; wCourtCalls(true); return; }
  if (!s.dataset || !s.dataset.cpow) return;
  const [ri, id] = s.value ? s.value.split(':') : [null, null], r = wBK.queue(s.dataset.cpow, ri == null ? null : +ri, id);
  if (r) wCourtCallSay(r); wCourtCalls(true);
});
$('wCourtCalls').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.cult != null) { const r = wBK.ult(+b.dataset.cult); if (r) wCourtCallSay(r); wCourtCalls(true); }
  else if (b.dataset.csit) { const r = wBK.sit(b.dataset.csit); if (r) wCourtCallSay(r); wCourtCalls(true); }
});

/* ---------- How to play ---------- */
const wW81CourtHowHTML = wCourtHowHTML;
wCourtHowHTML = function () {
  const R = wBK.powerRules, S = wBK.sits, row = (k, B) => `<tr><td>${esc(wKindName(k))}</td>${['off', 'off2', 'def', 'def2', 'ult'].map(r => `<td><b>${esc(B[r].n)}</b>${B[r].cost ? ` (${B[r].cost})` : ''}: ${esc(B[r].desc)}</td>`).join('')}</tr>`;
  return wW81CourtHowHTML() + `<section id="wCourtPowHow"><p class="hint"><b>Powers.</b> Every kind has an offense power and a defense power, and a second of each: each player brings one of each pair, picked on the Court tab. A side casts at most one power a possession, at its start: the offense from its five's offense powers, the defense from theirs. A power costs team <b>mana</b> (shown as pips under the score: ${R.mana.start} to start, up to ${R.mana.max}, half a point each time the other side scores, and one at each break) and stamina from whoever casts it (${R.sta.base} plus ${R.sta.per} a mana; nobody below ${R.sta.min} can cast).</p>
  <p class="hint"><b>The roar and the ultimate.</b> The crowd's <b>spirit</b> (the bar under the score) fills on big plays: a dunk, a three, a block, a steal, a run, and the Charter Court's roar. At ${R.spirit.ult} it pays for your side's <b>ultimate</b>, once a game: the kind's own, which leaves a zone on the floor for ${R.ultPoss} possessions. And when someone on fire misses, ${R.spirit.keep} spirit keeps them on fire one miss longer, by itself, once a streak (not when it would cost an ultimate you could pay for).</p>
  <p class="hint"><b>Situation powers.</b> The team's, once a game each, for mana, when the moment fits: ${Object.values(S).map(s => `<b>${esc(s.n)}</b> (${esc(s.desc.replace(/\.$/, ''))}; ${s.cost} mana)`).join(', ')}.</p>
  <p class="hint"><b>Who casts.</b> The other coach by skill: a Squire now and then at random, a Knight what suits its set, an Archmage only that, keeping its spirit for a close finish or to stop a run. In Manage and You play, the calls panel has your powers: with <b>Auto powers</b> on, your coach casts as a Knight would; you can also pick the power for your next possession at each end yourself (the tip says what it does and whether it suits your set), press your ultimate, and use a situation power when it lights up.</p>
  <table class="wrpow wcpow"><tr><th>Kind</th><th>Offense</th><th>Second offense</th><th>Defense</th><th>Second defense</th><th>Ultimate</th></tr>${Object.entries(wBK.powerBook).map(([k, B]) => row(k, B)).join('')}</table></section>`;
};
const wW81RenderHelp = renderHelp;
renderHelp = function () {
  wW81RenderHelp();
  const after = $('wHelpCourtGame'); if (!after || $('wHelpCourtPow')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpCourtPow"><b>Powers on the court.</b> Every kind has two offense and two defense powers on the court; pick each player's on the Court tab. Each side casts at most one a possession, for team mana and the caster's stamina. The crowd's spirit, filled by dunks, threes, blocks, steals and runs, pays for one ultimate a game (a zone on the floor for three possessions) and keeps a hot hand burning one miss longer. Clutch, Full-court Press and Ice It are the team's, once a game, when the moment fits (see Basketball: how it works).</p>`);
};
