/* Pets in the fight (issue #104, phase 1): the pet at your side, beside your HP and Block. Its badge (its colour by
   element, its initial, its bond as stars; spooked and hungry shown), a tooltip with everything it does at its bond
   (the trait, each power and the bond it opens at, the trick), and its trick as a button (T). What it does in the
   fight pops up over your side of the arena (fx k 'pet') and goes in the log. */
// 'a' or 'an' before a word
const petA = w => /^[aeiou]/i.test(w || '') ? 'an' : 'a';
const PET_EL_COL = { aether: '#d8c8ff', bloom: '#8fd27a', tide: '#6fc3e8', ember: '#ff9a5a', rime: '#bfe8ff' };
function petTipHTML() {
  const p = B.pet, T = petText(p.kind, p.bond, p.hungry, p); if (!T) return '';
  const pw = T.powers.map(w => `<li${w.open ? '' : ' style="opacity:.55"'}>${w.open ? '' : `<i>(at bond ${w.at})</i> `}${esc(w.d)}</li>`).join('');
  return `<span class="t">${esc(p.name)}</span>${esc(T.n)}, ${petA(T.from)} ${esc(T.from)} (${esc(T.el)}). Bond ${p.bond} of 3.${p.hungry ? ' <b>Hungry:</b> its numbers are about halved (at least 1).' : ''}${p.spooked ? ' <b>Spooked:</b> its next power won\'t fire.' : ''}
${T.ctx.length ? `<br><b>Suits it today</b> (${Math.round(PET.ctx * 100)}% stronger for each): ${esc(T.ctx.join(', '))}.` : ''}
    <br><b>Always:</b> ${esc(T.trait)}<ul style="margin:4px 0 4px 16px;padding:0">${pw}</ul><b>Trick (T, once a fight):</b> ${esc(T.trick.n)}: ${esc(T.trick.d)}${p.used ? ' <i>(used)</i>' : ''}`;
}
function petPanelHTML() {
  const p = B && B.pet; if (!p || !PETS[p.kind]) return '';
  const D = PETS[p.kind], col = PET_EL_COL[D.el] || '#e9dcc0', why = petTrickWhy(), stars = '★'.repeat(p.bond) + '☆'.repeat(3 - p.bond);
  const busy = B.phase !== 'player' || !!B.over || UI.busy;
  return `<div class="petbox" id="petBox" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <span class="petbadge" tabindex="0" data-tip="${esc(petTipHTML())}" aria-label="${esc(p.name)}, your pet" style="display:inline-flex;align-items:center;gap:6px;border:1px solid ${col};border-radius:14px;padding:2px 10px 2px 3px;color:${col}">
      <b style="display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:${col};color:#17100e">${esc(p.name[0])}</b>${esc(p.name)} <small style="letter-spacing:1px">${stars}</small>${p.spooked ? ' <small title="Spooked">!</small>' : ''}${p.hungry ? ' <small title="Hungry">(hungry)</small>' : ''}</span>
    <button class="ghost pettrick" id="bPetTrick" ${why || busy ? 'disabled' : ''} title="${esc(why ? why : `T: ${D.trick.n}`)}">${esc(D.trick.n)}${p.used ? ' (used)' : ''}</button></div>`;
}
function doPetTrick() {
  if (!B || !B.pet || B.phase !== 'player' || B.over || UI.busy || petTrickWhy()) return;
  // (a card picked or a discard waiting is let go: the trick can change the hand and the enemies under it)
  UI.sel = -1; UI.disc = null;
  const K = PETS[B.pet.kind].trick, one = (K.tgt || 'one') === 'one';
  petTrick(one ? B.enemies.indexOf(UI.kbTarget && !UI.kbTarget.dead ? UI.kbTarget : alive()[0]) : null);
  hideTip(); afterAction();
}
// the HUD: the pet's panel under your HP and Block, its trick on the button (and T)
const sdRenderFightHUD = renderFightHUD;
renderFightHUD = function () {
  sdRenderFightHUD();
  if (!B || !B.pet) return;
  $('meBox').insertAdjacentHTML('beforeend', petPanelHTML());
  const b = $('bPetTrick'); if (b) b.onclick = () => doPetTrick();
};
document.addEventListener('keydown', ev => {
  if ((ev.key !== 't' && ev.key !== 'T') || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (UI.view !== 'fight' || !B || !B.pet || !$('modal').hidden || UI.paused || (ev.target.closest && ev.target.closest('input,textarea'))) return;
  doPetTrick(); ev.preventDefault();
});
