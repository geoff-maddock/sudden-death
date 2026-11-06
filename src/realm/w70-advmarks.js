/* w70: adventures, phase 5 (issue #47): map markers, for players who want a nudge. Off by default: a setting
   (Adventure markers, SET.advMarks, kept per device like the other settings). When it's on, the world map marks
   where each adventure under way goes next: a place to visit, or the town (or ground, or site) where the person to
   talk to stands. Discovery stays the default; this only helps someone who has lost the thread.

   wAdvMarks() returns [{ x, y, loc, title }], one per place.
   Wraps: wMapDraw (wW70MapDraw: the marks on the world map), renderHelp (wW70RenderHelp: a line in
   #wHelpAdventures). The settings row is added when the Settings panel opens (a MutationObserver, as w50's is). */

const W_ADV_MARK = { col: '#d9a62e', ring: '#2a1c10' };
function wAdvMapOf(who) { const m = Object.values(MAPS).find(M => M && (M.npcs || []).some(n => n.id === who)); return m ? m.id : null; }
function wAdvLocOfStep(s) {
  if (s.k === 'visit') return DB.locs.find(l => l.id === s.loc) || null;
  const map = wAdvMapOf(s.who); return map ? DB.locs.find(l => l.map === map) || null : null;
}
function wAdvMarks() {
  if (!WG) return [];
  const S = wAdvAll(), out = [];
  for (const D of W_ADV) for (const L of wAdvLive(D.id, S)) {
    const loc = wAdvLocOfStep(L.step); if (!loc || out.some(o => o.loc === loc.id)) continue;
    out.push({ x: loc.x, y: loc.y, loc: loc.id, title: D.title });
  }
  return out;
}
const wW70MapDraw = wMapDraw;
wMapDraw = function (cv) {
  wW70MapDraw(cv);
  if (!SET.advMarks) return;
  const S = W_MAP.px, c = cv.getContext('2d');
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const M of wAdvMarks()) {
    const cx = M.x * S + S / 2, cy = M.y * S + S / 2;
    c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4 : 10, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(cx + Math.cos(a) * r, cy - 22 + Math.sin(a) * r); } c.closePath();
    c.fillStyle = W_ADV_MARK.col; c.fill(); c.lineWidth = 1.5; c.strokeStyle = W_ADV_MARK.ring; c.stroke();
    wMapLabel(c, M.title, cx, cy - 36, 11, true, W_ADV_MARK.ring);
  }
  c.restore();
};

/* ---------- the setting ---------- */
function wAdvMarksRow() {
  const box = $('modalBox'), tips = box && box.querySelector('#sTips'); if (!tips || !WG || box.querySelector('#wAdvMarks')) return;
  tips.closest('label').insertAdjacentHTML('afterend', `<label class="tog"><input type="checkbox" id="wAdvMarks" ${SET.advMarks ? 'checked' : ''}><span><b>Adventure markers</b><small>A star on the world map where each adventure under way goes next. Off, you find the way yourself.</small></span></label>`);
  $('wAdvMarks').onchange = e => { SET.advMarks = !!e.target.checked; saveSettings(); };
}
(() => { const box = $('modalBox'); if (box) new MutationObserver(wAdvMarksRow).observe(box, { childList: true }); })();

const wW70RenderHelp = renderHelp;
renderHelp = function () {
  wW70RenderHelp();
  const h = $('wHelpAdventures'); if (!h || h.dataset.marks) return;
  h.dataset.marks = 1;
  h.insertAdjacentHTML('beforeend', ' If you lose the thread, turn on Adventure markers in Settings: the map shows where each one goes next.');
};
