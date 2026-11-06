/* w66: adventures, phase 1 (issue #47): what the player sees. The match card (the opponent, the conditions, and a
   plain warning before a pinnacle), the choice card, an Adventures tab in the journal (under way, finished, ended
   badly), the profile's adventure items in the Bag, rumours from the innkeepers (ask about RUMOURS) and on the notice
   boards, and How to play (#wHelpAdventures). The model is in w65.

   The journal tab registers through W_JTABS / W_JTAB_FN (w19).
   Wraps: wRunAct (wW66RunAct: 'adv:<id>:<step>' opens the match or choice card, 'advrumour' tells a rumour), wRenderCamp
   (wW66RenderCamp: the Bag's Adventures section), wOpenBoard (wW66OpenBoard: a rumour on the board), renderHelp
   (wW66RenderHelp). */

const W_ADV_TEXT = { warn: "This can't be retried.", none: 'No adventures yet. Rumours at the inns sometimes point the way.', quiet: 'Nothing worth repeating.' };

/* ---------- the cards ---------- */
function wAdvFoeText(step) {
  if ((step.engine || 'card') === 'card') {
    const names = [...new Set((step.ids || []).map(id => (ENEMIES[id] || {}).n).filter(Boolean))];
    return `${names.length ? names.join(' and ') : 'A local side'}, in ${W_ADV_CFG.engines.card} (tier ${step.tier || 1})`;
  }
  return `${wCap(wBallName(step.club || 'local'))}, at ${W_ADV_CFG.engines[step.engine]} (tier ${step.tier || 1})`;
}
function wAdvMatchCard(id, si) {
  const D = wAdv(id), step = wAdvStep(id, si); if (!D || !step) return;
  let chose = false;
  const unmet = wAdvUnmet(step);
  const close = modal(`<header><h3>${esc(D.title)}</h3></header>
    ${step.t ? `<p>${esc(step.t)}</p>` : ''}
    <p><b>The game:</b> ${esc(wAdvFoeText(step))}.</p>
    <ul class="wadvcond">${wAdvCondText(step).map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    ${step.pinnacle ? `<p class="wbad" id="wAdvWarn">${esc(W_ADV_TEXT.warn)}</p>` : ''}
    ${unmet.length ? `<p class="wbad" id="wAdvWhy">${unmet.map(esc).join(' ')}</p>` : ''}
    <div class="row"><button class="btn" id="wAdvPlay"${unmet.length ? ' disabled' : ''}>Play</button><button class="ghost" id="wAdvNo">Not yet</button></div>`,
    () => { if (!chose) wDrain(); });
  $('wAdvNo').onclick = () => close();
  $('wAdvPlay').onclick = () => {
    chose = true; close();
    const why = wAdvStartMatch(id, si);
    if (why) { wLog(why, 'd'); wDrain(); }
  };
}
function wAdvChoiceCard(id, si) {
  const D = wAdv(id), step = wAdvStep(id, si); if (!D || !step) return;
  const close = modal(`<header><h3>${esc(D.title)}</h3></header>
    <p>${esc(step.q || step.t || '')}</p>
    ${step.pinnacle ? `<p class="wbad" id="wAdvWarn">${esc(W_ADV_TEXT.warn)}</p>` : ''}
    <div class="row wadvopts">${step.opts.map((o, i) => `<button class="btn" data-advopt="${i}">${esc(o)}</button>`).join('')}<button class="ghost" id="wAdvNo">Not yet</button></div>`,
    () => wDrain());
  $('wAdvNo').onclick = () => close();
  $('modalBox').querySelectorAll('[data-advopt]').forEach(b => b.onclick = () => { const i = +b.dataset.advopt; close(); wAdvChoose(id, si, i); wSave(); wDrain(); });
}

/* ---------- rumours ---------- */
function wAdvRumour() {
  const S = wAdvAll(), lines = [];
  for (const D of W_ADV) if (!S.a[D.id]) for (const t of D.rumours || []) lines.push(t);
  return lines.length ? lines[(WG ? WG.dayAbs : 0) % lines.length] : '';
}
for (const id of W_TAVERN_INNS) {
  const ch = DB.chars[id]; if (!ch) continue;
  ch.topics.rumours = { t: 'Folk talk. Here is what I heard.', act: 'advrumour' };
}
const wW66RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'advrumour') { wLog(`${wChar(id).name}: "${wAdvRumour() || W_ADV_TEXT.quiet}"`, 'm'); return null; }
  if (typeof act === 'string' && act.startsWith('adv:')) {
    const [, aid, si] = act.split(':'), step = wAdvStep(aid, +si);
    if (!step || !wAdvLive(aid).some(L => L.si === +si)) return null;
    if (step.k === 'match') wAdvMatchCard(aid, +si); else if (step.k === 'choice') wAdvChoiceCard(aid, +si);
    return null;
  }
  return wW66RunAct(act, id);
};
const wW66OpenBoard = wOpenBoard;
wOpenBoard = function (city, msg) {
  wW66OpenBoard(city, msg);
  const h = document.querySelector('#modalBox header'), t = wAdvRumour(); if (!h || LAB || !t) return;
  h.insertAdjacentHTML('afterend', `<p class="wadvrum"><b>Heard around:</b> ${esc(t)}</p>`);
};

/* ---------- the journal: the Adventures tab ---------- */
function wAdvHome(charId) {
  const t = DB.towns.find(T => (T.npcs || []).some(n => n[0] === charId));
  return t ? wTownName(t.id) : '';
}
function wAdvJournalHtml(S) {
  S = S || wAdvAll(); const on = [], won = [], lost = [];
  for (const D of W_ADV) {
    const A = S.a[D.id]; if (!A) continue;
    const learned = A.learned.length ? `<ul>${A.learned.map(l => `<li>${esc(l.t)}</li>`).join('')}</ul>` : '';
    if (A.st === 'active') {
      const C = D.chapters[A.ch] || {}, items = Object.keys(A.items).map(k => `${esc((W_ADV_ITEMS[k] || {}).n || k)}${A.items[k] > 1 ? ' ×' + A.items[k] : ''}`);
      const next = wAdvLive(D.id, S).find(L => L.step.k === 'match');
      on.push(`<div class="wjq"><b>${esc(D.title)}</b>: ${esc(C.t || '')}<p class="hint">${esc(C.sum || D.teaser || '')}</p>${learned}
        ${items.length ? `<p>Carrying: ${items.join(', ')}.</p>` : ''}${next ? `<p>Next game: ${wAdvCondText(next.step).map(esc).join(' ')}</p>` : ''}</div>`);
    } else if (A.st === 'won') {
      const U = D.end && D.end.unlock, home = U ? wAdvHome(U.at) : '';
      const keep = !U ? '' : U.recruit ? `${esc(U.recruit.n)} waits ${wChar(U.at).name === U.recruit.n ? '' : 'with ' + esc(wChar(U.at).name) + ' '}${home ? 'in ' + esc(home) : ''} for every journey: ask about ${esc(U.kw.toUpperCase())}.`
        : `${esc(wChar(U.at).name)}${home ? ' in ' + esc(home) : ''} keeps your reward${U.relic && RELICS[U.relic] ? ' (the ' + esc(RELICS[U.relic].n) + ')' : ''} for every journey: ask about ${esc(U.kw.toUpperCase())}.`;
      won.push(`<div class="wjq"><b>${esc(D.title)}</b><p>${esc(wAdvEndText(D, A))}</p>${keep ? `<p class="hint">${keep}</p>` : ''}</div>`);
    } else {
      lost.push(`<div class="wjq"><b>${esc(D.title)}</b><p>${esc(D.lostText || 'It ended badly.')}</p>${A.why ? `<p class="hint">${esc(A.why)}</p>` : ''}</div>`);
    }
  }
  if (!on.length && !won.length && !lost.length) return `<p class="hint">${esc(W_ADV_TEXT.none)}</p>`;
  return `${on.length ? `<h4>Under way</h4>${on.join('')}` : ''}${won.length ? `<h4>Finished</h4>${won.join('')}` : ''}${lost.length ? `<h4>Ended badly</h4>${lost.join('')}` : ''}`;
}
W_JTABS.push(['adv', 'Adventures']);
W_JTAB_FN.adv = () => { const S = wAdvAll(); return [W_ADV.filter(D => S.a[D.id] && S.a[D.id].st === 'active').length, wAdvJournalHtml(S)]; };

/* ---------- the Bag ---------- */
const wW66RenderCamp = wRenderCamp;
wRenderCamp = function () {
  wW66RenderCamp();
  if (WCAMP.tab !== 'bag') return;
  const body = $('wCampBody'); if (!body) return;
  const S = wAdvAll(), rows = [];
  for (const D of W_ADV) { const A = S.a[D.id]; if (!A) continue; for (const k in A.items) { const I = W_ADV_ITEMS[k] || { n: k, d: '' }; rows.push(`<li><b>${esc(I.n)}</b>${A.items[k] > 1 ? ' ×' + A.items[k] : ''}: ${esc(I.d)} <span class="hint">(${esc(D.title)})</span></li>`); } }
  if (rows.length) body.insertAdjacentHTML('beforeend', `<div id="wBagAdv"><h4>Adventures</h4><ul>${rows.join('')}</ul></div>`);
};

/* ---------- How to play ---------- */
const wW66RenderHelp = renderHelp;
renderHelp = function () {
  wW66RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpAdventures')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpAdventures"><b>Adventures.</b> Some people in the Realm know the start of a longer story. Press the right person about the right thing and an adventure begins: chapters across the regions, with games to win along the way. Rumours at the inns can point you to them (ask an innkeeper about RUMOURS). Your progress stays with your profile from one journey to the next, and a finished adventure's reward is yours for good. Most setbacks can be tried again, but a few moments can't; the game tells you when. The journal's Adventures tab keeps track.</p>`);
};
