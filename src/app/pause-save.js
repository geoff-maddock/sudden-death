/* ---------- pause, and saving a fight to come back to ---------- */
// A fight is saved whole: the hand, the piles, every enemy's HP, statuses and intent, the score, the sky.
// It is only taken when nothing is mid-animation (your turn, nothing resolving), so it always restores cleanly.
const safeToSnap = () => B && !B.over && B.phase === 'player' && !UI.busy && !UI.disc;
function snapBattle() {
  if (!RUN || !safeToSnap()) return false;
  const snap = JSON.parse(JSON.stringify(B, (k, v) => k === 'fx' ? [] : typeof v === 'function' ? undefined : v));
  RUN.battle = snap; saveRun(); return true;
}
function restoreBattle(snap) {
  A.ent = {}; A.pops = []; A.dice = null; A.vfx = []; A.banner = null; A.spops = [];
  UI.sel = -1; UI.busy = false; UI.kbTarget = null; UI.disc = null; sprClear();
  B = JSON.parse(JSON.stringify(snap)); B.fx = [];
  for (const e of B.enemies) if (!e.dead && e.intent) { try { e.plan = planOps(e); } catch (x) { e.plan = null; } }
  const uids = [].concat(B.draw, B.hand, B.discard, B.exhaust || [], B.engulfed || []).map(c => c.uid || 0).concat(B.enemies.map(e => +String(e.uid).replace(/\D/g, '') || 0));
  UID = Math.max(UID, ...uids, ...RUN.deck.map(c => c.uid)) + 1;
  showView('fight');
  B.fx.push({ k: 'banner', t: 'Back in the game', sub: `Turn ${B.turn}, right where you left it`, small: 1 });
  consumeFx(); renderFightHUD(); renderRunBar();
}
// save at the top of every turn, and when the page is closed during your turn
setInterval(() => { if (LAB || UI.view !== 'fight' || !safeToSnap()) return; if (RUN.battle && RUN.battle.turn === B.turn && RUN.battle.cardsThisTurn === B.cardsThisTurn) return; snapBattle(); }, 1000);
window.addEventListener('pagehide', () => { if (!LAB && !window.__switching && RUN && UI.view === 'fight') snapBattle(); });
window.addEventListener('beforeunload', () => { if (!LAB && !window.__switching && RUN && UI.view === 'fight') snapBattle(); });

function openPause() {
  if (!RUN || UI.paused) return;
  UI.paused = true;
  if (SND.ctx && MUS_BUS && MUS.timer) MUS_BUS.gain.setTargetAtTime(SET.mvol * .3, SND.ctx.currentTime, .2);
  const inFight = UI.view === 'fight' && B && !B.over, canSave = !inFight || safeToSnap();
  let el = $('pause'); if (!el) { el = document.createElement('div'); el.id = 'pause'; el.className = 'pause'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'pauseH'); document.body.appendChild(el); }
  const where = inFight ? `Turn ${B.turn} of a ${SPORT_NAME[B.sport].toLowerCase()} game against ${esc(alive().map(e => e.n.split(',')[0]).join(', '))}.` : `Act ${RUN.act + 1}, floor ${RUN.floor + 1}.`;
  el.innerHTML = `<div class="pbox"><h2 id="pauseH">Paused</h2><p class="hint">${where} ${RUN.hp}/${RUN.maxhp} HP, ${RUN.gold} gold.</p>
    <div class="pbtns"><button class="btn" id="pResume">Resume</button>
    <button class="ghost" id="pSave" ${canSave ? '' : 'disabled'}>Save and quit to title</button>
    <button class="ghost" id="pSettings">Settings</button></div>
    <p class="hint" style="font-size:14px">${canSave ? 'Your run is saved in this browser. Continue it from the title screen any time, and a fight picks up on the same turn with the same hand.' : 'Wait for the enemy turn to finish to save mid-fight.'}</p></div>`;
  el.hidden = false; $('pResume').focus();
  $('pResume').onclick = closePause;
  $('pSettings').onclick = () => { el.hidden = true; showSettings(); const back = () => { if (!$('modal').hidden) return setTimeout(back, 200); if (UI.paused) el.hidden = false; }; setTimeout(back, 200); };
  $('pSave').onclick = () => {
    if (inFight && !snapBattle()) return;
    if (!inFight) saveRun();
    closePause(); musicStop(); B = null; RUN = null; UI.view = null; showScreen('title'); renderTitle();
  };
}
function closePause() { UI.paused = false; const el = $('pause'); if (el) el.hidden = true; if (SND.ctx && MUS_BUS && MUS.timer) MUS_BUS.gain.setTargetAtTime(SET.mvol * .9 * MODE_VOL[MUS.mode || 'fight'], SND.ctx.currentTime, .2); }
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape' && ev.key !== 'p' && ev.key !== 'P') return;
  if (ev.target.closest('input,textarea') || !$('modal').hidden) return;
  if (UI.paused) { if (ev.key === 'Escape' || ev.key.toLowerCase() === 'p') { closePause(); ev.preventDefault(); } return; }
  if (!RUN || UI.screen === 'title' || UI.screen === 'end') return;
  if (ev.key === 'Escape' && (UI.sel >= 0 || UI.disc)) return; // Escape first cancels a selected card
  openPause(); ev.preventDefault();
});

