/* ================= Take over a CPU club mid-game, and hand it back ================= */
// In a CPU vs CPU game (a watched exhibition or a CPU season), a bar under the field offers "Take over"
// for either club. You then play that club as Player 1 (the game switches to 1-player rules: no peeking
// at the other side's aim). "Hand back" returns it to the CPU. The choice sticks for the rest of the run:
// later games in a CPU season (or a rematch) start with you in charge until you hand the club back.
var TAKE = null; // { id: club id } while you are in charge
const takeBar = document.createElement('div');
takeBar.id = 'takebar'; takeBar.className = 'takebar'; takeBar.hidden = true;
{ const sb = document.getElementById('speedbar'), row = document.createElement('div'); row.className = 'cpurow'; sb.parentNode.insertBefore(row, sb); row.appendChild(sb); row.appendChild(takeBar); }
function takeOver(i) {
  if (!G.teams || !G.watchRun) return;
  G.teams.forEach((t, j) => { t.ctl = j === i ? 'p1' : 'cpu'; });
  G.mode = '1p'; TAKE = { id: G.teams[i].def.id };
  for (const pl of ['p1', 'p2']) { INP[pl].h = {}; INP[pl].p = {}; }
  const P = G.P;
  if (P && P.stage === 'select' && G.phase === 'plate') { P.si = 0; P.autoPick = false; }
  logLine(`You take over the ${G.teams[i].def.name}.`);
  addFx('callout', { text: `You're managing the ${G.teams[i].def.short}`, col: '#8fe38a' });
  renderTakeBar(true); try { cv.focus({ preventScroll: true }); } catch (e) { }
}
function handBack() {
  if (!G.teams) { TAKE = null; renderTakeBar(true); return; }
  const t = G.teams.find(x => x.ctl !== 'cpu');
  G.teams.forEach(x => { x.ctl = 'cpu'; });
  G.mode = G.watchMode || 'demo'; TAKE = null;
  const P = G.P;
  if (P && G.phase === 'plate' && (P.stage === 'select' || P.stage === 'windup')) { P.cpuT = Math.max(P.cpuT || 0, .5); try { cpuChooseStance(); } catch (e) { } }
  if (t) logLine(`The CPU takes the ${t.def.name} back.`);
  addFx('callout', { text: 'Back to CPU vs CPU', col: '#c9c2ad' });
  renderTakeBar(true);
}
// a new game in the same run: if you were in charge of one of these clubs, you still are
function takeStart() {
  G.watchRun = !!(G.teams && G.teams.every(t => t.ctl === 'cpu'));
  G.watchMode = G.mode;
  if (G.watchRun && TAKE) { const i = G.teams.findIndex(t => t.def.id === TAKE.id); if (i >= 0) { G.teams[i].ctl = 'p1'; G.mode = '1p'; } }
  renderTakeBar(true);
}
let TB_SIG = '';
function renderTakeBar(force) {
  const on = !!(G.teams && G.watchRun && G.phase !== 'menu' && G.phase !== 'over');
  const sig = on ? G.teams.map(t => t.ctl).join() : '';
  if (!force && sig === TB_SIG && takeBar.hidden === !on) return;
  TB_SIG = sig; takeBar.hidden = !on; if (!on) return;
  const hi = G.teams.findIndex(t => t.ctl !== 'cpu');
  takeBar.innerHTML = hi < 0
    ? `<span class="sub">Jump in:</span>${G.teams.map((t, i) => `<button class="tbtn" type="button" data-take="${i}" style="border-bottom:3px solid ${t.def.color}">Take over ${esc(t.def.short)}</button>`).join('')}`
    : `<span class="sub">You're managing the <b style="color:${G.teams[hi].def.color}">${esc(G.teams[hi].def.name)}</b></span><button class="tbtn" type="button" data-take="back">Hand back to the CPU</button>`;
}
takeBar.addEventListener('click', e => {
  const b = e.target.closest('[data-take]'); if (!b) return;
  actx(); if (b.dataset.take === 'back') handBack(); else takeOver(+b.dataset.take);
});
setInterval(() => { try { renderTakeBar(false); } catch (e) { } }, 300);
