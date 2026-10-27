/* ================= saving and returning (season runs) ================= */
// Saves live in two places: this browser (instant, always) and, when the page can reach it,
// your private cloud store on claude.ai, so a run follows you to another browser or device.
const SLOTS = ['auto', '1', '2', '3'];
const Cloud = { db: null, uid: null, ready: false, busy: {}, pending: {}, timer: null, lastOk: 0, err: '' };
const SLOTCACHE = {};
let CODES_OPEN = false, CODE_TEXT = '';
document.addEventListener('input', e => { if (e.target && e.target.id === 'saveCode') CODE_TEXT = e.target.value; });
document.addEventListener('toggle', e => { if (e.target && e.target.classList && e.target.classList.contains('codes')) CODES_OPEN = e.target.open; }, true); // slot -> save record {name, savedAt, summary, payload}

function saveRecord() {
  const o = S.opp[S.game];
  return {
    name: S.club.name, savedAt: Date.now(),
    summary: S.over ? (S.over === 'champion' ? 'Champions' : 'Run over') + ` · ${S.wins}–${S.losses}` : `Game ${S.game + 1} of ${SEASON_GAMES} vs ${o ? o.name : '?'} · ${S.wins}–${S.losses} · ${S.lives} ${S.lives === 1 ? 'life' : 'lives'}${S.live ? ' · mid-game' : ''}`,
    payload: JSON.stringify(S),
  };
}
function localKey(slot) { return slot === 'auto' ? 'bd-season' : 'bd-slot-' + slot; }
function readLocal(slot) {
  try {
    const raw = localStorage.getItem(localKey(slot)); if (!raw) return null;
    const j = JSON.parse(raw);
    if (slot === 'auto') { // the autosave key holds the bare run
      if (!j || j.v !== 1) return null;
      const t = +(localStorage.getItem('bd-season-at') || 0);
      return { name: j.club.name, savedAt: t, summary: '', payload: raw };
    }
    return j && j.payload ? j : null;
  } catch (e) { return null; }
}
function writeLocal(slot, rec) {
  try {
    if (slot === 'auto') {
      if (rec) { localStorage.setItem('bd-season', rec.payload); localStorage.setItem('bd-season-at', String(rec.savedAt)); }
      else { localStorage.removeItem('bd-season'); localStorage.removeItem('bd-season-at'); }
    } else if (rec) localStorage.setItem(localKey(slot), JSON.stringify(rec)); else localStorage.removeItem(localKey(slot));
  } catch (e) { }
}
const slotDoc = slot => Cloud.db.doc(`data/users/${Cloud.uid}/save-${slot}`);
async function cloudPut(slot) {
  if (!Cloud.ready) return;
  if (Cloud.busy[slot]) return; // the running write picks up the newest pending body when it finishes
  Cloud.busy[slot] = true;
  try {
    while (Object.prototype.hasOwnProperty.call(Cloud.pending, slot)) {
      const rec = Cloud.pending[slot]; delete Cloud.pending[slot];
      try {
        if (rec) await slotDoc(slot).set(rec); else await slotDoc(slot).delete();
        Cloud.lastOk = Date.now(); Cloud.err = '';
      } catch (e) {
        const code = e && e.code;
        if (code === 'unavailable') { await new Promise(r => setTimeout(r, 800 + R() * 800)); try { if (rec) await slotDoc(slot).set(rec); else await slotDoc(slot).delete(); Cloud.lastOk = Date.now(); Cloud.err = ''; } catch (e2) { Cloud.err = 'Cloud save failed; saved in this browser.'; } }
        else if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') { Cloud.ready = false; Cloud.err = 'Cloud saves are off for this view; saving in this browser.'; }
        else if (code === 'quota_exceeded') Cloud.err = 'Cloud storage is full; saved in this browser.';
        else Cloud.err = 'Cloud save failed; saved in this browser.';
      }
    }
  } finally { Cloud.busy[slot] = false; }
  if (PAGE === 'season') renderSavesOnly();
}
function queueCloud(slot, rec, delay) {
  if (!Cloud.ready) return;
  Cloud.pending[slot] = rec;
  if (delay) { clearTimeout(Cloud.timer); Cloud.timer = setTimeout(() => cloudPut(slot), delay); }
  else cloudPut(slot);
}
// the autosave: every change in the Clubhouse, every game result, and every pitch of a season game
function saveSeason(cloudDelay = 1500) {
  if (!S) { writeLocal('auto', null); SLOTCACHE.auto = null; queueCloud('auto', null, 0); return; }
  const rec = saveRecord(); writeLocal('auto', rec); SLOTCACHE.auto = rec; queueCloud('auto', rec, cloudDelay);
}
function loadSeason() {
  const rec = readLocal('auto');
  if (rec) { try { S = JSON.parse(rec.payload); SLOTCACHE.auto = { ...rec, summary: S ? saveRecord().summary : '' }; } catch (e) { S = null; } }
  for (const s of ['1', '2', '3']) SLOTCACHE[s] = readLocal(s);
}
async function cloudInit() {
  try {
    if (!window.claude || !window.claude.use) return;
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!db || !user) return;
    const uid = await user.id(); if (!uid) return;
    Cloud.db = db; Cloud.uid = uid; Cloud.ready = true;
    // pull cloud copies; keep whichever copy of each slot is newer
    for (const slot of SLOTS) {
      let snap; try { snap = await slotDoc(slot).get(); } catch (e) { continue; }
      const cloud = snap.exists ? snap.data() : null, local = SLOTCACHE[slot];
      if (cloud && (!local || (cloud.savedAt || 0) > (local.savedAt || 0))) {
        SLOTCACHE[slot] = { ...cloud };
        writeLocal(slot, cloud);
        if (slot === 'auto' && !(G.season && G.phase !== 'menu' && G.phase !== 'over')) {
          // only take the cloud copy if this browser has no season, or it's the same run; a different club's run
          // (say, one still playing in another tab) must not replace the season you just picked here
          try { const cs = JSON.parse(cloud.payload); if (!S || !S.active || !cs || (S.runId && cs.runId === S.runId) || (!S.runId && cs.teamId === S.teamId)) S = cs; else { SLOTCACHE.auto = saveRecord(); writeLocal('auto', SLOTCACHE.auto); queueCloud('auto', SLOTCACHE.auto, 0); Cloud.note = `A different season (${cs.club && cs.club.name}) was in your cloud autosave; kept the one in this browser.`; } } catch (e) { }
        }
      } else if (local && (!cloud || (local.savedAt || 0) > (cloud.savedAt || 0))) queueCloud(slot, local, 0);
    }
    Cloud.lastOk = Date.now();
    renderClub(); updateSeasonTab();
    if (typeof historyCloudSync === 'function') historyCloudSync();
    if (typeof teamsCloudSync === 'function') teamsCloudSync();
    if (typeof careerCloudSync === 'function') careerCloudSync();
  } catch (e) { }
}

/* ---------- the game in progress ---------- */
// A snapshot is taken at the start of every pitch; resuming replays from that pitch with the count intact.
function snapGame() {
  if (!G.season || !G.teams || G.phase === 'over' || G.phase === 'menu') return null;
  const all = [], idOf = new Map();
  const reg = p => { if (!p) return null; if (!idOf.has(p)) { idOf.set(p, all.length); all.push(p); } return idOf.get(p); };
  G.teams.forEach(t => { t.def.roster.forEach(reg); t.pen.forEach(reg); t.used.forEach(reg); });
  G.bases.forEach(reg);
  const players = all.map(p => { const o = { ...p }; o.srcId = p.src ? p.src.id : null; delete o.src; delete o.px; delete o.py; return o; });
  const pst = []; if (G.pstats) for (const [p, s] of G.pstats) if (idOf.has(p)) pst.push([idOf.get(p), s]);
  return {
    v: 1, mode: G.mode, innings: G.innings, diff: G.diff, rules: G.rules, humanSide: G.teams.findIndex(t => t.ctl !== 'cpu'),
    defs: G.teams.map(t => { const d = { ...t.def, roster: t.def.roster.map(reg) }; delete d.pen; return d; }),
    teams: G.teams.map(t => ({ ctl: t.ctl, mana: t.mana, idx: t.idx, line: t.line, R: t.R, H: t.H, devourUsed: t.devourUsed, ultUsed: t.ultUsed || {}, pen: t.pen.map(reg), used: t.used.map(reg) })),
    players, full: G.full || [], sky: [G.abN || 0, G.moon0 || 0, G.star0 || 0], inning: G.inning, half: G.half, outs: G.outs, balls: G.balls, strikes: G.strikes, bases: G.bases.map(reg), log: G.log.slice(0, 40), pstats: pst,
  };
}
function seasonLiveSave() {
  if (!S || !S.active || !G.season) return;
  const sn = snapGame(); if (!sn) return;
  S.live = sn; saveSeason(6000);
}
function resumeLive() { if (!S || !S.live) return; resumeSnap(S.live, true); }
// rebuild a game from a snapshot: a season game (S.live) or a saved exhibition game
function resumeSnap(sn, season) {
  const players = sn.players.map(o => { const p = { ...o }; if (o.srcId && season) p.src = SP(o.srcId) || { id: o.srcId }; delete p.srcId; return p; });
  const P = i => (i == null ? null : players[i]);
  document.getElementById('menu').hidden = true; document.getElementById('over').hidden = true; document.getElementById('sOver').hidden = true; document.getElementById('pause').hidden = true;
  PL = null;
  G.mode = sn.mode; G.innings = sn.innings; G.diff = sn.diff; G.season = !!season; G.paused = false;
  G.rules = { ...overallRules(), ...(sn.rules || {}), innings: sn.innings, diff: sn.diff }; AUTO = !!G.rules.auto;
  G.opts = season ? { mode: sn.mode, innings: sn.innings, diff: sn.diff, season: true, humanSide: sn.humanSide } : { ...(sn.opts || {}), mode: sn.mode, innings: sn.innings, diff: sn.diff };
  G.teams = sn.teams.map((t, i) => ({ ...t, def: { ...sn.defs[i], roster: sn.defs[i].roster.map(P), pen: [] }, pen: t.pen.map(P), used: t.used.map(P) }));
  G.pstats = new Map(sn.pstats.map(([i, s]) => [P(i), Object.assign(blankLine(), s)])); G.committed = false; G.starters = G.teams.map(t => t.def.roster.find(p => p.pos === 'P')); for (const t of G.teams) attachGear(t); if (sn.sky) { [G.abN, G.moon0, G.star0] = sn.sky; } else if (typeof skyStart === 'function') skyStart(); if (typeof skyApply === 'function') skyApply(); if (typeof takeStart === 'function') takeStart();
  G.inning = sn.inning; G.half = sn.half; G.outs = sn.outs; G.balls = sn.balls; G.strikes = sn.strikes; G.bases = sn.bases.map(P);
  G.log = sn.log || []; G.full = sn.full || G.log.slice().reverse(); G.archived = false; G.gameId = null; G.rolls = []; G.fx = []; G.slow = 0; G.shake = 0; G.hitstop = 0;
  renderLog(); renderLineScore(); if (typeof renderReadout === 'function') renderReadout();
  G.P = null; startPitch(true);
  banner('Game resumed', `${G.half ? 'Bottom' : 'Top'} of the ${ORD(G.inning)} · ${G.outs} out${G.outs === 1 ? '' : 's'} · ${G.balls}-${G.strikes}`, 2);
  showPage('play');
}
function saveAndQuit() {
  if (G.season && G.phase === 'plate' && G.P && G.P.stage === 'select') seasonLiveSave();
  else if (S) saveSeason(0);
  if (S && S.live) queueCloud('auto', saveRecord(), 0);
  G.phase = 'menu'; G.paused = false; PL = null;
  document.getElementById('pause').hidden = true; document.getElementById('bPause').textContent = 'Pause';
  document.getElementById('menu').hidden = false;
  try { history.replaceState(null, '', '#season'); } catch (e) { }
  showPage('season');
}

/* ---------- save slots, codes ---------- */
function slotSave(slot) {
  if (!S) return;
  if (G.season && G.phase === 'plate' && G.P && G.P.stage === 'select') { const sn = snapGame(); if (sn) S.live = sn; }
  const rec = saveRecord(); SLOTCACHE[slot] = rec; writeLocal(slot, rec); queueCloud(slot, rec, 0);
  seasonLog(`Saved to slot ${slot}.`); saveSeason();
}
function slotLoad(slot) {
  const rec = SLOTCACHE[slot]; if (!rec) return;
  let s; try { s = JSON.parse(rec.payload); } catch (e) { return; }
  if (!s || s.v !== 1) return;
  if (G.season && G.phase !== 'menu' && G.phase !== 'over') { G.phase = 'menu'; PL = null; document.getElementById('menu').hidden = false; }
  S = s; S.sel = null; S.confirm = null;
  seasonLog(`Loaded slot ${slot}.`); saveSeason(0); updateSeasonTab();
}
function slotDelete(slot) { SLOTCACHE[slot] = null; writeLocal(slot, null); queueCloud(slot, null, 0); }
function encodeSave() { const bytes = new TextEncoder().encode(JSON.stringify(S)); let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return 'BD1:' + btoa(bin); }
function decodeSave(code) {
  code = (code || '').trim(); if (!code.startsWith('BD1:')) throw new Error('That is not a Brimstone Diamond save code.');
  const bin = atob(code.slice(4)), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const s = JSON.parse(new TextDecoder().decode(bytes)); if (!s || s.v !== 1 || !s.players) throw new Error('The save code is damaged.');
  return s;
}
const ago = t => { if (!t) return ''; const s = (Date.now() - t) / 1000; return s < 50 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : new Date(t).toLocaleDateString(); };
function savesCard() {
  const where = Cloud.ready ? `Saved to your claude.ai account and this browser${Cloud.lastOk ? ` · synced ${ago(Cloud.lastOk)}` : ''}.` : 'Saved in this browser only. Use a save code to move a run to another browser.';
  const cf = S && S.confirm;
  const slotRow = slot => {
    const r = SLOTCACHE[slot];
    const lbl = slot === 'auto' ? 'Autosave' : `Slot ${slot}`;
    return `<div class="offer"><div><b>${lbl}</b> ${r ? `<span class="sub">· ${esc(r.name)} · ${esc(ago(r.savedAt))}</span><div class="sub">${esc(r.summary || '')}</div>` : '<div class="sub">Empty</div>'}</div>
      <div class="row">${slot === 'auto' ? '' : `${S ? `<button class="buy" data-act="slotSave" data-a="${slot}">${cf === 'save' + slot ? 'Overwrite?' : 'Save'}</button>` : ''}${r ? `<button class="buy" data-act="slotLoad" data-a="${slot}">${cf === 'load' + slot ? 'Replace run?' : 'Load'}</button><button class="buy" data-act="slotDel" data-a="${slot}">${cf === 'del' + slot ? 'Delete?' : '✕'}</button>` : ''}`}</div></div>`;
  };
  return `<section class="card saves" id="savesCard"><h4>Saves</h4>
    <p class="sub">${esc(where)} The run autosaves after every change and every pitch; leaving mid-game is safe, and <b>Resume game</b> picks up at that pitch.${Cloud.err ? ` <span class="warnt">${esc(Cloud.err)}</span>` : ''}</p>
    ${SLOTS.map(slotRow).join('')}
    <details class="codes"${CODES_OPEN ? ' open' : ''}><summary>Save code (copy a run between browsers)</summary>
      <div class="row" style="margin:8px 0">${S ? '<button class="buy" data-act="exportCode">Copy save code</button>' : ''}<button class="buy" data-act="importCode">Load from code</button></div>
      <textarea id="saveCode" rows="3" spellcheck="false" placeholder="Paste a save code here, then press Load from code.">${esc(CODE_TEXT)}</textarea>
      <p class="sub" id="codeMsg" aria-live="polite"></p>
    </details>
  </section>`;
}
function renderSavesOnly() { const el = document.getElementById('savesCard'); if (el && !el.querySelector('textarea:focus')) { const open = el.querySelector('details') && el.querySelector('details').open; el.outerHTML = savesCard(); if (open) { const d = document.querySelector('#savesCard details'); if (d) d.open = true; } } }
function confirmStep(key) { // two-click confirmation for anything destructive
  if (!S) return true;
  if (S.confirm === key) { S.confirm = null; return true; }
  S.confirm = key; renderClub(); setTimeout(() => { if (S && S.confirm === key) { S.confirm = null; renderClub(); } }, 3500);
  return false;
}
function saveAct(act, a) {
  const msg = t => { const m = document.getElementById('codeMsg'); if (m) m.textContent = t; };
  if (act === 'slotSave') { if (SLOTCACHE[a] && !confirmStep('save' + a)) return true; slotSave(a); renderClub(); return true; }
  if (act === 'slotLoad') { if (S && !confirmStep('load' + a)) return true; slotLoad(a); renderClub(); return true; }
  if (act === 'slotDel') { if (!confirmStep('del' + a)) return true; slotDelete(a); renderClub(); return true; }
  if (act === 'resume') { resumeLive(); return true; }
  if (act === 'exportCode') {
    const code = encodeSave(), ta = document.getElementById('saveCode'); if (ta) ta.value = code; CODE_TEXT = code;
    const done = () => msg(`Copied (${Math.round(code.length / 1024)} KB). Paste it into Load from code on the other browser.`);
    try { navigator.clipboard.writeText(code).then(done, () => { if (ta) ta.select(); msg('Selected: press Ctrl+C / ⌘C to copy.'); }); } catch (e) { if (ta) ta.select(); msg('Selected: press Ctrl+C / ⌘C to copy.'); }
    return true;
  }
  if (act === 'importCode') {
    const ta = document.getElementById('saveCode');
    try {
      const s = decodeSave(ta ? ta.value : '');
      if (S && S.active && !confirmStep('import')) { msg('Press Load from code again to replace your current run.'); return true; }
      if (G.season && G.phase !== 'menu' && G.phase !== 'over') { G.phase = 'menu'; PL = null; }
      S = s; S.sel = null; S.confirm = null; CODE_TEXT = ''; seasonLog('Loaded a run from a save code.'); saveSeason(0); updateSeasonTab(); renderClub();
    } catch (e) { msg(e.message || 'That code could not be read.'); }
    return true;
  }
  return false;
}

document.getElementById('bSaveQuit').addEventListener('click', () => saveForLater());
loadSeason(); try { renderClub(); } catch (e) { /* redrawn once every part has loaded */ } updateSeasonTab();
cloudInit();
