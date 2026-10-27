/* w8: Realm boot. Runs after every part has loaded (the prelude stopped app/boot.js booting the standalone game).
   Reassigns (never redeclares) showView, frame and renderTitle, adds saving and loading of WG and RUN, then boots.
   Sudden Death's saveRun/loadRun/clearRun are pointed at this save in w5-bridge.js. */
const REALM = { v: 2 };
document.title = 'Champions of the Realm';

/* ---------- save and load: one save per profile, { v: 2, WG, RUN }. v1 saves held WG only. ---------- */
function wSaveKey() { return pkey('sd-realm'); }
function wSave() {
  if (LAB || !WG || !RUN || RUN.over) return false;
  wStoreNpcs(WG.map);
  try { localStorage.setItem(wSaveKey(), JSON.stringify({ v: REALM.v, WG, RUN })); return true; } catch (e) { return false; }
}
function wLoadSave() {
  try { const r = JSON.parse(localStorage.getItem(wSaveKey()) || 'null'); return r && (r.v === 1 || r.v === 2) && r.WG && r.WG.map && !(r.RUN && r.RUN.over) ? r : null; } catch (e) { return null; }
}
function wEnsureMaps() { if (!MAPS.world) buildAllMaps(); }
/* save = a loaded record (or null for a new journey); opts = { hardcore } for a new one */
function wStart(save, opts) {
  wEnsureMaps();
  WQ.length = 0;
  B = null; RUN = null;
  if (save) {
    WG = save.WG;
    WG.club = CLUBS[WG.club] ? WG.club : wDefaultClub();
    for (const k of ['flags', 'items', 'npc', 'seen', 'harv', 'xpk']) WG[k] = WG[k] || {};
    WG.energy = WG.energy || { bloom: 0, ember: 0, tide: 0, rime: 0, aether: 0 };
    WG.marks = WG.marks || [];
    WG.hardcore = !!WG.hardcore; WG.blackouts = WG.blackouts || 0;
    if (!MAPS[WG.map]) { WG.map = 'graftonbury'; WG.x = 5; WG.y = 11; }
    if (save.RUN) RUN = save.RUN;
    else wNewRun(WG.club, WG.gold != null ? WG.gold : 120); // v1: the team was WG.party, the purse WG.gold
    delete WG.gold; delete WG.party; WG.v = 2;
    WG.club = RUN.club;
    RUN.path = RUN.path || [];
    UID = Math.max(UID, ...RUN.deck.map(c => c.uid || 0)) + 1;
    for (const id in WG.npc) wApplyNpcs(id);
    WLOG = [];
    wLog('Back on the road: ' + MAPS[WG.map].name + ', ' + wSeason().toLowerCase() + ', day ' + WG.day + '.', 'g');
    WQ.push({ k: 'map' });
  } else wNewGame(opts);
  wPartyInit(); // the roster (w6-party.js): founders on a new journey, or built from an older save
  wInvalidate();
  // a match in progress picks up where it was: a saved fight on the same turn, a match not yet snapshotted from
  // its kickoff, or the reward panel
  if (RUN.battle) { wSave(); restoreBattle(RUN.battle); wNameLead(); return; }
  if (RUN.pending && RUN.pending.world) { wSave(); beginFight(RUN.pending); wNameLead(); return; }
  if (RUN.panel && RUN.panel.t === 'reward') { wSave(); renderPanel(); return; }
  RUN.pending = null; RUN.panel = null;
  wSave();
  showView('world');
  if (WG.cardOffer) wShowCardOffer();
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
  card.querySelector('p').textContent = 'Lead three monsters across the Charter Plains, the Mosswold, the Brinefen, the Cindermaw and the Frostspire. Talk to the towns, trade at the shops, and sleep at the inns. Every fight on the road is a match. Win the four cups, brave the dungeons, and take the Crown.';
  const bp = document.querySelector('.brand p'); if (bp) bp.textContent = 'A Sudden Death journey. The Brimstone League takes to the road.';
  const h1 = document.querySelector('.brand h1'); if (h1) h1.innerHTML = 'Champions <small class="wrealm">of the</small> <span>Realm</span>';
})();
renderTitle = function () {
  const sv = wLoadSave(), row = $('resumeRow');
  if (sv) {
    const W = sv.WG, R = sv.RUN;
    const where = (DB.towns.find(t => t.id === W.map) || DB.locs.find(l => l.map === W.map || l.id === W.map) || { name: W.map === 'world' ? 'On the road' : W.map }).name;
    const gold = R ? R.gold : W.gold, hp = R ? ` ${R.hp}/${R.maxhp} HP,` : '';
    const mid = R && R.battle ? ` Paused mid-match: turn ${R.battle.turn} against ${esc(R.battle.enemies.filter(e => !e.dead && !e.fled).map(e => e.n.split(',')[0]).join(', '))}.` : R && R.pending ? ' A match is about to start.' : '';
    row.hidden = false;
    row.innerHTML = `<b>Journey in progress${W.hardcore ? ' (Hardcore)' : ''}</b><span>${esc(where)}. Year ${W.year}, day ${W.day},${hp} ${gold} gold.${mid}</span><button class="btn" id="bResume" style="font-size:22px">Continue</button>`;
    $('bResume').onclick = () => wStart(wLoadSave());
  } else row.hidden = true;
  const b = $('bNew');
  b.textContent = 'Walk the realm';
  b.onclick = () => { if (wLoadSave()) askConfirm('Start a new journey?', 'Your journey in progress on this profile will be replaced.', 'Start over', () => setTimeout(wNewGameCard, 0)); else wNewGameCard(); };
  showScreen('title');
  if (typeof profileChip === 'function') profileChip();
};
/* a new journey: the draft screen, where you pick a club, three founders and Hardcore (w6-party.js) */
function wNewGameCard() { wOpenDraft(); }
// leaving the page keeps your place (a fight saves itself through Sudden Death's own pagehide)
window.addEventListener('pagehide', () => { if ((UI.view === 'world' || UI.view === 'panel') && !window.__switching) wSave(); });

boot();
