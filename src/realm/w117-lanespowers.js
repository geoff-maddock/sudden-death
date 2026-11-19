/* w117: powers at the Lanes (issue #100, phase 6). Every game at the Lanes has the monster powers (13-powers.js): team
   mana from strikes, spares and splits made; each bowler's strike power and spare power (one of two each, picked on the
   Lanes tab: p.blPw { strike, spare }, 0 or 1); one ultimate a game for the roar, which marks the frame; Steady in the
   last frame; and the situation powers (the Fill, Clean Game, Roll-off).
   Your ball's rows gain Powers: mana and the roar, the bowler's power (P), the ultimate (U), Steady (K), the situation
   powers that fit, and the bench's tip. In Manage, Auto powers lets your captain cast for you. The lanes show the mana,
   the roar and the frame's mark.
   Wraps: wLanesGame (wW117LanesGame: powers on), wLanesPlayer (wW117LanesPlayer: the bowler's two powers), wFiveRow
   (wW117FiveRow: the power picks), wRenderCamp (wW117RenderCamp: the picks' changes), wLanesRows (wW117LanesRows: the
   Powers row and Auto powers), wLanesHowHTML (wW117LanesHow: powers). */

const wW117LanesGame = wLanesGame;
wLanesGame = function (opts) { return wW117LanesGame(Object.assign({ powers: true }, opts || {})); };
const wW117LanesPlayer = wLanesPlayer;
wLanesPlayer = function (p) { const m = wW117LanesPlayer(p); m.pw = { strike: p.blPw && p.blPw.strike === 1 ? 1 : 0, spare: p.blPw && p.blPw.spare === 1 ? 1 : 0 }; return m; };
function wBlSetPw(k, which, v) { const p = wFiveWho(k); if (!p || (which !== 'strike' && which !== 'spare')) return ''; p.blPw = Object.assign({ strike: 0, spare: 0 }, p.blPw, { [which]: v === 1 ? 1 : 0 }); wSave(); return ''; }

const wW117FiveRow = wFiveRow;
wFiveRow = function (k, C) {
  const html = wW117FiveRow(k, C), p = wFiveWho(k); if (!p) return html;
  const sel = ['strike', 'spare'].map(w => { const a = (wBL.pow[p.kind] || wBL.pow.goblin)[w === 'strike' ? 0 : 1], b = (wBL.pow2[p.kind] || wBL.pow2.goblin)[w === 'strike' ? 0 : 1], cur = p.blPw && p.blPw[w] === 1 ? 1 : 0;
    return `<label class="wsvl" title="${esc(`${a.n}: ${a.desc} / ${b.n}: ${b.desc}`)}">${w === 'strike' ? 'Strike power' : 'Spare power'} <select data-npw="${w}" aria-label="${esc(p.n)}'s ${w} power"><option value="0"${cur ? '' : ' selected'}>${esc(a.n)}</option><option value="1"${cur ? ' selected' : ''}>${esc(b.n)}</option></select></label>`; }).join('');
  return html.replace(/(<label class="wsvl">Order[\s\S]*?<\/label>)/, `$1${sel}`);
};
const wW117RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW117RenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'lanes') return;
  const keyOf = el => { const k = el.closest('[data-nid]').dataset.nid; return /^n\d+$/.test(k) ? k : +k; };
  body.querySelectorAll('[data-npw]').forEach(s => s.onchange = () => wCampSay(wBlSetPw(keyOf(s), s.dataset.npw, +s.value)));
};

// your ball's Powers row, and Manage's Auto powers
$('wLanesRows').insertAdjacentHTML('beforeend', '<div class="wccrow" id="wLanesRowPow" hidden><span class="wccl">Powers</span><span id="wLanesPow"></span></div>');
$('wLanesRows').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.npow) { const why = wBL.castMine(b.dataset.npow); if (why) $('wLanesNote').textContent = why; else wLanesBarNote(); wLanesRows(); }
  else if (b.dataset.nauto) { wBL.autoPow = !wBL.autoPow; wLanesRows(); }
});
const wW117LanesRows = wLanesRows;
wLanesRows = function () {
  wW117LanesRows();
  const V = WBL && !WBL.over && wBL.G && wBL.G.teams ? wBL.view : null, G = wBL.G, row = $('wLanesRowPow');
  const mine = V && V.mode === 'play' && V.ph === 'aim' && V.up === V.you, mgr = V && V.mode === 'manage';
  row.hidden = !(mine || mgr) || !G.powers;
  if (row.hidden) return;
  const s = V.you, ri = V.bowler != null && V.up === s ? V.bowler : G.order[s][0], P = wBL.powNow(s, ri), btn = (k, label, title) => { const why = wBL.powWhy(s, k, ri); return `<button class="ghost" data-npow="${k}" ${why || !mine ? 'disabled' : ''} title="${esc(why ? `${title} (${why})` : title)}">${esc(label)}</button>`; };
  const U = wBL.ult[(G.teams[s].roster[ri] || {}).kind] || wBL.ult.goblin, sits = Object.keys(wBL.sit).filter(k => !wBL.powWhy(s, k, ri));
  const tip = mine ? wBL.tip(s) : '';
  row.querySelector('#wLanesPow').innerHTML = `<small class="hint" title="Mana: strikes, spares and splits made fill it. The roar: the gallery fills it on doubles, turkeys and splits made.">Mana <b>${G.mana[s]}</b>/${wBL.manaRules.max} · Roar <b>${G.roar[s]}</b></small> `
    + (mine ? (P ? btn('pow', `${P.n} (${P.cost})`, `P: ${P.desc}`) : '') + ' ' + btn('ult', `${U.n} (ultimate)`, `U: ${U.desc} Takes ${wBL.roarRules.ult} roar, once a game, before a frame's first ball.`) + ' ' + btn('steady', 'Steady', `K: ${wBL.roarRules.steady} roar: no pressure on this ball, in the last frame.`) + sits.map(k => ' ' + btn(k, wBL.sit[k].n, wBL.sit[k].desc)).join('') : '')
    + (mgr ? ` <button class="ghost${wBL.autoPow ? ' on' : ''}" data-nauto="1" title="Your captain casts your side's powers by the moment, as a Knight would">Auto powers</button>` : '')
    + (tip ? ` <small class="hint">${esc(tip)}</small>` : '');
};

const wW117LanesHow = wLanesHowHTML;
wLanesHowHTML = function () {
  return wW117LanesHow() + `<p class="hint"><b>Powers.</b> Every kind has its own magic: a <b>strike power</b> (for a ball at a full rack) and a <b>spare power</b> (for what is left), and a second of each to pick on the Lanes tab. The bowler casts theirs before their ball (P) for team <b>mana</b>, which strikes, spares and splits made fill. Some are curses on the other side's next ball: a gorgon's Stare turns their front pin to stone, a witch's Hex makes the oil play heavy. The gallery's <b>roar</b> fills on doubles, turkeys and splits made: ${wBL.roarRules.ult} of it pays for the bowler's kind's <b>ultimate</b> (U, once a game, before a frame's first ball), which marks the frame for both sides, and ${wBL.roarRules.steady} steadies a ball in the last frame (K). <b>Situation powers</b>, once a game each: the Fill (the bowler's arm back for the tenth's fill balls), Clean Game (from the 8th with no open frame yet: the next ball truer) and Roll-off. In Manage, <b>Auto powers</b> lets your captain cast for you.</p>`;
};
