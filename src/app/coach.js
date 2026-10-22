/* ---------- coach's notes: one-time tips, shown the first time each system matters ---------- */
const TIPS = {
  fight: ['Your first fight', 'Drag a card onto an enemy, or click a card and then the enemy. Each card costs Stamina (top of the hand). The icon over each enemy is what it will do next turn. When you are out of moves, End Turn.'],
  sport: ['Every fight is also a game', 'The scoreboard shows this fight’s sport. Its rule, shown on the scoreboard, changes what your cards do; the full rules for all nine sports are on the How to play page. Win the fight and the game for a sports win: bonus gold, style and a Highlight Reel.'],
  why: ['Why a hit does what it does', 'When you hover or select an attack, the bar at the bottom of the arena breaks its first hit down: base damage, then every bonus and multiplier that applies right now.'],
  momentum: ['Momentum', 'The bar under the scoreboard is a tug of war. Lead by enough and your hits land harder; fall behind and theirs do, until you are far enough behind that you draw an extra card each turn.'],
  sky: ['The sky moved', 'The skylights in the arena wall show the moon and two constellations. They shift as you play and give small boosts to certain kinds. Hover the moon and stars in the top bar for what is up now.'],
  map: ['The map', 'Pick a room on the next row. Hover a room to see everywhere it leads. Elites drop trophies, locker rooms heal or upgrade, and the boss waits at the top.'],
  elite: ['An elite', 'Elites hit harder and start stronger, but they always drop a trophy. Worth it when your HP can take it.'],
  boss: ['A boss', 'Bosses change as they lose health: watch for the phase banner. Their intents can depend on what you did last turn, so the icon over them is worth reading every turn.'],
};
const TIPS_SEEN = (() => { try { return JSON.parse(localStorage.getItem(pkey('sd-tips')) || '[]'); } catch (e) { return []; } })();
if (SET.tips == null) SET.tips = true;
const tipQ = [];
function tip(id) {
  if (LAB || !SET.tips || TIPS_SEEN.includes(id) || tipQ.includes(id)) return;
  tipQ.push(id); if (tipQ.length === 1) showCoach();
}
function showCoach() {
  const id = tipQ[0]; if (!id) return;
  let el = $('coach'); if (!el) { el = document.createElement('aside'); el.id = 'coach'; el.className = 'coach'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  const [t, body] = TIPS[id];
  el.innerHTML = `<b>Coach’s note: ${esc(t)}</b><p>${esc(body)}</p><div class="row"><button class="btn" id="cOk">Got it</button><button class="ghost" id="cOff">No more tips</button></div>`;
  el.hidden = false;
  const done = () => { TIPS_SEEN.push(id); try { localStorage.setItem(pkey('sd-tips'), JSON.stringify(TIPS_SEEN)); } catch (e) { } tipQ.shift(); el.hidden = true; if (tipQ.length) setTimeout(showCoach, 400); };
  $('cOk').onclick = done;
  $('cOff').onclick = () => { SET.tips = false; saveSettings(); tipQ.length = 0; el.hidden = true; };
}
// hooks: watch the game rather than threading tip calls through the engine
setInterval(() => {
  if (LAB || !SET.tips || !RUN) return;
  if (UI.view === 'map') tip('map');
  if (UI.view === 'fight' && B && !B.over) {
    tip('fight'); if (B.turn >= 2) tip('sport');
    if (UI.why) tip('why');
    if (B.sc && B.sc.tier) tip('momentum');
    if (A.skyT) tip('sky');
    if (B.type === 'elite') tip('elite');
    if (B.type === 'boss') tip('boss');
  }
}, 700);

