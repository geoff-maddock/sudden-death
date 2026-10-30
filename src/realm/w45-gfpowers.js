/* w45: monster powers on the gridiron (issue #9, phase 6; the engine's side is src/gf/parts/14-powers.js). They work as
   they do on the diamond: team mana for the game, an offense power and a defense power by kind, cast with the call,
   and one ultimate a game per kind that leaves a zone for 3 plays or the drive. Casting costs stamina.
   On the bar, in You call and You play: your mana, the powers your players can cast with this call (pick one, or G to
   go through them), Auto powers (your players cast their own, as the coaches would; on in You call, T switches it), and
   a tip box with the pros and cons of the power you point at or picked, for this down. Under the field, How it works
   explains powers and lists every kind's; How to play has #wHelpGfPowers.
   Wraps: wGridBar (wW45GridBar: the powers row), renderHelp (wW45RenderHelp: #wHelpGfPowers). */
// (at the foot of the bar, so the play buttons above don't move as it changes)
$('wGridBar').insertAdjacentHTML('beforeend', `<span id="wGridPows" class="wgpows" hidden><b id="wGridMana" title="Team mana: 3 at the start of each half, 1 more for both sides at every new drive, and 1 each time they score on you (up to 6)."></b>
  <span id="wGridPowList"></span><button class="ghost" id="wGridAuto" title="Auto powers: your players cast their own powers with the call, the way the coaches would. T switches it."></button></span>
  <div id="wGridTip" class="wgtip" hidden></div>`);
// the power you point at, for the tip box (the one you picked otherwise)
let wGridTipKey = null;
$('wGridPows').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'wGridAuto') { wGF.setAuto(!wGF.powers().auto); return wGridBar(); }
  if (b.dataset.gpow) { const P = wGF.powers(); wGF.pickPower(P.pick === b.dataset.gpow ? null : b.dataset.gpow); wGridBar(); }
});
$('wGridPows').addEventListener('mouseover', e => { const b = e.target.closest('[data-gpow]'); const k = b ? b.dataset.gpow : null; if (k !== wGridTipKey) { wGridTipKey = k; wGridTip(); } });
$('wGridPows').addEventListener('mouseleave', () => { wGridTipKey = null; wGridTip(); });

const wGridDiamonds = (n, max) => '◆'.repeat(n) + '◇'.repeat(Math.max(0, max - n));
function wGridPowers() {
  const P = wGF.powers(), show = !!P && !!WGF && WGF.mode !== 'watch' && !WGF.over && wGF.live;
  $('wGridPows').hidden = !show; if (!show) { $('wGridTip').hidden = true; return; }
  const yours = wGF.phase === 'call';
  $('wGridMana').textContent = `Mana ${wGridDiamonds(P.mana, P.max)}`;
  $('wGridPowList').innerHTML = P.list.length ? P.list.map(o => `<button class="ghost${P.pick === o.key ? ' on' : ''}${o.ult ? ' wgult' : ''}" data-gpow="${esc(o.key)}" ${o.ok && yours ? '' : 'disabled'}
    title="${esc(`${o.n}: ${o.desc}${o.ok ? '' : ' (' + o.why + ')'}`)}">${o.ult ? '★ ' : ''}${esc(o.name)} <small>${esc(o.n)} · ${o.cost}◆</small></button>`).join('')
    : '<span class="hint">No powers on this side of the ball.</span>';
  $('wGridAuto').textContent = `Auto powers: ${P.auto ? 'on' : 'off'}`; $('wGridAuto').classList.toggle('on', P.auto); $('wGridAuto').setAttribute('aria-pressed', P.auto);
  wGridTip();
}
// the tip box: the power you point at, or the one you picked; otherwise what to do
function wGridTip() {
  const P = wGF.powers(), box = $('wGridTip');
  if (!P || $('wGridPows').hidden) { box.hidden = true; return; }
  const key = wGridTipKey || P.pick, T = key ? wGF.tip(key) : null, o = key ? P.list.find(x => x.key === key) : null;
  box.hidden = false;
  if (!T || !o) {
    box.innerHTML = `<span class="hint">${wGF.phase === 'call' ? `Pick a power to cast with your ${P.role === 'off' ? 'play' : 'defense'} (G goes through them), or none.${P.auto ? ' With Auto powers on, your players cast their own when you don\'t pick one.' : ''}` : 'Powers are picked with the call.'}</span>`;
    return;
  }
  const li = (cls, a) => a.map(x => `<li class="${cls}">${esc(x)}</li>`).join('');
  box.innerHTML = `<b>${o.ult ? '★ ' : ''}${esc(o.name)}</b> <small>${esc(o.n)}${P.pick === key ? ' · picked' : ''}</small><ul>${li('wgpro', T.pro)}${li('wgcon', T.con)}${li('wgnote', T.note)}</ul>`;
}
const wW45GridBar = wGridBar;
wGridBar = function () {
  wW45GridBar();
  wGridPowers();
  // the keys for powers, while it's your call
  if (WGF && WGF.mode !== 'watch' && !WGF.over && wGF.phase === 'call' && wGF.powers()) $('wGridNote').textContent += ' G: a power. T: Auto powers.';
};

// How it works, under the field: powers, and every kind's
function wGridPowersHowHTML() {
  const B = wGF.powerBook, row = (k, b) => `<tr><td>${esc(wCap(k))}</td><td>${b.off ? `<b>${esc(b.off.n)}</b> <small>${b.off.cost}◆</small>: ${esc(b.off.desc)}` : ''}</td><td>${b.def ? `<b>${esc(b.def.n)}</b> <small>${b.def.cost}◆</small>: ${esc(b.def.desc)}` : ''}</td><td>${b.ult ? `<b>★ ${esc(b.ult.n)}</b> <small>${b.ult.role === 'off' ? 'on offense' : 'on defense'}</small>: ${esc(b.ult.desc)}` : ''}</td></tr>`;
  return `<p class="hint"><b>Powers.</b> Every player has two powers by kind: one on offense and one on defense. With each call your side may cast one, paid for with team mana (the diamonds beside each score): 3 at the start of each half, 1 more for both sides at every new drive, and 1 each time the other side scores on you, up to 6. Pick one on the bar (or press <b>G</b> to go through them) before you pick the play, or leave <b>Auto powers</b> on and your players cast their own (<b>T</b> switches it). Each kind also has an <b>ultimate</b> (★): once a game, ${wGF.ultCost} mana, and it leaves a zone on the field for ${wGF.ultPlays} plays or the drive, whichever ends first. Zones show on the grass with the plays they have left.</p>
  <p class="hint"><b>Stamina.</b> The same seven play both ways, so every play costs everyone a little, and casting costs a lot more (the undead and golems tire at half the rate). Below half, a player is slower and weaker until rested; the half gives plenty back, and a winded player can't cast. The <b>Sta</b> column under the field shows it. The tip box beside the powers gives the pros and cons of the one you point at, for this down. After each play the reason says what was cast and what it did. Their coach casts too, better at higher tiers, and remembers the plays you cast on.</p>
  <details class="wghow"><summary>Every kind's powers</summary><div class="tablewrap"><table class="wgline wgbook"><thead><tr><th>Kind</th><th>Offense</th><th>Defense</th><th>Ultimate</th></tr></thead><tbody>${Object.keys(B).map(k => row(k, B[k])).join('')}</tbody></table></div></details>`;
}
$('wGridHow').insertAdjacentHTML('beforeend', wGridPowersHowHTML());

const wW45RenderHelp = renderHelp;
renderHelp = function () {
  wW45RenderHelp();
  const g = $('wHelpGridiron'); if (!g || $('wHelpGfPowers')) return;
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpGfPowers"><b>Powers on the gridiron.</b> They work as they do on the diamond. Your side has team mana: 3 at the start of each half, 1 more for both sides at every new drive, and 1 each time the other side scores, up to 6. With each call you may cast one power: every kind has one for offense and one for defense (Wolf Sprint speeds up the ball carrier, Web slows whoever takes the ball). Pick it on the bar or press G; with Auto powers on, your players cast their own (T switches it, and it starts on when you manage). Each kind also has an ultimate, once a game for 3 mana, that leaves a zone on the field for 3 plays or the drive (Rampart walls the line, Bog Tide turns their backfield to swamp). Casting costs stamina, and so does every play, because the same seven play both ways: a tired player is slower and weaker until the half. The tip box gives each power's pros and cons for the down, and the reason after each play says what it did. The other side casts too, better at higher tiers. How it works, under the field, lists every kind's powers.</p>`);
};
