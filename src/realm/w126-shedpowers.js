/* w126: powers at the Shed (issue #102, phase 6), as w117 is the Lanes'. Every game at the Shed has the monster powers
   (13-powers.js): team mana from shots made and ends scored; each curler's draw power and hit power (one of two each,
   picked on the Shed tab: p.crPw { draw, hit }, 0 or 1); one ultimate a game for the roar, which marks the end; Steady
   for the skip in the last end; and the situation powers (the Hammer, the Steal, Extra End). The CPU casts by its skill.
   Your stone's rows gain Powers: mana and the roar, the thrower's power for the shot called (P), the ultimate (U),
   Steady (K), the situation powers that fit, and the bench's tip. In Manage, Auto powers lets your captain cast for you.
   The end board says the end's mark.
   Wraps: wShedGame (wW126ShedGame: powers on), wShedPlayer (wW126ShedPlayer: the curler's two powers), wFourCrRow
   (wW126FourCrRow: the power picks), wRenderCamp (wW126RenderCamp: the picks' changes), wShedRows (wW126ShedRows: the
   Powers row and Auto powers), wShedBoard (wW126ShedBoard: the mark), wShedHowHTML (wW126ShedHow: powers), renderHelp
   (wW126RenderHelp: #wHelpShedPowers). */

const wW126ShedGame = wShedGame;
wShedGame = function (opts) { return wW126ShedGame(Object.assign({ powers: true }, opts || {})); };
const wW126ShedPlayer = wShedPlayer;
wShedPlayer = function (p) { const m = wW126ShedPlayer(p); m.pw = { draw: p.crPw && p.crPw.draw === 1 ? 1 : 0, hit: p.crPw && p.crPw.hit === 1 ? 1 : 0 }; return m; };
function wCrSetPw(k, which, v) { const p = wFourCrWho(k); if (!p || (which !== 'draw' && which !== 'hit')) return ''; p.crPw = Object.assign({ draw: 0, hit: 0 }, p.crPw, { [which]: v === 1 ? 1 : 0 }); wSave(); return ''; }
// the two a curler of this kind picks between, for a draw or a hit
const wCrPowPair = (kind, which) => [wCR.pow, wCR.pow2].map(T => (T[kind] || T.goblin)[which === 'draw' ? 0 : 1]);

const wW126FourCrRow = wFourCrRow;
wFourCrRow = function (k, C) {
  const html = wW126FourCrRow(k, C), p = wFourCrWho(k); if (!p) return html;
  const sel = ['draw', 'hit'].map(w => { const [a, b] = wCrPowPair(p.kind, w), cur = p.crPw && p.crPw[w] === 1 ? 1 : 0;
    return `<label class="wsvl" title="${esc(`${a.n}: ${a.desc} / ${b.n}: ${b.desc}`)}">${w === 'draw' ? 'Draw power' : 'Hit power'} <select data-crpw="${w}" aria-label="${esc(p.n)}'s ${w} power"><option value="0"${cur ? '' : ' selected'}>${esc(a.n)}</option><option value="1"${cur ? ' selected' : ''}>${esc(b.n)}</option></select></label>`; }).join('');
  return html.replace(/(<label class="wsvl">Position[\s\S]*?<\/label>)/, `$1${sel}`);
};
const wW126RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW126RenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'shed') return;
  const keyOf = el => { const k = el.closest('[data-cid]').dataset.cid; return /^\d+$/.test(k) ? +k : k; };
  body.querySelectorAll('[data-crpw]').forEach(s => s.onchange = () => wCampSay(wCrSetPw(keyOf(s), s.dataset.crpw, +s.value)));
};

// your stone's Powers row, and Manage's Auto powers
$('wShedRows').insertAdjacentHTML('afterend', '<div id="wShedPowRow" class="wccalls" hidden><div class="wccrow"><span class="wccl">Powers</span><span id="wShedPow"></span></div></div>');
$('wShedPowRow').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.crpow) { const why = wCR.castMine(b.dataset.crpow); if (why) $('wShedNote').textContent = why; else wShedBarNote(); wShedRows(); }
  else if (b.dataset.crauto) { wCR.autoPow = !wCR.autoPow; wShedRows(); }
});
const wW126ShedRows = wShedRows;
wShedRows = function () {
  wW126ShedRows();
  const V = WCR && !WCR.over && wCR.G && wCR.G.teams ? wCR.view : null, G = wCR.G, row = $('wShedPowRow');
  const mine = !!V && V.mode === 'play' && V.ph === 'aim' && V.up === V.you, mgr = !!V && V.mode === 'manage';
  row.hidden = !(mine || mgr) || !G.powers;
  if (row.hidden) return;
  const s = V.you, ri = mine ? null : V.up === s ? V.thrower : G.order[s][0], P = wCR.powNow(s, ri), btn = (k, label, title) => { const why = wCR.powWhy(s, k, ri); return `<button class="ghost" data-crpow="${k}" ${why || !mine ? 'disabled' : ''} title="${esc(why ? `${title} (${why})` : title)}">${esc(label)}</button>`; };
  const who = G.teams[s].roster[ri == null ? V.thrower : ri] || {}, U = wCR.ult[who.kind] || wCR.ult.goblin, sits = mine ? Object.keys(wCR.sit).filter(k => !wCR.powWhy(s, k)) : [];
  const tip = mine ? wCR.tip(s) : '', R = wCR.roarRules;
  $('wShedPow').innerHTML = `<small class="hint" title="Mana: shots made and ends scored fill it. The roar: the gallery fills it on shots made, double takeouts, twos, big ends and steals.">Mana <b>${G.mana[s]}</b>/${wCR.manaRules.max} · Roar <b>${G.roar[s]}</b></small> `
    + (mine ? (P ? btn('pow', `${P.n} (${P.cost})`, `P: ${P.desc} For ${P.which === 'hit' ? 'a hit' : 'a draw, a guard or a freeze'}: change the shot and the power changes with it.`) : '') + ' ' + btn('ult', `${U.n} (ultimate)`, `U: ${U.desc} Takes ${R.ult} roar, once a game, at the start of an end.`) + ' ' + btn('steady', 'Steady', `K: ${R.steady} roar: no pressure on the skip's stone, in the last end.`) + sits.map(k => ' ' + btn(k, wCR.sit[k].n, wCR.sit[k].desc)).join('') : '')
    + (mgr ? ` <button class="ghost${wCR.autoPow ? ' on' : ''}" data-crauto="1" title="Your captain casts your side's powers by the moment, as a Knight would">Auto powers</button>` : '')
    + (tip ? ` <small class="hint">${esc(tip)}</small>` : '');
};
// the end's mark, on the end board
const wW126ShedBoard = wShedBoard;
wShedBoard = function () {
  wW126ShedBoard();
  const G = wCR.G, el = $('wShedBoard'); if (!el || !G || !G.teams || !G.powers) return;
  const M = G.mark && G.mark.end === G.end ? G.mark : null, old = el.querySelector('.wshedmark'); if (old) old.remove();
  if (M) el.insertAdjacentHTML('beforeend', `<p class="hint wshedmark"><b>${esc(M.n)}</b> marks this end (${esc(G.teams[M.side].name)}, cast by ${esc(M.by)}).</p>`);
};

const wW126ShedHow = wShedHowHTML;
wShedHowHTML = function () {
  return wW126ShedHow() + `<p class="hint"><b>Powers.</b> Every kind has its own magic: a <b>draw power</b> (for a draw, a guard or a freeze) and a <b>hit power</b> (for a takeout, a peel or a hit and roll), and a second of each to pick on the Shed tab. The thrower casts theirs before their stone (P) for team <b>mana</b>, which shots made and ends scored fill. Most make the stone truer or the sweepers stronger; a golem's granite stone won't be moved once it is at rest, a wraith's smoke stone slides through a guard, a harpy's gust pushes their stone back from the button, and some are curses on the other rink's next stone: a witch's frost hex makes it drag heavy, a gorgon's stare makes it stiff.</p>
  <p class="hint"><b>The roar</b> fills on shots made, double takeouts, twos, big ends and most on a steal. It pays for the curler's <b>ultimate</b> (U), once a game at the start of an end: it marks the whole end, for your stones or against theirs. Or it steadies the skip's stone in the last end (K). <b>Situation powers</b>, once a game each: the Hammer (the end's last stone, with the hammer), the Steal (your last stone without it, lying shot) and Extra End. In Manage, <b>Auto powers</b> lets your captain cast for you.</p>`;
};
const wW126RenderHelp = renderHelp;
renderHelp = function () {
  wW126RenderHelp();
  const after = $('wHelpShedGame'); if (!after || $('wHelpShedPowers')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpShedPowers"><b>Powers on the ice.</b> Every curler brings a draw power and a hit power (picked on the Shed tab), cast before their stone for team mana; one ultimate a game marks an end; Steady, the Hammer, the Steal and Extra End fit their moments. See Curling: how it works.</p>`);
};
