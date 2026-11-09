/* p9b: the Daily tab, the title screen's Daily button, and How to play's section (issue #60, phase 2). The daily
   itself is in run/daily.js. Wraps renderTitle and renderHelp. */
const DAILY_RES = { win: 'Won the Cup', on: 'In progress', gone: 'Abandoned' };
function dailyResult(key, e, saved) {
  const s = dailyState(key, e, saved);
  if (s === 'lose') return `Lost in act ${(e.act || 0) + 1}, floor ${(e.floor || 0) + 1}`;
  return DAILY_RES[s] || '';
}
function renderDaily() {
  const el = $('pg-daily'); if (!el) return;
  const key = dayKey(), D = dailyOf(key), rec = loadDaily(), e = rec.days[key], saved = loadRun(), st = dailyState(key, e, saved);
  const club = D.free ? CLUBS.free : CLUBS[D.club], T = DAILY_TWISTS[D.twist], Df = DIFFS[D.diff];
  const keys = Object.keys(rec.days).sort().reverse(), done = keys.filter(k => ['win', 'lose'].includes(rec.days[k].st));
  const best = done.reduce((m, k) => Math.max(m, rec.days[k].score || 0), 0), wins = done.filter(k => rec.days[k].st === 'win').length;
  const action = st === 'none' ? `<button class="btn" id="bDailyGo">Play today’s game</button>`
    : st === 'on' ? `<button class="btn" id="bDailyGo">Continue today’s game</button>`
    : `<p class="hint" id="dailyDone"><b>${esc(dailyResult(key, e, saved))}${e.score ? `, ${e.score} points` : ''}.</b> That’s today’s game played. A new one starts at midnight.</p>`;
  el.innerHTML = `<h2 class="pgh">The Daily <small style="font-size:.4em;color:var(--dim)">${esc(profileName())}</small></h2>
  <p class="lede">One game a day, the same for everyone: the same club and line, the same twist, and the same dungeon, rewards and fights. You get one go. It gets harder through the week, from Rookie on Sunday to Hall of Fame on Saturday.</p>
  <div class="daily" style="--cc:${club.color}">
    <div class="dhead"><h3>${esc(dayName(key, true))}</h3><span class="ddiff" data-tip="${esc(`<span class="t">${Df.n}</span>${Df.desc}`)}">${esc(Df.n)}</span></div>
    <p class="dclub"><b>${esc(D.free ? 'The Free Agents' : club.name)}</b>${D.free ? `, with the ${esc(CLUBS[D.club].name)}’ trophy` : ''}</p>
    <div class="dline">${D.line.map(([n, kind, num]) => `<div><img src="${portraitURL(kind, club, num, 64)}" alt=""><span><b>${esc(n)}</b><small>${KIND_NAME[kind]}</small></span></div>`).join('')}</div>
    <p class="dtwist"><b>Twist: ${esc(T.n)}.</b> ${esc(T.d)}</p>
    ${action}
  </div>
  <div class="endstats" style="margin:18px 0"><div><b id="dStreak">${dailyStreak(rec.days, key)}</b>day streak</div><div><b>${keys.length}</b>dailies played</div><div><b>${wins}</b>Cups won</div><div><b>${best}</b>best score</div></div>
  ${keys.length ? `<div class="tablewrap"><table id="dTable"><thead><tr><th>Day</th><th>Difficulty</th><th>Club</th><th>Twist</th><th>Result</th><th>Score</th></tr></thead><tbody>${keys.slice(0, 60).map(k => { const x = rec.days[k], c = CLUBS[x.club] || CLUBS.free, tw = DAILY_TWISTS[x.twist]; return `<tr><td>${esc(dayName(k))}</td><td>${esc((DIFFS[x.diff] || DIFFS[1]).n)}</td><td><b style="color:${c.color}">${esc(x.club === 'free' ? 'Free Agents' : c.name)}</b></td><td>${esc(tw ? tw.n : '')}</td><td>${esc(dailyResult(k, x, saved))}</td><td>${x.score != null ? x.score : '–'}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="hint">No dailies played yet on this profile.</p>'}`;
  const go = $('bDailyGo');
  if (go) go.onclick = () => {
    if (st === 'on') { showPage('play'); resumeRun(loadRun()); return; }
    const start = () => { if (!dailyStart(key)) return renderDaily(); DR.cls = null; showPage('play'); showView('map'); renderMap(); };
    if (saved) askConfirm('Start the daily?', `You have a run in progress (${esc(CLUBS[saved.club].name)}, act ${saved.act + 1}). Starting the daily replaces it.`, 'Start the daily', start);
    else start();
  };
}
(() => {
  const css = document.createElement('style');
  css.textContent = `.daily{border:1px solid var(--seam);border-left:4px solid var(--cc);border-radius:8px;padding:14px 16px;background:var(--stone);display:grid;gap:10px;max-width:720px}
.daily .dhead{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}.daily h3{margin:0}
.daily .ddiff{font-family:var(--hud);font-size:20px;color:var(--torch)}.daily p{margin:0}
.daily .dline{display:flex;gap:14px;flex-wrap:wrap}.daily .dline div{display:flex;gap:8px;align-items:center}
.daily .dline img{width:48px;height:48px;border-radius:6px}.daily .dline span{display:grid}.daily .dline small{color:var(--dim)}
.daily .btn{justify-self:start}`;
  document.head.appendChild(css);
  const rt = renderTitle;
  renderTitle = function () { rt(); const b = $('bDaily'); if (b) { const st = dailyState(dayKey(), loadDaily().days[dayKey()]); b.textContent = st === 'none' ? `Today’s daily: ${dayDate(dayKey()).toLocaleDateString(undefined, { weekday: 'long' })}` : 'The Daily'; } };
  const b = $('bDaily'); if (b) b.onclick = () => showPage('daily');
  const rh = renderHelp;
  renderHelp = function () {
    rh();
    if (window.__SD_REALM || !$('pg-help') || $('helpDaily')) return; // the Realm has its own How to play
    $('pg-help').insertAdjacentHTML('beforeend', `<section id="helpDaily"><h3>The Daily</h3>
      <p class="hint">Once a day there is a daily game, the same for everyone: the same club and three players, the same dungeon, and the same rewards, shops, events and fights, so you can compare how you did. Each day also has a twist, such as more gold, a second trophy or a thinner deck.</p>
      <p class="hint">It gets harder through the week: Rookie on Sunday and Monday, Contender on Tuesday and Wednesday, All-Star on Thursday and Friday, and Hall of Fame on Saturday. A new daily starts at midnight, your time.</p>
      <p class="hint">You get one go. Starting it uses up the day, and a day you miss can’t be played later. You can save and quit and come back to it, as with any run. The Daily tab shows today’s game, your streak of days in a row, and how every daily went.</p></section>`);
  };
  if (UI.screen === 'title') renderTitle();
})();
