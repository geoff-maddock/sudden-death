/* ================= team builder: build your own club on a points budget ================= */
// The two founding clubs cost about 530 points each by this scale, so a custom club gets the same.
const BUDGET = 530;
const STATS5 = ['pow', 'con', 'spd', 'arm', 'fld'];
const POS9 = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P'];
const statCost = v => v <= 5 ? v : 5 + (v - 5) * 2;
const abPts = id => !id || !AB[id] ? 0 : AB[id].passive ? 5 : 3 + 3 * AB[id].cost;
const ULT_PTS = 8;
const pitchPts = k => PITCHES[k] && PITCHES[k].magic ? 4 + 3 * PITCHES[k].cost : 0;
const abList = type => Object.keys(AB).filter(k => AB[k].type === type);
const PITCH_LIST = Object.keys(PITCHES).filter(k => !PITCHES[k].ult);
const WPNS = ['bat', 'axe', 'log', 'tree', 'hammer', 'pillar', 'spiked', 'scythe', 'staff', 'tomb', 'bone', 'broom', 'cane'];
function playerPts(p) {
  let c = STATS5.reduce((a, s) => a + statCost(p[s]), 0) + abPts(p.bat) + abPts(p.run) + abPts(p.field) + (p.ult ? ULT_PTS : 0);
  if (p.pos === 'P' && p.pitches) c += p.pitches.reduce((a, k) => a + pitchPts(k), 0);
  return c;
}
const teamPts = t => t.roster.reduce((a, p) => a + playerPts(p), 0);

/* ---------- saving ---------- */
try { CUSTOM = JSON.parse(localStorage.getItem('bd-teams') || '[]') || []; } catch (e) { CUSTOM = []; }
function saveCustom(cloud = true) {
  try { localStorage.setItem('bd-teams', JSON.stringify(CUSTOM)); } catch (e) { }
  if (cloud && Cloud.ready) Cloud.db.doc(`data/users/${Cloud.uid}/teams`).set({ teams: CUSTOM, savedAt: Date.now() }).catch(() => { });
}
async function teamsCloudSync() {
  if (!Cloud.ready) return;
  try {
    const snap = await Cloud.db.doc(`data/users/${Cloud.uid}/teams`).get();
    const cloud = snap.exists && snap.data() && Array.isArray(snap.data().teams) ? snap.data().teams : [];
    const by = new Map(); for (const t of [...cloud, ...CUSTOM]) { const o = by.get(t.id); if (!o || (t.updated || 0) > (o.updated || 0)) by.set(t.id, t); }
    const merged = [...by.values()]; const changed = JSON.stringify(merged) !== JSON.stringify(CUSTOM);
    CUSTOM = merged; if (changed) { saveCustom(true); renderTeamPickers(); renderBestiary(); if (PAGE === 'builder') renderBuilder(); }
  } catch (e) { }
}

/* ---------- random players and teams that fit the budget ---------- */
function fitPlayer(p, share) {
  for (let g = 0; g < 80 && playerPts(p) > share; g++) {
    const abs = ['bat', 'run', 'field'].filter(k => p[k]), magic = p.pos === 'P' && p.pitches ? p.pitches.filter(k => PITCHES[k].magic) : [];
    if ((abs.length || magic.length) && R() < .35) {
      if (magic.length && (R() < .5 || !abs.length)) p.pitches.splice(p.pitches.indexOf(pick(magic)), 1); else p[pick(abs)] = null;
    } else if (p.ult && R() < .08) p.ult = null;
    else { const s = STATS5.slice().sort((a, b) => p[b] - p[a])[R() < .7 ? 0 : 1]; if (p[s] > 1) p[s]--; }
  }
  return p;
}
function randomPlayer(pos, taken, share) {
  const kind = pick(KINDS), T = TEMPL[kind];
  const p = { n: genName(taken), kind, race: T.race, pos, num: (R() * 99) | 0, hand: R() < .6 ? 'R' : 'L', wpn: T.wpn, flav: pick(FLAVS), bat: null, run: null, field: null, ult: ULT_BY_KIND[kind] || null, pitches: null };
  for (const s of STATS5) p[s] = clamp(Math.round(T[s] + (R() * 4 - 2)), 1, 10);
  const roll = (key, list) => { const r = R(); p[key] = r < .5 ? (T[key] || (R() < .4 ? pick(list) : null)) : r < .7 ? pick(list) : null; };
  roll('bat', abList('bat')); roll('run', abList('run')); roll('field', abList('field'));
  if (p.ult && ULT[p.ult].role === 'pitch' && pos !== 'P') p.ult = pick(Object.keys(ULT).filter(k => ULT[k].role !== 'pitch'));
  if (pos === 'P') {
    p.arm = clamp(p.arm + 1, 1, 10);
    p.pitches = T.pitches ? T.pitches.slice() : [pick(['heater', 'fastball']), pick(['slider', 'curve']), 'change', ...(R() < .6 ? [pick(MAGIC_PITCHES)] : [])];
  }
  return fitPlayer(p, share);
}
function randomTeam() {
  const taken = new Set(), [color, light] = pick(CLUB_COLORS), name = `${pick(CLUB_PLACES)} ${pick(CLUB_NAMES)}`;
  const roster = POS9.map(pos => randomPlayer(pos, taken, BUDGET / 9 * (.85 + R() * .35)));
  const t = { id: null, name, short: name.split(' ').slice(-1)[0].slice(0, 3).toUpperCase(), color, light, motto: pick(MOTTOS), roster: [] };
  const bats = roster.filter(p => p.pos !== 'P').sort((a, b) => (b.spd + b.con) - (a.spd + a.con));
  t.roster = [...bats.slice(0, 2), ...bats.slice(2).sort((a, b) => b.pow - a.pow), roster.find(p => p.pos === 'P')];
  for (let g = 0; g < 200 && teamPts(t) > BUDGET; g++) { const p = t.roster.slice().sort((a, b) => playerPts(b) - playerPts(a))[R() < .6 ? 0 : 1]; fitPlayer(p, playerPts(p) - 3); }
  return t;
}

/* ---------- validation ---------- */
function teamProblems(t) {
  const out = [];
  if (!t.name.trim()) out.push('Give the club a name.');
  if (!/^[A-Za-z0-9]{2,3}$/.test(t.short)) out.push('The short name needs 2 or 3 letters.');
  const pos = t.roster.map(p => p.pos);
  for (const p of POS9) if (!pos.includes(p)) out.push(`Nobody is playing ${p}.`);
  const dup = [...new Set(pos.filter((p, i) => pos.indexOf(p) !== i))]; if (dup.length) out.push(`Two players are set at ${dup.join(', ')}.`);
  const P = t.roster.find(p => p.pos === 'P');
  if (P) { const pt = P.pitches || []; if (pt.length < 3 || pt.filter(k => !PITCHES[k].magic).length < 2) out.push(`${P.n || 'The pitcher'} needs at least 3 pitches, 2 of them ordinary.`); }
  if (t.roster.some(p => !p.n.trim())) out.push('Every player needs a name.');
  const pts = teamPts(t); if (pts > BUDGET) out.push(`Over budget by ${pts - BUDGET} points.`);
  return out;
}

/* ---------- the builder page ---------- */
const BD = { draft: null, confirmDel: false, msg: '' };
const cloneTeam = t => JSON.parse(JSON.stringify(t));
function draftLook() { const d = BD.draft; return { id: 'draft' + d.color + d.light, color: d.color, light: d.light, short: d.short || '?', trim: '#141014' }; }
function renderBuilder() {
  const el = document.getElementById('builder'); if (!el) return;
  const list = CUSTOM.map(t => `<button class="buy bl-pick${BD.draft && BD.draft.id === t.id ? ' on' : ''}" data-b="edit" data-a="${t.id}" style="border-bottom:3px solid ${t.color}">${esc(t.name)} <span class="sub">${teamPts(t)} pts</span></button>`).join('');
  let html = `<h2 class="pgh">Team builder</h2>
    <p class="lede2">Build your own club from any of the eighteen creature types. Every club gets <b>${BUDGET} points</b> to spend on stats, powers, ultimates and magic pitches, the same as the two founding clubs. Your clubs can then be picked on the Play page, as your team or as the opponent, and can start a Season run.</p>
    <div class="bl-teams">${list}<button class="go small" data-b="new">New club</button><button class="ghost" data-b="random">Random club</button></div>`;
  const d = BD.draft;
  if (!d) {
    html += `<div class="card" style="margin-top:16px"><p class="sub">${CUSTOM.length ? 'Pick one of your clubs to edit, or start a new one.' : 'You have no clubs yet. <b>New club</b> starts from a random roster that fits the budget, and you tune it from there.'}</p>
      <p class="sub"><b>Costs:</b> stats cost 1 point each up to 5, then 2 points each for 6 to 10 (so a 10 costs 15). A power costs 3 + 3 per mana it uses (a passive one 5). An ultimate costs ${ULT_PTS}. Magic pitches cost 4 + 3 per mana; ordinary pitches are free. For reference, Ironmaw costs ${teamPts(TEAMS.ironmaw)} and Mirewood ${teamPts(TEAMS.mirewood)}.</p>
      <p class="sub"><b>Weak spots:</b> any stat of 3 or less causes real trouble in games: ${STATS5.map(s => `<b>${s.toUpperCase()}</b> ${esc(WEAK_TXT[s].split(':')[0].toLowerCase())}`).join(', ')}. The lower the number, the worse it gets.</p></div>`;
    el.innerHTML = html; return;
  }
  const pts = teamPts(d), probs = teamProblems(d), look = draftLook();
  html += `<section class="card bl-head">
    <div class="bl-fields">
      <label>Club name<input type="text" data-t="name" value="${esc(d.name)}" maxlength="28"></label>
      <label>Short<input type="text" data-t="short" value="${esc(d.short)}" maxlength="3" style="width:64px;text-transform:uppercase"></label>
      <label>Colours<span class="row" style="gap:6px"><input type="color" data-t="color" value="${d.color}"><input type="color" data-t="light" value="${d.light}"></span></label>
      <label style="flex:1 1 260px">Motto<input type="text" data-t="motto" value="${esc(d.motto || '')}" maxlength="70"></label>
    </div>
    <div class="bl-budget"><div class="bl-meter"><i style="width:${Math.min(100, pts / BUDGET * 100)}%;background:${pts > BUDGET ? '#ff6a5a' : 'var(--torch)'}"></i></div><b class="${pts > BUDGET ? 'ltxt' : ''}">${pts} / ${BUDGET} points</b><span class="sub">${pts <= BUDGET ? BUDGET - pts + ' left' : 'over budget'}</span></div>
    ${probs.length ? `<p class="warnt">${probs.map(esc).join(' ')}</p>` : ''}
    <div class="row">
      <button class="go small" data-b="save" ${probs.length ? 'disabled' : ''}>Save club</button>
      <button class="buy" data-b="play" ${probs.length ? 'disabled' : ''}>Save and play</button>
      <button class="buy" data-b="rollall">Randomize every player</button>
      ${d.id ? `<button class="buy" data-b="revert">Undo changes</button><button class="buy" data-b="del">${BD.confirmDel ? 'Click again to delete' : 'Delete club'}</button>` : ''}
      <span class="sub" aria-live="polite">${esc(BD.msg || '')}</span>
    </div>
  </section>
  <div class="bl-grid">${d.roster.map((p, i) => playerCard(p, i, look)).join('')}</div>`;
  el.innerHTML = html;
}
function playerCard(p, i, look) {
  const opt = (list, cur, label) => `<option value="">(none)</option>` + list.map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(label(k))}</option>`).join('');
  const abLabel = k => `${AB[k].name} ${AB[k].passive ? '(passive)' : '◆'.repeat(AB[k].cost)} · ${abPts(k)} pts`;
  const stats = STATS5.map(s => `<div class="bl-stat${p[s] <= 3 ? ' weak' : ''}"${p[s] <= 3 ? ` title="${esc(WEAK_TXT[s])}"` : ''}><span>${s.toUpperCase()}</span><button class="ic" data-b="dec" data-i="${i}" data-s="${s}" aria-label="Lower ${s}">−</button><b>${p[s]}</b><button class="ic" data-b="inc" data-i="${i}" data-s="${s}" aria-label="Raise ${s}">+</button><em>${statCost(p[s])}</em></div>`).join('');
  const weak = STATS5.filter(s => p[s] <= 3);
  const pitches = p.pos === 'P' ? `<div class="bl-pitches"><span class="ty">PITCHES</span>${PITCH_LIST.map(k => `<label><input type="checkbox" data-f="pitch" data-i="${i}" data-k="${k}" ${p.pitches && p.pitches.includes(k) ? 'checked' : ''}> ${esc(PITCHES[k].name)}${PITCHES[k].magic ? ` <span class="mn">${'◆'.repeat(PITCHES[k].cost)}</span> ${pitchPts(k)}` : ''}</label>`).join('')}</div>` : '';
  const u = p.ult && ULT[p.ult];
  return `<article class="card bl-card">
    <header><img class="por" alt="" src="${portraitURL(p, look)}" width="56" height="56">
      <div class="bl-id"><input type="text" data-f="n" data-i="${i}" value="${esc(p.n)}" maxlength="18" aria-label="Name">
        <select data-f="kind" data-i="${i}" aria-label="Creature">${KINDS.map(k => `<option value="${k}" ${k === p.kind ? 'selected' : ''}>${esc(TEMPL[k].race)}</option>`).join('')}</select></div>
      <div class="bl-ord"><button class="ic" data-b="up" data-i="${i}" aria-label="Bat earlier">▲</button><b>${i + 1}</b><button class="ic" data-b="down" data-i="${i}" aria-label="Bat later">▼</button></div></header>
    <div class="bl-row">
      <label>Pos<select data-f="pos" data-i="${i}">${POS9.map(x => `<option ${x === p.pos ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label>#<input type="number" min="0" max="99" data-f="num" data-i="${i}" value="${p.num}" style="width:56px"></label>
      <label>Bats<select data-f="hand" data-i="${i}"><option value="R" ${p.hand === 'R' ? 'selected' : ''}>R</option><option value="L" ${p.hand === 'L' ? 'selected' : ''}>L</option></select></label>
      <label>Weapon<select data-f="wpn" data-i="${i}">${WPNS.map(w => `<option ${w === p.wpn ? 'selected' : ''}>${w}</option>`).join('')}</select></label>
    </div>
    <div class="bl-stats">${stats}</div>
    <div class="bl-abs">
      <label><span class="ty">BAT</span><select data-f="bat" data-i="${i}">${opt(abList('bat'), p.bat, abLabel)}</select></label>
      <label><span class="ty">RUN</span><select data-f="run" data-i="${i}">${opt(abList('run'), p.run, abLabel)}</select></label>
      <label><span class="ty">FIELD</span><select data-f="field" data-i="${i}">${opt(abList('field'), p.field, abLabel)}</select></label>
      <label><span class="ty">ULT</span><select data-f="ult" data-i="${i}">${opt(Object.keys(ULT), p.ult, k => `${AB[k].name} (${{ bat: 'batting', pitch: 'pitch', run: 'running', field: 'fielding' }[ULT[k].role]}) · ${ULT_PTS} pts`)}</select></label>
    </div>
    ${u && u.role === 'pitch' && p.pos !== 'P' ? `<p class="warnt">${esc(u.name)} is a pitch: it only works for your pitcher.</p>` : ''}
    ${pitches}
    ${weak.length ? `<p class="bl-weak">${weak.map(s => `<b>${s.toUpperCase()} ${p[s]}</b> ${esc(WEAK_TXT[s])}`).join('<br>')}</p>` : ''}
    <footer class="row"><b class="bl-pts">${playerPts(p)} pts</b><button class="buy" data-b="rollp" data-i="${i}">Randomize</button></footer>
  </article>`;
}
function setField(p, f, v, el) {
  if (f === 'kind') { const T = TEMPL[v], wasDefUlt = p.ult === ULT_BY_KIND[p.kind]; p.kind = v; p.race = T.race; p.wpn = T.wpn; if (wasDefUlt || !p.ult) p.ult = ULT_BY_KIND[v] || null; }
  else if (f === 'num') p.num = clamp(parseInt(v, 10) || 0, 0, 99);
  else if (f === 'pos') { const other = BD.draft.roster.find(x => x !== p && x.pos === v); if (other) other.pos = p.pos; p.pos = v; for (const q of BD.draft.roster) { if (q.pos === 'P' && !q.pitches) q.pitches = (TEMPL[q.kind].pitches || ['fastball', 'slider', 'change']).slice(); } }
  else if (f === 'pitch') { const k = el.dataset.k; p.pitches = p.pitches || []; if (el.checked) { if (!p.pitches.includes(k)) p.pitches.push(k); } else p.pitches = p.pitches.filter(x => x !== k); }
  else if (f === 'n') p.n = v.slice(0, 18);
  else p[f] = v || null;
}
document.addEventListener('input', e => {
  const t = e.target; if (!BD.draft || !t.closest || !t.closest('#builder')) return;
  if (t.dataset.t && t.type === 'text') { BD.draft[t.dataset.t] = t.dataset.t === 'short' ? t.value.toUpperCase() : t.value; return; }
  if (t.dataset.f === 'n') { BD.draft.roster[+t.dataset.i].n = t.value.slice(0, 18); }
});
document.addEventListener('change', e => {
  const t = e.target; if (!BD.draft || !t.closest || !t.closest('#builder')) return;
  if (t.dataset.t) { BD.draft[t.dataset.t] = t.dataset.t === 'short' ? t.value.toUpperCase() : t.value; BD.msg = ''; renderBuilder(); return; }
  if (t.dataset.f) { setField(BD.draft.roster[+t.dataset.i], t.dataset.f, t.value, t); BD.msg = ''; renderBuilder(); }
});
function startDraft(t) { BD.draft = t; BD.confirmDel = false; BD.msg = ''; renderBuilder(); }
function saveDraft() {
  const d = BD.draft; if (!d || teamProblems(d).length) return false;
  if (!d.id) d.id = 'c_' + uid();
  Object.assign(d, { custom: true, css: 'cust', trim: '#141014', updated: Date.now() });
  d.short = d.short.toUpperCase();
  for (const p of d.roster) { p.ck = customCK(d, p); p.race = TEMPL[p.kind].race; if (p.pos !== 'P' && p.pitches) p.pitches = null; }
  const i = CUSTOM.findIndex(t => t.id === d.id); if (i >= 0) CUSTOM[i] = cloneTeam(d); else CUSTOM.push(cloneTeam(d));
  saveCustom(); for (const k in PORT_CACHE) if (k.startsWith(d.id)) delete PORT_CACHE[k];
  renderTeamPickers(); renderBestiary(); BD.msg = 'Saved.';
  return true;
}
document.addEventListener('click', e => {
  const ed = e.target.closest && e.target.closest('[data-edit]');
  if (ed) { const t = CUSTOM.find(x => x.id === ed.dataset.edit); if (t) setTimeout(() => startDraft(cloneTeam(t)), 0); return; }
  const b = e.target.closest && e.target.closest('#builder [data-b]'); if (!b || b.disabled) return;
  const act = b.dataset.b, d = BD.draft, i = +b.dataset.i;
  if (act === 'new') return startDraft(randomTeam());
  if (act === 'random') return startDraft(randomTeam());
  if (act === 'edit') return startDraft(cloneTeam(CUSTOM.find(t => t.id === b.dataset.a)));
  if (!d) return;
  if (act === 'inc' || act === 'dec') { const p = d.roster[i], s = b.dataset.s; p[s] = clamp(p[s] + (act === 'inc' ? 1 : -1), 1, 10); }
  else if (act === 'up' && i > 0) [d.roster[i - 1], d.roster[i]] = [d.roster[i], d.roster[i - 1]];
  else if (act === 'down' && i < 8) [d.roster[i + 1], d.roster[i]] = [d.roster[i], d.roster[i + 1]];
  else if (act === 'rollp') { const old = d.roster[i], rest = teamPts(d) - playerPts(old), taken = new Set(d.roster.map(p => p.n)); d.roster[i] = randomPlayer(old.pos, taken, Math.max(20, Math.min(80, BUDGET - rest))); }
  else if (act === 'rollall') { const t = randomTeam(); d.roster = t.roster; }
  else if (act === 'revert') { const t = CUSTOM.find(x => x.id === d.id); if (t) BD.draft = cloneTeam(t); }
  else if (act === 'del') { if (!BD.confirmDel) { BD.confirmDel = true; renderBuilder(); setTimeout(() => { BD.confirmDel = false; if (PAGE === 'builder') renderBuilder(); }, 3500); return; } CUSTOM = CUSTOM.filter(t => t.id !== d.id); saveCustom(); BD.draft = null; renderTeamPickers(); renderBestiary(); }
  else if (act === 'save') { saveDraft(); }
  else if (act === 'play') { if (saveDraft()) { const r = document.querySelector(`input[name=team][value="${d.id}"]`); if (r) { r.checked = true; renderTeamPickers(); } try { history.replaceState(null, '', '#play'); } catch (err) { } showMenu(); showPage('play'); return; } }
  BD.msg = act === 'save' ? BD.msg : ''; renderBuilder();
});

/* ---------- the Play page's team pickers ---------- */
function renderTeamPickers() {
  const seg = document.getElementById('teamSeg'), oseg = document.getElementById('oppSeg'); if (!seg || !oseg) return;
  const all = [...Object.values(TEAMS), ...CUSTOM];
  const cur = (document.querySelector('input[name=team]:checked') || {}).value || 'ironmaw';
  const team = all.some(t => t.id === cur) ? cur : 'ironmaw';
  const curOpp = (document.querySelector('input[name=opp]:checked') || {}).value;
  const radio = (name, t, checked, i) => `<input type="radio" name="${name}" id="${name}-${i}" value="${t.id}" ${checked ? 'checked' : ''}><label for="${name}-${i}" style="border-bottom:3px solid ${t.color}">${esc(t.name)}${t.custom ? ' ★' : ''}</label>`;
  seg.innerHTML = all.map((t, i) => radio('team', t, t.id === team, i)).join('');
  const opps = all.filter(t => t.id !== team), dflt = team === 'ironmaw' ? 'mirewood' : 'ironmaw';
  const opp = opps.some(t => t.id === curOpp) ? curOpp : opps.some(t => t.id === dflt) ? dflt : opps[0].id;
  oseg.innerHTML = opps.map((t, i) => radio('opp', t, t.id === opp, i)).join('');
  const mode = (document.querySelector('input[name=mode]:checked') || {}).value;
  const lbl = document.getElementById('oppLbl'); if (lbl) lbl.textContent = mode === '2p' ? 'Player 2 manages' : mode === 'demo' ? 'Home club' : 'Opponent (CPU)';
  const teamLbl = document.getElementById('teamLbl'); if (teamLbl) teamLbl.textContent = mode === 'demo' ? 'Away club' : mode === 'season' ? 'Your club for the season' : mode === 'cpuseason' ? 'The club the CPU manages' : 'Player 1 manages';
  const oo = document.getElementById('oppOpt'); if (oo) oo.hidden = mode === 'season' || mode === 'cpuseason';
}
document.addEventListener('change', e => { if (e.target && (e.target.name === 'team' || e.target.name === 'mode')) renderTeamPickers(); });
try { const s = JSON.parse(localStorage.getItem('bd-setup') || 'null'); renderTeamPickers(); if (s) { for (const [n, v] of [['team', s.team]]) { const el = document.querySelector(`input[name=${n}][value="${v}"]`); if (el) el.checked = true; } renderTeamPickers(); if (s.opp) { const el = document.querySelector(`input[name=opp][value="${s.opp}"]`); if (el) el.checked = true; } } } catch (e) { renderTeamPickers(); }
renderBestiary();
if (PAGE === 'builder') renderBuilder();
