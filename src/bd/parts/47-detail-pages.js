/* ================= Detail pages: players, powers, pitches and careers ================= */
// Routes (hash): #player/<club>/<player>, #power/<ability id>, #pitch/<pitch id>, #career/<career key>.
// The Rosters page links every name, power, pitch and career line to these; the pages link to each other.
{ const pg = document.createElement('div'); pg.className = 'page'; pg.id = 'pg-detail'; pg.hidden = true; pg.innerHTML = '<main class="below doc" id="detail"></main>'; const r = document.getElementById('pg-rosters'); r.parentNode.insertBefore(pg, r.nextSibling); }
const DROUTES = ['player', 'power', 'pitch', 'career'];
const enc = s => encodeURIComponent(String(s));
const pKey = p => p.id || p.n;
const hPlayer = (clubId, p) => `#player/${enc(clubId)}/${enc(pKey(p))}`;
const aPower = (id, label, cls = '') => id && AB[id] ? `<a class="dl ${cls}" href="#power/${enc(id)}">${label != null ? label : esc(AB[id].name)}</a>` : '';
const aPitch = (k, label) => PITCHES[k] ? `<a class="dl" href="#pitch/${enc(k)}">${label != null ? label : esc(PITCHES[k].name)}</a>` : esc(k);
const TYPE_TXT = { bat: 'Batting spell', run: 'Running spell', field: 'Fielding spell', pbat: 'Batting skill', prun: 'Running skill', pfield: 'Fielding skill', trun: 'Club magic · running', tfield: 'Club magic · fielding', ult: 'Ultimate' };
const TYPE_KIND = { bat: 'bat', run: 'run', field: 'field', pbat: 'bat', prun: 'run', pfield: 'field' };
// how each power grows with tiers (same numbers as the catalog)
const TIER_TXT = {
  axe: 'Sweet spot bonus +60% → +78% → +96%; power +25% → +33% → +40%.', crush: 'Power +50% → +65% → +80%.', sticky: 'Sweet spot +40% → +52% → +64%.', pact: 'Power +40% → +52% → +64%.',
  dispel: 'Sweet spot +15% → +20% → +24%.', gaze: 'Pitch slows 30% → 39% → 48%.', shriek: 'Scatter ×3 → ×3.6 → ×4.2.', seismic: 'Cost 2 → 1.', bunt: 'Tier III: no stamina cost.', eagle: 'Tier III: no stamina cost.', undying: 'Tier III: no stamina cost.',
  shadowstep: 'Cost 2 → 1.', sprint: 'Lasts 2.5 → 3.3 → 4 s.', fleet: 'Lasts 3 → 3.9 → 4.8 s.', glide: 'Lasts 3 → 3.9 → 4.8 s.', swarm: 'Lasts 2.5 → 3.3 → 4 s; cost 2 → 1.', invis: 'Lasts 3 → 3.9 → 4.8 s; cost 2 → 1.', bullrush: 'Fielder needs 11+ → 13+ → 15+ to hold the tag.', stoneskin: 'Passive; no tiers.',
  devour: 'Needs 12/16 → 10/14 → 8/12; cost 3 → 2 → 1.', pounce: 'Leap 45 → 58 → 72 ft.', boulder: 'Tier III: no stamina cost.', quake: 'Stumble 1.3 → 1.7 → 2.1 s; cost 2 → 1.', flight: 'Airborne 4 → 5.2 → 6.4 s.', haunt: 'Flees 1.2 → 1.6 → 1.9 s.',
  mesmer: 'Freeze 1.8 → 2.3 → 2.9 s; cost 2 → 1.', telek: 'Tier III: no stamina cost.', petrify: 'Needs 10+ → 8+ → 6+; stone 3 → 3.9 → 4.8 s; cost 2 → 1.', web: 'Snare 3 → 3.9 → 4.8 s.', block: 'Tier III: no stamina cost.',
};

/* ---------- lookups ---------- */
function allRosterPlayers() { const out = []; for (const c of rosterClubs()) for (const p of c.players) if (p && p.n) out.push({ c, p }); return out; }
function findPlayer(clubId, key) {
  const c = rosterClubs().find(x => x.id === clubId); if (!c) return null;
  const p = c.players.find(q => q && String(pKey(q)) === key) || c.players.find(q => q && q.n === key); return p ? { c, p } : null;
}
function playerForCK(ck) { return allRosterPlayers().find(x => (x.p.ck || '') === ck) || null; }
function abilUses(id) {
  const rows = []; let total = 0;
  for (const e of Object.values(CAREER || {})) { const n = totalOf(e).abil[id] || 0; if (n) { rows.push({ e, n }); total += n; } }
  rows.sort((a, b) => b.n - a.n); return { total, rows };
}
const ckLink = (e, label) => `<a class="dl" href="#career/${enc(e.ck)}">${label || esc(e.n)}</a>`;
function whoLink(x) { return `<a class="dl" href="${hPlayer(x.c.id, x.p)}">${esc(x.p.n)}</a> <span class="sub">(${esc(x.c.name)}${x.p.pos ? ', ' + x.p.pos : ''})</span>`; }
function powerTips(id) { // pros/cons from the power tips, at tier I
  try {
    const A = AB[id]; if (!A) return null;
    if (BAT_TIP[id]) { const [p, c] = BAT_TIP[id](null, 1); return { pro: p, con: c }; }
    if (RUN_TIP[id]) { const [p, c] = RUN_TIP[id](1); return { pro: p, con: c }; }
    if (FIELD_TIP[id]) { const [p, c] = FIELD_TIP[id](1); return { pro: p, con: c }; }
  } catch (e) { }
  return null;
}
const tipList = T => T && (T.pro.length || T.con.length) ? `<ul class="dt-tips">${T.pro.map(t => `<li class="pro">+ ${esc(t)}</li>`).join('')}${T.con.map(t => `<li class="con">− ${esc(t)}</li>`).join('')}</ul>` : '';

/* ---------- pages ---------- */
function crumbs(extra) { return `<p class="dt-crumbs"><a class="dl" href="#rosters" data-page="rosters">← Rosters</a>${extra ? ' · ' + extra : ''} · <a class="dl" href="javascript:history.back()">Back</a></p>`; }
function playerPage(clubId, key) {
  const f = findPlayer(clubId, key); if (!f) return notFound('That player');
  const { c, p } = f, t = c.t, e = p.ck && CAREER && CAREER[p.ck], it = p.item && ITEMS[p.item];
  const mk = typeof MOON_KIND !== 'undefined' && MOON_KIND[p.kind];
  const need = p.lvl ? xpNeed(p.lvl) : 0, prev = p.lvl ? xpNeed(p.lvl - 1) : 0;
  const pw = (id, ty) => id && AB[id] ? `<div class="dt-row"><span class="ty">${ty}</span> ${aPower(id, `<b>${esc(AB[id].name)}</b>`)} ${AB[id].cost ? gem(AB[id].cost) : ''}${p.tiers && TYPE_KIND[AB[id].type] && (p.tiers[TYPE_KIND[AB[id].type]] || 1) > 1 ? ` <span class="tier">${'I'.repeat(p.tiers[TYPE_KIND[AB[id].type]])}</span>` : ''}<div class="sub">${esc(AB[id].desc)}</div></div>` : '';
  const ult = p.ult || ULT_BY_KIND[p.kind];
  const skills = ['bat', 'run', 'field'].map(k => physOf(p, k)).filter(Boolean);
  const L = e ? totalOf(e) : null, D = L ? derived(L) : null;
  return `${crumbs(`<span style="color:${c.color}">${esc(c.name)}</span>`)}
  <section class="dt-head">
    <img class="por dt-por" alt="Portrait of ${esc(p.n)}" src="${portraitURL(p, t)}" width="128" height="128">
    <div><h2 class="pgh">${esc(p.n)}</h2>
      <p class="lede2" style="margin:4px 0">${esc(p.race)} · #${p.num} · ${p.pos}${p.bench ? ' (bench)' : ''} · bats ${p.hand === 'R' ? 'right' : 'left'} · <a class="dl" href="#season" data-page="season" data-chview="${c.id}" style="color:${c.color}">${esc(c.name)}</a></p>
      <p class="sub">${p.lvl ? `Level ${p.lvl} · ${p.xp - prev}/${need - prev} XP ${bar(p.xp - prev, need - prev, 'xp')}${p.pts ? ` · <span class="pts">${p.pts} stat points to spend</span>` : ''}<br>` : ''}${p.hp != null ? `Health ${Math.round(p.hp)} ${bar(p.hp, 100, 'hp')} · ` : ''}${p.sta != null ? `Stamina ${Math.round(p.sta)} ${bar(p.sta, 100, staCls(p.sta))}` : ''}${p.out && p.out.games ? ` · <span class="warnt">injured: out ${p.out.games} game${p.out.games > 1 ? 's' : ''}</span>` : ''}</p>
      <p class="fl sub"><i>${esc(p.flav || '')}</i></p></div>
  </section>
  <div class="dt-grid">
    <section class="card"><h4>Stats</h4>
      <div class="statgrid">${STATS.map(s => `<div class="${p[s] <= 3 ? 'weak' : ''}"><b>${p[s]}${it && it.mod && it.mod[s] ? `<small>${it.mod[s] > 0 ? '+' : ''}${it.mod[s]}</small>` : ''}</b>${s.toUpperCase()}</div>`).join('')}</div>
      ${STATS.filter(s => p[s] <= 3).map(s => `<p class="sub weaktxt"><b>Weak ${s.toUpperCase()}:</b> ${esc(WEAK_TXT[s])}</p>`).join('')}
      <p class="sub">Stamina max ${Math.round(45 + p.arm * 4 + p.pow * 1.5)}${TIRELESS.includes(p.kind) ? ' · tireless (loses stamina half as fast)' : ''}${mk ? ` · ☾ strongest at the ${MOON[mk[0]].toLowerCase()} (+1 ${mk[1].map(s => s.toUpperCase()).join(', +1 ')})` : ''}</p>
      ${it ? `<p class="sub"><b>Item:</b> ${esc(it.name)}: ${esc(it.desc)}</p>` : ''}
      <p class="sub"><a class="dl" href="#guide" data-page="guide">All about ${esc(p.race)}s on How to play</a></p></section>
    <section class="card"><h4>Powers</h4>
      ${ult && AB[ult] ? `<div class="dt-row"><span class="ty">ULT</span> ${aPower(ult, `<b>${esc(AB[ult].name)}</b>`)} ${gem(3)}<div class="sub">${esc(AB[ult].desc)}</div></div>` : ''}
      ${pw(p.bat, 'BAT')}${pw(p.run, 'RUN')}${pw(p.field, 'FIELD')}
      ${skills.map(id => `<div class="dt-row"><span class="ty">SKILL</span> ${aPower(id, `<b>${esc(AB[id].name)}</b>`)} <span class="stm">⚡${AB[id].stam}</span><div class="sub">${esc(AB[id].desc)}</div></div>`).join('')}
      ${p.pitches ? `<div class="dt-row"><span class="ty">PITCHES</span> ${p.pitches.map(k => aPitch(k)).join(' · ')}</div>` : ''}
      ${!ult && !p.bat && !p.run && !p.field && !skills.length ? '<p class="sub">No powers.</p>' : ''}</section>
    <section class="card"><h4>Career</h4>
      ${L ? `<p class="sub">${L.g} games${L.ab ? ` · ${rate3(D.avg)} AVG · ${L.hr} HR · ${L.rbi} RBI · ${rate3(D.obp + D.slg)} OPS` : ''}${L.outsP ? ` · ${L.w}–${L.l} · ${isFinite(D.era) ? D.era.toFixed(2) : '—'} ERA · ${L.k} K` : ''}</p><div class="tablewrap dt-brk">${playerBreakdown(e)}</div><p>${ckLink(e, 'Full career page →')}</p>` : '<p class="sub">No games on record yet. Numbers start at the final out of his first game.</p>'}</section>
  </div>`;
}
function powerPage(id) {
  const A = AB[id]; if (!A) return notFound('That power');
  const u = ULT[id], kind = TYPE_KIND[A.type];
  const who = allRosterPlayers().filter(({ p }) => u ? (p.ult || ULT_BY_KIND[p.kind]) === id : A.phys ? ['bat', 'run', 'field'].some(k => physOf(p, k) === id) : A.club ? false : (p.bat === id || p.run === id || p.field === id));
  const uses = abilUses(id), T = powerTips(id);
  const moon = typeof MOON_SPELL !== 'undefined' && MOON_SPELL[id] != null ? `☾ 25% stronger under the ${MOON[MOON_SPELL[id]].toLowerCase()}.` : '';
  const skillWho = { uppercut: 'Batters without a bat spell and POW 8+', choke: '…else CON 7+', slap: '…else SPD 8+', grip: '…anyone else', burst: 'Runners without a running spell and SPD 7+', barrel: '…else POW 8+', hookslide: '…anyone else', rocket: 'Fielders without a fielding spell and ARM 8+', dive: '…else FLD 8+ or SPD 8+', leap: '…anyone else' };
  return `${crumbs(TYPE_TXT[A.type] || '')}
  <h2 class="pgh">${esc(A.name)}</h2>
  <p class="lede2">${esc(TYPE_TXT[A.type] || '')}${A.cost ? ` · ${gem(A.cost)} ${A.cost} mana` : A.passive ? ' · passive' : ''}${A.stam ? ` · <span class="stm">⚡${A.stam} stamina</span>` : ''}${u ? ` · once a game · ${esc((TEMPL[u.kind] || {}).race || u.kind)}` : ''}</p>
  <div class="dt-grid">
    <section class="card"><h4>What it does</h4><p>${esc(A.desc)}</p>${tipList(T)}
      ${u ? `<p class="sub">Used as ${{ bat: 'a batting stance (fires when the pitch is thrown)', pitch: 'a pitch', run: 'a running spell', field: 'a fielding spell' }[u.role]}. The condition lasts ${ULT_TURNS} at-bats or until the half-inning ends.</p>` : ''}
      ${TIER_TXT[id] ? `<p class="sub"><b>Tiers II / III</b> (essence in the Clubhouse): ${esc(TIER_TXT[id])}</p>` : kind && !A.phys ? '<p class="sub"><b>Tiers II / III:</b> stronger and cheaper; tier III costs no stamina.</p>' : ''}
      ${A.phys ? `<p class="sub"><b>Who gets it:</b> ${esc(skillWho[id] || 'players without magic of this kind')}. Skills follow stats, so training can switch a player to a stronger one.</p>` : ''}
      ${A.club ? '<p class="sub">Every club can cast it from the dugout, once per play.</p>' : ''}
      ${moon ? `<p class="sub">${moon}</p>` : ''}</section>
    <section class="card"><h4>Who has it</h4>${A.club ? '<p class="sub">Every club.</p>' : who.length ? `<ul class="dt-list">${who.map(x => `<li>${whoLink(x)}</li>`).join('')}</ul>` : '<p class="sub">Nobody on a current roster. Free agents and custom clubs can bring it.</p>'}</section>
    <section class="card"><h4>Used in games</h4>${uses.total ? `<p class="sub">${uses.total} time${uses.total === 1 ? '' : 's'} across every recorded game.</p><ol class="dt-list">${uses.rows.slice(0, 10).map(r => `<li>${ckLink(r.e)} <span class="sub">×${r.n}</span></li>`).join('')}</ol>` : '<p class="sub">Not used in a recorded game yet.</p>'}</section>
  </div>`;
}
function pitchPage(k) {
  const q = PITCHES[k]; if (!q) return notFound('That pitch');
  const who = allRosterPlayers().filter(({ p }) => p.pitches && p.pitches.includes(k));
  const u = q.ult && ULT[k], uses = abilUses(k), t = q.T * PITCH_SCALE, brk = Math.abs(q.bx) + Math.abs(q.bh);
  const T = (() => { const pr = [], cn = []; if (PITCH_TIP[q.fx] || PITCH_TIP[k]) pr.push(...(PITCH_TIP[q.fx] || PITCH_TIP[k])); if (t <= .66) pr.push('Fast to the plate'); else if (t >= .9) cn.push('Slow: easier to time, helps base stealers'); if (q.ctrl <= .12) pr.push('Pinpoint control'); else if (q.ctrl >= .18) cn.push('Wild: scatters more than most'); return { pro: pr, con: cn }; })();
  return `${crumbs(q.magic ? 'Magic pitch' : 'Pitch')}
  <h2 class="pgh">${esc(q.name)}</h2>
  <p class="lede2">${q.ult ? 'Ultimate pitch · once a game' : q.magic ? 'Magic pitch' : 'Ordinary pitch'}${q.cost ? ` · ${gem(q.cost)} ${q.cost} mana` : ''}</p>
  <div class="dt-grid">
    <section class="card"><h4>What it does</h4><p>${esc(u ? u.desc : q.desc)}</p>
      <div class="chips" style="margin:8px 0"><span class="chip"><em>To the plate</em>${t.toFixed(2)} s</span><span class="chip"><em>Break</em>${brk > .5 ? 'big' : brk > .2 ? 'some' : 'little'}</span><span class="chip"><em>Control</em>${q.ctrl <= .12 ? 'pinpoint' : q.ctrl <= .15 ? 'good' : q.ctrl <= .18 ? 'fair' : 'wild'}</span></div>
      ${tipList(T)}${q.magic && !q.ult ? '<p class="sub"><b>Tiers II / III:</b> costs 1 less mana; tier III also lands 25% more accurately and costs no stamina for the magic.</p>' : ''}</section>
    <section class="card"><h4>Who throws it</h4>${who.length ? `<ul class="dt-list">${who.map(x => `<li>${whoLink(x)}</li>`).join('')}</ul>` : '<p class="sub">Nobody on a current roster. Free-agent pitchers can bring it.</p>'}</section>
    ${q.magic ? `<section class="card"><h4>Thrown in games</h4>${uses.total ? `<p class="sub">${uses.total} time${uses.total === 1 ? '' : 's'}.</p><ol class="dt-list">${uses.rows.slice(0, 10).map(r => `<li>${ckLink(r.e)} <span class="sub">×${r.n}</span></li>`).join('')}</ol>` : '<p class="sub">Not thrown in a recorded game yet.</p>'}</section>` : ''}
  </div>`;
}
function careerPage(ck) {
  const e = CAREER && CAREER[ck]; if (!e) return notFound('That career');
  const f = playerForCK(ck), tot = totalOf(e), spans = Object.keys(e.spans).sort((a, b) => (SPANS[a]?.started || 0) - (SPANS[b]?.started || 0));
  const table = (V) => { const rows = [...spans.map(k => [spanLabel(k), e.spans[k]]), ['Career', tot]].filter(([, L]) => V.has(L)); if (!rows.length) return ''; return `<h4>${V.label}</h4><div class="tablewrap"><table class="cat st-table"><thead><tr><th>Span</th>${V.cols.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${rows.map(([lbl, L], i) => `<tr class="${i === rows.length - 1 ? 'st-tot' : ''}"><td>${esc(lbl)}</td>${V.cols.map(([k]) => `<td>${cellHTML(L, k)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; };
  const abs = Object.entries(tot.abil).sort((a, b) => b[1] - a[1]);
  const abLink = id => AB[id] ? aPower(id, `${esc(AB[id].name)}`) : PITCHES[id] ? aPitch(id) : esc(abName(id));
  return `${crumbs(f ? `<a class="dl" href="${hPlayer(f.c.id, f.p)}">${esc(e.n)}</a>` : '')}
  <h2 class="pgh">${esc(e.n)}: career</h2>
  <p class="lede2">${esc(e.race || '')}${e.pos ? ' · ' + e.pos : ''} · last with ${esc(e.teamName || '')}${e.lastPlayed ? ` · last played ${new Date(e.lastPlayed).toLocaleDateString()}` : ''}${f ? ` · <a class="dl" href="${hPlayer(f.c.id, f.p)}">player page</a>` : ''}</p>
  ${['bat', 'pit', 'fld'].map(k => table(VIEWS[k])).join('')}
  <h4>Powers used</h4><p>${abs.length ? abs.map(([id, n]) => `<span class="tg ${id === 'hustle' ? 'tg-hustle' : 'tg-magic'}">${abLink(id)} ×${n}</span>`).join(' ') : '<span class="sub">None yet.</span>'}</p>
  <p class="sub"><a class="dl" href="#stats" data-page="stats">Compare on the Stats page</a></p>`;
}
function notFound(what) { return `${crumbs()}<div class="card"><p class="sub">${what} isn't on any current roster or record.</p></div>`; }

/* ---------- routing ---------- */
{ const o = showPage; showPage = function (pg) {
  const parts = String(pg || '').split('/'), kind = parts[0];
  if (kind === 'rosters') { try { renderBestiary(); } catch (e) { } }
  if (!DROUTES.includes(kind)) return o.apply(this, arguments);
  o.call(this, 'rosters');
  const el = document.getElementById('detail'), dec = s => { try { return decodeURIComponent(s || ''); } catch (e) { return s || ''; } };
  try { el.innerHTML = kind === 'player' ? playerPage(dec(parts[1]), dec(parts.slice(2).join('/'))) : kind === 'power' ? powerPage(dec(parts[1])) : kind === 'pitch' ? pitchPage(dec(parts[1])) : careerPage(dec(parts.slice(1).join('/'))); }
  catch (err) { el.innerHTML = notFound('That page'); }
  document.getElementById('pg-rosters').hidden = true; document.getElementById('pg-detail').hidden = false;
  window.scrollTo(0, 0);
}; }

/* ---------- links on the Rosters page ---------- */
bestCard = function (p, t, clubName) {
  const cid = t.id, hp = hPlayer(cid, p);
  const abLine = (id, ty) => { if (!id || !AB[id]) return ''; const A = AB[id]; return `<div class="ab"><span class="ty">${ty}</span>${aPower(id, `<em>${esc(A.name)}</em>`)} ${A.cost ? `<span class="mn">${'◆'.repeat(A.cost)}</span>` : ''} ${esc(A.desc)}</div>`; };
  const blurb = typeof careerBlurb === 'function' ? careerBlurb(p) : '';
  return `<article class="pc">
    <header><a href="${hp}" aria-label="${esc(p.n)}: player page"><img class="por" alt="Portrait of ${esc(p.n)}" src="${portraitURL(p, t)}" width="64" height="64"></a><div><div class="nm"><a class="dl" href="${hp}">${esc(p.n)}</a></div><div class="rc">#${p.num} · ${esc(p.race)} · bats ${p.hand === 'R' ? 'right' : 'left'}${typeof moonTag === 'function' && MOON && moonTag(p) ? ` · ☾ ${moonTag(p)}` : ''}${clubName ? `<br><span style="color:${t.color}">${esc(clubName)}</span>` : ''}${p.bench ? ' · bench' : ''}${p.lvl ? ` · Lv ${p.lvl}` : ''}</div></div><div class="pos">${p.pos}</div></header>
    <div class="stats">${STATS.map(s => `<div class="${p[s] <= 3 ? 'weak' : ''}"${p[s] <= 3 ? ` title="${esc(WEAK_TXT[s])}"` : ''}><b>${p[s]}</b>${s.toUpperCase()}</div>`).join('')}</div>
    ${STATS.filter(s => p[s] <= 3).map(s => `<div class="ab weaktxt"><span class="ty">WEAK ${s.toUpperCase()}</span> ${esc(WEAK_TXT[s])}</div>`).join('')}
    ${abLine(p.ult || ULT_BY_KIND[p.kind], 'ULT')}${abLine(p.bat, 'BAT')}${abLine(p.run, 'RUN')}${abLine(p.field, 'FIELD')}${['bat', 'run', 'field'].map(k => { const id = physOf(p, k); return id ? `<div class="ab"><span class="ty">SKILL</span>${aPower(id, `<em>${esc(AB[id].name)}</em>`)} <span class="stm">⚡${AB[id].stam}</span> ${esc(AB[id].desc)}</div>` : ''; }).join('')}
    ${p.pitches ? `<div class="ab"><span class="ty">PITCHES</span>${p.pitches.map(k => { const q = PITCHES[k]; return q ? `${aPitch(k, `<em>${esc(q.name)}</em>`)}${q.cost ? ` <span class="mn">${'◆'.repeat(q.cost)}</span>` : ''}` : ''; }).join(' · ')}</div>` : ''}
    ${blurb ? `<div class="ab"><span class="ty">CAREER</span> ${p.ck && CAREER[p.ck] ? `<a class="dl" href="#career/${enc(p.ck)}">${blurb}</a>` : blurb}</div>` : ''}
    <p class="fl">${esc(p.flav || '')}</p>
  </article>`;
};
bestRow = function (p, t, clubName) {
  const nm = id => id && AB[id] ? aPower(id) : '—', L = careerOf(p), hp = hPlayer(t.id, p);
  return `<tr><td><a href="${hp}"><img class="por" alt="" src="${portraitURL(p, t)}" width="34" height="34"></a></td><td><a class="dl" href="${hp}"><b>${esc(p.n)}</b></a><div class="sub">${esc(p.race)}</div></td><td><span style="color:${t.color}">${esc(clubName)}</span></td><td>${p.pos}${p.bench ? ' <span class="sub">bench</span>' : ''}</td><td>${p.num}</td><td>${p.hand}</td>
    ${STATS.map(s => `<td class="${p[s] <= 3 ? 'weakc' : ''}"${p[s] <= 3 ? ` title="${esc(WEAK_TXT[s])}"` : ''}>${p[s]}</td>`).join('')}
    <td>${nm(p.ult || ULT_BY_KIND[p.kind])}</td><td>${nm(p.bat)}</td><td>${nm(p.run)}</td><td>${nm(p.field)}</td><td class="sub">${L && L.g ? `<a class="dl" href="#career/${enc(p.ck)}">${L.g} G · ${L.ab ? (L.h / L.ab).toFixed(3).replace(/^0/, '') : '—'} · ${L.hr} HR${L.outsP ? ` · ${L.k} K` : ''}</a>` : '—'}</td></tr>`;
};
// the Stats page: names open the career page too
{ const o = renderStats; renderStats = function () { o.apply(this, arguments); try { document.querySelectorAll('#stats .st-row').forEach(tr => { const b = tr.querySelector('td b'); if (b && !b.closest('a')) b.insertAdjacentHTML('afterend', ` <a class="dl dt-go" href="#career/${enc(tr.dataset.stOpen)}" title="Career page">↗</a>`); }); } catch (e) { } }; }
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#stats .dt-go')) e.stopPropagation(); }, true);

{ const st = document.createElement('style'); st.textContent = `
a.dl{color:inherit;text-decoration:underline;text-decoration-color:rgba(255,181,71,.45);text-underline-offset:2px}a.dl:hover{color:var(--torch);text-decoration-color:var(--torch)}
.pc .nm a.dl{text-decoration-color:transparent}.pc .nm a.dl:hover{text-decoration-color:var(--torch)}
.dt-crumbs{margin:0 0 10px;font-size:14px;color:var(--faint)}
.dt-head{display:flex;gap:18px;align-items:center;margin-bottom:18px}.dt-por{width:128px;height:128px;border-radius:12px;flex:none}
.dt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;align-items:start;margin-bottom:18px}
.dt-row{padding:7px 0;border-top:1px solid var(--line)}.dt-row:first-of-type{border-top:0}
.dt-list{margin:4px 0 0;padding-left:18px;display:grid;gap:3px;font-size:15px}
.dt-tips{list-style:none;padding:0;margin:8px 0;display:grid;gap:2px;font-size:14px}.dt-tips .pro{color:#9fe38a}.dt-tips .con{color:#ff9a8a}
.dt-go{font-size:13px;margin-left:2px}
#detail .st-table th:not(:first-child){text-align:right}.dt-brk .st-break table{min-width:640px}.dt-brk td:not(:first-child),.dt-brk th:not(:first-child){text-align:right}
@media (max-width:700px){.dt-head{flex-direction:column;align-items:flex-start}.dt-por{width:96px;height:96px}}`; document.head.appendChild(st); }
try { RV_SIG = ''; renderBestiary(); if (DROUTES.includes((location.hash || '').slice(1).split('/')[0])) showPage(location.hash.slice(1)); } catch (e) { }
