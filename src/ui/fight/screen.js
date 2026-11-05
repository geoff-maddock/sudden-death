/* ---------- the fight screen ---------- */
const cv = $('cv'), ctx = cv.getContext('2d');
// keep the stage's backing store matched to its on-screen size. Layout shifts mid-fight (a scrollbar appearing,
// the hand or log growing, a zoom) change the displayed size without a resize event, and a stretched canvas looks blurry.
function fitStage(force) {
  if (!cv.clientWidth) return; // hidden: measure when it is shown
  const d = Math.min(3, Math.max(1, (window.devicePixelRatio || 1) * cv.clientWidth / SW));
  if (!force && cv._d && Math.abs(cv._d - d) < .01) return;
  cv.width = Math.round(SW * d); cv.height = Math.round(SH * d); cv._d = d;
}
if (window.ResizeObserver) new ResizeObserver(() => { if (UI.view === 'fight') fitStage(); }).observe(cv);
function intentDesc(e) {
  const m = ENEMIES[e.id].moves[e.intent]; if (!m || e.disguised) return 'Just sitting there. Being a chest.';
  return (e.plan || planOps(e)).map(op => {
    switch (op[0]) {
      case 'a': return `attack for ${enemyHitDmg(e, op[1])}${(op[2] || 1) > 1 ? ` × ${op[2]}` : ''}${op[3] === 'drain' ? ', healing what gets through' : ''}`;
      case 'b': return `gain ${op[1]} Block`; case 'ba': return `give every ally ${op[1]} Block`;
      case 's': return `gain ${op[2]} ${ST[op[1]].n}`; case 'sa': return `give every ally ${op[2]} ${ST[op[1]].n}`;
      case 'p': return `give you ${op[2]} ${ST[op[1]].n}`; case 'add': return `shuffle ${op[2]} ${CARDS[op[1]].n} into your ${op[3] === 'draw' ? 'draw' : 'discard'} pile`;
      case 'steal': return `steal up to ${op[1]} gold`; case 'flee': return 'run for home with your gold'; case 'summon': return 'call a Bone Lineman onto the field';
      case 'engulf': return `swallow ${op[1]} of your cards until it falls`; case 'heal': return `heal ${op[1]}`;
    }
    return '';
  }).filter(Boolean).join(', then ');
}
function enemyTip(e) {
  const D = ENEMIES[e.id];
  const sts = Object.keys(e.st).filter(k => e.st[k] && ST[k] && ST[k].n).map(k => `<br><b>${ST[k].n} ${e.st[k]}</b>: ${ST[k].desc}`).join('');
  return `<span class="t">${esc(e.disguised ? 'A Treasure Chest?' : e.n)}</span>${e.sp ? `<b style="color:#ffd166">${SPORT_PERKS[e.sp].n}:</b> ${esc(SPORT_PERKS[e.sp].desc)}<br><br>` : ''}${e.disguised ? 'Looks like a perfectly ordinary chest.' : esc(D.flav || '')}<br><br><b>Next:</b> ${esc(ENEMIES[e.id].moves[e.intent] ? (e.disguised ? '???' : ENEMIES[e.id].moves[e.intent].n) : '')}. It will ${esc(intentDesc(e))}.${sts}`;
}
function renderFightHUD() {
  if (!B) return;
  const P = B.P;
  const sts = Object.keys(P.st).filter(k => P.st[k] && ST[k] && ST[k].n);
  $('meBox').innerHTML = `
    <div style="display:flex;gap:10px;align-items:center"><div class="energy${B.energy ? '' : ' out'}" data-tip="${esc('<span class="t">Stamina</span>Pays for cards. Refills every turn.')}" tabindex="0">${B.energy}<small>/${B.maxE}</small></div>
    <div style="flex:1;display:grid;gap:6px"><div class="hpbar" aria-label="HP ${RUN.hp} of ${RUN.maxhp}"><i style="width:${100 * RUN.hp / RUN.maxhp}%"></i><span>${RUN.hp}/${RUN.maxhp}</span></div>
    ${P.block ? `<span class="blockchip" data-tip="${esc('<span class="t">Block</span>Soaks up damage before your HP. Drains away at the start of your turn' + (B.sport === 'hockey' ? ' (on black ice, half of it slides over)' : '') + '.')}" tabindex="0">Block ${P.block}</span>` : ''}</div></div>
    <div class="pst">${sts.map(k => `<span class="chip" style="color:${ST[k].col};border-color:${ST[k].col}" tabindex="0" data-tip="${esc(`<span class="t">${ST[k].n} ${P.st[k]}</span>${ST[k].desc}`)}">${ST[k].n} ${P.st[k]}</span>`).join('')}</div>`;
  const busy = B.phase !== 'player' || !!B.over || UI.busy;
  $('ctlBox').innerHTML = `
    <div class="piles"><button class="pile" id="pDraw" title="Draw pile">Draw ${B.draw.length}</button><button class="pile" id="pDisc" title="Discard pile">Discard ${B.discard.length}</button>${B.exhaust.length ? `<button class="pile" id="pEx" title="Exhausted">Out ${B.exhaust.length}</button>` : ''}</div>
    <button class="btn endturn" id="bEnd" ${busy ? 'disabled' : ''}>${B.phase === 'enemy' ? 'Their turn' : 'End turn'}</button>
    <span class="hint" style="font-size:13px">Keys: <kbd>1</kbd>–<kbd>0</kbd> cards, <kbd>E</kbd> end turn</span>`;
  $('bEnd').onclick = () => doEndTurn();
  $('pDraw').onclick = () => showDeck(B.draw, `Draw pile (${B.draw.length}), in no particular order`);
  $('pDisc').onclick = () => showDeck(B.discard, `Discard pile (${B.discard.length})`);
  if ($('pEx')) $('pEx').onclick = () => showDeck(B.exhaust, `Exhausted this fight (${B.exhaust.length})`);
  renderHand();
  renderRunBar();
}
function renderHand() {
  const h = $('hand'), n = B.hand.length;
  h.classList.toggle('wait', B.phase !== 'player' || !!B.over || UI.busy);
  h.innerHTML = B.hand.map((c, i) => {
    const rot = n > 1 ? (i - (n - 1) / 2) * Math.min(4, 22 / n) : 0, lift = Math.abs(i - (n - 1) / 2) * 3;
    return cardHTML(c, { live: true, tgt: UI.sel === i ? UI.kbTarget : null, key: i < 10 ? String((i + 1) % 10) : '', cls: (UI.sel === i ? 'sel ' : '') + (canPlay(c) ? '' : 'no'), attrs: `style="transform:rotate(${rot}deg) translateY(${lift}px)" data-i="${i}"` });
  }).join('');
  h.classList.toggle('pickdisc', !!UI.disc);
  fitHand();
  h.querySelectorAll('.card').forEach(el => {
    const i = +el.dataset.i;
    el.onclick = () => { if (UI.dragged) { UI.dragged = false; return; } selectCard(i); };
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCard(i); } };
    el.onmouseenter = () => { UI.hoverCard = i; updatePreview(); };
    el.onmouseleave = () => { if (UI.hoverCard === i) UI.hoverCard = -1; updatePreview(); };
    el.onpointerdown = ev => startDrag(ev, el, i);
  });
  $('thint').hidden = UI.sel < 0 && !UI.disc;
  if (UI.disc) $('thint').textContent = `${def(B.hand[UI.disc.i]).n}: choose a card to discard (Esc cancels)`;
  else if (UI.sel >= 0) $('thint').textContent = `Pick a target for ${def(B.hand[UI.sel]).n} (click an enemy, or arrows and Enter)`;
  // nothing left to play: nudge the End turn button
  const any = B.phase === 'player' && !B.over && B.hand.some(c => canPlay(c) && !['junk', 'curse'].includes(def(c).type));
  const be = $('bEnd'); if (be) be.classList.toggle('nudge', B.phase === 'player' && !B.over && !UI.busy && !any);
  updatePreview();
}
// a big hand overlaps more, so it never spills over the buttons beside it or off the screen
function fitHand() {
  const h = $('hand'), cards = h.querySelectorAll('.card'), n = cards.length;
  if (!n) return;
  const cw = cards[0].offsetWidth, room = h.clientWidth - 32; // room for the tilt of the outer cards
  const step = n > 1 ? Math.min(cw * .8, (room - cw) / (n - 1)) : cw;
  h.style.setProperty('--hov', n > 1 && room > 0 ? `${(step - cw) / 2}px` : '');
}
function updatePreview() {
  UI.why = null;
  if (!B || B.phase !== 'player') { UI.preview = null; return; }
  const i = UI.sel >= 0 ? UI.sel : UI.disc ? UI.disc.i : UI.hoverCard;
  const c = i != null && i >= 0 ? B.hand[i] : null;
  if (!c || !canPlay(c)) { UI.preview = null; return; }
  const t = UI.kbTarget && !UI.kbTarget.dead ? UI.kbTarget : UI.hover || alive()[0];
  UI.preview = estDamage(c, t);
  const w = dmgWhy(c, t); if (w) UI.why = Object.assign(w, { card: def(c).n, tgt: t.n });
}
function startDrag(ev, el, i) {
  if (ev.button !== 0 || B.phase !== 'player' || B.over || UI.busy || UI.disc) return;
  const c = B.hand[i]; if (!c || !canPlay(c)) return;
  const x0 = ev.clientX, y0 = ev.clientY, base = el.style.transform; let moved = false;
  const mv = e => {
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (!moved && Math.hypot(dx, dy) < 12) return;
    if (!moved) { moved = true; el.classList.add('drag'); UI.sel = i; if (!UI.kbTarget || UI.kbTarget.dead) UI.kbTarget = alive()[0]; }
    el.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * SW / r.width, y = (e.clientY - r.top) * SH / r.height;
    const h = (UI.hit || []).find(o => !o.e.dead && x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1);
    if (h) { UI.hover = h.e; UI.kbTarget = h.e; }
    updatePreview();
  };
  const up = e => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    if (!moved) return;
    UI.dragged = true; el.classList.remove('drag'); el.style.transform = base;
    const r = cv.getBoundingClientRect();
    const overStage = e.clientY < r.bottom + 10;
    if (!overStage) { UI.sel = -1; renderHand(); return; }
    const x = (e.clientX - r.left) * SW / r.width, y = (e.clientY - r.top) * SH / r.height;
    const h = (UI.hit || []).find(o => !o.e.dead && x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1);
    UI.sel = i;
    if (needsTarget(c) && alive().length > 1 && !h) { renderHand(); return; } // dropped on open ice: keep it selected
    playSelected(h ? h.e : UI.kbTarget || alive()[0]);
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}
function selectCard(i) {
  if (!B || B.phase !== 'player' || B.over || UI.busy) return;
  if (UI.disc) { if (i === UI.disc.i) { UI.disc = null; renderHand(); return; } const D = UI.disc; UI.disc = null; const keep = B.hand[i]; UI.sel = -1; playCard(D.i, D.ti, { disc: keep.uid }); afterAction(); return; }
  const c = B.hand[i]; if (!c) return;
  if (!canPlay(c)) { sfx.bad(); const el = $('hand').querySelector(`[data-i="${i}"]`); if (el) { el.animate([{ transform: el.style.transform + ' translateX(-6px)' }, { transform: el.style.transform + ' translateX(6px)' }, { transform: el.style.transform }], { duration: 180 }); } return; }
  if (UI.sel === i) { playSelected(UI.kbTarget); return; }
  const tgts = alive();
  if (needsTarget(c) && tgts.length > 1) { UI.sel = i; UI.kbTarget = UI.kbTarget && !UI.kbTarget.dead ? UI.kbTarget : tgts[0]; renderHand(); return; }
  UI.sel = i; playSelected(tgts[0]);
}
function playSelected(e) {
  const i = UI.sel; UI.sel = -1;
  const ti = e ? B.enemies.indexOf(e) : null;
  const c = B.hand[i];
  if (c && def(c).disc && B.hand.length > 2) { UI.disc = { i, ti }; renderHand(); return; } // choose what to discard first
  playCard(i, ti);
  afterAction();
}
function drinkTonic(slot) {
  if (!B || B.phase !== 'player' || B.over || UI.busy) return;
  const id = RUN.tonics[slot]; if (!id) return;
  const needsT = TONICS[id].fx.some(o => o[0] === 'd' && o[3] !== 'all');
  useTonic(slot, needsT ? B.enemies.indexOf(UI.kbTarget || alive()[0]) : null);
  hideTip(); afterAction();
}
function afterAction() {
  consumeFx(); renderFightHUD();
  if (B.over) { UI.busy = true; setTimeout(() => finishFight(), 1100); }
}
function doEndTurn() {
  if (!B || B.phase !== 'player' || B.over || UI.busy) return;
  UI.sel = -1; UI.busy = true;
  const steps = endTurn(); consumeFx(); renderFightHUD();
  let i = 0;
  const next = () => {
    if (i >= steps.length || B.over) { UI.busy = false; consumeFx(); renderFightHUD(); if (B.over) { UI.busy = true; setTimeout(finishFight, 1100); } else sfx.card(); return; }
    const acted = steps[i++]();
    consumeFx(); renderFightHUD();
    setTimeout(next, acted ? 620 / UI.speed : 40);
  };
  setTimeout(next, 300);
}
cv.addEventListener('mousemove', ev => {
  if (UI.view !== 'fight' || !B) return;
  const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * SW / r.width, y = (ev.clientY - r.top) * SH / r.height;
  const h = (UI.hit || []).find(o => !o.e.dead && x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1);
  UI.hover = h ? h.e : null;
  cv.style.cursor = h && UI.sel >= 0 ? 'crosshair' : h ? 'help' : 'default';
  if (h) { showTip(enemyTip(h.e), ev.clientX, ev.clientY); if (UI.sel >= 0 && UI.kbTarget !== h.e) { UI.kbTarget = h.e; renderHand(); } } else hideTip();
  updatePreview();
});
cv.addEventListener('mouseleave', () => { UI.hover = null; hideTip(); });
cv.addEventListener('click', ev => {
  if (UI.view !== 'fight' || !B) return;
  const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * SW / r.width, y = (ev.clientY - r.top) * SH / r.height;
  const h = (UI.hit || []).find(o => !o.e.dead && x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1);
  if (UI.sel >= 0) { if (h) playSelected(h.e); else { UI.sel = -1; renderHand(); } }
});
document.addEventListener('keydown', ev => {
  if (UI.view !== 'fight' || !B || !$('modal').hidden || UI.paused || ev.target.closest('input,textarea')) return;
  if (/^[0-9]$/.test(ev.key)) { const i = (+ev.key + 9) % 10; if (i < B.hand.length) selectCard(i); ev.preventDefault(); return; }
  if (ev.key === 'e' || ev.key === 'E') { doEndTurn(); return; }
  if (UI.sel >= 0) {
    const al = alive(); let j = al.indexOf(UI.kbTarget);
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { j = (j + (ev.key === 'ArrowRight' ? 1 : -1) + al.length) % al.length; UI.kbTarget = al[j]; renderHand(); ev.preventDefault(); }
    else if (ev.key === 'Enter') { playSelected(UI.kbTarget); ev.preventDefault(); }
    else if (ev.key === 'Escape') { UI.sel = -1; renderHand(); }
  }
  if (UI.disc && ev.key === 'Escape') { UI.disc = null; renderHand();
  }
});
