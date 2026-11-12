/* w48: the bench and potions on the gridiron. Tired players can be got back three ways (src/gf/parts/15-bench.js):
   - Swaps: each side brings a bench (W_GFG.bench, w44: your players who sit out, then call-ups). Between plays, put a
     bench player on for a tired one; they take every place the tired one had, offense and defense. The bench rests.
     The coaches swap for their side, and for yours under Coaches (and in Simulate).
   - Potions (W_GF_POTIONS): a Stamina Draught (one player) and a Second Wind (the whole seven), sold in every general
     store and found in a few chests. One a play, between plays, in a real game; each use takes one from your bag.
   - Powers: the troll's Boulder, the vampire's Mesmerize, the witch's Hex and the elf's Overgrowth give stamina back.
   Every swap, potion and power goes in the play log, with its team (w42 wGridNotesLine).
   wGridSwap(out, inn), wGridPotion(id, ri) return a message for the player, or '' when it worked.
   More gear and potions (issue #61, phase 3): w74 (the Resin, the Elixir, the Fog, the Balm, and their bag for the other side).
   Wrapped: wGridBar (wW48GridBar: the bench panel), renderHelp (wW48RenderHelp: #wHelpGfBench). */

// msg: why the last swap or potion didn't happen, shown until the next call or game (at, G: when it was shown)
const WGB = { msg: '', at: null, G: null, html: '' };
const W_GF_POTIONS = {
  draught: { n: 40, all: false, price: 20 },
  secondwind: { n: 15, all: true, price: 45 },
};
DB.items.draught = { name: 'Stamina Draught', desc: 'A bitter green tonic. One tired player gets 40 stamina back.', use: 'In a football game, between plays: Potions, under your lineup. One potion a play.', price: W_GF_POTIONS.draught.price };
DB.items.secondwind = { name: 'Second Wind', desc: 'A flask of cold mountain air. The whole seven get 15 stamina back.', use: 'In a football game, between plays: Potions, under your lineup. One potion a play.', price: W_GF_POTIONS.secondwind.price };
for (const k in DB.shops) { DB.shops[k].draught = W_GF_POTIONS.draught.price; DB.shops[k].secondwind = W_GF_POTIONS.secondwind.price; }
for (const [c, it] of [['emberdeep_c6', 'draught'], ['hatchery_c6', 'secondwind'], ['genevault_c6', 'draught']]) {
  const C = DB.chests[c]; if (C) { C.items = C.items || {}; C.items[it] = (C.items[it] || 0) + 1; }
}

// a game's save point is the last call: a swap or a potion made at a call is kept in it
function wGridResnap() { const L = wGridWorld() && WG.gfg.live; if (L && wGF.phase === 'call') L.snap = wGF.snapshot(); }
function wGridSwap(out, inn) {
  const b = wGF.bench(); if (!b) return '';
  if (!b.between) return 'Swaps happen between plays.';
  if (!b.on.some(p => p.ri === out)) return 'That player is already off the field.';
  if (!b.bench.some(p => p.ri === inn)) return 'That player is already on the field.';
  const msg = wGF.swap(out, inn);
  if (!msg) return 'That swap can\'t be made now.';
  wGridResnap(); wGridBar(); return '';
}
function wGridPotion(id, ri) {
  const P = W_GF_POTIONS[id], b = wGF.bench();
  if (!P || !b) return '';
  if (!wGridWorld()) return 'Potions are for real games, not practice.';
  if (!wHas(id)) return `You have no ${DB.items[id].name}. The general stores sell them.`;
  if (b.item) return 'One potion a play.';
  if (!b.between) return 'Potions are given between plays, and not after the last one.';
  if (!P.all && !b.on.some(p => p.ri === ri)) return 'That player is not on the field.';
  if (!wGF.useItem(P.all ? null : ri, P.n, DB.items[id].name)) return 'That potion can\'t be given now.';
  wAddItem(id, -1); wGridResnap(); wGridBar(); return '';
}

// under the field, with your lineup: your bench, and your potions
function wGridBenchHTML() {
  const b = wGF.bench(); if (!b || !b.stam) return '';
  const pos = p => [p.off, p.def].filter(Boolean).join('/'), opt = p => `<option value="${p.ri}">${esc(p.n)} (${pos(p)}), ${p.stam}%</option>`;
  const tired = b.on.slice().sort((x, y) => x.stam - y.stam), off = !b.between ? ' disabled' : '';
  const rows = b.bench.map(p => `<label class="wgsub">${esc(p.n)} <small>#${p.num} ${esc(wCap(p.kind))}</small> <b class="${p.stam < 50 ? 'wgbad' : ''}" title="Stamina: on the bench they rest, ${wGF.stamRules.bench} a play">${p.stam}</b>
    <select data-gin="${p.ri}" aria-label="Put ${esc(p.n)} on for"${off}><option value="">Put on for…</option>${tired.map(opt).join('')}</select></label>`).join('');
  const world = wGridWorld(), pots = Object.keys(W_GF_POTIONS).map(id => {
    const n = WG && WG.items ? WG.items[id] || 0 : 0, P = W_GF_POTIONS[id], it = DB.items[id], can = world && n && b.between && !b.item;
    return P.all ? `<button class="ghost" data-gpot="${id}" title="${esc(it.desc)}"${can ? '' : ' disabled'}>${esc(it.name)} ×${n}</button>`
      : `<select data-gpot="${id}" aria-label="Give a ${esc(it.name)} to" title="${esc(it.desc)}"${can ? '' : ' disabled'}><option value="">${esc(it.name)} ×${n}: give to…</option>${tired.map(opt).join('')}</select>`;
  }).join('');
  // (two rows of the coach's panel under the field, w87: Subs and Bag, as on the court)
  return `<div class="wgbench"><div class="wccrow"><span class="wccl">Subs</span>${rows || '<small class="hint">Nobody on the bench.</small>'}</div>
    <div class="wccrow"><span class="wccl">Bag</span><div class="wgpots"><b>Potions</b>${pots}${b.item ? '<small class="hint">One given this play.</small>' : ''}</div></div>
    ${WGB.msg ? `<p class="wgbad">${esc(WGB.msg)}</p>` : ''}<p class="hint">${b.between ? 'Between plays: put a fresh player on for a tired one (they take every place the tired one had), or give out a potion, one a play.' : ['post', 'over'].includes(wGF.phase) ? 'That was the last play: no more swaps or potions.' : 'Swaps and potions wait until the play is over.'}${world ? '' : ' Potions are for real games.'}${WGF && WGF.mode === 'watch' ? ' Under Watch, they make the swaps.' : ''}</p></div>`;
}
$('wGridLineup').insertAdjacentHTML('afterend', '<div id="wGridBench"></div>');
$('wGridBench').addEventListener('change', e => {
  const s = e.target.closest('select'); if (!s || s.value === '') return;
  const msg = s.dataset.gin != null ? wGridSwap(+s.value, +s.dataset.gin) : wGridPotion(s.dataset.gpot, +s.value);
  WGB.msg = msg; wGridBar();
});
$('wGridBench').addEventListener('click', e => {
  const b = e.target.closest('button[data-gpot]'); if (!b) return;
  WGB.msg = wGridPotion(b.dataset.gpot, null); wGridBar();
});
// redrawn with the bar, but only when it changes (so an open list isn't shut under you)
const wW48GridBar = wGridBar;
wGridBar = function () {
  wW48GridBar.apply(this, arguments);
  if (WGB.msg && (wGF.G !== WGB.G || (wGF.phase === 'call' && WGB.at !== 'call'))) WGB.msg = '';
  WGB.at = wGF.phase; WGB.G = wGF.G;
  const h = WGF ? wGridBenchHTML() : '';
  if (WGB.html !== h) { WGB.html = h; $('wGridBench').innerHTML = h; }
};

W_GRID_HOW.push(() => `<p class="hint"><b>Tired players.</b> Under the field: <b>Subs</b>. Between plays, put a bench player on for a tired one; they take every place the tired one had, on offense and on defense, and the one who comes off rests (${wGF.stamRules.bench} stamina a play) and may go back on. <b>Bag</b>: a Stamina Draught gives one player ${W_GF_POTIONS.draught.n} stamina back, and a Second Wind gives the whole seven ${W_GF_POTIONS.secondwind.n}; one a play, in a real game. The general stores sell them. Some powers give stamina back too: the troll's Boulder, the vampire's Mesmerize, the witch's Hex and the elf's Overgrowth. The other side's coach swaps too, and so do yours under Watch. Every swap, potion and power goes in the play log.</p>`);

const wW48RenderHelp = renderHelp;
renderHelp = function () {
  wW48RenderHelp();
  const g = $('wHelpGfPowers') || $('wHelpGridiron'); if (!g || $('wHelpGfBench')) return;
  g.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpGfBench"><b>Tired players on the gridiron.</b> Each side brings a bench of ${W_GFG.bench}: your players who sit out, then call-ups. Between plays, put a bench player on for a tired one (under the field, Your bench), and the bench rests. Potions from the general stores give stamina back, one a play: a Stamina Draught (one player, ${W_GF_POTIONS.draught.n}) and a Second Wind (the whole seven, ${W_GF_POTIONS.secondwind.n}). The troll's, vampire's, witch's and elf's powers give some back too. Every swap, potion and power goes in the play log.</p>`);
};
