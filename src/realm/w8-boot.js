/* w8: Realm boot. Runs after every part has loaded (the prelude stopped app/boot.js booting the standalone game).
   Reassigns (never redeclares) showView, frame and renderTitle, adds saving and loading of WG, then boots. */
const REALM = { v: 1 };
document.title = 'Sudden Death: Realm';

/* ---------- save and load: one save per profile, { v, WG } ---------- */
function wSaveKey() { return pkey('sd-realm'); }
function wSave() {
  if (LAB || !WG) return false;
  wStoreNpcs(WG.map);
  try { localStorage.setItem(wSaveKey(), JSON.stringify({ v: REALM.v, WG })); return true; } catch (e) { return false; }
}
function wLoadSave() {
  try { const r = JSON.parse(localStorage.getItem(wSaveKey()) || 'null'); return r && r.v === REALM.v && r.WG && r.WG.map ? r : null; } catch (e) { return null; }
}
function wEnsureMaps() { if (!MAPS.world) buildAllMaps(); }
function wStart(save) {
  wEnsureMaps();
  WQ.length = 0;
  if (save) {
    WG = save.WG;
    const d = wDefaultParty();
    WG.party = WG.party || d.party; WG.club = WG.club || d.club;
    for (const k of ['flags', 'items', 'npc', 'seen', 'harv', 'xpk']) WG[k] = WG[k] || {};
    WG.energy = WG.energy || { bloom: 0, ember: 0, tide: 0, rime: 0, aether: 0 };
    WG.marks = WG.marks || [];
    if (!MAPS[WG.map]) { WG.map = 'graftonbury'; WG.x = 5; WG.y = 11; }
    for (const id in WG.npc) wApplyNpcs(id);
    WLOG = [];
    wLog('Back on the road: ' + MAPS[WG.map].name + ', ' + wSeason().toLowerCase() + ', day ' + WG.day + '.', 'g');
    WQ.push({ k: 'map' });
  } else wNewGame();
  wInvalidate();
  wSave();
  showView('world');
}

/* ---------- views: Sudden Death's showView, plus the world ---------- */
(() => {
  const sdShowView = showView;
  showView = function (v) {
    sdShowView(v);
    $('v-world').hidden = v !== 'world';
    $('runbar').hidden = v === 'world';
    if (v === 'world') wShowWorld();
  };
})();

/* ---------- the frame loop: Sudden Death's frame, plus a world branch ----------
   app/boot.js's frame() ends by calling requestAnimationFrame(frame), which looks the global name up each time,
   so after this reassignment the loop runs through the wrapper. The wrapper draws the world, then hands over. */
(() => {
  const sdFrame = frame;
  frame = function (now) {
    if (UI.view === 'world' && WG && !$('pg-play').hidden) {
      try { cleanCtx(WUI.c || tctx); wRender(now); }
      catch (e) { console.error(e); if (!frame.err) { frame.err = 1; window.__sdErrs.push(String(e && e.stack || e)); } frame.dirty = 1; }
    }
    sdFrame(now);
  };
})();

/* ---------- title ---------- */
(() => {
  const card = document.querySelector('#scr-title .titlecard');
  card.querySelector('h2').textContent = 'Walk the realm. Every fight is a game.';
  card.querySelector('p').textContent = 'Lead three monsters across the Charter Plains, the Mosswold, the Brinefen, the Cindermaw and the Frostspire. Talk to the towns, trade at the shops, and sleep at the inns. Matches, cups and dungeons are on their way: for now the realm is yours to explore.';
  const bp = document.querySelector('.brand p'); if (bp) bp.textContent = 'Sudden Death: Realm. The Brimstone League takes to the road.';
  const h1 = document.querySelector('.brand h1'); if (h1) h1.innerHTML = 'Sudden <span>Death</span> <small class="wrealm">Realm</small>';
})();
renderTitle = function () {
  const sv = wLoadSave(), row = $('resumeRow');
  if (sv) {
    const W = sv.WG;
    const where = (DB.towns.find(t => t.id === W.map) || DB.locs.find(l => l.map === W.map || l.id === W.map) || { name: W.map === 'world' ? 'On the road' : W.map }).name;
    row.hidden = false;
    row.innerHTML = `<b>Journey in progress</b><span>${esc(where)}. Year ${W.year}, day ${W.day}, ${W.gold} gold.</span><button class="btn" id="bResume" style="font-size:22px">Continue</button>`;
    $('bResume').onclick = () => wStart(wLoadSave());
  } else row.hidden = true;
  const b = $('bNew');
  b.textContent = 'Walk the realm';
  b.onclick = () => { if (wLoadSave()) askConfirm('Start a new journey?', 'Your journey in progress on this profile will be replaced.', 'Start over', () => wStart(null)); else wStart(null); };
  showScreen('title');
  if (typeof profileChip === 'function') profileChip();
};
// leaving the page keeps your place
window.addEventListener('pagehide', () => { if (UI.view === 'world' && !window.__switching) wSave(); });

boot();
