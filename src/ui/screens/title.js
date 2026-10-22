/* p8: screens and flow — title, draft, map nodes, rewards, shop, locker room, events, the end; pages; boot */
function showScreen(s) {
  for (const k of ['title', 'draft', 'run', 'end']) $('scr-' + k).hidden = k !== s;
  UI.screen = s; if (s !== 'run') UI.view = null;
  window.scrollTo({ top: 0 });
}
function showView(v) {
  showScreen('run'); UI.view = v;
  for (const k of ['map', 'fight', 'panel']) $('v-' + k).hidden = k !== v;
  hideTip();
  if (v === 'fight') { fitStage(true); requestAnimationFrame(() => fitStage()); }
  renderRunBar();
}
function showPage(p) {
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.pg === p ? 'page' : 'false'));
  for (const k of ['play', 'help', 'best', 'rec']) $('pg-' + k).hidden = k !== p;
  if (p === 'help') renderHelp(); if (p === 'best') renderBestiary(); if (p === 'rec') renderRecords();
  hideTip();
}

/* ---------- title ---------- */
const TITLE = { club: pick(CLUB_IDS), sports: ['football', 'baseball', 'hockey', 'basketball', 'bowling', 'jousting'], i: 0, t0: 0 };
TITLE.party = shuffle(CLUBS[TITLE.club].roster.slice()).slice(0, 3);
function drawTitle(c) {
  const k = (A.t - TITLE.t0); if (k > 5) { TITLE.i = (TITLE.i + 1) % TITLE.sports.length; TITLE.t0 = A.t; }
  const s = TITLE.sports[TITLE.i], prev = TITLE.sports[(TITLE.i + TITLE.sports.length - 1) % TITLE.sports.length];
  c.drawImage(arenaBG(prev, 2), 0, 0, SW, SH);
  c.save(); c.globalAlpha = Math.min(1, (A.t - TITLE.t0) / .8); c.drawImage(arenaBG(s, 2), 0, 0, SW, SH); c.restore();
  flames(c, 2);
  const team = CLUBS[TITLE.club];
  const draws = [];
  const TP = [{ x: 600, y: 410 }, { x: 520, y: 372 }, { x: 445, y: 420 }];
  TITLE.party.forEach(([n, kind, num], i) => draws.push({ y: TP[i].y, f: () => drawAny(c, kind, TP[i].x, TP[i].y, 104, team, { num, wpn: KIND_WPN[kind], wang: -1.15 + Math.sin(A.t * 2 + i) * .08 }) }));
  const bt = ENEMIES.baron.team, it = ACTS[2].team;
  draws.push({ y: 372, f: () => drawAny(c, 'fiend', 790, 372, 140, bt, { num: 1, wpn: 'scythe', wang: -1.2 + Math.sin(A.t * 1.6) * .1, flip: true }) });
  draws.push({ y: 320, f: () => drawAny(c, 'imp', 690, 320, 90, it, { num: 6, wpn: 'bat', wang: -1, flip: true }) });
  draws.push({ y: 430, f: () => drawAny(c, 'imp', 900, 430, 90, it, { num: 66, wpn: 'bat', wang: -1, flip: true }) });
  draws.sort((a, b) => a.y - b.y).forEach(d => d.f());
  scoreboard(c, s, 'Tonight: the Brimstone Pit');
}
function renderTitle() {
  const r = loadRun(), row = $('resumeRow');
  if (r) { const c = CLUBS[r.club]; row.hidden = false; row.innerHTML = `<b>Run in progress</b><span>${esc(c.name)}: ${r.party.map(p => esc(p.n)).join(', ')}. Act ${r.act + 1}, ${r.hp}/${r.maxhp} HP, ${r.gold} gold.${r.battle ? ` Paused mid-fight: turn ${r.battle.turn} against ${esc(r.battle.enemies.filter(e => !e.dead && !e.fled).map(e => e.n.split(',')[0]).join(', '))}.` : ''}</span><button class="btn" id="bResume" style="font-size:22px">Continue</button>`; $('bResume').onclick = () => resumeRun(r); }
  else row.hidden = true;
  showScreen('title');
}

