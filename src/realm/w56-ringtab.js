/* w56: boxing on the Team screen (issue #23, follow-up), as the Seven tab (w43) and the Football view (w44) are for
   football. The issue promised cards "from the Ring tab, or the keeper", and box scores as football keeps them.
   The Ring tab: your boxers, each with their boxing ratings, their nature (BX_TRAIT, when their kind has one) and their
   line so far (bouts, won, lost, drawn, knockouts); Box a card (the card at the Anvil Ring: wOpenRingCard), the Anvil
   Belt, Resume when a card is waiting, and your last cards.
   The Stats tab gains a Boxing view: every boxer's line, sortable, as the Football view is. And each player's stats
   card a Boxing block: their six ratings with what levels have added, their nature, and their line in words.
   Wraps: wOpenCamp and wRenderCamp (wW56OpenCamp, wW56RenderCamp: the Ring tab), wCampStats (wW56CampStats: the Boxing
   view), wStatsCard (wW56StatsCard: the Boxing block), renderHelp (wW56RenderHelp: #wHelpRingTab). */

const W_RING_STATN = { reach: ['Rch', 'Reach: how far their punches land from'], pow: ['Pow', 'Power: how hard they hit'], spd: ['Spd', 'Speed: how fast they move and punch'],
  chin: ['Chn', 'Chin: how much they can take'], sta: ['Sta', 'Stamina: how long their breath lasts'], gui: ['Gui', 'Guile: reading punches, slipping and timing'] };
const W_RING_COLS = [['bb', 'B', 'Bouts boxed'], ['w', 'W', 'Bouts won'], ['l', 'L', 'Bouts lost'], ['d', 'D', 'Bouts drawn'], ['ko', 'KO', 'Wins inside the distance'],
  ['kd', 'KD', 'Knockdowns scored'], ['down', 'Down', 'Knockdowns taken'], ['landed', 'Landed', 'Punches landed'], ['thrown', 'Thrown', 'Punches thrown'], ['pw', 'Pw', 'Powers cast']];
function wRingLine(pid) { return (WG.bxstats || {})[pid] || null; }
function wRingLineWords(L) {
  if (!L || !L.bb) return '';
  const bits = [`${L.bb} bout${L.bb === 1 ? '' : 's'}: ${L.w} won, ${L.l} lost${L.d ? `, ${L.d} drawn` : ''}`];
  if (L.ko) bits.push(`${L.ko} inside the distance`);
  if (L.kd || L.down) bits.push(`${L.kd} knockdown${L.kd === 1 ? '' : 's'} scored, ${L.down} taken`);
  if (L.thrown) bits.push(`${L.landed} of ${L.thrown} punches landed`);
  if (L.pw) bits.push(`${L.pw} power${L.pw === 1 ? '' : 's'} cast`);
  return bits.join('; ') + '.';
}

/* ---------- the Boxing block on a player's stats ---------- */
function wBxCard(p) {
  const b = wBxOf(p); if (!b) return '';
  const bars = wBX.stats.map(s => { const [ab, what] = W_RING_STATN[s], got = b.got[s] || 0;
    return `<div class="wbdr" title="${esc(what)}"><span>${ab}</span><i><em style="width:${Math.round(100 * b[s] / W_BXG.cap)}%"></em></i><b>${b[s]}</b><small>${got ? `+${got}` : ''}</small></div>`; }).join('');
  const T = wBX.traits[p.kind], L = wRingLine(p.id);
  return `<div class="wbd wbxc"><h5>Boxing</h5>${L && L.bb ? `<p class="wbdbox">${esc(wRingLineWords(L))}</p>` : ''}${T ? `<p class="wbdpos">Nature: <b>${esc(T.n)}</b>. ${esc(T.desc)}</p>` : ''}
    <div class="wbdbars">${bars}</div><p class="hint">Each level adds a point to one rating (shown as +), mostly to what their kind is good at. Ratings run from 1 to ${W_BXG.cap}.</p></div>`;
}
const wW56StatsCard = wStatsCard;
wStatsCard = function (p) { return wW56StatsCard(p).replace(/<\/section>\s*$/, wBxCard(p) + '</section>'); };

/* ---------- the Ring tab ---------- */
function wRingTabRow(p) {
  const b = wBxOf(p), L = wRingLine(p.id), T = wBX.traits[p.kind];
  return `<li class="wpr wnr" data-rpid="${p.id}"><span class="wno">${p.lvl}</span><img src="${wPlayerPort(p, 64)}" alt="">
    <div class="wpi"><div class="wpn"><b>${esc(p.n)}</b><span class="k">${esc(wKindName(p.kind))}, level ${p.lvl}</span>${T ? `<span class="wtag" title="${esc(T.desc)}">${esc(T.n)}</span>` : ''}</div>
      <small class="wnst">${wBX.stats.map(s => `<span title="${esc(W_RING_STATN[s][1])}">${W_RING_STATN[s][0]} <b>${b[s]}</b></span>`).join(' ')}</small>
      <small class="wnst">${L && L.bb ? `${L.bb} bout${L.bb === 1 ? '' : 's'}: ${L.w}–${L.l}${L.d ? `–${L.d}` : ''}${L.ko ? `, ${L.ko} KO` : ''}` : 'No bouts yet.'}</small></div></li>`;
}
function wCampRing() {
  const probs = wRingProblems(), live = wRingLive(), B = WG.bxg;
  const play = live ? '<button class="btn" data-rgresume>Resume the card</button>' : `<button class="btn" data-rgplay ${probs.length ? 'disabled' : ''}>Box a card</button>`;
  const cards = B && B.cards.length ? `<h5 class="wbrh">Last cards: ${B.w}&ndash;${B.l}${B.t ? `&ndash;${B.t}` : ''}</h5><ol class="wstlog">${B.cards.slice(0, 5).map(g => `<li><b class="${g.r === 'win' ? 'wgood' : 'wbad'}">${g.r === 'win' ? 'Won' : g.r === 'tie' ? 'Drew' : 'Lost'} ${g.us}–${g.them}</b> against ${esc(g.name)}${g.by && g.by !== 'bouts' && g.by !== 'draw' ? `, ${g.by === 'conceded' ? 'conceded' : `on ${esc(g.by)}`}` : ''}</li>`).join('')}</ol>` : '';
  return `<p class="hint">Your boxers. A card at the Anvil Ring is three bouts: you pick who of yours faces each of theirs. Each fighter boxes on their own ratings, which grow with their level, and some kinds have a nature of their own in the ring. Pick a player on the Stats tab to see their ratings in full.</p>
    <ol class="wroster wnine wring">${wRoster().map(wRingTabRow).join('')}</ol>
    ${probs.length && !live ? `<p class="hint wball">${esc(probs[0])}</p>` : ''}
    <div class="row wnbtn">${play}<button class="ghost" data-rgbelt>Anvil Belt${wBcupOn() ? ` (${W_BCUP.rounds[wBcup().round].toLowerCase()})` : ''}</button></div>${cards}`;
}
const wW56OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  wW56OpenCamp(want === 'ring' ? 'team' : tab);
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="ring"]')) return;
  tabs.lastElementChild.insertAdjacentHTML('afterend', '<button role="tab" data-ctab="ring">Ring</button>');
  tabs.querySelector('[data-ctab="ring"]').onclick = () => { WCAMP.tab = 'ring'; WCAMP.swap = null; WCAMP.msg = ''; wRenderCamp(); };
  if (want === 'ring') { WCAMP.tab = 'ring'; wRenderCamp(); }
};
const wW56RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'ring') return wW56RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="ring"]')) { WCAMP.tab = 'team'; return wRenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'ring'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  body.innerHTML = `<div class="wcsum"><span>Players <b>${wRoster().length}/${W_PARTY.max}</b></span><span>Cards <b>${(WG.bxg && WG.bxg.w) || 0}&ndash;${(WG.bxg && WG.bxg.l) || 0}</b></span></div>` + wCampRing();
  const p = body.querySelector('[data-rgplay]'); if (p) p.onclick = () => { WCAMP.close(); wOpenRingCard(); };
  const r = body.querySelector('[data-rgresume]'); if (r) r.onclick = () => { WCAMP.close(); wResumeRing(); };
  const t = body.querySelector('[data-rgbelt]'); if (t) t.onclick = () => { WCAMP.close(); wOpenBcup(); };
};

/* ---------- box scores on the Stats tab ---------- */
const wW56CampStats = wCampStats;
wCampStats = function () {
  const html = wW56CampStats().replace(/(<button data-wsview="career"[^>]*>Career<\/button>)/, `$1<button data-wsview="boxing" aria-pressed="${WSTAT.view === 'boxing'}">Boxing</button>`);
  if (WSTAT.view !== 'boxing') return html;
  const k = WSTAT.sort && W_RING_COLS.some(c => c[0] === WSTAT.sort) ? WSTAT.sort : null;
  const rows = wRoster().map((p, i) => ({ p, i, L: wRingLine(p.id) }));
  if (k) rows.sort((a, b) => (((b.L || {})[k] || 0) - ((a.L || {})[k] || 0)) || a.i - b.i);
  const head = `<th scope="col"><button class="wsth" data-wsort="" aria-pressed="${!k}">Player</button></th>` + W_RING_COLS.map(([c, s, l]) => `<th scope="col"><button class="wsth" data-wsort="${c}" title="${esc(l)}" aria-pressed="${k === c}">${s}</button></th>`).join('');
  const body = rows.map(({ p, L }) => `<tr data-wsp="${p.id}"${WSTAT.pid === p.id ? ' class="wsel"' : ''}><th scope="row"><button class="wsname" data-wsp-open aria-expanded="${WSTAT.pid === p.id}"><img src="${wPlayerPort(p, 40)}" alt=""><span><b>${esc(p.n)}</b><small>${esc(wKindName(p.kind))}</small></span></button></th>
    ${W_RING_COLS.map(([c]) => `<td>${L ? L[c] || 0 : '<span class="dim">&ndash;</span>'}</td>`).join('')}</tr>`).join('');
  const sel = WSTAT.pid != null && wPlayer(WSTAT.pid);
  return html.replace(/<small class="hint">[\s\S]*?<\/small>/, '<small class="hint">Every bout they boxed on a card from the world on this journey (exhibitions and call-ups are not counted). Pick a heading to sort, a player to see more.</small>')
    .replace(/<div class="tablewrap">[\s\S]*$/, `<div class="tablewrap"><table class="wstats"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${sel ? wStatsCard(sel) : ''}`);
};

const wW56RenderHelp = renderHelp;
renderHelp = function () {
  wW56RenderHelp();
  const after = $('wHelpRingGame'); if (!after || $('wHelpRingTab')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpRingTab"><b>Your boxers.</b> The Ring tab on the Team screen lists your boxers with their boxing ratings (reach, power, speed, chin, stamina and guile, 1 to ${W_BXG.cap}), their nature and their record, with Box a card and the Anvil Belt. Each level adds a point to one rating, mostly to what their kind is good at. The Stats tab has a Boxing view with every boxer's line, and each player's stats show their boxing ratings.</p>`);
};
