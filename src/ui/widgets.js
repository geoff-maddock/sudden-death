/* ---------- tooltips ---------- */
const tipEl = () => $('tip');
function showTip(html, x, y) { const t = tipEl(); t.innerHTML = html; t.hidden = false; const w = t.offsetWidth, h = t.offsetHeight; t.style.left = clamp(x + 14, 6, innerWidth - w - 6) + 'px'; t.style.top = clamp(y + 14, 6, innerHeight - h - 6) + 'px'; }
function hideTip() { tipEl().hidden = true; }
document.addEventListener('mouseover', e => { const el = e.target.closest('[data-tip]'); if (el) { const r = el.getBoundingClientRect(); showTip(el.dataset.tip, r.left, r.bottom); } });
document.addEventListener('mouseout', e => { if (e.target.closest('[data-tip]')) hideTip(); });
document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) { const r = el.getBoundingClientRect(); showTip(el.dataset.tip, r.left, r.bottom); } });
document.addEventListener('focusout', e => { if (e.target.closest('[data-tip]')) hideTip(); });
const relicTip = id => esc(`<span class="t">${RELICS[id].n}</span>${RELICS[id].desc}`);
const tonicTip = id => esc(`<span class="t">${TONICS[id].n}</span>${TONICS[id].desc}`);

/* ---------- the run bar ---------- */
function renderRunBar() {
  if (!RUN) return;
  const T = clubTeam(), club = CLUBS[RUN.club];
  const inFight = B && !B.over && UI.view === 'fight';
  $('runbar').innerHTML = `
    <div class="party" style="--cc:${club.color}">${RUN.party.map(p => `<img src="${portraitURL(p.kind, T, p.num, 76)}" alt="${esc(p.n)}, ${KIND_NAME[p.kind]}" data-tip="${esc(`<span class="t">${p.n}</span>${KIND_NAME[p.kind]}, #${p.num}. ${p.flav}`)}" tabindex="0">`).join('')}</div>
    <div class="stat hp"><small>HP</small><b>${RUN.hp}/${RUN.maxhp}</b></div>
    <div class="stat gold"><small>Gold</small><b>${RUN.gold}</b></div>
    <div class="stat" title="Fans: earned by sports wins, spent at the pro shop’s fan stand"><small>Fans</small><b style="color:#d2a6ff">${RUN.fans || 0}</b></div>
    <div class="stat"><small>Act</small><b>${RUN.act + 1}</b><small>Floor</small><b>${RUN.floor + (RUN.pos ? 1 : 0)}</b></div>
    <div class="relics" style="--cc:${club.color}">${RUN.relics.map(id => `<button class="relic${RELICS[id].boss ? ' boss' : ''}${RELICS[id].club ? ' club' : ''}" data-tip="${relicTip(id)}" aria-label="${esc(RELICS[id].n)}">${relicI(id)}</button>`).join('')}</div>
    <div class="tonics">${RUN.tonics.map((id, i) => id ? `<button class="tonic full" data-tonic="${i}" data-tip="${tonicTip(id)}${esc(inFight ? '<br><b>Click to drink.</b>' : '')}" aria-label="${esc(TONICS[id].n)}" ${inFight ? '' : 'disabled'}>${flaskI(TONICS[id].col)}</button>` : `<button class="tonic" disabled aria-label="Empty tonic slot">${flaskI('', 1)}</button>`).join('')}</div>
    ${skyChips()}
    <span class="spacer"></span>
    <button class="ghost" id="bStats" title="Stats for the line and each player">Stats</button>
    <button class="ghost" id="bSeason" title="Every game this run, and the score">Season ${gameRecord(RUN.games)}</button>
    <button class="ghost" id="bDeck">Deck ${RUN.deck.length}</button>
    <button class="ghost" id="bPause" title="Pause, or save and come back later (Esc)">Pause</button>
    <button class="ghost" id="bAbandon" title="Give up this run">Forfeit</button>`;
  $('bDeck').onclick = () => showDeck();
  $('bStats').onclick = () => showStats(RUN.games || [], RUN.party, CLUBS[RUN.club].short, 'Player stats this run');
  $('bSeason').onclick = () => (MVP_NAMES = null, showSeason(RUN.games || [], CLUBS[RUN.club].short, 'This season'));
  $('bPause').onclick = () => openPause();
  $('bAbandon').onclick = () => askConfirm('Forfeit this run?', 'It goes in the record book as a loss, and the run in progress is gone.', 'Forfeit', () => { if (UI.paused) closePause(); recordRun('quit'); showEnd('quit'); });
  document.querySelectorAll('[data-tonic]').forEach(b => b.onclick = () => drinkTonic(+b.dataset.tonic));
}
function sortDeck(cards) { const ord = { atk: 0, play: 1, skl: 2, pow: 3, gear: 4, junk: 5, curse: 6 }; return cards.slice().sort((a, b) => ord[def(a).type] - ord[def(b).type] || def(a).cost - def(b).cost || def(a).n.localeCompare(def(b).n)); }
function modal(html, onClose) {
  const m = $('modal'); $('modalBox').innerHTML = html; m.hidden = false;
  const close = () => { m.hidden = true; m.onclick = null; document.removeEventListener('keydown', esc1); if (onClose) onClose(); };
  const esc1 = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc1);
  m.onclick = e => { if (e.target === m || e.target.closest('[data-close]')) close(); };
  const f = $('modalBox').querySelector('button,[tabindex]'); if (f) f.focus();
  return close;
}
function showDeck(cards, title) {
  cards = cards || RUN.deck;
  modal(`<header><h3>${esc(title || `Your deck (${cards.length})`)}</h3><button class="ghost" data-close>Close</button></header><div class="cardgrid">${sortDeck(cards).map(c => cardHTML(c, { flav: false })).join('') || '<p class="hint">Empty.</p>'}</div>`);
}
// choose cards from the deck: mode 'remove' | 'upgrade'
function pickFromDeck(mode, done) {
  const list = mode === 'upgrade' ? RUN.deck.filter(upgradable) : mode === 'practice' ? RUN.deck.filter(practicable) : RUN.deck.slice();
  const close = modal(`<header><h3>${mode === 'upgrade' ? 'Upgrade a card' : mode === 'practice' ? 'Practice a card' : 'Remove a card'}</h3><button class="ghost" data-close>Cancel</button></header>
    <p class="hint">${mode === 'upgrade' ? 'Hover a card to see what the upgrade does.' : mode === 'practice' ? 'A practiced card (★) gets better at every sport without changing its fight stats. Practice and upgrades stack.' : 'It leaves your deck for the rest of the run.'}</p>${mode === 'practice' ? `<p class="hint" style="font-size:14px;columns:2">${practiceTip()}</p>` : ''}
    <div class="cardgrid pickable">${sortDeck(list).map(c => cardHTML(c, { flav: false })).join('')}</div>`, () => done && done(null));
  $('modalBox').querySelectorAll('.card').forEach(el => {
    const card = RUN.deck.find(c => c.uid == el.dataset.uid);
    if (mode === 'upgrade') { el.addEventListener('mouseenter', () => { el.outerHTML; const tmp = Object.assign({}, card, { up: true }); el.querySelector('.tx').innerHTML = cardText(tmp, {}); el.querySelector('.nm').textContent = def(tmp).n; el.classList.add('up'); }); el.addEventListener('mouseleave', () => { el.querySelector('.tx').innerHTML = cardText(card, {}); el.querySelector('.nm').textContent = def(card).n; el.classList.remove('up'); }); }
    const go = () => { const cb = done; done = null; close(); if (mode === 'upgrade') card.up = true; else if (mode === 'practice') { card.sk = 1; achAdd('practice', 1); } else RUN.deck.splice(RUN.deck.indexOf(card), 1); saveRun(); renderRunBar(); cb && cb(card); };
    el.onclick = go; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
}

