/* ================= Phone panel: a readable, tappable version of the plate HUD under the field ================= */
// Only on narrow portrait screens. It mirrors the count and the matchup and lists the human side's
// stances or pitches as big buttons (a tap = pressing that number key), plus lead / steal / throw-over.
const MP_Q = window.matchMedia ? window.matchMedia('(max-width:700px) and (orientation:portrait)') : { matches: false };
const mpEl = document.createElement('section');
mpEl.id = 'mpanel'; mpEl.className = 'mpanel'; mpEl.hidden = true; mpEl.setAttribute('aria-label', 'At-bat controls');
{ const st = document.getElementById('stage'); st.parentNode.insertBefore(mpEl, st.nextSibling); const tp = document.getElementById('touch'); if (tp) mpEl.parentNode.insertBefore(tp, mpEl.nextSibling); }
let MP_SIG = '';
function mpDiamonds(n) { return n ? `<span class="mp-mana">${'◆'.repeat(n)}</span>` : ''; }
function mpRender() {
  const P = G.P, show = MP_Q.matches && G.teams && G.phase === 'plate' && P && PAGE === 'play' && !G.paused;
  if (!show) { if (!mpEl.hidden) { mpEl.hidden = true; MP_SIG = ''; } return; }
  const bt = BT(), ft = FT(), bat = batter(), pt = pitcher();
  const hb = isHuman(bt) ? bt.ctl : null, hp = isHuman(ft) ? ft.ctl : null;
  const pre = P.stage === 'select' || P.stage === 'windup';
  const S0 = G.run, runners = [1, 2, 3].filter(b => G.bases[b]);
  const sig = [G.inning, G.half, G.outs, G.balls, G.strikes, P.stage, P.si, P.pi, bt.mana, ft.mana, bat.n, pt.n, runners.join(''), S0 ? S0.lead.join('') + S0.steal : '', hb, hp, G.abN].join('|');
  if (sig === MP_SIG && !mpEl.hidden) return;
  MP_SIG = sig; mpEl.hidden = false;
  const bases = [1, 2, 3].map(b => `<i class="mp-base ${G.bases[b] ? 'on' : ''}" title="${['', 'first', 'second', 'third'][b]}"></i>`).join('');
  let opts = '', title = '';
  if (hb) {
    title = `Your batter · ${pre ? 'pick a stance' : 'swing!'}`;
    opts = P.stances.map((s, i) => `<button class="mp-opt ${i === P.si ? 'on' : ''}" data-mp="num" data-a="${i}" data-c="${hb}" ${!affordable(s, bt) || P.stage === 'flight' ? 'disabled' : ''}><span>${esc(s.name)}</span>${s.cost ? mpDiamonds(s.cost) : s.stam ? `<span class="mp-stam">⚡${s.stam}</span>` : ''}</button>`).join('');
  } else if (hp) {
    title = `Your pitcher · ${P.stage === 'select' ? 'pick a pitch' : 'pitching'}`;
    opts = P.pitches.map((p, i) => `<button class="mp-opt ${i === P.pi ? 'on' : ''} ${p.magic ? 'mg' : ''}" data-mp="num" data-a="${i}" data-c="${hp}" ${!affordable(p, ft) || P.stage !== 'select' ? 'disabled' : ''}><span>${esc(p.name)}</span>${mpDiamonds(p.cost)}</button>`).join('');
  }
  let extra = '';
  if (typeof stealOn === 'function' && stealOn() && runners.length && S0) {
    if (hb && pre) extra = `<button class="mp-x" data-mp="abil" data-c="${hb}">Lead: ${LEAD_TXT[Math.max(...runners.map(b => S0.lead[b] | 0))]}</button><button class="mp-x ${S0.steal ? 'on' : ''}" data-mp="back" data-c="${hb}">${S0.steal === 2 ? 'Magic steal' : S0.steal ? 'Stealing' : 'Steal'}</button>`;
    if (hp && P.stage === 'select') extra = `<button class="mp-x" data-mp="abil" data-c="${hp}">Throw over (${Math.max(0, 4 - S0.picks)} left)</button>`;
  }
  if (hp && P.stage === 'select' && ft.pen.length) extra += `<button class="mp-x" data-mp="pen" data-c="${hp}">Bullpen (${ft.pen.length})</button>`;
  mpEl.innerHTML = `
    <div class="mp-top"><div class="mp-bases">${bases}</div>
      <div class="mp-count"><b>${G.half ? 'BOT' : 'TOP'} ${G.inning}</b> · ${G.balls}-${G.strikes} · ${G.outs} out${G.outs === 1 ? '' : 's'}</div>
      <div class="mp-score"><span style="color:${G.teams[0].def.color}">${esc(G.teams[0].def.short)} ${G.teams[0].R}</span> <span style="color:${G.teams[1].def.color}">${esc(G.teams[1].def.short)} ${G.teams[1].R}</span></div></div>
    <div class="mp-match"><span><em>AT BAT</em> ${esc(bat.n)} <small>${esc(bat.race)} · POW ${bat.pow} CON ${bat.con} SPD ${bat.spd}</small></span><span><em>PITCHING</em> ${esc(pt.n)} <small>${pt.hand}HP · ${Math.round(fatigue(pt) * 100)}% stamina</small></span></div>
    ${typeof skyOn === 'function' && MOON && skyOn() ? `<div class="mp-mana-row"><span>☾ ${MOON[moonIdx()]}</span><span>✦ ${STARS_C[starIdx()].name}: ${STARS_C[starIdx()].say}</span></div>` : ''}
    <div class="mp-mana-row"><span>${esc(bt.def.short)} mana ${mpDiamonds(bt.mana) || '—'}</span><span>${esc(ft.def.short)} mana ${mpDiamonds(ft.mana) || '—'}</span></div>
    ${opts ? `<p class="mp-title">${title}</p><div class="mp-opts">${opts}</div>` : `<p class="mp-title">CPU vs CPU</p>`}
    ${extra ? `<div class="mp-extra">${extra}</div>` : ''}`;
}
mpEl.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-mp]'); if (!b || b.disabled) return;
  e.preventDefault(); actx();
  const pl = b.dataset.c, k = b.dataset.mp; if (!INP[pl]) return;
  if (k === 'num') INP[pl].p.num = +b.dataset.a;
  else { press(pl, k); setTimeout(() => keyRelease(pl, k), 80); }
  MP_SIG = '';
});
setInterval(() => { try { mpRender(); } catch (e) { } }, 120);

// phones held sideways: bring the field to the top of the screen when a game is on
const LAND_Q = window.matchMedia ? window.matchMedia('(max-height:500px) and (orientation:landscape)') : { matches: false };
let LAND_LIVE = false;
function landFit() {
  const live = !!(G.teams && G.phase !== 'menu' && G.phase !== 'over' && PAGE === 'play');
  if (live && LAND_Q.matches && !LAND_LIVE) { const st = document.getElementById('stage'); if (st) st.scrollIntoView({ block: 'start' }); }
  LAND_LIVE = live && LAND_Q.matches;
}
setInterval(() => { try { landFit(); } catch (e) { } }, 400);
window.addEventListener('orientationchange', () => { LAND_LIVE = false; setTimeout(landFit, 300); });
try { renderReadout(); } catch (e) { }
try { renderLog(); } catch (e) { }
