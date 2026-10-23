/* ================= Settings page: overall defaults + this-game rules ================= */
// Overall settings (SET) persist in localStorage bd-settings and are the defaults for every game.
// Per-game rules live on G.rules while a game runs; before a game starts they are staged in NEXT.
// When a game starts, G.rules = NEXT (or SET), then NEXT resets. Later parts push extra rules into RULE_DEFS.
var RULE_DEFS = [
  { k: 'innings', label: 'Innings', opts: [[3, '3'], [5, '5'], [9, '9']], def: 3, help: 'How long a game runs. Mid-game you can lengthen it, or shorten it to any inning not yet reached.' },
  { k: 'diff', label: 'CPU skill', opts: [[0, 'Squire'], [1, 'Knight'], [2, 'Archmage']], def: 1, help: 'How sharp the CPU is at pitching, swinging, running and spending mana. Season games pick this from the opponent; you can still change it here.' },
  { k: 'auto', label: 'Auto powers', opts: [[false, 'Off'], [true, 'On']], def: false, help: 'Your players cast their spells, skills and magic pitches on their own. T toggles it during a game.' },
  { k: 'injuries', label: 'Injuries and knockouts', opts: [[true, 'On'], [false, 'Off']], def: true, help: 'Fire, gas, hard slides and wild pitches can hurt players or knock them out. Off: nobody gets hurt.' },
];
var PREF_DEFS = [
  { k: 'music', label: 'Music', opts: [[true, 'On'], [false, 'Off']], help: 'The organ and the crowd. M toggles it any time.' },
  { k: 'sound', label: 'Sound effects', opts: [[true, 'On'], [false, 'Off']], help: 'Bat cracks, spell stings and the umpire.' },
  { k: 'hints', label: 'Play help', opts: [[false, 'Off'], [true, 'On']], help: 'Tip cards the first time you run or field, a prompt bar with your next key, and a note when a spell comes into range.' },
  { k: 'cpuSpeed', label: 'CPU vs CPU speed', opts: [[1, '1×'], [2, '2×'], [4, '4×'], [8, '8×']], help: 'The starting speed when you watch CPU games. The speed bar under the field changes it mid-game.' },
];
var SET = {}, NEXT = null;
try { SET = JSON.parse(localStorage.getItem('bd-settings') || 'null') || {}; } catch (e) { SET = {}; }
// carry older separate settings forward the first time
if (SET.innings == null) try { const s = JSON.parse(localStorage.getItem('bd-setup') || 'null'); if (s) { if (s.innings) SET.innings = +s.innings; if (s.diff != null) SET.diff = +s.diff; } } catch (e) { }
if (SET.auto == null) SET.auto = AUTO;
if (SET.sound == null) SET.sound = true;
SND.on = SET.sound !== false;
function saveSettings() { try { localStorage.setItem('bd-settings', JSON.stringify(SET)); } catch (e) { } }
const ruleDef = k => RULE_DEFS.find(d => d.k === k);
function overall(k) { if (SET[k] != null) return SET[k]; const d = ruleDef(k); return d ? d.def : undefined; }
function overallRules() { const o = {}; for (const d of RULE_DEFS) o[d.k] = overall(d.k); return o; }
function nextRules() { if (!NEXT) NEXT = overallRules(); for (const d of RULE_DEFS) if (NEXT[d.k] == null) NEXT[d.k] = overall(d.k); return NEXT; }
const gameLive = () => !!(G.teams && G.phase !== 'menu' && G.phase !== 'over');
// what the game code asks: the rule for the game being played (or the next one)
function rule(k) { const r = G.rules && G.teams ? G.rules : nextRules(); return r[k] != null ? r[k] : overall(k); }
// called by newGame: fix this game's rules and start staging the next game from the overall defaults again
function takeRules(opts) {
  const r = { ...nextRules() };
  if (opts.innings) r.innings = opts.innings;
  if (opts.diff != null) r.diff = opts.diff;
  NEXT = null; return r;
}
function prefGet(k) { if (k === 'music') return MUS.on; if (k === 'sound') return SND.on; if (k === 'hints') return HINTS; if (k === 'cpuSpeed') return SET.cpuSpeed || 1; }
function prefSet(k, v) {
  if (k === 'music') setMusic(v);
  else if (k === 'sound') { SND.on = v; SET.sound = v; saveSettings(); }
  else if (k === 'hints') setHints(v);
  else if (k === 'cpuSpeed') { SET.cpuSpeed = v; saveSettings(); }
}
// change a rule in the game in progress (or the staged next game)
function setGameRule(k, v) {
  if (G.rules && gameLive()) {
    if (k === 'innings') { if (v < G.inning) return; G.innings = v; renderLineScore(); }
    if (k === 'diff') G.diff = v;
    G.rules[k] = v;
    if (k === 'auto') AUTO = v;
    if (k === 'injuries' && (v === 'off' || !v)) for (const t of G.teams) for (const p of [...t.def.roster, ...t.pen]) if (p.ko > 0) { p.ko = 0; p.hp = Math.max(p.hp || 0, 40); }
    logLine(`Rule change for this game: ${ruleText(k, v)}.`);
    if (G.season && typeof seasonLiveSave === 'function') seasonLiveSave();
  } else nextRules()[k] = v;
  renderSetupRules();
}
function setOverallRule(k, v) {
  SET[k] = v; saveSettings();
  if (k === 'auto') { try { localStorage.setItem('bd-auto', v ? 'on' : 'off'); } catch (e) { } if (!gameLive()) AUTO = v; }
  if (!gameLive() && NEXT) NEXT[k] = v; // nothing staged differs yet: keep the next game in step
  renderSetupRules();
}
function ruleText(k, v) { const d = ruleDef(k); if (!d) return ''; const o = d.opts.find(x => x[0] === v); return `${d.label.toLowerCase()} ${o ? o[1].toLowerCase() : v}`; }

/* ---------- the page ---------- */
function segHTML(scope, d, cur, disabled) {
  return `<div class="seg set-seg" role="radiogroup" aria-label="${d.label}">${d.opts.map(([v, l], i) => {
    const id = `set-${scope}-${d.k}-${i}`, off = disabled && disabled(v);
    return `<input type="radio" name="set-${scope}-${d.k}" id="${id}" data-scope="${scope}" data-k="${d.k}" data-v='${JSON.stringify(v)}' ${cur === v ? 'checked' : ''} ${off ? 'disabled' : ''}><label for="${id}" ${off ? 'class="set-off" title="That inning has already been reached"' : ''}>${l}</label>`;
  }).join('')}</div>`;
}
function setRow(scope, d, cur, extra = '', disabled) {
  return `<div class="set-row"><div class="set-lbl"><b>${d.label}</b>${extra}<p>${d.help}</p></div>${segHTML(scope, d, cur, disabled)}</div>`;
}
function renderSettings() {
  const el = document.getElementById('settings'); if (!el) return;
  const live = gameLive() && G.rules, cur = live ? G.rules : nextRules();
  const t = G.teams;
  const where = live ? `${t[0].def.name} at ${t[1].def.name}, ${G.half ? 'bottom' : 'top'} of the ${ORD(G.inning)}${G.season ? ' (season game)' : ''}` : '';
  const diffs = RULE_DEFS.filter(d => cur[d.k] !== overall(d.k)).length;
  el.innerHTML = `
    <h2 class="pgh">Settings</h2>
    <p class="lede2">Overall settings are your defaults for every game. This-game settings change one game only, then go back to your defaults.</p>
    <section class="set-card set-game">
      <div class="set-head"><h3>${live ? 'This game' : 'Next game'}</h3>
        <span class="set-state">${live ? `<span class="set-live">In progress</span> ${where}` : 'Nothing in progress. These apply to the next game you start, then reset.'}</span></div>
      ${RULE_DEFS.map(d => setRow('game', d, cur[d.k], cur[d.k] !== overall(d.k) ? ' <span class="set-diff">differs from overall</span>' : '', live && d.k === 'innings' ? v => v < G.inning : null)).join('')}
      <div class="row set-actions"><button class="buy" type="button" data-set="reset" ${diffs ? '' : 'disabled'}>Use my overall settings</button><button class="buy" type="button" data-set="keep" ${diffs ? '' : 'disabled'}>Make these my overall settings</button>
        ${live ? `<a class="buy" href="#play" data-page="play" style="text-decoration:none">Back to the game</a>` : `<a class="buy" href="#play" data-page="play" style="text-decoration:none">To game setup</a>`}</div>
    </section>
    <section class="set-card">
      <div class="set-head"><h3>Overall</h3><span class="set-state">Saved in this browser. Used by every new game and season.</span></div>
      <h4 class="set-sub">Game rules</h4>
      ${RULE_DEFS.map(d => setRow('all', d, overall(d.k))).join('')}
      <h4 class="set-sub">Sound, help and display</h4>
      ${PREF_DEFS.map(d => setRow('pref', d, prefGet(d.k))).join('')}
      <div class="row set-actions"><button class="buy" type="button" data-set="tips">Show first-time tips again</button><button class="buy" type="button" data-set="defaults">Restore factory settings</button></div>
    </section>`;
}
document.addEventListener('change', e => {
  const i = e.target; if (!i.dataset || !i.dataset.scope || !i.name || !i.name.startsWith('set-')) return;
  const k = i.dataset.k, v = JSON.parse(i.dataset.v);
  if (i.dataset.scope === 'game') setGameRule(k, v);
  else if (i.dataset.scope === 'all') setOverallRule(k, v);
  else prefSet(k, v);
  renderSettings();
  const again = document.getElementById(i.id); if (again) again.focus();
});
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-set]'); if (!b) return;
  const a = b.dataset.set;
  if (a === 'reset') { for (const d of RULE_DEFS) if (rule(d.k) !== overall(d.k)) setGameRule(d.k, overall(d.k)); }
  else if (a === 'keep') { const cur = gameLive() && G.rules ? G.rules : nextRules(); for (const d of RULE_DEFS) setOverallRule(d.k, cur[d.k]); }
  else if (a === 'tips') { try { localStorage.removeItem('bd-tip-run'); localStorage.removeItem('bd-tip-field'); } catch (err) { } setHints(true); }
  else if (a === 'defaults') { for (const d of RULE_DEFS) setOverallRule(d.k, d.def); prefSet('sound', true); setMusic(true); setHints(false); prefSet('cpuSpeed', 1); }
  renderSettings();
});
// the setup card shows the rules the next game will use
function renderSetupRules() {
  const el = document.getElementById('setupRules'); if (!el) return;
  const r = nextRules();
  const bits = RULE_DEFS.map(d => { const o = d.opts.find(x => x[0] === r[d.k]); const v = o ? o[1] : r[d.k]; return d.k === 'innings' ? `${v} innings` : d.k === 'diff' ? `${v} CPU` : `${d.label.toLowerCase()} ${String(v).toLowerCase()}`; });
  el.innerHTML = `<b>Rules:</b> ${bits.join(' · ')} <a href="#settings" data-page="settings">Change</a>`;
}
renderSetupRules();
