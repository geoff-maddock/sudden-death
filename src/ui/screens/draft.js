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

