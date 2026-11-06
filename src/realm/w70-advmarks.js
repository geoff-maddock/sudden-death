/* w70: adventures, phase 5 (issue #47): map markers, for players who want a nudge. Off by default: a setting
   (Adventure markers, SET.advMarks, kept per device like the other settings). When it's on:
     the world map   a gold diamond beside each place where an adventure under way goes next (a place to visit, or
                     the town, ground or site where the person to talk to stands), and the map's key says which
                     adventure each is for (two adventures at one place share the diamond and both are listed)
     a local map     a gold ring round the person to talk to, named in the key
   A place the story hasn't revealed (a hidden site whose clue isn't set) is never marked. The diamond is its own
   shape, not one of the map's place glyphs. Discovery stays the default; this only helps someone who has lost the
   thread.

   wAdvMarks() returns [{ x, y, loc, name, titles: [] }], one per place; wAdvLocalMarks(mapId) the people to talk to.
   Wraps: wMapDraw, wMapDrawLocal (wW70MapDraw, wW70MapDrawLocal: the marks), wOpenMap (wW70OpenMap: the key),
   renderHelp (wW70RenderHelp: a line in #wHelpAdventures). The settings row is added when the Settings panel opens
   (a MutationObserver, as w50's is). */

const W_ADV_MARK = { col: '#d9a62e', ring: '#2a1c10', glyph: '◆' };
// which map each person stands on (people are placed at load and keep their map), built when first asked
let wAdvWhoMap = null;
function wAdvMapOf(who) {
  if (!wAdvWhoMap) { wAdvWhoMap = {}; for (const M of Object.values(MAPS)) for (const n of (M && M.npcs) || []) if (!wAdvWhoMap[n.id]) wAdvWhoMap[n.id] = M.id; }
  return wAdvWhoMap[who] || null;
}
function wAdvLocOfStep(s) {
  const loc = s.k === 'visit' ? DB.locs.find(l => l.id === s.loc) : DB.locs.find(l => l.map === wAdvMapOf(s.who));
  return loc && !(loc.hidden && !wFlag(loc.hidden)) ? loc : null; // never a place the story hasn't shown you
}
function wAdvMarks() {
  if (!WG) return [];
  const S = wAdvAll(), out = [];
  for (const D of W_ADV) for (const L of wAdvLive(D.id, S)) {
    const loc = wAdvLocOfStep(L.step); if (!loc) continue;
    let M = out.find(o => o.loc === loc.id);
    if (!M) out.push(M = { x: loc.x, y: loc.y, loc: loc.id, name: loc.name, titles: [] });
    if (!M.titles.includes(D.title)) M.titles.push(D.title);
  }
  return out;
}
function wAdvLocalMarks(mapId) {
  if (!WG) return [];
  const S = wAdvAll(), out = [];
  for (const D of W_ADV) for (const L of wAdvLive(D.id, S)) {
    const s = L.step; if (s.k === 'visit' || wAdvMapOf(s.who) !== mapId || out.some(o => o.who === s.who)) continue;
    out.push({ who: s.who, name: wChar(s.who).name, title: D.title });
  }
  return out;
}
function wAdvDiamond(c, x, y) {
  c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + 6, y); c.lineTo(x, y + 7); c.lineTo(x - 6, y); c.closePath();
  c.fillStyle = W_ADV_MARK.col; c.fill(); c.lineWidth = 1.5; c.strokeStyle = W_ADV_MARK.ring; c.stroke();
}
const wW70MapDraw = wMapDraw;
wMapDraw = function (cv) {
  wW70MapDraw(cv);
  if (!SET.advMarks) return;
  const S = W_MAP.px, c = cv.getContext('2d');
  c.save();
  // beside the place's mark (up and right), clear of its name above
  for (const M of wAdvMarks()) wAdvDiamond(c, M.x * S + S / 2 + 10, M.y * S + S / 2 - 2);
  c.restore();
};
const wW70MapDrawLocal = wMapDrawLocal;
wMapDrawLocal = function (cv, id) {
  wW70MapDrawLocal(cv, id);
  if (!SET.advMarks) return;
  const m = MAPS[id], S = wMapPx(m), c = cv.getContext('2d');
  c.save(); c.lineWidth = 2.5; c.strokeStyle = W_ADV_MARK.col;
  for (const A of wAdvLocalMarks(id)) { const n = m.npcs.find(x => x.id === A.who); if (!n || n.x < 0) continue; c.beginPath(); c.arc(n.x * S + S / 2, n.y * S + S / 2, 7, 0, Math.PI * 2); c.stroke(); }
  c.restore();
};
const wW70OpenMap = wOpenMap;
wOpenMap = function (view) {
  wW70OpenMap(view);
  const key = document.querySelector('#modalBox .wmapkey'); if (!key || !SET.advMarks) return;
  const m = wCurMap(), world = m.kind === 'world' || view === 'world';
  const rows = world ? wAdvMarks().map(M => `${M.titles.map(esc).join(', ')} (${esc(M.name)})`)
    : wAdvLocalMarks(m.id).map(A => `${esc(A.name)}, for ${esc(A.title)}`);
  if (rows.length) key.insertAdjacentHTML('beforeend', `<span id="wAdvKey"><b style="color:${W_ADV_MARK.col}">${world ? W_ADV_MARK.glyph : '◯'}</b> Next for an adventure: ${rows.join('; ')}</span>`);
};

/* ---------- the setting ---------- */
function wAdvMarksRow() {
  const box = $('modalBox'), tips = box && box.querySelector('#sTips'); if (!tips || !WG || box.querySelector('#wAdvMarks')) return;
  tips.closest('label').insertAdjacentHTML('afterend', `<label class="tog"><input type="checkbox" id="wAdvMarks" ${SET.advMarks ? 'checked' : ''}><span><b>Adventure markers</b><small>A gold mark on the map where each adventure under way goes next. Off, you find the way yourself.</small></span></label>`);
  $('wAdvMarks').onchange = e => { SET.advMarks = !!e.target.checked; saveSettings(); };
}
(() => { const box = $('modalBox'); if (box) new MutationObserver(wAdvMarksRow).observe(box, { childList: true }); })();

const wW70RenderHelp = renderHelp;
renderHelp = function () {
  wW70RenderHelp();
  const h = $('wHelpAdventures'); if (!h || h.dataset.marks) return;
  h.dataset.marks = 1;
  h.insertAdjacentHTML('beforeend', ' If you lose the thread, turn on Adventure markers in Settings: the map marks where each one goes next.');
};
