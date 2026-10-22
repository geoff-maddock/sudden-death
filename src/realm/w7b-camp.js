/* w7b: the camp. A Team button in the world HUD (and the C key) opens it: the roster with portraits, levels and
   XP, who starts and who sits, each player's cards, release, and the whole deck sorted by player. The model is
   w6-party.js; this part only reads it and calls it.
   Realm functions wrapped here: wRenderHud (the Team button, and the prompt queue: level-up picks and recruits
   wait until the world is free). Sudden Death's renderHelp is reassigned to add the team to "The realm". */

const WCAMP = { tab: 'team', swap: null, open: {}, drag: null, msg: '', close: null };

const wW7RenderHud = wRenderHud;
wRenderHud = function () {
  wW7RenderHud();
  if (!WUI.built || !WG) return;
  const hud = $('wHud');
  if (hud && !$('wCampBtn')) {
    hud.insertAdjacentHTML('beforeend', `<button class="ghost wcampb" id="wCampBtn" title="Your team: lineup, levels, cards (C)">Team <small>${wRoster().length}</small></button>`);
    $('wCampBtn').onclick = () => { if (wActive()) wOpenCamp(); };
    const pa = hud.querySelector('.wparty'); if (pa) { pa.style.cursor = 'pointer'; pa.onclick = () => { if (wActive()) wOpenCamp(); }; }
  } else if (hud) { const sm = $('wCampBtn').querySelector('small'); if (sm && sm.textContent !== String(wRoster().length)) sm.textContent = wRoster().length; }
  wNextPrompt();
};
document.addEventListener('keydown', e => {
  if ((e.key === 'c' || e.key === 'C') && wActive() && !WUI.talk && !(e.target.closest && e.target.closest('input,textarea,select')) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); wOpenCamp(); }
});

function wOpenCamp(tab) {
  if (!WG || !RUN) return;
  if (tab) WCAMP.tab = tab;
  WCAMP.swap = null; WCAMP.msg = '';
  WCAMP.close = modal(`<header><h3>${esc(wPartyTeam().name)}: the team</h3><div class="row"><div class="filters wctabs" role="tablist" style="margin:0"><button role="tab" data-ctab="team">Lineup</button><button role="tab" data-ctab="deck">Deck</button></div><button class="ghost" data-close>Close</button></div></header>
    <div class="wcamp" id="wCampBody"></div>`, () => { WCAMP.swap = null; WUI.hudKey = ''; wDrain(); });
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => b.onclick = () => { WCAMP.tab = b.dataset.ctab; WCAMP.swap = null; WCAMP.msg = ''; wRenderCamp(); });
  wRenderCamp();
}
function wCampSay(msg) { WCAMP.msg = msg || ''; wRenderCamp(); }
function wRenderCamp() {
  const body = $('wCampBody'); if (!body) return;
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === WCAMP.tab; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  const next = wNextMatchDeck().length;
  const sum = `<div class="wcsum"><span>Team HP <b class="whp">${RUN.hp}/${RUN.maxhp}</b></span><span>Gold <b class="wgold">${RUN.gold}</b></span><span>Players <b>${wRoster().length}/${W_PARTY.max}</b></span><span>Next match deck <b>${next}</b> of ${wAllCards().length} cards</span></div>
    ${WCAMP.msg ? `<p class="wbad wcmsg" role="alert">${esc(WCAMP.msg)}</p>` : ''}`;
  body.innerHTML = sum + (WCAMP.tab === 'deck' ? wCampDeck() : wCampTeam());
  if (WCAMP.tab === 'deck') return;
  const act = (sel, fn) => body.querySelectorAll(sel).forEach(b => b.onclick = () => fn(+b.closest('[data-pid]').dataset.pid, b));
  act('[data-up]', pid => wCampSay(wMovePlayer(pid, wRoster().findIndex(p => p.id === pid) - 1)));
  act('[data-dn]', pid => wCampSay(wMovePlayer(pid, wRoster().findIndex(p => p.id === pid) + 1)));
  act('[data-swap]', pid => { WCAMP.swap = WCAMP.swap === pid ? null : pid; wCampSay(''); });
  act('[data-with]', (pid, b) => { WCAMP.swap = null; wCampSay(wSwap(pid, +b.dataset.with)); });
  act('[data-cards]', pid => { WCAMP.open[pid] = !WCAMP.open[pid]; wRenderCamp(); });
  act('[data-rel]', pid => {
    const p = wPlayer(pid); if (!p) return;
    if (wRoster().length <= W_PARTY.starters) return wCampSay(`You need at least ${W_PARTY.starters} players.`);
    const heir = wRoster().find(y => y.id !== pid && y.kind === p.kind), n = wCardsOf(pid).length;
    WCAMP.close();
    askConfirm(`Release ${p.n}?`, `${p.n} leaves the team for good${heir ? `, and ${heir.n} takes over their ${n} cards` : `, with their ${n} card${n === 1 ? '' : 's'}`}.`, 'Release',
      () => { const why = wRelease(pid); wOpenCamp(); if (why) wCampSay(why); wDrain(); }, () => wOpenCamp());
  });
  body.querySelectorAll('[data-wait]').forEach(b => b.onclick = () => { const i = +b.dataset.wait; WCAMP.close(); wSignWaiting(i); if ($('modal').hidden) wOpenCamp(); });
  // drag to reorder (the arrow buttons do the same from the keyboard)
  body.querySelectorAll('li[data-pid]').forEach(li => {
    li.addEventListener('dragstart', e => { WCAMP.drag = +li.dataset.pid; li.classList.add('wdrag'); try { e.dataTransfer.setData('text/plain', li.dataset.pid); e.dataTransfer.effectAllowed = 'move'; } catch (x) { } });
    li.addEventListener('dragend', () => { WCAMP.drag = null; li.classList.remove('wdrag'); });
    li.addEventListener('dragover', e => { if (WCAMP.drag != null) { e.preventDefault(); li.classList.add('wover'); } });
    li.addEventListener('dragleave', () => li.classList.remove('wover'));
    li.addEventListener('drop', e => { e.preventDefault(); const from = WCAMP.drag; WCAMP.drag = null; if (from == null) return; wCampSay(wMovePlayer(from, wRoster().findIndex(p => p.id === +li.dataset.pid))); });
  });
}
function wXpBar(p) {
  const max = p.lvl >= W_PARTY.maxLvl, need = wXpNeed(p.lvl), pc = max ? 100 : Math.round(100 * p.xp / need);
  return `<div class="wlv"><b>Lv ${p.lvl}</b><span class="wxp" role="progressbar" aria-label="${esc(p.n)}'s XP" aria-valuemin="0" aria-valuemax="${need}" aria-valuenow="${max ? need : p.xp}"><i style="width:${pc}%"></i></span><small>${max ? 'Top level' : `${p.xp}/${need} XP`}</small></div>`;
}
const W_FROM = { founder: 'a founder', tavern: 'signed at a tavern', postgame: 'joined after a game', quest: 'joined on a quest' };
function wCampRow(p, i) {
  const R = wRoster(), st = i < W_PARTY.starters, cards = wCardsOf(p.id), car = wCareer(p);
  const others = R.filter((q, j) => (j < W_PARTY.starters) !== st);
  const swapping = WCAMP.swap === p.id;
  return `<li class="wpr${st ? ' wst' : ''}" draggable="true" data-pid="${p.id}">
    <img src="${wPlayerPort(p, 76)}" alt="">
    <div class="wpi"><div class="wpn"><b>${esc(p.n)}</b><span class="k">${esc(wKindName(p.kind))}, #${p.num}</span>${st ? '<span class="wtag">Starts</span>' : '<span class="wtag wb">Bench</span>'}</div>
      ${wXpBar(p)}
      <small class="wcar">${car && car.games ? `${car.games} game${car.games === 1 ? '' : 's'}, ${car.mvp} MVP${car.mvp === 1 ? '' : 's'}. ` : ''}${esc(wCap(W_FROM[p.from] || 'on the team'))}, day ${p.joined || 1}.</small></div>
    <div class="wpa">
      <button class="ghost" data-up aria-label="Move ${esc(p.n)} up" ${i === 0 ? 'disabled' : ''}>&#9650;</button><button class="ghost" data-dn aria-label="Move ${esc(p.n)} down" ${i === R.length - 1 ? 'disabled' : ''}>&#9660;</button>
      <button class="ghost" data-swap aria-expanded="${swapping}" ${others.length ? '' : 'disabled title="Nobody on the bench"'}>${st ? 'Bench' : 'Start'}</button>
      <button class="ghost" data-cards aria-expanded="${!!WCAMP.open[p.id]}">Cards ${cards.length}</button>
      <button class="ghost wrelx" data-rel aria-label="Release ${esc(p.n)}">Release</button>
    </div>
    ${swapping ? `<div class="wswap"><span>${st ? `Bench ${esc(p.n)} for:` : `Start ${esc(p.n)} instead of:`}</span>${others.map(q => `<button class="ghost" data-with="${q.id}">${esc(q.n)} <small>${esc(wKindName(q.kind))}</small></button>`).join('')}</div>` : ''}
    ${WCAMP.open[p.id] ? `<div class="wpc">${cards.length ? sortDeck(cards).map(c => `<span class="wcc" tabindex="0" data-tip="${esc(`<span class="t">${def(c).n}</span>` + cardText(c, {}))}">${esc(def(c).n)}</span>`).join('') : '<span class="hint">No cards of their own yet.</span>'}</div>` : ''}
  </li>`;
}
function wCampTeam() {
  const R = wRoster(), st = R.slice(0, W_PARTY.starters), bn = R.slice(W_PARTY.starters);
  const rv = WG.rivals || {};
  return `<p class="hint">The first three start every match; their cards and the league cards make the deck. Benched players sit out with their cards, and still earn half the XP. Drag players, or use the arrows, to change the order.</p>
    <h4>Starting three</h4><ol class="wroster">${st.map((p, i) => wCampRow(p, i)).join('')}</ol>
    <h4>Bench</h4>${bn.length ? `<ol class="wroster" start="4">${bn.map((p, i) => wCampRow(p, i + W_PARTY.starters)).join('')}</ol>` : '<p class="hint">Nobody on the bench yet. Free agents wait at every inn: talk to the innkeeper and ask about AGENTS.</p>'}
    ${(WG.wwait || []).length ? `<h4>Waiting to join</h4><div class="wwait">${WG.wwait.map((p, i) => `<div class="wag"><img src="${wPlayerPort(p, 64)}" alt=""><div><b>${esc(p.n)}</b><span class="k">${esc(wKindName(p.kind))}, level ${p.lvl}</span></div><button class="btn" data-wait="${i}">Sign</button></div>`).join('')}</div>` : ''}
    ${Object.keys(rv).length ? `<p class="hint wrivals">Rivals on the road: ${Object.keys(rv).filter(k => CLUBS[rv[k]]).map(k => `the ${esc(CLUBS[rv[k]].name)}`).join(', ')}.</p>` : ''}`;
}
function wCampDeck() {
  const grid = cards => `<div class="cardgrid">${sortDeck(cards).map(c => cardHTML(c, { flav: false })).join('')}</div>`;
  const league = wLeagueCards();
  return `<p class="hint">League cards always play. A player's own cards play when they start, and sit out with them on the bench.</p>
    <section class="wdk"><h4>League cards (${league.length}): always in the deck</h4>${league.length ? grid(league) : '<p class="hint">None.</p>'}</section>
    ${wRoster().map(p => { const cs = wCardsOf(p.id), st = wIsStarter(p.id); return `<section class="wdk${st ? '' : ' wout'}"><h4><img src="${wPlayerPort(p, 40)}" alt="">${esc(p.n)} (${cs.length})${st ? ': starts' : ': on the bench, sits out'}</h4>${cs.length ? grid(cs) : '<p class="hint">No cards of their own yet.</p>'}</section>`; }).join('')}`;
}

/* ---------- How to play: the team ---------- */
const wW5RenderHelp = renderHelp;
renderHelp = function () {
  wW5RenderHelp();
  const sec = $('wHelp'); if (!sec || $('wHelpTeam')) return;
  sec.insertAdjacentHTML('beforeend', `<div id="wHelpTeam"><h4>Your team</h4>
    <p class="hint">You start by picking a club and three of its players. Your team can grow to ${W_PARTY.max} players. The first three in the lineup start every match; the rest sit on the bench. Open the team with the <b>Team</b> button or the <kbd>C</kbd> key to change who starts.</p>
    <p class="hint"><b>Cards belong to players.</b> League cards always play. Every other card belongs to the player of its kind, and plays only when that player starts: bench someone and their cards sit out with them. The Deck tab shows whose cards are whose.</p>
    <p class="hint"><b>Levels.</b> Players earn XP from every match: starters the full amount (more for a win, a bonus for player of the game), the bench half. Each level up, to level ${W_PARTY.maxLvl}, raises the team's max HP by ${W_PARTY.hpPerLvl} and offers a card of that player's kind. A lost match still pays a quarter.</p>
    <p class="hint"><b>Recruiting.</b> Free agents wait at every inn: ask the innkeeper about AGENTS (the inn's room menu has a Free agents button too), and pay a signing fee. They change every week. After a win, one of the players you beat may ask to join, more often after an elite game. Some quests end with a new player, too. A new player brings their signature card and a card or two of their kind. With a full roster you have to release someone first, and a released player takes their cards with them.</p></div>`);
};
