/* w155: the Tilting Lists' ways (issue #117, phase 8), jousting's ground; the engine's side is src/jt/parts/14-ground.js.
   On in every match the Realm jousts at the Lists (Play, Manage, Simulate, the clubs' matches and league fixtures there,
   the exhibition JOUST, the practice match); never in the tilting yard (the straw target has no lane), and in LAB mode off unless the lab sets
   W_JTGND.lab, so the other balance numbers stand. A match whose options already say (ground, even false) jousts that:
   the Umbral's lists (phase 11) must send ground: false, as the Umbral's other grounds send theirs.
   - The churned sand: every course cuts a rut in each rider's lane, a gallop deep, a canter a little, and the furrows show
     on the sand. Before each course you pick your line: in the rut (a steadier tip, a slower mount) or beside it (your
     pace, but the stride jolts the aim). Sir Ruddock rakes the lists between heats.
   - The pennant wind: before each course the pennants (and the panel on the lists) show which way and how hard the wind
     blows across the lists. It pushes each tip sideways as the gap closes, more at a gallop, and its gusts throw it
     about. On Play your tip drifts and you hold it into the wind; on the target an arrow shows the push.
   On the Lists, before each of your courses (You ride, and Manage when the calls are yours): a Line row (In the rut,
   Beside it; L swaps them) with each lane's rut and the wind, your squire's line first. The course log names each
   course's wind and lines. Sir Ruddock has a line for the SAND and the WIND, and Jousting: how it works has both
   (#wListsHowGround), with a line in How to play (#wHelpListsGround).
   Wraps: wListsGame, wListsOpts (wW155ListsGame, wW155ListsOpts: the ground in, at the Realm's call sites, as w153's
   powers; the engine called bare has none), wListsRows (wW155ListsRows: the Line row),
   wListsLogHTML (wW155ListsLogHTML: the wind and the lines), wListsHowHTML (wW155ListsHow: #wListsHowGround), renderHelp
   (wW155RenderHelp: #wHelpListsGround). */

const W_JTGND = { on: true, lab: false };
function wJtGndRules() {
  if (!W_JTGND.on) return false;
  if (LAB) return !!W_JTGND.lab;
  return true;
}
const wJtGndNext = o => { o = o || {}; if (o.ground !== undefined || o.yard) return o; return wJtGndRules() ? Object.assign({}, o, { ground: true }) : o; };
// (at the Realm's call sites, as w153's powers: the engine called bare, as its tests do, has none)
const wW155ListsGame = wListsGame;
wListsGame = function (opts) { return wW155ListsGame(wJtGndNext(opts)); };
const wW155ListsOpts = wListsOpts;
wListsOpts = function () { return wJtGndNext(wW155ListsOpts.apply(this, arguments)); };

/* ---------- Sir Ruddock ---------- */
(() => {
  const K = DB.chars.gk_lists; if (!K) return;
  K.topics.job.t += ' Ask me about the SAND and the WIND before you ride here.';
  K.topics.sand = { t: 'Every gallop cuts my sand. By the end of a heat each lane has a rut you could lose a boot in, and you can see it. Ride in it and the furrow holds your lance steady, but the horse labours. Ride beside it and you keep your pace, but the stride jolts the tip. A canter cuts it less than a gallop. I rake it smooth between heats.' };
  K.topics.wind = { t: 'The Mosswold\'s wind comes and goes along the tents. Watch the pennants before every course: they show which way it blows across the lists and how hard. It pushes your tip sideways as the gap closes, more at a gallop, and the gusts throw it about. Aim into it. From the gallery it blows our lances toward their shields and theirs toward our bodies; when it turns, the other way round.' };
})();

/* ---------- on the Lists: the Line row ---------- */
(() => {
  const go = $('wListsRowGo'); if (!go) return;
  go.insertAdjacentHTML('beforebegin', '<div class="wccrow" id="wListsRowLine" hidden><span class="wccl">Line</span><span id="wListsLine"></span></div>');
})();
const W_JTLINE = { rut: ['In the rut', 'L: the furrow steadies your tip, but the mount is slower (more, the deeper the rut)'], side: ['Beside it', 'L: you keep your pace, but the stride jolts the aim (more, the deeper the rut)'] };
const wW155ListsRows = wListsRows;
wListsRows = function () {
  wW155ListsRows();
  const row = $('wListsRowLine'); if (!row) return;
  const V = WJT && !WJT.over && wJT.G && wJT.G.teams ? wJT.view : null, g = V && V.ground;
  const show = !!g && !$('wListsRows').hidden && V.ph === 'plan' && !!V.sel;
  row.hidden = !show; if (!show) return;
  const s = V.you, cur = V.sel.line === 'side' ? 'side' : 'rut', r = x => g.rut[x] < .04 ? 'smooth' : `a ${Math.round(100 * g.rut[x])}% rut`;
  const p = g.push[s], wind = Math.abs(p || 0) < .6 ? `${g.words}` : `${g.words}: it pushes your tip ${Math.round(Math.abs(p) * 10) / 10} inch${Math.round(Math.abs(p) * 10) === 10 ? '' : 'es'} ${p > 0 ? 'toward their body' : 'toward their shield arm'}`;
  $('wListsLine').innerHTML = Object.entries(W_JTLINE).map(([k, [n, t]]) => `<button class="ghost${k === cur ? ' on' : ''}" data-jf="line" data-jv="${k}" title="${esc(t)}">${n}</button>`).join(' ')
    + ` <small class="hint">Your lane: ${r(s)}. ${esc(wind)}.</small>`;
};
// L swaps your line in your plan beat
window.addEventListener('keydown', e => {
  if ((e.key || '').toLowerCase() !== 'l' || e.ctrlKey || e.metaKey || e.altKey || e.repeat || !wJT.on || wJT.paused) return;
  if (e.target && e.target.closest && e.target.closest('input,textarea,select')) return;
  const md = $('modal'); if (md && !md.hidden) return;
  const V = WJT && !WJT.over && wJT.G && wJT.G.teams ? wJT.view : null;
  if (!V || !V.ground || V.ph !== 'plan' || !V.sel || !(V.mode === 'play' || (V.mode === 'manage' && !V.mgrAuto))) return;
  const why = wJT.select({ line: V.sel.line === 'side' ? 'rut' : 'side' });
  if (why) $('wListsNote').textContent = why; else wListsBarNote();
  wListsRows(); e.preventDefault(); e.stopPropagation();
}, true);

/* ---------- the course log: the wind and the lines ---------- */
const wW155ListsLogHTML = wListsLogHTML;
wListsLogHTML = function () {
  const html = wW155ListsLogHTML(), G = wJT.G; if (!G || !G.ground || !G.log.length) return html;
  const items = html.split('</li>').slice(0, G.log.length), n = G.log.length, by = {};
  for (const e of G.ground.log) by[e.n] = e;
  return items.map((li, j) => {
    const E = by[n - 1 - j]; if (!E) return li + '</li>';
    const side = s => `${esc(G.teams[s].short || G.teams[s].name)} ${E.line[s] === 'side' ? 'beside the rut' : E.rut[s] < .04 ? 'on smooth sand' : 'in the rut'}`;
    return li + ` <small class="wjtgnd">${esc(wJT.windWords(E.wind).replace(/^./, c => c.toUpperCase()))}; ${side(0)}, ${side(1)}.</small></li>`;
  }).join('');
};

/* ---------- How to play ---------- */
const wW155ListsHow = wListsHowHTML;
wListsHowHTML = function () {
  const R = wJT.groundRules;
  return wW155ListsHow() + `<div id="wListsHowGround"><p class="hint"><b>The Tilting Lists' ways.</b> Every match at the Lists has two of its own (not the tilting yard). <b>The churned sand:</b> every course cuts a rut along each rider's lane, a gallop deep and a canter a little, and you can see the furrows darken on the sand. Before each course you pick your <b>line</b> (L): <b>in the rut</b>, the furrow holds your tip steadier but the mount is slower; <b>beside it</b>, you keep your pace but the stride jolts the aim. The deeper the rut, the bigger both. Riding beside it cuts the rut half as much. On smooth sand the two are the same. Sir Ruddock rakes the lists between heats (and before the tilt for the crown), so every heat starts smooth.</p>
  <p class="hint"><b>The pennant wind:</b> the wind comes and goes across the lists. Before each course the pennants show which way and how hard it blows (they stream toward you when it blows from the gallery, and lift away when it blows toward it), and so does the panel at the top right. As the gap closes it pushes each lance tip sideways, up to ${R.wind.push} inches in a stiff wind (more at a gallop), and its gusts throw the tip about. You pass the other rider left side to left side, so the same wind pushes your tip one way on their target and theirs the other: from the gallery, yours toward their shield and theirs toward your body. On You ride your tip drifts as you close and you hold it into the wind (the arrow on the target shows the push); your squire says how far.</p>
  <p class="hint">Their riders read both by skill: a Squire picks a line on a whim and doesn't mind the wind; a Knight works out the better line on the odds and aims into the wind; an Archmage works out the line and how far to aim into the wind against your rider (a wind that carries its lance from your shield onto your body it lets carry it). Sir Ruddock will tell you about the SAND and the WIND.</p></div>`;
};
const wW155RenderHelp = renderHelp;
renderHelp = function () {
  wW155RenderHelp();
  const after = $('wHelpListsPowers') || $('wHelpListsGame') || $('wHelpLists'); if (!after || $('wHelpListsGround')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpListsGround"><b>The Tilting Lists' ways.</b> Every course cuts a rut in each rider's lane: ride in it for a steadier tip and a slower mount, or beside it for your pace and a jolting aim; Sir Ruddock rakes between heats. The pennants show the wind across the lists, which pushes your tip as the gap closes: aim into it. See Jousting: how it works.</p>`);
};
