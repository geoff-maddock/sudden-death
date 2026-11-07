function panelHead(title, sub, art) { return `<div class="event">${art ? `<img src="${art}" alt="">` : ''}<div style="display:grid;gap:12px;align-content:start"><h2>${esc(title)}</h2>${sub ? `<p class="story">${sub}</p>` : ''}<div id="pbody" style="display:grid;gap:12px"></div></div></div>`; }
function renderPanel() {
  const P = RUN.panel; if (!P) return backToMap();
  showView('panel');
  ({ reward: renderReward, shop: renderShop, rest: renderRest, event: renderEvent, chest: renderChest })[P.t]();
}
// why a card might fit this deck: shown under each choice
function cardFit(id) {
  const c = CARDS[id], out = [], deck = RUN.deck.map(x => def(x));
  const m = memberOf(c.kind); if (m) out.push(`${m.n}’s card`);
  const uses = k => deck.filter(d => JSON.stringify(d.fx).includes(`"${k}"`)).length;
  const fxs = JSON.stringify(c.fx) + JSON.stringify(c.home || []);
  for (const [k, w] of [['psn', 'Plague'], ['burn', 'Burn'], ['weak', 'Weak'], ['vuln', 'Exposed']]) if (fxs.includes(`"${k}"`) && uses(k) >= 2) { out.push(`Builds your ${w} (${uses(k)})`); break; }
  if ((fxs.includes('bodyslam') || fxs.includes('barricade')) && deck.filter(d => d.fx.some(o => o[0] === 'b')).length >= 6) out.push('Feeds on your Block');
  const n = deck.length, atk = deck.filter(d => d.type === 'atk').length, skl = deck.filter(d => d.type === 'skl').length, pw = deck.filter(d => d.type === 'pow' || d.type === 'gear').length;
  if (c.type === 'atk' && atk / n < .38) out.push('You are short on Attacks');
  if (c.type === 'skl' && skl / n < .3) out.push('You are short on Skills');
  if ((c.type === 'pow' || c.type === 'gear') && pw === 0) out.push('Your first lasting effect');
  if (c.type === 'play') out.push(`Home in ${SPORT_NAME[c.sport].toLowerCase()}`);
  if (c.rar === 'l') out.unshift('Hall of Famer');
  const cl = costList(c); if (cl) out.push(`Extra cost: ${cl}`);
  return out.slice(0, 2);
}
function deckSummary() {
  const deck = RUN.deck.map(x => def(x)), n = deck.length;
  const cnt = t => deck.filter(d => d.type === t).length;
  const curve = [0, 1, 2, 3].map(k => deck.filter(d => (k === 3 ? d.cost >= 3 : d.cost === k)).length), mx = Math.max(1, ...curve);
  return `<div class="deckbar"><span>Deck <b>${n}</b></span><span>Attacks <b>${cnt('atk')}</b></span><span>Skills <b>${cnt('skl')}</b></span><span>Plays <b>${cnt('play')}</b></span><span>Powers and gear <b>${cnt('pow') + cnt('gear')}</b></span><span>Junk <b>${cnt('junk') + cnt('curse')}</b></span>
    <span style="display:flex;gap:8px;align-items:flex-end">Curve <span class="curve">${curve.map((v, k) => `<span style="height:${Math.max(3, 30 * v / mx)}px" title="${v} cards costing ${k}${k === 3 ? '+' : ''}"><i>${k}${k === 3 ? '+' : ''}</i></span>`).join('')}</span></span></div>`;
}
function cardChoiceRow(list, attr) {
  return `<div class="cardrow">${list.map((c, i) => `<div class="ware">${cardHTML(Object.assign({ uid: attr + i }, c), { attrs: `data-${attr}="${i}"` })}<div class="fit${cardFit(c.id).length ? '' : ' dim'}">${cardFit(c.id).map(esc).join('<br>') || '&nbsp;'}</div>${inDeckHTML(c.id)}</div>`).join('')}</div>`;
}
function renderReward() {
  const P = RUN.panel, rw = P.rw, el = $('v-panel');
  const head = P.type === 'boss' ? 'The boss falls' : P.type === 'rival' ? 'Rivalry won' : P.type === 'elite' ? 'Elite beaten' : 'Victory';
  const sp = rw.sports, T = B && B.enemies[0] ? B.enemies[0].team.short : 'PIT';
  el.innerHTML = `<div class="panel"><h2>${head}</h2>${rw.golf ? `<p class="result">${esc(rw.golf)}.</p>` : ''}${P.stakes ? `<div class="potg stakes${P.stakes.won ? '' : ' lost'}">${svgI(ICO.gem)}<div><small>High stakes: ${esc(STAKES[P.stakes.id].n)}</small><b>${esc(P.stakes.what)}</b></div></div>` : ''}${(P.goals || []).map(g => typeof g === 'string' ? '' : `<div class="potg goalhit">${svgI(ICO.gem)}<div><small>Season goal, tier ${TIER_NAME[g.tier]} complete${g.tier < 2 ? ': next tier unlocked' : ''}</small><b>${esc(GOALS[g.id].n(RUN.act, g.need))}</b><span>${esc(g.pay)}${g.t === 'practice' || g.t === 'card' ? ': below' : ''}</span></div></div>`).join('')}${P.potg ? `<div class="potg">${sportSVG(P.potg.sport, 34)}<div><small>Play of the game</small><b>${P.potg.who && P.potg.who !== 'line' ? esc(memberName(P.potg.who)) + '’s ' : ''}${esc(P.potg.card)}</b><span>${esc(P.potg.what)}</span></div></div>` : ''}${rw.trait ? `<p class="result">Scouting report was right: ${esc(ELITE_TRAITS[rw.trait].n)}. Bonus: ${esc(ELITE_TRAITS[rw.trait].pay.toLowerCase())}</p>` : ''}${P.strike ? '<p class="result">Strike! Every pin down in one turn: you healed 10.</p>' : ''}
    ${sp ? `<div class="scorecard"><h4 style="margin:0">Sports win: you won the ${SPORT_NAME[sp.sport].toLowerCase()} game too</h4>${SPORT_UNIT[sp.sport] ? `<div class="big">${CLUBS[RUN.club].short} ${sp.us}, ${esc(T)} ${sp.them}</div>` : ''}${sp.hl.length ? `<div class="hls">${sp.hl.map(h => `<span>${esc(HL_NAME[h])}</span>`).join('')}</div>` : ''}<span class="hint">${(() => { const g = (RUN.games || [])[RUN.games.length - 1]; return g && g.mvp ? `Player of the game: ${esc(memberName(g.mvp))} (${g.ps[g.mvp].d} damage${g.ps[g.mvp].p ? `, ${g.ps[g.mvp].p} points` : ''}). ` : ''; })()}Season record now ${gameRecord(RUN.games)}. +${sp.style} style points, ${15 + 10 * sp.hl.length} bonus gold in the purse below${rw.reel ? ', and a pick from the highlight reel' : ''}.</span></div>` : B && B.sc && SPORT_UNIT[B.sport] && !P.rw.sports ? `<p class="hint">Fight won, game lost: ${CLUBS[RUN.club].short} ${B.sc.us}, ${esc(T)} ${B.sc.them}. Outscore them next time for a sports win.</p>` : ''}
    <div class="rewards" id="rwList"></div><div id="rwReel"></div><div id="rwCards"></div><div class="row"><button class="btn" id="bCont">${P.type === 'boss' ? (RUN.act >= 2 ? 'Lift the Cup' : 'Descend deeper') : 'Back to the map'}</button></div></div>`;
  const L = $('rwList');
  const item = (ico, label, sub, on, dis, box = L) => { const b = document.createElement('button'); b.className = 'reward'; b.innerHTML = `${ico}<span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>`; if (dis) b.disabled = true; b.onclick = on; box.appendChild(b); return b; };
  const take = () => { saveRun(); renderReward(); renderRunBar(); };
  if (!rw.goldTaken) item(svgI(ICO.ball.replace('#f2ead8', '#ffd166')), `${rw.gold} gold`, '', () => { rw.goldTaken = 1; gainGold(rw.gold); sfx.coin(); take(); });
  if (rw.tonic && !rw.tonicTaken) { const full = !RUN.tonics.includes(null); item(flaskI(TONICS[rw.tonic].col), TONICS[rw.tonic].n, TONICS[rw.tonic].desc + (full ? ' Your tonic slots are full.' : ''), () => { if (gainTonic(rw.tonic)) { rw.tonicTaken = 1; take(); } }, full); }
  if (rw.relic && !rw.relicTaken) item(relicI(rw.relic), RELICS[rw.relic].n, RELICS[rw.relic].desc, () => { rw.relicTaken = 1; gainRelic(rw.relic); take(); });
  if (rw.boss && !rw.bossTaken) {
    const h = document.createElement('p'); h.className = 'hint'; h.style.margin = '6px 0 0'; h.textContent = 'Take one boss trophy:'; L.appendChild(h);
    rw.boss.forEach(id => item(relicI(id), RELICS[id].n, RELICS[id].desc, () => { rw.bossTaken = 1; gainRelic(id); take(); }));
  }
  // season-goal payouts that need a choice
  if (RUN.pracTokens) item(svgI(SPORT_GLYPH[ACT_HOME[RUN.act]]), 'Season goal: practice', 'Practice a card: ★, better at every sport.', () => pickFromDeck('practice', c => { if (c) { RUN.pracTokens--; saveRun(); take(); } }), !RUN.deck.some(practicable));
  if (RUN.rareTokens) item(svgI(ICO.gem), 'Season goal: a rare card', 'Pick one of three rare cards.', () => {
    const list = RUN.rareOffer || (RUN.rareOffer = shuffle(cardPool('r').slice()).slice(0, 3).map(c => ({ id: c.id, up: false })));
    const close = modal(`<header><h3>Pick a rare card</h3><button class="ghost" data-close>Later</button></header>${cardChoiceRow(list, 'gr')}`);
    $('modalBox').querySelectorAll('[data-gr]').forEach(el => el.onclick = () => { const c = list[+el.dataset.gr]; RUN.deck.push(mkCard(c.id)); RUN.stats.cards++; RUN.rareTokens--; RUN.rareOffer = null; saveRun(); close(); take(); });
  });
  // the highlight reel, for sports wins
  if (rw.reel && !rw.reelTaken) {
    const box = $('rwReel');
    box.innerHTML = `<h3>The highlight reel</h3><p class="hint">Pick one: a set play off the tape, film study on a card you already have, or the trainer’s extra attention.</p>${cardChoiceRow(rw.reel, 'rl')}<div class="rewards" id="reelOpts" style="margin-top:10px"></div>`;
    box.querySelectorAll('[data-rl]').forEach(el => el.onclick = () => { const c = rw.reel[+el.dataset.rl]; RUN.deck.push(mkCard(c.id, c.up)); RUN.stats.cards++; rw.reelTaken = 1; sfx.card(); take(); });
    item(svgI('<path d="M4 18l6-6 4 4 6-8" fill="none" stroke="#7fe08a" stroke-width="2.5"/><path d="M16 6h5v5" fill="none" stroke="#7fe08a" stroke-width="2.5"/>'), 'Film study', 'Upgrade a card in your deck.', () => pickFromDeck('upgrade', c => { if (c) { rw.reelTaken = 1; take(); } }), !RUN.deck.some(upgradable), $('reelOpts'));
    item(svgI(SPORT_GLYPH[B ? B.sport : 'baseball'] || SPORT_GLYPH.baseball), 'Practice', 'Practice a card: ★, better at every sport.', () => pickFromDeck('practice', c => { if (c) { rw.reelTaken = 1; take(); } }), !RUN.deck.some(practicable), $('reelOpts'));
    item(svgI(ICO.pack), 'Trainer’s table', 'Raise max HP by 4.', () => { RUN.maxhp += 4; RUN.hp += 4; rw.reelTaken = 1; take(); }, false, $('reelOpts'));
  }
  // the card pick: shown straight away, with what each would do for this deck
  if (!rw.cardTaken) {
    const box = $('rwCards');
    box.innerHTML = `<h3>Add a card</h3>${deckSummary()}<div style="margin-top:12px">${cardChoiceRow(rw.cards, 'ci')}</div>
      <div class="row" style="justify-content:center;margin-top:10px"><button class="ghost" id="bScout" ${rw.scouted || RUN.gold < 15 ? 'disabled' : ''}>Scout again (15 gold)</button><button class="ghost" id="bSkip">Pass on all of them (+8 gold)</button></div>`;
    box.querySelectorAll('[data-ci]').forEach(el => { const go = () => { const c = rw.cards[+el.dataset.ci]; RUN.deck.push(mkCard(c.id, c.up)); RUN.stats.cards++; rw.cardTaken = 1; sfx.card(); take(); }; el.onclick = go; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
    $('bScout').onclick = () => { if (rw.scouted || RUN.gold < 15) return; RUN.gold -= 15; rw.scouted = 1; rw.cards = cardChoices(P.type === 'normal' ? 'normal' : P.type); take(); };
    $('bSkip').onclick = () => { rw.cardTaken = 1; RUN.gold += 8; take(); };
  }
  $('bCont').onclick = () => { if (!rw.goldTaken) { rw.goldTaken = 1; gainGold(rw.gold); } if (rw.relic && !rw.relicTaken) gainRelic(rw.relic); if (P.type === 'boss') { RUN.panel = null; advanceAct(); } else backToMap(); };
}
function renderShop() {
  const P = RUN.panel, S = P.shop, el = $('v-panel');
  const keeper = portraitURL('goblin', { color: '#c9a24a', light: '#fff1c2', short: 'PRO' }, 0, 220);
  el.innerHTML = `<div class="panel">${panelHead('The Pro Shop', 'A goblin in a referee’s shirt sells gear out of a tipped-over trophy case. "Everything’s authentic. Some of it’s even from this dimension."', keeper)}</div>`;
  const body = $('pbody');
  const affordable = p => RUN.gold >= p;
  body.innerHTML = `<div class="shopgrid">
    <div><h4>Cards</h4><div class="cardrow">${S.cards.map((w, i) => `<div class="ware${w.sold ? ' sold' : ''}">${cardHTML({ uid: 's' + i, id: w.id }, { attrs: `data-buy-card="${i}"`, flav: false })}<div class="price${affordable(w.price) ? '' : ' no'}">${w.price} gold</div>${inDeckHTML(w.id)}</div>`).join('')}</div></div>
    <div><h4>Trophies</h4><div class="items">${S.relics.map((w, i) => `<button class="item${w.sold ? ' sold' : ''}" data-buy-relic="${i}" ${affordable(w.price) ? '' : 'aria-disabled="true"'}>${relicI(w.id)}<span><b>${esc(RELICS[w.id].n)}</b></span><small>${esc(RELICS[w.id].desc)}</small><span class="price${affordable(w.price) ? '' : ' no'}">${w.price} gold</span></button>`).join('')}</div></div>
    <div><h4>Tonics</h4><div class="items">${S.tonics.map((w, i) => `<button class="item${w.sold ? ' sold' : ''}" data-buy-tonic="${i}">${flaskI(TONICS[w.id].col)}<span><b>${esc(TONICS[w.id].n)}</b></span><small>${esc(TONICS[w.id].desc)}</small><span class="price${affordable(w.price) ? '' : ' no'}">${w.price} gold</span></button>`).join('')}
      <button class="item${S.removed ? ' sold' : ''}" id="bRemove">${svgI('<path d="M6 6l12 12M18 6L6 18" stroke="#e0533a" stroke-width="3"/>')}<span><b>Trade a card away</b></span><small>Remove one card from your deck.</small><span class="price${affordable(RUN.removeCost) ? '' : ' no'}">${RUN.removeCost} gold</span></button>
      <button class="item${S.practiced ? ' sold' : ''}" id="bPractice">${svgI(SPORT_GLYPH[ACT_HOME[RUN.act]])}<span><b>Practice session</b></span><small>Practice a card: ★, better at every sport.</small><span class="price${affordable(RUN.practiceCost || 50) ? '' : ' no'}">${RUN.practiceCost || 50} gold</span></button></div></div>
    <div><h4>The fan stand <small style="color:#d2a6ff">(${RUN.fans || 0} fans)</small></h4><div class="items">${FAN_STAND.map(f => `<button class="item${S['fan_' + f.id] ? ' sold' : ''}" data-fan="${f.id}">${svgI(f.id === 'practice' ? SPORT_GLYPH[ACT_HOME[RUN.act]] : f.id === 'hp' ? ICO.pack : ICO.gem)}<span><b>${esc(f.n)}</b></span><small>${esc(f.d)}</small><span class="price${(RUN.fans || 0) >= f.cost && f.ok() ? '' : ' no'}" style="color:#d2a6ff">${f.cost} fans</span></button>`).join('')}</div><p class="hint" style="font-size:13px">Fans come from sports wins and season goals.</p></div>
    <div class="row"><button class="btn" id="bLeave">Leave the shop</button><span class="hint">You have ${RUN.gold} gold and ${RUN.fans || 0} fans.</span></div></div>`;
  const nope = () => { sfx.bad(); };
  body.querySelectorAll('[data-buy-card]').forEach(el => el.onclick = () => { const w = S.cards[+el.dataset.buyCard]; if (w.sold || !affordable(w.price)) return nope(); RUN.gold -= w.price; w.sold = true; RUN.deck.push(mkCard(w.id)); sfx.coin(); saveRun(); renderShop(); renderRunBar(); });
  body.querySelectorAll('[data-buy-relic]').forEach(el => el.onclick = () => { const w = S.relics[+el.dataset.buyRelic]; if (w.sold || !affordable(w.price)) return nope(); RUN.gold -= w.price; w.sold = true; gainRelic(w.id); sfx.coin(); saveRun(); renderShop(); renderRunBar(); });
  body.querySelectorAll('[data-buy-tonic]').forEach(el => el.onclick = () => { const w = S.tonics[+el.dataset.buyTonic]; if (w.sold || !affordable(w.price) || !RUN.tonics.includes(null)) return nope(); RUN.gold -= w.price; w.sold = true; gainTonic(w.id); sfx.coin(); saveRun(); renderShop(); renderRunBar(); });
  body.querySelectorAll('[data-fan]').forEach(b => b.onclick = () => { const f = FAN_STAND.find(x => x.id === b.dataset.fan); if (S['fan_' + f.id] || (RUN.fans || 0) < f.cost || !f.ok()) return nope(); f.go(ok => { if (!ok) return; RUN.fans -= f.cost; S['fan_' + f.id] = 1; saveRun(); renderShop(); renderRunBar(); }); });
  $('bPractice').onclick = () => { const cost = RUN.practiceCost || 50; if (S.practiced || !affordable(cost) || !RUN.deck.some(practicable)) return nope(); pickFromDeck('practice', c => { if (!c) return; RUN.gold -= cost; RUN.practiceCost = cost + 20; S.practiced = true; saveRun(); renderShop(); renderRunBar(); }); };
  $('bRemove').onclick = () => { if (S.removed || !affordable(RUN.removeCost)) return nope(); pickFromDeck('remove', c => { if (!c) return; RUN.gold -= RUN.removeCost; RUN.removeCost += 25; S.removed = true; saveRun(); renderShop(); renderRunBar(); }); };
  $('bLeave').onclick = backToMap;
}
function renderRest() {
  const el = $('v-panel'), heal = Math.round(RUN.maxhp * .3), curses = RUN.deck.filter(c => CARDS[c.id].type === 'curse');
  const art = portraitURL('troll', { color: '#3f6f92', light: '#bfe3ff', short: 'TRN' }, 0, 220);
  el.innerHTML = `<div class="panel">${panelHead('The Locker Room', 'A dripping stone room with benches, a cold plunge and an old troll trainer with a roll of tape. Pick one thing to do before you head back out.', art)}</div>`;
  $('pbody').innerHTML = `<div class="rest">
    <button id="rHeal" ${hasRelic('ioun') ? 'disabled' : ''}><strong>Ice bath</strong><span>${hasRelic('ioun') ? 'The Ioun Stone hums and will not let you rest.' : `Heal ${heal} HP (30% of max).`}</span></button>
    <button id="rPractice" ${RUN.deck.some(practicable) ? '' : 'disabled'}><strong>Practice</strong><span>Practice a card: ★, better at every sport.</span></button>
    <button id="rFilm" ${RUN.deck.some(upgradable) ? '' : 'disabled'}><strong>Film study</strong><span>Upgrade a card.</span></button>
    ${curses.length ? `<button id="rTape"><strong>Trainer’s table</strong><span>Tape a curse out of your deck (${curses.map(c => CARDS[c.id].n).join(', ')}).</span></button>` : ''}</div>`;
  $('rPractice').onclick = () => pickFromDeck('practice', c => { if (c) backToMap(); });
  $('rHeal').onclick = () => { RUN.hp = Math.min(RUN.maxhp, RUN.hp + heal); backToMap(); };
  $('rFilm').onclick = () => pickFromDeck('upgrade', c => { if (c) backToMap(); });
  if ($('rTape')) $('rTape').onclick = () => { const c = curses[0]; RUN.deck.splice(RUN.deck.indexOf(c), 1); backToMap(); };
}
function eventArt(ev) {
  if (ev.art) return portraitURL(ev.art.kind, ev.art.team, ev.art.num, 220);
  if (ev.scene === 'tryouts') { const k = RUN.tryout || 'goblin'; return portraitURL(k, { color: '#8a8070', light: '#efe4cc', short: 'TRY' }, '?', 220); }
  const cv2 = document.createElement('canvas'); cv2.width = cv2.height = 440; const c = cv2.getContext('2d'); c.scale(2, 2);
  const g = c.createRadialGradient(110, 80, 10, 110, 110, 160); g.addColorStop(0, '#3a6a3a'); g.addColorStop(1, '#0b0806'); c.fillStyle = g; c.fillRect(0, 0, 220, 220);
  LW = 2.4; ink(c, pRR(50, 70, 120, 110, 12), '#e0742a'); ink(c, pRR(44, 58, 132, 26, 8), '#f2ead8'); ink(c, pRR(96, 48, 28, 14, 4), '#d8d0c0');
  ink(c, pRR(62, 110, 96, 40, 6), '#f2ead8', 0, true); txt(c, 'VICTORY', 110, 137, F_HUD(26), '#3a6a3a', 'center');
  for (let i = 0; i < 6; i++) circ(c, 70 + i * 16, 52 - (i % 2) * 6, 3, '#7fe08a');
  return cv2.toDataURL();
}
function renderEvent() {
  const P = RUN.panel, ev = EVENTS.find(e => e.id === P.id), el = $('v-panel');
  if (ev.id === 'tryouts' && !RUN.tryout && !P.res) RUN.tryout = pick(Object.keys(KIND_NAME).filter(k => !runKinds().includes(k)));
  const text = ev.id === 'tryouts' ? `A ${KIND_NAME[RUN.tryout || 'goblin']} in a borrowed jersey is running drills alone in a side tunnel, very hard, hoping somebody notices. Or you could hold cuts instead.` : ev.text;
  el.innerHTML = `<div class="panel">${panelHead(ev.t, esc(text), eventArt(ev))}</div>`;
  const body = $('pbody');
  if (!P.res) {
    const opts = ev.opts();
    body.innerHTML = `<div class="opts">${opts.map((o, i) => `<button class="opt" data-o="${i}" ${o.ok && !o.ok() ? 'disabled' : ''}><b>${esc(o.label)}</b>${o.desc ? `<small>${esc(o.desc)}</small>` : ''}</button>`).join('')}</div>`;
    body.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { const r = opts[+b.dataset.o].go(); P.res = r.text; P.then = r.then || null; saveRun(); renderRunBar(); renderEvent(); if (/roll/i.test(r.text)) sfx.dice(); });
    return;
  }
  body.innerHTML = `<p class="result">${esc(P.res)}</p><div id="thenBox"></div><div class="row"><button class="btn" id="bEvDone">Back to the map</button></div>`;
  const T = P.then, box = $('thenBox');
  $('bEvDone').onclick = () => { if (P.then && P.then.relic) { gainRelic(P.then.relic); } backToMap(); };
  if (!T) return;
  if (T === 'remove' || T === 'upgrade') { box.innerHTML = `<button class="ghost" id="bThen">${T === 'remove' ? 'Choose a card to remove' : 'Choose a card to upgrade'}</button>`; $('bThen').onclick = () => pickFromDeck(T, c => { if (c) { P.then = null; saveRun(); renderEvent(); } }); }
  else if (T.cards) { box.innerHTML = `<div class="cardrow">${T.cards.map((c, i) => `<div class="ware">${cardHTML(Object.assign({ uid: 'e' + i }, c), { attrs: `data-ec="${i}"` })}${inDeckHTML(c.id)}</div>`).join('')}</div>${T.cards.length > 1 ? '<p class="hint">Pick one.</p>' : '<p class="hint">Click it to add it to your deck.</p>'}`; box.querySelectorAll('[data-ec]').forEach(el => el.onclick = () => { const c = T.cards[+el.dataset.ec]; RUN.deck.push(mkCard(c.id, c.up)); P.then = null; saveRun(); sfx.card(); renderEvent(); renderRunBar(); }); }
  else if (T.relic) { box.innerHTML = `<button class="reward" id="bTR">${relicI(T.relic)}<span><b>${esc(RELICS[T.relic].n)}</b><small>${esc(RELICS[T.relic].desc)}</small></span></button>`; $('bTR').onclick = () => { gainRelic(T.relic); P.then = null; saveRun(); renderEvent(); renderRunBar(); }; }
}

/* ---------- the end ---------- */
function showEnd(result) {
  showScreen('end');
  const win = result === 'win', T = clubTeam(), club = CLUBS[RUN.club];
  const killer = B && result === 'lose' ? B.enemies.filter(e => !e.dead && !e.fled).map(e => e.n) : [];
  $('scr-end').innerHTML = `<div class="panel" style="text-align:left">
    <p class="hint" style="margin:0">${esc(profileName())}’s run, on ${esc(diffOf(RUN).n)}</p>
    <h2 class="pgh" style="font-size:clamp(48px,8vw,96px)">${win ? 'Brimstone Cup champions' : result === 'quit' ? 'Forfeit' : 'Sudden death'}</h2>
    <p class="lede">${win ? `${esc(club.name)} beat the Commissioner of the Pit in his own building. ${RUN.party.map(p => esc(p.n)).join(', ')} carry the Cup up the stairs.` : result === 'quit' ? 'You walked off the field.' : `Your line fell in Act ${RUN.act + 1}, floor ${RUN.floor + 1}${killer.length ? `, beaten by ${esc(killer.join(' and '))}` : ''}.`}</p>
    <div class="row">${RUN.party.map(p => `<img src="${portraitURL(p.kind, T, p.num, 96)}" alt="${esc(p.n)}" width="96" height="96" style="border-radius:10px;${win ? '' : 'filter:grayscale(.7) brightness(.8)'}">`).join('')}</div>
    <div class="endstats"><div><b>${runScore(RUN)}</b>score</div><div><b>${RUN.stats.fights}</b>fights won</div><div><b>${RUN.stats.elites}</b>elites</div><div><b>${RUN.stats.bosses}</b>bosses</div><div><b>${RUN.stats.sportsWins || 0}</b>sports wins</div><div><b>${RUN.stats.highlights || 0}</b>highlights</div><div><b>${RUN.style || 0}</b>style points</div><div><b>${RUN.stats.dmg}</b>damage dealt</div><div><b>${RUN.stats.gold}</b>gold earned</div></div>
    <div><h4>Trophies</h4><div class="relics">${RUN.relics.map(id => `<button class="relic" data-tip="${relicTip(id)}">${relicI(id)}</button>`).join('')}</div></div>
    <div><h4>The season: ${gameRecord(RUN.games)} in games</h4>${seasonTable(RUN.games, CLUBS[RUN.club].short)}</div>
    <div id="endStats"></div>
    <div class="row"><button class="btn" id="bAgain">Draft a new line</button><button class="ghost" id="bSeeDeck">See the deck</button><button class="ghost" data-goto="rec">Records</button></div></div>`;
  const es = $('endStats'); if (es && (RUN.games || []).length) { let metric = 'd'; const draw = () => { es.innerHTML = `<h4>Player stats</h4>${statSheet(RUN.games, RUN.party, CLUBS[RUN.club].short, { metric })}`; es.querySelectorAll('[data-metric]').forEach(b => b.onclick = () => { metric = b.dataset.metric; draw(); }); }; draw(); }
  $('bAgain').onclick = () => { RUN = null; B = null; DR.club = null; DR.picks = []; showScreen('draft'); renderDraft(); };
  $('bSeeDeck').onclick = () => showDeck(RUN.deck, `Final deck (${RUN.deck.length})`);
  win ? sfx.crowd(2.5) : sfx.bad();
}

