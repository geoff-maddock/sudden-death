/* ================= Front office: signings, scouting and position changes between season games ================= */
// Five free agents each week (was three); "Scout" pays for a fresh set. "Retrain" moves a player to a new natural
// position: no more off-position penalty there, but he starts again at level 1 (XP and unspent points are lost)
// and it costs gold, more for higher-level players. Going to the mound teaches three basic pitches.
const SCOUT_COST = 15;
const retrainCost = p => 15 + 10 * Math.max(0, (p.lvl || 1) - 1);
const FO = { p: null, pos: null, confirm: false };
function foScout() {
  if (!S || !S.market || S.gold < SCOUT_COST) return;
  S.gold -= SCOUT_COST;
  const taken = new Set(S.taken || []), lvl = Math.min(7, S.game + 1);
  S.market.agents = S.market.agents.map((ag, i) => ag.signed ? ag : (() => { const pos = i === 0 ? 'P' : pick(POSITIONS.slice(0, 8)); const p = genPlayer(lvl, pos, taken); return { p, price: Math.round(18 + pval(p) * .9) }; })());
  S.taken = [...taken];
  seasonLog(`Paid ${SCOUT_COST}g to scout new free agents.`);
}
function foRetrain(p, pos) {
  if (!S || !p || !pos || p.pos === pos) return false;
  const cost = retrainCost(p); if (S.gold < cost) return false;
  S.gold -= cost;
  const was = p.pos, lvl = p.lvl;
  p.pos = pos; p.lvl = 1; p.xp = 0; p.pts = 0;
  if (pos === 'P' && !p.pitches) p.pitches = ['heater', 'slider', 'change'];
  seasonLog(`${p.n} retrained from ${was} to ${pos} (${cost}g). Back to level 1${lvl > 1 ? ` from ${lvl}` : ''}.`);
  return true;
}
function frontOfficeHTML() {
  const mk = S.market; if (!mk) return '';
  const players = S.players.slice().sort((a, b) => a.n.localeCompare(b.n));
  if (!FO.p || !SP(FO.p)) FO.p = (S.lineup.map(l => SP(l.id)).find(p => { const l = S.lineup.find(x => x.id === p.id); return l && l.pos !== p.pos; }) || players[0]).id;
  const sel = SP(FO.p); if (!FO.pos || FO.pos === sel.pos) { const l = S.lineup.find(x => x.id === sel.id); FO.pos = l && l.pos !== sel.pos ? l.pos : POSITIONS.find(x => x !== sel.pos); }
  const cost = retrainCost(sel);
  return `<section class="card fo"><h4>Front office: retrain a player</h4>
    <p class="sub">Move a player to a new natural position: he loses the off-position penalty there (−2 FLD), but <b>starts again at level 1</b> (his XP and unspent points are gone; his stats and powers stay). Costs 15g, plus 10g per level he gives up.</p>
    <div class="fo-row"><label class="sub">Player<select id="foP">${players.map(p => `<option value="${p.id}" ${p.id === sel.id ? 'selected' : ''}>${esc(p.n)} · ${p.pos} · Lv ${p.lvl}</option>`).join('')}</select></label>
      <label class="sub">New position<select id="foPos">${POSITIONS.filter(x => x !== sel.pos).map(x => `<option ${x === FO.pos ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <button class="buy" data-fo="retrain" ${S.gold < cost ? 'disabled' : ''}>${FO.confirm ? `Confirm: Lv ${sel.lvl} → 1, ${cost}g` : `Retrain · ${cost}g`}</button></div>
    ${sel.lvl > 1 ? `<p class="sub warnt">${esc(sel.n)} is level ${sel.lvl}: retraining throws that away.</p>` : ''}
    ${FO.pos === 'P' && !sel.pitches ? '<p class="sub">He learns a Heater, a Slider and a Changeup.</p>' : ''}
  </section>`;
}
document.addEventListener('change', e => {
  if (e.target.id === 'foP') { FO.p = e.target.value; FO.pos = null; FO.confirm = false; renderClub(); }
  else if (e.target.id === 'foPos') { FO.pos = e.target.value; FO.confirm = false; renderClub(); }
});
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-fo]'); if (!b || b.disabled || !S) return;
  if (b.dataset.fo === 'scout') { foScout(); saveSeason(); renderClub(); return; }
  if (b.dataset.fo === 'retrain') {
    const p = SP(FO.p); if (!p) return;
    if (!FO.confirm) { FO.confirm = true; renderClub(); setTimeout(() => { if (FO.confirm) { FO.confirm = false; if (PAGE === 'season') renderClub(); } }, 4000); return; }
    FO.confirm = false; if (foRetrain(p, FO.pos)) { FO.pos = null; saveSeason(); } renderClub();
  }
});
// the CPU manager retrains a low-level starter who is stuck playing out of position
{ const o = cpuManage; cpuManage = function () {
  const moves = o.apply(this, arguments) || [];
  try {
    if (S && S.active) for (const l of S.lineup) {
      const p = SP(l.id); if (!p || l.pos === p.pos || (l.pos === 'P' && p.pitches) || p.lvl > 2) continue;
      if (S.gold >= retrainCost(p) + 40 && foRetrain(p, l.pos)) moves.push(`retrained ${p.n} as a ${l.pos}`);
    }
    if (moves.length) saveSeason();
  } catch (e) { }
  return moves;
}; }
var FO_READY = true;
try { if (PAGE === 'season') renderClub(); } catch (e) { }
