/* w92: powers at the rink (issue #83, phase 7). Each kind has two puck powers and two checking powers and an ultimate
   (src/hk/parts/14-powers.js); a player brings one of each pair: p.hkPw ({ puck, chk }: 0 or 1), picked on the Rink
   tab, and it reaches the engine through wRinkPlayer (their own ratings are never changed). In a game, in Manage and
   You play, the coach's rows (w90) gain Powers (the power each of your skaters on the ice has for the moment, with
   its cost in mana), The big ones (an ultimate each, for the roar, once a game; and the team's situation powers, once
   each), and Auto powers (the coach casts for you, on unless you turn it off). In You play, Q casts the power of the
   skater you are playing and R their ultimate.
   Wraps: wRinkPlayer (wW92RinkPlayer: pw), wSixRow (wW92SixRow: the two pickers), wRenderCamp (wW92RenderCamp),
   wRinkCalls (wW92RinkCalls: the power rows), renderHelp (wW92RenderHelp: #wRinkHowPow). */
function wHkPw(p) { if (!p.hkPw || typeof p.hkPw !== 'object') p.hkPw = { puck: 0, chk: 0 }; p.hkPw.puck = p.hkPw.puck === 1 ? 1 : 0; p.hkPw.chk = p.hkPw.chk === 1 ? 1 : 0; return p.hkPw; }
const wW92RinkPlayer = wRinkPlayer;
wRinkPlayer = function (p) { const o = wW92RinkPlayer(p), w = wHkPw(p); o.pw = { puck: w.puck, chk: w.chk }; return o; };
// a player's pick: role 'puck' or 'chk' to the first (0) or second (1) of their kind's pair
function wRinkSetPow(k, role, i) {
  const p = wSixWho(k); if (!p || !['puck', 'chk'].includes(role)) return '';
  wHkPw(p)[role] = +i === 1 ? 1 : 0; wSave(); return '';
}
// the pair for a kind and role: [first, second]
const wRinkPowPair = (kind, role) => { const K = wHK.pows[kind]; if (!K) return []; const i = role === 'puck' ? 0 : 1; return [K.one[i], K.two[i]]; };
const wW92SixRow = wSixRow;
wSixRow = function (k, C) {
  const html = wW92SixRow(k, C), p = wSixWho(k), w = wHkPw(p), K = wHK.pows[p.kind]; if (!K) return html;
  const sel = (role, lab) => { const pair = wRinkPowPair(p.kind, role); return `<label class="wsvl whpow" title="${esc(pair[w[role]].desc)}">${lab} <select data-hpow="${role}" aria-label="${esc(p.n)}'s ${lab.toLowerCase()} power">${pair.map((P, i) => `<option value="${i}"${w[role] === i ? ' selected' : ''}>${esc(P.n)} (${P.cost})</option>`).join('')}</select></label>`; };
  return html.replace('<div class="wpa">', `<div class="wpa">${sel('puck', 'Puck')}${sel('chk', 'Checking')}`).replace('</small></div>', `</small><small class="whult" title="${esc(K.ult.desc)}">Ultimate: <b>${esc(K.ult.n)}</b></small></div>`);
};
const wW92RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW92RenderCamp();
  const body = $('wCampBody'); if (!body || WCAMP.tab !== 'rink') return;
  body.querySelectorAll('[data-hpow]').forEach(s => s.onchange = () => { const k = s.closest('[data-hid]').dataset.hid; wCampSay(wRinkSetPow(/^h\d+$/.test(k) ? k : +k, s.dataset.hpow, s.value)); });
};

/* ---------- the rows in a game ---------- */
function wRinkPowRows() {
  const you = wHK.you, mana = Math.floor(wHK.mana[you] + 1e-9), sp = Math.round(wHK.spirit[you]), R = wHK.powRules;
  const pows = wHK.powerOptions(you), ults = wHK.ultOptions(you), sits = wHK.sitOptions(you), going = wHK.fxs.filter(e => e.side === you);
  const btn = (attr, o, label, cost) => `<button class="ghost" ${attr} ${o.ok ? '' : 'disabled'} title="${esc(o.desc + (o.ok ? '' : ' ' + o.why))}">${esc(label)}${cost}</button>`;
  return `<div class="wccrow"><span class="wccl">Powers</span>${pows.length ? pows.map(o => btn(`data-rpow="${o.i}"`, o, `${o.name}`, ` <small>${esc(o.n)} · ${o.cost}</small>`)).join('') : '<small class="hint">Nobody on the ice has one for this.</small>'}
      <small class="hint">Mana <b>${mana}</b> of ${R.mana.max}.${going.length ? ` Going now: ${going.map(e => esc(e.n)).join(', ')}.` : ''} ${pows.length && pows[0].role === 'puck' ? 'You have the puck: puck powers.' : 'They have the puck: checking powers.'}</small></div>
    <div class="wccrow"><span class="wccl">The big ones</span>${ults.map(o => btn(`data-rult="${o.i}"`, o, o.name, ` <small>${esc(o.n)}</small>`)).join('')}${sits.map(o => btn(`data-rsit="${o.id}"`, o, o.name, ` <small>${o.cost}</small>`)).join('')}
      <small class="hint">Roar <b>${sp}</b> of ${R.spirit.max}: an ultimate takes ${R.spirit.ult}, once a game.</small>
      <button class="ghost${wHK.autoPow ? ' on' : ''}" data-rbench="autopow" aria-pressed="${wHK.autoPow}" title="The coach casts your powers for you when the moment fits, or leaves them all to you.">Auto powers: ${wHK.autoPow ? 'on' : 'off'}</button></div>`;
}
const wW92RinkCalls = wRinkCalls;
wRinkCalls = function (force) {
  wW92RinkCalls(force);
  const box = $('wRinkCalls'); if (box.hidden || !wHK.powersOn) { const old = box.querySelector('.wrpowbox'); if (old) old.remove(); return; }
  let pb = box.querySelector('.wrpowbox'); if (!pb) { box.querySelector('.wccrows').insertAdjacentHTML('afterend', '<div class="wrpowbox"></div>'); pb = box.querySelector('.wrpowbox'); }
  const you = wHK.you, key = JSON.stringify([wHK.powerOptions(you).map(o => [o.i, o.id, o.ok]), wHK.ultOptions(you).map(o => [o.i, o.ok]), wHK.sitOptions(you).map(o => o.ok), Math.floor(wHK.mana[you] + 1e-9), Math.round(wHK.spirit[you] / 5), wHK.fxs.length, wHK.autoPow]);
  if (force || key !== pb.dataset.key) { pb.dataset.key = key; pb.innerHTML = wRinkPowRows(); }
};
$('wRinkCalls').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !WHK) return;
  const you = wHK.you;
  if (b.dataset.rpow != null) wHK.cast(you, +b.dataset.rpow); else if (b.dataset.rult != null) wHK.castUlt(you, +b.dataset.rult); else if (b.dataset.rsit) wHK.castSit(you, b.dataset.rsit); else return;
  wRinkCalls(true);
});

function wRinkHowPowHTML() {
  const R = wHK.powRules, ex = (kind, role, i) => { const P = wRinkPowPair(kind, role)[i]; return `<b>${esc(P.n)}</b> (${esc(wKindName(kind))}): ${esc(P.desc)}`; };
  return `<p class="hint"><b>Powers.</b> Every kind has a <b>puck power</b>, for when your side has the puck, and a <b>checking power</b>, for when it doesn't. A skater on the ice casts theirs in live play. It costs <b>mana</b> (your side starts with ${R.mana.start}, holds up to ${R.mana.max}, gets one back every ${R.mana.every} seconds of play, ${R.mana.scored} each time it is scored on and ${R.mana.brk} at each break) and some of the caster's stamina, and it lasts ${R.secs} seconds of play. One at a time a side. For example: ${ex('harpy', 'puck', 0)} ${ex('golem', 'chk', 0)} ${ex('spider', 'chk', 0)} ${ex('witch', 'puck', 0)}</p>
  <p class="hint"><b>The choice.</b> Each kind has a second puck power and a second checking power. Pick which of each pair a player brings on the Rink tab.</p>
  <p class="hint"><b>The roar and the ultimate.</b> The bank's roar fills your meter on shots on goal, hits, saves and goals. At ${R.spirit.ult} it pays for one <b>ultimate</b> a game, which leaves its mark on the ice for ${R.ultSecs} seconds: one set of effects while you have the puck and another while you don't. Left unspent, ${R.spirit.lift} of it lifts a spent line with nobody fresh behind it for one more shift.</p>
  <p class="hint"><b>Situation powers</b> are the team's, once a game each: ${Object.values(wHK.sits).map(S => `<b>${esc(S.n)}</b> (${S.cost} mana): ${esc(S.desc)}`).join(' ')}</p>
  <p class="hint"><b>Who casts.</b> With <b>Auto powers</b> on, your coach casts when the moment fits: the puck in the right end, and a power that suits the system you are in first. Turn it off and they are all yours: the buttons under the rink in Manage and You play, and in You play <b>Q</b> for the power of the skater you are playing and <b>R</b> for their ultimate. Their coach casts by his skill.</p>`;
}
const wW92RenderHelp = renderHelp;
renderHelp = function () {
  wW92RenderHelp();
  const h = $('wRinkHow'); if (!h || $('wRinkHowPow')) return;
  h.insertAdjacentHTML('beforeend', `<div id="wRinkHowPow">${wRinkHowPowHTML()}</div>`);
};
