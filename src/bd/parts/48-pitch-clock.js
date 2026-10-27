/* ================= Pitch clock (rule: off, 30 s, 20 s, 10 s, 5 s) ================= */
// The pitcher has this long, from the moment he can pick a pitch, to start his windup. Run out and it's an
// automatic ball (ball four walks the batter). A throw-over to a base resets the clock. It counts game time,
// so pausing stops it, and it only runs while a pitch is being picked.
RULE_DEFS.push({ k: 'clock', label: 'Pitch clock', opts: [[0, 'Off'], [30, '30 s'], [20, '20 s'], [10, '10 s'], [5, '5 s']], def: 0, help: 'The pitcher must start his windup within this time, or it is an automatic ball (ball four walks the batter). A throw-over resets the clock. Pausing stops it.' });
const clockLimit = () => +rule('clock') || 0;
function clockViolation() {
  const P = G.P, pt = pitcher(); P.clk = 0;
  G.balls++; sfx.ump();
  addFx('callout', { text: 'Pitch clock: automatic ball', col: '#ff8a5a' });
  if (G.balls >= 4) { logLine(`Pitch clock violation: ${pt.n} runs out of time. Ball four.`); showResult('Clock violation', 'ball four · take your base', 1.2, 'BB'); }
  else { logLine(`Pitch clock violation: ${pt.n} runs out of time. Automatic ball (${G.balls}-${G.strikes}).`); showResult('Clock violation', `automatic ball · ${G.balls}-${G.strikes}`, 1.1); }
  (G.abPitches = G.abPitches || []).push({ n: G.abPitches.length + 1, pitch: 'Pitch clock', big: 'Automatic ball' });
}
{ const o = plateUpdate; plateUpdate = function (dt) {
  const P = G.P, lim = clockLimit();
  if (lim && P && P.stage === 'select' && !(P.intro > 0) && !G.tutorial) { P.clk = (P.clk || 0) + dt; if (P.clk >= lim) { clockViolation(); return; } }
  return o.apply(this, arguments);
}; }
{ const o = startPickoff; startPickoff = function () { const r = o.apply(this, arguments); if (G.P && G.P.stage === 'pickoff') G.P.clk = 0; return r; }; }
// the clock, under the scoreboard: amber, then red and pulsing near the end (earlier cut-offs on short clocks)
function drawPitchClock(c) {
  const P = G.P, lim = clockLimit(); if (!lim || !P || G.phase !== 'plate' || !(P.stage === 'select' || P.stage === 'windup')) return;
  const left = P.stage === 'windup' ? lim - (P.clk || 0) : Math.max(0, lim - (P.clk || 0)), s = Math.ceil(left);
  const red = lim <= 5 ? 2 : 5, amber = lim <= 5 ? 3 : lim <= 10 ? 7 : 10;
  const col = s <= red ? '#ff6a5a' : s <= amber ? '#ffd34a' : COL.bone, y = AUTO && G.teams.some(isHuman) ? 122 : 98;
  c.save(); c.font = F_HUD(17); const lbl = `PITCH CLOCK ${s}`, tw = c.measureText(lbl).width + 34;
  rr(c, 10, y, tw, 22, 11); c.fillStyle = 'rgba(8,10,12,.82)'; c.fill(); c.strokeStyle = s <= red ? `rgba(255,106,90,${.5 + .4 * Math.sin(G.time * 12)})` : 'rgba(239,230,207,.25)'; c.lineWidth = 1.5; c.stroke();
  const k = clamp(left / lim, 0, 1); c.beginPath(); c.arc(22, y + 11, 6, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); c.strokeStyle = col; c.lineWidth = 2.5; c.stroke();
  txt(c, lbl, 32, y + 16, F_HUD(17), col); c.restore();
}
{ const o = drawPlateHud; drawPlateHud = function (c) { o.apply(this, arguments); try { drawPitchClock(c); } catch (e) { } }; }
// the phone panel shows it in the count line
{ const o = mpRender; mpRender = function () { o.apply(this, arguments); try { const lim = clockLimit(), P = G.P, el = mpEl.querySelector('.mp-count'); if (!el || !lim || !P || P.stage !== 'select') return; let t = el.querySelector('.mp-clock'); if (!t) { t = document.createElement('span'); t.className = 'mp-clock'; el.appendChild(t); } const s = Math.ceil(Math.max(0, lim - (P.clk || 0))); t.textContent = ` · ⏱ ${s}`; t.style.color = s <= (lim <= 5 ? 2 : 5) ? '#ff6a5a' : s <= (lim <= 5 ? 3 : lim <= 10 ? 7 : 10) ? '#ffd34a' : ''; } catch (e) { } }; }
try { const b = document.getElementById('bTips'); if (b) b.closest('p').insertAdjacentHTML('afterend', '<p class="hint"><b>Pitch clock</b> (off by default; 30, 20, 10 or 5 seconds in <a href="#settings" data-page="settings">Settings</a>): the pitcher must start his windup in time or it is an automatic ball. A throw-over resets it. The clock shows under the scoreboard.</p>'); } catch (e) { }
try { renderSetupRules(); if (PAGE === 'settings') renderSettings(); } catch (e) { }
