/* p8: screens and flow — title, draft, map nodes, rewards, shop, locker room, events, the end; pages; boot */
function showScreen(s) {
  for (const k of ['title', 'draft', 'run', 'end']) $('scr-' + k).hidden = k !== s;
  UI.screen = s; if (s !== 'run') UI.view = null;
  window.scrollTo({ top: 0 });
}
function showView(v) {
  showScreen('run'); UI.view = v;
  for (const k of ['map', 'fight', 'panel']) $('v-' + k).hidden = k !== v;
  hideTip();
  if (v === 'fight') { fitStage(true); requestAnimationFrame(() => fitStage()); }
  renderRunBar();
}
function showPage(p) {
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.pg === p ? 'page' : 'false'));
  for (const k of ['play', 'help', 'best', 'rec']) $('pg-' + k).hidden = k !== p;
  if (p === 'help') renderHelp(); if (p === 'best') renderBestiary(); if (p === 'rec') renderRecords();
  hideTip();
}

/* ---------- title ---------- */
const TITLE = { club: pick(CLUB_IDS), sports: ['football', 'baseball', 'hockey', 'basketball', 'bowling', 'jousting'], i: 0, t0: 0 };
TITLE.party = shuffle(CLUBS[TITLE.club].roster.slice()).slice(0, 3);
function drawTitle(c) {
  const k = (A.t - TITLE.t0); if (k > 5) { TITLE.i = (TITLE.i + 1) % TITLE.sports.length; TITLE.t0 = A.t; }
  const s = TITLE.sports[TITLE.i], prev = TITLE.sports[(TITLE.i + TITLE.sports.length - 1) % TITLE.sports.length];
  c.drawImage(arenaBG(prev, 2), 0, 0, SW, SH);
  c.save(); c.globalAlpha = Math.min(1, (A.t - TITLE.t0) / .8); c.drawImage(arenaBG(s, 2), 0, 0, SW, SH); c.restore();
  flames(c, 2);
  const team = CLUBS[TITLE.club];
  const draws = [];
  const TP = [{ x: 600, y: 410 }, { x: 520, y: 372 }, { x: 445, y: 420 }];
  TITLE.party.forEach(([n, kind, num], i) => draws.push({ y: TP[i].y, f: () => drawAny(c, kind, TP[i].x, TP[i].y, 104, team, { num, wpn: KIND_WPN[kind], wang: -1.15 + Math.sin(A.t * 2 + i) * .08 }) }));
  const bt = ENEMIES.baron.team, it = ACTS[2].team;
  draws.push({ y: 372, f: () => drawAny(c, 'fiend', 790, 372, 140, bt, { num: 1, wpn: 'scythe', wang: -1.2 + Math.sin(A.t * 1.6) * .1, flip: true }) });
  draws.push({ y: 320, f: () => drawAny(c, 'imp', 690, 320, 90, it, { num: 6, wpn: 'bat', wang: -1, flip: true }) });
  draws.push({ y: 430, f: () => drawAny(c, 'imp', 900, 430, 90, it, { num: 66, wpn: 'bat', wang: -1, flip: true }) });
  draws.sort((a, b) => a.y - b.y).forEach(d => d.f());
  scoreboard(c, s, 'Tonight: the Brimstone Pit');
}
function renderTitle() {
  const r = loadRun(), row = $('resumeRow');
  if (r) { const c = CLUBS[r.club]; row.hidden = false; row.innerHTML = `<b>Run in progress</b><span>${esc(c.name)}: ${r.party.map(p => esc(p.n)).join(', ')}. Act ${r.act + 1}, ${r.hp}/${r.maxhp} HP, ${r.gold} gold.${r.battle ? ` Paused mid-fight: turn ${r.battle.turn} against ${esc(r.battle.enemies.filter(e => !e.dead && !e.fled).map(e => e.n.split(',')[0]).join(', '))}.` : ''}</span><button class="btn" id="bResume" style="font-size:22px">Continue</button>`; $('bResume').onclick = () => resumeRun(r); }
  else row.hidden = true;
  showScreen('title');
}

/* ---------- draft ---------- */
const DR = { club: null, picks: [] };
function renderDraft() {
  const el = $('scr-draft');
  const free = DR.mode === 'free';
  if (free && !DR.cls) DR.cls = genDraftClass();
  const club = free ? CLUBS.free : DR.club && CLUBS[DR.club];
  const roster = free ? DR.cls : club ? club.roster : [];
  const sigTip = kind => esc(`<span class="t">${CARDS[SIG[kind]].n}</span>` + cardText({ id: SIG[kind] }, {}));
  const plBtn = ([n, kind, num, flav], i) => `<button class="pl" data-pi="${i}" aria-pressed="${DR.picks.includes(i)}"><img src="${portraitURL(kind, club, num, 76)}" alt=""><span><strong>${esc(n)}</strong><span class="k">${KIND_NAME[kind]}, #${num}</span><p>${esc(flav)}</p><div class="sig">Brings <b data-tip="${sigTip(kind)}">${esc(CARDS[SIG[kind]].n)}</b>${free ? `<br><small style="color:var(--faint)">${kindGroups(kind).join(', ')}</small>` : ''}</div></span></button>`;
  const relicOK = !free || DR.relic;
  el.innerHTML = `<h2 class="pgh">Draft your line</h2>
    <div class="filters" role="tablist"><button data-mode="club" aria-pressed="${!free}">From a club</button><button data-mode="free" aria-pressed="${free}">Open draft class</button></div>
    ${free ? `<p class="lede">One prospect of every kind in the league, none of them signed to a club. Take any three, mix any kinds, and pick the trophy you go down with. You play in the league’s own sand-coloured kit as the Free Agents.</p>
      <h3>Pick a starting trophy</h3><div class="clubs">${CLUB_IDS.map(id => { const r = CLUBS[id].relic; return `<button class="club" style="--cc:${CLUBS[id].color}" data-relic="${r}" aria-pressed="${DR.relic === r}"><strong>${esc(RELICS[r].n)}</strong><span class="rel">${esc(RELICS[r].desc)}</span><em>The ${esc(CLUBS[id].name)}’ trophy (${esc(CLUB_STYLE[id][0])}).</em></button>`; }).join('')}</div>
      <div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">The draft class: pick three</h3><button class="ghost" id="bReroll">New draft class</button></div>
      <div class="players">${roster.map(plBtn).join('')}</div>`
    : `<p class="lede">Pick a club, then three of its players. Each player brings a signature card, and their kind of cards will turn up as you go deeper. Your club brings a trophy.</p>
      <div class="clubs">${CLUB_IDS.map(id => { const c = CLUBS[id]; return `<button class="club" style="--cc:${c.color}" data-club="${id}" aria-pressed="${DR.club === id}"><strong>${esc(c.name)}</strong><span class="style">${esc(CLUB_STYLE[id][0])}</span><em>${esc(CLUB_STYLE[id][1])}</em><span class="rel"><b>${esc(RELICS[c.relic].n)}.</b> ${esc(RELICS[c.relic].desc)}</span><small class="mot">“${esc(c.motto)}”</small></button>`; }).join('')}</div>
      ${club ? `<h3>${esc(club.name)}: pick three</h3><div class="players">${roster.map(plBtn).join('')}</div>` : '<p class="hint">Pick a club to see its roster.</p>'}`}
    <div class="draftbar"><div class="picked">${[0, 1, 2].map(i => { const p = club && roster[DR.picks[i]]; return p ? `<img src="${portraitURL(p[1], club, p[2], 76)}" alt="${esc(p[0])}">` : '<span></span>'; }).join('')}</div>
    <div class="difpick"><span>Difficulty</span><div class="filters" role="radiogroup" aria-label="Difficulty" style="margin:0">${DIFFS.map((D, k) => `<button role="radio" data-diff="${k}" aria-checked="${(DR.diff != null ? DR.diff : SET.diff) === k}" aria-pressed="${(DR.diff != null ? DR.diff : SET.diff) === k}" data-tip="${esc(`<span class="t">${D.n}</span>${D.desc}${D.score !== 1 ? ` Score ×${D.score}.` : ''}`)}">${D.n}</button>`).join('')}</div></div>
    <button class="btn" id="bGo" ${DR.picks.length === 3 && relicOK ? '' : 'disabled'}>Into the dungeon</button><button class="ghost" id="bBack">Back</button>
    <span class="hint">${DR.picks.length}/3 picked${free && !DR.relic ? ', no trophy yet' : ''}. Your line shares one pool of ${START_HP} HP and one deck.</span></div>`;
  el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { if (DR.mode !== b.dataset.mode) DR.picks = []; DR.mode = b.dataset.mode; renderDraft(); });
  el.querySelectorAll('[data-club]').forEach(b => b.onclick = () => { if (DR.club !== b.dataset.club) DR.picks = []; DR.club = b.dataset.club; renderDraft(); });
  el.querySelectorAll('[data-relic]').forEach(b => b.onclick = () => { DR.relic = b.dataset.relic; renderDraft(); });
  el.querySelectorAll('[data-pi]').forEach(b => b.onclick = () => { const i = +b.dataset.pi; if (DR.picks.includes(i)) DR.picks = DR.picks.filter(x => x !== i); else if (DR.picks.length < 3) DR.picks.push(i); renderDraft(); });
  if ($('bReroll')) $('bReroll').onclick = () => { DR.cls = genDraftClass(); DR.picks = []; renderDraft(); };
  el.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { DR.diff = +b.dataset.diff; SET.diff = DR.diff; saveSettings(); renderDraft(); });
  $('bGo').onclick = () => { if (free) newRun('free', DR.picks, DR.cls, DR.relic); else newRun(DR.club, DR.picks); RUN.path = []; RUN.diff = DR.diff != null ? DR.diff : SET.diff; DR.cls = null; showView('map'); renderMap(); };
  $('bBack').onclick = () => renderTitle();
}

/* ---------- the run ---------- */
function resumeRun(r) {
  RUN = r; UID = Math.max(UID, ...RUN.deck.map(c => c.uid)) + 1;
  RUN.path = RUN.path || [];
  if (RUN.battle) restoreBattle(RUN.battle);
  else if (RUN.pending) beginFight(RUN.pending);
  else if (RUN.panel) renderPanel();
  else { showView('map'); renderMap(); }
}
function enterNode(k) {
  const n = RUN.map.nodes[k]; if (!n) return;
  RUN.pos = k; RUN.path.push(k); RUN.floor = n.r;
  skyTick();
  if (n.t === 'fight' || n.t === 'elite' || n.t === 'rival' || n.t === 'boss') { const enc = rollEncounter(n.t === 'fight' ? 'normal' : n.t, n.sport); if (n.trait) enc.trait = n.trait; if (n.stakes) enc.stakes = n.stakes; RUN.pending = enc; saveRun(); beginFight(enc); return; }
  if (n.t === 'rest') RUN.panel = { t: 'rest' };
  else if (n.t === 'shop') RUN.panel = { t: 'shop', shop: makeShop() };
  else if (n.t === 'event') RUN.panel = { t: 'event', id: pickEvent().id };
  else if (n.t === 'chest') RUN.panel = { t: 'chest', relic: randomRelic(), gold: ri(25, 45) };
  saveRun(); renderPanel();
}
function beginFight(enc) {
  A.ent = {}; A.pops = []; A.dice = null; A.spops = [];
  UI.sel = -1; UI.busy = false; UI.kbTarget = null;
  sprClear();
  startCombat(enc.ids, enc.type, enc.sport, enc.trait);
  showView('fight');
  A.vfx = [];
  if (enc.type === 'boss') for (const e of B.enemies) if (isBoss(e)) { const a = entA(e.uid); a.enter = A.t + .9; a.landed = 0; }
  const boss = enc.type === 'boss' ? ENEMIES[enc.ids.find(id => ENEMIES[id].boss) || enc.ids[0]] : null;
  B.fx.unshift({ k: 'banner', t: boss ? boss.n.split(',')[0] : enc.type === 'rival' ? `Rivalry game: ${B.enemies[0].n}` : enc.type === 'elite' ? `Elite: ${ENEMIES[enc.ids[0]].n}${enc.trait ? ` (${ELITE_TRAITS[enc.trait].n})` : ''}` : `${SPORTS[B.sport].n}: ${SPORTS[B.sport].rule}`, sub: boss && boss.id === 'baron' ? 'Four quarters, four sports. Every three turns the game changes.' : SPORT_BRIEF[B.sport] });
  consumeFx(); renderFightHUD();
  sfx.horn();
}
function finishFight() {
  UI.busy = false; if (RUN) RUN.battle = null;
  if (B.over === 'lose') { logGame(true); recordRun('lose'); showEnd('lose'); return; }
  afterCombat();
  const rw = combatRewards();
  RUN.pending = null;
  RUN.panel = { t: 'reward', rw, type: B.type, strike: B.strike, potg: B.sc && B.sc.potg, goals: RUN.goalsDone || [], stakes: settleStakes() }; RUN.goalsDone = [];
  saveRun(); renderPanel(); sfx.crowd(1);
}
function backToMap() { RUN.panel = null; saveRun(); showView('map'); renderMap(); }
function advanceAct() {
  RUN.act++;
  if (RUN.act >= 3) { RUN.act = 2; RUN.floor = FLOORS; recordRun('win'); showEnd('win'); return; }
  RUN.hp = Math.min(RUN.maxhp, RUN.hp + Math.round((RUN.maxhp - RUN.hp) * diffOf(RUN).heal));
  RUN.map = genMap(RUN.act); setGoals(RUN.act); RUN.pos = null; RUN.path = []; RUN.actFights = 0; RUN.floor = 0; RUN.panel = null;
  saveRun(); showView('map'); renderMap();
}
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
  return `<div class="cardrow">${list.map((c, i) => `<div class="ware">${cardHTML(Object.assign({ uid: attr + i }, c), { attrs: `data-${attr}="${i}"` })}<div class="fit${cardFit(c.id).length ? '' : ' dim'}">${cardFit(c.id).map(esc).join('<br>') || '&nbsp;'}</div></div>`).join('')}</div>`;
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
    const list = shuffle(cardPool('r').slice()).slice(0, 3).map(c => ({ id: c.id, up: false }));
    const close = modal(`<header><h3>Pick a rare card</h3><button class="ghost" data-close>Later</button></header>${cardChoiceRow(list, 'gr')}`);
    $('modalBox').querySelectorAll('[data-gr]').forEach(el => el.onclick = () => { const c = list[+el.dataset.gr]; RUN.deck.push(mkCard(c.id)); RUN.stats.cards++; RUN.rareTokens--; saveRun(); close(); take(); });
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
    <div><h4>Cards</h4><div class="cardrow">${S.cards.map((w, i) => `<div class="ware${w.sold ? ' sold' : ''}">${cardHTML({ uid: 's' + i, id: w.id }, { attrs: `data-buy-card="${i}"`, flav: false })}<div class="price${affordable(w.price) ? '' : ' no'}">${w.price} gold</div></div>`).join('')}</div></div>
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
  else if (T.cards) { box.innerHTML = `<div class="cardrow">${T.cards.map((c, i) => cardHTML(Object.assign({ uid: 'e' + i }, c), { attrs: `data-ec="${i}"` })).join('')}</div>${T.cards.length > 1 ? '<p class="hint">Pick one.</p>' : '<p class="hint">Click it to add it to your deck.</p>'}`; box.querySelectorAll('[data-ec]').forEach(el => el.onclick = () => { const c = T.cards[+el.dataset.ec]; RUN.deck.push(mkCard(c.id, c.up)); P.then = null; saveRun(); sfx.card(); renderEvent(); renderRunBar(); }); }
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

/* ---------- pages ---------- */
function renderHelp() {
  $('pg-help').innerHTML = `<h2 class="pgh">How to play</h2>
  <p class="lede">The Brimstone League’s best go underground in the off-season. You take three monsters from one club down through three acts of dungeon. Every fight is played under one sport’s rules, and the deck you build on the way is the only thing between your line and the floor.</p>
  <div class="two">
    <section><h3>A fight</h3><p class="hint">You and the enemies take turns. On your turn you get 3 <b>Stamina</b> and draw 5 cards. Each card costs Stamina to play (the number in its corner). Attacks hit an enemy, Skills mostly protect you, Powers stay in play for the rest of the fight. When you are done, end your turn and every enemy carries out the intent shown over its head.</p>
    <p class="hint">Your three monsters share one pool of HP. If it hits zero, the run is over. HP carries from fight to fight, so a clean win matters.</p>
    <p class="hint">Click a card to play it, or drag it onto an enemy. If it needs a target and there is more than one enemy, click the enemy. While a card is selected or hovered, the HP bars show how much it will take off, and LETHAL marks a kill. Keys: <kbd>1</kbd>–<kbd>0</kbd> pick a card, arrows choose a target, <kbd>Enter</kbd> plays it, <kbd>E</kbd> ends your turn. Hover an enemy to read exactly what it is about to do.</p></section>
    <section><h3>The descent</h3><p class="hint">Each act is a map of branching paths. Brawls give gold and a new card. Elites are harder and drop a trophy. Locker Rooms heal you or upgrade a card. The Pro Shop sells cards, trophies and tonics, and will take a card off your hands. Unknown rooms are events, and most of them want a d20.</p>
    <p class="hint">Beat the act’s boss to go deeper. Beat the Ash Baron at the bottom of the Brimstone Pit to win the Cup. The run saves after every room; close the tab and pick it up from the title screen.</p>
    <p class="hint">Your deck grows from your three monsters’ cards plus the league playbook. Pick the line carefully: a Kobold brings fire, a Lich brings the Plague, an Ogre brings an appetite.</p></section>
  </div>
  <section><h3>The sports</h3><p class="hint">The scoreboard on the back wall says which rule is in force. Most fights draw a random sport; elites and bosses have their own.</p>
  <div class="sportlist">${Object.entries(SPORTS).map(([k, s]) => `<div><strong>${s.n}</strong><em>${esc(s.rule)}</em><p>${esc(s.desc)}</p></div>`).join('')}</div></section>
  <section><h3>Sports wins</h3><p class="hint">Every fight keeps score. Your cards score by their type and how hard they hit (watch the gold badge on each card in your hand for what it will do: a double, a goal, +3, +14 yards). Enemy attacks that get through your Block score for them. Win the fight and the game and you get a sports win: style points for your score, bonus gold, and a pick from the highlight reel (a set play, film study, or more HP). Highlights like a walk-off, a hat trick or a buzzer beater add more style and better odds of a Hall of Fame card turning up on the reel.</p></section>
  <section><h3>Building for the game</h3><p class="hint">Every fight room on the map shows its sport, and each act has a home sport it plays most (baseball, then hockey, then football), so you can route toward the games your deck is good at. Cards tagged with a sport play best in it.</p>
  <p class="hint"><b>Practice (★)</b> is a second upgrade track, separate from film study. A practiced card keeps its fight stats but plays the game better. Practice a card at the locker room, in a practice session at the pro shop, or from the highlight reel after a sports win. What practice does depends on the sport:</p>
  <div class="sportlist">${Object.entries(PRACTICE).map(([s, t]) => `<div><strong>${SPORT_NAME[s]}</strong><p>${esc(t)}</p></div>`).join('')}</div></section>
  <section><h3>Season goals and fans</h3><p class="hint">Each act sets two season goals, shown on the map with your progress: win a number of games, win in three different sports, win your home sport, make highlights, or shut a team out. Each goal is a ladder of three tiers: finish one and it climbs to a harder target with a bigger payout (a rare card, practice, max HP, gold or fans), paid the moment you reach it. <b>Fans</b> come from every sports win (more with highlights) and are spent at the pro shop’s fan stand on practice sessions, max HP, or a mascot trophy. At the end of each fight the reward screen names the <b>play of the game</b>.</p></section>
  <section><h3>Trouble</h3><p class="hint"><b>Sport perks.</b> Some enemies are better at the game than the fight. A gold tag over an enemy names its perk, and its tooltip explains it. Perks are rare in brawls and common among elites, rivals and bosses:</p>
  <div class="sportlist">${Object.values(SPORT_PERKS).map(P => `<div><strong>${esc(P.n)}</strong><p>${esc(P.desc)}</p></div>`).join('')}</div>
  <p class="hint"><b>High stakes.</b> Some fight rooms carry a red badge on the map: losing the game there (even if you win the fight) costs you something. More of them turn up in later acts. Hover the room to see which:</p>
  <div class="sportlist">${Object.values(STAKES).map(S => `<div><strong>${esc(S.n)}</strong><p>${esc(S.desc)}</p></div>`).join('')}</div></section>
  <section><h3>Achievements and profiles</h3><p class="hint">Achievements count across every run you play: Cups (on each difficulty, as free agents, with different clubs), sports wins, every sport, hat tricks, grand slams, touchdowns, shutouts, comebacks, elites, bosses, season goals and practice. Each has bronze, silver and gold. They are in the record book. On the title screen you can create a <b>profile</b> for each person who plays on this device: each keeps its own run, record book, careers, achievements and coach’s notes. Guest plays without one.</p></section>
  <section><h3>Difficulty</h3><p class="hint">Pick it on the draft screen, or set a default in Settings. A run keeps the difficulty it started on, and anything other than Contender is marked in the record book.</p>
  <div class="sportlist">${DIFFS.map(D => `<div><strong>${esc(D.n)}</strong><p>${esc(D.desc)}${D.score !== 1 ? ` Score ×${D.score}.` : ''}</p></div>`).join('')}</div></section>
  <section><h3>Scouting reports</h3><p class="hint">Every elite on the map carries a trait, shown as a lettered badge on its room (green is soft, red is dangerous). Hover it for the report: what makes this one tough and what it pays on top of the usual trophy. Some are worth it at full HP and ruinous when you are hurt.</p>
  <div class="sportlist">${Object.values(ELITE_TRAITS).map(T => `<div><strong>${esc(T.n)}</strong><p>${esc(T.desc)} Pays: ${esc(T.pay.toLowerCase())}</p></div>`).join('')}</div></section>
  <section><h3>Moon and stars</h3><p class="hint">Two skylights in the arena wall show the sky. It moves one tick for every turn you take in a fight and every room you enter, across the whole run. The moon changes phase every ${MOON_EVERY} ticks and the constellations rotate every ${STARS_EVERY}, two at a time, so the pairings keep drifting. Each gives a small boost to certain kinds (beasts, undead, stoneborn, spellcasters, brutes, tricksters) or to cards of one sport. League cards count as their owner’s kind, and a damage bonus from the sky lands on a card’s first hit. The chips in the top bar and the panel on the map show what is up and when it changes.</p>
  <div class="sportlist">${MOON.map(m => `<div><strong>${esc(m.n)}</strong><p>${esc(m.desc)}</p></div>`).join('')}${STARS.map(m => `<div><strong>${esc(m.n)}</strong><em>Constellation</em><p>${esc(m.desc)}</p></div>`).join('')}</div>
  <p class="hint">Groups: ${Object.entries(SKY_GROUPS).map(([g, ks]) => `<b>${GROUP_NAME[g]}</b>: ${[...new Set(ks.filter(k => KIND_NAME[k]).map(k => KIND_NAME[k]))].join(', ')}`).join('. ')}.</p></section>
  <section><h3>Momentum</h3><p class="hint">The score pushes the fight. The bar under the scoreboard is a tug of war: get far enough ahead and the <b>crowd is on its feet</b> (your hits deal 1 more), further and it is a <b>rout</b> (2 more). Fall behind and they have <b>momentum</b> (their hits deal 1 more). Fall far behind and you hit <b>comeback mode</b>: their hits still deal 1 more, but you draw an extra card every turn. The stands fill with whoever is winning.</p></section>
  <section><h3>Card types and rarities</h3><dl><dt>Attack</dt><dd>Hits enemies. The main way to score.</dd><dt>Skill</dt><dd>Block, debuffs, draw. In football, Skills gain half their Block as yards.</dd><dt>Set play</dt><dd>A sports card. It works anywhere, and its <b>Home</b> bonus fires when the fight is played under its sport. Damaging plays count as at-bats, shots and baskets.</dd><dt>Power</dt><dd>Stays in play for the rest of the fight.</dd><dt>Gear</dt><dd>Stays in play with charges that get used up.</dd><dt>Rarity</dt><dd>Common, Uncommon (silver), Rare (gold), and Hall of Fame (gold foil): one per league kind, taken from their Black Ice ultimates, plus a few legends of the game. They hit hardest and cost the most.</dd></dl></section>
  <section><h3>Extra costs and extras</h3><dl><dt>HP</dt><dd>Lose that much HP when you play it.</dd><dt>Discard</dt><dd>Discard a card of your choice from your hand.</dd><dt>Fatigue</dt><dd>Puts Fatigue cards in your discard pile: junk that costs 1 to clear or melts away at the end of your turn.</dd><dt>Exert</dt><dd>That much less Stamina next turn.</dd><dt>Foul</dt><dd>Every enemy gains that much Strength, and in a scored sport they get a point.</dd><dt>Gold</dt><dd>Paid from your purse; you cannot play it if you are short.</dd><dt>Retain</dt><dd>Stays in your hand at the end of your turn.</dd><dt>Innate</dt><dd>Always in your opening hand.</dd><dt>Ignores Block</dt><dd>Damage goes straight through enemy Block.</dd><dt>Grows</dt><dd>Hits harder every time you play it in the same fight.</dd><dt>Combo</dt><dd>A bonus if the card you played just before it was the named type.</dd><dt>Momentum</dt><dd>A bonus if it is at least that many cards into your turn.</dd></dl></section>
  <section><h3>Keywords</h3><dl>${['str', 'dex', 'weak', 'vuln', 'psn', 'burn', 'stun', 'regen', 'thorns'].map(k => `<dt>${ST[k].n}</dt><dd>${esc(ST[k].desc)}</dd>`).join('')}<dt>Block</dt><dd>Soaks up damage before HP. Drains away at the start of your turn.</dd><dt>Exhaust</dt><dd>The card leaves your deck for the rest of the fight.</dd><dt>d20</dt><dd>Some cards and most events roll a twenty-sided die against a target number. A natural 20 always hits and doubles the card’s effect; a natural 1 always misses.</dd><dt>Tonics</dt><dd>One-shot potions you carry between fights. Click one in the bar above the arena to drink it.</dd></dl></section>`;
}
const BF = { kind: 'all', type: 'all', rar: 'all' };
function renderBestiary() {
  const kinds = ['all', 'any', ...Object.keys(KIND_NAME)];
  const cards = Object.values(CARDS).filter(c => c.rar !== 'x' && (BF.kind === 'all' || c.kind === BF.kind) && (BF.type === 'all' || c.type === BF.type || (BF.type === 'pow' && c.type === 'gear')) && (BF.rar === 'all' || c.rar === BF.rar)).map(c => ({ uid: 'b' + c.id, id: c.id }));
  const seen = (loadRun() || RUN || { seen: {} }).seen || {};
  $('pg-best').innerHTML = `<h2 class="pgh">Bestiary</h2><p class="lede">Every card, every trophy, and everything waiting downstairs.</p>
  <section><h3>Cards</h3><div class="filters">${kinds.map(k => `<button data-bk="${k}" aria-pressed="${BF.kind === k}">${k === 'all' ? 'All' : k === 'any' ? 'League playbook' : KIND_NAME[k]}</button>`).join('')}</div>
  <div class="filters">${[['all', 'Any type'], ['atk', 'Attacks'], ['skl', 'Skills'], ['play', 'Set plays'], ['pow', 'Powers and gear']].map(([k, n]) => `<button data-bt="${k}" aria-pressed="${BF.type === k}">${n}</button>`).join('')}${[['all', 'Any rarity'], ['s', 'Starter'], ['c', 'Common'], ['u', 'Uncommon'], ['r', 'Rare'], ['l', 'Hall of Fame']].map(([k, n]) => `<button data-br="${k}" aria-pressed="${BF.rar === k}">${n}</button>`).join('')}</div><p class="hint">${cards.length} cards.</p><div class="cardgrid">${cards.map(c => cardHTML(c, { flav: true })).join('')}</div></section>
  <section><h3>The dungeon</h3><div class="foes">${Object.values(ENEMIES).map(D => { const act = ENCOUNTERS.findIndex(E => [...(E.easy || []), ...E.normal, ...E.elite].flat().concat(E.boss).includes(D.id)); const tm = D.team || ACTS[Math.max(0, act)].team; return `<div class="foe"><img src="${portraitURL(D.kind, tm, '', 72)}" alt=""><div><strong>${esc(D.n)}</strong><span class="tag">${D.boss ? 'Boss' : D.elite ? 'Elite' : 'Brawler'}, Act ${act + 1}, ${D.hp[0] === D.hp[1] ? D.hp[0] : D.hp.join('–')} HP</span><p>${esc(D.flav || '')}</p><p>${Object.values(D.moves).map(m => esc(m.n)).join(', ')}.</p></div></div>`; }).join('')}</div></section>
  <section><h3>Trophies</h3><div class="items">${Object.keys(RELICS).map(id => `<div class="item" style="cursor:default">${relicI(id)}<span><b>${esc(RELICS[id].n)}</b></span><small>${RELICS[id].club ? 'Club trophy. ' : RELICS[id].boss ? 'Boss trophy. ' : ''}${esc(RELICS[id].desc)}</small></div>`).join('')}</div></section>
  <section><h3>Tonics</h3><div class="items">${Object.keys(TONICS).map(id => `<div class="item" style="cursor:default">${flaskI(TONICS[id].col)}<span><b>${esc(TONICS[id].n)}</b></span><small>${esc(TONICS[id].desc)}</small></div>`).join('')}</div></section>`;
  $('pg-best').querySelectorAll('[data-bk]').forEach(b => b.onclick = () => { BF.kind = b.dataset.bk; renderBestiary(); });
  $('pg-best').querySelectorAll('[data-bt]').forEach(b => b.onclick = () => { BF.type = b.dataset.bt; renderBestiary(); });
  $('pg-best').querySelectorAll('[data-br]').forEach(b => b.onclick = () => { BF.rar = b.dataset.br; renderBestiary(); });
}
// the game log as a table: one row per fight
let MVP_NAMES = null;
const mvpName = k => (MVP_NAMES && MVP_NAMES[k]) || memberName(k);
function seasonTable(games, me) {
  if (!games || !games.length) return '<p class="hint">No games played yet.</p>';
  const TY = { normal: 'Brawl', elite: 'Elite', rival: 'Rivalry', boss: 'Boss' };
  return `<div class="tablewrap"><table class="season"><thead><tr><th>#</th><th>Act</th><th>Opponent</th><th>Sport</th><th>Final</th><th>Result</th><th>Player of the game</th><th>Highlights</th></tr></thead><tbody>${games.map((g, i) => `<tr class="${g.fell ? 'fell' : g.won ? 'won' : ''}"><td>${i + 1}</td><td>${g.act + 1}</td><td>${esc((g.foes || []).join(', '))}<br><small>${TY[g.type] || ''}</small></td><td>${g.q ? `Four quarters<br><small>ended in ${SPORT_NAME[g.sport].toLowerCase()}</small>` : SPORT_NAME[g.sport]}</td><td>${esc(gameScore(g, me))}</td><td>${g.fell ? 'Fell' : g.won ? '<b>W</b>' : 'L'}</td><td>${g.mvp ? `${esc(mvpName(g.mvp))}<br><small>${((g.ps || {})[g.mvp] || {}).d || 0} dmg${((g.ps || {})[g.mvp] || {}).p ? `, ${g.ps[g.mvp].p} pts` : ''}</small>` : ''}</td><td>${(g.hl || []).map(h => `<span class="hlt">${esc(HL_NAME[h])}</span>`).join(' ')}</td></tr>`).join('')}</tbody></table></div>`;
}
function showSeason(games, me, title) {
  const won = games.filter(g => g.won).length, swept = {};
  for (const g of games) { const k = g.sport; swept[k] = swept[k] || [0, 0]; swept[k][g.won ? 0 : 1]++; }
  modal(`<header><h3>${esc(title || 'The season')}: ${won}–${games.length - won} in games</h3><button class="ghost" data-close>Close</button></header>
    <div class="deckbar">${Object.entries(swept).map(([k, [w, l]]) => `<span>${SPORT_NAME[k]} <b>${w}–${l}</b></span>`).join('')}</div>${seasonTable(games, me)}
    <p class="hint">W means you won the game as well as the fight (a sports win). L means you won the fight but lost on the scoreboard.</p>`);
}
function renderRecords() {
  const rec = loadRecords();
  const wins = rec.runs.filter(r => r.result === 'win').length, best = rec.runs.reduce((m, r) => Math.max(m, r.score), 0);
  $('pg-rec').innerHTML = `<h2 class="pgh">Records <small style="font-size:.4em;color:var(--dim)">${esc(profileName())}</small></h2>
  ${rec.runs.length ? `<div class="endstats" style="margin-bottom:18px"><div><b>${rec.runs.length}</b>runs</div><div><b>${wins}</b>Cups won</div><div><b>${best}</b>best score</div></div>
  <div class="tablewrap"><table><thead><tr><th>Date</th><th>Club and line</th><th>Result</th><th>Reached</th><th>Games</th><th>Score</th></tr></thead><tbody>${rec.runs.map(r => `<tr><td>${new Date(r.when).toLocaleDateString()}</td><td><b style="color:${CLUBS[r.club].color}">${esc(CLUBS[r.club].short)}</b> ${r.party.map(p => esc(p[0])).join(', ')}</td><td>${diffOf(r).id !== 'contender' ? `<span class="hlt" title="${esc(diffOf(r).n)} difficulty">${esc(diffOf(r).n)}</span> ` : ''}${r.result === 'win' ? '<b style="color:var(--torch)">Won the Cup</b>' : r.result === 'quit' ? 'Forfeit' : `Fell${r.killer ? ' to ' + esc(r.killer) : ''}`}</td><td>Act ${r.act + 1}, floor ${Math.min(r.floor + 1, FLOORS + 1)}</td><td>${r.games ? `<button class="ghost" style="font-size:17px;padding:4px 8px 2px" data-season="${rec.runs.indexOf(r)}">${gameRecord(r.games.map(g => ({ won: g.w })))}</button>` : (r.sportsWins || 0) + ' won'}</td><td>${r.score}</td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">No runs yet. Draft a line and go down.</p>'}`;
  const gamesAll = rec.runs.flatMap(r => r.games || []), gw = gamesAll.filter(g => g.w).length;
  if (gamesAll.length) $('pg-rec').querySelector('.endstats').insertAdjacentHTML('beforeend', `<div><b>${gw}–${gamesAll.length - gw}</b>all-time in games</div>`);
  $('pg-rec').insertAdjacentHTML('beforeend', achHTML() + `<h3 style="margin-top:26px">Player careers</h3>${careersHTML()}`);
  $('pg-rec').querySelectorAll('[data-career]').forEach(b => b.onclick = () => showCareer(b.dataset.career));
  $('pg-rec').querySelectorAll('[data-season]').forEach(b => b.onclick = () => { const r = rec.runs[+b.dataset.season]; MVP_NAMES = Object.fromEntries(r.party.map(p => [p[1], p[0]])); showSeason(r.games.map(unpackGame), CLUBS[r.club].short, `${CLUBS[r.club].name}, ${new Date(r.when).toLocaleDateString()}`); });
}
const unpackGame = g => ({ act: g.a, sport: g.s, type: g.t, us: g.u, them: g.h, opp: g.o, won: !!g.w, fell: !!g.f, hl: g.l || [], strokes: g.st, par: g.p, strike: !!g.k, turns: g.n, foes: g.x || [], q: g.q, ps: g.ps || {}, mvp: g.m });
/* ---------- boot ---------- */
let last = performance.now();
const tcv = $('tcv'), tctx = tcv.getContext('2d');
// a draw that throws part-way can leave save() unmatched, and with it a shadow blur, filter or alpha that then
// applies to every later frame. Start each frame from a clean context.
function cleanCtx(c) {
  if (frame.dirty && c.reset) { c.reset(); frame.dirty = 0; return; }
  c.shadowBlur = 0; c.shadowColor = 'transparent'; c.filter = 'none'; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
function frame(now) {
  const dt = UI.paused ? 0 : Math.min(.05, (now - last) / 1000); last = now; G.time += dt; A.t += dt;
  try {
    if (UI.screen === 'title' && !$('pg-play').hidden) { const d = Math.min(2, Math.max(1, (window.devicePixelRatio || 1) * tcv.clientWidth / SW)); if (Math.abs((tcv._d || 0) - d) > .05) { tcv.width = Math.round(SW * d); tcv.height = Math.round(SH * d); tcv._d = d; } tctx.setTransform(d, 0, 0, d, 0, 0); drawTitle(tctx); }
    if (UI.view === 'fight' && B && !$('pg-play').hidden) { if (!cv._d) fitStage(); consumeFx(); cleanCtx(ctx); ctx.setTransform(cv._d || 1, 0, 0, cv._d || 1, 0, 0); drawFight(ctx, dt); }
  } catch (e) { console.error(e); if (!frame.err) { frame.err = 1; window.__sdErrs.push(String(e && e.stack || e)); } frame.dirty = 1; }
  requestAnimationFrame(frame);
}
function boot() {
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => showPage(t.dataset.pg));
  document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) showPage(g.dataset.goto); });
  $('bSound').setAttribute('aria-pressed', SND.on);
  $('bSound').onclick = () => { SND.on = !SND.on; try { localStorage.setItem('sd-sound', SND.on ? 'on' : 'off'); } catch (e) { } $('bSound').setAttribute('aria-pressed', SND.on); };
  $('bNew').onclick = () => { DR.club = null; DR.picks = []; showScreen('draft'); renderDraft(); };
  window.addEventListener('resize', () => { if (UI.view === 'fight') fitStage(); });
  renderTitle();
  requestAnimationFrame(frame);
  // fonts land after first paint; repaint the portrait caches and the screens that use them
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const k in PORT) delete PORT[k]; for (const k in EMB) delete EMB[k]; for (const k in BGC) delete BGC[k]; if (UI.screen === 'draft') renderDraft(); if (UI.view === 'map') renderMap(); if (UI.view === 'fight') renderFightHUD(); });
}
if (!window.__SD_LAB) boot();
